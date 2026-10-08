import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AuthClientService } from "api-server-toolkit/auth-client";
import { In, Repository } from "typeorm";
import {
  ChannelEntity,
  ChannelMemberEntity,
  MemberRole,
  dmKeyFor,
} from "./channel.entity";
import { MessageEntity } from "./message.entity";
import { MessageAttachmentDto } from "@src/contracts";
import { ChatConfig } from "./chat.config";

/** Minimal identity the domain logic needs (REST account or WS account). */
export interface ChatActor {
  id: number;
  username: string;
  isSuperuser: boolean;
}

const ROLE_RANK: Record<MemberRole, number> = {
  member: 1,
  moderator: 2,
  owner: 3,
};

export interface MessageWire {
  id: number;
  channelId: number;
  author: { id: number; username: string };
  body: string;
  attachments: MessageAttachmentDto[] | null;
  clientId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channels: Repository<ChannelEntity>,
    @InjectRepository(ChannelMemberEntity)
    private readonly members: Repository<ChannelMemberEntity>,
    @InjectRepository(MessageEntity)
    private readonly messages: Repository<MessageEntity>,
    private readonly chatConfig: ChatConfig,
    private readonly authClient: AuthClientService,
  ) {}

  // ------------------------------------------------------------------
  // membership
  // ------------------------------------------------------------------

  /**
   * Channel access = membership; superuser bypasses (moderator grade).
   * Rows the actor cannot see are 404 (not 403) — same semantics as the
   * toolkit scopes.
   */
  async assertMember(
    channelId: number,
    actor: ChatActor,
    minRole?: MemberRole,
  ): Promise<ChannelMemberEntity> {
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (!channel || channel.deletedAt) throw new NotFoundException();

    if (!actor.isSuperuser) {
      const member = await this.members.findOneBy({
        channelId: String(channelId),
        accountId: String(actor.id),
      });
      if (!member) throw new NotFoundException();
      if (minRole && ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
        throw new ForbiddenException();
      }
      return member;
    }
    return {
      id: "0",
      channelId: String(channelId),
      accountId: String(actor.id),
      role: "moderator",
      lastReadMessageId: "0",
      joinedAt: new Date(),
    } as ChannelMemberEntity;
  }

  // ------------------------------------------------------------------
  // channels
  // ------------------------------------------------------------------

  async createChannel(
    actor: ChatActor,
    input: {
      type: "channel" | "dm";
      title?: string;
      isPublic?: boolean;
      members?: number[];
    },
  ): Promise<{ channel: ChannelEntity; created: boolean }> {
    if (input.type === "dm") {
      const other = input.members?.[0];
      if (!other || input.members!.length !== 1 || Number(other) === actor.id) {
        throw new BadRequestException("A DM needs exactly one other accountId");
      }
      const dmKey = dmKeyFor(actor.id, other);
      const existing = await this.channels.findOneBy({ dmKey });
      if (existing && !existing.deletedAt) {
        return { channel: existing, created: false };
      }
      // Concurrent same-pair creations race on the unique dm_key; the
      // loser reads the winner back (idempotent open).
      try {
        const channel = await this.channels.save({
          type: "dm",
          isPublic: false,
          title: null,
          dmKey,
          createdBy: String(actor.id),
        });
        await this.members.save([
          {
            channelId: channel.id,
            accountId: String(actor.id),
            role: "member",
          },
          { channelId: channel.id, accountId: String(other), role: "member" },
        ]);
        return { channel, created: true };
      } catch {
        const channel = await this.channels.findOneBy({ dmKey });
        if (!channel) throw new ConflictException();
        return { channel, created: false };
      }
    }

    const channel = await this.channels.save({
      type: "channel",
      isPublic: input.isPublic ?? false,
      title: input.title ?? null,
      dmKey: null,
      createdBy: String(actor.id),
    });
    const rows: Partial<ChannelMemberEntity>[] = [
      { channelId: channel.id, accountId: String(actor.id), role: "owner" },
    ];
    for (const accountId of input.members ?? []) {
      if (Number(accountId) !== actor.id) {
        rows.push({
          channelId: channel.id,
          accountId: String(accountId),
          role: "member",
        });
      }
    }
    await this.members.save(rows);
    return { channel, created: true };
  }

  async getChannel(channelId: number, actor: ChatActor) {
    const { channel, myRole } = await this.getChannelWithRole(channelId, actor);
    return { channel, myRole };
  }

  private async getChannelWithRole(channelId: number, actor: ChatActor) {
    await this.assertMember(channelId, actor);
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (!channel || channel.deletedAt) throw new NotFoundException();
    const me = await this.members.findOneBy({
      channelId: String(channelId),
      accountId: String(actor.id),
    });
    return { channel, myRole: me?.role ?? ("member" as MemberRole) };
  }

  async listMyChannels(actor: ChatActor) {
    const rows = await this.members
      .createQueryBuilder("m")
      .innerJoin(
        ChannelEntity,
        "c",
        "c.id = m.channel_id AND c.deleted_at IS NULL",
      )
      .where("m.account_id = :accountId", { accountId: String(actor.id) })
      .orderBy("m.channel_id", "DESC")
      .getMany();
    const channelIds = rows.map((r) => r.channelId);
    const channelMap = new Map(
      channelIds.length
        ? (await this.channels.findBy({ id: In(channelIds) })).map((c) => [
            c.id,
            c,
          ])
        : [],
    );
    return rows
      .map((m) => {
        const channel = channelMap.get(m.channelId);
        if (!channel) return null;
        return {
          channel,
          myRole: m.role,
          lastReadMessageId: Number(m.lastReadMessageId),
        };
      })
      .filter(Boolean) as Array<{
      channel: ChannelEntity;
      myRole: MemberRole;
      lastReadMessageId: number;
    }>;
  }

  async updateChannel(
    channelId: number,
    actor: ChatActor,
    patch: { title?: string; isPublic?: boolean },
  ) {
    await this.assertMember(channelId, actor, "owner");
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (!channel || channel.deletedAt) throw new NotFoundException();
    if (channel.type === "dm") {
      throw new BadRequestException("A DM cannot be edited");
    }
    if (patch.title !== undefined) channel.title = patch.title;
    if (patch.isPublic !== undefined) channel.isPublic = patch.isPublic;
    return this.channels.save(channel);
  }

  /** Soft delete — history stays restorable, the room is closed for all. */
  async deleteChannel(channelId: number, actor: ChatActor) {
    await this.assertMember(channelId, actor, "owner");
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (!channel || channel.deletedAt) throw new NotFoundException();
    channel.deletedAt = new Date();
    await this.channels.save(channel);
    return channel;
  }

  async joinChannel(channelId: number, actor: ChatActor) {
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (!channel || channel.deletedAt) throw new NotFoundException();
    if (channel.type === "dm" || !channel.isPublic) {
      throw new ForbiddenException("Channel is not public");
    }
    const existing = await this.members.findOneBy({
      channelId: String(channelId),
      accountId: String(actor.id),
    });
    if (existing) return { member: existing, created: false };
    const member = await this.members.save({
      channelId: String(channelId),
      accountId: String(actor.id),
      role: "member",
    });
    return { member, created: true };
  }

  async leaveChannel(channelId: number, actor: ChatActor) {
    const member = await this.assertMember(channelId, actor);
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (channel?.type === "dm") {
      throw new BadRequestException("A DM cannot be left");
    }
    if (member.role === "owner") {
      throw new BadRequestException(
        "The owner cannot leave — delete the channel instead",
      );
    }
    await this.members.remove(member);
    return member;
  }

  async listMembers(channelId: number, actor: ChatActor) {
    await this.assertMember(channelId, actor);
    const rows = await this.members.findBy({ channelId: String(channelId) });
    const withProfiles = await Promise.all(
      rows.map(async (m) => ({
        accountId: Number(m.accountId),
        username: await this.usernameOf(Number(m.accountId)),
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    );
    return withProfiles.sort(
      (a, b) =>
        ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.accountId - b.accountId,
    );
  }

  /** Mod+ invite into a (private) channel; public channels use join. */
  async addMember(channelId: number, actor: ChatActor, accountId: number) {
    await this.assertMember(channelId, actor, "moderator");
    const channel = await this.channels.findOneBy({ id: String(channelId) });
    if (!channel || channel.deletedAt || channel.type === "dm") {
      throw new NotFoundException();
    }
    const existing = await this.members.findOneBy({
      channelId: String(channelId),
      accountId: String(accountId),
    });
    if (existing) return { member: existing, created: false };
    const member = await this.members.save({
      channelId: String(channelId),
      accountId: String(accountId),
      role: "member",
    });
    return { member, created: true };
  }

  async setMemberRole(
    channelId: number,
    actor: ChatActor,
    accountId: number,
    role: Exclude<MemberRole, "owner">,
  ) {
    await this.assertMember(channelId, actor, "owner");
    if (Number(accountId) === actor.id && !actor.isSuperuser) {
      throw new BadRequestException(
        "Use channel deletion to give up ownership",
      );
    }
    const member = await this.members.findOneBy({
      channelId: String(channelId),
      accountId: String(accountId),
    });
    if (!member) throw new NotFoundException();
    if (member.role === "owner") {
      throw new BadRequestException("The owner role cannot be reassigned");
    }
    member.role = role;
    return this.members.save(member);
  }

  async kickMember(channelId: number, actor: ChatActor, accountId: number) {
    const me = await this.assertMember(channelId, actor, "moderator");
    if (Number(accountId) === actor.id) {
      throw new BadRequestException("Use leave instead");
    }
    const member = await this.members.findOneBy({
      channelId: String(channelId),
      accountId: String(accountId),
    });
    if (!member) throw new NotFoundException();
    if (
      member.role === "owner" ||
      (member.role === "moderator" && me.role !== "owner")
    ) {
      throw new ForbiddenException();
    }
    await this.members.remove(member);
    return member;
  }

  /** user.deleted webhook: drop every membership row of the account. */
  async purgeMemberships(accountId: number) {
    await this.members.delete({ accountId: String(accountId) });
  }

  /** Channel ids an account belongs to (WS auto-subscribe / presence). */
  async memberChannelIds(accountId: number): Promise<number[]> {
    const rows = await this.members.find({
      select: { channelId: true },
      where: { accountId: String(accountId) },
    });
    return rows.map((r) => Number(r.channelId));
  }

  // ------------------------------------------------------------------
  // messages
  // ------------------------------------------------------------------

  /** Cached username resolution (auth-client LRU, 30s TTL). */
  async usernameOf(accountId: number): Promise<string> {
    const info = await this.authClient.getAccountInfo(accountId);
    return info?.username ?? String(accountId);
  }

  private async toWire(m: MessageEntity): Promise<MessageWire> {
    return {
      id: Number(m.id),
      channelId: Number(m.channelId),
      author: {
        id: Number(m.accountId),
        username: await this.usernameOf(Number(m.accountId)),
      },
      body: m.body,
      attachments: m.attachments,
      clientId: m.clientId,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt ? m.editedAt.toISOString() : null,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    };
  }

  async sendMessage(
    actor: ChatActor,
    input: {
      channelId: number;
      clientId: string;
      body: string;
      attachments?: MessageAttachmentDto[];
    },
  ): Promise<MessageWire> {
    await this.assertMember(input.channelId, actor);
    if (input.body.length > this.chatConfig.messageMaxLen) {
      throw new BadRequestException(
        `body exceeds ${this.chatConfig.messageMaxLen} characters`,
      );
    }
    const attachments = input.attachments?.length ? input.attachments : null;
    if (attachments && attachments.length > this.chatConfig.maxAttachments) {
      throw new BadRequestException(
        `more than ${this.chatConfig.maxAttachments} attachments`,
      );
    }

    let message: MessageEntity;
    try {
      message = await this.messages.save({
        channelId: String(input.channelId),
        accountId: String(actor.id),
        body: input.body,
        attachments,
        clientId: input.clientId,
      });
    } catch {
      // Idempotent retry: same (channel, author, client_id) returns the
      // original row instead of a duplicate.
      message = await this.messages.findOneBy({
        channelId: String(input.channelId),
        accountId: String(actor.id),
        clientId: input.clientId,
      });
      if (!message) throw new ConflictException();
      return this.toWire(message);
    }

    // Sending implies having read up to your own message.
    await this.members
      .createQueryBuilder()
      .update(ChannelMemberEntity)
      .set({
        lastReadMessageId: () =>
          "GREATEST(chat_channel_members.last_read_message_id, :messageId::bigint)",
      })
      .setParameter("messageId", message.id)
      .where(
        "channel_id = :channelId AND account_id = :accountId AND last_read_message_id < :messageId",
      )
      .setParameters({
        channelId: String(input.channelId),
        accountId: String(actor.id),
      })
      .execute();

    return this.toWire(message);
  }

  async editMessage(
    actor: ChatActor,
    input: { channelId: number; messageId: number; body: string },
  ): Promise<MessageWire> {
    await this.assertMember(input.channelId, actor);
    const message = await this.messages.findOneBy({
      id: String(input.messageId),
      channelId: String(input.channelId),
    });
    if (!message || message.deletedAt) throw new NotFoundException();
    if (Number(message.accountId) !== actor.id) {
      throw new ForbiddenException("Only the author can edit");
    }
    if (input.body.length > this.chatConfig.messageMaxLen) {
      throw new BadRequestException(
        `body exceeds ${this.chatConfig.messageMaxLen} characters`,
      );
    }
    message.body = input.body;
    message.editedAt = new Date();
    await this.messages.save(message);
    return this.toWire(message);
  }

  async deleteMessage(
    actor: ChatActor,
    input: { channelId: number; messageId: number },
  ): Promise<MessageWire> {
    const me = await this.assertMember(input.channelId, actor);
    const message = await this.messages.findOneBy({
      id: String(input.messageId),
      channelId: String(input.channelId),
    });
    if (!message || message.deletedAt) throw new NotFoundException();
    const isAuthor = Number(message.accountId) === actor.id;
    if (!isAuthor && ROLE_RANK[me.role] < ROLE_RANK.moderator) {
      throw new ForbiddenException();
    }
    message.deletedAt = new Date();
    await this.messages.save(message);
    return this.toWire(message);
  }

  /**
   * Cursor history. `after` = resume/backfill (ascending), `before` =
   * paging backwards from a message (window returned ascending). Neither →
   * the latest window. Tombstones are included only when asked (sync), so
   * plain history stays clean.
   */
  async listMessages(
    channelId: number,
    actor: ChatActor,
    opts: {
      before?: number;
      after?: number;
      limit?: number;
      includeDeleted?: boolean;
    },
  ): Promise<{ items: MessageWire[]; hasMore: boolean }> {
    await this.assertMember(channelId, actor);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

    const qb = this.messages
      .createQueryBuilder("m")
      .where("m.channel_id = :channelId", { channelId: String(channelId) })
      .orderBy("m.id", "ASC")
      .take(limit + 1);
    if (!opts.includeDeleted) qb.andWhere("m.deleted_at IS NULL");
    if (opts.after !== undefined) {
      qb.andWhere("m.id > :after", { after: String(opts.after) });
    } else if (opts.before !== undefined) {
      qb.andWhere("m.id < :before", { before: String(opts.before) }).orderBy(
        "m.id",
        "DESC",
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const page = (hasMore ? rows.slice(0, limit) : rows).sort(
      (a, b) => Number(a.id) - Number(b.id),
    );
    const items = await Promise.all(page.map((m) => this.toWire(m)));
    return { items, hasMore };
  }

  async searchMessages(
    channelId: number,
    actor: ChatActor,
    q: string,
    limit = 20,
  ): Promise<MessageWire[]> {
    await this.assertMember(channelId, actor);
    const escaped = q.replace(/([%_\\])/g, "\\$1");
    const rows = await this.messages
      .createQueryBuilder("m")
      .where("m.channel_id = :channelId", { channelId: String(channelId) })
      .andWhere("m.deleted_at IS NULL")
      .andWhere("m.body ILIKE :pattern ESCAPE '\\\\'", {
        pattern: `%${escaped}%`,
      })
      .orderBy("m.id", "DESC")
      .take(Math.min(Math.max(limit, 1), 50))
      .getMany();
    return Promise.all(rows.map((m) => this.toWire(m)));
  }

  async markRead(channelId: number, actor: ChatActor, lastMessageId: number) {
    const member = await this.assertMember(channelId, actor);
    if (Number(lastMessageId) <= Number(member.lastReadMessageId)) {
      return member;
    }
    member.lastReadMessageId = String(lastMessageId);
    return this.members.save(member);
  }

  /** Per-channel unread counts: others' live messages past my cursor. */
  async unreadSummary(actor: ChatActor) {
    const rows = await this.members
      .createQueryBuilder("m")
      .innerJoin(
        MessageEntity,
        "msg",
        "msg.channel_id = m.channel_id AND msg.id > m.last_read_message_id AND msg.deleted_at IS NULL AND msg.account_id != m.account_id",
      )
      .where("m.account_id = :accountId", { accountId: String(actor.id) })
      .select("m.channel_id", "channelId")
      .addSelect("COUNT(msg.id)", "unread")
      .addSelect("MAX(msg.id)", "lastMessageId")
      .groupBy("m.channel_id")
      .getRawMany();
    return rows.map((r) => ({
      channelId: Number(r.channelId),
      unread: Number(r.unread),
      lastMessageId: Number(r.lastMessageId),
    }));
  }

  /**
   * Reconnect/resume: for every {channelId → lastSeenId} pair, everything
   * the client missed (tombstones included so deletions propagate).
   * Capped per channel — more history goes through REST backfill.
   */
  async sync(
    actor: ChatActor,
    cursors: Record<string, number>,
  ): Promise<{ messages: MessageWire[]; truncated: boolean }> {
    const all: MessageWire[] = [];
    let truncated = false;
    for (const [rawChannelId, lastSeen] of Object.entries(cursors)) {
      const channelId = Number(rawChannelId);
      if (!channelId || !Number.isFinite(channelId)) continue;
      const { items, hasMore } = await this.listMessages(channelId, actor, {
        after: Number(lastSeen) || 0,
        limit: 100,
        includeDeleted: true,
      });
      if (hasMore) truncated = true;
      all.push(...items);
    }
    all.sort((a, b) => a.id - b.id);
    return { messages: all, truncated };
  }
}
