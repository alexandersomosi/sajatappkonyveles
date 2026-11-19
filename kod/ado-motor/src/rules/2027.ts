import { RULES_2026 } from './2026.js';
import type { TaxRules } from './types.js';

// DRAFT for 2027 – only the changes already enacted in 2025/2026 are applied:
//  - general költséghányad 50 % (Szja tv., [nav-kedvezo])
//  - alanyi ÁFA-mentesség limit 22 000 000 Ft ([nav-igy-adozunk])
// The 2027 minimum wage / garantált bérminimum were NOT known when this was written, so the 2026
// values are carried over (and with them the tax-free part and the revenue caps). Every result made
// with these rules carries the `rules_draft` warning. Replace the values and set `draft: false`
// once the 2027 decree is published.

export const RULES_2027: TaxRules = {
  ...RULES_2026,
  rulesVersion: '2027-01-01-draft',
  year: 2027,
  validFrom: '2027-01-01',
  revision: 0,
  draft: true,
  checkedOn: '2026-11-18',
  costRatios: { general: 50, list80: 80, retail: 90 },
  legacyGeneralRatios: [40, 45],
  afaLimitHuf: 22_000_000,
  szjaAnnualReturnForm: '27SZJA',
  // SPEC §28.3.7 b: the two-children mothers' age limit moves to 1977 in 2027 (2025. évi XIV. tv. 4. §); the
  // under-25 cap (KSH July 2026) and the 2027 minimum wage (személyi) are not known yet → 2026 values (draft).
  allowances: { ...RULES_2026.allowances, ketgyermekesMinBirthYear: 1977 },
};
