// SPEC §29.6 F2 – Bevételi kimutatás: monthly revenue (by the day the money arrived, the same basis as the tax) as a
// PDF on one tap. Not an official NAV certificate (the PDF says so). The accountant may check exactly this data
// (income_statement_approvals by data hash); the stamp is printed only while the data hash is unchanged.
import { createHash } from 'node:crypto';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import brand from '../_shared/brand.json' with { type: 'json' };
import { INCOME_NOTIFICATION_TEXTS, INCOME_STATEMENT_RULES, INCOME_STATEMENT_TEXTS, type AccIncomeStatementView, type IncomeStatementMeta, type IncomeStatementMonth } from '../_shared/k29f.js';
import { fillPlaceholders } from '../_shared/bekotes.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clientTaxProfiles, clients, incomeStatementApprovals, requests, revenueItems, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { budapestParts, huFullDate, isMonthKey, lastDayOfMonth, MONTHS_HU, todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { loadFonts } from '../lib/pdf.js';
import { accountantParams, notify } from '../notify/notify.js';
import { accountantUserOf } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { createDocument } from './documents.js';

const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ');

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ty = Number(to.slice(0, 4));
  const tm = Number(to.slice(5, 7));
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 120) break;
  }
  return out;
}

/** "2026. január" */
function monthTitle(mk: string): string {
  return `${mk.slice(0, 4)}. ${MONTHS_HU[Number(mk.slice(5, 7)) - 1] ?? ''}`;
}
/** "2026. január–november" or "2025. január–2026. november" */
export function periodTitle(from: string, to: string): string {
  if (from.slice(0, 4) === to.slice(0, 4)) return from === to ? monthTitle(from) : `${monthTitle(from)}–${MONTHS_HU[Number(to.slice(5, 7)) - 1]}`;
  return `${monthTitle(from)}–${monthTitle(to)}`;
}

export async function firstRevenueMonth(db: DbOrTx, clientId: string): Promise<string | null> {
  const [r] = await db
    .select({ d: sql<string | null>`min(${revenueItems.receivedOn})` })
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), isNull(revenueItems.deletedAt)));
  const d = r?.d ? String(r.d) : null;
  return d ? d.slice(0, 7) : null;
}

/** Validates ?from&to: YYYY-MM, from ≤ to ≤ this month, ≤ 24 months, not before the first revenue month. */
export async function checkRange(deps: Deps, db: DbOrTx, clientId: string, from: string | undefined, to: string | undefined): Promise<{ from: string; to: string }> {
  const today = todayBudapest(deps.now());
  const thisMonth = today.slice(0, 7);
  const f = from ?? `${today.slice(0, 4)}-01`;
  const t = to ?? thisMonth;
  if (!isMonthKey(f) || !isMonthKey(t)) throw E.validation({ from: 'ÉÉÉÉ-HH alakban.' });
  if (f > t) throw E.validation({ from: INCOME_STATEMENT_TEXTS.periodOrder });
  if (t > thisMonth) throw E.validation({ to: 'A jövőre még nincs adat.' });
  if (monthsBetween(f, t).length > INCOME_STATEMENT_RULES.maxMonths) throw E.validation({ from: INCOME_STATEMENT_TEXTS.periodTooLong });
  const first = await firstRevenueMonth(db, clientId);
  if (first && t < first) throw E.validation({ to: INCOME_STATEMENT_TEXTS.periodTooEarly });
  // a "from" before the first revenue month is clamped (a full-year chip of the first year stays usable)
  return { from: first && f < first ? first : f, to: t };
}

interface Regime {
  year: number;
  regime: 'atalany' | 'kata';
  costRatio: number;
}

async function regimesOf(db: DbOrTx, clientId: string, years: number[]): Promise<Map<number, Regime>> {
  const rows = years.length ? await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), inArray(clientTaxProfiles.year, years))) : [];
  const out = new Map<number, Regime>();
  for (const y of years) {
    const r = rows.find((x) => x.year === y);
    out.set(y, { year: y, regime: (r?.regime as 'atalany' | 'kata') ?? 'atalany', costRatio: r?.costRatio ?? 40 });
  }
  return out;
}

export interface StatementData {
  from: string;
  to: string;
  months: IncomeStatementMonth[];
  totalHuf: number;
  manualHuf: number;
  regimeLines: string[];
  hash: string;
}

/** The monthly table from revenue_items (not deleted), grouped by received_on; átalány counts only counts_for_atalany. */
export async function statementData(db: DbOrTx, clientId: string, from: string, to: string, asOf?: string): Promise<StatementData> {
  const months = monthsBetween(from, to);
  const years = [...new Set(months.map((m) => Number(m.slice(0, 4))))];
  const regimes = await regimesOf(db, clientId, years);
  // k7c2: money received after asOf (today) is not counted – an estimated receipt date in the future is not money that
  // arrived (the same basis as the Főoldal and the tax engine: received_on ≤ today)
  const last = asOf && asOf < lastDayOfMonth(to) ? asOf : lastDayOfMonth(to);
  const items = await db
    .select()
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), isNull(revenueItems.deletedAt), gte(revenueItems.receivedOn, `${from}-01`), lte(revenueItems.receivedOn, last)))
    .orderBy(asc(revenueItems.receivedOn));
  const byMonth = new Map<string, IncomeStatementMonth>(months.map((m) => [m, { month: m, invoices: 0, other: 0, revenueHuf: 0, manualHuf: 0, estimated: false }]));
  for (const it of items) {
    const mk = it.receivedOn.slice(0, 7);
    const row = byMonth.get(mk);
    if (!row) continue;
    const reg = regimes.get(Number(mk.slice(0, 4)))!;
    if (reg.regime === 'atalany' && !it.countsForAtalany) continue;
    if (it.source === 'nav_szamla') row.invoices++;
    else row.other++;
    row.revenueHuf += it.amountHuf;
    if (it.source === 'kezi') row.manualHuf += it.amountHuf;
    if (it.receivedOnEstimated) row.estimated = true;
  }
  const list = [...byMonth.values()];
  const totalHuf = list.reduce((s, m) => s + m.revenueHuf, 0);
  const manualHuf = list.reduce((s, m) => s + m.manualHuf, 0);
  // one line per regime span (a KATA ↔ átalány switch or another cost ratio starts a new line)
  const lineOf = (r: Regime) => (r.regime === 'kata' ? INCOME_STATEMENT_TEXTS.regimeKata : fillPlaceholders(INCOME_STATEMENT_TEXTS.regimeAtalany, { x: String(r.costRatio) }));
  const spans: { s: string; e: string; l: string }[] = [];
  for (const m of months) {
    const l = lineOf(regimes.get(Number(m.slice(0, 4)))!);
    const last = spans[spans.length - 1];
    if (last && last.l === l) last.e = m;
    else spans.push({ s: m, e: m, l });
  }
  const lines = spans.length === 1 ? [spans[0]!.l] : spans.map((x) => fillPlaceholders(INCOME_STATEMENT_TEXTS.regimeSpan, { from: monthTitle(x.s), to: monthTitle(x.e), regime: x.l }));
  const hash = createHash('sha256')
    .update(JSON.stringify({ clientId, from, to, months: list.map((m) => [m.month, m.invoices, m.other, m.revenueHuf, m.manualHuf, m.estimated]), regimes: lines }))
    .digest('hex');
  return { from, to, months: list, totalHuf, manualHuf, regimeLines: lines, hash };
}

async function approvalOf(db: DbOrTx, clientId: string, d: StatementData): Promise<{ byName: string; at: Date } | null> {
  const [a] = await db
    .select({ at: incomeStatementApprovals.approvedAt, by: incomeStatementApprovals.approvedBy })
    .from(incomeStatementApprovals)
    .where(and(eq(incomeStatementApprovals.clientId, clientId), eq(incomeStatementApprovals.fromMonth, d.from), eq(incomeStatementApprovals.toMonth, d.to), eq(incomeStatementApprovals.dataSha256, d.hash)))
    .orderBy(desc(incomeStatementApprovals.approvedAt))
    .limit(1);
  if (!a) return null;
  const [acc] = await db.select({ name: accountants.displayName }).from(accountants).where(eq(accountants.userId, a.by)).limit(1);
  const [u] = acc ? [] : await db.select({ name: users.displayName }).from(users).where(eq(users.id, a.by)).limit(1);
  return { byName: acc?.name ?? u?.name ?? 'A könyvelőd', at: a.at };
}

const REVIEW_TYPE = 'kimutatas_ellenorzes';
const periodKey = (from: string, to: string) => `${from}–${to}`;

async function openReview(db: DbOrTx, clientId: string, from: string, to: string) {
  const [r] = await db
    .select()
    .from(requests)
    .where(and(eq(requests.clientId, clientId), eq(requests.type, REVIEW_TYPE), eq(requests.body, periodKey(from, to)), inArray(requests.status, ['nyitott', 'folyamatban'])))
    .limit(1);
  return r ?? null;
}

async function yearsWithRevenue(db: DbOrTx, clientId: string, thisYear: number): Promise<number[]> {
  const rows = await db
    .select({ y: sql<number>`extract(year from ${revenueItems.receivedOn})::int` })
    .from(revenueItems)
    .where(and(eq(revenueItems.clientId, clientId), isNull(revenueItems.deletedAt)))
    .groupBy(sql`1`);
  return rows
    .map((r) => Number(r.y))
    .filter((y) => y < thisYear && y >= thisYear - 3)
    .sort((a, b) => b - a);
}

export async function incomeStatementMeta(deps: Deps, db: DbOrTx, cl: ClientRow, from?: string, to?: string): Promise<IncomeStatementMeta> {
  const range = await checkRange(deps, db, cl.id, from, to);
  const d = await statementData(db, cl.id, range.from, range.to, todayBudapest(deps.now()));
  const ap = await approvalOf(db, cl.id, d);
  const p = await accountantParams(db, cl.accountantId);
  return {
    from: d.from,
    to: d.to,
    months: d.months,
    totalHuf: d.totalHuf,
    manualHuf: d.manualHuf,
    regimeLines: d.regimeLines,
    dataSha256: d.hash,
    approved: ap ? { byName: ap.byName, at: ap.at.toISOString() } : null,
    reviewRequested: Boolean(await openReview(db, cl.id, d.from, d.to)),
    firstMonth: await firstRevenueMonth(db, cl.id),
    years: await yearsWithRevenue(db, cl.id, Number(todayBudapest(deps.now()).slice(0, 4))),
    firstName: String(p.firstName),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// PDF (pdf-lib + Geist; cached 10 min per client/from/to/hash)
// ---------------------------------------------------------------------------------------------------------------------
const INK = rgb(0x10 / 255, 0x15 / 255, 0x2b / 255);
const GREY = rgb(0x50 / 255, 0x58 / 255, 0x73 / 255);
const BLUE = rgb(0x1f / 255, 0x3a / 255, 0x8a / 255);
const BAND = rgb(0xd3 / 255, 0xda / 255, 0xfc / 255);
const A4: [number, number] = [595.28, 841.89];
const M = 50;

const pdfCache = new Map<string, { at: number; pdf: Buffer }>();

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export async function incomeStatementPdf(deps: Deps, db: DbOrTx, cl: ClientRow, from?: string, to?: string): Promise<{ pdf: Buffer; filename: string; meta: IncomeStatementMeta }> {
  const meta = await incomeStatementMeta(deps, db, cl, from, to);
  const key = `${cl.id}:${meta.from}:${meta.to}:${meta.dataSha256}:${meta.approved?.at ?? ''}`;
  const now = deps.now();
  const hit = pdfCache.get(key);
  const filename = `bevételi_kimutatás_${meta.from}_${meta.to}.pdf`;
  if (hit && now.getTime() - hit.at < INCOME_STATEMENT_RULES.cacheMinutes * 60_000) return { pdf: hit.pdf, filename, meta };
  for (const [k, v] of pdfCache) if (now.getTime() - v.at > INCOME_STATEMENT_RULES.cacheMinutes * 60_000) pdfCache.delete(k);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = loadFonts(deps.cfg.fontDir);
  const reg = await doc.embedFont(f.regular, { subset: true });
  const bold = await doc.embedFont(f.semibold, { subset: true });
  const title = fillPlaceholders(INCOME_STATEMENT_TEXTS.pdfTitle, { from: monthTitle(meta.from), to: monthTitle(meta.to) });
  doc.setTitle(title);
  doc.setProducer(brand.name);
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;
  const text = (s: string, x: number, size: number, font: PDFFont = reg, color = INK) => page.drawText(s, { x, y: y - size, size, font, color });
  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - M;
  };
  const para = (s: string, size = 9.5, color = GREY, font: PDFFont = reg) => {
    const plain = s.replace(/\*\*/g, '');
    for (const ln of wrap(font, plain, size, A4[0] - 2 * M)) {
      if (y - size * 1.5 < M) newPage();
      text(ln, M, size, font, color);
      y -= size * 1.45;
    }
  };

  // band
  page.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: BLUE });
  text(brand.name, M, 10, bold, BLUE);
  y -= 22;
  for (const ln of wrap(bold, title, 17, A4[0] - 2 * M)) {
    text(ln, M, 17, bold);
    y -= 22;
  }
  y -= 4;
  // client block
  const ident = cl.businessIdentity as { name?: string; seat?: { zip: string; city: string; line: string } | null } | null;
  const seat = ident?.seat ? `${ident.seat.zip} ${ident.seat.city}, ${ident.seat.line}` : [cl.addressZip, cl.addressCity, cl.addressLine].filter(Boolean).join(' ');
  const rows: [string, string | null | undefined][] = [
    [INCOME_STATEMENT_TEXTS.clientName, clientName(cl)],
    [INCOME_STATEMENT_TEXTS.evName, ident?.name ?? `${clientName(cl)} e.v.`],
    [INCOME_STATEMENT_TEXTS.adoszam, cl.adoszam],
    [INCOME_STATEMENT_TEXTS.evNumber, cl.evNyilvantartasiSzam],
    [INCOME_STATEMENT_TEXTS.seat, seat || null],
  ];
  for (const [l, v] of rows) {
    if (!v) continue;
    text(l, M, 9.5, reg, GREY);
    text(v, M + 150, 9.5, bold, INK);
    y -= 15;
  }
  for (const l of meta.regimeLines) {
    text(l, M, 9.5, reg, INK);
    y -= 15;
  }
  y -= 10;
  // table
  const cols = [M, M + 150, M + 290, A4[0] - M];
  const head = [INCOME_STATEMENT_TEXTS.colMonth, INCOME_STATEMENT_TEXTS.colInvoices, INCOME_STATEMENT_TEXTS.colOther, INCOME_STATEMENT_TEXTS.colRevenue];
  const rightAt = (s: string, xr: number, size: number, font: PDFFont) => page.drawText(s, { x: xr - font.widthOfTextAtSize(s, size), y: y - size, size, font, color: INK });
  page.drawRectangle({ x: M - 6, y: y - 20, width: A4[0] - 2 * M + 12, height: 22, color: BAND });
  y -= 5;
  text(head[0]!, cols[0]!, 9, bold);
  rightAt(head[1]!, cols[2]! - 16, 9, bold);
  rightAt(head[2]!, cols[3]! - 120, 9, bold);
  rightAt(head[3]!, cols[3]!, 9, bold);
  y -= 22;
  let anyEstimated = false;
  for (const m of meta.months) {
    if (y - 18 < M + 90) newPage();
    const label = monthTitle(m.month) + (m.estimated ? '*' : '');
    if (m.estimated) anyEstimated = true;
    text(label, cols[0]!, 10, reg);
    rightAt(String(m.invoices), cols[2]! - 16, 10, reg);
    rightAt(String(m.other), cols[3]! - 120, 10, reg);
    rightAt(fmt(m.revenueHuf), cols[3]!, 10, reg);
    y -= 16;
    page.drawLine({ start: { x: M - 6, y: y + 3 }, end: { x: A4[0] - M + 6, y: y + 3 }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) });
  }
  y -= 4;
  text(INCOME_STATEMENT_TEXTS.total, cols[0]!, 11, bold);
  rightAt(`${fmt(meta.totalHuf)} Ft`, cols[3]!, 11, bold);
  y -= 18;
  if (meta.manualHuf > 0) {
    text(fillPlaceholders(INCOME_STATEMENT_TEXTS.manualPart, { osszeg: fmt(meta.manualHuf) }), cols[0]!, 9, reg, GREY);
    y -= 14;
  }
  if (anyEstimated) {
    text(INCOME_STATEMENT_TEXTS.estimatedMark, cols[0]!, 8.5, reg, GREY);
    y -= 14;
  }
  y -= 10;
  if (meta.approved) {
    if (y - 30 < M) newPage();
    page.drawRectangle({ x: M - 6, y: y - 24, width: A4[0] - 2 * M + 12, height: 26, borderColor: BLUE, borderWidth: 1 });
    y -= 6;
    text(fillPlaceholders(INCOME_STATEMENT_TEXTS.stamp, { nev: meta.approved.byName, datum: huFullDate(todayBudapest(new Date(meta.approved.at))) }), M, 10, bold, BLUE);
    y -= 28;
  }
  para(INCOME_STATEMENT_TEXTS.honest, 9.5, INK);
  y -= 6;
  const bp = budapestParts(now);
  para(fillPlaceholders(INCOME_STATEMENT_TEXTS.generated, { datum: huFullDate(todayBudapest(now)), ido: `${bp.hour}:${String(bp.minute).padStart(2, '0')}`, brand: brand.name }), 8.5);
  const pdf = Buffer.from(await doc.save());
  pdfCache.set(key, { at: now.getTime(), pdf });
  return { pdf, filename, meta };
}

/** "Mentés a dossziéba": a copy as a client document (category 'egyeb', title "Bevételi kimutatás …"). */
export async function saveStatementToDossier(deps: Deps, cl: ClientRow, from: string | undefined, to: string | undefined, userId: string): Promise<{ documentId: string }> {
  const { pdf, meta } = await incomeStatementPdf(deps, deps.db, cl, from, to);
  const title = fillPlaceholders(INCOME_STATEMENT_TEXTS.documentTitle, { from: meta.from, to: meta.to });
  const doc = await deps.db.transaction((tx) =>
    createDocument(deps, tx, {
      clientId: cl.id,
      source: 'rendszer',
      category: 'egyeb',
      dossierMonth: todayBudapest(deps.now()).slice(0, 7),
      title,
      visibility: 'kozos',
      status: 'feldolgozva',
      createdBy: userId,
      files: [{ name: `${title}.pdf`, data: pdf, declaredType: 'application/pdf' }],
      pages: [],
      actorRole: 'client',
    }),
  );
  return { documentId: doc.id };
}

/** "Kérem, hogy {firstName} ellenőrizze" → a requests row (ugyfeltol, kimutatas_ellenorzes) + staff notification. */
export async function requestStatementReview(deps: Deps, cl: ClientRow, from: string | undefined, to: string | undefined, userId: string): Promise<IncomeStatementMeta> {
  const range = await checkRange(deps, deps.db, cl.id, from, to);
  if (await openReview(deps.db, cl.id, range.from, range.to)) return incomeStatementMeta(deps, deps.db, cl, range.from, range.to);
  const h = deps.limiter.hit(`kimutatas-review:${cl.id}`, 5, 86_400_000);
  if (!h.ok) throw E.rateLimited(h.retryAfterSec);
  const now = deps.now();
  const [rq] = await deps.db
    .insert(requests)
    .values({ clientId: cl.id, direction: 'ugyfeltol', type: REVIEW_TYPE, title: `Bevételi kimutatás ellenőrzése (${periodTitle(range.from, range.to)})`, body: periodKey(range.from, range.to), status: 'nyitott', createdBy: userId, createdAt: now, updatedAt: now })
    .returning();
  await audit(deps.db, { action: 'income_statement.review_requested', actorUserId: userId, actorRole: 'client', targetType: 'request', targetId: rq!.id, clientId: cl.id, details: { from: range.from, to: range.to } });
  const acc = await accountantUserOf(deps.db, cl);
  if (acc)
    await notify(deps, deps.db, {
      userId: acc.userId,
      kind: 'income_statement_review' as never,
      params: { clientName: clientName(cl), from: monthTitle(range.from), to: monthTitle(range.to) },
      link: `/ugyfelek/${cl.id}/kimutatas?from=${range.from}&to=${range.to}`,
      data: { clientId: cl.id, from: range.from, to: range.to },
    });
  return incomeStatementMeta(deps, deps.db, cl, range.from, range.to);
}

/** Panel view of the same table. */
export async function accIncomeStatement(deps: Deps, db: DbOrTx, cl: ClientRow, from?: string, to?: string): Promise<AccIncomeStatementView> {
  const meta = await incomeStatementMeta(deps, db, cl, from, to);
  const [other] = await db
    .select({ id: incomeStatementApprovals.id })
    .from(incomeStatementApprovals)
    .where(and(eq(incomeStatementApprovals.clientId, cl.id), eq(incomeStatementApprovals.fromMonth, meta.from), eq(incomeStatementApprovals.toMonth, meta.to)))
    .limit(1);
  return { ...meta, clientName: clientName(cl), changedSinceApproval: Boolean(other) && !meta.approved };
}

/** "Ellenőriztem, rendben": stores the approval for the CURRENT hash (409 when the client's data moved meanwhile). */
export async function approveStatement(deps: Deps, cl: ClientRow, b: { from: string; to: string; dataSha256: string }, actor: { userId: string; role: string; firstName: string }): Promise<AccIncomeStatementView> {
  const range = await checkRange(deps, deps.db, cl.id, b.from, b.to);
  const d = await statementData(deps.db, cl.id, range.from, range.to, todayBudapest(deps.now()));
  if (d.hash !== b.dataSha256) throw E.conflict('Közben változtak az adatok. Frissítsd az oldalt, és nézd át újra.');
  const now = deps.now();
  await deps.db
    .insert(incomeStatementApprovals)
    .values({ clientId: cl.id, fromMonth: range.from, toMonth: range.to, dataSha256: d.hash, approvedBy: actor.userId, approvedAt: now })
    .onConflictDoNothing();
  // close the client's open review request of this period
  await deps.db
    .update(requests)
    .set({ status: 'teljesitve', completedAt: now, completedBy: actor.userId, updatedAt: now })
    .where(and(eq(requests.clientId, cl.id), eq(requests.type, REVIEW_TYPE), eq(requests.body, periodKey(range.from, range.to)), inArray(requests.status, ['nyitott', 'folyamatban'])));
  await audit(deps.db, { action: 'income_statement.approved', actorUserId: actor.userId, actorRole: actor.role, targetType: 'client', targetId: cl.id, clientId: cl.id, details: { from: range.from, to: range.to, hash: d.hash.slice(0, 16) } });
  await notify(deps, deps.db, {
    userId: cl.userId,
    kind: 'income_statement_checked' as never,
    params: { ...(await accountantParams(deps.db, cl.accountantId)), firstName: actor.firstName, from: monthTitle(range.from), to: monthTitle(range.to) },
    link: `/kimutatas?from=${range.from}&to=${range.to}`,
    data: { from: range.from, to: range.to },
  });
  return accIncomeStatement(deps, deps.db, cl, range.from, range.to);
}

export { INCOME_NOTIFICATION_TEXTS, clients };
