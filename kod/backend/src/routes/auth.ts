// /auth – SPEC §12.2, §4.1, §4.3.
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Deps } from '../deps.js';
import { clients, mfaChallenges, onboardingSteps, sessions, users } from '../db/schema.js';
import { auditC } from '../audit.js';
import { CODE_MESSAGES, RESET_CODE_MESSAGE, checkCode, codesIssuedSince, issueCode } from '../auth/codes.js';
import { requireAuth } from '../auth/middleware.js';
import { ProviderUnavailable, TokenRejected, type Provider } from '../auth/oidc.js';
import { revokeAllSessions, revokeSession, rotateRefresh, signAccess, signMfa, verifyMfa, type ClientKind } from '../auth/tokens.js';
import { assertJsonContentType, auth, dbState, param, readJson, sameSiteGuard, type C, type Env } from '../http/core.js';
import { hmacHex } from '../lib/crypto.js';
import { ApiError, E } from '../lib/errors.js';
import { hashPassword, passwordProblem, verifyPassword } from '../lib/password.js';
import { base32Decode, newRecoveryCodes, newTotpSecret, otpauthUrl, verifyTotp } from '../lib/totp.js';
import { isPlausibleEmail, normalizeEmail } from '../lib/validators.js';
import { sendCodeEmail, sendTemplateMail } from '../notify/notify.js';
import { createClientAccount, issueAuth, type IssuedAuth } from '../services/accounts.js';
import { queueAdConversionSafe } from '../services/hirdetes.js';
import type { TouchInput } from '../services/marketing.js';
import { cancelDeletion } from '../services/gdpr.js';
import brand from '../_shared/brand.json' with { type: 'json' };
import { hash as argonHash, verify as argonVerify, Algorithm } from '@node-rs/argon2';

// __Host- prefix: the browser refuses this cookie with a Domain attribute or a Path other than "/", so another
// *.sslip.io site (sslip.io is not on the Public Suffix List) cannot plant ("toss") a refresh cookie for our host.
// A path restriction is not possible with __Host-; the X-Kezjegy header check on /auth/* keeps CSRF out.
const COOKIE = '__Host-kj_rt';
const COOKIE_PATH = '/';
/** The pre-2026-11-18 name (Path=/api/v1/auth): never read any more, only cleared. */
const LEGACY_COOKIE = 'kj_rt';
const LEGACY_PATH = '/api/v1/auth';

const email = z
  .string({ error: 'Add meg az e-mail-címed.' })
  .trim()
  .max(254)
  .transform(normalizeEmail)
  .refine(isPlausibleEmail, { error: 'Ez nem tűnik e-mail-címnek.' });
const name = z.string({ error: 'Kötelező.' }).trim().min(1, { error: 'Kötelező.' }).max(60, { error: 'Legfeljebb 60 karakter.' });
const clientKind = z.enum(['native', 'web', 'panel']).default('web');
const utm = z
  .object({ source: z.string().max(100).optional(), medium: z.string().max(100).optional(), campaign: z.string().max(100).optional(), content: z.string().max(100).optional(), term: z.string().max(100).optional() })
  .optional();
/** SPEC §31.3: the referring domain and the landing path the landing passed on (?hivatkozo=…&erkezes=…). */
const forras = z.object({ hivatkozo: z.string().max(253).optional(), erkezes: z.string().max(200).optional() }).optional();
/** SPEC §28.K.8: ?forras=kalkulator / ?cel=visszahivas (an unknown value is dropped, never an error). */
const entry = z.object({ forras: z.string().max(40).optional(), cel: z.string().max(40).optional() }).optional();
/** SPEC §31.6: the landing's ad-consent decision id and the click ids – used ONLY with ADS_TRACKING_ENABLED=true. */
const hirdetes = z
  .object({ hid: z.string().uuid().optional(), gclid: z.string().max(500).optional(), gbraid: z.string().max(500).optional(), wbraid: z.string().max(500).optional(), fbclid: z.string().max(500).optional() })
  .optional();
const referral = z.string().trim().max(20).regex(/^[A-Za-z0-9]*$/, { error: 'Csak betű és szám lehet.' }).optional();

const MFA_MAX_FAILURES = 5;
const TOTP_MAX_FAILURES = 5;

const RECOVERY_OPTS = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Reserved, never-delivered domains (RFC 2606/6761): the only addresses the DEMO accepts at registration. */
export function isDemoAddress(email: string): boolean {
  const d = email.split('@')[1]?.toLowerCase() ?? '';
  return /(^|\.)(test|example|invalid|localhost)$/.test(d) || /^(.*\.)?example\.(com|net|org)$/.test(d);
}

/** The session family started (a real sign-in, not a refresh) within the last `minutes`. */
export async function freshSignIn(deps: Deps, sessionId: string, minutes = 10): Promise<boolean> {
  const [cur] = await deps.db.select({ familyId: sessions.familyId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (!cur) return false;
  const [first] = await deps.db.select({ at: sql<string | Date | null>`min(${sessions.createdAt})` }).from(sessions).where(eq(sessions.familyId, cur.familyId));
  const at = first?.at ? new Date(first.at) : null;
  return Boolean(at && deps.now().getTime() - at.getTime() <= minutes * 60_000);
}

/** One answer for an unknown e-mail, a wrong password and a locked account. */
export const LOGIN_FAILED = 'Hibás e-mail-cím vagy jelszó. Ha biztosan jól írtad, várj 15 percet, vagy kérj új jelszót.';

export function authRoutes(deps: Deps) {
  const r = new Hono<Env>();
  // SPEC §27.11 S3: no cross-site browser request reaches the cookie-setting sign-in routes.
  r.use('*', sameSiteGuard(deps));
  const authed = requireAuth(deps, { allowWithoutStaffTotp: true });

  const k = (s: string) => hmacHex(deps.cfg.auditIpSalt, s).slice(0, 24);
  /** k8 JL 14: "Üdv az Adózzban!" – once per account (audit marker), after the sign-up address is confirmed. */
  const welcomeMail = async (userId: string, to: string) => {
    const [cl] = await deps.db.select({ firstName: clients.firstName }).from(clients).where(eq(clients.userId, userId)).limit(1);
    if (!cl) return;
    const link = `${deps.cfg.appPublicUrl}/bevezeto`;
    await sendTemplateMail(deps, { to, key: 'welcome', lablec: 'ugyfel', gomb: { szoveg: await deps.content.render('email.welcome.gomb', {}), link }, params: { keresztnev: cl.firstName, link } });
  };

  /** Fresh sign-in (≤ 10 min) or the current password; Google/Apple-only accounts need a fresh sign-in. */
  async function requireRecentAuth(u: { passwordHash: string | null }, sessionId: string, currentPassword: string | undefined): Promise<void> {
    if (currentPassword !== undefined && u.passwordHash) {
      if (!(await verifyPassword(u.passwordHash, currentPassword))) throw E.validation({ currentPassword: 'Ez nem a mostani jelszavad.' });
      return;
    }
    if (await freshSignIn(deps, sessionId)) return;
    throw new ApiError(
      403,
      'reauth_required',
      u.passwordHash ? 'Biztonsági okból add meg a jelszavadat is, vagy lépj ki és be újra.' : 'Biztonsági okból lépj ki, majd be újra, és utána kapcsold be.',
    );
  }
  /**
   * Addresses that failed a password for an account within the last hour (per process). The account-wide lock needs
   * failures from at least LOCK_MIN_ADDRESSES different addresses: one address is already throttled on its own
   * (10 tries / 15 min), so a single stranger can no longer keep an account locked for everybody.
   */
  const failAddresses = new Map<string, Map<string, number>>();
  const LOCK_MIN_ADDRESSES = 3;
  function noteFailure(userId: string, ipHmac: string, nowMs: number): number {
    if (failAddresses.size > 20_000) failAddresses.clear();
    const m = failAddresses.get(userId) ?? new Map<string, number>();
    for (const [k, t] of m) if (nowMs - t > 3600_000) m.delete(k);
    m.set(ipHmac, nowMs);
    failAddresses.set(userId, m);
    return m.size;
  }
  /** The address signed in to this account before (a session of the last 90 days carries its HMAC). */
  async function knownAddress(userId: string, ipHmac: string): Promise<boolean> {
    const [s0] = await deps.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.ipHmac, ipHmac), gt(sessions.createdAt, new Date(deps.now().getTime() - 90 * 86_400_000))))
      .limit(1);
    return Boolean(s0);
  }

  function limit(key: string, n: number, windowMs: number) {
    const h = deps.limiter.hit(key, n, windowMs);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
  }

  function deliver(c: C, issued: IssuedAuth, kind: ClientKind, status: 200 | 201 = 200) {
    if (kind !== 'native') {
      setCookie(c, COOKIE, issued.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: COOKIE_PATH,
        expires: issued.refreshExpiresAt,
      });
    }
    return c.json(issued.result, status);
  }

  async function finishLogin(c: C, userId: string, kind: ClientKind, extra: { isNewUser?: boolean; method: string }) {
    const [u] = await deps.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) throw E.unauthenticated();
    if (u.totpEnabledAt) {
      const mfaToken = await signMfa(deps, u.id, kind);
      await auditC(c, deps.db, 'auth.login_mfa_challenge', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { method: extra.method } });
      throw E.mfaRequired(mfaToken);
    }
    const issued = await issueAuth(deps, deps.db, { userId: u.id, clientKind: kind, ua: c.get('ua'), ipHmac: c.get('ipHmac'), isNewUser: extra.isNewUser });
    await auditC(c, deps.db, 'auth.login', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { method: extra.method, clientKind: kind } });
    return deliver(c, issued, kind, extra.isNewUser ? 201 : 200);
  }

  // ---------- register ----------
  /**
   * k7b (SPEC §27.11 S16, LEVEL_LEFEDETTSEG #3): the answer never tells whether the address already has an account.
   * Always 202 { status: 'check_email' } and no session: a new address gets the account and a 6-digit code, an existing
   * one gets the "Már van fiókod" mail (sign in / new password) and nothing else changes. The session comes after the
   * code (POST /auth/register/verify). Both paths hash the password and send one mail, so they take about the same time.
   */
  r.post('/register', async (c) => {
    limit(`reg-ip:${c.get('ipHmac')}`, 5, 3600_000);
    const b = await readJson(
      c,
      z.object({
        email,
        password: z.string({ error: 'Add meg a jelszót.' }).max(128),
        firstName: name,
        lastName: name,
        referralCode: referral,
        utm,
        forras,
        entry,
        hirdetes,
        platform: z.enum(['web', 'android', 'ios']).default('web'),
      }),
    );
    limit(`reg-mail:${k(b.email)}`, 3, 3600_000);
    if (deps.mailer.mode === 'demo' && !isDemoAddress(b.email))
      throw E.validation({ email: 'A DEMO-ban még nem küldünk ki levelet, ezért csak kitalált címmel regisztrálhatsz, például valaki@demo.kezjegy.test.' });
    const pw = passwordProblem(b.password, b.email);
    if (pw) throw E.validation({ password: pw });
    const passwordHash = await hashPassword(b.password);
    const [exists] = await deps.db.select({ id: users.id, status: users.status, role: users.role, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.email, b.email)).limit(1);
    if (exists) {
      // The owner is told by mail (at most once an hour per address – the answer is the same either way). An earlier
      // sign-up that never got its code confirmed hears how to finish it (sign in with that password → a new code).
      const once = deps.limiter.hit(`reg-exists:${k(b.email)}`, 1, 3600_000);
      const unconfirmed = exists.role === 'client' && exists.status === 'active' && !exists.emailVerifiedAt;
      if (once.ok && exists.status !== 'deleted') await sendTemplateMail(deps, { to: b.email, key: 'account_exists', ...(unconfirmed ? { variant: 'megerositetlen' } : {}) });
      await auditC(c, deps.db, 'auth.register_existing', { actorUserId: null, actorRole: null, targetType: 'user', targetId: exists.id, details: { mailed: once.ok } });
      return c.json({ status: 'check_email', email: b.email }, 202);
    }
    let userId: string;
    try {
      ({ userId } = await deps.db.transaction((tx) =>
        createClientAccount(deps, tx, {
          email: b.email,
          passwordHash,
          firstName: b.firstName,
          lastName: b.lastName,
          emailVerified: false,
          referralCode: b.referralCode,
          utm: b.utm,
          landing: b.platform,
          touch: { utm: b.utm, source: b.forras, entry: b.entry, ad: b.hirdetes, platform: b.platform },
        }),
      ));
    } catch (err) {
      // two parallel sign-ups with the same new address: the other one made the account – the same answer here too
      if (dbState(err)?.code === '23505') return c.json({ status: 'check_email', email: b.email }, 202);
      throw err;
    }
    const code = await issueCode(deps, deps.db, { email: b.email, purpose: 'verify_email', userId, ipHmac: c.get('ipHmac') });
    await sendCodeEmail(deps, b.email, 'auth_email_code', code);
    await auditC(c, deps.db, 'auth.registered', { actorUserId: userId, actorRole: 'client', targetType: 'user', targetId: userId, details: { platform: b.platform } });
    return c.json({ status: 'check_email', email: b.email }, 202);
  });

  /** Marks the address confirmed and the client's 'fiok' step done (the code was checked by the caller). */
  async function markEmailVerified(c: C, userId: string): Promise<void> {
    await deps.db.transaction(async (tx) => {
      await tx.update(users).set({ emailVerifiedAt: deps.now(), updatedAt: deps.now() }).where(eq(users.id, userId));
      const [cl] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId)).limit(1);
      if (cl)
        await tx
          .update(onboardingSteps)
          .set({ status: 'kesz', completedAt: deps.now(), updatedAt: deps.now() })
          .where(and(eq(onboardingSteps.clientId, cl.id), eq(onboardingSteps.step, 'fiok')));
      // signed in: the session's user; the sign-up code step has no session yet – the account itself
      await auditC(c, tx, 'auth.email_verified', { ...(c.get('auth') ? {} : { actorUserId: userId, actorRole: 'client' }), targetType: 'user', targetId: userId, clientId: cl?.id ?? null });
      // SPEC §31.6: the "regisztrált" conversion – nothing unless ads are on AND the account has a granted consent
      if (cl) await queueAdConversionSafe(deps, tx, { event: 'regisztracio', userId, ref: userId, userAgent: c.get('ua') });
    });
    deps.sessionCache.clear();
  }

  /** One answer for a wrong, expired or missing code and for an address without a fresh sign-up (never tells which). */
  const REGISTER_CODE_MESSAGE = 'Ez a kód nem jó, vagy már lejárt. Nézd meg újra a levelet, vagy kérj új kódot.';

  /**
   * k7b: the code from the sign-up mail opens the session (the new sign-up step after POST /auth/register). Only an
   * active client account whose address is not confirmed yet can be opened this way; everything else – no account,
   * a confirmed one, a wrong code – gets the same 400, so the endpoint tells nothing about the address either.
   */
  r.post('/register/verify', async (c) => {
    const b = await readJson(c, z.object({ email, code: z.string().trim().max(10), platform: z.enum(['web', 'android', 'ios']).default('web') }));
    limit(`regverify-ip:${c.get('ipHmac')}`, 20, 15 * 60_000);
    // per address AND caller: a stranger's wrong guesses cannot shut the owner out of typing his own code (ellenőr 11-20)
    limit(`regverify:${c.get('ipHmac')}:${k(b.email)}`, 10, 15 * 60_000);
    const [u] = await deps.db.select().from(users).where(eq(users.email, b.email)).limit(1);
    // The comparison runs for every address (same work), a code only counts for a fresh, unconfirmed client account.
    // Without a session nothing proves the caller, so the account-wide daily budget of S2 applies (accountCap): guesses
    // spread over many addresses and resends stay ≤ 30 a day. The way out of a used-up day is the password reset.
    const res = await checkCode(deps, deps.db, { email: b.email, purpose: 'verify_email', code: b.code, ipHmac: c.get('ipHmac'), accountCap: true });
    // ONE answer for everything – "túl sok próbálkozás" too: only an address with a real code could ever get that one
    if (res !== 'ok' || !u || u.role !== 'client' || u.status !== 'active' || u.emailVerifiedAt) throw E.validation({ code: REGISTER_CODE_MESSAGE });
    await markEmailVerified(c, u.id);
    // k8 JL 14 (LEVEL_LEFEDETTSEG #2): the welcome letter, once, right after the address is confirmed (never blocks)
    await welcomeMail(u.id, u.email).catch(() => undefined);
    const kind: ClientKind = b.platform === 'web' ? 'web' : 'native';
    return finishLogin(c, u.id, kind, { isNewUser: true, method: 'register' });
  });

  /** k7b: a new sign-up code by address (no session yet). Always 202; a code goes only to an unconfirmed client account. */
  r.post('/register/resend', async (c) => {
    const b = await readJson(c, z.object({ email }));
    limit(`resend-ip:${c.get('ipHmac')}`, 5, 3600_000);
    limit(`resend-mail:${k(b.email)}`, 3, 3600_000);
    const [u] = await deps.db.select().from(users).where(eq(users.email, b.email)).limit(1);
    if (u && u.role === 'client' && u.status === 'active' && !u.emailVerifiedAt && deps.mailer.mode !== 'disabled') {
      const code = await issueCode(deps, deps.db, { email: b.email, purpose: 'verify_email', userId: u.id, ipHmac: c.get('ipHmac') });
      await sendCodeEmail(deps, b.email, 'auth_email_code', code);
    }
    return c.json({ status: 'check_email', email: b.email }, 202);
  });

  // ---------- e-mail verification (signed in: an older sign-up, or the address changed by the admin) ----------
  r.post('/email/verify', authed, async (c) => {
    const a = auth(c);
    const b = await readJson(c, z.object({ code: z.string().trim().max(10) }));
    limit(`verify:${a.userId}`, 10, 15 * 60_000);
    const res = await checkCode(deps, deps.db, { email: a.email, purpose: 'verify_email', code: b.code, ipHmac: c.get('ipHmac') });
    if (res !== 'ok') throw E.validation({ code: CODE_MESSAGES[res] });
    await markEmailVerified(c, a.userId);
    return c.json({ emailVerified: true });
  });

  r.post('/email/resend', authed, async (c) => {
    const a = auth(c);
    limit(`resend-ip:${c.get('ipHmac')}`, 5, 3600_000);
    limit(`resend-mail:${k(a.email)}`, 3, 3600_000);
    if (a.emailVerified) return c.body(null, 204);
    if (deps.mailer.mode === 'disabled') throw E.notConfigured('Az e-mail-küldés még nincs beállítva.');
    const code = await issueCode(deps, deps.db, { email: a.email, purpose: 'verify_email', userId: a.userId, ipHmac: c.get('ipHmac') });
    await sendCodeEmail(deps, a.email, 'auth_email_code', code);
    return c.body(null, 204);
  });

  // ---------- login ----------
  r.post('/login', async (c) => {
    const b = await readJson(c, z.object({ email, password: z.string().max(128), clientKind, cancelDeletion: z.boolean().optional() }));
    limit(`login:${c.get('ipHmac')}:${k(b.email)}`, 10, 15 * 60_000);
    limit(`login-ip:${c.get('ipHmac')}`, 100, 15 * 60_000);
    const [u] = await deps.db.select().from(users).where(eq(users.email, b.email)).limit(1);
    const now = deps.now();
    // The password is always checked (same time for every case). A locked account answers exactly like
    // a wrong password – a 429 only for existing accounts would tell anyone which e-mails have one.
    // Round 1 (2026-11-19): the lock no longer shuts the owner out. It starts only when the wrong passwords came
    // from several addresses (one address is throttled on its own above), and it never applies to an address that
    // signed in to this account before – from there the correct password always works. The other way out is the
    // password reset (it clears the lock).
    const lockActive = Boolean(u?.lockedUntil && u.lockedUntil > now);
    const locked = lockActive && !(await knownAddress(u!.id, c.get('ipHmac')));
    const ok = await verifyPassword(u?.passwordHash, b.password);
    if (!u || !ok || locked) {
      if (u && !lockActive) {
        // Failures spread over weeks do not add up: the counter starts over after an hour without one.
        const recent = u.lastFailedLoginAt && now.getTime() - u.lastFailedLoginAt.getTime() < 3600_000;
        const failed = (recent ? u.failedLogins : 0) + 1;
        const addresses = noteFailure(u.id, c.get('ipHmac'), now.getTime());
        const lockNow = failed >= 10 && addresses >= LOCK_MIN_ADDRESSES;
        await deps.db
          .update(users)
          .set(lockNow ? { failedLogins: 0, lastFailedLoginAt: now, lockedUntil: new Date(now.getTime() + 15 * 60_000) } : { failedLogins: Math.min(failed, 1000), lastFailedLoginAt: now })
          .where(eq(users.id, u.id));
        await auditC(c, deps.db, 'auth.login_failed', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { locked: lockNow } });
        // k8 JL 15 (LEVEL_LEFEDETTSEG #4): the owner of the account hears about the lock (the way out: a new password)
        // review A12: its own footer line; sent in the background (the sign-in answer does not wait for the mail)
        if (lockNow) void sendTemplateMail(deps, { to: u.email, key: 'account_locked', lablec: { szoveg: 'Ezt a levelet azért kaptad, mert az Adózz.hu-s fiókodba többször rossz jelszóval próbáltak belépni.' }, params: { perc: 15 } }).catch(() => undefined);
      } else if (u) {
        await auditC(c, deps.db, 'auth.login_failed', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { whileLocked: true, passwordOk: ok, knownAddress: !locked } });
      } else {
        await auditC(c, deps.db, 'auth.login_failed', { actorUserId: null, actorRole: null, details: { known: false } });
      }
      throw E.unauthenticated(LOGIN_FAILED);
    }
    // k7b (S16, ellenőr 11-20): a client account whose address is not confirmed yet cannot sign in with the password.
    // POST /auth/register makes such an account with the password the REGISTRANT chose; if it could sign in, a stranger
    // could test "register X with P, then log in with P" – 200 for a new address, 401 for one that has an account – and
    // learn who is our client. So the answer is exactly the wrong-password answer (no failure counted), and the owner
    // gets a fresh code by mail: the app's sign-in screen offers "Írd be a kódot" (POST /auth/register/verify).
    if (u.role === 'client' && u.status === 'active' && !u.emailVerifiedAt) {
      const once = deps.limiter.hit(`login-unverified:${k(b.email)}`, 3, 3600_000);
      if (once.ok && deps.mailer.mode !== 'disabled') {
        const code = await issueCode(deps, deps.db, { email: b.email, purpose: 'verify_email', userId: u.id, ipHmac: c.get('ipHmac') });
        // with real SMTP after the answer (the response time must not differ from a wrong password)
        if (deps.mailer.mode === 'smtp') void sendCodeEmail(deps, b.email, 'auth_email_code', code);
        else await sendCodeEmail(deps, b.email, 'auth_email_code', code);
      }
      await auditC(c, deps.db, 'auth.login_unverified', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { mailed: once.ok } });
      throw E.unauthenticated(LOGIN_FAILED);
    }
    if (u.status === 'pending_deletion') {
      if (!b.cancelDeletion) {
        throw new ApiError(403, 'deletion_pending', 'A fiókod törlése folyamatban van. Ha meggondoltad magad, a belépéssel visszavonhatod.', undefined, {
          deletionDueAt: u.deletionDueAt?.toISOString() ?? null,
        });
      }
      // With 2FA on, the password alone must not undo the deletion: the intent travels in the MFA token
      // and /login/totp cancels it after the second factor.
      if (u.totpEnabledAt) {
        if (b.clientKind === 'panel' && u.role === 'client') throw E.forbidden('Ez a felület a könyvelőknek szól. Az appban lépj be.');
        const mfaToken = await signMfa(deps, u.id, b.clientKind, { cancelDeletion: true });
        await auditC(c, deps.db, 'auth.login_mfa_challenge', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { method: 'password' } });
        throw E.mfaRequired(mfaToken);
      }
      await cancelDeletion(deps, u.id);
      await auditC(c, deps.db, 'gdpr.delete_cancelled', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id });
    } else if (u.status !== 'active') {
      throw E.unauthenticated('Ez a fiók nem aktív.');
    }
    if (b.clientKind === 'panel' && u.role === 'client') {
      throw E.forbidden('Ez a felület a könyvelőknek szól. Az appban lépj be.');
    }
    return finishLogin(c, u.id, b.clientKind, { method: 'password' });
  });

  r.post('/login/totp', async (c) => {
    const b = await readJson(c, z.object({ mfaToken: z.string().max(2000), code: z.string().trim().max(40) }));
    const m = await verifyMfa(deps, b.mfaToken);
    if (!m) throw E.unauthenticated('A belépés lejárt. Kezdd újra.');
    limit(`totp:${c.get('ipHmac')}:${m.userId}`, 10, 15 * 60_000);
    limit(`totp-user:${m.userId}`, 30, 15 * 60_000);
    const now = deps.now();
    // The challenge must exist, be unused, unexpired and have < 5 failures (single-use mfaToken).
    const [ch] = await deps.db.select().from(mfaChallenges).where(eq(mfaChallenges.jti, m.jti)).limit(1);
    if (!ch || ch.userId !== m.userId || ch.consumedAt || ch.expiresAt <= now || ch.failures >= MFA_MAX_FAILURES) throw E.unauthenticated('A belépés lejárt. Kezdd újra.');
    const [u] = await deps.db.select().from(users).where(eq(users.id, m.userId)).limit(1);
    if (!u || !u.totpSecretEnc || !(u.status === 'active' || (u.status === 'pending_deletion' && m.cancelDeletion))) throw E.unauthenticated();
    // SPEC §27.11 S1: reaching this step proves the password, so the password-failure lock (locked_until, which
    // strangers can trigger with wrong passwords from 3 addresses) never applies here – only the lock that wrong
    // second-factor codes set (totp_locked_until).
    if (u.totpLockedUntil && u.totpLockedUntil > now) throw E.rateLimited((u.totpLockedUntil.getTime() - now.getTime()) / 1000);
    const ok = await checkTotpOrRecovery(u, b.code);
    if (!ok) {
      await deps.db.update(mfaChallenges).set({ failures: sql`${mfaChallenges.failures} + 1` }).where(eq(mfaChallenges.jti, m.jti));
      const [cnt] = await deps.db
        .update(users)
        .set({ totpFailures: sql`${users.totpFailures} + 1` })
        .where(eq(users.id, u.id))
        .returning({ n: users.totpFailures });
      const locked = (cnt?.n ?? 0) >= TOTP_MAX_FAILURES;
      if (locked) await deps.db.update(users).set({ totpFailures: 0, totpLockedUntil: new Date(now.getTime() + 15 * 60_000) }).where(eq(users.id, u.id));
      await auditC(c, deps.db, 'auth.login_failed', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { step: 'totp', locked } });
      if (locked) throw E.rateLimited(15 * 60);
      throw E.validation({ code: 'Ez a kód nem jó.' }, 'Ez a kód nem jó. Nézd meg újra a hitelesítő alkalmazásban.');
    }
    // Consume the challenge atomically: a token completes at most one login.
    const consumed = await deps.db
      .update(mfaChallenges)
      .set({ consumedAt: now })
      .where(and(eq(mfaChallenges.jti, m.jti), isNull(mfaChallenges.consumedAt)))
      .returning({ jti: mfaChallenges.jti });
    if (!consumed.length) throw E.unauthenticated('A belépés lejárt. Kezdd újra.');
    await deps.db.update(users).set({ totpFailures: 0 }).where(eq(users.id, u.id));
    if (u.status === 'pending_deletion' && m.cancelDeletion) {
      await cancelDeletion(deps, u.id);
      await auditC(c, deps.db, 'gdpr.delete_cancelled', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id });
    }
    const kind = (['native', 'web', 'panel'].includes(m.clientKind) ? m.clientKind : 'web') as ClientKind;
    const issued = await issueAuth(deps, deps.db, { userId: u.id, clientKind: kind, ua: c.get('ua'), ipHmac: c.get('ipHmac') });
    await auditC(c, deps.db, 'auth.login', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id, details: { method: 'totp', recovery: ok === 'recovery' } });
    return deliver(c, issued, kind);
  });

  /**
   * TOTP (with replay protection: the matched time step must be newer than the last accepted one,
   * stored atomically) or a recovery code (consumed under a row lock, so each works once).
   * Input is normalised: spaces, hyphens and invisible characters (e.g. U+2060) are ignored.
   */
  async function checkTotpOrRecovery(u: typeof users.$inferSelect, code: string): Promise<false | 'totp' | 'recovery'> {
    if (!u.totpSecretEnc) return false;
    const clean = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/^\d{6}$/.test(clean)) {
      const secret = base32Decode(deps.data.dec(u.totpSecretEnc, 'users.totp_secret'));
      const step = verifyTotp(secret, clean, deps.now().getTime());
      if (step === null) return false;
      const fresh = await deps.db
        .update(users)
        .set({ totpLastStep: step })
        .where(and(eq(users.id, u.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
        .returning({ id: users.id });
      return fresh.length ? 'totp' : false;
    }
    if (!/^[a-z0-9]{12}$/.test(clean)) return false;
    const canonical = `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
    return deps.db.transaction(async (tx) => {
      const [row] = await tx.select({ codes: users.recoveryCodes }).from(users).where(eq(users.id, u.id)).limit(1).for('update');
      const codes = row?.codes ?? [];
      for (let i = 0; i < codes.length; i++) {
        const rc = codes[i]!;
        if (rc.usedAt) continue;
        if (await argonVerify(rc.hash, canonical).catch(() => false)) {
          const next = codes.map((x, j) => (j === i ? { ...x, usedAt: deps.now().toISOString() } : x));
          await tx.update(users).set({ recoveryCodes: next }).where(eq(users.id, u.id));
          return 'recovery' as const;
        }
      }
      return false as const;
    });
  }

  // ---------- Google / Apple ----------
  async function social(
    c: C,
    p: Provider,
    token: string,
    kind: ClientKind,
    extra: { referralCode?: string; utm?: Record<string, string | undefined>; touch?: TouchInput; fullName?: { givenName?: string; familyName?: string } },
  ) {
    if (p === 'google' && deps.cfg.google.clientIds.length === 0) throw E.notConfigured('A Google-belépés még nincs bekapcsolva.');
    if (p === 'apple' && !deps.cfg.appleBundleId) throw E.notConfigured('Az Apple-belépés még nincs bekapcsolva.');
    limit(`social-ip:${c.get('ipHmac')}`, 30, 15 * 60_000);
    let id;
    try {
      id = await deps.verifyIdToken(p, token);
    } catch (err) {
      if (err instanceof ProviderUnavailable) throw E.upstream('A belépési szolgáltató most nem érhető el. Próbáld újra.');
      if (err instanceof TokenRejected) throw E.unauthenticated('A belépés nem sikerült. Próbáld újra.');
      throw err;
    }
    const subCol = p === 'google' ? users.googleSub : users.appleSub;
    const [bySub] = await deps.db.select().from(users).where(eq(subCol, id.sub)).limit(1);
    if (bySub) {
      if (bySub.status !== 'active') throw E.unauthenticated('Ez a fiók nem aktív.');
      if (kind === 'panel' && bySub.role === 'client') throw E.forbidden('Ez a felület a könyvelőknek szól. Az appban lépj be.');
      return finishLogin(c, bySub.id, kind, { method: p });
    }
    if (!id.email) throw E.validation(undefined, 'Nem kaptunk igazolt e-mail-címet a belépéshez. Regisztrálj e-mail-címmel.');
    const [byMail] = await deps.db.select().from(users).where(eq(users.email, id.email)).limit(1);
    if (byMail) {
      if (!byMail.emailVerifiedAt)
        // k7b: an unfinished password sign-up – signing in with that password mails a new code (POST /auth/login)
        throw E.conflict('Ezzel az e-mail-címmel már elkezdtél egy regisztrációt jelszóval. Lépj be azzal a jelszóval: küldünk egy kódot, és azzal befejezheted.');
      if (byMail.status !== 'active') throw E.unauthenticated('Ez a fiók nem aktív.');
      await deps.db.update(users).set(p === 'google' ? { googleSub: id.sub } : { appleSub: id.sub }).where(eq(users.id, byMail.id));
      await auditC(c, deps.db, 'auth.provider_linked', { actorUserId: byMail.id, actorRole: byMail.role, targetType: 'user', targetId: byMail.id, details: { provider: p } });
      if (kind === 'panel' && byMail.role === 'client') throw E.forbidden('Ez a felület a könyvelőknek szól. Az appban lépj be.');
      return finishLogin(c, byMail.id, kind, { method: p });
    }
    if (kind === 'panel') throw E.forbidden('Ehhez az e-mail-címhez nincs könyvelői fiók.');
    const first = (extra.fullName?.givenName ?? id.givenName ?? '').trim().slice(0, 60) || 'Ügyfél';
    const last = (extra.fullName?.familyName ?? id.familyName ?? '').trim().slice(0, 60);
    const { userId } = await deps.db.transaction((tx) =>
      createClientAccount(deps, tx, {
        email: id.email!,
        passwordHash: null,
        firstName: first,
        lastName: last,
        emailVerified: true,
        googleSub: p === 'google' ? id.sub : undefined,
        appleSub: p === 'apple' ? id.sub : undefined,
        referralCode: extra.referralCode,
        utm: extra.utm,
        landing: kind === 'native' ? (p === 'apple' ? 'ios' : 'android') : 'web',
        touch: { ...extra.touch, utm: extra.utm, platform: kind === 'native' ? (p === 'apple' ? 'ios' : 'android') : 'web' },
      }),
    );
    // SPEC §31.6: a Google / Apple sign-up is confirmed at once – the "regisztrált" conversion (only ads on + consent)
    await queueAdConversionSafe(deps, deps.db, { event: 'regisztracio', userId, ref: userId, userAgent: c.get('ua') });
    return finishLogin(c, userId, kind, { method: p, isNewUser: true });
  }

  r.post('/google', async (c) => {
    const b = await readJson(c, z.object({ idToken: z.string().min(10).max(5000), clientKind, referralCode: referral, utm, forras, entry, hirdetes }));
    return social(c, 'google', b.idToken, b.clientKind, { referralCode: b.referralCode, utm: b.utm, touch: { source: b.forras, entry: b.entry, ad: b.hirdetes } });
  });

  r.post('/apple', async (c) => {
    const b = await readJson(
      c,
      z.object({
        identityToken: z.string().min(10).max(5000),
        fullName: z.object({ givenName: z.string().max(60).optional().nullable(), familyName: z.string().max(60).optional().nullable() }).optional().nullable(),
        clientKind,
        referralCode: referral,
        utm,
        forras,
        entry,
        hirdetes,
      }),
    );
    return social(c, 'apple', b.identityToken, b.clientKind, {
      referralCode: b.referralCode,
      utm: b.utm,
      touch: { source: b.forras, entry: b.entry, ad: b.hirdetes },
      fullName: b.fullName ? { givenName: b.fullName.givenName ?? undefined, familyName: b.fullName.familyName ?? undefined } : undefined,
    });
  });

  // ---------- refresh / logout ----------
  r.post('/refresh', async (c) => {
    limit(`refresh-ip:${c.get('ipHmac')}`, 120, 5 * 60_000);
    const text = await c.req.text();
    assertJsonContentType(c, text);
    let bodyToken: string | undefined;
    if (text.trim()) {
      try {
        const j = JSON.parse(text) as { refreshToken?: unknown };
        if (typeof j.refreshToken === 'string') bodyToken = j.refreshToken;
      } catch {
        throw E.validation(undefined, 'A kérés nem érvényes JSON.');
      }
    }
    let presented = bodyToken;
    let viaCookie = false;
    if (!presented) {
      if (c.req.header('x-kezjegy') !== '1') throw E.forbidden('Hiányzó biztonsági fejléc.');
      presented = getCookie(c, COOKIE);
      viaCookie = true;
    }
    if (!presented || presented.length > 200) throw E.unauthenticated();
    const res = await rotateRefresh(deps, presented, c.get('ua'), c.get('ipHmac'));
    if (!res.ok) {
      if (viaCookie) deleteCookie(c, COOKIE, { path: COOKIE_PATH, secure: true });
      deleteCookie(c, LEGACY_COOKIE, { path: LEGACY_PATH, secure: true });
      if (res.reason === 'reused') await auditC(c, deps.db, 'auth.refresh_reuse_detected', { actorUserId: null, actorRole: null });
      throw E.unauthenticated();
    }
    const [u] = await deps.db.select().from(users).where(eq(users.id, res.userId)).limit(1);
    const acc = await signAccess(deps, { userId: u!.id, role: u!.role, sessionId: res.sessionId });
    const result = {
      accessToken: acc.token,
      accessTokenExpiresAt: acc.expiresAt.toISOString(),
      refreshToken: viaCookie ? undefined : res.refreshToken,
      user: { id: u!.id, email: u!.email, role: u!.role, displayName: u!.displayName ?? '', emailVerified: Boolean(u!.emailVerifiedAt), totpEnabled: Boolean(u!.totpEnabledAt) },
    };
    if (viaCookie) setCookie(c, COOKIE, res.refreshToken, { httpOnly: true, secure: true, sameSite: 'Strict', path: COOKIE_PATH, expires: res.expiresAt });
    return c.json(result);
  });

  r.post('/logout', authed, async (c) => {
    // Authenticated by the Bearer access token (an attacker's page cannot set that header), so the
    // cookie CSRF check of /refresh is not needed here; the refresh cookie is cleared below.
    const a = auth(c);
    await revokeSession(deps, deps.db, a.sessionId);
    deleteCookie(c, COOKIE, { path: COOKIE_PATH, secure: true });
    await auditC(c, deps.db, 'auth.logout', { targetType: 'session', targetId: a.sessionId });
    return c.body(null, 204);
  });

  r.post('/logout-all', authed, async (c) => {
    const a = auth(c);
    await revokeAllSessions(deps, deps.db, a.userId);
    deleteCookie(c, COOKIE, { path: COOKIE_PATH, secure: true });
    await auditC(c, deps.db, 'auth.logout', { targetType: 'user', targetId: a.userId, details: { all: true } });
    return c.body(null, 204);
  });

  // ---------- password ----------
  r.post('/password/forgot', async (c) => {
    limit(`forgot-ip:${c.get('ipHmac')}`, 5, 3600_000);
    const b = await readJson(c, z.object({ email }));
    // Per e-mail AND address (3/h), plus a wider cap per e-mail against mail-bombing: one stranger asking for codes
    // can no longer use up the owner's own quota (round 1, 2026-11-19).
    limit(`forgot-mail:${k(b.email)}:${c.get('ipHmac')}`, 3, 3600_000);
    limit(`forgot-mail-all:${k(b.email)}`, 5, 3600_000);
    if (deps.mailer.mode === 'disabled') throw E.notConfigured('Az e-mail-küldés még nincs beállítva.');
    const [u] = await deps.db.select({ id: users.id, status: users.status }).from(users).where(eq(users.email, b.email)).limit(1);
    // SPEC §27.11 S2: at most 5 reset codes per account and hour, counted in the DB (survives restarts); the answer
    // stays the same 202 (no hint whether the address exists or the cap was reached).
    const recentCodes = u ? await codesIssuedSince(deps, b.email, 'password_reset', new Date(deps.now().getTime() - 3600_000)) : 0;
    if (u && u.status === 'active' && recentCodes < 5) {
      const code = await issueCode(deps, deps.db, { email: b.email, purpose: 'password_reset', userId: u.id, ipHmac: c.get('ipHmac') });
      // With real SMTP the mail goes out after the answer: the response time must not tell whether the account
      // exists. (DEMO writes one row into the outbox; tests and the demo read it right away, so it stays inline.)
      if (deps.mailer.mode === 'smtp') void sendCodeEmail(deps, b.email, 'auth_password_reset_code', code);
      else await sendCodeEmail(deps, b.email, 'auth_password_reset_code', code);
    }
    return c.json({ ok: true }, 202);
  });

  r.post('/password/reset', async (c) => {
    limit(`reset-ip:${c.get('ipHmac')}`, 20, 3600_000);
    const b = await readJson(c, z.object({ email, code: z.string().trim().max(10), newPassword: z.string().max(128) }));
    limit(`reset-mail:${k(b.email)}:${c.get('ipHmac')}`, 10, 3600_000);
    const pw = passwordProblem(b.newPassword, b.email);
    if (pw) throw E.validation({ newPassword: pw });
    const [u] = await deps.db.select().from(users).where(eq(users.email, b.email)).limit(1);
    // SPEC §27.11 S2: an address that signed in to this account before is trusted; every other address shares one
    // account-wide budget of comparisons per 24 h (codes are guessed in parallel from many addresses otherwise).
    const trusted = u ? await knownAddress(u.id, c.get('ipHmac')) : false;
    let res = await checkCode(deps, deps.db, { email: b.email, purpose: 'password_reset', code: b.code, ipHmac: c.get('ipHmac'), trustedAddress: trusted });
    if (res === 'none' && u && u.role !== 'client') res = await checkCode(deps, deps.db, { email: b.email, purpose: 'staff_invite', code: b.code, ipHmac: c.get('ipHmac'), trustedAddress: trusted });
    // One answer for "wrong", "expired" and "no code": an unknown e-mail (never has a code) must not read differently.
    if (res !== 'ok' || !u || u.status !== 'active') throw E.validation({ code: res === 'too_many' ? CODE_MESSAGES.too_many : RESET_CODE_MESSAGE });
    // The new password of an existing account must differ from the current one (a "reset" to the same password
    // would only end the other sessions and send a misleading security mail).
    if (u.passwordHash && (await verifyPassword(u.passwordHash, b.newPassword))) {
      // the code is spent; issue nothing new – the user simply signs in with the password he evidently knows
      throw E.validation({ newPassword: 'Ez a mostani jelszavad. Lépj be vele, vagy adj meg egy másikat (ehhez kérj új kódot).' });
    }
    const passwordHash = await hashPassword(b.newPassword);
    await deps.db
      .update(users)
      .set({
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
        totpLockedUntil: null,
        emailVerifiedAt: u.emailVerifiedAt ?? deps.now(),
        // SPEC §27.11 S7: the reset that confirms the mailbox for the FIRST time proves who owns the address – a 2FA
        // bound earlier (by whoever registered it) goes away; the real owner sets up his own.
        ...(u.emailVerifiedAt ? {} : { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, recoveryCodes: null, totpLastStep: null, totpFailures: 0 }),
        updatedAt: deps.now(),
      })
      .where(eq(users.id, u.id));
    await revokeAllSessions(deps, deps.db, u.id);
    await auditC(c, deps.db, 'auth.password_reset', { actorUserId: u.id, actorRole: u.role, targetType: 'user', targetId: u.id });
    // The owner always learns about a reset (a reset someone else triggered is then noticed).
    await sendCodeEmail(deps, u.email, 'auth_password_changed', '');
    return c.body(null, 204);
  });

  r.post('/password/change', authed, async (c) => {
    const a = auth(c);
    limit(`pwchange:${a.userId}`, 10, 15 * 60_000);
    const b = await readJson(c, z.object({ currentPassword: z.string().max(128).optional(), newPassword: z.string().max(128) }));
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (!u) throw E.unauthenticated();
    if (u.passwordHash && !(await verifyPassword(u.passwordHash, b.currentPassword ?? ''))) throw E.validation({ currentPassword: 'Ez nem a mostani jelszavad.' });
    // Google/Apple-only account: setting the first password needs a fresh sign-in, so a stolen refresh token
    // cannot be turned into a permanent password login.
    if (!u.passwordHash && !(await freshSignIn(deps, a.sessionId))) throw new ApiError(403, 'reauth_required', 'Biztonsági okból lépj ki, majd be újra (Google vagy Apple), és utána állítsd be a jelszót.');
    const pw = passwordProblem(b.newPassword, u.email);
    if (pw) throw E.validation({ newPassword: pw });
    if (u.passwordHash && (await verifyPassword(u.passwordHash, b.newPassword))) throw E.validation({ newPassword: 'Az új jelszó nem lehet ugyanaz, mint a mostani.' });
    await deps.db.update(users).set({ passwordHash: await hashPassword(b.newPassword), updatedAt: deps.now() }).where(eq(users.id, u.id));
    // Keep this session, end the others.
    const [cur] = await deps.db.select({ familyId: sessions.familyId }).from(sessions).where(eq(sessions.id, a.sessionId)).limit(1);
    const others = await deps.db.select({ id: sessions.id, familyId: sessions.familyId }).from(sessions).where(and(eq(sessions.userId, u.id), isNull(sessions.revokedAt)));
    for (const s of others) if (s.familyId !== cur?.familyId) await deps.db.update(sessions).set({ revokedAt: deps.now() }).where(eq(sessions.id, s.id));
    deps.sessionCache.clear();
    await auditC(c, deps.db, 'auth.password_changed', { targetType: 'user', targetId: u.id, details: { first: !u.passwordHash } });
    await sendCodeEmail(deps, u.email, 'auth_password_changed', '');
    return c.body(null, 204);
  });

  // ---------- TOTP ----------
  r.post('/totp/setup', authed, async (c) => {
    const a = auth(c);
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (!u) throw E.unauthenticated();
    if (u.totpEnabledAt) throw E.conflict('A kétlépcsős belépés már be van kapcsolva.');
    // SPEC §27.11 S7: a stranger who registered somebody else's address must not bind his authenticator to it.
    if (!u.emailVerifiedAt) throw new ApiError(409, 'email_not_verified', 'Előbb erősítsd meg az e-mail-címedet.');
    // A stolen session must not be able to bind the thief's authenticator (the owner would be locked
    // out: a password reset does not remove 2FA). Right after signing in it is fine; later the current
    // password is needed (Google/Apple-only accounts: sign in again).
    const b = await readJson(c, z.object({ currentPassword: z.string().max(128).optional() }).passthrough()).catch(() => ({ currentPassword: undefined }));
    await requireRecentAuth(u, a.sessionId, b.currentPassword);
    const secret = newTotpSecret();
    await deps.db.update(users).set({ totpPendingEnc: deps.data.enc(secret, 'users.totp_pending') }).where(eq(users.id, u.id));
    return c.json({ secret, otpauthUrl: otpauthUrl(secret, u.email, brand.name) });
  });

  r.post('/totp/enable', authed, async (c) => {
    const a = auth(c);
    limit(`totp-enable:${a.userId}`, 10, 15 * 60_000);
    const b = await readJson(c, z.object({ code: z.string().trim().max(10), currentPassword: z.string().max(128).optional() }));
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (u && !u.emailVerifiedAt) throw new ApiError(409, 'email_not_verified', 'Előbb erősítsd meg az e-mail-címedet.');
    if (!u?.totpPendingEnc) throw E.conflict('Előbb kérj új kulcsot (beállítás indítása).');
    await requireRecentAuth(u, a.sessionId, b.currentPassword);
    const secretB32 = deps.data.dec(u.totpPendingEnc, 'users.totp_pending');
    const step = verifyTotp(base32Decode(secretB32), b.code.replace(/\D/g, ''), deps.now().getTime());
    if (step === null) throw E.validation({ code: 'Ez a kód nem jó. Nézd meg az órát a telefonodon is.' }, 'Ez a kód nem jó. Nézd meg az órát a telefonodon is.');
    const codes = newRecoveryCodes(10);
    const hashed = await Promise.all(codes.map(async (rc) => ({ hash: await argonHash(rc, RECOVERY_OPTS), usedAt: null })));
    await deps.db
      .update(users)
      .set({ totpSecretEnc: deps.data.enc(secretB32, 'users.totp_secret'), totpPendingEnc: null, totpEnabledAt: deps.now(), recoveryCodes: hashed, totpLastStep: step, totpFailures: 0 })
      .where(eq(users.id, u.id));
    // Every other sign-in ends (a session someone else holds does not survive the new 2FA).
    const [cur] = await deps.db.select({ familyId: sessions.familyId }).from(sessions).where(eq(sessions.id, a.sessionId)).limit(1);
    await deps.db
      .update(sessions)
      .set({ revokedAt: deps.now() })
      .where(and(eq(sessions.userId, u.id), isNull(sessions.revokedAt), cur ? sql`${sessions.familyId} <> ${cur.familyId}` : sql`true`));
    deps.sessionCache.clear();
    await auditC(c, deps.db, 'auth.totp_enabled', { targetType: 'user', targetId: u.id });
    await sendCodeEmail(deps, u.email, 'auth_totp_changed', '');
    return c.json({ recoveryCodes: codes });
  });

  r.post('/totp/disable', authed, async (c) => {
    const a = auth(c);
    limit(`totp-disable:${a.userId}`, 10, 15 * 60_000);
    const b = await readJson(c, z.object({ password: z.string().max(128).optional(), code: z.string().trim().max(20) }));
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (!u?.totpEnabledAt) return c.body(null, 204);
    if (u.passwordHash && !(await verifyPassword(u.passwordHash, b.password ?? ''))) throw E.validation({ password: 'A jelszó nem jó.' });
    if (!(await checkTotpOrRecovery(u, b.code))) throw E.validation({ code: 'Ez a kód nem jó.' });
    if (deps.cfg.staffTotpRequired && u.role !== 'client') throw E.forbidden('A könyvelői fiókokon kötelező a kétlépcsős belépés.');
    await deps.db.update(users).set({ totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, recoveryCodes: null, totpLastStep: null, totpFailures: 0 }).where(eq(users.id, u.id));
    deps.sessionCache.clear();
    await auditC(c, deps.db, 'auth.totp_disabled', { targetType: 'user', targetId: u.id });
    await sendCodeEmail(deps, u.email, 'auth_totp_changed', '');
    return c.body(null, 204);
  });

  // ---------- sessions ----------
  r.get('/sessions', authed, async (c) => {
    const a = auth(c);
    const rows = await deps.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, a.userId), isNull(sessions.revokedAt), isNull(sessions.rotatedAt)))
      .orderBy(desc(sessions.lastUsedAt));
    const now = deps.now();
    return c.json({
      items: rows
        .filter((s) => s.expiresAt > now && s.idleExpiresAt > now)
        .map((s) => ({ id: s.id, clientKind: s.clientKind, userAgent: s.userAgent ?? '', lastUsedAt: s.lastUsedAt.toISOString(), current: s.id === a.sessionId })),
    });
  });

  r.delete('/sessions/:id', authed, async (c) => {
    const a = auth(c);
    const id = param(c, 'id');
    const [s] = await deps.db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, a.userId))).limit(1);
    if (!s) throw E.notFound();
    await revokeSession(deps, deps.db, s.id);
    await auditC(c, deps.db, 'auth.logout', { targetType: 'session', targetId: s.id });
    return c.body(null, 204);
  });

  return r;
}
