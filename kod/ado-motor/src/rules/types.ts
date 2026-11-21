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

  /** (+) SPEC §32: `kata` = the NAV KATA account (adónem 288), used by both KATA variants while known. */
  accounts: { szja: NavAccount; tb: NavAccount; szocho: NavAccount; kata?: NavAccount };
  /** (+) SPEC §28.3.7 b: personal SZJA allowances of an átalányadózó EV (Szja tv. 29/A–29/H, Tbj. 80. §). */
  allowances: AllowanceRules;
  /**
   * (+) SPEC §32 – KATA rule sets per variant. 'regi' = Kata tv. (2022. évi XIII. tv.), 'uj' = the "kisadózó egyéni
   * vállalkozók tételes adója" of the T/928 bill (not law yet → draft). A variant missing here does not exist that year.
   */
  kata?: { regi?: KataRules; uj?: KataRules };
  sources: RuleSource[];
}

/** SPEC §32: which KATA. 'regi' = Kata tv. 2022; 'uj' = T/928 (from 2027, if enacted). */
export type KataVariant = 'regi' | 'uj';

/**
 * One KATA rule set (SPEC §32). Every value names its source in `sources` (ids of TaxRules.sources). `draft: true` = the
 * values come from a bill or are not confirmed: the engine returns no amount for it unless the caller explicitly allows
 * draft rules (the backend's switch, off until the law is published).
 */
export interface KataRules {
  variant: KataVariant;
  /** Monthly tételes adó per started month (Ft). 'uj': the főfoglalkozású amount. null = not known for this year. */
  monthlyHuf: number | null;
  /** 'uj' only: the nem főfoglalkozású amount (T/928 7. § (1)). */
  monthlyNotMainHuf?: number | null;
  /** Kata tv. 7. § (4): the yearly keret. */
  yearlyLimitHuf: number;
  /** Kata tv. 7. § (4): per liable month when not the whole year. null = the proration is not known (draft). */
  limitPerMonthHuf: number | null;
  /** Kata tv. 7. § (5): különadó above the keret, permille (400 = 40 %). */
  kulonadoPermille: number;
  /** Payment by this day of the next month (next working day), Kata tv. 7. § (2)–(3). */
  dueDay: number;
  /** Kata tv. 7. § (9): the closing month of an a)–c) state is free when the state lasted ≥ this many days (exempt months not counted). */
  exemptMinDays: number;
  /** Notice deadline in days (kifizetői bevétel, lost főfoglalkozás – Kata tv. 5. § (3a)). */
  reportDays: number;
  /** Kata tv. 5. § (1) e): a végrehajtható nettó adótartozás above this on 31 December ends the KATA. */
  debtLimitHuf: number;
  /** Kata tv. 10. §: the yearly declaration (next year). null = not known (draft). */
  declarationDue: MonthDay | null;
  declarationForm: string | null;
  /** Kata tv. 7. § (6) / 10. § (2): declaration and különadó this many days after the KATA ended during the year. */
  terminationDays: number;
  /** 'uj' only: kiegészítő adó on the kifizetői bevétel above the yearly tételes adó (T/928 8. §) – NOT modelled. */
  kiegeszitoPermille?: number;
  /** 'regi': only a főfoglalkozású EV may be katás (Kata tv. 3. §, 7. § (1)). */
  onlyMainJob: boolean;
  /** The NAV account of the payment. null = not known (no payment item can be made). */
  account: NavAccount | null;
  adonem: string | null;
  draft: boolean;
  /** Ids of TaxRules.sources. */
  sources: string[];
  note?: string;
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
