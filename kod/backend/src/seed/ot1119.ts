// Idempotent DEMO additions of SPEC §28.11 (seed:ot1119) and §28.K.21 (seed:k28, src/seed/k28.ts). NEVER a reseed:
//   - refuses APP_ENV=production; needs the base demo (Kovács Bence, Nagy Anna) and migrations 0014–0016;
//   - adds new FAKE demo clients only; never changes an existing user or client row (alex@, tulaj@, bence.kovacs@,
//     david@ / Fendrik Dávid are not touched – their reserve and earnings cards appear because they are computed views);
//   - marker system_state['seed.ot1119'] + an existence check per e-mail → a second run changes nothing;
//   - passwords are random, APPENDED only to SEED_CREDENTIALS_FILE (mode 600), never printed or logged.
//     Szabó Eszter  (login) mellékállású, ~600 000 Ft/hó, 2 gyermek, anya → anyák (ket) + családi javasolt
//     Tóth Bálint   (login) főfoglalkozású, 2002-03 → 25 év alattiak jóváhagyva; két mai számla-értesítés
//     Kovács Ádám   (login) székhelyváltozás „Nézd át, mit jelentünk be” (meghatalmazas_el)
//     Varga Réka-Demo (no login) szüneteltetés beküldve, a csapat zárja le
import { randomBytes } from 'node:crypto';
import { appendFile, chmod, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import type { AllowanceAnswers, ChangeData } from '../_shared/api.js';
import { ConfigError, loadConfig } from '../config.js';
import { openPg } from '../db/client.js';
import type { Deps } from '../deps.js';
import { buildDeps } from '../deps.js';
import { accountants, allowanceAnswers, assistRequests, clientAllowances, clients, clientTaxProfiles, navInvoices, notifications, onboardingSteps, revenueItems, systemState, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { hmacHex } from '../lib/crypto.js';
import { todayBudapest } from '../lib/dates.js';
import { markdownToPdf } from '../lib/pdf.js';
import { hashPassword } from '../lib/password.js';
import { createLogger, log, safeErr, setLogger } from '../log.js';
import { notify } from '../notify/notify.js';
import { runDataStepK28, runDataStepOt1119 } from '../services/datastep-k28.js';
import { proposeAllowances } from '../services/kedvezmeny.js';
import { ensureReserves } from '../services/felretesz.js';
import { createDocumentFromBuffer } from '../services/system-docs.js';
import { ensurePeriods, recalcYear } from '../services/tax.js';
import { fakeAdoazonosito } from './tulaj1118.js';

export const SEED_KEY_OT1119 = 'seed.ot1119';
export const DOMAIN = 'demo.kezjegy.test';
const pw = () => randomBytes(15).toString('base64url');

export interface SeedCtx {
  deps: Deps;
  now: Date;
  bence: { id: string; userId: string };
  lines: string[];
  at: (hoursAgo: number) => Date;
}

export async function seedContext(deps: Deps): Promise<SeedCtx> {
  if (deps.cfg.appEnv === 'production') throw new Error('APP_ENV=production: a demó kiegészítés éles rendszeren nem fut.');
  const [b] = await deps.db.select({ a: accountants }).from(accountants).innerJoin(users, eq(users.id, accountants.userId)).where(eq(users.email, `bence.kovacs@${DOMAIN}`)).limit(1);
  if (!b) throw new Error('Nincs meg a demó könyvelő (Kovács Bence). Előbb az alap demó adatok kellenek.');
  const now = deps.now();
  return { deps, now, bence: { id: b.a.id, userId: b.a.userId }, lines: [], at: (h) => new Date(now.getTime() - h * 3600_000) };
}

export async function exists(deps: Deps, email: string): Promise<boolean> {
  const [u] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return Boolean(u);
}

/** A new FAKE demo client (active by default) with a 2026 tax profile. */
export async function demoClient(
  ctx: SeedCtx,
  p: { email: string; first: string; last: string; idSeed: number; login: boolean; lifecycle?: 'aktiv' | 'bekotes_alatt'; status?: 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas'; regime?: 'atalany' | 'kata'; path?: 'van' | 'inditas' },
): Promise<{ id: string; userId: string }> {
  const { deps } = ctx;
  const password = pw();
  const [u] = await deps.db
    .insert(users)
    .values({ email: p.email, role: 'client', displayName: `${p.last} ${p.first}`, passwordHash: p.login ? await hashPassword(password) : null, emailVerifiedAt: ctx.at(24 * 300), createdAt: ctx.at(24 * 300) })
    .returning({ id: users.id });
  const adoJel = fakeAdoazonosito(p.idSeed);
  const active = (p.lifecycle ?? 'aktiv') === 'aktiv';
  const [cl] = await deps.db
    .insert(clients)
    .values({
      userId: u!.id,
      accountantId: ctx.bence.id,
      lifecycle: p.lifecycle ?? 'aktiv',
      businessStatus: p.path ?? 'van',
      firstName: p.first,
      lastName: p.last,
      phoneEnc: deps.data.enc('+36 30 555 01' + String(p.idSeed).padStart(2, '0').slice(-2), 'clients.phone'),
      adoazonositoJelEnc: deps.data.enc(adoJel, 'clients.adoazonosito_jel'),
      adoazonositoHmac: hmacHex(deps.lookupKey, adoJel),
      adoazonositoLast3: adoJel.slice(-3),
      addressZip: '1137',
      addressCity: 'Budapest',
      addressLine: 'Minta utca 1.',
      ...(active ? { adoszam: `6${String(8000000 + p.idSeed).slice(-7)}-1-41`, hqMunicipality: 'Budapest', activityText: 'Grafikai tervezés', activityAnswer: 'egyeb' as const, evSince: '2022-03-01', hasSeparateBusinessAccount: true } : {}),
      nextFlags: [],
      createdAt: ctx.at(24 * 300),
    })
    .returning({ id: clients.id, userId: clients.userId });
  if (active) {
    for (const step of ['fiok', 'adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'] as const)
      await deps.db.insert(onboardingSteps).values({ clientId: cl!.id, step, status: 'kesz', completedAt: ctx.at(24 * 280) }).onConflictDoNothing();
    await deps.db.insert(clientTaxProfiles).values({ clientId: cl!.id, year: 2026, costRatio: 45, costRatioSource: 'konyvelo_megerositette', status: p.status ?? 'fofoglalkozasu', hipaMethod: 'savos', regime: p.regime ?? 'atalany', ...(p.regime === 'kata' ? { kataFrom: '2026-01-01' } : {}) }).onConflictDoNothing();
    await ensurePeriods(deps.db, cl!.id, 2026, 'savos', p.status ?? 'fofoglalkozasu');
  }
  if (p.login) ctx.lines.push(`ugyfel;${p.email};${password}`);
  return cl!;
}

/** Fake issued invoices (demo NAV rows + their revenue items). */
export async function demoInvoices(ctx: SeedCtx, clientId: string, list: { n: string; date: string; amount: number; customer: string | null; vat: 'DOMESTIC' | 'PRIVATE_PERSON' | 'OTHER'; createdAt?: Date }[]): Promise<string[]> {
  const ids: string[] = [];
  for (const x of list) {
    const [row] = await ctx.deps.db
      .insert(navInvoices)
      .values({
        clientId,
        invoiceNumber: x.n,
        operation: 'CREATE',
        category: 'NORMAL',
        issueDate: x.date,
        deliveryDate: x.date,
        paymentMethod: 'TRANSFER',
        paymentDate: x.date,
        netHuf: x.amount,
        vatHuf: 0,
        grossHuf: x.amount,
        customerName: x.customer,
        customerTaxNumber: x.vat === 'DOMESTIC' ? '12345678' : null,
        customerVatStatus: x.vat,
        dossierMonth: x.date.slice(0, 7),
        demo: true,
        notifyState: x.createdAt ? 'kuldve' : 'kihagyva_regi',
        createdAt: x.createdAt ?? new Date(`${x.date}T09:00:00Z`),
      })
      .onConflictDoNothing()
      .returning({ id: navInvoices.id });
    if (!row) continue;
    ids.push(row.id);
    await ctx.deps.db.insert(revenueItems).values({
      clientId,
      source: 'nav_szamla',
      navInvoiceId: row.id,
      receivedOn: x.date,
      deliveryDate: x.date,
      amountHuf: x.amount,
      description: `${x.n}${x.customer ? ` – ${x.customer}` : ''}`,
      payerKind: x.vat === 'PRIVATE_PERSON' ? 'maganszemely' : x.vat === 'DOMESTIC' ? 'kifizeto' : 'kulfoldi_kifizeto',
      createdAt: x.createdAt ?? new Date(`${x.date}T09:00:00Z`),
    });
  }
  return ids;
}

export async function writeCredentials(file: string, lines: string[]): Promise<void> {
  if (!lines.length) return;
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  await chmod(file, 0o600).catch(() => undefined);
}

const kid = { potlek: 'most' as const, sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null };
const noAnswers: AllowanceAnswers = { birthMonth: null, children: [], otherDependants: 0, pregnancy: null, mother: null, csaladiWho: null, csaladiSharePct: null, csjkWish: null, marriage: null, disability: null, benefit: null, healthConsent: false, note: null };

async function submittedAllowances(ctx: SeedCtx, clientId: string, answers: AllowanceAnswers, status: 'fofoglalkozasu' | 'mellekallasu', approve: string[] = []): Promise<void> {
  const { deps } = ctx;
  await deps.db.insert(allowanceAnswers).values({ clientId, year: 2026, gate: 'lehet', answers, version: 1, submittedAt: ctx.at(30), createdAt: ctx.at(31), updatedAt: ctx.at(30) }).onConflictDoNothing();
  for (const p of proposeAllowances(answers, 2026, status)) {
    const ok = approve.includes(p.kind);
    await deps.db
      .insert(clientAllowances)
      .values({ clientId, year: 2026, kind: p.kind, status: ok ? 'jovahagyva' : 'javasolt', months: p.months, params: p.params, inYear: true, proposal: { months: p.months, params: p.params, reasons: p.reasons, warnings: p.warnings }, answersVersion: 1, ...(ok ? { decidedBy: ctx.bence.userId, decidedAt: ctx.at(20) } : {}), createdAt: ctx.at(30), updatedAt: ctx.at(20) })
      .onConflictDoNothing();
  }
}

export interface SeedResult {
  status: 'seeded' | 'exists';
  created: string[];
}

export async function seedOt1119(deps: Deps, o: { credentialsFile: string }): Promise<SeedResult> {
  const [marker] = await deps.db.select().from(systemState).where(eq(systemState.key, SEED_KEY_OT1119)).limit(1);
  if (marker) return { status: 'exists', created: [] };
  const ctx = await seedContext(deps);
  await runDataStepOt1119(deps);
  await runDataStepK28(deps);
  const created: string[] = [];
  const today = todayBudapest(ctx.now);
  const months = Number(today.slice(5, 7));

  // 1. Szabó Eszter – mellékállású, 2 children, mother → anyák (ket) + családi (50 %) javasolt
  if (!(await exists(deps, `eszter.szabo@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `eszter.szabo@${DOMAIN}`, first: 'Eszter', last: 'Szabó', idSeed: 81, login: true, status: 'mellekallasu' });
    const customers: [string | null, 'DOMESTIC' | 'PRIVATE_PERSON'][] = [['Bodza Kiadó Kft.', 'DOMESTIC'], ['Csipke Műhely Bt.', 'DOMESTIC'], [null, 'PRIVATE_PERSON']];
    const inv = [];
    for (let m = 1; m <= months; m++) {
      const d = `2026-${String(m).padStart(2, '0')}-1${m % 9}`;
      if (d > today) continue;
      const [cu, vat] = customers[m % 3]!;
      inv.push({ n: `ESZ-2026-${String(m).padStart(3, '0')}`, date: d, amount: 560_000 + (m % 4) * 30_000, customer: cu, vat });
    }
    await demoInvoices(ctx, cl.id, inv);
    await submittedAllowances(ctx, cl.id, { ...noAnswers, birthMonth: '1990-04', children: [kid, kid], mother: true, csaladiWho: 'kozosen', csaladiSharePct: 50, csjkWish: 'konyvelo_donti' }, 'mellekallasu');
    await notify(deps, deps.db, { userId: ctx.bence.userId, kind: 'allowance_submitted', params: { clientName: 'Szabó Eszter', n: 2 }, link: `/ugyfelek/${cl.id}?tab=kedvezmenyek` });
    await recalcYear(deps, deps.db, cl.id, 2026);
    await ensureReserves(deps, deps.db, cl.id, 2026);
    created.push('eszter');
  }

  // 2. Tóth Bálint – főfoglalkozású, born 2002-03 → 25 év alattiak approved; two notifications of today
  if (!(await exists(deps, `balint.toth@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `balint.toth@${DOMAIN}`, first: 'Bálint', last: 'Tóth', idSeed: 82, login: true, status: 'fofoglalkozasu' });
    const inv = [];
    for (let m = 1; m <= months; m++) {
      const d = `2026-${String(m).padStart(2, '0')}-08`;
      if (d >= today) continue;
      inv.push({ n: `TB-2026-${String(m).padStart(3, '0')}`, date: d, amount: 850_000, customer: m % 2 ? 'Fenyő Stúdió Kft.' : null, vat: (m % 2 ? 'DOMESTIC' : 'PRIVATE_PERSON') as 'DOMESTIC' | 'PRIVATE_PERSON' });
    }
    await demoInvoices(ctx, cl.id, inv);
    await submittedAllowances(ctx, cl.id, { ...noAnswers, birthMonth: '2002-03' }, 'fofoglalkozasu', ['fiatal25']);
    const fresh = await demoInvoices(ctx, cl.id, [
      { n: 'TB-2026-901', date: today, amount: 120_000, customer: 'Bodza Kiadó Kft.', vat: 'DOMESTIC', createdAt: ctx.at(3) },
      { n: 'TB-2026-902', date: today, amount: 240_000, customer: 'Csipke Műhely Bt.', vat: 'DOMESTIC', createdAt: ctx.at(2) },
      { n: 'TB-2026-903', date: today, amount: 95_000, customer: null, vat: 'PRIVATE_PERSON', createdAt: ctx.at(2) },
    ]);
    await recalcYear(deps, deps.db, cl.id, 2026);
    await ensureReserves(deps, deps.db, cl.id, 2026);
    const u = cl.userId;
    await notify(deps, deps.db, { userId: u, kind: 'invoice_new', params: { osszeg: '120 000', vevo: 'Bodza Kiadó Kft', felre: '31 000' }, link: `/szamla/${fresh[0]}`, data: { items: [{ navInvoiceId: fresh[0] }] }, noPush: true, noEmail: true });
    await notify(deps, deps.db, { userId: u, kind: 'invoice_new', variant: 'tobb', params: { n: 2, osszeg: '335 000', felre: '87 000' }, link: '/felretesz', data: { items: [{ navInvoiceId: fresh[1] }, { navInvoiceId: fresh[2] }] }, noPush: true, noEmail: true });
    created.push('balint');
  }

  // 3. Kovács Ádám – székhelyváltozás, waiting for his consent
  if (!(await exists(deps, `adam.kovacs@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `adam.kovacs@${DOMAIN}`, first: 'Ádám', last: 'Kovács', idSeed: 83, login: true, status: 'fofoglalkozasu' });
    const change: ChangeData = { kind: 'valtozas_szekhely', address: { zip: '1117', city: 'Budapest', streetName: 'Próba', streetType: 'utca', houseNumber: '3' }, effectiveOn: '2026-12-01', right: 'berlet', provider: null, alsoHomeAddress: false };
    const tick = Object.fromEntries(['adatok_teljesek', 'jogcim_rendben', 'meghatalmazas_lefedi', 'datum_rendben'].map((i) => [i, { at: ctx.at(5).toISOString(), by: ctx.bence.userId }]));
    const [as] = await deps.db
      .insert(assistRequests)
      .values({ clientId: cl.id, kind: 'valtozas_szekhely', status: 'meghatalmazas_el', statusChangedAt: ctx.at(5), createdByRole: 'client', createdByUserId: cl.userId, changeData: change, changeEffectiveOn: '2026-12-01', changeReadyAt: ctx.at(5), changeReadyBy: ctx.bence.userId, checklist: tick, createdAt: ctx.at(30), updatedAt: ctx.at(5) })
      .returning({ id: assistRequests.id });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'assist_consent_needed', variant: 'valtozas', params: { firstName: 'Bence' }, link: `/valtozas/engedely?assist=${as!.id}`, noPush: true, noEmail: true });
    await audit(deps.db, { action: 'assist.created', actorUserId: cl.userId, actorRole: 'client', targetType: 'assist', targetId: as!.id, clientId: cl.id, details: { kind: 'valtozas_szekhely', seed: SEED_KEY_OT1119 } });
    created.push('adam');
  }

  // 4. Varga Réka-Demo (no login) – szüneteltetés filed, the csapat closes it (change-done demo)
  if (!(await exists(deps, `reka.varga2@${DOMAIN}`))) {
    const cl = await demoClient(ctx, { email: `reka.varga2@${DOMAIN}`, first: 'Réka-Demo', last: 'Varga', idSeed: 84, login: false, status: 'fofoglalkozasu' });
    const change: ChangeData = { kind: 'valtozas_szuneteltetes', from: '2026-12-01', to: null };
    const tick = Object.fromEntries(['adatok_teljesek', 'meghatalmazas_lefedi', 'datum_rendben', 'kepviseletvalaszto', 'adatok_egyeznek', 'valtozas_bekuldve'].map((i) => [i, { at: ctx.at(4).toISOString(), by: ctx.bence.userId }]));
    await deps.db.insert(assistRequests).values({
      clientId: cl.id,
      kind: 'valtozas_szuneteltetes',
      status: 'bejelentes_bekuldve',
      statusChangedAt: ctx.at(4),
      createdByRole: 'client',
      changeData: change,
      changeEffectiveOn: '2026-12-01',
      changeReadyAt: ctx.at(20),
      changeReadyBy: ctx.bence.userId,
      consentAt: ctx.at(10),
      consentValid: true,
      evFiledAt: ctx.at(4),
      evFiledBy: ctx.bence.userId,
      checklist: tick,
      createdAt: ctx.at(40),
      updatedAt: ctx.at(4),
    });
    try {
      const pdf = await markdownToPdf(deps.cfg.fontDir, 'DEMO NAV-értesítés', '# DEMO – kitalált adat\n\nEz egy bemutató értesítés a szüneteltetés bejelentéséről. Nem valódi NAV-irat.', { banner: 'DEMO – nem valódi irat' });
      await createDocumentFromBuffer(deps, deps.db, { clientId: cl.id, category: 'nav_visszaigazolas', title: `Változásbejelentés – NAV-értesítés (${today})`, month: today.slice(0, 7), data: pdf, mime: 'application/pdf', fileName: 'demo_ertesites.pdf', source: 'konyvelo', status: 'feldolgozva', by: ctx.bence.userId, visibility: 'kozos' } as Parameters<typeof createDocumentFromBuffer>[2]);
    } catch (err) {
      log().warn({ err: safeErr(err) }, 'demo pdf skipped');
    }
    created.push('reka');
  }

  // seeded notifications are demo history: never sent
  await deps.db.update(notifications).set({ pushSentAt: ctx.now, emailSentAt: ctx.now }).where(sql`(${notifications.pushSentAt} is null or ${notifications.emailSentAt} is null) and ${notifications.kind} in ('invoice_new', 'allowance_submitted', 'assist_consent_needed')`);
  await writeCredentials(o.credentialsFile, ctx.lines);
  await deps.db.insert(systemState).values({ key: SEED_KEY_OT1119, value: { at: ctx.now.toISOString(), created } }).onConflictDoNothing();
  return { status: 'seeded', created };
}

export async function runSeedMain(name: string, fn: (deps: Deps, o: { credentialsFile: string }) => Promise<SeedResult>): Promise<void> {
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
    const ok = await handle.db.execute(sql`select to_regclass('public.fee_settings') is not null as ok`);
    if (!(ok as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok) {
      console.error('A 0016-os migráció még nem futott le. Előbb a migráció (kezjegy-migrate), utána ez.');
      process.exit(2);
    }
    const deps = buildDeps(cfg, handle.db, { dispatchInline: false });
    await deps.legal.load(null);
    await deps.content.reload();
    const res = await fn(deps, { credentialsFile: cfg.seedCredentialsFile });
    console.log(res.status === 'seeded' ? `Demó kiegészítés (${name}) kész: ${res.created.length} új elem. Belépések: ${cfg.seedCredentialsFile}` : `A demó kiegészítés (${name}) már megvan, nem csináltam semmit.`);
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSeedMain('ot1119', seedOt1119).catch((err) => {
    log().fatal({ err: safeErr(err) }, 'seed ot1119 failed');
    console.error(`Seed hiba: ${(err as Error).message}`);
    process.exit(1);
  });
}
