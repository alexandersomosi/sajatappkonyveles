// Thin fallback of @kezjegy/ado-motor (SPEC §3.2: "if ado-motor is not ready, write a thin
// adapter that matches §7.5 exactly"). Same contract, same 2026 rules (§7.1), same algorithm
// (§7.2) as the reference script kod/shared/demo/_gen_fixtures.py. src/tax/engine.ts decides
// which implementation is used; when the real package is wired, this file is only a fallback.

export type CostRatio = 45 | 80 | 90;
export type TaxStatus = 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas';
export interface RevenueItemInput {
  receivedOn: string;
  deliveryDate: string;
  amountHuf: number;
  countsForAtalany: boolean;
  countsForAfaLimit: boolean;
  estimated?: boolean;
}
export interface TaxProfileInput {
  year: number;
  costRatio: CostRatio;
  status: TaxStatus;
  guaranteedMinimum: boolean;
  atalanyFrom?: string;
  retail?: boolean;
  insuranceBreaks?: { from: string; to: string; kind: 'szunetel' | 'kieso' }[];
  hipa?: { method: 'savos' | 'altalanos' | 'nincs'; ratePct: number };
  priorOverrides?: { throughQuarter: 1 | 2 | 3; priorActualBaseSum: number; priorSzjaAdvanceSum: number };
}
export interface YearInput {
  profile: TaxProfileInput;
  revenue: RevenueItemInput[];
  asOf: string;
}
export interface MonthLine {
  month: number;
  revenueHuf: number;
  incomeHuf: number;
  insured: boolean;
  minimumHuf: number | null;
  baseHuf: number;
  tbHuf: number;
  szochoHuf: number;
}
export interface PaymentLine {
  kind: 'tb_jarulek' | 'szocho' | 'szja_eloleg';
  label: string;
  sublabel?: string;
  amountHuf: number;
  accountName: string;
  accountNumber: string;
  iban: string;
}
export interface QuarterResult {
  quarter: 1 | 2 | 3 | 4;
  periodKey: string;
  dueDate: string;
  complete: boolean;
  revenueHuf: number;
  incomeHuf: number;
  incomeYtdHuf: number;
  taxableYtdHuf: number;
  cumulativeBasePerMonthHuf: number;
  months: MonthLine[];
  tbHuf: number;
  szochoHuf: number;
  szjaAdvanceHuf: number;
  totalHuf: number;
  payments: PaymentLine[];
  explanation: { intro: string; lines: { label: string; amountHuf?: number; op?: '+' | '−' | '='; note?: string }[]; result: string };
  warnings: { code: string; text: string }[];
}
export interface Meter {
  usedHuf: number;
  limitHuf: number;
  projectedHuf: number;
  ratio: number;
  warning: boolean;
  sentence: string;
}
export interface YearResult {
  engineVersion: string;
  rulesVersion: string;
  asOf: string;
  quarters: QuarterResult[];
  meters: {
    afa: Meter;
    atalanyCap: Meter;
    adomentes: { limitHuf: number; usedIncomeHuf: number; reached: boolean; reachedMonth: number | null; sentence: string };
  };
  hipa: { method: string; baseHuf: number | null; annualHuf: number | null; advances: { dueDate: string; amountHuf: number }[]; note: string } | null;
  revenueByMonth: { month: number; amountHuf: number }[];
  warnings: { code: string; text: string }[];
  disclaimer: string;
}

export interface TaxRules {
  year: number;
  validFrom: string;
  draft?: boolean;
  minimumWageHuf: number;
  guaranteedMinimumHuf: number;
  taxFreeAnnualHuf: number;
  szjaPerMille: number;
  tbPerMille: number;
  szochoPerMille: number;
  afaLimitHuf: number;
  atalanyCapHuf: number;
  atalanyCapRetailHuf: number;
  hipaBands: { upToHuf: number; baseHuf: number }[];
  accounts: Record<'szja_eloleg' | 'tb_jarulek' | 'szocho', { name: string; number: string }>;
  sources: string[];
}

export const ENGINE_VERSION = 'backend-fallback-2026.1';

export const RULES_2026: TaxRules = {
  year: 2026,
  validFrom: '2026-01-01',
  minimumWageHuf: 322_800,
  guaranteedMinimumHuf: 373_200,
  taxFreeAnnualHuf: 1_936_800,
  szjaPerMille: 150,
  tbPerMille: 185,
  szochoPerMille: 130,
  afaLimitHuf: 20_000_000,
  atalanyCapHuf: 38_736_000,
  atalanyCapRetailHuf: 193_680_000,
  hipaBands: [
    { upToHuf: 12_000_000, baseHuf: 2_500_000 },
    { upToHuf: 18_000_000, baseHuf: 6_000_000 },
    { upToHuf: 25_000_000, baseHuf: 8_500_000 },
  ],
  accounts: {
    szja_eloleg: { name: 'NAV Személyi jövedelemadó beszedési számla', number: '10032000-06056353' },
    tb_jarulek: { name: 'NAV Társadalombiztosítási járulék beszedési számla', number: '10032000-06055802' },
    szocho: { name: 'NAV Szociális hozzájárulási adó beszedési számla', number: '10032000-06055912' },
  },
  sources: [
    'NAV 100. sz. információs füzet (2026.02.20)',
    'NAV 3. sz. információs füzet (2026.08.31)',
    '426/2025. (XII. 23.) Korm. rendelet',
  ],
};

export const DISCLAIMER = 'Becslés. A végleges összeget a könyvelőd hagyja jóvá.';

// Hungarian public holidays and moved rest days 2026–2027 (Mt. 102. §; NGM rendelet a 2026. évi
// munkaszüneti napok körüli munkarendről). Only weekdays matter for the next-working-day rule.
const HOLIDAYS = new Set([
  '2026-01-01', '2026-01-02', '2026-03-15', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-25',
  '2026-08-20', '2026-08-21', '2026-10-23', '2026-11-01', '2026-12-24', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-03-15', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-17', '2027-08-20',
  '2027-10-23', '2027-11-01', '2027-12-24', '2027-12-25', '2027-12-26',
]);
const EXTRA_WORKDAYS = new Set(['2026-01-10', '2026-08-08']);

function utc(d: string): Date {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, dd));
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function plusDays(d: string, n: number): string {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
}
function isWorkday(d: string): boolean {
  if (EXTRA_WORKDAYS.has(d)) return true;
  const wd = utc(d).getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(d);
}
export function nextWorkingDay(d: string): string {
  let x = d;
  while (!isWorkday(x)) x = plusDays(x, 1);
  return x;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function daysInYear(y: number): number {
  return (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86_400_000;
}
function dayOfYear(d: string): number {
  const x = utc(d);
  return Math.round((x.getTime() - Date.UTC(x.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
}

/** Integer half-up rounding of num/den (den > 0), away from zero on .5 like Decimal ROUND_HALF_UP. */
function divRound(num: number, den: number): number {
  const sign = num < 0 ? -1 : 1;
  const a = Math.abs(num);
  const q = Math.floor(a / den);
  const r = a - q * den;
  return sign * (r * 2 >= den ? q + 1 : q);
}
function roundHalfUp(x: number): number {
  const s = x < 0 ? -1 : 1;
  return s * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}

const fmt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 });
export function ft(n: number): string {
  return `${fmt.format(n)} Ft`;
}

/** Hungarian IBAN of a domestic account (16 or 24 digits), ISO 13616 mod-97 check digits. */
export function ibanHu(account: string): string {
  let digits = account.replace(/\D/g, '');
  if (digits.length === 16) digits += '00000000';
  const rearranged = `${digits}1730` + '00'; // "HU" = 17 30
  let rem = 0;
  for (const ch of rearranged) rem = (rem * 10 + Number(ch)) % 97;
  const check = pad(98 - rem);
  return `HU${check}${digits}`;
}

export function costRatioForActivity(answer: 'kiskereskedelem' | 'lista80' | 'egyeb'): CostRatio {
  return answer === 'kiskereskedelem' ? 90 : answer === 'lista80' ? 80 : 45;
}

export function quarterDueDate(year: number, q: number): string {
  return q === 4 ? nextWorkingDay(`${year + 1}-01-12`) : nextWorkingDay(`${year}-${pad(q * 3 + 1)}-12`);
}

export function deadlinesFor(year: number): { kind: 'befizetes' | 'bevallas'; title: string; dueDate: string; periodKey?: string }[] {
  const out: { kind: 'befizetes' | 'bevallas'; title: string; dueDate: string; periodKey?: string }[] = [];
  const roman = ['I', 'II', 'III', 'IV'];
  for (let q = 1; q <= 4; q++) {
    const due = quarterDueDate(year, q);
    const key = `${year}-Q${q}`;
    out.push({ kind: 'befizetes', title: `${roman[q - 1]}. negyedévi TB-járulék, szocho és SZJA-előleg befizetése`, dueDate: due, periodKey: key });
    out.push({ kind: 'bevallas', title: `${roman[q - 1]}. negyedéves bevallás (2658)`, dueDate: due, periodKey: key });
  }
  out.push({ kind: 'bevallas', title: `${year}. évi SZJA-bevallás`, dueDate: nextWorkingDay(`${year + 1}-05-20`) });
  out.push({ kind: 'befizetes', title: `${year}. évi első HIPA-előleg`, dueDate: nextWorkingDay(`${year}-03-15`), periodKey: `${year}-HIPA-1` });
  out.push({ kind: 'befizetes', title: `${year}. évi második HIPA-előleg`, dueDate: nextWorkingDay(`${year}-09-15`), periodKey: `${year}-HIPA-2` });
  out.push({ kind: 'bevallas', title: `${year}. évi HIPA-bevallás`, dueDate: nextWorkingDay(`${year + 1}-05-31`) });
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function monthRangeLabel(q: number): string {
  const n = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const a = n[(q - 1) * 3]!;
  const c = n[(q - 1) * 3 + 2]!;
  return `${a.charAt(0).toUpperCase()}${a.slice(1)}–${c}i`;
}

/** Days of month m (1-12) in year y covered by [from, to] (inclusive). */
function overlapDays(y: number, m: number, from: string, to: string): number {
  const ms = `${y}-${pad(m)}-01`;
  const me = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
  const s = from > ms ? from : ms;
  const e = to < me ? to : me;
  if (s > e) return 0;
  return Math.round((utc(e).getTime() - utc(s).getTime()) / 86_400_000) + 1;
}

export function calculateYear(input: YearInput): YearResult {
  const { profile, asOf } = input;
  const R = RULES_2026;
  const y = profile.year;
  const ratio = profile.costRatio;
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const cutoff = asOf < yearEnd ? asOf : yearEnd;
  const warnings: { code: string; text: string }[] = [];

  // 1. revenue and income per month (by received date, up to asOf)
  const rev = Array<number>(13).fill(0);
  let estimatedSeen = false;
  for (const it of input.revenue) {
    if (!it.countsForAtalany) continue;
    if (it.receivedOn < yearStart || it.receivedOn > cutoff) continue;
    rev[Number(it.receivedOn.slice(5, 7))]! += it.amountHuf;
    if (it.estimated) estimatedSeen = true;
  }
  const inc = rev.map((r) => divRound(r * (100 - ratio), 100));

  // insured days
  const start = profile.atalanyFrom && profile.atalanyFrom > yearStart ? profile.atalanyFrom : yearStart;
  const breaks = profile.insuranceBreaks ?? [];
  function monthInfo(m: number): { insured: boolean; nonInsuredDays: number; dim: number } {
    const dim = daysInMonth(y, m);
    const ms = `${y}-${pad(m)}-01`;
    const me = `${y}-${pad(m)}-${pad(dim)}`;
    let before = 0;
    if (start > me) before = dim;
    else if (start > ms) before = overlapDays(y, m, ms, plusDays(start, -1));
    let szun = 0;
    let kieso = 0;
    for (const b of breaks) {
      const d = overlapDays(y, m, b.from, b.to);
      if (b.kind === 'szunetel') szun += d;
      else kieso += d;
    }
    const notInsured = Math.min(dim, before + szun);
    const insured = notInsured < dim;
    return { insured, nonInsuredDays: Math.min(dim, before + szun + kieso), dim };
  }

  const fullMin = profile.guaranteedMinimum ? R.guaranteedMinimumHuf : R.minimumWageHuf;
  const quarters: QuarterResult[] = [];
  let priorBaseSum = 0;
  let szjaPaidSum = 0;
  const po = profile.priorOverrides;

  for (let q = 1 as 1 | 2 | 3 | 4; q <= 4; q = (q + 1) as 1 | 2 | 3 | 4) {
    const months = [q * 3 - 2, q * 3 - 1, q * 3];
    const lastMonth = months[2]!;
    let incomeYtd = 0;
    for (let m = 1; m <= lastMonth; m++) incomeYtd += inc[m]!;
    const taxableYtd = Math.max(0, incomeYtd - R.taxFreeAnnualHuf);

    if (po && q === po.throughQuarter + 1) {
      priorBaseSum = po.priorActualBaseSum;
      szjaPaidSum = po.priorSzjaAdvanceSum;
    }

    const infos = months.map((m) => ({ m, ...monthInfo(m) }));
    const insuredCount = infos.filter((i) => i.insured).length;
    const g = insuredCount === 0 ? 0 : Math.max(0, taxableYtd - priorBaseSum) / insuredCount;
    const lines: MonthLine[] = [];
    let tb = 0;
    let sz = 0;
    let baseSum = 0;
    for (const i of infos) {
      let base = 0;
      let minimum: number | null = null;
      if (i.insured && profile.status !== 'nyugdijas') {
        if (profile.status === 'fofoglalkozasu') {
          minimum = i.nonInsuredDays > 0 ? Math.min(fullMin, (fullMin / 30) * (i.dim - i.nonInsuredDays)) : fullMin;
          minimum = Math.max(0, roundHalfUp(minimum));
          base = roundHalfUp(Math.max(g, minimum));
        } else {
          base = roundHalfUp(g);
        }
      }
      const t = divRound(base * R.tbPerMille, 1000);
      const s = divRound(base * R.szochoPerMille, 1000);
      tb += t;
      sz += s;
      baseSum += base;
      lines.push({ month: i.m, revenueHuf: rev[i.m]!, incomeHuf: inc[i.m]!, insured: i.insured, minimumHuf: minimum, baseHuf: base, tbHuf: t, szochoHuf: s });
    }
    priorBaseSum += baseSum;

    const szjaCum = divRound(taxableYtd * R.szjaPerMille, 1000);
    let szja = szjaCum - szjaPaidSum;
    const qWarnings: { code: string; text: string }[] = [];
    if (szja < 0) {
      qWarnings.push({ code: 'szja_tulfizetes', text: 'Az eddig befizetett SZJA-előleg több, mint ami az év eleje óta jár. Most nem kell előleget fizetni.' });
      szja = 0;
    }
    szjaPaidSum += szja;

    const qRevenue = months.reduce((a, m) => a + rev[m]!, 0);
    const qIncome = months.reduce((a, m) => a + inc[m]!, 0);
    const quarterEnd = `${y}-${pad(lastMonth)}-${pad(daysInMonth(y, lastMonth))}`;
    const payments: PaymentLine[] = [];
    const acc = R.accounts;
    if (tb > 0) payments.push({ kind: 'tb_jarulek', label: 'TB-járulék', amountHuf: tb, accountName: acc.tb_jarulek.name, accountNumber: acc.tb_jarulek.number, iban: ibanHu(acc.tb_jarulek.number) });
    if (sz > 0) payments.push({ kind: 'szocho', label: 'Szocho', sublabel: 'szociális hozzájárulási adó', amountHuf: sz, accountName: acc.szocho.name, accountNumber: acc.szocho.number, iban: ibanHu(acc.szocho.number) });
    if (szja > 0) payments.push({ kind: 'szja_eloleg', label: 'SZJA-előleg', amountHuf: szja, accountName: acc.szja_eloleg.name, accountNumber: acc.szja_eloleg.number, iban: ibanHu(acc.szja_eloleg.number) });

    const insuredMonthsAtMin = lines.filter((l) => l.insured && l.minimumHuf !== null && l.baseHuf === l.minimumHuf && l.minimumHuf > 0);
    let tbNote: string;
    if (profile.status === 'nyugdijas') tbNote = 'Nyugdíjasként nem fizetsz TB-járulékot és szochót.';
    else if (profile.status === 'mellekallasu')
      tbNote = `Mellékállásban nincs minimum: a jövedelmed adóköteles része után fizetsz. Az alap havonta ${ft(lines.find((l) => l.insured)?.baseHuf ?? 0)}, ennek 18,5%-a.`;
    else if (insuredMonthsAtMin.length === lines.filter((l) => l.insured).length && insuredMonthsAtMin.length > 0)
      tbNote = `Havonta legalább a ${profile.guaranteedMinimum ? 'garantált bérminimum' : 'minimálbér'} (${ft(fullMin)}) után fizetsz. A jövedelmed ennél kevesebb volt, ezért ${insuredMonthsAtMin.length} × ${ft(fullMin)} ennek 18,5%-a.`;
    else tbNote = `Az alap havonta ${lines.filter((l) => l.insured).map((l) => ft(l.baseHuf)).join(', ')}; ennek 18,5%-a.`;

    const explanation: QuarterResult['explanation'] = {
      intro: `A TB-járulékot, a szochót és az SZJA-előleget negyedévente fizeted, a negyedév utáni hónap 12-éig. Mindhárom az idei jövedelmedből jön.`,
      lines: [
        { label: `${monthRangeLabel(q)} bevételed`, amountHuf: qRevenue },
        { label: `Költséghányad, ${ratio}%`, amountHuf: qRevenue - qIncome, op: '−' },
        { label: 'Jövedelmed a negyedévben', amountHuf: qIncome, op: '=' },
        {
          label: 'Év eleje óta ennyi a jövedelmed',
          amountHuf: incomeYtd,
          note: `Ebből ${ft(Math.min(incomeYtd, R.taxFreeAnnualHuf))} adómentes.`,
        },
        { label: 'TB-járulék', amountHuf: tb, note: tbNote },
        { label: 'Szocho (szociális hozzájárulási adó)', amountHuf: sz, note: profile.status === 'nyugdijas' ? 'Nyugdíjasként nem kell fizetned.' : 'Ugyanennek 13%-a.' },
        {
          label: 'SZJA-előleg',
          amountHuf: szja,
          note:
            taxableYtd === 0
              ? `Amíg a jövedelmed az év elejétől nem éri el a ${ft(R.taxFreeAnnualHuf)}-ot, nem fizetsz SZJA-t.`
              : `Az adóköteles rész év eleje óta ${ft(taxableYtd)}, ennek 15%-a ${ft(szjaCum)}. Ebből ${ft(szjaCum - szja)}-ot már befizettél, most: ${ft(szja)}.`,
        },
      ],
      result: `Összesen: ${ft(tb + sz + szja)}`,
    };

    quarters.push({
      quarter: q,
      periodKey: `${y}-Q${q}`,
      dueDate: quarterDueDate(y, q),
      complete: quarterEnd < asOf,
      revenueHuf: qRevenue,
      incomeHuf: qIncome,
      incomeYtdHuf: incomeYtd,
      taxableYtdHuf: taxableYtd,
      cumulativeBasePerMonthHuf: roundHalfUp(g),
      months: lines,
      tbHuf: tb,
      szochoHuf: sz,
      szjaAdvanceHuf: szja,
      totalHuf: tb + sz + szja,
      payments,
      explanation,
      warnings: qWarnings,
    });
  }

  // meters
  const doy = Math.max(1, Math.min(dayOfYear(cutoff), daysInYear(y)));
  const diy = daysInYear(y);
  let afaUsed = 0;
  for (const it of input.revenue) {
    if (!it.countsForAfaLimit) continue;
    if (it.deliveryDate < yearStart || it.deliveryDate > cutoff) continue;
    afaUsed += it.amountHuf;
  }
  const afaProjected = Math.round((afaUsed / doy) * diy);
  const afaRatio = afaUsed / R.afaLimitHuf;
  const afaWarn = afaRatio >= 0.8 || afaProjected >= R.afaLimitHuf;
  const pct = (r: number) => `${Math.round(r * 1000) / 10}`.replace('.', ',');
  const afa: Meter = {
    usedHuf: afaUsed,
    limitHuf: R.afaLimitHuf,
    projectedHuf: afaProjected,
    ratio: afaRatio,
    warning: afaWarn,
    sentence: afaWarn
      ? `Az alanyi ÁFA-keret ${pct(afaRatio)}%-át már elérted (${ft(afaUsed)} a ${ft(R.afaLimitHuf)}-ból). A könyvelőd figyeli, és szól, mielőtt gond lenne.`
      : `Az alanyi ÁFA-keretből eddig ${ft(afaUsed)}-ot használtál (${pct(afaRatio)}%). Ha így folytatod, év végére kb. ${ft(afaProjected)} lesz.`,
  };
  if (afaRatio >= 0.8) warnings.push({ code: 'afa_80', text: 'Elérted az alanyi ÁFA-keret 80%-át.' });
  if (afaProjected >= R.afaLimitHuf) warnings.push({ code: 'afa_projected_over', text: 'Ha így folytatod, év végére túllépheted az alanyi ÁFA-keretet.' });

  let capLimit = profile.retail ? R.atalanyCapRetailHuf : R.atalanyCapHuf;
  if (start > yearStart) capLimit = Math.round((capLimit * (daysInYear(y) - dayOfYear(start) + 1)) / daysInYear(y));
  const revYtd = rev.reduce((a, b) => a + b, 0);
  const capProjected = Math.round((revYtd / doy) * diy);
  const capRatio = revYtd / capLimit;
  const capWarn = capRatio >= 0.8;
  if (capWarn) warnings.push({ code: 'atalany_cap_80', text: 'Elérted az átalányadózás bevételi határának 80%-át.' });
  const atalanyCap: Meter = {
    usedHuf: revYtd,
    limitHuf: capLimit,
    projectedHuf: capProjected,
    ratio: capRatio,
    warning: capWarn,
    sentence: `Az átalányadózás évi bevételi határa ${ft(capLimit)}; eddig ${ft(revYtd)} (${pct(capRatio)}%).`,
  };

  let cum = 0;
  let reachedMonth: number | null = null;
  for (let m = 1; m <= 12; m++) {
    cum += inc[m]!;
    if (reachedMonth === null && cum >= R.taxFreeAnnualHuf) reachedMonth = m;
  }
  const incomeAll = cum;
  const monthsHu = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const adomentes = {
    limitHuf: R.taxFreeAnnualHuf,
    usedIncomeHuf: Math.min(incomeAll, R.taxFreeAnnualHuf),
    reached: reachedMonth !== null,
    reachedMonth,
    sentence:
      reachedMonth !== null
        ? `Az adómentes részt (${ft(R.taxFreeAnnualHuf)} jövedelem) ${monthsHu[reachedMonth - 1]} végére elérted. Azóta a jövedelmed után SZJA-t is fizetsz.`
        : `Még ${ft(R.taxFreeAnnualHuf - incomeAll)} jövedelemig nem fizetsz SZJA-t.`,
  };

  // HIPA
  let hipa: YearResult['hipa'] = null;
  const hm = profile.hipa?.method ?? 'savos';
  const hipaDue = deadlinesFor(y).filter((d) => d.periodKey?.startsWith(`${y}-HIPA`));
  if (hm === 'altalanos') {
    warnings.push({ code: 'hipa_altalanos_not_modelled', text: 'Az általános HIPA-alapot nem számoljuk: ezt a könyvelőd intézi.' });
    hipa = { method: hm, baseHuf: null, annualHuf: null, advances: [], note: 'Általános módszer: a könyvelőd számolja ki.' };
  } else if (hm === 'savos') {
    const band = R.hipaBands.find((b) => capProjected < b.upToHuf);
    const rate = profile.hipa?.ratePct ?? 2;
    if (!band) {
      hipa = { method: hm, baseHuf: null, annualHuf: null, advances: [], note: 'A várható bevétel 25 millió Ft fölött van: a sávos adóalap nem használható, a könyvelőd dönt.' };
    } else {
      const annual = roundHalfUp((band.baseHuf * rate) / 100);
      const half = Math.floor(annual / 2);
      hipa = {
        method: hm,
        baseHuf: band.baseHuf,
        annualHuf: annual,
        advances: hipaDue.map((d, i) => ({ dueDate: d.dueDate, amountHuf: i === 0 ? half : annual - half })),
        note: `Becslés a sávos egyszerűsített adóalappal (${ft(band.baseHuf)} × ${String(rate).replace('.', ',')}%). Az előleg a székhelyed önkormányzatánál fizetendő; a pontos összeget a könyvelőd mondja meg.`,
      };
    }
  }

  if (profile.status === 'mellekallasu')
    warnings.push({ code: 'mellekallas_condition', text: 'Mellékállás csak heti legalább 36 órás munkaviszony vagy nappali tagozatos tanulmány mellett jár. Szólj, ha ez változik.' });
  if (profile.status === 'fofoglalkozasu')
    warnings.push({ code: 'garantalt_minimum_check', text: profile.guaranteedMinimum ? 'Garantált bérminimummal számolunk (legalább középfokú végzettséget igénylő főtevékenység).' : 'Minimálbérrel számolunk. Ha a főtevékenységed legalább középfokú végzettséget igényel, a garantált bérminimum jár.' });
  if (estimatedSeen) warnings.push({ code: 'received_on_estimated', text: 'Néhány bevétel napját a számla fizetési határidejéből becsültük. A bankszámlakivonat alapján pontosítjuk.' });
  if ((profile.costRatio as number) === 40) warnings.push({ code: 'cost_ratio_2026_changed', text: '2026-tól az általános költséghányad 45%.' });

  return {
    engineVersion: ENGINE_VERSION,
    rulesVersion: R.validFrom,
    asOf,
    quarters,
    meters: { afa, atalanyCap, adomentes },
    hipa,
    revenueByMonth: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amountHuf: rev[i + 1]! })),
    warnings,
    disclaimer: DISCLAIMER,
  };
}
