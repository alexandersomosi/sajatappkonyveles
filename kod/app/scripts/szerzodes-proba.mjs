#!/usr/bin/env node
// Szerződés-próba: a valódi backend (helyi-proba.mjs) végpontjai azt adják-e, amire az app épít (SPEC §12.4 + §24).
// Használat: node scripts/szerzodes-proba.mjs <demo_belepesek.txt> [http://127.0.0.1:8791]
// A jelszót a fájlból olvassa, és SEHOL nem írja ki.
import { readFileSync } from 'node:fs';

const [, , fajl, alap = 'http://127.0.0.1:8791'] = process.argv;
const sorok = readFileSync(fajl, 'utf8').split('\n').filter((s) => s.startsWith('ugyfel;kata.'));
const [, email, jelszo] = sorok[0].trim().split(';');
const API = `${alap}/api/v1`;
let token = '';
const hibak = [];
const ok = [];

async function h(method, ut, body) {
  const r = await fetch(API + ut, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  return { status: r.status, j };
}
function vart(nev, felt, info = '') {
  (felt ? ok : hibak).push(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? ' – ' + info : ''}`);
}
const kulcsok = (o, ks) => ks.filter((k) => !(o && k in o));

const login = await h('POST', '/auth/login', { email, password: jelszo, clientKind: 'native' });
vart('POST /auth/login', login.status === 200 && login.j.accessToken && login.j.refreshToken, `status ${login.status}`);
token = login.j.accessToken;

const cfg = await h('GET', '/config');
vart('GET /config', cfg.status === 200 && !kulcsok(cfg.j, ['brand', 'demo', 'features', 'legal', 'simplepayMode']).length, kulcsok(cfg.j, ['brand', 'demo', 'features', 'legal', 'simplepayMode']).join(','));

const me = await h('GET', '/me');
vart('GET /me', me.status === 200 && me.j.user && me.j.accountant, `status ${me.status}`);

const home = await h('GET', '/client/home');
const hk = kulcsok(home.j, ['today', 'demo', 'client', 'accountant', 'hero', 'letter', 'paymentItems', 'requestsFromAccountant', 'limits', 'revenueByMonth', 'currentDossier', 'nextDeadline']);
vart('GET /client/home', home.status === 200 && !hk.length, hk.join(',') || `hero=${home.j?.hero?.state} ${home.j?.hero?.amountHuf} items=${home.j?.paymentItems?.length}`);
vart('  accountant.nameForms/signature', !!home.j?.accountant?.nameForms?.onto && typeof home.j?.accountant?.signatureSvgPath === 'string');
vart('  limits.afa.sentence', typeof home.j?.limits?.afa?.sentence === 'string', home.j?.limits?.afa?.sentence);

if (home.j?.hero?.periodId) {
  const p = await h('GET', `/client/tax-periods/${home.j.hero.periodId}`);
  const pk = kulcsok(p.j, ['id', 'periodKey', 'label', 'dueDate', 'calcStatus', 'paymentStatus', 'items', 'explanation', 'letter']);
  vart('GET /client/tax-periods/:id', p.status === 200 && !pk.length, pk.join(','));
  vart('  explanation.lines[].kind', Array.isArray(p.j?.explanation?.lines) && p.j.explanation.lines.some((l) => l.kind), `${p.j?.explanation?.lines?.length} sor`);
}

const ds = await h('GET', '/client/dossiers?year=2026');
vart('GET /client/dossiers', ds.status === 200 && Array.isArray(ds.j?.months), `${ds.j?.months?.length} hónap`);
const d = await h('GET', '/client/dossiers/2026-10');
const dk = kulcsok(d.j, ['month', 'label', 'headline', 'sentByMe', 'fromNav', 'filedByAccountant', 'openRequests']);
vart('GET /client/dossiers/2026-10', d.status === 200 && !dk.length, dk.join(',') || d.j?.headline);
const irat = d.j?.sentByMe?.[0];
if (irat) {
  const dd = await h('GET', `/client/documents/${irat.id}`);
  vart('GET /client/documents/:id', dd.status === 200 && Array.isArray(dd.j?.history) && Array.isArray(dd.j?.versions), `${irat.title}: ${dd.j?.statusLabel}`);
  if (dd.j?.versions?.[0]) {
    const l = await h('POST', `/files/${dd.j.versions[0].fileId}/link`, {});
    vart('POST /files/:id/link', l.status === 200 && typeof l.j?.url === 'string', l.j?.url?.slice(0, 30));
  }
}
const nav = await h('GET', '/client/nav-invoices?month=2026-10');
vart('GET /client/nav-invoices', nav.status === 200 && Array.isArray(nav.j?.items), `${nav.j?.items?.length} db`);
if (nav.j?.items?.[0]) {
  const n1 = await h('GET', `/client/nav-invoices/${nav.j.items[0].id}`);
  vart('GET /client/nav-invoices/:id', n1.status === 200 && (n1.j?.invoice?.lines || n1.j?.lines), Object.keys(n1.j ?? {}).join(','));
}
const msg = await h('GET', '/client/messages?limit=50');
vart('GET /client/messages', msg.status === 200 && Array.isArray(msg.j?.items), `${msg.j?.items?.length} db, sender: ${[...new Set((msg.j?.items ?? []).map((m) => m.sender))].join('/')}`);
const req = await h('GET', '/client/requests');
vart('GET /client/requests', req.status === 200 && Array.isArray(req.j?.items), (req.j?.items ?? []).map((r) => `${r.direction}:${r.statusLabel}`).join(' | '));
const dl = await h('GET', '/client/deadlines');
vart('GET /client/deadlines', dl.status === 200 && Array.isArray(dl.j?.items), `${dl.j?.items?.length} db`);
const sub = await h('GET', '/client/subscription');
vart('GET /client/subscription', sub.status === 200 && sub.j?.status, `${sub.j?.status} ${sub.j?.mode} ${sub.j?.card?.mask}`);
const fee = await h('GET', '/client/fee-invoices');
vart('GET /client/fee-invoices', fee.status === 200 && Array.isArray(fee.j?.items), `${fee.j?.items?.length} db`);
const ert = await h('GET', '/me/notifications');
vart('GET /me/notifications', ert.status === 200 && Array.isArray(ert.j?.items), `${ert.j?.items?.length} db`);
const prof = await h('GET', '/client/profile');
vart('GET /client/profile', prof.status === 200 && prof.j?.adoazonositoJelMasked, prof.j?.adoazonositoJelMasked);
const onb = await h('GET', '/client/onboarding');
vart('GET /client/onboarding', onb.status === 200 && Array.isArray(onb.j?.milestones), `onyaGuide: ${onb.j?.onyaGuide ? 'van' : 'nincs'}`);
const slots = await h('GET', '/client/appointments/slots');
vart('GET /client/appointments/slots', slots.status === 200 && typeof slots.j?.enabled === 'boolean', `${slots.j?.slots?.length} szabad`);
const ses = await h('GET', '/auth/sessions');
vart('GET /auth/sessions', ses.status === 200, Array.isArray(ses.j) ? 'tömb' : 'items');
const faq = await h('GET', '/content/faq');
vart('GET /content/faq', faq.status === 200 && faq.j?.items?.length > 0, `${faq.j?.items?.length} kérdés`);
const leg = await h('GET', '/legal/aszf');
vart('GET /legal/aszf', leg.status === 200 && typeof leg.j?.markdown === 'string', leg.j?.title);
const rev = await h('GET', '/client/revenue?year=2026');
vart('GET /client/revenue', rev.status === 200, `${rev.j?.byMonth?.length} hónap`);
const kesz = await h('POST', '/client/messages', { body: 'Próbaüzenet a szerződés-próbából.' });
vart('POST /client/messages', kesz.status === 200 || kesz.status === 201, `sender=${kesz.j?.sender}`);
const kr = await h('POST', '/client/requests', { type: 'nullas_igazolas', body: 'Pályázathoz', certificate: { certificateType: 'nullas_igazolas', purpose: 'pályázat', language: 'hu' } });
vart('POST /client/requests', kr.status === 200 || kr.status === 201, `${kr.j?.title} – ${kr.j?.statusLabel}`);
const exp = await h('POST', '/me/export', {});
vart('POST /me/export', exp.status === 202 || exp.status === 200, JSON.stringify(exp.j));
const exps = await h('GET', '/me/exports');
vart('GET /me/exports', exps.status === 200, JSON.stringify(exps.j).slice(0, 120));

console.log(ok.join('\n'));
if (hibak.length) {
  console.log(hibak.join('\n'));
  process.exit(1);
}
