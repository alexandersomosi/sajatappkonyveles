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
  /** (+) SPEC §28.3.7 b: personal SZJA allowances of an átalányadózó EV (Szja tv. 29/A–29/H, Tbj. 80. §). */
  allowances: AllowanceRules;
  sources: RuleSource[];
}

/** SPEC §28.3.7 b. Amounts in forint per month; every value names its source in `sources`. */
export interface AllowanceRules {
  /** Családi kedvezmény per kedvezményezett eltartott per month by the number of eltartott (1 / 2 / 3+) [szja-tv 29/A. § (2)]. */
  csaladiPerChildHuf: { one: number; two: number; threePlus: number };
  /** + per tartósan beteg / súlyosan fogyatékos kedvezményezett eltartott [szja-tv 29/A. § (2a)]. */
  csaladiTartosBetegExtraHuf: number;
  /** Felváltva gondozott gyermek: this % of the amount [szja-tv 29/B. § (1e)]. */
  felvaltvaPct: number;
  /** 25 év alattiak: the July KSH average of the previous year, per eligible month; the frame is ANNUAL (eligible months × this), used cumulatively in the advances [szja-tv 29/F. (2), 49. § (1), nav-73 7.2]. */
  fiatal25MonthlyCapHuf: number;
  fiatal25AgeYears: number;
  /** 30 év alatti anyák: eligible up to the year she turns 30 (born year − 30 or later) [tv-2025-13]. */
  anya30AgeYears: number;
  /** Két gyermeket nevelő anyák: born in this year or later (null = no age limit any more) [tv-2025-14 4. §]. */
  ketgyermekesMinBirthYear: number | null;
  /** Három gyermeket nevelő anyák: in force from [tv-2025-15]. */
  haromgyermekesFrom: string;
  /** Személyi kedvezmény per month (1/3 of the minimum wage, rounded) [szja-tv 29/E.]. */
  szemelyiMonthlyHuf: number;
  /** Első házasok per month for the couple, at most this many months [szja-tv 29/C.]. */
  elsoHazasokMonthlyHuf: number;
  elsoHazasokMaxMonths: number;
  /** Családi járulékkedvezmény = 15 % of the unused családi frame [tbj 34. § (3), 80. § (2)]. */
  csjkPermille: number;
  /** Guard only: a nyugdíjas anya's szocho exemption limit, unreachable for an átalányadózó [szocho-tv 5. § (1a)]. */
  nyugdijasAnyaSzochoLimitHuf: number;
}
