// NAV traffic restriction (interface spec 1.6.11): 1 query / second / IP on limited endpoints; extra
// queries are delayed +4 s each and killed after 60 s queueing. All our clients share ONE server IP,
// so every call in this process goes through one serial queue with ≥ minIntervalMs between starts.

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class RateLimiter {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStart = Number.NEGATIVE_INFINITY;
  private pending = 0;

  constructor(
    readonly minIntervalMs: number,
    private readonly clock: Clock = realClock,
  ) {}

  /** Number of calls waiting or running. */
  get queued(): number {
    return this.pending;
  }

  /** Runs fn after every earlier call has finished AND ≥ minIntervalMs after the previous start. */
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    this.pending++;
    const run = async (): Promise<T> => {
      try {
        const wait = this.lastStart + this.minIntervalMs - this.clock.now();
        if (wait > 0) await this.clock.sleep(wait);
        this.lastStart = this.clock.now();
        return await fn();
      } finally {
        this.pending--;
      }
    };
    const p = this.tail.then(run, run);
    this.tail = p.catch(() => undefined);
    return p;
  }
}

const shared = new Map<string, RateLimiter>();

/** One limiter per target host and process (NAV counts per source IP). */
export function sharedLimiter(key: string, minIntervalMs: number): RateLimiter {
  const k = `${key}|${minIntervalMs}`;
  let l = shared.get(k);
  if (!l) {
    l = new RateLimiter(minIntervalMs);
    shared.set(k, l);
  }
  return l;
}
