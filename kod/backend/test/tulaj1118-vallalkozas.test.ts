// SPEC §26.14 O1 / O7 / O8 (owner orders 11-18): new business, SELF-SERVICE. The client answers "Még nincs",
// fills the data form, gets the personalised guide, files the EV bejelentés himself, uploads the NAV PDF; the team
// checks it and records the adószám. Plus the KYC fix (no lakcímkártya back side) and "we never store TAJ".
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUIDE_STEP_KEYS, REGISTRATION_CHECK_ITEMS } from '../src/_shared/enums.js';
import { accountants, businessRegistrations, clients, clientTaxProfiles, documents, documentVersions, kycRecords, notifications } from '../src/db/schema.js';
import { jpegBytes, newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

const rolad = { firstName: 'Levente', lastName: 'Tóth', phone: '+36 30 555 0142', adoazonositoJel: '8123456786', address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' } };
const page1 = { declarations: { noExclusion: true, singleBusiness: true }, revenueBand: 'max_12m' };
// SPEC §27.0.4: 'foto' became lista80 (round-2 tax finding 2) – the general-class path uses 'grafika' here.
const page2 = { activities: [{ key: 'grafika', main: true }, { key: 'video', main: false }] };
const page3 = { seat: { kind: 'lakcim' } };
const page4 = { workKind: 'fofoglalkozas', euPartner: 'nem', hasSeparateBusinessAccount: true };
const page5 = { startPlan: 'mielobb' };

beforeAll(async () => {
  h = await setup({ now: '2026-11-18T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  await h.deps.db.update(accountants).set({ adoazonositoJelEnc: h.deps.data.enc('8234567891', 'accountants.adoazonosito_jel') }).where(eq(accountants.id, bence.accountantId!));
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
});
afterAll(async () => h.close());

async function starter(email: string) {
  const c = await newClient(h, email, { first: 'Levente', last: 'Tóth' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  const bs = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas' } });
  expect(bs.status).toBe(200);
  const p = await h.json('PUT', '/client/profile', { token: c.token, body: rolad });
  expect(p.status).toBe(200);
  return c;
}

async function fillAll(token: string, extra: Record<string, unknown> = {}) {
  for (const b of [page1, page2, page3, { ...page4, ...extra }, page5]) {
    const r = await h.json('PUT', '/client/business-registration', { token, body: b });
    expect(r.status).toBe(200);
  }
}

function filedForm(o: { filedOn?: string; channel?: string; adoszam?: string } = {}) {
  const fd = new FormData();
  fd.append('filedOn', o.filedOn ?? '2026-11-17');
  fd.append('channel', o.channel ?? 'ugyfelkapu_plus');
  if (o.adoszam) fd.append('adoszam', o.adoszam);
  fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'ertesites.pdf');
  return fd;
}

describe('O1.1 – branch question, step order, locks', () => {
  it('a new client on the "inditas" path sees vallalkozas_inditas 3rd and the later steps locked with reasons', async () => {
    const c = await starter('lev1@demo.kezjegy.test');
    const onb = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(onb.body.path).toBe('inditas');
    expect(onb.body.steps.map((s: { step: string }) => s.step)).toEqual(['fiok', 'adatok', 'vallalkozas_inditas', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes']);
    const by = Object.fromEntries(onb.body.steps.map((s: { step: string }) => [s.step, s]));
    for (const k of ['meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes']) {
      expect(by[k].locked).toBe(true);
      expect(by[k].lockedReason).toBeTruthy();
    }
    expect(by.szerzodes.locked).toBeUndefined();
    expect(by.adatok.status).toBe('kesz');
    expect(onb.body.milestones[0].key).toBe('vallalkozas_elinditva');
    expect(onb.body.registration.status).toBe('kitoltes');
    expect(onb.body.appointmentsEnabled).toBe(false);
    const sub = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    expect(sub.status).toBe(409);
    expect(sub.body.error.code).toBe('step_locked');
    const megh = await h.json('POST', '/client/onboarding/meghatalmazas', { token: c.token, body: { method: 'onya_ugyfel' } });
    expect(megh.body.error.code).toBe('step_locked');
    const guide = await h.json('GET', '/client/guides/meghatalmazas', { token: c.token });
    expect(guide.status).toBe(409);
  });

  it('a "van" client sees the old order without the new step; a missing vallalkozas_inditas row never blocks', async () => {
    const c = await newClient(h, 'van1@demo.kezjegy.test');
    const bs = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    expect(bs.body.steps.map((s: { step: string }) => s.step)).toEqual(['fiok', 'adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes']); // SPEC §27.0.4 order
    // round 1 (2026-11-19): the meghatalmazás waits for the megbízási szerződés; §27.4.2: so does the Előfizetés
    expect(bs.body.steps.filter((s: { locked?: boolean }) => s.locked).map((s: { step: string }) => s.step)).toEqual(['meghatalmazas', 'elofizetes']);
    expect(bs.body.steps.find((s: { step: string }) => s.step === 'meghatalmazas').lockedReason).toContain('megbízási szerződést');
    const reg = await h.json('PUT', '/client/business-registration', { token: c.token, body: page1 });
    expect(reg.body.error.code).toBe('step_locked');
  });
});

describe('O1.2 – data form drafts, validation, stop card, submit', () => {
  it('drafts save per page; submit with a missing field → 400 with fields; unknown fields (TAJ) are refused', async () => {
    const c = await starter('lev2@demo.kezjegy.test');
    const d1 = await h.json('PUT', '/client/business-registration', { token: c.token, body: page1 });
    expect(d1.body.missing).toContain('activities');
    const sub = await h.json('POST', '/client/business-registration/submit', { token: c.token });
    expect(sub.status).toBe(400);
    expect(Object.keys(sub.body.error.fields)).toEqual(expect.arrayContaining(['activities', 'seat', 'workKind', 'euPartner', 'startPlan']));
    const taj = await h.json('PUT', '/client/business-registration', { token: c.token, body: { tajSzam: '123456789' } });
    expect(taj.status).toBe(400);
    const anyja = await h.json('PUT', '/client/business-registration', { token: c.token, body: { seat: { kind: 'lakcim', anyjaNeve: 'X' } } });
    expect(anyja.status).toBe(400);
    const badZip = await h.json('PUT', '/client/business-registration', { token: c.token, body: { seat: { kind: 'mas_cim', address: { zip: '123', city: 'Szeged', line: 'Fő tér 1.' }, right: 'berlet' } } });
    expect(badZip.status).toBe(400);
    const badProvider = await h.json('PUT', '/client/business-registration', { token: c.token, body: { seat: { kind: 'szekhelyszolgaltato', address: { zip: '1052', city: 'Budapest', line: 'Váci utca 1.' }, provider: { name: 'Minta Székhely Kft.', adoszam: '12345678-2-41' } } } });
    expect(badProvider.status).toBe(400);
  });

  it('cost-ratio and contribution hints come from ado-motor; 20 M+ revenue stops with 409', async () => {
    const c = await starter('lev3@demo.kezjegy.test');
    await fillAll(c.token);
    const g = await h.json('GET', '/client/business-registration', { token: c.token });
    expect(g.body.registration.hints.costRatio).toBe(45);
    expect(g.body.registration.hints.costRatioText).toContain('45%');
    expect(g.body.registration.hints.costRatioText).toContain('Bence');
    expect(g.body.registration.hints.minimumMonthlyContributionHuf).toBe(101_682);
    expect(g.body.registration.hints.contributionText).toContain('101 682 Ft');
    // round 1 (2026-11-19): in the starting year the ÁFA limit is time-proportional (Áfa tv. 189. §), like the átalány cap:
    // 2026-11-17 … 12-31 = 45 days → 20 000 000 × 45 / 365 = 2 465 753
    expect(g.body.registration.hints.afaLimitHuf).toBeLessThan(20_000_000);
    expect(g.body.registration.hints.afaLimitHuf / g.body.registration.hints.atalanyCapHuf).toBeCloseTo(20_000_000 / 38_736_000, 4);
    expect(g.body.registration.hints.atalanyCapHuf).toBeLessThan(38_736_000);
    expect(g.body.registration.missing).toEqual([]);
    await h.json('PUT', '/client/business-registration', { token: c.token, body: { revenueBand: 'tobb_20m' } });
    const stop = await h.json('POST', '/client/business-registration/submit', { token: c.token });
    expect(stop.status).toBe(409);
    expect(stop.body.error.message).toContain('nem lehetsz alanyi ÁFA-mentes');
    await h.json('PUT', '/client/business-registration', { token: c.token, body: { revenueBand: '12_20m' } });
    const ok = await h.json('POST', '/client/business-registration/submit', { token: c.token });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('utmutato');
    // 11-19 javító kör 2: while the ÖVTJ line is pending the hub says "Már átnézheted az útmutatót" (not "Kész").
    expect(ok.body.statusText).toMatch(ok.body.activityPending ? /Már átnézheted az útmutatót/ : /útmutatód/);
  });

  it('a free-text activity gives no cost ratio ("Bence mondja meg") and a qualification note where needed', async () => {
    const c = await starter('lev4@demo.kezjegy.test');
    const r = await h.json('PUT', '/client/business-registration', { token: c.token, body: { activities: [{ key: null, label: 'Lufihajtogatás gyerekzsúrokon', main: true }] } });
    expect(r.body.hints.costRatio).toBeNull();
    expect(r.body.hints.costRatioText).toContain('Bence mondja meg');
    const k = await h.json('PUT', '/client/business-registration', { token: c.token, body: { activities: [{ key: 'fodraszat', main: true }] } });
    expect(k.body.hints.costRatio).toBe(80);
    expect(k.body.hints.qualificationNote).toContain('KAVIR');
    const two = await h.json('PUT', '/client/business-registration', { token: c.token, body: { activities: [{ key: 'foto', main: true }, { key: 'web', main: true }] } });
    expect(two.status).toBe(400);
  });
});

describe('O1.3 – personalised guide', () => {
  it('409 before submit; after it 14 steps, EU answer and work kind filled, no placeholder left', async () => {
    const c = await starter('lev5@demo.kezjegy.test');
    await fillAll(c.token);
    expect((await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c.token })).status).toBe(409);
    await h.json('POST', '/client/business-registration/submit', { token: c.token });
    const g = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c.token });
    expect(g.status).toBe(200);
    expect(g.body.steps.map((s: { key: string }) => s.key)).toEqual([...GUIDE_STEP_KEYS.vallalkozas_bejelentes]);
    expect(g.body.video).toMatchObject({ name: 'vallalkozas_bejelentes', mp4: 'vallalkozas_bejelentes.mp4', vtt: 'vallalkozas_bejelentes.vtt' });
    expect(g.body.prepare.length).toBe(8);
    expect(g.body.prepare.find((p: { key: string }) => p.key === 'taj').storedByUs).toBe(false);
    expect(g.body.imagesManifest).toBe('utmutato/vallalkozas_bejelentes/kepek.json');
    expect(JSON.stringify(g.body)).not.toMatch(/\{[A-Za-z0-9_]+\}/);
    const afa = g.body.steps.find((s: { key: string }) => s.key === 'adozas_afa');
    const eu = afa.fields.find((f: { label: string }) => f.label === 'Közösségi adószám igénylése');
    expect(eu.actionLabel).toBe('Ne jelöld be');
    const alanyi = afa.fields.find((f: { label: string }) => f.label.includes('alanyi adómentesség'));
    expect(alanyi.actionLabel).toBe('Jelöld be');
    const kata = g.body.steps.find((s: { key: string }) => s.key === 'adozas_kata_atalany');
    expect(kata.fields.map((f: { action: string }) => f.action)).toEqual(['jelold', 'ne_jelold']); // §28.K.13: the átalány line first
    const mv = g.body.steps.find((s: { key: string }) => s.key === 'adozas_munkavegzes');
    expect(mv.fields[0].value).toBe('[1] Főfoglalkozásként'); // §28.K.13: the real NAV row
    const tev = g.body.steps.find((s: { key: string }) => s.key === 'tevekenysegek');
    expect(tev.fields[0].value).toContain('„grafikai”');
    // the copy button copies only the search word, never the whole sentence
    expect(tev.fields[0].copyValue).toBe('grafikai');
    expect(tev.fields[1].value).toContain('„film”');
    // no ÖVTJ line known yet → the filing steps wait for the team ("várd meg, amíg megírjuk")
    expect(g.body.activityPending).toBe(true);
    expect(tev.hold).toContain('Várd meg');
    expect(g.body.steps.find((s: { key: string }) => s.key === 'bekuldes').hold).toContain('Még ne küldd be');
    expect(g.body.steps.find((s: { key: string }) => s.key === 'belepes').hold).toBeUndefined();
    const ell = g.body.steps.find((s: { key: string }) => s.key === 'ellenorzes');
    expect(ell.fields.map((f: { label: string }) => f.label)).toEqual(expect.arrayContaining(['Közösségi adószám', 'Telephely, fióktelep']));
    expect(g.body.steps.find((s: { key: string }) => s.key === 'kamarai_regisztracio')).toMatchObject({ screenKind: 'kamara' });
    expect(g.body.steps.find((s: { key: string }) => s.key === 'kamarai_regisztracio').text).toContain('5 000 Ft');
    expect(g.body.prepare.find((p: { key: string }) => p.key === 'anyja_neve').privacyNote).toContain('azonosításnál');
    const cim = g.body.steps.find((s: { key: string }) => s.key === 'cimadatok');
    expect(cim.fields[0].value).toContain('6720 Szeged, Minta utca 3.');
    // the EU answer switches the row
    const c2 = await starter('lev5b@demo.kezjegy.test');
    await fillAll(c2.token, { euPartner: 'igen', workKind: 'nyugdij_mellett' });
    await h.json('POST', '/client/business-registration/submit', { token: c2.token });
    const g2 = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c2.token });
    const eu2 = g2.body.steps.find((s: { key: string }) => s.key === 'adozas_afa').fields.find((f: { label: string }) => f.label === 'Közösségi adószám igénylése');
    expect(eu2.actionLabel).toBe('Jelöld be');
    expect(g2.body.steps.find((s: { key: string }) => s.key === 'adozas_munkavegzes').fields[0].value).toContain('Nyugdíj'); // §28.K.13: '[4] Nyugdíj mellett'
    // progress persists, unknown keys ignored
    const pr = await h.json('PUT', '/client/guides/vallalkozas_bejelentes/progress', { token: c2.token, body: { doneStepKeys: ['belepes', 'ugyseged_inditas', 'nincs_ilyen'] } });
    expect(pr.body.doneStepKeys).toEqual(['belepes', 'ugyseged_inditas']);
    const again = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c2.token });
    expect(again.body.steps.filter((s: { done: boolean }) => s.done).length).toBe(2);
  });
});

describe('O1.4/O1.5 – filed, team check, fix, adószám, kesz', () => {
  it('the whole self-service path end to end', async () => {
    const c = await starter('lev6@demo.kezjegy.test');
    await fillAll(c.token);
    await h.json('POST', '/client/business-registration/submit', { token: c.token });
    // filed with the NAV PDF
    const filed = await h.json('POST', '/client/business-registration/filed', { token: c.token, form: filedForm() });
    expect(filed.status).toBe(200);
    expect(filed.body.status).toBe('beadva');
    expect(filed.body.filed).toMatchObject({ filedOn: '2026-11-17', channel: 'ugyfelkapu_plus' });
    const [doc] = await h.deps.db.select().from(documents).where(eq(documents.id, filed.body.filed.documentId));
    expect(doc!.category).toBe('ev_bejelentes');
    // the client can always open it (also before activation)
    expect((await h.json('GET', `/client/documents/${doc!.id}`, { token: c.token })).status).toBe(200);
    // team notified
    const n = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'registration_submitted')));
    const forThis = n.filter((x) => (x.data as { registrationId?: string } | null)?.registrationId === filed.body.id);
    const pending = forThis.filter((x) => (x.data as { activityPending?: boolean } | null)?.activityPending);
    expect(forThis.length - pending.length).toBe(1);
    // at submit the team already got the "write the ÖVTJ line" task (no code in our list yet)
    expect(pending.length).toBe(1);
    expect(pending[0]!.title).toContain('tevékenység');
    // locks: meghatalmazás and azonosítás open now; előfizetés still waits for the adószám
    const onb = await h.json('GET', '/client/onboarding', { token: c.token });
    const by = Object.fromEntries(onb.body.steps.map((s: { step: string }) => [s.step, s]));
    // the bejelentés lock is gone; the meghatalmazás now only waits for the megbízási szerződés (round 1)
    expect(by.meghatalmazas.lockedReason).toContain('megbízási szerződést');
    expect(by.azonositas.locked).toBeUndefined();
    expect(by.elofizetes.locked).toBe(true);
    expect(by.vallalkozas_inditas.status).toBe('konyvelore_var');
    // the team (csapat) opens the uploaded file
    const link = await h.json('POST', `/files/${filed.body.filed.fileId}/link`, { token: anna.token });
    expect(link.status).toBe(200);
    // switching the path is no longer possible
    const sw = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    expect(sw.status).toBe(409);
    // fix requested → javitas, client sees the note, re-upload → beadva with a new version
    const regId = filed.body.id as string;
    const fix = await h.json('POST', `/team/registrations/${regId}/request-fix`, { token: anna.token, body: { note: 'A munkavégzés jellegét változásbejelentéssel javítsd főfoglalkozásra.' } });
    expect(fix.body.status).toBe('javitas');
    const mine = await h.json('GET', '/client/business-registration', { token: c.token });
    expect(mine.body.registration.fixNote).toContain('változásbejelentéssel');
    const onbFix = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(onbFix.body.steps.find((s: { step: string }) => s.step === 'vallalkozas_inditas').status).toBe('hianyos');
    const re = await h.json('POST', '/client/business-registration/filed', { token: c.token, form: filedForm() });
    expect(re.body.status).toBe('beadva');
    const vers = await h.deps.db.select().from(documentVersions).where(eq(documentVersions.documentId, doc!.id));
    expect(vers.length).toBe(2);
    // check: 8/9 items → 400; while an activity has no ÖVTJ line → 409 (review k3c2); all + codes → ellenorizve
    const partial = await h.json('POST', `/team/registrations/${regId}/check`, { token: anna.token, body: { items: REGISTRATION_CHECK_ITEMS.slice(0, 8) } });
    expect(partial.status).toBe(400);
    const noCode = await h.json('POST', `/team/registrations/${regId}/check`, { token: anna.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(noCode.status).toBe(409);
    expect(noCode.body.error.message).toContain('ÖVTJ');
    const codes = await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { ovtjKodok: [{ index: 0, ovtjKod: '742001' }, { index: 1, ovtjKod: '591101' }] } });
    expect(codes.body.activityPending).toBe(false);
    const checked = await h.json('POST', `/team/registrations/${regId}/check`, { token: anna.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(checked.status).toBe(200);
    expect(checked.body.status).toBe('ellenorizve');
    expect(checked.body.checkedBy.firstName).toBe('Anna');
    // adószám: bad check digit → 400; not ÁFA-mentes (middle digit 2) → 400 for the client
    expect((await h.json('POST', '/client/business-registration/adoszam', { token: c.token, body: { adoszam: '12345678-1-41' } })).status).toBe(400);
    const notFree = await h.json('POST', '/client/business-registration/adoszam', { token: c.token, body: { adoszam: '12345676-2-41' } });
    expect(notFree.status).toBe(400);
    expect(notFree.body.error.fields.adoszam).toContain('nem ÁFA-mentes');
    // the EV nyilvántartási szám is exactly 8 digits in the API too (review k3c2)
    const badEv = await h.json('POST', '/client/business-registration/adoszam', { token: c.token, body: { adoszam: '12345676-1-41', evNyilvantartasiSzam: 'abc<b>x' } });
    expect(badEv.status).toBe(400);
    expect(badEv.body.error.fields.evNyilvantartasiSzam).toContain('8 számjegy');
    const done = await h.json('POST', '/client/business-registration/adoszam', { token: c.token, body: { adoszam: '12345676-1-41', evNyilvantartasiSzam: '61234567', registeredOn: '2026-11-17' } });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('kesz');
    // §26.1.8: profile and tax profile filled
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl).toMatchObject({ adoszam: '12345676-1-41', evNyilvantartasiSzam: '61234567', evSince: '2026-11-17', hqMunicipality: 'Szeged', activityAnswer: 'egyeb', hasSeparateBusinessAccount: true });
    expect(cl!.activityText).toContain('Grafikai tervezés, illusztráció');
    const [tp] = await h.deps.db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.clientId, c.clientId));
    expect(tp).toMatchObject({ status: 'fofoglalkozasu', costRatio: 45, costRatioSource: 'ugyfel_javaslat', atalanyFrom: '2026-11-17', guaranteedMinimum: false });
    const after = await h.json('GET', '/client/onboarding', { token: c.token });
    // every path lock is gone; the meghatalmazás and (§27.4.2) the Előfizetés still wait for the megbízási szerződés
    expect(after.body.steps.filter((s: { locked?: boolean }) => s.locked).map((s: { step: string }) => s.step)).toEqual(['meghatalmazas', 'elofizetes']);
    expect(after.body.milestones[0]).toMatchObject({ key: 'vallalkozas_elinditva', done: true });
    const notifs = await h.deps.db.select().from(notifications).where(eq(notifications.userId, c.userId));
    expect(notifs.map((x) => x.kind)).toEqual(expect.arrayContaining(['registration_needs_fix', 'registration_checked', 'registration_done']));
    const accN = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, bence.userId), eq(notifications.kind, 'onboarding_needs_review')));
    expect(accN.some((x) => x.title.includes('vállalkozása elindult'))).toBe(true);
    // accountant reads it (read-only)
    const accView = await h.json('GET', `/acc/clients/${c.clientId}/business-registration`, { token: bence.token });
    expect(accView.body.registration.status).toBe('kesz');
    expect(accView.body.registration.history.length).toBeGreaterThan(4);
  });

  it('staff may record the adószám first (amber warning only); the check then goes straight to kesz', async () => {
    const c = await starter('lev7@demo.kezjegy.test');
    await fillAll(c.token);
    await h.json('POST', '/client/business-registration/submit', { token: c.token });
    const filed = await h.json('POST', '/client/business-registration/filed', { token: c.token, form: filedForm() });
    const regId = filed.body.id as string;
    const bad = await h.json('POST', `/team/registrations/${regId}/adoszam`, { token: anna.token, body: { adoszam: '12345678-1-41', registeredOn: '2026-11-17' } });
    expect(bad.status).toBe(400);
    const badEv = await h.json('POST', `/team/registrations/${regId}/adoszam`, { token: anna.token, body: { adoszam: '12345676-2-41', evNyilvantartasiSzam: '1234-567', registeredOn: '2026-11-17' } });
    expect(badEv.status).toBe(400);
    const st = await h.json('POST', `/team/registrations/${regId}/adoszam`, { token: anna.token, body: { adoszam: '12345676-2-41', registeredOn: '2026-11-17' } });
    expect(st.status).toBe(200);
    expect(st.body.status).toBe('beadva');
    const edit = await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { ovtjKodok: [{ index: 0, ovtjKod: '742001', ovtjNev: 'Fotózás (teszt sor)' }, { index: 1, ovtjKod: '591101' }], staffNote: 'Kód egyeztetve.' } });
    expect(edit.body.answers.activities[0].ovtjKod).toBe('742001');
    expect(edit.body.activityPending).toBe(false);
    // the profile is shown read-only next to the checklist ("Név, lakcím rendben")
    expect(edit.body.clientProfile).toMatchObject({ name: 'Tóth Levente', address: { zip: '6720', city: 'Szeged' } });
    expect((await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { ovtjKodok: [{ index: 0, ovtjKod: '12' }] } })).status).toBe(400);
    const ck = await h.json('POST', `/team/registrations/${regId}/check`, { token: admin.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(ck.body.status).toBe('kesz');
    const g = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c.token });
    const tev = g.body.steps.find((s: { key: string }) => s.key === 'tevekenysegek');
    expect(tev.fields[0].value).toBe('742001 – Fotózás (teszt sor)');
    expect(tev.fields[0].copyValue).toBe('742001');
    expect(tev.fields[1].value).toBe('591101 (Videókészítés, vágás)');
    expect(tev.hold).toBeUndefined();
    expect(g.body.activityPending).toBe(false);
  });

  it('free text only: the team is told at submit, the guide waits, and the client is told when the line is written', async () => {
    const c = await starter('lev20@demo.kezjegy.test');
    for (const b of [page1, { activities: [], activityFreeText: 'Lovas túrákat vezetek a Bakonyban' }, page3, page4, page5]) {
      expect((await h.json('PUT', '/client/business-registration', { token: c.token, body: b })).status).toBe(200);
    }
    const sub = await h.json('POST', '/client/business-registration/submit', { token: c.token });
    expect(sub.body.activityPending).toBe(true);
    const regId = sub.body.id as string;
    const task = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'registration_submitted')));
    expect(task.some((x) => (x.data as { registrationId?: string } | null)?.registrationId === regId && x.title.includes('tevékenység'))).toBe(true);
    const g = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c.token });
    const tev = g.body.steps.find((s: { key: string }) => s.key === 'tevekenysegek');
    expect(tev.fields[0].value).toBe('a válaszod alapján megírjuk, melyik sort válaszd');
    expect(tev.fields[0].copyValue).toBeUndefined();
    expect(tev.hold).toBeTruthy();
    // the team writes the line (adds the activity row with its code); while the free text is still there it waits
    const half = await h.json('PATCH', `/team/registrations/${regId}`, {
      token: anna.token,
      body: { answers: { activities: [{ key: null, label: 'Lovas túravezetés', main: true }] }, ovtjKodok: [{ index: 0, ovtjKod: '932901', ovtjNev: 'Teszt sor' }] },
    });
    expect(half.status).toBe(200);
    expect(half.body.activityPending).toBe(true);
    // … and clearing the free text resolves it → the client gets "Megírtuk, melyik sort válaszd"
    const edit = await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { answers: { activityFreeText: null } } });
    expect(edit.status).toBe(200);
    expect(edit.body.activityPending).toBe(false);
    const told = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'registration_reminder')));
    expect(told.map((x) => x.title)).toContain('Megírtuk, melyik sort válaszd');
    const g2 = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c.token });
    const tev2 = g2.body.steps.find((s: { key: string }) => s.key === 'tevekenysegek');
    expect(tev2.fields[0]).toMatchObject({ value: '932901 – Teszt sor', copyValue: '932901' });
    expect(tev2.hold).toBeUndefined();
    // a second save with the same codes does not notify again
    await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { staffNote: 'ok' } });
    expect((await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'registration_reminder')))).length).toBe(told.length);
  });

  it('free text NEXT TO a list activity is not dropped: guide rows, team check, kesz activity_text (review k3c2)', async () => {
    const c = await starter('lev40@demo.kezjegy.test');
    for (const b of [page1, { activities: [{ key: 'masszazs', main: true }], activityFreeText: 'Babaúszás-oktatás uszodában' }, page3, page4, page5]) {
      expect((await h.json('PUT', '/client/business-registration', { token: c.token, body: b })).status).toBe(200);
    }
    const sub = await h.json('POST', '/client/business-registration/submit', { token: c.token });
    expect(sub.body.activityPending).toBe(true);
    const regId = sub.body.id as string;
    const g = await h.json('GET', '/client/guides/vallalkozas_bejelentes', { token: c.token });
    const tev = g.body.steps.find((s: { key: string }) => s.key === 'tevekenysegek');
    expect(tev.fields.some((f: { label: string }) => f.label.includes('Babaúszás-oktatás uszodában'))).toBe(true);
    expect(tev.hold).toBeTruthy();
    const ell = g.body.steps.find((s: { key: string }) => s.key === 'ellenorzes');
    expect(ell.fields.some((f: { value?: string }) => (f.value ?? '').includes('Babaúszás-oktatás uszodában'))).toBe(true);
    // the client ignores the hold and files anyway → the team check waits until the free text became a coded line
    await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { ovtjKodok: [{ index: 0, ovtjKod: '960401' }] } });
    const filed = await h.json('POST', '/client/business-registration/filed', { token: c.token, form: filedForm() });
    expect(filed.body.status).toBe('beadva');
    const blocked = await h.json('POST', `/team/registrations/${regId}/check`, { token: anna.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(blocked.status).toBe(409);
    const fixed = await h.json('PATCH', `/team/registrations/${regId}`, {
      token: anna.token,
      body: { answers: { activities: [{ key: 'masszazs', main: true }, { key: null, label: 'Babaúszás-oktatás', main: false }], activityFreeText: null }, ovtjKodok: [{ index: 0, ovtjKod: '960401' }, { index: 1, ovtjKod: '855101' }] },
    });
    expect(fixed.body.activityPending).toBe(false);
    await h.json('POST', `/team/registrations/${regId}/adoszam`, { token: anna.token, body: { adoszam: '12345676-1-41', registeredOn: '2026-11-17' } });
    const ck = await h.json('POST', `/team/registrations/${regId}/check`, { token: anna.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(ck.body.status).toBe('kesz');
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.activityText).toBe('Masszázs, Babaúszás-oktatás');
  });

  it('kesz keeps unresolved free text in activity_text next to the main activity', async () => {
    const { fillProfileFromRegistration } = await import('../src/services/registration.js');
    const c = await starter('lev41@demo.kezjegy.test');
    for (const b of [page1, { activities: [{ key: 'masszazs', main: true }], activityFreeText: 'Babaúszás-oktatás' }, page3, page4, page5]) {
      await h.json('PUT', '/client/business-registration', { token: c.token, body: b });
    }
    const [row] = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId));
    await fillProfileFromRegistration(h.deps, h.deps.db, row!);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.activityText).toBe('Masszázs, Babaúszás-oktatás');
  });

  it('contribution and cost hints per work kind; the 2027 sentence only for the general class', async () => {
    const c = await starter('lev21@demo.kezjegy.test');
    const r1 = await h.json('PUT', '/client/business-registration', { token: c.token, body: { workKind: 'nyugdij_mellett', activities: [{ key: 'fodraszat', main: true }] } });
    expect(r1.body.hints.contributionText).toContain('nem fizetsz TB-járulékot és szochót');
    expect(r1.body.hints.costRatioText).toContain('80%');
    expect(r1.body.hints.costRatioText).not.toContain('2027');
    const r2 = await h.json('PUT', '/client/business-registration', { token: c.token, body: { workKind: 'munkaviszony_mellett', activities: [{ key: 'grafika', main: true }] } });
    expect(r2.body.hints.contributionText).toBe('Mellékállásban nincs legkisebb járulék: csak a tényleges jövedelmed után fizetsz.');
    expect(r2.body.hints.costRatioText).toContain('2027');
  });

  it('the profile refuses a postcode starting with 0 and a too short street line (same rules as the data form)', async () => {
    const c = await starter('lev22@demo.kezjegy.test');
    const bad = await h.json('PUT', '/client/profile', { token: c.token, body: { ...rolad, address: { zip: '0720', city: 'Szeged', line: 'Minta utca 3.' } } });
    expect(bad.status).toBe(400);
    const short = await h.json('PUT', '/client/profile', { token: c.token, body: { ...rolad, address: { zip: '6720', city: 'Szeged', line: 'M' } } });
    expect(short.status).toBe(400);
  });
});

describe('O1.6 – path switch and withdraw', () => {
  it('inditas → van closes the open registration; withdraw → elallt and the branch question again', async () => {
    const c = await starter('lev8@demo.kezjegy.test');
    await h.json('PUT', '/client/business-registration', { token: c.token, body: page1 });
    const sw = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    expect(sw.body.path).toBe('van');
    expect(sw.body.registration).toBeNull();
    // the short "Rólad" page is not enough for an existing business: adatok is open again
    expect(sw.body.steps.find((s: { step: string }) => s.step === 'adatok').status).toBe('ugyfelre_var');
    const regs = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId));
    expect(regs.map((r) => r.status)).toEqual(['elallt']);
    const back = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas' } });
    expect(back.body.registration.status).toBe('kitoltes');
    const w = await h.json('POST', '/client/business-registration/withdraw', { token: c.token, body: { reason: 'kesobb_inditom' } });
    expect(w.body.status).toBe('elallt');
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.businessStatus).toBeNull();
    const onb = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(onb.body.path).toBeNull();
    // SPEC §27.2.2: a never-filed questionnaire is REOPENED on the way back (answers kept), so there is one row
    expect((await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId))).length).toBe(1);
  });
});

describe('O7.4 – KYC: only the address side of the lakcímkártya', () => {
  it('addressBack is ignored and never stored', async () => {
    const c = await newClient(h, 'kycfix@demo.kezjegy.test');
    const fd = new FormData();
    const img = () => new Blob([jpegBytes() as BlobPart], { type: 'image/jpeg' });
    fd.append('idFront', img(), 'a.jpg');
    fd.append('idBack', img(), 'b.jpg');
    fd.append('addressFront', img(), 'c.jpg');
    fd.append('addressBack', img(), 'd.jpg');
    fd.append('data', JSON.stringify({ name: 'Minta Dóra', birthName: 'Minta Dóra', mothersBirthName: 'Példa Mária', birthPlace: 'Szeged', birthDate: '1990-01-01', citizenship: 'magyar', address: '6720 Szeged, Minta utca 3.', documentType: 'szemelyi', documentNumber: '123456AB', documentExpiry: '2030-01-01' }));
    fd.append('declarations', JSON.stringify({ ownBehalf: true, pep: false, truthful: true, notifyChanges: true }));
    const r = await h.json('POST', '/client/kyc', { token: c.token, form: fd });
    expect(r.status).toBe(201);
    const [k] = await h.deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, c.clientId));
    expect(Object.keys(k!.files as object).sort()).toEqual(['addressFront', 'idBack', 'idFront']);
  });
});
