// k7c2 fix round (2026-11-20): an allowance approved after Q1–Q3 (T1) and the month-by-month TB after csjk (T2).
import { describe, expect, it } from 'vitest';
import { calculateYear, earningsByMonth, reserveSeries, yearEndSettlement } from '../src/index.js';
import { netOfOwnCsjk } from '../src/engine/reserve.js';
import { demoInput } from './helpers.js';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Réka (főfogl., 80 %, garantált bérminimum). Q1–Q3 approved WITHOUT any allowance: SZJA 0 / 0 / 139 380, base
// 3 × 1 119 600. On 11-20 Bence approves the családi kedvezmény for 1 child, Jan–Dec, csjk "igen". By hand: the Q4
// YTD base is below 12 × the frame, so the year's SZJA is 0 → the whole approved 139 380 comes back; saved 194 580.
describe('T1: an allowance approved after Q1–Q3 never puts csjk into the approved quarters', () => {
  const base = demoInput('reka', '2026-11-20');
  const no = calculateYear(base);
  const approvedQuarters = no.quarters.slice(0, 3).map((q) => ({ quarter: q.quarter, baseSumHuf: q.months.reduce((a, m) => a + m.baseHuf, 0), szjaAdvanceHuf: q.szjaAdvanceHuf, revenueHuf: q.revenueHuf, csjkHuf: 0 }));
  const approved: Record<string, { tbHuf: number; szochoHuf: number; szjaHuf: number }> = {};
  for (const q of no.quarters.slice(0, 3)) approved[q.periodKey] = { tbHuf: q.tbHuf, szochoHuf: q.szochoHuf, szjaHuf: q.szjaAdvanceHuf };
  const withK = (csjkInYear: boolean) => ({ birthMonth: '1988-03', csaladi: { months: ALL.map((month) => ({ month, eltartott: 1, children: [{}] })), csjkInYear } });

  it('the fixture is the reviewer’s case: SZJA 0 / 0 / 139 380, base 1 119 600 per quarter', () => {
    expect(no.quarters.slice(0, 3).map((q) => q.szjaAdvanceHuf)).toEqual([0, 0, 139_380]);
    expect(approvedQuarters.map((q) => q.baseSumHuf)).toEqual([1_119_600, 1_119_600, 1_119_600]);
  });

  it('csjk "igen": no phantom csjk in Q1–Q3; year SZJA 0; saved 194 580; refund 139 380 – the same as csjk "nem" (no paradox)', () => {
    for (const csjkInYear of [true, false]) {
      const r = calculateYear({ ...base, profile: { ...base.profile, kedvezmenyek: withK(csjkInYear) as never }, approvedQuarters });
      expect(r.quarters.slice(0, 3).flatMap((q) => q.months.map((m) => m.csjkHuf ?? 0))).toEqual(new Array(9).fill(0));
      expect(r.quarters[3]!.szjaCumulativeHuf).toBe(0);
      expect(r.allowances!.savedHuf).toBe(194_580);
      expect(yearEndSettlement(r, approved).szjaRefundHuf).toBe(139_380);
    }
  });

  it('every invoice reserve is 0 (the frame covers the base)', () => {
    const items = base.revenue.map((it, i) => ({ ...it, id: `r${i}`, arrivalKey: `${it.receivedOn}T00:00:00Z${String(i).padStart(3, '0')}` }));
    const s = reserveSeries({ ...base.profile, kedvezmenyek: withK(true) as never }, items, { approvedQuarters });
    const late = s.lines.filter((l) => {
      const it = items.find((x) => x.id === l.id)!;
      return it.receivedOn >= '2026-08-01' && it.receivedOn <= '2026-11-20';
    });
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((l) => l.reserveHuf === 0)).toBe(true);
  });

  it('an approval that DID contain csjk keeps it', () => {
    const k = withK(true);
    const r0 = calculateYear({ ...base, profile: { ...base.profile, kedvezmenyek: k as never } });
    const aq = r0.quarters.slice(0, 3).map((q) => ({ quarter: q.quarter, baseSumHuf: q.months.reduce((a, m) => a + m.baseHuf, 0), szjaAdvanceHuf: q.szjaAdvanceHuf, revenueHuf: q.revenueHuf, csjkHuf: q.csjkHuf ?? 0 }));
    const r = calculateYear({ ...base, profile: { ...base.profile, kedvezmenyek: k as never }, approvedQuarters: aq });
    expect(r.quarters.slice(0, 3).map((q) => q.csjkHuf)).toEqual(r0.quarters.slice(0, 3).map((q) => q.csjkHuf));
  });
});

// Kata (főfogl., 45 %, at the minimum; anyák 'ket' + családi 2 children with csjk), approved after Q1–Q3 (k6c3 case).
// By hand, Q4 TB after csjk per month: Oct 59 718 − 59 718 = 0, Nov 59 718 − 40 904 = 18 814, Dec 59 718 (no income yet).
describe('T2: the TB after csjk stays in the month that earned the csjk', () => {
  const mm = (m: number) => String(m).padStart(2, '0');
  const rev: [number, number][] = [[1, 610_000], [2, 540_000], [3, 720_000], [4, 880_000], [5, 760_000], [6, 940_000], [7, 820_000], [8, 650_000], [9, 1_020_000], [10, 900_000], [11, 402_000]];
  const revenue = rev.map(([m, a]) => ({ receivedOn: `2026-${mm(m)}-10`, deliveryDate: `2026-${mm(m)}-10`, amountHuf: a, countsForAtalany: true, countsForAfaLimit: true }));
  const base = { year: 2026, costRatio: 45 as const, status: 'fofoglalkozasu' as const, guaranteedMinimum: false, hipa: { method: 'savos' as const, ratePct: 2 } };
  const kedvezmenyek = { birthMonth: '1990-05', anyak: { jogcim: 'ket' as const, months: ALL }, csaladi: { months: ALL.map((month) => ({ month, eltartott: 2, children: [{}, {}] })), csjkInYear: true } };
  const no = calculateYear({ profile: base, revenue, asOf: '2026-11-20' });
  const approved: Record<string, { tbHuf: number; szochoHuf: number; szjaHuf: number }> = {};
  for (const q of no.quarters.slice(0, 3)) approved[q.periodKey] = { tbHuf: q.tbHuf, szochoHuf: q.szochoHuf, szjaHuf: q.szjaAdvanceHuf };
  const approvedQuarters = no.quarters.slice(0, 3).map((q) => ({ quarter: q.quarter, baseSumHuf: q.months.reduce((a, m) => a + m.baseHuf, 0), szjaAdvanceHuf: q.szjaAdvanceHuf, revenueHuf: q.revenueHuf }));
  const r = calculateYear({ profile: { ...base, kedvezmenyek }, revenue, asOf: '2026-11-20', approvedQuarters });
  const e = earningsByMonth(r, { hipaAnnualHuf: r.hipa!.annualHuf, approved });

  it('Q4 months: [0, 18 814, 59 718]', () => {
    expect(e.slice(9, 12).map((m) => m.tbHuf)).toEqual([0, 18_814, 59_718]);
  });
  it('Jan–Nov taxes 1 063 633 (was 1 097 174: 33 541 Ft of the October/November csjk sat on the future December)', () => {
    const refund = yearEndSettlement(r, approved).szjaRefundHuf;
    expect(e.filter((m) => m.month <= 11).reduce((a, m) => a + m.szjaHuf + m.tbHuf + m.szochoHuf + m.hipaHuf, 0) - refund).toBe(1_063_633);
  });
  it('netOfOwnCsjk: a negative month gives its excess to the others; the sum stays exact', () => {
    expect(netOfOwnCsjk([59_718, 59_718, 59_718], [59_718, 40_904, 0], 78_532)).toEqual([0, 18_814, 59_718]);
    const out = netOfOwnCsjk([10_000, 50_000, 40_000], [30_000, 0, 0], 70_000);
    expect(out[0]).toBe(0);
    expect(out.every((x) => x >= 0)).toBe(true);
    expect(out.reduce((a, b) => a + b, 0)).toBe(70_000);
  });
});
