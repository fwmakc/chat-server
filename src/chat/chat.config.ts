import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface RateRule {
  events: number;
  windowMs: number;
}

/** "<events>/<window seconds>", e.g. "30/10". */
const parseRate = (raw: string | undefined, fallback: RateRule): RateRule => {
  const m = raw?.match(/^(\d+)\/(\d+)$/);
  if (!m) return fallback;
  return { events: Number(m[1]), windowMs: Number(m[2]) * 1000 };
};

/**
 * Env-driven chat settings. Every limit is soft-configurable so an
 * operator can tune a busy deployment without a rebuild.
 */
@Injectable()
export class ChatConfig {
  readonly messageMaxLen: number;
  readonly maxAttachments: number;
  readonly rates: { messages: RateRule; joins: RateRule; typing: RateRule };
  /** Days; 0 = keep forever. */
  readonly retentionDays: number;
  /** Tombstones (soft-deleted rows) older than this are hard-deleted. */
  readonly tombstoneDays: number;
  readonly cleanupIntervalMs: number;
  readonly presenceTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.messageMaxLen = Number(config.get("CHAT_MESSAGE_MAX_LEN")) || 4096;
    this.maxAttachments =
      Number(config.get("CHAT_MESSAGE_MAX_ATTACHMENTS")) || 10;
    this.rates = {
      messages: parseRate(config.get<string>("CHAT_RATE_MESSAGES"), {
        events: 30,
        windowMs: 10_000,
      }),
      joins: parseRate(config.get<string>("CHAT_RATE_JOINS"), {
        events: 30,
        windowMs: 10_000,
      }),
      typing: parseRate(config.get<string>("CHAT_RATE_TYPING"), {
        events: 2,
        windowMs: 1_000,
      }),
    };
    this.retentionDays = Number(config.get("CHAT_MESSAGE_RETENTION_DAYS")) || 0;
    this.tombstoneDays = Number(config.get("CHAT_TOMBSTONE_DAYS")) || 7;
    this.cleanupIntervalMs =
      Number(config.get("CHAT_CLEANUP_INTERVAL_MS")) || 3_600_000;
    this.presenceTtlSeconds =
      Number(config.get("CHAT_PRESENCE_TTL_SECONDS")) || 30;
  }
}
