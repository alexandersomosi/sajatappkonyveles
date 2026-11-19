// Background jobs of SPEC §27.8 (owner orders 11-19). Registered by ONE line in jobs.ts jobDefs().
//   assist_approvals (every 15 min): the 4-day ONYA approval of a UJEGYKE our accountant filed – client reminders
//     (+24 h, due day 09:00; max 3 messages per filing incl. the filing notice; push only 8–20 h), the staff alert on
//     the due day at 12:00 (once), and the automatic expiry 2 h after NAV's deadline (filing + 4 × 24 h).
//   kamara_reminders (daily 10:00): kamarai regisztráció 2 working days before the deadline and on the deadline (max 2).
import { and, eq, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { ASSIST_RULES } from './_shared/enums.js';
import type { Deps } from './deps.js';
import { assistRequests, auditLog, businessRegistrations, clients, notifications, teamMembers, users } from './db/schema.js';
import { audit } from './audit.js';
import { budapestParts, huDayMonthIg, todayBudapest } from './lib/dates.js';
import { addWorkingDays, isWorkingDay } from './lib/munkanap.js';
import { log, safeErr } from './log.js';
import { notify } from './notify/notify.js';
import { expireApproval, teamAssistRows, type AssistRow } from './services/assist.js';
import { accountantUserOf } from './services/team.js';
import { clientName } from './services/people.js';
import type { JobDef } from './jobs.js';

async function firstNameOf(deps: Deps, accountantId: string | null): Promise<string> {
  const a = await accountantUserOf(deps.db, { accountantId });
  return a?.firstName ?? 'A könyvelőd';
}

/** Claims one reminder slot atomically (approval_reminders = n → n + 1), so parallel workers never double-send. */
async function claimReminder(deps: Deps, row: AssistRow, n: number): Promise<boolean> {
  const done = await deps.db
    .update(assistRequests)
    .set({ approvalReminders: n + 1, lastReminderAt: deps.now() })
    .where(and(eq(assistRequests.id, row.id), eq(assistRequests.approvalReminders, n), eq(assistRequests.status, 'meghatalmazas_bekuldve')))
    .returning({ id: assistRequests.id });
  return done.length > 0;
}

export async function jobAssistApprovals(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const now = deps.now();
  const today = todayBudapest(now);
  const hour = budapestParts(now).hour;
  const out = { elso: 0, utolsoNap: 0, staff: 0, expired: 0 };
  const rows = await db.select().from(assistRequests).where(and(eq(assistRequests.status, 'meghatalmazas_bekuldve'), isNull(assistRequests.clientApprovedAt), isNotNull(assistRequests.ujegykeFiledAt)));
  for (const row of rows) {
    try {
      const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
      if (!cl) continue;
      // automatic expiry: NAV deletes an unapproved UJEGYKE after 4 calendar days (+ our 2 h grace)
      if (row.approvalExpiresAt && now.getTime() >= row.approvalExpiresAt.getTime() + ASSIST_RULES.expireGraceHours * 3600_000) {
        await db.transaction((tx) => expireApproval(deps, tx, row, { userId: null, role: 'system' }));
        out.expired++;
        continue;
      }
      const fn = await firstNameOf(deps, cl.accountantId);
      const due = row.approvalDueOn;
      const params = { firstName: fn, hatarido: due ? huDayMonthIg(due) : '' };
      const filedMs = row.ujegykeFiledAt!.getTime();
      // last-day reminder on the shown due day from 09:00 (it also counts as the 3rd message)
      if (due && today >= due && hour >= ASSIST_RULES.lastDayReminderHour && row.approvalReminders < 3) {
        const lastDay = row.lastReminderAt ? todayBudapest(row.lastReminderAt) : null;
        if (lastDay !== today || row.approvalReminders < 2) {
          if (await claimReminder(deps, row, row.approvalReminders)) {
            await notify(deps, db, { userId: cl.userId, kind: 'assist_mh_reminder', variant: 'utolso_nap', params, link: '/bekotes/meghatalmazas/jovahagyas', data: { assistId: row.id, reminder: 'utolso_nap' } });
            out.utolsoNap++;
          }
        }
      } else if (row.approvalReminders === 1 && now.getTime() - filedMs >= ASSIST_RULES.reminderAfterHours * 3600_000) {
        if (await claimReminder(deps, row, 1)) {
          await notify(deps, db, { userId: cl.userId, kind: 'assist_mh_reminder', variant: 'elso', params, link: '/bekotes/meghatalmazas/jovahagyas', data: { assistId: row.id, reminder: 'elso' } });
          out.elso++;
        }
      }
      // staff alert on the due day at 12:00, once: the assignee (else every team member) and the client's accountant
      if (due && today >= due && hour >= ASSIST_RULES.staffAlertHour && !row.staffAlertedAt) {
        const [claimed] = await db.update(assistRequests).set({ staffAlertedAt: now }).where(and(eq(assistRequests.id, row.id), isNull(assistRequests.staffAlertedAt))).returning({ id: assistRequests.id });
        if (!claimed) continue;
        const to = new Set<string>();
        if (row.assignedUserId) to.add(row.assignedUserId);
        else {
          const team = await db.select({ id: users.id }).from(users).innerJoin(teamMembers, eq(teamMembers.userId, users.id)).where(and(eq(users.role, 'csapat'), eq(users.status, 'active'), eq(teamMembers.active, true)));
          for (const t of team) to.add(t.id);
        }
        const acc = await accountantUserOf(db, cl);
        if (acc) to.add(acc.userId);
        for (const userId of to) await notify(deps, db, { userId, kind: 'assist_approval_overdue', params: { clientName: clientName(cl) }, link: `/helyettunk/${row.id}`, data: { clientId: cl.id, assistId: row.id } });
        out.staff++;
      }
    } catch (err) {
      log().warn({ err: safeErr(err), assist: row.id }, 'assist approval job item failed');
    }
  }
  // 11-19 javítás: "Jóváhagytam" was tapped, but NAV's 4 days are over and nobody confirmed that the meghatalmazás is live.
  // We cannot know whether the client really approved (then it IS live) – so no automatic expiry here (it would make our
  // accountant file a second UJEGYKE); the accountant (and the assignee) get one alert to check in ONYA and press
  // "Él a meghatalmazás" or "Nem él – a NAV törölte". Once per row (audit 'assist.verify_overdue').
  const approved = await db
    .select()
    .from(assistRequests)
    .where(and(eq(assistRequests.status, 'meghatalmazas_jovahagyva'), isNull(assistRequests.mhLiveAt), isNotNull(assistRequests.approvalExpiresAt)));
  for (const row of approved) {
    try {
      if (now.getTime() < row.approvalExpiresAt!.getTime() + ASSIST_RULES.expireGraceHours * 3600_000) continue;
      const [done] = await db.select({ id: auditLog.id }).from(auditLog).where(and(eq(auditLog.targetType, 'assist'), eq(auditLog.targetId, row.id), eq(auditLog.action, 'assist.verify_overdue'))).limit(1);
      if (done) continue;
      const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
      if (!cl) continue;
      await audit(db, { action: 'assist.verify_overdue', actorRole: 'system', targetType: 'assist', targetId: row.id, clientId: cl.id });
      const to = new Set<string>();
      if (row.assignedUserId) to.add(row.assignedUserId);
      const acc = await accountantUserOf(db, cl);
      if (acc) to.add(acc.userId);
      for (const userId of to)
        await notify(deps, db, { userId, kind: 'assist_task', variant: 'ellenorzes_kesik', params: { clientName: clientName(cl), firstName: acc?.firstName ?? 'A könyvelő' }, link: `/helyettunk/${row.id}`, data: { clientId: cl.id, assistId: row.id } });
      out.staff++;
    } catch (err) {
      log().warn({ err: safeErr(err), assist: row.id }, 'assist verify job item failed');
    }
  }
  return out;
}

/**
 * 11-19 javító kör 2: our OWN side running late. Once per working day (from 09:00) every open assist whose next step is
 * the accountant's ('egyeztetve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'ugyfel_engedelyezte') and whose
 * deadline (nextDueOf) has passed gets one reminder to the client's accountant and the assignee – or, without an
 * assignee, the active team members. Rows where the client still owes the contract / his data are never "late" for us.
 * One reminder per row and day (audit 'assist.overdue_reminder' with details.day).
 */
export async function jobAssistOverdueReminders(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  if (!isWorkingDay(today)) return 0;
  const rows = await db.select().from(assistRequests).where(inArray(assistRequests.status, ['egyeztetve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'ugyfel_engedelyezte']));
  if (!rows.length) return 0;
  const views = await teamAssistRows(deps, db, rows);
  let n = 0;
  for (const v of views) {
    try {
      if (v.ball !== 'konyvelo' || !v.nextDue?.overdue) continue;
      const row = rows.find((r) => r.id === v.id)!;
      const sent = await db
        .select({ details: auditLog.details })
        .from(auditLog)
        .where(and(eq(auditLog.targetType, 'assist'), eq(auditLog.targetId, row.id), eq(auditLog.action, 'assist.overdue_reminder')));
      if (sent.some((x) => (x.details as { day?: string } | null)?.day === today)) continue;
      const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
      if (!cl) continue;
      await audit(db, { action: 'assist.overdue_reminder', actorRole: 'system', targetType: 'assist', targetId: row.id, clientId: cl.id, details: { day: today, what: v.nextDue.what } });
      const to = new Set<string>();
      const acc = await accountantUserOf(db, cl);
      if (acc) to.add(acc.userId);
      if (row.assignedUserId) to.add(row.assignedUserId);
      else {
        const team = await db.select({ id: users.id }).from(users).innerJoin(teamMembers, eq(teamMembers.userId, users.id)).where(and(eq(users.role, 'csapat'), eq(users.status, 'active'), eq(teamMembers.active, true)));
        for (const t of team) to.add(t.id);
      }
      for (const userId of to)
        await notify(deps, db, { userId, kind: 'assist_task', variant: 'kesik', params: { clientName: clientName(cl), what: v.nextDue.what }, link: `/helyettunk/${row.id}`, data: { clientId: cl.id, assistId: row.id, reminder: 'kesik' } });
      n++;
    } catch (err) {
      log().warn({ err: safeErr(err), assist: v.id }, 'assist overdue reminder failed');
    }
  }
  return n;
}

export async function jobKamaraReminders(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const rows = await db
    .select({ r: businessRegistrations, c: clients })
    .from(businessRegistrations)
    .innerJoin(clients, eq(clients.id, businessRegistrations.clientId))
    .where(and(eq(businessRegistrations.status, 'kesz'), isNull(businessRegistrations.chamberDoneAt), isNotNull(businessRegistrations.chamberDueOn), lt(businessRegistrations.chamberReminders, 2)));
  let n = 0;
  for (const { r, c } of rows) {
    const due = r.chamberDueOn!;
    const first = addWorkingDays(due, -2);
    let want = 0;
    if (today >= due) want = 2;
    else if (today >= first) want = 1;
    if (r.chamberReminders >= want) continue;
    // one message per run; on the due day the count jumps to 2 (max 2 in total)
    const [claimed] = await db
      .update(businessRegistrations)
      .set({ chamberReminders: want })
      .where(and(eq(businessRegistrations.id, r.id), eq(businessRegistrations.chamberReminders, r.chamberReminders)))
      .returning({ id: businessRegistrations.id });
    if (!claimed) continue;
    await notify(deps, db, { userId: c.userId, kind: 'kamara_reminder', params: { hatarido: huDayMonthIg(due) }, link: '/bekotes/vallalkozas/kamara', data: { registrationId: r.id } });
    n++;
  }
  return n;
}

/**
 * Staff digest lines (§27.8, §27.2.4): "Intézzük helyette: N vár rád" (ball on the team: call to make, filing to
 * check) and "Válaszát módosította: N ügyfél" (unread client_path_changed badges of that person).
 */
export async function assistDigestLine(deps: Deps, p: { id: string; role: string }): Promise<string | null> {
  const rows = await deps.db
    .select({ status: assistRequests.status })
    .from(assistRequests)
    .where(inArray(assistRequests.status, ['visszahivas_kerve', 'bejelentes_bekuldve']));
  const [pc] = await deps.db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, p.id), eq(notifications.kind, 'client_path_changed'), isNull(notifications.readAt)));
  const lines: string[] = [];
  if (rows.length) lines.push(`- Intézzük helyette: ${rows.length} vár rád`);
  // 11-19 javító kör 2: the accountant's late items too (the ball is on him, the deadline passed).
  const acc = await deps.db.select().from(assistRequests).where(inArray(assistRequests.status, ['egyeztetve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'ugyfel_engedelyezte']));
  const late = acc.length ? (await teamAssistRows(deps, deps.db, acc)).filter((v) => v.ball === 'konyvelo' && v.nextDue?.overdue).length : 0;
  if (late) lines.push(`- Intézzük helyette – a könyvelőnél késik: ${late}`);
  if (Number(pc?.n ?? 0)) lines.push(`- Válaszát módosította (van / most indítja): ${Number(pc!.n)} ügyfél`);
  return lines.length ? lines.join('\n') : null;
}

export function jobDefsTulaj1119(): JobDef[] {
  return [
    {
      name: 'assist_approvals',
      slot: (now) => {
        const x = budapestParts(now);
        return `${x.date}T${x.hour}:${Math.floor(x.minute / 15)}`;
      },
      run: (d) => jobAssistApprovals(d),
    },
    {
      name: 'assist_overdue',
      slot: (now) => {
        const x = budapestParts(now);
        return x.hour >= 9 ? x.date : null;
      },
      run: (d) => jobAssistOverdueReminders(d),
    },
    {
      name: 'kamara_reminders',
      slot: (now) => {
        const x = budapestParts(now);
        return x.hour * 60 + x.minute >= 10 * 60 ? x.date : null;
      },
      run: (d) => jobKamaraReminders(d),
    },
  ];
}

export { sql };
