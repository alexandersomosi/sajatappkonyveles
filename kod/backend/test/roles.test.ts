// Role + ownership matrix (SPEC §4.2, §22): client A cannot read client B's documents, files,
// periods, requests; an accountant cannot read unassigned clients; admin cannot read documents/KYC.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients } from '../src/db/schema.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let A: Awaited<ReturnType<typeof newClient>>;
let B: Awaited<ReturnType<typeof newClient>>;
let bence: Awaited<ReturnType<typeof staff>>;
let other: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
let docA: { id: string; versions: { fileId: string }[] };
let periodA: string;

function upload(token: string, path: string, fields: Record<string, string>, name = 'kivonat.pdf', bytes = pdfBytes()) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('file', new Blob([bytes as BlobPart], { type: 'application/pdf' }), name);
  return h.json('POST', path, { token, form: fd });
}

beforeAll(async () => {
  h = await setup();
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  other = await staff(h, 'accountant', 'masik@demo.kezjegy.test', { firstName: 'Ádám' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
  A = await newClient(h, 'a@demo.kezjegy.test', { first: 'Anna', active: true });
  B = await newClient(h, 'b@demo.kezjegy.test', { first: 'Béla', active: true });
  // A → Bence, B → the other accountant
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, A.clientId));
  await h.deps.db.update(clients).set({ accountantId: other.accountantId }).where(eq(clients.id, B.clientId));
  const up = await upload(A.token, '/client/documents', { category: 'bankszamlakivonat', dossierMonth: '2026-10' });
  expect(up.status).toBe(201);
  docA = up.body;
  await h.json('PATCH', `/acc/clients/${A.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
  const periods = await h.json('GET', `/acc/clients/${A.clientId}/tax-periods?year=2026`, { token: bence.token });
  periodA = periods.body.items[0].id;
});
afterAll(async () => h.close());

describe('client isolation', () => {
  it('client B gets 404 for A’s document, file, period and request', async () => {
    expect((await h.json('GET', `/client/documents/${docA.id}`, { token: B.token })).status).toBe(404);
    expect((await h.json('GET', `/files/${docA.versions[0]!.fileId}`, { token: B.token })).status).toBe(404);
    expect((await h.json('POST', `/files/${docA.versions[0]!.fileId}/link`, { token: B.token })).status).toBe(404);
    expect((await h.json('GET', `/client/tax-periods/${periodA}`, { token: B.token })).status).toBe(404);
    expect((await h.json('DELETE', `/client/documents/${docA.id}`, { token: B.token })).status).toBe(404);
    const req = await h.json('POST', `/acc/clients/${A.clientId}/requests`, { token: bence.token, body: { type: 'dokumentum', title: 'Kivonat kell' } });
    expect((await h.json('POST', `/client/requests/${req.body.id}/complete`, { token: B.token, body: {} })).status).toBe(404);
  });
  it('client A can read its own file, decrypted', async () => {
    const r = await h.req('GET', `/files/${docA.versions[0]!.fileId}`, { token: A.token });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
  });
  it('signed links work only for the same file and expire after 5 minutes', async () => {
    const link = await h.json('POST', `/files/${docA.versions[0]!.fileId}/link`, { token: A.token });
    const url = (link.body.url as string).replace('/api/v1', '');
    expect((await h.req('GET', url)).status).toBe(200);
    expect((await h.req('GET', url.replace(docA.versions[0]!.fileId, docA.id))).status).toBe(404);
    h.clock.advance(6 * 60_000);
    expect((await h.req('GET', url)).status).toBe(404);
  });
  it('a client cannot reach accountant or admin routes', async () => {
    expect((await h.json('GET', '/acc/clients', { token: A.token })).status).toBe(404);
    expect((await h.json('GET', '/admin/dashboard', { token: A.token })).status).toBe(404);
  });
  it('without a token everything is 401', async () => {
    expect((await h.json('GET', '/client/home')).status).toBe(401);
    expect((await h.json('GET', '/acc/clients')).status).toBe(401);
    expect((await h.json('GET', `/files/${docA.versions[0]!.fileId}`)).status).toBe(401);
  });
});

describe('accountant assignment', () => {
  it('the other accountant gets 404 for A everywhere', async () => {
    const t = other.token;
    expect((await h.json('GET', `/acc/clients/${A.clientId}`, { token: t })).status).toBe(404);
    expect((await h.json('GET', `/acc/documents/${docA.id}`, { token: t })).status).toBe(404);
    expect((await h.json('GET', `/acc/clients/${A.clientId}/kyc`, { token: t })).status).toBe(404);
    expect((await h.json('GET', `/acc/clients/${A.clientId}/messages`, { token: t })).status).toBe(404);
    expect((await h.json('POST', `/acc/tax-periods/${periodA}/reopen`, { token: t, body: { reason: 'x' } })).status).toBe(404);
    expect((await h.json('GET', `/files/${docA.versions[0]!.fileId}`, { token: t })).status).toBe(404);
    const list = await h.json('GET', '/acc/clients', { token: t });
    expect(list.body.items.map((x: { id: string }) => x.id)).not.toContain(A.clientId);
  });
  it('the assigned accountant sees A; opening the document sets "Bence látta"', async () => {
    const d = await h.json('GET', `/acc/documents/${docA.id}`, { token: bence.token });
    expect(d.status).toBe(200);
    expect(d.body.status).toBe('konyvelo_latta');
    const mine = await h.json('GET', `/client/documents/${docA.id}`, { token: A.token });
    expect(mine.body.statusLabel).toBe('Bence látta');
  });
});

describe('admin least privilege', () => {
  it('admin sees business data but no documents, KYC, files or messages', async () => {
    expect((await h.json('GET', '/admin/clients', { token: admin.token })).status).toBe(200);
    expect((await h.json('GET', '/admin/dashboard', { token: admin.token })).status).toBe(200);
    expect((await h.json('GET', `/acc/clients/${A.clientId}`, { token: admin.token })).status).toBe(404);
    expect((await h.json('GET', `/acc/documents/${docA.id}`, { token: admin.token })).status).toBe(404);
    expect((await h.json('GET', `/acc/clients/${A.clientId}/kyc`, { token: admin.token })).status).toBe(404);
    expect((await h.json('GET', `/files/${docA.versions[0]!.fileId}`, { token: admin.token })).status).toBe(404);
    expect((await h.json('GET', '/client/home', { token: admin.token })).status).toBe(404);
  });
  it('admin can reassign a client (audited)', async () => {
    const r = await h.json('PATCH', `/admin/clients/${B.clientId}`, { token: admin.token, body: { accountantId: bence.accountantId } });
    expect(r.status).toBe(200);
    const list = await h.json('GET', '/acc/clients', { token: bence.token });
    expect(list.body.items.map((x: { id: string }) => x.id)).toContain(B.clientId);
    const audit = await h.json('GET', '/admin/audit?action=admin.client_reassigned', { token: admin.token });
    expect(audit.body.items.length).toBe(1);
  });
});
