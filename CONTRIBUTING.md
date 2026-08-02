# Contributing to chat-server

Thanks for your interest in contributing! This service is part of the
[fwmakc microservices stack](https://github.com/fwmakc/gateway-server).

> **Note:** This service is a stub/scaffold. Core functionality (JWT auth,
> Redis adapter, room management, persistence) needs to be completed.

## Prerequisites

- **Node.js** 20+ (`node -v`)
- **npm** 10+
- **Redis** (for Socket.IO adapter in production)

## Development Setup

```bash
git clone https://github.com/fwmakc/chat-server.git
cd chat-server
cp .env.example .env
npm install
npm run dev
```

Service runs on port **3004**.

## What Needs To Be Done

- JWT authentication on socket connections
- Redis adapter for horizontal scaling
- Room management (create, join, leave)
- Message persistence
- Typing indicators, read receipts

## Code Style

- TypeScript with strict type checking
- NestJS + Socket.IO conventions
- Use toolkit bootstrap and HealthModule
- See `AGENTS.md` for detailed conventions

## Pull Request Process

1. Fork the repo, create a branch from `master`
2. Make your changes
3. Ensure TypeScript compiles: `npm run build`
4. Create a pull request with a clear description
