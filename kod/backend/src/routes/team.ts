// /team – the service team's panel API (SPEC §26.3, §26.4, §26.10): callbacks (csapat + admin; an accountant only the
// callbacks assigned to him), new-business registrations (csapat + admin), and the onboarding message threads
// (csapat only). Every other area (documents, KYC, NAV, tax, notes, exports, audit, admin) stays closed to 'csapat':
// those route groups do not even let the role in (404).
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Page, TeamCallbackDetail, TeamClientCard, TeamRegistrationDetail, TeamRegistrationRow, TeamSummary, TeamThreadRow } from '../_shared/api.js';
import { activityPending, isValidOvtjKod } from '../_shared/bekotes.js';
import {
  CALLBACK_ATTEMPT_OUTCOMES,
  CALLBACK_CLOSE_REASONS,
  CALLBACK_OPEN_STATUSES,
  CALLBACK_RULES,
  CALLBACK_TOPICS,
  CALLBACK_WINDOWS,
  GUIDE_STEP_KEYS,
  REGISTRATION_CHECK_ITEMS,
  REGISTRATION_STATUSES,
  type Milestone,
  type RegistrationStatus,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { accountants, auditLog, businessRegistrations, callbackRequests, clients, files, messageAttachments, messages, teamMembers, users } from '../db/schema.js';
import { audit, auditC } from '../audit.js';
import { requireAuth } from '../auth/middleware.js';
import { checkFile, collectFiles } from '../files/upload.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { daysBetween, isIsoDate, todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { notify } from '../notify/notify.js';
import { assign, callbackForStaff, claim, closeByStaff, createCallback, patchByStaff, recordAttempt, startCalling, teamDetail, teamRows, type CallbackRow } from '../services/callbacks.js';
import { journeyOf, onboardingState } from '../services/onboarding.js';
import { clientName, type ClientRow } from '../services/people.js';
import {
  answersOf,
  applyInput,
  checkRegistrationAdoszam,
  computeHints,
  filedDoc,
  OPEN_REG,
  registrationInputSchema,
  transition,
  type RegRow,
} from '../services/registration.js';
import { messageDtos, messagePage } from '../services/requests.js';
import { accountantUserOf, clientForStaff, clientForTeamMessages, staffActor, staffRefs, teamClientCard, unreadTeamThreads, type StaffActor } from '../services/team.js';
import { afterRegistrationDone, finishRegistration } from './client-bekotes.js';
import { registerTeamAssistRoutes } from './team-helyettunk.js';
import { assistSummary } from './team-helyettunk.js';
import { cardAssist, evFiledByOf, openAssistOf, requestAssist, revalidateConsent } from '../services/assist.js';
import { pathHistory, WITHDRAW_NOTE_UNDO } from '../services/pathchange.js';
import { assistRequests } from '../db/schema.js';
import { CALLBACK_ASSIST_TOPIC } from '../_shared/enums.js';

/** EV nyilvántartási szám: exactly 8 digits (the app allows only digits; the API checks it too – review k3c2). */
const EV_SZAM = /^\d{8}$/;
const EV_SZAM_MSG = 'A nyilvántartási szám 8 számjegy.';

const PAGE = 50;
const cursorSchema = z
  .string()
  .regex(/^\d{1,6}$/)
  .optional();

export function teamRoutes(deps: Deps) {
  const r = new Hono<Env>();
  r.use('*', requireAuth(deps, { roles: ['csapat', 'admin', 'accountant'] }));

  const actorOf = (c: C) => staffActor(deps.db, auth(c).userId, auth(c).role);
  /** csapat + admin only (an accountant gets 404, as for any foreign route group). */
  async function teamOrAdmin(c: C): Promise<StaffActor> {
    const a = await actorOf(c);
    if (a.role === 'accountant') throw E.notFound();
    return a;
  }
  async function teamOnly(c: C): Promise<StaffActor> {
    const a = await actorOf(c);
    if (a.role !== 'csapat') throw E.notFound();
    return a;
  }
  const { milestoneOf, card, regRows, regDetail } = teamViews(deps);

  // ================= summary =================
  r.get('/summary', async (c) => {
    const a = await actorOf(c);
    const now = deps.now();
    const open = await deps.db
      .select({ assigned: callbackRequests.assignedUserId, due: callbackRequests.dueAt })
      .from(callbackRequests)
      .where(and(inArray(callbackRequests.status, [...CALLBACK_OPEN_STATUSES]), a.role === 'accountant' ? eq(callbackRequests.assignedUserId, a.userId) : sql`true`));
    const regs = Object.fromEntries(REGISTRATION_STATUSES.map((s) => [s, 0])) as Record<RegistrationStatus, number>;
    if (a.role !== 'accountant') {
      const rows = await deps.db.select({ status: businessRegistrations.status, n: sql<number>`count(*)::int` }).from(businessRegistrations).groupBy(businessRegistrations.status);
      for (const x of rows) regs[x.status] = Number(x.n);
    }
    const out: TeamSummary = {
      callbacks: {
        open: open.length,
        overdue: open.filter((x) => x.due.getTime() < now.getTime()).length,
        mine: open.filter((x) => x.assigned === a.userId).length,
        unassigned: open.filter((x) => !x.assigned).length,
      },
      registrations: regs,
      unreadThreads: a.role === 'csapat' ? await unreadTeamThreads(deps.db) : 0,
      assists: await assistSummary(deps, a),
    };
    return c.json(out);
  });

  // ================= callbacks =================
  r.get('/callbacks', async (c) => {
    const a = await actorOf(c);
    const q = parseQuery(c, z.object({ filter: z.enum(['nyitott', 'lejart', 'enyem', 'gazdatlan', 'lezart', 'mind']).default('nyitott'), topic: z.enum(CALLBACK_TOPICS).optional(), q: z.string().trim().max(80).optional(), cursor: cursorSchema }));
    const now = deps.now();
    const open = inArray(callbackRequests.status, [...CALLBACK_OPEN_STATUSES]);
    const conds: (SQL | undefined)[] = [];
    if (a.role === 'accountant') conds.push(eq(callbackRequests.assignedUserId, a.userId));
    if (q.filter === 'nyitott') conds.push(open);
    if (q.filter === 'lejart') conds.push(open, lt(callbackRequests.dueAt, now));
    if (q.filter === 'enyem') conds.push(open, eq(callbackRequests.assignedUserId, a.userId));
    if (q.filter === 'gazdatlan') conds.push(open, isNull(callbackRequests.assignedUserId));
    if (q.filter === 'lezart') conds.push(sql`${callbackRequests.status} not in ('uj', 'folyamatban')`);
    if (q.topic) conds.push(eq(callbackRequests.topic, q.topic));
    if (q.q) {
      const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conds.push(or(ilike(clients.lastName, like), ilike(clients.firstName, like), ilike(users.email, like), ilike(sql`${clients.lastName} || ' ' || ${clients.firstName}`, like)));
    }
    const offset = Number(q.cursor ?? 0);
    const rows = await deps.db
      .select({ cb: callbackRequests })
      .from(callbackRequests)
      .innerJoin(clients, eq(clients.id, callbackRequests.clientId))
      .innerJoin(users, eq(users.id, clients.userId))
      .where(and(...conds))
      .orderBy(
        ...(q.filter === 'lezart'
          ? [desc(callbackRequests.closedAt), desc(callbackRequests.createdAt)]
          : [
              // open first (for 'mind'), overdue first, then the nearest deadline
              sql`case when ${callbackRequests.status} in ('uj', 'folyamatban') then 0 else 1 end`,
              sql`case when ${callbackRequests.status} in ('uj', 'folyamatban') and ${callbackRequests.dueAt} < ${now.toISOString()}::timestamptz then 0 else 1 end`,
              asc(callbackRequests.dueAt),
              asc(callbackRequests.createdAt),
            ]),
      )
      .limit(PAGE + 1)
      .offset(offset);
    const page: Page<Awaited<ReturnType<typeof teamRows>>[number]> = { items: await teamRows(deps, deps.db, rows.slice(0, PAGE).map((x) => x.cb)), nextCursor: rows.length > PAGE ? String(offset + PAGE) : null };
    return c.json(page);
  });

  async function detail(a: StaffActor, row: CallbackRow): Promise<TeamCallbackDetail> {
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
    return teamDetail(deps, deps.db, a, row, await card(cl!));
  }

  r.get('/callbacks/:id', async (c) => {
    const a = await actorOf(c);
    return c.json(await detail(a, await callbackForStaff(deps.db, a, param(c, 'id'))));
  });

  r.post('/callbacks/:id/claim', async (c) => {
    const a = await actorOf(c);
    const b = await readJson(c, z.strictObject({ force: z.boolean().optional() }));
    const row = await deps.db.transaction((tx) => claim(deps, tx, a, param(c, 'id'), Boolean(b.force)));
    return c.json(await detail(a, row));
  });

  r.post('/callbacks/:id/assign', async (c) => {
    const a = await actorOf(c);
    const b = await readJson(c, z.strictObject({ userId: z.string().uuid().nullable() }));
    const row = await deps.db.transaction((tx) => assign(deps, tx, a, param(c, 'id'), b.userId));
    if (a.role === 'accountant') return c.json({ ok: true, id: row.id });
    return c.json(await detail(a, row));
  });

  r.post('/callbacks/:id/calling', async (c) => {
    const a = await actorOf(c);
    const row = await deps.db.transaction((tx) => startCalling(deps, tx, a, param(c, 'id')));
    return c.json(await detail(a, row));
  });

  r.post('/callbacks/:id/attempts', async (c) => {
    const a = await actorOf(c);
    const b = await readJson(
      c,
      z.strictObject({
        outcome: z.enum(CALLBACK_ATTEMPT_OUTCOMES),
        note: z.string().trim().max(CALLBACK_RULES.attemptNoteMaxChars).optional(),
        summaryForClient: z.string().trim().max(CALLBACK_RULES.summaryMaxChars).optional(),
        nextAttemptAfter: z.string().datetime({ offset: true }).optional(),
      }),
    );
    const row = await deps.db.transaction((tx) => recordAttempt(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  r.post('/callbacks/:id/close', async (c) => {
    const a = await actorOf(c);
    const b = await readJson(c, z.strictObject({ reason: z.enum(CALLBACK_CLOSE_REASONS), note: z.string().trim().max(500).optional() }));
    const row = await deps.db.transaction((tx) => closeByStaff(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  r.patch('/callbacks/:id', async (c) => {
    const a = await actorOf(c);
    const b = await readJson(c, z.strictObject({ internalNote: z.string().max(CALLBACK_RULES.internalNoteMaxChars).nullable().optional(), topic: z.enum(CALLBACK_TOPICS).optional() }));
    const row = await deps.db.transaction((tx) => patchByStaff(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  // ================= client card, callback on behalf of a client =================
  r.get('/clients/:clientId', async (c) => {
    const a = await actorOf(c);
    const cl = await clientForStaff(deps, deps.db, a, param(c, 'clientId'));
    return c.json(await card(cl));
  });

  r.post('/clients/:clientId/callbacks', async (c) => {
    const a = await actorOf(c);
    const cl = await clientForStaff(deps, deps.db, a, param(c, 'clientId'));
    const b = await readJson(
      c,
      z.strictObject({
        topic: z.enum(CALLBACK_TOPICS),
        note: z.string().trim().max(CALLBACK_RULES.noteMaxChars).optional(),
        phone: z.string().trim().max(30).optional(),
        window: z.enum(CALLBACK_WINDOWS).default('barmikor'),
      }),
    );
    const row = await deps.db.transaction(async (tx) => {
      const created = await createCallback(deps, tx, { cl, ...b, source: 'csapat', createdByRole: a.role, createdByUserId: a.userId });
      // SPEC §27.3: an "Intézzétek helyettem" topic opens (and links) the assisted request as well.
      const kind = CALLBACK_ASSIST_TOPIC[b.topic];
      if (kind && !(await openAssistOf(tx, cl.id, kind))) await requestAssist(deps, tx, { cl, kind, source: 'csapat', by: { userId: a.userId, role: a.role }, noNewCallback: true });
      // The accountant who records a call for his own client handles it himself.
      if (a.role === 'accountant') {
        const [u] = await tx.update(callbackRequests).set({ assignedUserId: a.userId, assignedAt: deps.now(), status: 'folyamatban' }).where(eq(callbackRequests.id, created.id)).returning();
        return u!;
      }
      return created;
    });
    return c.json(await detail(a, row), 201);
  });

  // ================= registrations (csapat + admin) =================
  async function regFor(c: C, forUpdate = false): Promise<RegRow> {
    const q = deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.id, param(c, 'id'))).limit(1);
    const [row] = forUpdate ? await q.for('update') : await q;
    if (!row) throw E.notFound();
    return row;
  }

  r.get('/registrations', async (c) => {
    await teamOrAdmin(c);
    const q = parseQuery(c, z.object({ status: z.enum([...REGISTRATION_STATUSES, 'nyitott', 'mind'] as [string, ...string[]]).default('nyitott'), q: z.string().trim().max(80).optional(), cursor: cursorSchema }));
    const conds: (SQL | undefined)[] = [];
    if (q.status === 'nyitott') conds.push(inArray(businessRegistrations.status, OPEN_REG));
    else if (q.status !== 'mind') conds.push(eq(businessRegistrations.status, q.status as RegistrationStatus));
    // 11-19 javító kör 2: an empty questionnaire left by the toast's "Visszavonom" is not a registration the client started.
    conds.push(or(isNull(businessRegistrations.withdrawNote), sql`${businessRegistrations.withdrawNote} <> ${WITHDRAW_NOTE_UNDO}`));
    if (q.q) {
      const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conds.push(or(ilike(clients.lastName, like), ilike(clients.firstName, like), ilike(users.email, like), ilike(sql`${clients.lastName} || ' ' || ${clients.firstName}`, like)));
    }
    const offset = Number(q.cursor ?? 0);
    const rows = await deps.db
      .select({ r: businessRegistrations })
      .from(businessRegistrations)
      .innerJoin(clients, eq(clients.id, businessRegistrations.clientId))
      .innerJoin(users, eq(users.id, clients.userId))
      .where(and(...conds))
      .orderBy(asc(businessRegistrations.statusChangedAt))
      .limit(PAGE + 1)
      .offset(offset);
    return c.json({ items: await regRows(rows.slice(0, PAGE).map((x) => x.r)), nextCursor: rows.length > PAGE ? String(offset + PAGE) : null });
  });

  r.get('/registrations/:id', async (c) => {
    await teamOrAdmin(c);
    return c.json(await regDetail(await regFor(c)));
  });

  r.patch('/registrations/:id', async (c) => {
    const a = await teamOrAdmin(c);
    const b = await readJson(
      c,
      z.strictObject({
        answers: registrationInputSchema.optional(),
        ovtjKodok: z.array(z.strictObject({ index: z.number().int().min(0).max(4), ovtjKod: z.string().trim().nullable(), ovtjNev: z.string().trim().max(200).nullable().optional() })).max(5).optional(),
        staffNote: z.string().trim().max(2000).nullable().optional(),
      }),
    );
    let wasPending = false;
    const row = await deps.db.transaction(async (tx) => {
      const [cur] = await tx.select().from(businessRegistrations).where(eq(businessRegistrations.id, param(c, 'id'))).limit(1).for('update');
      if (!cur) throw E.notFound();
      if (!OPEN_REG.includes(cur.status)) throw E.conflict('Lezárt bejelentést már nem módosíthatsz.');
      wasPending = activityPending(answersOf(cur));
      const [cl] = await tx.select().from(clients).where(eq(clients.id, cur.clientId)).limit(1);
      let answers = answersOf(cur);
      if (b.answers) answers = applyInput(answers, b.answers, { now: deps.now(), profileCity: cl?.addressCity ?? null, staff: true });
      if (b.ovtjKodok) {
        const fields: Record<string, string> = {};
        const acts = answers.activities.map((x) => ({ ...x }));
        for (const k of b.ovtjKodok) {
          if (!acts[k.index]) fields[`ovtjKodok.${k.index}`] = 'Nincs ilyen tevékenység.';
          else if (k.ovtjKod && !isValidOvtjKod(k.ovtjKod)) fields[`ovtjKodok.${k.index}`] = 'Hat számjegy kell.';
          else {
            const act = acts[k.index]!;
            act.ovtjKod = k.ovtjKod || null;
            if (k.ovtjNev !== undefined) {
              if (k.ovtjNev && act.ovtjKod) act.ovtjNev = k.ovtjNev;
              else delete act.ovtjNev;
            }
            if (!act.ovtjKod) delete act.ovtjNev;
          }
        }
        if (Object.keys(fields).length) throw E.validation(fields);
        answers = { ...answers, activities: acts };
      }
      const [u] = await tx
        .update(businessRegistrations)
        .set({ answers, ...(b.staffNote !== undefined ? { staffNote: b.staffNote } : {}), updatedAt: deps.now() })
        .where(eq(businessRegistrations.id, cur.id))
        .returning();
      await audit(tx, { action: 'registration.edited_by_staff', actorUserId: a.userId, actorRole: a.role, targetType: 'business_registration', targetId: cur.id, clientId: cur.clientId, details: { fields: Object.keys(b), answerFields: b.answers ? Object.keys(b.answers) : [] } });
      // SPEC §27.3.3: a team edit (also an ÖVTJ code) after the client's final OK needs a new OK.
      await revalidateConsent(deps, tx, cur.clientId, { userId: a.userId, role: a.role });
      return u!;
    });
    // "Megírtuk, melyik sort válaszd": the client's guide stops waiting – tell him (once per change to known).
    if (wasPending && !activityPending(answersOf(row)) && ['kitoltes', 'utmutato', 'javitas'].includes(row.status)) {
      const [cl] = await deps.db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
      // 11-19 javítás: an assisted client is never sent into the self-filing guide – he reviews and gives his OK.
      const seg = row.mode === 'segitett';
      if (cl)
        await notify(deps, deps.db, {
          userId: cl.userId,
          kind: 'registration_reminder',
          variant: seg ? 'tevekenyseg_segitett' : 'tevekenyseg',
          ...(seg ? { params: { firstName: (await accountantUserOf(deps.db, cl))?.firstName ?? 'A könyvelőd' } } : {}),
          link: seg ? '/bekotes/vallalkozas/engedely' : '/bekotes/vallalkozas/utmutato',
          data: { registrationId: row.id },
        });
    }
    return c.json(await regDetail(row));
  });

  r.post('/registrations/:id/assign', async (c) => {
    const a = await teamOrAdmin(c);
    const b = await readJson(c, z.strictObject({ userId: z.string().uuid().nullable() }));
    const row = await regFor(c);
    if (b.userId) {
      const [u] = await deps.db.select({ role: users.role, status: users.status, active: teamMembers.active }).from(users).leftJoin(teamMembers, eq(teamMembers.userId, users.id)).where(eq(users.id, b.userId)).limit(1);
      const ok = u && u.status === 'active' && (u.role === 'admin' || (u.role === 'csapat' && u.active));
      if (!ok) throw E.validation({ userId: 'Neki nem adhatod át.' });
    }
    const [u] = await deps.db.update(businessRegistrations).set({ assignedUserId: b.userId, updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id)).returning();
    await auditC(c, deps.db, 'registration.assigned', { targetType: 'business_registration', targetId: row.id, clientId: row.clientId, details: { toUserId: b.userId }, actorRole: a.role });
    return c.json(await regDetail(u!));
  });

  r.post('/registrations/:id/check', async (c) => {
    const a = await teamOrAdmin(c);
    const b = await readJson(c, z.strictObject({ items: z.array(z.enum(REGISTRATION_CHECK_ITEMS)).max(20), note: z.string().trim().max(1000).optional() }));
    const missing = REGISTRATION_CHECK_ITEMS.filter((i) => !b.items.includes(i));
    if (missing.length) throw E.validation({ items: 'Minden pontot nézz át és pipálj ki.' }, 'Minden pontot nézz át és pipálj ki.');
    // SPEC §27.3.4: four eyes – the accountant who filed it as meghatalmazott never checks his own filing.
    if ((await evFiledByOf(deps.db, param(c, 'id'))) === a.userId) throw E.forbidden('Négy szem elve: más nézze át.');
    const res = await deps.db.transaction(async (tx) => {
      const [row] = await tx.select().from(businessRegistrations).where(eq(businessRegistrations.id, param(c, 'id'))).limit(1).for('update');
      if (!row) throw E.notFound();
      if (row.status !== 'beadva') throw E.conflict('Ezt most nem lehet ellenőrizni (nincs feltöltött igazolás, vagy már ellenőrizték).');
      // Every activity needs its exact ÖVTJ line, and free text must become a coded line first (review k3c2).
      if (activityPending(answersOf(row)))
        throw E.conflict('Előbb írd be minden tevékenység ÖVTJ-kódját a Javítom gombbal. Ha a saját szavaival is leírt valamit, vedd fel tevékenységként a kóddal, és töröld a szabad szöveget.');
      const to: RegistrationStatus = row.adoszam ? 'kesz' : 'ellenorizve';
      const staffNote = b.note ? (row.staffNote ? `${row.staffNote}\n${b.note}` : b.note).slice(0, 2000) : row.staffNote;
      const u = await transition(deps, tx, row, to, { checkItems: [...REGISTRATION_CHECK_ITEMS], checkedBy: a.userId, checkedAt: deps.now(), staffNote, ...(to === 'kesz' ? { doneAt: deps.now() } : {}) }, { action: 'registration.checked', actorUserId: a.userId, actorRole: a.role });
      return { u: to === 'kesz' ? await finishRegistration(deps, tx, u) : u, to };
    });
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, res.u.clientId)).limit(1);
    if (res.to === 'kesz') await afterRegistrationDone(deps, res.u);
    else if (cl) await notify(deps, deps.db, { userId: cl.userId, kind: 'registration_checked', ...(res.u.mode === 'segitett' ? { variant: 'segitett' } : {}), link: '/bekotes/vallalkozas' });
    return c.json(await regDetail(res.u));
  });

  r.post('/registrations/:id/request-fix', async (c) => {
    const a = await teamOrAdmin(c);
    const b = await readJson(c, z.strictObject({ note: z.string().trim().min(1, { error: 'Írd le, mit javítson.' }).max(1000) }));
    const u = await deps.db.transaction(async (tx) => {
      const [row] = await tx.select().from(businessRegistrations).where(eq(businessRegistrations.id, param(c, 'id'))).limit(1).for('update');
      if (!row) throw E.notFound();
      if (row.status !== 'beadva' && row.status !== 'ellenorizve') throw E.conflict('Javítást akkor kérhetsz, ha már feltöltötte az igazolást.');
      return transition(deps, tx, row, 'javitas', { fixNote: b.note, fixRequestedAt: deps.now() }, { action: 'registration.fix_requested', actorUserId: a.userId, actorRole: a.role });
    });
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, u.clientId)).limit(1);
    if (cl) await notify(deps, deps.db, { userId: cl.userId, kind: 'registration_needs_fix', params: { note: b.note }, emailBodyKey: 'email.registration_needs_fix.body', link: '/bekotes/vallalkozas' });
    return c.json(await regDetail(u));
  });

  r.post('/registrations/:id/adoszam', async (c) => {
    // SPEC §27.3.4 table: csapat, admin AND the client's own accountant (any other accountant: 404)
    const a = await actorOf(c);
    if (a.role === 'accountant') {
      const [own] = await deps.db.select({ acc: clients.accountantId }).from(businessRegistrations).innerJoin(clients, eq(clients.id, businessRegistrations.clientId)).where(eq(businessRegistrations.id, param(c, 'id'))).limit(1);
      if (!own || own.acc !== a.accountantId) throw E.notFound();
    }
    const b = await readJson(c, z.strictObject({ adoszam: z.string().trim().max(20), evNyilvantartasiSzam: z.string().trim().regex(EV_SZAM, { error: EV_SZAM_MSG }).optional(), registeredOn: z.string().refine(isIsoDate, { error: 'Dátum kell.' }) }));
    const ck = checkRegistrationAdoszam(b.adoszam);
    if (!ck.ok) throw E.validation({ adoszam: 'Ez az adószám nem stimmel (formátum: 12345678-1-23).' });
    if (b.registeredOn > todayBudapest(deps.now())) throw E.validation({ registeredOn: 'Nem lehet a jövőben.' });
    const res = await deps.db.transaction(async (tx) => {
      const [row] = await tx.select().from(businessRegistrations).where(eq(businessRegistrations.id, param(c, 'id'))).limit(1).for('update');
      if (!row) throw E.notFound();
      if (!['beadva', 'javitas', 'ellenorizve'].includes(row.status)) throw E.conflict('Az adószámot a feltöltött igazolás után rögzítheted.');
      const patch = { adoszam: b.adoszam, registeredOn: b.registeredOn, adoszamSetBy: a.userId, ...(b.evNyilvantartasiSzam ? { evNyilvantartasiSzam: b.evNyilvantartasiSzam } : {}) };
      if (row.status === 'ellenorizve') {
        const u = await transition(deps, tx, row, 'kesz', { ...patch, doneAt: deps.now() }, { action: 'registration.adoszam_set', actorUserId: a.userId, actorRole: a.role, details: { by: 'staff', afaMentes: ck.afaMentes } });
        return { u: await finishRegistration(deps, tx, u), done: true };
      }
      const [u] = await tx.update(businessRegistrations).set({ ...patch, updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id)).returning();
      await audit(tx, { action: 'registration.adoszam_set', actorUserId: a.userId, actorRole: a.role, targetType: 'business_registration', targetId: row.id, clientId: row.clientId, details: { by: 'staff', status: row.status, afaMentes: ck.afaMentes } });
      return { u: u!, done: false };
    });
    if (res.done) await afterRegistrationDone(deps, res.u);
    return c.json(await regDetail(res.u));
  });

  // ================= onboarding message threads (csapat only) =================
  r.get('/threads', async (c) => {
    await teamOnly(c);
    const q = parseQuery(c, z.object({ cursor: cursorSchema }));
    const offset = Number(q.cursor ?? 0);
    const res = await deps.db.execute(sql`
      select c.id, c.last_name, c.first_name,
        (select max(m.created_at) from messages m where m.client_id = c.id and m.deleted_at is null) as last_at,
        (select m.body from messages m where m.client_id = c.id and m.deleted_at is null order by m.created_at desc limit 1) as last_body,
        (select count(*)::int from messages m where m.client_id = c.id and m.sender_role = 'client' and m.read_by_team_at is null and m.deleted_at is null) as unread,
        (select br.status from business_registrations br where br.client_id = c.id order by br.created_at desc limit 1) as reg_status
      from clients c
      where c.lifecycle = 'bekotes_alatt'
      order by last_at desc nulls last, c.created_at desc
      limit ${PAGE + 1} offset ${offset}`);
    const rows = (res as unknown as { rows: { id: string; last_name: string; first_name: string; last_at: string | Date | null; last_body: string | null; unread: number; reg_status: RegistrationStatus | null }[] }).rows;
    const items: TeamThreadRow[] = [];
    for (const x of rows.slice(0, PAGE)) {
      items.push({
        client: { id: x.id, name: `${x.last_name} ${x.first_name}`.trim() },
        lastMessageAt: x.last_at ? new Date(x.last_at).toISOString() : null,
        lastMessagePreview: x.last_body ? (x.last_body.length > 80 ? `${x.last_body.slice(0, 79)}…` : x.last_body) : null,
        unread: Number(x.unread),
        milestone: await milestoneOf(x.id),
        registrationStatus: x.reg_status,
      });
    }
    return c.json({ items, nextCursor: rows.length > PAGE ? String(offset + PAGE) : null });
  });

  r.get('/clients/:clientId/messages', async (c) => {
    const a = await teamOnly(c);
    const cl = await clientForTeamMessages(deps.db, param(c, 'clientId'));
    const q = parseQuery(c, z.object({ cursor: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }));
    const page = await messagePage(deps.db, cl.id, q.cursor, q.limit);
    await deps.db.update(messages).set({ readByTeamAt: deps.now() }).where(and(eq(messages.clientId, cl.id), eq(messages.senderRole, 'client'), isNull(messages.readByTeamAt)));
    await auditC(c, deps.db, 'message.thread_viewed', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { by: 'csapat' } });
    return c.json({ items: await messageDtos(deps.db, page.rows, 'csapat', '', a.userId), nextCursor: page.nextCursor });
  });

  r.post('/clients/:clientId/messages', async (c) => {
    const a = await teamOnly(c);
    const cl = await clientForTeamMessages(deps.db, param(c, 'clientId'));
    const b = await readJson(c, z.strictObject({ body: z.string().trim().max(4000).default(''), fileIds: z.array(z.string().uuid()).max(10).optional() }));
    if (!b.body && !b.fileIds?.length) throw E.validation({ body: 'Írj valamit, vagy csatolj fájlt.' });
    const msg = await deps.db.transaction(async (tx) => {
      const [m] = await tx.insert(messages).values({ clientId: cl.id, senderUserId: a.userId, senderRole: 'csapat', kind: 'szoveg', body: b.body, readByTeamAt: deps.now(), createdAt: deps.now() }).returning();
      for (const fid of b.fileIds ?? []) {
        const [f] = await tx
          .select()
          .from(files)
          .where(and(eq(files.id, fid), eq(files.kind, 'uzenet_csatolmany'), or(eq(files.ownerClientId, cl.id), and(isNull(files.ownerClientId), eq(files.createdBy, a.userId)))))
          .limit(1);
        if (!f) throw E.validation({ fileIds: 'Ismeretlen csatolmány.' });
        if (!f.ownerClientId) await tx.update(files).set({ ownerClientId: cl.id }).where(eq(files.id, f.id));
        await tx.insert(messageAttachments).values({ messageId: m!.id, fileId: f.id, displayName: f.displayName });
      }
      await auditC(c, tx, 'message.sent', { targetType: 'message', targetId: m!.id, clientId: cl.id, details: { attachments: b.fileIds?.length ?? 0, by: 'csapat' } });
      return m!;
    });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'message_new', variant: 'csapat', params: { senderName: `${a.firstName} · ügyfélszolgálat` }, link: '/uzenetek' });
    const [dto] = await messageDtos(deps.db, [msg], 'csapat', '', a.userId);
    return c.json(dto, 201);
  });

  r.post('/clients/:clientId/messages/read', async (c) => {
    await teamOnly(c);
    const cl = await clientForTeamMessages(deps.db, param(c, 'clientId'));
    const b = await readJson(c, z.strictObject({ upToId: z.string().uuid() }));
    const [m] = await deps.db.select({ at: messages.createdAt }).from(messages).where(and(eq(messages.id, b.upToId), eq(messages.clientId, cl.id))).limit(1);
    if (m) await deps.db.update(messages).set({ readByTeamAt: deps.now() }).where(and(eq(messages.clientId, cl.id), isNull(messages.readByTeamAt), sql`${messages.createdAt} <= ${m.at}`));
    return c.body(null, 204);
  });

  r.post('/attachments', async (c) => {
    const a = await teamOnly(c);
    const h = deps.limiter.hit(`upload:${a.userId}`, 600, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const body = await c.req.parseBody({ all: true });
    const clientId = typeof body.clientId === 'string' && z.string().uuid().safeParse(body.clientId).success ? body.clientId : null;
    const owner = clientId ? (await clientForTeamMessages(deps.db, clientId)).id : null;
    const f = (await collectFiles(body, 'file'))[0];
    if (!f) throw E.validation({ file: 'Nincs csatolt fájl.' });
    const ok = checkFile(f);
    const row = await deps.storage.put(deps.db, { ownerClientId: owner, kind: 'uzenet_csatolmany', mime: ok.mime, displayName: ok.displayName, data: ok.data, createdBy: a.userId, now: deps.now() });
    return c.json({ fileId: row.id }, 201);
  });

  // ================= "Intézzük helyette" + the branch change by the team (SPEC §27.2.3, §27.6, §27.9.1) =================
  registerTeamAssistRoutes(r, deps, { actorOf, teamOrAdmin, card });

  return r;
}

/** Staff views shared by /team and /acc (read-only registration for the client's accountant). */
export function teamViews(deps: Deps) {
  async function milestoneOf(clientId: string): Promise<Milestone | null> {
    const st = await onboardingState(deps, deps.db, clientId, 'accountant');
    const cur = st.milestones.find((m) => m.current);
    return cur?.key ?? (st.milestones.every((m) => m.done) ? 'kesz' : null);
  }
  async function card(cl: ClientRow) {
    const base = await teamClientCard(deps, deps.db, cl, await milestoneOf(cl.id));
    const [reg] = await deps.db.select({ mode: businessRegistrations.mode, status: businessRegistrations.status }).from(businessRegistrations).where(and(eq(businessRegistrations.clientId, cl.id), inArray(businessRegistrations.status, OPEN_REG))).limit(1);
    // 11-19 javító kör 2: "következik" from the client's own journey (as AccClientRow.onboardingJourney), not the milestones.
    let journeyNext: TeamClientCard['journeyNext'] = null;
    if (cl.lifecycle === 'bekotes_alatt') {
      try {
        const j = await journeyOf(deps, deps.db, cl);
        const cur = j.currentKey ? j.steps.find((s) => s.key === j.currentKey) : null;
        const v = j.steps.find((s) => s.state === 'var');
        const waiting = j.waiting ? `${j.waiting.title} (${v?.actorLabel ?? (j.waiting.actor === 'nav' ? 'NAV' : j.waiting.actor === 'csapat' ? 'Csapatunk' : j.waiting.actor === 'te' ? 'ügyfél' : 'könyvelő')})` : null;
        journeyNext = cur ? { title: cur.title, actorLabel: cur.actorLabel, waiting } : waiting ? { title: '', actorLabel: '', waiting } : null;
      } catch {
        journeyNext = null;
      }
    }
    return {
      ...base,
      pathHistory: await pathHistory(deps.db, cl.id),
      assist: await cardAssist(deps.db, cl.id),
      registrationMode: cl.businessStatus === 'inditas' ? (reg?.mode ?? 'onallo') : null,
      journeyNext,
    };
  }

  async function regRows(rows: RegRow[]): Promise<TeamRegistrationRow[]> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((x) => x.clientId))];
    const cls = await deps.db.select({ c: clients, email: users.email }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(inArray(clients.id, ids));
    const cbs = await deps.db.select({ id: callbackRequests.id, clientId: callbackRequests.clientId }).from(callbackRequests).where(and(inArray(callbackRequests.clientId, ids), inArray(callbackRequests.status, [...CALLBACK_OPEN_STATUSES])));
    const refs = await staffRefs(deps.db, rows.map((x) => x.assignedUserId));
    const today = todayBudapest(deps.now());
    const assists = await deps.db.select({ id: assistRequests.id, registrationId: assistRequests.registrationId, createdAt: assistRequests.createdAt }).from(assistRequests).where(inArray(assistRequests.clientId, ids));
    return rows.map((x) => {
      const cl = cls.find((y) => y.c.id === x.clientId)!;
      const a = answersOf(x);
      const main = a.activities.find((m) => m.main);
      return {
        id: x.id,
        client: { id: cl.c.id, name: clientName(cl.c), email: cl.email },
        status: x.status,
        statusSince: x.statusChangedAt.toISOString(),
        daysInStatus: Math.max(0, daysBetween(todayBudapest(x.statusChangedAt), today)),
        mainActivity: main?.label ?? a.activityFreeText ?? null,
        startPlan: a.startPlan,
        startDate: a.startDate,
        guideOpenedAt: x.guideOpenedAt?.toISOString() ?? null,
        guideProgress: { done: (x.guideProgress ?? []).length, total: GUIDE_STEP_KEYS.vallalkozas_bejelentes.length },
        filedOn: x.filedOn,
        assignee: x.assignedUserId ? (refs.get(x.assignedUserId) ?? null) : null,
        openCallbackId: cbs.find((cb) => cb.clientId === x.clientId)?.id ?? null,
        activityPending: activityPending(a),
        mode: x.mode,
        assistId: assists.filter((as) => as.registrationId === x.id).sort((p, q) => q.createdAt.getTime() - p.createdAt.getTime())[0]?.id ?? null,
        pathChangedAt: x.status === 'elallt' && x.withdrawReason === 'mar_van_vallalkozasa' && x.withdrawNote !== WITHDRAW_NOTE_UNDO ? (x.withdrawnAt?.toISOString() ?? null) : null,
      };
    });
  }

  const REG_HISTORY: Record<string, (d: Record<string, unknown>) => string> = {
    'registration.saved': () => 'Az ügyfél mentette a kérdőívet',
    'registration.submitted': (d) => (d.mode === 'segitett' ? 'Elküldte a kérdőívet (Intézzük helyette)' : 'Elküldte a kérdőívet, megkapta az útmutatót'),
    'registration.guide_opened': () => 'Megnyitotta az útmutatót',
    'registration.filed': (d) =>
      d.channel === 'meghatalmazott' ? 'A könyvelő meghatalmazottként beküldte, feltöltötte a NAV-os értesítést' : d.reupload ? 'Újra feltöltötte a NAV-os értesítést' : 'Feltöltötte a NAV-os értesítést',
    'registration.reopened': () => 'Újra megnyitotta (útvonalat váltott)',
    'registration.created': (d) => (d.mode === 'segitett' ? 'Indult (Intézzük helyette)' : 'Indult'),
    'registration.mode_changed': (d) => (d.to === 'segitett' ? 'Intézzük helyette' : 'Maga jelenti be'),
    'registration.chamber_done': () => 'Kamarai regisztráció: kész',
    'assist.ev_filed': () => 'A könyvelő meghatalmazottként beküldte (Intézzük helyette)',
    'registration.chamber_undone': () => 'Kamarai regisztráció: mégsem',
    'registration.checked': () => 'Ellenőrizve',
    'registration.fix_requested': () => 'Javítást kértünk',
    'registration.adoszam_set': (d) => (d.by === 'client' ? 'Az ügyfél beírta az adószámot' : 'Adószám rögzítve'),
    'registration.withdrawn': (d) => (d.utvaltas || d.reason === 'mar_van_vallalkozasa' ? 'Útvonalat váltott – már van vállalkozása' : 'Elállt'),
    'registration.edited_by_staff': () => 'Kolléga módosította az adatokat',
    'registration.assigned': (d) => (d.toUserId ? 'Gazdája lett' : 'Gazda nélkül'),
  };

  async function regDetail(row: RegRow): Promise<TeamRegistrationDetail> {
    const [base] = await regRows([row]);
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
    const [acc] = cl?.accountantId ? await deps.db.select({ firstName: accountants.firstName }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
    const accFirst = acc?.firstName ?? 'A könyvelő';
    const hist = await deps.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.targetType, 'business_registration'), eq(auditLog.targetId, row.id)))
      .orderBy(asc(auditLog.at), asc(auditLog.id));
    const refs = await staffRefs(deps.db, [row.checkedBy, ...hist.map((h) => h.actorUserId)]);
    const f = await filedDoc(deps.db, row);
    return {
      ...base!,
      answers: answersOf(row),
      hints: await computeHints(deps, answersOf(row), accFirst),
      clientCard: await card(cl!),
      filed: row.filedOn && row.filedChannel && f ? { filedOn: row.filedOn, channel: row.filedChannel, documentId: f.documentId, fileId: f.fileId, mime: f.mime, uploadedAt: f.uploadedAt } : null,
      checkItems: (row.checkItems ?? []) as TeamRegistrationDetail['checkItems'],
      checkedBy: row.checkedBy ? (refs.get(row.checkedBy) ?? null) : null,
      checkedAt: row.checkedAt?.toISOString() ?? null,
      fixNote: row.fixNote,
      adoszam: row.adoszam,
      evNyilvantartasiSzam: row.evNyilvantartasiSzam,
      registeredOn: row.registeredOn,
      staffNote: row.staffNote,
      // Read-only, for the check item "Név, lakcím rendben" (SPEC §26.4 allows it for this purpose).
      clientProfile: { name: cl ? clientName(cl) : '', address: cl?.addressZip ? { zip: cl.addressZip, city: cl.addressCity ?? '', line: cl.addressLine ?? '' } : null },
      history: hist
        .filter((h) => REG_HISTORY[h.action])
        .map((h) => ({ at: h.at.toISOString(), by: h.actorUserId ? (refs.get(h.actorUserId) ?? null) : null, action: h.action, text: REG_HISTORY[h.action]!((h.details ?? {}) as Record<string, unknown>) })),
    };
  }

  return { milestoneOf, card, regRows, regDetail };
}
