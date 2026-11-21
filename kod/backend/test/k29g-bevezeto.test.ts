// SPEC §29.18 G – the guided first run: GuidedView per variant (order, currentKey skips waiting steps, progress), the
// pause / resume / done actions, and that an active client never gets it.
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, onboardingSteps } from '../src/db/schema.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;

beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
  // clients.guided comes with migration 0018 (B1); harmless once it is there
  await h.deps.db.execute(sql`alter table clients add column if not exists guided jsonb`);
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
});
afterAll(async () => h.close());

async function fresh(email: string) {
  const c = await newClient(h, email, { first: 'Péter', last: 'Németh' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}
const guided = async (token: string) => (await h.json('GET', '/client/guided', { token })).body;
const act = (token: string, action: string, key?: string) => h.json('POST', '/client/guided', { token, body: key ? { action, key } : { action } });
const keys = (v: { steps: { key: string }[] }) => v.steps.map((s) => s.key);

describe('G – a brand-new client', () => {
  it('opens on the welcome screens, then the branch question; the van order puts the contract before the meghatalmazás', async () => {
    const c = await fresh('bevezeto1@demo.kezjegy.test');
    const v0 = await guided(c.token);
    expect(v0.show).toBe(true);
    expect(v0.variant).toBe('nincs');
    expect(v0.welcome.seen).toBe(false);
    expect(v0.welcome.accountant.firstName).toBe('Bence');
    expect(v0.welcome.priceHuf).toBe(19999);
    // k8 integrator (tulaj 11-20, látvány 8): the optional callback row comes before the payment – the accountant's row is the 5th
    expect(v0.welcome.rows[2].title).toBe('Visszahívás a csapatunktól (nem kötelező)');
    expect(v0.welcome.rows[4].title).toContain('Bence');
    expect(v0.currentKey).toBe('ut');
    expect(keys(v0)).toEqual(['ut']);

    const w = await act(c.token, 'welcome_seen');
    expect(w.status).toBe(200);
    expect(w.body.welcome.seen).toBe(true);

    expect((await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } })).status).toBe(200);
    const v1 = await guided(c.token);
    expect(v1.variant).toBe('van');
    // k8: the optional callback offer before the payment ('visszahivas_ajanlat'), tulaj 11-20 ("kártya csak a visszahívás-ajánlat után")
    expect(keys(v1)).toEqual(['ut', 'adoszam', 'adatok', 'kedvezmenyek', 'szerzodes', 'meghatalmazas', 'azonositas', 'visszahivas_ajanlat', 'elofizetes']);
    expect(v1.currentKey).toBe('adoszam');
    expect(v1.progress).toEqual({ done: 1, total: 9 });
    expect(v1.steps.find((s: { key: string }) => s.key === 'adoszam').route).toBe('/bevezeto/adoszam');
    expect(v1.steps.find((s: { key: string }) => s.key === 'ut').route).toBe('/bevezeto/ut');
    // the card waits for the contract (journey lock), so it is never the current step before it
    expect(v1.steps.find((s: { key: string }) => s.key === 'elofizetes').state).toBe('kesobb');

    // "Most nem tudom" (adoszamPending) or a known adószám closes the pseudo-step
    await h.deps.db.update(clients).set({ adoszamPending: true }).where(eq(clients.id, c.clientId));
    const v2 = await guided(c.token);
    expect(v2.currentKey).toBe('adatok');
    expect(v2.progress.done).toBe(2);
  });

  it('"Később folytatom" pauses (show false, the checklist opens), "Folytatom" resumes at the same step', async () => {
    const c = await fresh('bevezeto2@demo.kezjegy.test');
    await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    const p = await act(c.token, 'later', 'adoszam');
    expect(p.status).toBe(200);
    expect(p.body.show).toBe(false);
    expect(p.body.paused).toBe(true);
    expect(p.body.lastKey).toBe('adoszam');
    expect(p.body.currentKey).toBe('adoszam');
    const r = await act(c.token, 'resume');
    expect(r.body.show).toBe(true);
    expect(r.body.paused).toBe(false);
    expect(r.body.welcome.seen).toBe(true);
    expect(r.body.currentKey).toBe('adoszam');
  });

  it('the new-business path: own order, KATA skips the allowance step, a waiting step never blocks the next one', async () => {
    const c = await fresh('bevezeto3@demo.kezjegy.test');
    await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas', mode: 'onallo' } });
    const v = await guided(c.token);
    expect(v.variant).toBe('inditas_onallo');
    // k8: the callback offer before the payment (tulaj 11-20)
    expect(keys(v)).toEqual(['ut', 'adatok', 'kedvezmenyek', 'kerdoiv', 'bejelentes', 'ertesites', 'szerzodes', 'azonositas', 'visszahivas_ajanlat', 'elofizetes', 'meghatalmazas']);
    expect(v.currentKey).toBe('adatok');

    await h.deps.db.update(clients).set({ taxRegimeAnswer: 'kata' }).where(eq(clients.id, c.clientId));
    const k = await guided(c.token);
    expect(keys(k)).not.toContain('kedvezmenyek');

    // identification sent → the accountant checks it ('var'); the guided run goes on with the next open step
    const c2 = await fresh('bevezeto4@demo.kezjegy.test');
    await h.json('PUT', '/client/onboarding/business-status', { token: c2.token, body: { businessStatus: 'van' } });
    await h.deps.db.update(clients).set({ adoszam: '12345676-1-41' }).where(eq(clients.id, c2.clientId));
    for (const step of ['adatok', 'szerzodes'] as const) {
      await h.deps.db.insert(onboardingSteps).values({ clientId: c2.clientId, step, status: 'kesz', completedAt: h.clock.now() }).onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'kesz', completedAt: h.clock.now() } });
    }
    await h.deps.db.insert(onboardingSteps).values({ clientId: c2.clientId, step: 'azonositas', status: 'konyvelore_var' }).onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'konyvelore_var' } });
    await h.json('POST', '/client/allowances/gate', { token: c2.token, body: { year: 2026, gate: 'nem_jar' } });
    const v2 = await guided(c2.token);
    const az = v2.steps.find((s: { key: string }) => s.key === 'azonositas');
    expect(az.state).toBe('var');
    expect(az.doneForClient).toBe(true);
    expect(v2.currentKey).toBe('meghatalmazas');
    expect(v2.pending.some((p: { key: string }) => p.key === 'azonositas')).toBe(true);
  });

  it('k7c: "Később" on the allowance gate moves the guided run on (it reopened the same gate before)', async () => {
    const c = await fresh('bevezeto8@demo.kezjegy.test');
    await act(c.token, 'welcome_seen');
    await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    await h.deps.db.update(clients).set({ adoszam: '12345676-1-41' }).where(eq(clients.id, c.clientId));
    await h.deps.db.insert(onboardingSteps).values({ clientId: c.clientId, step: 'adatok', status: 'kesz', completedAt: h.clock.now() }).onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'kesz', completedAt: h.clock.now() } });
    const v0 = await guided(c.token);
    expect(v0.currentKey).toBe('kedvezmenyek');
    const done0 = v0.progress.done;

    expect((await h.json('POST', '/client/allowances/gate', { token: c.token, body: { year: 2026, gate: 'kesobb' } })).status).toBeLessThan(300);
    const v1 = await guided(c.token);
    const kv = v1.steps.find((s: { key: string }) => s.key === 'kedvezmenyek');
    expect(kv.state).toBe('kesobb');
    expect(kv.doneForClient).toBe(true);
    expect(kv.route).toBe('/kedvezmenyek/kerdoiv'); // "Vissza" can still open it
    expect(v1.currentKey).toBe('szerzodes');
    expect(v1.progress.done).toBe(done0 + 1);
    // the checklist (journey) keeps offering it: the optional row stays open there
    const o = (await h.json('GET', '/client/onboarding', { token: c.token })).body;
    expect(o.journey.steps.find((s: { key: string }) => s.key === 'kedvezmenyek').state).toBe('nyitva');

    // a later real answer closes it as before
    await h.json('POST', '/client/allowances/gate', { token: c.token, body: { year: 2026, gate: 'nem_jar' } });
    const v2 = await guided(c.token);
    expect(v2.steps.find((s: { key: string }) => s.key === 'kedvezmenyek').state).toBe('kesz');
    expect(v2.currentKey).toBe('szerzodes');
  });

  it('done_seen ends the auto-open; an active client never sees the guided run', async () => {
    const c = await fresh('bevezeto5@demo.kezjegy.test');
    const d = await act(c.token, 'done_seen');
    expect(d.body.show).toBe(false);
    expect(d.body.doneSeen).toBe(true);

    const a = await fresh('bevezeto6@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, a.clientId));
    expect((await guided(a.token)).show).toBe(false);
  });

  it('refuses unknown actions and keys', async () => {
    const c = await fresh('bevezeto7@demo.kezjegy.test');
    expect((await act(c.token, 'skip_all')).status).toBe(400);
    expect((await act(c.token, 'later', 'nincs_ilyen')).status).toBe(400);
  });
});
