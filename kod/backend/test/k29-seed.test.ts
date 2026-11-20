// SPEC §29.17 seed:k29 on top of the existing demo (base + ot1119 + k28): idempotent, existing demo clients unchanged
// (David, Kata, Réka …), Halmi Zsófia has a refunded month with a DEMO storno, Kerekes Anna has "Fizesd ki" open. The
// data step data.k29 confirms the owner's prices and gives the legacy DEMO subscriptions the demo provider.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, feeInvoices, feeSettings, payments, subscriptions, users } from '../src/db/schema.js';
import { makeClock, seedDemo } from '../src/seed/demo.js';
import { seedOt1119 } from '../src/seed/ot1119.js';
import { seedK28 } from '../src/seed/k28.js';
import { seedK29 } from '../src/seed/k29.js';
import { runDataStepK29 } from '../src/services/dijak.js';
import { setup, type Harness } from './helpers.js';

let h: Harness;
let credFile: string;
let before: string;

beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
  credFile = join(h.filesDir, 'seed', 'demo_belepesek.txt');
  const clock = makeClock(h.clock.now);
  const navClient = (await import('../src/nav/client.js')).createNavFactory(h.deps.cfg, clock.now);
  expect(await seedDemo({ ...h.deps, now: clock.now, navClient }, clock, { credentialsFile: credFile })).toBe('seeded');
  await seedOt1119(h.deps, { credentialsFile: credFile });
  await seedK28(h.deps, { credentialsFile: credFile });
  // the live server has unconfirmed rows from k6: simulate them, then the data step
  const { inArray } = await import('drizzle-orm');
  await h.deps.db.update(feeSettings).set({ confirmedAt: null }).where(inArray(feeSettings.kind, ['eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij']));
  before = JSON.stringify(await h.deps.db.select().from(clients).orderBy(clients.id));
}, 300_000);
afterAll(async () => h.close());

describe('data.k29 + seed:k29', () => {
  it('data.k29: the owner prices are confirmed (the plan rows untouched), legacy DEMO subscriptions get provider demo; idempotent', async () => {
    const r = await runDataStepK29(h.deps);
    expect((r.confirmed as string[]).sort()).toEqual(['eves_zaras', 'szuneteltetesi_dij', 'valtozas_egyszeru', 'valtozas_jogallas']);
    const rows = await h.deps.db.select().from(feeSettings);
    for (const k of ['eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij', 'igazolas_jovedelem', 'megszuntetes']) expect(rows.find((x) => x.kind === k)?.confirmedAt, k).not.toBeNull();
    expect(rows.find((x) => x.kind === 'megszuntetes')!.amountHuf).toBe(7_999);
    expect(rows.find((x) => x.kind === 'igazolas_ado')!.amountHuf).toBe(0);
    const demoSubs = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.mode, 'demo'));
    expect(demoSubs.length).toBeGreaterThan(0);
    expect(demoSubs.every((s) => s.provider === 'demo')).toBe(true);
    expect((await runDataStepK29(h.deps)).already).toBe(true);
  });
  it('seed:k29 adds Zsófia and Anna, a second run changes nothing; the existing clients are unchanged', async () => {
    const r1 = await seedK29(h.deps, { credentialsFile: credFile });
    expect(r1.created).toEqual(expect.arrayContaining(['zsofia', 'anna']));
    const r2 = await seedK29(h.deps, { credentialsFile: credFile });
    expect(r2.created).not.toContain('zsofia');
    const now = JSON.parse(JSON.stringify(await h.deps.db.select().from(clients).orderBy(clients.id))) as { id: string }[];
    const old = JSON.parse(before) as { id: string; updatedAt: string }[];
    for (const o of old) {
      const n = now.find((x) => x.id === o.id) as unknown as Record<string, unknown>;
      // the B2 part may set Péter's override / Fodor Márk (new rows); old rows keep every field except updatedAt
      const { updatedAt: _a, serviceLock: _s, ...restOld } = o as unknown as Record<string, unknown>;
      const { updatedAt: _b, serviceLock: _t, ...restNew } = n;
      expect(restNew).toEqual(restOld);
    }
    const lines = readFileSync(credFile, 'utf8');
    expect(lines).toContain('zsofia.halmi@demo.kezjegy.test');
    expect(lines).toContain('auth+anna.kerekes@demo.kezjegy.test');
  });
  it('Zsófia: three paid months, the middle one refunded with a DEMO storno; Anna: past_due with an open confirmation', async () => {
    const [zs] = await h.deps.db.select({ c: clients }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, 'zsofia.halmi@demo.kezjegy.test'));
    const ps = await h.deps.db.select().from(payments).where(eq(payments.clientId, zs!.c.id));
    expect(ps.filter((p) => p.status === 'sikeres')).toHaveLength(3);
    expect(ps.find((p) => p.refundedHuf === 19_999)).toBeTruthy();
    const inv = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, zs!.c.id));
    expect(inv.filter((i) => i.kind === 'szamla')).toHaveLength(3);
    expect(inv.find((i) => i.kind === 'sztorno')).toMatchObject({ status: 'kiallitva', demo: true });
    expect(inv.find((i) => i.kind === 'sztorno')!.number).toMatch(/^DEMO-S-2026-/);
    const [an] = await h.deps.db.select({ c: clients }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, 'auth+anna.kerekes@demo.kezjegy.test'));
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, an!.c.id));
    expect(sub).toMatchObject({ status: 'past_due', provider: 'demo' });
    const auth = await h.deps.db.select().from(payments).where(eq(payments.clientId, an!.c.id));
    expect(auth.find((p) => p.status === 'hitelesites_kell')).toBeTruthy();
  });
});
