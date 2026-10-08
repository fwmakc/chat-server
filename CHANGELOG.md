# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-08
### Added (wave 16 — unfreeze: production realtime layer)
- **Security tier**: JWT handshake (RS256 via auth-server JWKS, `type==='access'` only — mfa rejected), `auth.expired` on in-session expiry, `user.*` event subscription (deactivated/deleted → kick + membership cleanup, roles_changed → hydration cache drop) with HMAC-signed deliveries, redis adapter (`chat:` prefix) for cross-replica rooms, per-socket token-bucket rate limits (`CHAT_RATE_*`).
- **Domain**: `chat_channels` / `chat_channel_members` / `chat_messages` (migrations own the schema); channels + idempotent DMs, owner/moderator/member roles, soft-delete tombstones, `client_id` idempotent sends (unique per channel+author+client), cursor history (`before`/`after`), ILIKE search, unread cursors, presence (redis TTL heartbeats + transitions), typing broadcast, `sync` resume (≤100 per call, `truncated` flag), retention job (`CHAT_MESSAGE_RETENTION_DAYS`), `chat_ws_*` metrics registered at boot.
- **Contracts artifact**: `chat-server/contracts` — typed client/server event registry (DTOs + `ChatContracts`), built via `npm run build:contracts`, `dist/contracts/` committed.
- **Tests**: 51 jest tests on real postgres (access matrix, idempotency, cursor invariant, unread, retention, rate limiter, handshake auth) + CI job.
- Toolkit pinned `#v0.32.0`.

### Changed
- Node 24 runtime bootstrap: `PORT` from env, Swagger wired, rawBody for HMAC, stub-trick Dockerfile.
- Chat is a live service in the gateway stack (compose service + nginx edge with a dedicated handshake budget and per-IP WS connection limit).

### Verified
- e2e-chat.mjs 27/27 through the edge; pentest-live.mjs §4 18/18; storm (gateway-server `load-tests/results.md`): 500 sockets / 600 messages / replica kill mid-flood → **0 lost, 0 live duplicates**.

## [0.1.3] - 2026-09-30
### Changed
- Toolkit pinned `#v0.22.0` (self-pentest wave 4): Access-бины fail-closed, delete-гварды для tenant-биндов, scoped `movePosition`, `getClientIp()`/`TRUST_PROXY`. Chat остаётся замороженным — WS-аутентификация будет добавлена при разморозке (см. PENTEST.md).

## [0.1.2] - 2026-09-30
### Changed
- Toolkit pin `#v0.21.1` (audit-logging wave; chat-server is frozen — `AuditModule` intentionally not wired until unfreeze).

## [0.1.1] - 2026-09-28
### Changed
- Node.js runtime bumped 22 → 24 LTS: Docker images `node:24-alpine`, CI `node-version: 24`.
- Toolkit pinned to `api-server-toolkit#v0.18.0` (adds `ApiKeyGuard` / `@ApiKey()`; no behavior change for existing routes).
- Dockerfile builds with explicit `npx tsc -p tsconfig.build.json` instead of `nest build` (silent no-op under Node 24 + current CLI); added `tsconfig.build.json` excluding test files.

## [0.1.0] - 2026-08-03

Version reset to pre-release. The chat server is incomplete and in active development. Pinned to `api-server-toolkit#v0.9.0`.

## [2.0.0] - 2026-08-03

### Stack v2 alignment
- Major version aligned with api-server-toolkit v2.x
- Pinned to `api-server-toolkit#v2.1.0`
- WebSocket chat server (Socket.IO) — stub/scaffold
- NestJS + Socket.IO setup, health checks, toolkit bootstrap
- Not production-ready (in development override only)
