// k8 ALAP-B – bank transfer with a monthly díjbekérő (owner 11-20: 8 days to pay; Számlázz.hu Autokassza (Erste) matches
// the money; our own fee-invoice mail; the card only after the callback offer).
//  - choose: Bekötés → Előfizetés ("Átutalással fizetek": the first díjbekérő now) or Fiók → Előfizetés ("Átváltok
//    átutalásra": from the next period; a past-due card month gets its díjbekérő at once).
//  - issue: one transfer_requests row per díjbekérő; order number ADZ-<ügyfélszám>-<ÉÉÉÉ>-<HH> (unique per month), memo by
//    the switch (the order number or the fixed ADZ-<ügyfélszám>); Számlázz.hu (query first, then issue, sendEmail=false)
//    or the DEMO PDF; then our own mail with the PDF + an in-app row.
//  - monthly: on the first day of every new period (jobTransferIssue, 06:30) – an unpaid month blocks the next one.
//  - money: jobTransferReconcile queries the open ones (Számlázz: the díjbekérő's kifizetesek, or the invoice Autokassza
//    made of it); the console marks one paid by hand (step-up, reason, audit). Both → applyTransferPaid: a `payments` row
//    (provider 'atutalas') through the SAME success path as a card payment (applyPaymentSucceeded): subscription active,
//    Bekötés step done, the fee invoice queued (with dijbekeroSzamlaszam, fizmod Átutalás, sendEmail=false).
//  - late: 'kesik' from the day after the due day; reminders on day 1, 4 and 8 (each once); the accounting goes on unless
//    the switch kesesLeallit is ON (then lock reason 'atutalas_kesik' from day 8); the console has a manual suspend.
//  - switch kapcsolok.fizetes.atutalas: DEMO ON, production OFF until the ÁSZF knows the transfer. OFF = 409
//    atutalas_kikapcsolva for a NEW choice; clients already on transfer keep getting their díjbekérők.
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import brand from '../_shared/brand.json' with { type: 'json' };
import {
  FIZETES_KAPCSOLOK_KEY,
  fizetesKapcsolokDefault,
  kozlemenyOf,
  orderNoOf,
  TRANSFER_OPEN_STATUSES,
  TRANSFER_RULES,
  TRANSFER_STATUS_LABELS,
  TRANSFER_TEXTS,
  type AdminTransferRow,
  type AdminTransferSummary,
  type ClientBillingView,
  type FizetesKapcsolok,
  type TransferPaidSource,
  type TransferRequestView,
} from '../_shared/k8.js';
import { INVOICE_LINE_TEXTS } from '../_shared/k29.js';
import type { Config } from '../config.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { clients, payments, subscriptions, systemState, transferRequests, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, addMonths, daysBetween, huDayMonthIg, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { log, safeErr } from '../log.js';
import { fmtHuf } from '../payments/huf.js';
import { buyerOf } from '../payments/invoices.js';
import { buildProformaXml, demoProformaPdf, type ProformaInput } from '../payments/dijbekero.js';
import { buildQueryXml, buildQueryXmlBy, SzamlazzError } from '../payments/szamlazzhu.js';
import { notify, sendTemplateMail } from '../notify/notify.js';
import { clientName, type ClientRow } from './people.js';

type TrRow = typeof transferRequests.$inferSelect;
type SubRow = typeof subscriptions.$inferSelect;
export type TransferMode = TrRow['mode'];

// ---------------------------------------------------------------------------------------------------------------------
// switches, routes, small helpers
// ---------------------------------------------------------------------------------------------------------------------
/** system_state['kapcsolok.fizetes'] over the defaults of this server (unknown keys and wrong types ignored). */
export async function fizetesKapcsolok(deps: Pick<Deps, 'cfg'>, db: DbOrTx): Promise<FizetesKapcsolok> {
  const [row] = await db.select({ value: systemState.value }).from(systemState).where(eq(systemState.key, FIZETES_KAPCSOLOK_KEY)).limit(1);
  const v = (row?.value ?? {}) as Record<string, unknown>;
  const out = fizetesKapcsolokDefault(deps.cfg.appEnv);
  if (typeof v.atutalas === 'boolean') out.atutalas = v.atutalas;
  if (typeof v.kesesLeallit === 'boolean') out.kesesLeallit = v.kesesLeallit;
  if (v.kozlemeny === 'havi' || v.kozlemeny === 'allando') out.kozlemeny = v.kozlemeny;
  return out;
}

/** Console: merges the change into system_state (value || patch), audited with before / after. */
export async function setFizetesKapcsolok(deps: Deps, patch: Partial<FizetesKapcsolok>, by: { userId: string; reason: string }): Promise<FizetesKapcsolok> {
  const before = await fizetesKapcsolok(deps, deps.db);
  const clean: Partial<FizetesKapcsolok> = {};
  if (typeof patch.atutalas === 'boolean') clean.atutalas = patch.atutalas;
  if (typeof patch.kesesLeallit === 'boolean') clean.kesesLeallit = patch.kesesLeallit;
  if (patch.kozlemeny === 'havi' || patch.kozlemeny === 'allando') clean.kozlemeny = patch.kozlemeny;
  await deps.db
    .insert(systemState)
    .values({ key: FIZETES_KAPCSOLOK_KEY, value: clean, updatedAt: deps.now() })
    .onConflictDoUpdate({ target: systemState.key, set: { value: sql`${systemState.value} || ${JSON.stringify(clean)}::jsonb`, updatedAt: deps.now() } });
  const after = await fizetesKapcsolok(deps, deps.db);
  await audit(deps.db, { action: 'admin.switch.fizetes', actorUserId: by.userId, actorRole: 'admin', targetType: 'system_state', targetId: null, details: { before, after, reason: by.reason } });
  return after;
}

/** Which Számlázz.hu account (or the DEMO PDF) a díjbekérő goes to on this server; null = transfer not possible here. */
export function transferRoute(cfg: Config): TransferMode | null {
  const inv = cfg.invoice;
  if (inv.mode === 'szamlazzhu' && inv.szamlazzhuAccount === 'eles') return 'eles';
  if (inv.mode === 'szamlazzhu' && inv.szamlazzhuAccount === 'teszt') return 'teszt';
  // the DEMO PDF never goes to a real client on the production server
  if (inv.mode === 'demo' && cfg.appEnv === 'demo') return 'demo';
  return null;
}
const paymentModeOf = (m: TransferMode): 'demo' | 'test' | 'live' => (m === 'demo' ? 'demo' : m === 'teszt' ? 'test' : 'live');

/** "2026. 11. 28." (the mail format of the samples). */
export function dotSpace(d: string): string {
  return `${d.slice(0, 4)}. ${d.slice(5, 7)}. ${d.slice(8, 10)}.`;
}
/** "2026. 11. 20. – 12. 19." (inclusive end of a [start, end) period; the year once when it does not change). */
export function periodSpace(start: string, endExclusive: string): string {
  const last = addDays(endExclusive, -1);
  const tail = last.slice(0, 4) === start.slice(0, 4) ? `${last.slice(5, 7)}. ${last.slice(8, 10)}.` : dotSpace(last);
  return `${dotSpace(start)} – ${tail}`;
}

async function customerNoOf(db: DbOrTx, clientId: string): Promise<number> {
  const [r] = await db.select({ no: clients.customerNo }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (r?.no) return r.no;
  // a row from before 0028 got its number there; this only guards a missing default
  const res = await db.execute(sql`update clients set customer_no = nextval('clients_customer_no_seq') where id = ${clientId} and customer_no is null returning customer_no`);
  const n = (res as unknown as { rows: { customer_no: number }[] }).rows[0]?.customer_no;
  if (!n) throw new ApiError(500, 'no_customer_no', 'Nincs ügyfélszám.');
  return n;
}

function payToOf(r: TrRow): TransferRequestView['payTo'] {
  return { beneficiary: brand.provider.legalName, accountNo: brand.provider.bankAccount, iban: brand.provider.iban, swift: brand.provider.swift, kozlemeny: r.kozlemeny, amountHuf: r.amountHuf, dueOn: r.dueOn };
}

export function transferView(r: TrRow): TransferRequestView {
  const open = (TRANSFER_OPEN_STATUSES as readonly string[]).includes(r.status);
  return {
    id: r.id,
    kind: r.kind,
    period: r.periodStart && r.periodEnd ? { start: r.periodStart, end: r.periodEnd } : null,
    amountHuf: r.amountHuf,
    orderNo: r.orderNo,
    kozlemeny: r.kozlemeny,
    proformaNumber: r.proformaNumber,
    issuedOn: r.issuedOn,
    dueOn: r.dueOn,
    status: r.status,
    statusLabel: TRANSFER_STATUS_LABELS[r.status],
    paidOn: r.paidOn,
    pdfFileId: r.proformaPdfFileId,
    demo: r.mode === 'demo',
    payTo: open ? payToOf(r) : null,
  };
}

async function openOf(db: DbOrTx, clientId: string, kinds: TrRow['kind'][] = ['elso_havi', 'havi', 'egyszeri']): Promise<TrRow[]> {
  return db
    .select()
    .from(transferRequests)
    .where(and(eq(transferRequests.clientId, clientId), inArray(transferRequests.status, ['kiallitva', 'kesik', 'hiba']), inArray(transferRequests.kind, kinds)))
    .orderBy(desc(transferRequests.createdAt));
}

/** A transfer client with an unpaid monthly díjbekérő cannot move to the card now (the card would pay the same month). */
export async function hasOpenMonthlyTransfer(db: DbOrTx, clientId: string): Promise<boolean> {
  return (await openOf(db, clientId, ['havi'])).length > 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// client view + choice
// ---------------------------------------------------------------------------------------------------------------------
export async function clientBillingView(deps: Deps, cl: ClientRow): Promise<ClientBillingView> {
  const db = deps.db;
  const k = await fizetesKapcsolok(deps, db);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
  const method = sub?.billingMethod ?? 'kartya';
  const rows = await db.select().from(transferRequests).where(eq(transferRequests.clientId, cl.id)).orderBy(desc(transferRequests.createdAt)).limit(40);
  const open = rows.filter((r) => (TRANSFER_OPEN_STATUSES as readonly string[]).includes(r.status));
  const recent = rows.filter((r) => r.status === 'fizetve' || r.status === 'visszavonva').slice(0, 12);
  const today = todayBudapest(deps.now());
  const { effectiveMonthlyAmount } = await import('./payments.js');
  const nextStart = sub?.currentPeriodEnd && sub.currentPeriodEnd > today ? sub.currentPeriodEnd : today;
  const monthlyHuf = (await effectiveMonthlyAmount(deps, db, cl.id, nextStart)).amountHuf;
  const running = Boolean(sub && (sub.status === 'active' || sub.status === 'past_due' || sub.status === 'suspended'));
  const nextIssueOn = method === 'atutalas' && sub?.status === 'active' && !sub.cancelAtPeriodEnd && sub.currentPeriodEnd && sub.currentPeriodEnd > today && !open.some((r) => r.kind === 'havi') ? sub.currentPeriodEnd : null;
  return {
    method,
    transferAvailable: (k.atutalas && transferRoute(deps.cfg) !== null) || method === 'atutalas',
    monthlyHuf,
    open: open.map(transferView),
    recent: recent.map(transferView),
    nextIssueOn,
    canSwitchToCard: method === 'atutalas' && !open.some((r) => r.kind === 'havi'),
    canSwitchToTransfer: k.atutalas && transferRoute(deps.cfg) !== null && method === 'kartya' && running && !cl.terminated,
    kozlemenyMode: k.kozlemeny,
  };
}

function offError(): ApiError {
  return new ApiError(409, 'atutalas_kikapcsolva', TRANSFER_TEXTS.off);
}

/**
 * POST /client/billing/transfer. 'subscribe' (Bekötés, or "Inkább átutalom" after a failed first card payment): the first
 * díjbekérő now. 'switch' (Fiók → Előfizetés): from the next period; a past-due / suspended card month gets its
 * díjbekérő at once. The route checks e-mail, step lock, employer gate and rate limit like the card start.
 */
export async function chooseTransfer(deps: Deps, cl: ClientRow, purpose: 'subscribe' | 'switch', by: { userId: string }): Promise<ClientBillingView> {
  const db = deps.db;
  const k = await fizetesKapcsolok(deps, db);
  const mode = transferRoute(deps.cfg);
  if (!k.atutalas) throw offError();
  if (!mode) throw E.notConfigured('Az átutalásos fizetés ezen a szerveren nincs bekapcsolva.');
  if (cl.terminated) throw E.conflict('A szerződésed felmondtuk, ezért itt nem kell fizetned. Ha kérdésed van, írj nekünk az Üzenetek fülön.');
  const [u] = await db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  if (!u?.emailVerifiedAt) throw E.conflict('Előbb erősítsd meg az e-mail-címedet.');
  if (!cl.addressZip || !cl.addressCity || !cl.addressLine) throw E.conflict('Előbb add meg a címedet az Adataid lépésben (a díjbekérőhöz kell).');
  const today = todayBudapest(deps.now());
  let [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
  const paidRunning = Boolean(sub && (sub.status === 'active' || sub.status === 'canceled') && sub.currentPeriodEnd && sub.currentPeriodEnd > today);
  if (purpose === 'subscribe' && paidRunning) purpose = 'switch';
  if (purpose === 'switch' && !sub) purpose = 'subscribe';
  if (!sub) {
    const { ensurePlan } = await import('./subscription.js');
    await ensurePlan(deps, db);
    const [s] = await db
      .insert(subscriptions)
      .values({ clientId: cl.id, planCode: 'havi', status: 'incomplete', mode: mode === 'eles' ? 'live' : mode === 'teszt' ? 'sandbox' : 'demo', provider: deps.cfg.payment.provider === 'stripe' ? 'stripe' : 'demo', billingMethod: 'atutalas' })
      .returning();
    sub = s!;
  }
  if (sub.billingMethod !== 'atutalas') {
    // the card is not charged any more (billing skips nextChargeAt null); a past-due card month moves to the díjbekérő
    const due = sub.status === 'past_due' || sub.status === 'suspended';
    await db
      .update(subscriptions)
      .set({ billingMethod: 'atutalas', nextChargeAt: null, nextRetryAt: null, ...(sub.status === 'past_due' ? { status: 'active', graceUntil: null, failedAttempts: 0, firstFailedAt: null } : {}), updatedAt: deps.now() })
      .where(eq(subscriptions.id, sub.id));
    await audit(db, { action: 'subscription.billing_method', actorUserId: by.userId, actorRole: 'client', targetType: 'subscription', targetId: sub.id, clientId: cl.id, details: { from: 'kartya', to: 'atutalas', purpose, due } });
    [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
  }
  if (purpose === 'subscribe') {
    const open = await openOf(db, cl.id, ['elso_havi']);
    if (!open.length) await issueFirst(deps, cl, sub!);
  } else if (sub!.status === 'suspended' || (sub!.status === 'active' && sub!.currentPeriodEnd && sub!.currentPeriodEnd <= today)) {
    await issueMonthly(deps, cl, sub!);
  }
  return clientBillingView(deps, cl);
}

// ---------------------------------------------------------------------------------------------------------------------
// issuing
// ---------------------------------------------------------------------------------------------------------------------
async function issueFirst(deps: Deps, cl: ClientRow, sub: SubRow): Promise<TrRow | null> {
  const { effectiveMonthlyAmount } = await import('./payments.js');
  const today = todayBudapest(deps.now());
  const { amountHuf } = await effectiveMonthlyAmount(deps, deps.db, cl.id, today);
  if (amountHuf <= 0) {
    // a free first month (console): nothing to transfer – the month starts now, like a free card month
    await applyFreeMonth(deps, cl, sub, 'elso_havi', today);
    return null;
  }
  return createAndIssue(deps, cl, sub, { kind: 'elso_havi', periodStart: null, periodEnd: null, amountHuf });
}

/** The díjbekérő of the subscription's next unpaid month (periodStart = currentPeriodEnd), once per month. */
export async function issueMonthly(deps: Deps, cl: ClientRow, sub: SubRow): Promise<TrRow | null> {
  const today = todayBudapest(deps.now());
  const periodStart = sub.currentPeriodEnd ?? today;
  const periodEnd = addMonths(periodStart, 1);
  const [exists] = await deps.db
    .select({ id: transferRequests.id })
    .from(transferRequests)
    .where(and(eq(transferRequests.subscriptionId, sub.id), eq(transferRequests.periodStart, periodStart), eq(transferRequests.kind, 'havi'), ne(transferRequests.status, 'visszavonva')))
    .limit(1);
  if (exists) return null;
  const { effectiveMonthlyAmount } = await import('./payments.js');
  const { amountHuf } = await effectiveMonthlyAmount(deps, deps.db, cl.id, periodStart);
  if (amountHuf <= 0) {
    await applyFreeMonth(deps, cl, sub, 'havi', periodStart);
    return null;
  }
  return createAndIssue(deps, cl, sub, { kind: 'havi', periodStart, periodEnd, amountHuf });
}

async function applyFreeMonth(deps: Deps, cl: ClientRow, sub: SubRow, kind: 'elso_havi' | 'havi', periodStart: string): Promise<void> {
  const mode = transferRoute(deps.cfg) ?? 'demo';
  const [row] = await deps.db
    .insert(payments)
    .values({ clientId: cl.id, subscriptionId: sub.id, kind, provider: 'atutalas', mode: paymentModeOf(mode), amountHuf: 0, periodStart, periodEnd: addMonths(periodStart, 1), status: 'letrehozva', initiated: 'utemezo', idempotencyKey: `atutalas-ingyenes:${sub.id}:${periodStart}`, createdAt: deps.now(), updatedAt: deps.now() })
    .onConflictDoNothing()
    .returning({ id: payments.id });
  if (!row) return;
  const { applyPaymentSucceeded } = await import('./payments.js');
  await applyPaymentSucceeded(deps, row.id, { providerRef: null, chargeRef: null, card: null });
  await audit(deps.db, { action: 'subscription.free_month', actorRole: 'system', targetType: 'subscription', targetId: sub.id, clientId: cl.id, details: { periodStart, billing: 'atutalas' } });
}

async function createAndIssue(deps: Deps, cl: ClientRow, sub: SubRow, i: { kind: TrRow['kind']; periodStart: string | null; periodEnd: string | null; amountHuf: number }): Promise<TrRow | null> {
  const db = deps.db;
  const mode = transferRoute(deps.cfg);
  if (!mode) throw E.notConfigured('Az átutalásos fizetés ezen a szerveren nincs bekapcsolva.');
  const k = await fizetesKapcsolok(deps, db);
  const no = await customerNoOf(db, cl.id);
  const today = todayBudapest(deps.now());
  const base = i.periodStart ?? today;
  let row: TrRow | undefined;
  // a withdrawn díjbekérő of the same month keeps its order number: the next one gets -2, -3 … (never repeated)
  for (let n = 1; n <= 9 && !row; n++) {
    const orderNo = orderNoOf(no, base, n);
    const [taken] = await db.select({ id: transferRequests.id }).from(transferRequests).where(eq(transferRequests.orderNo, orderNo)).limit(1);
    if (taken) continue;
    try {
      [row] = await db
        .insert(transferRequests)
        .values({
          clientId: cl.id,
          subscriptionId: sub.id,
          kind: i.kind,
          periodStart: i.periodStart,
          periodEnd: i.periodEnd,
          amountHuf: i.amountHuf,
          orderNo,
          kozlemeny: kozlemenyOf(no, orderNo, k.kozlemeny),
          issuedOn: today,
          dueOn: addDays(today, TRANSFER_RULES.dueDays),
          // 'hiba' until the document exists (the retry job picks it up; the client sees nothing half-made)
          status: 'hiba',
          mode,
          lastErrorCode: 'pending',
          createdAt: deps.now(),
          updatedAt: deps.now(),
        })
        .returning();
    } catch (e) {
      // the partial unique indexes: another request already made this month's / the first díjbekérő
      if (isUnique(e)) return null;
      throw e;
    }
  }
  if (!row) throw E.conflict('Ehhez a hónaphoz már nem tudunk új díjbekérőt kiállítani. Írj nekünk.');
  await audit(db, { action: 'transfer.created', actorRole: 'system', targetType: 'transfer_request', targetId: row.id, clientId: cl.id, details: { kind: row.kind, orderNo: row.orderNo, amountHuf: row.amountHuf, mode } });
  await processTransferIssue(deps, row.id);
  const [fresh] = await db.select().from(transferRequests).where(eq(transferRequests.id, row.id)).limit(1);
  return fresh ?? row;
}

function isUnique(e: unknown): boolean {
  let x: unknown = e;
  for (let i = 0; i < 4 && x && typeof x === 'object'; i++) {
    if ((x as { code?: unknown }).code === '23505') return true;
    x = (x as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * One try to make the document of a 'hiba' row (query first: a timeout may have created it), then the client mail.
 * Never throws; after the 5th failed try the admins are told once.
 */
export async function processTransferIssue(deps: Deps, id: string): Promise<'kiallitva' | 'hiba' | 'skip'> {
  const db = deps.db;
  const [claimed] = await db
    .update(transferRequests)
    .set({ attempts: sql`${transferRequests.attempts} + 1`, updatedAt: deps.now() })
    .where(and(eq(transferRequests.id, id), eq(transferRequests.status, 'hiba'), isNull(transferRequests.proformaNumber)))
    .returning();
  if (!claimed) return 'skip';
  const r = claimed;
  const [cl] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
  const [u] = cl ? await db.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1) : [];
  if (!cl || !u) return 'skip';
  const buyer = buyerOf(cl, u.email);
  const support = String((brand.provider as { supportEmail?: string }).supportEmail ?? '');
  const input: ProformaInput = {
    orderNo: r.orderNo,
    kozlemeny: r.kozlemeny,
    issueDate: r.issuedOn,
    dueDate: r.dueOn,
    buyer,
    line: { megnevezes: lineText(r), unit: r.kind === 'egyszeri' ? 'alkalom' : 'hó', grossHuf: r.amountHuf },
    replyTo: /@/.test(support) ? support : null,
  };
  try {
    let number: string;
    let pdf: Buffer;
    if (r.mode === 'demo') {
      const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(transferRequests).where(and(eq(transferRequests.mode, 'demo'), sql`${transferRequests.proformaNumber} is not null`));
      number = `DEMO-D-${r.issuedOn.slice(0, 4)}-${String(Number(n?.n ?? 0) + 1).padStart(6, '0')}`;
      pdf = await demoProformaPdf(deps.cfg, { ...input, number });
    } else {
      if (!deps.szamlazz || deps.cfg.invoice.mode !== 'szamlazzhu' || deps.cfg.invoice.szamlazzhuAccount !== r.mode) throw new SzamlazzError('mode_mismatch', 'mode_mismatch', false);
      const key = deps.cfg.invoice.szamlazzhuKey;
      const found = await deps.szamlazz.query(buildQueryXml(key, r.orderNo));
      const res = found ?? (await deps.szamlazz.issue(buildProformaXml(key, input)));
      number = res.number;
      pdf = res.pdf;
    }
    const file = pdf.length
      ? await deps.storage.put(db, { ownerClientId: r.clientId, kind: 'dijszamla', mime: 'application/pdf', displayName: `dijbekero-${number}.pdf`, data: pdf, retentionUntil: `${Number(r.issuedOn.slice(0, 4)) + 9}-01-01`, now: deps.now() })
      : null;
    await db.update(transferRequests).set({ status: 'kiallitva', proformaNumber: number, proformaPdfFileId: file?.id ?? null, error: null, lastErrorCode: null, updatedAt: deps.now() }).where(eq(transferRequests.id, r.id));
    await audit(db, { action: 'transfer.issued', actorRole: 'system', targetType: 'transfer_request', targetId: r.id, clientId: r.clientId, details: { number, mode: r.mode } });
    const [fresh] = await db.select().from(transferRequests).where(eq(transferRequests.id, r.id)).limit(1);
    await tellClient(deps, cl, u.email, fresh!, pdf);
    return 'kiallitva';
  } catch (err) {
    const code = err instanceof SzamlazzError ? err.code : 'error';
    await db.update(transferRequests).set({ error: (err instanceof Error ? err.message : 'hiba').slice(0, 200), lastErrorCode: String(code).slice(0, 40), updatedAt: deps.now() }).where(eq(transferRequests.id, r.id));
    log().warn({ transfer: r.id, code, attempts: r.attempts, err: safeErr(err) }, 'díjbekérő not issued');
    if (r.attempts === 5) {
      const { alertAdmins } = await import('../payments/invoices.js');
      await alertAdmins(deps, 'invoice_failed', r.clientId, { osszeg: fmtHuf(r.amountHuf), hiba: `díjbekérő: ${code}` }, '/admin/konzol').catch(() => undefined);
    }
    return 'hiba';
  }
}

function lineText(r: Pick<TrRow, 'kind' | 'periodStart' | 'periodEnd'>): string {
  if (r.kind === 'havi' && r.periodStart && r.periodEnd) {
    const dot = (d: string) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}.`;
    return INVOICE_LINE_TEXTS.havidij.replace('{tol}', dot(r.periodStart)).replace('{ig}', dot(addDays(r.periodEnd, -1)));
  }
  return `Könyvelési szolgáltatás – ${TRANSFER_TEXTS.firstMonthLine}`;
}

/** The díjbekérő mail (PDF attached) + the in-app row. A mail problem never undoes the díjbekérő (resend in the console). */
async function tellClient(deps: Deps, cl: ClientRow, email: string, r: TrRow, pdf: Buffer): Promise<void> {
  const link = `${deps.cfg.appPublicUrl}/fiok/elofizetes`;
  await sendTemplateMail(deps, {
    to: email,
    key: 'transfer_request',
    lablec: 'ugyfel',
    gomb: { szoveg: await deps.content.render('email.transfer_request.gomb', {}), link },
    attachments: pdf.length ? [{ filename: `dijbekero-${r.proformaNumber ?? r.orderNo}.pdf`, content: pdf, contentType: 'application/pdf' }] : [],
    params: {
      keresztnev: cl.firstName,
      osszeg: fmtHuf(r.amountHuf),
      hatarido: dotSpace(r.dueOn),
      kedvezmenyezett: `${brand.provider.legalName} (az Adózz.hu üzemeltetője)`,
      szamlaszam: brand.provider.bankAccount,
      kozlemeny: r.kozlemeny,
      idoszakSzoveg: r.periodStart && r.periodEnd ? ` (${periodSpace(r.periodStart, r.periodEnd)})` : '',
      elsoSor: r.kind === 'elso_havi' ? await deps.content.render('k8.email.elso_sor', {}) : '',
      link,
    },
  });
  await notify(deps, deps.db, { userId: cl.userId, kind: 'transfer_request', params: { osszeg: fmtHuf(r.amountHuf), hataridoIg: huDayMonthIg(r.dueOn) }, link: '/fiok/elofizetes', noEmail: true, data: { transferId: r.id } }).catch((e: unknown) => log().warn({ err: safeErr(e) }, 'transfer notify failed'));
}

/** Console "Újraküldöm": the same mail with the stored PDF. */
export async function resendTransfer(deps: Deps, id: string, byUserId: string): Promise<void> {
  const [r] = await deps.db.select().from(transferRequests).where(eq(transferRequests.id, id)).limit(1);
  if (!r || !(TRANSFER_OPEN_STATUSES as readonly string[]).includes(r.status)) throw E.conflict('Ezt a díjbekérőt már nem lehet újraküldeni.');
  const [cl] = await deps.db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
  const [u] = cl ? await deps.db.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1) : [];
  if (!cl || !u) throw E.notFound();
  let pdf = Buffer.alloc(0);
  if (r.proformaPdfFileId) {
    const { files } = await import('../db/schema.js');
    const [f] = await deps.db.select().from(files).where(eq(files.id, r.proformaPdfFileId)).limit(1);
    if (f) pdf = Buffer.from(await deps.storage.read(f));
  }
  await tellClient(deps, cl, u.email, r, pdf);
  await audit(deps.db, { action: 'transfer.resent', actorUserId: byUserId, actorRole: 'admin', targetType: 'transfer_request', targetId: r.id, clientId: r.clientId });
}

// ---------------------------------------------------------------------------------------------------------------------
// money in
// ---------------------------------------------------------------------------------------------------------------------
export interface TransferPaidInput {
  paidOn: string;
  amountHuf: number;
  source: TransferPaidSource;
  byUserId?: string | null;
  reason?: string | null;
  /** Autokassza turned the díjbekérő into an invoice itself: our final invoice adopts this number. */
  adoptedInvoiceNumber?: string | null;
}

/**
 * The money of a díjbekérő arrived (idempotent). A `payments` row (provider 'atutalas') goes through the same success
 * path as a card payment. The first month starts on the day the money arrived (no free day); a monthly one keeps its
 * period. Money for a withdrawn díjbekérő is not applied (the admins are told; refund by hand).
 */
export async function applyTransferPaid(deps: Deps, id: string, i: TransferPaidInput): Promise<'applied' | 'already' | 'withdrawn' | 'amount' | 'missing'> {
  const db = deps.db;
  let paymentId = null as string | null;
  let result = 'missing' as 'applied' | 'already' | 'withdrawn' | 'amount' | 'missing';
  let withdrawnClient = null as string | null;
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(transferRequests).where(eq(transferRequests.id, id)).limit(1).for('update');
    if (!r) return;
    if (r.status === 'fizetve') {
      result = 'already';
      return;
    }
    if (r.status === 'visszavonva') {
      await tx.update(transferRequests).set({ paidOn: i.paidOn, paidAmountHuf: i.amountHuf, paidSource: i.source, note: 'Visszavont díjbekérőre érkezett pénz – kézi visszautalás kell.', updatedAt: deps.now() }).where(eq(transferRequests.id, r.id));
      withdrawnClient = r.clientId;
      result = 'withdrawn';
      return;
    }
    if (i.amountHuf < r.amountHuf) {
      // a partial transfer is recorded, never applied (the console sees it; the reminders go on)
      await tx.update(transferRequests).set({ paidAmountHuf: i.amountHuf, note: `Részösszeg érkezett: ${fmtHuf(i.amountHuf)} Ft (${i.paidOn}).`, updatedAt: deps.now() }).where(eq(transferRequests.id, r.id));
      result = 'amount';
      return;
    }
    const periodStart = r.kind === 'elso_havi' ? i.paidOn : r.periodStart;
    const periodEnd = r.kind === 'elso_havi' ? addMonths(i.paidOn, 1) : r.periodEnd;
    const [p] = await tx
      .insert(payments)
      .values({
        clientId: r.clientId,
        subscriptionId: r.subscriptionId,
        kind: r.kind,
        provider: 'atutalas',
        mode: paymentModeOf(r.mode),
        amountHuf: r.amountHuf,
        periodStart,
        periodEnd,
        status: 'letrehozva',
        initiated: i.source === 'kezi' ? 'admin' : 'utemezo',
        idempotencyKey: `atutalas:${r.id}`,
        createdAt: deps.now(),
        updatedAt: deps.now(),
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });
    const pid = p?.id ?? (await tx.select({ id: payments.id }).from(payments).where(eq(payments.idempotencyKey, `atutalas:${r.id}`)).limit(1))[0]?.id;
    if (!pid) return;
    await tx
      .update(transferRequests)
      .set({ status: 'fizetve', paidOn: i.paidOn, paidAmountHuf: i.amountHuf, paidSource: i.source, paymentId: pid, note: i.reason ?? r.note, adoptedInvoiceNumber: i.adoptedInvoiceNumber ?? null, updatedAt: deps.now() })
      .where(eq(transferRequests.id, r.id));
    await audit(tx, {
      action: 'transfer.paid',
      actorUserId: i.byUserId ?? null,
      actorRole: i.byUserId ? 'admin' : 'system',
      targetType: 'transfer_request',
      targetId: r.id,
      clientId: r.clientId,
      details: { source: i.source, paidOn: i.paidOn, amountHuf: i.amountHuf, orderNo: r.orderNo, reason: i.reason ?? null, adopted: i.adoptedInvoiceNumber ?? null },
    });
    paymentId = pid;
    result = 'applied';
  });
  if (result === 'withdrawn' && withdrawnClient) {
    const { alertAdmins } = await import('../payments/invoices.js');
    await alertAdmins(deps, 'payment_disputed', withdrawnClient, { osszeg: fmtHuf(i.amountHuf) }, '/admin/konzol').catch(() => undefined);
  }
  if (result !== 'applied' || !paymentId) return result;
  const { applyPaymentSucceeded } = await import('./payments.js');
  await applyPaymentSucceeded(deps, paymentId, { providerRef: null, chargeRef: null, card: null, amountHuf: null, currency: 'huf' });
  return 'applied';
}

/** Console "Beérkezett, rögzítem" (step-up by the route): the amount must be the díjbekérő's. */
export async function markTransferPaid(deps: Deps, id: string, b: { paidOn: string; amountHuf: number; reason: string }, byUserId: string): Promise<TransferRequestView> {
  const [r] = await deps.db.select().from(transferRequests).where(eq(transferRequests.id, id)).limit(1);
  if (!r) throw E.notFound();
  if (!(TRANSFER_OPEN_STATUSES as readonly string[]).includes(r.status)) throw E.conflict('Ez a díjbekérő nem vár fizetésre.');
  if (!b.reason.trim()) throw E.validation({ reason: 'Írd be, miért rögzíted kézzel.' }, 'Írd be, miért rögzíted kézzel.');
  if (b.amountHuf !== r.amountHuf) throw new ApiError(409, 'osszeg_elteres', `Az összeg nem egyezik a díjbekérővel (${fmtHuf(r.amountHuf)} Ft). Részösszeget nem rögzítünk: nézd meg a bankszámlát.`);
  const today = todayBudapest(deps.now());
  if (b.paidOn > today || b.paidOn < addDays(r.issuedOn, -1)) throw E.conflict('A beérkezés napja a díjbekérő kelte és a mai nap között lehet.');
  const res = await applyTransferPaid(deps, id, { paidOn: b.paidOn, amountHuf: b.amountHuf, source: 'kezi', byUserId, reason: b.reason.trim().slice(0, 500) });
  if (res !== 'applied' && res !== 'already') throw E.conflict('Nem sikerült rögzíteni. Frissítsd az oldalt.');
  const [fresh] = await deps.db.select().from(transferRequests).where(eq(transferRequests.id, id)).limit(1);
  return transferView(fresh!);
}

/** Withdraw a díjbekérő (card paid the month instead, or the console). Never touches a paid one. */
export async function withdrawOpenFirst(db: DbOrTx, clientId: string, now: Date, note: string): Promise<number> {
  const rows = await db
    .update(transferRequests)
    .set({ status: 'visszavonva', note, updatedAt: now })
    .where(and(eq(transferRequests.clientId, clientId), eq(transferRequests.kind, 'elso_havi'), inArray(transferRequests.status, ['kiallitva', 'kesik', 'hiba'])))
    .returning({ id: transferRequests.id });
  return rows.length;
}

// ---------------------------------------------------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------------------------------------------------
/** Daily 06:30: the díjbekérő of every transfer subscription whose new period starts today (or earlier, unpaid), + retries. */
export async function jobTransferIssue(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const out = { kiallitva: 0, ujraproba: 0, kihagyva: 0 };
  if (!transferRoute(deps.cfg)) return out;
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.billingMethod, 'atutalas'), inArray(subscriptions.status, ['active', 'suspended']), eq(subscriptions.cancelAtPeriodEnd, false), lte(subscriptions.currentPeriodEnd, today)));
  for (const s of subs) {
    const [cl] = await db.select().from(clients).where(eq(clients.id, s.clientId)).limit(1);
    if (!cl || cl.terminated || cl.anonymizedAt) {
      out.kihagyva++;
      continue;
    }
    try {
      if (await issueMonthly(deps, cl, s)) out.kiallitva++;
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'monthly díjbekérő failed');
    }
  }
  // the ones whose document is not made yet (back-off: every run, at most 5 tries)
  const pending = await db.select({ id: transferRequests.id }).from(transferRequests).where(and(eq(transferRequests.status, 'hiba'), isNull(transferRequests.proformaNumber), lte(transferRequests.attempts, 5))).limit(20);
  for (const p of pending) if ((await processTransferIssue(deps, p.id)) === 'kiallitva') out.ujraproba++;
  return out;
}

/**
 * Every 2 hours on working days (07–19): the open díjbekérők. Számlázz.hu: the díjbekérő's payments (kifizetesek) or the
 * invoice Autokassza made of it (alap/tipus ≠ D, hivdijbekszam = ours). DEMO: a client e-mail "utal+…" is paid at the
 * next run (like the card's "fail+…"); every other DEMO díjbekérő waits for the console's manual mark.
 */
export async function jobTransferReconcile(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const out = { fizetett: 0, nyitott: 0, hiba: 0 };
  const rows = await db.select().from(transferRequests).where(inArray(transferRequests.status, ['kiallitva', 'kesik'])).orderBy(asc(transferRequests.lastCheckedAt)).limit(60);
  const today = todayBudapest(deps.now());
  for (const r of rows) {
    try {
      if (r.mode === 'demo') {
        const [u] = await db.select({ email: users.email }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(clients.id, r.clientId)).limit(1);
        await db.update(transferRequests).set({ lastCheckedAt: deps.now() }).where(eq(transferRequests.id, r.id));
        if (u?.email.startsWith('utal+')) {
          if ((await applyTransferPaid(deps, r.id, { paidOn: today, amountHuf: r.amountHuf, source: 'demo' })) === 'applied') out.fizetett++;
        } else out.nyitott++;
        continue;
      }
      if (!deps.szamlazz?.queryDetails || deps.cfg.invoice.szamlazzhuAccount !== r.mode) {
        out.nyitott++;
        continue;
      }
      const d = await deps.szamlazz.queryDetails(buildQueryXmlBy(deps.cfg.invoice.szamlazzhuKey, { szamlaKulsoAzon: r.orderNo }, false));
      await db.update(transferRequests).set({ lastCheckedAt: deps.now() }).where(eq(transferRequests.id, r.id));
      if (!d) {
        out.nyitott++;
        continue;
      }
      const lastDay = d.payments.map((p) => p.datum).filter((x): x is string => Boolean(x && /^\d{4}-\d{2}-\d{2}/.test(x))).sort().pop()?.slice(0, 10) ?? today;
      // the key now names an invoice (Autokassza made it of the paid díjbekérő): paid, and our final invoice adopts it
      const converted = Boolean(d.tipus) && d.tipus !== 'D' && (!d.refProforma || !r.proformaNumber || d.refProforma === r.proformaNumber);
      if (converted) {
        if ((await applyTransferPaid(deps, r.id, { paidOn: lastDay, amountHuf: Math.max(d.paidHuf, d.grossHuf ?? 0, r.amountHuf), source: 'autokassza', adoptedInvoiceNumber: d.number })) === 'applied') out.fizetett++;
        continue;
      }
      if (d.paidHuf > 0) {
        const res = await applyTransferPaid(deps, r.id, { paidOn: lastDay, amountHuf: d.paidHuf, source: 'autokassza' });
        if (res === 'applied') out.fizetett++;
        else out.nyitott++;
        continue;
      }
      out.nyitott++;
    } catch (e) {
      out.hiba++;
      log().warn({ transfer: r.id, err: safeErr(e) }, 'transfer reconcile failed');
    }
  }
  return out;
}

/** Daily 09:30: 'kesik' from the day after the due day; reminders on day 1, 4, 8 (each once); the lock check. */
export async function jobTransferReminders(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const out = { kesik: 0, emlekezteto: 0, zarolas: 0 };
  const late = await db.select().from(transferRequests).where(and(inArray(transferRequests.status, ['kiallitva', 'kesik']), sql`${transferRequests.dueOn} < ${today}`));
  const k = await fizetesKapcsolok(deps, db);
  const lockCheck = new Set<string>();
  for (const r of late) {
    if (r.status === 'kiallitva') {
      await db.update(transferRequests).set({ status: 'kesik', updatedAt: deps.now() }).where(and(eq(transferRequests.id, r.id), eq(transferRequests.status, 'kiallitva')));
      await audit(db, { action: 'transfer.late', actorRole: 'system', targetType: 'transfer_request', targetId: r.id, clientId: r.clientId, details: { dueOn: r.dueOn } });
      out.kesik++;
    }
    const daysLate = daysBetween(r.dueOn, today);
    const sent = new Set(r.remindersSent ?? []);
    // the highest reminder day reached and not sent yet (a missed run never sends two at once)
    const due = [...TRANSFER_RULES.reminderDays].filter((d) => d <= daysLate && !sent.has(d)).pop();
    if (due !== undefined) {
      const mark = [...new Set([...sent, ...TRANSFER_RULES.reminderDays.filter((d) => d <= due)])].sort((a, b) => a - b);
      const [claimed] = await db
        .update(transferRequests)
        .set({ remindersSent: mark, updatedAt: deps.now() })
        .where(and(eq(transferRequests.id, r.id), sql`not (${transferRequests.remindersSent} @> ${JSON.stringify([due])}::jsonb)`))
        .returning();
      if (claimed) {
        const [cl] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
        if (cl && !cl.anonymizedAt) {
          const params = { keresztnev: cl.firstName, osszeg: fmtHuf(r.amountHuf), hatarido: dotSpace(r.dueOn), szamlaszam: brand.provider.bankAccount, kozlemeny: r.kozlemeny };
          await notify(deps, db, { userId: cl.userId, kind: 'transfer_reminder', params, emailKey: 'transfer_reminder', link: '/fiok/elofizetes', data: { transferId: r.id, dedupe: `transfer:${r.id}:${due}` } });
          out.emlekezteto++;
        }
      }
    }
    if (k.kesesLeallit && daysLate >= TRANSFER_RULES.lockAfterDays) lockCheck.add(r.clientId);
  }
  if (lockCheck.size) {
    const { computeServiceLock } = await import('./zarolas.js');
    for (const id of lockCheck) if (await computeServiceLock(deps, id)) out.zarolas++;
  }
  return out;
}

/** zarolas.ts: the late-transfer lock (switch kesesLeallit ON, 8 days after the due day). */
export async function transferLockOf(deps: Deps, db: DbOrTx, clientId: string): Promise<{ locked: boolean; amountHuf: number }> {
  const k = await fizetesKapcsolok(deps, db);
  if (!k.kesesLeallit) return { locked: false, amountHuf: 0 };
  const limit = addDays(todayBudapest(deps.now()), -TRANSFER_RULES.lockAfterDays);
  const rows = await db.select({ amount: transferRequests.amountHuf }).from(transferRequests).where(and(eq(transferRequests.clientId, clientId), eq(transferRequests.status, 'kesik'), lte(transferRequests.dueOn, limit)));
  return { locked: rows.length > 0, amountHuf: rows.reduce((a, b) => a + b.amount, 0) };
}

// ---------------------------------------------------------------------------------------------------------------------
// console reads
// ---------------------------------------------------------------------------------------------------------------------
function adminRowOf(r: TrRow, name: string, no: number | null, today: string): AdminTransferRow {
  return {
    id: r.id,
    clientId: r.clientId,
    clientName: name,
    customerNo: no,
    kind: r.kind,
    period: r.periodStart && r.periodEnd ? { start: r.periodStart, end: r.periodEnd } : null,
    amountHuf: r.amountHuf,
    orderNo: r.orderNo,
    kozlemeny: r.kozlemeny,
    proformaNumber: r.proformaNumber,
    issuedOn: r.issuedOn,
    dueOn: r.dueOn,
    status: r.status,
    statusLabel: TRANSFER_STATUS_LABELS[r.status],
    daysLate: r.status === 'kesik' || r.status === 'kiallitva' ? Math.max(0, daysBetween(r.dueOn, today)) : 0,
    paidOn: r.paidOn,
    paidAmountHuf: r.paidAmountHuf,
    paidSource: r.paidSource,
    lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null,
    remindersSent: r.remindersSent ?? [],
    pdfFileId: r.proformaPdfFileId,
    mode: r.mode,
  };
}

export async function adminTransfers(deps: Deps, f: { status?: 'fizetett' | 'var' | 'kesik' | 'hiba'; clientId?: string; limit?: number }): Promise<AdminTransferRow[]> {
  const today = todayBudapest(deps.now());
  const conds = [];
  if (f.clientId) conds.push(eq(transferRequests.clientId, f.clientId));
  if (f.status === 'fizetett') conds.push(eq(transferRequests.status, 'fizetve'));
  if (f.status === 'var') conds.push(eq(transferRequests.status, 'kiallitva'));
  if (f.status === 'kesik') conds.push(eq(transferRequests.status, 'kesik'));
  if (f.status === 'hiba') conds.push(eq(transferRequests.status, 'hiba'));
  const rows = await deps.db
    .select({ r: transferRequests, first: clients.firstName, last: clients.lastName, no: clients.customerNo })
    .from(transferRequests)
    .innerJoin(clients, eq(clients.id, transferRequests.clientId))
    .where(conds.length ? and(...conds) : sql`true`)
    .orderBy(desc(transferRequests.createdAt))
    .limit(Math.min(f.limit ?? 200, 500));
  return rows.map((x) => adminRowOf(x.r, clientName({ firstName: x.first, lastName: x.last }), x.no, today));
}

/** The console tile: paid this calendar month / waiting / late (counts and amounts straight from the table). */
export async function adminTransferSummary(deps: Deps): Promise<AdminTransferSummary> {
  const db = deps.db;
  const monthStart = `${todayBudapest(deps.now()).slice(0, 7)}-01`;
  const agg = async (cond: ReturnType<typeof and>) => {
    const [r] = await db.select({ n: sql<number>`count(*)::int`, s: sql<number>`coalesce(sum(${transferRequests.amountHuf}), 0)::int` }).from(transferRequests).where(cond);
    return { n: Number(r?.n ?? 0), s: Number(r?.s ?? 0) };
  };
  const paid = await agg(and(eq(transferRequests.status, 'fizetve'), gte(transferRequests.paidOn, monthStart)));
  const wait = await agg(and(eq(transferRequests.status, 'kiallitva')));
  const late = await agg(and(eq(transferRequests.status, 'kesik')));
  const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(subscriptions).where(eq(subscriptions.billingMethod, 'atutalas'));
  return { fizetett: paid.n, fizetettHuf: paid.s, var: wait.n, varHuf: wait.s, kesik: late.n, kesikHuf: late.s, ugyfelek: Number(c?.n ?? 0) };
}
