// MINTA-szerver – SPEC §27 (tulaj-kérések 11-19): módosítható elágazás, „Intézzük helyetted” (assist), EGY lista
// (journey), kamarai regisztráció, jóváhagyás-útmutató. Csak a minta buildben töltődik be; a szabályok és a szövegek
// ugyanazok, mint a szerveré (kod/shared), a lista a lib/ut.ts-ből jön (ugyanaz a számítás, mint a szerver tartaléka).
import type { AssistConsentSummary, AssistView, BusinessRegistrationView, OnboardingState, OnboardingStepState } from '../../_shared/api';
import { ASSIST_STATUS_CLIENT_TEXT, ASSIST_STATUS_CLIENT_TEXT_MH, ASSIST_TEXTS, fillPlaceholders, WORK_KIND_GUIDE_VALUE } from '../../_shared/bekotes';
import {
  ASSIST_CANCELLABLE_STATUSES, ASSIST_CLOSE_REASON_LABELS, ASSIST_OPEN_STATUSES, ONBOARDING_STEP_ORDER, ONBOARDING_STEP_ORDER_SEGITETT,
  type AssistCloseReason, type AssistKind, type AssistStatus, type RegistrationMode,
} from '../../_shared/enums';
import { BENCE } from './adatok';
import { regisztracio, visszahivas, type Allapot1118 } from './tulaj1118';
import { hataridoIg, munkanapotHozzaad, napKulcs, utEpit, utvaltasInfo } from '../../lib/ut';

export interface SegitsegNyers {
  id: string;
  kind: AssistKind;
  status: AssistStatus;
  createdAt: string;
  filedAt?: string | null;
  approvedAt?: string | null;
  liveAt?: string | null;
  consentAt?: string | null;
  consentValid?: boolean;
  consentHash?: string | null;
  evFiledAt?: string | null;
  expiredCount?: number;
  closedReason?: AssistCloseReason | null;
  closedAt?: string | null;
}
export interface Allapot1119 {
  assists: SegitsegNyers[];
  chamber: { dueOn: string | null; doneAt: string | null } | null;
  pathChangedAt: string | null;
  szamlalo: number;
}

const NYITOTT = new Set<AssistStatus>(ASSIST_OPEN_STATUSES);
const napElott = (ma: string, n: number) => new Date(Date.parse(`${ma}T09:30:00Z`) - n * 86_400_000).toISOString();
const napokKozott = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const napPlusz = (nap: string, n: number) => new Date(Date.parse(`${nap}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const MARIKA_VALASZ: BusinessRegistrationView['answers'] = {
  declarations: { noExclusion: true, singleBusiness: true, acceptedAt: '2026-11-15T09:12:00Z' },
  revenueBand: 'max_12m',
  activities: [{ key: 'takaritas', label: 'Takarítás', main: true, ovtjKod: null, navKereso: 'takarítás' }],
  activityFreeText: null,
  seat: { kind: 'lakcim', address: null, right: null, provider: null },
  otherSites: [],
  workKind: 'fofoglalkozas',
  euPartner: 'nem',
  startPlan: 'mielobb',
  startDate: null,
  hasSeparateBusinessAccount: false,
};

export function kezdo1119(fk: string, t: Allapot1118, ob: OnboardingState | null, ma: string): Allapot1119 {
  const u: Allapot1119 = { assists: [], chamber: null, pathChangedAt: null, szamlalo: 1 };
  const lepes = (step: string, status: OnboardingStepState['status']) => {
    if (ob) ob.steps = ob.steps.map((s) => (s.step === step ? { ...s, status, completedAt: status === 'kesz' ? napElott(ma, 3) : s.completedAt } : s));
  };
  if (['marika', 'engedely', 'bekuldve', 'ilona'].includes(fk)) {
    t.path = 'inditas';
    const fajta = fk === 'ilona' ? 'kitoltes' : fk === 'bekuldve' ? 'beadva' : 'utmutato';
    t.reg = { ...regisztracio(t, fajta, fk === 'ilona' ? { ...MARIKA_VALASZ, declarations: null, revenueBand: null, activities: [], workKind: null, euPartner: null, startPlan: null } : fk === 'engedely' ? { ...MARIKA_VALASZ, activities: [{ key: 'takaritas', label: 'Takarítás', main: true, ovtjKod: '8121', navKereso: 'takarítás' }] } : MARIKA_VALASZ, ma), mode: 'segitett' };
    if (fk === 'engedely') t.reg = { ...t.reg, activityPending: false };
    else if (fk !== 'ilona') t.reg = { ...t.reg, activityPending: true };
    if (fk === 'bekuldve') t.reg = { ...t.reg, filed: { filedOn: napKulcs(napElott(ma, 0)), channel: 'meghatalmazott', documentId: 'ev-bejelentes-marika', fileId: 'f-ev-marika', uploadedAt: napElott(ma, 0) }, activityPending: false };
    lepes('adatok', fk === 'ilona' ? 'ugyfelre_var' : 'kesz');
    if (fk !== 'ilona') lepes('szerzodes', 'kesz');
    const status: AssistStatus = fk === 'ilona' ? 'visszahivas_kerve' : fk === 'engedely' ? 'meghatalmazas_el' : fk === 'bekuldve' ? 'bejelentes_bekuldve' : 'meghatalmazas_bekuldve';
    u.assists.push({ id: 'assist-ev-1', kind: 'vallalkozas_bejelentes', status, createdAt: napElott(ma, 3), filedAt: fk === 'ilona' ? null : napElott(ma, 1), liveAt: ['engedely', 'bekuldve'].includes(fk) ? napElott(ma, 0) : null, consentAt: fk === 'bekuldve' ? napElott(ma, 0) : null, consentValid: fk === 'bekuldve', evFiledAt: fk === 'bekuldve' ? napElott(ma, 0) : null });
    if (fk === 'ilona') {
      t.cb = visszahivas(t, { topic: 'vallalkozas_bejelentes_helyettem', window: 'barmikor', note: 'Nem értek a számítógéphez, intézzék helyettem.', source: 'helyettunk_vallalkozas' });
    } else {
      const cb = visszahivas(t, { topic: 'vallalkozas_bejelentes_helyettem', window: 'delelott', note: null, source: 'helyettunk_vallalkozas' });
      t.regiCb = [{ ...cb, status: 'teljesitve', statusText: 'Beszéltünk.', canEdit: false, canCancel: false, closedAt: napElott(ma, 2), staffFirstName: 'Anna', summary: 'Megbeszéltük: Bence beküldi a meghatalmazást, te jóváhagyod az ONYA-ban.' }];
    }
  }
  if (fk === 'david') {
    t.path = 'van';
    lepes('adatok', 'kesz');
    lepes('szerzodes', 'kesz');
    u.assists.push({ id: 'assist-mh-1', kind: 'meghatalmazas', status: 'egyeztetve', createdAt: napElott(ma, 2) });
  }
  if (fk === 'kamara') {
    t.path = 'inditas';
    t.reg = { ...regisztracio(t, 'kesz', { ...MARIKA_VALASZ, activities: [{ key: 'foto', label: 'Fotózás, képszerkesztés', main: true, ovtjKod: '7420', navKereso: 'fotó' }] }, ma), adoszam: '68812345-1-25', registeredOn: napKulcs(napElott(ma, 2)), filed: { filedOn: napKulcs(napElott(ma, 3)), channel: 'ugyfelkapu_plus', documentId: 'ev-1', fileId: 'f-ev-1', uploadedAt: napElott(ma, 3) } };
    u.chamber = { dueOn: munkanapotHozzaad(napKulcs(napElott(ma, 2)), 5), doneAt: null };
    lepes('adatok', 'kesz');
  }
  return u;
}

/** AssistView a nyers állapotból (mint a szerver assistView()-ja). */
export function segitsegNezet(a: SegitsegNyers, t: Allapot1118, ma: string): AssistView {
  const jovahagyasos = ['meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva'].includes(a.status);
  const due = a.filedAt ? napPlusz(napKulcs(a.filedAt), 3) : null;
  const daysLeft = due ? Math.max(0, napokKozott(ma, due)) : 0;
  const r = t.reg;
  const kerdoivKesz = !!r && r.status !== 'kitoltes' && r.missing.length === 0;
  const canConsent = a.kind === 'vallalkozas_bejelentes' && kerdoivKesz && !r?.activityPending && !a.consentValid && NYITOTT.has(a.status) && !['ugyfel_engedelyezte', 'bejelentes_bekuldve'].includes(a.status);
  const t0 = (a.kind === 'meghatalmazas' ? ASSIST_STATUS_CLIENT_TEXT_MH[a.status] : undefined) ?? ASSIST_STATUS_CLIENT_TEXT[a.status];
  return {
    id: a.id,
    kind: a.kind,
    status: a.status,
    statusText: fillPlaceholders(t0, { firstName: BENCE.firstName, hatarido: due ? hataridoIg(due) : '4 napon belül', reasonText: a.closedReason ? ASSIST_CLOSE_REASON_LABELS[a.closedReason].toLocaleLowerCase('hu-HU') : '' }),
    ball: a.status === 'visszahivas_kerve' || a.status === 'bejelentes_bekuldve' ? 'csapat' : ['meghatalmazas_bekuldve', 'meghatalmazas_el'].includes(a.status) ? 'ugyfel' : NYITOTT.has(a.status) ? 'konyvelo' : null,
    callbackId: t.cb?.id ?? null,
    createdAt: a.createdAt,
    approval: jovahagyasos && a.filedAt && due ? { filedAt: a.filedAt, dueOn: due, dueText: hataridoIg(due), daysLeft, lastDay: daysLeft === 0, expiredCount: a.expiredCount ?? 0 } : null,
    clientApprovedAt: a.approvedAt ?? null,
    meghatalmazasLiveAt: a.liveAt ?? null,
    consent: a.consentAt ? { at: a.consentAt, valid: !!a.consentValid } : null,
    canConsent,
    evFiledAt: a.evFiledAt ?? null,
    canCancel: (ASSIST_CANCELLABLE_STATUSES as readonly string[]).includes(a.status),
    closedReason: a.closedReason ?? null,
    closedAt: a.closedAt ?? null,
  };
}

const elo = (a: SegitsegNyers) => NYITOTT.has(a.status) || a.status === 'kesz';

/** Az onboarding-állapot §27-es kiegészítése: lépések az assist szerint, mód, pathChange, journey. */
export function bekotes1119(alap: OnboardingState, t: Allapot1118, u: Allapot1119, ma: string, keresekDb: number): OnboardingState {
  const assists = u.assists.map((a) => segitsegNezet(a, t, ma));
  const ev = u.assists.find((a) => a.kind === 'vallalkozas_bejelentes' && elo(a));
  const mh = u.assists.find((a) => a.kind === 'meghatalmazas' && elo(a));
  const mode: RegistrationMode | null = t.path === 'inditas' ? (ev && NYITOTT.has(ev.status) ? 'segitett' : (t.reg?.mode ?? 'onallo')) : null;
  const sorrend = t.path === 'inditas' && mode === 'segitett' ? ONBOARDING_STEP_ORDER_SEGITETT : ONBOARDING_STEP_ORDER[t.path ?? 'van'];
  const regi = new Map(alap.steps.map((s) => [s.step, s]));
  const szerzKesz = regi.get('szerzodes')?.status === 'kesz';
  const a = mode === 'segitett' ? ev : mh;
  const steps: OnboardingStepState[] = sorrend.map((step) => {
    let s = regi.get(step) ?? { step, status: 'ugyfelre_var' as const };
    if (step === 'meghatalmazas' && a) {
      const st = a.status;
      s = { step, status: ['meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve', 'kesz'].includes(st) ? 'kesz' : st === 'meghatalmazas_bekuldve' || st === 'meghatalmazas_lejart' ? 'ugyfelre_var' : 'konyvelore_var', data: { method: 'onya_konyvelo' } };
    }
    if (mode === 'segitett') {
      // Intézzük helyetted: a meghatalmazás a szerződés után jön (a hívás után), az igazolványok a bejelentés után.
      if (step === 'meghatalmazas' && !a) s = { ...s, locked: !szerzKesz, lockedReason: szerzKesz ? undefined : 'Előbb fogadd el a szerződést.' };
      const bejelentve = !!t.reg && ['beadva', 'javitas', 'ellenorizve', 'kesz'].includes(t.reg.status);
      if (step === 'azonositas' && !bejelentve) s = { ...s, locked: true, lockedReason: 'Ha bejelentettük a vállalkozásodat, ez is megnyílik.' };
      // SPEC §29.4.2 (no free period): the card right after the contract
      if (step === 'elofizetes' && !szerzKesz && s.status !== 'kesz') s = { ...s, locked: true, lockedReason: 'A kártyádat a szerződés után kérjük.' };
      if (step === 'nav_bekotes' && t.reg?.status !== 'kesz') s = { ...s, locked: true, lockedReason: 'A bejelentés és a meghatalmazás után Bence köti be a kiállított számláidat.' };
    }
    return s;
  });
  const o: OnboardingState = { ...alap, steps, assists, registrationMode: mode, path: t.path };
  const reg = t.reg ? { ...t.reg, mode: mode ?? t.reg.mode, chamber: u.chamber } : null;
  const pc = { ...utvaltasInfo(o, reg, 'bekotes_alatt'), changedAt: u.pathChangedAt };
  const journey = utEpit({ o: { ...o, pathChange: pc }, reg, keresekDb, ma });
  return { ...o, pathChange: pc, journey, todoCount: journey.todoCount };
}

/** GET /client/assist/:id/consent – az engedély összefoglalója (blokkok, mint a szerveré). */
export function engedelyOsszegzes(t: Allapot1118, nev: string, lakcim: string): AssistConsentSummary {
  const r = t.reg;
  const a = r?.answers;
  const tev = (a?.activities ?? []).map((x) => `${x.ovtjKod ? `${x.ovtjKod} – ` : ''}${x.label}${x.main ? ' (fő)' : ''}`);
  const blocks = [
    { key: 'rolad', title: ASSIST_TEXTS.consentBlockRolad, lines: [nev, 'Adóazonosító jel: •••••••569'], editRoute: '/bekotes/adatok?utana=vallalkozas' },
    { key: 'szekhely', title: ASSIST_TEXTS.consentBlockSzekhely, lines: [a?.seat?.kind === 'lakcim' || !a?.seat?.address ? `A lakcímed: ${lakcim}` : `${a.seat.address.zip} ${a.seat.address.city}, ${a.seat.address.line}`], editRoute: '/bekotes/vallalkozas/adatlap?lap=3' },
    { key: 'telephely', title: ASSIST_TEXTS.consentBlockTelephely, lines: a?.otherSites.length ? a.otherSites.map((o) => `${o.address.zip} ${o.address.city}, ${o.address.line}`) : ['Nincs'], editRoute: '/bekotes/vallalkozas/adatlap?lap=3' },
    { key: 'tevekenyseg', title: ASSIST_TEXTS.consentBlockTevekenyseg, lines: tev.length ? tev : ['–'], editRoute: '/bekotes/vallalkozas/adatlap?lap=2' },
    { key: 'munkavegzes', title: ASSIST_TEXTS.consentBlockMunkavegzes, lines: [a?.workKind ? WORK_KIND_GUIDE_VALUE[a.workKind] : '–'], editRoute: '/bekotes/vallalkozas/adatlap?lap=4' },
    { key: 'adozas', title: ASSIST_TEXTS.consentBlockAdozas, lines: [fillPlaceholders(ASSIST_TEXTS.consentAdozas, { kozossegi: a?.euPartner === 'igen' ? 'igen' : 'nem' })], editRoute: '/bekotes/vallalkozas/adatlap?lap=4' },
    { key: 'kezdes', title: ASSIST_TEXTS.consentBlockKezdes, lines: [fillPlaceholders(ASSIST_TEXTS.consentKezdes, { date: 'november 20' })], editRoute: null },
  ];
  const hash = `minta-${blocks.map((b) => b.lines.join('|')).join('#').length}`;
  return {
    version: '2026-11-19.1',
    hash,
    blocks,
    declarationText: ASSIST_TEXTS.consentDeclaration,
    instructionText: fillPlaceholders(ASSIST_TEXTS.consentInstruction, { accountantName: BENCE.displayName }),
    publicNote: ASSIST_TEXTS.consentPublic,
    missing: r?.missing ?? ['declarations'],
    canConsent: !!r && r.missing.length === 0 && !r.activityPending,
  };
}

export { NYITOTT as NYITOTT_SEGITSEG };
