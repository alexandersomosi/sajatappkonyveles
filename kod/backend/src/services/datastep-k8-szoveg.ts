// k8 integrator (review F5) – one-time text step at worker start (system_state 'data.k8_szoveg'; every server, idempotent).
// The live FAQ rows and the content overrides were written before the k8 removed the time promises ("kb. 5 perc",
// "valaki 24–48 órán belül hív", "kb. 10–15 perc"). A row is replaced ONLY while it still holds the previous text word
// for word (jogi gyik `k8_elozo_valasz`, or K8_SZOVEG_REGI below); anything an admin edited is never touched (only
// logged). The older `elozo_*` fields of the 11-19 step stay as they were (their own test checks them).
// Nothing is deleted, nothing is reseeded.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { contentTexts, faqItems, systemState } from '../db/schema.js';
import { DEFAULT_TEXTS } from '../content.js';
import { audit } from '../audit.js';
import { fillLegal, legalValuesFromConfig } from '../legal.js';
import { log } from '../log.js';

export const K8_SZOVEG_STEP_KEY = 'data.k8_szoveg';

/** The old defaults (before k8) of the content keys the k8 reworded: key → old text. */
export const K8_SZOVEG_REGI: Record<string, string> = {
  'helyettunk.allapot.egyeztetve.kesz': 'Beszéltünk. {firstName} hamarosan beküldi a meghatalmazást, utána jóváhagyod.',
  'visszahivas.allapot.folyamatban': '{staffFirstName} intézi a kérésedet. Hamarosan hív.',
  'visszahivas.allapot.lejart': 'Sajnáljuk, hogy még nem hívtunk. Hamarosan jelentkezünk.',
};

export async function runDataStepK8Szoveg(deps: Deps): Promise<{ faq: number; faqKept: number; content: number } | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, K8_SZOVEG_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  let faq = 0;
  let faqKept = 0;
  try {
    const raw = JSON.parse(await readFile(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik?: { kerdes: string; valasz: string; k8_elozo_valasz?: string }[] };
    const vals = legalValuesFromConfig(deps.cfg, now);
    const rows = await db.select().from(faqItems);
    for (const g of raw.gyik ?? []) {
      if (!g.k8_elozo_valasz) continue;
      const q = fillLegal(g.kerdes, vals);
      const a = fillLegal(g.valasz, vals);
      const oa = fillLegal(g.k8_elozo_valasz, vals);
      if (rows.some((r) => r.question === q && r.answer === a)) continue;
      const hit = rows.find((r) => r.question === q && r.answer === oa);
      if (hit) {
        await db.update(faqItems).set({ question: q, answer: a, updatedAt: now }).where(eq(faqItems.id, hit.id));
        faq++;
      } else if (rows.some((r) => r.question === q)) faqKept++;
    }
  } catch (e) {
    log().info({ err: String((e as Error).message ?? e) }, 'k8 text step: no jogi file, FAQ left as it is');
  }
  let content = 0;
  const keys = Object.keys(K8_SZOVEG_REGI);
  const overrides = await db.select().from(contentTexts).where(inArray(contentTexts.key, keys));
  for (const o of overrides) {
    const neu = DEFAULT_TEXTS[o.key];
    if (!neu || o.body !== K8_SZOVEG_REGI[o.key]) continue;
    await db.update(contentTexts).set({ body: neu, updatedAt: now }).where(eq(contentTexts.key, o.key));
    content++;
  }
  const result = { faq, faqKept, content };
  await db.insert(systemState).values({ key: K8_SZOVEG_STEP_KEY, value: { at: now.toISOString(), result } }).onConflictDoNothing();
  await audit(db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: K8_SZOVEG_STEP_KEY, details: result });
  return result;
}
