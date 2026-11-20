// k7c2 fix round (2026-11-20): income statement up to today, KATA deadlines, the owner's termination on the Főoldal,
// date suffixes, the price everywhere = the fee setting.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, clientTaxProfiles, feeSettings, revenueItems } from '../src/db/schema.js';
import { statementData } from '../src/services/kimutatas.js';
import { clientDeadlines } from '../src/services/flags.js';
import { serviceNotice } from '../src/services/subscription.js';
import { dateSuffixFix, fill } from '../src/content.js';
import { fillPlaceholders } from '../src/_shared/bekotes.js';
import { newClient, setup, type Harness } from './helpers.js';

let h: Harness;
beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
});
afterAll(async () => h.close());

describe('income statement (§29 F2): money not arrived yet is not counted', () => {
  it('an estimated receipt after today stays out of the current month and the total', async () => {
    const c = await newClient(h, 'k7c2-kim@demo.kezjegy.test', { first: 'Kata', last: 'Szabó' });
    const add = (d: string, amountHuf: number, est = false) => h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: d, receivedOnEstimated: est, deliveryDate: d, amountHuf, description: 'x' });
    await add('2026-11-05', 200_000);
    await add('2026-11-18', 202_000);
    await add('2026-11-26', 218_000, true); // expected, not arrived on 11-20
    const d = await statementData(h.deps.db, c.clientId, '2026-01', '2026-11', '2026-11-20');
    const nov = d.months.find((m) => m.month === '2026-11')!;
    expect(nov.revenueHuf).toBe(402_000);
    expect(nov.invoices + nov.other).toBe(2);
    expect(d.totalHuf).toBe(402_000);
  });
});

describe('KATA: no átalány deadlines; the monthly 50 000 Ft instead', () => {
  it('Határidők of a KATA client', async () => {
    const c = await newClient(h, 'k7c2-kata@demo.kezjegy.test', { first: 'Gréta', last: 'Lakatos' });
    await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, regime: 'kata', status: 'fofoglalkozasu', kataFrom: '2026-01-01' }).onConflictDoNothing();
    await h.deps.db.update(clients).set({ createdAt: new Date('2026-01-01T00:00:00Z') }).where(eq(clients.id, c.clientId));
    const list = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2026-11-20', '2027-06-30');
    expect(list.some((d) => /negyedév/.test(d.title))).toBe(false);
    expect(list.some((d) => /26SZJA|SZJA-bevallás/.test(d.title))).toBe(false);
    const kata = list.filter((d) => d.id.startsWith('kata:'));
    // November → 2026-12-12 (a Saturday, but a WORKING day in 2026: the 24 December swap in the engine's calendar),
    // December → 2027-01-12
    expect(kata.map((d) => [d.dueDate, d.amountHuf])).toEqual([
      ['2026-12-12', 50_000],
      ['2027-01-12', 50_000],
    ]);
  });
});

describe('the owner terminated the contract: one end date, no "Lemondtad"', () => {
  it('serviceNotice says felmondva until terminated.effectiveOn', async () => {
    const c = await newClient(h, 'k7c2-felm@demo.kezjegy.test', { first: 'Zsófia', last: 'Halmi' });
    await h.deps.db.update(clients).set({ terminated: { kind: 'rendes', reason: 'teszt', noticeAt: '2026-11-20T09:00:00Z', effectiveOn: '2026-12-20', by: null, appliedAt: null } as never }).where(eq(clients.id, c.clientId));
    const n = await serviceNotice(h.deps, h.deps.db, c.clientId);
    expect(n).toMatchObject({ kind: 'felmondva', endsOn: '2026-12-20', canResume: false });
  });
});

describe('date suffixes and the price', () => {
  it('"2026. december 20.-ig" → "2026. december 20-ig" (content and shared fill)', () => {
    expect(fill('{datum}-ig minden marad.', { datum: '2026. december 20.' })).toBe('2026. december 20-ig minden marad.');
    expect(fillPlaceholders('Lemondva – {datum}-ig él', { datum: 'december 1.' })).toBe('Lemondva – december 1-ig él');
    expect(dateSuffixFix('A 2. pont szerint')).toBe('A 2. pont szerint');
  });
  it('/config and the ÁSZF name the fee setting (19 999 Ft), whatever PLAN_PRICE_HUF says', async () => {
    const h2 = await setup({ now: '2026-11-20T09:00:00Z', env: { PLAN_PRICE_HUF: '20000' } });
    try {
      await h2.deps.db.insert(feeSettings).values({ kind: 'havidij', amountHuf: 19_999, unit: 'ho' }).onConflictDoUpdate({ target: feeSettings.kind, set: { amountHuf: 19_999 } });
      const cfg = await h2.json('GET', '/config');
      expect(cfg.body.brand.priceHufMonthlyGross).toBe(19_999);
      const aszf = await h2.json('GET', '/legal/aszf');
      expect(aszf.status).toBe(200);
      expect(aszf.body.markdown).not.toContain('20 000 Ft');
    } finally {
      await h2.close();
    }
  });
});
