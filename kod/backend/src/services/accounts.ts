// Account creation for clients (password, Google, Apple) and the shared AuthResult builder.
import { and, asc, eq, sql } from 'drizzle-orm';
import { ONBOARDING_STEPS } from '../_shared/enums.js';
import type { AuthResult } from '../_shared/api.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients, onboardingSteps, referralCodes, signupAttribution, users } from '../db/schema.js';
import { randomBase32 } from '../lib/crypto.js';
import { createSession, signAccess, type ClientKind } from '../auth/tokens.js';
import { audit } from '../audit.js';

export interface NewClientInput {
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  googleSub?: string;
  appleSub?: string;
  referralCode?: string;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string };
  landing?: 'web' | 'android' | 'ios';
}

/** Least-loaded active accountant under capacity (FUNKCIOK 30); null if none. */
export async function pickAccountant(db: DbOrTx, o: { requireTotp?: boolean } = {}): Promise<string | null> {
  const rows = await db
    // SPEC §27.11 S8: capacity counts only clients whose e-mail is confirmed – scripted sign-ups that never confirm
    // can no longer fill an accountant's list (they still get an accountant, but do not take a seat).
    .select({
      id: accountants.id,
      capacity: accountants.capacity,
      n: sql<number>`(select count(*)::int from ${clients} c join ${users} cu on cu.id = c.user_id where c.accountant_id = ${accountants.id} and c.lifecycle <> 'megszunt' and cu.email_verified_at is not null)`,
    })
    .from(accountants)
    .innerJoin(users, eq(users.id, accountants.userId))
    // Only accountants who can actually serve a client: the invite is accepted (a password or a Google/Apple link
    // exists), the account is active and they signed in at least once. A just-invited accountant got new
    // registrations before this (round 1, 2026-11-19).
    .where(
      and(
        eq(accountants.active, true),
        eq(users.status, 'active'),
        sql`(${users.passwordHash} is not null or ${users.googleSub} is not null or ${users.appleSub} is not null)`,
        sql`${users.lastLoginAt} is not null`,
        o.requireTotp ? sql`${users.totpEnabledAt} is not null` : sql`true`,
      ),
    )
    .orderBy(asc(accountants.createdAt));
  const free = rows.filter((r) => Number(r.n) < r.capacity).sort((a, b) => Number(a.n) - Number(b.n));
  return free[0]?.id ?? null;
}

export async function uniquePersonalCode(db: DbOrTx, firstName: string): Promise<string> {
  const base = firstName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  for (let i = 0; i < 10; i++) {
    const code = `${base}${randomBase32(4).replace(/[01]/g, '7')}`;
    const [hit] = await db.select({ id: clients.id }).from(clients).where(eq(clients.personalReferralCode, code)).limit(1);
    const [hit2] = await db.select({ id: referralCodes.id }).from(referralCodes).where(eq(referralCodes.code, code)).limit(1);
    if (!hit && !hit2) return code;
  }
  return `K${randomBase32(9)}`;
}

export function isTestSource(src: string | undefined | null): boolean {
  return Boolean(src && /^(qa[_-]|teszt|test|https-proba|bongeszo-proba|qa_proba|smoke)/i.test(src));
}

export async function createClientAccount(deps: Deps, db: DbOrTx, i: NewClientInput): Promise<{ userId: string; clientId: string }> {
  const now = deps.now();
  const [u] = await db
    .insert(users)
    .values({
      email: i.email,
      passwordHash: i.passwordHash,
      role: 'client',
      displayName: `${i.lastName} ${i.firstName}`.trim(),
      emailVerifiedAt: i.emailVerified ? now : null,
      googleSub: i.googleSub ?? null,
      appleSub: i.appleSub ?? null,
    })
    .returning({ id: users.id });
  const userId = u!.id;

  let referralCodeId: string | null = null;
  if (i.referralCode) {
    const code = i.referralCode.trim().toUpperCase();
    const [r] = await db.select({ id: referralCodes.id }).from(referralCodes).where(and(eq(referralCodes.code, code), eq(referralCodes.active, true))).limit(1);
    if (r) referralCodeId = r.id;
    else {
      const [owner] = await db.select({ id: clients.id }).from(clients).where(eq(clients.personalReferralCode, code)).limit(1);
      if (owner) {
        const [created] = await db
          .insert(referralCodes)
          .values({ code, ownerClientId: owner.id, note: 'személyes ajánlókód' })
          .onConflictDoNothing()
          .returning({ id: referralCodes.id });
        referralCodeId = created?.id ?? null;
      }
    }
  }
  const attribution: Record<string, string> = {};
  for (const [k, v] of Object.entries(i.utm ?? {})) if (v) attribution[`utm_${k}`] = String(v).slice(0, 100);

  const accountantId = await pickAccountant(db, { requireTotp: deps.cfg.staffTotpRequired });
  const [cl] = await db
    .insert(clients)
    .values({
      userId,
      accountantId,
      firstName: i.firstName,
      lastName: i.lastName,
      referralCodeId,
      attribution,
      personalReferralCode: await uniquePersonalCode(db, i.firstName),
      nextFlags: ['bekotes_alatt'],
      // Our own QA / smoke scripts register with utm_source=*proba* (or qa*): kept out of the KPIs.
      isTest: deps.cfg.appEnv === 'demo' && isTestSource(i.utm?.source),
    })
    .returning({ id: clients.id });
  const clientId = cl!.id;
  await db.insert(onboardingSteps).values(
    // 'idopont' is legacy (SPEC §26.2.9); 'vallalkozas_inditas' is created when the client answers "Még nincs" (§26.1.1).
    ONBOARDING_STEPS.filter((step) => step !== 'idopont' && step !== 'vallalkozas_inditas').map((step) => ({
      clientId,
      step,
      status: step === 'fiok' ? (i.emailVerified ? ('kesz' as const) : ('ugyfelre_var' as const)) : step === 'adatok' ? ('ugyfelre_var' as const) : ('nincs_kezdve' as const),
      completedAt: step === 'fiok' && i.emailVerified ? now : null,
    })),
  );
  await db.insert(signupAttribution).values({
    userId,
    referralCodeId,
    utmSource: i.utm?.source?.slice(0, 100) ?? null,
    utmMedium: i.utm?.medium?.slice(0, 100) ?? null,
    utmCampaign: i.utm?.campaign?.slice(0, 100) ?? null,
    utmContent: i.utm?.content?.slice(0, 100) ?? null,
    landing: i.landing ?? null,
  });
  await audit(db, { action: 'user.created', actorUserId: userId, actorRole: 'client', targetType: 'user', targetId: userId, clientId, details: { method: i.googleSub ? 'google' : i.appleSub ? 'apple' : 'password', referral: Boolean(referralCodeId) } });
  return { userId, clientId };
}

export interface IssuedAuth {
  result: AuthResult;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export async function issueAuth(
  deps: Deps,
  db: DbOrTx,
  p: { userId: string; clientKind: ClientKind; ua: string; ipHmac: string; isNewUser?: boolean },
): Promise<IssuedAuth> {
  const [u] = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
  if (!u) throw new Error('user vanished');
  const s = await createSession(deps, db, { userId: u.id, clientKind: p.clientKind, userAgent: p.ua, ipHmac: p.ipHmac, staff: u.role !== 'client' });
  const acc = await signAccess(deps, { userId: u.id, role: u.role, sessionId: s.sessionId });
  await db.update(users).set({ lastLoginAt: deps.now(), failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
  return {
    refreshToken: s.refreshToken,
    refreshExpiresAt: s.expiresAt,
    result: {
      accessToken: acc.token,
      accessTokenExpiresAt: acc.expiresAt.toISOString(),
      refreshToken: p.clientKind === 'native' ? s.refreshToken : undefined,
      user: {
        id: u.id,
        email: u.email,
        role: u.role,
        displayName: u.displayName ?? '',
        emailVerified: Boolean(u.emailVerifiedAt),
        totpEnabled: Boolean(u.totpEnabledAt),
      },
      ...(p.isNewUser !== undefined ? { isNewUser: p.isNewUser } : {}),
    },
  };
}
