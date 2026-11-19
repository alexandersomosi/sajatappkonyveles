// SPEC §28.3.8 – personal allowances 2026, hand-computed (45 %; "even year" = 1 000 000 Ft received on the 10th of
// every month → monthly income 550 000; the adómentes rész (1 936 800) is used up in April, which has a taxable part
// of 263 200; YTD taxable 0 / 1 363 200 / 3 013 200 / 4 663 200; baseline SZJA 0 / 204 480 / 247 500 / 247 500 =
// 699 480; baseline TB főfogl. 179 154 / 179 154 / 199 134 / 305 250, mellékállású 0 / 252 192 / 305 250 / 305 250
// (both 862 692); szocho 606 216).

import { describe, expect, it } from 'vitest';
import { AdoMotorInputError, calculateYear, type AllowancesInput, type TaxStatus, type YearResult } from '../src/index.js';
import { monthly } from './helpers.js';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const evenYear = monthly(Object.fromEntries(ALL.map((m) => [m, 1_000_000])), 2026, 10);

function run(status: TaxStatus, k?: AllowancesInput, revenue = evenYear): YearResult {
  return calculateYear({
    profile: { year: 2026, costRatio: 45, status, guaranteedMinimum: false, ...(k ? { kedvezmenyek: k } : {}) },
    revenue,
    asOf: '2026-12-31',
  });
}
const szja = (r: YearResult) => r.quarters.map((q) => q.szjaAdvanceHuf);
const tb = (r: YearResult) => r.quarters.map((q) => q.tbHuf);
const szocho = (r: YearResult) => r.quarters.reduce((s, q) => s + q.szochoHuf, 0);
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const codes = (r: YearResult) => r.warnings.map((w) => w.code);
const csaladi = (eltartott: number, children: { felvaltva?: boolean; tartosBeteg?: boolean }[], sharePct = 100, csjkInYear = false) => ({
  months: ALL.map((month) => ({ month, eltartott, children, sharePct })),
  csjkInYear,
});

describe('baseline (no allowances) – the numbers the cases start from', () => {
  it('mellékállású and főfoglalkozású even year', () => {
    const m = run('mellekallasu');
    expect(szja(m)).toEqual([0, 204_480, 247_500, 247_500]);
    expect(tb(m)).toEqual([0, 252_192, 305_250, 305_250]);
    expect(szocho(m)).toBe(606_216);
    const f = run('fofoglalkozasu');
    expect(tb(f)).toEqual([179_154, 179_154, 199_134, 305_250]);
    expect(m.allowances).toBeUndefined();
  });
});

describe('T1–T3 25 év alattiak (month-bound, 715 765 Ft cap)', () => {
  it('T1 birth 2002-05 → every month eligible, SZJA 0, TB/szocho unchanged, used 4 663 200', () => {
    const r = run('mellekallasu', { birthMonth: '2002-05', fiatal25: {} });
    expect(szja(r)).toEqual([0, 0, 0, 0]);
    expect(tb(r)).toEqual([0, 252_192, 305_250, 305_250]);
    expect(szocho(r)).toBe(606_216);
    expect(r.allowances!.usedHuf.fiatal25).toBe(4_663_200);
    expect(r.allowances!.szjaSavedHuf).toBe(699_480);
  });

  it('T2 birth 2001-06 → months 1–6 only: SZJA 0 / 0 / 247 500 / 247 500 (495 000)', () => {
    const r = run('mellekallasu', { birthMonth: '2001-06', fiatal25: {} });
    expect(szja(r)).toEqual([0, 0, 247_500, 247_500]);
    expect(total(szja(r))).toBe(495_000);
  });

  it('T3 6 000 000 on 04-10 → April taxable 1 363 200 − 715 765 = 647 435 → Q2 97 115, TB Q2 unchanged', () => {
    const r = run('mellekallasu', { birthMonth: '2003-01', fiatal25: {} }, monthly({ 4: 6_000_000 }, 2026, 10));
    expect(szja(r)).toEqual([0, 97_115, 0, 0]);
    expect(r.quarters[1]!.tbHuf).toBe(252_192);
    expect(r.quarters[1]!.months[0]).toMatchObject({ taxableHuf: 1_363_200, exemptHuf: 715_765, csjkHuf: 0 });
  });

  it('explicit months after the birthday month are dropped with fiatal25_kor', () => {
    const r = run('mellekallasu', { birthMonth: '2001-06', fiatal25: { months: ALL } });
    expect(szja(r)).toEqual([0, 0, 247_500, 247_500]);
    expect(codes(r)).toContain('fiatal25_kor');
  });
});

describe('T4–T7 anyák (month-bound, no cap)', () => {
  it('T4 főfogl. anya30 (birth 1997-03) → SZJA 0, TB 862 692 and szocho 606 216 unchanged', () => {
    const r = run('fofoglalkozasu', { birthMonth: '1997-03', anya30: { months: ALL } });
    expect(szja(r)).toEqual([0, 0, 0, 0]);
    expect(total(tb(r))).toBe(862_692);
    expect(szocho(r)).toBe(606_216);
    expect(r.allowances!.usedHuf.anya30).toBe(4_663_200);
  });

  it('T5 anyák ket: born 1986-01 → 0; born 1985-12 → baseline 699 480 + anyak_kor', () => {
    const ok = run('mellekallasu', { birthMonth: '1986-01', anyak: { jogcim: 'ket', months: ALL } });
    expect(total(szja(ok))).toBe(0);
    const no = run('mellekallasu', { birthMonth: '1985-12', anyak: { jogcim: 'ket', months: ALL } });
    expect(total(szja(no))).toBe(699_480);
    expect(no.warnings.find((w) => w.code === 'anyak_kor')?.audience).toBe('konyvelo');
  });

  it('T6 nyugdíjas anya30: born 1996-01 → 0; born 1995-12 → baseline + anya30_kor', () => {
    expect(total(szja(run('nyugdijas', { birthMonth: '1996-01', anya30: { months: ALL } })))).toBe(0);
    const no = run('nyugdijas', { birthMonth: '1995-12', anya30: { months: ALL } });
    expect(total(szja(no))).toBe(699_480);
    expect(codes(no)).toContain('anya30_kor');
  });

  it('T7 nyugdíjas, anyák harom months 7–12 → 0 / 204 480 / 0 / 0', () => {
    const r = run('nyugdijas', { anyak: { jogcim: 'harom', months: [7, 8, 9, 10, 11, 12] } });
    expect(szja(r)).toEqual([0, 204_480, 0, 0]);
  });

  it('anyák ket without a birth month → ignored with kedvezmeny_szuletes_hianyzik', () => {
    const r = run('mellekallasu', { anyak: { jogcim: 'ket', months: ALL } });
    expect(total(szja(r))).toBe(699_480);
    expect(codes(r)).toContain('kedvezmeny_szuletes_hianyzik');
  });
});

describe('T8–T10 frames: személyi, első házasok', () => {
  it('T8 nyugdíjas személyi 1–12 → 0 / 107 640 / 199 080 / 199 080 (505 800 = 699 480 − 193 680)', () => {
    const r = run('nyugdijas', { szemelyi: { months: ALL } });
    expect(szja(r)).toEqual([0, 107_640, 199_080, 199_080]);
    expect(total(szja(r))).toBe(505_800);
    expect(r.allowances!.usedHuf.szemelyi).toBe(1_291_200);
  });

  it('T9 nyugdíjas első házasok 1–12, 33 335 → 0 / 174 479 / 232 499 / 232 499 (639 477)', () => {
    const r = run('nyugdijas', { elsoHazasok: { months: ALL, monthlyHuf: 33_335 } });
    expect(szja(r)).toEqual([0, 174_479, 232_499, 232_499]);
    expect(total(szja(r))).toBe(639_477);
  });

  it('T10 wedding in May → months 6–12 → year SZJA 664 478 (base 4 429 855)', () => {
    const r = run('nyugdijas', { elsoHazasok: { months: [6, 7, 8, 9, 10, 11, 12], monthlyHuf: 33_335 } });
    expect(total(szja(r))).toBe(664_478);
    expect(r.quarters[3]!.szjaCumulativeHuf).toBe(664_478); // round(4 429 855 × 15 %)
  });
});

describe('T11–T19 családi kedvezmény and családi járulékkedvezmény', () => {
  it('T11 1 eltartott / 1 child, csjk off → 0 / 84 474 / 187 497 / 187 497 (459 468)', () => {
    const r = run('mellekallasu', { csaladi: csaladi(1, [{}]) });
    expect(szja(r)).toEqual([0, 84_474, 187_497, 187_497]);
    expect(total(szja(r))).toBe(459_468);
  });

  it('T12 the child tartósan beteg → 0 / 0 / 91 962 / 127 494 (219 456)', () => {
    const r = run('mellekallasu', { csaladi: csaladi(1, [{ tartosBeteg: true }]) });
    expect(szja(r)).toEqual([0, 0, 91_962, 127_494]);
  });

  it('T13 the child felváltva gondozott (50 %) → 0 / 144 477 / 217 499 / 217 498 (579 474)', () => {
    const r = run('mellekallasu', { csaladi: csaladi(1, [{ felvaltva: true }]) });
    expect(szja(r)).toEqual([0, 144_477, 217_499, 217_498]);
    expect(total(szja(r))).toBe(579_474);
  });

  it('T14 2 eltartott / 2 children, share 50 % → 0 / 0 / 91 989 / 127 503 (219 492)', () => {
    const r = run('mellekallasu', { csaladi: csaladi(2, [{}, {}], 50) });
    expect(szja(r)).toEqual([0, 0, 91_989, 127_503]);
  });

  it('T15 2/2, 100 %, csjk off → SZJA 0, TB baseline, unused 1 736 640, potential 260 496', () => {
    const r = run('mellekallasu', { csaladi: csaladi(2, [{}, {}]) });
    expect(szja(r)).toEqual([0, 0, 0, 0]);
    expect(tb(r)).toEqual([0, 252_192, 305_250, 305_250]);
    expect(r.allowances!.csaladiUnusedHuf).toBe(1_736_640);
    expect(r.allowances!.annualCsjkPotentialHuf).toBe(260_496);
    expect(codes(r)).toContain('kedvezmeny_ev_vegen');
    expect(r.warnings.find((w) => w.code === 'kedvezmeny_ev_vegen')!.audience).toBe('ugyfel');
  });

  it('T16 2/2, csjk on (mellékállású) → csjk only in April 40 518; TB 0 / 211 674 / 305 250 / 305 250; unused 1 466 520; potential 219 978', () => {
    const r = run('mellekallasu', { csaladi: csaladi(2, [{}, {}], 100, true) });
    expect(szja(r)).toEqual([0, 0, 0, 0]);
    expect(r.quarters.flatMap((q) => q.months.map((m) => m.csjkHuf))).toEqual([0, 0, 0, 40_518, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(tb(r)).toEqual([0, 211_674, 305_250, 305_250]);
    expect(r.quarters[1]!.csjkHuf).toBe(40_518);
    expect(r.allowances!.csaladiUnusedHuf).toBe(1_466_520);
    expect(r.allowances!.annualCsjkPotentialHuf).toBe(219_978);
    expect(40_518 + 219_978).toBe(260_496);
    expect(codes(r)).toContain('csjk_2658');
  });

  it('T17 főfogl. 2/2, csjk on → csjk Jan–Mar 59 718, Apr 40 518 → TB 0 / 138 636 / 199 134 / 305 250 = 643 020', () => {
    const r = run('fofoglalkozasu', { csaladi: csaladi(2, [{}, {}], 100, true) });
    expect(r.quarters.flatMap((q) => q.months.map((m) => m.csjkHuf))).toEqual([59_718, 59_718, 59_718, 40_518, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(tb(r)).toEqual([0, 138_636, 199_134, 305_250]);
    expect(total(tb(r))).toBe(643_020);
    expect(szocho(r)).toBe(606_216);
    expect(total(szja(r))).toBe(0);
    expect(r.allowances!.csaladiUnusedHuf).toBe(272_160);
    expect(r.allowances!.annualCsjkPotentialHuf).toBe(40_824);
    expect(3 * 59_718 + 40_518 + 40_824).toBe(260_496);
    // payments use the net TB
    expect(r.quarters[0]!.payments.find((p) => p.kind === 'tb_jarulek')).toBeUndefined();
    expect(r.quarters[1]!.payments.find((p) => p.kind === 'tb_jarulek')!.amountHuf).toBe(138_636);
  });

  it('T18 főfogl., revenue only from April → no csjk in Jan–Mar (no income in a minimum month), April 59 718', () => {
    const rev = monthly(Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => [m, 1_000_000])), 2026, 10);
    const r = run('fofoglalkozasu', { csaladi: csaladi(2, [{}, {}], 100, true) }, rev);
    expect(r.quarters[0]!.months.map((m) => m.csjkHuf)).toEqual([0, 0, 0]);
    expect(r.quarters[0]!.tbHuf).toBe(179_154);
    expect(r.quarters[1]!.months[0]!.csjkHuf).toBe(59_718);
  });

  it('T19 fiatal25 (2003-01) + családi 1/1 csjk on → SZJA 0, csjk 20 001 in Apr–Dec = 180 009, TB year 682 683', () => {
    const r = run('mellekallasu', { birthMonth: '2003-01', fiatal25: {}, csaladi: csaladi(1, [{}], 100, true) });
    expect(total(szja(r))).toBe(0);
    const c = r.quarters.flatMap((q) => q.months.map((m) => m.csjkHuf));
    expect(c).toEqual([0, 0, 0, 20_001, 20_001, 20_001, 20_001, 20_001, 20_001, 20_001, 20_001, 20_001]);
    expect(r.allowances!.csjkHuf).toBe(180_009);
    expect(total(tb(r))).toBe(682_683);
  });

  it('nyugdíjas: csjk never applies (csjk_nyugdijas)', () => {
    const r = run('nyugdijas', { csaladi: csaladi(2, [{}, {}], 100, true) });
    expect(r.allowances!.csjkHuf).toBe(0);
    expect(r.allowances!.annualCsjkPotentialHuf).toBe(0);
    expect(codes(r)).toContain('csjk_nyugdijas');
  });
});

describe('T20 regression and explanation', () => {
  it('no kedvezmenyek → identical results to an empty plan, no allowance fields', () => {
    const a = run('fofoglalkozasu');
    expect(a.quarters[0]!.months[0]!.taxableHuf).toBeUndefined();
    expect(a.quarters[0]!.csjkHuf).toBeUndefined();
    const b = run('fofoglalkozasu', {});
    expect(b.quarters.map((q) => q.totalHuf)).toEqual(a.quarters.map((q) => q.totalHuf));
  });

  it('legacy flags keep only the warning; with kedvezmenyek the warning is gone', () => {
    const legacy = calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'mellekallasu', guaranteedMinimum: false, allowances: [{ kind: 'csaladi' }] },
      revenue: evenYear,
      asOf: '2026-12-31',
    });
    expect(codes(legacy)).toContain('kedvezmeny_nem_modellezett');
    expect(total(szja(legacy))).toBe(699_480);
  });

  it('"Hogyan jött ki?" lists the approved allowances and the csjk row', () => {
    const r = run('fofoglalkozasu', { szemelyi: { months: ALL }, csaladi: csaladi(1, [{}], 100, true) });
    const q4 = r.quarters[3]!;
    const labels = q4.explanation.lines.map((l) => l.label);
    expect(labels).toContain('Kedvezményeid');
    expect(labels).toContain('Személyi kedvezmény');
    expect(labels).toContain('Családi kedvezmény (1 gyermek)');
    const q1 = r.quarters[0]!;
    expect(q1.explanation.lines.some((l) => l.label === 'Családi járulékkedvezmény – ennyivel kevesebb a TB-járulék')).toBe(true);
    expect(q1.totalHuf).toBe(q1.tbHuf + q1.szochoHuf + q1.szjaAdvanceHuf);
  });
});

describe('T21 validation', () => {
  const bad = (k: unknown) => () =>
    calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'mellekallasu', guaranteedMinimum: false, kedvezmenyek: k as AllowancesInput },
      revenue: evenYear,
      asOf: '2026-12-31',
    });
  it('months outside 1–12, sharePct outside 0–100, monthlyHuf > 33 335, bad birthMonth → AdoMotorInputError (Hungarian)', () => {
    expect(bad({ szemelyi: { months: [0, 13] } })).toThrow(AdoMotorInputError);
    expect(bad({ csaladi: { months: [{ month: 1, eltartott: 1, children: [{}], sharePct: 120 }], csjkInYear: false } })).toThrow(/megosztás/);
    expect(bad({ elsoHazasok: { months: [1], monthlyHuf: 40_000 } })).toThrow(/33335|első házasok/);
    expect(bad({ birthMonth: '2002-13', fiatal25: {} })).toThrow(/születési hónap/);
    expect(bad({ csaladi: { months: [{ month: 1, eltartott: 1, children: [{}, {}] }], csjkInYear: false } })).toThrow(AdoMotorInputError);
  });
});

describe('T22 NAV 100 6.1 csjk example (főfogl., minimálbér, kieső and szünetel months)', () => {
  // The NAV table's "Csjk alapja" column needs the full NAV example (monthly incomes, the családi frame); the
  // cumulative values 968 400 / 1 491 200 / 1 814 000 / 2 459 600 could not be rebuilt from the research notes alone
  // (the engine's 6.1 járulék example gives 677 880 for Q1 with the prorated February minimum). Kept pending until
  // the accountant confirms the cap base of a short-minimum month (SPEC §28.13 wait #32; builder note §28.K B1).
  it.todo('csjk bases cumulative 968 400 / 1 491 200 / 1 814 000 / 2 459 600');
});
