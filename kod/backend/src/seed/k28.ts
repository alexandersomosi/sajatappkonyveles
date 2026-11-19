// Idempotent DEMO additions of SPEC §28.K.21 (seed:k28) – same rules as seed:ot1119 (src/seed/ot1119.ts): fake data
// only, never touches alex@, tulaj@, bence.kovacs@, david@; marker system_state['seed.k28']; passwords only appended.
//     Lakatos Gréta   (login) KATA from 2026-01-01; private customers + one DOMESTIC invoice (unpaid) → the warning
//     Kiss Norbert    (login) átalány főfogl.; November check-in answered (≥ 36 h job) + assisted valtozas_adoadat in
//                     dijra_var with an open 7 999 Ft DEMO charge → the demo pay flow
//     Fazekas Ilona   (login) subscription suspended → the service lock
//     Bárány Tamás    (login, bekotes_alatt, 'van') "Most nem tudom" for the adószám + EFO → panel tasks
//     Molnár Csilla   (login) szünetel since 2026-10-01 → availability fee; annual closing 2025 'kesz'
//   + Tóth Bálint's 2026 annual closing row 'nem_indult'; one accepted mailbox log row for Szabó Eszter.
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { ChangeData } from '../_shared/api.js';
import type { Deps } from '../deps.js';
import { annualClosings, assistRequests, checkinItems, clientEmployerStatus, clients, mailboxLog, monthlyCheckins, subscriptionPauses, subscriptions, systemState, users } from '../db/schema.js';
import { todayBudapest } from '../lib/dates.js';
import { log, safeErr } from '../log.js';
import { createFeeCharge } from '../services/dijak.js';
import { computeServiceLock } from '../services/zarolas.js';
import { recalcYear } from '../services/tax.js';
import { demoClient, demoInvoices, DOMAIN, exists, runSeedMain, seedContext, writeCredentials, type SeedResult } from './ot1119.js';

export const SEED_KEY_K28 = 'seed.k28';

export async function seedK28(deps: Deps, o: { credentialsFile: string }): Promise<SeedResult> {
  const [marker] = await deps.db.select().from(systemState).where(eq(systemState.key, SEED_KEY_K28)).limit(1);
  if (marker) return { status: 'exists', created: [] };
  const ctx = await seedContext(deps);
  const created: string[] = [];
  const today = todayBudapest(ctx.now);
  const months = Number(today.slice(5, 7));

  // 1. Lakatos Gréta – KATA
  if (!(await exists(deps, `greta.lakatos@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `greta.lakatos@${DOMAIN}`, first: 'Gréta', last: 'Lakatos', idSeed: 91, login: true, status: 'fofoglalkozasu', regime: 'kata' });
    const inv = [];
    for (let m = 1; m <= months; m++) {
      const d = `2026-${String(m).padStart(2, '0')}-12`;
      if (d >= today) continue;
      inv.push({ n: `LG-2026-${String(m).padStart(3, '0')}`, date: d, amount: 880_000, customer: null, vat: 'PRIVATE_PERSON' as const });
    }
    inv.push({ n: 'LG-2026-900', date: today, amount: 150_000, customer: 'Bodza Kiadó Kft.', vat: 'DOMESTIC' as const });
    await demoInvoices(ctx, cl.id, inv);
    await deps.db.update(clients).set({ taxRegimeAnswer: 'kata', nextFlags: ['kata_figyelem'] }).where(eq(clients.id, cl.id));
    await recalcYear(deps, deps.db, cl.id, 2026);
    created.push('greta');
  }

  // 2. Kiss Norbert – November check-in + assisted tax-data change waiting for the 7 999 Ft (DEMO) payment
  if (!(await exists(deps, `norbert.kiss@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `norbert.kiss@${DOMAIN}`, first: 'Norbert', last: 'Kiss', idSeed: 92, login: true, status: 'fofoglalkozasu' });
    const change: ChangeData = { kind: 'valtozas_adoadat', items: ['munkavegzes'], workKind: 'munkaviszony_mellett', effectiveOn: '2026-11-03', note: null };
    const [as] = await deps.db
      .insert(assistRequests)
      .values({ clientId: cl.id, kind: 'valtozas_adoadat', status: 'dijra_var', statusChangedAt: ctx.at(6), createdByRole: 'client', createdByUserId: cl.userId, changeData: change, changeEffectiveOn: '2026-11-03', createdAt: ctx.at(6), updatedAt: ctx.at(6) })
      .returning({ id: assistRequests.id });
    const charge = await createFeeCharge(deps, deps.db, cl, 'valtozas_jogallas', { type: 'valtozas', assistId: as!.id }, cl.userId);
    await deps.db.update(assistRequests).set({ feeChargeId: charge?.id ?? null }).where(eq(assistRequests.id, as!.id));
    const answer = { item: 'munkaviszony' as const, since: '2026-11-03', weeklyHours: 'legalabb_36' as const, how: 'helyettunk' as const, change };
    const [ch] = await deps.db.insert(monthlyCheckins).values({ clientId: cl.id, period: '2026-10', status: 'valtozott', answers: [answer], openedAt: ctx.at(24 * 18), answeredAt: ctx.at(6) }).returning({ id: monthlyCheckins.id });
    await deps.db.insert(checkinItems).values({ checkinId: ch!.id, clientId: cl.id, item: 'munkaviszony', status: 'dijra_var', details: answer, assistId: as!.id, feeChargeId: charge?.id ?? null, createdAt: ctx.at(6), updatedAt: ctx.at(6) });
    created.push('norbert');
  }

  // 3. Fazekas Ilona – suspended subscription → service lock
  if (!(await exists(deps, `ilona.fazekas@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `ilona.fazekas@${DOMAIN}`, first: 'Ilona', last: 'Fazekas', idSeed: 93, login: true, status: 'fofoglalkozasu' });
    await deps.db.insert(subscriptions).values({ clientId: cl.id, planCode: 'havi', status: 'suspended', mode: 'demo', failedAttempts: 3, firstFailedAt: ctx.at(24 * 16), lastFailureCode: 'DEMO_NOTAUTHORIZED' }).onConflictDoNothing();
    await computeServiceLock(deps, cl.id);
    created.push('ilona');
  }

  // 4. Bárány Tamás – onboarding, "Most nem tudom" + EFO
  if (!(await exists(deps, `tamas.barany@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `tamas.barany@${DOMAIN}`, first: 'Tamás', last: 'Bárány', idSeed: 94, login: true, lifecycle: 'bekotes_alatt', path: 'van' });
    await deps.db.update(clients).set({ adoszamPending: true, taxRegimeAnswer: 'nem_tudom' }).where(eq(clients.id, cl.id));
    await deps.db.insert(clientEmployerStatus).values({ clientId: cl.id, answer: 'efo', answeredAt: ctx.at(3), source: 'onboarding' }).onConflictDoNothing();
    created.push('tamas');
  }

  // 5. Molnár Csilla – szünetel since 2026-10-01; annual closing 2025 'kesz'
  if (!(await exists(deps, `csilla.molnar@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `csilla.molnar@${DOMAIN}`, first: 'Csilla', last: 'Molnár', idSeed: 95, login: true, status: 'fofoglalkozasu' });
    await deps.db.insert(subscriptionPauses).values({ clientId: cl.id, from: '2026-10-01', to: null, source: 'konyvelo', createdBy: ctx.bence.userId, createdAt: ctx.at(24 * 50) });
    await deps.db.insert(annualClosings).values({ clientId: cl.id, taxYear: 2025, regime: 'atalany', status: 'kesz', questionnaireDue: '2026-03-15', submittedAt: new Date('2026-02-20T10:00:00Z'), approvedAt: new Date('2026-05-02T10:00:00Z'), filedSzjaAt: new Date('2026-05-10T10:00:00Z'), filedHipaAt: new Date('2026-05-20T10:00:00Z') }).onConflictDoNothing();
    created.push('csilla');
  }

  // 6. Bálint's 2026 annual closing (opens on 5 January) and one accepted mail for Eszter
  const [balint] = await deps.db.select({ id: clients.id }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, `balint.toth@${DOMAIN}`)).limit(1);
  if (balint) await deps.db.insert(annualClosings).values({ clientId: balint.id, taxYear: 2026, regime: 'atalany', status: 'nem_indult', questionnaireDue: '2027-03-15' }).onConflictDoNothing();
  const [eszter] = await deps.db.select({ id: clients.id }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, `eszter.szabo@${DOMAIN}`)).limit(1);
  if (eszter) await deps.db.insert(mailboxLog).values({ clientId: eszter.id, receivedAt: ctx.at(26), senderMasked: 'e***@demo.kezjegy.test', status: 'elfogadva', attachments: 2 });

  await writeCredentials(o.credentialsFile, ctx.lines);
  await deps.db.insert(systemState).values({ key: SEED_KEY_K28, value: { at: ctx.now.toISOString(), created } }).onConflictDoNothing();
  return { status: 'seeded', created };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSeedMain('k28', seedK28).catch((err) => {
    log().fatal({ err: safeErr(err) }, 'seed k28 failed');
    console.error(`Seed hiba: ${(err as Error).message}`);
    process.exit(1);
  });
}
