// /client routes of SPEC §29 F1, F2, F4 (certificates, income statement, calendar). Registered in clientRoutes right
// after the §28 routes, BEFORE the older /deadlines/:id/ics, so the one-event file carries only the fixed labels.
import type { Hono } from 'hono';
import { z } from 'zod';
import { CERT_EXTENDED_ANSWERS, CERT_OFFICIAL_ANSWERS, CERT_PAPER_TO, CERT_PURPOSE_KINDS, CERTIFICATE_TYPES_K29 } from '../_shared/k29f.js';
import type { Deps } from '../deps.js';
import { auditC } from '../audit.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { clientOfUser, type ClientRow } from '../services/people.js';
import { assertFeature } from '../services/access.js';
import { cancelCertificate, certificateFormView, certificateViewById, clientCertificates, createCertificateRequest } from '../services/igazolas.js';
import { incomeStatementMeta, incomeStatementPdf, requestStatementReview, saveStatementToDossier } from '../services/kimutatas.js';
import { calendarView, createOrRotateFeed, regimeNow, revokeFeed, rowLinks, singleEventIcs } from '../services/naptar.js';
import { clientDeadlines } from '../services/flags.js';

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'ÉÉÉÉ-HH alakban.' });
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' });

export const certificateInputSchema = z.strictObject({
  type: z.enum(CERTIFICATE_TYPES_K29, { error: 'Válaszd ki, milyen igazolás kell.' }),
  year: z.number().int().min(2000).max(2100).optional(),
  purposeKind: z.enum(CERT_PURPOSE_KINDS, { error: 'Válaszd ki, mire kell.' }),
  purposeText: z.string().max(200).optional(),
  userName: z.string().max(200).optional(),
  neededBy: isoDay.nullish(),
  paperCopy: z.boolean().optional(),
  paperTo: z.enum(CERT_PAPER_TO).optional(),
  paperAddress: z.string().max(300).optional(),
  extended: z.enum(CERT_EXTENDED_ANSWERS).optional(),
  official: z.enum(CERT_OFFICIAL_ANSWERS).optional(),
  englishRequested: z.boolean().optional(),
  otherText: z.string().max(600).optional(),
});

export function registerClientK29fRoutes(r: Hono<Env>, deps: Deps): void {
  const client = (c: C): Promise<ClientRow> => clientOfUser(deps.db, auth(c).userId);

  // ================= F1 certificates =================
  r.get('/certificates', async (c) => {
    const cl = await client(c);
    return c.json({ items: await clientCertificates(deps, deps.db, cl) });
  });
  r.get('/certificates/form', async (c) => c.json(await certificateFormView(deps, deps.db, await client(c))));
  r.post('/certificates', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, certificateInputSchema);
    const v = await createCertificateRequest(deps, cl, b, { userId: auth(c).userId, ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    return c.json(v, 201);
  });
  r.get('/certificates/:id', async (c) => c.json(await certificateViewById(deps, deps.db, await client(c), param(c, 'id'))));
  r.post('/certificates/:id/cancel', async (c) => c.json(await cancelCertificate(deps, await client(c), param(c, 'id'), auth(c).userId)));

  // ================= F2 income statement =================
  const range = (c: C) => parseQuery(c, z.object({ from: monthKey.optional(), to: monthKey.optional() }));
  r.get('/income-statement/meta', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'bevetel');
    const q = range(c);
    return c.json(await incomeStatementMeta(deps, deps.db, cl, q.from, q.to));
  });
  r.get('/income-statement', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'bevetel');
    const q = range(c);
    const h = deps.limiter.hit(`kimutatas-pdf:${cl.id}`, 60, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const { pdf, filename, meta } = await incomeStatementPdf(deps, deps.db, cl, q.from, q.to);
    await auditC(c, deps.db, 'income_statement.downloaded', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { from: meta.from, to: meta.to, stamped: Boolean(meta.approved) } });
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="kimutatas_${meta.from}_${meta.to}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    c.header('Cache-Control', 'private, no-store');
    return c.body(new Uint8Array(pdf));
  });
  r.post('/income-statement/review', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'bevetel');
    const b = await readJson(c, z.object({ from: monthKey, to: monthKey }));
    return c.json(await requestStatementReview(deps, cl, b.from, b.to, auth(c).userId));
  });
  r.post('/income-statement/save', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'bevetel');
    const b = await readJson(c, z.object({ from: monthKey, to: monthKey }));
    return c.json(await saveStatementToDossier(deps, cl, b.from, b.to, auth(c).userId), 201);
  });

  // ================= F4 calendar =================
  r.get('/calendar', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'hataridok');
    return c.json(await calendarView(deps, deps.db, cl.id));
  });
  r.post('/calendar', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'hataridok');
    if (cl.terminated?.appliedAt || cl.anonymizedAt) throw E.conflict('A szerződésed megszűnt, ezért a naptár-link nem kapcsolható be.');
    const h = deps.limiter.hit(`naptar-uj:${cl.id}`, 10, 86_400_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    return c.json(await createOrRotateFeed(deps, cl, { userId: auth(c).userId }));
  });
  r.delete('/calendar', async (c) => {
    const cl = await client(c);
    await revokeFeed(deps, deps.db, cl.id, { userId: auth(c).userId, role: 'client' });
    return c.json(await calendarView(deps, deps.db, cl.id));
  });
  r.get('/deadlines/:id/ics', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'hataridok');
    const body = await singleEventIcs(deps, deps.db, cl.id, c.req.param('id'));
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="hatarido.ics"');
    return c.body(body);
  });
  r.get('/deadlines/:id/calendar-links', async (c) => {
    const cl = await client(c);
    await assertFeature(deps, deps.db, cl, 'hataridok');
    const id = c.req.param('id');
    const today = todayBudapest(deps.now());
    const d = (await clientDeadlines(deps, deps.db, cl.id, addDays(today, -400), addDays(today, 800))).find((x) => x.id === id);
    if (!d) throw E.notFound();
    return c.json({ ...rowLinks(deps, d, await regimeNow(deps, deps.db, cl.id)), ics: `/client/deadlines/${encodeURIComponent(id)}/ics` });
  });
}
