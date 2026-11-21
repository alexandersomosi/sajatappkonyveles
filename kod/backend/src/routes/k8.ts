// k8 ALAP-B routes, each group registered by ONE line:
//  - client (clientRoutes): GET /client/billing, POST /client/billing/transfer
//  - admin console (registerAdminConsoleRoutes → TOTP; writes need the step-up): /admin/console/transfers…,
//    /admin/console/switches/fizetes
//  - admin (adminRoutes): GET /admin/demo-outbox/:id/html – the HTML image of a DEMO mail on its own page with a strict
//    CSP (the panel's CSP forbids frames: frame-src 'none'), DEMO only.
import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { CALLBACK_OPEN_STATUSES } from '../_shared/enums.js';
import { LOCK_ELOFIZETES_VISSZAHIVAS_UTAN } from '../_shared/k8.js';
import type { Deps } from '../deps.js';
import { callbackRequests, demoOutbox, users } from '../db/schema.js';
import { auditC } from '../audit.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { hmacHex } from '../lib/crypto.js';
import { clientOfUser, type ClientRow } from '../services/people.js';
import { requireStepUp } from '../services/konzol.js';
import { adminTransfers, adminTransferSummary, chooseTransfer, clientBillingView, fizetesKapcsolok, markTransferPaid, resendTransfer, setFizetesKapcsolok } from '../services/atutalas.js';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' });

/**
 * k8 (owner 11-20): the card / transfer is asked only AFTER the optional callback – while the client has an open callback
 * during the onboarding, the payment step waits (409 step_locked). An active client (card change) is never locked.
 */
export async function assertNoOpenCallback(deps: Deps, cl: ClientRow): Promise<void> {
  if (cl.lifecycle !== 'bekotes_alatt') return;
  const [open] = await deps.db
    .select({ id: callbackRequests.id })
    .from(callbackRequests)
    .where(and(eq(callbackRequests.clientId, cl.id), inArray(callbackRequests.status, [...CALLBACK_OPEN_STATUSES])))
    .limit(1);
  if (open) throw E.stepLocked(await deps.content.render(LOCK_ELOFIZETES_VISSZAHIVAS_UTAN, {}));
}

export function registerClientK8Routes(r: Hono<Env>, deps: Deps): void {
  const client = (c: C) => clientOfUser(deps.db, auth(c).userId);

  r.get('/billing', async (c) => c.json(await clientBillingView(deps, await client(c))));

  r.post('/billing/transfer', async (c) => {
    const b = await readJson(c, z.strictObject({ purpose: z.enum(['subscribe', 'switch']) }));
    const cl = await client(c);
    if (b.purpose === 'subscribe') {
      const { assertStepOpen } = await import('../services/onboarding.js');
      await assertStepOpen(deps, deps.db, cl, 'elofizetes');
      await assertNoOpenCallback(deps, cl);
      // SPEC §28.K.7: with employees / EFO nothing is asked before the accountant's decision (like the card start)
      const { blocksActivation, employerRow } = await import('../services/alkalmazott.js');
      if (blocksActivation(await employerRow(deps.db, cl.id))) {
        const { accountantParams } = await import('../notify/notify.js');
        throw E.stepLocked(await deps.content.render('alkalmazott.subscription_lock', await accountantParams(deps.db, cl.accountantId)));
      }
    }
    const h = deps.limiter.hit(`substart:${cl.id}`, 20, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const v = await chooseTransfer(deps, cl, b.purpose, { userId: cl.userId });
    await auditC(c, deps.db, 'subscription.transfer_chosen', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { purpose: b.purpose } });
    return c.json(v);
  });
}

export function registerAdminConsoleK8Routes(r: Hono<Env>, deps: Deps): void {
  const write = async (c: C) => requireStepUp(deps, c);

  r.get('/console/transfers', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(['fizetett', 'var', 'kesik', 'hiba']).optional(), clientId: z.string().uuid().optional() }));
    return c.json({ items: await adminTransfers(deps, q) });
  });
  r.get('/console/transfers/summary', async (c) => c.json(await adminTransferSummary(deps)));
  r.post('/console/transfers/:id/paid', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ paidOn: iso, amountHuf: z.number().int().positive(), reason: z.string().max(500) }));
    return c.json(await markTransferPaid(deps, param(c, 'id'), b, auth(c).userId));
  });
  r.post('/console/transfers/:id/resend', async (c) => {
    await write(c);
    await resendTransfer(deps, param(c, 'id'), auth(c).userId);
    return c.json({ ok: true });
  });
  r.get('/console/switches/fizetes', async (c) => c.json(await fizetesKapcsolok(deps, deps.db)));
  r.put('/console/switches/fizetes', async (c) => {
    await write(c);
    const b = await readJson(c, z.object({ atutalas: z.boolean().optional(), kesesLeallit: z.boolean().optional(), kozlemeny: z.enum(['havi', 'allando']).optional(), reason: z.string().max(500).default('') }));
    const { reason, ...patch } = b;
    const out = await setFizetesKapcsolok(deps, patch, { userId: auth(c).userId, reason });
    // a switch that turns the late lock off (or on) is felt at once, not at tomorrow's check
    const { jobServiceLockCheck } = await import('../services/zarolas.js');
    await jobServiceLockCheck(deps).catch(() => 0);
    return c.json(out);
  });
}

/** Signed, 5-minute link of one DEMO mail's HTML image (the panel opens it in a new tab – no Bearer header there). */
function demoMailToken(deps: Deps, id: string, exp: number): string {
  return `${id}.${exp}.${hmacHex(deps.cfg.auditIpSalt, `demo-level:${id}:${exp}`).slice(0, 32)}`;
}

/**
 * GET /admin/demo-outbox/:id/html → { url } (same masking as the list: another staff member's sign-in mail stays hidden).
 * DEMO only (MAIL_MODE=demo).
 */
export function registerAdminDemoMailHtml(r: Hono<Env>, deps: Deps): void {
  r.get('/demo-outbox/:id/html', async (c) => {
    if (deps.mailer.mode !== 'demo') throw E.notFound();
    const [x] = await deps.db.select().from(demoOutbox).where(eq(demoOutbox.id, param(c, 'id'))).limit(1);
    if (!x?.bodyHtml) throw E.notFound('Ennek a levélnek nincs HTML-képe (régebbi levél).');
    const me = auth(c);
    const staff = await deps.db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(inArray(users.role, ['accountant', 'admin', 'csapat']));
    const hashOf = (email: string) => hmacHex(deps.cfg.auditIpSalt, `mail:${email}`).slice(0, 24);
    const masked = new Set(staff.filter((u) => u.id !== me.userId).map((u) => hashOf(u.email)));
    const SIGN_IN = new Set(['auth_email_code', 'auth_password_reset_code', 'auth_staff_invite', 'auth_staff_invite_csapat']);
    if (masked.has(x.toHash) && (x.template === null || SIGN_IN.has(x.template))) throw E.notFound();
    const exp = deps.now().getTime() + 5 * 60_000;
    return c.json({ url: `/api/v1/demo-level/${demoMailToken(deps, x.id, exp)}` });
  });
}

/** Public (token in the path): the HTML image with its own strict CSP (inline styles, https images, nothing else). */
export function demoMailPublicRoutes(deps: Deps) {
  const r = new Hono<Env>();
  r.get('/demo-level/:token', async (c) => {
    if (deps.mailer.mode !== 'demo' || deps.cfg.appEnv !== 'demo') throw E.notFound();
    const m = /^([0-9a-f-]{36})\.(\d{10,16})\.([0-9a-f]{32})$/.exec(c.req.param('token'));
    if (!m) throw E.notFound();
    const [, id, expS, sig] = m;
    const exp = Number(expS);
    if (exp < deps.now().getTime() || demoMailToken(deps, id!, exp) !== `${id}.${expS}.${sig}`) throw E.notFound('A link lejárt. Nyisd meg újra a DEMO-postafiókból.');
    const [x] = await deps.db.select({ html: demoOutbox.bodyHtml }).from(demoOutbox).where(eq(demoOutbox.id, id!)).limit(1);
    if (!x?.html) throw E.notFound();
    c.header('Content-Security-Policy', "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex');
    return c.html(x.html);
  });
  return r;
}
