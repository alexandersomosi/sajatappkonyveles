// One-time, idempotent data steps of SPEC §28.7.2 (data.ot1119) and §28.K.16 (data.k28), run at worker start. They never
// touch onboarding_steps, users, consents, subscriptions, invoice or revenue AMOUNTS; re-running is a no-op.
import { and, eq, isNull, sql } from 'drizzle-orm';
import { ACCOUNTANT_RESPONSE_TIME_DEFAULT, RESPONSE_TIME_FORBIDDEN_PATTERNS } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { accountants, allowanceAnswers, clientTaxProfiles, contentTexts, navInvoices, plans, revenueItems, systemState } from '../db/schema.js';
import { audit } from '../audit.js';
import { todayBudapest } from '../lib/dates.js';
import { DEFAULT_TEXTS } from '../content.js';
import { ensureFeeSettings, planAmountHuf } from './dijak.js';
import { NOTIFY_FROM_KEY, payerKindOf } from './szamla-ertesites.js';

export const OT1119_STEP_KEY = 'data.ot1119';
export const K28_STEP_KEY = 'data.k28';

/** §28.7.2: invoice_notify_from = now; legacy allowance flags → allowance_answers { gate 'lehet', version 0 }. */
export async function runDataStepOt1119(deps: Deps): Promise<Record<string, number> | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, OT1119_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  await db.insert(systemState).values({ key: NOTIFY_FROM_KEY, value: { at: now.toISOString() } }).onConflictDoNothing();
  const year = Number(todayBudapest(now).slice(0, 4));
  const legacy = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.year, year), sql`jsonb_array_length(coalesce(${clientTaxProfiles.allowances}, '[]'::jsonb)) > 0`));
  let answers = 0;
  for (const p of legacy) {
    const ins = await db.insert(allowanceAnswers).values({ clientId: p.clientId, year, gate: 'lehet', version: 0, createdAt: now, updatedAt: now }).onConflictDoNothing().returning({ id: allowanceAnswers.id });
    answers += ins.length;
  }
  const out = { answers };
  await db.insert(systemState).values({ key: OT1119_STEP_KEY, value: { at: now.toISOString(), ...out } }).onConflictDoNothing();
  await audit(db, { action: 'datastep.ot1119', actorRole: 'system', details: out });
  return out;
}

/**
 * §28.K.16: fee_settings seeded; the 'havi' plan price follows the fee setting and the 'havi_kata' plan exists;
 * customer_vat_status / payer_kind backfilled from the stored NAV data; the accountants' response-time texts and the
 * content overrides that promise an answer time are replaced (§28.K.15).
 */
export async function runDataStepK28(deps: Deps): Promise<Record<string, number> | 'already'> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, K28_STEP_KEY)).limit(1);
  if (done) return 'already';
  const now = deps.now();
  const fees = await ensureFeeSettings(deps, db);
  const havi = await planAmountHuf(deps, db, 'havi');
  await db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: havi, interval: 'month' }).onConflictDoUpdate({ target: plans.code, set: { priceHuf: havi } });
  const kata = await planAmountHuf(deps, db, 'havi_kata');
  await db.insert(plans).values({ code: 'havi_kata', name: 'Havi előfizetés (kata)', priceHuf: kata, interval: 'month' }).onConflictDoUpdate({ target: plans.code, set: { priceHuf: kata } });
  // backfill customer_vat_status / payer_kind (no amounts touched)
  let vat = 0;
  const invs = await db.select({ id: navInvoices.id, data: navInvoices.data, customerTaxNumber: navInvoices.customerTaxNumber }).from(navInvoices).where(isNull(navInvoices.customerVatStatus));
  for (const i of invs) {
    const v = (i.data as { customer?: { vatStatus?: string } } | null)?.customer?.vatStatus ?? null;
    if (v) {
      await db.update(navInvoices).set({ customerVatStatus: v }).where(eq(navInvoices.id, i.id));
      vat++;
    }
    const pk = payerKindOf({ customerVatStatus: v, data: null, customerTaxNumber: i.customerTaxNumber });
    await db.update(revenueItems).set({ payerKind: pk }).where(and(eq(revenueItems.navInvoiceId, i.id), isNull(revenueItems.payerKind)));
  }
  // §28.K.15 response-time texts
  const forbidden = (s: string) => RESPONSE_TIME_FORBIDDEN_PATTERNS.some((p) => new RegExp(p, 'i').test(s));
  let accs = 0;
  for (const a of await db.select({ id: accountants.id, t: accountants.responseTimeText }).from(accountants)) {
    if (!forbidden(a.t)) continue;
    await db.update(accountants).set({ responseTimeText: ACCOUNTANT_RESPONSE_TIME_DEFAULT, updatedAt: now }).where(eq(accountants.id, a.id));
    accs++;
  }
  let texts = 0;
  for (const t of await db.select().from(contentTexts)) {
    if (!forbidden(t.body)) continue;
    const def = DEFAULT_TEXTS[t.key];
    if (def !== undefined && !forbidden(def)) {
      // reset to the new default (the row is kept, only its text changes; audited below)
      await db.update(contentTexts).set({ body: def }).where(eq(contentTexts.key, t.key));
      texts++;
    }
  }
  const out = { fees, vat, accs, texts };
  await db.insert(systemState).values({ key: K28_STEP_KEY, value: { at: now.toISOString(), ...out } }).onConflictDoNothing();
  await audit(db, { action: 'datastep.k28', actorRole: 'system', details: out });
  if (texts) await deps.content.reload();
  return out;
}
