// @kezjegy/ado-motor – public API (SPEC §7.5).
//
// Every number this package returns is an ESTIMATE. The accountant reviews and approves it; until
// then every result carries `disclaimer` ("Becslés. A végleges összeget a könyvelőd hagyja jóvá.")
// and `estimate: true`. The package never files anything and performs no I/O.

import { RULES_2026 } from './rules/index.js';
import type { ActivityAnswer, CostRatio } from './types.js';

export type * from './types.js';
export type { TaxRules, NavAccount, RuleSource, MonthDay } from './rules/types.js';

export { calculateYear, ENGINE_VERSION, DISCLAIMER } from './engine/year.js';
// SPEC §28.1 / §28.4 – reserve per invoice, monthly earnings, year-end projection; §28.3 allowance helpers
export {
  reserveSeries,
  roundReserve,
  earningsByMonth,
  projectYear,
  splitByWeights,
  RESERVE_ROUND_HUF,
  type ReserveZone,
  type ReserveItemInput,
  type ReserveLine,
  type ReserveSeries,
  type EarningsMonthEngine,
  type YearProjection,
} from './engine/reserve.js';
export { csaladiFrameHuf, fiatal25Months } from './engine/allowances.js';
export type { AllowanceRules } from './rules/types.js';
export { deadlinesFor, quarterDueDate, hipaDates, isWorkingDay, nextWorkingDay } from './calendar.js';
export { RULES_2026, RULES_2027, NAV_ACCOUNTS, rulesForYear, SUPPORTED_YEARS } from './rules/index.js';
export { statutoryHolidays, easterSunday, BRIDGE_REST_DAYS, MOVED_WORKING_DAYS } from './rules/holidays.js';
export { AdoMotorInputError, validateYearInput } from './validate.js';
export { hungarianIban, isValidIban } from './util/iban.js';
export { formatHuf, formatNumber, quarterLabel, monthName } from './util/format.js';

/**
 * Suggested költséghányad from the onboarding questionnaire (SPEC §7.5). Only a suggestion – the
 * accountant confirms it (client_tax_profiles.cost_ratio_source).
 *  - 'kiskereskedelem': exclusively retail → 90 %
 *  - 'lista80': an activity listed in Szja tv. 53. § (2) (építőipar, fodrász, autószerelő, vendéglátás, taxi …) → 80 %
 *  - 'egyeb': everything else → 45 % (2026; it was 40 % until 2025)
 */
export function costRatioForActivity(answer: ActivityAnswer): CostRatio {
  switch (answer) {
    case 'kiskereskedelem':
      return RULES_2026.costRatios.retail as CostRatio;
    case 'lista80':
      return RULES_2026.costRatios.list80 as CostRatio;
    case 'egyeb':
      return RULES_2026.costRatios.general as CostRatio;
    default: {
      const never: never = answer;
      throw new RangeError(`unknown activity answer: ${String(never)}`);
    }
  }
}
