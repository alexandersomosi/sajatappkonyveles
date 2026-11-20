// MINTA-szerver – SPEC §29 végpontjai (csak a minta buildben): a vezetett első indulás (G), a kártyás engedély és a
// fizetés eredménye (A), „Fizesd ki”, a díjszámlák, az adószám-kereső (§28.K.9 / §29.4.4). Kitalált adatok; a fizetés
// „DEMO”, pénz nem mozdul. A szerveroldali szabályok másolata egyszerűsítve (services/guided.ts).
import type { JourneyView, NavAddress, OnboardingState, SubscriptionView, TaxpayerLookupResult } from '../../_shared/api';
import { fillPlaceholders } from '../../_shared/bekotes';
import { CARD_CONSENT_TEXT, CARD_CONSENT_UI, CARD_CONSENT_VERSION, PAYMENT_FAIL_TEXTS, type CardInfoView, type CheckoutResultView, type ClientPaymentItem, type DuePaymentView, type SubscriptionViewK29 } from '../../_shared/k29';
import { GUIDED_ORDER, GUIDED_OWN_ROUTES, GUIDED_STEP_ROUTES, GUIDED_TEXTS, type GuidedState, type GuidedStepKey, type GuidedStepView, type GuidedView } from '../../_shared/k29g';
import type { Keres, Valasz } from '../http';
import { BENCE } from './adatok';

type Kezelo = (m: RegExpMatchArray, q: URLSearchParams, test: Record<string, unknown>, k: Keres) => Valasz | Promise<Valasz> | undefined;

export interface K29Allapot {
  guided: GuidedState;
  adoszamKesz: boolean;
  kata: boolean;
  kartya: CardInfoView | null;
  due: DuePaymentView | null;
  eredmenyek: Record<string, CheckoutResultView>;
  fizetesek: ClientPaymentItem[];
}

const DEMO_KARTYA: CardInfoView = { provider: 'demo', brand: 'demo', last4: '4242', expMonth: 12, expYear: 2029, label: 'DEMO •••• 4242', expiryLabel: '12/29', status: 'aktiv', expiringSoon: false };

export function k29Kezdo(fk: string, ma: string): K29Allapot {
  const st: K29Allapot = { guided: {}, adoszamKesz: false, kata: false, kartya: null, due: null, eredmenyek: {}, fizetesek: [] };
  const most = `${ma}T09:00:00Z`;
  if (fk !== 'uj') st.guided.welcomeSeenAt = most;
  if (['bevezeto_var', 'bevezeto_kesz', 'bevezeto_szunet', 'kartya'].includes(fk)) st.adoszamKesz = true;
  if (fk === 'bevezeto_szunet') st.guided = { welcomeSeenAt: most, pausedAt: most, lastKey: 'szerzodes' };
  if (fk === 'bevezeto_kesz') st.kartya = DEMO_KARTYA;
  // aktív ügyfelek: mentett DEMO kártya; „fizesd”: a bank megerősítést kért a havidíjhoz
  if (!['uj', 'peter', 'indul', 'utmutato', 'levente', 'marika', 'david', 'ilona', 'engedely', 'bekuldve', 'kamara', 'tamas', 'bevezeto_adoszam', 'bevezeto_var', 'bevezeto_szunet', 'kartya'].includes(fk)) st.kartya = DEMO_KARTYA;
  if (fk === 'fizesd') {
    st.due = {
      amountHuf: 19_999,
      period: { start: '2026-11-08', end: '2026-12-08' },
      reason: 'hitelesites',
      graceUntil: '2026-11-22',
      cardLabel: DEMO_KARTYA.label,
      title: PAYMENT_FAIL_TEXTS.hitelesites.title,
      text: fillPlaceholders(PAYMENT_FAIL_TEXTS.hitelesites.body, { osszeg: '19 999' }),
      openUrl: null,
    };
  }
  st.fizetesek = st.kartya
    ? [
        { id: 'minta-fiz-2', date: '2026-11-08T06:00:00Z', kind: 'havi', kindLabel: 'Havidíj', amountHuf: 19_999, status: fk === 'fizesd' ? 'hitelesites_kell' : 'sikeres', statusLabel: fk === 'fizesd' ? 'Megerősítésre vár' : 'Sikeres', cardLabel: DEMO_KARTYA.label, period: { start: '2026-11-08', end: '2026-12-08' }, refundedHuf: 0, invoice: null },
        { id: 'minta-fiz-1', date: '2026-10-08T09:12:00Z', kind: 'elso_havi', kindLabel: 'Első havidíj', amountHuf: 19_999, status: 'sikeres', statusLabel: 'Sikeres', cardLabel: DEMO_KARTYA.label, period: { start: '2026-10-08', end: '2026-11-08' }, refundedHuf: 0, invoice: null },
      ]
    : [];
  return st;
}

/** A vezetett állapot a minta-útvonalból (a szerver services/guided.ts egyszerűsített mása). */
function vezetett(st: K29Allapot, j: JourneyView | null, o: OnboardingState | null, firstName: string, kedvezmenyKesz: boolean, aktiv: boolean): GuidedView {
  const variant = j?.variant ?? 'nincs';
  const byKey = new Map((j?.steps ?? []).map((s) => [s.key, s]));
  const steps: GuidedStepView[] = [];
  for (const key of GUIDED_ORDER[variant].filter((k) => !(k === 'kedvezmenyek' && st.kata))) {
    if (key === 'adoszam') {
      steps.push({ key, title: GUIDED_TEXTS.adoszamStep, state: st.adoszamKesz ? 'kesz' : 'nyitva', route: GUIDED_STEP_ROUTES.adoszam!, timeText: st.adoszamKesz ? null : GUIDED_TEXTS.adoszamTime, actorLabel: 'Te', doneForClient: st.adoszamKesz });
      continue;
    }
    const js = byKey.get(key);
    if (!js) continue;
    const state = key === 'kedvezmenyek' ? (kedvezmenyKesz ? 'kesz' : 'nyitva') : js.state;
    steps.push({
      key,
      title: js.title,
      state,
      route: GUIDED_OWN_ROUTES[key as GuidedStepKey] ?? (key === 'adatok' ? '/bekotes/adatok' : (js.action?.route ?? GUIDED_STEP_ROUTES[key as GuidedStepKey] ?? null)),
      timeText: js.timeText,
      ...(state === 'var' ? { waitText: js.statusText } : {}),
      ...(state === 'kesobb' && js.lockedReason ? { lockedReason: js.lockedReason } : {}),
      actorLabel: js.actorLabel,
      doneForClient: state === 'kesz' || (state === 'var' && !js.clientPart),
    });
  }
  const tehet = (s: GuidedStepView) => s.state === 'most' || s.state === 'nyitva';
  const cur = steps.find(tehet) ?? null;
  const vezKulcsok = new Set(steps.filter(tehet).map((s) => s.key));
  const counted = steps.filter((s) => s.state !== 'kihagyva');
  const g = st.guided;
  void o;
  return {
    show: !aktiv && !g.pausedAt && !g.doneSeenAt,
    paused: !!g.pausedAt,
    inOnboarding: !aktiv,
    firstName,
    variant,
    welcome: { seen: !!g.welcomeSeenAt, accountant: BENCE, priceHuf: 19_999, rows: GUIDED_TEXTS.w3Rows.map((r) => ({ title: fillPlaceholders(r.title, { firstName: 'Bence' }), time: r.time })) },
    steps,
    currentKey: cur?.key ?? null,
    progress: { done: counted.filter((s) => s.doneForClient).length, total: counted.length },
    finished: !cur,
    pending: (j?.steps ?? []).filter((s) => s.state !== 'kesz' && s.state !== 'kihagyva' && !vezKulcsok.has(s.key) && s.key !== 'kedvezmenyek').map((s) => ({ key: s.key, title: s.title, actorLabel: s.actorLabel, timeText: s.state === 'var' ? 'általában 1–3 munkanap' : null, later: s.state !== 'var' })),
    waiting: j?.waiting ?? null,
    lastKey: g.lastKey ?? null,
    doneSeen: !!g.doneSeenAt,
  };
}

/** Kitalált adózók a minta-kereséshez (a szerver DEMO-ja a nav-kliens mockját használja). */
const SZEKHELY: NavAddress = { zip: '6720', city: 'Szeged', streetName: 'Kárász', streetType: 'utca', houseNumber: '7' };
function kereses(torzs: string): TaxpayerLookupResult | 'nem_erheto' {
  if (torzs === '22222222') return 'nem_erheto';
  if (torzs === '11111111') return { status: 'nem_ev', demo: true, name: 'Minta Kft.', seat: null, selfEmployed: false, vatCode: '2', countyCode: '06', adoszam: null, alanyiMentes: null, afaWarning: false, message: null };
  if (torzs === '99999999') return { status: 'nincs', demo: true, name: null, seat: null, selfEmployed: null, vatCode: null, countyCode: null, adoszam: null, alanyiMentes: null, afaWarning: false, message: null };
  const afa = torzs === '68801234' ? '2' : '1';
  return { status: 'talalt', demo: true, name: 'Németh Péter e.v.', seat: SZEKHELY, selfEmployed: true, vatCode: afa, countyCode: '06', adoszam: `${torzs}-${afa}-06`, alanyiMentes: afa === '1', afaWarning: afa !== '1', message: null };
}

export interface K29Kornyezet {
  st: () => K29Allapot;
  ma: () => string;
  aktiv: () => boolean;
  journey: () => JourneyView | null;
  onboarding: () => OnboardingState | null;
  firstName: () => string;
  kedvezmenyKesz: () => boolean;
  elofizetes: () => SubscriptionView;
  elofizetesBeallit: (s: SubscriptionView) => void;
  lepes: (step: string, status: 'kesz' | 'konyvelore_var') => void;
  ok: (t: unknown) => Valasz;
  hiba: (status: number, code: string, message: string, extra?: Record<string, unknown>, fields?: Record<string, string>) => Valasz;
  kell: () => Valasz | null;
}

export function k29Utak(ut: (method: string, minta: string, f: Kezelo) => void, c: K29Kornyezet) {
  const { ok, hiba } = c;
  const nezet = () => vezetett(c.st(), c.journey(), c.onboarding(), c.firstName(), c.kedvezmenyKesz(), c.aktiv());

  // ---------- G: vezetett első indulás ----------
  ut('GET', '/client/guided', () => c.kell() ?? ok(nezet()));
  ut('POST', '/client/guided', (_m, _q, t) => {
    const g = c.st().guided;
    const most = new Date().toISOString();
    const key = typeof t.key === 'string' ? t.key : undefined;
    if (t.action === 'welcome_seen') g.welcomeSeenAt ??= most;
    else if (t.action === 'later') Object.assign(g, { pausedAt: most, ...(key ? { lastKey: key } : {}) });
    else if (t.action === 'resume') Object.assign(g, { pausedAt: null, welcomeSeenAt: g.welcomeSeenAt ?? most });
    else if (t.action === 'step_seen' && key) g.lastKey = key;
    else if (t.action === 'done_seen') Object.assign(g, { doneSeenAt: most, pausedAt: null });
    else return hiba(400, 'validation_failed', 'Ismeretlen művelet.');
    return ok(nezet());
  });

  // ---------- §28.K.9 / §29.4.4: adószám-kereső ----------
  ut('POST', '/client/onboarding/taxpayer-lookup', async (_m, _q, t) => {
    const torzs = String(t.torzsszam ?? '').replace(/\D/g, '');
    if (torzs.length !== 8) return hiba(400, 'validation_failed', 'Az adószám első 8 számjegye kell.');
    await new Promise((r) => setTimeout(r, 400));
    const r = kereses(torzs);
    if (r === 'nem_erheto') return hiba(503, 'lookup_unavailable', GUIDED_TEXTS.adoszamTimeout);
    return ok({ ...r, cached: false });
  });
  ut('POST', '/client/onboarding/business-identity', (_m, _q, t) => {
    if (!t.name || !t.seat) return hiba(400, 'validation_failed', 'Néhány adat hiányzik.');
    c.st().adoszamKesz = true;
    return ok({});
  });

  // ---------- A: kártyás engedély, fizetés, eredmény ----------
  const kartyaLepes = () => {
    const s = c.st();
    s.kartya = DEMO_KARTYA;
    c.lepes('elofizetes', 'kesz');
    c.elofizetesBeallit({ ...c.elofizetes(), status: 'active', mode: 'demo', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-12-17', nextChargeAt: '2026-12-17T08:00:00Z', failedAttempts: 0 });
  };
  ut('GET', '/client/subscription/consent', () => {
    if (c.kell()) return c.kell()!;
    // a card change while a paid month runs: no "most … az első hónapért" line (nothing is charged now)
    const sablon = c.st().kartya ? CARD_CONSENT_TEXT.split('\n').filter((s) => !s.includes('{elsoOsszeg}')).join('\n') : CARD_CONSENT_TEXT;
    const text = fillPlaceholders(sablon, { elsoOsszeg: '19 999', idoszak: '2026. 11. 17.–2026. 12. 17.', havidij: '19 999', szunetdij: '2 999' });
    return ok({ version: CARD_CONSENT_VERSION, text, sha256: 'minta', amountNowHuf: c.st().kartya ? 0 : 19_999, monthlyHuf: 19_999, pauseHuf: 2_999, period: c.st().kartya ? null : { start: '2026-11-17', end: '2026-12-17' }, provider: 'demo', paymentMode: 'demo', demo: true, checkbox: CARD_CONSENT_UI.checkbox, button: c.st().kartya ? CARD_CONSENT_UI.buttonNoAmount : CARD_CONSENT_UI.button, under: CARD_CONSENT_UI.under });
  });
  ut('POST', '/client/subscription/start', (_m, _q, t) => {
    if (t.consentVersion === undefined) return undefined; // a régi (SimplePay) törzs a régi minta-kezelőhöz megy
    if (t.consentVersion !== CARD_CONSENT_VERSION) return hiba(409, 'consent_changed', CARD_CONSENT_UI.changed);
    const csere = t.purpose === 'card_update';
    const cs = `MINTA-CS-${Date.now()}`;
    c.st().eredmenyek[cs] = csere ? { status: 'sikeres', cel: 'elofizetes', kind: 'kartya', amountHuf: 0, cardLabel: DEMO_KARTYA.label } : { status: 'sikeres', cel: 'elofizetes', kind: 'elso_havi', amountHuf: 19_999, cardLabel: DEMO_KARTYA.label, period: { start: '2026-11-17', end: '2026-12-17' }, nextChargeOn: '2026-12-17', nextChargeHuf: 19_999 };
    kartyaLepes();
    return ok({ url: `minta:${cs}`, paymentId: cs, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), mode: csere ? 'setup' : 'payment', cel: 'elofizetes', provider: 'demo', demo: true });
  });
  ut('GET', '/client/payments/checkout/:cs', (m) => {
    const cs = decodeURIComponent(m[1]);
    const r =
      c.st().eredmenyek[cs] ??
      (cs.startsWith('MINTA-DIJ-')
        ? { status: 'sikeres', cel: 'dij', kind: 'egyszeri', amountHuf: 7_999, cardLabel: DEMO_KARTYA.label }
        : cs.startsWith('MINTA-HIBA')
          ? { status: 'sikertelen', cel: 'elofizetes', kind: 'elso_havi', amountHuf: 19_999, message: 'A bankod nem engedte a fizetést (nincs elég fedezet). Nem vontunk le semmit.' }
          : cs.startsWith('MINTA-')
            ? { status: 'sikeres', cel: 'elofizetes', kind: 'elso_havi', amountHuf: 19_999, cardLabel: DEMO_KARTYA.label, period: { start: '2026-11-17', end: '2026-12-17' }, nextChargeOn: '2026-12-17', nextChargeHuf: 19_999 }
            : null);
    return r ? ok(r) : hiba(404, 'not_found', 'Nem találjuk ezt a fizetést.');
  });
  ut('GET', '/client/payments/due', () => c.kell() ?? ok(c.st().due));
  ut('POST', '/client/payments/due/pay', () => {
    const s = c.st();
    if (!s.due) return hiba(409, 'nothing_due', 'Nincs fizetnivalód.');
    const cs = `MINTA-FK-${Date.now()}`;
    s.eredmenyek[cs] = { status: 'sikeres', cel: 'fizesd-ki', kind: 'fizesd_ki', amountHuf: s.due.amountHuf, cardLabel: DEMO_KARTYA.label, period: s.due.period, nextChargeOn: '2026-12-08', nextChargeHuf: 19_999 };
    s.due = null;
    s.fizetesek = s.fizetesek.map((f) => (f.status === 'hitelesites_kell' ? { ...f, status: 'sikeres', statusLabel: 'Sikeres' } : f));
    return ok({ url: `minta:${cs}`, paymentId: cs, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), mode: 'payment', cel: 'fizesd-ki', provider: 'demo', demo: true });
  });
  ut('GET', '/client/payments', () => c.kell() ?? ok(c.st().fizetesek));
  // a §29-es mezők a régi előfizetés-nézet mellé (a régi kezelő adja az alapot)
  ut('GET', '/client/subscription', () => {
    if (c.kell()) return c.kell()!;
    const s = c.st();
    const alap = c.elofizetes();
    const v: SubscriptionViewK29 = { ...alap, provider: 'demo', paymentProvider: 'demo', paymentMode: 'demo', cardInfo: s.kartya, monthlyHuf: 19_999, monthlySource: 'terv', due: s.due, consentNeeded: !s.kartya, ...(s.due ? { status: 'past_due', failedAttempts: 1, graceUntil: s.due.graceUntil ?? undefined } : {}) };
    if (!s.kartya && !c.aktiv()) return ok({ ...v, status: 'incomplete', card: undefined, nextChargeAt: undefined, currentPeriodEnd: undefined });
    return ok(v);
  });
  ut('POST', '/client/subscription/card/delete', () => {
    c.st().kartya = null;
    return undefined; // a régi kezelő is lefut (card: undefined)
  });
}
