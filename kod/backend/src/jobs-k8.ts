// k8 ALAP-B jobs. Registered by ONE line in jobs.ts jobDefs() (+ one digest line call):
//  - transfer_issue      06:30 daily   – the díjbekérő of every transfer subscription whose new period started + retries
//  - transfer_reconcile  every 2 hours on working days 07–19 – Számlázz.hu / Autokassza state of the open díjbekérők
//  - transfer_reminders  09:30 daily   – 'kesik', reminders on day 1 / 4 / 8 after the due day, the optional lock
//  - guided_continue     11:00 daily   – JL 16 "Folytasd ott, ahol abbahagytad" (once per client)
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { JobDef } from './jobs.js';
import type { Deps } from './deps.js';
import { clients, payments, transferRequests, users } from './db/schema.js';
import { budapestParts, todayBudapest, weekdayOf } from './lib/dates.js';
import { log, safeErr } from './log.js';
import { fmtHuf } from './payments/huf.js';
import { jobTransferIssue, jobTransferReconcile, jobTransferReminders, dotSpace } from './services/atutalas.js';
import { clientName } from './services/people.js';

const daily = (h: number, m: number) => (now: Date) => {
  const p = budapestParts(now);
  return p.hour * 60 + p.minute >= h * 60 + m ? p.date : null;
};

/** Every 2 hours, Monday–Friday 07:00–19:59 (Budapest). */
const workingHours2 = (now: Date) => {
  const p = budapestParts(now);
  const wd = weekdayOf(p.date);
  if (wd === 0 || wd === 6 || p.hour < 7 || p.hour > 19) return null;
  return `${p.date}T${Math.floor(p.hour / 2)}`;
};

/** JL 16: a client who paused the guided run 2–14 days ago, or signed up 3–14 days ago and never finished it. Once. */
export async function jobGuidedContinue(deps: Deps): Promise<number> {
  const db = deps.db;
  const now = deps.now().getTime();
  const rows = await db
    .select({ id: clients.id, userId: clients.userId, firstName: clients.firstName, accountantId: clients.accountantId, createdAt: clients.createdAt, guided: clients.guided, isTest: clients.isTest })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.userId))
    .where(and(eq(clients.lifecycle, 'bekotes_alatt'), eq(users.status, 'active'), sql`${clients.terminated} is null`, sql`${clients.anonymizedAt} is null`, gte(clients.createdAt, new Date(now - 14 * 86_400_000))));
  const { notifyOnce } = await import('./services/emlekezteto.js');
  const { accountantParams } = await import('./notify/notify.js');
  let n = 0;
  for (const r of rows) {
    const g = r.guided ?? null;
    if (g?.finishedAt || g?.doneSeenAt) continue;
    const paused = g?.pausedAt ? Date.parse(g.pausedAt) : null;
    const due = paused !== null ? now - paused >= 2 * 86_400_000 && now - paused <= 14 * 86_400_000 : now - r.createdAt.getTime() >= 3 * 86_400_000;
    if (!due) continue;
    const p = await accountantParams(db, r.accountantId);
    if (await notifyOnce(deps, `guided_continue:${r.id}`, { userId: r.userId, kind: 'guided_continue', emailKey: 'guided_continue', params: { ...p, keresztnev: r.firstName }, link: '/bevezeto' })) n++;
  }
  return n;
}

/** JL 20–21 (+ late transfers): lines of the admins' daily digest (jobs.ts jobStaffDigest). */
export async function k8DigestLines(deps: Deps, p: { role: string }): Promise<string[]> {
  if (p.role !== 'admin') return [];
  const db = deps.db;
  const since = new Date(deps.now().getTime() - 24 * 3600_000);
  const lines: string[] = [];
  try {
    const fresh = await db.select({ f: clients.firstName, l: clients.lastName }).from(clients).where(and(gte(clients.createdAt, since), eq(clients.isTest, false))).limit(20);
    for (const c of fresh) lines.push(`- ${await deps.content.render('k8.digest.uj_ugyfel', { clientName: clientName({ firstName: c.f, lastName: c.l }) })}`);
    const failed = await db
      .select({ f: clients.firstName, l: clients.lastName, amount: payments.amountHuf })
      .from(payments)
      .innerJoin(clients, eq(clients.id, payments.clientId))
      .where(and(eq(payments.status, 'sikertelen'), inArray(payments.kind, ['havi', 'elso_havi', 'fizesd_ki']), gte(payments.updatedAt, since)))
      .limit(20);
    for (const c of failed) lines.push(`- ${await deps.content.render('k8.digest.sikertelen_levonas', { clientName: clientName({ firstName: c.f, lastName: c.l }), osszeg: fmtHuf(c.amount) })}`);
    const today = todayBudapest(deps.now());
    const late = await db
      .select({ f: clients.firstName, l: clients.lastName, amount: transferRequests.amountHuf, due: transferRequests.dueOn })
      .from(transferRequests)
      .innerJoin(clients, eq(clients.id, transferRequests.clientId))
      .where(and(eq(transferRequests.status, 'kesik'), lte(transferRequests.dueOn, today)))
      .limit(20);
    for (const c of late) lines.push(`- ${await deps.content.render('k8.digest.atutalas_kesik', { clientName: clientName({ firstName: c.f, lastName: c.l }), osszeg: fmtHuf(c.amount), hatarido: dotSpace(c.due) })}`);
  } catch (e) {
    log().warn({ err: safeErr(e) }, 'k8 digest lines failed');
  }
  return lines;
}

export function jobDefsK8(): JobDef[] {
  return [
    { name: 'transfer_issue', slot: daily(6, 30), run: (d) => jobTransferIssue(d) },
    { name: 'transfer_reconcile', slot: workingHours2, run: (d) => jobTransferReconcile(d) },
    { name: 'transfer_reminders', slot: daily(9, 30), run: (d) => jobTransferReminders(d) },
    { name: 'guided_continue', slot: daily(11, 0), run: (d) => jobGuidedContinue(d) },
  ];
}
