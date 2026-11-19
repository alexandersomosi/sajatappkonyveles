// Shape of one year's tax rules. Every number the engine uses lives in a TaxRules object
// (src/rules/<year>.ts) next to its legal source – nothing is hard-coded in the engine.

export interface MonthDay {
  month: number; // 1..12
  day: number;
}

export interface NavAccount {
  /** Official NAV account name (beneficiary name for the transfer). */
  name: string;
  /** Short name for small screens. */
  shortName: string;
  /** Hungarian GIRO account number "10032000-06056353". */
  number: string;
  /** IBAN as published by NAV (checked against our own mod-97 computation in tests). */
  iban: string;
}

export interface RuleSource {
  id: string;
  title: string;
  url: string;
}

export interface TaxRules {
  /** Stored with every calculation (tax_calculations.rules_version). */
  rulesVersion: string;
  year: number;
  validFrom: string;
  /** Bumped when a value of the same year is corrected. */
  revision: number;
  /** true = not final (future year); the engine adds a warning. */
  draft: boolean;
  checkedOn: string;

  minimumWageHuf: number;
  guaranteedMinimumHuf: number;
  /** Days of a "month" for day-proration of the minimum (Tbj.: 1/30 of the monthly minimum per day). */
  minimumProrationDays: number;
  /** Szocho minimum as % of the járulék minimum (2025: 112.5, 2026: 100). */
  szochoMinimumPct: number;

  costRatios: { general: number; list80: number; retail: number };
  /** Ratios from earlier years that mean "general" (2022–2025: 40). Mapped to costRatios.general with a warning. */
  legacyGeneralRatios: number[];

  /** Adómentes rész: half of the annual minimum wage; not prorated. */
  taxFreeIncomeHuf: number;
  /** Rates in permille so that integer arithmetic is exact (150 = 15 %). */
  szjaPermille: number;
  tbPermille: number;
  szochoPermille: number;

  atalanyCapHuf: number;
  atalanyCapRetailHuf: number;
  afaLimitHuf: number;

  /** Meters warn from this share of the limit (0.8 = 80 %). */
  warnRatio: number;
  /** A projection-based warning is raised only after this many active days (early-year projections are noise). */
  projectionMinDays: number;

  quarterlyDueDay: number; // 12th of the month after the quarter
  szjaAnnualReturn: MonthDay; // in the next year
  szjaAnnualReturnForm: string;
  jarulekQuarterlyForm: string;

  hipa: {
    maxRatePct: number;
    /** Htv. 39/A. § (1): kisvállalkozó revenue limit, and the retail átalányadózó limit. */
    smallBusinessLimitHuf: number;
    smallBusinessLimitRetailHuf: number;
    /** Htv. 39/A. § (2): bands by revenue (upper bound inclusive) → fixed tax base. The last band ends at the limit above. */
    bands: { band: 'a' | 'b' | 'c'; upToHuf: number | null; baseHuf: number }[];
    /** Sávos: one advance (= previous year's tax) by the last day of the 5th month of the tax year. */
    savosAdvance: MonthDay;
    /** Yearly tax / difference + return: last day of the 5th month of the next year. */
    annualDue: MonthDay;
    /** General method advances (not modelled; dates only). */
    altalanosAdvances: MonthDay[];
  };

  accounts: { szja: NavAccount; tb: NavAccount; szocho: NavAccount };
  sources: RuleSource[];
}
