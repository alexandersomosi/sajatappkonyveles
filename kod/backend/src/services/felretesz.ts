// SPEC §28.1 – "Ennyit tegyél félre": the reserve of every revenue item (how much it adds to the year's SZJA + TB + szocho,
// engine reserveSeries) cached per client and year (reserve_years + revenue_reserves, recomputed lazily when the
// inputs hash changes), the per-invoice one-liner and the home card. Every number is an estimate; the binding amount is
// the quarterly amount the accountant approves.
import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { InvoiceReserveView, ReserveCard, ReserveListItem, ReserveView } from '../_shared/api.js';
import { RESERVE_ROUND_HUF, type ReserveEstimateReason, type ReserveZone } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { clientTaxProfiles, navInvoices, reserveMarks, reserveYears, revenueItems, revenueReserves, taxPeriods } from '../db/schema.js';
import { audit } from '../audit.js';
import { daysBetween, huDayMonthIg, MONTHS_HU, todayBudapest } from '../lib/dates.js';
import { ENGINE_VERSION, reserveSeries, roundReserve, type ReserveItemInput, type YearInput, type YearResult } from '../tax/engine.js';
import { earningsBasis, kb1000 } from './kereset.js';
import { accountantParams } from '../notify/notify.js';
import { activeItems, engineInput, periodLabel } from './tax.js';
import { fmt } from './kedvezmeny.js';
import { allowanceRows } from './kedvezmeny.js';
import type { ClientRow } from './people.js';

type ReserveRow = typeof revenueReserves.$inferSelect;

/** Engine input of the WHOLE year (asOf 31 Dec): every reserve is computed against the year's final rules. */
async function yearInput(db: DbOrTx, clientId: string, year: number): Promise<YearInput | null> {
  return engineInput(db, clientId, year, `${year}-12-31`);
}

async function yearItems(db: DbOrTx, clientId: string, year: number) {
  return db
    .select()
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), isNull(revenueItems.deletedAt), sql`${revenueItems.receivedOn} between ${`${year}-01-01`} and ${`${year}-12-31`}`))
    .orderBy(asc(revenueItems.createdAt), asc(revenueItems.id));
}

function toReserveItems(rows: Awaited<ReturnType<typeof yearItems>>): ReserveItemInput[] {
  return rows.map((i) => ({
    id: i.id,
    arrivalKey: `${i.createdAt.toISOString()}|${i.id}`,
    receivedOn: i.receivedOn,
    deliveryDate: i.deliveryDate,
    amountHuf: i.amountHuf,
    countsForAtalany: i.countsForAtalany,
    countsForAfaLimit: i.countsForAfaLimit,
    estimated: i.receivedOnEstimated,
  }));
}

export function inputsHash(input: YearInput, items: ReserveItemInput[]): string {
  const canon = JSON.stringify({ p: input.profile, a: input.approvedQuarters ?? [], i: items.map((x) => [x.id, x.arrivalKey, x.receivedOn, x.amountHuf, x.countsForAtalany, x.estimated ?? false]), v: ENGINE_VERSION });
  return createHash('sha256').update(canon).digest('hex');
}

/** Test hook: counts recomputations (K1.2 "not otherwise"). */
export const reserveStats = { recomputed: 0 };

/**
 * SPEC §28.1.4: lazy cache. Compares the inputs hash and recomputes only when needed (n + 1 engine runs), in one go
 * (delete + insert of that client-year). Returns the year row, or null without a profile / rules.
 */
export async function ensureReserves(deps: Deps, db: DbOrTx, clientId: string, year: number): Promise<typeof reserveYears.$inferSelect | null> {
  const input = await yearInput(db, clientId, year);
  if (!input) return null;
  const rows = await yearItems(db, clientId, year);
  const items = toReserveItems(rows);
  const hash = inputsHash(input, items);
  const [cur] = await db.select().from(reserveYears).where(and(eq(reserveYears.clientId, clientId), eq(reserveYears.year, year))).limit(1);
  if (cur && cur.inputsHash === hash) return cur;
  let series;
  try {
    series = reserveSeries(input.profile, items, { approvedQuarters: input.approvedQuarters ?? [] });
  } catch {
    return null;
  }
  reserveStats.recomputed++;
  const now = deps.now();
  await db.delete(revenueReserves).where(and(eq(revenueReserves.clientId, clientId), eq(revenueReserves.year, year)));
  for (const l of series.lines) {
    const v = { clientId, year, seq: l.seq, rawHuf: l.rawHuf, reserveHuf: l.reserveHuf, szjaHuf: l.szjaHuf, tbHuf: l.tbHuf, szochoHuf: l.szochoHuf, zone: l.zone, crossesTaxFree: l.crossesTaxFree, estimated: l.estimated, computedAt: now };
    await db.insert(revenueReserves).values({ revenueItemId: l.id, ...v }).onConflictDoUpdate({ target: revenueReserves.revenueItemId, set: v });
  }
  const yv = { inputsHash: hash, baseHuf: series.baseHuf, totalHuf: series.totalHuf, fixedByMonth: series.fixedByMonthHuf, engineVersion: ENGINE_VERSION, computedAt: now };
  const [row] = await db
    .insert(reserveYears)
    .values({ clientId, year, ...yv })
    .onConflictDoUpdate({ target: [reserveYears.clientId, reserveYears.year], set: yv })
    .returning();
  await audit(db, { action: 'reserve.recomputed', actorRole: 'system', targetType: 'client', targetId: clientId, clientId, details: { year, items: series.lines.length } });
  return row ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------
// one invoice
// ---------------------------------------------------------------------------------------------------------------------
export interface ReserveLineData {
  year: number;
  rawHuf: number;
  reserveHuf: number;
  szjaHuf: number;
  tbHuf: number;
  szochoHuf: number;
  zone: ReserveZone;
  crossesTaxFree: boolean;
  estimated: boolean;
}

export async function reserveView(deps: Deps, r: ReserveLineData | null, o: { amountHuf: number; nextYear: boolean; year: number }): Promise<InvoiceReserveView> {
  const zone: ReserveZone = r?.zone ?? 'nincs_adat';
  const felre = fmt(Math.abs(r?.reserveHuf ?? 0));
  const p = { osszeg: fmt(Math.abs(o.amountHuf)), felre };
  let line = await deps.content.render(`felretesz.sor.${zone}`, p);
  if (o.nextYear && zone !== 'nincs_adat') line += await deps.content.get('felretesz.jovore');
  const listKey = zone === 'nincs_adat' ? null : (r?.reserveHuf ?? 0) > 0 ? 'felretesz.lista.felre' : zone === 'sztorno' ? 'felretesz.lista.sztorno' : zone === 'adomentes' ? 'felretesz.lista.adomentes' : 'felretesz.lista.nem_novel';
  const partsKey = zone === 'csak_szja' || zone === 'teljes' || zone === 'kedvezmeny' ? `felretesz.reszek.${zone}` : null;
  return {
    year: r?.year ?? o.year,
    reserveHuf: r?.reserveHuf ?? 0,
    rawHuf: r?.rawHuf ?? 0,
    parts: { szjaHuf: r?.szjaHuf ?? 0, tbHuf: r?.tbHuf ?? 0, szochoHuf: r?.szochoHuf ?? 0 },
    zone,
    crossesTaxFree: r?.crossesTaxFree ?? false,
    estimated: r?.estimated ?? false,
    nextYear: o.nextYear,
    line,
    listLine: listKey ? await deps.content.render(listKey, p) : null,
    partsText: partsKey ? await deps.content.get(partsKey) : null,
    thresholdText: r?.crossesTaxFree ? await deps.content.get('felretesz.kuszob') : null,
  };
}

/** Reserves of NAV invoices by invoice id (each in the year of its receipt; restricted clients get none). */
export async function reservesForInvoices(deps: Deps, db: DbOrTx, clientId: string, invoiceIds: string[]): Promise<Map<string, InvoiceReserveView>> {
  const out = new Map<string, InvoiceReserveView>();
  if (!invoiceIds.length) return out;
  const items = await db
    .select({ id: revenueItems.id, navInvoiceId: revenueItems.navInvoiceId, receivedOn: revenueItems.receivedOn, amountHuf: revenueItems.amountHuf })
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), inArray(revenueItems.navInvoiceId, invoiceIds), isNull(revenueItems.deletedAt)));
  const invs = await db.select({ id: navInvoices.id, issueDate: navInvoices.issueDate, grossHuf: navInvoices.grossHuf }).from(navInvoices).where(inArray(navInvoices.id, invoiceIds));
  const years = [...new Set(items.map((i) => Number(i.receivedOn.slice(0, 4))))];
  for (const y of years) await ensureReserves(deps, db, clientId, y);
  const rr = items.length ? await db.select().from(revenueReserves).where(inArray(revenueReserves.revenueItemId, items.map((i) => i.id))) : [];
  for (const inv of invs) {
    const it = items.find((i) => i.navInvoiceId === inv.id);
    const r = it ? rr.find((x) => x.revenueItemId === it.id) : undefined;
    const year = it ? Number(it.receivedOn.slice(0, 4)) : Number(inv.issueDate.slice(0, 4));
    out.set(inv.id, await reserveView(deps, r ?? null, { amountHuf: inv.grossHuf, nextYear: Boolean(it && it.receivedOn.slice(0, 4) > inv.issueDate.slice(0, 4)), year }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// home card (§28.1.6)
// ---------------------------------------------------------------------------------------------------------------------
async function estimateReasons(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, input: YearInput, rows: ReserveRow[], firstName: string, result: YearResult): Promise<{ code: ReserveEstimateReason; text: string }[]> {
  const codes: ReserveEstimateReason[] = [];
  if (rows.some((r) => r.estimated)) codes.push('fizetesi_hatarido');
  const [tp] = await db.select({ src: clientTaxProfiles.costRatioSource }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
  if (tp?.src === 'ugyfel_javaslat') codes.push('profil_nincs_megerositve');
  if ((await allowanceRows(db, cl.id, year)).some((r) => r.status === 'javasolt' || r.status === 'kerdes')) codes.push('kedvezmeny_jovahagyasra_var');
  if (result.warnings.some((w) => w.code === 'rules_draft')) codes.push('szabalyok_tervezet');
  if (input.profile.priorOverrides) codes.push('elozo_konyvelo');
  const out = [];
  for (const code of codes) out.push({ code, text: await deps.content.render(`felretesz.becsles.${code}`, { firstName }) });
  return out;
}

const ceil1000 = (n: number) => (n <= 0 ? 0 : Math.ceil(n / RESERVE_ROUND_HUF) * RESERVE_ROUND_HUF);

/**
 * Round 2 of 2026-11-19: "eddig" (A) is ONE number – the taxes of the months so far exactly as "Mennyit kerestem?"
 * attributes them (kereset.ts earningsBasis: every tax in the month whose income caused it, the fixed minimum of each
 * month, HIPA by active days, approved quarters as approved), before the year-end settlement (the card is about the
 * cash needed for the payments; what comes back later is said in one sentence). So the card, the "Eddigi adód" and
 * "Mennyit kerestem?" never show two different "eddig" amounts. The rows under it are rounded "kb." values.
 */
export async function reserveCard(deps: Deps, db: DbOrTx, cl: ClientRow, today: string): Promise<ReserveCard | null> {
  const year = Number(today.slice(0, 4));
  const yr = await ensureReserves(deps, db, cl.id, year);
  if (!yr) return null;
  const basis = await earningsBasis(db, cl, year, today);
  if (!basis) return null;
  const { input, result } = basis;
  const params = await accountantParams(db, cl.accountantId);
  const firstName = String(params.firstName);
  const rows = await db
    .select({ r: revenueReserves, receivedOn: revenueItems.receivedOn })
    .from(revenueReserves)
    .innerJoin(revenueItems, eq(revenueItems.id, revenueReserves.revenueItemId))
    .where(and(eq(revenueReserves.clientId, cl.id), eq(revenueReserves.year, year), isNull(revenueItems.deletedAt)));
  const month = Number(today.slice(5, 7));
  const soFar = basis.months.filter((m) => m.month <= month);
  const A = soFar.reduce((a, m) => a + m.szjaHuf + m.tbHuf + m.szochoHuf + m.hipaHuf, 0);
  const fixedHuf = yr.fixedByMonth.slice(0, month).reduce((a, b) => a + b, 0);
  const fixedMonthlyHuf = yr.fixedByMonth[month - 1] ?? 0;
  // HIPA (sávos estimate; általános → "{firstName} számolja", adds 0): the same by-days split as the earnings
  const h = result.hipa;
  const hipaAnnualHuf = h && h.method === 'savos' ? (h.annualHuf ?? null) : null;
  const hipaHuf = soFar.reduce((a, m) => a + m.hipaHuf, 0);
  const invoicesHuf = Math.max(0, A - fixedHuf - hipaHuf);
  // B: the quarters that ended before today (approved amount, else the engine estimate) + HIPA periods due by today
  const periods = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.year, year))).orderBy(asc(taxPeriods.dueDate));
  let B = 0;
  for (const p of periods) {
    if (p.kind === 'negyedev' && p.quarter) {
      const qEnd = `${year}-${String(p.quarter * 3).padStart(2, '0')}-${p.quarter === 1 || p.quarter === 4 ? '31' : '30'}`;
      if (qEnd >= today) continue;
      if (p.calcStatus === 'jovahagyva') B += (await activeItems(db, p.id)).reduce((a, i) => a + i.amountHuf, 0);
      else B += result.quarters.find((q) => q.quarter === p.quarter)?.totalHuf ?? 0;
    } else if (p.kind === 'hipa' && p.dueDate <= today) {
      if (p.calcStatus === 'jovahagyva') B += (await activeItems(db, p.id)).reduce((a, i) => a + i.amountHuf, 0);
      else B += h?.advances.find((x) => x.dueDate === p.dueDate)?.amountHuf ?? 0;
    }
  }
  const keepNowHuf = ceil1000(A - B);
  const next = periods.find((p) => p.dueDate >= today && p.paymentStatus !== 'befizetve_jelezve' && p.paymentStatus !== 'ellenorizve');
  const [mark] = await db.select().from(reserveMarks).where(and(eq(reserveMarks.clientId, cl.id), eq(reserveMarks.year, year))).limit(1);
  const zero = keepNowHuf <= 0;
  const p2 = { firstName, keepNow: fmt(keepNowHuf), A: fmt(ceil1000(A)), B: fmt(B) };
  const markedHuf = mark ? mark.markedHuf : null;
  const remaining = Math.max(0, keepNowHuf - (markedHuf ?? 0));
  // The blue band above shows the whole running quarter (with the fixed járulék of its months still to come): say so.
  const qOfMonth = Math.ceil(month / 3);
  const futureFixedInQuarter = yr.fixedByMonth.slice(month, qOfMonth * 3).reduce((a, b) => a + b, 0);
  let detail = await deps.content.render(zero ? 'felretesz.kartya.detail_zero' : 'felretesz.kartya.detail', p2);
  if (!zero && futureFixedInQuarter > 0) detail += await deps.content.get('felretesz.kartya.detail_hero');
  const refundHuf = basis.refundHuf;
  return {
    year,
    keepNowHuf,
    accruedHuf: A,
    invoicesHuf: kb1000(invoicesHuf),
    fixedHuf,
    fixedMonthlyHuf,
    hipaHuf: kb1000(hipaHuf),
    hipaAnnualHuf,
    dueOrPaidHuf: B,
    nextDue: next ? { dueDate: next.dueDate, label: `${periodLabel(next)} · ${huDayMonthIg(next.dueDate)}` } : null,
    estimateReasons: await estimateReasons(deps, db, cl, year, input, rows.map((x) => x.r), firstName, result),
    sentence: await deps.content.render(zero ? 'felretesz.kartya.sentence_zero' : 'felretesz.kartya.sentence', p2),
    detail,
    footnote: await deps.content.render('felretesz.kartya.footnote', p2),
    markedHuf,
    ring:
      markedHuf !== null && keepNowHuf > 0
        ? { ratio: Math.min(1, Math.round((markedHuf / keepNowHuf) * 1000) / 1000), remainingHuf: remaining, line: `Még ${fmt(remaining)} Ft-ot tegyél félre.` }
        : null,
    refundHuf,
    refundText: refundHuf > 0 ? await deps.content.render('felretesz.kartya.refund', { refund: fmt(kb1000(refundHuf)) }) : null,
  };
}

/**
 * GET /client/reserve, GET /acc/clients/:id/reserve: the card + every item of the year by month, newest first. An item
 * whose money is expected later (receivedOn after today: the payment deadline) is marked "várható" and left out of the
 * month's sum, exactly as the card leaves it out (round 2 of 2026-11-19).
 */
export async function reserveList(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, today: string): Promise<ReserveView | null> {
  const asOf = year === Number(today.slice(0, 4)) ? today : `${year}-12-31`;
  const card = await reserveCard(deps, db, cl, asOf);
  if (!card) return null;
  const items = await yearItems(db, cl.id, year);
  const rr = items.length ? await db.select().from(revenueReserves).where(inArray(revenueReserves.revenueItemId, items.map((i) => i.id))) : [];
  const invIds = items.map((i) => i.navInvoiceId).filter((x): x is string => Boolean(x));
  const invs = invIds.length ? await db.select().from(navInvoices).where(inArray(navInvoices.id, invIds)) : [];
  const priv = await deps.content.get('felretesz.kepernyo.private_person');
  const byMonth = new Map<number, ReserveListItem[]>();
  for (const it of items) {
    const inv = invs.find((x) => x.id === it.navInvoiceId);
    const r = rr.find((x) => x.revenueItemId === it.id) ?? null;
    const view = await reserveView(deps, r, { amountHuf: it.amountHuf, nextYear: false, year });
    const title = inv ? inv.customerName?.trim() || priv : await deps.content.render('felretesz.kepernyo.manual_item', { description: it.description });
    const m = Number(it.receivedOn.slice(5, 7));
    const upcoming = it.receivedOn > asOf;
    const list = byMonth.get(m) ?? [];
    list.push({
      revenueItemId: it.id,
      navInvoiceId: it.navInvoiceId,
      title,
      sub: inv ? `${inv.invoiceNumber}` : it.receivedOn,
      receivedOn: it.receivedOn,
      amountHuf: it.amountHuf,
      reserve: view,
      upcoming,
      upcomingText: upcoming ? await deps.content.render('felretesz.kepernyo.upcoming', { datum: huMonthDay(it.receivedOn) }) : null,
    });
    byMonth.set(m, list);
  }
  const months = [];
  for (const [month, list] of [...byMonth.entries()].sort((a, b) => b[0] - a[0])) {
    const now = list.filter((x) => !x.upcoming);
    const reserveHuf = now.reduce((a, x) => a + Math.max(0, x.reserve.reserveHuf), 0);
    const upcomingCount = list.length - now.length;
    const p = { n: String(now.length), felre: fmt(reserveHuf), u: String(upcomingCount) };
    months.push({
      month,
      label: MONTHS_HU[month - 1] ?? String(month),
      items: list.sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : -1)),
      reserveHuf,
      upcomingCount,
      sub: await deps.content.render(upcomingCount ? 'felretesz.kepernyo.month_sub_upcoming' : 'felretesz.kepernyo.month_sub', p),
    });
  }
  return { card, months };
}

/** "2026-11-20" → "november 20." */
function huMonthDay(d: string): string {
  return `${MONTHS_HU[Number(d.slice(5, 7)) - 1] ?? ''} ${Number(d.slice(8, 10))}.`;
}

/** PUT /client/reserve/mark (§28.K.12 item 3; self-reported, never a bank link). */
export async function setReserveMark(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, markedHuf: number, userId: string): Promise<void> {
  const v = { markedHuf: Math.max(0, Math.round(markedHuf)), updatedAt: deps.now() };
  await db.insert(reserveMarks).values({ clientId: cl.id, year, ...v }).onConflictDoUpdate({ target: [reserveMarks.clientId, reserveMarks.year], set: v });
  await audit(db, { action: 'reserve.mark', actorUserId: userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { year } });
}

/** After "Elutaltam": the paid amount comes off the mark (floor 0). Returns the amount subtracted. */
export async function subtractFromMark(deps: Deps, db: DbOrTx, clientId: string, year: number, paidHuf: number): Promise<number> {
  const [m] = await db.select().from(reserveMarks).where(and(eq(reserveMarks.clientId, clientId), eq(reserveMarks.year, year))).limit(1);
  if (!m || m.markedHuf <= 0) return 0;
  const sub = Math.min(m.markedHuf, paidHuf);
  await db.update(reserveMarks).set({ markedHuf: m.markedHuf - sub, updatedAt: deps.now() }).where(and(eq(reserveMarks.clientId, clientId), eq(reserveMarks.year, year)));
  return sub;
}

export { roundReserve, daysBetween };
