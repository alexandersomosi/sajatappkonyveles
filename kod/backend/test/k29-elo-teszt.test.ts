// SPEC §29.18 – REAL test-mode runs against Stripe TEST and the Számlázz.hu Tesztüzem account. Skipped unless K29_ELO=1.
// The keys come ONLY from the process environment (filled in-process from the Windows user env by the runner, never
// echoed); this file never prints or writes a key. Only ids, statuses and invoice numbers are recorded
// (K29_ELO_OUT, default _munka/k7/b1_eles_teszt.json). Fake buyer, sendEmail=false: no e-mail reaches anyone.
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../src/_shared/k29.js';
import { createStripeProvider } from '../src/payments/stripe.js';
import { buildInvoiceXml, buildQueryXml, buildStornoXml, createSzamlazzClient } from '../src/payments/szamlazzhu.js';
import { invoiceKeyFor } from '../src/payments/invoices.js';
import { todayBudapest } from '../src/lib/dates.js';

const RUN = process.env.K29_ELO === '1';
const OUT = process.env.K29_ELO_OUT ?? join(__dirname, '..', '..', '..', '_munka', 'k7', 'b1_eles_teszt.json');
const record: Record<string, unknown> = { at: new Date().toISOString(), stripeApiVersion: STRIPE_API_VERSION };
const save = () => {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(record, null, 2)}\n`);
};

describe.skipIf(!RUN || !process.env.STRIPE_TEST_SECRET_KEY)('Stripe TEST mode (real API, test cards)', () => {
  const sk = process.env.STRIPE_TEST_SECRET_KEY ?? '';
  const pk = process.env.STRIPE_TEST_PUBLISHABLE_KEY ?? '';
  const cfg = { mode: 'test' as const, secretKey: sk, publishableKey: pk, webhookSecret: '', suffixHavi: 'HAVIDIJ', locale: 'hu' };
  const prov = createStripeProvider({ cfg });
  const stripe = new Stripe(sk, { apiVersion: STRIPE_API_VERSION as Stripe.StripeConfig['apiVersion'] });
  const clientId = randomUUID();
  let customer = '';

  it('only a TEST key is ever used here', () => {
    expect(sk).toMatch(/^(sk|rk)_test_/);
    expect(pk).toMatch(/^pk_test_/);
  });

  it('customer + hosted Checkout (payment with setup_future_usage, and setup mode) are accepted with our params, then expired', async () => {
    customer = await prov.ensureCustomer({ clientId, email: `adozz-teszt+${clientId.slice(0, 8)}@example.com`, name: 'Teszt Elek' });
    expect(customer).toMatch(/^cus_/);
    const pid = randomUUID();
    const h = await prov.startHosted({
      mode: 'payment',
      paymentId: pid,
      clientId,
      customerRef: customer,
      amountHuf: 19_999,
      saveCard: true,
      productName: 'Adózz havidíj (2026.11.20.–2026.12.19.)',
      description: 'Adózz havidíj',
      statementSuffix: 'HAVIDIJ',
      submitMessage: 'Havi 19 999 Ft-os előfizetés az Adózznál. Minden levonás előtt 3 nappal szólunk. Bármikor lemondhatod az appban.',
      successUrl: 'https://api.45-94-65-74.sslip.io/api/v1/payments/stripe/vissza?p=web&o=s&cel=elofizetes&pid=x&cs={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://api.45-94-65-74.sslip.io/api/v1/payments/stripe/vissza?p=web&o=s&cel=elofizetes&pid=x&megszakitva=1',
      platform: 'web',
      expiresAt: new Date(Date.now() + 31 * 60_000),
      idempotencyKey: `checkout:${pid}`,
      metadata: { payment_id: pid, client_id: clientId, kind: 'elso_havi', period_start: '2026-11-20' },
    });
    expect(h.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const st1 = await prov.retrieveHosted(h.providerRef);
    expect(st1).toMatchObject({ mode: 'payment', status: 'open', paid: false });
    await prov.expireHosted(h.providerRef);
    expect((await prov.retrieveHosted(h.providerRef)).status).toBe('expired');
    const sid = randomUUID();
    const s = await prov.startHosted({ mode: 'setup', paymentId: sid, clientId, customerRef: customer, amountHuf: 0, saveCard: true, productName: 'Adózz havidíj', description: 'Adózz havidíj', statementSuffix: 'HAVIDIJ', submitMessage: null, successUrl: 'https://api.45-94-65-74.sslip.io/api/v1/payments/stripe/vissza?cs={CHECKOUT_SESSION_ID}', cancelUrl: 'https://api.45-94-65-74.sslip.io/api/v1/payments/stripe/vissza?megszakitva=1', platform: 'app', expiresAt: new Date(Date.now() + 31 * 60_000), idempotencyKey: `checkout:${sid}`, metadata: { payment_id: sid, client_id: clientId, kind: 'kartya' } });
    expect((await prov.retrieveHosted(s.providerRef)).mode).toBe('setup');
    await prov.expireHosted(s.providerRef);
    record.stripe = { customer, checkoutPayment: h.providerRef, checkoutSetup: s.providerRef };
    save();
  });

  it('off-session charges with the five test cards (attached test payment methods)', async () => {
    const cards: [string, string][] = [
      ['4242 4242 4242 4242', 'pm_card_visa'],
      ['4000 0025 0000 3155', 'pm_card_authenticationRequiredOnSetup'],
      ['4000 0027 6000 3184', 'pm_card_authenticationRequired'],
      ['4000 0000 0000 0341', 'pm_card_chargeCustomerFail'],
      ['4000 0000 0000 9995', 'pm_card_visa_chargeDeclinedInsufficientFunds'],
    ];
    const results: Record<string, unknown>[] = [];
    for (const [card, token] of cards) {
      let pm: Stripe.PaymentMethod;
      try {
        pm = await stripe.paymentMethods.attach(token, { customer });
      } catch (e) {
        // e.g. 9995: the bank refuses already when the card is saved (in our flow: on the Checkout page, the client stays there)
        const se = e as { type?: string; code?: string; decline_code?: string };
        results.push({ card, attach: 'refused', code: se.code ?? se.type ?? 'error', declineCode: se.decline_code ?? null });
        continue;
      }
      const paymentId = randomUUID();
      const key = `havidij:teszt:${paymentId}`;
      const base = { paymentId, customerRef: customer, paymentMethodRef: pm.id, amountHuf: 19_999, offSession: true, description: 'Adózz havidíj 2026.12.', statementSuffix: 'HAVIDIJ', idempotencyKey: key, metadata: { payment_id: paymentId, client_id: clientId, kind: 'havi', period_start: '2026-12-20' } };
      const out = await prov.chargeSaved(base);
      const again = await prov.chargeSaved(base); // the same key → Stripe returns the same result
      expect(again.kind).toBe(out.kind);
      results.push({ card, paymentMethod: pm.id, outcome: out.kind, providerRef: 'providerRef' in out ? out.providerRef : null, code: 'code' in out ? out.code : null, declineCode: 'declineCode' in out ? (out.declineCode ?? null) : null, idempotentRepeat: again.kind });
      if (card.startsWith('4242')) {
        expect(out.kind).toBe('succeeded');
        const ref = (out as { providerRef: string }).providerRef;
        const st = await prov.retrievePayment(ref);
        expect(st).toMatchObject({ status: 'succeeded', amountHuf: 19_999 });
        expect(st.card).toMatchObject({ brand: 'visa', last4: '4242' });
        const r = await prov.refund({ providerRef: ref, amountHuf: 5_000, idempotencyKey: `refund:${paymentId}:1`, reason: 'teszt', metadata: { payment_id: paymentId } });
        expect(['succeeded', 'pending']).toContain(r.status);
        const after = await prov.retrievePayment(ref);
        results[results.length - 1]!.refund = { id: r.refundRef, status: r.status, refundedHuf: after.refundedHuf };
      }
      if (out.kind === 'requires_auth' && out.providerRef) {
        await prov.cancelPending(out.providerRef);
        results[results.length - 1]!.afterCancel = (await prov.retrievePayment(out.providerRef)).status;
      }
      await prov.detachCard(pm.id);
    }
    record.stripeCards = results;
    save();
    const by = (c: string) => results.find((r) => String(r.card).startsWith(c))!;
    expect(by('4000 0027 6000 3184').outcome).toBe('requires_auth');
    expect(by('4000 0000 0000 0341').outcome).toBe('declined');
    expect(by('4000 0000 0000 9995')).toMatchObject({ declineCode: 'insufficient_funds' });
  });
});

describe.skipIf(!RUN || !process.env.SZAMLAZZHU_TEST_AGENT_KEY)('Számlázz.hu Tesztüzem (real Agent, test account)', () => {
  const agentKey = process.env.SZAMLAZZHU_TEST_AGENT_KEY ?? '';
  const client = createSzamlazzClient({ url: 'https://www.szamlazz.hu/szamla/' });
  it('one e-invoice (19 999 Ft gross, 27 %, paid by card): query first → issue → query finds it → storno', async () => {
    const today = todayBudapest(new Date());
    const key = invoiceKeyFor(randomUUID());
    expect(await client.query(buildQueryXml(agentKey, key))).toBeNull();
    const buyer = { name: 'Teszt Elek', zip: '1136', city: 'Budapest', address: 'Példa utca 7.', adoszam: null, email: 'teszt@example.com' };
    const r = await client.issue(
      buildInvoiceXml(agentKey, {
        key,
        issueDate: today,
        paymentDate: today,
        buyer,
        line: { megnevezes: 'Könyvelési szolgáltatás – havidíj (TESZT)', unit: 'hó', grossHuf: 19_999 },
        replyTo: null,
        emailTargy: 'Adózz – számla (teszt)',
        emailSzoveg: 'Teszt számla.',
        megjegyzes: `Bankkártyával fizetve. Azonosító: ${key}`,
        sendEmail: false,
      }),
    );
    expect(r.number).toBeTruthy();
    expect(r.pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const q = await client.query(buildQueryXml(agentKey, key));
    expect(q?.number).toBe(r.number);
    const st = await client.storno(buildStornoXml(agentKey, { key: `${key}S`, originalNumber: r.number, date: today, megjegyzes: 'Visszatérítés: teszt', email: null, replyTo: null, emailTargy: 'Adózz – sztornó (teszt)', emailSzoveg: 'Teszt sztornó.' }));
    expect(st.number).toBeTruthy();
    record.szamlazzhu = { key, number: r.number, grossFromHeader: r.grossHuf, pdfBytes: r.pdf.length, queryFound: q?.number ?? null, storno: st.number, stornoPdfBytes: st.pdf.length };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(join(dirname(OUT), 'b1_teszt_szamla.pdf'), r.pdf);
    writeFileSync(join(dirname(OUT), 'b1_teszt_sztorno.pdf'), st.pdf);
    save();
  });
});
