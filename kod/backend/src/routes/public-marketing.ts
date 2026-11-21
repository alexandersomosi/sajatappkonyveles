// SPEC §31.6 – the public ends of the (switched-off) ad measurement. The proxy forwards exactly these paths from adozz.hu
// to the API (same origin for the landing script). With ADS_TRACKING_ENABLED=false: the config says { ads: false } and the
// consent endpoints answer 404 – nothing is stored, nothing is loaded.
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { marketingConsents } from '../db/schema.js';
import { readJson, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { AD_CONSENT_MAX_AGE_DAYS, withdrawConsents } from '../services/hirdetes.js';

export interface PublicMarketingConfig {
  ads: boolean;
  noticeVersion?: string;
  /** Public ids only (they are in the page source anyway); never a token. */
  metaPixelId?: string | null;
  googleTagId?: string | null;
}

export function publicMarketingRoutes(deps: Deps) {
  const r = new Hono<Env>();

  r.get('/public/marketing-config', (c) => {
    const a = deps.cfg.ads;
    c.header('Cache-Control', 'public, max-age=300');
    const body: PublicMarketingConfig = a.enabled ? { ads: true, noticeVersion: a.noticeVersion, metaPixelId: a.meta?.pixelId ?? null, googleTagId: a.google?.tagId ?? null } : { ads: false };
    return c.json(body);
  });

  /**
   * The banner's decision. Only a granted decision is stored (a refusal needs no record); a new decision or "Visszavonom"
   * ends the previous one (the id the banner kept). Answer: { id } of the stored decision or { id: null }.
   */
  r.post('/public/hozzajarulas', async (c) => {
    if (!deps.cfg.ads.enabled) throw E.notFound();
    const h = deps.limiter.hit(`consent-ip:${c.get('ipHmac')}`, 30, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const b = await readJson(
      c,
      z.object({
        meta: z.boolean().default(false),
        google: z.boolean().default(false),
        personalization: z.boolean().default(false),
        previous: z.string().uuid().optional(),
      }),
    );
    if (b.previous) {
      // Süti-tájékoztató 6.: a new choice on the banner ends the previous decision – also when it is linked to an account
      // already (then nothing more is sent about that account). Only this browser knows the random id.
      const [prev] = await deps.db.select({ id: marketingConsents.id }).from(marketingConsents).where(eq(marketingConsents.id, b.previous)).limit(1);
      if (prev) await withdrawConsents(deps, deps.db, { consentId: prev.id });
    }
    const meta = b.meta && Boolean(deps.cfg.ads.meta);
    const google = b.google && Boolean(deps.cfg.ads.google);
    if (!meta && !google) return c.json({ id: null });
    const [row] = await deps.db
      .insert(marketingConsents)
      // personalised ads / remarketing are not offered (Adatkezelési tájékoztató 2.18.): always false
      .values({ meta, google, personalization: false, noticeVersion: deps.cfg.ads.noticeVersion, source: 'landing', ipHmac: c.get('ipHmac'), userAgent: c.get('ua').slice(0, 120), createdAt: deps.now() })
      .returning({ id: marketingConsents.id });
    return c.json({ id: row!.id }, 201);
  });

  /**
   * The landing asks at every visit whether its stored decision is still valid (withdrawn in the app, too old, or of an
   * older notice version → { ervenyes: false }: the page deletes the ad cookies and asks again). Answers nothing else.
   */
  r.get('/public/hozzajarulas/:id', async (c) => {
    if (!deps.cfg.ads.enabled) throw E.notFound();
    const h = deps.limiter.hit(`consent-check-ip:${c.get('ipHmac')}`, 120, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const id = c.req.param('id');
    c.header('Cache-Control', 'no-store');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return c.json({ ervenyes: false });
    const since = new Date(deps.now().getTime() - AD_CONSENT_MAX_AGE_DAYS * 86_400_000);
    const [row] = await deps.db.select({ withdrawnAt: marketingConsents.withdrawnAt, noticeVersion: marketingConsents.noticeVersion, createdAt: marketingConsents.createdAt }).from(marketingConsents).where(eq(marketingConsents.id, id)).limit(1);
    const ervenyes = Boolean(row && !row.withdrawnAt && row.noticeVersion === deps.cfg.ads.noticeVersion && row.createdAt >= since);
    return c.json({ ervenyes });
  });

  return r;
}
