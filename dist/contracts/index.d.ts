export declare class MessageAttachmentDto {
    key: string;
    url: string;
    mime?: string;
    size?: number;
    name?: string;
}
export declare class AuthorDto {
    id: number;
    username: string;
}
export declare class MessageSendDto {
    channelId: number;
    clientId: string;
    body: string;
    attachments?: MessageAttachmentDto[];
}
export declare class MessageEditDto {
    channelId: number;
    messageId: number;
    body: string;
}
export declare class MessageDeleteDto {
    channelId: number;
    messageId: number;
}
export declare class ChannelJoinDto {
    channelId: number;
}
export declare class ChannelLeaveDto {
    channelId: number;
}
export declare class TypingDto {
    channelId: number;
}
export declare class ReadDto {
    channelId: number;
    lastMessageId: number;
}
export declare class SyncDto {
    channels: Record<string, number>;
}
export declare class MessageNewDto {
    id: number;
    channelId: number;
    author: AuthorDto;
    body: string;
    attachments?: MessageAttachmentDto[];
    clientId: string;
    createdAt: string;
}
export declare class MessageUpdatedDto {
    id: number;
    channelId: number;
    body: string;
    editedAt: string;
}
export declare class MessageDeletedDto {
    id: number;
    channelId: number;
}
export declare class TypingEventDto {
    channelId: number;
    author: AuthorDto;
}
export declare class PresenceEventDto {
    accountId: number;
    status: "online" | "offline";
}
export declare class MemberEventDto {
    channelId: number;
    account: AuthorDto;
    role: "owner" | "moderator" | "member";
}
export declare class ChannelUpdatedDto {
    channelId: number;
    title?: string;
    isPublic?: boolean;
    deletedAt?: string;
}
export declare class SyncAckDto {
    messages: MessageNewDto[];
    truncated: boolean;
}
export declare class WsErrorDto {
    code: string;
    message?: string;
}
export declare class AuthExpiredDto {
    reason: string;
}
export interface OkAck {
    ok: boolean;
}
export interface JoinedAck {
    joined: boolean;
}
export interface LeftAck {
    left: boolean;
}
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
export declare const ChatContracts: {
    readonly client: {
        readonly "channel.join": typeof ChannelJoinDto;
        readonly "channel.leave": typeof ChannelLeaveDto;
        readonly "message.send": typeof MessageSendDto;
        readonly "message.edit": typeof MessageEditDto;
        readonly "message.delete": typeof MessageDeleteDto;
        readonly typing: typeof TypingDto;
        readonly read: typeof ReadDto;
        readonly sync: typeof SyncDto;
    };
    readonly server: {
        readonly "message.new": typeof MessageNewDto;
        readonly "message.updated": typeof MessageUpdatedDto;
        readonly "message.deleted": typeof MessageDeletedDto;
        readonly typing: typeof TypingEventDto;
        readonly "presence.updated": typeof PresenceEventDto;
        readonly "member.joined": typeof MemberEventDto;
        readonly "member.left": typeof MemberEventDto;
        readonly "channel.updated": typeof ChannelUpdatedDto;
        readonly "auth.expired": typeof AuthExpiredDto;
        readonly error: typeof WsErrorDto;
    };
};
export type ChatClientEvent = keyof typeof ChatContracts.client;
export type ChatServerEvent = keyof typeof ChatContracts.server;
