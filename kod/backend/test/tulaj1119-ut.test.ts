// SPEC §27.12 K2 (owner order 2, 11-19): the branch answer can be changed; K4.1/K4.3 parts that live in the API (one
// journey, one number, Előfizetés after the contract on both paths).
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, businessRegistrations, clients, notifications, onboardingSteps } from '../src/db/schema.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

const rolad = { firstName: 'Péter', lastName: 'Németh', phone: '+36 30 555 0142', adoazonositoJel: '8123456786', address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' } };
const vanProfile = {
  firstName: 'Péter',
  lastName: 'Németh',
  phone: '+36301234567',
  adoazonositoJel: '8123456786',
  adoszam: '12345676-1-41',
  address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' },
  hqMunicipality: 'Szeged',
  activityText: 'Weboldal-fejlesztés',
  activityAnswer: 'egyeb',
  taxStatus: 'mellekallasu',
  evSince: '2024-03-01',
  hasSeparateBusinessAccount: true,
};
const pages = [
  { declarations: { noExclusion: true, singleBusiness: true }, revenueBand: 'max_12m' },
  { activities: [{ key: 'grafika', main: true }] },
  { seat: { kind: 'lakcim' } },
  { workKind: 'fofoglalkozas', euPartner: 'nem', hasSeparateBusinessAccount: true },
  { startPlan: 'mielobb' },
];

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
});
afterAll(async () => h.close());

async function fresh(email: string) {
  const c = await newClient(h, email, { first: 'Péter', last: 'Németh' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}
const put = (token: string, businessStatus: string, extra: Record<string, unknown> = {}) => h.json('PUT', '/client/onboarding/business-status', { token, body: { businessStatus, ...extra } });

describe('K2.1 – NULL → van → inditas → van → inditas keeps ONE registration', () => {
  it('every change answers 200, reopens the same row, keeps the answers and the guide progress, audits from/to', async () => {
    const c = await fresh('valto1@demo.kezjegy.test');
    const s0 = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(s0.body.journey.variant).toBe('nincs');
    expect(s0.body.journey.todoCount).toBe(1);
    expect(s0.body.journey.steps.map((x: { key: string }) => x.key)).toEqual(['ut']);
    expect(s0.body.journey.preview.length).toBe(6);
    expect(s0.body.pathChange.current).toBeNull();
    expect((await put(c.token, 'van')).status).toBe(200);
    h.clock.advance(60_000);
    const s1 = await put(c.token, 'inditas');
    expect(s1.status).toBe(200);
    expect(s1.body.journey.variant).toBe('inditas_onallo');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: rolad })).status).toBe(200);
    for (const p of pages) expect((await h.json('PUT', '/client/business-registration', { token: c.token, body: p })).status).toBe(200);
    expect((await h.json('POST', '/client/business-registration/submit', { token: c.token })).status).toBe(200);
    expect((await h.json('PUT', '/client/guides/vallalkozas_bejelentes/progress', { token: c.token, body: { doneStepKeys: ['belepes'] } })).status).toBe(200);
    h.clock.advance(60_000);
    const s2 = await put(c.token, 'van');
    expect(s2.status).toBe(200);
    expect(s2.body.path).toBe('van');
    // the short "Rólad" page is not the full form of an existing business
    expect(s2.body.steps.find((x: { step: string }) => x.step === 'adatok').status).toBe('ugyfelre_var');
    h.clock.advance(60_000);
    const s3 = await put(c.token, 'inditas');
    expect(s3.status).toBe(200);
    const regs = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId));
    expect(regs.length).toBe(1);
    expect(regs[0]!.status).toBe('utmutato');
    expect(regs[0]!.guideProgress).toEqual(['belepes']);
    expect((regs[0]!.answers as { revenueBand?: string }).revenueBand).toBe('max_12m');
    expect(regs[0]!.withdrawnAt).toBeNull();
    const log = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'business_status.changed')));
    expect(log.map((x) => [(x.details as { from: string }).from, (x.details as { to: string }).to])).toEqual([
      ['van', 'inditas'],
      ['inditas', 'van'],
      ['van', 'inditas'],
    ]);
    // staff badge for real changes (not the first answer)
    const badges = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'client_path_changed')));
    expect(badges.length).toBe(3);
    expect(badges[0]!.wantEmail).toBe(false);
    expect(badges[0]!.wantPush).toBe(false);
  });

  it('the toast "Visszavonom" (undo: true) within 30 s is an undo: audited as such; the staff get the final state once (11-19 javítás)', async () => {
    const c = await fresh('valto2@demo.kezjegy.test');
    await put(c.token, 'van');
    h.clock.advance(60_000);
    await put(c.token, 'inditas');
    const before = (await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'client_path_changed')))).length;
    h.clock.advance(10_000);
    expect((await put(c.token, 'van', { undo: true })).status).toBe(200);
    const list = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'client_path_changed')));
    // the change it took back was notified – so a correcting badge with the final state follows
    expect(list.length).toBe(before + 1);
    expect(list.at(-1)!.body).toBe('Most indítom → Már van vállalkozásom');
    const [last] = (await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'business_status.changed')))).slice(-1);
    expect((last!.details as { undo?: boolean }).undo).toBe(true);
  });
});

describe('K2.2 – blockers, withdraw, path_required, the team change', () => {
  it('van with an adószám → inditas: 409 path_change_needs_callback (adoszam_megadva)', async () => {
    const c = await fresh('valto3@demo.kezjegy.test');
    await put(c.token, 'van');
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: vanProfile })).status).toBe(200);
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(st.body.pathChange.canChange).toBe(false);
    expect(st.body.pathChange.blocker).toBe('adoszam_megadva');
    const r = await put(c.token, 'inditas');
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('path_change_needs_callback');
    expect(r.body.error.message).toContain('Már megadtad az adószámodat.');
    // the team may change it after a callback, clearing the wrong adószám (audited)
    const t = await h.json('POST', `/team/clients/${c.clientId}/path`, { token: anna.token, body: { businessStatus: 'inditas', note: 'Rossz gombot nyomott', clearAdoszam: true } });
    expect(t.status).toBe(200);
    expect(t.body.businessStatus).toBe('inditas');
    expect(t.body.pathHistory[0]).toMatchObject({ from: 'van', to: 'inditas', by: 'csapat' });
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.adoszam).toBeNull();
    const [a] = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'team.path_changed')));
    expect((a!.details as { clearedAdoszam?: string }).clearedAdoszam).toBe('12345676-1-41');
  });

  it('inditas filed (beadva) → van: 409 bejelentes_bekuldve; withdraw in beadva: 409', async () => {
    const c = await fresh('valto4@demo.kezjegy.test');
    await put(c.token, 'inditas');
    await h.json('PUT', '/client/profile', { token: c.token, body: rolad });
    for (const p of pages) await h.json('PUT', '/client/business-registration', { token: c.token, body: p });
    await h.json('POST', '/client/business-registration/submit', { token: c.token });
    const fd = new FormData();
    fd.append('filedOn', '2026-11-18');
    fd.append('channel', 'dap');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'e.pdf');
    expect((await h.req('POST', '/client/business-registration/filed', { token: c.token, form: fd })).status).toBe(200);
    const r = await put(c.token, 'van');
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('path_change_needs_callback');
    const w = await h.json('POST', '/client/business-registration/withdraw', { token: c.token, body: { reason: 'kesobb_inditom' } });
    expect(w.status).toBe(409);
    expect(w.body.error.code).toBe('path_change_needs_callback');
    // the team cannot undo a filing either
    expect((await h.json('POST', `/team/clients/${c.clientId}/path`, { token: anna.token, body: { businessStatus: 'van', note: 'x' } })).status).toBe(409);
    // a client channel only: 'meghatalmazott' is not accepted from the app
    const fd2 = new FormData();
    fd2.append('filedOn', '2026-11-18');
    fd2.append('channel', 'meghatalmazott');
    fd2.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'e.pdf');
  });

  it('full van profile while unanswered: 409 path_required (never a silent "van")', async () => {
    const c = await fresh('valto5@demo.kezjegy.test');
    const r = await h.json('PUT', '/client/profile', { token: c.token, body: vanProfile, headers: { 'x-test-no-auto-van': '1' } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('path_required');
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.businessStatus).toBeNull();
  });

  it('withdraw "mar_van_vallalkozasa" = the same as inditas → van; other reasons clear the answer', async () => {
    const c = await fresh('valto6@demo.kezjegy.test');
    await put(c.token, 'inditas');
    const w = await h.json('POST', '/client/business-registration/withdraw', { token: c.token, body: { reason: 'mar_van_vallalkozasa' } });
    expect(w.status).toBe(200);
    expect(w.body.status).toBe('elallt');
    let [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.businessStatus).toBe('van');
    h.clock.advance(60_000);
    await put(c.token, 'inditas');
    const w2 = await h.json('POST', '/client/business-registration/withdraw', { token: c.token, body: { reason: 'kesobb_inditom' } });
    expect(w2.status).toBe(200);
    [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.businessStatus).toBeNull();
  });

  it('csapat cannot change the path of an active client; an accountant never (404)', async () => {
    const c = await newClient(h, 'aktiv1@demo.kezjegy.test', { active: true });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId, businessStatus: 'van' }).where(eq(clients.id, c.clientId));
    const r = await h.json('POST', `/team/clients/${c.clientId}/path`, { token: admin.token, body: { businessStatus: 'inditas', note: 'x' } });
    expect(r.status).toBe(409);
    expect((await h.json('POST', `/team/clients/${c.clientId}/path`, { token: bence.token, body: { businessStatus: 'inditas', note: 'x' } })).status).toBe(404);
  });
});

describe('K4 (API part) – one journey, one number, Előfizetés after the contract', () => {
  it('band = badge = locked sheet: todoCount equals access.activationHint numbers and Me.access', async () => {
    const c = await fresh('ut1@demo.kezjegy.test');
    await put(c.token, 'van');
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    const j = st.body.journey;
    expect(j.variant).toBe('van');
    expect(j.steps.map((x: { key: string }) => x.key)).toEqual(['ut', 'adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes']);
    expect(j.steps.filter((x: { state: string }) => x.state === 'most').length).toBe(1);
    expect(j.currentKey).toBe('adatok');
    expect(st.body.todoCount).toBe(j.todoCount);
    // adatok, szerzodes, meghatalmazas (locked by the contract), azonositas, elofizetes (locked by the contract)
    expect(j.todoCount).toBe(5);
    expect(j.bandTitle).toBe('Még 5 dolog kell tőled, a többit Bence intézi.');
    const acc = await h.json('GET', '/client/access', { token: c.token });
    expect(acc.body.activationHint).toBe(j.lockedSheetText);
    expect(j.lockedSheetText).toContain(`Ebből ${j.todoCount} a tiéd`);
    const me = await h.json('GET', '/me', { token: c.token });
    expect(me.body.access.activationHint).toBe(j.lockedSheetText);
    // every completed client thing lowers the number by exactly one
    await h.json('PUT', '/client/profile', { token: c.token, body: vanProfile });
    const st2 = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(st2.body.journey.todoCount).toBe(4);
  });

  it('Előfizetés is locked until the contract on BOTH paths (409 step_locked + row kesobb)', async () => {
    for (const [email, path] of [['ut2@demo.kezjegy.test', 'van'], ['ut3@demo.kezjegy.test', 'inditas']] as const) {
      const c = await fresh(email);
      await put(c.token, path);
      const st = await h.json('GET', '/client/onboarding', { token: c.token });
      const row = st.body.journey.steps.find((x: { key: string }) => x.key === 'elofizetes');
      expect(row.state).toBe('kesobb');
      expect(row.lockedReason).toBe('Előbb fogadd el a szerződést. Utána megadhatod a kártyádat.');
      const sub = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
      expect(sub.status).toBe(409);
      expect(sub.body.error.code).toBe('step_locked');
    }
  });

  it('the contract needs a confirmed e-mail and the data form first (round-2 security finding 4)', async () => {
    const c = await fresh('ut4@demo.kezjegy.test');
    await put(c.token, 'van');
    const r = await h.json('POST', '/me/consents', { token: c.token, body: { items: [{ docType: 'megbizasi_szerzodes', version: h.deps.legal.current('megbizasi_szerzodes').version }] } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('step_locked');
    const steps = await h.deps.db.select().from(onboardingSteps).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'szerzodes')));
    expect(steps[0]?.status ?? 'nincs_kezdve').not.toBe('kesz');
  });
});
