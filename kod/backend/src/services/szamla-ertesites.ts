// SPEC §28.2 – new-invoice notification after the NAV sync: push + in-app "Új kiállított számlád: 120 000 Ft – Bodza
// Kiadó Kft. Tegyél félre kb. 31 000 Ft-ot.", one per invoice or one per run (variant 'tobb'), folded into an unsent row
// of the last 20 h, at most 2 pushes per client per Budapest day, quiet hours (notify()), amounts switchable off
// (push_show_amounts → variant 'rejtett'). A private person's name is never put in any channel ("Magánszemély").
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { INVOICE_NOTIFY_RULES, KATA_WARNING_PAYER_KINDS, type InvoiceNotifyState } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { clients, clientTaxProfiles, navInvoices, notifications, revenueItems, revenueReserves, systemState } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, budapestLocalToUtc, todayBudapest } from '../lib/dates.js';
import { notificationSettingsOf, notify } from '../notify/notify.js';
import { ensureReserves } from './felretesz.js';
import { fmt } from './kedvezmeny.js';

export const NOTIFY_FROM_KEY = 'ot1119.invoice_notify_from';

type InvRow = typeof navInvoices.$inferSelect;

/** "Magánszemély" when the customer is a private person (no tax number, or vatStatus PRIVATE_PERSON) or has no name. */
export function customerLabel(inv: Pick<InvRow, 'customerName' | 'customerTaxNumber' | 'customerVatStatus' | 'data'>, privateLabel: string): string {
  const vat = inv.customerVatStatus ?? ((inv.data as { customer?: { vatStatus?: string } } | null)?.customer?.vatStatus ?? null);
  const name = (inv.customerName ?? '').trim();
  if (!name || vat === 'PRIVATE_PERSON' || (!inv.customerTaxNumber && vat !== 'DOMESTIC' && vat !== 'OTHER')) return privateLabel;
  return name.length > INVOICE_NOTIFY_RULES.customerNameMaxChars ? `${name.slice(0, INVOICE_NOTIFY_RULES.customerNameMaxChars - 1)}…` : name;
}

async function notifyFrom(deps: Deps): Promise<Date | null> {
  const [r] = await deps.db.select().from(systemState).where(eq(systemState.key, NOTIFY_FROM_KEY)).limit(1);
  const at = (r?.value as { at?: string } | null)?.at;
  return at ? new Date(at) : null;
}

interface Item {
  navInvoiceId: string;
  amountHuf: number;
  reserveHuf: number;
  crossesTaxFree: boolean;
  zone: string;
  vevo: string;
}

/**
 * Called at the end of syncClient with the ids stored in the run. `firstSync` = the client's first successful sync
 * (the backfill – nobody is notified). Each invoice is claimed once (notify_state null → 'kuldve'), so a re-run or a
 * parallel manual sync never double-sends.
 */
export async function notifyNewInvoices(deps: Deps, clientId: string, ids: string[], o: { firstSync: boolean }): Promise<number> {
  if (!ids.length) return 0;
  const db = deps.db;
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return 0;
  const rows = await db.select().from(navInvoices).where(and(inArray(navInvoices.id, ids), isNull(navInvoices.notifyState)));
  const today = todayBudapest(deps.now());
  const from = await notifyFrom(deps);
  const minIssue = addDays(today, -INVOICE_NOTIFY_RULES.maxAgeDays);
  // KATA clients get the business-customer warning instead (SPEC §28.K.11) for such invoices.
  const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, Number(today.slice(0, 4))))).limit(1);
  const skip = new Map<string, InvoiceNotifyState>();
  for (const r of rows) {
    let reason: InvoiceNotifyState | null = null;
    if (r.operation !== 'CREATE') reason = 'kihagyva_modositas';
    else if (cl.lifecycle !== 'aktiv') reason = 'kihagyva_zarolt';
    else if (o.firstSync) reason = 'kihagyva_elso_szinkron';
    else if (r.issueDate < minIssue || !from || r.createdAt.getTime() < from.getTime()) reason = 'kihagyva_regi';
    if (reason) skip.set(r.id, reason);
  }
  for (const [id, st] of skip) await db.update(navInvoices).set({ notifyState: st }).where(and(eq(navInvoices.id, id), isNull(navInvoices.notifyState)));
  const wanted = rows.filter((r) => !skip.has(r.id)).map((r) => r.id);
  if (!wanted.length) return 0;
  // claim (dedupe)
  const claimed = await db
    .update(navInvoices)
    .set({ notifyState: 'kuldve', notifiedAt: deps.now() })
    .where(and(inArray(navInvoices.id, wanted), isNull(navInvoices.notifyState)))
    .returning();
  if (!claimed.length) return 0;
  // the reserves of the claimed invoices (after the recalc)
  const items = await invoiceItems(deps, clientId, claimed);
  // KATA: business customers → kata_business_invoice (handled by the KATA warning; not part of this message)
  const kataBusiness = tp?.regime === 'kata' ? new Set(claimed.filter((c) => KATA_WARNING_PAYER_KINDS.includes(payerKindOf(c))).map((c) => c.id)) : new Set<string>();
  const list = items.filter((i) => !kataBusiness.has(i.navInvoiceId));
  if (list.length) await sendOrFold(deps, cl.userId, list);
  await audit(db, { action: 'invoice.notified', actorRole: 'system', targetType: 'client', targetId: clientId, clientId, details: { count: list.length, variant: list.length > 1 ? 'tobb' : 'egy' } });
  return list.length;
}

/**
 * The notification items of these invoices with the engine's CURRENT reserve (ensureReserves first): the same
 * revenue_reserves.reserve_huf the invoice page shows, so the message and the page never differ (round 2 of 11-19).
 */
export async function invoiceItems(deps: Deps, clientId: string, invoices: InvRow[]): Promise<Item[]> {
  const db = deps.db;
  if (!invoices.length) return [];
  const revs = await db.select().from(revenueItems).where(and(inArray(revenueItems.navInvoiceId, invoices.map((x) => x.id)), isNull(revenueItems.deletedAt)));
  for (const y of new Set(revs.map((r) => Number(r.receivedOn.slice(0, 4))))) await ensureReserves(deps, db, clientId, y);
  const rr = revs.length ? await db.select().from(revenueReserves).where(inArray(revenueReserves.revenueItemId, revs.map((r) => r.id))) : [];
  const privateLabel = await deps.content.get('notif.invoice_new.magansz');
  // KATA (k6c): the átalány reserve does not apply – no amount until the KATA view (the month's 50 000 Ft covers it)
  const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, Number(todayBudapest(deps.now()).slice(0, 4))))).limit(1);
  const kata = tp?.regime === 'kata';
  return invoices
    .slice()
    .sort((a, b) => (a.issueDate < b.issueDate ? -1 : 1))
    .map((inv) => {
      const rev = revs.find((r) => r.navInvoiceId === inv.id);
      const res = rev ? rr.find((x) => x.revenueItemId === rev.id) : undefined;
      if (kata) return { navInvoiceId: inv.id, amountHuf: inv.grossHuf, reserveHuf: 0, crossesTaxFree: false, zone: 'nincs_adat', vevo: customerLabel(inv, privateLabel) };
      return { navInvoiceId: inv.id, amountHuf: inv.grossHuf, reserveHuf: Math.max(0, res?.reserveHuf ?? 0), crossesTaxFree: Boolean(res?.crossesTaxFree), zone: res?.zone ?? 'nincs_adat', vevo: customerLabel(inv, privateLabel) };
    });
}

/** Title + body of an in-app invoice_new row for these items (the variant and params of texts()). */
export async function invoiceNotificationContent(deps: Deps, items: Item[]): Promise<{ variant: string; params: Record<string, string | number>; title: string; body: string }> {
  const t = await texts(deps, items, true);
  const key = t.variant === 'alap' ? 'notif.invoice_new' : `notif.invoice_new.${t.variant}`;
  return { variant: t.variant, params: t.params, title: await deps.content.render(`${key}.title`, t.params), body: await deps.content.render(`${key}.body`, t.params) };
}

/**
 * Data step (round 2 of 11-19): re-renders the in-app invoice_new rows of the DEMO users from the current reserves, so a
 * row written with a literal or an older engine value says what the invoice page says. Only rows that list their
 * invoices in data.items; title, body and data.items change, nothing else (no push, no e-mail).
 */
export async function rerenderInvoiceNotifications(deps: Deps, o: { emailDomain: string }): Promise<number> {
  const db = deps.db;
  const rows = await db
    .select({ n: notifications, clientId: clients.id })
    .from(notifications)
    .innerJoin(clients, eq(clients.userId, notifications.userId))
    .where(and(eq(notifications.kind, 'invoice_new'), sql`exists (select 1 from users u where u.id = ${notifications.userId} and u.email like ${`%@${o.emailDomain}`})`));
  let n = 0;
  for (const { n: row, clientId } of rows) {
    const ids = (((row.data as { items?: { navInvoiceId: string }[] } | null)?.items ?? []) as { navInvoiceId: string }[]).map((i) => i.navInvoiceId);
    if (!ids.length) continue;
    const invs = await db.select().from(navInvoices).where(inArray(navInvoices.id, ids));
    if (!invs.length) continue;
    const items = await invoiceItems(deps, clientId, invs);
    const c = await invoiceNotificationContent(deps, items);
    if (c.title === row.title && c.body === row.body) continue;
    await db
      .update(notifications)
      .set({ title: c.title, body: c.body, data: { ...((row.data ?? {}) as Record<string, unknown>), items, variant: c.variant } })
      .where(eq(notifications.id, row.id));
    n++;
  }
  return n;
}

export function payerKindOf(inv: Pick<InvRow, 'customerVatStatus' | 'data' | 'customerTaxNumber'>): 'maganszemely' | 'kifizeto' | 'kulfoldi_kifizeto' | 'ismeretlen' {
  const vat = inv.customerVatStatus ?? ((inv.data as { customer?: { vatStatus?: string } } | null)?.customer?.vatStatus ?? null);
  if (vat === 'PRIVATE_PERSON') return 'maganszemely';
  if (vat === 'DOMESTIC') return 'kifizeto';
  if (vat === 'OTHER') return 'kulfoldi_kifizeto';
  return 'ismeretlen';
}

/** Pushes already sent today (Budapest day) of this kind to this user. */
async function pushesToday(deps: Deps, userId: string): Promise<number> {
  const start = budapestLocalToUtc(todayBudapest(deps.now()), '00:00');
  const [n] = await deps.db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, 'invoice_new'), eq(notifications.wantPush, true), gte(notifications.createdAt, start)));
  return Number(n?.n ?? 0);
}

async function texts(deps: Deps, items: Item[], showAmounts: boolean): Promise<{ variant: string; params: Record<string, string | number>; pushText: { title: string; body: string } | null }> {
  const sum = items.reduce((a, i) => a + i.amountHuf, 0);
  const felre = items.reduce((a, i) => a + i.reserveHuf, 0);
  let variant: string;
  let params: Record<string, string | number>;
  if (items.length === 1) {
    const i = items[0]!;
    variant = i.reserveHuf <= 0 ? 'adomentes' : i.crossesTaxFree ? 'kuszob' : 'alap';
    // "Bodza Kiadó Kft." + the template's own period: never "Kft.."
    params = { osszeg: fmt(i.amountHuf), vevo: i.vevo.replace(/\.$/, ''), felre: fmt(i.reserveHuf) };
  } else {
    variant = felre > 0 ? 'tobb' : 'tobb_adomentes';
    params = { n: items.length, osszeg: fmt(sum), felre: fmt(felre) };
  }
  let pushText: { title: string; body: string } | null = null;
  if (!showAmounts) {
    pushText = {
      title: await deps.content.render(items.length > 1 ? 'notif.invoice_new.rejtett.title_tobb' : 'notif.invoice_new.rejtett.title', { n: items.length }),
      body: await deps.content.get('notif.invoice_new.rejtett.body'),
    };
  }
  return { variant, params, pushText };
}

async function sendOrFold(deps: Deps, userId: string, items: Item[]): Promise<void> {
  const db = deps.db;
  const settings = await notificationSettingsOf(db, userId);
  // fold into an unread row of the last 20 h whose push has not gone out yet
  const since = new Date(deps.now().getTime() - INVOICE_NOTIFY_RULES.foldInHours * 3600_000);
  const [open] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, 'invoice_new'), gte(notifications.createdAt, since), isNull(notifications.pushSentAt), eq(notifications.wantPush, true), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  if (open) {
    const prevItems = ((open.data as { items?: Item[] } | null)?.items ?? []) as Item[];
    const all = [...prevItems, ...items.filter((i) => !prevItems.some((p) => p.navInvoiceId === i.navInvoiceId))];
    const t = await texts(deps, all, settings.pushShowAmounts);
    const key = t.variant === 'alap' ? 'notif.invoice_new' : `notif.invoice_new.${t.variant}`;
    await db
      .update(notifications)
      .set({
        title: await deps.content.render(`${key}.title`, t.params),
        body: await deps.content.render(`${key}.body`, t.params),
        link: all.length > 1 ? '/felretesz' : `/szamla/${all[0]!.navInvoiceId}`,
        data: { ...((open.data ?? {}) as Record<string, unknown>), items: all, variant: t.variant, ...(t.pushText ? { pushTitle: t.pushText.title, pushBody: t.pushText.body } : { pushTitle: null, pushBody: null }) },
        readAt: null,
      })
      .where(eq(notifications.id, open.id));
    for (const i of items) await db.update(navInvoices).set({ notificationId: open.id, notifyState: prevItems.length ? 'osszevonva' : 'kuldve' }).where(eq(navInvoices.id, i.navInvoiceId));
    return;
  }
  const t = await texts(deps, items, settings.pushShowAmounts);
  const tooMany = (await pushesToday(deps, userId)) >= INVOICE_NOTIFY_RULES.maxPushPerDay;
  const id = await notify(deps, db, {
    userId,
    kind: 'invoice_new',
    ...(t.variant !== 'alap' ? { variant: t.variant } : {}),
    params: { ...t.params, appUrl: deps.cfg.appPublicUrl },
    link: items.length > 1 ? '/felretesz' : `/szamla/${items[0]!.navInvoiceId}`,
    data: { items, variant: t.variant },
    ...(t.pushText ? { pushText: t.pushText } : {}),
    ...(tooMany ? { noPush: true } : {}),
    emailBodyKey: t.variant === 'alap' ? 'email.invoice_new.body' : `email.invoice_new.${t.variant}.body`,
  });
  if (id) for (const i of items) await db.update(navInvoices).set({ notificationId: id }).where(eq(navInvoices.id, i.navInvoiceId));
}
