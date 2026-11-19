// Restricted mode before activation (SPEC §26.5.2, owner order 4): while a client's lifecycle is 'bekotes_alatt' some
// features are locked IN THE API (403 locked_until_active + feature), not only hidden in the app. One middleware on
// /client/* maps each route to a feature; body-dependent rules (upload only for an open request, request types) are
// checked in their handlers with assertFeature().
import { and, eq, inArray } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { ClientAccess } from '../_shared/api.js';
import { CLIENT_FEATURE_RULES, CLIENT_FEATURES, type ClientFeature, type FeatureState } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients, requests } from '../db/schema.js';
import { auth, type Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import type { ClientRow } from './people.js';

/** Route (relative to /client, method) → feature. Order matters: the first match wins. */
const ROUTE_FEATURES: [RegExp, ClientFeature | 'nyitott'][] = [
  [/^\/(onboarding|profile|kyc|legal-pdf)(\/|$)/, 'bekotes'],
  [/^\/(business-registration|guides)(\/|$)/, 'vallalkozas_inditas'],
  [/^\/(messages|attachments)(\/|$)/, 'uzenetek'],
  [/^\/callbacks(\/|$)/, 'visszahivas'],
  [/^\/assist(\/|$)/, 'helyettunk'], // SPEC §27.3 "Intézzük helyetted" – open before activation
  [/^\/appointments(\/|$)/, 'visszahivas'], // retired: GET read-only, writes answer 410
  [/^\/subscription(\/|$)/, 'elofizetes'],
  [/^\/fee-invoices(\/|$)/, 'dijszamlak'],
  [/^\/(explainers|access)(\/|$)/, 'gyik_jogi'],
  [/^\/requests(\/|$)/, 'keres_valasz'], // POST /requests is checked in the handler (kerdes vs igazolas_keres)
  [/^\/home$/, 'nyitott'], // answers with hero 'bekotes_alatt' and no tax data
  [/^\/tax-periods(\/|$)/, 'fooldal_ado'],
  [/^\/dossiers(\/|$)/, 'dosszie'],
  [/^\/documents(\/|$)/, 'nyitott'], // checked in the handlers (own uploads / request uploads / contracts)
  [/^\/nav-invoices(\/|$)/, 'nav_szamlak'],
  [/^\/revenue(\/|$)/, 'bevetel'],
  [/^\/deadlines(\/|$)/, 'hataridok'],
  // SPEC §28.6.3 / §28.K
  [/^\/reserve(\/|$)/, 'felretesz'],
  [/^\/earnings(\/|$)/, 'kereset'],
  [/^\/allowances(\/|$)/, 'kedvezmenyek'],
  [/^\/change-guides(\/|$)/, 'valtozas'],
  [/^\/checkins(\/|$)/, 'havi_ellenorzes'],
  [/^\/annual(\/|$)/, 'eves_zaras'],
  [/^\/fees(\/|$)/, 'dijak'],
];

export function featureOfRoute(relPath: string): ClientFeature | 'nyitott' | null {
  for (const [re, f] of ROUTE_FEATURES) if (re.test(relPath)) return f;
  return null;
}

export function isRestricted(cl: Pick<ClientRow, 'lifecycle'>): boolean {
  return cl.lifecycle === 'bekotes_alatt';
}

export function featureState(cl: Pick<ClientRow, 'lifecycle'>, f: ClientFeature): FeatureState {
  return isRestricted(cl) ? CLIENT_FEATURE_RULES[f].beforeActivation : 'nyitva';
}

async function accFirstName(db: DbOrTx, cl: Pick<ClientRow, 'accountantId'>): Promise<string> {
  if (!cl.accountantId) return 'A könyvelőd';
  const [a] = await db.select({ firstName: accountants.firstName }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1);
  return a?.firstName ?? 'A könyvelőd';
}

export async function lockReason(deps: Deps, db: DbOrTx, cl: Pick<ClientRow, 'accountantId'>, f: ClientFeature): Promise<string> {
  return deps.content.render(`korlatozott.${f}`, { firstName: await accFirstName(db, cl) });
}

/** Throws 403 locked_until_active when the feature is not usable now (for 'keresre' pass allowedByRequest). */
export async function assertFeature(deps: Deps, db: DbOrTx, cl: ClientRow, f: ClientFeature, o: { allowedByRequest?: boolean } = {}): Promise<void> {
  const st = featureState(cl, f);
  if (st === 'nyitva') return;
  if (st === 'keresre' && o.allowedByRequest) return;
  throw E.locked(f, await lockReason(deps, db, cl, f));
}

/** True when the id is an open request FROM the accountant to this client (upload allowed before activation). */
export async function isOpenAccountantRequest(db: DbOrTx, clientId: string, requestId: string | null | undefined): Promise<boolean> {
  if (!requestId) return false;
  const [r] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.clientId, clientId), eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban'])))
    .limit(1);
  return Boolean(r);
}

/** Documents a client may always open (SPEC §26.5.2): own uploads and the contract-like papers. */
export function documentAlwaysOpen(d: { source: string; category: string }): boolean {
  return d.source === 'ugyfel' || d.category === 'ev_bejelentes' || d.category === 'szerzodes_alairt' || d.category === 'meghatalmazas';
}

/** The middleware on /client/* (after auth). */
export function restrictedMode(deps: Deps): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path.replace(/^.*?\/client(?=\/|$)/, '') || '/';
    const f = featureOfRoute(path);
    if (f && f !== 'nyitott') {
      const [cl] = await deps.db.select().from(clients).where(eq(clients.userId, auth(c).userId)).limit(1);
      if (cl && featureState(cl, f) === 'zarva') throw E.locked(f, await lockReason(deps, deps.db, cl, f));
    }
    await next();
  };
}

/** GET /client/access and Me.access (SPEC §26.5.2). `remaining` = steps still open (from the onboarding state). */
export async function clientAccess(deps: Deps, db: DbOrTx, cl: ClientRow, remaining: number, mine?: number): Promise<ClientAccess> {
  const restricted = isRestricted(cl);
  const first = await accFirstName(db, cl);
  const features = [];
  for (const f of CLIENT_FEATURES) {
    const rule = CLIENT_FEATURE_RULES[f];
    const state: FeatureState = restricted ? rule.beforeActivation : 'nyitva';
    features.push({ feature: f, state, label: rule.label, reason: state === 'nyitva' ? null : await deps.content.render(`korlatozott.${f}`, { firstName: first }) });
  }
  return {
    mode: restricted ? 'korlatozott' : 'teljes',
    features,
    activationHint: restricted ? await activationHint(deps, remaining, mine) : null,
  };
}

/**
 * "Még 4 lépés, és minden megnyílik. Ebből 2 a tiéd, a többi a mi dolgunk." – the total counts our steps too (SPEC
 * §26.5.2), so the client's own share is named, matching the onboarding band's "Még 2 dolog kell tőled".
 */
async function activationHint(deps: Deps, remaining: number, mine: number | undefined): Promise<string> {
  const n = Math.max(1, remaining, mine ?? 0);
  if (mine === undefined || mine === n) return deps.content.render('korlatozott.aktivalas_hint', { n });
  if (mine <= 0) return deps.content.render('korlatozott.aktivalas_hint_mienk', { n });
  return deps.content.render('korlatozott.aktivalas_hint_reszlet', { n, m: mine });
}
