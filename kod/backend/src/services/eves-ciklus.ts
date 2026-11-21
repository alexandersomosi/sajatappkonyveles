// SPEC §32.B – éves ciklus (F2/F3, 2026-11-21): the numbers of the yearly return (the accountant enters them from the
// return; the engine only estimates), the summary the client approves (the approval hash covers the draft AND the
// numbers), the filing with the NAV iktatószám, the difference (a payment period on the NAV account, or the refund rule of
// Art. 64. § (1)), the yearly HIPA, the "Mikor mi jön" timeline, the automatic "kész", the manual close and the manual open
// of a client whose service ended (switch lemondottEvesZaras). The app never files and never pays.
//
// Nothing is deleted: a change of the numbers after the client's approval voids the approval (the client is told), the
// filed return is kept as approved_summary.
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import type { AnnualView } from '../_shared/api.js';
import { ANNUAL_RULES } from '../_shared/enums.js';
import {
  ANNUAL_REFUND_MODES,
  EVES_TEXTS,
  EV_RULES,
  type AnnualAmounts,
  type AnnualAmountsInput,
  type AnnualHipaInput,
  type AnnualHipaView,
  type AnnualRefundInput,
  type AnnualSettlementView,
  type AnnualSummary,
  type AnnualSummaryLine,
  type AnnualTimelineItem,
  type AnnualTimelineStatus,
} from '../_shared/eves.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, clientTaxProfiles, documents, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { audit } from '../audit.js';
import { fill } from '../content.js';
import { snake } from '../content/tulaj1119.js';
import { addDays, huDayMonth, huDayMonthIg, huDayMonthTol, quarterLabel, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { kataDeclarationDue, kataRulesFor, NAV_ACCOUNTS, nextWorkingDay, refundExpectedBy, rulesForYear } from '../tax/engine.js';
import { fmt } from './kedvezmeny.js';
import { clientName, type ClientRow } from './people.js';
import { accountantUserOf } from './team.js';
import { activeItems, computeYear, createManualPeriod, kataRangeOfProfile, periodVisible, type PeriodRow } from './tax.js';

export type AnnualRow = typeof annualClosings.$inferSelect;
type ProfileRow = typeof clientTaxProfiles.$inferSelect;
export interface AnnualActor {
  userId: string;
  role: string;
}

const wrong = (m = 'Ez most nem lehetséges ebben az állapotban.') => new ApiError(409, 'annual_wrong_status', m);
const n0 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---------------------------------------------------------------------------------------------------------------------
// texts (content eves.ciklus.*, defaults from shared EVES_TEXTS)
// ---------------------------------------------------------------------------------------------------------------------
type Params = Record<string, string | number | null | undefined>;
function defaultText(path: string[]): string {
  let cur: unknown = EVES_TEXTS;
  for (const s of path) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[s] : undefined;
  return typeof cur === 'string' ? cur : '';
}
/** EVES_TEXTS.<path> as served by the content system (an admin edit wins), filled. */
export async function evesText(deps: Pick<Deps, 'content'>, path: string, params: Params = {}): Promise<string> {
  const segs = path.split('.');
  const key = `eves.ciklus.${segs.map(snake).join('.')}`;
  const t = (await deps.content.get(key)) || defaultText(segs);
  return fill(t, params);
}

// ---------------------------------------------------------------------------------------------------------------------
// amounts
// ---------------------------------------------------------------------------------------------------------------------
const hufPos = z.number().int().min(0).max(5_000_000_000);
const hufSigned = z.number().int().min(-1_000_000_000).max(1_000_000_000);
export const annualAmountsSchema = z.strictObject({
  revenueHuf: hufPos.nullish(),
  incomeHuf: hufPos.nullish(),
  taxFreeHuf: hufPos.nullish(),
  allowancesHuf: hufPos.nullish(),
  taxableHuf: hufPos.nullish(),
  szjaHuf: hufPos.nullish(),
  advancesHuf: hufPos.nullish(),
  csjkHuf: hufSigned.nullish(),
  otherLines: z
    .array(z.strictObject({ label: z.string().trim().min(1, { error: 'Írd be, mi ez a sor.' }).max(80), amountHuf: hufSigned }))
    .max(EV_RULES.otherLinesMax)
    .optional(),
  refundMode: z.enum(ANNUAL_REFUND_MODES).optional(),
  kataRevenueHuf: hufPos.nullish(),
  kataLiableMonths: z.number().int().min(0).max(12).nullish(),
  kataLimitHuf: hufPos.nullish(),
  kulonadoHuf: hufPos.nullish(),
  overrideReason: z.string().trim().max(500).nullish(),
  letterText: z.string().trim().max(2000).nullish(),
  matchesDraft: z.boolean(),
});

/** + to pay / − refund. átalány: A − B + C + Σ egyéb; KATA: the különadó (never negative). */
export function annualDiff(regime: string, a: AnnualAmountsInput): number {
  if (regime === 'kata') return Math.max(0, n0(a.kulonadoHuf));
  return n0(a.szjaHuf) - n0(a.advancesHuf) + n0(a.csjkHuf) + (a.otherLines ?? []).reduce((s, l) => s + n0(l.amountHuf), 0);
}

async function profileOf(db: DbOrTx, clientId: string, year: number): Promise<ProfileRow | null> {
  const [p] = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year))).limit(1);
  return p ?? null;
}

/** The approved quarters of the year with their szja / TB / szocho items and the state of the szja advance. */
export async function quarterParts(db: DbOrTx, clientId: string, year: number) {
  const ps = await db
    .select()
    .from(taxPeriods)
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'negyedev'), periodVisible))
    .orderBy(asc(taxPeriods.dueDate));
  const out: { period: PeriodRow; key: string; label: string; approved: boolean; szjaHuf: number; tbHuf: number; szochoHuf: number; state: 'ellenorizve' | 'jelolve' | 'nincs' }[] = [];
  for (const p of ps) {
    const items = p.calcStatus === 'jovahagyva' ? await activeItems(db, p.id) : [];
    const szja = items.filter((i) => i.kind === 'szja_eloleg');
    const state = szja.length && szja.every((i) => i.verification === 'rendben') ? 'ellenorizve' : szja.length && szja.every((i) => i.markedPaidAt || i.verification === 'rendben') ? 'jelolve' : 'nincs';
    out.push({
      period: p,
      key: p.periodKey,
      label: p.quarter ? quarterLabel(p.quarter) : p.periodKey,
      approved: p.calcStatus === 'jovahagyva',
      szjaHuf: szja.reduce((a, b) => a + b.amountHuf, 0),
      tbHuf: items.filter((i) => i.kind === 'tb_jarulek').reduce((a, b) => a + b.amountHuf, 0),
      szochoHuf: items.filter((i) => i.kind === 'szocho').reduce((a, b) => a + b.amountHuf, 0),
      state,
    });
  }
  return out;
}

export interface AnnualEstimate {
  diffHuf: number;
  szjaHuf: number;
  advancesHuf: number;
  byQuarter: { key: string; amountHuf: number; state: 'ellenorizve' | 'jelolve' | 'nincs' }[];
  revenueHuf?: number;
  kulonadoHuf?: number;
  liableMonths?: number;
  limitHuf?: number;
}

/** The prefill of the amounts form and the engine's estimate (panel only: "Az app becslése …"). */
export async function annualPrefill(deps: Deps, db: DbOrTx, cl: Pick<ClientRow, 'id'>, r: AnnualRow): Promise<{ prefill: Partial<AnnualAmountsInput>; estimate: AnnualEstimate | null; warnings: string[] }> {
  const y = r.taxYear;
  const warnings: string[] = [];
  const profile = await profileOf(db, cl.id, y);
  if (r.regime === 'kata') {
    const { kataCompute } = await import('./kata.js');
    const c = await kataCompute(db, cl.id, y, `${y}-12-31`).catch(() => null);
    if (!c) return { prefill: {}, estimate: null, warnings };
    const m = c.meter;
    if (profile && profile.kataTo && profile.kataTo < `${y}-12-31`) warnings.push(await evesPanel(deps, 'vegyesEv'));
    return {
      prefill: { kataRevenueHuf: m.usedHuf, kataLiableMonths: m.liableMonths, kataLimitHuf: m.limitHuf, kulonadoHuf: m.kulonadoEstimateHuf },
      estimate: { diffHuf: m.kulonadoEstimateHuf, szjaHuf: 0, advancesHuf: 0, byQuarter: [], kulonadoHuf: m.kulonadoEstimateHuf, revenueHuf: m.usedHuf, liableMonths: m.liableMonths, limitHuf: m.limitHuf },
      warnings,
    };
  }
  const parts = await quarterParts(db, cl.id, y);
  const advances = parts.filter((q) => q.approved).reduce((a, q) => a + q.szjaHuf, 0);
  const byQuarter = parts.filter((q) => q.szjaHuf > 0).map((q) => ({ key: q.key, amountHuf: q.szjaHuf, state: q.state }));
  if (byQuarter.some((q) => q.state !== 'ellenorizve')) warnings.push(await evesPanel(deps, 'elolegEllenorizetlen'));
  const range = kataRangeOfProfile(profile);
  if (range) warnings.push(await evesPanel(deps, 'vegyesEv'));
  const comp = profile ? await computeYear(db, cl.id, y, `${y}-12-31`).catch(() => null) : null;
  const qs = comp?.result.quarters ?? [];
  const last = qs.at(-1);
  if (!last) return { prefill: { advancesHuf: advances }, estimate: null, warnings };
  const revenue = qs.reduce((a, q) => a + q.revenueHuf, 0);
  const szja = last.szjaCumulativeHuf ?? qs.reduce((a, q) => a + q.szjaAdvanceHuf, 0);
  return {
    // javító kör 11-21: the adómentes rész too (the summary shows "Adómentes rész −1 936 800 Ft", terv 3.3)
    prefill: { revenueHuf: revenue, incomeHuf: last.incomeYtdHuf, taxFreeHuf: Math.min(last.incomeYtdHuf, rulesForYear(y)?.taxFreeIncomeHuf ?? Math.max(0, last.incomeYtdHuf - last.taxableYtdHuf)), taxableHuf: last.taxableYtdHuf, szjaHuf: szja, advancesHuf: advances },
    estimate: { diffHuf: szja - advances, szjaHuf: szja, advancesHuf: advances, byQuarter, revenueHuf: revenue },
    warnings,
  };
}

async function evesPanel(deps: Pick<Deps, 'content'>, k: keyof typeof import('../_shared/eves.js').EVES_PANEL_TEXTS): Promise<string> {
  const { EVES_PANEL_TEXTS } = await import('../_shared/eves.js');
  return (await deps.content.get(`eves.panel.${snake(k)}`)) || EVES_PANEL_TEXTS[k];
}

async function rowForUpdate(db: DbOrTx, cl: Pick<ClientRow, 'id'>, id: string): Promise<AnnualRow> {
  const [r] = await db.select().from(annualClosings).where(and(eq(annualClosings.id, id), eq(annualClosings.clientId, cl.id))).limit(1).for('update');
  if (!r) throw E.notFound();
  return r;
}

/** The comparable part of the amounts (what the client approves). */
function numbersOf(a: AnnualAmountsInput | AnnualAmounts | null | undefined): Record<string, unknown> | null {
  if (!a) return null;
  const { matchesDraft: _m, overrideReason: _o, ...rest } = a as AnnualAmounts;
  return rest;
}
/** Canonical JSON (sorted keys at every level; Postgres jsonb reorders keys). */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v ?? null);
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
/** The hash of everything the client approves besides the draft document: the numbers, the HIPA block, the letter. */
export function numbersHash(r: Pick<AnnualRow, 'taxYear' | 'regime' | 'amounts' | 'diffHuf' | 'hipaNeeded' | 'hipaAmounts'>): string {
  return sha(canonical({ year: r.taxYear, regime: r.regime, amounts: numbersOf(r.amounts), diff: r.diffHuf, hipaNeeded: r.hipaNeeded, hipa: r.hipaAmounts ?? null }));
}
/** POST /client/annual/:id/approve { hash }: sha256(docId + ':' + numbersHash). */
export function approvalHashFor(docId: string, r: Parameters<typeof numbersHash>[0]): string {
  return sha(`${docId}:${numbersHash(r)}`);
}

/** The latest shared draft return of the client ('bevallas', kozos). */
export async function latestDraft(db: DbOrTx, clientId: string) {
  const [d] = await db.select().from(documents).where(and(eq(documents.clientId, clientId), eq(documents.category, 'bevallas'), eq(documents.visibility, 'kozos'), isNull(documents.deletedAt))).orderBy(desc(documents.createdAt)).limit(1);
  return d ?? null;
}

/**
 * The draft of THIS closing (javító kör 11-21): the document stored at the 'draft' step (draft_document_id). A later
 * 'bevallas' document of the client (a quarterly 2658 filed in April, an önellenőrzés) is never taken for it. Closings sent
 * before the column existed fall back to the latest shared draft, as before.
 */
export async function draftOf(db: DbOrTx, clientId: string, r: Pick<AnnualRow, 'draftDocumentId'>) {
  if (!r.draftDocumentId) return latestDraft(db, clientId);
  const [d] = await db.select().from(documents).where(and(eq(documents.id, r.draftDocumentId), eq(documents.clientId, clientId), isNull(documents.deletedAt))).limit(1);
  return d ?? null;
}

/**
 * PUT /acc/clients/:id/annual/:aid/amounts. Only in 'konyvelonel' / 'jovahagyasra_var'. A change while the client has the
 * draft voids his approval and tells him (once a day); the engine estimate of the moment is kept for the panel.
 */
export async function saveAnnualAmounts(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, input: z.infer<typeof annualAmountsSchema>, actor: AnnualActor): Promise<AnnualRow> {
  const r = await rowForUpdate(db, cl, id);
  if (r.status !== 'konyvelonel' && r.status !== 'jovahagyasra_var') throw wrong('Az összegeket akkor írhatod be, amikor az éves zárás nálad van, vagy az ügyfél jóváhagyására vár.');
  if (r.regime === 'kata') {
    if (input.kataRevenueHuf == null) throw E.validation({ kataRevenueHuf: 'Írd be a bevételt.' });
    if (input.kulonadoHuf == null) throw E.validation({ kulonadoHuf: 'Írd be a különadót (0, ha nincs).' });
  } else if (input.szjaHuf == null) throw E.validation({ szjaHuf: 'Írd be az éves szja-t (A).' });
  const { prefill, estimate } = await annualPrefill(deps, db, cl, r);
  // a number the app prefilled and the accountant changed needs a short reason (terv 4.1)
  const changed = (Object.keys(prefill) as (keyof AnnualAmountsInput)[]).filter((k) => {
    const v = input[k as keyof typeof input];
    return typeof v === 'number' && typeof prefill[k] === 'number' && v !== prefill[k];
  });
  if (changed.length && !input.overrideReason?.trim()) throw E.validation({ overrideReason: await evesPanel(deps, 'indokKell') });
  const diff = annualDiff(r.regime, input);
  const amounts: AnnualAmounts = { ...input, regime: r.regime, diffHuf: diff };
  const numbersChanged = canonical(numbersOf(r.amounts)) !== canonical(numbersOf(amounts)) || r.diffHuf !== diff;
  const now = deps.now();
  const patch: Partial<AnnualRow> = {
    amounts,
    amountsSetBy: actor.userId,
    amountsSetAt: now,
    engineEstimate: estimate as unknown as Record<string, unknown> | null,
    letterText: input.letterText ?? null,
    diffHuf: diff,
    refundMode: r.regime === 'atalany' && diff < 0 ? (input.refundMode ?? 'kiutalas') : null,
    updatedAt: now,
  };
  const voidApproval = r.status === 'jovahagyasra_var' && numbersChanged;
  if (voidApproval) Object.assign(patch, { approvedAt: null, approvalHash: null, approvedSummary: null });
  const [u] = await db.update(annualClosings).set(patch).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: 'annual.amounts_saved', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { diffHuf: diff, changed, voidedApproval: voidApproval && Boolean(r.approvedAt) } });
  if (voidApproval) await notifyChanged(deps, db, cl, r);
  return u!;
}

/** "Változott a bevallásod tervezete" – once a day per closing (the dedupe key), in the caller's transaction. */
async function notifyChanged(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow): Promise<void> {
  const { notifications } = await import('../db/schema.js');
  const { sql } = await import('drizzle-orm');
  const key = `annual:valtozott:${r.id}:${todayBudapest(deps.now())}`;
  const [hit] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, cl.userId), sql`${notifications.data}->>'dedupe' = ${key}`)).limit(1);
  if (hit) return;
  await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant: 'valtozott', params: await accountantParams(db, cl.accountantId), link: '/eves-zaras/jovahagyas', data: { dedupe: key } });
}

// ---------------------------------------------------------------------------------------------------------------------
// summary (what the client approves)
// ---------------------------------------------------------------------------------------------------------------------
/** The legal due date of the difference: 20 May (26SZJA) or the '26KATA date (25 Feb, or kataTo + 30 days) – working day. */
export function settlementDue(r: Pick<AnnualRow, 'taxYear' | 'regime'>, profile: Pick<ProfileRow, 'kataTo' | 'kataVariant'> | null): string {
  const y = r.taxYear;
  if (r.regime === 'kata') {
    const rules = kataRulesFor(y, profile?.kataVariant ?? 'regi');
    return (rules && kataDeclarationDue(y, profile?.kataTo ?? null, rules)) || nextWorkingDay(`${y + 1}-${ANNUAL_RULES.legalDue.kata}`);
  }
  return nextWorkingDay(`${y + 1}-${ANNUAL_RULES.legalDue.szja}`);
}
const maskAcc = (acc: string) => (acc.length >= 8 ? `${acc.slice(0, 3)}…${acc.slice(-4)}` : '…');
function refundAccountMasked(deps: Deps, r: AnnualRow): string | null {
  if (!r.refundAccountEnc) return null;
  try {
    return maskAcc(deps.data.dec(r.refundAccountEnc, 'annual_closings.refund_account'));
  } catch {
    return null;
  }
}

export async function buildSummary(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow): Promise<AnnualSummary | null> {
  const a = r.amounts;
  if (!a) return null;
  const y = r.taxYear;
  const ap = await accountantParams(db, cl.accountantId);
  const profile = await profileOf(db, cl.id, y);
  const diff = r.diffHuf ?? annualDiff(r.regime, a);
  const due = settlementDue(r, profile);
  const t = (p: string, params: Params = {}) => evesText(deps, p, { ...ap, ev: y, ...params });
  const income: AnnualSummaryLine[] = [];
  const szja: AnnualSummaryLine[] = [];
  let advancesByQuarter: AnnualSummary['advancesByQuarter'] = [];
  let result: AnnualSummary['result'];
  let contributions: AnnualSummary['contributions'] = null;
  let payment: AnnualSummary['payment'] = null;
  if (r.regime === 'kata') {
    if (a.kataRevenueHuf != null) income.push({ label: await t('osszesito.kata.bevetel'), amountHuf: a.kataRevenueHuf });
    if (a.kataLimitHuf != null) {
      const months = a.kataLiableMonths ?? 12;
      income.push({ label: await t('osszesito.kata.keret'), amountHuf: a.kataLimitHuf, note: months < 12 ? `${months} hónap × 1 500 000 Ft` : undefined });
    }
    const paidMonthly = await kataPaidInYear(db, cl.id, y);
    if (paidMonthly > 0) income.push({ label: await t('osszesito.kata.havi'), amountHuf: paidMonthly });
    const over = Math.max(0, n0(a.kataRevenueHuf) - n0(a.kataLimitHuf));
    if (over > 0) income.push({ label: await t('osszesito.kata.tobblet'), amountHuf: over });
    if (n0(a.kulonadoHuf) > 0) income.push({ label: await t('osszesito.kata.kulonado'), amountHuf: n0(a.kulonadoHuf) });
    result =
      diff > 0
        ? { kind: 'fizetendo', amountHuf: diff, title: await t('osszesito.kata.eredmenyKulonado', { osszeg: fmt(diff) }), sub: await t('osszesito.kata.eredmenyKulonadoAl', { hatarido: huDayMonthIg(due) }) }
        : { kind: 'nulla', amountHuf: 0, title: await t('osszesito.kata.nincs'), sub: await t('osszesito.kata.nincsAl') };
    if (diff > 0) payment = { accountName: NAV_ACCOUNTS.kata.name, accountNumber: NAV_ACCOUNTS.kata.number, iban: NAV_ACCOUNTS.kata.iban ?? '', reference: cl.adoszam ?? '', amountHuf: diff, dueDate: due };
  } else {
    if (a.revenueHuf != null) income.push({ label: await t('osszesito.sor.bevetel'), amountHuf: a.revenueHuf });
    if (a.revenueHuf != null && a.incomeHuf != null && a.revenueHuf > a.incomeHuf)
      income.push({ label: `${await t('osszesito.sor.koltseghanyad')}${profile ? ` (${profile.costRatio}%)` : ''}`, amountHuf: a.revenueHuf - a.incomeHuf, sign: '−' });
    if (a.incomeHuf != null) income.push({ label: await t('osszesito.sor.jovedelem'), amountHuf: a.incomeHuf });
    if (n0(a.taxFreeHuf) > 0) income.push({ label: await t('osszesito.sor.adomentes'), amountHuf: n0(a.taxFreeHuf), sign: '−' });
    if (n0(a.allowancesHuf) > 0) income.push({ label: await t('osszesito.sor.kedvezmeny'), amountHuf: n0(a.allowancesHuf), sign: '−' });
    if (a.taxableHuf != null) income.push({ label: await t('osszesito.sor.adokoteles'), amountHuf: a.taxableHuf });
    szja.push({ label: await t('osszesito.sor.szja'), amountHuf: n0(a.szjaHuf) });
    szja.push({ label: await t('osszesito.eloleg'), amountHuf: n0(a.advancesHuf), sign: '−' });
    if (n0(a.csjkHuf) !== 0) szja.push({ label: await t('osszesito.sor.csjk'), amountHuf: Math.abs(n0(a.csjkHuf)), sign: n0(a.csjkHuf) < 0 ? '−' : '+' });
    for (const l of a.otherLines ?? []) szja.push({ label: l.label, amountHuf: Math.abs(l.amountHuf), sign: l.amountHuf < 0 ? '−' : '+' });
    const parts = await quarterParts(db, cl.id, y);
    advancesByQuarter = parts.filter((q) => q.szjaHuf > 0).map((q) => ({ label: q.label, amountHuf: q.szjaHuf, state: q.state }));
    if (diff > 0) {
      result = { kind: 'fizetendo', amountHuf: diff, title: await t('osszesito.fizetendo', { osszeg: fmt(diff) }), sub: await t('osszesito.fizetendoAl', { hatarido: huDayMonthIg(due) }) };
      payment = { accountName: NAV_ACCOUNTS.szja.name, accountNumber: NAV_ACCOUNTS.szja.number, iban: NAV_ACCOUNTS.szja.iban ?? '', reference: cl.adoszam ?? '', amountHuf: diff, dueDate: due };
    } else if (diff < 0) {
      const acc = refundAccountMasked(deps, r);
      const sub = acc ? await t('osszesito.visszajarAl', { szamla: acc }) : await t('osszesito.visszajarAlNincsSzamla');
      result = { kind: 'visszajar', amountHuf: -diff, title: await t('osszesito.visszajar', { osszeg: fmt(-diff) }), sub: `${sub} ${await t('osszesito.visszajarSzabaly', { ev: y + 1 })}` };
    } else result = { kind: 'nulla', amountHuf: 0, title: await t('osszesito.nulla'), sub: await t('osszesito.nullaAl') };
    const tb = parts.reduce((s, q) => s + q.tbHuf, 0);
    const szocho = parts.reduce((s, q) => s + q.szochoHuf, 0);
    if (tb + szocho > 0)
      contributions = {
        lines: [
          { label: await t('osszesito.sor.tb'), amountHuf: tb },
          { label: await t('osszesito.sor.szocho'), amountHuf: szocho },
        ],
        text: await t('osszesito.jarulekAl'),
      };
  }
  let hipa: AnnualSummary['hipa'] = null;
  const h = r.hipaAmounts;
  if (r.hipaNeeded && h && h.taxHuf != null) {
    const hd = n0(h.taxHuf) - n0(h.advancesHuf);
    hipa = {
      lines: [
        { label: await t('osszesito.sor.hipaAdo'), amountHuf: n0(h.taxHuf) },
        { label: await t('osszesito.sor.hipaEloleg'), amountHuf: n0(h.advancesHuf), sign: '−' },
        { label: await t('osszesito.sor.hipaKulonbozet'), amountHuf: Math.abs(hd), ...(hd < 0 ? { sign: '−' as const } : {}) },
      ],
      text: await t('osszesito.hipaAl'),
    };
  }
  return {
    year: y,
    regime: r.regime,
    formLabel: r.regime === 'kata' ? `Kata-nyilatkozat ${y} ('${String(y).slice(2)}KATA)` : `Szja-bevallás ${y} (${String(y).slice(2)}SZJA)`,
    letter: a.letterText?.trim() || null,
    income,
    szja,
    advancesByQuarter,
    result,
    contributions,
    hipa,
    payment,
    footer: await t('osszesito.lab'),
  };
}

/** Σ KATA items of the year the client marked or the accountant verified (the "Befizetett havi kata" line). */
async function kataPaidInYear(db: DbOrTx, clientId: string, year: number): Promise<number> {
  const rows = await db
    .select({ amountHuf: taxPaymentItems.amountHuf, markedPaidAt: taxPaymentItems.markedPaidAt, verification: taxPaymentItems.verification })
    .from(taxPaymentItems)
    .innerJoin(taxPeriods, eq(taxPeriods.id, taxPaymentItems.taxPeriodId))
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'kata'), periodVisible, isNull(taxPaymentItems.voidedAt)));
  return rows.filter((i) => i.markedPaidAt || i.verification === 'rendben').reduce((a, b) => a + b.amountHuf, 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// filing, difference, refund, HIPA, close / open
// ---------------------------------------------------------------------------------------------------------------------
export interface AnnualFilingInput {
  filedOn: string;
  filingRef?: string | null;
  returnDocumentId?: string | null;
  receiptDocumentId?: string | null;
  /** Without the client's approval in the app: the recorded phone agreement (≥ 10 characters). */
  noApprovalNote?: string | null;
}

function checkFiledOn(filedOn: string, year: number, today: string): void {
  if (!isDay(filedOn)) throw E.validation({ filedOn: 'A beadás napja kell (ÉÉÉÉ-HH-NN).' });
  if (filedOn > today) throw E.validation({ filedOn: 'Jövőbeli napot nem adhatsz meg.' });
  if (filedOn <= `${year}-12-31`) throw E.validation({ filedOn: `A ${year}. évi bevallást ${year + 1}-ben lehet beadni.` });
}

/**
 * The 26SZJA / '26KATA is filed (the accountant's "Beadtam"): date, NAV iktatószám, the return and the NAV receipt are
 * required. Then: difference > 0 → a payment period on the NAV account (szja 103 / kata 288), due 20 May (or the '26KATA
 * date); < 0 → the refund is followed (Art. 64. § (1)); 0 → nothing to settle.
 */
export async function fileAnnual(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, f: AnnualFilingInput, actor: AnnualActor): Promise<AnnualRow> {
  const r = await rowForUpdate(db, cl, id);
  if (r.status !== 'jovahagyasra_var' && r.status !== 'konyvelonel') throw wrong();
  if (!r.amounts) throw wrong('Előbb rögzítsd az összegeket az Összegek kártyán.');
  const now = deps.now();
  const today = todayBudapest(now);
  checkFiledOn(f.filedOn, r.taxYear, today);
  const ref = f.filingRef?.trim() ?? '';
  if (!ref) throw E.validation({ filingRef: 'Írd be a NAV-iktatószámot.' });
  if (ref.length > EV_RULES.filingRefMaxChars) throw E.validation({ filingRef: `Legfeljebb ${EV_RULES.filingRefMaxChars} karakter.` });
  if (!f.returnDocumentId) throw E.validation({ file: 'Töltsd fel a beadott bevallást (PDF).' });
  if (!f.receiptDocumentId) throw E.validation({ receipt: 'Töltsd fel a NAV visszaigazolását.' });
  const note = f.noApprovalNote?.trim() ?? '';
  if (!r.approvedAt && note.length < 10)
    throw wrong('Az ügyfél még nem hagyta jóvá a tervezetet. Jóváhagyás nélkül csak a telefonon rögzített egyeztetés után adhatod be: írd le, mikor és mit beszéltetek.');
  const profile = await profileOf(db, cl.id, r.taxYear);
  // what the client approved; without an app approval (phone agreement) the numbers as they are now
  const summary = r.approvedAt && r.approvedSummary ? r.approvedSummary : await buildSummary(deps, db, cl, r);
  const diff = r.diffHuf ?? annualDiff(r.regime, r.amounts);
  const y = r.taxYear;
  const due = settlementDue(r, profile);
  const ap = await accountantParams(db, cl.accountantId);
  const checkKey = r.regime === 'kata' ? 'kata_beadva' : 'szja_beadva';
  const patch: Partial<AnnualRow> = {
    status: 'beadva',
    filedSzjaAt: now,
    filedSzjaOn: f.filedOn,
    szjaFilingRef: ref,
    szjaReturnDocumentId: f.returnDocumentId,
    szjaReceiptDocumentId: f.receiptDocumentId,
    filedWithoutApprovalNote: r.approvedAt ? null : note,
    approvedSummary: summary,
    diffHuf: diff,
    checklist: { ...(r.checklist ?? {}), [checkKey]: { at: now.toISOString(), by: actor.userId }, visszaigazolas_feltoltve: { at: now.toISOString(), by: actor.userId } },
    updatedAt: now,
  };
  let variant: string;
  let link = '/eves-zaras';
  const params: Params = { ...ap };
  if (r.regime === 'kata') {
    if (diff > 0) {
      const p = await createManualPeriod(deps, db, {
        clientId: cl.id,
        kind: 'kata_eves',
        periodKey: `${y}-KATA`,
        year: y,
        dueDate: due,
        reference: cl.adoszam ?? '',
        filingForm: `'${String(y).slice(2)}KATA`,
        filingRef: ref,
        items: [{ kind: 'kata_kulonado', label: 'Kata-különadó', sublabel: `${y}. év, a kereten felüli bevétel 40%-a`, amountHuf: diff, account: NAV_ACCOUNTS.kata, adonem: '288' }],
      });
      patch.settlementPeriodId = p.id;
      variant = 'kata_kulonado';
      link = `/fizetes/${p.id}`;
      Object.assign(params, { osszeg: fmt(diff), hatarido: huDayMonthIg(due) });
    } else variant = 'kata_beadva';
  } else if (diff > 0) {
    const p = await createManualPeriod(deps, db, {
      clientId: cl.id,
      kind: 'eves_szja',
      periodKey: `${y}-SZJA`,
      year: y,
      dueDate: due,
      reference: cl.adoszam ?? '',
      filingForm: `${String(y).slice(2)}SZJA`,
      filingRef: ref,
      items: [{ kind: 'szja_kulonbozet', label: 'Szja-különbözet', sublabel: `${y}. évi szja-bevallás`, amountHuf: diff, account: NAV_ACCOUNTS.szja, adonem: '103' }],
    });
    patch.settlementPeriodId = p.id;
    variant = 'fizetendo';
    link = `/fizetes/${p.id}`;
    Object.assign(params, { osszeg: fmt(diff), hatarido: huDayMonthIg(due) });
  } else if (diff < 0) {
    Object.assign(patch, { refundMode: r.refundMode ?? 'kiutalas', refundExpectedBy: refundExpectedBy(f.filedOn, y, EV_RULES.refundBufferDays), refundStatus: 'var' });
    variant = 'visszajar';
    Object.assign(params, { osszeg: fmt(-diff) });
  } else variant = 'nulla';
  await db.update(annualClosings).set(patch).where(eq(annualClosings.id, r.id));
  await audit(db, { action: 'annual.filed-szja', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { diffHuf: diff, withoutApproval: !r.approvedAt, filingRefLength: ref.length } });
  // the "Ha egyszerre nem tudod kifizetni, írj nekünk" sentence only with the switch on [TULAJ T6]
  const { evesKapcsolok } = await import('./kata.js');
  const reszlet = variant === 'fizetendo' && (await evesKapcsolok(db)).reszletfizetesSzoveg;
  const emailKey = `email.annual_status.${variant}${reszlet ? '_reszlet' : ''}.body`;
  await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant, params, link, ...((await deps.content.exists(emailKey)) ? { emailBodyKey: emailKey } : {}) });
  return maybeCloseAnnual(deps, db, r.id);
}

/**
 * 'beadva' → 'kesz' (terv 4.1): the return is filed, the difference is settled (payment verified; refund arrived, set
 * off or transferred; or nothing to settle) and the HIPA is filed or not needed. A closing without the new amounts (older
 * rows) counts as settled, as before.
 */
export async function maybeCloseAnnual(deps: Deps, db: DbOrTx, id: string): Promise<AnnualRow> {
  const [r] = await db.select().from(annualClosings).where(eq(annualClosings.id, id)).limit(1);
  if (!r) throw E.notFound();
  if (r.status !== 'beadva' || !r.filedSzjaAt) return r;
  const periodStatus = async (pid: string) => {
    const [p] = await db.select({ s: taxPeriods.paymentStatus }).from(taxPeriods).where(and(eq(taxPeriods.id, pid), periodVisible)).limit(1);
    return p?.s ?? null;
  };
  let settled = true;
  if (r.diffHuf != null && r.diffHuf > 0) settled = Boolean(r.settlementPeriodId) && (await periodStatus(r.settlementPeriodId!)) === 'ellenorizve';
  else if (r.diffHuf != null && r.diffHuf < 0 && r.regime === 'atalany') settled = Boolean(r.refundStatus && r.refundStatus !== 'var');
  const profile = await profileOf(db, r.clientId, r.taxYear);
  let hipaDone = Boolean(r.filedHipaAt) || !r.hipaNeeded || profile?.hipaMethod === 'nincs' || r.hipaAmounts?.returnNeeded === false;
  if (hipaDone && r.hipaPeriodId) hipaDone = (await periodStatus(r.hipaPeriodId)) === 'ellenorizve';
  if (!settled || !hipaDone) return r;
  const now = deps.now();
  const [u] = await db.update(annualClosings).set({ status: 'kesz', updatedAt: now }).where(and(eq(annualClosings.id, r.id), eq(annualClosings.status, 'beadva'))).returning();
  if (!u) return r;
  await audit(db, { action: 'annual.closed', actorRole: 'system', targetType: 'annual_closing', targetId: r.id, clientId: r.clientId });
  const { clients } = await import('../db/schema.js');
  const [cl] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant: 'kesz', params: await accountantParams(db, cl.accountantId), link: '/eves-zaras', noEmail: true });
  return u;
}

/** A verified yearly difference / HIPA difference finishes the closing; an önellenőrzés payment settles the correction. */
export async function afterSettlementVerified(deps: Deps, db: DbOrTx, p: PeriodRow): Promise<void> {
  if (p.kind === 'onellenorzes') {
    await (await import('./onellenorzes.js')).maybeSettleCorrection(deps, db, p);
    return;
  }
  const [r] = await db
    .select({ id: annualClosings.id })
    .from(annualClosings)
    .where(and(eq(annualClosings.clientId, p.clientId), or(eq(annualClosings.settlementPeriodId, p.id), eq(annualClosings.hipaPeriodId, p.id))))
    .limit(1);
  if (r) await maybeCloseAnnual(deps, db, r.id);
}

/** Refund (Art. 64. § (1)): the client may mark "megérkezett"; the accountant also "beszámítva" / "átvezetve". */
export async function recordRefund(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, input: AnnualRefundInput, actor: AnnualActor & { client: boolean }): Promise<AnnualRow> {
  const r = await rowForUpdate(db, cl, id);
  if (r.regime !== 'atalany' || !r.filedSzjaAt || r.diffHuf == null || r.diffHuf >= 0 || !r.refundStatus) throw wrong('Ennél a bevallásnál nincs visszajáró adó.');
  const today = todayBudapest(deps.now());
  if (!isDay(input.on) || input.on > today) throw E.validation({ on: 'Jövőbeli napot nem adhatsz meg.' });
  if (r.filedSzjaOn && input.on < r.filedSzjaOn) throw E.validation({ on: 'A beadás előtti nap nem lehet.' });
  if (actor.client) {
    if (input.status !== 'megerkezett') throw E.forbidden();
    if (r.refundStatus !== 'var') throw wrong('Ezt már rögzítettük.');
  } else if (r.refundStatus !== 'var' && r.refundMarkedBy !== 'ugyfel') throw wrong('Ezt már rögzítetted.');
  const amount = input.amountHuf ?? -r.diffHuf;
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > -r.diffHuf * 10) throw E.validation({ amountHuf: 'Nézd meg az összeget.' });
  const now = deps.now();
  const [u] = await db
    .update(annualClosings)
    .set({ refundStatus: input.status, refundReceivedOn: input.on, refundReceivedHuf: input.status === 'megerkezett' ? amount : null, refundMarkedBy: actor.client ? 'ugyfel' : 'konyvelo', refundNote: input.note?.trim() || null, updatedAt: now })
    .where(eq(annualClosings.id, r.id))
    .returning();
  await audit(db, { action: 'annual.refund', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { status: input.status } });
  if (actor.client) {
    const acc = await accountantUserOf(db, cl);
    if (acc) await notify(deps, db, { userId: acc.userId, kind: 'tax_task', variant: 'visszajaro_ugyfel', params: { clientName: clientName(cl), osszeg: fmt(amount), datum: huDayMonth(input.on) }, link: `/ugyfelek/${cl.id}/eves`, data: { clientId: cl.id } });
  } else if (input.status === 'megerkezett') {
    await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant: 'visszaerkezett', params: { ...(await accountantParams(db, cl.accountantId)), osszeg: fmt(amount) }, link: '/eves-zaras', noEmail: true });
  }
  void u;
  return maybeCloseAnnual(deps, db, r.id);
}

export const annualHipaSchema = z.strictObject({
  notNeeded: z.boolean().optional(),
  taxHuf: hufPos.nullish(),
  advancesHuf: hufPos.nullish(),
  returnNeeded: z.boolean().nullish(),
});

/** PUT /acc/clients/:id/annual/:aid/hipa – the yearly HIPA (H), the advances (E), whether a return is needed. */
export async function saveAnnualHipa(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, input: AnnualHipaInput, actor: AnnualActor): Promise<AnnualRow> {
  const r = await rowForUpdate(db, cl, id);
  if (r.status === 'nem_indult' || r.status === 'kerdoiv' || r.status === 'dijra_var') throw wrong('Az iparűzési adót akkor rögzítheted, amikor az éves zárás nálad van.');
  if (r.filedHipaAt) throw wrong('A HIPA-bevallás már be van adva.');
  const now = deps.now();
  const patch: Partial<AnnualRow> = input.notNeeded
    ? { hipaNeeded: false, hipaAmounts: null, updatedAt: now }
    : (() => {
        if (input.taxHuf == null) throw E.validation({ taxHuf: 'Írd be az éves iparűzési adót.' });
        return { hipaNeeded: true, hipaAmounts: { taxHuf: input.taxHuf, advancesHuf: input.advancesHuf ?? 0, returnNeeded: input.returnNeeded ?? null }, updatedAt: now };
      })();
  // javító kör 11-21 (Htv. 39/A. § (8)): without a return only with the sávos method, and only if the tax is not more than
  // the advances paid – otherwise the return is required
  if (!input.notNeeded && input.returnNeeded === false) {
    const prof = await profileOf(db, cl.id, r.taxYear);
    if (prof?.hipaMethod === 'altalanos') throw E.validation({ returnNeeded: 'Általános módszernél mindig kell bevallás.' });
    if (n0(input.taxHuf) > n0(input.advancesHuf)) throw E.validation({ returnNeeded: 'Ha az éves adó több a befizetett előlegnél, bevallás kell (Htv. 39/A. § (8)).' });
  }
  const before = numbersHash(r);
  const [u] = await db.update(annualClosings).set(patch).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: 'annual.hipa_saved', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { notNeeded: Boolean(input.notNeeded) } });
  if (r.status === 'jovahagyasra_var' && numbersHash(u!) !== before) {
    await db.update(annualClosings).set({ approvedAt: null, approvalHash: null, approvedSummary: null }).where(eq(annualClosings.id, r.id));
    await notifyChanged(deps, db, cl, r);
  }
  // no return needed (sávos, H ≤ E): the tax counts as paid with the advances (Htv. 39/A. § (8)) → next year's advance base
  // is the advance paid, E (Htv. 39/A. § (9)); the accountant can still change the prefill [DÁVID]
  if (!input.notNeeded && input.returnNeeded === false && input.taxHuf != null) await writePriorYearHipa(deps, db, cl.id, r.taxYear, Math.max(input.taxHuf, n0(input.advancesHuf)));
  return maybeCloseAnnual(deps, db, r.id);
}

async function writePriorYearHipa(deps: Deps, db: DbOrTx, clientId: string, year: number, taxHuf: number): Promise<void> {
  await db.update(clientTaxProfiles).set({ hipaPriorYearHuf: taxHuf, hipaPriorYearSource: 'eves_zaras', updatedAt: deps.now() }).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year + 1)));
}

/**
 * "Beadtam a HIPA-bevallást": date (required), iktatószám, the return / receipt (optional – the municipality's own
 * channel). H − E > 0 → a payment period on the municipality's account (due 31 May, working day). The tax goes into next
 * year's profile as the sávos advance base. Older closings without HIPA amounts are only marked filed (as before).
 */
export async function fileAnnualHipa(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, f: AnnualFilingInput & { accountNumber?: string | null }, actor: AnnualActor): Promise<AnnualRow> {
  const r = await rowForUpdate(db, cl, id);
  if (!['konyvelonel', 'jovahagyasra_var', 'beadva'].includes(r.status)) throw wrong();
  if (r.filedHipaAt) throw wrong('A HIPA-bevallás már be van adva.');
  const now = deps.now();
  checkFiledOn(f.filedOn, r.taxYear, todayBudapest(now));
  const ref = f.filingRef?.trim() || null;
  if (ref && ref.length > EV_RULES.filingRefMaxChars) throw E.validation({ filingRef: `Legfeljebb ${EV_RULES.filingRefMaxChars} karakter.` });
  const y = r.taxYear;
  const patch: Partial<AnnualRow> = {
    filedHipaAt: now,
    filedHipaOn: f.filedOn,
    hipaFilingRef: ref,
    hipaReturnDocumentId: f.returnDocumentId ?? null,
    hipaReceiptDocumentId: f.receiptDocumentId ?? null,
    checklist: { ...(r.checklist ?? {}), hipa_beadva: { at: now.toISOString(), by: actor.userId } },
    updatedAt: now,
  };
  const h = r.hipaAmounts;
  const hd = h && h.taxHuf != null ? n0(h.taxHuf) - n0(h.advancesHuf) : 0;
  if (hd > 0) {
    const profile = await profileOf(db, cl.id, y);
    const number = (f.accountNumber ?? profile?.hipaAccountNumber ?? '').trim();
    if (!/^\d{8}-\d{8}(-\d{8})?$/.test(number)) throw E.validation({ accountNumber: 'Add meg az önkormányzat iparűzésiadó-számláját (pl. 11784009-15400017-03540000).' });
    const town = cl.hqMunicipality?.trim();
    const due = nextWorkingDay(`${y + 1}-${ANNUAL_RULES.legalDue.hipa}`);
    const p = await createManualPeriod(deps, db, {
      clientId: cl.id,
      kind: 'hipa_eves',
      periodKey: `${y}-HIPA-EVES`,
      year: y,
      dueDate: due,
      reference: cl.adoszam ?? '',
      filingForm: `${String(y).slice(2)}HIPA`,
      filingRef: ref,
      items: [{ kind: 'hipa_kulonbozet', label: 'Iparűzési adó különbözete', sublabel: town ? `${y}. év, ${town}` : `${y}. év`, amountHuf: hd, account: { name: town ? `${town} önkormányzata – iparűzési adó beszedési számla` : 'Önkormányzat – iparűzési adó beszedési számla', number }, adonem: null }],
    });
    patch.hipaPeriodId = p.id;
    await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant: 'hipa_fizetendo', params: { ...(await accountantParams(db, cl.accountantId)), osszeg: fmt(hd), hatarido: huDayMonthIg(due) }, link: `/fizetes/${p.id}` });
  }
  await db.update(annualClosings).set(patch).where(eq(annualClosings.id, r.id));
  if (h && h.taxHuf != null) await writePriorYearHipa(deps, db, cl.id, y, h.taxHuf);
  await audit(db, { action: 'annual.filed-hipa', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { diffHuf: hd } });
  return maybeCloseAnnual(deps, db, r.id);
}

/** "Lezárom az éves zárást" – something was settled outside the app; with a reason (audited). */
export async function closeAnnualManually(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, reason: string, actor: AnnualActor): Promise<AnnualRow> {
  const r = await rowForUpdate(db, cl, id);
  if (!['konyvelonel', 'jovahagyasra_var', 'beadva'].includes(r.status)) throw wrong();
  const now = deps.now();
  const [u] = await db.update(annualClosings).set({ status: 'kesz', closedManuallyReason: reason.trim(), updatedAt: now }).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: 'annual.closed_manually', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { reasonLength: reason.trim().length } });
  await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant: 'kesz', params: await accountantParams(db, cl.accountantId), link: '/eves-zaras', noEmail: true });
  return u!;
}

/** May the accountant open the closing of a client whose service ended / is suspended (switch lemondottEvesZaras)? */
export async function manualOpenState(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<{ allowed: boolean; reason: string } | null> {
  if (cl.lifecycle !== 'megszunt' && cl.lifecycle !== 'felfuggesztve') return null;
  const { evesKapcsolok } = await import('./kata.js');
  const k = await evesKapcsolok(db);
  if (k.lemondottEvesZaras === 'ki') return { allowed: false, reason: await evesPanel(deps, 'megnyitasKi') };
  return { allowed: true, reason: await evesPanel(deps, 'megnyitasMegszunt') };
}

/**
 * POST /acc/clients/:id/annual/open { year } – the last year of a client whose service ended or is suspended, opened by
 * hand (switch 'kezi' or 'automatikus'; with 'ki' – the default – 409). Not before 5 January of the next year.
 */
export async function openAnnualManually(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, actor: AnnualActor): Promise<AnnualRow> {
  const st = await manualOpenState(deps, db, cl);
  if (!st) throw wrong('Aktív ügyfélnek január 5-én magától nyílik meg az éves zárás.');
  if (!st.allowed) throw wrong(st.reason);
  const today = todayBudapest(deps.now());
  if (today < `${year + 1}-${ANNUAL_RULES.openMonthDay}`) throw wrong(`A ${year}. évi zárás ${year + 1}. január 5-től nyitható meg.`);
  const profile = await profileOf(db, cl.id, year);
  if (!profile) throw wrong(`Az ügyfélnek nincs ${year}. évi adóprofilja.`);
  const { annualOf, questionnaireDue } = await import('./eves-zaras.js');
  const due0 = questionnaireDue(year, profile.regime);
  const due = due0 < addDays(today, 14) ? addDays(today, 14) : due0;
  const now = deps.now();
  const existing = await annualOf(db, cl.id, year);
  if (existing && existing.status !== 'nem_indult') return existing;
  const values = { status: 'kerdoiv' as const, regime: profile.regime, questionnaireDue: due, openedManuallyBy: actor.userId, openedManuallyAt: now, updatedAt: now };
  const [row] = existing
    ? await db.update(annualClosings).set(values).where(eq(annualClosings.id, existing.id)).returning()
    : await db.insert(annualClosings).values({ clientId: cl.id, taxYear: year, createdAt: now, ...values }).returning();
  await audit(db, { action: 'annual.opened_manually', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: row!.id, clientId: cl.id, details: { year, lifecycle: cl.lifecycle } });
  await notify(deps, db, { userId: cl.userId, kind: 'annual_due', variant: 'kerdoiv', params: { ...(await accountantParams(db, cl.accountantId)), hatarido: huDayMonthIg(due) }, link: '/eves-zaras' });
  return row!;
}

// ---------------------------------------------------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------------------------------------------------
export async function settlementView(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow): Promise<AnnualSettlementView | null> {
  if (!r.filedSzjaAt || r.diffHuf == null) return null;
  const { evesKapcsolok } = await import('./kata.js');
  const k = await evesKapcsolok(db);
  const ap = await accountantParams(db, cl.accountantId);
  const profile = await profileOf(db, cl.id, r.taxYear);
  const due = settlementDue(r, profile);
  const [p] = r.settlementPeriodId ? await db.select().from(taxPeriods).where(and(eq(taxPeriods.id, r.settlementPeriodId), periodVisible)).limit(1) : [];
  const t = (path: string, params: Params = {}) => evesText(deps, path, { ...ap, ...params });
  let text: string | null;
  if (r.regime === 'kata') text = r.diffHuf > 0 ? await t('beadva.kataKulonado', { osszeg: fmt(r.diffHuf), hatarido: huDayMonthIg(due) }) : await t('beadva.kataNincs');
  else if (r.diffHuf > 0) text = await t('beadva.fizetendo', { osszeg: fmt(r.diffHuf), hatarido: huDayMonthIg(due) });
  else if (r.diffHuf < 0) text = await t('beadva.visszajar', { osszeg: fmt(-r.diffHuf) });
  else text = await t('beadva.nulla');
  if (p?.paymentStatus === 'ellenorizve') text = await t('beadva.rendezve');
  let refund: AnnualSettlementView['refund'] = null;
  if (r.regime === 'atalany' && r.diffHuf < 0 && r.refundStatus) {
    const acc = refundAccountMasked(deps, r);
    const st = r.refundStatus;
    const line =
      st === 'megerkezett'
        ? await t('visszajaro.megjott', { osszeg: fmt(r.refundReceivedHuf ?? -r.diffHuf), datum: r.refundReceivedOn ? huDayMonth(r.refundReceivedOn) : '' })
        : st === 'beszamitva'
          ? await t('visszajaro.beszamitva')
          : st === 'atvezetve'
            ? await t('visszajaro.atvezetve')
            : !k.refundDatumUgyfelnek || !r.refundExpectedBy
              ? await t('visszajaro.szovegDatumNelkul')
              : acc
                ? await t('visszajaro.szoveg', { szamla: acc, datum: huDayMonth(r.refundExpectedBy) })
                : await t('visszajaro.szovegNincsSzamla', { datum: huDayMonth(r.refundExpectedBy) });
    refund = {
      expectedBy: r.refundExpectedBy ?? null,
      status: st,
      receivedOn: r.refundReceivedOn ?? null,
      receivedHuf: r.refundReceivedHuf ?? null,
      markedBy: r.refundMarkedBy ?? null,
      note: r.refundNote ?? null,
      title: await t('visszajaro.cim', { osszeg: fmt(-r.diffHuf) }),
      text: line,
      canMark: st === 'var',
    };
  }
  // the accountant's line (the panel card): what is due and where it stands, not the client's tegező sentence
  const ps = p?.paymentStatus ?? null;
  const what = r.regime === 'kata' ? 'Fizetendő különadó' : 'Fizetendő különbözet';
  const staffText =
    r.diffHuf > 0
      ? `${what}: ${fmt(r.diffHuf)} Ft, határidő: ${huDayMonth(due)}. ${ps === 'ellenorizve' ? 'Ellenőrizve.' : ps === 'befizetve_jelezve' ? 'Az ügyfél befizetettnek jelölte: ellenőrizd a folyószámlán.' : ps === 'elteres' ? 'Eltérést jelöltél.' : 'Még nem jelölte befizetettnek.'}`
      : r.diffHuf < 0 && r.regime === 'atalany'
        ? `Visszajár: ${fmt(-r.diffHuf)} Ft${r.refundExpectedBy ? `, várható: ${huDayMonthIg(r.refundExpectedBy)}` : ''} (a NAV utalja). ${r.refundStatus === 'var' ? (r.refundMarkedBy === 'ugyfel' ? 'Az ügyfél jelölte, hogy megérkezett.' : 'Még nem érkezett meg.') : 'Rögzítve.'}`
        : r.regime === 'kata'
          ? 'Nincs különadó.'
          : 'Nincs különbözet.';
  return { diffHuf: r.diffHuf, filedOn: r.filedSzjaOn ?? null, filingRef: r.szjaFilingRef ?? null, periodId: p?.id ?? null, paymentStatus: ps, refund, text, staffText };
}

/** Σ the year's HIPA advance items the client marked or the accountant verified (the prefill of E). */
async function hipaAdvancesPaid(db: DbOrTx, clientId: string, year: number): Promise<number | null> {
  const rows = await db
    .select({ amountHuf: taxPaymentItems.amountHuf, markedPaidAt: taxPaymentItems.markedPaidAt, verification: taxPaymentItems.verification })
    .from(taxPaymentItems)
    .innerJoin(taxPeriods, eq(taxPeriods.id, taxPaymentItems.taxPeriodId))
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'hipa'), periodVisible, isNull(taxPaymentItems.voidedAt)));
  const paid = rows.filter((i) => i.markedPaidAt || i.verification === 'rendben');
  return paid.length ? paid.reduce((a, b) => a + b.amountHuf, 0) : null;
}

export function hipaView(r: AnnualRow): AnnualHipaView {
  const h = r.hipaAmounts;
  return {
    needed: r.hipaNeeded,
    taxHuf: h?.taxHuf ?? null,
    advancesHuf: h?.advancesHuf ?? null,
    diffHuf: h && h.taxHuf != null ? n0(h.taxHuf) - n0(h.advancesHuf) : null,
    returnNeeded: h?.returnNeeded ?? null,
    filedOn: r.filedHipaOn ?? null,
    filingRef: r.hipaFilingRef ?? null,
    periodId: r.hipaPeriodId ?? null,
  };
}

/** "Mikor mi jön" (terv 3.1): the year's to-dos with their state; the first open one is "Most". */
export async function annualTimeline(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow): Promise<AnnualTimelineItem[]> {
  const y = r.taxYear;
  const today = todayBudapest(deps.now());
  const ap = await accountantParams(db, cl.accountantId);
  const profile = await profileOf(db, cl.id, y);
  const t = (path: string) => evesText(deps, path, { ...ap, ev: y });
  const filed = Boolean(r.filedSzjaAt);
  const after = (s: string[]) => s.includes(r.status);
  type Row = Omit<AnnualTimelineItem, 'status' | 'dateLabel'> & { done: boolean; start?: boolean; ig?: boolean };
  const rows: Row[] = [];
  const add = async (key: string, date: string, path: string, who: Row['who'], done: boolean, o: { start?: boolean; ig?: boolean; link?: string | null; subPath?: string; titlePath?: string } = {}) => {
    const sub = await t(`${o.subPath ?? path}.sub`).catch(() => '');
    rows.push({ key, date, title: await t(o.titlePath ?? `${path}.title`), sub: sub || null, who, done, start: o.start, ig: o.ig, link: o.link ?? null });
  };
  // javító kör 11-21: once filed with a difference to pay, the row says what is left ("Utald el a különbözetet")
  const payLeft = filed && r.diffHuf != null && r.diffHuf > 0;
  const [settle] = r.settlementPeriodId ? await db.select().from(taxPeriods).where(and(eq(taxPeriods.id, r.settlementPeriodId), periodVisible)).limit(1) : [];
  const paidOrNothing = r.diffHuf == null || r.diffHuf <= 0 || (settle ? ['befizetve_jelezve', 'ellenorizve'].includes(settle.paymentStatus) : false);
  const hipaApplies = profile?.hipaMethod !== 'nincs' && r.hipaNeeded;
  const hipaDone = Boolean(r.filedHipaAt) || r.hipaAmounts?.returnNeeded === false;
  const approvalDue = `${y + 1}-${EV_RULES.approvalDue[r.regime === 'kata' ? 'kata' : 'atalany']}`;
  if (r.regime === 'kata') {
    if (today <= `${y}-12-31`) await add('ev_vege', `${y}-12-31`, 'idovonal.evVegeKata', 'te', false, { start: true });
    await add('nyitas', `${y + 1}-${ANNUAL_RULES.openMonthDay}`, 'idovonal.nyitas', 'te', r.status !== 'nem_indult', { start: true });
    await add('kerdoiv', r.questionnaireDue, 'idovonal.kerdoiv', 'te', Boolean(r.submittedAt) || after(['konyvelonel', 'jovahagyasra_var', 'beadva', 'kesz']), { link: r.status === 'kerdoiv' ? '/eves-zaras/kerdoiv' : null });
    await add('keszites', r.questionnaireDue, 'idovonal.keszitesKata', 'konyvelo', after(['jovahagyasra_var', 'beadva', 'kesz']), { start: true });
    await add('jovahagyas', approvalDue, 'idovonal.jovahagyas', 'te', Boolean(r.approvedAt) || filed || r.status === 'kesz', { link: r.status === 'jovahagyasra_var' ? '/eves-zaras/jovahagyas' : null });
    await add('beadas', settlementDue(r, profile), 'idovonal.beadasKata', 'kozos', (filed && paidOrNothing) || r.status === 'kesz', { link: settle ? `/fizetes/${settle.id}` : null, ...(payLeft ? { titlePath: 'beadvaUtaldKata' } : {}) });
  } else {
    await add('nyitas', `${y + 1}-${ANNUAL_RULES.openMonthDay}`, 'idovonal.nyitas', 'te', r.status !== 'nem_indult', { start: true });
    const [q4] = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.periodKey, `${y}-Q4`), periodVisible)).limit(1);
    if (q4) {
      const q4done = q4.calcStatus === 'jovahagyva' && ['befizetve_jelezve', 'ellenorizve', 'nincs_fizetendo'].includes(q4.paymentStatus);
      await add('q4', q4.dueDate, profile?.status === 'nyugdijas' ? 'idovonal.q4Nyugdijas' : 'idovonal.q4', 'te', q4done, { link: q4.calcStatus === 'jovahagyva' ? `/fizetes/${q4.id}` : null });
    }
    await add('kerdoiv', r.questionnaireDue, 'idovonal.kerdoiv', 'te', Boolean(r.submittedAt) || after(['konyvelonel', 'jovahagyasra_var', 'beadva', 'kesz']), { link: r.status === 'kerdoiv' ? '/eves-zaras/kerdoiv' : null });
    await add('keszites', `${y + 1}-03-15`, 'idovonal.keszites', 'konyvelo', after(['jovahagyasra_var', 'beadva', 'kesz']), { start: true });
    await add('jovahagyas', approvalDue, 'idovonal.jovahagyas', 'te', Boolean(r.approvedAt) || filed || r.status === 'kesz', { link: r.status === 'jovahagyasra_var' ? '/eves-zaras/jovahagyas' : null });
    await add('beadas', settlementDue(r, profile), 'idovonal.beadas', 'kozos', (filed && paidOrNothing) || r.status === 'kesz', { link: settle ? `/fizetes/${settle.id}` : null, ...(payLeft ? { titlePath: 'beadvaUtald' } : {}) });
    // the refund is expected BY that day (Art. 64. § (1)): "május 20-ig", never "-ától"; it never turns "lejárt" for the client
    if (filed && r.diffHuf != null && r.diffHuf < 0 && r.refundExpectedBy) await add('visszajar', r.refundExpectedBy, 'idovonal.visszajar', 'nav', Boolean(r.refundStatus && r.refundStatus !== 'var'), { start: true, ig: true });
  }
  if (hipaApplies) await add('hipa', nextWorkingDay(`${y + 1}-${ANNUAL_RULES.legalDue.hipa}`), 'idovonal.hipa', 'kozos', hipaDone || r.status === 'kesz', { link: r.hipaPeriodId ? `/fizetes/${r.hipaPeriodId}` : null });
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let mostGiven = false;
  return rows.map((x) => {
    let status: AnnualTimelineStatus;
    if (x.done) status = 'kesz';
    else if (!x.start && x.date < today) status = 'lejart';
    else if (!mostGiven) {
      status = 'most';
      mostGiven = true;
    } else status = 'kovetkezik';
    const { done: _d, start, ig, ...rest } = x;
    return { ...rest, dateLabel: ig ? huDayMonthIg(x.date) : start ? huDayMonthTol(x.date) : huDayMonth(x.date), status };
  });
}

/** The extra fields of AnnualView (summary + hash while it waits for the client, settlement, timeline, HIPA, corrections). */
export async function annualExtras(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow): Promise<Partial<AnnualView>> {
  const out: Partial<AnnualView> = {};
  const settled = r.status === 'beadva' || r.status === 'kesz';
  out.summary = settled && r.approvedSummary ? r.approvedSummary : r.amounts ? await buildSummary(deps, db, cl, r) : null;
  if (r.status === 'jovahagyasra_var') {
    const d = await draftOf(db, cl.id, r);
    const { draftHash } = await import('./eves-zaras.js');
    out.approvalHash = d ? (r.amounts ? approvalHashFor(d.id, r) : draftHash(d.id, null)) : null;
  } else out.approvalHash = null;
  out.settlement = await settlementView(deps, db, cl, r);
  const hp = await profileOf(db, cl.id, r.taxYear);
  out.hipa = { ...hipaView(r), advancesPaidHuf: await hipaAdvancesPaid(db, cl.id, r.taxYear), method: hp?.hipaMethod ?? null };
  if (r.status !== 'nem_indult' || r.taxYear < Number(todayBudapest(deps.now()).slice(0, 4))) {
    out.timeline = await annualTimeline(deps, db, cl, r);
    const next = out.timeline.find((x) => x.status === 'most' || x.status === 'kovetkezik' || x.status === 'lejart');
    out.timelineNext = next ? await evesText(deps, 'kovetkezo', { datum: next.dateLabel, mi: next.title }) : null;
  } else {
    out.timeline = [];
    out.timelineNext = null;
  }
  const { clientCorrectionList } = await import('./onellenorzes.js');
  out.corrections = await clientCorrectionList(deps, db, cl);
  return out;
}

/** Staff extras: the amounts, the estimate, the prefill, the warnings, the manual-open state. */
export async function annualStaffExtras(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow) {
  const pre = r.status === 'konyvelonel' || r.status === 'jovahagyasra_var' ? await annualPrefill(deps, db, cl, r) : { prefill: null, estimate: (r.engineEstimate ?? null) as AnnualEstimate | null, warnings: [] as string[] };
  return {
    amounts: r.amounts ?? null,
    engineEstimate: (pre.estimate ?? (r.engineEstimate as AnnualEstimate | null)) ?? null,
    prefill: pre.prefill,
    warnings: pre.warnings,
    manualOpen: await manualOpenState(deps, db, cl),
    closedManuallyReason: r.closedManuallyReason ?? null,
    approvedSummary: r.approvedSummary ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------------------------------------------------
/** Job refund_watch (daily): the expected refund date passed and nobody marked it → one task for the accountant. */
export async function jobRefundWatch(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const { clients } = await import('../db/schema.js');
  const rows = await db.select({ a: annualClosings, c: clients }).from(annualClosings).innerJoin(clients, eq(clients.id, annualClosings.clientId)).where(eq(annualClosings.refundStatus, 'var'));
  const { notifyOnce } = await import('./emlekezteto.js');
  let n = 0;
  for (const { a, c } of rows) {
    if (!a.refundExpectedBy || a.refundExpectedBy >= today) continue;
    const acc = await accountantUserOf(db, c);
    if (!acc) continue;
    if (await notifyOnce(deps, `tt:visszajaro:${a.id}`, { userId: acc.userId, kind: 'tax_task', variant: 'visszajaro_kesik', params: { clientName: clientName(c), datum: huDayMonth(a.refundExpectedBy) }, link: `/ugyfelek/${c.id}/eves`, data: { clientId: c.id } })) n++;
  }
  return n;
}

const LAST_YEAR_WRITES = /\/client\/(annual\/[^/]+\/(answers|submit|approve|refund-received)|tax-periods\/[^/]+\/(mark-paid|unmark-paid)|corrections\/[^/]+\/approve|fees\/[^/]+\/pay)$/;
/**
 * A former client ('megszunt') may still finish his last year's closing when the switch lemondottEvesZaras is not 'ki' and
 * a closing of his is open: these writes only (HIANYLISTA 1.7, TULAJ T4).
 */
export async function lastYearClosingWrite(deps: Deps, clientId: string, path: string): Promise<boolean> {
  if (!LAST_YEAR_WRITES.test(path)) return false;
  const { evesKapcsolok } = await import('./kata.js');
  if ((await evesKapcsolok(deps.db)).lemondottEvesZaras === 'ki') return false;
  const [open] = await deps.db
    .select({ id: annualClosings.id })
    .from(annualClosings)
    .where(and(eq(annualClosings.clientId, clientId), inArray(annualClosings.status, ['kerdoiv', 'dijra_var', 'konyvelonel', 'jovahagyasra_var', 'beadva'])))
    .limit(1);
  return Boolean(open);
}

/** The approval due of the client (MM-DD of EV_RULES.approvalDue, next year). */
export function approvalDueOf(r: Pick<AnnualRow, 'taxYear' | 'regime'>): string {
  return `${r.taxYear + 1}-${EV_RULES.approvalDue[r.regime === 'kata' ? 'kata' : 'atalany']}`;
}


