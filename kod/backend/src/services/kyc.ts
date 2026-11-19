// KYC helpers (SPEC §4.4, §10.3): the PEP declaration (kiemelt közszereplő, with the free-text details) is
// sensitive personal data, so it is stored encrypted with APP_DATA_KEY (declarations_enc, AAD
// "kyc_records.declarations:<clientId>"). Only the non-sensitive flags stay in the plaintext JSONB.
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { files, kycRecords } from '../db/schema.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { log } from '../log.js';

/**
 * Pmt. 57. §: KYC data and copies are kept for 8 years AFTER the business relationship ends. While the client is
 * active, KYC files have no retention date (legal hold); every path that ends the relationship calls this.
 */
export async function endRelationship(db: DbOrTx, clientId: string, now: Date): Promise<string> {
  const until = addDays(todayBudapest(now), 8 * 365 + 2);
  await db.update(kycRecords).set({ relationshipEndedAt: now, retentionUntil: until }).where(and(eq(kycRecords.clientId, clientId), isNull(kycRecords.relationshipEndedAt)));
  await db.update(files).set({ legalHold: true, retentionUntil: until }).where(and(eq(files.ownerClientId, clientId), eq(files.kind, 'kyc'), isNull(files.deletedAt)));
  return until;
}

export type PepDeclaration = { pep: boolean; pepDetails?: string };
type KycRow = typeof kycRecords.$inferSelect;

export const pepAad = (clientId: string) => `kyc_records.declarations:${clientId}`;

/** Plaintext flags + decrypted PEP part, for the accountant view and the GDPR export. */
export function fullDeclarations(deps: Deps, k: KycRow): Record<string, unknown> {
  const pep = k.declarationsEnc ? deps.data.decJson<PepDeclaration>(k.declarationsEnc, pepAad(k.clientId)) : {};
  return { ...k.declarations, ...pep };
}

/**
 * One-off data fix for rows written before kör 2 (PEP in plaintext JSONB): encrypt and strip. Idempotent;
 * runs at API start-up after the migrations.
 */
export async function encryptLegacyPep(deps: Deps, db: DbOrTx = deps.db): Promise<number> {
  const rows = await db
    .select()
    .from(kycRecords)
    .where(and(isNull(kycRecords.declarationsEnc), sql`(${kycRecords.declarations} ? 'pep' or ${kycRecords.declarations} ? 'pepDetails')`));
  for (const k of rows) {
    const d = { ...(k.declarations as Record<string, unknown>) };
    const pep: PepDeclaration = { pep: d.pep === true, ...(typeof d.pepDetails === 'string' && d.pepDetails ? { pepDetails: d.pepDetails } : {}) };
    delete d.pep;
    delete d.pepDetails;
    await db
      .update(kycRecords)
      .set({ declarations: d as KycRow['declarations'], declarationsEnc: deps.data.encJson(pep, pepAad(k.clientId)) })
      .where(sql`${kycRecords.id} = ${k.id}`);
  }
  if (rows.length) log().info({ rows: rows.length }, 'kyc: PEP declarations encrypted');
  // Before kör 2 a KYC file got "upload + 9 years" at once; for clients still active that is a legal hold now.
  await db.execute(
    sql`update files set retention_until = null, legal_hold = true where kind = 'kyc' and deleted_at is null and owner_client_id in (select id from clients where lifecycle <> 'megszunt')`,
  );
  return rows.length;
}
