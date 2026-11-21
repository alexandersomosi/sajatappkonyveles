// SPEC §28.K.1 – prices and fees. Amounts live in fee_settings (admin-editable, history kept; unconfirmed = DEMO, never
// chargeable in production). One-off fees (annual closing, assisted change) are paid in advance with a ONE-TIME
// SimplePay payment (simplepay_transactions.kind 'egyszeri'; DEMO uses the demo pay page) – never the recurring token.
// A fee-bearing action starts only after FINISHED; a failed or abandoned payment changes nothing.
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { FeeChargeView, FeePayStart, FeeSettingView, FeesView } from '../_shared/api.js';
import { FEE_CHARGE_STATUS_LABELS, FEE_KIND_LABELS, FEE_UNIT_LABELS } from '../_shared/bekotes.js';
import { ASSIST_KIND_LABELS, FEE_DEFAULTS, FEE_KINDS, FEE_RULES, ONE_OFF_FEE_KINDS, type FeeKind } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, assistRequests, cardRegistrations, certificateEvents, certificateRequests, checkinItems, clients, faqItems, feeCharges, feeInvoices, feeSettingHistory, feeSettings, simplepayTransactions, subscriptions, systemState, users } from '../db/schema.js';
import { FEE_OWNER_PRICES_1120 } from '../_shared/enums.js';
import { PAYMENT_RULES, type FeePurposeK29 } from '../_shared/k29.js';
import { audit } from '../audit.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { log, safeErr } from '../log.js';
import { accountantParams, notify } from '../notify/notify.js';
import { authMethod, invoiceOf, issueFeeInvoice, orderRefFor } from './subscription.js';
import { accountantUserOf, staffRefs } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { fmt } from './kedvezmeny.js';

export type FeeChargeRow = typeof feeCharges.$inferSelect;
export type FeeSettingRow = typeof feeSettings.$inferSelect;

export const feeErr = {
  unpaid: () => new ApiError(409, 'fee_unpaid', 'Ehhez előbb ki kell fizetni a díjat.'),
  notPayable: (msg: string) => new ApiError(409, 'fee_not_payable', msg),
};

/** Seeds the missing fee_settings rows from FEE_DEFAULTS (data step; never overwrites an admin edit). */
export async function ensureFeeSettings(deps: Deps, db: DbOrTx): Promise<number> {
  let n = 0;
  for (const kind of FEE_KINDS) {
    const d = FEE_DEFAULTS[kind];
    const ins = await db
      .insert(feeSettings)
      .values({ kind, amountHuf: d.amountHuf, unit: d.unit, confirmedAt: d.confirmed ? deps.now() : null, updatedAt: deps.now() })
      .onConflictDoNothing()
      .returning({ kind: feeSettings.kind });
    if (ins.length) {
      n++;
      await db.insert(feeSettingHistory).values({ kind, amountHuf: d.amountHuf, confirmed: d.confirmed, changedAt: deps.now(), note: d.note });
    }
  }
  return n;
}

export async function feeSetting(db: DbOrTx, kind: FeeKind): Promise<{ amountHuf: number; unit: FeeSettingRow['unit']; confirmed: boolean; row: FeeSettingRow | null }> {
  const [r] = await db.select().from(feeSettings).where(eq(feeSettings.kind, kind)).limit(1);
  if (r) return { amountHuf: r.amountHuf, unit: r.unit, confirmed: Boolean(r.confirmedAt), row: r };
  const d = FEE_DEFAULTS[kind];
  return { amountHuf: d.amountHuf, unit: d.unit, confirmed: d.confirmed, row: null };
}

/** The monthly amount of a plan (fee_settings wins; the env PLAN_PRICE_HUF / brand price is the fallback). */
export async function planAmountHuf(deps: Deps, db: DbOrTx, planCode: string): Promise<number> {
  const kind: FeeKind = planCode === 'havi_kata' ? 'havidij_kata' : 'havidij';
  const [r] = await db.select().from(feeSettings).where(eq(feeSettings.kind, kind)).limit(1);
  if (!r) return deps.cfg.planPriceHuf;
  // a rise applies to running subscriptions only from effective_from (SPEC §28.K.1)
  if (r.effectiveFrom && r.effectiveFrom > todayBudapest(deps.now()) && r.amountHuf > deps.cfg.planPriceHuf) return deps.cfg.planPriceHuf;
  return r.amountHuf;
}

/** k7c2: the monthly fee every screen, legal text and report names (= what the scheduler charges for the plan 'havi'). */
export async function monthlyPriceHuf(deps: Deps): Promise<number> {
  return planAmountHuf(deps, deps.db, 'havi');
}

// ---------------------------------------------------------------------------------------------------------------------
// charges
// ---------------------------------------------------------------------------------------------------------------------
export async function createFeeCharge(
  deps: Deps,
  db: DbOrTx,
  cl: Pick<ClientRow, 'id'>,
  kind: FeeKind,
  purpose: FeeChargeRow['purpose'],
  by: string | null,
): Promise<FeeChargeRow | null> {
  const s = await feeSetting(db, kind);
  if (s.amountHuf <= 0) return null;
  const [row] = await db
    .insert(feeCharges)
    .values({ clientId: cl.id, kind, amountHuf: s.amountHuf, purpose, status: 'nyitott', dueOn: addDays(todayBudapest(deps.now()), 14), demo: !s.confirmed, createdBy: by, createdAt: deps.now() })
    .returning();
  await audit(db, { action: 'fee.charge_created', actorUserId: by, actorRole: by ? 'client' : 'system', targetType: 'fee_charge', targetId: row!.id, clientId: cl.id, details: { kind, amountHuf: s.amountHuf, demo: !s.confirmed } });
  return row!;
}

export async function feeChargeView(deps: Deps, db: DbOrTx, r: FeeChargeRow): Promise<FeeChargeView> {
  const [inv] = r.feeInvoiceId ? await db.select().from(feeInvoices).where(eq(feeInvoices.id, r.feeInvoiceId)).limit(1) : [];
  return {
    id: r.id,
    kind: r.kind,
    label: FEE_KIND_LABELS[r.kind],
    amountHuf: r.amountHuf,
    demo: r.demo,
    status: r.status,
    statusText: FEE_CHARGE_STATUS_LABELS[r.status],
    purpose: r.purpose,
    dueOn: r.dueOn,
    createdAt: r.createdAt.toISOString(),
    paidAt: r.paidAt?.toISOString() ?? null,
    feeInvoice: inv ? { id: inv.id, number: inv.number ?? '', issuedOn: inv.issuedOn ?? '', amountHuf: inv.amountHuf, demo: inv.demo, fileId: inv.pdfFileId ?? '', feeKind: r.kind, label: FEE_KIND_LABELS[r.kind] } : null,
    canPay: r.status === 'nyitott' && !(deps.cfg.appEnv === 'production' && r.demo),
  };
}

export async function chargeById(db: DbOrTx, id: string | null | undefined): Promise<FeeChargeRow | null> {
  if (!id) return null;
  const [r] = await db.select().from(feeCharges).where(eq(feeCharges.id, id)).limit(1);
  return r ?? null;
}

export async function feesView(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<FeesView> {
  const table: FeesView['table'] = [];
  const params = await accountantParams(db, cl.accountantId);
  // javító kör 11-21: the annual-closing fee is not listed while its switch is off (the ÁSZF is fixed first) [T1, JOGI]
  const { evesKapcsolok } = await import('./kata.js');
  const evesDijBe = (await evesKapcsolok(db)).evesZarasDij;
  for (const kind of FEE_KINDS) {
    if (kind === 'havidij_kata') continue;
    if (kind === 'eves_zaras' && !evesDijBe) continue;
    const s = await feeSetting(db, kind);
    table.push({
      kind,
      label: FEE_KIND_LABELS[kind],
      amountHuf: s.amountHuf,
      unit: s.unit,
      demo: !s.confirmed,
      line: await deps.content.render('dij.fee_line', { ...params, label: FEE_KIND_LABELS[kind], dij: fmt(s.amountHuf), unit: FEE_UNIT_LABELS[s.unit] }),
    });
  }
  const rows = await db.select().from(feeCharges).where(eq(feeCharges.clientId, cl.id)).orderBy(desc(feeCharges.createdAt));
  const views = await Promise.all(rows.map((r) => feeChargeView(deps, db, r)));
  const inv = await db.select().from(feeInvoices).where(and(eq(feeInvoices.clientId, cl.id), eq(feeInvoices.status, 'kiallitva'))).orderBy(desc(feeInvoices.issuedOn));
  return {
    table,
    inPlan: await deps.content.get('dij.in_plan'),
    open: views.filter((v) => v.status === 'nyitott'),
    paid: views.filter((v) => v.status !== 'nyitott' && v.status !== 'visszavonva'),
    invoices: inv.map((f) => ({ id: f.id, number: f.number ?? '', issuedOn: f.issuedOn ?? '', amountHuf: f.amountHuf, demo: f.demo, fileId: f.pdfFileId ?? '' })),
  };
}

/** POST /client/fees/:id/pay – one-time SimplePay payment (DEMO: the demo pay page). */
export async function startFeePayment(deps: Deps, cl: ClientRow, chargeId: string, platform: 'web' | 'android' | 'ios'): Promise<FeePayStart> {
  const db = deps.db;
  const [ch] = await db.select().from(feeCharges).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.clientId, cl.id))).limit(1);
  if (!ch) throw E.notFound();
  if (ch.status !== 'nyitott') throw E.conflict('Ezt a díjat már nem kell kifizetni.');
  if (deps.cfg.appEnv === 'production' && ch.demo) throw feeErr.notPayable(await deps.content.get('dij.not_payable'));
  const mode = deps.cfg.simplepay.mode;
  if (mode === 'disabled') throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
  const now = deps.now();
  const orderRef = orderRefFor(now);
  const back = platform === 'web' ? 'web' : 'app';
  let paymentUrl: string;
  let transactionId: number | null = null;
  if (mode === 'demo') paymentUrl = `${deps.cfg.apiPublicUrl}/api/v1/payments/demo/pay?o=${encodeURIComponent(orderRef)}`;
  else {
    if (!deps.simplepay) throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1);
    try {
      const res = await deps.simplepay.start({
        orderRef,
        customer: clientName(cl),
        customerEmail: u?.email ?? '',
        total: ch.amountHuf,
        threeDSReqAuthMethod: await authMethod(db, cl.userId),
        invoice: invoiceOf(cl),
        timeout: new Date(now.getTime() + 30 * 60_000),
        url: `${deps.cfg.apiPublicUrl}/api/v1/payments/simplepay/back?p=${back}`,
      });
      paymentUrl = res.paymentUrl;
      transactionId = res.transactionId;
    } catch (err) {
      log().warn({ err: safeErr(err) }, 'simplepay one-off start failed');
      throw E.upstream('A fizetési oldal most nem érhető el. Próbáld újra pár perc múlva.');
    }
  }
  const [t] = await db
    .insert(simplepayTransactions)
    .values({ orderRef, simplepayTransactionId: transactionId, kind: 'egyszeri', clientId: cl.id, amountHuf: ch.amountHuf, status: 'INIT', platform: back, mode, paymentUrlEnc: mode === 'demo' ? null : deps.data.enc(paymentUrl, 'simplepay_transactions.payment_url') })
    .returning();
  await db.update(feeCharges).set({ simplepayTransactionId: t!.id }).where(eq(feeCharges.id, ch.id));
  await audit(db, { action: 'fee.pay_started', actorUserId: cl.userId, actorRole: 'client', targetType: 'fee_charge', targetId: ch.id, clientId: cl.id, details: { mode, platform } });
  return { paymentUrl, orderRef, chargeId: ch.id, amountHuf: ch.amountHuf, demo: mode === 'demo' || ch.demo };
}

/** IPN FINISHED of an 'egyszeri' transaction: charge → fizetve, fee invoice, then the purpose action. Idempotent. */
export async function applyFeeFinished(deps: Deps, txId: string, ipnTransactionId: number): Promise<void> {
  const db = deps.db;
  let after: { cl: ClientRow; charge: FeeChargeRow } | null = null;
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(simplepayTransactions).where(eq(simplepayTransactions.id, txId)).limit(1).for('update');
    if (!t || t.appliedAt) return;
    const now = deps.now();
    await tx.update(simplepayTransactions).set({ status: 'FINISHED', finishedAt: now, appliedAt: now, simplepayTransactionId: ipnTransactionId || t.simplepayTransactionId, updatedAt: now }).where(eq(simplepayTransactions.id, t.id));
    const [ch] = await tx.select().from(feeCharges).where(eq(feeCharges.simplepayTransactionId, t.id)).limit(1);
    const [cl] = await tx.select().from(clients).where(eq(clients.id, t.clientId)).limit(1);
    if (!ch || !cl) return;
    await tx.update(feeCharges).set({ status: 'fizetve', paidAt: now }).where(eq(feeCharges.id, ch.id));
    await issueFeeInvoice(deps, tx, { ...t, simplepayTransactionId: ipnTransactionId || t.simplepayTransactionId }, cl);
    const [inv] = await tx.select({ id: feeInvoices.id }).from(feeInvoices).where(eq(feeInvoices.simplepayTransactionId, t.id)).orderBy(desc(feeInvoices.createdAt)).limit(1);
    if (inv) await tx.update(feeCharges).set({ feeInvoiceId: inv.id }).where(eq(feeCharges.id, ch.id));
    await audit(tx, { action: 'fee.paid', actorRole: 'system', targetType: 'fee_charge', targetId: ch.id, clientId: cl.id, details: { kind: ch.kind, amountHuf: ch.amountHuf } });
    after = { cl, charge: { ...ch, status: 'fizetve', paidAt: now } };
  });
  if (!after) return;
  const { cl, charge } = after as { cl: ClientRow; charge: FeeChargeRow };
  await notify(deps, db, { userId: cl.userId, kind: 'fee_invoice_issued', params: { amount: `${fmt(charge.amountHuf)} Ft` }, link: '/fiok/dijak' });
  await runPurpose(deps, cl, charge);
}

/**
 * SPEC §29.1.7 / §29.1.15: what a paid (or waived) charge of the new purposes unlocks. B2 registers its own handlers
 * ('igazolas' → the certificate request goes from 'dijra_var' to 'beerkezett'; 'megszuntetes' may add more) without
 * editing this file. Without a handler the defaults below run.
 */
export type FeePurposeHandler = (deps: Deps, cl: ClientRow, ch: FeeChargeRow) => Promise<void>;
const PURPOSE_HANDLERS = new Map<string, FeePurposeHandler>();
export function registerFeePurposeHandler(type: 'igazolas' | 'megszuntetes' | 'admin', fn: FeePurposeHandler): void {
  PURPOSE_HANDLERS.set(type, fn);
}

/** Exported for services/payments.ts (the Stripe / new DEMO flow). */
export async function runPurposeFor(deps: Deps, cl: ClientRow, ch: FeeChargeRow): Promise<void> {
  return runPurpose(deps, cl, ch);
}

/** The action a paid charge unlocks (assist dijra_var → egyeztetve; annual dijra_var → konyvelonel; §29 purposes). */
async function runPurpose(deps: Deps, cl: ClientRow, ch: FeeChargeRow): Promise<void> {
  const db = deps.db;
  const acc = await accountantUserOf(db, cl);
  const custom = PURPOSE_HANDLERS.get(ch.purpose.type);
  if (custom) {
    await custom(deps, cl, ch);
  } else if (ch.purpose.type === 'igazolas') {
    // default (no B2 handler loaded): the certificate request waits no more for the fee
    const rid = ch.purpose.requestId;
    const moved = await db.update(certificateRequests).set({ status: 'beerkezett', updatedAt: deps.now() }).where(and(eq(certificateRequests.requestId, rid), eq(certificateRequests.status, 'dijra_var'))).returning({ id: certificateRequests.requestId });
    if (moved.length) await db.insert(certificateEvents).values({ requestId: rid, status: 'beerkezett', at: deps.now(), note: 'díj kifizetve' });
  } else if (ch.purpose.type === 'megszuntetes') {
    const [a] = await db.select().from(assistRequests).where(eq(assistRequests.id, ch.purpose.assistId)).limit(1);
    if (a && a.status === 'dijra_var') {
      const next = a.callbackId ? 'visszahivas_kerve' : 'egyeztetve';
      await db.update(assistRequests).set({ status: next, statusChangedAt: deps.now(), updatedAt: deps.now() }).where(eq(assistRequests.id, a.id));
      await audit(db, { action: 'assist.dij_fizetve', actorRole: 'system', targetType: 'assist', targetId: a.id, clientId: cl.id, details: { kind: a.kind, to: next } });
      if (acc && next === 'egyeztetve') await notify(deps, db, { userId: acc.userId, kind: 'assist_task', variant: 'valtozas_adatok', params: { clientName: clientName(cl), kindLabel: ASSIST_KIND_LABELS[a.kind] }, link: `/helyettunk/${a.id}` });
    }
  }
  if (ch.purpose.type === 'igazolas' || ch.purpose.type === 'megszuntetes' || ch.purpose.type === 'admin') {
    const { computeServiceLock } = await import('./zarolas.js');
    await computeServiceLock(deps, cl.id);
    return;
  }
  if (ch.purpose.type === 'valtozas') {
    const [a] = await db.select().from(assistRequests).where(eq(assistRequests.id, ch.purpose.assistId)).limit(1);
    if (a && a.status === 'dijra_var') {
      const next = a.callbackId ? 'visszahivas_kerve' : 'egyeztetve';
      await db.update(assistRequests).set({ status: next, statusChangedAt: deps.now(), updatedAt: deps.now() }).where(eq(assistRequests.id, a.id));
      await audit(db, { action: 'assist.dij_fizetve', actorRole: 'system', targetType: 'assist', targetId: a.id, clientId: cl.id, details: { kind: a.kind, to: next } });
      if (acc && next === 'egyeztetve') await notify(deps, db, { userId: acc.userId, kind: 'assist_task', variant: 'valtozas_adatok', params: { clientName: clientName(cl), kindLabel: ASSIST_KIND_LABELS[a.kind] }, link: `/helyettunk/${a.id}` });
    }
    // k6c2: the monthly check-in item behind this fee follows the payment – the ball is with the team now
    const moved = await db
      .update(checkinItems)
      .set({ status: 'csapatnal', updatedAt: deps.now() })
      .where(and(eq(checkinItems.clientId, cl.id), eq(checkinItems.status, 'dijra_var'), or(eq(checkinItems.feeChargeId, ch.id), eq(checkinItems.assistId, ch.purpose.assistId))))
      .returning({ id: checkinItems.id });
    if (moved.length) await audit(db, { action: 'checkin.item_fee_paid', actorRole: 'system', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { items: moved.length } });
  } else {
    const [an] = await db.select().from(annualClosings).where(eq(annualClosings.id, ch.purpose.annualId)).limit(1);
    if (an && an.status === 'dijra_var') {
      await db.update(annualClosings).set({ status: 'konyvelonel', updatedAt: deps.now() }).where(eq(annualClosings.id, an.id));
      await audit(db, { action: 'annual.paid', actorRole: 'system', targetType: 'annual_closing', targetId: an.id, clientId: cl.id });
      if (acc) await notify(deps, db, { userId: acc.userId, kind: 'annual_submitted', params: { clientName: clientName(cl), feeState: 'fizetve' }, link: `/ugyfelek/${cl.id}?tab=eves-zaras` });
    }
  }
  // a paid annual-closing charge may lift the service lock
  const { computeServiceLock } = await import('./zarolas.js');
  await computeServiceLock(deps, cl.id);
}

export async function applyFeeFailed(deps: Deps, txId: string, codes: string[]): Promise<void> {
  const now = deps.now();
  await deps.db
    .update(simplepayTransactions)
    .set({ appliedAt: now, finishedAt: now, errorCodes: codes, status: 'NOTAUTHORIZED', updatedAt: now })
    .where(and(eq(simplepayTransactions.id, txId), sql`${simplepayTransactions.appliedAt} is null`));
  await audit(deps.db, { action: 'fee.pay_failed', actorRole: 'system', targetType: 'simplepay_transaction', targetId: txId, details: { codes } });
}

/** A charge whose purpose was cancelled: unpaid → visszavonva; paid but work not started → visszaterites_kell (admin task). */
export async function cancelChargeFor(deps: Deps, db: DbOrTx, chargeId: string | null | undefined, workStarted: boolean): Promise<void> {
  const ch = await chargeById(db, chargeId);
  if (!ch) return;
  if (ch.status === 'nyitott') {
    await db.update(feeCharges).set({ status: 'visszavonva' }).where(eq(feeCharges.id, ch.id));
    await audit(db, { action: 'fee.cancelled', actorRole: 'system', targetType: 'fee_charge', targetId: ch.id, clientId: ch.clientId });
  } else if (ch.status === 'fizetve' && !workStarted) {
    await db.update(feeCharges).set({ status: 'visszaterites_kell' }).where(eq(feeCharges.id, ch.id));
    await audit(db, { action: 'fee.refund_needed', actorRole: 'system', targetType: 'fee_charge', targetId: ch.id, clientId: ch.clientId });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// admin (/admin/dijak)
// ---------------------------------------------------------------------------------------------------------------------
export async function feeSettingViews(deps: Deps, db: DbOrTx): Promise<FeeSettingView[]> {
  await ensureFeeSettings(deps, db);
  const rows = await db.select().from(feeSettings);
  const hist = await db.select().from(feeSettingHistory).orderBy(desc(feeSettingHistory.changedAt));
  const refs = await staffRefs(db, [...rows.map((r) => r.confirmedBy), ...hist.map((h) => h.changedBy)]);
  const out: FeeSettingView[] = [];
  for (const kind of FEE_KINDS) {
    const r = rows.find((x) => x.kind === kind);
    if (!r) continue;
    let cardLimitAffected: number | undefined;
    if (kind === 'havidij' || kind === 'havidij_kata') {
      const [n] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(subscriptions)
        .innerJoin(cardRegistrations, eq(cardRegistrations.id, subscriptions.cardRegistrationId))
        .where(and(inArray(subscriptions.status, ['active', 'past_due']), sql`${cardRegistrations.maxAmountHuf} < ${r.amountHuf}`));
      cardLimitAffected = Number(n?.n ?? 0);
    }
    out.push({
      kind,
      label: FEE_KIND_LABELS[kind],
      amountHuf: r.amountHuf,
      unit: r.unit,
      confirmed: Boolean(r.confirmedAt),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      confirmedBy: r.confirmedBy ? (refs.get(r.confirmedBy) ?? null) : null,
      effectiveFrom: r.effectiveFrom,
      ...(cardLimitAffected !== undefined ? { cardLimitAffected } : {}),
      history: hist.filter((h) => h.kind === kind).map((h) => ({ amountHuf: h.amountHuf, confirmed: h.confirmed, changedBy: h.changedBy ? (refs.get(h.changedBy) ?? null) : null, changedAt: h.changedAt.toISOString(), note: h.note })),
    });
  }
  return out;
}

export async function updateFeeSetting(deps: Deps, db: DbOrTx, kind: FeeKind, amountHuf: number, o: { effectiveFrom?: string; note?: string; by: string }): Promise<void> {
  const cur = await feeSetting(db, kind);
  const today = todayBudapest(deps.now());
  const plan = kind === 'havidij' || kind === 'havidij_kata';
  // SPEC §29.4.1: whole forints, 0 (free) or at least the Stripe HUF minimum
  if (!Number.isInteger(amountHuf) || amountHuf < 0 || (amountHuf > 0 && amountHuf < PAYMENT_RULES.minChargeHuf))
    throw E.validation({ amountHuf: `0 Ft (ingyenes) vagy legalább ${PAYMENT_RULES.minChargeHuf} Ft, egész forintban.` });
  if (plan && amountHuf > cur.amountHuf) {
    const min = addDays(today, FEE_RULES.priceRiseNoticeDays);
    if (!o.effectiveFrom || o.effectiveFrom < min) throw E.validation({ effectiveFrom: `Emelésnél legalább ${FEE_RULES.priceRiseNoticeDays} nap múlva (${min} vagy később).` });
  }
  // SPEC §29.4.1 (owner 11-20): an admin edit IS the confirmation – the price is real from now on (no DEMO mark).
  const v = { amountHuf, confirmedAt: deps.now(), confirmedBy: o.by, effectiveFrom: o.effectiveFrom ?? null, updatedBy: o.by, updatedAt: deps.now() };
  await db.insert(feeSettings).values({ kind, unit: FEE_DEFAULTS[kind].unit, ...v }).onConflictDoUpdate({ target: feeSettings.kind, set: v });
  await db.insert(feeSettingHistory).values({ kind, amountHuf, confirmed: true, changedBy: o.by, changedAt: deps.now(), note: o.note ?? null });
  await audit(db, { action: 'fee.setting_changed', actorUserId: o.by, actorRole: 'admin', targetType: 'fee_setting', details: { kind, amountHuf, confirmed: true } });
}

/**
 * SPEC §29.1.15 createFeeChargeK29: a fee charge of any kind (amount from fee_settings unless given; null when 0 Ft).
 * Purpose 'admin' (the console adds a fee): the caller sends fee_due; the client pays in the app (never charged without his tap).
 */
export async function createFeeChargeK29(deps: Deps, db: DbOrTx, i: { clientId: string; kind: FeeKind; amountHuf?: number; purpose: FeePurposeK29; by: string | null }): Promise<FeeChargeRow | null> {
  const s = await feeSetting(db, i.kind);
  const amount = i.amountHuf ?? s.amountHuf;
  if (!Number.isInteger(amount) || amount < 0) throw E.validation({ amountHuf: 'Egész forint kell.' });
  if (amount === 0) return null;
  if (amount < PAYMENT_RULES.minChargeHuf) throw E.validation({ amountHuf: `Legalább ${PAYMENT_RULES.minChargeHuf} Ft.` });
  const [row] = await db
    .insert(feeCharges)
    .values({ clientId: i.clientId, kind: i.kind, amountHuf: amount, purpose: i.purpose, status: 'nyitott', dueOn: addDays(todayBudapest(deps.now()), 14), demo: false, createdBy: i.by, createdAt: deps.now() })
    .returning();
  await audit(db, { action: 'fee.charge_created', actorUserId: i.by, actorRole: i.purpose.type === 'admin' ? 'admin' : i.by ? 'client' : 'system', targetType: 'fee_charge', targetId: row!.id, clientId: i.clientId, details: { kind: i.kind, amountHuf: amount, purpose: i.purpose.type } });
  // the caller notifies (fee_due for an admin fee, the purpose's own texts otherwise)
  return row!;
}

/**
 * SPEC §29.4.1 / §29.12 data step `data.k29` (worker start, idempotent): fee_settings rows of the new kinds; every row
 * whose amount equals the owner's real price of 11-20 and is unconfirmed → confirmed ("Tulaj 11-20: végleges ár"); a
 * row with another amount (an admin edit) stays and is listed in the audit; subscriptions.provider backfill check.
 */
export const NO_TRIAL_FAQ_ANSWER = 'A havidíjat a szerződés és a kártya megadása napjától fizeted. Ebben benne van a vállalkozásod elindítása is: az útmutató, az értesítés átnézése és a visszahívás.';

export async function runDataStepK29(deps: Deps): Promise<Record<string, unknown>> {
  const db = deps.db;
  const [done] = await db.select().from(systemState).where(eq(systemState.key, 'data.k29')).limit(1);
  const inserted = await ensureFeeSettings(deps, db);
  if (done) return { already: true, inserted };
  const confirmed: string[] = [];
  const left: { kind: string; amountHuf: number }[] = [];
  for (const [kind, price] of Object.entries(FEE_OWNER_PRICES_1120) as [FeeKind, number][]) {
    const [r] = await db.select().from(feeSettings).where(eq(feeSettings.kind, kind)).limit(1);
    if (!r || r.confirmedAt) continue;
    if (r.amountHuf === price) {
      await db.update(feeSettings).set({ confirmedAt: deps.now(), updatedAt: deps.now() }).where(eq(feeSettings.kind, kind));
      await db.insert(feeSettingHistory).values({ kind, amountHuf: price, confirmed: true, changedAt: deps.now(), note: 'Tulaj 11-20: végleges ár' });
      confirmed.push(kind);
    } else left.push({ kind, amountHuf: r.amountHuf });
  }
  // open charges of these kinds lose the DEMO mark (the price is real)
  const undemo = await db.update(feeCharges).set({ demo: false }).where(and(eq(feeCharges.demo, true), eq(feeCharges.status, 'nyitott'))).returning({ id: feeCharges.id });
  // SPEC §29.4.2: the FAQ answer that promised a free period (only when it is still one of our old default texts)
  const faq = await db
    .update(faqItems)
    .set({ answer: NO_TRIAL_FAQ_ANSWER, updatedAt: deps.now() })
    .where(and(eq(faqItems.question, 'Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?'), or(like(faqItems.answer, 'Amíg nincs adószámod, nem fizetsz semmit%'), like(faqItems.answer, 'Akkor, amikor már megvan az adószámod%'))))
    .returning({ id: faqItems.id });
  const legacyDemo = await db.update(subscriptions).set({ provider: 'demo' }).where(and(eq(subscriptions.mode, 'demo'), eq(subscriptions.provider, 'simplepay'))).returning({ id: subscriptions.id });
  const value = { at: deps.now().toISOString(), inserted, confirmed, left, openChargesUndemo: undemo.length, providerBackfill: legacyDemo.length, faqNoTrial: faq.length };
  await db.insert(systemState).values({ key: 'data.k29', value }).onConflictDoNothing();
  await audit(db, { action: 'datastep.k29', actorRole: 'system', targetType: 'system', targetId: 'data.k29', details: value });
  return value;
}

export async function confirmFeeSetting(deps: Deps, db: DbOrTx, kind: FeeKind, by: string): Promise<void> {
  await ensureFeeSettings(deps, db);
  const [r] = await db.update(feeSettings).set({ confirmedAt: deps.now(), confirmedBy: by, updatedAt: deps.now() }).where(eq(feeSettings.kind, kind)).returning();
  if (!r) throw E.notFound();
  await db.insert(feeSettingHistory).values({ kind, amountHuf: r.amountHuf, confirmed: true, changedBy: by, changedAt: deps.now(), note: 'megerősítve' });
  await audit(db, { action: 'fee.setting_confirmed', actorUserId: by, actorRole: 'admin', targetType: 'fee_setting', details: { kind, amountHuf: r.amountHuf } });
}

export async function waiveCharge(deps: Deps, db: DbOrTx, id: string, reason: string, by: string): Promise<FeeChargeRow> {
  const [ch] = await db.select().from(feeCharges).where(eq(feeCharges.id, id)).limit(1);
  if (!ch) throw E.notFound();
  if (ch.status !== 'nyitott') throw E.conflict('Csak fizetésre váró díjat lehet elengedni.');
  const [u] = await db.update(feeCharges).set({ status: 'elengedve', waivedBy: by, waivedAt: deps.now(), waivedReason: reason.slice(0, 500) }).where(eq(feeCharges.id, id)).returning();
  await audit(db, { action: 'fee.waived', actorUserId: by, actorRole: 'admin', targetType: 'fee_charge', targetId: id, clientId: ch.clientId, details: { kind: ch.kind } });
  const [cl] = await db.select().from(clients).where(eq(clients.id, ch.clientId)).limit(1);
  if (cl) await runPurpose(deps, cl, u!);
  return u!;
}

export async function markRefunded(deps: Deps, db: DbOrTx, id: string, note: string | undefined, by: string): Promise<FeeChargeRow> {
  const [ch] = await db.select().from(feeCharges).where(eq(feeCharges.id, id)).limit(1);
  if (!ch) throw E.notFound();
  if (ch.status !== 'visszaterites_kell') throw E.conflict('Ehhez nincs visszatérítési feladat.');
  const [u] = await db.update(feeCharges).set({ status: 'visszaterites_megtortent', refundNote: note?.slice(0, 500) ?? null }).where(eq(feeCharges.id, id)).returning();
  await audit(db, { action: 'fee.refunded', actorUserId: by, actorRole: 'admin', targetType: 'fee_charge', targetId: id, clientId: ch.clientId });
  return u!;
}

export async function openChargesOf(db: DbOrTx, clientId: string): Promise<FeeChargeRow[]> {
  return db.select().from(feeCharges).where(and(eq(feeCharges.clientId, clientId), eq(feeCharges.status, 'nyitott'))).orderBy(asc(feeCharges.createdAt));
}

export { ONE_OFF_FEE_KINDS };
