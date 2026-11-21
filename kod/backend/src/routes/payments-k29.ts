// SPEC §29.1 / §29.2 / §29.4.4 routes (B1). Registered with ONE line each:
//  - clientRoutes (before the §28 routes): registerClientPaymentsK29 – card consent, hosted start, result polling,
//    "Fizesd ki", one-off fees with the saved card, payments + invoices list, taxpayer lookup, business identity.
//    The legacy SimplePay bodies ({acceptedDeclarations} / {platform: web|android|ios}) fall through (next()).
//  - (POST /acc/clients/:id/adoszam already exists since §28.K.9: routes/acc-k28.ts)
//  - adminRoutes: registerAdminPaymentsK29 – /admin/k29/{subscriptions,payments,fee-invoices,system}.
//  - app (/api/v1): paymentsPublicK29Routes – the Stripe back URL, the DEMO pay page, the Stripe webhook.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import brand from '../_shared/brand.json' with { type: 'json' };
import { BUSINESS_IDENTITY_SOURCES, TAX_REGIME_ANSWERS, TAX_STATUSES, YES_NO_DONTKNOW } from '../_shared/enums.js';
import {
  INVOICE_STATUSES_K29,
  PAYMENT_KINDS,
  PAYMENT_SCREEN_TEXTS,
  PAYMENT_STATUSES_K29,
  PAYMENT_RULES,
  type AdminFeeInvoiceRow,
  type AdminPaymentRow,
  type AdminPaymentsSystemView,
  type AdminSubscriptionRowK29,
  type FeeInvoiceItemK29,
} from '../_shared/k29.js';
import { FEE_KIND_LABELS } from '../_shared/bekotes.js';
import type { Deps } from '../deps.js';
import { cardRegistrations, clients, feeInvoices, paymentMethods, payments, stripeEvents, subscriptions, systemState } from '../db/schema.js';
import { auditC } from '../audit.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { ApiError, E } from '../lib/errors.js';
import { log } from '../log.js';
import { fmtHuf } from '../payments/huf.js';
import { retryInvoice } from '../payments/invoices.js';
import { clientOfUser, clientName } from '../services/people.js';
import {
  appOriginOfKey,
  applyDemoChoice,
  cardConsentView,
  cardLabel,
  cardView,
  checkoutResult,
  clientPaymentItems,
  dueView,
  effectiveMonthlyAmount,
  handleStripeWebhook,
  invoiceItemOf,
  isK29Provider,
  startDuePayment,
  startFeePaymentK29,
  startSubscriptionK29,
  STRIPE_BAD_PER_HOUR,
  type PaymentRow,
} from '../services/payments.js';
import { lookupTaxpayer, saveBusinessIdentity } from '../services/adoszam-kereso.js';

const platformSchema = z.enum(['app', 'web']);
const originSchema = z.string().trim().max(200).optional();
const consentFields = { consentVersion: z.string().max(40), consentSha256: z.string().regex(/^[0-9a-f]{64}$/) };

async function rawBody(c: C): Promise<Record<string, unknown> | null> {
  try {
    const t = (await c.req.text()) || '{}';
    const v = JSON.parse(t) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// =====================================================================================================================
// /client
// =====================================================================================================================
export function registerClientPaymentsK29(r: Hono<Env>, deps: Deps): void {
  const client = (c: C) => clientOfUser(deps.db, auth(c).userId);
  const meta = (c: C) => ({ ipHmac: c.get('ipHmac'), ua: c.get('ua') });

  r.get('/subscription/consent', async (c) => {
    const q = parseQuery(c, z.object({ purpose: z.enum(['subscribe', 'card_update', 'restart', 'fizesd_ki']).default('subscribe') }));
    return c.json(await cardConsentView(deps, await client(c), q.purpose));
  });

  r.post('/subscription/start', async (c, next) => {
    const raw = await rawBody(c);
    const k29Body = Boolean(raw && 'consentVersion' in raw);
    if (!k29Body) {
      // an old app build (SimplePay declarations): only while SimplePay or the old DEMO flow is the provider
      if (deps.cfg.payment.provider === 'stripe') throw new ApiError(409, 'app_update_required', 'Frissítsd az appot, és add meg újra a kártyádat.');
      return next();
    }
    if (!isK29Provider(deps)) {
      if (deps.cfg.payment.provider === 'simplepay') throw new ApiError(409, 'app_update_required', 'Ehhez a fizetéshez a régi kártyás lépés kell. Frissítsd az oldalt.');
      throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
    }
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ platform: platformSchema, purpose: z.enum(['subscribe', 'card_update', 'restart']).default('subscribe'), ...consentFields, returnOrigin: originSchema }));
    const { assertStepOpen } = await import('../services/onboarding.js');
    if (b.purpose !== 'card_update') await assertStepOpen(deps, deps.db, cl, 'elofizetes');
    // k8 (owner 11-20): the card only after the optional callback – an open callback during the onboarding waits
    if (b.purpose !== 'card_update') {
      const { assertNoOpenCallback } = await import('./k8.js');
      await assertNoOpenCallback(deps, cl);
    }
    // SPEC §28.K.7: with employees / EFO no card is charged before the accountant's decision.
    const { blocksActivation, employerRow } = await import('../services/alkalmazott.js');
    if (b.purpose !== 'card_update' && blocksActivation(await employerRow(deps.db, cl.id))) {
      const { accountantParams } = await import('../notify/notify.js');
      throw E.stepLocked(await deps.content.render('alkalmazott.subscription_lock', await accountantParams(deps.db, cl.accountantId)));
    }
    const h = deps.limiter.hit(`substart:${cl.id}`, PAYMENT_RULES.startPerHour, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    return c.json(await startSubscriptionK29(deps, cl, b, meta(c)));
  });

  r.get('/payments/checkout/:cs', async (c) => {
    const cs = c.req.param('cs');
    if (!/^[A-Za-z0-9_-]{8,200}$/.test(cs)) throw E.notFound();
    const q = parseQuery(c, z.object({ megszakitva: z.string().optional() }));
    return c.json(await checkoutResult(deps, await client(c), cs, { cancelled: q.megszakitva === '1' }));
  });

  r.get('/payments/due', async (c) => c.json(await dueView(deps, await client(c))));
  r.post('/payments/due/pay', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ platform: platformSchema, returnOrigin: originSchema, consentVersion: z.string().max(40).optional(), consentSha256: z.string().regex(/^[0-9a-f]{64}$/).optional() }));
    const h = deps.limiter.hit(`substart:${cl.id}`, PAYMENT_RULES.startPerHour, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    return c.json(await startDuePayment(deps, cl, b, meta(c)));
  });

  r.post('/fees/:id/pay', async (c, next) => {
    const raw = await rawBody(c);
    const k29Body = Boolean(raw && 'useSavedCard' in raw);
    if (!k29Body) {
      if (deps.cfg.payment.provider !== 'stripe') return next();
      // an old app build under Stripe: the hosted page, answered in the old shape (FeePayStart)
      const cl = await client(c);
      const res = await startFeePaymentK29(deps, cl, param(c, 'id'), { platform: raw?.platform === 'web' ? 'web' : 'app', useSavedCard: false });
      if (res.result !== 'atiranyitas') throw E.conflict('Ezt a díjat most nem lehet kifizetni.');
      return c.json({ paymentUrl: res.url, orderRef: res.paymentId, chargeId: res.chargeId, amountHuf: res.amountHuf, demo: false });
    }
    if (!isK29Provider(deps)) return next();
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ platform: platformSchema, useSavedCard: z.boolean(), returnOrigin: originSchema }));
    const h = deps.limiter.hit(`feepay:${cl.id}`, 20, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    return c.json(await startFeePaymentK29(deps, cl, param(c, 'id'), b));
  });

  r.get('/payments', async (c) => c.json({ items: await clientPaymentItems(deps, await client(c)) }));

  /** Every fee invoice incl. storno / correction (Fiók → Díjak és számlák). */
  r.get('/fee-invoices/k29', async (c) => {
    const cl = await client(c);
    const rows = await deps.db.select().from(feeInvoices).where(and(eq(feeInvoices.clientId, cl.id), inArray(feeInvoices.status, ['kiallitva', 'sztorno']))).orderBy(desc(feeInvoices.createdAt));
    const items: FeeInvoiceItemK29[] = rows.map((inv) => {
      const st = rows.find((x) => x.stornoOf === inv.id && x.kind === 'sztorno' && x.status === 'kiallitva') ?? null;
      return invoiceItemOf(inv, st, inv.line?.megnevezes ?? null);
    });
    return c.json({ items });
  });

  // ---------- §29.4.4 taxpayer lookup + business identity ----------
  r.post('/onboarding/taxpayer-lookup', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ torzsszam: z.string().trim().max(20) }));
    return c.json(await lookupTaxpayer(deps, cl, b.torzsszam));
  });
  const seatSchema = z.strictObject({
    zip: z.string().trim().regex(/^\d{4}$/, { error: '4 számjegy.' }),
    city: z.string().trim().min(1).max(80),
    district: z.string().trim().max(10).nullable().optional(),
    streetName: z.string().trim().max(120),
    streetType: z.string().trim().max(40),
    houseNumber: z.string().trim().max(40),
    building: z.string().trim().max(20).nullable().optional(),
    staircase: z.string().trim().max(20).nullable().optional(),
    floor: z.string().trim().max(20).nullable().optional(),
    door: z.string().trim().max(20).nullable().optional(),
  });
  r.post('/onboarding/business-identity', async (c) => {
    const cl = await client(c);
    const b = await readJson(
      c,
      z.strictObject({
        source: z.enum(BUSINESS_IDENTITY_SOURCES),
        adoszam: z.string().trim().max(13).nullable(),
        name: z.string().trim().min(1, { error: 'Kötelező.' }).max(160),
        seat: seatSchema,
        alanyiMentes: z.enum(YES_NO_DONTKNOW),
        evSinceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(),
        activityText: z.string().trim().max(300).optional(),
        activityAnswer: z.enum(['kiskereskedelem', 'lista80', 'egyeb']).optional(),
        taxRegimeAnswer: z.enum(TAX_REGIME_ANSWERS).optional(),
        taxStatus: z.enum(TAX_STATUSES).optional(),
      }),
    );
    return c.json(await saveBusinessIdentity(deps, cl, b as never));
  });
}

// =====================================================================================================================
// /admin (read views of the payments; the WRITE actions are in the owner console, §29.9, with step-up)
// =====================================================================================================================
const providerLabel = (provider: string, mode: string) => (provider === 'stripe' ? (mode === 'live' ? 'Stripe éles' : 'Stripe teszt') : provider === 'demo' ? 'DEMO' : 'SimplePay');

function stripeUrl(p: Pick<PaymentRow, 'provider' | 'mode' | 'stripePaymentIntentId'>): string | null {
  if (p.provider !== 'stripe' || !p.stripePaymentIntentId || !p.stripePaymentIntentId.startsWith('pi_')) return null;
  return `https://dashboard.stripe.com/${p.mode === 'live' ? '' : 'test/'}payments/${p.stripePaymentIntentId}`;
}

export function registerAdminPaymentsK29(r: Hono<Env>, deps: Deps): void {
  r.get('/k29/subscriptions', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(['incomplete', 'active', 'past_due', 'suspended', 'canceled']).optional(), problem: z.enum(['hitelesites_kell']).optional() }));
    const rows = await deps.db
      .select({ s: subscriptions, c: clients })
      .from(subscriptions)
      .innerJoin(clients, eq(clients.id, subscriptions.clientId))
      .where(q.status ? eq(subscriptions.status, q.status) : sql`true`)
      .orderBy(desc(subscriptions.updatedAt))
      .limit(500);
    const auths = await deps.db.select({ sub: payments.subscriptionId }).from(payments).where(eq(payments.status, 'hitelesites_kell'));
    const authSet = new Set(auths.map((a) => a.sub));
    const items: AdminSubscriptionRowK29[] = [];
    for (const x of rows) {
      const open = authSet.has(x.s.id);
      if (q.problem === 'hitelesites_kell' && !open) continue;
      let label: string | null = null;
      const [pm] = await deps.db.select().from(paymentMethods).where(and(eq(paymentMethods.clientId, x.c.id), eq(paymentMethods.status, 'aktiv'))).orderBy(desc(paymentMethods.createdAt)).limit(1);
      if (pm) label = cardView(pm, deps.now()).label;
      else if (x.s.cardRegistrationId) {
        const [reg] = await deps.db.select().from(cardRegistrations).where(eq(cardRegistrations.id, x.s.cardRegistrationId)).limit(1);
        if (reg?.status === 'aktiv') label = reg.mode === 'demo' ? PAYMENT_SCREEN_TEXTS.demoCardLabel : (reg.cardMask ?? null);
      }
      const mode = x.s.provider === 'stripe' ? (x.s.mode === 'live' ? 'live' : 'test') : x.s.mode === 'demo' ? 'demo' : x.s.mode === 'live' ? 'live' : 'sandbox';
      const next = x.s.currentPeriodEnd ?? null;
      items.push({
        id: x.s.id,
        client: { id: x.c.id, name: clientName(x.c) },
        provider: x.s.provider,
        mode,
        providerLabel: providerLabel(x.s.provider, mode),
        status: x.s.status,
        currentPeriodEnd: x.s.currentPeriodEnd,
        nextChargeAt: x.s.cancelAtPeriodEnd || x.s.status === 'canceled' ? null : (x.s.nextChargeAt?.toISOString() ?? null),
        nextChargeHuf: next ? (await effectiveMonthlyAmount(deps, deps.db, x.c.id, next)).amountHuf : 0,
        cardLabel: label,
        failedAttempts: x.s.failedAttempts,
        lastFailureCode: x.s.lastFailureCode,
        graceUntil: x.s.graceUntil,
        cancelAtPeriodEnd: x.s.cancelAtPeriodEnd,
        billingMethod: x.s.billingMethod,
        openAuthPayment: open,
        isTest: x.c.isTest,
      });
    }
    return c.json({ items });
  });

  r.get('/k29/payments', async (c) => {
    const q = parseQuery(
      c,
      z.object({
        status: z.enum(PAYMENT_STATUSES_K29).optional(),
        kind: z.enum(PAYMENT_KINDS).optional(),
        provider: z.enum(['stripe', 'demo', 'simplepay']).optional(),
        clientId: z.string().uuid().optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    );
    const rows = await deps.db
      .select({ p: payments, c: clients })
      .from(payments)
      .innerJoin(clients, eq(clients.id, payments.clientId))
      .where(
        and(
          q.status ? eq(payments.status, q.status) : sql`true`,
          q.kind ? eq(payments.kind, q.kind) : sql`${payments.kind} <> 'kartya'`,
          q.provider ? eq(payments.provider, q.provider) : sql`true`,
          q.clientId ? eq(payments.clientId, q.clientId) : sql`true`,
          q.from ? gte(payments.createdAt, new Date(`${q.from}T00:00:00Z`)) : sql`true`,
          q.to ? lt(payments.createdAt, new Date(`${q.to}T23:59:59Z`)) : sql`true`,
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(500);
    const invIds = rows.map((x) => x.p.feeInvoiceId).filter((x): x is string => Boolean(x));
    const invs = invIds.length ? await deps.db.select().from(feeInvoices).where(inArray(feeInvoices.id, invIds)) : [];
    const items: AdminPaymentRow[] = rows.map(({ p, c: cl }) => {
      const inv = invs.find((i) => i.id === p.feeInvoiceId) ?? null;
      return {
        id: p.id,
        client: { id: cl.id, name: clientName(cl) },
        kind: p.kind,
        provider: p.provider,
        mode: p.mode,
        amountHuf: p.amountHuf,
        status: p.status,
        initiated: p.initiated,
        offSession: p.offSession,
        period: p.periodStart && p.periodEnd ? { start: p.periodStart, end: p.periodEnd } : null,
        cardLabel: p.provider === 'demo' && p.cardLast4 ? PAYMENT_SCREEN_TEXTS.demoCardLabel : cardLabel(p.cardBrand, p.cardLast4),
        failureCode: p.failureCode,
        declineCode: p.declineCode,
        refundedHuf: p.refundedHuf,
        refundableHuf: p.status === 'sikeres' ? p.amountHuf - p.refundedHuf : 0,
        disputeStatus: p.disputeStatus,
        stripeUrl: stripeUrl(p),
        invoice: inv ? { id: inv.id, number: inv.number, status: inv.status, kind: inv.kind } : null,
        createdAt: p.createdAt.toISOString(),
        succeededAt: p.succeededAt?.toISOString() ?? null,
      };
    });
    return c.json({ items });
  });

  r.get('/k29/fee-invoices', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(INVOICE_STATUSES_K29).optional(), clientId: z.string().uuid().optional() }));
    const rows = await deps.db
      .select({ f: feeInvoices, c: clients })
      .from(feeInvoices)
      .innerJoin(clients, eq(clients.id, feeInvoices.clientId))
      .where(and(q.status ? eq(feeInvoices.status, q.status) : sql`true`, q.clientId ? eq(feeInvoices.clientId, q.clientId) : sql`true`))
      .orderBy(desc(feeInvoices.createdAt))
      .limit(500);
    const items: AdminFeeInvoiceRow[] = rows.map(({ f, c: cl }) => ({
      id: f.id,
      client: { id: cl.id, name: clientName(cl) },
      kind: f.kind,
      status: f.status,
      number: f.number,
      issuedOn: f.issuedOn,
      amountHuf: f.amountHuf,
      provider: f.provider,
      account: f.providerAccount ?? (f.demo ? 'demo' : '-'),
      externalKey: f.externalKey,
      attempts: f.attempts,
      nextRetryAt: f.nextRetryAt?.toISOString() ?? null,
      errorCode: f.lastErrorCode,
      error: f.status === 'hiba' || f.status === 'folyamatban' ? f.error : null,
      fileId: f.pdfFileId,
      paymentId: f.paymentId,
      stornoOf: f.stornoOf,
      createdAt: f.createdAt.toISOString(),
    }));
    return c.json({ items });
  });

  /** "Újrapróbálom" from /admin/dijszamlak (queries first). The console has the same action with step-up. */
  r.post('/k29/fee-invoices/:id/retry', async (c) => {
    const id = param(c, 'id');
    const res = await retryInvoice(deps, id, auth(c).userId);
    await auditC(c, deps.db, 'admin.fee_invoice.retry', { targetType: 'fee_invoice', targetId: id, details: { result: res } });
    return c.json({ result: res });
  });

  r.get('/k29/system', async (c) => {
    const state = await deps.db.select().from(systemState).where(inArray(systemState.key, ['stripe.last_webhook', 'payments.reconcile']));
    const get = (k: string) => state.find((s) => s.key === k)?.value as { at?: string } | undefined;
    const [unproc] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(stripeEvents).where(isNull(stripeEvents.processedAt));
    const [stuck] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(stripeEvents).where(and(isNull(stripeEvents.processedAt), sql`${stripeEvents.attempts} >= ${PAYMENT_RULES.stuckEventAttempts}`));
    const [invErr] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(feeInvoices).where(eq(feeInvoices.status, 'hiba'));
    const [invProg] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(feeInvoices).where(eq(feeInvoices.status, 'folyamatban'));
    const [probs] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(payments).where(inArray(payments.status, ['hitelesites_kell', 'bizonytalan']));
    const [disp] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(payments).where(sql`${payments.disputeStatus} is not null`);
    const s = deps.cfg.payment.stripe;
    const view: AdminPaymentsSystemView = {
      paymentProvider: deps.cfg.payment.provider,
      stripe: s ? s.mode : 'off',
      webhookSecret: s?.webhookSecret ? 'megvan' : 'hianyzik',
      lastWebhookAt: get('stripe.last_webhook')?.at ?? null,
      unprocessedEvents: Number(unproc?.n ?? 0),
      stuckEvents: Number(stuck?.n ?? 0),
      lastReconcileAt: get('payments.reconcile')?.at ?? null,
      invoiceMode: deps.cfg.invoice.mode,
      szamlazzhuAccount: deps.cfg.invoice.szamlazzhuAccount,
      openInvoiceErrors: Number(invErr?.n ?? 0),
      invoicesInProgress: Number(invProg?.n ?? 0),
      openPaymentProblems: Number(probs?.n ?? 0),
      disputes: Number(disp?.n ?? 0),
    };
    return c.json(view);
  });
}

// =====================================================================================================================
// public: back URL, DEMO pay page, webhook
// =====================================================================================================================
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let geistCss: { dir: string; css: string } | null = null;
function geistFaces(fontDir: string): string {
  if (geistCss?.dir === fontDir) return geistCss.css;
  let css = '';
  try {
    const face = (file: string, weight: string) => `@font-face{font-family:Geist;font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${readFileSync(join(fontDir, file)).toString('base64')}) format('truetype')}`;
    css = face('Geist-Regular.ttf', '100 500') + face('Geist-SemiBold.ttf', '600 900');
  } catch {
    css = '';
  }
  geistCss = { dir: fontDir, css };
  return css;
}

const CEL = new Set(['elofizetes', 'dij', 'fizesd-ki']);

export function paymentsPublicK29Routes(deps: Deps) {
  const r = new Hono<Env>();

  /** §29.1.3 back URL: changes nothing in the DB; 302 to the app (deep link) or to the web origin the client started on. */
  r.get('/payments/stripe/vissza', (c) => {
    const p = c.req.query('p') === 'app' ? 'app' : 'web';
    const celRaw = c.req.query('cel') ?? 'elofizetes';
    const cel = CEL.has(celRaw) ? celRaw : 'elofizetes';
    const csRaw = c.req.query('cs') ?? '';
    const pid = c.req.query('pid') ?? '';
    const cs = /^[A-Za-z0-9_-]{8,200}$/.test(csRaw) ? csRaw : /^[0-9a-f-]{36}$/.test(pid) ? pid : '';
    const cancelled = c.req.query('megszakitva') === '1';
    const qs = `cs=${encodeURIComponent(cs)}&cel=${encodeURIComponent(cel)}${cancelled ? '&megszakitva=1' : ''}`;
    const target = p === 'app' ? `kezjegy://elofizetes/eredmeny?${qs}` : `${appOriginOfKey(deps, c.req.query('o'))}/elofizetes/eredmeny?${qs}`;
    return c.redirect(target, 302);
  });

  // ---------- §29.1.12 DEMO pay page (payments rows) ----------
  r.get('/payments/demo/fizetes', async (c) => {
    if (deps.cfg.appEnv !== 'demo') throw E.notFound();
    const id = c.req.query('p') ?? '';
    if (!/^[0-9a-f-]{36}$/.test(id)) throw E.notFound();
    const [p] = await deps.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!p || p.provider !== 'demo') throw E.notFound();
    return demoPage(c, deps, p, c.req.query('lepes') === 'auth');
  });

  r.post('/payments/demo/fizetes', async (c) => {
    if (deps.cfg.appEnv !== 'demo') throw E.notFound();
    const form = await c.req.parseBody();
    const id = String(form.p ?? '');
    const v = String(form.valasztas ?? '');
    if (!/^[0-9a-f-]{36}$/.test(id) || !['ok', 'auth', 'auth_ok', 'fail', 'cancel'].includes(v)) throw E.notFound();
    const [p] = await deps.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!p || p.provider !== 'demo') throw E.notFound();
    if (v === 'auth') return c.redirect(`/api/v1/payments/demo/fizetes?p=${id}&lepes=auth`, 303);
    const after = await applyDemoChoice(deps, id, v as 'ok' | 'auth_ok' | 'fail' | 'cancel');
    const back = `/api/v1/payments/stripe/vissza?p=${p.platform === 'app' ? 'app' : 'web'}&o=${encodeURIComponent(p.returnOrigin ?? '')}&cel=${encodeURIComponent(p.cel ?? 'elofizetes')}&pid=${p.id}&cs=${encodeURIComponent(after?.stripeCheckoutSessionId ?? p.stripeCheckoutSessionId ?? p.id)}${v === 'cancel' ? '&megszakitva=1' : ''}`;
    return c.redirect(back, 303);
  });

  // ---------- §29.1.8 Stripe webhook ----------
  r.post('/webhooks/stripe', async (c) => {
    const bad = deps.limiter.peek(`stripe-bad:${c.get('ipHmac') ?? '-'}`, STRIPE_BAD_PER_HOUR);
    if (!bad.ok) {
      c.header('Retry-After', String(Math.ceil(bad.retryAfterSec)));
      return c.json({ error: 'rate_limited' }, 429);
    }
    const raw = await c.req.text();
    if (raw.length > PAYMENT_RULES.webhookMaxBytes) return c.json({ error: 'too_large' }, 413);
    const res = await handleStripeWebhook(deps, raw, { 'stripe-signature': c.req.header('stripe-signature') }, { ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    return c.json(res.body, res.status);
  });

  return r;
}

function demoPage(c: C, deps: Deps, p: PaymentRow, authStep: boolean) {
  const origins = (deps.cfg.appOrigins ?? []).map((o) => o.origin).join(' ');
  c.header('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; font-src data:; form-action 'self' ${origins} kezjegy:; frame-ancestors 'none'`);
  const done = ['sikeres', 'sikertelen', 'megszakitva', 'duplikalt'].includes(p.status);
  const heading = p.kind === 'kartya' ? 'kártyacsere' : p.kind === 'egyszeri' ? 'egyszeri díj' : 'havidíj';
  const amount = p.kind === 'kartya' ? 'Nem vonunk le pénzt' : `${fmtHuf(p.amountHuf)} Ft`;
  const sentence =
    p.kind === 'kartya'
      ? 'Csak a kártyádat mentjük el a következő havidíjakhoz.'
      : p.kind === 'egyszeri'
        ? 'Egyszeri díj: csak ezt az összeget vonjuk le.'
        : 'A kártyádat elmentjük, és utána havonta egyszer vonjuk le a havidíjat. Minden levonás előtt 3 nappal szólunk.';
  const btn = (v: string, label: string, cls: string) => `<form method="post" action="/api/v1/payments/demo/fizetes"><input type="hidden" name="p" value="${esc(p.id)}"><input type="hidden" name="valasztas" value="${v}"><button class="${cls}" type="submit">${esc(label)}</button></form>`;
  const body = done
    ? `<p><strong>Ez a fizetés már lezárult.</strong></p>`
    : authStep
      ? `<p><strong>A bankod megerősítést kér (3DS) – DEMO.</strong></p>${btn('auth_ok', 'Megerősítem', 'ok')}${btn('fail', 'Elutasítom', 'no')}`
      : `${btn('ok', 'Sikeres fizetés szimulálása', 'ok')}${btn('auth', 'Hitelesítést kér (3DS) szimulálása', 'no')}${btn('fail', 'Elutasított kártya szimulálása', 'no')}${btn('cancel', 'Megszakítom', 'no')}`;
  return c.html(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEMO fizetés</title>
<style>${geistFaces(deps.cfg.fontDir)}body{margin:0;background:#E4E8F3;font-family:Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-variant-numeric:tabular-nums;color:#10152B}main{max-width:440px;margin:0 auto;padding:16px}
.b{background:#B42318;color:#fff;font-weight:700;padding:14px 16px;border-radius:12px;font-size:15px;line-height:1.4}.s{background:#fff;border-radius:18px;padding:20px;margin-top:14px}
h1{font-size:22px;margin:0 0 6px}.a{font-size:34px;font-weight:800;margin:10px 0}p{line-height:1.5}button{width:100%;min-height:48px;border-radius:999px;border:0;font-size:16px;font-weight:600;margin-top:10px;cursor:pointer}
.ok{background:#1428DB;color:#fff}.no{background:#fff;color:#1226B8;border:2px solid #1428DB}small{color:#505873}</style></head><body><main>
<div class="b">${esc(PAYMENT_SCREEN_TEXTS.demoBanner)}</div>
<div class="s"><h1>${esc(brand.name)} – ${esc(heading)}</h1><div class="a">${esc(amount)}</div>
<p>${esc(sentence)}</p><p><small>Kártya: ${esc(PAYMENT_SCREEN_TEXTS.demoCardLabel)}</small></p>
${body}
</div></main></body></html>`);
}

export { FEE_KIND_LABELS, log };
