// /admin/console/** – SPEC §29.9 F9 owner console. Registered inside adminRoutes (role admin; others get 404 from the
// group guard). Every route needs TOTP enabled (403 mfa_setup_required); every write needs a step-up (403
// step_up_required) and is audited by the service with reason / before / after.
import type { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { CONSOLE_SECTIONS, PRICE_OVERRIDE_KINDS, TERMINATION_CLIENT_WHEN, TERMINATION_KINDS, TERMINATION_SUB_REASONS, type ConsoleSection } from '../_shared/k29f.js';
import type { Deps } from '../deps.js';
import { documents, documentVersions, files, gdprExports, clients } from '../db/schema.js';
import { audit } from '../audit.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { assertConsoleMfa, consoleClientHeader, consoleClients, consoleOverview, consolePreview, consoleSection, consoleStepUp, requireStepUp, revealField, stepUpState } from '../services/konzol.js';
import {
  addAdminFee,
  addPriceOverride,
  announce,
  anonymizeFromConsole,
  chargeFeeNow,
  consoleExport,
  consolePause,
  consolePauseClose,
  messageClient,
  patchProfile,
  reactivateClient,
  reassignAccountant,
  refundConsole,
  retryInvoiceConsole,
  revokePriceOverride,
  sendClientCode,
  setManualLock,
  terminateClient,
  waiveFee,
} from '../services/konzol-muveletek.js';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' });
const reason = z.string().max(1000);

export function registerAdminConsoleRoutes(r: Hono<Env>, deps: Deps): void {
  // every console route: admin with TOTP
  r.use('/console/*', async (c, next) => {
    assertConsoleMfa(c);
    await next();
  });
  /** Writes: step-up first (the panel shows the code dialog on 403 step_up_required and repeats). */
  const write = async (c: C) => requireStepUp(deps, c);

  r.get('/console/step-up', async (c) => c.json(await stepUpState(deps, c)));
  r.post('/console/step-up', async (c) => {
    const b = await readJson(c, z.object({ code: z.string().min(4).max(40) }));
    return c.json(await consoleStepUp(deps, c, b.code));
  });

  r.get('/console/overview', async (c) => c.json(await consoleOverview(deps)));
  r.get('/console/clients', async (c) => {
    const q = parseQuery(
      c,
      z.object({
        q: z.string().max(120).optional(),
        status: z.string().max(20).optional(),
        regime: z.enum(['atalany', 'kata']).optional(),
        accountant: z.string().uuid().optional(),
        unpaid: z.enum(['1', 'true']).optional(),
        locked: z.enum(['1', 'true']).optional(),
        cancelled: z.enum(['1', 'true']).optional(),
        terminated: z.enum(['1', 'true']).optional(),
        cursor: z.string().max(40).optional(),
      }),
    );
    return c.json(await consoleClients(deps, { ...q, unpaid: Boolean(q.unpaid), locked: Boolean(q.locked), cancelled: Boolean(q.cancelled), terminated: Boolean(q.terminated) }));
  });
  r.get('/console/clients/:id', async (c) => c.json(await consoleClientHeader(deps, param(c, 'id'))));
  r.get('/console/clients/:id/preview', async (c) => c.json(await consolePreview(deps, c, param(c, 'id'))));
  r.get('/console/clients/:id/reveal', async (c) => {
    const q = parseQuery(c, z.object({ field: z.enum(['phone', 'adoazonositoJel']) }));
    const h = deps.limiter.hit(`console-reveal:${auth(c).userId}`, 60, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    return c.json({ field: q.field, value: await revealField(deps, c, param(c, 'id'), q.field) });
  });
  r.get('/console/clients/:id/documents/:docId', async (c) => {
    // opening a client's file from the console is audited; the file itself is served by /files/:id
    const id = param(c, 'id');
    const [d] = await deps.db.select().from(documents).where(and(eq(documents.id, param(c, 'docId')), eq(documents.clientId, id))).limit(1);
    if (!d?.currentVersionId) throw E.notFound();
    const [v] = await deps.db.select({ fileId: documentVersions.fileId }).from(documentVersions).where(eq(documentVersions.id, d.currentVersionId)).limit(1);
    await audit(deps.db, { action: 'admin.client.document_opened', actorUserId: auth(c).userId, actorRole: 'admin', targetType: 'document', targetId: d.id, clientId: id, ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    return c.json({ fileId: v?.fileId ?? null, title: d.title });
  });
  r.get('/console/clients/:id/:section', async (c) => {
    const s = c.req.param('section');
    if (!(CONSOLE_SECTIONS as readonly string[]).includes(s)) throw E.notFound();
    return c.json(await consoleSection(deps, param(c, 'id'), s as ConsoleSection));
  });

  // ---------------- writes ----------------
  r.patch('/console/clients/:id/profile', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ fields: z.record(z.string(), z.string().max(300).nullable()), confirmNavOverride: z.boolean().optional(), reason: reason.optional() }));
    return c.json(await patchProfile(deps, c, param(c, 'id'), b));
  });
  r.post('/console/clients/:id/price', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ kind: z.enum(PRICE_OVERRIDE_KINDS), amountHuf: z.number().int().optional(), percent: z.number().int().optional(), months: z.number().int().optional(), fromPeriod: iso, untilPeriod: iso.nullish(), reason }));
    return c.json(await addPriceOverride(deps, c, param(c, 'id'), b), 201);
  });
  r.delete('/console/clients/:id/price/:overrideId', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason }));
    await revokePriceOverride(deps, c, param(c, 'id'), param(c, 'overrideId'), b.reason);
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/fees', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ kind: z.string().max(40), amountHuf: z.number().int().optional(), note: z.string().max(300), reason }));
    return c.json(await addAdminFee(deps, c, param(c, 'id'), b), 201);
  });
  r.post('/console/clients/:id/fees/:chargeId/waive', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason }));
    await waiveFee(deps, c, param(c, 'id'), param(c, 'chargeId'), b.reason);
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/fees/:chargeId/charge-now', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason }));
    return c.json(await chargeFeeNow(deps, c, param(c, 'id'), param(c, 'chargeId'), b.reason));
  });
  r.post('/console/payments/:id/refund', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ amountHuf: z.number().int(), reason }));
    return c.json(await refundConsole(deps, c, param(c, 'id'), b));
  });
  r.post('/console/invoices/:id/retry', async (c) => {
    await write(c);
    await retryInvoiceConsole(deps, c, param(c, 'id'));
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/lock', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ mode: z.enum(['zarolva', 'feloldva']), until: iso.nullish(), reason }));
    return c.json(await setManualLock(deps, c, param(c, 'id'), b));
  });
  r.delete('/console/clients/:id/lock', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason }));
    return c.json(await setManualLock(deps, c, param(c, 'id'), null, b.reason));
  });
  r.post('/console/clients/:id/pause', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ from: iso, to: iso.nullish(), reason }));
    await consolePause(deps, c, param(c, 'id'), b);
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/pause/close', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ lastDay: iso, reason }));
    await consolePauseClose(deps, c, param(c, 'id'), b);
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/accountant', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ accountantId: z.string().uuid(), reason }));
    await reassignAccountant(deps, c, param(c, 'id'), b);
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/send-verification', async (c) => {
    await write(c);
    await sendClientCode(deps, c, param(c, 'id'), 'verify_email');
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/send-password-reset', async (c) => {
    await write(c);
    await sendClientCode(deps, c, param(c, 'id'), 'password_reset');
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/messages', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ body: z.string().max(5000) }));
    await messageClient(deps, c, param(c, 'id'), b.body);
    return c.json({ ok: true }, 201);
  });
  r.post('/console/announcements', async (c) => {
    const b = await readJson(
      c,
      z.object({
        title: z.string().max(200),
        body: z.string().max(2000),
        channels: z.object({ inApp: z.literal(true), push: z.boolean(), email: z.boolean() }),
        filter: z.object({ lifecycle: z.array(z.string().max(20)).max(4).optional(), regime: z.enum(['atalany', 'kata']).optional(), accountantId: z.string().uuid().optional(), clientIds: z.array(z.string().uuid()).max(500).optional() }).default({}),
        expectedCount: z.number().int().min(0).optional(),
      }),
    );
    // the dry run (no expectedCount) only counts; the send needs the step-up
    if (b.expectedCount !== undefined) await write(c);
    return c.json(await announce(deps, c, b));
  });
  r.post('/console/clients/:id/export', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason }));
    return c.json(await consoleExport(deps, c, param(c, 'id'), b.reason), 202);
  });
  r.get('/console/exports/:exportId', async (c) => {
    const [x] = await deps.db.select().from(gdprExports).where(eq(gdprExports.id, param(c, 'exportId'))).limit(1);
    if (!x) throw E.notFound();
    return c.json({ id: x.id, status: x.status, expiresAt: x.expiresAt?.toISOString() ?? null });
  });
  r.get('/console/exports/:exportId/download', async (c) => {
    await write(c);
    const [x] = await deps.db.select().from(gdprExports).where(eq(gdprExports.id, param(c, 'exportId'))).limit(1);
    if (!x || x.status !== 'kesz' || !x.fileId || !x.expiresAt || x.expiresAt < deps.now()) throw E.notFound('Ez a másolat már nem tölthető le.');
    const [f] = await deps.db.select().from(files).where(eq(files.id, x.fileId)).limit(1);
    if (!f) throw E.notFound();
    const [cl] = await deps.db.select({ id: clients.id }).from(clients).where(eq(clients.userId, x.userId)).limit(1);
    const src = await deps.storage.readStream(f);
    await audit(deps.db, { action: 'admin.client.export_downloaded', actorUserId: auth(c).userId, actorRole: 'admin', targetType: 'gdpr_export', targetId: x.id, clientId: cl?.id ?? null, ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    c.header('Content-Type', 'application/zip');
    c.header('Content-Length', String(src.size));
    c.header('Content-Disposition', `attachment; filename="ugyfel-adatai-${x.createdAt.toISOString().slice(0, 10)}.zip"`);
    return stream(c, async (s) => {
      s.onAbort(() => {
        src.stream.destroy();
      });
      for await (const chunk of src.stream) await s.write(chunk as Uint8Array);
    });
  });
  r.post('/console/clients/:id/terminate', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ kind: z.enum(TERMINATION_KINDS), subReason: z.enum(TERMINATION_SUB_REASONS).optional(), when: z.enum(TERMINATION_CLIENT_WHEN).optional(), reason, effectiveOn: iso.optional() }));
    return c.json(await terminateClient(deps, c, param(c, 'id'), b));
  });
  r.post('/console/clients/:id/reactivate', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason }));
    await reactivateClient(deps, c, param(c, 'id'), b.reason);
    return c.json({ ok: true });
  });
  r.post('/console/clients/:id/anonymize', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ reason, confirmName: z.string().max(200) }));
    return c.json({ ok: true, counts: await anonymizeFromConsole(deps, c, param(c, 'id'), b) });
  });
}
