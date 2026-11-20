// /acc routes of SPEC §29 F1 (certificate queue + actions) and F2 (the accountant checks an income statement).
// Accountant: own clients only (404 otherwise); admin: all clients.
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { KOMA_OUTCOMES } from '../_shared/k29f.js';
import type { Deps } from '../deps.js';
import { clients } from '../db/schema.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { staffActor, type StaffActor } from '../services/team.js';
import type { ClientRow } from '../services/people.js';
import { accCertificateDetail, accCertificateRows, certificateReject, certificateResult, certificateSubmitted, revealCertificateTaxId } from '../services/igazolas.js';
import { accIncomeStatement, approveStatement } from '../services/kimutatas.js';

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'ÉÉÉÉ-HH alakban.' });

export function registerAccK29fRoutes(r: Hono<Env>, deps: Deps): void {
  const actor = (c: C): Promise<StaffActor> => staffActor(deps.db, auth(c).userId, auth(c).role);
  async function clientFor(c: C, a: StaffActor): Promise<ClientRow> {
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, param(c, 'id'))).limit(1);
    if (!cl || (a.role !== 'admin' && cl.accountantId !== a.accountantId)) throw E.notFound();
    return cl;
  }

  // ================= F1 certificates =================
  r.get('/certificates', async (c) => {
    const q = parseQuery(c, z.object({ status: z.string().max(20).optional() }));
    return c.json({ items: await accCertificateRows(deps, deps.db, await actor(c), q.status ?? 'open') });
  });
  r.get('/certificates/:id', async (c) => c.json(await accCertificateDetail(deps, deps.db, await actor(c), param(c, 'id'))));
  r.post('/certificates/:id/reveal', async (c) => {
    const h = deps.limiter.hit(`reveal:${auth(c).userId}`, 60, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    return c.json({ adoazonositoJel: await revealCertificateTaxId(deps, await actor(c), param(c, 'id')) });
  });
  r.post('/certificates/:id/submitted', async (c) => {
    const b = await readJson(c, z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), iktatoszam: z.string().max(60).optional() }));
    return c.json(await certificateSubmitted(deps, await actor(c), param(c, 'id'), b));
  });
  r.post('/certificates/:id/result', async (c) => {
    const b = await readJson(c, z.object({ documentId: z.string().uuid().nullish(), komaOutcome: z.enum(KOMA_OUTCOMES).optional(), komaDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), komaMonth: monthKey.optional() }));
    return c.json(await certificateResult(deps, await actor(c), param(c, 'id'), b));
  });
  r.post('/certificates/:id/reject', async (c) => {
    const b = await readJson(c, z.object({ reason: z.string().max(400) }));
    return c.json(await certificateReject(deps, await actor(c), param(c, 'id'), b.reason));
  });

  // ================= F2 income statement =================
  r.get('/clients/:id/income-statement', async (c) => {
    const a = await actor(c);
    const cl = await clientFor(c, a);
    const q = parseQuery(c, z.object({ from: monthKey.optional(), to: monthKey.optional() }));
    return c.json(await accIncomeStatement(deps, deps.db, cl, q.from, q.to));
  });
  r.post('/clients/:id/income-statement/approve', async (c) => {
    const a = await actor(c);
    if (a.role === 'csapat') throw E.forbidden();
    const cl = await clientFor(c, a);
    const b = await readJson(c, z.object({ from: monthKey, to: monthKey, dataSha256: z.string().regex(/^[0-9a-f]{64}$/) }));
    return c.json(await approveStatement(deps, cl, b, { userId: a.userId, role: a.role, firstName: a.firstName }));
  });
}
