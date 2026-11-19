// SPEC §28.K.6 – while the business is suspended (szünetel) the client pays the small monthly availability fee instead
// of the plan fee. A pause is opened by the change-done follow-up of 'valtozas_szuneteltetes' (or the accountant) and
// closed by 'valtozas_folytatas' (or the accountant). No proration; the lower amount stays under the card's maxAmount.
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { PauseView } from '../_shared/api.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { clients, subscriptionPauses, subscriptions } from '../db/schema.js';
import { audit } from '../audit.js';
import { huDayMonth, todayBudapest } from '../lib/dates.js';
import { notify } from '../notify/notify.js';
import { feeSetting, planAmountHuf } from './dijak.js';
import { fmt } from './kedvezmeny.js';

export type PauseRow = typeof subscriptionPauses.$inferSelect;

/** The pause covering `day` (from ≤ day ≤ to, or open). */
export async function pauseOn(db: DbOrTx, clientId: string, day: string): Promise<PauseRow | null> {
  const [p] = await db
    .select()
    .from(subscriptionPauses)
    .where(and(eq(subscriptionPauses.clientId, clientId), lte(subscriptionPauses.from, day), or(isNull(subscriptionPauses.to), gte(subscriptionPauses.to, day))))
    .orderBy(desc(subscriptionPauses.from))
    .limit(1);
  return p ?? null;
}

/** SPEC §28.K.6 chargeAmountHuf(sub, periodStart): the availability fee inside a pause, else the plan amount. */
export async function chargeAmountHuf(deps: Deps, db: DbOrTx, sub: Pick<typeof subscriptions.$inferSelect, 'clientId' | 'planCode'>, periodStart: string): Promise<number> {
  const p = await pauseOn(db, sub.clientId, periodStart);
  if (p) return (await feeSetting(db, 'szuneteltetesi_dij')).amountHuf;
  return planAmountHuf(deps, db, sub.planCode);
}

export async function openPause(deps: Deps, db: DbOrTx, clientId: string, from: string, o: { to?: string | null; source: 'valtozas' | 'konyvelo'; by: string | null }): Promise<PauseRow> {
  const cur = await pauseOn(db, clientId, from);
  if (cur) return cur;
  const [p] = await db.insert(subscriptionPauses).values({ clientId, from, to: o.to ?? null, source: o.source, createdBy: o.by, createdAt: deps.now() }).returning();
  await audit(db, { action: 'pause.on', actorUserId: o.by, actorRole: o.by ? 'accountant' : 'system', targetType: 'client', targetId: clientId, clientId, details: { from } });
  const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  const fee = await feeSetting(db, 'szuneteltetesi_dij');
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'subscription_paused', variant: 'kezdet', params: { from: huDayMonth(from), dij: fmt(fee.amountHuf) }, link: '/fiok/dijak' });
  return p!;
}

export async function closePause(deps: Deps, db: DbOrTx, clientId: string, lastDay: string, by: string | null): Promise<PauseRow | null> {
  const [p] = await db.select().from(subscriptionPauses).where(and(eq(subscriptionPauses.clientId, clientId), isNull(subscriptionPauses.to))).orderBy(desc(subscriptionPauses.from)).limit(1);
  if (!p) return null;
  const [u] = await db.update(subscriptionPauses).set({ to: lastDay }).where(eq(subscriptionPauses.id, p.id)).returning();
  await audit(db, { action: 'pause.off', actorUserId: by, actorRole: by ? 'accountant' : 'system', targetType: 'client', targetId: clientId, clientId, details: { to: lastDay } });
  const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'subscription_paused', variant: 'vege', params: { from: huDayMonth(lastDay) }, link: '/' });
  return u ?? null;
}

export async function pauseView(deps: Deps, db: DbOrTx, clientId: string): Promise<PauseView | null> {
  const p = await pauseOn(db, clientId, todayBudapest(deps.now()));
  if (!p) return null;
  const fee = await feeSetting(db, 'szuneteltetesi_dij');
  const [sub] = await db.select({ planCode: subscriptions.planCode }).from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  const plan = await planAmountHuf(deps, db, sub?.planCode ?? 'havi');
  return {
    from: p.from,
    to: p.to,
    source: p.source,
    amountHuf: fee.amountHuf,
    demo: !fee.confirmed,
    text: await deps.content.render('szunetel.card_body', { from: huDayMonth(p.from), dij: fmt(fee.amountHuf), havidij: `${fmt(plan)} Ft-os havidíj` }),
  };
}
