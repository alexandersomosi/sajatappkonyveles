// Round 2 of 2026-11-19 (k6c review) – data steps at worker start, after data.ot1119 / data.k28. Never touches users,
// consents, subscriptions, invoices or revenue amounts.
//  1. one-time (system_state 'data.k6c'): every szüneteltetés (subscription_pauses) also becomes a 'szunetel' break of
//     the tax profile, so a paused client stops accruing the monthly minimum (the change-done path does this from now on);
//  2. every start: the in-app invoice_new rows of the DEMO users are re-rendered from the engine's current reserves
//     (a row seeded with a literal or written by an older engine says what the invoice page says). Real users' rows are
//     history and stay as they were sent.
import { eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { systemState } from '../db/schema.js';
import { audit } from '../audit.js';
import { backfillPauseBreaks } from './szuneteltetes.js';
import { rerenderInvoiceNotifications } from './szamla-ertesites.js';

export const K6C_STEP_KEY = 'data.k6c';
export const DEMO_EMAIL_DOMAIN = 'demo.kezjegy.test';

export async function runDataStepK6c(deps: Deps): Promise<{ pauses: number | 'already'; notifications: number }> {
  const db = deps.db;
  let pauses: number | 'already' = 'already';
  const [done] = await db.select().from(systemState).where(eq(systemState.key, K6C_STEP_KEY)).limit(1);
  if (!done) {
    pauses = await backfillPauseBreaks(deps, db);
    await db.insert(systemState).values({ key: K6C_STEP_KEY, value: { at: deps.now().toISOString(), pauses } }).onConflictDoNothing();
    await audit(db, { action: 'datastep.k6c', actorRole: 'system', targetType: 'system', targetId: K6C_STEP_KEY, details: { pauses } });
  }
  const notifications = await rerenderInvoiceNotifications(deps, { emailDomain: DEMO_EMAIL_DOMAIN });
  return { pauses, notifications };
}
