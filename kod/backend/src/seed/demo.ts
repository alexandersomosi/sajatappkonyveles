// Demo seed (SPEC §19). Everything here is fictional. Idempotent: if the demo admin exists, it
// does nothing. Passwords are random and only written to SEED_CREDENTIALS_FILE (mode 600).
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { and, eq, inArray, sql } from 'drizzle-orm';
import fixtures from '../_shared/demo/fixtures.json' with { type: 'json' };
import brand from '../_shared/brand.json' with { type: 'json' };
import { ONBOARDING_STEPS, type OnboardingStep } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import {
  accountants,
  availabilitySlots,
  appointments,
  cardRegistrations,
  certificateRequests,
  clients,
  clientTaxProfiles,
  consents,
  dossiers,
  documents,
  faqItems,
  kycRecords,
  messageTemplates,
  messages,
  navCredentials,
  navInvoices,
  notifications,
  onboardingSteps,
  paymentTokens,
  referralCodes,
  requests,
  revenueItems,
  signupAttribution,
  simplepayTransactions,
  subscriptions,
  taxPeriods,
  users,
} from '../db/schema.js';
import { hmacHex, randomToken } from '../lib/crypto.js';
import { addDays, addMonths, budapestLocalToUtc, MONTHS_HU } from '../lib/dates.js';
import { hashPassword } from '../lib/password.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { demoCardPdf, simpleTablePdf } from '../lib/pdf.js';
import { demoReceiptPng } from '../lib/png.js';
import { fillLegal, legalValuesFromConfig } from '../legal.js';
import { log } from '../log.js';
import { demoCredentialsFor } from '../nav/types.js';
import { createDocumentFromBuffer } from '../services/system-docs.js';
import { syncClient } from '../services/navsync.js';
import { approveCalculation, approveHipaManual, calculatePeriod, markFiled, markPaid, recalcYear, verifyPayment } from '../services/tax.js';
import { computeFlags } from '../services/flags.js';
import { ensurePlan, issueFeeInvoice } from '../services/subscription.js';
import { DEMO_SIGNATURE_PATH } from './signature.js';

export interface Clock {
  now(): Date;
  set(d: Date | string): void;
  real(): void;
}

/** A clock the seed can move into the past; real() returns to the base clock (wall time by default). */
export function makeClock(base: () => Date = () => new Date()): Clock {
  let fixed: Date | null = null;
  return {
    now: () => fixed ?? base(),
    set: (d) => {
      fixed = new Date(d);
    },
    real: () => {
      fixed = null;
    },
  };
}

const DOMAIN = 'demo.kezjegy.test';
const pw = () => randomBytes(18).toString('base64url');

async function user(deps: Deps, o: { email: string; role: 'client' | 'accountant' | 'admin'; displayName: string; password: string; createdAt: Date }) {
  const [u] = await deps.db
    .insert(users)
    .values({ email: o.email, role: o.role, displayName: o.displayName, passwordHash: await hashPassword(o.password), emailVerifiedAt: o.createdAt, createdAt: o.createdAt, lastLoginAt: o.createdAt })
    .returning({ id: users.id });
  return u!.id;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

async function steps(deps: Deps, clientId: string, status: Partial<Record<OnboardingStep, { status: (typeof onboardingSteps.$inferSelect)['status']; at?: string; data?: Record<string, unknown> }>>) {
  for (const s of ONBOARDING_STEPS) {
    // The demo clients run an existing business: no new-business step (SPEC §26.1.6).
    if (s === 'vallalkozas_inditas' && !status[s]) continue;
    const v = status[s] ?? { status: 'kesz' as const };
    const at = v.at ? new Date(v.at) : null;
    await deps.db
      .insert(onboardingSteps)
      .values({ clientId, step: s, status: v.status, data: v.data ?? null, completedAt: v.status === 'kesz' ? at : null, updatedAt: at ?? deps.now() })
      .onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: v.status, data: v.data ?? null, completedAt: v.status === 'kesz' ? at : null } });
  }
}

async function kyc(deps: Deps, clientId: string, userId: string, name: { family: string; given: string }, at: string, status: 'elfogadva' | 'bekuldve', reviewer: string | null) {
  const fileIds: Record<string, string> = {};
  for (const [k, label] of [
    ['idFront', 'Személyazonosító igazolvány – előlap'],
    ['idBack', 'Személyazonosító igazolvány – hátlap'],
    ['addressFront', 'Lakcímkártya – címoldal'],
  ] as const) {
    const f = await deps.storage.put(deps.db, { ownerClientId: clientId, kind: 'kyc', mime: 'application/pdf', displayName: `${k}.pdf`, data: await demoCardPdf(deps.cfg.fontDir, label), createdBy: userId, now: new Date(at) });
    fileIds[k] = f.id;
  }
  await deps.db.insert(kycRecords).values({
    clientId,
    status,
    dataEnc: deps.data.encJson(
      {
        familyName: name.family,
        givenName: name.given,
        birthName: `${name.family} ${name.given}`,
        motherBirthName: 'Minta Mária',
        birthPlace: 'Példafalva',
        birthDate: '1981-03-14',
        citizenship: 'magyar',
        address: 'kitalált cím (DEMO)',
        documentType: 'szemelyi_igazolvany',
        documentNumber: '000000DE',
        documentExpiry: '2031-03-14',
      },
      `kyc_records:${clientId}`,
    ),
    declarations: { ownBehalf: true, truthful: true, changeDuty: true, signedAt: at },
    declarationsEnc: deps.data.encJson({ pep: false }, `kyc_records.declarations:${clientId}`),
    files: { idFront: fileIds.idFront!, idBack: fileIds.idBack!, addressFront: fileIds.addressFront! },
    submittedAt: new Date(at),
    reviewedBy: status === 'elfogadva' ? reviewer : null,
    reviewedAt: status === 'elfogadva' ? new Date(at) : null,
  });
}

async function subscriptionHistory(deps: Deps, clock: Clock, clientId: string, start: string, months: number, cardMask: string, tokensTotal: number) {
  await ensurePlan(deps, deps.db);
  const price = deps.cfg.planPriceHuf;
  const [cl] = await deps.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const tokensUntil = budapestLocalToUtc(addMonths(start, 12), '23:59');
  const [reg] = await deps.db
    .insert(cardRegistrations)
    .values({ clientId, simplepayCardId: 500_100_000 + Math.floor(Math.random() * 1_000_000), maxAmountHuf: price, cardMask, cardExpiry: '2028-09-30', tokensUntil, status: 'aktiv', mode: 'demo', createdAt: new Date(`${start}T09:00:00Z`) })
    .returning({ id: cardRegistrations.id });
  const tokenIds: string[] = [];
  for (let i = 0; i < tokensTotal; i++) {
    const [t] = await deps.db.insert(paymentTokens).values({ cardRegistrationId: reg!.id, tokenEnc: deps.data.enc(`DEMO${randomToken(18)}`, 'payment_tokens.token'), seq: i, status: 'aktiv' }).returning({ id: paymentTokens.id });
    tokenIds.push(t!.id);
  }
  const periodEnd = addMonths(start, months);
  const [sub] = await deps.db
    .insert(subscriptions)
    .values({
      clientId,
      planCode: 'havi',
      status: 'active',
      currentPeriodStart: addMonths(start, months - 1),
      currentPeriodEnd: periodEnd,
      nextChargeAt: budapestLocalToUtc(periodEnd, '09:00'),
      cardRegistrationId: reg!.id,
      mode: 'demo',
      createdAt: new Date(`${start}T09:00:00Z`),
    })
    .returning({ id: subscriptions.id });
  for (let m = 0; m < months; m++) {
    const ps = addMonths(start, m);
    const pe = addMonths(start, m + 1);
    const at = budapestLocalToUtc(ps, '09:05');
    clock.set(at);
    const kind = m === 0 ? 'regisztracio' : 'ismetlodo';
    if (kind === 'ismetlodo') await deps.db.update(paymentTokens).set({ status: 'felhasznalt', usedAt: at }).where(eq(paymentTokens.id, tokenIds[m - 1]!));
    const [tx] = await deps.db
      .insert(simplepayTransactions)
      .values({
        orderRef: `KJ-${ps.replace(/-/g, '')}-DEMO${randomToken(4).toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 6)}`,
        simplepayTransactionId: 500_000_000 + Math.floor(Math.random() * 99_999_999),
        kind,
        clientId,
        subscriptionId: sub!.id,
        cardRegistrationId: reg!.id,
        tokenId: kind === 'ismetlodo' ? tokenIds[m - 1]! : null,
        amountHuf: price,
        status: 'FINISHED',
        periodStart: ps,
        periodEnd: pe,
        ipnCount: 1,
        lastIpnAt: at,
        finishedAt: at,
        appliedAt: at,
        mode: 'demo',
        createdAt: at,
      })
      .returning();
    await issueFeeInvoice(deps, deps.db, tx!, cl!);
  }
  // Registration covered the first month; tokens used for the following months.
  return sub!.id;
}

async function bankStatement(deps: Deps, clientId: string, month: string, credits: [string, string, number][], name: string): Promise<Buffer> {
  const m = Number(month.slice(5, 7));
  const rows: [string, string][] = credits.map(([d, who, amt]) => [`${d}  ${who}`, `+${new Intl.NumberFormat('hu-HU').format(amt)} Ft`]);
  rows.push([`${month}-05  Példa Telekom Zrt. (kitalált)`, '−9 990 Ft']);
  rows.push([`${month}-14  Szoftver-előfizetés (kitalált)`, '−4 300 Ft']);
  return simpleTablePdf(deps.cfg.fontDir, {
    title: 'MINTA BANKSZÁMLAKIVONAT – DEMO',
    banner: 'BEMUTATÓ ADAT – nem valódi bankszámla, nem valódi tranzakciók.',
    header: [`Példa Bank Zrt. (kitalált) · ${month.slice(0, 4)}. ${MONTHS_HU[m - 1]}`, `Számlatulajdonos: ${name}`, 'Számlaszám: 00000000-00000000 (MINTA)'],
    rows,
    footer: ['Ez a dokumentum kitalált bemutató adat.'],
  });
}

export async function seedDemo(deps: Deps, clock: Clock, o: { credentialsFile: string; force?: boolean }): Promise<'seeded' | 'exists'> {
  if (deps.cfg.appEnv === 'production' && !o.force) throw new Error('APP_ENV=production: a demó seed csak --force-demo kapcsolóval fut.');
  const [exists] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, `admin@${DOMAIN}`)).limit(1);
  if (exists) return 'exists';
  const today = fixtures.today; // 2026-11-17 (SPEC demo "today")
  await deps.legal.load(deps.db);
  await ensurePlan(deps, deps.db);
  const creds: string[] = [`# ${brand.name} DEMO belépések – KITALÁLT fiókok. Ne add tovább, ne használd élesben.`, '# szerep;e-mail;jelszó'];

  // ---------- admin, accountant ----------
  const adminPw = pw();
  clock.set('2026-01-02T08:00:00Z');
  await user(deps, { email: `admin@${DOMAIN}`, role: 'admin', displayName: 'Demo Tulajdonos', password: adminPw, createdAt: new Date('2026-01-02T08:00:00Z') });
  creds.push(`admin;admin@${DOMAIN};${adminPw}`);
  const bencePw = pw();
  const benceUser = await user(deps, { email: `bence.kovacs@${DOMAIN}`, role: 'accountant', displayName: 'Kovács Bence', password: bencePw, createdAt: new Date('2026-01-02T08:00:00Z') });
  creds.push(`konyvelo;bence.kovacs@${DOMAIN};${bencePw}`);
  const [bence] = await deps.db
    .insert(accountants)
    .values({
      userId: benceUser,
      displayName: 'Kovács Bence',
      firstName: 'Bence',
      title: 'Mérlegképes könyvelő',
      registrationNumber: '123456',
      adoazonositoJelEnc: deps.data.enc(fixtures.taxIds.bence.adoazonositoJel, 'accountants.adoazonosito_jel'),
      signatureSvgPath: DEMO_SIGNATURE_PATH,
      nameWith: 'Bencével',
      nameFrom: 'Bencétől',
      nameOnto: 'Bencére',
      nameAcc: 'Bencét',
      responseTimeText: 'A lehető leggyorsabban válaszol', // SPEC §28.K.15: no answer-time promise
      appointmentsEnabled: true,
      monthlyStatementRequest: true,
    })
    .returning();
  const accId = bence!.id;

  // free slots: the next 14 days, weekdays 10:00 and 14:00 (Budapest)
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const t of ['10:00', '14:00']) {
      const st = budapestLocalToUtc(d, t);
      await deps.db.insert(availabilitySlots).values({ accountantId: accId, startsAt: st, endsAt: new Date(st.getTime() + 30 * 60_000), channels: ['telefon', 'video'] });
    }
  }
  await deps.db.insert(messageTemplates).values([
    { accountantId: null, title: 'Megkaptam', body: 'Köszönöm, megkaptam. Ha kérdésem lesz, írok.', sort: 1 },
    { accountantId: null, title: 'Csak értesítés', body: 'Megnéztem: ez csak értesítés, nincs teendőd. Elteheted.', sort: 2 },
    { accountantId: null, title: 'Kivonat kell', body: 'Kérlek, töltsd fel a havi bankszámlakivonatodat. Elég a bankod appjából letöltött PDF.', sort: 3 },
  ]);
  await deps.db.insert(referralCodes).values({ code: 'OSZ2026', campaign: 'őszi hirdetés', note: 'Őszi Facebook-kampány (DEMO)' });

  // FAQ from kod/jogi/app_szovegek.json (8 questions), placeholders filled.
  try {
    const raw = JSON.parse(await readFile(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { gyik?: { kerdes: string; valasz: string }[] };
    const vals = legalValuesFromConfig(deps.cfg, deps.now());
    let i = 0;
    for (const g of raw.gyik ?? []) await deps.db.insert(faqItems).values({ question: fillLegal(g.kerdes, vals), answer: fillLegal(g.valasz, vals), sort: ++i });
  } catch {
    await deps.db.insert(faqItems).values({ question: 'Az app adja be helyettem a bevallást?', answer: 'Nem. A bevallást mindig a könyvelőd adja be, miután átnézte.', sort: 1 });
  }

  const versions = deps.legal.versions();
  async function consentAll(userId: string, at: string) {
    for (const t of ['aszf', 'adatkezeles', 'megbizasi_szerzodes', 'simplepay_adattovabbitas', 'simplepay_ismetlodo'] as const)
      await deps.db.insert(consents).values({ userId, docType: t, version: versions[t] ?? 'ismeretlen', acceptedAt: new Date(at) });
  }

  async function makeClient(p: {
    key: 'kata' | 'reka' | 'peter';
    first: string;
    last: string;
    createdAt: string;
    zip: string;
    city: string;
    line: string;
    activity: string;
    activityAnswer: 'egyeb' | 'lista80';
    activityCode?: string;
    evSince: string;
    phone: string;
    previousAccountant?: string;
    lifecycle: 'aktiv' | 'bekotes_alatt';
    personalCode: string;
  }) {
    const password = pw();
    const email = `${p.first.toLowerCase().replace('é', 'e')}.${p.last.toLowerCase().replace('é', 'e').replace('á', 'a')}@${DOMAIN}`
      .replace('kata.szabo', 'kata.szabo')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const userId = await user(deps, { email, role: 'client', displayName: `${p.last} ${p.first}`, password, createdAt: new Date(p.createdAt) });
    creds.push(`ugyfel;${email};${password}`);
    const ids = fixtures.taxIds[p.key];
    const [cl] = await deps.db
      .insert(clients)
      .values({
        userId,
        accountantId: accId,
        lifecycle: p.lifecycle,
        firstName: p.first,
        lastName: p.last,
        birthName: `${p.last} ${p.first}`,
        phoneEnc: deps.data.enc(p.phone, 'clients.phone'),
        adoazonositoJelEnc: deps.data.enc(ids.adoazonositoJel, 'clients.adoazonosito_jel'),
        adoazonositoHmac: hmacHex(deps.lookupKey, ids.adoazonositoJel),
        adoazonositoLast3: ids.adoazonositoJel.slice(-3),
        adoszam: ids.adoszam,
        evNyilvantartasiSzam: `5${ids.adoszam.slice(1, 8)}`,
        addressZip: p.zip,
        addressCity: p.city,
        addressLine: p.line,
        hqMunicipality: p.city,
        activityText: p.activity,
        activityAnswer: p.activityAnswer,
        activityCode: p.activityCode ?? null,
        evSince: p.evSince,
        previousAccountant: p.previousAccountant ?? null,
        hasSeparateBusinessAccount: true,
        personalReferralCode: p.personalCode,
        createdAt: new Date(p.createdAt),
      })
      .returning();
    return { client: cl!, userId, email };
  }

  // ======================= Szabó Kata =======================
  const kata = await makeClient({ key: 'kata', first: 'Kata', last: 'Szabó', createdAt: '2026-01-08T08:30:00Z', zip: '1136', city: 'Budapest', line: 'Példa utca 7.', activity: 'Grafikai tervezés és illusztráció', activityAnswer: 'egyeb', activityCode: '7410', evSince: '2019-04-01', phone: '+36301234567', lifecycle: 'aktiv', personalCode: 'KATA7Q2X' });
  const K = kata.client.id;
  await deps.db.insert(referralCodes).values({ code: 'KATA7Q2X', ownerClientId: K, note: 'személyes ajánlókód' });
  await deps.db.insert(signupAttribution).values({ userId: kata.userId, utmSource: 'facebook', utmMedium: 'paid', utmCampaign: 'osz_2025', landing: 'android', firstSeenAt: new Date('2026-01-08T08:20:00Z') });
  await consentAll(kata.userId, '2026-01-08T08:40:00Z');
  await steps(deps, K, {
    fiok: { status: 'kesz', at: '2026-01-08T08:31:00Z' },
    adatok: { status: 'kesz', at: '2026-01-08T08:38:00Z' },
    szerzodes: { status: 'kesz', at: '2026-01-08T08:40:00Z' },
    elofizetes: { status: 'kesz', at: '2026-01-08T08:45:00Z' },
    meghatalmazas: { status: 'kesz', at: '2026-01-12T10:00:00Z', data: { method: 'onya_ugyfel', submittedAt: '2026-01-12T07:10:00Z' } },
    azonositas: { status: 'kesz', at: '2026-01-09T11:00:00Z' },
    idopont: { status: 'kihagyva', at: '2026-01-08T08:40:00Z' },
    nav_bekotes: { status: 'kesz', at: '2026-01-13T05:30:00Z' },
  });
  await deps.db.insert(clientTaxProfiles).values({ clientId: K, year: 2026, costRatio: 45, costRatioSource: 'konyvelo_megerositette', status: 'fofoglalkozasu', guaranteedMinimum: false, hipaMethod: 'savos', hipaRatePct: '2.00' });
  await kyc(deps, K, kata.userId, { family: 'Szabó', given: 'Kata' }, '2026-01-09T09:00:00Z', 'elfogadva', benceUser);
  await deps.db.insert(navCredentials).values({ clientId: K, taxNumber: '68801234', secretEnc: deps.navKey.encJson(demoCredentialsFor('68801234'), `nav_credentials:${K}`), loginHint: `${demoCredentialsFor('68801234').login.slice(0, 3)}…`, environment: 'demo', status: 'rendben', savedBy: benceUser, savedAt: new Date('2026-01-13T05:00:00Z') });

  // ======================= Varga Réka =======================
  const reka = await makeClient({ key: 'reka', first: 'Réka', last: 'Varga', createdAt: '2026-02-01T09:00:00Z', zip: '3300', city: 'Eger', line: 'Minta tér 3.', activity: 'Fodrászat', activityAnswer: 'lista80', activityCode: '9602', evSince: '2015-06-01', phone: '+36209876543', lifecycle: 'aktiv', personalCode: 'REKA4M8P' });
  const R = reka.client.id;
  await deps.db.insert(signupAttribution).values({ userId: reka.userId, utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'telies_2026', landing: 'web', firstSeenAt: new Date('2026-02-01T08:50:00Z') });
  await consentAll(reka.userId, '2026-02-01T09:10:00Z');
  await steps(deps, R, {
    fiok: { status: 'kesz', at: '2026-02-01T09:01:00Z' },
    meghatalmazas: { status: 'kesz', at: '2026-02-04T10:00:00Z', data: { method: 'onya_konyvelo', submittedAt: '2026-02-02T09:00:00Z' } },
    idopont: { status: 'kesz', at: '2026-02-03T10:30:00Z' },
    nav_bekotes: { status: 'kesz', at: '2026-02-05T05:30:00Z' },
  });
  await deps.db.insert(clientTaxProfiles).values({ clientId: R, year: 2026, costRatio: 80, costRatioSource: 'konyvelo_megerositette', status: 'fofoglalkozasu', guaranteedMinimum: true, hipaMethod: 'savos', hipaRatePct: '2.00' });
  await kyc(deps, R, reka.userId, { family: 'Varga', given: 'Réka' }, '2026-02-02T09:00:00Z', 'elfogadva', benceUser);
  await deps.db.insert(navCredentials).values({ clientId: R, taxNumber: '68904564', secretEnc: deps.navKey.encJson(demoCredentialsFor('68904564'), `nav_credentials:${R}`), loginHint: `${demoCredentialsFor('68904564').login.slice(0, 3)}…`, environment: 'demo', status: 'rendben', savedBy: benceUser, savedAt: new Date('2026-02-05T05:00:00Z') });

  // ======================= Németh Péter =======================
  const peter = await makeClient({ key: 'peter', first: 'Péter', last: 'Németh', createdAt: '2026-11-10T17:00:00Z', zip: '6720', city: 'Szeged', line: 'Kitalált sor 12.', activity: 'Weboldal-fejlesztés', activityAnswer: 'egyeb', evSince: '2024-03-01', phone: '+36701112233', previousAccountant: 'Minta Könyvelőiroda Bt.', lifecycle: 'bekotes_alatt', personalCode: 'PETR9K3D' });
  const P = peter.client.id;
  await deps.db.insert(signupAttribution).values({ userId: peter.userId, utmSource: 'instagram', utmMedium: 'social', utmCampaign: 'osz_2026', landing: 'ios', firstSeenAt: new Date('2026-11-10T16:55:00Z'), referralCodeId: (await deps.db.select({ id: referralCodes.id }).from(referralCodes).where(eq(referralCodes.code, 'OSZ2026')))[0]?.id ?? null });
  await deps.db.update(clients).set({ referralCodeId: (await deps.db.select({ id: referralCodes.id }).from(referralCodes).where(eq(referralCodes.code, 'OSZ2026')))[0]?.id ?? null }).where(eq(clients.id, P));
  await consentAll(peter.userId, '2026-11-10T17:20:00Z');
  const pq = fixtures.expectedTax2026.peter;
  await deps.db.insert(clientTaxProfiles).values({
    clientId: P,
    year: 2026,
    costRatio: 45,
    costRatioSource: 'konyvelo_megerositette',
    status: 'mellekallasu',
    hipaMethod: 'savos',
    hipaRatePct: '2.00',
    priorOverrides: {
      throughQuarter: 3,
      priorActualBaseSum: pq.slice(0, 3).reduce((a, q) => a + q.monthlyBases.reduce((x: number, y: number | null) => x + (y ?? 0), 0), 0),
      priorSzjaAdvanceSum: pq.slice(0, 3).reduce((a, q) => a + q.szjaAdvance, 0),
    },
  });
  await kyc(deps, P, peter.userId, { family: 'Németh', given: 'Péter' }, '2026-11-12T18:00:00Z', 'elfogadva', benceUser);
  // Phone call booked for 2026-11-19 10:00 (Budapest)
  const callStart = budapestLocalToUtc('2026-11-19', '10:00');
  // Reuse the free slot at that time if the generator above made one (never two slots at once).
  const [existing] = await deps.db.select().from(availabilitySlots).where(and(eq(availabilitySlots.accountantId, accId), eq(availabilitySlots.startsAt, callStart))).limit(1);
  const [slot] = existing
    ? await deps.db.update(availabilitySlots).set({ status: 'foglalt' }).where(eq(availabilitySlots.id, existing.id)).returning()
    : await deps.db.insert(availabilitySlots).values({ accountantId: accId, startsAt: callStart, endsAt: new Date(callStart.getTime() + 30 * 60_000), channels: ['telefon', 'video'], status: 'foglalt' }).returning();
  const [apt] = await deps.db
    .insert(appointments)
    .values({ clientId: P, accountantId: accId, slotId: slot!.id, startsAt: callStart, endsAt: new Date(callStart.getTime() + 30 * 60_000), channel: 'telefon', phoneEnc: deps.data.enc('+36701112233', 'appointments.phone'), topic: 'Átállás az előző könyvelőtől' })
    .returning();
  await steps(deps, P, {
    fiok: { status: 'kesz', at: '2026-11-10T17:02:00Z' },
    adatok: { status: 'kesz', at: '2026-11-10T17:15:00Z' },
    szerzodes: { status: 'kesz', at: '2026-11-10T17:20:00Z' },
    elofizetes: { status: 'kesz', at: '2026-11-10T17:25:00Z' },
    azonositas: { status: 'kesz', at: '2026-11-13T09:00:00Z' },
    meghatalmazas: { status: 'konyvelore_var', at: '2026-11-16T08:00:00Z', data: { method: 'onya_ugyfel', submittedAt: '2026-11-16T08:00:00Z' } },
    idopont: { status: 'konyvelore_var', at: '2026-11-11T10:00:00Z', data: { appointmentId: apt!.id } },
    nav_bekotes: { status: 'nincs_kezdve' },
  });

  // ---------- NAV sync (demo mock) for Kata and Réka ----------
  clock.real();
  for (const id of [K, R]) {
    const res = await syncClient(deps, id, {});
    log().info({ invoicesNew: res.invoicesNew, status: res.status }, 'seed nav sync');
  }
  // Statuses of NAV invoices: before the open quarter → feldolgozva (markFiled moves them to beadva).
  await deps.db.update(navInvoices).set({ status: 'feldolgozva' }).where(and(inArray(navInvoices.clientId, [K, R]), sql`${navInvoices.dossierMonth} < '2026-11'`));
  await deps.db.update(navInvoices).set({ status: 'konyvelo_latta' }).where(and(inArray(navInvoices.clientId, [K, R]), sql`${navInvoices.dossierMonth} = '2026-10'`));

  // ---------- manual revenue + documents ----------
  const kataName = 'Szabó Kata';
  const receiptDocId = await createDocumentFromBuffer(deps, deps.db, {
    clientId: K,
    category: 'nyugta',
    title: 'Nyugta, készpénzes eladás',
    month: '2026-10',
    data: demoReceiptPng(600, 900, 7),
    mime: 'image/png',
    fileName: 'nyugta.png',
    source: 'ugyfel',
    status: 'feldolgozva',
    by: kata.userId,
    createdAt: new Date('2026-10-03T15:20:00Z'),
    statusAt: new Date('2026-10-06T08:10:00Z'),
    accountantComment: 'Ha máskor is kézzel adsz nyugtát, elég a hónap végén egyszerre lefotóznod a tömb lapjait.',
    amountHuf: 18_000,
    documentDate: '2026-10-03',
    thumb: true,
  });
  for (const m of fixtures.manualRevenue.kata)
    await deps.db.insert(revenueItems).values({ clientId: K, source: 'kezi', documentId: receiptDocId, receivedOn: m.receivedOn, deliveryDate: m.receivedOn, amountHuf: m.amountHuf, description: m.description, createdBy: benceUser });
  for (const m of fixtures.manualRevenue.reka) {
    const mk = m.receivedOn.slice(0, 7);
    const doc = await createDocumentFromBuffer(deps, deps.db, {
      clientId: R,
      category: 'penztargep_osszesito',
      title: 'Pénztárgép havi összesítő',
      month: mk,
      data: await simpleTablePdf(deps.cfg.fontDir, { title: 'PÉNZTÁRGÉP HAVI ÖSSZESÍTŐ – DEMO', banner: 'BEMUTATÓ ADAT – kitalált összegek.', header: [`Varga Réka egyéni vállalkozó (kitalált) · ${mk}`], rows: [['Havi forgalom összesen', `${new Intl.NumberFormat('hu-HU').format(m.amountHuf)} Ft`]] }),
      mime: 'application/pdf',
      fileName: `penztargep_${mk}.pdf`,
      source: 'ugyfel',
      status: mk < '2026-10' ? 'feldolgozva' : 'konyvelo_latta',
      by: reka.userId,
      createdAt: new Date(`${addDays(m.receivedOn, 1)}T16:00:00Z`),
      amountHuf: m.amountHuf,
      documentDate: m.receivedOn,
    });
    await deps.db.insert(revenueItems).values({ clientId: R, source: 'kezi', documentId: doc, receivedOn: m.receivedOn, deliveryDate: m.receivedOn, amountHuf: m.amountHuf, description: m.description, createdBy: benceUser });
  }

  // Kata: bank statements Jan–Sep (uploaded early next month), dossier reviews.
  const kataInv = await deps.db.select().from(navInvoices).where(eq(navInvoices.clientId, K));
  for (let m = 1; m <= 9; m++) {
    const mk = `2026-${pad(m)}`;
    const credits = kataInv
      .filter((i) => (i.paymentDate ?? i.issueDate).startsWith(mk))
      .map((i) => [i.paymentDate ?? i.issueDate, i.customerName ?? 'Vevő', i.grossHuf] as [string, string, number]);
    const up = new Date(`${addDays(`${addMonths(`${mk}-01`, 1)}`, 2)}T17:00:00Z`);
    await createDocumentFromBuffer(deps, deps.db, { clientId: K, category: 'bankszamlakivonat', title: `Bankszámlakivonat, ${MONTHS_HU[m - 1]}`, month: mk, data: await bankStatement(deps, K, mk, credits, kataName), mime: 'application/pdf', fileName: `kivonat_${mk}.pdf`, source: 'ugyfel', status: 'feldolgozva', by: kata.userId, createdAt: up, statusAt: new Date(up.getTime() + 86_400_000) });
    await deps.db.insert(dossiers).values({ clientId: K, month: mk, reviewedAt: new Date(up.getTime() + 2 * 86_400_000), reviewedBy: benceUser, summaryNote: 'Minden rendben, köszönöm.' }).onConflictDoUpdate({ target: [dossiers.clientId, dossiers.month], set: { reviewedAt: new Date(up.getTime() + 2 * 86_400_000), reviewedBy: benceUser, summaryNote: 'Minden rendben, köszönöm.' } });
  }
  await createDocumentFromBuffer(deps, deps.db, { clientId: K, category: 'szerzodes', title: 'Szerződés, Bodza Kiadó', month: '2026-10', data: await simpleTablePdf(deps.cfg.fontDir, { title: 'MINTA MEGBÍZÁSI SZERZŐDÉS – DEMO', banner: 'BEMUTATÓ ADAT – kitalált felek.', header: ['Bodza Kiadó Kft. (kitalált) és Szabó Kata e.v. (kitalált)'], rows: [['Könyvborító-illusztráció, 3 db', '240 000 Ft']] }), mime: 'application/pdf', fileName: 'szerzodes_bodza.pdf', source: 'ugyfel', status: 'feltoltve', by: kata.userId, createdAt: new Date('2026-11-16T14:00:00Z') });
  await createDocumentFromBuffer(deps, deps.db, { clientId: K, category: 'nav_level', title: 'Levél a NAV-tól', month: '2026-10', data: await simpleTablePdf(deps.cfg.fontDir, { title: 'MINTA ÉRTESÍTÉS – DEMO', banner: 'BEMUTATÓ ADAT – nem a NAV levele.', header: ['Tárgy: tájékoztatás (kitalált)'], rows: [['Teendő', 'nincs']] }), mime: 'application/pdf', fileName: 'nav_level.pdf', source: 'ugyfel', status: 'feldolgozva', by: kata.userId, createdAt: new Date('2026-10-20T08:00:00Z'), statusAt: new Date('2026-10-20T11:00:00Z') });
  await deps.db.insert(dossiers).values({ clientId: K, month: '2026-10', reviewedAt: new Date('2026-11-17T08:30:00Z'), reviewedBy: benceUser, summaryNote: 'A tegnapi szerződésre még ránéz.' }).onConflictDoUpdate({ target: [dossiers.clientId, dossiers.month], set: { reviewedAt: new Date('2026-11-17T08:30:00Z'), reviewedBy: benceUser, summaryNote: 'A tegnapi szerződésre még ránéz.' } });
  await createDocumentFromBuffer(deps, deps.db, { clientId: K, category: 'koltseg_bizonylat', title: 'Számla, nyomdai próbanyomat', month: '2026-11', data: demoReceiptPng(600, 800, 11), mime: 'image/png', fileName: 'nyomda.png', source: 'ugyfel', status: 'feltoltve', by: kata.userId, createdAt: new Date('2026-11-17T07:45:00Z'), thumb: true });
  await createDocumentFromBuffer(deps, deps.db, { clientId: K, category: 'nyugta', title: 'Nyugta, papírbolt', month: '2026-11', data: demoReceiptPng(600, 900, 13), mime: 'image/png', fileName: 'papirbolt.png', source: 'ugyfel', status: 'konyvelo_latta', by: kata.userId, createdAt: new Date('2026-11-12T10:00:00Z'), statusAt: new Date('2026-11-12T13:00:00Z'), thumb: true });

  // ---------- tax: approve, pay, verify and file past quarters ----------
  async function quarterFlow(clientId: string, userId: string, q: 1 | 2 | 3, o: { approveAt: string; paidOn?: string; verifyAt?: string; filedOn?: string; letter: string }) {
    clock.set(o.approveAt);
    const calc = await calculatePeriod(deps, deps.db, clientId, `2026-Q${q}`, o.approveAt.slice(0, 10), benceUser);
    await approveCalculation(deps, deps.db, calc.id, benceUser, accId, { letterText: o.letter });
    const [p] = await deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.periodKey, `2026-Q${q}`))).limit(1);
    if (o.filedOn) {
      clock.set(`${o.filedOn}T14:00:00Z`);
      const label = ['', 'I.', 'II.', 'III.'][q];
      const ret = await createDocumentFromBuffer(deps, deps.db, { clientId, category: 'bevallas', title: `Bevallás ${label === 'I.' ? 'az' : 'a'} ${label} negyedévről`, month: o.filedOn.slice(0, 7), data: await simpleTablePdf(deps.cfg.fontDir, { title: `2658 BEVALLÁS – ${label} NEGYEDÉV – DEMO`, banner: 'BEMUTATÓ ADAT – nem valódi bevallás.', header: ['Nyomtatvány: 2658 (minta)'], rows: [['Időszak', `2026. ${label} negyedév`]] }), mime: 'application/pdf', fileName: `2658_2026Q${q}.pdf`, source: 'konyvelo', status: 'beadva', by: benceUser, createdAt: new Date(`${o.filedOn}T14:00:00Z`) });
      const rec = await createDocumentFromBuffer(deps, deps.db, { clientId, category: 'nav_visszaigazolas', title: `NAV visszaigazolás, ${label} negyedév`, month: o.filedOn.slice(0, 7), data: await simpleTablePdf(deps.cfg.fontDir, { title: 'NAV VISSZAIGAZOLÁS – DEMO', banner: 'BEMUTATÓ ADAT – nem a NAV dokumentuma.', header: ['Érkeztetés (minta)'], rows: [['Nyomtatvány', '2658']] }), mime: 'application/pdf', fileName: `nav_visszaigazolas_2026Q${q}.pdf`, source: 'konyvelo', status: 'beadva', by: benceUser, createdAt: new Date(`${o.filedOn}T14:05:00Z`) });
      await markFiled(deps, deps.db, p!.id, benceUser, accId, { filedOn: o.filedOn, form: '2658', returnDocumentId: ret, receiptDocumentId: rec });
    }
    if (o.paidOn) {
      clock.set(`${o.paidOn}T18:00:00Z`);
      await markPaid(deps, deps.db, clientId, p!.id, undefined, o.paidOn, userId);
    }
    if (o.verifyAt) {
      clock.set(o.verifyAt);
      await verifyPayment(deps, deps.db, p!.id, benceUser, accId, ['tb_jarulek', 'szocho', 'szja_eloleg'].map((k) => ({ kind: k as 'tb_jarulek', verification: 'rendben' as const })));
    }
  }
  const letterFinal = 'Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg.';
  await quarterFlow(K, kata.userId, 1, { approveAt: '2026-04-08T09:00:00Z', filedOn: '2026-04-10', paidOn: '2026-04-09', verifyAt: '2026-04-20T09:00:00Z', letter: letterFinal });
  await quarterFlow(K, kata.userId, 2, { approveAt: '2026-07-08T09:00:00Z', filedOn: '2026-07-10', paidOn: '2026-07-09', verifyAt: '2026-07-20T09:00:00Z', letter: letterFinal });
  await quarterFlow(K, kata.userId, 3, { approveAt: '2026-10-02T08:00:00Z', filedOn: '2026-10-02', paidOn: '2026-10-09', verifyAt: '2026-10-19T09:00:00Z', letter: letterFinal });
  await quarterFlow(R, reka.userId, 1, { approveAt: '2026-04-07T09:00:00Z', filedOn: '2026-04-09', paidOn: '2026-04-10', verifyAt: '2026-04-21T09:00:00Z', letter: 'Kiszámoltam az első negyedévet. A garantált bérminimum után fizetsz, mert a fodrászathoz szakképesítés kell.' });
  await quarterFlow(R, reka.userId, 2, { approveAt: '2026-07-07T09:00:00Z', filedOn: '2026-07-09', paidOn: '2026-07-10', verifyAt: '2026-07-21T09:00:00Z', letter: letterFinal });
  await quarterFlow(R, reka.userId, 3, { approveAt: '2026-10-05T09:00:00Z', filedOn: '2026-10-07', paidOn: '2026-10-10', letter: 'Kiszámoltam a III. negyedévet. Figyelj az alanyi ÁFA-keretre: közel vagy a 80%-hoz, beszéljünk róla.' });

  // ---------- iparűzési adóelőleg (sávos): = last year's tax, approved by hand in May, paid, checked ----------
  // Fictional municipal account (DEMO), never a real one.
  for (const [cid, uid, amount] of [
    [K, kata.userId, 50_000],
    [R, reka.userId, 120_000],
  ] as const) {
    const [hp] = await deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cid), eq(taxPeriods.periodKey, '2026-HIPA-1'))).limit(1);
    if (!hp) continue;
    clock.set('2026-05-19T08:00:00Z');
    await approveHipaManual(deps, deps.db, hp.id, benceUser, accId, { amountHuf: amount, accountNumber: '12345678-90123456' });
    clock.set('2026-05-27T17:00:00Z');
    await markPaid(deps, deps.db, cid, hp.id, undefined, '2026-05-27', uid);
    clock.set('2026-06-08T09:00:00Z');
    await verifyPayment(deps, deps.db, hp.id, benceUser, accId, [{ kind: 'hipa_eloleg', verification: 'rendben' }]);
  }

  // ---------- requests, messages ----------
  clock.real();
  const [kReq] = await deps.db
    .insert(requests)
    .values({ clientId: K, direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az októberi bankszámlakivonatodat.', body: 'Csak ellenőrzéshez kell, a befizetendő összeg nem változik. Elég a bankod appjából letöltött PDF.', dueDate: '2026-11-20', dossierMonth: '2026-10', createdBy: benceUser, createdAt: new Date('2026-11-02T06:10:00Z') })
    .returning();
  const [cert] = await deps.db
    .insert(requests)
    .values({ clientId: K, direction: 'ugyfeltol', type: 'jovedelemigazolas', title: 'Jövedelemigazolás 2025', body: 'Lakáshitelhez kéri a bank.', status: 'folyamatban', createdBy: kata.userId, createdAt: new Date('2026-11-14T09:00:00Z'), statusNote: 'Bence látta, pár napon belül kész.' })
    .returning();
  await deps.db.insert(certificateRequests).values({ requestId: cert!.id, certificateType: 'jovedelemigazolas', year: 2025, purpose: 'bank, lakáshitel', language: 'hu' });
  await deps.db.insert(requests).values({ clientId: R, direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az októberi bankszámlakivonatodat', body: 'Csak ellenőrzéshez kell. Elég a bankod appjából letöltött PDF.', dueDate: '2026-11-10', dossierMonth: '2026-10', createdBy: benceUser, createdAt: new Date('2026-11-02T06:10:00Z') });
  await deps.db.insert(requests).values({ clientId: P, direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az idei bankszámlakivonataidat', body: 'Az átálláshoz kell: január óta minden hónapé. Elég, ha a bankod appjából letöltött PDF-eket töltöd fel.', dueDate: '2026-11-24', createdBy: benceUser, createdAt: new Date('2026-11-11T09:00:00Z') });
  const msgs: { at: string; role: 'client' | 'accountant'; body: string; requestId?: string }[] = [
    { at: '2026-10-20T07:55:00Z', role: 'client', body: 'Levelet kaptam a NAV-tól, megijedtem. Feltöltöttem a dossziéba.' },
    { at: '2026-10-20T11:02:00Z', role: 'accountant', body: 'Megnéztem: csak értesítés, nincs teendőd. Elteheted.' },
    { at: '2026-11-02T06:10:00Z', role: 'accountant', body: 'Töltsd fel az októberi bankszámlakivonatodat.', requestId: kReq!.id },
    { at: '2026-11-14T09:00:00Z', role: 'client', body: 'Jövedelemigazolás 2025', requestId: cert!.id },
    { at: '2026-11-14T09:01:00Z', role: 'client', body: 'A bank kéri a lakáshitelhez. Mikorra lehet meg?' },
    { at: '2026-11-14T12:30:00Z', role: 'accountant', body: 'Beadtam a kérelmet a NAV-nál, pár napon belül itt lesz a dossziédban.' },
    { at: '2026-11-16T14:01:00Z', role: 'client', body: 'Feltöltöttem a Bodza Kiadóval kötött szerződést is.' },
    { at: '2026-11-17T08:31:00Z', role: 'accountant', body: 'Köszönöm, holnap ránézek.' },
  ];
  for (const m of msgs)
    await deps.db.insert(messages).values({
      clientId: K,
      senderUserId: m.role === 'client' ? kata.userId : benceUser,
      senderRole: m.role,
      kind: m.requestId ? 'keres_kartya' : 'szoveg',
      body: m.body,
      requestId: m.requestId ?? null,
      createdAt: new Date(m.at),
      readByClientAt: m.at < '2026-11-17' ? new Date(m.at) : null,
      readByAccountantAt: new Date(m.at),
    });

  // ---------- subscriptions (DEMO) ----------
  await subscriptionHistory(deps, clock, K, '2026-01-08', 11, 'xxxx-xxxx-xxxx-4193', 12);
  await subscriptionHistory(deps, clock, R, '2026-02-01', 10, 'xxxx-xxxx-xxxx-7781', 12);
  await subscriptionHistory(deps, clock, P, '2026-11-10', 1, 'xxxx-xxxx-xxxx-5520', 12);
  clock.real();

  // ---------- current estimates, flags ----------
  for (const id of [K, R, P]) {
    await recalcYear(deps, deps.db, id, 2026, {});
    await computeFlags(deps, deps.db, id);
  }
  // Seeded notifications are history: never send them out. Each one carries the time of its event
  // (notify() stamps the seed clock); everything older than two days counts as read an hour later.
  await deps.db.update(notifications).set({ pushSentAt: new Date(), emailSentAt: new Date() }).where(sql`${notifications.pushSentAt} is null or ${notifications.emailSentAt} is null`);
  await deps.db
    .update(notifications)
    .set({ readAt: sql`${notifications.createdAt} + interval '1 hour'` })
    .where(sql`${notifications.readAt} is null and ${notifications.createdAt} < ${new Date(deps.now().getTime() - 2 * 86_400_000)}`);

  await mkdir(dirname(o.credentialsFile), { recursive: true });
  await writeFile(o.credentialsFile, `${creds.join('\n')}\n`, { mode: 0o600 });
  return 'seeded';
}

/**
 * New random passwords for the seeded DEMO accounts (QA kör 2: the old ones were exposed in a review
 * transcript). Every session of those accounts ends. Only the seed's own @demo.kezjegy.test accounts change;
 * the new list goes ONLY to the credentials file (mode 600), nothing is printed.
 */
export async function rotateDemoPasswords(deps: Deps, o: { credentialsFile: string }): Promise<number> {
  const rows = await deps.db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(sql`${users.email} like ${'%@' + DOMAIN}`);
  const seeded = rows.filter((u) => u.email === `admin@${DOMAIN}` || u.email === `bence.kovacs@${DOMAIN}` || ['kata.szabo', 'reka.varga', 'peter.nemeth'].some((p) => u.email === `${p}@${DOMAIN}`));
  const order = (r: string) => (r === 'admin' ? 0 : r === 'accountant' ? 1 : 2);
  seeded.sort((a, b) => order(a.role) - order(b.role) || a.email.localeCompare(b.email));
  const creds: string[] = [`# ${brand.name} DEMO belépések – KITALÁLT fiókok. Ne add tovább, ne használd élesben.`, '# szerep;e-mail;jelszó'];
  for (const u of seeded) {
    const p = pw();
    await deps.db.update(users).set({ passwordHash: await hashPassword(p), failedLogins: 0, lockedUntil: null, updatedAt: deps.now() }).where(eq(users.id, u.id));
    await revokeAllSessions(deps, deps.db, u.id);
    creds.push(`${u.role === 'admin' ? 'admin' : u.role === 'accountant' ? 'konyvelo' : 'ugyfel'};${u.email};${p}`);
  }
  await mkdir(dirname(o.credentialsFile), { recursive: true });
  await writeFile(o.credentialsFile, `${creds.join('\n')}\n`, { mode: 0o600 });
  return seeded.length;
}
