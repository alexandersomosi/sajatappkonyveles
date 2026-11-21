// SPEC §32.B – /acc routes of the annual cycle (staff side): the amounts of the yearly return, the refund, the yearly HIPA,
// the manual close / open, the önellenőrzések, the NAV folyószámla checks and the "Éves áttekintő". The accountant sees his
// own clients only (others 404), the admin everybody; the csapat role none (404). Every write is audited and strict (zod).
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { auditC } from '../audit.js';
import { collectFiles } from '../files/upload.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { createDocument } from '../services/documents.js';
import { accAnnualView } from '../services/eves-zaras.js';
import { annualAmountsSchema, annualHipaSchema, closeAnnualManually, openAnnualManually, recordRefund, saveAnnualAmounts, saveAnnualHipa } from '../services/eves-ciklus.js';
import {
  accCorrectionDto,
  accCorrectionList,
  approvePotlek,
  cancelCorrection,
  correctionInputSchema,
  correctionOf,
  createCorrection,
  fileCorrection,
  sendCorrection,
} from '../services/onellenorzes.js';
import { expectedView, reconciliationSchema, reconList, reconView, resolveReconciliation, saveReconciliation } from '../services/folyoszamla.js';
import { yearOverview } from '../services/ev-attekinto.js';
import { computeFlags } from '../services/flags.js';
import { clientForStaff, staffActor, type StaffActor } from '../services/team.js';
import type { ClientRow } from '../services/people.js';
import { accountReconciliations } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { selfRevisionSurcharge } from '../tax/engine.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'ÉÉÉÉ-HH-NN alakban.' });

export function registerAccEvRoutes(r: Hono<Env>, deps: Deps): void {
  async function staffClient(c: C, clientId?: string): Promise<{ actor: StaffActor; cl: ClientRow }> {
    const actor = await staffActor(deps.db, auth(c).userId, auth(c).role);
    if (actor.role === 'csapat') throw E.notFound();
    const cl = await clientForStaff(deps, deps.db, actor, clientId ?? param(c, 'id'));
    return { actor, cl };
  }
  const annualOut = (cl: ClientRow, year: number, actor: StaffActor) => accAnnualView(deps, deps.db, cl, year, false, actor);

  // ---- annual amounts / refund / HIPA / close / open
  r.put('/clients/:id/annual/:aid/amounts', async (c) => {
    const { actor, cl } = await staffClient(c);
    const b = await readJson(c, annualAmountsSchema);
    const row = await deps.db.transaction((tx) => saveAnnualAmounts(deps, tx, cl, param(c, 'aid'), b, actor));
    return c.json(await annualOut(cl, row.taxYear, actor));
  });
  r.post('/clients/:id/annual/:aid/refund', async (c) => {
    const { actor, cl } = await staffClient(c);
    const b = await readJson(c, z.strictObject({ status: z.enum(['megerkezett', 'beszamitva', 'atvezetve']), on: day, amountHuf: z.number().int().min(0).max(1_000_000_000).nullish(), note: z.string().trim().max(500).nullish() }));
    const row = await deps.db.transaction((tx) => recordRefund(deps, tx, cl, param(c, 'aid'), b, { ...actor, client: false }));
    return c.json(await annualOut(cl, row.taxYear, actor));
  });
  r.put('/clients/:id/annual/:aid/hipa', async (c) => {
    const { actor, cl } = await staffClient(c);
    const b = await readJson(c, annualHipaSchema);
    const row = await deps.db.transaction((tx) => saveAnnualHipa(deps, tx, cl, param(c, 'aid'), b, actor));
    return c.json(await annualOut(cl, row.taxYear, actor));
  });
  r.post('/clients/:id/annual/:aid/close', async (c) => {
    const { actor, cl } = await staffClient(c);
    const b = await readJson(c, z.strictObject({ reason: z.string().trim().min(5, { error: 'Írd le röviden, miért zárod le kézzel.' }).max(500) }));
    const row = await deps.db.transaction((tx) => closeAnnualManually(deps, tx, cl, param(c, 'aid'), b.reason, actor));
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await annualOut(cl, row.taxYear, actor));
  });
  r.post('/clients/:id/annual/open', async (c) => {
    const { actor, cl } = await staffClient(c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100) }));
    const row = await deps.db.transaction((tx) => openAnnualManually(deps, tx, cl, b.year, actor));
    return c.json(await annualOut(cl, row.taxYear, actor));
  });

  // ---- önellenőrzés
  r.get('/clients/:id/corrections', async (c) => {
    const { cl } = await staffClient(c);
    return c.json({ items: await accCorrectionList(deps, deps.db, cl.id) });
  });
  r.post('/clients/:id/corrections', async (c) => {
    const { actor, cl } = await staffClient(c);
    const b = await readJson(c, correctionInputSchema);
    const row = await deps.db.transaction((tx) => createCorrection(deps, tx, cl, b, actor));
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await accCorrectionDto(deps, deps.db, row), 201);
  });
  /** A one-line suggestion for the form (no row): ?amountHuf&dueDate&filedOn&repeated */
  r.get('/corrections/potlek', async (c) => {
    await staffActor(deps.db, auth(c).userId, auth(c).role);
    const q = parseQuery(c, z.object({ amountHuf: z.coerce.number().int().min(0).max(1_000_000_000), dueDate: day, filedOn: day.optional(), repeated: z.enum(['0', '1']).optional() }));
    return c.json(selfRevisionSurcharge({ amountHuf: q.amountHuf, dueDate: q.dueDate, filedOn: q.filedOn ?? todayBudapest(deps.now()), repeated: q.repeated === '1' }));
  });
  async function ownedCorrection(c: C) {
    const row = await correctionOf(deps.db, param(c, 'cid'));
    if (!row) throw E.notFound();
    const { actor, cl } = await staffClient(c, row.clientId);
    return { actor, cl, row };
  }
  r.get('/corrections/:cid', async (c) => {
    const { row } = await ownedCorrection(c);
    return c.json(await accCorrectionDto(deps, deps.db, row));
  });
  r.put('/corrections/:cid', async (c) => {
    const { actor, cl, row } = await ownedCorrection(c);
    const b = await readJson(c, correctionInputSchema);
    const u = await deps.db.transaction((tx) => import('../services/onellenorzes.js').then((m) => m.updateCorrection(deps, tx, cl, row, b, actor)));
    return c.json(await accCorrectionDto(deps, deps.db, u));
  });
  r.post('/corrections/:cid/potlek', async (c) => {
    const { actor, cl, row } = await ownedCorrection(c);
    const b = await readJson(c, z.strictObject({ huf: z.number().int().min(0).max(100_000_000), reason: z.string().trim().max(500).nullish(), payer: z.enum(['ugyfel', 'iroda']).optional() }));
    const u = await deps.db.transaction((tx) => approvePotlek(deps, tx, cl, row, b, actor));
    return c.json(await accCorrectionDto(deps, deps.db, u));
  });
  r.post('/corrections/:cid/send', async (c) => {
    const { actor, cl, row } = await ownedCorrection(c);
    const u = await deps.db.transaction((tx) => sendCorrection(deps, tx, cl, row, actor));
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await accCorrectionDto(deps, deps.db, u));
  });
  r.post('/corrections/:cid/filed', async (c) => {
    const { actor, cl, row } = await ownedCorrection(c);
    const body = await c.req.parseBody({ all: true });
    const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '');
    const ret = await collectFiles(body, 'file');
    const rec = await collectFiles(body, 'receipt');
    if (!ret.length) throw E.validation({ file: 'Töltsd fel a beadott önellenőrzést (PDF).' });
    if (!rec.length) throw E.validation({ receipt: 'Töltsd fel a NAV visszaigazolását.' });
    const u = await deps.db.transaction(async (tx) => {
      const month = todayBudapest(deps.now()).slice(0, 7);
      const d1 = await createDocument(deps, tx, { clientId: cl.id, source: 'konyvelo', category: 'bevallas', dossierMonth: month, title: `Önellenőrzés – ${row.formLabel} ${row.subjectLabel}`, createdBy: actor.userId, files: ret.slice(0, 1), pages: [], actorRole: actor.role, visibility: 'kozos', status: 'beadva' });
      const d2 = await createDocument(deps, tx, { clientId: cl.id, source: 'konyvelo', category: 'nav_visszaigazolas', dossierMonth: month, title: `Önellenőrzés – NAV-visszaigazolás (${row.formLabel} ${row.subjectLabel})`, createdBy: actor.userId, files: rec.slice(0, 1), pages: [], actorRole: actor.role, visibility: 'kozos', status: 'beadva' });
      return fileCorrection(deps, tx, cl, row, { filedOn: str('filedOn'), filingRef: str('filingRef'), returnDocumentId: d1.id, receiptDocumentId: d2.id, accountNumber: str('accountNumber') || null }, actor);
    });
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await accCorrectionDto(deps, deps.db, u));
  });
  r.post('/corrections/:cid/cancel', async (c) => {
    const { actor, cl, row } = await ownedCorrection(c);
    const b = await readJson(c, z.strictObject({ reason: z.string().trim().min(3, { error: 'Írd le röviden, miért vonod vissza.' }).max(500) }));
    const u = await deps.db.transaction((tx) => cancelCorrection(deps, tx, cl, row, b.reason, actor));
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await accCorrectionDto(deps, deps.db, u));
  });

  // ---- NAV folyószámla
  r.get('/clients/:id/reconciliations', async (c) => {
    const { cl } = await staffClient(c);
    return c.json({ items: await reconList(deps.db, cl.id) });
  });
  r.get('/clients/:id/reconciliations/expected', async (c) => {
    const { cl } = await staffClient(c);
    const q = parseQuery(c, z.object({ asOf: day.optional() }));
    return c.json(await expectedView(deps, deps.db, cl, q.asOf ?? todayBudapest(deps.now())));
  });
  r.post('/clients/:id/reconciliations', async (c) => {
    const { actor, cl } = await staffClient(c);
    const ct = (c.req.header('content-type') ?? '').toLowerCase();
    let raw: unknown;
    let files: Awaited<ReturnType<typeof collectFiles>> = [];
    if (ct.startsWith('multipart/')) {
      const body = await c.req.parseBody({ all: true });
      try {
        raw = JSON.parse(typeof body.data === 'string' ? body.data : '{}');
      } catch {
        throw E.validation({ data: 'Hibás adat.' });
      }
      files = await collectFiles(body, 'file');
    } else raw = await c.req.json().catch(() => {
      throw E.validation({ body: 'JSON kell.' });
    });
    const parsed = reconciliationSchema.safeParse(raw);
    if (!parsed.success) throw E.validation(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.') || 'body', i.message])));
    const row = await deps.db.transaction(async (tx) => {
      let documentId = parsed.data.documentId ?? null;
      if (files.length) {
        const d = await createDocument(deps, tx, { clientId: cl.id, source: 'konyvelo', category: 'adoszamla_kivonat', dossierMonth: parsed.data.asOf.slice(0, 7), title: `NAV-folyószámla kivonat (${parsed.data.asOf})`, createdBy: actor.userId, files: files.slice(0, 1), pages: [], actorRole: actor.role, visibility: 'csak_konyvelo' });
        documentId = d.id;
      }
      return saveReconciliation(deps, tx, cl, { ...parsed.data, documentId }, actor);
    });
    await computeFlags(deps, deps.db, cl.id);
    await auditC(c, deps.db, 'reconciliation.route', { targetType: 'account_reconciliation', targetId: row.id, clientId: cl.id });
    return c.json(await reconView(deps.db, row), 201);
  });
  r.post('/reconciliations/:rid/resolve', async (c) => {
    const [row] = await deps.db.select().from(accountReconciliations).where(eq(accountReconciliations.id, param(c, 'rid'))).limit(1);
    if (!row) throw E.notFound();
    const { actor, cl } = await staffClient(c, row.clientId);
    const b = await readJson(c, z.strictObject({ note: z.string().trim().max(500).nullish() }));
    const u = await deps.db.transaction((tx) => resolveReconciliation(deps, tx, row, b.note ?? null, actor));
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await reconView(deps.db, u));
  });

  // ---- "Éves áttekintő" (own clients; the admin everybody or ?accountantId=)
  r.get('/overview/year', async (c) => {
    const actor = await staffActor(deps.db, auth(c).userId, auth(c).role);
    if (actor.role === 'csapat') throw E.notFound();
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2024).max(2100).optional(), filter: z.enum(['mind', 'hianyzik', 'ram_var', 'ugyfelre_var', 'lejart', 'kata', 'atalany']).optional(), accountantId: z.string().uuid().optional() }));
    const year = q.year ?? Number(todayBudapest(deps.now()).slice(0, 4));
    const accountantId = actor.role === 'admin' ? (q.accountantId ?? null) : actor.accountantId;
    if (actor.role !== 'admin' && !accountantId) throw E.notFound();
    return c.json(await yearOverview(deps, deps.db, { accountantId, year, filter: q.filter }));
  });
}
