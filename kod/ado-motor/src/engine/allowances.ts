// SPEC §28.3.7 – personal SZJA allowances of an átalányadózó egyéni vállalkozó (2026 law, research
// _munka/k6/kedvezmenyek_2026.md). Pure helpers used by calculateYear.
//
// Two kinds of allowance:
//  - income-bound (30 év alatti anyák, 2/3/4+ gyermekes anyák, 25 év alattiak): they exempt the taxable income of the
//    eligible MONTHS (the mothers' month-local; the 25 év alattiak cumulatively up to eligible months × cap, see monthBoundPass);
//  - frames (személyi, első házasok, családi): they reduce the YEAR-TO-DATE base of the quarterly advance
//    (Szja tv. 49. § (1) "korábban még nem érvényesített kedvezmény").
// The adómentes rész always comes first; allowances act only on the taxable part above it ([K] §2.1).
// Order (Szja tv. 29/H.): anya30 → anyák → fiatal25 → személyi → első házasok → családi.

import type { TaxRules } from '../rules/types.js';
import type { AllowanceKind, AllowancesInput, EngineWarning, TaxProfileInput } from '../types.js';
import { formatHuf } from '../util/format.js';
import { roundDiv } from '../util/math.js';

export interface AllowancePlan {
  /** index 1..12 */
  motherKind: (null | 'anya30' | 'anyak')[];
  fiatal: boolean[];
  fSz: number[];
  fHz: number[];
  fCs: number[];
  /** Number of kedvezményezett children of the month (for the explanation). */
  csChildren: number[];
  csjkInYear: boolean;
  anyakJogcim: 'ket' | 'harom' | 'negyplusz' | null;
  warnings: EngineWarning[];
}

const zeros = () => new Array<number>(13).fill(0);

function birthYm(a: AllowancesInput): { y: number; m: number } | null {
  if (!a.birthMonth) return null;
  const mt = /^(\d{4})-(\d{2})$/.exec(a.birthMonth);
  if (!mt) return null;
  return { y: Number(mt[1]), m: Number(mt[2]) };
}

/** Months 1..12 before (and including) the 25th birthday month in `year` (Szja tv. 29/F.). */
export function fiatal25Months(birthMonth: string | undefined, year: number, ageYears = 25): number[] {
  const mt = birthMonth ? /^(\d{4})-(\d{2})$/.exec(birthMonth) : null;
  if (!mt) return [];
  const by = Number(mt[1]);
  const bm = Number(mt[2]);
  if (by + ageYears > year) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (by + ageYears === year) return Array.from({ length: bm }, (_, i) => i + 1);
  return [];
}

/** Családi frame of one month: Σ_children (base(eltartott) + tartós beteg extra) × (felváltva 50 %) × share %. */
export function csaladiFrameHuf(rules: TaxRules, eltartott: number, children: { felvaltva?: boolean; tartosBeteg?: boolean }[], sharePct = 100): number {
  const ar = rules.allowances;
  if (eltartott <= 0 || children.length === 0) return 0;
  const base = eltartott === 1 ? ar.csaladiPerChildHuf.one : eltartott === 2 ? ar.csaladiPerChildHuf.two : ar.csaladiPerChildHuf.threePlus;
  let total = 0;
  for (const c of children) {
    let v = base + (c.tartosBeteg ? ar.csaladiTartosBetegExtraHuf : 0);
    if (c.felvaltva) v = roundDiv(v * ar.felvaltvaPct, 100);
    total += v;
  }
  return roundDiv(total * sharePct, 100);
}

/**
 * Builds the per-month allowance plan. `firstMonth` = the first month allowances may act on (the start of
 * átalányadózás, and after the months a previous accountant covered: those are skipped, [KÖNYVELŐ] wait #34).
 */
export function planAllowances(rules: TaxRules, profile: TaxProfileInput, firstMonth: number): AllowancePlan {
  const a = profile.kedvezmenyek ?? {};
  const ar = rules.allowances;
  const year = profile.year;
  const warnings: EngineWarning[] = [];
  const plan: AllowancePlan = {
    motherKind: new Array(13).fill(null),
    fiatal: new Array<boolean>(13).fill(false),
    fSz: zeros(),
    fHz: zeros(),
    fCs: zeros(),
    csChildren: zeros(),
    csjkInYear: false,
    anyakJogcim: null,
    warnings,
  };
  const inRange = (m: number) => m >= firstMonth && m >= 1 && m <= 12;
  const birth = birthYm(a);
  const needBirth = (label: string) =>
    warnings.push({
      code: 'kedvezmeny_szuletes_hianyzik',
      audience: 'konyvelo',
      text: `${label}: hiányzik a születési év és hónap, ezért a becslés nem számol vele.`,
    });

  if (profile.priorOverrides)
    warnings.push({
      code: 'kedvezmeny_elozo_konyvelo',
      audience: 'konyvelo',
      text: `Az első ${profile.priorOverrides.throughQuarter} negyedévet az előző könyvelő számolta: arra a hónapokra a kedvezményeket a becslés nem számolja újra.`,
    });

  // 1. 30 év alatti anyák (month-bound, no cap)
  if (a.anya30 && a.anya30.months.length) {
    if (!birth) needBirth('30 év alatti anyák kedvezménye');
    else if (birth.y < year - ar.anya30AgeYears)
      warnings.push({
        code: 'anya30_kor',
        audience: 'konyvelo',
        text: `30 év alatti anyák kedvezménye: a születési év (${birth.y}) alapján ${year}-ban nem jár (${year - ar.anya30AgeYears}-ban vagy később születettnek jár).`,
      });
    else for (const m of a.anya30.months) if (inRange(m)) plan.motherKind[m] = 'anya30';
  }
  // 2. 2 / 3 / 4+ gyermekes anyák (month-bound, no cap)
  if (a.anyak && a.anyak.months.length) {
    let ok = true;
    if (a.anyak.jogcim === 'ket' && ar.ketgyermekesMinBirthYear !== null) {
      if (!birth) {
        needBirth('Két gyermeket nevelő anyák kedvezménye');
        ok = false;
      } else if (birth.y < ar.ketgyermekesMinBirthYear) {
        warnings.push({
          code: 'anyak_kor',
          audience: 'konyvelo',
          text: `Két gyermeket nevelő anyák kedvezménye: ${year}-ban csak az ${ar.ketgyermekesMinBirthYear}-ban vagy később született anyának jár (a születési év ${birth.y}).`,
        });
        ok = false;
      }
    }
    if (ok) {
      plan.anyakJogcim = a.anyak.jogcim;
      for (const m of a.anyak.months) if (inRange(m) && plan.motherKind[m] === null) plan.motherKind[m] = 'anyak';
    }
  }
  // 4. 25 év alattiak (eligible months; annual frame = eligible months × cap, applied cumulatively)
  if (a.fiatal25) {
    if (!birth) needBirth('25 év alattiak kedvezménye');
    else {
      const eligible = new Set(fiatal25Months(a.birthMonth, year, ar.fiatal25AgeYears));
      const asked = a.fiatal25.months ?? [...eligible];
      const bad = asked.filter((m) => !eligible.has(m));
      if (bad.length)
        warnings.push({
          code: 'fiatal25_kor',
          audience: 'konyvelo',
          text: `25 év alattiak kedvezménye: a 25. születésnap hónapja után nem jár (${bad.length} hónapot kihagytunk).`,
        });
      for (const m of asked) if (eligible.has(m) && inRange(m)) plan.fiatal[m] = true;
    }
  }
  // 5. személyi (frame)
  if (a.szemelyi) for (const m of a.szemelyi.months) if (inRange(m)) plan.fSz[m] = ar.szemelyiMonthlyHuf;
  // 6. első házasok (frame)
  if (a.elsoHazasok) {
    const months = [...new Set(a.elsoHazasok.months)].sort((x, y) => x - y);
    if (months.length > ar.elsoHazasokMaxMonths)
      warnings.push({ code: 'elso_hazasok_honapok', audience: 'konyvelo', text: `Első házasok kedvezménye legfeljebb ${ar.elsoHazasokMaxMonths} hónapig jár.` });
    for (const m of months) if (inRange(m)) plan.fHz[m] = Math.min(a.elsoHazasok.monthlyHuf, ar.elsoHazasokMonthlyHuf);
  }
  // 7. családi (frame; the unused part may become csjk)
  if (a.csaladi) {
    plan.csjkInYear = !!a.csaladi.csjkInYear;
    for (const cm of a.csaladi.months) {
      if (!inRange(cm.month)) continue;
      plan.fCs[cm.month] = csaladiFrameHuf(rules, cm.eltartott, cm.children, cm.sharePct ?? 100);
      plan.csChildren[cm.month] = cm.children.length;
    }
    if (plan.csjkInYear) {
      if (profile.status === 'nyugdijas')
        warnings.push({
          code: 'csjk_nyugdijas',
          audience: 'konyvelo',
          text: 'Nyugdíjas egyéni vállalkozó nem fizet TB-járulékot, ezért családi járulékkedvezmény nem jár.',
        });
      else
        warnings.push({
          code: 'csjk_2658',
          audience: 'konyvelo',
          text: 'Év közbeni családi járulékkedvezménynél az SZJA-előleget is a 2658-ban kell bevallani (Szja tv. 49. § (6)).',
        });
    }
  }
  return plan;
}

export interface MonthBound {
  /** taxable part of the month (index 1..12) */
  T: number[];
  /** base after the month-bound exemptions */
  B2: number[];
  exA: number[];
  exF: number[];
}

/**
 * Steps 1 and 3 of SPEC §28.3.7 c.
 *
 * 25 év alattiak (Szja tv. 29/F. § (2)): the cap is ANNUAL – "adóévenként legfeljebb a jogosultsági hónapok számának és
 * [a júliusi átlagkeresetnek] a szorzata" (NAV 73. füzet 7.2: 8 589 180 Ft for a whole eligible year), and the advance
 * may use the part "korábban még nem érvényesített" (49. § (1)). So the exemption is CUMULATIVE: up to month m it is
 * min(the eligible months' taxable income since 1 January, the eligible months so far × cap); a month whose income
 * stays under the frame leaves the rest for later months (a lump sum in April with 4 eligible months has a
 * 4 × 715 765 frame). exF[m] is the month's increment, so Σ exF up to a quarter end = that quarter's YTD exemption.
 * An increment may exceed the month's own taxable part (catch-up of an earlier month's income): B2[m] can then be
 * negative; only Σ B2 is used for the SZJA, and the month-local csjk clamps it at 0.
 */
export function monthBoundPass(I: readonly number[], taxFree: number, plan: AllowancePlan | null, cap: number): MonthBound {
  const T = zeros();
  const B2 = zeros();
  const exA = zeros();
  const exF = zeros();
  let c = 0;
  let eligibleBase = 0; // taxable income of the eligible months so far (after the mothers' exemptions)
  let eligibleMonths = 0;
  let usedF = 0; // Σ exF so far
  for (let m = 1; m <= 12; m++) {
    const prev = c;
    c += I[m] ?? 0;
    T[m] = Math.max(0, c - taxFree) - Math.max(0, prev - taxFree);
    let b = T[m]!;
    if (plan) {
      if (plan.motherKind[m] && b > 0) {
        exA[m] = b;
        b = 0;
      }
      if (plan.fiatal[m]) {
        eligibleMonths++;
        eligibleBase += Math.max(b, 0);
        const cum = Math.min(eligibleBase, eligibleMonths * cap);
        exF[m] = Math.max(0, cum - usedF);
        usedF += exF[m]!;
        b -= exF[m]!;
      }
    }
    B2[m] = b;
  }
  return { T, B2, exA, exF };
}

export const ALLOWANCE_LINE_LABEL: Record<AllowanceKind, string> = {
  anya30: '30 év alatti anyák kedvezménye – ez a jövedelem SZJA-mentes',
  anyak: 'gyermekes anyák kedvezménye – ez a jövedelem SZJA-mentes',
  fiatal25: '25 év alattiak kedvezménye',
  szemelyi: 'Személyi kedvezmény',
  elso_hazasok: 'Első házasok kedvezménye',
  csaladi: 'Családi kedvezmény',
};

export function anyakLabel(j: 'ket' | 'harom' | 'negyplusz' | null): string {
  const n = j === 'ket' ? '2' : j === 'harom' ? '3' : '4+';
  return `${n} gyermekes anyák kedvezménye – ez a jövedelem SZJA-mentes`;
}

export function unusedText(unused: number): string {
  return `Fel nem használt családi kedvezmény: ${formatHuf(unused)}. A fel nem használt családi kedvezményedet az éves bevallásban számolja el a könyvelőd.`;
}
