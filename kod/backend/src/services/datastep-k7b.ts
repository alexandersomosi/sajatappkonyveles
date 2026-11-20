// k7b (tulaj 11-20) – one-time data step at worker start (system_state 'data.k7b'). Never deletes, never touches an
// admin-edited text:
//  1. content_texts overrides that still hold the OLD default of a key the 11-20 wording review changed (k7b_regi.ts),
//     word for word, get the new default (the same rule as data.tulaj1119);
//  2. the "Új üzenet" e-mail is on by default from now on. A notification_prefs row of message_new that equals the OLD
//     default exactly (push on, e-mail off) was not a choice of the client – the e-mail could not be switched off while
//     it was off, and older apps saved every switch on "Mentés" – so it follows the new default. A row with the push
//     switched off (the client did touch it) stays as it is.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { contentTexts, notificationPrefs, systemState } from '../db/schema.js';
import { DEFAULT_TEXTS } from '../content.js';
import { K7B_REGI } from '../content/k7b_regi.js';
import { audit } from '../audit.js';
import { log } from '../log.js';

export const K7B_STEP_KEY = 'data.k7b';

export async function runDataStepK7b(deps: Deps): Promise<{ content: number; messagePrefs: number } | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, K7B_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  let content = 0;
  const keys = Object.keys(K7B_REGI);
  const overrides = keys.length ? await db.select().from(contentTexts).where(inArray(contentTexts.key, keys)) : [];
  for (const o of overrides) {
    const old = K7B_REGI[o.key];
    const neu = DEFAULT_TEXTS[o.key];
    if (old === undefined || neu === undefined || o.body !== old || neu === old) continue;
    await db.update(contentTexts).set({ body: neu, updatedAt: now, version: sql`${contentTexts.version} + 1` }).where(eq(contentTexts.key, o.key));
    content++;
  }
  const flipped = await db
    .update(notificationPrefs)
    .set({ email: true })
    .where(and(eq(notificationPrefs.kind, 'message_new'), eq(notificationPrefs.push, true), eq(notificationPrefs.email, false)))
    .returning({ userId: notificationPrefs.userId });
  const result = { content, messagePrefs: flipped.length };
  await db.insert(systemState).values({ key: K7B_STEP_KEY, value: { at: now.toISOString(), result } }).onConflictDoNothing();
  await audit(db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: K7B_STEP_KEY, details: result });
  log().info({ step: K7B_STEP_KEY, ...result }, 'data step k7b done');
  if (content) await deps.content.reload().catch(() => undefined);
  return result;
}
