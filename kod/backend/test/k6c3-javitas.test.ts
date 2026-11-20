// k6c3 fix round (2026-11-20): the two tax blockers of the adversarial re-check, each pinned by a test.
//  1. An allowance with in-year csjk approved AFTER Q1–Q3 were approved: "Mennyit kerestem?" projects the year with the
//     approved quarters as approved (no hypothetical Q1–Q3 csjk), and the Kedvezmények effects count the csjk only
//     where it was really taken (open quarters, or an approval that included it). The SZJA saving is the whole year's,
//     because the overpaid advances come back in the annual return.
//  2. "Ennyit tegyél félre": the order is the receipt date, then the arrival – a month typed in by hand later does not
//     push an earlier-dated invoice out of the adómentes rész it really fell into.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AllowanceAnswers } from '../src/_shared/api.js';
import { clients, clientTaxProfiles, plans, revenueItems } from '../src/db/schema.js';
import { runDataStepK28, runDataStepOt1119 } from '../src/services/datastep-k28.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
const mm = (m: number) => String(m).padStart(2, '0');
const lastDay = (m: number) => String(new Date(2026, m, 0).getDate()).padStart(2, '0');

async function client(email: string, first: string, profile: { costRatio: 45 | 80; guaranteedMinimum?: boolean }) {
  const c = await newClient(h, email, { active: true, first, last: 'Próba' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  await h.deps.db.insert(clientTaxProfiles).values({
    clientId: c.clientId,
    year: 2026,
    costRatio: profile.costRatio,
    status: 'fofoglalkozasu',
    guaranteedMinimum: profile.guaranteedMinimum ?? false,
    hipaMethod: 'nincs',
    costRatioSource: 'konyvelo_megerositette',
  });
  return c;
}

async function revenue(clientId: string, receivedOn: string, amountHuf: number, createdAt: string, o: { estimated?: boolean; label?: string } = {}) {
  await h.deps.db.insert(revenueItems).values({
    clientId,
    source: 'kezi',
    receivedOn,
    deliveryDate: receivedOn,
    amountHuf,
    description: o.label ?? `Bevétel ${receivedOn}`,
    receivedOnEstimated: o.estimated ?? false,
    createdAt: new Date(createdAt),
  });
}

beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.k6c3@demo.kezjegy.test', { firstName: 'Bence' });
  await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
  await runDataStepOt1119(h.deps);
  await runDataStepK28(h.deps);
});
afterAll(async () => h?.close());

describe('1. an allowance with in-year csjk approved after Q1–Q3 (Kata, 45 %, főfoglalkozású)', () => {
  const months: [number, number][] = [[1, 610_000], [2, 540_000], [3, 720_000], [4, 880_000], [5, 760_000], [6, 940_000], [7, 820_000], [8, 650_000], [9, 1_020_000], [10, 900_000], [11, 402_000]];
  const kid = () => ({ potlek: 'most' as const, sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null });
  const mother: AllowanceAnswers = {
    birthMonth: '1990-05', children: [kid(), kid()], otherDependants: 0, pregnancy: null, mother: true, csaladiWho: 'en', csaladiSharePct: null,
    csjkWish: 'igen', marriage: null, disability: null, benefit: null, healthConsent: false, note: null,
  };
  let c: Awaited<ReturnType<typeof client>>;
  let approvedTotal = 0;

  it('Q1–Q3 approved without the allowance, then anyák (2) + családi 2/2 with csjk approved', async () => {
    c = await client('kata.k6c3@demo.kezjegy.test', 'Kata', { costRatio: 45 });
    for (const [m, a] of months) await revenue(c.clientId, `2026-${mm(m)}-10`, a, `2026-${mm(m)}-10T08:00:00Z`);
    for (const [q, asOf] of [[1, '2026-04-05'], [2, '2026-07-05'], [3, '2026-10-05']] as const) {
      const calc = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-Q${q}/calculate`, { token: bence.token, body: { asOf } });
      expect(calc.status).toBe(200);
      approvedTotal += calc.body.result.totalHuf;
      expect((await h.json('POST', `/acc/tax-calculations/${calc.body.id}/approve`, { token: bence.token, body: { letterText: 'Rendben.' } })).status).toBe(200);
    }
    expect(approvedTotal).toBe(1_197_168);
    expect((await h.json('PUT', '/client/allowances/answers', { token: c.token, body: { year: 2026, submit: true, answers: mother } })).status).toBe(200);
    for (const kind of ['anyak', 'csaladi'])
      expect((await h.json('POST', `/acc/clients/${c.clientId}/allowances/${kind}/decision`, { token: bence.token, body: { year: 2026, status: 'jovahagyva' } })).status).toBe(200);
  });

  it('the projection keeps Q1–Q3 as approved: 1 197 168 + Q4 szocho 125 892 − SZJA refund 282 030 = 1 041 030 (no HIPA)', async () => {
    const e = (await h.json('GET', '/client/earnings?year=2026', { token: c.token })).body;
    expect(e.refund.huf).toBe(282_030);
    expect(e.projection.reliable).toBe(true);
    // projected revenue 9 284 969 → 9 280 000; taxes 1 041 030 → 1 040 000; net 8 243 939 → 8 240 000
    expect(e.projection).toMatchObject({ revenueHuf: 9_280_000, taxesHuf: 1_040_000, netHuf: 8_240_000 });
    // never lower than what the approved quarters already carry minus the refund
    expect(e.projection.taxesHuf).toBeGreaterThan(approvedTotal - 282_030 - 10_000);
    expect(e.projection.text).toContain('kb. 1 040 000 Ft adóval');
    const home = (await h.json('GET', '/client/home', { token: c.token })).body;
    expect(home.earnings.projectionText).toContain('8 240 000');
  });

  it('Kedvezmények: anyák kb. 389 000 (the whole year SZJA), családi kb. 101 000 (Oct 59 718 + Nov 40 904 csjk), band kb. 490 000', async () => {
    const st = (await h.json('GET', '/client/allowances?year=2026', { token: c.token })).body;
    const anyak = st.items.find((i: { kind: string }) => i.kind === 'anyak');
    const csaladi = st.items.find((i: { kind: string }) => i.kind === 'csaladi');
    expect(anyak.effectYearHuf).toBe(389_000);
    expect(csaladi.effectYearHuf).toBe(101_000);
    expect(st.savedYtdHuf).toBe(490_000);
    expect(anyak.effectYearHuf + csaladi.effectYearHuf).toBe(st.savedYtdHuf);
    expect(csaladi.statusText).toContain('kb. 101 000 Ft-tal kevesebb adó');
    // the accountant sees the same shares
    const acc = (await h.json('GET', `/acc/clients/${c.clientId}/allowances?year=2026`, { token: bence.token })).body;
    expect(acc.items.find((i: { kind: string }) => i.kind === 'csaladi').effectYearHuf).toBe(101_000);
  });
});

describe('2. reserve order = receipt date, then arrival (Réka, 80 %, garantált bérminimum)', () => {
  it('the September (84 000) and November (145 000) invoices are past the adómentes rész; July crosses it', async () => {
    const c = await client('reka.k6c3@demo.kezjegy.test', 'Réka', { costRatio: 80, guaranteedMinimum: true });
    // the invoices arrived first (NAV), the monthly cash-register totals were typed in on 11-01
    await revenue(c.clientId, '2026-03-12', 96_000, '2026-03-12T05:00:00Z', { label: 'VR-2026-001' });
    await revenue(c.clientId, '2026-06-15', 118_000, '2026-06-15T05:00:00Z', { label: 'VR-2026-002' });
    await revenue(c.clientId, '2026-09-20', 84_000, '2026-09-13T05:00:00Z', { label: 'VR-2026-003', estimated: true });
    await revenue(c.clientId, '2026-11-21', 145_000, '2026-11-14T05:00:00Z', { label: 'VR-2026-004', estimated: true });
    const kezi: [number, number][] = [[1, 1_480_000], [2, 1_420_000], [3, 1_454_000], [4, 1_620_000], [5, 1_590_000], [6, 1_592_000], [7, 1_760_000], [8, 1_510_000], [9, 1_606_000], [10, 1_840_000]];
    for (const [m, a] of kezi) await revenue(c.clientId, `2026-${mm(m)}-${lastDay(m)}`, a, '2026-11-01T09:00:00Z', { label: 'Pénztárgép havi összesítő' });
    const r = (await h.json('GET', '/client/reserve?year=2026', { token: c.token })).body;
    const items = r.months.flatMap((m: { items: { amountHuf: number; receivedOn: string; reserve: { reserveHuf: number; zone: string; line: string; crossesTaxFree: boolean } }[] }) => m.items);
    const of = (amount: number) => items.find((i: { amountHuf: number }) => i.amountHuf === amount)!;
    expect(of(84_000).reserve).toMatchObject({ reserveHuf: 3_000, zone: 'csak_szja' });
    expect(of(84_000).reserve.line).not.toContain('adómentes részben');
    expect(of(145_000).reserve).toMatchObject({ reserveHuf: 5_000, zone: 'csak_szja' });
    expect(of(1_760_000).reserve).toMatchObject({ reserveHuf: 44_000, crossesTaxFree: true });
    for (const a of [96_000, 118_000, 1_480_000, 1_592_000]) expect(of(a).reserve).toMatchObject({ reserveHuf: 0, zone: 'adomentes' });
    // the home card says July, and the invoices agree with it
    const home = (await h.json('GET', '/client/home', { token: c.token })).body;
    expect(JSON.stringify(home)).toContain('júliusban');
  });
});
