// LOCAL MOCK DATA – only in `--mode mock` builds (screenshots, design review without a server).
// Everything here is fictional (SPEC §19). Numbers come from kod/shared/demo/fixtures.json and match SPEC §7.6 C.
// The real data comes from the backend seed; this file is never part of a normal build.
import fixtures from '../_shared/demo/fixtures.json';
import { DEMO_SIGNATURE } from '../ui/kezvonas';
import type {
  AccDocument,
  AccTaxPeriod,
  AuditRow,
  ContentText,
  DemoMail,
  FaqItem,
  InternalNote,
  MessageTemplate,
  NavConnection,
  NavInvoiceDetail,
  NavSyncRun,
  QuarterResult,
  ReferralCodeRow,
  TaxProfile,
} from '../api/types';
import type { Message, PaymentItem, RequestSummary, RevenueItem, AccountantPublic } from '../_shared/api';
import type { ClientFlag, ClientLifecycle, OnboardingStep, StepStatus, SubscriptionStatus, MeghatalmazasMethod, KycStatus } from '../_shared/enums';

export const TODAY = fixtures.today; // 2026-11-17
let seq = 1000;
export const uid = (p: string) => `${p}-${(seq++).toString(36)}`;
export const ts = (date: string, time = '09:00') => new Date(`${date}T${time}:00+01:00`).toISOString();

export const BENCE: AccountantPublic & { email: string; capacity: number; appointmentsEnabled: boolean; monthlyStatementRequest: boolean } = {
  id: 'acc-bence',
  displayName: 'Kovács Bence',
  firstName: 'Bence',
  nameForms: { with: 'Bencével', from: 'Bencétől', onto: 'Bencére', acc: 'Bencét' },
  title: 'Mérlegképes könyvelő',
  registrationNumber: '123456',
  avatarKey: 'karakter_1_lapos',
  signatureSvgPath: DEMO_SIGNATURE,
  // SPEC §28.K.15: no answer-time promise (ACCOUNTANT_RESPONSE_TIME_DEFAULT)
  responseTimeText: 'A lehető leggyorsabban válaszol',
  email: 'bence.kovacs@demo.kezjegy.test',
  capacity: 150,
  appointmentsEnabled: true,
  monthlyStatementRequest: true,
};

// ---------- tax helpers ----------
const ACCOUNTS = {
  szja_eloleg: { accountName: 'NAV Személyi jövedelemadó beszedési számla', accountNumber: '10032000-06056353' },
  tb_jarulek: { accountName: 'NAV Társadalombiztosítási járulék beszedési számla', accountNumber: '10032000-06055802' },
  szocho: { accountName: 'NAV Szociális hozzájárulási adó beszedési számla', accountNumber: '10032000-06055912' },
} as const;
function iban(acc: string): string {
  const bban = `${acc.replace(/-/g, '')}${'0'.repeat(24)}`.slice(0, 24);
  const num = `${bban}1730` + '00'; // "HU" = 17 30
  let r = 0;
  for (const ch of num) r = (r * 10 + Number(ch)) % 97;
  const check = String(98 - r).padStart(2, '0');
  return `HU${check}${bban}`.replace(/(.{4})/g, '$1 ').trim();
}
const DUE = ['2026-04-13', '2026-07-13', '2026-10-12', '2027-01-12'];
const ROMAI = ['I.', 'II.', 'III.', 'IV.'];
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const sz = (n: number) => new Intl.NumberFormat('hu-HU').format(n).replace(/\s/g, ' ');

interface Expected { q: number; revenue: number; income: number; ytdIncome: number; taxableYtd: number; monthlyBases: number[]; tb: number; szocho: number; szjaAdvance: number; total: number }

export function quarterResult(who: 'kata' | 'reka' | 'peter', q: number, ratio: number, status: TaxProfile['status'], minimum: number | null): QuarterResult {
  const e = (fixtures.expectedTax2026 as Record<string, Expected[]>)[who]!.find((x) => x.q === q)!;
  const prevE = (fixtures.expectedTax2026 as Record<string, Expected[]>)[who]!.find((x) => x.q === q - 1);
  const byMonth = (fixtures.expectedReceivedByMonth as Record<string, number[]>)[who]!;
  const months = [0, 1, 2].map((i) => {
    const m = (q - 1) * 3 + i + 1;
    const rev = byMonth[m - 1]!;
    const base = e.monthlyBases[i] ?? 0;
    return { month: m, revenueHuf: rev, incomeHuf: Math.round((rev * (100 - ratio)) / 100), insured: status !== 'nyugdijas', minimumHuf: minimum, baseHuf: base, tbHuf: Math.round(base * 0.185), szochoHuf: Math.round(base * 0.13) };
  });
  const prevSzja = prevE ? Math.round(prevE.taxableYtd * 0.15) : 0;
  const lines: QuarterResult['explanation']['lines'] = [
    { kind: 'cim', label: 'Jövedelmed', side: `${HONAP[(q - 1) * 3]}–${HONAP[(q - 1) * 3 + 2]}` },
    { label: `${HONAP[(q - 1) * 3]![0]!.toUpperCase()}${HONAP[(q - 1) * 3]!.slice(1)}–${HONAP[(q - 1) * 3 + 2]}i bevételed`, amountHuf: e.revenue },
    { label: `Költséghányad, ${ratio}%`, amountHuf: e.revenue - e.income, op: '−' },
    { label: 'Jövedelmed a negyedévben', amountHuf: e.income, op: '=' },
    { kind: 'megjegyzes', label: `Év eleje óta ${sz(e.ytdIncome)} Ft jövedelem; ebből 1 936 800 Ft adómentes.` },
    { kind: 'cim', label: 'Amit fizetsz', side: `${ROMAI[q - 1]} negyedév` },
  ];
  if (status === 'nyugdijas') lines.push({ label: 'Nyugdíjasként TB-járulékot és szochót nem fizetsz.' });
  else if (minimum && e.monthlyBases.every((b) => b === minimum))
    lines.push({ kind: 'ado', label: `TB-járulék: havonta legalább ${sz(minimum)} Ft után fizetsz. A jövedelmed ennél kevesebb volt, ezért 3 × ${sz(minimum)} Ft ennek 18,5%-a`, amountHuf: e.tb });
  else lines.push({ kind: 'ado', label: `TB-járulék: a negyedévi járulékalapod 18,5%-a`, amountHuf: e.tb });
  if (status !== 'nyugdijas') lines.push({ kind: 'ado', label: 'Szocho (szociális hozzájárulási adó): ugyanennek 13%-a', amountHuf: e.szocho });
  if (e.taxableYtd > 0) {
    lines.push({ kind: 'sor', label: `SZJA: az adóköteles rész év eleje óta ${sz(e.taxableYtd)} Ft, ennek 15%-a`, amountHuf: Math.round(e.taxableYtd * 0.15) });
    lines.push({ kind: 'sor', op: '−', label: 'Az előző negyedévek előlege', amountHuf: prevSzja });
    lines.push({ kind: 'ado', op: '=', label: 'SZJA-előleg most', amountHuf: e.szjaAdvance });
  } else lines.push({ kind: 'ado', label: 'SZJA-előleg: még az adómentes részen belül vagy, most nincs', amountHuf: 0 });
  const warnings: QuarterResult['warnings'] = [];
  if (q === 4) warnings.push({ code: 'received_on_estimated', audience: 'konyvelo', text: 'Néhány átutalásos számlánál a befizetés napja becsült (fizetési határidő). A kivonat alapján érdemes átírni.' });
  if (who === 'reka') warnings.push({ code: 'garantalt_minimum_check', audience: 'konyvelo', text: 'Garantált bérminimummal számolunk (fodrászathoz szakképzettség kell). Ha ez nem áll fenn, vedd ki a pipát.' });
  if (who === 'reka') warnings.push({ code: 'afa_80', audience: 'ugyfel', text: 'Elérted az alanyi ÁFA-keret 80%-át. Ha átléped a 20 millió forintot, onnantól ÁFÁ-s leszel.' });
  if (who === 'peter') warnings.push({ code: 'mellekallas_condition', audience: 'konyvelo', text: 'Mellékállás: csak heti legalább 36 órás munkaviszony vagy nappali tanulmány mellett jár. Kérdezz rá évente.' });
  const payments = (
    [
      ['tb_jarulek', 'TB-járulék', undefined, e.tb],
      ['szocho', 'Szocho', 'szociális hozzájárulási adó', e.szocho],
      ['szja_eloleg', 'SZJA-előleg', `${ROMAI[q - 1]} negyedév`, e.szjaAdvance],
    ] as const
  )
    .filter((p) => p[3] > 0)
    .map(([kind, label, sublabel, amountHuf]) => ({ kind, label, sublabel, amountHuf, ...ACCOUNTS[kind], iban: iban(ACCOUNTS[kind].accountNumber) }));
  return {
    quarter: q as 1 | 2 | 3 | 4,
    periodKey: `2026-Q${q}`,
    dueDate: DUE[q - 1]!,
    complete: q < 4,
    revenueHuf: e.revenue,
    incomeHuf: e.income,
    incomeYtdHuf: e.ytdIncome,
    taxableYtdHuf: e.taxableYtd,
    cumulativeBasePerMonthHuf: 0,
    months,
    tbHuf: e.tb,
    szochoHuf: e.szocho,
    szjaAdvanceHuf: e.szjaAdvance,
    totalHuf: e.total,
    payments,
    explanation: {
      intro: '2026-tól a TB-járulékot, a szochót és az SZJA-előleget is negyedévente fizeted, a negyedév utáni hónap 12-éig. Mindhárom az idei jövedelmedből jön.',
      lines,
      result: `Összesen: ${sz(e.total)} Ft`,
    },
    warnings,
  };
}

export function paymentItems(r: QuarterResult, adoszam: string, marked?: { on: string; verified?: boolean }): PaymentItem[] {
  return r.payments.map((p) => ({
    id: uid('pi'),
    kind: p.kind,
    label: p.label,
    sublabel: p.sublabel,
    amountHuf: p.amountHuf,
    dueDate: r.dueDate,
    accountName: p.accountName,
    accountNumber: p.accountNumber,
    iban: p.iban,
    reference: adoszam,
    markedPaidAt: marked ? ts(marked.on, '19:20') : undefined,
    markedPaidOn: marked?.on,
    verifiedAt: marked?.verified ? ts(marked.on.replace(/-\d\d$/, '-11'), '10:00') : undefined,
    verification: marked?.verified ? 'rendben' : undefined,
  }));
}

// ---------- clients ----------
export interface MockClient {
  id: string;
  key: 'kata' | 'reka' | 'peter' | 'extra';
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  lifecycle: ClientLifecycle;
  clientSince: string;
  adoszam: string | null;
  adoazonositoJel: string | null;
  evNyilvantartasiSzam: string | null;
  birthName: string | null;
  address: { zip: string; city: string; line: string } | null;
  hqMunicipality: string | null;
  activityText: string | null;
  activityCode: string | null;
  evSince: string | null;
  previousAccountant: string | null;
  hasSeparateBusinessAccount: boolean | null;
  taxProfile: TaxProfile | null;
  steps: { step: OnboardingStep; status: StepStatus; note?: string; completedAt?: string; data?: { method?: MeghatalmazasMethod; submittedAt?: string } }[];
  kycStatus: KycStatus | null;
  sub: { status: SubscriptionStatus; since: string; nextChargeAt: string | null; cardMask: string | null; failedAttempts: number; lastFailureCode: string | null; tokensLeft: number; graceUntil: string | null; cancelAtPeriodEnd: boolean } | null;
  nav: NavConnection;
  afaUsed: number;
  afaProjected: number;
  atalanyUsed: number;
  adomentesMonth: number | null;
  incomeYtd: number;
  source: string | null;
  referralCode: string | null;
  personalCode: string;
  createdAt: string;
  lastUploadAt: string | null;
  /** SPEC §26.1.1: 'inditas' = starts a new business with our guide (no adószám yet). */
  businessStatus?: 'van' | 'inditas' | null;
}

const navNincs: NavConnection = { status: 'nincs', environment: null, loginHint: null, taxNumber: null, savedAt: null, lastTestAt: null, lastTestError: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null };
const navOk = (tax: string): NavConnection => ({
  status: 'rendben',
  environment: 'demo',
  loginHint: 'kez…',
  taxNumber: tax,
  savedAt: ts('2026-01-12', '10:30'),
  lastTestAt: ts('2026-01-12', '10:31'),
  lastTestError: null,
  lastSyncAt: ts(TODAY, '05:30'),
  lastSyncStatus: 'ok',
  lastSyncError: null,
});
const allDone = (from: string): MockClient['steps'] =>
  (['fiok', 'adatok', 'szerzodes', 'elofizetes', 'meghatalmazas', 'azonositas', 'idopont', 'nav_bekotes'] as OnboardingStep[]).map((s, i) => ({
    step: s,
    status: s === 'idopont' ? 'kihagyva' : 'kesz',
    completedAt: ts(from, `${String(9 + i).padStart(2, '0')}:00`),
    data: s === 'meghatalmazas' ? { method: 'onya_ugyfel', submittedAt: ts(from, '12:00') } : undefined,
  }));

function profile(costRatio: 45 | 80 | 90, status: TaxProfile['status'], guaranteedMinimum: boolean, extra: Partial<TaxProfile> = {}): TaxProfile {
  return { year: 2026, costRatio, costRatioSource: 'konyvelo_megerositette', status, guaranteedMinimum, insuranceBreaks: [], hipa: { method: 'savos', ratePct: 2 }, ...extra };
}

export function buildClients(): MockClient[] {
  const t = fixtures.taxIds;
  return [
    {
      id: 'c-kata',
      key: 'kata',
      firstName: 'Kata',
      lastName: 'Szabó',
      email: 'kata.szabo@demo.kezjegy.test',
      phone: '+36 30 000 0001',
      lifecycle: 'aktiv',
      clientSince: '2026-01-08',
      adoszam: t.kata.adoszam,
      adoazonositoJel: t.kata.adoazonositoJel,
      evNyilvantartasiSzam: '00000001',
      birthName: null,
      address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
      hqMunicipality: 'Budapest XIII. kerület',
      activityText: 'Grafikai tervezés és illusztráció',
      activityCode: '7410',
      evSince: '2019-03-01',
      previousAccountant: null,
      hasSeparateBusinessAccount: true,
      taxProfile: profile(45, 'fofoglalkozasu', false),
      steps: allDone('2026-01-08'),
      kycStatus: 'elfogadva',
      sub: { status: 'active', since: '2026-01-08', nextChargeAt: ts('2026-12-08', '06:00'), cardMask: 'xxxx-xxxx-xxxx-4193', failedAttempts: 0, lastFailureCode: null, tokensLeft: 1, graceUntil: null, cancelAtPeriodEnd: false },
      nav: navOk('68801234'),
      afaUsed: 8_242_000,
      afaProjected: 9_371_800,
      atalanyUsed: 8_242_000,
      adomentesMonth: 6,
      incomeYtd: 4_401_100,
      source: 'facebook / osz_2025',
      referralCode: null,
      personalCode: 'KATA7Q2X',
      createdAt: ts('2026-01-08', '20:14'),
      lastUploadAt: ts('2026-11-16', '18:42'),
    },
    {
      id: 'c-reka',
      key: 'reka',
      firstName: 'Réka',
      lastName: 'Varga',
      email: 'reka.varga@demo.kezjegy.test',
      phone: '+36 30 000 0002',
      lifecycle: 'aktiv',
      clientSince: '2026-01-15',
      adoszam: t.reka.adoszam,
      adoazonositoJel: t.reka.adoazonositoJel,
      evNyilvantartasiSzam: '00000002',
      birthName: null,
      address: { zip: '3300', city: 'Eger', line: 'Minta tér 3.' },
      hqMunicipality: 'Eger',
      activityText: 'Fodrászat',
      activityCode: '9602',
      evSince: '2015-06-01',
      previousAccountant: 'Minta Könyvelőiroda Bt.',
      hasSeparateBusinessAccount: true,
      taxProfile: profile(80, 'fofoglalkozasu', true),
      steps: allDone('2026-01-15'),
      kycStatus: 'elfogadva',
      sub: { status: 'active', since: '2026-01-15', nextChargeAt: ts('2026-12-15', '06:00'), cardMask: 'xxxx-xxxx-xxxx-0287', failedAttempts: 0, lastFailureCode: null, tokensLeft: 2, graceUntil: null, cancelAtPeriodEnd: false },
      nav: navOk('68904564'),
      afaUsed: 16_315_000,
      afaProjected: 18_551_200,
      atalanyUsed: 16_315_000,
      adomentesMonth: 7,
      incomeYtd: 3_234_000,
      source: 'google / kereses',
      referralCode: null,
      personalCode: 'REKA4M8P',
      createdAt: ts('2026-01-15', '09:02'),
      lastUploadAt: ts('2026-11-02', '08:15'),
    },
    {
      id: 'c-peter',
      key: 'peter',
      firstName: 'Péter',
      lastName: 'Németh',
      email: 'peter.nemeth@demo.kezjegy.test',
      phone: '+36 30 000 0003',
      lifecycle: 'bekotes_alatt',
      clientSince: '2026-11-10',
      adoszam: t.peter.adoszam,
      adoazonositoJel: t.peter.adoazonositoJel,
      evNyilvantartasiSzam: '00000003',
      birthName: null,
      address: { zip: '6720', city: 'Szeged', line: 'Kitalált sor 12.' },
      hqMunicipality: 'Szeged',
      activityText: 'Weboldal-fejlesztés',
      activityCode: null,
      evSince: '2024-02-01',
      previousAccountant: 'Minta Könyvelőiroda Bt.',
      hasSeparateBusinessAccount: false,
      taxProfile: profile(45, 'mellekallasu', false, {
        costRatioSource: 'ugyfel_javaslat',
        priorOverrides: { throughQuarter: 3, priorActualBaseSum: 653_700, priorSzjaAdvanceSum: 98_055 },
      }),
      steps: [
        { step: 'fiok', status: 'kesz', completedAt: ts('2026-11-10', '19:02') },
        { step: 'adatok', status: 'kesz', completedAt: ts('2026-11-10', '19:20') },
        { step: 'szerzodes', status: 'kesz', completedAt: ts('2026-11-10', '19:24') },
        { step: 'elofizetes', status: 'kesz', completedAt: ts('2026-11-10', '19:27') },
        { step: 'meghatalmazas', status: 'konyvelore_var', data: { method: 'onya_ugyfel', submittedAt: ts('2026-11-16', '21:10') } },
        { step: 'azonositas', status: 'kesz', completedAt: ts('2026-11-12', '10:05') },
        { step: 'idopont', status: 'ugyfelre_var' },
        { step: 'nav_bekotes', status: 'nincs_kezdve' },
      ],
      kycStatus: 'elfogadva',
      sub: { status: 'active', since: '2026-11-10', nextChargeAt: ts('2026-12-10', '06:00'), cardMask: 'xxxx-xxxx-xxxx-7720', failedAttempts: 0, lastFailureCode: null, tokensLeft: 11, graceUntil: null, cancelAtPeriodEnd: false },
      nav: navNincs,
      afaUsed: 5_620_000,
      afaProjected: 6_390_300,
      atalanyUsed: 5_620_000,
      adomentesMonth: 7,
      incomeYtd: 3_091_000,
      source: 'ajánlás',
      referralCode: 'KATA7Q2X',
      personalCode: 'PETER2K9',
      createdAt: ts('2026-11-10', '18:55'),
      lastUploadAt: ts('2026-11-12', '10:01'),
    },
    extra('c-anna', 'Anna', 'Tóth', 'Masszázs', 45, 'aktiv', '2026-03-02', 4_120_000, 'instagram / tavasz', { sub: 'active' }),
    extra('c-gabor', 'Gábor', 'Kiss', 'Fotózás, rendezvényfotó', 45, 'aktiv', '2026-02-11', 7_380_000, 'facebook / osz_2025', { sub: 'past_due' }),
    extra('c-eszter', 'Eszter', 'Molnár', 'Jógaoktatás', 45, 'aktiv', '2026-05-20', 2_960_000, null, { sub: 'active' }),
    extra('c-lili', 'Lili', 'Farkas', 'Használtruha-kereskedés (webshop)', 90, 'bekotes_alatt', '2026-11-15', 0, 'google / kereses', { sub: 'incomplete' }),
    // SPEC §26.13 + a few more pipeline cards: clients who START a business with our guide (all fictional).
    ujVallalkozo('c-levente', 'Levente', 'Tóth', '2026-11-11', 'vallalkozas_inditas', { phone: '+36 30 555 0142', address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' }, szerzodes: true }),
    ujVallalkozo('c-zsofia', 'Zsófia', 'Fehér', '2026-11-09', 'vallalkozas_inditas', { phone: '+36 20 555 0177' }),
    ujVallalkozo('c-dora', 'Dóra', 'Balogh', '2026-11-16', 'vallalkozas_inditas', { phone: '+36 70 555 0123' }),
    ujVallalkozo('c-mark', 'Márk', 'Horváth', '2026-11-05', 'vallalkozas_inditas', { phone: '+36 30 555 0188', szerzodes: true }),
    ujVallalkozo('c-viktor', 'Viktor', 'Pintér', '2026-11-03', 'vallalkozas_inditas', { phone: '+36 20 555 0164', szerzodes: true }),
    ujVallalkozo('c-nora', 'Nóra', 'Kertész', '2026-10-27', 'meghatalmazas', { phone: '+36 30 555 0109', szerzodes: true, kesz: { adoszam: '12345676-1-13', ev: '58123456', since: '2026-11-11', activity: 'Grafikai tervezés, illusztráció' } }),
    ujVallalkozo('c-balint', 'Bálint', 'Sipos', '2026-11-01', 'vallalkozas_inditas', { phone: '+36 70 555 0155' }),
    // SPEC §27.7.4 demo addition (all fictional) + three more states of "Intézzük helyette" and a branch switcher.
    { ...ujVallalkozo('c-marika', 'Marika', 'Kiss', '2026-11-12', 'meghatalmazas', { phone: '+36 30 555 0131', address: { zip: '3530', city: 'Miskolc', line: 'Próba utca 12.' }, szerzodes: true }), adoazonositoJel: '8410084317' },
    ujVallalkozo('c-ilona', 'Ilona', 'Balogh', '2026-11-16', 'vallalkozas_inditas', { phone: '+36 70 555 0177', address: { zip: '4400', city: 'Nyíregyháza', line: 'Kitalált utca 5.' } }),
    { ...ujVallalkozo('c-timea', 'Tímea', 'Vass', '2026-11-08', 'vallalkozas_inditas', { phone: '+36 20 555 0193', address: { zip: '9021', city: 'Győr', line: 'Minta tér 2.' }, szerzodes: true }), adoazonositoJel: '8458365081' },
    letezo('c-david', 'Dávid', 'Molnár', '2026-11-13', { phone: '+36 30 555 0126', adoszam: '68790013-1-33', adoazonositoJel: '8437092159', previousAccountant: 'Minta Könyvelő Kft.' }),
    { ...letezo('c-gergely', 'Gergely', 'Szűcs', '2026-11-15', { phone: '+36 20 555 0144', adoszam: null, adoazonositoJel: null, previousAccountant: null }), businessStatus: 'van' },
    // SPEC §28.11 + §28.K.21 seed personas (all fictional): allowances, reserve, notifications, changes, check-in,
    // annual closing, service lock, pause, EFO, adószám later, KATA. Their §28 state lives in src/mock/k28.ts.
    { ...extra('c-szabo-eszter', 'Eszter', 'Szabó', 'Könyvillusztráció', 45, 'aktiv', '2026-02-02', 6_600_000, 'facebook / osz_2025', { sub: 'active' }), taxProfile: profile(45, 'mellekallasu', false), adoszam: '68811223-1-41', phone: '+36 30 555 0211' },
    { ...extra('c-toth-balint', 'Bálint', 'Tóth', 'Weboldal-készítés', 45, 'aktiv', '2026-03-09', 5_400_000, 'instagram / tavasz', { sub: 'active' }), adoszam: '68822334-1-42', phone: '+36 20 555 0212' },
    { ...extra('c-kovacs-adam', 'Ádám', 'Kovács', 'Asztalosmunka', 80, 'aktiv', '2026-04-14', 7_900_000, 'google / kereses', { sub: 'active' }), adoszam: '68833445-1-43', adoazonositoJel: '8412345673', phone: '+36 70 555 0213' },
    { ...extra('c-varga-reka2', 'Réka-Demo', 'Varga', 'Kozmetika', 80, 'aktiv', '2026-02-20', 3_100_000, null, { sub: 'active' }), adoszam: '68844556-1-44', adoazonositoJel: '8423456784', phone: null },
    { ...extra('c-lakatos-greta', 'Gréta', 'Lakatos', 'Masszázs', 45, 'aktiv', '2026-01-05', 12_600_000, 'google / kereses', { sub: 'active' }), adoszam: '68855667-1-45', phone: '+36 30 555 0215' },
    { ...extra('c-kiss-norbert', 'Norbert', 'Kiss', 'Villanyszerelés', 80, 'aktiv', '2026-01-20', 9_200_000, 'facebook / osz_2025', { sub: 'active' }), adoszam: '68866778-1-46', adoazonositoJel: '8434567895', phone: '+36 20 555 0216' },
    { ...extra('c-fazekas-ilona', 'Ilona', 'Fazekas', 'Varroda', 80, 'felfuggesztve', '2026-03-03', 4_300_000, null, { sub: 'suspended' }), adoszam: '68877889-1-47', phone: '+36 70 555 0217' },
    {
      ...letezo('c-barany-tamas', 'Tamás', 'Bárány', '2026-11-14', { phone: '+36 30 555 0218', adoszam: null, adoazonositoJel: null, previousAccountant: null }),
      activityText: 'Rendezvényszervezés',
      steps: [
        { step: 'fiok', status: 'kesz', completedAt: ts('2026-11-14', '19:10') },
        { step: 'adatok', status: 'kesz', completedAt: ts('2026-11-14', '19:25') },
        { step: 'szerzodes', status: 'kesz', completedAt: ts('2026-11-14', '19:31') },
        { step: 'meghatalmazas', status: 'ugyfelre_var' },
        { step: 'azonositas', status: 'nincs_kezdve' },
        { step: 'elofizetes', status: 'nincs_kezdve' },
        { step: 'nav_bekotes', status: 'nincs_kezdve' },
      ],
    },
    { ...extra('c-molnar-csilla', 'Csilla', 'Molnár', 'Virágkötészet', 45, 'aktiv', '2025-09-01', 2_400_000, 'ajánlás', { sub: 'active' }), adoszam: '68899001-1-49', phone: '+36 20 555 0219' },
  ];
}

/** Existing-business client in onboarding (path 'van', SPEC §27.7.4 Molnár Dávid): profile done, contract accepted. */
function letezo(
  id: string,
  firstName: string,
  lastName: string,
  since: string,
  o: { phone: string; adoszam: string | null; adoazonositoJel: string | null; previousAccountant: string | null },
): MockClient {
  const c = extra(id, firstName, lastName, 'Webfejlesztés', 45, 'bekotes_alatt', since, 0, 'google / kereses', { sub: 'incomplete' });
  const done = (step: OnboardingStep) => ({ step, status: 'kesz' as const, completedAt: ts(since, '19:10') });
  return {
    ...c,
    phone: o.phone,
    adoszam: o.adoszam,
    adoazonositoJel: o.adoazonositoJel,
    address: { zip: '1117', city: 'Budapest', line: 'Kitalált köz 8.' },
    previousAccountant: o.previousAccountant,
    evSince: o.adoszam ? '2021-05-01' : null,
    businessStatus: 'van',
    steps: [
      done('fiok'),
      o.adoszam ? done('adatok') : { step: 'adatok', status: 'ugyfelre_var' },
      o.adoszam ? done('szerzodes') : { step: 'szerzodes', status: 'nincs_kezdve' },
      { step: 'meghatalmazas', status: o.adoszam ? 'konyvelore_var' : 'nincs_kezdve', data: o.adoszam ? { method: 'onya_konyvelo', submittedAt: ts('2026-11-16', '15:40') } : undefined },
      { step: 'azonositas', status: 'nincs_kezdve' },
      { step: 'elofizetes', status: 'nincs_kezdve' },
      { step: 'nav_bekotes', status: 'nincs_kezdve' },
    ],
  };
}

/** New-business client (path 'inditas', SPEC §26.1.6): step order fiok, adatok, vallalkozas_inditas, szerzodes, … */
function ujVallalkozo(
  id: string,
  firstName: string,
  lastName: string,
  since: string,
  most: OnboardingStep,
  o: { phone: string; address?: { zip: string; city: string; line: string }; szerzodes?: boolean; kesz?: { adoszam: string; ev: string; since: string; activity: string } },
): MockClient {
  const ekezet = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const order: OnboardingStep[] = ['fiok', 'adatok', 'vallalkozas_inditas', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'];
  const steps: MockClient['steps'] = order.map((s, i) => {
    if (s === 'fiok' || s === 'adatok') return { step: s, status: 'kesz', completedAt: ts(since, `${String(18 + i).padStart(2, '0')}:10`) };
    if (s === 'szerzodes') return o.szerzodes ? { step: s, status: 'kesz', completedAt: ts(since, '20:30') } : { step: s, status: 'nincs_kezdve' };
    if (s === 'vallalkozas_inditas') return { step: s, status: o.kesz ? 'kesz' : 'ugyfelre_var', completedAt: o.kesz ? ts(o.kesz.since, '11:00') : undefined };
    if (s === most) return { step: s, status: 'ugyfelre_var' };
    return { step: s, status: 'nincs_kezdve' };
  });
  return {
    id,
    key: 'extra',
    firstName,
    lastName,
    email: `${ekezet(firstName)}.${ekezet(lastName)}@demo.kezjegy.test`,
    phone: o.phone,
    lifecycle: 'bekotes_alatt',
    clientSince: since,
    adoszam: o.kesz?.adoszam ?? null,
    adoazonositoJel: null,
    evNyilvantartasiSzam: o.kesz?.ev ?? null,
    birthName: null,
    address: o.address ?? { zip: '1000', city: 'Budapest', line: 'Kitalált utca 9.' },
    hqMunicipality: o.kesz ? 'Budapest' : null,
    activityText: o.kesz?.activity ?? null,
    activityCode: null,
    evSince: o.kesz?.since ?? null,
    previousAccountant: null,
    hasSeparateBusinessAccount: null,
    taxProfile: o.kesz ? { ...profile(45, 'fofoglalkozasu', false), costRatioSource: 'ugyfel_javaslat' } : null,
    steps,
    kycStatus: null,
    sub: null,
    nav: navNincs,
    afaUsed: 0,
    afaProjected: 0,
    atalanyUsed: 0,
    adomentesMonth: null,
    incomeYtd: 0,
    source: 'google / kereses',
    referralCode: null,
    personalCode: `${ekezet(firstName).toUpperCase().slice(0, 4)}8U2N`,
    createdAt: ts(since, '18:00'),
    lastUploadAt: null,
    businessStatus: 'inditas',
  };
}

function extra(id: string, firstName: string, lastName: string, activity: string, ratio: 45 | 80 | 90, lifecycle: ClientLifecycle, since: string, afa: number, source: string | null, o: { sub: SubscriptionStatus }): MockClient {
  const onb = lifecycle === 'bekotes_alatt';
  return {
    id,
    key: 'extra',
    firstName,
    lastName,
    email: `${firstName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${lastName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@demo.kezjegy.test`,
    phone: null,
    lifecycle,
    clientSince: since,
    adoszam: null,
    adoazonositoJel: null,
    evNyilvantartasiSzam: null,
    birthName: null,
    address: onb ? null : { zip: '1000', city: 'Budapest', line: 'Kitalált utca 1.' },
    hqMunicipality: onb ? null : 'Budapest',
    activityText: activity,
    activityCode: null,
    evSince: onb ? null : '2022-01-01',
    previousAccountant: null,
    hasSeparateBusinessAccount: onb ? null : true,
    taxProfile: onb ? null : profile(ratio, 'fofoglalkozasu', false),
    steps: onb
      ? [
          { step: 'fiok', status: 'kesz', completedAt: ts(since, '20:00') },
          { step: 'adatok', status: 'ugyfelre_var' },
          { step: 'szerzodes', status: 'nincs_kezdve' },
          { step: 'elofizetes', status: 'nincs_kezdve' },
          { step: 'meghatalmazas', status: 'nincs_kezdve' },
          { step: 'azonositas', status: 'nincs_kezdve' },
          { step: 'idopont', status: 'nincs_kezdve' },
          { step: 'nav_bekotes', status: 'nincs_kezdve' },
        ]
      : allDone(since),
    kycStatus: onb ? null : 'elfogadva',
    sub:
      o.sub === 'incomplete'
        ? { status: 'incomplete', since, nextChargeAt: null, cardMask: null, failedAttempts: 0, lastFailureCode: null, tokensLeft: 0, graceUntil: null, cancelAtPeriodEnd: false }
        : {
            status: o.sub,
            since,
            nextChargeAt: ts(o.sub === 'past_due' ? '2026-11-18' : `2026-12-${since.slice(8)}`, '06:00'),
            cardMask: `xxxx-xxxx-xxxx-${String(1000 + afa / 1000).slice(-4)}`,
            failedAttempts: o.sub === 'past_due' ? 2 : 0,
            lastFailureCode: o.sub === 'past_due' ? 'card_declined' : null,
            tokensLeft: 6,
            graceUntil: o.sub === 'past_due' ? '2026-11-25' : null,
            cancelAtPeriodEnd: false,
          },
    nav: onb ? navNincs : navOk('99999999'),
    afaUsed: afa,
    afaProjected: Math.round((afa * 365) / 321),
    atalanyUsed: afa,
    adomentesMonth: afa > 3_500_000 ? 7 : null,
    incomeYtd: Math.round(afa * (1 - ratio / 100)),
    source,
    referralCode: null,
    personalCode: `${firstName.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 4)}5T7Q`,
    createdAt: ts(since, '20:00'),
    lastUploadAt: onb ? null : ts('2026-11-1' + (afa % 7), '17:30'),
  };
}

// ---------- NAV invoices + revenue ----------
type FxInv = (typeof fixtures.navInvoices)['68801234'][number];
export function navInvoicesFor(c: MockClient): { rows: NavInvoiceDetail[]; revenue: RevenueItem[] } {
  if (c.key === 'extra' || !c.adoszam) return { rows: [], revenue: [] };
  const list = ((fixtures.navInvoices as Record<string, FxInv[]>)[c.adoszam.slice(0, 8)] ?? []).filter((i) => i.issueDate <= TODAY);
  const rows: NavInvoiceDetail[] = [];
  const revenue: RevenueItem[] = [];
  for (const i of list) {
    const cash = ['CASH', 'CARD', 'VOUCHER'].includes(i.paymentMethod);
    const receivedOn = cash ? i.issueDate : i.paymentDate ?? i.issueDate;
    const estimated = !cash && receivedOn >= '2026-10-01';
    const revId = uid('rev');
    const id = uid('inv');
    const month = i.issueDate.slice(0, 7);
    const status = month < '2026-10' ? 'beadva' : month === '2026-10' ? 'feldolgozva' : 'feltoltve';
    rows.push({
      id,
      invoiceNumber: i.invoiceNumber,
      issueDate: i.issueDate,
      customerName: i.customer?.name ?? null,
      grossAmountHuf: i.grossAmountHuf,
      status,
      demo: true,
      operation: i.operation as 'CREATE',
      deliveryDate: i.deliveryDate,
      paymentDate: i.paymentDate ?? null,
      paymentMethod: i.paymentMethod,
      customerTaxNumber: i.customer?.taxNumber ?? null,
      revenueItemId: revId,
      receivedOn,
      receivedOnEstimated: estimated,
      currency: i.currency,
      netHuf: i.netAmountHuf,
      vatHuf: i.vatAmountHuf,
      vatExemption: i.vatExemption ?? null,
      lines: i.lines,
    });
    revenue.push({
      id: revId,
      source: 'nav_szamla',
      navInvoiceId: id,
      receivedOn,
      receivedOnEstimated: estimated,
      deliveryDate: i.deliveryDate,
      amountHuf: i.grossAmountHuf,
      description: `${i.invoiceNumber} · ${i.customer?.name ?? ''}`,
      countsForAtalany: true,
      countsForAfaLimit: true,
    });
  }
  for (const m of (fixtures.manualRevenue as Record<string, { receivedOn: string; amountHuf: number; description: string }[]>)[c.key] ?? []) {
    revenue.push({ id: uid('rev'), source: 'kezi', receivedOn: m.receivedOn, receivedOnEstimated: false, deliveryDate: m.receivedOn, amountHuf: m.amountHuf, description: m.description, countsForAtalany: true, countsForAfaLimit: true });
  }
  revenue.sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  return { rows, revenue };
}

// ---------- tax periods ----------
export function taxPeriodsFor(c: MockClient): AccTaxPeriod[] {
  if (c.key === 'extra' || !c.taxProfile) return [];
  const ratio = c.taxProfile.costRatio;
  const min = c.taxProfile.status === 'mellekallasu' ? null : c.taxProfile.guaranteedMinimum ? 373_200 : 322_800;
  const out: AccTaxPeriod[] = [];
  for (let q = 1; q <= 4; q++) {
    const r = quarterResult(c.key as 'kata', q, ratio, c.taxProfile.status, min);
    const base: AccTaxPeriod = {
      id: `tp-${c.key}-${q}`,
      periodKey: `2026-Q${q}`,
      kind: 'negyedev',
      label: `${ROMAI[q - 1]} negyedév`,
      dueDate: DUE[q - 1]!,
      calcStatus: 'becsles',
      paymentStatus: 'nincs_fizetendo',
      filingStatus: 'nincs',
      totalHuf: r.totalHuf,
      year: 2026,
      quarter: q,
      items: [],
      letter: null,
      latestCalculation: { id: `calc-${c.key}-${q}`, taxPeriodId: `tp-${c.key}-${q}`, version: 1, engineVersion: '1.0.0', rulesVersion: '2026-01-01', asOf: q < 4 ? DUE[q - 1]!.replace(/-\d\d$/, '-01') : TODAY, result: r, overrides: null, letterText: null, approvedAt: null, approvedBy: null },
      approvedCalculationId: null,
      filed: null,
    };
    if (c.key === 'peter' && q < 4) {
      base.calcStatus = 'nincs';
      base.totalHuf = null;
      base.latestCalculation = null;
      out.push(base);
      continue;
    }
    const approvedOn = ['2026-04-02', '2026-07-02', '2026-10-02'][q - 1];
    if (q < 4 && approvedOn) {
      const paid = c.key === 'kata' ? ['2026-04-09', '2026-07-09', '2026-10-09'][q - 1]! : ['2026-04-08', '2026-07-10', '2026-10-10'][q - 1]!;
      const verified = !(c.key === 'reka' && q === 3);
      base.calcStatus = 'jovahagyva';
      base.paymentStatus = verified ? 'ellenorizve' : 'befizetve_jelezve';
      base.items = paymentItems(r, c.adoszam!, { on: paid, verified });
      base.approvedCalculationId = base.latestCalculation!.id;
      base.latestCalculation = { ...base.latestCalculation!, approvedAt: ts(approvedOn, '16:40'), approvedBy: 'Kovács Bence', letterText: 'Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg.' };
      base.letter = { greeting: `Kedves ${c.firstName}!`, body: 'Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg.', signedBy: 'Kovács Bence', signedRole: 'könyvelőd', date: approvedOn };
      const filedOn = c.key === 'kata' ? ['2026-04-10', '2026-07-10', '2026-10-02'][q - 1]! : ['2026-04-10', '2026-07-10', '2026-10-10'][q - 1]!;
      base.filingStatus = 'beadva';
      base.filed = {
        filedOn,
        form: '2658',
        documents: [
          { id: uid('d'), title: `Bevallás a ${ROMAI[q - 1]} negyedévről`, category: 'bevallas', source: 'konyvelo', status: 'beadva', statusLabel: 'Beadva', statusAt: ts(filedOn, '15:00'), dossierMonth: filedOn.slice(0, 7), icon: 'irat', pageCount: 3 },
          { id: uid('d'), title: `NAV-visszaigazolás, ${ROMAI[q - 1]} negyedév`, category: 'nav_visszaigazolas', source: 'konyvelo', status: 'beadva', statusLabel: 'Beadva', statusAt: ts(filedOn, '15:02'), dossierMonth: filedOn.slice(0, 7), icon: 'irat', pageCount: 1 },
        ],
      };
    }
    out.push(base);
  }
  return out;
}

// ---------- documents ----------
export function documentsFor(c: MockClient): AccDocument[] {
  const docs: AccDocument[] = [];
  const add = (d: Partial<AccDocument> & Pick<AccDocument, 'title' | 'category' | 'source' | 'status' | 'dossierMonth'>, at: string) =>
    docs.push({
      id: uid('d'),
      statusLabel: '',
      statusAt: at,
      icon: 'irat',
      pageCount: 1,
      visibility: 'kozos',
      createdAt: at,
      createdByRole: d.source === 'ugyfel' ? 'client' : d.source === 'konyvelo' ? 'accountant' : 'system',
      fileId: uid('f'),
      mime: d.category === 'nyugta' || d.category === 'koltseg_bizonylat' ? 'image/jpeg' : 'application/pdf',
      ...d,
    });
  if (c.key === 'kata') {
    for (let m = 1; m <= 9; m++) {
      const mk = `2026-${String(m).padStart(2, '0')}`;
      const next = `2026-${String(m + 1).padStart(2, '0')}-0${3 + (m % 4)}`;
      add({ title: `Bankszámlakivonat, ${HONAP[m - 1]}`, category: 'bankszamlakivonat', source: 'ugyfel', status: 'beadva', dossierMonth: mk, pageCount: 2 }, ts(next, '19:10'));
      if (m % 3 === 0) add({ title: 'Számla, szoftver-előfizetés', category: 'koltseg_bizonylat', source: 'ugyfel', status: 'beadva', dossierMonth: mk, amountHuf: 12_990 }, ts(`${mk}-21`, '12:00'));
    }
    add({ title: 'Nyugta, készpénzes eladás', category: 'nyugta', source: 'ugyfel', status: 'feldolgozva', dossierMonth: '2026-10', amountHuf: 18_000, accountantComment: 'Ha máskor is kézzel adsz nyugtát, elég a hónap végén egyszerre lefotóznod a tömb lapjait.' }, ts('2026-10-03', '17:22'));
    add({ title: 'Szerződés, Bodza Kiadó', category: 'szerzodes', source: 'ugyfel', status: 'feltoltve', dossierMonth: '2026-10', pageCount: 4, clientNote: 'Ez az új könyvsorozat, jövő évre is szól.' }, ts('2026-10-08', '21:05'));
    add({ title: 'Levél a NAV-tól', category: 'nav_level', source: 'ugyfel', status: 'feldolgozva', dossierMonth: '2026-10', accountantComment: 'Csak értesítés, nincs teendőd.' }, ts('2026-10-07', '20:31'));
    add({ title: 'Bevallás a III. negyedévről', category: 'bevallas', source: 'konyvelo', status: 'beadva', dossierMonth: '2026-10', pageCount: 3 }, ts('2026-10-02', '15:00'));
    add({ title: 'Nyugta, novemberi tömb', category: 'nyugta', source: 'ugyfel', status: 'feltoltve', dossierMonth: '2026-11', amountHuf: 9_500, pageCount: 2 }, ts('2026-11-16', '18:42'));
    add({ title: 'Számla, nyomdai próbanyomat', category: 'koltseg_bizonylat', source: 'ugyfel', status: 'konyvelo_latta', dossierMonth: '2026-11', amountHuf: 24_500 }, ts('2026-11-12', '09:40'));
    add({ title: 'Bankszámlakivonat, október', category: 'bankszamlakivonat', source: 'ugyfel', status: 'feltoltve', dossierMonth: '2026-10', pageCount: 2 }, ts('2026-11-14', '08:02'));
  }
  if (c.key === 'reka') {
    for (let m = 1; m <= 10; m++) {
      const mk = `2026-${String(m).padStart(2, '0')}`;
      add({ title: `Pénztárgép havi összesítő, ${HONAP[m - 1]}`, category: 'penztargep_osszesito', source: 'ugyfel', status: m <= 9 ? 'beadva' : 'feldolgozva', dossierMonth: mk }, ts(`2026-${String(m + 1).padStart(2, '0')}-02`, '08:15'));
    }
    add({ title: 'Számla, hajfesték-rendelés', category: 'koltseg_bizonylat', source: 'ugyfel', status: 'feltoltve', dossierMonth: '2026-11', amountHuf: 64_800 }, ts('2026-11-06', '13:10'));
  }
  if (c.key === 'peter') {
    add({ title: 'Bankszámlakivonat, január–október', category: 'bankszamlakivonat', source: 'ugyfel', status: 'feltoltve', dossierMonth: '2026-11', pageCount: 14 }, ts('2026-11-12', '10:01'));
    add({ title: 'Megbízási szerződés (aláírt)', category: 'szerzodes_alairt', source: 'rendszer', status: 'feldolgozva', dossierMonth: '2026-11', pageCount: 3 }, ts('2026-11-10', '19:24'));
  }
  return docs;
}

// ---------- requests, messages, notes ----------
export function requestsFor(c: MockClient): RequestSummary[] {
  const r: RequestSummary[] = [];
  if (c.key === 'kata') {
    r.push({ id: uid('r'), direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az októberi bankszámlakivonatodat.', body: 'Csak ellenőrzéshez kell, a befizetendő összeg nem változik. Elég a bankod appjából letöltött PDF.', status: 'nyitott', statusLabel: 'Nyitott', dueDate: '2026-11-20', createdAt: ts('2026-11-01', '06:10'), dossierMonth: '2026-10' });
    r.push({ id: uid('r'), direction: 'ugyfeltol', type: 'jovedelemigazolas', title: 'Jövedelemigazolás', body: 'A bank kéri a lakáshitelhez.', status: 'folyamatban', statusLabel: 'Bence látta, pár napon belül kész', createdAt: ts(TODAY, '09:02'), certificate: { certificateType: 'jovedelemigazolas', year: 2025, purpose: 'bank, lakáshitel', language: 'hu' } });
    r.push({ id: uid('r'), direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel a szeptemberi bankszámlakivonatodat.', body: '', status: 'teljesitve', statusLabel: 'Teljesítve', createdAt: ts('2026-10-01', '06:10'), dossierMonth: '2026-09' });
  }
  if (c.key === 'reka') {
    r.push({ id: uid('r'), direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az októberi bankszámlakivonatodat.', body: 'Csak ellenőrzéshez kell. Elég a bankod appjából letöltött PDF.', status: 'nyitott', statusLabel: 'Nyitott', dueDate: '2026-11-10', createdAt: ts('2026-11-01', '06:10'), dossierMonth: '2026-10' });
    r.push({ id: uid('r'), direction: 'ugyfeltol', type: 'adatvaltozas', title: 'Megváltozott a telefonszámom', body: 'Új számom van, a régit lemondtam.', status: 'nyitott', statusLabel: 'Nyitott', createdAt: ts('2026-11-16', '19:45') });
  }
  if (c.key === 'peter') {
    r.push({ id: uid('r'), direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az idei bankszámlakivonataidat.', body: 'Az előző könyvelődtől átvett adatokat ezzel egyeztetem.', status: 'teljesitve', statusLabel: 'Teljesítve', dueDate: '2026-11-15', createdAt: ts('2026-11-10', '20:00') });
    r.push({ id: uid('r'), direction: 'ugyfeltol', type: 'nullas_igazolas', title: 'Nullás igazolás', body: 'Pályázathoz kell.', status: 'nyitott', statusLabel: 'Nyitott', createdAt: ts('2026-11-15', '11:20'), certificate: { certificateType: 'nullas_igazolas', purpose: 'pályázat', language: 'hu' } });
  }
  if (c.id === 'c-gabor') r.push({ id: uid('r'), direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel a szeptemberi és októberi kivonatot.', body: '', status: 'nyitott', statusLabel: 'Nyitott', dueDate: '2026-11-19', createdAt: ts('2026-11-03', '10:00') });
  return r;
}

export function messagesFor(c: MockClient, reqs: RequestSummary[]): Message[] {
  if (c.key !== 'kata' && c.key !== 'peter') return [];
  const m = (sender: Message['sender'], body: string, at: string, extra: Partial<Message> = {}): Message => ({ id: uid('m'), kind: 'szoveg', body, sender, createdAt: at, attachments: [], readByClientAt: sender === 'en' ? at : undefined, ...extra });
  if (c.key === 'peter')
    return [
      m('ugyfel', 'Szia! Beküldtem az ONYA-ban a meghatalmazást, remélem jól.', ts('2026-11-16', '21:12')),
      m('en', 'Szia Péter! Köszönöm, holnap megnézem a NAV-nál, és szólok.', ts(TODAY, '08:31')),
    ].reverse();
  const cert = reqs.find((r) => r.certificate);
  return [
    m('ugyfel', 'Szia Bence! Megjött a Bodza Kiadós szerződés, feltöltöttem.', ts('2026-10-08', '21:06')),
    m('en', 'Köszönöm, megnézem. A szerződés miatt nem változik a befizetendő.', ts('2026-10-09', '09:15')),
    m('ugyfel', 'Levelet kaptam a NAV-tól, megijedtem. Feltöltöttem a dossziéba.', ts(TODAY.replace(/17$/, '16'), '20:31')),
    m('en', 'Megnéztem: csak értesítés, nincs vele teendőd. Elteheted.', ts(TODAY, '08:47')),
    { ...m('ugyfel', '', ts(TODAY, '09:02')), kind: 'keres_kartya' as const, request: cert },
  ].reverse();
}

export const NOTES: Record<string, InternalNote[]> = {
  'c-kata': [
    { id: 'n1', body: 'Decembertől egy új kiadóval is dolgozik (Bodza). Év végén rákérdezni, marad-e 45% alatt a bevétel üteme.', pinned: true, author: 'Kovács Bence', createdAt: ts('2026-10-09', '09:20'), updatedAt: ts('2026-10-09', '09:20') },
    { id: 'n2', body: 'Kézi nyugtatömböt is használ, havonta egyben fotózza.', pinned: false, author: 'Kovács Bence', createdAt: ts('2026-10-04', '10:02'), updatedAt: ts('2026-10-04', '10:02') },
  ],
  'c-reka': [{ id: 'n3', body: 'ÁFA-határ közel: decemberben már nem biztos, hogy belefér. Beszélni vele a 2027-es 22 M-s keretről.', pinned: true, author: 'Kovács Bence', createdAt: ts('2026-11-05', '14:00'), updatedAt: ts('2026-11-05', '14:00') }],
};

export const TEMPLATES: MessageTemplate[] = [
  { id: 't1', title: 'NAV-levél: nincs teendő', body: 'Megnéztem: csak értesítés, nincs vele teendőd. Elteheted.', global: true },
  { id: 't2', title: 'Kivonat megjött', body: 'Köszönöm, {firstName}! Megjött a kivonat, minden rendben van vele.', global: false },
  { id: 't3', title: 'Igazolás: pár nap', body: 'Láttam a kérésed. A NAV-tól pár napon belül megjön, és rögtön feltöltöm.', global: false },
  { id: 't4', title: 'Befizetés látszik', body: 'Látom a befizetésed az adószámládon, minden rendben.', global: false },
];

export function syncRuns(c: MockClient): NavSyncRun[] {
  if (c.nav.status === 'nincs') return [];
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(Date.parse(`${TODAY}T05:30:00+01:00`) - i * 86_400_000).toISOString();
    return { id: uid('run'), startedAt: d, finishedAt: d, status: 'ok', digestsSeen: 30 - i, invoicesNew: i === 0 ? 1 : i === 3 ? 2 : 0, errorCode: null };
  });
}

export function auditRows(clients: MockClient[]): AuditRow[] {
  const k = clients[0]!;
  const p = clients[2]!;
  const r = clients[1]!;
  const rows: [string, string, string, MockClient | null, Record<string, unknown> | null][] = [
    [ts(TODAY, '09:05'), 'Kovács Bence', 'kyc.viewed', p, null],
    [ts(TODAY, '09:02'), 'Szabó Kata', 'request.created', k, { type: 'jovedelemigazolas' }],
    [ts(TODAY, '08:47'), 'Kovács Bence', 'message.sent', k, null],
    [ts(TODAY, '08:31'), 'Kovács Bence', 'auth.login', null, { clientKind: 'panel' }],
    [ts(TODAY, '05:30'), 'Rendszer', 'nav.sync', k, { invoicesNew: 1 }],
    [ts('2026-11-16', '21:10'), 'Németh Péter', 'client.profile_updated', p, { step: 'meghatalmazas' }],
    [ts('2026-11-16', '20:31'), 'Szabó Kata', 'document.uploaded', k, { category: 'nav_level' }],
    [ts('2026-11-16', '19:45'), 'Varga Réka', 'request.created', r, { type: 'adatvaltozas' }],
    [ts('2026-11-14', '08:02'), 'Szabó Kata', 'document.uploaded', k, { category: 'bankszamlakivonat' }],
    [ts('2026-11-12', '10:05'), 'Kovács Bence', 'kyc.reviewed', p, { status: 'elfogadva' }],
    [ts('2026-11-12', '09:41'), 'Kovács Bence', 'document.status_changed', k, { to: 'konyvelo_latta' }],
    [ts('2026-11-10', '19:27'), 'SimplePay', 'payment.ipn', p, { status: 'FINISHED' }],
    [ts('2026-11-10', '19:24'), 'Németh Péter', 'consent.accepted', p, { docType: 'megbizasi_szerzodes' }],
    [ts('2026-10-10', '19:20'), 'Varga Réka', 'tax.payment_marked', r, { periodKey: '2026-Q3' }],
    [ts('2026-10-02', '16:40'), 'Kovács Bence', 'tax.approved', k, { periodKey: '2026-Q3', totalHuf: 510471 }],
    [ts('2026-10-02', '15:00'), 'Kovács Bence', 'tax.filed', k, { periodKey: '2026-Q3', form: '2658' }],
  ];
  return rows.map(([at, name, action, c, details], i) => ({
    id: String(500 - i),
    at,
    actor: { id: null, name, role: name === 'Kovács Bence' ? 'accountant' : name === 'Rendszer' || name === 'SimplePay' ? 'system' : 'client' },
    action,
    targetType: null,
    targetId: null,
    client: c ? { id: c.id, name: `${c.lastName} ${c.firstName}` } : null,
    details,
  }));
}

export const FAQ: FaqItem[] = [
  { id: 'q1', question: 'Mennyibe kerül?', answer: 'Havi 19 999 Ft bruttó. Ebben benne van a könyvelőd munkája, a negyedéves bevallás és az app.', sort: 10, published: true },
  { id: 'q2', question: 'Ki a könyvelőm?', answer: 'Egy név szerinti mérlegképes könyvelő. Az appban látod a nevét, és közvetlenül neki írsz.', sort: 20, published: true },
  { id: 'q3', question: 'Nekem kell beadnom a bevallást?', answer: 'Nem. A könyvelőd a meghatalmazottad a NAV-nál, ő adja be. Te csak befizeted, amit az appban látsz.', sort: 30, published: true },
  { id: 'q4', question: 'Mikor kell fizetnem?', answer: 'Negyedévente, a negyedév utáni hónap 12-éig. Előtte szólunk, és megmutatjuk a számlaszámokat.', sort: 40, published: true },
  { id: 'q5', question: 'Mit kell feltöltenem?', answer: 'A kiállított számláidat a NAV rendszeréből mi töltjük le, neked csak a nyugtákat, a pénztárgép-összesítőt és a havi kivonatot kell feltöltened.', sort: 50, published: true },
  { id: 'q6', question: 'Hogyan mondhatom le?', answer: 'A Fiók menüben, egy gombbal. A fizetett hónap végéig minden megy tovább.', sort: 60, published: true },
  { id: 'q7', question: 'Biztonságban vannak az adataim?', answer: 'Minden fájlt titkosítva tárolunk, és csak a könyvelőd látja. Minden megnyitást naplózunk.', sort: 70, published: true },
  { id: 'q8', question: 'Mi az a költséghányad?', answer: 'Az átalányadóban nem kell számlákkal igazolnod a költséget: a bevételed egy részét (2026-ban legtöbbször 45%-át) költségnek veszi a törvény.', sort: 80, published: false },
];

export const CONTENT: ContentText[] = [
  ['notif.tax_approved.title', 'notif', 'Jóváhagyott fizetendő – értesítés címe', 'Megvan a {periodLabel}i összeg: {amount}', ['periodLabel', 'amount']],
  ['notif.tax_approved.body', 'notif', 'Jóváhagyott fizetendő – értesítés szövege', '{firstName} kiszámolta. {dueDate}-ig utald el, a számlaszámokat az appban látod.', ['firstName', 'dueDate']],
  ['notif.tax_due_soon.title', 'notif', 'Közeledő határidő', 'Még {days} nap: {dueDate}-ig utald el', ['days', 'dueDate']],
  ['notif.request_new.title', 'notif', 'Új kérés a könyvelőtől', '{firstName} kéri: {title}', ['firstName', 'title']],
  ['notif.tax_filed.title', 'notif', 'Bevallás beadva', '{firstName} beadta a {periodLabel}es bevallást', ['firstName', 'periodLabel']],
  ['notif.message_new.title', 'notif', 'Új üzenet', 'Új üzenet {firstNameFrom}', ['firstNameFrom']],
  ['email.password_reset.subject', 'email', 'Jelszó-visszaállítás – tárgy', 'A kódod: {code}', ['code']],
  ['email.password_reset.body', 'email', 'Jelszó-visszaállítás – szöveg', 'Szia!\n\nEzzel a kóddal állíthatsz be új jelszót: {code}\n15 percig érvényes. Ha nem te kérted, nem kell tenned semmit.', ['code']],
  ['email.tax_approved.subject', 'email', 'Jóváhagyott fizetendő – tárgy', 'Megvan a {periodLabel}i összeg', ['periodLabel']],
  ['ui.tax.letter_default', 'ui', 'A levél alapszövege a jóváhagyáskor', 'Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg.', []],
  ['ui.home.estimate_note', 'ui', 'Becslés alatt a főoldalon', 'Eddig ennyi gyűlt össze – {firstName} a negyedév végén véglegesíti.', ['firstName']],
  // SPEC §27.9.2 content keys (shown in their own groups)
  ['notif.assist_mh_filed.title', 'notif', 'Intézzük helyetted: beküldtük a meghatalmazást – cím', 'Hagyd jóvá a meghatalmazást {hatarido}', ['hatarido']],
  ['notif.client_path_changed.title', 'notif', 'Csapatnak: az ügyfél módosította a válaszát – cím', '{clientName} módosította a válaszát', ['clientName']],
  ['helyettunk.neverCredentials', 'helyettunk', 'A soha-belépés mondat (megerősítő lap, útmutató, GYIK)', 'Soha nem kérjük el az Ügyfélkapu+- vagy DÁP-belépésedet, a jelszavadat vagy a kódjaidat, és nem lépünk be helyetted. {firstName} a saját belépésével, meghatalmazottként jár el. Amit kell, te hagyod jóvá a NAV oldalán.', ['firstName']],
  ['helyettunk.mhCardTitle', 'helyettunk', 'Meghatalmazás lépés: kiemelt kártya címe', 'Megcsináljuk helyetted a meghatalmazást', []],
  ['szamlak.short', 'szamlak', 'Kiállított számlák: a rövid mondat', 'A kiállított számláid maguktól megjelennek itt – nem kell feltöltened őket.', []],
  ['szamlak.miEz', 'szamlak', 'Kiállított számlák: „Mi ez?”', 'Minden számla, amit a számlázóprogramodban kiállítasz, automatikusan bekerül a NAV rendszerébe. Mi onnan töltjük le. Ami nincs benne: a számla nélküli eladás (pl. nyugta) – azt külön jelezd.', []],
  ['bekotes.ut.valtas.sheetTitle', 'bekotes', 'Útvonal módosítása: a lap címe', 'Módosítod a válaszodat?', []],
  ['bekotes.varakozas.eszkalacio', 'bekotes', 'Várakozás: mikor kérjen visszahívást', 'Ha {date} nem történik semmi, kérj visszahívást.', ['date']],
].map(([key, group, description, body, placeholders]) => ({
  key: key as string,
  group: group as string,
  description: description as string,
  body: body as string,
  defaultBody: body as string,
  placeholders: placeholders as string[],
  updatedAt: key === 'notif.tax_due_soon.title' ? ts('2026-11-02', '11:00') : null,
  updatedBy: key === 'notif.tax_due_soon.title' ? 'Demo Tulajdonos' : null,
  version: 1,
}));

export const OUTBOX: DemoMail[] = [
  { id: 'o1', toDisplay: 'ka…@demo.kezjegy.test', subject: 'Megvan a III. negyedévi összeg', bodyText: 'Szia Kata!\n\nBence kiszámolta: 510 471 Ft. Október 12-ig utald el.\n\n(DEMO – nem küldtük el)', createdAt: ts('2026-10-02', '16:41') },
  { id: 'o2', toDisplay: 'pe…@demo.kezjegy.test', subject: 'A megerősítő kódod: 482913', bodyText: 'Szia Péter!\n\nA kódod: 482913\n15 percig érvényes.\n\n(DEMO – nem küldtük el)', createdAt: ts('2026-11-10', '18:56') },
  { id: 'o3', toDisplay: 'li…@demo.kezjegy.test', subject: 'A megerősítő kódod: 730155', bodyText: 'Szia Lili!\n\nA kódod: 730155\n\n(DEMO – nem küldtük el)', createdAt: ts('2026-11-15', '20:01') },
  { id: 'o4', toDisplay: 'ga…@demo.kezjegy.test', subject: 'Nem sikerült levonni a havidíjat', bodyText: 'Szia Gábor!\n\nA kártyádról nem sikerült levonni a 19 999 Ft-os havidíjat. Nézd meg a kártyád, holnap újra megpróbáljuk.\n\n(DEMO – nem küldtük el)', createdAt: ts('2026-11-14', '06:02') },
];

export function referralCodes(clients: MockClient[]): ReferralCodeRow[] {
  return [
    { id: 'rc0', code: 'OSZ2026', ownerClient: null, campaign: 'őszi hirdetés', note: 'Facebook + Instagram, október–november', active: true, signups: 3, paying: 2, createdAt: ts('2026-09-28', '10:00') },
    ...clients
      .filter((c) => c.lifecycle !== 'bekotes_alatt' || c.key === 'peter')
      .map((c, i) => ({ id: `rc${i + 1}`, code: c.personalCode, ownerClient: { id: c.id, name: `${c.lastName} ${c.firstName}` }, campaign: null, note: null, active: true, signups: c.key === 'kata' ? 1 : 0, paying: c.key === 'kata' ? 1 : 0, createdAt: c.createdAt })),
  ];
}

export function flagsOf(c: MockClient, reqs: RequestSummary[]): ClientFlag[] {
  const f: ClientFlag[] = [];
  if (c.lifecycle === 'bekotes_alatt') f.push('bekotes_alatt');
  const overdue = reqs.some((r) => r.direction === 'konyvelotol' && (r.status === 'nyitott' || r.status === 'folyamatban') && r.dueDate && r.dueDate < TODAY);
  if (overdue || c.steps.some((s) => s.status === 'hianyos') || c.nav.status === 'hibas') f.push('hianyzik_valami');
  if (c.afaUsed / 20_000_000 >= 0.8 || c.afaProjected >= 20_000_000) f.push('hatar_kozel');
  if (c.sub && (c.sub.status === 'past_due' || c.sub.status === 'suspended')) f.push('dij_elmaradt');
  if (!f.length && c.lifecycle === 'aktiv') f.push('rendben');
  return f;
}
