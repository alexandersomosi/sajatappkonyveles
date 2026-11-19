// Access tokens (JWT HS256, 10 min, { sub, role, sid }), MFA tokens (5 min, typ=mfa) and
// rotating opaque refresh tokens (SHA-256 stored; 30 d absolute, 14 d idle; reuse of a rotated
// token revokes the whole family) – SPEC §4.1.
import { randomUUID } from 'node:crypto';
import { and, eq, gte, isNull, lte } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import type { UserRole } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { mfaChallenges, sessions, users } from '../db/schema.js';
import { randomToken, sha256Hex } from '../lib/crypto.js';

export const ACCESS_TTL_S = 10 * 60;
/**
 * A rotated refresh token still works for this long (a lost response on a mobile network, two tabs
 * refreshing at once, a retry): it gets a new sibling session instead of revoking the family. Later
 * reuse is treated as theft (family revoked). At most GRACE_MAX siblings per rotated token.
 */
export const REFRESH_GRACE_MS = 60_000;
export const REFRESH_GRACE_MAX = 3;
export const MFA_TTL_S = 5 * 60;
export const REFRESH_ABS_DAYS = 30;
export const REFRESH_IDLE_DAYS = 14;
/** Staff (accountant/admin) sessions are shorter: 7 days absolute, 12 hours idle. */
export const STAFF_ABS_DAYS = 7;
export const STAFF_IDLE_HOURS = 12;
const ISS = 'kezjegy';

export async function signAccess(deps: Deps, p: { userId: string; role: UserRole; sessionId: string }): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(deps.now().getTime() / 1000);
  const token = await new SignJWT({ role: p.role, sid: p.sessionId, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.userId)
    .setIssuer(ISS)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_S)
    .sign(deps.cfg.jwtSecret);
  return { token, expiresAt: new Date((now + ACCESS_TTL_S) * 1000) };
}

export async function verifyAccess(deps: Deps, token: string): Promise<{ userId: string; role: UserRole; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, deps.cfg.jwtSecret, {
      issuer: ISS,
      algorithms: ['HS256'],
      currentDate: deps.now(),
    });
    if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return { userId: payload.sub, role: payload.role as UserRole, sessionId: payload.sid };
  } catch {
    return null;
  }
}

/** MFA token = a signed pointer to a single-use mfa_challenges row (consumed on success). */
export async function signMfa(deps: Deps, userId: string, clientKind: string, o: { cancelDeletion?: boolean } = {}): Promise<string> {
  const now = Math.floor(deps.now().getTime() / 1000);
  const jti = randomUUID();
  await deps.db.insert(mfaChallenges).values({ jti, userId, expiresAt: new Date((now + MFA_TTL_S) * 1000) });
  // cd: the user asked to cancel a pending GDPR deletion – done only after the second factor (signed claim).
  return new SignJWT({ typ: 'mfa', ck: clientKind, ...(o.cancelDeletion ? { cd: true } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISS)
    .setIssuedAt(now)
    .setExpirationTime(now + MFA_TTL_S)
    .setJti(jti)
    .sign(deps.cfg.jwtSecret);
}

export async function verifyMfa(deps: Deps, token: string): Promise<{ userId: string; clientKind: string; jti: string; cancelDeletion: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, deps.cfg.jwtSecret, { issuer: ISS, algorithms: ['HS256'], currentDate: deps.now() });
    if (payload.typ !== 'mfa' || typeof payload.sub !== 'string') return null;
    return { userId: payload.sub, clientKind: String(payload.ck ?? 'web'), jti: String(payload.jti ?? ''), cancelDeletion: payload.cd === true };
  } catch {
    return null;
  }
}

export type ClientKind = 'native' | 'web' | 'panel';

export async function createSession(
  deps: Deps,
  db: DbOrTx,
  p: { userId: string; clientKind: ClientKind; userAgent: string; ipHmac: string; familyId?: string; staff?: boolean },
): Promise<{ sessionId: string; refreshToken: string; expiresAt: Date }> {
  const refreshToken = randomToken(32);
  const now = deps.now();
  const expiresAt = new Date(now.getTime() + (p.staff ? STAFF_ABS_DAYS : REFRESH_ABS_DAYS) * 86_400_000);
  const [row] = await db
    .insert(sessions)
    .values({
      userId: p.userId,
      familyId: p.familyId ?? randomUUID(),
      refreshHash: sha256Hex(refreshToken),
      createdAt: now,
      expiresAt,
      idleExpiresAt: new Date(now.getTime() + (p.staff ? STAFF_IDLE_HOURS * 3600_000 : REFRESH_IDLE_DAYS * 86_400_000)),
      lastUsedAt: now,
      clientKind: p.clientKind,
      userAgent: p.userAgent.slice(0, 120),
      ipHmac: p.ipHmac,
    })
    .returning({ id: sessions.id });
  return { sessionId: row!.id, refreshToken, expiresAt };
}

export type RotateResult =
  | { ok: true; sessionId: string; userId: string; refreshToken: string; clientKind: ClientKind; expiresAt: Date }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' | 'revoked' | 'user' };

/**
 * Rotation: the presented token's session is marked rotated and a new session in the same family
 * is issued (absolute expiry carried over). Presenting an already rotated token revokes the family.
 */
export async function rotateRefresh(deps: Deps, presented: string, ua: string, ipHmac: string): Promise<RotateResult> {
  const hash = sha256Hex(presented);
  const now = deps.now();
  return deps.db.transaction(async (tx) => {
    const [s] = await tx.select().from(sessions).where(eq(sessions.refreshHash, hash)).limit(1).for('update');
    if (!s) return { ok: false, reason: 'unknown' } as const;
    if (s.rotatedAt) {
      const inGrace = !s.revokedAt && now.getTime() - s.rotatedAt.getTime() <= REFRESH_GRACE_MS;
      if (inGrace) {
        const siblings = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(and(eq(sessions.familyId, s.familyId), gte(sessions.createdAt, s.rotatedAt), lte(sessions.createdAt, new Date(s.rotatedAt.getTime() + REFRESH_GRACE_MS))));
        if (siblings.length <= REFRESH_GRACE_MAX) return issueChild(tx, s, now);
      }
      await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.familyId, s.familyId), isNull(sessions.revokedAt)));
      deps.sessionCache.clear();
      return { ok: false, reason: 'reused' } as const;
    }
    if (s.revokedAt) return { ok: false, reason: 'revoked' } as const;
    if (s.expiresAt <= now || s.idleExpiresAt <= now) return { ok: false, reason: 'expired' } as const;
    await tx.update(sessions).set({ rotatedAt: now, lastUsedAt: now }).where(eq(sessions.id, s.id));
    return issueChild(tx, s, now);
  });

  async function issueChild(tx: DbOrTx, s: typeof sessions.$inferSelect, now: Date): Promise<RotateResult> {
    if (s.expiresAt <= now) return { ok: false, reason: 'expired' } as const;
    const [u] = await tx.select({ status: users.status, role: users.role }).from(users).where(eq(users.id, s.userId)).limit(1);
    if (!u || u.status !== 'active') return { ok: false, reason: 'user' } as const;
    const refreshToken = randomToken(32);
    const [n] = await tx
      .insert(sessions)
      .values({
        userId: s.userId,
        familyId: s.familyId,
        refreshHash: sha256Hex(refreshToken),
        expiresAt: s.expiresAt,
        idleExpiresAt: new Date(Math.min(s.expiresAt.getTime(), now.getTime() + (u.role === 'client' ? REFRESH_IDLE_DAYS * 86_400_000 : STAFF_IDLE_HOURS * 3600_000))),
        lastUsedAt: now,
        createdAt: now,
        clientKind: s.clientKind,
        userAgent: ua.slice(0, 120),
        ipHmac,
      })
      .returning({ id: sessions.id });
    return { ok: true, sessionId: n!.id, userId: s.userId, refreshToken, clientKind: s.clientKind, expiresAt: s.expiresAt } as const;
  }
}

/** 30-second cache of session validity and the user's auth data (SPEC §4.1). Cleared on any revocation. */
export class SessionCache {
  private m = new Map<string, { at: number; v: unknown }>();
  constructor(private readonly now: () => Date) {}
  get<T>(sid: string): T | null | undefined {
    const e = this.m.get(sid);
    if (!e || this.now().getTime() - e.at > 30_000) return undefined;
    return e.v as T | null;
  }
  set(sid: string, v: unknown): void {
    if (this.m.size > 10_000) this.m.clear();
    this.m.set(sid, { at: this.now().getTime(), v });
  }
  clear(): void {
    this.m.clear();
  }
}

export async function revokeSession(deps: Deps, db: DbOrTx, sessionId: string): Promise<void> {
  const [s] = await db.select({ familyId: sessions.familyId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (s) await db.update(sessions).set({ revokedAt: deps.now() }).where(and(eq(sessions.familyId, s.familyId), isNull(sessions.revokedAt)));
  deps.sessionCache.clear();
}

export async function revokeAllSessions(deps: Deps, db: DbOrTx, userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: deps.now() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  deps.sessionCache.clear();
}
