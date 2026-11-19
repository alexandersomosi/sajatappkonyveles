// SPEC §27.4.2 – "Így halad a bekötésed": the ONE progress list of the app, built here and nowhere else. Every number
// the client sees comes from it: the band ("Még {n} dolog kell tőled"), the Főoldal tab badge, OnboardingState.todoCount,
// ClientAccess.activationHint and the locked sheet ("Még {remaining} lépés … Ebből {n} a tiéd"). One row per thing, in
// JOURNEY_ORDER[variant]; each row says who acts (Te / {firstName} / Csapatunk / NAV), its state and how long it takes;
// exactly one client row is 'most' (or none while others work – then `waiting` is the big card).
import type { CallbackView, JourneyStepView, JourneyView, WaitingCardView } from '../_shared/api.js';
import { activityPending, JOURNEY_STEP_TEXTS, WAITING_TEXTS } from '../_shared/bekotes.js';
import { JOURNEY_ORDER, JOURNEY_PREVIEW, type JourneyActor, type JourneyRowState, type JourneyStepKey, type JourneyVariant, type OnboardingStep } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { budapestParts, daysBetween, huDayMonth, huDayMonthIg, todayBudapest } from '../lib/dates.js';
import { addWorkingDays } from '../lib/munkanap.js';
import type { AccountantPublic } from '../_shared/api.js';
import { snake } from '../content/tulaj1119.js';
import { answersOf, FILED_OR_LATER, missingFields, type RegRow } from './registration.js';
import type { ClientRow } from './people.js';
import type { StepRow } from './onboarding.js';
import type { AssistRow } from './assist.js';

type WaitKey = keyof typeof WAITING_TEXTS;

interface RawRow {
  key: JourneyStepKey;
  /** Content key of a row title that replaces `bekotes.ut.lepes.<key>.cim` (e.g. while waiting for the adószám). */
  titleKey?: string;
  actor: JourneyActor;
  state: JourneyRowState;
  clientPart: boolean;
  optional?: boolean;
  statusText?: string;
  timeSegitett?: boolean;
  dueOn?: string | null;
  dueText?: string | null;
  lockedReason?: string | null;
  action?: { label: string; route: string } | null;
  completedAt?: Date | null;
  wait?: { key: WaitKey; from: Date | null; addWd: number; actor: JourneyActor };
}

export interface JourneyInput {
  cl: ClientRow;
  st: Map<OnboardingStep, StepRow>;
  /** The current registration (never 'elallt'). */
  reg: RegRow | null;
  /** Open assists of the client. */
  ev: AssistRow | null;
  /** The client's finished EV request (status 'kesz'), when there is no open one. */
  evDone?: AssistRow | null;
  mh: AssistRow | null;
  ap: AccountantPublic;
  openRequests: number;
  callback: CallbackView | null;
  /** step → filled lock text (stepLockKeys rendered). */
  lockText: Map<OnboardingStep, string>;
}

export function journeyVariant(cl: Pick<ClientRow, 'businessStatus'>, reg: RegRow | null): JourneyVariant {
  if (!cl.businessStatus) return 'nincs';
  if (cl.businessStatus === 'van') return 'van';
  return reg?.mode === 'segitett' ? 'inditas_segitett' : 'inditas_onallo';
}

const CONSENT_READY: string[] = ['visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el'];

export async function buildJourney(deps: Deps, _db: DbOrTx, i: JourneyInput): Promise<JourneyView> {
  const { cl, st, reg, ev, ap } = i;
  const fn = ap.firstName;
  const t = (k: string, p: Record<string, string | number> = {}) => deps.content.render(k, { firstName: fn, ...p });
  const today = todayBudapest(deps.now());
  const variant = journeyVariant(cl, reg);
  const order = JOURNEY_ORDER[variant];
  const s = (k: OnboardingStep) => st.get(k)?.status ?? 'nincs_kezdve';
  const regStatus = reg?.status ?? null;
  const filed = regStatus ? FILED_OR_LATER.includes(regStatus) : false;
  const a = reg ? answersOf(reg) : null;
  const pending = Boolean(a && activityPending(a) && regStatus === 'utmutato');
  const segitett = variant === 'inditas_segitett';
  const assist = segitett ? ev : i.mh;
  const label = async (key: JourneyStepKey, seg = false) => {
    const base = `bekotes.ut.lepes.${key}`;
    if (seg && (await deps.content.exists(`${base}.gomb_segitett`))) return t(`${base}.gomb_segitett`);
    return (await deps.content.exists(`${base}.gomb`)) ? t(`${base}.gomb`) : '';
  };
  const route = (key: JourneyStepKey) => (key === 'adatok' && variant !== 'van' ? '/bekotes/adatok?utana=vallalkozas' : JOURNEY_STEP_TEXTS[key].route);
  const act = async (key: JourneyStepKey, seg = false) => {
    const l = await label(key, seg);
    return l && route(key) ? { label: l, route: route(key) } : null;
  };
  const due = (dueOn: string) => {
    const left = daysBetween(today, dueOn);
    return left <= 0 ? null : left;
  };
  const dueLine = async (dueOn: string) => {
    // 11-19 javítás: the day after the shown due day (NAV's own 4 × 24 h still running) – no past "…-ig" date.
    if (daysBetween(today, dueOn) < 0) return t('helyettunk.approve_after_due');
    const left = due(dueOn);
    return left === null ? t('helyettunk.approve_last_day') : `${huDayMonthIg(dueOn)} (még ${left} nap)`;
  };

  const rows: RawRow[] = [];
  for (const key of order) {
    let r: RawRow;
    switch (key) {
      case 'ut':
        r = variant === 'nincs' ? { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act('ut') } : { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: cl.businessStatusChangedAt ?? null };
        break;
      case 'visszahivas':
        // 11-19 javító kör 2: once the EV request is finished ('kesz') the call is long done – never "Később" again.
        if (!ev && i.evDone) r = { key, actor: 'csapat', state: 'kesz', clientPart: false, completedAt: i.evDone.agreedAt ?? i.evDone.statusChangedAt };
        else if (!ev && segitett && (filed || regStatus === 'kesz')) r = { key, actor: 'csapat', state: 'kesz', clientPart: false, completedAt: null };
        else if (!ev) r = { key, actor: 'csapat', state: 'kesobb', clientPart: false, lockedReason: await t('bekotes.ut.zarolt_visszahivas') };
        else if (ev.status === 'visszahivas_kerve') r = { key, actor: 'csapat', state: 'var', clientPart: false, wait: { key: 'helyettunk_hivas', from: i.callback ? new Date(i.callback.dueAt) : null, addWd: 0, actor: 'csapat' } };
        else r = { key, actor: 'csapat', state: 'kesz', clientPart: false, completedAt: ev.agreedAt ?? ev.statusChangedAt };
        break;
      case 'adatok':
        r = s('adatok') === 'kesz' ? { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: st.get('adatok')?.completedAt ?? null } : { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act(key) };
        break;
      case 'kerdoiv':
        if (regStatus && regStatus !== 'kitoltes') r = { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: reg?.submittedAt ?? null };
        else if (s('adatok') !== 'kesz') r = { key, actor: 'te', state: 'kesobb', clientPart: true, lockedReason: await t('bekotes.ut.zarolt_kerdoiv') };
        else r = { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act(key) };
        break;
      case 'bejelentes':
        if (segitett) {
          if (filed || (ev && (ev.status === 'bejelentes_bekuldve' || ev.status === 'kesz'))) r = { key, actor: 'konyvelo', state: 'kesz', clientPart: false, completedAt: ev?.evFiledAt ?? reg?.filedAt ?? null };
          else if (ev?.status === 'ugyfel_engedelyezte') r = { key, actor: 'konyvelo', state: 'var', clientPart: false, timeSegitett: true, wait: { key: 'helyettunk_bekuldes', from: ev.consentAt, addWd: 2, actor: 'konyvelo' } };
          else r = { key, actor: 'konyvelo', state: 'kesobb', clientPart: false, timeSegitett: true, lockedReason: await t('bekotes.ut.zarolt_bejelentes_segitett') };
        } else if (filed) r = { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: reg?.filedAt ?? null };
        else if (regStatus !== 'utmutato') r = { key, actor: 'te', state: 'kesobb', clientPart: true, lockedReason: await t('bekotes.ut.zarolt_bejelentes') };
        // 11-19 javító kör 2: the filing stays the client's own job (chip "Te"); the status line names who works now,
        // and the row still opens the guide (he may read it meanwhile).
        else if (pending)
          r = {
            key,
            actor: 'te',
            state: 'var',
            clientPart: true,
            statusText: await t('bekotes.ut.bejelentes_var_status'),
            action: { label: await t('bekotes.ut.bejelentes_var_gomb'), route: JOURNEY_STEP_TEXTS.bejelentes.route },
            wait: { key: 'tevekenyseg_sor', from: reg?.submittedAt ?? null, addWd: 2, actor: 'csapat' },
          };
        else r = { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act(key) };
        break;
      case 'ertesites':
        if (regStatus === 'javitas') r = { key, actor: 'te', state: 'nyitva', clientPart: true, statusText: await t('bekotes.ut.javitas_status'), action: { label: await t('bekotes.ut.javitas_gomb'), route: '/bekotes/vallalkozas' } };
        else if (filed) r = { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: reg?.filedAt ?? null };
        else r = { key, actor: 'te', state: 'kesobb', clientPart: true, lockedReason: await t('bekotes.ut.zarolt_ertesites'), action: await act(key) };
        break;
      case 'atnezes':
        if (regStatus === 'kesz') r = { key, actor: 'csapat', state: 'kesz', clientPart: false, completedAt: reg?.doneAt ?? null };
        else if (regStatus === 'beadva') r = { key, actor: 'csapat', state: 'var', clientPart: false, wait: { key: 'atnezes', from: reg?.filedAt ?? null, addWd: 2, actor: 'csapat' } };
        else if (regStatus === 'ellenorizve')
          r = { key, actor: 'nav', state: 'var', clientPart: false, titleKey: 'bekotes.ut.atnezes_adoszam_cim', statusText: await t('bekotes.ut.atnezes_adoszam_status'), wait: { key: 'adoszam', from: reg?.checkedAt ?? null, addWd: 5, actor: 'nav' } };
        else r = { key, actor: 'csapat', state: 'kesobb', clientPart: false, lockedReason: await t('bekotes.ut.zarolt_atnezes') };
        break;
      case 'vegso_jovahagyas': {
        const consented = Boolean(ev && (ev.consentValid || ev.status === 'bejelentes_bekuldve' || ev.status === 'kesz'));
        const ready = Boolean(reg && reg.status === 'utmutato' && a && missingFields(a, { adatokDone: s('adatok') === 'kesz' }).length === 0 && !activityPending(a));
        if (consented || filed) r = { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: ev?.consentAt ?? null };
        else if (ev && ready && CONSENT_READY.includes(ev.status)) r = { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act(key) };
        else if (pending) {
          const why = await t('bekotes.ut.zarolt_vegso_tevekenyseg');
          r = { key, actor: 'te', state: 'kesobb', clientPart: true, statusText: why, lockedReason: why, wait: { key: 'tevekenyseg_sor', from: reg?.submittedAt ?? null, addWd: 2, actor: 'csapat' } };
        }
        else r = { key, actor: 'te', state: 'kesobb', clientPart: true, lockedReason: await t('bekotes.ut.zarolt_vegso') };
        break;
      }
      case 'kamara':
        if (regStatus !== 'kesz') r = { key, actor: 'te', state: 'kesobb', clientPart: true, optional: true, lockedReason: await t('bekotes.ut.zarolt_kamara') };
        else if (reg?.chamberDoneAt) r = { key, actor: 'te', state: 'kesz', clientPart: false, optional: true, completedAt: reg.chamberDoneAt };
        else {
          const dueOn = reg?.chamberDueOn ?? null;
          r = {
            key,
            actor: 'te',
            state: 'nyitva',
            clientPart: true,
            optional: true,
            dueOn,
            dueText: dueOn ? (today > dueOn ? await t('vallalkozas.kamara.overdue', { date: huDayMonth(dueOn) }) : await dueLine(dueOn)) : null,
            action: await act(key),
          };
        }
        break;
      case 'meghatalmazas':
        r = await mhRow(key);
        break;
      case 'nav_bekotes':
        if (s('nav_bekotes') === 'kesz' || s('nav_bekotes') === 'kihagyva') r = { key, actor: 'konyvelo', state: s('nav_bekotes') === 'kihagyva' ? 'kihagyva' : 'kesz', clientPart: false, completedAt: st.get('nav_bekotes')?.completedAt ?? null };
        else if (s('meghatalmazas') === 'kesz') r = { key, actor: 'konyvelo', state: 'var', clientPart: false, wait: { key: 'nav_bekotes', from: st.get('meghatalmazas')?.completedAt ?? null, addWd: 3, actor: 'konyvelo' } };
        else r = { key, actor: 'konyvelo', state: 'kesobb', clientPart: false, lockedReason: i.lockText.get('nav_bekotes') ?? (await t('bekotes.ut.zarolt_nav_bekotes')) };
        break;
      default:
        r = await stepRow(key as 'szerzodes' | 'azonositas' | 'elofizetes');
    }
    rows.push(r);
  }

  async function stepRow(key: 'szerzodes' | 'azonositas' | 'elofizetes'): Promise<RawRow> {
    const status = s(key);
    if (status === 'kesz') return { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: st.get(key)?.completedAt ?? null };
    if (status === 'kihagyva') return { key, actor: 'te', state: 'kihagyva', clientPart: false };
    if (status === 'konyvelore_var' && key === 'azonositas')
      return { key, actor: 'konyvelo', state: 'var', clientPart: false, wait: { key: 'azonositas_ellenorzes', from: st.get(key)?.updatedAt ?? null, addWd: 2, actor: 'konyvelo' } };
    if (i.lockText.has(key)) return { key, actor: 'te', state: 'kesobb', clientPart: true, lockedReason: i.lockText.get(key)! };
    return { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act(key) };
  }

  async function mhRow(key: 'meghatalmazas'): Promise<RawRow> {
    const status = s('meghatalmazas');
    if (status === 'kesz') return { key, actor: 'te', state: 'kesz', clientPart: false, completedAt: st.get('meghatalmazas')?.completedAt ?? null };
    if (assist && assist.status !== 'kesz') {
      const contractLock = s('szerzodes') !== 'kesz' ? (i.lockText.get('meghatalmazas') ?? (await t('bekotes.zarolt.szerzodes_utan'))) : null;
      switch (assist.status) {
        case 'visszahivas_kerve':
          if (assist.kind === 'meghatalmazas')
            return { key, actor: 'csapat', state: 'var', clientPart: true, timeSegitett: true, wait: { key: 'helyettunk_hivas', from: i.callback ? new Date(i.callback.dueAt) : null, addWd: 0, actor: 'csapat' } };
          return { key, actor: 'konyvelo', state: 'kesobb', clientPart: true, timeSegitett: true, lockedReason: contractLock ?? (await t('helyettunk.allapot.visszahivas_kerve')) };
        case 'egyeztetve':
        case 'meghatalmazas_lejart':
          if (contractLock) return { key, actor: 'konyvelo', state: 'kesobb', clientPart: true, timeSegitett: true, lockedReason: contractLock };
          return {
            key,
            actor: 'konyvelo',
            state: 'var',
            clientPart: true,
            timeSegitett: true,
            wait: { key: 'helyettunk_ujegyke', from: assist.status === 'egyeztetve' ? (assist.agreedAt ?? assist.statusChangedAt) : (assist.approvalExpiresAt ?? assist.statusChangedAt), addWd: 2, actor: 'konyvelo' },
          };
        case 'meghatalmazas_bekuldve':
          return {
            key,
            actor: 'te',
            state: 'nyitva',
            clientPart: true,
            timeSegitett: true,
            dueOn: assist.approvalDueOn,
            dueText: assist.approvalDueOn ? await dueLine(assist.approvalDueOn) : null,
            action: { label: await label(key, true), route: '/bekotes/meghatalmazas/jovahagyas' },
          };
        case 'meghatalmazas_jovahagyva':
          return { key, actor: 'konyvelo', state: 'var', clientPart: false, timeSegitett: true, wait: { key: 'helyettunk_ellenorzes', from: assist.clientApprovedAt, addWd: 1, actor: 'konyvelo' } };
        default:
          return { key, actor: 'konyvelo', state: 'kesz', clientPart: false, completedAt: assist.mhLiveAt };
      }
    }
    if (status === 'kihagyva') return { key, actor: 'te', state: 'kihagyva', clientPart: false };
    if (status === 'konyvelore_var') {
      const sub = (st.get('meghatalmazas')?.data as { submittedAt?: string } | null)?.submittedAt;
      return { key, actor: 'konyvelo', state: 'var', clientPart: false, wait: { key: 'meghatalmazas_ellenorzes', from: sub ? new Date(sub) : (st.get('meghatalmazas')?.updatedAt ?? null), addWd: 3, actor: 'konyvelo' } };
    }
    if (i.lockText.has('meghatalmazas')) return { key, actor: 'te', state: 'kesobb', clientPart: true, lockedReason: i.lockText.get('meghatalmazas')! };
    return { key, actor: 'te', state: 'nyitva', clientPart: true, action: await act(key) };
  }

  // ---------- the one 'most' row: the first client row with a deadline, else the first open client row ----------
  const open = rows.filter((r) => r.state === 'nyitva');
  const most = open.find((r) => r.dueOn) ?? open[0] ?? null;
  if (most) most.state = 'most';
  const mostIdx = most ? rows.indexOf(most) : -1;

  // ---------- the waiting card ----------
  // A 'kesobb' client row may carry the wait that blocks it (vegso_jovahagyas while the team writes the ÖVTJ line).
  const waits = (r: RawRow) => (r.state === 'var' || r.state === 'kesobb') && Boolean(r.wait);
  let w = rows.find((r, idx) => waits(r) && (mostIdx < 0 || idx < mostIdx))?.wait ?? null;
  if (!w && !most) w = rows.find((r) => waits(r))?.wait ?? null;
  if (!w && !most && ev?.status === 'bejelentes_bekuldve') w = { key: 'helyettunk_adoszam', from: ev.evFiledAt, addWd: 2, actor: 'csapat' };
  const actorLabel = (x: JourneyActor) => (x === 'te' ? 'Te' : x === 'konyvelo' ? fn : x === 'csapat' ? 'Csapatunk' : 'NAV');
  let waiting: WaitingCardView | null = null;
  if (w) {
    const base = `bekotes.varakozas.${w.key}`;
    const p = { phoneMasked: i.callback?.phoneMasked || 'megadott' };
    const escDay = w.from ? addWorkingDays(todayBudapest(w.from), w.addWd) : null;
    const meanwhileRow = rows.find((r) => r.state === 'nyitva' || r.state === 'most');
    const cbOpen = Boolean(i.callback && (i.callback.status === 'uj' || i.callback.status === 'folyamatban'));
    waiting = {
      key: w.key,
      actor: w.actor,
      kicker: await t(`${base}.felso`, p),
      title: await t(`${base}.cim`, p),
      body: await t(`${base}.szoveg`, p),
      // while a callback is open: no second callback – "írj nekünk"; "sem hívtunk" only on the call's own waiting card
      // 11-19 javító kör 2: after the escalation day no past "…-ig" date – a no-date "we are late" line instead.
      escalateText: !escDay
        ? null
        : today > escDay
          ? await t(
              w.actor === 'nav'
                ? cbOpen
                  ? 'bekotes.varakozas.kesunk_nav_uzenet'
                  : 'bekotes.varakozas.kesunk_nav'
                : w.key === 'helyettunk_hivas'
                  ? 'bekotes.varakozas.kesunk_hivas'
                  : cbOpen
                    ? 'bekotes.varakozas.kesunk_uzenet'
                    : 'bekotes.varakozas.kesunk',
              { ki: w.actor === 'konyvelo' ? fn : 'A kollégáink' },
            )
          : await t(cbOpen ? (w.key === 'helyettunk_hivas' ? 'bekotes.varakozas.eszkalacio_hivas' : 'bekotes.varakozas.eszkalacio_uzenet') : 'bekotes.varakozas.eszkalacio', { hatarido: huDayMonthIg(escDay) }),
      escalateKind: cbOpen ? 'uzenet' : 'visszahivas',
      timeText: (await deps.content.exists(`${base}.ido`)) ? await t(`${base}.ido`, p) : null,
      meanwhile: meanwhileRow?.action ? { title: await t(`bekotes.ut.lepes.${meanwhileRow.key}.cim`), label: meanwhileRow.action.label, route: meanwhileRow.action.route } : null,
    };
  }

  // ---------- texts ----------
  const steps: JourneyStepView[] = [];
  let n = 0;
  for (const r of rows) {
    n++;
    const base = `bekotes.ut.lepes.${r.key}`;
    const timeKey = r.timeSegitett && (await deps.content.exists(`${base}.ido_segitett`)) ? `${base}.ido_segitett` : `${base}.ido`;
    let statusText = r.statusText ?? '';
    if (!statusText) {
      if (r.key === 'ut') statusText = variant === 'nincs' ? await t('bekotes.ut.ut_status_nincs') : await t(`bekotes.ut.${snake(variant === 'van' ? 'pathVan' : segitett ? 'pathInditasSegitett' : 'pathInditas')}`);
      else if (r.state === 'kesz') statusText = r.completedAt ? await t('bekotes.ut.row_kesz_when', { date: huDayMonth(todayBudapest(r.completedAt)) }) : await t('bekotes.ut.row_kesz');
      else if (r.state === 'most') statusText = r.dueText ?? (await t('bekotes.ut.row_most'));
      else if (r.state === 'nyitva') statusText = r.dueText ?? (await t('bekotes.ut.row_nyitva'));
      // 11-19 javító kör 2: a waiting row says WHAT is being done (the waiting card's title), not only "X dolgozik rajta".
      else if (r.state === 'var') statusText = r.wait && (await deps.content.exists(`bekotes.varakozas.${r.wait.key}.cim`)) ? await t(`bekotes.varakozas.${r.wait.key}.cim`) : await t('bekotes.ut.row_var', { actor: actorLabel(r.actor) });
      else if (r.state === 'kesobb') statusText = await t('bekotes.ut.row_kesobb');
      else statusText = await t('bekotes.ut.row_kihagyva');
    }
    steps.push({
      key: r.key,
      n,
      title: r.titleKey && (await deps.content.exists(r.titleKey)) ? await t(r.titleKey) : await t(`${base}.cim`),
      actor: r.actor,
      actorLabel: actorLabel(r.actor),
      state: r.state,
      statusText,
      timeText:
        r.state === 'kesz' || r.state === 'kihagyva'
          ? null
          : r.state === 'var' && r.wait && (await deps.content.exists(`bekotes.varakozas.${r.wait.key}.ido`))
            ? await t(`bekotes.varakozas.${r.wait.key}.ido`)
            : (await deps.content.exists(timeKey))
              ? await t(timeKey)
              : null,
      dueOn: r.dueOn ?? null,
      dueText: r.dueText ?? null,
      lockedReason: r.state === 'kesobb' ? (r.lockedReason ?? null) : null,
      action: r.state === 'most' || r.state === 'nyitva' || (r.state === 'var' && r.actor === 'te') ? (r.action ?? null) : null,
      explainerKey: JOURNEY_STEP_TEXTS[r.key].explainer,
      clientPart: r.clientPart && r.state !== 'kesz' && r.state !== 'kihagyva',
      optional: Boolean(r.optional),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    });
  }
  const preview = variant === 'nincs' ? await Promise.all(JOURNEY_PREVIEW.map((k) => t(`bekotes.ut.lepes.${k}.cim`))) : [];
  const todoCount = steps.filter((x) => x.clientPart).length + i.openRequests;
  const remaining = variant === 'nincs' ? 1 + JOURNEY_PREVIEW.length : steps.filter((x) => x.state !== 'kesz' && x.state !== 'kihagyva').length;
  let bandTitle: string;
  if (variant === 'nincs') bandTitle = await t('bekotes.ut.band_start');
  else if (todoCount === 1) bandTitle = await t('bekotes.ut.band_todo_one');
  else if (todoCount >= 2) bandTitle = await t('bekotes.ut.band_todo', { n: todoCount });
  else bandTitle = await t('bekotes.ut.band_none', { actor: waiting ? (waiting.actor === 'konyvelo' ? fn : waiting.actor === 'nav' ? 'A NAV' : waiting.actor === 'csapat' ? 'Csapatunk' : fn) : fn });
  return {
    variant,
    path: cl.businessStatus ?? null,
    mode: cl.businessStatus === 'inditas' ? (reg?.mode ?? 'onallo') : null,
    steps,
    currentKey: most?.key ?? null,
    waiting,
    todoCount,
    remaining,
    bandTitle,
    lockedSheetText: await t('bekotes.ut.locked_sheet', { remaining: Math.max(remaining, todoCount), n: todoCount }),
    preview,
  };
}

/** Budapest hour (the worker's quiet-hour rules use the same clock). */
export function budapestHour(d: Date): number {
  return budapestParts(d).hour;
}
