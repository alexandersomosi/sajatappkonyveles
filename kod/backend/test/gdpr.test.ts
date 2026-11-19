// GDPR export + delete (SPEC §4.8), the append-only audit log (§4.6), messages/requests,
// appointments, notifications and the worker job runner.
import { inflateRawSync } from 'node:zlib';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, clients, files, systemState, users } from '../src/db/schema.js';
import { runGdprJob } from '../src/services/gdpr.js';
import { jobDefs, runIfDue } from '../src/jobs.js';
import { newClient, pdfBytes, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { appointmentsEnabled: true });
});
afterAll(async () => h.close());

function unzipNames(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let off = 0;
  while (buf.readUInt32LE(off) === 0x04034b50) {
    const method = buf.readUInt16LE(off + 8);
    const size = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extra = buf.readUInt16LE(off + 28);
    const name = buf.subarray(off + 30, off + 30 + nameLen).toString('utf8');
    const data = buf.subarray(off + 30 + nameLen + extra, off + 30 + nameLen + extra + size);
    out.set(name, method === 8 ? inflateRawSync(data) : data);
    off += 30 + nameLen + extra + size;
  }
  return out;
}

describe('messages, requests, appointments', () => {
  it('chat both ways with attachments; certificate request; booking', async () => {
    const c = await newClient(h, 'uzenet@demo.kezjegy.test', { first: 'Kata', active: true });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    const fd = new FormData();
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'level.pdf');
    const att = await h.json('POST', '/client/attachments', { token: c.token, form: fd });
    expect(att.status).toBe(201);
    const m = await h.json('POST', '/client/messages', { token: c.token, body: { body: 'Levelet kaptam a NAV-tól.', fileIds: [att.body.fileId] } });
    expect(m.status).toBe(201);
    expect(m.body.sender).toBe('en');
    const accView = await h.json('GET', `/acc/clients/${c.clientId}/messages`, { token: bence.token });
    expect(accView.body.items[0]).toMatchObject({ sender: 'ugyfel', body: 'Levelet kaptam a NAV-tól.' });
    expect(accView.body.items[0].attachments[0].displayName).toBe('level.pdf');
    await h.json('POST', `/acc/clients/${c.clientId}/messages`, { token: bence.token, body: { body: 'Csak értesítés, nincs teendőd.' } });
    const mine = await h.json('GET', '/client/messages', { token: c.token });
    expect(mine.body.items[0]).toMatchObject({ sender: 'konyvelo', body: 'Csak értesítés, nincs teendőd.' });

    const cert = await h.json('POST', '/client/requests', { token: c.token, body: { type: 'jovedelemigazolas', body: 'Hitelhez', certificate: { certificateType: 'jovedelemigazolas', year: 2025, purpose: 'bank' } } });
    expect(cert.status).toBe(201);
    expect(cert.body.title).toBe('Jövedelemigazolás 2025');
    const queue = await h.json('GET', '/acc/requests?status=nyitott', { token: bence.token });
    expect(queue.body.items.map((r: { id: string }) => r.id)).toContain(cert.body.id);
    const done = await h.json('PATCH', `/acc/requests/${cert.body.id}`, { token: bence.token, body: { status: 'teljesitve' } });
    expect(done.body.status).toBe('teljesitve');

    // SPEC §26.2: booking is retired; the client asks for a callback instead.
    const open = await h.json('GET', '/client/appointments/slots', { token: c.token });
    expect(open.body.enabled).toBe(false);
    const cb = await h.json('POST', '/client/callbacks', { token: c.token, body: { phone: '+36301234567', topic: 'egyeb', window: 'barmikor', source: 'uzenetek' } });
    expect(cb.status).toBe(201);
    const dl = await h.json('GET', '/client/deadlines', { token: c.token });
    expect(dl.body.items.some((d: { kind: string }) => d.kind === 'idopont')).toBe(false);
  });
});

describe('audit log is append-only', () => {
  it('UPDATE and DELETE are rejected by the trigger; the retention job may purge', async () => {
    await expect(h.deps.db.update(auditLog).set({ action: 'x' })).rejects.toThrow();
    await expect(h.deps.db.delete(auditLog)).rejects.toThrow();
    const n = await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
    expect(n[0]!.n).toBeGreaterThan(0);
    const res = await runGdprJob(h.deps); // purges only rows older than 5 years – none here, but must not throw
    expect(res).toBeTruthy();
  });
  it('audit details never contain message bodies or codes', async () => {
    const rows = await h.deps.db.select().from(auditLog);
    const s = JSON.stringify(rows.map((r) => r.details));
    expect(s).not.toContain('Levelet kaptam');
    expect(s).not.toMatch(/"code":"\d{6}"/);
    expect(rows.every((r) => !r.ipHmac || /^[0-9a-f]{32}$/.test(r.ipHmac))).toBe(true);
  });
});

describe('GDPR', () => {
  it('export contains the data and the decrypted files', async () => {
    const c = await newClient(h, 'export@demo.kezjegy.test', { first: 'Kata', active: true });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    const fd = new FormData();
    fd.append('category', 'bankszamlakivonat');
    fd.append('dossierMonth', '2026-10');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'kivonat.pdf');
    await h.json('POST', '/client/documents', { token: c.token, form: fd });
    await h.json('POST', '/client/messages', { token: c.token, body: { body: 'Ez benne lesz az exportban.' } });
    const req = await h.json('POST', '/me/export', { token: c.token });
    expect(req.status).toBe(202);
    await runGdprJob(h.deps);
    const list = await h.json('GET', '/me/exports', { token: c.token });
    expect(list.body.items[0].status).toBe('kesz');
    const dl = await h.req('GET', `/me/exports/${req.body.exportId}/download`, { token: c.token });
    expect(dl.status).toBe(200);
    const entries = unzipNames(Buffer.from(await dl.arrayBuffer()));
    expect([...entries.keys()]).toEqual(expect.arrayContaining(['OLVASS_EL.txt', 'fiok.json', 'ugyfel/adataim.json', 'ugyfel/uzenetek.json']));
    expect(entries.get('fiok.json')!.toString()).toContain('export@demo.kezjegy.test');
    expect(entries.get('ugyfel/uzenetek.json')!.toString()).toContain('Ez benne lesz az exportban.');
    const pdf = [...entries.entries()].find(([n]) => n.startsWith('fajlok/dokumentum/'));
    expect(pdf?.[1].subarray(0, 5).toString()).toBe('%PDF-');
    // another user cannot download it
    const other = await newClient(h, 'masik@demo.kezjegy.test');
    expect((await h.req('GET', `/me/exports/${req.body.exportId}/download`, { token: other.token })).status).toBe(404);
    // the link expires after 24 h
    h.clock.advance(25 * 3600_000);
    await runGdprJob(h.deps);
    const login = await h.json('POST', '/auth/login', { body: { email: 'export@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.1.1.1' } });
    expect((await h.req('GET', `/me/exports/${req.body.exportId}/download`, { token: login.body.accessToken })).status).toBe(404);
  });

  it('delete disables login at once; after 30 days the user is pseudonymised, tax records kept on legal hold', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await newClient(h, 'torol@demo.kezjegy.test', { first: 'Teri', active: true });
    const fd = new FormData();
    fd.append('category', 'nyugta');
    fd.append('dossierMonth', '2026-11');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'nyugta.pdf');
    const doc = await h.json('POST', '/client/documents', { token: c.token, form: fd });
    const wrong = await h.json('POST', '/me/delete', { token: c.token, body: { password: 'nem-ez-a-jelszo' } });
    expect(wrong.status).toBe(400);
    const del = await h.json('POST', '/me/delete', { token: c.token, body: { password: PW } });
    expect(del.status).toBe(202);
    expect(del.body.deletionDueAt).toBe('2026-12-17T09:00:00.000Z');
    expect((await h.json('GET', '/me', { token: c.token })).status).toBe(401);
    const login = await h.json('POST', '/auth/login', { body: { email: 'torol@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.2.2.2' } });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('deletion_pending');
    h.clock.set('2026-12-18T03:30:00Z');
    await runGdprJob(h.deps);
    const [u] = await h.deps.db.select().from(users).where(eq(users.id, c.userId));
    expect(u!.status).toBe('deleted');
    expect(u!.email).toMatch(/@deleted\.invalid$/);
    expect(u!.passwordHash).toBeNull();
    const [f] = await h.deps.db.select().from(files).where(eq(files.id, doc.body.versions[0].fileId));
    expect(f!.legalHold).toBe(true);
    expect(f!.retentionUntil).toBe('2032-12-31');
    const again = await h.json('POST', '/auth/login', { body: { email: 'torol@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.2.2.3' } });
    expect(again.status).toBe(401);
  });

  it('cancelling within 30 days: log in with cancelDeletion', async () => {
    h.clock.set('2026-11-17T09:00:00Z');
    const c = await newClient(h, 'meggondol@demo.kezjegy.test');
    await h.json('POST', '/me/delete', { token: c.token, body: { password: PW } });
    const back = await h.json('POST', '/auth/login', { body: { email: 'meggondol@demo.kezjegy.test', password: PW, clientKind: 'native', cancelDeletion: true }, headers: { 'x-forwarded-for': '10.3.3.3' } });
    expect(back.status).toBe(200);
    const [u] = await h.deps.db.select().from(users).where(eq(users.id, c.userId));
    expect(u!.status).toBe('active');
  });
});

describe('worker job runner', () => {
  it('runs each job once per slot and records it', async () => {
    h.clock.set('2026-11-18T08:05:00Z'); // 09:05 Budapest
    const jobs = jobDefs(h.deps);
    const reminders = jobs.find((j) => j.name === 'reminders')!;
    expect(await runIfDue(h.deps, reminders)).toBe(true);
    expect(await runIfDue(h.deps, reminders)).toBe(false);
    const [st] = await h.deps.db.select().from(systemState).where(eq(systemState.key, 'job.reminders'));
    expect((st!.value as { ok: boolean }).ok).toBe(true);
    const monthly = jobs.find((j) => j.name === 'monthly')!;
    expect(await runIfDue(h.deps, monthly)).toBe(false); // only on the 1st
  });
});

// Kör 2: a jelenlegi (3 fotós) KYC és az útlevél (nincs hátoldal) után az export nem omolhat össze,
// és a régi sorok '' fájlazonosítója sem kerülhet az uuid IN (...) lekérdezésbe.
describe('GDPR export with KYC', () => {
  async function kyc(token: string, documentType: 'szemelyi' | 'utlevel') {
    const { demoReceiptPng } = await import('../src/lib/png.js');
    const png = new Uint8Array(demoReceiptPng(80, 60, 3));
    const fd = new FormData();
    const sides = documentType === 'utlevel' ? ['idFront', 'addressFront'] : ['idFront', 'idBack', 'addressFront'];
    for (const k of sides) fd.append(k, new Blob([png as BlobPart], { type: 'image/png' }), `${k}.png`);
    fd.append('data', JSON.stringify({ name: 'Minta Dóra', mothersBirthName: 'Minta Mária', birthPlace: 'Példafalva', birthDate: '1988-05-02', citizenship: 'magyar', address: '1136 Budapest, Példa utca 12.', documentType, documentNumber: '123456AB', documentExpiry: '2031-01-01' }));
    fd.append('declarations', JSON.stringify({ ownBehalf: true, pep: false, truthful: true, notifyChanges: true }));
    const r = await h.json('POST', '/client/kyc', { token, form: fd });
    expect(r.status).toBe(201);
  }
  async function exportOk(token: string) {
    const req = await h.json('POST', '/me/export', { token });
    expect(req.status).toBe(202);
    await runGdprJob(h.deps);
    const list = await h.json('GET', '/me/exports', { token });
    expect(list.body.items[0].status).toBe('kesz');
    const dl = await h.req('GET', `/me/exports/${req.body.exportId}/download`, { token });
    return unzipNames(Buffer.from(await dl.arrayBuffer()));
  }
  it('3-photo KYC (személyi) – export is ready and holds the 3 KYC images', async () => {
    const c = await newClient(h, 'export-kyc@demo.kezjegy.test', { first: 'Dóra' });
    await kyc(c.token, 'szemelyi');
    const entries = await exportOk(c.token);
    expect([...entries.keys()].filter((n) => n.startsWith('fajlok/kyc/'))).toHaveLength(3);
  });
  it('passport KYC (no back side) – export is ready', async () => {
    const c = await newClient(h, 'export-utlevel@demo.kezjegy.test', { first: 'Dóra' });
    await kyc(c.token, 'utlevel');
    const entries = await exportOk(c.token);
    expect([...entries.keys()].filter((n) => n.startsWith('fajlok/kyc/'))).toHaveLength(2);
  });
  it("legacy row with '' file ids – export is ready", async () => {
    const { kycRecords } = await import('../src/db/schema.js');
    const c = await newClient(h, 'export-regi@demo.kezjegy.test', { first: 'Dóra' });
    await kyc(c.token, 'utlevel');
    const [k] = await h.deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, c.clientId));
    await h.deps.db.update(kycRecords).set({ files: { ...k!.files, idBack: '', addressBack: '' } }).where(eq(kycRecords.id, k!.id));
    await exportOk(c.token);
  });
});
