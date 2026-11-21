// SPEC §28.K.5 – unpaid fee lock ("zárolás"). Locked when (a) the subscription is 'suspended' (the existing retry
// schedule ran out) or (b) an annual-closing charge is unpaid 14 days after the questionnaire was sent. Stored in
// clients.service_lock and recomputed on every payment event and by the daily job. While locked the accounting service
// stops (API 403 service_locked on the listed client and staff actions); paying, the GDPR export, Fiók, notification
// settings and writing to customer service keep working.
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { ServiceLockView } from '../_shared/api.js';
import { ANNUAL_RULES, SERVICE_LOCK_ERROR_CODE, type ServiceLockReason } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, assistRequests, clients, feeCharges, subscriptions, taxCalculations, taxPeriods } from '../db/schema.js';
import { audit } from '../audit.js';
import { auth, type Env } from '../http/core.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { ApiError } from '../lib/errors.js';
import { huArticle } from '../lib/nevelo.js';
import { accountantParams, notify } from '../notify/notify.js';
import { accountantUserOf } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { fmt } from './kedvezmeny.js';
import { planAmountHuf } from './dijak.js';

export type ServiceLock = { reasons: ServiceLockReason[]; since: string; amountHuf: number };

export async function lockReasonsOf(deps: Deps, db: DbOrTx, clientId: string): Promise<{ reasons: ServiceLockReason[]; amountHuf: number }> {
  const reasons: ServiceLockReason[] = [];
  let amount = 0;
  // SPEC §29.9.4: the admin's manual lock ('zarolva' → reason 'kezi') or grace ('feloldva' until a day: no automatic lock)
  const [man] = await db.select({ m: clients.serviceLockManual }).from(clients).where(eq(clients.id, clientId)).limit(1);
  const manual = man?.m ?? null;
  const today = todayBudapest(deps.now());
  if (manual?.mode === 'zarolva') reasons.push('kezi');
  if (manual?.mode === 'feloldva' && (!manual.until || manual.until >= today)) return { reasons, amountHuf: 0 };
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (sub?.status === 'suspended') {
    reasons.push('havidij');
    // k7c2 B4: the amount "Fizesd ki" really asks (pause fee, own price, discount) – never the plain plan fee
    const { duePeriod } = await import('./payments.js');
    const due = await duePeriod(deps, db, clientId);
    amount += due ? due.amountHuf : await planAmountHuf(deps, db, sub.planCode);
  }
  // k8: a díjbekérő 8 days late locks only while the switch kapcsolok.fizetes.kesesLeallit is ON (default OFF)
  const { transferLockOf } = await import('./atutalas.js');
  const tl = await transferLockOf(deps, db, clientId);
  if (tl.locked) {
    reasons.push('atutalas_kesik');
    amount += tl.amountHuf;
  }
  const cutoff = new Date(deps.now().getTime() - ANNUAL_RULES.lockAfterDays * 86_400_000);
  const annual = await db.select().from(annualClosings).where(and(eq(annualClosings.clientId, clientId), eq(annualClosings.status, 'dijra_var'), lt(annualClosings.submittedAt, cutoff)));
  for (const a of annual) {
    if (!a.feeChargeId) continue;
    const [ch] = await db.select().from(feeCharges).where(and(eq(feeCharges.id, a.feeChargeId), eq(feeCharges.status, 'nyitott'))).limit(1);
    if (ch) {
      if (!reasons.includes('eves_zaras')) reasons.push('eves_zaras');
      amount += ch.amountHuf;
    }
  }
  return { reasons, amountHuf: amount };
}

/** Recomputes clients.service_lock and sends the lock / unlock notifications on a change. Returns the new lock. */
export async function computeServiceLock(deps: Deps, clientId: string): Promise<ServiceLock | null> {
  const db = deps.db;
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return null;
  const { reasons, amountHuf } = await lockReasonsOf(deps, db, clientId);
  const was = cl.serviceLock ?? null;
  const next: ServiceLock | null = reasons.length ? { reasons, since: was?.since ?? todayBudapest(deps.now()), amountHuf } : null;
  if (JSON.stringify(was) === JSON.stringify(next)) return next;
  await db.update(clients).set({ serviceLock: next, updatedAt: deps.now() }).where(eq(clients.id, clientId));
  const params = await accountantParams(db, cl.accountantId);
  const mit = await mitText(deps, reasons);
  if (next && !was) {
    await audit(db, { action: 'lock.on', actorRole: 'system', targetType: 'client', targetId: clientId, clientId, details: { reasons } });
    await notify(deps, db, { userId: cl.userId, kind: 'service_locked', ...(reasons.length === 1 && reasons[0] === 'kezi' ? { variant: 'kezi' } : {}), params: { ...params, mit, osszeg: fmt(amountHuf) }, link: reasons.includes('havidij') || reasons.includes('atutalas_kesik') ? '/fiok/elofizetes' : reasons.includes('eves_zaras') ? '/fiok/dijak' : '/uzenetek' });
    const acc = await accountantUserOf(db, cl);
    if (acc) await notify(deps, db, { userId: acc.userId, kind: 'client_locked', params: { clientName: clientName(cl), mit, osszeg: fmt(amountHuf) }, link: `/ugyfelek/${cl.id}` });
  } else if (!next && was) {
    await audit(db, { action: 'lock.off', actorRole: 'system', targetType: 'client', targetId: clientId, clientId });
    // k8 (payment-path review 4): "Köszönjük a fizetést" only when money really came – a manual unlock or the late-transfer
    // switch turned off (the díjbekérő still unpaid) gets the plain variant
    const { transferRequests } = await import('../db/schema.js');
    const manualOrLate = was.reasons.every((r) => r === 'kezi' || r === 'atutalas_kesik');
    const [stillLate] = was.reasons.includes('atutalas_kesik')
      ? await db.select({ id: transferRequests.id }).from(transferRequests).where(and(eq(transferRequests.clientId, clientId), eq(transferRequests.status, 'kesik'))).limit(1)
      : [];
    const noPayment = manualOrLate && (Boolean(stillLate) || !was.reasons.includes('atutalas_kesik'));
    await notify(deps, db, { userId: cl.userId, kind: 'service_unlocked', ...(noPayment ? { variant: 'feloldva' } : {}), params, link: '/' });
  }
  return next;
}

export async function mitText(deps: Deps, reasons: ServiceLockReason[]): Promise<string> {
  const parts: string[] = [];
  // k7b: a manual lock is no unpaid item – next to a real one it is left out ("nincs kifizetve a havidíj", never
  // "… az a könyvelésed és a havidíj"); alone it keeps its own text
  const list = reasons.length > 1 ? reasons.filter((r) => r !== 'kezi') : reasons;
  for (const r of list) parts.push(await deps.content.get(`zarolas.mit.${r}`));
  // k7b: "havidíj és az éves zárás díja" – the article of each later part follows its own first word (the first part's
  // article stands in the template: "a {mit}")
  return parts.map((p, i) => (i === 0 ? p : `${huArticle(p)} ${p}`)).join(' és ');
}

export async function serviceLockView(deps: Deps, cl: ClientRow): Promise<ServiceLockView | null> {
  const l = cl.serviceLock;
  if (!l) return null;
  const params = await accountantParams(deps.db, cl.accountantId);
  const mit = await mitText(deps, l.reasons);
  const onlyManual = l.reasons.length === 1 && l.reasons[0] === 'kezi';
  return {
    reasons: l.reasons,
    since: l.since,
    amountHuf: l.amountHuf,
    // SPEC §29.9.4: a manual lock has its own short text (no amount)
    text: onlyManual ? await deps.content.render('k29.zarolas.kezi_banner', params) : await deps.content.render('zarolas.banner', { ...params, mit, osszeg: fmt(l.amountHuf) }),
    payRoute: l.reasons.includes('havidij') || l.reasons.includes('atutalas_kesik') ? '/fiok/elofizetes' : l.reasons.includes('eves_zaras') ? '/fiok/dijak' : '/uzenetek',
  };
}

export async function lockedError(deps: Deps, cl: Pick<ClientRow, 'serviceLock' | 'accountantId'>): Promise<ApiError> {
  const mit = await mitText(deps, cl.serviceLock?.reasons ?? ['havidij']);
  const e = new ApiError(403, SERVICE_LOCK_ERROR_CODE, await deps.content.render('zarolas.locked_action', { mit }));
  e.errorExtra = { reason: cl.serviceLock?.reasons ?? [] };
  return e;
}

/** Client writes that stop while the service is locked (SERVICE_LOCK_RULES.lockedClient). Path relative to /client. */
const CLIENT_LOCKED: [string, RegExp][] = [
  ['POST', /^\/requests$/],
  ['POST', /^\/assist$/],
  ['PUT', /^\/assist\/[^/]+\/change$/],
  ['POST', /^\/assist\/[^/]+\/consent$/],
  ['PUT', /^\/allowances\/answers$/],
  ['POST', /^\/annual\/[^/]+\/(submit|approve)$/],
];

/** Middleware on /client/*: 403 service_locked for the locked writes. */
export function clientServiceLock(deps: Deps): MiddlewareHandler<Env> {
  return async (c, next) => {
    const m = c.req.method;
    if (m !== 'GET' && m !== 'HEAD') {
      const path = c.req.path.replace(/^.*?\/client(?=\/|$)/, '') || '/';
      if (CLIENT_LOCKED.some(([mm, re]) => mm === m && re.test(path))) {
        const [cl] = await deps.db.select({ serviceLock: clients.serviceLock, accountantId: clients.accountantId }).from(clients).where(eq(clients.userId, auth(c).userId)).limit(1);
        if (cl?.serviceLock) throw await lockedError(deps, cl);
      }
    }
    await next();
  };
}

/** Staff actions that stop while the client is locked (SERVICE_LOCK_RULES.lockedStaff); resolves the client id. */
export function staffServiceLock(deps: Deps, base: 'acc' | 'team'): MiddlewareHandler<Env> {
  return async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const path = c.req.path.replace(new RegExp(`^.*?/${base}(?=/|$)`), '') || '/';
    let clientId: string | null = null;
    let mt: RegExpExecArray | null;
    if (base === 'acc') {
      if ((mt = /^\/clients\/([0-9a-f-]{36})\/(requests|allowances\/[^/]+\/decision|annual\/[^/]+\/(filed-szja|filed-hipa))$/.exec(path))) clientId = mt[1]!;
      else if ((mt = /^\/tax-calculations\/([0-9a-f-]{36})\/approve$/.exec(path))) {
        const [r] = await deps.db.select({ clientId: taxPeriods.clientId }).from(taxCalculations).innerJoin(taxPeriods, eq(taxPeriods.id, taxCalculations.taxPeriodId)).where(eq(taxCalculations.id, mt[1]!)).limit(1);
        clientId = r?.clientId ?? null;
      } else if ((mt = /^\/tax-periods\/([0-9a-f-]{36})\/(letter|filed)$/.exec(path))) {
        const [r] = await deps.db.select({ clientId: taxPeriods.clientId }).from(taxPeriods).where(eq(taxPeriods.id, mt[1]!)).limit(1);
        clientId = r?.clientId ?? null;
      }
    } else if ((mt = /^\/assists\/([0-9a-f-]{36})\/(ev-filed|change-done)$/.exec(path))) {
      const [r] = await deps.db.select({ clientId: assistRequests.clientId }).from(assistRequests).where(eq(assistRequests.id, mt[1]!)).limit(1);
      clientId = r?.clientId ?? null;
    }
    if (clientId) {
      const [cl] = await deps.db.select({ serviceLock: clients.serviceLock, accountantId: clients.accountantId }).from(clients).where(eq(clients.id, clientId)).limit(1);
      if (cl?.serviceLock) {
        const e = new ApiError(403, SERVICE_LOCK_ERROR_CODE, await deps.content.get('zarolas.panel_disabled'));
        e.errorExtra = { reason: cl.serviceLock.reasons };
        throw e;
      }
    }
    await next();
  };
}

/** Daily (06:20, after billing): every client with a suspended subscription or an overdue annual charge, and every locked one. */
export async function jobServiceLockCheck(deps: Deps): Promise<number> {
  const db = deps.db;
  const ids = new Set<string>();
  for (const r of await db.select({ id: subscriptions.clientId }).from(subscriptions).where(eq(subscriptions.status, 'suspended'))) ids.add(r.id);
  for (const r of await db.select({ id: annualClosings.clientId }).from(annualClosings).where(eq(annualClosings.status, 'dijra_var'))) ids.add(r.id);
  // k8: late díjbekérők (the lock itself only with kesesLeallit ON – lockReasonsOf decides)
  const { transferRequests } = await import('../db/schema.js');
  for (const r of await db.select({ id: transferRequests.clientId }).from(transferRequests).where(eq(transferRequests.status, 'kesik'))) ids.add(r.id);
  for (const r of await db.select({ id: clients.id, l: clients.serviceLock, m: clients.serviceLockManual }).from(clients)) if (r.l || r.m) ids.add(r.id);
  let n = 0;
  for (const id of ids) if (await computeServiceLock(deps, id)) n++;
  // one extra notice when a tax deadline is within 14 days while locked
  const today = todayBudapest(deps.now());
  const locked = await db.select().from(clients).where(inArray(clients.id, [...ids]));
  for (const cl of locked) {
    if (!cl.serviceLock) continue;
    const soon = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), isNull(taxPeriods.hiddenAt), inArray(taxPeriods.paymentStatus, ['fizetendo', 'nincs_fizetendo'])));
    const near = soon.find((p) => p.dueDate >= today && p.dueDate <= addDays(today, 14));
    if (!near) continue;
    const { notifyOnce } = await import('./emlekezteto.js');
    await notifyOnce(deps, `rem:service_locked:${cl.id}:${near.periodKey}`, { userId: cl.userId, kind: 'service_locked', variant: 'hatarido', params: { date: near.dueDate }, link: '/fiok/elofizetes' });
  }
  return n;
}
