import { RULES_2026 } from './2026.js';
import { RULES_2027 } from './2027.js';
import type { TaxRules } from './types.js';

export { RULES_2026, NAV_ACCOUNTS } from './2026.js';
export { RULES_2027 } from './2027.js';
export type { TaxRules, NavAccount, RuleSource, MonthDay } from './types.js';

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
