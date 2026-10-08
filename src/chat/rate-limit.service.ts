import { Injectable } from "@nestjs/common";
import { ChatConfig, RateRule } from "./chat.config";

export type RateBucket = "messages" | "joins" | "typing";

interface Window {
  count: number;
  resetAt: number;
}

export interface RateVerdict {
  ok: boolean;
  retryAfterMs: number;
}

/**
 * Fixed-window per-socket limiter for WS events. State is replica-local:
 * the edge rate-limits handshakes, nginx `ip_hash` keeps a connection on
 * one replica, and a per-connection flood is a single-replica problem by
 * construction. Violations are counted by the gateway; three strikes
 * disconnect the socket.
 */
@Injectable()
export class RateLimitService {
  private readonly windows = new Map<string, Window>();
  private readonly strikes = new Map<string, number>();

  constructor(private readonly chatConfig: ChatConfig) {}

  rule(bucket: RateBucket): RateRule {
    return this.chatConfig.rates[bucket];
  }

  consume(socketId: string, bucket: RateBucket): RateVerdict {
    const rule = this.rule(bucket);
    const key = `${socketId}:${bucket}`;
    const now = Date.now();
    const win = this.windows.get(key);
    if (!win || win.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + rule.windowMs });
      return { ok: true, retryAfterMs: 0 };
    }
    if (win.count < rule.events) {
      win.count += 1;
      return { ok: true, retryAfterMs: 0 };
    }
    return { ok: false, retryAfterMs: win.resetAt - now };
  }

  /** Returns the strike count after registering one (1-based). */
  strike(socketId: string): number {
    const next = (this.strikes.get(socketId) ?? 0) + 1;
    this.strikes.set(socketId, next);
    return next;
  }

  release(socketId: string) {
    for (const key of this.windows.keys()) {
      if (key.startsWith(`${socketId}:`)) this.windows.delete(key);
    }
    this.strikes.delete(socketId);
  }
}
