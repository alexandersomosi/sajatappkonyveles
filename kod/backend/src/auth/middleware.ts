// Authentication + role guard (SPEC §4.2). Order: request-id → rate limit → auth (session) →
// role guard → ownership guard (in the route helpers). A role mismatch answers 404 so the route
// groups of other roles are not discoverable.
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { UserRole } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { sessions, users } from '../db/schema.js';
import { E } from '../lib/errors.js';
import type { Env } from '../http/core.js';
import { verifyAccess } from './tokens.js';

export interface AuthOptions {
  roles?: UserRole[];
  /** Staff without TOTP may still reach these (setup flow) when STAFF_TOTP_REQUIRED. */
  allowWithoutStaffTotp?: boolean;
}

export function requireAuth(deps: Deps, o: AuthOptions = {}): MiddlewareHandler<Env> {
  return async (c, next) => {
    const h = c.req.header('authorization') ?? '';
    const m = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(h);
    if (!m) throw E.unauthenticated();
    const claims = await verifyAccess(deps, m[1]!);
    if (!claims) throw E.unauthenticated();
    type Row = {
      revokedAt: Date | null;
      expiresAt: Date;
      userId: string;
      status: string;
      role: UserRole;
      email: string;
      displayName: string | null;
      totpEnabledAt: Date | null;
      emailVerifiedAt: Date | null;
    };
    let row = deps.sessionCache.get<Row>(claims.sessionId);
    if (row === undefined) {
      const [r] = await deps.db
        .select({
          revokedAt: sessions.revokedAt,
          expiresAt: sessions.expiresAt,
          userId: sessions.userId,
          status: users.status,
          role: users.role,
          email: users.email,
          displayName: users.displayName,
          totpEnabledAt: users.totpEnabledAt,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.id, claims.sessionId))
        .limit(1);
      row = r && !r.revokedAt && r.status === 'active' ? r : null;
      deps.sessionCache.set(claims.sessionId, row);
    }
    if (!row || row.expiresAt <= deps.now() || row.userId !== claims.userId || row.role !== claims.role) throw E.unauthenticated();

    const rl = deps.limiter.hit(`auth-user:${claims.userId}`, 600, 5 * 60_000);
    if (!rl.ok) throw E.rateLimited(rl.retryAfterSec);

    c.set('auth', {
      userId: claims.userId,
      role: row.role,
      sessionId: claims.sessionId,
      email: row.email,
      displayName: row.displayName,
      totpEnabled: Boolean(row.totpEnabledAt),
      emailVerified: Boolean(row.emailVerifiedAt),
    });
    if (o.roles && !o.roles.includes(row.role)) throw E.notFound();
    if (deps.cfg.staffTotpRequired && row.role !== 'client' && !row.totpEnabledAt && !o.allowWithoutStaffTotp) throw E.mfaSetupRequired();
    await next();
  };
}
