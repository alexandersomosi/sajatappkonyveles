// Auth (SPEC §4.1, §12.2): register → verify → login → refresh rotation + reuse detection →
// logout; password reset by e-mail code; TOTP; lockout; Google not configured; staff TOTP rule.
import { desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, emailCodes, users } from '../src/db/schema.js';
import { loadConfig } from '../src/config.js';
import { base32Decode, totp } from '../src/lib/totp.js';
import { lastCode, newClient, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
beforeAll(async () => {
  h = await setup();
});
afterAll(async () => h.close());

describe('register and e-mail verification', () => {
  it('registers a client, e-mails a 6-digit code, verifies', async () => {
    const r = await h.json('POST', '/auth/register', { body: { email: 'Uj.Ugyfel@demo.kezjegy.test', password: PW, firstName: 'Anna', lastName: 'Teszt', platform: 'android' } });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ email: 'uj.ugyfel@demo.kezjegy.test', role: 'client', emailVerified: false });
    expect(r.body.refreshToken).toBeTruthy(); // native gets the refresh token in the body
    const code = lastCode(h, 'uj.ugyfel@demo.kezjegy.test');
    const wrong = await h.json('POST', '/auth/email/verify', { token: r.body.accessToken, body: { code: code === '000000' ? '111111' : '000000' } });
    expect(wrong.status).toBe(400);
    const ok = await h.json('POST', '/auth/email/verify', { token: r.body.accessToken, body: { code } });
    expect(ok.body).toEqual({ emailVerified: true });
    const onb = await h.json('GET', '/client/onboarding', { token: r.body.accessToken });
    expect(onb.body.steps.find((s: { step: string }) => s.step === 'fiok').status).toBe('kesz');
  });

  it('rejects weak passwords and duplicate e-mails', async () => {
    const weak = await h.json('POST', '/auth/register', { body: { email: 'gyenge@demo.kezjegy.test', password: 'qwertzuiop', firstName: 'A', lastName: 'B', platform: 'web' } });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBeTruthy();
    const dup = await h.json('POST', '/auth/register', { body: { email: 'uj.ugyfel@demo.kezjegy.test', password: PW, firstName: 'A', lastName: 'B', platform: 'web' } });
    expect(dup.status).toBe(409);
  });
});

describe('login, refresh rotation, reuse detection, logout', () => {
  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const c = await newClient(h, 'rotacio@demo.kezjegy.test');
    const login = await h.json('POST', '/auth/login', { body: { email: 'rotacio@demo.kezjegy.test', password: PW, clientKind: 'native' } });
    expect(login.status).toBe(200);
    const rt1 = login.body.refreshToken as string;
    const r2 = await h.json('POST', '/auth/refresh', { body: { refreshToken: rt1 } });
    expect(r2.status).toBe(200);
    const rt2 = r2.body.refreshToken as string;
    expect(rt2).not.toBe(rt1);
    // reuse of the rotated token after the grace minute → whole family revoked, even the new one stops working
    h.clock.advance(61_000);
    const reuse = await h.json('POST', '/auth/refresh', { body: { refreshToken: rt1 } });
    expect(reuse.status).toBe(401);
    const after = await h.json('POST', '/auth/refresh', { body: { refreshToken: rt2 } });
    expect(after.status).toBe(401);
    const me = await h.json('GET', '/me', { token: r2.body.accessToken });
    expect(me.status).toBe(401);
    void c;
  });

  it('a lost refresh response or two tabs: the rotated token works for a minute, without revoking anything', async () => {
    await newClient(h, 'grace@demo.kezjegy.test');
    const login = await h.json('POST', '/auth/login', { body: { email: 'grace@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.140' } });
    const rt1 = login.body.refreshToken as string;
    const [a, b] = await Promise.all([h.json('POST', '/auth/refresh', { body: { refreshToken: rt1 } }), h.json('POST', '/auth/refresh', { body: { refreshToken: rt1 } })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // the "lost" response's token and the winner's token both keep working
    h.clock.advance(5_000);
    expect((await h.json('POST', '/auth/refresh', { body: { refreshToken: a.body.refreshToken } })).status).toBe(200);
    expect((await h.json('POST', '/auth/refresh', { body: { refreshToken: b.body.refreshToken } })).status).toBe(200);
    // a few retries are fine, a flood within the minute counts as theft
    h.clock.advance(1_000);
    const more = [];
    for (let i = 0; i < 4; i++) more.push((await h.json('POST', '/auth/refresh', { body: { refreshToken: rt1 } })).status);
    expect(more.at(-1)).toBe(401);
  });

  it('web refresh needs the cookie and the X-Kezjegy header', async () => {
    await newClient(h, 'web@demo.kezjegy.test');
    const login = await h.req('POST', '/auth/login', { body: { email: 'web@demo.kezjegy.test', password: PW, clientKind: 'web' } });
    const setCookie = login.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/__Host-kj_rt=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/(;|$)/);
    expect(setCookie).not.toMatch(/Domain=/i);
    const body = (await login.json()) as { refreshToken?: string };
    expect(body.refreshToken).toBeUndefined();
    const cookie = setCookie.split(';')[0]!;
    const noHeader = await h.json('POST', '/auth/refresh', { headers: { cookie } });
    expect(noHeader.status).toBe(403);
    const ok = await h.json('POST', '/auth/refresh', { headers: { cookie, 'x-kezjegy': '1' } });
    expect(ok.status).toBe(200);
  });

  it('logout revokes the session', async () => {
    const c = await newClient(h, 'kilep@demo.kezjegy.test');
    expect((await h.json('GET', '/me', { token: c.token })).status).toBe(200);
    expect((await h.json('POST', '/auth/logout', { token: c.token })).status).toBe(204);
    expect((await h.json('GET', '/me', { token: c.token })).status).toBe(401);
    expect((await h.json('POST', '/auth/refresh', { body: { refreshToken: c.refreshToken } })).status).toBe(401);
  });

  it('wrong password is 401 with a plain Hungarian message; 10 failures lock the account', async () => {
    await newClient(h, 'zarolas@demo.kezjegy.test');
    for (let i = 0; i < 10; i++) {
      const r = await h.json('POST', '/auth/login', { body: { email: 'zarolas@demo.kezjegy.test', password: 'rossz-jelszo-123', clientKind: 'native' }, headers: { 'x-forwarded-for': `198.51.100.${i}` } });
      expect(r.status).toBe(401);
    }
    const locked = await h.json('POST', '/auth/login', { body: { email: 'zarolas@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.99' } });
    // A locked account answers exactly like a wrong password or an unknown e-mail (no existence oracle).
    expect(locked.status).toBe(401);
    const unknown = await h.json('POST', '/auth/login', { body: { email: 'nincs-ilyen@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.97' } });
    expect(unknown.status).toBe(401);
    expect(locked.body).toEqual(unknown.body);
    h.clock.advance(16 * 60_000);
    const ok = await h.json('POST', '/auth/login', { body: { email: 'zarolas@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.98' } });
    expect(ok.status).toBe(200);
    const fails = await h.deps.db.select().from(auditLog).where(eq(auditLog.action, 'auth.login_failed'));
    expect(fails.length).toBeGreaterThanOrEqual(10);
    expect(JSON.stringify(fails.map((f) => f.details))).not.toContain('rossz-jelszo');
  });

  it('failures spread over hours do not add up to a lock', async () => {
    await newClient(h, 'lassu@demo.kezjegy.test');
    for (let i = 0; i < 15; i++) {
      await h.json('POST', '/auth/login', { body: { email: 'lassu@demo.kezjegy.test', password: 'rossz-jelszo-123', clientKind: 'native' }, headers: { 'x-forwarded-for': `198.51.102.${i}` } });
      h.clock.advance(2 * 3600_000);
    }
    const ok = await h.json('POST', '/auth/login', { body: { email: 'lassu@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.102.200' } });
    expect(ok.status).toBe(200);
  });

  it('a client cannot use the panel login', async () => {
    const r = await h.json('POST', '/auth/login', { body: { email: 'web@demo.kezjegy.test', password: PW, clientKind: 'panel' }, headers: { 'x-forwarded-for': '198.51.100.200' } });
    expect(r.status).toBe(403);
  });
});

describe('password reset by e-mail code', () => {
  it('resets, revokes sessions, unknown e-mail still answers 202', async () => {
    const c = await newClient(h, 'feledekeny@demo.kezjegy.test');
    expect((await h.json('POST', '/auth/password/forgot', { body: { email: 'nincs.ilyen@demo.kezjegy.test' } })).status).toBe(202);
    expect((await h.json('POST', '/auth/password/forgot', { body: { email: 'feledekeny@demo.kezjegy.test' } })).status).toBe(202);
    const code = lastCode(h, 'feledekeny@demo.kezjegy.test');
    const bad = await h.json('POST', '/auth/password/reset', { body: { email: 'feledekeny@demo.kezjegy.test', code: '000001', newPassword: 'Uj-Hosszu-Jelszo-77' } });
    expect(bad.status).toBe(400);
    const ok = await h.json('POST', '/auth/password/reset', { body: { email: 'feledekeny@demo.kezjegy.test', code, newPassword: 'Uj-Hosszu-Jelszo-77' } });
    expect(ok.status).toBe(204);
    expect((await h.json('GET', '/me', { token: c.token })).status).toBe(401);
    const reuse = await h.json('POST', '/auth/password/reset', { body: { email: 'feledekeny@demo.kezjegy.test', code, newPassword: 'Masik-Hosszu-Jelszo-88' } });
    expect(reuse.status).toBe(400);
    const login = await h.json('POST', '/auth/login', { body: { email: 'feledekeny@demo.kezjegy.test', password: 'Uj-Hosszu-Jelszo-77', clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.201' } });
    expect(login.status).toBe(200);
  });
});

describe('TOTP 2FA', () => {
  it('setup → enable → login needs the code → recovery code works once', async () => {
    const c = await newClient(h, 'totp@demo.kezjegy.test');
    const setupRes = await h.json('POST', '/auth/totp/setup', { token: c.token });
    expect(setupRes.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    const secret = base32Decode(setupRes.body.secret);
    const en = await h.json('POST', '/auth/totp/enable', { token: c.token, body: { code: totp(secret, h.clock.now().getTime()) } });
    expect(en.status).toBe(200);
    expect(en.body.recoveryCodes).toHaveLength(10);
    const [u] = await h.deps.db.select().from(users).where(eq(users.id, c.userId));
    expect(u!.totpSecretEnc).toBeTruthy();
    expect(u!.totpSecretEnc).not.toContain(setupRes.body.secret);
    const login = await h.json('POST', '/auth/login', { body: { email: 'totp@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.202' } });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('mfa_required');
    // The code used to switch 2FA on cannot be replayed for a login (same time step).
    const replayed = await h.json('POST', '/auth/login/totp', { body: { mfaToken: login.body.mfaToken, code: totp(secret, h.clock.now().getTime()) } });
    expect(replayed.status).toBe(400);
    expect(replayed.body.error.fields.code).toBe('Ez a kód nem jó.');
    h.clock.advance(31_000);
    const code = totp(secret, h.clock.now().getTime());
    const ok = await h.json('POST', '/auth/login/totp', { body: { mfaToken: login.body.mfaToken, code } });
    expect(ok.status).toBe(200);
    // The mfaToken is single-use …
    expect((await h.json('POST', '/auth/login/totp', { body: { mfaToken: login.body.mfaToken, code } })).status).toBe(401);
    // … and the same TOTP code does not work for a second login.
    const loginB = await h.json('POST', '/auth/login', { body: { email: 'totp@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.212' } });
    expect((await h.json('POST', '/auth/login/totp', { body: { mfaToken: loginB.body.mfaToken, code } })).status).toBe(400);
    const login2 = await h.json('POST', '/auth/login', { body: { email: 'totp@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.203' } });
    const rc = en.body.recoveryCodes[0] as string;
    // A code copied from the screen with an invisible word joiner (U+2060) after the hyphens still works.
    const withJoiner = rc.replace(/-/g, '-\u2060').toUpperCase();
    expect((await h.json('POST', '/auth/login/totp', { body: { mfaToken: login2.body.mfaToken, code: withJoiner } })).status).toBe(200);
    const login3 = await h.json('POST', '/auth/login', { body: { email: 'totp@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.204' } });
    expect((await h.json('POST', '/auth/login/totp', { body: { mfaToken: login3.body.mfaToken, code: rc } })).status).toBe(400);
  });
});

describe('social sign-in without keys', () => {
  it('Google and Apple answer 503 not_configured; /config hides them', async () => {
    const g = await h.json('POST', '/auth/google', { body: { idToken: 'x'.repeat(40), clientKind: 'native' } });
    expect(g.status).toBe(503);
    expect(g.body.error.code).toBe('not_configured');
    const a = await h.json('POST', '/auth/apple', { body: { identityToken: 'x'.repeat(40), clientKind: 'native' } });
    expect(a.status).toBe(503);
    const cfg = await h.json('GET', '/config');
    expect(cfg.body.features).toMatchObject({ googleSignIn: false, appleSignIn: false, totp: true });
    expect(cfg.body.demo).toBe(true);
  });
});

describe('TOTP brute force', () => {
  it('5 wrong codes kill the mfaToken and 5 more lock the account, from any IP', async () => {
    const c = await newClient(h, 'totpbf@demo.kezjegy.test');
    const st = await h.json('POST', '/auth/totp/setup', { token: c.token });
    const secret = base32Decode(st.body.secret);
    await h.json('POST', '/auth/totp/enable', { token: c.token, body: { code: totp(secret, h.clock.now().getTime()) } });
    h.clock.advance(31_000);
    const l = await h.json('POST', '/auth/login', { body: { email: 'totpbf@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.230' } });
    let last = 0;
    for (let i = 0; i < 5; i++) last = (await h.json('POST', '/auth/login/totp', { body: { mfaToken: l.body.mfaToken, code: '000000' }, headers: { 'x-forwarded-for': `198.51.101.${i}` } })).status;
    expect(last).toBe(429);
    // The account is locked now: even the right code on a fresh token is refused.
    const right = totp(secret, h.clock.now().getTime());
    const l2 = await h.json('POST', '/auth/login', { body: { email: 'totpbf@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.231' } });
    expect(l2.status).toBe(401);
    expect((await h.json('POST', '/auth/login/totp', { body: { mfaToken: l.body.mfaToken, code: right } })).status).toBe(401);
  });
});

describe('logout on the web', () => {
  it('a Bearer logout works even when the browser also sends the refresh cookie, and the cookie is dead afterwards', async () => {
    const r = await h.json('POST', '/auth/register', { body: { email: 'webki@demo.kezjegy.test', password: PW, firstName: 'Web', lastName: 'Kilépő', platform: 'web' }, headers: { 'x-forwarded-for': '198.51.100.240' } });
    expect(r.status).toBe(201);
    const cookie = (r.res.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(cookie).toMatch(/^__Host-kj_rt=/);
    const out = await h.req('POST', '/auth/logout', { token: r.body.accessToken, headers: { cookie } });
    expect(out.status).toBe(204);
    const again = await h.req('POST', '/auth/refresh', { headers: { cookie, 'x-kezjegy': '1' } });
    expect(again.status).toBe(401);
  });
});

describe('e-mail codes under parallel guessing', () => {
  it('at most 5 attempts are ever counted, and the right code fails afterwards', async () => {
    const email = 'parhuzamos@demo.kezjegy.test';
    await newClient(h, email);
    await h.json('POST', '/auth/password/forgot', { body: { email }, headers: { 'x-forwarded-for': '198.51.102.1' } });
    const code = lastCode(h, email);
    const wrong = code === '111111' ? '222222' : '111111';
    const res = await Promise.all(
      Array.from({ length: 12 }, (_, i) => h.json('POST', '/auth/password/reset', { body: { email, code: wrong, newPassword: 'Uj-Nagyon-Hosszu-Jelszo-1' }, headers: { 'x-forwarded-for': `198.51.103.${i}` } })),
    );
    expect(res.every((x) => x.status === 400 || x.status === 429)).toBe(true);
    const [row] = await h.deps.db.select().from(emailCodes).where(eq(emailCodes.email, email)).orderBy(desc(emailCodes.createdAt)).limit(1);
    expect(row!.attempts).toBeLessThanOrEqual(5);
    const ok = await h.json('POST', '/auth/password/reset', { body: { email, code, newPassword: 'Uj-Nagyon-Hosszu-Jelszo-1' }, headers: { 'x-forwarded-for': '198.51.104.1' } });
    expect([400, 429]).toContain(ok.status);
  });
});

describe('duplicate sign-up', () => {
  it('answers 409, never 500', async () => {
    const body = { email: 'dupla@demo.kezjegy.test', password: PW, firstName: 'Dupla', lastName: 'Teszt', platform: 'android' };
    const res = await Promise.all([0, 1, 2].map((i) => h.json('POST', '/auth/register', { body, headers: { 'x-forwarded-for': `198.51.105.${i}` } })));
    expect(res.map((x) => x.status).sort()).toEqual([201, 409, 409]);
  });
});

describe('staff TOTP requirement', () => {
  it('accountant without TOTP gets 403 totp_setup_required on staff routes', async () => {
    expect(() => loadConfig({ ...process.env, APP_ENV: 'production', STAFF_TOTP_REQUIRED: 'false' })).toThrow(/STAFF_TOTP_REQUIRED/);
    const h2 = await setup({ env: { STAFF_TOTP_REQUIRED: 'true' } });
    try {
      const acc = await staff(h2, 'accountant', 'bence@demo.kezjegy.test');
      const r = await h2.json('GET', '/acc/clients', { token: acc.token });
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('totp_setup_required');
      expect((await h2.json('GET', '/me', { token: acc.token })).status).toBe(200);
      expect((await h2.json('POST', '/auth/totp/setup', { token: acc.token })).status).toBe(200);
    } finally {
      await h2.close();
    }
  });
});
