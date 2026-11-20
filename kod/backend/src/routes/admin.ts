// /admin – role admin (SPEC §12.6). Business data only: no documents, messages, KYC or NAV data
// of clients (least privilege, SPEC §1 and §4.6).
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { CLIENT_LIFECYCLES, SUBSCRIPTION_STATUSES } from '../_shared/enums.js';
import { integrationModes } from '../config.js';
import type { Deps } from '../deps.js';
import {
  accountants,
  auditLog,
  cardRegistrations,
  clients,
  contentTexts,
  demoOutbox,
  messages,
  documents,
  faqItems,
  feeInvoices,
  navSyncRuns,
  paymentTokens,
  referralCodes,
  requests,
  signupAttribution,
  simplepayTransactions,
  subscriptions,
  systemState,
  taxPaymentItems,
  taxPeriods,
  users,
} from '../db/schema.js';
import { auditC } from '../audit.js';
import { requireAuth } from '../auth/middleware.js';
import { registerAdminK28Routes } from './acc-k28.js';
import { registerAdminPaymentsK29 } from './payments-k29.js';
import { registerAdminConsoleRoutes } from './admin-konzol.js';
import { registerAdminMarketingRoutes } from './admin-marketing.js';
import { issueCode } from '../auth/codes.js';
import { hmacHex } from '../lib/crypto.js';
import { endRelationship } from '../services/kyc.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { addDays, budapestLocalToUtc, todayBudapest } from '../lib/dates.js';
import { isValidAdoazonositoJel, isPlausibleEmail, normalizeEmail } from '../lib/validators.js';
import { placeholdersOf, DEFAULT_TEXTS } from '../content.js';
import { groupPlaceholders } from '../content/tulaj1118.js';
import { notify, sendCodeEmail } from '../notify/notify.js';
import brand from '../_shared/brand.json' with { type: 'json' };
import { chargeDue, chargeSubscription, cancelSubscription, deleteCard, hasUsableCard, notifyCardDeletedByAdmin, notifyServiceEnded } from '../services/subscription.js';
import { clientName } from '../services/people.js';
import type { AdminServiceStats, TeamMemberRow } from '../_shared/api.js';
import { assistRequests, businessRegistrations, callbackAttempts, callbackRequests, teamMembers } from '../db/schema.js';
import { ASSIST_OPEN_STATUSES } from '../_shared/enums.js';
import { freeDiskPct } from '../files/quota.js';

const CONTENT_GROUPS: [string, string][] = [
  ['notif.', 'Értesítések'],
  ['email.', 'E-mailek'],
  ['ui.', 'Appszövegek'],
  ['bekotes.magyarazat.', 'Magyarázatok (Mi ez? Miért kell? Hol találod?)'],
  ['bekotes.', 'Bekötés'],
  ['korlatozott.', 'Korlátozott mód a bekötés alatt'],
  ['vallalkozas.', 'Vállalkozás bejelentése'],
  ['visszahivas.', 'Visszahívás'],
];

/** Retired appointment texts (LEGACY_NOTIFICATION_KINDS): kept so old notifications still render, never sent. */
const LEGACY_CONTENT_KEY = /^(notif|email)\.appointment_(booked|reminder|cancelled)(\.|$)/;

/** Content keys an admin cannot edit: the sign-in mails with codes / invite links. */
const LOCKED_CONTENT_KEY = /^email\.auth_(email_code|password_reset_code|staff_invite|staff_invite_csapat)\./;

/** Tells the client (message + push) and both accountants (e-mail) about a reassignment. */
export async function reassignmentNotices(deps: Deps, cl: typeof clients.$inferSelect, fromAccId: string | null, toAccId: string | null): Promise<void> {
  const accRow = async (id: string | null) =>
    id ? (await deps.db.select({ a: accountants, email: users.email }).from(accountants).innerJoin(users, eq(users.id, accountants.userId)).where(eq(accountants.id, id)).limit(1))[0] ?? null : null;
  const from = await accRow(fromAccId);
  const to = await accRow(toAccId);
  const clientLabel = `${cl.lastName} ${cl.firstName}`.trim();
  if (to) {
    await deps.db.insert(messages).values({ clientId: cl.id, senderUserId: null, senderRole: 'system', kind: 'rendszer', body: `Mostantól ${to.a.displayName} a könyvelőd. Az eddigi üzeneteid és irataid megmaradnak, ő is látja őket.` });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'message_new', variant: 'accountant_changed', params: { accountantName: to.a.displayName, firstNameFrom: to.a.nameFrom ?? to.a.firstName }, link: '/uzenetek' });
  }
  const mail = async (r: { email: string } | null, key: 'staff_client_assigned' | 'staff_client_removed') => {
    if (!r) return;
    const params = { brand: brand.name, clientName: clientLabel, panelUrl: deps.cfg.panelPublicUrl };
    try {
      await deps.mailer.send({ to: r.email, subject: await deps.content.render(`email.${key}.subject`, params), text: await deps.content.render(`email.${key}.body`, params), template: key });
    } catch {
      /* the audit row stays; a mail problem must not undo the reassignment */
    }
  };
  await mail(to, 'staff_client_assigned');
  await mail(from, 'staff_client_removed');
}

export function adminRoutes(deps: Deps) {
  const r = new Hono<Env>();
  r.use('*', requireAuth(deps, { roles: ['admin'] }));
  // SPEC §28.K.1: /admin/fees, /admin/fee-charges/:id/{waive,refunded}
  registerAdminK28Routes(r, deps);
  // SPEC §29.1.14 (B1): /admin/k29/{subscriptions,payments,fee-invoices,system}
  registerAdminPaymentsK29(r, deps);
  // SPEC §29.9 F9: the owner console (/admin/console/**; TOTP + step-up)
  registerAdminConsoleRoutes(r, deps);
  // SPEC §31.4: the Marketing tab (/admin/marketing, /admin/marketing/koltes)
  registerAdminMarketingRoutes(r, deps);

  /**
   * DEMO only: no mail leaves the server and the Demo-postafiók hides other staff members' sign-in mails, so a newly
   * invited colleague could never finish signing up. The admin who created the account gets the invite code ONCE, in
   * the answer of the create call (never stored readable, never listed later). With real SMTP nothing is returned.
   */
  const demoInvite = (code: string) => (deps.mailer.mode === 'demo' ? { demoInviteCode: code, demoInviteNote: 'DEMO: a meghívó nem megy ki e-mailben. Ezt a kódot add át a kollégának – csak most látod, 15 percig érvényes.' } : {});

  r.get('/dashboard', async (c) => {
    const today = todayBudapest(deps.now());
    const monthStart = `${today.slice(0, 7)}-01`;
    // Clients created by our own test scripts (is_test) are left out of every KPI.
    const all = await deps.db.select({ lifecycle: clients.lifecycle, createdAt: clients.createdAt, accountantId: clients.accountantId, id: clients.id }).from(clients).where(eq(clients.isTest, false));
    const realIds = new Set(all.map((x) => x.id));
    const byLifecycle = Object.fromEntries(CLIENT_LIFECYCLES.map((l) => [l, all.filter((x) => x.lifecycle === l).length]));
    const newThisMonth = all.filter((x) => todayBudapest(x.createdAt) >= monthStart).length;
    const subs = (await deps.db.select({ clientId: subscriptions.clientId, status: subscriptions.status, canceledAt: subscriptions.canceledAt, cancelAt: subscriptions.cancelAtPeriodEnd }).from(subscriptions)).filter((s) => realIds.has(s.clientId));
    // MRR: only subscriptions that will be charged again (not those cancelled at period end).
    const active = subs.filter((s) => (s.status === 'active' || s.status === 'past_due') && !s.cancelAt).length;
    const ending = subs.filter((s) => (s.status === 'active' || s.status === 'past_due') && s.cancelAt).length;
    const [onb] = await deps.db.select({ n: sql<number>`count(distinct os.client_id)::int` }).from(sql`onboarding_steps os join clients cl on cl.id = os.client_id`).where(sql`os.step = 'adatok' and os.status = 'kesz' and cl.is_test = false`);
    const fin = await deps.db
      .select({ month: sql<string>`to_char(${simplepayTransactions.finishedAt} at time zone 'Europe/Budapest', 'YYYY-MM')`, amount: sql<number>`sum(${simplepayTransactions.amountHuf})::bigint` })
      .from(simplepayTransactions)
      .innerJoin(clients, eq(clients.id, simplepayTransactions.clientId))
      .where(and(eq(simplepayTransactions.status, 'FINISHED'), eq(clients.isTest, false), gte(simplepayTransactions.finishedAt, new Date(`${Number(today.slice(0, 4)) - 1}-${today.slice(5, 7)}-01T00:00:00Z`))))
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    // k7 integrator: the §29 payments (Stripe / DEMO provider) count too – successful money rows (no card change),
    // minus what was refunded; the old SimplePay rows above stay for the history
    const since = `${Number(today.slice(0, 4)) - 1}-${today.slice(5, 7)}-01T00:00:00Z`;
    const res29 = await deps.db.execute(sql`select to_char(p.succeeded_at at time zone 'Europe/Budapest', 'YYYY-MM') as month, sum(p.amount_huf - coalesce(p.refunded_huf, 0))::bigint as amount
        from payments p join clients cl on cl.id = p.client_id
        where p.status = 'sikeres' and p.kind <> 'kartya' and p.succeeded_at is not null and cl.is_test = false and p.succeeded_at >= ${since}::timestamptz
        group by 1 order by 1`);
    const fin29 = (res29 as unknown as { rows: { month: string; amount: number | string }[] }).rows;
    for (const r of fin29) {
      const m = fin.find((f) => f.month === r.month);
      if (m) m.amount = Number(m.amount) + Number(r.amount);
      else fin.push({ month: r.month, amount: Number(r.amount) });
    }
    fin.sort((a, b) => a.month.localeCompare(b.month));
    const failed = subs.filter((s) => s.status === 'past_due' || s.status === 'suspended').length;
    const accs = await deps.db.select().from(accountants).orderBy(asc(accountants.displayName));
    const accRows = [];
    for (const a of accs) {
      const mine = all.filter((x) => x.accountantId === a.id && x.lifecycle !== 'megszunt');
      const ids = mine.map((x) => x.id);
      const [open] = ids.length ? await deps.db.select({ n: count() }).from(requests).where(and(inArray(requests.clientId, ids), inArray(requests.status, ['nyitott', 'folyamatban']))) : [{ n: 0 }];
      accRows.push({ id: a.id, name: a.displayName, clients: mine.length, openRequests: Number(open?.n ?? 0), overdueItems: await overdueCount(ids, today) });
    }
    return c.json({
      clients: { total: all.length, byLifecycle, newThisMonth },
      funnel: { registered: all.length, onboardingStarted: Number(onb?.n ?? 0), subscribed: subs.filter((s) => s.status !== 'incomplete').length, active: byLifecycle.aktiv ?? 0 },
      mrrHuf: active * (await (await import('../services/dijak.js')).monthlyPriceHuf(deps)),
      endingSubscriptions: ending,
      revenueByMonth: fin.map((f) => ({ month: f.month, amountHuf: Number(f.amount) })),
      failedPayments: failed,
      cancellationsThisMonth: subs.filter((s) => s.canceledAt && todayBudapest(s.canceledAt) >= monthStart).length,
      accountants: accRows,
      service: await serviceStats(monthStart),
      demo: deps.cfg.appEnv === 'demo',
    });
  });

  /** SPEC §26.3.4: the two extra dashboard tiles (callbacks, new-business pipeline). */
  async function serviceStats(monthStart: string): Promise<AdminServiceStats> {
    const now = deps.now();
    const monthStartAt = budapestLocalToUtc(monthStart);
    const open = await deps.db.select({ due: callbackRequests.dueAt }).from(callbackRequests).where(inArray(callbackRequests.status, ['uj', 'folyamatban']));
    const [done] = await deps.db.select({ n: count() }).from(callbackRequests).where(and(eq(callbackRequests.status, 'teljesitve'), gte(callbackRequests.closedAt, monthStartAt)));
    const firsts = await deps.db
      .select({ created: callbackRequests.createdAt, first: sql<Date>`min(${callbackAttempts.at})` })
      .from(callbackRequests)
      .innerJoin(callbackAttempts, eq(callbackAttempts.callbackId, callbackRequests.id))
      .where(gte(callbackRequests.createdAt, new Date(now.getTime() - 30 * 86_400_000)))
      .groupBy(callbackRequests.id, callbackRequests.createdAt);
    const hours = firsts.map((f) => (new Date(f.first).getTime() - f.created.getTime()) / 3600_000).sort((a, b) => a - b);
    const median = hours.length ? (hours.length % 2 ? hours[(hours.length - 1) / 2]! : (hours[hours.length / 2 - 1]! + hours[hours.length / 2]!) / 2) : null;
    const [pipe] = await deps.db.select({ n: count() }).from(businessRegistrations).where(inArray(businessRegistrations.status, ['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve']));
    const [regDone] = await deps.db.select({ n: count() }).from(businessRegistrations).where(and(eq(businessRegistrations.status, 'kesz'), gte(businessRegistrations.doneAt, monthStartAt)));
    const [regOut] = await deps.db.select({ n: count() }).from(businessRegistrations).where(and(eq(businessRegistrations.status, 'elallt'), gte(businessRegistrations.withdrawnAt, monthStartAt)));
    return {
      callbacks: { open: open.length, overdue: open.filter((o) => o.due.getTime() < now.getTime()).length, doneThisMonth: Number(done?.n ?? 0), medianFirstAttemptHours30d: median === null ? null : Math.round(median * 10) / 10 },
      registrations: { inPipeline: Number(pipe?.n ?? 0), doneThisMonth: Number(regDone?.n ?? 0), withdrawnThisMonth: Number(regOut?.n ?? 0) },
      assists: await assistStats(monthStartAt),
    };
  }

  /** SPEC §27.6.4: the "Intézzük helyette" tile. */
  async function assistStats(monthStartAt: Date): Promise<NonNullable<AdminServiceStats['assists']>> {
    const now = deps.now();
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const [open] = await deps.db.select({ n: count() }).from(assistRequests).where(inArray(assistRequests.status, [...ASSIST_OPEN_STATUSES]));
    const [done] = await deps.db.select({ n: count() }).from(assistRequests).where(and(eq(assistRequests.status, 'kesz'), gte(assistRequests.closedAt, monthStartAt)));
    const [exp] = await deps.db.select({ n: count() }).from(auditLog).where(and(eq(auditLog.action, 'assist.expired'), gte(auditLog.at, since30)));
    const fin = await deps.db.select({ c: assistRequests.createdAt, d: assistRequests.closedAt }).from(assistRequests).where(and(eq(assistRequests.status, 'kesz'), gte(assistRequests.closedAt, since30)));
    const days = fin.filter((x) => x.d).map((x) => (x.d!.getTime() - x.c.getTime()) / 86_400_000).sort((a, b) => a - b);
    const median = days.length ? (days.length % 2 ? days[(days.length - 1) / 2]! : (days[days.length / 2 - 1]! + days[days.length / 2]!) / 2) : null;
    return { open: Number(open?.n ?? 0), doneThisMonth: Number(done?.n ?? 0), expiredApprovals30d: Number(exp?.n ?? 0), medianDaysToDone30d: median === null ? null : Math.round(median * 10) / 10 };
  }

  // ---------- service team (csapat, SPEC §26.3.4) ----------
  async function teamRow(userId: string): Promise<TeamMemberRow | null> {
    const [x] = await deps.db.select({ u: users, t: teamMembers }).from(teamMembers).innerJoin(users, eq(users.id, teamMembers.userId)).where(eq(teamMembers.userId, userId)).limit(1);
    if (!x) return null;
    const since = new Date(deps.now().getTime() - 30 * 86_400_000);
    const [open] = await deps.db.select({ n: count() }).from(callbackRequests).where(and(eq(callbackRequests.assignedUserId, userId), inArray(callbackRequests.status, ['uj', 'folyamatban'])));
    const [done] = await deps.db.select({ n: count() }).from(callbackRequests).where(and(eq(callbackRequests.closedBy, userId), eq(callbackRequests.status, 'teljesitve'), gte(callbackRequests.closedAt, since)));
    const [checked] = await deps.db.select({ n: count() }).from(businessRegistrations).where(and(eq(businessRegistrations.checkedBy, userId), gte(businessRegistrations.checkedAt, since)));
    return {
      userId,
      email: x.u.email,
      displayName: x.t.displayName,
      firstName: x.t.firstName,
      active: x.t.active && x.u.status === 'active',
      totpEnabled: Boolean(x.u.totpEnabledAt),
      openCallbacks: Number(open?.n ?? 0),
      callbacksDone30d: Number(done?.n ?? 0),
      registrationsChecked30d: Number(checked?.n ?? 0),
      lastLoginAt: x.u.lastLoginAt?.toISOString() ?? null,
      createdAt: x.t.createdAt.toISOString(),
    };
  }

  r.get('/team', async (c) => {
    const rows = await deps.db.select({ id: teamMembers.userId }).from(teamMembers).innerJoin(users, eq(users.id, teamMembers.userId)).where(eq(users.role, 'csapat')).orderBy(asc(teamMembers.displayName));
    const items: TeamMemberRow[] = [];
    for (const r0 of rows) {
      const t = await teamRow(r0.id);
      if (t) items.push(t);
    }
    return c.json({ items });
  });

  r.post('/team', async (c) => {
    const b = await readJson(
      c,
      z.strictObject({
        email: z.string().trim().max(254).transform(normalizeEmail).refine(isPlausibleEmail, { error: 'Ez nem tűnik e-mail-címnek.' }),
        displayName: z.string().trim().min(3).max(80),
        firstName: z.string().trim().min(1).max(40),
      }),
    );
    if (deps.mailer.mode === 'disabled') throw E.notConfigured('Az e-mail-küldés még nincs beállítva, így a meghívó nem menne ki.');
    const [exists] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, b.email)).limit(1);
    if (exists) throw E.conflict('Ezzel az e-mail-címmel már van fiók.');
    const userId = await deps.db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email: b.email, role: 'csapat', displayName: b.displayName, emailVerifiedAt: null }).returning({ id: users.id });
      await tx.insert(teamMembers).values({ userId: u!.id, displayName: b.displayName, firstName: b.firstName });
      await auditC(c, tx, 'team.member_invited', { targetType: 'user', targetId: u!.id, details: { role: 'csapat' } });
      return u!.id;
    });
    const code = await issueCode(deps, deps.db, { email: b.email, purpose: 'staff_invite' });
    await sendCodeEmail(deps, b.email, 'auth_staff_invite_csapat', code);
    return c.json({ ...(await teamRow(userId)), ...demoInvite(code) }, 201);
  });

  r.patch('/team/:userId', async (c) => {
    const userId = param(c, 'userId');
    const b = await readJson(c, z.strictObject({ displayName: z.string().trim().min(3).max(80).optional(), firstName: z.string().trim().min(1).max(40).optional(), active: z.boolean().optional() }));
    const [tm] = await deps.db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
    if (!tm) throw E.notFound();
    await deps.db
      .update(teamMembers)
      .set({ ...(b.displayName ? { displayName: b.displayName } : {}), ...(b.firstName ? { firstName: b.firstName } : {}), ...(b.active !== undefined ? { active: b.active } : {}), updatedAt: deps.now() })
      .where(eq(teamMembers.userId, userId));
    if (b.displayName) await deps.db.update(users).set({ displayName: b.displayName, updatedAt: deps.now() }).where(eq(users.id, userId));
    await auditC(c, deps.db, 'team.member_updated', { targetType: 'user', targetId: userId, details: { fields: Object.keys(b) } });
    if (b.active !== undefined && b.active !== tm.active) {
      await setStaffAccess(c, userId, b.active);
      await auditC(c, deps.db, b.active ? 'team.member_enabled' : 'team.member_disabled', { targetType: 'user', targetId: userId });
      if (!b.active) await releaseCallbacks(userId);
    }
    return c.json(await teamRow(userId));
  });

  /** A deactivated member's open callbacks return to the queue (SPEC §26.3.4). */
  async function releaseCallbacks(userId: string): Promise<void> {
    await deps.db
      .update(callbackRequests)
      .set({ assignedUserId: null, assignedAt: null, callingNowUntil: null, status: sql`case when ${callbackRequests.attempts} > 0 then 'folyamatban' else 'uj' end`, updatedAt: deps.now() })
      .where(and(eq(callbackRequests.assignedUserId, userId), inArray(callbackRequests.status, ['uj', 'folyamatban'])));
  }

  /**
   * "Lejárt tétel" = everything the deadline board counts as overdue: open requests past their due
   * date, approved tax payments not marked paid after the due date, and quarters not filed in time
   * (only quarters due after the client joined – earlier ones were the previous accountant's).
   */
  async function overdueCount(clientIds: string[], today: string): Promise<number> {
    if (!clientIds.length) return 0;
    const [rq] = await deps.db.select({ n: count() }).from(requests).where(and(inArray(requests.clientId, clientIds), eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban']), lt(requests.dueDate, today)));
    const [pay] = await deps.db
      .select({ n: count() })
      .from(taxPaymentItems)
      .innerJoin(taxPeriods, eq(taxPeriods.id, taxPaymentItems.taxPeriodId))
      .where(and(inArray(taxPeriods.clientId, clientIds), isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt), lt(taxPaymentItems.dueDate, today)));
    const [fil] = await deps.db
      .select({ n: count() })
      .from(taxPeriods)
      .innerJoin(clients, eq(clients.id, taxPeriods.clientId))
      .where(and(inArray(taxPeriods.clientId, clientIds), eq(taxPeriods.kind, 'negyedev'), sql`${taxPeriods.filingStatus} <> 'beadva'`, lt(taxPeriods.dueDate, today), sql`${taxPeriods.dueDate} >= (${clients.createdAt} at time zone 'Europe/Budapest')::date`));
    return Number(rq?.n ?? 0) + Number(pay?.n ?? 0) + Number(fil?.n ?? 0);
  }

  r.get('/clients', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(CLIENT_LIFECYCLES).optional(), q: z.string().trim().max(80).optional(), cursor: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }));
    const rows = await deps.db
      .select({ c: clients, email: users.email, userStatus: users.status, accName: accountants.displayName, accId: accountants.id, sub: subscriptions.status, utm: signupAttribution.utmSource, code: referralCodes.code })
      .from(clients)
      .innerJoin(users, eq(users.id, clients.userId))
      .leftJoin(accountants, eq(accountants.id, clients.accountantId))
      .leftJoin(subscriptions, eq(subscriptions.clientId, clients.id))
      .leftJoin(signupAttribution, eq(signupAttribution.userId, clients.userId))
      .leftJoin(referralCodes, eq(referralCodes.id, clients.referralCodeId))
      .where(
        and(
          q.status ? eq(clients.lifecycle, q.status) : sql`true`,
          q.q ? or(ilike(clients.lastName, `%${q.q}%`), ilike(clients.firstName, `%${q.q}%`), ilike(users.email, `%${q.q}%`)) : sql`true`,
          q.cursor ? lt(clients.createdAt, new Date(q.cursor)) : sql`true`,
        ),
      )
      .orderBy(desc(clients.createdAt))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return c.json({
      items: page.map((x) => ({
        id: x.c.id,
        name: clientName(x.c),
        email: x.email,
        lifecycle: x.c.lifecycle,
        accountant: x.accId ? { id: x.accId, name: x.accName } : null,
        subscriptionStatus: x.sub ?? null,
        source: x.utm ?? (x.code ? 'ajanlas' : null),
        referralCode: x.code ?? null,
        createdAt: x.c.createdAt.toISOString(),
        // SPEC §27.6.4 / S9 (panel AdminClientRow)
        disabled: x.userStatus === 'disabled',
        disabledAt: x.userStatus === 'disabled' ? (x.c.disabledAt?.toISOString() ?? null) : null,
        disabledReason: x.userStatus === 'disabled' ? x.c.disabledReason : null,
      })),
      nextCursor: rows.length > q.limit ? page[page.length - 1]!.c.createdAt.toISOString() : null,
    });
  });

  r.patch('/clients/:id', async (c) => {
    const b = await readJson(c, z.object({ accountantId: z.string().uuid().nullable().optional(), lifecycle: z.enum(CLIENT_LIFECYCLES).optional() }));
    const id = param(c, 'id');
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!cl) throw E.notFound();
    if (b.accountantId) {
      const [a] = await deps.db
        .select({ id: accountants.id, totpEnabledAt: users.totpEnabledAt })
        .from(accountants)
        .innerJoin(users, eq(users.id, accountants.userId))
        .where(and(eq(accountants.id, b.accountantId), eq(accountants.active, true)))
        .limit(1);
      if (!a) throw E.validation({ accountantId: 'Nincs ilyen aktív könyvelő.' });
      // Whoever gets a client sees their ID papers and tax data: only with 2FA on (production always).
      if (deps.cfg.staffTotpRequired && !a.totpEnabledAt) throw E.validation({ accountantId: 'Ennek a könyvelőnek még nincs bekapcsolva a kétlépcsős belépése. Amíg nem kapcsolja be, nem kaphat ügyfelet.' });
    }
    await deps.db.update(clients).set({ ...(b.accountantId !== undefined ? { accountantId: b.accountantId } : {}), ...(b.lifecycle ? { lifecycle: b.lifecycle } : {}), updatedAt: deps.now() }).where(eq(clients.id, id));
    if (b.accountantId !== undefined && b.accountantId !== cl.accountantId) {
      await auditC(c, deps.db, 'admin.client_reassigned', { targetType: 'client', targetId: id, clientId: id, details: { from: cl.accountantId, to: b.accountantId } });
      // Nobody is reassigned silently: the client and both accountants hear about it (QA kör 3).
      await reassignmentNotices(deps, cl, cl.accountantId, b.accountantId ?? null);
    }
    if (b.lifecycle) await auditC(c, deps.db, 'admin.client_lifecycle', { targetType: 'client', targetId: id, clientId: id, details: { to: b.lifecycle } });
    // A terminated client is not charged again: the subscription ends at once and the card tokens are revoked.
    if (b.lifecycle === 'megszunt' && cl.lifecycle !== 'megszunt') {
      const now = deps.now();
      const [sub0] = await deps.db.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.clientId, id)).limit(1);
      const paidServiceRan = Boolean(sub0 && ['active', 'past_due', 'suspended'].includes(sub0.status));
      await deps.db
        .update(subscriptions)
        .set({ status: 'canceled', cancelAtPeriodEnd: true, canceledAt: now, nextChargeAt: null, nextRetryAt: null, updatedAt: now })
        .where(and(eq(subscriptions.clientId, id), sql`${subscriptions.status} <> 'canceled'`));
      await deleteCard(deps, id, { userId: auth(c).userId, role: 'admin' }).catch(() => undefined);
      await endRelationship(deps.db, id, now);
      // k7b (LEVEL_LEFEDETTSEG #55): the same notices as a real period end (client e-mail + the accountant's task)
      // (the client's e-mail only when a paid subscription really ran; the accountant's task only when there is a
      // meghatalmazás or a technical user to close)
      await notifyServiceEnded(deps, id, todayBudapest(now), { notifyClient: paidServiceRan });
    }
    return c.json({ ok: true });
  });

  // ---------- subscriptions & payments ----------
  r.get('/subscriptions', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(SUBSCRIPTION_STATUSES).optional() }));
    const today = todayBudapest(deps.now());
    const rows = await deps.db
      .select({ s: subscriptions, c: clients, reg: cardRegistrations })
      .from(subscriptions)
      .innerJoin(clients, eq(clients.id, subscriptions.clientId))
      .leftJoin(cardRegistrations, eq(cardRegistrations.id, subscriptions.cardRegistrationId))
      .where(q.status ? eq(subscriptions.status, q.status) : sql`true`)
      .orderBy(desc(subscriptions.updatedAt))
      .limit(500);
    const items = [];
    for (const x of rows) {
      const [n] = x.reg ? await deps.db.select({ n: count() }).from(paymentTokens).where(and(eq(paymentTokens.cardRegistrationId, x.reg.id), eq(paymentTokens.status, 'aktiv'))) : [{ n: 0 }];
      items.push({
        id: x.s.id,
        client: { id: x.c.id, name: clientName(x.c) },
        status: x.s.status,
        mode: x.s.mode,
        priceHuf: await (await import('../services/dijak.js')).monthlyPriceHuf(deps),
        currentPeriodEnd: x.s.currentPeriodEnd,
        nextChargeAt: x.s.cancelAtPeriodEnd || x.s.status === 'canceled' ? null : (x.s.nextChargeAt?.toISOString() ?? null),
        failedAttempts: x.s.failedAttempts,
        lastFailureCode: x.s.lastFailureCode,
        graceUntil: x.s.graceUntil,
        cancelAtPeriodEnd: x.s.cancelAtPeriodEnd,
        // the panel shows "Újrapróbálom" only when the server would really charge
        retryable: ['active', 'past_due', 'suspended'].includes(x.s.status) && chargeDue(x.s, today),
        card: x.reg ? { mask: x.reg.cardMask, status: x.reg.status, tokensLeft: x.s.cancelAtPeriodEnd || x.s.status === 'canceled' ? 0 : Number(n?.n ?? 0), expiry: x.reg.cardExpiry } : null,
        isTest: x.c.isTest,
      });
    }
    return c.json({ items });
  });

  r.post('/subscriptions/:id/retry', async (c) => {
    const [s] = await deps.db.select().from(subscriptions).where(eq(subscriptions.id, param(c, 'id'))).limit(1);
    if (!s) throw E.notFound();
    if (!['active', 'past_due', 'suspended'].includes(s.status)) throw E.conflict('Ennél az előfizetésnél nincs mit újrapróbálni.');
    if (s.cancelAtPeriodEnd) throw E.conflict('Ez az előfizetés le van mondva, nem terheljük többet.');
    // Only when something is really due: a paid, active subscription must never be charged again by hand.
    if (!chargeDue(s, todayBudapest(deps.now()))) throw E.conflict('Nincs esedékes terhelés: ez az előfizetés ki van fizetve.');
    await auditC(c, deps.db, 'subscription.manual_retry', { targetType: 'subscription', targetId: s.id, clientId: s.clientId });
    const res = await chargeSubscription(deps, s);
    return c.json({ result: res });
  });

  r.post('/subscriptions/:id/cancel', async (c) => {
    const [s] = await deps.db.select().from(subscriptions).where(eq(subscriptions.id, param(c, 'id'))).limit(1);
    if (!s) throw E.notFound();
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, s.clientId)).limit(1);
    await cancelSubscription(deps, s.clientId, cl!.userId, { role: 'admin', userId: auth(c).userId });
    await auditC(c, deps.db, 'subscription.admin_cancel', { targetType: 'subscription', targetId: s.id, clientId: s.clientId });
    return c.json({ ok: true });
  });

  r.post('/subscriptions/:id/card/delete', async (c) => {
    const [s] = await deps.db.select().from(subscriptions).where(eq(subscriptions.id, param(c, 'id'))).limit(1);
    if (!s) throw E.notFound();
    const had = await hasUsableCard(deps.db, s.clientId);
    await deleteCard(deps, s.clientId, { userId: auth(c).userId, role: 'admin' });
    // k7b (LEVEL_LEFEDETTSEG #33): the client is told (only when there was a card to delete)
    if (had) await notifyCardDeletedByAdmin(deps, s.clientId);
    return c.json({ ok: true });
  });

  r.get('/subscriptions/:id/card-status', async (c) => {
    const [s] = await deps.db.select().from(subscriptions).where(eq(subscriptions.id, param(c, 'id'))).limit(1);
    if (!s?.cardRegistrationId) throw E.notFound();
    const [reg] = await deps.db.select().from(cardRegistrations).where(eq(cardRegistrations.id, s.cardRegistrationId)).limit(1);
    if (!reg) throw E.notFound();
    if (reg.mode === 'demo' || !deps.simplepay || !reg.simplepayCardId) return c.json({ mode: reg.mode, local: { status: reg.status, mask: reg.cardMask, expiry: reg.cardExpiry }, remote: null });
    const remote = await deps.simplepay.cardQuery(reg.simplepayCardId).catch(() => null);
    return c.json({ mode: reg.mode, local: { status: reg.status, mask: reg.cardMask, expiry: reg.cardExpiry }, remote });
  });

  r.get('/payments', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(['failed', 'finished', 'all']).default('all'), from: z.string().optional(), to: z.string().optional() }));
    const rows = await deps.db
      .select({ t: simplepayTransactions, c: clients, fee: feeInvoices })
      .from(simplepayTransactions)
      .innerJoin(clients, eq(clients.id, simplepayTransactions.clientId))
      .leftJoin(feeInvoices, eq(feeInvoices.simplepayTransactionId, simplepayTransactions.id))
      .where(
        and(
          q.status === 'finished' ? eq(simplepayTransactions.status, 'FINISHED') : q.status === 'failed' ? sql`${simplepayTransactions.status} in ('NOTAUTHORIZED','CANCELLED','TIMEOUT','FRAUD') or ${simplepayTransactions.errorCodes} is not null` : sql`true`,
          q.from ? gte(simplepayTransactions.createdAt, new Date(q.from)) : sql`true`,
          q.to ? lt(simplepayTransactions.createdAt, new Date(q.to)) : sql`true`,
        ),
      )
      .orderBy(desc(simplepayTransactions.createdAt))
      .limit(500);
    return c.json({
      items: rows.map((x) => ({
        id: x.t.id,
        orderRef: x.t.orderRef,
        client: { id: x.c.id, name: clientName(x.c) },
        kind: x.t.kind,
        amountHuf: x.t.amountHuf,
        status: x.t.status,
        createdAt: x.t.createdAt.toISOString(),
        finishedAt: x.t.finishedAt?.toISOString() ?? null,
        errorCodes: x.t.errorCodes ?? [],
        mode: x.t.mode,
        feeInvoice: x.fee ? { number: x.fee.number, status: x.fee.status, error: x.fee.error } : null,
      })),
    });
  });

  // ---------- accountants ----------
  r.get('/accountants', async (c) => {
    const today = todayBudapest(deps.now());
    const rows = await deps.db.select({ a: accountants, email: users.email }).from(accountants).innerJoin(users, eq(users.id, accountants.userId)).orderBy(asc(accountants.displayName));
    const items = [];
    for (const { a, email } of rows) {
      const ids = (await deps.db.select({ id: clients.id }).from(clients).where(and(eq(clients.accountantId, a.id), sql`${clients.lifecycle} <> 'megszunt'`))).map((x) => x.id);
      const [open] = ids.length ? await deps.db.select({ n: count() }).from(requests).where(and(inArray(requests.clientId, ids), inArray(requests.status, ['nyitott', 'folyamatban']))) : [{ n: 0 }];
      const overN = await overdueCount(ids, today);
      const [waiting] = ids.length ? await deps.db.select({ n: count() }).from(documents).where(and(inArray(documents.clientId, ids), eq(documents.status, 'feltoltve'), isNull(documents.deletedAt))) : [{ n: 0 }];
      items.push({
        id: a.id,
        displayName: a.displayName,
        firstName: a.firstName,
        title: a.title,
        email,
        registrationNumber: a.registrationNumber,
        clients: ids.length,
        capacity: a.capacity,
        openRequests: Number(open?.n ?? 0),
        overdueItems: overN,
        waitingDocuments: Number(waiting?.n ?? 0),
        active: a.active,
        appointmentsEnabled: a.appointmentsEnabled,
        nameForms: { with: a.nameWith, from: a.nameFrom, onto: a.nameOnto, acc: a.nameAcc },
      });
    }
    return c.json({ items });
  });

  const nameForms = z.object({ with: z.string().trim().min(1).max(40), from: z.string().trim().min(1).max(40), onto: z.string().trim().min(1).max(40), acc: z.string().trim().min(1).max(40) });

  r.post('/accountants', async (c) => {
    const b = await readJson(
      c,
      z.object({
        email: z.string().trim().max(254).transform(normalizeEmail).refine(isPlausibleEmail, { error: 'Ez nem tűnik e-mail-címnek.' }),
        displayName: z.string().trim().min(3).max(80),
        firstName: z.string().trim().min(1).max(40),
        title: z.string().trim().max(80).default('Mérlegképes könyvelő'),
        registrationNumber: z.string().trim().max(40).optional(),
        adoazonositoJel: z.string().trim().refine(isValidAdoazonositoJel, { error: 'Hibás adóazonosító jel.' }).optional(),
        nameForms: nameForms.optional(),
        capacity: z.number().int().min(1).max(1000).optional(),
      }),
    );
    if (deps.mailer.mode === 'disabled') throw E.notConfigured('Az e-mail-küldés még nincs beállítva, így a meghívó nem menne ki.');
    const [exists] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, b.email)).limit(1);
    if (exists) throw E.conflict('Ezzel az e-mail-címmel már van fiók.');
    const accId = await deps.db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email: b.email, role: 'accountant', displayName: b.displayName, emailVerifiedAt: null }).returning({ id: users.id });
      const [a] = await tx
        .insert(accountants)
        .values({
          userId: u!.id,
          displayName: b.displayName,
          firstName: b.firstName,
          title: b.title,
          registrationNumber: b.registrationNumber ?? null,
          adoazonositoJelEnc: b.adoazonositoJel ? deps.data.enc(b.adoazonositoJel, 'accountants.adoazonosito_jel') : null,
          nameWith: b.nameForms?.with ?? null,
          nameFrom: b.nameForms?.from ?? null,
          nameOnto: b.nameForms?.onto ?? null,
          nameAcc: b.nameForms?.acc ?? null,
          capacity: b.capacity ?? 150,
        })
        .returning({ id: accountants.id });
      await auditC(c, tx, 'user.created', { targetType: 'accountant', targetId: a!.id, details: { role: 'accountant' } });
      return a!.id;
    });
    const code = await issueCode(deps, deps.db, { email: b.email, purpose: 'staff_invite' });
    await sendCodeEmail(deps, b.email, 'auth_staff_invite', code);
    return c.json({ id: accId, ...demoInvite(code) }, 201);
  });

  r.patch('/accountants/:id', async (c) => {
    const b = await readJson(
      c,
      z.object({
        displayName: z.string().trim().min(3).max(80).optional(),
        firstName: z.string().trim().min(1).max(40).optional(),
        title: z.string().trim().max(80).optional(),
        registrationNumber: z.string().trim().max(40).optional(),
        adoazonositoJel: z.string().trim().refine(isValidAdoazonositoJel).optional(),
        nameForms: nameForms.optional(),
        capacity: z.number().int().min(1).max(1000).optional(),
        active: z.boolean().optional(),
        appointmentsEnabled: z.boolean().optional(),
      }),
    );
    const id = param(c, 'id');
    const [before] = await deps.db.select().from(accountants).where(eq(accountants.id, id)).limit(1);
    if (!before) throw E.notFound();
    if (b.active === false && before.userId === auth(c).userId) throw E.conflict('A saját fiókodat nem tilthatod le.');
    const [a] = await deps.db
      .update(accountants)
      .set({
        ...(b.displayName ? { displayName: b.displayName } : {}),
        ...(b.firstName ? { firstName: b.firstName } : {}),
        ...(b.title ? { title: b.title } : {}),
        ...(b.registrationNumber !== undefined ? { registrationNumber: b.registrationNumber } : {}),
        ...(b.adoazonositoJel ? { adoazonositoJelEnc: deps.data.enc(b.adoazonositoJel, 'accountants.adoazonosito_jel') } : {}),
        ...(b.nameForms ? { nameWith: b.nameForms.with, nameFrom: b.nameForms.from, nameOnto: b.nameForms.onto, nameAcc: b.nameForms.acc } : {}),
        ...(b.capacity ? { capacity: b.capacity } : {}),
        ...(b.active !== undefined ? { active: b.active } : {}),
        ...(b.appointmentsEnabled !== undefined ? { appointmentsEnabled: b.appointmentsEnabled } : {}),
        updatedAt: deps.now(),
      })
      .where(eq(accountants.id, id))
      .returning();
    if (!a) throw E.notFound();
    await auditC(c, deps.db, 'admin.accountant_updated', { targetType: 'accountant', targetId: id, details: { fields: Object.keys(b) } });
    // Offboarding: a deactivated accountant loses access at once (login, refresh, every session, files).
    if (b.active !== undefined && b.active !== before.active) await setStaffAccess(c, a.userId, b.active);
    return c.json({ ok: true });
  });

  async function setStaffAccess(c: C, userId: string, enabled: boolean) {
    await deps.db.transaction(async (tx) => {
      const [u] = await tx.select({ status: users.status, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
      if (!u || u.role === 'client') throw E.notFound();
      if (enabled) {
        if (u.status === 'disabled') await tx.update(users).set({ status: 'active', updatedAt: deps.now() }).where(eq(users.id, userId));
      } else {
        await tx.update(users).set({ status: 'disabled', updatedAt: deps.now() }).where(eq(users.id, userId));
        await revokeAllSessions(deps, tx, userId);
      }
      await auditC(c, tx, enabled ? 'admin.user_enabled' : 'admin.user_disabled', { targetType: 'user', targetId: userId, details: { role: u.role } });
    });
    deps.sessionCache.clear();
  }

  /**
   * SPEC §27.9.1 / round-2 security finding 9: block a CLIENT account (abuse) – users.status 'disabled' and every
   * session revoked; re-enable undoes it. A reason is required (kept in the audit as its length only, never the text).
   */
  async function setClientAccess(c: C, clientId: string, enabled: boolean, reason: string) {
    const [cl] = await deps.db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!cl) throw E.notFound();
    await deps.db.transaction(async (tx) => {
      const [u] = await tx.select({ status: users.status }).from(users).where(eq(users.id, cl.userId)).limit(1);
      if (!u) throw E.notFound();
      if (u.status === 'pending_deletion' || u.status === 'deleted') throw E.conflict('Ez a fiók törlés alatt van.');
      if (enabled) {
        if (u.status === 'disabled') await tx.update(users).set({ status: 'active', updatedAt: deps.now() }).where(eq(users.id, cl.userId));
        await tx.update(clients).set({ disabledAt: null, disabledReason: null, updatedAt: deps.now() }).where(eq(clients.id, clientId));
      } else {
        await tx.update(users).set({ status: 'disabled', updatedAt: deps.now() }).where(eq(users.id, cl.userId));
        await tx.update(clients).set({ disabledAt: deps.now(), disabledReason: reason.slice(0, 500), updatedAt: deps.now() }).where(eq(clients.id, clientId));
        await revokeAllSessions(deps, tx, cl.userId);
      }
      await auditC(c, tx, enabled ? 'client.enabled' : 'client.disabled', { targetType: 'client', targetId: clientId, clientId, details: { reasonLength: reason.length } });
    });
    deps.sessionCache.clear();
  }

  r.post('/clients/:id/disable', async (c) => {
    const b = await readJson(c, z.object({ reason: z.string().trim().min(3, { error: 'Írd le röviden, miért.' }).max(500) }));
    await setClientAccess(c, param(c, 'id'), false, b.reason);
    return c.body(null, 204);
  });

  r.post('/clients/:id/enable', async (c) => {
    const b = await readJson(c, z.object({ reason: z.string().trim().min(3, { error: 'Írd le röviden, miért.' }).max(500) }));
    await setClientAccess(c, param(c, 'id'), true, b.reason);
    return c.body(null, 204);
  });

  /** Any staff account (accountant or admin): disable / re-enable, revoking every session. */
  r.post('/users/:id/disable', async (c) => {
    const id = param(c, 'id');
    if (id === auth(c).userId) throw E.conflict('A saját fiókodat nem tilthatod le.');
    await setStaffAccess(c, id, false);
    await deps.db.update(accountants).set({ active: false, updatedAt: deps.now() }).where(eq(accountants.userId, id));
    await deps.db.update(teamMembers).set({ active: false, updatedAt: deps.now() }).where(eq(teamMembers.userId, id));
    await releaseCallbacks(id);
    return c.json({ ok: true });
  });

  r.post('/users/:id/enable', async (c) => {
    const id = param(c, 'id');
    await setStaffAccess(c, id, true);
    await deps.db.update(accountants).set({ active: true, updatedAt: deps.now() }).where(eq(accountants.userId, id));
    await deps.db.update(teamMembers).set({ active: true, updatedAt: deps.now() }).where(eq(teamMembers.userId, id));
    return c.json({ ok: true });
  });

  // ---------- referral & attribution ----------
  r.get('/referral-codes', async (c) => {
    const rows = await deps.db.select({ r: referralCodes, oFirst: clients.firstName, oLast: clients.lastName }).from(referralCodes).leftJoin(clients, eq(clients.id, referralCodes.ownerClientId)).orderBy(desc(referralCodes.createdAt));
    const items = [];
    for (const x of rows) {
      const signed = await deps.db.select({ id: clients.id }).from(clients).where(eq(clients.referralCodeId, x.r.id));
      const [paying] = signed.length ? await deps.db.select({ n: count() }).from(subscriptions).where(and(inArray(subscriptions.clientId, signed.map((s) => s.id)), sql`${subscriptions.status} <> 'incomplete'`)) : [{ n: 0 }];
      items.push({ id: x.r.id, code: x.r.code, ownerClient: x.r.ownerClientId ? { id: x.r.ownerClientId, name: `${x.oLast ?? ''} ${x.oFirst ?? ''}`.trim() } : null, campaign: x.r.campaign, note: x.r.note, active: x.r.active, signups: signed.length, paying: Number(paying?.n ?? 0), createdAt: x.r.createdAt.toISOString() });
    }
    return c.json({ items });
  });

  r.post('/referral-codes', async (c) => {
    const b = await readJson(c, z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,12}$/, { error: '6–12 nagybetű vagy szám.' }), campaign: z.string().trim().max(80).optional(), note: z.string().trim().max(200).optional() }));
    const [exists] = await deps.db.select({ id: referralCodes.id }).from(referralCodes).where(eq(referralCodes.code, b.code)).limit(1);
    if (exists) throw E.conflict('Ez a kód már létezik.');
    const [row] = await deps.db.insert(referralCodes).values({ code: b.code, campaign: b.campaign ?? null, note: b.note ?? null, createdBy: auth(c).userId }).returning();
    await auditC(c, deps.db, 'admin.referral_created', { targetType: 'referral_code', targetId: row!.id });
    return c.json({ id: row!.id, code: row!.code }, 201);
  });

  r.patch('/referral-codes/:id', async (c) => {
    const b = await readJson(c, z.object({ campaign: z.string().trim().max(80).optional(), note: z.string().trim().max(200).optional(), active: z.boolean().optional() }));
    const [row] = await deps.db.update(referralCodes).set(b).where(eq(referralCodes.id, param(c, 'id'))).returning();
    if (!row) throw E.notFound();
    return c.json({ ok: true });
  });

  r.get('/attribution', async (c) => {
    const q = parseQuery(c, z.object({ from: z.string().optional(), to: z.string().optional() }));
    const rows = await deps.db
      .select({ a: signupAttribution, code: referralCodes.code, clientId: clients.id })
      .from(signupAttribution)
      .leftJoin(referralCodes, eq(referralCodes.id, signupAttribution.referralCodeId))
      .leftJoin(clients, eq(clients.userId, signupAttribution.userId))
      .where(and(q.from ? gte(signupAttribution.firstSeenAt, new Date(q.from)) : sql`true`, q.to ? lt(signupAttribution.firstSeenAt, new Date(q.to)) : sql`true`));
    const paying = new Set((await deps.db.select({ c: subscriptions.clientId }).from(subscriptions).where(sql`${subscriptions.status} <> 'incomplete'`)).map((x) => x.c));
    const map = new Map<string, { source: string | null; medium: string | null; campaign: string | null; code: string | null; signups: number; paying: number }>();
    for (const x of rows) {
      const key = [x.a.utmSource, x.a.utmMedium, x.a.utmCampaign, x.code].join('|');
      const e = map.get(key) ?? { source: x.a.utmSource, medium: x.a.utmMedium, campaign: x.a.utmCampaign, code: x.code ?? null, signups: 0, paying: 0 };
      e.signups++;
      if (x.clientId && paying.has(x.clientId)) e.paying++;
      map.set(key, e);
    }
    return c.json({ rows: [...map.values()].sort((a, b) => b.signups - a.signups) });
  });

  // ---------- content & FAQ ----------
  r.get('/content-texts', async (c) => {
    const rows = await deps.db.select().from(contentTexts);
    const keys = new Set([...Object.keys(DEFAULT_TEXTS), ...rows.map((x) => x.key)]);
    return c.json({
      items: [...keys].sort().map((key) => {
        const row = rows.find((x) => x.key === key);
        const def = DEFAULT_TEXTS[key] ?? '';
        return {
          key,
          group: CONTENT_GROUPS.find(([p]) => key.startsWith(p))?.[1] ?? 'Egyéb',
          body: row?.body ?? def,
          defaultBody: def,
          placeholders: [...new Set([...placeholdersOf(def || (row?.body ?? '')), ...groupPlaceholders(key)])],
          updatedAt: row?.updatedAt.toISOString() ?? null,
          updatedBy: row?.updatedBy ?? null,
          version: row?.version ?? 0,
          locked: LOCKED_CONTENT_KEY.test(key),
          // SPEC §26.2.9: booking texts stay for old rows but are never sent (the panel lists them last, collapsed).
          legacy: LEGACY_CONTENT_KEY.test(key),
        };
      }),
    });
  });

  r.put('/content-texts/:key', async (c) => {
    const key = c.req.param('key');
    if (!/^[a-z0-9_.]{3,80}$/.test(key) || !(await deps.content.exists(key))) throw E.notFound();
    // Sign-in mails carry codes: an admin who could reword them could also make a code survive any
    // masking (QA kör 3). They stay as shipped.
    if (LOCKED_CONTENT_KEY.test(key)) throw E.forbidden('Ezt a szöveget biztonsági okból nem lehet szerkeszteni (belépési kódot tartalmazó levél).');
    const b = await readJson(c, z.object({ body: z.string().max(4000) }));
    const allowed = new Set([...placeholdersOf(DEFAULT_TEXTS[key] ?? ''), ...groupPlaceholders(key)]);
    const used = placeholdersOf(b.body);
    const unknown = used.filter((p) => !allowed.has(p));
    if (DEFAULT_TEXTS[key] !== undefined && unknown.length) throw E.validation({ body: `Ismeretlen helyőrző: ${unknown.map((u) => `{${u}}`).join(', ')}` });
    const [row] = await deps.db
      .insert(contentTexts)
      .values({ key, body: b.body, placeholders: used, updatedBy: auth(c).userId })
      .onConflictDoUpdate({ target: contentTexts.key, set: { body: b.body, placeholders: used, updatedBy: auth(c).userId, updatedAt: deps.now(), version: sql`${contentTexts.version} + 1` } })
      .returning();
    await deps.content.reload();
    await auditC(c, deps.db, 'content.updated', { targetType: 'content_text', targetId: key, details: { version: row!.version } });
    return c.json({ key, body: row!.body, version: row!.version });
  });

  r.get('/faq', async (c) => {
    const rows = await deps.db.select().from(faqItems).orderBy(asc(faqItems.sort));
    return c.json({ items: rows.map((f) => ({ id: f.id, question: f.question, answer: f.answer, sort: f.sort, published: f.published })) });
  });
  const faq = z.object({ question: z.string().trim().min(3).max(300), answer: z.string().trim().min(1).max(4000), sort: z.number().int().min(0).max(1000).default(0), published: z.boolean().default(true) });
  r.post('/faq', async (c) => {
    const b = await readJson(c, faq);
    const [row] = await deps.db.insert(faqItems).values(b).returning();
    await auditC(c, deps.db, 'content.updated', { targetType: 'faq', targetId: row!.id });
    return c.json({ id: row!.id }, 201);
  });
  r.patch('/faq/:id', async (c) => {
    const b = await readJson(c, faq.partial());
    const [row] = await deps.db.update(faqItems).set({ ...b, updatedAt: deps.now() }).where(eq(faqItems.id, param(c, 'id'))).returning();
    if (!row) throw E.notFound();
    await auditC(c, deps.db, 'content.updated', { targetType: 'faq', targetId: row.id });
    return c.json({ ok: true });
  });
  r.delete('/faq/:id', async (c) => {
    const res = await deps.db.delete(faqItems).where(eq(faqItems.id, param(c, 'id'))).returning({ id: faqItems.id });
    if (!res.length) throw E.notFound();
    await auditC(c, deps.db, 'content.updated', { targetType: 'faq', targetId: res[0]!.id, details: { deleted: true } });
    return c.body(null, 204);
  });

  // ---------- audit, demo outbox, system ----------
  r.get('/audit', async (c) => {
    const q = parseQuery(c, z.object({ actor: z.string().uuid().optional(), action: z.string().max(60).optional(), clientId: z.string().uuid().optional(), from: z.string().optional(), to: z.string().optional(), cursor: z.string().regex(/^\d+$/).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }));
    const rows = await deps.db
      .select({ a: auditLog, actorName: users.displayName, cFirst: clients.firstName, cLast: clients.lastName })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .leftJoin(clients, eq(clients.id, auditLog.clientId))
      .where(
        and(
          q.actor ? eq(auditLog.actorUserId, q.actor) : sql`true`,
          q.action ? ilike(auditLog.action, `${q.action}%`) : sql`true`,
          q.clientId ? eq(auditLog.clientId, q.clientId) : sql`true`,
          q.from ? gte(auditLog.at, new Date(q.from)) : sql`true`,
          q.to ? lt(auditLog.at, new Date(q.to)) : sql`true`,
          q.cursor ? lt(auditLog.id, Number(q.cursor)) : sql`true`,
        ),
      )
      .orderBy(desc(auditLog.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    await auditC(c, deps.db, 'admin.audit_viewed', { details: { filtered: Boolean(q.clientId || q.actor || q.action) } });
    return c.json({
      items: page.map((x) => ({
        id: x.a.id,
        at: x.a.at.toISOString(),
        actor: { id: x.a.actorUserId, name: x.a.actorRole === 'system' ? 'Rendszer' : (x.actorName ?? ''), role: x.a.actorRole },
        action: x.a.action,
        targetType: x.a.targetType,
        targetId: x.a.targetId,
        client: x.a.clientId ? { id: x.a.clientId, name: `${x.cLast ?? ''} ${x.cFirst ?? ''}`.trim() } : null,
        details: x.a.details,
      })),
      nextCursor: rows.length > q.limit ? String(page[page.length - 1]!.a.id) : null,
    });
  });

  r.get('/demo-outbox', async (c) => {
    if (deps.mailer.mode !== 'demo') throw E.notFound();
    const rows = await deps.db.select().from(demoOutbox).orderBy(desc(demoOutbox.createdAt)).limit(100);
    // Password-reset codes sent to other staff accounts (accountants, other admins) are masked: reading them
    // here would let an admin take over that account. The viewer's own mails and client mails stay readable.
    const me = auth(c);
    const staff = await deps.db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.role, ['accountant', 'admin', 'csapat']));
    const hashOf = (email: string) => hmacHex(deps.cfg.auditIpSalt, `mail:${email}`).slice(0, 24);
    const masked = new Set(staff.filter((u) => u.id !== me.userId).map((u) => hashOf(u.email)));
    // Masked by the mail's TEMPLATE (stored by the mailer), never by its wording: an admin can edit the
    // wording. Every sign-in mail (code, password reset, staff invite) of another staff member is hidden
    // completely; a row from before the template was stored counts as such a mail too.
    const SIGN_IN = new Set(['auth_email_code', 'auth_password_reset_code', 'auth_staff_invite', 'auth_staff_invite_csapat']);
    return c.json({
      items: rows.map((x) => {
        const hide = masked.has(x.toHash) && (x.template === null || SIGN_IN.has(x.template));
        return {
          id: x.id,
          toDisplay: x.toDisplay,
          subject: hide ? 'Belépési levél egy munkatársnak (rejtve)' : x.subject,
          bodyText: hide ? 'Egy másik munkatárs belépési kódja vagy meghívója. Biztonsági okból itt nem látszik.' : x.bodyText,
          createdAt: x.createdAt.toISOString(),
        };
      }),
    });
  });

  r.get('/system', async (c) => {
    const state = await deps.db.select().from(systemState);
    const get = (k: string) => state.find((s) => s.key === k);
    const hb = get('worker.heartbeat');
    const backup = get('backup.last');
    const [last] = await deps.db.select({ at: sql<string | null>`max(${navSyncRuns.finishedAt})` }).from(navSyncRuns);
    const since = addDays(todayBudapest(deps.now()), -1);
    const [ok] = await deps.db.select({ n: count() }).from(navSyncRuns).where(and(eq(navSyncRuns.status, 'ok'), gte(navSyncRuns.startedAt, new Date(`${since}T00:00:00Z`))));
    const [bad] = await deps.db.select({ n: count() }).from(navSyncRuns).where(and(eq(navSyncRuns.status, 'hiba'), gte(navSyncRuns.startedAt, new Date(`${since}T00:00:00Z`))));
    const [feeErr] = await deps.db.select({ n: count() }).from(feeInvoices).where(eq(feeInvoices.status, 'hiba'));
    let db: 'ok' | 'hiba' = 'ok';
    try {
      await deps.db.execute(sql`select 1`);
    } catch {
      db = 'hiba';
    }
    const backupAt = backup ? new Date(String((backup.value as { at?: string }).at ?? backup.updatedAt.toISOString())) : null;
    return c.json({
      appEnv: deps.cfg.appEnv,
      version: deps.cfg.version,
      modes: integrationModes(deps.cfg),
      googleSignIn: deps.cfg.google.clientIds.length > 0,
      appleSignIn: Boolean(deps.cfg.appleBundleId),
      staffTotpRequired: deps.cfg.staffTotpRequired,
      workerHeartbeatAt: hb ? hb.updatedAt.toISOString() : null,
      // SPEC §27.11 S6: the free share of the file disk, independent of backup.sh (null when it cannot be read).
      filesFreeDiskPct: await freeDiskPct(deps.cfg.filesDir).then((x) => (x === null ? null : Math.round(x * 10) / 10)),
      jobs: Object.fromEntries(state.filter((s) => s.key.startsWith('job.')).map((s) => [s.key.slice(4), s.value])),
      lastNavSync: last?.at ? { at: new Date(last.at).toISOString(), ok: Number(ok?.n ?? 0), failed: Number(bad?.n ?? 0) } : null,
      feeInvoiceErrors: Number(feeErr?.n ?? 0),
      // Who got which client lately, and new staff accounts: an admin's access changes are visible to all admins.
      recentStaffChanges: (
        await deps.db
          .select({ at: auditLog.at, action: auditLog.action, actorName: users.displayName, clientId: auditLog.clientId, details: auditLog.details })
          .from(auditLog)
          .leftJoin(users, eq(users.id, auditLog.actorUserId))
          .where(sql`${auditLog.action} in ('admin.client_reassigned', 'user.created') and ${auditLog.at} > ${new Date(deps.now().getTime() - 30 * 86_400_000)}`)
          .orderBy(desc(auditLog.id))
          .limit(20)
      ).map((x) => ({ at: x.at.toISOString(), action: x.action, by: x.actorName ?? '', clientId: x.clientId, details: x.details })),
      // SimplePay IPNs that came after a final status (refund, reversal …): check them in the SimplePay admin.
      paymentAlerts: (
        await deps.db
          .select({ orderRef: simplepayTransactions.orderRef, status: simplepayTransactions.status, afterFinalStatus: simplepayTransactions.afterFinalStatus, at: simplepayTransactions.afterFinalAt, amountHuf: simplepayTransactions.amountHuf })
          .from(simplepayTransactions)
          .where(sql`${simplepayTransactions.afterFinalStatus} is not null`)
          .orderBy(desc(simplepayTransactions.afterFinalAt))
          .limit(20)
      ).map((x) => ({ orderRef: x.orderRef, status: x.status, laterStatus: x.afterFinalStatus, at: x.at?.toISOString() ?? null, amountHuf: x.amountHuf })),
      backupAgeHours: backupAt ? Math.round((deps.now().getTime() - backupAt.getTime()) / 3600_000) : null,
      // backup.sh: size of backups/regi and free disk space; alert → copy the old dumps offsite (deploy/mentes-kulso.sh)
      backupDisk: (get('backup.disk')?.value as { regiMb?: number; freePct?: number; alert?: boolean } | undefined) ?? null,
      db,
    });
  });

  return r;
}
