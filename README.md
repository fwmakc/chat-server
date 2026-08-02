# Chat Server

> WebSocket chat server (Socket.IO) — **incomplete, in development override only.**

## What This Is

A **working scaffold** for real-time chat — not production-ready yet, but wired
into the stack with Docker, health checks, and the toolkit bootstrap. The basic
NestJS + Socket.IO setup is functional; JWT auth, Redis adapter, and room
management need to be completed.

Part of a [microservices stack](https://github.com/fwmakc/gateway-server).

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
