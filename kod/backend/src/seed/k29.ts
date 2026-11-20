// SPEC §29.17 seed:k29 – idempotent DEMO additions (FAKE data only; refuses APP_ENV=production; never touches alex@,
// tulaj@, bence.kovacs@, david@; passwords only appended to the credentials file, never printed). B1 part (payments):
//     Halmi Zsófia  (login) DEMO card (payment_methods), two paid months; the second one refunded → DEMO storno
//     Kerekes Anna  (login) DEMO card; this month's charge waits for the bank's confirmation (hitelesites_kell) →
//                   past_due + "Fizesd ki" open on the Főoldal
// Then the B2 part (seed/k29f.ts: certificates, income statement, calendar feed, Németh Péter's free month, Fodor Márk).
// Marker system_state['seed.k29'] (B2 keeps its own 'seed.k29f').
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { paymentMethods, payments, subscriptions, systemState } from '../db/schema.js';
import { addMonths, budapestLocalToUtc, todayBudapest } from '../lib/dates.js';
import { log, safeErr } from '../log.js';
import { applyChargeFailure, applyPaymentSucceeded, refundPayment } from '../services/payments.js';
import { ensurePlan } from '../services/subscription.js';
import { demoCard } from '../payments/demo.js';
import { processInvoice } from '../payments/invoices.js';
import { demoClient, DOMAIN, exists, runSeedMain, seedContext, writeCredentials, type SeedResult } from './ot1119.js';

export const SEED_KEY_K29 = 'seed.k29';

async function demoSubscription(deps: Deps, clientId: string, start: string, now: Date): Promise<{ subId: string; pmId: string }> {
  await ensurePlan(deps, deps.db);
  const card = demoCard(now, `demo_pm_seed_${clientId.replace(/-/g, '').slice(0, 12)}`);
  const [pm] = await deps.db
    .insert(paymentMethods)
    .values({ clientId, provider: 'demo', mode: 'demo', stripePaymentMethodId: card.paymentMethodRef, brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear, status: 'aktiv', createdAt: now })
    .returning({ id: paymentMethods.id });
  const [s] = await deps.db
    .insert(subscriptions)
    .values({ clientId, planCode: 'havi', status: 'incomplete', mode: 'demo', provider: 'demo', paymentMethodId: pm!.id, currentPeriodStart: start, currentPeriodEnd: start })
    .onConflictDoNothing()
    .returning({ id: subscriptions.id });
  return { subId: s!.id, pmId: pm!.id };
}

/** A paid DEMO month through the real apply code (fee invoice = DEMO díjbekérő). */
async function paidMonth(deps: Deps, clientId: string, subId: string, pmId: string, start: string, kind: 'elso_havi' | 'havi'): Promise<string> {
  const [p] = await deps.db
    .insert(payments)
    .values({ clientId, subscriptionId: subId, kind, provider: 'demo', mode: 'demo', amountHuf: 19_999, periodStart: start, periodEnd: addMonths(start, 1), status: 'letrehozva', initiated: kind === 'havi' ? 'utemezo' : 'ugyfel', offSession: kind === 'havi', attemptDay: start, idempotencyKey: `seed:k29:${clientId}:${start}`, paymentMethodId: pmId, createdAt: budapestLocalToUtc(start, '09:00') })
    .returning({ id: payments.id });
  await applyPaymentSucceeded(deps, p!.id, { providerRef: `demo_pi_seed_${p!.id.replace(/-/g, '').slice(0, 16)}`, chargeRef: null, card: demoCard(deps.now(), `demo_pm_seed_${clientId.replace(/-/g, '').slice(0, 12)}`) });
  return p!.id;
}

export async function seedK29(deps: Deps, o: { credentialsFile: string }): Promise<SeedResult> {
  const created: string[] = [];
  const [marker] = await deps.db.select().from(systemState).where(eq(systemState.key, SEED_KEY_K29)).limit(1);
  if (!marker) {
    const ctx = await seedContext(deps);
    const today = todayBudapest(ctx.now);
    const thisMonth = `${today.slice(0, 7)}-01`;
    const prevMonth = addMonths(thisMonth, -1);
    const prev2 = addMonths(thisMonth, -2);

    // 1. Halmi Zsófia – two paid months, the second refunded (full) → DEMO storno
    if (!(await exists(deps, `zsofia.halmi@${DOMAIN}`))) {
      const cl = await demoClient(ctx, { email: `zsofia.halmi@${DOMAIN}`, first: 'Zsófia', last: 'Halmi', idSeed: 97, login: true, status: 'fofoglalkozasu' });
      const { subId, pmId } = await demoSubscription(deps, cl.id, prev2, ctx.now);
      await paidMonth(deps, cl.id, subId, pmId, prev2, 'elso_havi');
      const second = await paidMonth(deps, cl.id, subId, pmId, prevMonth, 'havi');
      await paidMonth(deps, cl.id, subId, pmId, thisMonth, 'havi');
      await refundPayment(deps, { paymentId: second, amountHuf: 19_999, reason: 'DEMO: visszatérítés a próba kedvéért', byUserId: null });
      created.push('zsofia');
    }

    // 2. Kerekes Anna – this month's charge waits for the bank's confirmation (3DS) → Fizesd ki
    // 'auth+' = the DEMO provider keeps asking for the bank's confirmation on every retry (SPEC §29.1.12)
    if (!(await exists(deps, `auth+anna.kerekes@${DOMAIN}`))) {
      const cl = await demoClient(ctx, { email: `auth+anna.kerekes@${DOMAIN}`, first: 'Anna', last: 'Kerekes', idSeed: 98, login: true, status: 'mellekallasu' });
      const { subId, pmId } = await demoSubscription(deps, cl.id, prevMonth, ctx.now);
      await paidMonth(deps, cl.id, subId, pmId, prevMonth, 'elso_havi');
      const [p] = await deps.db
        .insert(payments)
        .values({ clientId: cl.id, subscriptionId: subId, kind: 'havi', provider: 'demo', mode: 'demo', amountHuf: 19_999, periodStart: thisMonth, periodEnd: addMonths(thisMonth, 1), status: 'letrehozva', initiated: 'utemezo', offSession: true, attemptDay: thisMonth, idempotencyKey: `seed:k29:${cl.id}:${thisMonth}`, paymentMethodId: pmId })
        .returning({ id: payments.id });
      await applyChargeFailure(deps, p!.id, { kind: 'requires_auth', providerRef: null, code: 'authentication_required' });
      created.push('anna');
    }

    // any invoice still in progress (the DEMO díjbekérő is local: it never stays)
    const open = await deps.db.select({ id: payments.feeInvoiceId }).from(payments);
    for (const r of open) if (r.id) await processInvoice(deps, r.id).catch(() => undefined);
    await writeCredentials(o.credentialsFile, ctx.lines);
    await deps.db.insert(systemState).values({ key: SEED_KEY_K29, value: { at: ctx.now.toISOString(), created } }).onConflictDoNothing();
  }
  // B2 part (its own marker)
  let b2: SeedResult | null = null;
  try {
    const mod = (await import('./k29f.js')) as { seedK29f?: (d: Deps, o: { credentialsFile: string }) => Promise<SeedResult> };
    if (mod.seedK29f) b2 = await mod.seedK29f(deps, o);
  } catch (e) {
    log().error({ err: safeErr(e) }, 'seed k29f failed');
    throw e;
  }
  const all = [...created, ...(b2?.created ?? [])];
  return { status: all.length ? 'seeded' : 'exists', created: all };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSeedMain('k29', seedK29).catch((err) => {
    log().fatal({ err: safeErr(err) }, 'seed k29 failed');
    console.error(`Seed hiba: ${(err as Error).message}`);
    process.exit(1);
  });
}
