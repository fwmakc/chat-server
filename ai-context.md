# AI Context — chat-server

> Auto-generated. Run `npm run ai-context` to regenerate.
> Generated: 2026-10-08T18:51:38.515Z

---

## Controllers

### CreateChannelDto [chat]

Base path: `/chat`

| Method | Path |
|--------|------|
| `POST` | `/chat/channels` |
| `GET` | `/chat/channels` |
| `GET` | `/chat/unread` |
| `GET` | `/chat/presence` |
| `GET` | `/chat/channels/:id` |
| `PATCH` | `/chat/channels/:id` |
| `DELETE` | `/chat/channels/:id` |
| `POST` | `/chat/channels/:id/join` |
| `POST` | `/chat/channels/:id/leave` |
| `GET` | `/chat/channels/:id/members` |
| `POST` | `/chat/channels/:id/members` |
| `PATCH` | `/chat/channels/:id/members/:accountId` |
| `DELETE` | `/chat/channels/:id/members/:accountId` |
| `GET` | `/chat/channels/:id/messages` |
| `GET` | `/chat/channels/:id/search` |
| `POST` | `/chat/channels/:id/read` |

### WebhooksController

Base path: `/webhooks`

| Method | Path |
|--------|------|
| `POST` | `/webhooks/events` |

---

## Services

### ChatService

- `assertMember(channelId: number,
    actor: ChatActor,
    minRole?: MemberRole,): Promise<ChannelMemberEntity>`
- `createChannel(actor: ChatActor,
    input: {
      type: "channel" | "dm";
      title?: string;
      isPublic?: boolean;
      members?: number[];
    },): Promise<`
- `memberChannelIds(accountId: number): Promise<number[]>`
- `usernameOf(accountId: number): Promise<string>`
- `toWire(m: MessageEntity): Promise<MessageWire>`
- `toISOString(): null,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
    }`
- `sendMessage(actor: ChatActor,
    input: {
      channelId: number;
      clientId: string;
      body: string;
      attachments?: MessageAttachmentDto[];
    },): Promise<MessageWire>`
- `editMessage(actor: ChatActor,
    input: { channelId: number; messageId: number; body: string },): Promise<MessageWire>`
- `deleteMessage(actor: ChatActor,
    input: { channelId: number; messageId: number },): Promise<MessageWire>`
- `listMessages(channelId: number,
    actor: ChatActor,
    opts: {
      before?: number;
      after?: number;
      limit?: number;
      includeDeleted?: boolean;
    },): Promise<`
- `slice(0, limit): rows).sort(
      (a, b) => Number(a.id) - Number(b.id),
    )`
- `searchMessages(channelId: number,
    actor: ChatActor,
    q: string,
    limit = 20,): Promise<MessageWire[]>`
- `sync(actor: ChatActor,
    cursors: Record<string, number>,): Promise<`

### PresenceService

- `Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 }): null`
- `status(accountId: number): Promise<"online" | "offline" | undefined>`

### RateLimitService

- `rule(bucket: RateBucket): RateRule`
- `consume(socketId: string, bucket: RateBucket): RateVerdict`
- `strike(socketId: string): number`

### RetentionService

- `Retention(MAIL_CLEANUP_* pattern): with CHAT_MESSAGE_RETENTION_DAYS > 0
 * messages older than the window are hard-deleted on a fixed interval.
 * Tombstones (soft-deleted rows) always expire independently — they exist
 * only so offline clients learn about deletions through history/sync, and
 * once every client has synced them they are noise.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy`
- `run(): Promise<void>`

### WsAuthService

- `authenticate(token: string): Promise<ChatAccount>`

### SubscriberService

- `subscription(file-server pattern): every replica
 * registers its own callback URL (docker DNS resolves the container
 * hostname to that replica), so an account deactivation kicks sockets on
 * each replica, not just one.
 */
@Injectable()
export class SubscriberService implements OnApplicationBootstrap`
- `onApplicationBootstrap(): Promise<void>`
- `register(retry = 0): Promise<void>`
- `httpPost(`${this.eventServerUrl}/subscribe`,
        {
          service: "chat-server",
          url: this.webhookUrl,
          patterns: this.patterns,
          active: true,
          // Registration is idempotent (same service+url merges): a fresh
          // secret here re-provisions the stored one, e.g. after rotation.
          ...(this.webhookSecret ?`
- `booting(compose race): retry with
      // exponential backoff instead of dying silently.
      if (retry < 5)`

### WebhooksService

- `handleEvent(body: WebhookEnvelopeDto): Promise<void>`

---

## Entities

### ChannelEntity (table: `chat_channels`)


### MessageEntity (table: `chat_messages`)


---
