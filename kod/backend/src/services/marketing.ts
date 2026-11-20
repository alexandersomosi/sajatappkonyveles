// SPEC §31 – marketing: where registrations and callback requests came from (marketing_touches), and the owner's
// Marketing tab (GET /admin/marketing). The channel rule is ONE function: shared/src/marketing.ts channelOf().
// Numbers: our own database for everything after the visit (registered → data → contract → paying, money, callbacks);
// Umami (our own server) only for the visits, devices, places and page events – aggregates, never a person. When Umami
// does not answer, the visit numbers are null ("nem érhető el") and never made up. Test clients (is_test) are left out.
import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import {
  AD_CLICK_ID_PARAMS,
  MARKETING_CHANNEL_LABELS,
  MARKETING_CHANNELS,
  MARKETING_EVENT_LABELS,
  channelOf,
  cleanUtmValue,
  normalizeDomain,
  type AdClickIdKey,
  type MarketingAdsPlatformRow,
  type MarketingCampaignRow,
  type MarketingChannel,
  type MarketingCount,
  type MarketingFunnelRow,
  type MarketingMoneyRow,
  type MarketingSummary,
  type Utm,
} from '../_shared/marketing.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { adConversionEvents, adSpend, callbackRequests, clients, marketingTouches, onboardingSteps, subscriptions } from '../db/schema.js';
import { addDays, budapestLocalToUtc, todayBudapest } from '../lib/dates.js';
import { linkLandingConsent } from './hirdetes.js';
import { UmamiUnavailable, type UmamiPoint, type UmamiSummary } from './umami.js';

export interface TouchInput {
  utm?: Utm;
  /** From the landing link: the referring domain and the landing path (?hivatkozo=…&erkezes=…). */
  source?: { hivatkozo?: string; erkezes?: string };
  /** SPEC §28.K.8: ?forras=kalkulator, ?cel=visszahivas */
  entry?: { forras?: string; cel?: string };
  /** Ads on only: the landing decision id (?hid=) and the click ids. Ignored with ADS_TRACKING_ENABLED=false. */
  ad?: { hid?: string } & Partial<Record<AdClickIdKey, string>>;
  platform?: 'web' | 'android' | 'ios';
}

/** Our own hosts: a click from them is not a source. */
export function ownDomains(deps: Deps): string[] {
  const hosts = ['adozz.hu'];
  for (const u of [deps.cfg.landingPublicUrl, deps.cfg.appPublicUrl, deps.cfg.panelPublicUrl, deps.cfg.apiPublicUrl]) {
    try {
      hosts.push(new URL(u).hostname.replace(/^www\./, ''));
    } catch {
      /* config checked these */
    }
  }
  return [...new Set(hosts)];
}

/** "/", "/arak" … (no query, no fragment, safe characters only, ≤ 200). */
export function cleanLandingPath(raw: string | undefined): string | null {
  if (!raw) return null;
  const p = raw.split(/[?#]/)[0]!.trim();
  if (!p.startsWith('/') || p.length > 200 || !/^\/[A-Za-z0-9/_.\-~%]*$/.test(p)) return null;
  return p;
}

function utmColumns(utm: Utm | undefined) {
  return {
    utmSource: cleanUtmValue(utm?.source) ?? null,
    utmMedium: cleanUtmValue(utm?.medium) ?? null,
    utmCampaign: cleanUtmValue(utm?.campaign) ?? null,
    utmContent: cleanUtmValue(utm?.content) ?? null,
    utmTerm: cleanUtmValue(utm?.term) ?? null,
  };
}

/** One row per sign-up (password, Google, Apple), in the account's transaction. */
export async function recordRegistrationTouch(deps: Deps, db: DbOrTx, o: { userId: string; clientId: string; input: TouchInput }): Promise<void> {
  const i = o.input;
  const u = utmColumns(i.utm);
  const referrerDomain = normalizeDomain(i.source?.hivatkozo);
  let consentId: string | null = null;
  let clickIds: Partial<Record<AdClickIdKey, string>> | null = null;
  // §31.6: click ids and the consent only with ads switched on AND a granted landing decision
  if (deps.cfg.ads.enabled && i.ad?.hid) {
    const consent = await linkLandingConsent(deps, db, i.ad.hid, o.userId);
    if (consent) {
      consentId = consent.id;
      const ids: Partial<Record<AdClickIdKey, string>> = {};
      for (const k of AD_CLICK_ID_PARAMS) {
        const v = i.ad[k];
        if (typeof v === 'string' && /^[A-Za-z0-9_.\-~]{4,500}$/.test(v)) ids[k] = v;
      }
      clickIds = Object.keys(ids).length ? ids : null;
    }
  }
  const entrySource = i.entry?.forras && /^[a-z0-9_-]{1,40}$/.test(i.entry.forras) ? i.entry.forras : null;
  const entryGoal = i.entry?.cel === 'visszahivas' ? 'visszahivas' : null;
  await db.insert(marketingTouches).values({
    kind: 'regisztracio',
    userId: o.userId,
    clientId: o.clientId,
    channel: channelOf({ utmSource: u.utmSource, referrerDomain }, ownDomains(deps)),
    ...u,
    referrerDomain: referrerDomain && !ownDomains(deps).some((d) => referrerDomain === d || referrerDomain.endsWith(`.${d}`)) ? referrerDomain : null,
    landingPath: cleanLandingPath(i.source?.erkezes),
    platform: i.platform ?? null,
    entrySource,
    entryGoal,
    clickIds,
    consentId,
    createdAt: deps.now(),
  });
}

/**
 * A callback request of a client: its own source when the request came with one (a link with utm_* / hivatkozo),
 * otherwise the source of the client's registration (inherited = true).
 */
export async function recordCallbackTouch(deps: Deps, db: DbOrTx, o: { userId: string; clientId: string; callbackId: string; input?: TouchInput }): Promise<void> {
  const u = utmColumns(o.input?.utm);
  const referrerDomain = normalizeDomain(o.input?.source?.hivatkozo);
  const own = Boolean(u.utmSource || (referrerDomain && channelOf({ referrerDomain }, ownDomains(deps)) !== 'kozvetlen'));
  if (own) {
    await db.insert(marketingTouches).values({
      kind: 'visszahivas',
      userId: o.userId,
      clientId: o.clientId,
      callbackRequestId: o.callbackId,
      channel: channelOf({ utmSource: u.utmSource, referrerDomain }, ownDomains(deps)),
      ...u,
      referrerDomain,
      landingPath: cleanLandingPath(o.input?.source?.erkezes),
      platform: o.input?.platform ?? null,
      createdAt: deps.now(),
    });
    return;
  }
  const [reg] = await db
    .select()
    .from(marketingTouches)
    .where(and(eq(marketingTouches.userId, o.userId), eq(marketingTouches.kind, 'regisztracio')))
    .orderBy(asc(marketingTouches.createdAt))
    .limit(1);
  await db.insert(marketingTouches).values({
    kind: 'visszahivas',
    userId: o.userId,
    clientId: o.clientId,
    callbackRequestId: o.callbackId,
    channel: reg?.channel ?? 'kozvetlen',
    utmSource: reg?.utmSource ?? null,
    utmMedium: reg?.utmMedium ?? null,
    utmCampaign: reg?.utmCampaign ?? null,
    utmContent: reg?.utmContent ?? null,
    utmTerm: reg?.utmTerm ?? null,
    referrerDomain: reg?.referrerDomain ?? null,
    inherited: true,
    platform: o.input?.platform ?? null,
    createdAt: deps.now(),
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// the Marketing tab
// ---------------------------------------------------------------------------------------------------------------------
export interface MarketingRangeInput {
  days?: number;
  from?: string;
  to?: string;
}

export function marketingRange(deps: Deps, q: MarketingRangeInput): { days: number; from: string; to: string; start: Date; end: Date } {
  const today = todayBudapest(deps.now());
  let from: string;
  let to: string;
  if (q.from && q.to) {
    from = q.from <= q.to ? q.from : q.to;
    to = q.from <= q.to ? q.to : q.from;
    if (to > today) to = today;
    if (from > to) from = to;
    // at most a year (Umami and the page stay fast)
    if (addDays(from, 366) < to) from = addDays(to, -366);
  } else {
    const days = [1, 7, 30, 90].includes(q.days ?? 30) ? (q.days ?? 30) : 30;
    to = today;
    from = addDays(today, -(days - 1));
  }
  const start = budapestLocalToUtc(from);
  const end = budapestLocalToUtc(addDays(to, 1));
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return { days, from, to, start, end };
}

const isChannel = (c: string): c is MarketingChannel => (MARKETING_CHANNELS as readonly string[]).includes(c);
const channelLabel = (c: string) => (isChannel(c) ? MARKETING_CHANNEL_LABELS[c] : MARKETING_CHANNEL_LABELS.egyeb);

const DEVICE_LABELS: Record<string, string> = { mobile: 'Telefon', tablet: 'Tablet', desktop: 'Gép', laptop: 'Gép' };

function countryName(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return code || 'Ismeretlen';
  try {
    return new Intl.DisplayNames(['hu'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Sums points by a label (two Umami keys can mean the same, e.g. desktop + laptop = Gép). */
function grouped(points: UmamiPoint[], label: (x: string) => string, key: (x: string) => string = label): MarketingCount[] {
  const m = new Map<string, MarketingCount>();
  for (const p of points) {
    const k = key(p.x);
    const e = m.get(k) ?? { key: k, label: label(p.x), n: 0 };
    e.n += p.y;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

async function amountOf(deps: Deps, db: DbOrTx, clientId: string, periodStart: string): Promise<number> {
  try {
    const { effectiveMonthlyAmount } = await import('./payments.js');
    return (await effectiveMonthlyAmount(deps, db, clientId, periodStart)).amountHuf;
  } catch {
    return (await import('./dijak.js')).monthlyPriceHuf(deps);
  }
}

const PLATFORM_CHANNELS: Record<'meta' | 'google' | 'egyeb', MarketingChannel[]> = { meta: ['facebook', 'instagram'], google: ['google'], egyeb: [] };
const PLATFORM_LABELS: Record<'meta' | 'google' | 'egyeb', string> = { meta: 'Meta (Facebook, Instagram)', google: 'Google', egyeb: 'Egyéb' };

export async function marketingSummary(deps: Deps, q: MarketingRangeInput): Promise<MarketingSummary> {
  const db = deps.db;
  const range = marketingRange(deps, q);
  const today = todayBudapest(deps.now());

  // ---- visits (Umami) ----
  let stats: MarketingSummary['stats'];
  let um: UmamiSummary | null = null;
  if (!deps.umami) stats = { available: false, configured: false, reason: 'A látogatottság-mérés még nincs beállítva a szerveren.' };
  else {
    try {
      um = await deps.umami.summary({ startAt: range.start.getTime(), endAt: range.end.getTime() - 1 });
      stats = { available: true, configured: true, reason: null };
    } catch (e) {
      stats = { available: false, configured: true, reason: e instanceof UmamiUnavailable ? 'A látogatottsági adat most nem érhető el. A regisztrációk és a pénz a saját adatbázisunkból jönnek, azok pontosak.' : 'A látogatottsági adat most nem érhető el.' };
    }
  }
  const visitorsByChannel = new Map<MarketingChannel, number>();
  if (um) for (const t of um.tags) visitorsByChannel.set(isChannel(t.x) ? t.x : 'egyeb', (visitorsByChannel.get(isChannel(t.x) ? t.x : 'egyeb') ?? 0) + t.y);

  // ---- every real client's registration channel (first registration row; none = közvetlen) ----
  const allClients = await db.select({ id: clients.id, userId: clients.userId }).from(clients).where(eq(clients.isTest, false));
  const userOfClient = new Map(allClients.map((c) => [c.id, c.userId]));
  const regTouches = await db
    .select()
    .from(marketingTouches)
    .where(eq(marketingTouches.kind, 'regisztracio'))
    .orderBy(asc(marketingTouches.createdAt));
  const firstTouch = new Map<string, typeof marketingTouches.$inferSelect>();
  for (const t of regTouches) if (!firstTouch.has(t.userId)) firstTouch.set(t.userId, t);
  const channelOfClient = (clientId: string): MarketingChannel => {
    const ch = firstTouch.get(userOfClient.get(clientId) ?? '')?.channel ?? 'kozvetlen';
    return isChannel(ch) ? ch : 'egyeb';
  };

  // ---- registrations in the range (cohort: the day of the sign-up) ----
  const inRange = allClients.filter((c) => {
    const t = firstTouch.get(c.userId);
    return t && t.createdAt >= range.start && t.createdAt < range.end;
  });
  const ids = inRange.map((c) => c.id);
  const steps = ids.length
    ? await db
        .select({ clientId: onboardingSteps.clientId, step: onboardingSteps.step })
        .from(onboardingSteps)
        .where(and(inArray(onboardingSteps.clientId, ids), eq(onboardingSteps.status, 'kesz'), inArray(onboardingSteps.step, ['fiok', 'adatok', 'szerzodes', 'elofizetes'])))
    : [];
  const done = new Map<string, Set<string>>();
  for (const s of steps) done.set(s.clientId, (done.get(s.clientId) ?? new Set()).add(s.step));
  const allSubs = await db.select({ clientId: subscriptions.clientId, status: subscriptions.status, cancelAt: subscriptions.cancelAtPeriodEnd, currentPeriodEnd: subscriptions.currentPeriodEnd }).from(subscriptions);
  const subOf = new Map(allSubs.map((s) => [s.clientId, s]));
  const everPaid = (clientId: string) => {
    const s = subOf.get(clientId);
    return Boolean(done.get(clientId)?.has('elofizetes') || (s && s.status !== 'incomplete'));
  };
  const zero = () => ({ registered: 0, dataDone: 0, contractAccepted: 0, paying: 0 });
  const total = zero();
  const per = new Map<MarketingChannel, ReturnType<typeof zero>>();
  for (const c of inRange) {
    const d = done.get(c.id);
    if (!d?.has('fiok')) continue; // an unconfirmed sign-up is not a registration yet
    const ch = channelOfClient(c.id);
    const e = per.get(ch) ?? zero();
    for (const x of [e, total]) {
      x.registered++;
      if (d.has('adatok')) x.dataDone++;
      if (d.has('szerzodes')) x.contractAccepted++;
      if (everPaid(c.id)) x.paying++;
    }
    per.set(ch, e);
  }
  const byChannel: MarketingFunnelRow[] = MARKETING_CHANNELS.map((ch) => ({ channel: ch, label: MARKETING_CHANNEL_LABELS[ch], visitors: um ? (visitorsByChannel.get(ch) ?? 0) : null, ...(per.get(ch) ?? zero()) }));

  // ---- money now (MRR by channel; the per-subscription amount, as the console counts it) ----
  const realIds = new Set(allClients.map((c) => c.id));
  const money = new Map<MarketingChannel, { payingNow: number; mrrHuf: number; everPaid: number }>();
  const mrrOfClient = new Map<string, number>();
  let dashboardActive = 0;
  for (const s of allSubs) {
    if (!realIds.has(s.clientId)) continue;
    const ch = channelOfClient(s.clientId);
    const e = money.get(ch) ?? { payingNow: 0, mrrHuf: 0, everPaid: 0 };
    if (s.status !== 'incomplete') e.everPaid++;
    if ((s.status === 'active' || s.status === 'past_due') && !s.cancelAt) {
      dashboardActive++;
      const amt = await amountOf(deps, db, s.clientId, s.currentPeriodEnd ? addDays(s.currentPeriodEnd, 1) : today);
      mrrOfClient.set(s.clientId, amt);
      e.payingNow++;
      e.mrrHuf += amt;
    }
    money.set(ch, e);
  }
  const moneyRows: MarketingMoneyRow[] = MARKETING_CHANNELS.map((ch) => ({ channel: ch, label: MARKETING_CHANNEL_LABELS[ch], ...(money.get(ch) ?? { payingNow: 0, mrrHuf: 0, everPaid: 0 }) }));
  const mrrHuf = moneyRows.reduce((a, r) => a + r.mrrHuf, 0);
  const dashboardMrrHuf = dashboardActive * (await (await import('./dijak.js')).monthlyPriceHuf(deps));

  // ---- campaigns of the range ----
  const camp = new Map<string, MarketingCampaignRow & { clientIds: string[] }>();
  for (const c of inRange) {
    const t = firstTouch.get(c.userId)!;
    if (!t.utmSource && !t.utmMedium && !t.utmCampaign) continue;
    if (!done.get(c.id)?.has('fiok')) continue;
    const key = [t.utmSource ?? '', t.utmMedium ?? '', t.utmCampaign ?? ''].join('|').toLowerCase();
    const e = camp.get(key) ?? { source: t.utmSource, medium: t.utmMedium, campaign: t.utmCampaign, channel: channelOfClient(c.id), visitors: null, registered: 0, paying: 0, mrrHuf: 0, clientIds: [] };
    e.registered++;
    if (everPaid(c.id)) e.paying++;
    e.mrrHuf += mrrOfClient.get(c.id) ?? 0;
    e.clientIds.push(c.id);
    camp.set(key, e);
  }
  // campaigns that only had visits (Umami) are listed too
  if (um)
    for (const p of um.campaigns) {
      const has = [...camp.values()].some((r) => (r.campaign ?? '').toLowerCase() === p.x.toLowerCase());
      if (!has && p.x) camp.set(`||${p.x.toLowerCase()}`, { source: null, medium: null, campaign: p.x, channel: 'egyeb', visitors: null, registered: 0, paying: 0, mrrHuf: 0, clientIds: [] });
    }
  const campaigns: MarketingCampaignRow[] = [...camp.values()]
    .map(({ clientIds: _ids, ...r }) => ({ ...r, visitors: um ? um.campaigns.filter((p) => r.campaign && p.x.toLowerCase() === r.campaign.toLowerCase()).reduce((a, p) => a + p.y, 0) : null }))
    .sort((a, b) => b.registered - a.registered || (b.visitors ?? 0) - (a.visitors ?? 0));

  // ---- callback requests of the range (asked by the client) by source ----
  const cbs = await db
    .select({ id: callbackRequests.id, clientId: callbackRequests.clientId })
    .from(callbackRequests)
    .where(and(eq(callbackRequests.createdByRole, 'client'), gte(callbackRequests.createdAt, range.start), lt(callbackRequests.createdAt, range.end)));
  const cbTouches = cbs.length
    ? await db.select({ cb: marketingTouches.callbackRequestId, channel: marketingTouches.channel }).from(marketingTouches).where(and(eq(marketingTouches.kind, 'visszahivas'), inArray(marketingTouches.callbackRequestId, cbs.map((x) => x.id))))
    : [];
  const cbChannel = new Map(cbTouches.map((t) => [t.cb, t.channel]));
  const cbCount = new Map<MarketingChannel, number>();
  let cbTotal = 0;
  for (const cb of cbs) {
    if (!realIds.has(cb.clientId)) continue;
    const raw = cbChannel.get(cb.id) ?? channelOfClient(cb.clientId);
    const ch = isChannel(raw) ? raw : 'egyeb';
    cbCount.set(ch, (cbCount.get(ch) ?? 0) + 1);
    cbTotal++;
  }

  // ---- ads: typed-in spend of the range, cost per registration / paying ----
  const spendRows = await db
    .select()
    .from(adSpend)
    .where(and(gte(adSpend.day, range.from), lte(adSpend.day, range.to)))
    .orderBy(asc(adSpend.day));
  const live = spendRows.filter((s) => !s.revokedAt);
  const adsRows: MarketingAdsPlatformRow[] = (['meta', 'google', 'egyeb'] as const).map((p) => {
    const spendHuf = live.filter((s) => s.platform === p).reduce((a, s) => a + s.amountHuf, 0);
    const chans = PLATFORM_CHANNELS[p];
    const registered = chans.reduce((a, ch) => a + (per.get(ch)?.registered ?? 0), 0);
    const paying = chans.reduce((a, ch) => a + (per.get(ch)?.paying ?? 0), 0);
    return {
      platform: p,
      label: PLATFORM_LABELS[p],
      spendHuf,
      registered,
      paying,
      costPerRegistrationHuf: spendHuf > 0 && registered > 0 && chans.length ? Math.round(spendHuf / registered) : null,
      costPerPayingHuf: spendHuf > 0 && paying > 0 && chans.length ? Math.round(spendHuf / paying) : null,
    };
  });
  const outbox = await db.select({ status: adConversionEvents.status, n: sql<number>`count(*)::int` }).from(adConversionEvents).groupBy(adConversionEvents.status);
  const nOf = (s: string) => Number(outbox.find((o) => o.status === s)?.n ?? 0);

  return {
    range: { days: range.days, from: range.from, to: range.to },
    demo: deps.cfg.appEnv === 'demo',
    stats,
    visitors: um ? { visitors: um.visitors, visits: um.visits, pageviews: um.pageviews } : null,
    channels: um ? MARKETING_CHANNELS.map((ch) => ({ key: ch, label: MARKETING_CHANNEL_LABELS[ch], n: visitorsByChannel.get(ch) ?? 0 })) : null,
    devices: um ? grouped(um.devices, (x) => DEVICE_LABELS[x] ?? 'Egyéb') : null,
    countries: um ? grouped(um.countries, countryName, (x) => x.toUpperCase()) : null,
    cities: um ? grouped(um.cities, (x) => x || 'Ismeretlen') : null,
    events: um ? grouped(um.events, (x) => (MARKETING_EVENT_LABELS as Record<string, string>)[x] ?? x, (x) => x) : null,
    campaigns,
    funnel: { total: { ...total, visitors: um ? um.visitors : null }, byChannel },
    money: {
      rows: moneyRows,
      mrrHuf,
      payingNow: moneyRows.reduce((a, r) => a + r.payingNow, 0),
      dashboardMrrHuf,
      note:
        mrrHuf === dashboardMrrHuf
          ? 'Ugyanannyi, mint az Áttekintés havi bevétele.'
          : 'Itt minden előfizetés a saját havidíjával számít (egyedi ár, kedvezmény, ingyenes hónap, szünetelés), ahogy a Konzol is számolja. Az Áttekintés a fizető ügyfelek számát szorozza a havidíjjal, ezért a kettő eltérhet.',
    },
    callbacks: { total: cbTotal, rows: MARKETING_CHANNELS.map((ch) => ({ key: ch, label: channelLabel(ch), n: cbCount.get(ch) ?? 0 })).filter((r) => r.n > 0) },
    ads: {
      enabled: deps.cfg.ads.enabled,
      meta: Boolean(deps.cfg.ads.meta),
      google: Boolean(deps.cfg.ads.google),
      spendHuf: live.reduce((a, s) => a + s.amountHuf, 0),
      rows: adsRows,
      spend: spendRows.map((s) => ({ id: s.id, day: s.day, platform: s.platform, campaign: s.campaign, amountHuf: s.amountHuf, note: s.note, createdAt: s.createdAt.toISOString(), revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null })),
      queued: nOf('var') + nOf('hiba'),
      sent: nOf('elkuldve'),
      failed: nOf('hiba'),
    },
    landingUrl: deps.cfg.landingPublicUrl,
  };
}

/** GDPR export (forras.json) and the erasure: the source rows of one account. */
export async function touchesOfUser(db: DbOrTx, userId: string) {
  return db
    .select({
      tipus: marketingTouches.kind,
      csatorna: marketingTouches.channel,
      utmSource: marketingTouches.utmSource,
      utmMedium: marketingTouches.utmMedium,
      utmCampaign: marketingTouches.utmCampaign,
      utmContent: marketingTouches.utmContent,
      utmTerm: marketingTouches.utmTerm,
      hivatkozo: marketingTouches.referrerDomain,
      erkezes: marketingTouches.landingPath,
      ido: marketingTouches.createdAt,
    })
    .from(marketingTouches)
    .where(eq(marketingTouches.userId, userId));
}

/** Erasure / anonymisation: only the channel stays (for the totals), every detail of the source goes. */
export async function anonymizeTouches(db: DbOrTx, userId: string): Promise<void> {
  await db
    .update(marketingTouches)
    .set({ utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, referrerDomain: null, landingPath: null, entrySource: null, entryGoal: null, clickIds: null })
    .where(eq(marketingTouches.userId, userId));
}

