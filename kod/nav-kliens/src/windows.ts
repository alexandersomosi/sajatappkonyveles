// Query windows: NAV allows at most 35 days (840 hours) between from and to in queryInvoiceDigest
// (error BAD_QUERY_PARAM_RANGE_EXCEEDED). We stay strictly inside the limit.
import { NavError } from './errors.js';
import { assertIsoDate, assertIsoTimestamp } from './validate.js';

const DAY_MS = 86_400_000;
export const MAX_WINDOW_DAYS = 35;

function dayNumber(isoDate: string): number {
  return Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10))) / DAY_MS;
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Days between two YYYY-MM-DD dates (to − from). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(isoDate: string, days: number): string {
  return fromDayNumber(dayNumber(isoDate) + days);
}

/**
 * Inclusive date windows [from, to], each covering at most `maxDays` calendar days
 * (so dateTo − dateFrom ≤ maxDays − 1 < 35).
 */
export function splitDateWindows(from: string, to: string, maxDays = MAX_WINDOW_DAYS): { from: string; to: string }[] {
  assertIsoDate(from, 'from');
  assertIsoDate(to, 'to');
  if (maxDays < 1) throw new RangeError('maxDays must be ≥ 1');
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a > b) return [];
  const out: { from: string; to: string }[] = [];
  for (let s = a; s <= b; s += maxDays) {
    out.push({ from: fromDayNumber(s), to: fromDayNumber(Math.min(s + maxDays - 1, b)) });
  }
  return out;
}

/**
 * Consecutive, non-overlapping timestamp windows; each spans < 35 days.
 * next.from = previous.to + 1 ms (NAV timestamps have millisecond precision).
 */
export function splitTimeWindows(fromIso: string, toIso: string, maxMs = MAX_WINDOW_DAYS * DAY_MS - 1): { from: string; to: string }[] {
  assertIsoTimestamp(fromIso, 'from');
  assertIsoTimestamp(toIso, 'to');
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (a > b) return [];
  const out: { from: string; to: string }[] = [];
  for (let s = a; s <= b; s += maxMs + 1) {
    out.push({ from: new Date(s).toISOString(), to: new Date(Math.min(s + maxMs, b)).toISOString() });
  }
  return out;
}

/** Throws INVALID_INPUT if a single query window breaks NAV's rules (from > to, or > 35 days). */
export function assertQueryWindow(kind: 'date' | 'time', from: string, to: string): void {
  if (kind === 'date') {
    assertIsoDate(from, 'issueDate.from');
    assertIsoDate(to, 'issueDate.to');
    const d = daysBetween(from, to);
    if (d < 0 || d > MAX_WINDOW_DAYS) {
      throw new NavError({ code: 'INVALID_INPUT', navMessage: 'issueDate window must be 0–35 days, from ≤ to' });
    }
  } else {
    assertIsoTimestamp(from, 'insDate.from');
    assertIsoTimestamp(to, 'insDate.to');
    const d = Date.parse(to) - Date.parse(from);
    if (d < 0 || d > MAX_WINDOW_DAYS * DAY_MS) {
      throw new NavError({ code: 'INVALID_INPUT', navMessage: 'insDate window must be 0–840 hours, from ≤ to' });
    }
  }
}

const budapestFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Budapest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Business date in Europe/Budapest (SPEC §3.5), "YYYY-MM-DD". */
export function budapestDate(d: Date): string {
  return budapestFmt.format(d);
}
