// Contract tests: the real client (HTTP transport) against the local mock server, and the in-process
// demo transport, using kod/shared/demo/fixtures.json. All data is fictional.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNavClient } from '../src/client.js';
import { loadDefaultDemoFixtures } from '../src/assets.js';
import { startMockServer, type MockServer } from '../src/mock/server.js';
import { demoCredentialsFor } from '../src/mock/dataset.js';
import { RateLimiter } from '../src/limiter.js';
import { newRequestId } from '../src/crypto.js';
import { buildQueryInvoiceDigestRequest, buildQueryTaxpayerRequest } from '../src/xml/build.js';
import { createNavClientFromEnv } from '../src/index.js';
import type { FixtureInvoice, InvoiceDirection, NavClient, NavCredentials, NormalizedInvoice } from '../src/types.js';
import { SOFTWARE } from './helpers.js';

const fixtures = loadDefaultDemoFixtures();
const AS_OF = '2026-11-17';
let server: MockServer;
let pagedServer: MockServer;

beforeAll(async () => {
  server = await startMockServer({ port: 0, today: AS_OF });
  pagedServer = await startMockServer({ port: 0, today: AS_OF, pageSize: 2 });
});
afterAll(async () => {
  await server.close();
  await pagedServer.close();
});

function httpClient(credentials: NavCredentials, baseUrl = server.url, extra: Partial<Parameters<typeof createNavClient>[0]> = {}): NavClient {
  return createNavClient({
    environment: 'test',
    baseUrl,
    credentials,
    software: SOFTWARE,
    limiter: new RateLimiter(0),
    retryBaseDelayMs: 1,
    ...extra,
  });
}

async function syncAll(c: NavClient, direction: InvoiceDirection = 'OUTBOUND', since: string | null = null) {
  const out: NormalizedInvoice[] = [];
  let digests = 0;
  for await (const item of c.syncInvoices({ direction, since, asOf: AS_OF })) {
    digests++;
    out.push((await item.data()).invoice);
  }
  return { invoices: out, digests };
}

function expectMatchesFixture(inv: NormalizedInvoice, f: FixtureInvoice) {
  expect(inv).toMatchObject({
    invoiceNumber: f.invoiceNumber,
    operation: f.operation,
    category: f.category,
    issueDate: f.issueDate,
    deliveryDate: f.deliveryDate,
    paymentDate: f.paymentDate,
    paymentMethod: f.paymentMethod,
    currency: f.currency,
    netAmountHuf: f.netAmountHuf,
    vatAmountHuf: f.vatAmountHuf,
    grossAmountHuf: f.grossAmountHuf,
    supplierTaxNumber: f.supplierTaxNumber,
    customer: f.customer,
    insDate: `${f.issueDate}T10:00:00Z`,
    source: 'DEMO',
  });
  if (f.vatExemption) expect(inv.vatExemption).toEqual(f.vatExemption);
  expect(inv.lines.map((l) => ({ lineNo: l.lineNo, description: l.description, quantity: l.quantity, unit: l.unit, unitPriceHuf: l.unitPriceHuf, netAmountHuf: l.netAmountHuf }))).toEqual(
    f.lines.map((l) => ({ lineNo: l.lineNo, description: l.description, quantity: l.quantity, unit: l.unit, unitPriceHuf: l.unitPriceHuf, netAmountHuf: l.netAmountHuf })),
  );
}

describe('mock contract over HTTP: the three demo clients', () => {
  it.each(Object.keys(fixtures.navInvoices))('full first sync of %s reproduces fixtures.json exactly', async (tax) => {
    const expected = fixtures.navInvoices[tax]!.filter((f) => f.issueDate <= AS_OF);
    const c = httpClient(demoCredentialsFor(tax));
    const { invoices, digests } = await syncAll(c);
    expect(digests).toBe(expected.length);
    const byNo = new Map(invoices.map((i) => [i.invoiceNumber, i]));
    for (const f of expected) expectMatchesFixture(byNo.get(f.invoiceNumber)!, f);
    const total = (xs: { grossAmountHuf: number }[]) => xs.reduce((a, x) => a + x.grossAmountHuf, 0);
    expect(total(invoices)).toBe(total(expected));
  });

  it('expected counts (Kata 33, Réka 4, Péter 28)', () => {
    expect(fixtures.navInvoices['68801234']).toHaveLength(33);
    expect(fixtures.navInvoices['68904564']).toHaveLength(4);
    expect(fixtures.navInvoices['68707893']).toHaveLength(28);
  });

  it('digest paging: page size 2 gives the same result as page size 100', async () => {
    const c = httpClient(demoCredentialsFor('68801234'), pagedServer.url);
    const first = await c.queryInvoiceDigest({ direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-01-01', to: '2026-02-04' } });
    expect(first.currentPage).toBe(1);
    expect(first.availablePage).toBeGreaterThan(1);
    expect(first.digests).toHaveLength(2);
    const beyond = await c.queryInvoiceDigest({ direction: 'OUTBOUND', page: first.availablePage + 1, issueDate: { from: '2026-01-01', to: '2026-02-04' } });
    expect(beyond.digests).toHaveLength(0);
    const { digests } = await syncAll(c);
    // KSZ-2026-032 is dated 2026-11-18 in fixtures.json, so on 2026-11-17 only 32 of 33 exist.
    expect(digests).toBe(fixtures.navInvoices['68801234']!.filter((f) => f.issueDate <= AS_OF).length);
    expect(digests).toBe(32);
  });

  it('digests carry the NAV fields the backend stores', async () => {
    const c = httpClient(demoCredentialsFor('68801234'));
    const r = await c.queryInvoiceDigest({ direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-01-01', to: '2026-01-31' } });
    const d = r.digests.find((x) => x.invoiceNumber === 'KSZ-2026-001')!;
    expect(d).toMatchObject({
      operation: 'CREATE',
      category: 'NORMAL',
      issueDate: '2026-01-02',
      supplierTaxNumber: '68801234',
      supplierName: 'Szabó Kata e.v.',
      customerName: 'Csipkebogyó Pékség Bt.',
      customerTaxNumber: '99204059',
      netAmountHuf: 167000,
      vatAmountHuf: 0,
      insDate: '2026-01-02T10:00:00Z',
      index: 1,
      source: 'DEMO',
      completeness: false,
    });
    expect(d.transactionId).toMatch(/^[+a-zA-Z0-9_]{1,30}$/);
  });

  it('later sync by insDate only returns recent invoices', async () => {
    const c = httpClient(demoCredentialsFor('68801234'));
    const { invoices } = await syncAll(c, 'OUTBOUND', '2026-11-12T00:00:00.000Z');
    expect(invoices.map((i) => i.invoiceNumber).sort()).toEqual(
      fixtures.navInvoices['68801234']!
        .filter((f) => f.issueDate <= AS_OF && `${f.issueDate}T10:00:00Z` >= '2026-11-11T00:00:00.000Z')
        .map((f) => f.invoiceNumber)
        .sort(),
    );
  });

  it('queryTaxpayer and checkConnection', async () => {
    const c = httpClient(demoCredentialsFor('68801234'));
    await expect(c.queryTaxpayer('68801234')).resolves.toMatchObject({
      valid: true,
      name: 'Szabó Kata e.v.',
      incorporation: 'SELF_EMPLOYED',
      vatCode: '1',
      countyCode: '41',
      address: '1136 Budapest, Példa utca 7.',
    });
    await expect(c.queryTaxpayer('99204059')).resolves.toMatchObject({ valid: true, name: 'Csipkebogyó Pékség Bt.', incorporation: 'ORGANIZATION' });
    // Wrong check digit: NAV (and the mock) answer taxpayerValidity=false, no data.
    await expect(c.queryTaxpayer('12345678')).resolves.toEqual({ valid: false });
    await expect(c.queryTaxpayer('1234')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(c.checkConnection()).resolves.toEqual({ ok: true, messageHu: 'A NAV-kapcsolat működik.', taxpayerName: 'Szabó Kata e.v.' });
  });
});

describe('mock contract: any other taxpayer gets deterministic generated data', () => {
  const qa: NavCredentials = { login: 'qauser01', password: 'barmi-jelszo', signatureKey: 'barmi-kulcs', taxNumber: '12345676' };

  it('2–4 invoices per month up to asOf, amounts 80–450 e Ft, one STORNO, stable across servers', async () => {
    const a = await syncAll(httpClient(qa));
    const other = await startMockServer({ port: 0, today: AS_OF });
    try {
      const b = await syncAll(httpClient(qa, other.url));
      expect(b.invoices.map((i) => [i.invoiceNumber, i.grossAmountHuf])).toEqual(a.invoices.map((i) => [i.invoiceNumber, i.grossAmountHuf]));
    } finally {
      await other.close();
    }
    const creates = a.invoices.filter((i) => i.operation === 'CREATE');
    for (let m = 1; m <= 10; m++) {
      const n = creates.filter((i) => i.issueDate.startsWith(`2026-${String(m).padStart(2, '0')}`)).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
    }
    for (const i of creates) {
      expect(i.issueDate <= AS_OF).toBe(true);
      expect(i.grossAmountHuf).toBeGreaterThanOrEqual(80_000);
      expect(i.grossAmountHuf).toBeLessThanOrEqual(450_000);
      expect(i.source).toBe('DEMO');
      expect(i.vatExemption?.case).toBe('AAM');
    }
    const storno = a.invoices.find((i) => i.operation === 'STORNO')!;
    expect(storno).toBeDefined();
    const original = a.invoices.find((i) => i.invoiceNumber === storno.originalInvoiceNumber)!;
    expect(storno.grossAmountHuf).toBe(-original.grossAmountHuf);
    expect(storno.modificationIndex).toBe(1);
    expect(storno.lines[0]?.modifiesLine).toEqual({ lineNo: 2, operation: 'CREATE' });

    const chain = await httpClient(qa).queryInvoiceChainDigest({ invoiceNumber: original.invoiceNumber, direction: 'OUTBOUND' });
    expect(chain.elements.map((e) => [e.invoiceNumber, e.operation])).toEqual([
      [original.invoiceNumber, 'CREATE'],
      [storno.invoiceNumber, 'STORNO'],
    ]);
  });

  it('INBOUND: one purchase invoice per month with 27 % VAT', async () => {
    const { invoices } = await syncAll(httpClient(qa), 'INBOUND');
    expect(invoices).toHaveLength(11);
    for (const i of invoices) {
      expect(i.customer.taxNumber).toBe('12345676');
      expect(i.vatAmountHuf).toBe(Math.round(i.netAmountHuf * 0.27));
      expect(i.lines[0]?.vatPercentage).toBe(0.27);
    }
  });
});

describe('mock contract: authentication and NAV errors', () => {
  const kata = demoCredentialsFor('68801234');

  it.each([
    ['wrong password of a registered demo user', { ...kata, password: 'rossz' }, 'INVALID_SECURITY_USER', 401],
    ['wrong signing key of a registered demo user', { ...kata, signatureKey: 'rossz-kulcs' }, 'INVALID_REQUEST_SIGNATURE', 400],
    ['registered user with another tax number', { ...kata, taxNumber: '68904564' }, 'INVALID_USER_RELATION', 500],
    ['trigger login hibas…', { ...kata, login: 'hibas1' }, 'INVALID_SECURITY_USER', 401],
    ['trigger login nincsjog…', { ...kata, login: 'nincsjog1' }, 'FORBIDDEN', 500],
    ['trigger login rosszkulcs…', { ...kata, login: 'rosszkulcs1' }, 'INVALID_REQUEST_SIGNATURE', 400],
    ['trigger login nemvalid…', { ...kata, login: 'nemvalid1' }, 'NOT_REGISTERED_CUSTOMER', 500],
  ])('%s → %s', async (_label, creds, code, status) => {
    const c = httpClient(creds);
    await expect(c.queryTaxpayer('68801234')).rejects.toMatchObject({ code, httpStatus: status, retryable: false });
    const check = await c.checkConnection();
    expect(check.ok).toBe(false);
    expect(check.code).toBe(code);
    expect(check.messageHu.length).toBeGreaterThan(10);
  });

  it('maintenance (karbantart…) → bare HTTP 503 → retried, then "A NAV rendszere most nem érhető el…"', async () => {
    const c = httpClient({ ...kata, login: 'karbantart1' });
    await expect(c.queryTaxpayer('68801234')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', httpStatus: 503, kind: 'unavailable' });
  });

  async function post(op: string, body: string, method = 'POST') {
    const res = await fetch(`${server.url}/${op}`, { method, headers: { 'Content-Type': 'application/xml' }, ...(method === 'POST' ? { body } : {}) });
    return { status: res.status, body: await res.text() };
  }
  const ctx = (over: Partial<{ requestId: string; timestamp: string }> = {}) => ({
    requestId: over.requestId ?? newRequestId(),
    timestamp: over.timestamp ?? new Date().toISOString(),
    credentials: kata,
    software: SOFTWARE,
  });

  it('range > 35 days → BAD_QUERY_PARAM_RANGE_EXCEEDED; from > to → BAD_QUERY_PARAM_OVERLAP', async () => {
    let r = await post('queryInvoiceDigest', buildQueryInvoiceDigestRequest(ctx(), { direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-01-01', to: '2026-03-01' } }));
    expect(r.status).toBe(400);
    expect(r.body).toContain('<ns2:errorCode>BAD_QUERY_PARAM_RANGE_EXCEEDED</ns2:errorCode>');
    r = await post('queryInvoiceDigest', buildQueryInvoiceDigestRequest(ctx(), { direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-03-01', to: '2026-01-01' } }));
    expect(r.body).toContain('BAD_QUERY_PARAM_OVERLAP');
  });

  it('timestamp outside ±1 day → INVALID_TIMESTAMP', async () => {
    const r = await post('queryTaxpayer', buildQueryTaxpayerRequest(ctx({ timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString() }), '68801234'));
    expect(r.status).toBe(400);
    expect(r.body).toContain('INVALID_TIMESTAMP');
  });

  it('the same requestId twice → REQUEST_ID_NOT_UNIQUE', async () => {
    const id = newRequestId();
    const ts = new Date().toISOString();
    expect((await post('queryTaxpayer', buildQueryTaxpayerRequest(ctx({ requestId: id, timestamp: ts }), '68801234'))).status).toBe(200);
    const again = await post('queryTaxpayer', buildQueryTaxpayerRequest(ctx({ requestId: id, timestamp: ts }), '68801234'));
    expect(again.status).toBe(400);
    expect(again.body).toContain('REQUEST_ID_NOT_UNIQUE');
  });

  it('schema problems → INVALID_REQUEST; broken XML → GeneralExceptionResponse; unknown operations → 404', async () => {
    const good = buildQueryTaxpayerRequest(ctx(), '68801234');
    const swapped = good.replace(/(<common:header>.*<\/common:header>)\s*(<common:user>.*<\/common:user>)/s, '$2$1');
    let r = await post('queryTaxpayer', swapped);
    expect(r.status).toBe(400);
    expect(r.body).toContain('INVALID_REQUEST');
    r = await post('queryTaxpayer', good.replace('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"', 'xmlns="urn:wrong"'));
    expect(r.body).toContain('INVALID_REQUEST');
    r = await post('queryInvoiceData', buildQueryTaxpayerRequest(ctx(), '68801234'));
    expect(r.body).toContain('INVALID_REQUEST');
    r = await post('queryTaxpayer', '<oops');
    expect(r.status).toBe(400);
    expect(r.body).toContain('<GeneralExceptionResponse xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common">');
    for (const op of ['manageInvoice', 'manageAnnulment', 'tokenExchange', 'queryTransactionStatus']) {
      expect((await post(op, good)).status).toBe(404);
    }
    expect((await post('queryTaxpayer', '', 'GET')).status).toBe(404);
  });

  it('OUTBOUND data query with supplierTaxNumber → BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED (raw)', async () => {
    const { buildQueryInvoiceDataRequest } = await import('../src/xml/build.js');
    const r = await post('queryInvoiceData', buildQueryInvoiceDataRequest(ctx(), { invoiceNumber: 'KSZ-2026-001', direction: 'OUTBOUND', supplierTaxNumber: '68801234' }));
    expect(r.body).toContain('BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED');
  });

  it('unknown invoice number → INVOICE_NOT_FOUND', async () => {
    await expect(httpClient(kata).queryInvoiceData({ invoiceNumber: 'NINCS-ILYEN', direction: 'OUTBOUND' })).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
  });
});

describe('DEMO mode in-process (what the backend uses with NAV_MODE=demo)', () => {
  it('createNavClientFromEnv(demo) needs no network and marks everything DEMO', async () => {
    const c = createNavClientFromEnv(demoCredentialsFor('68707893'), { NAV_MODE: 'demo' });
    expect(c.environment).toBe('demo');
    const check = await c.checkConnection();
    expect(check).toMatchObject({ ok: true, taxpayerName: 'Németh Péter e.v.' });
    expect(check.messageHu).toContain('DEMO');
    let n = 0;
    for await (const item of c.syncOutbound({ since: null, asOf: AS_OF })) {
      expect(item.digest.source).toBe('DEMO');
      if (n++ === 0) expect((await item.data()).invoice.source).toBe('DEMO');
    }
    expect(n).toBe(28);
  });

  it('test/prod without software identity → NOT_CONFIGURED (never pretends)', () => {
    expect(() => createNavClientFromEnv(demoCredentialsFor('68707893'), { NAV_MODE: 'prod' })).toThrow(/NOT_CONFIGURED/);
    expect(() => createNavClientFromEnv(demoCredentialsFor('68707893'), { NAV_MODE: 'test' })).toThrow(/NOT_CONFIGURED/);
  });
});
