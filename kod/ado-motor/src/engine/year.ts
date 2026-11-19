// calculateYear – SPEC §7.2. Pure and deterministic: same input → same output, input never mutated.

import { quarterDueDate } from '../calendar.js';
import type { TaxRules } from '../rules/types.js';
import type {
  AllowanceKind,
  AllowanceSummary,
  EngineWarning,
  MonthLine,
  PaymentLine,
  QuarterResult,
  RevenueItemInput,
  YearInput,
  YearResult,
} from '../types.js';
import { dayNumber, daysInclusive, daysInMonth, daysInYear, maxDate, minDate, monthOf, quarterEnd, quarterStart, toIso } from '../util/dates.js';
import { formatHuf, yearAdjective } from '../util/format.js';
import { permilleOf, ratio, ratioCompare, ratioMax, ratioMin, ratioRound, roundDiv, sum, type Ratio } from '../util/math.js';
import { validateYearInput } from '../validate.js';
import { monthBoundPass, planAllowances } from './allowances.js';
import { classifyMonths } from './days.js';
import { buildExplanation } from './explanation.js';
import { hipaEstimate } from './hipa.js';
import { adomentesMeter, afaMeter, atalanyCapMeter, type Projection } from './meters.js';

export const ENGINE_VERSION = '1.2.0';
export const DISCLAIMER = 'Becslés. A végleges összeget a könyvelőd hagyja jóvá.';

function dedupeWarnings(ws: EngineWarning[]): EngineWarning[] {
  const seen = new Set<string>();
  return ws.filter((w) => {
    const k = `${w.code}\u0000${w.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function payments(rules: TaxRules, tb: number, szocho: number, szja: number): PaymentLine[] {
  const out: PaymentLine[] = [];
  const a = rules.accounts;
  if (tb > 0)
    out.push({ kind: 'tb_jarulek', label: 'TB-járulék', amountHuf: tb, accountName: a.tb.name, accountShortName: a.tb.shortName, accountNumber: a.tb.number, iban: a.tb.iban });
  if (szocho > 0)
    out.push({
      kind: 'szocho',
      label: 'Szocho',
      sublabel: 'szociális hozzájárulási adó',
      amountHuf: szocho,
      accountName: a.szocho.name,
      accountShortName: a.szocho.shortName,
      accountNumber: a.szocho.number,
      iban: a.szocho.iban,
    });
  if (szja > 0)
    out.push({
      kind: 'szja_eloleg',
      label: 'SZJA-előleg',
      sublabel: 'személyi jövedelemadó-előleg',
      amountHuf: szja,
      accountName: a.szja.name,
      accountShortName: a.szja.shortName,
      accountNumber: a.szja.number,
      iban: a.szja.iban,
    });
  return out;
}

/**
 * Calculates the tax year as of `asOf`. Every amount is an ESTIMATE for the accountant to approve
 * (`disclaimer`, `estimate: true`). Throws AdoMotorInputError on malformed input.
 *
 * Quarters returned: those that started on or before asOf and end on or after the start of
 * átalányadózás. A quarter still running is computed for the whole quarter with no further revenue
 * (its future months carry the minimum, `complete: false`).
 */
export function calculateYear(input: YearInput): YearResult {
  const n = validateYearInput(input);
  const { rules, profile, asOf } = n;
  const year = profile.year;
  const yearStart = toIso(year, 1, 1);
  const yearEnd = toIso(year, 12, 31);
  const diy = daysInYear(year);
  const start = profile.atalanyFrom ? maxDate(profile.atalanyFrom, yearStart) : yearStart;
  const startMonth = monthOf(start);
  const asOfInYear = minDate(asOf, yearEnd);
  const costRatio = n.costRatioUsed;
  const yearWarnings: EngineWarning[] = [];

  // ---- revenue (SPEC §7.2 step 1)
  const R = new Array<number>(13).fill(0); // by received month, 1..12
  let afaUsed = 0;
  let beforeStart = 0;
  let estimatedCount = 0;
  for (const item of n.revenue as readonly RevenueItemInput[]) {
    if (item.countsForAtalany && item.receivedOn >= yearStart && item.receivedOn <= yearEnd && item.receivedOn <= asOf) {
      if (item.receivedOn < start) beforeStart++;
      else {
        R[monthOf(item.receivedOn)]! += item.amountHuf;
        if (item.estimated) estimatedCount++;
      }
    }
    if (item.countsForAfaLimit && item.deliveryDate >= yearStart && item.deliveryDate <= yearEnd && item.deliveryDate <= asOf) afaUsed += item.amountHuf;
  }
  const I = R.map((r) => roundDiv(r * (100 - costRatio), 100)); // monthly income
  const cumIncome = (lastMonth: number) => sum(I.slice(1, lastMonth + 1));
  const reachedMonthUpTo = (lastMonth: number): number | null => {
    let c = 0;
    for (let m = 1; m <= lastMonth; m++) {
      c += I[m]!;
      if (c >= rules.taxFreeIncomeHuf) return m;
    }
    return null;
  };

  // ---- personal allowances (SPEC §28.3.7): plan + the month-bound pass (they do not depend on the járulék)
  const overrideEndMonth = profile.priorOverrides ? profile.priorOverrides.throughQuarter * 3 : 0;
  const plan = profile.kedvezmenyek ? planAllowances(rules, profile, Math.max(startMonth, overrideEndMonth + 1)) : null;
  const mb = monthBoundPass(I, rules.taxFreeIncomeHuf, plan, rules.allowances.fiatal25MonthlyCapHuf);
  const convM = new Array<number>(13).fill(0);
  let allowanceSummary: AllowanceSummary | null = null;
  let csjkYear = 0;
  let tbGrossYear = 0;

  // ---- insured days per month
  const md = classifyMonths(year, start, profile.insuranceBreaks ?? [], profile.status);
  const fullMinimum = profile.guaranteedMinimum ? rules.guaranteedMinimumHuf : rules.minimumWageHuf;

  // ---- quarters (steps 2–7)
  const quarters: QuarterResult[] = [];
  const ov = profile.priorOverrides;
  const approvedByQ = new Map(n.approvedQuarters.map((a) => [a.quarter as number, a]));
  let priorBase = 0;
  let priorSzja = 0;
  for (const q of [1, 2, 3, 4] as const) {
    const qStart = quarterStart(year, q);
    const qEnd = quarterEnd(year, q);
    if (qStart > asOf) break;
    const monthsOfQ = [q * 3 - 2, q * 3 - 1, q * 3];
    const lastMonth = q * 3;
    const incomeYtd = cumIncome(lastMonth);
    const taxableYtd = Math.max(0, incomeYtd - rules.taxFreeIncomeHuf);
    const covered = !!ov && q <= ov.throughQuarter;

    const insuredMonthNums = profile.status === 'nyugdijas' ? [] : monthsOfQ.filter((m) => md[m - 1]!.insuredDays > 0);
    const nIns = insuredMonthNums.length;
    const remaining = taxableYtd - priorBase;
    const g: Ratio = nIns > 0 ? ratio(Math.max(0, remaining), nIns) : ratio(0);
    // Whole forints per month (SPEC §7.6 C: every month carries the same rounded share). A rounding
    // difference is not lost: priorBase below sums the ACTUAL bases, so the next quarter's
    // göngyölítés picks it up. The explanation says so when the sum differs.
    const gRound = ratioRound(g);
    const gOf = (_m: number) => gRound;

    // Monthly actual bases (step 5). TB and szocho share the base unless the szocho minimum
    // differs (2026: it does not – szochoMinimumPct = 100).
    const szochoBases: number[] = [];
    const months: MonthLine[] = monthsOfQ.map((m) => {
      const d = md[m - 1]!;
      const insured = insuredMonthNums.includes(m);
      const line: MonthLine = {
        month: m,
        revenueHuf: R[m]!,
        incomeHuf: I[m]!,
        insured,
        minimumHuf: null,
        baseHuf: 0,
        tbHuf: 0,
        szochoHuf: 0,
        insuredDays: profile.status === 'nyugdijas' ? 0 : d.insuredDays,
        minimumDays: profile.status === 'nyugdijas' ? 0 : d.minimumDays,
        minimumApplied: false,
        ...(toIso(year, m, 1) > asOf ? { future: true } : {}),
      };
      if (!insured) {
        szochoBases.push(0);
        return line;
      }
      let szBase: number;
      if (profile.status === 'fofoglalkozasu') {
        // Minimum: full for a fully insured month, else 1/30 of it per day the minimum applies to.
        const minR: Ratio =
          d.minimumDays >= d.daysInMonth
            ? ratio(fullMinimum)
            : ratioMin(ratio(fullMinimum), ratio(fullMinimum * d.minimumDays, rules.minimumProrationDays));
        const szMinR: Ratio = ratio(minR.n * rules.szochoMinimumPct, minR.d * 100);
        line.minimumHuf = ratioRound(minR);
        line.minimumApplied = ratioCompare(minR, g) > 0;
        line.baseHuf = Math.max(gOf(m), line.minimumHuf);
        szBase = Math.max(gOf(m), ratioRound(szMinR));
      } else {
        line.baseHuf = gOf(m); // mellékállás: no minimum
        szBase = line.baseHuf;
      }
      line.tbHuf = permilleOf(line.baseHuf, rules.tbPermille);
      line.szochoHuf = permilleOf(szBase, rules.szochoPermille);
      szochoBases.push(szBase);
      return line;
    });

    // Családi járulékkedvezmény (SPEC §28.3.7 c step 5, Tbj. 80. § (2)): month-local, only in-year, only insured.
    let qCsjk = 0;
    if (plan) {
      const ar = rules.allowances;
      for (const line of months) {
        const m = line.month;
        let csjk = 0;
        let conv = 0;
        if (plan.csjkInYear && profile.status !== 'nyugdijas' && line.insured && plan.fCs[m]! > 0) {
          const b3 = Math.max(0, mb.B2[m]! - plan.fSz[m]! - plan.fHz[m]!);
          const rest = Math.max(0, plan.fCs[m]! - b3);
          // A minimum month: only the part of the minimum not above the month's (even tax-free) income; 0 without income.
          const capBase = line.minimumApplied ? Math.min(line.minimumHuf ?? 0, Math.max(I[m]!, 0)) : line.baseHuf;
          const capTb = Math.min(permilleOf(capBase, rules.tbPermille), line.tbHuf);
          csjk = Math.max(0, Math.min(permilleOf(rest, ar.csjkPermille), capTb));
          // the part of the családi frame turned into csjk (Szja tv. 29/B. § (6))
          conv = Math.min(rest, roundDiv(csjk * 1000, ar.csjkPermille));
        }
        convM[m] = conv;
        qCsjk += csjk;
        line.taxableHuf = mb.T[m]!;
        line.exemptHuf = mb.exA[m]! + mb.exF[m]!;
        line.csjkHuf = csjk;
      }
    }

    const szochoBaseSum = sum(szochoBases);
    const baseSum = sum(months.map((m) => m.baseHuf));
    const tbGross = sum(months.map((m) => m.tbHuf));
    const tb = tbGross - qCsjk;
    const szocho = sum(months.map((m) => m.szochoHuf));
    // SZJA (SPEC §28.3.7 c step 6): with allowances the YTD base after the month-bound exemptions minus the frames.
    let szjaCum: number;
    let usedYtd: Partial<Record<AllowanceKind, number>> | undefined;
    let afterAllowancesHuf = taxableYtd;
    let csaladiUnused = 0;
    if (plan) {
      let base = 0;
      let fsz = 0;
      let fhz = 0;
      let fcs = 0;
      let exA30 = 0;
      let exAnyak = 0;
      let exF = 0;
      for (let m = 1; m <= lastMonth; m++) {
        base += mb.B2[m]!;
        fsz += plan.fSz[m]!;
        fhz += plan.fHz[m]!;
        fcs += plan.fCs[m]! - convM[m]!;
        if (plan.motherKind[m] === 'anya30') exA30 += mb.exA[m]!;
        else exAnyak += mb.exA[m]!;
        exF += mb.exF[m]!;
      }
      base = Math.max(0, base);
      afterAllowancesHuf = Math.max(0, base - fsz - fhz - fcs);
      szjaCum = permilleOf(afterAllowancesHuf, rules.szjaPermille);
      const usedSz = Math.min(fsz, base);
      const usedHz = Math.min(fhz, base - usedSz);
      const usedCs = Math.min(fcs, base - usedSz - usedHz);
      csaladiUnused = fcs - usedCs;
      const u: Partial<Record<AllowanceKind, number>> = {};
      const put = (k: AllowanceKind, v: number) => {
        if (v > 0) u[k] = v;
      };
      put('anya30', exA30);
      put('anyak', exAnyak);
      put('fiatal25', exF);
      put('szemelyi', usedSz);
      put('elso_hazasok', usedHz);
      put('csaladi', usedCs);
      usedYtd = u;
    } else szjaCum = permilleOf(taxableYtd, rules.szjaPermille);
    let szja = szjaCum - priorSzja;
    const qWarnings: EngineWarning[] = [];
    const clamped = szja < 0;
    if (clamped) {
      qWarnings.push({
        code: 'szja_tulfizetes',
        audience: 'konyvelo',
        text: `${q}. negyedév: az eddigi SZJA-előlegek (${formatHuf(priorSzja)}) többek a halmozott összegnél (${formatHuf(szjaCum)}); most 0, a különbözet az éves bevallásban rendeződik.`,
      });
      szja = 0;
    }
    const total = tb + szocho + szja;
    const complete = asOf > qEnd;
    const revenueQ = sum(monthsOfQ.map((m) => R[m]!));
    const incomeQ = sum(monthsOfQ.map((m) => I[m]!));

    // Quarters ending before átalányadózás started are not returned (no income, no insured month).
    if (qEnd >= start) {
      const notInsured =
        profile.status === 'nyugdijas'
          ? []
          : monthsOfQ.filter((m) => md[m - 1]!.insuredDays === 0).map((m) => ({ month: m, reasons: md[m - 1]!.notInsuredReasons }));
      const explanation = buildExplanation({
        rules,
        year,
        quarter: q,
        status: profile.status,
        guaranteedMinimum: profile.guaranteedMinimum,
        costRatio,
        firstMonth: start > qStart ? startMonth : monthsOfQ[0]!,
        lastMonth,
        yearFirstMonth: startMonth,
        revenueHuf: revenueQ,
        incomeHuf: incomeQ,
        incomeYtdHuf: incomeYtd,
        taxableYtdHuf: taxableYtd,
        priorBaseSumHuf: priorBase,
        priorSzjaHuf: priorSzja,
        gHuf: gRound,
        insuredMonths: nIns,
        partlySuspendedMonths: profile.status === 'nyugdijas' ? [] : insuredMonthNums.filter((m) => md[m - 1]!.partlySuspendedDays > 0),
        months,
        notInsured,
        szochoBaseSumHuf: szochoBaseSum,
        tbHuf: tbGross,
        szochoHuf: szocho,
        ...(plan
          ? {
              allowances: {
                usedYtd: usedYtd ?? {},
                afterAllowancesHuf,
                csjkHuf: qCsjk,
                csaladiUnusedHuf: csaladiUnused,
                anyakJogcim: plan.anyakJogcim,
                csaladiChildren: Math.max(0, ...plan.csChildren.slice(1, lastMonth + 1)),
              },
            }
          : {}),
        szjaCumulativeHuf: szjaCum,
        szjaAdvanceHuf: szja,
        szjaClamped: clamped,
        totalHuf: total,
        complete,
        coveredByPriorOverride: covered,
        adomentesReachedMonth: reachedMonthUpTo(lastMonth),
      });
      quarters.push({
        quarter: q,
        periodKey: `${year}-Q${q}`,
        dueDate: quarterDueDate(year, q, rules),
        complete,
        revenueHuf: revenueQ,
        incomeHuf: incomeQ,
        incomeYtdHuf: incomeYtd,
        taxableYtdHuf: taxableYtd,
        cumulativeBasePerMonthHuf: gRound,
        months,
        tbHuf: tb,
        szochoHuf: szocho,
        szjaAdvanceHuf: szja,
        totalHuf: total,
        payments: payments(rules, tb, szocho, szja),
        explanation,
        warnings: qWarnings,
        estimate: true,
        disclaimer: DISCLAIMER,
        priorActualBaseSumHuf: priorBase,
        priorSzjaAdvanceSumHuf: priorSzja,
        szjaCumulativeHuf: szjaCum,
        insuredMonths: nIns,
        coveredByPriorOverride: covered,
        ...(plan ? { csjkHuf: qCsjk, allowanceUsedYtdHuf: usedYtd ?? {} } : {}),
      });
      if (plan) {
        csjkYear += qCsjk;
        tbGrossYear += tbGross;
        const baselineCum = permilleOf(taxableYtd, rules.szjaPermille);
        const saved = Math.max(0, baselineCum - szjaCum);
        allowanceSummary = {
          usedHuf: usedYtd ?? {},
          szjaSavedHuf: saved,
          csjkHuf: csjkYear,
          savedHuf: saved + csjkYear,
          csaladiUnusedHuf: csaladiUnused,
          annualCsjkPotentialHuf:
            profile.status === 'nyugdijas' ? 0 : Math.max(0, Math.min(permilleOf(csaladiUnused, rules.allowances.csjkPermille), tbGrossYear - csjkYear)),
        };
      }
    }
    yearWarnings.push(...qWarnings);

    // accumulate actual sums for the next quarter; an approved quarter counts with its APPROVED sums
    // (SPEC §27.11 T1: revenue that later lands in a closed quarter moves into the next open one);
    // an override replaces them after its last quarter
    const ap = approvedByQ.get(q);
    if (ap && !covered) {
      priorBase += ap.baseSumHuf;
      priorSzja += ap.szjaAdvanceHuf;
      if (ap.revenueHuf !== undefined && ap.revenueHuf !== null && ap.revenueHuf !== revenueQ)
        yearWarnings.push({
          code: 'jovahagyott_negyedev_valtozott',
          audience: 'konyvelo',
          text: `Lezárt negyedév bevétele változott – nézd át: ${q}. negyedév, jóváhagyáskor ${formatHuf(ap.revenueHuf)}, most ${formatHuf(revenueQ)}. A különbözet a következő nyitott negyedév összegébe kerül (ha nincs ilyen, az éves bevallásba). Ha a lezárt negyedévet kell javítani, nyisd újra.`,
        });
    } else {
      priorBase += baseSum;
      priorSzja += szja;
    }
    if (ov && q === ov.throughQuarter) {
      priorBase = ov.priorActualBaseSum;
      priorSzja = ov.priorSzjaAdvanceSum;
    }
  }

  // ---- meters (step 9)
  // NAV 100 ch. 2: the revenue caps are prorated by time for a business that starts, ends or
  // suspends its activity during the year – suspended days are not active days.
  const startN = dayNumber(start);
  const yearEndN = dayNumber(yearEnd);
  const suspendedDays = new Set<number>();
  for (const b of profile.insuranceBreaks ?? []) {
    if (b.kind !== 'szunetel') continue;
    for (let d = Math.max(dayNumber(b.from), startN); d <= Math.min(dayNumber(b.to), yearEndN); d++) suspendedDays.add(d);
  }
  const suspendedUntil = (isoDate: string) => {
    const lim = dayNumber(isoDate);
    let c = 0;
    for (const d of suspendedDays) if (d <= lim) c++;
    return c;
  };
  const calendarDays = daysInclusive(start, yearEnd);
  const activeDays = Math.max(1, calendarDays - suspendedDays.size);
  const elapsedDays = asOf < start ? 0 : Math.max(0, Math.min(activeDays, daysInclusive(start, asOfInYear) - suspendedUntil(asOfInYear)));
  const proj: Projection = { activeDays, elapsedDays };
  // SPEC §28.4.2: months with at least one active day (on or after the start, not suspended).
  const activeMonths: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const first = dayNumber(toIso(year, m, 1));
    let active = false;
    for (let i = 0; i < daysInMonth(year, m) && !active; i++) {
      const d = first + i;
      if (d >= startN && !suspendedDays.has(d)) active = true;
    }
    if (active) activeMonths.push(m);
  }
  const atalanyUsed = sum(R.slice(1));
  const capFull = n.retail ? rules.atalanyCapRetailHuf : rules.atalanyCapHuf;
  const capProrated = activeDays < diy;
  const capLimit = capProrated ? roundDiv(capFull * activeDays, diy) : capFull;
  const capReason = !capProrated
    ? null
    : calendarDays < diy && suspendedDays.size > 0
      ? 'az év közbeni kezdés és a szünetelés miatt arányosan'
      : suspendedDays.size > 0
        ? 'a szünetelés miatt arányosan'
        : 'az év közbeni kezdés miatt arányosan';
  // Áfa tv. 189. §: a business registered during the year meets the alanyi adómentesség limit time-proportionally
  // in its first year (NAV, 2025-12-10: "Aki 2026 év közben kezdi meg működését, arra … időarányosan vonatkozik a
  // keret"). Days from the start to 31 December over the days of the year; a szünetelés does NOT reduce this limit.
  // [KÖNYVELŐ] to confirm the day count. Round 1 (2026-11-19): the full 20 M was shown to a November starter.
  const afaProrated = calendarDays < diy;
  const afaLimit = afaProrated ? roundDiv(rules.afaLimitHuf * calendarDays, diy) : rules.afaLimitHuf;
  const afa = afaMeter(afaUsed, afaLimit, afaProrated ? 'az év közbeni kezdés miatt arányosan' : null, rules, proj);
  const cap = atalanyCapMeter(atalanyUsed, capLimit, capReason, rules, proj);
  const incomeYtdAll = asOf < yearStart ? 0 : cumIncome(12);
  const adomentes = adomentesMeter(incomeYtdAll, reachedMonthUpTo(12), rules);

  // ---- HIPA (step 8)
  let hipa: YearResult['hipa'] = null;
  if (profile.hipa) {
    const h = hipaEstimate({
      rules,
      year,
      method: profile.hipa.method,
      ratePct: profile.hipa.ratePct,
      projectedRevenueHuf: cap.meter.projectedHuf,
      activeDays: calendarDays,
      daysInYear: diy,
      priorYearHuf: profile.hipa.priorYearHuf ?? null,
      retail: n.retail,
    });
    hipa = h.result;
    yearWarnings.push(...h.warnings);
  }

  // ---- warnings (step 10)
  const w: EngineWarning[] = [];
  if (rules.draft)
    w.push({ code: 'rules_draft', audience: 'ugyfel', text: `A ${yearAdjective(year)} adószabályok még nem véglegesek, ez csak előzetes becslés.` });
  if (n.legacyRatio !== null)
    w.push({
      code: `cost_ratio_${year}_changed`,
      audience: 'konyvelo',
      text: `A profilban ${n.legacyRatio}% költséghányad szerepel, de a ${year}. évre érvényes általános költséghányad ${rules.costRatios.general}%. A becslés ${rules.costRatios.general}%-kal számol – erősítsd meg a profilt.`,
    });
  if (typeof profile.retail === 'boolean' && profile.retail !== (costRatio === rules.costRatios.retail))
    w.push({
      code: 'retail_ratio_mismatch',
      audience: 'konyvelo',
      text: `A kiskereskedelmi jelölés és a ${costRatio}% költséghányad nem illik össze – ellenőrizd a profilt.`,
    });
  if (profile.status === 'mellekallasu')
    w.push({
      code: 'mellekallas_condition',
      audience: 'konyvelo',
      text: 'Mellékállás akkor jár, ha a vállalkozás mellett legalább heti 36 órás munkaviszony vagy nappali tagozatos tanulói jogviszony áll fenn. Negyedévente érdemes ellenőrizni.',
    });
  if (profile.status === 'fofoglalkozasu' && !profile.guaranteedMinimum && costRatio === rules.costRatios.list80)
    w.push({
      code: 'garantalt_minimum_check',
      audience: 'konyvelo',
      text: `Ellenőrizd, kell-e garantált bérminimum: ha a főtevékenység legalább középfokú végzettséget igényel (pl. fodrász, kozmetikus), a havi minimum ${formatHuf(rules.guaranteedMinimumHuf)}.`,
    });
  if (plan) {
    w.push(...plan.warnings);
    if (allowanceSummary && allowanceSummary.csaladiUnusedHuf > 0 && profile.kedvezmenyek?.csaladi)
      w.push({
        code: 'kedvezmeny_ev_vegen',
        audience: 'ugyfel',
        text: 'A fel nem használt családi kedvezményedet az éves bevallásban számolja el a könyvelőd.',
      });
  }
  if (profile.allowances && profile.allowances.length > 0 && !plan)
    w.push({
      code: 'kedvezmeny_nem_modellezett',
      audience: 'ugyfel',
      text: 'A kedvezményeidet (például a családi kedvezményt) ez a becslés még nem tartalmazza. A könyvelőd számolja bele őket.',
    });
  const oldSuspension = (profile.insuranceBreaks ?? []).find((b) => b.kind === 'szunetel' && b.from < '2024-01-01' && b.to >= yearStart);
  if (oldSuspension)
    w.push({
      code: 'szunetel_2024_elott',
      audience: 'konyvelo',
      text: `A szünetelés ${oldSuspension.from}-án, 2024 előtt kezdődött. A Tbj. 105/D. § szerint erre még a régi, napi arányosításos szabály vonatkozhat, a becslés viszont a 2024-es szabállyal számol (a csak részben szünetelő hónapra teljes minimum). Ellenőrizd.`,
    });
  if (beforeStart > 0)
    w.push({
      code: 'revenue_before_start',
      audience: 'konyvelo',
      text: `${beforeStart} bevételi tétel az átalányadózás kezdete (${start}) előtti, ezeket a becslés nem számolja.`,
    });
  if (estimatedCount > 0)
    w.push({
      code: 'received_on_estimated',
      audience: 'konyvelo',
      text: `${estimatedCount} tételnél a pénz beérkezésének napja becsült (például a számla fizetési határideje). Bankkivonat alapján érdemes pontosítani.`,
    });
  w.push(...afa.warnings, ...cap.warnings, ...yearWarnings);

  return {
    engineVersion: ENGINE_VERSION,
    rulesVersion: rules.rulesVersion,
    asOf,
    quarters,
    meters: { afa: afa.meter, atalanyCap: cap.meter, adomentes },
    hipa,
    revenueByMonth: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amountHuf: R[i + 1]! })),
    warnings: dedupeWarnings(w),
    disclaimer: DISCLAIMER,
    estimate: true,
    year,
    costRatioUsed: costRatio,
    incomeYtdHuf: incomeYtdAll,
    ...(plan ? { allowances: allowanceSummary ?? { usedHuf: {}, szjaSavedHuf: 0, csjkHuf: 0, savedHuf: 0, csaladiUnusedHuf: 0, annualCsjkPotentialHuf: 0 } } : {}),
    activeMonths,
    activeDays,
    elapsedActiveDays: elapsedDays,
  };
}
