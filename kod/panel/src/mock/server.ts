// LOCAL MOCK API – only in `--mode mock` builds. Intercepts fetch('/api/v1/...') and answers from an in-memory,
// stateful copy of the fictional demo data (src/mock/data.ts), so every panel page can be clicked through and
// screenshotted without a backend. Shapes follow SPEC §12 + the panel note in SPEC §24.
// The role is chosen with ?mock_role=accountant|admin|csapat|none (remembered in sessionStorage).
import {
  BENCE,
  CONTENT,
  FAQ,
  NOTES,
  OUTBOX,
  TEMPLATES,
  TODAY,
  auditRows,
  buildClients,
  documentsFor,
  flagsOf,
  messagesFor,
  navInvoicesFor,
  paymentItems,
  referralCodes,
  requestsFor,
  syncRuns,
  taxPeriodsFor,
  ts,
  uid,
  type MockClient,
} from './data';
import { setTodayOverride, isoWeek } from '../lib/today';
import type {
  AccClientDetail,
  AccDocument,
  AccTaxPeriod,
  AuditRow,
  BoardItem,
  DeadlineBoard,
  InternalNote,
  NavInvoiceDetail,
  NavSyncRun,
  QuarterResult,
  ReferralCodeRow,
} from '../api/types';
import type { AccClientRow, AuthResult, Deadline, Message, Meter, RequestSummary, RevenueItem, Appointment } from '../_shared/api';
import type { ClientFilter, DocumentStatus, Milestone, RequestStatus } from '../_shared/enums';
import { MILESTONE_LABELS, MILESTONE_ORDER } from '../_shared/enums';
import { installCsapat, ANNA } from './csapat';
import { exportLetiltva, installHelyettunk } from './helyettunk';

class MockError extends Error {
  constructor(
    public status: number,
    public code: string,
    msg: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(msg);
  }
}
const nf = (n: number) => new Intl.NumberFormat('hu-HU').format(n).replace(/\s/g, ' ');
const HONAPBAN = ['januárban', 'februárban', 'márciusban', 'áprilisban', 'májusban', 'júniusban', 'júliusban', 'augusztusban', 'szeptemberben', 'októberben', 'novemberben', 'decemberben'];
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const nowIso = () => new Date(`${TODAY}T${new Date().toISOString().slice(11, 19)}Z`).toISOString();
const name = (c: MockClient) => `${c.lastName} ${c.firstName}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

// ---------- state ----------
const clients = buildClients();
const inv = new Map<string, NavInvoiceDetail[]>();
const revenue = new Map<string, RevenueItem[]>();
const periods = new Map<string, AccTaxPeriod[]>();
const docs = new Map<string, AccDocument[]>();
const reqs = new Map<string, RequestSummary[]>();
const msgs = new Map<string, Message[]>();
const notes = new Map<string, InternalNote[]>(Object.entries(NOTES));
const runs = new Map<string, NavSyncRun[]>();
for (const c of clients) {
  const n = c.nav.status === 'nincs' ? { rows: [], revenue: [] } : navInvoicesFor(c);
  inv.set(c.id, n.rows);
  revenue.set(c.id, n.revenue);
  periods.set(c.id, taxPeriodsFor(c));
  docs.set(c.id, documentsFor(c));
  const r = requestsFor(c);
  reqs.set(c.id, r);
  msgs.set(c.id, messagesFor(c, r));
  runs.set(c.id, syncRuns(c));
}
// Péter: invoices exist at NAV but are not connected yet – revenue shown from the previous accountant's figures
{
  const p = clients.find((c) => c.key === 'peter')!;
  revenue.set(p.id, navInvoicesFor(p).revenue);
}
let templates = [...TEMPLATES];
const audit: AuditRow[] = auditRows(clients);
let faq = [...FAQ];
const content = CONTENT.map((c) => ({ ...c }));
const referral: ReferralCodeRow[] = referralCodes(clients);
const settings = { ...BENCE };
let totpEnabled = false;
const fileMeta = new Map<string, { title: string; kind: 'kyc' | 'doc' }>();
const slots: { id: string; startsAt: string; endsAt: string; channels: ('telefon' | 'video')[]; status: 'szabad' | 'foglalt' | 'torolve' }[] = [];
const appointments: (Appointment & { client: { id: string; name: string }; phone?: string | null })[] = [];
{
  const p = clients.find((c) => c.key === 'peter')!;
  for (const [d, h] of [
    ['2026-11-19', '10:00'],
    ['2026-11-19', '10:15'],
    ['2026-11-19', '10:30'],
    ['2026-11-24', '14:00'],
    ['2026-11-24', '14:15'],
  ] as const) {
    const s = { id: uid('slot'), startsAt: ts(d, h), endsAt: ts(d, h.replace(/:(\d\d)/, (_m, mm: string) => `:${String(Number(mm) + 15).padStart(2, '0')}`)), channels: ['telefon', 'video'] as ('telefon' | 'video')[], status: 'szabad' as const };
    slots.push({ ...s });
  }
  slots[0]!.status = 'foglalt';
  appointments.push({ id: uid('ap'), startsAt: slots[0]!.startsAt, endsAt: slots[0]!.endsAt, channel: 'telefon', status: 'foglalt', topic: 'Átállás az előző könyvelőtől', client: { id: p.id, name: name(p) }, phone: '+36 30 000 0003' });
  appointments.push({ id: uid('ap'), startsAt: ts('2026-01-09', '09:00'), endsAt: ts('2026-01-09', '09:15'), channel: 'video', status: 'megtortent', topic: 'Bemutatkozás', client: { id: 'c-kata', name: 'Szabó Kata' } });
}
const subsPayments: { id: string; orderRef: string; client: { id: string; name: string }; kind: 'regisztracio' | 'ismetlodo'; amountHuf: number; status: string; createdAt: string; finishedAt: string | null; errorCodes: string[]; mode: 'demo' }[] = [];
for (const c of clients) {
  if (!c.sub || c.sub.status === 'incomplete') continue;
  const start = c.sub.since;
  let [y, m] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  let first = true;
  while (`${y}-${String(m).padStart(2, '0')}-${start.slice(8)}` <= TODAY) {
    const d = `${y}-${String(m).padStart(2, '0')}-${start.slice(8)}`;
    subsPayments.push({ id: uid('pay'), orderRef: `KJ-${d.replace(/-/g, '')}-${uid('x').toUpperCase().padEnd(10, 'Q').slice(0, 10)}`, client: { id: c.id, name: name(c) }, kind: first ? 'regisztracio' : 'ismetlodo', amountHuf: 20000, status: 'FINISHED', createdAt: ts(d, first ? '19:27' : '06:00'), finishedAt: ts(d, first ? '19:28' : '06:01'), errorCodes: [], mode: 'demo' });
    first = false;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  if (c.sub.status === 'past_due') {
    subsPayments.push({ id: uid('pay'), orderRef: `KJ-20261111-${uid('y').toUpperCase().padEnd(10, 'Z').slice(0, 10)}`, client: { id: c.id, name: name(c) }, kind: 'ismetlodo', amountHuf: 20000, status: 'NOTAUTHORIZED', createdAt: ts('2026-11-11', '06:00'), finishedAt: ts('2026-11-11', '06:00'), errorCodes: ['5071'], mode: 'demo' });
    subsPayments.push({ id: uid('pay'), orderRef: `KJ-20261114-${uid('z').toUpperCase().padEnd(10, 'W').slice(0, 10)}`, client: { id: c.id, name: name(c) }, kind: 'ismetlodo', amountHuf: 20000, status: 'NOTAUTHORIZED', createdAt: ts('2026-11-14', '06:00'), finishedAt: ts('2026-11-14', '06:00'), errorCodes: ['5071'], mode: 'demo' });
    const last = subsPayments.filter((p) => p.client.id === c.id && p.status === 'FINISHED' && p.createdAt >= ts('2026-11-01'));
    for (const l of last) subsPayments.splice(subsPayments.indexOf(l), 1);
  }
}
subsPayments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

function logAudit(action: string, c: MockClient | null, details: Record<string, unknown> | null = null) {
  const r = role();
  const actor = r === 'admin' ? { id: 'u-admin', name: 'Demo Tulajdonos', role: 'admin' } : r === 'csapat' ? { id: ANNA.userId, name: ANNA.name, role: 'csapat' } : { id: BENCE.id, name: BENCE.displayName, role: 'accountant' };
  audit.unshift({ id: String(Date.now() + Math.random()), at: nowIso(), actor, action, targetType: null, targetId: null, client: c ? { id: c.id, name: name(c) } : null, details });
}

// ---------- session ----------
type MockRole = 'accountant' | 'admin' | 'csapat' | 'none';
function role(): MockRole {
  try {
    return (sessionStorage.getItem('mock_role') as MockRole) ?? 'accountant';
  } catch {
    return 'accountant';
  }
}
function setRole(r: string) {
  try {
    sessionStorage.setItem('mock_role', r);
  } catch {
    /* ignore */
  }
}
function authResult(): AuthResult {
  const admin = role() === 'admin';
  return {
    accessToken: 'mock-token',
    accessTokenExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    user: admin
      ? { id: 'u-admin', email: 'admin@demo.kezjegy.test', role: 'admin', displayName: 'Demo Tulajdonos', emailVerified: true, totpEnabled }
      : role() === 'csapat'
        ? { id: ANNA.userId, email: 'anna.nagy@demo.kezjegy.test', role: 'csapat', displayName: ANNA.name, emailVerified: true, totpEnabled }
        : { id: 'u-bence', email: BENCE.email, role: 'accountant', displayName: BENCE.displayName, emailVerified: true, totpEnabled },
  };
}

// ---------- derived ----------
function byId(id: string): MockClient {
  const c = clients.find((x) => x.id === id);
  if (!c) throw new MockError(404, 'not_found', 'Nincs ilyen ügyfél, vagy nincs hozzá jogod.');
  return c;
}
function meters(c: MockClient): AccClientDetail['meters'] {
  const limit = 20_000_000;
  const afa: Meter = {
    usedHuf: c.afaUsed,
    limitHuf: limit,
    projectedHuf: c.afaProjected,
    ratio: c.afaUsed / limit,
    warning: c.afaUsed / limit >= 0.8 || c.afaProjected >= limit,
    sentence: c.afaUsed >= limit ? 'Túllépte az alanyi ÁFA-mentesség határát.' : `Még ${nf(limit - c.afaUsed)} Ft-ot számlázhat ÁFA nélkül.`,
  };
  const capLimit = c.taxProfile?.costRatio === 90 ? 193_680_000 : 38_736_000;
  const atalanyCap: Meter = {
    usedHuf: c.atalanyUsed,
    limitHuf: capLimit,
    projectedHuf: Math.round((c.atalanyUsed * 365) / 321),
    ratio: c.atalanyUsed / capLimit,
    warning: c.atalanyUsed / capLimit >= 0.8,
    sentence: `Az átalányadózás felső határának ${Math.round((c.atalanyUsed / capLimit) * 100)}%-ánál tart.`,
  };
  const reached = c.adomentesMonth !== null;
  return {
    afa,
    atalanyCap,
    adomentes: {
      limitHuf: 1_936_800,
      usedIncomeHuf: Math.min(c.incomeYtd, 1_936_800),
      reached,
      reachedMonth: c.adomentesMonth,
      sentence: reached ? `Az adómentes részt ${HONAPBAN[c.adomentesMonth! - 1]} elérte.` : `Az adómentes részből még ${nf(1_936_800 - c.incomeYtd)} Ft van hátra.`,
    },
  };
}
function milestones(c: MockClient): AccClientDetail['onboarding']['milestones'] {
  const st = (s: string) => c.steps.find((x) => x.step === s)?.status;
  const done: Record<Milestone, boolean> = {
    vallalkozas_elinditva: st('vallalkozas_inditas') === 'kesz',
    alairva: st('szerzodes') === 'kesz' && (st('meghatalmazas') === 'konyvelore_var' || st('meghatalmazas') === 'kesz'),
    azonositva: st('azonositas') === 'kesz',
    nav_bejelentve: st('meghatalmazas') === 'kesz',
    szamlak_bekotve: st('nav_bekotes') === 'kesz',
    kesz: c.lifecycle === 'aktiv',
  };
  const keys: readonly Milestone[] = MILESTONE_ORDER[c.businessStatus === 'inditas' || c.steps.some((s) => s.step === 'vallalkozas_inditas' && s.status !== 'kihagyva') ? 'inditas' : 'van'];
  const cur = keys.find((k) => !done[k]) ?? null;
  return keys.map((k) => ({ key: k, label: MILESTONE_LABELS[k], done: done[k], current: k === cur }));
}
function deadlinesOf(c: MockClient): Deadline[] {
  const out: Deadline[] = [];
  for (const r of reqs.get(c.id) ?? []) {
    if (r.direction === 'konyvelotol' && (r.status === 'nyitott' || r.status === 'folyamatban') && r.dueDate)
      out.push({ id: r.id, kind: 'keres', title: r.title.replace(/\.$/, ''), dueDate: r.dueDate, daysLeft: daysBetween(r.dueDate, TODAY), status: r.dueDate < TODAY ? 'lejart' : 'nyitott', link: '' });
  }
  for (const p of periods.get(c.id) ?? []) {
    if (p.dueDate >= TODAY || (p.calcStatus === 'jovahagyva' && p.paymentStatus === 'fizetendo'))
      out.push({ id: p.id, kind: 'befizetes', title: `${p.label} befizetése`, dueDate: p.dueDate, daysLeft: daysBetween(p.dueDate, TODAY), amountHuf: p.totalHuf ?? undefined, status: 'nyitott', link: '' });
  }
  // SPEC §26.2.9: no appointment deadlines any more (the booked call became a callback).
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
function row(c: MockClient): AccClientRow {
  const r = reqs.get(c.id) ?? [];
  const open = (x: RequestSummary) => x.status === 'nyitott' || x.status === 'folyamatban';
  const ms = milestones(c);
  return {
    id: c.id,
    name: name(c),
    lifecycle: c.lifecycle,
    flags: flagsOf(c, r),
    nextDeadline: deadlinesOf(c)[0],
    openRequestsFromClient: r.filter((x) => x.direction === 'ugyfeltol' && open(x)).length,
    openRequestsToClient: r.filter((x) => x.direction === 'konyvelotol' && open(x)).length,
    waitingDocuments: (docs.get(c.id) ?? []).filter((d) => d.source === 'ugyfel' && d.status === 'feltoltve').length,
    lastUploadAt: c.lastUploadAt ?? undefined,
    afaRatio: c.afaUsed / 20_000_000,
    subscriptionStatus: c.sub?.status ?? null,
    onboardingMilestone: c.lifecycle === 'bekotes_alatt' ? (ms.find((m) => m.current)?.key ?? null) : null,
  };
}
function detail(c: MockClient): AccClientDetail {
  const rw = row(c);
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    name: name(c),
    email: c.email,
    phone: c.phone,
    lifecycle: c.lifecycle,
    flags: rw.flags,
    clientSince: c.clientSince,
    adoazonositoJel: null,
    adoazonositoJelMasked: c.adoazonositoJel ? `•••••••${String(c.adoazonositoJel).slice(-3)}` : null,
    adoszam: c.adoszam,
    evNyilvantartasiSzam: c.evNyilvantartasiSzam,
    birthName: c.birthName,
    address: c.address,
    hqMunicipality: c.hqMunicipality,
    activityText: c.activityText,
    activityCode: c.activityCode,
    evSince: c.evSince,
    previousAccountant: c.previousAccountant,
    hasSeparateBusinessAccount: c.hasSeparateBusinessAccount,
    taxProfile: c.taxProfile,
    onboarding: { steps: c.steps, milestones: milestones(c) },
    kycStatus: c.kycStatus,
    subscription: c.sub ? { status: c.sub.status, mode: 'demo', priceHuf: 20000, nextChargeAt: c.sub.nextChargeAt ?? undefined, cardMask: c.sub.cardMask ?? undefined, failedAttempts: c.sub.failedAttempts } : null,
    nav: c.nav,
    meters: c.taxProfile ? meters(c) : null,
    nextDeadline: rw.nextDeadline ?? null,
    openRequestsFromClient: rw.openRequestsFromClient,
    openRequestsToClient: rw.openRequestsToClient,
    unreadMessages: c.key === 'kata' ? 1 : 0,
    demo: true,
  };
}
function docLabel(s: DocumentStatus, nav = false): string {
  return s === 'feltoltve' ? (nav ? 'Letöltöttük' : 'Feltöltve') : s === 'konyvelo_latta' ? `${settings.firstName} látta` : s === 'feldolgozva' ? 'Feldolgozva' : 'Beadva';
}
function findDoc(id: string): { c: MockClient; d: AccDocument } {
  for (const c of clients) {
    const d = (docs.get(c.id) ?? []).find((x) => x.id === id);
    if (d) return { c, d };
  }
  throw new MockError(404, 'not_found', 'Nincs ilyen irat.');
}
function docDetail(d: AccDocument) {
  const hist: { status: DocumentStatus; label: string; at: string; by?: string }[] = [{ status: 'feltoltve', label: 'Feltöltve', at: d.createdAt }];
  const order: DocumentStatus[] = ['feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva'];
  for (const s of order.slice(1, order.indexOf(d.status) + 1)) hist.push({ status: s, label: docLabel(s), at: d.statusAt, by: settings.displayName });
  return { ...d, statusLabel: docLabel(d.status), versions: [{ id: uid('v'), versionNo: 1, fileId: d.fileId!, pageCount: d.pageCount, createdAt: d.createdAt }], history: hist, documentDate: d.createdAt.slice(0, 10) };
}
function findPeriod(id: string): { c: MockClient; p: AccTaxPeriod } {
  for (const c of clients) {
    const p = (periods.get(c.id) ?? []).find((x) => x.id === id || x.latestCalculation?.id === id);
    if (p) return { c, p };
  }
  throw new MockError(404, 'not_found', 'Nincs ilyen időszak.');
}
function findReq(id: string): { c: MockClient; r: RequestSummary } {
  for (const c of clients) {
    const r = (reqs.get(c.id) ?? []).find((x) => x.id === id);
    if (r) return { c, r };
  }
  throw new MockError(404, 'not_found', 'Nincs ilyen kérés.');
}
function demoSvg(title: string, kyc: boolean): string {
  const w = kyc ? 856 : 620;
  const h = kyc ? 540 : 860;
  const body = kyc
    ? `<rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="28" fill="#C9D1DD"/><rect x="80" y="110" width="180" height="230" rx="14" fill="#AEB8C7"/><g fill="#9AA5B6"><rect x="300" y="120" width="380" height="26" rx="6"/><rect x="300" y="170" width="300" height="22" rx="6"/><rect x="300" y="215" width="340" height="22" rx="6"/><rect x="300" y="260" width="240" height="22" rx="6"/></g><text x="${w / 2}" y="${h - 110}" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="#5E6B80">DEMO – NEM VALÓDI OKMÁNY</text><text x="${w / 2}" y="${h - 70}" text-anchor="middle" font-family="Arial" font-size="24" fill="#5E6B80">${title}</text>`
    : `<rect x="30" y="30" width="${w - 60}" height="${h - 60}" fill="#fff" stroke="#D5DBE5"/><text x="70" y="110" font-family="Arial" font-size="30" font-weight="700" fill="#2A3346">MINTA</text><text x="70" y="150" font-family="Arial" font-size="22" fill="#5E6B80">${title}</text><g fill="#E3E8EF">${Array.from({ length: 14 }, (_, i) => `<rect x="70" y="${210 + i * 40}" width="${380 + ((i * 53) % 90)}" height="16" rx="4"/>`).join('')}</g><text x="${w / 2}" y="${h - 70}" text-anchor="middle" font-family="Arial" font-size="20" fill="#8A95A9">DEMO – nem valódi irat</text>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#EEF1F6"/>${body}</svg>`)}`;
}

// ---------- board ----------
function mondayOf(week: string): string {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y!, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mon = new Date(jan4.getTime() + ((1 - day) + (w! - 1) * 7) * 86_400_000);
  return mon.toISOString().slice(0, 10);
}
function addDays(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
function board(week: string): DeadlineBoard {
  const mon = mondayOf(week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const rows: DeadlineBoard['rows'] = [];
  const overdue: DeadlineBoard['overdue'] = [];
  for (const c of clients) {
    const items: BoardItem[] = [];
    for (const d of deadlinesOf(c)) {
      const it: BoardItem = { id: d.id, kind: d.kind, title: d.title, dueDate: d.dueDate, status: d.status, overdue: d.dueDate < TODAY, amountHuf: d.amountHuf };
      if (d.dueDate >= days[0]! && d.dueDate <= days[6]!) items.push(it);
      if (d.dueDate < TODAY && d.status !== 'kesz') overdue.push({ ...it, client: { id: c.id, name: name(c) }, daysOverdue: daysBetween(TODAY, d.dueDate) });
    }
    for (const r of reqs.get(c.id) ?? [])
      if (r.direction === 'ugyfeltol' && (r.status === 'nyitott' || r.status === 'folyamatban') && week === isoWeek(TODAY))
        items.push({ id: `${r.id}-u`, kind: 'keres', title: `Tőle: ${r.certificate ? 'igazolás' : r.title}`, dueDate: addDays(r.createdAt.slice(0, 10), 3) > days[6]! ? days[6]! : addDays(r.createdAt.slice(0, 10), 3) < days[0]! ? days[0]! : addDays(r.createdAt.slice(0, 10), 3), status: 'nyitott', overdue: false });
    if (c.key === 'kata' && week === isoWeek(TODAY)) items.push({ id: 'kesz1', kind: 'egyeb', title: 'Októberi dosszié átnézve', dueDate: '2026-11-16', status: 'kesz', overdue: false });
    if (items.length) rows.push({ client: { id: c.id, name: name(c) }, items });
  }
  return { week, prevWeek: isoWeek(addDays(mon, -7)), nextWeek: isoWeek(addDays(mon, 7)), days, rows, overdue };
}

// ---------- router ----------
type Ctx = { q: URLSearchParams; body: Record<string, unknown>; form: FormData | null; p: Record<string, string> };
type H = (x: Ctx) => unknown;
const R: [string, string, H][] = [];
const on = (m: string, path: string, h: H) => R.push([m, path, h]);

on('GET', '/config', () => ({
  brand: { name: 'Kézjegy', tagline: '', subline: '', priceHufMonthlyGross: 20000 },
  appEnv: 'demo',
  demo: true,
  features: { googleSignIn: false, appleSignIn: false, totp: true },
  googleClientIds: {},
  legal: {},
  simplepayMode: 'demo',
}));
on('POST', '/auth/refresh', () => {
  if (role() === 'none') throw new MockError(401, 'unauthenticated', 'Lépj be újra.');
  return authResult();
});
on('POST', '/auth/login', ({ body }) => {
  const email = String(body.email ?? '').toLowerCase();
  if (email === 'admin@demo.kezjegy.test') setRole('admin');
  else if (email === 'anna.nagy@demo.kezjegy.test') setRole('csapat');
  else if (email === BENCE.email) setRole('accountant');
  else if (email.endsWith('@demo.kezjegy.test')) throw new MockError(401, 'invalid_credentials', 'Hibás e-mail-cím vagy jelszó.');
  else throw new MockError(401, 'invalid_credentials', 'Hibás e-mail-cím vagy jelszó.');
  if (totpEnabled) throw new MockError(401, 'mfa_required', 'Kétlépcsős belépés kell.', { mfaToken: 'mock-mfa' });
  return authResult();
});
on('POST', '/auth/login/totp', ({ body }) => {
  if (String(body.code).length < 6) throw new MockError(401, 'invalid_code', 'Nem jó a kód.');
  return authResult();
});
on('POST', '/auth/logout', () => {
  setRole('none');
  return undefined;
});
on('POST', '/auth/password/forgot', () => undefined);
on('POST', '/auth/password/reset', () => undefined);
on('POST', '/auth/password/change', ({ body }) => {
  if (String(body.newPassword).length < 10) throw new MockError(400, 'validation_failed', 'A jelszó legalább 10 karakter legyen.');
  return undefined;
});
on('POST', '/auth/totp/setup', () => ({ secret: 'JBSWY3DPEHPK3PXPJBSWY3DP', otpauthUrl: 'otpauth://totp/K%C3%A9zjegy:demo?secret=JBSWY3DPEHPK3PXPJBSWY3DP&issuer=K%C3%A9zjegy' }));
on('POST', '/auth/totp/enable', () => {
  totpEnabled = true;
  return { recoveryCodes: Array.from({ length: 10 }, (_, i) => `DEMO-${String(1000 + i * 731).slice(-4)}-${String(9000 - i * 377).slice(-4)}`) };
});
on('POST', '/auth/totp/disable', () => {
  totpEnabled = false;
  return undefined;
});
on('GET', '/auth/sessions', () => ({
  items: [
    { id: 's1', clientKind: 'panel', userAgent: 'Chrome, Windows', lastUsedAt: nowIso(), current: true },
    { id: 's2', clientKind: 'panel', userAgent: 'Safari, macOS', lastUsedAt: ts('2026-11-12', '18:20'), current: false },
  ],
}));
on('DELETE', '/auth/sessions/:id', () => undefined);
on('GET', '/me', () => {
  const a = authResult();
  return { user: a.user, staffAccountantId: a.user.role === 'accountant' ? BENCE.id : undefined, teamMember: a.user.role === 'csapat' ? { firstName: ANNA.firstName, displayName: ANNA.name } : undefined, notificationPrefs: [], consentsNeeded: [] };
});

on('POST', '/files/:id/link', ({ p }) => {
  const m = fileMeta.get(p.id!);
  return { url: demoSvg(m?.title ?? 'Irat', m?.kind === 'kyc'), expiresAt: new Date(Date.now() + 300_000).toISOString() };
});
on('GET', '/files/:id', ({ p }) => new Response(new Blob([`MINTA / DEMO fájl (${p.id}). Valódi irat nem tartozik hozzá.\n`], { type: 'text/plain' }), { headers: { 'Content-Disposition': 'attachment; filename="minta_demo.txt"' } }));

// accountant
on('GET', '/acc/clients', ({ q }) => {
  const filter = (q.get('filter') ?? 'mind') as ClientFilter;
  const s = (q.get('q') ?? '').toLowerCase();
  const all = clients.map(row);
  const counts = { mind: all.length, bekotes_alatt: 0, rendben: 0, hianyzik_valami: 0, hatar_kozel: 0, dij_elmaradt: 0 };
  for (const r of all) for (const f of r.flags) counts[f]++;
  const items = all.filter((r) => (filter === 'mind' || r.flags.includes(filter)) && (!s || r.name.toLowerCase().includes(s)));
  return { items, counts };
});
on('GET', '/acc/clients/:id', ({ p }) => detail(byId(p.id!)));
on('POST', '/acc/clients/:id/adoazonosito/reveal', ({ p }) => ({ adoazonositoJel: byId(p.id!).adoazonositoJel }));
on('PATCH', '/acc/clients/:id/tax-profile', ({ p, body }) => {
  const c = byId(p.id!);
  if (!c.taxProfile) throw new MockError(409, 'conflict', 'Még nincs adóprofil.');
  const { activityCode, year: _y, ...rest } = body as Record<string, unknown>;
  c.taxProfile = { ...c.taxProfile, ...(rest as object), costRatioSource: 'konyvelo_megerositette' };
  if (activityCode !== undefined) c.activityCode = (activityCode as string | null) ?? null;
  logAudit('client.profile_updated', c, { taxProfile: true });
  return detail(c);
});
on('POST', '/acc/clients/:id/onboarding/:step', ({ p, body }) => {
  const c = byId(p.id!);
  const s = c.steps.find((x) => x.step === p.step);
  if (!s) throw new MockError(404, 'not_found', 'Nincs ilyen lépés.');
  s.status = body.status as never;
  s.note = (body.note as string) || undefined;
  if (s.status === 'kesz') s.completedAt = nowIso();
  if (c.steps.every((x) => x.status === 'kesz' || x.status === 'kihagyva')) c.lifecycle = 'aktiv';
  return undefined;
});
on('GET', '/acc/clients/:id/kyc', ({ p }) => {
  const c = byId(p.id!);
  if (!c.kycStatus) throw new MockError(404, 'not_found', 'Még nem küldte be.');
  const files = { idFront: uid('f'), idBack: uid('f'), addressFront: uid('f') };
  const titles: Record<string, string> = { idFront: 'Személyi igazolvány, eleje', idBack: 'Személyi igazolvány, hátulja', addressFront: 'Lakcímkártya, címoldal' };
  for (const [k, id] of Object.entries(files)) fileMeta.set(id, { title: titles[k]!, kind: 'kyc' });
  logAudit('kyc.viewed', c);
  return {
    status: c.kycStatus,
    submittedAt: ts('2026-11-12', '09:58'),
    reviewNote: null,
    data: {
      familyName: c.lastName,
      givenName: c.firstName,
      birthName: `${c.lastName} ${c.firstName}`,
      mothersBirthName: 'Minta Mária',
      birthPlace: c.address?.city ?? 'Budapest',
      birthDate: '1990. 01. 01.',
      citizenship: 'magyar',
      address: c.address ? `${c.address.zip} ${c.address.city}, ${c.address.line}` : '–',
      documentType: 'személyazonosító igazolvány',
      documentNumber: '000000XX (DEMO)',
      documentExpiry: '2031. 01. 01.',
    },
    declarations: { ownBehalf: true, pep: false, signedAt: ts('2026-11-12', '09:58') },
    files,
  };
});
on('POST', '/acc/clients/:id/kyc/review', ({ p, body }) => {
  const c = byId(p.id!);
  c.kycStatus = body.status as never;
  const s = c.steps.find((x) => x.step === 'azonositas')!;
  s.status = body.status === 'elfogadva' ? 'kesz' : 'hianyos';
  s.note = (body.note as string) || undefined;
  logAudit('kyc.reviewed', c, { status: body.status });
  return undefined;
});
on('PUT', '/acc/clients/:id/nav-credentials', ({ p, body }) => {
  const c = byId(p.id!);
  c.nav = { ...c.nav, status: 'nincs_ellenorizve', environment: 'demo', loginHint: `${String(body.login).slice(0, 3)}…`, taxNumber: String(body.taxNumber), savedAt: nowIso(), lastTestError: null };
  const s = c.steps.find((x) => x.step === 'nav_bekotes');
  if (s) s.status = 'konyvelore_var';
  logAudit('nav_credentials.saved', c);
  return { status: 'nincs_ellenorizve', loginHint: c.nav.loginHint, savedAt: c.nav.savedAt };
});
on('DELETE', '/acc/clients/:id/nav-credentials', ({ p }) => {
  const c = byId(p.id!);
  c.nav = { ...c.nav, status: 'nincs', loginHint: null, savedAt: null };
  logAudit('nav_credentials.deleted', c);
  return undefined;
});
on('POST', '/acc/clients/:id/nav-credentials/test', ({ p }) => {
  const c = byId(p.id!);
  c.nav = { ...c.nav, status: 'rendben', lastTestAt: nowIso(), lastTestError: null };
  logAudit('nav_credentials.tested', c, { ok: true });
  return { ok: true, messageHu: 'A kapcsolat rendben (DEMO NAV – minta számlákkal).' };
});
on('POST', '/acc/clients/:id/nav-sync', ({ p }) => {
  const c = byId(p.id!);
  const n = navInvoicesFor(c);
  const had = (inv.get(c.id) ?? []).length;
  inv.set(c.id, n.rows);
  revenue.set(c.id, n.revenue);
  c.nav = { ...c.nav, lastSyncAt: nowIso(), lastSyncStatus: 'ok' };
  const s = c.steps.find((x) => x.step === 'nav_bekotes');
  if (s) {
    s.status = 'kesz';
    s.completedAt = nowIso();
  }
  const run: NavSyncRun = { id: uid('run'), startedAt: nowIso(), finishedAt: nowIso(), status: 'ok', digestsSeen: n.rows.length, invoicesNew: n.rows.length - had, errorCode: null };
  runs.set(c.id, [run, ...(runs.get(c.id) ?? [])]);
  logAudit('nav.sync', c, { invoicesNew: run.invoicesNew });
  return { runId: run.id };
});
on('GET', '/acc/clients/:id/nav-sync-runs', ({ p }) => ({ items: runs.get(p.id!) ?? [] }));

on('GET', '/acc/clients/:id/dossiers', ({ p, q }) => {
  const c = byId(p.id!);
  const year = q.get('year') ?? TODAY.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= TODAY.slice(0, 7));
  return {
    months: months.map((m) => {
      const d = (docs.get(c.id) ?? []).filter((x) => x.dossierMonth === m);
      return { month: m, label: HONAP[Number(m.slice(5)) - 1]!, documentCount: d.length, waitingCount: d.filter((x) => x.source === 'ugyfel' && x.status === 'feltoltve').length, navInvoiceCount: (inv.get(c.id) ?? []).filter((i) => i.issueDate.startsWith(m)).length };
    }),
  };
});
on('GET', '/acc/clients/:id/dossiers/:month', ({ p }) => {
  const c = byId(p.id!);
  const m = p.month!;
  const items = (inv.get(c.id) ?? []).filter((i) => i.issueDate.startsWith(m));
  const docList = (docs.get(c.id) ?? []).filter((d) => d.dossierMonth === m).map((d) => ({ ...d, statusLabel: docLabel(d.status) }));
  for (const d of docList) fileMeta.set(d.fileId!, { title: d.title, kind: 'doc' });
  const st = items.length ? (['beadva', 'feldolgozva', 'konyvelo_latta', 'feltoltve'] as DocumentStatus[]).find((s) => items.every((i) => (['feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva'] as DocumentStatus[]).indexOf(i.status) >= (['feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva'] as DocumentStatus[]).indexOf(s))) ?? 'feltoltve' : null;
  return {
    month: m,
    label: HONAP[Number(m.slice(5)) - 1],
    documents: docList,
    navInvoices: { items, totalHuf: items.reduce((a, i) => a + i.grossAmountHuf, 0), status: st },
    revenueItems: (revenue.get(c.id) ?? []).filter((r) => r.receivedOn.startsWith(m)),
    review: m === '2026-10' && c.key === 'kata' ? { at: ts('2026-11-16', '16:40'), okCount: 7, note: 'A tegnapi szerződésre még ránéz.' } : null,
    openRequests: (reqs.get(c.id) ?? []).filter((r) => (r.status === 'nyitott' || r.status === 'folyamatban') && (!r.dossierMonth || r.dossierMonth === m)),
  };
});
on('GET', '/acc/documents/:id', ({ p }) => {
  const { c, d } = findDoc(p.id!);
  if (d.status === 'feltoltve' && d.source === 'ugyfel') {
    d.status = 'konyvelo_latta';
    d.statusAt = nowIso();
    logAudit('document.viewed', c);
  }
  fileMeta.set(d.fileId!, { title: d.title, kind: 'doc' });
  return docDetail(d);
});
on('POST', '/acc/clients/:id/documents', ({ p, form }) => {
  const c = byId(p.id!);
  if (!form) throw new MockError(400, 'validation_failed', 'Hiányzik a fájl.');
  const files = [...form.getAll('file'), ...form.getAll('pages[]')] as File[];
  const d: AccDocument = {
    id: uid('d'),
    title: String(form.get('title') || files[0]?.name || 'Irat'),
    category: String(form.get('category')) as never,
    source: 'konyvelo',
    status: (String(form.get('status') || 'feldolgozva') as DocumentStatus),
    statusLabel: '',
    statusAt: nowIso(),
    dossierMonth: String(form.get('dossierMonth')),
    icon: 'irat',
    pageCount: Math.max(1, files.length),
    visibility: String(form.get('visibility') || 'kozos') as never,
    createdAt: nowIso(),
    createdByRole: 'accountant',
    fileId: uid('f'),
    mime: files[0]?.type || 'application/pdf',
  };
  docs.get(c.id)!.push(d);
  logAudit('document.uploaded', c, { category: d.category });
  return docDetail(d);
});
on('PATCH', '/acc/documents/:id', ({ p, body }) => {
  const { c, d } = findDoc(p.id!);
  if (body.status && body.status !== d.status) {
    d.status = body.status as DocumentStatus;
    d.statusAt = nowIso();
    logAudit('document.status_changed', c, { to: body.status });
  }
  for (const k of ['title', 'category', 'dossierMonth', 'visibility', 'accountantComment'] as const) if (body[k] !== undefined) (d as unknown as Record<string, unknown>)[k] = body[k];
  if (body.amountHuf !== undefined) d.amountHuf = (body.amountHuf as number | null) ?? undefined;
  return docDetail(d);
});
on('POST', '/acc/documents/bulk-status', ({ body }) => {
  for (const id of body.ids as string[]) {
    const { d } = findDoc(id);
    d.status = body.status as DocumentStatus;
    d.statusAt = nowIso();
  }
  return undefined;
});
on('POST', '/acc/clients/:id/nav-invoices/bulk-status', ({ p, body }) => {
  for (const i of inv.get(p.id!) ?? []) if (i.issueDate.startsWith(String(body.month))) i.status = body.status as DocumentStatus;
  return undefined;
});
on('GET', '/acc/clients/:id/nav-invoices', ({ p, q }) => ({ items: (inv.get(p.id!) ?? []).filter((i) => i.issueDate.startsWith(q.get('year') ?? '2026')).sort((a, b) => b.issueDate.localeCompare(a.issueDate)) }));
on('GET', '/acc/nav-invoices/:id', ({ p }) => {
  for (const l of inv.values()) {
    const i = l.find((x) => x.id === p.id);
    if (i) return i;
  }
  throw new MockError(404, 'not_found', 'Nincs ilyen számla.');
});
on('GET', '/acc/clients/:id/revenue', ({ p, q }) => {
  const c = byId(p.id!);
  const year = Number(q.get('year') ?? 2026);
  const items = (revenue.get(c.id) ?? []).filter((r) => r.receivedOn.startsWith(String(year)));
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    const its = items.filter((r) => r.receivedOn.startsWith(m) && r.countsForAtalany && r.receivedOn <= TODAY);
    return { month: i + 1, amountHuf: its.reduce((a, r) => a + r.amountHuf, 0), estimated: its.some((r) => r.receivedOnEstimated) };
  });
  return { year, items, byMonth, totalHuf: byMonth.reduce((a, m) => a + m.amountHuf, 0), meters: c.taxProfile ? meters(c) : null };
});
on('POST', '/acc/clients/:id/revenue-items', ({ p, body }) => {
  const c = byId(p.id!);
  const r: RevenueItem = { id: uid('rev'), source: 'kezi', receivedOn: String(body.receivedOn), receivedOnEstimated: false, deliveryDate: String(body.deliveryDate), amountHuf: Number(body.amountHuf), description: String(body.description), countsForAtalany: true, countsForAfaLimit: true };
  revenue.get(c.id)!.push(r);
  revenue.get(c.id)!.sort((a, b) => a.receivedOn.localeCompare(b.receivedOn));
  return r;
});
function findRev(id: string): { list: RevenueItem[]; r: RevenueItem } {
  for (const list of revenue.values()) {
    const r = list.find((x) => x.id === id);
    if (r) return { list, r };
  }
  throw new MockError(404, 'not_found', 'Nincs ilyen tétel.');
}
on('PATCH', '/acc/revenue-items/:id', ({ p, body }) => {
  const { r } = findRev(p.id!);
  Object.assign(r, body);
  if (body.excludedReason === null) delete r.excludedReason;
  for (const l of inv.values()) for (const i of l) if (i.revenueItemId === r.id) Object.assign(i, { receivedOn: r.receivedOn, receivedOnEstimated: r.receivedOnEstimated });
  return r;
});
on('DELETE', '/acc/revenue-items/:id', ({ p }) => {
  const { list, r } = findRev(p.id!);
  list.splice(list.indexOf(r), 1);
  return undefined;
});
on('GET', '/acc/clients/:id/tax-periods', ({ p, q }) => {
  const c = byId(p.id!);
  const y = Number(q.get('year') ?? 2026);
  return { year: y, items: y === 2026 ? periods.get(c.id) ?? [] : [], defaultLetterText: content.find((x) => x.key === 'ui.tax.letter_default')!.body };
});
on('POST', '/acc/clients/:id/tax-periods/:key/calculate', ({ p }) => {
  const c = byId(p.id!);
  const per = (periods.get(c.id) ?? []).find((x) => x.periodKey === p.key);
  if (!per) throw new MockError(404, 'not_found', 'Nincs ilyen időszak.');
  if (!per.latestCalculation) {
    const all = taxPeriodsFor({ ...c, key: c.key === 'peter' ? 'kata' : c.key } as MockClient);
    if (c.key === 'peter') throw new MockError(409, 'conflict', 'Ezt a negyedévet az előző könyvelő zárta le. Az adatai a Áttekintés fülön, a „Korábbi könyvelő adatai” részben vannak.');
    per.latestCalculation = all.find((x) => x.periodKey === p.key)!.latestCalculation;
  }
  per.latestCalculation = { ...per.latestCalculation!, version: per.latestCalculation!.version + 1, asOf: TODAY };
  per.calcStatus = 'becsles';
  logAudit('tax.calculated', c, { periodKey: per.periodKey });
  return per.latestCalculation;
});
on('POST', '/acc/tax-calculations/:id/approve', ({ p, body }) => {
  const { c, p: per } = findPeriod(p.id!);
  const r = { ...(per.latestCalculation!.result as QuarterResult) };
  const ov = body.overrides as { tbHuf: number; szochoHuf: number; szjaAdvanceHuf: number; reason: string } | undefined;
  if (ov) {
    r.payments = r.payments.map((x) => ({ ...x, amountHuf: x.kind === 'tb_jarulek' ? ov.tbHuf : x.kind === 'szocho' ? ov.szochoHuf : ov.szjaAdvanceHuf }));
    r.totalHuf = ov.tbHuf + ov.szochoHuf + ov.szjaAdvanceHuf;
  }
  per.calcStatus = 'jovahagyva';
  per.paymentStatus = r.totalHuf > 0 ? 'fizetendo' : 'nincs_fizetendo';
  per.totalHuf = r.totalHuf;
  per.items = paymentItems(r, c.adoszam ?? '');
  per.approvedCalculationId = per.latestCalculation!.id;
  per.latestCalculation = { ...per.latestCalculation!, approvedAt: nowIso(), approvedBy: settings.displayName, letterText: String(body.letterText), overrides: ov ?? null };
  per.letter = { greeting: `Kedves ${c.firstName}!`, body: String(body.letterText), signedBy: settings.displayName, signedRole: 'könyvelőd', date: TODAY };
  logAudit('tax.approved', c, { periodKey: per.periodKey, totalHuf: r.totalHuf });
  return per;
});
on('POST', '/acc/tax-periods/:id/reopen', ({ p, body }) => {
  const { c, p: per } = findPeriod(p.id!);
  per.calcStatus = 'becsles';
  per.paymentStatus = 'nincs_fizetendo';
  per.items = [];
  per.letter = null;
  per.totalHuf = (per.latestCalculation!.result as QuarterResult).totalHuf;
  per.latestCalculation = { ...per.latestCalculation!, approvedAt: null, approvedBy: null };
  logAudit('tax.reopened', c, { periodKey: per.periodKey, reason: body.reason });
  return per;
});
on('POST', '/acc/tax-periods/:id/verify-payment', ({ p, body }) => {
  const { c, p: per } = findPeriod(p.id!);
  const list = body.items as { kind: string; verification: 'rendben' | 'elteres' }[];
  for (const it of per.items) {
    const v = list.find((x) => x.kind === it.kind);
    if (v) {
      it.verifiedAt = nowIso();
      it.verification = v.verification;
    }
  }
  per.paymentStatus = list.some((x) => x.verification === 'elteres') ? 'elteres' : 'ellenorizve';
  logAudit('tax.payment_verified', c, { periodKey: per.periodKey });
  return per;
});
on('POST', '/acc/tax-periods/:id/filed', ({ p, body }) => {
  const { c, p: per } = findPeriod(p.id!);
  const list = docs.get(c.id)!;
  const ret = list.find((d) => d.id === body.returnDocumentId);
  const rec = list.find((d) => d.id === body.receiptDocumentId);
  per.filingStatus = 'beadva';
  per.filed = { filedOn: String(body.filedOn), form: '2658', documents: [ret, rec].filter(Boolean).map((d) => ({ ...d!, statusLabel: 'Beadva' })) };
  const q = per.quarter ?? 4;
  for (const d of list) {
    const m = Number(d.dossierMonth.slice(5));
    if (d.dossierMonth.startsWith('2026') && m > (q - 1) * 3 && m <= q * 3 && d.status === 'feldolgozva') d.status = 'beadva';
  }
  logAudit('tax.filed', c, { periodKey: per.periodKey, form: '2658' });
  return per;
});

on('GET', '/acc/requests', ({ q }) => {
  const cid = q.get('clientId');
  const st = q.get('status');
  const out: (RequestSummary & { client: { id: string; name: string } })[] = [];
  for (const c of clients) {
    if (cid && c.id !== cid) continue;
    for (const r of reqs.get(c.id) ?? []) if (!st || r.status === st) out.push({ ...r, client: { id: c.id, name: name(c) } });
  }
  return { items: out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
});
on('POST', '/acc/clients/:id/requests', ({ p, body }) => {
  const c = byId(p.id!);
  const r: RequestSummary = { id: uid('r'), direction: 'konyvelotol', type: body.type as never, title: String(body.title), body: String(body.body ?? ''), status: 'nyitott', statusLabel: 'Nyitott', dueDate: (body.dueDate as string) || undefined, dossierMonth: (body.dossierMonth as string) || undefined, createdAt: nowIso() };
  reqs.get(c.id)!.unshift(r);
  msgs.get(c.id)!.unshift({ id: uid('m'), kind: 'keres_kartya', body: '', sender: 'en', createdAt: nowIso(), attachments: [], request: r });
  logAudit('request.created', c, { type: r.type });
  return r;
});
on('PATCH', '/acc/requests/:id', ({ p, body }) => {
  const { c, r } = findReq(p.id!);
  const lbl: Record<RequestStatus, string> = { nyitott: 'Nyitott', folyamatban: `${settings.firstName} látta, dolgozik rajta`, teljesitve: 'Kész', elutasitva: 'Nem lehetséges', visszavonva: 'Visszavonva' };
  r.status = body.status as RequestStatus;
  r.statusLabel = lbl[r.status];
  if (body.resultDocumentId) r.resultDocumentId = String(body.resultDocumentId);
  logAudit('request.updated', c, { status: r.status });
  return r;
});
on('GET', '/acc/clients/:id/messages', ({ p }) => ({ items: msgs.get(p.id!) ?? [], nextCursor: null }));
on('POST', '/acc/clients/:id/messages', ({ p, body }) => {
  const c = byId(p.id!);
  const m: Message = { id: uid('m'), kind: 'szoveg', body: String(body.body), sender: 'en', createdAt: nowIso(), attachments: ((body.fileIds as string[]) ?? []).map((id) => ({ fileId: id, displayName: 'melléklet.pdf', mime: 'application/pdf' })) };
  msgs.get(c.id)!.unshift(m);
  logAudit('message.sent', c);
  return m;
});
on('POST', '/acc/attachments', () => ({ fileId: uid('f') }));
on('GET', '/acc/message-templates', () => ({ items: templates }));
on('POST', '/acc/message-templates', ({ body }) => {
  const t = { id: uid('t'), title: String(body.title), body: String(body.body), global: false };
  templates.push(t);
  return t;
});
on('PATCH', '/acc/message-templates/:id', ({ p, body }) => {
  const t = templates.find((x) => x.id === p.id)!;
  Object.assign(t, body);
  return t;
});
on('DELETE', '/acc/message-templates/:id', ({ p }) => {
  templates = templates.filter((x) => x.id !== p.id);
  return undefined;
});
on('GET', '/acc/clients/:id/notes', ({ p }) => ({ items: notes.get(p.id!) ?? [] }));
on('POST', '/acc/clients/:id/notes', ({ p, body }) => {
  const n: InternalNote = { id: uid('n'), body: String(body.body), pinned: !!body.pinned, author: settings.displayName, createdAt: nowIso(), updatedAt: nowIso() };
  notes.set(p.id!, [n, ...(notes.get(p.id!) ?? [])]);
  return n;
});
function findNote(id: string): { list: InternalNote[]; n: InternalNote } {
  for (const list of notes.values()) {
    const n = list.find((x) => x.id === id);
    if (n) return { list, n };
  }
  throw new MockError(404, 'not_found', 'Nincs ilyen jegyzet.');
}
on('PATCH', '/acc/notes/:id', ({ p, body }) => {
  const { n } = findNote(p.id!);
  Object.assign(n, body, { updatedAt: nowIso() });
  return n;
});
on('DELETE', '/acc/notes/:id', ({ p }) => {
  const { list, n } = findNote(p.id!);
  list.splice(list.indexOf(n), 1);
  return undefined;
});
on('GET', '/acc/deadline-board', ({ q }) => board(q.get('week') ?? isoWeek(TODAY)));
// SPEC §26.2.9: old rows stay readable, booking is retired (410).
on('GET', '/acc/appointments', () => ({ enabled: false, slots: [], appointments }));
const megszunt = () => {
  throw new MockError(410, 'megszunt_funkcio', 'Időpontot már nem lehet foglalni. Kérj visszahívást.');
};
on('POST', '/acc/availability', megszunt);
on('DELETE', '/acc/availability/:id', megszunt);
on('PATCH', '/acc/appointments/:id', megszunt);
on('GET', '/acc/settings', () => ({ ...settings, appointmentsEnabled: false }));
on('PATCH', '/acc/settings', ({ body }) => {
  Object.assign(settings, body);
  return { ...settings };
});
on('GET', '/acc/export/revenue.csv', ({ q }) => {
  const ids = (q.get('clientIds') ?? '').split(',').filter(Boolean);
  const lines = ['ügyfél;adószám;sorszám;bevétel dátuma;teljesítés;számlaszám/bizonylat;vevő;összeg (Ft);forrás;becsült dátum'];
  for (const c of clients) {
    if (ids.length && !ids.includes(c.id)) continue;
    (revenue.get(c.id) ?? []).filter((r) => r.countsForAtalany).forEach((r, i) => lines.push([name(c), c.adoszam ?? '', i + 1, r.receivedOn, r.deliveryDate, r.description.split(' · ')[0], r.description.split(' · ')[1] ?? '', r.amountHuf, r.source === 'kezi' ? 'kézi' : 'NAV', r.receivedOnEstimated ? 'igen' : 'nem'].join(';')));
  }
  return new Response(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), { headers: { 'Content-Disposition': `attachment; filename="bevetelek_${q.get('year')}_MINTA.csv"` } });
});
on('GET', '/acc/audit', ({ q }) => {
  const cid = q.get('clientId');
  return { items: audit.filter((a) => !cid || a.client?.id === cid), nextCursor: null };
});

// admin
const requireAdmin = () => {
  if (role() !== 'admin') throw new MockError(404, 'not_found', 'Nincs ilyen oldal.');
};
on('GET', '/admin/dashboard', () => {
  requireAdmin();
  const byL = { bekotes_alatt: 0, aktiv: 0, felfuggesztve: 0, megszunt: 0 };
  for (const c of clients) byL[c.lifecycle]++;
  const rev: Record<string, number> = {};
  for (const p of subsPayments) if (p.status === 'FINISHED') rev[p.createdAt.slice(0, 7)] = (rev[p.createdAt.slice(0, 7)] ?? 0) + p.amountHuf;
  const months = Array.from({ length: 11 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  return {
    clients: { total: clients.length, byLifecycle: byL, newThisMonth: clients.filter((c) => c.clientSince >= '2026-11-01').length },
    funnel: { registered: clients.length + 3, onboardingStarted: clients.length + 1, subscribed: clients.filter((c) => c.sub && c.sub.status !== 'incomplete').length, active: byL.aktiv },
    mrrHuf: clients.filter((c) => c.sub?.status === 'active').length * 20000,
    revenueByMonth: months.map((m) => ({ month: m, amountHuf: rev[m] ?? 0 })),
    failedPayments: subsPayments.filter((p) => p.status !== 'FINISHED').length,
    cancellationsThisMonth: 0,
    accountants: [{ id: BENCE.id, name: BENCE.displayName, clients: clients.length, openRequests: [...reqs.values()].flat().filter((r) => r.direction === 'ugyfeltol' && r.status === 'nyitott').length, overdueItems: board(isoWeek(TODAY)).overdue.length }],
    demo: true,
    service: csapat.service(),
  };
});
on('GET', '/admin/clients', ({ q }) => {
  requireAdmin();
  const st = q.get('status');
  const s = (q.get('q') ?? '').toLowerCase();
  return {
    items: clients
      .filter((c) => (!st || c.lifecycle === st) && (!s || `${name(c)} ${c.email}`.toLowerCase().includes(s)))
      .map((c) => {
        const tilt = exportLetiltva(c.id);
        return { id: c.id, name: name(c), email: c.email, lifecycle: c.lifecycle, accountant: { id: BENCE.id, name: BENCE.displayName }, subscriptionStatus: c.sub?.status ?? null, source: c.source, referralCode: c.referralCode, createdAt: c.createdAt, disabled: !!tilt, disabledAt: tilt?.at ?? null, disabledReason: tilt?.reason ?? null };
      }),
    nextCursor: null,
  };
});
on('PATCH', '/admin/clients/:id', ({ p }) => {
  requireAdmin();
  logAudit('admin.client_reassigned', byId(p.id!));
  return undefined;
});
on('GET', '/admin/subscriptions', ({ q }) => {
  requireAdmin();
  const st = q.get('status');
  return {
    items: clients
      .filter((c) => c.sub && (!st || c.sub.status === st))
      .map((c) => ({
        id: `sub-${c.id}`,
        client: { id: c.id, name: name(c) },
        status: c.sub!.status,
        mode: 'demo',
        priceHuf: 20000,
        currentPeriodEnd: c.sub!.nextChargeAt?.slice(0, 10) ?? null,
        nextChargeAt: c.sub!.nextChargeAt,
        failedAttempts: c.sub!.failedAttempts,
        lastFailureCode: c.sub!.lastFailureCode,
        graceUntil: c.sub!.graceUntil,
        cancelAtPeriodEnd: c.sub!.cancelAtPeriodEnd,
        card: c.sub!.cardMask ? { mask: c.sub!.cardMask, status: 'aktiv', tokensLeft: c.sub!.tokensLeft, expiry: '2028-09-30' } : null,
      })),
  };
});
on('POST', '/admin/subscriptions/:id/retry', ({ p }) => {
  requireAdmin();
  const c = byId(p.id!.replace(/^sub-/, ''));
  c.sub!.status = 'active';
  c.sub!.failedAttempts = 0;
  c.sub!.graceUntil = null;
  subsPayments.unshift({ id: uid('pay'), orderRef: `KJ-20261117-RETRY${uid('r').toUpperCase().slice(-5)}`, client: { id: c.id, name: name(c) }, kind: 'ismetlodo', amountHuf: 20000, status: 'FINISHED', createdAt: nowIso(), finishedAt: nowIso(), errorCodes: [], mode: 'demo' });
  return undefined;
});
on('POST', '/admin/subscriptions/:id/cancel', ({ p }) => {
  requireAdmin();
  byId(p.id!.replace(/^sub-/, '')).sub!.cancelAtPeriodEnd = true;
  return undefined;
});
on('GET', '/admin/payments', ({ q }) => {
  requireAdmin();
  const st = q.get('status');
  const from = q.get('from');
  const to = q.get('to');
  return {
    items: subsPayments.filter((p) => (!st || (st === 'failed' ? p.status !== 'FINISHED' : p.status === 'FINISHED')) && (!from || p.createdAt.slice(0, 10) >= from) && (!to || p.createdAt.slice(0, 10) <= to)),
  };
});
on('GET', '/admin/accountants', () => ({
  items: [
    {
      id: BENCE.id,
      displayName: settings.displayName,
      firstName: settings.firstName,
      title: settings.title,
      email: BENCE.email,
      registrationNumber: settings.registrationNumber,
      clients: clients.length,
      capacity: settings.capacity,
      openRequests: [...reqs.values()].flat().filter((r) => r.direction === 'ugyfeltol' && r.status === 'nyitott').length,
      overdueItems: board(isoWeek(TODAY)).overdue.length,
      waitingDocuments: [...docs.values()].flat().filter((d) => d.source === 'ugyfel' && d.status === 'feltoltve').length,
      active: true,
      appointmentsEnabled: settings.appointmentsEnabled,
      nameForms: BENCE.nameForms,
    },
  ],
}));
on('POST', '/admin/accountants', () => {
  requireAdmin();
  return undefined;
});
on('PATCH', '/admin/accountants/:id', () => undefined);
on('GET', '/admin/referral-codes', () => {
  requireAdmin();
  return { items: referral };
});
on('POST', '/admin/referral-codes', ({ body }) => {
  requireAdmin();
  if (referral.some((r) => r.code === body.code)) throw new MockError(409, 'conflict', 'Ilyen kód már van.');
  const r: ReferralCodeRow = { id: uid('rc'), code: String(body.code), ownerClient: null, campaign: (body.campaign as string) ?? null, note: (body.note as string) ?? null, active: true, signups: 0, paying: 0, createdAt: nowIso() };
  referral.unshift(r);
  return r;
});
on('PATCH', '/admin/referral-codes/:id', ({ p, body }) => {
  const r = referral.find((x) => x.id === p.id)!;
  Object.assign(r, body);
  return r;
});
on('GET', '/admin/attribution', () => {
  requireAdmin();
  return {
    rows: [
      { source: 'facebook', medium: 'cpc', campaign: 'osz_2025', code: null, signups: 3, paying: 2 },
      { source: 'google', medium: 'organic', campaign: null, code: null, signups: 2, paying: 1 },
      { source: 'instagram', medium: 'cpc', campaign: 'tavasz', code: null, signups: 1, paying: 1 },
      { source: null, medium: null, campaign: null, code: 'KATA7Q2X', signups: 1, paying: 1 },
      { source: null, medium: null, campaign: null, code: null, signups: 3, paying: 1 },
    ],
  };
});
on('GET', '/admin/content-texts', () => {
  requireAdmin();
  return { items: content };
});
on('PUT', '/admin/content-texts/:key', ({ p, body }) => {
  requireAdmin();
  const c = content.find((x) => x.key === decodeURIComponent(p.key!))!;
  c.body = String(body.body);
  c.updatedAt = nowIso();
  c.updatedBy = 'Demo Tulajdonos';
  c.version++;
  return c;
});
on('GET', '/admin/faq', () => ({ items: faq }));
on('POST', '/admin/faq', ({ body }) => {
  const f = { id: uid('q'), question: String(body.question), answer: String(body.answer), sort: Number(body.sort), published: !!body.published };
  faq.push(f);
  return f;
});
on('PATCH', '/admin/faq/:id', ({ p, body }) => {
  const f = faq.find((x) => x.id === p.id)!;
  Object.assign(f, body);
  return f;
});
on('DELETE', '/admin/faq/:id', ({ p }) => {
  faq = faq.filter((x) => x.id !== p.id);
  return undefined;
});
on('GET', '/admin/audit', ({ q }) => {
  requireAdmin();
  const a = q.get('action');
  return { items: audit.filter((x) => !a || x.action === a), nextCursor: null };
});
on('GET', '/admin/demo-outbox', () => {
  requireAdmin();
  return { items: OUTBOX };
});
on('GET', '/admin/system', () => {
  requireAdmin();
  return {
    appEnv: 'demo',
    version: '0.1.0-minta',
    modes: { nav: 'demo', simplepay: 'demo', mail: 'demo', push: 'demo', invoice: 'demo' },
    googleSignIn: false,
    appleSignIn: false,
    staffTotpRequired: false,
    workerHeartbeatAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    lastNavSync: { at: ts(TODAY, '05:30'), ok: 6, failed: 0 },
    backupAgeHours: 7,
    db: 'ok',
  };
});

// ---------- SPEC §26: team endpoints (callbacks, pipeline, team threads, staff) ----------
const csapat = installCsapat({
  on,
  clients,
  msgs,
  role,
  nowIso,
  hiba: (status, code, msg, extra) => new MockError(status, code, msg, extra ?? {}),
  fileMeta,
  logAudit,
  milestone: (c) => (c.lifecycle === 'bekotes_alatt' ? (milestones(c).find((m) => m.current)?.key ?? null) : null),
});
// SPEC §27: "Intézzük helyette", the staff branch change, admin client block (mock/helyettunk.ts).
installHelyettunk({
  on,
  clients,
  role,
  nowIso,
  hiba: (status, code, msg, extra) => new MockError(status, code, msg, extra ?? {}),
  logAudit,
  fileMeta,
  kieg: csapat.kieg,
  belso: csapat.belso,
});
/** SPEC §26.4: the service team gets 404 on accountant and owner endpoints (the API enforces the same). */
function tiltott(path: string): boolean {
  const r = role();
  if (r === 'csapat') return path.startsWith('/acc/') || path.startsWith('/admin/');
  return false;
}

function match(method: string, path: string): { h: H; p: Record<string, string> } | null {
  const segs = path.split('/').filter(Boolean);
  for (const [m, pat, h] of R) {
    if (m !== method) continue;
    const ps = pat.split('/').filter(Boolean);
    if (ps.length !== segs.length) continue;
    const p: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i]!.startsWith(':')) p[ps[i]!.slice(1)] = decodeURIComponent(segs[i]!);
      else if (ps[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { h, p };
  }
  return null;
}

export function installMock(): void {
  setTodayOverride(TODAY);
  try {
    const r = new URLSearchParams(location.search).get('mock_role');
    if (r) setRole(r);
  } catch {
    /* ignore */
  }
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
    if (!url.pathname.startsWith('/api/v1/')) return orig(input, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.slice('/api/v1'.length);
    await new Promise((r) => setTimeout(r, 40));
    const m = tiltott(path) ? null : match(method, path);
    const json = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (!m) return json(404, { error: { code: 'not_found', message: `MINTA: nincs ilyen végpont (${method} ${path}).` } });
    let body: Record<string, unknown> = {};
    let form: FormData | null = null;
    if (init?.body instanceof FormData) form = init.body;
    else if (typeof init?.body === 'string' && init.body) body = JSON.parse(init.body) as Record<string, unknown>;
    try {
      const out = m.h({ q: url.searchParams, body, form, p: m.p });
      if (out instanceof Response) return out;
      return out === undefined ? new Response(null, { status: 204 }) : json(200, out);
    } catch (e) {
      if (e instanceof MockError) return json(e.status, { error: { code: e.code, message: e.message }, ...e.extra });
      console.error('[mock]', e);
      return json(500, { error: { code: 'internal', message: 'MINTA: belső hiba.' } });
    }
  };
}
