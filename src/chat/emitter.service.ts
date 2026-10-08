import { Injectable } from "@nestjs/common";
// Nest hands the "/" Namespace to afterInit — not the Server. Both expose
// to/in/disconnectSockets, so keep the union honest.
import { Namespace, Server } from "socket.io";
import { ChatServerEvent, MessageAttachmentDto } from "@src/contracts";

/**
 * Single access point to the Socket.IO server for non-gateway code
 * (REST handlers, webhooks, presence). The Redis adapter fans every
 * emit out to all replicas, so `toUser`/`toChannel` are cluster-wide:
 * a REST call landing on replica A still reaches sockets on replica B.
 */
@Injectable()
export class EmitterService {
  private io: Server | Namespace | null = null;

  register(server: Server | Namespace) {
    this.io = server;
  }

  static readonly userRoom = (accountId: number | string) =>
    `user:${accountId}`;
  static readonly channelRoom = (channelId: number | string) =>
    `channel:${channelId}`;

  toUser(accountId: number | string, event: ChatServerEvent, payload: unknown) {
    this.io?.to(EmitterService.userRoom(accountId)).emit(event, payload);
  }

  toChannel(
    channelId: number | string,
    event: ChatServerEvent,
    payload: unknown,
  ) {
    this.io?.to(EmitterService.channelRoom(channelId)).emit(event, payload);
  }

  /** Cluster-wide hard disconnect of every socket of an account. */
  disconnectUser(accountId: number | string) {
    this.io?.in(EmitterService.userRoom(accountId)).disconnectSockets(true);
  }
}

/** Shape of a persisted message as it travels on the wire. */
export interface MessageWire {
  id: number;
  channelId: number;
  author: { id: number; username: string };
  body: string;
  attachments?: MessageAttachmentDto[] | null;
  clientId: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
}
