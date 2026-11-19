// Onboarding state machine, milestones and lifecycle (SPEC §6.1, §6.7, §26.1.6).
// Two paths (clients.business_status): 'van' = existing business (unchanged flow), 'inditas' = new business, where
// the step 'vallalkozas_inditas' (derived from the registration) comes 3rd and some steps are locked until the
// client filed his EV bejelentés / got the adószám. null = the branch question is still open (the 'van' rules apply).
// The legacy step 'idopont' is never listed, counted or required (SPEC §26.2.9).
import { and, eq } from 'drizzle-orm';
import type { OnboardingState } from '../_shared/api.js';
import {
  LOCK_ELOFIZETES_SZERZODES_UTAN,
  MILESTONE_LABELS,
  MILESTONE_ORDER,
  ONBOARDING_REQUIRED_STEPS,
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_ORDER_SEGITETT,
  REGISTRATION_STATUS_LABELS,
  type MeghatalmazasMethod,
  type Milestone,
  type OnboardingPath,
  type OnboardingStep,
  type RegistrationStatus,
  type StepStatus,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients, onboardingSteps } from '../db/schema.js';
import { huDayMonthAn, todayBudapest, WEEKDAYS_ON_HU, weekdayOf } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { audit } from '../audit.js';
import { accountantPublic, type ClientRow } from './people.js';
import { openRequestsFromAccountant } from './requests.js';
import { computeFlags } from './flags.js';
import { currentRegistrationOf, FILED_OR_LATER, type RegRow } from './registration.js';
import { callbackView, openCallbackOf } from './callbacks.js';
import { ONYA_UGYKOROK, ugykorok } from './guides.js';
import { buildJourney } from './journey.js';
import { assistsOfClient, assistView, isOpenAssist } from './assist.js';
import { pathChangeInfo } from './pathchange.js';
import type { JourneyView } from '../_shared/api.js';

export { ONYA_UGYKOROK };
export type StepRow = typeof onboardingSteps.$inferSelect;

export async function steps(db: DbOrTx, clientId: string): Promise<Map<OnboardingStep, StepRow>> {
  const rows = await db.select().from(onboardingSteps).where(eq(onboardingSteps.clientId, clientId));
  return new Map(rows.map((r) => [r.step, r]));
}

export async function setStep(
  deps: Deps,
  db: DbOrTx,
  clientId: string,
  step: OnboardingStep,
  status: StepStatus,
  o: { note?: string | null; data?: Record<string, unknown> | null; by?: string | null } = {},
): Promise<void> {
  const now = deps.now();
  const patch: Partial<StepRow> = { status, updatedAt: now };
  if (o.note !== undefined) patch.note = o.note;
  if (o.data !== undefined) patch.data = o.data;
  if (status === 'kesz') patch.completedAt = now;
  if (o.by) patch.reviewedBy = o.by;
  await db
    .insert(onboardingSteps)
    .values({ clientId, step, status, note: o.note ?? null, data: o.data ?? null, completedAt: status === 'kesz' ? now : null })
    .onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: patch });
}

/** Opens the client-actionable steps after the questionnaire (they can be done in any order; locks are computed on read). */
export async function afterProfileSubmitted(deps: Deps, db: DbOrTx, clientId: string): Promise<void> {
  const st = await steps(db, clientId);
  const open = async (s: OnboardingStep, to: StepStatus = 'ugyfelre_var') => {
    const cur = st.get(s)?.status;
    if (!cur || cur === 'nincs_kezdve') await setStep(deps, db, clientId, s, to);
  };
  await open('szerzodes');
  await open('elofizetes');
  await open('meghatalmazas');
  await open('azonositas');
}

export function pathOf(cl: Pick<ClientRow, 'businessStatus'> | null | undefined): OnboardingPath | null {
  return cl?.businessStatus ?? null;
}

export function requiredSteps(path: OnboardingPath | null): readonly OnboardingStep[] {
  return ONBOARDING_REQUIRED_STEPS[path ?? 'van'];
}

/** Every required step of the path is 'kesz' or 'kihagyva' (a missing 'vallalkozas_inditas' row never blocks 'van'). */
export function allDone(st: Map<OnboardingStep, StepRow>, path: OnboardingPath | null = null): boolean {
  return requiredSteps(path).every((k) => {
    const s = st.get(k)?.status;
    return s === 'kesz' || s === 'kihagyva';
  });
}

/** Steps still open on the path (client and accountant side), for "Még {n} lépés". */
export function remainingSteps(st: Map<OnboardingStep, StepRow>, path: OnboardingPath | null): number {
  return requiredSteps(path).filter((k) => {
    const s = st.get(k)?.status;
    return s !== 'kesz' && s !== 'kihagyva';
  }).length;
}

/**
 * SPEC §26.1.6 locks on the new-business path. Returns step → content key of the reason. A step that is already done
 * is never shown locked.
 */
export function stepLockKeys(deps: Deps, path: OnboardingPath | null, reg: (Pick<RegRow, 'status'> & Partial<Pick<RegRow, 'mode'>>) | null, st: Map<OnboardingStep, StepRow>): Map<OnboardingStep, string> {
  const out = new Map<OnboardingStep, string>();
  const done = (s: OnboardingStep) => st.get(s)?.status === 'kesz';
  // SPEC §27.4.2 (round-2 walkthrough problem 17): the card comes after the contract, on both paths.
  if (!done('szerzodes') && !done('elofizetes')) out.set('elofizetes', LOCK_ELOFIZETES_SZERZODES_UTAN);
  // The meghatalmazás names the accountant with his adóazonosító jel: it opens only after the megbízási szerződés
  // (round 1, 2026-11-19). A meghatalmazás that is already submitted (konyvelore_var) or done is never shown locked.
  const mh = st.get('meghatalmazas')?.status ?? 'nincs_kezdve';
  if (!done('szerzodes') && (mh === 'nincs_kezdve' || mh === 'ugyfelre_var' || mh === 'hianyos')) out.set('meghatalmazas', 'bekotes.zarolt.szerzodes_utan');
  if (path === null) {
    // The branch question ("Van már egyéni vállalkozásod?") is still open: nobody pays before answering it – a
    // new business pays only once the adószám exists (SPEC §26.1.7), and we do not know yet which path this is.
    if (!done('elofizetes')) out.set('elofizetes', 'bekotes.zarolt.elagazas');
    return out;
  }
  const contractFirst = out.has('elofizetes');
  if (path !== 'inditas') return out;
  const status: RegistrationStatus | null = reg?.status ?? null;
  const filed = status ? FILED_OR_LATER.includes(status) : false;
  if (!filed) {
    // "Intézzük helyetted" (SPEC §27.3): our accountant files the meghatalmazás BEFORE the bejelentés.
    if (!done('meghatalmazas') && reg?.mode !== 'segitett') out.set('meghatalmazas', 'bekotes.zarolt.bejelentes_utan');
    if (!done('azonositas')) out.set('azonositas', 'bekotes.zarolt.bejelentes_utan');
  }
  if (deps.cfg.newBusinessChargePolicy === 'adoszam_utan' && status !== 'kesz' && !done('elofizetes') && !contractFirst) out.set('elofizetes', 'bekotes.zarolt.elofizetes_adoszam_utan');
  if (status !== 'kesz' && !done('nav_bekotes')) out.set('nav_bekotes', 'bekotes.zarolt.nav_bekotes');
  return out;
}

/** 409 step_locked when the client tries a step that is not open yet on his path (also while the branch question is open). */
export async function assertStepOpen(deps: Deps, db: DbOrTx, cl: ClientRow, step: OnboardingStep): Promise<void> {
  // Locks order the onboarding; an active client (card change, a later re-identification) is never step-locked.
  if (cl.lifecycle !== 'bekotes_alatt') return;
  const path = pathOf(cl);
  const reg = path === 'inditas' ? await currentRegistrationOf(db, cl.id) : null;
  const key = stepLockKeys(deps, path, reg && reg.status !== 'elallt' ? reg : null, await steps(db, cl.id)).get(step);
  if (key) throw E.stepLocked(await deps.content.render(key, {}));
}

function milestoneDone(st: Map<OnboardingStep, StepRow>, m: Milestone, path: OnboardingPath | null, reg: RegRow | null): boolean {
  const s = (k: OnboardingStep) => st.get(k)?.status;
  switch (m) {
    case 'vallalkozas_elinditva':
      return reg?.status === 'kesz';
    case 'alairva':
      return s('szerzodes') === 'kesz' && (s('meghatalmazas') === 'konyvelore_var' || s('meghatalmazas') === 'kesz');
    case 'azonositva':
      return s('azonositas') === 'kesz';
    case 'nav_bejelentve':
      return s('meghatalmazas') === 'kesz';
    case 'szamlak_bekotve':
      return s('nav_bekotes') === 'kesz';
    case 'kesz':
      return allDone(st, path);
  }
}

/** "szerdán, november 18-án" */
function whenText(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const day = todayBudapest(d);
  return `${WEEKDAYS_ON_HU[weekdayOf(day)]}, ${huDayMonthAn(day)}`;
}

export type Perspective = 'client' | 'accountant';

/** "szerda, nov. 18." – short form for the panel. */
function shortWhen(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const day = todayBudapest(d);
  const wd = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'][weekdayOf(day)];
  const months = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
  return `${wd}, ${months[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}.`;
}

function methodOf(st: Map<OnboardingStep, StepRow>): MeghatalmazasMethod | undefined {
  const m = (st.get('meghatalmazas')?.data as { method?: string } | null)?.method;
  return m === 'onya_ugyfel' || m === 'onya_konyvelo' || m === 'alairt_pdf' ? m : undefined;
}

type MilestoneText = { label: string; sub?: string };

/**
 * Client perspective (design 02_bekotes): full sentences – done: what you did + when; current: what happens
 * now and how long it usually takes; later steps: what will happen.
 */
function clientMilestoneText(st: Map<OnboardingStep, StepRow>, key: Milestone, done: boolean, current: boolean, ap: ReturnType<typeof accountantPublic>, reg: RegRow | null): MilestoneText {
  const fn = ap.firstName;
  const status = st.get('azonositas')?.status ?? 'nincs_kezdve';
  switch (key) {
    case 'vallalkozas_elinditva': {
      if (done) return { label: 'Elindult a vállalkozásod', sub: whenText(reg?.doneAt) };
      if (!current) return { label: 'Vállalkozás elindítva' };
      switch (reg?.status) {
        case 'utmutato':
          return { label: 'Bejelentés a NAV-nál', sub: 'Ha beküldted, feltöltöd a NAV-os értesítést, és átnézzük.' };
        case 'beadva':
          return { label: 'Átnézzük a bejelentésedet', sub: 'Általában 1 munkanap. Szólunk, ha minden rendben.' };
        case 'javitas':
          return { label: 'Javítsd a bejelentésedet', sub: 'Megírtuk, mit és hogyan.' };
        case 'ellenorizve':
          return { label: 'Várjuk az adószámodat', sub: 'Ha megjött, írd be te is.' };
        default:
          return { label: 'Kérdőív a vállalkozásodról', sub: 'Utána elkészül a személyre szabott útmutatód.' };
      }
    }
    case 'alairva': {
      const method = methodOf(st);
      const when = whenText(st.get('meghatalmazas')?.updatedAt);
      if (done) {
        if (method === 'alairt_pdf') return { label: 'Feltöltötted az aláírt meghatalmazást', sub: when };
        if (method === 'onya_konyvelo') return { label: `Kérted, hogy ${fn} adja be a meghatalmazást`, sub: when ? `${when}. Az ONYA-ban hagyd jóvá, amikor szól.` : undefined };
        return { label: 'Beadtad a meghatalmazást', sub: when ? `${when}, az ONYA-ban` : 'az ONYA-ban' };
      }
      if (current) return { label: 'Add meg a meghatalmazást', sub: `Ezzel lesz ${fn} a könyvelőd a NAV-nál. Pár perc az ONYA-ban.` };
      return { label: 'Meghatalmazás', sub: `Ezzel lesz ${fn} a könyvelőd a NAV-nál.` };
    }
    case 'azonositva': {
      if (done) {
        const when = whenText(st.get('azonositas')?.completedAt);
        return { label: 'Elküldted az igazolványaidat', sub: when ? `${fn} rendben találta, ${when}.` : `${fn} rendben találta.` };
      }
      if (status === 'konyvelore_var') return { label: `${fn} átnézi az igazolványaidat`, sub: 'Általában 1 munkanap. Titkosítva tároljuk, csak ő látja.' };
      if (status === 'hianyos') return { label: 'Pótold az igazolványaidat', sub: `${fn} megírta, mit kér még.` };
      return { label: 'Küldd el az igazolványaidat', sub: current ? 'Fotó a személyidről és a lakcímkártyád címoldaláról, pár perc.' : 'Fotó a személyidről és a lakcímkártyád címoldaláról.' };
    }
    case 'nav_bejelentve': {
      // Round-2 owner finding 8: method-aware – a meghatalmazás the client gave himself is CHECKED by the accountant.
      if (done) return { label: `${fn} a NAV-nál a könyvelőd`, sub: whenText(st.get('meghatalmazas')?.completedAt) };
      const own = methodOf(st) !== 'onya_konyvelo' && methodOf(st) !== 'alairt_pdf';
      const label = own ? `${fn} ellenőrzi a meghatalmazásodat a NAV-nál` : `${fn} beküldi a meghatalmazást, te jóváhagyod`;
      if (current) return { label, sub: own ? 'Általában 1 munkanap.' : 'Utána 4 napod van jóváhagyni az ONYA-ban.' };
      return { label };
    }
    case 'szamlak_bekotve':
      if (done) return { label: 'Kiállított számlák bekötve', sub: 'A kiállított számláid maguktól megjelennek itt – nem kell feltöltened őket.' };
      return { label: 'Kiállított számlák bekötése', sub: 'Utána a kiállított számláid maguktól megjelennek itt.' };
    case 'kesz':
      if (done) return { label: `Kész: ${fn} viszi a könyvelésed` };
      return { label: `${fn} átveszi a könyvelésed`, sub: 'Utána csak a bizonylataidat kell feltöltened.' };
  }
}

/** Panel: the terse milestone labels, with sub-texts that belong to their own step. */
function accountantMilestoneText(st: Map<OnboardingStep, StepRow>, key: Milestone, done: boolean, current: boolean, clientFirst: string, reg: RegRow | null): MilestoneText {
  const label = MILESTONE_LABELS[key];
  const zarojel = (d: Date | null | undefined) => (shortWhen(d) ? ` (${shortWhen(d)})` : '');
  if (key === 'vallalkozas_elinditva') {
    if (done) return { label, sub: `Adószám rögzítve${zarojel(reg?.doneAt)}` };
    return reg ? { label, sub: REGISTRATION_STATUS_LABELS[reg.status] } : { label };
  }
  if (key === 'alairva' && done) {
    const method = methodOf(st);
    const w = zarojel(st.get('meghatalmazas')?.updatedAt);
    if (method === 'alairt_pdf') return { label, sub: `${clientFirst} feltöltötte az aláírt meghatalmazást${w}` };
    if (method === 'onya_konyvelo') return { label, sub: `Az ONYA-ban te adod be, ${clientFirst} kérte${w}` };
    return { label, sub: `${clientFirst} beküldte a meghatalmazást az ONYA-ban${w}` };
  }
  if (key === 'azonositva' && done) return { label, sub: `Ellenőrizted${zarojel(st.get('azonositas')?.completedAt)}` };
  if (key === 'azonositva' && current && st.get('azonositas')?.status === 'konyvelore_var') return { label, sub: 'Beküldte, nézd át az okmányokat' };
  if (key === 'nav_bejelentve' && current)
    return { label, sub: methodOf(st) === 'onya_konyvelo' ? 'Intézzük helyette: UJEGYKE meghatalmazottként, utána ő jóváhagyja' : 'Ellenőrizd a NAV-nál, hogy a meghatalmazás él' };
  if (key === 'nav_bejelentve' && done) return { label, sub: shortWhen(st.get('meghatalmazas')?.completedAt) };
  if (key === 'szamlak_bekotve' && done) return { label, sub: 'A kiállított számláit naponta letöltjük a NAV Online Számlából' };
  return { label };
}

const CLIENT_SIDE_STEPS: OnboardingStep[] = ['fiok', 'adatok', 'vallalkozas_inditas', 'szerzodes', 'elofizetes', 'meghatalmazas', 'azonositas'];

/** Open client-side steps that are not locked (= the band's "Még N dolog kell tőled", without the branch question). */
function openClientSteps(order: readonly OnboardingStep[], st: Map<OnboardingStep, StepRow>, locks: Map<OnboardingStep, string>): number {
  return order.filter((k) => {
    // A step that only waits for the client's OWN earlier step (the meghatalmazás after the contract) is still his
    // to do: it stays in "Még N dolog kell tőled", so the number goes down by one when he accepts the contract.
    if (!CLIENT_SIDE_STEPS.includes(k) || (locks.has(k) && locks.get(k) !== 'bekotes.zarolt.szerzodes_utan')) return false;
    const s = st.get(k)?.status ?? 'nincs_kezdve';
    return s === 'ugyfelre_var' || s === 'hianyos' || s === 'nincs_kezdve';
  }).length;
}

/**
 * What the client himself still has to do = journey.todoCount (SPEC §27.4.2: ONE number for the band, the tab badge,
 * the locked sheet and ClientAccess.activationHint).
 */
export async function clientTodoCount(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<number> {
  return (await journeyOf(deps, db, cl)).todoCount;
}

/** SPEC §27.4.2: the journey of a client (all inputs loaded here). */
export async function journeyOf(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<JourneyView> {
  const st = await steps(db, cl.id);
  const path = pathOf(cl);
  const regAny = path === 'inditas' ? await currentRegistrationOf(db, cl.id) : null;
  const reg = regAny && regAny.status !== 'elallt' ? regAny : null;
  const [acc] = cl.accountantId ? await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const ap = accountantPublic(acc ?? null);
  const locks = stepLockKeys(deps, path, reg, st);
  const lockText = new Map<OnboardingStep, string>();
  for (const [k, key] of locks) lockText.set(k, await deps.content.render(key, { firstName: ap.firstName }));
  const all = await assistsOfClient(db, cl.id);
  const open = all.filter((x) => isOpenAssist(x.status));
  const cb = await openCallbackOf(db, cl.id);
  return buildJourney(deps, db, {
    cl,
    st,
    reg,
    ev: open.find((x) => x.kind === 'vallalkozas_bejelentes') ?? null,
    // 11-19 javító kör 2: a finished EV request ('kesz') keeps its "Visszahívás" row done (not "Később").
    evDone: all.find((x) => x.kind === 'vallalkozas_bejelentes' && x.status === 'kesz') ?? null,
    mh: open.find((x) => x.kind === 'meghatalmazas') ?? null,
    ap,
    openRequests: (await openRequestsFromAccountant(db, cl.id)).length,
    callback: cb ? await callbackView(deps, db, cb) : null,
    lockText,
  });
}

export async function onboardingState(deps: Deps, db: DbOrTx, clientId: string, perspective: Perspective = 'client'): Promise<OnboardingState> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const [acc] = cl?.accountantId ? await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const st = await steps(db, clientId);
  const path = pathOf(cl);
  const regAny = path === 'inditas' ? await currentRegistrationOf(db, clientId) : null;
  const reg = regAny && regAny.status !== 'elallt' ? regAny : null;
  const ap = accountantPublic(acc ?? null);
  let currentSet = false;
  const milestones = MILESTONE_ORDER[path ?? 'van'].map((key) => {
    const done = milestoneDone(st, key, path, reg);
    const current = !done && !currentSet;
    if (current) currentSet = true;
    const t = perspective === 'accountant' ? accountantMilestoneText(st, key, done, current, cl?.firstName ?? 'Az ügyfél', reg) : clientMilestoneText(st, key, done, current, ap, reg);
    return { key, label: t.label, done, current, ...(t.sub ? { sub: t.sub.replace(/, $/, '') } : {}) };
  });
  const order = path === 'inditas' && reg?.mode === 'segitett' ? ONBOARDING_STEP_ORDER_SEGITETT : ONBOARDING_STEP_ORDER[path ?? 'van'];
  const locks = stepLockKeys(deps, path, reg, st);
  const lockText = new Map<string, string>();
  for (const [k, key] of locks) lockText.set(k, await deps.content.render(key, { firstName: ap.firstName }));
  void openClientSteps;
  const journey = cl ? await journeyOf(deps, db, cl) : null;
  const todo = journey?.todoCount ?? 0;
  const assistRows = cl ? await assistsOfClient(db, clientId) : [];
  const methods: OnboardingState['meghatalmazasMethods'] = ['onya_ugyfel', 'onya_konyvelo'];
  if (cl?.alairtPdfAllowed) methods.push('alairt_pdf');
  const open = cl ? await openCallbackOf(db, clientId) : null;
  return {
    steps: order.map((k) => {
      const r = st.get(k);
      // Only the chosen meghatalmazás method leaves the server (never file ids or other step data):
      // the app needs it to show "Hagyd jóvá az ONYA-ban" after the accountant filed UJEGYKE (SPEC §10.2).
      const method = k === 'meghatalmazas' ? methodOf(st) : undefined;
      const status: StepStatus = r?.status ?? (k === 'vallalkozas_inditas' && reg ? 'ugyfelre_var' : 'nincs_kezdve');
      const view: OnboardingState['steps'][number] = {
        step: k,
        status,
        ...(r?.note && (r.status === 'hianyos' || r.status === 'ugyfelre_var') ? { note: r.note } : {}),
        ...(r?.completedAt ? { completedAt: r.completedAt.toISOString() } : {}),
        ...(method ? { data: { method } } : {}),
        ...(lockText.has(k) ? { locked: true, lockedReason: lockText.get(k)! } : {}),
      };
      return view;
    }),
    milestones,
    todoCount: todo,
    accountant: ap,
    path,
    registration: reg ? { id: reg.id, status: reg.status, statusText: await registrationStatusText(deps, db, reg, ap.firstName) } : null,
    callback: open ? await callbackView(deps, db, open) : null,
    appointmentsEnabled: false,
    meghatalmazasMethods: methods,
    ...(methodOf(st) ? { meghatalmazasMethod: methodOf(st) } : {}),
    ...(perspective === 'client' ? { onyaGuide: await onyaGuide(deps, db, clientId, acc ?? null) } : {}),
    // SPEC §27: the one journey, the branch-change info, the assisted requests and the registration mode.
    ...(journey ? { journey } : {}),
    ...(cl ? { pathChange: await pathChangeInfo(deps, db, cl) } : {}),
    assists: await Promise.all(assistRows.map((x) => assistView(deps, db, x, { accFirstName: ap.firstName }))),
    registrationMode: path === 'inditas' ? (reg?.mode ?? 'onallo') : null,
  } as OnboardingState;
}

/** Mode 'segitett' speaks with the assist's status line (ASSIST_STATUS_CLIENT_TEXT) instead of the self-service one. */
export async function registrationStatusText(deps: Deps, db: DbOrTx, reg: RegRow, firstName: string): Promise<string> {
  if (reg.mode === 'segitett' && reg.status !== 'kesz') {
    const a = (await assistsOfClient(db, reg.clientId)).find((x) => x.kind === 'vallalkozas_bejelentes' && isOpenAssist(x.status));
    if (a) return (await assistView(deps, db, a, { accFirstName: firstName })).statusText;
  }
  return deps.content.render(`vallalkozas.allapot.${reg.status}`, { firstName });
}

/** One audit row per client per day (per process) for showing the accountant's tax id – not one per page load. */
const taxIdAudited = new Map<string, string>();

/**
 * May this client see his accountant's adóazonosító jel? Only when he really needs it for the ONYA meghatalmazás:
 * e-mail confirmed AND megbízási szerződés accepted (on the new-business path the meghatalmazás step must be open
 * too), or when he already submitted the meghatalmazás (he has seen it then). Round 1 (2026-11-19): before this
 * every freshly registered, unverified account got a real person's tax id.
 */
export async function mayShowAccountantTaxId(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<boolean> {
  const st = await steps(db, cl.id);
  const mh = st.get('meghatalmazas')?.status ?? 'nincs_kezdve';
  if (mh === 'konyvelore_var' || mh === 'kesz') return true;
  if (st.get('fiok')?.status !== 'kesz' || st.get('szerzodes')?.status !== 'kesz') return false;
  const path = pathOf(cl);
  const reg = path === 'inditas' ? await currentRegistrationOf(db, cl.id) : null;
  return !stepLockKeys(deps, path, reg && reg.status !== 'elallt' ? reg : null, st).has('meghatalmazas');
}

/** The accountant's adóazonosító jel for the client's own ONYA filing (decrypted for the client's own accountant only, audited). */
export async function accountantTaxIdForClient(deps: Deps, db: DbOrTx, clientId: string, acc: typeof accountants.$inferSelect | null): Promise<string | null> {
  if (!acc?.adoazonositoJelEnc) return null;
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl || !(await mayShowAccountantTaxId(deps, db, cl))) return null;
  let taxId: string | null = null;
  try {
    taxId = deps.data.dec(acc.adoazonositoJelEnc, 'accountants.adoazonosito_jel');
  } catch {
    taxId = null;
  }
  if (taxId) {
    const day = todayBudapest(deps.now());
    if (taxIdAudited.get(clientId) !== day) {
      if (taxIdAudited.size > 50_000) taxIdAudited.clear();
      taxIdAudited.set(clientId, day);
      await audit(db, { action: 'accountant.taxid_shown_to_client', actorRole: 'system', targetType: 'accountant', targetId: acc.id, clientId });
    }
  }
  return taxId;
}

/**
 * What the client needs to file UJEGYKE on their own: the assigned accountant's adóazonosító jel (only once the
 * client may see it, see mayShowAccountantTaxId; audited once a day) and the ügykörök.
 */
async function onyaGuide(deps: Deps, db: DbOrTx, clientId: string, acc: typeof accountants.$inferSelect | null): Promise<OnboardingState['onyaGuide']> {
  if (!acc) return { accountantTaxId: null, accountantName: null, ugykorok: ugykorok(deps) };
  return { accountantTaxId: await accountantTaxIdForClient(deps, db, clientId, acc), accountantName: acc.displayName, ugykorok: ugykorok(deps) };
}

/** Called after any step change: when every step of the path is done the client becomes active (once). */
export async function checkCompletion(deps: Deps, db: DbOrTx, clientId: string): Promise<boolean> {
  const st = await steps(db, clientId);
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return false;
  if (allDone(st, pathOf(cl)) && cl.lifecycle === 'bekotes_alatt') {
    await db.update(clients).set({ lifecycle: 'aktiv', updatedAt: deps.now() }).where(eq(clients.id, clientId));
    await audit(db, { action: 'client.activated', actorRole: 'system', targetType: 'client', targetId: clientId, clientId });
    const ap = await accountantParams(db, cl.accountantId);
    await notify(deps, db, { userId: cl.userId, kind: 'onboarding_done', params: ap, link: '/' });
    // The panel list filters and header read next_flags: recompute right away (no "Bekötés alatt" left behind).
    await computeFlags(deps, db, clientId);
    return true;
  }
  return false;
}

/** Notify the assigned accountant that something waits for review. */
export async function notifyAccountantReview(deps: Deps, db: DbOrTx, clientId: string, stepText: string, variant?: string): Promise<void> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl?.accountantId) return;
  const [acc] = await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1);
  if (!acc) return;
  await notify(deps, db, {
    userId: acc.userId,
    kind: 'onboarding_needs_review',
    ...(variant ? { variant } : {}),
    params: { clientName: `${cl.lastName} ${cl.firstName}`, step: stepText },
    link: `/ugyfelek/${clientId}/bekotes`,
    data: { clientId },
  });
}

export async function stepStatus(db: DbOrTx, clientId: string, step: OnboardingStep): Promise<StepStatus> {
  const [r] = await db
    .select({ status: onboardingSteps.status })
    .from(onboardingSteps)
    .where(and(eq(onboardingSteps.clientId, clientId), eq(onboardingSteps.step, step)))
    .limit(1);
  return r?.status ?? 'nincs_kezdve';
}
