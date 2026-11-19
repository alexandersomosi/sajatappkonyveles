// SPEC §7.6 A and B: NAV's own worked examples (NAV 100. sz. információs füzet, 2026).
// Every expected number below was recomputed by hand (comments show the arithmetic).

import { describe, expect, it } from 'vitest';
import { calculateYear, type QuarterResult } from '../src/index.js';
import { monthly } from './helpers.js';

const bases = (q: QuarterResult) => q.months.map((m) => (m.insured ? m.baseHuf : null));
const sumBases = (q: QuarterResult) => q.months.reduce((s, m) => s + m.baseHuf, 0);

describe('A – NAV 100. füzet járulékalap-példa (göngyölítés, kieső napok, szünetelés)', () => {
  // NAV gives the monthly INCOME directly. With an 80 % cost ratio income = revenue / 5 exactly,
  // so revenue = 5 × income reproduces it without rounding.
  const income = [450_000, 400_000, 800_000, 0, 400_000, 400_000, 0, 0, 1_300_000, 300_000, 300_000, 0];
  const revenue = monthly(Object.fromEntries(income.map((v, i) => [i + 1, v * 5]).filter(([, v]) => v !== 0)));
  const r = calculateYear({
    profile: {
      year: 2026,
      costRatio: 80,
      status: 'fofoglalkozasu',
      guaranteedMinimum: false,
      insuranceBreaks: [
        { from: '2026-02-01', to: '2026-02-25', kind: 'kieso' }, // 25 kieső days in February
        { from: '2026-08-01', to: '2026-08-31', kind: 'szunetel' }, // August suspended
        { from: '2026-12-01', to: '2026-12-05', kind: 'kieso' }, // 5 kieső days in December
      ],
    },
    revenue,
    asOf: '2027-01-31',
  });
  const [q1, q2, q3, q4] = r.quarters as [QuarterResult, QuarterResult, QuarterResult, QuarterResult];

  it('monthly income equals the NAV table', () => {
    expect(r.quarters.flatMap((q) => q.months.map((m) => m.incomeHuf))).toEqual(income);
  });

  it('Q1: Jan 322 800, Feb 3 days × 322 800/30 = 32 280, Mar 322 800 (taxable 0 → minimum)', () => {
    expect(q1.taxableYtdHuf).toBe(0); // 1 650 000 < 1 936 800
    expect(bases(q1)).toEqual([322_800, 32_280, 322_800]);
    expect(q1.months[1]).toMatchObject({ insuredDays: 28, minimumDays: 3, minimumHuf: 32_280, minimumApplied: true });
  });

  it('Q2: taxable 513 200 < prior bases 677 880 → minimum ×3', () => {
    expect(q2.taxableYtdHuf).toBe(513_200); // 2 450 000 − 1 936 800
    expect(q2.priorActualBaseSumHuf).toBe(677_880);
    expect(q2.cumulativeBasePerMonthHuf).toBe(0);
    expect(bases(q2)).toEqual([322_800, 322_800, 322_800]);
  });

  it('Q3: August suspended → 2 insured months, g = (1 813 200 − 1 646 280) / 2 = 83 460 < minimum', () => {
    expect(q3.taxableYtdHuf).toBe(1_813_200); // 3 750 000 − 1 936 800
    expect(q3.insuredMonths).toBe(2);
    expect(q3.cumulativeBasePerMonthHuf).toBe(83_460);
    expect(bases(q3)).toEqual([322_800, null, 322_800]);
    expect(q3.months[1]).toMatchObject({ insured: false, baseHuf: 0, tbHuf: 0, szochoHuf: 0, insuredDays: 0 });
  });

  it('Q4: g = (2 413 200 − 2 291 880) / 3 = 40 440; December 26 days × 10 760 = 279 760', () => {
    expect(q4.taxableYtdHuf).toBe(2_413_200);
    expect(q4.cumulativeBasePerMonthHuf).toBe(40_440);
    expect(bases(q4)).toEqual([322_800, 322_800, 279_760]);
    expect(q4.months[2]).toMatchObject({ minimumDays: 26, minimumHuf: 279_760 });
  });

  it('cumulative actual bases are exactly NAV\'s 677 880 / 1 646 280 / 2 291 880 / 3 217 240', () => {
    let c = 0;
    const cum = r.quarters.map((q) => (c += sumBases(q)));
    expect(cum).toEqual([677_880, 1_646_280, 2_291_880, 3_217_240]);
  });

  it('TB 18.5 % and szocho 13 % per month, rounded to forint', () => {
    // Q1: 59 718 + round(5 971.8)=5 972 + 59 718 ; szocho 41 964 + round(4 196.4)=4 196 + 41 964
    expect([q1.tbHuf, q1.szochoHuf]).toEqual([125_408, 88_124]);
    expect([q2.tbHuf, q2.szochoHuf]).toEqual([179_154, 125_892]);
    expect([q3.tbHuf, q3.szochoHuf]).toEqual([119_436, 83_928]);
    // Q4: 2 × 59 718 + round(51 755.6)=51 756 ; 2 × 41 964 + round(36 368.8)=36 369
    expect([q4.tbHuf, q4.szochoHuf]).toEqual([171_192, 120_297]);
  });

  it('SZJA advances: 0 / 76 980 / 195 000 / 90 000 (15 % of taxable YTD minus earlier advances)', () => {
    // 513 200 × 15 % = 76 980; 1 813 200 × 15 % = 271 980 − 76 980; 2 413 200 × 15 % = 361 980 − 271 980
    expect(r.quarters.map((q) => q.szjaAdvanceHuf)).toEqual([0, 76_980, 195_000, 90_000]);
  });

  it('explains the suspended month and the short-minimum months', () => {
    const notes = (q: QuarterResult) => q.explanation.lines.map((l) => l.note ?? '').join(' ');
    expect(notes(q1)).toContain('Februárban csak 3 napra jár minimum, ezért ott a minimum 32 280 Ft.');
    expect(notes(q3)).toContain('Augusztusban szünetelt a vállalkozásod, arra nem fizetsz járulékot.');
    expect(q3.explanation.lines.find((l) => l.kind === 'cim' && l.label === 'TB-járulék és szocho')?.side).toBe('2 hónap');
    expect(notes(q4)).toContain('Decemberben csak 26 napra jár minimum');
  });

  it('all four quarters are complete as of 2027-01-31, with the 2026 due dates', () => {
    expect(r.quarters.map((q) => [q.periodKey, q.complete, q.dueDate])).toEqual([
      ['2026-Q1', true, '2026-04-13'],
      ['2026-Q2', true, '2026-07-13'],
      ['2026-Q3', true, '2026-10-12'],
      ['2026-Q4', true, '2027-01-12'],
    ]);
  });
});

describe('B – NAV SZJA-példák (45 %)', () => {
  it('Q1 revenue 3 750 000 → income 2 062 500 → advance 18 855; Q2 revenue 4 500 000 → income 2 475 000 → advance 371 250', () => {
    const r = calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false },
      revenue: monthly({ 1: 1_250_000, 2: 1_250_000, 3: 1_250_000, 4: 1_500_000, 5: 1_500_000, 6: 1_500_000 }),
      asOf: '2026-07-01',
    });
    const [q1, q2] = r.quarters as [QuarterResult, QuarterResult];
    expect(q1.incomeHuf).toBe(2_062_500); // 3 750 000 × 55 %
    expect(q1.taxableYtdHuf).toBe(125_700); // 2 062 500 − 1 936 800
    expect(q1.szjaAdvanceHuf).toBe(18_855); // 125 700 × 15 %
    expect(q2.incomeHuf).toBe(2_475_000);
    expect(q2.taxableYtdHuf).toBe(2_600_700); // 4 537 500 − 1 936 800
    expect(q2.szjaCumulativeHuf).toBe(390_105);
    expect(q2.szjaAdvanceHuf).toBe(371_250); // 390 105 − 18 855

    // Járulék: Q1 g = 125 700 / 3 = 41 900 < 322 800 → minimum.
    expect(q1.months.map((m) => m.baseHuf)).toEqual([322_800, 322_800, 322_800]);
    // Q2 g = (2 600 700 − 968 400) / 3 = 544 100 > minimum → the income-based base.
    expect(q2.cumulativeBasePerMonthHuf).toBe(544_100);
    expect(q2.months.map((m) => [m.baseHuf, m.minimumApplied])).toEqual([
      [544_100, false],
      [544_100, false],
      [544_100, false],
    ]);
    // round(544 100 × 18.5 %) = round(100 658.5) = 100 659 (half up); × 3
    expect(q2.tbHuf).toBe(301_977);
    expect(q2.szochoHuf).toBe(212_199); // 70 733 × 3
    // After Q2 the cumulative actual bases equal the taxable income: 968 400 + 1 632 300 = 2 600 700
    expect(968_400 + q2.months.reduce((s, m) => s + m.baseHuf, 0)).toBe(q2.taxableYtdHuf);
    const note = q2.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))?.note ?? '';
    expect(note).toContain('Ez több a minimálbérnél (322 800 Ft), ezért ez a járulékalap.');
    expect(note).toContain('a maradék 1 632 300 Ft jut erre a negyedévre');
  });

  it('a 7 000 000 Ft year → income 3 850 000, taxable 1 913 200, SZJA 286 980 in total', () => {
    const r = calculateYear({
      profile: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false },
      revenue: monthly({ 1: 700_000, 2: 700_000, 3: 700_000, 4: 700_000, 5: 700_000, 6: 700_000, 7: 700_000, 8: 700_000, 9: 700_000, 10: 700_000 }),
      asOf: '2027-01-31',
    });
    const q4 = r.quarters[3]!;
    expect(q4.incomeYtdHuf).toBe(3_850_000);
    expect(q4.taxableYtdHuf).toBe(1_913_200);
    expect(r.quarters.reduce((s, q) => s + q.szjaAdvanceHuf, 0)).toBe(286_980);
  });
});
