// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
// @kezjegy/shared – SPEC §29.10 G guided first run ("bevezető"; owner: B3 app+panel).
// Owner 11-20 10:30: "nem úgy volt, hogy így végigmegy először, ilyen bevezetősen?" – a first login that walks the client
// through, one step after the other, instead of the checklist home. The server journey (buildJourney) stays the ONE
// source of states, locks and waits; this file only adds the order of the guided run, its pseudo-step 'adoszam', the
// DTOs and the copy.
import type { AccountantPublic, WaitingCardView } from './api';
import type { JourneyRowState, JourneyStepKey, JourneyVariant } from './enums';

/** A guided step = a journey row, or the pseudo-step 'adoszam' (§28.K.9 lookup) on the 'van' path. */
export type GuidedStepKey = JourneyStepKey | 'adoszam' | 'visszahivas_ajanlat';

/**
 * The order of the guided run per variant (SPEC §29.10.2). Rows that are not the client's own task (atnezes, nav_bekotes,
 * alkalmazottak, kamara) are not guided steps; they appear in GuidedView.pending. 'kedvezmenyek' is skipped for KATA.
 * Deviations from the owner's spoken order, on purpose: the contract comes BEFORE the NAV meghatalmazás (our accountant
 * is authorised under the signed contract), and the Pmt. identification ('azonositas') sits between the contract and the card.
 */
export const GUIDED_ORDER: Record<JourneyVariant, readonly GuidedStepKey[]> = {
  nincs: ['ut'],
  // k8 (owner 11-20): the card / transfer is asked only AFTER the optional callback offer ('visszahivas_ajanlat', a
  // guided-only pseudo-step like 'adoszam'; the 'inditas_segitett' path already starts with its own callback).
  van: ['ut', 'adoszam', 'adatok', 'kedvezmenyek', 'szerzodes', 'meghatalmazas', 'azonositas', 'visszahivas_ajanlat', 'elofizetes'],
  inditas_onallo: ['ut', 'adatok', 'kedvezmenyek', 'kerdoiv', 'bejelentes', 'ertesites', 'szerzodes', 'azonositas', 'visszahivas_ajanlat', 'elofizetes', 'meghatalmazas'],
  inditas_segitett: ['ut', 'visszahivas', 'adatok', 'kedvezmenyek', 'kerdoiv', 'szerzodes', 'meghatalmazas', 'vegso_jovahagyas', 'azonositas', 'elofizetes'],
};

/** Own guided screens (the others reuse the existing step screens with `?vezetett=<key>`). */
export const GUIDED_OWN_ROUTES: Partial<Record<GuidedStepKey, string>> = {
  ut: '/bevezeto/ut',
  adoszam: '/bevezeto/adoszam',
  visszahivas_ajanlat: '/bekotes/visszahivas-ajanlat',
};

/** Step screens of the guided run (route without query). The server sends the journey's own action route when it has one. */
export const GUIDED_STEP_ROUTES: Partial<Record<GuidedStepKey, string>> = {
  ut: '/bevezeto/ut',
  adoszam: '/bevezeto/adoszam',
  adatok: '/bekotes/adatok',
  kedvezmenyek: '/kedvezmenyek/kerdoiv',
  kerdoiv: '/bekotes/vallalkozas/adatlap',
  bejelentes: '/bekotes/vallalkozas/utmutato',
  ertesites: '/bekotes/vallalkozas/feltoltes',
  szerzodes: '/bekotes/szerzodes',
  meghatalmazas: '/bekotes/meghatalmazas',
  vegso_jovahagyas: '/bekotes/vallalkozas/engedely',
  azonositas: '/bekotes/azonositas',
  visszahivas_ajanlat: '/bekotes/visszahivas-ajanlat',
  elofizetes: '/bekotes/elofizetes',
};

/** k8: 'callback_offer_skip' = "Nem kell, mehetünk tovább" on the callback offer (GuidedState.callbackOfferSkippedAt). */
export const GUIDED_ACTIONS = ['welcome_seen', 'later', 'resume', 'step_seen', 'done_seen', 'callback_offer_skip'] as const;
export type GuidedAction = (typeof GUIDED_ACTIONS)[number];

/** clients.guided (jsonb; null = never started). */
export interface GuidedState {
  welcomeSeenAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
  lastKey?: string | null;
  doneSeenAt?: string | null;
  /** k8: the client answered the callback offer with "Nem kell, mehetünk tovább". */
  callbackOfferSkippedAt?: string | null;
}

export interface GuidedStepView {
  key: GuidedStepKey;
  title: string;
  /** The journey state ('adoszam': 'kesz' once the adószám is known or the client chose "Most nem tudom"). */
  state: JourneyRowState;
  /** Screen of the step, without the `vezetett` query (the app adds it). */
  route: string | null;
  /** "kb. 5 perc" / "általában 1–3 munkanap". */
  timeText: string | null;
  /** While someone else works on it: the waiting title ("A NAV-nál a meghatalmazás…"). */
  waitText?: string | null;
  lockedReason?: string | null;
  actorLabel: string;
  /** The client finished his part (state 'kesz', or someone else works on it now). Counts in progress.done. */
  doneForClient: boolean;
}

/** GET /client/guided */
export interface GuidedView {
  /** Auto-open instead of /bekotes: client in onboarding, not terminated, not paused, the done screen not yet seen. */
  show: boolean;
  paused: boolean;
  /** lifecycle 'bekotes_alatt' and not terminated – outside it /bevezeto sends the client home. */
  inOnboarding: boolean;
  /** The client's first name (W1 "Szia {keresztnev}!"). */
  firstName: string;
  variant: JourneyVariant;
  welcome: {
    seen: boolean;
    accountant: AccountantPublic | null;
    priceHuf: number;
    rows: { title: string; time: string }[];
  };
  steps: GuidedStepView[];
  /** The FIRST 'most'/'nyitva' step in GUIDED_ORDER (a waiting step never blocks the next one); null when finished. */
  currentKey: GuidedStepKey | null;
  progress: { done: number; total: number };
  /** No client step left that can be done now (only waits and later steps). */
  finished: boolean;
  /** What others do now / what comes later (who · what · usual time) – the done screen and the waiting screen. */
  pending: { key: string; title: string; actorLabel: string; timeText: string | null; later: boolean }[];
  /** The journey's waiting card (title, body, time) – the waiting interstitial. */
  waiting: WaitingCardView | null;
  lastKey: string | null;
  doneSeen: boolean;
}

/** POST /client/guided */
export interface GuidedActionInput {
  action: GuidedAction;
  key?: GuidedStepKey;
}

/** SPEC §29.10.4 – copy of the guided run (tegező, short; content keys k29g.*). */
export const GUIDED_TEXTS = {
  later: 'Később folytatom',
  back: 'Vissza',
  progress: '{done} / {total} lépés kész',
  next: 'Tovább',
  w1Title: 'Szia {keresztnev}!',
  w1Body: 'Üdv az Adózzban. Mi könyveljük az egyéni vállalkozásodat: kiszámoljuk az adódat, beadjuk a bevallásaidat, és szólunk, ha teendőd van.',
  w2Title: 'Ő lesz a könyvelőd',
  w2Line: '{titulus}, nyilvántartási szám: {szam}',
  w2Body: 'Név szerint ismer. Neki írsz az appban, és ő ad be mindent a NAV-nál helyetted.',
  w2NoneTitle: 'Kapsz egy saját könyvelőt',
  w2NoneBody: 'A beállítás közben kijelöljük. Addig csapatunk segít.',
  w3Title: 'Így indulunk',
  w3Rows: [
    // k8: no time estimates (owner rule); the payment row names no card – the transfer may be chosen too
    { title: 'Pár kérdés rólad és a vállalkozásodról', time: '' },
    { title: 'Szerződés és engedély a NAV-nál', time: '' },
    { title: 'Az előfizetés elindítása', time: '' },
    { title: '{firstName} bekapcsolja a könyvelést', time: 'a NAV-tól függ' },
  ],
  w3PriceTitle: 'Mennyibe kerül?',
  w3Price: '{osszeg} Ft / hó',
  w3PriceBody: 'Minden benne van, amit az app tud. Az első hónapot az előfizetés elindításakor fizeted. Bármikor lemondhatod.',
  w3Start: 'Kezdjük',
  utTitle: 'Van már egyéni vállalkozásod?',
  utSub: 'Ha rosszat választasz, később módosíthatod.',
  utVan: 'Igen, van',
  utVanSub: 'Már van adószámom.',
  utInditas: 'Még nincs, most indítanám',
  utInditasSub: 'Segítünk elindítani.',
  utHowTitle: 'Hogyan jelentsük be?',
  utHowSub: 'A vállalkozásodat a NAV-nál kell bejelenteni. Választhatsz.',
  utOnallo: 'Magam jelentem be',
  utOnalloSub: 'Megmutatjuk, mit hova jelölj.',
  utSegitett: 'Intézzétek helyettem',
  utSegitettSub: 'Felhívunk, és {firstName} bejelenti helyetted. Neked: pár adat és két jóváhagyás.',
  varTitle: 'Most {ki} jön',
  varMeanwhile: 'Addig folytasd a következővel.',
  varNext: 'Tovább: {lepes}',
  varDone: 'Tovább',
  doneTitle: 'Kész vagy a te részeddel!',
  doneBody: 'Most {firstName} és a NAV dolgozik. Szólunk, ha kell tőled valami.',
  // k7c: a client step that only comes later (e.g. approving the NAV-meghatalmazás once our team sent it) is still his –
  // the done screen says so, like the checklist ("Már csak 1 dolog kell tőled")
  doneLaterTitle: 'Most nincs több teendőd',
  doneLaterBody: 'Később még {n} dolog kell tőled: {lepesek}. Szólunk, ha itt az ideje. Addig {firstName} és a NAV dolgozik.',
  donePendingTitle: 'Ami most történik',
  doneLater: 'később',
  doneButton: 'Főoldal',
  pausedTitle: 'Folytasd ott, ahol abbahagytad',
  pausedNext: 'Következő: {lepes} · {ido}',
  pausedNextNoTime: 'Következő: {lepes}',
  pausedButton: 'Folytatom',
  // k7c: on the checklist before the guided run was ever started (never "Folytasd ott, ahol abbahagytad")
  startTitle: 'Végigvezetünk a beállításon',
  startBody: 'Egyszerre egy lépés, mindig látod, mi jön. Bármikor abbahagyhatod, és később ott folytatod.',
  startButton: 'Kezdjük',
  adoszamStep: 'Adószámod',
  adoszamTime: '',
  adoszamManual: 'Kitöltöm kézzel',
  adoszamTimeout: 'Most nem érjük el a NAV-ot. Töltsd ki kézzel – ugyanúgy jó.',
  firstMonth: 'Az első hónapot az előfizetés elindításakor fizeted. Bármikor lemondhatod.',
} as const;
