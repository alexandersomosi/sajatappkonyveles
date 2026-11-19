// Integrator k6 (2026-11-19): the panel contract additions of the §28 builder notes (panel/README.md) that the backend
// builder could not see while working in parallel – the client's notification log, the admin fee-charge list, the
// accountant filling a missing adószám (§28.K.9), and the check-in queue filters ('nyitott' / 'mind') + the service
// team's read access to that one /acc route.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, feeCharges, navInvoices, notifications } from '../src/db/schema.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let mate: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
let c: Awaited<ReturnType<typeof newClient>>;

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.k6@demo.kezjegy.test', { firstName: 'Bence' });
  mate = await staff(h, 'accountant', 'mate.k6@demo.kezjegy.test', { firstName: 'Máté' });
  anna = await staff(h, 'csapat', 'anna.k6@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin.k6@demo.kezjegy.test');
  c = await newClient(h, 'naplo.k6@demo.kezjegy.test', { active: true, first: 'Eszter', last: 'Szabó' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
});
afterAll(async () => h?.close());

describe('GET /acc/clients/:id/notifications (notification log)', () => {
  beforeAll(async () => {
    await h.deps.db.insert(notifications).values([
      { userId: c.userId, kind: 'invoice_new', title: 'Új kiállított számlád: 120 000 Ft', body: 'Bodza Kiadó Kft. Tegyél félre kb. 31 000 Ft-ot.', link: '/felretesz', data: { variant: 'kuszob', pushNotBefore: '2026-11-19T19:00:00.000Z' }, wantPush: true, wantEmail: false, createdAt: new Date('2026-11-19T08:00:00Z') },
      { userId: c.userId, kind: 'invoice_new', title: 'Új kiállított számlád érkezett', body: 'Magánszemély.', link: '/felretesz', data: { variant: 'rejtett' }, wantPush: true, pushSentAt: new Date('2026-11-18T08:00:00Z'), wantEmail: true, emailSentAt: new Date('2026-11-18T08:00:00Z'), createdAt: new Date('2026-11-18T08:00:00Z') },
    ]);
    const base = { clientId: c.clientId, category: 'NORMAL', currency: 'HUF', netHuf: 50_000, vatHuf: 0, grossHuf: 50_000, dossierMonth: '2026-11' } as const;
    await h.deps.db.insert(navInvoices).values([
      { ...base, invoiceNumber: 'K6-1', operation: 'CREATE', issueDate: '2026-11-10', notifyState: 'kihagyva_elso_szinkron' },
      { ...base, invoiceNumber: 'K6-2', operation: 'CREATE', issueDate: '2026-11-11', notifyState: 'kuldve' },
      { ...base, invoiceNumber: 'K6-3', operation: 'MODIFY', issueDate: '2026-11-12', notifyState: 'kihagyva_modositas' },
    ]);
  });
  it('the own accountant sees the rows, the push state and the skipped invoices; no address or token', async () => {
    const r = await h.json('GET', `/acc/clients/${c.clientId}/notifications`, { token: bence.token });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(2);
    const [waiting, sent] = r.body.items;
    expect(waiting.variant).toBe('kuszob');
    expect(waiting.push).toMatchObject({ wanted: true, sentAt: null, notBefore: '2026-11-19T19:00:00.000Z', skipped: 'csendes_ido', amountsShown: true });
    expect(waiting.email).toBeNull();
    expect(sent.push).toMatchObject({ skipped: 'nincs_eszkoz', amountsShown: false });
    expect(sent.email.sentAt).toBe('2026-11-18T08:00:00.000Z');
    expect(r.body.settings).toMatchObject({ quietEnabled: true });
    expect(r.body.skippedInvoices.map((x: { invoiceNumber: string; state: string }) => `${x.invoiceNumber}:${x.state}`).sort()).toEqual(['K6-1:kihagyva_elso_szinkron', 'K6-3:kihagyva_modositas']);
    expect(JSON.stringify(r.body)).not.toContain('naplo.k6@');
    expect(r.body.nextCursor).toBeNull();
  });
  it("another accountant gets 404, csapat 404, admin 200", async () => {
    expect((await h.json('GET', `/acc/clients/${c.clientId}/notifications`, { token: mate.token })).status).toBe(404);
    expect((await h.json('GET', `/acc/clients/${c.clientId}/notifications`, { token: anna.token })).status).toBe(404);
    expect((await h.json('GET', `/acc/clients/${c.clientId}/notifications`, { token: admin.token })).status).toBe(200);
  });
});

describe('POST /acc/clients/:id/adoszam (§28.K.9 "Most nem tudom")', () => {
  it('wrong format → 400; a pending client gets it set; a second set → 409', async () => {
    await h.deps.db.update(clients).set({ adoszamPending: true, adoszam: null }).where(eq(clients.id, c.clientId));
    expect((await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: bence.token, body: { adoszam: '123' } })).status).toBe(400);
    const ok = await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: bence.token, body: { adoszam: '12345676-1-42' } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ adoszam: '12345676-1-42', adoszamPending: false });
    const [row] = await h.deps.db.select({ a: clients.adoszam, p: clients.adoszamPending }).from(clients).where(eq(clients.id, c.clientId));
    expect(row).toEqual({ a: '12345676-1-42', p: false });
    expect((await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: bence.token, body: { adoszam: '12345676-1-42' } })).status).toBe(409);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/adoszam`, { token: mate.token, body: { adoszam: '12345676-1-42' } })).status).toBe(404);
  });
});

describe('GET /admin/fee-charges', () => {
  it('admin lists the charges with the client name, filtered by status; an accountant is refused', async () => {
    await h.deps.db.insert(feeCharges).values([
      { clientId: c.clientId, kind: 'valtozas_egyszeru', amountHuf: 4_999, purpose: { type: 'valtozas', assistId: '00000000-0000-4000-8000-000000000001' }, status: 'nyitott', demo: true },
      { clientId: c.clientId, kind: 'valtozas_egyszeru', amountHuf: 4_999, purpose: { type: 'valtozas', assistId: '00000000-0000-4000-8000-000000000002' }, status: 'visszaterites_kell', demo: true },
    ]);
    const all = await h.json('GET', '/admin/fee-charges', { token: admin.token });
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(2);
    expect(all.body.items[0].client).toEqual({ id: c.clientId, name: expect.stringContaining('Eszter') });
    const ref = await h.json('GET', '/admin/fee-charges?status=visszaterites_kell', { token: admin.token });
    expect(ref.body.items).toHaveLength(1);
    expect((await h.json('GET', '/admin/fee-charges', { token: bence.token })).status).toBeGreaterThanOrEqual(403);
  });
});

describe('GET /acc/checkin-items filters and csapat access', () => {
  it("'nyitott' and 'mind' are accepted; csapat may read the queue but no other /acc route", async () => {
    for (const s of ['nyitott', 'mind', 'kesz']) {
      const r = await h.json('GET', `/acc/checkin-items?status=${s}`, { token: bence.token });
      expect(r.status, s).toBe(200);
      expect(Array.isArray(r.body.items)).toBe(true);
    }
    expect((await h.json('GET', '/acc/checkin-items?status=valami', { token: bence.token })).status).toBe(400);
    expect((await h.json('GET', '/acc/checkin-items?status=mind', { token: anna.token })).status).toBe(200);
    expect((await h.json('GET', '/acc/clients', { token: anna.token })).status).toBe(404);
    expect((await h.json('POST', '/acc/checkin-items/00000000-0000-4000-8000-000000000001', { token: anna.token, body: { status: 'kesz' } })).status).toBe(404);
  });
});
