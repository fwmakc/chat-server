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

All services in the fwmakc stack share the same **major version**. Same major = guaranteed compatibility.

| Level | Scope | Example |
|-------|-------|---------|
| **Major** | Shared across ALL services. A breaking change in any service bumps the major for everyone. | toolkit 2.x → 3.0.0 ⟹ all services tag v3.0.0 |
| **Minor** | Independent per service. New features (additive). | auth-server 2.1.0 → 2.2.0 |
| **Patch** | Independent per service. Bug fixes. | event-server 2.0.0 → 2.0.1 |

### What triggers a major bump

A breaking change at any intersection point:

- **api-server-toolkit** — guards, columns, decorators, EntityController, bootstrap, services
- **event-server contracts** — DTO field removed/renamed, required field added
- **Inter-service API** — JWT claim format, `X-Internal-Api-Key` scheme, webhook contract
- **Public API** — any endpoint that another service depends on

### What does NOT trigger a major bump

- Bug fixes, performance improvements
- New features (additive — new optional fields, new endpoints)
- Internal refactoring that doesn't change interfaces

### Alignment process

When a service makes a breaking change (e.g., toolkit 2.x → 3.0.0):

1. The changing service bumps its major and tags the release
2. **All other services** get a stack alignment commit:
   - Bump `version` in `package.json`
   - Add CHANGELOG entry: `chore: stack v3 alignment`
   - Update dependency pins if needed
   - Tag `v3.0.0`
3. All services are now on stack v3

### Current versions

| Service | Version |
|---------|---------|
| [api-server-toolkit](https://github.com/fwmakc/api-server-toolkit) | v2.1.0 |
| [event-server](https://github.com/fwmakc/event-server) | v2.0.0 |
| [auth-server](https://github.com/fwmakc/auth-server) | v2.0.0 |
| [message-server](https://github.com/fwmakc/message-server) | v2.0.0 |
| [file-server](https://github.com/fwmakc/file-server) | v2.0.0 |
| [chat-server](https://github.com/fwmakc/chat-server) | v2.0.0 |
| [api-server](https://github.com/fwmakc/api-server) | v2.0.0 |
| [gateway-server](https://github.com/fwmakc/gateway-server) | v2.0.0 |
| [scaffold](https://github.com/fwmakc/scaffold) | v2.0.0 |
