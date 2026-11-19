// Input validation. The engine never guesses: a malformed input throws AdoMotorInputError with
// the field path and a plain Hungarian message (the backend maps it to 400 validation_failed).

import { rulesForYear, SUPPORTED_YEARS } from './rules/index.js';
import type { TaxRules } from './rules/types.js';
import type { ApprovedQuarterActual, HipaMethod, InsuranceBreak, RevenueItemInput, TaxProfileInput, TaxStatus, YearInput } from './types.js';
import { isIsoDate } from './util/dates.js';

export class AdoMotorInputError extends Error {
  readonly code = 'validation_failed';
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    const first = Object.entries(fields)[0];
    super(first ? `${first[0]}: ${first[1]}` : 'Hibás bemenet.');
    this.name = 'AdoMotorInputError';
    this.fields = fields;
  }
}

const STATUSES: readonly TaxStatus[] = ['fofoglalkozasu', 'mellekallasu', 'nyugdijas'];
const HIPA_METHODS: readonly HipaMethod[] = ['savos', 'altalanos', 'nincs'];
const ALLOWANCE_KINDS = ['csaladi', 'fiatal_25', 'anyak', 'egyeb'] as const;
const MAX_ITEMS = 100_000;
const MAX_ABS_AMOUNT = 10_000_000_000; // 10 milliárd Ft – far above any átalányadózó, keeps products < 2^53

export interface NormalizedInput {
  rules: TaxRules;
  profile: TaxProfileInput;
  revenue: RevenueItemInput[];
  asOf: string;
  /** Ratio used for the calculation (legacy 40 → the year's general ratio). */
  costRatioUsed: number;
  /** The input carried a legacy general ratio. */
  legacyRatio: number | null;
  retail: boolean;
  /** SPEC §27.11 T1 – approved quarters (empty when none). */
  approvedQuarters: ApprovedQuarterActual[];
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isSafeInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isSafeInteger(x);
}

/** Validates and normalises a YearInput. Throws AdoMotorInputError listing every bad field. */
export function validateYearInput(input: unknown): NormalizedInput {
  const f: Record<string, string> = {};
  if (!isPlainObject(input)) throw new AdoMotorInputError({ input: 'Hiányzik a bemenet.' });
  const { profile, revenue, asOf } = input as Partial<YearInput>;

  if (!isIsoDate(asOf)) f['asOf'] = 'Dátum kell ÉÉÉÉ-HH-NN alakban.';

  let rules: TaxRules | undefined;
  let costRatioUsed = 0;
  let legacyRatio: number | null = null;
  let retail = false;

  if (!isPlainObject(profile)) {
    f['profile'] = 'Hiányzik az adóprofil.';
  } else {
    const p = profile as Partial<TaxProfileInput> & Record<string, unknown>;
    if (!isSafeInt(p.year)) f['profile.year'] = 'Az adóév egész szám.';
    else {
      rules = rulesForYear(p.year);
      if (!rules) f['profile.year'] = `Erre az évre nincs szabálykészlet (van: ${SUPPORTED_YEARS.join(', ')}).`;
    }
    if (rules) {
      const cr = p.costRatio as unknown;
      const valid = [rules.costRatios.general, rules.costRatios.list80, rules.costRatios.retail];
      if (typeof cr === 'number' && valid.includes(cr)) costRatioUsed = cr;
      else if (typeof cr === 'number' && rules.legacyGeneralRatios.includes(cr)) {
        costRatioUsed = rules.costRatios.general;
        legacyRatio = cr;
      } else f['profile.costRatio'] = `A költséghányad ${valid.join(', ')} lehet.`;
    }
    if (!STATUSES.includes(p.status as TaxStatus)) f['profile.status'] = 'Ismeretlen jogállás.';
    if (typeof p.guaranteedMinimum !== 'boolean') f['profile.guaranteedMinimum'] = 'Igen/nem érték kell.';
    if (p.retail !== undefined && typeof p.retail !== 'boolean') f['profile.retail'] = 'Igen/nem érték kell.';
    if (p.atalanyFrom !== undefined && p.atalanyFrom !== null) {
      if (!isIsoDate(p.atalanyFrom)) f['profile.atalanyFrom'] = 'Dátum kell ÉÉÉÉ-HH-NN alakban.';
      else if (isSafeInt(p.year) && p.atalanyFrom > `${p.year}-12-31`) f['profile.atalanyFrom'] = 'Az átalányadózás kezdete nem lehet az adóév után.';
    }
    if (p.insuranceBreaks !== undefined && p.insuranceBreaks !== null) {
      if (!Array.isArray(p.insuranceBreaks)) f['profile.insuranceBreaks'] = 'Lista kell.';
      else
        p.insuranceBreaks.forEach((b: unknown, i: number) => {
          const k = `profile.insuranceBreaks[${i}]`;
          if (!isPlainObject(b)) return void (f[k] = 'Hibás időszak.');
          const br = b as Partial<InsuranceBreak>;
          if (!isIsoDate(br.from)) f[`${k}.from`] = 'Dátum kell ÉÉÉÉ-HH-NN alakban.';
          if (!isIsoDate(br.to)) f[`${k}.to`] = 'Dátum kell ÉÉÉÉ-HH-NN alakban.';
          if (isIsoDate(br.from) && isIsoDate(br.to) && br.from > br.to) f[k] = 'A kezdet nem lehet a vég után.';
          if (br.kind !== 'szunetel' && br.kind !== 'kieso') f[`${k}.kind`] = 'szunetel vagy kieso lehet.';
        });
    }
    if (p.hipa !== undefined && p.hipa !== null) {
      if (!isPlainObject(p.hipa)) f['profile.hipa'] = 'Hibás HIPA-beállítás.';
      else {
        if (!HIPA_METHODS.includes(p.hipa.method as HipaMethod)) f['profile.hipa.method'] = 'savos, altalanos vagy nincs lehet.';
        const max = rules?.hipa.maxRatePct ?? 2;
        if (typeof p.hipa.ratePct !== 'number' || !Number.isFinite(p.hipa.ratePct) || p.hipa.ratePct < 0 || p.hipa.ratePct > max)
          f['profile.hipa.ratePct'] = `Az adómérték 0 és ${max}% között lehet.`;
        else if (Math.abs(p.hipa.ratePct * 100 - Math.round(p.hipa.ratePct * 100)) > 1e-9)
          f['profile.hipa.ratePct'] = 'Legfeljebb két tizedesjegy lehet.';
        const py = (p.hipa as { priorYearHuf?: unknown }).priorYearHuf;
        if (py !== undefined && py !== null && (typeof py !== 'number' || !Number.isInteger(py) || py < 0))
          f['profile.hipa.priorYearHuf'] = 'Az előző évi iparűzési adó nemnegatív egész forint lehet.';
      }
    }
    if (p.priorOverrides !== undefined && p.priorOverrides !== null) {
      const o = p.priorOverrides as unknown;
      if (!isPlainObject(o)) f['profile.priorOverrides'] = 'Hibás előzmény-adat.';
      else {
        if (o['throughQuarter'] !== 1 && o['throughQuarter'] !== 2 && o['throughQuarter'] !== 3)
          f['profile.priorOverrides.throughQuarter'] = '1, 2 vagy 3 lehet.';
        for (const key of ['priorActualBaseSum', 'priorSzjaAdvanceSum'] as const)
          if (!isSafeInt(o[key]) || (o[key] as number) < 0) f[`profile.priorOverrides.${key}`] = 'Nem negatív egész forint kell.';
      }
    }
    if (p.allowances !== undefined && p.allowances !== null) {
      if (!Array.isArray(p.allowances)) f['profile.allowances'] = 'Lista kell.';
      else
        p.allowances.forEach((a: unknown, i: number) => {
          if (!isPlainObject(a) || !ALLOWANCE_KINDS.includes(a['kind'] as (typeof ALLOWANCE_KINDS)[number]))
            f[`profile.allowances[${i}]`] = 'Ismeretlen kedvezmény.';
        });
    }
    if (p.kedvezmenyek !== undefined && p.kedvezmenyek !== null) validateKedvezmenyek(p.kedvezmenyek, rules, f);
    retail = typeof p.retail === 'boolean' ? p.retail : costRatioUsed === rules?.costRatios.retail;
  }

  if (!Array.isArray(revenue)) f['revenue'] = 'Lista kell.';
  else if (revenue.length > MAX_ITEMS) f['revenue'] = `Legfeljebb ${MAX_ITEMS} tétel.`;
  else
    revenue.forEach((r: unknown, i: number) => {
      const k = `revenue[${i}]`;
      if (!isPlainObject(r)) return void (f[k] = 'Hibás tétel.');
      if (!isIsoDate(r['receivedOn'])) f[`${k}.receivedOn`] = 'Dátum kell ÉÉÉÉ-HH-NN alakban.';
      if (!isIsoDate(r['deliveryDate'])) f[`${k}.deliveryDate`] = 'Dátum kell ÉÉÉÉ-HH-NN alakban.';
      if (!isSafeInt(r['amountHuf']) || Math.abs(r['amountHuf'] as number) > MAX_ABS_AMOUNT) f[`${k}.amountHuf`] = 'Egész forint kell.';
      if (typeof r['countsForAtalany'] !== 'boolean') f[`${k}.countsForAtalany`] = 'Igen/nem érték kell.';
      if (typeof r['countsForAfaLimit'] !== 'boolean') f[`${k}.countsForAfaLimit`] = 'Igen/nem érték kell.';
      if (r['estimated'] !== undefined && typeof r['estimated'] !== 'boolean') f[`${k}.estimated`] = 'Igen/nem érték kell.';
    });

  const approvedQuarters = (input as Partial<YearInput>).approvedQuarters;
  if (approvedQuarters !== undefined && approvedQuarters !== null) {
    if (!Array.isArray(approvedQuarters)) f['approvedQuarters'] = 'Lista kell.';
    else {
      const seen = new Set<number>();
      approvedQuarters.forEach((a: unknown, i: number) => {
        const k = `approvedQuarters[${i}]`;
        if (!isPlainObject(a)) return void (f[k] = 'Hibás negyedév.');
        const q = a['quarter'];
        if (q !== 1 && q !== 2 && q !== 3 && q !== 4) f[`${k}.quarter`] = '1, 2, 3 vagy 4 lehet.';
        else if (seen.has(q)) f[`${k}.quarter`] = 'Egy negyedév csak egyszer szerepelhet.';
        else seen.add(q);
        for (const key of ['baseSumHuf', 'szjaAdvanceHuf'] as const)
          if (!isSafeInt(a[key]) || (a[key] as number) < 0 || (a[key] as number) > MAX_ABS_AMOUNT) f[`${k}.${key}`] = 'Nem negatív egész forint kell.';
        if (a['revenueHuf'] !== undefined && a['revenueHuf'] !== null && (!isSafeInt(a['revenueHuf']) || Math.abs(a['revenueHuf'] as number) > MAX_ABS_AMOUNT))
          f[`${k}.revenueHuf`] = 'Egész forint kell.';
      });
    }
  }

  if (Object.keys(f).length > 0 || !rules) throw new AdoMotorInputError(Object.keys(f).length ? f : { 'profile.year': 'Hiányzó adóév.' });

  return {
    rules,
    profile: profile as TaxProfileInput,
    revenue: revenue as RevenueItemInput[],
    asOf: asOf as string,
    costRatioUsed,
    legacyRatio,
    retail,
    approvedQuarters: (approvedQuarters ?? []) as ApprovedQuarterActual[],
  };
}

// ---------- SPEC §28.3.7 (T21): approved personal allowances ----------
const isMonth = (m: unknown): m is number => typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12;

function checkMonths(v: unknown, key: string, f: Record<string, string>): void {
  if (!Array.isArray(v)) f[key] = 'A hónapok listája kell (1–12).';
  else if (!v.every(isMonth)) f[key] = 'A hónap 1 és 12 közötti egész szám lehet.';
  else if (new Set(v).size !== v.length) f[key] = 'Egy hónap csak egyszer szerepelhet.';
}

function validateKedvezmenyek(k: unknown, rules: TaxRules | undefined, f: Record<string, string>): void {
  const base = 'profile.kedvezmenyek';
  if (!isPlainObject(k)) {
    f[base] = 'Hibás kedvezmény-adatok.';
    return;
  }
  const bm = k['birthMonth'];
  if (bm !== undefined && bm !== null && (typeof bm !== 'string' || !/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(bm)))
    f[`${base}.birthMonth`] = 'A születési hónap ÉÉÉÉ-HH alakú legyen.';
  for (const key of ['anya30', 'szemelyi'] as const) {
    const v = k[key];
    if (v === undefined || v === null) continue;
    if (!isPlainObject(v)) f[`${base}.${key}`] = 'Hibás kedvezmény.';
    else checkMonths(v['months'], `${base}.${key}.months`, f);
  }
  const anyak = k['anyak'];
  if (anyak !== undefined && anyak !== null) {
    if (!isPlainObject(anyak)) f[`${base}.anyak`] = 'Hibás kedvezmény.';
    else {
      if (!['ket', 'harom', 'negyplusz'].includes(anyak['jogcim'] as string)) f[`${base}.anyak.jogcim`] = 'A jogcím ket, harom vagy negyplusz lehet.';
      checkMonths(anyak['months'], `${base}.anyak.months`, f);
    }
  }
  const fi = k['fiatal25'];
  if (fi !== undefined && fi !== null) {
    if (!isPlainObject(fi)) f[`${base}.fiatal25`] = 'Hibás kedvezmény.';
    else if (fi['months'] !== undefined && fi['months'] !== null) checkMonths(fi['months'], `${base}.fiatal25.months`, f);
  }
  const hz = k['elsoHazasok'];
  if (hz !== undefined && hz !== null) {
    if (!isPlainObject(hz)) f[`${base}.elsoHazasok`] = 'Hibás kedvezmény.';
    else {
      checkMonths(hz['months'], `${base}.elsoHazasok.months`, f);
      const max = rules?.allowances.elsoHazasokMonthlyHuf ?? 33_335;
      const mh = hz['monthlyHuf'];
      if (!isSafeInt(mh) || mh < 0 || mh > max) f[`${base}.elsoHazasok.monthlyHuf`] = `Az első házasok kedvezménye havonta 0 és ${max} Ft között lehet.`;
    }
  }
  const cs = k['csaladi'];
  if (cs !== undefined && cs !== null) {
    if (!isPlainObject(cs)) f[`${base}.csaladi`] = 'Hibás kedvezmény.';
    else {
      if (typeof cs['csjkInYear'] !== 'boolean') f[`${base}.csaladi.csjkInYear`] = 'Igen/nem érték kell.';
      const months = cs['months'];
      if (!Array.isArray(months)) f[`${base}.csaladi.months`] = 'A hónapok listája kell.';
      else {
        const seen = new Set<number>();
        months.forEach((m: unknown, i: number) => {
          const key = `${base}.csaladi.months[${i}]`;
          if (!isPlainObject(m)) return void (f[key] = 'Hibás hónap.');
          if (!isMonth(m['month'])) f[`${key}.month`] = 'A hónap 1 és 12 közötti egész szám lehet.';
          else if (seen.has(m['month'])) f[`${key}.month`] = 'Egy hónap csak egyszer szerepelhet.';
          else seen.add(m['month']);
          const children = m['children'];
          if (!Array.isArray(children) || children.length > 20 || !children.every(isPlainObject)) f[`${key}.children`] = 'A gyermekek listája kell.';
          const el = m['eltartott'];
          if (!isSafeInt(el) || el < 0 || el > 30) f[`${key}.eltartott`] = 'Az eltartottak száma 0 és 30 közötti egész szám.';
          else if (Array.isArray(children) && el < children.length) f[`${key}.eltartott`] = 'Az eltartottak száma nem lehet kevesebb a kedvezményezett gyermekekénél.';
          const sp = m['sharePct'];
          if (sp !== undefined && sp !== null && (!isSafeInt(sp) || sp < 0 || sp > 100)) f[`${key}.sharePct`] = 'A megosztás 0 és 100% között lehet.';
        });
      }
    }
  }
}
