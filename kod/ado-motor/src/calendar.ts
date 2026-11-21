// Deadlines calendar (SPEC §7.4): NAV / municipal due dates with the "next working day" rule.

import { BRIDGE_REST_DAYS, MOVED_WORKING_DAYS, statutoryHolidays } from './rules/holidays.js';
import { kataRulesFor, rulesForYear, RULES_2026 } from './rules/index.js';
import type { KataVariant, MonthDay, TaxRules } from './rules/types.js';
import type { DeadlineItem, HipaMethod } from './types.js';
import { addDays, isIsoDate, isoWeekday, monthOf, toIso, yearOf } from './util/dates.js';
import { monthName, quarterLabel, yearAdjective } from './util/format.js';

const holidayCache = new Map<number, Set<string>>();

function nonWorkingSet(year: number): Set<string> {
  let s = holidayCache.get(year);
  if (!s) {
    s = new Set<string>([...statutoryHolidays(year), ...(BRIDGE_REST_DAYS[year] ?? [])].map((h) => h.date));
    holidayCache.set(year, s);
  }
  return s;
}

/** Working day = Mon–Fri that is not a holiday / bridge rest day, or a Saturday worked by decree. */
export function isWorkingDay(date: string): boolean {
  if (!isIsoDate(date)) throw new RangeError(`not an ISO date: ${date}`);
  const year = yearOf(date);
  if ((MOVED_WORKING_DAYS[year] ?? []).some((d) => d.date === date)) return true;
  if (isoWeekday(date) >= 6) return false;
  return !nonWorkingSet(year).has(date);
}

/** The date itself when it is a working day, otherwise the next working day. */
export function nextWorkingDay(date: string): string {
  let d = date;
  for (let i = 0; i < 31; i++) {
    if (isWorkingDay(d)) return d;
    d = addDays(d, 1);
  }
  throw new RangeError(`no working day within 31 days after ${date}`);
}

function due(year: number, md: MonthDay): string {
  return nextWorkingDay(toIso(year, md.month, md.day));
}

/** Due date of the quarterly TB + szocho + SZJA-előleg payment (and the 2658 return): the 12th of the month after the quarter. */
export function quarterDueDate(year: number, quarter: 1 | 2 | 3 | 4, rules: TaxRules = rulesForYear(year) ?? RULES_2026): string {
  const month = quarter * 3 + 1;
  return month > 12
    ? nextWorkingDay(toIso(year + 1, 1, rules.quarterlyDueDay))
    : nextWorkingDay(toIso(year, month, rules.quarterlyDueDay));
}

/** HIPA dates for a tax year. Sávos: one advance in the year (5th month) + tax/return next year. */
export function hipaDates(year: number, method: HipaMethod, rules: TaxRules = rulesForYear(year) ?? RULES_2026): { advances: string[]; annual: string | null } {
  if (method === 'nincs') return { advances: [], annual: null };
  const annual = due(year + 1, rules.hipa.annualDue);
  if (method === 'savos') return { advances: [due(year, rules.hipa.savosAdvance)], annual };
  return { advances: rules.hipa.altalanosAdvances.map((md) => due(year, md)), annual };
}

/**
 * Deadlines of one tax year for an átalányadózó egyéni vállalkozó (SPEC §7.4).
 * Contract: `deadlinesFor(year)`. Optional `hipaMethod` (default 'savos', the usual case below 25 M Ft):
 *  - 'savos': advance by 31 May of the year (= previous year's tax, Htv. 39/A. § (9)); difference + return by 31 May next year.
 *  - 'altalanos': advances 15 March and 15 September; return 31 May next year.
 *  - 'nincs': no HIPA dates.
 * Sorted by date. periodKey: "2026-Q1" … "2026-Q4", "2026" (annual SZJA), "2026-HIPA-1"/"-2" (advances), "2026-HIPA" (yearly).
 */
export function deadlinesFor(
  year: number,
  options: { hipaMethod?: HipaMethod; regime?: 'atalany' | 'kata'; kataFrom?: string | null; kataTo?: string | null; kataVariant?: KataVariant } = {},
): DeadlineItem[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new RangeError(`bad year: ${year}`);
  const rules = rulesForYear(year) ?? RULES_2026;
  const method = options.hipaMethod ?? 'savos';
  const out: DeadlineItem[] = [];
  if (options.regime === 'kata') {
    // SPEC §32: a KATA year has no átalány quarter, no '58 return and no 26SZJA – the monthly KATA (Kata tv. 7. § (2))
    // and the yearly declaration (10. §) instead. periodKey 'YYYY-MM-KATA' / 'YYYY-KATA'.
    const k = kataRulesFor(year, options.kataVariant ?? 'regi');
    if (k) {
      const yStart = toIso(year, 1, 1);
      const yEnd = toIso(year, 12, 31);
      const from = options.kataFrom && isIsoDate(options.kataFrom) && options.kataFrom > yStart ? options.kataFrom : yStart;
      const to = options.kataTo && isIsoDate(options.kataTo) && options.kataTo < yEnd ? options.kataTo : yEnd;
      for (let m = monthOf(from); m <= monthOf(to) && from <= to; m++) {
        const dueDate = m === 12 ? nextWorkingDay(toIso(year + 1, 1, k.dueDay)) : nextWorkingDay(toIso(year, m + 1, k.dueDay));
        out.push({ kind: 'befizetes', title: `Kata – ${monthName(m)}`, dueDate, periodKey: `${year}-${String(m).padStart(2, '0')}-KATA` });
      }
      const declDue = to < yEnd ? nextWorkingDay(addDays(to, k.terminationDays)) : k.declarationDue ? due(year + 1, k.declarationDue) : null;
      if (declDue) out.push({ kind: 'bevallas', title: `Kata-nyilatkozat${k.declarationForm ? ` ('${k.declarationForm.slice(0, 2)}KATA)` : ''} a ${yearAdjective(year)} évről`, dueDate: declDue, periodKey: `${year}-KATA` });
    }
  } else {
    for (const q of [1, 2, 3, 4] as const) {
      const dueDate = quarterDueDate(year, q, rules);
      const periodKey = `${year}-Q${q}`;
      out.push({ kind: 'befizetes', title: `TB-járulék, szocho és SZJA-előleg – ${quarterLabel(q)}`, dueDate, periodKey });
      out.push({ kind: 'bevallas', title: `Járulékbevallás (${rules.jarulekQuarterlyForm}) – ${quarterLabel(q)}`, dueDate, periodKey });
    }
    out.push({
      kind: 'bevallas',
      title: `Éves SZJA-bevallás (${rules.szjaAnnualReturnForm}) a ${yearAdjective(year)} évről`,
      dueDate: due(year + 1, rules.szjaAnnualReturn),
      periodKey: String(year),
    });
  }
  const h = hipaDates(year, method, rules);
  if (method === 'savos') {
    out.push({
      kind: 'befizetes',
      title: 'Iparűzési adóelőleg (sávos) – az előző évi adóval egyező összeg',
      dueDate: h.advances[0]!,
      periodKey: `${year}-HIPA-1`,
    });
  } else if (method === 'altalanos') {
    h.advances.forEach((d, i) => out.push({ kind: 'befizetes', title: `Iparűzési adóelőleg – ${i + 1}. részlet`, dueDate: d, periodKey: `${year}-HIPA-${i + 1}` }));
  }
  if (h.annual) {
    out.push({
      kind: 'bevallas',
      title: method === 'savos' ? `Iparűzési adó ${year}: különbözet és bevallás, ha magasabb sávba kerültél` : `Iparűzési adó ${year}: bevallás és különbözet`,
      dueDate: h.annual,
      periodKey: `${year}-HIPA`,
    });
  }
  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}
