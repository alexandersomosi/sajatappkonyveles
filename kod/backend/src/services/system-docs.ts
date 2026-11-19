// Documents created by the system or the seed from a buffer (contracts, demo statements).
import type { DocumentCategory, DocumentStatus } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { documents, documentStatusHistory, documentVersions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { ensureDossier } from './documents.js';

export async function createDocumentFromBuffer(
  deps: Deps,
  db: DbOrTx,
  i: {
    clientId: string;
    category: DocumentCategory;
    title: string;
    month: string;
    data: Buffer;
    mime: 'application/pdf' | 'image/jpeg' | 'image/png';
    fileName: string;
    source: 'ugyfel' | 'konyvelo' | 'nav' | 'rendszer';
    status: DocumentStatus;
    by: string | null;
    visibility?: 'kozos' | 'csak_konyvelo';
    pageCount?: number;
    createdAt?: Date;
    statusAt?: Date;
    clientNote?: string | null;
    accountantComment?: string | null;
    amountHuf?: number | null;
    documentDate?: string | null;
    thumb?: boolean;
  },
): Promise<string> {
  await ensureDossier(db, i.clientId, i.month);
  const file = await deps.storage.put(db, { ownerClientId: i.clientId, kind: 'dokumentum', mime: i.mime, displayName: i.fileName, data: i.data, createdBy: i.by, now: i.createdAt ?? deps.now() });
  const created = i.createdAt ?? deps.now();
  const [doc] = await db
    .insert(documents)
    .values({
      clientId: i.clientId,
      dossierMonth: i.month,
      source: i.source,
      category: i.category,
      title: i.title.slice(0, 120),
      status: i.status,
      statusChangedAt: i.statusAt ?? created,
      visibility: i.visibility ?? 'kozos',
      createdBy: i.by,
      createdAt: created,
      clientNote: i.clientNote ?? null,
      accountantComment: i.accountantComment ?? null,
      amountHuf: i.amountHuf ?? null,
      documentDate: i.documentDate ?? null,
    })
    .returning({ id: documents.id });
  const [ver] = await db
    .insert(documentVersions)
    .values({ documentId: doc!.id, versionNo: 1, fileId: file.id, pageCount: i.pageCount ?? 1, thumbFileId: i.thumb && i.mime !== 'application/pdf' ? file.id : null, uploadedBy: i.by, createdAt: created })
    .returning({ id: documentVersions.id });
  await db.update(documents).set({ currentVersionId: ver!.id }).where(eq(documents.id, doc!.id));
  await db.insert(documentStatusHistory).values({ documentId: doc!.id, fromStatus: null, toStatus: 'feltoltve', changedBy: i.by, changedAt: created });
  if (i.status !== 'feltoltve')
    await db.insert(documentStatusHistory).values({ documentId: doc!.id, fromStatus: 'feltoltve', toStatus: i.status, changedBy: null, changedAt: i.statusAt ?? created });
  return doc!.id;
}
