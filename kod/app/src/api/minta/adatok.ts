// MINTA-adatok (csak EXPO_PUBLIC_API_MODE=minta buildben töltődik be). KITALÁLT személyek, cégek és számok
// a SPEC §19 szerint (kod/shared/demo/fixtures.json). Valódi személyhez vagy céghez nem tartoznak.
import type {
  AccountantPublic, ClientHome, Deadline, DocumentDetail, DocumentListItem, DossierView, Explanation, FeeInvoiceItem,
  Letter, Message, Meter, NavInvoiceListItem, NotificationItem, OnboardingState, PaymentItem, RequestSummary,
  SubscriptionView, TaxPeriodDetail,
} from '../../_shared/api';
import type { DocumentStatus, Icon3d } from '../../_shared/enums';
import fixtures from '../../_shared/demo/fixtures.json';
import { DEMO_ALAIRAS } from '../../theme/utak';

// SPEC §26: 'indul' = új vállalkozás, adatlapnál; 'utmutato' = kész az útmutató; 'levente' = beküldte, átnézzük.
// SPEC §28 / §28.K (k6): 'eszter' kedvezmény vár, 'balint' 25 év alatti (jóváhagyva), 'norbert' havi ellenőrzés + díj, 'adam'
// székhely-engedély, 'eves' éves zárás kérdőív, 'zarolt' díj-zárolás, 'szunetel' szüneteltetés, 'tamas' bekötés + EFO.
export type Forgatokonyv = 'kata' | 'fizetendo' | 'befizetve' | 'ures' | 'peter' | 'uj' | 'indul' | 'utmutato' | 'levente' | 'marika' | 'david' | 'ilona' | 'engedely' | 'bekuldve' | 'kamara' | 'eszter' | 'balint' | 'norbert' | 'adam' | 'eves' | 'zarolt' | 'szunetel' | 'tamas';
export const FORGATOKONYVEK: Forgatokonyv[] = ['kata', 'fizetendo', 'befizetve', 'ures', 'peter', 'uj', 'indul', 'utmutato', 'levente', 'marika', 'david', 'ilona', 'engedely', 'bekuldve', 'kamara', 'eszter', 'balint', 'norbert', 'adam', 'eves', 'zarolt', 'szunetel', 'tamas'];

export const BENCE: AccountantPublic = {
  id: 'minta-konyvelo-bence',
  displayName: 'Kovács Bence',
  firstName: 'Bence',
  nameForms: { with: 'Bencével', from: 'Bencétől', onto: 'Bencére', acc: 'Bencét' },
  title: 'Mérlegképes könyvelő',
  registrationNumber: '123456',
  avatarKey: 'karakter_1_lapos',
  signatureSvgPath: DEMO_ALAIRAS,
  responseTimeText: 'A lehető leggyorsabban válaszol',
};

// ---- NAV beszedési számlák (SPEC §7.1) + IBAN (mod 97) ----
function iban(szamla: string): string {
  const bban = (szamla.replace(/\D/g, '') + '0'.repeat(24)).slice(0, 24);
  const num = bban + '1730' + '00'; // H=17, U=30
  let m = 0;
  for (const c of num) m = (m * 10 + Number(c)) % 97;
  const ell = String(98 - m).padStart(2, '0');
  return `HU${ell}${bban}`.replace(/(.{4})/g, '$1 ').trim();
}
const SZAMLAK = {
  tb_jarulek: { label: 'TB-járulék', accountName: 'NAV Társadalombiztosítási járulék beszedési számla', accountNumber: '10032000-06055802' },
  szocho: { label: 'Szocho', sublabel: 'szociális hozzájárulási adó', accountName: 'NAV Szociális hozzájárulási adó beszedési számla', accountNumber: '10032000-06055912' },
  szja_eloleg: { label: 'SZJA-előleg', accountName: 'NAV Személyi jövedelemadó beszedési számla', accountNumber: '10032000-06056353' },
} as const;
const KATA_ADOSZAM = fixtures.taxIds.kata.adoszam;

export function fizetendoTetelek(periodKey: string, osszegek: { tb: number; szocho: number; szja: number }, due: string, fizetve?: { at: string; on: string; ellenorizve?: string }): PaymentItem[] {
  const q = periodKey.endsWith('Q1') ? 'I.' : periodKey.endsWith('Q2') ? 'II.' : periodKey.endsWith('Q3') ? 'III.' : 'IV.';
  return (['tb_jarulek', 'szocho', 'szja_eloleg'] as const).map((kind) => {
    const s = SZAMLAK[kind];
    const amount = kind === 'tb_jarulek' ? osszegek.tb : kind === 'szocho' ? osszegek.szocho : osszegek.szja;
    return {
      id: `${periodKey}-${kind}`,
      kind,
      label: s.label,
      sublabel: kind === 'szja_eloleg' ? `${q} negyedév` : 'sublabel' in s ? s.sublabel : undefined,
      amountHuf: amount,
      dueDate: due,
      accountName: s.accountName,
      accountNumber: s.accountNumber,
      iban: iban(s.accountNumber),
      reference: KATA_ADOSZAM,
      markedPaidAt: fizetve?.at,
      markedPaidOn: fizetve?.on,
      verifiedAt: fizetve?.ellenorizve,
      verification: fizetve?.ellenorizve ? 'rendben' : undefined,
    };
  });
}

// ---- bevétel a fixtures-ből (pénzforgalmi dátum: átutalásnál a fizetés napja; SPEC §5.5) ----
type Szamla = (typeof fixtures.navInvoices)['68801234'][number];
const KATA_SZAMLAK: Szamla[] = fixtures.navInvoices['68801234'];
const beerkezett = (s: Szamla) => (['CASH', 'CARD', 'VOUCHER'].includes(s.paymentMethod) ? s.issueDate : s.paymentDate ?? s.issueDate);

export function bevetelHavonta(ma: string): { month: number; amountHuf: number }[] {
  const ho = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amountHuf: 0 }));
  for (const s of KATA_SZAMLAK) {
    const d = beerkezett(s);
    if (d <= ma && d.startsWith('2026')) ho[Number(d.slice(5, 7)) - 1].amountHuf += s.grossAmountHuf;
  }
  for (const k of fixtures.manualRevenue.kata) if (k.receivedOn <= ma) ho[Number(k.receivedOn.slice(5, 7)) - 1].amountHuf += k.amountHuf;
  const aktualis = Number(ma.slice(5, 7));
  return ho.filter((h) => h.month <= aktualis);
}
export function afaFelhasznalt(ma: string): number {
  let s = 0;
  for (const x of KATA_SZAMLAK) if (x.deliveryDate <= ma) s += x.grossAmountHuf;
  for (const k of fixtures.manualRevenue.kata) if (k.receivedOn <= ma) s += k.amountHuf;
  return s;
}
export function navSzamlak(honap: string, ma: string, statusz: DocumentStatus): NavInvoiceListItem[] {
  return KATA_SZAMLAK.filter((s) => s.issueDate.startsWith(honap) && s.issueDate <= ma).map((s) => ({
    id: `nav-${s.invoiceNumber}`,
    invoiceNumber: s.invoiceNumber,
    issueDate: s.issueDate,
    customerName: s.customer.name,
    grossAmountHuf: s.grossAmountHuf,
    status: statusz,
    demo: true,
  }));
}
export function navSzamla(id: string) {
  const s = KATA_SZAMLAK.find((x) => `nav-${x.invoiceNumber}` === id);
  if (!s) return null;
  return {
    id,
    demo: true,
    invoiceNumber: s.invoiceNumber,
    operation: s.operation,
    issueDate: s.issueDate,
    deliveryDate: s.deliveryDate,
    paymentDate: s.paymentDate,
    paymentMethod: s.paymentMethod,
    currency: s.currency,
    netAmountHuf: s.netAmountHuf,
    vatAmountHuf: s.vatAmountHuf,
    grossAmountHuf: s.grossAmountHuf,
    vatExemption: s.vatExemption,
    supplierTaxNumber: s.supplierTaxNumber,
    customer: s.customer,
    lines: s.lines,
    receivedOn: beerkezett(s),
    receivedOnEstimated: true,
  };
}

function mero(used: number, limit: number, ma: string, mondat: (maradt: number) => string): Meter {
  const nap = Math.round((Date.parse(ma) - Date.parse('2026-01-01')) / 86400000) + 1;
  const projected = Math.round((used / nap) * 365);
  return {
    usedHuf: used,
    limitHuf: limit,
    projectedHuf: projected,
    ratio: used / limit,
    warning: used / limit >= 0.8 || projected >= limit,
    sentence: mondat(limit - used),
  };
}
const ftSzoveg = (n: number) => n.toLocaleString('hu-HU').replace(/\s/g, ' ');

export function keretek(ma: string): ClientHome['limits'] {
  const bev = bevetelHavonta(ma).reduce((a, b) => a + b.amountHuf, 0);
  return {
    afa: mero(afaFelhasznalt(ma), 20_000_000, ma, (m) => `Még ${ftSzoveg(m)} Ft-ot számlázhatsz ÁFA nélkül.`),
    atalanyCap: mero(bev, 38_736_000, ma, (m) => `Még ${ftSzoveg(m)} Ft bevételig maradhatsz átalányadós.`),
    adomentes: {
      reached: true,
      reachedMonth: 6,
      limitHuf: 1_936_800,
      sentence: 'Az első 1 936 800 Ft jövedelmed adómentes volt. Azóta fizetsz SZJA-előleget, ez így rendben van.',
    },
  };
}

// ---- adószámítás magyarázata (SPEC §7.3; a valódit az ado-motor adja) ----
export function magyarazat(q: 3 | 4): Explanation {
  // ugyanaz a szerkezet, mint az ado-motoré (kod/ado-motor/test/magyarazat.test.ts): cim / sor / ado / megjegyzes
  const intro =
    '2026-tól a TB-járulékot, a szochót és az SZJA-előleget is negyedévente fizeted, a negyedév utáni hónap 12-éig. Mindhárom az idei jövedelmedből jön.';
  type L = Explanation['lines'][number] & { kind: string; side?: string };
  const q3: L[] = [
    { kind: 'cim', label: 'Jövedelmed', side: 'július–szeptember' },
    { kind: 'sor', label: 'Július–szeptemberi bevételed', amountHuf: 2_490_000 },
    { kind: 'sor', op: '−', label: 'Költséghányad, 45%', amountHuf: 1_120_500 },
    { kind: 'sor', op: '=', label: 'Jövedelmed a negyedévben', amountHuf: 1_369_500 },
    { kind: 'cim', label: 'TB-járulék és szocho', side: '3 hónap' },
    { kind: 'sor', label: 'Járulékalap, 3 hónap', amountHuf: 968_400, note: 'Havonta legalább a minimálbér (322 800 Ft); a jövedelmed ennél kevesebb volt.' },
    { kind: 'ado', label: 'TB-járulék: ennek 18,5%-a', amountHuf: 179_154 },
    { kind: 'ado', label: 'Szocho: ennek 13%-a', amountHuf: 125_892, note: 'Szocho = szociális hozzájárulási adó.' },
    { kind: 'cim', label: 'SZJA-előleg', side: 'január–szeptember' },
    { kind: 'sor', label: 'Idei jövedelmed eddig', amountHuf: 3_817_000 },
    { kind: 'sor', op: '−', label: 'Adómentes rész', amountHuf: 1_936_800, note: 'Júniusban érted el.' },
    { kind: 'sor', op: '=', label: 'Adóköteles rész', amountHuf: 1_880_200 },
    { kind: 'sor', label: 'Ennek 15%-a', amountHuf: 282_030 },
    { kind: 'sor', op: '−', label: 'Az előző negyedévek előlege', amountHuf: 76_605 },
    { kind: 'ado', op: '=', label: 'SZJA-előleg most', amountHuf: 205_425 },
  ];
  const q4: L[] = [
    { kind: 'cim', label: 'Jövedelmed', side: 'október–november' },
    { kind: 'sor', label: 'Október–novemberi bevételed eddig', amountHuf: 1_062_000 },
    { kind: 'sor', op: '−', label: 'Költséghányad, 45%', amountHuf: 477_900 },
    { kind: 'sor', op: '=', label: 'Jövedelmed a negyedévben', amountHuf: 584_100 },
    { kind: 'cim', label: 'TB-járulék és szocho', side: '3 hónap' },
    { kind: 'sor', label: 'Járulékalap, 3 hónap', amountHuf: 968_400, note: 'Havonta legalább a minimálbér (322 800 Ft).' },
    { kind: 'ado', label: 'TB-járulék: ennek 18,5%-a', amountHuf: 179_154 },
    { kind: 'ado', label: 'Szocho: ennek 13%-a', amountHuf: 125_892, note: 'Szocho = szociális hozzájárulási adó.' },
    { kind: 'cim', label: 'SZJA-előleg', side: 'január–november' },
    { kind: 'sor', label: 'Idei jövedelmed eddig', amountHuf: 4_401_100 },
    { kind: 'sor', op: '−', label: 'Adómentes rész', amountHuf: 1_936_800 },
    { kind: 'sor', op: '=', label: 'Adóköteles rész', amountHuf: 2_464_300 },
    { kind: 'sor', label: 'Ennek 15%-a', amountHuf: 369_645 },
    { kind: 'sor', op: '−', label: 'Az előző negyedévek előlege', amountHuf: 282_030 },
    { kind: 'ado', op: '=', label: 'SZJA-előleg most', amountHuf: 87_615 },
    { kind: 'megjegyzes', label: 'A negyedév még tart: ha lesz még bevételed, az összeg nőhet.' },
  ];
  return { intro, lines: q === 3 ? q3 : q4, result: q === 3 ? 'Összesen: 510 471 Ft' : 'Összesen eddig: 392 661 Ft' };
}

export const Q3_OSSZEG = { tb: 179_154, szocho: 125_892, szja: 205_425 };
export const Q4_OSSZEG = { tb: 179_154, szocho: 125_892, szja: 87_615 };

export const Q3_LEVEL: Letter = {
  greeting: 'Kedves Kata!',
  body: 'Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg.',
  signedBy: 'Kovács Bence',
  signedRole: 'könyvelőd',
  date: '2026-10-02',
};

// ---- iratok ----
function irat(p: Partial<DocumentListItem> & Pick<DocumentListItem, 'id' | 'title' | 'category' | 'status' | 'statusAt' | 'dossierMonth'>): DocumentListItem {
  const ikon: Record<string, Icon3d> = { nyugta: 'nyugta', bankszamlakivonat: 'irat', nav_level: 'ertesites', bevallas: 'irat' };
  const cimke: Record<DocumentStatus, string> = { feltoltve: 'Feltöltve', konyvelo_latta: 'Bence látta', feldolgozva: 'Feldolgozva', beadva: 'Beadva' };
  return {
    source: 'ugyfel',
    icon: ikon[p.category] ?? 'irat',
    pageCount: 1,
    statusLabel: cimke[p.status],
    ...p,
  } as DocumentListItem;
}

const HO = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

export function katasIratok(ma: string): DocumentListItem[] {
  const lista: DocumentListItem[] = [];
  for (let m = 1; m <= 9; m++) {
    const hk = `2026-${String(m).padStart(2, '0')}`;
    const kov = `2026-${String(m + 1).padStart(2, '0')}`;
    lista.push(irat({ id: `kivonat-${hk}`, title: `Bankszámlakivonat, ${HO[m - 1]}`, category: 'bankszamlakivonat', status: 'beadva', statusAt: `${kov}-06T08:10:00Z`, dossierMonth: hk, pageCount: 3 }));
  }
  const filed: [string, string, string][] = [['2026-04', '2026-04-10T09:00:00Z', 'I.'], ['2026-07', '2026-07-10T09:00:00Z', 'II.'], ['2026-10', '2026-10-02T09:00:00Z', 'III.']];
  for (const [hk, at, q] of filed)
    lista.push(irat({ id: `bevallas-${hk}`, title: `Bevallás a${q === 'I.' ? 'z' : ''} ${q} negyedévről`, category: 'bevallas', status: 'beadva', statusAt: at, dossierMonth: hk, source: 'konyvelo', pageCount: 4 }));
  lista.push(irat({ id: 'nyugta-okt', title: 'Nyugta, készpénzes eladás', category: 'nyugta', status: 'feldolgozva', statusAt: '2026-10-05T07:20:00Z', dossierMonth: '2026-10', amountHuf: 18_000 }));
  lista.push(irat({ id: 'szerzodes-bodza', title: 'Szerződés, Bodza Kiadó', category: 'szerzodes', status: 'feltoltve', statusAt: ma === '2026-10-09' ? '2026-10-08T15:12:00Z' : '2026-10-08T15:12:00Z', dossierMonth: '2026-10', pageCount: 2 }));
  lista.push(irat({ id: 'nav-ertesites-okt', title: 'Levél a NAV-tól', category: 'nav_level', status: 'feldolgozva', statusAt: '2026-10-07T09:00:00Z', dossierMonth: '2026-10', source: 'nav' }));
  if (ma >= '2026-11-10') {
    lista.push(irat({ id: 'nyugta-papirbolt', title: 'Nyugta, papírbolt', category: 'koltseg_bizonylat', icon: 'nyugta', status: 'konyvelo_latta', statusAt: '2026-11-14T08:05:00Z', dossierMonth: '2026-11', amountHuf: 7_480 }));
    lista.push(irat({ id: 'nav-level-nov', title: 'Levél a NAV-tól', category: 'nav_level', status: 'feldolgozva', statusAt: '2026-11-17T07:45:00Z', dossierMonth: '2026-11' }));
  }
  return lista.filter((d) => d.statusAt.slice(0, 10) <= ma || d.dossierMonth <= ma.slice(0, 7));
}

export function iratReszlet(d: DocumentListItem, ma: string): DocumentDetail {
  const hist: DocumentDetail['history'] = [];
  if (d.id === 'nyugta-okt') {
    hist.push({ status: 'feltoltve', label: 'Feltöltve', at: '2026-10-03T16:40:00Z', by: 'Te' });
    hist.push({ status: 'konyvelo_latta', label: 'Bence látta', at: '2026-10-05T07:05:00Z', by: 'Kovács Bence' });
    hist.push({ status: 'feldolgozva', label: 'Feldolgozva', at: '2026-10-05T07:20:00Z', by: 'Kovács Bence' });
  } else {
    hist.push({ status: 'feltoltve', label: d.source === 'nav' ? 'Letöltöttük' : 'Feltöltve', at: d.statusAt });
    if (d.status !== 'feltoltve') hist.push({ status: d.status, label: d.statusLabel, at: d.statusAt, by: 'Kovács Bence' });
  }
  return {
    ...d,
    versions: [{ id: `${d.id}-v1`, versionNo: 1, fileId: d.category === 'nyugta' ? 'minta-nyugta' : 'minta-pdf', pageCount: d.pageCount, createdAt: hist[0].at }],
    history: hist,
    accountantComment:
      d.id === 'nyugta-okt'
        ? 'Rendben, hozzáadtam az októberi bevételedhez. Ha máskor is kézzel adsz nyugtát, elég a hónap végén egyszerre lefotóznod a tömb lapjait.'
        : d.id === 'nav-level-nov'
          ? 'Megnéztem: csak értesítés, nincs vele teendőd. Elteheted.'
          : undefined,
    documentDate: d.id === 'nyugta-okt' ? '2026-10-03' : undefined,
    relatedRevenueMonth: d.id === 'nyugta-okt' ? '2026-10' : undefined,
    clientNote: undefined,
    amountHuf: d.amountHuf,
    statusLabel: d.statusLabel,
  };
}

export function dosszieNezet(honap: string, ma: string, iratok: DocumentListItem[], keresek: RequestSummary[]): DossierView {
  const sajat = iratok.filter((d) => d.dossierMonth === honap && d.source === 'ugyfel');
  const nav = iratok.filter((d) => d.dossierMonth === honap && d.source === 'nav');
  const beadta = iratok.filter((d) => d.dossierMonth === honap && d.source === 'konyvelo');
  const lezart = honap < '2026-10';
  const szamlaStatusz: DocumentStatus = lezart ? 'beadva' : honap === '2026-10' ? 'feldolgozva' : 'feltoltve';
  const szamlak = navSzamlak(honap, ma, szamlaStatusz);
  const osszes = sajat.length + nav.length + beadta.length + szamlak.length;
  const var_ = sajat.filter((d) => d.status === 'feltoltve' || d.status === 'konyvelo_latta').length;
  const szamnev = ['', 'egy', 'kettő', 'három', 'négy', 'öt'];
  const headline =
    osszes === 0
      ? `Még üres ${/^[aáeéiíoóöőuúüű]/.test(HO[Number(honap.slice(5, 7)) - 1]) ? 'az' : 'a'} ${HO[Number(honap.slice(5, 7)) - 1]}i dosszié.`
      : var_ > 0
        ? `${osszes} irat, ebből ${szamnev[var_] ?? var_} még Bencére vár.`
        : `${osszes} irat, mind rendben.`;
  const okCount = osszes - var_;
  return {
    month: honap,
    label: HO[Number(honap.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase()),
    headline,
    review:
      osszes > 0 && honap >= '2026-10'
        ? { by: BENCE, at: honap === '2026-10' ? (ma === '2026-10-09' ? '2026-10-08T14:40:00Z' : '2026-11-16T15:40:00Z') : '2026-11-16T15:40:00Z', okCount, note: var_ ? (honap === '2026-10' ? 'A tegnapi szerződésre még ránéz.' : 'A papírbolti nyugtát még átnézi.') : undefined }
        : undefined,
    sentByMe: sajat,
    fromNav: {
      invoices: { count: szamlak.length, status: szamlaStatusz, statusLabel: szamlaStatusz === 'feltoltve' ? 'Letöltöttük' : szamlaStatusz === 'feldolgozva' ? 'Feldolgozva' : 'Beadva', statusAt: szamlak.length ? (honap === '2026-10' ? (ma < '2026-10-14' ? '2026-10-08T07:00:00Z' : '2026-10-14T07:00:00Z') : honap === ma.slice(0, 7) ? `${ma}T05:30:00Z` : `${honap}-28T07:00:00Z`) : null, totalHuf: szamlak.reduce((a, b) => a + b.grossAmountHuf, 0), demo: true },
      letters: nav,
    },
    filedByAccountant: beadta,
    contracts: [],
    openRequests: keresek.filter((k) => k.direction === 'konyvelotol' && (k.dossierMonth === honap || honap === ma.slice(0, 7)) && (k.status === 'nyitott' || k.status === 'folyamatban')),
  };
}

export function kataKeresek(ma: string): RequestSummary[] {
  const okt = ma >= '2026-11-01';
  return [
    {
      id: 'keres-kivonat',
      direction: 'konyvelotol',
      type: 'dokumentum',
      title: okt ? 'Töltsd fel az októberi bankszámlakivonatodat.' : 'Töltsd fel a szeptemberi bankszámlakivonatodat.',
      body: 'Csak ellenőrzéshez kell, a befizetendő összeg nem változik. Elég a bankod appjából letöltött PDF.',
      status: 'nyitott',
      statusLabel: 'Nyitott',
      dueDate: okt ? '2026-11-20' : '2026-10-20',
      createdAt: okt ? '2026-11-02T07:10:00Z' : '2026-10-01T07:10:00Z',
      dossierMonth: okt ? '2026-10' : '2026-09',
    },
    {
      id: 'keres-jovedelemigazolas',
      direction: 'ugyfeltol',
      type: 'jovedelemigazolas',
      title: 'Jövedelemigazolás, 2025',
      body: 'A bank kéri a lakáshitelhez.',
      status: 'folyamatban',
      statusLabel: 'Bence látta, pár napon belül kész',
      createdAt: '2026-11-17T08:02:00Z',
      certificate: { certificateType: 'jovedelemigazolas', year: 2025, purpose: 'bank, lakáshitel', language: 'hu' },
    },
  ];
}

export function kataUzenetek(): Message[] {
  const k = kataKeresek('2026-11-17');
  const m = (id: string, sender: Message['sender'], createdAt: string, body: string, extra: Partial<Message> = {}): Message => ({
    id, kind: 'szoveg', body, sender, createdAt, attachments: [], readByAccountantAt: sender === 'en' ? createdAt : undefined, ...extra,
  });
  return [
    m('u1', 'konyvelo', '2026-10-02T08:05:00Z', 'Szia Kata! Kiszámoltam a III. negyedévet. A Főoldalon látod az összeget és a három számlaszámot.'),
    m('u2', 'en', '2026-10-09T06:31:00Z', 'Elutaltam mind a hármat.'),
    m('u3', 'konyvelo', '2026-10-09T07:12:00Z', 'Köszönöm! A kivonatodon majd megnézem, hogy megérkezett-e.'),
    m('u4', 'rendszer', '2026-11-02T07:10:00Z', 'Bence kéri: töltsd fel az októberi bankszámlakivonatodat.', { kind: 'keres_kartya', request: k[0] }),
    m('u5', 'en', '2026-11-16T19:31:00Z', 'Levelet kaptam a NAV-tól, megijedtem. Feltöltöttem a dossziéba.'),
    m('u6', 'konyvelo', '2026-11-17T07:47:00Z', 'Megnéztem: csak értesítés, nincs vele teendőd. Elteheted.'),
    m('u7', 'en', '2026-11-17T08:02:00Z', '', { kind: 'keres_kartya', request: k[1] }),
  ].reverse(); // legújabb elöl (SPEC §12.4)
}

export function hataridok(ma: string, q4: number): Deadline[] {
  const d = (id: string, kind: Deadline['kind'], title: string, dueDate: string, extra: Partial<Deadline> = {}): Deadline => {
    const napok = Math.round((Date.parse(dueDate) - Date.parse(ma)) / 86400000);
    return { id, kind, title, dueDate, daysLeft: napok, status: napok < 0 ? 'lejart' : 'nyitott', link: '/hataridok', ...extra };
  };
  return [
    d('h-q3', 'befizetes', 'III. negyedévi befizetés: TB, szocho, SZJA-előleg', '2026-10-12', { amountHuf: 510_471, status: ma >= '2026-10-09' ? 'kesz' : 'nyitott', link: '/' }),
    d('h-q3b', 'bevallas', 'Bence beadja a III. negyedéves bevallást (2658)', '2026-10-12', { status: 'kesz' }),
    d('h-kivonat', 'keres', 'Októberi bankszámlakivonat feltöltése', '2026-11-20', { link: '/feltoltes?keres=keres-kivonat&kategoria=bankszamlakivonat' }),
    d('h-hivas', 'idopont', 'Telefonos beszélgetés Bencével (nem kötelező)', '2026-12-03'),
    d('h-q4', 'befizetes', 'IV. negyedévi befizetés: TB, szocho, SZJA-előleg', '2027-01-12', { amountHuf: q4, link: '/' }),
    d('h-q4b', 'bevallas', 'Bence beadja a IV. negyedéves bevallást (2658)', '2027-01-12'),
    d('h-hipa', 'befizetes', 'Helyi iparűzési adó, első előleg (becslés)', '2027-03-16'),
    d('h-szja', 'bevallas', 'Éves SZJA-bevallás a 2026-os évről (Bence elkészíti)', '2027-05-20'),
  ].filter((x) => x.dueDate >= '2026-10-01');
}

export function elofizetes(): SubscriptionView {
  return {
    status: 'active',
    mode: 'demo',
    priceHuf: 19_999,
    currentPeriodEnd: '2026-12-08',
    nextChargeAt: '2026-12-08T08:00:00Z',
    cancelAtPeriodEnd: false,
    card: { mask: 'xxxx-xxxx-xxxx-4193', expiry: '2028-03-31', tokensLeft: 1, tokensUntil: '2027-01-08T08:00:00Z' },
    failedAttempts: 0,
  };
}
export function dijszamlak(): FeeInvoiceItem[] {
  return Array.from({ length: 11 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { id: `dij-${m}`, number: `DEMO-2026-${String(101 + i).padStart(6, '0')}`, issuedOn: `2026-${m}-08`, amountHuf: 19_999, demo: true, fileId: 'minta-pdf' };
  }).reverse();
}

export function ertesitesek(ma: string): NotificationItem[] {
  const n = (id: string, kind: NotificationItem['kind'], title: string, body: string, createdAt: string, link: string | null, olvasott = true): NotificationItem => ({
    id, kind, title, body, createdAt, link, readAt: olvasott ? createdAt : null,
  });
  const lista = [
    n('e1', 'tax_approved', 'Megvan a III. negyedévi összeg: 510 471 Ft', 'Október 12-ig kell elutalnod, három számlaszámra.', '2026-10-02T08:05:00Z', '/'),
    n('e2', 'tax_payment_verified', 'Bence látta a befizetésed', 'A III. negyedévi összeg megérkezett a NAV-hoz.', '2026-10-21T09:00:00Z', '/'),
    n('e3', 'tax_filed', 'Bence beadta a III. negyedéves bevallást', 'A bevallás és a NAV visszaigazolása a dossziédban van.', '2026-10-02T09:05:00Z', '/dosszie?honap=2026-10'),
    n('e4', 'request_new', 'Bence kéri: töltsd fel az októberi kivonatodat', 'November 20-ig. Elég a bankod appjából letöltött PDF.', '2026-11-02T07:10:00Z', '/feltoltes?keres=keres-kivonat&kategoria=bankszamlakivonat', false),
    n('e5', 'message_new', 'Új üzenet Bencétől', 'Megnéztem: csak értesítés, nincs vele teendőd.', '2026-11-17T07:47:00Z', '/uzenetek', false),
  ];
  return lista.filter((x) => x.createdAt.slice(0, 10) <= ma).reverse();
}

export function onboardingAllapot(fajta: 'peter' | 'uj'): OnboardingState {
  if (fajta === 'peter')
    return {
      steps: [
        { step: 'fiok', status: 'kesz', completedAt: '2026-11-10T08:00:00Z' },
        { step: 'adatok', status: 'kesz', completedAt: '2026-11-10T08:20:00Z' },
        { step: 'szerzodes', status: 'kesz', completedAt: '2026-11-10T08:25:00Z' },
        { step: 'elofizetes', status: 'kesz', completedAt: '2026-11-10T08:31:00Z' },
        { step: 'meghatalmazas', status: 'konyvelore_var', completedAt: '2026-11-16T09:00:00Z' },
        { step: 'azonositas', status: 'kesz', completedAt: '2026-11-11T10:00:00Z' },
        { step: 'nav_bekotes', status: 'nincs_kezdve' },
      ],
      milestones: [
        { key: 'alairva', label: 'Bejelentetted Bencét a NAV-nál', done: true, current: false, sub: 'hétfőn, az ONYA-ban' },
        { key: 'azonositva', label: 'Elküldted az igazolványaidat', done: true, current: false, sub: 'Titkosítva tároljuk, csak Bence látja.' },
        { key: 'nav_bejelentve', label: 'Bence ellenőrzi a bejelentést a NAV-nál', done: false, current: true, sub: 'Általában 1–2 munkanap.' },
        { key: 'szamlak_bekotve', label: 'Kiállított számlák bekötve', done: false, current: false, sub: 'Utána a kiállított számláid maguktól megjelennek itt.' },
        { key: 'kesz', label: 'Kész, minden be van kötve', done: false, current: false },
      ],
      todoCount: 1,
      accountant: BENCE,
      path: 'van',
      registration: null,
      callback: null,
      appointmentsEnabled: false,
      meghatalmazasMethods: ['onya_ugyfel', 'onya_konyvelo'],
    };
  return {
    steps: [
      { step: 'fiok', status: 'kesz', completedAt: '2026-11-17T08:00:00Z' },
      { step: 'adatok', status: 'ugyfelre_var' },
      { step: 'szerzodes', status: 'ugyfelre_var' },
      { step: 'elofizetes', status: 'ugyfelre_var' },
      { step: 'meghatalmazas', status: 'ugyfelre_var' },
      { step: 'azonositas', status: 'ugyfelre_var' },
      { step: 'nav_bekotes', status: 'nincs_kezdve' },
    ],
    milestones: [
      { key: 'alairva', label: 'Aláírva', done: false, current: true, sub: 'szerződés és bejelentés a NAV-nál' },
      { key: 'azonositva', label: 'Azonosítva', done: false, current: false, sub: 'igazolványok és nyilatkozatok' },
      { key: 'nav_bejelentve', label: 'NAV-nál bejelentve', done: false, current: false, sub: 'Bence ellenőrzi' },
      { key: 'szamlak_bekotve', label: 'Kiállított számlák bekötve', done: false, current: false, sub: 'Utána a kiállított számláid maguktól megjelennek itt.' },
      { key: 'kesz', label: 'Kész', done: false, current: false },
    ],
    todoCount: 5,
    accountant: BENCE,
    path: null,
    registration: null,
    callback: null,
    appointmentsEnabled: false,
    meghatalmazasMethods: ['onya_ugyfel', 'onya_konyvelo'],
  };
}

export function adoIdoszak(periodKey: '2026-Q3' | '2026-Q4', allapot: 'fizetendo' | 'befizetve' | 'ellenorizve' | 'becsles', ma: string): TaxPeriodDetail {
  const q3 = periodKey === '2026-Q3';
  const osszeg = q3 ? Q3_OSSZEG : Q4_OSSZEG;
  const due = q3 ? '2026-10-12' : '2027-01-12';
  const fizetve =
    allapot === 'befizetve' ? { at: '2026-10-09T08:24:00Z', on: '2026-10-09' } : allapot === 'ellenorizve' ? { at: '2026-10-09T08:24:00Z', on: '2026-10-09', ellenorizve: '2026-10-21T09:00:00Z' } : undefined;
  return {
    id: `ido-${periodKey}`,
    periodKey,
    kind: 'negyedev',
    label: q3 ? 'III. negyedév' : 'IV. negyedév',
    dueDate: due,
    calcStatus: allapot === 'becsles' ? 'becsles' : 'jovahagyva',
    paymentStatus: allapot === 'becsles' ? 'fizetendo' : allapot === 'fizetendo' ? 'fizetendo' : allapot === 'befizetve' ? 'befizetve_jelezve' : 'ellenorizve',
    filingStatus: q3 && ma >= '2026-10-02' ? 'beadva' : 'nincs',
    totalHuf: osszeg.tb + osszeg.szocho + osszeg.szja,
    items: fizetendoTetelek(periodKey, osszeg, due, fizetve),
    explanation: magyarazat(q3 ? 3 : 4),
    disclaimer: allapot === 'becsles' ? 'Becslés. A végleges összeget a könyvelőd hagyja jóvá.' : null,
    letter: allapot === 'becsles' ? null : Q3_LEVEL,
    filed: q3 && ma >= '2026-10-02' ? { filedOn: '2026-10-02', documents: [] } : null,
  };
}
