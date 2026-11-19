// Limit meters (SPEC §7.2 step 9): alanyi ÁFA-mentesség, átalányadó revenue cap, adómentes rész.
// Sentences follow the approved home screen copy (design 03, "Idei kereteid").

import type { TaxRules } from '../rules/types.js';
import type { AdomentesMeter, EngineWarning, Meter } from '../types.js';
import { roundDiv } from '../util/math.js';
import { formatHuf, formatHufApprox, formatRatioPct, monthInessive } from '../util/format.js';

export interface Projection {
  /** Days of the year on which the business is active (start → 31 Dec, suspended days excluded). */
  activeDays: number;
  /** Active days elapsed until asOf (0 … activeDays). */
  elapsedDays: number;
}

/** used extrapolated linearly to the end of the active period ("csíkozott rész"). */
export function project(usedHuf: number, p: Projection): number {
  if (p.elapsedDays <= 0 || p.elapsedDays >= p.activeDays) return usedHuf;
  return roundDiv(usedHuf * p.activeDays, p.elapsedDays);
}

/** Percent for sentences; never shows the threshold (80 %, 100 %) before it is really reached. */
function shownPct(ratio: number, warnRatio: number): string {
  let r = Math.round(ratio * 1000) / 1000;
  if (ratio < 1 && r >= 1) r = 0.999;
  if (ratio < warnRatio && r >= warnRatio) r = warnRatio - 0.001;
  return formatRatioPct(r);
}

function ratioOf(used: number, limit: number): number {
  return limit > 0 ? Math.round((used / limit) * 10_000) / 10_000 : 0;
}

interface MeterOut {
  meter: Meter;
  warnings: EngineWarning[];
}

/**
 * The projection ("Ilyen tempóban év végéig …", the striped part of the bar, the HIPA band) is only used after
 * `projectionMinDays` active days: ten days and one invoice say nothing about the year (round 1, 2026-11-19).
 */
export function projectionReliable(rules: TaxRules, p: Projection): boolean {
  return p.elapsedDays >= rules.projectionMinDays;
}

/**
 * @param limitHuf the limit of THIS year: the full rules.afaLimitHuf, or its time-proportional part when the business
 *   was registered during the year (Áfa tv. 189. §: "a nyilvántartásba vétel éve során … időarányosan").
 * @param proratedReason e.g. 'az év közbeni kezdés miatt arányosan' when the limit is prorated, else null
 */
export function afaMeter(usedHuf: number, limitHuf: number, proratedReason: string | null, rules: TaxRules, p: Projection): MeterOut {
  const reliable = projectionReliable(rules, p);
  const projectedHuf = reliable ? project(usedHuf, p) : usedHuf;
  const ratio = ratioOf(usedHuf, limitHuf);
  const over = usedHuf > limitHuf;
  const near = !over && usedHuf >= limitHuf * rules.warnRatio;
  const projectedOver = !over && projectedHuf > limitHuf && reliable;
  const remainingHuf = Math.max(0, limitHuf - usedHuf);
  const pct = shownPct(limitHuf > 0 ? usedHuf / limitHuf : 0, rules.warnRatio);
  const warnings: EngineWarning[] = [];
  const limitText = `${formatHuf(limitHuf)}${proratedReason ? ` (${proratedReason})` : ''}`;

  let sentence: string;
  let detail: string;
  if (over) {
    sentence = `Átlépted az alanyi ÁFA-mentesség határát (${limitText}).`;
    detail = 'A határt átlépő számlától kezdve ÁFÁ-t kell felszámolnod. Beszélj még ma a könyvelőddel.';
    warnings.push({ code: 'afa_over', audience: 'ugyfel', text: `${sentence} ${detail}` });
  } else {
    sentence = `Még ${formatHuf(remainingHuf)}-ot számlázhatsz ÁFA nélkül.`;
    detail = 'Ennyi fér még az alanyi ÁFA-mentességbe.';
    if (proratedReason) detail += ` Az indulásod évében a ${formatHuf(rules.afaLimitHuf)}-os határ időarányos: idén ${formatHuf(limitHuf)}.`;
    if (projectedOver) detail += ` Ilyen tempóban év végéig kb. ${formatHufApprox(projectedHuf)} lesz, ez több a határnál – beszéld meg a könyvelőddel.`;
    else if (near) detail += ` A keret ${pct}-át már használtad, közel vagy a határhoz.`;
    else if (projectedHuf !== usedHuf) detail += ` Ilyen tempóban év végéig kb. ${formatHufApprox(projectedHuf)} lesz.`;
    if (near)
      warnings.push({
        code: 'afa_80',
        audience: 'ugyfel',
        text: `Közel vagy az alanyi ÁFA-mentesség határához: idén eddig ${formatHuf(usedHuf)} (${pct}) a ${formatHuf(limitHuf)}-ból${proratedReason ? ` (${proratedReason})` : ''}. Figyeld együtt a könyvelőddel.`,
      });
    if (projectedOver)
      warnings.push({
        code: 'afa_projected_over',
        audience: 'ugyfel',
        text: `Ilyen tempóban év végéig kb. ${formatHufApprox(projectedHuf)} lesz a számláid összege, ez több az ÁFA-mentesség határánál (${limitText}).`,
      });
  }
  return {
    meter: { usedHuf, limitHuf, projectedHuf, ratio, warning: over || near || projectedOver, sentence, detail, remainingHuf },
    warnings,
  };
}

/** @param proratedReason e.g. 'a szünetelés miatt arányosan' when the cap is prorated, else null */
export function atalanyCapMeter(usedHuf: number, limitHuf: number, proratedReason: string | null, rules: TaxRules, p: Projection): MeterOut {
  const reliable = projectionReliable(rules, p);
  const projectedHuf = reliable ? project(usedHuf, p) : usedHuf;
  const ratio = ratioOf(usedHuf, limitHuf);
  const over = usedHuf > limitHuf;
  const near = !over && usedHuf >= limitHuf * rules.warnRatio;
  const projectedOver = !over && projectedHuf > limitHuf && reliable;
  const remainingHuf = Math.max(0, limitHuf - usedHuf);
  const pct = shownPct(limitHuf > 0 ? usedHuf / limitHuf : 0, rules.warnRatio);
  const warnings: EngineWarning[] = [];
  const limitText = `${formatHuf(limitHuf)}${proratedReason ? ` (${proratedReason})` : ''}`;

  let sentence: string;
  let detail: string;
  if (over) {
    sentence = `Átlépted az átalányadózás bevételi határát (${limitText}).`;
    detail = 'Ez fontos változás az adózásodban. Beszélj még ma a könyvelőddel.';
    warnings.push({ code: 'atalany_cap_over', audience: 'ugyfel', text: `${sentence} ${detail}` });
  } else {
    sentence = `Még ${formatHuf(remainingHuf)} bevétel fér bele idén az átalányadózásba.`;
    detail = `A határ idén ${limitText}, eddig ${formatHuf(usedHuf)} a bevételed.`;
    if (projectedOver) detail += ` Ilyen tempóban év végéig kb. ${formatHufApprox(projectedHuf)} lesz, ez több a határnál.`;
    else if (near) detail += ` Ez a határ ${pct}-a.`;
    if (near)
      warnings.push({
        code: 'atalany_cap_80',
        audience: 'ugyfel',
        text: `Közel vagy az átalányadózás bevételi határához: eddig ${formatHuf(usedHuf)} (${pct}) a ${formatHuf(limitHuf)}-ból.`,
      });
    if (projectedOver)
      warnings.push({
        code: 'atalany_cap_projected_over',
        audience: 'ugyfel',
        text: `Ilyen tempóban év végéig kb. ${formatHufApprox(projectedHuf)} lesz a bevételed, ez több az átalányadózás határánál (${limitText}).`,
      });
  }
  return {
    meter: { usedHuf, limitHuf, projectedHuf, ratio, warning: over || near || projectedOver, sentence, detail, remainingHuf },
    warnings,
  };
}

export function adomentesMeter(incomeYtdHuf: number, reachedMonth: number | null, rules: TaxRules): AdomentesMeter {
  const limitHuf = rules.taxFreeIncomeHuf;
  const usedIncomeHuf = Math.min(Math.max(0, incomeYtdHuf), limitHuf);
  const reached = incomeYtdHuf >= limitHuf;
  if (reached) {
    return {
      limitHuf,
      usedIncomeHuf,
      reached,
      reachedMonth,
      sentence: reachedMonth ? `Az adómentes részt ${monthInessive(reachedMonth)} elérted.` : 'Az adómentes részt elérted.',
      detail: `Az első ${formatHuf(limitHuf)} jövedelmed adómentes volt. Azóta SZJA-előleget is fizetsz, ez így rendben van.`,
    };
  }
  return {
    limitHuf,
    usedIncomeHuf,
    reached,
    reachedMonth: null,
    sentence: `Még ${formatHuf(limitHuf - usedIncomeHuf)} jövedelmed adómentes idén.`,
    detail: `Az idei jövedelmedből az első ${formatHuf(limitHuf)} adómentes. Amíg ezt el nem éred, SZJA-előleget sem fizetsz.`,
  };
}
