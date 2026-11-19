// SPEC §28.1 – "Ennyit tegyél félre" and §28.4 – "Mennyit kerestem?". Pure functions on top of calculateYear.
//
// Reserve of an invoice = how much it adds to the year's SZJA + TB (after csjk) + szocho: L(items ≤ i) − L(items < i),
// items in arrival order. Telescoping: Σ raw + L(∅) = L(all). The fixed minimum L(∅) and HIPA are never put on an
// invoice (home-card lines). Positive reserves round UP to 1 000 Ft, storno reserves towards zero.

import { rulesForYear } from '../rules/index.js';
import type {
  ApprovedQuarterActual,
  EngineWarning,
  MonthLine,
  RevenueItemInput,
  TaxProfileInput,
  YearInput,
  YearResult,
} from '../types.js';
import { addDays, dayNumber, daysInMonth, maxDate, monthOf, quarterOfMonth, toIso } from '../util/dates.js';
import { roundDiv } from '../util/math.js';
import { calculateYear } from './year.js';

export type ReserveZone = 'adomentes' | 'nem_novel' | 'csak_szja' | 'teljes' | 'kedvezmeny' | 'sztorno' | 'nincs_adat';

export interface ReserveItemInput extends RevenueItemInput {
  id: string;
  /** Sortable arrival key: ISO created_at + id. */
  arrivalKey: string;
}

export interface ReserveLine {
  id: string;
  /** 1-based arrival position in the year. */
  seq: number;
  rawHuf: number;
  reserveHuf: number;
  szjaHuf: number;
  tbHuf: number;
  szochoHuf: number;
  zone: ReserveZone;
  crossesTaxFree: boolean;
  estimated: boolean;
}

export interface ReserveSeries {
  year: number;
  /** L(∅): the fixed minimum of the year (0 for mellékállású and nyugdíjas). */
  baseHuf: number;
  /** L(all) */
  totalHuf: number;
  /** Per month 1..12 (index 0 = January) of the empty-year run: TB + szocho of the fixed minimum (0 when none). */
  fixedByMonthHuf: number[];
  lines: ReserveLine[];
  warnings: EngineWarning[];
}

export const RESERVE_ROUND_HUF = 1_000;

/** SPEC §28.1.2 rule 5. */
export function roundReserve(raw: number): number {
  if (raw > 0) return Math.ceil(raw / RESERVE_ROUND_HUF) * RESERVE_ROUND_HUF;
  if (raw < 0) {
    const v = Math.floor(-raw / RESERVE_ROUND_HUF) * RESERVE_ROUND_HUF;
    return v === 0 ? 0 : -v;
  }
  return 0;
}

interface LValue {
  total: number;
  szja: number;
  tb: number;
  szocho: number;
  income: number;
  result: YearResult;
}

function lOf(result: YearResult): LValue {
  let szja = 0;
  let tb = 0;
  let szocho = 0;
  for (const q of result.quarters) {
    szja += q.szjaAdvanceHuf;
    tb += q.tbHuf;
    szocho += q.szochoHuf;
  }
  return { total: szja + tb + szocho, szja, tb, szocho, income: result.incomeYtdHuf ?? 0, result };
}

/** One whole-year run on per-month buckets (index 1..12). Synthetic items on the month's last day. */
function runBuckets(profile: TaxProfileInput, buckets: readonly number[], approvedQuarters?: ApprovedQuarterActual[]): LValue {
  const y = profile.year;
  const revenue: RevenueItemInput[] = [];
  for (let m = 1; m <= 12; m++) {
    const a = buckets[m] ?? 0;
    if (a === 0) continue;
    const d = toIso(y, m, daysInMonth(y, m));
    revenue.push({ receivedOn: d, deliveryDate: d, amountHuf: a, countsForAtalany: true, countsForAfaLimit: false });
  }
  const input: YearInput = { profile, revenue, asOf: toIso(y, 12, 31), ...(approvedQuarters?.length ? { approvedQuarters } : {}) };
  return lOf(calculateYear(input));
}

function zoneOf(raw: number, d: { szja: number; tb: number; szocho: number }, incomeAfter: number, taxFree: number): ReserveZone {
  if (raw < 0) return 'sztorno';
  if (raw === 0) return incomeAfter <= taxFree ? 'adomentes' : 'nem_novel';
  if (d.szja > 0) return d.tb + d.szocho > 0 ? 'teljes' : 'csak_szja';
  return 'kedvezmeny';
}

/**
 * SPEC §28.1.3. `items`: the year's revenue items (receivedOn in `profile.year`; others are ignored); the order of
 * `lines` = arrival order. n + 1 (+ one per estimated item) cheap engine runs on per-month buckets.
 */
export function reserveSeries(profile: TaxProfileInput, items: ReserveItemInput[], opts: { approvedQuarters?: ApprovedQuarterActual[] } = {}): ReserveSeries {
  const year = profile.year;
  const rules = rulesForYear(year);
  const yearStart = toIso(year, 1, 1);
  const yearEnd = toIso(year, 12, 31);
  const start = profile.atalanyFrom ? maxDate(profile.atalanyFrom, yearStart) : yearStart;
  const aq = opts.approvedQuarters;
  const sorted = items
    .filter((i) => i.receivedOn >= yearStart && i.receivedOn <= yearEnd)
    .slice()
    .sort((a, b) => (a.arrivalKey < b.arrivalKey ? -1 : a.arrivalKey > b.arrivalKey ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const buckets = new Array<number>(13).fill(0);
  const empty = runBuckets(profile, buckets, aq);
  const fixedByMonthHuf = new Array<number>(12).fill(0);
  for (const q of empty.result.quarters) for (const m of q.months) fixedByMonthHuf[m.month - 1] = m.tbHuf - (m.csjkHuf ?? 0) + m.szochoHuf;

  const taxFree = rules?.taxFreeIncomeHuf ?? 0;
  const lines: ReserveLine[] = [];
  let prev = empty;
  let seq = 0;
  for (const it of sorted) {
    seq++;
    const counts = it.countsForAtalany && it.receivedOn >= start && it.amountHuf !== 0;
    if (!counts) {
      lines.push({ id: it.id, seq, rawHuf: 0, reserveHuf: 0, szjaHuf: 0, tbHuf: 0, szochoHuf: 0, zone: zoneOf(0, prev, prev.income, taxFree), crossesTaxFree: false, estimated: !!it.estimated });
      continue;
    }
    const m = monthOf(it.receivedOn);
    buckets[m]! += it.amountHuf;
    const next = runBuckets(profile, buckets, aq);
    let d = { raw: next.total - prev.total, szja: next.szja - prev.szja, tb: next.tb - prev.tb, szocho: next.szocho - prev.szocho };
    // SPEC §28.1.2 rule 4: an estimated receipt (the payment deadline) is also tried in the next quarter; the larger wins.
    if (it.estimated) {
      const q = quarterOfMonth(m);
      if (q < 4) {
        const shifted = q * 3 + 1;
        const alt = buckets.slice();
        alt[m]! -= it.amountHuf;
        alt[shifted]! += it.amountHuf;
        const a = runBuckets(profile, alt, aq);
        const ad = { raw: a.total - prev.total, szja: a.szja - prev.szja, tb: a.tb - prev.tb, szocho: a.szocho - prev.szocho };
        if (ad.raw > d.raw) d = ad;
      }
    }
    lines.push({
      id: it.id,
      seq,
      rawHuf: d.raw,
      reserveHuf: roundReserve(d.raw),
      szjaHuf: d.szja,
      tbHuf: d.tb,
      szochoHuf: d.szocho,
      zone: zoneOf(d.raw, d, next.income, taxFree),
      crossesTaxFree: prev.income <= taxFree && next.income > taxFree,
      estimated: !!it.estimated,
    });
    prev = next;
  }
  return { year, baseHuf: empty.total, totalHuf: prev.total, fixedByMonthHuf, lines, warnings: prev.result.warnings };
}

// ---------------------------------------------------------------------------------------------------------------------
// SPEC §28.4 "Mennyit kerestem?"

export interface EarningsMonthEngine {
  month: number;
  revenueHuf: number;
  szjaHuf: number;
  /** TB after csjk. */
  tbHuf: number;
  szochoHuf: number;
  csjkHuf: number;
  hipaHuf: number;
  netHuf: number;
  future: boolean;
}

/** Cumulative-rounding split of `amount` by non-negative weights (the parts sum exactly to `amount`). */
export function splitByWeights(amount: number, weights: readonly number[]): number[] {
  const w = weights.map((x) => Math.max(0, x));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  const out: number[] = [];
  let cum = 0;
  let prev = 0;
  for (const x of w) {
    cum += x;
    const c = roundDiv(amount * cum, total);
    out.push(c - prev);
    prev = c;
  }
  return out;
}

function evenly(amount: number, n: number): number[] {
  return splitByWeights(amount, new Array<number>(n).fill(1));
}

/**
 * SPEC §28.4.2. Monthly attribution of the year's taxes: every tax goes to the month whose own income caused it.
 *  - SZJA: the quarter's advance by the months' taxable part after the month-bound exemptions (B2);
 *  - TB (after csjk) and szocho: the fixed minimum of a főfoglalkozású month stays in that month; the rest of the
 *    quarter (the göngyölített base above the minimum) goes to the months by their own taxable part. So the income of
 *    October and November carries its járulék even while December is still to come (round 2 of 2026-11-19: the even
 *    spread put a third of it on the future December, and "eddig" was too low);
 *  - HIPA: the year amount by the active days of each month (the same basis everywhere, card included).
 * `approved` (periodKey → the approved parts of an approved quarter) replaces the engine's quarter parts, spread in
 * the engine's proportions.
 */
export function earningsByMonth(
  year: YearResult,
  o: { hipaAnnualHuf: number | null; approved?: Record<string, { tbHuf: number; szochoHuf: number; szjaHuf: number }> },
): EarningsMonthEngine[] {
  const y = year.year ?? Number(year.asOf.slice(0, 4));
  const rules = rulesForYear(y);
  const ratio = year.costRatioUsed ?? 45;
  const taxFree = rules?.taxFreeIncomeHuf ?? 0;
  const tbPermille = rules?.tbPermille ?? 185;
  const szPermille = rules?.szochoPermille ?? 130;
  const szMinPct = rules?.szochoMinimumPct ?? 100;
  // taxable part per month (T) and the SZJA base after the month-bound exemptions (B2)
  const R = new Array<number>(13).fill(0);
  for (const r of year.revenueByMonth) R[r.month] = r.amountHuf;
  const I = R.map((r) => roundDiv(r * (100 - ratio), 100));
  const T = new Array<number>(13).fill(0);
  let c = 0;
  for (let m = 1; m <= 12; m++) {
    const p = c;
    c += I[m]!;
    T[m] = Math.max(0, c - taxFree) - Math.max(0, p - taxFree);
  }
  const B2 = T.slice();
  for (const q of year.quarters) for (const l of q.months) if (l.taxableHuf !== undefined) B2[l.month] = l.taxableHuf - (l.exemptHuf ?? 0);

  const out: EarningsMonthEngine[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenueHuf: R[i + 1]!,
    szjaHuf: 0,
    tbHuf: 0,
    szochoHuf: 0,
    csjkHuf: 0,
    hipaHuf: 0,
    netHuf: 0,
    future: toIso(y, i + 1, 1) > year.asOf,
  }));

  for (const q of year.quarters) {
    const ms = q.months;
    const idx = ms.map((l) => l.month - 1);
    const active = ms.map((l) => (year.activeMonths ? year.activeMonths.includes(l.month) : true));
    const activeIdx = active.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    const insuredIdx = ms.map((l, i) => (l.insured ? i : -1)).filter((i) => i >= 0);
    const pastIdx = (mask: number[]) => mask.filter((i) => !ms[i]!.future);
    const spreadEvenOver = (amount: number, mask: number[]): number[] => {
      const past = pastIdx(mask);
      const use = past.length ? past : mask.length ? mask : ms.map((_, i) => i);
      const parts = evenly(amount, use.length);
      const res = new Array<number>(ms.length).fill(0);
      use.forEach((i, k) => (res[i] = parts[k]!));
      return res;
    };
    // TB / szocho by own month: the fixed minimum where it applies, the rest by the months' taxable part
    const weights = ms.map((l) => T[l.month]!);
    const own = (lineAmount: (l: MonthLine) => number, fixedOf: (l: MonthLine) => number): number[] => {
      const fixed = ms.map((l) => (l.insured ? Math.min(lineAmount(l), fixedOf(l)) : 0));
      const rest = ms.reduce((a, l, i) => a + lineAmount(l) - fixed[i]!, 0);
      const restParts = rest === 0 ? ms.map(() => 0) : weights.some((w) => w > 0) ? splitByWeights(rest, weights) : spreadEvenOver(rest, insuredIdx);
      return fixed.map((f, i) => f + restParts[i]!);
    };
    const tbGrossOwn = own(
      (l) => l.tbHuf,
      (l) => (l.minimumHuf !== null ? permille(l.minimumHuf, tbPermille) : 0),
    );
    const szEng = own(
      (l) => l.szochoHuf,
      (l) => (l.minimumHuf !== null ? permille(roundDiv(l.minimumHuf * szMinPct, 100), szPermille) : 0),
    );
    // TB after csjk: the quarter's net TB in the proportions of the gross attribution (sums stay exact)
    const tbNet = ms.reduce((a, l) => a + l.tbHuf - (l.csjkHuf ?? 0), 0);
    const tbEng = tbNet === 0 ? ms.map(() => 0) : tbGrossOwn.some((x) => x > 0) ? splitByWeights(tbNet, tbGrossOwn) : spreadEvenOver(tbNet, insuredIdx);
    let szjaEng = splitByWeights(q.szjaAdvanceHuf, ms.map((l) => B2[l.month]!));
    if (q.szjaAdvanceHuf > 0 && szjaEng.every((x) => x === 0)) szjaEng = spreadEvenOver(q.szjaAdvanceHuf, activeIdx);
    let tbM = tbEng;
    let szM = szEng;
    let szjaM = szjaEng;
    const ap = o.approved?.[q.periodKey];
    if (ap) {
      const scale = (target: number, eng: number[], fallbackMask: number[]) =>
        eng.some((x) => x > 0) ? splitByWeights(target, eng) : target > 0 ? spreadEvenOver(target, fallbackMask) : eng.map(() => 0);
      tbM = scale(ap.tbHuf, tbEng, insuredIdx);
      szM = scale(ap.szochoHuf, szEng, insuredIdx);
      szjaM = scale(ap.szjaHuf, szjaEng, activeIdx);
    }
    idx.forEach((i, k) => {
      const row = out[i]!;
      row.tbHuf = tbM[k]!;
      row.szochoHuf = szM[k]!;
      row.szjaHuf = szjaM[k]!;
      row.csjkHuf = ms[k]!.csjkHuf ?? 0;
      if (ms[k]!.future) row.future = true;
    });
  }

  // HIPA: the year amount by the active days of each month (cumulative rounding).
  const hipa = hipaByMonth(year, o.hipaAnnualHuf ?? 0);
  hipa.forEach((h, i) => (out[i]!.hipaHuf = h));
  for (const row of out) row.netHuf = row.revenueHuf - row.szjaHuf - row.tbHuf - row.szochoHuf - row.hipaHuf;
  return out;
}

const permille = (base: number, p: number) => roundDiv(base * p, 1000);

/** The HIPA of the year spread over the months by active days (index 0 = January); sums exactly to `annual`. */
export function hipaByMonth(year: YearResult, annual: number): number[] {
  const days =
    year.activeDaysByMonth ??
    Array.from({ length: 12 }, (_, i) => ((year.activeMonths ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).includes(i + 1) ? 1 : 0));
  if (annual === 0 || days.every((d) => d <= 0)) return new Array<number>(12).fill(0);
  return splitByWeights(annual, days);
}

export interface YearEndSettlement {
  /** Σ SZJA advances (approved where approved) − the year's SZJA (the last quarter's cumulative): returned in the annual return. */
  szjaRefundHuf: number;
  /** The fel nem használt családi kedvezmény turned into családi járulékkedvezmény in the annual return (estimate). */
  csjkYearEndHuf: number;
  totalHuf: number;
}

/**
 * SPEC §28.4 (round 2 of 2026-11-19): the quarterly SZJA advances never go below 0, so after a late allowance (or a
 * front-loaded year) their sum can exceed the year's SZJA; the difference comes back in the annual return. The
 * unused családi kedvezmény may also become a járulékkedvezmény there. Both are estimates for the year so far.
 */
export function yearEndSettlement(year: YearResult, approved?: Record<string, { szjaHuf: number }>): YearEndSettlement {
  const last = year.quarters.at(-1);
  if (!last) return { szjaRefundHuf: 0, csjkYearEndHuf: 0, totalHuf: 0 };
  const paid = year.quarters.reduce((a, q) => a + (approved?.[q.periodKey]?.szjaHuf ?? q.szjaAdvanceHuf), 0);
  const szjaRefundHuf = Math.max(0, paid - (last.szjaCumulativeHuf ?? paid));
  const csjkYearEndHuf = Math.max(0, year.allowances?.annualCsjkPotentialHuf ?? 0);
  return { szjaRefundHuf, csjkYearEndHuf, totalHuf: szjaRefundHuf + csjkYearEndHuf };
}

export interface YearProjection {
  reliable: boolean;
  revenueHuf: number;
  /** SZJA + TB (after csjk) + szocho + HIPA of the projected year, after the year-end settlement (the year's real tax). */
  taxesHuf: number;
  hipaHuf: number;
  netHuf: number;
  /** Comes back in the annual return (overpaid SZJA advances + year-end csjk); already deducted from taxesHuf. */
  refundHuf: number;
}

/**
 * SPEC §28.4.3. The meters' linear projection of the revenue; the rest is spread over the remaining active days (one
 * synthetic item per month on the 15th, or asOf + 1 in the current month) and the whole year is computed once.
 */
export function projectYear(input: YearInput): YearProjection {
  const r = calculateYear(input);
  const y = input.profile.year;
  const rules = rulesForYear(y);
  const minDays = rules?.projectionMinDays ?? 60;
  const reliable = (r.elapsedActiveDays ?? 0) >= minDays;
  const projected = r.meters.atalanyCap.projectedHuf;
  const used = r.meters.atalanyCap.usedHuf;
  const remainder = Math.max(0, projected - used);
  const yearEnd = toIso(y, 12, 31);
  const yearStart = toIso(y, 1, 1);
  const start = input.profile.atalanyFrom ? maxDate(input.profile.atalanyFrom, yearStart) : yearStart;
  const susp = (input.profile.insuranceBreaks ?? []).filter((b) => b.kind === 'szunetel').map((b) => [dayNumber(b.from), dayNumber(b.to)] as const);
  const activeDay = (n: number) => n >= dayNumber(start) && !susp.some(([a, b]) => n >= a && n <= b);
  const asOfN = dayNumber(input.asOf < yearStart ? addDays(yearStart, -1) : input.asOf);
  const daysPerMonth: { m: number; days: number; date: string }[] = [];
  for (let m = 1; m <= 12; m++) {
    const first = dayNumber(toIso(y, m, 1));
    let days = 0;
    for (let i = 0; i < daysInMonth(y, m); i++) {
      const n = first + i;
      if (n > asOfN && activeDay(n)) days++;
    }
    if (days === 0) continue;
    const mid = toIso(y, m, 15);
    const after = addDays(input.asOf, 1);
    const date = monthOf(after) === m && after.slice(0, 4) === String(y) && mid <= input.asOf ? after : mid;
    daysPerMonth.push({ m, days, date });
  }
  const shares = splitByWeights(remainder, daysPerMonth.map((d) => d.days));
  const actual = input.revenue.filter((i) => i.receivedOn <= input.asOf);
  const synthetic: RevenueItemInput[] = daysPerMonth
    .map((d, k) => ({ receivedOn: d.date, deliveryDate: d.date, amountHuf: shares[k]!, countsForAtalany: true, countsForAfaLimit: true }))
    .filter((i) => i.amountHuf !== 0);
  const full = calculateYear({ ...input, revenue: [...actual, ...synthetic], asOf: yearEnd });
  const l = lOf(full);
  const hipa = full.hipa?.annualHuf ?? 0;
  const refund = yearEndSettlement(full).totalHuf;
  const taxes = l.total + hipa - refund;
  return { reliable, revenueHuf: projected, taxesHuf: taxes, hipaHuf: hipa, netHuf: projected - taxes, refundHuf: refund };
}
