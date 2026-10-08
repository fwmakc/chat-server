import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { EmitterService } from "./emitter.service";

/**
 * Presence = Redis key with a TTL, refreshed by a single per-replica
 * sweep (one timer for all local sockets, not one per connection).
 * Transitions (first connect / last disconnect) are broadcast to every
 * channel room the account belongs to; heartbeats stay silent.
 *
 * Redis failure degrades to "presence unavailable": reads return unknown,
 * writes are swallowed — chat itself keeps working.
 */
@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis | null;
  /** accountId → local connection count (this replica only). */
  private readonly local = new Map<number, number>();
  private sweep: NodeJS.Timeout | null = null;

  constructor(
    config: ConfigService,
    private readonly emitter: EmitterService,
  ) {
    const url = config.get<string>("REDIS_URL");
    this.redis = url
      ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
      : null;
    if (this.redis) {
      this.redis.on("error", (e) =>
        this.logger.warn(`redis: ${(e as Error).message}`),
      );
      void this.redis.connect().catch(() => {
        /* retry happens lazily on first command */
      });
    }
  }

  onModuleDestroy() {
    if (this.sweep) clearInterval(this.sweep);
    void this.redis?.quit().catch(() => undefined);
  }

  private key(accountId: number) {
    return `chat:presence:${accountId}`;
  }

  /** Starts the TTL sweep once the first local connection appears. */
  ensureSweep(ttlSeconds: number) {
    if (this.sweep) return;
    this.sweep = setInterval(
      () => {
        const ids = [...this.local.keys()];
        if (!ids.length || !this.redis) return;
        const pipeline = this.redis.pipeline();
        for (const id of ids) pipeline.set(this.key(id), "1", "EX", ttlSeconds);
        void pipeline.exec().catch(() => undefined);
      },
      Math.max(5_000, (ttlSeconds * 1000) / 2),
    );
  }

  async connect(accountId: number, memberChannelIds: number[]) {
    const prev = this.local.get(accountId) ?? 0;
    this.local.set(accountId, prev + 1);
    if (prev === 0) {
      await this.setOnline(accountId);
      // First connection of this account anywhere → announce to their
      // channels. memberChannelIds come from the gateway after hydration.
      for (const channelId of memberChannelIds) {
        this.emitter.toChannel(channelId, "presence.updated", {
          accountId,
          status: "online",
        });
      }
    }
  }

  async disconnect(accountId: number, memberChannelIds: number[]) {
    const prev = this.local.get(accountId) ?? 0;
    const next = prev - 1;
    if (next > 0) {
      this.local.set(accountId, next);
      return;
    }
    this.local.delete(accountId);
    await this.setOffline(accountId);
    for (const channelId of memberChannelIds) {
      this.emitter.toChannel(channelId, "presence.updated", {
        accountId,
        status: "offline",
      });
    }
  }

  private async setOnline(accountId: number) {
    if (!this.redis) return;
    try {
      await this.redis.set(this.key(accountId), "1", "EX", 30);
    } catch {
      /* presence is best-effort */
    }
  }

  private async setOffline(accountId: number) {
    if (!this.redis) return;
    try {
      await this.redis.del(this.key(accountId));
    } catch {
      /* presence is best-effort */
    }
  }

  /** "online" | "offline" | undefined (unknown — redis unreachable). */
  async status(accountId: number): Promise<"online" | "offline" | undefined> {
    if (!this.redis) return undefined;
    try {
      return (await this.redis.get(this.key(accountId))) ? "online" : "offline";
    } catch {
      return undefined;
    }
  }
}
