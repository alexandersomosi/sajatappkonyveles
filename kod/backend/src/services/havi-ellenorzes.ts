// SPEC §28.K.2 – monthly check-in "Változott valami?". Opened on the first working day of the month at 09:00 for every
// active, not locked client (active ≥ 20 days); period = the previous month; due on the 10th; unanswered at month end
// → 'lejart'. "Nem változott semmi" ends it in one tap; every "Igen" item becomes a checkin_items row and a task for the
// accountant (queue "Havi változások"). NAV-filed changes go the §28.5 way (assisted = prepaid fee, or the free guide).
import { and, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm';
import type { CheckinAnswerInput, CheckinItemAnswer, CheckinItemDecisionInput, CheckinView, TeamCheckinItem } from '../_shared/api.js';
import { CHECKIN_ITEM_TEXTS } from '../_shared/bekotes.js';
import { CHECKIN_RULES, checkinItemsFor, CHANGE_KINDS, type ChangeKind, type CheckinItem, type CheckinItemStatus } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { checkinItems, clients, clientTaxProfiles, messages, monthlyCheckins, subscriptionPauses } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, capitalize, lastDayOfMonth, MONTHS_HU, prevMonthKey, todayBudapest } from '../lib/dates.js';
import { isWorkingDay } from '../lib/munkanap.js';
import { ApiError, E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { accountantUserOf } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { chargeById, feeChargeView } from './dijak.js';
import { pauseOn } from './szuneteltetes.js';
import { setEmployerAnswer } from './alkalmazott.js';
import { requestChangeAssist } from './valtozas.js';

export type CheckinRow = typeof monthlyCheckins.$inferSelect;
export type CheckinItemRow = typeof checkinItems.$inferSelect;

const monthName = (period: string) => MONTHS_HU[Number(period.slice(5, 7)) - 1] ?? period;
/** "október" → the band reads "Változott valami október óta?" */
export function periodLabel(period: string): string {
  return monthName(period);
}

/** The first working day of the month of `day`. */
export function firstWorkingDay(day: string): string {
  let d = `${day.slice(0, 7)}-01`;
  for (let i = 0; i < 10 && !isWorkingDay(d); i++) d = addDays(d, 1);
  return d;
}

async function itemsFor(db: DbOrTx, cl: ClientRow, today: string): Promise<CheckinItem[]> {
  const [tp] = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, Number(today.slice(0, 4))))).limit(1);
  return checkinItemsFor({ regime: tp?.regime ?? 'atalany', taxStatus: tp?.status ?? null, suspended: Boolean(await pauseOn(db, cl.id, today)) });
}

export async function checkinView(deps: Deps, db: DbOrTx, cl: ClientRow, row: CheckinRow): Promise<CheckinView> {
  const today = todayBudapest(deps.now());
  const [tp] = await db.select({ status: clientTaxProfiles.status }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, Number(today.slice(0, 4))))).limit(1);
  const rows = await db.select().from(checkinItems).where(eq(checkinItems.checkinId, row.id));
  const list = await itemsFor(db, cl, today);
  const items: CheckinView['items'] = [];
  for (const item of list) {
    const t = CHECKIN_ITEM_TEXTS[item];
    const ir = rows.find((r) => r.item === item);
    const ch = ir ? await chargeById(db, ir.feeChargeId) : null;
    items.push({
      item,
      question: await deps.content.get(item === 'munkaviszony' && tp?.status === 'mellekallasu' && t.questionAlt ? 'havi.kerdes.munkaviszony_mellek' : `havi.kerdes.${item}`),
      ...(ir
        ? {
            status: ir.status,
            statusText: await deps.content.get(`havi.panel.status.${ir.status}`),
            assistId: ir.assistId,
            feeCharge: ch ? await feeChargeView(deps, db, ch) : null,
            clientText: ir.clientText,
          }
        : {}),
    });
  }
  return {
    id: row.id,
    period: row.period,
    periodLabel: periodLabel(row.period),
    status: row.status,
    dueOn: `${addDays(lastDayOfMonth(row.period), CHECKIN_RULES.dueDay)}`,
    items,
    answeredAt: row.answeredAt?.toISOString() ?? null,
  };
}

/** The open (or this month's) check-in of the client, or null. */
export async function currentCheckin(db: DbOrTx, clientId: string): Promise<CheckinRow | null> {
  const [r] = await db.select().from(monthlyCheckins).where(eq(monthlyCheckins.clientId, clientId)).orderBy(desc(monthlyCheckins.openedAt)).limit(1);
  return r ?? null;
}

/** POST /client/checkins/:id */
export async function answerCheckin(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, input: CheckinAnswerInput, ctx: { userId: string }): Promise<CheckinRow> {
  const [row] = await db.select().from(monthlyCheckins).where(and(eq(monthlyCheckins.id, id), eq(monthlyCheckins.clientId, cl.id))).limit(1).for('update');
  if (!row) throw E.notFound();
  if (row.status !== 'nyitott') throw new ApiError(409, 'checkin_closed', await deps.content.get('havi.expired'));
  const now = deps.now();
  if (input.result === 'nem_valtozott') {
    const [u] = await db.update(monthlyCheckins).set({ status: 'nem_valtozott', answeredAt: now }).where(eq(monthlyCheckins.id, row.id)).returning();
    await audit(db, { action: 'checkin.answered', actorUserId: ctx.userId, actorRole: 'client', targetType: 'checkin', targetId: row.id, clientId: cl.id, details: { result: 'nem_valtozott' } });
    return u!;
  }
  if (cl.serviceLock) {
    const { lockedError } = await import('./zarolas.js');
    throw await lockedError(deps, cl);
  }
  const allowed = await itemsFor(db, cl, todayBudapest(now));
  const answers = input.answers.filter((a) => allowed.includes(a.item));
  if (!answers.length) throw E.validation({ answers: 'Jelöld meg, mi változott.' });
  const acc = await accountantUserOf(db, cl);
  const params = await accountantParams(db, cl.accountantId);
  for (const a of answers) {
    let status: CheckinItemStatus = 'uj';
    let assistId: string | null = null;
    let feeChargeId: string | null = null;
    // a NAV-filed change: assisted (prepaid) or the client files himself with the guide
    if (a.change && (CHANGE_KINDS as readonly string[]).includes(a.change.kind) && a.how === 'helyettunk') {
      const res = await requestChangeAssist(deps, db, { cl, kind: a.change.kind as ChangeKind, change: a.change, source: 'havi_ellenorzes', by: ctx });
      assistId = res.row.id;
      feeChargeId = res.feeCharge?.id ?? null;
      status = res.feeCharge ? 'dijra_var' : 'csapatnal';
    } else if (a.how === 'magatol') status = 'ugyfel_intezi';
    if (a.item === 'alkalmazott' && a.employer) await setEmployerAnswer(deps, db, cl, a.employer, 'havi_ellenorzes', ctx.userId);
    if (a.item === 'egyeb' && a.text?.trim()) {
      const prefix = await deps.content.get('havi.egyeb_message_prefix');
      await db.insert(messages).values({ clientId: cl.id, senderUserId: ctx.userId, senderRole: 'client', kind: 'szoveg', body: `${prefix} ${a.text.trim().slice(0, CHECKIN_RULES.egyebMaxChars)}` });
    }
    await db.insert(checkinItems).values({ checkinId: row.id, clientId: cl.id, item: a.item, status, details: a, assistId, feeChargeId, createdAt: now, updatedAt: now });
  }
  const [u] = await db.update(monthlyCheckins).set({ status: 'valtozott', answers, answeredAt: now }).where(eq(monthlyCheckins.id, row.id)).returning();
  await audit(db, { action: 'checkin.answered', actorUserId: ctx.userId, actorRole: 'client', targetType: 'checkin', targetId: row.id, clientId: cl.id, details: { result: 'valtozott', items: answers.map((a) => a.item) } });
  if (acc) {
    const names = answers.map((a) => CHECKIN_ITEM_TEXTS[a.item].question).join(' · ');
    await notify(deps, db, { userId: acc.userId, kind: 'checkin_change', params: { clientName: clientName(cl), items: names, ...params }, link: '/havi-valtozasok' });
  }
  return u!;
}

/** Job checkin_open: on the first working day of the month from 09:00 (the slot decides); idempotent per client and period. */
export async function jobCheckinOpen(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  if (today !== firstWorkingDay(today)) return 0;
  const period = prevMonthKey(today.slice(0, 7));
  const cutoff = new Date(deps.now().getTime() - CHECKIN_RULES.minActiveDays * 86_400_000);
  const rows = await db.select().from(clients).where(and(eq(clients.lifecycle, 'aktiv'), lt(clients.createdAt, cutoff)));
  let n = 0;
  for (const cl of rows) {
    if (cl.serviceLock) continue;
    const ins = await db.insert(monthlyCheckins).values({ clientId: cl.id, period, status: 'nyitott', openedAt: deps.now() }).onConflictDoNothing().returning();
    if (!ins.length) continue;
    n++;
    await notify(deps, db, { userId: cl.userId, kind: 'checkin_due', params: { honap: monthName(period) }, link: '/valtozott' });
  }
  // the previous periods still open → 'lejart' (no penalty)
  await db.update(monthlyCheckins).set({ status: 'lejart' }).where(and(eq(monthlyCheckins.status, 'nyitott'), ne(monthlyCheckins.period, period)));
  return n;
}

// ---------------------------------------------------------------------------------------------------------------------
// staff queue "Havi változások"
// ---------------------------------------------------------------------------------------------------------------------
export async function teamCheckinItems(deps: Deps, db: DbOrTx, scope: { accountantId: string | null; role: string }, status?: CheckinItemStatus): Promise<TeamCheckinItem[]> {
  const rows = await db
    .select({ i: checkinItems, c: clients, ch: monthlyCheckins })
    .from(checkinItems)
    .innerJoin(clients, eq(clients.id, checkinItems.clientId))
    .innerJoin(monthlyCheckins, eq(monthlyCheckins.id, checkinItems.checkinId))
    .where(
      and(
        status ? eq(checkinItems.status, status) : inArray(checkinItems.status, ['uj', 'dijra_var', 'csapatnal', 'ugyfel_intezi']),
        scope.role === 'accountant' ? eq(clients.accountantId, scope.accountantId ?? '00000000-0000-0000-0000-000000000000') : sql`true`,
        scope.role === 'csapat' ? sql`${checkinItems.assistId} is not null` : sql`true`,
      ),
    )
    .orderBy(desc(checkinItems.createdAt));
  const out: TeamCheckinItem[] = [];
  for (const { i, c, ch } of rows) {
    const fee = await chargeById(db, i.feeChargeId);
    out.push({
      id: i.id,
      checkinId: i.checkinId,
      client: { id: c.id, name: clientName(c), lifecycle: c.lifecycle },
      period: ch.period,
      item: i.item,
      itemLabel: CHECKIN_ITEM_TEXTS[i.item].question,
      how: i.details.how ?? null,
      status: i.status,
      fee: fee ? { kind: fee.kind, amountHuf: fee.amountHuf, status: fee.status } : null,
      ball: i.status === 'dijra_var' || i.status === 'ugyfel_intezi' ? 'ugyfel' : i.status === 'csapatnal' ? 'csapat' : i.status === 'uj' ? 'konyvelo' : null,
      since: i.createdAt.toISOString(),
      details: i.details as CheckinItemAnswer,
      assistId: i.assistId,
      staffNote: i.staffNote,
    });
  }
  return out;
}

export async function decideCheckinItem(deps: Deps, db: DbOrTx, id: string, d: CheckinItemDecisionInput, actor: { userId: string; role: string; accountantId: string | null }): Promise<CheckinItemRow> {
  const [row] = await db.select({ i: checkinItems, c: clients }).from(checkinItems).innerJoin(clients, eq(clients.id, checkinItems.clientId)).where(eq(checkinItems.id, id)).limit(1);
  if (!row) throw E.notFound();
  if (actor.role === 'accountant' && row.c.accountantId !== actor.accountantId) throw E.notFound();
  if (d.status === 'nem_kell' && !d.clientText?.trim()) throw E.validation({ clientText: 'Írd meg röviden, miért nem kell teendő (az ügyfél látja).' });
  const [u] = await db
    .update(checkinItems)
    .set({ status: d.status, clientText: d.clientText?.trim().slice(0, 300) ?? row.i.clientText, staffNote: d.staffNote?.slice(0, 1000) ?? row.i.staffNote, decidedBy: actor.userId, decidedAt: deps.now(), updatedAt: deps.now() })
    .where(eq(checkinItems.id, id))
    .returning();
  await audit(db, { action: 'checkin.item_decided', actorUserId: actor.userId, actorRole: actor.role, targetType: 'checkin_item', targetId: id, clientId: row.c.id, details: { status: d.status, apply: d.apply ?? [] } });
  return u!;
}

export { capitalize, subscriptionPauses };
