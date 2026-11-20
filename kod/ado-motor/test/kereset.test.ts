// SPEC §28.4 – "Mennyit kerestem?": monthly attribution and the year-end projection (2026, 45 %, HIPA sávos 2 %).

import { describe, expect, it } from 'vitest';
import { calculateYear, earningsByMonth, projectYear, yearEndSettlement, type TaxStatus } from '../src/index.js';
import { monthly } from './helpers.js';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const evenYear = monthly(Object.fromEntries(ALL.map((m) => [m, 1_000_000])), 2026, 10);
const prof = (status: TaxStatus) => ({ year: 2026, costRatio: 45 as const, status, guaranteedMinimum: false, hipa: { method: 'savos' as const, ratePct: 2 } });

describe('E1 mellékállású even year, asOf 2026-12-31 (12 000 000 → band a, HIPA 50 000)', () => {
  const r = calculateYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-12-31' });
  const e = earningsByMonth(r, { hipaAnnualHuf: r.hipa!.annualHuf });
  // Own-month attribution (round 2 of 2026-11-19): April's taxable part 263 200 carries its own TB 18,5 % = 48 692 and
  // szocho 13 % = 34 216; May's 550 000 → 101 750 / 71 500. HIPA by active days: Jan 50 000 × 31/365 = 4 247, Apr 4 109.
  it('January net 995 753 (HIPA 4 247); April 873 503 (SZJA 39 480, TB 48 692, szocho 34 216, HIPA 4 109); May TB 101 750', () => {
    expect(r.hipa!.annualHuf).toBe(50_000);
    expect(e[0]).toMatchObject({ revenueHuf: 1_000_000, hipaHuf: 4_247, netHuf: 995_753 });
    expect(e[3]).toMatchObject({ szjaHuf: 39_480, tbHuf: 48_692, szochoHuf: 34_216, hipaHuf: 4_109, netHuf: 873_503 });
    expect(e[4]).toMatchObject({ szjaHuf: 82_500, tbHuf: 101_750, szochoHuf: 71_500 });
  });
  it('months 1–6: revenue 6 000 000, taxes 633 888 + HIPA 24 795 = 658 683, net 5 341 317; HIPA months sum to 50 000; quarters sum exactly', () => {
    const h = e.slice(0, 6);
    expect(h.reduce((a, x) => a + x.revenueHuf, 0)).toBe(6_000_000);
    expect(h.reduce((a, x) => a + x.szjaHuf + x.tbHuf + x.szochoHuf + x.hipaHuf, 0)).toBe(658_683);
    expect(h.reduce((a, x) => a + x.netHuf, 0)).toBe(5_341_317);
    expect(e.reduce((a, x) => a + x.hipaHuf, 0)).toBe(50_000);
    r.quarters.forEach((q, i) => {
      const ms = e.slice(i * 3, i * 3 + 3);
      expect(ms.reduce((a, x) => a + x.szjaHuf, 0)).toBe(q.szjaAdvanceHuf);
      expect(ms.reduce((a, x) => a + x.tbHuf, 0)).toBe(q.tbHuf);
    });
  });
});

describe('E2 főfogl., revenue Feb–Dec only', () => {
  it('January net −105 929 (the fixed minimum: TB 59 718 + szocho 41 964; HIPA 4 247)', () => {
    const r = calculateYear({ profile: prof('fofoglalkozasu'), revenue: evenYear.slice(1), asOf: '2026-12-31' });
    const e = earningsByMonth(r, { hipaAnnualHuf: r.hipa!.annualHuf });
    expect(e[0]).toMatchObject({ revenueHuf: 0, tbHuf: 59_718, szochoHuf: 41_964, hipaHuf: 4_247, netHuf: -105_929 });
  });
});

describe('E3 projection, mellékállású even year, asOf 2026-06-30', () => {
  it('projected revenue 12 099 448 → HIPA band b (120 000); taxes from one whole-year run', () => {
    const p = projectYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-06-30' });
    expect(p.reliable).toBe(true);
    expect(p.revenueHuf).toBe(12_099_448); // roundDiv(6 000 000 × 365, 181)
    expect(p.hipaHuf).toBe(120_000); // 6 000 000 × 2 %
    // the remaining 6 099 448 spread over Jul–Dec by days (184), computed once for the whole year
    expect(p.taxesHuf).toBe(2_313_818);
    expect(p.netHuf).toBe(12_099_448 - 2_313_818);
  });
  it('not reliable before 60 active days', () => {
    const p = projectYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-02-15' });
    expect(p.reliable).toBe(false);
  });
});

describe('E4 an approved quarter with an override', () => {
  it('the months of Q3 sum to the approved total (TB +10 000)', () => {
    const r = calculateYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-12-31' });
    const q3 = r.quarters[2]!;
    const approved = { '2026-Q3': { tbHuf: q3.tbHuf + 10_000, szochoHuf: q3.szochoHuf, szjaHuf: q3.szjaAdvanceHuf } };
    const e = earningsByMonth(r, { hipaAnnualHuf: 0, approved });
    const ms = e.slice(6, 9);
    expect(ms.reduce((a, x) => a + x.tbHuf, 0)).toBe(q3.tbHuf + 10_000);
    expect(ms.reduce((a, x) => a + x.tbHuf + x.szochoHuf + x.szjaHuf, 0)).toBe(q3.totalHuf + 10_000);
  });
  it('an approved part where the engine has 0 is spread evenly over the insured months', () => {
    const r = calculateYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-12-31' });
    const e = earningsByMonth(r, { hipaAnnualHuf: 0, approved: { '2026-Q1': { tbHuf: 3_000, szochoHuf: 0, szjaHuf: 0 } } });
    expect(e.slice(0, 3).map((x) => x.tbHuf)).toEqual([1_000, 1_000, 1_000]);
  });
});

// Round 2 of 2026-11-19 (k6c review): "eddig" must carry the járulék of the income received so far, not a third of it on
// the future December; the overpaid SZJA advance comes back in the annual return.
describe('E5 running quarter: TB / szocho stay with the months that earned them', () => {
  it('mellékállású, Oct 620 000 + Nov 650 000, asOf 11-19: all of Q4 TB lands in Oct + Nov, December 0', () => {
    const rev = [...evenYear.slice(0, 9), ...monthly({ 10: 620_000, 11: 650_000 }, 2026, 10)];
    const r = calculateYear({ profile: prof('mellekallasu'), revenue: rev, asOf: '2026-11-19' });
    const e = earningsByMonth(r, { hipaAnnualHuf: 0 });
    const q4 = r.quarters[3]!;
    expect(e[11]).toMatchObject({ tbHuf: 0, szochoHuf: 0, szjaHuf: 0 });
    expect(e[9]!.tbHuf + e[10]!.tbHuf).toBe(q4.tbHuf);
    expect(e[9]!.szochoHuf + e[10]!.szochoHuf).toBe(q4.szochoHuf);
    // Q4 TB = 3 × 18,5 % × round(698 500 / 3) = 129 222 split 341 000 : 357 500 → 63 085 / 66 137 (18,5 % of each, rounding to the quarter sum)
    expect([e[9]!.tbHuf, e[10]!.tbHuf]).toEqual([63_085, 66_137]);
  });
  it('főfoglalkozású: the future December keeps only its own fixed minimum', () => {
    const r = calculateYear({ profile: prof('fofoglalkozasu'), revenue: evenYear.slice(0, 11), asOf: '2026-11-19' });
    const e = earningsByMonth(r, { hipaAnnualHuf: 0 });
    expect(e[11]).toMatchObject({ tbHuf: 59_718, szochoHuf: 41_964 });
  });
});

describe('C17 overpaid SZJA advance (családi kedvezmény from September, 8 000 000 in January, mellékállású)', () => {
  const k = { csaladi: { months: [9, 10, 11, 12].map((month) => ({ month, eltartott: 1, children: [{}] })), csjkInYear: false } };
  const items = monthly({ 1: 8_000_000 }, 2026, 10);
  const prof17 = { year: 2026, costRatio: 45 as const, status: 'mellekallasu' as const, guaranteedMinimum: false, kedvezmenyek: k };
  const r = calculateYear({ profile: prof17, revenue: items, asOf: '2026-12-31' });
  it('advances 369 480 (Q1) vs the year SZJA 15 % × (2 463 200 − 4 × 133 340) = 289 476 → 80 004 comes back', () => {
    expect(r.quarters.reduce((a, q) => a + q.szjaAdvanceHuf, 0)).toBe(369_480);
    expect(r.quarters[3]!.szjaCumulativeHuf).toBe(289_476);
    expect(yearEndSettlement(r).szjaRefundHuf).toBe(80_004);
  });
  it('the projection counts the year SZJA, not the advances', () => {
    const p = projectYear({ profile: prof17, revenue: items, asOf: '2026-12-31' });
    expect(p.refundHuf).toBeGreaterThanOrEqual(80_004);
    const plain = r.quarters.reduce((a, q) => a + q.totalHuf, 0);
    expect(p.taxesHuf).toBe(plain + p.hipaHuf - p.refundHuf);
  });
});


// k6c2: the unused családi kedvezmény (possible year-end csjk) is staff information – never in a client-facing refund.
describe('year-end settlement: the client refund is the overpaid SZJA only', () => {
  it('csjkYearEndHuf may be > 0, totalHuf = szjaRefundHuf', () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const k = { birthMonth: '1990-05', anyak: { jogcim: 'ket' as const, months: all }, csaladi: { months: all.map((month) => ({ month, eltartott: 2, children: [{}, {}] })), csjkInYear: false } };
    const r = calculateYear({ profile: { year: 2026, costRatio: 45, status: 'mellekallasu', guaranteedMinimum: false, kedvezmenyek: k }, revenue: monthly({ 1: 600_000, 2: 600_000, 3: 600_000, 4: 600_000, 5: 600_000, 6: 600_000, 7: 600_000, 8: 600_000, 9: 600_000, 10: 600_000, 11: 600_000 }, 2026, 10), asOf: '2026-12-31' });
    const s = yearEndSettlement(r);
    expect(s.totalHuf).toBe(s.szjaRefundHuf);
    expect(s.csjkYearEndHuf).toBeGreaterThan(0);
    const p = projectYear({ profile: { year: 2026, costRatio: 45, status: 'mellekallasu', guaranteedMinimum: false, kedvezmenyek: k }, revenue: [], asOf: '2026-11-20' });
    expect(p.refundHuf).toBe(0);
  });
});

// k6c3 (2026-11-20): an allowance (anyák + családi 2/2 with in-year csjk) approved after Q1–Q3 were approved and paid
// without it. The projection keeps the approved quarters as approved (no hypothetical Q1–Q3 csjk of 532 689 Ft); only
// the overpaid SZJA comes back. Hand calculation: Q1–Q3 approved 1 197 168 + Q4 with the projected income (csjk
// 59 718 in all three months → TB 0) szocho 125 892 + HIPA 50 000 − SZJA refund 282 030 = 1 091 030.
describe('E6 projection with approved quarters (Kata, k6c3)', () => {
  const mm = (m: number) => String(m).padStart(2, '0');
  const rev: [number, number][] = [[1, 610_000], [2, 540_000], [3, 720_000], [4, 880_000], [5, 760_000], [6, 940_000], [7, 820_000], [8, 650_000], [9, 1_020_000], [10, 900_000], [11, 402_000]];
  const revenue = rev.map(([m, a]) => ({ receivedOn: `2026-${mm(m)}-10`, deliveryDate: `2026-${mm(m)}-10`, amountHuf: a, countsForAtalany: true, countsForAfaLimit: true }));
  const base = { year: 2026, costRatio: 45 as const, status: 'fofoglalkozasu' as const, guaranteedMinimum: false, hipa: { method: 'savos' as const, ratePct: 2 } };
  const kedvezmenyek = { birthMonth: '1990-05', anyak: { jogcim: 'ket' as const, months: ALL }, csaladi: { months: ALL.map((month) => ({ month, eltartott: 2, children: [{}, {}] })), csjkInYear: true } };
  const no = calculateYear({ profile: base, revenue, asOf: '2026-11-20' });
  const approved: Record<string, { tbHuf: number; szochoHuf: number; szjaHuf: number }> = {};
  for (const q of no.quarters.slice(0, 3)) approved[q.periodKey] = { tbHuf: q.tbHuf, szochoHuf: q.szochoHuf, szjaHuf: q.szjaAdvanceHuf };
  const approvedQuarters = no.quarters.slice(0, 3).map((q) => ({ quarter: q.quarter, baseSumHuf: q.months.reduce((a, m) => a + m.baseHuf, 0), szjaAdvanceHuf: q.szjaAdvanceHuf, revenueHuf: q.revenueHuf }));
  const input = { profile: { ...base, kedvezmenyek }, revenue, asOf: '2026-11-20', approvedQuarters };
  it('the year-to-date basis: Q1–Q3 approved 1 197 168, refund 282 030, Jan–Nov tax 1 097 174', () => {
    const r = calculateYear(input);
    const e = earningsByMonth(r, { hipaAnnualHuf: r.hipa!.annualHuf, approved });
    const refund = yearEndSettlement(r, approved).szjaRefundHuf;
    expect(Object.values(approved).reduce((a, x) => a + x.tbHuf + x.szochoHuf + x.szjaHuf, 0)).toBe(1_197_168);
    expect(refund).toBe(282_030);
    expect(e.filter((m) => m.month <= 11).reduce((a, m) => a + m.szjaHuf + m.tbHuf + m.szochoHuf + m.hipaHuf, 0) - refund).toBe(1_097_174);
  });
  it('the projection: kb. 1 090 000 Ft tax, kb. 8 190 000 Ft left (not 560 000 / 8 730 000)', () => {
    const p = projectYear(input, { approved });
    expect(p).toMatchObject({ revenueHuf: 9_284_969, hipaHuf: 50_000, refundHuf: 282_030, taxesHuf: 1_091_030 });
    expect(p.netHuf).toBe(9_284_969 - 1_091_030);
    // without the approved map the engine re-computes Q1–Q3 with the csjk: 532 689 Ft lower – the k6c3 blocker
    expect(projectYear(input).taxesHuf).toBe(558_341);
  });
});
