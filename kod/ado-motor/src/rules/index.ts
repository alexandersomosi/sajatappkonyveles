import { RULES_2026 } from './2026.js';
import { RULES_2027 } from './2027.js';
import type { KataRules, KataVariant, TaxRules } from './types.js';

export { RULES_2026, NAV_ACCOUNTS, NAV_ACCOUNTS_EV, KATA_RULES_REGI_2026 } from './2026.js';
export { RULES_2027, KATA_RULES_REGI_2027_DRAFT, KATA_RULES_UJ_2027_DRAFT, T928_SOURCE } from './2027.js';
export type { TaxRules, NavAccount, RuleSource, MonthDay, KataRules, KataVariant } from './types.js';

const BY_YEAR: Readonly<Record<number, TaxRules>> = {
  2026: RULES_2026,
  2027: RULES_2027,
};

export const SUPPORTED_YEARS: readonly number[] = Object.keys(BY_YEAR)
  .map(Number)
  .sort((a, b) => a - b);

/** The rules of a tax year, or undefined when the engine has none (the engine never guesses a year). */
export function rulesForYear(year: number): TaxRules | undefined {
  return BY_YEAR[year];
}

/**
 * SPEC §32: the KATA rule set of a year and variant, or undefined when that KATA does not exist that year (e.g. 'uj' in
 * 2026) or the engine has no rules for the year. A `draft` set is returned too – the caller decides (kataMonthlyHuf).
 */
export function kataRulesFor(year: number, variant: KataVariant = 'regi'): KataRules | undefined {
  return BY_YEAR[year]?.kata?.[variant];
}
