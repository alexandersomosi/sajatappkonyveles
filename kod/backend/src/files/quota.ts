// SPEC §27.11 S6 (round-2 security finding 6): a storage quota per client and a free-disk guard. The disk is shared
// with another app and both databases: one account must not be able to fill it. Checked BEFORE the body is read, with
// the request's Content-Length as the size of what comes (a lying header is still capped by the body limit).
import { statfs } from 'node:fs/promises';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { files } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';

/** Bytes a client stores (every live file of his, incl. unattached chat attachments). */
export async function clientStoredBytes(db: DbOrTx, clientId: string): Promise<number> {
  const [r] = await db.select({ n: sql<string>`coalesce(sum(${files.sizeBytes}), 0)` }).from(files).where(and(eq(files.ownerClientId, clientId), isNull(files.deletedAt)));
  return Number(r?.n ?? 0);
}

/** Free space of the FILES_DIR disk (% and bytes), or null when it cannot be read (then nothing is refused). */
export async function freeDisk(dir: string): Promise<{ pct: number; bytes: number } | null> {
  try {
    const s = await statfs(dir);
    return s.blocks > 0 ? { pct: (Number(s.bavail) / Number(s.blocks)) * 100, bytes: Number(s.bavail) * Number(s.bsize) } : null;
  } catch {
    return null;
  }
}

export async function freeDiskPct(dir: string): Promise<number | null> {
  return (await freeDisk(dir))?.pct ?? null;
}

export async function assertUploadQuota(deps: Deps, db: DbOrTx, cl: { id: string; lifecycle: string }, incomingBytes: number): Promise<void> {
  const free = await freeDisk(deps.cfg.filesDir);
  if (free !== null && (free.bytes < deps.cfg.quota.minFreeDiskBytes || free.pct < deps.cfg.quota.minFreeDiskPct)) {
    throw new ApiError(507, 'storage_full', 'Most nem tudunk több fájlt fogadni. Már dolgozunk rajta, próbáld újra később.');
  }
  const limit = cl.lifecycle === 'bekotes_alatt' ? deps.cfg.quota.beforeActivationBytes : deps.cfg.quota.afterActivationBytes;
  const used = await clientStoredBytes(db, cl.id);
  if (used + Math.max(0, incomingBytes) > limit) {
    const mb = Math.round(limit / 1024 / 1024);
    throw new ApiError(413, 'quota_exceeded', `Elérted a tárhelyed határát (${mb} MB). Írj nekünk, és megnézzük, mit tehetünk.`);
  }
}
