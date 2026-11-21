// SPEC §32 – one-time, idempotent data step `data.kata_f1` (worker start, after the migrations 0022/0023). It never deletes
// and never touches users, consents, subscriptions, invoices, revenue amounts or approved/filed periods:
//  1. KATA profiles of this year without a variant → 'regi' + főfoglalkozású (in 2026 only the Kata tv. KATA exists);
//  2. H1: the not approved átalány quarters of a KATA year are hidden ('kata_ev'), never deleted;
//  3. the KATA month rows of this year (months already due before today → backfilled: no reminder, the client sees them
//     only after the accountant verified them, the accountant gets one tax_task);
//  4. tax_payment_items.adonem from the item kind (288 kata, 103 szja, 406 TB, 258 szocho; HIPA: null);
//  5. a not yet started annual closing of last/this year follows the profile's regime.
// Re-running is a no-op (marker system_state['data.kata_f1']); the jobs keep the rows in step afterwards.
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { annualClosings, clientTaxProfiles, systemState, taxPaymentItems } from '../db/schema.js';
import { audit } from '../audit.js';
import { todayBudapest } from '../lib/dates.js';
import { evesKapcsolok, syncKataPeriods } from './kata.js';
import { ensurePeriods, kataRangeOfProfile } from './tax.js';

export const KATA_F1_STEP_KEY = 'data.kata_f1';

const ADONEM_BY_KIND: Record<string, string | null> = {
  tb_jarulek: '406',
  szocho: '258',
  szja_eloleg: '103',
  kata_teteles: '288',
  kata_kulonado: '288',
  hipa_eloleg: null,
  hipa_kulonbozet: null,
};

export async function runDataStepKataF1(deps: Deps): Promise<Record<string, number> | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, KATA_F1_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  const year = Number(todayBudapest(now).slice(0, 4));
  const k = await evesKapcsolok(db);
  const out = { variants: 0, profiles: 0, kataCreated: 0, backfilled: 0, adonem: 0, annual: 0 };

  // 1. variant of this year's KATA profiles
  const v = await db
    .update(clientTaxProfiles)
    .set({ kataVariant: 'regi', kataFofoglalkozasu: true })
    .where(and(eq(clientTaxProfiles.year, year), eq(clientTaxProfiles.regime, 'kata'), isNull(clientTaxProfiles.kataVariant)))
    .returning({ id: clientTaxProfiles.id });
  out.variants = v.length;

  // 2.–3. quarters (H1) and KATA months of every profile with a KATA month this year
  const profiles = await db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.year, year));
  for (const p of profiles) {
    if (!kataRangeOfProfile(p)) continue;
    await ensurePeriods(db, p.clientId, year, p.hipaMethod, p.status);
    const r = await syncKataPeriods(deps, db, p.clientId, year, { k });
    out.profiles++;
    out.kataCreated += r.created;
    out.backfilled += r.backfilled.length;
  }

  // 4. adónem of the existing items
  for (const [kind, adonem] of Object.entries(ADONEM_BY_KIND)) {
    if (!adonem) continue;
    const u = await db
      .update(taxPaymentItems)
      .set({ adonem })
      .where(and(sql`${taxPaymentItems.kind}::text = ${kind}`, isNull(taxPaymentItems.adonem)))
      .returning({ id: taxPaymentItems.id });
    out.adonem += u.length;
  }

  // 5. not started annual closings follow the regime of their year
  for (const p of profiles) {
    const u = await db
      .update(annualClosings)
      .set({ regime: p.regime, updatedAt: now })
      .where(and(eq(annualClosings.clientId, p.clientId), eq(annualClosings.taxYear, year), eq(annualClosings.status, 'nem_indult'), sql`${annualClosings.regime} <> ${p.regime}`))
      .returning({ id: annualClosings.id });
    out.annual += u.length;
  }

  await db.insert(systemState).values({ key: KATA_F1_STEP_KEY, value: { at: now.toISOString(), ...out } }).onConflictDoNothing();
  await audit(db, { action: 'datastep.kata_f1', actorRole: 'system', details: out });
  return out;
}
