// SPEC §32 (éves ciklus, F3) – the önellenőrzési pótlék SUGGESTION and the expected date of an szja refund.
// Pure, no I/O. The accountant approves (or overrides) every pótlék; the client only ever sees the approved number.
//
// Sources (checked 2026-11-21, TERV_EVES_CIKLUS_KATA.md 1.2 and TERV_KRITIKA 1. fejezet, njt 2017. évi CL. tv.):
//  - Art. 212. § (1): per day 1/365 of the central bank base rate valid that day; (1a)/(1b): a repeated önellenőrzés
//    pays 1.5 times; (2): tax originally paid in full → the part above 5 000 Ft is not payable; (3): made up in a later
//    return → at most the késedelmi pótlék between the two returns (computed by hand, no suggestion here);
//    (5): several consecutive periods corrected → the base is the first wrong return's difference (by hand, [DÁVID K6]).
//  - Art. 209. § (2): the daily rate is kept to 3 decimals, the rest is dropped.
//  - Art. 211. § (3) a): no pótlék when the correction is needed because of the employer's / payer's late or wrong
//    certificate (the critique added it).
//  - Art. 64. § (1): a refund is paid within 30 days of the return, but not before 1 March of the next year.
// Rounding of the forint amount [DÁVID D12]: Math.round on the exact sum (the NAV calculator example of the plan matches).
import { addDays, daysInclusive, maxDate } from '../util/dates.js';

export interface BaseRate {
  /** First day the rate applies (it applies until the next row's `from`). */
  from: string;
  /** Percent per year (5.5 = 5,5 %). */
  pct: number;
}

/**
 * Jegybanki alapkamat. Only rows checked on the official MNB page are listed; a day before the first row has NO rate,
 * so the suggestion is null ("írd be a NAV pótlékkalkulátorából"). A new rate decision is added here by hand.
 */
export const BASE_RATES: readonly BaseRate[] = [
  // mnb.hu "Jegybanki alapkamat alakulása": 5,50 % from 2026-08-26 (checked 2026-11-21: still the current rate)
  { from: '2026-08-26', pct: 5.5 },
];
export const BASE_RATES_SOURCE = { url: 'https://www.mnb.hu/Jegybanki_alapkamat_alakulasa', checkedOn: '2026-11-21' } as const;

/** Art. 212. § (2): the cap when the tax was originally paid in full. */
export const SELF_REVISION_CAP_HUF = 5_000;

export interface SelfRevisionInput {
  /** The tax difference to pay (+). A correction in the client's favour (≤ 0) carries no pótlék. */
  amountHuf: number;
  /** The original due date of the tax; the pótlék runs from the next day. */
  dueDate: string;
  /** The day the önellenőrzés is filed (inclusive). */
  filedOn: string;
  /** 2nd or later önellenőrzés of the same return (Art. 212. § (1a)/(1b)): × 1.5. */
  repeated?: boolean;
  /** Art. 212. § (2): the tax was originally paid in full → at most 5 000 Ft. */
  paidInFull?: boolean;
  /** Art. 211. § (3) a): the employer's / payer's certificate was late or wrong → no pótlék. */
  certificateError?: boolean;
  /** Art. 212. § (3): already made up in a later return → by hand (at most the késedelmi pótlék). */
  laterReturn?: boolean;
  /** Art. 212. § (5): consecutive periods corrected together → by hand [DÁVID K6]. */
  chained?: boolean;
  rates?: readonly BaseRate[];
}

export type SelfRevisionReason = 'nincs_fizetendo' | 'igazolas_hiba' | 'kesobbi_bevallas' | 'lancolt' | 'nincs_kamat' | 'nincs_nap';

export interface SelfRevisionRow {
  from: string;
  to: string;
  days: number;
  /** Yearly base rate, percent. */
  ratePct: number;
  /** Daily rate in percent, 3 decimals (Art. 209. § (2)). */
  dailyPct: number;
  /** This row's share, not rounded. */
  huf: number;
}

export interface SelfRevisionResult {
  /** The suggestion in forints; null = no suggestion (see `reason`), the accountant enters it by hand. */
  huf: number | null;
  days: number;
  rows: SelfRevisionRow[];
  repeated: boolean;
  /** The 5 000 Ft cap of Art. 212. § (2) changed the amount. */
  capped: boolean;
  /** Why there is no (or a zero) suggestion. */
  reason: SelfRevisionReason | null;
}

/** The base rate valid on `day`, or null when the table does not reach back that far. */
export function baseRateOn(day: string, rates: readonly BaseRate[] = BASE_RATES): number | null {
  let found: number | null = null;
  for (const r of [...rates].sort((a, b) => a.from.localeCompare(b.from))) if (r.from <= day) found = r.pct;
  return found;
}

/** Daily rate in thousandths of a percent, truncated (5,5 % → 15 = 0,015 %/nap). */
function dailyMilliPct(pct: number): number {
  return Math.floor(Math.round(pct * 1000) / 365);
}

export function selfRevisionSurcharge(i: SelfRevisionInput): SelfRevisionResult {
  const repeated = Boolean(i.repeated);
  const base = { days: 0, rows: [] as SelfRevisionRow[], repeated, capped: false };
  if (!(i.amountHuf > 0)) return { ...base, huf: 0, reason: 'nincs_fizetendo' };
  if (i.certificateError) return { ...base, huf: 0, reason: 'igazolas_hiba' };
  if (i.laterReturn) return { ...base, huf: null, reason: 'kesobbi_bevallas' };
  if (i.chained) return { ...base, huf: null, reason: 'lancolt' };
  const start = addDays(i.dueDate, 1);
  if (i.filedOn < start) return { ...base, huf: 0, reason: 'nincs_nap' };
  const rates = [...(i.rates ?? BASE_RATES)].sort((a, b) => a.from.localeCompare(b.from));
  if (!rates.length || rates[0]!.from > start) return { ...base, days: daysInclusive(start, i.filedOn), huf: null, reason: 'nincs_kamat' };
  const rows: SelfRevisionRow[] = [];
  let exact = 0; // forint × 100 000 (milli-percent)
  for (let k = 0; k < rates.length; k++) {
    const r = rates[k]!;
    const next = rates[k + 1];
    const from = maxDate(start, r.from);
    const to = next ? (addDays(next.from, -1) < i.filedOn ? addDays(next.from, -1) : i.filedOn) : i.filedOn;
    if (from > to) continue;
    const days = daysInclusive(from, to);
    const dm = dailyMilliPct(r.pct);
    const part = i.amountHuf * dm * days;
    exact += part;
    rows.push({ from, to, days, ratePct: r.pct, dailyPct: dm / 1000, huf: part / 100_000 });
  }
  const days = rows.reduce((a, r) => a + r.days, 0);
  let huf = Math.round((exact * (repeated ? 3 : 2)) / 2 / 100_000);
  let capped = false;
  if (i.paidInFull && huf > SELF_REVISION_CAP_HUF) {
    huf = SELF_REVISION_CAP_HUF;
    capped = true;
  }
  return { huf, days, rows, repeated, capped, reason: null };
}

/**
 * Art. 64. § (1): the refund comes within 30 days of the return, at the earliest from 1 March of the next year. The app
 * shows max(filed, 03-01 of the next year) + 30 days as "Ha … után sem érkezett meg, írj nekünk" (a cautious date).
 */
export function refundExpectedBy(filedOn: string, taxYear: number, bufferDays = 30): string {
  return addDays(maxDate(filedOn, `${taxYear + 1}-03-01`), bufferDays);
}
