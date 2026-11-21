// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
// SPEC §32 – KATA (F0 + F1a, 2026-11-21): monthly KATA items, the payment sheet, reminders, the keret meter, free months,
// the 2027 variants (T/928 – switched OFF until the law is published). Texts are tegező, short, no "a(z)" (fill() fixes
// the article before a placeholder), no time promise. The backend serves them as content (content/kata.ts → kata.*,
// fizetes.*, notif.*); the app and the panel import the same constants.
//
// Sources of the rules: Kata tv. (2022. évi XIII. tv.) 5. § (1) e), 7. § (1)–(10), 10. § – njt, checked 2026-11-21;
// NAV 99. füzet; NAV számlaszám-jegyzék 2026.11.01-től; T/928/9 (2026-11-20, NOT law).

import type { ISODate } from './api';

/** client_tax_profiles.kata_variant: 'regi' = Kata tv. KATA; 'uj' = the T/928 new KATA (2027-, only if enacted). */
export const KATA_VARIANTS = ['regi', 'uj'] as const;
export type KataVariantKey = (typeof KATA_VARIANTS)[number];

/** Kata tv. 7. § (8) a)–d). Recorded only by the accountant [DÁVID D21]. */
export const KATA_EXEMPT_KINDS = ['tappenz', 'csed', 'orokbefogadoi_dij', 'gyed', 'gyes', 'gyet', 'gyod', 'apolasi_dij', 'tartalekos', 'fogvatartott', 'szunetel'] as const;
export type KataExemptKind = (typeof KATA_EXEMPT_KINDS)[number];
/** Client wording of the free-month reason ("nem kell fizetned (táppénz)"). Baleseti táppénz = táppénz. */
export const KATA_EXEMPT_LABELS: Record<KataExemptKind, string> = {
  tappenz: 'táppénz',
  csed: 'CSED',
  orokbefogadoi_dij: 'örökbefogadói díj',
  gyed: 'GYED',
  gyes: 'GYES',
  gyet: 'GYET',
  gyod: 'gyermekek otthongondozási díja',
  apolasi_dij: 'ápolási díj',
  tartalekos: 'tartalékos katonai szolgálat',
  fogvatartott: 'fogvatartás',
  szunetel: 'szünetel a vállalkozásod',
};
/** Panel labels with the paragraph; [DÁVID K9] for the reasons the plan did not list (the critique found them in 7. § (8) a)). */
export const KATA_EXEMPT_PANEL_LABELS: Record<KataExemptKind, string> = {
  tappenz: 'Táppénz, baleseti táppénz – 7. § (8) a)',
  csed: 'CSED – 7. § (8) a)',
  orokbefogadoi_dij: 'Örökbefogadói díj – 7. § (8) a) [Dávid erősítse meg]',
  gyed: 'GYED – 7. § (8) a)',
  gyes: 'GYES – 7. § (8) a)',
  gyet: 'GYET – 7. § (8) a)',
  gyod: 'Gyermekek otthongondozási díja – 7. § (8) a) [Dávid erősítse meg]',
  apolasi_dij: 'Ápolási díj – 7. § (8) a)',
  tartalekos: 'Önkéntes tartalékos katonai szolgálat – 7. § (8) b)',
  fogvatartott: 'Fogvatartás – 7. § (8) c)',
  szunetel: 'Szünetelés – 7. § (8) d) (nincs bejelentés)',
};
/** a)–c): the free month must be reported by the 12th of the next month (7. § (10)); szünetelés not. */
export function kataExemptNeedsReport(k: KataExemptKind): boolean {
  return k !== 'szunetel';
}

/** Why a tax_periods row is hidden (never deleted). */
export const TAX_PERIOD_HIDDEN_REASONS = ['kata_ev', 'nem_kata'] as const;
export type TaxPeriodHiddenReason = (typeof TAX_PERIOD_HIDDEN_REASONS)[number];

export const KATA_F1_RULES = {
  /** tax_due_soon.kata on this day of the month (or the next working day) for the month due on the 12th. */
  reminderDay: 8,
  /** Client year-end notice (MM-DD, or the next working day) – only for unmarked, overdue KATA items (switch). */
  yearEndClientDay: '12-16',
  /** Accountant year-end tasks (MM-DD): every KATA client; the second one in the last full week (critique 2.3). */
  yearEndStaffDays: ['12-10', '12-22'],
  /** Kata tv. 5. § (1) e). */
  debtLimitHuf: 100_000,
  /** Free-month notice reminder for the accountant this many days before the 12th. */
  exemptReportDaysBefore: 3,
} as const;

/**
 * Switches (SPEC §32; code defaults, override: system_state['kapcsolok.ev_ciklus'] = JSON with the same keys).
 *  - kata2027: the 2027 KATA rules (T/928) – OFF until the law is published in the Magyar Közlöny and the final text is
 *    checked (then also clear `draft` in ado-motor/src/rules/2027.ts). Off: 2027 KATA months without amount, no reminder.
 *  - kataElorejelzesUgyfelnek: the client sees the year-end projection of the keret (off: only the accountant) [D28].
 *  - kataEvVegeUgyfelnek: the December notice to the client – 'jeloletlen' = only for unmarked overdue KATA items.
 *  - evesZarasDij: the 14 999 Ft annual-closing fee at questionnaire submit – OFF until the ÁSZF is fixed [T1, JOGI].
 * SPEC §32.B (éves ciklus, F2/F3):
 *  - lemondottEvesZaras: the last year of a client whose service ended / is suspended – 'ki' (default, the behaviour so
 *    far: the closing opens only for an active client), 'kezi' (the accountant opens it by hand), 'automatikus' (opens on
 *    5 January like for an active client) [TULAJ T4]. See eves.ts LEMONDOTT_EVES_ZARAS.
 *  - refundDatumUgyfelnek: the "Ha {datum} után sem érkezett meg, írj nekünk" sentence of the refund card (Art. 64. § (1)).
 *  - reszletfizetesSzoveg: "Ha egyszerre nem tudod kifizetni, írj nekünk…" under the amount to pay [T6] – off.
 *  - csjkBirsagTetel: the 12 % különbözeti bírság as its own payment item [DÁVID D4] – off (it stays in the difference).
 */
export const EVES_KAPCSOLOK_DEFAULT = {
  kata2027: false,
  kataElorejelzesUgyfelnek: false,
  kataEvVegeUgyfelnek: 'jeloletlen' as 'jeloletlen' | 'ki',
  evesZarasDij: false,
  lemondottEvesZaras: 'ki' as 'ki' | 'kezi' | 'automatikus',
  refundDatumUgyfelnek: true,
  reszletfizetesSzoveg: false,
  csjkBirsagTetel: false,
};
export type EvesKapcsolok = typeof EVES_KAPCSOLOK_DEFAULT;
export const EVES_KAPCSOLOK_KEY = 'kapcsolok.ev_ciklus';

// ---------- DTOs ----------
export interface KataBreak {
  from: ISODate;
  to: ISODate;
  kind: KataExemptKind;
  /** a)–c): when the accountant reported the free month to NAV (7. § (10)). */
  reportedOn?: ISODate | null;
}
/** PUT /acc/clients/:id/kata/breaks */
export interface KataBreaksInput {
  year: number;
  breaks: KataBreak[];
}
/** POST /acc/clients/:id/kata/verify – "Rendben" for several KATA months at once. */
export interface KataVerifyInput {
  periodIds: string[];
  note?: string;
}
export type KataMonthStatus =
  /** to pay, not marked */
  | 'fizetendo'
  | 'befizetve_jelezve'
  | 'ellenorizve'
  | 'elteres'
  /** free month (Kata tv. 7. § (8)–(9)) */
  | 'mentes'
  /** the amount is not confirmed (2027 / T/928) */
  | 'nincs_osszeg'
  /** before the app (backfilled): the accountant checks it on the folyószámla; the client does not see it */
  | 'ellenorizetlen';
export interface KataMonthView {
  periodId: string | null;
  month: number;
  monthKey: string;
  /** "november" */
  label: string;
  status: KataMonthStatus;
  liable: boolean;
  exemptReason: KataExemptKind | null;
  exemptReasonLabel: string | null;
  /** Free by the state but revenue arrived → to pay. */
  exemptLostByRevenue: boolean;
  amountHuf: number | null;
  dueDate: ISODate;
  overdue: boolean;
  markedPaidOn: ISODate | null;
  verification: 'rendben' | 'elteres' | null;
  backfilled: boolean;
  /** Marked or verified, but the month became free: overpayment, settle it on the folyószámla. */
  paidButExempt: boolean;
  /** Staff only: the free month still has to be reported (a)–c), no reportedOn). */
  reportDue?: ISODate | null;
  revenueInMonthHuf?: number;
}
export interface KataMeterView {
  usedHuf: number;
  limitHuf: number;
  /** 0..100+ (rounded) */
  pct: number;
  level: 'rendben' | 'figyelem' | 'tullepve';
  liableMonths: number;
  /** "Kereted: 10 hónap × 1 500 000 Ft" or "Kereted: 18 000 000 Ft" */
  limitLine: string;
  /** "Még 3 200 000 Ft fér bele." (null when over) */
  remainingLine: string | null;
  /** The warning under the bar (80–100 %, over, projection) or null. */
  warningLine: string | null;
  remainingHuf: number;
  overHuf: number;
  projectedHuf: number;
  /** 0 for the client while kataElorejelzesUgyfelnek is off. */
  projectedOverHuf: number;
  kulonadoEstimateHuf: number;
  kulonadoDue: ISODate | null;
  /** The rules are a draft (2027 / T/928). */
  draft: boolean;
}
export interface KataYearView {
  year: number;
  variant: KataVariantKey;
  fofoglalkozasu: boolean | null;
  kataFrom: ISODate | null;
  kataTo: ISODate | null;
  /** The confirmed monthly amount, or null (draft rules switched off / unknown). */
  monthlyHuf: number | null;
  /** The panel / app note when the year's rules are a draft (T/928). */
  draftNote: string | null;
  months: KataMonthView[];
  meter: KataMeterView;
  /** The earliest open, payable month (the Főoldal card), or null. */
  nextPayable: { periodId: string; label: string; amountHuf: number; dueDate: ISODate; overdue: boolean } | null;
  /** Staff only. */
  breaks?: KataBreak[];
  /** Staff only: months marked by the client and waiting for "Rendben". */
  toVerify?: number;
}

// ---------- client texts ----------
/** The shared payment sheet /fizetes/[id] (content fizetes.*). */
export const PAYMENT_SHEET_TEXTS = {
  cimKata: 'Kata – {honap}',
  alNyitott: 'Utald el {hatarido}.',
  alLejart: 'Lejárt: {datum} volt a határidő. Utald el minél előbb.',
  alTobb: '{n} külön tétel, {n} számlára. A bankodban külön utalásként add fel.',
  kedvezmenyezett: 'Kedvezményezett',
  szamlaszam: 'Számlaszám',
  kozlemeny: 'Közlemény',
  osszeg: 'Összeg',
  kozlemenyTipp: 'A közleménybe az adószámodat írd.',
  masolom: 'Másolom',
  kimasoltuk: 'Kimásoltuk',
  jeloles: 'Megjelölöm, hogy befizettem',
  jelolesAl: 'Ez csak jelölés: pénzt nem vonunk le, nem utalunk.',
  mikor: 'Mikor utaltad el?',
  jelolesGomb: 'Megjelölöm',
  jelolve: 'Befizetted, {firstName} ellenőrzi.',
  megse: 'Mégsem fizettem be',
  rendben: 'Rendben: {firstName} látta a befizetésedet.',
  elteres: '{firstName} eltérést talált. Nézd meg az üzenetét.',
  elteresGomb: 'Megnyitom az üzenetet',
  mentes: 'Erre a hónapra nem kell katát fizetned ({ok}).',
  nincsOsszeg: 'Az összeget {firstName} még megerősíti.',
  nincsJovahagyva: 'Ezt még nem hagyta jóvá {firstName}. Amint kész, itt látod az utalási adatokat.',
  vissza: 'Vissza',
} as const;

/** Főoldal + Határidők of a KATA client (content kata.*). */
export const KATA_F1_TEXTS = {
  keretCim: 'Idei kereted',
  keretSav: '{bevetel} / {keret} Ft',
  keretSor: 'Idén eddig a kereted {pct}%-át használtad.',
  keretHonapok: 'Kereted: {n} hónap × {havi} Ft',
  keretTeljes: 'Kereted: {keret} Ft',
  keretMaradek: 'Még {maradek} Ft fér bele.',
  keretKozel: 'Közel vagy a keretedhez. Ami fölé megy, annak 40%-át különadóként kell befizetned.',
  keretTullepve: '{tobblet} Ft-tal túlléptél a kereteden. Erre kb. {kulonado} Ft különadó jár, {hatarido} kell befizetni. Tegyél félre ennyit.',
  keretElore: 'Ha így folytatod, év végére kb. {tobblet} Ft-tal mész a kereted fölé. Beszélj {firstNameWith}, mit tehetsz.',
  keretTervezet: 'Az idei szabályok még nem véglegesek: {firstName} megerősíti őket.',
  nincsFizetnivalo: 'Most nincs mit fizetned. A következő kata: {honap}, {hatarido}.',
  fizetesCim: 'Utalj {osszeg} Ft-ot {hatarido}',
  fizetesCimLejart: 'Lejárt: utalj {osszeg} Ft-ot',
  fizetesGomb: 'Megnézem az utalási adatokat',
  hataridoBefizetes: 'Kata – {honap}: {osszeg} Ft',
  hataridoMentes: 'Kata – {honap}: nem kell fizetned ({ok})',
  hataridoNincsOsszeg: 'Kata – {honap}: az összeget {firstName} még megerősíti',
  hataridoNyilatkozat: 'Kata-nyilatkozat ({form}) – {who}',
  felretesz: 'Havonta {havi} Ft a kata. Ha a kereted fölé mennél, a fölötti rész 40%-át is félre kell tenned.',
} as const;

/** Panel (staff wording, tegező). */
export const KATA_PANEL_TEXTS = {
  cim: 'Kata {ev}',
  oszlopHonap: 'Hónap',
  oszlopAllapot: 'Állapot',
  oszlopHatarido: 'Határidő',
  oszlopOsszeg: 'Összeg',
  oszlopJelolte: 'Ügyfél jelölte',
  oszlopEllenorzes: 'Ellenőrzés',
  rendben: 'Rendben',
  elteres: 'Eltérés',
  csoportosRendben: 'Rendben (folyószámla alapján)',
  csoportosMegjegyzes: 'Megjegyzés (pl. „folyószámla 12-15”)',
  mentesHozzaad: 'Mentes időszak hozzáadása',
  mentesKezdet: 'Kezdet',
  mentesVeg: 'Vég',
  mentesOk: 'Ok',
  mentesBejelentve: 'Bejelentve a NAV-nak',
  mentesMentes: 'Mentés',
  mentesTorles: 'Eltávolítom',
  mentesSzabaly: 'Egész hónap mentes (Kata tv. 7. § (8)); a táppénz, CSED, GYED… végének hónapja is, ha az állapot legalább 30 napig tartott (7. § (9)). Ha a hónapban bevétel volt, mégis fizetni kell. Bejelentés a következő hónap 12-éig (7. § (10)), szünetelésnél nem kell.',
  befizetettMentes: 'Befizette, de mentes hónap: túlfizetés. Rendezd a folyószámlán.',
  bevetelMentesben: '{honap}: bevétel volt, ezért mégis fizetni kell (Kata tv. 7. § (8)).',
  ellenorizetlen: 'Az app előtti hónap: ellenőrizd a folyószámlán, és jelöld „Rendben”-re. Addig az ügyfél nem látja.',
  allapot: {
    fizetendo: 'Fizetendő',
    befizetve_jelezve: 'Ügyfél jelölte',
    ellenorizve: 'Rendben',
    elteres: 'Eltérés',
    mentes: 'Mentes',
    nincs_osszeg: 'Összeg nincs megerősítve',
    ellenorizetlen: 'Ellenőrizetlen (app előtti)',
  },
  tervezet2027: 'A {ev}. évi havi összeg nincs megerősítve (T/928 nincs kihirdetve). Addig a tételek összeg nélkül állnak, és emlékeztető sem megy.',
  valtozat: { regi: 'Kata (Kata tv.)', uj: 'Új kata (T/928)' },
  fofoglalkozasu: 'Főfoglalkozású',
  nemFofoglalkozasu: 'Nem főfoglalkozású',
  valtozatMegjegyzes: 'Az új kata (T/928) csak a törvény kihirdetése után választható élesben. Az ügyfélnek az app nem javasol adózási módot.',
  elorejelzes: 'Előrejelzés év végére: kb. {varhato} Ft (csak te látod).',
  keretSor: '{bevetel} / {keret} Ft ({pct}%)',
  evVege: 'Ha december 31-én 100 000 Ft-nál nagyobb a végrehajtható nettó adótartozása, megszűnik a katája (Kata tv. 5. § (1) e)); a megszüntető határozat véglegessé válásáig befizetve a NAV visszavonja.',
} as const;

/** Notification texts (content notif.<kind>.<variant>.title|body). */
export const KATA_NOTIFICATION_TEXTS = {
  tax_due_soon: {
    kata: { title: 'Utald el a katát: {osszeg} Ft', body: 'A {honap} havi kata határideje: {datum} Az utalási adatokat az appban látod.' },
    kata_ma: { title: 'Ma van a kata határideje', body: 'Utald el ma: {osszeg} Ft ({honap} havi kata). Az utalási adatokat az appban látod.' },
    kata_lejart: { title: 'Lejárt a kata határideje: {osszeg} Ft', body: 'A {honap} havi katát {hatarido} kellett volna befizetni. Utald el minél előbb; ha már megtetted, jelöld meg az appban.' },
    kata_ev_vege: {
      title: 'Ne maradjon adótartozásod az év végén',
      body: 'Ha december 31-én 100 000 Ft-nál nagyobb adótartozásod van, megszűnhet a katád. Nincs megjelölve: {honapok} ({osszeg} Ft). Utald el még az év vége előtt, és jelöld meg az appban.',
    },
  },
  /** E-mail body of kata_ev_vege: the in-app text + Kata tv. 5. § (1) e) (critique 2.3). */
  kataEvVegeEmail:
    'Ha december 31-én 100 000 Ft-nál nagyobb adótartozásod van, megszűnhet a katád. Nincs megjelölve: {honapok} ({osszeg} Ft). Utald el még az év vége előtt, és jelöld meg az appban.\n\nHa a NAV emiatt mégis határozatot hoz, és a határozat véglegessé válásáig befizeted a tartozást, a katád megmarad.\n\nHa már elutaltad, jelöld meg az appban, és {firstName} a NAV-nál ellenőrzi.',
  limit_warning: {
    kata80: { title: 'Elérted a kata-kereted {percent}%-át', body: 'Idén eddig {bevetel} Ft a bevételed, a kereted {keret} Ft. Ami fölé megy, annak 40%-át különadóként kell befizetned.' },
    kata100: { title: 'Túlléptél a kata-kereteden', body: '{tobblet} Ft-tal vagy a kereted fölött. Erre kb. {kulonado} Ft különadó jár, {hatarido} kell befizetni. Tegyél félre ennyit.' },
    kata_elore: { title: 'Év végére túlléphetsz a kata-kereteden', body: 'Ha így folytatod, kb. {tobblet} Ft-tal mész a kereted fölé. Beszélj {firstNameWith}, mit tehetsz.' },
    kata80_staff: { title: '{clientName} elérte a kata-keret {percent}%-át', body: 'Bevétel: {bevetel} Ft, keret: {keret} Ft, várható: {varhato} Ft.' },
    kata100_staff: { title: '{clientName} túllépte a kata-keretet', body: 'Többlet: {tobblet} Ft, különadó kb. {kulonado} Ft.' },
    kata_elore_staff: { title: '{clientName} év végére túllépheti a kata-keretet', body: 'Bevétel: {bevetel} Ft, várható: {varhato} Ft, keret: {keret} Ft.' },
  },
  tax_payment_verified: { kata: { title: '{firstName} látta a befizetésedet', body: 'A {honap} havi katád rendben megérkezett a NAV-hoz.' } },
  tax_payment_mismatch: { kata: { title: 'Eltérést látunk a befizetésednél', body: '{firstName} eltérést talált a {honap} havi katánál. Nézd meg az üzenetét.' } },
  tax_task: {
    kata_ev_vege: { title: 'Kata év vége: nézd meg {clientName} folyószámláját', body: 'Ha december 31-én 100 000 Ft-nál nagyobb a végrehajtható nettó adótartozása, megszűnik a katája (Kata tv. 5. § (1) e)). Nincs jelölve: {honapok}.' },
    mentesseg_bejelentes: { title: 'Mentesség bejelentése: {clientName}, {honap}', body: 'A bejelentés határideje: {datum} (Kata tv. 7. § (10)).' },
    backfill: { title: '{clientName}: ellenőrizd a korábbi kata-hónapokat', body: '{honapok} – az app indulása előtti hónapok. Nézd meg a folyószámlán, és jelöld őket.' },
    kata_osszeg: { title: '{clientName}: a {ev}. évi kata összege nincs megerősítve', body: 'A T/928 kihirdetéséig nincs végleges havi összeg. Addig a tételek összeg nélkül állnak, és emlékeztető sem megy.' },
    befizetett_mentes: { title: '{clientName}: befizetett, de mentes kata-hónap', body: '{honap}: túlfizetés lehet. Rendezd a folyószámlán.' },
  },
} as const;
