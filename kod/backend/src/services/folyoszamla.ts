// SPEC §32.B – NAV-folyószámla (adószámla) egyeztetése, recorded by hand (terv 4.4; NAV M2M later, F4). The accountant
// types the NAV balance per adónem (+ tartozás / − túlfizetés), the app shows what it expects (due, not marked / marked,
// not verified), and the accountant may tick the payments he SAW on the extract – each with the day and amount of the
// statement row (critique 2.4: never ticked by default; a 0 or negative balance proves nothing about one item; "rendben"
// only when the amount equals the item, otherwise "eltérés"). 224 (bírság) and 226 (mulasztási bírság) are rows too.
// "Szólok az ügyfélnek" makes a request in the app – never an automatic client notice. Nothing is deleted.
import { and, asc, desc, eq, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  FOLYOSZAMLA_TEXTS,
  NAV_ADONEMEK,
  NAV_ADONEM_KEYS,
  RECON_FOLLOW_UPS,
  RECON_STATUSES,
  EV_RULES,
  type ReconBalanceView,
  type ReconciliationInput,
  type ReconciliationView,
  type ReconExpectedView,
  type ReconStatus,
} from '../_shared/eves.js';
import { ADONEM_BY_ITEM_KIND } from '../_shared/eves.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountReconciliations, clients, clientTaxProfiles, documents, requests, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, huDayMonth, todayBudapest } from '../lib/dates.js';
import { addWorkingDays, nextWorkingDay } from '../lib/munkanap.js';
import { E } from '../lib/errors.js';
import { notify, accountantParams } from '../notify/notify.js';
import { clientName, type ClientRow } from './people.js';
import { staffRefs } from './team.js';
import { periodLabel, periodVisible, verifyPayment } from './tax.js';

export type ReconRow = typeof accountReconciliations.$inferSelect;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'ÉÉÉÉ-HH-NN alakban.' });
const huf = z.number().int().min(-1_000_000_000).max(1_000_000_000);

export const reconciliationSchema = z.strictObject({
  kind: z.enum(['rendes', 'nyito']).optional(),
  asOf: day,
  periodEnd: day.nullish(),
  balances: z
    .array(z.strictObject({ adonem: z.string().trim().regex(/^(\d{3}|egyeb)$/, { error: 'Háromjegyű adónemkód kell.' }), label: z.string().trim().max(60).nullish(), balanceHuf: huf, pendingHuf: huf.nullish() }))
    .min(1)
    .max(20),
  status: z.enum(RECON_STATUSES),
  seen: z
    .array(z.strictObject({ itemId: z.string().uuid(), paidOn: day, amountHuf: z.number().int().min(0).max(1_000_000_000), verification: z.enum(['rendben', 'elteres']), note: z.string().trim().max(300).nullish() }))
    .max(60)
    .optional(),
  followUp: z.enum(RECON_FOLLOW_UPS).optional(),
  followUpNote: z.string().trim().max(1000).nullish(),
  note: z.string().trim().max(1000).nullish(),
  nextCheckOn: day.nullish(),
  documentId: z.string().uuid().nullish(),
  notifyClient: z.strictObject({ message: z.string().trim().min(5).max(1000), dueOn: day.nullish() }).nullish(),
});

/** The open items of the client: approved, not voided, visible, not verified "rendben" yet. */
async function openItems(db: DbOrTx, clientId: string, asOf: string) {
  return db
    .select({ i: taxPaymentItems, p: taxPeriods })
    .from(taxPaymentItems)
    .innerJoin(taxPeriods, eq(taxPeriods.id, taxPaymentItems.taxPeriodId))
    .where(
      and(
        eq(taxPeriods.clientId, clientId),
        periodVisible,
        eq(taxPeriods.calcStatus, 'jovahagyva'),
        isNull(taxPaymentItems.voidedAt),
        lte(taxPaymentItems.dueDate, asOf),
        sql`${taxPaymentItems.verification} is distinct from 'rendben'`,
      ),
    )
    .orderBy(asc(taxPaymentItems.dueDate));
}

const adonemOf = (i: { adonem: string | null; kind: string }) => i.adonem ?? ADONEM_BY_ITEM_KIND[i.kind] ?? null;

async function isKataClient(db: DbOrTx, clientId: string): Promise<boolean> {
  const [p] = await db.select({ id: clientTaxProfiles.id }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.regime, 'kata'))).limit(1);
  return Boolean(p);
}

/** The default next check [DÁVID D14]: after the next payment day + working days (KATA: the 12th + 5; átalány: + 7). */
export async function nextCheckDefault(db: DbOrTx, clientId: string, asOf: string): Promise<string> {
  const kata = await isKataClient(db, clientId);
  const [next] = await db
    .select({ d: taxPeriods.dueDate })
    .from(taxPeriods)
    .where(and(eq(taxPeriods.clientId, clientId), periodVisible, sql`${taxPeriods.dueDate} > ${asOf}`, ne(taxPeriods.paymentStatus, 'nincs_fizetendo')))
    .orderBy(asc(taxPeriods.dueDate))
    .limit(1);
  // KATA in November: 15 December (the year-end rule, Kata tv. 5. § (1) e))
  if (kata && asOf.slice(5, 7) === '11') return nextWorkingDay(`${asOf.slice(0, 4)}-12-15`);
  if (next) return addWorkingDays(next.d, kata ? EV_RULES.nextCheckWorkingDays.kata : EV_RULES.nextCheckWorkingDays.atalany);
  return addDays(asOf, kata ? 35 : 95);
}

/** GET /acc/clients/:id/reconciliations/expected?asOf= */
export async function expectedView(deps: Deps, db: DbOrTx, cl: Pick<ClientRow, 'id'>, asOf: string): Promise<ReconExpectedView> {
  const rows = await openItems(db, cl.id, asOf);
  const kata = await isKataClient(db, cl.id);
  const per = new Map<string, { unmarked: number; marked: number }>();
  for (const { i } of rows) {
    const a = adonemOf(i) ?? 'egyeb';
    const cur = per.get(a) ?? { unmarked: 0, marked: 0 };
    if (i.markedPaidAt) cur.marked += i.amountHuf;
    else cur.unmarked += i.amountHuf;
    per.set(a, cur);
  }
  const keys = NAV_ADONEM_KEYS.filter((k) => k !== '288' || kata);
  return {
    asOf,
    adonemek: keys.map((k) => ({ adonem: k, label: NAV_ADONEMEK[k], expectedUnmarkedHuf: per.get(k)?.unmarked ?? 0, expectedMarkedHuf: per.get(k)?.marked ?? 0 })),
    openItems: rows.map(({ i, p }) => ({ itemId: i.id, periodId: p.id, periodLabel: periodLabel(p), label: i.label, adonem: adonemOf(i), amountHuf: i.amountHuf, dueDate: i.dueDate, markedPaidOn: i.markedPaidOn ?? null })),
    suggestedNextCheckOn: await nextCheckDefault(db, cl.id, asOf),
    kata,
  };
}

/** The status the numbers suggest (the accountant may change it). */
export function suggestStatus(balances: ReconBalanceView[]): ReconStatus {
  const debt = balances.reduce((a, b) => a + Math.max(0, b.balanceHuf - b.pendingHuf), 0);
  if (debt > 0) return balances.some((b) => b.diffHuf !== 0) ? 'elteres' : 'hatralek';
  if (balances.some((b) => b.balanceHuf < 0)) return 'tulfizetes';
  return 'rendben';
}

/**
 * POST /acc/clients/:id/reconciliations – one transaction: the row, the ticked items ("rendben" from the statement row,
 * via the same verifyPayment as the single "Rendben"), the optional request to the client, the flags follow.
 */
export async function saveReconciliation(deps: Deps, db: DbOrTx, cl: ClientRow, input: ReconciliationInput, actor: { userId: string; role: string }): Promise<ReconRow> {
  const today = todayBudapest(deps.now());
  if (input.asOf > today) throw E.validation({ asOf: 'Jövőbeli napot nem adhatsz meg.' });
  if (input.nextCheckOn && input.nextCheckOn < today) throw E.validation({ nextCheckOn: 'A következő ellenőrzés nem lehet a múltban.' });
  const seenAdonem = new Set<string>();
  for (const b of input.balances) {
    if (b.adonem !== 'egyeb' && seenAdonem.has(b.adonem)) throw E.validation({ balances: `Ez az adónem kétszer szerepel: ${b.adonem}.` });
    seenAdonem.add(b.adonem);
  }
  const exp = await expectedView(deps, db, cl, input.asOf);
  const expBy = new Map(exp.adonemek.map((x) => [x.adonem, x]));
  const balances: ReconBalanceView[] = input.balances.map((b) => {
    const e = expBy.get(b.adonem);
    const pending = b.pendingHuf ?? 0;
    const unmarked = e?.expectedUnmarkedHuf ?? 0;
    return {
      adonem: b.adonem,
      label: b.label?.trim() || (NAV_ADONEMEK as Record<string, string>)[b.adonem] || FOLYOSZAMLA_TEXTS.egyebAdonem,
      balanceHuf: b.balanceHuf,
      pendingHuf: pending,
      expectedUnmarkedHuf: unmarked,
      expectedMarkedHuf: e?.expectedMarkedHuf ?? 0,
      diffHuf: b.balanceHuf - pending - unmarked,
    };
  });
  // the ticked statement rows: only open items of THIS client; "rendben" only with the item's exact amount
  const seen = input.seen ?? [];
  const open = new Map(exp.openItems.map((x) => [x.itemId, x]));
  for (const s of seen) {
    const it = open.get(s.itemId);
    if (!it) throw E.validation({ seen: 'Ez a tétel nem nyitott (vagy nem ehhez az ügyfélhez tartozik).' });
    if (s.paidOn > input.asOf) throw E.validation({ seen: 'A befizetés napja nem lehet a lekérdezés napja után.' });
    if (s.verification === 'rendben' && s.amountHuf !== it.amountHuf) throw E.validation({ seen: FOLYOSZAMLA_TEXTS.osszegElter.replace('{tetel}', String(it.amountHuf).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) });
    if (s.verification === 'elteres' && !s.note?.trim()) throw E.validation({ seen: 'Eltérésnél írd le röviden, mit látsz a kivonaton.' });
  }
  if (seen.length && !cl.accountantId) throw E.conflict('Az ügyfélnek nincs könyvelője.');
  if (input.documentId) {
    const [d] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, input.documentId), eq(documents.clientId, cl.id))).limit(1);
    if (!d) throw E.notFound();
  }
  const now = deps.now();
  const nextCheckOn = input.nextCheckOn === undefined ? await nextCheckDefault(db, cl.id, input.asOf) : input.nextCheckOn;
  const [row] = await db
    .insert(accountReconciliations)
    .values({
      clientId: cl.id,
      kind: input.kind ?? 'rendes',
      source: 'kezi',
      asOf: input.asOf,
      periodEnd: input.periodEnd ?? null,
      balances,
      totalDebtHuf: balances.reduce((a, b) => a + Math.max(0, b.balanceHuf), 0),
      totalOverpaymentHuf: balances.reduce((a, b) => a + Math.max(0, -b.balanceHuf), 0),
      status: input.status,
      followUp: input.followUp ?? 'nincs',
      followUpNote: input.followUpNote ?? null,
      seenRows: seen.map((s) => ({ ...s, note: s.note ?? null })),
      documentId: input.documentId ?? null,
      note: input.note ?? null,
      nextCheckOn: nextCheckOn ?? null,
      checkedBy: actor.userId,
      // created_at: the database clock (the order of two checks of the same day must follow the real order)
    })
    .returning();
  const verified: string[] = [];
  for (const s of seen) {
    const it = open.get(s.itemId)!;
    const [item] = await db.select().from(taxPaymentItems).where(eq(taxPaymentItems.id, s.itemId)).limit(1);
    if (!item) continue;
    const note = `Folyószámla ${huDayMonth(input.asOf)}: befizetés ${huDayMonth(s.paidOn)}, ${s.amountHuf} Ft${s.note ? ` – ${s.note}` : ''}`;
    // javító kör 11-21: an "eltérés" here is never an automatic client notice – "Szólok az ügyfélnek" is the accountant's choice
    await verifyPayment(deps, db, it.periodId, actor.userId, cl.accountantId!, [{ kind: item.kind, verification: s.verification, note }], { notifyClient: s.verification === 'rendben', actorRole: actor.role });
    await db.update(taxPaymentItems).set({ reconciliationId: row!.id }).where(eq(taxPaymentItems.id, s.itemId));
    if (s.verification === 'rendben') verified.push(s.itemId);
  }
  let requestId: string | null = null;
  if (input.notifyClient) {
    const [rq] = await db
      .insert(requests)
      .values({ clientId: cl.id, direction: 'konyvelotol', type: 'egyeb', title: FOLYOSZAMLA_TEXTS.keresCim, body: input.notifyClient.message, dueDate: input.notifyClient.dueOn ?? null, createdBy: actor.userId })
      .returning({ id: requests.id });
    requestId = rq!.id;
    await notify(deps, db, { userId: cl.userId, kind: 'request_new', params: { ...(await accountantParams(db, cl.accountantId)), title: FOLYOSZAMLA_TEXTS.keresCim, body: input.notifyClient.message }, link: '/keresek', data: { requestId } });
  }
  const [u] = await db.update(accountReconciliations).set({ verifiedItemIds: verified, requestId }).where(eq(accountReconciliations.id, row!.id)).returning();
  await audit(db, {
    action: 'reconciliation.saved',
    actorUserId: actor.userId,
    actorRole: actor.role,
    targetType: 'account_reconciliation',
    targetId: row!.id,
    clientId: cl.id,
    details: { status: input.status, adonemek: balances.length, verified: verified.length, mismatched: seen.length - verified.length, request: Boolean(requestId) },
  });
  return u!;
}

/** POST /acc/reconciliations/:id/resolve – "Rendezve" (the backlog was settled). */
export async function resolveReconciliation(deps: Deps, db: DbOrTx, r: ReconRow, note: string | null, actor: { userId: string; role: string }): Promise<ReconRow> {
  if (r.resolvedAt) return r;
  const [u] = await db
    .update(accountReconciliations)
    .set({ resolvedAt: deps.now(), resolvedBy: actor.userId, note: note ? [r.note, note].filter(Boolean).join('\n') : r.note })
    .where(eq(accountReconciliations.id, r.id))
    .returning();
  await audit(db, { action: 'reconciliation.resolved', actorUserId: actor.userId, actorRole: actor.role, targetType: 'account_reconciliation', targetId: r.id, clientId: r.clientId });
  return u!;
}

export async function reconView(db: DbOrTx, r: ReconRow): Promise<ReconciliationView> {
  const refs = await staffRefs(db, [r.checkedBy]);
  return {
    id: r.id,
    kind: r.kind,
    asOf: r.asOf,
    periodEnd: r.periodEnd ?? null,
    balances: r.balances,
    totalDebtHuf: r.totalDebtHuf,
    totalOverpaymentHuf: r.totalOverpaymentHuf,
    status: r.status,
    followUp: r.followUp,
    followUpNote: r.followUpNote ?? null,
    note: r.note ?? null,
    nextCheckOn: r.nextCheckOn ?? null,
    verifiedItems: r.verifiedItemIds.length,
    documentId: r.documentId ?? null,
    requestId: r.requestId ?? null,
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    checkedBy: refs.get(r.checkedBy) ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function reconList(db: DbOrTx, clientId: string): Promise<ReconciliationView[]> {
  const rows = await db.select().from(accountReconciliations).where(eq(accountReconciliations.clientId, clientId)).orderBy(desc(accountReconciliations.asOf), desc(accountReconciliations.createdAt)).limit(50);
  const out: ReconciliationView[] = [];
  for (const r of rows) out.push(await reconView(db, r));
  return out;
}

/** The latest reconciliation of each client (one query). */
export async function latestReconciliations(db: DbOrTx, clientIds: string[]): Promise<Map<string, ReconRow>> {
  const out = new Map<string, ReconRow>();
  if (!clientIds.length) return out;
  const rows = await db.select().from(accountReconciliations).where(inArray(accountReconciliations.clientId, clientIds)).orderBy(desc(accountReconciliations.asOf), desc(accountReconciliations.createdAt));
  for (const r of rows) if (!out.has(r.clientId)) out.set(r.clientId, r);
  return out;
}

/** Flag folyoszamla_elteres: the latest check shows a backlog / difference that is not settled yet. */
export async function reconFlag(db: DbOrTx, clientId: string): Promise<boolean> {
  const r = (await latestReconciliations(db, [clientId])).get(clientId);
  return Boolean(r && (r.status === 'hatralek' || r.status === 'elteres') && !r.resolvedAt);
}

/**
 * Job account_checks (daily 07:30): the latest check of a client says "next check on X" and X has come – one task for the
 * accountant per date (tax_task.folyoszamla; the panel badge and the daily digest).
 */
export async function jobAccountChecks(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const due = await db.select({ clientId: accountReconciliations.clientId }).from(accountReconciliations).where(lte(accountReconciliations.nextCheckOn, today));
  const ids = [...new Set(due.map((d) => d.clientId))];
  const latest = await latestReconciliations(db, ids);
  const { notifyOnce } = await import('./emlekezteto.js');
  const { accountantUserOf } = await import('./team.js');
  let n = 0;
  for (const [clientId, r] of latest) {
    if (!r.nextCheckOn || r.nextCheckOn > today) continue;
    const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!cl || cl.lifecycle === 'megszunt') continue;
    const acc = await accountantUserOf(db, cl);
    if (!acc) continue;
    if (await notifyOnce(deps, `tt:fsz:${clientId}:${r.nextCheckOn}`, { userId: acc.userId, kind: 'tax_task', variant: 'folyoszamla', params: { clientName: clientName(cl), datum: huDayMonth(r.nextCheckOn) }, link: `/ugyfelek/${clientId}/folyoszamla`, data: { clientId } })) n++;
  }
  return n;
}
