// SPEC §27.11 – the open round-2 findings the backend builder fixed (security S1–S9, tax T4/T7, owner O5/O7/O8/O12),
// one regression test per finding, plus the parts of §27 that live only in the backend (data step, kamara job).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { fillLegal, legalValuesFromConfig } from '../src/legal.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accountants, assistRequests, businessRegistrations, clients, clientTaxProfiles, contentTexts, emailCodes, faqItems, notifications, onboardingSteps, systemState, users } from '../src/db/schema.js';
import { jobKamaraReminders } from '../src/jobs-tulaj1119.js';
import { runDataStepTulaj1119 } from '../src/services/datastep.js';
import { TULAJ1119_REGI } from '../src/content/tulaj1119_regi.js';
import { DEFAULT_TEXTS } from '../src/content.js';
import { stripInternalNotes } from '../src/legal.js';
import { withUploadSlot } from '../src/files/upload.js';
import { pickAccountant } from '../src/services/accounts.js';
import { base32Decode, totp } from '../src/lib/totp.js';
import { lastCode, newClient, pdfBytes, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
});
afterAll(async () => h.close());

const ip = (n: number) => ({ 'x-forwarded-for': `198.51.100.${n}` });

describe('S1 – the password lock never blocks the second factor', () => {
  it('10 wrong passwords from 3 addresses, then the owner finishes the TOTP sign-in from his usual address', async () => {
    const c = await newClient(h, 'totp-lock@demo.kezjegy.test');
    const s = await h.json('POST', '/auth/totp/setup', { token: c.token });
    const secret = base32Decode(s.body.secret);
    expect((await h.json('POST', '/auth/totp/enable', { token: c.token, body: { code: totp(secret, h.clock.now().getTime()) } })).status).toBe(200);
    // the owner signs in once from his usual address (a session from it = known address)
    h.clock.advance(31_000);
    const first = await h.json('POST', '/auth/login', { body: { email: 'totp-lock@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: ip(10) });
    const ok1 = await h.json('POST', '/auth/login/totp', { body: { mfaToken: first.body.mfaToken, code: totp(secret, h.clock.now().getTime()) }, headers: ip(10) });
    expect(ok1.status).toBe(200);
    for (let i = 0; i < 10; i++) await h.json('POST', '/auth/login', { body: { email: 'totp-lock@demo.kezjegy.test', password: 'rossz-jelszo-123', clientKind: 'native' }, headers: ip(20 + (i % 3)) });
    const [u] = await h.deps.db.select().from(users).where(eq(users.email, 'totp-lock@demo.kezjegy.test'));
    expect(u!.lockedUntil!.getTime()).toBeGreaterThan(h.clock.now().getTime());
    h.clock.advance(31_000);
    const pw = await h.json('POST', '/auth/login', { body: { email: 'totp-lock@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: ip(10) });
    expect(pw.status).toBe(401);
    expect(pw.body.error.code).toBe('mfa_required');
    const t = await h.json('POST', '/auth/login/totp', { body: { mfaToken: pw.body.mfaToken, code: totp(secret, h.clock.now().getTime()) }, headers: ip(10) });
    expect(t.status).toBe(200);
  });
});

describe('S2 – the reset code cannot be guessed from many addresses', () => {
  it('unknown addresses share one 24-hour budget; at the cap every open code is closed', async () => {
    await newClient(h, 'reset-cap@demo.kezjegy.test');
    for (let i = 0; i < 12; i++) {
      await h.json('POST', '/auth/password/forgot', { body: { email: 'reset-cap@demo.kezjegy.test' }, headers: ip(100 + i) });
      for (let k = 0; k < 4; k++) await h.json('POST', '/auth/password/reset', { body: { email: 'reset-cap@demo.kezjegy.test', code: '000000', newPassword: 'Uj-Hosszu-Jelszo-2026!' }, headers: ip(100 + i) });
    }
    const last = await h.json('POST', '/auth/password/reset', { body: { email: 'reset-cap@demo.kezjegy.test', code: '000000', newPassword: 'Uj-Hosszu-Jelszo-2026!' }, headers: ip(140) });
    expect(last.body.error.fields.code).toBe('Túl sokszor próbáltad. Kérj új kódot.');
    // persistent mail cap: max 5 codes per hour per account (the answer stays 202)
    const codes = await h.deps.db.select().from(emailCodes).where(eq(emailCodes.email, 'reset-cap@demo.kezjegy.test'));
    expect(codes.filter((x) => x.purpose === 'password_reset').length).toBeLessThanOrEqual(5);
    expect(codes.reduce((a, x) => a + x.attempts + x.foreignAttempts, 0)).toBeLessThanOrEqual(30);
  });
});

describe('S3 – JSON only; no cross-site sign-in', () => {
  it('text/plain to /auth/login → 415; a foreign Origin or Sec-Fetch-Site cross-site → 403; same host / no Origin → ok', async () => {
    const plain = await h.req('POST', '/auth/login', { raw: JSON.stringify({ email: 'x@demo.kezjegy.test', password: 'x', clientKind: 'web' }), headers: { 'content-type': 'text/plain' } });
    expect(plain.status).toBe(415);
    const evil = await h.json('POST', '/auth/login', { body: { email: 'x@demo.kezjegy.test', password: 'x', clientKind: 'web' }, headers: { origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    const cross = await h.json('POST', '/auth/login', { body: { email: 'x@demo.kezjegy.test', password: 'x', clientKind: 'web' }, headers: { 'sec-fetch-site': 'cross-site' } });
    expect(cross.status).toBe(403);
    const app = await h.json('POST', '/auth/login', { body: { email: 'x@demo.kezjegy.test', password: 'x', clientKind: 'web' }, headers: { origin: new URL(h.deps.cfg.appPublicUrl).origin } });
    expect(app.status).toBe(401);
    const native = await h.json('POST', '/auth/login', { body: { email: 'x@demo.kezjegy.test', password: 'x', clientKind: 'native' } });
    expect(native.status).toBe(401);
    // the cookie refresh needs JSON (or no body) and the custom header
    expect((await h.req('POST', '/auth/refresh', { raw: '{}', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
  });
});

describe('S5 – a stalled upload frees its slot', () => {
  it('withUploadSlot answers 408 after the deadline and the next caller gets the slot', async () => {
    const stalled = withUploadSlot('u:a', () => new Promise<never>(() => undefined), { deadlineMs: 50 }).catch((e: { status?: number }) => e.status);
    const other = withUploadSlot('u:b', async () => 'ok', { deadlineMs: 1000 });
    expect(await stalled).toBe(408);
    expect(await other).toBe('ok');
  });
});

describe('S6 – storage quota per client', () => {
  it('an upload over the quota answers 413 quota_exceeded (before activation the quota is small)', async () => {
    const h2 = await setup({ now: '2026-11-19T09:00:00Z', env: { QUOTA_BEFORE_ACTIVATION_MB: '10', MIN_FREE_DISK_MB: '0' } });
    try {
      const c = await newClient(h2, 'quota@demo.kezjegy.test');
      const [cl] = await h2.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
      await h2.deps.storage.put(h2.deps.db, { ownerClientId: cl!.id, kind: 'uzenet_csatolmany', mime: 'application/pdf', displayName: 'nagy.pdf', data: Buffer.alloc(10 * 1024 * 1024 - 100), createdBy: c.userId, now: h2.clock.now() });
      const fd = new FormData();
      fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'kicsi.pdf');
      const r = await h2.json('POST', '/client/attachments', { token: c.token, form: fd });
      expect(r.status).toBe(413);
      expect(r.body.error.code).toBe('quota_exceeded');
    } finally {
      await h2.close();
    }
  });
});

describe('S7 – 2FA needs a confirmed e-mail; the first reset removes a stranger’s 2FA', () => {
  it('setup on an unconfirmed address → 409; a reset that confirms the mailbox clears TOTP', async () => {
    const reg = await h.json('POST', '/auth/register', { body: { email: 'idegen@demo.kezjegy.test', password: PW, firstName: 'I', lastName: 'D', platform: 'android' }, headers: ip(150) });
    expect(reg.status).toBe(201);
    const s = await h.json('POST', '/auth/totp/setup', { token: reg.body.accessToken });
    expect(s.status).toBe(409);
    expect(s.body.error.code).toBe('email_not_verified');
    // an older state: a TOTP bound before this rule; the owner resets the password from the mailbox
    await h.deps.db.update(users).set({ totpSecretEnc: h.deps.data.enc('JBSWY3DPEHPK3PXP', 'users.totp_secret'), totpEnabledAt: h.clock.now() }).where(eq(users.email, 'idegen@demo.kezjegy.test'));
    await h.json('POST', '/auth/password/forgot', { body: { email: 'idegen@demo.kezjegy.test' }, headers: ip(151) });
    const r = await h.json('POST', '/auth/password/reset', { body: { email: 'idegen@demo.kezjegy.test', code: lastCode(h, 'idegen@demo.kezjegy.test'), newPassword: 'A-Valodi-Tulaj-Jelszava-2026!' }, headers: ip(151) });
    expect(r.status).toBe(204);
    const [u] = await h.deps.db.select().from(users).where(eq(users.email, 'idegen@demo.kezjegy.test'));
    expect(u!.totpEnabledAt).toBeNull();
    expect(u!.totpSecretEnc).toBeNull();
    expect(u!.emailVerifiedAt).not.toBeNull();
  });
});

describe('S8 – unconfirmed sign-ups take no seat of an accountant', () => {
  it('capacity counts only confirmed clients', async () => {
    await h.deps.db.update(accountants).set({ capacity: 1 }).where(eq(accountants.id, bence.accountantId!));
    await h.deps.db.update(users).set({ lastLoginAt: h.clock.now() }).where(eq(users.id, bence.userId));
    for (let i = 0; i < 3; i++) await h.json('POST', '/auth/register', { body: { email: `nemerositett${i}@demo.kezjegy.test`, password: PW, firstName: 'N', lastName: 'E', platform: 'android' }, headers: ip(160 + i) });
    const confirmed = await h.deps.db.select({ n: clients.id }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(clients.accountantId, bence.accountantId!));
    expect(confirmed.length).toBeGreaterThan(1);
    // Bence has seats only for confirmed clients: the many unconfirmed ones do not fill him
    const pick = await pickAccountant(h.deps.db);
    const verified = (await h.deps.db.select({ v: users.emailVerifiedAt }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(clients.accountantId, bence.accountantId!))).filter((x) => x.v).length;
    expect(pick === bence.accountantId).toBe(verified < 1);
    await h.deps.db.update(accountants).set({ capacity: 150 }).where(eq(accountants.id, bence.accountantId!));
  });
});

describe('S9 – an admin can block a client; "megszunt" is read-only', () => {
  it('disable → sign-in refused, sessions end; enable → works again; a megszunt client cannot write', async () => {
    const c = await newClient(h, 'tilt@demo.kezjegy.test', { active: true });
    expect((await h.json('POST', `/admin/clients/${c.clientId}/disable`, { token: admin.token, body: {} })).status).toBe(400);
    expect((await h.json('POST', `/admin/clients/${c.clientId}/disable`, { token: admin.token, body: { reason: 'Visszaélés: tömeges feltöltés' } })).status).toBe(204);
    expect((await h.json('GET', '/me', { token: c.token })).status).toBe(401);
    expect((await h.json('POST', '/auth/login', { body: { email: 'tilt@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: ip(170) })).status).toBe(401);
    expect((await h.json('POST', `/admin/clients/${c.clientId}/disable`, { token: anna.token, body: { reason: 'x x x' } })).status).toBe(404);
    expect((await h.json('POST', `/admin/clients/${c.clientId}/enable`, { token: admin.token, body: { reason: 'Megbeszéltük' } })).status).toBe(204);
    const back = await h.json('POST', '/auth/login', { body: { email: 'tilt@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: ip(171) });
    expect(back.status).toBe(200);
    await h.deps.db.update(clients).set({ lifecycle: 'megszunt' }).where(eq(clients.id, c.clientId));
    const w = await h.json('POST', '/client/messages', { token: back.body.accessToken, body: { body: 'szia' } });
    expect(w.status).toBe(403);
    expect(w.body.error.code).toBe('megszunt');
    expect((await h.json('GET', '/client/profile', { token: back.body.accessToken })).status).toBe(200);
  });
});

describe('T4 / T7 – start year profile, garantált bérminimum hint', () => {
  it('registered on 2026-12-29, recorded on 2027-01-04: a 2026 profile (atalanyFrom) exists, and the 2027 one', async () => {
    const h2 = await setup({ now: '2027-01-04T09:00:00Z' });
    try {
      const anna2 = await staff(h2, 'csapat', 'anna2@demo.kezjegy.test');
      const c = await newClient(h2, 'decemberi@demo.kezjegy.test');
      await h2.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas' } });
      await h2.json('PUT', '/client/profile', { token: c.token, body: { firstName: 'D', lastName: 'E', phone: '+36301112233', adoazonositoJel: '8123456786', address: { zip: '1136', city: 'Budapest', line: 'Minta utca 1.' } } });
      for (const p of [
        { declarations: { noExclusion: true, singleBusiness: true }, revenueBand: 'max_12m' },
        { activities: [{ key: 'fodraszat', main: true }] },
        { seat: { kind: 'lakcim' } },
        { workKind: 'fofoglalkozas', euPartner: 'nem', hasSeparateBusinessAccount: true },
        { startPlan: 'mielobb' },
      ])
        await h2.json('PUT', '/client/business-registration', { token: c.token, body: p });
      const reg0 = await h2.json('GET', '/client/business-registration', { token: c.token });
      // T7: a qualified trade sees both minimums (minimálbér and garantált bérminimum)
      expect(reg0.body.registration.hints.contributionText).toContain('szakképzettség');
      const [r] = await h2.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId));
      await h2.deps.db
        .update(businessRegistrations)
        .set({ status: 'ellenorizve', submittedAt: h2.clock.now(), filedOn: '2026-12-29', filedAt: h2.clock.now(), filedChannel: 'dap', checkedAt: h2.clock.now(), answers: { ...(r!.answers as object), activities: [{ key: 'fodraszat', label: 'Fodrászat', main: true, ovtjKod: '960201', navKereso: 'fodrász' }] } })
        .where(eq(businessRegistrations.id, r!.id));
      const ad = await h2.json('POST', `/team/registrations/${r!.id}/adoszam`, { token: anna2.token, body: { adoszam: '12345676-1-41', registeredOn: '2026-12-29' } });
      expect(ad.status).toBe(200);
      const tps = await h2.deps.db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.clientId, c.clientId));
      const y2026 = tps.find((x) => x.year === 2026);
      expect(y2026).toMatchObject({ atalanyFrom: '2026-12-29', guaranteedMinimum: true });
      expect(tps.some((x) => x.year === 2027)).toBe(true);
      // the kamara deadline: 5 working days after 2026-12-29
      const [r2] = await h2.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.id, r!.id));
      expect(r2!.chamberDueOn).toBe('2027-01-06');
    } finally {
      await h2.close();
    }
  });
});

describe('O12 – internal notes never reach a client', () => {
  it('[JOGI: …], [TULAJ/JOGI: …], [KÖNYVELŐ: …] are stripped; [CÉGADAT …] stays', () => {
    const md = 'A díj havi 20 000 Ft [TULAJ: ellenőrizni]. Felmondás 30 nap [JOGI: maradhat-e?] és [KÖNYVELŐ: program neve].\n\n[CÉGADAT: székhely]\n- [TULAJ/JOGI: a Fő szerződés külön készül]\n';
    const out = stripInternalNotes(md);
    expect(out).not.toMatch(/\[(JOGI|TULAJ|KÖNYVELŐ)/);
    expect(out).toContain('[CÉGADAT: székhely]');
    expect(out).toContain('A díj havi 20 000 Ft. Felmondás 30 nap és.');
    for (const t of ['aszf', 'megbizasi_szerzodes', 'adatkezeles', 'nav_meghatalmazas'] as const) expect(h.deps.legal.current(t).markdown).not.toMatch(/\[(JOGI|TULAJ|KÖNYVELŐ)[^\]]*\]/);
  });
});

describe('O8 – milestones speak about the method the client chose', () => {
  it('a self-given meghatalmazás reads "ellenőrzi", never "bejelenti magát"', async () => {
    const c = await newClient(h, 'o8@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId, businessStatus: 'van' }).where(eq(clients.id, c.clientId));
    for (const step of ['fiok', 'adatok', 'szerzodes', 'azonositas'] as const) await h.deps.db.insert(onboardingSteps).values({ clientId: c.clientId, step, status: 'kesz', completedAt: h.clock.now() }).onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'kesz' } });
    await h.deps.db
      .insert(onboardingSteps)
      .values({ clientId: c.clientId, step: 'meghatalmazas', status: 'konyvelore_var', data: { method: 'onya_ugyfel', submittedAt: h.clock.now().toISOString() } })
      .onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'konyvelore_var', data: { method: 'onya_ugyfel', submittedAt: h.clock.now().toISOString() } } });
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    const all = JSON.stringify(st.body.milestones);
    expect(all).not.toContain('bejelenti magát');
    expect(all).toContain('Bence ellenőrzi a meghatalmazásodat a NAV-nál');
    expect(all).not.toMatch(/NAV-tól/);
    const row = st.body.journey.steps.find((x: { key: string }) => x.key === 'meghatalmazas');
    expect(row.state).toBe('var');
    expect(st.body.journey.waiting.key).toBe('meghatalmazas_ellenorzes');
    expect(st.body.journey.waiting.escalateText).toMatch(/^Ha november \d+-ig nem történik semmi, kérj visszahívást\.$/);
  });
});

describe('kamara reminders (§27.8) – 2 working days before and on the due day, max 2, quiet after the tick', () => {
  it('sends two reminders and stops', async () => {
    const c = await newClient(h, 'kamara@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ businessStatus: 'inditas' }).where(eq(clients.id, c.clientId));
    await h.deps.db.insert(businessRegistrations).values({ clientId: c.clientId, status: 'kesz', answers: {}, chamberDueOn: '2026-11-26', doneAt: h.clock.now() });
    h.clock.set('2026-11-23T09:30:00Z');
    expect(await jobKamaraReminders(h.deps)).toBe(0);
    h.clock.set('2026-11-24T09:30:00Z');
    expect(await jobKamaraReminders(h.deps)).toBe(1);
    expect(await jobKamaraReminders(h.deps)).toBe(0);
    h.clock.set('2026-11-26T09:30:00Z');
    expect(await jobKamaraReminders(h.deps)).toBe(1);
    h.clock.set('2026-11-27T09:30:00Z');
    expect(await jobKamaraReminders(h.deps)).toBe(0);
    const n = await h.deps.db.select().from(notifications).where(eq(notifications.userId, c.userId));
    expect(n.filter((x) => x.kind === 'kamara_reminder').map((x) => x.title)).toEqual(['Ne felejtsd el: kamarai regisztráció', 'Ne felejtsd el: kamarai regisztráció']);
    expect(n.find((x) => x.kind === 'kamara_reminder')!.body).toBe('november 26-ig regisztrálj a kamaránál. Kb. 10 perc.');
    h.clock.set('2026-11-19T09:00:00Z');
  });
});

describe('data step data.tulaj1119 (§27.7.3) – idempotent, never touches onboarding_steps', () => {
  it('legacy assisted meghatalmazás → assist; an old content override gets the new default; a second run is a no-op', async () => {
    const c = await newClient(h, 'legacy@demo.kezjegy.test');
    await h.deps.db
      .insert(onboardingSteps)
      .values({ clientId: c.clientId, step: 'meghatalmazas', status: 'konyvelore_var', data: { method: 'onya_konyvelo', submittedAt: '2026-11-18T10:00:00.000Z' } })
      .onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'konyvelore_var', data: { method: 'onya_konyvelo', submittedAt: '2026-11-18T10:00:00.000Z' } } });
    const key = 'notif.registration_checked.body';
    await h.deps.db.insert(contentTexts).values({ key, body: TULAJ1119_REGI[key]!, placeholders: [] }).onConflictDoUpdate({ target: contentTexts.key, set: { body: TULAJ1119_REGI[key]! } });
    await h.deps.db.insert(contentTexts).values({ key: 'vallalkozas.allapot.beadva', body: 'Az admin saját szövege.', placeholders: [] }).onConflictDoNothing();
    // FAQ: a live row that still has jogi's previous text is updated; an admin-edited row is kept
    const raw = JSON.parse(readFileSync(join(h.deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik: { kerdes: string; valasz: string; elozo_kerdes?: string; elozo_valasz?: string }[] };
    const vals = legalValuesFromConfig(h.deps.cfg, h.clock.now());
    const changed = raw.gyik.filter((g) => g.elozo_valasz);
    await h.deps.db.delete(faqItems);
    if (changed[0]) await h.deps.db.insert(faqItems).values({ question: fillLegal(changed[0].elozo_kerdes ?? changed[0].kerdes, vals), answer: fillLegal(changed[0].elozo_valasz!, vals), sort: 1 });
    if (changed[1]) await h.deps.db.insert(faqItems).values({ question: fillLegal(changed[1].elozo_kerdes ?? changed[1].kerdes, vals), answer: 'Az admin átírta.', sort: 2 });
    const stepsBefore = await h.deps.db.select().from(onboardingSteps).orderBy(onboardingSteps.clientId, onboardingSteps.step);
    await h.deps.db.delete(systemState).where(eq(systemState.key, 'data.tulaj1119'));
    const r = await runDataStepTulaj1119(h.deps);
    expect(r).toMatchObject({ assists: 1, content: 1 });
    if (changed[0]) {
      const faq = await h.deps.db.select().from(faqItems);
      expect(faq.find((x) => x.sort === 1)).toMatchObject({ question: fillLegal(changed[0].kerdes, vals), answer: fillLegal(changed[0].valasz, vals) });
      expect(faq.find((x) => x.sort === 2)!.answer).toBe('Az admin átírta.');
      expect((r as { faqUpdated: number }).faqUpdated).toBe(1);
    }
    const [a] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.clientId, c.clientId));
    expect(a).toMatchObject({ kind: 'meghatalmazas', status: 'egyeztetve', createdByRole: 'system', callbackId: null });
    const [ct] = await h.deps.db.select().from(contentTexts).where(eq(contentTexts.key, key));
    expect(ct!.body).toBe(DEFAULT_TEXTS[key]);
    const [own] = await h.deps.db.select().from(contentTexts).where(eq(contentTexts.key, 'vallalkozas.allapot.beadva'));
    expect(own!.body).toBe('Az admin saját szövege.');
    expect(await h.deps.db.select().from(onboardingSteps).orderBy(onboardingSteps.clientId, onboardingSteps.step)).toEqual(stepsBefore);
    expect(await runDataStepTulaj1119(h.deps)).toBe('already');
    void faqItems;
  });
});

describe('four eyes with an admin who filed', () => {
  it('the admin who filed the EV bejelentés as meghatalmazott cannot check it (403)', async () => {
    const c = await newClient(h, 'negyszem@demo.kezjegy.test', { first: 'Négy', last: 'Szem' });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas' } });
    const [reg] = await h.deps.db.update(businessRegistrations).set({ status: 'beadva', mode: 'segitett', filedAt: h.clock.now(), filedOn: '2026-11-19', filedChannel: 'meghatalmazott' }).where(eq(businessRegistrations.clientId, c.clientId)).returning();
    await h.deps.db.insert(assistRequests).values({ clientId: c.clientId, kind: 'vallalkozas_bejelentes', status: 'bejelentes_bekuldve', registrationId: reg!.id, createdByRole: 'client', evFiledAt: h.clock.now(), evFiledBy: admin.userId });
    const { REGISTRATION_CHECK_ITEMS } = await import('../src/_shared/enums.js');
    const r = await h.json('POST', `/team/registrations/${reg!.id}/check`, { token: admin.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(r.status).toBe(403);
    expect(r.body.error.message).toBe('Négy szem elve: más nézze át.');
  });
});
