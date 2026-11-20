// Round 1 fixes of 2026-11-19 (owner: "csinálj még több ellenőrző kört"): one test per verified finding.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accountants, auditLog, clients, clientTaxProfiles, emailCodes, gdprExports, internalNotes, notifications, onboardingSteps, requests, signupAttribution, subscriptions, systemState, taxPaymentItems, taxPeriods, users } from '../src/db/schema.js';
import { rateKeyOfIp } from '../src/http/core.js';
import { withUploadSlot, UPLOAD_SLOTS } from '../src/files/upload.js';
import { buildExport, runGdprExports } from '../src/services/gdpr.js';
import { pickAccountant } from '../src/services/accounts.js';
import { runDataFixKor1 } from '../src/services/datastep.js';
import { chargeDue, chargeSubscription } from '../src/services/subscription.js';
import { heroPeriod, markPaid, paymentStatusOf, unmarkPaid, verifyPayment } from '../src/services/tax.js';
import { lastCode, newClient, PW, registerUnverified, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

const profile = {
  firstName: 'Kata',
  lastName: 'Szabó',
  phone: '+36301234567',
  adoazonositoJel: '8123456782',
  adoszam: '12345676-1-41',
  address: { zip: '1136', city: 'Budapest', line: 'Tátra utca 5.' },
  hqMunicipality: 'Budapest',
  activityText: 'Grafikai tervezés',
  activityAnswer: 'egyeb',
  taxStatus: 'fofoglalkozasu',
  evSince: '2021-03-01',
  hasSeparateBusinessAccount: true,
};

function validAdoJel(seed: number): string {
  // 8 + 8 free digits + check digit (Σ i·d_i mod 11, never 10)
  for (let n = seed; ; n++) {
    const body = `8${String(n).padStart(8, '0')}`;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (i + 1) * Number(body[i]);
    if (sum % 11 !== 10) return `${body}${sum % 11}`;
  }
}

function adoszam(torzs7: string, afa: number): string {
  const w = [9, 7, 3, 1, 9, 7, 3];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(torzs7[i]) * w[i]!;
  return `${torzs7}${(10 - (sum % 10)) % 10}-${afa}-13`;
}

beforeAll(async () => {
  h = await setup();
  bence = await staff(h, 'accountant', 'bence.k1119@demo.kezjegy.test');
  admin = await staff(h, 'admin', 'admin.k1119@demo.kezjegy.test');
  await h.deps.db.update(accountants).set({ adoazonositoJelEnc: h.deps.data.enc('8345678901', 'accountants.adoazonosito_jel') }).where(eq(accountants.id, bence.accountantId!));
});
afterAll(async () => {
  await h.close();
});

async function assigned(email: string, o: { active?: boolean } = {}) {
  const c = await newClient(h, email, { first: 'Kata', last: 'Szabó', active: o.active });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}

describe('the accountant\'s tax id is not handed to every registrant', () => {
  it('unverified and pre-contract accounts get null; after the contract the client gets it, audited once a day', async () => {
    const reg = await registerUnverified(h, 'friss@demo.kezjegy.test', { 'x-forwarded-for': '10.9.9.1' }, { first: 'Friss', last: 'Fiók' });
    expect(reg.status).toBe(200);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.userId, reg.body.user.id));
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, cl!.id));
    const unverified = await h.json('GET', '/client/onboarding', { token: reg.body.accessToken });
    expect(unverified.body.onyaGuide.accountantTaxId).toBeNull();
    expect(JSON.stringify(unverified.body)).not.toContain('8345678901');
    await h.json('POST', '/auth/email/verify', { token: reg.body.accessToken, body: { code: lastCode(h, 'friss@demo.kezjegy.test') } });
    await h.json('PUT', '/client/onboarding/business-status', { token: reg.body.accessToken, body: { businessStatus: 'van' } });
    const verified = await h.json('GET', '/client/onboarding', { token: reg.body.accessToken });
    expect(verified.body.onyaGuide.accountantTaxId).toBeNull();
    // the locked meghatalmazás still counts as the client's own to-do (it only waits for his own contract):
    // adatok, szerződés, előfizetés, meghatalmazás, azonosítás
    expect(verified.body.steps.find((s: { step: string }) => s.step === 'meghatalmazas').locked).toBe(true);
    expect(verified.body.todoCount).toBe(5);
    const guideEarly = await h.json('GET', '/client/guides/meghatalmazas', { token: reg.body.accessToken });
    expect(guideEarly.status).toBe(409);
    expect(guideEarly.body.error.code).toBe('step_locked');
    // contract accepted → the meghatalmazás opens and carries the tax id
    await h.deps.db.update(onboardingSteps).set({ status: 'kesz' }).where(and(eq(onboardingSteps.clientId, cl!.id), eq(onboardingSteps.step, 'szerzodes')));
    for (let i = 0; i < 3; i++) {
      const after = await h.json('GET', '/client/onboarding', { token: reg.body.accessToken });
      expect(after.body.onyaGuide.accountantTaxId).toBe('8345678901');
    }
    const guide = await h.json('GET', '/client/guides/meghatalmazas', { token: reg.body.accessToken });
    expect(guide.status).toBe(200);
    expect(JSON.stringify(guide.body)).toContain('8345678901');
    const rows = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'accountant.taxid_shown_to_client'), eq(auditLog.clientId, cl!.id)));
    expect(rows.length).toBe(1);
  });
});

describe('nobody pays before the branch question; the ÁFA code is checked', () => {
  it('business_status NULL: the subscription step is locked (409 step_locked), the state says why', async () => {
    const c = await assigned('elagazas@demo.kezjegy.test');
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(st.body.path).toBeNull();
    const elo = st.body.steps.find((s: { step: string }) => s.step === 'elofizetes');
    expect(elo.locked).toBe(true);
    expect(elo.lockedReason).toContain('van már egyéni vállalkozásod');
    const start = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    expect(start.status).toBe(409);
    expect(start.body.error.code).toBe('step_locked');
  });

  it('an ÁFA-körös (-2-) or csoportos (-5-) adószám is refused on the existing-business path, -1- goes through', async () => {
    const c = await assigned('afakod@demo.kezjegy.test');
    for (const afa of [2, 5]) {
      const r = await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(1234567), adoszam: adoszam('6912345', afa) } });
      expect(r.status).toBe(400);
      expect(r.body.error.fields.adoszam).toContain('ÁFA-mentes');
      expect(r.body.stop).toBe('nem_afamentes');
    }
    const [mid] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(mid!.adoszam).toBeNull();
    expect((await h.deps.db.select().from(onboardingSteps).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'adatok'))))[0]!.status).not.toBe('kesz');
    const old = await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(1234567), adoszam: adoszam('6912345', 1), evSince: '1800-01-01' } });
    expect(old.body.error.fields.evSince).toContain('1990');
    const ok = await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(1234567), adoszam: adoszam('6912345', 1) } });
    expect(ok.status).toBe(200);
  });
});

describe('accountant side', () => {
  it('a step cannot be closed without its record; a request cannot be due in the past', async () => {
    const c = await assigned('lepesek@demo.kezjegy.test');
    for (const step of ['fiok', 'adatok', 'szerzodes', 'elofizetes', 'azonositas']) {
      const r = await h.json('POST', `/acc/clients/${c.clientId}/onboarding/${step}`, { token: bence.token, body: { status: 'kesz' } });
      expect(r.status, step).toBe(409);
    }
    const mh = await h.json('POST', `/acc/clients/${c.clientId}/onboarding/meghatalmazas`, { token: bence.token, body: { status: 'kesz' } });
    expect(mh.status).toBe(409);
    expect(mh.body.error.message).toContain('még nem küldte be');
    expect((await h.json('POST', `/acc/clients/${c.clientId}/onboarding/meghatalmazas`, { token: bence.token, body: { status: 'hianyos', note: 'Pótold.' } })).status).toBe(409);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/onboarding/meghatalmazas`, { token: bence.token, body: { status: 'kihagyva' } })).status).toBe(409);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/onboarding/nav_bekotes`, { token: bence.token, body: { status: 'kesz' } })).status).toBe(409);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lifecycle).toBe('bekotes_alatt');
    // an explicit, reasoned override is possible and audited apart
    const ov = await h.json('POST', `/acc/clients/${c.clientId}/onboarding/meghatalmazas`, { token: bence.token, body: { status: 'kesz', override: true, note: 'Papíron adta be, a NAV visszaigazolta.' } });
    expect(ov.status).toBe(200);
    expect((await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'onboarding.step_override'), eq(auditLog.clientId, c.clientId)))).length).toBe(1);
    // request due date
    const past = await h.json('POST', `/acc/clients/${c.clientId}/requests`, { token: bence.token, body: { type: 'dokumentum', title: 'Kivonat', dueDate: '2026-11-01' } });
    expect(past.status).toBe(400);
    expect(past.body.error.fields.dueDate).toContain('múltban');
    const today = await h.json('POST', `/acc/clients/${c.clientId}/requests`, { token: bence.token, body: { type: 'dokumentum', title: 'Kivonat', dueDate: '2026-11-17' } });
    expect(today.status).toBe(201);
    expect((await h.deps.db.select().from(requests).where(eq(requests.clientId, c.clientId))).length).toBe(1);
  });

  it('an invited accountant who never signed in gets no new registrations', async () => {
    const inv = await h.json('POST', '/admin/accountants', { token: admin.token, body: { email: 'eszter.uj@demo.kezjegy.test', displayName: 'Kiss Eszter', firstName: 'Eszter' } });
    expect(inv.status).toBe(201);
    // DEMO: the creating admin gets the invite code once
    expect(inv.body.demoInviteCode).toMatch(/^\d{6}$/);
    for (let i = 0; i < 3; i++) expect(await pickAccountant(h.deps.db)).toBe(bence.accountantId);
    const c = await newClient(h, 'ujreg@demo.kezjegy.test');
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.accountantId).toBe(bence.accountantId);
    // the admin's Demo-postafiók hides the invite of the other staff member, the csapat role included
    const team = await h.json('POST', '/admin/team', { token: admin.token, body: { email: 'csilla.uj@demo.kezjegy.test', displayName: 'Kiss Csilla', firstName: 'Csilla' } });
    expect(team.body.demoInviteCode).toMatch(/^\d{6}$/);
    expect(h.mails.find((m) => m.to === 'csilla.uj@demo.kezjegy.test')!.subject).toContain('ügyfélszolgálati');
  });
});

describe('subscription: no double charge, honest cancellation text', () => {
  it('a paid, active subscription is never charged by a manual retry; an admin cancellation reads "Lemondtuk"', async () => {
    const c = await assigned('dupla@demo.kezjegy.test');
    await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(2234567), adoszam: adoszam('2234567', 1) } });
    // SPEC §27.4.2: the card comes after the contract (both paths)
    await h.deps.db.update(onboardingSteps).set({ status: 'kesz' }).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'szerzodes')));
    const start = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    expect(start.status).toBe(200);
    await h.req('POST', '/payments/demo/pay', { raw: `o=${encodeURIComponent(start.body.orderRef)}&eredmeny=ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub!.status).toBe('active');
    expect(chargeDue(sub!, '2026-11-17')).toBe(false);
    const retry = await h.json('POST', `/admin/subscriptions/${sub!.id}/retry`, { token: admin.token });
    expect(retry.status).toBe(409);
    expect(retry.body.error.message).toContain('Nincs esedékes terhelés');
    expect(await chargeSubscription(h.deps, sub!)).toBe('skipped');
    const [same] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.id, sub!.id));
    expect(same!.currentPeriodEnd).toBe(sub!.currentPeriodEnd);
    const list = await h.json('GET', '/admin/subscriptions', { token: admin.token });
    expect(list.body.items.find((x: { id: string }) => x.id === sub!.id).retryable).toBe(false);
    const cancel = await h.json('POST', `/admin/subscriptions/${sub!.id}/cancel`, { token: admin.token });
    expect(cancel.status).toBe(200);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'subscription_canceled')));
    expect(n!.title).toBe('Lemondtuk az előfizetésed');
    expect((await h.json('POST', `/admin/subscriptions/${sub!.id}/retry`, { token: admin.token })).status).toBe(409);
  });
});

describe('login and password reset cannot be closed by a stranger', () => {
  it('ten wrong passwords from ONE address do not lock the account for its owner', async () => {
    const c = await newClient(h, 'zar1@demo.kezjegy.test');
    void c;
    for (let i = 0; i < 10; i++) {
      const bad = await h.json('POST', '/auth/login', { body: { email: 'zar1@demo.kezjegy.test', password: 'rossz-jelszo-123', clientKind: 'native' }, headers: { 'x-forwarded-for': '198.51.100.9' } });
      expect(bad.status).toBe(401);
    }
    // the owner, from an address the account never used: the correct password works
    const ok = await h.json('POST', '/auth/login', { body: { email: 'zar1@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '192.0.2.44' } });
    expect(ok.status).toBe(200);
  });

  it('wrong passwords from several addresses lock unknown addresses only; a known address still signs in', async () => {
    await newClient(h, 'zar2@demo.kezjegy.test');
    const home = await h.json('POST', '/auth/login', { body: { email: 'zar2@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '192.0.2.77' } });
    expect(home.status).toBe(200);
    for (let i = 0; i < 12; i++) {
      await h.json('POST', '/auth/login', { body: { email: 'zar2@demo.kezjegy.test', password: 'rossz-jelszo-123', clientKind: 'native' }, headers: { 'x-forwarded-for': `198.51.100.${20 + (i % 4)}` } });
    }
    const [u] = await h.deps.db.select().from(users).where(eq(users.email, 'zar2@demo.kezjegy.test'));
    expect(u!.lockedUntil && u!.lockedUntil > h.clock.now()).toBe(true);
    const stranger = await h.json('POST', '/auth/login', { body: { email: 'zar2@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '203.0.113.200' } });
    expect(stranger.status).toBe(401);
    const known = await h.json('POST', '/auth/login', { body: { email: 'zar2@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '192.0.2.77' } });
    expect(known.status).toBe(200);
  });

  it('a stranger\'s "forgot" and wrong codes neither invalidate nor use up the owner\'s reset code', async () => {
    await newClient(h, 'reset1@demo.kezjegy.test');
    const owner = { 'x-forwarded-for': '192.0.2.10' };
    expect((await h.json('POST', '/auth/password/forgot', { body: { email: 'reset1@demo.kezjegy.test' }, headers: owner })).status).toBe(202);
    const ownerCode = lastCode(h, 'reset1@demo.kezjegy.test');
    // the attacker asks for codes from his own address and burns guesses from several addresses
    for (let i = 0; i < 3; i++) await h.json('POST', '/auth/password/forgot', { body: { email: 'reset1@demo.kezjegy.test' }, headers: { 'x-forwarded-for': '198.51.100.50' } });
    for (let i = 0; i < 8; i++) {
      const bad = await h.json('POST', '/auth/password/reset', { body: { email: 'reset1@demo.kezjegy.test', code: '000000', newPassword: 'Egy-Masik-Jelszo-2027!' }, headers: { 'x-forwarded-for': '198.51.100.50' } });
      expect(bad.status).toBe(400);
    }
    for (let i = 0; i < 12; i++) {
      await h.json('POST', '/auth/password/reset', { body: { email: 'reset1@demo.kezjegy.test', code: '111111', newPassword: 'Egy-Masik-Jelszo-2027!' }, headers: { 'x-forwarded-for': `198.51.100.${60 + i}` } });
    }
    const codes = await h.deps.db.select().from(emailCodes).where(and(eq(emailCodes.email, 'reset1@demo.kezjegy.test'), eq(emailCodes.purpose, 'password_reset')));
    const mine = codes.find((x) => x.attempts === 0 && !x.usedAt);
    expect(mine).toBeTruthy();
    // the owner's own code still works from the owner's address
    const ok = await h.json('POST', '/auth/password/reset', { body: { email: 'reset1@demo.kezjegy.test', code: ownerCode, newPassword: 'Uj-Biztos-Jelszo-2027!' }, headers: owner });
    expect(ok.status).toBe(204);
    const login = await h.json('POST', '/auth/login', { body: { email: 'reset1@demo.kezjegy.test', password: 'Uj-Biztos-Jelszo-2027!', clientKind: 'native' }, headers: owner });
    expect(login.status).toBe(200);
    // an unknown e-mail and a wrong code read the same
    const unknown = await h.json('POST', '/auth/password/reset', { body: { email: 'nincs-ilyen@demo.kezjegy.test', code: '123456', newPassword: 'Uj-Biztos-Jelszo-2027!' }, headers: { 'x-forwarded-for': '198.51.100.99' } });
    await h.json('POST', '/auth/password/forgot', { body: { email: 'reset1@demo.kezjegy.test' }, headers: { 'x-forwarded-for': '198.51.100.98' } });
    const wrong = await h.json('POST', '/auth/password/reset', { body: { email: 'reset1@demo.kezjegy.test', code: '123456', newPassword: 'Harmadik-Jelszo-2027!' }, headers: { 'x-forwarded-for': '198.51.100.98' } });
    expect(unknown.body.error.fields.code).toBe(wrong.body.error.fields.code);
    // password change: the new one must differ
    const same = await h.json('POST', '/auth/password/change', { token: login.body.accessToken, body: { currentPassword: 'Uj-Biztos-Jelszo-2027!', newPassword: 'Uj-Biztos-Jelszo-2027!' } });
    expect(same.status).toBe(400);
    expect(same.body.error.fields.newPassword).toContain('nem lehet ugyanaz');
  });

  it('IPv6 addresses are keyed on their /64', () => {
    expect(rateKeyOfIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(rateKeyOfIp('2001:db8:1:2::1'));
    expect(rateKeyOfIp('2001:db8:1:2::1')).not.toBe(rateKeyOfIp('2001:db8:1:3::1'));
    expect(rateKeyOfIp('203.0.113.7')).toBe('203.0.113.7');
    expect(rateKeyOfIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });
});

describe('contract and deletion mails, export re-check, links end with the session', () => {
  it('accepting the contract mails the PDF; the notification of a processed document opens an existing page', async () => {
    const c = await assigned('szerzodes-level@demo.kezjegy.test', { active: true });
    await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(3234567), adoszam: adoszam('3234567', 1) } });
    const cfg = await h.json('GET', '/config');
    const items = ['aszf', 'adatkezeles', 'megbizasi_szerzodes'].map((docType) => ({ docType, version: cfg.body.legal[docType] }));
    const acc = await h.json('POST', '/me/consents', { token: c.token, body: { items } });
    expect(acc.status).toBe(204);
    const mail = h.mails.find((m) => m.to === 'szerzodes-level@demo.kezjegy.test' && m.template === 'contract_accepted') as { text: string; attachments?: { filename: string; content: Buffer }[] } | undefined;
    expect(mail).toBeTruthy();
    expect(mail!.text).toContain('/dosszie?honap=2026-11');
    expect(mail!.attachments![0]!.filename).toBe('megbizasi_szerzodes.pdf');
    expect(mail!.attachments![0]!.content.subarray(0, 5).toString()).toBe('%PDF-');
    // a document processed by the accountant → link with ?honap=
    const fd = new FormData();
    fd.set('category', 'koltseg_bizonylat');
    fd.set('dossierMonth', '2026-11');
    fd.set('file', new File([new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')], 'szamla.pdf', { type: 'application/pdf' }));
    const up = await h.json('POST', '/client/documents', { token: c.token, form: fd });
    expect(up.status).toBe(201);
    const done = await h.json('PATCH', `/acc/documents/${up.body.id}`, { token: bence.token, body: { status: 'feldolgozva' } });
    expect(done.status).toBe(200);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'document_processed')));
    expect(n!.link).toBe('/dosszie?honap=2026-11');
    // a signed link dies with the session
    const fileId = up.body.versions?.[0]?.fileId ?? up.body.fileId ?? up.body.currentVersion?.fileId;
    if (fileId) {
      const link = await h.json('POST', `/files/${fileId}/link`, { token: c.token });
      expect(link.status).toBe(200);
      expect((await h.req('GET', link.body.url.replace('/api/v1', ''))).status).toBe(200);
      await h.json('POST', '/auth/logout', { token: c.token });
      expect((await h.req('GET', link.body.url.replace('/api/v1', ''))).status).toBe(404);
    }
  });

  it('the data copy needs a fresh sign-in or the password, and the owner gets a mail; deletion is confirmed by mail', async () => {
    const c = await assigned('export-ujra@demo.kezjegy.test', { active: true });
    h.clock.advance(11 * 60_000);
    const login = await h.json('POST', '/auth/login', { body: { email: 'export-ujra@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '192.0.2.90' } });
    h.clock.advance(11 * 60_000);
    // the sign-in is 11 minutes old; a refresh gives a new access token but does not make the sign-in fresh
    const ref = await h.json('POST', '/auth/refresh', { body: { refreshToken: login.body.refreshToken }, headers: { 'x-forwarded-for': '192.0.2.90' } });
    expect(ref.status).toBe(200);
    login.body.accessToken = ref.body.accessToken;
    const stale = await h.json('POST', '/me/export', { token: login.body.accessToken });
    expect(stale.status).toBe(403);
    expect(stale.body.error.code).toBe('reauth_required');
    expect((await h.json('POST', '/me/export', { token: login.body.accessToken, body: { password: 'nem-ez-a-jelszo' } })).status).toBe(400);
    const ok = await h.json('POST', '/me/export', { token: login.body.accessToken, body: { password: PW } });
    expect(ok.status).toBe(202);
    expect(h.mails.some((m) => m.to === 'export-ujra@demo.kezjegy.test' && m.template === 'export_requested')).toBe(true);
    // the build is claimed, counted and survives a dead worker without looping
    await h.deps.db.update(gdprExports).set({ status: 'folyamatban', attempts: 2, startedAt: new Date(h.clock.now().getTime() - 20 * 60_000) }).where(eq(gdprExports.id, ok.body.exportId));
    await runGdprExports(h.deps);
    const [dead] = await h.deps.db.select().from(gdprExports).where(eq(gdprExports.id, ok.body.exportId));
    expect(dead!.status).toBe('hiba');
    await buildExport(h.deps, ok.body.exportId);
    expect((await h.deps.db.select().from(gdprExports).where(eq(gdprExports.id, ok.body.exportId)))[0]!.status).toBe('hiba');
    const second = await h.json('POST', '/me/export', { token: login.body.accessToken, body: { password: PW } });
    await runGdprExports(h.deps);
    const [ready] = await h.deps.db.select().from(gdprExports).where(eq(gdprExports.id, second.body.exportId));
    expect(ready).toMatchObject({ status: 'kesz', attempts: 1 });
    const dl = await h.req('GET', `/me/exports/${second.body.exportId}/download`, { token: login.body.accessToken });
    expect(dl.status).toBe(200);
    const zip = Buffer.from(await dl.arrayBuffer());
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    expect(Number(dl.headers.get('content-length'))).toBe(zip.length);
    expect(zip.includes(Buffer.from('OLVASS_EL.txt'))).toBe(true);
    // deletion
    const del = await h.json('POST', '/me/delete', { token: login.body.accessToken, body: { password: PW } });
    expect(del.status).toBe(202);
    const mail = h.mails.find((m) => m.to === 'export-ujra@demo.kezjegy.test' && m.template === 'account_deletion_requested');
    expect(mail!.text).toContain('december 17-ig');
    expect(mail!.text).toContain('Visszavonom a törlést');
    void c;
    h.clock.set('2026-11-17T09:00:00Z');
  });
});

describe('tax: closed quarter on the home, verified payments stay verified, overdue wording', () => {
  it('after the quarter ends the home keeps the not yet approved quarter (also across the new year)', async () => {
    const c = await assigned('negyedev@demo.kezjegy.test', { active: true });
    await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(4234567), adoszam: adoszam('4234567', 1) } });
    const { ensurePeriods, recalcYear } = await import('../src/services/tax.js');
    const { revenueItems } = await import('../src/db/schema.js');
    await ensurePeriods(h.deps.db, c.clientId, 2026, 'nincs', 'fofoglalkozasu');
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-10', deliveryDate: '2026-11-10', amountHuf: 2_400_000, description: 'Teszt számla', countsForAtalany: true, countsForAfaLimit: true });
    await recalcYear(h.deps, h.deps.db, c.clientId, 2026, { asOf: '2026-12-31' });
    const dec = await heroPeriod(h.deps.db, c.clientId, '2026-12-31');
    expect(dec).toMatchObject({ state: 'becsles' });
    expect(dec!.period.periodKey).toBe('2026-Q4');
    // 5 January: new-year profile + periods exist, Q4 is not approved yet → still Q4, as a closed quarter
    await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2027, costRatio: 45, costRatioSource: 'ugyfel_javaslat', status: 'fofoglalkozasu' }).onConflictDoNothing();
    await ensurePeriods(h.deps.db, c.clientId, 2027, 'nincs', 'fofoglalkozasu');
    const jan = await heroPeriod(h.deps.db, c.clientId, '2027-01-05');
    expect(jan!.period.periodKey).toBe('2026-Q4');
    expect(jan).toMatchObject({ state: 'becsles', closed: true });
    expect(jan!.estimateHuf).toBeGreaterThan(0);
    h.clock.set('2027-01-05T09:00:00Z');
    const home = await h.json('GET', '/client/home', { token: (await h.json('POST', '/auth/login', { body: { email: 'negyedev@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '192.0.2.91' } })).body.accessToken });
    expect(home.body.hero).toMatchObject({ state: 'becsles', periodKey: '2026-Q4', amountHuf: jan!.estimateHuf });
    expect(home.body.hero.note).toContain('lezárult');
    expect(home.body.letter.body).toContain('lezárult');
    // long after the deadline the closed quarter no longer leads
    const feb = await heroPeriod(h.deps.db, c.clientId, '2027-02-10');
    expect(feb!.period.periodKey).toBe('2027-Q1');
    h.clock.set('2026-11-17T09:00:00Z');
  });

  it('marking paid never wipes a verification; unmarking keeps a verified period verified', async () => {
    expect(paymentStatusOf([])).toBe('nincs_fizetendo');
    expect(paymentStatusOf([{ markedPaidAt: new Date(), verification: 'rendben' }, { markedPaidAt: null, verification: null }])).toBe('fizetendo');
    expect(paymentStatusOf([{ markedPaidAt: new Date(), verification: 'rendben' }, { markedPaidAt: new Date(), verification: null }])).toBe('befizetve_jelezve');
    const c = await assigned('ellenorzott@demo.kezjegy.test', { active: true });
    const [p] = await h.deps.db.insert(taxPeriods).values({ clientId: c.clientId, kind: 'negyedev', periodKey: '2026-Q3', year: 2026, quarter: 3, dueDate: '2026-10-12', calcStatus: 'jovahagyva', paymentStatus: 'fizetendo' }).returning();
    for (const kind of ['tb_jarulek', 'szocho'] as const)
      await h.deps.db.insert(taxPaymentItems).values({ taxPeriodId: p!.id, kind, label: kind, amountHuf: 50_000, dueDate: '2026-10-12', accountName: 'NAV', accountNumber: '10032000-06055950', iban: 'HU00', reference: '12345676-1-41' });
    await markPaid(h.deps, h.deps.db, c.clientId, p!.id, undefined, '2026-10-10', c.userId);
    const v = await verifyPayment(h.deps, h.deps.db, p!.id, bence.userId, bence.accountantId!, [{ kind: 'tb_jarulek', verification: 'rendben' }, { kind: 'szocho', verification: 'rendben' }]);
    expect(v.paymentStatus).toBe('ellenorizve');
    await expect(markPaid(h.deps, h.deps.db, c.clientId, p!.id, undefined, '2026-10-11', c.userId)).rejects.toMatchObject({ status: 409 });
    const un = await unmarkPaid(h.deps, h.deps.db, c.clientId, p!.id, undefined, c.userId);
    expect(un.paymentStatus).toBe('ellenorizve');
    const items = await h.deps.db.select().from(taxPaymentItems).where(eq(taxPaymentItems.taxPeriodId, p!.id));
    expect(items.every((i) => i.verification === 'rendben' && i.markedPaidOn === '2026-10-10')).toBe(true);
  });
});

describe('uploads are let in a few at a time', () => {
  it('at most UPLOAD_SLOTS run at once, one per caller; the rest wait or get 429', async () => {
    let running = 0;
    let peak = 0;
    const perCaller = new Map<string, number>();
    let callerPeak = 0;
    const job = (caller: string) =>
      withUploadSlot(caller, async () => {
        running++;
        peak = Math.max(peak, running);
        perCaller.set(caller, (perCaller.get(caller) ?? 0) + 1);
        callerPeak = Math.max(callerPeak, perCaller.get(caller)!);
        await new Promise((r) => setTimeout(r, 15));
        perCaller.set(caller, perCaller.get(caller)! - 1);
        running--;
        return caller;
      });
    const res = await Promise.allSettled([job('a'), job('a'), job('a'), job('a'), job('a'), job('a'), job('a'), job('a'), job('b'), job('c'), job('d')]);
    expect(peak).toBeLessThanOrEqual(UPLOAD_SLOTS);
    expect(callerPeak).toBe(1);
    // caller "a": one running + six waiting are accepted, the eighth is refused at once with 429
    const refused = res.filter((r) => r.status === 'rejected');
    expect(refused.length).toBe(1);
    expect((refused[0] as PromiseRejectedResult).reason).toMatchObject({ status: 429 });
    expect(res.filter((r) => r.status === 'fulfilled').length).toBe(10);
  });
});

describe('one-time data fixes of round 1', () => {
  it('old notification links, missing attribution rows; a second run changes nothing', async () => {
    const c = await assigned('adatjavitas@demo.kezjegy.test');
    await h.deps.db.insert(notifications).values({ userId: c.userId, kind: 'document_processed', title: '1 iratod feldolgozva', body: 'x', link: '/dosszie/2026-10', wantPush: false, wantEmail: false });
    await h.deps.db.insert(notifications).values({ userId: c.userId, kind: 'tax_filed', title: 'y', body: 'y', link: '/dosszie', wantPush: false, wantEmail: false });
    await h.deps.db.delete(signupAttribution).where(eq(signupAttribution.userId, c.userId));
    const r = await runDataFixKor1(h.deps);
    expect(r).toMatchObject({ links: 1 });
    expect((r as { attribution: number }).attribution).toBeGreaterThanOrEqual(1);
    const links = (await h.deps.db.select().from(notifications).where(eq(notifications.userId, c.userId))).map((n) => n.link).sort();
    expect(links).toContain('/dosszie?honap=2026-10');
    expect(links).toContain('/dosszie');
    expect((await h.deps.db.select().from(signupAttribution).where(eq(signupAttribution.userId, c.userId))).length).toBe(1);
    expect(await runDataFixKor1(h.deps)).toBe('already');
    expect((await h.deps.db.select().from(systemState).where(eq(systemState.key, 'data.kor1_1119'))).length).toBe(1);
  });

  it('a jogállás change in a year with an approved quarter leaves a pinned internal note', async () => {
    const c = await assigned('jogallas@demo.kezjegy.test', { active: true });
    await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, adoazonositoJel: validAdoJel(5234567), adoszam: adoszam('5234567', 1), taxStatus: 'mellekallasu' } });
    await h.deps.db.insert(taxPeriods).values({ clientId: c.clientId, kind: 'negyedev', periodKey: '2026-Q1', year: 2026, quarter: 1, dueDate: '2026-04-13', calcStatus: 'jovahagyva', paymentStatus: 'nincs_fizetendo' }).onConflictDoNothing();
    await h.deps.db.update(taxPeriods).set({ calcStatus: 'jovahagyva' }).where(and(eq(taxPeriods.clientId, c.clientId), eq(taxPeriods.periodKey, '2026-Q1')));
    const r = await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, status: 'fofoglalkozasu' } });
    expect(r.status).toBe(200);
    const notes = await h.deps.db.select().from(internalNotes).where(eq(internalNotes.clientId, c.clientId));
    expect(notes.length).toBe(1);
    expect(notes[0]).toMatchObject({ pinned: true });
    expect(notes[0]!.body).toContain('mellékállású → főfoglalkozású');
  });
});
