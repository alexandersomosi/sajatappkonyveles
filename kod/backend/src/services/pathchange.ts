// SPEC §27.2 – the answer to "Van már egyéni vállalkozásod?" can be changed in the app as long as nothing reached the
// NAV in the client's name and he has not entered an adószám; after that only through a callback, and the team changes
// it (POST /team/clients/:id/path). Data of both branches are kept: a withdrawn, never-filed questionnaire is REOPENED
// instead of a new one being created. Every change: one transaction, clients.business_status_changed_at, audit
// 'business_status.changed', and (not for the first answer or a 30-second undo) the staff badge 'client_path_changed'.
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { PathChangeInfo, PathHistoryItem } from '../_shared/api.js';
import { PATH_CHANGE_ERROR_CODE, REGISTRATION_STEP_STATUS, type BusinessStatus, type PathChangeBlocker } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { auditLog, businessRegistrations, clients } from '../db/schema.js';
import { audit } from '../audit.js';
import { ApiError } from '../lib/errors.js';
import { notify } from '../notify/notify.js';
import { onLeaveInditas, openAssistOf } from './assist.js';
import { openCallbackOf } from './callbacks.js';
import { afterProfileSubmitted, setStep, stepStatus } from './onboarding.js';
import { clientName, type ClientRow } from './people.js';
import { currentRegistrationOf, FILED_OR_LATER, openRegistrationOf, transition } from './registration.js';
import { accountantUserOf, queueOwners } from './team.js';

/** withdraw_note of an empty registration left by an undo (hidden from the team's pipeline). */
export const WITHDRAW_NOTE_UNDO = 'visszavonta';

/** "Visszavonom" on the toast: a change back within this window is an undo (no staff badge, audited as such). */
export const PATH_UNDO_MS = 30_000;

export type PathActor = { userId: string | null; role: 'client' | 'csapat' | 'admin' };

/** The first blocker that applies (order of PATH_CHANGE_BLOCKERS); `to` = the direction asked (null = any). */
export async function pathBlocker(db: DbOrTx, cl: ClientRow, to: BusinessStatus | null): Promise<PathChangeBlocker | null> {
  if (cl.lifecycle !== 'bekotes_alatt') return 'nem_bekotes_alatt';
  const reg = await currentRegistrationOf(db, cl.id);
  if (reg && reg.status !== 'elallt' && FILED_OR_LATER.includes(reg.status)) return 'bejelentes_bekuldve';
  const ev = await openAssistOf(db, cl.id, 'vallalkozas_bejelentes');
  if (ev && (ev.status === 'ugyfel_engedelyezte' || ev.status === 'bejelentes_bekuldve')) return 'bejelentes_engedelyezve';
  const dir = to ?? (cl.businessStatus === 'van' ? 'inditas' : cl.businessStatus === 'inditas' ? 'van' : null);
  if (cl.businessStatus === 'van' && dir === 'inditas' && cl.adoszam) return 'adoszam_megadva';
  return null;
}

export async function blockedError(deps: Deps, blocker: PathChangeBlocker): Promise<ApiError> {
  const reason = await deps.content.render(`bekotes.ut.zarolt.${blocker}`, {});
  return new ApiError(409, PATH_CHANGE_ERROR_CODE, await deps.content.render('bekotes.ut.valtas.blocked', { reason }), undefined, { blocker });
}

export async function pathChangeInfo(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<PathChangeInfo> {
  const current = cl.businessStatus ?? null;
  const reg = current === 'inditas' ? await openRegistrationOf(db, cl.id) : null;
  const blocker = await pathBlocker(db, cl, null);
  let confirmText: string | null = null;
  if (!blocker && current === 'van') confirmText = await deps.content.render('bekotes.ut.valtas.to_inditas', {});
  if (!blocker && current === 'inditas') {
    confirmText = await deps.content.render('bekotes.ut.valtas.to_van', {});
    if (await openAssistOf(db, cl.id, 'vallalkozas_bejelentes')) confirmText = `${confirmText} ${await deps.content.render('bekotes.ut.valtas.to_van_assist', {})}`;
  }
  return {
    current,
    mode: current === 'inditas' ? (reg?.mode ?? 'onallo') : null,
    canChange: !blocker,
    blocker,
    blockerText: blocker ? await deps.content.render(`bekotes.ut.zarolt.${blocker}`, {}) : null,
    confirmText,
    changedAt: cl.businessStatusChangedAt?.toISOString() ?? null,
  };
}

/** NULL/van → inditas: reopen the newest never-filed withdrawn registration, else create one (mode 'onallo'). */
async function enterInditas(deps: Deps, db: DbOrTx, cl: ClientRow, by: PathActor): Promise<void> {
  const now = deps.now();
  if (await openRegistrationOf(db, cl.id)) return;
  const [last] = await db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, cl.id)).orderBy(desc(businessRegistrations.createdAt)).limit(1);
  if (last && last.status === 'elallt' && !last.filedAt) {
    const to = last.submittedAt ? 'utmutato' : 'kitoltes';
    await db
      .update(businessRegistrations)
      .set({ status: to, statusChangedAt: now, withdrawnAt: null, withdrawReason: null, withdrawNote: null, mode: 'onallo', updatedAt: now })
      .where(eq(businessRegistrations.id, last.id));
    await setStep(deps, db, cl.id, 'vallalkozas_inditas', REGISTRATION_STEP_STATUS[to], { note: null });
    await audit(db, { action: 'registration.reopened', actorUserId: by.userId, actorRole: by.role, targetType: 'business_registration', targetId: last.id, clientId: cl.id, details: { from: 'elallt', to } });
    return;
  }
  const [created] = await db.insert(businessRegistrations).values({ clientId: cl.id, status: 'kitoltes', mode: 'onallo', answers: {}, statusChangedAt: now, createdAt: now, updatedAt: now }).returning();
  await setStep(deps, db, cl.id, 'vallalkozas_inditas', 'ugyfelre_var', { note: null });
  await audit(db, { action: 'registration.created', actorUserId: by.userId, actorRole: by.role, targetType: 'business_registration', targetId: created!.id, clientId: cl.id, details: { mode: 'onallo' } });
}

/**
 * inditas → van (also the withdraw reason 'mar_van_vallalkozasa'): the open registration → 'elallt' (answers kept),
 * the open EV assist ends or becomes a meghatalmazás request, and the "Rólad" page is not the full data form.
 */
export async function leaveInditas(
  deps: Deps,
  db: DbOrTx,
  cl: ClientRow,
  by: PathActor,
  o: { reason?: 'mar_van_vallalkozasa' | 'kesobb_inditom' | 'meggondolta' | 'egyeb'; note?: string | null; undo?: boolean } = {},
): Promise<void> {
  const reason = o.reason ?? 'mar_van_vallalkozasa';
  const open = await openRegistrationOf(db, cl.id);
  if (open) {
    // 11-19 javító kör 2: the toast's "Visszavonom" right after "Még nincs" leaves an EMPTY questionnaire behind – that
    // client never started a registration, so the row is marked 'visszavonta' and the team's pipeline hides it.
    const empty = !open.submittedAt && Object.keys((open.answers ?? {}) as Record<string, unknown>).length === 0;
    const note = o.undo && empty ? WITHDRAW_NOTE_UNDO : (o.note ?? (reason === 'mar_van_vallalkozasa' ? 'utvaltas' : null));
    await transition(
      deps,
      db,
      open,
      'elallt',
      { withdrawnAt: deps.now(), withdrawReason: reason, withdrawNote: note },
      { action: 'registration.withdrawn', actorUserId: by.userId, actorRole: by.role, details: { reason, utvaltas: reason === 'mar_van_vallalkozasa' && note !== WITHDRAW_NOTE_UNDO, ...(note === WITHDRAW_NOTE_UNDO ? { undo: true } : {}) } },
    );
  }
  await onLeaveInditas(deps, db, cl.id, by);
}

export interface PathChangeResult {
  from: BusinessStatus | null;
  to: BusinessStatus;
  undo: boolean;
  changed: boolean;
  /** An undo that takes back a change the staff were already told about: they get the final state too. */
  reversedNotified?: boolean;
}

/** The "Rólad" fields (name, phone, adóazonosító jel, lakcím) are all stored – the short data step of 'inditas' is done. */
export function roladComplete(cl: ClientRow): boolean {
  return Boolean(cl.firstName?.trim() && cl.lastName?.trim() && cl.phoneEnc && cl.adoazonositoJelEnc && cl.addressZip && cl.addressCity && cl.addressLine);
}

/** Applies a branch change (client or staff). Blockers must be checked by the caller. */
export async function applyPathChange(deps: Deps, db: DbOrTx, cl: ClientRow, to: BusinessStatus, by: PathActor, o: { note?: string; clearAdoszam?: boolean; undo?: boolean } = {}): Promise<PathChangeResult> {
  const from = cl.businessStatus ?? null;
  if (from === to) return { from, to, undo: false, changed: false };
  const now = deps.now();
  // An undo = ONLY the toast's "Visszavonom" (the app sends `undo: true`) within 30 s of the last change. A change made
  // through the normal "Módosítom" sheet is a real change, however soon it follows the previous one (11-19 javítás).
  const undo = Boolean(o.undo && from && cl.businessStatusChangedAt && now.getTime() - cl.businessStatusChangedAt.getTime() <= PATH_UNDO_MS && by.role === 'client');
  let reversedNotified = false;
  if (undo) {
    const [last] = await db
      .select({ action: auditLog.action, details: auditLog.details })
      .from(auditLog)
      .where(and(eq(auditLog.clientId, cl.id), eq(auditLog.targetType, 'client'), inArray(auditLog.action, ['business_status.set', 'business_status.changed'])))
      .orderBy(desc(auditLog.at), desc(auditLog.id))
      .limit(1);
    reversedNotified = last?.action === 'business_status.changed' && !(last.details as { undo?: boolean } | null)?.undo;
  }
  const oldAdoszam = cl.adoszam;
  if (to === 'inditas') {
    await enterInditas(deps, db, cl, by);
    // SPEC §27.2.2 + 11-19 javítás: the "Rólad" page is a subset of the van form. If name, phone, adóazonosító jel and
    // lakcím are all stored (an earlier Rólad save, or page 1 of the van form), the data step stays / becomes done –
    // switching back and forth never asks the client to redo what he did.
    if ((await stepStatus(db, cl.id, 'adatok')) !== 'kesz' && roladComplete(cl)) {
      await setStep(deps, db, cl.id, 'adatok', 'kesz');
      await afterProfileSubmitted(deps, db, cl.id);
    }
  } else {
    if (from === 'inditas') await leaveInditas(deps, db, cl, by, { undo });
    // The short "Rólad" page is not the full data form of an existing business (it needs the adószám etc.).
    if (!cl.adoszam && (await stepStatus(db, cl.id, 'adatok')) === 'kesz') await setStep(deps, db, cl.id, 'adatok', 'ugyfelre_var');
  }
  await db
    .update(clients)
    .set({ businessStatus: to, businessStatusChangedAt: now, ...(o.clearAdoszam ? { adoszam: null } : {}), updatedAt: now })
    .where(eq(clients.id, cl.id));
  if (from === null) {
    await audit(db, { action: 'business_status.set', actorUserId: by.userId, actorRole: by.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { from, to } });
  } else {
    await audit(db, {
      action: 'business_status.changed',
      actorUserId: by.userId,
      actorRole: by.role,
      targetType: 'client',
      targetId: cl.id,
      clientId: cl.id,
      details: { from, to, by: by.role === 'client' ? 'ugyfel' : by.role, ...(undo ? { undo: true, note: 'visszavonta' } : {}) },
    });
  }
  if (by.role !== 'client') {
    // The old adószám is public register data (Evectv. 12. §); kept in the audit for the team's trail.
    await audit(db, { action: 'team.path_changed', actorUserId: by.userId, actorRole: by.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { from, to, ...(o.clearAdoszam ? { clearedAdoszam: oldAdoszam } : {}) } });
  }
  return { from, to, undo, changed: true, reversedNotified };
}

/** Staff badge (csapat, admin, the client's accountant): not for the first answer and not for an undo. */
export async function notifyPathChanged(deps: Deps, db: DbOrTx, cl: ClientRow, r: PathChangeResult, exceptUserId: string | null): Promise<void> {
  // An undo is not news – unless it takes back a change the staff were told about: then they get the final state.
  if (!r.changed || r.from === null || (r.undo && !r.reversedNotified)) return;
  const lbl = async (x: BusinessStatus | null) => deps.content.render(x === 'van' ? 'bekotes.ut.path_van' : 'bekotes.ut.path_inditas', {});
  const n = { kind: 'client_path_changed' as const, params: { clientName: clientName(cl), fromLabel: await lbl(r.from), toLabel: await lbl(r.to) }, data: { clientId: cl.id }, noEmail: true, noPush: true };
  // Staff links are panel routes (B3 §24 note): the team lands on the registration (or the callback), the accountant
  // on his client page.
  const [reg] = await db.select({ id: businessRegistrations.id }).from(businessRegistrations).where(eq(businessRegistrations.clientId, cl.id)).orderBy(desc(businessRegistrations.createdAt)).limit(1);
  const cb = await openCallbackOf(db, cl.id);
  const teamLink = reg ? `/vallalkozas-inditas/${reg.id}` : cb ? `/visszahivasok?nyit=${cb.id}` : `/ugyfelek/${cl.id}`;
  const acc = await accountantUserOf(db, cl);
  const sent = new Set<string>();
  for (const u of await queueOwners(db)) {
    if (u.userId === exceptUserId) continue;
    sent.add(u.userId);
    await notify(deps, db, { ...n, userId: u.userId, link: acc?.userId === u.userId ? `/ugyfelek/${cl.id}` : teamLink });
  }
  if (acc && !sent.has(acc.userId) && acc.userId !== exceptUserId) await notify(deps, db, { ...n, userId: acc.userId, link: `/ugyfelek/${cl.id}` });
}

/** Panel: the last 5 branch changes, newest first (TeamClientCard.pathHistory). */
export async function pathHistory(db: DbOrTx, clientId: string): Promise<PathHistoryItem[]> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.clientId, clientId), eq(auditLog.targetType, 'client')))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(200);
  const out: PathHistoryItem[] = [];
  for (const h of rows) {
    if (h.action !== 'business_status.set' && h.action !== 'business_status.changed') continue;
    const d = (h.details ?? {}) as { from?: BusinessStatus | null; to?: BusinessStatus | null; undo?: boolean; by?: string };
    const by = h.actorRole === 'client' ? 'ugyfel' : h.actorRole === 'csapat' ? 'csapat' : h.actorRole === 'admin' ? 'admin' : 'rendszer';
    out.push({ at: h.at.toISOString(), from: d.from ?? null, to: d.to ?? null, by, note: d.undo ? 'Visszavonta 30 mp-en belül' : h.action === 'business_status.set' ? 'Első válasz' : null });
    if (out.length >= 5) break;
  }
  return out;
}

