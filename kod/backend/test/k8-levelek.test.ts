// k8 ALAP-B – the new mail template on EVERY system mail (dizajn/email/sablon.html): every email.* content key renders;
// "Adózz.hu" is always a whole, explicit link (mail clients otherwise link "zz.hu"); user data is escaped; at most one
// button (+ the Outlook VML button); no pale pastel box; the code block; the staff footer; the DEMO outbox keeps the HTML
// image and the panel opens it through a signed 5-minute link with a strict CSP.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_TEXTS, fill } from '../src/content.js';
import { demoOutbox, notifications, users } from '../src/db/schema.js';
import { createMailer, htmlOfMail } from '../src/notify/mailer.js';
import { dispatchPending, notify, sendCodeEmail } from '../src/notify/notify.js';
import { blokkHtml, lablecOfTemplate, levelFromText, renderLevel } from '../src/notify/sablon.js';
import { setup, staff, type Harness } from './helpers.js';

/** Every "Adózz.hu" outside the explicit brand link, the <title>, the hidden preview line and the logo's alt text. */
function looseBrand(html: string): number {
  const stripped = html
    // a whole link whose text is exactly "Adózz.hu" (our brand link, or a link the text itself is)
    .replace(/<a href="[^"]*" style="[^"]*">Adózz\.hu<\/a>/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<div style="display:none;[\s\S]*?<\/div>/, '')
    .replace(/alt="Adózz\.hu"/g, '');
  return (stripped.match(/Adózz\.hu/g) ?? []).length;
}

const PARAMS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, k) => (typeof k === 'string' ? (k === 'code' ? '482913' : k.toLowerCase().includes('url') || k === 'link' ? 'https://app.adozz.hu/fiok' : `«${k}»`) : undefined),
  has: () => true,
});

describe('the template renderer', () => {
  it('every email.* subject/body renders into the template: brand link rule, no placeholder left, ≤ 1 button', () => {
    const bodies = Object.keys(DEFAULT_TEXTS).filter((k) => /^email\..+\.body$/.test(k));
    expect(bodies.length).toBeGreaterThan(40);
    for (const k of bodies) {
      const base = k.slice(0, -'.body'.length);
      const subject = fill(DEFAULT_TEXTS[`${base}.subject`] ?? 'Tárgy', PARAMS);
      const text = `${fill(DEFAULT_TEXTS[k]!, PARAMS)}\n\nEzt az Adózz.hu küldte.`;
      const html = renderLevel(levelFromText(subject, text, { lablec: lablecOfTemplate(base.slice('email.'.length)), gombSzoveg: 'Megnyitom' }));
      expect(looseBrand(html), k).toBe(0);
      expect(html, k).not.toMatch(/\{\{\w+\}\}/);
      expect((html.match(/bgcolor="#FFC93C"/g) ?? []).length, k).toBeLessThanOrEqual(1);
      expect(html, k).toContain('https://adozz.hu/email/logo_feher@2x.png');
    }
  });
  it('escapes user data everywhere; the brand link never inside another link; one button with the VML twin', () => {
    const html = renderLevel({
      cim: 'Szia <b>Adózz.hu</b>!',
      blokkok: [{ t: 'p', s: 'Név: <script>alert(1)</script> & "x" – az Adózz.hu-n' }, { t: 'kv', sorok: [['Összeg', '19 999 Ft', true], ['Közlemény', 'ADZ-1<i>']] }, { t: 'link', s: 'Adózz.hu', href: 'https://adozz.hu/?a=1&b=2' }],
      gomb: { szoveg: 'Letöltöm a számlát', link: 'https://app.adozz.hu/fiok/dijszamlak?x=1&y=2' },
      lablec: 'ugyfel',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('ADZ-1&lt;i&gt;');
    expect(html).toContain('href="https://app.adozz.hu/fiok/dijszamlak?x=1&amp;y=2"');
    expect(html).toContain('v:roundrect');
    expect((html.match(/Letöltöm a számlát/g) ?? []).length).toBe(2); // the button and its Outlook twin
    expect(html).not.toMatch(/<a [^>]*>[^<]*<a /);
    expect(looseBrand(html)).toBe(0);
    // Hungarian typography: the article keeps its word, the amount its unit
    expect(html).toContain('az <a href="https://adozz.hu"');
    expect(html).toContain('19 999 Ft');
  });
  it('blocks: a lone 6-digit code → code block; "Kulcs: érték" lines stay text; tip/info white with a bar (no pastel)', () => {
    const l = levelFromText('482913 – a megerősítő kódod', 'Szia!\n\nEzzel a kóddal:\n\n482913\n\n15 percig érvényes.\n\nAdózz', { lablec: 'kod' });
    expect(l.cim).toBe('A megerősítő kódod');
    expect(l.blokkok.some((b) => b.t === 'kod')).toBe(true);
    expect(l.blokkok.some((b) => b.t === 'p' && b.s === 'Adózz')).toBe(false);
    const html = renderLevel(l);
    expect(html).toContain('482&nbsp;913');
    expect(html).toContain('kódot kértek az');
    for (const t of ['tipp', 'info'] as const) {
      const b = blokkHtml({ t, s: 'x' });
      expect(b).toContain('background-color:#FFFFFF');
      expect(b).not.toMatch(/#FFF6DB|#EAEDFC/);
    }
  });
  it('footer by template: codes, staff, callbacks, clients', () => {
    expect(lablecOfTemplate('auth_email_code')).toBe('kod');
    expect(lablecOfTemplate('auth_staff_invite_csapat')).toBe('munkatars');
    expect(lablecOfTemplate('staff_digest')).toBe('munkatars');
    expect(lablecOfTemplate('nav_hiba')).toBe('munkatars');
    expect(lablecOfTemplate('export_failed_admin')).toBe('munkatars');
    expect(lablecOfTemplate('callback_received')).toBe('visszahivas');
    expect(lablecOfTemplate('fee_invoice')).toBe('ugyfel');
  });
});

describe('mailer, notifications, DEMO outbox', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setup({ now: '2026-11-21T09:00:00Z' });
  });
  afterAll(async () => h.close());

  it('the DEMO mailer stores the HTML image next to the text (text/plain unchanged)', async () => {
    const m = createMailer(h.deps.cfg, h.deps.db);
    await m.send({ to: 'demo.html@demo.kezjegy.test', subject: 'Próba', text: 'Szia!\n\nEz az Adózz.hu próbája.', template: 'proba' });
    const [row] = await h.deps.db.select().from(demoOutbox).where(eq(demoOutbox.subject, 'Próba'));
    expect(row!.bodyText).toBe('Szia!\n\nEz az Adózz.hu próbája.');
    expect(row!.bodyHtml).toContain('<h1 class="cim"');
    expect(looseBrand(row!.bodyHtml!)).toBe(0);
  });

  it('code mails get the code block; notification mails the button; staff get the staff footer', async () => {
    await sendCodeEmail(h.deps, 'kod@demo.kezjegy.test', 'auth_email_code', '482913');
    const code = h.mails.find((x) => x.to === 'kod@demo.kezjegy.test')!;
    expect(htmlOfMail(code)).toContain('482&nbsp;913');
    const acc = await staff(h, 'accountant', 'konyvelo.k8l@demo.kezjegy.test');
    await notify(h.deps, h.deps.db, { userId: acc.userId, kind: 'invoice_failed', params: { osszeg: '19 999', hiba: 'x', clientName: 'Kiss Zoé' }, link: '/admin/dijszamlak' });
    await dispatchPending(h.deps);
    const staffMail = h.mails.find((x) => x.to === 'konyvelo.k8l@demo.kezjegy.test' && x.template === 'invoice_failed')!;
    expect(staffMail.text).toContain('munkatársa vagy');
    expect(staffMail.text).not.toContain('Fiók → Értesítések');
    expect(htmlOfMail(staffMail)).toContain('munkatársa vagy');
    const [n] = await h.deps.db.select().from(notifications).where(eq(notifications.userId, acc.userId));
    expect(n!.emailSentAt).not.toBeNull();
  });

  it('panel "Levél képe": signed 5-minute link, strict CSP, DEMO only; a tampered or expired link is 404', async () => {
    const admin = await staff(h, 'admin', 'admin.k8l@demo.kezjegy.test');
    const m = createMailer(h.deps.cfg, h.deps.db);
    await m.send({ to: 'ugyfel.kep@demo.kezjegy.test', subject: 'Képpróba', text: 'Szia!\n\nKép.', template: 'proba' });
    const [row] = await h.deps.db.select().from(demoOutbox).where(eq(demoOutbox.subject, 'Képpróba'));
    const r = await h.json('GET', `/admin/demo-outbox/${row!.id}/html`, { token: admin.token });
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^\/api\/v1\/demo-level\/[0-9a-f-]{36}\.\d+\.[0-9a-f]{32}$/);
    const page = await h.app.request(r.body.url);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(await page.text()).toContain('Kép.');
    expect((await h.app.request(r.body.url.replace(/.$/, (c: string) => (c === '0' ? '1' : '0')))).status).toBe(404);
    h.clock.advance(6 * 60_000);
    expect((await h.app.request(r.body.url)).status).toBe(404);
    // a client never gets the link
    const [u] = await h.deps.db.select().from(users).where(eq(users.email, 'admin.k8l@demo.kezjegy.test'));
    expect(u).toBeTruthy();
  });
});

describe('JL letters (LEVEL_LEFEDETTSEG 3. pont 14–19)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setup({ now: '2026-11-21T09:00:00Z' });
  });
  afterAll(async () => h.close());

  it('14 welcome after the confirmed sign-up (once); 16 "Folytasd" once after 3 days; 19 disabled / enabled', async () => {
    const { newClient } = await import('./helpers.js');
    // 16 is armed by its first run: clients onboarding before k8 went live get no surprise letter
    const { jobGuidedContinue: arm } = await import('../src/jobs-k8.js');
    h.clock.set('2026-11-21T08:00:00Z');
    expect(await arm(h.deps)).toBe(0);
    h.clock.set('2026-11-21T09:00:00Z');
    const c = await newClient(h, 'udv.k8@demo.kezjegy.test', { first: 'Zoé' });
    const udv = h.mails.filter((m) => m.to === 'udv.k8@demo.kezjegy.test' && m.template === 'welcome');
    expect(udv).toHaveLength(1);
    expect(udv[0]!.text).toContain('Szia, Zoé!');
    expect(udv[0]!.text).toContain('A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.');
    expect(htmlOfMail(udv[0]!)).toContain('Folytatom a bekötést');
    // 16: three days later, once (the row's created_at is the DB clock – pinned to the test clock here)
    const { clients } = await import('../src/db/schema.js');
    await h.deps.db.update(clients).set({ createdAt: new Date('2026-11-21T09:00:00Z') }).where(eq(clients.id, c.clientId));
    const { jobGuidedContinue } = await import('../src/jobs-k8.js');
    h.clock.set('2026-11-22T09:00:00Z');
    expect(await jobGuidedContinue(h.deps)).toBe(0);
    h.clock.set('2026-11-24T10:00:00Z');
    expect(await jobGuidedContinue(h.deps)).toBe(1);
    expect(await jobGuidedContinue(h.deps)).toBe(0);
    await dispatchPending(h.deps);
    expect(h.mails.filter((m) => m.to === 'udv.k8@demo.kezjegy.test' && m.template === 'guided_continue')).toHaveLength(1);
    // 19
    const admin = await staff(h, 'admin', 'admin.jl@demo.kezjegy.test');
    expect((await h.json('POST', `/admin/clients/${c.clientId}/disable`, { token: admin.token, body: { reason: 'próba tiltás' } })).status).toBe(204);
    expect((await h.json('POST', `/admin/clients/${c.clientId}/enable`, { token: admin.token, body: { reason: 'próba feloldás' } })).status).toBe(204);
    const t = h.mails.filter((m) => m.to === 'udv.k8@demo.kezjegy.test').map((m) => m.template);
    expect(t).toContain('account_disabled');
    expect(t).toContain('account_enabled');
  });
});
