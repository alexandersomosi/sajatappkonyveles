// SPEC §32.B – /client routes of the annual cycle: the timeline, "Megjelölöm, hogy megérkezett" (refund), and the
// önellenőrzés (list, detail, approve with the hash of what the client saw). The client sees his own rows only.
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { clientOfUser } from '../services/people.js';
import { isRestricted } from '../services/access.js';
import { annualOf, annualView, defaultAnnualYear } from '../services/eves-zaras.js';
import { annualTimeline, recordRefund } from '../services/eves-ciklus.js';
import { approveCorrection, clientCorrections, clientCorrectionView, correctionOf } from '../services/onellenorzes.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'ÉÉÉÉ-HH-NN alakban.' });

export function registerClientEvRoutes(r: Hono<Env>, deps: Deps): void {
  const client = async (c: C) => {
    const cl = await clientOfUser(deps.db, auth(c).userId);
    if (isRestricted(cl)) throw E.notFound();
    return cl;
  };
  const thisYear = () => Number(todayBudapest(deps.now()).slice(0, 4));

  r.get('/annual/timeline', async (c) => {
    const cl = await client(c);
    const year = parseQuery(c, z.object({ year: z.coerce.number().int().min(2024).max(2100).optional() })).year ?? (await defaultAnnualYear(deps.db, cl.id, thisYear()));
    // javító kör 11-21: no 'nem_indult' row for a year far from now (last year, this year, next year only)
    if (year < thisYear() - 1 || year > thisYear() + 1) throw E.notFound();
    await annualView(deps, deps.db, cl, year); // makes the 'nem_indult' row when missing
    const row = await annualOf(deps.db, cl.id, year);
    return c.json({ year, items: row ? await annualTimeline(deps, deps.db, cl, row) : [] });
  });
  r.post('/annual/:id/refund-received', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ receivedOn: day, amountHuf: z.number().int().min(0).max(1_000_000_000).nullish() }));
    const row = await deps.db.transaction((tx) => recordRefund(deps, tx, cl, param(c, 'id'), { status: 'megerkezett', on: b.receivedOn, amountHuf: b.amountHuf ?? null }, { userId: auth(c).userId, role: 'client', client: true }));
    return c.json(await annualView(deps, deps.db, cl, row.taxYear));
  });

  r.get('/corrections', async (c) => {
    const cl = await client(c);
    const rows = await clientCorrections(deps.db, cl.id);
    const items = [];
    for (const x of rows) items.push(await clientCorrectionView(deps, deps.db, cl, x));
    return c.json({ items });
  });
  r.get('/corrections/:id', async (c) => {
    const cl = await client(c);
    const row = await correctionOf(deps.db, param(c, 'id'));
    if (!row || row.clientId !== cl.id || row.status === 'tervezet' || row.status === 'visszavonva') throw E.notFound();
    return c.json(await clientCorrectionView(deps, deps.db, cl, row));
  });
  r.post('/corrections/:id/approve', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ hash: z.string().regex(/^[0-9a-f]{64}$/) }));
    const row = await deps.db.transaction((tx) => approveCorrection(deps, tx, cl, param(c, 'id'), b.hash, auth(c).userId));
    return c.json(await clientCorrectionView(deps, deps.db, cl, row));
  });
}
