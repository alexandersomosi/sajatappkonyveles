// LOCAL MOCK – the service-team endpoints of SPEC §26.10 (callbacks, new-business pipeline, team threads, staff).
// Only in `--mode mock` builds. Everything is fictional (SPEC §26.13 demo addition: Nagy Anna, Tóth Levente, Fehér
// Zsófia, 4 callbacks in 4 states + a few more cards so every column and state can be seen).
import type { MockClient } from './data';
import { BENCE, uid } from './data';
import type {
  AdminServiceStats,
  BusinessRegistrationAnswers,
  BusinessRegistrationHints,
  Message,
  StaffRef,
  TeamCallbackDetail,
  TeamCallbackRow,
  TeamClientCard,
  TeamMemberRow,
  TeamRegistrationDetail,
  TeamRegistrationRow,
  TeamSummary,
  TeamThreadRow,
} from '../_shared/api';
import {
  CALLBACK_ATTEMPT_OUTCOME_LABELS,
  CALLBACK_CLOSE_REASON_LABELS,
  CALLBACK_FAILED_OUTCOMES,
  CALLBACK_OPEN_STATUSES,
  CALLBACK_RULES,
  REGISTRATION_CHECK_ITEMS,
  REGISTRATION_OPEN_STATUSES,
  REGISTRATION_STEP_STATUS,
  type CallbackAttemptOutcome,
  type CallbackCloseReason,
  type CallbackSource,
  type CallbackStatus,
  type CallbackTopic,
  type CallbackWindow,
  type CostRatio,
  type FilingChannel,
  type Milestone,
  type RegistrationCheckItem,
  type RegistrationStatus,
} from '../_shared/enums';
import { BUSINESS_ACTIVITIES, isValidOvtjKod, maskHuPhone, normalizeHuPhone } from '../_shared/bekotes';
import { adoszamEllenor } from '../lib/csapat';

type H = (x: { q: URLSearchParams; body: Record<string, unknown>; form: FormData | null; p: Record<string, string> }) => unknown;
export interface CsapatCtx {
  on: (m: string, path: string, h: H) => void;
  clients: MockClient[];
  msgs: Map<string, Message[]>;
  role: () => string;
  nowIso: () => string;
  hiba: (status: number, code: string, msg: string, extra?: Record<string, unknown>) => Error;
  fileMeta: Map<string, { title: string; kind: 'kyc' | 'doc' }>;
  logAudit: (action: string, c: MockClient | null, details?: Record<string, unknown> | null) => void;
  milestone: (c: MockClient) => Milestone | null;
}

export const ANNA: StaffRef = { userId: 'u-anna', name: 'Nagy Anna', firstName: 'Anna', role: 'csapat' };
const BENCE_REF: StaffRef = { userId: 'u-bence', name: BENCE.displayName, firstName: BENCE.firstName, role: 'accountant' };
const ADMIN_REF: StaffRef = { userId: 'u-admin', name: 'Demo Tulajdonos', firstName: 'Tulajdonos', role: 'admin' };
const ORA = 3_600_000;

export interface MCb {
  id: string;
  clientId: string;
  status: CallbackStatus;
  topic: CallbackTopic;
  source: CallbackSource;
  window: CallbackWindow;
  note: string | null;
  phone: string | null;
  createdAt: string;
  targetAt: string;
  dueAt: string;
  assignee: StaffRef | null;
  callingNowUntil: string | null;
  attempts: { id: string; at: string; by: StaffRef; outcome: CallbackAttemptOutcome; note: string | null }[];
  nextAttemptAfter: string | null;
  internalNote: string | null;
  summaryForClient: string | null;
  closedReason: CallbackCloseReason | null;
  closedAt: string | null;
  history: { at: string; by: StaffRef | null; action: string; text: string }[];
  legacyAppointment: TeamCallbackDetail['legacyAppointment'];
}
export interface MReg {
  id: string;
  clientId: string;
  status: RegistrationStatus;
  statusSince: string;
  answers: BusinessRegistrationAnswers;
  guideOpenedAt: string | null;
  guideDone: number;
  filed: { filedOn: string; channel: FilingChannel; documentId: string; fileId: string; mime: string; uploadedAt: string } | null;
  checkItems: RegistrationCheckItem[];
  checkedBy: StaffRef | null;
  checkedAt: string | null;
  fixNote: string | null;
  adoszam: string | null;
  ev: string | null;
  registeredOn: string | null;
  staffNote: string | null;
  assignee: StaffRef | null;
  history: { at: string; by: StaffRef | null; action: string; text: string }[];
  doneAt: string | null;
  /** SPEC §27.3: who files the EV bejelentés ('segitett' = our accountant as meghatalmazott). */
  mode?: 'onallo' | 'segitett';
  /** SPEC §27.2.5: the client left this path (registration 'elallt', reason 'mar_van_vallalkozasa'). */
  pathChangedAt?: string | null;
}

/** Hooks the "Intézzük helyette" mock (helyettunk.ts) fills in: it enriches the shapes of this file. */
export interface CsapatKieg {
  kartya: (k: MockClient, c: TeamClientCard) => TeamClientCard;
  regSor: (r: MReg, row: TeamRegistrationRow) => TeamRegistrationRow;
  osszeg: (s: TeamSummary) => TeamSummary;
  szolg: (s: AdminServiceStats) => AdminServiceStats;
  /** Throws when the caller may not do the four-eyes check of this registration. */
  ellenorzes: (r: MReg) => void;
}

const UZENET_CSAPAT = 'Anna · ügyfélszolgálat';

export function installCsapat(x: CsapatCtx) {
  const kieg: CsapatKieg = { kartya: (_k, c) => c, regSor: (_r, row) => row, osszeg: (q) => q, szolg: (q) => q, ellenorzes: () => {} };
  const { on, clients, msgs, nowIso } = x;
  const nowMs = () => Date.parse(nowIso());
  const ago = (h: number) => new Date(nowMs() - h * ORA).toISOString();
  const dayOf = (iso: string) => iso.slice(0, 10);
  const nev = (c: MockClient) => `${c.lastName} ${c.firstName}`;
  const kliens = (id: string) => {
    const c = clients.find((k) => k.id === id);
    if (!c) throw x.hiba(404, 'not_found', 'Nincs ilyen ügyfél, vagy nincs hozzá jogod.');
    return c;
  };
  const en = (): StaffRef => (x.role() === 'csapat' ? ANNA : x.role() === 'admin' ? ADMIN_REF : BENCE_REF);
  const csapatVagyAdmin = () => {
    if (x.role() !== 'csapat' && x.role() !== 'admin') throw x.hiba(404, 'not_found', 'Nincs ilyen oldal.');
  };
  const csakCsapat = () => {
    if (x.role() !== 'csapat') throw x.hiba(404, 'not_found', 'Nincs ilyen oldal.');
  };
  const team: (TeamMemberRow & { createdBy?: string })[] = [
    { userId: ANNA.userId, email: 'anna.nagy@demo.kezjegy.test', displayName: ANNA.name, firstName: ANNA.firstName, active: true, totpEnabled: true, openCallbacks: 0, callbacksDone30d: 0, registrationsChecked30d: 0, lastLoginAt: ago(0.7), createdAt: '2026-11-18T08:30:00.000Z' },
    { userId: 'u-ilona', email: 'ilona.lakatos@demo.kezjegy.test', displayName: 'Lakatos Ilona', firstName: 'Ilona', active: false, totpEnabled: true, openCallbacks: 0, callbacksDone30d: 0, registrationsChecked30d: 0, lastLoginAt: '2026-11-02T15:12:00.000Z', createdAt: '2026-10-20T09:00:00.000Z' },
  ];

  // ---------- registrations ----------
  const akt = (key: string, main: boolean) => {
    const b = BUSINESS_ACTIVITIES.find((a) => a.key === key)!;
    return { key, label: b.label, main, ovtjKod: b.ovtjKod, navKereso: b.navKereso };
  };
  const nyil = (h: number) => ({ noExclusion: true, singleBusiness: true, acceptedAt: ago(h) });
  const ures: BusinessRegistrationAnswers = {
    declarations: null,
    revenueBand: null,
    activities: [],
    activityFreeText: null,
    seat: null,
    otherSites: [],
    workKind: null,
    euPartner: null,
    startPlan: null,
    startDate: null,
    hasSeparateBusinessAccount: null,
  };
  const pdf = (title: string) => {
    const fileId = uid('f');
    x.fileMeta.set(fileId, { title, kind: 'doc' });
    return fileId;
  };
  const tortenet = (h: number, by: StaffRef | null, action: string, text: string) => ({ at: ago(h), by, action, text });
  const regs: MReg[] = [
    {
      id: 'reg-levente',
      clientId: 'c-levente',
      status: 'beadva',
      statusSince: ago(22),
      answers: { ...ures, declarations: nyil(140), revenueBand: 'max_12m', activities: [akt('foto', true), akt('video', false)], seat: { kind: 'lakcim', address: null, right: null, provider: null }, workKind: 'fofoglalkozas', euPartner: 'nem', startPlan: 'mielobb', hasSeparateBusinessAccount: true },
      guideOpenedAt: ago(50),
      guideDone: 14,
      filed: { filedOn: dayOf(ago(24)), channel: 'ugyfelkapu_plus', documentId: uid('d'), fileId: pdf('MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS (Tóth Levente)'), mime: 'application/pdf', uploadedAt: ago(22) },
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: null,
      history: [tortenet(140, null, 'registration.submitted', 'Elküldte az adatlapot, megkapta az útmutatót'), tortenet(50, null, 'registration.guide_opened', 'Megnyitotta az útmutatót'), tortenet(22, null, 'registration.filed', 'Beküldte a bejelentést (Ügyfélkapu+), feltöltötte a NAV-os igazolást')],
      doneAt: null,
    },
    {
      id: 'reg-zsofia',
      clientId: 'c-zsofia',
      status: 'utmutato',
      statusSince: ago(98),
      answers: {
        ...ures,
        declarations: nyil(100),
        revenueBand: 'max_12m',
        activities: [akt('kozmetika', true)],
        seat: { kind: 'mas_cim', address: { zip: '1136', city: 'Budapest', line: 'Kitalált utca 14.' }, right: 'berlet', provider: null },
        workKind: 'munkaviszony_mellett',
        euPartner: 'nem_tudom',
        startPlan: 'datum',
        startDate: '2026-12-01',
      },
      guideOpenedAt: ago(97),
      guideDone: 5,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: null,
      history: [tortenet(98, null, 'registration.submitted', 'Elküldte az adatlapot, megkapta az útmutatót'), tortenet(97, null, 'registration.guide_opened', 'Megnyitotta az útmutatót')],
      doneAt: null,
    },
    {
      id: 'reg-dora',
      clientId: 'c-dora',
      status: 'kitoltes',
      statusSince: ago(26),
      answers: { ...ures, declarations: nyil(26), revenueBand: 'max_12m' },
      guideOpenedAt: null,
      guideDone: 0,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: null,
      history: [tortenet(26, null, 'business_status.set', 'Azt választotta: „Még nincs, most indítanám”')],
      doneAt: null,
    },
    {
      id: 'reg-mark',
      clientId: 'c-mark',
      status: 'javitas',
      statusSince: ago(27),
      answers: { ...ures, declarations: nyil(200), revenueBand: '12_20m', activities: [akt('szoftver', true), akt('it_tanacsadas', false)], seat: { kind: 'lakcim', address: null, right: null, provider: null }, workKind: 'munkaviszony_mellett', euPartner: 'igen', startPlan: 'mielobb', hasSeparateBusinessAccount: false },
      guideOpenedAt: ago(190),
      guideDone: 14,
      filed: { filedOn: dayOf(ago(75)), channel: 'dap', documentId: uid('d'), fileId: pdf('MINTA – fotó a NAV-értesítésről (Horváth Márk)'), mime: 'image/jpeg', uploadedAt: ago(74) },
      checkItems: ['szemelyes_adatok', 'szekhely', 'tevekenysegek', 'atalanyadozas', 'alanyi_afa_mentesseg', 'kata_nem', 'penzforgalmi_nem', 'kozossegi_adoszam'],
      checkedBy: null,
      checkedAt: null,
      fixNote: 'A munkavégzés jellegénél „Főfoglalkozású” lett bejelölve, de azt írtad, mellette heti 40 órás munkaviszonyod van. Lépj be újra a Vállalkozói Ügysegédbe, indíts változásbejelentést, és válaszd ezt: „Munkaviszony mellett”. Utána töltsd fel az új igazolást.',
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: 'Telefonon is elmondtam neki, érti.',
      assignee: ANNA,
      history: [tortenet(200, null, 'registration.submitted', 'Elküldte az adatlapot, megkapta az útmutatót'), tortenet(74, null, 'registration.filed', 'Beküldte a bejelentést (DÁP), feltöltötte a NAV-os igazolást'), tortenet(27, ANNA, 'registration.fix_requested', 'Javítást kért: munkavégzés jellege')],
      doneAt: null,
    },
    {
      id: 'reg-viktor',
      clientId: 'c-viktor',
      status: 'ellenorizve',
      statusSince: ago(45),
      answers: { ...ures, declarations: nyil(300), revenueBand: 'max_12m', activities: [akt('festes_burkolas', true)], activityFreeText: 'Lakásfelújítás: festés, glettelés, kisebb burkolás.', seat: { kind: 'lakcim', address: null, right: null, provider: null }, workKind: 'fofoglalkozas', euPartner: 'nem', startPlan: 'mielobb', hasSeparateBusinessAccount: true },
      guideOpenedAt: ago(290),
      guideDone: 14,
      filed: { filedOn: dayOf(ago(70)), channel: 'dap', documentId: uid('d'), fileId: pdf('MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS (Pintér Viktor)'), mime: 'application/pdf', uploadedAt: ago(69) },
      checkItems: [...REGISTRATION_CHECK_ITEMS],
      checkedBy: ANNA,
      checkedAt: ago(45),
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: ANNA,
      history: [tortenet(300, null, 'registration.submitted', 'Elküldte az adatlapot, megkapta az útmutatót'), tortenet(69, null, 'registration.filed', 'Beküldte a bejelentést (DÁP), feltöltötte a NAV-os igazolást'), tortenet(45, ANNA, 'registration.checked', 'Ellenőrizte a NAV-os igazolást, minden rendben')],
      doneAt: null,
    },
    {
      id: 'reg-nora',
      clientId: 'c-nora',
      status: 'kesz',
      statusSince: ago(150),
      answers: { ...ures, declarations: nyil(500), revenueBand: 'max_12m', activities: [akt('grafika', true)], seat: { kind: 'lakcim', address: null, right: null, provider: null }, workKind: 'fofoglalkozas', euPartner: 'igen', startPlan: 'mielobb', hasSeparateBusinessAccount: true },
      guideOpenedAt: ago(480),
      guideDone: 14,
      filed: { filedOn: '2026-11-11', channel: 'ugyfelkapu_plus', documentId: uid('d'), fileId: pdf('MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS (Kertész Nóra)'), mime: 'application/pdf', uploadedAt: ago(170) },
      checkItems: [...REGISTRATION_CHECK_ITEMS],
      checkedBy: ANNA,
      checkedAt: ago(160),
      fixNote: null,
      adoszam: '12345676-1-13',
      ev: '58123456',
      registeredOn: '2026-11-11',
      staffNote: null,
      assignee: ANNA,
      history: [tortenet(170, null, 'registration.filed', 'Beküldte a bejelentést, feltöltötte a NAV-os igazolást'), tortenet(160, ANNA, 'registration.checked', 'Ellenőrizte a NAV-os igazolást'), tortenet(150, ANNA, 'registration.adoszam_set', 'Rögzítette az adószámot – kész')],
      doneAt: ago(150),
    },
    {
      id: 'reg-balint',
      clientId: 'c-balint',
      status: 'elallt',
      statusSince: ago(190),
      answers: { ...ures, declarations: nyil(380), revenueBand: 'max_12m', activities: [akt('zene', true)], workKind: 'nyugdij_mellett', startPlan: 'datum', startDate: '2027-02-01' },
      guideOpenedAt: ago(370),
      guideDone: 2,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: null,
      history: [tortenet(380, null, 'registration.submitted', 'Elküldte az adatlapot, megkapta az útmutatót'), tortenet(190, null, 'registration.withdrawn', 'Leállította: később indítja')],
      doneAt: null,
    },
    // SPEC §27.7.4 – "Intézzük helyette" (mode 'segitett') and a branch switcher
    {
      id: 'reg-marika',
      clientId: 'c-marika',
      status: 'utmutato',
      statusSince: ago(70),
      mode: 'segitett',
      answers: {
        ...ures,
        declarations: nyil(72),
        revenueBand: 'max_12m',
        activities: [{ ...akt('takaritas', true), ovtjKod: null }],
        seat: { kind: 'lakcim', address: null, right: null, provider: null },
        workKind: 'fofoglalkozas',
        euPartner: 'nem',
        startPlan: 'mielobb',
        hasSeparateBusinessAccount: true,
      },
      guideOpenedAt: null,
      guideDone: 0,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: ANNA,
      history: [tortenet(80, null, 'business_status.set', 'Azt választotta: „Még nincs, most indítanám” – „Intézzétek helyettem”'), tortenet(70, null, 'registration.submitted', 'Kitöltötte a kérdőívet')],
      doneAt: null,
    },
    {
      id: 'reg-ilona',
      clientId: 'c-ilona',
      status: 'kitoltes',
      statusSince: ago(20),
      mode: 'segitett',
      answers: { ...ures },
      guideOpenedAt: null,
      guideDone: 0,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: null,
      history: [tortenet(20, null, 'business_status.set', 'Azt választotta: „Még nincs, most indítanám” – „Intézzétek helyettem”')],
      doneAt: null,
    },
    {
      id: 'reg-timea',
      clientId: 'c-timea',
      status: 'utmutato',
      statusSince: ago(150),
      mode: 'segitett',
      answers: {
        ...ures,
        declarations: nyil(160),
        revenueBand: 'max_12m',
        activities: [{ ...akt('kozmetika', true), ovtjKod: '960200', ovtjNev: 'Fodrászat és egyéb szépségápolás' }],
        seat: { kind: 'mas_cim', address: { zip: '9021', city: 'Győr', line: 'Szalon utca 4.' }, right: 'berlet', provider: null },
        workKind: 'fofoglalkozas',
        euPartner: 'nem',
        startPlan: 'mielobb',
        hasSeparateBusinessAccount: true,
      },
      guideOpenedAt: null,
      guideDone: 0,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: ANNA,
      history: [tortenet(160, null, 'registration.submitted', 'Kitöltötte a kérdőívet'), tortenet(140, ANNA, 'registration.edited_by_staff', 'Anna megírta az ÖVTJ-sort')],
      doneAt: null,
    },
    {
      id: 'reg-gergely',
      clientId: 'c-gergely',
      status: 'elallt',
      statusSince: ago(5),
      pathChangedAt: ago(5),
      answers: { ...ures, declarations: nyil(40), revenueBand: 'max_12m', activities: [akt('web', true)] },
      guideOpenedAt: null,
      guideDone: 0,
      filed: null,
      checkItems: [],
      checkedBy: null,
      checkedAt: null,
      fixNote: null,
      adoszam: null,
      ev: null,
      registeredOn: null,
      staffNote: null,
      assignee: null,
      history: [tortenet(40, null, 'business_status.set', 'Azt választotta: „Még nincs, most indítanám”'), tortenet(5, null, 'business_status.changed', 'Módosította a válaszát: már van vállalkozása')],
      doneAt: null,
    },
  ];
  // Keep the derived step status and the branch answer in line with the registrations (SPEC §26.1.6).
  for (const r of regs) {
    const c = clients.find((k) => k.id === r.clientId);
    if (!c) continue;
    const s = c.steps.find((k) => k.step === 'vallalkozas_inditas');
    if (s) s.status = REGISTRATION_STEP_STATUS[r.status];
    if (r.status === 'elallt') c.businessStatus = r.pathChangedAt ? 'van' : null;
    if (r.status === 'elallt' && r.pathChangedAt && s) s.status = 'kihagyva';
    if (r.status === 'javitas' && s) s.note = r.fixNote ?? undefined;
  }

  const hintsOf = (a: BusinessRegistrationAnswers): BusinessRegistrationHints => {
    const fo = a.activities.find((k) => k.main) ?? a.activities[0];
    const b = fo?.key ? BUSINESS_ACTIVITIES.find((k) => k.key === fo.key) : undefined;
    const costClass = b?.costClass ?? (fo ? 'ellenorizendo' : null);
    const costRatio = (costClass === 'altalanos' ? 45 : costClass === 'lista80' ? 80 : costClass === 'kiskereskedelem' ? 90 : null) as CostRatio | null;
    const fo1 = a.workKind === 'fofoglalkozas';
    return {
      costClass,
      costRatio,
      costRatioText: !fo ? null : costRatio ? `A tevékenységed alapján a költséghányadod várhatóan ${costRatio}%. 2027-től az általános költséghányad 50%. ${BENCE.firstName} megerősíti.` : `A költséghányadot ${BENCE.firstName} mondja meg.`,
      minimumMonthlyContributionHuf: fo1 ? 101_682 : null,
      contributionText: !a.workKind
        ? null
        : fo1
          ? 'Főállásban akkor is fizetsz havonta legalább 101 682 Ft járulékot (TB + szocho), ha kevés a bevételed. Negyedévente egyben utalod.'
          : 'Mellékállásban (nyugdíj mellett) nincs legkisebb járulék: csak a tényleges jövedelmed után fizetsz.',
      afaLimitHuf: 20_000_000,
      atalanyCapHuf: 38_736_000,
      qualificationNote: b?.kepesitesKellhet ? 'Ehhez a munkához képesítés vagy engedély kellhet. A bejelentésnél nem kérik, de legyen meg, mielőtt elkezded.' : null,
      stop: a.revenueBand === 'tobb_20m' ? { code: 'tobb_20m', text: 'Ennyi bevétel mellett nem lehetsz alanyi ÁFA-mentes. Szolgáltatásunk most az ÁFA-mentes egyéni vállalkozóknak szól.' } : null,
    };
  };

  // ---------- callbacks ----------
  const cb = (o: Partial<MCb> & Pick<MCb, 'id' | 'clientId' | 'topic' | 'source' | 'createdAt'>): MCb => ({
    status: 'uj',
    window: 'barmikor',
    note: null,
    phone: kliens(o.clientId).phone ? normalizeHuPhone(kliens(o.clientId).phone!) : null,
    targetAt: new Date(Date.parse(o.createdAt) + CALLBACK_RULES.targetHours * ORA).toISOString(),
    dueAt: new Date(Date.parse(o.createdAt) + CALLBACK_RULES.dueHours * ORA).toISOString(),
    assignee: null,
    callingNowUntil: null,
    attempts: [],
    nextAttemptAfter: null,
    internalNote: null,
    summaryForClient: null,
    closedReason: null,
    closedAt: null,
    history: [{ at: o.createdAt, by: null, action: 'callback.created', text: 'Visszahívást kért az appban' }],
    legacyAppointment: null,
    ...o,
  });
  const peterStart = '2026-11-19T09:00:00.000Z'; // 10:00 Budapest – the legacy booked call
  const cbs: MCb[] = [
    cb({ id: 'cb-levente', clientId: 'c-levente', topic: 'vallalkozas_inditas', source: 'vallalkozas_utmutato', createdAt: ago(3), note: 'Nem találom, melyik tevékenységet válasszam.' }),
    cb({ id: 'cb-zsofia', clientId: 'c-zsofia', topic: 'vallalkozas_inditas', source: 'vallalkozas_utmutato', createdAt: ago(50), window: 'delutan', note: 'Elakadtam az Ügyfélkapu+ belépésnél, nem jön meg a kód.' }),
    cb({ id: 'cb-lili', clientId: 'c-lili', topic: 'bekotes', source: 'adatok', createdAt: ago(26), note: 'A költséghányadnál nem tudom, mit jelöljek. Webshopom van.' }),
    cb({
      id: 'cb-peter',
      clientId: 'c-peter',
      topic: 'bekotes',
      source: 'regi_idopont',
      window: 'delelott',
      createdAt: ago(1),
      dueAt: new Date(Date.parse(peterStart) + 2 * ORA).toISOString(),
      note: 'Korábban egyeztetett hívás: november 19. 10:00 (telefon)',
      legacyAppointment: { startsAt: peterStart, channel: 'telefon', status: 'foglalt' },
      history: [{ at: ago(1), by: null, action: 'callback.created', text: 'A régi időpontfoglalásból lett visszahívás' }],
    }),
    cb({
      id: 'cb-reka',
      clientId: 'c-reka',
      topic: 'ado_befizetes',
      source: 'fiok',
      status: 'folyamatban',
      createdAt: ago(20),
      note: 'A negyedéves befizetésről kérdeznék, nem értem a szocho részét.',
      assignee: ANNA,
      attempts: [{ id: uid('att'), at: ago(3), by: ANNA, outcome: 'nem_vette_fel', note: 'Kicsengett, hangposta.' }],
      history: [tortenet(20, null, 'callback.created', 'Visszahívást kért az appban'), tortenet(19, ANNA, 'callback.claimed', 'Anna magára vette'), tortenet(3, ANNA, 'callback.attempt', 'Hívás: nem vette fel')],
    }),
    cb({
      id: 'cb-eszter',
      clientId: 'c-eszter',
      topic: 'ado_befizetes',
      source: 'uzenetek',
      status: 'folyamatban',
      createdAt: ago(6),
      note: 'Kérdésem van a decemberi befizetésről, telefonon könnyebb lenne.',
      phone: '+36705550199',
      assignee: BENCE_REF,
      internalNote: 'Adókérdés, átadtam Bencének.',
      history: [tortenet(6, null, 'callback.created', 'Visszahívást kért az appban'), tortenet(5.5, ANNA, 'callback.claimed', 'Anna magára vette'), tortenet(5.4, ANNA, 'callback.assigned', 'Anna átadta: Kovács Bence')],
    }),
    // SPEC §27.7.4 – callbacks of the assisted requests
    cb({
      id: 'cb-marika',
      clientId: 'c-marika',
      topic: 'vallalkozas_bejelentes_helyettem',
      source: 'helyettunk_vallalkozas',
      status: 'teljesitve',
      createdAt: ago(60),
      note: 'Nem igazodom ki a NAV oldalán, intézzék helyettem.',
      assignee: ANNA,
      attempts: [{ id: uid('att'), at: ago(48), by: ANNA, outcome: 'beszeltunk', note: 'DÁP-ja van, a lányával együtt csinálja.' }],
      summaryForClient: 'Megbeszéltük: Bence beküldi a meghatalmazást, te jóváhagyod az ONYA-ban.',
      closedAt: ago(48),
      history: [tortenet(60, null, 'callback.created', 'Visszahívást kért az appban („Intézzétek helyettem”)'), tortenet(50, ANNA, 'callback.claimed', 'Anna magára vette'), tortenet(48, ANNA, 'callback.attempt', 'Hívás: beszéltünk – összefoglaló elküldve')],
    }),
    cb({
      id: 'cb-david',
      clientId: 'c-david',
      topic: 'meghatalmazas_helyettem',
      source: 'helyettunk_meghatalmazas',
      status: 'teljesitve',
      createdAt: ago(30),
      note: null,
      assignee: ANNA,
      attempts: [{ id: uid('att'), at: ago(20), by: ANNA, outcome: 'beszeltunk', note: null }],
      summaryForClient: 'Megbeszéltük: Bence beküldi a meghatalmazást, te csak jóváhagyod az ONYA-ban, 4 napon belül.',
      closedAt: ago(20),
      history: [tortenet(30, null, 'callback.created', 'Visszahívást kért az appban („Megcsináljuk helyetted”)'), tortenet(21, ANNA, 'callback.claimed', 'Anna magára vette'), tortenet(20, ANNA, 'callback.attempt', 'Hívás: beszéltünk – összefoglaló elküldve')],
    }),
    cb({
      id: 'cb-ilona',
      clientId: 'c-ilona',
      topic: 'vallalkozas_bejelentes_helyettem',
      source: 'helyettunk_vallalkozas',
      createdAt: ago(20),
      window: 'delelott',
      note: 'Nem értek a számítógéphez, intézzék helyettem.',
      history: [tortenet(20, null, 'callback.created', 'Visszahívást kért az appban („Intézzétek helyettem”)')],
    }),
    cb({
      id: 'cb-kata',
      clientId: 'c-kata',
      topic: 'szamlak_iratok',
      source: 'uzenetek',
      status: 'teljesitve',
      createdAt: ago(48),
      note: 'Mikor lesz kész a jövedelemigazolás?',
      assignee: ANNA,
      attempts: [{ id: uid('att'), at: ago(24), by: ANNA, outcome: 'beszeltunk', note: null }],
      summaryForClient: 'megbeszéltük, hogy a jövedelemigazolás jövő héten elkészül.',
      closedAt: ago(24),
      history: [tortenet(48, null, 'callback.created', 'Visszahívást kért az appban'), tortenet(30, ANNA, 'callback.claimed', 'Anna magára vette'), tortenet(24, ANNA, 'callback.attempt', 'Hívás: beszéltünk – összefoglaló elküldve')],
    }),
  ];
  // The two seeded team replies + the call summary in Kata's thread (sender 'csapat').
  const uzenet = (clientId: string, sender: Message['sender'], body: string, at: string, extra: Partial<Message> = {}) => {
    const lista = msgs.get(clientId) ?? [];
    lista.unshift({ id: uid('m'), kind: 'szoveg', body, sender, createdAt: at, attachments: [], ...(sender === 'csapat' ? { senderName: UZENET_CSAPAT } : {}), ...extra });
    lista.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    msgs.set(clientId, lista);
  };
  const csapatOlvasta = new Set<string>();
  uzenet('c-kata', 'csapat', 'A hívásunk összefoglalója: megbeszéltük, hogy a jövedelemigazolás jövő héten elkészül.', ago(24));
  uzenet('c-levente', 'ugyfel', 'Szia! Beküldtem a bejelentést, és feltöltöttem a NAV-os PDF-et. Így jó?', ago(20));
  uzenet('c-mark', 'csapat', 'Szia Márk! Átnéztük a NAV-os igazolásodat. Egy dolgot javítanod kell: az appban leírtuk, mit és hogyan. Ha elakadsz, kérj visszahívást.', ago(26.5));
  uzenet('c-mark', 'ugyfel', 'Köszi, holnap megcsinálom.', ago(25));
  uzenet('c-lili', 'ugyfel', 'Szia! A költséghányadnál elakadtam, melyiket jelöljem? Használt ruhát árulok a webshopomban.', ago(26.2));
  for (const id of ['c-mark']) for (const m of msgs.get(id) ?? []) csapatOlvasta.add(m.id);
  for (const m of msgs.get('c-peter') ?? []) csapatOlvasta.add(m.id);

  const nyitott = (c: MCb) => CALLBACK_OPEN_STATUSES.includes(c.status);
  const hibasDb = (c: MCb) => c.attempts.filter((a) => CALLBACK_FAILED_OUTCOMES.includes(a.outcome)).length;
  const rowOf = (c: MCb): TeamCallbackRow => {
    const k = kliens(c.clientId);
    const utolso = c.attempts[c.attempts.length - 1];
    return {
      id: c.id,
      client: { id: k.id, name: nev(k), lifecycle: k.lifecycle },
      status: c.status,
      topic: c.topic,
      source: c.source,
      window: c.window,
      phoneMasked: c.phone ? maskHuPhone(c.phone) : '—',
      notePreview: c.note ? (c.note.length > 80 ? `${c.note.slice(0, 79)}…` : c.note) : null,
      createdAt: c.createdAt,
      targetAt: c.targetAt,
      dueAt: c.dueAt,
      overdue: nyitott(c) && nowMs() > Date.parse(c.dueAt),
      minutesToDue: Math.round((Date.parse(c.dueAt) - nowMs()) / 60_000),
      attempts: c.attempts.length,
      failedAttempts: hibasDb(c),
      lastAttemptAt: utolso?.at ?? null,
      nextAttemptAfter: c.nextAttemptAfter,
      callingNowUntil: c.callingNowUntil && Date.parse(c.callingNowUntil) > nowMs() ? c.callingNowUntil : null,
      assignee: c.assignee,
    };
  };
  const regOf = (clientId: string) => regs.filter((r) => r.clientId === clientId).sort((a, b) => b.statusSince.localeCompare(a.statusSince))[0];
  const card0 = (k: MockClient): TeamClientCard => {
    const r = regOf(k.id);
    const open = cbs.find((c) => c.clientId === k.id && nyitott(c));
    return {
      id: k.id,
      name: nev(k),
      email: k.email,
      phoneMasked: k.phone ? maskHuPhone(normalizeHuPhone(k.phone) ?? k.phone) : null,
      lifecycle: k.lifecycle,
      businessStatus: k.businessStatus ?? (k.adoszam ? 'van' : null),
      milestone: x.milestone(k),
      accountant: { id: BENCE.id, userId: BENCE_REF.userId, name: BENCE.displayName },
      registration: r ? { id: r.id, status: r.status } : null,
      openCallbackId: open?.id ?? null,
      canMessage: k.lifecycle === 'bekotes_alatt',
    };
  };
  const card = (k: MockClient): TeamClientCard => kieg.kartya(k, card0(k));
  const detailOf = (c: MCb): TeamCallbackDetail => {
    const k = kliens(c.clientId);
    const enyem = c.assignee?.userId === en().userId;
    return {
      ...rowOf(c),
      phone: enyem && nyitott(c) ? c.phone : null,
      note: c.note,
      internalNote: c.internalNote,
      summaryForClient: c.summaryForClient,
      closedReason: c.closedReason,
      closedAt: c.closedAt,
      clientCard: card(k),
      attemptList: c.attempts,
      history: c.history.slice().sort((a, b) => b.at.localeCompare(a.at)),
      assignable: [...team.filter((m) => m.active).map((m) => ({ userId: m.userId, name: m.displayName, firstName: m.firstName, role: 'csapat' as const })), ADMIN_REF, BENCE_REF],
      legacyAppointment: c.legacyAppointment,
    };
  };
  const latja = (c: MCb) => x.role() !== 'accountant' || c.assignee?.userId === BENCE_REF.userId;
  const findCb = (id: string) => {
    const c = cbs.find((k) => k.id === id);
    if (!c || !latja(c)) throw x.hiba(404, 'not_found', 'Nincs ilyen visszahívás, vagy nincs hozzá jogod.');
    return c;
  };
  const gazdaKell = (c: MCb) => {
    if (c.assignee?.userId !== en().userId) throw x.hiba(409, 'conflict', 'Előbb vedd magadra.');
  };
  const naplo = (c: MCb, action: string, text: string) => {
    c.history.push({ at: nowIso(), by: en(), action, text });
    x.logAudit(action, kliens(c.clientId));
  };

  on('GET', '/team/summary', () => {
    const lathato = cbs.filter(latja);
    const regsDb = Object.fromEntries(['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve', 'kesz', 'elallt'].map((s) => [s, regs.filter((r) => r.status === s).length])) as TeamSummary['registrations'];
    const s: TeamSummary = {
      callbacks: {
        open: lathato.filter(nyitott).length,
        overdue: lathato.filter((c) => rowOf(c).overdue).length,
        mine: lathato.filter((c) => nyitott(c) && c.assignee?.userId === en().userId).length,
        unassigned: lathato.filter((c) => nyitott(c) && !c.assignee).length,
      },
      registrations: x.role() === 'accountant' ? (Object.fromEntries(Object.keys(regsDb).map((k) => [k, 0])) as TeamSummary['registrations']) : regsDb,
      unreadThreads: x.role() === 'csapat' ? threads().filter((t) => t.unread > 0).length : 0,
    };
    return kieg.osszeg(s);
  });
  on('GET', '/team/callbacks', ({ q }) => {
    const f = q.get('filter') ?? 'nyitott';
    const topic = q.get('topic');
    const s = (q.get('q') ?? '').toLowerCase();
    const items = cbs
      .filter(latja)
      .filter((c) => {
        const r = rowOf(c);
        if (f === 'nyitott' && !nyitott(c)) return false;
        if (f === 'lejart' && !r.overdue) return false;
        if (f === 'enyem' && !(nyitott(c) && c.assignee?.userId === en().userId)) return false;
        if (f === 'gazdatlan' && !(nyitott(c) && !c.assignee)) return false;
        if (f === 'lezart' && nyitott(c)) return false;
        if (topic && c.topic !== topic) return false;
        const k = kliens(c.clientId);
        return !s || nev(k).toLowerCase().includes(s) || k.email.includes(s);
      })
      .map(rowOf)
      .sort((a, b) => (['lezart', 'mind'].includes(f) ? b.createdAt.localeCompare(a.createdAt) : Number(b.overdue) - Number(a.overdue) || a.dueAt.localeCompare(b.dueAt)));
    return { items, nextCursor: null };
  });
  on('GET', '/team/callbacks/:id', ({ p }) => {
    const c = findCb(p.id!);
    if (c.assignee?.userId === en().userId && nyitott(c)) x.logAudit('callback.phone_viewed', kliens(c.clientId));
    return detailOf(c);
  });
  on('POST', '/team/callbacks/:id/claim', ({ p, body }) => {
    csapatVagyAdmin();
    const c = findCb(p.id!);
    if (!nyitott(c)) throw x.hiba(409, 'conflict', 'Ez a kérés már le van zárva.');
    if (c.assignee && c.assignee.userId !== en().userId && !(body.force && x.role() === 'admin')) throw x.hiba(409, 'conflict', `Már ${c.assignee.firstName} intézi.`);
    c.assignee = en();
    c.status = 'folyamatban';
    naplo(c, 'callback.claimed', `${en().firstName} magára vette`);
    return detailOf(c);
  });
  on('POST', '/team/callbacks/:id/assign', ({ p, body }) => {
    const c = findCb(p.id!);
    const uid2 = (body.userId as string | null) ?? null;
    if (x.role() === 'accountant' && uid2 !== null) throw x.hiba(403, 'forbidden', 'Csak a sorba adhatod vissza.');
    const ki = uid2 ? detailOf(c).assignable.find((a) => a.userId === uid2) : null;
    if (uid2 && !ki) throw x.hiba(400, 'validation_failed', 'Neki nem adhatod át.');
    c.assignee = ki ?? null;
    if (!ki && c.attempts.length === 0) c.status = 'uj';
    if (ki) c.status = 'folyamatban';
    naplo(c, 'callback.assigned', ki ? `${en().firstName} átadta: ${ki.name}` : `${en().firstName} visszaadta a sorba`);
    if (x.role() === 'accountant') return { ok: true, id: c.id };
    return detailOf(c);
  });
  on('POST', '/team/callbacks/:id/calling', ({ p }) => {
    const c = findCb(p.id!);
    gazdaKell(c);
    c.callingNowUntil = new Date(nowMs() + CALLBACK_RULES.callingNowMinutes * 60_000).toISOString();
    naplo(c, 'callback.calling', `${en().firstName} hívja`);
    return detailOf(c);
  });
  on('POST', '/team/callbacks/:id/attempts', ({ p, body }) => {
    const c = findCb(p.id!);
    gazdaKell(c);
    const outcome = body.outcome as CallbackAttemptOutcome;
    c.attempts.push({ id: uid('att'), at: nowIso(), by: en(), outcome, note: (body.note as string) || null });
    c.callingNowUntil = null;
    c.nextAttemptAfter = outcome === 'kesobb_kerte' ? ((body.nextAttemptAfter as string) ?? null) : null;
    let szoveg = `Hívás: ${CALLBACK_ATTEMPT_OUTCOME_LABELS[outcome].toLowerCase()}`;
    if (outcome === 'beszeltunk') {
      c.status = 'teljesitve';
      c.closedAt = nowIso();
      const sum = (body.summaryForClient as string | undefined)?.trim();
      if (sum) {
        c.summaryForClient = sum;
        uzenet(c.clientId, x.role() === 'accountant' ? 'en' : 'csapat', `A hívásunk összefoglalója: ${sum}`, nowIso());
        szoveg += ' – összefoglaló elküldve';
      }
    } else if (CALLBACK_FAILED_OUTCOMES.includes(outcome) && hibasDb(c) >= CALLBACK_RULES.maxFailedAttempts) {
      c.status = 'sikertelen';
      c.closedAt = nowIso();
      szoveg += ' – harmadszor sem értük el';
    }
    naplo(c, 'callback.attempt', szoveg);
    return detailOf(c);
  });
  on('POST', '/team/callbacks/:id/close', ({ p, body }) => {
    const c = findCb(p.id!);
    if (x.role() !== 'admin') gazdaKell(c);
    c.status = 'lezarva';
    c.closedReason = body.reason as CallbackCloseReason;
    c.closedAt = nowIso();
    if (body.note) c.internalNote = [c.internalNote, String(body.note)].filter(Boolean).join('\n');
    naplo(c, 'callback.closed', `Lezárva hívás nélkül: ${CALLBACK_CLOSE_REASON_LABELS[c.closedReason].toLowerCase()}`);
    return detailOf(c);
  });
  on('PATCH', '/team/callbacks/:id', ({ p, body }) => {
    const c = findCb(p.id!);
    if (x.role() !== 'admin') gazdaKell(c);
    if ('internalNote' in body) c.internalNote = (body.internalNote as string | null) ?? null;
    if (body.topic) c.topic = body.topic as CallbackTopic;
    return detailOf(c);
  });
  on('GET', '/team/clients/:clientId', ({ p }) => card(kliens(p.clientId!)));
  on('POST', '/team/clients/:clientId/callbacks', ({ p, body }) => {
    const k = kliens(p.clientId!);
    const open = cbs.find((c) => c.clientId === k.id && nyitott(c));
    if (open) throw x.hiba(409, 'callback_already_open', 'Már van nyitott visszahívási kérése.', { callback: rowOf(open) });
    const tel = body.phone ? normalizeHuPhone(String(body.phone)) : k.phone ? normalizeHuPhone(k.phone) : null;
    if (body.phone && !tel) throw x.hiba(400, 'validation_failed', 'Magyar telefonszámot adj meg, például +36 30 123 4567.');
    const c = cb({ id: uid('cb'), clientId: k.id, topic: body.topic as CallbackTopic, source: 'csapat', createdAt: nowIso(), window: (body.window as CallbackWindow) ?? 'barmikor', note: (body.note as string) || null, phone: tel });
    c.history = [{ at: nowIso(), by: en(), action: 'callback.created', text: `${en().firstName} vette fel` }];
    cbs.push(c);
    x.logAudit('callback.created', k);
    return detailOf(c);
  });

  // ---------- registrations ----------
  const napja = (iso: string) => Math.max(0, Math.floor((nowMs() - Date.parse(iso)) / 86_400_000));
  const regRow = (r: MReg): TeamRegistrationRow => kieg.regSor(r, regRow0(r));
  const regRow0 = (r: MReg): TeamRegistrationRow => {
    const k = kliens(r.clientId);
    const fo = r.answers.activities.find((a) => a.main) ?? r.answers.activities[0];
    return {
      mode: r.mode ?? 'onallo',
      pathChangedAt: r.pathChangedAt ?? null,
      id: r.id,
      client: { id: k.id, name: nev(k), email: k.email },
      status: r.status,
      statusSince: r.statusSince,
      daysInStatus: napja(r.statusSince),
      mainActivity: fo?.label ?? null,
      startPlan: r.answers.startPlan,
      startDate: r.answers.startDate,
      guideOpenedAt: r.guideOpenedAt,
      guideProgress: { done: r.guideDone, total: 14 },
      filedOn: r.filed?.filedOn ?? null,
      assignee: r.assignee,
      openCallbackId: cbs.find((c) => c.clientId === k.id && nyitott(c))?.id ?? null,
    };
  };
  const regDetail = (r: MReg): TeamRegistrationDetail => ({
    ...regRow(r),
    answers: r.answers,
    hints: hintsOf(r.answers),
    clientCard: card(kliens(r.clientId)),
    filed: r.filed,
    checkItems: r.checkItems,
    checkedBy: r.checkedBy,
    checkedAt: r.checkedAt,
    fixNote: r.fixNote,
    adoszam: r.adoszam,
    evNyilvantartasiSzam: r.ev,
    registeredOn: r.registeredOn,
    staffNote: r.staffNote,
    history: r.history.slice().sort((a, b) => b.at.localeCompare(a.at)),
  });
  const findReg = (id: string) => {
    csapatVagyAdmin();
    const r = regs.find((k) => k.id === id);
    if (!r) throw x.hiba(404, 'not_found', 'Nincs ilyen vállalkozás-indítás.');
    return r;
  };
  const allapot = (r: MReg, s: RegistrationStatus) => {
    r.status = s;
    r.statusSince = nowIso();
    const k = kliens(r.clientId);
    const step = k.steps.find((t) => t.step === 'vallalkozas_inditas');
    if (step) {
      step.status = REGISTRATION_STEP_STATUS[s];
      step.note = s === 'javitas' ? (r.fixNote ?? undefined) : undefined;
      if (s === 'kesz') step.completedAt = nowIso();
    }
    if (s === 'kesz') {
      // SPEC §26.1.8: what 'kesz' fills in (mock: the visible profile fields) + locked steps open.
      const fo = r.answers.activities.find((a) => a.main) ?? r.answers.activities[0];
      k.adoszam = r.adoszam;
      k.evNyilvantartasiSzam = r.ev;
      k.evSince = r.registeredOn ?? r.filed?.filedOn ?? null;
      k.activityText = fo?.label ?? r.answers.activityFreeText;
      k.hqMunicipality = r.answers.seat?.address?.city ?? k.address?.city ?? null;
      r.doneAt = nowIso();
      for (const t of k.steps) if ((t.step === 'meghatalmazas' || t.step === 'azonositas') && t.status === 'nincs_kezdve') t.status = 'ugyfelre_var';
    }
  };
  const regNaplo = (r: MReg, action: string, text: string) => {
    r.history.push({ at: nowIso(), by: en(), action, text });
    x.logAudit(action, kliens(r.clientId));
  };
  on('GET', '/team/registrations', ({ q }) => {
    csapatVagyAdmin();
    const st = q.get('status') ?? 'nyitott';
    const s = (q.get('q') ?? '').toLowerCase();
    const items = regs
      .filter((r) => st === 'mind' || (st === 'nyitott' ? REGISTRATION_OPEN_STATUSES.includes(r.status) : r.status === st))
      .filter((r) => {
        const k = kliens(r.clientId);
        return !s || nev(k).toLowerCase().includes(s) || k.email.includes(s);
      })
      .map(regRow);
    return { items, nextCursor: null };
  });
  on('GET', '/team/registrations/:id', ({ p }) => regDetail(findReg(p.id!)));
  on('PATCH', '/team/registrations/:id', ({ p, body }) => {
    const r = findReg(p.id!);
    if (!REGISTRATION_OPEN_STATUSES.includes(r.status) && body.answers) throw x.hiba(409, 'conflict', 'Lezárt bejelentés adatait már nem lehet javítani.');
    const a = body.answers as Record<string, unknown> | undefined;
    if (a) {
      const acts = a.activities as { key: string | null; label: string; main: boolean }[] | undefined;
      if (acts)
        r.answers.activities = acts.map((v, i) => {
          const b = v.key ? BUSINESS_ACTIVITIES.find((k) => k.key === v.key) : undefined;
          return { key: v.key, label: b?.label ?? v.label, main: v.main, ovtjKod: r.answers.activities[i]?.ovtjKod ?? b?.ovtjKod ?? null, navKereso: b?.navKereso ?? null };
        });
      for (const k of ['revenueBand', 'activityFreeText', 'workKind', 'euPartner', 'startPlan', 'startDate', 'hasSeparateBusinessAccount'] as const)
        if (k in a) (r.answers as unknown as Record<string, unknown>)[k] = a[k] ?? null;
      if (a.seat) {
        const sAns = a.seat as { kind: 'lakcim' | 'mas_cim' | 'szekhelyszolgaltato'; address?: { zip: string; city: string; line: string } | null; right?: never; provider?: { name: string; adoszam: string } | null };
        r.answers.seat = { kind: sAns.kind, address: sAns.address ?? null, right: sAns.right ?? null, provider: sAns.provider ?? null };
      }
      if (a.otherSites) {
        const varos = r.answers.seat?.address?.city ?? kliens(r.clientId).address?.city;
        r.answers.otherSites = (a.otherSites as { address: { zip: string; city: string; line: string } }[]).map((o) => ({ address: o.address, kind: o.address.city === varos ? 'telephely' : 'fioktelep' }));
      }
    }
    for (const o of (body.ovtjKodok as { index: number; ovtjKod: string | null }[] | undefined) ?? []) {
      if (o.ovtjKod && !isValidOvtjKod(o.ovtjKod)) throw x.hiba(400, 'validation_failed', 'Az ÖVTJ-kód 6 számjegy.');
      const v = r.answers.activities[o.index];
      if (v) v.ovtjKod = o.ovtjKod;
    }
    if ('staffNote' in body) r.staffNote = (body.staffNote as string | null) ?? null;
    if (a || body.ovtjKodok) regNaplo(r, 'registration.edited_by_staff', `${en().firstName} javította az adatokat`);
    return regDetail(r);
  });
  on('POST', '/team/registrations/:id/assign', ({ p, body }) => {
    const r = findReg(p.id!);
    r.assignee = body.userId ? en() : null;
    regNaplo(r, 'registration.assigned', body.userId ? `${en().firstName} magára vette` : `${en().firstName} leadta`);
    return regDetail(r);
  });
  on('POST', '/team/registrations/:id/check', ({ p, body }) => {
    const r = findReg(p.id!);
    if (r.status !== 'beadva') throw x.hiba(409, 'conflict', 'Csak a beküldött, ellenőrzésre váró bejelentést lehet jóváhagyni.');
    kieg.ellenorzes(r);
    const items = (body.items as RegistrationCheckItem[]) ?? [];
    if (REGISTRATION_CHECK_ITEMS.some((k) => !items.includes(k))) throw x.hiba(400, 'validation_failed', 'Minden pontot pipálj ki, mielőtt jóváhagyod.');
    r.checkItems = [...items];
    r.checkedBy = en();
    r.checkedAt = nowIso();
    r.fixNote = null;
    allapot(r, r.adoszam ? 'kesz' : 'ellenorizve');
    regNaplo(r, 'registration.checked', (r.status as RegistrationStatus) === 'kesz' ? 'Ellenőrizte a NAV-os igazolást – kész' : 'Ellenőrizte a NAV-os igazolást, minden rendben');
    return regDetail(r);
  });
  on('POST', '/team/registrations/:id/request-fix', ({ p, body }) => {
    const r = findReg(p.id!);
    const note = String(body.note ?? '').trim();
    if (!note || note.length > 1000) throw x.hiba(400, 'validation_failed', 'Írd le röviden, mit javítson (legfeljebb 1000 karakter).');
    if (r.status !== 'beadva' && r.status !== 'ellenorizve') throw x.hiba(409, 'conflict', 'Most nem lehet javítást kérni.');
    r.fixNote = note;
    allapot(r, 'javitas');
    regNaplo(r, 'registration.fix_requested', `${en().firstName} javítást kért`);
    return regDetail(r);
  });
  on('POST', '/team/registrations/:id/adoszam', ({ p, body }) => {
    const r = findReg(p.id!);
    if (!['beadva', 'javitas', 'ellenorizve'].includes(r.status)) throw x.hiba(409, 'conflict', 'Adószámot csak a beküldött bejelentéshez lehet rögzíteni.');
    const ell = adoszamEllenor(String(body.adoszam ?? ''));
    if (!ell.ertek) throw x.hiba(400, 'validation_failed', ell.hiba ?? 'Hibás adószám.', { fields: { adoszam: ell.hiba ?? 'Hibás adószám.' } });
    if (!body.registeredOn) throw x.hiba(400, 'validation_failed', 'Add meg a nyilvántartásba vétel napját.');
    r.adoszam = ell.ertek;
    r.ev = (body.evNyilvantartasiSzam as string) || null;
    r.registeredOn = String(body.registeredOn);
    regNaplo(r, 'registration.adoszam_set', `${en().firstName} rögzítette az adószámot`);
    if (r.status === 'ellenorizve') allapot(r, 'kesz');
    return regDetail(r);
  });

  // ---------- team threads (csapat only; clients in onboarding) ----------
  const threads = (): TeamThreadRow[] =>
    clients
      .filter((k) => k.lifecycle === 'bekotes_alatt')
      .map((k) => {
        const lista = msgs.get(k.id) ?? [];
        const utolso = lista[0];
        const r = regOf(k.id);
        return {
          client: { id: k.id, name: nev(k) },
          lastMessageAt: utolso?.createdAt ?? null,
          lastMessagePreview: utolso ? (utolso.body.length > 80 ? `${utolso.body.slice(0, 79)}…` : utolso.body) : null,
          unread: lista.filter((m) => m.sender === 'ugyfel' && !csapatOlvasta.has(m.id)).length,
          milestone: x.milestone(k),
          registrationStatus: r && r.status !== 'elallt' ? r.status : null,
        };
      })
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '') || a.client.name.localeCompare(b.client.name, 'hu'));
  const csapatSzemmel = (m: Message): Message =>
    m.sender === 'csapat' ? { ...m, sender: 'en', senderName: undefined } : m.sender === 'en' ? { ...m, sender: 'konyvelo', senderName: BENCE.displayName } : m;
  const szalKliens = (id: string) => {
    csakCsapat();
    const k = kliens(id);
    if (k.lifecycle !== 'bekotes_alatt') throw x.hiba(404, 'not_found', 'Ennek az ügyfélnek a könyvelője válaszol.');
    return k;
  };
  on('GET', '/team/threads', () => {
    csakCsapat();
    return { items: threads(), nextCursor: null };
  });
  on('GET', '/team/clients/:clientId/messages', ({ p }) => {
    const k = szalKliens(p.clientId!);
    return { items: (msgs.get(k.id) ?? []).map(csapatSzemmel), nextCursor: null };
  });
  on('POST', '/team/clients/:clientId/messages', ({ p, body }) => {
    const k = szalKliens(p.clientId!);
    uzenet(k.id, 'csapat', String(body.body), nowIso(), { attachments: ((body.fileIds as string[]) ?? []).map((id) => ({ fileId: id, displayName: 'melléklet.pdf', mime: 'application/pdf' })) });
    x.logAudit('message.sent', k);
    return csapatSzemmel(msgs.get(k.id)![0]!);
  });
  on('POST', '/team/clients/:clientId/messages/read', ({ p }) => {
    const k = szalKliens(p.clientId!);
    for (const m of msgs.get(k.id) ?? []) csapatOlvasta.add(m.id);
    return undefined;
  });
  on('POST', '/team/attachments', () => {
    csakCsapat();
    return { fileId: uid('f') };
  });

  // ---------- accountant: read-only views of his clients ----------
  on('GET', '/acc/clients/:id/callbacks', ({ p }) => {
    const k = kliens(p.id!);
    return { items: cbs.filter((c) => c.clientId === k.id).map(rowOf).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });
  on('GET', '/acc/clients/:id/business-registration', ({ p }) => {
    const k = kliens(p.id!);
    const r = regOf(k.id);
    return { registration: r ? regDetail(r) : null };
  });

  // ---------- admin: team members ----------
  const tagSor = (m: TeamMemberRow): TeamMemberRow => ({
    ...m,
    openCallbacks: cbs.filter((c) => nyitott(c) && c.assignee?.userId === m.userId).length,
    callbacksDone30d: cbs.filter((c) => c.attempts.some((a) => a.outcome === 'beszeltunk' && a.by.userId === m.userId)).length,
    registrationsChecked30d: regs.filter((r) => r.checkedBy?.userId === m.userId).length,
  });
  const adminKell = () => {
    if (x.role() !== 'admin') throw x.hiba(404, 'not_found', 'Nincs ilyen oldal.');
  };
  on('GET', '/admin/team', () => {
    adminKell();
    return { items: team.map(tagSor) };
  });
  on('POST', '/admin/team', ({ body }) => {
    adminKell();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (team.some((m) => m.email === email)) throw x.hiba(409, 'conflict', 'Ezzel az e-mail-címmel már van munkatárs.');
    const m: TeamMemberRow = { userId: uid('u'), email, displayName: String(body.displayName), firstName: String(body.firstName), active: true, totpEnabled: false, openCallbacks: 0, callbacksDone30d: 0, registrationsChecked30d: 0, lastLoginAt: null, createdAt: nowIso() };
    team.push(m);
    x.logAudit('team.member_invited', null);
    return tagSor(m);
  });
  on('PATCH', '/admin/team/:userId', ({ p, body }) => {
    adminKell();
    const m = team.find((t) => t.userId === p.userId);
    if (!m) throw x.hiba(404, 'not_found', 'Nincs ilyen munkatárs.');
    if (typeof body.active === 'boolean') {
      m.active = body.active;
      if (!m.active) for (const c of cbs) if (nyitott(c) && c.assignee?.userId === m.userId) c.assignee = null;
      x.logAudit(m.active ? 'team.member_enabled' : 'team.member_disabled', null);
    }
    if (body.displayName) m.displayName = String(body.displayName);
    if (body.firstName) m.firstName = String(body.firstName);
    return tagSor(m);
  });

  return {
    kieg,
    belso: { regs, cbs, card, kliens, nev, en, regDetail, rowOf, findReg, allapot, regNaplo, uzenet, cb, ago, tortenet, BENCE_REF, ADMIN_REF, nyitottCb: nyitott },
    service: (): AdminServiceStats => kieg.szolg(service0()),
  };
  function service0(): AdminServiceStats {
    {
      const honap = nowIso().slice(0, 7);
      const elsoHivas = cbs
        .filter((c) => c.attempts.length && nowMs() - Date.parse(c.createdAt) <= 30 * 86_400_000)
        .map((c) => (Date.parse(c.attempts[0]!.at) - Date.parse(c.createdAt)) / ORA)
        .sort((a, b) => a - b);
      const median = elsoHivas.length ? elsoHivas[Math.floor((elsoHivas.length - 1) / 2)]! : null;
      return {
        callbacks: {
          open: cbs.filter(nyitott).length,
          overdue: cbs.filter((c) => rowOf(c).overdue).length,
          doneThisMonth: cbs.filter((c) => c.status === 'teljesitve' && (c.closedAt ?? '').startsWith(honap)).length,
          medianFirstAttemptHours30d: median === null ? null : Math.round(median * 10) / 10,
        },
        registrations: {
          inPipeline: regs.filter((r) => REGISTRATION_OPEN_STATUSES.includes(r.status)).length,
          doneThisMonth: regs.filter((r) => r.status === 'kesz' && (r.doneAt ?? '').startsWith(honap)).length,
          withdrawnThisMonth: regs.filter((r) => r.status === 'elallt' && r.statusSince.startsWith(honap)).length,
        },
      };
    }
  }
}
