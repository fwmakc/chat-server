# Chat Server

> WebSocket chat server (Socket.IO) — **incomplete, in development override only.**

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

## Related services

- [auth-server](https://github.com/fwmakc/auth-server) — JWT verification
- [gateway-server](https://github.com/fwmakc/gateway-server) — Docker Compose, Nginx
