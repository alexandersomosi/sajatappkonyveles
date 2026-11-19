// SPEC §28.3 – personal allowances 2026: the client's answers (allowance_answers), the server's proposal per kind and the
// accountant's decision (client_allowances). Only approved, in-year items reach the engine (allowancesForEngine). No
// names, child birth dates, TAJ or tax ids are ever asked or stored; health flags only with explicit consent.
import { createHash } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type {
  AccAllowanceItem,
  AccAllowanceView,
  AllowanceAnswers,
  AllowanceClientPreview,
  AllowanceDecisionInput,
  AllowanceItemView,
  AllowanceParams,
  AllowancePreview,
  AllowancePreviewInput,
  AllowanceState,
  CsaladiMonthParam,
} from '../_shared/api.js';
import { ALLOWANCE_CLIENT_LINES, ALLOWANCE_DOCUMENTS_TO_KEEP, ALLOWANCE_LABELS, ALLOWANCE_REJECT_REASON_LABELS, ANYAK_LABELS, ALLOWANCE_TEXTS } from '../_shared/bekotes.js';
import { ALLOWANCE_KINDS, ALLOWANCE_LIMITS, ALLOWANCE_PENDING_STATUSES, type AllowanceKind, type AllowanceStatus, type TaxStatus } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { allowanceAnswers, clientAllowances, messages } from '../db/schema.js';
import { audit } from '../audit.js';
import { E } from '../lib/errors.js';
import { todayBudapest } from '../lib/dates.js';
import { accountantParams, notify } from '../notify/notify.js';
import { calculateYear, RULES_2026, rulesForYear, type AllowancesInput, type TaxProfileInput, type YearInput } from '../tax/engine.js';
import { accountantUserOf } from './team.js';
import { clientName, type ClientRow } from './people.js';

export type AllowanceRow = typeof clientAllowances.$inferSelect;
export type AnswersRow = typeof allowanceAnswers.$inferSelect;
type EngineKind = Exclude<AllowanceKind, 'csed_gyed'>;
export const HEALTH_CONSENT_VERSION = '2026-11-19';

const MONTH_NAMES = ALLOWANCE_TEXTS.monthNames;
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const range = (a: number, b: number) => (a > b ? [] : Array.from({ length: b - a + 1 }, (_, i) => a + i));
const ym = (s: string | null | undefined): { y: number; m: number } | null => {
  const mt = /^(\d{4})-(\d{2})$/.exec(s ?? '');
  return mt ? { y: Number(mt[1]), m: Number(mt[2]) } : null;
};
/** absolute month index (year × 12 + month − 1) */
const idx = (y: number, m: number) => y * 12 + m - 1;

/** "január–december", "július–december", "március, május" */
export function monthsText(months: readonly number[]): string {
  const ms = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!ms.length) return '';
  const runs: [number, number][] = [];
  for (const m of ms) {
    const last = runs[runs.length - 1];
    if (last && last[1] === m - 1) last[1] = m;
    else runs.push([m, m]);
  }
  return runs.map(([a, b]) => (a === b ? MONTH_NAMES[a - 1]! : `${MONTH_NAMES[a - 1]}–${MONTH_NAMES[b - 1]}`)).join(', ');
}

export function hasHealthAnswers(a: AllowanceAnswers): boolean {
  return Boolean(a.disability) || a.children.some((c) => c.tartosBeteg);
}

/** Drops every health flag (consent missing or withdrawn). */
export function withoutHealth(a: AllowanceAnswers): AllowanceAnswers {
  return { ...a, disability: null, children: a.children.map((c) => ({ ...c, tartosBeteg: false })), healthConsent: false };
}

// ---------------------------------------------------------------------------------------------------------------------
// §28.3.3 proposal rules (pure)
// ---------------------------------------------------------------------------------------------------------------------
export interface Proposal {
  kind: AllowanceKind;
  months: number[];
  params: AllowanceParams;
  reasons: string[];
  warnings: string[];
}

/** Months of the year in which a child's családi pótlék runs (kezdete / vége only when they fall in this year). */
function childMonths(c: AllowanceAnswers['children'][number], year: number): number[] {
  const k = ym(c.potlekKezdeteHo);
  const v = ym(c.potlekVegeHo);
  const from = k && k.y === year ? k.m : k && k.y > year ? 13 : 1;
  const to = v && v.y === year ? v.m : v && v.y < year ? 0 : 12;
  return range(from, to);
}

/** Pregnancy: from the month of day 91 (due date − 189 days, [KÖNYVELŐ]) until the month before the birth month. */
function pregnancyMonths(p: AllowanceAnswers['pregnancy'], year: number): { months: number[]; birthMonth: number | null; d91Month: number | null } {
  const d = ym(p?.dueMonth ?? null);
  if (!d) return { months: [], birthMonth: null, d91Month: null };
  const due = Date.UTC(d.y, d.m - 1, 15);
  const d91 = new Date(due - 189 * 86_400_000);
  const startIdx = idx(d91.getUTCFullYear(), d91.getUTCMonth() + 1);
  const birthIdx = idx(d.y, d.m);
  const months = ALL.filter((m) => idx(year, m) >= startIdx && idx(year, m) < birthIdx);
  return { months, birthMonth: d.y === year ? d.m : null, d91Month: d91.getUTCFullYear() === year ? d91.getUTCMonth() + 1 : null };
}

export function proposeAllowances(a: AllowanceAnswers, year: number, status: TaxStatus, rules = rulesForYear(year) ?? RULES_2026): Proposal[] {
  const out: Proposal[] = [];
  const ar = rules.allowances;
  const birth = ym(a.birthMonth);
  const preg = pregnancyMonths(a.pregnancy, year);
  const own = a.children.filter((c) => c.sajat);
  // 25 év alattiak
  if (birth) {
    const months = birth.y + ar.fiatal25AgeYears > year ? ALL : birth.y + ar.fiatal25AgeYears === year ? range(1, birth.m) : [];
    if (months.length) out.push({ kind: 'fiatal25', months, params: {}, reasons: [`Született: ${birth.y}. ${MONTH_NAMES[birth.m - 1]}; ${months.length === 12 ? 'egész évben' : `${monthsText(months)}`} 25 év alatti.`], warnings: [] });
  }
  // 30 év alatti anyák
  const anya30Kids = own.filter((c) => c.potlek === 'most');
  if (a.mother && (anya30Kids.length || preg.months.length || preg.birthMonth) && birth && birth.y >= year - ar.anya30AgeYears) {
    const set = new Set<number>();
    for (const c of anya30Kids) for (const m of childMonths(c, year)) set.add(m);
    for (const m of preg.months) set.add(m);
    if (preg.birthMonth) for (const m of range(preg.birthMonth, 12)) set.add(m); // the child's months take over
    const months = [...set].sort((x, y) => x - y);
    if (months.length)
      out.push({
        kind: 'anya30',
        months,
        params: {},
        reasons: [`${birth.y}-ban született, családi kedvezményre jogosító saját gyermek${preg.months.length ? ' vagy magzat (91. naptól)' : ''}.`],
        warnings: preg.months.length ? ['A várandósság 91. napját az orvosi igazolás alapján ellenőrizd.'] : [],
      });
  }
  // 2 / 3 / 4+ gyermekes anyák
  if (a.mother) {
    const counted = own.filter((c) => c.potlek === 'most' || c.potlek === 'tizenket_ev' || c.potlek === 'elhunyt');
    const n = counted.length;
    let jogcim: 'ket' | 'harom' | 'negyplusz' | null = n >= 4 ? 'negyplusz' : n === 3 ? 'harom' : n === 2 ? 'ket' : null;
    const warnings: string[] = [];
    if (jogcim === 'ket' && ar.ketgyermekesMinBirthYear !== null && (!birth || birth.y < ar.ketgyermekesMinBirthYear)) {
      jogcim = null;
    }
    if (jogcim) {
      // from the month the n-th child arrived this year
      const arrivals = counted.map((c) => ym(c.potlekKezdeteHo)).filter((x): x is { y: number; m: number } => Boolean(x && x.y === year)).map((x) => x.m);
      const from = arrivals.length === counted.length || (arrivals.length && counted.length - arrivals.length < (jogcim === 'ket' ? 2 : jogcim === 'harom' ? 3 : 4)) ? Math.max(...arrivals) : 1;
      const reasons = [`${n} saját gyermek, akire családi pótlékot kap vagy legalább 12 évig kapott.`];
      if (out.some((p) => p.kind === 'anya30')) reasons.push('A 30 év alattiak kedvezménye után ehhez nem marad alap.');
      out.push({ kind: 'anyak', months: range(from, 12), params: { anyakJogcim: jogcim }, reasons, warnings });
    }
  }
  // családi kedvezmény (+ csjk)
  if (a.csaladiWho === 'en' || a.csaladiWho === 'kozosen') {
    const share = a.csaladiWho === 'en' ? 100 : Math.min(ALLOWANCE_LIMITS.sharePctMax, Math.max(ALLOWANCE_LIMITS.sharePctMin, a.csaladiSharePct ?? 50));
    const params: CsaladiMonthParam[] = [];
    for (const m of ALL) {
      const kids = a.children.filter((c) => c.potlek === 'most' && childMonths(c, year).includes(m)).map((c) => ({ felvaltva: Boolean(c.felvaltva), tartosBeteg: Boolean(c.tartosBeteg && a.healthConsent) }));
      if (preg.months.includes(m)) kids.push({ felvaltva: false, tartosBeteg: false });
      if (!kids.length) continue;
      params.push({ month: m, eltartott: kids.length + Math.max(0, a.otherDependants), children: kids, sharePct: share });
    }
    if (params.length)
      out.push({
        kind: 'csaladi',
        months: params.map((p) => p.month),
        params: { csaladi: params, csjkInYear: status !== 'nyugdijas' && a.csjkWish === 'igen' },
        reasons: [`${Math.max(...params.map((p) => p.children.length))} kedvezményezett, ${Math.max(...params.map((p) => p.eltartott))} eltartott${share !== 100 ? `, megosztva: ${share}%` : ''}.`],
        warnings: a.csjkWish === 'konyvelo_donti' ? ['Az év közbeni családi járulékkedvezményről te döntesz (a 2658-ban az SZJA-előleget is be kell vallani).'] : [],
      });
  }
  // első házasok
  const mar = a.marriage && a.marriage.first ? ym(a.marriage.month) : null;
  if (mar && a.marriage && a.marriage.who !== 'par') {
    const start = idx(mar.y, mar.m) + 1;
    const end = start + ALLOWANCE_LIMITS.elsoHazasokMaxMonths - 1;
    const months = ALL.filter((m) => idx(year, m) >= start && idx(year, m) <= end);
    const monthly = a.marriage.who === 'en' ? ar.elsoHazasokMonthlyHuf : Math.ceil(ar.elsoHazasokMonthlyHuf / 2);
    if (months.length)
      out.push({
        kind: 'elso_hazasok',
        months,
        params: { elsoHazasokMonthlyHuf: monthly },
        reasons: [`Esküvő: ${mar.y}. ${MONTH_NAMES[mar.m - 1]}, legalább egyiküknek első házasság.`],
        warnings: birth && birth.y + ar.fiatal25AgeYears > year ? ['Ha mindketten 25 év alattiak, az első házasok kedvezménye csak az egyikük 25. születésnapja utáni hónaptól jár – nézd meg.'] : [],
      });
  }
  // személyi (health: only with consent)
  if (a.disability && a.healthConsent) {
    const f = ym(a.disability.fromMonth);
    const from = f && f.y === year ? f.m : f && f.y > year ? 13 : 1;
    const months = range(from, 12);
    if (months.length) out.push({ kind: 'szemelyi', months, params: {}, reasons: [`Alap: ${a.disability.basis === 'orvosi_igazolas' ? 'orvosi igazolás' : a.disability.basis === 'rokkantsagi_jaradek' ? 'rokkantsági járadék' : 'fogyatékossági támogatás'}.`], warnings: [] });
  }
  // táppénz / CSED / GYED (info item → kieső idő)
  if (a.benefit) {
    const f = ym(a.benefit.fromMonth);
    const t = ym(a.benefit.toMonth);
    if (f) {
      const months = ALL.filter((m) => idx(year, m) >= idx(f.y, f.m) && (!t || idx(year, m) <= idx(t.y, t.m)));
      if (months.length) out.push({ kind: 'csed_gyed', months, params: {}, reasons: ['Táppénz, CSED vagy GYED – kieső időként kell felvenni az adóprofilba.'], warnings: [] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// engine mapping (§28.3.7 e)
// ---------------------------------------------------------------------------------------------------------------------
function effective(r: AllowanceRow): { months: number[]; params: AllowanceParams; inYear: boolean } | null {
  if (r.status === 'jovahagyva') return { months: r.months, params: r.params, inYear: r.inYear };
  // SPEC §28.3.2: an approved kind whose proposal changed keeps its old decision until the accountant decides again.
  if ((r.status === 'javasolt' || r.status === 'kerdes') && r.paramsPrev?.status === 'jovahagyva') return { months: r.paramsPrev.months, params: r.paramsPrev.params, inYear: r.paramsPrev.inYear };
  return null;
}

export function toEngineInput(rows: { kind: AllowanceKind; months: number[]; params: AllowanceParams; inYear: boolean }[], birthMonth: string | null): AllowancesInput | undefined {
  const k: AllowancesInput = {};
  if (birthMonth) k.birthMonth = birthMonth;
  let any = false;
  for (const r of rows) {
    if (!r.inYear || !r.months.length) continue;
    const months = [...new Set(r.months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
    switch (r.kind) {
      case 'anya30':
        k.anya30 = { months };
        break;
      case 'anyak':
        k.anyak = { jogcim: r.params.anyakJogcim ?? 'negyplusz', months };
        break;
      case 'fiatal25':
        k.fiatal25 = { months };
        break;
      case 'szemelyi':
        k.szemelyi = { months };
        break;
      case 'elso_hazasok':
        k.elsoHazasok = { months, monthlyHuf: Math.min(RULES_2026.allowances.elsoHazasokMonthlyHuf, Math.max(0, r.params.elsoHazasokMonthlyHuf ?? RULES_2026.allowances.elsoHazasokMonthlyHuf)) };
        break;
      case 'csaladi': {
        const cm = (r.params.csaladi ?? []).filter((p) => months.includes(p.month));
        if (!cm.length) continue;
        k.csaladi = { months: cm.map((p) => ({ month: p.month, eltartott: Math.max(p.eltartott, p.children.length), children: p.children, sharePct: p.sharePct })), csjkInYear: Boolean(r.params.csjkInYear) };
        break;
      }
      default:
        continue;
    }
    any = true;
  }
  return any ? k : undefined;
}

export async function answersRow(db: DbOrTx, clientId: string, year: number): Promise<AnswersRow | null> {
  const [r] = await db.select().from(allowanceAnswers).where(and(eq(allowanceAnswers.clientId, clientId), eq(allowanceAnswers.year, year))).limit(1);
  return r ?? null;
}

export async function allowanceRows(db: DbOrTx, clientId: string, year: number): Promise<AllowanceRow[]> {
  return db.select().from(clientAllowances).where(and(eq(clientAllowances.clientId, clientId), eq(clientAllowances.year, year)));
}

/** SPEC §28.3.7 e: the APPROVED, in-year allowances of the client's year for the engine (undefined = none). */
export async function allowancesForEngine(db: DbOrTx, clientId: string, year: number): Promise<AllowancesInput | undefined> {
  const rows = await allowanceRows(db, clientId, year);
  const eff = rows.map((r) => ({ r, e: effective(r) })).filter((x) => x.e && x.r.kind !== 'csed_gyed');
  if (!eff.length) return undefined;
  const ans = await answersRow(db, clientId, year);
  return toEngineInput(
    eff.map((x) => ({ kind: x.r.kind, ...x.e! })),
    ans?.answers?.birthMonth ?? null,
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// effect estimates
// ---------------------------------------------------------------------------------------------------------------------
function sums(input: YearInput): { szja: number; tb: number; szocho: number } {
  const r = calculateYear(input);
  let szja = 0;
  let tb = 0;
  let szocho = 0;
  for (const q of r.quarters) {
    szja += q.szjaAdvanceHuf;
    tb += q.tbHuf;
    szocho += q.szochoHuf;
  }
  return { szja, tb, szocho };
}

function withKedv(input: YearInput, k: AllowancesInput | undefined, asOf?: string): YearInput {
  const { kedvezmenyek: _k, allowances: _l, ...rest } = input.profile as TaxProfileInput;
  void _k;
  void _l;
  return { ...input, ...(asOf ? { asOf } : {}), profile: { ...rest, ...(k ? { kedvezmenyek: k } : {}) } as TaxProfileInput };
}

/** SZJA + TB saved by `k` against no allowance, for the year's revenue known so far (asOf = year end, or `asOf`). */
export function savedBy(input: YearInput, k: AllowancesInput | undefined, asOf?: string): number {
  if (!k) return 0;
  try {
    const a = sums(withKedv(input, undefined, asOf));
    const b = sums(withKedv(input, k, asOf));
    return Math.max(0, a.szja + a.tb - (b.szja + b.tb));
  } catch {
    return 0;
  }
}

const round1000 = (n: number) => Math.round(n / 1000) * 1000;

// ---------------------------------------------------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------------------------------------------------
function labelOf(kind: AllowanceKind, params: AllowanceParams): string {
  if (kind === 'anyak' && params.anyakJogcim) return ANYAK_LABELS[params.anyakJogcim];
  return ALLOWANCE_LABELS[kind];
}

async function itemView(deps: Deps, r: AllowanceRow, firstName: string, effectYearHuf: number | null): Promise<AllowanceItemView> {
  const months = r.months;
  const mt = monthsText(months);
  let statusText: string;
  switch (r.status) {
    case 'javasolt':
      statusText = await deps.content.render('kedvezmeny.allapot.javasolt', { firstName });
      break;
    case 'kerdes':
      statusText = await deps.content.render('kedvezmeny.allapot.kerdes', { firstName, question: r.clientText ?? '' });
      break;
    case 'jovahagyva':
      statusText = r.inYear
        ? await deps.content.render('kedvezmeny.allapot.jovahagyva', { monthsText: mt, effectYear: fmt(round1000(effectYearHuf ?? 0)) })
        : await deps.content.render('kedvezmeny.allapot.jovahagyva_ev_vegen', {});
      break;
    case 'elutasitva':
      statusText = await deps.content.render('kedvezmeny.allapot.elutasitva', { rejectText: r.clientText || (r.rejectReason ? ALLOWANCE_REJECT_REASON_LABELS[r.rejectReason] : '') });
      break;
    default:
      statusText = '';
  }
  return {
    kind: r.kind,
    label: labelOf(r.kind, r.params),
    line: await deps.content.render(`kedvezmeny.sor.${r.kind}`, {}),
    status: r.status,
    statusText,
    months,
    monthsText: mt,
    inYear: r.inYear,
    effectYearHuf: r.status === 'jovahagyva' ? effectYearHuf : null,
    question: r.status === 'kerdes' ? r.clientText : null,
    rejectText: r.status === 'elutasitva' ? r.clientText || (r.rejectReason ? ALLOWANCE_REJECT_REASON_LABELS[r.rejectReason] : null) : null,
  };
}

/** Whole forints with a space between every 3 digits, also for 4 digits ("1 000", "4 999"; Intl hu-HU writes "1000"). */
export function fmt(n: number): string {
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return r < 0 ? `-${s}` : s;
}

function documentsToKeep(a: AllowanceAnswers | null, kinds: AllowanceKind[]): string[] {
  const out: string[] = [];
  if (kinds.includes('csaladi') || kinds.includes('anyak') || kinds.includes('anya30')) out.push(ALLOWANCE_DOCUMENTS_TO_KEEP.csaladi_potlek);
  if (kinds.includes('elso_hazasok')) out.push(ALLOWANCE_DOCUMENTS_TO_KEEP.hazassagi_anyakonyvi);
  if (kinds.includes('szemelyi') || a?.pregnancy || a?.children.some((c) => c.tartosBeteg)) out.push(ALLOWANCE_DOCUMENTS_TO_KEEP.orvosi_igazolas);
  if (a?.children.some((c) => c.felvaltva)) out.push(ALLOWANCE_DOCUMENTS_TO_KEEP.felvaltva_dontes);
  return out;
}

const visibleToClient = (r: AllowanceRow) => r.status !== 'visszavonva';

export async function pendingAllowances(db: DbOrTx, clientId: string, year?: number): Promise<number> {
  const rows = await db
    .select({ id: clientAllowances.id })
    .from(clientAllowances)
    .where(and(eq(clientAllowances.clientId, clientId), inArray(clientAllowances.status, [...ALLOWANCE_PENDING_STATUSES]), year ? eq(clientAllowances.year, year) : undefined));
  return rows.length;
}

export interface AllowanceCtx {
  input: YearInput | null;
  firstName: string;
  regime: 'atalany' | 'kata';
}

export async function allowanceState(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, ctx: AllowanceCtx): Promise<AllowanceState> {
  const ans = await answersRow(db, cl.id, year);
  const rows = (await allowanceRows(db, cl.id, year)).filter(visibleToClient).sort((a, b) => ALLOWANCE_KINDS.indexOf(a.kind) - ALLOWANCE_KINDS.indexOf(b.kind));
  const birth = ans?.answers?.birthMonth ?? null;
  const items: AllowanceItemView[] = [];
  for (const r of rows) {
    const k = r.status === 'jovahagyva' ? toEngineInput([{ kind: r.kind, months: r.months, params: r.params, inYear: r.inYear }], birth) : undefined;
    items.push(await itemView(deps, r, ctx.firstName, ctx.input && k ? savedBy(ctx.input, k) : r.status === 'jovahagyva' ? 0 : null));
  }
  const approved = rows.filter((r) => r.status === 'jovahagyva');
  const allK = approved.length ? toEngineInput(approved.map((r) => ({ kind: r.kind, months: r.months, params: r.params, inYear: r.inYear })), birth) : undefined;
  const today = todayBudapest(deps.now());
  return {
    year,
    gate: ans?.gate ?? null,
    answers: ans?.answers ?? null,
    version: ans?.version ?? 0,
    submittedAt: ans?.submittedAt?.toISOString() ?? null,
    items,
    pendingCount: rows.filter((r) => ALLOWANCE_PENDING_STATUSES.includes(r.status)).length,
    savedYtdHuf: allK && ctx.input ? round1000(savedBy(ctx.input, allK, today < `${year}-12-31` ? today : undefined)) : null,
    savedYearHuf: allK && ctx.input ? round1000(savedBy(ctx.input, allK)) : null,
    documentsToKeep: documentsToKeep(ans?.answers ?? null, rows.map((r) => r.kind)),
    canEdit: ctx.regime !== 'kata' && !cl.serviceLock,
    ...(ctx.regime === 'kata' ? { notForRegime: true } : {}),
  };
}

/** K12 preview: what the answers would save this year (never stored). */
export function clientPreview(input: YearInput | null, answers: AllowanceAnswers, year: number, status: TaxStatus): AllowanceClientPreview {
  const props = proposeAllowances(answers, year, status);
  return {
    items: props.map((p) => {
      if (p.kind === 'csed_gyed') return { kind: p.kind, label: ALLOWANCE_LABELS[p.kind], effectYearHuf: null, onlyAnnual: false };
      const inYear = p.kind !== 'csaladi' || true;
      const k = toEngineInput([{ kind: p.kind, months: p.months, params: p.params, inYear }], answers.birthMonth);
      const eff = input && k ? round1000(savedBy(input, k)) : null;
      return { kind: p.kind, label: labelOf(p.kind, p.params), effectYearHuf: eff, onlyAnnual: !input || eff === 0 };
    }),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// writes
// ---------------------------------------------------------------------------------------------------------------------
const sameDecision = (a: { months: number[]; params: AllowanceParams }, b: { months: number[]; params: AllowanceParams }) =>
  JSON.stringify([...a.months].sort((x, y) => x - y)) === JSON.stringify([...b.months].sort((x, y) => x - y)) && JSON.stringify(a.params) === JSON.stringify(b.params);

export function answersHash(a: AllowanceAnswers): string {
  return createHash('sha256').update(JSON.stringify(a)).digest('hex').slice(0, 16);
}

/**
 * PUT /client/allowances/answers. `submit: false` = a draft; `true` = proposal + statuses + notification. Health answers
 * without the consent box are refused (400) – nothing of them is stored.
 */
export async function saveAnswers(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, answers0: AllowanceAnswers, submit: boolean, status: TaxStatus, by: { userId: string }): Promise<void> {
  let answers = answers0;
  if (hasHealthAnswers(answers) && !answers.healthConsent)
    throw E.validation({ healthConsent: 'Ha nem jelölöd be, ezt nem mentjük el, és most nem tudjuk beszámolni. Az éves bevallásban akkor is érvényesítheted.' });
  if (!hasHealthAnswers(answers)) answers = { ...answers, healthConsent: false };
  const now = deps.now();
  const prev = await answersRow(db, cl.id, year);
  const consentGiven = answers.healthConsent && !prev?.healthConsentAt;
  const consentWithdrawn = !answers.healthConsent && Boolean(prev?.healthConsentAt);
  const version = (prev?.version ?? 0) + (submit ? 1 : 0);
  const values = {
    answers,
    version,
    ...(submit ? { submittedAt: now, gate: 'lehet' as const } : {}),
    healthConsentAt: answers.healthConsent ? (prev?.healthConsentAt ?? now) : null,
    healthConsentVersion: answers.healthConsent ? HEALTH_CONSENT_VERSION : null,
    updatedAt: now,
  };
  if (prev) await db.update(allowanceAnswers).set(values).where(eq(allowanceAnswers.id, prev.id));
  else await db.insert(allowanceAnswers).values({ clientId: cl.id, year, ...values, createdAt: now });
  if (consentGiven || consentWithdrawn)
    await audit(db, { action: 'allowance.health_consent', actorUserId: by.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { given: consentGiven } });
  if (!submit) return;

  const props = proposeAllowances(answers, year, status);
  const rows = await allowanceRows(db, cl.id, year);
  const kinds: AllowanceKind[] = [];
  for (const p of props) {
    kinds.push(p.kind);
    const ex = rows.find((r) => r.kind === p.kind);
    const proposal = { months: p.months, params: p.params, reasons: p.reasons, warnings: p.warnings };
    if (!ex) {
      await db.insert(clientAllowances).values({ clientId: cl.id, year, kind: p.kind, status: 'javasolt', months: p.months, params: p.params, inYear: true, proposal, answersVersion: version, createdAt: now, updatedAt: now });
      continue;
    }
    const changed = !sameDecision({ months: ex.months, params: ex.params }, p);
    let next: Partial<AllowanceRow> = { proposal, answersVersion: version, updatedAt: now };
    if (ex.status === 'jovahagyva') {
      if (changed) next = { ...next, status: 'javasolt', paramsPrev: { status: 'jovahagyva', months: ex.months, params: ex.params, inYear: ex.inYear }, months: p.months, params: p.params };
    } else if (ex.status === 'visszavonva' || ex.status === 'javasolt' || (ex.status === 'elutasitva' && changed)) {
      next = { ...next, status: 'javasolt', months: p.months, params: p.params };
    } else if (ex.status === 'kerdes') {
      next = { ...next, months: p.months, params: p.params };
    }
    await db.update(clientAllowances).set(next).where(eq(clientAllowances.id, ex.id));
  }
  for (const r of rows) if (!kinds.includes(r.kind) && r.status !== 'visszavonva') await db.update(clientAllowances).set({ status: 'visszavonva', updatedAt: now }).where(eq(clientAllowances.id, r.id));
  if (!props.length) await db.update(allowanceAnswers).set({ gate: 'nem_jar' }).where(and(eq(allowanceAnswers.clientId, cl.id), eq(allowanceAnswers.year, year)));
  await audit(db, { action: 'allowance.answers_submitted', actorUserId: by.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { version, kinds, hash: answersHash(answers) } });
  const pending = await pendingAllowances(db, cl.id, year);
  const acc = await accountantUserOf(db, cl);
  if (acc && pending > 0) await notify(deps, db, { userId: acc.userId, kind: 'allowance_submitted', params: { clientName: clientName(cl), n: pending }, link: `/ugyfelek/${cl.id}?tab=kedvezmenyek` });
}

export async function setGate(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, gate: 'lehet' | 'nem_jar' | 'kesobb', by: { userId: string }): Promise<void> {
  const prev = await answersRow(db, cl.id, year);
  const now = deps.now();
  if (prev) await db.update(allowanceAnswers).set({ gate, updatedAt: now }).where(eq(allowanceAnswers.id, prev.id));
  else await db.insert(allowanceAnswers).values({ clientId: cl.id, year, gate, createdAt: now, updatedAt: now });
  await audit(db, { action: 'allowance.gate', actorUserId: by.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { gate } });
}

function validateDecision(kind: AllowanceKind, d: AllowanceDecisionInput): void {
  const f: Record<string, string> = {};
  if (d.months && !d.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)) f.months = 'A hónap 1 és 12 közötti szám.';
  if (d.params?.elsoHazasokMonthlyHuf !== undefined && (d.params.elsoHazasokMonthlyHuf < 0 || d.params.elsoHazasokMonthlyHuf > ALLOWANCE_LIMITS.elsoHazasokMonthlyMaxHuf)) f['params.elsoHazasokMonthlyHuf'] = `0 és ${fmt(ALLOWANCE_LIMITS.elsoHazasokMonthlyMaxHuf)} Ft között.`;
  for (const [i, p] of (d.params?.csaladi ?? []).entries()) {
    if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) f[`params.csaladi.${i}.month`] = 'A hónap 1 és 12 közötti szám.';
    if (p.eltartott < p.children.length) f[`params.csaladi.${i}.eltartott`] = 'Az eltartottak száma nem lehet kevesebb a kedvezményezetteknél.';
    if (p.sharePct < 0 || p.sharePct > 100) f[`params.csaladi.${i}.sharePct`] = '0 és 100% között.';
  }
  if (d.status === 'kerdes' && !d.clientText?.trim()) f.clientText = 'Írd meg a kérdésedet.';
  if (d.status === 'elutasitva' && !d.reason) f.reason = 'Válassz okot.';
  if (kind === 'anyak' && d.params?.anyakJogcim && !['ket', 'harom', 'negyplusz'].includes(d.params.anyakJogcim)) f['params.anyakJogcim'] = 'Hibás jogcím.';
  if (Object.keys(f).length) throw E.validation(f);
}

/** POST /acc/clients/:id/allowances/:kind/decision */
export async function decide(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, kind: AllowanceKind, d: AllowanceDecisionInput, actor: { userId: string; role: string }): Promise<void> {
  validateDecision(kind, d);
  const [row] = await db.select().from(clientAllowances).where(and(eq(clientAllowances.clientId, cl.id), eq(clientAllowances.year, year), eq(clientAllowances.kind, kind))).limit(1).for('update');
  if (!row) throw E.notFound();
  if (row.status === 'visszavonva') throw E.conflict('Ezt a kedvezményt az ügyfél már nem kéri.');
  const now = deps.now();
  const patch: Partial<AllowanceRow> = {
    status: d.status,
    decidedBy: actor.userId,
    decidedAt: now,
    updatedAt: now,
    ...(d.months ? { months: [...new Set(d.months)].sort((a, b) => a - b) } : {}),
    ...(d.params ? { params: { ...row.params, ...d.params } } : {}),
    ...(d.inYear !== undefined ? { inYear: d.inYear } : {}),
    ...(d.staffNote !== undefined ? { staffNote: d.staffNote.slice(0, ALLOWANCE_LIMITS.staffNoteMaxChars) } : {}),
    clientText: d.clientText?.trim().slice(0, ALLOWANCE_LIMITS.clientTextMaxChars) || null,
    rejectReason: d.status === 'elutasitva' ? (d.reason ?? 'egyeb') : null,
    paramsPrev: d.status === 'kerdes' ? row.paramsPrev : null,
  };
  await db.update(clientAllowances).set(patch).where(eq(clientAllowances.id, row.id));
  await audit(db, { action: 'allowance.decided', actorUserId: actor.userId, actorRole: actor.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { kind, status: d.status, months: (patch.months ?? row.months).length } });
  const params = await accountantParams(db, cl.accountantId);
  if (d.status === 'kerdes') {
    await db.insert(messages).values({ clientId: cl.id, senderUserId: actor.userId, senderRole: 'accountant', kind: 'szoveg', body: `${ALLOWANCE_LABELS[kind]}: ${patch.clientText}`, readByAccountantAt: now });
  }
  const variant = d.status === 'jovahagyva' ? 'jovahagyva' : d.status === 'kerdes' ? 'kerdes' : 'elutasitva';
  await notify(deps, db, { userId: cl.userId, kind: 'allowance_decided', variant, params: { ...params, label: labelOf(kind, patch.params ?? row.params) }, link: '/kedvezmenyek' });
}

/** The accountant's panel view (§28.3.6). */
export async function accAllowanceView(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, legacy: { kind: string; note?: string }[], input: YearInput | null): Promise<AccAllowanceView> {
  const ans = await answersRow(db, cl.id, year);
  const rows = (await allowanceRows(db, cl.id, year)).sort((a, b) => ALLOWANCE_KINDS.indexOf(a.kind) - ALLOWANCE_KINDS.indexOf(b.kind));
  const fn = (await accountantUserOf(db, cl))?.firstName ?? 'A könyvelőd';
  const birth = ans?.answers?.birthMonth ?? null;
  const items: AccAllowanceItem[] = [];
  for (const r of rows) {
    const k = toEngineInput([{ kind: r.kind, months: r.months, params: r.params, inYear: r.inYear }], birth);
    const base = await itemView(deps, r, fn, input && k ? savedBy(input, k) : null);
    const engineWarnings: string[] = [];
    if (input && k) {
      try {
        const res = calculateYear(withKedv(input, k, `${year}-12-31`));
        for (const w of res.warnings) if (w.audience === 'konyvelo' && /kedvezmeny|anya|fiatal25|csjk|elso_hazasok/.test(w.code)) engineWarnings.push(w.text);
      } catch {
        /* ignore */
      }
    }
    items.push({
      ...base,
      params: r.params,
      paramsPrev: r.paramsPrev?.params ?? null,
      proposal: { months: r.proposal?.months ?? r.months, params: r.proposal?.params ?? r.params, reasons: r.proposal?.reasons ?? [] },
      decidedBy: r.decidedBy,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      staffNote: r.staffNote,
      warnings: [...(r.proposal?.warnings ?? []), ...engineWarnings],
      documents: documentsToKeep(ans?.answers ?? null, [r.kind]).map((label) => ({ label, keep: true })),
    });
  }
  return { year, answers: ans?.answers ?? null, version: ans?.version ?? 0, submittedAt: ans?.submittedAt?.toISOString() ?? null, healthConsentAt: ans?.healthConsentAt?.toISOString() ?? null, legacy, items };
}

/** POST …/allowances/preview: the effect of the decisions being edited (never stored). */
export function staffPreview(input: YearInput, decisions: AllowancePreviewInput['decisions'], birthMonth: string | null): AllowancePreview {
  const year = input.profile.year;
  const k = toEngineInput(decisions.map((d) => ({ kind: d.kind, months: d.months, params: d.params ?? {}, inYear: d.inYear })), birthMonth);
  const end = `${year}-12-31`;
  const base = withKedv(input, undefined, end);
  const without = sums(base);
  let withS = without;
  let unused = 0;
  let potential = 0;
  const warnings: string[] = [];
  if (k) {
    const r = calculateYear(withKedv(input, k, end));
    withS = { szja: 0, tb: 0, szocho: 0 };
    for (const q of r.quarters) {
      withS.szja += q.szjaAdvanceHuf;
      withS.tb += q.tbHuf;
      withS.szocho += q.szochoHuf;
    }
    unused = r.allowances?.csaladiUnusedHuf ?? 0;
    potential = r.allowances?.annualCsjkPotentialHuf ?? 0;
    for (const w of r.warnings) if (w.audience === 'konyvelo' && !/mellekallas_condition|garantalt_minimum|received_on_estimated/.test(w.code)) warnings.push(w.text);
  }
  const byKind = decisions
    .filter((d) => d.kind !== 'csed_gyed')
    .map((d) => {
      const one = toEngineInput([{ kind: d.kind, months: d.months, params: d.params ?? {}, inYear: d.inYear }], birthMonth);
      if (!one) return { kind: d.kind, szjaSavedHuf: 0, csjkHuf: 0 };
      const r = calculateYear(withKedv(input, one, end));
      return { kind: d.kind, szjaSavedHuf: r.allowances?.szjaSavedHuf ?? 0, csjkHuf: r.allowances?.csjkHuf ?? 0 };
    });
  const dto = (x: { szja: number; tb: number; szocho: number }) => ({ szjaHuf: x.szja, tbHuf: x.tb, szochoHuf: x.szocho });
  return {
    without: dto(without),
    with: dto(withS),
    savedHuf: Math.max(0, without.szja + without.tb - withS.szja - withS.tb),
    byKind,
    csaladiUnusedHuf: unused,
    annualCsjkPotentialHuf: potential,
    warnings,
  };
}

/** For the Főoldal hint (§28.3.4 point 3): gate 'kesobb' or none, active client. */
export async function allowancesHint(db: DbOrTx, cl: ClientRow, year: number): Promise<{ show: boolean }> {
  if (cl.lifecycle !== 'aktiv') return { show: false };
  const ans = await answersRow(db, cl.id, year);
  return { show: !ans || ans.gate === 'kesobb' || (ans.gate === null && !ans.submittedAt) };
}

export type { AllowanceStatus };
