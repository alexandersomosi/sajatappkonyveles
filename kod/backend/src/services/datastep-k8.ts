// k8 ALAP-B (B12) – one-time DEMO data step at worker start (system_state 'data.k8'; APP_ENV=demo only, idempotent).
// Two NEW fictional demo clients (no login, never alex@ / tulaj@ / the Google test account, no existing row changed) pay
// by bank transfer, so the console shows the three states at once:
//  - "Utaló Péter": a paid díjbekérő, the next one comes on the first day of his next period ("fizetett");
//  - "Átutaló Ágnes": last month paid, this month's díjbekérő 4 days late ("késik", reminders 1 and 4 already sent).
// The documents are DEMO díjbekérők without a PDF (nothing is mailed by this step).
import { eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { clients, payments, subscriptions, systemState, transferRequests, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, addMonths, todayBudapest } from '../lib/dates.js';
import { log } from '../log.js';
import { kozlemenyOf, orderNoOf } from '../_shared/k8.js';

export const K8_STEP_KEY = 'data.k8';
const DOMAIN = 'demo.kezjegy.test';

export async function runDataStepK8(deps: Deps): Promise<{ clients: number; transfers: number } | 'already' | 'skip'> {
  const db = deps.db;
  if (deps.cfg.appEnv !== 'demo') return 'skip';
  const [done] = await db.select().from(systemState).where(eq(systemState.key, K8_STEP_KEY)).limit(1);
  if (done) return 'already';
  const { seedContext, demoClient } = await import('../seed/ot1119.js');
  let ctx;
  try {
    ctx = await seedContext(deps);
  } catch (e) {
    // no demo accountant (a fresh / test database): nothing to show, try again at the next start
    log().info({ err: String((e as Error).message ?? e) }, 'data step k8 skipped');
    return 'skip';
  }
  const today = todayBudapest(deps.now());
  const now = deps.now();
  const { ensurePlan } = await import('./subscription.js');
  await ensurePlan(deps, db);
  let nClients = 0;
  let nTransfers = 0;
  const make = async (email: string, first: string, last: string, idSeed: number, period: { start: string; end: string }, plan: { start: string; end: string; status: 'fizetve' | 'kesik'; issued: string; paid: string | null; reminders: number[] }[]) => {
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (exists) return;
    const cl = await demoClient(ctx, { email, first, last, idSeed, login: false, status: 'fofoglalkozasu' });
    nClients++;
    const [row] = await db.select({ no: clients.customerNo }).from(clients).where(eq(clients.id, cl.id)).limit(1);
    const no = row!.no!;
    const [sub] = await db
      .insert(subscriptions)
      .values({ clientId: cl.id, planCode: 'havi', status: 'active', mode: 'demo', provider: 'demo', billingMethod: 'atutalas', currentPeriodStart: period.start, currentPeriodEnd: period.end, nextChargeAt: null })
      .returning({ id: subscriptions.id });
    let seq = 1;
    for (const t of plan) {
      const orderNo = orderNoOf(no, t.start);
      let paymentId: string | null = null;
      if (t.status === 'fizetve' && t.paid) {
        const [p] = await db
          .insert(payments)
          .values({ clientId: cl.id, subscriptionId: sub!.id, kind: 'havi', provider: 'atutalas', mode: 'demo', amountHuf: 19_999, periodStart: t.start, periodEnd: t.end, status: 'sikeres', initiated: 'utemezo', idempotencyKey: `atutalas-demo:${orderNo}`, appliedAt: now, succeededAt: now, createdAt: now, updatedAt: now })
          .returning({ id: payments.id });
        paymentId = p!.id;
      }
      await db.insert(transferRequests).values({
        clientId: cl.id,
        subscriptionId: sub!.id,
        kind: 'havi',
        periodStart: t.start,
        periodEnd: t.end,
        amountHuf: 19_999,
        orderNo,
        kozlemeny: kozlemenyOf(no, orderNo, 'havi'),
        proformaNumber: `DEMO-D-${t.issued.slice(0, 4)}-K8${String(idSeed)}${seq++}`,
        issuedOn: t.issued,
        dueOn: addDays(t.issued, 8),
        status: t.status,
        paidOn: t.paid,
        paidAmountHuf: t.paid ? 19_999 : null,
        paidSource: t.paid ? 'demo' : null,
        paymentId,
        remindersSent: t.reminders,
        mode: 'demo',
        createdAt: now,
        updatedAt: now,
      });
      nTransfers++;
    }
  };
  // paid and waiting for the next period
  const pStart = addDays(today, -20);
  await make(`utalo.peter.k8@${DOMAIN}`, 'Péter', 'Utaló', 71, { start: pStart, end: addMonths(pStart, 1) }, [{ start: pStart, end: addMonths(pStart, 1), status: 'fizetve', issued: pStart, paid: addDays(pStart, 3), reminders: [] }]);
  // last month paid, this month 4 days late
  const lateStart = addDays(today, -12);
  const prevStart = addMonths(lateStart, -1);
  await make(`atutalo.agnes.k8@${DOMAIN}`, 'Ágnes', 'Átutaló', 72, { start: prevStart, end: lateStart }, [
    { start: prevStart, end: lateStart, status: 'fizetve', issued: prevStart, paid: addDays(prevStart, 5), reminders: [] },
    { start: lateStart, end: addMonths(lateStart, 1), status: 'kesik', issued: lateStart, paid: null, reminders: [1, 4] },
  ]);
  const result = { clients: nClients, transfers: nTransfers };
  await db.insert(systemState).values({ key: K8_STEP_KEY, value: { at: now.toISOString(), result } }).onConflictDoNothing();
  await audit(db, { action: 'system.data_step', actorRole: 'system', targetType: 'system', targetId: K8_STEP_KEY, details: result });
  log().info({ step: K8_STEP_KEY, ...result }, 'data step k8 done');
  return result;
}
