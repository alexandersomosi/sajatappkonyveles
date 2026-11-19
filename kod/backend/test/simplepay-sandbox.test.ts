// SimplePay sandbox mode against a fake SimplePay that checks our request signatures and signs
// its answers: start (recurring registration) → IPN → active → dorecurring (MIT) → IPN → renewed,
// cardcancel, and a forged response signature is rejected.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, paymentTokens, simplepayTransactions } from '../src/db/schema.js';
import { spSign, spVerify } from '../src/payments/simplepay.js';
import { runBillingJob } from '../src/services/subscription.js';
import { newClient, PW, setup, type Harness } from './helpers.js';
import { acceptContract } from './helpers.js';

const MERCHANT = 'PUBLICTESTHUF';
const SECRET = 'FxDa5w314kLlNseq2sKuVwaqZshZT5d6';
const calls: { path: string; body: Record<string, unknown> }[] = [];
let forge = false;

const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  const raw = String(init?.body ?? '');
  const sig = new Headers(init?.headers).get('signature');
  if (!spVerify(SECRET, raw, sig)) return new Response('{"errorCodes":["5321"]}', { status: 400 });
  const body = JSON.parse(raw) as Record<string, unknown>;
  const path = url.split('/payment/v2/')[1]!;
  calls.push({ path, body });
  let out: Record<string, unknown>;
  if (path === 'start') {
    out = { salt: body.salt, merchant: MERCHANT, orderRef: body.orderRef, currency: 'HUF', transactionId: 501234567, timeout: body.timeout, total: body.total, paymentUrl: 'https://sandbox.simplepay.hu/pay/pay/pspHU/abc', tokens: Array.from({ length: 12 }, (_, i) => `SPTOKEN${i}`) };
  } else if (path === 'dorecurring') {
    out = { salt: body.salt, merchant: MERCHANT, orderRef: body.orderRef, currency: 'HUF', transactionId: 501239999, total: body.total };
  } else if (path === 'cardcancel') {
    out = { salt: body.salt, merchant: MERCHANT, cardId: body.cardId, status: 'DISABLED' };
  } else out = { errorCodes: ['9999'] };
  const text = JSON.stringify(out);
  return new Response(text, { status: 200, headers: { 'content-type': 'application/json', signature: forge ? 'hamis' : spSign(SECRET, text) } });
};

let h: Harness;
beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z', env: { SIMPLEPAY_MODE: 'sandbox', SIMPLEPAY_MERCHANT_HUF: MERCHANT, SIMPLEPAY_SECRET_HUF: SECRET }, overrides: { fetch: fakeFetch } });
});
afterAll(async () => h.close());

async function ipn(orderRef: string, transactionId: number, extra: Record<string, unknown> = {}) {
  const body = JSON.stringify({ salt: 'x1', orderRef, method: 'CARD', merchant: MERCHANT, finishDate: '2026-11-17T09:01:00+00:00', paymentDate: '2026-11-17T09:00:30+00:00', transactionId, status: 'FINISHED', ...extra });
  const r = await h.req('POST', '/webhooks/simplepay/ipn', { raw: body, headers: { 'content-type': 'application/json', signature: spSign(SECRET, body) } });
  expect(r.status).toBe(200);
  expect(spVerify(SECRET, await r.text(), r.headers.get('signature'))).toBe(true);
}

describe('SimplePay sandbox flow', () => {
  it('registration, IPN, monthly dorecurring with MIT, card cancel', async () => {
    const c = await newClient(h, 'sandbox@demo.kezjegy.test', { first: 'Kata' });
    await h.json('PUT', '/client/profile', {
      token: c.token,
      body: { firstName: 'Kata', lastName: 'Szabó', adoazonositoJel: '8417104569', adoszam: '68801234-1-41', address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' }, hqMunicipality: 'Budapest', activityText: 'Grafika', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2019-04-01', hasSeparateBusinessAccount: true },
    });
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const start = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'app', acceptedDeclarations: true } });
    expect(start.status).toBe(200);
    expect(start.body.paymentUrl).toBe('https://sandbox.simplepay.hu/pay/pay/pspHU/abc');
    const s0 = calls.find((x) => x.path === 'start')!.body;
    expect(s0).toMatchObject({ merchant: MERCHANT, currency: 'HUF', total: 19999, methods: ['CARD'], language: 'HU', threeDSReqAuthMethod: '02', sdkVersion: 'Kezjegy_Node_1.0' });
    expect(s0.recurring).toMatchObject({ times: 12, maxAmount: 19999 });
    expect(String(s0.url)).toBe('https://api.45-94-65-74.sslip.io/api/v1/payments/simplepay/back?p=app');
    expect(s0.invoice).toMatchObject({ name: 'Szabó Kata', country: 'HU', city: 'Budapest', zip: '1136' });
    const toks = await h.deps.db.select().from(paymentTokens);
    expect(toks).toHaveLength(12);
    expect(toks.every((t) => !t.tokenEnc.includes('SPTOKEN'))).toBe(true); // encrypted at rest

    await ipn(start.body.orderRef, 501234567, { cardMask: 'xxxx-xxxx-xxxx-1234', expiry: '2029-05-31T00:00:00+02:00' });
    const sub = await h.json('GET', '/client/subscription', { token: c.token });
    expect(sub.body).toMatchObject({ status: 'active', mode: 'sandbox', card: { mask: 'xxxx-xxxx-xxxx-1234', tokensLeft: 12 } });

    h.clock.set('2026-12-17T08:10:00Z');
    const res = await runBillingJob(h.deps);
    expect(res.pending).toBe(1);
    const dr = calls.find((x) => x.path === 'dorecurring')!.body;
    expect(dr).toMatchObject({ token: 'SPTOKEN0', type: 'MIT', total: 19999, customerEmail: 'sandbox@demo.kezjegy.test' });
    const [tx] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, String(dr.orderRef)));
    expect(tx!.status).toBe('INPAYMENT');
    await ipn(String(dr.orderRef), 501239999);
    const login = await h.json('POST', '/auth/login', { body: { email: 'sandbox@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.8.8.8' } });
    const sub2 = await h.json('GET', '/client/subscription', { token: login.body.accessToken });
    expect(sub2.body).toMatchObject({ currentPeriodEnd: '2027-01-17', card: { tokensLeft: 11 } });

    const del = await h.json('POST', '/client/subscription/card/delete', { token: login.body.accessToken });
    expect(del.status).toBe(200);
    expect(calls.find((x) => x.path === 'cardcancel')!.body).toMatchObject({ cardId: 501234567 });
  });

  it('a response with a wrong signature is never trusted', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await newClient(h, 'hamis@demo.kezjegy.test');
    await h.json('PUT', '/client/profile', {
      token: c.token,
      body: { firstName: 'Hamis', lastName: 'Teszt', adoazonositoJel: '8417104569', adoszam: '68801234-1-41', address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' }, hqMunicipality: 'Budapest', activityText: 'x', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2019-04-01', hasSeparateBusinessAccount: true },
    });
    await acceptContract(h, c.token);
    forge = true;
    try {
      const r = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
      expect(r.status).toBe(502);
    } finally {
      forge = false;
    }
  });
});
