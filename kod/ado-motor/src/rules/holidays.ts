// Hungarian non-working days, for the "next working day" rule of tax deadlines
// (Art. – if the last day of a deadline is a non-working day, it ends on the next working day).
//
// 1) Statutory public holidays (Mt. 102. § (1)) are computed for any year, incl. the movable
//    Easter/Pentecost days. 24 December is a public holiday from 2026 (Mt. amendment adopted in
//    November 2026 – adozona.hu, 2026-11-03: "December 24. munkaszüneti nap lesz"). Before 2026 it
//    was only an occasional bridge day.
// 2) Bridge rest days and the Saturdays worked in exchange come from the yearly NGM decree:
//    2026: 10/2025. (IV. 30.) NGM rendelet – 2 Jan (Fri) rest ↔ 10 Jan (Sat) work, 21 Aug (Fri)
//    rest ↔ 8 Aug (Sat) work, 24 Dec (Thu) rest ↔ 12 Dec (Sat) work. 24 Dec has since become a
//    public holiday; the repeal of the 12 Dec working Saturday was announced but its decree was not
//    found on 2026-11-18, so 12 Dec stays a working day here (safe side: a deadline never moves
//    later because of it).
//    2027: no decree was published when this was written → only statutory holidays and weekends.
//
// Policy: a moved working Saturday counts as a working day (deadline does not move). If unsure,
// the earlier date is used – paying a day early is never late. [KÖNYVELŐ] to confirm.

export interface DayNote {
  date: string;
  name: string;
}

/** Bridge rest days (pihenőnap) per year from the NGM decrees. */
export const BRIDGE_REST_DAYS: Record<number, DayNote[]> = {
  2026: [
    { date: '2026-01-02', name: 'Áthelyezett pihenőnap (10/2025. NGM r.)' },
    { date: '2026-08-21', name: 'Áthelyezett pihenőnap (10/2025. NGM r.)' },
  ],
  2027: [],
};

/** Saturdays that are working days per the NGM decrees. */
export const MOVED_WORKING_DAYS: Record<number, DayNote[]> = {
  2026: [
    { date: '2026-01-10', name: 'Áthelyezett munkanap (10/2025. NGM r.)' },
    { date: '2026-08-08', name: 'Áthelyezett munkanap (10/2025. NGM r.)' },
    { date: '2026-12-12', name: 'Áthelyezett munkanap (10/2025. NGM r.; törlése bejelentve, rendelet még nem ismert)' },
  ],
  2027: [],
};

/** Years whose NGM decree has been entered above. Other years use statutory holidays only. */
export const KNOWN_DECREE_YEARS: readonly number[] = [2026];

/** Easter Sunday (Gregorian), anonymous algorithm (Meeus/Jones/Butcher). Returns [month, day]. */
export function easterSunday(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysIso(year: number, month: number, day: number, delta: number): string {
  const t = Date.UTC(year, month - 1, day) + delta * 86_400_000;
  const d = new Date(t);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Statutory public holidays of a year (Mt. 102. § (1)). */
export function statutoryHolidays(year: number): DayNote[] {
  const [em, ed] = easterSunday(year);
  const list: DayNote[] = [
    { date: iso(year, 1, 1), name: 'Újév' },
    { date: iso(year, 3, 15), name: 'Nemzeti ünnep' },
    { date: addDaysIso(year, em, ed, -2), name: 'Nagypéntek' },
    { date: iso(year, em, ed), name: 'Húsvétvasárnap' },
    { date: addDaysIso(year, em, ed, 1), name: 'Húsvéthétfő' },
    { date: iso(year, 5, 1), name: 'A munka ünnepe' },
    { date: addDaysIso(year, em, ed, 49), name: 'Pünkösdvasárnap' },
    { date: addDaysIso(year, em, ed, 50), name: 'Pünkösdhétfő' },
    { date: iso(year, 8, 20), name: 'Államalapítás ünnepe' },
    { date: iso(year, 10, 23), name: 'Nemzeti ünnep' },
    { date: iso(year, 11, 1), name: 'Mindenszentek' },
    { date: iso(year, 12, 25), name: 'Karácsony' },
    { date: iso(year, 12, 26), name: 'Karácsony' },
  ];
  if (year >= 2026) list.push({ date: iso(year, 12, 24), name: 'Szenteste' });
  return list.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}
