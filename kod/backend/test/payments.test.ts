// SimplePay (SPEC §9): DEMO start → demo pay page → IPN (same handler) → active subscription and
// fee invoice; IPN signature, idempotency and signed reply; dorecurring with retries on a fake clock;
// cancellation; card deletion; production without keys → 503.
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, feeInvoices, paymentTokens, simplepayTransactions, subscriptions } from '../src/db/schema.js';
import { spSign, spVerify } from '../src/payments/simplepay.js';
import { integrationModes } from '../src/config.js';
import { runBillingJob } from '../src/services/subscription.js';
import { newClient, PW, setup, type Harness } from './helpers.js';
import { acceptContract } from './helpers.js';

let h: Harness;
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
  h = await setup({ now: '2026-11-17T09:00:00Z' });
});
afterAll(async () => h.close());

let ipN = 0;
async function relogin(email: string): Promise<string> {
  const r = await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': `10.77.0.${++ipN}` } });
  expect(r.status).toBe(200);
  return r.body.accessToken as string;
}

async function subscribed(email: string) {
  const c = await newClient(h, email, { first: 'Kata' });
  await h.json('PUT', '/client/profile', { token: c.token, body: profile });
  await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
  const start = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
  expect(start.status).toBe(200);
  const orderRef = start.body.orderRef as string;
  const pay = await h.req('POST', '/payments/demo/pay', { raw: `o=${encodeURIComponent(orderRef)}&eredmeny=ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  expect(pay.status).toBe(303);
  return { ...c, orderRef, start: start.body, payRedirect: pay.headers.get('location')! };
}

describe('registration (DEMO)', () => {
  let c: Awaited<ReturnType<typeof subscribed>>;
  it('start returns the demo pay URL and the token terms', async () => {
    c = await subscribed('kata@demo.kezjegy.test');
    expect(c.start.paymentUrl).toContain('/api/v1/payments/demo/pay?o=');
    expect(c.start.tokenInfo).toMatchObject({ times: 12, maxAmountHuf: 19999 }); // SPEC §28.K.1
    expect(c.orderRef).toMatch(/^KJ-20261117-[A-Z2-7]{10}$/);
  });
  it('the demo page is clearly labelled', async () => {
    const page = await h.req('GET', `/payments/demo/pay?o=${encodeURIComponent(c.orderRef)}`);
    const html = await page.text();
    expect(html).toContain('DEMO FIZETÉS');
    expect(html).toContain('12 alkalommal');
  });
  it('back URL verifies the signature and redirects to the app', async () => {
    const back = await h.req('GET', c.payRedirect.replace('/api/v1', ''));
    expect(back.status).toBe(302);
    expect(back.headers.get('location')).toMatch(/\/fiok\/elofizetes\?eredmeny=SUCCESS&t=\d+/);
    const forged = await h.req('GET', c.payRedirect.replace('/api/v1', '').replace(/s=[^&]+/, 's=AAAA'));
    expect(forged.headers.get('location')).toContain('eredmeny=FAIL');
  });
  it('IPN FINISHED activated the subscription, issued the DEMO fee invoice, finished the onboarding step', async () => {
    const sub = await h.json('GET', '/client/subscription', { token: c.token });
    expect(sub.body).toMatchObject({ status: 'active', mode: 'demo', priceHuf: 19999, currentPeriodEnd: '2026-12-17', cancelAtPeriodEnd: false });
    expect(sub.body.card).toMatchObject({ mask: 'xxxx-xxxx-xxxx-4242', tokensLeft: 12 });
    const fees = await h.json('GET', '/client/fee-invoices', { token: c.token });
    expect(fees.body.items).toHaveLength(1);
    expect(fees.body.items[0]).toMatchObject({ amountHuf: 19999, demo: true });
    expect(fees.body.items[0].number).toMatch(/^DEMO-2026-\d{6}$/);
    const pdf = await h.req('GET', `/files/${fees.body.items[0].fileId}`, { token: c.token });
    expect(pdf.status).toBe(200);
    const onb = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(onb.body.steps.find((s: { step: string }) => s.step === 'elofizetes').status).toBe('kesz');
  });
  it('a card change while active prepays the NEXT month: no day is paid twice', async () => {
    h.clock.advance(3 * 60_000);
    const before = await h.json('GET', '/client/subscription', { token: c.token });
    const end = before.body.currentPeriodEnd as string;
    expect(before.body.nextPaidPeriodStart).toBe(end);
    const again = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true, purpose: 'card_update' } });
    expect(again.status).toBe(200);
    expect(again.body.period.start).toBe(end);
    // A second tap (or coming back from the payment page) hands back the SAME payment: no second registration, no 409.
    const tap2 = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    expect(tap2.status).toBe(200);
    expect(tap2.body.orderRef).toBe(again.body.orderRef);
    expect(tap2.body.paymentUrl).toBe(again.body.paymentUrl);
    expect(tap2.body.period).toEqual(again.body.period);
    const open = await h.deps.db.select().from(simplepayTransactions).where(and(eq(simplepayTransactions.clientId, c.clientId), isNull(simplepayTransactions.appliedAt)));
    expect(open.length).toBe(1);
    await h.req('POST', '/payments/demo/pay', { raw: `o=${encodeURIComponent(again.body.orderRef)}&eredmeny=ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    const after = await h.json('GET', '/client/subscription', { token: c.token });
    expect(after.body.currentPeriodEnd > end).toBe(true);
    const [tx] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, again.body.orderRef));
    expect(tx!.periodStart).toBe(end);
    h.clock.advance(-3 * 60_000);
  });
});

describe('IPN endpoint', () => {
  it('rejects a bad signature with 400 and stores nothing', async () => {
    const body = JSON.stringify({ orderRef: 'KJ-x', merchant: 'DEMO', transactionId: 1, status: 'FINISHED' });
    const r = await h.req('POST', '/webhooks/simplepay/ipn', { raw: body, headers: { 'content-type': 'application/json', signature: 'rossz' } });
    expect(r.status).toBe(400);
  });
  it('answers with the received JSON + receiveDate, signed; replays are idempotent', async () => {
    const c = await subscribed('ipn@demo.kezjegy.test');
    const [tx] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, c.orderRef));
    const body = JSON.stringify({ salt: 'abc', orderRef: c.orderRef, method: 'CARD', merchant: 'DEMO', finishDate: '2026-11-17T09:00:00+00:00', paymentDate: '2026-11-17T09:00:00+00:00', transactionId: tx!.simplepayTransactionId, status: 'FINISHED' });
    for (let i = 0; i < 2; i++) {
      const r = await h.req('POST', '/webhooks/simplepay/ipn', { raw: body, headers: { 'content-type': 'application/json', signature: spSign(h.deps.cfg.simplepay.demoSecret, body) } });
      expect(r.status).toBe(200);
      const text = await r.text();
      expect(spVerify(h.deps.cfg.simplepay.demoSecret, text, r.headers.get('signature'))).toBe(true);
      const j = JSON.parse(text);
      expect(j.orderRef).toBe(c.orderRef);
      expect(j.receiveDate).toMatch(/^2026-11-17T09:00:00\+00:00$/);
    }
    const fees = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId));
    expect(fees).toHaveLength(1);
    const [after] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, c.orderRef));
    expect(after!.ipnCount).toBe(3);
  });
});

describe('monthly charge (dorecurring) and retries', () => {
  it('charges at period end, uses one token, extends the period', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await subscribed('havi@demo.kezjegy.test');
    h.clock.set('2026-12-17T08:30:00Z');
    const res = await runBillingJob(h.deps);
    expect(res.charged).toBeGreaterThanOrEqual(1);
    const t = await relogin('havi@demo.kezjegy.test');
    const sub = await h.json('GET', '/client/subscription', { token: t });
    expect(sub.body.currentPeriodEnd).toBe('2027-01-17');
    expect(sub.body.card.tokensLeft).toBe(11);
    const fees = await h.json('GET', '/client/fee-invoices', { token: t });
    expect(fees.body.items).toHaveLength(2);
  });

  it('failed charges: past_due, retries at +1/+3/+7 days, suspended after 14 days, card change fixes it', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await subscribed('fail+kata@demo.kezjegy.test');
    const [sub0] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    h.clock.set('2026-12-17T08:30:00Z');
    await runBillingJob(h.deps);
    let [s] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.id, sub0!.id));
    expect(s!.status).toBe('past_due');
    expect(s!.failedAttempts).toBe(1);
    expect(s!.nextRetryAt!.toISOString()).toBe('2026-12-18T08:30:00.000Z');
    expect(s!.graceUntil).toBe('2026-12-31');
    // the unsuccessful payment does not consume the token
    const active = await h.deps.db.select().from(paymentTokens).where(and(eq(paymentTokens.cardRegistrationId, s!.cardRegistrationId!), eq(paymentTokens.status, 'aktiv')));
    expect(active).toHaveLength(12);
    for (const [at, n] of [['2026-12-18T09:00:00Z', 2], ['2026-12-20T09:00:00Z', 3], ['2026-12-24T09:00:00Z', 4]] as const) {
      h.clock.set(at);
      await runBillingJob(h.deps);
      [s] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.id, sub0!.id));
      expect(s!.failedAttempts).toBe(n);
    }
    expect(s!.nextRetryAt).toBeNull();
    h.clock.set('2026-12-31T09:00:00Z');
    await runBillingJob(h.deps);
    [s] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.id, sub0!.id));
    expect(s!.status).toBe('suspended');
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lifecycle).toBe('felfuggesztve');
    const notes = await h.json('GET', '/me/notifications', { token: (await h.json('POST', '/auth/login', { body: { email: 'fail+kata@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' }, headers: { 'x-forwarded-for': '10.9.9.9' } })).body.accessToken });
    expect(notes.body.items.filter((n: { kind: string }) => n.kind === 'subscription_payment_failed')).toHaveLength(1);
    // card change = new registration that charges the due month
    const login = await h.json('POST', '/auth/login', { body: { email: 'fail+kata@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' }, headers: { 'x-forwarded-for': '10.9.9.8' } });
    const start = await h.json('POST', '/client/subscription/start', { token: login.body.accessToken, body: { platform: 'app', acceptedDeclarations: true } });
    expect(start.status).toBe(200);
    const pay = await h.req('POST', '/payments/demo/pay', { raw: `o=${encodeURIComponent(start.body.orderRef)}&eredmeny=ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    const back = await h.req('GET', pay.headers.get('location')!.replace('/api/v1', ''));
    expect(back.headers.get('location')).toMatch(/^kezjegy:\/\/elofizetes\/eredmeny\?e=SUCCESS/);
    [s] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.id, sub0!.id));
    expect(s!.status).toBe('active');
    expect(s!.currentPeriodStart).toBe('2026-12-31');
    const [cl2] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl2!.lifecycle).toBe('aktiv');
  });

  it('a failed demo payment on the page leaves the subscription incomplete', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await newClient(h, 'megszakit@demo.kezjegy.test');
    await h.json('PUT', '/client/profile', { token: c.token, body: profile });
    await acceptContract(h, c.token);
    const start = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    const pay = await h.req('POST', '/payments/demo/pay', { raw: `o=${encodeURIComponent(start.body.orderRef)}&eredmeny=fail`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    const back = await h.req('GET', pay.headers.get('location')!.replace('/api/v1', ''));
    expect(back.headers.get('location')).toContain('eredmeny=FAIL');
    const sub = await h.json('GET', '/client/subscription', { token: c.token });
    expect(sub.body.status).toBe('incomplete');
  });
});

describe('cancel and card deletion', () => {
  it('cancel at period end → canceled by the job; card deletion is always possible', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await subscribed('lemond@demo.kezjegy.test');
    const cancel = await h.json('POST', '/client/subscription/cancel', { token: c.token });
    expect(cancel.body.cancelAtPeriodEnd).toBe(true);
    expect(cancel.body.nextChargeAt).toBeUndefined();
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.serviceNotice).toMatchObject({ kind: 'megszunik', canResume: true });
    const resume = await h.json('POST', '/client/subscription/resume', { token: c.token });
    expect(resume.body.cancelAtPeriodEnd).toBe(false);
    await h.json('POST', '/client/subscription/cancel', { token: c.token });
    const del = await h.json('POST', '/client/subscription/card/delete', { token: c.token });
    expect(del.status).toBe(200);
    expect(del.body.card).toBeUndefined();
    // Without a card "Mégis maradok" cannot work: the app offers a restart instead.
    expect((await h.json('POST', '/client/subscription/resume', { token: c.token })).status).toBe(409);
    h.clock.set('2026-12-17T10:00:00Z');
    await runBillingJob(h.deps);
    const sub = await h.json('GET', '/client/subscription', { token: await relogin('lemond@demo.kezjegy.test') });
    expect(sub.body.status).toBe('canceled');
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lifecycle).toBe('megszunt');
  });
});

describe('production without SimplePay keys', () => {
  it('never pretends: 503 not_configured, /health says disabled', async () => {
    const p = await setup({ env: { APP_ENV: 'production', SIMPLEPAY_MODE: '', NAV_MODE: 'test', INVOICE_MODE: 'szamlazzhu', STAFF_TOTP_REQUIRED: 'true' } });
    try {
      // anonymous /health carries only ok / version / db (round 1); the modes are on the admin Rendszer page
      const health = await p.json('GET', '/health');
      expect(Object.keys(health.body).sort()).toEqual(['db', 'ok', 'version']);
      expect(integrationModes(p.deps.cfg)).toMatchObject({ simplepay: 'disabled', invoice: 'disabled', push: 'disabled' });
      const c = await newClient(p, 'eles@demo.kezjegy.test');
      await p.json('PUT', '/client/profile', { token: c.token, body: profile });
      await acceptContract(p, c.token);
      const r = await p.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
      expect(r.status).toBe(503);
      expect(r.body.error).toMatchObject({ code: 'not_configured', message: 'A kártyás fizetés még nincs bekapcsolva.' });
      expect((await p.req('GET', '/payments/demo/pay?o=x')).status).toBe(404);
    } finally {
      await p.close();
    }
  });
});

// QA kör 2: a DEMO kártyát éles (nem DEMO) SimplePay mellett soha nem „terheljük”, és DEMO fizetéshez
// soha nem kérünk valódi számlát.
describe('DEMO subscriptions after going live', () => {
  it('a demo card is not charged when SimplePay is not in DEMO mode; the client must give a real card', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await subscribed('demo-eles@demo.kezjegy.test');
    const cfg = h.deps.cfg.simplepay as { mode: string };
    const before = cfg.mode;
    cfg.mode = 'disabled';
    try {
      h.clock.set('2026-12-17T08:30:00Z');
      const res = await runBillingJob(h.deps);
      expect(res.charged ?? 0).toBe(0);
      const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
      expect(sub!.status).toBe('past_due');
      expect(sub!.lastFailureCode).toBe('DEMO_TOKEN');
      expect(sub!.currentPeriodEnd).toBe('2026-12-17');
    } finally {
      cfg.mode = before;
    }
  });

  it('a DEMO payment gets the DEMO díjbekérő even when a real invoice provider is configured', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const real = h.deps.invoices;
    let called = 0;
    (h.deps as { invoices: unknown }).invoices = {
      provider: 'szamlazzhu',
      async issue() {
        called++;
        throw new Error('must not be called for a DEMO payment');
      },
    };
    try {
      const c = await subscribed('demo-szamla@demo.kezjegy.test');
      const fees = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId));
      expect(called).toBe(0);
      expect(fees).toHaveLength(1);
      expect(fees[0]).toMatchObject({ provider: 'demo', demo: true, status: 'kiallitva' });
    } finally {
      (h.deps as { invoices: unknown }).invoices = real;
    }
  });
});
