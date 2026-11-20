// SPEC §29.1 – payments with Stripe (and the DEMO provider) on the provider-neutral `payments` table.
// Principles (§29.0): money state only from the provider (webhook or a server-side retrieve, never from the app or the
// return URL); at most ONE successful charge per subscription period (partial unique index; a duplicate is refunded);
// exactly one fee invoice per successful payment; no live key in tests or on the DEMO server; card data never reaches
// us (brand, last 4, expiry, Stripe ids only); metadata holds our ids only.
// SimplePay stays in services/subscription.ts (PAYMENT_PROVIDER=simplepay, and the renewals of the old DEMO cards).
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import {
  CARD_CONSENT_TEXT,
  CARD_CONSENT_UI,
  CARD_CONSENT_VERSION,
  INVOICE_LINE_TEXTS,
  PAYMENT_FAIL_TEXTS,
  PAYMENT_KIND_LABELS,
  PAYMENT_MONTHLY_KINDS,
  PAYMENT_OPEN_STATUSES,
  PAYMENT_RULES,
  PAYMENT_SCREEN_TEXTS,
  PAYMENT_STATUS_LABELS_K29,
  STRIPE_STATEMENT_SUFFIXES,
  type CardConsentView,
  type CardInfoView,
  type CheckoutResultView,
  type ClientPaymentItem,
  type DuePaymentView,
  type EffectiveAmountSource,
  type FeeInvoiceItemK29,
  type FeePayResultK29,
  type HostedCel,
  type HostedStartResult,
  type PaymentFailVariant,
  type PaymentKind,
  type SubscriptionStartInputK29,
} from '../_shared/k29.js';
import { ASSIST_KIND_LABELS, type FeeKind } from '../_shared/enums.js';
import { FEE_KIND_LABELS } from '../_shared/bekotes.js';
import { paymentModeOf } from '../config.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import {
  annualClosings,
  assistRequests,
  clientPriceOverrides,
  clients,
  consents,
  feeCharges,
  feeInvoices,
  paymentMethods,
  payments,
  stripeCustomers,
  stripeEvents,
  subscriptions,
  systemState,
  users,
  type SavedChargeParams,
} from '../db/schema.js';
import { audit } from '../audit.js';
import { sha256Hex } from '../lib/crypto.js';
import { addDays, addMonths, budapestLocalToUtc, huDayMonth, huDayMonthIg, monthLabel, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { log, safeErr } from '../log.js';
import { notify } from '../notify/notify.js';
import { fmtHuf } from '../payments/huf.js';
import { alertAdmins, alertMismatchInvoices, buyerOf, invoiceKeyFor, processInvoice, queueCorrection, queueFeeInvoice, queueStorno } from '../payments/invoices.js';
import { ProviderError, type CardInfo, type ChargeOutcome, type PaymentProvider, type ProviderHostedState, type ProviderPaymentState } from '../payments/provider.js';
import { safeStripeError } from '../payments/stripe.js';
import { demoCard, demoSessionRef } from '../payments/demo.js';
import { feeSetting, planAmountHuf } from './dijak.js';
import { pauseOn } from './szuneteltetes.js';
import type { ClientRow } from './people.js';

export type PaymentRow = typeof payments.$inferSelect;
type SubRow = typeof subscriptions.$inferSelect;
type PmRow = typeof paymentMethods.$inferSelect;
type ProviderName = 'stripe' | 'demo';

const FINAL: readonly PaymentRow['status'][] = ['sikeres', 'sikertelen', 'megszakitva', 'duplikalt'];

// ---------------------------------------------------------------------------------------------------------------------
// providers
// ---------------------------------------------------------------------------------------------------------------------
/** The provider of NEW card flows. 'simplepay' is handled by the legacy code (callers check first). */
export function newProviderName(deps: Deps): ProviderName {
  const p = deps.cfg.payment.provider;
  if (p === 'stripe') {
    if (!deps.payments.stripe) throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
    return 'stripe';
  }
  if (p === 'demo') return 'demo';
  throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
}

export function isK29Provider(deps: Deps): boolean {
  return deps.cfg.payment.provider === 'stripe' || deps.cfg.payment.provider === 'demo';
}

export function providerOf(deps: Deps, name: string): PaymentProvider {
  if (name === 'stripe') {
    if (!deps.payments.stripe) throw E.notConfigured('A Stripe nincs bekapcsolva ezen a szerveren.');
    return deps.payments.stripe;
  }
  if (name === 'demo') {
    // a DEMO card never "pays" on a production server
    if (deps.cfg.appEnv === 'production') throw E.notConfigured('DEMO fizetés éles szerveren nem lehet.');
    return deps.payments.demo;
  }
  throw E.notConfigured('Ismeretlen fizetési szolgáltató.');
}

const modeOfProvider = (p: PaymentProvider): PaymentRow['mode'] => p.mode;
/** subscriptions.mode keeps its old values: a Stripe test subscription is 'sandbox'. */
const subModeOf = (m: PaymentRow['mode']): SubRow['mode'] => (m === 'demo' ? 'demo' : m === 'live' ? 'live' : 'sandbox');

// ---------------------------------------------------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------------------------------------------------
const BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', maestro: 'Maestro', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay', diners: 'Diners', demo: 'DEMO' };

export function cardLabel(brand: string | null | undefined, last4: string | null | undefined): string | null {
  if (!last4) return null;
  const b = BRANDS[(brand ?? '').toLowerCase()] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Kártya');
  return `${b} •••• ${last4}`;
}

/** "2026.11.20." */
export function dotDate(d: string): string {
  return `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}.`;
}

/** The inclusive display of a [start, end) period: "2026.11.20.–2026.12.19.". */
export function periodText(start: string, end: string): string {
  return `${dotDate(start)}–${dotDate(addDays(end, -1))}`;
}

export function nextPaidStartK29(sub: Pick<SubRow, 'status' | 'currentPeriodEnd'> | undefined, today: string): string {
  if (sub?.currentPeriodEnd && sub.currentPeriodEnd > today && (sub.status === 'active' || sub.status === 'canceled')) return sub.currentPeriodEnd;
  return today;
}

function backUrls(deps: Deps, o: { platform: 'app' | 'web'; returnOrigin?: string | null; cel: HostedCel; paymentId: string; withSessionTemplate: boolean }): { success: string; cancel: string; originKey: string } {
  const key = originKeyOf(deps, o.returnOrigin);
  const base = `${deps.cfg.apiPublicUrl}/api/v1/payments/stripe/vissza?p=${o.platform}&o=${key}&cel=${o.cel}&pid=${o.paymentId}`;
  return { success: `${base}${o.withSessionTemplate ? '&cs={CHECKOUT_SESSION_ID}' : ''}`, cancel: `${base}&megszakitva=1`, originKey: key };
}

/** SPEC §29.3.4: the short key of an allowed app origin (unknown → the first = APP_PUBLIC_URL). */
export function originKeyOf(deps: Deps, origin: string | null | undefined): string {
  const list = deps.cfg.appOrigins ?? [];
  const hit = origin ? list.find((a) => a.origin === origin.replace(/\/+$/, '')) : undefined;
  return (hit ?? list[0])?.key ?? 'a';
}

export function appOriginOfKey(deps: Deps, key: string | null | undefined): string {
  const list = deps.cfg.appOrigins ?? [];
  return (list.find((a) => a.key === key) ?? list[0])?.origin ?? new URL(deps.cfg.appPublicUrl).origin;
}

async function userOf(db: DbOrTx, cl: Pick<ClientRow, 'userId'>) {
  const [u] = await db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  return u ?? null;
}

/** DEMO only: "fail+…" → declined, "auth+…" → requires_auth (the old SimplePay DEMO rule, extended). */
function demoScenarioOf(email: string): 'ok' | 'declined' | 'requires_auth' {
  if (email.startsWith('fail+')) return 'declined';
  if (email.startsWith('auth+')) return 'requires_auth';
  return 'ok';
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.15 effectiveMonthlyAmount
// ---------------------------------------------------------------------------------------------------------------------
/**
 * The amount of the monthly charge of the period starting `periodStart`: plan fee (fee_settings) → the pause fee inside a
 * subscription_pauses row → the client's own price (§29.9.4; not during a pause) → a percent discount → a free month = 0.
 * An amount between 1 and 199 Ft is never charged (Stripe HUF minimum): it becomes 0.
 */
export async function effectiveMonthlyAmount(deps: Deps, db: DbOrTx, clientId: string, periodStart: string): Promise<{ amountHuf: number; source: EffectiveAmountSource }> {
  const [sub] = await db.select({ planCode: subscriptions.planCode }).from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  const pause = await pauseOn(db, clientId, periodStart);
  let amount: number;
  let source: EffectiveAmountSource;
  if (pause) {
    amount = (await feeSetting(db, 'szuneteltetesi_dij')).amountHuf;
    source = 'szunetel';
  } else {
    amount = await planAmountHuf(deps, db, sub?.planCode ?? 'havi');
    source = 'terv';
  }
  const ovs = await db.select().from(clientPriceOverrides).where(and(eq(clientPriceOverrides.clientId, clientId), isNull(clientPriceOverrides.revokedAt)));
  for (const o of ovs) {
    if (o.kind !== 'ingyenes_honap') continue;
    const end = o.untilPeriod ?? addMonths(o.fromPeriod, Math.max(1, o.months ?? 1));
    if (o.fromPeriod <= periodStart && periodStart < end) return { amountHuf: 0, source: 'ingyenes_honap' };
  }
  const active = ovs.filter((o) => o.fromPeriod <= periodStart && (!o.untilPeriod || periodStart <= o.untilPeriod));
  const own = active.filter((o) => o.kind === 'egyedi_ar' && o.amountHuf !== null).sort((a, b) => (a.fromPeriod < b.fromPeriod ? 1 : -1))[0];
  if (own && !pause) {
    amount = own.amountHuf!;
    source = 'egyedi_ar';
  }
  const disc = active.filter((o) => o.kind === 'kedvezmeny_szazalek' && o.percent).sort((a, b) => (a.fromPeriod < b.fromPeriod ? 1 : -1))[0];
  if (disc) {
    amount = Math.round((amount * (100 - Math.min(100, Math.max(0, disc.percent!)))) / 100);
    source = 'kedvezmeny';
  }
  if (amount > 0 && amount < PAYMENT_RULES.minChargeHuf) amount = 0;
  return { amountHuf: amount, source };
}

// ---------------------------------------------------------------------------------------------------------------------
// cards
// ---------------------------------------------------------------------------------------------------------------------
export async function activeCardOf(db: DbOrTx, clientId: string, provider?: ProviderName): Promise<PmRow | null> {
  const rows = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.status, 'aktiv'), provider ? eq(paymentMethods.provider, provider) : sql`true`))
    .orderBy(desc(paymentMethods.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export function cardView(pm: PmRow, now: Date): CardInfoView {
  const exp = pm.expMonth && pm.expYear ? `${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}` : null;
  const soon = new Date(now.getTime() + 30 * 86_400_000);
  const expiringSoon = Boolean(pm.expMonth && pm.expYear && (pm.expYear < soon.getUTCFullYear() || (pm.expYear === soon.getUTCFullYear() && pm.expMonth < soon.getUTCMonth() + 1)));
  return {
    provider: pm.provider,
    brand: pm.brand ?? 'card',
    last4: pm.last4 ?? '',
    expMonth: pm.expMonth,
    expYear: pm.expYear,
    label: pm.provider === 'demo' ? PAYMENT_SCREEN_TEXTS.demoCardLabel : (cardLabel(pm.brand, pm.last4) ?? 'Kártya'),
    expiryLabel: exp,
    status: pm.status,
    expiringSoon,
  };
}

/** §29.1.15 cardOfClient – the active card (any provider), or null. */
export async function cardOfClient(deps: Deps, db: DbOrTx, clientId: string): Promise<CardInfoView | null> {
  const pm = await activeCardOf(db, clientId);
  return pm ? cardView(pm, deps.now()) : null;
}

async function customerRefOf(deps: Deps, db: DbOrTx, prov: PaymentProvider, cl: ClientRow, email: string): Promise<string> {
  if (prov.name !== 'stripe') return prov.ensureCustomer({ clientId: cl.id, email, name: `${cl.lastName} ${cl.firstName}`.trim() });
  const mode = prov.mode as 'test' | 'live';
  const [row] = await db.select().from(stripeCustomers).where(and(eq(stripeCustomers.clientId, cl.id), eq(stripeCustomers.mode, mode))).limit(1);
  if (row) return row.customerId;
  const id = await prov.ensureCustomer({ clientId: cl.id, email, name: `${cl.lastName} ${cl.firstName}`.trim() });
  await db.insert(stripeCustomers).values({ clientId: cl.id, mode, customerId: id }).onConflictDoNothing();
  return id;
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.3 consent
// ---------------------------------------------------------------------------------------------------------------------
export type ConsentPurpose = 'subscribe' | 'card_update' | 'restart' | 'fizesd_ki';

export async function cardConsentView(deps: Deps, cl: ClientRow, purpose: ConsentPurpose): Promise<CardConsentView> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
  let period: { start: string; end: string } | null = null;
  let amountNow = 0;
  const due = await duePeriod(deps, db, cl.id);
  if (purpose === 'fizesd_ki' || (purpose === 'card_update' && due)) {
    if (due) {
      period = { start: due.periodStart, end: due.periodEnd };
      amountNow = due.amountHuf;
    }
  } else if (purpose === 'subscribe' || purpose === 'restart') {
    const start = nextPaidStartK29(sub, today);
    period = { start, end: addMonths(start, 1) };
    amountNow = (await effectiveMonthlyAmount(deps, db, cl.id, start)).amountHuf;
  }
  const monthly = await planAmountHuf(deps, db, sub?.planCode ?? 'havi');
  const pauseHuf = (await feeSetting(db, 'szuneteltetesi_dij')).amountHuf;
  const template = await deps.content.get('k29.consent.text');
  let text = (template || CARD_CONSENT_TEXT)
    .replace(/\{elsoOsszeg\}/g, fmtHuf(amountNow))
    .replace(/\{idoszak\}/g, period ? periodText(period.start, period.end) : '')
    .replace(/\{havidij\}/g, fmtHuf(monthly))
    .replace(/\{szunetdij\}/g, fmtHuf(pauseHuf));
  // a card change without money: no "most … Ft-ot az első hónapért" line
  // (k7 integrator: the monthly line then starts without "utána" – there is no "most" line before it any more)
  if (amountNow === 0) text = text.split('\n').filter((l) => !/az első hónapért/.test(l)).map((l) => l.replace(/^– utána havonta egyszer, /, '– havonta egyszer, ')).join('\n');
  // (k7 integrator) "Fizesd ki" / a card change with a due month pays an UNPAID month, not the first one
  else if (due && (purpose === 'fizesd_ki' || purpose === 'card_update')) text = text.replace('az első hónapért', 'a fizetésre váró hónapért');
  const provider = deps.cfg.payment.provider;
  return {
    version: CARD_CONSENT_VERSION,
    text,
    sha256: sha256Hex(text),
    amountNowHuf: amountNow,
    monthlyHuf: monthly,
    pauseHuf,
    period,
    provider,
    paymentMode: paymentModeOf(deps.cfg),
    demo: provider === 'demo',
    checkbox: CARD_CONSENT_UI.checkbox,
    button: amountNow > 0 ? CARD_CONSENT_UI.button.replace('{osszeg}', fmtHuf(amountNow)) : CARD_CONSENT_UI.buttonNoAmount,
    under: CARD_CONSENT_UI.underLong,
  };
}

async function hasCurrentConsent(db: DbOrTx, userId: string): Promise<boolean> {
  return Boolean(await currentConsentId(db, userId));
}

/** k7c2 A7: the metadata keys in one fixed order – a jsonb round trip reorders them, a re-send must equal the original. */
function withCanonicalMeta(p: SavedChargeParams): SavedChargeParams {
  const metadata = Object.fromEntries(Object.entries(p.metadata).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { customerRef: p.customerRef, paymentMethodRef: p.paymentMethodRef, amountHuf: p.amountHuf, offSession: p.offSession, ...(p.returnUrl ? { returnUrl: p.returnUrl } : {}), description: p.description, statementSuffix: p.statementSuffix, metadata };
}

/** k7c2: the id of the client's current card consent (this version, not withdrawn), newest first – or null. */
async function currentConsentId(db: DbOrTx, userId: string): Promise<string | null> {
  const [c] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.docType, 'kartyas_fizetes'), eq(consents.version, CARD_CONSENT_VERSION), isNull(consents.withdrawnAt)))
    .orderBy(desc(consents.acceptedAt))
    .limit(1);
  return c?.id ?? null;
}

/**
 * k7c2 (round-1 A3): a saved card is charged off-session only under a card consent (payment_methods.consent_id). A DEMO
 * card moves no money (the seeded DEMO cards have no consent row) – it stays chargeable on a DEMO server only.
 */
function chargeableCard(pm: PmRow | null): boolean {
  if (!pm || pm.status !== 'aktiv' || !pm.stripePaymentMethodId) return false;
  return Boolean(pm.consentId) || pm.mode === 'demo';
}

async function recordConsent(deps: Deps, db: DbOrTx, cl: ClientRow, view: CardConsentView, given: { consentVersion?: string; consentSha256?: string }, meta: { ipHmac: string; ua: string }): Promise<string> {
  if (given.consentVersion !== view.version || given.consentSha256 !== view.sha256) throw new ApiError(409, 'consent_changed', CARD_CONSENT_UI.changed);
  const [row] = await db
    .insert(consents)
    .values({ userId: cl.userId, docType: 'kartyas_fizetes', version: view.version, textSha256: view.sha256, ipHmac: meta.ipHmac, userAgent: meta.ua.slice(0, 120) })
    .returning({ id: consents.id });
  await audit(db, { action: 'consent.accepted', actorUserId: cl.userId, actorRole: 'client', targetType: 'legal_document', targetId: 'kartyas_fizetes', clientId: cl.id, details: { version: view.version } });
  return row!.id;
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.3 hosted start (first month / card change / restart)
// ---------------------------------------------------------------------------------------------------------------------
async function reopenable(deps: Deps, db: DbOrTx, clientId: string, kinds: PaymentKind[], o: { feeChargeId?: string } = {}): Promise<PaymentRow | null> {
  const now = deps.now();
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.clientId, clientId),
        inArray(payments.kind, kinds),
        eq(payments.status, 'letrehozva'),
        sql`${payments.hostedUrlEnc} is not null`,
        gt(payments.createdAt, new Date(now.getTime() - PAYMENT_RULES.reopenWindowMinutes * 60_000)),
        gt(payments.hostedExpiresAt, new Date(now.getTime() + 2 * 60_000)),
        o.feeChargeId ? eq(payments.feeChargeId, o.feeChargeId) : sql`true`,
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return row ?? null;
}

function hostedResult(deps: Deps, p: PaymentRow): HostedStartResult {
  return {
    url: deps.data.dec(p.hostedUrlEnc!, 'payments.hosted_url'),
    paymentId: p.id,
    expiresAt: (p.hostedExpiresAt ?? deps.now()).toISOString(),
    mode: p.hostedMode === 'setup' ? 'setup' : 'payment',
    cel: (p.cel as HostedCel) ?? 'elofizetes',
    provider: p.provider === 'stripe' ? 'stripe' : 'demo',
    demo: p.provider === 'demo',
  };
}

interface HostedOpen {
  cl: ClientRow;
  email: string;
  kind: PaymentKind;
  hostedMode: 'payment' | 'setup';
  amountHuf: number;
  period: { start: string; end: string } | null;
  subscriptionId: string | null;
  feeChargeId?: string | null;
  saveCard: boolean;
  cel: HostedCel;
  platform: 'app' | 'web';
  returnOrigin?: string | null;
  consentId: string | null;
  productName: string;
  description: string;
  statementSuffix: string;
  submitMessage: string | null;
}

async function openHosted(deps: Deps, prov: PaymentProvider, i: HostedOpen): Promise<HostedStartResult> {
  const db = deps.db;
  const now = deps.now();
  const id = randomUUID();
  const expiresAt = new Date(now.getTime() + PAYMENT_RULES.checkoutExpiresMinutes * 60_000);
  const customerRef = await customerRefOf(deps, db, prov, i.cl, i.email).catch((e: unknown) => {
    log().warn({ err: safeErr(e) }, 'payment customer failed');
    throw E.upstream('A fizetési oldal most nem érhető el. Próbáld újra pár perc múlva.');
  });
  const urls = backUrls(deps, { platform: i.platform, returnOrigin: i.returnOrigin, cel: i.cel, paymentId: id, withSessionTemplate: true });
  await db.insert(payments).values({
    id,
    clientId: i.cl.id,
    subscriptionId: i.subscriptionId,
    feeChargeId: i.feeChargeId ?? null,
    kind: i.kind,
    provider: prov.name,
    mode: modeOfProvider(prov),
    amountHuf: i.amountHuf,
    periodStart: i.period?.start ?? null,
    periodEnd: i.period?.end ?? null,
    status: 'letrehozva',
    initiated: 'ugyfel',
    offSession: false,
    idempotencyKey: `checkout:${id}`,
    hostedMode: i.hostedMode,
    saveCard: i.saveCard,
    platform: i.platform,
    returnOrigin: urls.originKey,
    cel: i.cel,
    consentId: i.consentId,
    createdAt: now,
    updatedAt: now,
  });
  const metadata: Record<string, string> = { payment_id: id, client_id: i.cl.id, kind: i.kind, ...(i.period ? { period_start: i.period.start } : {}), ...(i.feeChargeId ? { fee_charge_id: i.feeChargeId } : {}) };
  let res: { url: string; providerRef: string; expiresAt: Date };
  try {
    res = await prov.startHosted({
      mode: i.hostedMode,
      paymentId: id,
      clientId: i.cl.id,
      customerRef,
      amountHuf: i.amountHuf,
      saveCard: i.saveCard,
      productName: i.productName,
      description: i.description,
      statementSuffix: i.statementSuffix,
      submitMessage: i.submitMessage,
      successUrl: urls.success,
      cancelUrl: urls.cancel,
      platform: i.platform,
      expiresAt,
      idempotencyKey: `checkout:${id}`,
      metadata,
    });
  } catch (e) {
    await db.update(payments).set({ status: 'megszakitva', failureCode: e instanceof ProviderError ? e.code.slice(0, 60) : 'start_failed', appliedAt: now, updatedAt: now }).where(eq(payments.id, id));
    log().warn({ err: safeErr(e) }, 'hosted payment start failed');
    throw E.upstream('A fizetési oldal most nem érhető el. Próbáld újra pár perc múlva.');
  }
  const [row] = await db
    .update(payments)
    .set({ stripeCheckoutSessionId: res.providerRef, hostedUrlEnc: deps.data.enc(res.url, 'payments.hosted_url'), hostedExpiresAt: res.expiresAt, updatedAt: deps.now() })
    .where(eq(payments.id, id))
    .returning();
  await audit(db, { action: 'payment.hosted_started', actorUserId: i.cl.userId, actorRole: 'client', targetType: 'payment', targetId: id, clientId: i.cl.id, details: { kind: i.kind, mode: i.hostedMode, provider: prov.name, amountHuf: i.amountHuf } });
  return hostedResult(deps, row!);
}

/** POST /client/subscription/start (the k29 body). Guards of the route: e-mail verified, step open, employer gate, rate limit. */
export async function startSubscriptionK29(deps: Deps, cl: ClientRow, input: SubscriptionStartInputK29, meta: { ipHmac: string; ua: string }): Promise<HostedStartResult> {
  const db = deps.db;
  const provName = newProviderName(deps);
  const prov = providerOf(deps, provName);
  const u = await userOf(db, cl);
  if (!u?.emailVerifiedAt) throw E.conflict('Előbb erősítsd meg az e-mail-címedet.');
  if (!cl.addressZip || !cl.addressCity || !cl.addressLine) throw E.conflict('Előbb add meg a címedet az Adataid lépésben (a számlához kell).');
  const today = todayBudapest(deps.now());
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
  const due = await duePeriod(deps, db, cl.id);
  // money due: a card change pays the due month with the new card ("Fizesd ki")
  if (input.purpose === 'card_update' && due) return startDuePayment(deps, cl, { platform: input.platform, returnOrigin: input.returnOrigin, consentVersion: input.consentVersion, consentSha256: input.consentSha256 }, meta);
  const paidRunning = Boolean(sub && (sub.status === 'active' || sub.status === 'canceled') && sub.currentPeriodEnd && sub.currentPeriodEnd > today);
  let purpose: SubscriptionStartInputK29['purpose'] = input.purpose;
  if (purpose === 'card_update' && !paidRunning) purpose = 'subscribe';
  if (purpose !== 'card_update' && sub && sub.status === 'active' && !sub.cancelAtPeriodEnd && sub.paymentMethodId) {
    const pm = await activeCardOf(db, cl.id);
    if (pm) throw E.conflict('Már fizetsz: a kártyádat a Fiók → Előfizetés oldalon cserélheted.');
  }
  const view = await cardConsentView(deps, cl, purpose === 'card_update' ? 'card_update' : 'subscribe');
  if (input.consentVersion !== view.version || input.consentSha256 !== view.sha256) throw new ApiError(409, 'consent_changed', CARD_CONSENT_UI.changed);
  const kind: PaymentKind = purpose === 'card_update' ? 'kartya' : 'elso_havi';
  const again = await reopenable(deps, db, cl.id, [kind]);
  if (again && again.provider === provName) {
    await audit(db, { action: 'subscription.start_reopened', actorUserId: cl.userId, actorRole: 'client', targetType: 'payment', targetId: again.id, clientId: cl.id });
    return hostedResult(deps, again);
  }
  let subId = sub?.id ?? null;
  if (!sub) {
    const { ensurePlan } = await import('./subscription.js');
    await ensurePlan(deps, db);
    const [s] = await db.insert(subscriptions).values({ clientId: cl.id, planCode: 'havi', status: 'incomplete', mode: subModeOf(modeOfProvider(prov)), provider: provName }).returning({ id: subscriptions.id });
    subId = s!.id;
  }
  const consentId = await recordConsent(deps, db, cl, view, input, meta);
  if (kind === 'kartya') {
    return openHosted(deps, prov, {
      cl,
      email: u.email,
      kind,
      hostedMode: 'setup',
      amountHuf: 0,
      period: null,
      subscriptionId: subId,
      saveCard: true,
      cel: 'elofizetes',
      platform: input.platform,
      returnOrigin: input.returnOrigin,
      consentId,
      productName: CARD_CONSENT_UI.description,
      description: CARD_CONSENT_UI.description,
      statementSuffix: STRIPE_STATEMENT_SUFFIXES.havi,
      submitMessage: null,
    });
  }
  const period = view.period!;
  if (view.amountNowHuf <= 0) {
    // a free first month (console free months): no hosted payment – the card can be given later
    throw E.conflict('Ebben a hónapban nem kell fizetned. A kártyádat a következő hónap előtt kérjük.');
  }
  const monthly = view.monthlyHuf;
  return openHosted(deps, prov, {
    cl,
    email: u.email,
    kind,
    hostedMode: 'payment',
    amountHuf: view.amountNowHuf,
    period,
    subscriptionId: subId,
    saveCard: true,
    cel: 'elofizetes',
    platform: input.platform,
    returnOrigin: input.returnOrigin,
    consentId,
    productName: CARD_CONSENT_UI.productName.replace('{tol}', dotDate(period.start)).replace('{ig}', dotDate(addDays(period.end, -1))),
    description: CARD_CONSENT_UI.description,
    statementSuffix: deps.cfg.payment.stripe?.suffixHavi ?? STRIPE_STATEMENT_SUFFIXES.havi,
    submitMessage: CARD_CONSENT_UI.checkoutSubmit.replace('{havidij}', fmtHuf(monthly)),
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.5 "Fizesd ki"
// ---------------------------------------------------------------------------------------------------------------------
/** The oldest unpaid month of the subscription (past_due / suspended, or an open authentication), or null. */
export async function duePeriod(deps: Deps, db: DbOrTx, clientId: string): Promise<{ sub: SubRow; periodStart: string; periodEnd: string; amountHuf: number } | null> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (!sub) return null;
  let due = sub.status === 'past_due' || sub.status === 'suspended';
  if (!due && sub.status === 'active') {
    const [auth] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.subscriptionId, sub.id), eq(payments.status, 'hitelesites_kell'), inArray(payments.kind, ['havi']))).limit(1);
    due = Boolean(auth) && Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd <= todayBudapest(deps.now()));
  }
  if (!due) return null;
  const periodStart = sub.currentPeriodEnd ?? todayBudapest(deps.now());
  const periodEnd = addMonths(periodStart, 1);
  const { amountHuf } = await effectiveMonthlyAmount(deps, db, clientId, periodStart);
  if (amountHuf <= 0) return null;
  return { sub, periodStart, periodEnd, amountHuf };
}

export async function dueView(deps: Deps, cl: ClientRow): Promise<DuePaymentView | null> {
  const db = deps.db;
  // k7c2 B5 [TULAJ decision pending]: a terminated client is not offered "Fizesd ki" – the money could not be applied
  // to anything (no service after the notice); the owner settles any debt himself.
  if (cl.terminated) return null;
  const d = await duePeriod(deps, db, cl.id);
  if (!d) return null;
  const [last] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.subscriptionId, d.sub.id), eq(payments.periodStart, d.periodStart), inArray(payments.kind, ['havi', 'fizesd_ki'])))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  const reason: DuePaymentView['reason'] = !last
    ? 'esedekes'
    : last.status === 'hitelesites_kell'
      ? 'hitelesites'
      : last.failureCode === 'expired_card' || last.declineCode === 'expired_card'
        ? 'lejart_kartya'
        : last.status === 'sikertelen'
          ? 'elutasitva'
          : 'esedekes';
  const pm = await activeCardOf(db, cl.id);
  const open = await reopenable(deps, db, cl.id, ['fizesd_ki']);
  const osszeg = fmtHuf(d.amountHuf);
  return {
    amountHuf: d.amountHuf,
    period: { start: d.periodStart, end: d.periodEnd },
    reason,
    graceUntil: d.sub.graceUntil ?? null,
    cardLabel: pm ? cardView(pm, deps.now()).label : null,
    title: PAYMENT_SCREEN_TEXTS.fizesdKi.bandTitle.replace('{osszeg}', osszeg),
    text: PAYMENT_SCREEN_TEXTS.fizesdKi.bandText.replace('{idoszak}', periodText(d.periodStart, d.periodEnd)),
    openUrl: open ? deps.data.dec(open.hostedUrlEnc!, 'payments.hosted_url') : null,
  };
}

/** POST /client/payments/due/pay – the due month on a hosted page; the card used becomes the saved card. */
export async function startDuePayment(
  deps: Deps,
  cl: ClientRow,
  input: { platform: 'app' | 'web'; returnOrigin?: string; consentVersion?: string; consentSha256?: string },
  meta: { ipHmac: string; ua: string },
): Promise<HostedStartResult> {
  const db = deps.db;
  const provName = newProviderName(deps);
  const prov = providerOf(deps, provName);
  // k7c2 B5: never take a monthly fee from a terminated client (nothing to apply it to) – the owner settles it
  if (cl.terminated) throw E.conflict('A szerződésed felmondtuk, ezért itt nem kell fizetned. Ha kérdésed van, írj nekünk az Üzenetek fülön.');
  const d = await duePeriod(deps, db, cl.id);
  if (!d) throw E.conflict('Most nincs fizetendő havidíjad.');
  const u = await userOf(db, cl);
  if (!u) throw E.notFound();
  const again = await reopenable(deps, db, cl.id, ['fizesd_ki']);
  if (again && again.provider === provName && again.periodStart === d.periodStart) return hostedResult(deps, again);
  // consent: required when none for the current version is stored, when the client sends it (a new card), and – k7c2 –
  // when there is no saved card (a deleted card needs a new consent before a new card is saved for monthly charges)
  let consentId: string | null = null;
  const existingConsent = await currentConsentId(db, cl.userId);
  if (input.consentVersion || !existingConsent || !(await activeCardOf(db, cl.id))) {
    if (!input.consentVersion) throw new ApiError(409, 'consent_required', 'Előbb nézd át a kártyás fizetés engedélyét.');
    consentId = await recordConsent(deps, db, cl, await cardConsentView(deps, cl, 'fizesd_ki'), input, meta);
  } else consentId = existingConsent;
  // an older PaymentIntent of this month can never succeed later (cancelled at Stripe)
  await cancelOpenIntents(deps, d.sub.id, d.periodStart);
  return openHosted(deps, prov, {
    cl,
    email: u.email,
    kind: 'fizesd_ki',
    hostedMode: 'payment',
    amountHuf: d.amountHuf,
    period: { start: d.periodStart, end: d.periodEnd },
    subscriptionId: d.sub.id,
    saveCard: true,
    cel: 'fizesd-ki',
    platform: input.platform,
    returnOrigin: input.returnOrigin,
    consentId,
    productName: CARD_CONSENT_UI.productName.replace('{tol}', dotDate(d.periodStart)).replace('{ig}', dotDate(addDays(d.periodEnd, -1))),
    description: CARD_CONSENT_UI.description,
    statementSuffix: deps.cfg.payment.stripe?.suffixHavi ?? STRIPE_STATEMENT_SUFFIXES.havi,
    submitMessage: null,
  });
}

async function cancelOpenIntents(deps: Deps, subscriptionId: string, periodStart: string, o: { onlyAuth?: boolean } = {}): Promise<void> {
  const rows = await deps.db
    .select()
    .from(payments)
    .where(and(eq(payments.subscriptionId, subscriptionId), eq(payments.periodStart, periodStart), inArray(payments.status, o.onlyAuth ? ['hitelesites_kell'] : ['hitelesites_kell', 'letrehozva'])));
  for (const r of rows) {
    try {
      const prov = providerOf(deps, r.provider);
      if (r.stripePaymentIntentId) await prov.cancelPending(r.stripePaymentIntentId);
      if (r.stripeCheckoutSessionId && r.status === 'letrehozva') await prov.expireHosted(r.stripeCheckoutSessionId);
      await deps.db.update(payments).set({ status: 'megszakitva', appliedAt: deps.now(), updatedAt: deps.now() }).where(and(eq(payments.id, r.id), inArray(payments.status, ['hitelesites_kell', 'letrehozva'])));
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'cancel open intent failed');
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// apply (shared by webhook, result polling, reconcile, scheduler)
// ---------------------------------------------------------------------------------------------------------------------
export interface SuccessInfo {
  /** PaymentIntent id (pi_…) or the DEMO ref. */
  providerRef: string | null;
  /** SetupIntent id (seti_…) of a card change. */
  setupRef?: string | null;
  chargeRef: string | null;
  card: CardInfo | null;
  customerRef?: string | null;
  /** k7c2 B7: what the provider says it took (when known) – must equal our row's amount, in HUF. */
  amountHuf?: number | null;
  currency?: string | null;
}

/** The invoice line of a payment. */
async function lineOf(deps: Deps, db: DbOrTx, p: PaymentRow): Promise<{ megnevezes: string; unit: 'hó' | 'alkalom' }> {
  if (PAYMENT_MONTHLY_KINDS.includes(p.kind)) {
    const start = p.periodStart ?? todayBudapest(deps.now());
    const end = p.periodEnd ?? addMonths(start, 1);
    if (await pauseOn(db, p.clientId, start)) return { megnevezes: INVOICE_LINE_TEXTS.szunetel.replace('{honap}', `${start.slice(0, 4)}. ${monthLabel(start.slice(0, 7)).toLowerCase()}`), unit: 'hó' };
    return { megnevezes: INVOICE_LINE_TEXTS.havidij.replace('{tol}', dotDate(start)).replace('{ig}', dotDate(addDays(end, -1))), unit: 'hó' };
  }
  const [ch] = p.feeChargeId ? await db.select().from(feeCharges).where(eq(feeCharges.id, p.feeChargeId)).limit(1) : [];
  if (!ch) return { megnevezes: INVOICE_LINE_TEXTS.admin.replace('{megjegyzes}', 'díj'), unit: 'alkalom' };
  const pu = ch.purpose as { type: string; assistId?: string; annualId?: string; note?: string; requestId?: string };
  const kind = ch.kind as FeeKind;
  if (kind === 'eves_zaras') {
    const [an] = pu.annualId ? await db.select({ y: annualClosings.taxYear }).from(annualClosings).where(eq(annualClosings.id, pu.annualId)).limit(1) : [];
    return { megnevezes: INVOICE_LINE_TEXTS.eves_zaras.replace('{ev}', String(an?.y ?? Number(todayBudapest(deps.now()).slice(0, 4)) - 1)), unit: 'alkalom' };
  }
  if (kind === 'valtozas_egyszeru') {
    const [a] = pu.assistId ? await db.select({ k: assistRequests.kind }).from(assistRequests).where(eq(assistRequests.id, pu.assistId)).limit(1) : [];
    return { megnevezes: INVOICE_LINE_TEXTS.valtozas_egyszeru.replace('{valtozas}', a ? ASSIST_KIND_LABELS[a.k].toLowerCase() : 'változás'), unit: 'alkalom' };
  }
  if (kind === 'valtozas_jogallas') return { megnevezes: INVOICE_LINE_TEXTS.valtozas_jogallas, unit: 'alkalom' };
  if (kind === 'megszuntetes') return { megnevezes: INVOICE_LINE_TEXTS.megszuntetes, unit: 'alkalom' };
  if (kind.startsWith('igazolas_')) return { megnevezes: INVOICE_LINE_TEXTS.igazolas.replace('{tipus}', FEE_KIND_LABELS[kind].replace(/ intézése$/, '').toLowerCase()), unit: 'alkalom' };
  if (pu.type === 'admin') return { megnevezes: INVOICE_LINE_TEXTS.admin.replace('{megjegyzes}', (pu.note ?? 'díj').slice(0, 80)), unit: 'alkalom' };
  return { megnevezes: FEE_KIND_LABELS[kind] ?? 'Díj', unit: 'alkalom' };
}

function isUniqueViolation(e: unknown): boolean {
  let x: unknown = e;
  for (let i = 0; i < 4 && x && typeof x === 'object'; i++) {
    if ((x as { code?: unknown }).code === '23505') return true;
    x = (x as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The money arrived (idempotent: the row is locked and `applied_at` set once). Monthly kinds advance the subscription;
 * a one-off marks its charge paid and runs its purpose; the card the client used becomes the saved card. A second
 * success for the same subscription month is refunded automatically ('duplikalt').
 */
export async function applyPaymentSucceeded(deps: Deps, paymentId: string, info: SuccessInfo): Promise<'applied' | 'already' | 'duplicate' | 'missing' | 'mismatch'> {
  const db = deps.db;
  let outcome = 'missing' as 'applied' | 'already' | 'duplicate' | 'missing' | 'mismatch';
  const after: { invoiceId: string | null; detach: { provider: string; ref: string }[]; charge: typeof feeCharges.$inferSelect | null; clientId: string | null; userId: string | null; terminatedPaid: boolean } = {
    invoiceId: null,
    detach: [],
    charge: null,
    clientId: null,
    userId: null,
    terminatedPaid: false,
  };
  const run = async (asDuplicate: boolean) =>
    db.transaction(async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1).for('update');
      if (!p) return;
      if (p.appliedAt && (p.status === 'sikeres' || p.status === 'duplikalt')) {
        outcome = 'already';
        return;
      }
      const now = deps.now();
      // k7c2 B7: money of another amount or currency is never applied as our row (admin alert, once)
      const wrongAmount = typeof info.amountHuf === 'number' && p.amountHuf > 0 && info.amountHuf !== p.amountHuf;
      const wrongCurrency = Boolean(info.currency) && String(info.currency).toLowerCase() !== 'huf';
      if (wrongAmount || wrongCurrency) {
        await tx.update(payments).set({ failureCode: 'osszeg_elteres', updatedAt: now }).where(eq(payments.id, p.id));
        await audit(tx, { action: 'payment.amount_mismatch', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { expectedHuf: p.amountHuf, gotHuf: info.amountHuf ?? null, currency: info.currency ?? null } });
        after.clientId = p.clientId;
        outcome = 'mismatch';
        return;
      }
      const [cl] = await tx.select().from(clients).where(eq(clients.id, p.clientId)).limit(1);
      if (!cl) return;
      after.clientId = cl.id;
      after.userId = cl.userId;
      const monthly = PAYMENT_MONTHLY_KINDS.includes(p.kind);
      const [sub] = p.subscriptionId ? await tx.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).limit(1).for('update') : [];
      const cardPatch = {
        stripePaymentIntentId: p.stripePaymentIntentId ?? info.providerRef ?? null,
        stripeSetupIntentId: p.stripeSetupIntentId ?? info.setupRef ?? null,
        stripeChargeId: info.chargeRef ?? p.stripeChargeId,
        cardBrand: info.card?.brand ?? p.cardBrand,
        cardLast4: info.card?.last4 ?? p.cardLast4,
      };
      let dup = asDuplicate;
      if (!dup && monthly && sub && p.periodStart) {
        const [other] = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(and(eq(payments.subscriptionId, sub.id), eq(payments.periodStart, p.periodStart), eq(payments.status, 'sikeres'), inArray(payments.kind, ['elso_havi', 'havi', 'fizesd_ki']), ne(payments.id, p.id)))
          .limit(1);
        dup = Boolean(other);
      }
      // k7c2 A1/A2/B2/B3/B2b: one fee, at most ONE successful payment. The fee row is locked; a success for a fee that
      // is no longer open (paid by another attempt, waived, refunded) is a duplicate: refunded, no invoice.
      if (!dup && p.kind === 'egyszeri' && p.feeChargeId) {
        const [ch] = await tx.select().from(feeCharges).where(eq(feeCharges.id, p.feeChargeId)).limit(1).for('update');
        const [other] = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(and(eq(payments.feeChargeId, p.feeChargeId), eq(payments.kind, 'egyszeri'), eq(payments.status, 'sikeres'), ne(payments.id, p.id)))
          .limit(1);
        dup = Boolean(other) || Boolean(ch && ch.status !== 'nyitott');
      }
      if (dup) {
        await tx.update(payments).set({ ...cardPatch, status: 'duplikalt', appliedAt: now, succeededAt: now, updatedAt: now }).where(eq(payments.id, p.id));
        await audit(tx, { action: 'payment.duplicate', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { periodStart: p.periodStart, amountHuf: p.amountHuf } });
        outcome = 'duplicate';
        return;
      }
      await tx.update(payments).set({ ...cardPatch, status: 'sikeres', appliedAt: now, succeededAt: now, failureCode: null, declineCode: null, updatedAt: now }).where(eq(payments.id, p.id));
      // the card the client authenticated becomes the saved card
      let newPmId: string | null = null;
      const saves = p.kind === 'kartya' || p.saveCard;
      if (saves && info.card && p.amountHuf >= 0 && (info.card.paymentMethodRef || p.provider === 'demo')) {
        newPmId = await saveCard(deps, tx, cl.id, p, info, after.detach);
      }
      if (monthly && sub) {
        const terminated = Boolean(cl.terminated);
        const periodStart = p.periodStart ?? todayBudapest(now);
        const periodEnd = p.periodEnd ?? addMonths(periodStart, 1);
        if (!terminated) {
          await tx
            .update(subscriptions)
            .set({
              status: 'active',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              // k7c2 A8: the day the pre-debit notice names is the day the 06:00 job charges (not the next morning)
              nextChargeAt: budapestLocalToUtc(periodEnd, '00:00'),
              nextRetryAt: null,
              failedAttempts: 0,
              firstFailedAt: null,
              lastFailureCode: null,
              graceUntil: null,
              renewalNotifiedAt: null,
              suspensionWarnedFor: null,
              provider: p.provider === 'stripe' ? 'stripe' : 'demo',
              mode: subModeOf(p.mode),
              ...(newPmId ? { paymentMethodId: newPmId, cardRegistrationId: null } : {}),
              ...(p.kind === 'elso_havi' ? { cancelAtPeriodEnd: false, canceledAt: null } : {}),
              updatedAt: now,
            })
            .where(eq(subscriptions.id, sub.id));
          if (cl.lifecycle === 'felfuggesztve' || cl.lifecycle === 'megszunt') await tx.update(clients).set({ lifecycle: 'aktiv', updatedAt: now }).where(eq(clients.id, cl.id));
        } else after.terminatedPaid = true;
        if (p.kind === 'elso_havi') {
          const { setStep } = await import('./onboarding.js');
          await setStep(deps, tx, cl.id, 'elofizetes', 'kesz');
        }
      }
      if (p.kind === 'kartya' && sub && newPmId) {
        await tx.update(subscriptions).set({ paymentMethodId: newPmId, cardRegistrationId: null, provider: p.provider === 'stripe' ? 'stripe' : 'demo', mode: subModeOf(p.mode), renewalNotifiedAt: null, updatedAt: now }).where(eq(subscriptions.id, sub.id));
      }
      if (p.kind === 'egyszeri' && p.feeChargeId) {
        const [ch] = await tx.update(feeCharges).set({ status: 'fizetve', paidAt: now, paymentId: p.id }).where(and(eq(feeCharges.id, p.feeChargeId), inArray(feeCharges.status, ['nyitott']))).returning();
        after.charge = ch ?? null;
      }
      if (p.amountHuf > 0) {
        const [u] = await tx.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1);
        after.invoiceId = await queueFeeInvoice(deps, tx, p, buyerOf(cl, u?.email ?? ''), await lineOf(deps, tx, p));
      }
      await audit(tx, {
        action: p.kind === 'kartya' ? 'subscription.card_saved' : monthly ? (p.kind === 'havi' ? 'subscription.renewed' : 'subscription.activated') : 'fee.paid',
        actorRole: 'system',
        targetType: 'payment',
        targetId: p.id,
        clientId: cl.id,
        details: { kind: p.kind, provider: p.provider, mode: p.mode, amountHuf: p.amountHuf, periodStart: p.periodStart },
      });
      outcome = 'applied';
    });
  try {
    await run(false);
  } catch (e) {
    // the partial unique index refused a second success for the month (a race the pre-check did not see)
    if (!isUniqueViolation(e)) throw e;
    await run(true);
  }
  if (outcome === 'mismatch') {
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (p && !p.alertedAt) {
      await db.update(payments).set({ alertedAt: deps.now() }).where(eq(payments.id, paymentId));
      await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(p.amountHuf) }, '/admin/fizetesek', 'osszeg_elteres').catch(() => undefined);
    }
    return outcome;
  }
  if (outcome === 'duplicate') {
    const [p0] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    const refunded = await refundDuplicate(deps, paymentId, p0?.kind === 'egyszeri' ? 'Dupla fizetés ugyanarra a díjra' : 'Dupla fizetés ugyanarra a hónapra');
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (p && !p.alertedAt) {
      await db.update(payments).set({ alertedAt: deps.now() }).where(eq(payments.id, paymentId));
      await audit(db, { action: refunded ? 'payment.duplicate_refunded' : 'payment.duplicate_refund_failed', actorRole: 'system', targetType: 'payment', targetId: paymentId, clientId: p.clientId, details: { amountHuf: p.amountHuf, kind: p.kind } });
      // k7c2 A4: the alert says what really happened
      const variant = !refunded ? 'dupla_nem_ment' : p.kind === 'egyszeri' ? 'dupla_dij' : 'dupla';
      await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(p.amountHuf) }, '/admin/fizetesek', variant).catch(() => undefined);
    }
    return outcome;
  }
  if (outcome !== 'applied') return outcome;
  for (const d of after.detach) {
    try {
      await providerOf(deps, d.provider).detachCard(d.ref);
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'old card detach failed');
    }
  }
  if (after.invoiceId) {
    await processInvoice(deps, after.invoiceId).catch((e) => log().warn({ err: safeErr(e) }, 'fee invoice first try failed'));
    // k7c2 B8: no invoicing route for this payment's mode → the admins are told right away
    await alertMismatchInvoices(deps, after.invoiceId).catch((e) => log().warn({ err: safeErr(e) }, 'mismatch alert failed'));
  }
  if (after.charge && after.clientId) {
    const [cl] = await db.select().from(clients).where(eq(clients.id, after.clientId)).limit(1);
    const { runPurposeFor } = await import('./dijak.js');
    if (cl) await runPurposeFor(deps, cl, after.charge).catch((e) => log().error({ err: safeErr(e) }, 'fee purpose failed'));
  }
  if (after.terminatedPaid && after.clientId) {
    await audit(db, { action: 'payment.after_termination', actorRole: 'system', targetType: 'payment', targetId: paymentId, clientId: after.clientId });
    log().warn('payment after termination – admin decides (refund in the console)');
    // k7c2 B5: the owner is told, so he can refund it in the console
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (p && !p.alertedAt) {
      await db.update(payments).set({ alertedAt: deps.now() }).where(eq(payments.id, paymentId));
      await alertAdmins(deps, 'payment_disputed', after.clientId, { osszeg: fmtHuf(p.amountHuf) }, '/admin/fizetesek', 'felmondas_utan').catch(() => undefined);
    }
  }
  if (after.clientId) {
    const { checkCompletion } = await import('./onboarding.js');
    const { computeFlags } = await import('./flags.js');
    const { computeServiceLock } = await import('./zarolas.js');
    await checkCompletion(deps, db, after.clientId);
    await computeFlags(deps, db, after.clientId);
    await computeServiceLock(deps, after.clientId);
  }
  return outcome;
}

async function saveCard(deps: Deps, tx: DbOrTx, clientId: string, p: PaymentRow, info: SuccessInfo, detach: { provider: string; ref: string }[]): Promise<string> {
  const now = deps.now();
  const card = info.card ?? demoCard(now);
  const ref = card.paymentMethodRef ?? `demo_pm_${p.id.replace(/-/g, '').slice(0, 16)}`;
  const [existing] = await tx.select().from(paymentMethods).where(eq(paymentMethods.stripePaymentMethodId, ref)).limit(1);
  let id: string;
  if (existing) {
    id = existing.id;
    await tx.update(paymentMethods).set({ status: 'aktiv', brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear, detachedAt: null, ...(p.consentId ? { consentId: p.consentId } : {}) }).where(eq(paymentMethods.id, id));
  } else {
    const [row] = await tx
      .insert(paymentMethods)
      .values({
        clientId,
        provider: p.provider === 'stripe' ? 'stripe' : 'demo',
        mode: p.mode === 'live' ? 'live' : p.mode === 'demo' ? 'demo' : 'test',
        stripeCustomerId: info.customerRef ?? null,
        stripePaymentMethodId: ref,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        status: 'aktiv',
        consentId: p.consentId,
        createdAt: now,
      })
      .returning({ id: paymentMethods.id });
    id = row!.id;
  }
  const others = await tx.select().from(paymentMethods).where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.status, 'aktiv'), ne(paymentMethods.id, id)));
  for (const o of others) {
    await tx.update(paymentMethods).set({ status: 'lecserelve', detachedAt: now }).where(eq(paymentMethods.id, o.id));
    if (o.stripePaymentMethodId && o.provider === 'stripe') detach.push({ provider: o.provider, ref: o.stripePaymentMethodId });
  }
  await tx.update(payments).set({ paymentMethodId: id }).where(eq(payments.id, p.id));
  return id;
}

/** A failed charge with the saved card (off-session, or on-session declined). Monthly ones run the retry schedule. */
export async function applyChargeFailure(deps: Deps, paymentId: string, f: { kind: 'requires_auth' | 'declined'; providerRef: string | null; code: string; declineCode?: string | null }): Promise<void> {
  const db = deps.db;
  let notifyVariant: PaymentFailVariant | null = null;
  let ctx: { userId: string; clientId: string; amount: number; subId: string; periodStart: string } | null = null;
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1).for('update');
    if (!p || FINAL.includes(p.status) || (p.status === 'hitelesites_kell' && f.kind === 'requires_auth')) return;
    const now = deps.now();
    await tx
      .update(payments)
      .set({
        status: f.kind === 'requires_auth' ? 'hitelesites_kell' : 'sikertelen',
        failureCode: f.code.slice(0, 60),
        declineCode: f.declineCode?.slice(0, 60) ?? null,
        stripePaymentIntentId: p.stripePaymentIntentId ?? (f.providerRef && !f.providerRef.startsWith('demo_') ? f.providerRef : p.stripePaymentIntentId),
        ...(f.kind === 'declined' ? { appliedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(payments.id, p.id));
    await audit(tx, { action: 'payment.failed', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { kind: p.kind, code: f.code.slice(0, 60), decline: f.declineCode ?? null } });
    if (p.kind !== 'havi' || !p.subscriptionId) return;
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, p.subscriptionId)).limit(1);
    if (!sub) return;
    const { registerFailure } = await import('./subscription.js');
    await registerFailure(deps, tx, sub, f.kind === 'requires_auth' ? 'authentication_required' : (f.declineCode ?? f.code));
    const [cl] = await tx.select({ userId: clients.userId }).from(clients).where(eq(clients.id, p.clientId)).limit(1);
    notifyVariant = f.kind === 'requires_auth' ? 'hitelesites' : f.code === 'expired_card' || f.declineCode === 'expired_card' ? 'lejart_kartya' : 'elutasitva';
    if (cl) ctx = { userId: cl.userId, clientId: p.clientId, amount: p.amountHuf, subId: sub.id, periodStart: p.periodStart ?? '' };
  });
  if (notifyVariant && ctx) {
    const c = ctx as { userId: string; clientId: string; amount: number; subId: string; periodStart: string };
    const { notifyOnce } = await import('./emlekezteto.js');
    await notifyOnce(deps, `pay:fail:${c.subId}:${c.periodStart}:${notifyVariant}`, { userId: c.userId, kind: 'payment_action_needed', variant: notifyVariant, params: { osszeg: fmtHuf(c.amount) }, link: '/fizesd-ki' });
    const { computeFlags } = await import('./flags.js');
    await computeFlags(deps, db, c.clientId);
  }
}

async function markCancelled(deps: Deps, paymentId: string): Promise<void> {
  await deps.db.update(payments).set({ status: 'megszakitva', appliedAt: deps.now(), updatedAt: deps.now() }).where(and(eq(payments.id, paymentId), eq(payments.status, 'letrehozva')));
}

/** A hosted session's state (webhook / polling / reconcile) applied to our row. */
export async function applyHosted(deps: Deps, paymentId: string, h: ProviderHostedState): Promise<void> {
  const [p] = await deps.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  // k7c2: money that really arrived is never ignored – a page we closed meanwhile is applied (and refunded as a duplicate)
  if (!p || (FINAL.includes(p.status) && !(h.paid && h.mode === 'payment' && p.status === 'megszakitva'))) return;
  if (h.paid) {
    await applyPaymentSucceeded(deps, paymentId, {
      providerRef: h.paymentRef,
      setupRef: h.setupRef,
      chargeRef: h.payment?.chargeRef ?? null,
      card: h.card,
      customerRef: h.customerRef,
      ...(h.payment ? { amountHuf: h.payment.amountHuf, currency: h.payment.currency ?? null } : {}),
    });
    return;
  }
  if (h.status === 'expired') return markCancelled(deps, paymentId);
  if (h.payment?.status === 'processing' && p.status === 'letrehozva') {
    await deps.db.update(payments).set({ status: 'feldolgozas', stripePaymentIntentId: h.paymentRef, updatedAt: deps.now() }).where(eq(payments.id, paymentId));
  }
}

/** A PaymentIntent's state applied to our row (saved-card charges, 3DS return, reconcile). */
export async function applyIntentState(deps: Deps, paymentId: string, st: ProviderPaymentState): Promise<void> {
  if (st.status === 'succeeded') await applyPaymentSucceeded(deps, paymentId, { providerRef: st.providerRef, chargeRef: st.chargeRef, card: st.card, customerRef: st.customerRef, amountHuf: st.amountHuf, currency: st.currency ?? null });
  else if (st.status === 'failed') await applyChargeFailure(deps, paymentId, { kind: 'declined', providerRef: st.providerRef, code: st.failureCode ?? 'card_declined', declineCode: st.declineCode });
  else if (st.status === 'requires_auth') await applyChargeFailure(deps, paymentId, { kind: 'requires_auth', providerRef: st.providerRef, code: 'authentication_required' });
  else if (st.status === 'canceled') await markCancelledAny(deps, paymentId);
  else if (st.status === 'processing') await deps.db.update(payments).set({ status: 'feldolgozas', updatedAt: deps.now() }).where(and(eq(payments.id, paymentId), inArray(payments.status, ['letrehozva', 'bizonytalan'])));
}

async function markCancelledAny(deps: Deps, paymentId: string): Promise<void> {
  await deps.db.update(payments).set({ status: 'megszakitva', appliedAt: deps.now(), updatedAt: deps.now() }).where(and(eq(payments.id, paymentId), inArray(payments.status, ['letrehozva', 'feldolgozas', 'bizonytalan', 'hitelesites_kell'])));
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.3 result screen
// ---------------------------------------------------------------------------------------------------------------------
export async function checkoutResult(deps: Deps, cl: ClientRow, cs: string, o: { cancelled?: boolean } = {}): Promise<CheckoutResultView> {
  const db = deps.db;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(cs);
  const [p0] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.clientId, cl.id), isUuid ? eq(payments.id, cs) : eq(payments.stripeCheckoutSessionId, cs)))
    .limit(1);
  if (!p0) throw E.notFound();
  let p = p0;
  if (!FINAL.includes(p.status)) {
    try {
      const prov = providerOf(deps, p.provider);
      if (o.cancelled && p.status === 'letrehozva' && p.stripeCheckoutSessionId) {
        // the client left the page: the session can never be paid later
        await prov.expireHosted(p.stripeCheckoutSessionId);
        const h = await prov.retrieveHosted(p.stripeCheckoutSessionId);
        if (h.paid) await applyHosted(deps, p.id, h);
        else await markCancelled(deps, p.id);
      } else if (p.provider === 'stripe' && p.stripeCheckoutSessionId && p.status === 'letrehozva') {
        await applyHosted(deps, p.id, await prov.retrieveHosted(p.stripeCheckoutSessionId));
      } else if (p.provider === 'stripe' && p.stripePaymentIntentId) {
        await applyIntentState(deps, p.id, await prov.retrievePayment(p.stripePaymentIntentId));
      } else if (o.cancelled && p.provider === 'demo') await markCancelled(deps, p.id);
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'checkout result retrieve failed');
    }
    p = (await db.select().from(payments).where(eq(payments.id, p0.id)).limit(1))[0] ?? p0;
  }
  const status: CheckoutResultView['status'] =
    p!.status === 'sikeres' || p!.status === 'duplikalt' ? 'sikeres' : p!.status === 'megszakitva' ? 'megszakitva' : p!.status === 'sikertelen' || p!.status === 'hitelesites_kell' ? 'sikertelen' : 'feldolgozas';
  const [sub] = p!.subscriptionId ? await db.select().from(subscriptions).where(eq(subscriptions.id, p!.subscriptionId)).limit(1) : [];
  const out: CheckoutResultView = { status, cel: (p!.cel as HostedCel) ?? 'elofizetes', kind: p!.kind, amountHuf: p!.amountHuf };
  const label = p!.provider === 'demo' && (p!.cardLast4 || status === 'sikeres') ? PAYMENT_SCREEN_TEXTS.demoCardLabel : cardLabel(p!.cardBrand, p!.cardLast4);
  if (label) out.cardLabel = label;
  if (p!.periodStart && p!.periodEnd) out.period = { start: p!.periodStart, end: p!.periodEnd };
  if (status === 'sikeres' && sub?.currentPeriodEnd && !sub.cancelAtPeriodEnd && sub.status === 'active') {
    out.nextChargeOn = sub.currentPeriodEnd;
    out.nextChargeHuf = (await effectiveMonthlyAmount(deps, db, cl.id, sub.currentPeriodEnd)).amountHuf;
  }
  if (status === 'sikertelen') out.message = p!.status === 'hitelesites_kell' ? PAYMENT_FAIL_TEXTS.hitelesites.title : declineMessage(p!.failureCode, p!.declineCode);
  return out;
}

export function declineMessage(code: string | null, decline: string | null): string {
  if (decline === 'insufficient_funds') return 'Nincs elég fedezet a kártyán. Próbáld másik kártyával.';
  if (code === 'expired_card' || decline === 'expired_card') return 'Lejárt a kártyád. Adj meg másikat.';
  if (code === 'authentication_required') return PAYMENT_FAIL_TEXTS.hitelesites.title;
  return 'A bankod nem engedte a fizetést. Próbáld újra, vagy válassz másik kártyát.';
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.4 monthly charge by OUR scheduler
// ---------------------------------------------------------------------------------------------------------------------
export async function chargeSubscriptionK29(deps: Deps, stale: SubRow): Promise<'charged' | 'pending' | 'failed' | 'skipped'> {
  const db = deps.db;
  const now = deps.now();
  const today = todayBudapest(now);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, stale.id)).limit(1);
  const { chargeDue, registerFailure } = await import('./subscription.js');
  if (!sub || !chargeDue(sub, today)) return 'skipped';
  const periodStart = sub.currentPeriodEnd ?? today;
  const periodEnd = addMonths(periodStart, 1);
  // money already moving for this subscription, or a success for the month, or an attempt today → nothing
  const busy = await db
    .select({ id: payments.id, status: payments.status, attemptDay: payments.attemptDay, kind: payments.kind })
    .from(payments)
    .where(and(eq(payments.subscriptionId, sub.id), or(and(inArray(payments.status, ['feldolgozas', 'bizonytalan']), gt(payments.createdAt, new Date(now.getTime() - 86_400_000))), and(eq(payments.periodStart, periodStart), eq(payments.status, 'sikeres'), inArray(payments.kind, ['elso_havi', 'havi', 'fizesd_ki'])), and(eq(payments.attemptDay, today), eq(payments.kind, 'havi')))))
    .limit(1);
  if (busy.length) return 'skipped';
  const [cl] = await db.select().from(clients).where(eq(clients.id, sub.clientId)).limit(1);
  const u = cl ? await userOf(db, cl) : null;
  if (!cl || !u) return 'skipped';
  if (cl.terminated) return 'skipped';
  const { amountHuf } = await effectiveMonthlyAmount(deps, db, cl.id, periodStart);
  const provName: ProviderName = sub.provider === 'stripe' ? 'stripe' : 'demo';
  let prov: PaymentProvider;
  try {
    prov = providerOf(deps, provName);
  } catch {
    return 'skipped';
  }
  const base = {
    clientId: cl.id,
    subscriptionId: sub.id,
    kind: 'havi' as const,
    provider: prov.name,
    mode: modeOfProvider(prov),
    periodStart,
    periodEnd,
    initiated: 'utemezo' as const,
    offSession: true,
    attemptDay: today,
    createdAt: now,
    updatedAt: now,
  };
  if (amountHuf === 0) {
    const [row] = await db.insert(payments).values({ ...base, amountHuf: 0, status: 'letrehozva', idempotencyKey: `ingyenes:${sub.id}:${periodStart}` }).onConflictDoNothing().returning({ id: payments.id });
    if (!row) return 'skipped';
    await applyPaymentSucceeded(deps, row.id, { providerRef: null, chargeRef: null, card: null });
    await audit(db, { action: 'subscription.free_month', actorRole: 'system', targetType: 'subscription', targetId: sub.id, clientId: cl.id, details: { periodStart } });
    return 'charged';
  }
  const pm = sub.paymentMethodId ? await db.select().from(paymentMethods).where(eq(paymentMethods.id, sub.paymentMethodId)).limit(1).then((r) => r[0] ?? null) : null;
  const candidate = pm?.status === 'aktiv' ? pm : await activeCardOf(db, cl.id, provName);
  // k7c2 (round-1 A3): only a card saved under the client's card consent is charged off-session
  const card = chargeableCard(candidate) ? candidate : null;
  if (!card || !card.stripePaymentMethodId) {
    await registerFailure(deps, db, sub, candidate ? 'NO_CONSENT' : 'NO_CARD');
    const { notifyOnce } = await import('./emlekezteto.js');
    await notifyOnce(deps, `pay:nocard:${sub.id}:${periodStart}`, { userId: cl.userId, kind: 'subscription_renewal_needed', link: '/fiok/elofizetes' });
    const { computeFlags } = await import('./flags.js');
    await computeFlags(deps, db, cl.id);
    return 'failed';
  }
  // k7c2 B1: "Minden levonás előtt 3 nappal szóltok az összegről és a napról." – no off-session charge without a
  // pre-debit notice for THIS period sent at least 3 days before. Missing → the charge moves to today + 3, with notice.
  const noticed = (sub.predebitPeriod === periodStart || sub.predebitNotifiedFor === periodStart) && Boolean(sub.predebitNotifiedFor) && sub.predebitNotifiedFor! <= today;
  if (!noticed) {
    const chargeDay = addDays(today, PAYMENT_RULES.predebitDaysBefore);
    const at = budapestLocalToUtc(chargeDay, '00:00');
    await db
      .update(subscriptions)
      .set({ predebitNotifiedFor: chargeDay, predebitPeriod: periodStart, ...(sub.status === 'past_due' ? { nextRetryAt: at } : { nextChargeAt: at }), updatedAt: now })
      .where(eq(subscriptions.id, sub.id));
    const { notifyOnce } = await import('./emlekezteto.js');
    await notifyOnce(deps, `rem:predebit:${sub.id}:${periodStart}:${chargeDay}`, {
      userId: cl.userId,
      kind: 'charge_upcoming',
      params: { datum: huDayMonth(chargeDay), osszeg: fmtHuf(amountHuf), kartya: cardView(card, now).label, idoszak: periodText(periodStart, periodEnd) },
      emailBodyKey: 'email.charge_upcoming.body',
      link: '/fiok/elofizetes',
    });
    await audit(db, { action: 'subscription.predebit_moved', actorRole: 'system', targetType: 'subscription', targetId: sub.id, clientId: cl.id, details: { periodStart, chargeDay } });
    return 'skipped';
  }
  // an older PaymentIntent of this month that waits for the bank's confirmation can never succeed later
  await cancelOpenIntents(deps, sub.id, periodStart, { onlyAuth: true });
  const idem = `havidij:${sub.id}:${periodStart}:${today}`;
  const customerRef = prov.name === 'stripe' ? (card.stripeCustomerId ?? (await customerRefOf(deps, db, prov, cl, u.email))) : null;
  const params: SavedChargeParams = {
    customerRef,
    paymentMethodRef: card.stripePaymentMethodId,
    amountHuf,
    offSession: true,
    description: CARD_CONSENT_UI.descriptionMonth.replace('{honap}', dotDate(periodStart).slice(0, 8)),
    statementSuffix: deps.cfg.payment.stripe?.suffixHavi ?? STRIPE_STATEMENT_SUFFIXES.havi,
    metadata: { payment_id: '', client_id: cl.id, subscription_id: sub.id, kind: 'havi', period_start: periodStart },
  };
  const [row] = await db.insert(payments).values({ ...base, amountHuf, status: 'letrehozva', idempotencyKey: idem, paymentMethodId: card.id }).onConflictDoNothing().returning();
  if (!row) return 'skipped';
  params.metadata = { ...params.metadata, payment_id: row.id };
  await db.update(payments).set({ chargeParams: params }).where(eq(payments.id, row.id));
  let outcome: ChargeOutcome;
  try {
    outcome = await prov.chargeSaved({
      paymentId: row.id,
      ...withCanonicalMeta(params),
      idempotencyKey: idem,
      ...(prov.name === 'demo' ? { demoScenario: demoScenarioOf(u.email) } : {}),
    });
  } catch (e) {
    // not a card decline: our request was refused (bad request / auth / a detached card). k7c2 A5: it still counts as a
    // failed month (past_due → grace → suspended → lock), the admins are told, and the client is asked for a card.
    const code = e instanceof ProviderError ? e.code : 'error';
    await db.update(payments).set({ status: 'sikertelen', failureCode: `hiba:${code}`.slice(0, 60), appliedAt: deps.now(), updatedAt: deps.now() }).where(eq(payments.id, row.id));
    await audit(db, { action: 'payment.provider_error', actorRole: 'system', targetType: 'payment', targetId: row.id, clientId: cl.id, details: { code } });
    log().error({ err: safeErr(e) }, 'monthly charge refused by the provider – admin alert');
    const [fresh] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
    if (fresh) await registerFailure(deps, db, fresh, `hiba:${code}`);
    const { notifyOnce } = await import('./emlekezteto.js');
    await notifyOnce(deps, `pay:providererr:${sub.id}:${periodStart}`, { userId: cl.userId, kind: 'subscription_renewal_needed', link: '/fiok/elofizetes' });
    if (!row.alertedAt) {
      await db.update(payments).set({ alertedAt: deps.now() }).where(eq(payments.id, row.id));
      await alertAdmins(deps, 'payment_disputed', cl.id, { osszeg: fmtHuf(amountHuf), hiba: String(code).slice(0, 60) }, '/admin/fizetesek', 'szolgaltato_hiba').catch(() => undefined);
    }
    const { computeFlags } = await import('./flags.js');
    await computeFlags(deps, db, cl.id);
    return 'failed';
  }
  return applyOutcome(deps, row.id, outcome);
}

async function applyOutcome(deps: Deps, paymentId: string, outcome: ChargeOutcome): Promise<'charged' | 'pending' | 'failed'> {
  const db = deps.db;
  switch (outcome.kind) {
    case 'succeeded':
      await applyPaymentSucceeded(deps, paymentId, { providerRef: outcome.providerRef, chargeRef: outcome.chargeRef, card: outcome.card });
      return 'charged';
    case 'processing':
      await db.update(payments).set({ status: 'feldolgozas', stripePaymentIntentId: outcome.providerRef.startsWith('demo_') ? null : outcome.providerRef, updatedAt: deps.now() }).where(eq(payments.id, paymentId));
      return 'pending';
    case 'requires_auth':
      await applyChargeFailure(deps, paymentId, { kind: 'requires_auth', providerRef: outcome.providerRef, code: 'authentication_required' });
      return 'failed';
    case 'declined':
      await applyChargeFailure(deps, paymentId, { kind: 'declined', providerRef: outcome.providerRef, code: outcome.code, declineCode: outcome.declineCode ?? null });
      return 'failed';
    case 'uncertain':
      await db.update(payments).set({ status: 'bizonytalan', failureCode: outcome.error.slice(0, 60), updatedAt: deps.now() }).where(eq(payments.id, paymentId));
      return 'pending';
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.7 one-off fees
// ---------------------------------------------------------------------------------------------------------------------
export async function startFeePaymentK29(
  deps: Deps,
  cl: ClientRow,
  chargeId: string,
  i: { platform: 'app' | 'web'; useSavedCard: boolean; returnOrigin?: string },
  meta: { initiated?: 'ugyfel' | 'admin'; byUserId?: string | null; offSession?: boolean } = {},
): Promise<FeePayResultK29> {
  const db = deps.db;
  const [ch] = await db.select().from(feeCharges).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.clientId, cl.id))).limit(1);
  if (!ch) throw E.notFound();
  if (ch.status !== 'nyitott') throw E.conflict('Ezt a díjat már nem kell kifizetni.');
  if (deps.cfg.appEnv === 'production' && ch.demo) throw new ApiError(409, 'fee_not_payable', await deps.content.get('dij.not_payable'));
  if (ch.amountHuf < PAYMENT_RULES.minChargeHuf) throw E.conflict('Ezt a díjat nem lehet kártyával fizetni.');
  const provName = newProviderName(deps);
  const prov = providerOf(deps, provName);
  const u = await userOf(db, cl);
  if (!u) throw E.notFound();
  const suffix = feeSuffix(ch.kind as FeeKind);
  const label = FEE_KIND_LABELS[ch.kind as FeeKind] ?? 'Díj';
  const card = await activeCardOf(db, cl.id, provName);
  if (i.useSavedCard && card?.stripePaymentMethodId) {
    const today = todayBudapest(deps.now());
    const idem = `${meta.initiated === 'admin' ? 'dij-admin' : 'dij'}:${ch.id}:${today}`;
    const [existing] = await db.select().from(payments).where(eq(payments.idempotencyKey, idem)).limit(1);
    if (existing) return feeResultOf(deps, existing, ch.id, card);
    // k7c2: every earlier attempt at this fee is closed (or found paid) before money moves again
    await assertNoOtherFeeAttempt(deps, ch.id);
    const now = deps.now();
    const id = randomUUID();
    const urls = backUrls(deps, { platform: i.platform, returnOrigin: i.returnOrigin, cel: 'dij', paymentId: id, withSessionTemplate: false });
    const params: SavedChargeParams = {
      customerRef: card.stripeCustomerId ?? (prov.name === 'stripe' ? await customerRefOf(deps, db, prov, cl, u.email) : null),
      paymentMethodRef: card.stripePaymentMethodId,
      amountHuf: ch.amountHuf,
      offSession: Boolean(meta.offSession),
      ...(meta.offSession ? {} : { returnUrl: urls.success }),
      description: `Adózz – ${label}`.slice(0, 120),
      statementSuffix: suffix,
      metadata: { payment_id: id, client_id: cl.id, kind: 'egyszeri', fee_charge_id: ch.id },
    };
    const [inserted] = await db
      .insert(payments)
      .values({
        id,
        clientId: cl.id,
        feeChargeId: ch.id,
        kind: 'egyszeri',
        provider: prov.name,
        mode: modeOfProvider(prov),
        amountHuf: ch.amountHuf,
        status: 'letrehozva',
        initiated: meta.initiated ?? 'ugyfel',
        offSession: Boolean(meta.offSession),
        attemptDay: today,
        idempotencyKey: idem,
        paymentMethodId: card.id,
        platform: i.platform,
        returnOrigin: urls.originKey,
        cel: 'dij',
        chargeParams: params,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });
    if (!inserted) {
      // a parallel tap of the same day won the insert: its result, never a second charge
      const [winner] = await db.select().from(payments).where(eq(payments.idempotencyKey, idem)).limit(1);
      if (winner) return feeResultOf(deps, winner, ch.id, card);
      throw E.conflict('A fizetés már folyamatban van.');
    }
    let outcome: ChargeOutcome;
    try {
      outcome = await prov.chargeSaved({
        paymentId: id,
        ...withCanonicalMeta(params),
        idempotencyKey: idem,
        ...(prov.name === 'demo' ? { demoScenario: demoScenarioOf(u.email) } : {}),
      });
    } catch (e) {
      await db.update(payments).set({ status: 'sikertelen', failureCode: `hiba:${e instanceof ProviderError ? e.code : 'error'}`.slice(0, 60), appliedAt: deps.now(), updatedAt: deps.now() }).where(eq(payments.id, id));
      throw E.upstream('A fizetés most nem indult el. Próbáld újra pár perc múlva.');
    }
    await audit(db, { action: meta.initiated === 'admin' ? 'admin.fee_charged_off_session' : 'fee.pay_started', actorUserId: meta.byUserId ?? cl.userId, actorRole: meta.initiated === 'admin' ? 'admin' : 'client', targetType: 'fee_charge', targetId: ch.id, clientId: cl.id, details: { provider: prov.name, savedCard: true, outcome: outcome.kind } });
    if (outcome.kind === 'requires_auth') {
      await db.update(payments).set({ status: 'hitelesites_kell', failureCode: 'authentication_required', stripePaymentIntentId: outcome.providerRef && !outcome.providerRef.startsWith('demo_') ? outcome.providerRef : null, updatedAt: deps.now() }).where(eq(payments.id, id));
      if (outcome.redirectUrl) return { result: 'atiranyitas', chargeId: ch.id, paymentId: id, url: outcome.redirectUrl, amountHuf: ch.amountHuf };
      return { result: 'sikertelen', chargeId: ch.id, paymentId: id, amountHuf: ch.amountHuf, message: PAYMENT_FAIL_TEXTS.hitelesites.title, code: 'authentication_required' };
    }
    if (outcome.kind === 'declined') {
      await applyChargeFailure(deps, id, { kind: 'declined', providerRef: outcome.providerRef, code: outcome.code, declineCode: outcome.declineCode ?? null });
      return { result: 'sikertelen', chargeId: ch.id, paymentId: id, amountHuf: ch.amountHuf, message: declineMessage(outcome.code, outcome.declineCode ?? null), code: outcome.code };
    }
    if (outcome.kind === 'uncertain') {
      await db.update(payments).set({ status: 'bizonytalan', failureCode: outcome.error.slice(0, 60), updatedAt: deps.now() }).where(eq(payments.id, id));
      return { result: 'sikertelen', chargeId: ch.id, paymentId: id, amountHuf: ch.amountHuf, message: 'Most nem értük el a bankot. Pár perc múlva megnézzük, sikerült-e – addig ne fizesd ki újra.', code: 'bizonytalan' };
    }
    if (outcome.kind === 'processing') {
      await db.update(payments).set({ status: 'feldolgozas', stripePaymentIntentId: outcome.providerRef, updatedAt: deps.now() }).where(eq(payments.id, id));
      return { result: 'sikertelen', chargeId: ch.id, paymentId: id, amountHuf: ch.amountHuf, message: PAYMENT_SCREEN_TEXTS.result.waiting, code: 'feldolgozas' };
    }
    await applyPaymentSucceeded(deps, id, { providerRef: outcome.providerRef, chargeRef: outcome.chargeRef, card: outcome.card });
    return { result: 'sikeres', chargeId: ch.id, paymentId: id, amountHuf: ch.amountHuf, cardLabel: cardView(card, deps.now()).label };
  }
  if (meta.offSession) throw E.conflict('Az ügyfélnek nincs mentett kártyája.');
  const again = await reopenable(deps, db, cl.id, ['egyszeri'], { feeChargeId: ch.id });
  const reuse = again && again.provider === provName ? again : null;
  // k7c2 B2/B3: "Másik kártyával" only when no other attempt of this fee can still take money (the open page of THIS
  // fee is handed back instead of a new one)
  await assertNoOtherFeeAttempt(deps, ch.id, { keepId: reuse?.id ?? null });
  if (reuse) {
    const r = hostedResult(deps, reuse);
    return { result: 'atiranyitas', chargeId: ch.id, paymentId: reuse.id, url: r.url, amountHuf: ch.amountHuf };
  }
  const hosted = await openHosted(deps, prov, {
    cl,
    email: u.email,
    kind: 'egyszeri',
    hostedMode: 'payment',
    amountHuf: ch.amountHuf,
    period: null,
    subscriptionId: null,
    feeChargeId: ch.id,
    // k7c2 (round-1 A3): a one-off fee never saves the card (no setup_future_usage) – a card for the monthly charges
    // is saved only together with the card consent (first month, card change, Fizesd ki)
    saveCard: false,
    cel: 'dij',
    platform: i.platform,
    returnOrigin: i.returnOrigin,
    consentId: null,
    productName: `Adózz – ${label}`,
    description: `Adózz – ${label}`.slice(0, 120),
    statementSuffix: suffix,
    submitMessage: null,
  });
  return { result: 'atiranyitas', chargeId: ch.id, paymentId: hosted.paymentId, url: hosted.url, amountHuf: ch.amountHuf };
}

function feeResultOf(deps: Deps, p: PaymentRow, chargeId: string, card: PmRow): FeePayResultK29 {
  if (p.status === 'sikeres') return { result: 'sikeres', chargeId, paymentId: p.id, amountHuf: p.amountHuf, cardLabel: cardView(card, deps.now()).label };
  return { result: 'sikertelen', chargeId, paymentId: p.id, amountHuf: p.amountHuf, message: p.status === 'sikertelen' ? `${declineMessage(p.failureCode, p.declineCode)} Ma ezzel a kártyával már nem próbáljuk újra.` : PAYMENT_SCREEN_TEXTS.result.waiting, code: p.failureCode ?? p.status };
}

/**
 * k7c2 (round-1 A1/A2, round-2 B2/B3/B2b): before a new attempt at a fee, every earlier attempt of the SAME fee that could
 * still take money is closed at the provider (hosted page expired, PaymentIntent waiting for the bank cancelled) – or
 * found paid, which is applied. Throws 409 when the fee got paid meanwhile, or when an attempt is still uncertain /
 * processing (money may be moving: "addig ne fizesd ki újra" must hold on the server too). `keepId`: the open hosted
 * page of this fee that is handed back instead of a new one.
 */
async function assertNoOtherFeeAttempt(deps: Deps, chargeId: string, o: { keepId?: string | null } = {}): Promise<void> {
  const db = deps.db;
  const now = deps.now();
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.feeChargeId, chargeId), eq(payments.kind, 'egyszeri'), inArray(payments.status, ['letrehozva', 'hitelesites_kell', 'feldolgozas', 'bizonytalan'])));
  let busy = false;
  for (const r of rows) {
    if (o.keepId && r.id === o.keepId) continue;
    if (r.status === 'feldolgozas' || r.status === 'bizonytalan') {
      busy = true;
      continue;
    }
    try {
      const prov = providerOf(deps, r.provider);
      if (r.stripeCheckoutSessionId && r.status === 'letrehozva') {
        // a hosted page of this fee
        if (r.provider === 'stripe') {
          await prov.expireHosted(r.stripeCheckoutSessionId);
          const h = await prov.retrieveHosted(r.stripeCheckoutSessionId);
          if (h.paid) {
            await applyHosted(deps, r.id, h);
            continue;
          }
          if (h.status === 'open') {
            busy = true;
            continue;
          }
        }
        await markCancelled(deps, r.id);
      } else if (r.stripePaymentIntentId) {
        // a saved-card charge waiting for the bank's confirmation: cancelled at Stripe, unless it went through
        await prov.cancelPending(r.stripePaymentIntentId);
        const st = await prov.retrievePayment(r.stripePaymentIntentId);
        if (st.status === 'succeeded' || st.status === 'processing') {
          await applyIntentState(deps, r.id, { ...st });
          if (st.status === 'processing') busy = true;
          continue;
        }
        await markCancelledAny(deps, r.id);
      } else if (r.status === 'hitelesites_kell') {
        await markCancelledAny(deps, r.id);
      } else if (r.createdAt.getTime() > now.getTime() - 10 * 60_000) {
        // a saved-card request still on its way (a parallel tap)
        busy = true;
      } else if (r.provider === 'stripe') {
        // an old attempt without any reference: find it by our id before anything new
        const st = await prov.findPaymentByOurId(r.id);
        if (st) {
          await applyIntentState(deps, r.id, st);
          if (st.status !== 'canceled' && st.status !== 'failed') busy = true;
        } else await markCancelledAny(deps, r.id);
      } else await markCancelledAny(deps, r.id);
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'fee attempt settle failed');
      busy = true;
    }
  }
  const [ch] = await db.select({ status: feeCharges.status }).from(feeCharges).where(eq(feeCharges.id, chargeId)).limit(1);
  if (ch && ch.status !== 'nyitott') throw E.conflict('Ezt a díjat már kifizetted.');
  if (busy) throw new ApiError(409, 'fizetes_folyamatban', 'Az előző fizetésed még folyamatban van. Pár perc múlva megnézzük, sikerült-e – addig ne fizesd ki újra.');
}

/** k7c2 A4: refunds a 'duplikalt' row in full; a failure marks it refund-pending (the reconcile job retries). true = done. */
async function refundDuplicate(deps: Deps, paymentId: string, reason: string): Promise<boolean> {
  try {
    await refundPayment(deps, { paymentId, amountHuf: -1, reason, byUserId: null, duplicate: true });
    await deps.db.update(payments).set({ refundPendingAt: null }).where(eq(payments.id, paymentId));
    return true;
  } catch (e) {
    log().error({ err: safeErr(e) }, 'duplicate refund failed – admin alert, the reconcile job retries');
    await deps.db.update(payments).set({ refundPendingAt: deps.now() }).where(and(eq(payments.id, paymentId), isNull(payments.refundPendingAt)));
    return false;
  }
}

function feeSuffix(kind: FeeKind): string {
  if (kind === 'eves_zaras') return STRIPE_STATEMENT_SUFFIXES.eves_zaras;
  if (kind === 'valtozas_egyszeru' || kind === 'valtozas_jogallas') return STRIPE_STATEMENT_SUFFIXES.valtozas;
  if (kind.startsWith('igazolas_')) return STRIPE_STATEMENT_SUFFIXES.igazolas;
  if (kind === 'megszuntetes') return STRIPE_STATEMENT_SUFFIXES.megszuntetes;
  return STRIPE_STATEMENT_SUFFIXES.egyeb;
}

/** §29.1.15: the console's "Levonom a mentett kártyáról" – only charges the client ordered himself (never purpose 'admin'). */
export async function chargeFeeOffSessionByAdmin(deps: Deps, i: { chargeId: string; byUserId: string; reason: string }): Promise<ChargeOutcome> {
  const [ch] = await deps.db.select().from(feeCharges).where(eq(feeCharges.id, i.chargeId)).limit(1);
  if (!ch) throw E.notFound();
  if ((ch.purpose as { type: string }).type === 'admin') throw E.conflict('Az általad felvett díjat csak az ügyfél fizetheti ki az appban.');
  const [cl] = await deps.db.select().from(clients).where(eq(clients.id, ch.clientId)).limit(1);
  if (!cl) throw E.notFound();
  const r = await startFeePaymentK29(deps, cl, ch.id, { platform: 'web', useSavedCard: true }, { initiated: 'admin', byUserId: i.byUserId, offSession: true });
  await audit(deps.db, { action: 'admin.fee.charge_now', actorUserId: i.byUserId, actorRole: 'admin', targetType: 'fee_charge', targetId: ch.id, clientId: ch.clientId, details: { reason: i.reason.slice(0, 300), result: r.result, amountHuf: ch.amountHuf } });
  if (r.result === 'sikeres') return { kind: 'succeeded', providerRef: r.paymentId, chargeRef: null, card: { brand: '', last4: '', expMonth: null, expYear: null, paymentMethodRef: null } };
  if (r.result === 'atiranyitas') return { kind: 'requires_auth', providerRef: r.paymentId, redirectUrl: null };
  return r.code === 'bizonytalan' ? { kind: 'uncertain', error: 'bizonytalan' } : { kind: 'declined', providerRef: r.paymentId, code: r.code };
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.10 refunds
// ---------------------------------------------------------------------------------------------------------------------
export async function refundPayment(
  deps: Deps,
  i: { paymentId: string; amountHuf: number; reason: string; byUserId: string | null; duplicate?: boolean },
): Promise<{ refundedHuf: number; invoiceAction: 'sztorno' | 'helyesbito' | 'nincs' | 'hiba' }> {
  const db = deps.db;
  const [p0] = await db.select().from(payments).where(eq(payments.id, i.paymentId)).limit(1);
  if (!p0) throw E.notFound();
  // k7c2 A4: a duplicate whose automatic refund failed can be refunded from the console too
  if (p0.status !== 'sikeres' && p0.status !== 'duplikalt') throw E.conflict('Csak sikeres fizetést lehet visszatéríteni.');
  if (i.reason.trim().length < 5 && !i.duplicate) throw E.validation({ reason: 'Írd le röviden az okát (legalább 5 karakter).' });
  const prov = providerOf(deps, p0.provider);
  if (p0.provider === 'stripe' && !p0.stripePaymentIntentId) throw E.conflict('Ehhez a fizetéshez nincs Stripe-azonosító.');
  // k7c2 A9/B6: the refund is recorded BEFORE Stripe is called (row locked), so the charge.refunded webhook of our own
  // refund – even when it arrives first – finds nothing new and never tells the client twice or alerts the admin.
  const now = deps.now();
  let n = 0;
  let amount = 0;
  let p = p0;
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(payments).where(eq(payments.id, i.paymentId)).limit(1).for('update');
    if (!cur) throw E.notFound();
    const refundable = cur.amountHuf - cur.refundedHuf;
    amount = i.amountHuf === -1 ? refundable : i.amountHuf;
    if (!Number.isInteger(amount) || amount <= 0 || amount > refundable) throw E.validation({ amountHuf: `Legfeljebb ${fmtHuf(refundable)} Ft téríthető vissza.` });
    n = (cur.refunds?.length ?? 0) + 1;
    await tx
      .update(payments)
      .set({ refundedHuf: cur.refundedHuf + amount, refunds: [...(cur.refunds ?? []), { n, amountHuf: amount, refundRef: null, status: 'folyamatban', reason: i.reason.slice(0, 200), by: i.byUserId, at: now.toISOString() }], updatedAt: now })
      .where(eq(payments.id, cur.id));
    p = cur;
  });
  const undo = async () => {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(payments).where(eq(payments.id, p.id)).limit(1).for('update');
      if (!cur) return;
      await tx
        .update(payments)
        .set({ refundedHuf: Math.max(0, cur.refundedHuf - amount), refunds: (cur.refunds ?? []).filter((r) => !(r.n === n && r.status === 'folyamatban')), updatedAt: deps.now() })
        .where(eq(payments.id, cur.id));
    });
  };
  const isDup = Boolean(i.duplicate);
  let res: { refundRef: string; status: 'succeeded' | 'pending' | 'failed' };
  try {
    res = await prov.refund({ providerRef: p.stripePaymentIntentId ?? `demo_${p.id}`, amountHuf: amount, idempotencyKey: `${isDup ? 'refund:dup' : 'refund'}:${p.id}${isDup ? '' : `:${n}`}`, reason: i.reason.slice(0, 200), metadata: { payment_id: p.id, ...(i.byUserId ? { by_user: i.byUserId } : {}) } });
  } catch (e) {
    log().warn({ err: safeErr(e) }, 'refund failed');
    await undo();
    throw E.upstream('A visszatérítés most nem sikerült. Próbáld újra pár perc múlva.');
  }
  if (res.status === 'failed') {
    await undo();
    throw E.upstream('A Stripe nem fogadta el a visszatérítést.');
  }
  const total = p.refundedHuf + amount;
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(payments).where(eq(payments.id, p.id)).limit(1).for('update');
    if (!cur) return;
    await tx
      .update(payments)
      .set({ refunds: (cur.refunds ?? []).map((r) => (r.n === n && r.status === 'folyamatban' ? { ...r, refundRef: res.refundRef, status: res.status } : r)), ...(p.status === 'duplikalt' ? { refundPendingAt: null } : {}), updatedAt: deps.now() })
      .where(eq(payments.id, cur.id));
  });
  const invoiceAction = await invoiceActionForRefund(deps, p, amount, total, n, i.reason);
  // (a duplicate's refund never touches the fee: the fee stays paid by the other payment)
  if (p.kind === 'egyszeri' && p.feeChargeId && total >= p.amountHuf && p.status !== 'duplikalt') {
    await db.update(feeCharges).set({ status: 'visszaterites_megtortent', refundNote: i.reason.slice(0, 500) }).where(and(eq(feeCharges.id, p.feeChargeId), inArray(feeCharges.status, ['fizetve', 'visszaterites_kell'])));
  }
  const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, p.clientId)).limit(1);
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'payment_refunded', params: { osszeg: fmtHuf(amount) }, link: '/fiok/dijak' });
  await audit(db, { action: i.duplicate ? 'payment.duplicate_refund' : 'admin.payment_refunded', actorUserId: i.byUserId, actorRole: i.byUserId ? 'admin' : 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { amountHuf: amount, reason: i.reason.slice(0, 200), invoiceAction } });
  return { refundedHuf: total, invoiceAction };
}

async function invoiceActionForRefund(deps: Deps, p: PaymentRow, amount: number, total: number, n: number, reason: string): Promise<'sztorno' | 'helyesbito' | 'nincs' | 'hiba'> {
  const db = deps.db;
  if (!p.feeInvoiceId || p.status === 'duplikalt') return 'nincs';
  try {
    const [inv] = await db.select().from(feeInvoices).where(eq(feeInvoices.id, p.feeInvoiceId)).limit(1);
    if (!inv) return 'nincs';
    const [corr] = await db.select({ id: feeInvoices.id }).from(feeInvoices).where(and(eq(feeInvoices.stornoOf, inv.id), eq(feeInvoices.kind, 'helyesbito'))).limit(1);
    let id: string | null;
    let action: 'sztorno' | 'helyesbito';
    if (total >= p.amountHuf && !corr) {
      id = await queueStorno(deps, db, inv.id, `Visszatérítés: ${reason}`.slice(0, 200));
      action = 'sztorno';
    } else {
      id = await queueCorrection(deps, db, inv.id, amount, n, reason);
      action = 'helyesbito';
    }
    if (id) await processInvoice(deps, id).catch(() => undefined);
    return id ? action : 'hiba';
  } catch (e) {
    log().warn({ err: safeErr(e) }, 'refund invoice action failed');
    return 'hiba';
  }
}

/** charge.refunded: a refund made outside our console (Stripe Dashboard) is applied the same way + admin alert. */
async function syncRefund(deps: Deps, p: PaymentRow, st: ProviderPaymentState): Promise<void> {
  const db = deps.db;
  if (st.refundedHuf <= p.refundedHuf) return;
  const delta = st.refundedHuf - p.refundedHuf;
  const n = (p.refunds?.length ?? 0) + 1;
  const now = deps.now();
  await db
    .update(payments)
    .set({ refundedHuf: st.refundedHuf, refunds: [...(p.refunds ?? []), { n, amountHuf: delta, refundRef: null, status: 'succeeded', reason: 'Stripe Dashboard', by: null, at: now.toISOString() }], updatedAt: now })
    .where(eq(payments.id, p.id));
  const action = await invoiceActionForRefund(deps, p, delta, st.refundedHuf, n, 'Stripe Dashboard');
  const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, p.clientId)).limit(1);
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'payment_refunded', params: { osszeg: fmtHuf(delta) }, link: '/fiok/dijak' });
  await audit(db, { action: 'payment.refund_outside', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { amountHuf: delta, invoiceAction: action } });
  await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(delta) }, '/admin/fizetesek', 'kulso_visszaterites').catch(() => undefined);
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.8 webhooks
// ---------------------------------------------------------------------------------------------------------------------
export const STRIPE_BAD_PER_HOUR = 30;

export async function handleStripeWebhook(deps: Deps, raw: string, headers: Record<string, string | undefined>, meta: { ipHmac?: string; requestId?: string } = {}): Promise<{ status: 200 | 400 | 500; body: Record<string, unknown> }> {
  const prov = deps.payments.stripe;
  if (!prov) return { status: 400, body: { error: 'not_configured' } };
  const ev = prov.verifyWebhook(raw, headers);
  if (!ev) {
    // unauthenticated noise: no audit row (the append-only log must not be floodable), one log line per IP per hour
    const n = deps.limiter.hit(`stripe-bad:${meta.ipHmac ?? '-'}`, STRIPE_BAD_PER_HOUR, 3600_000);
    if (n.count === 1) log().warn({ ipHmac: meta.ipHmac, requestId: meta.requestId }, 'stripe webhook: bad signature');
    return { status: 400, body: { error: 'bad_signature' } };
  }
  const db = deps.db;
  if (ev.livemode !== (prov.mode === 'live')) {
    await audit(db, { action: 'payment.webhook_mode_mismatch', actorRole: 'system', details: { type: ev.type, livemode: ev.livemode } });
    return { status: 200, body: { ignored: true } };
  }
  await db.insert(stripeEvents).values({ id: ev.id, type: ev.type, mode: ev.livemode ? 'live' : 'test', stripeCreatedAt: ev.created, receivedAt: deps.now() }).onConflictDoNothing();
  // k7c2 A9/B6: one delivery works on an event at a time – claimed atomically (a claim older than 5 minutes is stale)
  const staleClaim = new Date(deps.now().getTime() - 5 * 60_000);
  const [claimed] = await db
    .update(stripeEvents)
    .set({ claimedAt: deps.now() })
    .where(and(eq(stripeEvents.id, ev.id), isNull(stripeEvents.processedAt), or(isNull(stripeEvents.claimedAt), lt(stripeEvents.claimedAt, staleClaim))))
    .returning({ id: stripeEvents.id });
  if (!claimed) {
    const [row] = await db.select().from(stripeEvents).where(eq(stripeEvents.id, ev.id)).limit(1);
    if (row?.processedAt) return { status: 200, body: { received: true, duplicate: true } };
    // another delivery is processing it right now: Stripe retries this one later (then it is a plain duplicate)
    return { status: 500, body: { error: 'in_progress' } };
  }
  try {
    await processStripeEvent(deps, prov, ev.type, ev.objectId, ev.object);
    await db.update(stripeEvents).set({ processedAt: deps.now(), claimedAt: null, attempts: sql`${stripeEvents.attempts} + 1`, lastError: null }).where(eq(stripeEvents.id, ev.id));
    await db.insert(systemState).values({ key: 'stripe.last_webhook', value: { at: deps.now().toISOString(), type: ev.type } }).onConflictDoUpdate({ target: systemState.key, set: { value: { at: deps.now().toISOString(), type: ev.type }, updatedAt: deps.now() } });
    return { status: 200, body: { received: true } };
  } catch (e) {
    await db.update(stripeEvents).set({ claimedAt: null, attempts: sql`${stripeEvents.attempts} + 1`, lastError: safeStripeError(e).slice(0, 200) }).where(eq(stripeEvents.id, ev.id));
    log().error({ err: safeErr(e), type: ev.type }, 'stripe webhook processing failed');
    return { status: 500, body: { error: 'processing_failed' } };
  }
}

async function rowByRefs(db: DbOrTx, o: { session?: string | null; intent?: string | null; paymentId?: string | null }): Promise<PaymentRow | null> {
  if (o.session) {
    const [r] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, o.session)).limit(1);
    if (r) return r;
  }
  if (o.intent) {
    const [r] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, o.intent)).limit(1);
    if (r) return r;
  }
  if (o.paymentId && /^[0-9a-f-]{36}$/.test(o.paymentId)) {
    const [r] = await db.select().from(payments).where(eq(payments.id, o.paymentId)).limit(1);
    if (r) return r;
  }
  return null;
}

/** Order-independent handlers: each re-reads the object from Stripe and acts on its CURRENT state. */
async function processStripeEvent(deps: Deps, prov: PaymentProvider, type: string, objectId: string, obj: Record<string, unknown>): Promise<void> {
  const db = deps.db;
  const metaPid = ((obj.metadata as Record<string, string> | undefined) ?? {}).payment_id ?? null;
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.expired': {
      const p = await rowByRefs(db, { session: objectId, paymentId: metaPid });
      if (!p) return;
      await applyHosted(deps, p.id, await prov.retrieveHosted(objectId));
      return;
    }
    case 'setup_intent.succeeded': {
      const p = await rowByRefs(db, { paymentId: metaPid });
      if (!p?.stripeCheckoutSessionId) return;
      await applyHosted(deps, p.id, await prov.retrieveHosted(p.stripeCheckoutSessionId));
      return;
    }
    case 'payment_intent.succeeded': {
      const p = await rowByRefs(db, { intent: objectId, paymentId: metaPid });
      if (!p) return;
      const st = await prov.retrievePayment(objectId);
      if (st.status === 'succeeded') await applyPaymentSucceeded(deps, p.id, { providerRef: st.providerRef, chargeRef: st.chargeRef, card: st.card, customerRef: st.customerRef, amountHuf: st.amountHuf, currency: st.currency ?? null });
      return;
    }
    case 'payment_intent.payment_failed': {
      const p = await rowByRefs(db, { intent: objectId, paymentId: metaPid });
      // a failed try INSIDE Checkout: the client is still on the page – nothing to do
      if (!p || p.stripeCheckoutSessionId) return;
      await applyIntentState(deps, p.id, await prov.retrievePayment(objectId));
      return;
    }
    case 'charge.refunded': {
      const pi = (obj.payment_intent as string | null) ?? null;
      const p = await rowByRefs(db, { intent: pi });
      if (!p || !pi) return;
      await syncRefund(deps, p, await prov.retrievePayment(pi));
      return;
    }
    case 'charge.dispute.created': {
      const pi = (obj.payment_intent as string | null) ?? null;
      const p = await rowByRefs(db, { intent: pi });
      if (!p) return;
      await db.update(payments).set({ disputeStatus: String(obj.status ?? 'needs_response').slice(0, 40), updatedAt: deps.now() }).where(eq(payments.id, p.id));
      await audit(db, { action: 'payment.dispute', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { status: obj.status ?? null } });
      await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(p.amountHuf) }, '/admin/fizetesek');
      return;
    }
    // k7c2: a refund that failed later (the money did not go back) – our refunded sum follows Stripe's, the admin acts
    case 'refund.failed':
    case 'charge.refund.updated': {
      if (type === 'charge.refund.updated' && obj.status !== 'failed' && obj.status !== 'canceled') return;
      const pi = (obj.payment_intent as string | null) ?? null;
      const p = await rowByRefs(db, { intent: pi });
      if (!p || !pi) return;
      const st = await prov.retrievePayment(pi);
      if (st.refundedHuf >= p.refundedHuf) return;
      const back = p.refundedHuf - st.refundedHuf;
      await db
        .update(payments)
        .set({ refundedHuf: st.refundedHuf, refunds: (p.refunds ?? []).map((r) => (r.refundRef === objectId ? { ...r, status: 'failed' } : r)), updatedAt: deps.now() })
        .where(eq(payments.id, p.id));
      await audit(db, { action: 'payment.refund_failed', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { amountHuf: back } });
      await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(back) }, '/admin/fizetesek', 'visszaterites_hiba');
      return;
    }
    // k7c2: a lost dispute = the money went back to the client → storno / corrective invoice + admin alert
    case 'charge.dispute.closed': {
      const pi = (obj.payment_intent as string | null) ?? null;
      const p = await rowByRefs(db, { intent: pi });
      if (!p) return;
      const status = String(obj.status ?? '').slice(0, 40);
      await db.update(payments).set({ disputeStatus: status || 'closed', updatedAt: deps.now() }).where(eq(payments.id, p.id));
      await audit(db, { action: 'payment.dispute_closed', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { status } });
      if (status !== 'lost') return;
      const lostHuf = Math.min(p.amountHuf - p.refundedHuf, typeof obj.amount === 'number' ? Math.round(obj.amount / 100) : p.amountHuf);
      if (lostHuf > 0 && !(p.refunds ?? []).some((r) => r.refundRef === objectId)) {
        const n = (p.refunds?.length ?? 0) + 1;
        const total = p.refundedHuf + lostHuf;
        await db
          .update(payments)
          .set({ refundedHuf: total, refunds: [...(p.refunds ?? []), { n, amountHuf: lostHuf, refundRef: objectId, status: 'dispute_lost', reason: 'Vitatott terhelés (elvesztve)', by: null, at: deps.now().toISOString() }], updatedAt: deps.now() })
          .where(eq(payments.id, p.id));
        await invoiceActionForRefund(deps, p, lostHuf, total, n, 'Vitatott terhelés');
      }
      await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(lostHuf > 0 ? lostHuf : p.amountHuf) }, '/admin/fizetesek', 'vita_elveszett');
      return;
    }
    case 'payment_method.automatically_updated': {
      const card = obj.card as CardInfo | null;
      if (!card) return;
      await db.update(paymentMethods).set({ brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear }).where(eq(paymentMethods.stripePaymentMethodId, objectId));
      return;
    }
    default:
      return;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.9 reconciliation (every 15 min)
// ---------------------------------------------------------------------------------------------------------------------
export async function jobPaymentsReconcile(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const now = deps.now();
  const today = todayBudapest(now);
  const out = { checked: 0, applied: 0, expired: 0, retried: 0, stuckEvents: 0, errors: 0 };
  const older = new Date(now.getTime() - PAYMENT_RULES.reconcileOlderThanMinutes * 60_000);
  const sessionOlder = new Date(now.getTime() - PAYMENT_RULES.sessionStaleMinutes * 60_000);
  const rows = await db
    .select()
    .from(payments)
    .where(
      or(
        and(eq(payments.status, 'letrehozva'), sql`${payments.stripeCheckoutSessionId} is not null`, lt(payments.createdAt, sessionOlder)),
        and(inArray(payments.status, ['feldolgozas', 'bizonytalan', 'hitelesites_kell']), lt(payments.updatedAt, older)),
      ),
    )
    .orderBy(asc(payments.updatedAt))
    .limit(PAYMENT_RULES.reconcileBatch);
  for (const p of rows) {
    out.checked++;
    try {
      if (p.provider === 'demo') {
        if (p.status === 'letrehozva' && p.hostedExpiresAt && p.hostedExpiresAt < now) {
          await markCancelled(deps, p.id);
          out.expired++;
        }
        continue;
      }
      const prov = providerOf(deps, p.provider);
      // a confirmation nobody gave in 3 days: cancelled at Stripe (the scheduler / Fizesd ki make a new attempt)
      if (p.status === 'hitelesites_kell' && p.createdAt < new Date(now.getTime() - 3 * 86_400_000)) {
        if (p.stripePaymentIntentId) await prov.cancelPending(p.stripePaymentIntentId);
        await markCancelledAny(deps, p.id);
        out.expired++;
        continue;
      }
      if (p.status === 'letrehozva' && p.stripeCheckoutSessionId) {
        await applyHosted(deps, p.id, await prov.retrieveHosted(p.stripeCheckoutSessionId));
        out.applied++;
      } else if (p.stripePaymentIntentId) {
        await applyIntentState(deps, p.id, await prov.retrievePayment(p.stripePaymentIntentId));
        out.applied++;
      } else if (p.status === 'bizonytalan') {
        if (p.attemptDay === today && p.chargeParams) {
          // same day: the SAME idempotency key with the SAME parameters (k7c2 A7: stored at the first send, byte-identical
          // – another description made Stripe answer StripeIdempotencyError) → Stripe returns the original result
          const outcome = await prov.chargeSaved({ paymentId: p.id, ...withCanonicalMeta(p.chargeParams), idempotencyKey: p.idempotencyKey });
          await applyOutcome(deps, p.id, outcome);
          out.retried++;
        } else if (p.attemptDay === today) {
          // an older row without stored parameters: never re-send with guessed ones – search by our id
          const st = await prov.findPaymentByOurId(p.id);
          if (st) {
            await applyIntentState(deps, p.id, st);
            out.applied++;
          }
        } else {
          // a later day: find it by our id before any new attempt
          const st = await prov.findPaymentByOurId(p.id);
          if (st) await applyIntentState(deps, p.id, st);
          else await db.update(payments).set({ status: 'sikertelen', failureCode: 'nem_jott_letre', appliedAt: now, updatedAt: now }).where(and(eq(payments.id, p.id), eq(payments.status, 'bizonytalan')));
          out.applied++;
        }
      }
    } catch (e) {
      out.errors++;
      log().warn({ err: safeErr(e) }, 'reconcile row failed');
    }
  }
  // k7c2 A4: duplicates whose automatic refund failed – tried again every run until done (the admin was told)
  const pending = await db.select().from(payments).where(and(eq(payments.status, 'duplikalt'), sql`${payments.refundPendingAt} is not null`)).limit(PAYMENT_RULES.reconcileBatch);
  for (const p of pending) {
    if (p.refundedHuf >= p.amountHuf) {
      await db.update(payments).set({ refundPendingAt: null }).where(eq(payments.id, p.id));
      continue;
    }
    if (await refundDuplicate(deps, p.id, p.kind === 'egyszeri' ? 'Dupla fizetés ugyanarra a díjra' : 'Dupla fizetés ugyanarra a hónapra')) {
      out.retried++;
      await audit(db, { action: 'payment.duplicate_refunded', actorRole: 'system', targetType: 'payment', targetId: p.id, clientId: p.clientId, details: { amountHuf: p.amountHuf, late: true } });
      await alertAdmins(deps, 'payment_disputed', p.clientId, { osszeg: fmtHuf(p.amountHuf) }, '/admin/fizetesek', p.kind === 'egyszeri' ? 'dupla_dij' : 'dupla').catch(() => undefined);
    } else out.errors++;
  }
  const [stuck] = await db.select({ n: sql<number>`count(*)::int` }).from(stripeEvents).where(and(isNull(stripeEvents.processedAt), sql`${stripeEvents.attempts} >= ${PAYMENT_RULES.stuckEventAttempts}`));
  out.stuckEvents = Number(stuck?.n ?? 0);
  await db.insert(systemState).values({ key: 'payments.reconcile', value: { at: now.toISOString(), ...out } }).onConflictDoUpdate({ target: systemState.key, set: { value: { at: now.toISOString(), ...out }, updatedAt: now } });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.6 pre-debit reminder, §29.1.5 suspension warning
// ---------------------------------------------------------------------------------------------------------------------
export async function jobPredebit(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const target = addDays(today, PAYMENT_RULES.predebitDaysBefore);
  const out = { notified: 0, noCard: 0, free: 0 };
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, 'active'), eq(subscriptions.cancelAtPeriodEnd, false), inArray(subscriptions.provider, ['stripe', 'demo']), sql`${subscriptions.nextChargeAt} is not null`));
  const { notifyOnce } = await import('./emlekezteto.js');
  for (const s of subs) {
    if (todayBudapest(s.nextChargeAt!) !== target || s.predebitNotifiedFor === target) continue;
    const [cl] = await db.select().from(clients).where(eq(clients.id, s.clientId)).limit(1);
    if (!cl || cl.terminated) continue;
    const periodStart = s.currentPeriodEnd ?? target;
    const { amountHuf } = await effectiveMonthlyAmount(deps, db, cl.id, periodStart);
    await db.update(subscriptions).set({ predebitNotifiedFor: target, predebitPeriod: periodStart }).where(eq(subscriptions.id, s.id));
    if (amountHuf === 0) {
      out.free++;
      continue;
    }
    const label = await chargeCardLabel(deps, s);
    if (!label) {
      await notifyOnce(deps, `rem:predebit_nocard:${s.id}:${periodStart}`, { userId: cl.userId, kind: 'subscription_renewal_needed', variant: 'nincs_kartya', params: { datum: huDayMonth(target) }, link: '/fiok/elofizetes' });
      out.noCard++;
      continue;
    }
    await notifyOnce(deps, `rem:predebit:${s.id}:${periodStart}`, {
      userId: cl.userId,
      kind: 'charge_upcoming',
      params: { datum: huDayMonth(target), osszeg: fmtHuf(amountHuf), kartya: label, idoszak: periodText(periodStart, addMonths(periodStart, 1)) },
      emailBodyKey: 'email.charge_upcoming.body',
      link: '/fiok/elofizetes',
    });
    out.notified++;
  }
  return out;
}

/** The card the next charge uses: the new payment_methods row, or the old SimplePay/DEMO card registration. */
async function chargeCardLabel(deps: Deps, s: SubRow): Promise<string | null> {
  if (s.paymentMethodId) {
    const [pm] = await deps.db.select().from(paymentMethods).where(eq(paymentMethods.id, s.paymentMethodId)).limit(1);
    if (pm?.status === 'aktiv') return cardView(pm, deps.now()).label;
    const other = await activeCardOf(deps.db, s.clientId);
    return other ? cardView(other, deps.now()).label : null;
  }
  if (s.cardRegistrationId) {
    const { cardRegistrations } = await import('../db/schema.js');
    const [reg] = await deps.db.select().from(cardRegistrations).where(eq(cardRegistrations.id, s.cardRegistrationId)).limit(1);
    if (reg?.status === 'aktiv') return reg.mode === 'demo' ? PAYMENT_SCREEN_TEXTS.demoCardLabel : `Kártya ${reg.cardMask ?? ''}`.trim();
  }
  return null;
}

export async function jobSuspensionWarning(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.status, 'past_due'), sql`${subscriptions.graceUntil} is not null`));
  const { notifyOnce } = await import('./emlekezteto.js');
  let n = 0;
  for (const s of subs) {
    const warnDay = addDays(s.graceUntil!, -PAYMENT_RULES.suspensionWarnDaysBefore);
    if (today < warnDay || today >= s.graceUntil! || s.suspensionWarnedFor === s.graceUntil) continue;
    const [cl] = await db.select().from(clients).where(eq(clients.id, s.clientId)).limit(1);
    if (!cl) continue;
    const { amountHuf } = await effectiveMonthlyAmount(deps, db, cl.id, s.currentPeriodEnd ?? today);
    await db.update(subscriptions).set({ suspensionWarnedFor: s.graceUntil }).where(eq(subscriptions.id, s.id));
    if (await notifyOnce(deps, `pay:warn:${s.id}:${s.graceUntil}`, { userId: cl.userId, kind: 'payment_action_needed', variant: 'figyelmeztetes', params: { osszeg: fmtHuf(amountHuf), hataridoIg: huDayMonthIg(addDays(s.graceUntil!, -1)) }, link: '/fizesd-ki' })) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------------
// §29.1.15 reads + cancel
// ---------------------------------------------------------------------------------------------------------------------
export async function paymentsOfClient(db: DbOrTx, clientId: string): Promise<PaymentRow[]> {
  return db.select().from(payments).where(eq(payments.clientId, clientId)).orderBy(desc(payments.createdAt));
}

export function invoiceItemOf(inv: typeof feeInvoices.$inferSelect, storno: typeof feeInvoices.$inferSelect | null, label: string | null): FeeInvoiceItemK29 {
  return {
    id: inv.id,
    number: inv.number ?? '',
    issuedOn: inv.issuedOn ?? '',
    amountHuf: inv.amountHuf,
    demo: inv.demo,
    fileId: inv.pdfFileId ?? '',
    ...(label ? { label } : {}),
    kind: inv.kind,
    status: inv.status,
    stornoFileId: storno?.pdfFileId ?? null,
    paymentId: inv.paymentId ?? null,
  };
}

/** GET /client/payments – the client's payments with their invoices (no 'kartya' rows, no unfinished attempts). */
export async function clientPaymentItems(deps: Deps, cl: ClientRow): Promise<ClientPaymentItem[]> {
  const db = deps.db;
  const rows = (await paymentsOfClient(db, cl.id)).filter((p) => p.kind !== 'kartya' && p.status !== 'letrehozva' && p.status !== 'megszakitva' && p.amountHuf > 0);
  const invs = await db.select().from(feeInvoices).where(eq(feeInvoices.clientId, cl.id));
  return rows.map((p) => {
    const inv = invs.find((x) => x.id === p.feeInvoiceId && (x.status === 'kiallitva' || x.status === 'sztorno')) ?? null;
    const st = inv ? (invs.find((x) => x.stornoOf === inv.id && x.kind === 'sztorno' && x.status === 'kiallitva') ?? null) : null;
    return {
      id: p.id,
      date: (p.succeededAt ?? p.createdAt).toISOString(),
      kind: p.kind,
      kindLabel: PAYMENT_KIND_LABELS[p.kind],
      amountHuf: p.amountHuf,
      status: p.status,
      statusLabel: PAYMENT_STATUS_LABELS_K29[p.status],
      cardLabel: p.provider === 'demo' && p.cardLast4 ? PAYMENT_SCREEN_TEXTS.demoCardLabel : cardLabel(p.cardBrand, p.cardLast4),
      period: p.periodStart && p.periodEnd ? { start: p.periodStart, end: p.periodEnd } : null,
      refundedHuf: p.refundedHuf,
      invoice: inv ? invoiceItemOf(inv, st, PAYMENT_KIND_LABELS[p.kind]) : null,
    };
  });
}

/**
 * §29.1.15 cancelSubscriptionK29 – stops the charges, keeps the history. 'idoszak_vege' / 'datum': no further charge
 * (cancel_at_period_end; a terminated client's relationship ends on terminated.effectiveOn via the console job);
 * 'azonnal': canceled now, open payments cancelled, the saved card detached.
 */
export async function cancelSubscriptionK29(deps: Deps, i: { clientId: string; when: 'idoszak_vege' | 'azonnal' | 'datum'; date?: string; byUserId: string | null; reason: string }): Promise<void> {
  const db = deps.db;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, i.clientId)).limit(1);
  if (!sub) return;
  const now = deps.now();
  if (i.when === 'azonnal') {
    await db.update(subscriptions).set({ status: 'canceled', cancelAtPeriodEnd: true, canceledAt: now, nextChargeAt: null, nextRetryAt: null, updatedAt: now }).where(eq(subscriptions.id, sub.id));
    const open = await db.select().from(payments).where(and(eq(payments.clientId, i.clientId), inArray(payments.status, [...PAYMENT_OPEN_STATUSES])));
    for (const p of open) {
      try {
        const prov = providerOf(deps, p.provider);
        if (p.stripePaymentIntentId) await prov.cancelPending(p.stripePaymentIntentId);
        if (p.stripeCheckoutSessionId && p.status === 'letrehozva') await prov.expireHosted(p.stripeCheckoutSessionId);
      } catch (e) {
        log().warn({ err: safeErr(e) }, 'cancel pending failed');
      }
      await markCancelledAny(deps, p.id);
    }
    await detachAllCards(deps, i.clientId);
  } else if (sub.status !== 'canceled') {
    await db.update(subscriptions).set({ cancelAtPeriodEnd: true, updatedAt: now }).where(eq(subscriptions.id, sub.id));
  }
  await audit(db, { action: 'subscription.cancel_k29', actorUserId: i.byUserId, actorRole: i.byUserId ? 'admin' : 'system', targetType: 'subscription', targetId: sub.id, clientId: i.clientId, details: { when: i.when, date: i.date ?? null, reason: i.reason.slice(0, 300) } });
}

/** Detaches every saved card of a client at the provider and marks them 'torolve' (card deletion, termination, erasure). */
export async function detachAllCards(deps: Deps, clientId: string): Promise<number> {
  const db = deps.db;
  const cards = await db.select().from(paymentMethods).where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.status, 'aktiv')));
  for (const c of cards) {
    if (c.provider === 'stripe' && c.stripePaymentMethodId) {
      try {
        await providerOf(deps, 'stripe').detachCard(c.stripePaymentMethodId);
      } catch (e) {
        log().warn({ err: safeErr(e) }, 'card detach failed');
        throw E.upstream('A kártya törlése most nem sikerült a Stripe-nál. Próbáld újra pár perc múlva.');
      }
    }
    await db.update(paymentMethods).set({ status: 'torolve', detachedAt: deps.now() }).where(eq(paymentMethods.id, c.id));
  }
  return cards.length;
}

/** §29.9.6 helper for the anonymisation (= scrubCustomerK29). */
export async function anonymizeStripeCustomer(deps: Deps, clientId: string): Promise<void> {
  return scrubCustomerK29(deps, clientId);
}

/** §29.1.3 the DEMO pay page: the client pressed one of the buttons. */
export async function applyDemoChoice(deps: Deps, paymentId: string, choice: 'ok' | 'auth_ok' | 'fail' | 'cancel'): Promise<PaymentRow | null> {
  const [p] = await deps.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p || p.provider !== 'demo') return null;
  if (FINAL.includes(p.status)) return p;
  if (choice === 'cancel') await markCancelled(deps, p.id);
  else if (choice === 'fail') {
    await deps.db.update(payments).set({ status: 'sikertelen', failureCode: 'card_declined', declineCode: 'generic_decline', appliedAt: deps.now(), updatedAt: deps.now() }).where(eq(payments.id, p.id));
  } else {
    const card = demoCard(deps.now(), `demo_pm_${p.id.replace(/-/g, '').slice(0, 20)}`);
    await applyPaymentSucceeded(deps, p.id, { providerRef: demoSessionRef(p.id), chargeRef: null, card, customerRef: null });
  }
  const [after] = await deps.db.select().from(payments).where(eq(payments.id, p.id)).limit(1);
  return after ?? null;
}

/**
 * B2's dynamic name (termination): detaches EVERY Stripe card of the client at Stripe (also ones already marked
 * 'torolve' in our table – Stripe answers "already detached" harmlessly) and marks the active ones 'torolve'.
 */
export async function detachCardsK29(deps: Deps, clientId: string): Promise<void> {
  const db = deps.db;
  const cards = await db.select().from(paymentMethods).where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.provider, 'stripe')));
  for (const c of cards) {
    if (!c.stripePaymentMethodId || c.status === 'lecserelve') continue;
    try {
      await providerOf(deps, 'stripe').detachCard(c.stripePaymentMethodId);
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'card detach failed');
    }
  }
  await db.update(paymentMethods).set({ status: 'torolve', detachedAt: deps.now() }).where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.status, 'aktiv')));
}

/** B2's dynamic name (anonymisation): the Stripe customer's e-mail/name cleared, every card detached. */
export async function scrubCustomerK29(deps: Deps, clientId: string): Promise<void> {
  const rows = await deps.db.select().from(stripeCustomers).where(eq(stripeCustomers.clientId, clientId));
  for (const r of rows) {
    const prov = deps.payments.stripe;
    if (!prov || prov.mode !== r.mode) continue;
    await prov.updateCustomer(r.customerId, { email: null, name: null });
  }
  await detachCardsK29(deps, clientId);
}

// §29.1.15: the whole contract is importable from this module.
export { createFeeChargeK29, registerFeePurposeHandler } from './dijak.js';
export { retryInvoice, invoicesOfClient } from '../payments/invoices.js';
export { PAYMENT_KIND_LABELS };
