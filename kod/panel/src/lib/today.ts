// "Today" in Europe/Budapest as YYYY-MM-DD. The local mock pins it to the demo day (fixtures.today).
import { bpDate } from './format';

let override: string | null = null;
export function setTodayOverride(d: string | null): void {
  override = d;
}
export function today(): string {
  return override ?? bpDate(new Date().toISOString());
}
export function currentYear(): number {
  return Number(today().slice(0, 4));
}
/** ISO week key "2026-W47" for a date (ISO-8601 weeks, Monday start). */
export function isoWeek(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
/** Current instant in ms. With the mock's pinned day, the same time of day on that day (like the mock API's clock). */
export function mostMs(): number {
  const n = Date.now();
  if (!override) return n;
  return Date.parse(`${override}T${new Date(n).toISOString().slice(11, 23)}Z`);
}
