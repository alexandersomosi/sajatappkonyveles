// SPEC §29.8 F4 – the client's deadlines in his own calendar. A secret iCal feed per client (token = 32 random bytes,
// looked up by sha256, kept encrypted so the link can be copied again) and one-event .ics files per deadline. The
// calendar shows only fixed labels (ICAL_LABELS): no name, no amount, no adószám, no accountant name.
import { createHash, createHmac } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import brand from '../_shared/brand.json' with { type: 'json' };
import { CALENDAR_RULES, CALENDAR_TEXTS, icalLabelFor, type CalendarFeedView } from '../_shared/k29f.js';
import { fillPlaceholders } from '../_shared/bekotes.js';
import type { Deadline } from '../_shared/api.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { calendarFeeds, clientTaxProfiles, clients } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { randomToken, subKey } from '../lib/crypto.js';
import { E } from '../lib/errors.js';
import { clientDeadlines } from './flags.js';
import type { ClientRow } from './people.js';

const AAD = 'calendar_feeds.token';
export const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');

function uidDomain(deps: Deps): string {
  try {
    return new URL(deps.cfg.landingPublicUrl).hostname || 'adozz.hu';
  } catch {
    return 'adozz.hu';
  }
}

export function feedUrls(deps: Deps, token: string): Pick<CalendarFeedView, 'httpsUrl' | 'webcalUrl' | 'googleUrl' | 'outlookUrl'> {
  const httpsUrl = `${deps.cfg.apiPublicUrl}/api/v1/naptar/${token}.ics`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://');
  return {
    httpsUrl,
    webcalUrl,
    googleUrl: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`,
    outlookUrl: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=${encodeURIComponent(brand.name)}`,
  };
}

export async function calendarView(deps: Deps, db: DbOrTx, clientId: string): Promise<CalendarFeedView> {
  const [f] = await db.select().from(calendarFeeds).where(eq(calendarFeeds.clientId, clientId)).limit(1);
  if (!f || f.revokedAt) return { enabled: false, httpsUrl: null, webcalUrl: null, googleUrl: null, outlookUrl: null, createdAt: null, lastFetchedAt: null };
  const token = deps.data.dec(f.tokenEnc, AAD);
  return { enabled: true, ...feedUrls(deps, token), createdAt: (f.rotatedAt ?? f.createdAt).toISOString(), lastFetchedAt: f.lastFetchedAt?.toISOString() ?? null };
}

/** POST /client/calendar: creates the feed or ("Új linket kérek") rotates it – the old link stops at once. */
export async function createOrRotateFeed(deps: Deps, cl: ClientRow, ctx: { userId: string }): Promise<CalendarFeedView> {
  const token = randomToken(32);
  const now = deps.now();
  const [old] = await deps.db.select().from(calendarFeeds).where(eq(calendarFeeds.clientId, cl.id)).limit(1);
  if (old) {
    await deps.db.update(calendarFeeds).set({ tokenHash: tokenHash(token), tokenEnc: deps.data.enc(token, AAD), rotatedAt: now, revokedAt: null, lastFetchedAt: null, fetchCount: 0 }).where(eq(calendarFeeds.clientId, cl.id));
  } else {
    await deps.db.insert(calendarFeeds).values({ clientId: cl.id, tokenHash: tokenHash(token), tokenEnc: deps.data.enc(token, AAD), createdAt: now });
  }
  await audit(deps.db, { action: old && !old.revokedAt ? 'calendar.feed_rotated' : 'calendar.feed_created', actorUserId: ctx.userId, actorRole: 'client', targetType: 'client', targetId: cl.id, clientId: cl.id });
  return calendarView(deps, deps.db, cl.id);
}

/** DELETE /client/calendar ("Kikapcsolom"), the contract end (§29.9.5) and the anonymisation (§29.9.6). */
export async function revokeFeed(deps: Deps, db: DbOrTx, clientId: string, by: { userId: string | null; role: string; reason?: string }): Promise<boolean> {
  const r = await db
    .update(calendarFeeds)
    .set({ revokedAt: deps.now() })
    .where(and(eq(calendarFeeds.clientId, clientId), isNull(calendarFeeds.revokedAt)))
    .returning({ id: calendarFeeds.clientId });
  if (r.length) await audit(db, { action: 'calendar.feed_revoked', actorUserId: by.userId, actorRole: by.role, targetType: 'client', targetId: clientId, clientId, details: by.reason ? { reason: by.reason } : null });
  return r.length > 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// RFC 5545
// ---------------------------------------------------------------------------------------------------------------------
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}
function nextDay(iso: string): string {
  return addDays(iso, 1).replace(/-/g, '');
}

async function regimeNow(deps: Deps, db: DbOrTx, clientId: string): Promise<'atalany' | 'kata' | null> {
  const y = Number(todayBudapest(deps.now()).slice(0, 4));
  const [p] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, y))).limit(1);
  return (p?.regime as 'atalany' | 'kata' | undefined) ?? null;
}

function uidOf(deps: Deps, clientId: string, deadlineId: string): string {
  const k = subKey(deps.cfg.appDataKey, 'kezjegy/naptar-uid');
  return `${createHmac('sha256', k).update(`${clientId}:${deadlineId}`).digest('hex').slice(0, 32)}@${uidDomain(deps)}`;
}

function eventLines(deps: Deps, clientId: string, d: Pick<Deadline, 'id' | 'kind' | 'title' | 'dueDate'>, regime: 'atalany' | 'kata' | null, now: Date): string[] {
  const label = icalLabelFor(d, regime);
  const desc = fillPlaceholders(CALENDAR_TEXTS.description, { brand: brand.name, url: `${deps.cfg.appPublicUrl}/hataridok` });
  return [
    'BEGIN:VEVENT',
    `UID:${uidOf(deps, clientId, d.id)}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${d.dueDate.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${nextDay(d.dueDate)}`,
    `SUMMARY:${esc(label)}`,
    `DESCRIPTION:${esc(desc)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(label)}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
  ];
}

function calendar(deps: Deps, events: string[][], name: boolean): string {
  const head = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${brand.provider.legalName}//${brand.ids.appScheme}//HU`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (name) head.push(`X-WR-CALNAME:${esc(fillPlaceholders(CALENDAR_TEXTS.calName, { brand: brand.name }))}`, 'X-WR-TIMEZONE:Europe/Budapest', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H');
  const lines = [...head, ...events.flat(), 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** The whole feed of one client (today − 30 … today + 400 days). */
export async function feedBody(deps: Deps, db: DbOrTx, clientId: string): Promise<string> {
  const today = todayBudapest(deps.now());
  const list = await clientDeadlines(deps, db, clientId, addDays(today, -CALENDAR_RULES.feedPastDays), addDays(today, CALENDAR_RULES.feedAheadDays));
  const regime = await regimeNow(deps, db, clientId);
  // a fixed DTSTAMP per day keeps the body (and the ETag) stable between fetches of the same day
  const stampDay = new Date(`${today}T00:00:00Z`);
  return calendar(deps, list.filter((d) => d.kind !== 'idopont').map((d) => eventLines(deps, clientId, d, regime, stampDay)), true);
}

/** One event (the per-row "Apple" link, GET /client/deadlines/:id/ics). */
export async function singleEventIcs(deps: Deps, db: DbOrTx, clientId: string, deadlineId: string): Promise<string> {
  const today = todayBudapest(deps.now());
  const all = await clientDeadlines(deps, db, clientId, addDays(today, -400), addDays(today, 800));
  const d = all.find((x) => x.id === deadlineId);
  if (!d) throw E.notFound();
  return calendar(deps, [eventLines(deps, clientId, d, await regimeNow(deps, db, clientId), deps.now())], false);
}

/** Public GET /naptar/:token.ics – null = unknown or revoked (the route answers the same 404 for both). */
export async function feedForToken(deps: Deps, token: string): Promise<{ body: string; etag: string; clientId: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [f] = await deps.db.select().from(calendarFeeds).where(eq(calendarFeeds.tokenHash, tokenHash(token))).limit(1);
  if (!f || f.revokedAt) return null;
  const [cl] = await deps.db.select({ anonymizedAt: clients.anonymizedAt }).from(clients).where(eq(clients.id, f.clientId)).limit(1);
  if (!cl || cl.anonymizedAt) return null;
  const body = await feedBody(deps, deps.db, f.clientId);
  const now = deps.now();
  if (!f.lastFetchedAt || now.getTime() - f.lastFetchedAt.getTime() > 3600_000) {
    await deps.db
      .update(calendarFeeds)
      .set({ lastFetchedAt: now, fetchCount: (f.fetchCount ?? 0) + 1 })
      .where(eq(calendarFeeds.clientId, f.clientId));
  }
  return { body, etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`, clientId: f.clientId };
}

/** Per-row links of the "Naptárba" sheet (Google / Outlook templates; Apple = the .ics route). */
export function rowLinks(deps: Deps, d: Pick<Deadline, 'id' | 'kind' | 'title' | 'dueDate'>, regime: 'atalany' | 'kata' | null): { google: string; outlook: string } {
  const label = icalLabelFor(d, regime);
  const details = fillPlaceholders(CALENDAR_TEXTS.description, { brand: brand.name, url: `${deps.cfg.appPublicUrl}/hataridok` });
  const ymd = d.dueDate.replace(/-/g, '');
  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(label)}&dates=${ymd}/${nextDay(d.dueDate)}&details=${encodeURIComponent(details)}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(label)}&startdt=${d.dueDate}&enddt=${addDays(d.dueDate, 1)}&allday=true&body=${encodeURIComponent(details)}`,
  };
}

export { regimeNow };
