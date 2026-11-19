// MINTA-szerver: a SPEC §12 ügyfél-végpontjai memóriában, kitalált adatokkal. Csak EXPO_PUBLIC_API_MODE=minta buildben
// töltődik be (src/api/http.ts dinamikusan importálja). Semmit nem küld sehova, nem tárol titkot.
// Forgatókönyv: az URL ?minta=kata|fizetendo|befizetve|ures|peter|uj paramétere (képernyőképekhez); kilépve ?minta=kint.
import { Platform } from 'react-native';
import type { AuthResult, ClientHome, DocumentListItem, Me, Message, OnboardingState, PublicConfig, RequestSummary, SubscriptionView, TaxPeriodDetail } from '../../_shared/api';
import type { Keres, Szallito, Valasz } from '../http';
import {
  BENCE, FORGATOKONYVEK, type Forgatokonyv, adoIdoszak, bevetelHavonta, dijszamlak, dosszieNezet, elofizetes, ertesitesek,
  hataridok, iratReszlet, kataKeresek, kataUzenetek, katasIratok, keretek, navSzamla, navSzamlak, onboardingAllapot, Q3_LEVEL,
} from './adatok';
import { maBeallit } from '../../ui/ido';
import {
  bekotes1118, hozzaferes1118, igeret, kezdo1118, magyarazatok, maskHuPhone, normalizeHuPhone, regFrissit, regisztracio, utmutato1118,
  valaszokBol, visszahivas, zartFunkcio, type Allapot1118,
} from './tulaj1118';
import { ASSIST_CALLBACK_TOPIC, GUIDE_KINDS, PATH_CHANGE_BLOCKER_TEXT, type AssistKind, type CallbackTopic, type CallbackWindow, type GuideKind } from '../../_shared/enums';
import { bekotes1119, engedelyOsszegzes, kezdo1119, NYITOTT_SEGITSEG, segitsegNezet, type Allapot1119 } from './tulaj1119';
import { utmutatoEpit } from '../../lib/utmutato';
import { munkanapotHozzaad, napKulcs } from '../../lib/ut';
import { k28CsendBeallit, k28Home, k28Kezdo, k28Me, k28SzamlaTartalek, k28Utak, type K28Allapot } from './k28';

const tarolt = (k: string, v?: string | null): string | null => {
  try {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* privát ablak: memóriában marad */
  }
  return null;
};

function kezdoForgatokonyv(): { fk: Forgatokonyv; belepve: boolean } {
  let param: string | null = null;
  try {
    if (Platform.OS === 'web' && typeof location !== 'undefined') param = new URLSearchParams(location.search).get('minta');
  } catch {
    /* nincs location */
  }
  if (param === 'kint') {
    tarolt('kj_minta', null);
    return { fk: 'kata', belepve: false };
  }
  if (param && (FORGATOKONYVEK as string[]).includes(param)) {
    tarolt('kj_minta', param);
    return { fk: param as Forgatokonyv, belepve: true };
  }
  const t = tarolt('kj_minta');
  if (t && (FORGATOKONYVEK as string[]).includes(t)) return { fk: t as Forgatokonyv, belepve: true };
  return { fk: 'kata', belepve: false };
}

const kezdo = kezdoForgatokonyv();
const S = {
  fk: kezdo.fk,
  belepve: kezdo.belepve,
  ma: '2026-11-17',
  totp: false,
  bio: false,
  fizetve: kezdo.fk === 'befizetve',
  iratok: [] as DocumentListItem[],
  uzenetek: [] as Message[],
  keresek: [] as RequestSummary[],
  elofizetes: elofizetes() as SubscriptionView,
  onboarding: null as OnboardingState | null,
  kyc: 'nincs' as string,
  szamlalo: 1,
  t: kezdo1118(kezdo.fk) as Allapot1118,
  u: { assists: [], chamber: null, pathChangedAt: null, szamlalo: 1 } as Allapot1119,
  k: k28Kezdo(kezdo.fk, '2026-11-17') as K28Allapot,
};
const BEKOTES_FK = ['peter', 'uj', 'indul', 'utmutato', 'levente', 'marika', 'david', 'ilona', 'engedely', 'bekuldve', 'kamara', 'tamas'];
function beallit(fk: Forgatokonyv) {
  S.fk = fk;
  S.ma = fk === 'fizetendo' || fk === 'befizetve' ? '2026-10-09' : fk === 'ures' ? '2026-11-02' : '2026-11-17';
  S.fizetve = fk === 'befizetve';
  S.iratok = katasIratok(S.ma);
  S.keresek =
    fk === 'peter'
      ? [{ id: 'keres-peter-kivonat', direction: 'konyvelotol', type: 'dokumentum', title: 'Töltsd fel az idei bankszámlakivonataidat.', body: 'Januártól októberig, a bankod appjából PDF-ben. A tavalyi bevallásodat Bence maga tölti le a NAV-tól.', status: 'nyitott', statusLabel: 'Nyitott', dueDate: '2026-11-24', createdAt: '2026-11-16T09:00:00Z' }]
      : BEKOTES_FK.includes(fk)
        ? []
        : kataKeresek(S.ma).filter((k) => k.createdAt.slice(0, 10) <= S.ma);
  S.uzenetek = BEKOTES_FK.includes(fk) ? [] : kataUzenetek().filter((m) => m.createdAt.slice(0, 10) <= S.ma);
  S.onboarding = BEKOTES_FK.includes(fk) ? onboardingAllapot(fk === 'peter' ? 'peter' : 'uj') : null;
  if (S.onboarding && ['indul', 'utmutato', 'levente'].includes(fk))
    S.onboarding.steps = S.onboarding.steps.map((x) => (x.step === 'adatok' || (fk === 'levente' && x.step === 'szerzodes') ? { ...x, status: 'kesz', completedAt: '2026-11-15T09:00:00Z' } : x));
  S.kyc = BEKOTES_FK.includes(fk) && fk !== 'peter' ? 'nincs' : 'elfogadva';
  S.t = kezdo1118(fk);
  S.u = kezdo1119(fk, S.t, S.onboarding, S.ma);
  S.k = k28Kezdo(fk, S.ma);
  maBeallit(S.ma);
}
beallit(S.fk);

const KATA = { id: 'minta-ugyfel-kata', email: 'kata.szabo@demo.kezjegy.test', nev: 'Szabó Kata', firstName: 'Kata', lastName: 'Szabó' };
const PETER = { id: 'minta-ugyfel-peter', email: 'peter.nemeth@demo.kezjegy.test', nev: 'Németh Péter', firstName: 'Péter', lastName: 'Németh' };
const LEVENTE = { id: 'minta-ugyfel-levente', email: 'levente.toth@demo.kezjegy.test', nev: 'Tóth Levente', firstName: 'Levente', lastName: 'Tóth' };
const MARIKA = { id: 'minta-ugyfel-marika', email: 'marika.kiss@demo.kezjegy.test', nev: 'Kiss Marika', firstName: 'Marika', lastName: 'Kiss' };
const DAVID = { id: 'minta-ugyfel-david', email: 'david.molnar@demo.kezjegy.test', nev: 'Molnár Dávid', firstName: 'Dávid', lastName: 'Molnár' };
const ILONA = { id: 'minta-ugyfel-ilona', email: 'ilona.balogh@demo.kezjegy.test', nev: 'Balogh Ilona', firstName: 'Ilona', lastName: 'Balogh' };
// SPEC §28.11 / §28.K.21 kitalált személyei (csak a MINTA buildben)
const K6_SZEMELYEK: Record<string, { id: string; email: string; nev: string; firstName: string; lastName: string }> = {
  eszter: { id: 'minta-ugyfel-eszter', email: 'eszter.szabo@demo.kezjegy.test', nev: 'Szabó Eszter', firstName: 'Eszter', lastName: 'Szabó' },
  balint: { id: 'minta-ugyfel-balint', email: 'balint.toth@demo.kezjegy.test', nev: 'Tóth Bálint', firstName: 'Bálint', lastName: 'Tóth' },
  norbert: { id: 'minta-ugyfel-norbert', email: 'norbert.kiss@demo.kezjegy.test', nev: 'Kiss Norbert', firstName: 'Norbert', lastName: 'Kiss' },
  adam: { id: 'minta-ugyfel-adam', email: 'adam.kovacs@demo.kezjegy.test', nev: 'Kovács Ádám', firstName: 'Ádám', lastName: 'Kovács' },
  zarolt: { id: 'minta-ugyfel-ilona-f', email: 'ilona.fazekas@demo.kezjegy.test', nev: 'Fazekas Ilona', firstName: 'Ilona', lastName: 'Fazekas' },
  szunetel: { id: 'minta-ugyfel-csilla', email: 'csilla.molnar@demo.kezjegy.test', nev: 'Molnár Csilla', firstName: 'Csilla', lastName: 'Molnár' },
  tamas: { id: 'minta-ugyfel-tamas', email: 'tamas.barany@demo.kezjegy.test', nev: 'Bárány Tamás', firstName: 'Tamás', lastName: 'Bárány' },
};
const szemely = () =>
  K6_SZEMELYEK[S.fk] ??
  (S.fk === 'peter' || S.fk === 'uj'
    ? PETER
    : ['indul', 'utmutato', 'levente', 'kamara'].includes(S.fk)
      ? LEVENTE
      : ['marika', 'engedely', 'bekuldve'].includes(S.fk)
        ? MARIKA
        : S.fk === 'david'
          ? DAVID
          : S.fk === 'ilona'
            ? ILONA
            : KATA);
const nyitottKeresDb = () => S.keresek.filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')).length;
const bekotesNezet = () => (S.onboarding ? bekotes1119(bekotes1118(S.onboarding, S.t), S.t, S.u, S.ma, nyitottKeresDb()) : null);

function authEredmeny(uj = false): AuthResult {
  const p = szemely();
  return {
    accessToken: 'MINTA-' + Math.random().toString(36).slice(2),
    accessTokenExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    refreshToken: Platform.OS === 'web' ? undefined : 'MINTA-RT',
    user: { id: p.id, email: p.email, role: 'client', displayName: p.nev, emailVerified: S.fk !== 'uj' || !uj, totpEnabled: S.totp },
    isNewUser: uj || undefined,
  };
}

// ---------- válasz-segédek ----------
function valasz(status: number, test?: unknown, fejlecek: Record<string, string> = {}): Valasz {
  return {
    status,
    fejlec: (n) => fejlecek[n] ?? fejlecek[n.toLowerCase()] ?? null,
    json: async () => (test === undefined ? null : JSON.parse(JSON.stringify(test))),
    blob: async () => new Blob([typeof test === 'string' ? test : JSON.stringify(test)], { type: fejlecek['Content-Type'] ?? 'application/octet-stream' }),
  };
}
const ok = (t: unknown) => valasz(200, t);
const hiba = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, fields?: Record<string, string>, feature?: string) =>
  valasz(status, { error: { code, message, fields, feature }, ...extra });

const honapKulcs = (nap: string) => nap.slice(0, 7);
function mintaHome(): ClientHome {
  const ma = S.ma;
  const q3 = S.fk === 'fizetendo' || S.fk === 'befizetve';
  const period = q3 ? adoIdoszak('2026-Q3', S.fizetve ? 'befizetve' : 'fizetendo', ma) : adoIdoszak('2026-Q4', 'becsles', ma);
  const honap = ma.slice(0, 7);
  const iratok = S.iratok.filter((d) => d.dossierMonth === (q3 ? '2026-10' : honap));
  const navDb = navSzamlak(honap, ma, 'feltoltve').length;
  const daysLeft = Math.round((Date.parse(period.dueDate) - Date.parse(ma)) / 86400000);
  const hl = hataridok(ma, 392_661).filter((d) => d.status !== 'kesz' && d.daysLeft >= 0);
  if (S.onboarding) {
    const p = szemely();
    return {
      today: ma, demo: true, client: { id: p.id, firstName: p.firstName, lifecycle: 'bekotes_alatt', onboardingComplete: false }, accountant: BENCE,
      hero: { state: 'bekotes_alatt' }, letter: null, paymentItems: [], requestsFromAccountant: [], limits: keretek(ma), revenueByMonth: [],
      currentDossier: { month: honapKulcs(ma), label: 'Novemberi dosszié', items: [], totalCount: 0 }, nextDeadline: null,
    };
  }
  return {
    today: ma,
    demo: true,
    client: { id: szemely().id, firstName: szemely().firstName, lifecycle: 'aktiv', onboardingComplete: true },
    accountant: BENCE,
    hero: q3
      ? S.fizetve
        ? { state: 'befizetve', periodId: period.id, periodKey: period.periodKey, periodLabel: period.label, amountHuf: period.totalHuf ?? 0, dueDate: period.dueDate, daysLeft, paidOn: '2026-10-09', verified: false }
        : { state: 'jovahagyva', periodId: period.id, periodKey: period.periodKey, periodLabel: period.label, amountHuf: period.totalHuf ?? 0, dueDate: period.dueDate, daysLeft }
      : { state: 'becsles', periodId: period.id, periodKey: period.periodKey, periodLabel: period.label, amountHuf: period.totalHuf ?? 0, dueDate: period.dueDate, daysLeft, note: 'Bence a negyedév végén véglegesíti.' },
    letter: q3 ? Q3_LEVEL : null,
    paymentItems: period.items,
    requestsFromAccountant: S.keresek.filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')),
    limits: keretek(ma),
    revenueByMonth: bevetelHavonta(ma),
    currentDossier: {
      month: q3 ? '2026-10' : honap,
      label: q3 ? 'Októberi dosszié' : `${honap === '2026-11' ? 'Novemberi' : 'Havi'} dosszié`,
      items: iratok.filter((d) => d.source === 'ugyfel').slice(0, 2),
      totalCount: iratok.length + navDb,
    },
    nextDeadline: hl[0] ?? null,
    ...k28Home(S.k, ma, true),
  };
}

function idoszakReszlet(id: string): TaxPeriodDetail | null {
  if (id === 'ido-2026-Q3') {
    if (S.fk === 'fizetendo') return adoIdoszak('2026-Q3', S.fizetve ? 'befizetve' : 'fizetendo', S.ma);
    if (S.fk === 'befizetve') return adoIdoszak('2026-Q3', S.fizetve ? 'befizetve' : 'fizetendo', S.ma);
    return adoIdoszak('2026-Q3', 'ellenorizve', S.ma);
  }
  if (id === 'ido-2026-Q4') return adoIdoszak('2026-Q4', 'becsles', S.ma);
  return null;
}

function me(): Me {
  const p = szemely();
  const r = authEredmeny();
  return {
    user: r.user,
    client: { id: p.id, firstName: p.firstName, lastName: p.lastName, lifecycle: S.onboarding ? 'bekotes_alatt' : 'aktiv', onboardingComplete: !S.onboarding, personalReferralCode: S.onboarding ? null : 'KATA7Q2X', taxRegime: 'atalany', serviceLock: k28Me(S.k).serviceLock },
    accountant: BENCE,
    access: hozzaferes1118(!!S.onboarding, bekotesNezet()?.todoCount ?? 0),
    notificationPrefs: [
      { kind: 'tax_approved', push: true, email: true },
      { kind: 'tax_due_soon', push: true, email: true },
      { kind: 'request_new', push: true, email: true },
      { kind: 'message_new', push: true, email: false },
      { kind: 'document_processed', push: true, email: false },
      { kind: 'limit_warning', push: true, email: true },
      { kind: 'invoice_new', push: true, email: false },
      { kind: 'allowance_decided', push: true, email: true },
      { kind: 'allowance_check', push: true, email: false },
      { kind: 'checkin_due', push: true, email: false },
      { kind: 'nudge', push: true, email: false },
      { kind: 'upload_reminder', push: true, email: false },
    ],
    consentsNeeded: [],
    notificationSettings: k28Me(S.k).notificationSettings,
  };
}

const LEGAL_CIM: Record<string, string> = {
  aszf: 'Általános szerződési feltételek',
  adatkezeles: 'Adatkezelési tájékoztató',
  megbizasi_szerzodes: 'Megbízási szerződés',
  nav_meghatalmazas: 'Meghatalmazás a NAV-nál',
  pmt_nyilatkozatok: 'Nyilatkozatok az azonosításhoz',
  simplepay_adattovabbitas: 'Adattovábbítási nyilatkozat',
  simplepay_ismetlodo: 'Ismétlődő bankkártyás fizetés',
  app_szovegek: 'Tudnivalók',
};

// ---------- útválasztás ----------
type Kezelo = (m: RegExpMatchArray, q: URLSearchParams, test: Record<string, unknown>, k: Keres) => Valasz | Promise<Valasz> | undefined;
const utak: [string, RegExp, Kezelo][] = [];
const ut = (method: string, minta: string, f: Kezelo) => utak.push([method, new RegExp('^' + minta.replace(/:([a-zA-Z]+)/g, '([^/]+)') + '$'), f]);
const kell = () => (S.belepve ? null : hiba(401, 'unauthenticated', 'Lépj be újra.'));

ut('GET', '/config', () =>
  ok({
    brand: { name: '', tagline: '', subline: '', priceHufMonthlyGross: 19999 },
    appEnv: 'demo',
    demo: true,
    features: { googleSignIn: false, appleSignIn: false, totp: true },
    googleClientIds: {},
    legal: { aszf: '2026-11-17', adatkezeles: '2026-11-17', megbizasi_szerzodes: '2026-11-17', simplepay_adattovabbitas: '2026-11-17', simplepay_ismetlodo: '2026-11-17' },
    simplepayMode: 'demo',
  } satisfies PublicConfig),
);
ut('POST', '/auth/login', (_m, _q, t) => {
  const email = String(t.email ?? '');
  if (!email.includes('@') || String(t.password ?? '').length < 1) return hiba(401, 'invalid_credentials', 'Az e-mail-cím vagy a jelszó nem jó.');
  if (email.startsWith('2fa') || S.totp) return hiba(401, 'mfa_required', 'Írd be a kódot a hitelesítő appodból.', { mfaToken: 'MINTA-MFA' });
  if (email.startsWith('peter')) beallit('peter');
  S.belepve = true;
  tarolt('kj_minta', S.fk);
  return ok(authEredmeny());
});
ut('POST', '/auth/login/totp', (_m, _q, t) => {
  if (!/^\d{6}$|^[A-Z0-9-]{8,}$/i.test(String(t.code ?? ''))) return hiba(401, 'invalid_code', 'Ez a kód nem jó. Nézd meg az appban az újat.');
  S.belepve = true;
  tarolt('kj_minta', S.fk);
  return ok(authEredmeny());
});
ut('POST', '/auth/register', (_m, _q, t) => {
  if (String(t.password ?? '').length < 10) return hiba(400, 'validation_failed', 'Nézd át a pirossal jelölt mezőt.', {}, { password: 'Legalább 10 karakter legyen.' });
  beallit('uj');
  S.belepve = true;
  tarolt('kj_minta', 'uj');
  const r = authEredmeny(true);
  r.user.emailVerified = false;
  return valasz(201, r);
});
ut('POST', '/auth/email/verify', (_m, _q, t) => (/^\d{6}$/.test(String(t.code)) ? ok({ emailVerified: true }) : hiba(400, 'invalid_code', 'Ez a kód nem jó vagy lejárt.')));
ut('POST', '/auth/email/resend', () => valasz(204));
ut('POST', '/auth/refresh', () => (S.belepve ? ok(authEredmeny()) : hiba(401, 'unauthenticated', 'Lépj be újra.')));
ut('POST', '/auth/logout', () => {
  S.belepve = false;
  tarolt('kj_minta', null);
  return valasz(204);
});
ut('POST', '/auth/logout-all', () => {
  S.belepve = false;
  tarolt('kj_minta', null);
  return valasz(204);
});
ut('POST', '/auth/password/forgot', () => valasz(202));
ut('POST', '/auth/password/reset', (_m, _q, t) => (/^\d{6}$/.test(String(t.code)) ? valasz(204) : hiba(400, 'invalid_code', 'Ez a kód nem jó vagy lejárt.')));
ut('POST', '/auth/password/change', () => valasz(204));
ut('POST', '/auth/totp/setup', () => ok({ secret: 'MINTAMINTAMINTAMINTA2345', otpauthUrl: 'otpauth://totp/Minta:kata.szabo%40demo.kezjegy.test?secret=MINTAMINTAMINTAMINTA2345&issuer=Minta' }));
ut('POST', '/auth/totp/enable', (_m, _q, t) => {
  if (!/^\d{6}$/.test(String(t.code))) return hiba(400, 'invalid_code', 'Ez a kód nem jó. Nézd meg az appban az újat.');
  S.totp = true;
  return ok({ recoveryCodes: Array.from({ length: 10 }, (_, i) => `MINTA-${String(1000 + i * 137).slice(0, 4)}-${String(9000 - i * 71).slice(0, 4)}`) });
});
ut('POST', '/auth/totp/disable', () => {
  S.totp = false;
  return valasz(204);
});
ut('GET', '/auth/sessions', () =>
  ok({ items: [
    { id: 's1', clientKind: Platform.OS === 'web' ? 'web' : 'native', userAgent: Platform.OS === 'web' ? 'Böngésző' : 'Telefon', lastUsedAt: new Date().toISOString(), current: true },
    { id: 's2', clientKind: 'web', userAgent: 'Chrome, Windows', lastUsedAt: '2026-11-12T18:20:00Z', current: false },
  ] }),
);
ut('DELETE', '/auth/sessions/:id', () => valasz(204));
ut('POST', '/auth/google', () => hiba(503, 'not_configured', 'A Google-belépés még nincs bekapcsolva.'));
ut('POST', '/auth/apple', () => hiba(503, 'not_configured', 'Az Apple-belépés még nincs bekapcsolva.'));

ut('GET', '/me', () => kell() ?? ok(me()));
ut('PATCH', '/me', (_m, _q, t) => {
  if (t.notificationSettings && typeof t.notificationSettings === 'object') k28CsendBeallit(S.k, t.notificationSettings as Record<string, never>);
  return kell() ?? ok(me());
});
ut('POST', '/me/push-tokens', () => valasz(204));
// SPEC §28.2.4: az új kiállított számla értesítése (egy számla → a számla; több → /felretesz), a NAV-szinkron után
const ujSzamlaErtesites = () =>
  S.onboarding
    ? []
    : [
        { id: 'e-uj-1', kind: 'invoice_new' as const, title: 'Új kiállított számlád: 240 000 Ft', body: 'Bodza Kiadó Kft. Tegyél félre kb. 20 000 Ft-ot.', createdAt: `${S.ma}T07:00:00Z`, link: '/szamla/nav-KSZ-2026-033', readAt: null },
        { id: 'e-uj-2', kind: 'invoice_new' as const, title: '2 új kiállított számlád: összesen 402 000 Ft', body: 'Tegyél félre kb. 34 000 Ft-ot. Megnézem, melyik mennyi.', createdAt: `${S.ma}T06:59:00Z`, link: '/felretesz', readAt: null },
      ];
ut('GET', '/me/notifications', () => kell() ?? ok({ items: [...ujSzamlaErtesites(), ...ertesitesek(S.ma)], nextCursor: null }));
ut('POST', '/me/notifications/read', () => valasz(204));
ut('POST', '/me/consents', () => valasz(204));
ut('POST', '/me/export', () => valasz(202, { exportId: 'exp1' }));
ut('GET', '/me/exports', () => ok({ items: [{ id: 'exp1', status: 'keszul', createdAt: new Date().toISOString(), expiresAt: null }] }));
ut('POST', '/me/delete', () => valasz(202, { deletionDueAt: '2026-12-17' }));
ut('POST', '/me/delete/cancel', () => valasz(204));
ut('GET', '/legal/:doc', (m) =>
  ok({
    docType: m[1],
    version: '2026-11-17',
    title: LEGAL_CIM[m[1]] ?? m[1],
    markdown: `# ${LEGAL_CIM[m[1]] ?? m[1]}\n\n**MINTA – a valódi szöveget a jogász véglegesíti.** Ez a képernyő bemutató módban fut, a végleges jogi szöveg a szerverről jön.\n\n## Röviden\n\n- A szolgáltatást a Somosi Kft. nyújtja, havi 20 000 Ft-ért.\n- A könyvelőd a NAV felé a meghatalmazottad.\n- Bármikor lemondhatod; a már kifizetett hónap végéig minden marad.\n`,
  }),
);
ut('GET', '/content/faq', () =>
  ok({ items: [
    { id: 'f1', question: 'Mit csinál a könyvelőm?', answer: 'Kiszámolja, mennyit kell befizetned, beadja a bevallásaidat, és válaszol a kérdéseidre.' },
    { id: 'f2', question: 'Kell-e nekem a NAV-nak bármit küldenem?', answer: 'Nem. A könyvelőd a meghatalmazottad, ő intézi.' },
    { id: 'f3', question: 'Miért nem kell feltöltenem a kiállított számláimat?', answer: 'Minden számla, amit a számlázóprogramodban kiállítasz, automatikusan bekerül a NAV rendszerébe. Mi onnan töltjük le, ezért nem kell feltöltened őket. Ami nincs benne: a számla nélküli eladás (pl. nyugta) – azt külön jelezd.' },
    { id: 'f4', question: 'Mit kell feltöltenem?', answer: 'A kézzel adott nyugtákat, a pénztárgép-összesítőt, a bankszámlakivonatot, ha a könyvelőd kéri, és a leveleket, amiket a NAV küldött neked.' },
    { id: 'f5', question: 'Hogyan mondhatom le?', answer: 'A Fiók oldalon, az Előfizetésnél. A kifizetett hónap végéig minden marad.' },
    { id: 'f6', question: 'Ki látja az adataimat?', answer: 'Csak a könyvelőd. Az iratokat titkosítva tároljuk.' },
    { id: 'f7', question: 'Mi az a költséghányad?', answer: 'Az átalányadóban a bevételed egy részét költségnek veszi a NAV, a többi a jövedelmed. 2026-ban ez a legtöbb tevékenységnél 45%.' },
    { id: 'f8', question: 'Mi történik, ha elfelejtek befizetni?', answer: 'Előtte emlékeztetünk. Ha mégis késik, a könyvelőd megmondja, mit tegyél.' },
  ] }),
);

// --- ügyfél: bekötés ---
ut('GET', '/client/onboarding', () =>
  kell() ??
  ok({
    ...(bekotesNezet() ?? bekotes1119(bekotes1118(onboardingAllapot('peter'), S.t), S.t, S.u, S.ma, 0)),
    onyaGuide: {
      accountantTaxId: '8428621233',
      ugykorok: ['Személyi jövedelemadó (SZJA) bevallás és bevallás-tervezet', 'Járulékbevallás (2658) és a járulékok', 'Adószámla, folyószámla lekérdezése', 'Online Számla adatok lekérdezése', 'Elektronikus tárhely (értesítések) olvasása'],
    },
  }),
);
ut('PUT', '/client/profile', (_m, _q, t) => {
  if (S.onboarding && S.t.path == null && t.adoszam) return hiba(409, 'path_required', 'Előbb válaszolj a kérdésre: van már egyéni vállalkozásod?');
  if (S.onboarding) S.onboarding.steps = S.onboarding.steps.map((s) => (s.step === 'adatok' ? { ...s, status: 'kesz', completedAt: new Date().toISOString() } : s));
  return ok({ ...t, adoazonositoJelMasked: '•••••••' + String(t.adoazonositoJel ?? '').slice(-3), suggestedCostRatio: t.activityAnswer === 'lista80' ? 80 : t.activityAnswer === 'kiskereskedelem' ? 90 : 45, confirmedCostRatio: null });
});
ut('GET', '/client/profile', () =>
  kell() ??
  ok({
    firstName: szemely().firstName, lastName: szemely().lastName, phone: '+36 20 000 0000', adoszam: S.fk === 'peter' ? '68707893-1-06' : '68801234-1-41', evNyilvantartasiSzam: '00000000',
    address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' }, hqMunicipality: 'Budapest', activityText: 'Grafikai tervezés és illusztráció', activityAnswer: 'egyeb',
    taxStatus: 'fofoglalkozasu', evSince: '2019-03-01', hasSeparateBusinessAccount: true, adoazonositoJelMasked: '•••••••569', suggestedCostRatio: 45, confirmedCostRatio: 45,
  }),
);
function lepes(step: string, status: 'kesz' | 'konyvelore_var') {
  if (S.onboarding) S.onboarding.steps = S.onboarding.steps.map((s) => (s.step === step ? { ...s, status, completedAt: new Date().toISOString() } : s));
  if (S.onboarding) S.onboarding.todoCount = S.onboarding.steps.filter((s) => s.status === 'ugyfelre_var' && s.step !== 'idopont').length;
}
ut('POST', '/client/onboarding/meghatalmazas', () => {
  lepes('meghatalmazas', 'konyvelore_var');
  return ok(S.onboarding);
});
ut('POST', '/client/kyc', () => {
  S.kyc = 'bekuldve';
  lepes('azonositas', 'konyvelore_var');
  return ok({ status: 'bekuldve' });
});
ut('GET', '/client/kyc', () => ok({ status: S.kyc }));
ut('GET', '/client/legal-pdf/:doc', () => valasz(200, '%PDF-1.4 MINTA', { 'Content-Type': 'application/pdf' }));

// --- főoldal, adó ---
ut('GET', '/client/home', () => kell() ?? ok(mintaHome()));
ut('GET', '/client/tax-periods', () => kell() ?? ok({ items: ['ido-2026-Q3', 'ido-2026-Q4'].map((id) => idoszakReszlet(id)).filter(Boolean) }));
ut('GET', '/client/tax-periods/:id', (m) => kell() ?? (idoszakReszlet(m[1]) ? ok(idoszakReszlet(m[1])) : hiba(404, 'not_found', 'Nem találjuk.')));
ut('POST', '/client/tax-periods/:id/mark-paid', (m) => {
  S.fizetve = true;
  return ok(idoszakReszlet(m[1]));
});
ut('POST', '/client/tax-periods/:id/unmark-paid', (m) => {
  S.fizetve = false;
  return ok(idoszakReszlet(m[1]));
});
ut('GET', '/client/revenue', () => ok({ year: 2026, byMonth: bevetelHavonta(S.ma).map((b) => ({ ...b, estimated: false })), totalHuf: bevetelHavonta(S.ma).reduce((a, b) => a + b.amountHuf, 0), meters: keretek(S.ma) }));

// --- dosszié ---
ut('GET', '/client/dossiers', () => {
  const most = Number(S.ma.slice(5, 7));
  const months = Array.from({ length: most }, (_, i) => {
    const hk = `2026-${String(i + 1).padStart(2, '0')}`;
    const v = dosszieNezet(hk, S.ma, S.iratok, S.keresek);
    const docs = v.sentByMe.length + v.fromNav.letters.length + v.filedByAccountant.length;
    return { month: hk, label: v.label, documentCount: docs + v.fromNav.invoices.count, waitingCount: v.sentByMe.filter((d) => d.status === 'feltoltve').length, navInvoiceCount: v.fromNav.invoices.count };
  }).reverse();
  return ok({ months });
});
ut('GET', '/client/dossiers/:month', (m) => kell() ?? ok(dosszieNezet(m[1], S.ma, S.fk === 'ures' ? S.iratok.filter((d) => d.dossierMonth !== '2026-11') : S.iratok, S.keresek)));
ut('GET', '/client/documents/:id', (m) => {
  const d = S.iratok.find((x) => x.id === m[1]);
  return d ? ok(iratReszlet(d, S.ma)) : hiba(404, 'not_found', 'Ezt az iratot nem találjuk.');
});
ut('POST', '/client/documents', (_m, _q, _t, k) => {
  const f = k.body instanceof FormData ? k.body : null;
  const kat = (f?.get('category') as string) || 'egyeb';
  const honap = (f?.get('dossierMonth') as string) || S.ma.slice(0, 7);
  const lapok = f ? f.getAll('pages[]').length || 1 : 1;
  const nevek: Record<string, string> = { nyugta: 'Nyugta', koltseg_bizonylat: 'Számla', bankszamlakivonat: 'Bankszámlakivonat', szerzodes: 'Szerződés', egyeb: 'Irat', nav_level: 'Levél a NAV-tól' };
  const uj: DocumentListItem = {
    id: `uj-${S.szamlalo++}`,
    title: (f?.get('title') as string) || nevek[kat] || 'Irat',
    category: kat as DocumentListItem['category'],
    source: 'ugyfel',
    status: 'feltoltve',
    statusLabel: 'Feltöltve',
    statusAt: new Date().toISOString(),
    dossierMonth: honap,
    icon: kat === 'nyugta' || kat === 'koltseg_bizonylat' ? 'nyugta' : 'irat',
    pageCount: lapok,
  };
  S.iratok.push(uj);
  const keres = f?.get('requestId') as string | null;
  if (keres) S.keresek = S.keresek.map((r) => (r.id === keres ? { ...r, status: 'teljesitve', statusLabel: 'Kész' } : r));
  return valasz(201, iratReszlet(uj, S.ma));
});
ut('POST', '/client/documents/:id/versions', (m) => {
  const d = S.iratok.find((x) => x.id === m[1]);
  if (!d) return hiba(404, 'not_found', 'Ezt az iratot nem találjuk.');
  d.status = 'feltoltve';
  d.statusLabel = 'Feltöltve';
  return ok(iratReszlet(d, S.ma));
});
ut('DELETE', '/client/documents/:id', (m) => {
  const d = S.iratok.find((x) => x.id === m[1]);
  if (!d) return hiba(404, 'not_found', 'Ezt az iratot nem találjuk.');
  if (d.status !== 'feltoltve') return hiba(409, 'conflict', 'Ezt Bence már látta, ezért nem törölhető. Tölts fel új változatot.');
  S.iratok = S.iratok.filter((x) => x !== d);
  return valasz(204);
});
ut('GET', '/client/nav-invoices', (_m, q) => {
  const honap = q.get('month') ?? S.ma.slice(0, 7);
  return ok({ items: navSzamlak(honap, S.ma, honap < '2026-10' ? 'beadva' : honap === '2026-10' ? 'feldolgozva' : 'feltoltve').map((x) => ({ ...x, reserve: k28SzamlaTartalek(S.k, x.id, S.ma, !S.onboarding) })) });
});
ut('GET', '/client/nav-invoices/:id', (m) => (navSzamla(m[1]) ? ok({ ...navSzamla(m[1]), reserve: k28SzamlaTartalek(S.k, m[1], S.ma, !S.onboarding) }) : hiba(404, 'not_found', 'Ezt a számlát nem találjuk.')));
ut('POST', '/files/:id/link', (m) => ok({ url: `minta:${m[1]}`, expiresAt: new Date(Date.now() + 300_000).toISOString() }));

// --- üzenetek, kérések ---
ut('GET', '/client/messages', () => kell() ?? ok({ items: S.uzenetek, nextCursor: null }));
ut('POST', '/client/messages', (_m, _q, t) => {
  const uj: Message = { id: `m${S.szamlalo++}`, kind: 'szoveg', body: String(t.body ?? ''), sender: 'en', createdAt: new Date().toISOString(), attachments: ((t.fileIds as string[]) ?? []).map((id) => ({ fileId: id, displayName: 'Csatolmány', mime: 'image/jpeg' })) };
  S.uzenetek = [uj, ...S.uzenetek];
  return ok(uj);
});
ut('POST', '/client/attachments', () => ok({ fileId: `csatolmany-${S.szamlalo++}` }));
ut('POST', '/client/messages/read', () => valasz(204));
ut('GET', '/client/requests', () => kell() ?? ok({ items: S.keresek }));
ut('POST', '/client/requests', (_m, _q, t) => {
  const cimek: Record<string, string> = {
    jovedelemigazolas: 'Jövedelemigazolás', nullas_igazolas: 'Nullás igazolás', koztartozasmentes_igazolas: 'Köztartozásmentességi igazolás',
    adatvaltozas: 'Megváltozott egy adatom', tevekenysegvaltozas: 'Változik a tevékenységem', kerdes: 'Kérdés',
  };
  const cert = t.certificate as RequestSummary['certificate'] | undefined;
  const r: RequestSummary = {
    id: `k${S.szamlalo++}`, direction: 'ugyfeltol', type: t.type as RequestSummary['type'],
    title: (t.title as string) || `${cimek[String(t.type)] ?? 'Kérés'}${cert?.year ? `, ${cert.year}` : ''}`,
    body: String(t.body ?? ''), status: 'nyitott', statusLabel: 'Elküldve, Bence hamarosan megnézi', createdAt: new Date().toISOString(), certificate: cert,
  };
  S.keresek = [r, ...S.keresek];
  S.uzenetek = [{ id: `m${S.szamlalo++}`, kind: 'keres_kartya', body: '', sender: 'en', createdAt: r.createdAt, attachments: [], request: r }, ...S.uzenetek];
  return ok(r);
});
ut('POST', '/client/requests/:id/complete', (m) => {
  S.keresek = S.keresek.map((r) => (r.id === m[1] ? { ...r, status: 'teljesitve', statusLabel: 'Kész' } : r));
  return ok(S.keresek.find((r) => r.id === m[1]));
});
ut('POST', '/client/requests/:id/cancel', (m) => {
  S.keresek = S.keresek.map((r) => (r.id === m[1] ? { ...r, status: 'visszavonva', statusLabel: 'Visszavontad' } : r));
  return ok(S.keresek.find((r) => r.id === m[1]));
});

// --- határidők, időpontok ---
ut('GET', '/client/deadlines', () => kell() ?? ok({ items: hataridok(S.ma, 392_661) }));
ut('GET', '/client/deadlines/:id/ics', () => valasz(200, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { 'Content-Type': 'text/calendar' }));
// SPEC §26.2.9: az időpontfoglalás megszűnt.
ut('GET', '/client/appointments/slots', () => ok({ enabled: false, slots: [] }));
ut('GET', '/client/appointments', () => ok({ items: [] }));
ut('POST', '/client/appointments', () => hiba(410, 'megszunt_funkcio', 'Időpontot már nem lehet foglalni. Kérj visszahívást.'));
ut('POST', '/client/appointments/:id/cancel', () => hiba(410, 'megszunt_funkcio', 'Időpontot már nem lehet foglalni. Kérj visszahívást.'));

// --- előfizetés ---
ut('GET', '/client/subscription', () => kell() ?? ok(S.fk === 'uj' ? { ...S.elofizetes, status: 'incomplete', card: undefined, nextChargeAt: undefined, currentPeriodEnd: undefined } : S.elofizetes));
ut('POST', '/client/subscription/start', () =>
  ok({ paymentUrl: 'minta:fizetes', orderRef: 'KJ-20261117-MINTA00001', tokenInfo: { times: 12, maxAmountHuf: 19999, until: '2027-11-17T00:00:00Z' } }),
);
ut('POST', '/client/subscription/cancel', () => {
  S.elofizetes = { ...S.elofizetes, cancelAtPeriodEnd: true };
  return ok(S.elofizetes);
});
ut('POST', '/client/subscription/resume', () => {
  S.elofizetes = { ...S.elofizetes, cancelAtPeriodEnd: false };
  return ok(S.elofizetes);
});
ut('POST', '/client/subscription/card/delete', () => {
  S.elofizetes = { ...S.elofizetes, card: undefined };
  return ok(S.elofizetes);
});
ut('GET', '/client/fee-invoices', () => kell() ?? ok({ items: dijszamlak() }));


// --- SPEC §26: új vállalkozás, útmutatók, magyarázatok, visszahívás, korlátozott mód ---
const lepesAllit = (step: string, status: 'kesz' | 'ugyfelre_var' | 'konyvelore_var') => {
  if (S.onboarding) S.onboarding.steps = S.onboarding.steps.map((x) => (x.step === step ? { ...x, status } : x));
};
ut('GET', '/client/access', () => kell() ?? ok(hozzaferes1118(!!S.onboarding, bekotesNezet()?.todoCount ?? 0)));
ut('GET', '/client/explainers', () => kell() ?? ok({ items: magyarazatok() }));
ut('PUT', '/client/onboarding/business-status', (_m, _q, t) => {
  // SPEC §27.2: módosítható, amíg semmi nem ment el a NAV-hoz; utána 409 + visszahívás.
  const b = t.businessStatus === 'inditas' ? 'inditas' : 'van';
  const filed = !!S.t.reg && S.t.reg.status !== 'elallt' && ['beadva', 'javitas', 'ellenorizve', 'kesz'].includes(S.t.reg.status);
  const engedelyezte = S.u.assists.some((x) => x.kind === 'vallalkozas_bejelentes' && ['ugyfel_engedelyezte', 'bejelentes_bekuldve'].includes(x.status));
  if (S.t.path && S.t.path !== b) {
    if (filed) return hiba(409, 'path_change_needs_callback', PATH_CHANGE_BLOCKER_TEXT.bejelentes_bekuldve);
    if (engedelyezte) return hiba(409, 'path_change_needs_callback', PATH_CHANGE_BLOCKER_TEXT.bejelentes_engedelyezve);
  }
  const elozo = S.t.path;
  S.t.path = b;
  if (elozo && elozo !== b) S.u.pathChangedAt = new Date().toISOString();
  if (b === 'inditas') {
    if (!S.t.reg) S.t.reg = regisztracio(S.t, 'kitoltes', { declarations: null, revenueBand: null, activities: [], activityFreeText: null, seat: null, otherSites: [], workKind: null, euPartner: null, startPlan: null, startDate: null, hasSeparateBusinessAccount: null }, S.ma);
    else if (S.t.reg.status === 'elallt' && !S.t.reg.filed) S.t.reg = { ...regFrissit(S.t.reg, S.t.reg.submittedAt ? 'utmutato' : 'kitoltes', S.ma), withdrawnAt: null, withdrawReason: null };
  }
  if (b === 'van' && S.t.reg) {
    S.t.reg = { ...regFrissit(S.t.reg, 'elallt', S.ma), withdrawReason: 'mar_van_vallalkozasa', withdrawnAt: new Date().toISOString() };
    // a nyitott EV-kérés: UJEGYKE előtt lezárva ('utvaltas'), utána meghatalmazás-kérés lesz belőle
    S.u.assists = S.u.assists.map((x) =>
      x.kind !== 'vallalkozas_bejelentes' || !NYITOTT_SEGITSEG.has(x.status)
        ? x
        : ['visszahivas_kerve', 'egyeztetve'].includes(x.status)
          ? { ...x, status: 'lezarva', closedReason: 'utvaltas', closedAt: new Date().toISOString() }
          : { ...x, kind: 'meghatalmazas', status: x.status === 'meghatalmazas_el' ? 'kesz' : x.status },
    );
  }
  return ok(bekotesNezet());
});
ut('GET', '/client/business-registration', () =>
  kell() ??
  ok({
    registration: S.t.reg
      ? { ...S.t.reg, guideProgress: S.t.haladas.vallalkozas_bejelentes, mode: S.u.assists.some((x) => x.kind === 'vallalkozas_bejelentes' && NYITOTT_SEGITSEG.has(x.status)) ? 'segitett' : 'onallo', chamber: S.u.chamber }
      : null,
  }),
);
ut('PUT', '/client/business-registration', (_m, _q, t) => {
  if (S.t.path !== 'inditas') return hiba(409, 'step_locked', 'Ez a lépés csak új vállalkozásnál kell.');
  if (!S.t.reg) S.t.reg = regisztracio(S.t, 'kitoltes', valaszokBol(regisztracio(S.t, 'kitoltes', { declarations: null, revenueBand: null, activities: [], activityFreeText: null, seat: null, otherSites: [], workKind: null, euPartner: null, startPlan: null, startDate: null, hasSeparateBusinessAccount: null }), t), S.ma);
  else if (!S.t.reg.canEdit) return hiba(409, 'conflict', 'A bejelentésedet már beküldted, ezt már nem lehet módosítani.');
  else S.t.reg = regFrissit({ ...S.t.reg, answers: valaszokBol(S.t.reg, t) }, S.t.reg.status, S.ma);
  return ok(S.t.reg);
});
ut('POST', '/client/business-registration/submit', () => {
  const r = S.t.reg;
  if (!r) return hiba(409, 'step_locked', 'Előbb töltsd ki az adatlapot.');
  if (r.hints.stop) return hiba(409, 'conflict', r.hints.stop.text);
  if (r.missing.length) return hiba(400, 'validation_failed', 'Még hiányzik pár válasz.', {}, Object.fromEntries(r.missing.map((m) => [m, 'Ezt még válaszold meg.'])));
  S.t.reg = { ...regFrissit(r, r.status === 'kitoltes' ? 'utmutato' : r.status, S.ma), submittedAt: new Date().toISOString() };
  return ok(S.t.reg);
});
ut('POST', '/client/business-registration/filed', (_m, _q, _t, k) => {
  const r = S.t.reg;
  if (!r || !['utmutato', 'javitas'].includes(r.status)) return hiba(409, 'conflict', 'Most nem tölthetsz fel igazolást.');
  const f = k.body instanceof FormData ? k.body : null;
  const filedOn = (f?.get('filedOn') as string) || S.ma;
  const channel = ((f?.get('channel') as string) || 'ugyfelkapu_plus') as 'ugyfelkapu_plus';
  const adoszam = (f?.get('adoszam') as string) || r.adoszam;
  S.t.reg = { ...regFrissit(r, 'beadva', S.ma), filed: { filedOn, channel, documentId: `ev-${S.szamlalo++}`, fileId: `f-ev-${S.szamlalo++}`, uploadedAt: new Date().toISOString() }, adoszam: adoszam ?? null, fixNote: null };
  lepesAllit('vallalkozas_inditas', 'konyvelore_var');
  return ok(S.t.reg);
});
ut('POST', '/client/business-registration/adoszam', (_m, _q, t) => {
  const r = S.t.reg;
  if (!r) return hiba(409, 'conflict', 'Nincs nyitott bejelentésed.');
  S.t.reg = { ...(r.status === 'ellenorizve' ? regFrissit(r, 'kesz', S.ma) : r), adoszam: String(t.adoszam ?? ''), evNyilvantartasiSzam: (t.evNyilvantartasiSzam as string) ?? null };
  return ok(S.t.reg);
});
ut('POST', '/client/business-registration/withdraw', (_m, _q, t) => {
  if (!S.t.reg) return hiba(409, 'conflict', 'Nincs nyitott bejelentésed.');
  if (!['kitoltes', 'utmutato'].includes(S.t.reg.status)) return hiba(409, 'path_change_needs_callback', PATH_CHANGE_BLOCKER_TEXT.bejelentes_bekuldve);
  if (t.reason === 'mar_van_vallalkozasa') {
    S.t.reg = { ...regFrissit(S.t.reg, 'elallt', S.ma), withdrawReason: 'mar_van_vallalkozasa', withdrawnAt: new Date().toISOString() };
    S.t.path = 'van';
    return ok(S.t.reg);
  }
  S.t.reg = { ...regFrissit(S.t.reg, 'elallt', S.ma), withdrawReason: (t.reason as 'egyeb') ?? 'egyeb', withdrawnAt: new Date().toISOString() };
  S.t.path = null;
  return ok(S.t.reg);
});
ut('GET', '/client/guides/:kind', (m) => {
  const kind = m[1] as GuideKind;
  if (!(GUIDE_KINDS as readonly string[]).includes(kind)) return hiba(404, 'not_found', 'Nincs ilyen útmutató.');
  if (kind === 'vallalkozas_bejelentes' && (!S.t.reg || S.t.reg.status === 'kitoltes')) return hiba(409, 'step_locked', 'Előbb töltsd ki a kérdőívet.');
  if (kind === 'meghatalmazas_jovahagyas') {
    const a = S.u.assists.find((x) => ['meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva'].includes(x.status));
    if (!a) return hiba(409, 'step_locked', 'Most nincs mit jóváhagynod.');
    const v = segitsegNezet(a, S.t, S.ma);
    return ok(
      utmutatoEpit('meghatalmazas_jovahagyas', {
        answers: null, nev: '', lakcim: null,
        konyvelo: { nev: BENCE.displayName, firstName: BENCE.firstName, adoazonosito: null, nyilvantartasiSzam: BENCE.registrationNumber },
        ugykorok: [], kesz: S.t.haladas.meghatalmazas_jovahagyas, ma: S.ma,
        jovahagyas: v.approval ? { dueOn: v.approval.dueOn, dueText: v.approval.dueText, daysLeft: v.approval.daysLeft, lastDay: v.approval.lastDay } : null,
      }),
    );
  }
  return ok(utmutato1118(kind, S.t, `${szemely().lastName} ${szemely().firstName}`, S.ma));
});
ut('PUT', '/client/guides/:kind/progress', (m, _q, t) => {
  const kind = m[1] as GuideKind;
  S.t.haladas[kind] = ((t.doneStepKeys as string[]) ?? []).slice(0, 30);
  return ok({ doneStepKeys: S.t.haladas[kind] });
});
ut('GET', '/client/callbacks', () =>
  kell() ??
  ok({ open: S.t.cb && ['uj', 'folyamatban'].includes(S.t.cb.status) ? S.t.cb : null, recent: S.t.regiCb, promise: igeret(), phoneOnFileMasked: S.t.telefon ? maskHuPhone(S.t.telefon) : null }),
);
ut('POST', '/client/callbacks', (_m, _q, t) => {
  if (S.t.cb && ['uj', 'folyamatban'].includes(S.t.cb.status)) return hiba(409, 'callback_already_open', 'Már van egy nyitott visszahívási kérésed.', { callback: S.t.cb });
  let tel: string | null = null;
  if (t.phone) {
    tel = normalizeHuPhone(String(t.phone));
    if (!tel) return hiba(400, 'validation_failed', 'Nézd át a telefonszámot.', {}, { phone: 'Magyar telefonszámot adj meg, például +36 30 123 4567.' });
    if (t.savePhoneToProfile) S.t.telefon = tel;
  }
  S.t.cb = visszahivas(S.t, { topic: (t.topic as CallbackTopic) ?? 'egyeb', window: (t.window as CallbackWindow) ?? 'barmikor', note: (t.note as string) ?? null, source: (t.source as 'bekotes') ?? 'bekotes', phone: tel });
  return valasz(201, S.t.cb);
});
ut('PATCH', '/client/callbacks/:id', (_m, _q, t) => {
  if (!S.t.cb) return hiba(404, 'not_found', 'Nincs ilyen kérés.');
  const tel = t.phone ? normalizeHuPhone(String(t.phone)) : null;
  if (t.phone && !tel) return hiba(400, 'validation_failed', 'Nézd át a telefonszámot.', {}, { phone: 'Magyar telefonszámot adj meg, például +36 30 123 4567.' });
  S.t.cb = { ...S.t.cb, topic: (t.topic as CallbackTopic) ?? S.t.cb.topic, window: (t.window as CallbackWindow) ?? S.t.cb.window, note: 'note' in t ? ((t.note as string) ?? null) : S.t.cb.note, ...(tel ? { phoneMasked: maskHuPhone(tel), needsNewPhone: false, statusText: `Megkaptuk. Kollégánk 24–48 órán belül hív a ${maskHuPhone(tel)} számon.` } : {}) };
  return ok(S.t.cb);
});
ut('POST', '/client/callbacks/:id/cancel', () => {
  if (!S.t.cb) return hiba(404, 'not_found', 'Nincs ilyen kérés.');
  const l = { ...S.t.cb, status: 'visszavonva' as const, statusText: 'Lemondtad a visszahívást.', canEdit: false, canCancel: false, closedAt: new Date().toISOString() };
  S.t.regiCb = [l, ...S.t.regiCb].slice(0, 5);
  S.t.cb = null;
  return ok(l);
});

// --- SPEC §27: „Intézzük helyetted”, kamarai regisztráció ---
const segitsegLista = () => S.u.assists.map((x) => segitsegNezet(x, S.t, S.ma));
ut('GET', '/client/assist', () => kell() ?? ok({ items: segitsegLista() }));
ut('POST', '/client/assist', (_m, _q, t) => {
  const kind: AssistKind = t.kind === 'meghatalmazas' ? 'meghatalmazas' : 'vallalkozas_bejelentes';
  const nyitva = S.u.assists.find((x) => x.kind === kind && NYITOTT_SEGITSEG.has(x.status));
  if (nyitva) return hiba(409, 'assist_already_open', 'Már kérted. Itt látod, hol tart.', { assist: segitsegNezet(nyitva, S.t, S.ma) });
  if (kind === 'vallalkozas_bejelentes' && S.t.path !== 'inditas') return hiba(409, 'step_locked', 'Ez csak új vállalkozásnál kérhető.');
  // a nyitott meghatalmazás-kérés EV-kéréssé bővül (SPEC §27.3.2)
  const mh = S.u.assists.find((x) => x.kind === 'meghatalmazas' && NYITOTT_SEGITSEG.has(x.status));
  if (kind === 'vallalkozas_bejelentes' && mh) mh.kind = 'vallalkozas_bejelentes';
  else S.u.assists = [{ id: `assist-${S.u.szamlalo++}`, kind, status: 'visszahivas_kerve', createdAt: new Date().toISOString() }, ...S.u.assists];
  let tel: string | null = null;
  if (t.phone) {
    tel = normalizeHuPhone(String(t.phone));
    if (!tel) return hiba(400, 'validation_failed', 'Nézd át a telefonszámot.', {}, { phone: 'Magyar telefonszámot adj meg, például +36 30 123 4567.' });
    if (t.savePhoneToProfile) S.t.telefon = tel;
  }
  const topic = ASSIST_CALLBACK_TOPIC[kind];
  if (S.t.cb && ['uj', 'folyamatban'].includes(S.t.cb.status)) S.t.cb = { ...S.t.cb, topic, topicLabel: 'Intézzétek helyettem', note: [S.t.cb.note, t.note ? `— Intézzük helyetted kérés: ${String(t.note)}` : '— Intézzük helyetted kérés'].filter(Boolean).join(' ') };
  else S.t.cb = visszahivas(S.t, { topic, window: (t.window as CallbackWindow) ?? 'barmikor', note: (t.note as string) ?? null, source: (t.source as 'bekotes') ?? 'bekotes', phone: tel });
  const a = S.u.assists.find((x) => x.kind === kind && NYITOTT_SEGITSEG.has(x.status));
  return valasz(201, { assist: a ? segitsegNezet(a, S.t, S.ma) : null, callback: S.t.cb });
});
ut('POST', '/client/assist/:id/approved', (m) => {
  const a = S.u.assists.find((x) => x.id === m[1]);
  if (!a) return hiba(404, 'not_found', 'Nincs ilyen kérés.');
  if (!['meghatalmazas_bekuldve', 'meghatalmazas_lejart'].includes(a.status)) return hiba(409, 'assist_wrong_status', 'Most nincs mit jóváhagynod.');
  a.status = 'meghatalmazas_jovahagyva';
  a.approvedAt = new Date().toISOString();
  return ok(segitsegNezet(a, S.t, S.ma));
});
ut('GET', '/client/assist/:id/consent', (m) => {
  const a = S.u.assists.find((x) => x.id === m[1] && x.kind === 'vallalkozas_bejelentes');
  if (!a) return hiba(404, 'not_found', 'Nincs ilyen kérés.');
  return ok(engedelyOsszegzes(S.t, `${szemely().lastName} ${szemely().firstName}`, '3530 Miskolc, Próba utca 12.'));
});
ut('POST', '/client/assist/:id/consent', (m, _q, t) => {
  const a = S.u.assists.find((x) => x.id === m[1] && x.kind === 'vallalkozas_bejelentes');
  if (!a) return hiba(404, 'not_found', 'Nincs ilyen kérés.');
  const o = engedelyOsszegzes(S.t, `${szemely().lastName} ${szemely().firstName}`, '3530 Miskolc, Próba utca 12.');
  if (t.hash !== o.hash) return hiba(409, 'assist_consent_stale', 'Módosítottad a kérdőívet, ezért engedélyezd újra.');
  if (!o.canConsent) return hiba(409, 'assist_wrong_status', S.t.reg?.activityPending ? 'Előbb megírjuk a tevékenységed sorát.' : 'Még hiányzik pár válasz.');
  a.consentAt = new Date().toISOString();
  a.consentValid = true;
  a.consentHash = o.hash;
  if (a.status === 'meghatalmazas_el') a.status = 'ugyfel_engedelyezte';
  return ok(segitsegNezet(a, S.t, S.ma));
});
ut('POST', '/client/assist/:id/cancel', (m) => {
  const a = S.u.assists.find((x) => x.id === m[1]);
  if (!a) return hiba(404, 'not_found', 'Nincs ilyen kérés.');
  if (!['visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte'].includes(a.status)) return hiba(409, 'assist_wrong_status', 'Ezt már nem lehet lemondani.');
  if (a.kind === 'vallalkozas_bejelentes' && a.filedAt) {
    a.kind = 'meghatalmazas';
    if (a.status === 'meghatalmazas_el' || a.status === 'ugyfel_engedelyezte') a.status = 'kesz';
  } else {
    a.status = 'visszavonva';
    a.closedAt = new Date().toISOString();
    if (S.t.cb && ['uj', 'folyamatban'].includes(S.t.cb.status)) S.t.cb = null;
  }
  return ok(segitsegNezet(a, S.t, S.ma));
});
ut('POST', '/client/business-registration/chamber', (_m, _q, t) => {
  if (!S.t.reg || S.t.reg.status !== 'kesz') return hiba(409, 'step_locked', 'Ez a bejelentés után jön.');
  S.u.chamber = { dueOn: S.u.chamber?.dueOn ?? munkanapotHozzaad(S.t.reg.registeredOn ?? napKulcs(new Date().toISOString()), 5), doneAt: t.done ? new Date().toISOString() : null };
  return ok({ ...S.t.reg, chamber: S.u.chamber });
});

// SPEC §28 + §28.K végpontjai: a lista ELEJÉRE (a változás-fajtájú assist és a díjak a régi útvonal előtt)
{
  const elotte = utak.length;
  k28Utak(ut, { st: () => S.k, ma: () => S.ma, aktiv: () => !S.onboarding && S.belepve, ok, hiba: (st, c, m, e = {}, f) => hiba(st, c, m, e, f), kell });
  utak.unshift(...utak.splice(elotte));
}

export const mintaSzallito: Szallito = async (k) => {
  await new Promise((r) => setTimeout(r, 60));
  const [utvonal, kerdes = ''] = k.url.split('?');
  const q = new URLSearchParams(kerdes);
  let test: Record<string, unknown> = {};
  if (typeof k.body === 'string') {
    try {
      test = JSON.parse(k.body) as Record<string, unknown>;
    } catch {
      test = {};
    }
  }
  // SPEC §26.5.2: bekötés alatt a zárt funkciók 403-at adnak (mint a szerver).
  const zart = S.onboarding && S.belepve ? zartFunkcio(k.method, utvonal, test) : null;
  if (zart) return hiba(403, 'locked_until_active', hozzaferes1118(true, 1).features.find((f) => f.feature === zart)?.reason ?? 'A bekötés után nyílik meg.', {}, undefined, zart);
  for (const [method, re, f] of utak) {
    if (method !== k.method) continue;
    const m = utvonal.match(re);
    if (!m) continue;
    // undefined = ezt az útvonalat egy korábbi kezelő viszi tovább (SPEC §28 kiegészítések)
    const v = await f(m, q, test, k);
    if (v !== undefined) return v;
  }
  return hiba(404, 'not_found', 'Ez a minta-végpont nem létezik.');
};

/** A minta „mai” napja (a képernyők viszonylagos időihez). */
export const mintaMa = () => S.ma;
