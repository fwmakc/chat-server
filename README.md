# Chat Server

[![CI](https://github.com/fwmakc/chat-server/actions/workflows/test.yml/badge.svg)](https://github.com/fwmakc/chat-server/actions/workflows/test.yml)
[![Version](https://img.shields.io/badge/version-v0.2.0-blue)](https://github.com/fwmakc/chat-server/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/fwmakc/chat-server/blob/master/LICENSE)

> The stack's realtime layer: channels & direct messages over Socket.IO —
> JWT handshake, postgres history, redis fan-out across replicas, presence
> and typing, unread cursors, attachments via file-server links.

Part of a [microservices stack](https://github.com/fwmakc/gateway-server).

## What This Is

A production chat backend built on the toolkit primitives: REST for
management (channels, membership, history, search, unread) and WebSocket for
the live stream (messages, typing, presence). History lives in postgres
forever (optional retention window); live delivery crosses replicas through
the redis adapter; identity comes from the same RS256 JWTs the rest of the
stack issues — verified against auth-server's JWKS on every handshake.

Scope decision (wave 16): chat provides **primitives** — no notifications
bots, no message reactions, no tenant isolation (documented future work).
The client is yours; this service gives you a typed contract artifact and
six DX guarantees (see "Client contract").

## Role in the stack

```
client → nginx (WS upgrade + /chat REST face) → chat-server
chat-server ← auth-server    (JWKS verification, account hydration via internal API)
chat-server → postgres       (channels, members, messages — migrations own the schema)
chat-server → redis          (socket.io adapter: cross-replica rooms, presence TTL keys)
chat-server ← event-server   (user.* deliveries: deactivated/deleted → kick, roles_changed → cache drop)
```

## Quick start

```bash
# in the gateway stack (recommended — nginx edge, redis, postgres wired):
docker compose up -d --build chat-server        # from gateway-server/

# standalone (needs postgres + redis + auth-server):
cp .env.example .env && npm ci && npm run start:dev
```

- REST: `http://localhost:3004/chat/*` — Swagger at `/swagger`
- WS: `socket.io` at `/socket.io/` — send `{ auth: { token: "<access JWT>" } }`
- Health: `GET /health`, metrics: `GET /metrics` (`chat_ws_*` counters)

## REST API (management face)

All routes require a JWT (`Authorization: Bearer`); access = channel
membership (owner / moderator / member roles), superuser bypasses.

| Route | Purpose |
|-------|---------|
| `POST /chat/channels` | create a channel (or a DM — type `dm` + `accountId`, idempotent per pair) |
| `GET /chat/channels` | my channels with unread counts |
| `GET /chat/unread` | unread summary across channels |
| `GET /chat/presence` | presence of my contacts |
| `GET/PATCH/DELETE /chat/channels/:id` | inspect / rename / delete (owner) |
| `POST /chat/channels/:id/join` | join a **public** channel (DMs don't join) |
| `POST /chat/channels/:id/leave` | leave |
| `GET /chat/channels/:id/members` | members + roles |
| `POST /chat/channels/:id/members` | add a member (moderator+; DMs closed) |
| `PATCH /chat/channels/:id/members/:accountId` | change role (owner only) |
| `DELETE /chat/channels/:id/members/:accountId` | kick (moderator+; owner immovable) |
| `GET /chat/channels/:id/messages` | cursor history: `before`/`after` + `limit`, ascending window |
| `GET /chat/channels/:id/search?q=` | ILIKE body search in the channel |
| `POST /chat/channels/:id/read` | advance my read cursor (drives unread) |

Message bodies are capped at `CHAT_MESSAGE_MAX_LEN` (default 4096) with up
to 10 attachments — `{key,url,mime,size,name}` links produced by file-server
uploads; chat never stores bytes.

## WebSocket protocol (live face)

Handshake: `io(url, { auth: { token } })` — the token must be a valid
**access** JWT (`mfa` challenge tokens are rejected), verified against
auth-server's JWKS. Rejected handshakes get `connect_error: unauthorized`.

Client → server (ack = commit point):

| Event | Payload | Ack / notes |
|-------|---------|-------------|
| `channel.join` | `{channelId}` | enters the **room** for an existing member; room entry ≠ membership — joining a public channel is REST `POST …/join` |
| `channel.leave` | `{channelId}` | mute only; membership changes go through REST |
| `message.send` | `{channelId, clientId, body, attachments?}` | **idempotent**: same `clientId` → the same row, no duplicate broadcast. The ack is the commit: an error/timeout ack means "not persisted" — retry with the same `clientId` |
| `message.edit` | `{channelId, messageId, body}` | author only |
| `message.delete` | `{channelId, messageId}` | author or moderator; soft-delete (tombstone) |
| `typing` | `{channelId}` | broadcast only, never stored |
| `read` | `{channelId, messageId}` | advances the unread cursor |
| `sync` | `{channels: {id: lastSeenId}}` | resume: everything after your cursor per channel (≤100, tombstones included; `truncated:true` → loop or REST backfill) |

Server → client: `message.new`, `message.updated`, `message.deleted`,
`typing`, `presence.updated` (online/offline transitions, redis TTL
heartbeats), `member.joined`, `member.left`, `channel.updated`,
`auth.expired` (your access token expired — reconnect with a fresh one),
`error {code}`.

**Cursor semantics:** message ids are global across channels (one sequence,
per-channel ordering). A resume cursor is the last **global** id you saw in
that channel — don't assume ids start at 1.

**Typed contract:** `npm run build:contracts` produces `dist/contracts/`
(committed); frontends import types from `chat-server/contracts` —
`ChatContracts.client` / `ChatContracts.server` map every event to its DTO.

## Client contract (the six DX guarantees)

1. Typed WS contract artifact — `chat-server/contracts`, no drift.
2. JWT handshake + `auth.expired` — reconnect with a fresh access token.
3. Resume: `sync` from your cursors + idempotent sends — 0 lost, 0 duplicated
   under replica failure (validated by the wave-16 storm).
4. REST/Swagger for management, WS for the live stream.
5. `e2e-chat.mjs` in gateway-server is the executable reference client.
6. Infrastructure (scaling, limits, keys) stays invisible until you need it.

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3004 | HTTP port |
| `DB_*` | — | postgres for `chat_server` (migrations run on boot under a lock) |
| `AUTH_SERVER_URL` | http://localhost:3001 | JWKS + internal account hydration |
| `JWT_ISSUER` / `JWT_AUDIENCE` | — | optional pinning (must match auth-server) |
| `REDIS_URL` | redis://localhost:6379 | socket.io adapter + presence keys (prefix `chat:`) |
| `INTERNAL_API_KEY` | — | service-to-service header for auth hydration |
| `EVENT_SERVER_URL` | http://localhost:3005 | `user.*` subscription; `disabled` opts out |
| `WEBHOOK_HOST` / `WEBHOOK_URL` | os.hostname | callback address event-server should call |
| `WEBHOOK_SECRET` | — | HMAC for webhook deliveries (`X-Event-Signature`) |
| `CHAT_MESSAGE_MAX_LEN` | 4096 | body cap (chars) |
| `CHAT_MESSAGE_MAX_ATTACHMENTS` | 10 | attachments per message |
| `CHAT_RATE_MESSAGES` | 30/10 | per-socket sends per window (events/seconds) |
| `CHAT_RATE_JOINS` | 30/10 | per-socket joins + syncs per window |
| `CHAT_RATE_TYPING` | 2/1 | per-socket typing events per window |
| `CHAT_MESSAGE_RETENTION_DAYS` | unset | hard-delete messages older than N days (0/unset = keep forever) |

## Scaling

Stateless replicas: rooms and presence live in redis (adapter prefix
`chat:`), history in postgres. Run N replicas behind the gateway nginx —
`ip_hash` pins each client to one replica for the handshake, the redis
adapter spreads room broadcasts everywhere. A replica can die mid-storm:
clients reconnect, `sync` fills the gap (see `load-tests/results.md` —
500 sockets, 0 lost / 0 duplicated with a replica killed mid-flood).

Edge limits that protect this path live in gateway-server's nginx configs:
the `chat_limit` handshake zone and `conn_limit` on `/socket.io/` (sized
for NAT offices; rationale inline).

## Production notes (wave 16 verification record)

- 51 jest tests on real postgres (access matrix, idempotency, cursors,
  unread, retention, rate limiter, handshake auth) + e2e-chat.mjs 27/27
  through the nginx edge + pentest-live.mjs section 4 (18 crafted-token /
  cross-user checks).
- Storm (gateway-server `load-tests/results.md`, wave 16 section):
  direct 500 clients / 600 messages / replica kill → **0 lost, 0 live
  duplicates**; edge 150 / 200 / kill → same. `chat_ws_*` metrics are
  registered at boot (series exist before the first connection).
- Sends are **not durable across an outage by design** — the ack is the
  commit. Clients retry with the same `clientId`; the storm measures both
  behaviours (retry → invariant holds; no retry → 2% sends lost in the
  kill window).

## AI-Friendly Documentation

### ai-context.md
Auto-generated structured reference: controllers, routes, gateways,
entities. Run `npm run ai-context` to regenerate.

### Swagger UI
Interactive API exploration at `/swagger` (prefix via `SWAGGER_PREFIX`).

### contracts/
`src/contracts/` → `npm run build:contracts` → `dist/contracts/` — the
typed WS surface, importable by frontends and AI agents alike.

## Backend-Only — Bring Your Own Frontend

Socket.IO has client libraries for every platform. Connect to
`ws://your-host/socket.io/` (through the gateway nginx in the stack), pass
the access JWT in `auth.token`, and follow `e2e-chat.mjs` as the reference
flow (connect → join → send → sync-on-resume).

## Related services

- [auth-server](https://github.com/fwmakc/auth-server) — JWT (RS256 + JWKS), account hydration
- [event-server](https://github.com/fwmakc/event-server) — `user.*` deliveries (kick / cache-drop)
- [file-server](https://github.com/fwmakc/file-server) — attachment storage behind the links
- [gateway-server](https://github.com/fwmakc/gateway-server) — Docker Compose, nginx edge, e2e/load harness

---

## Versioning

Each service versions **independently** (semver): a `vX.Y.Z` git tag marks the released state of each repo. There is no stack-wide shared major — compatibility is guaranteed by **exact dependency pins**, not by version numbers.

- Repos on `0.x` (toolkit, api/auth/file/message-server, gateway): the minor carries breaking changes while the stack is in development; patch = fixes.
- `event-server` follows a `1.x` line (stable event-contract surface).
- Consumers pin sources by tag: `"api-server-toolkit": "github:fwmakc/api-server-toolkit#v0.32.0"`, `"event-server": "github:fwmakc/event-server#v1.5.0"`.

### Breaking-change procedure

1. Bump the source repo (toolkit or event-server), tag the release, push.
2. In each consumer: bump the pin in `package.json` (a dedicated `build: pin …` commit), run the tests, push.
3. Update the `Current versions` table below in every repo so it keeps reflecting the actual tags.

### Current versions

> Synced across all repos on 2026-10-08. Source of truth: the `v*` git tags at each repo HEAD.

| Service | Version |
|---------|---------|
| [api-server-toolkit](https://github.com/fwmakc/api-server-toolkit) | v0.32.0 |
| [event-server](https://github.com/fwmakc/event-server) | v1.5.0 |
| [auth-server](https://github.com/fwmakc/auth-server) | v0.13.0 |
| [message-server](https://github.com/fwmakc/message-server) | v0.7.0 |
| [file-server](https://github.com/fwmakc/file-server) | v0.8.1 |
| [chat-server](https://github.com/fwmakc/chat-server) | v0.2.0 |
| [api-server](https://github.com/fwmakc/api-server) | v0.8.0 |
| [gateway-server](https://github.com/fwmakc/gateway-server) | v0.6.0 (infra) |
| [api-server-scaffold](https://github.com/fwmakc/api-server-scaffold) | v0.1.5 |
