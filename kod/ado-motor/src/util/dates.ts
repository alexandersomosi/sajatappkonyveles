// Calendar-date helpers on 'YYYY-MM-DD' strings. Dates are civil dates (no time zone): all
// arithmetic goes through Date.UTC so DST and the host time zone never matter.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface Ymd {
  y: number;
  m: number; // 1..12
  d: number;
}

/** Parses a strict 'YYYY-MM-DD' that is a real calendar date; undefined otherwise. */
export function parseIsoDate(s: unknown): Ymd | undefined {
  if (typeof s !== 'string') return undefined;
  const r = ISO_RE.exec(s);
  if (!r) return undefined;
  const y = Number(r[1]);
  const m = Number(r[2]);
  const d = Number(r[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return undefined;
  return { y, m, d };
}

export function isIsoDate(s: unknown): s is string {
  return parseIsoDate(s) !== undefined;
}

function must(s: string): Ymd {
  const p = parseIsoDate(s);
  if (!p) throw new RangeError(`not an ISO date: ${s}`);
  return p;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function daysInYear(y: number): number {
  return isLeapYear(y) ? 366 : 365;
}

export function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Day number since 1970-01-01 (UTC civil date). */
export function dayNumber(s: string): number {
  const p = must(s);
  return Date.UTC(p.y, p.m - 1, p.d) / DAY_MS;
}

export function fromDayNumber(n: number): string {
  const dt = new Date(n * DAY_MS);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(s: string, delta: number): string {
  return fromDayNumber(dayNumber(s) + delta);
}

/** Inclusive count of days from a to b (0 when b < a). */
export function daysInclusive(a: string, b: string): number {
  return Math.max(0, dayNumber(b) - dayNumber(a) + 1);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(s: string): number {
  const p = must(s);
  const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function yearOf(s: string): number {
  return must(s).y;
}

export function monthOf(s: string): number {
  return must(s).m;
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function quarterOfMonth(m: number): 1 | 2 | 3 | 4 {
  return (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

export function quarterStart(year: number, q: number): string {
  return toIso(year, (q - 1) * 3 + 1, 1);
}

export function quarterEnd(year: number, q: number): string {
  const m = q * 3;
  return toIso(year, m, daysInMonth(year, m));
}
