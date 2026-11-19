// Requests both ways, certificate requests and messages (SPEC §5.7, §6.4).
import { and, asc, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import type { Message, RequestSummary } from '../_shared/api.js';
import type { RequestStatus } from '../_shared/enums.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, certificateRequests, documents, files, messageAttachments, messages, requests, teamMembers, users } from '../db/schema.js';
import { listItems } from './documents.js';
import { todayBudapest } from '../lib/dates.js';

export type RequestRow = typeof requests.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

export const REQUEST_TYPE_TITLES: Record<string, string> = {
  jovedelemigazolas: 'Jövedelemigazolás',
  nullas_igazolas: 'Nullás igazolás',
  koztartozasmentes_igazolas: 'Köztartozásmentességi igazolás',
  adatvaltozas: 'Megváltozott egy adatom',
  tevekenysegvaltozas: 'Változik a tevékenységem',
  kerdes: 'Kérdés',
  dokumentum: 'Irat feltöltése',
  adat: 'Adat megadása',
  egyeb: 'Egyéb',
};

export type Viewer = 'client' | 'accountant';

export function requestStatusLabel(s: RequestStatus, direction: 'konyvelotol' | 'ugyfeltol', firstName: string, viewer: Viewer = 'client'): string {
  const acc = viewer === 'accountant';
  switch (s) {
    case 'nyitott':
      if (acc) return direction === 'konyvelotol' ? 'Az ügyfélre vár' : 'Még nem nézted meg';
      return direction === 'konyvelotol' ? 'Rád vár' : `${firstName} még nem nézte meg`;
    case 'folyamatban':
      if (acc) return direction === 'konyvelotol' ? 'Folyamatban' : 'Dolgozol rajta';
      return direction === 'konyvelotol' ? 'Folyamatban' : `${firstName} látta, dolgozik rajta`;
    case 'teljesitve':
      return 'Kész';
    case 'elutasitva':
      return 'Nem teljesíthető';
    case 'visszavonva':
      return 'Visszavonva';
  }
}

/** RequestSummary + the closing note and time (shared/src/api.ts gets the same optional fields). */
export type RequestSummaryOut = RequestSummary & { statusNote?: string; completedAt?: string };

export async function requestSummary(db: DbOrTx, r: RequestRow, firstName: string, viewer: Viewer = 'client'): Promise<RequestSummaryOut> {
  const [cert] = await db.select().from(certificateRequests).where(eq(certificateRequests.requestId, r.id)).limit(1);
  const out: RequestSummaryOut = {
    id: r.id,
    direction: r.direction,
    type: r.type as RequestSummary['type'],
    title: r.title,
    body: r.body,
    status: r.status,
    statusLabel: requestStatusLabel(r.status, r.direction, firstName, viewer),
    ...(r.dueDate ? { dueDate: r.dueDate } : {}),
    createdAt: r.createdAt.toISOString(),
    ...(r.dossierMonth ? { dossierMonth: r.dossierMonth } : {}),
    ...(cert ? { certificate: { certificateType: cert.certificateType, year: cert.year ?? undefined, purpose: cert.purpose, language: cert.language, ...(cert.submittedToNavAt ? { submittedToNavAt: todayBudapest(cert.submittedToNavAt) } : {}) } } : {}),
    ...(r.resultDocumentId ? { resultDocumentId: r.resultDocumentId } : {}),
    // The answer / reason written when the request was closed ("Október 3-án kezdtem.", "Nem lehet, mert …").
    ...(r.statusNote && r.status !== 'nyitott' ? { statusNote: r.statusNote } : {}),
    ...(r.completedAt ? { completedAt: r.completedAt.toISOString() } : {}),
  };
  return out;
}

/** A closing note also goes into the message thread, bound to the request, so the other side sees it. */
export async function postRequestNote(
  db: DbOrTx,
  o: { clientId: string; requestId: string; senderUserId: string; senderRole: 'client' | 'accountant'; title: string; note: string; rejected?: boolean; now: Date },
): Promise<void> {
  const body = o.rejected ? `Nem tudom teljesíteni (${o.title}): ${o.note}` : `${o.title}: ${o.note}`;
  await db.insert(messages).values({
    clientId: o.clientId,
    senderUserId: o.senderUserId,
    senderRole: o.senderRole,
    kind: 'szoveg',
    body,
    requestId: o.requestId,
    ...(o.senderRole === 'client' ? { readByClientAt: o.now } : { readByAccountantAt: o.now }),
  });
}

/**
 * "Anna · ügyfélszolgálat" for team messages, the accountant's display name for his (SPEC §26.4).
 */
async function senderNames(db: DbOrTx, rows: MessageRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const teamIds = [...new Set(rows.filter((r) => r.senderRole === 'csapat' && r.senderUserId).map((r) => r.senderUserId!))];
  const accIds = [...new Set(rows.filter((r) => r.senderRole === 'accountant' && r.senderUserId).map((r) => r.senderUserId!))];
  if (teamIds.length) {
    const tms = await db.select().from(teamMembers).where(inArray(teamMembers.userId, teamIds));
    const us = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, teamIds));
    for (const id of teamIds) {
      const tm = tms.find((t) => t.userId === id);
      const dn = us.find((u) => u.id === id)?.displayName ?? '';
      const first = tm?.firstName ?? (dn.trim().split(/\s+/).pop() || 'Kollégánk');
      out.set(id, `${first} · ügyfélszolgálat`);
    }
  }
  if (accIds.length) {
    const accs = await db.select({ userId: accountants.userId, displayName: accountants.displayName }).from(accountants).where(inArray(accountants.userId, accIds));
    for (const a of accs) out.set(a.userId, a.displayName);
  }
  return out;
}

/** Message DTO from the viewer's perspective (`en` = the caller). */
export async function messageDtos(db: DbOrTx, rows: MessageRow[], viewerRole: 'client' | 'accountant' | 'csapat', firstName: string, viewerUserId?: string): Promise<Message[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const atts = await db
    .select({ messageId: messageAttachments.messageId, fileId: messageAttachments.fileId, displayName: messageAttachments.displayName, mime: files.mime })
    .from(messageAttachments)
    .innerJoin(files, eq(files.id, messageAttachments.fileId))
    .where(inArray(messageAttachments.messageId, ids));
  const reqIds = rows.map((r) => r.requestId).filter((x): x is string => Boolean(x));
  const reqRows = reqIds.length ? await db.select().from(requests).where(inArray(requests.id, reqIds)) : [];
  const reqMap = new Map<string, RequestSummary>();
  for (const r of reqRows) reqMap.set(r.id, await requestSummary(db, r, firstName, viewerRole === 'csapat' ? 'accountant' : viewerRole));
  const docIds = rows.map((r) => r.documentId).filter((x): x is string => Boolean(x));
  // Defence in depth: a message only ever shows a document of its own client, and a client never sees an
  // accountant-only document.
  const docRowsAll = docIds.length ? await db.select().from(documents).where(and(inArray(documents.id, docIds), isNull(documents.deletedAt))) : [];
  const docRows = docRowsAll.filter((d) => rows.some((r) => r.documentId === d.id && r.clientId === d.clientId) && (viewerRole === 'accountant' || d.visibility === 'kozos'));
  // The team sees a linked document only as a title (never the dossier): no document cards for 'csapat'.
  const docItems = viewerRole === 'csapat' ? [] : await listItems(db, docRows, { firstName, staff: viewerRole === 'accountant' });
  const names = await senderNames(db, rows);
  const docMap = new Map(docItems.map((d) => [d.id, d]));
  return rows.map((r) => {
    const mine =
      (viewerRole === 'client' && r.senderRole === 'client') ||
      (viewerRole === 'accountant' && r.senderRole === 'accountant') ||
      (viewerRole === 'csapat' && r.senderRole === 'csapat' && Boolean(viewerUserId) && r.senderUserId === viewerUserId);
    const sender: Message['sender'] = r.senderRole === 'system' ? 'rendszer' : mine ? 'en' : r.senderRole === 'accountant' ? 'konyvelo' : r.senderRole === 'csapat' ? 'csapat' : 'ugyfel';
    const senderName = r.senderUserId && (r.senderRole === 'csapat' || r.senderRole === 'accountant') ? names.get(r.senderUserId) : undefined;
    return {
      id: r.id,
      kind: r.kind,
      body: r.body,
      sender,
      ...(senderName ? { senderName } : {}),
      createdAt: r.createdAt.toISOString(),
      attachments: atts.filter((a) => a.messageId === r.id).map((a) => ({ fileId: a.fileId, displayName: a.displayName, mime: a.mime })),
      ...(r.requestId && reqMap.get(r.requestId) && viewerRole !== 'csapat' ? { request: reqMap.get(r.requestId)! } : {}),
      ...(r.documentId && docMap.get(r.documentId) ? { document: docMap.get(r.documentId)! } : {}),
      ...(r.readByAccountantAt ? { readByAccountantAt: r.readByAccountantAt.toISOString() } : {}),
      ...(r.readByClientAt ? { readByClientAt: r.readByClientAt.toISOString() } : {}),
    };
  });
}

/** Cursor = createdAt ISO + '|' + id of the last item (newest first). */
export async function messagePage(db: DbOrTx, clientId: string, cursor: string | undefined, limit: number) {
  let cond = and(eq(messages.clientId, clientId), isNull(messages.deletedAt));
  if (cursor) {
    const [at] = cursor.split('|');
    const d = new Date(at ?? '');
    if (!Number.isNaN(d.getTime())) cond = and(cond, lt(messages.createdAt, d));
  }
  const rows = await db.select().from(messages).where(cond).orderBy(desc(messages.createdAt), desc(messages.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? `${page[page.length - 1]!.createdAt.toISOString()}|${page[page.length - 1]!.id}` : null;
  return { rows: page, nextCursor: next };
}

export async function openRequestsFromAccountant(db: DbOrTx, clientId: string): Promise<RequestRow[]> {
  return db
    .select()
    .from(requests)
    .where(and(eq(requests.clientId, clientId), eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban'])))
    .orderBy(asc(requests.dueDate), asc(requests.createdAt));
}
