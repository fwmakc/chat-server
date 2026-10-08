import { RateLimitService } from "./rate-limit.service";
import { ChatConfig, RateRule } from "./chat.config";

const configWith = (rates: {
  messages?: RateRule;
  joins?: RateRule;
  typing?: RateRule;
}) =>
  new RateLimitService({
    rates: {
      messages: rates.messages ?? { events: 30, windowMs: 10_000 },
      joins: rates.joins ?? { events: 30, windowMs: 10_000 },
      typing: rates.typing ?? { events: 2, windowMs: 1_000 },
    },
  } as ChatConfig);

describe("RateLimitService", () => {
  it("lets the first window through, then rejects with retryAfterMs", () => {
    const svc = configWith({ messages: { events: 3, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++) {
      expect(svc.consume("s1", "messages").ok).toBe(true);
    }
    const verdict = svc.consume("s1", "messages");
    expect(verdict.ok).toBe(false);
    expect(verdict.retryAfterMs).toBeGreaterThan(0);
    expect(verdict.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("counts sockets independently and buckets independently", () => {
    const svc = configWith({ messages: { events: 1, windowMs: 60_000 } });
    expect(svc.consume("a", "messages").ok).toBe(true);
    expect(svc.consume("b", "messages").ok).toBe(true);
    expect(svc.consume("a", "messages").ok).toBe(false);
    expect(svc.consume("a", "typing").ok).toBe(true); // another bucket
  });

  it("opens a fresh window after reset", () => {
    jest.useFakeTimers();
    const svc = configWith({ messages: { events: 1, windowMs: 1_000 } });
    expect(svc.consume("s", "messages").ok).toBe(true);
    expect(svc.consume("s", "messages").ok).toBe(false);
    jest.advanceTimersByTime(1_100);
    expect(svc.consume("s", "messages").ok).toBe(true);
    jest.useRealTimers();
  });

  it("strikes accumulate per socket and release() clears everything", () => {
    const svc = configWith({});
    expect(svc.strike("s")).toBe(1);
    expect(svc.strike("s")).toBe(2);
    expect(svc.strike("s")).toBe(3);
    expect(svc.strike("other")).toBe(1);
    svc.consume("s", "messages");
    svc.release("s");
    expect(svc.strike("s")).toBe(1); // reset
    expect(svc.consume("s", "messages").ok).toBe(true); // window reset
  });
});
