// Working days (Budapest calendar of @kezjegy/ado-motor: weekends, public holidays, moved working days). SPEC §27.3.5:
// our own targets ("1 munkanapon belül"), the escalation dates of the waiting cards (§27.4.3) and the kamara deadline
// (5 working days) are counted with these.
import { isWorkingDay, nextWorkingDay } from '@kezjegy/ado-motor';
import { addDays } from './dates.js';

export { isWorkingDay, nextWorkingDay };

/** The n-th working day after `day` (n = 0 → the next working day on or after `day`). Negative n counts backwards. */
export function addWorkingDays(day: string, n: number): string {
  if (n === 0) return nextWorkingDay(day);
  let d = day;
  let left = Math.abs(n);
  const step = n > 0 ? 1 : -1;
  while (left > 0) {
    d = addDays(d, step);
    if (isWorkingDay(d)) left--;
  }
  return d;
}
