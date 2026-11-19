// One-time, idempotent data step of the owner orders of 2026-11-18 (SPEC §26.9.3). Runs at worker start (and from the
// demo addition script); marker system_state['data.tulaj1118']. It never deletes or rewrites existing rows except
// clients.business_status (null → 'van' for clients who already have an adószám).
//   (1) business_status = 'van' where adoszam is set and business_status is null
//   (2) booked legacy appointments → callbacks (unique legacy_appointment_id; the appointment rows are untouched)
//   (3) the four new FAQ items, only when no row with the same question exists (an admin-edited row is never touched)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { assistRequests, clients, contentTexts, documents, faqItems, messages, notifications, onboardingSteps, requests, signupAttribution, systemState } from '../db/schema.js';
import { ASSIST_RULES } from '../_shared/enums.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { DEFAULT_TEXTS } from '../content.js';
import { TULAJ1119_REGI } from '../content/tulaj1119_regi.js';
import { audit } from '../audit.js';
import { fillLegal, legalValuesFromConfig } from '../legal.js';
import { log } from '../log.js';
import { mapLegacyAppointments } from './callbacks.js';

export const DATA_STEP_KEY = 'data.tulaj1118';

/** Fallback texts; the jogi package's app_szovegek.json (gyik) wins when it has the same question. */
export function newFaqDefaults(deps: Deps): { kerdes: string; valasz: string }[] {
  return [
    {
      kerdes: 'Hogyan kérhetek visszahívást?',
      valasz:
        'Koppints a „Kérj visszahívást” gombra, add meg a számodat, és írd meg, miben segítsünk. Kollégánk 24–48 órán belül felhív, munkanapokon 9 és 17 óra között. Nem feltétlenül a könyvelőd hív elsőként, hanem valaki a csapatunkból. Telefonon soha nem kérjük a jelszavadat vagy a kódjaidat.',
    },
    {
      kerdes: 'Még nincs vállalkozásom. Mit tegyek?',
      valasz:
        'Válaszd azt, hogy „Még nincs, most indítanám”. Töltsd ki a rövid kérdőívet, és elkészül a személyre szabott útmutatód: megmutatja, mit hova jelölj a NAV oldalán. Utána töltsd fel a NAV-os értesítést, és mi átnézzük. Ha nem boldogulsz vele, kérd, hogy intézzük helyetted.',
    },
    {
      // SPEC §27.10: replaces "Miért nem ti jelentitek be a vállalkozásomat?" (the jogi text wins by question)
      kerdes: 'Bejelentitek helyettem a vállalkozásomat?',
      valasz:
        'Igen, ha kéred. Koppints az „Intézzétek helyettem” gombra: felhívunk, átnézzük veled az adataidat, a könyvelőd pedig meghatalmazottként, a saját belépésével bejelenti. Neked csak a NAV oldalán kell jóváhagynod a meghatalmazást, és itt engedélyezned a bejelentést. A jelszavadat vagy a kódjaidat soha nem kérjük el. Ha inkább magad csinálod, lépésről lépésre megmutatjuk, kb. 10–15 perc.',
    },
    {
      kerdes: 'Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?',
      valasz:
        deps.cfg.newBusinessChargePolicy === 'azonnal'
          ? 'Az első havidíjat a szerződés után fizeted, akkor is, ha a bejelentésed még folyamatban van.'
          : 'Akkor, amikor már megvan az adószámod, és elkezdjük a könyvelést. Addig az útmutató és a segítség ingyenes.',
    },
  ];
}

async function faqTexts(deps: Deps): Promise<{ kerdes: string; valasz: string }[]> {
  const defaults = newFaqDefaults(deps);
  try {
    const raw = JSON.parse(await readFile(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik?: { kerdes: string; valasz: string }[] };
    const norm = (s: string) => s.trim().toLowerCase().replace(/[?!.]+$/, '');
    return defaults.map((d) => raw.gyik?.find((g) => norm(g.kerdes) === norm(d.kerdes)) ?? d);
  } catch {
    return defaults;
  }
}

export async function insertNewFaqItems(deps: Deps): Promise<number> {
  const vals = legalValuesFromConfig(deps.cfg, deps.now());
  const existing = await deps.db.select({ q: faqItems.question }).from(faqItems);
  const have = new Set(existing.map((x) => x.q.trim().toLowerCase()));
  const [m] = await deps.db.select({ s: max(faqItems.sort) }).from(faqItems);
  let sort = Number(m?.s ?? 0);
  let n = 0;
  for (const f of await faqTexts(deps)) {
    const q = fillLegal(f.kerdes, vals);
    if (have.has(q.trim().toLowerCase())) continue;
    await deps.db.insert(faqItems).values({ question: q, answer: fillLegal(f.valasz, vals), sort: ++sort });
    n++;
  }
  return n;
}

export async function runDataStepTulaj1118(deps: Deps): Promise<{ businessStatus: number; callbacks: number; faq: number } | 'already'> {
  const [done] = await deps.db.select().from(systemState).where(eq(systemState.key, DATA_STEP_KEY)).limit(1);
  if (done) return 'already';
  const bs = await deps.db
    .update(clients)
    .set({ businessStatus: 'van' })
    .where(and(isNotNull(clients.adoszam), isNull(clients.businessStatus)))
    .returning({ id: clients.id });
  const callbacks = await mapLegacyAppointments(deps);
  const faq = await insertNewFaqItems(deps);
  const result = { businessStatus: bs.length, callbacks, faq };
  await deps.db
    .insert(systemState)
    .values({ key: DATA_STEP_KEY, value: { at: deps.now().toISOString(), result } })
    .onConflictDoNothing();
  await audit(deps.db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: DATA_STEP_KEY, details: result });
  log().info({ step: DATA_STEP_KEY, ...result }, 'data step done');
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// One-time FAQ text fix (review k3c2, marker system_state['data.faq_biztonsag_1118']): the answer to "Biztonságban
// vannak az adataim?" said only the accountant sees the client's papers; since §26 the service team also sees what
// onboarding and callbacks need. The row is updated ONLY if its answer is still the old default word for word, so an
// admin edit is never overwritten. Nothing is inserted or deleted.
// ---------------------------------------------------------------------------------------------------------------
export const FAQ_FIX_KEY = 'data.faq_biztonsag_1118';
const FAQ_SAFETY_QUESTION = 'Biztonságban vannak az adataim?';
export const FAQ_SAFETY_OLD_ANSWER =
  'Igen. A fájljaidat titkosítva tároljuk európai szerveren, a NAV-kulcsaidat külön kulccsal. Az irataidat csak a könyvelőd látja. Nem adjuk el az adataidat, és nem mutatunk hirdetést. Bármikor letöltheted vagy törölheted őket.';
const FAQ_SAFETY_NEW_DEFAULT =
  'Igen. A fájljaidat titkosítva tároljuk európai szerveren, a NAV-kulcsaidat külön kulccsal. A könyvelési irataidat és az okmányaidat csak a könyvelőd látja; ügyfélszolgálatunk csak azt, ami a bekötéshez és a visszahíváshoz kell (például a vállalkozásod bejelentéséről feltöltött NAV-os igazolást). A hívásokat nem rögzítjük. Nem adjuk el az adataidat, és nem mutatunk hirdetést. Bármikor letöltheted vagy törölheted őket.';

export async function runFaqSafetyFix(deps: Deps): Promise<number | 'already'> {
  const [done] = await deps.db.select().from(systemState).where(eq(systemState.key, FAQ_FIX_KEY)).limit(1);
  if (done) return 'already';
  let answer = FAQ_SAFETY_NEW_DEFAULT;
  try {
    const raw = JSON.parse(await readFile(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik?: { kerdes: string; valasz: string }[] };
    const g = raw.gyik?.find((x) => x.kerdes.trim() === FAQ_SAFETY_QUESTION);
    if (g?.valasz) answer = fillLegal(g.valasz, legalValuesFromConfig(deps.cfg, deps.now()));
  } catch {
    // the default above is the same text as jogi app_szovegek.json (2026-11-18)
  }
  const changed = await deps.db
    .update(faqItems)
    .set({ answer })
    .where(and(eq(faqItems.question, FAQ_SAFETY_QUESTION), eq(faqItems.answer, FAQ_SAFETY_OLD_ANSWER)))
    .returning({ id: faqItems.id });
  await deps.db
    .insert(systemState)
    .values({ key: FAQ_FIX_KEY, value: { at: deps.now().toISOString(), updated: changed.length } })
    .onConflictDoNothing();
  await audit(deps.db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: FAQ_FIX_KEY, details: { updated: changed.length } });
  log().info({ step: FAQ_FIX_KEY, updated: changed.length }, 'faq text fix done');
  return changed.length;
}

// ---------------------------------------------------------------------------------------------------------------
// Round 1 (2026-11-19) data fixes, marker system_state['data.kor1_1119']. One-time, idempotent, never a reseed:
//   (1) notification links '/dosszie/2026-10' (a page the app does not have) → '/dosszie?honap=2026-10'
//   (2) a "közvetlen" signup_attribution row for clients that have none (two demo additions were missing from
//       "Honnan jöttek")
//   (3) three demo texts with language errors – each only if the row still has the old text word for word
//   (4) the FAQ answer "Mi az a meghatalmazás, és visszavonhatom?" – only if it is still the old default
// Nothing is deleted; rows an admin or a user changed are never touched.
// ---------------------------------------------------------------------------------------------------------------
export const KOR1_FIX_KEY = 'data.kor1_1119';
const FAQ_MEGHATALMAZAS_QUESTION = 'Mi az a meghatalmazás, és visszavonhatom?';
export const FAQ_MEGHATALMAZAS_OLD_ANSWER =
  'A meghatalmazással a könyvelőd a NAV-nál a nevedben eljárhat: beadhatja a bevallásaidat és igazolást kérhet. Az ONYA-ban kb. 5 perc alatt beállítod, és ugyanott bármikor visszavonhatod. A jelszavadat ehhez senkinek nem kell megadnod.';

export async function runDataFixKor1(deps: Deps): Promise<Record<string, number> | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, KOR1_FIX_KEY)).limit(1);
  if (done) return 'already';
  const links = await db
    .update(notifications)
    .set({ link: sql`'/dosszie?honap=' || substr(${notifications.link}, 10)` })
    .where(sql`${notifications.link} ~ '^/dosszie/[0-9]{4}-[0-9]{2}$'`)
    .returning({ id: notifications.id });
  const missing = await db
    .select({ userId: clients.userId })
    .from(clients)
    .leftJoin(signupAttribution, eq(signupAttribution.userId, clients.userId))
    .where(isNull(signupAttribution.userId));
  for (const m of missing) await db.insert(signupAttribution).values({ userId: m.userId, landing: 'web' }).onConflictDoNothing();
  let texts = 0;
  texts += (await db.update(documents).set({ title: sql`replace(${documents.title}, 'Bevallás a I. negyedévről', 'Bevallás az I. negyedévről')` }).where(sql`${documents.title} like 'Bevallás a I. negyedévről%'`).returning({ id: documents.id })).length;
  texts += (
    await db
      .update(messages)
      .set({ body: 'Levelet kaptam a NAV-tól, megijedtem. Feltöltöttem a dossziéba.' })
      .where(eq(messages.body, 'Levelet kaptam a NAV-tól, megjelent. Feltöltöttem a dossziéba.'))
      .returning({ id: messages.id })
  ).length;
  texts += (
    await db
      .update(requests)
      .set({ body: 'Az átálláshoz kell: január óta minden hónapé. Elég, ha a bankod appjából letöltött PDF-eket töltöd fel.' })
      .where(eq(requests.body, 'Az átálláshoz kell: január óta minden hónapé. Elég a bankod appjából letöltött PDF-ek.'))
      .returning({ id: requests.id })
  ).length;
  // FAQ: the current jogi answer replaces the row only when the row still equals the earlier shipped default.
  let faq = 0;
  try {
    const raw = JSON.parse(await readFile(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik?: { kerdes: string; valasz: string }[] };
    const g = raw.gyik?.find((x) => x.kerdes.trim() === FAQ_MEGHATALMAZAS_QUESTION);
    if (g?.valasz) {
      const answer = fillLegal(g.valasz, legalValuesFromConfig(deps.cfg, deps.now()));
      faq = (await db.update(faqItems).set({ answer }).where(and(eq(faqItems.question, FAQ_MEGHATALMAZAS_QUESTION), eq(faqItems.answer, FAQ_MEGHATALMAZAS_OLD_ANSWER))).returning({ id: faqItems.id })).length;
    }
  } catch {
    // no jogi file: nothing to refresh
  }
  const result = { links: links.length, attribution: missing.length, texts, faq };
  await db.insert(systemState).values({ key: KOR1_FIX_KEY, value: { at: deps.now().toISOString(), result } }).onConflictDoNothing();
  await audit(db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: KOR1_FIX_KEY, details: result });
  log().info({ step: KOR1_FIX_KEY, ...result }, 'round-1 data fixes done');
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// SPEC §27.7.3 – one-time data step of the owner orders of 2026-11-19, marker system_state['data.tulaj1119'].
// Idempotent, never a reseed, never touches onboarding_steps, users, consents or subscriptions:
//   (1) a legacy assisted meghatalmazás (step data.method 'onya_konyvelo') → one assist row (no callback, no message)
//   (2) FAQ: jogi gyik items with elozo_kerdes/elozo_valasz replace a live row only if it still holds those exact old
//       texts; new questions are inserted; an admin-edited row is never touched (only logged)
//   (3) content_texts overrides that still equal the OLD default word for word (tulaj1119_regi.ts) get the new default
// ---------------------------------------------------------------------------------------------------------------
export const TULAJ1119_STEP_KEY = 'data.tulaj1119';

export async function runDataStepTulaj1119(deps: Deps): Promise<Record<string, number> | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, TULAJ1119_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  // (1) legacy assisted meghatalmazás
  let assists = 0;
  const legacy = await db
    .select()
    .from(onboardingSteps)
    .where(and(eq(onboardingSteps.step, 'meghatalmazas'), inArray(onboardingSteps.status, ['konyvelore_var', 'ugyfelre_var']), sql`${onboardingSteps.data}->>'method' = 'onya_konyvelo'`));
  for (const s of legacy) {
    const [open] = await db
      .select({ id: assistRequests.id })
      .from(assistRequests)
      .where(and(eq(assistRequests.clientId, s.clientId), inArray(assistRequests.status, ['visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve'])))
      .limit(1);
    if (open) continue;
    const data = (s.data ?? {}) as { submittedAt?: string; clientApprovedAt?: string };
    const submitted = data.submittedAt ? new Date(data.submittedAt) : s.updatedAt;
    let row: Partial<typeof assistRequests.$inferInsert>;
    if (data.clientApprovedAt) {
      row = { status: 'meghatalmazas_jovahagyva', clientApprovedAt: new Date(data.clientApprovedAt), agreedAt: submitted, ujegykeFiledAt: s.updatedAt };
    } else if (s.status === 'konyvelore_var') {
      row = { status: 'egyeztetve', agreedAt: submitted };
    } else {
      const filedAt = s.updatedAt;
      const expires = new Date(filedAt.getTime() + ASSIST_RULES.navApprovalDays * 86_400_000);
      row = {
        status: now.getTime() >= expires.getTime() + ASSIST_RULES.expireGraceHours * 3600_000 ? 'meghatalmazas_lejart' : 'meghatalmazas_bekuldve',
        agreedAt: submitted,
        ujegykeFiledAt: filedAt,
        approvalDueOn: addDays(todayBudapest(filedAt), ASSIST_RULES.shownApprovalDays),
        approvalExpiresAt: expires,
        // no client notification from the data step: the filing notice counts as already sent
        approvalReminders: 1,
      };
    }
    const [ins] = await db
      .insert(assistRequests)
      .values({ clientId: s.clientId, kind: 'meghatalmazas', createdByRole: 'system', statusChangedAt: now, createdAt: now, updatedAt: now, ...row })
      .returning({ id: assistRequests.id });
    await audit(db, { action: 'assist.created', actorRole: 'system', targetType: 'assist', targetId: ins!.id, clientId: s.clientId, details: { kind: 'meghatalmazas', source: 'data.tulaj1119', status: row.status } });
    assists++;
  }
  // (2) FAQ
  let faqUpdated = 0;
  let faqInserted = 0;
  let faqKept = 0;
  try {
    const raw = JSON.parse(await readFile(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik?: { kerdes: string; valasz: string; elozo_kerdes?: string; elozo_valasz?: string }[] };
    const vals = legalValuesFromConfig(deps.cfg, now);
    const rows = await db.select().from(faqItems);
    const [m] = await db.select({ s: max(faqItems.sort) }).from(faqItems);
    let sort = Number(m?.s ?? 0);
    const norm = (x: string) => x.trim().toLowerCase();
    for (const g of raw.gyik ?? []) {
      const q = fillLegal(g.kerdes, vals);
      const a = fillLegal(g.valasz, vals);
      // B4: a changed item carries elozo_valasz, plus elozo_kerdes only when the question itself changed
      if (g.elozo_valasz) {
        const oq = fillLegal(g.elozo_kerdes ?? g.kerdes, vals);
        const oa = fillLegal(g.elozo_valasz, vals);
        const hit = rows.find((r) => r.question === oq);
        if (rows.some((r) => r.question === q && r.answer === a)) continue; // already the new text
        if (hit && hit.answer === oa) {
          await db.update(faqItems).set({ question: q, answer: a, updatedAt: now }).where(eq(faqItems.id, hit.id));
          faqUpdated++;
          continue;
        }
        if (hit) {
          log().info({ faq: hit.id }, 'faq row edited by an admin - left as it is');
          faqKept++;
          continue;
        }
      }
      if (!rows.some((r) => norm(r.question) === norm(q))) {
        await db.insert(faqItems).values({ question: q, answer: a, sort: ++sort });
        faqInserted++;
      }
    }
  } catch {
    // no jogi file: nothing to refresh
  }
  // (3) content overrides that still hold the old default
  let content = 0;
  const keys = Object.keys(TULAJ1119_REGI);
  const overrides = keys.length ? await db.select().from(contentTexts).where(inArray(contentTexts.key, keys)) : [];
  for (const o of overrides) {
    const old = TULAJ1119_REGI[o.key];
    const neu = DEFAULT_TEXTS[o.key];
    if (old === undefined || neu === undefined || o.body !== old || neu === old) continue;
    await db.update(contentTexts).set({ body: neu, updatedAt: now, version: sql`${contentTexts.version} + 1` }).where(eq(contentTexts.key, o.key));
    content++;
  }
  const result = { assists, faqUpdated, faqInserted, faqKept, content };
  await db.insert(systemState).values({ key: TULAJ1119_STEP_KEY, value: { at: now.toISOString(), result } }).onConflictDoNothing();
  await audit(db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: TULAJ1119_STEP_KEY, details: result });
  log().info({ step: TULAJ1119_STEP_KEY, ...result }, 'data step tulaj1119 done');
  if (content) await deps.content.reload().catch(() => undefined);
  return result;
}
