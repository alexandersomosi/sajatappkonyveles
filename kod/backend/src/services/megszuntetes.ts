// SPEC §29.7 F3 – "A vállalkozás megszüntetése": the change kind 'valtozas_megszuntetes' runs through the §28.5 change
// machinery (valtozas.ts: data schema, guide, consent, staff steps, four eyes). This file holds what is special to the
// closing: the follow-ups on change-done. 'szja_eves' opens the annual closing of the closing year; 'elofizetes_lezaras'
// ends the subscription at the end of the paid period (no proration) through the payment contract (§29.1.15).
import { eq } from 'drizzle-orm';
import type { ClosingChangeData } from '../_shared/k29f.js';
import { huLongDate } from '../_shared/bekotes.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { subscriptions } from '../db/schema.js';
import { audit } from '../audit.js';
import { notify } from '../notify/notify.js';
import type { ClientRow } from './people.js';
import type { StaffActor } from './team.js';
import { annualView } from './eves-zaras.js';
import { cancelSubscriptionK29 } from './payments.js';

export async function onClosingFollowup(deps: Deps, db: DbOrTx, actor: StaffActor, cl: ClientRow, cz: ClosingChangeData, key: string): Promise<void> {
  if (key === 'szja_eves') {
    // the annual closing of the closing year (fee eves_zaras when due – the annual flow creates it)
    await annualView(deps, db, cl, Number(cz.closingOn.slice(0, 4)));
    await audit(db, { action: 'closing.annual_opened', actorUserId: actor.userId, actorRole: actor.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { year: Number(cz.closingOn.slice(0, 4)) } });
    return;
  }
  if (key === 'elofizetes_lezaras') {
    await cancelSubscriptionK29(deps, { clientId: cl.id, when: 'idoszak_vege', byUserId: actor.userId, reason: 'megszuntetes' } as never);
    const [sub] = await db.select({ end: subscriptions.currentPeriodEnd }).from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
    await notify(deps, db, { userId: cl.userId, kind: 'subscription_canceled', variant: 'megszuntetes', params: { datum: sub?.end ? huLongDate(sub.end) : huLongDate(cz.closingOn) }, link: '/fiok/elofizetes' });
    await audit(db, { action: 'closing.subscription_closed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { periodEnd: sub?.end ?? null } });
  }
}
