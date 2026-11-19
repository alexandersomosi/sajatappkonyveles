// Service team ('csapat') and the staff side of SPEC §26: who is acting, staff references, the team's client card,
// and the permission rules of §26.4 (enforced here, tested in test/tulaj1118-csapat.test.ts).
import { and, desc, eq, gte, inArray, isNull as isNullCol, or, sql } from 'drizzle-orm';
import type { StaffRef, TeamClientCard } from '../_shared/api.js';
import { ASSIST_OPEN_STATUSES, CALLBACK_OPEN_STATUSES, CALLBACK_RULES, REGISTRATION_OPEN_STATUSES, type Milestone, type StaffRole } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, assistRequests, businessRegistrations, callbackRequests, clients, notifications as notificationsTable, teamMembers, users } from '../db/schema.js';
import { E } from '../lib/errors.js';
import { maskHuPhone } from '../_shared/bekotes.js';
import { notify, type NotifyInput } from '../notify/notify.js';
import { clientName, type ClientRow } from './people.js';

export interface StaffActor {
  userId: string;
  role: StaffRole;
  /** Set when the actor is an accountant (or an admin who also has an accountant row). */
  accountantId: string | null;
  name: string;
  firstName: string;
}

function lastToken(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

/**
 * The staff member behind a request. A deactivated team member or accountant is treated as non-existent (404),
 * like §25 does for accountants.
 */
export async function staffActor(db: DbOrTx, userId: string, role: string): Promise<StaffActor> {
  if (role !== 'csapat' && role !== 'admin' && role !== 'accountant') throw E.notFound();
  const [u] = await db.select({ displayName: users.displayName, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw E.notFound();
  const [acc] = await db.select().from(accountants).where(eq(accountants.userId, userId)).limit(1);
  if (role === 'csapat') {
    const [tm] = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
    if (!tm || !tm.active) throw E.notFound();
    return { userId, role, accountantId: null, name: tm.displayName, firstName: tm.firstName };
  }
  if (role === 'accountant') {
    if (!acc || !acc.active) throw E.notFound();
    return { userId, role, accountantId: acc.id, name: acc.displayName, firstName: acc.firstName };
  }
  const [tm] = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
  const name = tm?.displayName ?? acc?.displayName ?? u.displayName ?? 'Tulajdonos';
  return { userId, role: 'admin', accountantId: acc?.active ? acc.id : null, name, firstName: tm?.firstName ?? acc?.firstName ?? lastToken(name) };
}

/** Staff reference as other staff see it (name + first name + role). */
export async function staffRef(db: DbOrTx, userId: string | null | undefined): Promise<StaffRef | null> {
  if (!userId) return null;
  const refs = await staffRefs(db, [userId]);
  return refs.get(userId) ?? null;
}

export async function staffRefs(db: DbOrTx, ids: (string | null | undefined)[]): Promise<Map<string, StaffRef>> {
  const uniq = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, StaffRef>();
  if (!uniq.length) return out;
  const us = await db.select({ id: users.id, role: users.role, displayName: users.displayName }).from(users).where(inArray(users.id, uniq));
  const tms = await db.select().from(teamMembers).where(inArray(teamMembers.userId, uniq));
  const accs = await db.select().from(accountants).where(inArray(accountants.userId, uniq));
  for (const u of us) {
    if (u.role === 'client') continue;
    const tm = tms.find((t) => t.userId === u.id);
    const acc = accs.find((a) => a.userId === u.id);
    const name = tm?.displayName ?? acc?.displayName ?? u.displayName ?? '';
    out.set(u.id, { userId: u.id, name, firstName: tm?.firstName ?? acc?.firstName ?? lastToken(name), role: u.role as StaffRole });
  }
  return out;
}

/** Active team members and admins: the people who handle the queue (notifications go to them). */
export async function queueOwners(db: DbOrTx): Promise<{ userId: string; role: 'csapat' | 'admin' }[]> {
  const rows = await db
    .select({ id: users.id, role: users.role, active: teamMembers.active })
    .from(users)
    .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
    .where(and(inArray(users.role, ['csapat', 'admin']), eq(users.status, 'active')));
  return rows.filter((r) => r.role === 'admin' || r.active === true).map((r) => ({ userId: r.id, role: r.role as 'csapat' | 'admin' }));
}

export async function notifyQueueOwners(deps: Deps, db: DbOrTx, n: Omit<NotifyInput, 'userId'>, o: { except?: string | null } = {}): Promise<void> {
  for (const u of await queueOwners(db)) {
    if (u.userId === o.except) continue;
    await notify(deps, db, { ...n, userId: u.userId });
  }
}

/** The client's accountant (user id), if any. */
export async function accountantUserOf(db: DbOrTx, cl: Pick<ClientRow, 'accountantId'>): Promise<{ accountantId: string; userId: string; name: string; firstName: string } | null> {
  if (!cl.accountantId) return null;
  const [a] = await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1);
  return a ? { accountantId: a.id, userId: a.userId, name: a.displayName, firstName: a.firstName } : null;
}

async function recentTeamContact(db: DbOrTx, clientId: string, since: Date): Promise<boolean> {
  const [cb] = await db
    .select({ id: callbackRequests.id })
    .from(callbackRequests)
    .where(and(eq(callbackRequests.clientId, clientId), or(gte(callbackRequests.createdAt, since), inArray(callbackRequests.status, [...CALLBACK_OPEN_STATUSES]))))
    .limit(1);
  if (cb) return true;
  const [reg] = await db
    .select({ id: businessRegistrations.id })
    .from(businessRegistrations)
    .where(and(eq(businessRegistrations.clientId, clientId), or(gte(businessRegistrations.updatedAt, since), inArray(businessRegistrations.status, [...REGISTRATION_OPEN_STATUSES]))))
    .limit(1);
  if (reg) return true;
  // SPEC §27.6.4: an "Intézzük helyette" request – open, or closed in the last 90 days
  const [as] = await db
    .select({ id: assistRequests.id })
    .from(assistRequests)
    .where(and(eq(assistRequests.clientId, clientId), or(gte(assistRequests.updatedAt, since), inArray(assistRequests.status, [...ASSIST_OPEN_STATUSES]))))
    .limit(1);
  return Boolean(as);
}

/**
 * SPEC §26.4 "Client card": csapat sees clients in onboarding, or with a callback / registration in the last 90 days;
 * admin sees every client; an accountant only his own. Anything else answers 404 (no enumeration).
 */
export async function clientForStaff(deps: Deps, db: DbOrTx, actor: StaffActor, clientId: string): Promise<ClientRow> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) throw E.notFound();
  if (actor.role === 'admin') return cl;
  if (actor.role === 'accountant') {
    if (cl.accountantId !== actor.accountantId) throw E.notFound();
    return cl;
  }
  if (cl.lifecycle === 'bekotes_alatt') return cl;
  const since = new Date(deps.now().getTime() - CALLBACK_RULES.csapatClientCardDays * 86_400_000);
  if (await recentTeamContact(db, cl.id, since)) return cl;
  throw E.notFound();
}

/** Team threads: only clients still in onboarding (SPEC §26.4 "Messages"). */
export async function clientForTeamMessages(db: DbOrTx, clientId: string): Promise<ClientRow> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl || cl.lifecycle !== 'bekotes_alatt') throw E.notFound();
  return cl;
}

export async function teamClientCard(deps: Deps, db: DbOrTx, cl: ClientRow, milestone: Milestone | null): Promise<TeamClientCard> {
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1);
  const acc = await accountantUserOf(db, cl);
  const [reg] = await db
    .select({ id: businessRegistrations.id, status: businessRegistrations.status, withdrawReason: businessRegistrations.withdrawReason, withdrawNote: businessRegistrations.withdrawNote })
    .from(businessRegistrations)
    .where(eq(businessRegistrations.clientId, cl.id))
    .orderBy(desc(businessRegistrations.createdAt))
    .limit(1);
  const [cb] = await db
    .select({ id: callbackRequests.id })
    .from(callbackRequests)
    .where(and(eq(callbackRequests.clientId, cl.id), inArray(callbackRequests.status, [...CALLBACK_OPEN_STATUSES])))
    .limit(1);
  let phoneMasked: string | null = null;
  if (cl.phoneEnc) {
    try {
      const p = deps.data.dec(cl.phoneEnc, 'clients.phone');
      phoneMasked = p.startsWith('+36') ? maskHuPhone(p) : `${p.slice(0, 3)} *** **${p.slice(-2)}`;
    } catch {
      phoneMasked = null;
    }
  }
  return {
    id: cl.id,
    name: clientName(cl),
    email: u?.email ?? '',
    phoneMasked,
    lifecycle: cl.lifecycle,
    businessStatus: cl.businessStatus ?? null,
    milestone,
    accountant: acc ? { id: acc.accountantId, userId: acc.userId, name: acc.name } : null,
    // 11-19 javító kör 2: an empty questionnaire left by an undo is no registration at all; a branch change is not "Elállt".
    registration:
      reg && !(reg.status === 'elallt' && reg.withdrawNote === 'visszavonta')
        ? { id: reg.id, status: reg.status, pathChanged: reg.status === 'elallt' && (reg.withdrawNote === 'utvaltas' || reg.withdrawReason === 'mar_van_vallalkozasa') }
        : null,
    openCallbackId: cb?.id ?? null,
    canMessage: cl.lifecycle === 'bekotes_alatt',
  };
}

/** Unread client messages in onboarding threads (team badge). */
export async function unreadTeamThreads(db: DbOrTx): Promise<number> {
  const res = await db.execute(sql`
    select count(distinct m.client_id)::int as n
    from messages m join clients c on c.id = m.client_id
    where c.lifecycle = 'bekotes_alatt' and m.sender_role = 'client' and m.read_by_team_at is null and m.deleted_at is null`);
  return Number((res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0);
}


/** SPEC §26.4: a client in onboarding wrote → the team gets a badge (one unread notice per client and member). */
export async function notifyTeamOfClientMessage(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<void> {
  const members = (await queueOwners(db)).filter((u) => u.role === 'csapat');
  for (const m of members) {
    const [hit] = await db
      .select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, m.userId), eq(notificationsTable.kind, 'client_message_new'), isNullCol(notificationsTable.readAt), sql`${notificationsTable.data}->>'clientId' = ${cl.id}`))
      .limit(1);
    if (hit) continue;
    await notify(deps, db, { userId: m.userId, kind: 'client_message_new', params: { clientName: clientName(cl) }, link: `/uzenetek?ugyfel=${cl.id}`, data: { clientId: cl.id } });
  }
}
