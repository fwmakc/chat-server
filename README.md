# Chat Server

[![CI](https://github.com/fwmakc/chat-server/actions/workflows/test.yml/badge.svg)](https://github.com/fwmakc/chat-server/actions/workflows/test.yml)
[![Version](https://img.shields.io/badge/version-v0.1.0-blue)](https://github.com/fwmakc/chat-server/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://github.com/fwmakc/chat-server/blob/master/LICENSE)

> Reference implementation: realtime WebSocket pattern — Socket.IO, JWT auth, Redis adapter (incomplete).

## What This Is

A **working scaffold** for real-time chat — not production-ready yet, but wired
into the stack with Docker, health checks, and the toolkit bootstrap. The basic
NestJS + Socket.IO setup is functional; JWT auth, Redis adapter, and room
management need to be completed.

Part of a [microservices stack](https://github.com/fwmakc/gateway-server).

## Pattern

This service demonstrates the **realtime gateway pattern** in the toolkit stack:

- **WebSocket** — Socket.IO, room management, broadcast
- **JWT auth** — token validation via auth-server JWKS
- **Redis adapter** — multi-instance fanout, pub/sub
- **Event subscription** — listen to event-server for real-time notifications

Clone this when you need: real-time communication, live updates, push notifications, chat.

## Status: Stub

This service is not production-ready. It is included in `docker-compose.override.yml`
(dev only) for future development.

**What's done:**
- Basic NestJS + Socket.IO setup
- Health endpoint
- Dockerfile (Node 22, tsconfig-paths)

**What's missing:**
- JWT authentication on WebSocket connections (currently unauthenticated)
- Redis adapter for multi-instance fanout
- Event subscription (listen to event-server for real-time notifications)
- Room management, message persistence
- Rate limiting, abuse prevention

## Alternatives

If you need real-time chat now, consider:
- **Centrifugo** — language-agnostic real-time server, JWT auth, Redis backend
- **Soketi** — open-source Pusher-compatible WebSocket server
- **Socket.IO + Redis adapter** — if you want to complete this service

## Role in the stack (planned)

```
client → nginx (WebSocket upgrade) → chat-server
chat-server → auth-server (JWT verification)
chat-server → Redis (pub/sub for multi-instance)
chat-server → event-server (subscribe to domain events)
```

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3004 | HTTP port |
| `AUTH_SERVER_URL` | http://localhost:3001 | Auth server for JWT |
| `REDIS_HOST` | redis | Redis host (for Socket.IO adapter) |
| `REDIS_PORT` | 6379 | Redis port |

## AI-Friendly Documentation

This service is designed for AI-assisted development.

### ai-context.md
Auto-generated structured reference: controllers, routes, gateways,
entities. Run `npm run ai-context` to regenerate.

### Swagger UI
Interactive API exploration at `/swagger` — explore available endpoints
and health checks.

### ReDoc
Clean, readable documentation at `/redoc`.

### Why this matters
An LLM with `ai-context.md` can help you complete the missing pieces
(JWT auth, Redis adapter, room management) following the conventions
already established in the stack.

## Backend-Only — Bring Your Own Frontend

This is a WebSocket backend service. No frontend included.

Socket.IO has client libraries for every platform: browser, React Native,
Flutter, Unity. Connect your client to `ws://your-host/socket.io/`.

## Integrating into existing infrastructure

- **Already have a chat solution?** This service is optional — the stack
  works without it. Consider Centrifugo or Soketi if you need production
  chat today.
- **Want to extend it?** The scaffold uses the same toolkit, bootstrap(),
  and HealthModule as the rest of the stack. Complete the missing pieces
  (JWT auth, Redis adapter, persistence) and add it to docker-compose.

## Related services

- [auth-server](https://github.com/fwmakc/auth-server) — JWT verification
- [gateway-server](https://github.com/fwmakc/gateway-server) — Docker Compose, Nginx

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

> Synced across all repos on 2026-10-07. Source of truth: the `v*` git tags at each repo HEAD.

| Service | Version |
|---------|---------|
| [api-server-toolkit](https://github.com/fwmakc/api-server-toolkit) | v0.32.0 |
| [event-server](https://github.com/fwmakc/event-server) | v1.5.0 |
| [auth-server](https://github.com/fwmakc/auth-server) | v0.13.0 |
| [message-server](https://github.com/fwmakc/message-server) | v0.7.0 |
| [file-server](https://github.com/fwmakc/file-server) | v0.8.1 |
| [chat-server](https://github.com/fwmakc/chat-server) | v0.1.3 (frozen) |
| [api-server](https://github.com/fwmakc/api-server) | v0.8.0 |
| [gateway-server](https://github.com/fwmakc/gateway-server) | v0.6.0 (infra) |
| [api-server-scaffold](https://github.com/fwmakc/api-server-scaffold) | v0.1.5 |
