// /admin/marketing/** – SPEC §31.4 the owner's Marketing tab. Registered inside adminRoutes (role admin; everybody else
// gets 404 from the group guard). Aggregates only: no client name, e-mail or phone ever leaves here. The ad spend rows
// are typed in by the owner; a wrong row is revoked (kept, crossed out), never deleted.
import type { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { adSpend } from '../db/schema.js';
import { auditC } from '../audit.js';
import { auth, param, parseQuery, readJson, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { todayBudapest } from '../lib/dates.js';
import { marketingSummary } from '../services/marketing.js';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' });

export function registerAdminMarketingRoutes(r: Hono<Env>, deps: Deps): void {
  r.get('/marketing', async (c) => {
    const q = parseQuery(c, z.object({ nap: z.enum(['1', '7', '30', '90']).optional(), tol: iso.optional(), ig: iso.optional() }));
    if ((q.tol && !q.ig) || (!q.tol && q.ig)) throw E.validation({ tol: 'Add meg a kezdő és a záró napot is.' });
    return c.json(await marketingSummary(deps, q.tol && q.ig ? { from: q.tol, to: q.ig } : { days: Number(q.nap ?? '30') }));
  });

  r.post('/marketing/koltes', async (c) => {
    const b = await readJson(
      c,
      z.object({
        day: iso,
        platform: z.enum(['meta', 'google', 'egyeb']),
        campaign: z.string().trim().max(100).optional(),
        amountHuf: z.number({ error: 'Összeg kell.' }).int({ error: 'Egész forint.' }).min(1, { error: 'Legalább 1 Ft.' }).max(100_000_000, { error: 'Túl nagy összeg.' }),
        note: z.string().trim().max(200).optional(),
      }),
    );
    if (b.day > todayBudapest(deps.now())) throw E.validation({ day: 'Jövőbeli napra nem rögzíthetsz költést.' });
    const [row] = await deps.db
      .insert(adSpend)
      .values({ day: b.day, platform: b.platform, campaign: b.campaign || null, amountHuf: b.amountHuf, note: b.note || null, createdBy: auth(c).userId, createdAt: deps.now() })
      .returning();
    await auditC(c, deps.db, 'admin.ad_spend_added', { targetType: 'ad_spend', targetId: row!.id, details: { day: b.day, platform: b.platform, amountHuf: b.amountHuf } });
    return c.json({ id: row!.id }, 201);
  });

  r.post('/marketing/koltes/:id/visszavonas', async (c) => {
    const id = param(c, 'id');
    const [row] = await deps.db
      .update(adSpend)
      .set({ revokedAt: deps.now(), revokedBy: auth(c).userId })
      .where(and(eq(adSpend.id, id), isNull(adSpend.revokedAt)))
      .returning();
    if (!row) throw E.notFound();
    await auditC(c, deps.db, 'admin.ad_spend_revoked', { targetType: 'ad_spend', targetId: id, details: { day: row.day, platform: row.platform, amountHuf: row.amountHuf } });
    return c.json({ ok: true });
  });
}
