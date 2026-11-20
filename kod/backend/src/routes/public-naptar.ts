// Public GET /api/v1/naptar/{token}.ics – SPEC §29.8 F4 (served on the API and app hosts). Unknown and revoked tokens
// get the same 404 body; 60/h per token and 600/h per IP; ETag + private caching for an hour.
import { Hono } from 'hono';
import { CALENDAR_RULES } from '../_shared/k29f.js';
import type { Deps } from '../deps.js';
import type { Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { feedForToken, tokenHash } from '../services/naptar.js';

export function naptarRoutes(deps: Deps) {
  const r = new Hono<Env>();
  r.get('/:file', async (c) => {
    const m = /^([A-Za-z0-9_-]{20,100})\.ics$/.exec(c.req.param('file'));
    const ip = deps.limiter.hit(`naptar-ip:${c.get('ipHmac')}`, CALENDAR_RULES.perIpPerHour, 3600_000);
    if (!ip.ok) throw E.rateLimited(ip.retryAfterSec);
    if (!m) throw E.notFound();
    const tk = deps.limiter.hit(`naptar-tok:${tokenHash(m[1]!).slice(0, 24)}`, CALENDAR_RULES.perTokenPerHour, 3600_000);
    if (!tk.ok) throw E.rateLimited(tk.retryAfterSec);
    const f = await feedForToken(deps, m[1]!);
    if (!f) throw E.notFound();
    c.header('Cache-Control', 'private, max-age=3600');
    c.header('ETag', f.etag);
    c.header('X-Robots-Tag', 'noindex');
    if (c.req.header('if-none-match') === f.etag) return c.body(null, 304);
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    c.header('Content-Disposition', 'inline; filename="adozz-hataridok.ics"');
    return c.body(f.body);
  });
  return r;
}
