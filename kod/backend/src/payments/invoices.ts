// Fee invoices (SPEC §11.5, §28.K.1, §29.2). Every successful payment with an amount gets exactly ONE fee invoice:
//  - a `fee_invoices` row 'folyamatban' is written in the payment transaction (external_key = our payment key);
//  - after commit the API tries once, the worker job `invoices_issue` (every minute) retries with back-off;
//  - every Számlázz.hu retry QUERIES FIRST by the key (szamlaKulsoAzon), so a document is never issued twice;
//  - a DEMO payment (and a Stripe TEST payment while INVOICE_MODE=demo) gets the DEMO díjbekérő through the same pipeline;
//  - a full refund → storno, a partial refund → corrective invoice (§29.2.4).
// The legacy SimplePay path keeps using `demoFeeInvoiceProvider` / `createFeeInvoiceProvider` (issued inline).
import { and, desc, eq, inArray, lte, or, sql } from 'drizzle-orm';
import brand from '../_shared/brand.json' with { type: 'json' };
import { INVOICE_FAILED_TEXTS, INVOICE_RULES, INVOICE_TEXTS } from '../_shared/k29.js';
import type { Config } from '../config.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { clients, feeCharges, feeInvoices, payments, transferRequests, users, type FeeInvoiceBuyer } from '../db/schema.js';
import { audit } from '../audit.js';
import { simpleTablePdf } from '../lib/pdf.js';
import { todayBudapest } from '../lib/dates.js';
import { log, safeErr } from '../log.js';
import { fmtHuf } from './huf.js';
import { buildInvoiceXml, buildQueryXml, buildQueryXmlBy, buildStornoXml, isDuplicateOrderError, SzamlazzError, type SzResult } from './szamlazzhu.js';

export interface FeeInvoiceInput {
  seq: number;
  issuedOn: string;
  amountHuf: number;
  periodStart: string | null;
  periodEnd: string | null;
  orderRef: string;
  simplepayTransactionId: number | null;
  client: { name: string; zip?: string | null; city?: string | null; address?: string | null; adoszam?: string | null };
  /** §29: the invoice line text and the payment line ("Fizetve bankkártyával (DEMO)"). */
  lineText?: string;
  paidWith?: string;
  /** 'sztorno' / 'helyesbito' print as such on the DEMO document. */
  docKind?: 'szamla' | 'sztorno' | 'helyesbito';
  refersTo?: string | null;
}

export interface FeeInvoiceProvider {
  readonly provider: 'demo' | 'szamlazzhu' | 'billingo' | 'none';
  issue(i: FeeInvoiceInput): Promise<{ number: string; pdf: Buffer; externalId: string | null; demo: boolean }>;
}

export class InvoiceNotConfigured extends Error {}

const huf = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n)} Ft`;

export function createFeeInvoiceProvider(cfg: Config): FeeInvoiceProvider {
  if (cfg.invoice.mode === 'demo') return demoFeeInvoiceProvider(cfg);
  return {
    provider: cfg.invoice.mode === 'disabled' ? 'none' : cfg.invoice.mode,
    async issue() {
      throw new InvoiceNotConfigured('A számlázó rendszer még nincs bekötve.');
    },
  };
}

/** The DEMO díjbekérő (never a real invoice). Also used for a DEMO payment whatever INVOICE_MODE is set to. */
export function demoFeeInvoiceProvider(cfg: Pick<Config, 'fontDir'>): FeeInvoiceProvider {
  return {
    provider: 'demo',
    async issue(i) {
      const prefix = i.docKind === 'sztorno' ? 'DEMO-S' : i.docKind === 'helyesbito' ? 'DEMO-H' : 'DEMO';
      const number = `${prefix}-${i.issuedOn.slice(0, 4)}-${String(i.seq).padStart(6, '0')}`;
      const title = i.docKind === 'sztorno' ? 'DEMO SZTORNÓ – NEM SZÁMLA' : i.docKind === 'helyesbito' ? 'DEMO HELYESBÍTÉS – NEM SZÁMLA' : 'DEMO DÍJBEKÉRŐ – NEM SZÁMLA';
      const pdf = await simpleTablePdf(cfg.fontDir, {
        title,
        banner: 'BEMUTATÓ ADAT. Ez nem számla és nem számviteli bizonylat; valódi pénzmozgás nem történt.',
        header: [
          `${brand.name} · ${brand.provider.legalName}`,
          `Sorszám: ${number} · Kelt: ${i.issuedOn}${i.refersTo ? ` · Hivatkozás: ${i.refersTo}` : ''}`,
          `Ügyfél: ${i.client.name}${i.client.city ? `, ${i.client.zip ?? ''} ${i.client.city}, ${i.client.address ?? ''}` : ''}`,
        ],
        rows: [
          [i.lineText ?? `Könyvelési szolgáltatás, havidíj${i.periodStart ? ` (${i.periodStart} – ${i.periodEnd ?? ''})` : ''}`, huf(i.amountHuf)],
          [i.paidWith ?? 'Fizetve bankkártyával (SimplePay, DEMO)', huf(i.amountHuf)],
        ],
        footer: [
          `Rendelésazonosító: ${i.orderRef}${i.simplepayTransactionId ? ` · SimplePay tranzakció: ${i.simplepayTransactionId}` : ''}`,
          'A valódi számlát a Számlázz.hu állítja ki, amikor élesben fizetsz.',
        ],
      });
      return { number, pdf, externalId: null, demo: true };
    },
  };
}

// =====================================================================================================================
// §29.2 pipeline
// =====================================================================================================================
type InvoiceRow = typeof feeInvoices.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

/** ADZ-{first 20 hex of the payment id} (+S storno, +H{n} correction). */
export function invoiceKeyFor(paymentId: string, suffix = ''): string {
  return `${INVOICE_RULES.keyPrefix}${paymentId.replace(/-/g, '').slice(0, INVOICE_RULES.keyHexChars)}${suffix}`;
}

/** Which issuer a payment of this mode goes to under the current config ('mismatch' = refuse, admin alert). */
export function invoiceRoute(cfg: Config, paymentMode: PaymentRow['mode']): { provider: 'demo' | 'szamlazzhu'; account: 'demo' | 'teszt' | 'eles' } | 'mismatch' {
  if (paymentMode === 'demo') return { provider: 'demo', account: 'demo' };
  const inv = cfg.invoice;
  if (paymentMode === 'test' || paymentMode === 'sandbox') {
    if (inv.mode === 'szamlazzhu') return inv.szamlazzhuAccount === 'teszt' ? { provider: 'szamlazzhu', account: 'teszt' } : 'mismatch';
    // A Stripe TEST payment moved no real money: while the server stays INVOICE_MODE=demo it gets the DEMO díjbekérő.
    if (inv.mode === 'demo') return { provider: 'demo', account: 'demo' };
    return 'mismatch';
  }
  // live money: only the live Számlázz.hu account
  return inv.mode === 'szamlazzhu' && inv.szamlazzhuAccount === 'eles' ? { provider: 'szamlazzhu', account: 'eles' } : 'mismatch';
}

export function buyerOf(cl: typeof clients.$inferSelect, email: string): FeeInvoiceBuyer {
  const bi = cl.businessIdentity;
  const seat = bi?.seat ?? null;
  return {
    name: bi?.name || `${cl.lastName} ${cl.firstName}`.trim(),
    firstName: cl.firstName,
    // the székhely when known, else the lakcím [KÖNYVELŐ confirms]
    zip: seat?.zip ?? cl.addressZip ?? null,
    city: seat?.city ?? cl.addressCity ?? null,
    address: seat?.line ?? cl.addressLine ?? null,
    adoszam: cl.adoszam ?? null,
    email,
  };
}

/** In the payment transaction: the invoice row to issue (never for 0 Ft). Returns its id. */
export async function queueFeeInvoice(
  deps: Deps,
  tx: DbOrTx,
  p: Pick<PaymentRow, 'id' | 'clientId' | 'mode' | 'amountHuf'>,
  buyer: FeeInvoiceBuyer,
  line: { megnevezes: string; unit: 'hó' | 'alkalom' },
): Promise<string | null> {
  if (p.amountHuf <= 0) return null;
  const route = invoiceRoute(deps.cfg, p.mode);
  const now = deps.now();
  const [row] = await tx
    .insert(feeInvoices)
    .values({
      clientId: p.clientId,
      provider: route === 'mismatch' ? 'szamlazzhu' : route.provider,
      providerAccount: route === 'mismatch' ? null : route.account,
      amountHuf: p.amountHuf,
      status: route === 'mismatch' ? 'hiba' : 'folyamatban',
      error: route === 'mismatch' ? 'mode_mismatch' : null,
      lastErrorCode: route === 'mismatch' ? 'mode_mismatch' : null,
      demo: route !== 'mismatch' && route.provider === 'demo',
      paymentId: p.id,
      kind: 'szamla',
      externalKey: invoiceKeyFor(p.id),
      buyer,
      line: { ...line, grossHuf: p.amountHuf },
      attempts: 0,
      nextRetryAt: route === 'mismatch' ? null : now,
      createdAt: now,
    })
    .onConflictDoNothing({ target: feeInvoices.externalKey })
    .returning({ id: feeInvoices.id });
  if (!row) {
    const [ex] = await tx.select({ id: feeInvoices.id }).from(feeInvoices).where(eq(feeInvoices.externalKey, invoiceKeyFor(p.id))).limit(1);
    return ex?.id ?? null;
  }
  await tx.update(payments).set({ feeInvoiceId: row.id }).where(eq(payments.id, p.id));
  if (route === 'mismatch') await audit(tx, { action: 'fee_invoice.mode_mismatch', actorRole: 'system', targetType: 'fee_invoice', targetId: row.id, clientId: p.clientId, details: { paymentMode: p.mode, invoiceMode: deps.cfg.invoice.mode, account: deps.cfg.invoice.szamlazzhuAccount } });
  return row.id;
}

/** Storno of an issued invoice (full refund). Idempotent per original. */
export async function queueStorno(deps: Deps, db: DbOrTx, originalId: string, reason: string): Promise<string | null> {
  const [orig] = await db.select().from(feeInvoices).where(eq(feeInvoices.id, originalId)).limit(1);
  if (!orig || orig.kind !== 'szamla') return null;
  const key = `${orig.externalKey ?? invoiceKeyFor(orig.paymentId ?? orig.id)}S`;
  const [ex] = await db.select({ id: feeInvoices.id }).from(feeInvoices).where(eq(feeInvoices.externalKey, key)).limit(1);
  if (ex) return ex.id;
  const [row] = await db
    .insert(feeInvoices)
    .values({
      clientId: orig.clientId,
      provider: orig.provider,
      providerAccount: orig.providerAccount,
      amountHuf: -orig.amountHuf,
      status: 'folyamatban',
      demo: orig.demo,
      paymentId: orig.paymentId,
      kind: 'sztorno',
      externalKey: key,
      stornoOf: orig.id,
      buyer: orig.buyer,
      // for a storno the line text is the reason (fejlec megjegyzes "Visszatérítés: {ok}")
      line: { megnevezes: reason.slice(0, 200) || 'visszatérítés', unit: orig.line?.unit ?? 'alkalom', grossHuf: -orig.amountHuf },
      nextRetryAt: deps.now(),
      createdAt: deps.now(),
    })
    .returning({ id: feeInvoices.id });
  await audit(db, { action: 'fee_invoice.storno_queued', actorRole: 'system', targetType: 'fee_invoice', targetId: orig.id, clientId: orig.clientId });
  return row?.id ?? null;
}

/** Corrective invoice of a partial refund (negative line of the refunded gross). */
export async function queueCorrection(deps: Deps, db: DbOrTx, originalId: string, refundedGross: number, n: number, reason: string): Promise<string | null> {
  const [orig] = await db.select().from(feeInvoices).where(eq(feeInvoices.id, originalId)).limit(1);
  if (!orig || orig.kind !== 'szamla' || refundedGross <= 0) return null;
  const key = `${orig.externalKey ?? invoiceKeyFor(orig.paymentId ?? orig.id)}H${n}`;
  const [ex] = await db.select({ id: feeInvoices.id }).from(feeInvoices).where(eq(feeInvoices.externalKey, key)).limit(1);
  if (ex) return ex.id;
  const [row] = await db
    .insert(feeInvoices)
    .values({
      clientId: orig.clientId,
      provider: orig.provider,
      providerAccount: orig.providerAccount,
      amountHuf: -refundedGross,
      status: 'folyamatban',
      demo: orig.demo,
      paymentId: orig.paymentId,
      kind: 'helyesbito',
      externalKey: key,
      stornoOf: orig.id,
      buyer: orig.buyer,
      line: { megnevezes: `Visszatérítés: ${orig.line?.megnevezes ?? 'díj'}`, unit: orig.line?.unit ?? 'alkalom', grossHuf: -refundedGross },
      nextRetryAt: deps.now(),
      createdAt: deps.now(),
    })
    .returning({ id: feeInvoices.id });
  await audit(db, { action: 'fee_invoice.correction_queued', actorRole: 'system', targetType: 'fee_invoice', targetId: orig.id, clientId: orig.clientId, details: { refundedGross } });
  return row?.id ?? null;
}

const backoffMs = (attempts: number) => (INVOICE_RULES.retryMinutes[Math.min(attempts - 1, INVOICE_RULES.retryMinutes.length - 1)] ?? 1440) * 60_000;

/**
 * One try of one invoice row (claimed atomically: two workers never run the same row). Query first, then issue.
 * Never throws: failures go to the row (status, attempts, next_retry_at, last_error_code) and, after the last try, to
 * the admins (invoice_failed, once per row).
 */
export async function processInvoice(deps: Deps, id: string): Promise<'kiallitva' | 'hiba' | 'folyamatban' | 'skip'> {
  const db = deps.db;
  const now = deps.now();
  const [claimed] = await db
    .update(feeInvoices)
    .set({ attempts: sql`${feeInvoices.attempts} + 1`, nextRetryAt: new Date(now.getTime() + 10 * 60_000) })
    .where(and(eq(feeInvoices.id, id), inArray(feeInvoices.status, ['folyamatban', 'hiba']), lte(feeInvoices.nextRetryAt, now)))
    .returning();
  if (!claimed) return 'skip';
  const row = claimed;
  try {
    const res = await issueOne(deps, row);
    await storeIssued(deps, row, res);
    return 'kiallitva';
  } catch (err) {
    const code = err instanceof SzamlazzError ? err.code : err instanceof InvoiceNotConfigured ? 'not_configured' : 'error';
    const msg = (err instanceof Error ? err.message : 'hiba').slice(0, 200);
    const last = row.attempts >= INVOICE_RULES.maxAttempts;
    const uncertain = err instanceof SzamlazzError && err.uncertain;
    await db
      .update(feeInvoices)
      .set({ status: uncertain && !last ? 'folyamatban' : 'hiba', error: msg, lastErrorCode: String(code).slice(0, 40), nextRetryAt: last ? null : new Date(now.getTime() + backoffMs(row.attempts)) })
      .where(eq(feeInvoices.id, row.id));
    log().warn({ invoice: row.id, code, attempts: row.attempts, err: safeErr(err) }, 'fee invoice not issued');
    if (last && !row.alertedAt) {
      await db.update(feeInvoices).set({ alertedAt: now }).where(eq(feeInvoices.id, row.id));
      await audit(db, { action: 'fee_invoice.failed', actorRole: 'system', targetType: 'fee_invoice', targetId: row.id, clientId: row.clientId, details: { code, attempts: row.attempts } });
      await alertAdmins(deps, 'invoice_failed', row.clientId, { osszeg: fmtHuf(Math.abs(row.amountHuf)), hiba: String(code) }, '/admin/dijszamlak');
    }
    return uncertain && !last ? 'folyamatban' : 'hiba';
  }
}

async function issueOne(deps: Deps, row: InvoiceRow): Promise<SzResult & { demo: boolean }> {
  const db = deps.db;
  const buyer = row.buyer;
  const line = row.line;
  if (!buyer || !line) throw new SzamlazzError('Hiányzó vevő- vagy tételadat', 'no_buyer', false);
  const [orig] = row.stornoOf ? await db.select().from(feeInvoices).where(eq(feeInvoices.id, row.stornoOf)).limit(1) : [];
  if (row.kind !== 'szamla' && (!orig || orig.status === 'folyamatban' || orig.status === 'hiba' || !orig.number)) throw new SzamlazzError('Az eredeti számla még nem készült el', 'original_pending', true);
  if (row.provider === 'demo') {
    const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(feeInvoices).where(and(eq(feeInvoices.provider, 'demo'), sql`${feeInvoices.number} is not null`));
    const [p] = row.paymentId ? await db.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1) : [];
    const out = await demoFeeInvoiceProvider(deps.cfg).issue({
      seq: Number(n?.n ?? 0) + 1,
      issuedOn: todayBudapest(deps.now()),
      amountHuf: row.amountHuf,
      periodStart: p?.periodStart ?? null,
      periodEnd: p?.periodEnd ?? null,
      orderRef: row.externalKey ?? row.id,
      simplepayTransactionId: null,
      client: { name: buyer.name, zip: buyer.zip, city: buyer.city, address: buyer.address, adoszam: buyer.adoszam },
      lineText: line.megnevezes,
      paidWith: p?.provider === 'stripe' ? 'Fizetve bankkártyával (Stripe TESZT, DEMO)' : p?.provider === 'atutalas' ? 'Fizetve átutalással (DEMO)' : 'Fizetve bankkártyával (DEMO)',
      docKind: row.kind,
      refersTo: orig?.number ?? null,
    });
    return { number: out.number, pdf: out.pdf, grossHuf: row.amountHuf, demo: true };
  }
  if (row.provider !== 'szamlazzhu' || deps.cfg.invoice.mode !== 'szamlazzhu' || !deps.szamlazz) throw new InvoiceNotConfigured('A Számlázz.hu nincs bekapcsolva.');
  // the account the row was meant for must be the configured one (a live row never goes to the test account and back)
  if (row.providerAccount !== deps.cfg.invoice.szamlazzhuAccount) throw new SzamlazzError('mode_mismatch', 'mode_mismatch', false);
  const key = row.externalKey!;
  const agentKey = deps.cfg.invoice.szamlazzhuKey;
  // 1. query first: a previous try may have created it already
  const found = await deps.szamlazz.query(buildQueryXml(agentKey, key));
  if (found) return { ...found, demo: false };
  const texts = await invoiceTexts(deps, buyer, row.kind === 'sztorno' ? (orig?.line?.megnevezes ?? line.megnevezes) : line.megnevezes, key);
  try {
    if (row.kind === 'sztorno') {
      return { ...(await deps.szamlazz.storno(buildStornoXml(agentKey, { key, originalNumber: orig!.number!, date: todayBudapest(deps.now()), megjegyzes: INVOICE_TEXTS.stornoMegjegyzes.replace('{ok}', line.megnevezes), /* k8: no buyer e-mail = Számlázz.hu sends nothing; our own mail goes */ email: null, replyTo: texts.replyTo, emailTargy: texts.targy, emailSzoveg: texts.szoveg }))), demo: false };
    }
    const [p] = row.paymentId ? await deps.db.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1) : [];
    // k8: the final invoice of a paid díjbekérő – fizmod Átutalás, the díjbekérő's number, the day the money arrived; an
    // invoice Autokassza already made of it is adopted (queried by its number), never issued a second time
    const [tr] = p?.provider === 'atutalas' && row.kind === 'szamla' ? await deps.db.select().from(transferRequests).where(eq(transferRequests.paymentId, p.id)).limit(1) : [];
    if (tr?.adoptedInvoiceNumber) {
      const adopted = await deps.szamlazz.query(buildQueryXmlBy(agentKey, { szamlaszam: tr.adoptedInvoiceNumber }));
      if (adopted) return { ...adopted, demo: false };
    }
    const payDay = tr?.paidOn ?? todayBudapest(p?.succeededAt ?? row.createdAt);
    const xml = buildInvoiceXml(agentKey, {
      key,
      issueDate: todayBudapest(deps.now()),
      paymentDate: payDay,
      buyer,
      line: { megnevezes: line.megnevezes, unit: line.unit, grossHuf: line.grossHuf },
      replyTo: texts.replyTo,
      emailTargy: texts.targy,
      emailSzoveg: texts.szoveg,
      megjegyzes: (tr ? 'Átutalással fizetve. Azonosító: {kulcs}' : INVOICE_TEXTS.megjegyzes).replace('{kulcs}', key),
      correctionOf: row.kind === 'helyesbito' ? orig!.number : null,
      wholeNet: process.env.SZAMLAZZHU_WHOLE_NET === '1',
      // k8 (K8_TERV:22): Számlázz.hu never e-mails the invoice – our own mail with the PDF goes out (storeIssued)
      sendEmail: false,
      ...(tr ? { fizmod: 'Átutalás', dijbekeroSzamlaszam: tr.proformaNumber } : {}),
    });
    return { ...(await deps.szamlazz.issue(xml)), demo: false };
  } catch (e) {
    // "already existing order number" → it exists: query, store, done
    if (isDuplicateOrderError(e)) {
      const again = await deps.szamlazz.query(buildQueryXml(agentKey, key));
      if (again) return { ...again, demo: false };
    }
    throw e;
  }
}

async function invoiceTexts(deps: Deps, buyer: FeeInvoiceBuyer, megnevezes: string, key: string): Promise<{ replyTo: string | null; targy: string; szoveg: string }> {
  const support = String((brand.provider as { supportEmail?: string }).supportEmail ?? '');
  const replyTo = support && !support.startsWith('[') && /@/.test(support) ? support : null;
  const targy = await deps.content.render('k29.szamla.email_targy', { megnevezes });
  const szoveg = await deps.content.render('k29.szamla.email_szoveg', { keresztnev: buyer.firstName, megnevezes });
  void key;
  return { replyTo, targy, szoveg };
}

async function storeIssued(deps: Deps, row: InvoiceRow, res: SzResult & { demo: boolean }): Promise<void> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  let fileId: string | null = null;
  if (res.pdf.length) {
    const file = await deps.storage.put(db, {
      ownerClientId: row.clientId,
      kind: 'dijszamla',
      mime: 'application/pdf',
      displayName: `${res.number}.pdf`,
      data: res.pdf,
      retentionUntil: `${Number(today.slice(0, 4)) + INVOICE_RULES.retentionYears}-01-01`,
      now: deps.now(),
    });
    fileId = file.id;
  }
  await db.transaction(async (tx) => {
    await tx.update(feeInvoices).set({ status: 'kiallitva', number: res.number, issuedOn: today, pdfFileId: fileId, demo: res.demo, error: null, lastErrorCode: null, nextRetryAt: null }).where(eq(feeInvoices.id, row.id));
    if (row.kind === 'sztorno' && row.stornoOf) await tx.update(feeInvoices).set({ status: 'sztorno' }).where(eq(feeInvoices.id, row.stornoOf));
    if (row.kind === 'szamla' && row.paymentId) {
      const [p] = await tx.select({ feeChargeId: payments.feeChargeId }).from(payments).where(eq(payments.id, row.paymentId)).limit(1);
      if (p?.feeChargeId) await tx.update(feeCharges).set({ feeInvoiceId: row.id }).where(eq(feeCharges.id, p.feeChargeId));
    }
    await audit(tx, { action: 'fee_invoice.issued', actorRole: 'system', targetType: 'fee_invoice', targetId: row.id, clientId: row.clientId, details: { kind: row.kind, provider: row.provider, account: row.providerAccount, demo: res.demo } });
  });
  if (row.kind === 'szamla') {
    const [cl] = await db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, row.clientId)).limit(1);
    const { notify } = await import('../notify/notify.js');
    // k8: the invoice goes in our own mail (below): the notification is in-app + push only
    if (cl) await notify(deps, db, { userId: cl.userId, kind: 'fee_invoice_issued', params: { amount: `${fmtHuf(row.amountHuf)} Ft` }, link: '/fiok/dijak', noEmail: true });
  }
  await invoiceMail(deps, row, res).catch((e: unknown) => log().warn({ invoice: row.id, err: safeErr(e) }, 'fee invoice mail failed'));
}

/**
 * k8 B4 (K8_TERV:22): our own fee-invoice mail with the PDF (Számlázz.hu sendEmail=false) for every issued document –
 * invoice, storno, correction; the text by kind (havidíj with the period, a one-off fee, storno, correction).
 */
async function invoiceMail(deps: Deps, row: InvoiceRow, res: SzResult & { demo: boolean }): Promise<void> {
  const db = deps.db;
  const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
  const [u] = cl ? await db.select({ email: users.email, status: users.status }).from(users).where(eq(users.id, cl.userId)).limit(1) : [];
  if (!cl || !u || u.status !== 'active' || cl.anonymizedAt) return;
  const [p] = row.paymentId ? await db.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1) : [];
  const [orig] = row.stornoOf ? await db.select().from(feeInvoices).where(eq(feeInvoices.id, row.stornoOf)).limit(1) : [];
  const monthly = Boolean(p && (p.kind === 'elso_havi' || p.kind === 'havi' || p.kind === 'fizesd_ki') && p.periodStart && p.periodEnd);
  const { periodSpace } = await import('../services/atutalas.js');
  const variant = row.kind === 'sztorno' ? 'sztorno' : row.kind === 'helyesbito' ? 'helyesbito' : monthly ? 'havidij' : undefined;
  const link = `${deps.cfg.appPublicUrl}/fiok/dijszamlak`;
  const { sendTemplateMail } = await import('../notify/notify.js');
  await sendTemplateMail(deps, {
    to: u.email,
    key: 'fee_invoice',
    ...(variant ? { variant } : {}),
    lablec: 'ugyfel',
    gomb: { szoveg: await deps.content.render('email.fee_invoice.gomb', {}), link },
    attachments: res.pdf.length ? [{ filename: `szamla-${res.number}.pdf`, content: res.pdf, contentType: 'application/pdf' }] : [],
    params: {
      keresztnev: cl.firstName,
      megnevezes: row.line?.megnevezes ?? 'díj',
      idoszak: monthly ? periodSpace(p!.periodStart!, p!.periodEnd!) : '',
      osszeg: fmtHuf(Math.abs(row.amountHuf)),
      szamlaszam: res.number,
      eredeti: orig?.number ?? '',
      fizetes: await deps.content.render(p?.provider === 'atutalas' ? 'k8.fizetes.atutalas' : 'k8.fizetes.kartya', {}),
      link,
    },
  });
}

/**
 * k7c2 B8 (SPEC §29.2 "admin alert"): a payment whose mode has no invoicing route under the current config gets a
 * 'hiba mode_mismatch' row that is never retried by itself – the admins are told once per row.
 */
export async function alertMismatchInvoices(deps: Deps, onlyId?: string): Promise<number> {
  const db = deps.db;
  const rows = await db
    .select()
    .from(feeInvoices)
    .where(and(eq(feeInvoices.status, 'hiba'), eq(feeInvoices.lastErrorCode, 'mode_mismatch'), sql`${feeInvoices.alertedAt} is null`, onlyId ? eq(feeInvoices.id, onlyId) : sql`true`))
    .limit(50);
  let n = 0;
  for (const row of rows) {
    const [claimed] = await db.update(feeInvoices).set({ alertedAt: deps.now() }).where(and(eq(feeInvoices.id, row.id), sql`${feeInvoices.alertedAt} is null`)).returning({ id: feeInvoices.id });
    if (!claimed) continue;
    await audit(db, { action: 'fee_invoice.failed', actorRole: 'system', targetType: 'fee_invoice', targetId: row.id, clientId: row.clientId, details: { code: 'mode_mismatch' } });
    await alertAdmins(deps, 'invoice_failed', row.clientId, { osszeg: fmtHuf(Math.abs(row.amountHuf)), hiba: 'a számlázó nincs bekötve ehhez a fizetési módhoz' }, '/admin/dijszamlak');
    n++;
  }
  return n;
}

/** Worker (every minute): rows waiting for a (re)try. */
export async function jobInvoicesIssue(deps: Deps): Promise<Record<string, number>> {
  const due = await deps.db
    .select({ id: feeInvoices.id })
    .from(feeInvoices)
    .where(and(inArray(feeInvoices.status, ['folyamatban', 'hiba']), lte(feeInvoices.nextRetryAt, deps.now())))
    .orderBy(feeInvoices.createdAt)
    .limit(20);
  const out = { kiallitva: 0, hiba: 0, folyamatban: 0, skip: 0, riasztas: 0 };
  for (const r of due) out[await processInvoice(deps, r.id)]++;
  out.riasztas = await alertMismatchInvoices(deps).catch((e: unknown) => {
    log().warn({ err: safeErr(e) }, 'mismatch invoice alert failed');
    return 0;
  });
  return out;
}

/** Admin "Újrapróbálom" (queries first like every retry). */
export async function retryInvoice(deps: Deps, id: string, byUserId: string): Promise<'kiallitva' | 'hiba' | 'folyamatban' | 'skip'> {
  const [row] = await deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, id)).limit(1);
  if (!row || (row.status !== 'hiba' && row.status !== 'folyamatban')) return 'skip';
  if (row.lastErrorCode === 'mode_mismatch') {
    // the configuration may have been fixed: decide the route again
    const [p] = row.paymentId ? await deps.db.select().from(payments).where(eq(payments.id, row.paymentId)).limit(1) : [];
    const route = p ? invoiceRoute(deps.cfg, p.mode) : 'mismatch';
    if (route === 'mismatch') return 'hiba';
    await deps.db.update(feeInvoices).set({ provider: route.provider, providerAccount: route.account, demo: route.provider === 'demo' }).where(eq(feeInvoices.id, id));
  }
  await deps.db
    .update(feeInvoices)
    .set({ status: 'folyamatban', nextRetryAt: deps.now(), attempts: Math.min(row.attempts, INVOICE_RULES.maxAttempts - 1), alertedAt: null })
    .where(eq(feeInvoices.id, id));
  await audit(deps.db, { action: 'fee_invoice.retry', actorUserId: byUserId, actorRole: 'admin', targetType: 'fee_invoice', targetId: id, clientId: row.clientId });
  return processInvoice(deps, id);
}

/** Notification to every active admin (payment_disputed, invoice_failed, duplicates). */
export async function alertAdmins(deps: Deps, kind: 'invoice_failed' | 'payment_disputed', clientId: string | null, params: Record<string, string>, link: string, variant?: string): Promise<void> {
  const db = deps.db;
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
  let clientName = '';
  if (clientId) {
    const [cl] = await db.select({ f: clients.firstName, l: clients.lastName }).from(clients).where(eq(clients.id, clientId)).limit(1);
    clientName = cl ? `${cl.l} ${cl.f}`.trim() : '';
  }
  const { notify } = await import('../notify/notify.js');
  for (const a of admins) {
    try {
      await notify(deps, db, { userId: a.id, kind, ...(variant ? { variant } : {}), params: { ...params, clientName }, link });
    } catch (e) {
      log().warn({ err: safeErr(e) }, 'admin alert failed');
    }
  }
}

/** The fee invoices of a client (app Fiók → Díjak és számlák; console). */
export async function invoicesOfClient(db: DbOrTx, clientId: string): Promise<InvoiceRow[]> {
  return db
    .select()
    .from(feeInvoices)
    .where(and(eq(feeInvoices.clientId, clientId), or(eq(feeInvoices.status, 'kiallitva'), eq(feeInvoices.status, 'sztorno'))))
    .orderBy(desc(feeInvoices.createdAt));
}

export { INVOICE_FAILED_TEXTS };
