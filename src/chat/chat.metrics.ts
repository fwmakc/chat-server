import { Injectable } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { MetricsService } from "api-server-toolkit/metrics";

type Counter = { inc(value?: number): void };

/**
 * Custom counters in the toolkit's /metrics registry. The shared
 * MetricsService is resolved with `strict: false` — importing
 * MetricsModule.forRoot a second time would build a second registry and
 * double-register the HTTP interceptor. Resolved lazily: by the first
 * gateway event the app context is fully initialized; without
 * MetricsModule in the app (some tests) the counters degrade to no-ops.
 */
@Injectable()
export class ChatMetrics {
  private connections?: Counter;
  private messages?: Counter;
  private rateLimited?: Counter;

  constructor(private readonly moduleRef: ModuleRef) {}

  // touch all getters at boot: a freshly restarted replica with no WS
  // traffic yet must still expose the series (a counter that only appears
  // with its first inc() breaks Prometheus dashboards on every restart)
  onModuleInit(): void {
    void this.wsConnections;
    void this.wsMessages;
    void this.wsRateLimited;
  }

  private counter(name: string, help: string): Counter {
    try {
      const metrics = this.moduleRef.get(MetricsService, { strict: false });
      if (metrics) return metrics.counter(name, help);
    } catch {
      /* fall through to the no-op */
    }
    return { inc: () => undefined };
  }

  get wsConnections(): Counter {
    return (this.connections ??= this.counter(
      "chat_ws_connections_total",
      "Accepted WebSocket connections",
    ));
  }

  get wsMessages(): Counter {
    return (this.messages ??= this.counter(
      "chat_ws_messages_total",
      "Persisted chat messages",
    ));
  }

  get wsRateLimited(): Counter {
    return (this.rateLimited ??= this.counter(
      "chat_ws_rate_limited_total",
      "WS events rejected by the per-socket rate limiter",
    ));
  }
}
