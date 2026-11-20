// SPEC §29.9.6 – GDPR erasure = anonymisation, never a hard delete (both the owner console and the self-service
// deletion use anonymizeClientCore). UPDATES ONLY: the identity data go, the records the law requires stay
// (fee invoices + PDFs – Számv. tv. 169. §, payments – accounting, tax records and the documents the accountant worked
// with – Art. 202. §, KYC – Pmt. 57. §, the audit log). Irreversible.
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { PAYMENT_OPEN_STATUSES } from '../_shared/k29.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { calendarFeeds, callbackRequests, clients, messages, notifications, paymentMethods, payments, pushTokens, sessions, subscriptions, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { E } from '../lib/errors.js';
import { endRelationship } from './kyc.js';

export interface AnonymizeBlockers {
  ok: boolean;
  blockers: string[];
}

/** Preconditions of the console erasure: the subscription is canceled (or none) and no money is in flight. */
export async function anonymizeBlockers(db: DbOrTx, clientId: string): Promise<AnonymizeBlockers> {
  const blockers: string[] = [];
  const [cl] = await db.select({ anonymizedAt: clients.anonymizedAt }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return { ok: false, blockers: ['Nincs ilyen ügyfél.'] };
  if (cl.anonymizedAt) return { ok: false, blockers: ['Már anonimizáltuk.'] };
  const [sub] = await db.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (sub && sub.status !== 'canceled') blockers.push('Az előfizetés még él – előbb mondd fel vagy zárd le.');
  const open = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.clientId, clientId), inArray(payments.status, [...PAYMENT_OPEN_STATUSES])))
    .limit(1);
  if (open.length) blockers.push('Fizetés van folyamatban – várd meg, amíg lezárul.');
  return { ok: blockers.length === 0, blockers };
}

export interface AnonymizeCounts {
  sessions: number;
  pushTokens: number;
  notifications: number;
  messages: number;
  callbacks: number;
  cards: number;
}

/**
 * The shared core (inside the caller's transaction). Returns how many rows each step changed (for the audit).
 * Never DELETEs. `legalHoldMessages` keeps the message bodies of the requests the law needs (none today).
 */
export async function anonymizeClientCore(deps: Deps, tx: DbOrTx, clientId: string): Promise<AnonymizeCounts> {
  const now = deps.now();
  const [cl] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) throw E.notFound();
  const userId = cl.userId;
  await tx
    .update(users)
    .set({
      email: `torolt+${userId}@deleted.invalid`,
      passwordHash: null,
      googleSub: null,
      appleSub: null,
      totpSecretEnc: null,
      totpPendingEnc: null,
      totpEnabledAt: null,
      recoveryCodes: null,
      displayName: 'Törölt felhasználó',
      status: 'deleted',
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
  await tx
    .update(clients)
    .set({
      lastName: 'Törölt',
      firstName: 'ügyfél',
      birthName: null,
      phoneEnc: null,
      adoazonositoJelEnc: null,
      adoazonositoHmac: null,
      adoazonositoLast3: null,
      addressZip: null,
      addressCity: null,
      addressLine: null,
      attribution: null,
      personalReferralCode: null,
      mailboxCode: null,
      mailboxSenders: [],
      lifecycle: 'megszunt',
      anonymizedAt: now,
      updatedAt: now,
    })
    .where(eq(clients.id, clientId));
  const s = await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt))).returning({ id: sessions.id });
  const p = await tx.update(pushTokens).set({ disabledAt: now }).where(and(eq(pushTokens.userId, userId), isNull(pushTokens.disabledAt))).returning({ id: pushTokens.id });
  const n = await tx.update(notifications).set({ title: '—', body: '—', data: {} }).where(eq(notifications.userId, userId)).returning({ id: notifications.id });
  const m = await tx
    .update(messages)
    .set({ body: '[törölve]' })
    .where(and(eq(messages.clientId, clientId), eq(messages.senderRole, 'client'), ne(messages.body, '[törölve]')))
    .returning({ id: messages.id });
  const cb = await tx.update(callbackRequests).set({ phoneEnc: null, phoneMasked: null, note: null, needsNewPhone: false }).where(eq(callbackRequests.clientId, clientId)).returning({ id: callbackRequests.id });
  await tx.update(calendarFeeds).set({ revokedAt: now }).where(and(eq(calendarFeeds.clientId, clientId), isNull(calendarFeeds.revokedAt)));
  // the saved cards stop being usable at once; the Stripe side (detach + customer e-mail/name null) runs after commit
  const cards = await tx
    .update(paymentMethods)
    .set({ status: 'torolve', detachedAt: now })
    .where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.status, 'aktiv')))
    .returning({ id: paymentMethods.id });
  await endRelationship(tx, clientId, now);
  deps.sessionCache.clear();
  return { sessions: s.length, pushTokens: p.length, notifications: n.length, messages: m.length, callbacks: cb.length, cards: cards.length };
}

/** Owner console erasure (§29.9.6). The route checked the admin, the step-up, the reason and confirmName. */
export async function anonymizeClient(deps: Deps, clientId: string, o: { by: string; reason: string; requestId?: string | null; ipHmac?: string | null }): Promise<AnonymizeCounts> {
  const pre = await anonymizeBlockers(deps.db, clientId);
  if (!pre.ok) throw E.conflict(pre.blockers.join(' '));
  const counts = await deps.db.transaction(async (tx) => {
    const c = await anonymizeClientCore(deps, tx, clientId);
    await audit(tx, { action: 'admin.client.anonymized', actorUserId: o.by, actorRole: 'admin', targetType: 'client', targetId: clientId, clientId, requestId: o.requestId ?? null, ipHmac: o.ipHmac ?? null, details: { reason: o.reason, ...c } });
    return c;
  });
  await scrubProviderCustomer(deps, clientId).catch(() => undefined);
  return counts;
}

/**
 * After commit: the provider side – Stripe customer e-mail/name cleared and every card detached (the customer object
 * stays: the payment history needs it). Uses the payment contract when the builder exported it (§29.1.15).
 */
export async function scrubProviderCustomer(deps: Deps, clientId: string): Promise<void> {
  const mod = (await import('./payments.js').catch(() => null)) as Record<string, unknown> | null;
  const fn = mod?.['scrubCustomerK29'] ?? mod?.['forgetCustomerK29'];
  if (typeof fn === 'function') await (fn as (d: Deps, id: string) => Promise<void>)(deps, clientId);
}

export { sql };
