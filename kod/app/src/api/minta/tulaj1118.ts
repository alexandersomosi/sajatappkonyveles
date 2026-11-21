// MINTA-szerver – SPEC §26 (tulaj-kérések 11-18): új vállalkozás (önkiszolgáló bejelentés), útmutatók, visszahívás,
// korlátozott mód. Csak a minta buildben töltődik be. A szöveg és a szabály ugyanaz, mint a szerveré (kod/shared).
import type {
  BusinessRegistrationAnswers, BusinessRegistrationHints, BusinessRegistrationView, CallbackView, ClientAccess, Explainer,
  OnboardingState, OnboardingStepState,
} from '../../_shared/api';
import { BUSINESS_ACTIVITIES, fillPlaceholders, maskHuPhone, normalizeHuPhone, ONBOARDING_EXPLAINERS } from '../../_shared/bekotes';
import {
  CALLBACK_TOPIC_LABELS, CALLBACK_WINDOW_LABELS, CALLBACK_TOPICS, CALLBACK_WINDOWS, CLIENT_FEATURE_RULES, CLIENT_FEATURES, MILESTONE_LABELS,
  ONBOARDING_STEP_ORDER, REGISTRATION_STATUS_CLIENT_TEXT, REGISTRATION_STEP_STATUS,
  type CallbackTopic, type CallbackWindow, type GuideKind, type OnboardingPath, type RegistrationStatus,
} from '../../_shared/enums';
import { szovegLista } from '../../lib/szovegek';
import { jarulekSzoveg, koltseghanyadSzoveg } from '../../lib/tevekenyseg';
import { utmutatoEpit } from '../../lib/utmutato';
import { GUIDE_KINDS } from '../../_shared/enums';
import { BENCE } from './adatok';

const URES_VALASZ: BusinessRegistrationAnswers = {
  declarations: null, revenueBand: null, activities: [], activityFreeText: null, seat: null, otherSites: [], workKind: null, euPartner: null,
  startPlan: null, startDate: null, hasSeparateBusinessAccount: null,
};
const LEVENTE_VALASZ: BusinessRegistrationAnswers = {
  declarations: { noExclusion: true, singleBusiness: true, acceptedAt: '2026-11-15T09:12:00Z' },
  revenueBand: 'max_12m',
  activities: [
    { key: 'foto', label: 'Fotózás, képszerkesztés', main: true, ovtjKod: null, navKereso: 'fotó' },
    { key: 'video', label: 'Videókészítés, vágás', main: false, ovtjKod: null, navKereso: 'film' },
  ],
  activityFreeText: null,
  seat: { kind: 'lakcim', address: null, right: null, provider: null },
  otherSites: [],
  workKind: 'fofoglalkozas',
  euPartner: 'nem',
  startPlan: 'mielobb',
  startDate: null,
  hasSeparateBusinessAccount: true,
};

export interface Allapot1118 {
  path: OnboardingPath | null;
  reg: BusinessRegistrationView | null;
  cb: CallbackView | null;
  regiCb: CallbackView[];
  haladas: Record<GuideKind, string[]>;
  telefon: string | null;
  szamlalo: number;
}

export function kezdo1118(fk: string): Allapot1118 {
  const a: Allapot1118 = { path: null, reg: null, cb: null, regiCb: [], haladas: Object.fromEntries(GUIDE_KINDS.map((k) => [k, [] as string[]])) as Allapot1118['haladas'], telefon: '+36301234567', szamlalo: 1 };
  if (fk === 'peter') {
    a.path = 'van';
    // A régi foglalás visszahívássá alakult (SPEC §26.2.9).
    a.cb = visszahivas(a, { topic: 'bekotes', window: 'delelott', note: 'Korábban egyeztetett hívás: november 19. 10:00 (telefon)', source: 'regi_idopont' });
  }
  if (fk === 'indul' || fk === 'utmutato' || fk === 'levente') {
    a.path = 'inditas';
    a.reg = regisztracio(a, fk === 'indul' ? 'kitoltes' : fk === 'utmutato' ? 'utmutato' : 'beadva', fk === 'indul' ? { ...URES_VALASZ, declarations: { noExclusion: true, singleBusiness: true, acceptedAt: '2026-11-17T10:00:00Z' }, revenueBand: 'max_12m' } : LEVENTE_VALASZ);
    if (fk === 'utmutato') a.haladas.vallalkozas_bejelentes = ['belepes', 'ugyseged_inditas', 'szemelyi_adatok'];
    if (fk === 'levente') {
      a.haladas.vallalkozas_bejelentes = ['belepes', 'ugyseged_inditas', 'szemelyi_adatok', 'cimadatok', 'tevekenysegek', 'adozas_munkavegzes', 'adozas_kata_atalany', 'adozas_afa', 'nyilatkozatok', 'ellenorzes', 'bekuldes', 'megtekintes_pdf', 'feltoltes_appban', 'kamarai_regisztracio'];
      a.reg.filed = { filedOn: '2026-11-16', channel: 'ugyfelkapu_plus', documentId: 'ev-bejelentes-1', fileId: 'f-ev-1', uploadedAt: '2026-11-16T15:40:00Z' };
      a.cb = visszahivas(a, { topic: 'vallalkozas_inditas', window: 'barmikor', note: 'Nem találom, melyik tevékenységet válasszam.', source: 'vallalkozas_utmutato' });
      a.cb.status = 'folyamatban';
      a.cb.staffFirstName = 'Anna';
      a.cb.statusText = 'Anna intézi a kérésedet. Hamarosan hív.';
    }
  }
  return a;
}

// ---------- regisztráció ----------
const ARANY_TEXT = (r: BusinessRegistrationAnswers) => koltseghanyadSzoveg(r.activities.find((x) => x.main) ?? (r.activityFreeText ? { key: null } : undefined), BENCE.firstName);
function hints(a: BusinessRegistrationAnswers, ma: string): BusinessRegistrationHints {
  const fo = a.activities.find((x) => x.main);
  const tev = fo?.key ? BUSINESS_ACTIVITIES.find((b) => b.key === fo.key) : undefined;
  const kezd = a.startPlan === 'datum' && a.startDate ? a.startDate : ma;
  const napok = Math.round((Date.parse('2026-12-31') - Date.parse(kezd)) / 86400000) + 1;
  return {
    costClass: tev?.costClass ?? (fo || a.activityFreeText ? 'ellenorizendo' : null),
    costRatio: tev && tev.costClass !== 'ellenorizendo' ? ({ altalanos: 45, lista80: 80, kiskereskedelem: 90 } as const)[tev.costClass] : null,
    costRatioText: ARANY_TEXT(a),
    minimumMonthlyContributionHuf: a.workKind === 'fofoglalkozas' ? 101_682 : null,
    contributionText: jarulekSzoveg(a.workKind),
    afaLimitHuf: 20_000_000,
    atalanyCapHuf: Math.round((38_736_000 * Math.max(1, Math.min(365, napok))) / 365),
    qualificationNote: null,
    stop: a.revenueBand === 'tobb_20m' ? { code: 'tobb_20m', text: 'Ennyi bevétel mellett nem lehetsz alanyi ÁFA-mentes. Szolgáltatásunk most az ÁFA-mentes egyéni vállalkozóknak szól. Ha kérdésed van, kérj visszahívást.' } : null,
  };
}
function hianyzik(a: BusinessRegistrationAnswers): string[] {
  const m: string[] = [];
  if (!a.declarations?.noExclusion || !a.declarations.singleBusiness) m.push('declarations');
  if (!a.revenueBand) m.push('revenueBand');
  if (!a.activities.length && !a.activityFreeText) m.push('activities');
  if (!a.seat) m.push('seat');
  if (!a.workKind) m.push('workKind');
  if (!a.euPartner) m.push('euPartner');
  if (!a.startPlan) m.push('startPlan');
  return m;
}
export function regisztracio(a: Allapot1118, status: RegistrationStatus, answers: BusinessRegistrationAnswers, ma = '2026-11-17'): BusinessRegistrationView {
  return {
    id: `reg-${a.szamlalo++}`,
    status,
    statusText: REGISTRATION_STATUS_CLIENT_TEXT[status],
    answers,
    hints: hints(answers, ma),
    missing: hianyzik(answers),
    canEdit: ['kitoltes', 'utmutato', 'javitas'].includes(status),
    canWithdraw: ['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve'].includes(status),
    submittedAt: status === 'kitoltes' ? null : '2026-11-15T09:20:00Z',
    guideOpenedAt: status === 'kitoltes' ? null : '2026-11-15T09:21:00Z',
    guideProgress: [],
    filed: null,
    fixNote: null,
    checkedAt: null,
    adoszam: null,
    evNyilvantartasiSzam: null,
    registeredOn: null,
    doneAt: null,
    withdrawnAt: null,
    withdrawReason: null,
    updatedAt: new Date().toISOString(),
  };
}
export function regFrissit(r: BusinessRegistrationView, status: RegistrationStatus, ma: string): BusinessRegistrationView {
  return { ...r, status, statusText: REGISTRATION_STATUS_CLIENT_TEXT[status], hints: hints(r.answers, ma), missing: hianyzik(r.answers), canEdit: ['kitoltes', 'utmutato', 'javitas'].includes(status), canWithdraw: ['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve'].includes(status), updatedAt: new Date().toISOString() };
}
export function valaszokBol(r: BusinessRegistrationView, t: Record<string, unknown>): BusinessRegistrationAnswers {
  const a = { ...r.answers };
  if (t.declarations) a.declarations = { ...(t.declarations as { noExclusion: boolean; singleBusiness: boolean }), acceptedAt: new Date().toISOString() };
  if (t.revenueBand) a.revenueBand = t.revenueBand as BusinessRegistrationAnswers['revenueBand'];
  if (Array.isArray(t.activities))
    a.activities = (t.activities as { key: string | null; label?: string; main: boolean }[]).map((x) => {
      const b = x.key ? BUSINESS_ACTIVITIES.find((y) => y.key === x.key) : undefined;
      return { key: x.key, label: b?.label ?? x.label ?? '', main: x.main, ovtjKod: b?.ovtjKod ?? null, navKereso: b?.navKereso ?? null };
    });
  if ('activityFreeText' in t) a.activityFreeText = (t.activityFreeText as string | null) ?? null;
  if (t.seat) {
    const s = t.seat as { kind: 'lakcim' | 'mas_cim' | 'szekhelyszolgaltato'; address?: { zip: string; city: string; line: string } | null; right?: string | null; provider?: { name: string; adoszam: string } | null };
    a.seat = { kind: s.kind, address: s.address ?? null, right: (s.right as never) ?? null, provider: s.provider ?? null };
  }
  if (Array.isArray(t.otherSites)) a.otherSites = (t.otherSites as { address: { zip: string; city: string; line: string } }[]).map((o) => ({ address: o.address, kind: o.address.city.trim().toLowerCase() === (a.seat?.address?.city ?? 'Budapest').trim().toLowerCase() ? 'telephely' : 'fioktelep' }));
  if (t.workKind) a.workKind = t.workKind as BusinessRegistrationAnswers['workKind'];
  if (t.euPartner) a.euPartner = t.euPartner as BusinessRegistrationAnswers['euPartner'];
  if (t.startPlan) a.startPlan = t.startPlan as BusinessRegistrationAnswers['startPlan'];
  if ('startDate' in t) a.startDate = (t.startDate as string | null) ?? null;
  if ('hasSeparateBusinessAccount' in t) a.hasSeparateBusinessAccount = (t.hasSeparateBusinessAccount as boolean | null) ?? null;
  return a;
}

// ---------- bekötés: lépések, zárak, mérföldkövek ----------
export function bekotes1118(alap: OnboardingState, a: Allapot1118): OnboardingState {
  const sorrend = ONBOARDING_STEP_ORDER[a.path ?? 'van'];
  const regiLepes = new Map(alap.steps.map((s) => [s.step, s]));
  const rs = a.reg?.status;
  const bejelentve = !!rs && ['beadva', 'javitas', 'ellenorizve', 'kesz'].includes(rs);
  const steps: OnboardingStepState[] = sorrend.map((step) => {
    let s: OnboardingStepState = regiLepes.get(step) ?? { step, status: step === 'nav_bekotes' ? 'nincs_kezdve' : 'ugyfelre_var' };
    if (step === 'vallalkozas_inditas') s = { step, status: rs ? REGISTRATION_STEP_STATUS[rs] : 'ugyfelre_var', note: rs === 'javitas' ? (a.reg?.fixNote ?? undefined) : undefined };
    if (a.path === 'inditas') {
      if ((step === 'meghatalmazas' || step === 'azonositas') && !bejelentve) s = { ...s, locked: true, lockedReason: 'Ha beküldted a bejelentést, ez is megnyílik.' };
      // SPEC §29.4.2 (no free period): the card right after the contract, also on the new-business path
      if (step === 'elofizetes' && regiLepes.get('szerzodes')?.status !== 'kesz' && s.status !== 'kesz') s = { ...s, locked: true, lockedReason: 'A kártyádat a szerződés után kérjük.' };
      if (step === 'nav_bekotes' && rs !== 'kesz') s = { ...s, locked: true, lockedReason: 'A bejelentés és a meghatalmazás után Bence köti be a számláidat.' };
    }
    return s;
  });
  // Like the backend's OnboardingState.todoCount: the unanswered branch question is NOT counted here – the band and the
  // tab badge both add it themselves (otherwise the badge said 7 while the band said "Még 6 dolog").
  const nyitottDb = steps.filter((s) => !s.locked && (s.status === 'ugyfelre_var' || s.status === 'hianyos') && s.step !== 'nav_bekotes').length;
  const milestones =
    a.path === 'inditas'
      ? [
          { key: 'vallalkozas_elinditva' as const, label: MILESTONE_LABELS.vallalkozas_elinditva, done: rs === 'kesz', current: rs !== 'kesz', sub: rs === 'beadva' ? 'Beküldted. Átnézzük a NAV-os igazolást.' : 'Ha beküldted, feltöltöd a NAV-os igazolást, és átnézzük.' },
          ...alap.milestones.map((m) => ({ ...m, current: false })),
        ]
      : alap.milestones;
  return { ...alap, steps, milestones, todoCount: nyitottDb, path: a.path, registration: a.reg ? { id: a.reg.id, status: a.reg.status, statusText: a.reg.statusText } : null, callback: a.cb && ['uj', 'folyamatban'].includes(a.cb.status) ? a.cb : null, appointmentsEnabled: false };
}

export function hozzaferes1118(korlatozott: boolean, todo: number): ClientAccess {
  return {
    mode: korlatozott ? 'korlatozott' : 'teljes',
    features: CLIENT_FEATURES.map((f) => {
      const r = CLIENT_FEATURE_RULES[f];
      const state = korlatozott ? r.beforeActivation : 'nyitva';
      return { feature: f, state, label: r.label, reason: state === 'nyitva' || !r.reason ? null : fillPlaceholders(r.reason, { firstName: BENCE.firstName }) };
    }),
    activationHint: korlatozott ? `Még ${Math.max(1, todo)} lépés, és minden megnyílik.` : null,
  };
}

/** Bekötés alatt zárt útvonalak (SPEC §26.5.2) → funkció. */
export function zartFunkcio(method: string, ut: string, test: Record<string, unknown>): keyof typeof CLIENT_FEATURE_RULES | null {
  if (/^\/client\/tax-periods/.test(ut)) return 'fooldal_ado';
  if (/^\/client\/dossiers/.test(ut)) return 'dosszie';
  if (/^\/client\/nav-invoices/.test(ut)) return 'nav_szamlak';
  if (/^\/client\/revenue/.test(ut)) return 'bevetel';
  if (/^\/client\/deadlines/.test(ut)) return 'hataridok';
  if (method === 'POST' && ut === '/client/requests' && test.type !== 'kerdes') return 'igazolas_keres';
  return null;
}

export function magyarazatok(): Explainer[] {
  const ert = { firstName: BENCE.firstName, havidij: '19 999 Ft' };
  return ONBOARDING_EXPLAINERS.map((e) => ({ ...e, title: fillPlaceholders(e.title, ert), what: fillPlaceholders(e.what, ert), why: fillPlaceholders(e.why, ert), where: fillPlaceholders(e.where, ert), fields: [...e.fields] }));
}

export function utmutato1118(kind: GuideKind, a: Allapot1118, nev: string, ma: string) {
  return utmutatoEpit(kind, {
    answers: a.reg?.answers ?? null,
    nev,
    lakcim: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
    konyvelo: { nev: BENCE.displayName, firstName: BENCE.firstName, adoazonosito: '8428621233', nyilvantartasiSzam: BENCE.registrationNumber },
    ugykorok: szovegLista('meghatalmazas.ugykorok', {}, ['ADÓÜGYEK', 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)']),
    kesz: a.haladas[kind],
    ma,
  });
}

// ---------- visszahívás ----------
export function visszahivas(a: Allapot1118, v: { topic: CallbackTopic; window: CallbackWindow; note?: string | null; source: CallbackView['source']; phone?: string | null }): CallbackView {
  const tel = v.phone ?? a.telefon ?? '+36301234567';
  const most = new Date();
  return {
    id: `cb-${a.szamlalo++}`,
    status: 'uj',
    statusText: `Megkaptuk. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. Ezen a számon hívunk: ${maskHuPhone(tel)}.`,
    topic: v.topic,
    topicLabel: CALLBACK_TOPIC_LABELS[v.topic],
    source: v.source,
    window: v.window,
    phoneMasked: maskHuPhone(tel),
    note: v.note ?? null,
    createdAt: most.toISOString(),
    dueAt: new Date(most.getTime() + 48 * 3600_000).toISOString(),
    overdue: false,
    callingNow: false,
    staffFirstName: null,
    lastAttempt: null,
    failedAttempts: 0,
    needsNewPhone: false,
    canEdit: true,
    canCancel: true,
    closedAt: null,
    summary: null,
  };
}
export function igeret() {
  return {
    text: `A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. Nem feltétlenül ${BENCE.firstName} hív elsőként, hanem valaki a csapatunkból.`,
    callerIdText: null,
    fraudWarning: 'Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban.',
    privacyText: 'A megadott számon ezzel a kéréssel kapcsolatban hívunk. A hívásról rövid jegyzetet írunk, a hívást nem rögzítjük. Részletek az Adatkezelési tájékoztatóban.',
    windows: CALLBACK_WINDOWS.map((w) => ({ window: w, label: CALLBACK_WINDOW_LABELS[w] })),
    topics: CALLBACK_TOPICS.map((t) => ({ topic: t, label: CALLBACK_TOPIC_LABELS[t] })),
  };
}
export { normalizeHuPhone, maskHuPhone };
