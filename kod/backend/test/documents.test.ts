// Uploads (type sniffing, size, encryption at rest, merge of photos), document status flow,
// and the tax flow approve → client home → mark paid / unmark → verify → filed.
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fixtures from '../src/_shared/demo/fixtures.json' with { type: 'json' };
import { clients, files, notifications, onboardingSteps } from '../src/db/schema.js';
import { decryptFileBlob } from '../src/lib/crypto.js';
import { demoReceiptPng } from '../src/lib/png.js';
import { demoCredentialsFor } from '../src/nav/types.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let c: Awaited<ReturnType<typeof newClient>>;
let bence: Awaited<ReturnType<typeof staff>>;

function form(fields: Record<string, string>, filesIn: { field: string; name: string; type: string; bytes: Uint8Array }[]) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const f of filesIn) fd.append(f.field, new Blob([f.bytes as BlobPart], { type: f.type }), f.name);
  return fd;
}

beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test');
  c = await newClient(h, 'kata@demo.kezjegy.test', { first: 'Kata', active: true });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
});
afterAll(async () => h.close());

describe('uploads', () => {
  it('rejects a file whose content is not JPEG/PNG/PDF, whatever the declared type', async () => {
    const r = await h.json('POST', '/client/documents', { token: c.token, form: form({ category: 'nyugta', dossierMonth: '2026-11' }, [{ field: 'file', name: 'x.pdf', type: 'application/pdf', bytes: new TextEncoder().encode('<html>nem pdf</html>') }]) });
    expect(r.status).toBe(415);
    expect(r.body.error.code).toBe('unsupported_type');
  });
  it('rejects HEIC with a helpful message', async () => {
    const heic = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0]);
    const r = await h.json('POST', '/client/documents', { token: c.token, form: form({ category: 'nyugta', dossierMonth: '2026-11' }, [{ field: 'file', name: 'kep.heic', type: 'image/heic', bytes: heic }]) });
    expect(r.status).toBe(415);
    expect(r.body.error.message).toMatch(/HEIC/);
  });
  it('rejects files over 25 MB', async () => {
    const big = new Uint8Array(25 * 1024 * 1024 + 10);
    big.set(new TextEncoder().encode('%PDF-1.4'));
    const r = await h.json('POST', '/client/documents', { token: c.token, form: form({ category: 'egyeb', dossierMonth: '2026-11' }, [{ field: 'file', name: 'nagy.pdf', type: 'application/pdf', bytes: big }]) });
    expect(r.status).toBe(413);
  });
  it('merges photos into one PDF, stores everything encrypted (AAD = file id)', async () => {
    const png = new Uint8Array(demoReceiptPng(200, 300, 3));
    const r = await h.json('POST', '/client/documents', {
      token: c.token,
      form: form({ category: 'nyugta', dossierMonth: '2026-11', title: 'Két oldal' }, [
        { field: 'pages', name: '1.png', type: 'image/png', bytes: png },
        { field: 'pages', name: '2.png', type: 'image/png', bytes: png },
      ]),
    });
    expect(r.status).toBe(201);
    expect(r.body.pageCount).toBe(2);
    expect(r.body.thumbFileId).toBeTruthy();
    const [f] = await h.deps.db.select().from(files).where(eq(files.id, r.body.versions[0].fileId));
    expect(f!.mime).toBe('application/pdf');
    const raw = readFileSync(h.deps.storage.rawPath(f!));
    expect(raw.subarray(0, 4).toString()).toBe('KJF1');
    expect(raw.includes(Buffer.from('%PDF'))).toBe(false);
    const plain = decryptFileBlob(() => h.deps.cfg.fileEncKey, raw, f!.id);
    expect(plain.subarray(0, 5).toString()).toBe('%PDF-');
    expect(() => decryptFileBlob(() => h.deps.cfg.fileEncKey, raw, r.body.id)).toThrow();
  });
});

describe('document status flow', () => {
  let id: string;
  it('client may delete only while "Feltöltve"', async () => {
    const up = await h.json('POST', '/client/documents', { token: c.token, form: form({ category: 'szerzodes', dossierMonth: '2026-10' }, [{ field: 'file', name: 'szerzodes.pdf', type: 'application/pdf', bytes: pdfBytes() }]) });
    id = up.body.id;
    const tmp = await h.json('POST', '/client/documents', { token: c.token, form: form({ category: 'egyeb', dossierMonth: '2026-10' }, [{ field: 'file', name: 'torles.pdf', type: 'application/pdf', bytes: pdfBytes() }]) });
    expect((await h.json('DELETE', `/client/documents/${tmp.body.id}`, { token: c.token })).status).toBe(204);
    h.clock.advance(1000);
    await h.json('GET', `/acc/documents/${id}`, { token: bence.token });
    expect((await h.json('DELETE', `/client/documents/${id}`, { token: c.token })).status).toBe(409);
  });
  it('accountant moves it forward; stepping back needs a note; history is kept', async () => {
    h.clock.advance(1000);
    expect((await h.json('PATCH', `/acc/documents/${id}`, { token: bence.token, body: { status: 'feldolgozva', accountantComment: 'Rendben.' } })).status).toBe(200);
    h.clock.advance(1000);
    expect((await h.json('PATCH', `/acc/documents/${id}`, { token: bence.token, body: { status: 'konyvelo_latta' } })).status).toBe(400);
    const back = await h.json('PATCH', `/acc/documents/${id}`, { token: bence.token, body: { status: 'konyvelo_latta', statusNote: 'Hiányzik a 2. oldal.' } });
    expect(back.status).toBe(200);
    const d = await h.json('GET', `/client/documents/${id}`, { token: c.token });
    expect(d.body.history.map((x: { status: string }) => x.status)).toEqual(['feltoltve', 'konyvelo_latta', 'feldolgozva', 'konyvelo_latta']);
    expect(d.body.accountantComment).toBe('Rendben.');
    const nv = await h.json('POST', `/client/documents/${id}/versions`, { token: c.token, form: form({}, [{ field: 'file', name: 'v2.pdf', type: 'application/pdf', bytes: pdfBytes() }]) });
    expect(nv.body.status).toBe('feltoltve');
    expect(nv.body.versions).toHaveLength(2);
  });
  it('accountant-only documents are invisible to the client', async () => {
    const up = await h.json('POST', `/acc/clients/${c.clientId}/documents`, { token: bence.token, form: form({ category: 'egyeb', dossierMonth: '2026-10', title: 'Belső jegyzet', visibility: 'csak_konyvelo' }, [{ field: 'file', name: 'belso.pdf', type: 'application/pdf', bytes: pdfBytes() }]) });
    expect(up.status).toBe(201);
    expect((await h.json('GET', `/client/documents/${up.body.id}`, { token: c.token })).status).toBe(404);
    expect((await h.json('GET', `/files/${up.body.versions[0].fileId}`, { token: c.token })).status).toBe(404);
    const dossier = await h.json('GET', '/client/dossiers/2026-10', { token: c.token });
    expect(JSON.stringify(dossier.body)).not.toContain('Belső jegyzet');
  });
});

describe('tax approve → client home → paid → verified → filed', () => {
  it('runs the whole quarter flow', async () => {
    await h.json('PUT', '/client/profile', {
      token: c.token,
      body: { firstName: 'Kata', lastName: 'Szabó', adoazonositoJel: fixtures.taxIds.kata.adoazonositoJel, adoszam: fixtures.taxIds.kata.adoszam, address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' }, hqMunicipality: 'Budapest', activityText: 'Grafika', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2019-04-01', hasSeparateBusinessAccount: true },
    });
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
    await h.json('PUT', `/acc/clients/${c.clientId}/nav-credentials`, { token: bence.token, body: { ...demoCredentialsFor('68801234'), environment: 'demo' } });
    await h.json('POST', `/acc/clients/${c.clientId}/nav-sync`, { token: bence.token });
    // finish onboarding so the client home shows money
    for (const s of ['szerzodes', 'elofizetes', 'meghatalmazas', 'azonositas', 'idopont'] as const)
      await h.deps.db.update(onboardingSteps).set({ status: 'kesz' }).where(eq(onboardingSteps.clientId, c.clientId)).execute();
    // before activation (SPEC §26.5.2, review k3c2): a draft is fine, an approval ("utald el …-ig") is refused, and no
    // tax_* message (in-app, push, e-mail) reaches the client while the tax data is locked for him
    await h.deps.db.update(clients).set({ lifecycle: 'bekotes_alatt' }).where(eq(clients.id, c.clientId));
    const draft = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-Q3/calculate`, { token: bence.token, body: { asOf: '2026-10-02' } });
    expect(draft.status).toBe(200);
    const early = await h.json('POST', `/acc/tax-calculations/${draft.body.id}/approve`, { token: bence.token, body: { letterText: 'Korai jóváhagyás.' } });
    expect(early.status).toBe(409);
    expect(early.body.error.message).toContain('bekötés alatt');
    const { notify } = await import('../src/notify/notify.js');
    expect(await notify(h.deps, h.deps.db, { userId: c.userId, kind: 'tax_approved', params: {}, link: '/' })).toBe('');
    expect((await h.deps.db.select().from(notifications).where(eq(notifications.userId, c.userId))).filter((n) => n.kind.startsWith('tax_')).length).toBe(0);
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));

    const calc = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-Q3/calculate`, { token: bence.token, body: { asOf: '2026-10-02' } });
    expect(calc.status).toBe(200);
    expect(calc.body.result.totalHuf).toBe(510_471);
    const noReason = await h.json('POST', `/acc/tax-calculations/${calc.body.id}/approve`, { token: bence.token, body: { letterText: 'x', overrides: { tbHuf: 1 } } });
    expect(noReason.status).toBe(400);
    const ap = await h.json('POST', `/acc/tax-calculations/${calc.body.id}/approve`, { token: bence.token, body: { letterText: 'Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg.' } });
    expect(ap.status).toBe(200);
    expect(ap.body.calcStatus).toBe('jovahagyva');
    expect(ap.body.totalHuf).toBe(510_471);

    h.clock.set('2026-10-05T09:00:00Z');
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.hero).toMatchObject({ state: 'jovahagyva', periodKey: '2026-Q3', amountHuf: 510_471, dueDate: '2026-10-12', daysLeft: 7 });
    expect(home.body.letter.greeting).toBe('Kedves Kata!');
    expect(home.body.paymentItems.map((p: { amountHuf: number }) => p.amountHuf)).toEqual([179_154, 125_892, 205_425]);
    expect(home.body.paymentItems[0].reference).toBe(fixtures.taxIds.kata.adoszam);
    expect(home.body.paymentItems[0].accountNumber).toBe('10032000-06055802');

    const pid = home.body.hero.periodId;
    const future = await h.json('POST', `/client/tax-periods/${pid}/mark-paid`, { token: c.token, body: { paidOn: '2026-10-30' } });
    expect(future.status).toBe(400);
    const paid = await h.json('POST', `/client/tax-periods/${pid}/mark-paid`, { token: c.token, body: { paidOn: '2026-10-05' } });
    expect(paid.body.paymentStatus).toBe('befizetve_jelezve');
    expect((await h.json('GET', '/client/home', { token: c.token })).body.hero.state).toBe('befizetve');
    const un = await h.json('POST', `/client/tax-periods/${pid}/unmark-paid`, { token: c.token, body: {} });
    expect(un.body.paymentStatus).toBe('fizetendo');
    await h.json('POST', `/client/tax-periods/${pid}/mark-paid`, { token: c.token, body: { paidOn: '2026-10-05' } });

    const v = await h.json('POST', `/acc/tax-periods/${pid}/verify-payment`, { token: bence.token, body: { items: ['tb_jarulek', 'szocho', 'szja_eloleg'].map((kind) => ({ kind, verification: 'rendben' })) } });
    expect(v.body.paymentStatus).toBe('ellenorizve');

    const ret = await h.json('POST', `/acc/clients/${c.clientId}/documents`, { token: bence.token, form: form({ category: 'bevallas', dossierMonth: '2026-10', title: 'Bevallás a III. negyedévről' }, [{ field: 'file', name: '2658.pdf', type: 'application/pdf', bytes: pdfBytes() }]) });
    const filed = await h.json('POST', `/acc/tax-periods/${pid}/filed`, { token: bence.token, body: { filedOn: '2026-10-02', form: '2658', returnDocumentId: ret.body.id, receiptFileId: ret.body.versions[0].fileId } });
    expect(filed.body.filingStatus).toBe('beadva');
    const detail = await h.json('GET', `/client/tax-periods/${pid}`, { token: c.token });
    expect(detail.body.filed.filedOn).toBe('2026-10-02');
    expect(detail.body.explanation.lines.length).toBeGreaterThan(3);
    expect(detail.body.disclaimer).toBeNull();
    const notes = await h.json('GET', '/me/notifications', { token: c.token });
    expect(notes.body.items.map((n: { kind: string }) => n.kind)).toEqual(expect.arrayContaining(['tax_approved', 'tax_payment_verified', 'tax_filed']));
  });
});
