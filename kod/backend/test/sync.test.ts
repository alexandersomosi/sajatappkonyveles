// NAV sync with the demo transport → nav_invoices + revenue items → the estimate equals SPEC §7.6 C.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fixtures from '../src/_shared/demo/fixtures.json' with { type: 'json' };
import { navCredentials, revenueItems } from '../src/db/schema.js';
import { demoCredentialsFor } from '../src/nav/types.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let acc: { token: string; accountantId: string | null };
beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z' });
  acc = await staff(h, 'accountant', 'bence@demo.kezjegy.test');
});
afterAll(async () => h.close());

type Key = 'kata' | 'reka' | 'peter';

async function onboardClient(key: Key, o: { ratio: 45 | 80; status: 'fofoglalkozasu' | 'mellekallasu'; guaranteed?: boolean }) {
  const c = await newClient(h, `${key}@demo.kezjegy.test`, { first: key, active: true });
  const ids = fixtures.taxIds[key];
  const prof = await h.json('PUT', '/client/profile', {
    token: c.token,
    body: {
      firstName: key,
      lastName: 'Demo',
      adoazonositoJel: ids.adoazonositoJel,
      adoszam: ids.adoszam,
      address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
      hqMunicipality: 'Budapest',
      activityText: 'kitalált tevékenység',
      activityAnswer: o.ratio === 80 ? 'lista80' : 'egyeb',
      taxStatus: o.status,
      evSince: '2019-04-01',
      hasSeparateBusinessAccount: true,
    },
  });
  expect(prof.status).toBe(200);
  expect(prof.body.adoazonositoJelMasked).toMatch(/^•+\d{3}$/);
  const tp = await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: acc.token, body: { year: 2026, costRatio: o.ratio, status: o.status, guaranteedMinimum: Boolean(o.guaranteed), hipa: { method: 'savos', ratePct: 2 } } });
  expect(tp.status).toBe(200);
  const taxNumber = ids.adoszam.slice(0, 8);
  const save = await h.json('PUT', `/acc/clients/${c.clientId}/nav-credentials`, { token: acc.token, body: { ...demoCredentialsFor(taxNumber), environment: 'demo' } });
  expect(save.status).toBe(200);
  // credentials are stored encrypted with NAV_CRED_KEY, never returned
  const [row] = await h.deps.db.select().from(navCredentials).where(eq(navCredentials.clientId, c.clientId));
  expect(row!.secretEnc).not.toContain(demoCredentialsFor(taxNumber).password);
  const test = await h.json('POST', `/acc/clients/${c.clientId}/nav-credentials/test`, { token: acc.token });
  expect(test.body.ok).toBe(true);
  const sync = await h.json('POST', `/acc/clients/${c.clientId}/nav-sync`, { token: acc.token });
  expect(sync.status).toBe(200);
  expect(sync.body.status).toBe('ok');
  return { ...c, sync: sync.body };
}

async function addManual(clientId: string, key: Key) {
  for (const m of fixtures.manualRevenue[key]) {
    const r = await h.json('POST', `/acc/clients/${clientId}/revenue-items`, { token: acc.token, body: { receivedOn: m.receivedOn, amountHuf: m.amountHuf, description: m.description } });
    expect(r.status).toBe(201);
  }
}

async function quarterTotals(clientId: string) {
  const r = await h.json('GET', `/acc/clients/${clientId}/tax-periods?year=2026`, { token: acc.token });
  expect(r.status).toBe(200);
  const out: Record<string, { total: number; tb: number; szocho: number; szja: number }> = {};
  for (const p of r.body.items) {
    if (p.kind !== 'negyedev' || !p.latestCalculation) continue;
    const q = p.latestCalculation.result;
    out[p.periodKey] = { total: q.totalHuf, tb: q.tbHuf, szocho: q.szochoHuf, szja: q.szjaAdvanceHuf };
  }
  return out;
}

describe('Szabó Kata (45 %, főfoglalkozású, minimálbér)', () => {
  let c: Awaited<ReturnType<typeof onboardClient>>;
  it('syncs the 32 invoices issued up to 2026-11-17 and creates revenue items', async () => {
    c = await onboardClient('kata', { ratio: 45, status: 'fofoglalkozasu' });
    expect(c.sync.invoicesNew).toBe(32);
    const items = await h.deps.db.select().from(revenueItems).where(and(eq(revenueItems.clientId, c.clientId), eq(revenueItems.source, 'nav_szamla')));
    expect(items).toHaveLength(32);
    expect(items.every((i) => i.receivedOnEstimated)).toBe(true); // TRANSFER → payment date, estimated
    await addManual(c.clientId, 'kata');
  });
  it('estimates equal SPEC §7.6 C', async () => {
    const t = await quarterTotals(c.clientId);
    const exp = fixtures.expectedTax2026.kata;
    for (const q of exp) expect(t[`2026-Q${q.q}`]).toEqual({ total: q.total, tb: q.tb, szocho: q.szocho, szja: q.szjaAdvance });
    expect(t['2026-Q3']!.total).toBe(510_471);
    expect(t['2026-Q4']!.total).toBe(392_661);
  });
  it('revenue by month and the ÁFA meter match the fixtures', async () => {
    const r = await h.json('GET', '/client/revenue?year=2026', { token: c.token });
    expect(r.body.byMonth.map((m: { amountHuf: number }) => m.amountHuf)).toEqual(fixtures.expectedReceivedByMonth.kata);
    expect(r.body.meters.afa.usedHuf).toBe(fixtures.expectedAfaKeretUsedAsOfToday.kata);
  });
  it('a second sync adds nothing (dedupe by the §5.5 key)', async () => {
    const again = await h.json('POST', `/acc/clients/${c.clientId}/nav-sync`, { token: acc.token });
    expect(again.body.invoicesNew).toBe(0);
  });
  it('the client home shows the Q4 estimate as hero (no payment items yet)', async () => {
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.status).toBe(200);
    // the test client is active (SPEC §26.5: revenue is locked before activation) → the hero shows the estimate
    expect(home.body.hero.state).toBe('becsles');
    expect(home.body.revenueByMonth).toHaveLength(12);
    expect(home.body.limits.afa.usedHuf).toBe(8_242_000);
  });
});

describe('Varga Réka (80 %, garantált bérminimum)', () => {
  it('Q3 = 492 054 Ft, ÁFA 16 315 000 Ft → flag hatar_kozel', async () => {
    const c = await onboardClient('reka', { ratio: 80, status: 'fofoglalkozasu', guaranteed: true });
    await addManual(c.clientId, 'reka');
    const t = await quarterTotals(c.clientId);
    for (const q of fixtures.expectedTax2026.reka) expect(t[`2026-Q${q.q}`]?.total).toBe(q.total);
    const r = await h.json('GET', '/client/revenue?year=2026', { token: c.token });
    expect(r.body.meters.afa.usedHuf).toBe(16_315_000);
    const list = await h.json('GET', '/acc/clients?filter=hatar_kozel', { token: acc.token });
    expect(list.body.items.map((x: { id: string }) => x.id)).toContain(c.clientId);
  });
});

describe('Németh Péter (mellékállású, no minimum)', () => {
  it('Q3 = 303 972 Ft and Q4 so far = 232 731 Ft', async () => {
    const c = await onboardClient('peter', { ratio: 45, status: 'mellekallasu' });
    const t = await quarterTotals(c.clientId);
    for (const q of fixtures.expectedTax2026.peter) expect(t[`2026-Q${q.q}`]?.total).toBe(q.total);
  });
});

describe('NAV errors', () => {
  it('a wrong technical user is reported in Hungarian and flags the client', async () => {
    const c = await newClient(h, 'hibas@demo.kezjegy.test');
    await h.json('PUT', '/client/profile', {
      token: c.token,
      body: { firstName: 'Hiba', lastName: 'Teszt', adoazonositoJel: fixtures.taxIds.kata.adoazonositoJel, adoszam: '68801234-1-41', address: { zip: '1111', city: 'Budapest', line: 'Minta utca 1.' }, hqMunicipality: 'Budapest', activityText: 'x', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2020-01-01', hasSeparateBusinessAccount: false },
    });
    await h.json('PUT', `/acc/clients/${c.clientId}/nav-credentials`, { token: acc.token, body: { login: 'hibas12345', password: 'x', signatureKey: 'ce-0000-0000000000', taxNumber: '68801234', environment: 'demo' } });
    const t = await h.json('POST', `/acc/clients/${c.clientId}/nav-credentials/test`, { token: acc.token });
    expect(t.body.ok).toBe(false);
    expect(t.body.messageHu).toMatch(/technikai felhasználó/);
    const detail = await h.json('GET', `/acc/clients/${c.clientId}`, { token: acc.token });
    expect(detail.body.nav.status).toBe('hibas');
    expect(detail.body.flags).toContain('hianyzik_valami');
    expect(JSON.stringify(detail.body.nav)).not.toContain('hibas12345');
  });
});
