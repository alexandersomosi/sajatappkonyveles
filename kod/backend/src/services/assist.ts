// SPEC §27.3 "Intézzük helyetted" (assisted path). Self-service stays the default; on request (a callback first) our
// accountant files the UJEGYKE meghatalmazás as the client's meghatalmazott – and, kind 'vallalkozas_bejelentes', the EV
// bejelentés – with HIS OWN KAÜ login. We never ask for, store or use the client's Ügyfélkapu+/DÁP login: no input,
// column or log line of this module holds one. The client approves in ONYA himself, and gives his final, written OK for
// the EV bejelentés in the app (consent + instruction PDF). One row per request (assist_requests), one function per
// state change (each audited 'assist.<action>'), one view builder for the client (assistView) and one for the panel
// (teamAssistDetail); allowed actions come from ASSIST_ACTION_ROLES + the status.
import { fmt as fmtHuf } from './kedvezmeny.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AssistConsentSummary, AssistView, TeamAssistDetail, TeamAssistRow } from '../_shared/api.js';
import { activityPending, activityShortLine, WORK_KIND_GUIDE_VALUE } from '../_shared/bekotes.js';
import {
  ASSIST_ACTION_ROLES,
  ASSIST_BALL,
  ASSIST_CALLBACK_TOPIC,
  ASSIST_CANCELLABLE_STATUSES,
  ASSIST_CHECK_ITEMS,
  ASSIST_CHECK_LABELS,
  ASSIST_CHECK_NOT_FOR_MH,
  ASSIST_KIND_LABELS,
  ASSIST_OPEN_STATUSES,
  ASSIST_PHASES,
  ASSIST_RULES,
  ASSIST_STATUS_LABELS,
  type AssistAction,
  type AssistCheckItem,
  type AssistCheckPhase,
  type AssistCloseReason,
  type AssistJogcim,
  type AssistKind,
  type AssistStatus,
  type CallbackSource,
  type CallbackWindow,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, assistRequests, auditLog, businessRegistrations, callbackAttempts, callbackRequests, clients, onboardingSteps } from '../db/schema.js';
import { audit } from '../audit.js';
import { ApiError, E } from '../lib/errors.js';
import { addDays, budapestLocalToUtc, daysBetween, huDayMonth, huDayMonthIg, todayBudapest } from '../lib/dates.js';
import { addWorkingDays } from '../lib/munkanap.js';
import { sha256Hex } from '../lib/crypto.js';
import { maskAdoazonosito } from '../lib/validators.js';
import { markdownToPdf } from '../lib/pdf.js';
import { fillLegal, legalValuesFromConfig } from '../legal.js';
import { notify } from '../notify/notify.js';
import { assignableFor, createCallback, openCallbackOf } from './callbacks.js';
import { createDocumentFromBuffer } from './system-docs.js';
import { checkCompletion, setStep, stepLockKeys, steps } from './onboarding.js';
import { accountantPublic, clientName, type ClientRow } from './people.js';
import { answersOf, FILED_OR_LATER, missingFields, openRegistrationOf, type RegRow } from './registration.js';
import { accountantUserOf, notifyQueueOwners, staffRefs, type StaffActor } from './team.js';
import { ugykorok } from './guides.js';

export type AssistRow = typeof assistRequests.$inferSelect;
export const OPEN_ASSIST: AssistStatus[] = [...ASSIST_OPEN_STATUSES];
/** The UJEGYKE exists at NAV (filed by our accountant) – a cancel converts instead of cancelling. */
export const UJEGYKE_FILED: AssistStatus[] = ['meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte'];
/**
 * jogi `ev_bejelentes_utasitas` version (SPEC §27.10): kod/jogi/sablonok/sablonok.json when present (B4: "2026-11-19"),
 * else this fallback.
 */
export const EV_UTASITAS_VERSION_FALLBACK = '2026-11-19';
let utasitasVersion: { dir: string; v: string } | null = null;
export function evUtasitasVersion(deps: Deps): string {
  if (utasitasVersion?.dir === deps.cfg.legalDir) return utasitasVersion.v;
  let v = EV_UTASITAS_VERSION_FALLBACK;
  try {
    const list = JSON.parse(readFileSync(join(deps.cfg.legalDir, 'sablonok', 'sablonok.json'), 'utf8')) as { nev?: string; version?: string }[];
    const hit = list.find((x) => x.nev === 'ev_bejelentes_utasitas');
    if (hit?.version && /^[0-9A-Za-z.-]{4,40}$/.test(hit.version)) v = hit.version;
  } catch {
    /* fallback */
  }
  utasitasVersion = { dir: deps.cfg.legalDir, v };
  return v;
}
/** The two ügycsoportok an EV assist needs (neither covers the other; UJEGYKE GYIK q.6, q.25). */
export const EV_UGYCSOPORTOK = ['ADÓÜGYEK (kivéve egyes jövedéki ügyek)', 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)'];

/** 409 codes of §27.9.1 (the shared ASSIST_ERROR_CODES). */
export const assistErr = {
  alreadyOpen: (assist: AssistView) => new ApiError(409, 'assist_already_open', 'Ezt már kérted. Kollégánk hamarosan hív.', undefined, { assist }),
  wrongStatus: (message: string) => new ApiError(409, 'assist_wrong_status', message),
  checklist: (missing: string[]) =>
    new ApiError(400, 'assist_checklist_incomplete', 'Előbb pipáld ki az összes pontot.', Object.fromEntries(missing.map((m) => [m, 'Pipáld ki.']))),
  stale: (message: string) => new ApiError(409, 'assist_consent_stale', message),
  disabled: (message: string) => new ApiError(409, 'assist_disabled', message),
};

export function isOpenAssist(s: AssistStatus): boolean {
  return OPEN_ASSIST.includes(s);
}

/** The EV part is offered (kill switch on and before the register moves to the chamber). */
export function evEnabled(deps: Deps): boolean {
  return deps.cfg.assist.evEnabled && todayBudapest(deps.now()) <= deps.cfg.assist.evValidUntil;
}

export async function openAssistOf(db: DbOrTx, clientId: string, kind?: AssistKind): Promise<AssistRow | null> {
  const [r] = await db
    .select()
    .from(assistRequests)
    .where(and(eq(assistRequests.clientId, clientId), inArray(assistRequests.status, OPEN_ASSIST), kind ? eq(assistRequests.kind, kind) : sql`true`))
    .orderBy(desc(assistRequests.createdAt))
    .limit(1);
  return r ?? null;
}

/** Open ones first (newest first), then the last closed one per kind (SPEC §27.3 OnboardingState.assists). */
export async function assistsOfClient(db: DbOrTx, clientId: string): Promise<AssistRow[]> {
  const rows = await db.select().from(assistRequests).where(eq(assistRequests.clientId, clientId)).orderBy(desc(assistRequests.createdAt));
  const open = rows.filter((r) => isOpenAssist(r.status));
  const closed: AssistRow[] = [];
  for (const r of rows) if (!isOpenAssist(r.status) && !open.some((o) => o.kind === r.kind) && !closed.some((c) => c.kind === r.kind)) closed.push(r);
  return [...open, ...closed];
}

async function lockAssist(db: DbOrTx, id: string): Promise<AssistRow> {
  const [r] = await db.select().from(assistRequests).where(eq(assistRequests.id, id)).limit(1).for('update');
  if (!r) throw E.notFound();
  return r;
}

async function clientRow(db: DbOrTx, id: string): Promise<ClientRow> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!cl) throw E.notFound();
  return cl;
}

async function accFirstName(db: DbOrTx, cl: Pick<ClientRow, 'accountantId'>): Promise<string> {
  const a = await accountantUserOf(db, cl);
  return a?.firstName ?? 'A könyvelőd';
}

function assistAudit(db: DbOrTx, row: AssistRow, action: string, by: { userId: string | null; role: string }, details?: Record<string, unknown>) {
  return audit(db, { action: `assist.${action}`, actorUserId: by.userId, actorRole: by.role, targetType: 'assist', targetId: row.id, clientId: row.clientId, details: { kind: row.kind, from: row.status, ...(details ?? {}) } });
}

async function update(deps: Deps, db: DbOrTx, row: AssistRow, patch: Partial<AssistRow>): Promise<AssistRow> {
  const now = deps.now();
  const [u] = await db
    .update(assistRequests)
    .set({ ...patch, ...(patch.status && patch.status !== row.status ? { statusChangedAt: now } : {}), updatedAt: now })
    .where(eq(assistRequests.id, row.id))
    .returning();
  return u!;
}

// ---------------------------------------------------------------------------------------------------------------
// the client's view
// ---------------------------------------------------------------------------------------------------------------
export function approvalInfo(deps: Deps, row: AssistRow): AssistView['approval'] {
  if (!row.ujegykeFiledAt || !row.approvalDueOn) return null;
  const today = todayBudapest(deps.now());
  return {
    filedAt: row.ujegykeFiledAt.toISOString(),
    dueOn: row.approvalDueOn,
    dueText: huDayMonthIg(row.approvalDueOn),
    daysLeft: Math.max(0, daysBetween(today, row.approvalDueOn)),
    lastDay: today >= row.approvalDueOn,
    afterDue: today > row.approvalDueOn,
    expiredCount: row.expiredCount,
  };
}

/** Questionnaire submitted, complete, every activity has its ÖVTJ line: the final review may be sent. */
function questionnaireReady(reg: RegRow | null, adatokDone: boolean): boolean {
  if (!reg || reg.status !== 'utmutato') return false;
  const a = answersOf(reg);
  return missingFields(a, { adatokDone }).length === 0 && !activityPending(a);
}

const CONSENT_STATUSES: AssistStatus[] = ['visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el'];

export async function assistView(deps: Deps, db: DbOrTx, row: AssistRow, o: { accFirstName?: string } = {}): Promise<AssistView> {
  const cl = await clientRow(db, row.clientId);
  const fn = o.accFirstName ?? (await accFirstName(db, cl));
  const approval = approvalInfo(deps, row);
  const reasonText = row.closedReason ? await deps.content.render(`helyettunk.lezaras_ok.${row.closedReason}`, {}) : '';
  const mhKey = `helyettunk.allapot.${row.status}.mh`;
  let key = row.kind === 'meghatalmazas' && (await deps.content.exists(mhKey)) ? mhKey : `helyettunk.allapot.${row.status}`;
  // 11-19 javítás: before the UJEGYKE the client may be the one who is still owed something (contract, adóazonosító jel).
  const ready = row.status === 'egyeztetve' || row.status === 'meghatalmazas_lejart' ? await readyForUjegyke(db, cl) : true;
  if (row.status === 'egyeztetve' && ready && (await deps.content.exists('helyettunk.allapot.egyeztetve.kesz'))) key = 'helyettunk.allapot.egyeztetve.kesz';
  // After the shown due day (NAV's 4 × 24 h still running) a past "november 22-ig" would be wrong: "még ma".
  // A change assist (valtozas_*) has its own client texts (valtozas.allapot.<status>, with the fee in {dij}); every route
  // that shows an assist gets them, not the new-business ones (k6c review: "({dij} Ft)" raw, "Beszéltünk…" after payment).
  let dij = '';
  if (row.kind.startsWith('valtozas_') && row.feeChargeId) {
    const { chargeById } = await import('./dijak.js');
    const ch = await chargeById(db, row.feeChargeId);
    dij = ch ? fmtHuf(ch.amountHuf) : '';
  }
  if (row.kind.startsWith('valtozas_') && (await deps.content.exists(`valtozas.allapot.${row.status}`))) key = `valtozas.allapot.${row.status}`;
  const statusText = await deps.content.render(key, { firstName: fn, hatarido: approval ? (approval.afterDue ? 'még ma' : approval.dueText) : '', date: approval ? huDayMonth(approval.dueOn) : '', reasonText, dij });
  let canConsent = false;
  if (row.kind === 'vallalkozas_bejelentes' && CONSENT_STATUSES.includes(row.status) && !row.consentValid) {
    const reg = await registrationOfAssist(db, row);
    const st = await steps(db, row.clientId);
    canConsent = questionnaireReady(reg, st.get('adatok')?.status === 'kesz');
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    statusText,
    ball: ready ? ASSIST_BALL[row.status] : 'ugyfel',
    callbackId: row.callbackId,
    createdAt: row.createdAt.toISOString(),
    approval,
    clientApprovedAt: row.clientApprovedAt?.toISOString() ?? null,
    meghatalmazasLiveAt: row.mhLiveAt?.toISOString() ?? null,
    consent: row.consentAt ? { at: row.consentAt.toISOString(), valid: row.consentValid } : null,
    canConsent,
    evFiledAt: row.evFiledAt?.toISOString() ?? null,
    canCancel: ASSIST_CANCELLABLE_STATUSES.includes(row.status),
    closedReason: row.closedReason,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

async function registrationOfAssist(db: DbOrTx, row: AssistRow): Promise<RegRow | null> {
  if (row.registrationId) {
    const [r] = await db.select().from(businessRegistrations).where(eq(businessRegistrations.id, row.registrationId)).limit(1);
    if (r && r.status !== 'elallt') return r;
  }
  return openRegistrationOf(db, row.clientId);
}

// ---------------------------------------------------------------------------------------------------------------
// the meghatalmazás step follows the assist (SPEC §27.3.4 table, column "Step rows")
// ---------------------------------------------------------------------------------------------------------------
async function syncMhStep(deps: Deps, db: DbOrTx, row: AssistRow): Promise<void> {
  const st = await steps(db, row.clientId);
  const cur = st.get('meghatalmazas');
  if (cur?.status === 'kesz' && row.status !== 'kesz' && row.status !== 'meghatalmazas_el') return;
  const prev = (cur?.data ?? {}) as Record<string, unknown>;
  const base = { ...prev, method: 'onya_konyvelo', assistId: row.id, submittedAt: (row.agreedAt ?? row.createdAt).toISOString() };
  const withApproval = row.clientApprovedAt ? { ...base, clientApprovedAt: row.clientApprovedAt.toISOString() } : base;
  switch (row.status) {
    case 'egyeztetve':
      return setStep(deps, db, row.clientId, 'meghatalmazas', 'konyvelore_var', { data: base, note: null });
    case 'meghatalmazas_bekuldve':
    case 'meghatalmazas_lejart':
      return setStep(deps, db, row.clientId, 'meghatalmazas', 'ugyfelre_var', { data: base, note: null });
    case 'meghatalmazas_jovahagyva':
      return setStep(deps, db, row.clientId, 'meghatalmazas', 'konyvelore_var', { data: withApproval, note: null });
    case 'meghatalmazas_el':
    case 'ugyfel_engedelyezte':
    case 'bejelentes_bekuldve':
      if (row.mhLiveAt && cur?.status !== 'kesz') return setStep(deps, db, row.clientId, 'meghatalmazas', 'kesz', { data: withApproval, note: null });
      return;
    case 'kesz':
      if (cur?.status !== 'kesz' && row.mhLiveAt) return setStep(deps, db, row.clientId, 'meghatalmazas', 'kesz', { data: withApproval, note: null });
      return;
    case 'visszavonva':
    case 'lezarva': {
      // The client takes it back: the self-service rows return (the guide progress is kept).
      if (cur && cur.status !== 'kesz' && prev.method === 'onya_konyvelo') {
        const { method: _m, assistId: _a, submittedAt: _s, clientApprovedAt: _c, ...rest } = prev;
        void _m;
        void _a;
        void _s;
        void _c;
        return setStep(deps, db, row.clientId, 'meghatalmazas', 'ugyfelre_var', { data: rest, note: null });
      }
      return;
    }
    default:
      return;
  }
}

/** Registration mode of an EV assist: 'segitett' while it is open, back to 'onallo' when it ends without filing. */
async function setRegistrationMode(deps: Deps, db: DbOrTx, clientId: string, mode: 'onallo' | 'segitett'): Promise<RegRow | null> {
  const reg = await openRegistrationOf(db, clientId);
  if (!reg || reg.mode === mode) return reg;
  const [u] = await db.update(businessRegistrations).set({ mode, updatedAt: deps.now() }).where(eq(businessRegistrations.id, reg.id)).returning();
  await audit(db, { action: 'registration.mode_changed', actorRole: 'system', targetType: 'business_registration', targetId: reg.id, clientId, details: { from: reg.mode, to: mode } });
  return u ?? reg;
}

// ---------------------------------------------------------------------------------------------------------------
// create (client: POST /client/assist; staff: POST /team/clients/:id/assists)
// ---------------------------------------------------------------------------------------------------------------
export interface AssistRequestInput {
  cl: ClientRow;
  kind: AssistKind;
  source: CallbackSource;
  phone?: string;
  window?: CallbackWindow;
  note?: string | null;
  savePhoneToProfile?: boolean;
  by: { userId: string | null; role: 'client' | 'csapat' | 'admin' | 'accountant' | 'system' };
  /** Old app builds (POST /client/onboarding/meghatalmazas onya_konyvelo): no callback when there is no phone. */
  callbackOptional?: boolean;
  /** Staff: never create a callback, only link an open one. */
  noNewCallback?: boolean;
}

export async function requestAssist(deps: Deps, db: DbOrTx, i: AssistRequestInput): Promise<{ row: AssistRow; callbackId: string | null }> {
  const cl = i.cl;
  const fn = await accFirstName(db, cl);
  if (i.kind === 'vallalkozas_bejelentes') {
    if (!evEnabled(deps)) throw assistErr.disabled(await deps.content.render('helyettunk.disabled', { firstName: fn }));
    if (cl.businessStatus !== 'inditas') throw new ApiError(409, 'path_required', 'Előbb válaszd: „Még nincs, most indítanám”.');
    const reg = await openRegistrationOf(db, cl.id);
    if (reg && FILED_OR_LATER.includes(reg.status)) throw assistErr.wrongStatus('A bejelentésed már elment a NAV-hoz.');
  } else {
    const st = await steps(db, cl.id);
    if (st.get('meghatalmazas')?.status === 'kesz') throw E.conflict('A meghatalmazás már rendben van.');
    const ev = await openAssistOf(db, cl.id, 'vallalkozas_bejelentes');
    if (ev) throw assistErr.alreadyOpen(await assistView(deps, db, ev, { accFirstName: fn }));
    const reg = cl.businessStatus === 'inditas' ? await openRegistrationOf(db, cl.id) : null;
    const lock = stepLockKeys(deps, cl.businessStatus ?? null, reg, st).get('meghatalmazas');
    if (lock && lock !== 'bekotes.zarolt.szerzodes_utan') throw E.stepLocked(await deps.content.render(lock, { firstName: fn }));
  }
  const same = await openAssistOf(db, cl.id, i.kind);
  if (same) throw assistErr.alreadyOpen(await assistView(deps, db, same, { accFirstName: fn }));
  const now = deps.now();
  let row: AssistRow;
  const mh = i.kind === 'vallalkozas_bejelentes' ? await openAssistOf(db, cl.id, 'meghatalmazas') : null;
  let reg: RegRow | null = null;
  if (i.kind === 'vallalkozas_bejelentes') {
    reg = await openRegistrationOf(db, cl.id);
    if (!reg) {
      const [created] = await db.insert(businessRegistrations).values({ clientId: cl.id, status: 'kitoltes', mode: 'segitett', answers: {}, statusChangedAt: now, createdAt: now, updatedAt: now }).returning();
      reg = created!;
      await setStep(deps, db, cl.id, 'vallalkozas_inditas', 'ugyfelre_var');
      await audit(db, { action: 'registration.created', actorUserId: i.by.userId, actorRole: i.by.role, targetType: 'business_registration', targetId: reg.id, clientId: cl.id, details: { mode: 'segitett' } });
    } else reg = await setRegistrationMode(deps, db, cl.id, 'segitett');
  }
  if (mh) {
    // An open meghatalmazás request grows into the full one: the status (and any UJEGYKE filing) is kept.
    row = await update(deps, db, mh, { kind: 'vallalkozas_bejelentes', registrationId: reg?.id ?? null });
    await assistAudit(db, row, 'upgraded', i.by, { to: 'vallalkozas_bejelentes' });
  } else {
    const [created] = await db
      .insert(assistRequests)
      .values({ clientId: cl.id, kind: i.kind, status: 'visszahivas_kerve', statusChangedAt: now, registrationId: reg?.id ?? null, createdByRole: i.by.role, createdByUserId: i.by.userId, createdAt: now, updatedAt: now })
      .returning();
    row = created!;
  }
  // The callback: an open one is linked (topic switched, the note appended), else a new one is created.
  let callbackId = row.callbackId && (await openCallbackOf(db, cl.id))?.id === row.callbackId ? row.callbackId : null;
  let linked = false;
  if (!callbackId) {
    const open = await openCallbackOf(db, cl.id);
    if (open) {
      const extra = i.note?.trim() ? `— Intézzük helyetted kérés: ${i.note.trim()}` : '— Intézzük helyetted kérés';
      const note = (open.note ? `${open.note}\n${extra}` : extra).slice(0, 500);
      await db.update(callbackRequests).set({ topic: ASSIST_CALLBACK_TOPIC[row.kind], note, updatedAt: now }).where(eq(callbackRequests.id, open.id));
      await audit(db, { action: 'callback.updated', actorUserId: i.by.userId, actorRole: i.by.role, targetType: 'callback', targetId: open.id, clientId: cl.id, details: { fields: ['topic', 'note'], by: 'assist' } });
      callbackId = open.id;
      linked = true;
    } else if (!i.noNewCallback) {
      try {
        const cb = await createCallback(deps, db, {
          cl,
          ...(i.phone ? { phone: i.phone } : {}),
          topic: ASSIST_CALLBACK_TOPIC[row.kind],
          window: i.window ?? 'barmikor',
          note: i.note ?? null,
          source: i.source,
          savePhoneToProfile: i.savePhoneToProfile,
          createdByRole: i.by.role === 'system' ? 'client' : i.by.role,
          createdByUserId: i.by.userId ?? cl.userId,
        });
        callbackId = cb.id;
      } catch (err) {
        // Old app builds without a phone on file: the team contacts the client in Üzenetek (SPEC §27.3.2).
        if (!(i.callbackOptional && err instanceof ApiError && err.code === 'validation_failed')) throw err;
      }
    }
    if (callbackId) row = await update(deps, db, row, { callbackId });
  }
  if (!mh) await assistAudit(db, row, 'created', i.by, { source: i.source, linkedCallback: linked, withCallback: Boolean(callbackId) });
  else if (linked) await assistAudit(db, row, 'linked', i.by, {});
  return { row, callbackId };
}

// ---------------------------------------------------------------------------------------------------------------
// staff actions
// ---------------------------------------------------------------------------------------------------------------
export type AssistActorKind = 'csapat' | 'konyvelo' | 'admin';

/** SPEC §27.3.4 roles: the client's OWN accountant is 'konyvelo'; any other accountant never sees the assist (404). */
export async function assistForStaff(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, forUpdate = false): Promise<{ row: AssistRow; cl: ClientRow; kind: AssistActorKind }> {
  const row = forUpdate ? await lockAssist(db, id) : await (async () => {
    const [r] = await db.select().from(assistRequests).where(eq(assistRequests.id, id)).limit(1);
    if (!r) throw E.notFound();
    return r;
  })();
  const cl = await clientRow(db, row.clientId);
  if (actor.role === 'accountant') {
    if (cl.accountantId !== actor.accountantId) throw E.notFound();
    return { row, cl, kind: 'konyvelo' };
  }
  if (actor.role === 'csapat') {
    // §27.6.4: open, or closed in the last 90 days.
    if (!isOpenAssist(row.status) && (row.closedAt ?? row.updatedAt).getTime() < deps.now().getTime() - 90 * 86_400_000) throw E.notFound();
    return { row, cl, kind: 'csapat' };
  }
  // 11-19 javító kör 2: an admin who is also THIS client's accountant acts as the accountant (he may file at NAV).
  if (actor.accountantId && actor.accountantId === cl.accountantId) return { row, cl, kind: 'konyvelo' };
  return { row, cl, kind: 'admin' };
}

function requireRole(action: AssistAction, kind: AssistActorKind, accFirst: string): void {
  if (ASSIST_ACTION_ROLES[action].includes(kind)) return;
  if (action === 'ujegyke_bekuldve' || action === 'bejelentes_bekuldve') throw E.forbidden(`Ezt csak ${accFirst} küldheti be, a saját belépésével.`);
  if (action === 'meghatalmazas_el') throw E.forbidden(`Ezt csak ${accFirst} jelölheti, miután a saját belépésével ellenőrizte az ONYA-ban.`);
  throw E.forbidden();
}

/** Every item of the phase (kind 'meghatalmazas' skips ASSIST_CHECK_NOT_FOR_MH). */
export function phaseItems(kind: AssistKind, phase: AssistCheckPhase): AssistCheckItem[] {
  return (ASSIST_CHECK_ITEMS[phase] as readonly AssistCheckItem[]).filter((i) => kind !== 'meghatalmazas' || !ASSIST_CHECK_NOT_FOR_MH.includes(i));
}

function phaseOf(item: AssistCheckItem): AssistCheckPhase {
  for (const p of Object.keys(ASSIST_CHECK_ITEMS) as AssistCheckPhase[]) if ((ASSIST_CHECK_ITEMS[p] as readonly string[]).includes(item)) return p;
  return 'hivas';
}

/** Ticks the given items (who/when) and checks that the whole phase is ticked (400 assist_checklist_incomplete). */
function tickPhase(row: AssistRow, phase: AssistCheckPhase, items: AssistCheckItem[], by: string, now: Date): AssistRow['checklist'] {
  const cl = { ...(row.checklist ?? {}) };
  for (const it of items) if (phaseItems(row.kind, phase).includes(it) && !cl[it]) cl[it] = { at: now.toISOString(), by };
  const missing = phaseItems(row.kind, phase).filter((it) => !cl[it]);
  if (missing.length) throw assistErr.checklist(missing);
  return cl;
}

function wrong(row: AssistRow): ApiError {
  return assistErr.wrongStatus(`Ebben az állapotban ez most nem lehet (${ASSIST_STATUS_LABELS[row.status]}).`);
}

async function accountantNotify(deps: Deps, db: DbOrTx, cl: ClientRow, variant: string, extra: Record<string, string> = {}, exceptUserId?: string | null, assistId?: string): Promise<void> {
  const acc = await accountantUserOf(db, cl);
  if (!acc || acc.userId === exceptUserId) return;
  await notify(deps, db, {
    userId: acc.userId,
    kind: 'assist_task',
    variant,
    params: { clientName: clientName(cl), firstName: acc.firstName, ...extra },
    link: assistId ? `/helyettunk/${assistId}` : '/helyettunk',
    data: { clientId: cl.id, ...(assistId ? { assistId } : {}) },
  });
}

export async function agreed(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, b: { items: AssistCheckItem[]; note?: string }): Promise<AssistRow> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  requireRole('egyeztetve', kind, await accFirstName(db, cl));
  if (row.status !== 'visszahivas_kerve') throw wrong(row);
  const now = deps.now();
  const checklist = tickPhase(row, 'hivas', b.items, actor.userId, now);
  const note = b.note?.trim() ? (row.staffNote ? `${row.staffNote}\n${b.note.trim()}` : b.note.trim()).slice(0, 2000) : row.staffNote;
  const u = await update(deps, db, row, { status: 'egyeztetve', agreedAt: now, agreedBy: actor.userId, checklist, staffNote: note });
  await assistAudit(db, row, 'agreed', { userId: actor.userId, role: actor.role });
  // 11-19 javítás: "Egyeztettünk – elindítom" means we talked – the linked callback is done (it stayed 'folyamatban' and
  // showed "kerestünk, de nem értünk el" to the client and as overdue in the team's list).
  await finishLinkedCallback(deps, db, u, { userId: actor.userId, role: actor.role }, 'beszeltunk');
  await syncMhStep(deps, db, u);
  const fn = await accFirstName(db, cl);
  await notify(deps, db, { userId: cl.userId, kind: 'assist_started', params: { firstName: fn }, link: '/bekotes', data: { assistId: u.id } });
  const groups = u.kind === 'vallalkozas_bejelentes' ? EV_UGYCSOPORTOK : ugykorok(deps);
  await accountantNotify(deps, db, cl, 'ujegyke', { ugycsoportok: groups.join('; ') }, actor.userId, u.id);
  return u;
}

/** Contract accepted and the "Rólad" data stored: our accountant may act for the client (SPEC §27.3.3 item 1). */
export async function readyForUjegyke(db: DbOrTx, cl: ClientRow): Promise<boolean> {
  return (await notReadyForUjegyke(db, cl)).length === 0;
}

/** What the client still owes before the UJEGYKE (panel line "Előbb az ügyfélnek: …"); empty = ready. */
export async function notReadyForUjegyke(db: DbOrTx, cl: ClientRow): Promise<string[]> {
  const st = await steps(db, cl.id);
  const out: string[] = [];
  if (st.get('szerzodes')?.status !== 'kesz') out.push('szerződés elfogadása');
  if (!(cl.lastName && cl.firstName)) out.push('név');
  if (!cl.adoazonositoJelEnc) out.push('adóazonosító jel');
  return out;
}

/**
 * The callback linked to an assist: 'beszeltunk' = the call happened (agreed); 'vege' = the assist ended (kesz or closed
 * by the team) – nothing is left to call about. Never touches a callback that is not open or belongs to another request.
 */
async function finishLinkedCallback(deps: Deps, db: DbOrTx, row: AssistRow, by: { userId: string | null; role: string }, how: 'beszeltunk' | 'vege'): Promise<void> {
  if (!row.callbackId) return;
  const [cb] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, row.callbackId)).limit(1);
  if (!cb || (cb.status !== 'uj' && cb.status !== 'folyamatban')) return;
  const now = deps.now();
  if (how === 'beszeltunk') {
    if (by.userId) await db.insert(callbackAttempts).values({ callbackId: cb.id, byUserId: by.userId, at: now, outcome: 'beszeltunk', note: 'Egyeztettünk – „Intézzük helyetted” elindult.' });
    await db
      .update(callbackRequests)
      .set({ status: 'teljesitve', attempts: cb.attempts + 1, lastAttemptAt: now, lastOutcome: 'beszeltunk', callingNowUntil: null, nextAttemptAfter: null, closedAt: now, closedBy: by.userId, updatedAt: now })
      .where(eq(callbackRequests.id, cb.id));
    await audit(db, { action: 'callback.attempt', actorUserId: by.userId, actorRole: by.role, targetType: 'callback', targetId: cb.id, clientId: cb.clientId, details: { outcome: 'beszeltunk', status: 'teljesitve', by: 'assist' } });
    return;
  }
  const note = 'Lezárás: az „Intézzük helyetted” kérés véget ért.';
  await db
    .update(callbackRequests)
    .set({ status: 'lezarva', closedAt: now, closedBy: by.userId, closedReason: 'egyeb', callingNowUntil: null, internalNote: (cb.internalNote ? `${cb.internalNote}\n${note}` : note).slice(0, 2000), updatedAt: now })
    .where(eq(callbackRequests.id, cb.id));
  await audit(db, { action: 'callback.closed', actorUserId: by.userId, actorRole: by.role, targetType: 'callback', targetId: cb.id, clientId: cb.clientId, details: { reason: 'egyeb', by: 'assist' } });
}

export async function ujegykeFiled(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, b: { items: AssistCheckItem[]; jogcim: AssistJogcim; filedAt?: string }): Promise<AssistRow> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  const fn = await accFirstName(db, cl);
  requireRole('ujegyke_bekuldve', kind, fn);
  if (row.status !== 'egyeztetve' && row.status !== 'meghatalmazas_lejart') throw wrong(row);
  if (!(await readyForUjegyke(db, cl))) throw assistErr.wrongStatus(await deps.content.render('helyettunk.hiba.szerzodes', {}));
  const now = deps.now();
  let filedAt = now;
  if (b.filedAt) {
    filedAt = new Date(b.filedAt);
    if (Number.isNaN(filedAt.getTime()) || filedAt.getTime() > now.getTime() + 60_000 || filedAt.getTime() < now.getTime() - 86_400_000)
      throw E.validation({ filedAt: 'A beküldés ideje az elmúlt 24 órából lehet.' });
  }
  const checklist = tickPhase(row, 'ujegyke', b.items, actor.userId, now);
  const dueOn = addDays(todayBudapest(filedAt), ASSIST_RULES.shownApprovalDays);
  const u = await update(deps, db, row, {
    status: 'meghatalmazas_bekuldve',
    ujegykeFiledAt: filedAt,
    ujegykeFiledBy: actor.userId,
    ujegykeJogcim: b.jogcim,
    approvalDueOn: dueOn,
    approvalExpiresAt: new Date(filedAt.getTime() + ASSIST_RULES.navApprovalDays * 86_400_000),
    // the filing notice is the first of the max. 3 client messages of this filing (§27.3.5)
    approvalReminders: 1,
    lastReminderAt: now,
    staffAlertedAt: null,
    clientApprovedAt: null,
    checklist,
  });
  await assistAudit(db, row, 'ujegyke_filed', { userId: actor.userId, role: actor.role }, { jogcim: b.jogcim, refile: row.status === 'meghatalmazas_lejart' });
  await syncMhStep(deps, db, u);
  await notify(deps, db, { userId: cl.userId, kind: 'assist_mh_filed', params: { firstName: fn, hatarido: huDayMonthIg(dueOn) }, link: '/bekotes/meghatalmazas/jovahagyas', data: { assistId: u.id } });
  return u;
}

export async function clientApproved(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, actorUserId: string): Promise<AssistRow> {
  const row = await lockAssist(db, id);
  if (row.clientId !== cl.id) throw E.notFound();
  if (row.status === 'meghatalmazas_jovahagyva') return row;
  if (row.status !== 'meghatalmazas_bekuldve' && row.status !== 'meghatalmazas_lejart') throw wrong(row);
  const u = await update(deps, db, row, { status: 'meghatalmazas_jovahagyva', clientApprovedAt: deps.now() });
  await assistAudit(db, row, 'client_approved', { userId: actorUserId, role: 'client' });
  await syncMhStep(deps, db, u);
  await accountantNotify(deps, db, cl, 'ellenorzes', {}, null, u.id);
  return u;
}

/** Staff or the worker (by = null): the 4 days passed without approval – NAV deleted the UJEGYKE. */
export async function expireApproval(deps: Deps, db: DbOrTx, row0: AssistRow, by: { userId: string | null; role: string }): Promise<AssistRow> {
  const row = await lockAssist(db, row0.id);
  // 11-19 javítás: also from '_jovahagyva' – the client tapped "Jóváhagytam" but did not (or could not) approve in ONYA,
  // and NAV deleted the UJEGYKE. Before, this was a dead end (409 for every staff action, no timer, no reminders).
  if (row.status !== 'meghatalmazas_bekuldve' && row.status !== 'meghatalmazas_jovahagyva') throw wrong(row);
  if (row.mhLiveAt) throw wrong(row);
  const cl = await clientRow(db, row.clientId);
  const u = await update(deps, db, row, { status: 'meghatalmazas_lejart', expiredCount: row.expiredCount + 1, clientApprovedAt: null });
  await assistAudit(db, row, 'expired', by, { by: by.userId ? by.role : 'rendszer' });
  await syncMhStep(deps, db, u);
  await notify(deps, db, { userId: cl.userId, kind: 'assist_mh_expired', params: { firstName: await accFirstName(db, cl) }, link: '/bekotes', data: { assistId: u.id } });
  await accountantNotify(deps, db, cl, 'ujra', {}, null, u.id);
  return u;
}

/**
 * 11-19 javítás: the client's "Mégsem hagytam még jóvá" – a "Jóváhagytam" tapped by mistake. Before NAV's deadline the
 * request goes back to "approve in ONYA" (reminders run again); after it, it is expired (our accountant re-files).
 */
export async function clientUnapproved(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, actorUserId: string): Promise<AssistRow> {
  const row = await lockAssist(db, id);
  if (row.clientId !== cl.id) throw E.notFound();
  if (row.status === 'meghatalmazas_bekuldve') return row;
  if (row.status !== 'meghatalmazas_jovahagyva' || row.mhLiveAt) throw wrong(row);
  if (row.approvalExpiresAt && deps.now().getTime() >= row.approvalExpiresAt.getTime()) return expireApproval(deps, db, row, { userId: actorUserId, role: 'client' });
  const u = await update(deps, db, row, { status: 'meghatalmazas_bekuldve', clientApprovedAt: null });
  await assistAudit(db, row, 'client_unapproved', { userId: actorUserId, role: 'client' });
  await syncMhStep(deps, db, u);
  return u;
}

export async function expiredByStaff(deps: Deps, db: DbOrTx, actor: StaffActor, id: string): Promise<AssistRow> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  requireRole('lejart', kind, await accFirstName(db, cl));
  return expireApproval(deps, db, row, { userId: actor.userId, role: actor.role });
}

export async function mhLive(deps: Deps, db: DbOrTx, actor: StaffActor, id: string): Promise<AssistRow> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  requireRole('meghatalmazas_el', kind, await accFirstName(db, cl));
  if (!['meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva'].includes(row.status)) throw wrong(row);
  const now = deps.now();
  const to: AssistStatus = row.kind === 'meghatalmazas' ? 'kesz' : row.consentValid ? 'ugyfel_engedelyezte' : 'meghatalmazas_el';
  const u = await update(deps, db, row, { status: to, mhLiveAt: now, mhVerifiedBy: actor.userId, ...(to === 'kesz' ? { closedAt: now } : {}) });
  await assistAudit(db, row, 'mh_live', { userId: actor.userId, role: actor.role }, { to });
  await syncMhStep(deps, db, u);
  if (to === 'meghatalmazas_el') await notify(deps, db, { userId: cl.userId, kind: 'assist_consent_needed', link: '/bekotes/vallalkozas/engedely', data: { assistId: u.id } });
  if (to === 'ugyfel_engedelyezte') await accountantNotify(deps, db, cl, 'bejelentes', {}, actor.userId, u.id);
  if (to === 'kesz') {
    await assistAudit(db, u, 'done', { userId: actor.userId, role: actor.role });
    await finishLinkedCallback(deps, db, u, { userId: actor.userId, role: actor.role }, 'vege');
  }
  return u;
}

export async function closeAssist(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, b: { reason: AssistCloseReason; note?: string }): Promise<AssistRow> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  requireRole('lezaras', kind, await accFirstName(db, cl));
  if (!isOpenAssist(row.status)) throw wrong(row);
  return closeRow(deps, db, row, { userId: actor.userId, role: actor.role }, b.reason, b.note ?? null);
}

async function closeRow(deps: Deps, db: DbOrTx, row: AssistRow, by: { userId: string | null; role: string }, reason: AssistCloseReason, note: string | null): Promise<AssistRow> {
  const now = deps.now();
  const u = await update(deps, db, row, { status: 'lezarva', closedAt: now, closedBy: by.userId, closedReason: reason, closeNote: note?.trim() ? note.trim().slice(0, 1000) : null });
  await assistAudit(db, row, 'closed', by, { reason });
  if (row.kind === 'vallalkozas_bejelentes') await setRegistrationMode(deps, db, row.clientId, 'onallo');
  await syncMhStep(deps, db, u);
  // After a path change the client may still want to talk (SPEC §27.2.2): only then does the callback stay open.
  if (reason !== 'utvaltas') await finishLinkedCallback(deps, db, u, by, 'vege');
  return u;
}

/**
 * The EV part ends but the UJEGYKE exists at NAV (cancel after filing, or path change to 'van'): the request lives on
 * as a meghatalmazás request with its status ('meghatalmazas_el' / 'ugyfel_engedelyezte' → 'kesz').
 */
async function convertToMh(deps: Deps, db: DbOrTx, row: AssistRow, by: { userId: string | null; role: string }, why: string): Promise<AssistRow> {
  const live = row.status === 'meghatalmazas_el' || row.status === 'ugyfel_engedelyezte';
  const now = deps.now();
  const u = await update(deps, db, row, { kind: 'meghatalmazas', registrationId: null, consentValid: false, ...(live ? { status: 'kesz', closedAt: now } : {}) });
  await assistAudit(db, row, 'converted', by, { to: 'meghatalmazas', why });
  await syncMhStep(deps, db, u);
  return u;
}

export async function cancelByClient(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, actorUserId: string, note?: string): Promise<AssistRow> {
  const row = await lockAssist(db, id);
  if (row.clientId !== cl.id) throw E.notFound();
  if (!ASSIST_CANCELLABLE_STATUSES.includes(row.status)) throw wrong(row);
  const by = { userId: actorUserId, role: 'client' };
  let u: AssistRow;
  if (row.kind === 'vallalkozas_bejelentes' && UJEGYKE_FILED.includes(row.status)) {
    u = await convertToMh(deps, db, row, by, 'ugyfel_lemondta');
    await setRegistrationMode(deps, db, cl.id, 'onallo');
  } else {
    const now = deps.now();
    u = await update(deps, db, row, { status: 'visszavonva', closedAt: now, closedBy: actorUserId, closeNote: note?.trim() ? note.trim().slice(0, 1000) : null });
    await assistAudit(db, row, 'cancelled', by);
    if (row.kind === 'vallalkozas_bejelentes') await setRegistrationMode(deps, db, cl.id, 'onallo');
    await syncMhStep(deps, db, u);
  }
  // "A visszahívást is lemondjuk" (ASSIST_TEXTS.cancelSheetBody).
  if (row.callbackId) {
    const open = await openCallbackOf(db, cl.id);
    if (open?.id === row.callbackId) {
      await db.update(callbackRequests).set({ status: 'visszavonva', closedAt: deps.now(), closedBy: actorUserId, callingNowUntil: null, updatedAt: deps.now() }).where(eq(callbackRequests.id, open.id));
      await audit(db, { action: 'callback.cancelled', actorUserId, actorRole: 'client', targetType: 'callback', targetId: open.id, clientId: cl.id, details: { by: 'assist' } });
    }
  }
  return u;
}

/** SPEC §27.2.2 `inditas → van`: before the UJEGYKE the EV request ends ('utvaltas'); after it, it is converted. */
export async function onLeaveInditas(deps: Deps, db: DbOrTx, clientId: string, by: { userId: string | null; role: string }): Promise<void> {
  const row = await openAssistOf(db, clientId, 'vallalkozas_bejelentes');
  if (!row) return;
  if (row.status === 'visszahivas_kerve' || row.status === 'egyeztetve') await closeRow(deps, db, row, by, 'utvaltas', null);
  else if (UJEGYKE_FILED.includes(row.status)) await convertToMh(deps, db, row, by, 'utvaltas');
}

export async function assignAssist(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, userId: string | null): Promise<AssistRow> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  if (kind === 'konyvelo' && actor.role === 'accountant') throw E.notFound();
  if (userId && !(await assignableFor(db, cl)).includes(userId)) throw E.validation({ userId: 'Neki nem adhatod át.' });
  const u = await update(deps, db, row, { assignedUserId: userId });
  await assistAudit(db, row, 'assigned', { userId: actor.userId, role: actor.role }, { toUserId: userId });
  // 11-19 javító kör 2: "Magamra veszem" on the request also takes its open callback (one claim, then the full number
  // shows in the callback drawer) – unless a colleague already holds that call.
  if (userId && row.callbackId) {
    const [cb] = await db.select().from(callbackRequests).where(eq(callbackRequests.id, row.callbackId)).limit(1);
    if (cb && (cb.status === 'uj' || cb.status === 'folyamatban') && (!cb.assignedUserId || cb.assignedUserId === row.assignedUserId) && cb.assignedUserId !== userId) {
      const now = deps.now();
      await db.update(callbackRequests).set({ assignedUserId: userId, assignedAt: now, status: 'folyamatban', updatedAt: now }).where(eq(callbackRequests.id, cb.id));
      await audit(db, { action: 'callback.assigned', actorUserId: actor.userId, actorRole: actor.role, targetType: 'callback', targetId: cb.id, clientId: cb.clientId, details: { toUserId: userId, fromUserId: cb.assignedUserId, via: 'assist' } });
    }
  }
  return u;
}

export async function patchAssist(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, b: { staffNote?: string | null; check?: { item: AssistCheckItem; done: boolean }[] }): Promise<AssistRow> {
  const { row, kind } = await assistForStaff(deps, db, actor, id, true);
  if (!isOpenAssist(row.status) && b.check?.length) throw wrong(row);
  const now = deps.now();
  const checklist = { ...(row.checklist ?? {}) };
  for (const c of b.check ?? []) {
    const phase = phaseOf(c.item);
    // The UJEGYKE and EV items record what the accountant did with his own login: only he (or an admin) ticks them.
    if (phase !== 'hivas' && kind === 'csapat') throw E.forbidden('Ezt a pontot a könyvelő pipálja ki.');
    if (!phaseItems(row.kind, phase).includes(c.item)) continue;
    if (c.done) checklist[c.item] = checklist[c.item] ?? { at: now.toISOString(), by: actor.userId };
    else delete checklist[c.item];
    await assistAudit(db, row, 'check_ticked', { userId: actor.userId, role: actor.role }, { item: c.item, done: c.done });
  }
  return update(deps, db, row, { checklist, ...(b.staffNote !== undefined ? { staffNote: b.staffNote?.trim() ? b.staffNote.trim().slice(0, 2000) : null } : {}) });
}

// ---------------------------------------------------------------------------------------------------------------
// the final review and consent (EV only, SPEC §27.3.3 item 3)
// ---------------------------------------------------------------------------------------------------------------
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** Address on one line. */
function addr(a: { zip: string; city: string; line: string } | null | undefined): string {
  return a ? `${a.zip} ${a.city}, ${a.line}` : '';
}

export async function consentSummary(deps: Deps, db: DbOrTx, row: AssistRow): Promise<AssistConsentSummary> {
  const cl = await clientRow(db, row.clientId);
  const acc = await accountantUserOf(db, cl);
  const fn = acc?.firstName ?? 'A könyvelőd';
  const reg = await registrationOfAssist(db, row);
  const st = await steps(db, cl.id);
  const adatokDone = st.get('adatok')?.status === 'kesz';
  const a = reg ? answersOf(reg) : null;
  const t = (k: string, p: Record<string, string> = {}) => deps.content.render(`helyettunk.${k}`, { firstName: fn, accountantName: acc?.name ?? fn, ...p });
  const kerdoiv = '/bekotes/vallalkozas/adatlap';
  const home = addr(cl.addressZip ? { zip: cl.addressZip, city: cl.addressCity ?? '', line: cl.addressLine ?? '' } : null);
  const seat = a?.seat;
  const seatLines: string[] = [];
  if (seat?.kind === 'lakcim' || !seat) seatLines.push(home ? `${home} (a lakcímed)` : 'A lakcímed');
  else if (seat.kind === 'mas_cim') seatLines.push(addr(seat.address));
  else seatLines.push(addr(seat.address), seat.provider ? `Székhelyszolgáltató: ${seat.provider.name}` : '');
  seatLines.push(await t('consent_public'));
  const acts = [...(a?.activities ?? [])].sort((x, y) => Number(y.main) - Number(x.main));
  const actLines = acts.map((x) => `${activityShortLine(x)}${x.main ? ' (fő tevékenység)' : ''}`);
  if (!acts.length && a?.activityFreeText) actLines.push(a.activityFreeText);
  const startDay = addWorkingDays(addDays(todayBudapest(deps.now()), 1), 0);
  const blocks: AssistConsentSummary['blocks'] = [
    { key: 'rolad', title: await t('consent_block_rolad'), lines: [clientName(cl), `Adóazonosító jel: ${maskAdoazonosito(cl.adoazonositoLast3)}`], editRoute: '/bekotes/adatok?utana=vallalkozas' },
    { key: 'szekhely', title: await t('consent_block_szekhely'), lines: seatLines.filter(Boolean), editRoute: kerdoiv },
    { key: 'telephely', title: await t('consent_block_telephely'), lines: a?.otherSites?.length ? a.otherSites.map((x) => `${x.kind === 'telephely' ? 'Telephely' : 'Fióktelep'}: ${addr(x.address)}`) : ['Nincs'], editRoute: kerdoiv },
    { key: 'tevekenyseg', title: await t('consent_block_tevekenyseg'), lines: actLines, editRoute: kerdoiv },
    { key: 'munkavegzes', title: await t('consent_block_munkavegzes'), lines: a?.workKind ? [WORK_KIND_GUIDE_VALUE[a.workKind]] : [], editRoute: kerdoiv },
    { key: 'adozas', title: await t('consent_block_adozas'), lines: [await t('consent_adozas', { kozossegi: a?.euPartner === 'igen' ? 'igen' : 'nem' })], editRoute: kerdoiv },
    // {date} here is followed by the template's own period ("várhatóan november 24. Előre…").
    { key: 'kezdes', title: await t('consent_block_kezdes'), lines: [await t('consent_kezdes', { date: huDayMonth(startDay).replace(/\.$/, '') })], editRoute: null },
  ];
  const missing = a ? missingFields(a, { adatokDone }) : ['kerdoiv'];
  if (reg && reg.status === 'kitoltes' && !missing.length) missing.push('kerdoiv');
  const pending = a ? activityPending(a) : false;
  const version = evUtasitasVersion(deps);
  return {
    version,
    hash: consentHash(blocks, version),
    blocks,
    declarationText: await t('consent_declaration'),
    instructionText: await t('consent_instruction'),
    publicNote: await t('consent_public'),
    missing,
    // k5 finding 13: the kill switch and the 2026-12-31 cut-off stop OPEN EV requests before the filing too
    canConsent: !missing.length && !pending && row.kind === 'vallalkozas_bejelentes' && CONSENT_STATUSES.includes(row.status) && evEnabled(deps),
  };
}

/**
 * sha256 of the canonical JSON {version, blocks}. The "Kezdés napja" block shows tomorrow's date and would change every
 * day: it enters the hash with its title only (the start day is always "the filing day", Evectv.).
 */
export function consentHash(blocks: AssistConsentSummary['blocks'], version: string): string {
  const stable = blocks.map((b) => ({ key: b.key, title: b.title, lines: b.key === 'kezdes' ? [] : b.lines }));
  return sha256Hex(canonical({ version, blocks: stable }));
}

export async function giveConsent(
  deps: Deps,
  db: DbOrTx,
  cl: ClientRow,
  id: string,
  b: { hash: string },
  ctx: { userId: string; ipHmac: string; ua: string },
): Promise<AssistRow> {
  const row = await lockAssist(db, id);
  if (row.clientId !== cl.id) throw E.notFound();
  if (row.kind !== 'vallalkozas_bejelentes') throw E.notFound();
  if (!evEnabled(deps)) throw assistErr.disabled(await deps.content.render('helyettunk.disabled', { firstName: await accFirstName(db, cl) }));
  if (row.consentValid && (row.status === 'ugyfel_engedelyezte' || row.status === 'meghatalmazas_el')) {
    if (row.consentHash === b.hash) return row;
  }
  if (!CONSENT_STATUSES.includes(row.status) && row.status !== 'ugyfel_engedelyezte') throw wrong(row);
  const sum = await consentSummary(deps, db, row);
  const reg = await registrationOfAssist(db, row);
  if (reg && activityPending(answersOf(reg))) throw assistErr.wrongStatus(await deps.content.render('helyettunk.hiba.tevekenyseg', {}));
  if (sum.missing.length) throw assistErr.wrongStatus('Előbb töltsd ki a kérdőívet.');
  if (sum.hash !== b.hash) throw assistErr.stale(await deps.content.render('helyettunk.consent_stale', {}));
  const now = deps.now();
  const pdf = await instructionPdf(deps, db, cl, sum, now);
  const docId = await createDocumentFromBuffer(deps, db, {
    clientId: cl.id,
    category: 'szerzodes_alairt',
    title: `Utasítás a vállalkozásod bejelentésére (${huDayMonth(todayBudapest(now))})`,
    month: todayBudapest(now).slice(0, 7),
    data: pdf,
    mime: 'application/pdf',
    fileName: 'utasitas_vallalkozas_bejelentes.pdf',
    source: 'rendszer',
    status: 'feldolgozva',
    by: null,
    visibility: 'kozos',
  });
  const to: AssistStatus = row.status === 'meghatalmazas_el' ? 'ugyfel_engedelyezte' : row.status;
  const u = await update(deps, db, row, {
    status: to,
    consentAt: now,
    consentHash: sum.hash,
    consentVersion: sum.version,
    consentSnapshot: sum.blocks.map((x) => ({ key: x.key, title: x.title, lines: x.lines })),
    consentIp: ctx.ipHmac,
    consentUserAgent: ctx.ua.slice(0, 120),
    consentValid: true,
    consentDocumentId: docId,
  });
  await assistAudit(db, row, 'consent_given', { userId: ctx.userId, role: 'client' }, { version: sum.version, to });
  if (to === 'ugyfel_engedelyezte') await accountantNotify(deps, db, cl, 'bejelentes', {}, null, u.id);
  return u;
}

/** jogi biztonsagosErtek(): a value never adds Markdown structure or a placeholder to the template. */
function safeValue(v: string): string {
  return v.replace(/[\r\n]+/g, ' ').replace(/\*\*/g, '').replace(/\{\{|\}\}/g, '').trim();
}

/** The instruction PDF (jogi template `sablonok/ev_bejelentes_utasitas.md`, B4's placeholders; built-in text otherwise). */
async function instructionPdf(deps: Deps, db: DbOrTx, cl: ClientRow, sum: AssistConsentSummary, at: Date): Promise<Buffer> {
  const acc = cl.accountantId ? (await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1))[0] : undefined;
  const when = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at);
  const block = (k: string) => safeValue((sum.blocks.find((b) => b.key === k)?.lines ?? []).filter((l) => l !== sum.publicNote).join('; '));
  const values: Record<string, string> = {
    ...legalValuesFromConfig(deps.cfg, deps.now()),
    'ugyfel.nev': safeValue(clientName(cl)),
    'utasitas.adoazonosito_jel_takart': maskAdoazonosito(cl.adoazonositoLast3),
    'konyvelo.nev': safeValue(acc?.displayName ?? ''),
    'konyvelo.nyilvantartasi_szam': safeValue(acc?.registrationNumber ?? '–'),
    'utasitas.szekhely': block('szekhely'),
    'utasitas.telephely': block('telephely'),
    'utasitas.tevekenysegek': block('tevekenyseg'),
    'utasitas.munkavegzes': block('munkavegzes'),
    'utasitas.adozas': block('adozas'),
    'utasitas.kezdes': block('kezdes'),
    'utasitas.nyilatkozat_szoveg': safeValue(sum.declarationText),
    'utasitas.utasitas_szoveg': safeValue(sum.instructionText),
    'utasitas.idopont': when,
    'utasitas.ujjlenyomat': sum.hash,
    'utasitas.verzio': sum.version,
    'dok.verzio': sum.version,
  };
  const tpl = await deps.legal.template('ev_bejelentes_utasitas.md');
  const md =
    tpl ??
    [
      'TERVEZET – jogász ellenőrzi.',
      '',
      '# Utasítás a vállalkozásom bejelentésére',
      '',
      'Ügyfél: {{ugyfel.nev}}, adóazonosító jel: {{utasitas.adoazonosito_jel_takart}}',
      '',
      'Könyvelő (meghatalmazott): {{konyvelo.nev}}, nyilvántartási szám: {{konyvelo.nyilvantartasi_szam}}',
      '',
      '## A bejelentés adatai',
      '',
      '- Székhely: {{utasitas.szekhely}}',
      '- Telephely, fióktelep: {{utasitas.telephely}}',
      '- Tevékenységek: {{utasitas.tevekenysegek}}',
      '- Munkavégzés jellege: {{utasitas.munkavegzes}}',
      '- Adózás: {{utasitas.adozas}}',
      '- Kezdés napja: {{utasitas.kezdes}}',
      '',
      '## Nyilatkozat',
      '',
      '{{utasitas.nyilatkozat_szoveg}}',
      '',
      '## Utasítás',
      '',
      '{{utasitas.utasitas_szoveg}}',
      '',
      'Időpont: {{utasitas.idopont}} – az alkalmazásban elektronikusan elfogadva.',
      '',
      'Ujjlenyomat: {{utasitas.ujjlenyomat}} · verzió: {{utasitas.verzio}}',
      '',
    ].join('\n');
  return markdownToPdf(deps.cfg.fontDir, 'Utasítás a vállalkozásom bejelentésére', fillLegal(md, values));
}

/**
 * SPEC §27.3.3: any later change of the answers (client or team, incl. ÖVTJ codes) clears the consent's validity
 * ('ugyfel_engedelyezte' → 'meghatalmazas_el') and asks the client to look again. Called after every saved change;
 * compares the new summary hash with the consented one, so saving the same answers changes nothing.
 */
export async function revalidateConsent(deps: Deps, db: DbOrTx, clientId: string, by: { userId: string | null; role: string }): Promise<boolean> {
  const row = await openAssistOf(db, clientId, 'vallalkozas_bejelentes');
  if (!row || !row.consentValid || row.status === 'bejelentes_bekuldve') return false;
  const sum = await consentSummary(deps, db, row);
  if (sum.hash === row.consentHash) return false;
  const u = await update(deps, db, row, { consentValid: false, ...(row.status === 'ugyfel_engedelyezte' ? { status: 'meghatalmazas_el' as const } : {}) });
  await assistAudit(db, row, 'consent_invalidated', by);
  const cl = await clientRow(db, clientId);
  await notify(deps, db, { userId: cl.userId, kind: 'assist_consent_needed', variant: 'ujra', noEmail: true, link: '/bekotes/vallalkozas/engedely', data: { assistId: u.id } });
  return true;
}

/** Answers still equal to what the client approved (panel line "A kérdőív változott az engedély óta"). */
export async function answersMatchConsent(deps: Deps, db: DbOrTx, row: AssistRow): Promise<boolean | null> {
  if (row.kind !== 'vallalkozas_bejelentes' || !row.consentHash) return null;
  return (await consentSummary(deps, db, row)).hash === row.consentHash;
}

// ---------------------------------------------------------------------------------------------------------------
// the EV bejelentés filed by our accountant, and the end of the road
// ---------------------------------------------------------------------------------------------------------------
export async function prepareEvFiled(deps: Deps, db: DbOrTx, actor: StaffActor, id: string, items: AssistCheckItem[]): Promise<{ row: AssistRow; cl: ClientRow; reg: RegRow; checklist: AssistRow['checklist'] }> {
  const { row, cl, kind } = await assistForStaff(deps, db, actor, id, true);
  requireRole('bejelentes_bekuldve', kind, await accFirstName(db, cl));
  if (row.kind !== 'vallalkozas_bejelentes') throw wrong(row);
  // k5 finding 13: no EV filing after the kill switch / the cut-off
  if (!evEnabled(deps)) throw assistErr.disabled(await deps.content.render('helyettunk.disabled', { firstName: await accFirstName(db, cl) }));
  if (row.status !== 'ugyfel_engedelyezte' || !row.consentValid) throw assistErr.wrongStatus('Az ügyfél még nem engedélyezte a bejelentést.');
  if (!(await answersMatchConsent(deps, db, row))) throw assistErr.stale('A kérdőív változott az engedély óta.');
  const reg = await registrationOfAssist(db, row);
  if (!reg || reg.status !== 'utmutato') throw assistErr.wrongStatus('A bejelentés most nem rögzíthető (a kérdőív nincs elküldve, vagy már rögzítették).');
  const checklist = tickPhase(row, 'bejelentes', items, actor.userId, deps.now());
  return { row, cl, reg, checklist };
}

export async function markEvFiled(deps: Deps, db: DbOrTx, actor: StaffActor, row: AssistRow, checklist: AssistRow['checklist']): Promise<AssistRow> {
  const now = deps.now();
  const u = await update(deps, db, row, { status: 'bejelentes_bekuldve', evFiledAt: now, evFiledBy: actor.userId, checklist });
  await assistAudit(db, row, 'ev_filed', { userId: actor.userId, role: actor.role });
  // The registration's own history carries it too (the panel's four-eyes hint reads TeamRegistrationDetail.history).
  if (row.registrationId)
    await audit(db, { action: 'assist.ev_filed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'business_registration', targetId: row.registrationId, clientId: row.clientId, details: { assistId: row.id } });
  return u;
}

export async function notifyEvFiled(deps: Deps, db: DbOrTx, cl: ClientRow, row: AssistRow, regId: string, actorUserId: string): Promise<void> {
  const acc = await accountantUserOf(db, cl);
  // jogi wording "{firstName} beküldte a bejelentésedet!" (ÁSZF 4/C.6.: the accountant files it, not the company).
  await notify(deps, db, { userId: cl.userId, kind: 'assist_ev_filed', params: { firstName: acc?.firstName ?? 'A könyvelőd' }, link: '/bekotes', data: { assistId: row.id } });
  await notifyQueueOwners(
    deps,
    db,
    { kind: 'assist_task', variant: 'atnezes', noEmail: true, params: { clientName: clientName(cl), firstName: acc?.firstName ?? 'A könyvelő' }, link: `/vallalkozas-inditas/${regId}`, data: { clientId: cl.id, registrationId: regId } },
    { except: actorUserId },
  );
}

/** The registration reached 'kesz' (team check + adószám): the EV request is done. */
export async function onRegistrationDone(deps: Deps, db: DbOrTx, clientId: string): Promise<void> {
  const row = await openAssistOf(db, clientId, 'vallalkozas_bejelentes');
  if (!row || row.status !== 'bejelentes_bekuldve') return;
  const u = await update(deps, db, row, { status: 'kesz', closedAt: deps.now() });
  await assistAudit(db, row, 'done', { userId: null, role: 'system' });
  await finishLinkedCallback(deps, db, u, { userId: null, role: 'system' }, 'vege');
}

/** The user who filed the EV bejelentés of this registration via ev-filed (four-eyes rule of the check). */
export async function evFiledByOf(db: DbOrTx, registrationId: string): Promise<string | null> {
  const [r] = await db.select({ by: assistRequests.evFiledBy }).from(assistRequests).where(eq(assistRequests.registrationId, registrationId)).orderBy(desc(assistRequests.createdAt)).limit(1);
  return r?.by ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// panel views
// ---------------------------------------------------------------------------------------------------------------
function endOfBudapestDay(day: string): Date {
  return new Date(budapestLocalToUtc(addDays(day, 1), '00:00').getTime() - 1000);
}

function workdayDue(from: Date, n: number): Date {
  return endOfBudapestDay(addWorkingDays(todayBudapest(from), n));
}

export function nextDueOf(deps: Deps, row: AssistRow, callbackDue: Date | null, clientNotReady = false): TeamAssistRow['nextDue'] {
  const now = deps.now();
  const d = (at: Date, what: string) => ({ at: at.toISOString(), what, overdue: at.getTime() < now.getTime() });
  const w = ASSIST_RULES.staffActionWorkdays;
  // 11-19 javítás: the UJEGYKE cannot be filed yet – the client owes the contract / his data; never "overdue" for us.
  if (clientNotReady && (row.status === 'egyeztetve' || row.status === 'meghatalmazas_lejart'))
    return { at: workdayDue(row.agreedAt ?? row.statusChangedAt, 2).toISOString(), what: 'Ügyfélre vár: szerződés / adatok', overdue: false };
  switch (row.status) {
    case 'visszahivas_kerve':
      return callbackDue ? d(callbackDue, 'Visszahívás') : null;
    case 'egyeztetve':
      return d(workdayDue(row.agreedAt ?? row.statusChangedAt, w), 'UJEGYKE beküldése');
    case 'meghatalmazas_lejart':
      return d(workdayDue(row.statusChangedAt, w), 'UJEGYKE újra beküldése');
    case 'meghatalmazas_bekuldve':
      return row.approvalDueOn ? d(endOfBudapestDay(row.approvalDueOn), `Jóváhagyás: ${huDayMonth(row.approvalDueOn)}`) : null;
    case 'meghatalmazas_jovahagyva':
      return d(workdayDue(row.clientApprovedAt ?? row.statusChangedAt, w), 'Ellenőrzés a NAV-nál');
    case 'ugyfel_engedelyezte':
      return d(workdayDue(row.consentAt ?? row.statusChangedAt, w), 'Bejelentés beküldése');
    case 'bejelentes_bekuldve':
      return d(workdayDue(row.evFiledAt ?? row.statusChangedAt, w), 'Ellenőrzés, adószám');
    default:
      return null;
  }
}

export async function teamAssistRows(deps: Deps, db: DbOrTx, rows: AssistRow[]): Promise<TeamAssistRow[]> {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.clientId))];
  const cls = await db.select().from(clients).where(inArray(clients.id, ids));
  const accIds = [...new Set(cls.map((c) => c.accountantId).filter((x): x is string => Boolean(x)))];
  const accs = accIds.length ? await db.select().from(accountants).where(inArray(accountants.id, accIds)) : [];
  const cbIds = rows.map((r) => r.callbackId).filter((x): x is string => Boolean(x));
  const cbs = cbIds.length ? await db.select({ id: callbackRequests.id, due: callbackRequests.dueAt }).from(callbackRequests).where(inArray(callbackRequests.id, cbIds)) : [];
  const refs = await staffRefs(db, rows.map((r) => r.assignedUserId));
  const today = todayBudapest(deps.now());
  // Before the UJEGYKE: is the client still the blocker (contract not accepted, no adóazonosító jel)?
  const pre = rows.filter((r) => r.status === 'egyeztetve' || r.status === 'meghatalmazas_lejart').map((r) => r.clientId);
  const contractDone = new Set(
    pre.length
      ? (await db.select({ c: onboardingSteps.clientId }).from(onboardingSteps).where(and(inArray(onboardingSteps.clientId, pre), eq(onboardingSteps.step, 'szerzodes'), eq(onboardingSteps.status, 'kesz')))).map((x) => x.c)
      : [],
  );
  return rows.map((r) => {
    const cl = cls.find((c) => c.id === r.clientId)!;
    const a = accs.find((x) => x.id === cl.accountantId);
    const notReady = pre.includes(r.clientId) && !(contractDone.has(cl.id) && cl.adoazonositoJelEnc && cl.firstName && cl.lastName);
    return {
      id: r.id,
      client: { id: cl.id, name: clientName(cl), lifecycle: cl.lifecycle },
      kind: r.kind,
      status: r.status,
      ball: notReady && (r.status === 'egyeztetve' || r.status === 'meghatalmazas_lejart') ? 'ugyfel' : ASSIST_BALL[r.status],
      statusSince: r.statusChangedAt.toISOString(),
      daysInStatus: Math.max(0, daysBetween(todayBudapest(r.statusChangedAt), today)),
      nextDue: nextDueOf(deps, r, cbs.find((x) => x.id === r.callbackId)?.due ?? null, notReady),
      approvalDueOn: r.approvalDueOn,
      callbackId: r.callbackId,
      registrationId: r.registrationId,
      accountant: a ? { id: a.id, userId: a.userId, name: a.displayName } : null,
      assignee: r.assignedUserId ? (refs.get(r.assignedUserId) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

const PHASE_TITLES: Record<AssistCheckPhase, string> = {
  hivas: 'Hívás',
  ujegyke: 'Meghatalmazás (UJEGYKE)',
  bejelentes: 'Bejelentés a Vállalkozói Ügysegédben',
  // SPEC §28.5.5 change kinds
  valtozas_adatok: 'Az új adatok ellenőrzése',
  valtozas_bejelentes: 'Változásbejelentés meghatalmazottként',
};

const TIMELINE_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  'assist.created': () => 'Kérés érkezett',
  'assist.linked': () => 'A nyitott visszahívás ehhez a kéréshez került',
  'assist.upgraded': () => 'A meghatalmazás-kérésből vállalkozás-bejelentés lett',
  'assist.converted': () => 'Meghatalmazás-kéréssé alakult (a bejelentés nem kell)',
  'assist.agreed': () => 'Egyeztettünk – elindult',
  'assist.ujegyke_filed': (d) => (d.refile ? 'UJEGYKE újra beküldve' : 'UJEGYKE beküldve, jóváhagyásra vár'),
  'assist.client_approved': () => 'Az ügyfél jelezte: jóváhagyta',
  'assist.client_unapproved': () => 'Az ügyfél visszavonta: mégsem hagyta még jóvá',
  'assist.expired': (d) => (d.by === 'rendszer' ? 'Lejárt a 4 nap (automatikusan)' : 'Lejárt a 4 nap'),
  'assist.mh_live': () => 'Él a meghatalmazás',
  'assist.consent_given': () => 'Az ügyfél engedélyezte a bejelentést',
  'assist.consent_invalidated': () => 'A kérdőív változott – új engedély kell',
  'assist.ev_filed': () => 'Bejelentés beküldve',
  'assist.done': () => 'Kész',
  'assist.cancelled': () => 'Az ügyfél lemondta',
  'assist.closed': (d) => `Lezárva: ${String(d.reason ?? '')}`,
  'assist.assigned': (d) => (d.toUserId ? 'Gazdája lett' : 'Gazda nélkül'),
  'assist.check_ticked': (d) => `${d.done ? 'Kipipálva' : 'Pipa levéve'}: ${ASSIST_CHECK_LABELS[d.item as AssistCheckItem] ?? String(d.item)}`,
};

/** The actions the CURRENT user may do now (role + status; `ready` = the client may be represented, see readyForUjegyke). */
export function allowedActions(row: AssistRow, kind: AssistActorKind, ready = true): AssistAction[] {
  const byStatus: Partial<Record<AssistStatus, AssistAction[]>> = {
    visszahivas_kerve: ['egyeztetve', 'lezaras'],
    egyeztetve: ready ? ['ujegyke_bekuldve', 'lezaras'] : ['lezaras'],
    meghatalmazas_bekuldve: ['lejart', 'meghatalmazas_el', 'lezaras'],
    meghatalmazas_lejart: ready ? ['ujegyke_bekuldve', 'meghatalmazas_el', 'lezaras'] : ['meghatalmazas_el', 'lezaras'],
    // 11-19 javítás: "Nem él – a NAV törölte" after a mistaken "Jóváhagytam" (then the normal re-filing).
    meghatalmazas_jovahagyva: ['meghatalmazas_el', 'lejart', 'lezaras'],
    meghatalmazas_el: ['lezaras'],
    ugyfel_engedelyezte: ['bejelentes_bekuldve', 'lezaras'],
    bejelentes_bekuldve: ['lezaras'],
  };
  return (byStatus[row.status] ?? []).filter((a) => ASSIST_ACTION_ROLES[a].includes(kind)).filter((a) => !(a === 'bejelentes_bekuldve' && !row.consentValid));
}

export async function teamAssistDetail(deps: Deps, db: DbOrTx, actor: StaffActor, row: AssistRow, kind: AssistActorKind, card: TeamAssistDetail['clientCard']): Promise<TeamAssistDetail> {
  const [base] = await teamAssistRows(deps, db, [row]);
  const cl = await clientRow(db, row.clientId);
  const notReadyReasons = await notReadyForUjegyke(db, cl);
  const checklist = ASSIST_PHASES[row.kind].map((phase) => ({
    phase,
    title: PHASE_TITLES[phase],
    items: phaseItems(row.kind, phase).map((item) => {
      const t = row.checklist?.[item];
      return { item, label: ASSIST_CHECK_LABELS[item], done: Boolean(t), doneAt: t?.at ?? null, by: null as TeamAssistDetail['checklist'][number]['items'][number]['by'] };
    }),
  }));
  const hist = await db.select().from(auditLog).where(and(eq(auditLog.targetType, 'assist'), eq(auditLog.targetId, row.id))).orderBy(desc(auditLog.at), desc(auditLog.id));
  const tickers = Object.values(row.checklist ?? {}).map((x) => x.by);
  const refs = await staffRefs(db, [...hist.map((h) => h.actorUserId), ...tickers]);
  for (const ph of checklist) for (const it of ph.items) if (row.checklist?.[it.item]) it.by = refs.get(row.checklist[it.item]!.by) ?? null;
  // Full adóazonosító jel: only for the client's own accountant and admins (audited); the team sees it masked.
  let full: string | null = null;
  if ((kind === 'konyvelo' || kind === 'admin') && cl.adoazonositoJelEnc && isOpenAssist(row.status)) {
    try {
      full = deps.data.dec(cl.adoazonositoJelEnc, 'clients.adoazonosito_jel');
      await audit(db, { action: 'assist.data_viewed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'assist', targetId: row.id, clientId: cl.id });
    } catch {
      full = null;
    }
  }
  // B3 (§24 note 12:40): the 4-day timer of the panel.
  const approvalExtra = {
    approval: row.ujegykeFiledAt
      ? {
          filedAt: row.ujegykeFiledAt.toISOString(),
          dueOn: row.approvalDueOn,
          expiresAt: row.approvalExpiresAt?.toISOString() ?? null,
          remindersSent: row.approvalReminders,
          clientApprovedAt: row.clientApprovedAt?.toISOString() ?? null,
          expiredCount: row.expiredCount,
        }
      : null,
  };
  return {
    ...base!,
    ...approvalExtra,
    clientCard: card,
    checklist,
    filingData: isOpenAssist(row.status)
      ? {
          name: clientName(cl),
          adoazonositoJel: full,
          adoazonositoJelMasked: maskAdoazonosito(cl.adoazonositoLast3),
          jogcim: row.ujegykeJogcim ?? deps.cfg.assist.ujegykeJogcim,
          ugycsoportok: row.kind === 'vallalkozas_bejelentes' ? EV_UGYCSOPORTOK : ugykorok(deps),
        }
      : null,
    consentSnapshot:
      row.consentAt && row.consentHash && row.consentSnapshot
        ? { at: row.consentAt.toISOString(), hash: row.consentHash, version: row.consentVersion ?? evUtasitasVersion(deps), blocks: row.consentSnapshot.map((b) => ({ title: b.title, lines: b.lines })) }
        : null,
    answersMatchConsent: await answersMatchConsent(deps, db, row),
    timeline: hist
      .filter((h) => TIMELINE_TEXT[h.action])
      .map((h) => ({ at: h.at.toISOString(), by: h.actorUserId ? (refs.get(h.actorUserId) ?? null) : null, action: h.action, text: TIMELINE_TEXT[h.action]!((h.details ?? {}) as Record<string, unknown>) })),
    allowedActions: allowedActions(row, kind, notReadyReasons.length === 0),
    readyForUjegyke: notReadyReasons.length === 0,
    notReadyReasons,
    staffNote: row.staffNote,
  };
}

/** Client card line (SPEC §27.6.4): the open assist, else the last closed one. */
export async function cardAssist(db: DbOrTx, clientId: string): Promise<{ id: string; kind: AssistKind; status: AssistStatus } | null> {
  const [r] = await assistsOfClient(db, clientId);
  return r ? { id: r.id, kind: r.kind, status: r.status } : null;
}

