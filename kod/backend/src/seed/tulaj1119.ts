// Idempotent DEMO addition for the owner orders of 2026-11-19 (SPEC §27.7.4). NEVER a reseed:
//   - refuses APP_ENV=production; needs the base demo (Kovács Bence, Nagy Anna) and migrations 0011 + 0012;
//   - runs the one-time data step first (idempotent), then adds three "Intézzük helyetted" cases:
//       Kiss Marika   (login) new business, assisted: UJEGYKE filed yesterday, waits for her ONYA approval
//       Molnár Dávid  (login) existing business: meghatalmazás request agreed, the ball is on Bence
//       Balogh Ilona  (no login) new business: asked for it, waits for our call
//   - marker system_state['seed.tulaj1119'] + an existence check per e-mail → a second run changes nothing;
//   - never changes an existing user or client row (alex@, tulaj@ and the other demo clients are not touched);
//   - passwords are random, APPENDED only to SEED_CREDENTIALS_FILE (mode 600), never printed or logged.
// `npm run seed:tulaj1119` (dist: node dist/seed/tulaj1119.js); deploy wrapper: kod/deploy/seed-tulaj1119.sh.
import { randomBytes } from 'node:crypto';
import { appendFile, chmod, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { BusinessRegistrationAnswers } from '../_shared/api.js';
import { BUSINESS_ACTIVITIES, maskHuPhone } from '../_shared/bekotes.js';
import { ASSIST_CHECK_ITEMS, ASSIST_CHECK_NOT_FOR_MH, ASSIST_RULES, CALLBACK_TOPIC_LABELS } from '../_shared/enums.js';
import { ConfigError, loadConfig } from '../config.js';
import { openPg } from '../db/client.js';
import type { Deps } from '../deps.js';
import { buildDeps } from '../deps.js';
import { accountants, assistRequests, businessRegistrations, callbackAttempts, callbackRequests, clients, consents, notifications, onboardingSteps, systemState, teamMembers, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { hmacHex } from '../lib/crypto.js';
import { addDays, huDayMonthIg, todayBudapest } from '../lib/dates.js';
import { hashPassword } from '../lib/password.js';
import { createLogger, log, safeErr, setLogger } from '../log.js';
import { notify } from '../notify/notify.js';
import { dueText } from '../services/callbacks.js';
import { runDataStepTulaj1119 } from '../services/datastep.js';
import { fakeAdoazonosito } from './tulaj1118.js';

export const SEED_KEY_1119 = 'seed.tulaj1119';
const DOMAIN = 'demo.kezjegy.test';
const PHONE_AAD = 'callback_requests.phone';
const pw = () => randomBytes(15).toString('base64url'); // 20 characters

function act(key: string, main: boolean) {
  const d = BUSINESS_ACTIVITIES.find((x) => x.key === key)!;
  return { key: d.key, label: d.label, main, ovtjKod: d.ovtjKod, navKereso: d.navKereso };
}

async function userByEmail(deps: Deps, email: string) {
  const [u] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? null;
}

export interface SeedTulaj1119Result {
  status: 'seeded' | 'exists';
  created: string[];
}

export async function seedTulaj1119(deps: Deps, o: { credentialsFile: string }): Promise<SeedTulaj1119Result> {
  if (deps.cfg.appEnv === 'production') throw new Error('APP_ENV=production: a demó kiegészítés éles rendszeren nem fut.');
  const [marker] = await deps.db.select().from(systemState).where(eq(systemState.key, SEED_KEY_1119)).limit(1);
  if (marker) return { status: 'exists', created: [] };
  const [bence] = await deps.db
    .select({ a: accountants })
    .from(accountants)
    .innerJoin(users, eq(users.id, accountants.userId))
    .where(eq(users.email, `bence.kovacs@${DOMAIN}`))
    .limit(1);
  if (!bence) throw new Error('Nincs meg a demó könyvelő (Kovács Bence). Előbb az alap demó adatok kellenek.');
  const annaId = await userByEmail(deps, `anna.nagy@${DOMAIN}`);
  await runDataStepTulaj1119(deps);
  const now = deps.now();
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600_000);
  const created: string[] = [];
  const lines: string[] = [];
  const mailOff = { noEmail: true, noPush: true } as const;
  const versions = deps.legal.versions();
  const tick = (items: readonly string[], by: string, hoursAgo: number) => Object.fromEntries(items.map((i) => [i, { at: at(hoursAgo).toISOString(), by }]));

  async function newClient(p: { email: string; first: string; last: string; phone: string; zip: string; city: string; line: string; idSeed: number; login: boolean; path: 'van' | 'inditas'; adoszam?: string }) {
    const password = pw();
    const [u] = await deps.db
      .insert(users)
      .values({ email: p.email, role: 'client', displayName: `${p.last} ${p.first}`, passwordHash: p.login ? await hashPassword(password) : null, emailVerifiedAt: at(80), createdAt: at(80) })
      .returning({ id: users.id });
    const adoJel = fakeAdoazonosito(p.idSeed);
    const [cl] = await deps.db
      .insert(clients)
      .values({
        userId: u!.id,
        accountantId: bence!.a.id,
        lifecycle: 'bekotes_alatt',
        businessStatus: p.path,
        businessStatusChangedAt: at(79),
        firstName: p.first,
        lastName: p.last,
        phoneEnc: deps.data.enc(p.phone, 'clients.phone'),
        adoazonositoJelEnc: deps.data.enc(adoJel, 'clients.adoazonosito_jel'),
        adoazonositoHmac: hmacHex(deps.lookupKey, adoJel),
        adoazonositoLast3: adoJel.slice(-3),
        addressZip: p.zip,
        addressCity: p.city,
        addressLine: p.line,
        ...(p.adoszam ? { adoszam: p.adoszam, hqMunicipality: p.city, activityText: 'Weboldal-készítés', activityAnswer: 'egyeb' as const, evSince: '2023-04-03', previousAccountant: 'Minta Könyvelő Kft.', hasSeparateBusinessAccount: true } : {}),
        nextFlags: ['bekotes_alatt'],
        createdAt: at(80),
      })
      .returning({ id: clients.id, userId: clients.userId });
    if (p.login) lines.push(`ugyfel;${p.email};${password}`);
    return cl!;
  }
  async function stepsFor(clientId: string, st: Record<string, 'kesz' | 'ugyfelre_var' | 'konyvelore_var' | 'nincs_kezdve'>, data: Record<string, Record<string, unknown>> = {}) {
    for (const [step, status] of Object.entries(st)) {
      await deps.db
        .insert(onboardingSteps)
        .values({ clientId, step: step as 'fiok', status, completedAt: status === 'kesz' ? at(70) : null, updatedAt: at(30), data: data[step] ?? null })
        .onConflictDoNothing();
    }
  }
  async function callback(p: { clientId: string; userId: string; name: string; phone: string; hoursAgo: number; topic: 'vallalkozas_bejelentes_helyettem' | 'meghatalmazas_helyettem'; source: 'helyettunk_vallalkozas' | 'helyettunk_meghatalmazas'; note: string; done?: { by: string; summary: string; hoursAgo: number } }) {
    const createdAt = at(p.hoursAgo);
    const [row] = await deps.db
      .insert(callbackRequests)
      .values({
        clientId: p.clientId,
        createdByUserId: p.userId,
        createdByRole: 'client',
        status: p.done ? 'teljesitve' : 'uj',
        topic: p.topic,
        source: p.source,
        callWindow: 'barmikor',
        note: p.note,
        phoneEnc: deps.data.enc(p.phone, PHONE_AAD),
        phoneMasked: maskHuPhone(p.phone),
        targetAt: new Date(createdAt.getTime() + 24 * 3600_000),
        dueAt: new Date(createdAt.getTime() + deps.cfg.callbackDueHours * 3600_000),
        createdAt,
        updatedAt: createdAt,
        ...(p.done
          ? { assignedUserId: p.done.by, assignedAt: at(p.done.hoursAgo + 1), attempts: 1, lastAttemptAt: at(p.done.hoursAgo), lastOutcome: 'beszeltunk' as const, closedAt: at(p.done.hoursAgo), closedBy: p.done.by, summaryForClient: p.done.summary }
          : {}),
      })
      .returning();
    if (p.done) await deps.db.insert(callbackAttempts).values({ callbackId: row!.id, byUserId: p.done.by, at: at(p.done.hoursAgo), outcome: 'beszeltunk' });
    await audit(deps.db, { action: 'callback.created', actorUserId: p.userId, actorRole: 'client', targetType: 'callback', targetId: row!.id, clientId: p.clientId, details: { topic: p.topic, source: p.source, seed: SEED_KEY_1119 } });
    if (!p.done) for (const u of await staffQueue(deps)) await notify(deps, deps.db, { userId: u, kind: 'callback_new', params: { clientName: p.name, topicLabel: CALLBACK_TOPIC_LABELS[p.topic], dueText: dueText(row!.dueAt, now) }, link: `/visszahivasok?id=${row!.id}`, data: { clientId: p.clientId, callbackId: row!.id }, ...mailOff });
    return row!;
  }

  // ---------- 1. Kiss Marika – new business, "Intézzük helyetted", UJEGYKE filed yesterday ----------
  if (!(await userByEmail(deps, `marika.kiss@${DOMAIN}`))) {
    const cl = await newClient({ email: `marika.kiss@${DOMAIN}`, first: 'Marika', last: 'Kiss', phone: '+36305550199', zip: '3530', city: 'Miskolc', line: 'Próba utca 12.', idSeed: 16180339, login: true, path: 'inditas' });
    for (const t of ['aszf', 'adatkezeles', 'megbizasi_szerzodes'] as const) await deps.db.insert(consents).values({ userId: cl.userId, docType: t, version: versions[t] ?? 'ismeretlen', acceptedAt: at(40) });
    const filedAt = at(24);
    await stepsFor(
      cl.id,
      { fiok: 'kesz', adatok: 'kesz', szerzodes: 'kesz', vallalkozas_inditas: 'ugyfelre_var', meghatalmazas: 'ugyfelre_var', azonositas: 'ugyfelre_var', elofizetes: 'ugyfelre_var', nav_bekotes: 'nincs_kezdve' },
      { meghatalmazas: { method: 'onya_konyvelo', submittedAt: at(46).toISOString() } },
    );
    const answers: BusinessRegistrationAnswers = {
      declarations: { noExclusion: true, singleBusiness: true, acceptedAt: at(50).toISOString() },
      revenueBand: 'max_12m',
      activities: [act('takaritas', true)],
      activityFreeText: null,
      seat: { kind: 'lakcim', address: null, right: null, provider: null },
      otherSites: [],
      workKind: 'fofoglalkozas',
      euPartner: 'nem',
      startPlan: 'mielobb',
      startDate: null,
      hasSeparateBusinessAccount: true,
    };
    const [reg] = await deps.db
      .insert(businessRegistrations)
      .values({ clientId: cl.id, status: 'utmutato', mode: 'segitett', statusChangedAt: at(45), answers, submittedAt: at(45), createdAt: at(52), updatedAt: at(45) })
      .returning({ id: businessRegistrations.id });
    const anna = annaId ?? bence!.a.userId;
    const cb = await callback({
      clientId: cl.id,
      userId: cl.userId,
      name: 'Kiss Marika',
      phone: '+36305550199',
      hoursAgo: 52,
      topic: 'vallalkozas_bejelentes_helyettem',
      source: 'helyettunk_vallalkozas',
      note: 'Szeretném, ha ti intéznétek a bejelentést.',
      done: { by: anna, summary: 'Megbeszéltük: Bence beküldi a meghatalmazást, te jóváhagyod az ONYA-ban.', hoursAgo: 47 },
    });
    const dueOn = addDays(todayBudapest(filedAt), ASSIST_RULES.shownApprovalDays);
    const [as] = await deps.db
      .insert(assistRequests)
      .values({
        clientId: cl.id,
        kind: 'vallalkozas_bejelentes',
        status: 'meghatalmazas_bekuldve',
        statusChangedAt: filedAt,
        callbackId: cb.id,
        registrationId: reg!.id,
        createdByRole: 'client',
        createdByUserId: cl.userId,
        agreedAt: at(46),
        agreedBy: anna,
        ujegykeFiledAt: filedAt,
        ujegykeFiledBy: bence!.a.userId,
        ujegykeJogcim: deps.cfg.assist.ujegykeJogcim,
        approvalDueOn: dueOn,
        approvalExpiresAt: new Date(filedAt.getTime() + ASSIST_RULES.navApprovalDays * 86_400_000),
        approvalReminders: 1,
        lastReminderAt: filedAt,
        checklist: { ...tick(ASSIST_CHECK_ITEMS.hivas, anna, 46), ...tick(ASSIST_CHECK_ITEMS.ujegyke, bence!.a.userId, 24) },
        createdAt: at(52),
        updatedAt: filedAt,
      })
      .returning({ id: assistRequests.id });
    for (const [action, by, h] of [
      ['created', cl.userId, 52],
      ['agreed', anna, 46],
      ['ujegyke_filed', bence!.a.userId, 24],
    ] as const)
      await audit(deps.db, { action: `assist.${action}`, actorUserId: by, actorRole: action === 'created' ? 'client' : action === 'agreed' ? 'csapat' : 'accountant', targetType: 'assist', targetId: as!.id, clientId: cl.id, details: { kind: 'vallalkozas_bejelentes', seed: SEED_KEY_1119, hoursAgo: h } });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'assist_started', params: { firstName: bence!.a.firstName }, link: '/bekotes', ...mailOff });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'assist_mh_filed', params: { firstName: bence!.a.firstName, hatarido: huDayMonthIg(dueOn) }, link: '/bekotes/meghatalmazas/jovahagyas', data: { assistId: as!.id }, ...mailOff });
    created.push('marika');
  }

  // ---------- 2. Molnár Dávid – existing business, meghatalmazás request agreed (ball on Bence) ----------
  if (!(await userByEmail(deps, `david.molnar@${DOMAIN}`))) {
    const cl = await newClient({ email: `david.molnar@${DOMAIN}`, first: 'Dávid', last: 'Molnár', phone: '+36705550123', zip: '7621', city: 'Pécs', line: 'Kitalált tér 4.', idSeed: 14142135, login: true, path: 'van', adoszam: '12345676-1-02' });
    for (const t of ['aszf', 'adatkezeles', 'megbizasi_szerzodes'] as const) await deps.db.insert(consents).values({ userId: cl.userId, docType: t, version: versions[t] ?? 'ismeretlen', acceptedAt: at(30) });
    const anna = annaId ?? bence!.a.userId;
    await stepsFor(
      cl.id,
      { fiok: 'kesz', adatok: 'kesz', szerzodes: 'kesz', meghatalmazas: 'konyvelore_var', azonositas: 'ugyfelre_var', elofizetes: 'ugyfelre_var', nav_bekotes: 'nincs_kezdve' },
      { meghatalmazas: { method: 'onya_konyvelo', submittedAt: at(5).toISOString() } },
    );
    const cb = await callback({
      clientId: cl.id,
      userId: cl.userId,
      name: 'Molnár Dávid',
      phone: '+36705550123',
      hoursAgo: 26,
      topic: 'meghatalmazas_helyettem',
      source: 'helyettunk_meghatalmazas',
      note: 'Inkább ti küldjétek be.',
      done: { by: anna, summary: 'Megbeszéltük: Bence beküldi a meghatalmazást, te az ONYA-ban jóváhagyod.', hoursAgo: 5 },
    });
    const items = ASSIST_CHECK_ITEMS.hivas.filter((i) => !ASSIST_CHECK_NOT_FOR_MH.includes(i));
    const [as] = await deps.db
      .insert(assistRequests)
      .values({ clientId: cl.id, kind: 'meghatalmazas', status: 'egyeztetve', statusChangedAt: at(5), callbackId: cb.id, createdByRole: 'client', createdByUserId: cl.userId, agreedAt: at(5), agreedBy: anna, checklist: tick(items, anna, 5), createdAt: at(26), updatedAt: at(5) })
      .returning({ id: assistRequests.id });
    await audit(deps.db, { action: 'assist.created', actorUserId: cl.userId, actorRole: 'client', targetType: 'assist', targetId: as!.id, clientId: cl.id, details: { kind: 'meghatalmazas', seed: SEED_KEY_1119 } });
    await audit(deps.db, { action: 'assist.agreed', actorUserId: anna, actorRole: 'csapat', targetType: 'assist', targetId: as!.id, clientId: cl.id, details: { kind: 'meghatalmazas', seed: SEED_KEY_1119 } });
    await notify(deps, deps.db, { userId: bence!.a.userId, kind: 'assist_task', variant: 'ujegyke', params: { clientName: 'Molnár Dávid', ugycsoportok: 'ADÓÜGYEK (kivéve egyes jövedéki ügyek); Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)' }, link: '/helyettunk', data: { clientId: cl.id }, ...mailOff });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'assist_started', params: { firstName: bence!.a.firstName }, link: '/bekotes', ...mailOff });
    created.push('david');
  }

  // ---------- 3. Balogh Ilona – no login, asked for it, waits for our call ----------
  if (!(await userByEmail(deps, `ilona.balogh@${DOMAIN}`))) {
    const cl = await newClient({ email: `ilona.balogh@${DOMAIN}`, first: 'Ilona', last: 'Balogh', phone: '+36205550161', zip: '4025', city: 'Debrecen', line: 'Képzelt utca 7.', idSeed: 17320508, login: false, path: 'inditas' });
    await stepsFor(cl.id, { fiok: 'kesz', adatok: 'kesz', vallalkozas_inditas: 'ugyfelre_var', szerzodes: 'ugyfelre_var', meghatalmazas: 'ugyfelre_var', azonositas: 'ugyfelre_var', elofizetes: 'ugyfelre_var', nav_bekotes: 'nincs_kezdve' });
    const [reg] = await deps.db.insert(businessRegistrations).values({ clientId: cl.id, status: 'kitoltes', mode: 'segitett', statusChangedAt: at(6), answers: {}, createdAt: at(6), updatedAt: at(6) }).returning({ id: businessRegistrations.id });
    const cb = await callback({ clientId: cl.id, userId: cl.userId, name: 'Balogh Ilona', phone: '+36205550161', hoursAgo: 6, topic: 'vallalkozas_bejelentes_helyettem', source: 'helyettunk_vallalkozas', note: 'Nem értek a számítógéphez, intézzék helyettem.' });
    const [as] = await deps.db
      .insert(assistRequests)
      .values({ clientId: cl.id, kind: 'vallalkozas_bejelentes', status: 'visszahivas_kerve', statusChangedAt: at(6), callbackId: cb.id, registrationId: reg!.id, createdByRole: 'client', createdByUserId: cl.userId, createdAt: at(6), updatedAt: at(6) })
      .returning({ id: assistRequests.id });
    await audit(deps.db, { action: 'assist.created', actorUserId: cl.userId, actorRole: 'client', targetType: 'assist', targetId: as!.id, clientId: cl.id, details: { kind: 'vallalkozas_bejelentes', seed: SEED_KEY_1119 } });
    created.push('ilona');
  }

  // Seeded notifications are demo history: never send them (in-app only).
  await deps.db
    .update(notifications)
    .set({ pushSentAt: now, emailSentAt: now })
    .where(sql`(${notifications.pushSentAt} is null or ${notifications.emailSentAt} is null) and ${notifications.kind} in ('callback_new', 'assist_started', 'assist_mh_filed', 'assist_task')`);

  if (lines.length) {
    await mkdir(dirname(o.credentialsFile), { recursive: true });
    await appendFile(o.credentialsFile, `${lines.join('\n')}\n`, { mode: 0o600 });
    await chmod(o.credentialsFile, 0o600).catch(() => undefined);
  }
  await deps.db.insert(systemState).values({ key: SEED_KEY_1119, value: { at: now.toISOString(), created } }).onConflictDoNothing();
  void and;
  void inArray;
  void teamMembers;
  return { status: 'seeded', created };
}

/** Active team members and admins (the queue owners), as user ids. */
async function staffQueue(deps: Deps): Promise<string[]> {
  const rows = await deps.db
    .select({ id: users.id, role: users.role, active: teamMembers.active })
    .from(users)
    .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
    .where(and(inArray(users.role, ['csapat', 'admin']), eq(users.status, 'active')));
  return rows.filter((r) => r.role === 'admin' || r.active).map((r) => r.id);
}

async function main(): Promise<void> {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Beállítási hiba: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
  setLogger(createLogger(cfg.logLevel));
  if (cfg.appEnv === 'production') {
    console.error('APP_ENV=production: a demó kiegészítés éles rendszeren nem fut.');
    process.exit(2);
  }
  const handle = await openPg(cfg.databaseUrl);
  try {
    const ok = await handle.db.execute(sql`select to_regclass('public.assist_requests') is not null as ok`);
    if (!(ok as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok) {
      console.error('A 0012-es migráció még nem futott le. Előbb a migráció (kezjegy-migrate), utána ez.');
      process.exit(2);
    }
    const deps = buildDeps(cfg, handle.db, { dispatchInline: false });
    await deps.legal.load(null);
    await deps.content.reload();
    const res = await seedTulaj1119(deps, { credentialsFile: cfg.seedCredentialsFile });
    console.log(res.status === 'seeded' ? `Demó kiegészítés kész (${res.created.length} új elem). Belépések: ${cfg.seedCredentialsFile}` : 'A demó kiegészítés már megvan, nem csináltam semmit.');
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    log().fatal({ err: safeErr(err) }, 'seed tulaj1119 failed');
    console.error(`Seed hiba: ${(err as Error).message}`);
    process.exit(1);
  });
}
