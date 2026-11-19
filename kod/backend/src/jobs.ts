// Background jobs (SPEC §15). Each is idempotent for its time slot; the worker runs them under a
// Postgres advisory lock and records the last run in system_state ('job.<name>').
import { and, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import brand from './_shared/brand.json' with { type: 'json' };
import type { Deps } from './deps.js';
import { accountants, appointments, clients, clientTaxProfiles, notifications, onboardingSteps, requests, systemState, taxPaymentItems, taxPeriods, users } from './db/schema.js';
import { addDays, budapestParts, huDayMonth, MONTHS_ADJ_HU, prevMonthKey, todayBudapest, WEEKDAYS_HU, weekdayOf } from './lib/dates.js';
import { log, safeErr } from './log.js';
import { accountantParams, checkPushReceipts, dispatchPending, notify, type NotifyInput } from './notify/notify.js';
import { ensureDossier } from './services/documents.js';
import { computeFlags, recomputeAllFlags } from './services/flags.js';
import { syncAll } from './services/navsync.js';
import { runGdprExports, runGdprJob } from './services/gdpr.js';
import { runBillingJob } from './services/subscription.js';
import { computeYear, ensurePeriods, periodAdj, periodLabel, ft } from './services/tax.js';
import { clientName } from './services/people.js';
import { jobCallbackSla } from './services/callbacks.js';
import { businessRegistrations, callbackRequests, teamMembers } from './db/schema.js';
import { unreadTeamThreads } from './services/team.js';
import { activityPending } from './_shared/bekotes.js';
import { answersOf } from './services/registration.js';
import { assistDigestLine, jobDefsTulaj1119 } from './jobs-tulaj1119.js';

/** Creates a notification only once per dedupe key (stored in notifications.data.dedupe). */
async function notifyOnce(deps: Deps, key: string, n: NotifyInput): Promise<boolean> {
  const [hit] = await deps.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, n.userId), sql`${notifications.data}->>'dedupe' = ${key}`))
    .limit(1);
  if (hit) return false;
  await notify(deps, deps.db, { ...n, data: { ...(n.data ?? {}), dedupe: key } });
  return true;
}

export async function jobReminders(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const out = { tax: 0, requests: 0, stuck: 0, limits: 0, digests: 0 };

  // tax items due in 7 / 3 / 1 days and not marked paid
  for (const days of [7, 3, 1]) {
    const due = addDays(today, days);
    const rows = await db
      .select({ p: taxPeriods, c: clients })
      .from(taxPeriods)
      .innerJoin(clients, eq(clients.id, taxPeriods.clientId))
      // only active clients: before activation the tax data is locked (SPEC §26.5.2, review k3c2)
      .where(and(eq(taxPeriods.dueDate, due), eq(taxPeriods.calcStatus, 'jovahagyva'), eq(taxPeriods.paymentStatus, 'fizetendo'), eq(clients.lifecycle, 'aktiv')));
    for (const { p, c } of rows) {
      const items = await db.select().from(taxPaymentItems).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt)));
      if (!items.length) continue;
      const amount = items.reduce((a, b) => a + b.amountHuf, 0);
      const ok = await notifyOnce(deps, `due:${p.id}:${days}`, {
        userId: c.userId,
        kind: 'tax_due_soon',
        params: { ...(await accountantParams(db, c.accountantId)), days, dueDateText: huDayMonth(p.dueDate).replace(/\.$/, ''), period: periodLabel(p), periodAdj: periodAdj(p), amount: ft(amount) },
        link: '/',
      });
      if (ok) out.tax++;
    }
  }

  // accountant → client requests due tomorrow or just overdue
  const reqs = await db
    .select({ r: requests, c: clients })
    .from(requests)
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .where(and(eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban']), inArray(requests.dueDate, [addDays(today, 1), addDays(today, -1), addDays(today, -4)])));
  for (const { r, c } of reqs) {
    const ok = await notifyOnce(deps, `req:${r.id}:${r.dueDate === addDays(today, 1) ? 'holnap' : today}`, {
      userId: c.userId,
      kind: 'request_reminder',
      params: { ...(await accountantParams(db, c.accountantId)), title: r.title, dueDateText: huDayMonth(r.dueDate!).replace(/\.$/, '') },
      link: '/keresek',
    });
    if (ok) out.requests++;
  }

  // onboarding steps waiting for the accountant > 3 days
  const stuck = await db
    .select({ s: onboardingSteps, c: clients })
    .from(onboardingSteps)
    .innerJoin(clients, eq(clients.id, onboardingSteps.clientId))
    .where(and(eq(onboardingSteps.status, 'konyvelore_var'), lt(onboardingSteps.updatedAt, new Date(deps.now().getTime() - 3 * 86_400_000))));
  for (const { s, c } of stuck) {
    if (!c.accountantId) continue;
    const [acc] = await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, c.accountantId)).limit(1);
    if (!acc) continue;
    const week = Math.floor(deps.now().getTime() / (3 * 86_400_000));
    const ok = await notifyOnce(deps, `stuck:${c.id}:${s.step}:${week}`, {
      userId: acc.userId,
      kind: 'onboarding_needs_review',
      params: { clientName: clientName(c), step: `Több mint 3 napja vár rád: ${s.step}` },
      link: `/ugyfelek/${c.id}/bekotes`,
      data: { clientId: c.id },
    });
    if (ok) out.stuck++;
  }

  // limit warnings (ÁFA ≥ 80 %) once a year, client + accountant
  const year = Number(today.slice(0, 4));
  const active = await db.select().from(clients).where(eq(clients.lifecycle, 'aktiv'));
  for (const c of active) {
    const comp = await computeYear(db, c.id, year, today);
    if (!comp || comp.result.meters.afa.ratio < 0.8) continue;
    const params = { ...(await accountantParams(db, c.accountantId)), percent: 80 };
    if (await notifyOnce(deps, `limit:afa80:${year}`, { userId: c.userId, kind: 'limit_warning', params, link: '/' })) out.limits++;
    if (c.accountantId) {
      const [acc] = await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, c.accountantId)).limit(1);
      // the accountant's own wording ("{clientName} elérte …"), not the client's text with a swapped name
      if (acc) await notifyOnce(deps, `limit:afa80:${year}:${c.id}`, { userId: acc.userId, kind: 'limit_warning', variant: 'accountant', params: { ...params, clientName: clientName(c) }, link: `/ugyfelek/${c.id}`, data: { clientId: c.id } });
    }
  }

  // daily e-mail digest for accountants (in-panel notifications of the last 24 h)
  const accs = await db.select({ a: accountants, email: users.email, status: users.status }).from(accountants).innerJoin(users, eq(users.id, accountants.userId)).where(eq(accountants.active, true));
  for (const { a, email, status } of accs) {
    if (status !== 'active') continue;
    const rows = await db
      .select({ title: notifications.title })
      .from(notifications)
      .where(and(eq(notifications.userId, a.userId), isNull(notifications.readAt), gte(notifications.createdAt, new Date(deps.now().getTime() - 86_400_000))));
    if (!rows.length) continue;
    const text = `Szia ${a.firstName}!\n\nAz elmúlt napban ${rows.length} új esemény történt az ügyfeleidnél:\n\n${rows
      .slice(0, 20)
      .map((r) => `- ${r.title}`)
      .join('\n')}\n\nA részleteket a panelen látod: ${deps.cfg.panelPublicUrl}\n\n${brand.name}`;
    await deps.mailer.send({ to: email, subject: `${brand.name}: ${rows.length} új esemény az ügyfeleidnél`, text, template: 'accountant_digest' }).catch((e: Error) => log().warn({ err: safeErr(e) }, 'digest failed'));
    out.digests++;
  }
  return out;
}

export async function jobAppointmentReminders(deps: Deps): Promise<number> {
  const db = deps.db;
  const now = deps.now();
  let n = 0;
  const fmtTime = (d: Date) => {
    const day = todayBudapest(d);
    const t = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    return `${WEEKDAYS_HU[weekdayOf(day)]} ${t}`;
  };
  const windows: [number, number, 'reminder24hAt' | 'reminder1hAt'][] = [
    [23 * 3600_000, 25 * 3600_000, 'reminder24hAt'],
    [0, 75 * 60_000, 'reminder1hAt'],
  ];
  for (const [from, to, col] of windows) {
    const rows = await db
      .select({ a: appointments, c: clients })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .where(and(eq(appointments.status, 'foglalt'), gte(appointments.startsAt, new Date(now.getTime() + from)), lte(appointments.startsAt, new Date(now.getTime() + to)), isNull(appointments[col])));
    for (const { a, c } of rows) {
      await db.update(appointments).set({ [col]: now }).where(eq(appointments.id, a.id));
      const ap = await accountantParams(db, a.accountantId);
      const params = { ...ap, when: fmtTime(a.startsAt), channelText: a.channel === 'telefon' ? `${ap.firstName} hív telefonon.` : 'Videóhívás – a linket az appban találod.' };
      await notify(deps, db, { userId: c.userId, kind: 'appointment_reminder', params, link: '/hataridok' });
      const [acc] = await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, a.accountantId)).limit(1);
      if (acc) await notify(deps, db, { userId: acc.userId, kind: 'appointment_reminder', variant: 'accountant', params: { ...params, clientName: clientName(c) }, link: '/idopontok', data: { clientId: c.id } });
      n++;
    }
  }
  return n;
}

/** 1st of month: dossiers + "upload last month's bank statement" requests (SPEC §15). */
export async function jobMonthly(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const month = today.slice(0, 7);
  const prev = prevMonthKey(month);
  const rows = await db.select({ c: clients, a: accountants }).from(clients).leftJoin(accountants, eq(accountants.id, clients.accountantId)).where(eq(clients.lifecycle, 'aktiv'));
  let n = 0;
  for (const { c, a } of rows) {
    await ensureDossier(db, c.id, month);
    if (!a?.monthlyStatementRequest) continue;
    const monthAdj = MONTHS_ADJ_HU[Number(prev.slice(5, 7)) - 1] ?? '';
    const title = await deps.content.render('ui.request.monthly_statement.title', { monthAdj, monthAdjA: `${/^[aáeéiíoóöőuúüű]/i.test(monthAdj) ? 'az' : 'a'} ${monthAdj}` });
    const [exists] = await db.select({ id: requests.id }).from(requests).where(and(eq(requests.clientId, c.id), eq(requests.title, title), eq(requests.dossierMonth, prev))).limit(1);
    if (exists) continue;
    const body = await deps.content.render('ui.request.monthly_statement.body', {});
    const [rq] = await db.insert(requests).values({ clientId: c.id, direction: 'konyvelotol', type: 'dokumentum', title, body, dueDate: `${month}-10`, dossierMonth: prev, createdBy: a.userId }).returning({ id: requests.id });
    await notify(deps, db, { userId: c.userId, kind: 'request_new', params: { ...(await accountantParams(db, a.id)), title, body }, link: '/keresek', data: { requestId: rq!.id } });
    n++;
  }
  return n;
}

/** 1 January: next year's tax profiles (copied, flagged for review) and periods. */
export async function jobNewYear(deps: Deps): Promise<number> {
  const db = deps.db;
  const year = Number(todayBudapest(deps.now()).slice(0, 4));
  const rows = await db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.year, year - 1));
  let n = 0;
  for (const p of rows) {
    const [cl] = await db.select({ lifecycle: clients.lifecycle }).from(clients).where(eq(clients.id, p.clientId)).limit(1);
    if (!cl || cl.lifecycle === 'megszunt') continue;
    await db
      .insert(clientTaxProfiles)
      .values({
        clientId: p.clientId,
        year,
        costRatio: p.costRatio,
        costRatioSource: 'ugyfel_javaslat',
        status: p.status,
        guaranteedMinimum: p.guaranteedMinimum,
        retail: p.retail,
        insuranceBreaks: [],
        hipaMethod: p.hipaMethod,
        hipaRatePct: p.hipaRatePct,
        hipaAccountNumber: p.hipaAccountNumber,
      })
      .onConflictDoNothing();
    await ensurePeriods(db, p.clientId, year, p.hipaMethod);
    n++;
  }
  return n;
}

export async function jobEvery5Min(deps: Deps): Promise<Record<string, number>> {
  // SPEC §26.2.8: callback SLA first (its notifications go out with this run's dispatch).
  const sla = await jobCallbackSla(deps);
  const d = await dispatchPending(deps);
  const flags = await recomputeAllFlags(deps);
  return { ...d, flags, callbacksOverdue: sla.overdue, callingCleared: sla.cleared };
}

export async function jobHourly(deps: Deps): Promise<Record<string, number>> {
  // SPEC §26.2.9: appointment reminders are retired (jobAppointmentReminders is kept for reference, never run).
  const disabledTokens = await checkPushReceipts(deps).catch(() => 0);
  return { appointmentsSent: 0, disabledTokens };
}

/**
 * SPEC §26.1.5 (daily 10:00): the client got the guide but did not upload the NAV confirmation for 3 days → one
 * reminder, a second after 10 days (max 2); the data form untouched for 3 days → one reminder (variant 'adatlap').
 * Quiet while the client has an open callback.
 */
export async function jobRegistrationReminders(deps: Deps): Promise<number> {
  const db = deps.db;
  const now = deps.now();
  const day = 86_400_000;
  const rows = await db
    .select({ r: businessRegistrations, c: clients })
    .from(businessRegistrations)
    .innerJoin(clients, eq(clients.id, businessRegistrations.clientId))
    .where(and(inArray(businessRegistrations.status, ['kitoltes', 'utmutato']), eq(clients.lifecycle, 'bekotes_alatt')));
  let n = 0;
  for (const { r, c } of rows) {
    const [cb] = await db.select({ id: callbackRequests.id }).from(callbackRequests).where(and(eq(callbackRequests.clientId, c.id), inArray(callbackRequests.status, ['uj', 'folyamatban']))).limit(1);
    if (cb) continue;
    let variant: string | undefined;
    // SPEC §27.3: "Intézzük helyetted" – after the kérdőív our accountant files it; the guide reminder does not apply.
    if (r.mode === 'segitett' && r.status === 'utmutato') continue;
    if (r.status === 'utmutato' && !r.filedAt) {
      // The client waits for us (the exact ÖVTJ line): no nagging until the team wrote it.
      if (activityPending(answersOf(r))) continue;
      const age = now.getTime() - r.statusChangedAt.getTime();
      const due = (r.reminderCount === 0 && age >= 3 * day) || (r.reminderCount === 1 && age >= 10 * day);
      if (!due) continue;
    } else if (r.status === 'kitoltes') {
      if (r.reminderCount >= 1 || now.getTime() - r.updatedAt.getTime() < 3 * day) continue;
      variant = 'adatlap';
    } else continue;
    const [claimed] = await db
      .update(businessRegistrations)
      .set({ reminderCount: r.reminderCount + 1, lastReminderAt: now })
      .where(and(eq(businessRegistrations.id, r.id), eq(businessRegistrations.reminderCount, r.reminderCount)))
      .returning({ id: businessRegistrations.id });
    if (!claimed) continue;
    await notify(deps, db, { userId: c.userId, kind: 'registration_reminder', ...(variant ? { variant } : {}), link: variant ? '/bekotes/vallalkozas/adatlap' : '/bekotes/vallalkozas/utmutato' });
    n++;
  }
  return n;
}

/** SPEC §26.11 (daily 08:00): one e-mail to every team member and admin, only when something waits. */
export async function jobStaffDigest(deps: Deps): Promise<number> {
  const db = deps.db;
  const now = deps.now();
  const open = await db.select({ due: callbackRequests.dueAt, assigned: callbackRequests.assignedUserId }).from(callbackRequests).where(inArray(callbackRequests.status, ['uj', 'folyamatban']));
  const overdue = open.filter((o) => o.due.getTime() < now.getTime()).length;
  const [waiting] = await db.select({ n: sql<number>`count(*)::int` }).from(businessRegistrations).where(eq(businessRegistrations.status, 'beadva'));
  const threads = await unreadTeamThreads(db);
  const people = await db
    .select({ id: users.id, email: users.email, role: users.role, displayName: users.displayName, first: teamMembers.firstName, active: teamMembers.active })
    .from(users)
    .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
    .where(and(inArray(users.role, ['csapat', 'admin']), eq(users.status, 'active')));
  let n = 0;
  for (const p of people) {
    if (p.role === 'csapat' && !p.active) continue;
    const lines: string[] = [];
    if (open.length) lines.push(`- Nyitott visszahívás: ${open.length} (ebből lejárt: ${overdue}, nálad: ${open.filter((o) => o.assigned === p.id).length})`);
    if (Number(waiting?.n ?? 0)) lines.push(`- Ellenőrzésre vár (vállalkozás-indítás): ${Number(waiting?.n ?? 0)}`);
    if (p.role === 'csapat' && threads) lines.push(`- Olvasatlan üzenet bekötés alatti ügyféltől: ${threads}`);
    const assistLine = await assistDigestLine(deps, p); // SPEC §27.8
    if (assistLine) lines.push(assistLine);
    if (!lines.length) continue;
    const firstName = p.first ?? (p.displayName ?? '').trim().split(/\s+/).pop() ?? '';
    const params = { brand: brand.name, count: lines.length, firstName, lines: lines.join('\n'), panelUrl: deps.cfg.panelPublicUrl };
    await deps.mailer
      .send({ to: p.email, subject: await deps.content.render('email.staff_digest.subject', params), text: await deps.content.render('email.staff_digest.body', params), template: 'staff_digest' })
      .then(() => n++)
      .catch((e: Error) => log().warn({ err: safeErr(e) }, 'staff digest failed'));
  }
  return n;
}

export interface JobDef {
  name: string;
  /** Returns the slot key when the job is due now (Budapest time), else null. */
  slot(now: Date, deps: Deps): string | null;
  run(deps: Deps): Promise<unknown>;
}

const at = (h: number, m: number) => (now: Date) => {
  const p = budapestParts(now);
  return p.hour * 60 + p.minute >= h * 60 + m ? p.date : null;
};

export function jobDefs(deps: Deps): JobDef[] {
  return [
    { name: 'nav_sync', slot: at(deps.cfg.nav.syncHour, 30), run: (d) => syncAll(d) },
    { name: 'billing', slot: at(6, 0), run: (d) => runBillingJob(d) },
    { name: 'reminders', slot: at(8, 0), run: (d) => jobReminders(d) },
    { name: 'staff_digest', slot: at(8, 0), run: (d) => jobStaffDigest(d) },
    { name: 'registration_reminders', slot: at(10, 0), run: (d) => jobRegistrationReminders(d) },
    ...jobDefsTulaj1119(), // SPEC §27.8 (B1): assist_approvals every 15 min, kamara_reminders daily 10:00
    { name: 'gdpr', slot: at(3, 30), run: (d) => runGdprJob(d) },
    {
      name: 'gdpr_export',
      slot: (now) => {
        const p = budapestParts(now);
        return `${p.date}T${p.hour}:${p.minute}`;
      },
      run: (d) => runGdprExports(d),
    },
    {
      name: 'monthly',
      slot: (now) => {
        const p = budapestParts(now);
        return p.day === 1 && p.hour * 60 + p.minute >= 6 * 60 + 10 ? p.date : null;
      },
      run: (d) => jobMonthly(d),
    },
    {
      name: 'new_year',
      slot: (now) => {
        const p = budapestParts(now);
        return p.month === 1 && p.day === 1 && p.hour * 60 + p.minute >= 10 ? p.date : null;
      },
      run: (d) => jobNewYear(d),
    },
    {
      name: 'hourly',
      slot: (now) => {
        const p = budapestParts(now);
        return `${p.date}T${p.hour}`;
      },
      run: (d) => jobHourly(d),
    },
    {
      name: 'every5',
      slot: (now) => {
        const p = budapestParts(now);
        return `${p.date}T${p.hour}:${Math.floor(p.minute / 5)}`;
      },
      run: (d) => jobEvery5Min(d),
    },
  ];
}

/**
 * Runs the job if its slot was not claimed yet. The claim is an atomic compare-and-set on
 * system_state (works with any number of worker processes and without holding a transaction).
 */
export async function runIfDue(deps: Deps, job: JobDef): Promise<boolean> {
  const slot = job.slot(deps.now(), deps);
  if (!slot) return false;
  const key = `job.${job.name}`;
  await deps.db.insert(systemState).values({ key, value: {} }).onConflictDoNothing();
  const claimed = await deps.db
    .update(systemState)
    .set({ value: { slot, running: true, startedAt: deps.now().toISOString() }, updatedAt: deps.now() })
    .where(and(eq(systemState.key, key), sql`coalesce(${systemState.value}->>'slot', '') <> ${slot}`))
    .returning({ key: systemState.key });
  if (!claimed.length) return false;
  const started = Date.now();
  let result: unknown;
  let error: string | null = null;
  try {
    result = await job.run(deps);
  } catch (err) {
    const se = safeErr(err);
    error = String(se.message ?? `${String(se.name)} ${JSON.stringify(se.db ?? {})}`).slice(0, 300);
    log().error({ job: job.name, err: se }, 'job failed');
  }
  const value = { slot, ok: !error, error, result: result ?? null, ms: Date.now() - started, at: deps.now().toISOString() };
  await deps.db.update(systemState).set({ value, updatedAt: deps.now() }).where(eq(systemState.key, key));
  return true;
}

export async function heartbeat(deps: Deps): Promise<void> {
  const value = { pid: process.pid, at: deps.now().toISOString() };
  await deps.db.insert(systemState).values({ key: 'worker.heartbeat', value }).onConflictDoUpdate({ target: systemState.key, set: { value, updatedAt: deps.now() } });
}

export { computeFlags };
