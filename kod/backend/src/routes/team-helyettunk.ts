// /team additions of SPEC §27 (owner orders 11-19): the "Intézzük helyette" queue and its actions (csapat, admin, and
// the client's OWN accountant – any other accountant gets 404), and the branch change the team makes after a callback.
// Role rules: ASSIST_ACTION_ROLES (services/assist.ts enforces them; tests in test/tulaj1119-helyettunk.test.ts).
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Page, TeamAssistDetail, TeamAssistRow, TeamClientCard, TeamSummary } from '../_shared/api.js';
import { ASSIST_BALL, ASSIST_CHECK_ITEMS, ASSIST_CLOSE_REASONS, ASSIST_JOGCIMEK, ASSIST_KINDS, ASSIST_OPEN_STATUSES, BUSINESS_STATUSES, type AssistCheckItem, type AssistStatus } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { assistRequests, clients, users } from '../db/schema.js';
import { collectFiles } from '../files/upload.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { addDays, isIsoDate, todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { audit } from '../audit.js';
import {
  agreed,
  assignAssist,
  assistForStaff,
  closeAssist,
  expiredByStaff,
  markEvFiled,
  mhLive,
  notifyEvFiled,
  patchAssist,
  prepareEvFiled,
  requestAssist,
  teamAssistDetail,
  teamAssistRows,
  ujegykeFiled,
  type AssistActorKind,
  type AssistRow,
} from '../services/assist.js';
import { createDocument } from '../services/documents.js';
import { applyPathChange, blockedError, notifyPathChanged, pathBlocker } from '../services/pathchange.js';
import { checkRegistrationAdoszam, transition } from '../services/registration.js';
import { clientForStaff, type StaffActor } from '../services/team.js';
import type { ClientRow } from '../services/people.js';
import { onLeaveInditas } from '../services/assist.js';

const ALL_ITEMS = [...ASSIST_CHECK_ITEMS.hivas, ...ASSIST_CHECK_ITEMS.ujegyke, ...ASSIST_CHECK_ITEMS.bejelentes] as [AssistCheckItem, ...AssistCheckItem[]];
const OPEN = [...ASSIST_OPEN_STATUSES] as AssistStatus[];
const EV_SZAM = /^\d{8}$/;
const PAGE = 50;

function actorKind(a: StaffActor): AssistActorKind {
  return a.role === 'accountant' ? 'konyvelo' : a.role === 'admin' ? 'admin' : 'csapat';
}

/** TeamSummary.assists: `waitingOnMe` = ball on the caller's role (accountant: his clients only). */
export async function assistSummary(deps: Deps, a: StaffActor): Promise<NonNullable<TeamSummary['assists']>> {
  const rows = await deps.db
    .select({ status: assistRequests.status, assigned: assistRequests.assignedUserId, due: assistRequests.approvalDueOn, acc: clients.accountantId })
    .from(assistRequests)
    .innerJoin(clients, eq(clients.id, assistRequests.clientId))
    .where(and(inArray(assistRequests.status, OPEN), a.role === 'accountant' ? eq(clients.accountantId, a.accountantId ?? '00000000-0000-0000-0000-000000000000') : sql`true`));
  const today = todayBudapest(deps.now());
  const myBall = a.role === 'accountant' ? 'konyvelo' : 'csapat';
  return {
    open: rows.length,
    waitingOnMe: rows.filter((r) => ASSIST_BALL[r.status] === myBall || (a.role === 'admin' && ASSIST_BALL[r.status] === 'konyvelo' && r.acc === a.accountantId)).length,
    approvalOverdue: rows.filter((r) => r.status === 'meghatalmazas_lejart' || (r.status === 'meghatalmazas_bekuldve' && r.due !== null && r.due <= today)).length,
    mine: rows.filter((r) => r.assigned === a.userId).length,
  };
}

export function registerTeamAssistRoutes(
  r: Hono<Env>,
  deps: Deps,
  h: { actorOf: (c: C) => Promise<StaffActor>; teamOrAdmin: (c: C) => Promise<StaffActor>; card: (cl: ClientRow) => Promise<TeamClientCard> },
): void {
  async function detail(a: StaffActor, row: AssistRow): Promise<TeamAssistDetail> {
    const { cl, kind } = await assistForStaff(deps, deps.db, a, row.id);
    return teamAssistDetail(deps, deps.db, a, row, kind, await h.card(cl));
  }

  // ---------- queue ----------
  r.get('/assists', async (c) => {
    const a = await h.actorOf(c);
    const q = parseQuery(
      c,
      z.object({
        filter: z.enum(['nyitott', 'nalam', 'ugyfelre_var', 'lejart', 'kesz', 'mind']).default('nyitott'),
        kind: z.enum(ASSIST_KINDS).optional(),
        q: z.string().trim().max(80).optional(),
        cursor: z.string().regex(/^\d{1,6}$/).optional(),
      }),
    );
    const conds: (SQL | undefined)[] = [];
    if (a.role === 'accountant') conds.push(eq(clients.accountantId, a.accountantId ?? '00000000-0000-0000-0000-000000000000'));
    if (a.role === 'csapat') conds.push(or(inArray(assistRequests.status, OPEN), sql`coalesce(${assistRequests.closedAt}, ${assistRequests.updatedAt}) > ${new Date(deps.now().getTime() - 90 * 86_400_000).toISOString()}::timestamptz`));
    const today = todayBudapest(deps.now());
    if (q.filter === 'nyitott') conds.push(inArray(assistRequests.status, OPEN));
    if (q.filter === 'nalam') {
      const ball = a.role === 'accountant' ? 'konyvelo' : 'csapat';
      const mine = inArray(assistRequests.status, OPEN.filter((s) => ASSIST_BALL[s] === ball));
      // an admin who is also the client's accountant has the 'konyvelo' ball of those clients too (B3 §24 note)
      conds.push(
        a.role === 'admin' && a.accountantId
          ? or(mine, and(inArray(assistRequests.status, OPEN.filter((s) => ASSIST_BALL[s] === 'konyvelo')), eq(clients.accountantId, a.accountantId)))
          : mine,
      );
    }
    if (q.filter === 'ugyfelre_var') conds.push(inArray(assistRequests.status, OPEN.filter((s) => ASSIST_BALL[s] === 'ugyfel')));
    if (q.filter === 'lejart') conds.push(or(eq(assistRequests.status, 'meghatalmazas_lejart'), and(eq(assistRequests.status, 'meghatalmazas_bekuldve'), sql`${assistRequests.approvalDueOn} < ${today}::date`)));
    if (q.filter === 'kesz') conds.push(eq(assistRequests.status, 'kesz'));
    if (q.kind) conds.push(eq(assistRequests.kind, q.kind));
    if (q.q) {
      const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conds.push(or(ilike(clients.lastName, like), ilike(clients.firstName, like), ilike(users.email, like), ilike(sql`${clients.lastName} || ' ' || ${clients.firstName}`, like)));
    }
    const rows = await deps.db
      .select({ a: assistRequests })
      .from(assistRequests)
      .innerJoin(clients, eq(clients.id, assistRequests.clientId))
      .innerJoin(users, eq(users.id, clients.userId))
      .where(and(...conds))
      .orderBy(desc(assistRequests.createdAt))
      .limit(1000);
    const views = await teamAssistRows(deps, deps.db, rows.map((x) => x.a));
    // Overdue first, then the nearest next deadline; finished ones last (newest first).
    views.sort((x, y) => {
      const ox = x.nextDue?.overdue ? 0 : x.nextDue ? 1 : 2;
      const oy = y.nextDue?.overdue ? 0 : y.nextDue ? 1 : 2;
      if (ox !== oy) return ox - oy;
      if (x.nextDue && y.nextDue) return x.nextDue.at.localeCompare(y.nextDue.at);
      return y.createdAt.localeCompare(x.createdAt);
    });
    const offset = Number(q.cursor ?? 0);
    const page: Page<TeamAssistRow> = { items: views.slice(offset, offset + PAGE), nextCursor: views.length > offset + PAGE ? String(offset + PAGE) : null };
    return c.json(page);
  });

  r.get('/assists/:id', async (c) => {
    const a = await h.actorOf(c);
    const { row } = await assistForStaff(deps, deps.db, a, param(c, 'id'));
    return c.json(await detail(a, row));
  });

  // ---------- create for a client (links the open callback, if any) ----------
  r.post('/clients/:clientId/assists', async (c) => {
    const a = await h.actorOf(c);
    const cl = await clientForStaff(deps, deps.db, a, param(c, 'clientId'));
    const b = await readJson(
      c,
      z.strictObject({
        kind: z.enum(ASSIST_KINDS),
        note: z.string().trim().max(500).optional(),
        agreed: z.strictObject({ items: z.array(z.enum(ALL_ITEMS)).max(30), note: z.string().trim().max(1000).optional() }).optional(),
      }),
    );
    if (cl.lifecycle !== 'bekotes_alatt') throw E.conflict('Az ügyfél bekötése már kész.');
    const row = await deps.db.transaction(async (tx) => {
      const res = await requestAssist(deps, tx, { cl, kind: b.kind, source: 'csapat', note: b.note ?? null, by: { userId: a.userId, role: a.role }, noNewCallback: true });
      return b.agreed ? agreed(deps, tx, a, res.row.id, b.agreed) : res.row;
    });
    return c.json(await detail(a, row), 201);
  });

  // ---------- state changes ----------
  r.post('/assists/:id/agreed', async (c) => {
    const a = await h.actorOf(c);
    const b = await readJson(c, z.strictObject({ items: z.array(z.enum(ALL_ITEMS)).max(30), note: z.string().trim().max(1000).optional() }));
    const row = await deps.db.transaction((tx) => agreed(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  r.post('/assists/:id/ujegyke-filed', async (c) => {
    const a = await h.actorOf(c);
    const b = await readJson(c, z.strictObject({ items: z.array(z.enum(ALL_ITEMS)).max(30), jogcim: z.enum(ASSIST_JOGCIMEK), filedAt: z.string().datetime({ offset: true }).optional() }));
    const row = await deps.db.transaction((tx) => ujegykeFiled(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  r.post('/assists/:id/expired', async (c) => {
    const a = await h.actorOf(c);
    await readJson(c, z.strictObject({}));
    const row = await deps.db.transaction((tx) => expiredByStaff(deps, tx, a, param(c, 'id')));
    return c.json(await detail(a, row));
  });

  r.post('/assists/:id/mh-live', async (c) => {
    const a = await h.actorOf(c);
    await readJson(c, z.strictObject({}));
    const row = await deps.db.transaction((tx) => mhLive(deps, tx, a, param(c, 'id')));
    const { checkCompletion } = await import('../services/onboarding.js');
    await checkCompletion(deps, deps.db, row.clientId);
    return c.json(await detail(a, row));
  });

  /** Multipart: `file` (the NAV értesítés PDF/image) + items (JSON array or repeated), filedOn, adoszam?, evNyilvantartasiSzam?. */
  r.post('/assists/:id/ev-filed', async (c) => {
    const a = await h.actorOf(c);
    const h0 = deps.limiter.hit(`upload:${a.userId}`, 600, 3600_000);
    if (!h0.ok) throw E.rateLimited(h0.retryAfterSec);
    const body = await c.req.parseBody({ all: true });
    const rawItems = body.items;
    let items: unknown = Array.isArray(rawItems) ? rawItems : typeof rawItems === 'string' ? rawItems : [];
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = [items];
      }
    }
    const today = todayBudapest(deps.now());
    const meta = z
      .strictObject({
        items: z.array(z.enum(ALL_ITEMS)).max(30),
        filedOn: z.string().refine((v) => isIsoDate(v) && v <= today && v >= addDays(today, -60), { error: 'Az elmúlt 60 nap egyik napja lehet.' }),
        adoszam: z.string().trim().max(20).optional(),
        evNyilvantartasiSzam: z.string().trim().regex(EV_SZAM, { error: 'A nyilvántartási szám 8 számjegy.' }).optional(),
      })
      .safeParse({ items, filedOn: body.filedOn, adoszam: body.adoszam || undefined, evNyilvantartasiSzam: body.evNyilvantartasiSzam || undefined });
    if (!meta.success) throw E.validation(Object.fromEntries(meta.error.issues.map((i) => [i.path.join('.') || '_', i.message && !/^Invalid/.test(i.message) ? i.message : 'Hibás vagy hiányzó érték.'])));
    if (meta.data.adoszam) {
      const ck = checkRegistrationAdoszam(meta.data.adoszam);
      if (!ck.ok) throw E.validation({ adoszam: 'Ez az adószám nem stimmel (formátum: 12345678-1-23).' });
      if (!ck.afaMentes) throw E.validation({ adoszam: await deps.content.render('vallalkozas.adoszam.nem_afamentes', {}) });
    }
    const filesIn = await collectFiles(body, 'file');
    if (!filesIn.length) throw E.validation({ file: 'Töltsd fel a NAV-os értesítést (PDF vagy fotó).' });
    const res = await deps.db.transaction(async (tx) => {
      const p = await prepareEvFiled(deps, tx, a, param(c, 'id'), meta.data.items);
      const d = await createDocument(deps, tx, {
        clientId: p.cl.id,
        source: 'konyvelo',
        category: 'ev_bejelentes',
        dossierMonth: meta.data.filedOn.slice(0, 7),
        title: 'NAV-os értesítés a vállalkozás bejelentéséről',
        createdBy: a.userId,
        files: filesIn.slice(0, 1),
        pages: [],
        actorRole: a.role,
        visibility: 'kozos',
      });
      await transition(
        deps,
        tx,
        p.reg,
        'beadva',
        {
          filedOn: meta.data.filedOn,
          filedChannel: 'meghatalmazott',
          filedDocumentId: d.id,
          filedAt: deps.now(),
          fixNote: null,
          ...(meta.data.adoszam ? { adoszam: meta.data.adoszam, adoszamSetBy: a.userId } : {}),
          ...(meta.data.evNyilvantartasiSzam ? { evNyilvantartasiSzam: meta.data.evNyilvantartasiSzam } : {}),
        },
        { action: 'registration.filed', actorUserId: a.userId, actorRole: a.role, details: { channel: 'meghatalmazott', withAdoszam: Boolean(meta.data.adoszam) } },
      );
      const row = await markEvFiled(deps, tx, a, p.row, p.checklist);
      return { row, cl: p.cl, regId: p.reg.id };
    });
    await notifyEvFiled(deps, deps.db, res.cl, res.row, res.regId, a.userId);
    return c.json(await detail(a, res.row));
  });

  r.post('/assists/:id/close', async (c) => {
    const a = await h.actorOf(c);
    const b = await readJson(c, z.strictObject({ reason: z.enum(ASSIST_CLOSE_REASONS), note: z.string().trim().max(1000).optional() }));
    const row = await deps.db.transaction((tx) => closeAssist(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  r.post('/assists/:id/assign', async (c) => {
    const a = await h.teamOrAdmin(c);
    const b = await readJson(c, z.strictObject({ userId: z.string().uuid().nullable() }));
    const row = await deps.db.transaction((tx) => assignAssist(deps, tx, a, param(c, 'id'), b.userId));
    return c.json(await detail(a, row));
  });

  r.patch('/assists/:id', async (c) => {
    const a = await h.actorOf(c);
    const b = await readJson(c, z.strictObject({ staffNote: z.string().max(2000).nullable().optional(), check: z.array(z.strictObject({ item: z.enum(ALL_ITEMS), done: z.boolean() })).max(30).optional() }));
    const row = await deps.db.transaction((tx) => patchAssist(deps, tx, a, param(c, 'id'), b));
    return c.json(await detail(a, row));
  });

  // ---------- the branch change after a callback (csapat, admin; SPEC §27.2.3) ----------
  r.post('/clients/:clientId/path', async (c) => {
    const a = await h.teamOrAdmin(c);
    const cl = await clientForStaff(deps, deps.db, a, param(c, 'clientId'));
    const b = await readJson(c, z.strictObject({ businessStatus: z.enum(BUSINESS_STATUSES), note: z.string().trim().min(1, { error: 'Írd le röviden, miért.' }).max(500), clearAdoszam: z.boolean().optional() }));
    // 11-19 javító kör 2: the same path again. Only a late "delete the adószám too" (an 'inditas' client who still has
    // an adószám from the earlier van path) does something; anything else is a 409 instead of a silent 200.
    if (cl.businessStatus === b.businessStatus) {
      if (!(b.businessStatus === 'inditas' && b.clearAdoszam && cl.adoszam)) throw E.conflict('Már ezen az úton van.');
      if (cl.lifecycle !== 'bekotes_alatt') throw await blockedError(deps, 'nem_bekotes_alatt');
      await deps.db.transaction(async (tx) => {
        await tx.update(clients).set({ adoszam: null, updatedAt: deps.now() }).where(eq(clients.id, cl.id));
        await audit(tx, { action: 'team.path_changed', actorUserId: a.userId, actorRole: a.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { from: cl.businessStatus, to: b.businessStatus, clearedAdoszam: cl.adoszam, note: 'csak_adoszam_torles' } });
      });
      const [fresh] = await deps.db.select().from(clients).where(eq(clients.id, cl.id)).limit(1);
      return c.json(await h.card(fresh!));
    }
    // The team may override 'adoszam_megadva' and 'bejelentes_engedelyezve' – never a filing at NAV or a finished onboarding.
    const blocker = await pathBlocker(deps.db, cl, b.businessStatus);
    if (blocker === 'nem_bekotes_alatt' || blocker === 'bejelentes_bekuldve') throw await blockedError(deps, blocker);
    const res = await deps.db.transaction(async (tx) => {
      if (blocker === 'bejelentes_engedelyezve') await onLeaveInditas(deps, tx, cl.id, { userId: a.userId, role: a.role });
      return applyPathChange(deps, tx, cl, b.businessStatus, { userId: a.userId, role: a.role === 'admin' ? 'admin' : 'csapat' }, { note: b.note, clearAdoszam: Boolean(b.clearAdoszam && cl.adoszam) });
    });
    await notifyPathChanged(deps, deps.db, cl, res, a.userId);
    const [fresh] = await deps.db.select().from(clients).where(eq(clients.id, cl.id)).limit(1);
    void actorKind;
    void auth;
    return c.json(await h.card(fresh!));
  });
}
