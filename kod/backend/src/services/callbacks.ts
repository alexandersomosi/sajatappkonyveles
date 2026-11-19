// "Kérj visszahívást" (SPEC §26.2): the callback request that replaced appointment booking. Client views, the
// staff queue rows, every state change (claim, "Most hívom", attempts, hand-over, close), the SLA job, and the
// one-time mapping of booked legacy appointments. Phone numbers are stored encrypted (APP_DATA_KEY) and shown in full
// only to the staff member the callback is assigned to (audited). Audit details never hold numbers or note texts.
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { CallbackPromise, CallbackView, ClientCallbacks, TeamCallbackDetail, TeamCallbackRow } from '../_shared/api.js';
import { maskHuPhone, normalizeHuPhone } from '../_shared/bekotes.js';
import {
  ASSIST_OPEN_STATUSES,
  CALLBACK_ATTEMPT_OUTCOME_LABELS,
  CALLBACK_CLOSE_REASON_LABELS,
  CALLBACK_FAILED_OUTCOMES,
  CALLBACK_OPEN_STATUSES,
  CALLBACK_RULES,
  CALLBACK_TOPIC_LABELS,
  CALLBACK_TOPICS,
  CALLBACK_WINDOW_LABELS,
  CALLBACK_WINDOWS,
  type CallbackAttemptOutcome,
  type CallbackCloseReason,
  type CallbackSource,
  type CallbackStatus,
  type CallbackTopic,
  type CallbackWindow,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { appointments, assistRequests, auditLog, callbackAttempts, callbackRequests, clients, messages, teamMembers, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { ApiError, E } from '../lib/errors.js';
import { todayBudapest, addDays, MONTHS_HU, dayAn } from '../lib/dates.js';
import { notify } from '../notify/notify.js';
import { clientName, type ClientRow } from './people.js';
import { accountantUserOf, notifyQueueOwners, staffRefs, type StaffActor } from './team.js';
import type { CallbackStatusTextKey } from '../content/tulaj1118.js';

export type CallbackRow = typeof callbackRequests.$inferSelect;
const PHONE_AAD = 'callback_requests.phone';
const OPEN = [...CALLBACK_OPEN_STATUSES];

// ---------------------------------------------------------------------------------------------------------------
// formatting
// ---------------------------------------------------------------------------------------------------------------
function hm(d: Date): string {
  return new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

/** "ma 14:20" / "tegnap 9:05" / "holnap 10:00" / "november 19-én 10:00" (Budapest time). */
export function whenText(d: Date, now: Date): string {
  const day = todayBudapest(d);
  const today = todayBudapest(now);
  if (day === today) return `ma ${hm(d)}`;
  if (day === addDays(today, -1)) return `tegnap ${hm(d)}`;
  if (day === addDays(today, 1)) return `holnap ${hm(d)}`;
  return `${MONTHS_HU[Number(day.slice(5, 7)) - 1]} ${dayAn(Number(day.slice(8, 10)))} ${hm(d)}`;
}

/** "még 21 óra" / "lejárt 3 órája" (panel countdown, also in staff notifications). */
export function dueText(due: Date, now: Date): string {
  const mins = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (mins >= 0) return mins >= 60 ? `még ${Math.floor(mins / 60)} óra` : `még ${mins} perc`;
  const late = -mins;
  return late >= 60 ? `lejárt ${Math.floor(late / 60)} órája` : `lejárt ${late} perce`;
}

export function phoneOf(deps: Deps, row: CallbackRow): string | null {
  if (!row.phoneEnc) return null;
  try {
    return deps.data.dec(row.phoneEnc, PHONE_AAD);
  } catch {
    return null;
  }
}

export function profilePhone(deps: Deps, cl: ClientRow): string | null {
  if (!cl.phoneEnc) return null;
  try {
    return deps.data.dec(cl.phoneEnc, 'clients.phone');
  } catch {
    return null;
  }
}

function mask(p: string | null): string {
  if (!p) return '';
  return p.startsWith('+36') ? maskHuPhone(p) : `${p.slice(0, 3)} *** **${p.slice(-2)}`;
}

const PHONE_MSG = 'Magyar telefonszámot adj meg, például +36 30 123 4567.';

export function parsePhone(input: string, field = 'phone'): string {
  const p = normalizeHuPhone(input);
  if (!p) throw E.validation({ [field]: PHONE_MSG }, PHONE_MSG);
  return p;
}

// ---------------------------------------------------------------------------------------------------------------
// client views
// ---------------------------------------------------------------------------------------------------------------
export function isOpen(row: Pick<CallbackRow, 'status'>): boolean {
  return (OPEN as string[]).includes(row.status);
}
function isOverdue(row: CallbackRow, now: Date): boolean {
  return isOpen(row) && now.getTime() > row.dueAt.getTime();
}
function callingNow(row: CallbackRow, now: Date): boolean {
  return isOpen(row) && Boolean(row.callingNowUntil && row.callingNowUntil.getTime() > now.getTime());
}

export function statusKey(row: CallbackRow, now: Date): CallbackStatusTextKey {
  switch (row.status) {
    case 'teljesitve':
      return 'teljesitve';
    case 'sikertelen':
      return 'sikertelen';
    case 'visszavonva':
      return 'visszavonva';
    case 'lezarva':
      return 'lezarva';
    default:
      break;
  }
  if (row.needsNewPhone) return 'hibas_szam';
  if (callingNow(row, now)) return 'most_hiv';
  if (row.lastOutcome === 'kesobb_kerte' && row.nextAttemptAfter && row.nextAttemptAfter.getTime() > now.getTime()) return 'kesobb';
  if (row.lastOutcome && (CALLBACK_FAILED_OUTCOMES as string[]).includes(row.lastOutcome)) return 'nem_ert_el';
  if (isOverdue(row, now)) return 'lejart';
  if (row.status === 'folyamatban' && row.assignedUserId) return 'folyamatban';
  // A former booking turned into a callback keeps its agreed time (same promise as the one-time notice).
  if (row.source === 'regi_idopont') return 'regi_idopont';
  return 'uj';
}

export async function callbackView(deps: Deps, db: DbOrTx, row: CallbackRow): Promise<CallbackView> {
  const now = deps.now();
  const refs = await staffRefs(db, [row.assignedUserId]);
  const staffFirstName = row.assignedUserId ? (refs.get(row.assignedUserId)?.firstName ?? null) : null;
  const key = statusKey(row, now);
  const when =
    key === 'kesobb' && row.nextAttemptAfter
      ? whenText(row.nextAttemptAfter, now)
      : key === 'regi_idopont'
        ? whenText(row.targetAt, now)
      : key === 'teljesitve'
        ? whenText(row.closedAt ?? row.lastAttemptAt ?? now, now)
        : row.lastAttemptAt
          ? whenText(row.lastAttemptAt, now)
          : '';
  const reasonText = row.closedReason ? await deps.content.render(`visszahivas.lezaras_ok.${row.closedReason}`, {}) : '';
  const phoneMasked = row.phoneMasked ?? '';
  const statusText = await deps.content.render(`visszahivas.allapot.${key}`, { phoneMasked: phoneMasked || 'megadott', staffFirstName: staffFirstName ?? 'Kollégánk', when, reasonText });
  const open = isOpen(row);
  return {
    id: row.id,
    status: row.status,
    statusText,
    topic: row.topic,
    topicLabel: CALLBACK_TOPIC_LABELS[row.topic],
    source: row.source,
    window: row.callWindow,
    phoneMasked,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    overdue: isOverdue(row, now),
    callingNow: callingNow(row, now),
    staffFirstName,
    lastAttempt: row.lastAttemptAt && row.lastOutcome ? { at: row.lastAttemptAt.toISOString(), outcome: row.lastOutcome } : null,
    failedAttempts: row.failedAttempts,
    needsNewPhone: row.needsNewPhone,
    canEdit: open,
    canCancel: open,
    closedAt: row.closedAt?.toISOString() ?? null,
    summary: row.status === 'teljesitve' ? row.summaryForClient : null,
    assistId: await assistIdOfCallback(db, row.id),
  };
}

/** SPEC §27.3: the assist this callback belongs to (the '…_helyettem' topics). */
async function assistIdOfCallback(db: DbOrTx, callbackId: string): Promise<string | null> {
  const [a] = await db.select({ id: assistRequests.id }).from(assistRequests).where(eq(assistRequests.callbackId, callbackId)).orderBy(desc(assistRequests.createdAt)).limit(1);
  return a?.id ?? null;
}

export async function callbackPromise(deps: Deps, accFirstName: string): Promise<CallbackPromise> {
  const callerId = deps.cfg.callbackCallerId;
  return {
    // 11-19 javító kör 2: mid-sentence the placeholder is lower case ("Nem feltétlenül a könyvelőd hív elsőként").
    text: await deps.content.render('visszahivas.igeret', { firstName: /^A könyvelőd/.test(accFirstName) ? `a${accFirstName.slice(1)}` : accFirstName }),
    callerIdText: callerId ? await deps.content.render('visszahivas.hivoszam', { callerId }) : null,
    fraudWarning: await deps.content.render('visszahivas.csalas', {}),
    privacyText: await deps.content.render('visszahivas.adatkezeles', {}),
    windows: CALLBACK_WINDOWS.map((w) => ({ window: w, label: CALLBACK_WINDOW_LABELS[w] })),
    topics: CALLBACK_TOPICS.map((t) => ({ topic: t, label: CALLBACK_TOPIC_LABELS[t] })),
  };
}

/**
 * 11-19 javítás: the client's free-text note is read by the whole team – never a password, a login code or an
 * adóazonosító jel in it. True when the text looks like one ("jelszavam: titok123", "kód: 482913", "pin 1234", a
 * 10-digit number starting with 8). The client gets ASSIST_TEXTS.noteRefused and types it again.
 */
export function noteLooksSecret(note: string | null | undefined): boolean {
  if (!note) return false;
  const t = note.normalize('NFC');
  if (/(?<!\p{L})(jelsz\p{L}*|password|passw\p{L}*|pin|k[oó]d\p{L}*|azonos[ií]t[oó]\p{L}*)\s*[:=]\s*\S{3,}/iu.test(t)) return true;
  if (/(?<!\p{L})(jelsz\p{L}*|password|pin)\s+(?:\p{L}{1,6}\s+)?\S*\d\S*/iu.test(t)) return true;
  return /(?<!\d)8\d{9}(?!\d)/u.test(t.replace(/[\s-]/g, ''));
}

export async function openCallbackOf(db: DbOrTx, clientId: string): Promise<CallbackRow | null> {
  const [row] = await db
    .select()
    .from(callbackRequests)
    .where(and(eq(callbackRequests.clientId, clientId), inArray(callbackRequests.status, OPEN)))
    .limit(1);
  return row ?? null;
}

export async function clientCallbacks(deps: Deps, db: DbOrTx, cl: ClientRow, accFirstName: string): Promise<ClientCallbacks> {
  const open = await openCallbackOf(db, cl.id);
  const recent = await db
    .select()
    .from(callbackRequests)
    .where(and(eq(callbackRequests.clientId, cl.id), sql`${callbackRequests.status} not in ('uj', 'folyamatban')`))
    .orderBy(desc(callbackRequests.createdAt))
    .limit(5);
  const p = profilePhone(deps, cl);
  return {
    open: open ? await callbackView(deps, db, open) : null,
    recent: await Promise.all(recent.map((r) => callbackView(deps, db, r))),
    promise: await callbackPromise(deps, accFirstName),
    phoneOnFileMasked: p ? mask(p) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// create / change by the client (or created by staff for a client)
// ---------------------------------------------------------------------------------------------------------------
export interface CreateCallbackInput {
  cl: ClientRow;
  phone?: string;
  topic: CallbackTopic;
  window: CallbackWindow;
  note?: string | null;
  source: CallbackSource;
  savePhoneToProfile?: boolean;
  createdByRole: 'client' | 'csapat' | 'admin' | 'accountant';
  createdByUserId: string;
}

export async function createCallback(deps: Deps, db: DbOrTx, i: CreateCallbackInput): Promise<CallbackRow> {
  const now = deps.now();
  const existing = await openCallbackOf(db, i.cl.id);
  if (existing) {
    const e = new ApiError(409, 'callback_already_open', 'Már kértél visszahívást. Ha más számon vagy más időben hívjunk, módosítsd a kérésedet.', undefined, {
      callback: await callbackView(deps, db, existing),
    });
    throw e;
  }
  if (i.createdByRole === 'client') {
    const [cnt] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(callbackRequests)
      .where(and(eq(callbackRequests.clientId, i.cl.id), eq(callbackRequests.createdByRole, 'client'), gte(callbackRequests.createdAt, new Date(now.getTime() - 86_400_000))));
    if (Number(cnt?.n ?? 0) >= CALLBACK_RULES.createPerClientPerDay)
      throw E.rateLimited(3600, 'Ma már többször kértél visszahívást. Írj nekünk üzenetet, vagy próbáld újra holnap.');
  }
  let phone: string;
  if (i.phone && i.phone.trim()) phone = parsePhone(i.phone);
  else {
    const p = profilePhone(deps, i.cl);
    const n = p ? normalizeHuPhone(p) : null;
    if (!n) throw E.validation({ phone: PHONE_MSG }, PHONE_MSG);
    phone = n;
  }
  if (i.savePhoneToProfile && i.phone) await db.update(clients).set({ phoneEnc: deps.data.enc(phone, 'clients.phone'), updatedAt: now }).where(eq(clients.id, i.cl.id));
  const [row] = await db
    .insert(callbackRequests)
    .values({
      clientId: i.cl.id,
      createdByUserId: i.createdByUserId,
      createdByRole: i.createdByRole,
      status: 'uj',
      topic: i.topic,
      source: i.source,
      callWindow: i.window,
      note: i.note?.trim() ? i.note.trim().slice(0, CALLBACK_RULES.noteMaxChars) : null,
      phoneEnc: deps.data.enc(phone, PHONE_AAD),
      phoneMasked: mask(phone),
      targetAt: new Date(now.getTime() + CALLBACK_RULES.targetHours * 3600_000),
      dueAt: new Date(now.getTime() + deps.cfg.callbackDueHours * 3600_000),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await audit(db, {
    action: 'callback.created',
    actorUserId: i.createdByUserId,
    actorRole: i.createdByRole,
    targetType: 'callback',
    targetId: row!.id,
    clientId: i.cl.id,
    details: { topic: i.topic, source: i.source, window: i.window, savedToProfile: Boolean(i.savePhoneToProfile && i.phone) },
  });
  await notify(deps, db, { userId: i.cl.userId, kind: 'callback_received', params: { phoneMasked: row!.phoneMasked }, link: '/visszahivas' });
  await notifyQueueOwners(
    deps,
    db,
    { kind: 'callback_new', params: { clientName: clientName(i.cl), topicLabel: CALLBACK_TOPIC_LABELS[i.topic], dueText: dueText(row!.dueAt, now) }, link: `/visszahivasok?id=${row!.id}`, data: { clientId: i.cl.id, callbackId: row!.id } },
    { except: i.createdByRole === 'client' ? null : i.createdByUserId },
  );
  return row!;
}

async function lockOpen(db: DbOrTx, id: string): Promise<CallbackRow> {
  const [row] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, id)).limit(1).for('update');
  if (!row) throw E.notFound();
  return row;
}

export async function updateByClient(
  deps: Deps,
  db: DbOrTx,
  cl: ClientRow,
  id: string,
  b: { phone?: string; topic?: CallbackTopic; window?: CallbackWindow; note?: string | null },
  actorUserId: string,
): Promise<CallbackRow> {
  const row = await lockOpen(db, id);
  if (row.clientId !== cl.id) throw E.notFound();
  if (!isOpen(row)) throw E.conflict('Ezt a kérést már lezártuk. Ha még kell, kérj újat.');
  const now = deps.now();
  const patch: Partial<CallbackRow> = { updatedAt: now };
  let phoneChanged = false;
  if (b.phone !== undefined) {
    const p = parsePhone(b.phone);
    patch.phoneEnc = deps.data.enc(p, PHONE_AAD);
    patch.phoneMasked = mask(p);
    patch.needsNewPhone = false;
    phoneChanged = true;
  }
  if (b.topic) patch.topic = b.topic;
  if (b.window) patch.callWindow = b.window;
  if (b.note !== undefined) patch.note = b.note?.trim() ? b.note.trim().slice(0, CALLBACK_RULES.noteMaxChars) : null;
  const [u] = await db.update(callbackRequests).set(patch).where(eq(callbackRequests.id, row.id)).returning();
  await audit(db, { action: 'callback.updated', actorUserId, actorRole: 'client', targetType: 'callback', targetId: row.id, clientId: cl.id, details: { fields: Object.keys(b), by: 'client' } });
  if (phoneChanged && row.assignedUserId && row.needsNewPhone) {
    await notify(deps, db, {
      userId: row.assignedUserId,
      kind: 'callback_assigned',
      variant: 'uj_szam',
      params: { clientName: clientName(cl), topicLabel: CALLBACK_TOPIC_LABELS[u!.topic], dueText: dueText(u!.dueAt, now) },
      link: `/visszahivasok?id=${row.id}`,
      data: { clientId: cl.id, callbackId: row.id },
    });
  }
  return u!;
}

export async function cancelByClient(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, actorUserId: string): Promise<CallbackRow> {
  const row = await lockOpen(db, id);
  if (row.clientId !== cl.id) throw E.notFound();
  if (!isOpen(row)) throw E.conflict('Ezt a kérést már lezártuk.');
  const now = deps.now();
  const [u] = await db
    .update(callbackRequests)
    .set({ status: 'visszavonva', closedAt: now, closedBy: actorUserId, callingNowUntil: null, updatedAt: now })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await audit(db, { action: 'callback.cancelled', actorUserId, actorRole: 'client', targetType: 'callback', targetId: row.id, clientId: cl.id });
  return u!;
}

// ---------------------------------------------------------------------------------------------------------------
// staff side
// ---------------------------------------------------------------------------------------------------------------
/** SPEC §26.4: csapat/admin see every callback; an accountant only the ones assigned to him (others 404). */
export async function callbackForStaff(db: DbOrTx, actor: StaffActor, id: string, forUpdate = false): Promise<CallbackRow> {
  const q = db.select().from(callbackRequests).where(eq(callbackRequests.id, id)).limit(1);
  const [row] = forUpdate ? await q.for('update') : await q;
  if (!row) throw E.notFound();
  if (actor.role === 'accountant' && row.assignedUserId !== actor.userId) throw E.notFound();
  return row;
}

function staffAudit(db: DbOrTx, actor: StaffActor, action: string, row: CallbackRow, details?: Record<string, unknown>) {
  return audit(db, { action, actorUserId: actor.userId, actorRole: actor.role, targetType: 'callback', targetId: row.id, clientId: row.clientId, details: details ?? null });
}

async function clientOf(db: DbOrTx, id: string): Promise<ClientRow> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!cl) throw E.notFound();
  return cl;
}

export async function claim(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, force: boolean): Promise<CallbackRow> {
  if (actor.role === 'accountant') throw E.notFound();
  const row = await callbackForStaff(db, actor, id, true);
  if (!isOpen(row)) throw E.conflict('Ez a kérés már le van zárva.');
  if (row.assignedUserId === actor.userId) return row;
  if (row.assignedUserId && !(force && actor.role === 'admin')) {
    const ref = (await staffRefs(db, [row.assignedUserId])).get(row.assignedUserId);
    throw E.conflict(`Ezt már ${ref?.firstName ?? 'egy kollégád'} intézi.`);
  }
  const now = deps.now();
  const [u] = await db
    .update(callbackRequests)
    .set({ assignedUserId: actor.userId, assignedAt: now, status: 'folyamatban', updatedAt: now })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await staffAudit(db, actor, 'callback.claimed', row, { forced: Boolean(row.assignedUserId) });
  // 11-19 javító kör 2: claiming the call of an "Intézzük helyette" request also takes the (unassigned) request.
  const linked = await db
    .update(assistRequests)
    .set({ assignedUserId: actor.userId, updatedAt: now })
    .where(and(eq(assistRequests.callbackId, row.id), isNull(assistRequests.assignedUserId), inArray(assistRequests.status, [...ASSIST_OPEN_STATUSES])))
    .returning({ id: assistRequests.id, clientId: assistRequests.clientId });
  for (const a of linked) await audit(db, { action: 'assist.assigned', actorUserId: actor.userId, actorRole: actor.role, targetType: 'assist', targetId: a.id, clientId: a.clientId, details: { toUserId: actor.userId, via: 'callback' } });
  return u!;
}

/** People a callback may be handed to: active team members, active admins, and the client's own accountant. */
export async function assignableFor(db: DbOrTx, cl: ClientRow): Promise<string[]> {
  const team = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(teamMembers, eq(teamMembers.userId, users.id))
    .where(and(eq(users.role, 'csapat'), eq(users.status, 'active'), eq(teamMembers.active, true)));
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
  const acc = await accountantUserOf(db, cl);
  const ids = [...team.map((t) => t.id), ...admins.map((a) => a.id)];
  if (acc) {
    const [au] = await db.select({ status: users.status }).from(users).where(eq(users.id, acc.userId)).limit(1);
    if (au?.status === 'active') ids.push(acc.userId);
  }
  return [...new Set(ids)];
}

export async function assign(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, userId: string | null): Promise<CallbackRow> {
  const row = await callbackForStaff(db, actor, id, true);
  if (!isOpen(row)) throw E.conflict('Ez a kérés már le van zárva.');
  if (actor.role === 'accountant' && userId !== null) throw E.forbidden('Visszaadni tudod a sorba, másnak átadni nem.');
  const cl = await clientOf(db, row.clientId);
  if (userId) {
    const allowed = await assignableFor(db, cl);
    if (!allowed.includes(userId)) throw E.validation({ userId: 'Neki nem adhatod át ezt a kérést.' });
  }
  const now = deps.now();
  const [u] = await db
    .update(callbackRequests)
    .set({
      assignedUserId: userId,
      assignedAt: userId ? now : null,
      status: userId || row.attempts > 0 ? 'folyamatban' : 'uj',
      callingNowUntil: null,
      updatedAt: now,
    })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await staffAudit(db, actor, 'callback.assigned', row, { toUserId: userId, fromUserId: row.assignedUserId });
  if (userId && userId !== actor.userId) {
    await notify(deps, db, {
      userId,
      kind: 'callback_assigned',
      params: { clientName: clientName(cl), topicLabel: CALLBACK_TOPIC_LABELS[u!.topic], dueText: dueText(u!.dueAt, now) },
      link: `/visszahivasok?id=${row.id}`,
      data: { clientId: cl.id, callbackId: row.id },
    });
  }
  return u!;
}

function requireHolder(actor: StaffActor, row: CallbackRow, adminToo = false) {
  if (row.assignedUserId === actor.userId) return;
  if (adminToo && actor.role === 'admin') return;
  throw new ApiError(409, 'not_holder', 'Előbb vedd magadra.');
}

export async function startCalling(deps: Deps, db: DbOrTx, actor: StaffActor, id: string): Promise<CallbackRow> {
  const row = await callbackForStaff(db, actor, id, true);
  if (!isOpen(row)) throw E.conflict('Ez a kérés már le van zárva.');
  requireHolder(actor, row);
  const now = deps.now();
  const [u] = await db
    .update(callbackRequests)
    .set({ callingNowUntil: new Date(now.getTime() + CALLBACK_RULES.callingNowMinutes * 60_000), status: 'folyamatban', updatedAt: now })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await staffAudit(db, actor, 'callback.calling', row);
  const cl = await clientOf(db, row.clientId);
  await notify(deps, db, { userId: cl.userId, kind: 'callback_calling', params: { staffFirstName: actor.firstName }, link: '/visszahivas' });
  return u!;
}

export async function recordAttempt(
  deps: Deps,
  db: DbOrTx,
  actor: StaffActor,
  id: string,
  b: { outcome: CallbackAttemptOutcome; note?: string; summaryForClient?: string; nextAttemptAfter?: string },
): Promise<CallbackRow> {
  const row = await callbackForStaff(db, actor, id, true);
  if (!isOpen(row)) throw E.conflict('Ez a kérés már le van zárva.');
  requireHolder(actor, row);
  const now = deps.now();
  if (b.summaryForClient && b.outcome !== 'beszeltunk') throw E.validation({ summaryForClient: 'Összefoglalót csak a „Beszéltünk” eredményhez írhatsz.' });
  let next: Date | null = null;
  if (b.outcome === 'kesobb_kerte') {
    if (!b.nextAttemptAfter) throw E.validation({ nextAttemptAfter: 'Mikor hívjunk újra?' });
    next = new Date(b.nextAttemptAfter);
    if (Number.isNaN(next.getTime()) || next.getTime() <= now.getTime()) throw E.validation({ nextAttemptAfter: 'Jövőbeli időpontot adj meg.' });
    if (next.getTime() > now.getTime() + 30 * 86_400_000) throw E.validation({ nextAttemptAfter: 'Legfeljebb 30 napra előre.' });
  } else if (b.nextAttemptAfter) throw E.validation({ nextAttemptAfter: 'Csak a „Később kérte” eredményhez adhatsz meg időpontot.' });
  const failed = (CALLBACK_FAILED_OUTCOMES as string[]).includes(b.outcome);
  const failedAttempts = row.failedAttempts + (failed ? 1 : 0);
  let status: CallbackStatus = 'folyamatban';
  if (b.outcome === 'beszeltunk') status = 'teljesitve';
  else if (failed && failedAttempts >= CALLBACK_RULES.maxFailedAttempts) status = 'sikertelen';
  await db.insert(callbackAttempts).values({ callbackId: row.id, byUserId: actor.userId, at: now, outcome: b.outcome, note: b.note?.trim() ? b.note.trim().slice(0, CALLBACK_RULES.attemptNoteMaxChars) : null });
  const cl = await clientOf(db, row.clientId);
  let summaryMessageId: string | null = null;
  const summary = b.outcome === 'beszeltunk' && b.summaryForClient?.trim() ? b.summaryForClient.trim().slice(0, CALLBACK_RULES.summaryMaxChars) : null;
  if (summary) {
    const senderRole = actor.role === 'accountant' ? 'accountant' : 'csapat';
    const [m] = await db
      .insert(messages)
      .values({
        clientId: cl.id,
        senderUserId: actor.userId,
        senderRole,
        kind: 'szoveg',
        body: `A hívásunk összefoglalója: ${summary}`,
        createdAt: now,
        ...(senderRole === 'accountant' ? { readByAccountantAt: now } : { readByTeamAt: now }),
      })
      .returning({ id: messages.id });
    summaryMessageId = m!.id;
    await audit(db, { action: 'message.sent', actorUserId: actor.userId, actorRole: actor.role, targetType: 'message', targetId: m!.id, clientId: cl.id, details: { from: 'callback_summary' } });
  }
  const [u] = await db
    .update(callbackRequests)
    .set({
      status,
      attempts: row.attempts + 1,
      failedAttempts,
      lastAttemptAt: now,
      lastOutcome: b.outcome,
      callingNowUntil: null,
      nextAttemptAfter: b.outcome === 'kesobb_kerte' ? next : failed ? new Date(now.getTime() + CALLBACK_RULES.minMinutesBetweenAttempts * 60_000) : null,
      needsNewPhone: b.outcome === 'hibas_szam' ? true : row.needsNewPhone,
      ...(status !== 'folyamatban' ? { closedAt: now, closedBy: actor.userId } : {}),
      ...(summary ? { summaryForClient: summary, summaryMessageId } : {}),
      updatedAt: now,
    })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await staffAudit(db, actor, 'callback.attempt', row, { outcome: b.outcome, attempt: row.attempts + 1, status, summary: Boolean(summary) });
  const when = whenText(now, now);
  if (status === 'teljesitve') await notify(deps, db, { userId: cl.userId, kind: 'callback_done', link: '/uzenetek' });
  else if (status === 'sikertelen') await notify(deps, db, { userId: cl.userId, kind: 'callback_unreached', link: '/visszahivas' });
  else if (failed) await notify(deps, db, { userId: cl.userId, kind: 'callback_missed', params: { when: when.charAt(0).toUpperCase() + when.slice(1) }, link: '/visszahivas' });
  else if (b.outcome === 'hibas_szam') await notify(deps, db, { userId: cl.userId, kind: 'callback_wrong_number', link: '/visszahivas' });
  return u!;
}

export async function closeByStaff(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, b: { reason: CallbackCloseReason; note?: string }): Promise<CallbackRow> {
  const row = await callbackForStaff(db, actor, id, true);
  if (!isOpen(row)) throw E.conflict('Ez a kérés már le van zárva.');
  requireHolder(actor, row, true);
  const now = deps.now();
  const note = b.note?.trim() ? `Lezárás: ${b.note.trim()}` : null;
  const internal = note ? (row.internalNote ? `${row.internalNote}\n${note}` : note).slice(0, CALLBACK_RULES.internalNoteMaxChars) : row.internalNote;
  const [u] = await db
    .update(callbackRequests)
    .set({ status: 'lezarva', closedAt: now, closedBy: actor.userId, closedReason: b.reason, callingNowUntil: null, internalNote: internal, updatedAt: now })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await staffAudit(db, actor, 'callback.closed', row, { reason: b.reason });
  const cl = await clientOf(db, row.clientId);
  await notify(deps, db, { userId: cl.userId, kind: 'callback_closed', params: { reasonText: capitalizeFirst(await deps.content.render(`visszahivas.lezaras_ok.${b.reason}`, {})) }, link: '/visszahivas' });
  return u!;
}

function capitalizeFirst(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}.`.replace(/\.\.$/, '.') : s;
}

export async function patchByStaff(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, b: { internalNote?: string | null; topic?: CallbackTopic }): Promise<CallbackRow> {
  const row = await callbackForStaff(db, actor, id, true);
  requireHolder(actor, row, true);
  const now = deps.now();
  const [u] = await db
    .update(callbackRequests)
    .set({
      ...(b.internalNote !== undefined ? { internalNote: b.internalNote?.trim() ? b.internalNote.trim().slice(0, CALLBACK_RULES.internalNoteMaxChars) : null } : {}),
      ...(b.topic ? { topic: b.topic } : {}),
      updatedAt: now,
    })
    .where(eq(callbackRequests.id, row.id))
    .returning();
  await staffAudit(db, actor, 'callback.updated', row, { fields: Object.keys(b), by: 'staff' });
  return u!;
}

// ---------------------------------------------------------------------------------------------------------------
// staff DTOs
// ---------------------------------------------------------------------------------------------------------------
export async function teamRows(deps: Deps, db: DbOrTx, rows: CallbackRow[]): Promise<TeamCallbackRow[]> {
  if (!rows.length) return [];
  const now = deps.now();
  const cls = await db.select().from(clients).where(inArray(clients.id, [...new Set(rows.map((r) => r.clientId))]));
  const refs = await staffRefs(db, rows.map((r) => r.assignedUserId));
  return rows.map((r) => {
    const cl = cls.find((c) => c.id === r.clientId)!;
    return {
      id: r.id,
      client: { id: cl.id, name: clientName(cl), lifecycle: cl.lifecycle },
      status: r.status,
      topic: r.topic,
      source: r.source,
      window: r.callWindow,
      phoneMasked: r.phoneMasked ?? '',
      notePreview: r.note ? (r.note.length > 80 ? `${r.note.slice(0, 79)}…` : r.note) : null,
      createdAt: r.createdAt.toISOString(),
      targetAt: r.targetAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      overdue: isOverdue(r, now),
      minutesToDue: Math.round((r.dueAt.getTime() - now.getTime()) / 60_000),
      attempts: r.attempts,
      failedAttempts: r.failedAttempts,
      lastAttemptAt: r.lastAttemptAt?.toISOString() ?? null,
      nextAttemptAfter: r.nextAttemptAfter?.toISOString() ?? null,
      callingNowUntil: r.callingNowUntil && r.callingNowUntil.getTime() > now.getTime() ? r.callingNowUntil.toISOString() : null,
      assignee: r.assignedUserId ? (refs.get(r.assignedUserId) ?? null) : null,
    };
  });
}

const HISTORY_TEXT: Record<string, (d: Record<string, unknown>, names: Map<string, string>) => string | null> = {
  'callback.created': (d) => (d.source === 'regi_idopont' ? 'Korábbi időpontfoglalásból' : d.source === 'csapat' ? 'Felvette egy kollégánk' : 'Beérkezett'),
  'callback.claimed': () => 'Magára vette',
  'callback.assigned': (d, n) => (d.toUserId ? `Átadva: ${n.get(String(d.toUserId)) ?? 'kolléga'}` : 'Visszaadva a sorba'),
  'callback.calling': () => 'Hívja („Most hívom”)',
  'callback.attempt': (d) => `Hívás: ${CALLBACK_ATTEMPT_OUTCOME_LABELS[d.outcome as CallbackAttemptOutcome] ?? String(d.outcome)}`,
  'callback.closed': (d) => `Lezárva hívás nélkül: ${CALLBACK_CLOSE_REASON_LABELS[d.reason as CallbackCloseReason] ?? ''}`,
  'callback.cancelled': () => 'Az ügyfél lemondta',
  'callback.updated': (d) => (d.by === 'client' ? 'Az ügyfél módosította' : 'Módosítva'),
  'callback.overdue': () => 'Lejárt a határidő',
};

export async function teamDetail(deps: Deps, db: DbOrTx, actor: StaffActor, row: CallbackRow, card: TeamCallbackDetail['clientCard']): Promise<TeamCallbackDetail> {
  const [base] = await teamRows(deps, db, [row]);
  const mine = row.assignedUserId === actor.userId;
  let phone: string | null = null;
  // Only the person CURRENTLY handling an open request sees the full number (adatkezeles.md; review k3c2).
  if (mine && isOpen(row)) {
    phone = phoneOf(deps, row);
    if (phone) await audit(db, { action: 'callback.phone_viewed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'callback', targetId: row.id, clientId: row.clientId });
  }
  const atts = await db.select().from(callbackAttempts).where(eq(callbackAttempts.callbackId, row.id)).orderBy(asc(callbackAttempts.at));
  const hist = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.targetType, 'callback'), eq(auditLog.targetId, row.id), sql`${auditLog.action} <> 'callback.phone_viewed'`))
    .orderBy(asc(auditLog.at), asc(auditLog.id));
  const cl = await clientOf(db, row.clientId);
  const assignable = await assignableFor(db, cl);
  const refs = await staffRefs(db, [...atts.map((a) => a.byUserId), ...hist.map((h) => h.actorUserId), ...assignable, ...hist.map((h) => String((h.details as Record<string, unknown> | null)?.toUserId ?? ''))].filter((x) => /^[0-9a-f-]{36}$/.test(x ?? '')));
  const names = new Map([...refs.entries()].map(([k, v]) => [k, v.name]));
  let legacy: TeamCallbackDetail['legacyAppointment'] = null;
  if (row.legacyAppointmentId) {
    const [a] = await db.select().from(appointments).where(eq(appointments.id, row.legacyAppointmentId)).limit(1);
    if (a) legacy = { startsAt: a.startsAt.toISOString(), channel: a.channel, status: a.status };
  }
  return {
    ...base!,
    phone,
    note: row.note,
    internalNote: row.internalNote,
    summaryForClient: row.summaryForClient,
    closedReason: row.closedReason,
    closedAt: row.closedAt?.toISOString() ?? null,
    clientCard: card,
    attemptList: atts.map((a) => ({ id: a.id, at: a.at.toISOString(), by: refs.get(a.byUserId) ?? { userId: a.byUserId, name: '', firstName: '', role: 'csapat' }, outcome: a.outcome, note: a.note })),
    history: hist
      .map((h) => {
        const f = HISTORY_TEXT[h.action];
        const text = f ? f((h.details ?? {}) as Record<string, unknown>, names) : null;
        // "Beérkezett" carries the request's own time (the header shows the same), not the time the log row was written.
        const at = h.action === 'callback.created' ? row.createdAt : h.at;
        return text ? { at: at.toISOString(), by: h.actorUserId ? (refs.get(h.actorUserId) ?? null) : null, action: h.action, text } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    assignable: assignable.map((id) => refs.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)),
    legacyAppointment: legacy,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// jobs and the legacy mapping
// ---------------------------------------------------------------------------------------------------------------
/** Every 5 minutes (SPEC §26.2.8): overdue notice once per callback; expired "Most hívom" cleared. */
export async function jobCallbackSla(deps: Deps): Promise<{ overdue: number; cleared: number }> {
  const db = deps.db;
  const now = deps.now();
  const cleared = await db
    .update(callbackRequests)
    .set({ callingNowUntil: null })
    .where(and(isNotNull(callbackRequests.callingNowUntil), lt(callbackRequests.callingNowUntil, now)))
    .returning({ id: callbackRequests.id });
  const due = await db
    .select()
    .from(callbackRequests)
    .where(and(inArray(callbackRequests.status, OPEN), lt(callbackRequests.dueAt, now), isNull(callbackRequests.overdueNotifiedAt)));
  let n = 0;
  for (const row of due) {
    const [claimed] = await db
      .update(callbackRequests)
      .set({ overdueNotifiedAt: now })
      .where(and(eq(callbackRequests.id, row.id), isNull(callbackRequests.overdueNotifiedAt)))
      .returning({ id: callbackRequests.id });
    if (!claimed) continue;
    const cl = await clientOf(db, row.clientId);
    const n0 = { kind: 'callback_overdue' as const, params: { clientName: clientName(cl), createdText: whenText(row.createdAt, now) }, link: `/visszahivasok?id=${row.id}`, data: { clientId: cl.id, callbackId: row.id } };
    const sent = new Set<string>();
    if (row.assignedUserId) {
      await notify(deps, db, { ...n0, userId: row.assignedUserId });
      sent.add(row.assignedUserId);
      const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
      for (const a of admins) if (!sent.has(a.id)) await notify(deps, db, { ...n0, userId: a.id });
    } else {
      await notifyQueueOwners(deps, db, n0);
    }
    await audit(db, { action: 'callback.overdue', actorRole: 'system', targetType: 'callback', targetId: row.id, clientId: row.clientId });
    n++;
  }
  return { overdue: n, cleared: cleared.length };
}

/**
 * SPEC §26.2.9 / §26.9.3 (2): every booked appointment that is not older than a day becomes one callback (idempotent via
 * the unique legacy_appointment_id). The appointment rows themselves are never changed.
 */
export async function mapLegacyAppointments(deps: Deps): Promise<number> {
  const db = deps.db;
  const now = deps.now();
  const rows = await db
    .select({ a: appointments, c: clients })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(eq(appointments.status, 'foglalt'), gte(appointments.startsAt, new Date(now.getTime() - 86_400_000))));
  let n = 0;
  for (const { a, c } of rows) {
    const [done] = await db.select({ id: callbackRequests.id }).from(callbackRequests).where(eq(callbackRequests.legacyAppointmentId, a.id)).limit(1);
    if (done) continue;
    // A client may already have an open callback (one open per client): then the booking is only noted there.
    const open = await openCallbackOf(db, c.id);
    if (open) continue;
    let phone: string | null = null;
    if (a.phoneEnc) {
      try {
        phone = normalizeHuPhone(deps.data.dec(a.phoneEnc, 'appointments.phone'));
      } catch {
        phone = null;
      }
    }
    if (!phone) {
      const p = profilePhone(deps, c);
      phone = p ? normalizeHuPhone(p) : null;
    }
    const day = todayBudapest(a.startsAt);
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hour: '2-digit', hourCycle: 'h23' }).format(a.startsAt));
    const note = await deps.content.render('visszahivas.regi_idopont_megjegyzes', {
      date: `${MONTHS_HU[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}.`,
      time: hm(a.startsAt),
      channel: a.channel === 'telefon' ? 'telefon' : 'videó',
    });
    const dueBase = Math.max(a.startsAt.getTime(), now.getTime());
    const inserted = await db
      .insert(callbackRequests)
      .values({
        clientId: c.id,
        createdByUserId: null,
        createdByRole: 'system',
        status: 'uj',
        topic: 'bekotes',
        source: 'regi_idopont',
        callWindow: hour < 12 ? 'delelott' : 'delutan',
        note: note.slice(0, CALLBACK_RULES.noteMaxChars),
        phoneEnc: phone ? deps.data.enc(phone, PHONE_AAD) : null,
        phoneMasked: phone ? mask(phone) : null,
        needsNewPhone: !phone,
        targetAt: new Date(dueBase),
        dueAt: new Date(dueBase + 2 * 3600_000),
        legacyAppointmentId: a.id,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    const row = inserted[0];
    if (!row) continue;
    await audit(db, { action: 'callback.created', actorRole: 'system', targetType: 'callback', targetId: row.id, clientId: c.id, details: { source: 'regi_idopont', topic: 'bekotes' } });
    await notify(deps, db, { userId: c.userId, kind: 'callback_received', variant: 'regi_idopont', params: { when: whenText(a.startsAt, now), phoneMasked: row.phoneMasked ?? '' }, link: '/visszahivas', noEmail: true, noPush: true });
    n++;
  }
  return n;
}

export { CALLBACK_TOPIC_LABELS };
