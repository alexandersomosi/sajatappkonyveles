import { KATA_RULES_REGI_2026, RULES_2026 } from './2026.js';
import type { KataRules, RuleSource, TaxRules } from './types.js';

/** SPEC §32: the KATA bill of 2026 (T/928/9 egységes javaslat, 2026-11-20). NOT LAW – draft rules only. */
export const T928_SOURCE: RuleSource = {
  id: 't928',
  title: 'T/928/9 egységes javaslat (2026-11-20) – kata 2027: régi kata 75 000 Ft/hó (Kata tv. 7. § (1) módosítása), új „kisadózó egyéni vállalkozók tételes adója” (7., 8., 14–16., 29. §). Nincs kihirdetve.',
  url: 'https://www.parlament.hu/irom43/00928/00928-0009.pdf',
};

/** Kata tv. KATA in 2027 IF T/928 is enacted: 75 000 Ft/hó; the rest as in 2026 (the bill changes 7. § (1) only, as far as checked). */
export const KATA_RULES_REGI_2027_DRAFT: KataRules = {
  ...KATA_RULES_REGI_2026,
  monthlyHuf: 75_000,
  declarationForm: '27KATA',
  draft: true,
  sources: ['t928', 'katv'],
  note: 'T/928 nincs kihirdetve: a 2027-es havi összeget a könyvelő erősíti meg (75 000 Ft a javaslat szerint, 50 000 Ft a hatályos Kata tv. szerint).',
};

/**
 * The new KATA of T/928 (from 2027, if enacted): 100 000 Ft/hó főfoglalkozásúnak, 50 000 Ft/hó nem főfoglalkozásúnak
 * (7. § (1)); keret 22 M Ft, 40 % above it (7. § (4)–(5)); kiegészítő adó 15 % of the kifizetői bevétel above the yearly
 * tételes adó (8. §, not modelled). Its NAV account, the monthly proration of the keret and the declaration are NOT known
 * yet → null (no payment item can be made even with the switch on).
 */
export const KATA_RULES_UJ_2027_DRAFT: KataRules = {
  variant: 'uj',
  monthlyHuf: 100_000,
  monthlyNotMainHuf: 50_000,
  yearlyLimitHuf: 22_000_000,
  limitPerMonthHuf: null,
  kulonadoPermille: 400,
  dueDay: 12,
  exemptMinDays: 30,
  reportDays: 15,
  debtLimitHuf: 100_000,
  declarationDue: null,
  declarationForm: null,
  terminationDays: 30,
  kiegeszitoPermille: 150,
  onlyMainJob: false,
  account: null,
  adonem: null,
  draft: true,
  sources: ['t928'],
  note: 'T/928 nincs kihirdetve. A számlaszám, a keret havi arányosítása és a nyilatkozat még nem ismert.',
};

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
  // SPEC §32: both KATA variants of 2027 are DRAFTS from the T/928/9 bill (2026-11-20, not law yet). The engine gives no
  // amount for a draft unless the caller allows it (the backend switch `kata2027`, off until the law is published in the
  // Magyar Közlöny and the final text is checked). Values per the critique of 2026-11-21 (2.1) [t928].
  kata: { regi: KATA_RULES_REGI_2027_DRAFT, uj: KATA_RULES_UJ_2027_DRAFT },
  sources: [...RULES_2026.sources, T928_SOURCE],
};
