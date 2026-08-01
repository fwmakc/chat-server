# Chat Server

WebSocket chat server: rooms, connections, real-time messaging via Socket.IO.

Port **3004**. Part of the microservices split (Stage 1, Issue #6).

## Status: Stub

Code migrated from api-server, requires adaptation before production use:

- [x] Extract `common/` into `api-server-toolkit` npm package
- [x] JWT verification via JWKS (auth-server)
- [ ] Configure WebSocket adapter in `main.ts`
- [ ] Adapt `@src/account/` imports → get `account_id` from JWT
- [ ] Connect Redis for Socket.IO multi-instance adapter

## Architecture

See [Issue #6](https://github.com/fwmakc/api-server/issues/6) — full split plan.

## Development

```bash
npm install
npm run dev
```

## Port Assignments

| Service | Port |
|---------|------|
| auth-server | 3001 |
| file-server | 3002 |
| message-server | 3003 |
| **chat-server** | **3004** |
| event-server | 3005 |
| api-server | 5000 |
