// SPEC §26.14 O4.1 (owner order 4): restricted mode before activation, enforced by the API. Every 'zarva' route of the
// §26.5.2 matrix answers 403 locked_until_active + feature; every 'nyitva' route works; uploads only inside an open
// accountant request; after activation everything opens. Plus the explainers (O5.1, backend part).
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ONBOARDING_EXPLAINERS } from '../src/_shared/bekotes.js';
import { CLIENT_FEATURE_RULES, CLIENT_FEATURES } from '../src/_shared/enums.js';
import { clients } from '../src/db/schema.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
let c: Awaited<ReturnType<typeof newClient>>;
let accDocId: string;
let accDocFileId: string;

function upload(token: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'irat.pdf');
  return h.json('POST', '/client/documents', { token, form: fd });
}

beforeAll(async () => {
  h = await setup({ now: '2026-11-18T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
  c = await newClient(h, 'korlat@demo.kezjegy.test', { first: 'Kata' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  const fd = new FormData();
  fd.append('category', 'nav_level');
  fd.append('dossierMonth', '2026-11');
  fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'level.pdf');
  const d = await h.json('POST', `/acc/clients/${c.clientId}/documents`, { token: bence.token, form: fd });
  expect(d.status).toBe(201);
  accDocId = d.body.id;
  accDocFileId = d.body.versions?.[0]?.fileId ?? d.body.fileId;
});
afterAll(async () => h.close());

const LOCKED: [string, string, string, unknown?][] = [
  ['GET', '/client/tax-periods', 'fooldal_ado'],
  ['GET', '/client/tax-periods/00000000-0000-4000-8000-000000000000', 'fooldal_ado'],
  ['POST', '/client/tax-periods/00000000-0000-4000-8000-000000000000/mark-paid', 'fooldal_ado', { paidOn: '2026-11-17' }],
  ['GET', '/client/dossiers', 'dosszie'],
  ['GET', '/client/dossiers/2026-11', 'dosszie'],
  ['GET', '/client/nav-invoices', 'nav_szamlak'],
  ['GET', '/client/revenue', 'bevetel'],
  ['GET', '/client/deadlines', 'hataridok'],
  ['POST', '/client/requests', 'igazolas_keres', { type: 'jovedelemigazolas', certificate: { certificateType: 'jovedelemigazolas', purpose: 'bank' } }],
  ['POST', '/client/requests', 'igazolas_keres', { type: 'adatvaltozas', body: 'Új lakcím' }],
];

describe('O4.1 – before activation', () => {
  it('every locked route answers 403 locked_until_active with the feature and the filled reason', async () => {
    for (const [m, path, feature, body] of LOCKED) {
      const r = await h.json(m, path, { token: c.token, ...(body ? { body } : {}) });
      expect(r.status, `${m} ${path}`).toBe(403);
      expect(r.body.error.code).toBe('locked_until_active');
      expect(r.body.error.feature).toBe(feature);
      expect(r.body.error.message).toContain('A bekötés után nyílik meg.');
      expect(r.body.error.message).not.toContain('{firstName}');
    }
    const tax = await h.json('GET', '/client/tax-periods', { token: c.token });
    expect(tax.body.error.message).toContain('Bence');
  });

  it('open routes work: onboarding, messages, callbacks, subscription, fees, home, me, explainers, FAQ, question', async () => {
    for (const path of ['/client/onboarding', '/client/messages', '/client/callbacks', '/client/subscription', '/client/fee-invoices', '/client/requests', '/client/access', '/client/explainers', '/client/profile', '/me', '/me/notifications', '/content/faq']) {
      const r = await h.json('GET', path, { token: c.token });
      expect(r.status, path).toBe(200);
    }
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.hero.state).toBe('bekotes_alatt');
    expect(home.body.revenueByMonth).toEqual([]);
    expect(home.body.nextDeadline).toBeNull();
    expect(home.body.limits.afa.usedHuf).toBe(0);
    expect((await h.json('POST', '/client/messages', { token: c.token, body: { body: 'Kérdésem van.' } })).status).toBe(201);
    expect((await h.json('POST', '/client/requests', { token: c.token, body: { type: 'kerdes', body: 'Mikor indul?' } })).status).toBe(201);
  });

  it('uploads only inside an open accountant request; own uploads and contract papers open, the rest is the Dosszié', async () => {
    const free = await upload(c.token, { category: 'nyugta', dossierMonth: '2026-11' });
    expect(free.status).toBe(403);
    expect(free.body.error.feature).toBe('feltoltes');
    expect(free.body.error.message).toContain('Ha Bence kér tőled valamit');
    const rq = await h.json('POST', `/acc/clients/${c.clientId}/requests`, { token: bence.token, body: { type: 'dokumentum', title: 'Szerződés kell', dossierMonth: '2026-11' } });
    expect(rq.status).toBe(201);
    const ok = await upload(c.token, { category: 'szerzodes', dossierMonth: '2026-11', requestId: rq.body.id });
    expect(ok.status).toBe(201);
    expect((await h.json('GET', `/client/documents/${ok.body.id}`, { token: c.token })).status).toBe(200);
    const accDoc = await h.json('GET', `/client/documents/${accDocId}`, { token: c.token });
    expect(accDoc.status).toBe(403);
    expect(accDoc.body.error.feature).toBe('dosszie');
    if (accDocFileId) {
      const link = await h.json('POST', `/files/${accDocFileId}/link`, { token: c.token });
      expect(link.status).toBe(403);
      expect(link.body.error.code).toBe('locked_until_active');
    }
    // a new version only for a request document
    const fd = new FormData();
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'v2.pdf');
    expect((await h.json('POST', `/client/documents/${ok.body.id}/versions`, { token: c.token, form: fd })).status).toBe(200);
  });

  it('GET /client/access and Me.access carry the same matrix with filled reasons and the hint', async () => {
    const a = await h.json('GET', '/client/access', { token: c.token });
    expect(a.body.mode).toBe('korlatozott');
    expect(a.body.features.map((f: { feature: string }) => f.feature)).toEqual([...CLIENT_FEATURES]);
    for (const f of a.body.features) {
      expect(f.state).toBe(CLIENT_FEATURE_RULES[f.feature as keyof typeof CLIENT_FEATURE_RULES].beforeActivation);
      if (f.state === 'nyitva') expect(f.reason).toBeNull();
      else expect(f.reason).toMatch(/^A bekötés után [^{}]+$/); // §28.K: 'tovabbito_email' has its own wording
    }
    // the total counts our steps too, so the client's own share is named (matches the band's "Még N dolog kell tőled")
    expect(a.body.activationHint).toMatch(/^Még \d+ lépés, és minden megnyílik\.( Ebből \d+ a tiéd, a többi a mi dolgunk\.| Ebből \d+ a tiéd\.| Ezek már a mi dolgunk: szólunk, ha kész\.)?$/);
    const me = await h.json('GET', '/me', { token: c.token });
    expect(me.body.access).toEqual(a.body);
  });
});

describe('O4.1 – after activation', () => {
  it('every route opens and the access mode is "teljes"', async () => {
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    for (const [m, path, , body] of LOCKED) {
      const r = await h.json(m, path, { token: c.token, ...(body ? { body } : {}) });
      expect(r.status, `${m} ${path}`).not.toBe(403);
    }
    expect((await upload(c.token, { category: 'nyugta', dossierMonth: '2026-11' })).status).toBe(201);
    expect((await h.json('GET', `/client/documents/${accDocId}`, { token: c.token })).status).toBe(200);
    const a = await h.json('GET', '/client/access', { token: c.token });
    expect(a.body.mode).toBe('teljes');
    expect(a.body.activationHint).toBeNull();
    expect(a.body.features.every((f: { state: string }) => f.state === 'nyitva')).toBe(true);
  });
});

describe('O5.1 – explainers (backend)', () => {
  it('every explainer has three non-empty blocks with {firstName}/{havidij} filled; an admin edit is visible at once', async () => {
    const r = await h.json('GET', '/client/explainers', { token: c.token });
    expect(r.body.items.map((x: { key: string }) => x.key)).toEqual(ONBOARDING_EXPLAINERS.map((e) => e.key));
    for (const x of r.body.items) {
      expect(x.title && x.what && x.why && x.where, x.key).toBeTruthy();
      expect(JSON.stringify(x)).not.toMatch(/\{(firstName|havidij)\}/);
      expect(x.icon).toBeTruthy();
    }
    const edit = await h.json('PUT', '/admin/content-texts/bekotes.magyarazat.adoazonosito_jel.mi', { token: admin.token, body: { body: 'Tízjegyű szám az adóigazolványodon. {firstName} ezzel intézi az ügyeidet.' } });
    expect(edit.status).toBe(200);
    const bad = await h.json('PUT', '/admin/content-texts/bekotes.magyarazat.adoazonosito_jel.mi', { token: admin.token, body: { body: 'Hibás {ismeretlen}' } });
    expect(bad.status).toBe(400);
    const after = await h.json('GET', '/client/explainers', { token: c.token });
    expect(after.body.items.find((x: { key: string }) => x.key === 'adoazonosito_jel').what).toBe('Tízjegyű szám az adóigazolványodon. Bence ezzel intézi az ügyeidet.');
    const groups = await h.json('GET', '/admin/content-texts', { token: admin.token });
    const g = groups.body.items.find((x: { key: string }) => x.key === 'korlatozott.dosszie');
    expect(g.group).toBe('Korlátozott mód a bekötés alatt');
  });

  it('/config exposes the media base and the charge policy', async () => {
    const cfg = await h.json('GET', '/config');
    expect(cfg.body.mediaBaseUrl).toMatch(/\/media\/$/);
    expect(cfg.body.newBusinessChargePolicy).toBe('adoszam_utan');
  });
});
