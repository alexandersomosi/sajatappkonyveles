// Kör 2 javítások: szerződés-kitöltés, adóprofil ÖVTJ nélkül, beadás-ellenőrzések, irat-azonosító (IDOR),
// DEMO fizetés éles módban, CSV-képlet, export.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients } from '../src/db/schema.js';
import { filledLegalText, legalValuesForClient } from '../src/services/contracts.js';
import { fillLegal } from '../src/legal.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
beforeAll(async () => {
  h = await setup({ now: '2026-11-18T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test');
});
afterAll(async () => h.close());

describe('jogi kitöltés', () => {
  it('a megbízási szerződésben nincs {{ jelölő, dupla pont, és van e-mail', async () => {
    const c = await newClient(h, 'dora.minta@demo.kezjegy.test', { first: 'Dóra', last: 'Minta' });
    await h.deps.db
      .update(clients)
      .set({ accountantId: bence.accountantId, addressZip: '1136', addressCity: 'Budapest', addressLine: 'Példa utca 12.', evNyilvantartasiSzam: null })
      .where(eq(clients.id, c.clientId));
    const t = await filledLegalText(h.deps, 'megbizasi_szerzodes', c.clientId);
    expect(t.text).not.toContain('{{');
    expect(t.text).not.toMatch(/[^.]\.\.(?!\.)/);
    expect(t.text).toContain('1136 Budapest, Példa utca 12.');
    expect(t.text).toContain('E-mail: dora.minta@demo.kezjegy.test.');
    expect(t.text).toContain('nyilvántartási szám: – (a könyvelő pótolja)');
    const v = await legalValuesForClient(h.deps, c.clientId);
    const meghat = await h.deps.legal.template('nav_meghatalmazas_okirat.md');
    if (meghat) expect(fillLegal(meghat, { ...v, 'dok.verzio': '1', 'dok.hatalyos': '1' })).not.toContain('{{');
  });
  it('a pont-összevonás csak a sablon pontját nyeli el', () => {
    expect(fillLegal('A: {{x}}. B: {{y}}.', { x: 'Kft.', y: 'Kft' })).toBe('A: Kft. B: Kft.');
  });
});

describe('névelő a sablonokban', () => {
  it('az I. / a II. / az 5. / a 2026.', async () => {
    const { fill } = await import('../src/content.js');
    expect(fill('Megvan a {periodAdj} összeg', { periodAdj: 'I. negyedévi' })).toBe('Megvan az I. negyedévi összeg');
    expect(fill('Megvan a {periodAdj} összeg', { periodAdj: 'II. negyedévi' })).toBe('Megvan a II. negyedévi összeg');
    expect(fill('{firstName} beadta a {period}es bevallást', { firstName: 'Bence', period: 'I. negyedév' })).toBe('Bence beadta az I. negyedéves bevallást');
    expect(fill('A {periodAdj} fizetendő', { periodAdj: 'IV. negyedévi' })).toBe('A IV. negyedévi fizetendő');
    expect(fill('A {periodAdj} fizetendő', { periodAdj: '2026. első HIPA-előleg' })).toBe('A 2026. első HIPA-előleg fizetendő');
  });
});

const profile = {
  firstName: 'Dóra',
  lastName: 'Minta',
  adoazonositoJel: '8417104569',
  adoszam: '68801234-1-41',
  address: { zip: '1136', city: 'Budapest', line: 'Példa utca 12.' },
  hqMunicipality: 'Budapest',
  activityText: 'Grafika',
  activityAnswer: 'egyeb',
  taxStatus: 'fofoglalkozasu',
  evSince: '2019-04-01',
  hasSeparateBusinessAccount: true,
};

describe('könyvelői végpontok (kör 2)', () => {
  it('adóprofil megerősítése ÖVTJ nélkül (activityCode: null)', async () => {
    const c = await newClient(h, 'ovtj@demo.kezjegy.test', { first: 'Dóra' });
    await h.json('PUT', '/client/profile', { token: c.token, body: profile });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    const r = await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', activityCode: null } });
    expect(r.status).toBe(200);
    const r2 = await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, activityCode: '7410' } });
    expect(r2.status).toBe(200);
    const [row] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(row!.activityCode).toBe('7410');
  });

  it('futó negyedév nem jelölhető beadottnak (409), és a lista megmondja, miért', async () => {
    const c = await newClient(h, 'beadas@demo.kezjegy.test', { first: 'Dóra' });
    await h.json('PUT', '/client/profile', { token: c.token, body: profile });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
    const list = await h.json('GET', `/acc/clients/${c.clientId}/tax-periods?year=2026`, { token: bence.token });
    expect(list.status).toBe(200);
    const q4 = list.body.items.find((p: { periodKey: string }) => p.periodKey.endsWith('Q4'));
    expect(q4.filing.canFile).toBe(false);
    expect(q4.filing.reason).toContain('még tart');
    const r = await h.json('POST', `/acc/tax-periods/${q4.id}/filed`, { token: bence.token, body: { filedOn: '2026-11-18', form: '2658', returnFileId: '00000000-0000-4000-8000-000000000000' } });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toContain('még tart');
  });

  it('üzenetben csak a saját ügyfél közös irata hivatkozható (IDOR)', async () => {
    const { pdfBytes } = await import('./helpers.js');
    const a = await newClient(h, 'idor-a@demo.kezjegy.test', { first: 'Anna', active: true });
    const b = await newClient(h, 'idor-b@demo.kezjegy.test', { first: 'Bori', active: true });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, a.clientId));
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, b.clientId));
    const fd = new FormData();
    fd.append('category', 'bankszamlakivonat');
    fd.append('dossierMonth', '2026-10');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'b.pdf');
    const docB = await h.json('POST', '/client/documents', { token: b.token, form: fd });
    expect(docB.status).toBe(201);
    const bad = await h.json('POST', `/acc/clients/${a.clientId}/messages`, { token: bence.token, body: { body: 'Nézd meg ezt.', documentId: docB.body.id } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.documentId).toBeTruthy();
    const ok = await h.json('POST', `/acc/clients/${b.clientId}/messages`, { token: bence.token, body: { body: 'Ezt nézd.', documentId: docB.body.id } });
    expect(ok.status).toBe(201);
    expect(ok.body.document.id).toBe(docB.body.id);
  });
});

describe('kérés-méret útvonalanként', () => {
  it('refresh 8 KB, IPN 64 KB, JSON 1 MB, feltöltés 60 MB', async () => {
    const { bodyLimitFor } = await import('../src/app.js');
    expect(bodyLimitFor('/api/v1/auth/refresh')).toBe(8 * 1024);
    expect(bodyLimitFor('/api/v1/webhooks/simplepay/ipn')).toBe(64 * 1024);
    expect(bodyLimitFor('/api/v1/client/messages')).toBe(1024 * 1024);
    expect(bodyLimitFor('/api/v1/client/documents')).toBe(60 * 1024 * 1024);
    expect(bodyLimitFor('/api/v1/client/documents/abc/versions')).toBe(60 * 1024 * 1024);
    expect(bodyLimitFor('/api/v1/acc/clients/abc/documents')).toBe(60 * 1024 * 1024);
    expect(bodyLimitFor('/api/v1/client/kyc')).toBe(60 * 1024 * 1024);
    const big = 'x'.repeat(20 * 1024);
    const r = await h.req('POST', '/auth/refresh', { raw: JSON.stringify({ refreshToken: big }), headers: { 'content-type': 'application/json', 'x-kezjegy': '1' } });
    expect(r.status).toBe(413);
    const ipn = await h.req('POST', '/webhooks/simplepay/ipn', { raw: 'y'.repeat(100 * 1024), headers: { 'content-type': 'application/json' } });
    expect(ipn.status).toBe(413);
  });
  it('rossz aláírású IPN nem ír napló-sort, és sok után 429', async () => {
    const { auditLog } = await import('../src/db/schema.js');
    const { sql } = await import('drizzle-orm');
    const count = async () => (await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(auditLog).where(sql`${auditLog.action} = 'payment.ipn'`))[0]!.n;
    const before = await count();
    let last = 0;
    for (let i = 0; i < 32; i++) {
      const r = await h.req('POST', '/webhooks/simplepay/ipn', { raw: '{"orderRef":"x"}', headers: { 'content-type': 'application/json', signature: 'rossz', 'x-forwarded-for': '203.0.113.77' } });
      last = r.status;
    }
    expect(last).toBe(429);
    expect(await count()).toBe(before);
  });
});

describe('CSV-cella', () => {
  it('képletnek látszó szöveg elé aposztróf kerül, a szám szám marad', async () => {
    const { csvCell } = await import('../src/routes/acc.js');
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell('+36 1 234')).toBe("'+36 1 234");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('a\rb')).toBe('"a\rb"');
    expect(csvCell(-1500)).toBe('-1500');
    expect(csvCell('Minta Kft.')).toBe('Minta Kft.');
  });
});

describe('KYC: a PEP-nyilatkozat titkosítva', () => {
  it('nincs nyílt szövegben, a könyvelő látja; a régi sorokat induláskor titkosítjuk', async () => {
    const { kycRecords } = await import('../src/db/schema.js');
    const { demoReceiptPng } = await import('../src/lib/png.js');
    const { encryptLegacyPep } = await import('../src/services/kyc.js');
    const c = await newClient(h, 'pep@demo.kezjegy.test', { first: 'Dóra' });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    const png = new Uint8Array(demoReceiptPng(60, 40, 2));
    const fd = new FormData();
    for (const k of ['idFront', 'idBack', 'addressFront']) fd.append(k, new Blob([png as BlobPart], { type: 'image/png' }), `${k}.png`);
    fd.append('data', JSON.stringify({ name: 'Minta Dóra', mothersBirthName: 'Minta Mária', birthPlace: 'Példafalva', birthDate: '1988-05-02', citizenship: 'magyar', address: '1136 Budapest, Példa utca 12.', documentType: 'szemelyi', documentNumber: '123456AB', documentExpiry: '2031-01-01' }));
    fd.append('declarations', JSON.stringify({ ownBehalf: true, pep: true, pepDetails: 'Kitalált polgármester', truthful: true, notifyChanges: true }));
    expect((await h.json('POST', '/client/kyc', { token: c.token, form: fd })).status).toBe(201);
    const [k] = await h.deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, c.clientId));
    expect(JSON.stringify(k!.declarations)).not.toMatch(/pep|polgármester/i);
    expect(k!.declarationsEnc).toBeTruthy();
    expect(k!.declarationsEnc).not.toContain('polgármester');
    const view = await h.json('GET', `/acc/clients/${c.clientId}/kyc`, { token: bence.token });
    expect(view.body.declarations).toMatchObject({ pep: true, pepDetails: 'Kitalált polgármester', ownBehalf: true });
    // legacy row
    await h.deps.db.update(kycRecords).set({ declarations: { ...k!.declarations, pep: true, pepDetails: 'Régi' }, declarationsEnc: null }).where(eq(kycRecords.id, k!.id));
    expect(await encryptLegacyPep(h.deps)).toBe(1);
    const [k2] = await h.deps.db.select().from(kycRecords).where(eq(kycRecords.id, k!.id));
    expect(JSON.stringify(k2!.declarations)).not.toMatch(/pep|Régi/);
    const view2 = await h.json('GET', `/acc/clients/${c.clientId}/kyc`, { token: bence.token });
    expect(view2.body.declarations).toMatchObject({ pep: true, pepDetails: 'Régi' });
    expect(await encryptLegacyPep(h.deps)).toBe(0);
  });
});

describe('KYC megőrzés (Pmt. 8 év a kapcsolat vége után)', () => {
  it('aktív ügyfélnél nincs lejárat; megszűnéskor (admin) +8 év', async () => {
    const { files, kycRecords } = await import('../src/db/schema.js');
    const { demoReceiptPng } = await import('../src/lib/png.js');
    const admin = await staff(h, 'admin', 'admin-ret@demo.kezjegy.test');
    const c = await newClient(h, 'ret@demo.kezjegy.test', { first: 'Dóra' });
    const png = new Uint8Array(demoReceiptPng(60, 40, 2));
    const fd = new FormData();
    for (const k of ['idFront', 'addressFront']) fd.append(k, new Blob([png as BlobPart], { type: 'image/png' }), `${k}.png`);
    fd.append('data', JSON.stringify({ name: 'Minta Dóra', mothersBirthName: 'Minta Mária', birthPlace: 'Példafalva', birthDate: '1988-05-02', citizenship: 'magyar', address: '1136 Budapest, Példa utca 12.', documentType: 'utlevel', documentNumber: '123456AB', documentExpiry: '2031-01-01' }));
    fd.append('declarations', JSON.stringify({ ownBehalf: true, pep: false, truthful: true, notifyChanges: true }));
    expect((await h.json('POST', '/client/kyc', { token: c.token, form: fd })).status).toBe(201);
    const kycFiles = async () => (await h.deps.db.select().from(files).where(eq(files.ownerClientId, c.clientId))).filter((f) => f.kind === 'kyc');
    expect((await kycFiles()).every((f) => f.retentionUntil === null)).toBe(true);
    const r = await h.json('PATCH', `/admin/clients/${c.clientId}`, { token: admin.token, body: { lifecycle: 'megszunt' } });
    expect(r.status).toBe(200);
    const after = await kycFiles();
    expect(after.every((f) => f.retentionUntil && f.retentionUntil >= '2034-11-18')).toBe(true);
    const [k] = await h.deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, c.clientId));
    expect(k!.relationshipEndedAt).toBeTruthy();
  });
});
