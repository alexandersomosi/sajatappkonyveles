// SPEC §31 (marketing, 2026-11-20) – the ONE definition of where a visitor came from, shared by the landing script
// (kod/landing/build.mjs generates meres.js from it), the app (registration), the backend (stored sources, the
// Marketing tab) and the panel (labels, campaign link builder). Pure functions, no imports, erasable TypeScript only
// (the landing build reads this file with Node type stripping).

/** The channels of the Marketing tab, in display order. */
export const MARKETING_CHANNELS = ['youtube', 'google', 'facebook', 'instagram', 'tiktok', 'kozvetlen', 'egyeb'] as const;
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

export const MARKETING_CHANNEL_LABELS: Record<MarketingChannel, string> = {
  youtube: 'YouTube',
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  kozvetlen: 'Közvetlen',
  egyeb: 'Egyéb',
};

/**
 * Display only (never stored): a client who registered before the source was recorded (the backfill without a campaign
 * link, or no row at all). Shown apart, so the old clients do not look like "came directly".
 */
export const MARKETING_UNKNOWN = 'ismeretlen' as const;
export type MarketingRowChannel = MarketingChannel | typeof MARKETING_UNKNOWN;
export const MARKETING_UNKNOWN_LABEL = 'Ismeretlen (a mérés előtt)';
export function marketingRowLabel(c: MarketingRowChannel): string {
  return c === MARKETING_UNKNOWN ? MARKETING_UNKNOWN_LABEL : MARKETING_CHANNEL_LABELS[c];
}

/**
 * utm_medium values that mean a PAID ad (lower case). The Hirdetések tab counts cost per registration only with these
 * (or with an ad click id), so the organic Google search and the free Facebook posts never lower the cost.
 */
export const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_social', 'paid-social', 'paidsocial', 'cpm', 'display', 'hirdetes', 'fizetett', 'fizetett-poszt'] as const;
export function isPaidTouch(t: { utmMedium?: string | null; clickIds?: Partial<Record<string, string>> | null }): boolean {
  const m = (t.utmMedium ?? '').trim().toLowerCase();
  if (m && (PAID_MEDIUMS as readonly string[]).includes(m)) return true;
  return Boolean(t.clickIds && Object.keys(t.clickIds).length);
}

/** The UTM parameters we keep (everything else in the address is dropped before it is stored or measured). */
export const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

/**
 * Ad click identifiers. They are NEVER sent to the statistics (the landing filter strips them) and are stored with a
 * registration ONLY when ad measurement is switched on AND the visitor agreed (SPEC §31.6).
 */
export const AD_CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'fbclid'] as const;
export type AdClickIdKey = (typeof AD_CLICK_ID_PARAMS)[number];
/** Every known click identifier (the statistics filter removes all of them, not only the four we may keep). */
export const ALL_CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'yclid'] as const;

/** Query parameters the landing passes to the app besides utm_*: the referring domain and the landing path. */
export const SOURCE_PARAM_REFERRER = 'hivatkozo';
export const SOURCE_PARAM_LANDING = 'erkezes';
/** The landing's consent decision id (only with ad measurement on and a "Elfogadom" answer). */
export const SOURCE_PARAM_CONSENT = 'hid';

/** The custom events of the landing page (Umami event names, ≤ 50 characters). */
export const MARKETING_EVENTS = {
  regisztralok: 'regisztralok',
  belepes: 'belepes',
  visszahivas: 'visszahivas',
  email: 'email-iras',
  arak: 'arak-lathato',
} as const;
export type MarketingEvent = (typeof MARKETING_EVENTS)[keyof typeof MARKETING_EVENTS];
export const MARKETING_EVENT_LABELS: Record<MarketingEvent, string> = {
  regisztralok: 'Regisztrálok gomb',
  belepes: 'Belépés gomb',
  visszahivas: 'Visszahívást kérek gomb',
  'email-iras': 'Kattintott az e-mail-címre',
  'arak-lathato': 'Görgetett az árakig',
};

/** The date ranges of the Marketing tab (days, Budapest calendar days; 1 = today). */
export const MARKETING_RANGES = [1, 7, 30, 90] as const;
export type MarketingRange = (typeof MARKETING_RANGES)[number];

/** utm_source values that name a channel (lower case). Exported for the landing script generator. */
export const SOURCE_ALIASES: Record<string, MarketingChannel> = {
  youtube: 'youtube',
  yt: 'youtube',
  'youtube-video': 'youtube',
  google: 'google',
  googleads: 'google',
  'google-ads': 'google',
  adwords: 'google',
  gads: 'google',
  facebook: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  messenger: 'facebook',
  instagram: 'instagram',
  ig: 'instagram',
  tiktok: 'tiktok',
  tt: 'tiktok',
  direct: 'kozvetlen',
  kozvetlen: 'kozvetlen',
};

/** "https://www.YouTube.com/watch?v=1" / "m.youtube.com" → "m.youtube.com" (lower case, no www., no port); null when empty. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  let s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;
  // android-app://com.google.android.googlequicksearchbox/ → the package name
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#]/)[0] ?? '';
  s = s.replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
  if (!s || !/^[a-z0-9.-]+$/.test(s) || s.length > 253) return null;
  return s;
}

/** d is base or one of its subdomains. */
export function endsWithDomain(d: string, base: string): boolean {
  return d === base || d.endsWith(`.${base}`);
}

/** The channel of a referring domain, or null when it is none of the named platforms. */
export function domainChannel(raw: string | null | undefined): MarketingChannel | null {
  const d = normalizeDomain(raw);
  if (!d) return null;
  if (endsWithDomain(d, 'youtube.com') || d === 'youtu.be' || endsWithDomain(d, 'youtube-nocookie.com')) return 'youtube';
  // Android apps send android-app://<package>: the YouTube app is YouTube, only the Google search app is Google
  // (Gmail, Chrome and the other Google apps are not a source of their own)
  if (d === 'com.google.android.youtube' || d === 'com.google.android.apps.youtube.music') return 'youtube';
  if (/(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(d) || d === 'com.google.android.googlequicksearchbox') return 'google';
  if (endsWithDomain(d, 'facebook.com') || d === 'fb.com' || d === 'fb.me' || endsWithDomain(d, 'messenger.com') || d === 'com.facebook.katana' || d === 'com.facebook.lite' || d === 'com.facebook.orca') return 'facebook';
  if (endsWithDomain(d, 'instagram.com') || d === 'com.instagram.android') return 'instagram';
  if (endsWithDomain(d, 'tiktok.com') || d === 'com.zhiliaoapp.musically' || d === 'com.ss.android.ugc.trill') return 'tiktok';
  return null;
}

/** Our own sites: a click from one of them is not a source (the visitor was already here). */
export function isOwnDomain(raw: string | null | undefined, own: readonly string[] = ['adozz.hu']): boolean {
  const d = normalizeDomain(raw);
  return Boolean(d && own.some((o) => endsWithDomain(d, o)));
}

/**
 * The rule (SPEC §31.2): utm_source first (a known name or a platform domain; any other value = "egyeb"); without it
 * the referring domain decides; no referrer, or one of our own sites = "kozvetlen"; any other site = "egyeb".
 */
export function channelOf(o: { utmSource?: string | null; referrerDomain?: string | null }, own?: readonly string[]): MarketingChannel {
  const s = (o.utmSource ?? '').trim().toLowerCase();
  if (s) return SOURCE_ALIASES[s] ?? domainChannel(s) ?? 'egyeb';
  const d = normalizeDomain(o.referrerDomain);
  if (!d || isOwnDomain(d, own)) return 'kozvetlen';
  return domainChannel(d) ?? 'egyeb';
}

/** A campaign value that groups the same everywhere: "Hogyan adózik egy EV? (2. rész)" → "hogyan-adozik-egy-ev-2-resz". */
export function campaignSlug(raw: string, max = 60): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** A stored UTM value: trimmed, at most 100 characters, empty → undefined. */
export function cleanUtmValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, 100);
  return t ? t : undefined;
}

/** The utm_* values of a query string (only the five UTM keys; anything else is ignored). */
export function utmFromSearch(search: string): Utm {
  const out: Utm = {};
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return out;
  }
  for (const k of UTM_KEYS) {
    const v = cleanUtmValue(q.get(`utm_${k}`));
    if (v) out[k] = v;
  }
  return out;
}

/** The address without click identifiers and without any parameter except utm_* (for the statistics). */
export function statisticsUrl(raw: string, base?: string): string {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return raw;
  }
  const keep = new URLSearchParams();
  u.searchParams.forEach((v, k) => {
    if (/^utm_(source|medium|campaign|content|term)$/.test(k)) keep.append(k, v);
  });
  const q = keep.toString();
  u.search = q ? `?${q}` : '';
  u.hash = '';
  return /^https?:\/\//i.test(raw) ? u.toString() : `${u.pathname}${u.search}`;
}

export interface CampaignLinkInput {
  /** The landing address (cfg.landingPublicUrl), e.g. https://adozz.hu */
  base: string;
  source: string;
  medium?: string;
  campaign: string;
  content?: string;
}

/** The finished link for a video description or a post: every value as a slug (so the groups match). */
export function campaignLink(i: CampaignLinkInput): string {
  const u = new URL(i.base.replace(/\/+$/, '') + '/');
  const set = (k: string, v: string | undefined) => {
    const s = v ? campaignSlug(v) : '';
    if (s) u.searchParams.set(k, s);
  };
  set('utm_source', i.source);
  set('utm_medium', i.medium);
  set('utm_campaign', i.campaign);
  set('utm_content', i.content);
  return u.toString();
}

/** The ready-made sources of the link builder (the medium is a suggestion, it can be changed). */
export const CAMPAIGN_SOURCES: { source: string; label: string; medium: string }[] = [
  { source: 'youtube', label: 'YouTube-videó leírása', medium: 'video' },
  { source: 'facebook', label: 'Facebook-bejegyzés', medium: 'social' },
  { source: 'instagram', label: 'Instagram (bio vagy történet)', medium: 'social' },
  { source: 'tiktok', label: 'TikTok', medium: 'social' },
  { source: 'meta', label: 'Facebook- vagy Instagram-hirdetés (fizetett)', medium: 'paid_social' },
  { source: 'google', label: 'Google-hirdetés (fizetett)', medium: 'cpc' },
  { source: 'hirlevel', label: 'Hírlevél vagy e-mail', medium: 'email' },
];

// ---------------------------------------------------------------------------------------------------------------------
// API shapes of the Marketing tab (GET /admin/marketing, SPEC §31.4)
// ---------------------------------------------------------------------------------------------------------------------
export interface MarketingCount {
  key: string;
  label: string;
  n: number;
}
export interface MarketingFunnelSteps {
  registered: number;
  dataDone: number;
  contractAccepted: number;
  paying: number;
}
export interface MarketingFunnelRow extends MarketingFunnelSteps {
  channel: MarketingRowChannel;
  label: string;
  /** Visitors of this channel in the same range (Umami); null when the statistics are not available. */
  visitors: number | null;
}
export interface MarketingCampaignRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  channel: MarketingChannel;
  /** Visitors of this campaign name (Umami counts by name only); null when unknown or when the name is used by two sources. */
  visitors: number | null;
  /** The campaign name is used by more than one source: the visitors are shown once, on the campaign total. */
  sharedName?: boolean;
  registered: number;
  paying: number;
  mrrHuf: number;
}
export interface MarketingMoneyRow {
  channel: MarketingRowChannel;
  label: string;
  payingNow: number;
  mrrHuf: number;
  everPaid: number;
}
export interface MarketingAdsPlatformRow {
  platform: 'meta' | 'google' | 'egyeb';
  label: string;
  spendHuf: number;
  /** Registrations that came from a PAID ad of this platform (isPaidTouch: utm_medium cpc/paid_social… or a click id). */
  registered: number;
  paying: number;
  costPerRegistrationHuf: number | null;
  costPerPayingHuf: number | null;
}
export interface MarketingSpendRow {
  id: string;
  day: string;
  platform: 'meta' | 'google' | 'egyeb';
  campaign: string | null;
  amountHuf: number;
  note: string | null;
  createdAt: string;
  revokedAt: string | null;
}
export interface MarketingSummary {
  range: { days: number; from: string; to: string };
  demo: boolean;
  /** The statistics server (Umami) answered; false = only our own database numbers are shown. */
  stats: { available: boolean; configured: boolean; reason: string | null };
  /** Clients who registered before the source was recorded (shown as "Ismeretlen (a mérés előtt)"). */
  unknownClients?: number;
  visitors: { visitors: number; visits: number; pageviews: number } | null;
  channels: MarketingCount[] | null;
  devices: MarketingCount[] | null;
  countries: MarketingCount[] | null;
  cities: MarketingCount[] | null;
  events: MarketingCount[] | null;
  campaigns: MarketingCampaignRow[];
  funnel: { total: MarketingFunnelSteps & { visitors: number | null }; byChannel: MarketingFunnelRow[] };
  money: { rows: MarketingMoneyRow[]; mrrHuf: number; payingNow: number; dashboardMrrHuf: number; note: string };
  callbacks: { total: number; rows: MarketingCount[] };
  ads: {
    enabled: boolean;
    meta: boolean;
    google: boolean;
    spendHuf: number;
    rows: MarketingAdsPlatformRow[];
    spend: MarketingSpendRow[];
    queued: number;
    sent: number;
    failed: number;
  };
  landingUrl: string;
}
