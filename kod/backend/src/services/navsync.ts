// NAV Online Számla sync (SPEC §8.3, §15): reads OUTBOUND invoices, stores them, creates the
// revenue items (§5.5 rule), recalculates the estimate and flags. Read-only towards NAV.
import { and, eq, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { accountants, clients, navCredentials, navInvoices, navSyncRuns, revenueItems, users } from '../db/schema.js';
import { isNavError, NavError, type NavCredentials, type NormalizedInvoice } from '../nav/types.js';
import { todayBudapest } from '../lib/dates.js';
import { log, safeErr } from '../log.js';
import { audit } from '../audit.js';
import { ensureDossier } from './documents.js';
import { checkCompletion, setStep, stepStatus } from './onboarding.js';
import { computeFlags } from './flags.js';
import { recalcYear } from './tax.js';
import { notifyNewInvoices, payerKindOf } from './szamla-ertesites.js';
import { activeAdminEmails, sendTemplateMail } from '../notify/notify.js';
import { clientName } from './people.js';

export interface StoredCreds {
  login: string;
  password: string;
  signatureKey: string;
  exchangeKey?: string;
}

export function credsFor(deps: Deps, row: typeof navCredentials.$inferSelect): NavCredentials {
  const s = deps.navKey.decJson<StoredCreds>(row.secretEnc, `nav_credentials:${row.clientId}`);
  return { ...s, taxNumber: row.taxNumber };
}

/** §5.5: CASH/CARD/VOUCHER → issue date; otherwise payment date (or issue date), marked estimated. */
export function receivedOnOf(inv: Pick<NormalizedInvoice, 'paymentMethod' | 'paymentDate' | 'issueDate'>): { receivedOn: string; estimated: boolean } {
  const pm = (inv.paymentMethod ?? '').toUpperCase();
  if (pm === 'CASH' || pm === 'CARD' || pm === 'VOUCHER') return { receivedOn: inv.issueDate, estimated: false };
  return { receivedOn: inv.paymentDate ?? inv.issueDate, estimated: true };
}

/** Stores one invoice + its revenue item. Returns the new nav_invoices.id, or null when it already existed (SPEC §28.2.1). */
export async function storeInvoice(deps: Deps, clientId: string, inv: NormalizedInvoice, rawXml: string | null): Promise<string | null> {
  return deps.db.transaction(async (tx) => {
    const modKey = inv.modificationIndex ?? 0;
    const [exists] = await tx
      .select({ id: navInvoices.id })
      .from(navInvoices)
      .where(and(eq(navInvoices.clientId, clientId), eq(navInvoices.invoiceNumber, inv.invoiceNumber), eq(navInvoices.modKey, modKey), eq(navInvoices.operation, inv.operation)))
      .limit(1);
    if (exists) return null;
    let rawId: string | null = null;
    if (rawXml) {
      const f = await deps.storage.put(tx, { ownerClientId: clientId, kind: 'nav_xml', mime: 'application/xml', displayName: `${inv.invoiceNumber}.xml`.slice(0, 120), data: Buffer.from(rawXml, 'utf8'), now: deps.now() });
      rawId = f.id;
    }
    const month = inv.issueDate.slice(0, 7);
    const demo = inv.source === 'DEMO';
    const [row] = await tx
      .insert(navInvoices)
      .values({
        clientId,
        invoiceNumber: inv.invoiceNumber,
        batchIndex: inv.batchIndex ?? null,
        operation: inv.operation,
        category: inv.category,
        issueDate: inv.issueDate,
        deliveryDate: inv.deliveryDate ?? null,
        paymentDate: inv.paymentDate ?? null,
        paymentMethod: inv.paymentMethod ?? null,
        currency: inv.currency,
        netHuf: inv.netAmountHuf,
        vatHuf: inv.vatAmountHuf,
        grossHuf: inv.grossAmountHuf,
        customerName: inv.customer?.name ?? inv.customerName ?? null,
        customerTaxNumber: inv.customer?.taxNumber ?? inv.customerTaxNumber ?? null,
        originalInvoiceNumber: inv.originalInvoiceNumber ?? null,
        modificationIndex: inv.modificationIndex ?? null,
        modKey,
        insDate: inv.insDate ? new Date(inv.insDate) : null,
        transactionId: inv.transactionId ?? null,
        data: inv as unknown as Record<string, unknown>,
        rawXmlFileId: rawId,
        dossierMonth: month,
        demo,
        // SPEC §28.K.11: the customer's VAT status (DOMESTIC / PRIVATE_PERSON / OTHER) for the KATA warning
        customerVatStatus: (inv as { customer?: { vatStatus?: string } }).customer?.vatStatus ?? null,
      })
      .returning({ id: navInvoices.id });
    const rec = receivedOnOf(inv);
    await tx.insert(revenueItems).values({
      clientId,
      source: 'nav_szamla',
      navInvoiceId: row!.id,
      receivedOn: rec.receivedOn,
      receivedOnEstimated: rec.estimated,
      deliveryDate: inv.deliveryDate ?? inv.issueDate,
      amountHuf: inv.grossAmountHuf,
      description: `${inv.invoiceNumber}${inv.customer?.name ? ` – ${inv.customer.name}` : ''}`.slice(0, 200),
      payerKind: payerKindOf({ customerVatStatus: (inv as { customer?: { vatStatus?: string } }).customer?.vatStatus ?? null, data: null, customerTaxNumber: null }),
    });
    await ensureDossier(tx, clientId, month);
    return row!.id;
  });
}

export interface SyncOutcome {
  runId: string;
  status: 'ok' | 'hiba';
  digestsSeen: number;
  invoicesNew: number;
  errorCode?: string;
  messageHu?: string;
}

export async function syncClient(deps: Deps, clientId: string, o: { asOf?: string; by?: string | null } = {}): Promise<SyncOutcome> {
  const asOf = o.asOf ?? todayBudapest(deps.now());
  const [cred] = await deps.db.select().from(navCredentials).where(eq(navCredentials.clientId, clientId)).limit(1);
  if (!cred) throw new NavError({ code: 'NO_CREDENTIALS', kind: 'config', messageHu: 'Ehhez az ügyfélhez még nincs NAV-kapcsolat megadva.' });
  // One running sync per client (partial unique index); stale runs (> 2 h) are closed first.
  await deps.db
    .update(navSyncRuns)
    .set({ status: 'hiba', finishedAt: deps.now(), errorCode: 'STALE' })
    .where(and(eq(navSyncRuns.clientId, clientId), eq(navSyncRuns.status, 'fut'), sql`${navSyncRuns.startedAt} < now() - interval '2 hours'`));
  let runId: string;
  try {
    const [run] = await deps.db.insert(navSyncRuns).values({ clientId, startedAt: deps.now() }).returning({ id: navSyncRuns.id });
    runId = run!.id;
  } catch {
    throw new NavError({ code: 'SYNC_RUNNING', kind: 'unknown', messageHu: 'Már fut egy lekérdezés ennél az ügyfélnél.' });
  }
  let seen = 0;
  let added = 0;
  const newIds: string[] = [];
  // SPEC §28.2.1 (3): the client's first successful sync is the backfill – nobody is notified.
  const firstSync = cred.lastSyncStatus === null || cred.lastSyncStatus === undefined;
  let maxIns: string | null = cred.syncCursorInsDate?.toISOString() ?? null;
  try {
    const client = deps.navClient(cred.environment, credsFor(deps, cred));
    for await (const item of client.syncOutbound({ since: cred.syncCursorInsDate?.toISOString() ?? null, asOf })) {
      seen++;
      if (item.digest.insDate && (!maxIns || item.digest.insDate > maxIns)) maxIns = item.digest.insDate;
      const modKey = item.digest.modificationIndex ?? 0;
      const [exists] = await deps.db
        .select({ id: navInvoices.id })
        .from(navInvoices)
        .where(and(eq(navInvoices.clientId, clientId), eq(navInvoices.invoiceNumber, item.digest.invoiceNumber), eq(navInvoices.modKey, modKey), eq(navInvoices.operation, item.digest.operation)))
        .limit(1);
      if (exists) continue;
      const data = await item.data();
      const newId = await storeInvoice(deps, clientId, data.invoice, data.rawXml);
      if (newId) {
        added++;
        newIds.push(newId);
      }
    }
    const now = deps.now();
    await deps.db.update(navSyncRuns).set({ status: 'ok', finishedAt: now, digestsSeen: seen, invoicesNew: added }).where(eq(navSyncRuns.id, runId));
    await deps.db
      .update(navCredentials)
      .set({ lastSyncAt: now, lastSyncStatus: 'ok', lastSyncError: null, status: 'rendben', syncCursorInsDate: maxIns ? new Date(maxIns) : cred.syncCursorInsDate })
      .where(eq(navCredentials.id, cred.id));
    await audit(deps.db, { action: 'nav.sync', actorUserId: o.by ?? null, actorRole: o.by ? 'accountant' : 'system', targetType: 'client', targetId: clientId, clientId, details: { ok: true, seen, added } });
    if ((await stepStatus(deps.db, clientId, 'nav_bekotes')) !== 'kesz') {
      await setStep(deps, deps.db, clientId, 'nav_bekotes', 'kesz', { by: o.by ?? null });
      await checkCompletion(deps, deps.db, clientId);
    }
    const years = new Set([Number(asOf.slice(0, 4))]);
    for (const y of years) await recalcYear(deps, deps.db, clientId, y, { asOf });
    await computeFlags(deps, deps.db, clientId);
    await notifyNewInvoices(deps, clientId, newIds, { firstSync }).catch((err: Error) => log().warn({ err: safeErr(err) }, 'invoice notification failed'));
    return { runId, status: 'ok', digestsSeen: seen, invoicesNew: added };
  } catch (err) {
    const e = isNavError(err) ? err : new NavError({ code: 'INTERNAL', kind: 'unknown', messageHu: 'Váratlan hiba a lekérdezés közben.' });
    if (!isNavError(err)) log().error({ err: safeErr(err) }, 'nav sync failed');
    else log().warn({ nav: err.toJSON() }, 'nav sync error');
    const now = deps.now();
    const authErr = e.kind === 'auth' || e.kind === 'permission';
    await deps.db.update(navSyncRuns).set({ status: 'hiba', finishedAt: now, digestsSeen: seen, invoicesNew: added, errorCode: e.code }).where(eq(navSyncRuns.id, runId));
    // k7b: the rendben → hibas switch is made atomically first, so of two runs that both read 'rendben' only one mails
    const brokeNow = authErr
      ? (await deps.db.update(navCredentials).set({ status: 'hibas' }).where(and(eq(navCredentials.id, cred.id), eq(navCredentials.status, 'rendben'))).returning({ id: navCredentials.id })).length > 0
      : false;
    await deps.db
      .update(navCredentials)
      .set({ lastSyncAt: now, lastSyncStatus: 'hiba', lastSyncError: e.messageHu || e.code, ...(authErr ? { status: 'hibas' as const } : {}) })
      .where(eq(navCredentials.id, cred.id));
    await audit(deps.db, { action: 'nav.sync', actorUserId: o.by ?? null, actorRole: o.by ? 'accountant' : 'system', targetType: 'client', targetId: clientId, clientId, details: { ok: false, code: e.code, seen, added } });
    if (added > 0) await recalcYear(deps, deps.db, clientId, Number(asOf.slice(0, 4)), { asOf });
    await computeFlags(deps, deps.db, clientId);
    if (added > 0) await notifyNewInvoices(deps, clientId, newIds, { firstSync }).catch((e2: Error) => log().warn({ err: safeErr(e2) }, 'invoice notification failed'));
    // k7b (LEVEL_LEFEDETTSEG #71): working credentials ('rendben') just broke on the technical user or its rights → the
    // accountant and the admins get ONE e-mail. The daily job skips 'hibas' credentials, so it never repeats; it comes
    // again only after a fix (test or sync → 'rendben') and a new failure.
    if (brokeNow) await mailNavError(deps, clientId, e.messageHu || e.code, o.by ?? null).catch((e3: Error) => log().warn({ err: safeErr(e3) }, 'nav error mail failed'));
    return { runId, status: 'hiba', digestsSeen: seen, invoicesNew: added, errorCode: e.code, messageHu: e.messageHu };
  }
}

/** "Hibás a technikai felhasználó." → "hibás a technikai felhasználó" (it follows a colon); an acronym stays as it is. */
export function navErrorPhrase(msg: string): string {
  const t = msg.trim().replace(/[.!?…]+$/, '');
  return /^\p{Lu}(?!\p{Lu})/u.test(t) ? t.charAt(0).toLocaleLowerCase('hu-HU') + t.slice(1) : t;
}

async function mailNavError(deps: Deps, clientId: string, message: string, byUserId: string | null): Promise<void> {
  const [cl] = await deps.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return;
  const params = { clientName: clientName(cl), hiba: navErrorPhrase(message) };
  const sentTo = new Set<string>();
  if (cl.accountantId) {
    const [acc] = await deps.db.select({ userId: users.id, email: users.email, status: users.status }).from(accountants).innerJoin(users, eq(users.id, accountants.userId)).where(eq(accountants.id, cl.accountantId)).limit(1);
    // the accountant who pressed "Lekérdezés most" sees the error on the screen already
    if (acc && acc.status === 'active' && acc.userId !== byUserId) {
      await sendTemplateMail(deps, { to: acc.email, key: 'nav_hiba', params });
      sentTo.add(acc.email);
    }
  }
  for (const to of await activeAdminEmails(deps.db)) {
    if (sentTo.has(to)) continue;
    await sendTemplateMail(deps, { to, key: 'nav_hiba', variant: 'admin', params });
    sentTo.add(to);
  }
  await audit(deps.db, { action: 'mail.nav_hiba', actorRole: 'system', targetType: 'client', targetId: clientId, clientId, details: { recipients: sentTo.size } });
}

/** Daily job: every client with working credentials, serially. */
export async function syncAll(deps: Deps): Promise<{ ok: number; failed: number }> {
  const rows = await deps.db
    .select({ clientId: navCredentials.clientId })
    .from(navCredentials)
    .innerJoin(clients, eq(clients.id, navCredentials.clientId))
    .where(and(eq(navCredentials.status, 'rendben'), sql`${clients.lifecycle} <> 'megszunt'`));
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      const res = await syncClient(deps, r.clientId);
      if (res.status === 'ok') ok++;
      else failed++;
    } catch (err) {
      failed++;
      log().warn({ code: isNavError(err) ? err.code : 'INTERNAL' }, 'nav sync skipped');
    }
    await new Promise((res) => setTimeout(res, deps.cfg.isTest ? 0 : 1100));
  }
  return { ok, failed };
}
