// The demo seed (SPEC §19) end to end: the numbers of SPEC §7.6 C through the real API.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, users } from '../src/db/schema.js';
import { makeClock, seedDemo } from '../src/seed/demo.js';
import { setup, type Harness } from './helpers.js';

let h: Harness;
let credFile: string;
const tokens: Record<string, string> = {};

beforeAll(async () => {
  h = await setup({ now: '2026-11-17T09:00:00Z' });
  credFile = join(h.filesDir, 'seed', 'demo_belepesek.txt');
  // The seed moves its own clock into the past; "now" for it is the harness clock.
  const clock = makeClock(h.clock.now);
  const deps = { ...h.deps, now: clock.now };
  const navClient = (await import('../src/nav/client.js')).createNavFactory(h.deps.cfg, clock.now);
  expect(await seedDemo({ ...deps, navClient }, clock, { credentialsFile: credFile })).toBe('seeded');
  expect(await seedDemo({ ...deps, navClient }, clock, { credentialsFile: credFile })).toBe('exists');
  const lines = readFileSync(credFile, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  for (const l of lines) {
    const [, email, password] = l.split(';');
    const r = await h.json('POST', '/auth/login', { body: { email, password, clientKind: email!.startsWith('bence') || email!.startsWith('admin') ? 'panel' : 'native' }, headers: { 'x-forwarded-for': `10.5.5.${Object.keys(tokens).length + 1}` } });
    expect(r.status).toBe(200);
    tokens[email!.split('@')[0]!] = r.body.accessToken;
  }
}, 300_000);
afterAll(async () => h.close());

describe('demo seed', () => {
  it('writes five fictional logins (passwords only in the file)', () => {
    expect(Object.keys(tokens).sort()).toEqual(['admin', 'bence.kovacs', 'kata.szabo', 'peter.nemeth', 'reka.varga']);
  });

  it('Kata: Q3 approved 510 471 Ft, paid, verified, filed; hero = Q4 estimate 392 661 Ft', async () => {
    const t = tokens['kata.szabo']!;
    const periods = await h.json('GET', '/client/tax-periods?year=2026', { token: t });
    const q = Object.fromEntries(periods.body.items.map((p: { periodKey: string }) => [p.periodKey, p]));
    expect(q['2026-Q3']).toMatchObject({ calcStatus: 'jovahagyva', paymentStatus: 'ellenorizve', filingStatus: 'beadva', totalHuf: 510_471 });
    expect(q['2026-Q1'].totalHuf).toBe(305_046);
    expect(q['2026-Q2'].totalHuf).toBe(381_651);
    const home = await h.json('GET', '/client/home', { token: t });
    expect(home.body.hero).toMatchObject({ state: 'becsles', periodKey: '2026-Q4', amountHuf: 392_661, dueDate: '2027-01-12' });
    expect(home.body.accountant).toMatchObject({ firstName: 'Bence', displayName: 'Kovács Bence', avatarKey: 'karakter_1_lapos' });
    expect(home.body.accountant.signatureSvgPath.length).toBeGreaterThan(1000);
    expect(home.body.limits.afa.usedHuf).toBe(8_242_000);
    expect(home.body.requestsFromAccountant[0].title).toMatch(/októberi bankszámlakivonat/);
    const oct = await h.json('GET', '/client/dossiers/2026-10', { token: t });
    expect(oct.body.review.note).toBe('A tegnapi szerződésre még ránéz.');
    expect(oct.body.sentByMe.map((d: { title: string }) => d.title)).toEqual(expect.arrayContaining(['Nyugta, készpénzes eladás', 'Szerződés, Bodza Kiadó']));
    expect(oct.body.filedByAccountant.map((d: { title: string }) => d.title)).toContain('Bevallás a III. negyedévről');
    expect(oct.body.fromNav.invoices.count).toBeGreaterThan(0);
    const sub = await h.json('GET', '/client/subscription', { token: t });
    expect(sub.body).toMatchObject({ status: 'active', mode: 'demo', nextChargeAt: '2026-12-08T08:00:00.000Z' });
    expect(sub.body.card.mask).toBe('xxxx-xxxx-xxxx-4193');
    const fees = await h.json('GET', '/client/fee-invoices', { token: t });
    expect(fees.body.items).toHaveLength(11);
    const msgs = await h.json('GET', '/client/messages', { token: t });
    expect(msgs.body.items.length).toBeGreaterThanOrEqual(8);
  });

  it('Réka: Q3 492 054 Ft marked paid, not yet verified; flags hatar_kozel + hianyzik_valami', async () => {
    const home = await h.json('GET', '/client/home', { token: tokens['reka.varga']! });
    expect(home.body.hero).toMatchObject({ state: 'befizetve', periodKey: '2026-Q3', amountHuf: 492_054, paidOn: '2026-10-10', verified: false });
    const [r] = await h.deps.db.select().from(clients).where(eq(clients.firstName, 'Réka'));
    expect(r!.nextFlags).toEqual(expect.arrayContaining(['hatar_kozel', 'hianyzik_valami']));
  });

  it('Péter: onboarding in progress, current milestone "NAV-nál bejelentve", old booked call still readable', async () => {
    const t = tokens['peter.nemeth']!;
    const onb = await h.json('GET', '/client/onboarding', { token: t });
    const cur = onb.body.milestones.find((m: { current: boolean }) => m.current);
    expect(cur.key).toBe('nav_bejelentve');
    // SPEC §26.2.9: booking is retired, the old row stays readable; 'idopont' is never listed.
    expect(onb.body.appointmentsEnabled).toBe(false);
    expect(onb.body.steps.map((s: { step: string }) => s.step)).not.toContain('idopont');
    const apts = await h.json('GET', '/client/appointments', { token: t });
    expect(apts.body.items[0]).toMatchObject({ channel: 'telefon', status: 'foglalt', startsAt: '2026-11-19T09:00:00.000Z' });
    const home = await h.json('GET', '/client/home', { token: t });
    expect(home.body.hero.state).toBe('bekotes_alatt');
  });

  it('the accountant panel lists the three clients with counts per filter', async () => {
    const list = await h.json('GET', '/acc/clients', { token: tokens['bence.kovacs']! });
    expect(list.body.items).toHaveLength(3);
    expect(list.body.counts.bekotes_alatt).toBe(1);
    expect(list.body.counts.hatar_kozel).toBe(1);
    const board = await h.json('GET', '/acc/deadline-board?week=2026-W47', { token: tokens['bence.kovacs']! });
    expect(board.status).toBe(200);
    expect(board.body.days).toHaveLength(7);
  });

  it('the admin dashboard shows business data', async () => {
    const d = await h.json('GET', '/admin/dashboard', { token: tokens.admin! });
    expect(d.body.clients.total).toBe(3);
    expect(d.body.mrrHuf).toBe(60_000);
    const outbox = await h.json('GET', '/admin/demo-outbox', { token: tokens.admin! });
    expect(outbox.status).toBe(200);
    const sys = await h.json('GET', '/admin/system', { token: tokens.admin! });
    expect(sys.body.modes).toMatchObject({ nav: 'demo', simplepay: 'demo', mail: 'demo' });
  });

  it('client legal PDFs are generated with the client data (Geist, ő/ű)', async () => {
    for (const t of ['megbizasi_szerzodes', 'nav_meghatalmazas']) {
      const r = await h.req('GET', `/client/legal-pdf/${t}`, { token: tokens['kata.szabo']! });
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toBe('application/pdf');
      const b = Buffer.from(await r.arrayBuffer());
      expect(b.subarray(0, 5).toString()).toBe('%PDF-');
    }
    const legal = await h.json('GET', '/legal/aszf');
    expect(legal.body.markdown).toContain('TERVEZET');
    expect(legal.body.markdown).not.toContain('{{brand.name}}');
  });

  it('no seeded password is stored in clear', async () => {
    const all = await h.deps.db.select({ ph: users.passwordHash }).from(users);
    expect(all.every((u) => !u.ph || u.ph.startsWith('$argon2id$'))).toBe(true);
  });
});

describe('demo jelszócsere (kör 2)', () => {
  it('az 5 demó fiók új jelszót kap, a régi nem jó, a munkamenetek véget érnek', async () => {
    const { rotateDemoPasswords } = await import('../src/seed/demo.js');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'kj-rot-')), 'demo_belepesek.txt');
    expect(await rotateDemoPasswords(h.deps, { credentialsFile: file })).toBe(5);
    const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
    expect(lines.map((l) => l.split(';')[0])).toEqual(['admin', 'konyvelo', 'ugyfel', 'ugyfel', 'ugyfel']);
    const kata = lines.find((l) => l.includes('kata.szabo'))!.split(';');
    const ok = await h.json('POST', '/auth/login', { body: { email: kata[1], password: kata[2], clientKind: 'native' }, headers: { 'x-forwarded-for': '10.200.0.9' } });
    expect(ok.status).toBe(200);
    const old = await h.json('GET', '/client/home', { token: tokens['kata.szabo']! });
    expect(old.status).toBe(401);
  });
});

// SPEC §26.13: the idempotent DEMO addition on top of a live-like database – never a reseed. The owner's own accounts
// (here: fictional stand-ins for alex@ and tulaj@) and every existing row must stay exactly as they were.
describe('demo addition tulaj1118 (idempotent, never touches existing rows)', () => {
  it('adds Anna, Levente, Zsófia and 4 callbacks once; a second run changes nothing', async () => {
    const { newClient } = await import('./helpers.js');
    const { seedTulaj1118 } = await import('../src/seed/tulaj1118.js');
    const { businessRegistrations, callbackRequests, onboardingSteps, messages: msgs, appointments } = await import('../src/db/schema.js');
    const { sql } = await import('drizzle-orm');
    const alex = await newClient(h, 'alex@demo.kezjegy.test', { first: 'Alex' });
    await h.json('PUT', '/client/onboarding/business-status', { token: alex.token, body: { businessStatus: 'inditas' } });
    const owner = await newClient(h, 'tulaj@demo.kezjegy.test', { first: 'Tulaj' });
    const snap = async () => ({
      users: await h.deps.db.select().from(users).where(sql`${users.email} in ('alex@demo.kezjegy.test', 'tulaj@demo.kezjegy.test', 'kata.szabo@demo.kezjegy.test', 'reka.varga@demo.kezjegy.test', 'peter.nemeth@demo.kezjegy.test')`).orderBy(users.email),
      clients: await h.deps.db.select().from(clients).where(sql`${clients.userId} in (select id from users where email in ('alex@demo.kezjegy.test', 'tulaj@demo.kezjegy.test', 'kata.szabo@demo.kezjegy.test', 'reka.varga@demo.kezjegy.test', 'peter.nemeth@demo.kezjegy.test'))`).orderBy(clients.id),
      steps: await h.deps.db.select().from(onboardingSteps).where(sql`${onboardingSteps.clientId} in (select id from clients where user_id in (select id from users where email in ('alex@demo.kezjegy.test', 'tulaj@demo.kezjegy.test')))`).orderBy(onboardingSteps.clientId, onboardingSteps.step),
      appointments: await h.deps.db.select().from(appointments).orderBy(appointments.id),
    });
    const before = await snap();
    const credLinesBefore = readFileSync(credFile, 'utf8').split('\n').filter(Boolean).length;
    const res1 = await seedTulaj1118(h.deps, { credentialsFile: credFile });
    expect(res1.status).toBe('seeded');
    expect(res1.created).toEqual(expect.arrayContaining(['anna', 'levente', 'zsofia', 'callback:levente', 'callback:zsofia', 'callback:reka', 'callback:kata']));
    const after = await snap();
    // existing rows untouched (business_status: 'van' only for clients that already had an adószám – Kata, Réka, Péter)
    const strip = (rows: { businessStatus?: unknown }[]) => rows.map((r) => ({ ...r, businessStatus: undefined }));
    expect(after.users).toEqual(before.users);
    expect(strip(after.clients)).toEqual(strip(before.clients));
    expect(after.steps).toEqual(before.steps);
    expect(after.appointments).toEqual(before.appointments);
    const bs = Object.fromEntries(after.clients.map((c) => [c.firstName, c.businessStatus]));
    expect(bs).toMatchObject({ Alex: 'inditas', Tulaj: null, Kata: 'van', Réka: 'van', Péter: 'van' });
    const lines = readFileSync(credFile, 'utf8').split('\n').filter(Boolean);
    expect(lines.length).toBe(credLinesBefore + 2);
    expect(lines.slice(-2).map((l) => l.split(';').slice(0, 2).join(';'))).toEqual(['csapat;anna.nagy@demo.kezjegy.test', 'ugyfel;levente.toth@demo.kezjegy.test']);
    // second run: nothing new
    const counts = async () => ({
      users: (await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(users))[0]!.n,
      regs: (await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(businessRegistrations))[0]!.n,
      cbs: (await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(callbackRequests))[0]!.n,
      msgs: (await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(msgs))[0]!.n,
    });
    const c1 = await counts();
    expect((await seedTulaj1118(h.deps, { credentialsFile: credFile })).status).toBe('exists');
    expect(await counts()).toEqual(c1);
    expect(readFileSync(credFile, 'utf8').split('\n').filter(Boolean).length).toBe(lines.length);
    expect(c1.cbs).toBe(5); // 4 seeded + Péter's legacy booking
    // the new demo people work through the API
    const [, levEmail, levPw] = lines.at(-1)!.split(';');
    const lev = await h.json('POST', '/auth/login', { body: { email: levEmail, password: levPw, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.6.6.1' } });
    expect(lev.status).toBe(200);
    const reg = await h.json('GET', '/client/business-registration', { token: lev.body.accessToken });
    expect(reg.body.registration).toMatchObject({ status: 'beadva', guideProgress: expect.any(Array) });
    expect(reg.body.registration.guideProgress).toHaveLength(14);
    expect(reg.body.registration.filed.channel).toBe('ugyfelkapu_plus');
    const cb = await h.json('GET', '/client/callbacks', { token: lev.body.accessToken });
    expect(cb.body.open).toMatchObject({ status: 'uj', topic: 'vallalkozas_inditas', source: 'vallalkozas_utmutato' });
    const [, annaEmail, annaPw] = lines.at(-2)!.split(';');
    const an = await h.json('POST', '/auth/login', { body: { email: annaEmail, password: annaPw, clientKind: 'panel' }, headers: { 'x-forwarded-for': '10.6.6.2' } });
    expect(an.status).toBe(200);
    const queue = await h.json('GET', '/team/callbacks?filter=mind', { token: an.body.accessToken });
    const states = queue.body.items.map((x: { status: string; client: { name: string }; overdue: boolean }) => `${x.client.name}:${x.status}${x.overdue ? ':lejart' : ''}`);
    expect(states).toEqual(expect.arrayContaining(['Tóth Levente:uj', 'Fehér Zsófia:uj:lejart', 'Varga Réka:folyamatban', 'Szabó Kata:teljesitve', 'Németh Péter:uj']));
    const pipe = await h.json('GET', '/team/registrations?status=mind', { token: an.body.accessToken });
    expect(pipe.body.items.map((x: { client: { name: string }; status: string }) => `${x.client.name}:${x.status}`)).toEqual(expect.arrayContaining(['Tóth Levente:beadva', 'Fehér Zsófia:utmutato']));
    const zs = pipe.body.items.find((x: { client: { name: string } }) => x.client.name === 'Fehér Zsófia');
    expect(zs.daysInStatus).toBeGreaterThanOrEqual(3);
    const zsLogin = await h.json('POST', '/auth/login', { body: { email: 'zsofia.feher@demo.kezjegy.test', password: 'barmi-hosszu-jelszo-123', clientKind: 'native' }, headers: { 'x-forwarded-for': '10.6.6.3' } });
    expect(zsLogin.status).toBe(401);
    const all = await h.deps.db.select().from(msgs).where(sql`${msgs.body} like 'A hívásunk összefoglalója:%'`);
    expect(all).toHaveLength(1);
    void owner;
  });
});

describe('demo addition tulaj1119 (SPEC §27.7.4, idempotent, never touches existing rows)', () => {
  it('adds Marika, Dávid and Ilona once; alex@/tulaj@ unchanged; Marika sees the approval as "Most ez jön"', async () => {
    const { seedTulaj1119 } = await import('../src/seed/tulaj1119.js');
    const { assistRequests, onboardingSteps, systemState } = await import('../src/db/schema.js');
    const { sql } = await import('drizzle-orm');
    const owners = sql`${users.email} in ('alex@demo.kezjegy.test', 'tulaj@demo.kezjegy.test')`;
    const snap = async () => ({
      users: await h.deps.db.select().from(users).where(owners).orderBy(users.email),
      clients: await h.deps.db.select().from(clients).where(sql`${clients.userId} in (select id from users where email in ('alex@demo.kezjegy.test', 'tulaj@demo.kezjegy.test'))`).orderBy(clients.id),
      steps: await h.deps.db.select().from(onboardingSteps).orderBy(onboardingSteps.clientId, onboardingSteps.step),
    });
    const before = await snap();
    const credLinesBefore = readFileSync(credFile, 'utf8').split('\n').filter(Boolean).length;
    const res = await seedTulaj1119(h.deps, { credentialsFile: credFile });
    expect(res.status).toBe('seeded');
    expect(res.created).toEqual(['marika', 'david', 'ilona']);
    const after = await snap();
    expect(after.users).toEqual(before.users);
    expect(after.clients).toEqual(before.clients);
    // only new clients got step rows; every earlier step row is identical (KS: the data step never touches them)
    expect(after.steps.filter((s) => before.steps.some((b) => b.clientId === s.clientId && b.step === s.step))).toEqual(before.steps);
    const [step] = await h.deps.db.select().from(systemState).where(eq(systemState.key, 'data.tulaj1119'));
    expect(step).toBeTruthy();
    const lines = readFileSync(credFile, 'utf8').split('\n').filter(Boolean);
    expect(lines.length).toBe(credLinesBefore + 2);
    expect(lines.slice(-2).map((l) => l.split(';').slice(0, 2).join(';'))).toEqual(['ugyfel;marika.kiss@demo.kezjegy.test', 'ugyfel;david.molnar@demo.kezjegy.test']);
    const n = async () => (await h.deps.db.select({ n: sql<number>`count(*)::int` }).from(assistRequests))[0]!.n;
    const c1 = await n();
    expect(c1).toBe(3);
    expect((await seedTulaj1119(h.deps, { credentialsFile: credFile })).status).toBe('exists');
    expect(await n()).toBe(c1);
    const [, email, password] = lines.at(-2)!.split(';');
    const m = await h.json('POST', '/auth/login', { body: { email, password, clientKind: 'native' }, headers: { 'x-forwarded-for': '10.7.7.1' } });
    expect(m.status).toBe(200);
    const st = await h.json('GET', '/client/onboarding', { token: m.body.accessToken });
    expect(st.body.journey.variant).toBe('inditas_segitett');
    expect(st.body.journey.currentKey).toBe('meghatalmazas');
    expect(st.body.assists[0]).toMatchObject({ kind: 'vallalkozas_bejelentes', status: 'meghatalmazas_bekuldve' });
    expect(st.body.assists[0].approval.daysLeft).toBe(2);
    const g = await h.json('GET', '/client/guides/meghatalmazas_jovahagyas', { token: m.body.accessToken });
    expect(g.status).toBe(200);
  });
});

describe('round-2 tax BLOCKER T1 – revenue that lands in an already approved quarter (SPEC §27.11 T1)', () => {
  // Reproduction of k3_kor2 adó-és-nyelv finding 1 (Kata): an item of 1 000 000 Ft received on 2026-09-20 is added
  // after Q3 was approved. Correct (NAV 100. füzet 4., 6.1): the difference is picked up by the next open quarter, so
  // the Q4 estimate grows (SZJA alone + 82 500 Ft). Fixed 2026-11-19 by the integrator: kod/ado-motor year.ts takes the
  // approved quarters' sums as fixed priors (YearInput.approvedQuarters) and backend tax.ts approvedQuarterActuals() feeds them.
  it('Kata: +1 000 000 Ft dated 2026-09-20 after the Q3 approval raises the Q4 estimate', async () => {
    // fresh tokens: the 'demo jelszócsere' case above rotated the 5 demo passwords and ended their sessions
    const { rotateDemoPasswords } = await import('../src/seed/demo.js');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const rotFile = join(mkdtempSync(join(tmpdir(), 'kj-t1-')), 'demo_belepesek.txt');
    expect(await rotateDemoPasswords(h.deps, { credentialsFile: rotFile })).toBe(5);
    const login = async (who: string, kind: 'native' | 'panel', ip: string): Promise<string> => {
      const l = readFileSync(rotFile, 'utf8').split('\n').find((x) => x.includes(`;${who}@`))!;
      const [, email, password] = l.trim().split(';');
      const r = await h.json('POST', '/auth/login', { body: { email, password, clientKind: kind }, headers: { 'x-forwarded-for': ip } });
      expect(r.status).toBe(200);
      return r.body.accessToken as string;
    };
    const t = await login('kata.szabo', 'native', '10.5.6.1');
    const acc = await login('bence.kovacs', 'panel', '10.5.6.2');
    const [kata] = await h.deps.db.select({ id: clients.id }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, 'kata.szabo@demo.kezjegy.test')).limit(1);
    const h0 = await h.json('GET', '/client/home', { token: t });
    expect(h0.status).toBe(200);
    const before = h0.body.hero.amountHuf as number;
    const add = await h.json('POST', `/acc/clients/${kata!.id}/revenue-items`, { token: acc, body: { receivedOn: '2026-09-20', amountHuf: 1_000_000, description: 'Késve rögzített számla (T1 próba)' } });
    expect(add.status).toBe(201);
    const after = (await h.json('GET', '/client/home', { token: t })).body.hero.amountHuf as number;
    expect(after - before).toBeGreaterThanOrEqual(82_500);
  });
});
