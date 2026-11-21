// SPEC §28.K.4 – automatic reminders and nudges (job reminders_k28, daily 08:00). A reminder goes out only when the
// client can act and it matters now; every kind has its own toggle (notify() reads notification_prefs); push follows the
// quiet hours; at most ONE nudge push per client per day (several waiting items → one push "{n} dolog vár rád", the
// in-app rows per item). Dedupe: notifications.data.dedupe = rem:<kind>:<item id>:<step>.
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { REMINDER_RULES, type NudgeSubject } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { accountants, annualClosings, assistRequests, clientAllowances, clients, documents, feeCharges, monthlyCheckins, notifications, requests, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { addDays, budapestLocalToUtc, huDayMonth, huDayMonthIg, monthLabel, monthName, prevMonthKey, todayBudapest } from '../lib/dates.js';
import { nextWorkingDay } from '../lib/munkanap.js';
import { KATA_F1_RULES } from '../_shared/kata.js';
import { periodVisible } from './tax.js';
import { accountantParams, notify, type NotifyInput } from '../notify/notify.js';
import { fmt } from './kedvezmeny.js';

/** Sends `n` once per dedupe key (true when sent now). */
export async function notifyOnce(deps: Deps, key: string, n: NotifyInput): Promise<boolean> {
  const [hit] = await deps.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, n.userId), sql`${notifications.data}->>'dedupe' = ${key}`))
    .limit(1);
  if (hit) return false;
  const id = await notify(deps, deps.db, { ...n, data: { ...(n.data ?? {}), dedupe: key } });
  return Boolean(id);
}

const daysAgo = (deps: Deps, d: Date) => Math.floor((deps.now().getTime() - d.getTime()) / 86_400_000);

export async function jobRemindersK28(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const out = { taxToday: 0, taxLate: 0, requests: 0, statements: 0, nudges: 0, kata: 0 };
  const active = await db.select().from(clients).where(eq(clients.lifecycle, 'aktiv'));
  const byId = new Map(active.map((c) => [c.id, c]));

  // 1. tax payment: on the due day and one day after (the 7/3/1 days before stay in jobReminders)
  for (const [variant, due] of [
    ['ma', today],
    ['lejart', addDays(today, -REMINDER_RULES.taxOverdueDaysAfter)],
  ] as const) {
    // SPEC §32: never a hidden or backfilled row; the KATA months get their own texts below
    const rows = await db
      .select()
      .from(taxPeriods)
      .where(and(eq(taxPeriods.dueDate, due), eq(taxPeriods.calcStatus, 'jovahagyva'), eq(taxPeriods.paymentStatus, 'fizetendo'), periodVisible, eq(taxPeriods.backfilled, false), sql`${taxPeriods.kind} <> 'kata'`));
    for (const p of rows) {
      const cl = byId.get(p.clientId);
      if (!cl) continue;
      const items = await db.select().from(taxPaymentItems).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt)));
      if (!items.length) continue;
      const osszeg = fmt(items.reduce((a, b) => a + b.amountHuf, 0));
      if (await notifyOnce(deps, `rem:tax_due_soon:${p.id}:${variant}`, { userId: cl.userId, kind: 'tax_due_soon', variant, params: { ...(await accountantParams(db, cl.accountantId)), osszeg }, link: '/' }))
        variant === 'ma' ? out.taxToday++ : out.taxLate++;
    }
  }

  // 1b. SPEC §32 – KATA: on the 8th (or the next working day) for the month due this month ('kata'), on the due day
  // ('kata_ma') and one day after ('kata_lejart'). Only an unmarked item of a visible, not backfilled, not free month with
  // a confirmed amount; payment texts go to a locked client too (as the quarters'). Push + e-mail (tax_due_soon), the
  // client's own setting wins; one per step (notifyOnce).
  const eighth = nextWorkingDay(`${today.slice(0, 7)}-${String(KATA_F1_RULES.reminderDay).padStart(2, '0')}`) === today;
  const kataRows = await db
    .select()
    .from(taxPeriods)
    .where(
      and(
        eq(taxPeriods.kind, 'kata'),
        periodVisible,
        eq(taxPeriods.backfilled, false),
        isNull(taxPeriods.exemptReason),
        eq(taxPeriods.calcStatus, 'jovahagyva'),
        inArray(taxPeriods.paymentStatus, ['fizetendo', 'elteres']),
        sql`${taxPeriods.dueDate} between ${addDays(today, -1)} and ${addDays(today, 10)}`,
      ),
    );
  for (const p of kataRows) {
    const cl = byId.get(p.clientId);
    if (!cl) continue;
    const step = p.dueDate === today ? 'ma' : p.dueDate === addDays(today, -1) ? 'lejart' : eighth && p.dueDate.slice(0, 7) === today.slice(0, 7) ? '8' : null;
    if (!step) continue;
    const items = await db.select().from(taxPaymentItems).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt)));
    if (!items.length) continue;
    const params = { ...(await accountantParams(db, cl.accountantId)), osszeg: fmt(items.reduce((a, b) => a + b.amountHuf, 0)), honap: monthName(Number(p.periodKey.slice(5, 7))), datum: huDayMonth(p.dueDate), hatarido: huDayMonthIg(p.dueDate) };
    const variant = step === 'ma' ? 'kata_ma' : step === 'lejart' ? 'kata_lejart' : 'kata';
    if (await notifyOnce(deps, `rem:kata:${p.id}:${step}`, { userId: cl.userId, kind: 'tax_due_soon', variant, params, link: `/fizetes/${p.id}`, data: { periodId: p.id } })) out.kata++;
  }

  // 2. open accountant requests: 3 and 7 days after they were sent
  const reqs = await db.select().from(requests).where(and(eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban'])));
  for (const r of reqs) {
    const cl = byId.get(r.clientId);
    if (!cl || cl.serviceLock) continue;
    const age = daysAgo(deps, r.createdAt);
    const step = (REMINDER_RULES.requestNudgeDays as readonly number[]).includes(age) ? age : null;
    if (!step) continue;
    if (await notifyOnce(deps, `rem:request_reminder:${r.id}:nap${step}`, { userId: cl.userId, kind: 'request_reminder', variant: `nap${step}`, params: { ...(await accountantParams(db, cl.accountantId)), title: r.title }, link: '/keresek' })) out.requests++;
  }

  // 3. bank statement on the 5th: monthly_statement_request on, no 'bankszamlakivonat' for last month
  if (Number(today.slice(8, 10)) === REMINDER_RULES.statementDay) {
    const last = prevMonthKey(today.slice(0, 7));
    for (const cl of active) {
      if (cl.serviceLock || !cl.accountantId) continue;
      const [acc] = await db.select({ on: accountants.monthlyStatementRequest }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1);
      if (!acc?.on) continue;
      const [doc] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.clientId, cl.id), eq(documents.dossierMonth, last), eq(documents.category, 'bankszamlakivonat'), isNull(documents.deletedAt))).limit(1);
      if (doc) continue;
      if (await notifyOnce(deps, `rem:upload_reminder:${cl.id}:kivonat:${last}`, { userId: cl.userId, kind: 'upload_reminder', variant: 'kivonat', params: { honap: monthLabel(last).toLowerCase() }, link: `/dosszie/${last}` })) out.statements++;
    }
  }

  // 4. nudges: anything waiting on the client for 3 or 7 days (one row per item, one push per client per day)
  const waiting = new Map<string, { subject: NudgeSubject; id: string; step: number; link: string }[]>();
  const add = (clientId: string, subject: NudgeSubject, id: string, since: Date | null, link: string) => {
    if (!since) return;
    const age = daysAgo(deps, since);
    if (!(REMINDER_RULES.waitingNudgeDays as readonly number[]).includes(age)) return;
    const list = waiting.get(clientId) ?? [];
    list.push({ subject, id, step: age, link });
    waiting.set(clientId, list);
  };
  for (const ch of await db.select().from(monthlyCheckins).where(eq(monthlyCheckins.status, 'nyitott'))) add(ch.clientId, 'havi_ellenorzes', ch.id, ch.openedAt, '/valtozott');
  for (const a of await db.select().from(clientAllowances).where(eq(clientAllowances.status, 'kerdes'))) add(a.clientId, 'kedvezmeny_kerdes', a.id, a.decidedAt, '/kedvezmenyek');
  for (const a of await db.select().from(annualClosings).where(inArray(annualClosings.status, ['kerdoiv', 'jovahagyasra_var'])))
    add(a.clientId, a.status === 'kerdoiv' ? 'eves_kerdoiv' : 'eves_jovahagyas', a.id, a.updatedAt, '/eves-zaras');
  for (const f of await db.select().from(feeCharges).where(eq(feeCharges.status, 'nyitott'))) add(f.clientId, 'dij', f.id, f.createdAt, '/fiok/dijak');
  for (const a of await db.select().from(assistRequests).where(eq(assistRequests.status, 'meghatalmazas_el'))) if (a.kind.startsWith('valtozas_')) add(a.clientId, 'valtozas_engedely', a.id, a.statusChangedAt, `/valtozas/engedely?assist=${a.id}`);
  for (const [clientId, list] of waiting) {
    const cl = byId.get(clientId);
    if (!cl) continue;
    const params = await accountantParams(db, cl.accountantId);
    let sent = 0;
    for (const it of list) {
      const mi = await deps.content.render(`emlekezteto.nudge_subjects.${it.subject}`, params);
      if (await notifyOnce(deps, `rem:nudge:${it.id}:${it.step}`, { userId: cl.userId, kind: 'nudge', variant: 'egy', params: { ...params, mi }, link: it.link, noPush: list.length > 1 })) sent++;
    }
    if (list.length > 1 && sent) await notifyOnce(deps, `rem:nudge:${clientId}:tobb:${today}`, { userId: cl.userId, kind: 'nudge', variant: 'tobb', params: { n: list.length }, link: '/' });
    out.nudges += sent;
  }
  return out;
}

/** Staff digest line "Ügyfélre vár 7 napja: N". */
export async function staffOverdueCount(deps: Deps): Promise<number> {
  const cutoff = new Date(deps.now().getTime() - REMINDER_RULES.staffOverdueDays * 86_400_000);
  const a = await deps.db.select({ id: monthlyCheckins.id }).from(monthlyCheckins).where(and(eq(monthlyCheckins.status, 'nyitott'), lt(monthlyCheckins.openedAt, cutoff)));
  const b = await deps.db.select({ id: feeCharges.id }).from(feeCharges).where(and(eq(feeCharges.status, 'nyitott'), lt(feeCharges.createdAt, cutoff)));
  return a.length + b.length;
}

export { gte, budapestLocalToUtc };
