// E-mail codes (SPEC §4.1): 6 digits, 15 minutes, max 5 attempts, stored as HMAC-SHA256,
// single use; issuing a new code invalidates the previous ones of the same purpose FROM THE SAME ADDRESS.
//
// Round 1 (2026-11-19) – nobody else can close the password reset of an account any more:
//  - every code remembers the address that asked for it (ip_hmac). Only that address uses the code's 5 attempts
//    and its 24-hour budget; guesses from any other address have their own small budget (foreign_attempts: 3 per
//    code, 10 per e-mail and purpose in 24 h) and never touch the owner's attempts;
//  - a new code only replaces the earlier codes of the same address, so a stranger's "forgot" request cannot
//    invalidate the code the owner is just typing in.
// Codes without an address (staff invites created by an admin, rows from before this change) behave as before:
// anyone holding the mail may redeem them, 5 attempts.
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { emailCodes } from '../db/schema.js';
import { hmacHex, randomDigits, safeEqual } from '../lib/crypto.js';

export type CodePurpose = 'verify_email' | 'password_reset' | 'staff_invite';
const TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;
/** Comparisons allowed on one code from addresses that did not ask for it. */
const MAX_FOREIGN_ATTEMPTS = 3;

function codeHmac(deps: Deps, email: string, purpose: CodePurpose, code: string): string {
  return hmacHex(deps.cfg.codeHmacSecret, `${purpose}:${email}:${code}`);
}

export async function issueCode(deps: Deps, db: DbOrTx, p: { email: string; purpose: CodePurpose; userId?: string | null; ipHmac?: string | null }): Promise<string> {
  const now = deps.now();
  const ip = p.ipHmac ?? null;
  await db
    .update(emailCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailCodes.email, p.email),
        eq(emailCodes.purpose, p.purpose),
        isNull(emailCodes.usedAt),
        // an address-less issue (admin invite) replaces everything; otherwise only this address's and the address-less ones
        ip ? or(eq(emailCodes.ipHmac, ip), isNull(emailCodes.ipHmac)) : sql`true`,
      ),
    );
  const code = randomDigits(6);
  await db.insert(emailCodes).values({
    userId: p.userId ?? null,
    email: p.email,
    purpose: p.purpose,
    codeHmac: codeHmac(deps, p.email, p.purpose, code),
    expiresAt: new Date(now.getTime() + TTL_MS),
    ipHmac: ip,
  });
  return code;
}

/** Code comparisons per e-mail, purpose and requesting address per 24 h (all codes of that address together). */
export const DAILY_MAX_ATTEMPTS = 20;
/** Comparisons per e-mail and purpose per 24 h from addresses that did not ask for the code. */
export const DAILY_MAX_FOREIGN_ATTEMPTS = 10;

export type CheckResult = 'ok' | 'wrong' | 'expired' | 'too_many' | 'none';

/**
 * SPEC §27.11 S2 (round-2 security finding 2): comparisons per e-mail and purpose per 24 h over ALL codes, from
 * addresses that never signed in to the account. Each requesting address used to get its own code with its own five
 * guesses, so many addresses together could make ~1 400 guesses a day. Reaching the cap closes every open code of the
 * account (a fresh request opens a new one later). An address the owner signed in from before is not counted against
 * it, so the owner on his usual device is never shut out.
 */
export const ACCOUNT_DAILY_MAX_UNTRUSTED = 30;

/** Codes issued for an e-mail and purpose since a moment (persistent mail cap of /password/forgot). */
export async function codesIssuedSince(deps: Deps, email: string, purpose: CodePurpose, since: Date): Promise<number> {
  const [r] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(emailCodes).where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose), gt(emailCodes.createdAt, since)));
  return Number(r?.n ?? 0);
}

/**
 * Verifies and consumes an open code. Every attempt is counted ATOMICALLY before the comparison
 * (UPDATE … attempts = attempts + 1 … RETURNING), so parallel guesses cannot share one attempt: at most
 * MAX_ATTEMPTS comparisons are ever made per issued code by its own address (+ MAX_FOREIGN_ATTEMPTS by others).
 * A correct code is consumed with a conditional UPDATE (used_at IS NULL), so it also works only once.
 */
export async function checkCode(
  deps: Deps,
  db: DbOrTx,
  /** accountCap: the S2 account-wide daily budget for another purpose too (k7b: the sign-up code without a session). */
  p: { email: string; purpose: CodePurpose; code: string; ipHmac?: string | null; trustedAddress?: boolean; accountCap?: boolean },
): Promise<CheckResult> {
  const now = deps.now();
  const ip = p.ipHmac ?? null;
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const base = and(eq(emailCodes.email, p.email), eq(emailCodes.purpose, p.purpose));
  if ((p.purpose === 'password_reset' || p.accountCap) && !p.trustedAddress) {
    const [all] = await db
      .select({ n: sql<number>`coalesce(sum(${emailCodes.attempts} + ${emailCodes.foreignAttempts}), 0)::int` })
      .from(emailCodes)
      .where(and(base, gt(emailCodes.createdAt, dayAgo)));
    if ((all?.n ?? 0) >= ACCOUNT_DAILY_MAX_UNTRUSTED) {
      await db.update(emailCodes).set({ usedAt: now }).where(and(base, isNull(emailCodes.usedAt)));
      return 'too_many';
    }
  }
  /** "Own" codes: asked from this address, or address-less (invite / legacy). Without a caller address: every code. */
  const own = ip ? or(eq(emailCodes.ipHmac, ip), isNull(emailCodes.ipHmac)) : sql`true`;

  const [mine] = await db
    .select({ id: emailCodes.id })
    .from(emailCodes)
    .where(and(base, own, isNull(emailCodes.usedAt)))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);

  if (mine) {
    // Persistent cap (survives restarts and deploys, unlike the in-memory rate limits) – counted only on the codes
    // this address asked for, so guesses made elsewhere cannot use up the owner's day.
    const [day] = await db
      .select({ n: sql<number>`coalesce(sum(${emailCodes.attempts}), 0)::int` })
      .from(emailCodes)
      .where(and(base, own, gt(emailCodes.createdAt, dayAgo)));
    if ((day?.n ?? 0) >= DAILY_MAX_ATTEMPTS) return 'too_many';
    const [row] = await db
      .update(emailCodes)
      .set({ attempts: sql`${emailCodes.attempts} + 1` })
      .where(and(eq(emailCodes.id, mine.id), isNull(emailCodes.usedAt), gt(emailCodes.expiresAt, now), lt(emailCodes.attempts, MAX_ATTEMPTS)))
      .returning();
    if (!row) {
      // Nothing was counted: tell why (expired, or out of attempts).
      const [cur] = await db.select({ expiresAt: emailCodes.expiresAt }).from(emailCodes).where(eq(emailCodes.id, mine.id)).limit(1);
      if (!cur) return 'none';
      return cur.expiresAt <= now ? 'expired' : 'too_many';
    }
    const ok = /^\d{6}$/.test(p.code) && safeEqual(row.codeHmac, codeHmac(deps, p.email, p.purpose, p.code));
    if (!ok) {
      if (row.attempts >= MAX_ATTEMPTS) await db.update(emailCodes).set({ usedAt: now }).where(and(eq(emailCodes.id, row.id), isNull(emailCodes.usedAt)));
      return row.attempts >= MAX_ATTEMPTS ? 'too_many' : 'wrong';
    }
    return consume(db, row.id, now);
  }

  // No code of this address. The owner may have changed network between asking and typing: the newest open code of
  // another address can still be redeemed, on its own small budget that never touches the owner's attempts.
  const [other] = await db
    .select({ id: emailCodes.id, expiresAt: emailCodes.expiresAt })
    .from(emailCodes)
    .where(and(base, isNull(emailCodes.usedAt)))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (!other) return 'none';
  if (other.expiresAt <= now) return 'expired';
  const [fday] = await db
    .select({ n: sql<number>`coalesce(sum(${emailCodes.foreignAttempts}), 0)::int` })
    .from(emailCodes)
    .where(and(base, gt(emailCodes.createdAt, dayAgo)));
  if ((fday?.n ?? 0) >= DAILY_MAX_FOREIGN_ATTEMPTS) return 'too_many';
  const [frow] = await db
    .update(emailCodes)
    .set({ foreignAttempts: sql`${emailCodes.foreignAttempts} + 1` })
    .where(and(eq(emailCodes.id, other.id), isNull(emailCodes.usedAt), gt(emailCodes.expiresAt, now), lt(emailCodes.foreignAttempts, MAX_FOREIGN_ATTEMPTS)))
    .returning();
  if (!frow) return 'too_many';
  const ok = /^\d{6}$/.test(p.code) && safeEqual(frow.codeHmac, codeHmac(deps, p.email, p.purpose, p.code));
  if (!ok) return 'wrong';
  return consume(db, frow.id, now);
}

async function consume(db: DbOrTx, id: string, now: Date): Promise<CheckResult> {
  const consumed = await db
    .update(emailCodes)
    .set({ usedAt: now })
    .where(and(eq(emailCodes.id, id), isNull(emailCodes.usedAt)))
    .returning({ id: emailCodes.id });
  return consumed.length ? 'ok' : 'none';
}

export const CODE_MESSAGES: Record<Exclude<CheckResult, 'ok'>, string> = {
  wrong: 'Ez a kód nem jó. Nézd meg újra a levelet.',
  expired: 'Ez a kód lejárt. Kérj újat.',
  too_many: 'Túl sokszor próbáltad. Kérj új kódot.',
  none: 'Nincs érvényes kód. Kérj újat.',
};

/** Password reset: one answer for a wrong code and for "no code at all" (an unknown e-mail must not differ). */
export const RESET_CODE_MESSAGE = 'Ez a kód nem jó, vagy már lejárt. Nézd meg újra a levelet, vagy kérj új kódot.';
