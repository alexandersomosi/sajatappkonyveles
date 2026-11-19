// In-memory fixed-window rate limiter (SPEC §4.3; single API instance). Keys never contain raw
// e-mails or IPs: callers pass HMACs.
export interface Hit {
  ok: boolean;
  retryAfterSec: number;
  count: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;
  constructor(private readonly now: () => number = Date.now) {}

  hit(key: string, limit: number, windowMs: number, cost = 1): Hit {
    const t = this.now();
    this.sweep(t);
    let b = this.buckets.get(key);
    if (!b || b.resetAt <= t) {
      b = { count: 0, resetAt: t + windowMs };
      this.buckets.set(key, b);
    }
    b.count += cost;
    return { ok: b.count <= limit, retryAfterSec: (b.resetAt - t) / 1000, count: b.count };
  }

  /** Read-only check (does not count). */
  peek(key: string, limit: number): Hit {
    const t = this.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= t) return { ok: true, retryAfterSec: 0, count: 0 };
    return { ok: b.count < limit, retryAfterSec: (b.resetAt - t) / 1000, count: b.count };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private sweep(t: number): void {
    if (t - this.lastSweep < 60_000) return;
    this.lastSweep = t;
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}
