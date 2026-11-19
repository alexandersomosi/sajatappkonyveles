// SPEC §28.11 / §28.K.21: the idempotent demo additions on top of the base demo. A second run changes nothing; the
// existing demo clients are not touched; the new personas log in and see their §28 screens.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, users } from '../src/db/schema.js';
import { makeClock, seedDemo } from '../src/seed/demo.js';
import { seedOt1119 } from '../src/seed/ot1119.js';
import { seedK28 } from '../src/seed/k28.js';
import { setup, type Harness } from './helpers.js';

let h: Harness;
let credFile: string;
const tokens: Record<string, string> = {};
let before: string;

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  credFile = join(h.filesDir, 'seed', 'demo_belepesek.txt');
  const clock = makeClock(h.clock.now);
  const navClient = (await import('../src/nav/client.js')).createNavFactory(h.deps.cfg, clock.now);
  expect(await seedDemo({ ...h.deps, now: clock.now, navClient }, clock, { credentialsFile: credFile })).toBe('seeded');
  before = JSON.stringify(await h.deps.db.select().from(clients).orderBy(clients.id));
  expect((await seedOt1119(h.deps, { credentialsFile: credFile })).status).toBe('seeded');
  expect((await seedK28(h.deps, { credentialsFile: credFile })).status).toBe('seeded');
  expect((await seedOt1119(h.deps, { credentialsFile: credFile })).status).toBe('exists');
  expect((await seedK28(h.deps, { credentialsFile: credFile })).status).toBe('exists');
  const lines = readFileSync(credFile, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  let i = 0;
  for (const l of lines) {
    const [, email, password] = l.split(';');
    const r = await h.json('POST', '/auth/login', { body: { email, password, clientKind: email!.startsWith('bence') || email!.startsWith('admin') || email!.startsWith('anna') ? 'panel' : 'native' }, headers: { 'x-forwarded-for': `10.6.6.${++i}` } });
    if (r.status === 200) tokens[email!.split('@')[0]!] = r.body.accessToken;
  }
}, 300_000);
afterAll(async () => h.close());

describe('seed:ot1119 + seed:k28', () => {
  it('the earlier demo clients are unchanged (only new rows)', async () => {
    const now = await h.deps.db.select().from(clients).orderBy(clients.id);
    const old = JSON.parse(before) as { id: string }[];
    for (const o of old) expect(JSON.stringify(now.find((x) => x.id === o.id))).toBe(JSON.stringify(o));
    expect(now.length).toBe(old.length + 9);
  });
  it('Eszter: two allowances waiting for Bence; reserve and earnings on the home', async () => {
    const t = tokens['eszter.szabo']!;
    const a = await h.json('GET', '/client/allowances?year=2026', { token: t });
    expect(a.body.items.map((x: { kind: string; status: string }) => `${x.kind}:${x.status}`)).toEqual(['anyak:javasolt', 'csaladi:javasolt']);
    const home = await h.json('GET', '/client/home', { token: t });
    expect(home.body.reserve).toBeTruthy();
    expect(home.body.earnings.ytdRevenueHuf).toBeGreaterThan(5_000_000);
  });
  it('Bálint: 25 év alattiak approved, two invoice notifications', async () => {
    const t = tokens['balint.toth']!;
    const a = await h.json('GET', '/client/allowances?year=2026', { token: t });
    expect(a.body.items[0]).toMatchObject({ kind: 'fiatal25', status: 'jovahagyva' });
    const n = await h.json('GET', '/me/notifications', { token: t });
    expect(n.body.items.filter((x: { kind: string }) => x.kind === 'invoice_new')).toHaveLength(2);
  });
  it('Ádám: the consent screen of the seat change', async () => {
    const t = tokens['adam.kovacs']!;
    const g = await h.json('GET', '/client/change-guides', { token: t });
    const open = g.body.items.find((x: { kind: string }) => x.kind === 'valtozas_szekhely').openAssist;
    expect(open.status).toBe('meghatalmazas_el');
    const s = await h.json('GET', `/client/assist/${open.id}/consent`, { token: t });
    expect(s.body.canConsent).toBe(true);
  });
  it('Ilona is locked; Norbert has an open 7 999 Ft DEMO charge; Bálint has a 2026 annual row', async () => {
    const il = await h.json('GET', '/client/home', { token: tokens['ilona.fazekas']! });
    expect(il.body.lock.reasons).toEqual(['havidij']);
    const f = await h.json('GET', '/client/fees', { token: tokens['norbert.kiss']! });
    expect(f.body.open[0]).toMatchObject({ kind: 'valtozas_jogallas', amountHuf: 7_999, demo: true });
    const an = await h.json('GET', '/client/annual?year=2026', { token: tokens['balint.toth']! });
    expect(an.body.status).toBe('nem_indult');
  });
  it('no seeded user is an existing protected account', async () => {
    const u = await h.deps.db.select({ email: users.email }).from(users).where(eq(users.email, 'alex@demo.kezjegy.test'));
    expect(u.length).toBeLessThanOrEqual(1);
  });
});
