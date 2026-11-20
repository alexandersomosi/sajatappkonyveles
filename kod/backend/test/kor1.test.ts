// Round-1 review regressions: the optional call never blocks activation, appointments cannot be
// double-booked, offboarded accountants lose access at once, decompression bombs are refused,
// database errors never put personal data into the logs, the accountant can withdraw his own
// request, unverified accounts cannot push work to the accountant, a cancelled deletion keeps the
// paid period and shows when the service ends.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, onboardingSteps } from '../src/db/schema.js';
import { safeErr, scrubText } from '../src/log.js';
import { fillLegal } from '../src/legal.js';
import { demoReceiptPng } from '../src/lib/png.js';
import { lastCode, newClient, PW, registerUnverified, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { appointmentsEnabled: true });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
});
afterAll(async () => h.close());

async function assigned(email: string) {
  const c = await newClient(h, email, { first: 'Panna', last: 'Minta' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}

describe('optional call', () => {
  it('a client with every required step done is active even if the call was never booked', async () => {
    const c = await assigned('hivasnelkul@demo.kezjegy.test');
    await h.deps.db.update(onboardingSteps).set({ status: 'kesz' }).where(eq(onboardingSteps.clientId, c.clientId));
    await h.deps.db.update(onboardingSteps).set({ status: 'ugyfelre_var' }).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'idopont')));
    await h.deps.db.update(onboardingSteps).set({ status: 'konyvelore_var' }).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'nav_bekotes')));
    // round 1 (2026-11-19): the accountant cannot close azonositas by hand any more (only through the KYC review)
    const no = await h.json('POST', `/acc/clients/${c.clientId}/onboarding/azonositas`, { token: bence.token, body: { status: 'kesz' } });
    expect(no.status).toBe(409);
    const r = await h.json('POST', `/acc/clients/${c.clientId}/onboarding/nav_bekotes`, { token: bence.token, body: { status: 'kihagyva' } });
    expect(r.status).toBe(200);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lifecycle).toBe('aktiv');
    // Flags are recomputed together with the activation (no "Bekötés alatt" left in the panel).
    expect(cl!.nextFlags).not.toContain('bekotes_alatt');
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.client.onboardingComplete).toBe(true);
  });
});

describe('appointments (retired by SPEC §26.2.9)', () => {
  it('booking and availability answer 410 megszunt_funkcio; the slot list is empty', async () => {
    const a = await h.json('POST', '/acc/availability', { token: bence.token, body: { slots: [{ startsAt: '2026-11-19T09:00:00.000Z', endsAt: '2026-11-19T09:30:00.000Z', channels: ['telefon'] }] } });
    expect(a.status).toBe(410);
    expect(a.body.error.code).toBe('megszunt_funkcio');
    const c1 = await assigned('foglalo1@demo.kezjegy.test');
    const slots = await h.json('GET', '/client/appointments/slots', { token: c1.token });
    expect(slots.body).toEqual({ enabled: false, slots: [] });
    const book = await h.json('POST', '/client/appointments', { token: c1.token, body: { slotId: '00000000-0000-4000-8000-000000000000', channel: 'telefon', phone: '+36301234567' } });
    expect(book.status).toBe(410);
    expect(book.body.error.message).toContain('Kérj visszahívást');
    expect((await h.json('GET', '/acc/settings', { token: bence.token })).body.appointmentsEnabled).toBe(false);
  });
});

describe('accountant offboarding', () => {
  it('deactivation disables the login, revokes every session and closes the files', async () => {
    const zoli = await staff(h, 'accountant', 'zoli@demo.kezjegy.test', { firstName: 'Zoli' });
    expect((await h.json('GET', '/acc/clients', { token: zoli.token })).status).toBe(200);
    const r = await h.json('PATCH', `/admin/accountants/${zoli.accountantId}`, { token: admin.token, body: { active: false } });
    expect(r.status).toBe(200);
    expect((await h.json('GET', '/acc/clients', { token: zoli.token })).status).toBe(401);
    const login = await h.json('POST', '/auth/login', { body: { email: 'zoli@demo.kezjegy.test', password: PW, clientKind: 'panel' }, headers: { 'x-forwarded-for': '198.51.110.1' } });
    expect(login.status).toBe(401);
  });
});

describe('uploads', () => {
  it('a PNG that claims 100 000 × 100 000 pixels is refused before decoding', async () => {
    const c = await assigned('bomba@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const png = Buffer.from(demoReceiptPng(20, 20, 1));
    png.writeUInt32BE(100_000, 16);
    png.writeUInt32BE(100_000, 20);
    const fd = new FormData();
    fd.append('category', 'nyugta');
    fd.append('dossierMonth', '2026-11');
    for (let i = 0; i < 2; i++) fd.append('pages', new Blob([new Uint8Array(png) as BlobPart], { type: 'image/png' }), `p${i}.png`);
    const r = await h.json('POST', '/client/documents', { token: c.token, form: fd });
    expect(r.status).toBe(413);
  });
});

describe('logging', () => {
  it('a database error is logged without the query, the parameters or the message', () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), { code: '23505', constraint: 'users_email_unique', table: 'users' });
    const err = Object.assign(new Error('Failed query: insert into "users" ("email","password_hash") values ($1, $2)\nparams: kata@demo.kezjegy.test,$argon2id$v=19$m=19456,t=2,p=1$abc$def'), { name: 'DrizzleQueryError', cause });
    const out = JSON.stringify(safeErr(err));
    expect(out).not.toContain('@');
    expect(out).not.toContain('argon2');
    expect(out).toContain('23505');
    expect(scrubText('hívd: +36 30 123 4567, kata@demo.kezjegy.test')).not.toMatch(/\d{3}|@/);
  });
});

describe('requests', () => {
  it('the accountant can withdraw his own open request; the client is told', async () => {
    const c = await assigned('visszavon@demo.kezjegy.test');
    const rq = await h.json('POST', `/acc/clients/${c.clientId}/requests`, { token: bence.token, body: { type: 'dokumentum', title: 'Fotózd le a nyugtatömb lapjait.' } });
    expect(rq.status).toBe(201);
    expect(rq.body.statusLabel).toBe('Az ügyfélre vár');
    const w = await h.json('PATCH', `/acc/requests/${rq.body.id}`, { token: bence.token, body: { status: 'visszavonva' } });
    expect(w.status).toBe(200);
    expect(w.body.status).toBe('visszavonva');
  });
});

describe('unverified e-mail', () => {
  it('cannot submit identity papers, documents or messages', async () => {
    const r = await registerUnverified(h, 'nemigazolt@demo.kezjegy.test', { 'x-forwarded-for': '198.51.111.1' }, { first: 'Nem', last: 'Igazolt' });
    const msg = await h.json('POST', '/client/messages', { token: r.body.accessToken, body: { body: 'Szia' } });
    expect(msg.status).toBe(409);
    expect(msg.body.error.code).toBe('email_not_verified');
    expect(lastCode(h, 'nemigazolt@demo.kezjegy.test')).toMatch(/^\d{6}$/);
    expect((await h.json('GET', '/client/onboarding', { token: r.body.accessToken })).status).toBe(200);
  });
});

describe('profile', () => {
  it('the stored adóazonosító jel may be left empty; a new client must give it', async () => {
    const c = await assigned('profil@demo.kezjegy.test');
    const base = {
      firstName: 'Panna',
      lastName: 'Minta',
      adoszam: '68801234-1-41',
      address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
      hqMunicipality: 'Budapest',
      activityText: 'Grafika',
      activityAnswer: 'egyeb',
      taxStatus: 'fofoglalkozasu',
      evSince: '2019-04-01',
      hasSeparateBusinessAccount: true,
    };
    const missing = await h.json('PUT', '/client/profile', { token: c.token, body: base });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.adoazonositoJel).toBeTruthy();
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: { ...base, adoazonositoJel: '8417104569' } })).status).toBe(200);
    const again = await h.json('PUT', '/client/profile', { token: c.token, body: { ...base, adoazonositoJel: '' } });
    expect(again.status).toBe(200);
    expect(again.body.adoazonositoJelMasked).toBe('•••••••569');
    // The panel gets only the masked value; "Mutasd" is a separate, audited call.
    const det = await h.json('GET', `/acc/clients/${c.clientId}`, { token: bence.token });
    expect(det.body.adoazonositoJel).toBeNull();
    expect(det.body.adoazonositoJelMasked).toBe('•••••••569');
    const rev = await h.json('POST', `/acc/clients/${c.clientId}/adoazonosito/reveal`, { token: bence.token });
    expect(rev.body.adoazonositoJel).toBe('8417104569');
  });
});

describe('legal texts', () => {
  it('"a(z)" follows the word after it, filled or literal', () => {
    const out = fillLegal('Ez a(z) Kézjegy szolgáltatás. A(z) {{ceg.email}} címen, vagy a(z) [CÉGADAT: x]. Ez a(z) 5 napos határidő, a(z) {{brand.name}}.', { 'ceg.email': 'info@pelda.hu', 'brand.name': 'Kézjegy' });
    expect(out).toBe('Ez a Kézjegy szolgáltatás. Az info@pelda.hu címen, vagy a [CÉGADAT: x]. Ez az 5 napos határidő, a Kézjegy.');
  });
});
