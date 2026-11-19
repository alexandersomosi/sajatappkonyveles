// "Hogyan jött ki?" (design 07, SPEC §7.3): the quarter's calculation written out in plain
// Hungarian, as a written addition: heading → rows with − / = → highlighted tax rows → total.
// The design's 2025 wording ("járulékokat havonta", "40%") is replaced by the 2026 law.

import type { TaxRules } from '../rules/types.js';
import type { AllowanceKind, Explanation, ExplanationLine, MonthLine, TaxStatus } from '../types.js';
import { ALLOWANCE_LINE_LABEL, anyakLabel } from './allowances.js';
import {
  MINUS,
  capitalize,
  formatHuf,
  formatPermilleAsPct,
  joinHu,
  monthInessive,
  monthName,
  monthRange,
  monthRangeAdjective,
} from '../util/format.js';
import { permilleOf, sum } from '../util/math.js';
import type { NotInsuredReason } from './days.js';

export interface ExplanationInput {
  rules: TaxRules;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: TaxStatus;
  guaranteedMinimum: boolean;
  costRatio: number;
  /** First and last month the quarter's revenue covers (a mid-quarter start shortens it). */
  firstMonth: number;
  lastMonth: number;
  /** First active month of the year (for the SZJA "since" side text). */
  yearFirstMonth: number;
  revenueHuf: number;
  incomeHuf: number;
  incomeYtdHuf: number;
  taxableYtdHuf: number;
  priorBaseSumHuf: number;
  priorSzjaHuf: number;
  /** Per-month cumulative base, rounded (0 when nothing is left). */
  gHuf: number;
  insuredMonths: number;
  /** Insured months with some suspended days (they carry the full minimum since 2024). */
  partlySuspendedMonths?: number[];
  months: MonthLine[];
  notInsured: { month: number; reasons: NotInsuredReason[] }[];
  szochoBaseSumHuf: number;
  tbHuf: number;
  szochoHuf: number;
  szjaCumulativeHuf: number;
  szjaAdvanceHuf: number;
  szjaClamped: boolean;
  totalHuf: number;
  complete: boolean;
  coveredByPriorOverride: boolean;
  /** Month (≤ the quarter's last month) in which the cumulative income reached the tax-free part. */
  adomentesReachedMonth: number | null;
  /** SPEC §28.3.7 f: approved allowances (tbHuf above is then the GROSS TB). */
  allowances?: {
    usedYtd: Partial<Record<AllowanceKind, number>>;
    afterAllowancesHuf: number;
    csjkHuf: number;
    csaladiUnusedHuf: number;
    anyakJogcim: 'ket' | 'harom' | 'negyplusz' | null;
    csaladiChildren: number;
  };
}

const ALLOWANCE_ORDER: AllowanceKind[] = ['anya30', 'anyak', 'fiatal25', 'szemelyi', 'elso_hazasok', 'csaladi'];

export function buildExplanation(x: ExplanationInput): Explanation {
  const r = x.rules;
  const lines: ExplanationLine[] = [];
  const due = r.quarterlyDueDay;

  // ---- intro
  let intro = `A bevételed ${x.costRatio}%-át költségnek veszi a NAV, a többi a jövedelmed.`;
  if (x.status === 'nyugdijas') {
    intro += ` Nyugdíjasként csak SZJA-előleget fizetsz, negyedévente, a negyedév utáni hónap ${due}-éig.`;
  } else {
    intro += ` A TB-járulékot, a szochót és az SZJA-előleget negyedévente fizeted, a negyedév utáni hónap ${due}-éig.`;
  }

  // ---- 1. income of the quarter
  lines.push({ kind: 'cim', label: 'Jövedelmed', side: monthRange(x.firstMonth, x.lastMonth) });
  lines.push({ kind: 'sor', label: `${capitalize(monthRangeAdjective(x.firstMonth, x.lastMonth))} bevételed`, amountHuf: x.revenueHuf });
  lines.push({ kind: 'sor', op: MINUS, label: `Költséghányad, ${x.costRatio}%`, amountHuf: x.revenueHuf - x.incomeHuf });
  lines.push({ kind: 'sor', op: '=', label: 'Jövedelmed a negyedévben', amountHuf: x.incomeHuf });

  // ---- 2. TB-járulék + szocho
  lines.push({ kind: 'cim', label: 'TB-járulék és szocho', ...(x.status !== 'nyugdijas' && x.insuredMonths > 0 ? { side: `${x.insuredMonths} hónap` } : {}) });
  if (x.status === 'nyugdijas') {
    lines.push({
      kind: 'ado',
      label: 'Nem kell fizetned',
      amountHuf: 0,
      note: 'Nyugdíjas egyéni vállalkozóként (kiegészítő tevékenység) TB-járulékot és szochót nem fizetsz.',
    });
  } else {
    const baseSum = sum(x.months.map((m) => m.baseHuf));
    lines.push({ kind: 'sor', label: `Járulékalap, ${x.insuredMonths} hónap`, amountHuf: baseSum, note: baseNote(x) });
    const tbExact = permilleOf(baseSum, r.tbPermille) === x.tbHuf;
    lines.push({
      kind: 'ado',
      label: `TB-járulék: ennek ${formatPermilleAsPct(r.tbPermille)}-a`,
      amountHuf: x.tbHuf,
      ...(tbExact ? {} : { note: 'Havonta kerekítve.' }),
    });
    if (x.allowances && x.allowances.csjkHuf > 0) {
      lines.push({ kind: 'ado', op: MINUS, label: 'Családi járulékkedvezmény – ennyivel kevesebb a TB-járulék', amountHuf: x.allowances.csjkHuf });
      lines.push({ kind: 'sor', op: '=', label: 'TB-járulék most', amountHuf: x.tbHuf - x.allowances.csjkHuf });
    }
    if (x.szochoBaseSumHuf !== baseSum) {
      lines.push({ kind: 'sor', label: 'A szocho alapja', amountHuf: x.szochoBaseSumHuf, note: `A szocho minimuma a ${minName(x)} ${r.szochoMinimumPct}%-a.` });
    }
    const szExact = permilleOf(x.szochoBaseSumHuf, r.szochoPermille) === x.szochoHuf;
    lines.push({
      kind: 'ado',
      label: `Szocho: ennek ${formatPermilleAsPct(r.szochoPermille)}-a`,
      amountHuf: x.szochoHuf,
      note: `Szocho = szociális hozzájárulási adó.${szExact ? '' : ' Havonta kerekítve.'}`,
    });
  }

  // ---- 3. SZJA-előleg (cumulative from the start of the year)
  lines.push({ kind: 'cim', label: 'SZJA-előleg', side: monthRange(x.yearFirstMonth, x.lastMonth) });
  lines.push({ kind: 'sor', label: 'Idei jövedelmed eddig', amountHuf: x.incomeYtdHuf });
  const free = r.taxFreeIncomeHuf;
  if (x.taxableYtdHuf === 0) {
    lines.push({
      kind: 'ado',
      label: 'SZJA-előleg',
      amountHuf: x.szjaAdvanceHuf,
      note: `Az idei jövedelmedből az első ${formatHuf(free)} adómentes. Ezt még nem érted el, ezért most nem fizetsz SZJA-előleget.`,
    });
  } else {
    lines.push({
      kind: 'sor',
      op: MINUS,
      label: 'Adómentes rész',
      amountHuf: free,
      ...(x.adomentesReachedMonth ? { note: `${capitalize(monthInessive(x.adomentesReachedMonth))} érted el.` } : {}),
    });
    lines.push({ kind: 'sor', op: '=', label: 'Adóköteles rész', amountHuf: x.taxableYtdHuf });
    const al = x.allowances;
    const used = al ? ALLOWANCE_ORDER.filter((k) => (al.usedYtd[k] ?? 0) > 0) : [];
    if (al && used.length) {
      lines.push({ kind: 'cim', label: 'Kedvezményeid', side: 'jóváhagyott' });
      for (const k of used) {
        const label =
          k === 'anyak'
            ? anyakLabel(al.anyakJogcim)
            : k === 'csaladi' && al.csaladiChildren > 0
              ? `Családi kedvezmény (${al.csaladiChildren} gyermek)`
              : ALLOWANCE_LINE_LABEL[k];
        lines.push({ kind: 'sor', op: MINUS, label: capitalize(label), amountHuf: al.usedYtd[k]! });
      }
      lines.push({ kind: 'sor', op: '=', label: 'Kedvezmények után', amountHuf: al.afterAllowancesHuf });
    }
    lines.push({ kind: 'sor', label: `Ennek ${formatPermilleAsPct(r.szjaPermille)}-a`, amountHuf: x.szjaCumulativeHuf });
    if (x.priorSzjaHuf !== 0) lines.push({ kind: 'sor', op: MINUS, label: 'Az előző negyedévek előlege', amountHuf: x.priorSzjaHuf });
    lines.push({
      kind: 'ado',
      ...(x.priorSzjaHuf !== 0 ? { op: '=' as const } : {}),
      label: 'SZJA-előleg most',
      amountHuf: x.szjaAdvanceHuf,
      ...(x.szjaClamped
        ? { note: 'Az előző negyedévekben a kelleténél több előleg jött ki, ezért most nincs SZJA-előleg. A különbözetet az éves bevallás rendezi.' }
        : {}),
    });
  }

  if (x.allowances && x.allowances.csaladiUnusedHuf > 0)
    lines.push({
      kind: 'megjegyzes',
      label: `Fel nem használt családi kedvezmény eddig: ${formatHuf(x.allowances.csaladiUnusedHuf)}. A fel nem használt családi kedvezményedet az éves bevallásban számolja el a könyvelőd.`,
    });
  if (x.coveredByPriorOverride)
    lines.push({ kind: 'megjegyzes', label: 'Ezt a negyedévet az előző könyvelőd számolta, az ő adatai számítanak. Itt csak tájékoztatásul látod.' });
  if (!x.complete) lines.push({ kind: 'megjegyzes', label: 'A negyedév még tart: ha lesz még bevételed, az összeg nőhet.' });

  return { intro, lines, result: `${x.complete ? 'Összesen' : 'Eddig összesen'}: ${formatHuf(x.totalHuf)}` };
}

function minName(x: ExplanationInput): string {
  return x.guaranteedMinimum ? 'garantált bérminimum' : 'minimálbér';
}

/** "minimálbérnél" / "garantált bérminimumnál" */
function minNameComparative(x: ExplanationInput): string {
  return x.guaranteedMinimum ? 'garantált bérminimumnál' : 'minimálbérnél';
}

function baseNote(x: ExplanationInput): string {
  const parts: string[] = [];
  const insured = x.months.filter((m) => m.insured);
  const fullMin = x.guaranteedMinimum ? x.rules.guaranteedMinimumHuf : x.rules.minimumWageHuf;

  if (x.insuredMonths === 0) {
    parts.push(notInsuredSentence(x) ?? 'Ebben a negyedévben nem volt biztosításod.');
    parts.push('Ezért most nem fizetsz járulékot.');
    return parts.join(' ');
  }

  const rest = x.taxableYtdHuf - x.priorBaseSumHuf;
  const fofo = x.status === 'fofoglalkozasu';
  // "havonta 403 333 Ft" × 3 = 1 209 999 Ft ≠ the 1 210 000 Ft just named: say why, or the sum
  // under it looks wrong. The forint is not lost – the next quarter's göngyölítés counts it.
  const roundedSum = x.gHuf * x.insuredMonths;
  const perMonth = (): string =>
    ` ${x.insuredMonths} hónapra elosztva havonta ${formatHuf(x.gHuf)}` +
    (x.insuredMonths > 1 && roundedSum !== rest ? ` (forintra kerekítve, így ${x.insuredMonths} hónapra ${formatHuf(roundedSum)}).` : '.');
  /** The cumulative base in words. Never "ebből X" with an X larger than the whole. */
  const cumulative = (): string => {
    if (x.taxableYtdHuf === 0) return `Az idei jövedelmed még belefér az adómentes részbe (${formatHuf(x.rules.taxFreeIncomeHuf)}).`;
    let s = `Az adóköteles jövedelmed év eleje óta ${formatHuf(x.taxableYtdHuf)}.`;
    if (x.priorBaseSumHuf <= 0) {
      s += ' Ez jut erre a negyedévre.';
    } else if (rest > 0) {
      s += ` Ebből ${formatHuf(x.priorBaseSumHuf)} után már az előző negyedévekben fizettél járulékot, a maradék ${formatHuf(rest)} jut erre a negyedévre.`;
    } else if (rest === 0) {
      s += ' Az előző negyedévekben már pontosan ennyi után fizettél járulékot, így erre a negyedévre nem jut belőle.';
    } else {
      s += ` Az előző negyedévekben${fofo ? ' a minimum miatt' : ''} már ${formatHuf(x.priorBaseSumHuf)} után fizettél járulékot, ez több ennél, így erre a negyedévre nem jut belőle.`;
    }
    if (rest > 0) s += perMonth();
    return s;
  };

  if (x.status === 'mellekallasu') {
    parts.push('Mellékállásban nincs kötelező minimum, csak a jövedelmed után fizetsz.');
    parts.push(cumulative());
    if (rest <= 0 || x.taxableYtdHuf === 0) parts.push('Ezért most nem fizetsz járulékot.');
  } else {
    const allMin = insured.every((m) => m.minimumApplied);
    const noneMin = insured.every((m) => !m.minimumApplied);
    const allFull = insured.every((m) => m.minimumHuf === fullMin);
    if (allMin) {
      const what = allFull ? `${insured.length} × ${formatHuf(fullMin)}` : 'a minimum';
      parts.push(`Havonta legalább a ${minName(x)} (${formatHuf(fullMin)}) után fizetsz.`);
      if (x.taxableYtdHuf === 0) {
        parts.push(`Az idei jövedelmed még belefér az adómentes részbe (${formatHuf(x.rules.taxFreeIncomeHuf)}), ezért ${what} után számolunk.`);
      } else {
        // The base is not this quarter's income but the cumulative taxable income above the
        // tax-free part, minus what earlier quarters already used – say so, or it looks wrong.
        parts.push('A járulék alapja nem a negyedéves jövedelmed, hanem az adómentes rész feletti, év eleje óta összegyűlt jövedelem.');
        parts.push(cumulative());
        if (rest > 0) parts.push(`Ez kevesebb a ${minNameComparative(x)}, ezért ${what} után számolunk.`);
        else parts.push(allFull ? `Ezért most is a minimum után számolunk: ${what}.` : 'Ezért most is a minimum után számolunk.');
      }
    } else if (noneMin) {
      parts.push(cumulative());
      if (rest > 0) parts.push(`Ez több a ${minNameComparative(x)} (${formatHuf(fullMin)}), ezért ez a járulékalap.`);
      else parts.push('Ezért most nem fizetsz járulékot.');
    } else {
      parts.push(cumulative());
      parts.push(
        rest > 0
          ? `Havonta a nagyobbik számít: a havi ${formatHuf(x.gHuf)} vagy a ${minName(x)} (${formatHuf(fullMin)}).`
          : `Ezért ott, ahol jár minimum, a ${minName(x)} (${formatHuf(fullMin)}) után számolunk.`,
      );
    }
    const reduced = insured.filter((m) => m.minimumHuf !== null && m.minimumHuf !== fullMin);
    for (const m of reduced) {
      parts.push(
        m.minimumDays === 0
          ? `${capitalize(monthName(m.month))} egésze kieső idő volt (például táppénz), ezért arra a hónapra nincs minimum.`
          : `${capitalize(monthInessive(m.month))} csak ${m.minimumDays} napra jár minimum, ezért ott a minimum ${formatHuf(m.minimumHuf ?? 0)}.`,
      );
    }
    const partly = (x.partlySuspendedMonths ?? []).filter((m) => insured.some((i) => i.month === m));
    if (partly.length)
      parts.push(
        `${capitalize(joinHu(partly.map(monthInessive)))} csak a hónap egy részében szünetelt a vállalkozásod. 2024 óta ilyenkor nincs arányosítás: arra a hónapra a teljes minimum jár.`,
      );
  }
  const ni = notInsuredSentence(x);
  if (ni) parts.push(ni);
  return parts.join(' ');
}

function notInsuredSentence(x: ExplanationInput): string | null {
  const szunetel = x.notInsured.filter((n) => n.reasons.includes('szunetel')).map((n) => monthInessive(n.month));
  const kezdes = x.notInsured.filter((n) => !n.reasons.includes('szunetel') && n.reasons.includes('kezdes')).map((n) => monthInessive(n.month));
  const s: string[] = [];
  if (szunetel.length) s.push(`${capitalize(joinHu(szunetel))} szünetelt a vállalkozásod, arra nem fizetsz járulékot.`);
  if (kezdes.length) s.push(`${capitalize(joinHu(kezdes))} még nem működött a vállalkozásod.`);
  return s.length ? s.join(' ') : null;
}
