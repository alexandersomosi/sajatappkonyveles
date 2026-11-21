import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Public / system routes (SPEC §12.1) incl. the SimplePay IPN, back URL and the DEMO pay page.
import { asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import brand from '../_shared/brand.json' with { type: 'json' };
import { LEGAL_DOC_TYPES, type LegalDocType } from '../_shared/enums.js';
import type { PublicConfig } from '../_shared/api.js';
import { FEE_KIND_LABELS } from '../_shared/bekotes.js';
import { fmt as fmtHuf } from '../services/kedvezmeny.js';
import type { Deps } from '../deps.js';
import { cardRegistrations, faqItems, feeCharges, simplepayTransactions } from '../db/schema.js';
import type { Env } from '../http/core.js';
import { E } from '../lib/errors.js';
import { fillLegalPublic, legalValues } from '../legal.js';
import { paymentModeOf } from '../config.js';
import { todayBudapest } from '../lib/dates.js';
import { decodeBack, spSign, spTime, spVerify, salt } from '../payments/simplepay.js';
import { DEMO_MERCHANT, handleIpn, IPN_BAD_PER_HOUR, tokenInfoSentence } from '../services/subscription.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function publicRoutes(deps: Deps) {
  const r = new Hono<Env>();

  r.get('/health', async (c) => {
    let db: 'ok' | 'hiba' = 'ok';
    try {
      await deps.db.execute(sql`select 1`);
    } catch {
      db = 'hiba';
    }
    // Anonymous callers get the minimum (ok, version, db): the integration modes and the environment are listed on
    // the admin "Rendszer" page (GET /admin/system), not for the whole internet (round 1, 2026-11-19).
    return c.json({ ok: db === 'ok', version: deps.cfg.version, db }, db === 'ok' ? 200 : 503);
  });

  r.get('/config', async (c) => {
    const cfg = deps.cfg;
    // k7c2: the price the server really charges (fee_settings 'havidij'), never a drifting env value
    const { planAmountHuf } = await import('../services/dijak.js');
    const price = await planAmountHuf(deps, deps.db, 'havi');
    const body: PublicConfig = {
      brand: { name: brand.name, tagline: brand.tagline, subline: brand.subline, priceHufMonthlyGross: price },
      appEnv: cfg.appEnv,
      demo: cfg.appEnv === 'demo',
      features: { googleSignIn: cfg.google.clientIds.length > 0, appleSignIn: Boolean(cfg.appleBundleId), totp: true },
      googleClientIds: { web: cfg.google.web, android: cfg.google.android, ios: cfg.google.ios },
      legal: deps.legal.versions(),
      simplepayMode: cfg.simplepay.mode === 'disabled' ? 'live' : cfg.simplepay.mode,
      mediaBaseUrl: cfg.mediaBaseUrl,
      newBusinessChargePolicy: cfg.newBusinessChargePolicy,
    };
    c.header('Cache-Control', 'public, max-age=60');
    // k8: may a NEW client choose the bank transfer (switch kapcsolok.fizetes.atutalas and an invoicing route)?
    const { fizetesKapcsolok, transferRoute } = await import('../services/atutalas.js');
    const fizetes = { atutalas: (await fizetesKapcsolok(deps, deps.db)).atutalas && transferRoute(cfg) !== null };
    // SPEC §29.14: the payment provider of new card flows (+ simplepayEnabled kept for old app builds)
    return c.json({ ...body, paymentProvider: cfg.payment.provider, paymentMode: paymentModeOf(cfg), simplepayEnabled: cfg.payment.provider !== 'disabled', fizetes });
  });

  r.get('/legal/:docType', async (c) => {
    const t = c.req.param('docType') as LegalDocType;
    if (!(LEGAL_DOC_TYPES as readonly string[]).includes(t) || t === 'adatfeldolgozoi') throw E.notFound();
    const d = deps.legal.current(t);
    const values = { ...(await legalValues(deps)), 'dok.verzio': d.version, 'dok.hatalyos': d.effectiveFrom ?? d.version };
    // Short cache: the recurring-payment declaration names a date ("2027. november 18-ig").
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ docType: t, version: d.version, title: d.title, markdown: fillLegalPublic(d.markdown, values) });
  });

  r.get('/content/faq', async (c) => {
    const rows = await deps.db.select().from(faqItems).where(eq(faqItems.published, true)).orderBy(asc(faqItems.sort));
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ items: rows.map((f) => ({ id: f.id, question: f.question, answer: f.answer })) });
  });

  // ---------- SimplePay ----------
  r.post('/webhooks/simplepay/ipn', async (c) => {
    // An IP that sent many badly signed IPNs is refused before reading the body (SimplePay's own IPNs are signed).
    const bad = deps.limiter.peek(`ipn-bad:${c.get('ipHmac') ?? '-'}`, IPN_BAD_PER_HOUR);
    if (!bad.ok) {
      c.header('Retry-After', String(Math.ceil(bad.retryAfterSec)));
      return c.json({ error: 'rate_limited' }, 429);
    }
    const raw = await c.req.text();
    if (raw.length > 64 * 1024) return c.json({ error: 'too_large' }, 413);
    const reply = await handleIpn(deps, raw, c.req.header('signature'), { ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    if (reply.signature) c.header('Signature', reply.signature);
    c.header('Content-Type', 'application/json');
    return c.body(reply.body, reply.status);
  });

  r.get('/payments/simplepay/back', async (c) => {
    const p = c.req.query('p') === 'app' ? 'app' : 'web';
    const rq = c.req.query('r') ?? '';
    const s = c.req.query('s') ?? '';
    const decoded = decodeBack(rq);
    const secret = deps.cfg.simplepay.mode === 'demo' ? deps.cfg.simplepay.demoSecret : deps.cfg.simplepay.secret;
    let event = 'FAIL';
    let t = '';
    if (decoded && secret && spVerify(secret, decoded.json, s)) {
      event = ['SUCCESS', 'FAIL', 'CANCEL', 'TIMEOUT'].includes(decoded.e) ? decoded.e : 'FAIL';
      t = String(decoded.t ?? '');
    }
    const qs = `eredmeny=${encodeURIComponent(event)}&t=${encodeURIComponent(t)}`;
    const target = p === 'app' ? `kezjegy://elofizetes/eredmeny?e=${encodeURIComponent(event)}&t=${encodeURIComponent(t)}` : `${deps.cfg.appPublicUrl}/fiok/elofizetes?${qs}`;
    return c.redirect(target, 302);
  });

  // ---------- DEMO pay page (SPEC §9.7) ----------
  r.get('/payments/demo/pay', async (c) => {
    if (deps.cfg.simplepay.mode !== 'demo') throw E.notFound();
    const o = c.req.query('o') ?? '';
    const [t] = await deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, o)).limit(1);
    if (!t || t.mode !== 'demo') throw E.notFound();
    const [reg] = t.cardRegistrationId ? await deps.db.select().from(cardRegistrations).where(eq(cardRegistrations.id, t.cardRegistrationId)).limit(1) : [];
    // k6c2: a one-off fee (change, annual closing) is not the monthly fee and carries no card-token sentence
    const [fee] = t.kind === 'egyszeri' ? await deps.db.select({ kind: feeCharges.kind }).from(feeCharges).where(eq(feeCharges.simplepayTransactionId, t.id)).limit(1) : [];
    const heading = fee ? (FEE_KIND_LABELS[fee.kind] ?? 'díj') : 'havidíj';
    const sentence = t.kind === 'egyszeri' ? 'Egyszeri díj: csak ezt az összeget vonjuk le, a kártyádat nem mentjük el.' : await tokenInfoSentence(deps, deps.cfg.simplepay.recurringTimes, t.amountHuf, reg?.tokensUntil ?? deps.now());
    const amount = `${fmtHuf(t.amountHuf)} Ft`;
    const done = Boolean(t.appliedAt);
    // form-action also governs the redirects after the submit (→ /back → app host or the kezjegy:// deep link),
    // and in production the API and the web app are different hosts, so both targets must be listed.
    const appOrigin = new URL(deps.cfg.appPublicUrl).origin;
    // Round-2 owner finding 7: "Geist only" – the font is embedded (data: URI; the CSP allows exactly that).
    c.header('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; font-src data:; form-action 'self' ${appOrigin} kezjegy:; frame-ancestors 'none'`);
    const geist = geistFaces(deps.cfg.fontDir);
    return c.html(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DEMO fizetés</title>
<style>${geist}body{margin:0;background:#E4E8F3;font-family:Geist,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-variant-numeric:tabular-nums;color:#10152B}main{max-width:440px;margin:0 auto;padding:16px}
.b{background:#B42318;color:#fff;font-weight:700;padding:14px 16px;border-radius:12px;font-size:15px;line-height:1.4}.s{background:#fff;border-radius:18px;padding:20px;margin-top:14px}
h1{font-size:22px;margin:0 0 6px}.a{font-size:34px;font-weight:800;margin:10px 0}p{line-height:1.5}button{width:100%;min-height:48px;border-radius:999px;border:0;font-size:16px;font-weight:600;margin-top:10px;cursor:pointer}
.ok{background:#1428DB;color:#fff}.no{background:#fff;color:#1226B8;border:2px solid #1428DB}small{color:#505873}</style></head><body><main>
<div class="b">DEMO FIZETÉS – nem valódi kártya, nem vonunk le pénzt.</div>
<div class="s"><h1>${esc(brand.name)} – ${esc(heading.toLowerCase())}</h1><div class="a">${esc(amount)}</div>
<p>${esc(sentence)}</p><p><small>Rendelés: ${esc(t.orderRef)}</small></p>
${done ? `<p><strong>Ez a fizetés már lezárult (${esc(t.status)}).</strong></p>` : `<form method="post" action="/api/v1/payments/demo/pay"><input type="hidden" name="o" value="${esc(t.orderRef)}"><input type="hidden" name="eredmeny" value="ok"><button class="ok" type="submit">Sikeres fizetés szimulálása</button></form>
<form method="post" action="/api/v1/payments/demo/pay"><input type="hidden" name="o" value="${esc(t.orderRef)}"><input type="hidden" name="eredmeny" value="fail"><button class="no" type="submit">Sikertelen fizetés szimulálása</button></form>`}
</div></main></body></html>`);
  });

  r.post('/payments/demo/pay', async (c) => {
    if (deps.cfg.simplepay.mode !== 'demo') throw E.notFound();
    const form = await c.req.parseBody();
    const o = String(form.o ?? '');
    const ok = String(form.eredmeny ?? '') === 'ok';
    const [t] = await deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, o)).limit(1);
    if (!t || t.mode !== 'demo') throw E.notFound();
    const tid = t.simplepayTransactionId ?? 500_000_000 + Math.floor(Math.random() * 99_999_999);
    if (!t.appliedAt) {
      const now = deps.now();
      const body = {
        salt: salt(),
        orderRef: t.orderRef,
        method: 'CARD',
        merchant: DEMO_MERCHANT,
        finishDate: spTime(now),
        paymentDate: spTime(now),
        transactionId: tid,
        status: ok ? 'FINISHED' : 'NOTAUTHORIZED',
        ...(ok && t.kind === 'regisztracio' ? { cardMask: 'xxxx-xxxx-xxxx-4242', expiry: `${now.getUTCFullYear() + 3}-12-31T00:00:00+01:00` } : {}),
      };
      const raw = JSON.stringify(body);
      await handleIpn(deps, raw, spSign(deps.cfg.simplepay.demoSecret, raw), { ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    }
    const back = JSON.stringify({ r: ok ? 0 : 1, t: tid, e: ok ? 'SUCCESS' : 'FAIL', m: DEMO_MERCHANT, o: t.orderRef });
    const rParam = Buffer.from(back, 'utf8').toString('base64');
    const sParam = spSign(deps.cfg.simplepay.demoSecret, back);
    const p = t.platform === 'app' ? 'app' : 'web';
    return c.redirect(`/api/v1/payments/simplepay/back?p=${p}&r=${encodeURIComponent(rParam)}&s=${encodeURIComponent(sParam)}`, 303);
  });

  return r;
}

let geistCss: { dir: string; css: string } | null = null;
/** @font-face rules with Geist Regular + SemiBold as data: URIs (read once; empty when the files are missing). */
function geistFaces(fontDir: string): string {
  if (geistCss?.dir === fontDir) return geistCss.css;
  let css = '';
  try {
    const face = (file: string, weight: string) =>
      `@font-face{font-family:Geist;font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${readFileSync(join(fontDir, file)).toString('base64')}) format('truetype')}`;
    css = face('Geist-Regular.ttf', '100 500') + face('Geist-SemiBold.ttf', '600 900');
  } catch {
    css = '';
  }
  geistCss = { dir: fontDir, css };
  return css;
}
