import { INestApplication } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server, ServerOptions } from "socket.io";
import Redis from "ioredis";

/**
 * Socket.IO adapter backed by Redis: broadcasts, room operations and
 * `disconnectSockets` work cluster-wide, so replicas are interchangeable
 * behind nginx `ip_hash`. Without REDIS_URL the plain in-memory IoAdapter
 * is used (single-replica only).
 */
export class RedisIoAdapter extends IoAdapter {
  private clients: Redis[] = [];

  constructor(
    app: INestApplication,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options) as Server;
    const pub = new Redis(this.redisUrl);
    const sub = pub.duplicate();
    this.clients = [pub, sub];
    // ioredis queues commands until connected — safe to attach immediately.
    server.adapter(createAdapter(pub, sub));
    return server;
  }

  async closeAll() {
    await Promise.allSettled(this.clients.map((c) => c.quit()));
  }
}
