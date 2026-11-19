// SPEC §28.K.6 – while the business is suspended (szünetel) the client pays the small monthly availability fee instead
// of the plan fee. A pause is opened by the change-done follow-up of 'valtozas_szuneteltetes' (or the accountant) and
// closed by 'valtozas_folytatas' (or the accountant). No proration; the lower amount stays under the card's maxAmount.
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { PauseView } from '../_shared/api.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { clients, clientTaxProfiles, subscriptionPauses, subscriptions } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, huDayMonthTol, todayBudapest } from '../lib/dates.js';
import { notify } from '../notify/notify.js';
import { feeSetting, planAmountHuf } from './dijak.js';
import { fmt } from './kedvezmeny.js';
import { recalcYear } from './tax.js';

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
  await applyPauseToProfile(deps, db, clientId, from, o.to ?? null);
  const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  const fee = await feeSetting(db, 'szuneteltetesi_dij');
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'subscription_paused', variant: 'kezdet', params: { from: huDayMonthTol(from), dij: fmt(fee.amountHuf) }, link: '/fiok/dijak' });
  return p!;
}

export async function closePause(deps: Deps, db: DbOrTx, clientId: string, lastDay: string, by: string | null): Promise<PauseRow | null> {
  const [p] = await db.select().from(subscriptionPauses).where(and(eq(subscriptionPauses.clientId, clientId), isNull(subscriptionPauses.to))).orderBy(desc(subscriptionPauses.from)).limit(1);
  if (!p) return null;
  const [u] = await db.update(subscriptionPauses).set({ to: lastDay }).where(eq(subscriptionPauses.id, p.id)).returning();
  await audit(db, { action: 'pause.off', actorUserId: by, actorRole: by ? 'accountant' : 'system', targetType: 'client', targetId: clientId, clientId, details: { to: lastDay } });
  await applyPauseToProfile(deps, db, clientId, p.from, lastDay);
  const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  // the work starts again on the day after the last suspended day
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'subscription_paused', variant: 'vege', params: { from: huDayMonthTol(addDays(lastDay, 1)) }, link: '/' });
  return u ?? null;
}

/**
 * Round 2 of 2026-11-19: a szünetelés is also a break in the tax profile (no járulék while suspended, Tbj.; the engine
 * reads `insurance_breaks` kind 'szunetel'), so the Főoldal, the reserve and the quarters stop counting the monthly
 * minimum. One break per profile year from the pause's first day (open pause → to 31 December); an existing break that
 * starts on the same day is replaced, every other break stays. Each changed year is recalculated.
 */
export async function applyPauseToProfile(deps: Deps, db: DbOrTx, clientId: string, from: string, to: string | null): Promise<number> {
  const y0 = Number(from.slice(0, 4));
  const rows = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), gte(clientTaxProfiles.year, y0)));
  let changed = 0;
  for (const p of rows) {
    const ys = `${p.year}-01-01`;
    const ye = `${p.year}-12-31`;
    const bFrom = from > ys ? from : ys;
    const bTo = to && to < ye ? to : ye;
    if (bFrom > bTo) continue;
    const cur = p.insuranceBreaks ?? [];
    const next = [...cur.filter((b) => !(b.kind === 'szunetel' && b.from === bFrom)), { from: bFrom, to: bTo, kind: 'szunetel' as const }].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    if (JSON.stringify(next) === JSON.stringify(cur)) continue;
    await db.update(clientTaxProfiles).set({ insuranceBreaks: next, updatedAt: deps.now() }).where(eq(clientTaxProfiles.id, p.id));
    await audit(db, { action: 'tax_profile.pause_break', actorRole: 'system', targetType: 'client', targetId: clientId, clientId, details: { year: p.year, from: bFrom, to: bTo } });
    await recalcYear(deps, db, clientId, p.year);
    changed++;
  }
  return changed;
}

/** Data step helper: every pause of every client into the tax profile (idempotent). */
export async function backfillPauseBreaks(deps: Deps, db: DbOrTx): Promise<number> {
  let n = 0;
  for (const p of await db.select().from(subscriptionPauses)) n += await applyPauseToProfile(deps, db, p.clientId, p.from, p.to);
  return n;
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
    text: await deps.content.render('szunetel.card_body', { from: huDayMonthTol(p.from), dij: fmt(fee.amountHuf), havidij: `${fmt(plan)} Ft-os havidíj` }),
  };
}
