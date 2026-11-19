// Append-only audit log (SPEC §4.6). `details` never holds message bodies, codes, tokens,
// passwords, file contents or full personal identifiers; IPs only as HMAC.
import type { DbOrTx } from './db/client.js';
import { auditLog } from './db/schema.js';
import type { C } from './http/core.js';
import { log, safeErr } from './log.js';

export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  clientId?: string | null;
  ipHmac?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown> | null;
}

const FORBIDDEN_KEYS = /pass|code|token|secret|body|signature|adoazonosito|email|phone|login/i;

function cleanDetails(d: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!d) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    out[k] = v;
  }
  return out;
}

export async function audit(db: DbOrTx, e: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    action: e.action,
    actorUserId: e.actorUserId ?? null,
    actorRole: e.actorRole ?? null,
    targetType: e.targetType ?? null,
    targetId: e.targetId ?? null,
    clientId: e.clientId ?? null,
    ipHmac: e.ipHmac ?? null,
    userAgent: e.userAgent ? e.userAgent.slice(0, 80) : null,
    requestId: e.requestId ?? null,
    details: cleanDetails(e.details),
  });
}

/** Audit with actor and request data taken from the Hono context. */
export async function auditC(
  c: C,
  db: DbOrTx,
  action: string,
  o: { targetType?: string; targetId?: string | null; clientId?: string | null; details?: Record<string, unknown>; actorUserId?: string | null; actorRole?: string | null } = {},
): Promise<void> {
  const a = c.get('auth');
  try {
    await audit(db, {
      action,
      actorUserId: o.actorUserId !== undefined ? o.actorUserId : (a?.userId ?? null),
      actorRole: o.actorRole !== undefined ? o.actorRole : (a?.role ?? null),
      targetType: o.targetType ?? null,
      targetId: o.targetId ?? null,
      clientId: o.clientId ?? null,
      ipHmac: c.get('ipHmac'),
      userAgent: c.get('ua'),
      requestId: c.get('requestId'),
      details: o.details ?? null,
    });
  } catch (err) {
    log().error({ rid: c.get('requestId'), action, err: safeErr(err) }, 'audit write failed');
    throw err;
  }
}
