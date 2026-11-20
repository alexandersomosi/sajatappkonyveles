// k7c2 fix round (2026-11-20): the adversarial findings of round 2 (kod/_qa/k7c2/k7c2_fizetes_tamado.test.ts) turned into
// GUARD tests. Fake Stripe (test/fake-stripe.ts), PGlite, no network.
import { and, eq, ne } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clients, feeCharges, feeInvoices, notifications, paymentMethods, payments, subscriptions } from '../src/db/schema.js';
import { runBillingJob } from '../src/services/subscription.js';
import { applyPaymentSucceeded, chargeFeeOffSessionByAdmin, dueView, jobPaymentsReconcile, jobPredebit, refundPayment } from '../src/services/payments.js';
import { createDemoProvider } from '../src/payments/demo.js';
import { jobInvoicesIssue, queueFeeInvoice } from '../src/payments/invoices.js';
import { FAKE_STRIPE_ENV, FakeStripe } from './fake-stripe.js';
import { newClient, PW, setup, staff, type Harness } from './helpers.js';

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

interface Ctx {
  h: Harness;
  fake: FakeStripe;
  admin: { userId: string };
}

async function harness(now = '2026-11-20T09:00:00Z'): Promise<Ctx> {
  const fake = new FakeStripe();
  const h = await setup({ now, env: FAKE_STRIPE_ENV, overrides: { payments: { stripe: fake, demo: createDemoProvider({ apiPublicUrl: 'https://api.test', now: () => new Date(now) }) } } });
  const admin = (await staff(h, 'admin', `admin-k7c2-${Math.random().toString(36).slice(2, 8)}@demo.kezjegy.test`)) as { userId: string };
  return { h, fake, admin };
}

let ipN = 0;
async function relogin(x: Ctx, email: string): Promise<string> {
  const r = await x.h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': `10.77.${(++ipN >> 8) & 255}.${ipN & 255}` } });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
}

async function subscribed(x: Ctx, email: string) {
  const { h, fake } = x;
  const c = await newClient(h, email, { first: 'Kata', last: 'Szabó' });
  expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
  await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
  const cv = (await h.json('GET', '/client/subscription/consent?purpose=subscribe', { token: c.token })).body;
  const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
  expect(st.status).toBe(200);
  const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
  fake.complete(p!.stripeCheckoutSessionId!);
  expect((await h.json('GET', `/client/payments/checkout/${p!.stripeCheckoutSessionId}`, { token: c.token })).body.status).toBe('sikeres');
  return { ...c, email };
}

const fee = async (x: Ctx, clientId: string, amountHuf = 14_999, kind = 'eves_zaras', purpose: Record<string, unknown> = { type: 'eves_zaras', annualId: null }) =>
  (await x.h.deps.db.insert(feeCharges).values({ clientId, kind: kind as never, amountHuf, purpose: purpose as never, status: 'nyitott' }).returning())[0]!;
const hook = async (x: Ctx, type: string, obj: Record<string, unknown>) => {
  const ev = x.fake.event(type, obj);
  return x.h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
};
const okOfFee = async (x: Ctx, chargeId: string) => x.h.deps.db.select().from(payments).where(and(eq(payments.feeChargeId, chargeId), eq(payments.status, 'sikeres')));
const subOf = async (x: Ctx, clientId: string) => (await x.h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)))[0]!;
const adminNotes = async (x: Ctx) => x.h.deps.db.select().from(notifications).where(eq(notifications.userId, x.admin.userId));

// =====================================================================================================================
describe('one fee, at most ONE successful payment (round-1 A1/A2, round-2 B2/B3/B2b)', () => {
  let x: Ctx;
  beforeAll(async () => {
    x = await harness();
  });
  afterAll(async () => x.h.close());
  beforeEach(() => {
    x.fake.scenarios.length = 0;
    x.h.clock.set('2026-11-20T09:00:00Z');
  });

  it('B2: "Fizetek" waits for 3DS → "Másik kártyával" cancels it first; the bank page succeeding anyway is refunded as a duplicate – one success, one invoice', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'b2@demo.kezjegy.test');
    const ch = await fee(x, c.clientId);
    fake.scenarios.push('auth');
    const first = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: true } });
    expect(first.body.result).toBe('atiranyitas');
    const hosted = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    expect(hosted.body.result).toBe('atiranyitas');
    const [p1] = await h.deps.db.select().from(payments).where(eq(payments.id, first.body.paymentId));
    expect(p1!.status).toBe('megszakitva'); // cancelled at Stripe before the new page
    expect(fake.calls.some((cl) => cl.op === 'cancel' && cl.args === p1!.stripePaymentIntentId)).toBe(true);
    const [hp] = await h.deps.db.select().from(payments).where(eq(payments.id, hosted.body.paymentId));
    fake.complete(hp!.stripeCheckoutSessionId!, '5556');
    expect((await h.json('GET', `/client/payments/checkout/${hp!.stripeCheckoutSessionId}`, { token: c.token })).body.status).toBe('sikeres');
    // a race the cancel lost: the first PaymentIntent succeeded at the bank anyway
    const pi = fake.intents.get(p1!.stripePaymentIntentId!)!;
    pi.status = 'succeeded';
    pi.failureCode = null;
    expect((await hook(x, 'payment_intent.succeeded', { id: pi.id, object: 'payment_intent', metadata: { payment_id: p1!.id } })).status).toBe(200);
    expect(await okOfFee(x, ch.id)).toHaveLength(1);
    const [dup] = await h.deps.db.select().from(payments).where(eq(payments.id, p1!.id));
    expect(dup).toMatchObject({ status: 'duplikalt', refundedHuf: 14_999 });
    const invs = (await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId))).filter((i) => i.amountHuf === 14_999);
    expect(invs).toHaveLength(1);
    const [chAfter] = await h.deps.db.select().from(feeCharges).where(eq(feeCharges.id, ch.id));
    expect(chAfter!.status).toBe('fizetve'); // the duplicate's refund never touches the fee
    expect((await adminNotes(x)).some((n) => /Dupla díjfizetés – visszautaltuk/.test(n.title))).toBe(true);
  });

  it('B3 + A7: "Fizetek" uncertain → "Másik kártyával" is refused (409); the reconcile re-sends the SAME parameters and confirms the first – one success', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'b3@demo.kezjegy.test');
    const ch = await fee(x, c.clientId, 4_999, 'valtozas_egyszeru', { type: 'admin', note: 'k7c2' });
    fake.scenarios.push('uncertain');
    const r1 = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: true } });
    expect(r1.body.code).toBe('bizonytalan');
    const r2 = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    expect(r2.status).toBe(409);
    expect(JSON.stringify(r2.body)).toContain('fizetes_folyamatban');
    h.clock.set('2026-11-20T09:20:00Z');
    await jobPaymentsReconcile(h.deps);
    expect(await okOfFee(x, ch.id)).toHaveLength(1);
    // the SDK builds the Stripe request from these fields in a fixed order; the metadata keys must keep theirs too
    const sends = fake.calls.filter((cl) => cl.op === 'charge' && cl.key === `dij:${ch.id}:2026-11-20`).map((cl) => JSON.stringify({ ...(cl.args as Record<string, unknown>), demoScenario: undefined }));
    expect(sends).toHaveLength(2);
    expect(sends[1]).toBe(sends[0]); // byte-identical re-send (Stripe answers StripeIdempotencyError otherwise)
  });

  it('B2b: the admin "Levonom a mentett kártyáról" while the client has the Stripe page of the same fee open → the page is closed first; completing it anyway is refunded', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'b2b@demo.kezjegy.test');
    const ch = await fee(x, c.clientId);
    const hosted = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    const [hp] = await h.deps.db.select().from(payments).where(eq(payments.id, hosted.body.paymentId));
    const out = await chargeFeeOffSessionByAdmin(h.deps, { chargeId: ch.id, byUserId: x.admin.userId, reason: 'Levonom most' });
    expect(out.kind).toBe('succeeded');
    expect(fake.sessions.get(hp!.stripeCheckoutSessionId!)!.status).toBe('expired');
    fake.complete(hp!.stripeCheckoutSessionId!);
    expect((await hook(x, 'checkout.session.completed', { id: hp!.stripeCheckoutSessionId, object: 'checkout.session', mode: 'payment', metadata: { payment_id: hp!.id } })).status).toBe(200);
    expect(await okOfFee(x, ch.id)).toHaveLength(1);
  });

  it('GUARD: the open page of the same fee is handed back (no second session) and a paid fee refuses a new attempt', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'reuse@demo.kezjegy.test');
    const ch = await fee(x, c.clientId, 4_999, 'valtozas_egyszeru', { type: 'admin', note: 'k7c2' });
    const a = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    const b = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    expect(b.body.paymentId).toBe(a.body.paymentId);
    const ok = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: true } });
    expect(ok.body.result).toBe('sikeres');
    const [hp] = await h.deps.db.select().from(payments).where(eq(payments.id, a.body.paymentId));
    expect(hp!.status).toBe('megszakitva');
    expect(fake.sessions.get(hp!.stripeCheckoutSessionId!)!.status).toBe('expired');
    const again = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    expect(again.status).toBe(409);
  });

  it('round-1 A3: a one-off fee on the Stripe page never saves the card – after the card was deleted, the monthly fee is NOT charged off-session', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'a3@demo.kezjegy.test');
    expect((await h.json('POST', '/client/subscription/card/delete', { token: c.token })).status).toBeLessThan(300);
    const ch = await fee(x, c.clientId);
    const hosted = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: false } });
    const [hp] = await h.deps.db.select().from(payments).where(eq(payments.id, hosted.body.paymentId));
    expect(fake.sessions.get(hp!.stripeCheckoutSessionId!)!.params.saveCard).toBe(false);
    fake.complete(hp!.stripeCheckoutSessionId!, '7777');
    expect((await h.json('GET', `/client/payments/checkout/${hp!.stripeCheckoutSessionId}`, { token: c.token })).body.status).toBe('sikeres');
    expect(await h.deps.db.select().from(paymentMethods).where(and(eq(paymentMethods.clientId, c.clientId), eq(paymentMethods.status, 'aktiv')))).toHaveLength(0);
    h.clock.set('2026-12-17T09:30:00Z');
    await jobPredebit(h.deps);
    h.clock.set('2026-12-20T05:00:30Z');
    const before = fake.calls.filter((cl) => cl.op === 'charge').length;
    await runBillingJob(h.deps);
    const mine = (await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi'))));
    expect(mine).toHaveLength(0);
    expect((await subOf(x, c.clientId)).lastFailureCode).toBe('NO_CARD');
    expect(fake.calls.filter((cl) => cl.op === 'charge' && (cl.args as { metadata?: { client_id?: string } }).metadata?.client_id === c.clientId).length).toBe(0);
    void before;
  });
});

// =====================================================================================================================
describe('B1 – no off-session charge without the 3-day notice (a client back after a long suspension)', () => {
  let x: Ctx;
  beforeAll(async () => {
    x = await harness();
  });
  afterAll(async () => x.h.close());

  it('Fizesd ki of the oldest month → the next charges each wait for a notice sent ≥ 3 days before', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'b1@demo.kezjegy.test');
    h.clock.set('2026-12-17T09:00:00Z');
    await jobPredebit(h.deps);
    for (const d of ['2026-12-20', '2026-12-21', '2026-12-23', '2026-12-27']) {
      h.clock.set(`${d}T05:00:30Z`);
      fake.scenarios.push('decline');
      await runBillingJob(h.deps);
    }
    expect((await subOf(x, c.clientId)).failedAttempts).toBe(4); // +1/+3/+7 on the right days (A6)
    h.clock.set('2027-01-03T05:00:30Z');
    await runBillingJob(h.deps);
    expect((await subOf(x, c.clientId)).status).toBe('suspended');
    h.clock.set('2027-03-15T10:00:00Z');
    c.token = await relogin(x, c.email);
    const pay = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'web' } });
    expect(pay.status).toBe(200);
    const [fk] = await h.deps.db.select().from(payments).where(eq(payments.id, pay.body.paymentId));
    fake.complete(fk!.stripeCheckoutSessionId!);
    expect((await h.json('GET', `/client/payments/checkout/${fk!.stripeCheckoutSessionId}`, { token: c.token })).body.status).toBe('sikeres');
    for (const d of ['2027-03-16', '2027-03-17', '2027-03-18']) {
      h.clock.set(`${d}T05:00:30Z`);
      await runBillingJob(h.deps);
      h.clock.set(`${d}T09:00:00Z`);
      await jobPredebit(h.deps);
    }
    const early = (await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi'), eq(payments.status, 'sikeres'))));
    expect(early).toHaveLength(0); // nothing taken on 03-16 … 03-18
    const notes = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'charge_upcoming')));
    const marchNote = notes.find((n) => n.createdAt >= new Date('2027-03-16T00:00:00Z'));
    expect(marchNote?.body).toContain('március 19.');
    h.clock.set('2027-03-19T05:00:30Z');
    await runBillingJob(h.deps);
    const paid = (await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'havi'), eq(payments.status, 'sikeres'))));
    expect(paid.map((p) => [p.periodStart, p.attemptDay])).toEqual([['2027-01-20', '2027-03-19']]);
    // every off-session success has its notice at least 3 days before
    for (const p of paid) {
      const n = notes.find((m) => m.createdAt.getTime() <= new Date(`${p.attemptDay}T00:00:00Z`).getTime() - 2 * 86_400_000);
      expect(n).toBeTruthy();
    }
  });
});

// =====================================================================================================================
describe('B4, B5, B6, B7, B8, A4, A9', () => {
  let x: Ctx;
  beforeAll(async () => {
    x = await harness();
  });
  afterAll(async () => x.h.close());
  beforeEach(() => {
    x.fake.scenarios.length = 0;
    x.h.clock.set('2026-11-20T09:00:00Z');
  });

  it('B4: suspended while the business is paused → the lock banner names the pause fee (2 999 Ft), like Fizesd ki', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'b4@demo.kezjegy.test');
    const { openPause } = await import('../src/services/szuneteltetes.js');
    await openPause(h.deps, h.deps.db, c.clientId, '2026-12-01', { source: 'konyvelo', by: null });
    await h.deps.db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(ne(subscriptions.clientId, c.clientId));
    h.clock.set('2026-12-17T09:00:00Z');
    await jobPredebit(h.deps);
    for (const d of ['2026-12-20', '2026-12-21', '2026-12-23', '2026-12-27', '2027-01-03']) {
      h.clock.set(`${d}T05:00:30Z`);
      fake.scenarios.push('decline');
      await runBillingJob(h.deps);
    }
    const { computeServiceLock, serviceLockView } = await import('../src/services/zarolas.js');
    const lock = await computeServiceLock(h.deps, c.clientId);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    const due = await dueView(h.deps, cl!);
    expect(due!.amountHuf).toBe(2_999);
    expect(lock!.amountHuf).toBe(2_999);
    const view = await serviceLockView(h.deps, cl!);
    expect(view!.text).toContain('2 999');
    expect(view!.text).not.toContain('19 999');
    await h.deps.db.update(subscriptions).set({ cancelAtPeriodEnd: false }).where(ne(subscriptions.clientId, c.clientId));
  });

  it('B5: a terminated client is not offered "Fizesd ki" (409); money that still arrives alerts the admins', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'b5@demo.kezjegy.test');
    await h.deps.db.update(subscriptions).set({ status: 'past_due', failedAttempts: 1 }).where(eq(subscriptions.clientId, c.clientId));
    h.clock.set('2026-12-21T10:00:00Z');
    c.token = await relogin(x, c.email);
    const pay0 = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'web' } });
    expect(pay0.status).toBe(200); // still possible before the termination
    await h.deps.db.update(clients).set({ terminated: { kind: 'rendes', reason: 'teszt', noticeAt: '2026-12-21', effectiveOn: '2027-01-20', by: x.admin.userId, appliedAt: null } }).where(eq(clients.id, c.clientId));
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(await dueView(h.deps, cl!)).toBeNull();
    expect((await h.json('GET', '/client/payments/due', { token: c.token })).body).toBeNull();
    const pay = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'web' } });
    expect(pay.status).toBe(409);
    // the page opened before the termination is paid anyway → the admins are told (refund in the console)
    const before = (await adminNotes(x)).length;
    const [fk] = await h.deps.db.select().from(payments).where(eq(payments.id, pay0.body.paymentId));
    fake.complete(fk!.stripeCheckoutSessionId!);
    await h.json('GET', `/client/payments/checkout/${fk!.stripeCheckoutSessionId}`, { token: c.token });
    const after = await adminNotes(x);
    expect(after.length).toBeGreaterThan(before);
    expect(after.some((n) => /Fizetés felmondás után/.test(n.title))).toBe(true);
  });

  it('B7: a PaymentIntent of another amount carrying our payment_id is never applied (admin alerted)', async () => {
    const { h, fake } = x;
    const c = await newClient(h, 'b7@demo.kezjegy.test', { first: 'Kata', last: 'Szabó' });
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const cv = (await h.json('GET', '/client/subscription/consent?purpose=subscribe', { token: c.token })).body;
    const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    fake.intents.set('pi_test_k7c2_100', { id: 'pi_test_k7c2_100', status: 'succeeded', amountHuf: 100, card: fake.card(), metadata: { payment_id: st.body.paymentId }, refundedHuf: 0, failureCode: null, declineCode: null, customer: null });
    expect((await hook(x, 'payment_intent.succeeded', { id: 'pi_test_k7c2_100', object: 'payment_intent', metadata: { payment_id: st.body.paymentId } })).status).toBe(200);
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
    expect(p!.status).not.toBe('sikeres');
    expect(p!.failureCode).toBe('osszeg_elteres');
    expect((await subOf(x, c.clientId)).status).not.toBe('active');
    expect((await adminNotes(x)).some((n) => /Eltérő összegű fizetés/.test(n.title))).toBe(true);
  });

  it('B6 + A9: our own console refund whose webhook arrives first, and the same charge.refunded twice in parallel → the client is told ONCE, no "outside refund" alert', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'a9@demo.kezjegy.test');
    await jobInvoicesIssue(h.deps);
    const [p] = await h.deps.db.select().from(payments).where(and(eq(payments.clientId, c.clientId), eq(payments.kind, 'elso_havi')));
    const orig = fake.refund.bind(fake);
    fake.refund = async (i) => {
      const r = await orig(i);
      // Stripe's webhook of THIS refund arrives before our call returns – delivered twice, in parallel
      const ev = fake.event('charge.refunded', { id: `ch_${p!.stripePaymentIntentId}`, object: 'charge', payment_intent: p!.stripePaymentIntentId });
      const send = () => h.req('POST', '/webhooks/stripe', { raw: ev.raw, headers: { 'content-type': 'application/json', 'stripe-signature': ev.signature } });
      await Promise.all([send(), send()]);
      return r;
    };
    const alertsBefore = (await adminNotes(x)).filter((n) => /Visszatérítés a Stripe-ban/.test(n.title)).length;
    await refundPayment(h.deps, { paymentId: p!.id, amountHuf: 19_999, reason: 'teszt visszatérítés', byUserId: x.admin.userId });
    fake.refund = orig;
    const told = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'payment_refunded')));
    expect(told).toHaveLength(1);
    const [q] = await h.deps.db.select().from(payments).where(eq(payments.id, p!.id));
    expect(q!.refundedHuf).toBe(19_999);
    expect(q!.refunds).toHaveLength(1);
    expect(q!.refunds[0]!.status).toBe('succeeded');
    expect((await adminNotes(x)).filter((n) => /Visszatérítés a Stripe-ban/.test(n.title)).length).toBe(alertsBefore);
  });

  it('A4: the automatic refund of a duplicate fails → the alert says so, the reconcile retries it, the console may refund a "duplikalt" row', async () => {
    const { h, fake } = x;
    const c = await subscribed(x, 'a4@demo.kezjegy.test');
    const ch = await fee(x, c.clientId, 4_999, 'valtozas_egyszeru', { type: 'admin', note: 'k7c2' });
    const ok = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web', useSavedCard: true } });
    expect(ok.body.result).toBe('sikeres');
    // a second success for the same fee (a bank page that went through after all)
    const [dupRow] = await h.deps.db.insert(payments).values({ clientId: c.clientId, feeChargeId: ch.id, kind: 'egyszeri', provider: 'stripe', mode: 'test', amountHuf: 4_999, status: 'hitelesites_kell', initiated: 'ugyfel', idempotencyKey: 'k7c2:a4:dup', stripePaymentIntentId: 'pi_test_k7c2_a4' }).returning();
    fake.intents.set('pi_test_k7c2_a4', { id: 'pi_test_k7c2_a4', status: 'succeeded', amountHuf: 4_999, card: fake.card(), metadata: { payment_id: dupRow!.id }, refundedHuf: 0, failureCode: null, declineCode: null, customer: null });
    const orig = fake.refund.bind(fake);
    fake.refund = async () => {
      throw new Error('stripe down');
    };
    expect(await applyPaymentSucceeded(h.deps, dupRow!.id, { providerRef: 'pi_test_k7c2_a4', chargeRef: null, card: null, amountHuf: 4_999, currency: 'huf' })).toBe('duplicate');
    fake.refund = orig;
    let [d] = await h.deps.db.select().from(payments).where(eq(payments.id, dupRow!.id));
    expect(d).toMatchObject({ status: 'duplikalt', refundedHuf: 0 });
    expect(d!.refundPendingAt).not.toBeNull();
    expect((await adminNotes(x)).some((n) => /NEM sikerült visszautalni/.test(n.title))).toBe(true);
    await jobPaymentsReconcile(h.deps);
    [d] = await h.deps.db.select().from(payments).where(eq(payments.id, dupRow!.id));
    expect(d).toMatchObject({ refundedHuf: 4_999, refundPendingAt: null });
    expect((await okOfFee(x, ch.id)).length).toBe(1);
  });

  it('B8: a payment without an invoicing route (live money on a demo invoice config) → the admins are alerted once', async () => {
    const { h } = x;
    const c = await subscribed(x, 'b8@demo.kezjegy.test');
    const [row] = await h.deps.db.insert(payments).values({ clientId: c.clientId, kind: 'egyszeri', provider: 'stripe', mode: 'live', amountHuf: 4_999, status: 'sikeres', initiated: 'ugyfel', idempotencyKey: 'k7c2:b8' }).returning();
    const before = (await adminNotes(x)).filter((n) => n.kind === 'invoice_failed').length;
    const id = await h.deps.db.transaction(async (tx) => queueFeeInvoice(h.deps, tx, row!, { name: 'Szabó Kata', firstName: 'Kata', zip: '1136', city: 'Budapest', address: 'Példa utca 7.', adoszam: null, email: 'b8@demo.kezjegy.test' }, { megnevezes: 'teszt', unit: 'alkalom' }));
    await jobInvoicesIssue(h.deps);
    await jobInvoicesIssue(h.deps);
    const [inv] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, id!));
    expect(inv).toMatchObject({ status: 'hiba', lastErrorCode: 'mode_mismatch' });
    expect(inv!.alertedAt).not.toBeNull();
    expect((await adminNotes(x)).filter((n) => n.kind === 'invoice_failed').length).toBe(before + 1);
  });
});
