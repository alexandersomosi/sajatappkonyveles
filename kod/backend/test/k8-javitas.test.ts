// k8 integrator – the fixes of the k8 review (HELYESSÉG F1–F6, A3, A10, FIZETÉSI ÚT 4):
//  F1 a 'switch' without a running subscription passes the same gates as 'subscribe' (step lock, open callback);
//  F2 a transfer subscription is never charged by card ("Fizesd ki", admin retry), the card paying a month withdraws
//     the open monthly díjbekérő, a bank transfer is never "refunded" by a provider;
//  F3 a cancellation withdraws the díjbekérő of a month the client does not get (no reminder afterwards);
//  F4 a díjbekérő whose document failed is shown as "készül" and tried again on the next tap;
//  F6 the app lock text knows the reason 'atutalas_kesik';
//  A3 the brand link never goes inside another link; A10 only a monthly díjbekérő locks;
//  4  the unlock without a payment never says "Köszönjük a fizetést".
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, payments, plans, subscriptions, transferRequests } from '../src/db/schema.js';
import { levelFromText, renderLevel } from '../src/notify/sablon.js';
import { jobTransferIssue, jobTransferReminders } from '../src/services/atutalas.js';
import { runBillingJob } from '../src/services/subscription.js';
import { computeServiceLock } from '../src/services/zarolas.js';
import { LOCK_TEXTS } from '../src/_shared/bekotes.js';
import { acceptContract, newClient, setup, staff, type Harness, type Mail } from './helpers.js';

const profile = {
  firstName: 'Zoé',
  lastName: 'Kiss',
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

describe('k8 review fixes', () => {
  let h: Harness;
  let admin: { token: string; userId: string };
  beforeAll(async () => {
    h = await setup({ now: '2026-11-20T09:00:00Z' });
    await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
    const a = await staff(h, 'admin', 'admin.javitas@demo.kezjegy.test');
    admin = { token: a.token, userId: a.userId };
  });
  afterAll(async () => h.close());

  it('F1: switch without a subscription = subscribe (step lock), and an open callback waits both', async () => {
    const c = await newClient(h, 'kapu.javitas@demo.kezjegy.test');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    const sub = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } });
    const sw = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'switch' } });
    expect(sub.status).toBe(409);
    expect(sw.status).toBe(409);
    expect(sw.body.error.code).toBe(sub.body.error.code);
    expect(await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c.clientId))).toHaveLength(0);

    const c2 = await newClient(h, 'cb.javitas@demo.kezjegy.test');
    expect((await h.json('PUT', '/client/profile', { token: c2.token, body: profile })).status).toBe(200);
    await acceptContract(h, c2.token);
    expect((await h.json('POST', '/client/callbacks', { token: c2.token, body: { phone: '+36301234567', topic: 'elofizetes', source: 'bekotes' } })).status).toBe(201);
    const s2 = await h.json('POST', '/client/billing/transfer', { token: c2.token, body: { purpose: 'subscribe' } });
    const w2 = await h.json('POST', '/client/billing/transfer', { token: c2.token, body: { purpose: 'switch' } });
    expect(s2.status).toBe(409);
    expect(w2.status).toBe(409);
    expect(await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c2.clientId))).toHaveLength(0);
  });

  it('F2: suspended card → switch: the díjbekérő, but no "Fizesd ki", no card payment, no admin retry', async () => {
    const c = await newClient(h, 'susp.javitas@demo.kezjegy.test');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await acceptContract(h, c.token);
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'suspended', mode: 'demo', provider: 'demo', billingMethod: 'kartya', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01' });
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const w = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'switch' } });
    expect(w.status).toBe(200);
    expect(w.body.open.map((o: { kind: string; status: string }) => `${o.kind}/${o.status}`)).toEqual(['havi/kiallitva']);
    const due = await h.json('GET', '/client/payments/due', { token: c.token });
    expect(due.body ?? null).toBeNull();
    const pay = await h.json('POST', '/client/payments/due/pay', { token: c.token, body: { platform: 'web' } });
    expect(pay.status).toBe(409);
    const [s] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    const retry = await h.json('POST', `/admin/subscriptions/${s!.id}/retry`, { token: admin.token });
    expect(retry.status).toBe(409);
    expect(await h.deps.db.select().from(payments).where(eq(payments.clientId, c.clientId))).toHaveLength(0);
  });

  it('F3: cancel during an open monthly díjbekérő → withdrawn at once, no reminder later', async () => {
    const c = await newClient(h, 'lemond.javitas@demo.kezjegy.test');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await acceptContract(h, c.token);
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', mode: 'demo', provider: 'demo', billingMethod: 'atutalas', currentPeriodStart: '2026-10-20', currentPeriodEnd: '2026-11-20', nextChargeAt: null });
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    await jobTransferIssue(h.deps);
    expect((await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c.clientId))).map((r) => r.status)).toEqual(['kiallitva']);
    const cancel = await h.json('POST', '/client/subscription/cancel', { token: c.token, body: {} });
    expect(cancel.status).toBeLessThan(300);
    expect((await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c.clientId))).map((r) => r.status)).toEqual(['visszavonva']);
    h.clock.set('2026-11-21T06:00:00Z');
    await runBillingJob(h.deps);
    h.clock.set('2026-12-02T09:00:00Z');
    await jobTransferReminders(h.deps);
    expect(h.mails.filter((m: Mail) => m.to === 'lemond.javitas@demo.kezjegy.test' && m.template === 'transfer_reminder')).toHaveLength(0);
    h.clock.set('2026-11-20T09:00:00Z');
  });

  it('F4: a díjbekérő whose document failed is "preparing" and the next tap tries again', async () => {
    const c = await newClient(h, 'hiba.javitas@demo.kezjegy.test');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await acceptContract(h, c.token);
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'suspended', mode: 'demo', provider: 'demo', billingMethod: 'atutalas', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01' });
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const first = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'switch' } });
    expect(first.status).toBe(200);
    // as if the Számlázz.hu call had timed out
    await h.deps.db.update(transferRequests).set({ status: 'hiba', proformaNumber: null, lastErrorCode: 'timeout' }).where(eq(transferRequests.clientId, c.clientId));
    const view = await h.json('GET', '/client/billing', { token: c.token });
    expect(view.body.preparing).toBe(true);
    expect(view.body.open).toHaveLength(0);
    const again = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'switch' } });
    expect(again.status).toBe(200);
    expect(again.body.preparing).toBe(false);
    expect(again.body.open.map((o: { status: string }) => o.status)).toEqual(['kiallitva']);
  });

  it('F6 + unlock: the lock text knows atutalas_kesik; switching the late lock OFF never thanks for a payment', async () => {
    expect(LOCK_TEXTS.mit.atutalas_kesik).toBe('havidíj');
    const c = await newClient(h, 'zar.javitas@demo.kezjegy.test');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await acceptContract(h, c.token);
    const [s] = await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', mode: 'demo', provider: 'demo', billingMethod: 'atutalas', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01', nextChargeAt: null }).returning();
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    await h.deps.db.insert(transferRequests).values({ clientId: c.clientId, subscriptionId: s!.id, kind: 'havi', periodStart: '2026-11-01', periodEnd: '2026-12-01', amountHuf: 19_999, orderNo: 'ADZ-JAV-2026-11', kozlemeny: 'ADZ-JAV-2026-11', issuedOn: '2026-11-01', dueOn: '2026-11-09', status: 'kesik', mode: 'demo', proformaNumber: 'DEMO-D-JAV' });
    // an unpaid FIRST-month díjbekérő never locks (A10)
    await h.deps.db.insert(transferRequests).values({ clientId: c.clientId, subscriptionId: s!.id, kind: 'elso_havi', amountHuf: 19_999, orderNo: 'ADZ-JAV-ELSO', kozlemeny: 'ADZ-JAV-ELSO', issuedOn: '2026-11-01', dueOn: '2026-11-09', status: 'kesik', mode: 'demo', proformaNumber: 'DEMO-D-JAV2' });
    const { systemState } = await import('../src/db/schema.js');
    await h.deps.db.insert(systemState).values({ key: 'kapcsolok.fizetes', value: { kesesLeallit: true } }).onConflictDoUpdate({ target: systemState.key, set: { value: { kesesLeallit: true } } });
    const lock = await computeServiceLock(h.deps, c.clientId);
    expect(lock?.reasons).toEqual(['atutalas_kesik']);
    expect(lock?.amountHuf).toBe(19_999);
    await h.deps.db.update(systemState).set({ value: { kesesLeallit: false } }).where(eq(systemState.key, 'kapcsolok.fizetes'));
    expect(await computeServiceLock(h.deps, c.clientId)).toBeNull();
    const { notifications } = await import('../src/db/schema.js');
    const rows = await h.deps.db.select().from(notifications).where(eq(notifications.kind, 'service_unlocked'));
    const mine = rows.filter((n) => n.userId === c.userId);
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(mine[0])).not.toContain('Köszönjük a fizetést');
  });

  it('A3: "Adózz.hu" inside an URL stays one link (no link in a href)', () => {
    const html = renderLevel(levelFromText('Teszt', 'Szia!\n\nNézd meg: https://pelda.hu/Adózz.hu/x\n\nKöszönjük, Adózz.hu', { lablec: 'ugyfel' }));
    expect(html).not.toMatch(/href="[^"]*<a /);
    expect(html).toContain('href="https://pelda.hu/Adózz.hu/x"');
    expect(html).toMatch(/<a href="https:\/\/adozz\.hu"[^>]*>Adózz\.hu<\/a>/);
  });
});
