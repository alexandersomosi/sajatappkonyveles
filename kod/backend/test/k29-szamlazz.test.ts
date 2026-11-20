// SPEC §29.2 (B1) – Számlázz.hu Számla Agent: the XML follows the XSD element order (fixtures downloaded from
// szamlazz.hu), response parsing, "already existing order number" (71/152) → query, a timeout → query-first retry, storno /
// correction; the pipeline's mode guard; and the config guards of §29.1.1 / §29.2.1 / §29.3.4.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { clients, feeInvoices, payments } from '../src/db/schema.js';
import { invoiceRoute, processInvoice, queueCorrection, queueFeeInvoice, queueStorno, retryInvoice } from '../src/payments/invoices.js';
import { buildInvoiceXml, buildQueryXml, buildStornoXml, createSzamlazzClient, SzamlazzError, type SzamlazzClient } from '../src/payments/szamlazzhu.js';
import { createDemoProvider } from '../src/payments/demo.js';
import { FAKE_STRIPE_ENV, FakeStripe } from './fake-stripe.js';
import { newClient, setup, type Harness } from './helpers.js';

const XSD_DIR = join(__dirname, 'fixtures', 'szamlazz');
const xsd = (f: string) => readFileSync(join(XSD_DIR, f), 'utf8');
const AGENT = ['agent', 'key', 'fake', '0000'].join('-');

/** Element names of a named (or the root element's anonymous) complexType sequence, in order, with minOccurs. */
function sequence(src: string, typeName: string | null, rootName?: string): { name: string; min: number }[] {
  const block = typeName
    ? new RegExp(`<complexType name="${typeName}">([\\s\\S]*?)</complexType>`).exec(src)?.[1]
    : new RegExp(`<element name="${rootName}">\\s*<complexType>([\\s\\S]*?)</complexType>`).exec(src)?.[1];
  if (!block) throw new Error(`no type ${typeName ?? rootName}`);
  return [...block.matchAll(/<element name="(\w+)"([^>]*)>/g)].map((m) => ({ name: m[1]!, min: Number(/minOccurs="(\d+)"/.exec(m[2]!)?.[1] ?? '1') }));
}

/** Direct children (by indentation) of `section` in our rendered XML. */
function childrenOf(xml: string, section: string, indent: number): string[] {
  const lines = xml.split('\n');
  const start = lines.findIndex((l) => l.trim() === `<${section}>`);
  if (start < 0) throw new Error(`no ${section}`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.trim() === `</${section}>`) break;
    const m = /^(\s*)<(\w+)>/.exec(l);
    if (m && m[1]!.length === indent) out.push(m[2]!);
  }
  return out;
}

function assertOrder(ours: string[], seq: { name: string; min: number }[], label: string) {
  const idx = ours.map((n) => seq.findIndex((s) => s.name === n));
  expect(idx.every((i) => i >= 0), `${label}: unknown element in ${ours.join(',')}`).toBe(true);
  for (let i = 1; i < idx.length; i++) expect(idx[i]! > idx[i - 1]!, `${label}: ${ours[i]} after ${ours[i - 1]}`).toBe(true);
  for (const s of seq.filter((x) => x.min > 0)) expect(ours, `${label}: required ${s.name}`).toContain(s.name);
}

const buyer = { name: 'Kovács Péter e.v.', zip: '1136', city: 'Budapest', address: 'Példa utca 7.', adoszam: '68801234-1-41', email: 'peter@demo.kezjegy.test' };
const invInput = { key: 'ADZ-0123456789abcdef0123', issueDate: '2026-11-20', paymentDate: '2026-11-20', buyer, line: { megnevezes: 'Könyvelési szolgáltatás – havidíj (2026.11.20.–2026.12.19.)', unit: 'hó', grossHuf: 19_999 }, replyTo: null, emailTargy: 'Adózz – számla', emailSzoveg: 'Szia Péter! <teszt> & "idézet"', megjegyzes: 'Bankkártyával fizetve. Azonosító: ADZ-0123456789abcdef0123' };

describe('XML vs the XSDs', () => {
  it('xmlszamla: section and item order, required elements, our key as rendelesSzam and szamlaKulsoAzon, escaping', () => {
    const x = buildInvoiceXml(AGENT, invInput);
    const s = xsd('xmlszamla.xsd');
    assertOrder(['beallitasok', 'fejlec', 'elado', 'vevo', 'tetelek'], sequence(s, null, 'xmlszamla'), 'root');
    assertOrder(childrenOf(x, 'beallitasok', 4), sequence(s, 'beallitasokTipus'), 'beallitasok');
    assertOrder(childrenOf(x, 'fejlec', 4), sequence(s, 'fejlecTipus'), 'fejlec');
    assertOrder(childrenOf(x, 'elado', 4), sequence(s, 'eladoTipus'), 'elado');
    assertOrder(childrenOf(x, 'vevo', 4), sequence(s, 'vevoTipus'), 'vevo');
    assertOrder(childrenOf(x, 'tetel', 6), sequence(s, 'tetelTipus'), 'tetel');
    expect(x).toContain('<rendelesSzam>ADZ-0123456789abcdef0123</rendelesSzam>');
    expect(x).toContain('<szamlaKulsoAzon>ADZ-0123456789abcdef0123</szamlaKulsoAzon>');
    expect(x).toContain('<fizetve>true</fizetve>');
    expect(x).toContain('<eszamla>true</eszamla>');
    expect(x).toContain('<afakulcs>27</afakulcs>');
    expect(x).toContain('<nettoEgysegar>15747.24</nettoEgysegar>');
    expect(x).toContain('<afaErtek>4251.76</afaErtek>');
    expect(x).toContain('<bruttoErtek>19999</bruttoErtek>');
    expect(x).toContain('Szia Péter! &lt;teszt&gt; &amp; &quot;idézet&quot;');
    expect(x).not.toContain('<emailReplyto>'); // [CÉGADAT] support e-mail → omitted
  });
  it('correction: helyesbitoszamla + the original number + a negative line', () => {
    const x = buildInvoiceXml(AGENT, { ...invInput, correctionOf: 'ADZ-2026-12', line: { ...invInput.line, grossHuf: -5_000 } });
    expect(x).toContain('<helyesbitoszamla>true</helyesbitoszamla>');
    expect(x).toContain('<helyesbitettSzamlaszam>ADZ-2026-12</helyesbitettSzamlaszam>');
    expect(x).toContain('<mennyiseg>-1</mennyiseg>');
    expect(x).toContain('<bruttoErtek>-5000</bruttoErtek>');
    assertOrder(childrenOf(x, 'fejlec', 4), sequence(xsd('xmlszamla.xsd'), 'fejlecTipus'), 'fejlec');
  });
  it('xmlszamlaxml (query) and xmlszamlast (storno) follow their XSDs', () => {
    const q = buildQueryXml(AGENT, 'ADZ-1');
    const qs = sequence(xsd('xmlszamlaxml.xsd'), null, 'xmlszamlaxml');
    const qChildren = q.split('\n').filter((l) => /^ {2}<\w+>/.test(l)).map((l) => /<(\w+)>/.exec(l)![1]!);
    assertOrder(qChildren, qs, 'query');
    const st = buildStornoXml(AGENT, { key: 'ADZ-1S', originalNumber: 'ADZ-2026-1', date: '2026-11-21', megjegyzes: 'Visszatérítés: teszt', email: 'a@b.test', replyTo: null, emailTargy: 't', emailSzoveg: 's' });
    const s = xsd('xmlszamlast.xsd');
    assertOrder(['beallitasok', 'fejlec', 'elado', 'vevo'], sequence(s, null, 'xmlszamlast'), 'st root');
    assertOrder(childrenOf(st, 'beallitasok', 4), sequence(s, 'beallitasokTipus'), 'st beallitasok');
    assertOrder(childrenOf(st, 'fejlec', 4), sequence(s, 'fejlecTipus'), 'st fejlec');
  });
});

describe('the Agent client (fake HTTP)', () => {
  const pdf = Buffer.from('%PDF-1.4\n%fake\n');
  it('reads the number from the URL-encoded header and the PDF body; [ERR] and szlahu_error_code are errors', async () => {
    let field = '';
    const f = (async (_u: string, init: { body: FormData }) => {
      field = [...init.body.keys()][0]!;
      return new Response(pdf, { headers: { szlahu_szamlaszam: encodeURIComponent('ADZ-2026/001'), szlahu_bruttovegosszeg: '19999' } });
    }) as unknown as typeof fetch;
    const r = await createSzamlazzClient({ url: 'https://szamlazz.test/szamla', fetch: f }).issue('<x/>');
    expect(field).toBe('action-xmlagentxmlfile');
    expect(r).toMatchObject({ number: 'ADZ-2026/001', grossHuf: 19_999 });
    const bad = (async () => new Response('[ERR] Már létező rendelésszám', { headers: { szlahu_error_code: '71', szlahu_error: encodeURIComponent('Már létező rendelésszám') } })) as unknown as typeof fetch;
    await expect(createSzamlazzClient({ url: 'x', fetch: bad }).issue('<x/>')).rejects.toMatchObject({ code: '71', uncertain: false });
    const html = (async () => new Response('<html>oops</html>')) as unknown as typeof fetch;
    await expect(createSzamlazzClient({ url: 'x', fetch: html }).issue('<x/>')).rejects.toMatchObject({ code: 'bad_response', uncertain: true });
  });
  it('query: code 7 → null; found → number + PDF; a timeout is uncertain', async () => {
    const nf = (async () => new Response('<xmlszamlavalasz><sikeres>false</sikeres><hibakod>7</hibakod><hibauzenet>Hiányzó adat</hibauzenet></xmlszamlavalasz>')) as unknown as typeof fetch;
    expect(await createSzamlazzClient({ url: 'x', fetch: nf }).query('<q/>')).toBeNull();
    const ok = (async () => new Response(`<szamla><alap><id>1</id><szamlaszam>ADZ-2026-7</szamlaszam></alap><osszegek><totalossz><netto>1</netto><brutto>19999</brutto></totalossz></osszegek><pdf>${pdf.toString('base64')}</pdf></szamla>`)) as unknown as typeof fetch;
    const r = await createSzamlazzClient({ url: 'x', fetch: ok }).query('<q/>');
    expect(r).toMatchObject({ number: 'ADZ-2026-7', grossHuf: 19_999 });
    expect(r!.pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const slow = ((_u: string, init: { signal: AbortSignal }) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('t'), { name: 'TimeoutError' }))))) as unknown as typeof fetch;
    await expect(createSzamlazzClient({ url: 'x', fetch: slow, timeoutMs: 20 }).issue('<x/>')).rejects.toMatchObject({ code: 'timeout', uncertain: true });
  });
});

/** A fake Agent: remembers issued documents by key; can fail once with a timeout or "already exists". */
class FakeAgent implements SzamlazzClient {
  docs = new Map<string, { number: string; xml: string }>();
  calls: string[] = [];
  failNext: 'timeout_after_create' | 'duplicate' | null = null;
  n = 0;
  private key(xml: string) {
    return /<szamlaKulsoAzon>([^<]+)</.exec(xml)![1]!;
  }
  async issue(xml: string) {
    this.calls.push('issue');
    const k = this.key(xml);
    expect(/<rendelesSzam>([^<]+)</.exec(xml)![1]).toBe(k);
    if (this.failNext === 'duplicate') {
      this.failNext = null;
      this.docs.set(k, { number: `ADZ-2026-${++this.n}`, xml });
      throw new SzamlazzError('Már létező rendelésszám', '71', false);
    }
    const doc = { number: `ADZ-2026-${++this.n}`, xml };
    this.docs.set(k, doc);
    if (this.failNext === 'timeout_after_create') {
      this.failNext = null;
      throw new SzamlazzError('időtúllépés', 'timeout', true);
    }
    return { number: doc.number, pdf: Buffer.from('%PDF-1.4 fake'), grossHuf: null };
  }
  async storno(xml: string) {
    this.calls.push('storno');
    const k = this.key(xml);
    const doc = { number: `ADZ-2026-${++this.n}`, xml };
    this.docs.set(k, doc);
    return { number: doc.number, pdf: Buffer.from('%PDF-1.4 storno'), grossHuf: null };
  }
  async query(xml: string) {
    this.calls.push('query');
    const k = this.key(xml);
    const d = this.docs.get(k);
    return d ? { number: d.number, pdf: Buffer.from('%PDF-1.4 again'), grossHuf: null } : null;
  }
}

describe('the pipeline with the Tesztüzem account (fake Agent)', () => {
  let h: Harness;
  const agent = new FakeAgent();
  beforeAll(async () => {
    h = await setup({
      now: '2026-11-20T09:00:00Z',
      env: { ...FAKE_STRIPE_ENV, INVOICE_MODE: 'szamlazzhu', SZAMLAZZHU_ACCOUNT: 'teszt', SZAMLAZZHU_AGENT_KEY: AGENT },
      overrides: { szamlazz: agent, payments: { stripe: new FakeStripe(), demo: createDemoProvider({ apiPublicUrl: 'https://api.test', now: () => new Date() }) } },
    });
  });
  afterAll(async () => h.close());

  async function paidPayment(email: string, mode: 'test' | 'live' | 'demo' = 'test', amount = 19_999) {
    const c = await newClient(h, email, { first: 'Péter', last: 'Kovács' });
    await h.deps.db.update(clients).set({ addressZip: '1136', addressCity: 'Budapest', addressLine: 'Példa utca 7.', adoszam: '68801234-1-41' }).where(eq(clients.id, c.clientId));
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    const [p] = await h.deps.db.insert(payments).values({ clientId: c.clientId, kind: 'egyszeri', provider: mode === 'demo' ? 'demo' : 'stripe', mode, amountHuf: amount, status: 'sikeres', initiated: 'ugyfel', idempotencyKey: `t:${email}`, succeededAt: h.clock.now() }).returning();
    const { buyerOf } = await import('../src/payments/invoices.js');
    const id = await queueFeeInvoice(h.deps, h.deps.db, p!, buyerOf(cl!, email), { megnevezes: 'Éves zárás (2025): SZJA- és iparűzésiadó-bevallás', unit: 'alkalom' });
    return { c, p: p!, invoiceId: id! };
  }

  it('routes: test payment → teszt account; live → mismatch; demo → DEMO díjbekérő', () => {
    expect(invoiceRoute(h.deps.cfg, 'test')).toEqual({ provider: 'szamlazzhu', account: 'teszt' });
    expect(invoiceRoute(h.deps.cfg, 'live')).toBe('mismatch');
    expect(invoiceRoute(h.deps.cfg, 'demo')).toEqual({ provider: 'demo', account: 'demo' });
  });
  it('issues once: query first, then issue; PDF stored; key = ADZ-…', async () => {
    const { invoiceId } = await paidPayment('egy@demo.kezjegy.test');
    agent.calls.length = 0;
    expect(await processInvoice(h.deps, invoiceId)).toBe('kiallitva');
    expect(agent.calls).toEqual(['query', 'issue']);
    const [row] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, invoiceId));
    expect(row).toMatchObject({ status: 'kiallitva', provider: 'szamlazzhu', providerAccount: 'teszt', demo: false });
    expect(row!.number).toMatch(/^ADZ-2026-\d+$/);
    expect(row!.pdfFileId).toBeTruthy();
    expect(await processInvoice(h.deps, invoiceId)).toBe('skip');
  });
  it('a timeout after the Agent created it → folyamatban; the retry QUERIES and stores it (never a second invoice)', async () => {
    const { invoiceId } = await paidPayment('timeout@demo.kezjegy.test');
    agent.calls.length = 0;
    agent.failNext = 'timeout_after_create';
    expect(await processInvoice(h.deps, invoiceId)).toBe('folyamatban');
    const [r1] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, invoiceId));
    expect(r1).toMatchObject({ status: 'folyamatban', attempts: 1, lastErrorCode: 'timeout' });
    expect(r1!.nextRetryAt!.getTime() - h.clock.now().getTime()).toBe(2 * 60_000);
    h.clock.advance(3 * 60_000);
    expect(await processInvoice(h.deps, invoiceId)).toBe('kiallitva');
    expect(agent.calls).toEqual(['query', 'issue', 'query']);
  });
  it('"Már létező rendelésszám" (71) → query, store, done', async () => {
    const { invoiceId } = await paidPayment('dupla-rendeles@demo.kezjegy.test');
    agent.calls.length = 0;
    agent.failNext = 'duplicate';
    expect(await processInvoice(h.deps, invoiceId)).toBe('kiallitva');
    expect(agent.calls).toEqual(['query', 'issue', 'query']);
  });
  it('a live payment on the test account is refused (mode_mismatch), no call', async () => {
    const before = agent.calls.length;
    const { invoiceId } = await paidPayment('elo@demo.kezjegy.test', 'live');
    const [r] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, invoiceId));
    expect(r).toMatchObject({ status: 'hiba', lastErrorCode: 'mode_mismatch' });
    expect(await retryInvoice(h.deps, invoiceId, '00000000-0000-0000-0000-000000000000')).toBe('hiba');
    expect(agent.calls.length).toBe(before);
  });
  it('storno (full refund) and correction (partial) – each queried first, the original marked', async () => {
    const a = await paidPayment('storno@demo.kezjegy.test');
    await processInvoice(h.deps, a.invoiceId);
    const sid = await queueStorno(h.deps, h.deps.db, a.invoiceId, 'Visszatérítés: teszt');
    expect(await processInvoice(h.deps, sid!)).toBe('kiallitva');
    const [st] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, sid!));
    expect(st).toMatchObject({ kind: 'sztorno', amountHuf: -19_999, stornoOf: a.invoiceId });
    expect(st!.externalKey).toBe(`${(await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, a.invoiceId)))[0]!.externalKey}S`);
    expect((await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, a.invoiceId)))[0]!.status).toBe('sztorno');
    const xml = agent.docs.get(st!.externalKey!)!.xml;
    expect(xml).toContain('<xmlszamlast');
    const b = await paidPayment('helyesbit@demo.kezjegy.test');
    await processInvoice(h.deps, b.invoiceId);
    const cid = await queueCorrection(h.deps, h.deps.db, b.invoiceId, 5_000, 1, 'részleges');
    expect(await processInvoice(h.deps, cid!)).toBe('kiallitva');
    const [co] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, cid!));
    expect(co).toMatchObject({ kind: 'helyesbito', amountHuf: -5_000 });
    expect(agent.docs.get(co!.externalKey!)!.xml).toContain('<helyesbitoszamla>true</helyesbitoszamla>');
  });
  it('after 5 failed tries the row stays hiba and the admins are alerted once', async () => {
    const { invoiceId } = await paidPayment('otszor@demo.kezjegy.test');
    const orig = agent.query.bind(agent);
    agent.query = async () => {
      throw new SzamlazzError('belső hiba', '57', false);
    };
    for (let i = 0; i < 5; i++) {
      await processInvoice(h.deps, invoiceId);
      h.clock.advance(25 * 3600_000);
    }
    agent.query = orig;
    const [r] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.id, invoiceId));
    expect(r).toMatchObject({ status: 'hiba', attempts: 5, nextRetryAt: null, lastErrorCode: '57' });
    expect(r!.alertedAt).not.toBeNull();
  });
});

describe('config guards (§29.1.1, §29.2.1, §29.3.4)', () => {
  const base = { ...process.env, FILES_DIR: '/tmp/x' };
  const k = (...p: string[]) => p.join('_');
  it('a live Stripe key on the DEMO server is refused', () => {
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: k('sk', 'live', 'X1'), STRIPE_WEBHOOK_SECRET: k('whsec', 'X1') })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: k('sk', 'live', 'X1'), STRIPE_WEBHOOK_SECRET: k('whsec', 'X1') })).toThrow('Élő Stripe-kulcs nem lehet DEMO szerveren.');
  });
  it('a test key in production is refused; production without a provider = disabled', () => {
    const prod = { ...base, APP_ENV: 'production', STAFF_TOTP_REQUIRED: 'true', SIMPLEPAY_DEMO_SECRET: '' };
    expect(() => loadConfig({ ...prod, PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: k('sk', 'test', 'X1'), STRIPE_WEBHOOK_SECRET: k('whsec', 'X1') })).toThrow(ConfigError);
    expect(loadConfig(prod).payment.provider).toBe('disabled');
    expect(() => loadConfig({ ...prod, PAYMENT_PROVIDER: 'demo' })).toThrow(ConfigError);
  });
  it('stripe needs the webhook secret; publishable and secret key modes must match', () => {
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: k('sk', 'test', 'X1') })).toThrow(ConfigError);
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: k('sk', 'test', 'X1'), STRIPE_PUBLISHABLE_KEY: k('pk', 'live', 'X1'), STRIPE_WEBHOOK_SECRET: k('whsec', 'X1') })).toThrow(ConfigError);
    const ok = loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: k('sk', 'test', 'X1'), STRIPE_PUBLISHABLE_KEY: k('pk', 'test', 'X1'), STRIPE_WEBHOOK_SECRET: k('whsec', 'X1') });
    expect(ok.payment).toMatchObject({ provider: 'stripe', stripe: { mode: 'test', suffixHavi: 'HAVIDIJ', locale: 'hu' } });
    expect(loadConfig(base).payment.provider).toBe('demo');
  });
  it('Számlázz.hu: the live account never on DEMO; the test account never in production; the account is required', () => {
    expect(() => loadConfig({ ...base, INVOICE_MODE: 'szamlazzhu', SZAMLAZZHU_AGENT_KEY: AGENT, SZAMLAZZHU_ACCOUNT: 'eles' })).toThrow('Éles Számlázz.hu-fiók nem lehet DEMO szerveren');
    expect(() => loadConfig({ ...base, INVOICE_MODE: 'szamlazzhu', SZAMLAZZHU_AGENT_KEY: AGENT })).toThrow(ConfigError);
    expect(loadConfig({ ...base, INVOICE_MODE: 'szamlazzhu', SZAMLAZZHU_AGENT_KEY: AGENT, SZAMLAZZHU_ACCOUNT: 'teszt' }).invoice).toMatchObject({ mode: 'szamlazzhu', szamlazzhuAccount: 'teszt' });
    const prod = { ...base, APP_ENV: 'production', STAFF_TOTP_REQUIRED: 'true' };
    expect(() => loadConfig({ ...prod, INVOICE_MODE: 'szamlazzhu', SZAMLAZZHU_AGENT_KEY: AGENT, SZAMLAZZHU_ACCOUNT: 'teszt' })).toThrow(ConfigError);
  });
  it('public origins: adozz.hu + the kept sslip hosts; app origins with short keys; the no-trial default', () => {
    const c = loadConfig({
      ...base,
      APP_PUBLIC_URL: 'https://app.adozz.hu',
      PANEL_PUBLIC_URL: 'https://konyvelo.adozz.hu',
      API_PUBLIC_URL: 'https://api.adozz.hu',
      LANDING_PUBLIC_URL: 'https://adozz.hu',
      EXTRA_PUBLIC_ORIGINS: 'https://app.45-94-65-74.sslip.io,https://konyvelo.45-94-65-74.sslip.io,https://api.45-94-65-74.sslip.io',
    });
    expect(c.publicOrigins).toEqual(['https://app.adozz.hu', 'https://konyvelo.adozz.hu', 'https://api.adozz.hu', 'https://adozz.hu', 'https://app.45-94-65-74.sslip.io', 'https://konyvelo.45-94-65-74.sslip.io', 'https://api.45-94-65-74.sslip.io']);
    expect(c.appOrigins).toEqual([
      { key: 'a', origin: 'https://app.adozz.hu' },
      { key: 's', origin: 'https://app.45-94-65-74.sslip.io' },
    ]);
    expect(c.newBusinessChargePolicy).toBe('azonnal');
    expect(() => loadConfig({ ...base, EXTRA_PUBLIC_ORIGINS: 'http://evil.example' })).toThrow(ConfigError);
  });
  it('NAV lookup user: all five or none', () => {
    expect(loadConfig(base).navLookup).toBeNull();
    expect(() => loadConfig({ ...base, NAV_LOOKUP_LOGIN: 'x' })).toThrow(ConfigError);
  });
});
