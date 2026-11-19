// KYC (SPEC §10.3 + jogi note): the app's payload shape, the lakcímkártya back side is never
// stored, data is encrypted and never returned to the client, the accountant reviews.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, files, kycRecords } from '../src/db/schema.js';
import { demoReceiptPng } from '../src/lib/png.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z' });
});
afterAll(async () => h.close());

describe('KYC', () => {
  it('accepts the app payload, drops addressBack, accountant accepts', async () => {
    const bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test');
    const c = await newClient(h, 'kyc@demo.kezjegy.test', { first: 'Kata' });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    const png = new Uint8Array(demoReceiptPng(120, 80, 5));
    const fd = new FormData();
    for (const k of ['idFront', 'idBack', 'addressFront', 'addressBack']) fd.append(k, new Blob([png as BlobPart], { type: 'image/png' }), `${k}.png`);
    fd.append('data', JSON.stringify({ name: 'Szabó Kata', birthName: 'Szabó Kata', mothersBirthName: 'Minta Mária', birthPlace: 'Példafalva', birthDate: '1981-03-14', citizenship: 'magyar', address: '1136 Budapest, Példa utca 7.', documentType: 'szemelyi', documentNumber: '123456AB', documentExpiry: '2030-01-01' }));
    fd.append('declarations', JSON.stringify({ ownBehalf: true, pep: false, truthful: true, notifyChanges: true, signedAt: '2026-11-17T09:00:00Z' }));
    const r = await h.json('POST', '/client/kyc', { token: c.token, form: fd });
    expect(r.status).toBe(201);
    const [k] = await h.deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, c.clientId));
    expect(k!.files.addressBack).toBeUndefined();
    expect(k!.dataEnc).not.toContain('Minta');
    const kycFiles = await h.deps.db.select().from(files).where(eq(files.ownerClientId, c.clientId));
    expect(kycFiles.filter((f) => f.kind === 'kyc')).toHaveLength(3);
    const mine = await h.json('GET', '/client/kyc', { token: c.token });
    expect(mine.body).toEqual({ status: 'bekuldve' });
    expect((await h.json('GET', `/files/${k!.files.idFront}`, { token: c.token })).status).toBe(404);
    const view = await h.json('GET', `/acc/clients/${c.clientId}/kyc`, { token: bence.token });
    expect(view.body.data).toMatchObject({ familyName: 'Szabó', givenName: 'Kata', motherBirthName: 'Minta Mária', documentType: 'szemelyi_igazolvany' });
    expect(view.body.files.addressBack).toBeUndefined();
    expect((await h.req('GET', `/files/${k!.files.idFront}`, { token: bence.token })).status).toBe(200);
    const rev = await h.json('POST', `/acc/clients/${c.clientId}/kyc/review`, { token: bence.token, body: { status: 'elfogadva' } });
    expect(rev.status).toBe(200);
    const onb = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(onb.body.steps.find((s: { step: string }) => s.step === 'azonositas').status).toBe('kesz');
  });

  it('missing declarations are refused', async () => {
    const c = await newClient(h, 'kyc2@demo.kezjegy.test');
    const png = new Uint8Array(demoReceiptPng(60, 40, 2));
    const fd = new FormData();
    for (const k of ['idFront', 'idBack', 'addressFront']) fd.append(k, new Blob([png as BlobPart], { type: 'image/png' }), `${k}.png`);
    fd.append('data', JSON.stringify({ name: 'Teszt Elek', mothersBirthName: 'X Y', birthPlace: 'Z', birthDate: '1990-01-01', citizenship: 'magyar', address: 'cím', documentType: 'szemelyi', documentNumber: '123456AB', documentExpiry: '2030-01-01' }));
    fd.append('declarations', JSON.stringify({ ownBehalf: true, pep: false, truthful: false, notifyChanges: true }));
    const r = await h.json('POST', '/client/kyc', { token: c.token, form: fd });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.error.fields)).toContain('declarations.truthful');
  });
});
