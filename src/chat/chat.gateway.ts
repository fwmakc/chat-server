import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { HttpException, Logger } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { WsAuthService, ChatAccount } from "./ws-auth.service";
import { ChatService, ChatActor, MessageWire } from "./chat.service";
import { RateLimitService } from "./rate-limit.service";
import { PresenceService } from "./presence.service";
import { EmitterService } from "./emitter.service";
import { ChatConfig } from "./chat.config";
import { ChatMetrics } from "./chat.metrics";
import {
  ChannelJoinDto,
  ChannelLeaveDto,
  MessageDeleteDto,
  MessageEditDto,
  MessageSendDto,
  ReadDto,
  SyncAckDto,
  SyncDto,
  TypingDto,
  WsErrorAck,
  WsErrorDto,
  JoinedAck,
  LeftAck,
  OkAck,
} from "@src/contracts";

const STRIKES_LIMIT = 3;

const toWsError = (e: unknown): WsErrorDto => {
  if (e instanceof HttpException) {
    const status = e.getStatus();
    const code =
      status === 401
        ? "unauthorized"
        : status === 403
          ? "forbidden"
          : status === 404
            ? "not_found"
            : status === 409
              ? "conflict"
              : "validation";
    return { code, message: e.message };
  }
  return { code: "internal", message: "internal error" };
};

/**
 * Handshake middleware contract: `auth.token` (recommended) or the
 * `Authorization: Bearer` header. A socket without a valid access token
 * never connects (fail-closed); a token that expires mid-session triggers
 * `auth.expired` + disconnect, and the client re-handshakes with a fresh
 * token (frontend commitment №2).
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: "/",
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);
  private expirySweep: NodeJS.Timeout | null = null;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly wsAuth: WsAuthService,
    private readonly rateLimit: RateLimitService,
    private readonly presence: PresenceService,
    private readonly emitter: EmitterService,
    private readonly chatConfig: ChatConfig,
    private readonly metrics: ChatMetrics,
  ) {}

  afterInit(server: Server) {
    this.emitter.register(server);

    server.use((socket, next) => {
      const header = socket.handshake.headers.authorization;
      const token =
        (socket.handshake.auth?.token as string) ||
        (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
      if (!token) return next(new Error("unauthorized"));
      this.wsAuth
        .authenticate(token)
        .then((account) => {
          socket.data.account = account;
          next();
        })
        .catch((e) => {
          this.logger.warn(
            `handshake rejected for socket ${socket.id}: ${(e as Error).message}`,
          );
          next(new Error("unauthorized"));
        });
    });

    // Access tokens are short-lived; a live socket dies with its token.
    this.expirySweep = setInterval(() => {
      // Nest hands the "/" Namespace to afterInit (not the Server): its
      // `.sockets` IS the socket map; a real Server would wrap another hop.
      const sockets =
        server.sockets instanceof Map ? server.sockets : server.sockets.sockets;
      for (const [, s] of sockets) {
        const account = s.data.account as ChatAccount | undefined;
        if (account && account.tokenExp && account.tokenExp <= Date.now()) {
          s.emit("auth.expired", {
            reason: "access token expired — reconnect with a fresh token",
          });
          s.disconnect(true);
        }
      }
    }, 30_000);
  }

  private actorOf(client: Socket): ChatActor {
    return client.data.account as ChatAccount;
  }

  /** Rejects the event when the rate bucket is dry (3 strikes → kick). */
  private throttle(client: Socket, bucket: "messages" | "joins" | "typing") {
    const verdict = this.rateLimit.consume(client.id, bucket);
    if (verdict.ok) return true;
    this.metrics.wsRateLimited.inc();
    if (this.rateLimit.strike(client.id) >= STRIKES_LIMIT) {
      // Connection-level notice: the ack can't reach a kicked socket.
      client.emit("error", {
        code: "rate_limited",
        message: `too many ${bucket} violations — disconnecting`,
      } satisfies WsErrorDto);
      client.disconnect(true);
    }
    return false;
  }

  /** Runs a handler body; failures become `{ error }` acks, not throws. */
  private async run<T>(
    client: Socket,
    fn: () => Promise<T>,
  ): Promise<T | WsErrorAck> {
    try {
      return await fn();
    } catch (e) {
      this.logger.debug(
        `ws handler failed for ${client.id}: ${(e as Error).message}`,
      );
      return { error: toWsError(e) };
    }
  }

  private static readonly wsPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    exceptionFactory: (errors) =>
      new HttpException(
        `validation failed: ${errors.map((e) => Object.values(e.constraints ?? {})).join(", ")}`,
        400,
      ),
  });

  /** Same validation semantics as the HTTP edge, against a contract DTO. */
  private static parse<T>(Dto: new () => T, payload: unknown): Promise<T> {
    return ChatGateway.wsPipe.transform(payload, {
      type: "body",
      metatype: Dto as any,
      data: "",
    }) as Promise<T>;
  }

  async handleConnection(client: Socket) {
    const account = this.actorOf(client);
    await client.join(EmitterService.userRoom(account.id));

    // Auto-subscribe to every channel the account belongs to: resume and
    // unread pushes work right after reconnect, without client joins.
    let channelIds: number[] = [];
    try {
      channelIds = await this.chat.memberChannelIds(account.id);
    } catch (e) {
      this.logger.error(
        `membership hydration failed for ${account.id}: ${(e as Error).message}`,
      );
    }
    for (const id of channelIds) client.join(EmitterService.channelRoom(id));
    client.data.channels = channelIds;

    this.presence.ensureSweep(this.chatConfig.presenceTtlSeconds);
    await this.presence.connect(account.id, channelIds);
    this.metrics.wsConnections.inc();
    this.logger.log(`socket ${client.id} bound to account ${account.id}`);
  }

  async handleDisconnect(client: Socket) {
    const account: ChatAccount | undefined = client.data.account;
    if (!account) return;
    const channelIds: number[] = client.data.channels ?? [];
    await this.presence.disconnect(account.id, channelIds);
    this.rateLimit.release(client.id);
  }

  @SubscribeMessage("channel.join")
  join(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<JoinedAck | WsErrorAck> {
    if (!this.throttle(client, "joins"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(ChannelJoinDto, payload);
      await this.chat.assertMember(dto.channelId, this.actorOf(client));
      await client.join(EmitterService.channelRoom(dto.channelId));
      const channels: number[] = client.data.channels ?? [];
      if (!channels.includes(dto.channelId)) channels.push(dto.channelId);
      return { joined: true };
    });
  }

  @SubscribeMessage("channel.leave")
  leave(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<LeftAck | WsErrorAck> {
    if (!this.throttle(client, "joins"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      // Mute only: room subscription is a client-side concept; membership
      // is managed over REST (leave/kick).
      const dto = await ChatGateway.parse(ChannelLeaveDto, payload);
      await client.leave(EmitterService.channelRoom(dto.channelId));
      return { left: true };
    });
  }

  @SubscribeMessage("message.send")
  send(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<MessageWire | WsErrorAck> {
    if (!this.throttle(client, "messages"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(MessageSendDto, payload);
      const actor = this.actorOf(client);
      const wire = await this.chat.sendMessage(actor, dto);
      // Auto-subscribe the sender: the room broadcast covers their own echo.
      await client.join(EmitterService.channelRoom(wire.channelId));
      this.metrics.wsMessages.inc();
      this.emitter.toChannel(wire.channelId, "message.new", wire);
      return wire;
    });
  }

  @SubscribeMessage("message.edit")
  edit(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<MessageWire | WsErrorAck> {
    if (!this.throttle(client, "messages"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(MessageEditDto, payload);
      const wire = await this.chat.editMessage(this.actorOf(client), dto);
      this.emitUpdate(wire);
      return wire;
    });
  }

  @SubscribeMessage("message.delete")
  delete(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ id: number; channelId: number } | WsErrorAck> {
    if (!this.throttle(client, "messages"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(MessageDeleteDto, payload);
      const wire = await this.chat.deleteMessage(this.actorOf(client), dto);
      this.emitter.toChannel(wire.channelId, "message.deleted", {
        id: wire.id,
        channelId: wire.channelId,
      });
      return { id: wire.id, channelId: wire.channelId };
    });
  }

  private emitUpdate(wire: MessageWire) {
    this.emitter.toChannel(wire.channelId, "message.updated", {
      id: wire.id,
      channelId: wire.channelId,
      body: wire.body,
      editedAt: wire.editedAt!,
    });
  }

  @SubscribeMessage("typing")
  typing(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<OkAck | WsErrorAck> {
    if (!this.throttle(client, "typing"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(TypingDto, payload);
      const actor = this.actorOf(client);
      await this.chat.assertMember(dto.channelId, actor);
      // Ephemeral, no storage; everyone in the room except the typer.
      client.to(EmitterService.channelRoom(dto.channelId)).emit("typing", {
        channelId: dto.channelId,
        author: { id: actor.id, username: actor.username },
      });
      return { ok: true };
    });
  }

  @SubscribeMessage("read")
  read(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<OkAck | WsErrorAck> {
    if (!this.throttle(client, "joins"))
      return Promise.resolve({ error: { code: "rate_limited" } });
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(ReadDto, payload);
      await this.chat.markRead(
        dto.channelId,
        this.actorOf(client),
        dto.lastMessageId,
      );
      return { ok: true };
    });
  }

  /**
   * Ack-based resume: the return value is delivered as the socket.io ack —
   * exactly one reply to the requester, never a broadcast. `truncated`
   * means more history exists than the per-channel cap; backfill the rest
   * through REST history (`after=`).
   */
  @SubscribeMessage("sync")
  async sync(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<SyncAckDto | WsErrorAck> {
    if (!this.throttle(client, "joins"))
      return { error: { code: "rate_limited" } };
    return this.run(client, async () => {
      const dto = await ChatGateway.parse(SyncDto, payload);
      return this.chat.sync(this.actorOf(client), dto.channels);
    });
  }
}
