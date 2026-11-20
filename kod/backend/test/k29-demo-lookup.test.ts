// SPEC §29.1.12 the DEMO provider (the server's mode until the owner runs stripe_szerverre.ps1), the REAL Stripe SDK
// request shape on a fake HTTP layer (no network, no key), and §29.4.4 the taxpayer lookup (8 s timeout, 24 h memory
// cache, rate limit, nothing in the DB).
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { taxNumberCheckDigit } from '@kezjegy/nav-kliens';
import { auditLog, clients, paymentMethods, payments, subscriptions } from '../src/db/schema.js';
import { runBillingJob } from '../src/services/subscription.js';
import { jobPredebit } from '../src/services/payments.js';
import { createStripeProvider } from '../src/payments/stripe.js';
import { lookupTaxpayer, lookupCacheSize } from '../src/services/adoszam-kereso.js';
import { createNavFactory } from '../src/nav/client.js';
import { newClient, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let navCalls = 0;
let navSlow = false;
beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
  // wrap the real factory to count (and optionally stall) the NAV calls
  const real = createNavFactory(h.deps.cfg, h.deps.now);
  (h.deps as { navClient: typeof h.deps.navClient }).navClient = (env, creds) => {
    const c = real(env, creds);
    return {
      ...c,
      async queryTaxpayer(t: string) {
        navCalls++;
        if (navSlow) return new Promise(() => undefined);
        return c.queryTaxpayer(t);
      },
    } as typeof c;
  };
});
afterAll(async () => h.close());

const profile = { firstName: 'Réka', lastName: 'Varga', adoazonositoJel: '8417104569', adoszam: '68801234-1-41', address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' }, hqMunicipality: 'Budapest', activityText: 'Grafika', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2019-04-01', hasSeparateBusinessAccount: true };

async function active(email: string) {
  const c = await newClient(h, email, { first: 'Réka', last: 'Varga' });
  await h.json('PUT', '/client/profile', { token: c.token, body: profile });
  await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
  return c;
}

describe('DEMO provider (PAYMENT_PROVIDER=demo, the default on APP_ENV=demo)', () => {
  it('/config says so; the consent; the hosted page is our DEMO page with four buttons', async () => {
    const cfg = await h.json('GET', '/config');
    expect(cfg.body).toMatchObject({ paymentProvider: 'demo', paymentMode: 'demo', simplepayEnabled: true });
    const c = await active('demo.k29@demo.kezjegy.test');
    const cv = await h.json('GET', '/client/subscription/consent', { token: c.token });
    expect(cv.body).toMatchObject({ provider: 'demo', demo: true, amountNowHuf: 19_999 });
    const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.body.version, consentSha256: cv.body.sha256 } });
    expect(st.status).toBe(200);
    expect(st.body).toMatchObject({ provider: 'demo', demo: true, mode: 'payment' });
    expect(st.body.url).toContain('/api/v1/payments/demo/fizetes?p=');
    const page = await h.req('GET', `/payments/demo/fizetes?p=${st.body.paymentId}`);
    const html = await page.text();
    expect(html).toContain('DEMO FIZETÉS – nem valódi kártya, nem vonunk le pénzt.');
    for (const b of ['Sikeres fizetés szimulálása', 'Hitelesítést kér (3DS) szimulálása', 'Elutasított kártya szimulálása', 'Megszakítom']) expect(html).toContain(b);
    expect(page.headers.get('content-security-policy')).toContain('form-action');
    // 3DS → confirm page → confirm → back URL → result
    const a = await h.req('POST', '/payments/demo/fizetes', { raw: `p=${st.body.paymentId}&valasztas=auth`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(a.status).toBe(303);
    const conf = await (await h.req('GET', a.headers.get('location')!.replace('/api/v1', ''))).text();
    expect(conf).toContain('Megerősítem');
    const ok = await h.req('POST', '/payments/demo/fizetes', { raw: `p=${st.body.paymentId}&valasztas=auth_ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(ok.status).toBe(303);
    const back = await h.req('GET', ok.headers.get('location')!.replace('/api/v1', ''));
    expect(back.status).toBe(302);
    const loc = new URL(back.headers.get('location')!);
    expect(loc.pathname).toBe('/elofizetes/eredmeny');
    const res = await h.json('GET', `/client/payments/checkout/${loc.searchParams.get('cs')}`, { token: c.token });
    expect(res.body).toMatchObject({ status: 'sikeres', cardLabel: 'DEMO •••• 4242', nextChargeOn: '2026-12-20' });
    const sub = await h.json('GET', '/client/subscription', { token: c.token });
    expect(sub.body).toMatchObject({ status: 'active', provider: 'demo' });
    expect(sub.body.cardInfo.label).toBe('DEMO •••• 4242');
  });
  it('the monthly charge of a NEW demo card runs through the DEMO provider; fail+ → declined', async () => {
    h.clock.set('2026-11-20T09:00:00Z');
    const ok = await active('demo.havi@demo.kezjegy.test');
    const bad = await active('fail+demo.havi@demo.kezjegy.test');
    for (const c of [ok, bad]) {
      const cv = await h.json('GET', '/client/subscription/consent', { token: c.token });
      const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'app', purpose: 'subscribe', consentVersion: cv.body.version, consentSha256: cv.body.sha256 } });
      await h.req('POST', '/payments/demo/fizetes', { raw: `p=${st.body.paymentId}&valasztas=ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    }
    // k7c2: the pre-debit notice 3 days before (the 10:00 job), then the charge on the day
    h.clock.set('2026-12-17T09:30:00Z');
    await jobPredebit(h.deps);
    h.clock.set('2026-12-20T09:00:00Z');
    await runBillingJob(h.deps);
    const [s1] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, ok.clientId));
    expect(s1).toMatchObject({ status: 'active', currentPeriodEnd: '2027-01-20', provider: 'demo' });
    const [s2] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, bad.clientId));
    expect(s2).toMatchObject({ status: 'past_due', failedAttempts: 1 });
    const pm = await h.deps.db.select().from(paymentMethods).where(eq(paymentMethods.clientId, ok.clientId));
    expect(pm[0]).toMatchObject({ provider: 'demo', mode: 'demo', status: 'aktiv', last4: '4242' });
  });
  it('the card deletion detaches and blocks the next charge until a new card', async () => {
    h.clock.set('2026-12-20T10:00:00Z');
    const login = await h.json('POST', '/auth/login', { body: { email: 'demo.havi@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.99.0.1' } });
    const token = login.body.accessToken as string;
    const r = await h.json('POST', '/client/subscription/card/delete', { token });
    expect(r.status).toBe(200);
    expect(r.body.cardInfo).toBeNull();
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.userId, login.body.user.id));
    const pms = await h.deps.db.select().from(paymentMethods).where(eq(paymentMethods.clientId, cl!.id));
    expect(pms.every((p) => p.status === 'torolve')).toBe(true);
  });
});

describe('the real Stripe SDK on a fake HTTP layer (request shape, error mapping)', () => {
  const k = (...p: string[]) => p.join('_');
  const cfg = { mode: 'test' as const, secretKey: k('sk', 'test', 'SHAPE0000000000'), publishableKey: k('pk', 'test', 'SHAPE0000000000'), webhookSecret: k('whsec', 'SHAPE0000000000'), suffixHavi: 'HAVIDIJ', locale: 'hu' };
  const seen: { url: string; method: string; body: string; headers: Record<string, string> }[] = [];
  const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  const fetchFake = (async (url: string, init: { method: string; body?: string; headers: Record<string, string> }) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers as HeadersInit).forEach((v, a) => (headers[a.toLowerCase()] = v));
    seen.push({ url, method: init.method, body: String(init.body ?? ''), headers });
    const u = new URL(url);
    if (u.pathname === '/v1/checkout/sessions' && init.method === 'POST') return json(200, { id: 'cs_test_1', object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/cs_test_1', expires_at: 1_900_000_000 });
    if (u.pathname === '/v1/payment_intents' && init.method === 'POST') {
      if (String(init.body).includes('amount=299900')) return json(402, { error: { type: 'card_error', code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.', payment_intent: { id: 'pi_test_dec', object: 'payment_intent', status: 'requires_payment_method' } } });
      if (String(init.body).includes('amount=1499900')) return json(402, { error: { type: 'card_error', code: 'authentication_required', message: 'auth', payment_intent: { id: 'pi_test_auth', object: 'payment_intent', status: 'requires_payment_method' } } });
      return json(200, { id: 'pi_test_ok', object: 'payment_intent', status: 'succeeded' });
    }
    if (u.pathname === '/v1/payment_intents/pi_test_ok') return json(200, { id: 'pi_test_ok', object: 'payment_intent', status: 'succeeded', amount: 1_999_900, metadata: {}, latest_charge: { id: 'ch_1', object: 'charge', amount_refunded: 0, payment_method_details: { card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } } }, payment_method: { id: 'pm_1', object: 'payment_method', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } } });
    return json(404, { error: { type: 'invalid_request_error', message: 'nope' } });
  }) as unknown as typeof fetch;
  const prov = createStripeProvider({ cfg, fetch: fetchFake });

  it('Checkout: payment mode + setup_future_usage, HUF ×100, suffix, our metadata, the idempotency key, the pinned version', async () => {
    await prov.startHosted({ mode: 'payment', paymentId: 'p-1', clientId: 'c-1', customerRef: 'cus_1', amountHuf: 19_999, saveCard: true, productName: 'Adózz havidíj (2026.11.20.–2026.12.19.)', description: 'Adózz havidíj', statementSuffix: 'HAVIDIJ', submitMessage: 'Havi 19 999 Ft', successUrl: 'https://api.test/vissza?cs={CHECKOUT_SESSION_ID}', cancelUrl: 'https://api.test/vissza?megszakitva=1', platform: 'app', expiresAt: new Date(Date.now() + 30 * 60_000), idempotencyKey: 'checkout:p-1', metadata: { payment_id: 'p-1', client_id: 'c-1', kind: 'elso_havi' } });
    const r = seen.find((s) => s.url.endsWith('/v1/checkout/sessions'))!;
    const body = decodeURIComponent(r.body);
    expect(body).toContain('mode=payment');
    expect(body).toContain('payment_intent_data[setup_future_usage]=off_session');
    expect(body).toContain('payment_intent_data[statement_descriptor_suffix]=HAVIDIJ');
    expect(body).toContain('line_items[0][price_data][unit_amount]=1999900');
    expect(body).toContain('line_items[0][price_data][currency]=huf');
    expect(body).toContain('allowed_payment_method_types[0]=card');
    expect(body).toContain('origin_context=mobile_app');
    expect(body).toContain('locale=hu');
    expect(body).toContain('metadata[payment_id]=p-1');
    expect(r.headers['idempotency-key']).toBe('checkout:p-1');
    expect(r.headers['stripe-version']).toBe('2026-10-28.endive');
  });
  it('off-session charge: succeeded / insufficient funds (declined) / authentication_required – never throws on a decline', async () => {
    const base = { paymentId: 'p-2', customerRef: 'cus_1', paymentMethodRef: 'pm_1', offSession: true, description: 'Adózz havidíj', statementSuffix: 'HAVIDIJ', idempotencyKey: 'havidij:s:2026-12-20:2026-12-20', metadata: { payment_id: 'p-2' } };
    const ok = await prov.chargeSaved({ ...base, amountHuf: 19_999 });
    expect(ok).toMatchObject({ kind: 'succeeded', providerRef: 'pi_test_ok', card: { brand: 'visa', last4: '4242', paymentMethodRef: 'pm_1' } });
    const charge = seen.find((s) => s.url.endsWith('/v1/payment_intents') && s.body.includes('amount=1999900'))!;
    expect(decodeURIComponent(charge.body)).toContain('off_session=true');
    expect(decodeURIComponent(charge.body)).toContain('confirm=true');
    expect(charge.headers['idempotency-key']).toBe('havidij:s:2026-12-20:2026-12-20');
    expect(await prov.chargeSaved({ ...base, amountHuf: 2_999, idempotencyKey: 'k2' })).toEqual({ kind: 'declined', providerRef: 'pi_test_dec', code: 'card_declined', declineCode: 'insufficient_funds' });
    expect(await prov.chargeSaved({ ...base, amountHuf: 14_999, idempotencyKey: 'k3' })).toEqual({ kind: 'requires_auth', providerRef: 'pi_test_auth', redirectUrl: null });
  });
  it('a webhook with a wrong signature is null; the right one is parsed', async () => {
    const { stripeTestSignature } = await import('../src/payments/stripe.js');
    const raw = JSON.stringify({ id: 'evt_1', object: 'event', type: 'payment_intent.succeeded', livemode: false, created: 1, data: { object: { id: 'pi_1', object: 'payment_intent', metadata: { payment_id: 'x' } } } });
    expect(prov.verifyWebhook(raw, { 'stripe-signature': stripeTestSignature(raw, k('whsec', 'OTHER0000')) })).toBeNull();
    const ev = prov.verifyWebhook(raw, { 'stripe-signature': stripeTestSignature(raw, cfg.webhookSecret) });
    expect(ev).toMatchObject({ id: 'evt_1', type: 'payment_intent.succeeded', objectId: 'pi_1', livemode: false });
  });
});

describe('taxpayer lookup (§29.4.4)', () => {
  const valid = (seven: string) => `${seven}${taxNumberCheckDigit(seven)}`;
  it('DEMO mock: found an EV; the full adószám, the seat; cached for 24 h without a second NAV call', async () => {
    h.clock.set('2026-11-21T09:00:00Z');
    const c = await newClient(h, 'lookup@demo.kezjegy.test');
    const t = valid('6880123');
    navCalls = 0;
    const r1 = await h.json('POST', '/client/onboarding/taxpayer-lookup', { token: c.token, body: { torzsszam: t } });
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ status: 'talalt', demo: true, selfEmployed: true, vatCode: '1', alanyiMentes: true, afaWarning: false, cached: false });
    expect(r1.body.adoszam).toMatch(new RegExp(`^${t}-1-\\d{2}$`));
    expect(r1.body.seat).toMatchObject({ zip: expect.stringMatching(/^\d{4}$/) });
    const r2 = await h.json('POST', '/client/onboarding/taxpayer-lookup', { token: c.token, body: { torzsszam: t } });
    expect(r2.body.cached).toBe(true);
    expect(navCalls).toBe(1);
    h.clock.advance(25 * 3600_000);
    const c2 = await h.json('POST', '/auth/login', { body: { email: 'lookup@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.99.1.1' } });
    const r3 = await h.json('POST', '/client/onboarding/taxpayer-lookup', { token: c2.body.accessToken, body: { torzsszam: t } });
    expect(r3.body.cached).toBe(false);
    expect(navCalls).toBe(2);
    // the audit says only found / demo / cached – never the number or the name
    const a = await h.deps.db.select().from(auditLog).where(eq(auditLog.action, 'onboarding.taxpayer_lookup'));
    expect(a.length).toBe(3);
    expect(JSON.stringify(a.map((x) => x.details))).not.toContain(t);
    expect(Object.keys(a[0]!.details ?? {}).sort()).toEqual(['cached', 'demo', 'found']);
    expect(lookupCacheSize(h.deps)).toBeGreaterThan(0);
  });
  it('a wrong check digit → 400; a stalled NAV → 503 lookup_unavailable "Töltsd ki kézzel" within the budget', async () => {
    const c = await newClient(h, 'lookup2@demo.kezjegy.test');
    const bad = await h.json('POST', '/client/onboarding/taxpayer-lookup', { token: c.token, body: { torzsszam: '68801230' } });
    expect([400, 200]).toContain(bad.status);
    navSlow = true;
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    const started = Date.now();
    await expect(lookupTaxpayer(h.deps, cl!, valid('7770001'), { timeoutMs: 80 })).rejects.toMatchObject({ status: 503, code: 'lookup_unavailable', message: 'Most nem érjük el a NAV-ot. Töltsd ki kézzel – ugyanúgy jó.' });
    expect(Date.now() - started).toBeLessThan(2_000);
    navSlow = false;
  });
  it('rate limit 10/h per client (cache hits do not count)', async () => {
    const c = await newClient(h, 'lookup3@demo.kezjegy.test');
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const t = valid(String(5_000_000 + i * 7));
      last = (await h.json('POST', '/client/onboarding/taxpayer-lookup', { token: c.token, body: { torzsszam: t } })).status;
    }
    expect(last).toBe(429);
  });
  it('business identity is saved (name, seat, adószám or pending) and the accountant can set the adószám with the ÁFA warning', async () => {
    const c = await newClient(h, 'identity@demo.kezjegy.test');
    const r = await h.json('POST', '/client/onboarding/business-identity', { token: c.token, body: { source: 'kezi', adoszam: null, name: 'Teszt Elek e.v.', seat: { zip: '1136', city: 'Budapest', streetName: 'Példa', streetType: 'utca', houseNumber: '7.' }, alanyiMentes: 'nem_tudom' } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ adoszam: null, adoszamPending: true });
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.businessIdentity).toMatchObject({ name: 'Teszt Elek e.v.', seat: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' } });
    expect(cl!.businessIdentitySource).toBe('kezi');
  });
  it('POST /acc/clients/:id/adoszam (§28.K.9 route): check digit, the ÁFA code, another accountant 404', async () => {
    const bence = await staff(h, 'accountant', 'bence.adoszam@demo.kezjegy.test', { firstName: 'Bence' });
    const other = await staff(h, 'accountant', 'masik.adoszam@demo.kezjegy.test', { firstName: 'Ödön' });
    const c = await newClient(h, 'adoszam.acc@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId, adoszamPending: true }).where(eq(clients.id, c.clientId));
    const bad = await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: bence.token, body: { adoszam: '68801230-1-41' } });
    expect(bad.status).toBe(400);
    const t = `6880123${taxNumberCheckDigit('6880123')}`;
    const ok = await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: bence.token, body: { adoszam: `${t}-2-41` } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ adoszam: `${t}-2-41`, afaMentes: false, adoszamPending: false }); // the §28.K.9 route (acc-k28.ts)
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl).toMatchObject({ adoszam: `${t}-2-41`, adoszamPending: false });
    expect((await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: other.token, body: { adoszam: `${t}-1-41` } })).status).toBe(404);
  });
});

export { payments };
