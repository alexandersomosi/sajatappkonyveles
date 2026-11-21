// SPEC §32 – KATA (kisadózó vállalkozások tételes adója): the liable months, the keret meter and the deadlines.
// Pure, integer forint, no I/O. Every rule names its paragraph of the Kata tv. (2022. évi XIII. törvény, njt text
// checked 2026-11-21) – the KataRules object of the year holds the numbers.
//
//  - 7. § (1)–(3): a fixed amount for every STARTED month of the KATA, due by the 12th of the next month.
//  - 7. § (8): no tax for a month whose EVERY day the kisadózó is on a)–c) benefit / service / detention or d) suspends
//    the activity – unless he works in it, especially if he has revenue in that period.
//  - 7. § (9): nor for the month in which an a)–c) state ENDS, if the state lasted at least 30 days; the days of the
//    months already free under (8) are not counted.
//  - 7. § (4)–(5): keret 18 M Ft, or liable months × 1.5 M Ft for a part year; 40 % különadó above it.
//  - 7. § (10): an a)–c) free month must be reported by the 12th of the next month (not for szünetelés).
// The app never decides a free month by itself: the accountant records the states (SPEC §32, [DÁVID D21]).

import { nextWorkingDay } from '../calendar.js';
import type { KataRules } from '../rules/types.js';
import type { ISODate } from '../types.js';
import { addDays, dayNumber, daysInMonth, daysInclusive, fromDayNumber, isIsoDate, maxDate, minDate, toIso } from '../util/dates.js';
import { permilleOf, roundDiv } from '../util/math.js';

/**
 * Kata tv. 7. § (8) a)–d). a): táppénz (baleseti táppénz too), CSED, örökbefogadói díj, GYED, GYES (gyermekgondozást
 * segítő ellátás), GYET (gyermeknevelési támogatás), GYOD (gyermekek otthongondozási díja), ápolási díj; b) önkéntes
 * tartalékos katonai szolgálat; c) fogvatartott; d) szünetelés.
 */
export const KATA_EXEMPT_REASONS = ['tappenz', 'csed', 'orokbefogadoi_dij', 'gyed', 'gyes', 'gyet', 'gyod', 'apolasi_dij', 'tartalekos', 'fogvatartott', 'szunetel'] as const;
export type KataExemptReason = (typeof KATA_EXEMPT_REASONS)[number];

/** a)–c) states: the 30-day closing-month rule applies (7. § (9)) and the free month must be reported (7. § (10)). */
export function kataReasonNeedsReport(r: KataExemptReason): boolean {
  return r !== 'szunetel';
}

export interface KataBreakInput {
  from: ISODate;
  /** inclusive */
  to: ISODate;
  kind: KataExemptReason;
}

export interface KataRevenueInput {
  /** Pénzforgalmi nap. */
  receivedOn: ISODate;
  amountHuf: number;
}

export interface KataMonthsInput {
  year: number;
  /** First day of the KATA (default: 1 January). */
  kataFrom?: ISODate | null;
  /** Last day of the KATA (default: 31 December). */
  kataTo?: ISODate | null;
  breaks?: readonly KataBreakInput[];
  revenue?: readonly KataRevenueInput[];
  /** The monthly amount (kataMonthlyHuf); null = not known / not confirmed → amountHuf null on liable months. */
  monthlyHuf: number | null;
}

export interface KataMonth {
  month: number;
  /** 'YYYY-MM' */
  monthKey: string;
  /** 'YYYY-MM-KATA' – the tax_periods key. */
  periodKey: string;
  liable: boolean;
  /** The state that makes (or would make) the month free; null when no state covers it. */
  exemptReason: KataExemptReason | null;
  /** Free by the state, but revenue arrived in the month → liable after all (7. § (8) closing words). */
  exemptLostByRevenue: boolean;
  /** Free under 7. § (9) (the month the state ended), not under (8). */
  closingMonthRule: boolean;
  revenueInMonthHuf: number;
  /** liable → the monthly amount (null when unknown); free → 0. */
  amountHuf: number | null;
  dueDate: ISODate;
}

/** The amount of one month for a variant: null for a draft rule set unless allowDraft, and when the account is unknown. */
export function kataMonthlyHuf(rules: KataRules, o: { fofoglalkozasu?: boolean | null; allowDraft?: boolean } = {}): number | null {
  if (rules.draft && !o.allowDraft) return null;
  if (!rules.account) return null;
  if (rules.variant === 'uj') {
    if (o.fofoglalkozasu === true) return rules.monthlyHuf;
    if (o.fofoglalkozasu === false) return rules.monthlyNotMainHuf ?? null;
    return null;
  }
  return rules.monthlyHuf;
}

/** Due date of one month's tax: the dueDay of the next month, moved to the next working day (7. § (2)). */
export function kataDueDate(year: number, month: number, rules: Pick<KataRules, 'dueDay'>): ISODate {
  const y = month === 12 ? year + 1 : year;
  const m = month === 12 ? 1 : month + 1;
  return nextWorkingDay(toIso(y, m, rules.dueDay));
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  return { start: toIso(year, month, 1), end: toIso(year, month, daysInMonth(year, month)) };
}

function kataRange(input: Pick<KataMonthsInput, 'year' | 'kataFrom' | 'kataTo'>): { from: string; to: string } | null {
  const yStart = toIso(input.year, 1, 1);
  const yEnd = toIso(input.year, 12, 31);
  const from = input.kataFrom && isIsoDate(input.kataFrom) ? maxDate(input.kataFrom, yStart) : yStart;
  const to = input.kataTo && isIsoDate(input.kataTo) ? minDate(input.kataTo, yEnd) : yEnd;
  return from <= to ? { from, to } : null;
}

/** Day numbers covered by the breaks (valid ones only), with the kind of each day (the later break wins on overlap). */
function coverage(breaks: readonly KataBreakInput[]): Map<number, KataExemptReason> {
  const days = new Map<number, KataExemptReason>();
  for (const b of breaks) {
    if (!isIsoDate(b.from) || !isIsoDate(b.to) || b.from > b.to || !(KATA_EXEMPT_REASONS as readonly string[]).includes(b.kind)) continue;
    for (let d = dayNumber(b.from); d <= dayNumber(b.to); d++) days.set(d, b.kind);
  }
  return days;
}

/** true when every day of the calendar month is covered by some state (7. § (8): "amelyek egészében"). */
function fullyCovered(days: Map<number, KataExemptReason>, year: number, month: number): boolean {
  const { start, end } = monthBounds(year, month);
  for (let d = dayNumber(start); d <= dayNumber(end); d++) if (!days.has(d)) return false;
  return true;
}

/** The state covering most days of the month (ties: the first in KATA_EXEMPT_REASONS order). */
function dominantReason(days: Map<number, KataExemptReason>, year: number, month: number): KataExemptReason | null {
  const { start, end } = monthBounds(year, month);
  const count = new Map<KataExemptReason, number>();
  for (let d = dayNumber(start); d <= dayNumber(end); d++) {
    const k = days.get(d);
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  let best: KataExemptReason | null = null;
  for (const r of KATA_EXEMPT_REASONS) if ((count.get(r) ?? 0) > (best ? (count.get(best) ?? 0) : 0)) best = r;
  return best;
}

/**
 * 7. § (9): the months (as 'YYYY-MM') that are free because an a)–c) state ended in them after lasting ≥ exemptMinDays,
 * counting only the days that fall in months not already free under (8). Maps the month to the state's kind.
 */
function closingMonths(breaks: readonly KataBreakInput[], all: Map<number, KataExemptReason>, minDays: number): Map<string, KataExemptReason> {
  // contiguous runs of a)–c) days (szünetelés excluded)
  const ac = [...coverage(breaks.filter((b) => kataReasonNeedsReport(b.kind))).entries()].sort((a, b) => a[0] - b[0]);
  const out = new Map<string, KataExemptReason>();
  const freeByFull = new Map<string, boolean>();
  const isFullMonth = (dn: number) => {
    const iso = fromDayNumber(dn);
    const key = iso.slice(0, 7);
    let v = freeByFull.get(key);
    if (v === undefined) {
      v = fullyCovered(all, Number(iso.slice(0, 4)), Number(iso.slice(5, 7)));
      freeByFull.set(key, v);
    }
    return v;
  };
  let i = 0;
  while (i < ac.length) {
    let j = i;
    while (j + 1 < ac.length && ac[j + 1]![0] === ac[j]![0] + 1) j++;
    const [endDay, kind] = ac[j]!;
    let counted = 0;
    for (let k = i; k <= j; k++) if (!isFullMonth(ac[k]![0])) counted++;
    if (counted >= minDays && !isFullMonth(endDay)) out.set(fromDayNumber(endDay).slice(0, 7), kind);
    i = j + 1;
  }
  return out;
}

/**
 * The KATA months of a year (only the months of the KATA; a month the KATA starts or ends in counts as started).
 * Free months: (8) whole-month states, (9) the closing month; revenue in a free month makes it liable again.
 */
export function kataMonths(input: KataMonthsInput, rules: KataRules): KataMonth[] {
  const range = kataRange(input);
  if (!range) return [];
  const breaks = input.breaks ?? [];
  const all = coverage(breaks);
  const closing = closingMonths(breaks, all, rules.exemptMinDays);
  const revenueByMonth = new Map<string, number>();
  for (const r of input.revenue ?? []) {
    if (!isIsoDate(r.receivedOn) || !Number.isFinite(r.amountHuf)) continue;
    const k = r.receivedOn.slice(0, 7);
    revenueByMonth.set(k, (revenueByMonth.get(k) ?? 0) + Math.trunc(r.amountHuf));
  }
  const out: KataMonth[] = [];
  const firstMonth = Number(range.from.slice(5, 7));
  const lastMonth = Number(range.to.slice(5, 7));
  for (let m = firstMonth; m <= lastMonth; m++) {
    const monthKey = `${input.year}-${String(m).padStart(2, '0')}`;
    const full = fullyCovered(all, input.year, m);
    const closingKind = full ? undefined : closing.get(monthKey);
    const freeByState = full || closingKind !== undefined;
    const revenue = revenueByMonth.get(monthKey) ?? 0;
    const lost = freeByState && revenue > 0;
    const liable = !freeByState || lost;
    const exemptReason = full ? dominantReason(all, input.year, m) : (closingKind ?? null);
    out.push({
      month: m,
      monthKey,
      periodKey: `${monthKey}-KATA`,
      liable,
      exemptReason,
      exemptLostByRevenue: lost,
      closingMonthRule: closingKind !== undefined,
      revenueInMonthHuf: revenue,
      amountHuf: liable ? input.monthlyHuf : 0,
      dueDate: kataDueDate(input.year, m, rules),
    });
  }
  return out;
}

export type KataLimitLevel = 'rendben' | 'figyelem' | 'tullepve';

export interface KataLimitMeter {
  /** Revenue received in the KATA months up to asOf (pénzforgalmi). */
  usedHuf: number;
  /** The keret of the year: liable months × limitPerMonthHuf (≤ yearlyLimitHuf), or yearlyLimitHuf. */
  limitHuf: number;
  /** Liable months started on or before asOf. */
  liableMonthsSoFar: number;
  /** Months after asOf, liable unless a recorded state already frees them. */
  assumedFutureMonths: number;
  liableMonths: number;
  /** false when a part year's keret proration is not known (draft rules): limitHuf is then the yearly keret. */
  limitProrationKnown: boolean;
  projectedHuf: number;
  /** The projection is used only after projectionMinDays days of the KATA. */
  projectionReliable: boolean;
  ratio: number;
  level: KataLimitLevel;
  remainingHuf: number;
  overHuf: number;
  /** Over the keret by the year-end projection (0 when not over or the projection is not reliable). */
  projectedOverHuf: number;
  /** 40 % of overHuf (an estimate; the accountant files the '..KATA with the final number). */
  kulonadoEstimateHuf: number;
  /** When the különadó is due: 25 February next year, or kataTo + 30 days when the KATA ended during the year. */
  kulonadoDue: ISODate | null;
  draft: boolean;
}

export interface KataMeterOptions {
  year: number;
  kataFrom?: ISODate | null;
  kataTo?: ISODate | null;
  revenue: readonly KataRevenueInput[];
  asOf: ISODate;
  /** Default 0.8 (SPEC §28.K.11 amber from 80 %). */
  warnRatio?: number;
  /** Default 60 (the átalány meters' rule). */
  projectionMinDays?: number;
}

/** Kata tv. 7. § (4)–(6): the keret meter of the year as of a date. */
export function kataLimitMeter(months: readonly KataMonth[], o: KataMeterOptions, rules: KataRules): KataLimitMeter {
  const range = kataRange(o);
  const warnRatio = o.warnRatio ?? 0.8;
  const minDays = o.projectionMinDays ?? 60;
  const liable = months.filter((m) => m.liable);
  const asOfMonth = o.asOf.slice(0, 7);
  const liableMonthsSoFar = liable.filter((m) => m.monthKey <= asOfMonth).length;
  const assumedFutureMonths = liable.length - liableMonthsSoFar;
  const prorationKnown = rules.limitPerMonthHuf !== null;
  const limitHuf =
    liable.length >= 12 || rules.limitPerMonthHuf === null ? rules.yearlyLimitHuf : Math.min(rules.yearlyLimitHuf, Math.round(liable.length * rules.limitPerMonthHuf));
  let usedHuf = 0;
  if (range) {
    const until = minDate(range.to, o.asOf);
    for (const r of o.revenue) if (isIsoDate(r.receivedOn) && r.receivedOn >= range.from && r.receivedOn <= until) usedHuf += Math.trunc(r.amountHuf);
  }
  const activeDays = range ? daysInclusive(range.from, range.to) : 0;
  const elapsedDays = range ? daysInclusive(range.from, minDate(range.to, o.asOf)) : 0;
  const reliable = elapsedDays >= minDays && elapsedDays > 0;
  const projectedHuf = reliable && elapsedDays < activeDays ? roundDiv(usedHuf * activeDays, elapsedDays) : usedHuf;
  const overHuf = Math.max(0, usedHuf - limitHuf);
  const level: KataLimitLevel = usedHuf > limitHuf ? 'tullepve' : limitHuf > 0 && usedHuf >= limitHuf * warnRatio ? 'figyelem' : 'rendben';
  let kulonadoDue: ISODate | null = null;
  if (range) {
    const yEnd = toIso(o.year, 12, 31);
    if (o.kataTo && isIsoDate(o.kataTo) && o.kataTo < yEnd) kulonadoDue = nextWorkingDay(addDays(o.kataTo, rules.terminationDays));
    else if (rules.declarationDue) kulonadoDue = nextWorkingDay(toIso(o.year + 1, rules.declarationDue.month, rules.declarationDue.day));
  }
  return {
    usedHuf,
    limitHuf,
    liableMonthsSoFar,
    assumedFutureMonths,
    liableMonths: liable.length,
    limitProrationKnown: prorationKnown || liable.length >= 12,
    projectedHuf,
    projectionReliable: reliable,
    ratio: limitHuf > 0 ? Math.round((usedHuf / limitHuf) * 10_000) / 10_000 : 0,
    level,
    remainingHuf: Math.max(0, limitHuf - usedHuf),
    overHuf,
    projectedOverHuf: reliable ? Math.max(0, projectedHuf - limitHuf) : 0,
    kulonadoEstimateHuf: permilleOf(overHuf, rules.kulonadoPermille),
    kulonadoDue,
    draft: rules.draft,
  };
}

/** The due date of the yearly declaration ('26KATA): 25 February next year, or kataTo + 30 days (10. § (2)). null = unknown. */
export function kataDeclarationDue(year: number, kataTo: ISODate | null | undefined, rules: KataRules): ISODate | null {
  if (kataTo && isIsoDate(kataTo) && kataTo < toIso(year, 12, 31) && kataTo >= toIso(year, 1, 1)) return nextWorkingDay(addDays(kataTo, rules.terminationDays));
  return rules.declarationDue ? nextWorkingDay(toIso(year + 1, rules.declarationDue.month, rules.declarationDue.day)) : null;
}
