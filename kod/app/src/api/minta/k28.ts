// MINTA-szerver – SPEC §28 + §28.K végpontjai kitalált adatokkal (csak EXPO_PUBLIC_API_MODE=minta buildben töltődik be).
// A félreteendő összeg itt a §28.1 szabály egyszerűsített mása (45%, főfoglalkozású, minimum alatti alap: az adómentes
// rész után csak SZJA); a valódi számot a szerver az adómotorral számolja. Semmit nem küld sehova.
import fixtures from '../../_shared/demo/fixtures.json';
import type {
  AllowanceAnswers, AllowanceItemView, AllowanceState, AnnualAnswers, AnnualView, AssistView, ChangeData, ChangeGuidesView, CheckinItemAnswer,
  CheckinView, ClientHome, EarningsCard, EarningsMonthView, EarningsView, FeeChargeView, FeesView, InvoiceReserveView, NotificationSettings,
  PauseView, ReserveCard, ReserveListItem, ReserveView, ServiceLockView, TwoNumbersView,
} from '../../_shared/api';
import {
  ALLOWANCE_CLIENT_LINES, ALLOWANCE_LABELS, ALLOWANCE_TEXTS, ANNUAL_STATUS_CLIENT_TEXT, ANYAK_LABELS, CHANGE_STATUS_CLIENT_TEXT, CHANGE_TEXTS,
  CHECKIN_ITEM_TEXTS, EARNINGS_TEXTS, FEE_CHARGE_STATUS_LABELS, FEE_KIND_LABELS, FEE_TEXTS, fillPlaceholders, HOME_K_TEXTS, LOCK_TEXTS, PAUSE_TEXTS,
  RESERVE_TEXTS,
} from '../../_shared/bekotes';
import {
  CHANGE_KIND_ICON, CHANGE_KINDS, changeFeeKind, checkinItemsFor, FEE_DEFAULTS, QUIET_HOURS_DEFAULT, type AllowanceKind, type ChangeKind, type FeeKind,
} from '../../_shared/enums';
import type { Keres, Valasz } from '../http';
import { valtozasUtmutatoEpit } from '../../lib/utmutato';

// ---------- segédek ----------
const HO = ALLOWANCE_TEXTS.monthNames;
const sz = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const felfele = (n: number) => (n > 0 ? Math.ceil(n / 1000) * 1000 : n < 0 ? -Math.floor(-n / 1000) * 1000 : 0);
const ADOMENTES = 1_936_800;
const ARANY = 0.55; // 45% költséghányad
const HAVI_FIX = 101_682; // TB 59 718 + szocho 41 964 a minimálbér-alapon (2026)
const HIPA_EVES = 50_000;
const FN = 'Bence';

type Szamla = (typeof fixtures.navInvoices)['68801234'][number];
const SZAMLAK: Szamla[] = fixtures.navInvoices['68801234'];
const beerkezett = (s: Szamla) => (['CASH', 'CARD', 'VOUCHER'].includes(s.paymentMethod) ? s.issueDate : s.paymentDate ?? s.issueDate);
const maganszemely = (s: Szamla) => (s.customer as { vatStatus?: string }).vatStatus === 'PRIVATE_PERSON';

interface Tetel { id: string; navId: string | null; cim: string; al: string; erkezett: string; osszeg: number; becsult: boolean }
function tetelek(ma: string): Tetel[] {
  const t: Tetel[] = SZAMLAK.filter((s) => s.issueDate <= ma).map((s) => ({
    id: `bev-${s.invoiceNumber}`,
    navId: `nav-${s.invoiceNumber}`,
    cim: maganszemely(s) ? RESERVE_TEXTS.kepernyo.privatePerson : s.customer.name,
    al: s.invoiceNumber,
    erkezett: beerkezett(s),
    osszeg: s.grossAmountHuf,
    becsult: beerkezett(s) > ma,
  }));
  for (const [i, k] of fixtures.manualRevenue.kata.entries())
    if (k.receivedOn <= ma) t.push({ id: `kezi-${i}`, navId: null, cim: fillPlaceholders(RESERVE_TEXTS.kepernyo.manualItem, { description: (k as { description?: string }).description ?? 'készpénzes bevétel' }), al: 'Kézi tétel', erkezett: k.receivedOn, osszeg: k.amountHuf, becsult: false });
  return t.sort((a, b) => (a.erkezett < b.erkezett ? -1 : a.erkezett > b.erkezett ? 1 : a.id < b.id ? -1 : 1));
}

/** A §28.1 szabály egyszerűsítve: minden tétel annyi, amennyivel megnöveli az idei SZJA-t (az adómentes rész után 15%). */
function tartalekok(ma: string, szjaMentes: boolean): Map<string, InvoiceReserveView> {
  const ki = new Map<string, InvoiceReserveView>();
  let c = 0;
  for (const t of tetelek(ma)) {
    const elotte = Math.max(0, c - ADOMENTES);
    c += t.osszeg * ARANY;
    const utana = Math.max(0, c - ADOMENTES);
    const szja = szjaMentes ? 0 : Math.round((utana - elotte) * 0.15);
    const kuszob = c - t.osszeg * ARANY <= ADOMENTES && c > ADOMENTES;
    const zone = szja > 0 ? 'csak_szja' : utana === 0 ? 'adomentes' : 'nem_novel';
    const felre = felfele(szja);
    const ft = { osszeg: sz(t.osszeg), felre: sz(felre) };
    ki.set(t.id, {
      year: 2026,
      reserveHuf: felre,
      rawHuf: szja,
      parts: { szjaHuf: szja, tbHuf: 0, szochoHuf: 0 },
      zone,
      crossesTaxFree: kuszob,
      estimated: t.becsult,
      nextYear: false,
      line: fillPlaceholders(RESERVE_TEXTS.sor[zone], ft),
      listLine: felre > 0 ? fillPlaceholders(RESERVE_TEXTS.lista.felre, ft) : zone === 'adomentes' ? RESERVE_TEXTS.lista.adomentes : RESERVE_TEXTS.lista.nem_novel,
      partsText: zone === 'csak_szja' ? RESERVE_TEXTS.reszek.csak_szja : null,
      thresholdText: kuszob ? RESERVE_TEXTS.kuszob : null,
    });
  }
  return ki;
}

// ---------- állapot ----------
export interface K28Allapot {
  fk: string;
  kedvezmeny: { gate: AllowanceState['gate']; answers: AllowanceAnswers | null; version: number; submittedAt: string | null; items: AllowanceItemView[] };
  havi: CheckinView | null;
  dijak: FeeChargeView[];
  eves: AnnualView | null;
  jeloles: number | null;
  csend: NotificationSettings;
  valtozasok: AssistView[];
  szamlalo: number;
  zarolva: boolean;
  szunetel: boolean;
  alkalmazott: string | null;
}

const ures = (): AllowanceAnswers => ({
  birthMonth: null, children: [], otherDependants: 0, pregnancy: null, mother: null, csaladiWho: null, csaladiSharePct: null, csjkWish: null,
  marriage: null, disability: null, benefit: null, healthConsent: false, note: null,
});

function dijTetel(st: K28Allapot, kind: FeeKind, purpose: FeeChargeView['purpose'], ma: string): FeeChargeView {
  const d = FEE_DEFAULTS[kind];
  return {
    id: `dij-${st.szamlalo++}`, kind, label: FEE_KIND_LABELS[kind], amountHuf: d.amountHuf, demo: !d.confirmed, status: 'nyitott', statusText: FEE_CHARGE_STATUS_LABELS.nyitott,
    purpose, dueOn: null, createdAt: `${ma}T09:00:00Z`, paidAt: null, feeInvoice: null, canPay: true,
  };
}

function valtozasNezet(id: string, kind: ChangeKind, status: AssistView['status'], change: ChangeData | null, fee: FeeChargeView | null, ma: string): AssistView {
  const dij = fee ? sz(fee.amountHuf) : '';
  const tx = (CHANGE_STATUS_CLIENT_TEXT as Record<string, string>)[status] ?? 'Folyamatban.';
  return {
    id, kind, status, statusText: fillPlaceholders(tx, { firstName: FN, dij }), ball: status === 'dijra_var' || status === 'meghatalmazas_el' ? 'ugyfel' : 'konyvelo', callbackId: null,
    createdAt: `${ma}T09:00:00Z`, approval: null, clientApprovedAt: null, meghatalmazasLiveAt: null, consent: null, canConsent: status === 'meghatalmazas_el', evFiledAt: null,
    canCancel: !['bejelentes_bekuldve', 'kesz', 'visszavonva', 'lezarva'].includes(status), closedReason: null, closedAt: null, change, activityPending: false, feeCharge: fee,
  };
}

export function k28Kezdo(fk: string, ma: string): K28Allapot {
  const st: K28Allapot = {
    fk, kedvezmeny: { gate: null, answers: null, version: 0, submittedAt: null, items: [] }, havi: null, dijak: [], eves: null, jeloles: null,
    csend: { ...QUIET_HOURS_DEFAULT, quietEnabled: true, quietFrom: 20, quietTo: 8, pushShowAmounts: true } as NotificationSettings,
    valtozasok: [], szamlalo: 1, zarolva: fk === 'zarolt', szunetel: fk === 'szunetel', alkalmazott: null,
  };
  // novemberi havi ellenőrzés (október óta) – nyitott
  st.havi = { id: 'havi-2026-10', period: '2026-10', periodLabel: 'október', status: 'nyitott', dueOn: '2026-11-10', items: [], answeredAt: null };
  if (fk === 'eszter') {
    st.kedvezmeny = {
      gate: 'lehet', version: 1, submittedAt: '2026-11-16T18:20:00Z',
      answers: { ...ures(), birthMonth: '1990-04', mother: true, csaladiWho: 'kozosen', csaladiSharePct: 50, csjkWish: 'konyvelo_donti', children: [0, 1].map(() => ({ potlek: 'most' as const, sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null })) },
      items: [],
    };
    st.kedvezmeny.items = javaslat(st.kedvezmeny.answers!, 'javasolt');
  }
  if (fk === 'balint') {
    st.kedvezmeny = { gate: 'lehet', version: 1, submittedAt: '2026-02-03T10:00:00Z', answers: { ...ures(), birthMonth: '2002-03' }, items: [] };
    st.kedvezmeny.items = javaslat(st.kedvezmeny.answers!, 'jovahagyva');
  }
  if (fk === 'norbert') {
    const fee = dijTetel(st, 'valtozas_jogallas', { type: 'valtozas', assistId: 'valt-norbert' }, ma);
    st.dijak.push(fee);
    st.valtozasok.push(valtozasNezet('valt-norbert', 'valtozas_adoadat', 'dijra_var', { kind: 'valtozas_adoadat', items: ['munkavegzes'], workKind: 'munkaviszony_mellett', effectiveOn: '2026-11-03', note: null }, fee, ma));
    st.havi = {
      ...st.havi, status: 'valtozott', answeredAt: '2026-11-04T08:10:00Z',
      items: [{ item: 'munkaviszony', question: CHECKIN_ITEM_TEXTS.munkaviszony.question, status: 'dijra_var', statusText: 'Fizesd ki a díjat, és Bence nekilát.', assistId: 'valt-norbert', feeCharge: fee }],
    };
  }
  if (fk === 'adam') {
    st.valtozasok.push(
      valtozasNezet('valt-adam', 'valtozas_szekhely', 'meghatalmazas_el', { kind: 'valtozas_szekhely', address: { zip: '1117', city: 'Budapest', district: 'XI.', streetName: 'Próba', streetType: 'utca', houseNumber: '3' }, effectiveOn: '2026-12-01', right: 'berlet', provider: null, alsoHomeAddress: false }, null, ma),
    );
  }
  if (fk === 'eves') {
    st.eves = annualAlap('kerdoiv');
  }
  if (fk === 'szunetel') st.havi = { ...st.havi, items: [] };
  if (fk === 'zarolt') st.havi = null;
  return st;
}

function annualAlap(status: AnnualView['status']): AnnualView {
  return {
    id: 'eves-2026', year: 2026, regime: 'atalany', status, statusText: fillPlaceholders(ANNUAL_STATUS_CLIENT_TEXT[status], { firstName: FN, hatarido: 'március 15-ig', dij: sz(FEE_DEFAULTS.eves_zaras.amountHuf) }),
    questionnaireDue: '2027-03-15', legalDue: { szja: '2027-05-20', kata: null, hipa: '2027-05-31' }, answers: null, feeCharge: null, draft: null, approval: null,
    nextAction: status === 'kerdoiv' ? 'kitoltes' : status === 'dijra_var' ? 'fizetes' : status === 'jovahagyasra_var' ? 'jovahagyas' : null, canEdit: status === 'kerdoiv',
  };
}

// ---------- kedvezmények: a szerver javaslat-szabályainak egyszerű mása (SPEC §28.3.3) ----------
function honapok(tol: number, ig: number) {
  return Array.from({ length: Math.max(0, ig - tol + 1) }, (_, i) => tol + i);
}
function honapSzoveg(m: number[]) {
  if (!m.length) return '';
  return m.length === 1 ? HO[m[0] - 1] : `${HO[m[0] - 1]}–${HO[m[m.length - 1] - 1]}`;
}
const EV_SZJA = 260_000; // a minta-ügyfél idei becsült SZJA-ja (egyszerűsítve)
function hatas(kind: AllowanceKind, months: number[], a: AllowanceAnswers): number | null {
  const n = months.length;
  switch (kind) {
    case 'anya30':
    case 'anyak':
      return felfele(EV_SZJA);
    case 'fiatal25':
      return felfele(Math.min(EV_SZJA, 107_365 * n));
    case 'szemelyi':
      return felfele(16_140 * n);
    case 'elso_hazasok':
      return felfele((a.marriage?.who === 'kozosen' ? 2_500 : 5_000) * n);
    case 'csaladi': {
      const db = a.children.filter((c) => c.potlek === 'most').length;
      const keret = db >= 3 ? 66_000 * db : db === 2 ? 40_000 * db : 20_001;
      return felfele(Math.min(EV_SZJA, (keret * n * (a.csaladiWho === 'kozosen' ? (a.csaladiSharePct ?? 50) : 100)) / 100));
    }
    default:
      return null;
  }
}
function javaslat(a: AllowanceAnswers, status: 'javasolt' | 'jovahagyva'): AllowanceItemView[] {
  const ev = 2026;
  const by = a.birthMonth ? Number(a.birthMonth.slice(0, 4)) : null;
  const bm = a.birthMonth ? Number(a.birthMonth.slice(5, 7)) : 12;
  const ki: { kind: AllowanceKind; months: number[]; jogcim?: 'ket' | 'harom' | 'negyplusz' }[] = [];
  if (by && by + 25 > ev) ki.push({ kind: 'fiatal25', months: honapok(1, 12) });
  else if (by && by + 25 === ev) ki.push({ kind: 'fiatal25', months: honapok(1, bm) });
  const sajat = a.children.filter((c) => c.sajat && c.potlek !== 'nem').length;
  if (a.mother && by && by >= ev - 30 && (a.children.some((c) => c.potlek === 'most' && c.sajat) || a.pregnancy)) ki.push({ kind: 'anya30', months: honapok(1, 12) });
  if (a.mother && sajat >= 2 && (sajat >= 3 || (by ?? 0) >= 1986)) ki.push({ kind: 'anyak', months: honapok(1, 12), jogcim: sajat >= 4 ? 'negyplusz' : sajat === 3 ? 'harom' : 'ket' });
  if ((a.csaladiWho === 'en' || a.csaladiWho === 'kozosen') && (a.children.some((c) => c.potlek === 'most') || a.pregnancy)) ki.push({ kind: 'csaladi', months: honapok(1, 12) });
  if (a.marriage?.first && a.marriage.who !== 'par') {
    const m = Number(a.marriage.month.slice(5, 7));
    const y = Number(a.marriage.month.slice(0, 4));
    ki.push({ kind: 'elso_hazasok', months: y < ev ? honapok(1, Math.min(12, 12 - ((ev - y) * 12 - (12 - m)) + 12)) : honapok(m + 1, 12) });
  }
  if (a.disability && a.healthConsent) ki.push({ kind: 'szemelyi', months: honapok(a.disability.fromMonth?.startsWith(String(ev)) ? Number(a.disability.fromMonth.slice(5, 7)) : 1, 12) });
  if (a.benefit) ki.push({ kind: 'csed_gyed', months: honapok(a.benefit.fromMonth.startsWith(String(ev)) ? Number(a.benefit.fromMonth.slice(5, 7)) : 1, a.benefit.toMonth?.startsWith(String(ev)) ? Number(a.benefit.toMonth.slice(5, 7)) : 12) });
  return ki
    .filter((x) => x.months.length)
    .map((x) => {
      const eff = status === 'jovahagyva' ? hatas(x.kind, x.months, a) : null;
      const mt = honapSzoveg(x.months);
      return {
        kind: x.kind,
        label: x.kind === 'anyak' && x.jogcim ? ANYAK_LABELS[x.jogcim] : ALLOWANCE_LABELS[x.kind],
        line: ALLOWANCE_CLIENT_LINES[x.kind],
        status,
        statusText: status === 'jovahagyva' ? fillPlaceholders(ALLOWANCE_TEXTS.allapot.jovahagyva, { monthsText: mt, effectYear: sz(eff ?? 0) }) : fillPlaceholders(ALLOWANCE_TEXTS.allapot.javasolt, { firstName: FN }),
        months: x.months,
        monthsText: mt,
        inYear: true,
        effectYearHuf: eff,
        question: null,
        rejectText: null,
      };
    });
}

function kedvezmenyAllapot(st: K28Allapot): AllowanceState {
  const k = st.kedvezmeny;
  const jov = k.items.filter((i) => i.status === 'jovahagyva');
  const ev = jov.reduce((a, b) => a + (b.effectYearHuf ?? 0), 0);
  const docs: string[] = [];
  if (k.answers?.children.length) docs.push('a családi pótlékról szóló határozat');
  if (k.answers?.marriage) docs.push('a házassági anyakönyvi kivonat');
  if (k.answers?.disability || k.answers?.children.some((c) => c.tartosBeteg)) docs.push('az orvosi igazolás');
  if (k.answers?.children.some((c) => c.felvaltva)) docs.push('a felváltva gondozásról szóló bírósági döntés vagy megállapodás');
  return {
    year: 2026, gate: k.gate, answers: k.answers, version: k.version, submittedAt: k.submittedAt, items: k.items,
    pendingCount: k.items.filter((i) => i.status === 'javasolt' || i.status === 'kerdes').length,
    savedYtdHuf: jov.length ? felfele((ev * 10.5) / 12) : null, savedYearHuf: jov.length ? ev : null, documentsToKeep: docs, canEdit: !st.zarolva,
  };
}

// ---------- főoldal-kiegészítések ----------
function kartya(st: K28Allapot, ma: string): ReserveCard {
  const szjaMentes = st.kedvezmeny.items.some((i) => i.status === 'jovahagyva' && (i.kind === 'anyak' || i.kind === 'anya30'));
  const t = tartalekok(ma, szjaMentes);
  const tt = tetelek(ma);
  const ho = Number(ma.slice(5, 7));
  const lezartHo = Math.floor((ho - 1) / 3) * 3;
  const invoices = tt.filter((x) => x.erkezett <= ma).reduce((a, x) => a + (t.get(x.id)?.reserveHuf ?? 0), 0);
  const lezartSzamlak = tt.filter((x) => Number(x.erkezett.slice(5, 7)) <= lezartHo).reduce((a, x) => a + (t.get(x.id)?.reserveHuf ?? 0), 0);
  const nap = Math.round((Date.parse(ma) - Date.parse('2026-01-01')) / 86400000) + 1;
  const hipa = Math.round((HIPA_EVES * nap) / 365);
  const fixed = HAVI_FIX * ho;
  const A = invoices + fixed + hipa;
  const B = lezartSzamlak + HAVI_FIX * lezartHo + (ma >= '2026-09-15' ? HIPA_EVES : ma >= '2026-03-16' ? HIPA_EVES / 2 : 0);
  const keep = Math.max(0, felfele(A - B));
  const jel = st.jeloles;
  return {
    year: 2026, keepNowHuf: keep, accruedHuf: A, invoicesHuf: invoices, fixedHuf: fixed, fixedMonthlyHuf: HAVI_FIX, hipaHuf: hipa, hipaAnnualHuf: HIPA_EVES, dueOrPaidHuf: B,
    nextDue: { dueDate: '2027-01-12', label: 'IV. negyedév' },
    estimateReasons: st.kedvezmeny.items.some((i) => i.status === 'javasolt') ? [{ code: 'kedvezmeny_jovahagyasra_var', text: fillPlaceholders(RESERVE_TEXTS.becsles.kedvezmeny_jovahagyasra_var, { firstName: FN }) }] : [],
    sentence: keep > 0 ? fillPlaceholders(RESERVE_TEXTS.kartya.sentence, { keepNow: sz(keep) }) : RESERVE_TEXTS.kartya.sentenceZero,
    detail: keep > 0 ? fillPlaceholders(RESERVE_TEXTS.kartya.detail, { A: sz(A), B: sz(B) }) : RESERVE_TEXTS.kartya.detailZero,
    footnote: fillPlaceholders(RESERVE_TEXTS.kartya.footnote, { firstName: FN }),
    markedHuf: jel,
    ring: jel != null && keep > 0 ? { ratio: Math.min(1, jel / keep), remainingHuf: Math.max(0, keep - jel), line: fillPlaceholders(HOME_K_TEXTS.ringLine, { X: sz(Math.max(0, keep - jel)) }) } : null,
  };
}

function kereset(st: K28Allapot, ma: string): EarningsView {
  const t = tartalekok(ma, false);
  const tt = tetelek(ma);
  const ho = Number(ma.slice(5, 7));
  const months: EarningsMonthView[] = [];
  for (let m = 1; m <= ho; m++) {
    const benne = tt.filter((x) => Number(x.erkezett.slice(5, 7)) === m && x.erkezett.startsWith('2026') && x.erkezett <= ma);
    const rev = benne.reduce((a, x) => a + x.osszeg, 0);
    const szja = benne.reduce((a, x) => a + (t.get(x.id)?.rawHuf ?? 0), 0);
    const hipa = Math.round(HIPA_EVES / 12);
    const tb = 59_718;
    const szocho = HAVI_FIX - tb;
    const taxes = szja + tb + szocho + hipa;
    months.push({
      month: m, label: HO[m - 1], revenueHuf: rev, taxesHuf: taxes, parts: { szjaHuf: szja, tbHuf: tb, szochoHuf: szocho, hipaHuf: hipa }, netHuf: rev - taxes,
      basis: m <= 6 ? 'befizetve' : m <= 9 ? 'jovahagyva' : 'becsles', note: rev === 0 ? EARNINGS_TEXTS.noRevenueNote : null,
    });
  }
  const ytd = months.reduce((a, x) => ({ revenueHuf: a.revenueHuf + x.revenueHuf, taxesHuf: a.taxesHuf + x.taxesHuf, netHuf: a.netHuf + x.netHuf }), { revenueHuf: 0, taxesHuf: 0, netHuf: 0 });
  const nap = Math.round((Date.parse(ma) - Date.parse('2026-01-01')) / 86400000) + 1;
  const kerek = (n: number) => Math.round(n / 10_000) * 10_000;
  const projRev = kerek((ytd.revenueHuf * 365) / nap);
  const projTax = kerek((ytd.taxesHuf * 365) / nap);
  const projNet = projRev - projTax;
  return {
    year: 2026, months: months.reverse(), ytd,
    projection: { reliable: true, revenueHuf: projRev, taxesHuf: projTax, netHuf: projNet, text: fillPlaceholders(EARNINGS_TEXTS.cardProjection, { projNet: sz(projNet) }) },
    line: EARNINGS_TEXTS.line, disclaimer: fillPlaceholders(EARNINGS_TEXTS.disclaimer, { firstName: FN }),
  };
}

export function k28Home(st: K28Allapot, ma: string, aktiv: boolean): Partial<ClientHome> {
  if (!aktiv) return { reserve: null, earnings: null, allowancesHint: null };
  const k = kereset(st, ma);
  const earnings: EarningsCard = {
    ytdNetHuf: k.ytd.netHuf, ytdRevenueHuf: k.ytd.revenueHuf, ytdTaxesHuf: k.ytd.taxesHuf,
    sentence: fillPlaceholders(EARNINGS_TEXTS.cardSentence, { ytdNet: sz(k.ytd.netHuf) }),
    sub: fillPlaceholders(EARNINGS_TEXTS.cardSub, { ytdRevenue: sz(k.ytd.revenueHuf), ytdTaxes: sz(k.ytd.taxesHuf) }),
    projectionText: k.projection.text,
  };
  const db = SZAMLAK.filter((s) => s.issueDate.startsWith('2026') && s.issueDate <= ma).length;
  const two: TwoNumbersView = {
    revenueHuf: k.ytd.revenueHuf, revenueSub: fillPlaceholders(HOME_K_TEXTS.revenueSub, { n: String(db) }),
    taxesHuf: k.ytd.taxesHuf, taxesSub: HOME_K_TEXTS.taxesSub,
  };
  const pause: PauseView | null = st.szunetel
    ? { from: '2026-10-01', to: null, source: 'valtozas', amountHuf: FEE_DEFAULTS.szuneteltetesi_dij.amountHuf, demo: true, text: fillPlaceholders(PAUSE_TEXTS.cardBody, { from: '2026. október 1.', dij: sz(FEE_DEFAULTS.szuneteltetesi_dij.amountHuf), havidij: `${sz(FEE_DEFAULTS.havidij.amountHuf)} Ft-os havidíj` }) }
    : null;
  return {
    reserve: kartya(st, ma),
    earnings,
    allowancesHint: { show: st.kedvezmeny.gate === null || st.kedvezmeny.gate === 'kesobb' },
    twoNumbers: two,
    checkin: st.havi && st.havi.status === 'nyitott' ? st.havi : null,
    annual: st.eves,
    lock: zar(st),
    pause,
  };
}

export function zar(st: K28Allapot): ServiceLockView | null {
  if (!st.zarolva) return null;
  return { reasons: ['havidij'], since: '2026-11-02', amountHuf: FEE_DEFAULTS.havidij.amountHuf, text: fillPlaceholders(LOCK_TEXTS.banner, { mit: LOCK_TEXTS.mit.havidij, osszeg: sz(FEE_DEFAULTS.havidij.amountHuf), firstName: FN }), payRoute: '/fiok/elofizetes' };
}

/** A számlalista és a számla-részlet tartalék-sora. */
export function k28SzamlaTartalek(st: K28Allapot, navId: string, ma: string, aktiv: boolean): InvoiceReserveView | undefined {
  if (!aktiv) return undefined;
  const szjaMentes = st.kedvezmeny.items.some((i) => i.status === 'jovahagyva' && (i.kind === 'anyak' || i.kind === 'anya30'));
  return tartalekok(ma, szjaMentes).get(navId.replace(/^nav-/, 'bev-'));
}

// ---------- útvonalak ----------
type Kezelo = (m: RegExpMatchArray, q: URLSearchParams, test: Record<string, unknown>, k: Keres) => Valasz | Promise<Valasz> | undefined;
export interface K28Kornyezet {
  st: () => K28Allapot;
  ma: () => string;
  aktiv: () => boolean;
  ok: (t: unknown) => Valasz;
  hiba: (status: number, code: string, message: string, extra?: Record<string, unknown>, fields?: Record<string, string>) => Valasz;
  kell: () => Valasz | null;
}

export function k28Utak(ut: (method: string, minta: string, f: Kezelo) => void, c: K28Kornyezet) {
  const { ok, hiba } = c;
  const zartE = () => (c.st().zarolva ? hiba(403, 'service_locked', fillPlaceholders(LOCK_TEXTS.lockedAction, { mit: LOCK_TEXTS.mit.havidij })) : null);
  const aktivKell = (feature: string) => (c.aktiv() ? null : hiba(403, 'locked_until_active', 'A bekötés után nyílik meg.', {}, undefined));
  ut('GET', '/client/reserve', () => c.kell() ?? aktivKell('felretesz') ?? (() => {
    const st = c.st();
    const ma = c.ma();
    const t = tartalekok(ma, st.kedvezmeny.items.some((i) => i.status === 'jovahagyva' && (i.kind === 'anyak' || i.kind === 'anya30')));
    const honapok = new Map<number, ReserveListItem[]>();
    for (const x of tetelek(ma)) {
      const r = t.get(x.id);
      if (!r || !x.erkezett.startsWith('2026')) continue;
      const m = Number(x.erkezett.slice(5, 7));
      honapok.set(m, [...(honapok.get(m) ?? []), { revenueItemId: x.id, navInvoiceId: x.navId, title: x.cim, sub: x.al, receivedOn: x.erkezett, amountHuf: x.osszeg, reserve: r }]);
    }
    const v: ReserveView = { card: kartya(st, ma), months: [...honapok.entries()].sort((a, b) => b[0] - a[0]).map(([m, items]) => ({ month: m, label: HO[m - 1], items: items.reverse() })) };
    return ok(v);
  })());
  ut('PUT', '/client/reserve/mark', (_m, _q, t) => {
    const st = c.st();
    st.jeloles = Math.max(0, Math.round(Number(t.markedHuf ?? 0)));
    return ok(kartya(st, c.ma()));
  });
  ut('GET', '/client/earnings', () => c.kell() ?? aktivKell('kereset') ?? ok(kereset(c.st(), c.ma())));
  ut('GET', '/client/allowances', () => c.kell() ?? ok(kedvezmenyAllapot(c.st())));
  ut('POST', '/client/allowances/gate', (_m, _q, t) => {
    const st = c.st();
    st.kedvezmeny.gate = t.gate as AllowanceState['gate'];
    return ok(kedvezmenyAllapot(st));
  });
  ut('POST', '/client/allowances/preview', (_m, _q, t) => {
    const a = t.answers as AllowanceAnswers;
    return ok({ items: javaslat(a, 'jovahagyva').map((i) => ({ kind: i.kind, label: i.label, effectYearHuf: i.kind === 'csed_gyed' ? null : i.effectYearHuf, onlyAnnual: false })) });
  });
  ut('PUT', '/client/allowances/answers', (_m, _q, t) => {
    const st = c.st();
    const z = zartE();
    if (z && t.submit) return z;
    const a = t.answers as AllowanceAnswers;
    st.kedvezmeny.answers = a;
    if (t.submit) {
      st.kedvezmeny.version += 1;
      st.kedvezmeny.submittedAt = new Date().toISOString();
      st.kedvezmeny.items = javaslat(a, 'javasolt');
      st.kedvezmeny.gate = st.kedvezmeny.items.length ? 'lehet' : 'nem_jar';
    }
    return ok(kedvezmenyAllapot(st));
  });
  ut('GET', '/client/change-guides', () => {
    const st = c.st();
    const v: ChangeGuidesView = {
      items: CHANGE_KINDS.filter((k) => (st.szunetel ? k !== 'valtozas_szuneteltetes' : k !== 'valtozas_folytatas')).map((k) => ({
        kind: k, title: CHANGE_TEXTS.sorok[k].title, line: CHANGE_TEXTS.sorok[k].line, icon: CHANGE_KIND_ICON[k], outdated: false,
        openAssist: st.valtozasok.find((a) => a.kind === k && !['kesz', 'visszavonva', 'lezarva'].includes(a.status)) ?? null,
      })),
    };
    return ok(v);
  });
  ut('POST', '/client/assist', (_m, _q, t) => {
    const kind = String(t.kind ?? '') as ChangeKind;
    if (!(CHANGE_KINDS as readonly string[]).includes(kind)) return undefined; // a régi útvonal intézi
    const z = zartE();
    if (z) return z;
    const st = c.st();
    const ch = (t.change ?? null) as ChangeData | null;
    const items = ch && ch.kind === 'valtozas_adoadat' ? ch.items : [];
    const fk = changeFeeKind(kind, items);
    const id = `valt-${st.szamlalo++}`;
    const fee = fk && !t.callback ? dijTetel(st, fk, { type: 'valtozas', assistId: id }, c.ma()) : null;
    if (fee) st.dijak.push(fee);
    const a = valtozasNezet(id, kind, t.callback ? 'visszahivas_kerve' : fee ? 'dijra_var' : 'egyeztetve', ch, fee, c.ma());
    st.valtozasok.push(a);
    return ok({ assist: a, callback: null, feeCharge: fee });
  });
  ut('PUT', '/client/assist/:id/change', (m, _q, t) => {
    const a = c.st().valtozasok.find((x) => x.id === m[1]);
    if (!a) return undefined;
    a.change = t.change as ChangeData;
    a.consent = null;
    return ok(a);
  });
  ut('GET', '/client/assist/:id/consent', (m) => {
    const a = c.st().valtozasok.find((x) => x.id === m[1]);
    if (!a || !a.change) return undefined;
    const ch = a.change;
    const lines: string[] =
      ch.kind === 'valtozas_szekhely' || ch.kind === 'valtozas_telephely'
        ? [`${ch.address.zip} ${ch.address.city}${ch.address.district ? ` ${ch.address.district} kerület` : ''}`, `${ch.address.streetName} ${ch.address.streetType} ${ch.address.houseNumber}.`, `Érvényes: ${ch.effectiveOn.replace(/-/g, '. ')}.`]
        : [JSON.stringify(ch)];
    return ok({ version: '2026-11-19.ot', hash: `minta-${a.id}`, blocks: [{ key: 'cim', title: CHANGE_TEXTS.sorok[a.kind as ChangeKind].title, lines, editRoute: `/valtozas/${a.kind}/kerem?assist=${a.id}` }], canConsent: true, missing: [] });
  });
  ut('POST', '/client/assist/:id/consent', (m) => {
    const a = c.st().valtozasok.find((x) => x.id === m[1]);
    if (!a) return undefined;
    const z = zartE();
    if (z) return z;
    a.status = 'ugyfel_engedelyezte';
    a.statusText = fillPlaceholders(CHANGE_STATUS_CLIENT_TEXT.ugyfel_engedelyezte, { firstName: FN });
    a.consent = { at: new Date().toISOString(), valid: true };
    return ok(a);
  });
  ut('GET', '/client/guides/:kind', (m) => {
    const kind = m[1] as ChangeKind;
    if (!(CHANGE_KINDS as readonly string[]).includes(kind)) return undefined;
    const a = c.st().valtozasok.find((x) => x.kind === kind && x.change);
    return ok(valtozasUtmutatoEpit(kind, { change: (a?.change ?? null) as never, firstName: FN, kesz: [], ma: c.ma() }));
  });
  ut('GET', '/client/checkins/current', () => c.kell() ?? ok(c.st().havi && c.aktiv() ? { ...c.st().havi!, items: c.st().havi!.items.length ? c.st().havi!.items : checkinItemsFor({ regime: 'atalany', taxStatus: 'fofoglalkozasu', suspended: c.st().szunetel }).map((item) => ({ item, question: CHECKIN_ITEM_TEXTS[item].question })) } : null));
  ut('POST', '/client/checkins/:id', (_m, _q, t) => {
    const st = c.st();
    if (!st.havi) return hiba(409, 'checkin_closed', 'Ezt a hónapot már lezártuk.');
    if (t.result === 'nem_valtozott') {
      st.havi = { ...st.havi, status: 'nem_valtozott', answeredAt: new Date().toISOString(), items: [] };
      return ok(st.havi);
    }
    const z = zartE();
    if (z) return z;
    const answers = (t.answers ?? []) as CheckinItemAnswer[];
    const items = answers.map((a) => {
      let fee: FeeChargeView | null = null;
      let assistId: string | null = null;
      if (a.how === 'helyettunk' && a.change) {
        const kind = a.change.kind as ChangeKind;
        const fk = changeFeeKind(kind, a.change.kind === 'valtozas_adoadat' ? a.change.items : []);
        assistId = `valt-${st.szamlalo++}`;
        fee = fk ? dijTetel(st, fk, { type: 'valtozas', assistId }, c.ma()) : null;
        if (fee) st.dijak.push(fee);
        st.valtozasok.push(valtozasNezet(assistId, kind, fee ? 'dijra_var' : 'egyeztetve', a.change, fee, c.ma()));
      }
      return {
        item: a.item, question: CHECKIN_ITEM_TEXTS[a.item].question, status: fee ? ('dijra_var' as const) : a.how === 'magatol' ? ('ugyfel_intezi' as const) : ('uj' as const),
        statusText: fee ? `Fizesd ki a díjat (${sz(fee.amountHuf)} Ft), és ${FN} nekilát.` : a.how === 'magatol' ? 'Te jelented be az útmutatóval. Utána töltsd fel az értesítést.' : `${FN} megkapta, és szól, ha teendő van.`,
        assistId, feeCharge: fee,
      };
    });
    st.havi = { ...st.havi, status: 'valtozott', answeredAt: new Date().toISOString(), items };
    return ok(st.havi);
  });
  ut('GET', '/client/annual', () => c.kell() ?? ok(c.st().eves));
  ut('PUT', '/client/annual/:id/answers', (_m, _q, t) => {
    const st = c.st();
    if (!st.eves) return hiba(404, 'not_found', 'Nincs ilyen éves zárás.');
    const a = (t.answers ?? {}) as Partial<AnnualAnswers>;
    const acct = a.refundAccount;
    st.eves = { ...st.eves, answers: { ...(st.eves.answers ?? alapValasz()), ...a, refundAccount: undefined, refundAccountMasked: acct ? `${acct.slice(0, 4)} •••• ${acct.replace(/\D/g, '').slice(-4)}` : (st.eves.answers?.refundAccountMasked ?? null) } };
    return ok(st.eves);
  });
  ut('POST', '/client/annual/:id/submit', () => {
    const st = c.st();
    if (!st.eves || st.eves.status !== 'kerdoiv') return hiba(409, 'annual_wrong_status', 'Ezt már elküldted.');
    const z = zartE();
    if (z) return z;
    const fee = dijTetel(st, 'eves_zaras', { type: 'eves_zaras', annualId: st.eves.id }, c.ma());
    st.dijak.push(fee);
    st.eves = { ...annualAlap('dijra_var'), answers: st.eves.answers, feeCharge: fee };
    return ok(st.eves);
  });
  ut('GET', '/client/fees', () => {
    const st = c.st();
    const v: FeesView = {
      table: (['havidij', 'eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij'] as FeeKind[]).map((k) => ({
        kind: k, label: FEE_KIND_LABELS[k], amountHuf: FEE_DEFAULTS[k].amountHuf, unit: FEE_DEFAULTS[k].unit, demo: !FEE_DEFAULTS[k].confirmed,
        line: k === 'havidij' ? 'Havonta, bankkártyával. Minden benne van, amit az app tud.' : k === 'eves_zaras' ? 'Az éves SZJA- és iparűzésiadó-bevallás elkészítése.' : k === 'szuneteltetesi_dij' ? FEE_TEXTS.pauseLine : k === 'valtozas_jogallas' ? 'Ha főállás és mellékállás között váltasz, vagy nyugdíjas leszel – és mi jelentjük be.' : 'Költözés, új tevékenység, telephely, szüneteltetés – ha mi jelentjük be. Magadnak ingyenes.',
      })),
      inPlan: FEE_TEXTS.inPlan,
      open: st.dijak.filter((d) => d.status === 'nyitott'),
      paid: st.dijak.filter((d) => d.status === 'fizetve'),
      invoices: [],
    };
    return ok(v);
  });
  ut('POST', '/client/fees/:id/pay', (m) => {
    const st = c.st();
    const d = st.dijak.find((x) => x.id === m[1]);
    if (!d) return hiba(404, 'not_found', 'Nincs ilyen díj.');
    // MINTA: a demó fizetőoldal helyett azonnal „sikeres” (a valódi szerveren SimplePay / DEMO fizetőoldal)
    d.status = 'fizetve';
    d.statusText = FEE_CHARGE_STATUS_LABELS.fizetve;
    d.paidAt = new Date().toISOString();
    d.canPay = false;
    if (d.purpose.type === 'valtozas') {
      const aid = d.purpose.assistId;
      const a = st.valtozasok.find((x) => x.id === aid);
      if (a) {
        a.status = 'egyeztetve';
        a.statusText = fillPlaceholders(CHANGE_STATUS_CLIENT_TEXT.egyeztetve, { firstName: FN });
        a.feeCharge = d;
      }
      if (st.havi) st.havi = { ...st.havi, items: st.havi.items.map((i) => (i.assistId === aid ? { ...i, status: 'csapatnal', statusText: `${FN} nekilátott.`, feeCharge: d } : i)) };
    } else if (st.eves) st.eves = { ...annualAlap('konyvelonel'), answers: st.eves.answers, feeCharge: d };
    return ok({ paymentUrl: `/fiok/dijak?fizetve=${d.id}`, orderRef: `MINTA-${d.id}`, chargeId: d.id, amountHuf: d.amountHuf, demo: true });
  });
  ut('PUT', '/client/onboarding/employer', (_m, _q, t) => {
    c.st().alkalmazott = String(t.answer ?? 'nincs');
    return ok({}); // a hook utána újratölti a bekötés állapotát (GET /client/onboarding)
  });
}

const alapValasz = (): AnnualAnswers => ({
  otherIncomes: [], otherIncomeNote: null, allowancesOk: null, hipaPlace: null, hipaOtherTowns: [], municipalityLetter: null, onePercent: null, refundAccountMasked: null, missingDocuments: null, message: null,
});

/** /me kiegészítései: csendes idő, zárolás. */
export function k28Me(st: K28Allapot) {
  return { notificationSettings: st.csend, serviceLock: zar(st) };
}
export function k28CsendBeallit(st: K28Allapot, p: Partial<NotificationSettings>) {
  st.csend = { ...st.csend, ...p };
}
