// Tax periods, calculations and payment items (SPEC §5.6, §6.3, §7). The engine is pure; this
// module feeds it from the DB, stores versioned calculations and runs the approval flow.
import { fmt as fmtHuf } from './kedvezmeny.js';
import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { DocumentListItem, Letter, PaymentItem, TaxPeriodDetail, TaxPeriodSummary } from '../_shared/api.js';
import type { PaymentItemKind } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import {
  accountants,
  clients,
  clientTaxProfiles,
  documents,
  documentStatusHistory,
  navInvoices,
  revenueItems,
  taxCalculations,
  taxPaymentItems,
  taxPeriods,
} from '../db/schema.js';
import { addDays, daysBetween, huDayMonth, huFullDate, monthName, MONTHS_ADJ_HU, quarterLabel, todayBudapest } from '../lib/dates.js';
import { KATA_EXEMPT_LABELS, type KataExemptKind } from '../_shared/kata.js';
import { E } from '../lib/errors.js';
import { calculateYear, deadlinesFor, ibanHu, NAV_ACCOUNTS, type QuarterResult, type TaxProfileInput, type YearInput, type YearResult } from '../tax/engine.js';
import { accountantParams, notify } from '../notify/notify.js';
import { audit } from '../audit.js';
import { allowancesForEngine, answersRow } from './kedvezmeny.js';

export type PeriodRow = typeof taxPeriods.$inferSelect;
export type CalcRow = typeof taxCalculations.$inferSelect;
type ProfileRow = typeof clientTaxProfiles.$inferSelect;

/**
 * SPEC §32: a hidden row (a KATA year's átalány quarters, a month no longer KATA) is never shown, reminded or counted.
 * Every client- and job-side query of tax_periods uses it (test/kata-f1.test.ts checks the source files).
 */
export const periodVisible = isNull(taxPeriods.hiddenAt);

/** SPEC §32.B: the payment periods that follow a filed yearly return or an önellenőrzés (always approved, made by hand). */
export const ANNUAL_PERIOD_KINDS = ['eves_szja', 'kata_eves', 'hipa_eves', 'onellenorzes'] as const;
export function isAnnualPeriodKind(k: string): k is (typeof ANNUAL_PERIOD_KINDS)[number] {
  return (ANNUAL_PERIOD_KINDS as readonly string[]).includes(k);
}

export function periodLabel(p: Pick<PeriodRow, 'kind' | 'quarter' | 'periodKey' | 'year'> & { filingForm?: string | null }): string {
  if (p.kind === 'negyedev' && p.quarter) return quarterLabel(p.quarter);
  // SPEC §32.B
  if (p.kind === 'eves_szja') return `Szja-különbözet ${p.year}`;
  if (p.kind === 'kata_eves') return `Kata-különadó ${p.year}`;
  if (p.kind === 'hipa_eves') return `Iparűzési adó ${p.year}: különbözet`;
  if (p.kind === 'onellenorzes') return p.filingForm ? `Önellenőrzés: ${p.filingForm}` : 'Önellenőrzés';
  // SPEC §32: "Kata – november" (key 'YYYY-MM-KATA')
  if (p.kind === 'kata') return `Kata – ${monthName(Number(p.periodKey.slice(5, 7)))}`;
  // No unexplained "HIPA" for the client. Sávos (the usual case) has one advance a year; only the
  // általános method has a second instalment (HIPA-2).
  if (p.periodKey.endsWith('HIPA-1')) return `${p.year}. évi iparűzési adóelőleg`;
  if (p.periodKey.endsWith('HIPA-2')) return `${p.year}. évi iparűzési adóelőleg, 2. részlet`;
  return p.periodKey;
}

/** "III. negyedévi" */
export function periodAdj(p: Pick<PeriodRow, 'kind' | 'quarter' | 'periodKey' | 'year'> & { filingForm?: string | null }): string {
  if (p.kind === 'kata') return `${MONTHS_ADJ_HU[Number(p.periodKey.slice(5, 7)) - 1] ?? ''} kata`;
  // SPEC §32.B
  if (p.kind === 'eves_szja') return `${p.year}. évi szja-különbözet`;
  if (p.kind === 'kata_eves') return `${p.year}. évi kata-különadó`;
  if (p.kind === 'hipa_eves') return `${p.year}. évi iparűzésiadó-különbözet`;
  if (p.kind === 'onellenorzes') return 'önellenőrzési';
  return p.kind === 'negyedev' ? `${periodLabel(p)}i` : periodLabel(p);
}

/** SPEC §32: the KATA kinds of insurance_breaks are read by the átalány engine as 'kieso' (szünetelés stays). */
function engineBreaks(list: ProfileRow['insuranceBreaks']): NonNullable<TaxProfileInput['insuranceBreaks']> {
  return (list ?? []).map((b) => ({ from: b.from, to: b.to, kind: b.kind === 'szunetel' ? 'szunetel' : 'kieso' }));
}

/**
 * SPEC §32: the KATA part of a year – [kataFrom, kataTo] of a KATA profile, or of an átalány profile whose KATA ended
 * during the year (kataTo set; a "vegyes év"). null = no KATA that year.
 */
export function kataRangeOfProfile(p: Pick<ProfileRow, 'regime' | 'kataFrom' | 'kataTo' | 'year'> | null | undefined): { from: string; to: string } | null {
  if (!p) return null;
  const yStart = `${p.year}-01-01`;
  const yEnd = `${p.year}-12-31`;
  if (p.regime === 'kata') {
    const from = p.kataFrom && p.kataFrom > yStart ? p.kataFrom : yStart;
    const to = p.kataTo && p.kataTo < yEnd ? p.kataTo : yEnd;
    return from <= to ? { from, to } : null;
  }
  if (p.kataTo && p.kataTo >= yStart && p.kataTo <= yEnd) return { from: p.kataFrom && p.kataFrom > yStart ? p.kataFrom : yStart, to: p.kataTo };
  return null;
}

/** All three months of the quarter are KATA months (a started month counts): no átalány quarter for it (H1). */
export function quarterFullyKata(range: { from: string; to: string } | null, year: number, quarter: number): boolean {
  if (!range) return false;
  const firstMonth = `${year}-${String(quarter * 3 - 2).padStart(2, '0')}`;
  const lastMonth = `${year}-${String(quarter * 3).padStart(2, '0')}`;
  return range.from.slice(0, 7) <= firstMonth && range.to.slice(0, 7) >= lastMonth;
}

/** SPEC §32: any month of the year is KATA (the KATA months come from services/kata.ts). */
export async function kataRangeOf(db: DbOrTx, clientId: string, year: number): Promise<{ from: string; to: string } | null> {
  const [tp] = await db.select({ regime: clientTaxProfiles.regime, kataFrom: clientTaxProfiles.kataFrom, kataTo: clientTaxProfiles.kataTo, year: clientTaxProfiles.year }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year))).limit(1);
  return kataRangeOfProfile(tp);
}

/** The quarter is entirely in the KATA part of its year. */
export async function isKataQuarter(db: DbOrTx, clientId: string, year: number, quarter: number): Promise<boolean> {
  return quarterFullyKata(await kataRangeOf(db, clientId, year), year, quarter);
}

export const KATA_NO_QUARTER = 'Katás évben nincs átalányos negyedév.';

export function profileInput(p: ProfileRow, o: { legacyAllowances?: boolean } = {}): TaxProfileInput {
  return {
    year: p.year,
    costRatio: p.costRatio as 45 | 80 | 90,
    status: p.status,
    guaranteedMinimum: p.guaranteedMinimum,
    atalanyFrom: p.atalanyFrom ?? undefined,
    retail: p.retail,
    insuranceBreaks: engineBreaks(p.insuranceBreaks),
    hipa: { method: p.hipaMethod, ratePct: Number(p.hipaRatePct) },
    priorOverrides: p.priorOverrides ?? undefined,
    // NAV 100 ch. 4: családi kedvezmény, 25 év alattiak, anyák, első házasok – not modelled, but their
    // presence shows the 'kedvezmeny_nem_modellezett' warning to client and accountant.
    ...(p.allowances?.length && o.legacyAllowances !== false ? { allowances: p.allowances } : {}),
  };
}

export async function getProfile(db: DbOrTx, clientId: string, year: number): Promise<ProfileRow | null> {
  const [p] = await db
    .select()
    .from(clientTaxProfiles)
    .where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year)))
    .limit(1);
  return p ?? null;
}

/**
 * SPEC §27.11 T1 (round-2 tax BLOCKER): the sums the accountant APPROVED for a closed quarter are the prior
 * sums of the later quarters, so revenue that lands in a closed quarter afterwards (late invoice, a received
 * date moved to the bank statement's day) is carried into the next open quarter instead of vanishing. A manual
 * override at approval counts too (SZJA as given; the TB base scaled by the overridden TB). The engine warns the
 * accountant ("Lezárt negyedév bevétele változott – nézd át") when the recomputed revenue differs.
 */
export async function approvedQuarterActuals(db: DbOrTx, clientId: string, year: number): Promise<NonNullable<YearInput['approvedQuarters']>> {
  const rows = await db
    .select({ quarter: taxPeriods.quarter, result: taxCalculations.result, overrides: taxCalculations.overrides })
    .from(taxPeriods)
    .innerJoin(taxCalculations, eq(taxCalculations.id, taxPeriods.approvedCalculationId))
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'negyedev'), eq(taxPeriods.calcStatus, 'jovahagyva')));
  const out: NonNullable<YearInput['approvedQuarters']> = [];
  for (const r of rows) {
    const q = (r.result as Partial<CalcResultJson> | null)?.quarter as Partial<QuarterResult> | undefined;
    if (!r.quarter || r.quarter < 1 || r.quarter > 4 || !q || !Array.isArray(q.months) || typeof q.szjaAdvanceHuf !== 'number') continue;
    let baseSum = q.months.reduce((a, m) => a + (typeof m?.baseHuf === 'number' ? m.baseHuf : 0), 0);
    const ov = r.overrides;
    if (ov?.tbHuf !== undefined && typeof q.tbHuf === 'number' && q.tbHuf > 0) baseSum = Math.round((baseSum * ov.tbHuf) / q.tbHuf);
    const szja = ov?.szjaAdvanceHuf ?? q.szjaAdvanceHuf;
    if (!Number.isSafeInteger(baseSum) || baseSum < 0 || !Number.isSafeInteger(szja) || szja < 0) continue;
    out.push({
      quarter: r.quarter as 1 | 2 | 3 | 4,
      baseSumHuf: baseSum,
      szjaAdvanceHuf: szja,
      ...(typeof q.revenueHuf === 'number' && Number.isSafeInteger(q.revenueHuf) ? { revenueHuf: q.revenueHuf } : {}),
      // k7c2: the csjk the approval contained (none when the allowance came later) – the engine keeps it that way
      csjkHuf: typeof q.csjkHuf === 'number' && Number.isSafeInteger(q.csjkHuf) && q.csjkHuf > 0 ? q.csjkHuf : 0,
    });
  }
  return out.sort((a, b) => a.quarter - b.quarter);
}

export async function engineInput(db: DbOrTx, clientId: string, year: number, asOf: string): Promise<YearInput | null> {
  const profile = await getProfile(db, clientId, year);
  if (!profile) return null;
  const items = await db
    .select()
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), isNull(revenueItems.deletedAt), sql`(${revenueItems.receivedOn} between ${`${year}-01-01`} and ${`${year}-12-31`} or ${revenueItems.deliveryDate} between ${`${year}-01-01`} and ${`${year}-12-31`})`));
  const approvedQuarters = await approvedQuarterActuals(db, clientId, year);
  // SPEC §28.3.7 e: the approved, in-year allowances; the legacy one-line flags stop once the questionnaire exists.
  const kedvezmenyek = await allowancesForEngine(db, clientId, year);
  const hasAnswers = Boolean(await answersRow(db, clientId, year));
  return {
    profile: { ...profileInput(profile, { legacyAllowances: !hasAnswers }), ...(kedvezmenyek ? { kedvezmenyek } : {}) },
    asOf,
    ...(approvedQuarters.length ? { approvedQuarters } : {}),
    revenue: items.map((i) => ({
      receivedOn: i.receivedOn,
      deliveryDate: i.deliveryDate,
      amountHuf: i.amountHuf,
      countsForAtalany: i.countsForAtalany,
      countsForAfaLimit: i.countsForAfaLimit,
      estimated: i.receivedOnEstimated,
    })),
  };
}

export async function computeYear(db: DbOrTx, clientId: string, year: number, asOf: string): Promise<{ input: YearInput; result: YearResult } | null> {
  const input = await engineInput(db, clientId, year, asOf);
  if (!input) return null;
  return { input, result: calculateYear(input) };
}

/** Ensures Q1–Q4 (+ the HIPA advances of the client's method) period rows exist for the year. */
export async function ensurePeriods(
  db: DbOrTx,
  clientId: string,
  year: number,
  hipaMethod: 'savos' | 'altalanos' | 'nincs' | boolean = 'nincs',
  status?: 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas',
): Promise<PeriodRow[]> {
  // NAV 100 ch. 6.3: a nyugdíjas átalányadózó pays neither TB nor szocho and files no '58 return –
  // only the SZJA-előleg is paid. Their quarters carry no filing form.
  const filingForm = status === 'nyugdijas' ? null : '2658';
  const method = hipaMethod === true ? 'savos' : hipaMethod === false ? 'nincs' : hipaMethod;
  const cal = deadlinesFor(year, { hipaMethod: method });
  // SPEC §32 H1: no átalány quarter for the months of a KATA. A quarter entirely in the KATA part of the year is not
  // created, and a not approved one is hidden (never deleted); an approved or filed one stays (the panel shows it, the
  // accountant decides). A quarter only partly in the KATA ("vegyes év") stays: the accountant computes it by hand [D27].
  // Back to átalány → the hidden quarters come back.
  const range = await kataRangeOf(db, clientId, year);
  const existingQ = await db.select({ id: taxPeriods.id, periodKey: taxPeriods.periodKey, quarter: taxPeriods.quarter, hiddenAt: taxPeriods.hiddenAt, hiddenReason: taxPeriods.hiddenReason, calcStatus: taxPeriods.calcStatus, filingStatus: taxPeriods.filingStatus }).from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'negyedev')));
  for (const e of existingQ) {
    const full = quarterFullyKata(range, year, e.quarter ?? 0);
    if (full && !e.hiddenAt && e.calcStatus !== 'jovahagyva' && e.filingStatus !== 'beadva') {
      await db.update(taxPeriods).set({ hiddenAt: new Date(), hiddenReason: 'kata_ev' }).where(eq(taxPeriods.id, e.id));
      await audit(db, { action: 'tax.period_hidden', actorRole: 'system', targetType: 'tax_period', targetId: e.id, clientId, details: { periodKey: e.periodKey, reason: 'kata_ev' } });
    } else if (!full && e.hiddenAt && e.hiddenReason === 'kata_ev') {
      await db.update(taxPeriods).set({ hiddenAt: null, hiddenReason: null }).where(eq(taxPeriods.id, e.id));
    }
  }
  const want: { kind: 'negyedev' | 'hipa'; key: string; quarter: number | null; due: string }[] = [];
  for (const d of cal) {
    if (d.kind !== 'befizetes' || !d.periodKey) continue;
    const q = /^\d{4}-Q([1-4])$/.exec(d.periodKey);
    if (q) {
      if (!quarterFullyKata(range, year, Number(q[1]))) want.push({ kind: 'negyedev', key: d.periodKey, quarter: Number(q[1]), due: d.dueDate });
    } else if (/^\d{4}-HIPA-\d$/.test(d.periodKey) && method !== 'nincs') want.push({ kind: 'hipa', key: d.periodKey, quarter: null, due: d.dueDate });
  }
  for (const w of want) {
    await db
      .insert(taxPeriods)
      .values({ clientId, kind: w.kind, periodKey: w.key, year, quarter: w.quarter, dueDate: w.due, filingForm: w.kind === 'negyedev' ? filingForm : null })
      .onConflictDoNothing();
  }
  if (status)
    await db
      .update(taxPeriods)
      .set({ filingForm })
      .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'negyedev'), sql`${taxPeriods.filingStatus} <> 'beadva'`, sql`${taxPeriods.filingForm} is distinct from ${filingForm}`));
  return db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), periodVisible)).orderBy(asc(taxPeriods.dueDate));
}

function quarterSnapshot(year: YearResult, q: QuarterResult) {
  return {
    quarter: q,
    meters: year.meters,
    hipa: year.hipa,
    warnings: [...year.warnings, ...q.warnings],
    disclaimer: year.disclaimer,
    engineVersion: year.engineVersion,
    rulesVersion: year.rulesVersion,
  };
}
export type CalcResultJson = ReturnType<typeof quarterSnapshot>;

/**
 * Recalculates the estimate of every not-approved quarter of the year. A new calculation version
 * is stored only when the quarter result changed. Returns the year result.
 */
export async function recalcYear(deps: Deps, db: DbOrTx, clientId: string, year: number, o: { asOf?: string; by?: string | null } = {}): Promise<YearResult | null> {
  const asOf = o.asOf ?? todayBudapest(deps.now());
  const comp = await computeYear(db, clientId, year, asOf);
  if (!comp) return null;
  const periods = await ensurePeriods(db, clientId, year, comp.input.profile.hipa?.method ?? 'nincs', comp.input.profile.status);
  // SPEC §32 H1: no átalány estimate for a quarter that touches a KATA month (fully KATA: no row at all; partly: the
  // accountant computes the "vegyes év" by hand [D27]). The KATA months come from services/kata.ts.
  const kRange = await kataRangeOf(db, clientId, year);
  for (const q of comp.result.quarters) {
    const p = periods.find((x) => x.periodKey === q.periodKey);
    if (!p || p.calcStatus === 'jovahagyva') continue;
    if (kRange && kRange.from.slice(0, 7) <= `${year}-${String(q.quarter * 3).padStart(2, '0')}` && kRange.to.slice(0, 7) >= `${year}-${String(q.quarter * 3 - 2).padStart(2, '0')}`) continue;
    const quarterStart = `${year}-${String(q.quarter * 3 - 2).padStart(2, '0')}-01`;
    if (quarterStart > asOf) continue;
    const snap = quarterSnapshot(comp.result, q);
    const [latest] = await db.select().from(taxCalculations).where(eq(taxCalculations.taxPeriodId, p.id)).orderBy(desc(taxCalculations.version)).limit(1);
    const same = latest && JSON.stringify((latest.result as CalcResultJson).quarter) === JSON.stringify(q) && !latest.approvedAt;
    if (same) continue;
    const [calc] = await db
      .insert(taxCalculations)
      .values({
        taxPeriodId: p.id,
        version: (latest?.version ?? 0) + 1,
        engineVersion: comp.result.engineVersion,
        rulesVersion: comp.result.rulesVersion,
        asOf,
        input: comp.input,
        result: snap,
        calculatedBy: o.by ?? null,
      })
      .returning({ id: taxCalculations.id });
    await db.update(taxPeriods).set({ calcStatus: 'becsles', latestCalculationId: calc!.id, updatedAt: deps.now() }).where(eq(taxPeriods.id, p.id));
  }
  return comp.result;
}

/** A fresh calculation version of one quarter (accountant "Számolás"). */
export async function calculatePeriod(deps: Deps, db: DbOrTx, clientId: string, periodKey: string, asOf: string, by: string): Promise<CalcRow> {
  if (/^\d{4}-HIPA-\d$/.test(periodKey))
    // k7b (KONYVELO_LEFEDETTSEG, 1. hiba): the panel's Adó tab shows the advance with its own approval form
    throw E.conflict('Az iparűzési adóelőleget nem a motor számolja: az összeg az előző évi adóból jön. Az Adó fülön kattints az előleg kártyájára, add meg az összeget és az önkormányzat számlaszámát, és nyomd meg: „Jóváhagyom és elküldöm”.');
  const m = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (!m) throw E.validation({ periodKey: 'Negyedév kulcs kell, pl. 2026-Q3.' });
  const year = Number(m[1]);
  if (await isKataQuarter(db, clientId, year, Number(m[2]))) throw E.conflict(KATA_NO_QUARTER);
  const comp = await computeYear(db, clientId, year, asOf);
  if (!comp) throw E.conflict('Előbb add meg az ügyfél adóprofilját erre az évre.');
  const periods = await ensurePeriods(db, clientId, year, comp.input.profile.hipa?.method ?? 'nincs', comp.input.profile.status);
  const p = periods.find((x) => x.periodKey === periodKey);
  const q = comp.result.quarters.find((x) => x.periodKey === periodKey);
  if (!p || !q) throw E.conflict('Ez a negyedév még nem kezdődött el, nincs mit számolni.');
  const [latest] = await db.select().from(taxCalculations).where(eq(taxCalculations.taxPeriodId, p.id)).orderBy(desc(taxCalculations.version)).limit(1);
  const [calc] = await db
    .insert(taxCalculations)
    .values({
      taxPeriodId: p.id,
      version: (latest?.version ?? 0) + 1,
      engineVersion: comp.result.engineVersion,
      rulesVersion: comp.result.rulesVersion,
      asOf,
      input: comp.input,
      result: quarterSnapshot(comp.result, q),
      calculatedBy: by,
    })
    .returning();
  if (p.calcStatus !== 'jovahagyva')
    await db.update(taxPeriods).set({ calcStatus: 'becsles', latestCalculationId: calc!.id, updatedAt: deps.now() }).where(eq(taxPeriods.id, p.id));
  else await db.update(taxPeriods).set({ latestCalculationId: calc!.id, updatedAt: deps.now() }).where(eq(taxPeriods.id, p.id));
  await audit(db, { action: 'tax.calculated', actorUserId: by, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId, details: { periodKey, version: calc!.version, asOf } });
  return calc!;
}

export interface ApproveInput {
  overrides?: { tbHuf?: number; szochoHuf?: number; szjaAdvanceHuf?: number; reason: string } | null;
  letterText: string;
}

/** Approve: payment items created, letter published, client notified (SPEC §6.3). */
export async function approveCalculation(deps: Deps, db: DbOrTx, calcId: string, accountantUserId: string, accountantId: string, inp: ApproveInput): Promise<PeriodRow> {
  const [calc] = await db.select().from(taxCalculations).where(eq(taxCalculations.id, calcId)).limit(1);
  if (!calc) throw E.notFound();
  const [p] = await db.select().from(taxPeriods).where(eq(taxPeriods.id, calc.taxPeriodId)).limit(1);
  if (!p) throw E.notFound();
  const [cl] = await db.select().from(clients).where(and(eq(clients.id, p.clientId), eq(clients.accountantId, accountantId))).limit(1);
  if (!cl) throw E.notFound();
  if (p.calcStatus === 'jovahagyva') throw E.conflict('Ez a negyedév már jóvá van hagyva. Előbb nyisd újra.');
  if (p.hiddenAt || (p.kind === 'negyedev' && p.quarter && (await isKataQuarter(db, p.clientId, p.year, p.quarter)))) throw E.conflict(KATA_NO_QUARTER);
  if (p.latestCalculationId && p.latestCalculationId !== calc.id) throw E.conflict('Van újabb számolás ehhez a negyedévhez. Azt hagyd jóvá.');
  const snap = calc.result as CalcResultJson;
  const q = snap.quarter;
  const ov = inp.overrides ?? null;
  if (ov && (ov.tbHuf !== undefined || ov.szochoHuf !== undefined || ov.szjaAdvanceHuf !== undefined) && !ov.reason?.trim()) throw E.validation({ 'overrides.reason': 'Írd le röviden, miért módosítod.' });
  const amounts: Record<'tb_jarulek' | 'szocho' | 'szja_eloleg', number> = {
    tb_jarulek: ov?.tbHuf ?? q.tbHuf,
    szocho: ov?.szochoHuf ?? q.szochoHuf,
    szja_eloleg: ov?.szjaAdvanceHuf ?? q.szjaAdvanceHuf,
  };
  const now = deps.now();
  await db.update(taxPaymentItems).set({ voidedAt: now }).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt)));
  const reference = cl.adoszam ?? '';
  const navAcc = { tb_jarulek: NAV_ACCOUNTS.tb, szocho: NAV_ACCOUNTS.szocho, szja_eloleg: NAV_ACCOUNTS.szja } as const;
  const defs: { kind: 'tb_jarulek' | 'szocho' | 'szja_eloleg'; label: string; sublabel: string | null }[] = [
    { kind: 'tb_jarulek', label: 'TB-járulék', sublabel: null },
    { kind: 'szocho', label: 'Szocho', sublabel: 'szociális hozzájárulási adó' },
    { kind: 'szja_eloleg', label: 'SZJA-előleg', sublabel: null },
  ];
  let total = 0;
  for (const d of defs) {
    const amount = amounts[d.kind];
    if (!amount || amount <= 0) continue;
    total += amount;
    const line = q.payments.find((x) => x.kind === d.kind);
    const a = navAcc[d.kind];
    await db.insert(taxPaymentItems).values({
      taxPeriodId: p.id,
      calculationId: calc.id,
      kind: d.kind,
      label: line?.label ?? d.label,
      sublabel: line?.sublabel ?? d.sublabel,
      amountHuf: amount,
      dueDate: p.dueDate,
      accountName: line?.accountName ?? a.name,
      accountNumber: line?.accountNumber ?? a.number,
      iban: line?.iban ?? a.iban ?? ibanHu(a.number),
      reference,
    });
  }
  await db
    .update(taxCalculations)
    .set({ overrides: ov && (ov.tbHuf !== undefined || ov.szochoHuf !== undefined || ov.szjaAdvanceHuf !== undefined) ? ov : null, letterText: inp.letterText.trim(), approvedBy: accountantUserId, approvedAt: now, publishedAt: now })
    .where(eq(taxCalculations.id, calc.id));
  const [updated] = await db
    .update(taxPeriods)
    .set({ calcStatus: 'jovahagyva', approvedCalculationId: calc.id, latestCalculationId: calc.id, paymentStatus: total > 0 ? 'fizetendo' : 'nincs_fizetendo', updatedAt: now })
    .where(eq(taxPeriods.id, p.id))
    .returning();
  await audit(db, { action: 'tax.approved', actorUserId: accountantUserId, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId: cl.id, details: { periodKey: p.periodKey, totalHuf: total, overridden: Boolean(ov) } });
  const ap = await accountantParams(db, accountantId);
  // The real number of transfers: 3 only when TB, szocho and SZJA are all due (főfoglalkozású below
  // the tax-free part: 2; nyugdíjas: 1; mellékállás below it: 0 → a "nothing to pay" text).
  const transfers = (Object.values(amounts) as number[]).filter((a) => a > 0).length;
  await notify(deps, db, {
    userId: cl.userId,
    kind: 'tax_approved',
    // A quarter approved after its deadline (e.g. one that predates joining) must not say "utald el október 12-ig".
    ...(total <= 0 ? { variant: 'zero' } : p.dueDate < todayBudapest(now) ? { variant: 'overdue' } : {}),
    params: { ...ap, period: periodLabel(p), periodAdj: periodAdj(p), amount: ft(total), dueDateText: huDayMonth(p.dueDate).replace(/\.$/, ''), count: transfers, transfersText: transfersText(transfers) },
    link: '/',
    data: { periodId: p.id },
  });
  return updated!;
}

/** "egy utalással" / "két külön utalással" / "három külön utalással" */
export function transfersText(n: number): string {
  if (n <= 1) return 'egy utalással';
  return `${['', '', 'két', 'három', 'négy', 'öt'][n] ?? String(n)} külön utalással`;
}

export interface ManualPeriodItem {
  kind: PaymentItemKind;
  label: string;
  sublabel?: string | null;
  amountHuf: number;
  account: { name: string; number: string; iban?: string | null };
  adonem: string | null;
}

/**
 * SPEC §32.B: a payment period made by hand (the difference of a filed yearly return, an önellenőrzés): approved at once,
 * with its items; idempotent by (client, periodKey) – an existing row with live items is returned as it is.
 */
export async function createManualPeriod(
  deps: Deps,
  db: DbOrTx,
  i: {
    clientId: string;
    kind: (typeof ANNUAL_PERIOD_KINDS)[number];
    periodKey: string;
    year: number;
    dueDate: string;
    items: ManualPeriodItem[];
    reference: string;
    filingForm?: string | null;
    filingRef?: string | null;
    correctionId?: string | null;
  },
): Promise<PeriodRow> {
  const now = deps.now();
  // visible-ok: the lookup by the unique key of the row this function makes
  const [existing] = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, i.clientId), eq(taxPeriods.periodKey, i.periodKey))).limit(1);
  if (existing && (await activeItems(db, existing.id)).length) return existing;
  const items = i.items.filter((x) => x.amountHuf > 0);
  const status = items.length ? ('fizetendo' as const) : ('nincs_fizetendo' as const);
  const [p] = existing
    ? await db
        .update(taxPeriods)
        .set({ calcStatus: 'jovahagyva', paymentStatus: status, dueDate: i.dueDate, hiddenAt: null, hiddenReason: null, filingForm: i.filingForm ?? existing.filingForm, filingRef: i.filingRef ?? existing.filingRef, correctionId: i.correctionId ?? existing.correctionId, updatedAt: now })
        .where(eq(taxPeriods.id, existing.id))
        .returning()
    : await db
        .insert(taxPeriods)
        .values({ clientId: i.clientId, kind: i.kind, periodKey: i.periodKey, year: i.year, quarter: null, dueDate: i.dueDate, calcStatus: 'jovahagyva', paymentStatus: status, filingForm: i.filingForm ?? null, filingRef: i.filingRef ?? null, correctionId: i.correctionId ?? null, createdAt: now, updatedAt: now })
        .returning();
  for (const it of items)
    await db.insert(taxPaymentItems).values({
      taxPeriodId: p!.id,
      calculationId: null,
      kind: it.kind,
      label: it.label,
      sublabel: it.sublabel ?? null,
      amountHuf: it.amountHuf,
      dueDate: i.dueDate,
      accountName: it.account.name,
      accountNumber: it.account.number,
      iban: it.account.iban ?? ibanHu(it.account.number),
      reference: i.reference,
      adonem: it.adonem,
      createdAt: now,
    });
  await audit(db, { action: 'tax.manual_period', actorRole: 'system', targetType: 'tax_period', targetId: p!.id, clientId: i.clientId, details: { kind: i.kind, periodKey: i.periodKey, totalHuf: items.reduce((a, b) => a + b.amountHuf, 0) } });
  return p!;
}

export interface HipaApproveInput {
  amountHuf: number;
  /** The municipality's iparűzési adó beszedési számla (GIRO, 2×8 or 3×8 digits). Default: the tax profile's. */
  accountNumber?: string | null;
}

/**
 * Iparűzési adóelőleg, approved by hand (FUNKCIOK 8): the sávos advance equals LAST year's tax
 * (Htv. 39/A. § (9)), which the engine cannot know, so the accountant types the amount. Creates the
 * payment item on the municipality's account and notifies the client; no calculation row.
 */
export async function approveHipaManual(deps: Deps, db: DbOrTx, periodId: string, accountantUserId: string, accountantId: string, inp: HipaApproveInput): Promise<PeriodRow> {
  const [p] = await db.select().from(taxPeriods).where(eq(taxPeriods.id, periodId)).limit(1);
  if (!p || p.kind !== 'hipa') throw E.notFound();
  const [cl] = await db.select().from(clients).where(and(eq(clients.id, p.clientId), eq(clients.accountantId, accountantId))).limit(1);
  if (!cl) throw E.notFound();
  if (p.calcStatus === 'jovahagyva') throw E.conflict('Ez az előleg már jóvá van hagyva. Előbb nyisd újra.');
  const profile = await getProfile(db, cl.id, p.year);
  const number = (inp.accountNumber ?? profile?.hipaAccountNumber ?? '').trim();
  if (inp.amountHuf > 0 && !/^\d{8}-\d{8}(-\d{8})?$/.test(number))
    throw E.validation({ accountNumber: 'Add meg az önkormányzat iparűzésiadó-számláját (pl. 11784009-15400017-03540000).' });
  const now = deps.now();
  await db.update(taxPaymentItems).set({ voidedAt: now }).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt)));
  if (inp.amountHuf > 0) {
    const town = cl.hqMunicipality?.trim();
    await db.insert(taxPaymentItems).values({
      taxPeriodId: p.id,
      calculationId: null,
      kind: 'hipa_eloleg',
      label: 'Iparűzési adóelőleg',
      sublabel: town ? `helyi iparűzési adó, ${town}` : 'helyi iparűzési adó',
      amountHuf: inp.amountHuf,
      dueDate: p.dueDate,
      accountName: town ? `${town} önkormányzata – iparűzési adó beszedési számla` : 'Önkormányzat – iparűzési adó beszedési számla',
      accountNumber: number,
      iban: ibanHu(number),
      reference: cl.adoszam ?? '',
    });
    if (profile && !profile.hipaAccountNumber) await db.update(clientTaxProfiles).set({ hipaAccountNumber: number }).where(eq(clientTaxProfiles.id, profile.id));
  }
  const [updated] = await db
    .update(taxPeriods)
    .set({ calcStatus: 'jovahagyva', paymentStatus: inp.amountHuf > 0 ? 'fizetendo' : 'nincs_fizetendo', updatedAt: now })
    .where(eq(taxPeriods.id, p.id))
    .returning();
  await audit(db, { action: 'tax.hipa_approved', actorUserId: accountantUserId, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId: cl.id, details: { periodKey: p.periodKey, totalHuf: inp.amountHuf } });
  if (inp.amountHuf > 0) {
    const ap = await accountantParams(db, accountantId);
    await notify(deps, db, {
      userId: cl.userId,
      kind: 'tax_approved',
      variant: p.dueDate < todayBudapest(now) ? 'hipa_overdue' : 'hipa',
      params: { ...ap, period: periodLabel(p), periodAdj: periodAdj(p), amount: ft(inp.amountHuf), dueDateText: huDayMonth(p.dueDate).replace(/\.$/, '') },
      link: '/hataridok',
      data: { periodId: p.id },
    });
  }
  return updated!;
}

/** Corrects the published letter of an approved quarter; amounts and payment items stay as they are. */
export async function updateLetter(deps: Deps, db: DbOrTx, periodId: string, accountantUserId: string, accountantId: string, letterText: string): Promise<void> {
  const [p] = await db.select().from(taxPeriods).where(eq(taxPeriods.id, periodId)).limit(1);
  if (!p) throw E.notFound();
  const [cl] = await db.select().from(clients).where(and(eq(clients.id, p.clientId), eq(clients.accountantId, accountantId))).limit(1);
  if (!cl) throw E.notFound();
  if (p.calcStatus !== 'jovahagyva' || !p.approvedCalculationId) throw E.conflict('Ennek a negyedévnek még nincs jóváhagyott levele.');
  await db.update(taxCalculations).set({ letterText: letterText.trim() }).where(eq(taxCalculations.id, p.approvedCalculationId));
  await audit(db, { action: 'tax.letter_updated', actorUserId: accountantUserId, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId: cl.id, details: { periodKey: p.periodKey } });
  const ap = await accountantParams(db, accountantId);
  await notify(deps, db, { userId: cl.userId, kind: 'tax_reopened', variant: 'neutral', params: { ...ap, period: periodLabel(p), periodAdj: periodAdj(p) }, link: '/' });
}

export async function reopenPeriod(deps: Deps, db: DbOrTx, periodId: string, accountantUserId: string, accountantId: string, reason: string): Promise<void> {
  const [p] = await db.select().from(taxPeriods).where(eq(taxPeriods.id, periodId)).limit(1);
  if (!p) throw E.notFound();
  const [cl] = await db.select().from(clients).where(and(eq(clients.id, p.clientId), eq(clients.accountantId, accountantId))).limit(1);
  if (!cl) throw E.notFound();
  if (p.calcStatus !== 'jovahagyva') throw E.conflict('Ez a negyedév nincs jóváhagyva.');
  if (p.filingStatus === 'beadva') throw E.conflict('A bevallás már be van adva; ezt a NAV-nál kell önellenőrzéssel javítani. Az Önellenőrzés fülön indíthatod.');
  if (isAnnualPeriodKind(p.kind)) throw E.conflict('Ez egy beadott bevallás befizetése, nem nyitható újra. Ha javítani kell, indíts önellenőrzést.');
  const now = deps.now();
  await db.update(taxPaymentItems).set({ voidedAt: now }).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt)));
  await db.update(taxPeriods).set({ calcStatus: p.kind === 'hipa' ? 'nincs' : 'becsles', approvedCalculationId: null, paymentStatus: 'nincs_fizetendo', updatedAt: now }).where(eq(taxPeriods.id, p.id));
  await audit(db, { action: 'tax.reopened', actorUserId: accountantUserId, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId: cl.id, details: { periodKey: p.periodKey, reasonLength: reason.length } });
  const ap = await accountantParams(db, accountantId);
  await notify(deps, db, { userId: cl.userId, kind: 'tax_reopened', params: { ...ap, period: periodLabel(p), periodAdj: periodAdj(p) }, link: '/' });
  await recalcYear(deps, db, cl.id, p.year, { by: accountantUserId });
}

export function ft(n: number): string {
  return `${fmtHuf(n)} Ft`;
}

export function paymentItemDto(i: typeof taxPaymentItems.$inferSelect): PaymentItem {
  return {
    id: i.id,
    kind: i.kind,
    label: i.label,
    sublabel: i.sublabel ?? undefined,
    amountHuf: i.amountHuf,
    dueDate: i.dueDate,
    accountName: i.accountName,
    accountNumber: i.accountNumber,
    iban: i.iban,
    reference: i.reference,
    markedPaidAt: i.markedPaidAt?.toISOString(),
    markedPaidOn: i.markedPaidOn ?? undefined,
    verifiedAt: i.verifiedAt?.toISOString(),
    verification: i.verification ?? undefined,
  };
}

export async function activeItems(db: DbOrTx, periodId: string) {
  return db
    .select()
    .from(taxPaymentItems)
    .where(and(eq(taxPaymentItems.taxPeriodId, periodId), isNull(taxPaymentItems.voidedAt)))
    .orderBy(sql`case ${taxPaymentItems.kind} when 'tb_jarulek' then 1 when 'szocho' then 2 when 'szja_eloleg' then 3 else 4 end`);
}

export async function periodTotal(db: DbOrTx, p: PeriodRow): Promise<number | null> {
  if (p.calcStatus === 'jovahagyva') {
    const items = await activeItems(db, p.id);
    return items.reduce((a, b) => a + b.amountHuf, 0);
  }
  if (p.latestCalculationId) {
    const [c] = await db.select({ result: taxCalculations.result }).from(taxCalculations).where(eq(taxCalculations.id, p.latestCalculationId)).limit(1);
    return (c?.result as CalcResultJson | undefined)?.quarter.totalHuf ?? null;
  }
  return null;
}

export async function periodSummary(db: DbOrTx, p: PeriodRow): Promise<TaxPeriodSummary> {
  return {
    id: p.id,
    periodKey: p.periodKey,
    kind: p.kind,
    label: periodLabel(p),
    dueDate: p.dueDate,
    calcStatus: p.calcStatus,
    paymentStatus: p.paymentStatus,
    filingStatus: p.filingStatus,
    totalHuf: await periodTotal(db, p),
  };
}

export async function letterFor(db: DbOrTx, p: PeriodRow, clientFirstName: string, acc: { displayName: string } | null): Promise<Letter | null> {
  if (!p.approvedCalculationId) return null;
  const [c] = await db.select().from(taxCalculations).where(eq(taxCalculations.id, p.approvedCalculationId)).limit(1);
  if (!c?.letterText) return null;
  return {
    greeting: `Kedves ${clientFirstName}!`,
    body: c.letterText,
    signedBy: acc?.displayName ?? '',
    signedRole: 'könyvelőd',
    date: todayBudapest(c.approvedAt ?? new Date()),
  };
}

export async function periodDetail(db: DbOrTx, p: PeriodRow, clientFirstName: string, accountantId: string | null, docList: (ids: string[]) => Promise<DocumentListItem[]>): Promise<TaxPeriodDetail> {
  const [acc] = accountantId ? await db.select().from(accountants).where(eq(accountants.id, accountantId)).limit(1) : [];
  const items = p.calcStatus === 'jovahagyva' ? await activeItems(db, p.id) : [];
  let explanation = null;
  let disclaimer: string | null = null;
  const calcId = p.calcStatus === 'jovahagyva' ? p.approvedCalculationId : p.latestCalculationId;
  if (calcId) {
    const [c] = await db.select().from(taxCalculations).where(eq(taxCalculations.id, calcId)).limit(1);
    const snap = c?.result as CalcResultJson | undefined;
    if (snap) {
      explanation = snap.quarter.explanation;
      if (c?.overrides && p.calcStatus === 'jovahagyva') {
        explanation = {
          ...explanation,
          lines: [...explanation.lines, { label: 'A könyvelőd módosította az összeget', note: c.overrides.reason }],
          result: `Összesen: ${ft(items.reduce((a, b) => a + b.amountHuf, 0))}`,
        };
      }
      disclaimer = p.calcStatus === 'jovahagyva' ? null : snap.disclaimer;
    }
  }
  const ids = [p.returnDocumentId, p.receiptDocumentId].filter((x): x is string => Boolean(x));
  return {
    ...(await periodSummary(db, p)),
    items: items.map(paymentItemDto),
    explanation,
    disclaimer,
    letter: await letterFor(db, p, clientFirstName, acc ?? null),
    filed: p.filingStatus === 'beadva' ? { filedOn: p.filedOn ?? todayBudapest(p.filedAt ?? new Date()), documents: ids.length ? await docList(ids) : [] } : null,
    // SPEC §32: the payment sheet's title and a free KATA month's reason
    sheetTitle: periodLabel(p),
    ...(p.kind === 'kata' ? { exemptReasonLabel: p.exemptReason ? (KATA_EXEMPT_LABELS[p.exemptReason as KataExemptKind] ?? p.exemptReason) : null } : {}),
  };
}

/** Payment status of an approved period from its active items (one rule for mark, unmark and verify). */
export function paymentStatusOf(items: { markedPaidAt: Date | null; verification: string | null }[]): PeriodRow['paymentStatus'] {
  if (!items.length) return 'nincs_fizetendo';
  if (items.some((i) => i.verification === 'elteres')) return 'elteres';
  if (items.every((i) => i.verification === 'rendben')) return 'ellenorizve';
  if (items.every((i) => i.markedPaidAt || i.verification === 'rendben')) return 'befizetve_jelezve';
  return 'fizetendo';
}

export async function markPaid(deps: Deps, db: DbOrTx, clientId: string, periodId: string, kinds: PaymentItemKind[] | undefined, paidOn: string, userId: string): Promise<PeriodRow> {
  const [p] = await db.select().from(taxPeriods).where(and(eq(taxPeriods.id, periodId), eq(taxPeriods.clientId, clientId), periodVisible)).limit(1);
  if (!p) throw E.notFound();
  if (p.calcStatus !== 'jovahagyva') throw E.conflict('Ezt még nem hagyta jóvá a könyvelőd. Várd meg a végleges összeget.');
  const today = todayBudapest(deps.now());
  if (paidOn > today) throw E.validation({ paidOn: 'A befizetés napja nem lehet a jövőben.' });
  if (paidOn < addDays(today, -400)) throw E.validation({ paidOn: 'Túl régi dátum.' });
  const items = await activeItems(db, p.id);
  const wanted = items.filter((i) => !kinds || kinds.includes(i.kind));
  if (!wanted.length) throw E.validation({ kinds: 'Nincs ilyen tétel.' });
  // An item the accountant already found in order stays as it is: marking it again must not wipe the
  // verification or move the period back to "befizetve jelezve" (round 1, 2026-11-19).
  const target = wanted.filter((i) => i.verification !== 'rendben');
  if (!target.length) throw E.conflict('Ezt a befizetést a könyvelőd már ellenőrizte, nincs vele teendőd.');
  const now = deps.now();
  await db
    .update(taxPaymentItems)
    .set({ markedPaidAt: now, markedPaidOn: paidOn, verifiedAt: null, verifiedBy: null, verification: null, verificationNote: null })
    .where(inArray(taxPaymentItems.id, target.map((t) => t.id)));
  const after = await activeItems(db, p.id);
  const [updated] = await db
    .update(taxPeriods)
    .set({ paymentStatus: paymentStatusOf(after), updatedAt: now })
    .where(eq(taxPeriods.id, p.id))
    .returning();
  await audit(db, { action: 'tax.payment_marked', actorUserId: userId, actorRole: 'client', targetType: 'tax_period', targetId: p.id, clientId, details: { kinds: target.map((t) => t.kind), paidOn } });
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const [accUser] = cl?.accountantId ? await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  if (accUser && cl)
    await notify(deps, db, {
      userId: accUser.userId,
      kind: 'client_marked_paid',
      params: { clientName: `${cl.lastName} ${cl.firstName}`, period: periodLabel(p), amount: ft(target.reduce((a, b) => a + b.amountHuf, 0)), paidOn },
      link: `/ugyfelek/${clientId}/ado`,
      data: { clientId, periodId: p.id },
    });
  return updated!;
}

export async function unmarkPaid(deps: Deps, db: DbOrTx, clientId: string, periodId: string, kinds: PaymentItemKind[] | undefined, userId: string): Promise<PeriodRow> {
  const [p] = await db.select().from(taxPeriods).where(and(eq(taxPeriods.id, periodId), eq(taxPeriods.clientId, clientId), periodVisible)).limit(1);
  if (!p) throw E.notFound();
  const items = await activeItems(db, p.id);
  const target = items.filter((i) => (!kinds || kinds.includes(i.kind)) && !i.verifiedAt);
  if (target.length) await db.update(taxPaymentItems).set({ markedPaidAt: null, markedPaidOn: null }).where(inArray(taxPaymentItems.id, target.map((t) => t.id)));
  // The status follows the items: a period whose transfers the accountant verified stays verified.
  const after = await activeItems(db, p.id);
  const [updated] = await db
    .update(taxPeriods)
    .set({ paymentStatus: paymentStatusOf(after), updatedAt: deps.now() })
    .where(eq(taxPeriods.id, p.id))
    .returning();
  await audit(db, { action: 'tax.payment_unmarked', actorUserId: userId, actorRole: 'client', targetType: 'tax_period', targetId: p.id, clientId, details: { kinds: target.map((t) => t.kind) } });
  return updated!;
}

export async function verifyPayment(
  deps: Deps,
  db: DbOrTx,
  periodId: string,
  accountantUserId: string,
  accountantId: string,
  checks: { kind: PaymentItemKind; verification: 'rendben' | 'elteres'; note?: string }[],
): Promise<PeriodRow> {
  const [p] = await db.select().from(taxPeriods).where(eq(taxPeriods.id, periodId)).limit(1);
  if (!p) throw E.notFound();
  const [cl] = await db.select().from(clients).where(and(eq(clients.id, p.clientId), eq(clients.accountantId, accountantId))).limit(1);
  if (!cl) throw E.notFound();
  const items = await activeItems(db, p.id);
  const now = deps.now();
  for (const ch of checks) {
    const it = items.find((i) => i.kind === ch.kind);
    if (!it) continue;
    await db
      .update(taxPaymentItems)
      .set({ verifiedAt: now, verifiedBy: accountantUserId, verification: ch.verification, verificationNote: ch.note ?? null })
      .where(eq(taxPaymentItems.id, it.id));
  }
  const after = await activeItems(db, p.id);
  const anyMismatch = after.some((i) => i.verification === 'elteres');
  const allOk = after.length > 0 && after.every((i) => i.verification === 'rendben');
  const status = anyMismatch ? 'elteres' : allOk ? 'ellenorizve' : p.paymentStatus;
  const [updated] = await db.update(taxPeriods).set({ paymentStatus: status, updatedAt: now }).where(eq(taxPeriods.id, p.id)).returning();
  await audit(db, { action: 'tax.payment_verified', actorUserId: accountantUserId, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId: cl.id, details: { status } });
  const ap = await accountantParams(db, accountantId);
  // The iparűzési adóelőleg goes to the önkormányzat, not to NAV: its own wording (variant 'hipa').
  // SPEC §32.B: the yearly differences and the önellenőrzés have their own "látta" wording too.
  const variants: Record<string, string> = { hipa: 'hipa', kata: 'kata', eves_szja: 'eves', kata_eves: 'kata_kulonado', hipa_eves: 'hipa_eves', onellenorzes: 'onell' };
  const okVariant = variants[p.kind] ? { variant: variants[p.kind]! } : {};
  const mismatchVariant = p.kind === 'hipa' || p.kind === 'kata' ? okVariant : {};
  const honap = p.kind === 'kata' ? monthName(Number(p.periodKey.slice(5, 7))) : undefined;
  const link = p.kind === 'hipa' ? '/hataridok' : p.kind === 'kata' || isAnnualPeriodKind(p.kind) ? `/fizetes/${p.id}` : '/';
  if (status === 'ellenorizve') await notify(deps, db, { userId: cl.userId, kind: 'tax_payment_verified', ...okVariant, params: { ...ap, period: periodLabel(p), periodAdj: periodAdj(p), honap }, link });
  if (status === 'elteres') await notify(deps, db, { userId: cl.userId, kind: 'tax_payment_mismatch', ...mismatchVariant, params: { ...ap, period: periodLabel(p), periodAdj: periodAdj(p), honap }, link: '/uzenetek' });
  // SPEC §32.B: a verified difference may finish the annual closing or settle the önellenőrzés
  if (isAnnualPeriodKind(p.kind) && status === 'ellenorizve') await (await import('./eves-ciklus.js')).afterSettlementVerified(deps, db, updated!);
  return updated!;
}

/** Only these dossier categories belong to a quarter's return; contracts, certificates, NAV letters, earlier
 *  returns and the like keep their own status when a quarter is filed (QA kör 2). */
export const FILING_DOC_CATEGORIES = ['nyugta', 'penztargep_osszesito', 'bankszamlakivonat', 'koltseg_bizonylat', 'kiallitott_szamla_kezi'] as const;

/** Last day of the period: quarter end, or 31 December for the yearly HIPA return. */
export function periodEndDay(p: Pick<PeriodRow, 'kind' | 'year' | 'quarter'>): string {
  if (p.kind === 'negyedev' && p.quarter) {
    const m = p.quarter * 3;
    const last = new Date(Date.UTC(p.year, m, 0)).getUTCDate();
    return `${p.year}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  return `${p.year}-12-31`;
}

function quarterMonths(p: Pick<PeriodRow, 'year' | 'quarter'>): string[] {
  return [0, 1, 2].map((i) => `${p.year}-${String(p.quarter! * 3 - 2 + i).padStart(2, '0')}`);
}

export interface FilingCheck {
  canFile: boolean;
  reason: string | null;
  periodEnd: string;
  /** Tax-relevant documents of the quarter the accountant has not finished yet (Feltöltve / látta). */
  openDocuments: number;
}

/** Whether "Beadottnak jelölöm" is allowed now – the same rules markFiled enforces. */
export async function filingCheck(db: DbOrTx, p: PeriodRow, today: string): Promise<FilingCheck> {
  const periodEnd = periodEndDay(p);
  let openDocuments = 0;
  if (p.kind === 'negyedev' && p.quarter) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(
          eq(documents.clientId, p.clientId),
          inArray(documents.dossierMonth, quarterMonths(p)),
          inArray(documents.category, [...FILING_DOC_CATEGORIES]),
          inArray(documents.status, ['feltoltve', 'konyvelo_latta']),
          isNull(documents.deletedAt),
        ),
      );
    openDocuments = row?.n ?? 0;
  }
  let reason: string | null = null;
  if (p.filingStatus === 'beadva') reason = 'Ez az időszak már be van adva.';
  else if (p.kind === 'hipa') reason = 'Az iparűzési adóelőleghez nincs külön bevallás. Az éves iparűzésiadó-bevallást a következő év május végéig adod be.';
  else if (p.kind === 'kata') reason = 'A katához nincs havi bevallás: a havi összeget csak be kell fizetni. Az éves kata-nyilatkozatot az Éves zárás fülön rögzíted.';
  else if (isAnnualPeriodKind(p.kind)) reason = 'Ehhez nincs külön bevallás ezen a lapon: az éves bevallást az Éves zárás fül, az önellenőrzést az Önellenőrzés fül rögzíti.';
  else if (p.kind === 'negyedev' && p.filingForm === null) reason = 'Nyugdíjas átalányadózónak nincs negyedéves járulékbevallása (2658), csak az SZJA-előleget fizeti be.';
  else if (today <= periodEnd) reason = `Az időszak még tart (${huFullDate(periodEnd)} a vége), ezért még nem adható be.`;
  else if (p.calcStatus !== 'jovahagyva') reason = 'Előbb hagyd jóvá az összeget, utána jelöld beadottnak.';
  return { canFile: reason === null, reason, periodEnd, openDocuments };
}

/** Filed: return + receipt attached, quarter documents feldolgozva → beadva (SPEC §6.3). */
export async function markFiled(
  deps: Deps,
  db: DbOrTx,
  periodId: string,
  accountantUserId: string,
  accountantId: string,
  f: { filedOn: string; form: string; returnDocumentId: string; receiptDocumentId: string | null },
): Promise<PeriodRow> {
  const [p] = await db.select().from(taxPeriods).where(eq(taxPeriods.id, periodId)).limit(1);
  if (!p) throw E.notFound();
  const [cl] = await db.select().from(clients).where(and(eq(clients.id, p.clientId), eq(clients.accountantId, accountantId))).limit(1);
  if (!cl) throw E.notFound();
  const now = deps.now();
  // A filing cannot be undone (reopen is refused once beadva), so the server enforces the rules, not only the UI.
  const today = todayBudapest(now);
  const check = await filingCheck(db, p, today);
  if (!check.canFile) throw E.conflict(check.reason!);
  if (f.filedOn <= check.periodEnd) throw E.validation({ filedOn: 'A beadás napja az időszak vége utáni nap lehet.' });
  if (f.filedOn > today) throw E.validation({ filedOn: 'Jövőbeli napot nem adhatsz meg.' });
  const [updated] = await db
    .update(taxPeriods)
    .set({ filingStatus: 'beadva', filedAt: now, filedOn: f.filedOn, filedBy: accountantUserId, filingForm: f.form, returnDocumentId: f.returnDocumentId, receiptDocumentId: f.receiptDocumentId, updatedAt: now })
    .where(eq(taxPeriods.id, p.id))
    .returning();
  for (const id of [f.returnDocumentId, f.receiptDocumentId].filter((x): x is string => Boolean(x))) {
    await db.update(documents).set({ relatedPeriodId: p.id, status: 'beadva', statusChangedAt: now, visibility: 'kozos' }).where(and(eq(documents.id, id), eq(documents.clientId, cl.id)));
  }
  let moved = 0;
  if (p.kind === 'negyedev' && p.quarter) {
    const months = quarterMonths(p);
    const docs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.clientId, cl.id),
          inArray(documents.dossierMonth, months),
          inArray(documents.category, [...FILING_DOC_CATEGORIES]),
          eq(documents.status, 'feldolgozva'),
          isNull(documents.deletedAt),
        ),
      );
    for (const d of docs) {
      await db.update(documents).set({ status: 'beadva', statusChangedAt: now }).where(eq(documents.id, d.id));
      await db.insert(documentStatusHistory).values({ documentId: d.id, fromStatus: 'feldolgozva', toStatus: 'beadva', changedBy: accountantUserId, note: `${periodLabel(p)} bevallás` });
    }
    moved = docs.length;
    await db
      .update(navInvoices)
      .set({ status: 'beadva', statusChangedAt: now })
      .where(and(eq(navInvoices.clientId, cl.id), inArray(navInvoices.dossierMonth, months), inArray(navInvoices.status, ['feltoltve', 'konyvelo_latta', 'feldolgozva'])));
  }
  await audit(db, { action: 'tax.filed', actorUserId: accountantUserId, actorRole: 'accountant', targetType: 'tax_period', targetId: p.id, clientId: cl.id, details: { periodKey: p.periodKey, form: f.form, filedOn: f.filedOn, documentsMoved: moved } });
  const ap = await accountantParams(db, accountantId);
  await notify(deps, db, { userId: cl.userId, kind: 'tax_filed', params: { ...ap, period: periodLabel(p) }, link: '/dosszie' });
  return updated!;
}

/** How long after its deadline a closed, not yet approved quarter still leads the home screen. */
const CLOSED_QUARTER_HERO_DAYS = 14;

/**
 * Hero of the client home (SPEC §12.4 "Hero logic"). `closed`: the period is the quarter that just ended and the
 * accountant has not approved it yet – from the 1st day of the new quarter the home must not drop it ("Most nincs
 * mit fizetned" on 2 January while the IV. quarter is due on the 12th; round 1, 2026-11-19).
 */
export async function heroPeriod(
  db: DbOrTx,
  clientId: string,
  today: string,
): Promise<{ period: PeriodRow; state: 'jovahagyva' | 'befizetve' | 'becsles' | 'nincs_fizetendo'; closed?: boolean; estimateHuf?: number } | null> {
  const open = await db
    .select()
    .from(taxPeriods)
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.kind, 'negyedev'), periodVisible, eq(taxPeriods.calcStatus, 'jovahagyva'), inArray(taxPeriods.paymentStatus, ['fizetendo', 'befizetve_jelezve', 'elteres'])))
    .orderBy(asc(taxPeriods.dueDate));
  if (open.length) {
    const p = open[0]!;
    return { period: p, state: p.paymentStatus === 'befizetve_jelezve' ? 'befizetve' : 'jovahagyva' };
  }
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const q = Math.floor((month - 1) / 3) + 1;
  // The quarter that just closed, while the accountant is finalising it (also across the year boundary).
  const prevKey = q === 1 ? `${year - 1}-Q4` : `${year}-Q${q - 1}`;
  const [prev] = await db
    .select()
    .from(taxPeriods)
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.periodKey, prevKey), periodVisible))
    .limit(1);
  if (prev && prev.calcStatus !== 'jovahagyva' && today <= addDays(prev.dueDate, CLOSED_QUARTER_HERO_DAYS)) {
    // Only quarters that are ours: one that was due before the client joined was the previous accountant's.
    const [cl] = await db.select({ createdAt: clients.createdAt }).from(clients).where(eq(clients.id, clientId)).limit(1);
    const ours = !cl || prev.dueDate >= todayBudapest(cl.createdAt);
    const total = ours ? await closedQuarterEstimate(db, clientId, prev) : null;
    if (total && total > 0) return { period: prev, state: 'becsles', closed: true, estimateHuf: total };
  }
  const [cur] = await db
    .select()
    .from(taxPeriods)
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.periodKey, `${year}-Q${q}`), periodVisible))
    .limit(1);
  if (cur) {
    if (cur.calcStatus === 'jovahagyva') return { period: cur, state: cur.paymentStatus === 'nincs_fizetendo' ? 'nincs_fizetendo' : 'befizetve' };
    const total = await periodTotal(db, cur);
    return { period: cur, state: total && total > 0 ? 'becsles' : 'nincs_fizetendo' };
  }
  const [last] = await db
    .select()
    .from(taxPeriods)
    .where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.kind, 'negyedev'), periodVisible, lte(taxPeriods.dueDate, addDays(today, 120))))
    .orderBy(desc(taxPeriods.dueDate))
    .limit(1);
  return last ? { period: last, state: 'nincs_fizetendo' } : null;
}

/** Estimate of a closed quarter, computed in ITS year (as of the quarter's last day), else the last stored calculation. */
export async function closedQuarterEstimate(db: DbOrTx, clientId: string, p: PeriodRow): Promise<number | null> {
  const comp = await computeYear(db, clientId, p.year, periodEndDay(p));
  const q = comp?.result.quarters.find((x) => x.periodKey === p.periodKey);
  if (q) return q.totalHuf;
  return periodTotal(db, p);
}

export function daysLeft(today: string, due: string): number {
  return daysBetween(today, due);
}
