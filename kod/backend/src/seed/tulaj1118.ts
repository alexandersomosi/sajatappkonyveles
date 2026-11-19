// Idempotent DEMO addition for the owner orders of 2026-11-18 (SPEC §26.13). NEVER a reseed:
//   - refuses APP_ENV=production; needs the base demo (Kovács Bence) and migration 0009;
//   - runs the one-time data step first (idempotent), then adds: team member Nagy Anna, new-business client Tóth
//     Levente (registration 'beadva'), Fehér Zsófia (no login, registration 'utmutato'), and 4 callbacks in 4 states;
//   - marker system_state['seed.tulaj1118'] + an existence check per e-mail → a second run changes nothing;
//   - never changes an existing user or client row (alex@, tulaj@, Kata, Réka, Péter are only referenced);
//   - passwords are random, APPENDED only to SEED_CREDENTIALS_FILE (mode 600), never printed or logged.
// `npm run seed:tulaj1118` (dist: node dist/seed/tulaj1118.js); deploy wrapper: kod/deploy/seed-tulaj1118.sh.
import { randomBytes } from 'node:crypto';
import { appendFile, chmod, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { BusinessRegistrationAnswers } from '../_shared/api.js';
import { BUSINESS_ACTIVITIES, maskHuPhone } from '../_shared/bekotes.js';
import { CALLBACK_TOPIC_LABELS, GUIDE_STEP_KEYS } from '../_shared/enums.js';
import { dueText } from '../services/callbacks.js';
import { ConfigError, loadConfig } from '../config.js';
import { openPg } from '../db/client.js';
import type { Deps } from '../deps.js';
import { buildDeps } from '../deps.js';
import {
  accountants,
  businessRegistrations,
  callbackAttempts,
  callbackRequests,
  clients,
  consents,
  messages,
  notifications,
  onboardingSteps,
  systemState,
  teamMembers,
  users,
} from '../db/schema.js';
import { audit } from '../audit.js';
import { hmacHex } from '../lib/crypto.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { hashPassword } from '../lib/password.js';
import { markdownToPdf } from '../lib/pdf.js';
import { isValidAdoazonositoJel } from '../lib/validators.js';
import { createLogger, log, safeErr, setLogger } from '../log.js';
import { notify } from '../notify/notify.js';
import { createDocumentFromBuffer } from '../services/system-docs.js';
import { runDataStepTulaj1118 } from '../services/datastep.js';

export const SEED_KEY = 'seed.tulaj1118';
const DOMAIN = 'demo.kezjegy.test';
const PHONE_AAD = 'callback_requests.phone';
const pw = () => randomBytes(15).toString('base64url'); // 20 characters

/** A formally valid, fictional adóazonosító jel derived from a seed number. */
export function fakeAdoazonosito(seed: number): string {
  for (let n = seed; ; n++) {
    const body = `8${String(n).padStart(8, '0').slice(-8)}`;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (i + 1) * Number(body[i]);
    const c = sum % 11;
    if (c !== 10 && isValidAdoazonositoJel(`${body}${c}`)) return `${body}${c}`;
  }
}

function act(key: string, main: boolean) {
  const d = BUSINESS_ACTIVITIES.find((x) => x.key === key)!;
  return { key: d.key, label: d.label, main, ovtjKod: d.ovtjKod, navKereso: d.navKereso };
}

async function userByEmail(deps: Deps, email: string) {
  const [u] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? null;
}

export interface SeedTulaj1118Result {
  status: 'seeded' | 'exists';
  created: string[];
}

export async function seedTulaj1118(deps: Deps, o: { credentialsFile: string }): Promise<SeedTulaj1118Result> {
  if (deps.cfg.appEnv === 'production') throw new Error('APP_ENV=production: a demó kiegészítés éles rendszeren nem fut.');
  const [marker] = await deps.db.select().from(systemState).where(eq(systemState.key, SEED_KEY)).limit(1);
  if (marker) return { status: 'exists', created: [] };
  const [bence] = await deps.db
    .select({ a: accountants })
    .from(accountants)
    .innerJoin(users, eq(users.id, accountants.userId))
    .where(eq(users.email, `bence.kovacs@${DOMAIN}`))
    .limit(1);
  if (!bence) throw new Error('Nincs meg a demó könyvelő (Kovács Bence). Előbb az alap demó adatok kellenek.');
  await runDataStepTulaj1118(deps);
  const now = deps.now();
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600_000);
  const today = todayBudapest(now);
  const created: string[] = [];
  const lines: string[] = [];
  const mailOff = { noEmail: true, noPush: true } as const;

  // ---------- 1. team member Nagy Anna ----------
  let annaId = await userByEmail(deps, `anna.nagy@${DOMAIN}`);
  if (!annaId) {
    const p = pw();
    const [u] = await deps.db
      .insert(users)
      .values({ email: `anna.nagy@${DOMAIN}`, role: 'csapat', displayName: 'Nagy Anna', passwordHash: await hashPassword(p), emailVerifiedAt: now, createdAt: now })
      .returning({ id: users.id });
    annaId = u!.id;
    await deps.db.insert(teamMembers).values({ userId: annaId, displayName: 'Nagy Anna', firstName: 'Anna' });
    await audit(deps.db, { action: 'team.member_invited', actorRole: 'system', targetType: 'user', targetId: annaId, details: { seed: SEED_KEY } });
    lines.push(`csapat;anna.nagy@${DOMAIN};${p}`);
    created.push('anna');
  }

  const versions = deps.legal.versions();
  async function newClient(p: { email: string; first: string; last: string; phone: string; zip: string; city: string; line: string; idSeed: number; login: boolean }) {
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
        businessStatus: 'inditas',
        firstName: p.first,
        lastName: p.last,
        phoneEnc: deps.data.enc(p.phone, 'clients.phone'),
        adoazonositoJelEnc: deps.data.enc(adoJel, 'clients.adoazonosito_jel'),
        adoazonositoHmac: hmacHex(deps.lookupKey, adoJel),
        adoazonositoLast3: adoJel.slice(-3),
        addressZip: p.zip,
        addressCity: p.city,
        addressLine: p.line,
        nextFlags: ['bekotes_alatt'],
        createdAt: at(80),
      })
      .returning({ id: clients.id, userId: clients.userId });
    if (p.login) lines.push(`ugyfel;${p.email};${password}`);
    return cl!;
  }
  async function stepsFor(clientId: string, st: Partial<Record<'fiok' | 'adatok' | 'szerzodes' | 'vallalkozas_inditas' | 'meghatalmazas' | 'azonositas' | 'elofizetes' | 'nav_bekotes', 'kesz' | 'ugyfelre_var' | 'konyvelore_var' | 'nincs_kezdve'>>) {
    for (const [step, status] of Object.entries(st)) {
      await deps.db
        .insert(onboardingSteps)
        .values({ clientId, step: step as 'fiok', status: status!, completedAt: status === 'kesz' ? at(70) : null, updatedAt: at(48) })
        .onConflictDoNothing();
    }
  }

  // ---------- 2. new-business client Tóth Levente (registration 'beadva') ----------
  let leventeClient: { id: string; userId: string } | null = null;
  if (!(await userByEmail(deps, `levente.toth@${DOMAIN}`))) {
    const cl = await newClient({ email: `levente.toth@${DOMAIN}`, first: 'Levente', last: 'Tóth', phone: '+36305550142', zip: '6720', city: 'Szeged', line: 'Minta utca 3.', idSeed: 31415926, login: true });
    leventeClient = cl;
    for (const t of ['aszf', 'adatkezeles', 'megbizasi_szerzodes'] as const) await deps.db.insert(consents).values({ userId: cl.userId, docType: t, version: versions[t] ?? 'ismeretlen', acceptedAt: at(60) });
    await stepsFor(cl.id, { fiok: 'kesz', adatok: 'kesz', szerzodes: 'kesz', vallalkozas_inditas: 'konyvelore_var', meghatalmazas: 'ugyfelre_var', azonositas: 'ugyfelre_var', elofizetes: 'ugyfelre_var', nav_bekotes: 'nincs_kezdve' });
    const answers: BusinessRegistrationAnswers = {
      declarations: { noExclusion: true, singleBusiness: true, acceptedAt: at(72).toISOString() },
      revenueBand: 'max_12m',
      activities: [act('foto', true), act('video', false)],
      activityFreeText: null,
      seat: { kind: 'lakcim', address: null, right: null, provider: null },
      otherSites: [],
      workKind: 'fofoglalkozas',
      euPartner: 'nem',
      startPlan: 'mielobb',
      startDate: null,
      hasSeparateBusinessAccount: true,
    };
    const filedOn = addDays(today, -1);
    const pdf = await markdownToPdf(
      deps.cfg.fontDir,
      'MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS',
      [
        '# MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS',
        '',
        'Ez a dokumentum csak a bemutató változat része. Kitalált adatok, nem hivatalos irat.',
        '',
        '## Egyéni vállalkozói tevékenység bejelentése (minta)',
        '',
        `- Név: Tóth Levente (kitalált)`,
        `- Beküldve: ${filedOn}, Ügyfélkapu+`,
        '- Főtevékenység: Fotózás, képszerkesztés',
        '- Átalányadózás: igen · Alanyi ÁFA-mentesség: igen · Kata: nem · Pénzforgalmi elszámolás: nem',
      ].join('\n'),
    );
    const docId = await createDocumentFromBuffer(deps, deps.db, {
      clientId: cl.id,
      category: 'ev_bejelentes',
      title: 'NAV-igazolás a vállalkozás bejelentéséről',
      month: filedOn.slice(0, 7),
      data: pdf,
      mime: 'application/pdf',
      fileName: 'minta_nav_ertesites.pdf',
      source: 'ugyfel',
      status: 'feltoltve',
      by: cl.userId,
      createdAt: at(20),
    });
    const [reg] = await deps.db
      .insert(businessRegistrations)
      .values({
        clientId: cl.id,
        status: 'beadva',
        statusChangedAt: at(20),
        answers,
        submittedAt: at(48),
        guideOpenedAt: at(47),
        guideProgress: [...GUIDE_STEP_KEYS.vallalkozas_bejelentes],
        filedOn,
        filedChannel: 'ugyfelkapu_plus',
        filedDocumentId: docId,
        filedAt: at(20),
        createdAt: at(72),
        updatedAt: at(20),
      })
      .returning({ id: businessRegistrations.id });
    for (const [action, h] of [
      ['registration.saved', 72],
      ['registration.submitted', 48],
      ['registration.guide_opened', 47],
      ['registration.filed', 20],
    ] as const) {
      await audit(deps.db, { action, actorUserId: cl.userId, actorRole: 'client', targetType: 'business_registration', targetId: reg!.id, clientId: cl.id, details: { seed: SEED_KEY, hoursAgo: h } });
    }
    for (const u of await staffQueue(deps)) {
      await notify(deps, deps.db, { userId: u, kind: 'registration_submitted', params: { clientName: 'Tóth Levente' }, link: `/vallalkozas-inditas/${reg!.id}`, data: { clientId: cl.id, registrationId: reg!.id }, ...mailOff });
    }
    created.push('levente');
  }

  // ---------- 3. Fehér Zsófia (no login; registration 'utmutato' for 4 days) ----------
  let zsofiaClient: { id: string; userId: string } | null = null;
  if (!(await userByEmail(deps, `zsofia.feher@${DOMAIN}`))) {
    const cl = await newClient({ email: `zsofia.feher@${DOMAIN}`, first: 'Zsófia', last: 'Fehér', phone: '+36205550177', zip: '9021', city: 'Győr', line: 'Kitalált köz 8.', idSeed: 27182818, login: false });
    zsofiaClient = cl;
    await stepsFor(cl.id, { fiok: 'kesz', adatok: 'kesz', vallalkozas_inditas: 'ugyfelre_var', szerzodes: 'ugyfelre_var', meghatalmazas: 'ugyfelre_var', azonositas: 'ugyfelre_var', elofizetes: 'ugyfelre_var', nav_bekotes: 'nincs_kezdve' });
    await deps.db.insert(businessRegistrations).values({
      clientId: cl.id,
      status: 'utmutato',
      statusChangedAt: at(96),
      answers: {
        declarations: { noExclusion: true, singleBusiness: true, acceptedAt: at(98).toISOString() },
        revenueBand: '12_20m',
        activities: [act('kozmetika', true)],
        activityFreeText: null,
        seat: { kind: 'lakcim', address: null, right: null, provider: null },
        otherSites: [],
        workKind: 'munkaviszony_mellett',
        euPartner: 'nem',
        startPlan: 'mielobb',
        startDate: null,
        hasSeparateBusinessAccount: null,
      },
      submittedAt: at(96),
      guideOpenedAt: at(96),
      guideProgress: GUIDE_STEP_KEYS.vallalkozas_bejelentes.slice(0, 5),
      createdAt: at(98),
      updatedAt: at(90),
    });
    created.push('zsofia');
  }

  // ---------- 4. callbacks in four states ----------
  async function clientByEmail(email: string) {
    const [x] = await deps.db.select({ c: clients }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, email)).limit(1);
    return x?.c ?? null;
  }
  async function hasOpenCallback(clientId: string) {
    const [x] = await deps.db.select({ id: callbackRequests.id }).from(callbackRequests).where(and(eq(callbackRequests.clientId, clientId), inArray(callbackRequests.status, ['uj', 'folyamatban']))).limit(1);
    return Boolean(x);
  }
  async function hasAnyCallback(clientId: string) {
    const [x] = await deps.db.select({ id: callbackRequests.id }).from(callbackRequests).where(eq(callbackRequests.clientId, clientId)).limit(1);
    return Boolean(x);
  }
  async function cb(p: {
    clientId: string;
    clientName: string;
    userId: string;
    phone: string;
    createdHoursAgo: number;
    topic: 'vallalkozas_inditas' | 'ado_befizetes' | 'egyeb';
    source: 'vallalkozas_utmutato' | 'vallalkozas_adatlap' | 'uzenetek' | 'fiok';
    note?: string;
    status?: 'uj' | 'folyamatban' | 'teljesitve';
  }) {
    const createdAt = at(p.createdHoursAgo);
    const [row] = await deps.db
      .insert(callbackRequests)
      .values({
        clientId: p.clientId,
        createdByUserId: p.userId,
        createdByRole: 'client',
        status: p.status ?? 'uj',
        topic: p.topic,
        source: p.source,
        callWindow: 'barmikor',
        note: p.note ?? null,
        phoneEnc: deps.data.enc(p.phone, PHONE_AAD),
        phoneMasked: maskHuPhone(p.phone),
        targetAt: new Date(createdAt.getTime() + 24 * 3600_000),
        dueAt: new Date(createdAt.getTime() + deps.cfg.callbackDueHours * 3600_000),
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    await audit(deps.db, { action: 'callback.created', actorUserId: p.userId, actorRole: 'client', targetType: 'callback', targetId: row!.id, clientId: p.clientId, details: { topic: p.topic, source: p.source, seed: SEED_KEY } });
    await notify(deps, deps.db, { userId: p.userId, kind: 'callback_received', params: { phoneMasked: row!.phoneMasked }, link: '/visszahivas', ...mailOff });
    for (const u of await staffQueue(deps))
      await notify(deps, deps.db, { userId: u, kind: 'callback_new', params: { clientName: p.clientName, topicLabel: CALLBACK_TOPIC_LABELS[p.topic], dueText: dueText(row!.dueAt, now) }, link: `/visszahivasok?id=${row!.id}`, data: { clientId: p.clientId, callbackId: row!.id }, ...mailOff });
    return row!;
  }

  const lev = leventeClient ?? (await clientByEmail(`levente.toth@${DOMAIN}`));
  if (lev && !(await hasAnyCallback(lev.id))) {
    await cb({ clientId: lev.id, clientName: 'Tóth Levente', userId: lev.userId, phone: '+36305550142', createdHoursAgo: 3, topic: 'vallalkozas_inditas', source: 'vallalkozas_utmutato', note: 'Nem találom, melyik tevékenységet válasszam.' });
    created.push('callback:levente');
  }
  const zso = zsofiaClient ?? (await clientByEmail(`zsofia.feher@${DOMAIN}`));
  if (zso && !(await hasAnyCallback(zso.id))) {
    await cb({ clientId: zso.id, clientName: 'Fehér Zsófia', userId: zso.userId, phone: '+36205550177', createdHoursAgo: 50, topic: 'vallalkozas_inditas', source: 'vallalkozas_utmutato', note: 'Elakadtam az ÁFA-résznél.' });
    created.push('callback:zsofia');
  }
  const reka = await clientByEmail(`reka.varga@${DOMAIN}`);
  if (reka && annaId && !(await hasOpenCallback(reka.id))) {
    const row = await cb({ clientId: reka.id, clientName: 'Varga Réka', userId: reka.userId, phone: '+36209876543', createdHoursAgo: 20, topic: 'ado_befizetes', source: 'fiok', note: 'A harmadik negyedéves befizetésről kérdeznék.' });
    const attemptAt = at(3);
    await deps.db.insert(callbackAttempts).values({ callbackId: row.id, byUserId: annaId, at: attemptAt, outcome: 'nem_vette_fel', note: null });
    await deps.db
      .update(callbackRequests)
      .set({ status: 'folyamatban', assignedUserId: annaId, assignedAt: at(19), attempts: 1, failedAttempts: 1, lastAttemptAt: attemptAt, lastOutcome: 'nem_vette_fel', nextAttemptAfter: new Date(attemptAt.getTime() + 120 * 60_000), updatedAt: attemptAt })
      .where(eq(callbackRequests.id, row.id));
    await audit(deps.db, { action: 'callback.claimed', actorUserId: annaId, actorRole: 'csapat', targetType: 'callback', targetId: row.id, clientId: reka.id, details: { seed: SEED_KEY } });
    await audit(deps.db, { action: 'callback.attempt', actorUserId: annaId, actorRole: 'csapat', targetType: 'callback', targetId: row.id, clientId: reka.id, details: { outcome: 'nem_vette_fel', attempt: 1, status: 'folyamatban', seed: SEED_KEY } });
    await notify(deps, deps.db, { userId: reka.userId, kind: 'callback_missed', params: { when: 'Ma' }, link: '/visszahivas', ...mailOff });
    created.push('callback:reka');
  }
  const kata = await clientByEmail(`kata.szabo@${DOMAIN}`);
  if (kata && annaId) {
    const [already] = await deps.db.select({ id: callbackRequests.id }).from(callbackRequests).where(and(eq(callbackRequests.clientId, kata.id), eq(callbackRequests.status, 'teljesitve'))).limit(1);
    if (!already) {
      const row = await cb({ clientId: kata.id, clientName: 'Szabó Kata', userId: kata.userId, phone: '+36301234567', createdHoursAgo: 48, topic: 'egyeb', source: 'uzenetek', note: 'A jövedelemigazolásról kérdeznék.' });
      const attemptAt = at(24);
      const summary = 'megbeszéltük, hogy a jövedelemigazolás jövő héten elkészül.';
      const [m] = await deps.db
        .insert(messages)
        .values({ clientId: kata.id, senderUserId: annaId, senderRole: 'csapat', kind: 'szoveg', body: `A hívásunk összefoglalója: ${summary}`, readByTeamAt: attemptAt, createdAt: attemptAt })
        .returning({ id: messages.id });
      await deps.db.insert(callbackAttempts).values({ callbackId: row.id, byUserId: annaId, at: attemptAt, outcome: 'beszeltunk' });
      await deps.db
        .update(callbackRequests)
        .set({ status: 'teljesitve', assignedUserId: annaId, assignedAt: at(30), attempts: 1, lastAttemptAt: attemptAt, lastOutcome: 'beszeltunk', closedAt: attemptAt, closedBy: annaId, summaryForClient: summary, summaryMessageId: m!.id, updatedAt: attemptAt })
        .where(eq(callbackRequests.id, row.id));
      await audit(deps.db, { action: 'callback.attempt', actorUserId: annaId, actorRole: 'csapat', targetType: 'callback', targetId: row.id, clientId: kata.id, details: { outcome: 'beszeltunk', attempt: 1, status: 'teljesitve', summary: true, seed: SEED_KEY } });
      await notify(deps, deps.db, { userId: kata.userId, kind: 'callback_done', link: '/uzenetek', ...mailOff });
      created.push('callback:kata');
    }
  }

  // Seeded notifications are demo history: never send them (in-app only).
  await deps.db.update(notifications).set({ pushSentAt: now, emailSentAt: now }).where(sql`(${notifications.pushSentAt} is null or ${notifications.emailSentAt} is null) and ${notifications.kind} in ('callback_received', 'callback_new', 'callback_missed', 'callback_done', 'registration_submitted')`);

  if (lines.length) {
    await mkdir(dirname(o.credentialsFile), { recursive: true });
    await appendFile(o.credentialsFile, `${lines.join('\n')}\n`, { mode: 0o600 });
    await chmod(o.credentialsFile, 0o600).catch(() => undefined);
  }
  await deps.db.insert(systemState).values({ key: SEED_KEY, value: { at: now.toISOString(), created } }).onConflictDoNothing();
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
    const ok = await handle.db.execute(sql`select to_regclass('public.business_registrations') is not null as ok`);
    if (!(ok as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok) {
      console.error('A 0009-es migráció még nem futott le. Előbb a migráció (kezjegy-migrate), utána ez.');
      process.exit(2);
    }
    const deps = buildDeps(cfg, handle.db, { dispatchInline: false });
    await deps.legal.load(null);
    await deps.content.reload();
    const res = await seedTulaj1118(deps, { credentialsFile: cfg.seedCredentialsFile });
    console.log(res.status === 'seeded' ? `Demó kiegészítés kész (${res.created.length} új elem). Belépések: ${cfg.seedCredentialsFile}` : 'A demó kiegészítés már megvan, nem csináltam semmit.');
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    log().fatal({ err: safeErr(err) }, 'seed tulaj1118 failed');
    console.error(`Seed hiba: ${(err as Error).message}`);
    process.exit(1);
  });
}
