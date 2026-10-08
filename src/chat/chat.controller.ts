import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Account, AccountInfo, Self } from "api-server-toolkit";
import { ChatService, ChatActor } from "./chat.service";
import { EmitterService } from "./emitter.service";
import { PresenceService } from "./presence.service";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateChannelDto {
  @ApiProperty({ enum: ["channel", "dm"] })
  @IsIn(["channel", "dm"])
  type: "channel" | "dm";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /** DM: exactly one other account. Channel: initial members. */
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  members?: number[];
}

export class UpdateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AddMemberDto {
  @ApiProperty()
  @IsNumber()
  accountId: number;
}

export class SetRoleDto {
  @ApiProperty({ enum: ["moderator", "member"] })
  @IsIn(["moderator", "member"])
  role: "moderator" | "member";
}

export class ReadDtoHttp {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  lastMessageId: number;
}

@ApiTags("chat")
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly emitter: EmitterService,
    private readonly presence: PresenceService,
  ) {}

  private actor(account: AccountInfo): ChatActor {
    return {
      id: Number(account.id),
      username: account.username ?? String(account.id),
      isSuperuser: account.isSuperuser === true,
    };
  }

  @Account()
  @Post("channels")
  @ApiOperation({ summary: "Создать канал или открыть личку (идемпотентно)" })
  async create(@Self() account: AccountInfo, @Body() body: CreateChannelDto) {
    const actor = this.actor(account);
    const { channel, created } = await this.chat.createChannel(actor, body);
    return { channel, created };
  }

  @Account()
  @Get("channels")
  @ApiOperation({ summary: "Мои каналы и лички" })
  async myChannels(@Self() account: AccountInfo) {
    return this.chat.listMyChannels(this.actor(account));
  }

  @Account()
  @Get("unread")
  @ApiOperation({ summary: "Сводка непрочитанных по каналам" })
  async unread(@Self() account: AccountInfo) {
    return this.chat.unreadSummary(this.actor(account));
  }

  @Account()
  @Get("presence")
  @ApiQuery({ name: "ids", example: "1,2,3" })
  @ApiOperation({ summary: "Presence по списку аккаунтов" })
  async presenceStatus(@Query("ids") ids: string) {
    const list = (ids || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 100);
    const out = [];
    for (const id of list) {
      out.push({ accountId: id, status: await this.presence.status(id) });
    }
    return out;
  }

  @Account()
  @Get("channels/:id")
  @ApiOperation({ summary: "Канал + моя роль" })
  async channel(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.chat.getChannel(id, this.actor(account));
  }

  @Account()
  @Patch("channels/:id")
  @ApiOperation({ summary: "Переименовать / переключить публичность (owner)" })
  async update(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateChannelDto,
  ) {
    return this.chat.updateChannel(id, this.actor(account), body);
  }

  @Account()
  @Delete("channels/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-delete канала (owner)" })
  async remove(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const channel = await this.chat.deleteChannel(id, this.actor(account));
    this.emitter.toChannel(id, "channel.updated", {
      channelId: id,
      deletedAt: channel.deletedAt!.toISOString(),
    });
    return { deleted: true };
  }

  @Account()
  @Post("channels/:id/join")
  @ApiOperation({ summary: "Вступить в публичный канал" })
  async join(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const actor = this.actor(account);
    const { member, created } = await this.chat.joinChannel(id, actor);
    if (created) {
      this.emitter.toChannel(id, "member.joined", {
        channelId: id,
        account: { id: actor.id, username: actor.username },
        role: member.role,
      });
    }
    return { member, created };
  }

  @Account()
  @Post("channels/:id/leave")
  @ApiOperation({ summary: "Покинуть канал" })
  async leave(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const actor = this.actor(account);
    const member = await this.chat.leaveChannel(id, actor);
    this.emitter.toChannel(id, "member.left", {
      channelId: id,
      account: { id: actor.id, username: actor.username },
      role: member.role,
    });
    return { left: true };
  }

  @Account()
  @Get("channels/:id/members")
  @ApiOperation({ summary: "Участники (owner → member)" })
  async members(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.chat.listMembers(id, this.actor(account));
  }

  @Account()
  @Post("channels/:id/members")
  @ApiOperation({ summary: "Добавить участника (moderator+)" })
  async addMember(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: AddMemberDto,
  ) {
    const { member, created } = await this.chat.addMember(
      id,
      this.actor(account),
      body.accountId,
    );
    if (created) {
      this.emitter.toChannel(id, "member.joined", {
        channelId: id,
        account: {
          id: Number(member.accountId),
          username: await this.chat.usernameOf(Number(member.accountId)),
        },
        role: member.role,
      });
    }
    return { member, created };
  }

  @Account()
  @Patch("channels/:id/members/:accountId")
  @ApiOperation({ summary: "Сменить роль участника (owner)" })
  async setRole(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Param("accountId", ParseIntPipe) accountId: number,
    @Body() body: SetRoleDto,
  ) {
    return this.chat.setMemberRole(
      id,
      this.actor(account),
      accountId,
      body.role,
    );
  }

  @Account()
  @Delete("channels/:id/members/:accountId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Кик участника (moderator+)" })
  async kick(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Param("accountId", ParseIntPipe) accountId: number,
  ) {
    const member = await this.chat.kickMember(
      id,
      this.actor(account),
      accountId,
    );
    this.emitter.toChannel(id, "member.left", {
      channelId: id,
      account: {
        id: Number(member.accountId),
        username: await this.chat.usernameOf(Number(member.accountId)),
      },
      role: member.role,
    });
    this.emitter.toUser(member.accountId, "channel.updated", {
      channelId: id,
    });
    return { kicked: true };
  }

  @Account()
  @Get("channels/:id/messages")
  @ApiQuery({ name: "before", required: false })
  @ApiQuery({ name: "after", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiOperation({ summary: "История курсором (backfill/постранично)" })
  async messages(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Query() query: { before?: string; after?: string; limit?: string },
  ) {
    const num = (raw?: string) => {
      if (raw === undefined || raw === "") return undefined;
      const n = Number(raw);
      return Number.isInteger(n) ? n : undefined;
    };
    return this.chat.listMessages(id, this.actor(account), {
      before: num(query.before),
      after: num(query.after),
      limit: num(query.limit) ?? 50,
    });
  }

  @Account()
  @Get("channels/:id/search")
  @ApiQuery({ name: "q" })
  @ApiOperation({ summary: "Поиск по сообщениям канала (ILIKE)" })
  async search(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Query("q") q: string,
  ) {
    return this.chat.searchMessages(id, this.actor(account), q || "");
  }

  @Account()
  @Post("channels/:id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Отметить канал прочитанным" })
  async read(
    @Self() account: AccountInfo,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ReadDtoHttp,
  ) {
    await this.chat.markRead(id, this.actor(account), body.lastMessageId);
    return { ok: true };
  }
}
