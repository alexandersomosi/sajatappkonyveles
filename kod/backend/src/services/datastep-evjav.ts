// Javító kör 2026-11-21 (éves ciklus + KATA) – one-time data step at worker start (system_state 'data.ev_javitas'). Never
// deletes, never touches an admin-edited text:
//  1. content_texts overrides that still hold the OLD default of a key this round reworded (no time promise, the new
//     button name), word for word, get the new default (the same rule as data.k7b);
//  2. the "Éves zárás" e-mail (annual_due: questionnaire, fee, the APPROVAL due) is on by default since SPEC §32 (critique
//     2.5: at launch every client is on the web without push). A notification_prefs row of annual_due that equals the OLD
//     default exactly (push on, e-mail off) was not a choice of the client – older apps saved every switch on "Mentés" –
//     so it follows the new default (the k7b rule of message_new). A row with the push switched off stays as it is.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { contentTexts, notificationPrefs, systemState } from '../db/schema.js';
import { DEFAULT_TEXTS } from '../content.js';
import { audit } from '../audit.js';
import { log } from '../log.js';

export const EVJAV_STEP_KEY = 'data.ev_javitas';

/** The old defaults of the keys this round changed (content key → old text). */
export const EVJAV_REGI: Record<string, string> = {
  'eves.allapot.kerdoiv': 'Töltsd ki a kérdőívet {hatarido}. Kb. 5 perc.',
  'notif.tax_due_soon.ma.body': 'Utald el ma. Ha már elutaltad, koppints az „Elutaltam” gombra.',
  'notif.annual_due.kerdoiv.body': 'Kb. 5 perc. Ebből készül a bevallásod.',
  'notif.annual_due.body': 'Kb. 5 perc. Ebből készül a bevallásod.',
  'notif.annual_due.jovahagyas.body': 'Kész a tervezet. Kb. 2 perc.',
  'notif.annual_status.jovahagyasra_var.body': 'Nézd át, és hagyd jóvá. Kb. 2 perc.',
  'notif.annual_status.body': 'Nézd át, és hagyd jóvá. Kb. 2 perc.',
};

export async function runDataStepEvJavitas(deps: Deps): Promise<{ content: number; annualPrefs: number } | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, EVJAV_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  let content = 0;
  const keys = Object.keys(EVJAV_REGI);
  const overrides = await db.select().from(contentTexts).where(inArray(contentTexts.key, keys));
  for (const o of overrides) {
    const old = EVJAV_REGI[o.key];
    const neu = DEFAULT_TEXTS[o.key];
    if (old === undefined || neu === undefined || o.body !== old || neu === old) continue;
    await db.update(contentTexts).set({ body: neu, updatedAt: now, version: sql`${contentTexts.version} + 1` }).where(eq(contentTexts.key, o.key));
    content++;
  }
  const flipped = await db
    .update(notificationPrefs)
    .set({ email: true })
    .where(and(eq(notificationPrefs.kind, 'annual_due'), eq(notificationPrefs.push, true), eq(notificationPrefs.email, false)))
    .returning({ userId: notificationPrefs.userId });
  const result = { content, annualPrefs: flipped.length };
  await db.insert(systemState).values({ key: EVJAV_STEP_KEY, value: { at: now.toISOString(), result } }).onConflictDoNothing();
  await audit(db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: EVJAV_STEP_KEY, details: result });
  log().info({ step: EVJAV_STEP_KEY, ...result }, 'data step ev_javitas done');
  if (content) await deps.content.reload().catch(() => undefined);
  return result;
}
