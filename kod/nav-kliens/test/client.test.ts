// Client behaviour against a scripted fake transport: error mapping, retry/backoff, requestIds, inputs.
import { describe, expect, it } from 'vitest';
import { createNavClient, type NavClientOptions } from '../src/client.js';
import { NavError } from '../src/errors.js';
import { RateLimiter } from '../src/limiter.js';
import type { NavCallEvent, TransportRequest, TransportResponse } from '../src/types.js';
import { FIXED_NOW, KATA, SOFTWARE } from './helpers.js';

const NS = 'xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:ns2="http://schemas.nav.gov.hu/NTCA/1.0/common"';
const SW = '<software><softwareId>HU00000000KEZJEGY1</softwareId></software>';
const HDR = '<ns2:header><ns2:requestId>X</ns2:requestId><ns2:timestamp>2026-11-17T09:00:00.000Z</ns2:timestamp><ns2:requestVersion>3.0</ns2:requestVersion></ns2:header>';

const okTaxpayer = (): TransportResponse => ({
  status: 200,
  body: `<?xml version="1.0"?><QueryTaxpayerResponse ${NS}>${HDR}<ns2:result><ns2:funcCode>OK</ns2:funcCode></ns2:result>${SW}<taxpayerValidity>true</taxpayerValidity><taxpayerData><taxpayerName>Szabó Kata e.v.</taxpayerName><taxNumberDetail><ns3:taxpayerId xmlns:ns3="http://schemas.nav.gov.hu/OSA/3.0/base">68801234</ns3:taxpayerId></taxNumberDetail><incorporation>SELF_EMPLOYED</incorporation></taxpayerData></QueryTaxpayerResponse>`,
});

const navError = (status: number, code: string): TransportResponse => ({
  status,
  body: `<?xml version="1.0"?><GeneralErrorResponse ${NS}>${HDR}<ns2:result><ns2:funcCode>ERROR</ns2:funcCode><ns2:errorCode>${code}</ns2:errorCode><ns2:message>valami</ns2:message></ns2:result>${SW}</GeneralErrorResponse>`,
});

type Step = TransportResponse | Error;

function scripted(steps: Step[]) {
  const seen: TransportRequest[] = [];
  const transport = async (req: TransportRequest): Promise<TransportResponse> => {
    seen.push(req);
    const s = steps.shift();
    if (!s) throw new Error('no more scripted responses');
    if (s instanceof Error) throw s;
    return s;
  };
  return { transport, seen };
}

function client(steps: Step[], extra: Partial<NavClientOptions> = {}) {
  const t = scripted(steps);
  const sleeps: number[] = [];
  const events: NavCallEvent[] = [];
  const c = createNavClient({
    environment: 'test',
    credentials: KATA,
    software: SOFTWARE,
    transport: t.transport,
    now: () => FIXED_NOW,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    limiter: new RateLimiter(0),
    onEvent: (e) => events.push(e),
    ...extra,
  });
  return { c, seen: t.seen, sleeps, events };
}

const requestIdOf = (body: string) => /<common:requestId>([^<]+)</.exec(body)?.[1];

describe('createNavClient – transport and retries', () => {
  it('posts to the NAV test URL and parses queryTaxpayer', async () => {
    const { c, seen } = client([okTaxpayer()]);
    const r = await c.queryTaxpayer('68801234-1-41');
    expect(r).toMatchObject({ valid: true, name: 'Szabó Kata e.v.', incorporation: 'SELF_EMPLOYED' });
    expect(seen[0]?.url).toBe('https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3/queryTaxpayer');
    expect(seen[0]?.timeoutMs).toBe(60_000);
  });

  it('prod always uses the production URL (no override)', async () => {
    const { c, seen } = client([okTaxpayer()], { environment: 'prod', baseUrl: 'http://127.0.0.1:9/elsewhere' });
    await c.queryTaxpayer('68801234');
    expect(seen[0]?.url).toBe('https://api.onlineszamla.nav.gov.hu/invoiceService/v3/queryTaxpayer');
  });

  it('retries 5xx without a NAV body 3 times with 2/4/8 s backoff and a fresh requestId each time', async () => {
    const undertow: TransportResponse = { status: 500, body: 'Generic exception occurred!' };
    const { c, seen, sleeps } = client([undertow, undertow, undertow, okTaxpayer()]);
    await expect(c.queryTaxpayer('68801234')).resolves.toMatchObject({ valid: true });
    expect(sleeps).toEqual([2000, 4000, 8000]);
    const ids = seen.map((s) => requestIdOf(s.body));
    expect(new Set(ids).size).toBe(4);
  });

  it('gives up after 3 retries with a plain Hungarian message', async () => {
    const undertow: TransportResponse = { status: 502, body: 'Bad gateway' };
    const { c, sleeps } = client([undertow, undertow, undertow, undertow]);
    const err = await c.queryTaxpayer('68801234').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NavError);
    expect(err).toMatchObject({ code: 'HTTP_5XX', kind: 'unavailable', httpStatus: 502, retryable: true });
    expect((err as NavError).messageHu).toBe('A NAV rendszere most nem érhető el, később újrapróbáljuk.');
    expect(sleeps).toEqual([2000, 4000, 8000]);
  });

  it.each([
    [401, 'INVALID_SECURITY_USER', 'auth', 'Hibás technikai felhasználónév vagy jelszó.'],
    [400, 'INVALID_REQUEST_SIGNATURE', 'auth', 'Hibás XML aláírókulcs.'],
    [500, 'FORBIDDEN', 'permission', 'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.'],
    [500, 'NOT_REGISTERED_CUSTOMER', 'permission', 'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.'],
    [500, 'INVALID_CUSTOMER', 'permission', 'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.'],
    [400, 'INVALID_REQUEST', 'bug', 'Hiba van a NAV-nak küldött lekérdezésünkben. Szóltunk a fejlesztőknek.'],
    [400, 'INVALID_TIMESTAMP', 'clock', undefined],
    [400, 'SOMETHING_NEW_2027', 'unknown', 'A NAV hibát jelzett (SOMETHING_NEW_2027). A könyvelő megnézi.'],
  ])('HTTP %i %s is mapped and NOT retried', async (status, code, kind, msg) => {
    const { c, seen, sleeps } = client([navError(status, code)]);
    const err = (await c.queryTaxpayer('68801234').catch((e: unknown) => e)) as NavError;
    expect(err).toBeInstanceOf(NavError);
    expect(err.code).toBe(code);
    expect(err.kind).toBe(kind);
    expect(err.retryable).toBe(false);
    expect(err.httpStatus).toBe(status);
    if (msg) expect(err.messageHu).toBe(msg);
    expect(seen).toHaveLength(1);
    expect(sleeps).toEqual([]);
    // Technical message never contains NAV's free text or credentials.
    expect(err.message).not.toContain('valami');
    expect(JSON.stringify(err)).not.toContain(KATA.login);
  });

  it('REQUEST_ID_NOT_UNIQUE is retried at once with a new requestId', async () => {
    const { c, seen, sleeps } = client([navError(400, 'REQUEST_ID_NOT_UNIQUE'), okTaxpayer()]);
    await expect(c.queryTaxpayer('68801234')).resolves.toMatchObject({ valid: true });
    expect(sleeps).toEqual([]);
    expect(requestIdOf(seen[0]!.body)).not.toBe(requestIdOf(seen[1]!.body));
  });

  it('OPERATION_FAILED, maintenance (bare 503) and network errors are retried', async () => {
    const html503: TransportResponse = { status: 503, body: '<html><body>Service Unavailable</body></html>' };
    const { c, sleeps } = client([navError(500, 'OPERATION_FAILED'), html503, new NavError({ code: 'NETWORK' }), okTaxpayer()]);
    await expect(c.queryTaxpayer('68801234')).resolves.toMatchObject({ valid: true });
    expect(sleeps).toEqual([2000, 4000, 8000]);
  });

  it('a non-NavError thrown by the transport becomes NETWORK', async () => {
    const { c } = client([new TypeError('fetch failed'), new TypeError('fetch failed'), new TypeError('fetch failed'), new TypeError('fetch failed')]);
    await expect(c.queryTaxpayer('68801234')).rejects.toMatchObject({ code: 'NETWORK', kind: 'unavailable' });
  });

  it('GeneralExceptionResponse (common namespace, no result wrapper) is understood', async () => {
    const { c } = client([
      {
        status: 400,
        body: '<GeneralExceptionResponse xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common"><funcCode>ERROR</funcCode><errorCode>INVALID_REQUEST</errorCode><message>x</message></GeneralExceptionResponse>',
      },
    ]);
    await expect(c.queryTaxpayer('68801234')).rejects.toMatchObject({ code: 'INVALID_REQUEST', kind: 'bug' });
  });

  it('HTTP 404 without body → config error', async () => {
    const { c } = client([{ status: 404, body: '' }]);
    await expect(c.queryTaxpayer('68801234')).rejects.toMatchObject({ code: 'HTTP_404', kind: 'config', retryable: false });
  });

  it('200 with garbage is retried as BAD_RESPONSE', async () => {
    const { c, sleeps } = client([{ status: 200, body: 'not xml <' }, okTaxpayer()]);
    await expect(c.queryTaxpayer('68801234')).resolves.toMatchObject({ valid: true });
    expect(sleeps).toEqual([2000]);
  });

  it('queryInvoiceData with no invoiceDataResult → INVOICE_NOT_FOUND', async () => {
    const { c } = client([{ status: 200, body: `<QueryInvoiceDataResponse ${NS}>${HDR}<ns2:result><ns2:funcCode>OK</ns2:funcCode></ns2:result>${SW}</QueryInvoiceDataResponse>` }]);
    await expect(c.queryInvoiceData({ invoiceNumber: 'NINCS-1', direction: 'OUTBOUND' })).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND', kind: 'not_found' });
  });

  it('events carry no secrets', async () => {
    const { c, events } = client([navError(401, 'INVALID_SECURITY_USER')]);
    await c.queryTaxpayer('68801234').catch(() => undefined);
    const dump = JSON.stringify(events);
    for (const secret of [KATA.password, KATA.signatureKey, KATA.login]) expect(dump).not.toContain(secret);
    expect(events[0]).toMatchObject({ operation: 'queryTaxpayer', ok: false, code: 'INVALID_SECURITY_USER', willRetry: false });
  });
});

describe('createNavClient – input checks (nothing is sent)', () => {
  it('rejects bad credentials and software up front', () => {
    expect(() => createNavClient({ environment: 'test', credentials: { ...KATA, login: 'ab' }, software: SOFTWARE })).toThrow(NavError);
    expect(() => createNavClient({ environment: 'test', credentials: { ...KATA, taxNumber: '68801235' }, software: SOFTWARE })).toThrow(/INVALID_INPUT/);
    expect(() => createNavClient({ environment: 'test', credentials: KATA, software: { ...SOFTWARE, softwareId: 'short' } })).toThrow(/NOT_CONFIGURED/);
    expect(() => createNavClient({ environment: 'live' as never, credentials: KATA, software: SOFTWARE })).toThrow(NavError);
  });

  it('rejects windows over 35 days and bad pages', async () => {
    const { c, seen } = client([]);
    await expect(c.queryInvoiceDigest({ direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-01-01', to: '2026-02-06' } })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(c.queryInvoiceDigest({ direction: 'OUTBOUND', page: 0, issueDate: { from: '2026-01-01', to: '2026-01-02' } })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(c.queryInvoiceDigest({ direction: 'OUTBOUND', page: 1 })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      c.queryInvoiceDigest({ direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-01-01', to: '2026-01-02' }, insDate: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(seen).toHaveLength(0);
  });

  it('OUTBOUND data queries never send supplierTaxNumber (NAV would refuse)', async () => {
    const { c, seen } = client([{ status: 200, body: `<QueryInvoiceDataResponse ${NS}>${HDR}<ns2:result><ns2:funcCode>OK</ns2:funcCode></ns2:result>${SW}</QueryInvoiceDataResponse>` }]);
    await c.queryInvoiceData({ invoiceNumber: 'A-1', direction: 'OUTBOUND', supplierTaxNumber: '99204059' }).catch(() => undefined);
    expect(seen[0]?.body).not.toContain('supplierTaxNumber');
  });
});

describe('syncOutbound windows', () => {
  const emptyDigest = (): TransportResponse => ({
    status: 200,
    body: `<QueryInvoiceDigestResponse ${NS}>${HDR}<ns2:result><ns2:funcCode>OK</ns2:funcCode></ns2:result>${SW}<invoiceDigestResult><currentPage>1</currentPage><availablePage>0</availablePage></invoiceDigestResult></QueryInvoiceDigestResponse>`,
  });

  it('first run: issue-date windows from 1 Jan to asOf', async () => {
    const { c, seen } = client(Array.from({ length: 20 }, emptyDigest));
    for await (const _ of c.syncOutbound({ since: null, asOf: '2026-11-17' })) void _;
    expect(seen).toHaveLength(10);
    expect(seen[0]?.body).toContain('<dateFrom>2026-01-01</dateFrom><dateTo>2026-02-04</dateTo>');
    expect(seen.at(-1)?.body).toContain('<dateTo>2026-11-17</dateTo>');
  });

  it('first run in January also covers the previous year', async () => {
    const { c, seen } = client(Array.from({ length: 20 }, emptyDigest));
    for await (const _ of c.syncOutbound({ since: null, asOf: '2027-01-10' })) void _;
    expect(seen[0]?.body).toContain('<dateFrom>2026-01-01</dateFrom>');
    expect(seen.at(-1)?.body).toContain('<dateTo>2027-01-10</dateTo>');
  });

  it('later runs: insDate window from cursor − 1 day to now', async () => {
    const { c, seen } = client([emptyDigest()]);
    for await (const _ of c.syncOutbound({ since: '2026-11-16T05:30:00.000Z', asOf: '2026-11-17' })) void _;
    expect(seen).toHaveLength(1);
    expect(seen[0]?.body).toContain('<dateTimeFrom>2026-11-15T05:30:00.000Z</dateTimeFrom><dateTimeTo>2026-11-17T09:00:00.000Z</dateTimeTo>');
  });

  it('a long-stale cursor is split into < 35-day insDate windows', async () => {
    const { c, seen } = client(Array.from({ length: 10 }, emptyDigest));
    for await (const _ of c.syncOutbound({ since: '2026-08-01T00:00:00.000Z', asOf: '2026-11-17' })) void _;
    expect(seen.length).toBe(4);
  });
});
