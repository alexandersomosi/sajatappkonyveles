// Public contract of @kezjegy/ado-motor. Source of truth: kod/SPEC.md §7.5.
// Everything in SPEC §7.5 is here unchanged; fields marked "(+)" are optional or additive
// extensions documented in SPEC §24 (Builder notes) – consumers that ignore them keep working.
//
// Money: integer forint everywhere (no floats). Dates: 'YYYY-MM-DD' (Europe/Budapest business dates).

export type ISODate = string;

/** Költséghányad in percent. 45 = general (2026), 80 = Szja tv. 53. § (2) list, 90 = exclusively retail. */
export type CostRatio = 45 | 80 | 90;
export type TaxStatus = 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas';
export type ActivityAnswer = 'kiskereskedelem' | 'lista80' | 'egyeb';
export type HipaMethod = 'savos' | 'altalanos' | 'nincs';
export type InsuranceBreakKind = 'szunetel' | 'kieso';

export interface RevenueItemInput {
  /** Pénzforgalmi nap: counts for the átalányadó (SZJA/járulék) in the year of this date. */
  receivedOn: ISODate;
  /** Teljesítés napja: counts for the alanyi ÁFA-mentesség limit in the year of this date. */
  deliveryDate: ISODate;
  /** Integer forint. May be negative (storno / modification). */
  amountHuf: number;
  countsForAtalany: boolean;
  countsForAfaLimit: boolean;
  /** true when receivedOn is a guess (e.g. invoice payment deadline) – produces a warning for the accountant. */
  estimated?: boolean;
}

export interface InsuranceBreak {
  from: ISODate;
  to: ISODate; // inclusive
  /** szunetel = the activity is suspended (not insured those days); kieso = insured but no minimum for those days (táppénz, csed, gyed …). */
  kind: InsuranceBreakKind;
}

export interface TaxProfileInput {
  year: number;
  /** 45 | 80 | 90. A legacy 40 (2022–2025 general ratio) is accepted at runtime, computed with the year's general ratio and warned about. */
  costRatio: CostRatio;
  status: TaxStatus;
  /** Garantált bérminimum as monthly minimum (főtevékenység needs ≥ secondary qualification). [KÖNYVELŐ] */
  guaranteedMinimum: boolean;
  /** Start of átalányadózás / of the activity if it started during the year. Earlier dates mean "whole year". */
  atalanyFrom?: ISODate;
  /** Exclusively retail (kiskereskedelem). Defaults to costRatio === 90. Raises the revenue caps. */
  retail?: boolean;
  insuranceBreaks?: InsuranceBreak[];
  /** priorYearHuf: last year's approved HIPA (sávos: this year's advance equals it, Htv. 39/A. § (9)). */
  hipa?: { method: HipaMethod; ratePct: number; priorYearHuf?: number | null };
  /** Quarters 1..throughQuarter were handled by someone else (e.g. a previous accountant); these are the actual sums they used. */
  priorOverrides?: { throughQuarter: 1 | 2 | 3; priorActualBaseSum: number; priorSzjaAdvanceSum: number };
  /** (+) Legacy one-line flags (SPEC §26). Presence → the 'kedvezmeny_nem_modellezett' warning only, numbers unchanged. */
  allowances?: { kind: 'csaladi' | 'fiatal_25' | 'anyak' | 'egyeb'; note?: string }[];
  /** (+) SPEC §28.3.7: APPROVED, in-year personal allowances. They change the SZJA-előleg (and the TB through csjk). */
  kedvezmenyek?: AllowancesInput;
}

// ---------- SPEC §28.3.7 personal allowances ----------
export type AllowanceKind = 'anya30' | 'anyak' | 'fiatal25' | 'szemelyi' | 'elso_hazasok' | 'csaladi';
export interface CsaladiMonthInput {
  month: number;
  /** Eltartottak száma (kedvezményezett + other eltartott) – decides the per-child amount. */
  eltartott: number;
  /** One entry per kedvezményezett eltartott of the month. */
  children: { felvaltva?: boolean; tartosBeteg?: boolean }[];
  /** The client's share of the frame when shared with the spouse (default 100). */
  sharePct?: number;
}
export interface AllowancesInput {
  /** 'YYYY-MM'; required for anya30, anyak 'ket', fiatal25 (warning + ignored when missing). */
  birthMonth?: string;
  anya30?: { months: number[] };
  anyak?: { jogcim: 'ket' | 'harom' | 'negyplusz'; months: number[] };
  /** Default months: computed from birthMonth (every month before the 25th birthday, the birthday month included). */
  fiatal25?: { months?: number[] };
  szemelyi?: { months: number[] };
  /** monthlyHuf: 0..rules.allowances.elsoHazasokMonthlyHuf (the couple may split 33 335 Ft). */
  elsoHazasok?: { months: number[]; monthlyHuf: number };
  csaladi?: { months: CsaladiMonthInput[]; csjkInYear: boolean };
}
export interface AllowanceSummary {
  /** Base reduction against SZJA over the returned quarters, per kind. */
  usedHuf: Partial<Record<AllowanceKind, number>>;
  szjaSavedHuf: number;
  csjkHuf: number;
  savedHuf: number;
  /** Családi frame left after the last returned month (the annual return may use it). */
  csaladiUnusedHuf: number;
  /** min(15 % × unused, TB of the year − csjk) – for the accountant. */
  annualCsjkPotentialHuf: number;
}

/**
 * (+) SPEC §27.11 T1: a quarter the accountant already approved. Its APPROVED sums are the prior sums of
 * the later quarters (NAV 100. füzet 4. and 6.1: the cumulative amount is reduced by what was actually
 * taken into account earlier), so revenue that later lands in a closed quarter is carried into the next
 * open quarter instead of vanishing.
 */
export interface ApprovedQuarterActual {
  quarter: 1 | 2 | 3 | 4;
  /** Sum of the monthly járulékalap (TB base) that was approved for the quarter. */
  baseSumHuf: number;
  /** The SZJA-előleg that was approved for the quarter (after a manual override, if any). */
  szjaAdvanceHuf: number;
  /** The quarter's átalány revenue at approval; a different recomputed revenue raises a 'konyvelo' warning. */
  revenueHuf?: number;
  /**
   * (+) k7c2: the családi járulékkedvezmény the approval contained (0 / absent = none). An allowance approved later never
   * puts csjk into an approved quarter, so the családi frame of its months stays for the SZJA.
   */
  csjkHuf?: number;
}

export interface YearInput {
  profile: TaxProfileInput;
  revenue: RevenueItemInput[];
  /** The calculation date: revenue received after it is ignored ("várható"). */
  asOf: ISODate;
  /** (+) Approved quarters (SPEC §27.11 T1). A quarter ≤ profile.priorOverrides.throughQuarter keeps the override. */
  approvedQuarters?: ApprovedQuarterActual[];
}

export interface MonthLine {
  month: number; // 1..12
  revenueHuf: number;
  incomeHuf: number;
  /** The month carries járulék (≥ 1 insured day; never for nyugdíjas). */
  insured: boolean;
  /** Monthly minimum base after day-proration; null when no minimum applies (mellékállás, nyugdíjas, not insured). */
  minimumHuf: number | null;
  baseHuf: number;
  tbHuf: number;
  szochoHuf: number;
  /** (+) Days of the month with insurance. */
  insuredDays?: number;
  /** (+) Days of the month the minimum applies to (insured days minus kieső days). */
  minimumDays?: number;
  /** (+) true when the base is the minimum (the income-based amount was lower). */
  minimumApplied?: boolean;
  /** (+) The month lies after asOf: the line is a forecast with no further revenue. */
  future?: boolean;
  /** (+) SPEC §28.3.7 (only with `kedvezmenyek`): the month's taxable part (above the adómentes rész; may be negative). */
  taxableHuf?: number;
  /** (+) Income of the month exempted by the month-bound allowances (anyák, 25 év alattiak). */
  exemptHuf?: number;
  /** (+) Családi járulékkedvezmény of the month. `tbHuf` stays GROSS; the quarter's tbHuf is net of it. */
  csjkHuf?: number;
}

export type PaymentKind = 'tb_jarulek' | 'szocho' | 'szja_eloleg';

export interface PaymentLine {
  kind: PaymentKind;
  label: string;
  sublabel?: string;
  amountHuf: number;
  /** Official NAV account name (use it as the beneficiary name). */
  accountName: string;
  accountNumber: string;
  iban: string;
  /** (+) Short name for small screens. */
  accountShortName?: string;
}

export type ExplanationLineKind = 'cim' | 'sor' | 'ado' | 'megjegyzes';

export interface ExplanationLine {
  label: string;
  amountHuf?: number;
  op?: '+' | '−' | '=';
  note?: string;
  /** (+) cim = block heading (no amount), sor = arithmetic row, ado = a tax row (highlighted in design 07), megjegyzes = plain note. */
  kind?: ExplanationLineKind;
  /** (+) Right-hand grey text of a heading, e.g. "július–szeptember". */
  side?: string;
}

export interface Explanation {
  intro: string;
  lines: ExplanationLine[];
  result: string;
}

export type WarningAudience = 'ugyfel' | 'konyvelo';

export interface EngineWarning {
  code: string;
  text: string;
  /** (+) Who the text is written for. Client UIs show only 'ugyfel'. */
  audience?: WarningAudience;
}

export interface QuarterResult {
  quarter: 1 | 2 | 3 | 4;
  periodKey: string; // "2026-Q3"
  dueDate: ISODate;
  /** The quarter ended before asOf. */
  complete: boolean;
  revenueHuf: number;
  incomeHuf: number;
  incomeYtdHuf: number;
  taxableYtdHuf: number;
  /** g = (taxable YTD − earlier actual bases) / insured months, rounded; 0 when nothing is left. */
  cumulativeBasePerMonthHuf: number;
  months: MonthLine[];
  tbHuf: number;
  szochoHuf: number;
  szjaAdvanceHuf: number;
  totalHuf: number;
  payments: PaymentLine[];
  explanation: Explanation;
  warnings: EngineWarning[];
  /** (+) Always true: the engine only estimates; the accountant approves. */
  estimate?: true;
  /** (+) Same text as YearResult.disclaimer. */
  disclaimer?: string;
  /** (+) Sum of actual monthly bases of earlier quarters (or the override). */
  priorActualBaseSumHuf?: number;
  /** (+) SZJA advances of earlier quarters (or the override). */
  priorSzjaAdvanceSumHuf?: number;
  /** (+) round(taxable YTD × 15 %). */
  szjaCumulativeHuf?: number;
  /** (+) Months of the quarter with járulék. */
  insuredMonths?: number;
  /** (+) true for quarters ≤ priorOverrides.throughQuarter: shown for information, someone else's numbers count. */
  coveredByPriorOverride?: boolean;
  /** (+) SPEC §28.3.7 (only with `kedvezmenyek`): csjk of the quarter (already subtracted from tbHuf). */
  csjkHuf?: number;
  /** (+) Allowances used against the SZJA base from the start of the year up to this quarter. */
  allowanceUsedYtdHuf?: Partial<Record<AllowanceKind, number>>;
}

export interface Meter {
  usedHuf: number;
  limitHuf: number;
  projectedHuf: number;
  /** used / limit (4 decimals). */
  ratio: number;
  warning: boolean;
  sentence: string;
  /** (+) Second, smaller sentence (design 03 "mellek" line). */
  detail?: string;
  /** (+) max(0, limit − used). */
  remainingHuf?: number;
}

export interface AdomentesMeter {
  limitHuf: number;
  usedIncomeHuf: number;
  reached: boolean;
  reachedMonth: number | null;
  sentence: string;
  /** (+) */
  detail?: string;
}

export interface HipaResult {
  method: string;
  baseHuf: number | null;
  annualHuf: number | null;
  /** amountHuf null = not known yet (sávos: equals the previous year's tax, which the engine does not know). */
  advances: { dueDate: ISODate; amountHuf: number | null; label?: string }[];
  note: string;
  /** (+) Band used ('a' ≤ 12 M, 'b' ≤ 18 M, 'c' ≤ 25 M / 120 M retail). */
  band?: 'a' | 'b' | 'c' | null;
  /** (+) Revenue annualised to 12 months, used for the band. */
  annualisedRevenueHuf?: number;
  /** (+) When the yearly tax / difference is due (May 31 of the next year, shifted). */
  annualDueDate?: ISODate;
}

export interface YearResult {
  engineVersion: string;
  rulesVersion: string;
  asOf: ISODate;
  quarters: QuarterResult[];
  meters: { afa: Meter; atalanyCap: Meter; adomentes: AdomentesMeter };
  hipa: HipaResult | null;
  revenueByMonth: { month: number; amountHuf: number }[];
  warnings: EngineWarning[];
  disclaimer: string;
  /** (+) Always true. */
  estimate?: true;
  /** (+) */
  year?: number;
  /** (+) The ratio actually used (may differ from the input for a legacy 40). */
  costRatioUsed?: number;
  /** (+) */
  incomeYtdHuf?: number;
  /** (+) SPEC §28.3.7: only with `kedvezmenyek`. */
  allowances?: AllowanceSummary;
  /** (+) SPEC §28.4.2: months 1..12 with at least one active day (after the start, not fully suspended). */
  activeMonths?: number[];
  /** SPEC §28.4.2: active days of each month (index 0 = January): on or after the start, not suspended. */
  activeDaysByMonth?: number[];
  /** (+) SPEC §28.4.3: active days of the year and the elapsed active days up to asOf (the meters' projection basis). */
  activeDays?: number;
  elapsedActiveDays?: number;
}

export interface DeadlineItem {
  kind: 'befizetes' | 'bevallas';
  title: string;
  dueDate: ISODate;
  periodKey?: string;
}
