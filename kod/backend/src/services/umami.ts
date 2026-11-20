// SPEC §31.1: the server-side reader of our own statistics server (Umami 3.5.0, container kezjegy-umami, internal
// address only). The Marketing tab never talks to Umami from the browser; the credentials stay in /srv/kezjegy/.env.
// Every number comes from Umami as it is – when Umami does not answer, the caller shows "nem érhető el" and NO number.
// Only aggregates are read (visitors per tag / device / country / city / event / campaign): no visitor-level data.
import type { UmamiCfg } from '../config.js';

export class UmamiUnavailable extends Error {}

export interface UmamiPoint {
  x: string;
  y: number;
}

export interface UmamiSummary {
  visitors: number;
  visits: number;
  pageviews: number;
  /** Visitors per channel: the landing script sets the Umami "tag" to the channel of shared/src/marketing.ts channelOf(). */
  tags: UmamiPoint[];
  devices: UmamiPoint[];
  countries: UmamiPoint[];
  cities: UmamiPoint[];
  /** Custom events (count of events): regisztralok, belepes, visszahivas, email-iras, arak-lathato. */
  events: UmamiPoint[];
  /** Visitors per utm_campaign. */
  campaigns: UmamiPoint[];
}

export interface UmamiClient {
  summary(r: { startAt: number; endAt: number }): Promise<UmamiSummary>;
}

const TIMEOUT_MS = 6000;
const CACHE_MS = 5 * 60_000;

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return Number(v);
  // Umami 2.x answered { value, prev }
  if (v && typeof v === 'object' && 'value' in v) return num((v as { value: unknown }).value);
  return 0;
};

function points(v: unknown): UmamiPoint[] {
  if (!Array.isArray(v)) throw new UmamiUnavailable('unexpected metrics answer');
  return v
    .filter((p): p is { x: unknown; y: unknown } => Boolean(p) && typeof p === 'object')
    .map((p) => ({ x: typeof p.x === 'string' ? p.x : p.x === null || p.x === undefined ? '' : String(p.x), y: num(p.y) }))
    .filter((p) => p.y > 0);
}

export function createUmamiClient(cfg: UmamiCfg, f: typeof fetch, now: () => Date = () => new Date()): UmamiClient {
  let token: string | null = null;
  /** One login at a time: the parallel metric calls of a summary share it. */
  let pending: Promise<string> | null = null;
  const ensureToken = async (): Promise<string> => {
    if (token) return token;
    pending ??= login().finally(() => {
      pending = null;
    });
    token = await pending;
    return token;
  };
  const cache = new Map<string, { at: number; v: UmamiSummary }>();

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await f(`${cfg.url}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new UmamiUnavailable('no answer');
    }
  }

  async function login(): Promise<string> {
    const res = await call('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: cfg.user, password: cfg.password }) });
    if (!res.ok) throw new UmamiUnavailable(`login ${res.status}`);
    const b = (await res.json().catch(() => null)) as { token?: unknown } | null;
    if (!b || typeof b.token !== 'string' || !b.token) throw new UmamiUnavailable('login without token');
    return b.token;
  }

  async function get(path: string, q: Record<string, string | number>): Promise<unknown> {
    const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)] as [string, string])).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      const tok = await ensureToken();
      const res = await call(`/api/websites/${encodeURIComponent(cfg.websiteId)}${path}?${qs}`, { headers: { authorization: `Bearer ${tok}`, accept: 'application/json' } });
      if (res.status === 401 && attempt === 0) {
        if (token === tok) token = null;
        continue;
      }
      if (!res.ok) throw new UmamiUnavailable(`${path} ${res.status}`);
      return res.json().catch(() => {
        throw new UmamiUnavailable(`${path} not json`);
      });
    }
    throw new UmamiUnavailable('unauthorized');
  }

  return {
    async summary(r) {
      const key = `${r.startAt}-${r.endAt}`;
      const hit = cache.get(key);
      const t = now().getTime();
      if (hit && t - hit.at < CACHE_MS) return hit.v;
      const base = { startAt: r.startAt, endAt: r.endAt, timezone: 'Europe/Budapest' };
      const metric = (type: string, limit = 50) => get('/metrics', { ...base, type, limit }).then(points);
      const [stats, tags, devices, countries, cities, events, campaigns] = await Promise.all([
        get('/stats', base),
        metric('tag'),
        metric('device'),
        metric('country'),
        metric('city', 20),
        metric('event'),
        metric('utmCampaign', 100),
      ]);
      const s = (stats ?? {}) as Record<string, unknown>;
      const v: UmamiSummary = { visitors: num(s.visitors), visits: num(s.visits), pageviews: num(s.pageviews), tags, devices, countries, cities, events, campaigns };
      if (cache.size > 50) cache.clear();
      cache.set(key, { at: t, v });
      return v;
    },
  };
}
