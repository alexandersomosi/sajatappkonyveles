// Documents, versions, statuses and the monthly dossier (SPEC §5.5, §6.2, §12.4).
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DocumentDetail, DocumentListItem, DossierView, RequestSummary } from '../_shared/api.js';
import { DOCUMENT_CATEGORY_ICON, DOCUMENT_STATUSES, type DocumentCategory, type DocumentStatus } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients, documents, documentStatusHistory, documentVersions, dossiers, navInvoices, requests, taxPeriods, users } from '../db/schema.js';
import { checkFile, mergeImagesToPdf, pdfPageCount, type IncomingFile, MAX_PAGES } from '../files/upload.js';
import { capitalize, monthLabel, MONTHS_HU } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { accountantPublic, numberWord, type AccountantRow } from './people.js';
import { audit } from '../audit.js';
import { requestSummary } from './requests.js';

export type DocRow = typeof documents.$inferSelect;

export const CATEGORY_TITLES: Record<DocumentCategory, string> = {
  nyugta: 'Nyugta',
  penztargep_osszesito: 'Pénztárgép havi összesítő',
  bankszamlakivonat: 'Bankszámlakivonat',
  szerzodes: 'Szerződés',
  koltseg_bizonylat: 'Költségbizonylat',
  kiallitott_szamla_kezi: 'Kézzel kiállított számla',
  nav_level: 'Levél a NAV-tól',
  bevallas: 'Bevallás',
  nav_visszaigazolas: 'NAV visszaigazolás',
  igazolas: 'Igazolás',
  meghatalmazas: 'Meghatalmazás',
  szerzodes_alairt: 'Aláírt szerződés',
  egyeb: 'Egyéb irat',
  ev_bejelentes: 'NAV-igazolás a vállalkozás bejelentéséről',
  adoszamla_kivonat: 'NAV-folyószámla kivonat',
};

export function statusLabel(s: DocumentStatus, firstName: string, nav = false): string {
  if (s === 'feltoltve') return nav ? 'Letöltöttük' : 'Feltöltve';
  if (s === 'konyvelo_latta') return `${firstName} látta`;
  if (s === 'feldolgozva') return 'Feldolgozva';
  return 'Beadva';
}

export async function ensureDossier(db: DbOrTx, clientId: string, month: string): Promise<void> {
  await db.insert(dossiers).values({ clientId, month }).onConflictDoNothing();
}

export interface DocItemsCtx {
  firstName: string;
  staff: boolean;
}

export async function listItems(db: DbOrTx, rows: DocRow[], ctx: DocItemsCtx): Promise<DocumentListItem[]> {
  if (!rows.length) return [];
  const verIds = rows.map((r) => r.currentVersionId).filter((x): x is string => Boolean(x));
  const vers = verIds.length ? await db.select().from(documentVersions).where(inArray(documentVersions.id, verIds)) : [];
  const vmap = new Map(vers.map((v) => [v.id, v]));
  // Staff: a tax document that arrived after its quarter was filed gets a flag ("beadás után érkezett").
  const filed = new Map<string, Date>();
  if (ctx.staff) {
    const clientIds = [...new Set(rows.map((r) => r.clientId))];
    const ps = await db
      .select({ clientId: taxPeriods.clientId, periodKey: taxPeriods.periodKey, filedAt: taxPeriods.filedAt })
      .from(taxPeriods)
      .where(and(inArray(taxPeriods.clientId, clientIds), eq(taxPeriods.kind, 'negyedev'), eq(taxPeriods.filingStatus, 'beadva')));
    for (const p of ps) if (p.filedAt) filed.set(`${p.clientId}|${p.periodKey}`, p.filedAt);
  }
  const afterFiling = (r: DocRow): boolean => {
    if (!AFTER_FILING_CATEGORIES.has(r.category)) return false;
    const q = Math.floor((Number(r.dossierMonth.slice(5, 7)) - 1) / 3) + 1;
    const at = filed.get(`${r.clientId}|${r.dossierMonth.slice(0, 4)}-Q${q}`);
    return Boolean(at && r.createdAt > at);
  };
  return rows.map((r) => {
    const v = r.currentVersionId ? vmap.get(r.currentVersionId) : undefined;
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      source: r.source,
      status: r.status,
      statusLabel: statusLabel(r.status, ctx.firstName),
      statusAt: r.statusChangedAt.toISOString(),
      dossierMonth: r.dossierMonth,
      icon: DOCUMENT_CATEGORY_ICON[r.category],
      pageCount: v?.pageCount ?? 1,
      ...(r.amountHuf !== null ? { amountHuf: r.amountHuf } : {}),
      ...(v?.thumbFileId ? { thumbFileId: v.thumbFileId } : {}),
      ...(ctx.staff ? { visibility: r.visibility } : {}),
      ...(ctx.staff && afterFiling(r) ? { afterFiling: true } : {}),
    };
  });
}

/** Tax-relevant categories (same list as services/tax.ts FILING_DOC_CATEGORIES). */
const AFTER_FILING_CATEGORIES = new Set<string>(['nyugta', 'penztargep_osszesito', 'bankszamlakivonat', 'koltseg_bizonylat', 'kiallitott_szamla_kezi']);

export interface NewDocInput {
  clientId: string;
  source: 'ugyfel' | 'konyvelo' | 'nav' | 'rendszer';
  category: DocumentCategory;
  dossierMonth: string;
  title?: string | null;
  note?: string | null;
  visibility?: 'kozos' | 'csak_konyvelo';
  status?: DocumentStatus;
  relatedRequestId?: string | null;
  createdBy: string | null;
  files: IncomingFile[];
  pages: IncomingFile[];
  actorRole: string;
  amountHuf?: number | null;
  documentDate?: string | null;
}

/** Stores the upload (merging photos into one PDF), returns the version fields. */
async function storeVersionFile(deps: Deps, db: DbOrTx, clientId: string, title: string, files: IncomingFile[], pages: IncomingFile[], createdBy: string | null) {
  if (files.length && pages.length) throw E.validation({ file: 'Vagy egy fájlt, vagy fotókat küldj, a kettőt együtt nem.' });
  if (!files.length && !pages.length) throw E.validation({ file: 'Nincs csatolt fájl.' });
  if (files.length > 1) throw E.validation({ file: 'Egyszerre egy fájlt tölts fel.' });
  if (pages.length > MAX_PAGES) throw E.validation({ pages: `Legfeljebb ${MAX_PAGES} oldal lehet egy iratban.` });
  if (pages.length) {
    const imgs = pages.map((p) => checkFile(p, ['image/jpeg', 'image/png']));
    let fileRow;
    let pageCount = imgs.length;
    if (imgs.length === 1) {
      fileRow = await deps.storage.put(db, { ownerClientId: clientId, kind: 'dokumentum', mime: imgs[0]!.mime, displayName: imgs[0]!.displayName, data: imgs[0]!.data, createdBy, now: deps.now() });
    } else {
      const pdf = await mergeImagesToPdf(imgs, title, `client:${clientId}`);
      fileRow = await deps.storage.put(db, { ownerClientId: clientId, kind: 'dokumentum', mime: 'application/pdf', displayName: `${title.slice(0, 100)}.pdf`, data: pdf, createdBy, now: deps.now() });
      pageCount = imgs.length;
    }
    const thumb = await deps.storage.put(db, { ownerClientId: clientId, kind: 'thumb', mime: imgs[0]!.mime, displayName: 'elonezet', data: imgs[0]!.data, createdBy, now: deps.now() });
    return { fileId: fileRow.id, pageCount, thumbFileId: thumb.id };
  }
  const f = checkFile(files[0]!);
  const pageCount = f.mime === 'application/pdf' ? await pdfPageCount(f.data) : 1;
  const fileRow = await deps.storage.put(db, { ownerClientId: clientId, kind: 'dokumentum', mime: f.mime, displayName: f.displayName, data: f.data, createdBy, now: deps.now() });
  let thumbFileId: string | null = null;
  if (f.mime !== 'application/pdf') thumbFileId = fileRow.id;
  return { fileId: fileRow.id, pageCount, thumbFileId };
}

export async function createDocument(deps: Deps, db: DbOrTx, i: NewDocInput): Promise<DocRow> {
  const title = (i.title?.trim() || CATEGORY_TITLES[i.category]).slice(0, 120);
  const stored = await storeVersionFile(deps, db, i.clientId, title, i.files, i.pages, i.createdBy);
  await ensureDossier(db, i.clientId, i.dossierMonth);
  const now = deps.now();
  const [doc] = await db
    .insert(documents)
    .values({
      clientId: i.clientId,
      dossierMonth: i.dossierMonth,
      source: i.source,
      category: i.category,
      title,
      status: i.status ?? 'feltoltve',
      statusChangedAt: now,
      visibility: i.visibility ?? 'kozos',
      clientNote: i.source === 'ugyfel' ? (i.note?.slice(0, 1000) ?? null) : null,
      accountantComment: i.source === 'konyvelo' ? (i.note?.slice(0, 1000) ?? null) : null,
      relatedRequestId: i.relatedRequestId ?? null,
      createdBy: i.createdBy,
      amountHuf: i.amountHuf ?? null,
      documentDate: i.documentDate ?? null,
    })
    .returning();
  const [ver] = await db
    .insert(documentVersions)
    .values({ documentId: doc!.id, versionNo: 1, fileId: stored.fileId, pageCount: stored.pageCount, thumbFileId: stored.thumbFileId, uploadedBy: i.createdBy })
    .returning({ id: documentVersions.id });
  await db.update(documents).set({ currentVersionId: ver!.id }).where(eq(documents.id, doc!.id));
  await db.insert(documentStatusHistory).values({ documentId: doc!.id, fromStatus: null, toStatus: doc!.status, changedBy: i.createdBy, changedAt: now });
  await audit(db, { action: 'document.uploaded', actorUserId: i.createdBy, actorRole: i.actorRole, targetType: 'document', targetId: doc!.id, clientId: i.clientId, details: { category: i.category, pages: stored.pageCount, version: 1 } });
  return { ...doc!, currentVersionId: ver!.id };
}

export async function addVersion(deps: Deps, db: DbOrTx, doc: DocRow, files: IncomingFile[], pages: IncomingFile[], by: string, actorRole: string, note?: string | null): Promise<DocRow> {
  const stored = await storeVersionFile(deps, db, doc.clientId, doc.title, files, pages, by);
  const [last] = await db.select({ n: documentVersions.versionNo }).from(documentVersions).where(eq(documentVersions.documentId, doc.id)).orderBy(desc(documentVersions.versionNo)).limit(1);
  const versionNo = (last?.n ?? 0) + 1;
  const [ver] = await db
    .insert(documentVersions)
    .values({ documentId: doc.id, versionNo, fileId: stored.fileId, pageCount: stored.pageCount, thumbFileId: stored.thumbFileId, uploadedBy: by, note: note?.slice(0, 500) ?? null })
    .returning({ id: documentVersions.id });
  const now = deps.now();
  const [updated] = await db
    .update(documents)
    .set({ currentVersionId: ver!.id, status: 'feltoltve', statusChangedAt: now, updatedAt: now })
    .where(eq(documents.id, doc.id))
    .returning();
  if (doc.status !== 'feltoltve') await db.insert(documentStatusHistory).values({ documentId: doc.id, fromStatus: doc.status, toStatus: 'feltoltve', changedBy: by, note: 'Új változat' });
  await audit(db, { action: 'document.uploaded', actorUserId: by, actorRole, targetType: 'document', targetId: doc.id, clientId: doc.clientId, details: { version: versionNo, pages: stored.pageCount } });
  return updated!;
}

export async function setStatus(deps: Deps, db: DbOrTx, doc: DocRow, to: DocumentStatus, by: string | null, note?: string | null): Promise<DocRow> {
  if (doc.status === to) return doc;
  const from = DOCUMENT_STATUSES.indexOf(doc.status);
  const target = DOCUMENT_STATUSES.indexOf(to);
  if (target < from - 1) throw E.validation({ status: 'Egyszerre csak egy lépést lehet visszalépni.' });
  if (target < from && !note?.trim()) throw E.validation({ statusNote: 'Visszalépésnél írj megjegyzést az ügyfélnek.' });
  const now = deps.now();
  const [u] = await db.update(documents).set({ status: to, statusChangedAt: now, updatedAt: now }).where(eq(documents.id, doc.id)).returning();
  await db.insert(documentStatusHistory).values({ documentId: doc.id, fromStatus: doc.status, toStatus: to, changedBy: by, changedAt: now, note: note?.slice(0, 500) ?? null });
  await audit(db, { action: 'document.status_changed', actorUserId: by, actorRole: by ? 'accountant' : 'system', targetType: 'document', targetId: doc.id, clientId: doc.clientId, details: { from: doc.status, to } });
  return u!;
}

export async function documentDetail(db: DbOrTx, doc: DocRow, firstName: string, staff: boolean): Promise<DocumentDetail> {
  const [item] = await listItems(db, [doc], { firstName, staff });
  // Who did it, from the viewer's side: the client sees "te" and the accountant's name; the
  // accountant sees the client's first name and "te" for himself.
  const [owner] = staff ? await db.select({ firstName: clients.firstName }).from(clients).where(eq(clients.id, doc.clientId)).limit(1) : [];
  const vers = await db.select().from(documentVersions).where(eq(documentVersions.documentId, doc.id)).orderBy(asc(documentVersions.versionNo));
  const hist = await db
    .select({ h: documentStatusHistory, role: users.role, name: users.displayName })
    .from(documentStatusHistory)
    .leftJoin(users, eq(users.id, documentStatusHistory.changedBy))
    .where(eq(documentStatusHistory.documentId, doc.id))
    .orderBy(asc(documentStatusHistory.changedAt), sql`${documentStatusHistory.fromStatus} is not null`);
  return {
    ...item!,
    // For optimistic concurrency (PATCH /acc/documents/:id expectedUpdatedAt).
    ...(staff ? { updatedAt: doc.updatedAt.toISOString() } : {}),
    versions: vers.map((v) => ({ id: v.id, versionNo: v.versionNo, fileId: v.fileId, pageCount: v.pageCount, createdAt: v.createdAt.toISOString() })),
    history: hist.map((x) => ({
      status: x.h.toStatus,
      label: statusLabel(x.h.toStatus, firstName),
      at: x.h.changedAt.toISOString(),
      by: staff
        ? x.role === 'client'
          ? (owner?.firstName ?? 'az ügyfél')
          : x.role === 'accountant' || x.role === 'admin'
            ? 'te'
            : undefined
        : x.role === 'client'
          ? 'te'
          : x.role === 'accountant'
            ? firstName
            : x.h.changedBy
              ? (x.name ?? undefined)
              : undefined,
    })),
    accountantComment: doc.accountantComment ?? undefined,
    clientNote: doc.clientNote ?? undefined,
    documentDate: doc.documentDate ?? undefined,
    relatedRevenueMonth: doc.amountHuf !== null ? doc.dossierMonth : undefined,
    ...(doc.amountHuf !== null ? { amountHuf: doc.amountHuf } : {}),
  };
}

export async function dossierMonths(db: DbOrTx, clientId: string, year: number, staff: boolean, today: string) {
  const vis = staff ? sql`true` : sql`${documents.visibility} = 'kozos'`;
  const docRows = await db
    .select({ month: documents.dossierMonth, n: sql<number>`count(*)::int`, waiting: sql<number>`count(*) filter (where ${documents.status} = 'feltoltve')::int` })
    .from(documents)
    .where(and(eq(documents.clientId, clientId), isNull(documents.deletedAt), sql`${documents.dossierMonth} like ${`${year}-%`}`, vis))
    .groupBy(documents.dossierMonth);
  const navRows = await db
    .select({ month: navInvoices.dossierMonth, n: sql<number>`count(*)::int` })
    .from(navInvoices)
    .where(and(eq(navInvoices.clientId, clientId), sql`${navInvoices.dossierMonth} like ${`${year}-%`}`))
    .groupBy(navInvoices.dossierMonth);
  const dRows = await db.select({ month: dossiers.month }).from(dossiers).where(and(eq(dossiers.clientId, clientId), sql`${dossiers.month} like ${`${year}-%`}`));
  const months = new Set<string>([...docRows.map((r) => r.month), ...navRows.map((r) => r.month), ...dRows.map((r) => r.month)]);
  const curMonth = today.slice(0, 7);
  if (curMonth.startsWith(String(year))) months.add(curMonth);
  return [...months]
    .sort()
    .reverse()
    .map((month) => {
      const d = docRows.find((r) => r.month === month);
      const n = navRows.find((r) => r.month === month);
      return { month, label: monthLabel(month), documentCount: d?.n ?? 0, waitingCount: d?.waiting ?? 0, navInvoiceCount: n?.n ?? 0 };
    });
}

/** "2 irat és 4 kiállított számla" (SPEC §27.5.2 INVOICE_WORDING.countPart). */
function countText(docs: number, invoices: number): string {
  const parts: string[] = [];
  if (docs) parts.push(`${docs} irat`);
  if (invoices) parts.push(`${invoices} kiállított számla`);
  return parts.join(' és ');
}

/**
 * Headline of a month: documents AND NAV invoices count; "mindet látta" only when every item is at
 * least "konyvelo_latta" (an invoice that just arrived from the NAV is not seen yet).
 */
async function headline(deps: Deps, docs: number, invoices: number, waiting: number, acc: AccountantRow | null): Promise<string> {
  const ap = accountantPublic(acc);
  if (docs + invoices === 0) return deps.content.render('ui.dossier.headline_empty', {});
  const ct = countText(docs, invoices);
  if (waiting === 0) return deps.content.render('ui.dossier.headline_all_seen', { count: docs + invoices, countText: capitalize(ct), firstName: ap.firstName });
  return deps.content.render('ui.dossier.headline_waiting', { count: docs + invoices, countText: capitalize(ct), waitingText: numberWord(waiting), firstNameOnto: capitalize(ap.nameForms.onto) });
}

export async function dossierView(deps: Deps, db: DbOrTx, clientId: string, month: string, acc: AccountantRow | null): Promise<DossierView> {
  const ap = accountantPublic(acc);
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.clientId, clientId), eq(documents.dossierMonth, month), isNull(documents.deletedAt), eq(documents.visibility, 'kozos')))
    .orderBy(desc(documents.createdAt));
  const items = await listItems(db, docs, { firstName: ap.firstName, staff: false });
  const byId = new Map(items.map((i) => [i.id, i]));
  // SPEC §26.1.5: the client's own EV bejelentés confirmation is listed with the contracts (no workflow status).
  const isContract = (d: DocRow) => d.category === 'szerzodes_alairt' || d.category === 'ev_bejelentes';
  const sentByMe = docs.filter((d) => d.source === 'ugyfel' && d.category !== 'nav_level' && !isContract(d)).map((d) => byId.get(d.id)!);
  const letters = docs.filter((d) => d.category === 'nav_level').map((d) => byId.get(d.id)!);
  const filed = docs.filter((d) => d.source !== 'ugyfel' && d.category !== 'nav_level' && !isContract(d)).map((d) => byId.get(d.id)!);
  const contracts = docs.filter(isContract).map((d) => byId.get(d.id)!);
  const inv = await db
    .select({ status: navInvoices.status, gross: navInvoices.grossHuf, at: navInvoices.statusChangedAt, demo: navInvoices.demo })
    .from(navInvoices)
    .where(and(eq(navInvoices.clientId, clientId), eq(navInvoices.dossierMonth, month)));
  const minIdx = inv.length ? Math.min(...inv.map((i) => DOCUMENT_STATUSES.indexOf(i.status))) : 0;
  const invStatus = DOCUMENT_STATUSES[minIdx] ?? 'feltoltve';
  const lastAt = inv.length ? new Date(Math.max(...inv.map((i) => i.at.getTime()))) : null;
  const [dos] = await db.select().from(dossiers).where(and(eq(dossiers.clientId, clientId), eq(dossiers.month, month))).limit(1);
  const openReq = await db
    .select()
    .from(requests)
    .where(and(eq(requests.clientId, clientId), eq(requests.dossierMonth, month), inArray(requests.status, ['nyitott', 'folyamatban'])))
    .orderBy(asc(requests.createdAt));
  const workDocs = docs.filter((d) => !isContract(d));
  const waiting = workDocs.filter((d) => d.status === 'feltoltve').length + inv.filter((i) => i.status === 'feltoltve').length;
  const reqs: RequestSummary[] = [];
  for (const r of openReq) reqs.push(await requestSummary(db, r, ap.firstName));
  return {
    month,
    label: monthLabel(month),
    headline: await headline(deps, workDocs.length, inv.length, waiting, acc),
    ...(dos?.reviewedAt
      ? { review: { by: ap, at: dos.reviewedAt.toISOString(), okCount: docs.filter((d) => d.status !== 'feltoltve').length + inv.filter((i) => i.status !== 'feltoltve').length, note: dos.summaryNote ?? undefined } }
      : {}),
    sentByMe,
    fromNav: {
      invoices: {
        count: inv.length,
        status: invStatus,
        statusLabel: statusLabel(invStatus, ap.firstName, true),
        statusAt: lastAt ? lastAt.toISOString() : null,
        totalHuf: inv.reduce((a, b) => a + b.gross, 0),
        demo: inv.some((i) => i.demo),
      },
      letters,
    },
    filedByAccountant: filed,
    contracts,
    openRequests: reqs,
  };
}

export function monthNameAdj(mk: string): string {
  const m = Number(mk.slice(5, 7));
  return `${MONTHS_HU[m - 1]}i`.replace('januári', 'januári');
}

export async function accountantRowForClient(db: DbOrTx, accountantId: string | null): Promise<AccountantRow | null> {
  if (!accountantId) return null;
  const [a] = await db.select().from(accountants).where(eq(accountants.id, accountantId)).limit(1);
  return a ?? null;
}
