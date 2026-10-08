import { Test } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import { AuthClientService } from "api-server-toolkit/auth-client";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Repository, DataSource } from "typeorm";
import { ChannelEntity, ChannelMemberEntity } from "./channel.entity";
import { MessageEntity } from "./message.entity";
import { ChatService, ChatActor } from "./chat.service";
import { ChatConfig } from "./chat.config";

/**
 * Domain suite over a real postgres scratch schema (synchronize+dropSchema,
 * file-server pattern). Covers the access matrix, idempotency, cursor
 * pagination invariants, unread accounting, sync/resume and search.
 */

const SUPER_ID = 999;

const actor = (id: number, isSuperuser = false): ChatActor => ({
  id,
  username: `user${id}@t`,
  isSuperuser,
});

const alice = actor(11);
const bob = actor(12);
const carol = actor(13);
const superuser = actor(SUPER_ID, true);

describe("ChatService (db)", () => {
  let service: ChatService;
  let members: Repository<ChannelMemberEntity>;
  let messages: Repository<MessageEntity>;
  let dataSource: DataSource;

  const getModule = () =>
    Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.DB_HOST || "localhost",
          port: Number(process.env.DB_PORT || 5432),
          username: process.env.DB_USER || "root",
          password: process.env.DB_PASSWORD || "1234",
          database: process.env.DB_NAME || "chat_server_test",
          entities: [ChannelEntity, ChannelMemberEntity, MessageEntity],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([
          ChannelEntity,
          ChannelMemberEntity,
          MessageEntity,
        ]),
      ],
      providers: [
        ChatService,
        {
          provide: ChatConfig,
          useValue: new ChatConfig({ get: () => undefined } as never),
        },
        {
          provide: AuthClientService,
          useValue: {
            getAccountInfo: async (id: number) => ({
              id,
              username: `user${id}@t`,
              isActivated: true,
              roles: [],
              isSuperuser: id === SUPER_ID,
            }),
            clearCache: jest.fn(),
          },
        },
      ],
    }).compile();

  beforeAll(async () => {
    const moduleRef = await getModule();
    service = moduleRef.get(ChatService);
    members = moduleRef.get(getRepositoryToken(ChannelMemberEntity));
    messages = moduleRef.get(getRepositoryToken(MessageEntity));
    dataSource = moduleRef.get(DataSource);
  }, 60_000);

  // -- helpers ------------------------------------------------------------

  const publicChannel = async () => {
    const { channel } = await service.createChannel(alice, {
      type: "channel",
      title: "room",
      isPublic: true,
    });
    return channel;
  };

  /** channel where alice is owner, bob is member, carol not present. */
  const staffedChannel = async () => {
    const { channel } = await service.createChannel(alice, {
      type: "channel",
      title: "staffed",
      isPublic: false,
      members: [bob.id],
    });
    return channel;
  };

  const dm = async () => {
    const { channel } = await service.createChannel(alice, {
      type: "dm",
      members: [bob.id],
    });
    return channel;
  };

  // -- channels & membership ---------------------------------------------

  it("channel create: creator is owner, initial members are members", async () => {
    const channel = await staffedChannel();
    const mine = await service.getChannel(Number(channel.id), alice);
    expect(mine.myRole).toBe("owner");
    const bobs = await service.getChannel(Number(channel.id), bob);
    expect(bobs.myRole).toBe("member");
  });

  it("dm: dm_key is the ordered pair, reopening is idempotent", async () => {
    const first = await dm();
    expect(first.dmKey).toBe(`${Math.min(11, 12)}:${Math.max(11, 12)}`);
    const second = await service.createChannel(alice, {
      type: "dm",
      members: [bob.id],
    });
    expect(second.created).toBe(false);
    expect(String(second.channel.id)).toBe(String(first.id));
    // the reversed request (bob opens with alice) lands on the same channel
    const reversed = await service.createChannel(bob, {
      type: "dm",
      members: [alice.id],
    });
    expect(String(reversed.channel.id)).toBe(String(first.id));
  });

  it("dm requires exactly one other member", async () => {
    await expect(
      service.createChannel(alice, { type: "dm", members: [] }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createChannel(alice, { type: "dm", members: [bob.id, carol.id] }),
    ).rejects.toThrow(BadRequestException);
  });

  it("access matrix: outsider gets 404, member gets in, superuser bypasses with moderator grade", async () => {
    const channel = await staffedChannel();
    await expect(service.getChannel(Number(channel.id), carol)).rejects.toThrow(
      NotFoundException,
    );
    const su = await service.getChannel(Number(channel.id), superuser);
    expect(su.myRole).toBe("moderator");
  });

  it("deleted channel reads as 404 even for the superuser", async () => {
    const channel = await staffedChannel();
    await service.deleteChannel(Number(channel.id), alice);
    await expect(
      service.getChannel(Number(channel.id), superuser),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.listMessages(Number(channel.id), superuser, {}),
    ).rejects.toThrow(NotFoundException);
  });

  it("join: public opens, private forbids, dm forbids, re-join is a no-op", async () => {
    const channel = await publicChannel();
    const { created } = await service.joinChannel(Number(channel.id), carol);
    expect(created).toBe(true);

    const privateChannel = await staffedChannel();
    await expect(
      service.joinChannel(Number(privateChannel.id), carol),
    ).rejects.toThrow(ForbiddenException);

    const pair = await dm();
    await expect(service.joinChannel(Number(pair.id), carol)).rejects.toThrow(
      ForbiddenException,
    );

    const again = await service.joinChannel(Number(channel.id), carol);
    expect(again.created).toBe(false);
  });

  it("leave: member can leave, owner cannot, dm member cannot", async () => {
    const channel = await staffedChannel();
    await service.leaveChannel(Number(channel.id), bob);
    await expect(
      service.leaveChannel(Number(channel.id), alice),
    ).rejects.toThrow(BadRequestException);
    const pair = await dm();
    await expect(service.leaveChannel(Number(pair.id), bob)).rejects.toThrow();
  });

  it("roles: only owner reassigns, owner role and self are protected", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    await expect(service.addMember(id, bob, carol.id)).rejects.toThrow(
      ForbiddenException,
    ); // member can't add
    await service.addMember(id, alice, carol.id); // owner adds carol
    await service.addMember(id, alice, 14); // and dave

    await expect(
      service.setMemberRole(id, bob, carol.id, "moderator"),
    ).rejects.toThrow(ForbiddenException); // member can't set roles
    await expect(
      service.setMemberRole(id, alice, carol.id, "owner" as never),
    ).rejects.toThrow(); // owner role is not assignable
    await expect(
      service.setMemberRole(id, alice, alice.id, "moderator"),
    ).rejects.toThrow(); // no self-service
    await service.setMemberRole(id, alice, carol.id, "moderator");
    const list = await service.listMembers(id, alice);
    expect(list.find((m) => Number(m.accountId) === carol.id)?.role).toBe(
      "moderator",
    );
  });

  it("kick: moderator kicks members but not owners or fellow moderators", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    await service.addMember(id, alice, carol.id);
    await service.addMember(id, alice, 14);
    await service.setMemberRole(id, alice, carol.id, "moderator");

    await expect(service.kickMember(id, bob, 14)).rejects.toThrow(
      ForbiddenException,
    ); // plain member can't kick
    await service.kickMember(id, carol, 14); // moderator kicks member
    await expect(service.kickMember(id, carol, alice.id)).rejects.toThrow(); // can't kick the owner
    // rank guard: a plain member can't kick a moderator
    const ranked = await staffedChannel();
    const rankedId = Number(ranked.id);
    await service.addMember(rankedId, alice, carol.id);
    await service.setMemberRole(rankedId, alice, carol.id, "moderator");
    await expect(service.kickMember(rankedId, bob, carol.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("purgeMemberships wipes every row (user.deleted), memberChannelIds reflect it", async () => {
    const channel = await staffedChannel();
    const pair = await dm();
    const before = await service.memberChannelIds(bob.id);
    expect(before.length).toBeGreaterThanOrEqual(2);
    await service.purgeMemberships(bob.id);
    const after = await service.memberChannelIds(bob.id);
    expect(after).toHaveLength(0);
    const rows = await members.find();
    expect(rows.some((m) => Number(m.accountId) === bob.id)).toBe(false);
    expect(String(channel.id) + String(pair.id)).toBeDefined();
  });

  // -- messages -----------------------------------------------------------

  it("send: persists, acks numeric wire id, bumps the sender read cursor", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const wire = await service.sendMessage(alice, {
      channelId: id,
      clientId: "c1",
      body: "hello",
    });
    expect(typeof wire.id).toBe("number");
    expect(wire.author.username).toBe(`user${alice.id}@t`);
    const me = await members.findOneBy({
      channelId: String(id),
      accountId: String(alice.id),
    });
    expect(Number(me?.lastReadMessageId)).toBe(wire.id);
  });

  it("send is idempotent on (channel, author, clientId)", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const first = await service.sendMessage(alice, {
      channelId: id,
      clientId: "same",
      body: "once",
    });
    const replay = await service.sendMessage(alice, {
      channelId: id,
      clientId: "same",
      body: "once",
    });
    expect(replay.id).toBe(first.id);
    const rows = await messages.findBy({ clientId: "same" });
    expect(rows).toHaveLength(1);
  });

  it("send rejects oversized body/attachments and outsiders", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    await expect(
      service.sendMessage(alice, {
        channelId: id,
        clientId: "big",
        body: "x".repeat(4097),
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.sendMessage(alice, {
        channelId: id,
        clientId: "atts",
        body: "x",
        attachments: Array.from({ length: 11 }, (_, i) => ({
          key: `k${i}`,
          url: `u${i}`,
        })),
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.sendMessage(carol, { channelId: id, clientId: "out", body: "x" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("edit: author only, tombstones resist editing", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const wire = await service.sendMessage(alice, {
      channelId: id,
      clientId: "e1",
      body: "original",
    });
    const edited = await service.editMessage(alice, {
      channelId: id,
      messageId: wire.id,
      body: "edited",
    });
    expect(edited.body).toBe("edited");
    expect(edited.editedAt).toBeTruthy();
    await expect(
      service.editMessage(bob, {
        channelId: id,
        messageId: wire.id,
        body: "hijack",
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.editMessage(superuser, {
        channelId: id,
        messageId: wire.id,
        body: "su",
      }),
    ).rejects.toThrow(ForbiddenException);
    await service.deleteMessage(alice, { channelId: id, messageId: wire.id });
    await expect(
      service.editMessage(alice, {
        channelId: id,
        messageId: wire.id,
        body: "zombie",
      }),
    ).rejects.toThrow();
  });

  it("delete: author or moderator-grade; plain members can't remove others' messages", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const a = await service.sendMessage(alice, {
      channelId: id,
      clientId: "d1",
      body: "a",
    });
    const b = await service.sendMessage(bob, {
      channelId: id,
      clientId: "d2",
      body: "b",
    });
    await expect(
      service.deleteMessage(bob, { channelId: id, messageId: a.id }),
    ).rejects.toThrow(ForbiddenException);
    const mod = await service.deleteMessage(superuser, {
      channelId: id,
      messageId: a.id,
    });
    expect(mod.deletedAt).toBeTruthy();
    const own = await service.deleteMessage(bob, {
      channelId: id,
      messageId: b.id,
    });
    expect(own.deletedAt).toBeTruthy();
  });

  it("history cursors partition without duplicates or gaps", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const ids: number[] = [];
    for (let i = 0; i < 25; i++) {
      const wire = await service.sendMessage(bob, {
        channelId: id,
        clientId: `seq-${i}`,
        body: `m${i}`,
      });
      ids.push(wire.id);
    }

    // forward walk (after=)
    const seen: number[] = [];
    let after: number | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await service.listMessages(id, bob, { after, limit: 10 });
      seen.push(...page.items.map((m) => m.id));
      if (!page.hasMore) break;
      after = page.items[page.items.length - 1].id;
    }
    expect(seen).toEqual(ids);

    // backward walk (before=) — exclusive upper cursor starts past the top
    const back: number[] = [];
    let before = ids[ids.length - 1] + 1;
    for (let guard = 0; guard < 10; guard++) {
      const page = await service.listMessages(id, bob, { before, limit: 10 });
      if (!page.items.length) break;
      back.unshift(...page.items.map((m) => m.id));
      before = page.items[0].id;
    }
    expect(back).toEqual(ids);
  });

  it("history hides tombstones on REST reads, sync includes them", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const keep = await service.sendMessage(alice, {
      channelId: id,
      clientId: "k",
      body: "keep",
    });
    const gone = await service.sendMessage(alice, {
      channelId: id,
      clientId: "g",
      body: "gone",
    });
    await service.deleteMessage(alice, { channelId: id, messageId: gone.id });

    const rest = await service.listMessages(id, bob, { limit: 10 });
    expect(rest.items.some((m) => m.id === gone.id)).toBe(false);
    expect(rest.items.some((m) => m.id === keep.id)).toBe(true);

    const sync = await service.sync(bob, { [id]: 0 });
    expect(sync.messages.some((m) => m.id === gone.id && m.deletedAt)).toBe(
      true,
    );
    expect(sync.truncated).toBe(false);
  });

  it("sync truncates past the per-channel cap", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const rows = Array.from({ length: 105 }, (_, i) => ({
      channelId: String(id),
      accountId: String(bob.id),
      body: `bulk-${i}`,
      clientId: `bulk-${i}`,
    }));
    await messages.insert(rows);
    const sync = await service.sync(bob, { [id]: 0 });
    expect(sync.messages).toHaveLength(100);
    expect(sync.truncated).toBe(true);
    // incremental resume from a cursor returns only the delta
    const mid = sync.messages[49].id;
    const delta = await service.sync(bob, { [id]: mid });
    expect(delta.messages.every((m) => m.id > mid)).toBe(true);
  });

  it("unread counts foreign live messages; read cursor and own sends clear it", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const w1 = await service.sendMessage(alice, {
      channelId: id,
      clientId: "u1",
      body: "1",
    });
    await service.sendMessage(alice, {
      channelId: id,
      clientId: "u2",
      body: "2",
    });
    await service.sendMessage(alice, {
      channelId: id,
      clientId: "u3",
      body: "3",
    });

    let summary = await service.unreadSummary(bob);
    let row = summary.find((r) => Number(r.channelId) === id);
    expect(Number(row?.unread)).toBe(3);

    await service.markRead(id, bob, w1.id);
    summary = await service.unreadSummary(bob);
    row = summary.find((r) => Number(r.channelId) === id);
    expect(Number(row?.unread)).toBe(2);

    // read cursor is monotonic — going backwards changes nothing
    await service.markRead(id, bob, 1);
    summary = await service.unreadSummary(bob);
    row = summary.find((r) => Number(r.channelId) === id);
    expect(Number(row?.unread)).toBe(2);

    // the sender never counts their own messages
    summary = await service.unreadSummary(alice);
    expect(summary.find((r) => Number(r.channelId) === id)).toBeUndefined();
  });

  it("search: case-insensitive, channel-scoped, LIKE wildcards escaped", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    await service.sendMessage(alice, {
      channelId: id,
      clientId: "s1",
      body: "GrEEn dicE",
    });
    await service.sendMessage(alice, {
      channelId: id,
      clientId: "s2",
      body: "100%_sure",
    });
    const other = await staffedChannel();
    await service.sendMessage(alice, {
      channelId: Number(other.id),
      clientId: "s3",
      body: "green elsewhere",
    });

    expect(
      (await service.searchMessages(id, bob, "green")).map((m) => m.body),
    ).toEqual(["GrEEn dicE"]);
    expect(
      (await service.searchMessages(id, bob, "0%_s")).map((m) => m.body),
    ).toEqual(["100%_sure"]);
    // outsiders can't search
    await expect(service.searchMessages(id, carol, "green")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("updateChannel: owner only, dm resists retitling", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    await expect(
      service.updateChannel(id, bob, { title: "nope" }),
    ).rejects.toThrow(ForbiddenException);
    const updated = await service.updateChannel(id, alice, {
      title: "renamed",
    });
    expect(updated.title).toBe("renamed");
    const pair = await dm();
    await expect(
      service.updateChannel(Number(pair.id), alice, { title: "dm?" }),
    ).rejects.toThrow();
  });

  it("attachments travel through the wire intact", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    const wire = await service.sendMessage(alice, {
      channelId: id,
      clientId: "att1",
      body: "see attached",
      attachments: [
        {
          key: "a/b.png",
          url: "http://x/a.png",
          mime: "image/png",
          size: 5,
          name: "a.png",
        },
      ],
    });
    expect(wire.attachments?.[0]?.key).toBe("a/b.png");
  });

  it("rawMany bigint ids survive Number() conversion in unread summary", async () => {
    const channel = await staffedChannel();
    const id = Number(channel.id);
    await service.sendMessage(alice, {
      channelId: id,
      clientId: "bn",
      body: "x",
    });
    const summary = await service.unreadSummary(bob);
    const row = summary.find((r) => Number(r.channelId) === id);
    expect(row).toBeDefined();
    expect(Number.isInteger(row?.channelId)).toBe(true);
    expect(Number.isInteger(row?.lastMessageId)).toBe(true);
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });
});
