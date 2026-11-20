// SPEC §29.10 G – guided first run ("bevezető"). The steps come from the ONE journey (buildJourney via journeyOf):
// states, locks, waits and routes are the journey's; this file only reorders them by GUIDED_ORDER[variant], adds the
// pseudo-step 'adoszam' on the 'van' path and keeps the small per-client state in clients.guided (jsonb).
// clients.guided and clients.terminated are read through to_jsonb(row) so this code also runs before migration 0018.
import { and, eq, sql } from 'drizzle-orm';
import type { JourneyStepView, JourneyView } from '../_shared/api.js';
import { JOURNEY_STEP_TEXTS } from '../_shared/bekotes.js';
import { GUIDED_ORDER, GUIDED_OWN_ROUTES, GUIDED_STEP_ROUTES, GUIDED_TEXTS, type GuidedAction, type GuidedState, type GuidedStepKey, type GuidedStepView, type GuidedView } from '../_shared/k29g.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, allowanceAnswers, clients, clientTaxProfiles } from '../db/schema.js';
import { todayBudapest } from '../lib/dates.js';
import { ApiError } from '../lib/errors.js';
import { accountantPublic, type ClientRow } from './people.js';
import { journeyOf } from './onboarding.js';

const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (p[k] === undefined ? m : String(p[k])));

/** clients.guided + clients.terminated without depending on the columns being in schema.ts yet. */
export async function guidedStateOf(db: DbOrTx, clientId: string): Promise<{ guided: GuidedState | null; terminated: boolean }> {
  const res = await db.execute(sql`select to_jsonb(c) -> 'guided' as guided, to_jsonb(c) -> 'terminated' as terminated from clients c where c.id = ${clientId}`);
  const row = (res as unknown as { rows: { guided: GuidedState | null; terminated: unknown }[] }).rows[0];
  const t = row?.terminated;
  return { guided: row?.guided && typeof row.guided === 'object' ? row.guided : null, terminated: Boolean(t && t !== 'null') };
}

async function writeGuided(db: DbOrTx, clientId: string, g: GuidedState): Promise<void> {
  try {
    await db.execute(sql`update clients set guided = ${JSON.stringify(g)}::jsonb, updated_at = now() where id = ${clientId}`);
  } catch {
    // migration 0018 (B1) adds clients.guided; without it the guided run still works, it just does not remember.
    throw new ApiError(503, 'guided_not_ready', 'Most nem tudjuk elmenteni, hol tartasz. Próbáld újra később.');
  }
}

/** Is the client on KATA (the allowance step is átalány only)? */
async function isKata(db: DbOrTx, cl: ClientRow, now: Date): Promise<boolean> {
  if (cl.taxRegimeAnswer === 'kata') return true;
  const year = Number(todayBudapest(now).slice(0, 4));
  const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
  return tp?.regime === 'kata';
}

/**
 * k7c: the allowance gate answered "Később" (and nothing sent yet). The journey keeps the optional row 'nyitva' (the
 * checklist and the Főoldal hint offer it again); the guided run must move on, so there it is 'kesobb' – decided for now.
 */
async function allowanceLater(db: DbOrTx, clientId: string, now: Date): Promise<boolean> {
  const year = Number(todayBudapest(now).slice(0, 4));
  const [a] = await db.select({ gate: allowanceAnswers.gate, submittedAt: allowanceAnswers.submittedAt }).from(allowanceAnswers).where(and(eq(allowanceAnswers.clientId, clientId), eq(allowanceAnswers.year, year))).limit(1);
  return a?.gate === 'kesobb' && !a.submittedAt;
}

function routeOf(key: GuidedStepKey, js: JourneyStepView | undefined): string | null {
  if (GUIDED_OWN_ROUTES[key]) return GUIDED_OWN_ROUTES[key]!;
  if (key === 'adatok') return '/bekotes/adatok';
  const fromJourney = js?.action?.route ?? null;
  // the journey sends the row's own action (e.g. the approval guide while the ONYA approval is due); else the step screen
  return fromJourney ?? GUIDED_STEP_ROUTES[key] ?? (key in JOURNEY_STEP_TEXTS ? (JOURNEY_STEP_TEXTS as Record<string, { route?: string }>)[key]?.route ?? null : null);
}

export async function buildGuided(deps: Deps, db: DbOrTx, cl: ClientRow, j?: JourneyView): Promise<GuidedView> {
  const journey = j ?? (await journeyOf(deps, db, cl));
  const { guided, terminated } = await guidedStateOf(db, cl.id);
  const [acc] = cl.accountantId ? await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const ap = acc ? accountantPublic(acc) : null;
  const fn = ap?.firstName ?? 'A könyvelőd';
  const kata = await isKata(db, cl, deps.now());
  const byKey = new Map(journey.steps.map((s) => [s.key, s]));

  const order = GUIDED_ORDER[journey.variant].filter((k) => !(k === 'kedvezmenyek' && kata));
  const kedvLater = !kata && order.includes('kedvezmenyek') && (await allowanceLater(db, cl.id, deps.now()));
  const steps: GuidedStepView[] = [];
  for (const key of order) {
    if (key === 'adoszam') {
      const done = Boolean(cl.adoszam) || cl.adoszamPending;
      steps.push({ key, title: GUIDED_TEXTS.adoszamStep, state: done ? 'kesz' : 'nyitva', route: GUIDED_STEP_ROUTES.adoszam!, timeText: done ? null : GUIDED_TEXTS.adoszamTime, actorLabel: 'Te', doneForClient: done });
      continue;
    }
    const js = byKey.get(key);
    if (!js) continue; // a row that is not on this path any more (e.g. 'alkalmazottak' with no employees)
    // the guided run treats the optional allowance row as a real step (the gate question); the gate's "Később" answers
    // it for now (k7c: before, the run reopened the same gate – the link looked dead)
    const later = key === 'kedvezmenyek' && kedvLater && js.state !== 'kesz';
    const state = later ? 'kesobb' : js.state;
    const doneForClient = later || state === 'kesz' || (state === 'var' && !js.clientPart);
    steps.push({
      key,
      title: js.title,
      state,
      route: state === 'kihagyva' ? null : routeOf(key, js),
      timeText: js.timeText,
      ...(state === 'var' ? { waitText: js.statusText } : {}),
      ...(state === 'kesobb' && js.lockedReason ? { lockedReason: js.lockedReason } : {}),
      actorLabel: js.actorLabel,
      doneForClient,
    });
  }
  const counted = steps.filter((s) => s.state !== 'kihagyva');
  const actionable = (s: GuidedStepView) => s.state === 'most' || s.state === 'nyitva';
  const current = steps.find(actionable) ?? null;
  const finished = !current;
  // what others do now and what comes later: every journey row that is not done and not the client's to do now
  const guidedKeys = new Set(steps.filter(actionable).map((s) => s.key));
  const pending = journey.steps
    .filter((s) => s.state !== 'kesz' && s.state !== 'kihagyva' && !guidedKeys.has(s.key) && !(s.optional && s.key === 'kedvezmenyek'))
    .map((s) => ({ key: s.key, title: s.title, actorLabel: s.actorLabel, timeText: s.state === 'var' ? s.timeText : null, later: s.state !== 'var' }));
  // the first row ('ut') is answered on the start page; the bar counts it like the checklist does
  const done = counted.filter((s) => s.doneForClient).length;

  const onboarding = cl.lifecycle === 'bekotes_alatt';
  const show = onboarding && !terminated && !guided?.pausedAt && !guided?.doneSeenAt;
  return {
    show,
    paused: Boolean(guided?.pausedAt),
    inOnboarding: onboarding && !terminated,
    firstName: cl.firstName,
    variant: journey.variant,
    welcome: {
      seen: Boolean(guided?.welcomeSeenAt),
      accountant: ap,
      priceHuf: deps.cfg.planPriceHuf,
      rows: GUIDED_TEXTS.w3Rows.map((r) => ({ title: fill(r.title, { firstName: fn }), time: r.time })),
    },
    steps,
    currentKey: current?.key ?? null,
    progress: { done, total: counted.length },
    finished,
    pending,
    waiting: journey.waiting,
    lastKey: guided?.lastKey ?? null,
    doneSeen: Boolean(guided?.doneSeenAt),
  };
}

/** POST /client/guided – welcome_seen | later | resume | step_seen | done_seen. Idempotent. */
export async function guidedAction(deps: Deps, db: DbOrTx, cl: ClientRow, action: GuidedAction, key?: GuidedStepKey): Promise<GuidedView> {
  const { guided } = await guidedStateOf(db, cl.id);
  const g: GuidedState = { ...(guided ?? {}) };
  const now = deps.now().toISOString();
  switch (action) {
    case 'welcome_seen':
      g.welcomeSeenAt ??= now;
      break;
    case 'later':
      g.pausedAt = now;
      if (key) g.lastKey = key;
      break;
    case 'resume':
      g.pausedAt = null;
      g.welcomeSeenAt ??= now;
      break;
    case 'step_seen':
      if (key) g.lastKey = key;
      break;
    case 'done_seen':
      g.doneSeenAt ??= now;
      g.finishedAt ??= now;
      g.pausedAt = null;
      break;
  }
  await writeGuided(db, cl.id, g);
  const [fresh] = await db.select().from(clients).where(eq(clients.id, cl.id)).limit(1);
  return buildGuided(deps, db, fresh ?? cl);
}
