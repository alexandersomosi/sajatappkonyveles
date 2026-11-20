// SPEC §28.K.9 backend, built in §29.4.4 – "Add meg az adószámodat": the 8-digit törzsszám → NAV queryTaxpayer with OUR
// OWN technical user (NAV_LOOKUP_*), never the client's. 8 s timeout incl. the queue wait → "Töltsd ki kézzel".
// Successful answers (found / not found / not EV) are cached for 24 h IN THE API PROCESS MEMORY ONLY (HMAC of the
// törzsszám as key, LRU 1 000, cleared on restart; never in the DB, never logged). A cache hit does not count against
// the client's rate limit, but is audited the same way (found, demo, cached – no number, no name).
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { taxNumberCheckDigit } from '@kezjegy/nav-kliens';
import type { BusinessIdentityInput, NavAddress, TaxpayerLookupResult } from '../_shared/api.js';
import { ALANYI_MENTES_VAT_CODE, TAXPAYER_LOOKUP_RULES } from '../_shared/enums.js';
import { TAXPAYER_LOOKUP_TEXTS } from '../_shared/bekotes.js';
import { TAXPAYER_LOOKUP_K29, type TaxpayerLookupResultK29 } from '../_shared/k29.js';
import type { Deps } from '../deps.js';
import { clients } from '../db/schema.js';
import { audit } from '../audit.js';
import { subKey } from '../lib/crypto.js';
import { ApiError, E } from '../lib/errors.js';
import { isValidAdoszam } from '../lib/validators.js';
import { log } from '../log.js';
import { demoCredentialsFor, type NavCredentials } from '../nav/types.js';
import type { ClientRow } from './people.js';

type Cached = { result: Omit<TaxpayerLookupResult, 'message'> & { message: string | null }; at: number };
const CACHES = new WeakMap<Deps, Map<string, Cached>>();

function cacheOf(deps: Deps): Map<string, Cached> {
  let m = CACHES.get(deps);
  if (!m) {
    m = new Map();
    CACHES.set(deps, m);
  }
  return m;
}

function cacheKey(deps: Deps, torzsszam: string): string {
  return createHmac('sha256', subKey(deps.cfg.appDataKey, 'kezjegy/taxpayer-lookup-cache')).update(torzsszam).digest('hex');
}

/** "1136 Budapest, Példa utca 7." → NavAddress (best effort; the client confirms or fixes it). */
export function parseNavAddress(line: string | undefined): NavAddress | null {
  if (!line) return null;
  const m = /^(\d{4})\s+([^,]+?)(?:,\s*(.*))?$/.exec(line.trim());
  if (!m) return null;
  const street = (m[3] ?? '').trim().split(/\s+/).filter(Boolean);
  const houseNumber = street.length >= 2 ? street.pop()! : '';
  const streetType = street.length >= 2 ? street.pop()! : '';
  return { zip: m[1]!, city: m[2]!.trim(), streetName: street.join(' '), streetType, houseNumber };
}

function lookupCredentials(deps: Deps): { env: 'demo' | 'test' | 'prod'; creds: NavCredentials; demo: boolean } | null {
  const l = deps.cfg.navLookup;
  if (l) return { env: l.mode, creds: { login: l.login, password: l.password, signatureKey: l.signKey, exchangeKey: l.exchangeKey, taxNumber: l.taxNumber }, demo: false };
  if (deps.cfg.appEnv !== 'demo') return null;
  // DEMO: the nav-kliens mock (fictional taxpayers), with a fictional technical user
  const t = `1234567${taxNumberCheckDigit('1234567')}`;
  return { env: 'demo', creds: demoCredentialsFor(t), demo: true };
}

const TIMEOUT = Symbol('timeout');

/** The NAV call with the 8 s budget (incl. the shared queue wait). Throws ApiError 503 lookup_unavailable. */
async function queryWithTimeout(deps: Deps, env: 'demo' | 'test' | 'prod', creds: NavCredentials, torzsszam: string, timeoutMs: number) {
  const client = deps.navClient(env, creds);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
  });
  try {
    const r = await Promise.race([client.queryTaxpayer(torzsszam), timeout]);
    if (r === TIMEOUT) throw new ApiError(503, 'lookup_unavailable', TAXPAYER_LOOKUP_K29.unavailableText);
    return r as { valid: boolean; name?: string; incorporation?: string; vatCode?: string; countyCode?: string; address?: string };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    log().warn({ code: (e as { code?: string })?.code ?? 'error' }, 'taxpayer lookup failed');
    throw new ApiError(503, 'lookup_unavailable', TAXPAYER_LOOKUP_K29.unavailableText);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** POST /client/onboarding/taxpayer-lookup */
export async function lookupTaxpayer(deps: Deps, cl: Pick<ClientRow, 'id' | 'userId'>, torzsszamRaw: string, o: { timeoutMs?: number } = {}): Promise<TaxpayerLookupResultK29> {
  const torzsszam = torzsszamRaw.replace(/\D/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(torzsszam) || taxNumberCheckDigit(torzsszam.slice(0, 7)) !== Number(torzsszam[7])) {
    throw E.validation({ torzsszam: 'Ellenőrizd az első 8 számjegyet – így nem lehet adószám.' });
  }
  const src = lookupCredentials(deps);
  if (!src) throw new ApiError(503, 'lookup_not_configured', TAXPAYER_LOOKUP_K29.unavailableText);
  const cache = cacheOf(deps);
  const key = cacheKey(deps, torzsszam);
  const now = deps.now().getTime();
  const hit = cache.get(key);
  if (hit && now - hit.at < TAXPAYER_LOOKUP_K29.cacheHours * 3600_000) {
    // LRU: move to the end
    cache.delete(key);
    cache.set(key, hit);
    await audit(deps.db, { action: 'onboarding.taxpayer_lookup', actorUserId: cl.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { found: hit.result.status === 'talalt', demo: hit.result.demo, cached: true } });
    return { ...hit.result, cached: true };
  }
  const h = deps.limiter.hit(`taxlookup:h:${cl.id}`, TAXPAYER_LOOKUP_RULES.perClientPerHour, 3600_000);
  const d = deps.limiter.hit(`taxlookup:d:${cl.id}`, TAXPAYER_LOOKUP_RULES.perClientPerDay, 86_400_000);
  if (!h.ok || !d.ok) {
    throw new ApiError(429, 'lookup_rate_limited', TAXPAYER_LOOKUP_TEXTS.rateLimited, undefined, undefined, { 'Retry-After': String(Math.ceil(Math.max(h.ok ? 0 : h.retryAfterSec, d.ok ? 0 : d.retryAfterSec))) });
  }
  const info = await queryWithTimeout(deps, src.env, src.creds, torzsszam, o.timeoutMs ?? TAXPAYER_LOOKUP_K29.timeoutMs);
  let result: Cached['result'];
  if (!info.valid) {
    result = { status: 'nincs', demo: src.demo, name: null, seat: null, selfEmployed: null, vatCode: null, countyCode: null, adoszam: null, alanyiMentes: null, afaWarning: false, message: TAXPAYER_LOOKUP_TEXTS.notFound };
  } else if (info.incorporation && info.incorporation !== 'SELF_EMPLOYED') {
    result = { status: 'nem_ev', demo: src.demo, name: info.name ?? null, seat: null, selfEmployed: false, vatCode: info.vatCode ?? null, countyCode: info.countyCode ?? null, adoszam: null, alanyiMentes: null, afaWarning: false, message: TAXPAYER_LOOKUP_TEXTS.notEv };
  } else {
    const vat = info.vatCode ?? null;
    const county = info.countyCode ?? null;
    const alanyi = vat === ALANYI_MENTES_VAT_CODE;
    result = {
      status: 'talalt',
      demo: src.demo,
      name: info.name ?? null,
      seat: parseNavAddress(info.address),
      selfEmployed: true,
      vatCode: vat,
      countyCode: county,
      adoszam: vat && county ? `${torzsszam}-${vat}-${county}` : null,
      alanyiMentes: vat ? alanyi : null,
      afaWarning: Boolean(vat) && !alanyi,
      message: vat && !alanyi ? TAXPAYER_LOOKUP_TEXTS.notAlanyi : null,
    };
  }
  cache.set(key, { result, at: now });
  while (cache.size > TAXPAYER_LOOKUP_K29.cacheMaxEntries) cache.delete(cache.keys().next().value as string);
  await audit(deps.db, { action: 'onboarding.taxpayer_lookup', actorUserId: cl.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { found: result.status === 'talalt', demo: result.demo, cached: false } });
  return { ...result, cached: false };
}

/** Tests: the cache size (never its content). */
export function lookupCacheSize(deps: Deps): number {
  return cacheOf(deps).size;
}

/** POST /client/onboarding/business-identity – saves the confirmed (or hand-typed) business identity. */
export async function saveBusinessIdentity(deps: Deps, cl: ClientRow, b: BusinessIdentityInput): Promise<{ adoszam: string | null; adoszamPending: boolean; afaWarning: boolean }> {
  const db = deps.db;
  if (b.adoszam !== null && !isValidAdoszam(b.adoszam)) throw E.validation({ adoszam: 'Hibás adószám (formátum: 12345678-1-41).' });
  if (b.source === 'nav' && !b.adoszam) throw E.validation({ adoszam: 'Kötelező.' });
  const afaWarning = Boolean(b.adoszam && b.adoszam[9] !== ALANYI_MENTES_VAT_CODE);
  const seat = b.seat;
  const line = [seat.streetName, seat.streetType, seat.houseNumber].filter(Boolean).join(' ') + [seat.building ? ` ${seat.building}. ép.` : '', seat.staircase ? ` ${seat.staircase}. lph.` : '', seat.floor ? ` ${seat.floor}. em.` : '', seat.door ? ` ${seat.door}. ajtó` : ''].join('');
  const now = deps.now();
  await db
    .update(clients)
    .set({
      adoszam: b.adoszam,
      adoszamPending: b.adoszam === null,
      businessIdentitySource: b.source,
      businessIdentity: {
        name: b.name.trim().slice(0, 160),
        seat: { zip: seat.zip, city: seat.city, line: line.trim() },
        alanyiMentes: b.alanyiMentes,
        afaWarning,
        demo: deps.cfg.appEnv === 'demo' && b.source === 'nav' && !deps.cfg.navLookup,
        savedAt: now.toISOString(),
        ...(b.taxStatus ? { taxStatus: b.taxStatus } : {}),
      } as NonNullable<ClientRow['businessIdentity']>,
      hqMunicipality: seat.city,
      ...(b.evSinceMonth ? { evSince: `${b.evSinceMonth}-01` } : {}),
      ...(b.activityText !== undefined ? { activityText: b.activityText.slice(0, 300) } : {}),
      ...(b.activityAnswer ? { activityAnswer: b.activityAnswer } : {}),
      ...(b.taxRegimeAnswer ? { taxRegimeAnswer: b.taxRegimeAnswer } : {}),
      updatedAt: now,
    })
    .where(eq(clients.id, cl.id));
  await audit(db, { action: 'onboarding.business_identity', actorUserId: cl.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id, details: { source: b.source, adoszam: Boolean(b.adoszam), afaWarning } });
  return { adoszam: b.adoszam, adoszamPending: b.adoszam === null, afaWarning };
}

/** POST /acc/clients/:id/adoszam – the accountant fills the adószám from ONYA (check digit; ÁFA code warning). */
export async function setAdoszamByStaff(deps: Deps, cl: ClientRow, adoszam: string, by: { userId: string; role: string }): Promise<{ adoszam: string; afaWarning: boolean; message: string | null }> {
  if (!isValidAdoszam(adoszam)) throw E.validation({ adoszam: 'Hibás adószám (formátum: 12345678-1-41, ellenőrző számjeggyel).' });
  const afaWarning = adoszam[9] !== ALANYI_MENTES_VAT_CODE;
  await deps.db.update(clients).set({ adoszam, adoszamPending: false, updatedAt: deps.now() }).where(eq(clients.id, cl.id));
  await audit(deps.db, { action: 'acc.adoszam_set', actorUserId: by.userId, actorRole: by.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { afaWarning } });
  return { adoszam, afaWarning, message: afaWarning ? TAXPAYER_LOOKUP_TEXTS.panelAfaWarning : null };
}
