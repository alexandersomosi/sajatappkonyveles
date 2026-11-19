// Subscription + SimplePay recurring card payments (SPEC §5.9, §6.5, §9). Money state changes
// only on IPN FINISHED (or /query FINISHED). DEMO mode uses the same apply code with a demo
// signature secret and never contacts SimplePay.
import { and, asc, count, desc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { SubscriptionStartResult, SubscriptionView } from '../_shared/api.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { cardRegistrations, clients, consents, feeInvoices, paymentTokens, plans, simplepayTransactions, subscriptions, users } from '../db/schema.js';
import { addDays, addMonths, budapestLocalToUtc, huFullDateIg, todayBudapest } from '../lib/dates.js';
import { randomBase32, randomToken } from '../lib/crypto.js';
import { E } from '../lib/errors.js';
import { log, safeErr } from '../log.js';
import { audit } from '../audit.js';
import { notify } from '../notify/notify.js';
import { FINAL_FAIL, FINAL_OK, SimplePayError, spSign, spTime, spVerify, salt as newSalt, type SpInvoice } from '../payments/simplepay.js';
import { demoFeeInvoiceProvider, InvoiceNotConfigured } from '../payments/invoices.js';
import { endRelationship } from './kyc.js';
import { checkCompletion, setStep } from './onboarding.js';
import { computeFlags } from './flags.js';
import { SIMPLEPAY_DOCS } from '../legal.js';
import { filledLegalText } from './contracts.js';

type SubRow = typeof subscriptions.$inferSelect;
type TxRow = typeof simplepayTransactions.$inferSelect;
type Mode = 'demo' | 'sandbox' | 'live';

export const DEMO_MERCHANT = 'DEMO';
/** Bad IPN signatures accepted per IP per hour before the IPN route answers 429. */
export const IPN_BAD_PER_HOUR = 30;

export function orderRefFor(now: Date): string {
  const d = todayBudapest(now).replace(/-/g, '');
  return `KJ-${d}-${randomBase32(10)}`;
}

function mode(deps: Deps): Mode {
  const m = deps.cfg.simplepay.mode;
  if (m === 'disabled') throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
  return m;
}

/** How long an unfinished card registration is handed back instead of starting a new one (SimplePay timeout is 30 min). */
const REOPEN_WINDOW_MS = 25 * 60_000;

function demoPayUrl(deps: Deps, orderRef: string): string {
  return `${deps.cfg.apiPublicUrl}/api/v1/payments/demo/pay?o=${encodeURIComponent(orderRef)}`;
}

export async function ensurePlan(deps: Deps, db: DbOrTx): Promise<void> {
  await db
    .insert(plans)
    .values({ code: 'havi', name: 'Havi előfizetés', priceHuf: deps.cfg.planPriceHuf, interval: 'month' })
    .onConflictDoUpdate({ target: plans.code, set: { priceHuf: deps.cfg.planPriceHuf } });
}

/**
 * The first day a NEW card registration pays for. SimplePay registers a card together with a
 * payment, so a card change or a restart prepays the next month: it starts where the paid period
 * ends (no day is paid twice); only when nothing is paid any more does it start today.
 */
export function nextPaidStart(sub: Pick<SubRow, 'status' | 'currentPeriodEnd'> | undefined, today: string): string {
  if (sub?.currentPeriodEnd && sub.currentPeriodEnd > today && (sub.status === 'active' || sub.status === 'canceled')) return sub.currentPeriodEnd;
  return today;
}

export async function subscriptionView(deps: Deps, db: DbOrTx, clientId: string): Promise<SubscriptionView> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  const m = deps.cfg.simplepay.mode === 'disabled' ? 'live' : deps.cfg.simplepay.mode;
  const today = todayBudapest(deps.now());
  if (!sub) return { status: 'incomplete', mode: m, priceHuf: deps.cfg.planPriceHuf, cancelAtPeriodEnd: false, failedAttempts: 0, nextPaidPeriodStart: today };
  let card: SubscriptionView['card'];
  if (sub.cardRegistrationId) {
    const [reg] = await db.select().from(cardRegistrations).where(eq(cardRegistrations.id, sub.cardRegistrationId)).limit(1);
    if (reg && reg.status === 'aktiv') {
      const [n] = await db.select({ n: count() }).from(paymentTokens).where(and(eq(paymentTokens.cardRegistrationId, reg.id), eq(paymentTokens.status, 'aktiv')));
      card = { mask: reg.cardMask ?? '', expiry: reg.cardExpiry ?? '', tokensLeft: Number(n?.n ?? 0), tokensUntil: reg.tokensUntil?.toISOString() ?? '' };
    }
  }
  return {
    status: sub.status,
    mode: sub.mode,
    priceHuf: deps.cfg.planPriceHuf,
    ...(sub.currentPeriodEnd ? { currentPeriodEnd: sub.currentPeriodEnd } : {}),
    ...(sub.nextChargeAt && !sub.cancelAtPeriodEnd && sub.status !== 'canceled' ? { nextChargeAt: sub.nextChargeAt.toISOString() } : {}),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    ...(card ? { card } : {}),
    failedAttempts: sub.failedAttempts,
    ...(sub.graceUntil ? { graceUntil: sub.graceUntil } : {}),
    nextPaidPeriodStart: nextPaidStart(sub, today),
  };
}

export function invoiceOf(cl: typeof clients.$inferSelect): SpInvoice {
  return {
    name: `${cl.lastName} ${cl.firstName}`.trim(),
    country: 'HU',
    state: cl.addressCity ?? '',
    city: cl.addressCity ?? '',
    zip: cl.addressZip ?? '',
    address: cl.addressLine ?? '',
  };
}

export async function authMethod(db: DbOrTx, userId: string): Promise<'02' | '05'> {
  const [u] = await db.select({ ph: users.passwordHash, g: users.googleSub, a: users.appleSub }).from(users).where(eq(users.id, userId)).limit(1);
  return !u?.ph && (u?.g || u?.a) ? '05' : '02';
}

export async function startRegistration(deps: Deps, clientId: string, platform: 'app' | 'web', ipHmac: string, ua: string, purpose: 'subscribe' | 'card_update' = 'subscribe'): Promise<SubscriptionStartResult> {
  const m = mode(deps);
  const db = deps.db;
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) throw E.notFound();
  const [u] = await db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  if (!u?.emailVerifiedAt) throw E.conflict('Előbb erősítsd meg az e-mail-címedet.');
  if (!cl.addressZip || !cl.addressCity || !cl.addressLine) throw E.conflict('Előbb add meg a címedet az Adataid lépésben (a számlához kell).');
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  // A card change / restart is allowed at any time: the payment covers the month that starts when
  // the paid period ends (nextPaidStart, recomputed when the payment is applied), so no day is paid
  // twice. A registration opened in the last 2 minutes blocks a second one (double tap).
  // An unfinished registration that is still payable (SimplePay timeout: 30 min) is handed back as it is: the
  // client who stepped back from the payment page gets the SAME page again instead of a 409 and a two-minute wait
  // (round 1, 2026-11-19). No second card registration, no second pair of consents.
  const [open] = await db
    .select()
    .from(simplepayTransactions)
    .where(and(eq(simplepayTransactions.clientId, clientId), eq(simplepayTransactions.kind, 'regisztracio'), eq(simplepayTransactions.mode, m), isNull(simplepayTransactions.appliedAt), sql`${simplepayTransactions.createdAt} > ${new Date(deps.now().getTime() - REOPEN_WINDOW_MS)}`))
    .orderBy(desc(simplepayTransactions.createdAt))
    .limit(1);
  if (open) {
    const url = m === 'demo' ? demoPayUrl(deps, open.orderRef) : open.paymentUrlEnc ? deps.data.dec(open.paymentUrlEnc, 'simplepay_transactions.payment_url') : null;
    const [reg] = open.cardRegistrationId ? await db.select().from(cardRegistrations).where(eq(cardRegistrations.id, open.cardRegistrationId)).limit(1) : [];
    if (url && reg?.status === 'fuggo' && open.periodStart && open.periodEnd) {
      await audit(db, { action: 'subscription.start_reopened', actorUserId: cl.userId, actorRole: 'client', targetType: 'subscription', targetId: open.subscriptionId ?? null, clientId, details: { mode: m, platform, purpose } });
      return {
        paymentUrl: url,
        orderRef: open.orderRef,
        tokenInfo: { times: deps.cfg.simplepay.recurringTimes, maxAmountHuf: reg.maxAmountHuf, until: (reg.tokensUntil ?? deps.now()).toISOString() },
        period: { start: open.periodStart, end: open.periodEnd },
      };
    }
    // An older row without a stored page address: only a double tap (2 minutes) is refused.
    if (open.createdAt.getTime() > deps.now().getTime() - 2 * 60_000)
      throw E.conflict('Az előbb már elindítottad a kártya megadását. Fejezd be a fizetési oldalon, vagy próbáld újra két perc múlva.');
  }
  const now = deps.now();
  const periodStart = nextPaidStart(sub, todayBudapest(now));
  const periodEnd = addMonths(periodStart, 1);
  const times = deps.cfg.simplepay.recurringTimes;
  const until = new Date(now.getTime());
  until.setUTCMonth(until.getUTCMonth() + deps.cfg.simplepay.tokenValidMonths);
  // SPEC §28.K.1: the plan amount is an admin setting (fee_settings.havidij); the card's maxAmount covers it.
  const { planAmountHuf } = await import('./dijak.js');
  const price = await planAmountHuf(deps, db, sub?.planCode ?? 'havi');
  const orderRef = orderRefFor(now);

  // Consents for the two SimplePay declarations (SPEC §9.2).
  const versions = deps.legal.versions();
  for (const t of SIMPLEPAY_DOCS) {
    const filled = await filledLegalText(deps, t, clientId);
    await db.insert(consents).values({ userId: cl.userId, docType: t, version: versions[t] ?? filled.version, textSha256: filled.sha256, ipHmac, userAgent: ua.slice(0, 120) });
  }
  await ensurePlan(deps, db);

  let transactionId: number | null = null;
  let tokens: string[];
  let paymentUrl: string;
  if (m === 'demo') {
    tokens = Array.from({ length: times }, () => `DEMO${randomToken(18)}`);
    paymentUrl = demoPayUrl(deps, orderRef);
  } else {
    if (!deps.simplepay) throw E.notConfigured('A kártyás fizetés még nincs bekapcsolva.');
    try {
      const res = await deps.simplepay.start({
        orderRef,
        customer: `${cl.lastName} ${cl.firstName}`.trim(),
        customerEmail: u.email,
        total: price,
        threeDSReqAuthMethod: await authMethod(db, cl.userId),
        invoice: invoiceOf(cl),
        timeout: new Date(now.getTime() + 30 * 60_000),
        url: `${deps.cfg.apiPublicUrl}/api/v1/payments/simplepay/back?p=${platform}`,
        recurring: { times, until, maxAmount: price },
      });
      transactionId = res.transactionId;
      tokens = res.tokens;
      paymentUrl = res.paymentUrl;
    } catch (err) {
      if (err instanceof SimplePayError) {
        log().warn({ codes: err.errorCodes }, 'simplepay start failed');
        throw E.upstream('A fizetési oldal most nem érhető el. Próbáld újra pár perc múlva.');
      }
      throw err;
    }
  }

  await db.transaction(async (tx) => {
    const [reg] = await tx
      .insert(cardRegistrations)
      .values({ clientId, simplepayCardId: transactionId, orderRef, maxAmountHuf: price, tokensUntil: until, status: 'fuggo', mode: m })
      .returning({ id: cardRegistrations.id });
    let seq = 0;
    for (const t of tokens) {
      await tx.insert(paymentTokens).values({ cardRegistrationId: reg!.id, tokenEnc: deps.data.enc(t, 'payment_tokens.token'), seq: seq++, status: 'fuggo' });
    }
    let subId = sub?.id;
    if (!sub) {
      const [s] = await tx.insert(subscriptions).values({ clientId, planCode: 'havi', status: 'incomplete', mode: m }).returning({ id: subscriptions.id });
      subId = s!.id;
    }
    await tx.insert(simplepayTransactions).values({
      orderRef,
      simplepayTransactionId: transactionId,
      kind: 'regisztracio',
      clientId,
      subscriptionId: subId,
      cardRegistrationId: reg!.id,
      amountHuf: price,
      status: 'INIT',
      platform,
      mode: m,
      periodStart,
      periodEnd,
      // kept (encrypted) so a client who stepped back can be sent to the same payment page again
      paymentUrlEnc: m === 'demo' ? null : deps.data.enc(paymentUrl, 'simplepay_transactions.payment_url'),
    });
    await audit(tx, { action: 'subscription.start', actorUserId: cl.userId, actorRole: 'client', targetType: 'subscription', targetId: subId ?? null, clientId, details: { mode: m, platform, purpose, periodStart } });
  });
  return { paymentUrl, orderRef, tokenInfo: { times, maxAmountHuf: price, until: until.toISOString() }, period: { start: periodStart, end: periodEnd } };
}

export async function tokenInfoSentence(deps: Deps, times: number, maxAmount: number, until: Date): Promise<string> {
  return deps.content.render('ui.subscription.token_info', {
    times,
    maxAmount: `${new Intl.NumberFormat('hu-HU').format(maxAmount)} Ft`,
    untilText: huFullDateIg(todayBudapest(until)),
  });
}

// ---------------- IPN ----------------

export interface IpnBody {
  salt?: string;
  orderRef: string;
  method?: string;
  merchant: string;
  finishDate?: string;
  paymentDate?: string;
  transactionId: number;
  status: string;
  cardMask?: string;
  expiry?: string;
  [k: string]: unknown;
}

export interface IpnReply {
  status: 200 | 400;
  body: string;
  signature?: string;
}

function ipnSecret(deps: Deps): { secret: string; merchant: string } | null {
  const m = deps.cfg.simplepay.mode;
  if (m === 'sandbox' || m === 'live') return { secret: deps.cfg.simplepay.secret, merchant: deps.cfg.simplepay.merchant };
  if (m === 'demo') return { secret: deps.cfg.simplepay.demoSecret, merchant: DEMO_MERCHANT };
  return null;
}

/** SPEC §9.4: verify → idempotent apply → 200 with the received JSON + receiveDate, signed. */
export async function handleIpn(deps: Deps, raw: string, signature: string | null | undefined, meta: { ipHmac?: string; requestId?: string } = {}): Promise<IpnReply> {
  const s = ipnSecret(deps);
  if (!s) return { status: 400, body: JSON.stringify({ error: 'not_configured' }) };
  if (!spVerify(s.secret, raw, signature)) {
    // Unauthenticated noise: no audit row per request (the append-only log must not be floodable); one log
    // line per IP per hour, and the route refuses an IP after too many bad signatures (public.ts).
    const n = deps.limiter.hit(`ipn-bad:${meta.ipHmac ?? '-'}`, IPN_BAD_PER_HOUR, 3600_000);
    if (n.count === 1) log().warn({ ipHmac: meta.ipHmac, requestId: meta.requestId }, 'simplepay ipn: bad signature');
    return { status: 400, body: JSON.stringify({ error: 'bad_signature' }) };
  }
  let body: IpnBody;
  try {
    body = JSON.parse(raw) as IpnBody;
  } catch {
    return { status: 400, body: JSON.stringify({ error: 'bad_json' }) };
  }
  if (body.merchant !== s.merchant || typeof body.orderRef !== 'string') {
    // Correctly signed with our secret but for another merchant: worth one audit row (it is rare and real).
    await audit(deps.db, { action: 'payment.ipn', actorRole: 'system', ipHmac: meta.ipHmac, requestId: meta.requestId, details: { valid: false, reason: 'merchant' } });
    return { status: 400, body: JSON.stringify({ error: 'bad_merchant' }) };
  }
  await processIpn(deps, body);
  const reply = JSON.stringify({ ...body, receiveDate: spTime(deps.now()) });
  return { status: 200, body: reply, signature: spSign(s.secret, reply) };
}

export async function processIpn(deps: Deps, body: IpnBody): Promise<void> {
  const now = deps.now();
  const [txRow] = await deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, body.orderRef)).limit(1);
  if (!txRow) {
    await audit(deps.db, { action: 'payment.ipn', actorRole: 'system', details: { valid: true, known: false } });
    return;
  }
  // A transaction started in another mode (e.g. DEMO, before going live) is never applied in this mode.
  if (txRow.mode !== deps.cfg.simplepay.mode) {
    await audit(deps.db, { action: 'payment.ipn', actorRole: 'system', targetType: 'simplepay_transaction', targetId: txRow.id, clientId: txRow.clientId, details: { valid: false, reason: 'mode_mismatch', txMode: txRow.mode, mode: deps.cfg.simplepay.mode } });
    return;
  }
  // Once a final status was applied it stays: a later IPN (REFUND, REVERSED, or a replay) is stored
  // apart and raised to the admin (Rendszer page), never half-recorded over the applied one.
  if (txRow.appliedAt) {
    const changed = String(body.status) !== txRow.status;
    await deps.db
      .update(simplepayTransactions)
      .set({
        ipnCount: sql`${simplepayTransactions.ipnCount} + 1`,
        lastIpnAt: now,
        ...(changed ? { afterFinalStatus: String(body.status), afterFinalAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(simplepayTransactions.id, txRow.id));
    await audit(deps.db, {
      action: changed ? 'payment.after_final' : 'payment.ipn',
      actorRole: 'system',
      targetType: 'simplepay_transaction',
      targetId: txRow.id,
      clientId: txRow.clientId,
      details: { valid: true, status: body.status, finalStatus: txRow.status, kind: txRow.kind, replay: !changed },
    });
    if (changed) log().warn({ status: body.status, finalStatus: txRow.status }, 'simplepay IPN after final status – admin alert');
    return;
  }
  await deps.db
    .update(simplepayTransactions)
    .set({
      status: String(body.status),
      simplepayTransactionId: Number(body.transactionId) || txRow.simplepayTransactionId,
      ipnCount: sql`${simplepayTransactions.ipnCount} + 1`,
      lastIpnAt: now,
      updatedAt: now,
    })
    .where(eq(simplepayTransactions.id, txRow.id));
  await audit(deps.db, { action: 'payment.ipn', actorRole: 'system', targetType: 'simplepay_transaction', targetId: txRow.id, clientId: txRow.clientId, details: { valid: true, status: body.status, kind: txRow.kind } });
  // SPEC §28.K.1: a one-off fee (annual closing, assisted change) has no subscription behind it.
  if (txRow.kind === 'egyszeri') {
    const { applyFeeFinished, applyFeeFailed } = await import('./dijak.js');
    if (body.status === FINAL_OK) await applyFeeFinished(deps, txRow.id, Number(body.transactionId));
    else if (FINAL_FAIL.has(String(body.status))) await applyFeeFailed(deps, txRow.id, [String(body.status)]);
    return;
  }
  if (body.status === FINAL_OK) await applyFinished(deps, txRow.id, { transactionId: Number(body.transactionId), cardMask: body.cardMask, expiry: body.expiry });
  else if (FINAL_FAIL.has(String(body.status))) await applyFailed(deps, txRow.id, [String(body.status)]);
}

function expiryDate(expiry: string | undefined): string | null {
  if (!expiry) return null;
  const m = /^(\d{4})-(\d{2})/.exec(expiry);
  if (!m) return null;
  const end = addDays(addMonths(`${m[1]}-${m[2]}-01`, 1), -1);
  return end;
}

/** Idempotent: the transaction row is locked and `applied_at` set once. */
export async function applyFinished(deps: Deps, txId: string, ipn: { transactionId: number; cardMask?: string; expiry?: string }): Promise<void> {
  const db = deps.db;
  const oldCards: { id: string; cardId: number | null; mode: Mode }[] = [];
  let notifyUser: string | null = null;
  let feeAmount = 0;
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(simplepayTransactions).where(eq(simplepayTransactions.id, txId)).limit(1).for('update');
    if (!t || t.appliedAt) return;
    const now = deps.now();
    const today = todayBudapest(now);
    const [sub] = t.subscriptionId ? await tx.select().from(subscriptions).where(eq(subscriptions.id, t.subscriptionId)).limit(1) : [];
    const [cl] = await tx.select().from(clients).where(eq(clients.id, t.clientId)).limit(1);
    if (!sub || !cl) return;
    let periodStart: string;
    let periodEnd: string;
    if (t.kind === 'regisztracio') {
      const exp = expiryDate(ipn.expiry);
      const [reg] = await tx.select().from(cardRegistrations).where(eq(cardRegistrations.id, t.cardRegistrationId!)).limit(1);
      const expEnd = exp ? budapestLocalToUtc(exp, '23:59') : null;
      const tokensUntil = reg?.tokensUntil && expEnd ? new Date(Math.min(reg.tokensUntil.getTime(), expEnd.getTime())) : (reg?.tokensUntil ?? expEnd);
      await tx
        .update(cardRegistrations)
        .set({ status: 'aktiv', cardMask: ipn.cardMask ?? reg?.cardMask ?? null, cardExpiry: exp, tokensUntil, simplepayCardId: ipn.transactionId || reg?.simplepayCardId, updatedAt: now })
        .where(eq(cardRegistrations.id, t.cardRegistrationId!));
      await tx.update(paymentTokens).set({ status: 'aktiv' }).where(and(eq(paymentTokens.cardRegistrationId, t.cardRegistrationId!), eq(paymentTokens.status, 'fuggo')));
      const others = await tx
        .select()
        .from(cardRegistrations)
        .where(and(eq(cardRegistrations.clientId, t.clientId), eq(cardRegistrations.status, 'aktiv'), sql`${cardRegistrations.id} <> ${t.cardRegistrationId}`));
      for (const o of others) {
        oldCards.push({ id: o.id, cardId: o.simplepayCardId, mode: o.mode });
        await tx.update(cardRegistrations).set({ status: 'torolve', updatedAt: now }).where(eq(cardRegistrations.id, o.id));
        await tx.update(paymentTokens).set({ status: 'visszavont' }).where(and(eq(paymentTokens.cardRegistrationId, o.id), inArray(paymentTokens.status, ['aktiv', 'fuggo'])));
      }
      // Same rule as at the start: never charge again for days already paid (card change, restart
      // after a cancelled deletion, re-subscribe while the old period still runs).
      periodStart = nextPaidStart(sub, today);
      periodEnd = addMonths(periodStart, 1);
      await tx
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextChargeAt: budapestLocalToUtc(periodEnd, '09:00'),
          nextRetryAt: null,
          failedAttempts: 0,
          firstFailedAt: null,
          lastFailureCode: null,
          graceUntil: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          cardRegistrationId: t.cardRegistrationId,
          renewalNotifiedAt: null,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
      await setStep(deps, tx, t.clientId, 'elofizetes', 'kesz');
    } else {
      periodStart = t.periodStart ?? sub.currentPeriodEnd ?? today;
      periodEnd = t.periodEnd ?? addMonths(periodStart, 1);
      if (t.tokenId) await tx.update(paymentTokens).set({ status: 'felhasznalt', usedAt: now, usedOrderRef: t.orderRef }).where(eq(paymentTokens.id, t.tokenId));
      await tx
        .update(subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          nextChargeAt: budapestLocalToUtc(periodEnd, '09:00'),
          nextRetryAt: null,
          failedAttempts: 0,
          firstFailedAt: null,
          lastFailureCode: null,
          graceUntil: null,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, sub.id));
    }
    await tx
      .update(simplepayTransactions)
      .set({ status: FINAL_OK, finishedAt: now, appliedAt: now, periodStart, periodEnd, simplepayTransactionId: ipn.transactionId || t.simplepayTransactionId, updatedAt: now })
      .where(eq(simplepayTransactions.id, t.id));
    if (cl.lifecycle === 'felfuggesztve' || cl.lifecycle === 'megszunt') {
      await tx.update(clients).set({ lifecycle: 'aktiv', updatedAt: now }).where(eq(clients.id, cl.id));
    }
    await issueFeeInvoice(deps, tx, { ...t, periodStart, periodEnd, simplepayTransactionId: ipn.transactionId || t.simplepayTransactionId }, cl);
    await audit(tx, { action: t.kind === 'regisztracio' ? 'subscription.activated' : 'subscription.renewed', actorRole: 'system', targetType: 'subscription', targetId: sub.id, clientId: cl.id, details: { orderRef: t.orderRef, periodStart, periodEnd, mode: t.mode } });
    notifyUser = cl.userId;
    feeAmount = t.amountHuf;
  });
  if (notifyUser) {
    await notify(deps, deps.db, { userId: notifyUser, kind: 'fee_invoice_issued', params: { amount: `${new Intl.NumberFormat('hu-HU').format(feeAmount)} Ft` }, link: '/fiok/dijszamlak' });
    const [t] = await db.select().from(simplepayTransactions).where(eq(simplepayTransactions.id, txId)).limit(1);
    if (t) {
      await checkCompletion(deps, db, t.clientId);
      await computeFlags(deps, db, t.clientId);
      await renewalCheck(deps, t.clientId);
    }
  }
  for (const o of oldCards) {
    if (o.mode !== 'demo' && o.cardId && deps.simplepay) {
      await deps.simplepay.cardCancel(o.cardId).catch((err: Error) => log().warn({ err: safeErr(err) }, 'old card cancel failed'));
    }
  }
}

export async function applyFailed(deps: Deps, txId: string, codes: string[]): Promise<void> {
  let userId: string | null = null;
  let clientId: string | null = null;
  await deps.db.transaction(async (tx) => {
    const [t] = await tx.select().from(simplepayTransactions).where(eq(simplepayTransactions.id, txId)).limit(1).for('update');
    if (!t || t.appliedAt) return;
    const now = deps.now();
    await tx
      .update(simplepayTransactions)
      .set({ appliedAt: now, finishedAt: now, errorCodes: codes, status: FINAL_FAIL.has(t.status) ? t.status : 'NOTAUTHORIZED', updatedAt: now })
      .where(eq(simplepayTransactions.id, t.id));
    if (t.kind === 'regisztracio') {
      if (t.cardRegistrationId) {
        await tx.update(cardRegistrations).set({ status: 'torolve', updatedAt: now }).where(and(eq(cardRegistrations.id, t.cardRegistrationId), eq(cardRegistrations.status, 'fuggo')));
        await tx.update(paymentTokens).set({ status: 'visszavont' }).where(and(eq(paymentTokens.cardRegistrationId, t.cardRegistrationId), eq(paymentTokens.status, 'fuggo')));
      }
      await audit(tx, { action: 'subscription.registration_failed', actorRole: 'system', targetType: 'simplepay_transaction', targetId: t.id, clientId: t.clientId, details: { codes } });
      return;
    }
    const [sub] = t.subscriptionId ? await tx.select().from(subscriptions).where(eq(subscriptions.id, t.subscriptionId)).limit(1) : [];
    if (!sub) return;
    await registerFailure(deps, tx, sub, codes[0] ?? 'UNKNOWN');
    const [cl] = await tx.select({ userId: clients.userId }).from(clients).where(eq(clients.id, t.clientId)).limit(1);
    userId = sub.failedAttempts === 0 ? (cl?.userId ?? null) : null;
    clientId = t.clientId;
  });
  if (userId) await notify(deps, deps.db, { userId, kind: 'subscription_payment_failed', link: '/fiok/elofizetes' });
  if (clientId) await computeFlags(deps, deps.db, clientId);
}

const RETRY_DAYS = [1, 3, 7];

/** Unsuccessful charges keep the token; retries at +1/+3/+7 days; ≥ 14 days unpaid → suspended. */
export async function registerFailure(deps: Deps, db: DbOrTx, sub: SubRow, code: string): Promise<void> {
  const now = deps.now();
  const first = sub.firstFailedAt ?? now;
  const attempts = sub.failedAttempts + 1;
  const retryIn = RETRY_DAYS[attempts - 1];
  await db
    .update(subscriptions)
    .set({
      status: sub.status === 'suspended' ? 'suspended' : 'past_due',
      failedAttempts: attempts,
      firstFailedAt: first,
      lastFailureCode: code.slice(0, 60),
      nextRetryAt: retryIn !== undefined ? new Date(first.getTime() + retryIn * 86_400_000) : null,
      graceUntil: addDays(todayBudapest(first), 14),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, sub.id));
  await audit(db, { action: 'subscription.payment_failed', actorRole: 'system', targetType: 'subscription', targetId: sub.id, clientId: sub.clientId, details: { attempts, code: code.slice(0, 60) } });
}

export async function issueFeeInvoice(deps: Deps, db: DbOrTx, t: TxRow, cl: typeof clients.$inferSelect): Promise<void> {
  const today = todayBudapest(deps.now());
  const [n] = await db.select({ n: count() }).from(feeInvoices).where(eq(feeInvoices.provider, 'demo'));
  // A DEMO payment moved no money: it never gets a real invoice (Számlázz.hu / Billingo report to NAV),
  // only the DEMO díjbekérő – whatever INVOICE_MODE is configured to.
  const provider = t.mode === 'demo' ? demoFeeInvoiceProvider(deps.cfg) : deps.invoices;
  try {
    const out = await provider.issue({
      seq: Number(n?.n ?? 0) + 1,
      issuedOn: today,
      amountHuf: t.amountHuf,
      periodStart: t.periodStart,
      periodEnd: t.periodEnd,
      orderRef: t.orderRef,
      simplepayTransactionId: t.simplepayTransactionId,
      client: { name: `${cl.lastName} ${cl.firstName}`, zip: cl.addressZip, city: cl.addressCity, address: cl.addressLine, adoszam: cl.adoszam },
    });
    const file = await deps.storage.put(db, {
      ownerClientId: cl.id,
      kind: 'dijszamla',
      mime: 'application/pdf',
      displayName: `${out.number}.pdf`,
      data: out.pdf,
      retentionUntil: `${Number(today.slice(0, 4)) + 9}-01-01`,
      now: deps.now(),
    });
    await db.insert(feeInvoices).values({
      clientId: cl.id,
      simplepayTransactionId: t.id,
      provider: provider.provider === 'none' ? 'demo' : provider.provider,
      number: out.number,
      issuedOn: today,
      amountHuf: t.amountHuf,
      pdfFileId: file.id,
      externalId: out.externalId,
      status: 'kiallitva',
      demo: out.demo,
    });
  } catch (err) {
    const msg = err instanceof InvoiceNotConfigured ? 'not_configured' : (err as Error).message.slice(0, 200);
    await db.insert(feeInvoices).values({ clientId: cl.id, simplepayTransactionId: t.id, provider: 'demo', amountHuf: t.amountHuf, status: 'hiba', error: msg, demo: false });
    await audit(db, { action: 'fee_invoice.failed', actorRole: 'system', targetType: 'simplepay_transaction', targetId: t.id, clientId: cl.id, details: { reason: msg } });
    log().warn({ reason: msg }, 'fee invoice not issued – admin alert');
  }
}

// ---------------- client actions ----------------

export async function cancelSubscription(deps: Deps, clientId: string, userId: string, by: { role: 'client' | 'admin'; userId: string } = { role: 'client', userId }): Promise<void> {
  const [sub] = await deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (!sub || sub.status === 'canceled' || sub.status === 'incomplete') throw E.conflict(by.role === 'admin' ? 'Ennél az ügyfélnél nincs lemondható előfizetés.' : 'Nincs lemondható előfizetésed.');
  // already cancelled: the admin is told so; a second tap of the client is simply a no-op (no second notification)
  if (sub.cancelAtPeriodEnd) {
    if (by.role === 'admin') throw E.conflict('Ez az előfizetés már le van mondva.');
    return;
  }
  await deps.db.update(subscriptions).set({ cancelAtPeriodEnd: true, updatedAt: deps.now() }).where(eq(subscriptions.id, sub.id));
  await audit(deps.db, { action: 'subscription.cancel_requested', actorUserId: by.userId, actorRole: by.role, targetType: 'subscription', targetId: sub.id, clientId, details: { by: by.role } });
  // The client must not read "Lemondtad" when the owner cancelled it (round 1, 2026-11-19): variant 'admin'.
  await notify(deps, deps.db, {
    userId,
    kind: 'subscription_canceled',
    ...(by.role === 'admin' ? { variant: 'admin' } : {}),
    params: { periodEndText: sub.currentPeriodEnd ? huFullDateIg(sub.currentPeriodEnd) : 'A fizetett időszak végéig' },
    link: '/fiok/elofizetes',
  });
}

export async function resumeSubscription(deps: Deps, clientId: string, userId: string): Promise<void> {
  const [sub] = await deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (!sub || !sub.cancelAtPeriodEnd || sub.status === 'canceled') throw E.conflict('Nincs visszavonható lemondás.');
  const [reg] = sub.cardRegistrationId ? await deps.db.select({ status: cardRegistrations.status }).from(cardRegistrations).where(eq(cardRegistrations.id, sub.cardRegistrationId)).limit(1) : [];
  if (reg?.status !== 'aktiv') throw E.conflict('A kártyádat közben töröltük, ezért add meg újra az „Előfizetés folytatása” gombbal.');
  await deps.db.update(subscriptions).set({ cancelAtPeriodEnd: false, updatedAt: deps.now() }).where(eq(subscriptions.id, sub.id));
  await audit(deps.db, { action: 'subscription.resumed', actorUserId: userId, actorRole: 'client', targetType: 'subscription', targetId: sub.id, clientId });
}

/**
 * After "Visszavonom a törlést": the deletion request had cancelled the subscription at once. If
 * paid days remain, it becomes a normal "cancelled, ends at period end" subscription again, so the
 * client keeps the service until then and sees the end date and a restart button.
 */
export async function restoreAfterCancelledDeletion(deps: Deps, db: DbOrTx, clientId: string): Promise<void> {
  const today = todayBudapest(deps.now());
  await db
    .update(subscriptions)
    .set({ status: 'active', cancelAtPeriodEnd: true, canceledAt: null, nextChargeAt: null, nextRetryAt: null, updatedAt: deps.now() })
    .where(and(eq(subscriptions.clientId, clientId), eq(subscriptions.status, 'canceled'), sql`${subscriptions.currentPeriodEnd} > ${today}`));
}

/** Home banner: the service is ending (cancelled at period end) or has ended. */
export async function serviceNotice(deps: Deps, db: DbOrTx, clientId: string): Promise<{ kind: 'megszunik' | 'megszunt'; endsOn: string | null; canResume: boolean } | undefined> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (!sub || sub.status === 'incomplete') return undefined;
  const today = todayBudapest(deps.now());
  if (sub.status === 'canceled') return { kind: sub.currentPeriodEnd && sub.currentPeriodEnd > today ? 'megszunik' : 'megszunt', endsOn: sub.currentPeriodEnd ?? null, canResume: false };
  if (!sub.cancelAtPeriodEnd) return undefined;
  const [reg] = sub.cardRegistrationId ? await db.select({ status: cardRegistrations.status }).from(cardRegistrations).where(eq(cardRegistrations.id, sub.cardRegistrationId)).limit(1) : [];
  return { kind: 'megszunik', endsOn: sub.currentPeriodEnd ?? null, canResume: reg?.status === 'aktiv' };
}

/** SimplePay rule: card deletion must always be possible, without conditions (SPEC §9.6). */
export async function deleteCard(deps: Deps, clientId: string, actor: { userId: string | null; role: string }): Promise<void> {
  const regs = await deps.db.select().from(cardRegistrations).where(and(eq(cardRegistrations.clientId, clientId), inArray(cardRegistrations.status, ['aktiv', 'fuggo'])));
  for (const reg of regs) {
    if (reg.mode !== 'demo' && reg.status === 'aktiv' && reg.simplepayCardId) {
      if (!deps.simplepay) throw E.notConfigured('A SimplePay-kapcsolat nincs bekapcsolva; a kártyát a SimplePay ügyfélszolgálatán keresztül tudjuk törölni.');
      try {
        await deps.simplepay.cardCancel(reg.simplepayCardId);
      } catch (err) {
        log().warn({ codes: (err as SimplePayError).errorCodes }, 'cardcancel failed');
        throw E.upstream('A kártya törlése most nem sikerült a SimplePaynél. Próbáld újra pár perc múlva.');
      }
    }
    await deps.db.update(cardRegistrations).set({ status: 'torolve', updatedAt: deps.now() }).where(eq(cardRegistrations.id, reg.id));
    await deps.db.update(paymentTokens).set({ status: 'visszavont' }).where(and(eq(paymentTokens.cardRegistrationId, reg.id), inArray(paymentTokens.status, ['aktiv', 'fuggo'])));
  }
  await audit(deps.db, { action: 'subscription.card_deleted', actorUserId: actor.userId, actorRole: actor.role, targetType: 'client', targetId: clientId, clientId, details: { cards: regs.length } });
}

// ---------------- worker ----------------

export async function pickToken(deps: Deps, db: DbOrTx, sub: SubRow): Promise<{ id: string; token: string } | null> {
  if (!sub.cardRegistrationId) return null;
  const [reg] = await db.select().from(cardRegistrations).where(eq(cardRegistrations.id, sub.cardRegistrationId)).limit(1);
  if (!reg || reg.status !== 'aktiv' || (reg.tokensUntil && reg.tokensUntil <= deps.now())) return null;
  const [t] = await db
    .select()
    .from(paymentTokens)
    .where(and(eq(paymentTokens.cardRegistrationId, reg.id), eq(paymentTokens.status, 'aktiv')))
    .orderBy(asc(paymentTokens.seq))
    .limit(1);
  if (!t) return null;
  return { id: t.id, token: deps.data.dec(t.tokenEnc, 'payment_tokens.token') };
}

/** Something is due: an unpaid period (past_due / suspended) or an active subscription whose paid period has ended. */
export function chargeDue(sub: Pick<SubRow, 'status' | 'currentPeriodEnd' | 'cancelAtPeriodEnd'>, today: string): boolean {
  if (sub.cancelAtPeriodEnd) return false;
  if (sub.status === 'past_due' || sub.status === 'suspended') return true;
  return sub.status === 'active' && (!sub.currentPeriodEnd || sub.currentPeriodEnd <= today);
}

/** One charge attempt for a due subscription. */
export async function chargeSubscription(deps: Deps, stale: SubRow): Promise<'charged' | 'pending' | 'failed' | 'skipped'> {
  const db = deps.db;
  const now = deps.now();
  // Always decide on the row as it is NOW (a stale list, a second tab or a second worker may hold an old copy), and
  // never charge a subscription that has nothing due: an active, paid one was charged twice by a manual retry
  // (round 1, 2026-11-19).
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, stale.id)).limit(1);
  if (!sub || !chargeDue(sub, todayBudapest(now))) return 'skipped';
  const [pending] = await db
    .select({ id: simplepayTransactions.id })
    .from(simplepayTransactions)
    .where(and(eq(simplepayTransactions.subscriptionId, sub.id), eq(simplepayTransactions.kind, 'ismetlodo'), isNull(simplepayTransactions.appliedAt), sql`${simplepayTransactions.createdAt} > ${new Date(now.getTime() - 86_400_000)}`))
    .limit(1);
  if (pending) return 'skipped';
  const [cl] = await db.select().from(clients).where(eq(clients.id, sub.clientId)).limit(1);
  const [u] = cl ? await db.select().from(users).where(eq(users.id, cl.userId)).limit(1) : [];
  if (!cl || !u) return 'skipped';
  // A DEMO card (made-up token) must never be "charged" once the server runs with real SimplePay keys (or
  // with SimplePay off): the client has to give a real card. Never fake a successful renewal outside DEMO.
  if (sub.mode === 'demo' && deps.cfg.simplepay.mode !== 'demo') {
    await registerFailure(deps, db, sub, 'DEMO_TOKEN');
    await notify(deps, db, { userId: cl.userId, kind: 'subscription_renewal_needed', link: '/fiok/elofizetes' });
    await computeFlags(deps, db, cl.id);
    return 'failed';
  }
  const tok = await pickToken(deps, db, sub);
  if (!tok) {
    await registerFailure(deps, db, sub, 'NO_TOKEN');
    await notify(deps, db, { userId: cl.userId, kind: 'subscription_renewal_needed', link: '/fiok/elofizetes' });
    await computeFlags(deps, db, cl.id);
    return 'failed';
  }
  const periodStart = sub.currentPeriodEnd ?? todayBudapest(now);
  const periodEnd = addMonths(periodStart, 1);
  const orderRef = orderRefFor(now);
  const m: Mode = sub.mode;
  // SPEC §28.K.6: during szüneteltetés the availability fee instead of the plan fee.
  const { chargeAmountHuf } = await import('./szuneteltetes.js');
  const amount = await chargeAmountHuf(deps, db, sub, periodStart);
  const [t] = await db
    .insert(simplepayTransactions)
    .values({ orderRef, kind: 'ismetlodo', clientId: cl.id, subscriptionId: sub.id, cardRegistrationId: sub.cardRegistrationId, tokenId: tok.id, amountHuf: amount, status: 'INIT', periodStart, periodEnd, mode: m })
    .returning();
  if (m === 'demo') {
    if (u.email.startsWith('fail+')) {
      await db.update(simplepayTransactions).set({ status: 'NOTAUTHORIZED' }).where(eq(simplepayTransactions.id, t!.id));
      await applyFailed(deps, t!.id, ['DEMO_NOTAUTHORIZED']);
      return 'failed';
    }
    const tid = 500_000_000 + Math.floor(Math.random() * 99_999_999);
    await processIpn(deps, { orderRef, merchant: DEMO_MERCHANT, transactionId: tid, status: FINAL_OK, salt: newSalt() });
    return 'charged';
  }
  if (!deps.simplepay || deps.cfg.simplepay.mode !== m) return 'skipped';
  try {
    const res = await deps.simplepay.doRecurring({
      orderRef,
      token: tok.token,
      total: amount,
      customer: `${cl.lastName} ${cl.firstName}`.trim(),
      customerEmail: u.email,
      threeDSReqAuthMethod: await authMethod(db, cl.userId),
      invoice: invoiceOf(cl),
    });
    await db.update(simplepayTransactions).set({ status: 'INPAYMENT', simplepayTransactionId: res.transactionId, updatedAt: deps.now() }).where(eq(simplepayTransactions.id, t!.id));
    return 'pending';
  } catch (err) {
    if (err instanceof SimplePayError && !err.errorCodes.includes('NETWORK')) {
      await applyFailed(deps, t!.id, err.errorCodes);
      return 'failed';
    }
    log().warn({ err: safeErr(err) }, 'dorecurring network error – will query later');
    return 'pending';
  }
}

export async function renewalCheck(deps: Deps, clientId: string): Promise<void> {
  const [sub] = await deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (!sub || sub.status !== 'active' || sub.cancelAtPeriodEnd || !sub.cardRegistrationId) return;
  const now = deps.now();
  if (sub.renewalNotifiedAt && sub.renewalNotifiedAt.getTime() > now.getTime() - 25 * 86_400_000) return;
  const [reg] = await deps.db.select().from(cardRegistrations).where(eq(cardRegistrations.id, sub.cardRegistrationId)).limit(1);
  const [n] = await deps.db.select({ n: count() }).from(paymentTokens).where(and(eq(paymentTokens.cardRegistrationId, sub.cardRegistrationId), eq(paymentTokens.status, 'aktiv')));
  const left = Number(n?.n ?? 0);
  const soon = new Date(now.getTime() + 30 * 86_400_000);
  const needs =
    !reg ||
    reg.status !== 'aktiv' ||
    left === 0 ||
    (reg.tokensUntil !== null && reg.tokensUntil < soon) ||
    (reg.cardExpiry !== null && reg.cardExpiry < todayBudapest(soon));
  if (!needs) return;
  const [cl] = await deps.db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return;
  await deps.db.update(subscriptions).set({ renewalNotifiedAt: now }).where(eq(subscriptions.id, sub.id));
  await notify(deps, deps.db, { userId: cl.userId, kind: 'subscription_renewal_needed', link: '/fiok/elofizetes' });
}

/** Daily 06:00 (SPEC §15). */
export async function runBillingJob(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const now = deps.now();
  const today = todayBudapest(now);
  const out = { charged: 0, pending: 0, failed: 0, canceled: 0, suspended: 0, queried: 0 };

  // 1. cancellations at period end
  const ending = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.cancelAtPeriodEnd, true), inArray(subscriptions.status, ['active', 'past_due', 'suspended']), lte(subscriptions.currentPeriodEnd, today)));
  for (const s of ending) {
    await db.update(subscriptions).set({ status: 'canceled', canceledAt: now, nextChargeAt: null, nextRetryAt: null, updatedAt: now }).where(eq(subscriptions.id, s.id));
    if (s.cardRegistrationId) {
      const toks = await db.select().from(paymentTokens).where(and(eq(paymentTokens.cardRegistrationId, s.cardRegistrationId), eq(paymentTokens.status, 'aktiv')));
      for (const t of toks) {
        if (s.mode !== 'demo' && deps.simplepay) await deps.simplepay.tokenCancel(deps.data.dec(t.tokenEnc, 'payment_tokens.token')).catch(() => undefined);
        await db.update(paymentTokens).set({ status: 'visszavont' }).where(eq(paymentTokens.id, t.id));
      }
    }
    await db.update(clients).set({ lifecycle: 'megszunt', updatedAt: now }).where(eq(clients.id, s.clientId));
    await endRelationship(db, s.clientId, now);
    await audit(db, { action: 'subscription.canceled', actorRole: 'system', targetType: 'subscription', targetId: s.id, clientId: s.clientId });
    out.canceled++;
  }

  // 2. charges and retries
  const due = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.cancelAtPeriodEnd, false),
        or(
          and(eq(subscriptions.status, 'active'), lte(subscriptions.nextChargeAt, now)),
          and(eq(subscriptions.status, 'past_due'), lte(subscriptions.nextRetryAt, now)),
        ),
      ),
    );
  for (const s of due) {
    const r = await chargeSubscription(deps, s);
    if (r === 'charged') out.charged++;
    else if (r === 'pending') out.pending++;
    else if (r === 'failed') out.failed++;
  }

  // 3. suspension after the grace period
  const overdue = await db.select().from(subscriptions).where(and(eq(subscriptions.status, 'past_due'), lte(subscriptions.graceUntil, today)));
  for (const s of overdue) {
    await db.update(subscriptions).set({ status: 'suspended', nextRetryAt: null, updatedAt: now }).where(eq(subscriptions.id, s.id));
    await db.update(clients).set({ lifecycle: 'felfuggesztve', updatedAt: now }).where(and(eq(clients.id, s.clientId), eq(clients.lifecycle, 'aktiv')));
    await audit(db, { action: 'subscription.suspended', actorRole: 'system', targetType: 'subscription', targetId: s.id, clientId: s.clientId });
    await computeFlags(deps, db, s.clientId);
    out.suspended++;
  }

  // 4. missed IPN safety: query transactions without a final status after 1 h
  if (deps.simplepay) {
    const stale = await db
      .select()
      .from(simplepayTransactions)
      .where(and(isNull(simplepayTransactions.appliedAt), inArray(simplepayTransactions.status, ['INIT', 'INPAYMENT', 'AUTHORIZED']), lt(simplepayTransactions.createdAt, new Date(now.getTime() - 3600_000)), sql`${simplepayTransactions.mode} <> 'demo'`))
      .orderBy(desc(simplepayTransactions.createdAt))
      .limit(50);
    if (stale.length) {
      try {
        const res = await deps.simplepay.query(stale.map((s) => s.orderRef));
        for (const r of res) {
          const t = stale.find((s) => s.orderRef === r.orderRef);
          if (!t) continue;
          out.queried++;
          if (r.status === FINAL_OK) await applyFinished(deps, t.id, { transactionId: r.transactionId ?? 0 });
          else if (FINAL_FAIL.has(r.status) || (r.status === 'INIT' && t.createdAt.getTime() < now.getTime() - 2 * 86_400_000)) await applyFailed(deps, t.id, [r.status]);
        }
      } catch (err) {
        log().warn({ err: safeErr(err) }, 'simplepay query failed');
      }
    }
  }

  // 5. renewal reminders
  const active = await db.select({ clientId: subscriptions.clientId }).from(subscriptions).where(eq(subscriptions.status, 'active'));
  for (const s of active) await renewalCheck(deps, s.clientId);
  return out;
}
