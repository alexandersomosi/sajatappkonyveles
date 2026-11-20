// SPEC §29.1 (B1) – Stripe flows on a FAKE Stripe (test/fake-stripe.ts, no network): consent → hosted first month →
// result polling / webhook → active + card + fee invoice; monthly charges by our scheduler with every outcome; at most
// one success per period (duplicate → refund); at most one attempt per day; "Fizesd ki"; pre-debit and suspension
// warning; refunds → storno / correction; webhooks (signature, replay, order, livemode, retry); legacy DEMO
// subscriptions keep their provider; free month / pause fee / own price; terminated client never reactivated.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../src/_shared/k29.js';
import { clientPriceOverrides, clients, consents, feeCharges, feeInvoices, notifications, paymentMethods, payments, stripeEvents, subscriptionPauses, subscriptions, auditLog } from '../src/db/schema.js';
import { runBillingJob } from '../src/services/subscription.js';
import { jobPaymentsReconcile, jobPredebit, jobSuspensionWarning, refundPayment } from '../src/services/payments.js';
import { jobInvoicesIssue } from '../src/payments/invoices.js';
import { grossToLine, hufToStripe, stripeToHuf } from '../src/payments/huf.js';
import { createDemoProvider } from '../src/payments/demo.js';
import { FAKE_STRIPE_ENV, FakeStripe } from './fake-stripe.js';
import { newClient, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let fake: FakeStripe;
const profile = {
  firstName: 'Kata',
  lastName: 'Szabó',
  adoazonositoJel: '8417104569',
  adoszam: '68801234-1-41',
  address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
  hqMunicipality: 'Budapest',
  activityText: 'Grafika',
  activityAnswer: 'egyeb',
  taxStatus: 'fofoglalkozasu',
  evSince: '2019-04-01',
  hasSeparateBusinessAccount: true,
};

beforeAll(async () => {
  fake = new FakeStripe();
  h = await setup({ now: '2026-11-20T09:00:00Z', env: FAKE_STRIPE_ENV, overrides: { payments: { stripe: fake, demo: createDemoProvider({ apiPublicUrl: 'https://api.test', now: () => new Date('2026-11-20T09:00:00Z') }) } } });
});
afterAll(async () => h.close());
beforeEach(() => {
  fake.scenarios.length = 0;
});

async function activeClient(email: string) {
  const c = await newClient(h, email, { first: 'Kata', last: 'Szabó' });
  const p = await h.json('PUT', '/client/profile', { token: c.token, body: profile });
  expect(p.status).toBe(200);
  await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
  return c;
}

let ipN = 0;
/** Access tokens are short-lived: after moving the clock a month, sign in again. */
async function relogin(email: string): Promise<string> {
  const r = await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': `10.88.0.${++ipN}` } });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
}

async function consentOf(token: string, purpose = 'subscribe') {
  const r = await h.json('GET', `/client/subscription/consent?purpose=${purpose}`, { token });
  expect(r.status).toBe(200);
  return r.body as { version: string; sha256: string; text: string; amountNowHuf: number; period: { start: string; end: string } | null };
}

/** k7c2: the pre-debit notice goes out 3 days before (the 10:00 job), then the scheduler may charge on the day. */
async function atChargeDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 3);
  h.clock.set(`${d.toISOString().slice(0, 10)}T09:30:00Z`);
  await jobPredebit(h.deps);
  h.clock.set(`${day}T09:00:00Z`);
}

/** consent → start → the fake Stripe page completes → result polling applies it. */
async function subscribed(email: string, last4 = '4242') {
  const c = await activeClient(email);
  const cv = await consentOf(c.token);
  const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
  expect(st.status).toBe(200);
  const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
  fake.complete(p!.stripeCheckoutSessionId!, last4);
  const res = await h.json('GET', `/client/payments/checkout/${p!.stripeCheckoutSessionId}`, { token: c.token });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('sikeres');
  return { ...c, email, paymentId: p!.id, sessionId: p!.stripeCheckoutSessionId!, start: st.body, result: res.body };
}

describe('HUF and the pinned API version', () => {
  it('19 999 Ft = 1999900; fractions and negatives refused; back to forints', () => {
    expect(hufToStripe(19_999)).toBe(1_999_900);
    expect(() => hufToStripe(0.5)).toThrow();
    expect(() => hufToStripe(-1)).toThrow();
    expect(() => hufToStripe(0)).toThrow();
    expect(stripeToHuf(1_999_900)).toBe(19_999);
    expect(() => stripeToHuf(1_999_950)).toThrow();
  });
  it('27 % ÁFA from the five gross prices (§29.2.2)', () => {
    expect(grossToLine(19_999)).toEqual({ netto: 15_747.24, afa: 4_251.76, brutto: 19_999 });
    expect(grossToLine(14_999)).toEqual({ netto: 11_810.24, afa: 3_188.76, brutto: 14_999 });
    expect(grossToLine(7_999)).toEqual({ netto: 6_298.43, afa: 1_700.57, brutto: 7_999 });
    expect(grossToLine(4_999)).toEqual({ netto: 3_936.22, afa: 1_062.78, brutto: 4_999 });
    expect(grossToLine(2_999)).toEqual({ netto: 2_361.42, afa: 637.58, brutto: 2_999 });
    expect(grossToLine(19_999, { whole: true })).toEqual({ netto: 15_747, afa: 4_252, brutto: 19_999 });
  });
  it('STRIPE_API_VERSION equals the pinned SDK default and the owner script (stripe_szerverre.ps1): version + the 8 events', async () => {
    expect(STRIPE_API_VERSION).toBe(Stripe.API_VERSION);
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ps = readFileSync(join(__dirname, '..', '..', '..', 'stripe_szerverre.ps1'), 'utf8');
    expect(/\$StripeApiVersion = '([^']+)'/.exec(ps)?.[1]).toBe(STRIPE_API_VERSION);
    const { STRIPE_WEBHOOK_EVENTS } = await import('../src/_shared/k29.js');
    const block = /\$Esemenyek = @\(([\s\S]*?)\)/.exec(ps)![1]!;
    expect([...block.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1])).toEqual([...STRIPE_WEBHOOK_EVENTS]);
  });
});

describe('first month: consent → Stripe Checkout → active', () => {
  let c: Awaited<ReturnType<typeof subscribed>>;
  it('the consent text carries the real numbers, a version and its hash', async () => {
    const x = await activeClient('consent@demo.kezjegy.test');
    const cv = await consentOf(x.token);
    expect(cv.version).toBe('k7-1');
    expect(cv.amountNowHuf).toBe(19_999);
    expect(cv.text).toContain('most 19 999 Ft-ot az első hónapért (2026.11.20.–2026.12.19.)');
    expect(cv.text).toContain('amíg szünetel a vállalkozásom, 2 999 Ft-ot');
    // a stale hash → 409 consent_changed
    const bad = await h.json('POST', '/client/subscription/start', { token: x.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: '0'.repeat(64) } });
    expect(bad.status).toBe(409);
    expect(bad.body.error.code).toBe('consent_changed');
  });
  it('the Checkout session: payment mode, saves the card off-session, HUF ×100, our ids only, idempotency key', async () => {
    c = await subscribed('elso@demo.kezjegy.test');
    const call = fake.calls.find((x) => x.op === 'checkout' && (x.args as { paymentId: string }).paymentId === c.paymentId)!;
    const a = call.args as { mode: string; saveCard: boolean; amountHuf: number; metadata: Record<string, string>; statementSuffix: string; successUrl: string; cancelUrl: string; idempotencyKey: string };
    expect(a.mode).toBe('payment');
    expect(a.saveCard).toBe(true);
    expect(a.amountHuf).toBe(19_999);
    expect(a.statementSuffix).toBe('HAVIDIJ');
    expect(a.idempotencyKey).toBe(`checkout:${c.paymentId}`);
    expect(Object.keys(a.metadata).sort()).toEqual(['client_id', 'kind', 'payment_id', 'period_start']);
    expect(JSON.stringify(a.metadata)).not.toMatch(/Szabó|@|68801234/);
    expect(a.successUrl).toContain('/api/v1/payments/stripe/vissza?p=web&o=');
    expect(a.successUrl).toContain('cs={CHECKOUT_SESSION_ID}');
    expect(a.cancelUrl).toContain('megszakitva=1');
  });
  it('active subscription, saved card, consent stored, onboarding step done, fee invoice (DEMO díjbekérő while INVOICE_MODE=demo)', async () => {
    const sub = await h.json('GET', '/client/subscription', { token: c.token });
    expect(sub.body).toMatchObject({ status: 'active', provider: 'stripe', paymentProvider: 'stripe', paymentMode: 'test', currentPeriodEnd: '2026-12-20', monthlyHuf: 19_999, consentNeeded: false });
    expect(sub.body.cardInfo).toMatchObject({ provider: 'stripe', brand: 'visa', last4: '4242', label: 'Visa •••• 4242', expiryLabel: '12/30', status: 'aktiv' });
    expect(c.result).toMatchObject({ status: 'sikeres', amountHuf: 19_999, nextChargeOn: '2026-12-20', nextChargeHuf: 19_999, cardLabel: 'Visa •••• 4242' });
    const [cons] = await h.deps.db.select().from(consents).where(and(eq(consents.userId, c.userId), eq(consents.docType, 'kartyas_fizetes')));
    expect(cons!.version).toBe('k7-1');
    const [pm] = await h.deps.db.select().from(paymentMethods).where(eq(paymentMethods.clientId, c.clientId));
    expect(pm).toMatchObject({ status: 'aktiv', provider: 'stripe', mode: 'test', consentId: cons!.id });
    const inv = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId));
    expect(inv).toHaveLength(1);
    expect(inv[0]).toMatchObject({ status: 'kiallitva', kind: 'szamla', provider: 'demo', demo: true, amountHuf: 19_999 });
    expect(inv[0]!.externalKey).toMatch(/^ADZ-[0-9a-f]{20}$/);
    expect(inv[0]!.line?.megnevezes).toBe('Könyvelési szolgáltatás – havidíj (2026.11.20.–2026.12.19.)');
    const list = await h.json('GET', '/client/payments', { token: c.token });
    expect(list.body.items[0]).toMatchObject({ kind: 'elso_havi', status: 'sikeres', amountHuf: 19_999, cardLabel: 'Visa •••• 4242' });
    expect(list.body.items[0].invoice.number).toMatch(/^DEMO-2026-/);
  });
  it('the back URL changes nothing and returns to the web origin (or the app deep link)', async () => {
    const web = await h.req('GET', `/payments/stripe/vissza?p=web&o=s&cel=elofizetes&pid=${c.paymentId}&cs=${c.sessionId}`);
    expect(web.status).toBe(302);
    expect(web.headers.get('location')).toBe(`https://app.45-94-65-74.sslip.io/elofizetes/eredmeny?cs=${c.sessionId}&cel=elofizetes`);
    const app = await h.req('GET', `/payments/stripe/vissza?p=app&o=a&cel=dij&pid=${c.paymentId}&megszakitva=1&payment_intent_client_secret=secret`);
    expect(app.headers.get('location')).toBe(`kezjegy://elofizetes/eredmeny?cs=${c.paymentId}&cel=dij&megszakitva=1`);
  });
  it('a second start while paying → 409 (card change is the way)', async () => {
    const cv = await consentOf(c.token);
    const r = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    expect(r.status).toBe(409);
  });
  it('card change while paid: setup mode, no money; the new card replaces the old one (detached)', async () => {
    const cv = await consentOf(c.token, 'card_update');
    expect(cv.amountNowHuf).toBe(0);
    expect(cv.text).not.toContain('az első hónapért');
    // k7 integrator: no dangling "utána" once the "most … az első hónapért" line is gone
    expect(cv.text).toContain('– havonta egyszer, a kifizetett hónap végén');
    expect(cv.text).not.toContain('– utána havonta');
    const r = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'app', purpose: 'card_update', consentVersion: cv.version, consentSha256: cv.sha256 } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ mode: 'setup', provider: 'stripe' });
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, r.body.paymentId));
    expect(p).toMatchObject({ kind: 'kartya', amountHuf: 0, hostedMode: 'setup' });
    const old = (await h.deps.db.select().from(paymentMethods).where(eq(paymentMethods.clientId, c.clientId)))[0]!;
    fake.complete(p!.stripeCheckoutSessionId!, '5555');
    // the webhook (checkout.session.completed) applies it
    const ev = fake.event('checkout.session.completed', { id: p!.stripeCheckoutSessionId, object: 'checkout.session', mode: 'setup', metadata: { payment_id: p!.id } });
    const w = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    expect(w.status).toBe(200);
    const pms = await h.deps.db.select().from(paymentMethods).where(eq(paymentMethods.clientId, c.clientId));
    expect(pms.find((x) => x.id === old.id)!.status).toBe('lecserelve');
    expect(pms.find((x) => x.status === 'aktiv')!.last4).toBe('5555');
    expect(fake.detached).toContain(old.stripePaymentMethodId);
    const sub = await h.json('GET', '/client/subscription', { token: c.token });
    expect(sub.body.currentPeriodEnd).toBe('2026-12-20');
    expect(sub.body.cardInfo.last4).toBe('5555');
    // no money moved: no invoice for the card change
    expect(await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId))).toHaveLength(1);
  });
  it('leaving the Stripe page: the session is expired at Stripe and the result says "megszakítva"', async () => {
    const x = await activeClient('megszakit@demo.kezjegy.test');
    const cv = await consentOf(x.token);
    const st = await h.json('POST', '/client/subscription/start', { token: x.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    const again = await h.json('POST', '/client/subscription/start', { token: x.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    expect(again.body.paymentId).toBe(st.body.paymentId); // an open session is handed back
    const r = await h.json('GET', `/client/payments/checkout/${st.body.paymentId}?megszakitva=1`, { token: x.token });
    expect(r.body.status).toBe('megszakitva');
    expect(fake.calls.some((k) => k.op === 'expire')).toBe(true);
  });
});

describe('monthly charges by our scheduler', () => {
  it('charges at period end with a per-day idempotency key; one attempt per day; period extended; invoice', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('havi@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    await runBillingJob(h.deps);
    const rows = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'sikeres', offSession: true, initiated: 'utemezo', attemptDay: '2026-12-20', periodStart: '2026-12-20', periodEnd: '2027-01-20' });
    expect(rows[0]!.idempotencyKey).toMatch(/^havidij:[0-9a-f-]{36}:2026-12-20:2026-12-20$/);
    const sub = (await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId)))[0]!;
    expect(sub.currentPeriodEnd).toBe('2027-01-20');
    await runBillingJob(h.deps);
    expect(await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')))).toHaveLength(1);
    expect(await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId))).toHaveLength(2);
  });

  it('declined (insufficient funds) → past_due, retries +1/+3/+7, "Nem sikerült levonni" once; Fizesd ki → active', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('elutasit@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    fake.scenarios.push('insufficient');
    await runBillingJob(h.deps);
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub).toMatchObject({ status: 'past_due', failedAttempts: 1, graceUntil: '2027-01-03' });
    const [p] = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(p).toMatchObject({ status: 'sikertelen', failureCode: 'card_declined', declineCode: 'insufficient_funds' });
    const n = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_action_needed')));
    expect(n).toHaveLength(1);
    expect(n[0]!.title).toBe('Nem sikerült levonni a havidíjat');
    expect(n[0]!.body).toContain('19 999 Ft');
    // the due month on the Főoldal / Fizesd ki
    c.token = await relogin(c.email);
    const due = await h.json('GET', '/client/payments/due', { token: c.token });
    expect(due.body).toMatchObject({ amountHuf: 19_999, reason: 'elutasitva', cardLabel: 'Visa •••• 4242', period: { start: '2026-12-20', end: '2027-01-20' } });
    // retry next day fails again (same variant: no second notification)
    h.clock.set('2026-12-21T09:00:00Z');
    fake.scenarios.push('decline');
    await runBillingJob(h.deps);
    expect(await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_action_needed')))).toHaveLength(1);
    c.token = await relogin(c.email);
    // k7 integrator: the consent of a due month speaks of the unpaid month, not of "the first month"
    const fcv = await consentOf(c.token, 'fizesd_ki');
    expect(fcv.text).toContain('most 19 999 Ft-ot a fizetésre váró hónapért (2026.12.20.–2027.01.19.)');
    expect(fcv.text).not.toContain('az első hónapért');
    // Fizesd ki: hosted payment of the due month; the card authenticated becomes the saved card
    const pay = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'web' } });
    expect(pay.status).toBe(200);
    expect(pay.body.cel).toBe('fizesd-ki');
    const [fk] = await h.deps.db.select().from(payments).where(eq(payments.id, pay.body.paymentId));
    expect(fk).toMatchObject({ kind: 'fizesd_ki', amountHuf: 19_999, periodStart: '2026-12-20', saveCard: true });
    fake.complete(fk!.stripeCheckoutSessionId!, '1111');
    const r = await h.json('GET', `/client/payments/checkout/${fk!.stripeCheckoutSessionId}`, { token: c.token });
    expect(r.body.status).toBe('sikeres');
    const [after] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(after).toMatchObject({ status: 'active', failedAttempts: 0, currentPeriodEnd: '2027-01-20', graceUntil: null });
    expect((await h.json('GET', '/client/payments/due', { token: c.token })).body).toBeNull();
  });

  it('authentication_required → hitelesites_kell → "Erősítsd meg"; no new attempt the same day', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('auth@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    fake.scenarios.push('auth');
    await runBillingJob(h.deps);
    const [p] = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(p!.status).toBe('hitelesites_kell');
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_action_needed')));
    expect(n!.title).toBe('Erősítsd meg a fizetést');
    expect(n!.link).toBe('/fizesd-ki');
    c.token = await relogin(c.email);
    const due = await h.json('GET', '/client/payments/due', { token: c.token });
    expect(due.body.reason).toBe('hitelesites');
    // Fizesd ki cancels the open PaymentIntent first (it can never succeed later)
    const pay = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'app' } });
    expect(pay.status).toBe(200);
    expect(fake.calls.some((x) => x.op === 'cancel' && x.args === p!.stripePaymentIntentId)).toBe(true);
    const [old] = await h.deps.db.select().from(payments).where(eq(payments.id, p!.id));
    expect(old!.status).toBe('megszakitva');
  });

  it('a network error → bizonytalan; the reconcile job re-sends the SAME key the same day and applies the original result', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('bizonytalan@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    fake.scenarios.push('uncertain');
    await runBillingJob(h.deps);
    const [p] = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(p!.status).toBe('bizonytalan');
    h.clock.set('2026-12-20T09:30:00Z');
    await jobPaymentsReconcile(h.deps);
    const [q] = await h.deps.db.select().from(payments).where(eq(payments.id, p!.id));
    expect(q!.status).toBe('sikeres');
    const keys = fake.calls.filter((x) => x.op === 'charge' && x.key === p!.idempotencyKey);
    expect(keys).toHaveLength(2);
  });

  it('a second success for the same month is refunded automatically (duplikalt)', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('dupla@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    await runBillingJob(h.deps); // the renewal succeeded …
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    // … and an older Fizesd ki page of the same month is paid too (simulated: a row for the same period succeeds)
    const [row] = await h.deps.db
      .insert(payments)
      .values({ clientId: c.clientId, subscriptionId: sub!.id, kind: 'fizesd_ki', provider: 'stripe', mode: 'test', amountHuf: 19_999, periodStart: '2026-12-20', periodEnd: '2027-01-20', status: 'letrehozva', initiated: 'ugyfel', idempotencyKey: 'test:dupla', stripePaymentIntentId: 'pi_test_dupla' })
      .returning();
    fake.intents.set('pi_test_dupla', { id: 'pi_test_dupla', status: 'succeeded', amountHuf: 19_999, card: fake.card(), metadata: { payment_id: row!.id }, refundedHuf: 0, failureCode: null, declineCode: null, customer: null });
    const ev = fake.event('payment_intent.succeeded', { id: 'pi_test_dupla', object: 'payment_intent', metadata: { payment_id: row!.id } });
    const w = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    expect(w.status).toBe(200);
    const [d] = await h.deps.db.select().from(payments).where(eq(payments.id, row!.id));
    expect(d!.status).toBe('duplikalt');
    expect(d!.refundedHuf).toBe(19_999);
    expect(fake.refunds.some((r) => r.key === `refund:dup:${row!.id}`)).toBe(true);
    const ok = await h.deps.db.select().from(payments).where(and(eq(payments.subscriptionId, sub!.id), eq(payments.status, 'sikeres'), eq(payments.periodStart, '2026-12-20')));
    expect(ok).toHaveLength(1);
  });

  it('the database refuses a second success for a period (partial unique index)', async () => {
    const [sub] = await h.deps.db.select().from(subscriptions).limit(1);
    const base = { clientId: sub!.clientId, subscriptionId: sub!.id, kind: 'havi' as const, provider: 'stripe' as const, mode: 'test' as const, amountHuf: 1, periodStart: '2030-01-01', periodEnd: '2030-02-01', status: 'sikeres' as const, initiated: 'utemezo' as const };
    await h.deps.db.insert(payments).values({ ...base, idempotencyKey: 'uq:1' });
    await expect(h.deps.db.insert(payments).values({ ...base, idempotencyKey: 'uq:2' })).rejects.toThrow();
  });

  it('a free month → no Stripe call, 0 Ft row, period advanced; a pause → the pause fee; an own price', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('ingyenes@demo.kezjegy.test');
    await h.deps.db.insert(clientPriceOverrides).values({ clientId: c.clientId, kind: 'ingyenes_honap', months: 1, fromPeriod: '2026-12-20', reason: 'teszt' });
    await atChargeDay('2026-12-20');
    const before = fake.calls.filter((x) => x.op === 'charge').length;
    await runBillingJob(h.deps);
    expect(fake.calls.filter((x) => x.op === 'charge').length).toBe(before);
    const [p] = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(p).toMatchObject({ amountHuf: 0, status: 'sikeres', idempotencyKey: expect.stringMatching(/^ingyenes:/) });
    expect(await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.paymentId, p!.id))).toHaveLength(0);
    // the next month: paused → 2 999 Ft
    await h.deps.db.insert(subscriptionPauses).values({ clientId: c.clientId, from: '2027-01-01', source: 'admin' });
    await atChargeDay('2027-01-20');
    await runBillingJob(h.deps);
    const rows = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(rows.find((r) => r.periodStart === '2027-01-20')).toMatchObject({ amountHuf: 2_999, status: 'sikeres' });
    const inv = (await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId))).find((i) => i.amountHuf === 2_999);
    expect(inv!.line?.megnevezes).toBe('Könyvelési szolgáltatás – szüneteltetési díj (2027. január)');
    // own price (not during a pause): closes the pause, 15 000 Ft from February
    await h.deps.db.update(subscriptionPauses).set({ to: '2027-01-31' }).where(eq(subscriptionPauses.clientId, c.clientId));
    await h.deps.db.insert(clientPriceOverrides).values({ clientId: c.clientId, kind: 'egyedi_ar', amountHuf: 15_000, fromPeriod: '2027-02-01', reason: 'teszt' });
    await atChargeDay('2027-02-20');
    await runBillingJob(h.deps);
    const feb = (await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')))).find((r) => r.periodStart === '2027-02-20');
    expect(feb!.amountHuf).toBe(15_000);
  });

  it('k7c2 A5: a provider refusal of OUR request (bad request) counts as a failed month (past_due → lock), the admin is alerted, the client is asked for a card', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('hibas-keres@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    fake.scenarios.push('invalid');
    await runBillingJob(h.deps);
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub).toMatchObject({ status: 'past_due', failedAttempts: 1 });
    expect(sub!.graceUntil).toBe('2027-01-03');
    const [p] = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi')));
    expect(p!.failureCode).toMatch(/^hiba:/);
    expect(p!.alertedAt).not.toBeNull();
    const asked = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'subscription_renewal_needed')));
    expect(asked.length).toBeGreaterThanOrEqual(1);
  });
});

describe('reminders', () => {
  it('pre-debit: exactly on day −3, once; no reminder for a free month', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('predebit@demo.kezjegy.test');
    h.clock.set('2026-12-16T09:30:00Z');
    await jobPredebit(h.deps);
    expect(await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'charge_upcoming')))).toHaveLength(0);
    h.clock.set('2026-12-17T09:30:00Z');
    await jobPredebit(h.deps);
    await jobPredebit(h.deps);
    const n = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'charge_upcoming')));
    expect(n).toHaveLength(1);
    expect(n[0]!.title).toBe('3 nap múlva levonjuk a havidíjat');
    expect(n[0]!.body).toContain('19 999 Ft a kártyádról (Visa •••• 4242)');
    expect(n[0]!.wantEmail).toBe(true);
  });
  it('suspension warning at grace − 5 days, once; then suspended → lock; payment lifts the lock at once', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('felfugg@demo.kezjegy.test');
    await atChargeDay('2026-12-20');
    fake.scenarios.push('decline', 'decline', 'decline', 'decline');
    await runBillingJob(h.deps); // graceUntil 2027-01-03
    h.clock.set('2026-12-29T09:30:00Z');
    expect(await jobSuspensionWarning(h.deps)).toBeGreaterThanOrEqual(1);
    expect(await jobSuspensionWarning(h.deps)).toBe(0);
    expect(await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_action_needed'), eq(notifications.title, '5 nap múlva szünetel a könyvelésed')))).toHaveLength(1);
    const [w] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_action_needed'), eq(notifications.title, '5 nap múlva szünetel a könyvelésed')));
    expect(w!.body).toContain('január 2-ig');
    h.clock.set('2027-01-03T09:00:00Z');
    // the fake's scenario queue is global: every retry due this morning (other test clients too) declines
    fake.scenarios.push(...Array<'decline'>(40).fill('decline'));
    await runBillingJob(h.deps);
    const { computeServiceLock } = await import('../src/services/zarolas.js');
    const lock = await computeServiceLock(h.deps, c.clientId);
    expect(lock?.reasons).toEqual(['havidij']);
    c.token = await relogin(c.email);
    const pay = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'web' } });
    const [fk] = await h.deps.db.select().from(payments).where(eq(payments.id, pay.body.paymentId));
    fake.complete(fk!.stripeCheckoutSessionId!);
    const ev = fake.event('checkout.session.completed', { id: fk!.stripeCheckoutSessionId, object: 'checkout.session', mode: 'payment', metadata: { payment_id: fk!.id } });
    await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.serviceLock).toBeNull();
    expect(cl!.lifecycle).toBe('aktiv');
  });
});

describe('webhooks', () => {
  it('bad signature → 400, nothing stored, no audit row per request', async () => {
    const auditsBefore = (await h.deps.db.select().from(auditLog)).length;
    const ev = fake.event('payment_intent.succeeded', { id: 'pi_x', object: 'payment_intent' }, { secret: ['whsec', 'wrongwrongwrongwrong'].join('_') });
    for (let i = 0; i < 3; i++) {
      const r = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
      expect(r.status).toBe(400);
    }
    expect((await h.deps.db.select().from(auditLog)).length).toBe(auditsBefore);
    expect(await h.deps.db.select().from(stripeEvents)).not.toContainEqual(expect.objectContaining({ type: 'payment_intent.succeeded', id: JSON.parse(ev.raw).id }));
  });
  it('replay → processed once; out of order (payment_intent.succeeded before checkout.session.completed) → one success', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const x = await activeClient('sorrend@demo.kezjegy.test');
    const cv = await consentOf(x.token);
    const st = await h.json('POST', '/client/subscription/start', { token: x.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
    const s = fake.complete(p!.stripeCheckoutSessionId!);
    const e1 = fake.event('payment_intent.succeeded', { id: s.piId, object: 'payment_intent', metadata: { payment_id: p!.id } });
    const e2 = fake.event('checkout.session.completed', { id: s.id, object: 'checkout.session', mode: 'payment', metadata: { payment_id: p!.id } });
    for (const e of [e1, e1, e2, e2]) {
      const r = await h.req('POST', '/webhooks/stripe', { raw: e.raw, headers: { 'content-type': 'application/json', 'stripe-signature': e.signature } });
      expect(r.status).toBe(200);
    }
    const ok = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, x.clientId), eq(payments.status, 'sikeres')));
    expect(ok).toHaveLength(1);
    expect(await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, x.clientId))).toHaveLength(1);
    const [ev] = await h.deps.db.select().from(stripeEvents).where(eq(stripeEvents.id, JSON.parse(e1.raw).id));
    expect(ev!.attempts).toBe(1);
  });
  it('livemode mismatch → 200 + ignored + audit', async () => {
    const ev = fake.event('payment_intent.succeeded', { id: 'pi_live', object: 'payment_intent' }, { livemode: true });
    const r = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    expect(r.status).toBe(200);
    expect((await r.json()).ignored).toBe(true);
    const a = await h.deps.db.select().from(auditLog).where(eq(auditLog.action, 'payment.webhook_mode_mismatch'));
    expect(a.length).toBeGreaterThan(0);
  });
  it('a handler error → 500 (Stripe retries), then success on the retry', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const x = await activeClient('ujra@demo.kezjegy.test');
    const cv = await consentOf(x.token);
    const st = await h.json('POST', '/client/subscription/start', { token: x.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
    const s = fake.complete(p!.stripeCheckoutSessionId!);
    const ev = fake.event('checkout.session.completed', { id: s.id, object: 'checkout.session', mode: 'payment', metadata: { payment_id: p!.id } });
    const orig = fake.retrieveHosted.bind(fake);
    fake.retrieveHosted = async () => {
      throw new Error('Stripe is down');
    };
    const r1 = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    expect(r1.status).toBe(500);
    fake.retrieveHosted = orig;
    const r2 = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    expect(r2.status).toBe(200);
    const [q] = await h.deps.db.select().from(payments).where(eq(payments.id, p!.id));
    expect(q!.status).toBe('sikeres');
    const [row] = await h.deps.db.select().from(stripeEvents).where(eq(stripeEvents.id, JSON.parse(ev.raw).id));
    expect(row!.attempts).toBe(2);
    expect(row!.processedAt).not.toBeNull();
  });
  it('charge.refunded from the Dashboard → synced, storno queued, client told', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('dashboard@demo.kezjegy.test');
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, c.paymentId));
    fake.intents.get(p!.stripePaymentIntentId!)!.refundedHuf = 19_999;
    const ev = fake.event('charge.refunded', { id: `ch_${p!.stripePaymentIntentId}`, object: 'charge', payment_intent: p!.stripePaymentIntentId });
    const r = await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    expect(r.status).toBe(200);
    const [q] = await h.deps.db.select().from(payments).where(eq(payments.id, p!.id));
    expect(q!.refundedHuf).toBe(19_999);
    const inv = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId));
    expect(inv.find((i) => i.kind === 'sztorno')).toMatchObject({ status: 'kiallitva', amountHuf: -19_999 });
    expect(inv.find((i) => i.kind === 'szamla')!.status).toBe('sztorno');
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_refunded')));
    expect(n!.title).toBe('Visszautaltunk 19 999 Ft-ot');
  });
});

describe('refunds (console) and the terminated client', () => {
  it('partial refund → corrective invoice; the rest → another correction (a storno only for an untouched full refund)', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('reszleges@demo.kezjegy.test');
    const admin = await staff(h, 'admin', `admin.ref.${Date.now()}@demo.kezjegy.test`);
    const r1 = await refundPayment(h.deps, { paymentId: c.paymentId, amountHuf: 5_000, reason: 'Részleges visszatérítés', byUserId: admin.userId });
    expect(r1).toEqual({ refundedHuf: 5_000, invoiceAction: 'helyesbito' });
    await expect(refundPayment(h.deps, { paymentId: c.paymentId, amountHuf: 20_000, reason: 'Túl sok visszatérítés', byUserId: admin.userId })).rejects.toThrow();
    const inv = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId));
    expect(inv.find((i) => i.kind === 'helyesbito')).toMatchObject({ amountHuf: -5_000, status: 'kiallitva' });
    expect(fake.refunds.some((r) => r.key === `refund:${c.paymentId}:1`)).toBe(true);
  });
  it('a payment after termination never reactivates the client', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('felmondott@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ terminated: { kind: 'azonnali_dij', reason: 'teszt', noticeAt: '2026-11-20', effectiveOn: '2026-11-20', by: 'x' }, lifecycle: 'megszunt' }).where(eq(clients.id, c.clientId));
    await h.deps.db.update(subscriptions).set({ status: 'canceled' }).where(eq(subscriptions.clientId, c.clientId));
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    const [row] = await h.deps.db
      .insert(payments)
      .values({ clientId: c.clientId, subscriptionId: sub!.id, kind: 'fizesd_ki', provider: 'stripe', mode: 'test', amountHuf: 19_999, periodStart: '2026-12-20', periodEnd: '2027-01-20', status: 'letrehozva', initiated: 'ugyfel', idempotencyKey: 'test:felmondott', stripePaymentIntentId: 'pi_test_felm' })
      .returning();
    fake.intents.set('pi_test_felm', { id: 'pi_test_felm', status: 'succeeded', amountHuf: 19_999, card: fake.card(), metadata: { payment_id: row!.id }, refundedHuf: 0, failureCode: null, declineCode: null, customer: null });
    const ev = fake.event('payment_intent.succeeded', { id: 'pi_test_felm', object: 'payment_intent', metadata: { payment_id: row!.id } });
    await h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lifecycle).toBe('megszunt');
    const [s2] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(s2!.status).toBe('canceled');
  });
});

describe('one-off fees with the saved card', () => {
  it('the saved card is charged after the tap; a decline offers another card; 3DS answers a redirect', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await subscribed('dij@demo.kezjegy.test');
    const mk = async () => (await h.deps.db.insert(feeCharges).values({ clientId: c.clientId, kind: 'eves_zaras', amountHuf: 14_999, purpose: { type: 'admin', note: 'teszt' }, status: 'nyitott' }).returning())[0]!;
    const ch1 = await mk();
    const ok = await h.json('POST', `/client/fees/${ch1.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: true } });
    expect(ok.body).toMatchObject({ result: 'sikeres', amountHuf: 14_999, cardLabel: 'Visa •••• 4242' });
    const call = fake.calls.filter((x) => x.op === 'charge').pop()!;
    expect(call.key).toBe(`dij:${ch1.id}:2026-11-20`);
    expect((call.args as { offSession: boolean; statementSuffix: string }).offSession).toBe(false);
    expect((call.args as { statementSuffix: string }).statementSuffix).toBe('EVES ZARAS');
    const [paid] = await h.deps.db.select().from(feeCharges).where(eq(feeCharges.id, ch1.id));
    expect(paid!.status).toBe('fizetve');
    const ch2 = await mk();
    fake.scenarios.push('decline');
    const no = await h.json('POST', `/client/fees/${ch2.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: true } });
    expect(no.body).toMatchObject({ result: 'sikertelen', code: 'card_declined' });
    const other = await h.json('POST', `/client/fees/${ch2.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    expect(other.body.result).toBe('atiranyitas');
    expect(other.body.url).toContain('checkout.stripe.test');
    const ch3 = await mk();
    fake.scenarios.push('auth');
    const auth3 = await h.json('POST', `/client/fees/${ch3.id}/pay`, { token: c.token, body: { platform: 'app', useSavedCard: true } });
    expect(auth3.body.result).toBe('atiranyitas');
    expect(auth3.body.url).toContain('hooks.stripe.test/3ds');
  });
});

describe('the old DEMO cards keep their provider after PAYMENT_PROVIDER=stripe (§29.1.12)', () => {
  it('a legacy SimplePay-DEMO subscription is renewed by the DEMO path, never by Stripe', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const c = await activeClient('regi.demo@demo.kezjegy.test');
    // the legacy body still works (old app build) only while SimplePay / DEMO is the provider: under Stripe → 409
    const old = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    expect(old.status).toBe(409);
    expect(old.body.error.code).toBe('app_update_required');
    // a subscription made before the switch (DEMO card registration) – created directly like the live demo rows
    const { cardRegistrations, paymentTokens, plans } = await import('../src/db/schema.js');
    await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi', priceHuf: 19_999 }).onConflictDoNothing();
    const [reg] = await h.deps.db.insert(cardRegistrations).values({ clientId: c.clientId, maxAmountHuf: 19_999, status: 'aktiv', mode: 'demo', cardMask: 'xxxx-xxxx-xxxx-4242', tokensUntil: new Date('2027-11-01') }).returning();
    await h.deps.db.insert(paymentTokens).values({ cardRegistrationId: reg!.id, tokenEnc: h.deps.data.enc('DEMOTOKEN1', 'payment_tokens.token'), seq: 0, status: 'aktiv' });
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', mode: 'demo', provider: 'demo', currentPeriodStart: '2026-10-20', currentPeriodEnd: '2026-11-20', nextChargeAt: new Date('2026-11-20T08:00:00Z'), cardRegistrationId: reg!.id });
    const before = fake.calls.filter((x) => x.op === 'charge').length;
    await runBillingJob(h.deps);
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub).toMatchObject({ status: 'active', currentPeriodEnd: '2026-12-20', provider: 'demo' });
    expect(fake.calls.filter((x) => x.op === 'charge').length).toBe(before);
  });
});

describe('invoices job', () => {
  it('nothing left in progress after the runs above', async () => {
    h.clock.set('2027-03-01T09:00:00Z');
    await jobInvoicesIssue(h.deps);
    const open = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.status, 'folyamatban'));
    expect(open).toHaveLength(0);
  });
});
