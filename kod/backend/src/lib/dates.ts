// Business dates are Europe/Budapest (SPEC §3.5). Plain 'YYYY-MM-DD' strings are calendar days;
// arithmetic on them is done in UTC to avoid DST effects.
const TZ = 'Europe/Budapest';

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

export interface BudapestParts {
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function budapestParts(d: Date): BudapestParts {
  const p: Record<string, string> = {};
  for (const x of partsFmt.formatToParts(d)) p[x.type] = x.value;
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    year,
    month,
    day,
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WD[p.weekday ?? 'Mon'] ?? 1,
  };
}

export function todayBudapest(now: Date): string {
  return budapestParts(now).date;
}

function toUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromUtc(toUtc(s)) === s;
}

export function addDays(dateStr: string, n: number): string {
  const d = toUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** Calendar month addition, clamped to the last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function weekdayOf(dateStr: string): number {
  return toUtc(dateStr).getUTCDay();
}

export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function isMonthKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function prevMonthKey(mk: string): string {
  return addMonths(`${mk}-01`, -1).slice(0, 7);
}

export function lastDayOfMonth(mk: string): string {
  return addDays(addMonths(`${mk}-01`, 1), -1);
}

/** The UTC instant of a Budapest local wall-clock time (handles CET/CEST). */
export function budapestLocalToUtc(dateStr: string, hhmm = '00:00'): Date {
  const [h, mi] = hhmm.split(':').map(Number) as [number, number];
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = budapestParts(new Date(guess));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const want = Date.UTC(y, m - 1, d, h, mi);
    const diff = want - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

export const MONTHS_HU = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
];
export const WEEKDAYS_HU = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
/** Adjectival month forms: "októberi", "szeptemberi". */
export const MONTHS_ADJ_HU = [
  'januári',
  'februári',
  'márciusi',
  'áprilisi',
  'májusi',
  'júniusi',
  'júliusi',
  'augusztusi',
  'szeptemberi',
  'októberi',
  'novemberi',
  'decemberi',
];

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('hu-HU') + s.slice(1);
}

export function monthName(m: number): string {
  return MONTHS_HU[m - 1] ?? '';
}

/** "Október" for '2026-10'. */
export function monthLabel(mk: string): string {
  return capitalize(monthName(Number(mk.slice(5, 7))));
}

/** "október 12." */
export function huDayMonth(dateStr: string): string {
  return `${monthName(Number(dateStr.slice(5, 7)))} ${Number(dateStr.slice(8, 10))}.`;
}

/** "2026. október 12." */
export function huFullDate(dateStr: string): string {
  return `${dateStr.slice(0, 4)}. ${huDayMonth(dateStr)}`;
}

/** Superessive weekday: "szerdán" ("vasárnap" has no suffix). */
export const WEEKDAYS_ON_HU = ['vasárnap', 'hétfőn', 'kedden', 'szerdán', 'csütörtökön', 'pénteken', 'szombaton'];

/** -án/-én after a day number (same rule as the app's napAnEn): 1-jén, 2-án, 12-én, 20-án. */
export function dayAn(day: number): string {
  const last = day % 10;
  if (day === 1) return '1-jén';
  if (last === 1) return `${day}-én`;
  if (day === 2) return '2-án';
  if (last === 2) return `${day}-én`;
  if (last === 0) return day === 10 ? '10-én' : `${day}-án`;
  return [3, 6, 8].includes(last) ? `${day}-án` : `${day}-én`;
}

/** "november 18-án" */
export function huDayMonthAn(dateStr: string): string {
  return `${monthName(Number(dateStr.slice(5, 7)))} ${dayAn(Number(dateStr.slice(8, 10)))}`;
}

/** -tól/-től after a day number, from the -án/-én form: 1-jétől, 2-ától, 4-étől, 10-étől, 20-ától. */
export function dayTol(day: number): string {
  return dayAn(day).replace(/jén$/, 'jétől').replace(/án$/, 'ától').replace(/én$/, 'étől');
}

/** "október 1-jétől" */
export function huDayMonthTol(dateStr: string): string {
  return `${monthName(Number(dateStr.slice(5, 7)))} ${dayTol(Number(dateStr.slice(8, 10)))}`;
}

/** "november 18-ig" */
export function huDayMonthIg(dateStr: string): string {
  return `${monthName(Number(dateStr.slice(5, 7)))} ${Number(dateStr.slice(8, 10))}-ig`;
}

/** "2027. november 18-ig" */
export function huFullDateIg(dateStr: string): string {
  return `${dateStr.slice(0, 4)}. ${huDayMonthIg(dateStr)}`;
}

/** "2026. december 18-án" */
export function huFullDateAn(dateStr: string): string {
  return `${dateStr.slice(0, 4)}. ${huDayMonthAn(dateStr)}`;
}

export const ROMAN = ['I', 'II', 'III', 'IV'];
export function quarterLabel(q: number): string {
  return `${ROMAN[q - 1]}. negyedév`;
}

export function quarterOfMonth(m: number): 1 | 2 | 3 | 4 {
  return (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

/** ISO week key '2026-W47' of a date and the Monday of that week. */
export function isoWeekOf(dateStr: string): { key: string; monday: string } {
  const d = toUtc(dateStr);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dow);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const week = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return { key: `${year}-W${String(week).padStart(2, '0')}`, monday: fromUtc(monday) };
}

export function mondayOfIsoWeek(key: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  week1Monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return fromUtc(week1Monday);
}
