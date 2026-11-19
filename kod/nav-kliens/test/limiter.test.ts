import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from '../src/limiter.js';

describe('RateLimiter (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T05:30:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('starts calls serially, ≥ 1000 ms apart', async () => {
    const limiter = new RateLimiter(1000);
    const starts: number[] = [];
    const task = () => {
      starts.push(Date.now());
      return Promise.resolve(starts.length);
    };
    const all = Promise.all([limiter.schedule(task), limiter.schedule(task), limiter.schedule(task), limiter.schedule(task)]);
    await vi.runAllTimersAsync();
    expect(await all).toEqual([1, 2, 3, 4]);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]!);
    expect(gaps).toEqual([1000, 1000, 1000]);
  });

  it('never runs two calls at the same time and survives a failing call', async () => {
    const limiter = new RateLimiter(1000);
    let running = 0;
    let maxRunning = 0;
    const slow = (fail: boolean) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 2500));
      running--;
      if (fail) throw new Error('boom');
      return 'ok';
    };
    const a = limiter.schedule(slow(true)).catch((e: Error) => e.message);
    const b = limiter.schedule(slow(false));
    await vi.runAllTimersAsync();
    expect(await a).toBe('boom');
    expect(await b).toBe('ok');
    expect(maxRunning).toBe(1);
  });

  it('a later call after a long pause does not wait', async () => {
    const limiter = new RateLimiter(1000);
    await limiter.schedule(async () => 1);
    vi.advanceTimersByTime(5000);
    const t0 = Date.now();
    let startedAt = 0;
    const p = limiter.schedule(async () => {
      startedAt = Date.now();
    });
    await vi.runAllTimersAsync();
    await p;
    expect(startedAt - t0).toBe(0);
  });
});
