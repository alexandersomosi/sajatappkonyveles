// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
// SPEC §32.B – éves ciklus (F2/F3, 2026-11-21): the yearly return's amounts and the client's approval, the filing with the
// NAV iktatószám, the difference (to pay or refund), the yearly timeline, the önellenőrzés (tax_corrections), the manual
// NAV folyószámla check (account_reconciliations) and the year overview of the accountant. The app never files and never
// pays: the accountant files as meghatalmazott, the client transfers the money; the app marks, reminds and records checks.
//
// Texts: tegező, short, no "a(z)" (fill() fixes the article before a placeholder), no time promise – only legal dates.
// Sources of every rule are in TERV_EVES_CIKLUS_KATA.md 1.2 and TERV_KRITIKA_2026-11-21.md 1. (checked 2026-11-21).
// [DÁVID]-dependent points are cautious: the accountant enters the final numbers, approves the pótlék, and nothing here
// advises the client about a tax regime.

import type { ISODate, ISODateTime, StaffRef } from './api';
import type { AnnualStatus, ClientFlag, TaxRegime } from './enums';

// ---------- NAV adónemek of the folyószámla ----------
/** The adónemek the panel's folyószámla form lists (critique 2.3: 224 and 226 too). 288 only for a KATA year. */
export const NAV_ADONEMEK = {
  '103': 'Szja',
  '406': 'TB-járulék',
  '258': 'Szocho',
  '288': 'Kata',
  '138': 'Késedelmi pótlék',
  '215': 'Önellenőrzési pótlék',
  '224': 'Bírság',
  '226': 'Mulasztási bírság',
} as const;
export type NavAdonem = keyof typeof NAV_ADONEMEK;
/** The form's row order (an object with number-like keys would enumerate in numeric order). */
export const NAV_ADONEM_KEYS: NavAdonem[] = ['103', '406', '258', '288', '138', '215', '224', '226'];
/** The adónem of a payment item kind (HIPA: the municipality, not NAV → null). */
export const ADONEM_BY_ITEM_KIND: Record<string, NavAdonem | null> = {
  tb_jarulek: '406',
  szocho: '258',
  szja_eloleg: '103',
  szja_kulonbozet: '103',
  kata_teteles: '288',
  kata_kulonado: '288',
  onellenorzesi_potlek: '215',
  hipa_eloleg: null,
  hipa_kulonbozet: null,
  egyeb_ado: null,
};

// ---------- rules ----------
export const EV_RULES = {
  /** The client's approval due (MM-DD of the next year) [DÁVID D2]; the reminders 7 / 3 / 1 days before. */
  approvalDue: { atalany: '05-10', kata: '02-18' },
  approvalReminderDaysBefore: [7, 3, 1],
  /** Art. 64. § (1): 30 days after the return, at the earliest from 1 March of the next year. */
  refundBufferDays: 30,
  /** Art. 54–57. §: a correction of at most 1 000 Ft is no önellenőrzés (it goes into the next return) [DÁVID D11]. */
  correctionMinHuf: 1_000,
  reasonMaxChars: 600,
  otherLinesMax: 5,
  filingRefMaxChars: 40,
  /** The panel compares its estimate with the accountant's difference; above this an amber line (never a block). */
  engineDiffWarnHuf: 1_000,
  /** Next folyószámla check by default [DÁVID D14]: working days after the next payment day. */
  nextCheckWorkingDays: { atalany: 7, kata: 5 },
} as const;

export const ANNUAL_REFUND_MODES = ['kiutalas', 'atvezetes'] as const;
export type AnnualRefundMode = (typeof ANNUAL_REFUND_MODES)[number];
export const ANNUAL_REFUND_STATUSES = ['var', 'megerkezett', 'beszamitva', 'atvezetve'] as const;
export type AnnualRefundStatus = (typeof ANNUAL_REFUND_STATUSES)[number];

export const CORRECTION_FORMS = ['2658', 'SZJA', 'KATA', 'HIPA', 'egyeb'] as const;
export type CorrectionForm = (typeof CORRECTION_FORMS)[number];
export const CORRECTION_CAUSES = ['kesoi_irat', 'ugyfel_adat', 'konyvelo_hiba', 'nav_felhivas', 'egyeb'] as const;
export type CorrectionCause = (typeof CORRECTION_CAUSES)[number];
export const CORRECTION_STATUSES = ['tervezet', 'ugyfelre_var', 'jovahagyva', 'beadva', 'rendezve', 'visszavonva'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];
/** A correction line's tax: a NAV adónem, the municipality's HIPA, or another one (no payment item; the accountant tells the client). */
export const CORRECTION_ADONEMEK = ['103', '406', '258', '288', 'HIPA', 'egyeb'] as const;
export type CorrectionAdonem = (typeof CORRECTION_ADONEMEK)[number];

export const RECON_KINDS = ['rendes', 'nyito'] as const;
export const RECON_STATUSES = ['rendben', 'hatralek', 'tulfizetes', 'elteres'] as const;
export type ReconStatus = (typeof RECON_STATUSES)[number];
export const RECON_FOLLOW_UPS = ['nincs', 'befizetes_kerve', 'atvezetes_kerve', 'kiutalas_kerve', 'eszrevetel', 'onellenorzes'] as const;
export type ReconFollowUp = (typeof RECON_FOLLOW_UPS)[number];

/**
 * system_state['kapcsolok.ev_ciklus'].lemondottEvesZaras – the last year of a client whose service ended ('megszunt') or is
 * suspended ('felfuggesztve') [TULAJ T4, HIANYLISTA 1.7]:
 *  - 'ki' (default = the behaviour so far): the annual closing opens only for an active client;
 *  - 'kezi': the accountant may open it by hand on the panel ("Megnyitom az éves zárást"); the client may then fill,
 *    approve and mark payments of that closing although his service ended;
 *  - 'automatikus': it opens on 5 January like for an active client, if he had a tax profile for that year.
 */
export const LEMONDOTT_EVES_ZARAS = ['ki', 'kezi', 'automatikus'] as const;
export type LemondottEvesZaras = (typeof LEMONDOTT_EVES_ZARAS)[number];

// ---------- DTOs: annual amounts, summary, settlement, timeline ----------
export interface AnnualOtherLine {
  label: string;
  /** + to pay, − in the client's favour */
  amountHuf: number;
}
/** PUT /acc/clients/:id/annual/:aid/amounts – the numbers of the return as the accountant enters them (4.1). */
export interface AnnualAmountsInput {
  // átalány (26SZJA)
  revenueHuf?: number | null;
  incomeHuf?: number | null;
  taxFreeHuf?: number | null;
  allowancesHuf?: number | null;
  taxableHuf?: number | null;
  /** A: the year's szja (required for átalány). */
  szjaHuf?: number | null;
  /** B: the szja advances accounted for (prefilled from the approved quarters). */
  advancesHuf?: number | null;
  /** C: családi járulékkedvezmény settlement (+ to pay / − back) [DÁVID D4]. */
  csjkHuf?: number | null;
  otherLines?: AnnualOtherLine[];
  refundMode?: AnnualRefundMode;
  // KATA ('26KATA)
  kataRevenueHuf?: number | null;
  kataLiableMonths?: number | null;
  kataLimitHuf?: number | null;
  kulonadoHuf?: number | null;
  /** Why a prefilled number was changed (required when it differs from the app's). */
  overrideReason?: string | null;
  /** "{firstName} üzenete az ügyfélnek". */
  letterText?: string | null;
  /** "Az összegek egyeznek a bevallás tervezetével." – required to send the draft. */
  matchesDraft: boolean;
}
export interface AnnualAmounts extends AnnualAmountsInput {
  regime: TaxRegime;
  /** + to pay / − refund (szja: A − B + C + Σ egyéb; KATA: the különadó). */
  diffHuf: number;
}
export interface AnnualSummaryLine {
  label: string;
  amountHuf: number;
  /** '−' shows the amount as a deduction. */
  sign?: '+' | '−';
  note?: string;
}
/** What the client sees and approves; the approval hash covers exactly this (canonical JSON). */
export interface AnnualSummary {
  year: number;
  regime: TaxRegime;
  /** "Szja-bevallás 2026 (26SZJA)" / "Kata-nyilatkozat 2026 ('26KATA)" */
  formLabel: string;
  letter: string | null;
  /** "Bevételed és jövedelmed" (átalány) or the KATA block. */
  income: AnnualSummaryLine[];
  /** átalány: the szja block. */
  szja: AnnualSummaryLine[];
  /** átalány: the advances by quarter, with their check state. */
  advancesByQuarter: { label: string; amountHuf: number; state: 'ellenorizve' | 'jelolve' | 'nincs' }[];
  result: { kind: 'fizetendo' | 'visszajar' | 'nulla'; amountHuf: number; title: string; sub: string };
  /** átalány: TB and szocho of the year (information only); null when nothing was paid. */
  contributions: { lines: AnnualSummaryLine[]; text: string } | null;
  hipa: { lines: AnnualSummaryLine[]; text: string } | null;
  /** Only when there is something to pay. */
  payment: { accountName: string; accountNumber: string; iban: string; reference: string; amountHuf: number; dueDate: ISODate } | null;
  footer: string;
}
export interface AnnualSettlementView {
  /** + to pay / − refund; null until the accountant entered the amounts. */
  diffHuf: number | null;
  filedOn: ISODate | null;
  filingRef: string | null;
  /** The payment period of the difference (→ /fizetes/{id}). */
  periodId: string | null;
  paymentStatus: string | null;
  refund: {
    expectedBy: ISODate | null;
    status: AnnualRefundStatus;
    receivedOn: ISODate | null;
    receivedHuf: number | null;
    markedBy: 'ugyfel' | 'konyvelo' | null;
    note: string | null;
    /** The client card's text (title + line). */
    title: string;
    text: string;
    canMark: boolean;
  } | null;
  /** The card text after filing (to pay / refund / nothing). */
  text: string | null;
  /** Javító kör 11-21: the same for the accountant (not tegező; the panel shows this, not the client's sentence). */
  staffText?: string | null;
}
export type AnnualTimelineStatus = 'kesz' | 'most' | 'kovetkezik' | 'lejart';
export interface AnnualTimelineItem {
  key: string;
  date: ISODate;
  /** "január 5." / "március 15-től" */
  dateLabel: string;
  title: string;
  sub: string | null;
  who: 'te' | 'konyvelo' | 'nav' | 'kozos';
  status: AnnualTimelineStatus;
  link: string | null;
}
export interface AnnualHipaView {
  needed: boolean;
  taxHuf: number | null;
  advancesHuf: number | null;
  diffHuf: number | null;
  returnNeeded: boolean | null;
  filedOn: ISODate | null;
  filingRef: string | null;
  periodId: string | null;
  /** Javító kör 11-21: the year's HIPA advances the client marked / the accountant verified (prefill of E). */
  advancesPaidHuf?: number | null;
  /** The HIPA method of the year ('savos' | 'altalanos' | 'nincs'). */
  method?: 'savos' | 'altalanos' | 'nincs' | null;
}
/** The open önellenőrzés items of the client (the annual screen links them). */
export interface CorrectionListItem {
  id: string;
  status: CorrectionStatus;
  title: string;
  statusText: string;
  needsAction: boolean;
}

/** PUT /acc/clients/:id/annual/:aid/hipa */
export interface AnnualHipaInput {
  /** "Nincs HIPA-kötelezettség" (H8). */
  notNeeded?: boolean;
  taxHuf?: number | null;
  advancesHuf?: number | null;
  /** sávos: a return only if the tax is above the advance or a refund is asked (Htv. 39/A. § (8)). */
  returnNeeded?: boolean | null;
}
/** POST /acc/clients/:id/annual/:aid/refund */
export interface AnnualRefundInput {
  status: Exclude<AnnualRefundStatus, 'var'>;
  on: ISODate;
  amountHuf?: number | null;
  note?: string | null;
}

// ---------- DTOs: önellenőrzés ----------
export interface CorrectionDiff {
  adonem: CorrectionAdonem;
  /** Shown to the client ("Szja", "TB-járulék", or the accountant's label for 'egyeb'). */
  label: string;
  /** + to pay, − in the client's favour. */
  amountHuf: number;
  /** The original due date of the corrected tax (the pótlék runs from the next day). */
  originalDueDate: ISODate;
}
export interface CorrectionPotlekFlags {
  /** Art. 211. § (3) a): the employer's / payer's certificate was late or wrong → no pótlék. */
  certificateError?: boolean;
  /** Art. 212. § (2): the tax was originally paid in full → at most 5 000 Ft. */
  paidInFull?: boolean;
  /** Art. 212. § (3): already made up in a later return → by hand. */
  laterReturn?: boolean;
  /** Art. 212. § (5): consecutive periods corrected together → by hand [DÁVID K6]. */
  chained?: boolean;
}
/** POST /acc/clients/:id/corrections · PUT /acc/corrections/:id */
export interface CorrectionInput extends CorrectionPotlekFlags {
  form: CorrectionForm;
  /** '2026-Q3', '2026', or free text for 'egyeb'. */
  subjectKey: string;
  originalPeriodId?: string | null;
  cause: CorrectionCause;
  /** The client sees it ("Miért?"). */
  reason: string;
  internalNote?: string | null;
  diffs: CorrectionDiff[];
  /** The day the suggestion counts to (default: today). */
  plannedFiledOn?: ISODate | null;
  potlekPayer?: 'ugyfel' | 'iroda';
  onellbOn?: ISODate | null;
  needsClientApproval?: boolean;
  /** Without the client's approval: the recorded phone agreement [DÁVID D13]. */
  noApprovalNote?: string | null;
}
export interface AccTaxCorrection {
  id: string;
  clientId: string;
  form: CorrectionForm;
  formLabel: string;
  subjectKey: string;
  subjectLabel: string;
  originalPeriodId: string | null;
  seq: number;
  status: CorrectionStatus;
  cause: CorrectionCause;
  reason: string;
  internalNote: string | null;
  diffs: CorrectionDiff[];
  flags: CorrectionPotlekFlags;
  potlek: {
    suggestedHuf: number | null;
    /** "100 000 Ft × 0,015%/nap × 200 nap = 3 000 Ft" lines, or why there is no suggestion. */
    basis: string[];
    huf: number;
    approvedAt: ISODateTime | null;
    approvedBy: StaffRef | null;
    overrideReason: string | null;
    payer: 'ugyfel' | 'iroda';
    rateNote: string;
  };
  totalToPayHuf: number;
  inFavourHuf: number;
  needsClientApproval: boolean;
  approvedAt: ISODateTime | null;
  filedOn: ISODate | null;
  filingRef: string | null;
  paymentPeriodId: string | null;
  paymentStatus: string | null;
  cancelledReason: string | null;
  createdAt: ISODateTime;
  warnings: string[];
}
/** GET /client/corrections/:id */
export interface TaxCorrectionView {
  id: string;
  status: CorrectionStatus;
  statusText: string;
  /** "Mit javítunk?" */
  what: string;
  /** "Miért?" */
  reason: string;
  diffs: { label: string; amountHuf: number; inFavour: boolean }[];
  potlekHuf: number;
  potlekPaidByUs: boolean;
  totalHuf: number;
  inFavourHuf: number;
  canApprove: boolean;
  approvalHash: string | null;
  approvedAt: ISODateTime | null;
  filedOn: ISODate | null;
  paymentPeriodId: string | null;
  /** Art. 212. § (2): the tax was paid in full originally – only the pótlék is to pay (javító kör 11-21). */
  diffsAlreadyPaid?: boolean;
}

// ---------- DTOs: folyószámla ----------
export interface ReconBalanceInput {
  /** '103' … or 'egyeb' with `label`. */
  adonem: string;
  label?: string | null;
  /** + tartozás / − túlfizetés (NAV). */
  balanceHuf: number;
  /** Könyvelésre váró befizetés (optional). */
  pendingHuf?: number | null;
}
/** One payment row of the NAV extract the accountant saw (critique 2.4: "rendben" only from a statement row). */
export interface ReconSeenRow {
  itemId: string;
  /** The day and amount on the extract. */
  paidOn: ISODate;
  amountHuf: number;
  /** 'rendben' only when the amount equals the item; else 'elteres' (with a note). */
  verification: 'rendben' | 'elteres';
  note?: string | null;
}
/** POST /acc/clients/:id/reconciliations (JSON, or multipart with `data` = this JSON and `file` = the extract PDF). */
export interface ReconciliationInput {
  kind?: 'rendes' | 'nyito';
  asOf: ISODate;
  periodEnd?: ISODate | null;
  balances: ReconBalanceInput[];
  status: ReconStatus;
  seen?: ReconSeenRow[];
  followUp?: ReconFollowUp;
  followUpNote?: string | null;
  note?: string | null;
  nextCheckOn?: ISODate | null;
  documentId?: string | null;
  /** "Szólok az ügyfélnek": a request in the app (never automatic). */
  notifyClient?: { message: string; dueOn?: ISODate | null } | null;
}
export interface ReconBalanceView {
  adonem: string;
  label: string;
  balanceHuf: number;
  pendingHuf: number;
  /** Due by asOf, not marked by the client. */
  expectedUnmarkedHuf: number;
  /** Marked by the client, not verified yet. */
  expectedMarkedHuf: number;
  /** balance − pending − expectedUnmarked */
  diffHuf: number;
}
export interface ReconciliationView {
  id: string;
  kind: 'rendes' | 'nyito';
  asOf: ISODate;
  periodEnd: ISODate | null;
  balances: ReconBalanceView[];
  totalDebtHuf: number;
  totalOverpaymentHuf: number;
  status: ReconStatus;
  followUp: ReconFollowUp;
  followUpNote: string | null;
  note: string | null;
  nextCheckOn: ISODate | null;
  verifiedItems: number;
  documentId: string | null;
  requestId: string | null;
  resolvedAt: ISODateTime | null;
  checkedBy: StaffRef | null;
  createdAt: ISODateTime;
}
/** GET /acc/clients/:id/reconciliations/expected?asOf= – the form's prefill. */
export interface ReconExpectedView {
  asOf: ISODate;
  adonemek: { adonem: string; label: string; expectedUnmarkedHuf: number; expectedMarkedHuf: number }[];
  /** Items due by asOf, not verified yet – the rows the accountant may tick from the extract (never ticked by default). */
  openItems: { itemId: string; periodId: string; periodLabel: string; label: string; adonem: string | null; amountHuf: number; dueDate: ISODate; markedPaidOn: ISODate | null }[];
  suggestedNextCheckOn: ISODate;
  kata: boolean;
}

// ---------- DTOs: year overview ----------
export type YearOverviewFilter = 'mind' | 'hianyzik' | 'ram_var' | 'ugyfelre_var' | 'lejart' | 'kata' | 'atalany';
export interface YearOverviewRow {
  clientId: string;
  name: string;
  lifecycle: string;
  regime: TaxRegime;
  flags: ClientFlag[];
  quarters: { key: string; state: 'nincs' | 'becsles' | 'jovahagyva' | 'jelolve' | 'ellenorizve' | 'elteres' | 'nincs_fizetendo'; filed: boolean; overdue: boolean }[];
  /** beforeApp: backfilled months not checked yet (javító kör 11-21: shown as "ellenőrizetlen (app előtti)", not missing). */
  kata: { ok: number; open: number; unverified: number; exempt: number; beforeApp?: number } | null;
  reconciliation: { asOf: ISODate; status: ReconStatus; nextCheckOn: ISODate | null; overdue: boolean; resolved: boolean } | null;
  annual: { status: AnnualStatus; ball: 'ugyfel' | 'konyvelo' | null } | null;
  difference: { diffHuf: number; settled: boolean; label: string } | null;
  hipa: { advance: 'nincs' | 'jovahagyva' | 'jelolve' | 'ellenorizve' | 'nem_kell'; annual: 'nincs' | 'beadva' | 'nem_kell' };
  openCorrections: number;
  /** "kinél mi hiányzik": short staff lines. */
  missing: string[];
  ball: 'ugyfel' | 'konyvelo' | null;
  overdue: boolean;
  /** Javító kör 11-21: something waits on the accountant / on the client (both can be true; the filters use these). */
  waitingOnMe?: boolean;
  waitingOnClient?: boolean;
}
export interface YearOverview {
  year: number;
  rows: YearOverviewRow[];
  counts: Record<YearOverviewFilter, number>;
}

// ---------- client texts (content eves.*) ----------
export const EVES_TEXTS = {
  idovonalCim: 'Mikor mi jön',
  kovetkezo: 'Következő: {datum} – {mi}',
  allapot: { kesz: 'Kész', most: 'Most', lejart: 'Lejárt', kovetkezik: '' },
  /** The status line once the client approved (the status stays 'jovahagyasra_var' until the filing). */
  allapotJovahagyva: 'Jóváhagytad a bevallásodat. {firstName} beadja, és szól.',
  allapotJovahagyvaKata: 'Jóváhagytad a kata-nyilatkozatodat. {firstName} beadja, és szól.',
  /** The timeline row of the filing once it is filed and there is a difference to pay. */
  beadvaUtald: 'Utald el a különbözetet',
  beadvaUtaldKata: 'Utald el a különadót',
  /** The deadline row of the refund (Határidők). */
  hataridoVisszajaro: 'Visszajáró szja: {osszeg} Ft – a NAV utalja',
  idovonal: {
    nyitas: { title: 'Megnyílik az éves zárás', sub: 'Pár kérdés az évedről.' },
    q4: { title: 'IV. negyedévi befizetés', sub: 'Szja-előleg, TB-járulék, szocho.' },
    q4Nyugdijas: { title: 'IV. negyedévi befizetés', sub: 'Szja-előleg.' },
    kerdoiv: { title: 'Eddig töltsd ki az éves kérdőívet', sub: null },
    keszites: { title: '{firstName} elkészíti a bevallásod tervezetét', sub: 'A NAV ekkortól adja ki a tervezetet.' },
    keszitesKata: { title: '{firstName} elkészíti a kata-nyilatkozatodat', sub: null },
    jovahagyas: { title: 'Eddig hagyd jóvá a tervezetet', sub: null },
    beadas: { title: 'Beadjuk az szja-bevallásodat', sub: 'Eddig kell befizetned a különbözetet, ha van.' },
    beadasKata: { title: 'Beadjuk a kata-nyilatkozatodat', sub: 'Ha túllépted a keretedet, eddig kell befizetned a különadót.' },
    visszajar: { title: 'A NAV utalja vissza a visszajáró adót', sub: 'A törvény szerint a beadástól számított 30 napon belül, de legkorábban március 1-jén.' },
    hipa: { title: 'Iparűzési adó: éves bevallás és különbözet', sub: 'A következő évi előleg is ekkor esedékes.' },
    evVegeKata: { title: 'Ne maradjon 100 000 Ft-nál nagyobb adótartozásod', sub: 'Különben megszűnik a katád.' },
  },
  osszesito: {
    cim: 'Nézd át a bevallásodat',
    uzenetCim: '{firstName} üzenete',
    bevetelCim: 'Bevételed és jövedelmed',
    szjaCim: 'Szja',
    eloleg: 'Eddig befizetett szja-előleg',
    elolegNegyedev: 'ebből {negyedev} – {allapot}',
    fejFizetendo: 'Fizetendő: {osszeg} Ft, {hatarido}',
    fejVisszajar: 'Visszajár: {osszeg} Ft',
    fejNulla: 'Nincs különbözet',
    elolegAllapot: { ellenorizve: 'ellenőrizve', jelolve: 'jelölted', nincs: 'nincs jelölve' },
    fizetendo: 'Fizetendő: {osszeg} Ft',
    fizetendoAl: 'Utald el {hatarido} a NAV szja-számlájára.',
    visszajar: 'Visszajár: {osszeg} Ft',
    visszajarAl: 'A NAV utalja vissza a bankszámládra: {szamla}.',
    visszajarAlNincsSzamla: 'A NAV utalja vissza arra a bankszámládra, amelyet a bevallásban megadunk.',
    visszajarSzabaly: 'A törvény szerint a beadástól számított 30 napon belül utalja, de legkorábban {ev}. március 1-jén.',
    nulla: 'Nincs különbözet',
    nullaAl: 'Az előlegeid pontosan kiadták az adódat.',
    jarulekCim: 'Járulékok',
    jarulekAl: 'Ezeket negyedévente fizetted. Az éves bevallás nem változtat rajtuk.',
    hipaCim: 'Iparűzési adó',
    hipaAl: 'Ezt külön bevallásban adjuk be, és az önkormányzatnak fizeted.',
    utalasCim: 'Utalási adatok',
    utalasAl: 'A bevallás beadása után a Határidők között is megtalálod, ott jelölheted meg a befizetést.',
    reszlet: 'Ha egyszerre nem tudod kifizetni, írj nekünk, mielőtt lejár a határidő.',
    tervezet: 'Megnyitom a tervezetet',
    gomb: 'Jóváhagyom a bevallást',
    kerdes: 'Kérdésem van',
    lab: 'Az összegek a bevallás tervezetéből valók. Ezt adjuk be a NAV-hoz.',
    megerosit: 'Jóváhagyod? Ezzel engedélyezed, hogy {firstName} ezzel a tartalommal beadja a bevallásodat.',
    megerositGomb: 'Jóváhagyom',
    megse: 'Mégse',
    jovahagyva: 'Jóváhagytad: {datum}. {firstName} beadja, és szól.',
    kata: {
      bevetel: 'Bevétel {ev}',
      keret: 'Kereted',
      havi: 'Befizetett havi kata',
      tobblet: 'Kereten felüli bevétel',
      kulonado: 'Különadó (40%)',
      eredmenyKulonado: 'Fizetendő különadó: {osszeg} Ft',
      eredmenyKulonadoAl: 'Utald el {hatarido} a NAV kata-számlájára.',
      nincs: 'Nincs különadó',
      nincsAl: 'Nem léptél túl a kereteden.',
      gomb: 'Jóváhagyom a nyilatkozatot',
      megerosit: 'Jóváhagyod? Ezzel engedélyezed, hogy {firstName} ezzel a tartalommal beadja a kata-nyilatkozatodat.',
    },
    sor: {
      bevetel: 'Bevétel',
      koltseghanyad: 'Költséghányad',
      jovedelem: 'Jövedelem',
      adomentes: 'Adómentes rész',
      kedvezmeny: 'Kedvezményeid',
      adokoteles: 'Adóköteles jövedelem',
      szja: 'Szja az évre (15%)',
      csjk: 'Családi járulékkedvezmény elszámolása',
      tb: 'TB-járulék {ev}',
      szocho: 'Szocho {ev}',
      hipaAdo: 'Iparűzési adó {ev}',
      hipaEloleg: 'Befizetett előleg',
      hipaKulonbozet: 'Különbözet',
    },
  },
  visszajaro: {
    cim: 'Visszajár: {osszeg} Ft',
    szoveg: 'A NAV utalja vissza erre a bankszámládra: {szamla}. Ha {datum} után sem érkezett meg, írj nekünk.',
    szovegNincsSzamla: 'A NAV utalja vissza a bankszámládra. Ha {datum} után sem érkezett meg, írj nekünk.',
    szovegDatumNelkul: 'A NAV utalja vissza a bankszámládra.',
    jeloles: 'Megjelölöm, hogy megérkezett',
    jelolesAl: 'Ez csak jelölés.',
    mikor: 'Mikor érkezett meg?',
    mennyi: 'Mennyi érkezett?',
    megjott: 'Megérkezett: {osszeg} Ft ({datum}).',
    beszamitva: 'A NAV a visszajáró összeget egy másik adótartozásodba számította be. Nézd meg {firstName} üzenetét.',
    atvezetve: 'A visszajáró összeget a NAV egy másik adódra vezette át.',
  },
  beadva: {
    fizetendo: 'Beadtuk a bevallásodat. Utald el a különbözetet: {osszeg} Ft, {hatarido}.',
    visszajar: 'Beadtuk a bevallásodat. {osszeg} Ft jár vissza, a NAV utalja.',
    nulla: 'Beadtuk a bevallásodat. Nincs különbözet.',
    kataKulonado: 'Beadtuk a kata-nyilatkozatodat. Utald el a különadót: {osszeg} Ft, {hatarido}.',
    kataNincs: 'Beadtuk a kata-nyilatkozatodat. Különadó nincs.',
    fizetesGomb: 'Megnézem az utalási adatokat',
    rendezve: 'A különbözet rendben: {firstName} látta a befizetésedet.',
  },
  onell: {
    cim: 'Javítjuk egy beadott bevallásodat',
    mit: 'Mit javítunk?',
    miert: 'Miért?',
    potlek: 'Önellenőrzési pótlék',
    potlekAl: 'A késve bevallott adó után jár, naponta a jegybanki alapkamat 365-öd része.',
    potlekIroda: 'A pótlékot mi álljuk.',
    marBefizetve: 'Ezt az adót korábban már befizetted: most csak a pótlék esedékes.',
    javaradCimke: 'a javadra',
    osszesen: 'Összesen fizetendő: {osszeg} Ft',
    osszesenAl: 'A beadással egy időben esedékes. Az utalási adatokat a beadás után a Határidők között látod.',
    javara: 'A javadra javítunk: {osszeg} Ft. Ezt a NAV a folyószámládon írja jóvá; {firstName} figyeli.',
    gomb: 'Jóváhagyom az önellenőrzést',
    megerosit: 'Jóváhagyod? Ezzel engedélyezed, hogy {firstName} beadja az önellenőrzést.',
    kerdes: 'Kérdésem van',
    allapot: {
      tervezet: '{firstName} még dolgozik rajta.',
      ugyfelre_var: 'Nézd át, és hagyd jóvá.',
      jovahagyva: 'Jóváhagytad. {firstName} beadja.',
      beadva: 'Beadtuk az önellenőrzést.',
      rendezve: 'Lezártuk: minden befizetés rendben.',
      visszavonva: 'Ezt az önellenőrzést {firstName} visszavonta.',
    },
    fizetesGomb: 'Megnézem az utalási adatokat',
    listaCim: 'Önellenőrzés',
  },
} as const;

/** Labels of the corrected returns (client wording: "Mit javítunk?"). */
export const CORRECTION_FORM_LABELS: Record<CorrectionForm, string> = {
  '2658': 'járulékbevallás (2658)',
  SZJA: 'szja-bevallás',
  KATA: 'kata-nyilatkozat',
  HIPA: 'iparűzésiadó-bevallás',
  egyeb: 'bevallás',
};
export const CORRECTION_ADONEM_LABELS: Record<CorrectionAdonem, string> = {
  '103': 'Szja',
  '406': 'TB-járulék',
  '258': 'Szocho',
  '288': 'Kata',
  HIPA: 'Iparűzési adó',
  egyeb: 'Egyéb',
};

// ---------- staff texts (panel; szakmai, de tegező) ----------
export const EVES_PANEL_TEXTS = {
  osszegek: 'Összegek',
  egyezik: 'Az összegek egyeznek a bevallás tervezetével.',
  motor: 'Az app becslése: különbözet kb. {becsles} Ft. Eltérés a te számodtól: {elteres} Ft.',
  motorNincs: 'Az app nem tud becslést adni ehhez az évhez.',
  elolegEllenorizetlen: 'Előbb egyeztesd a folyószámlát: van ellenőrizetlen negyedéves előleg.',
  indokKell: 'Írd le röviden, miért tér el az app számától.',
  beadtam: 'Beadtam',
  iktatoszam: 'NAV-iktatószám',
  beadasNapja: 'Beadás napja',
  bevallasPdf: 'Bevallás (PDF)',
  nyugta: 'NAV-visszaigazolás',
  telefonos: 'Jóváhagyás nélkül adom be (telefonon egyeztettünk)',
  telefonosMegjegyzes: 'Mikor és mit beszéltetek?',
  kulonbozetCim: 'Különbözet',
  visszajaroCim: 'Visszajáró',
  varhato: 'Várható: {datum} (Art. 64. § (1): a beadástól 30 nap, legkorábban március 1.)',
  megerkezett: 'Megérkezett',
  beszamitva: 'Beszámítva',
  atvezetve: 'Átvezetve',
  hipaCim: 'Iparűzési adó (éves)',
  hipaNemKell: 'Nincs HIPA-kötelezettség',
  hipaBevallasKell: 'Bevallás kell (sávosnál csak ha több az előlegnél, vagy visszatérítést kér – Htv. 39/A. § (8))',
  hipaBeadtam: 'Beadtam a HIPA-bevallást',
  hipaNemKellBevallas: 'Nem kell bevallás, rögzítem az adót',
  lezaras: 'Lezárom az éves zárást',
  lezarasIndok: 'Miért zárod le kézzel?',
  megnyitas: 'Megnyitom az éves zárást',
  megnyitasMegszunt: 'Az ügyfél szolgáltatása megszűnt vagy szünetel. Az utolsó éve zárását kézzel nyithatod meg.',
  megnyitasKi: 'A megszűnt ügyfél éves zárása ki van kapcsolva (tulaj-döntés). Ha mégis kell, szólj a tulajnak.',
  onellIndit: 'Önellenőrzést indítok',
  vegyesEv: 'Vegyes év: a negyedéveket számold kézzel.',
} as const;

export const ONELL_PANEL_TEXTS = {
  cim: 'Önellenőrzések',
  uj: 'Új önellenőrzés',
  kuszob: 'Önellenőrzéssel adónként csak 1 000 Ft fölötti különbözet javítható (Art. 56. § (3)). Az ennél kisebb sort hagyd ki: elég a következő bevallásban javítani.',
  nincsKamat: 'Erre az időszakra nincs kamatadatunk. Írd be a pótlékot a NAV pótlékkalkulátorából.',
  kamatForras: 'Jegybanki alapkamat: {szazalek}% ({tol}-tól). Ha azóta változott, a pótlékot a NAV kalkulátorából írd be.',
  ismetelt: 'Ismételt önellenőrzés – a pótlék másfélszeres.',
  igazolasHiba: 'A munkáltató vagy kifizető igazolásának hibája miatt (Art. 211. § (3) a)) – nincs pótlék',
  hianytalan: 'Az adót eredetileg hiánytalanul megfizette (Art. 212. § (2): legfeljebb 5000 Ft)',
  kesobbiBevallas: 'A következő bevallásban már pótolta (Art. 212. § (3)) – a pótlékot kézzel add meg',
  lancolt: 'Göngyölített ÁFA-javítás több egymást követő időszakra (Art. 212. § (5)) – a pótlékot kézzel add meg',
  hipaPotlek: 'A HIPA-önellenőrzés pótléka az önkormányzaté, nem a NAV-é: az app nem számol, nem tesz rá tételt, és nem kér rá jóváhagyást (még egyeztetjük).',
  potlekUjraszamolva: 'A pótlékot a beadás napjára számoltuk újra: {regi} Ft helyett {uj} Ft.',
  potlekDatum: 'A pótlék a beadás napjáig jár. Ha később adod be, mint {datum}, beadáskor újraszámoljuk.',
  hianytalanSor: 'Az adót eredetileg hiánytalanul megfizette: a különbözetre nem teszünk tételt, csak a pótlékra.',
  potlekJovahagy: 'Jóváhagyom a pótlékot',
  potlekIndok: 'Miért tér el a javaslattól?',
  kiFizeti: 'Ki fizeti a pótlékot?',
  ugyfelreVar: 'Ügyfélnek jóváhagyásra',
  beadtam: 'Beadtam',
  visszavonom: 'Visszavonom',
  eredetiErintetlen: 'Az eredeti időszak és a számolása érintetlen marad.',
  allapot: {
    tervezet: 'Tervezet',
    ugyfelre_var: 'Ügyfélre vár',
    jovahagyva: 'Jóváhagyva – add be',
    beadva: 'Beadva – befizetésre vár',
    rendezve: 'Rendezve',
    visszavonva: 'Visszavonva',
  },
  okok: { kesoi_irat: 'Késői irat', ugyfel_adat: 'Az ügyfél adata', konyvelo_hiba: 'Könyvelői hiba', nav_felhivas: 'NAV-felhívás', egyeb: 'Egyéb' },
} as const;

export const FOLYOSZAMLA_TEXTS = {
  cim: 'NAV-folyószámla',
  uj: 'Új egyeztetés',
  asOf: 'A lekérdezés napja',
  egyenleg: 'NAV-egyenleg (+ tartozás / − túlfizetés)',
  fuggo: 'Könyvelésre váró befizetés',
  varhatoJeloletlen: 'App szerint nincs jelölve',
  varhatoJelolt: 'Jelölte, nem ellenőrizted',
  elteres: 'Eltérés',
  lattam: 'Ezeket a befizetéseket a kivonaton láttam',
  lattamSugo: 'Csak azt jelöld, aminek a befizetési sorát (dátum és összeg) látod a kivonaton. Alapból semmi nincs bejelölve: a 0 vagy negatív egyenleg nem bizonyítja, hogy ez a tétel be van fizetve.',
  osszegElter: 'Az összeg eltér a tételtől ({tetel} Ft): ezt csak eltérésként jelölheted.',
  allapot: { rendben: 'Rendben', hatralek: 'Hátralék', tulfizetes: 'Túlfizetés', elteres: 'Eltérés' },
  teendo: { nincs: 'Nincs teendő', befizetes_kerve: 'Befizetést kérek', atvezetes_kerve: 'Átvezetést kérek (ATVUT17)', kiutalas_kerve: 'Kiutalást kérek', eszrevetel: 'Észrevétel a NAV-nak', onellenorzes: 'Önellenőrzés kell' },
  szolok: 'Szólok az ügyfélnek',
  kovetkezo: 'Következő ellenőrzés',
  kivonat: 'Kivonat (PDF)',
  rendezve: 'Rendezve',
  nyito: 'Nyitó egyenleg (átvétel előző könyvelőtől)',
  keresCim: 'Befizetés a NAV-folyószámládra',
  egyebAdonem: 'Egyéb adónem',
} as const;

export const EV_ATTEKINTO_TEXTS = {
  cim: 'Éves áttekintő',
  szurok: { mind: 'Mind', hianyzik: 'Hiányzik valami', ram_var: 'Rám vár', ugyfelre_var: 'Ügyfélre vár', lejart: 'Lejárt', kata: 'Kata', atalany: 'Átalány' },
  oszlopok: { ugyfel: 'Ügyfél', negyedevek: 'Negyedévek / kata', folyoszamla: 'Folyószámla', eves: 'Éves zárás', kulonbozet: 'Különbözet', hipa: 'HIPA', onell: 'Önellenőrzés', hianyzik: 'Mi hiányzik' },
  csv: 'CSV letöltése',
} as const;

// ---------- notifications (content notif.<kind>.<variant>.title|body) ----------
export const EVES_NOTIFICATION_TEXTS = {
  annual_status: {
    fizetendo: { title: 'Beadtuk a bevallásodat: {osszeg} Ft-ot kell befizetned', body: 'Utald el {hatarido} a NAV szja-számlájára. Az utalási adatokat az appban látod.' },
    visszajar: { title: 'Beadtuk a bevallásodat: {osszeg} Ft jár vissza', body: 'A NAV utalja vissza a bankszámládra. Ha megérkezett, jelöld meg az appban.' },
    nulla: { title: 'Beadtuk a bevallásodat', body: 'Nincs különbözet: az előlegeid pontosan kiadták az adódat.' },
    visszaerkezett: { title: 'Megérkezett a visszajáró adód', body: 'A NAV {osszeg} Ft-ot utalt vissza.' },
    kata_kulonado: { title: 'Beadtuk a kata-nyilatkozatodat: {osszeg} Ft különadót kell befizetned', body: 'Utald el {hatarido} a NAV kata-számlájára. Az utalási adatokat az appban látod.' },
    kata_beadva: { title: 'Beadtuk a kata-nyilatkozatodat', body: 'Nem léptél túl a kereteden, különadó nincs.' },
    hipa_fizetendo: { title: 'Iparűzési adó: {osszeg} Ft különbözetet kell befizetned', body: 'Utald el {hatarido} az önkormányzat számlájára. Az utalási adatokat az appban látod.' },
    valtozott: { title: 'Változott a bevallásod tervezete', body: '{firstName} módosította. Nézd át újra, és hagyd jóvá.' },
    megnyitva: { title: 'Megnyílt az éves zárásod', body: 'Pár kérdés az évedről. Ebből készül a bevallásod.' },
  },
  correction_status: {
    jovahagyasra_var: { title: 'Javítani kell egy beadott bevallásodat', body: '{firstName} önellenőrzést készített: {mit}. Nézd át, és hagyd jóvá.' },
    jovahagyasra_var_javara: { title: 'Javítunk egy bevallásodat, a javadra', body: '{firstName} önellenőrzést készített: {mit}. Nézd át, és hagyd jóvá.' },
    beadva_fizetendo: { title: 'Beadtuk az önellenőrzést: {osszeg} Ft-ot kell befizetned', body: 'A különbözet és a pótlék most esedékes. Az utalási adatokat az appban látod.' },
    beadva_javara: { title: 'Beadtuk az önellenőrzést', body: 'A javadra javítottunk: {osszeg} Ft. {firstName} figyeli, mikor írja jóvá a NAV.' },
    beadva: { title: 'Beadtuk az önellenőrzést', body: 'Neked most nincs teendőd.' },
    beadva_iroda: { title: 'Beadtuk az önellenőrzést', body: 'A pótlékot mi álljuk, neked nincs teendőd.' },
    beadva_potlek: { title: 'Beadtuk az önellenőrzést: {osszeg} Ft pótlékot kell befizetned', body: 'Az adót korábban már befizetted, most csak a pótlék esedékes. Az utalási adatokat az appban látod.' },
    rendezve: { title: 'Lezártuk az önellenőrzést', body: 'Minden befizetés rendben.' },
  },
  tax_due_soon: {
    eves: { title: 'Közeleg az szja-különbözet határideje: {osszeg} Ft', body: 'Határidő: {datum} Az utalási adatokat az appban látod.' },
    kata_kulonado: { title: 'Közeleg a kata-különadó határideje: {osszeg} Ft', body: 'Határidő: {datum} A NAV kata-számlájára utald.' },
    hipa_eves: { title: 'Közeleg az iparűzési adó határideje: {osszeg} Ft', body: 'Határidő: {datum} Az önkormányzat számlájára utald; az adatokat az appban látod.' },
    onell: { title: 'Fizesd be az önellenőrzés összegét: {osszeg} Ft', body: 'A beadással egy időben esedékes. Az utalási adatokat az appban látod.' },
  },
  tax_payment_verified: {
    eves: { title: '{firstName} látta a befizetésedet', body: 'Az szja-különbözet rendben megérkezett a NAV-hoz.' },
    kata_kulonado: { title: '{firstName} látta a befizetésedet', body: 'A kata-különadó rendben megérkezett a NAV-hoz.' },
    hipa_eves: { title: '{firstName} látta a befizetésedet', body: 'Az iparűzési adó különbözete rendben megérkezett az önkormányzathoz.' },
    onell: { title: '{firstName} látta a befizetésedet', body: 'Az önellenőrzés összege rendben megérkezett.' },
  },
  tax_task: {
    folyoszamla: { title: 'Folyószámla-egyeztetés: {clientName}', body: 'Esedékes: {datum} Rögzítsd az egyenleget adónemenként.' },
    visszajaro_kesik: { title: '{clientName}: a visszajáró szja még nem érkezett meg', body: 'Várható volt: {datum} Nézd meg a folyószámláját.' },
    eves_jovahagyva: { title: '{clientName} jóváhagyta az éves bevallást', body: 'Beadhatod: {form}.' },
    onell_jovahagyva: { title: '{clientName} jóváhagyta az önellenőrzést', body: 'Beadhatod: {mit}.' },
    visszajaro_ugyfel: { title: '{clientName}: megérkezett a visszajáró adó', body: 'Az ügyfél jelölte: {osszeg} Ft ({datum}). Nézd meg a folyószámlán.' },
  },
} as const;
/** E-mail bodies (the in-app text + one line; the link to the app is added by the dispatcher). */
export const EVES_EMAIL_TEXTS = {
  'annual_status.fizetendo': 'Utald el {hatarido} a NAV szja-számlájára. Az utalási adatokat az appban látod.\n\nA bevallás és a NAV visszaigazolása a dossziédban van.',
  /** Only with the switch reszletfizetesSzoveg on [TULAJ T6]. */
  'annual_status.fizetendo_reszlet': 'Utald el {hatarido} a NAV szja-számlájára. Az utalási adatokat az appban látod.\n\nA bevallás és a NAV visszaigazolása a dossziédban van. Ha egyszerre nem tudod kifizetni, írj nekünk, mielőtt lejár a határidő.',
  'annual_status.visszajar': 'A NAV utalja vissza a bankszámládra. Ha megérkezett, jelöld meg az appban.\n\nA bevallás és a NAV visszaigazolása a dossziédban van.',
  'annual_status.kata_kulonado': 'Utald el {hatarido} a NAV kata-számlájára. Az utalási adatokat az appban látod.\n\nA nyilatkozat és a NAV visszaigazolása a dossziédban van.',
  'correction_status.jovahagyasra_var': '{firstName} önellenőrzést készített: {mit}. Nézd át, és hagyd jóvá.\n\nAz önellenőrzést csak a jóváhagyásod után adjuk be.',
  'correction_status.beadva_fizetendo': 'A különbözet és a pótlék most esedékes. Az utalási adatokat az appban látod.\n\nAz önellenőrzés és a NAV visszaigazolása a dossziédban van.',
} as const;
