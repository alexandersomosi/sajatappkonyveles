// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
// @kezjegy/shared – SPEC §29 F1–F4, F9 (owner: B2 új-funkciók). Texts (tegező, short; content keys k29f.*), types and
// DTOs of: F1 "Igazolást kérek", F2 Bevételi kimutatás, F3 Megszüntetés, F4 határidők a naptárban, F9 tulaj-konzol.
// Imports only from ./enums and ./bekotes (neither imports this file), so there is no cycle.
// Type-only imports: the backend runs this file as Node ESM (no extension resolution), so no value import from a sibling.
import type { GuideTemplate, GuideTemplateStep, PersonalisedGuideField, PersonalisedGuideStep } from './bekotes';

/** = bekotes.ts UGYSEGED_URL */
const UGYSEGED_URL = 'https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main';
const _HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
/** = bekotes.ts huLongDate: "2026. december 1." */
function huLongDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  return `${m[1]}. ${_HONAPOK[Number(m[2]) - 1] ?? ''} ${Number(m[3])}.`;
}
/** = bekotes.ts fillPlaceholders (the "A könyvelőd" fallback is lower case inside a sentence). */
function fillPlaceholders(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (m, k: string, at: number) => {
    const v = values[k];
    if (v === undefined) return m;
    if (/^A könyvelőd/.test(v) && at > 0 && !/[.!?:]\s*$/.test(text.slice(0, at))) return `a${v.slice(1)}`;
    return v;
  });
}

type _ISODate = string;
type _ISODateTime = string;
type _MonthKey = string;

// =====================================================================================================================
// F1 – "Igazolást kérek" (SPEC §29.5; NAV 22.1. információs füzet 2026-10-02)
// =====================================================================================================================

export const CERTIFICATE_TYPES_K29 = ['jovedelemigazolas', 'adoigazolas', 'koma', 'ev_kivonat', 'egyeb'] as const;
export type CertificateTypeK29 = (typeof CERTIFICATE_TYPES_K29)[number];
/** Old `certificate_requests.certificate_type` values (old app builds still send them) → the §29 types. */
export const LEGACY_CERTIFICATE_TYPE_MAP: Record<string, CertificateTypeK29> = {
  jovedelemigazolas: 'jovedelemigazolas',
  nullas_igazolas: 'adoigazolas',
  koztartozasmentes_igazolas: 'koma',
  adoigazolas: 'adoigazolas',
  koma: 'koma',
  ev_kivonat: 'ev_kivonat',
  egyeb: 'egyeb',
};
/** The fee setting of each type (fee_settings kind; default 0 Ft = "benne van a havidíjban"). */
export const CERT_FEE_KIND: Record<CertificateTypeK29, 'igazolas_jovedelem' | 'igazolas_ado' | 'igazolas_koma' | 'igazolas_ev_kivonat' | 'igazolas_egyeb'> = {
  jovedelemigazolas: 'igazolas_jovedelem',
  adoigazolas: 'igazolas_ado',
  koma: 'igazolas_koma',
  ev_kivonat: 'igazolas_ev_kivonat',
  egyeb: 'igazolas_egyeb',
};
export const CERT_PURPOSE_KINDS = ['bank', 'lizing', 'alberlet', 'palyazat', 'szechenyi', 'mas'] as const;
export type CertPurposeKind = (typeof CERT_PURPOSE_KINDS)[number];
export const CERT_STATUSES = ['dijra_var', 'beerkezett', 'navnal', 'kesz', 'elutasitva', 'visszavonva'] as const;
export type CertStatus = (typeof CERT_STATUSES)[number];
/** Open = still in the accountant's or NAV's hands. */
export const CERT_OPEN_STATUSES: readonly CertStatus[] = ['dijra_var', 'beerkezett', 'navnal'];
export const CERT_EXTENDED_ANSWERS = ['igen', 'nem', 'nem_tudom'] as const;
export type CertExtendedAnswer = (typeof CERT_EXTENDED_ANSWERS)[number];
export const CERT_OFFICIAL_ANSWERS = ['hivatalos', 'kivonat'] as const;
export type CertOfficialAnswer = (typeof CERT_OFFICIAL_ANSWERS)[number];
export const CERT_PAPER_TO = ['lakcim', 'felhasznalo'] as const;
export type CertPaperTo = (typeof CERT_PAPER_TO)[number];
/** KOMA outcomes the accountant records with "Kész". */
export const KOMA_OUTCOMES = ['benne_van', 'felvetel_kerve', 'igazolas'] as const;
export type KomaOutcome = (typeof KOMA_OUTCOMES)[number];
export const CERT_RULES = {
  /** Adóig. vhr. 1. § (4): NAV issues within 6 days. */
  navDays: 6,
  /** "Meddig kell?" closer than this → amber warning. */
  warnDays: 8,
  userNameMax: 120,
  purposeTextMax: 120,
  otherTextMax: 500,
  paperAddressMax: 200,
  rejectReasonMax: 300,
  iktatoszamMax: 60,
  resultPdfMaxBytes: 15 * 1024 * 1024,
  /** Requests per client per day (spam guard). */
  perDay: 10,
  /** "Meddig kell?" at most this far ahead. */
  neededByMaxDays: 366,
} as const;

/** Client label + one line per type (SPEC §29.5 table). */
export const CERT_TYPE_TEXTS: Record<CertificateTypeK29, { label: string; line: string; short: string }> = {
  jovedelemigazolas: {
    label: 'Jövedelemigazolás',
    line: 'A NAV igazolja, mennyi volt a jövedelmed egy évben. Bank, hitel, lízing, albérlet kéri.',
    short: 'Jövedelemigazolás',
  },
  adoigazolas: {
    label: 'Adóigazolás (nincs tartozásod)',
    line: 'A NAV igazolja, hogy nincs adótartozásod. Pályázat, hitel, partner kéri.',
    short: 'Adóigazolás',
  },
  koma: {
    label: 'Köztartozásmentes adatbázis (KOMA)',
    line: 'Ha benne vagy, sok helyen nem kell külön igazolás. Megnézzük, és ha kell, kérjük a felvételed.',
    short: 'KOMA',
  },
  ev_kivonat: {
    label: 'Egyéni vállalkozói nyilvántartás adatai',
    line: 'Kivonat arról, ami a nyilvántartásban áll rólad, például a tevékenységeid és a székhelyed.',
    short: 'EV-kivonat',
  },
  egyeb: { label: 'Más igazolás', line: 'Írd le, mire van szükséged.', short: 'Más igazolás' },
};
export const CERT_PURPOSE_LABELS: Record<CertPurposeKind, string> = {
  bank: 'Bank, hitel',
  lizing: 'Lízing',
  alberlet: 'Albérlet',
  palyazat: 'Pályázat, támogatás',
  szechenyi: 'Széchenyi Kártya',
  mas: 'Más',
};
/** "Széchenyi Kártya" prefills the user organisation. */
export const CERT_SZECHENYI_USER = 'KAVOSZ Zrt.';
/** Client status texts (content k29f.cert.status.<status>). */
export const CERT_STATUS_TEXTS: Record<CertStatus, string> = {
  dijra_var: 'Fizetésre vár: {osszeg} Ft',
  beerkezett: 'Elküldted – {firstName} hamarosan beadja',
  navnal: '{firstName} beadta a NAV-nak ({datum}). A NAV legfeljebb 6 nap alatt adja ki.',
  kesz: 'Kész – letöltheted',
  elutasitva: 'Nem adható ki: {ok}',
  visszavonva: 'Visszavontad',
};
/** Short status labels (lists, panel chips). */
export const CERT_STATUS_LABELS: Record<CertStatus, string> = {
  dijra_var: 'Fizetésre vár',
  beerkezett: 'Beérkezett',
  navnal: 'NAV-nál',
  kesz: 'Kész',
  elutasitva: 'Nem adható ki',
  visszavonva: 'Visszavonva',
};
export const KOMA_OUTCOME_TEXTS: Record<KomaOutcome, string> = {
  benne_van: 'Szerepelsz a KOMA-ban ({datum} óta).',
  felvetel_kerve: 'Kértük a felvételed: {honap} 10-én kerülsz be.',
  igazolas: 'Megjött az igazolás (A298).',
};
export const CERT_REJECT_QUICK = ['Erre az évre még nincs beadott bevallás', 'Tartozás miatt nem nullás', 'Más'] as const;
/** The form (one question per screen) and the list (content k29f.cert.*). */
export const CERT_FORM_TEXTS = {
  listTitle: 'Igazolások',
  listSub: '{firstName} kéri a NAV-tól meghatalmazottként. Kész igazolást itt letöltheted.',
  listEmpty: 'Még nem kértél igazolást.',
  newButton: 'Igazolást kérek',
  homeAction: 'Igazolást kérek',
  fiokRow: 'Igazolások',
  typeTitle: 'Milyen igazolás kell?',
  typeSub: '{firstName} kéri a NAV-tól meghatalmazottként. A NAV ingyen adja.',
  yearTitle: 'Melyik évről?',
  yearSub: 'Csak olyan évről lehet, amelyről már beadtad a bevallást.',
  yearCurrent: 'Erre az évre még nincs bevallás, ezért a NAV még nem ad róla igazolást. Addig a Bevételi kimutatás segíthet.',
  yearNotFiled: 'A {ev}-es bevallás határideje {hatarido}. Utána kérheted.',
  yearToStatement: 'Bevételi kimutatás',
  purposeTitle: 'Mire kell?',
  purposeOther: 'Írd be, mire kell',
  userTitle: 'Ki kéri? (például OTP Bank)',
  userHint: 'A NAV ráírja az igazolásra, kinek szól.',
  userOptional: 'Ki kéri? (nem kötelező)',
  extendedTitle: 'Bővített kell? (bevallási adatokkal – bankok kérik)',
  extended: { igen: 'Igen', nem: 'Nem', nem_tudom: 'Nem tudom' } as Record<CertExtendedAnswer, string>,
  officialTitle: 'Hivatalos (hatósági bizonyítvány) kell, vagy elég egy kinyomtatott kivonat?',
  official: { hivatalos: 'Hivatalos kell', kivonat: 'Elég a kivonat' } as Record<CertOfficialAnswer, string>,
  officialHint: 'A hatósági bizonyítványt a NAV 8 napon belül adja ki.',
  otherTitle: 'Mire van szükséged?',
  otherHint: 'Írd le pár mondatban. Legfeljebb 500 karakter.',
  neededByTitle: 'Meddig kell? (nem kötelező)',
  neededByWarn: 'A NAV-nak akár 6 nap is kellhet, ezért lehet, hogy addigra nem lesz kész.',
  paperTitle: 'Papíron is kell?',
  paperOn: 'Postán is kérjük a lakcímedre',
  paperToUser: 'vagy egyenesen annak, aki kéri',
  paperToUserAddress: 'A címe',
  englishTitle: 'Angolul kell?',
  englishWhat: 'Mi ez?',
  englishText: 'A NAV a jövedelem- és az adóigazolást csak magyarul adja ki. Ha angolul kell, hiteles fordítást külön kell kérned.',
  englishOn: 'Igen, angolul kellene',
  summaryTitle: 'Átnézed?',
  feeFree: 'Díja: benne van a havidíjban.',
  feePaid: 'Díja: {osszeg} Ft, előre fizetve.',
  send: 'Elküldöm',
  sentToast: 'Elküldted. {firstName} szól, ha kész.',
  next: 'Tovább',
  back: 'Vissza',
  cancel: 'Visszavonom',
  cancelAsk: 'Biztosan visszavonod? {firstName} még nem adta be a NAV-nak.',
  download: 'Letöltöm',
  timelineTitle: 'Hol tart?',
  validOnlyElectronic: 'Az elektronikus igazolás csak ebben a fájlban hiteles. Így küldd tovább, ne nyomtatott másolatként.',
  locked: 'Igazolást a bekötés után kérhetsz.',
  duplicate: 'Ezt már kérted: {tipus} – {allapot}. Ha mégis kell még egy, küldd el újra.',
  summaryRows: {
    type: 'Igazolás',
    year: 'Év',
    purpose: 'Mire kell',
    user: 'Ki kéri',
    extended: 'Bővített',
    official: 'Forma',
    neededBy: 'Meddig kell',
    paper: 'Papíron',
    english: 'Angolul',
    other: 'Leírás',
  },
} as const;
export const CERT_VALIDATION = {
  type: 'Válaszd ki, milyen igazolás kell.',
  year: 'Válaszd ki az évet.',
  yearCurrent: 'Erre az évre még nincs bevallás, ezért a NAV még nem ad róla igazolást.',
  purpose: 'Válaszd ki, mire kell.',
  purposeText: 'Írd be, mire kell.',
  userName: 'Írd be, ki kéri (például OTP Bank).',
  extended: 'Válaszd ki, kell-e bővített.',
  official: 'Válaszd ki, milyen forma kell.',
  otherText: 'Írd le pár szóban, mire van szükséged.',
  neededByPast: 'Ez a nap már elmúlt.',
  neededByFar: 'Legfeljebb egy évre előre adhatod meg.',
  paperAddress: 'Írd be a címét.',
} as const;
/** Panel texts (accountant / admin; staff wording). */
export const CERT_PANEL_TEXTS = {
  queueTitle: 'Igazolások',
  queueSub: 'Az ügyfelek igazolás-kérései. A NAV-nál a saját meghatalmazotti belépéseddel kérd.',
  overdue: 'NAV-határidő lejárt – nézz rá',
  submitted: 'Beadtam a NAV-nak',
  submittedDate: 'Mikor adtad be?',
  iktatoszam: 'Iktatószám (nem kötelező)',
  upload: 'Feltöltöm az igazolást',
  uploadHint: 'Csak az eredeti PDF (az elektronikus irat csak így hiteles). Legfeljebb 15 MB.',
  reject: 'Nem adható ki',
  rejectReason: 'Miért nem?',
  message: 'Írok az ügyfélnek',
  reveal: 'Mutasd',
  komaTitle: 'Mi lett az eredmény?',
  koma: { benne_van: 'Már benne van a KOMA-ban', felvetel_kerve: 'Kértem a felvételét (KOMA-nyomtatvány)', igazolas: 'Megjött az A298-as igazolás' } as Record<KomaOutcome, string>,
  komaSince: 'Mióta szerepel?',
  komaMonth: 'Melyik hónap 10-én kerül be?',
  never: 'Soha ne lépj be az ügyfél nevében: a saját meghatalmazotti belépésedet használd.',
  fields: {
    name: 'Név',
    adoazonosito: 'Adóazonosító jel',
    adoszam: 'Adószám',
    address: 'Lakcím',
    birth: 'Születési adatok',
    type: 'Igazolás',
    year: 'Adóév',
    purpose: 'Jogcím / mire kell',
    user: 'Felhasználó szervezet',
    copies: 'Példányszám',
    delivery: 'Kézbesítés',
    extended: 'Bővített',
    official: 'Forma',
    english: 'Angol nyelv',
    other: 'Leírás',
    neededBy: 'Meddig kell',
    fee: 'Díj',
  },
  deliveryElectronic: 'Elektronikusan, a meghatalmazott tárhelyére',
  deliveryPaper: 'Elektronikusan + postán: {cim}',
  englishNote: 'Angolul kérte – a NAV csak magyarul adja ki (jövedelem/adó), hiteles fordítás külön.',
} as const;
/** Notification texts (content notif.certificate_*). */
export const CERT_NOTIFICATION_TEXTS = {
  certificate_requested: { title: 'Igazolás-kérés: {clientName}', body: '{tipus} – {cel}' },
  certificate_status: {
    navnal: { title: 'Beadtuk az igazolás-kérésedet', body: '{tipus}: {firstName} beadta a NAV-nak. A NAV legfeljebb 6 nap alatt adja ki.' },
    kesz: { title: 'Kész az igazolásod', body: '{tipus}: letöltheted az appban.' },
    elutasitva: { title: 'Nem adható ki az igazolás', body: '{tipus}: {ok}' },
  },
} as const;

export interface CertificateRequestInput {
  type: CertificateTypeK29;
  /** jövedelemigazolás only. */
  year?: number;
  purposeKind: CertPurposeKind;
  /** required when purposeKind = 'mas'. */
  purposeText?: string;
  /** required for jövedelem / adó; optional otherwise. */
  userName?: string;
  neededBy?: _ISODate | null;
  paperCopy?: boolean;
  paperTo?: CertPaperTo;
  /** paperTo = 'felhasznalo': the user organisation's postal address. */
  paperAddress?: string;
  /** adóigazolás only. */
  extended?: CertExtendedAnswer;
  /** ev_kivonat only. */
  official?: CertOfficialAnswer;
  englishRequested?: boolean;
  /** egyeb only (≤ 500). */
  otherText?: string;
}
export interface CertificateTimelineItem {
  status: CertStatus;
  at: _ISODateTime;
  text: string;
}
export interface CertificateView {
  id: string;
  type: CertificateTypeK29;
  typeLabel: string;
  title: string;
  status: CertStatus;
  statusLabel: string;
  statusText: string;
  year: number | null;
  purposeKind: CertPurposeKind | null;
  purposeLabel: string;
  userName: string | null;
  neededBy: _ISODate | null;
  neededByWarn: boolean;
  paperCopy: boolean;
  englishRequested: boolean;
  feeHuf: number;
  feeChargeId: string | null;
  canPay: boolean;
  canCancel: boolean;
  resultDocumentId: string | null;
  komaOutcome: KomaOutcome | null;
  rejectedReason: string | null;
  timeline: CertificateTimelineItem[];
  createdAt: _ISODateTime;
  doneAt: _ISODateTime | null;
}
export interface CertificateYearOption {
  year: number;
  ok: boolean;
  /** Why not (the "yearCurrent" / "yearNotFiled" text). */
  reason: string | null;
}
/** GET /client/certificates/form */
export interface CertificateFormView {
  years: CertificateYearOption[];
  fees: Record<CertificateTypeK29, number>;
  firstName: string;
  hasAddress: boolean;
  locked: string | null;
}
export interface AccCertificateRow {
  id: string;
  clientId: string;
  clientName: string;
  accountantName: string | null;
  type: CertificateTypeK29;
  typeLabel: string;
  purposeLabel: string;
  userName: string | null;
  year: number | null;
  neededBy: _ISODate | null;
  status: CertStatus;
  statusLabel: string;
  ageDays: number;
  overdue: boolean;
  createdAt: _ISODateTime;
  submittedAt: _ISODateTime | null;
}
export interface AccCertificateDetail extends AccCertificateRow {
  client: {
    name: string;
    birthName: string | null;
    birth: string | null;
    motherName: string | null;
    adoazonositoMasked: string | null;
    adoszam: string | null;
    address: string | null;
    email: string | null;
  };
  purposeText: string | null;
  extended: CertExtendedAnswer | null;
  official: CertOfficialAnswer | null;
  englishRequested: boolean;
  otherText: string | null;
  paperCopy: boolean;
  paperTo: CertPaperTo | null;
  paperAddress: string | null;
  delivery: string;
  copies: number;
  iktatoszam: string | null;
  feeHuf: number;
  feeStatus: string | null;
  komaOutcome: KomaOutcome | null;
  komaDate: _ISODate | null;
  rejectedReason: string | null;
  resultDocumentId: string | null;
  timeline: (CertificateTimelineItem & { by: string | null; note: string | null })[];
  /** The legacy request id (= this id) for "Írok az ügyfélnek". */
  requestId: string;
}
export interface CertSubmittedInput {
  date: _ISODate;
  iktatoszam?: string;
}
export interface CertRejectInput {
  reason: string;
}
/** POST /acc/certificates/:id/result (multipart: file + JSON fields) – KOMA may finish without a file. */
export interface CertResultFields {
  komaOutcome?: KomaOutcome;
  komaDate?: _ISODate;
  komaMonth?: _MonthKey;
}

// =====================================================================================================================
// F2 – Bevételi kimutatás (SPEC §29.6)
// =====================================================================================================================

export const INCOME_STATEMENT_RULES = {
  maxMonths: 24,
  cacheMinutes: 10,
} as const;
export const INCOME_STATEMENT_TEXTS = {
  screenTitle: 'Bevételi kimutatás',
  screenSub: 'A bevételeid havonta, PDF-ben. Bank, lízing, albérlet szokta kérni.',
  homeAction: 'Bevételi kimutatás',
  mainButton: 'Idei kimutatás letöltése',
  fullYear: '{ev} egész éve',
  otherPeriod: 'Más időszak',
  from: 'Ettől a hónaptól',
  to: 'Eddig a hónapig',
  periodTooLong: 'Legfeljebb 24 hónapot választhatsz.',
  periodOrder: 'A kezdő hónap nem lehet a záró után.',
  periodTooEarly: 'Az első bevételed hónapja előtti időszakra nem készül kimutatás.',
  download: 'Letöltöm',
  saveToDossier: 'Mentés a dossziéba',
  saved: 'Elmentettük a dossziédba.',
  notChecked: 'A könyvelőd még nem ellenőrizte ezt a változatot.',
  askCheck: 'Kérem, hogy {firstName} ellenőrizze',
  askSent: 'Elküldtük. {firstName} megnézi, és szól.',
  askPending: '{firstName} még nem nézte meg. Szólunk, ha kész.',
  checked: '{firstName} ellenőrizte: {datum}',
  previewTitle: 'Ez lesz benne',
  official: 'Hivatalos jövedelemigazolást is kérhetsz: Igazolást kérek.',
  // PDF
  pdfTitle: 'Bevételi kimutatás – {from}–{to}',
  regimeAtalany: 'Átalányadózó egyéni vállalkozó (költséghányad: {x}%)',
  regimeKata: 'Kisadózó vállalkozó (kata)',
  regimeSpan: '{from}–{to}: {regime}',
  colMonth: 'Hónap',
  colInvoices: 'Kiállított számlák (db)',
  colOther: 'Egyéb bevétel (db)',
  colRevenue: 'Bevétel (Ft)',
  total: 'Összesen',
  manualPart: 'ebből kézi tétel: {osszeg} Ft',
  estimatedMark: '*a beérkezés napja becsült (a számla fizetési határideje)',
  generated: 'Készült: {datum} {ido}, az {brand} appból.',
  honest:
    'Ez a kimutatás a NAV Online Számla rendszeréből letöltött számláid és az általad megadott egyéb bevételek alapján készült. **Nem hivatalos NAV-igazolás.** Hivatalos jövedelemigazolást az appban kérhetsz: Igazolást kérek.',
  stamp: 'A könyvelőd, {nev} ellenőrizte: {datum}',
  clientName: 'Név',
  evName: 'Vállalkozás neve',
  adoszam: 'Adószám',
  evNumber: 'EV nyilvántartási szám',
  seat: 'Székhely',
  documentTitle: 'Bevételi kimutatás {from}–{to}',
  // panel
  panelTitle: 'Bevételi kimutatás',
  panelApprove: 'Ellenőriztem, rendben',
  panelApproved: 'Ellenőrizted: {datum} Az ügyfél PDF-jén rajta lesz a pecsét.',
  panelChanged: 'Az adatok változtak az ellenőrzés óta – nézd át újra.',
  panelReview: 'Az ügyfél kérte, hogy ellenőrizd.',
} as const;
export const INCOME_NOTIFICATION_TEXTS = {
  income_statement_review: { title: 'Kimutatás ellenőrzése: {clientName}', body: '{from}–{to}. Az ügyfél kéri, hogy nézd át.' },
  income_statement_checked: { title: '{firstName} ellenőrizte a bevételi kimutatásodat', body: '{from}–{to}: a PDF-en már rajta van az ellenőrzés.' },
} as const;
export interface IncomeStatementMonth {
  month: _MonthKey;
  invoices: number;
  other: number;
  revenueHuf: number;
  manualHuf: number;
  estimated: boolean;
}
/** GET /client/income-statement/meta?from&to (and the panel's view). */
export interface IncomeStatementMeta {
  from: _MonthKey;
  to: _MonthKey;
  months: IncomeStatementMonth[];
  totalHuf: number;
  manualHuf: number;
  regimeLines: string[];
  dataSha256: string;
  approved: { byName: string; at: _ISODateTime } | null;
  /** an open review request for exactly this period */
  reviewRequested: boolean;
  /** the earliest month with revenue (YYYY-MM) or null */
  firstMonth: _MonthKey | null;
  /** chips: previous full years with revenue */
  years: number[];
  firstName: string;
}
export interface AccIncomeStatementView extends IncomeStatementMeta {
  clientName: string;
  /** approvals of other data versions of the same period */
  changedSinceApproval: boolean;
}
export interface IncomeStatementRange {
  from: _MonthKey;
  to: _MonthKey;
}

// =====================================================================================================================
// F3 – Megszüntetés (SPEC §29.7; NAV "Az egyéni vállalkozás megszüntetése")
// =====================================================================================================================

export const CLOSING_KIND = 'valtozas_megszuntetes' as const;
export const CLOSING_FEE_KIND = 'megszuntetes' as const;
export const CLOSING_RULES = {
  /** The closing day: ≥ tomorrow, ≤ today + 90 days. */
  minAheadDays: 1,
  maxAheadDays: 90,
  /** From 2027 the EV register moves to the chamber (ÁSZF 4/C.8). */
  ugysegedValidUntil: '2026-12-31',
} as const;
export const CLOSING_TEXTS = {
  hubRow: { title: 'A vállalkozás megszüntetése', line: 'Befejeznéd? Megmutatjuk, mi a teendő – vagy intézzük helyetted.' },
  info: {
    mit: 'Ha végleg befejezed, a vállalkozásodat meg kell szüntetned. Ingyenes, és a Vállalkozói Ügysegédben pár perc.',
    figyelj: [
      'A megszűnés napja legkorábban a bejelentést követő nap. Ezt a napot később nem lehet módosítani.',
      'Postán nem lehet bejelenteni: a Vállalkozói Ügysegédben, a NAV ügyfélszolgálatán vagy telefonon (1819).',
      'A megszűnés után is jár még néhány bevallás. Ezeket {firstName} intézi.',
      'A NAV-meghatalmazást ne vond vissza, amíg az utolsó bevallás be nem ment.',
    ],
  },
  helyettunkTitle: 'Megszüntetjük helyetted',
  helyettunkBody: 'Megadod a napot, {firstName} meghatalmazottként bejelenti, és elvégzi a záró bevallásokat. Díja: {dij} Ft, előre fizetve.',
  helyettunkBadge: 'Ajánlott',
  selfButton: 'Magam jelentem be',
  selfLine: 'Az útmutatóval, ingyen.',
  talkFirst: 'Előbb beszéljük meg',
  formDateTitle: 'Melyik nappal szűnjön meg?',
  formDateWarn: 'A bejelentés után ezt a napot már nem lehet módosítani.',
  formEmployeesTitle: 'Volt alkalmazottad az idén?',
  formEmployees: { igen: 'Igen', nem: 'Nem' },
  formSubTitle: 'Mi lesz az Adózz-előfizetéseddel?',
  formSubText: 'A záró bevallásokig folytatjuk, utána magától megszűnik. Az éves zárás díja ({evesDij} Ft) akkor jár, ha az idei SZJA-bevallást is mi adjuk be.',
  validationDatePast: 'A megszűnés legkorábban holnap lehet.',
  validationDateFar: 'Legfeljebb 90 nappal előre add meg.',
  summaryDate: 'Megszűnés napja',
  summaryEmployees: 'Alkalmazott az idén',
  outdated: '2027-től a vállalkozói nyilvántartást a kamara vezeti. A kamara új felületén… – ezt az útmutatót frissítjük; addig kérj visszahívást, és segítünk.',
  drawnLine: 'Ezt a képernyőt még nem fotóztuk le, ezért rajzon mutatjuk.',
  subscriptionClosed: 'Lezártuk a vállalkozásod ügyeit. Az előfizetésed {datum}-ig él, utána nem vonunk le többet.',
} as const;
/** "Ezek jönnek utána" rows of the guide (who = '{firstName} intézi' chip). */
export const CLOSING_AFTER_ROWS: readonly { key: string; text: string; when?: 'kata' | 'atalany' }[] = [
  { key: 'jarulek', text: 'Negyedéves járulékbevallás a megszűnés negyedévéről – a negyedév utáni hónap 12-éig.', when: 'atalany' },
  { key: 'szja', text: 'Az idei SZJA-bevallás az átalányadós lapokkal – jövő május 20-ig, mint minden évben.', when: 'atalany' },
  { key: 'kata', text: 'A kata a vállalkozással együtt megszűnik. A kata-nyilatkozat a megszűnés után 30 napon belül esedékes.', when: 'kata' },
  { key: 'hipa', text: 'Soron kívüli iparűzésiadó-bevallás a megszűnés miatt – a település szabályai szerint.' },
  { key: 'afa', text: 'ÁFA: alanyi mentesként nincs ÁFA-bevallásod. Ha ÁFA-körös voltál, {firstName} megnézi.' },
  { key: 'szamla', text: 'A megszűnés napja után már nem állíthatsz ki számlát. A bankszámládat és a számlázóprogramodat te zárod le.' },
  { key: 'kamara', text: 'A kamarát a NAV értesíti, ezzel nincs dolgod.' },
];
export const CLOSING_KEEP_ROWS: readonly string[] = [
  'A kiállított számláid másolatát, a nyugtákat és a bankszámlakivonatokat.',
  'A NAV leveleit és a bevallásaidat.',
  'Legalább 5 évig az utolsó bevallás határidejének évét követően (Art. 202. §). Ameddig kell, nálunk is letöltheted őket.',
];
export const CLOSING_GUIDE_VERSION = '2026-11-20.k7';
const CLOSING_BELEPES: GuideTemplateStep = {
  key: 'belepes',
  screenTitle: 'Belépés',
  text: 'Gépen nyisd meg a Vállalkozói Ügysegédet, és lépj be Ügyfélkapu+-szal vagy DÁP-pal.',
  fields: [{ label: 'Belépés', action: 'kattints', why: 'A saját belépéseddel. A jelszavadat senkinek ne add meg, nekünk se.' }],
  link: { label: 'Vállalkozói Ügysegéd megnyitása', url: UGYSEGED_URL },
};
/** The guide template of 'valtozas_megszuntetes' (drawn pictures until real captures exist). */
export const CLOSING_GUIDE_TEMPLATE: GuideTemplate = {
  title: 'Így szünteted meg a vállalkozásodat',
  intro:
    'A Vállalkozói Ügysegédben, kb. 10 perc, ingyenes. A megszűnés napját később nem lehet módosítani, ezért előbb beszéld meg {firstNameWith}. Ezekről a NAV-os lapokról még nincs képünk, és a gombok pontos feliratát is ellenőrizzük: ha bizonytalan vagy, intézzük helyetted.',
  validUntil: CLOSING_RULES.ugysegedValidUntil,
  steps: [
    {
      key: 'elotte',
      screenTitle: 'Mielőtt bejelented',
      text: 'Nézd át ezeket, mielőtt elkezded.',
      fields: [
        { label: 'Az utolsó számláidat kiállítottad', action: 'ellenorizd' },
        { label: 'Tudod, ki tartozik még neked (kintlévőség)', action: 'ellenorizd' },
        { label: 'Ha volt alkalmazottad, a munkaviszonya lezárult', action: 'ellenorizd' },
        { label: 'Nincs nyitott NAV-tartozásod – ha bizonytalan vagy, kérdezd {firstNameAcc}', action: 'ellenorizd' },
      ],
      ownApp: true,
      screenKind: 'app',
    },
    CLOSING_BELEPES,
    {
      key: 'ugyseged_fooldal',
      screenTitle: 'Bejelentéseim, kérelmeim',
      text: 'Ez az Ügysegéd kezdőlapja. Kattints a középső fülre.',
      fields: [{ label: 'Új bejelentés, kérelem benyújtása', action: 'kattints' }],
    },
    {
      key: 'megszuntetes_inditas',
      screenTitle: 'Új bejelentés, kérelem benyújtása',
      text: 'Görgess le az egyéni vállalkozás megszüntetéséről szóló részhez, és indítsd el a bejelentést.',
      fields: [{ label: 'A megszüntetés kártyájának gombja', action: 'kattints' }],
    },
    {
      key: 'megszuntetes_datum',
      screenTitle: 'A megszűnés napja',
      text: 'Add meg, melyik nappal szűnjön meg a vállalkozásod.',
      fields: [{ label: 'A megszűnés napja', action: 'ird_be', value: '{megszunesNapja}' }],
      warning: 'Legkorábban a bejelentést követő nap lehet, és utólag nem lehet módosítani.',
    },
    {
      key: 'ellenorzes_bekuldes',
      screenTitle: 'Ellenőrzés és beküldés',
      text: 'Nézd át, és küldd be. A beküldött bejelentést nem lehet visszavonni.',
      fields: [
        { label: 'A megszűnés napja', action: 'ellenorizd' },
        { label: 'A beküldés gombja', action: 'kattints' },
      ],
    },
    {
      key: 'ertesites_letoltes',
      screenTitle: 'Bejelentéseim, kérelmeim',
      text: 'A beküldött bejelentésed itt jelenik meg. Nyisd meg, és töltsd le az értesítést.',
      fields: [
        { label: 'Megtekintés', action: 'kattints' },
        { label: 'Letöltés', action: 'kattints' },
      ],
    },
    {
      key: 'app_feltoltes',
      screenTitle: 'Töltsd fel nálunk',
      text: 'Töltsd fel ide a NAV értesítését, hogy {firstName} lássa, és elkezdje a záró bevallásokat.',
      fields: [{ label: 'Feltöltöm az értesítést', action: 'kattints' }],
      ownApp: true,
      screenKind: 'app',
    },
    {
      key: 'utana',
      screenTitle: 'Ezek jönnek utána',
      text: 'A megszűnés után is van még néhány teendő. Ezeket {firstName} intézi.',
      fields: [],
      ownApp: true,
      screenKind: 'app',
    },
    {
      key: 'megorzes',
      screenTitle: 'Mit őrizz meg?',
      text: 'Ezeket tartsd meg akkor is, ha már nem dolgozol vállalkozóként.',
      fields: [{ label: 'Töltsd le az adataidat', action: 'kattints', why: 'Egy fájlban minden számlád és iratod, amit nálunk tartasz.' }],
      ownApp: true,
      screenKind: 'app',
    },
  ],
  outro: 'Kész. Ha a NAV elfogadta, töltsd fel az értesítést, és {firstName} elvégzi a záró bevallásokat.',
};
export interface ClosingChangeData {
  kind: 'valtozas_megszuntetes';
  /** the closing day */
  closingOn: _ISODate;
  hadEmployees: boolean;
  note?: string | null;
}
/** Personalises the closing guide (same output shape as personaliseChangeGuide). */
export function personaliseClosingGuide(inp: {
  change: ClosingChangeData | null;
  firstName: string;
  firstNameWith?: string;
  firstNameAcc?: string;
  progress: string[];
  regime: 'atalany' | 'kata' | null;
  ugysegedValidUntil?: string;
}): { title: string; intro: string; outro: string; validUntil: string; steps: PersonalisedGuideStep[]; activityPending: boolean; version: string } {
  const t = CLOSING_GUIDE_TEMPLATE;
  const values: Record<string, string> = {
    megszunesNapja: huLongDate(inp.change?.closingOn ?? null) || 'a megszűnés napja (legkorábban holnap)',
    firstName: inp.firstName,
    firstNameWith: inp.firstNameWith ?? `${inp.firstName}val`,
    firstNameAcc: inp.firstNameAcc ?? `${inp.firstName}t`,
  };
  const fill = (s: string) => fillPlaceholders(s, values);
  const steps: PersonalisedGuideStep[] = [];
  for (const st of t.steps) {
    const fields: PersonalisedGuideField[] = st.fields.map((f) => ({ label: fill(f.label), action: f.action, ...(f.value ? { value: fill(f.value) } : {}), ...(f.why ? { why: fill(f.why) } : {}) }));
    if (st.key === 'utana') {
      for (const r of CLOSING_AFTER_ROWS) {
        if (r.when && inp.regime && r.when !== inp.regime) continue;
        fields.push({ label: fill(r.text), action: 'ellenorizd', why: `${inp.firstName} intézi` });
      }
    }
    if (st.key === 'megorzes') for (const k of [...CLOSING_KEEP_ROWS].reverse()) fields.unshift({ label: k, action: 'ellenorizd' });
    steps.push({
      key: st.key,
      n: steps.length + 1,
      screenTitle: fill(st.screenTitle),
      text: fill(st.text),
      fields,
      ...(st.warning ? { warning: fill(st.warning) } : {}),
      ...(st.link ? { link: st.link } : {}),
      ownApp: Boolean(st.ownApp),
      screenKind: st.screenKind ?? (st.ownApp ? 'app' : 'nav'),
      imageKey: `megszuntetes__${st.key}`,
      done: inp.progress.includes(st.key),
    });
  }
  return { title: fill(t.title), intro: fill(t.intro), outro: fill(t.outro), validUntil: inp.ugysegedValidUntil ?? t.validUntil, steps, activityPending: false, version: CLOSING_GUIDE_VERSION };
}
/** Accountant follow-ups on change-done (SPEC §29.7). */
export const CLOSING_FOLLOWUPS = ['zaro_jarulek_bevallas', 'szja_eves', 'kata_zaro', 'hipa_soron_kivuli', 'afa_ellenorzes', 'meghatalmazas_megszuntetes', 'elofizetes_lezaras'] as const;
export type ClosingFollowup = (typeof CLOSING_FOLLOWUPS)[number];
export const CLOSING_FOLLOWUP_LABELS: Record<ClosingFollowup, string> = {
  zaro_jarulek_bevallas: "Záró járulékbevallás ('58) a megszűnés negyedévéről",
  szja_eves: 'Éves zárás felvéve a megszűnés évére',
  kata_zaro: 'Kata-nyilatkozat (30 napon belül) – csak katásnál',
  hipa_soron_kivuli: 'Soron kívüli iparűzésiadó-bevallás',
  afa_ellenorzes: 'ÁFA-kötelezettségek átnézve',
  meghatalmazas_megszuntetes: 'NAV-meghatalmazás megszüntetve (az utolsó bevallás után)',
  elofizetes_lezaras: 'Minden kész – az előfizetés lezárása az időszak végén',
};
/** The help-guide "Mit jelent?" key list for the explainer of the hub row. */
export const CLOSING_HANDBOOK =
  'Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó „Más ügyében járok el” → az ügyfél → „Új bejelentés, kérelem benyújtása” → az egyéni vállalkozás megszüntetése [ELLENŐRIZENDŐ: pontos név] → a megszűnés napja (legkorábban holnap; nem módosítható) → Ellenőrzés → beküldés → Megtekintés → Letöltés → töltsd fel itt.';

// =====================================================================================================================
// F4 – határidők a saját naptárban (SPEC §29.8)
// =====================================================================================================================

/** The only texts an iCal SUMMARY may hold: no name, no amount, no adószám, no accountant name. */
export const ICAL_LABELS = [
  'SZJA-előleg befizetése',
  'TB-járulék befizetése',
  'Szocho befizetése',
  'Adóbefizetés (negyedéves)',
  'Negyedéves bevallás',
  'Kata befizetése',
  'Iparűzésiadó-előleg',
  'SZJA-bevallás',
  'Iparűzésiadó-bevallás',
  'Kata-nyilatkozat',
  'Éves zárás kérdőív',
  'Könyvelői kérés határideje',
  'Határidő',
] as const;
export type IcalLabel = (typeof ICAL_LABELS)[number];
export const CALENDAR_RULES = {
  feedPastDays: 30,
  feedAheadDays: 400,
  perTokenPerHour: 60,
  perIpPerHour: 600,
} as const;
export const CALENDAR_TEXTS = {
  calName: '{brand} – határidők',
  description: 'Részletek az {brand} appban: {url}',
  sectionTitle: 'Naptárba',
  sectionSub: 'A határidőid a saját naptáradban is.',
  subscribe: 'Feliratkozom a naptáramban',
  sheetTitle: 'Melyik naptárat használod?',
  google: 'Google Naptár',
  apple: 'Apple Naptár',
  outlook: 'Outlook',
  copy: 'Link másolása',
  copied: 'Kimásoltad a linket.',
  info: 'A naptárad naponta frissíti. A naptárban csak a határidő neve látszik, összeg és név nem.',
  rotate: 'Új linket kérek',
  rotateAsk: 'Új linket kérsz? A régi azonnal megszűnik: a naptáradban is cseréld le.',
  rotated: 'Kész az új link. A régit töröld a naptáradból.',
  off: 'Kikapcsolom',
  offAsk: 'Kikapcsolod? A link azonnal megszűnik.',
  offDone: 'Kikapcsoltad. A naptáradból a feliratkozást is törölheted.',
  on: 'Bekapcsolva',
  rowButton: 'Naptárba',
  rowSheetTitle: 'Naptárba teszem',
  rowGoogle: 'Google',
  rowApple: 'Apple',
  rowOutlook: 'Outlook',
} as const;
/** GET /client/calendar */
export interface CalendarFeedView {
  enabled: boolean;
  httpsUrl: string | null;
  webcalUrl: string | null;
  googleUrl: string | null;
  outlookUrl: string | null;
  createdAt: _ISODateTime | null;
  lastFetchedAt: _ISODateTime | null;
}
/** Maps a Deadline (id + kind + title) to the fixed iCal label – pure, shared by the feed and the per-row event. */
export function icalLabelFor(d: { id: string; kind: string; title: string }, regime: 'atalany' | 'kata' | null = null): IcalLabel {
  const t = d.title.toLowerCase();
  if (d.id.startsWith('req:')) return 'Könyvelői kérés határideje';
  if (d.id.startsWith('ev:') && d.id.endsWith(':szja')) return 'SZJA-bevallás';
  if (d.id.startsWith('ev:') && d.id.endsWith(':hipa')) return 'Iparűzésiadó-bevallás';
  if (d.id.startsWith('per:') && d.id.endsWith(':bevallas')) return 'Negyedéves bevallás';
  if (/ip(a|ar)r?űz/i.test(t) || t.includes('hipa')) return d.kind === 'bevallas' ? 'Iparűzésiadó-bevallás' : 'Iparűzésiadó-előleg';
  if (t.includes('kata') && t.includes('nyilatkozat')) return 'Kata-nyilatkozat';
  if (t.includes('kata') || (regime === 'kata' && d.kind === 'befizetes')) return 'Kata befizetése';
  if (t.includes('éves zárás') || t.includes('kérdőív')) return 'Éves zárás kérdőív';
  if (d.id.startsWith('per:') && d.id.endsWith(':befizetes')) {
    if (t.includes('tb') || t.includes('szocho')) return 'Adóbefizetés (negyedéves)';
    if (t.includes('szja')) return 'SZJA-előleg befizetése';
    return 'Adóbefizetés (negyedéves)';
  }
  if (d.kind === 'bevallas' && t.includes('szja')) return 'SZJA-bevallás';
  if (d.kind === 'befizetes') return 'Adóbefizetés (negyedéves)';
  return 'Határidő';
}

// =====================================================================================================================
// F9 – tulaj-konzol (SPEC §29.9)
// =====================================================================================================================

export const TERMINATION_KINDS = ['rendes', 'azonnali_dij', 'azonnali_mas', 'ugyfel_kerte'] as const;
export type TerminationKind = (typeof TERMINATION_KINDS)[number];
export const TERMINATION_SUB_REASONS = ['valotlan_adat_pmt', 'jogellenes', 'bantalmazo'] as const;
export type TerminationSubReason = (typeof TERMINATION_SUB_REASONS)[number];
export const TERMINATION_CLIENT_WHEN = ['idoszak_vege', 'azonnal'] as const;
export type TerminationClientWhen = (typeof TERMINATION_CLIENT_WHEN)[number];
export const TERMINATION_RULES = {
  noticeDays: 30,
  /** azonnali_dij only when the oldest unpaid fee is older than this. */
  unpaidDays: 30,
  reasonMin: 5,
  reasonMax: 1000,
} as const;
export const TERMINATION_KIND_LABELS: Record<TerminationKind, string> = {
  rendes: 'Rendes felmondás (30 nap)',
  azonnali_dij: 'Azonnali – díjtartozás (30 napon túli)',
  azonnali_mas: 'Azonnali – más ÁSZF 8.5. ok',
  ugyfel_kerte: 'Az ügyfél kérte',
};
export const TERMINATION_SUB_REASON_LABELS: Record<TerminationSubReason, string> = {
  valotlan_adat_pmt: 'Valótlan adat, vagy nem működik közre az azonosításban (Pmt.)',
  jogellenes: 'Jogellenes tevékenységre használná',
  bantalmazo: 'Bántó, fenyegető viselkedés',
};
/** Plain-language reason in the client's letter (the internal reason is never printed for 'rendes'). */
export const TERMINATION_SUB_REASON_CLIENT: Record<TerminationSubReason, string> = {
  valotlan_adat_pmt: 'valótlan adatot adtál meg, vagy nem működtél közre az azonosításban, amit a pénzmosás elleni törvény előír',
  jogellenes: 'a szolgáltatást jogellenes tevékenységre akartad használni, vagy erre kérted a könyvelőt',
  bantalmazo: 'a könyvelővel vagy velünk szemben bántó, fenyegető módon viselkedtél',
};
export const TERMINATION_TEXTS = {
  refusedUnpaid: 'Az ÁSZF szerint azonnal csak 30 napnál régebbi tartozás miatt mondhatunk fel.',
  needSubReason: 'Válaszd ki az ÁSZF 8.5. szerinti okot.',
  alreadyTerminated: 'Ennek az ügyfélnek a szerződését már felmondtuk.',
  notifTitle: 'Felmondtuk a szerződésedet',
  notifBody: '{datum}-ig minden marad. A részleteket a levélben olvasod.',
  notifBodyNow: 'A szerződésed ma megszűnt. A részleteket a levélben olvasod.',
  notifTitleClient: 'Megszűnik a szerződésed',
  notifBodyClient: 'Ahogy kérted: {datum}-ig minden marad. A részleteket a levélben olvasod.',
  reactivatedTitle: 'Újra nálunk vagy',
  reactivatedBody: 'Újraindítottuk a fiókodat. Fogadd el a szerződést, és add meg a kártyádat, és folytatjuk.',
  accTaskMeghatalmazas: 'Meghatalmazás megszüntetése a NAV-nál (8 napon belül)',
  accTaskTechUser: 'Technikai felhasználó letiltása',
  documentTitle: 'Felmondás – {datum}',
} as const;
/** The written notice (Markdown subset of lib/pdf). Placeholders filled by the backend. */
export const TERMINATION_LETTER = {
  head: '# Felmondás\n\n**{szolgaltato}** ({szolgaltatoCim}) – {brand}\n\nCímzett: **{ugyfelNev}**{ugyfelCim}\n\nKelt: {kelt}\n\nKedves {ugyfelKeresztnev}!',
  rendes:
    'Az Általános Szerződési Feltételek 8.5. pontja alapján a köztünk lévő szerződést **30 napos felmondási idővel felmondjuk**. A szerződés **{hatalyNap}** napján szűnik meg. Addig minden szolgáltatás változatlanul jár, és a felmondás után már nem vonunk le több havidíjat.',
  azonnali_dij:
    'A köztünk lévő szerződést **azonnali hatállyal felmondjuk**, mert a díj több mint 30 napja rendezetlen (ÁSZF 8.5. pont). A szerződés **{hatalyNap}** napján megszűnt.',
  azonnali_mas: 'A köztünk lévő szerződést **azonnali hatállyal felmondjuk**, mert {ok} (ÁSZF 8.5. pont). A szerződés **{hatalyNap}** napján megszűnt.',
  ugyfel_kerte_idoszak_vege: 'Ahogy kérted, a szerződésünk a kifizetett időszak végén, **{hatalyNap}** napján megszűnik (ÁSZF 8.1. pont). Addig minden szolgáltatás változatlanul jár.',
  ugyfel_kerte_azonnal:
    'Ahogy kérted, a szerződésünk **azonnali hatállyal, {hatalyNap} napján megszűnt** (ÁSZF 8.3. pont). A kifizetett hónapból hátralévő napok díját visszautaljuk.',
  data:
    '## Mi lesz az adataiddal?\n\n- A fiókodba a megszűnés után is be tudsz lépni, és minden adatodat letöltheted egy fájlban (Fiók → Adataim letöltése).\n- Amit a törvény miatt meg kell őriznünk (például a díjszámlákat és a könyvelt iratokat), azt a határidő végéig titkosítva megtartjuk.\n- A könyvelőd 8 napon belül megszünteti a NAV-nál a meghatalmazását. Te magad is visszavonhatod az ONYA-ban.\n- A NAV Online Számla technikai felhasználó kulcsait töröljük.',
  settlementTitle: '## Elszámolás',
  settlementPaid: '- Kifizetett időszak: {idoszak}',
  settlementNone: '- Kifizetett időszak: nincs',
  settlementRefund: '- Visszautalás: {osszeg} Ft (a kártyádra, pár munkanap alatt)',
  settlementOpen: '- Nyitott díj: {label} – {osszeg} Ft. Ezt az appban továbbra is kifizetheted.',
  settlementAnnual: '- Éves zárás: {szoveg}',
  settlementNoCharge: '- A felmondás után nem vonunk le több havidíjat.',
  close: 'Ha kérdésed van, írj nekünk az appban (Üzenetek).\n\nÜdvözlettel:\n{szolgaltato}',
} as const;

export const PRICE_OVERRIDE_KINDS = ['egyedi_ar', 'kedvezmeny_szazalek', 'ingyenes_honap'] as const;
export type PriceOverrideKind = (typeof PRICE_OVERRIDE_KINDS)[number];
export const PRICE_OVERRIDE_LABELS: Record<PriceOverrideKind, string> = {
  egyedi_ar: 'Egyedi havidíj',
  kedvezmeny_szazalek: 'Kedvezmény (%)',
  ingyenes_honap: 'Ingyenes hónap',
};
export const CONSOLE_RULES = {
  stepUpMinutes: 10,
  reasonMin: 5,
  announcementsPerDay: 3,
  announcementTitleMax: 80,
  announcementBodyMax: 600,
  lockFeloldvaMaxDays: 30,
  messageMax: 4000,
  priceRiseNoticeDays: 30,
} as const;
export const CONSOLE_SECTIONS = [
  'profil',
  'hozzajarulasok',
  'elofizetes',
  'fizetesek',
  'dijszamlak',
  'kartya',
  'dijak',
  'keresek',
  'uzenetek',
  'dokumentumok',
  'igazolasok',
  'nav',
  'ertesitesek',
  'belepesek',
  'naplo',
] as const;
export type ConsoleSection = (typeof CONSOLE_SECTIONS)[number];
export const CONSOLE_SECTION_LABELS: Record<ConsoleSection, string> = {
  profil: 'Profil és vállalkozás',
  hozzajarulasok: 'Hozzájárulások',
  elofizetes: 'Előfizetés és ár',
  fizetesek: 'Fizetések',
  dijszamlak: 'Díjszámlák',
  kartya: 'Kártya',
  dijak: 'Díjak',
  keresek: 'Kérések',
  uzenetek: 'Üzenetek',
  dokumentumok: 'Dokumentumok',
  igazolasok: 'Igazolások',
  nav: 'NAV-kapcsolat',
  ertesitesek: 'Értesítések',
  belepesek: 'Belépések',
  naplo: 'Napló',
};
export const CONSOLE_TEXTS = {
  title: 'Konzol',
  sub: 'Minden ügyfél, minden szám. Minden módosítás naplózva.',
  stepUpTitle: 'Kétlépcsős kód',
  stepUpBody: 'Módosítás előtt add meg a hitelesítő appod kódját (vagy egy tartalék kódot). 10 percig érvényes.',
  stepUpButton: 'Megerősítem',
  confirm: 'Megerősítem',
  reason: 'Indoklás (a naplóba kerül)',
  reasonHint: 'Legalább 5 karakter.',
  irreversible: 'Ez nem visszavonható.',
  preview: 'Ügyfél szemével',
  previewBanner: 'Így látja most – csak nézet',
  navOverride: 'Ezt a NAV-adatbázisból töltöttük ki. Ha átírod, nézd meg az ONYA-ban is.',
  actions: 'Műveletek',
  done: 'Kész.',
  tiles: {
    active: 'Aktív ügyfél',
    onboarding: 'Bekötés alatt',
    suspended: 'Felfüggesztve',
    terminated: 'Megszűnt',
    mrr: 'Havi ismétlődő bevétel',
    overdue: 'Elmaradt fizetés',
    locked: 'Zárolt ügyfél',
    upcoming7: 'Levonás 7 napon belül',
    upcoming30: 'Levonás 30 napon belül',
  },
  sendCodeVerify: 'Megerősítő kódot küldtünk az ügyfél címére.',
  sendCodeReset: 'Jelszó-visszaállító kódot küldtünk az ügyfél címére.',
} as const;
export const CONSOLE_NOTIFICATION_TEXTS = {
  contract_terminated: {
    rendes: { title: 'Felmondtuk a szerződésedet', body: '{datum}-ig minden marad. A részleteket a levélben olvasod.' },
    azonnali: { title: 'Felmondtuk a szerződésedet', body: 'A szerződésed ma megszűnt. A részleteket a levélben olvasod.' },
    ugyfel_kerte: { title: 'Megszűnik a szerződésed', body: 'Ahogy kérted: {datum}-ig minden marad. A részleteket a levélben olvasod.' },
  },
  contract_reactivated: { title: 'Újra nálunk vagy', body: 'Újraindítottuk a fiókodat. Fogadd el a szerződést, add meg a kártyádat, és folytatjuk.' },
  price_changed: {
    title: 'Változik a havidíjad',
    body: '{datum}-tól havi {osszeg} Ft. Ha nem szeretnéd, előtte lemondhatod: Fiók → Előfizetés.',
    lower: { title: 'Kedvezményt kaptál', body: '{szoveg}' },
  },
  profile_changed_by_admin: { title: 'Módosítottuk az adataidat', body: 'Ezeket írtuk át: {mezok}. Ha nem stimmel valami, írj nekünk.' },
  announcement: { title: '{cim}', body: '{szoveg}' },
} as const;

/** Overview tile numbers (GET /admin/console/overview). Amounts in Ft. */
export interface ConsoleOverview {
  generatedAt: _ISODateTime;
  demo: boolean;
  clients: {
    active: number;
    activeAtalany: number;
    activeKata: number;
    onboarding: number;
    suspended: number;
    terminated: number;
    perMonth: { month: _MonthKey; uj: number; lemondott: number }[];
  };
  money: {
    mrrHuf: number;
    collectedPerMonth: { month: _MonthKey; havidijHuf: number; egyszeriHuf: number; visszaHuf: number; nettoHuf: number }[];
    overdue: { count: number; sumHuf: number };
    actionNeeded: number;
    locked: { count: number; reasons: Record<string, number> };
    upcoming7: { count: number; sumHuf: number };
    upcoming30: { count: number; sumHuf: number };
    feesByKind: { kind: string; label: string; month: _MonthKey; paid: number; paidHuf: number; open: number; waived: number }[];
    /** payments by mode (DEMO counted separately in demo) */
    demoPayments: number;
  };
  accountants: { id: string; name: string; clients: number; openTasks: number; oldest: { kind: string; ageDays: number } | null }[];
}
export interface ConsoleClientRow {
  id: string;
  name: string;
  email: string;
  regime: 'atalany' | 'kata' | null;
  accountantName: string | null;
  lifecycle: string;
  subscriptionStatus: string | null;
  nextChargeOn: _ISODate | null;
  unpaidHuf: number;
  locked: boolean;
  terminated: boolean;
  anonymized: boolean;
  isTest: boolean;
  createdAt: _ISODateTime;
}
export interface ConsoleClientQuery {
  q?: string;
  status?: string;
  regime?: 'atalany' | 'kata';
  accountant?: string;
  unpaid?: boolean;
  locked?: boolean;
  cancelled?: boolean;
  terminated?: boolean;
  cursor?: string;
}
export interface ConsoleField {
  key: string;
  label: string;
  value: string | null;
  /** masked encrypted field: GET …/reveal?field=key decrypts (audited) */
  masked?: boolean;
  /** came from the NAV taxpayer lookup */
  nav?: boolean;
  editable?: boolean;
}
/** GET /admin/console/clients/:id → header + section list; each section from its own endpoint. */
export interface ConsoleClientHeader {
  id: string;
  name: string;
  email: string;
  lifecycle: string;
  lifecycleLabel: string;
  regime: 'atalany' | 'kata' | null;
  accountant: { id: string; name: string } | null;
  subscriptionStatus: string | null;
  locked: string[];
  manualLock: { mode: 'zarolva' | 'feloldva'; until: _ISODate | null; reason: string } | null;
  terminated: { kind: TerminationKind; effectiveOn: _ISODate; noticeAt: _ISODateTime; reasonShort: string } | null;
  anonymizedAt: _ISODateTime | null;
  userStatus: string;
  sections: { key: ConsoleSection; label: string }[];
  canReactivate: boolean;
  canAnonymize: { ok: boolean; blockers: string[] };
}
/** GET /admin/console/clients/:id/:section */
export interface ConsoleSectionView {
  key: ConsoleSection;
  title: string;
  fields?: ConsoleField[];
  /** generic table: column labels + rows of cells (strings); `id` lets the panel attach row actions */
  tables?: { title: string; columns: string[]; rows: { id?: string; cells: (string | null)[]; chip?: string | null; actions?: string[] }[] }[];
  note?: string | null;
}
/** GET /admin/console/clients/:id/preview – simplified client screens ("Ügyfél szemével"). */
export interface ConsolePreview {
  clientName: string;
  screens: { key: 'fooldal' | 'bekotes' | 'elofizetes' | 'dijak'; title: string; lines: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' | null }[] }[];
}
export interface ConsoleStepUpInput {
  code: string;
}
export interface ConsoleProfilePatch {
  fields: Record<string, string | null>;
  confirmNavOverride?: boolean;
  reason?: string;
}
export interface ConsolePriceInput {
  kind: PriceOverrideKind;
  amountHuf?: number;
  percent?: number;
  months?: number;
  fromPeriod: _ISODate;
  untilPeriod?: _ISODate | null;
  reason: string;
}
export interface ConsoleFeeInput {
  kind: string;
  amountHuf?: number;
  note: string;
  reason: string;
}
export interface ConsoleLockInput {
  mode: 'zarolva' | 'feloldva';
  until?: _ISODate | null;
  reason: string;
}
export interface ConsolePauseInput {
  from: _ISODate;
  to?: _ISODate | null;
  reason: string;
}
export interface ConsoleTerminateInput {
  kind: TerminationKind;
  subReason?: TerminationSubReason;
  when?: TerminationClientWhen;
  reason: string;
  effectiveOn?: _ISODate;
}
export interface ConsoleAnnouncementInput {
  title: string;
  body: string;
  channels: { inApp: true; push: boolean; email: boolean };
  filter: { lifecycle?: string[]; regime?: 'atalany' | 'kata'; accountantId?: string; clientIds?: string[] };
  /** omitted = dry run (returns the count); the send must echo the dry-run count */
  expectedCount?: number;
}
export interface ConsoleActionResult {
  ok: true;
  message: string;
  /** e.g. the one-time GDPR export link, the charge outcome */
  data?: Record<string, unknown>;
}

/** Fields of the console profile edit (the same validators as the client forms). */
export const CONSOLE_PROFILE_FIELDS = [
  'lastName',
  'firstName',
  'birthName',
  'email',
  'phone',
  'adoazonositoJel',
  'adoszam',
  'evNyilvantartasiSzam',
  'evSince',
  'addressZip',
  'addressCity',
  'addressLine',
  'hqMunicipality',
  'activityText',
] as const;
export type ConsoleProfileField = (typeof CONSOLE_PROFILE_FIELDS)[number];
export const CONSOLE_PROFILE_LABELS: Record<ConsoleProfileField, string> = {
  lastName: 'Vezetéknév',
  firstName: 'Keresztnév',
  birthName: 'Születési név',
  email: 'E-mail-cím',
  phone: 'Telefonszám',
  adoazonositoJel: 'Adóazonosító jel',
  adoszam: 'Adószám',
  evNyilvantartasiSzam: 'EV nyilvántartási szám',
  evSince: 'Egyéni vállalkozó mióta',
  addressZip: 'Irányítószám',
  addressCity: 'Település',
  addressLine: 'Utca, házszám',
  hqMunicipality: 'Székhely települése',
  activityText: 'Tevékenység',
};
/** Encrypted columns: shown masked, "Mutasd" decrypts (audited). */
export const CONSOLE_MASKED_FIELDS: readonly ConsoleProfileField[] = ['phone', 'adoazonositoJel'];
/** Filled from the NAV taxpayer lookup when business_identity_source = 'nav' (override needs confirmNavOverride + reason). */
export const CONSOLE_NAV_FIELDS: readonly ConsoleProfileField[] = ['adoszam', 'evNyilvantartasiSzam', 'evSince', 'addressZip', 'addressCity', 'addressLine', 'hqMunicipality'];

/** Helper used by the backend and the panel: "Kovács Bence" style full name. */
export function fullNameHu(lastName: string | null | undefined, firstName: string | null | undefined): string {
  return [lastName, firstName].filter((x) => x && String(x).trim()).join(' ');
}
