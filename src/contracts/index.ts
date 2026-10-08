import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Typed surface of chat-server, importable by clients and other services:
 *
 *   import { ChatContracts } from "chat-server/contracts";
 *
 * The same build pipeline as event-server/contracts (tsconfig.contracts.json
 * → committed dist/contracts). WS event names are frozen here; payloads are
 * class-validator DTOs, so both sides validate against one definition.
 */

export class MessageAttachmentDto {
  @ApiProperty({ description: "Ключ объекта в file-server" })
  @IsString()
  @Length(1, 1024)
  key: string;

  @ApiProperty({ description: "Готовый URL для скачивания" })
  @IsString()
  @Length(1, 2048)
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  mime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;
}

export class AuthorDto {
  @ApiProperty()
  @IsNumber()
  id: number;

  @ApiProperty()
  @IsString()
  username: string;
}

// ---------------------------------------------------------------------------
// client → server
// ---------------------------------------------------------------------------

export class MessageSendDto {
  @ApiProperty({ description: "ID канала или лички" })
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  /** Client-generated id — retries with the same value are idempotent. */
  @ApiProperty({ description: "Клиентский id для идемпотентности" })
  @IsString()
  @Length(1, 64)
  clientId: string;

  @ApiProperty()
  @IsString()
  @Length(1, 4096)
  body: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto], maxItems: 10 })
  @IsOptional()
  @IsArray()
  attachments?: MessageAttachmentDto[];
}

export class MessageEditDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  messageId: number;

  @ApiProperty()
  @IsString()
  @Length(1, 4096)
  body: string;
}

export class MessageDeleteDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  messageId: number;
}

export class ChannelJoinDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;
}

export class ChannelLeaveDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;
}

export class TypingDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;
}

export class ReadDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty({ description: "Последнее увиденное сообщение" })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lastMessageId: number;
}

/** Reconnect/resume: channelId → last delivered message id. */
export class SyncDto {
  @ApiProperty({
    type: Object,
    example: { "42": 1001 },
    description: "channelId → последний полученный message id",
  })
  @IsObject()
  channels: Record<string, number>;
}

// ---------------------------------------------------------------------------
// server → client
// ---------------------------------------------------------------------------

export class MessageNewDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  attachments?: MessageAttachmentDto[];

  @ApiProperty({ description: "Клиентский id отправителя (корреляция)" })
  @IsString()
  clientId: string;

  @ApiProperty({ description: "ISO 8601" })
  @IsString()
  createdAt: string;
}

export class MessageUpdatedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiProperty({ description: "ISO 8601" })
  @IsString()
  editedAt: string;
}

export class MessageDeletedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;
}

export class TypingEventDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;
}

export class PresenceEventDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  accountId: number;

  @ApiProperty({ enum: ["online", "offline"] })
  @IsEnum(["online", "offline"])
  status: "online" | "offline";
}

export class MemberEventDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiProperty({ type: AuthorDto })
  account: AuthorDto;

  @ApiProperty({ enum: ["owner", "moderator", "member"] })
  @IsEnum(["owner", "moderator", "member"])
  role: "owner" | "moderator" | "member";
}

export class ChannelUpdatedDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  channelId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: "Задан при soft-delete канала" })
  @IsOptional()
  @IsString()
  deletedAt?: string;
}

/** Reply payload of the `sync` ack (also used as a cap notice). */
export class SyncAckDto {
  @ApiProperty({ type: [MessageNewDto] })
  messages: MessageNewDto[];

  /** true → есть ещё пропуски, добирайте через REST history (after=...). */
  @ApiProperty()
  truncated: boolean;
}

export class WsErrorDto {
  @ApiProperty({
    enum: [
      "unauthorized",
      "forbidden",
      "not_found",
      "validation",
      "rate_limited",
      "conflict",
      "internal",
    ],
  })
  @IsEnum([
    "unauthorized",
    "forbidden",
    "not_found",
    "validation",
    "rate_limited",
    "conflict",
    "internal",
  ])
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  message?: string;
}

export class AuthExpiredDto {
  @ApiProperty({ description: "Access-токен истёк — переподключитесь" })
  @IsString()
  reason: string;
}

/**
 * Ack semantics: every client→server event answers EXACTLY once through the
 * socket.io ack callback — the success payload, or `{ error }` on failure.
 * The `error` SERVER EVENT is connection-level only (pre-kick rate-limit
 * notice, then a hard disconnect).
 */
/** Simple boolean acks. */
export interface OkAck {
  ok: boolean;
}
export interface JoinedAck {
  joined: boolean;
}
export interface LeftAck {
  left: boolean;
}

/**
 * Ack semantics: every client→server event answers EXACTLY once through the
 * socket.io ack callback — the success payload, or `{ error }` on failure.
 * The `error` SERVER EVENT is connection-level only (pre-kick rate-limit
 * notice, then a hard disconnect). message.send/edit ack with the full wire
 * message, so idempotent replays (same clientId) return the SAME id.
 */
export interface WsErrorAck {
  error: WsErrorDto;
}

export type ChatAcks = {
  "channel.join": JoinedAck | WsErrorAck;
  "channel.leave": LeftAck | WsErrorAck;
  "message.send": MessageNewDto | WsErrorAck;
  "message.edit": MessageUpdatedDto | WsErrorAck;
  "message.delete": MessageDeletedDto | WsErrorAck;
  typing: OkAck | WsErrorAck;
  read: OkAck | WsErrorAck;
  sync: SyncAckDto | WsErrorAck;
};

/**
 * Machine-readable registry of the WS protocol. Event names are the wire
 * format; the DTOs are the payload schemas (also enforced server-side).
 */
export const ChatContracts = {
  client: {
    "channel.join": ChannelJoinDto,
    "channel.leave": ChannelLeaveDto,
    "message.send": MessageSendDto,
    "message.edit": MessageEditDto,
    "message.delete": MessageDeleteDto,
    typing: TypingDto,
    read: ReadDto,
    sync: SyncDto,
  },
  server: {
    "message.new": MessageNewDto,
    "message.updated": MessageUpdatedDto,
    "message.deleted": MessageDeletedDto,
    typing: TypingEventDto,
    "presence.updated": PresenceEventDto,
    "member.joined": MemberEventDto,
    "member.left": MemberEventDto,
    "channel.updated": ChannelUpdatedDto,
    "auth.expired": AuthExpiredDto,
    error: WsErrorDto,
  },
} as const;

export type ChatClientEvent = keyof typeof ChatContracts.client;
export type ChatServerEvent = keyof typeof ChatContracts.server;
