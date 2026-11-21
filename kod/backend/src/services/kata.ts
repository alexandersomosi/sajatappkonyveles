// SPEC §32 – KATA (F0 + F1a, 2026-11-21): one tax_periods row per started KATA month ('kata', 'YYYY-MM-KATA'), an
// automatically approved 50 000 Ft item on the NAV KATA account (adónem 288, közlemény = adószám), free months recorded
// by the accountant (Kata tv. 7. § (8)–(9)), the keret meter, the reminders, the year-end checks. The app never pays and
// never files: the client marks the payment ("csak jelölés"), the accountant verifies it.
//
// Nothing is deleted: a month that is no longer KATA is hidden (hidden_reason 'nem_kata'), an item that is no longer due is
// voided; a month marked paid stays as it is and the panel warns ("befizette, de mentes hónap").
// 2027 (T/928, not law): the rules are drafts – while the `kata2027` switch is off the months exist without an amount
// ('becsles', no item, no reminder) and the accountant gets one task (tax_task.kata_osszeg).
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { KataHomeView } from '../_shared/api.js';
import {
  EVES_KAPCSOLOK_DEFAULT,
  EVES_KAPCSOLOK_KEY,
  KATA_EXEMPT_KINDS,
  KATA_EXEMPT_LABELS,
  KATA_F1_RULES,
  KATA_F1_TEXTS,
  KATA_PANEL_TEXTS,
  kataExemptNeedsReport,
  type EvesKapcsolok,
  type KataBreak,
  type KataExemptKind,
  type KataMeterView,
  type KataMonthStatus,
  type KataMonthView,
  type KataYearView,
} from '../_shared/kata.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients, clientTaxProfiles, revenueItems, systemState, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, huDayMonth, huDayMonthIg, monthName, todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { nextWorkingDay } from '../lib/munkanap.js';
import { accountantParams } from '../notify/notify.js';
import { ibanHu, kataLimitMeter, kataMonthlyHuf, kataMonths, kataRulesFor, type KataMonth, type KataRules } from '../tax/engine.js';
import { fill } from '../content.js';
import { kataF1Key } from '../content/kata.js';
import { fmt } from './kedvezmeny.js';
import { clientName, type ClientRow } from './people.js';
import { kataRangeOfProfile, paymentStatusOf } from './tax.js';

type ProfileRow = typeof clientTaxProfiles.$inferSelect;
type PeriodRow = typeof taxPeriods.$inferSelect;
type ItemRow = typeof taxPaymentItems.$inferSelect;

// ---------------------------------------------------------------------------------------------------------------------
// switches
// ---------------------------------------------------------------------------------------------------------------------
/** SPEC §32: the code defaults merged with system_state['kapcsolok.ev_ciklus'] (unknown keys and wrong types ignored). */
export async function evesKapcsolok(db: DbOrTx): Promise<EvesKapcsolok> {
  const [row] = await db.select({ value: systemState.value }).from(systemState).where(eq(systemState.key, EVES_KAPCSOLOK_KEY)).limit(1);
  const v = (row?.value ?? {}) as Record<string, unknown>;
  const out: EvesKapcsolok = { ...EVES_KAPCSOLOK_DEFAULT };
  if (typeof v.kata2027 === 'boolean') out.kata2027 = v.kata2027;
  if (typeof v.kataElorejelzesUgyfelnek === 'boolean') out.kataElorejelzesUgyfelnek = v.kataElorejelzesUgyfelnek;
  if (v.kataEvVegeUgyfelnek === 'jeloletlen' || v.kataEvVegeUgyfelnek === 'ki') out.kataEvVegeUgyfelnek = v.kataEvVegeUgyfelnek;
  if (typeof v.evesZarasDij === 'boolean') out.evesZarasDij = v.evesZarasDij;
  // SPEC §32.B (éves ciklus F2/F3)
  if (v.lemondottEvesZaras === 'ki' || v.lemondottEvesZaras === 'kezi' || v.lemondottEvesZaras === 'automatikus') out.lemondottEvesZaras = v.lemondottEvesZaras;
  if (typeof v.refundDatumUgyfelnek === 'boolean') out.refundDatumUgyfelnek = v.refundDatumUgyfelnek;
  if (typeof v.reszletfizetesSzoveg === 'boolean') out.reszletfizetesSzoveg = v.reszletfizetesSzoveg;
  if (typeof v.csjkBirsagTetel === 'boolean') out.csjkBirsagTetel = v.csjkBirsagTetel;
  // javító kör 11-21: the confirmed 2027 amount (whole Ft, 1 000 – 500 000), used only with kata2027 on
  if (typeof v.kata2027Osszeg === 'number' && Number.isSafeInteger(v.kata2027Osszeg) && v.kata2027Osszeg >= 1_000 && v.kata2027Osszeg <= 500_000) out.kata2027Osszeg = v.kata2027Osszeg;
  return out;
}

/** Draft rules of a year are usable only with the switch of that year (only 2027 has one). */
function draftAllowed(year: number, k: EvesKapcsolok): boolean {
  return year === 2027 && k.kata2027;
}

// ---------------------------------------------------------------------------------------------------------------------
// computation
// ---------------------------------------------------------------------------------------------------------------------
const KATA_KINDS = new Set<string>(KATA_EXEMPT_KINDS);

/** The free-month states of a KATA profile (insurance_breaks entries with a KATA kind). */
export function kataBreaksOf(p: Pick<ProfileRow, 'insuranceBreaks'>): KataBreak[] {
  return (p.insuranceBreaks ?? []).filter((b): b is KataBreak => KATA_KINDS.has(b.kind)).map((b) => ({ from: b.from, to: b.to, kind: b.kind as KataExemptKind, reportedOn: b.reportedOn ?? null }));
}

export interface KataComputation {
  profile: ProfileRow;
  rules: KataRules;
  monthlyHuf: number | null;
  months: KataMonth[];
  meter: ReturnType<typeof kataLimitMeter>;
  breaks: KataBreak[];
  /** Javító kör 11-21: the KATA ended before asOf (kataTo) – no "Még … fér bele" line. */
  ended: boolean;
}

/**
 * The KATA months and meter of a year, or null when that year has no KATA month (or no rules exist). A KATA that ended
 * during an átalány year (regime 'atalany' + kataTo, "vegyes év") keeps its months until kataTo.
 */
export async function kataCompute(db: DbOrTx, clientId: string, year: number, asOf: string, k?: EvesKapcsolok): Promise<KataComputation | null> {
  const [profile] = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year))).limit(1);
  const range = kataRangeOfProfile(profile);
  if (!profile || !range) return null;
  const rules = kataRulesFor(year, profile.kataVariant ?? 'regi');
  if (!rules) return null;
  const kap = k ?? (await evesKapcsolok(db));
  const engineHuf = kataMonthlyHuf(rules, { fofoglalkozasu: profile.kataFofoglalkozasu ?? (rules.variant === 'regi' ? true : null), allowDraft: draftAllowed(year, kap) });
  // javító kör 11-21 [D24]: the old KATA's 2027 amount as confirmed in the switch (50 000 if the T/928 fails, 75 000 if not)
  const monthlyHuf = engineHuf !== null && year === 2027 && rules.variant === 'regi' && draftAllowed(year, kap) && kap.kata2027Osszeg !== null ? kap.kata2027Osszeg : engineHuf;
  const revRows = await db
    .select({ receivedOn: revenueItems.receivedOn, amountHuf: revenueItems.amountHuf, counts: revenueItems.countsForAtalany })
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), isNull(revenueItems.deletedAt), sql`${revenueItems.receivedOn} between ${`${year}-01-01`} and ${`${year}-12-31`}`));
  // pénzforgalmi, and only money that arrived by asOf (an estimated future receipt is not revenue yet)
  const revenue = revRows.filter((r) => r.counts && r.receivedOn <= asOf).map((r) => ({ receivedOn: r.receivedOn, amountHuf: r.amountHuf }));
  const breaks = kataBreaksOf(profile);
  const months = kataMonths({ year, kataFrom: range.from, kataTo: range.to, breaks, revenue, monthlyHuf }, rules);
  const meter = kataLimitMeter(months, { year, kataFrom: range.from, kataTo: range.to, revenue, asOf }, rules);
  return { profile, rules, monthlyHuf, months, meter, breaks, ended: Boolean(range.to && range.to < asOf) };
}

// ---------------------------------------------------------------------------------------------------------------------
// periods
// ---------------------------------------------------------------------------------------------------------------------
async function activeItemsOf(db: DbOrTx, periodId: string): Promise<ItemRow[]> {
  return db.select().from(taxPaymentItems).where(and(eq(taxPaymentItems.taxPeriodId, periodId), isNull(taxPaymentItems.voidedAt)));
}
const touched = (i: Pick<ItemRow, 'markedPaidAt' | 'verification'>) => Boolean(i.markedPaidAt) || i.verification === 'rendben' || i.verification === 'elteres';

export interface KataSyncResult {
  created: number;
  updated: number;
  hidden: number;
  backfilled: string[];
  paidButExempt: string[];
  unconfirmed: number;
}

/**
 * Idempotent: the KATA month rows of a year follow the profile (regime, kataFrom/To, free months, the confirmed amount).
 * Only STARTED months get a row (one row per month, at the latest on the 1st). A row made after its due date is
 * `backfilled` (no reminder; the client sees it only after the accountant verified it).
 */
export async function syncKataPeriods(deps: Deps, db: DbOrTx, clientId: string, year: number, o: { k?: EvesKapcsolok; noCreate?: boolean } = {}): Promise<KataSyncResult> {
  const now = deps.now();
  const today = todayBudapest(now);
  const out: KataSyncResult = { created: 0, updated: 0, hidden: 0, backfilled: [], paidButExempt: [], unconfirmed: 0 };
  // visible-ok: the sync reads its own rows, the hidden ones too (it un-hides a month that is KATA again)
  const existing = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'kata')));
  const comp = await kataCompute(db, clientId, year, today, o.k);
  const wanted = new Map((comp?.months ?? []).filter((m) => `${m.monthKey}-01` <= today).map((m) => [m.periodKey, m]));
  // rows of months that are no longer KATA (regime changed back, kataFrom/kataTo moved): hidden, never deleted
  for (const p of existing) {
    if (wanted.has(p.periodKey) || p.hiddenAt) continue;
    const items = await activeItemsOf(db, p.id);
    if (items.some(touched)) continue; // marked or verified: kept, the panel shows it
    if (items.length) await db.update(taxPaymentItems).set({ voidedAt: now }).where(inArray(taxPaymentItems.id, items.map((i) => i.id)));
    await db.update(taxPeriods).set({ hiddenAt: now, hiddenReason: 'nem_kata', paymentStatus: 'nincs_fizetendo', updatedAt: now }).where(eq(taxPeriods.id, p.id));
    out.hidden++;
  }
  if (!comp) return out;
  const [cl] = await db.select({ adoszam: clients.adoszam, accountantId: clients.accountantId, firstName: clients.firstName, lastName: clients.lastName }).from(clients).where(eq(clients.id, clientId)).limit(1);
  const account = comp.rules.account;
  for (const m of wanted.values()) {
    let p = existing.find((x) => x.periodKey === m.periodKey);
    if (!p) {
      // javító kör 11-21: a client whose service ended / is suspended gets no new month row (the old ones still follow)
      if (o.noCreate) continue;
      const backfilled = m.dueDate < today;
      const [ins] = await db
        .insert(taxPeriods)
        .values({ clientId, kind: 'kata', periodKey: m.periodKey, year, quarter: null, dueDate: m.dueDate, calcStatus: 'nincs', paymentStatus: 'nincs_fizetendo', backfilled, createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .returning();
      if (!ins) continue;
      p = ins;
      out.created++;
      if (backfilled) out.backfilled.push(m.monthKey);
    }
    const items = await activeItemsOf(db, p.id);
    const patch: Partial<PeriodRow> = {};
    if (p.hiddenAt && p.hiddenReason === 'nem_kata') Object.assign(patch, { hiddenAt: null, hiddenReason: null });
    if (p.dueDate !== m.dueDate) patch.dueDate = m.dueDate;
    let after = items;
    if (!m.liable) {
      // free month (Kata tv. 7. § (8)–(9)): the unmarked item is voided; a marked / verified one stays (overpayment)
      const loose = items.filter((i) => !touched(i));
      if (loose.length) await db.update(taxPaymentItems).set({ voidedAt: now }).where(inArray(taxPaymentItems.id, loose.map((i) => i.id)));
      after = items.filter(touched);
      if (after.length) out.paidButExempt.push(m.monthKey);
      Object.assign(patch, { exemptReason: m.exemptReason, calcStatus: 'jovahagyva', paymentStatus: after.length ? paymentStatusOf(after) : 'nincs_fizetendo' });
    } else if (m.amountHuf === null || !account) {
      // the amount is not confirmed (2027 / T/928): no item, no reminder
      const loose = items.filter((i) => !touched(i));
      if (loose.length) await db.update(taxPaymentItems).set({ voidedAt: now }).where(inArray(taxPaymentItems.id, loose.map((i) => i.id)));
      after = items.filter(touched);
      Object.assign(patch, { exemptReason: null, calcStatus: after.length ? 'jovahagyva' : 'becsles', paymentStatus: after.length ? paymentStatusOf(after) : 'nincs_fizetendo' });
      out.unconfirmed++;
    } else {
      const current = items.find((i) => i.kind === 'kata_teteles');
      if (current && current.amountHuf !== m.amountHuf && !touched(current)) {
        await db.update(taxPaymentItems).set({ voidedAt: now }).where(eq(taxPaymentItems.id, current.id));
        after = items.filter((i) => i.id !== current.id);
      }
      if (!after.some((i) => i.kind === 'kata_teteles')) {
        const [it] = await db
          .insert(taxPaymentItems)
          .values({
            taxPeriodId: p.id,
            calculationId: null,
            kind: 'kata_teteles',
            label: 'Kata',
            sublabel: `kisadózó vállalkozások tételes adója, ${monthName(m.month)}`,
            amountHuf: m.amountHuf,
            dueDate: m.dueDate,
            accountName: account.name,
            accountNumber: account.number,
            iban: account.iban ?? ibanHu(account.number),
            reference: cl?.adoszam ?? '',
            adonem: comp.rules.adonem,
            createdAt: now,
          })
          .returning();
        after = [...after, it!];
      } else {
        // keep the item's due date in step with the period (e.g. a holiday correction)
        const stale = after.filter((i) => i.kind === 'kata_teteles' && i.dueDate !== m.dueDate && !touched(i));
        if (stale.length) await db.update(taxPaymentItems).set({ dueDate: m.dueDate }).where(inArray(taxPaymentItems.id, stale.map((i) => i.id)));
      }
      Object.assign(patch, { exemptReason: null, calcStatus: 'jovahagyva', paymentStatus: paymentStatusOf(after) });
    }
    const changed = Object.entries(patch).some(([k, v]) => (p as Record<string, unknown>)[k] !== v);
    if (changed) {
      await db.update(taxPeriods).set({ ...patch, updatedAt: now }).where(eq(taxPeriods.id, p.id));
      out.updated++;
    }
  }
  // tasks for the accountant (panel badge + daily digest), once per content
  const accUser = cl?.accountantId ? (await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1))[0] : undefined;
  if (accUser && cl) {
    const { notifyOnce } = await import('./emlekezteto.js');
    const name = clientName(cl);
    const link = `/ugyfelek/${clientId}/ado`;
    if (out.backfilled.length)
      await notifyOnce(deps, `tt:kata_backfill:${clientId}:${out.backfilled.join(',')}`, { userId: accUser.userId, kind: 'tax_task', variant: 'backfill', params: { clientName: name, honapok: honapLista(out.backfilled) }, link, data: { clientId } });
    for (const mk of out.paidButExempt)
      await notifyOnce(deps, `tt:kata_befizetett_mentes:${clientId}:${mk}`, { userId: accUser.userId, kind: 'tax_task', variant: 'befizetett_mentes', params: { clientName: name, honap: `${mk.slice(0, 4)}. ${monthName(Number(mk.slice(5, 7)))}` }, link, data: { clientId } });
    if (out.unconfirmed) await notifyOnce(deps, `tt:kata_osszeg:${clientId}:${year}`, { userId: accUser.userId, kind: 'tax_task', variant: 'kata_osszeg', params: { clientName: name, ev: year }, link, data: { clientId } });
  }
  if (out.created || out.hidden) await audit(db, { action: 'kata.periods_synced', actorRole: 'system', targetType: 'client', targetId: clientId, clientId, details: { year, created: out.created, hidden: out.hidden, backfilled: out.backfilled.length } });
  return out;
}

/** "2026. október, november" */
export function honapLista(monthKeys: string[]): string {
  const byYear = new Map<string, string[]>();
  for (const mk of [...monthKeys].sort()) byYear.set(mk.slice(0, 4), [...(byYear.get(mk.slice(0, 4)) ?? []), monthName(Number(mk.slice(5, 7)))]);
  return [...byYear.entries()].map(([y, ms]) => `${y}. ${ms.join(', ')}`).join('; ');
}

// ---------------------------------------------------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------------------------------------------------
function statusOf(p: PeriodRow | undefined, m: KataMonth, items: ItemRow[]): KataMonthStatus {
  if (p?.backfilled && !items.some((i) => i.verification === 'rendben') && m.liable) return 'ellenorizetlen';
  if (!m.liable && !items.length) return 'mentes';
  if (!items.length) return 'nincs_osszeg';
  if (items.some((i) => i.verification === 'elteres')) return 'elteres';
  if (items.every((i) => i.verification === 'rendben')) return 'ellenorizve';
  if (items.every((i) => i.markedPaidAt || i.verification === 'rendben')) return 'befizetve_jelezve';
  return 'fizetendo';
}

const pctOf = (used: number, limit: number) => (limit > 0 ? Math.floor((used / limit) * 100) : 0);

export type KataF1Texts = Record<keyof typeof KATA_F1_TEXTS, string>;
/** KATA_F1_TEXTS as served by the content system (an admin edit in /admin/szovegek wins). */
export async function kataF1Texts(deps: Pick<Deps, 'content'>): Promise<KataF1Texts> {
  const out = {} as KataF1Texts;
  for (const k of Object.keys(KATA_F1_TEXTS) as (keyof typeof KATA_F1_TEXTS)[]) out[k] = (await deps.content.get(kataF1Key(k))) || KATA_F1_TEXTS[k];
  return out;
}
async function exemptLabel(deps: Pick<Deps, 'content'>, k: string): Promise<string> {
  return (await deps.content.get(`kata.mentes_ok.${k}`)) || KATA_EXEMPT_LABELS[k as KataExemptKind] || k;
}

/** The meter with its client / staff lines (KATA_F1_TEXTS). The projection reaches the client only with the switch on. */
export function meterView(c: KataComputation, o: { staff: boolean; k: EvesKapcsolok; params: Record<string, string | number | null | undefined>; t?: KataF1Texts }): KataMeterView {
  const m = c.meter;
  const T: KataF1Texts = o.t ?? KATA_F1_TEXTS;
  const showProjection = o.staff || o.k.kataElorejelzesUgyfelnek;
  // javító kör 11-21: the panel line is not tegező ("Keret: …"); a prorated month of the new KATA is not a whole number
  const full = m.liableMonths >= 12 || c.rules.limitPerMonthHuf === null;
  const limitLine = full
    ? fill(o.staff ? KATA_PANEL_TEXTS.keretTeljesPanel : T.keretTeljes, { keret: fmt(m.limitHuf) })
    : fill(o.staff ? KATA_PANEL_TEXTS.keretHonapokPanel : T.keretHonapok, { n: m.liableMonths, havi: fmt(Math.round(c.rules.limitPerMonthHuf!)) });
  let warningLine: string | null = null;
  if (m.level === 'tullepve') warningLine = fill(T.keretTullepve, { tobblet: fmt(m.overHuf), kulonado: fmt(m.kulonadoEstimateHuf), hatarido: m.kulonadoDue ? huDayMonthIg(m.kulonadoDue) : 'a nyilatkozattal' });
  else if (showProjection && m.projectedOverHuf > 0) warningLine = fill(T.keretElore, { ...o.params, tobblet: fmt(m.projectedOverHuf) });
  else if (m.level === 'figyelem') warningLine = T.keretKozel;
  return {
    usedHuf: m.usedHuf,
    limitHuf: m.limitHuf,
    pct: pctOf(m.usedHuf, m.limitHuf),
    level: m.level,
    liableMonths: m.liableMonths,
    limitLine,
    remainingLine: m.level === 'tullepve' || c.ended ? null : fill(T.keretMaradek, { maradek: fmt(m.remainingHuf) }),
    warningLine,
    remainingHuf: m.remainingHuf,
    overHuf: m.overHuf,
    projectedHuf: showProjection ? m.projectedHuf : m.usedHuf,
    projectedOverHuf: showProjection ? m.projectedOverHuf : 0,
    kulonadoEstimateHuf: m.kulonadoEstimateHuf,
    kulonadoDue: m.kulonadoDue,
    draft: m.draft,
  };
}

/** GET /client/kata and /acc/clients/:id/kata. The client never sees a backfilled month before the accountant verified it. */
export async function kataYearView(deps: Deps, db: DbOrTx, cl: Pick<ClientRow, 'id' | 'accountantId'>, year: number, o: { staff: boolean }): Promise<KataYearView | null> {
  const today = todayBudapest(deps.now());
  const k = await evesKapcsolok(db);
  const asOf = `${year}-12-31` < today ? `${year}-12-31` : today;
  const c = await kataCompute(db, cl.id, year, asOf, k);
  if (!c) return null;
  const params = await accountantParams(db, cl.accountantId);
  const T = await kataF1Texts(deps);
  const periods = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'kata'), isNull(taxPeriods.hiddenAt))).orderBy(asc(taxPeriods.dueDate));
  const months: KataMonthView[] = [];
  let toVerify = 0;
  for (const m of c.months) {
    const p = periods.find((x) => x.periodKey === m.periodKey);
    if (!p && `${m.monthKey}-01` > today) continue; // not started yet
    const items = p ? await activeItemsOf(db, p.id) : [];
    const st = statusOf(p, m, items);
    if (!o.staff && st === 'ellenorizetlen') continue;
    if (st === 'befizetve_jelezve') toVerify++;
    const it = items.find((i) => i.kind === 'kata_teteles') ?? items[0];
    const open = st === 'fizetendo' || st === 'elteres';
    const reportDue = o.staff && m.exemptReason && !m.liable && kataExemptNeedsReport(m.exemptReason) && !c.breaks.some((b) => b.reportedOn && b.from <= `${m.monthKey}-31` && b.to >= `${m.monthKey}-01`) ? m.dueDate : null;
    months.push({
      periodId: p?.id ?? null,
      month: m.month,
      monthKey: m.monthKey,
      label: monthName(m.month),
      status: st,
      liable: m.liable,
      exemptReason: (m.exemptReason as KataExemptKind | null) ?? null,
      exemptReasonLabel: m.exemptReason ? await exemptLabel(deps, m.exemptReason) : null,
      exemptLostByRevenue: m.exemptLostByRevenue,
      amountHuf: it ? it.amountHuf : m.liable ? m.amountHuf : 0,
      dueDate: p?.dueDate ?? m.dueDate,
      overdue: open && (p?.dueDate ?? m.dueDate) < today,
      markedPaidOn: it?.markedPaidOn ?? null,
      verification: (it?.verification as 'rendben' | 'elteres' | null) ?? null,
      backfilled: Boolean(p?.backfilled),
      paidButExempt: !m.liable && items.some(touched),
      ...(o.staff ? { reportDue, revenueInMonthHuf: m.revenueInMonthHuf } : {}),
    });
  }
  const payable = months.filter((x) => x.periodId && (x.status === 'fizetendo' || x.status === 'elteres')).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const draftNote = c.rules.draft && c.monthlyHuf === null ? (o.staff ? await deps.content.render('kata.panel.tervezet2027', { ev: year }) : fill(T.keretTervezet, params)) : null;
  return {
    year,
    variant: c.rules.variant,
    fofoglalkozasu: c.profile.kataFofoglalkozasu ?? null,
    kataFrom: c.profile.kataFrom ?? null,
    kataTo: c.profile.kataTo ?? null,
    monthlyHuf: c.monthlyHuf,
    draftNote,
    months,
    meter: meterView(c, { staff: o.staff, k, params, t: T }),
    nextPayable: payable ? { periodId: payable.periodId!, label: fill(T.hataridoBefizetes, { honap: payable.label, osszeg: fmt(payable.amountHuf ?? 0) }), amountHuf: payable.amountHuf ?? 0, dueDate: payable.dueDate, overdue: payable.overdue } : null,
    ...(o.staff ? { breaks: c.breaks, toVerify } : {}),
  };
}

/** The Főoldal KATA block (KataHomeView): the meter, the next payment and the "nothing to pay" line. */
export async function kataHomeView(deps: Deps, db: DbOrTx, cl: ClientRow, year: number): Promise<KataHomeView | null> {
  const v = await kataYearView(deps, db, cl, year, { staff: false });
  if (!v) return null;
  const params = await accountantParams(db, cl.accountantId);
  const T = await kataF1Texts(deps);
  const nextOpen = v.nextPayable;
  let nothingToPayLine: string | null = null;
  if (!nextOpen) {
    // the next month to come (or the current one, not yet due) – "A következő kata: december, január 12-ig."
    // javító kör 11-21: the current month only while it is still to pay (not marked, not free); else the next KATA month of
    // the year (never a month that is already marked, and never a free one)
    const today = todayBudapest(deps.now());
    const cur = today.slice(0, 7);
    const all = (await kataCompute(db, cl.id, year, today).catch(() => null))?.months ?? [];
    const curView = v.months.find((m) => m.monthKey === cur);
    const curMonth = all.find((m) => m.monthKey === cur);
    let nextDue: { honap: string; due: string } | null = null;
    if (v.monthlyHuf !== null && Number(today.slice(0, 4)) === year) {
      if (curMonth?.liable && (!curView || curView.status === 'fizetendo')) nextDue = { honap: monthName(curMonth.month), due: curView?.dueDate ?? curMonth.dueDate };
      else {
        const next = all.find((m) => m.monthKey > cur && m.liable);
        if (next) nextDue = { honap: monthName(next.month), due: next.dueDate };
      }
    }
    nothingToPayLine = nextDue ? fill(T.nincsFizetnivalo, { honap: nextDue.honap, hatarido: huDayMonthIg(nextDue.due) }) : null;
  }
  const rules = kataRulesFor(year, v.variant);
  const nextItem = nextOpen ? (await activeItemsOf(db, nextOpen.periodId)).find((i) => i.kind === 'kata_teteles') : undefined;
  return {
    revenueHuf: v.meter.usedHuf,
    limitHuf: v.meter.limitHuf,
    usedPct: v.meter.pct,
    level: v.meter.level,
    liableMonths: v.months.filter((m) => m.liable).map((m) => m.month),
    kulonadoEstimateHuf: v.meter.kulonadoEstimateHuf,
    nextPayment: nextItem ? { amountHuf: nextItem.amountHuf, dueDate: nextItem.dueDate, accountName: nextItem.accountName, accountNumber: nextItem.accountNumber, iban: nextItem.iban, reference: nextItem.reference } : null,
    businessInvoices: [],
    infoCardSeen: true,
    meter: v.meter,
    nextPayable: nextOpen,
    nothingToPayLine,
    draftNote: v.draftNote ?? (rules?.draft && v.monthlyHuf === null ? fill(T.keretTervezet, params) : null),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// accountant actions
// ---------------------------------------------------------------------------------------------------------------------
/** PUT /acc/clients/:id/kata/breaks – the free-month states replace the KATA entries of insurance_breaks, then sync. */
export async function setKataBreaks(deps: Deps, db: DbOrTx, cl: Pick<ClientRow, 'id'>, year: number, breaks: KataBreak[], by: string): Promise<void> {
  const [p] = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
  if (!p || p.regime !== 'kata') throw E.conflict('Ebben az évben az ügyfél nem katás.');
  for (const b of breaks) {
    if (b.from > b.to) throw E.validation({ breaks: 'A kezdet nem lehet a vég után.' });
    if (b.to < `${year}-01-01` || b.from > `${year}-12-31`) throw E.validation({ breaks: `Az időszaknak ${year}-re kell esnie.` });
    if (b.reportedOn && b.reportedOn > todayBudapest(deps.now())) throw E.validation({ breaks: 'A bejelentés napja nem lehet a jövőben.' });
  }
  const others = (p.insuranceBreaks ?? []).filter((b) => !KATA_KINDS.has(b.kind));
  const next = [...others, ...breaks.map((b) => ({ from: b.from, to: b.to, kind: b.kind, ...(b.reportedOn ? { reportedOn: b.reportedOn } : {}) }))];
  await db.update(clientTaxProfiles).set({ insuranceBreaks: next, updatedAt: deps.now() }).where(eq(clientTaxProfiles.id, p.id));
  await audit(db, { action: 'kata.breaks_saved', actorUserId: by, actorRole: 'accountant', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { year, count: breaks.length, kinds: [...new Set(breaks.map((b) => b.kind))] } });
  await syncKataPeriods(deps, db, cl.id, year);
}

// ---------------------------------------------------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------------------------------------------------
/** The active KATA clients of a year. */
async function kataClients(db: DbOrTx, year: number): Promise<(typeof clients.$inferSelect)[]> {
  const rows = await db.select({ c: clients }).from(clients).innerJoin(clientTaxProfiles, eq(clientTaxProfiles.clientId, clients.id)).where(and(eq(clientTaxProfiles.year, year), eq(clientTaxProfiles.regime, 'kata'), eq(clients.lifecycle, 'aktiv')));
  return rows.map((r) => r.c);
}

/** Job kata_periods (daily 03:10): the month rows of every active KATA client (this year; in January last year too). */
export async function jobKataPeriods(deps: Deps): Promise<Record<string, number>> {
  const today = todayBudapest(deps.now());
  const year = Number(today.slice(0, 4));
  const k = await evesKapcsolok(deps.db);
  const out = { clients: 0, created: 0, hidden: 0 };
  for (const y of today.slice(5, 7) === '01' ? [year - 1, year] : [year]) {
    // every client with ANY period of the year too: a regime switched back to átalány hides its KATA months
    const active = new Set((await kataClients(deps.db, y)).map((c) => c.id));
    const ids = new Set(active);
    for (const r of await deps.db.selectDistinct({ id: taxPeriods.clientId }).from(taxPeriods).where(and(eq(taxPeriods.year, y), eq(taxPeriods.kind, 'kata'), isNull(taxPeriods.hiddenAt)))) ids.add(r.id);
    for (const id of ids) {
      let noCreate = false;
      if (!active.has(id)) {
        const [c] = await deps.db.select({ lifecycle: clients.lifecycle }).from(clients).where(eq(clients.id, id)).limit(1);
        noCreate = c?.lifecycle !== 'aktiv';
      }
      const r = await syncKataPeriods(deps, deps.db, id, y, { k, noCreate });
      out.clients++;
      out.created += r.created;
      out.hidden += r.hidden;
    }
  }
  return out;
}

/**
 * Job kata_year_end (daily 09:00; acts only on its days):
 *  - 10 and 22 December (next working day): tax_task.kata_ev_vege to the accountant for every active KATA client
 *    (Kata tv. 5. § (1) e): more than 100 000 Ft végrehajtható nettó tartozás on 31 December ends the KATA);
 *  - 16 December (next working day): tax_due_soon.kata_ev_vege to the client – only for unmarked, overdue, visible KATA
 *    items (the folyószámla is not recorded in the app yet; switch kataEvVegeUgyfelnek);
 *  - 3 days before the 12th: tax_task.mentesseg_bejelentes for an a)–c) free month not reported yet (7. § (10)).
 */
export async function jobKataYearEnd(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const year = Number(today.slice(0, 4));
  const k = await evesKapcsolok(db);
  const out = { staff: 0, client: 0, report: 0 };
  const { notifyOnce } = await import('./emlekezteto.js');
  const staffDays = KATA_F1_RULES.yearEndStaffDays.map((d) => nextWorkingDay(`${year}-${d}`));
  const clientDay = nextWorkingDay(`${year}-${KATA_F1_RULES.yearEndClientDay}`);
  const list = await kataClients(db, year);
  for (const cl of list) {
    const accUser = cl.accountantId ? (await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1))[0] : undefined;
    const open = await db
      .select({ p: taxPeriods, i: taxPaymentItems })
      .from(taxPeriods)
      .innerJoin(taxPaymentItems, eq(taxPaymentItems.taxPeriodId, taxPeriods.id))
      .where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.kind, 'kata'), isNull(taxPeriods.hiddenAt), isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt), sql`${taxPaymentItems.verification} is distinct from 'rendben'`, sql`${taxPeriods.dueDate} < ${today}`));
    if (staffDays.includes(today) && accUser) {
      const honapok = open.length ? honapLista(open.map((r) => r.p.periodKey.slice(0, 7))) : 'nincs';
      if (await notifyOnce(deps, `tt:kata_ev_vege:${cl.id}:${today}`, { userId: accUser.userId, kind: 'tax_task', variant: 'kata_ev_vege', params: { clientName: clientName(cl), honapok }, link: `/ugyfelek/${cl.id}/ado`, data: { clientId: cl.id } })) out.staff++;
    }
    if (today === clientDay && k.kataEvVegeUgyfelnek === 'jeloletlen') {
      const visible = open.filter((r) => !r.p.backfilled);
      if (visible.length) {
        const params = { ...(await accountantParams(db, cl.accountantId)), honapok: honapLista(visible.map((r) => r.p.periodKey.slice(0, 7))), osszeg: fmt(visible.reduce((a, r) => a + r.i.amountHuf, 0)) };
        if (await notifyOnce(deps, `rem:kata_ev_vege:${cl.id}:${year}`, { userId: cl.userId, kind: 'tax_due_soon', variant: 'kata_ev_vege', params, link: `/fizetes/${visible[0]!.p.id}`, emailBodyKey: 'email.tax_due_soon.kata_ev_vege.body' })) out.client++;
      }
    }
    // free months to report (a)–c), no reportedOn) – 3 days before their 12th
    if (accUser) {
      const c = await kataCompute(db, cl.id, year, today, k);
      if (c) {
        for (const m of c.months) {
          if (m.liable || !m.exemptReason || !kataExemptNeedsReport(m.exemptReason as KataExemptKind)) continue;
          const reported = c.breaks.some((b) => b.reportedOn && b.from <= `${m.monthKey}-31` && b.to >= `${m.monthKey}-01`);
          if (reported) continue;
          const due = m.dueDate; // 7. § (10): the 12th of the next month = the payment day of the month
          if (today !== addDays(due, -KATA_F1_RULES.exemptReportDaysBefore)) continue;
          if (await notifyOnce(deps, `tt:mentesseg:${cl.id}:${m.monthKey}`, { userId: accUser.userId, kind: 'tax_task', variant: 'mentesseg_bejelentes', params: { clientName: clientName(cl), honap: monthName(m.month), datum: huDayMonth(due) }, link: `/ugyfelek/${cl.id}/ado`, data: { clientId: cl.id } })) out.report++;
        }
      }
    }
  }
  return out;
}

/**
 * The keret warnings (daily with jobReminders): limit_warning.kata80 / kata100 once a year per threshold to the client
 * and the accountant; kata_elore (projection) to the accountant, to the client only with kataElorejelzesUgyfelnek.
 * Draft rules (2027 while the switch is off) send nothing.
 */
export async function kataLimitWarnings(deps: Deps, cl: typeof clients.$inferSelect, year: number, today: string, k: EvesKapcsolok): Promise<number> {
  const db = deps.db;
  const c = await kataCompute(db, cl.id, year, today, k);
  if (!c || c.rules.draft) return 0;
  const { notifyOnce } = await import('./emlekezteto.js');
  const ap = await accountantParams(db, cl.accountantId);
  const m = c.meter;
  const [acc] = cl.accountantId ? await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const base = { bevetel: fmt(m.usedHuf), keret: fmt(m.limitHuf), varhato: fmt(m.projectedHuf), tobblet: fmt(m.overHuf), kulonado: fmt(m.kulonadoEstimateHuf), hatarido: m.kulonadoDue ? huDayMonthIg(m.kulonadoDue) : 'a nyilatkozattal', percent: 80 };
  const staff = { ...base, clientName: clientName(cl) };
  let n = 0;
  const send = async (variant: 'kata80' | 'kata100' | 'kata_elore', client: boolean, params: Record<string, string | number>) => {
    if (client && (await notifyOnce(deps, `limit:${variant}:${year}`, { userId: cl.userId, kind: 'limit_warning', variant, params: { ...ap, ...base, ...params }, link: '/' }))) n++;
    if (acc) await notifyOnce(deps, `limit:${variant}:${year}:${cl.id}`, { userId: acc.userId, kind: 'limit_warning', variant: `${variant}_staff`, params: { ...staff, ...params }, link: `/ugyfelek/${cl.id}/ado`, data: { clientId: cl.id } });
  };
  if (m.level === 'tullepve') await send('kata100', true, { tobblet: fmt(m.overHuf) });
  else if (m.level === 'figyelem') await send('kata80', true, { percent: 80 });
  if (m.level !== 'tullepve' && m.projectedOverHuf > 0) await send('kata_elore', k.kataElorejelzesUgyfelnek, { tobblet: fmt(m.projectedOverHuf) });
  return n;
}

export { kataClients };
