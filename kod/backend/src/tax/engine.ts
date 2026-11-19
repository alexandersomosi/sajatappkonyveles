// The one place that decides which tax engine the backend uses (SPEC §3.2, §7.5): the real
// package @kezjegy/ado-motor. (src/adapters/ado-motor.ts is the SPEC-sanctioned fallback with the
// same contract; it is no longer wired.)
export {
  calculateYear,
  deadlinesFor,
  costRatioForActivity,
  ENGINE_VERSION,
  RULES_2026,
  NAV_ACCOUNTS,
  AdoMotorInputError,
  quarterDueDate,
  hungarianIban as ibanHu,
  type YearInput,
  type YearResult,
  type QuarterResult,
  type RevenueItemInput,
  type TaxProfileInput,
  type CostRatio,
  type Meter,
} from '@kezjegy/ado-motor';
