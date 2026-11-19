// createNavClient – the read-only NAV Online Számla v3.0 client (SPEC §8).
import { newRequestId, navTimestamp } from './crypto.js';
import { codeForHttpStatus, NavError } from './errors.js';
import { decodeInvoiceData, parseInvoiceDataXml } from './invoiceData.js';
import { realClock, RateLimiter, sharedLimiter, type Clock } from './limiter.js';
import { decimalToForint } from './money.js';
import { createHttpTransport } from './transport.js';
import { NAV_BASE_URLS } from './config.js';
import { taxNumber8, validateCredentials, validateSoftware, assertIsoDate, assertIsoTimestamp, assertInvoiceNumber } from './validate.js';
import { assertQueryWindow, splitDateWindows, splitTimeWindows } from './windows.js';
import {
  buildQueryInvoiceChainDigestRequest,
  buildQueryInvoiceDataRequest,
  buildQueryInvoiceDigestRequest,
  buildQueryTaxpayerRequest,
  type RequestContext,
} from './xml/build.js';
import { bool, child, childText, int, list, readResult, type ResultInfo, type XmlNode } from './xml/parse.js';
import type {
  InvoiceChainElement,
  InvoiceDigest,
  InvoiceDirection,
  InvoiceOperation,
  NavCallEvent,
  NavClient,
  NavCredentials,
  NavEnvironment,
  NavReadOperation,
  NavSoftware,
  NormalizedInvoice,
  SyncItem,
  TaxpayerInfo,
  Transport,
} from './types.js';
import { createDemoTransport } from './mock/server.js';

export interface NavClientOptions {
  environment: NavEnvironment;
  credentials: NavCredentials;
  software: NavSoftware;
  /** Default: demo → in-process mock with the shared fixtures; test/prod → HTTPS fetch. */
  transport?: Transport;
  /** Override of the NAV base URL (test/demo only, e.g. a local mock server). Ignored in prod. */
  baseUrl?: string;
  /** Spacing between calls of this process. Default 1000 ms (test/prod), 0 ms (demo). */
  minIntervalMs?: number;
  /** Per-request timeout. Default 60 000 ms (NAV's own boundary timeout). */
  timeoutMs?: number;
  now?: () => Date;
  /** Retries after the first attempt. Default 3 (delays 2 s, 4 s, 8 s). */
  maxRetries?: number;
  retryBaseDelayMs?: number;
  /** Injected for tests; default setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Default: one shared limiter per target host in this process. */
  limiter?: RateLimiter;
  requestIdFactory?: () => string;
  onEvent?: (e: NavCallEvent) => void;
}

const OPERATIONS: readonly InvoiceOperation[] = ['CREATE', 'MODIFY', 'STORNO'];

function toOperation(v: string | undefined): InvoiceOperation {
  return OPERATIONS.includes(v as InvoiceOperation) ? (v as InvoiceOperation) : 'CREATE';
}

/** Maps one invoiceDigest element (invoiceApi.xsd InvoiceDigestType) to the contract model. */
export function mapDigest(d: XmlNode): InvoiceDigest {
  const invoiceNumber = childText(d, 'invoiceNumber');
  const issueDate = childText(d, 'invoiceIssueDate');
  const supplierTaxNumber = childText(d, 'supplierTaxNumber');
  const insDate = childText(d, 'insDate');
  if (!invoiceNumber || !issueDate || !supplierTaxNumber || !insDate) {
    throw new NavError({ code: 'BAD_RESPONSE', navMessage: 'invoiceDigest without mandatory fields' });
  }
  const out: InvoiceDigest = {
    invoiceNumber,
    operation: toOperation(childText(d, 'invoiceOperation')),
    category: childText(d, 'invoiceCategory') ?? 'NORMAL',
    issueDate,
    currency: childText(d, 'currency') ?? 'HUF',
    netAmountHuf: decimalToForint(childText(d, 'invoiceNetAmountHUF') ?? '0', 'invoiceNetAmountHUF'),
    vatAmountHuf: decimalToForint(childText(d, 'invoiceVatAmountHUF') ?? '0', 'invoiceVatAmountHUF'),
    supplierTaxNumber,
    insDate,
  };
  const set = <K extends keyof InvoiceDigest>(k: K, v: InvoiceDigest[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  set('batchIndex', int(childText(d, 'batchIndex')));
  set('deliveryDate', childText(d, 'invoiceDeliveryDate'));
  set('paymentDate', childText(d, 'paymentDate'));
  set('paymentMethod', childText(d, 'paymentMethod'));
  set('supplierName', childText(d, 'supplierName'));
  set('customerName', childText(d, 'customerName'));
  set('customerTaxNumber', childText(d, 'customerTaxNumber'));
  set('originalInvoiceNumber', childText(d, 'originalInvoiceNumber'));
  set('modificationIndex', int(childText(d, 'modificationIndex')));
  set('transactionId', childText(d, 'transactionId'));
  set('index', int(childText(d, 'index')));
  set('source', childText(d, 'source'));
  set('completeness', bool(childText(d, 'completenessIndicator')));
  set('invoiceAppearance', childText(d, 'invoiceAppearance'));
  return out;
}

export function digestKey(d: Pick<InvoiceDigest, 'invoiceNumber' | 'batchIndex' | 'transactionId' | 'index' | 'supplierTaxNumber'>): string {
  return [d.supplierTaxNumber, d.invoiceNumber, d.batchIndex ?? '', d.transactionId ?? '', d.index ?? ''].join('|');
}

export function createNavClient(o: NavClientOptions): NavClient {
  const environment = o.environment;
  if (environment !== 'demo' && environment !== 'test' && environment !== 'prod') {
    throw new NavError({ code: 'NOT_CONFIGURED', navMessage: 'environment must be demo|test|prod' });
  }
  const credentials = validateCredentials(o.credentials);
  const software = validateSoftware(o.software);
  const now = o.now ?? (() => new Date());
  const timeoutMs = o.timeoutMs ?? 60_000;
  const maxRetries = o.maxRetries ?? 3;
  const retryBaseDelayMs = o.retryBaseDelayMs ?? 2_000;
  const sleep = o.sleep ?? realClock.sleep;
  const idFactory = o.requestIdFactory ?? (() => newRequestId());

  let baseUrl: string;
  if (environment === 'prod') baseUrl = NAV_BASE_URLS.prod;
  else if (o.baseUrl) baseUrl = o.baseUrl.replace(/\/+$/, '');
  else baseUrl = environment === 'test' ? NAV_BASE_URLS.test : 'demo://nav-mock/invoiceService/v3';

  const transport: Transport =
    o.transport ?? (environment === 'demo' && !o.baseUrl ? createDemoTransport() : createHttpTransport());
  const minIntervalMs = o.minIntervalMs ?? (environment === 'demo' ? 0 : 1_000);
  const limiter = o.limiter ?? sharedLimiter(new URL(baseUrl.replace(/^demo:/, 'http:')).host, minIntervalMs);
  const isDemo = environment === 'demo';

  function emit(e: NavCallEvent): void {
    try {
      o.onEvent?.(e);
    } catch {
      /* observers must not break calls */
    }
  }

  function interpret(op: NavReadOperation, status: number, body: string): ResultInfo {
    let info: ResultInfo | undefined;
    try {
      info = readResult(body);
    } catch (e) {
      if (status === 200) throw e instanceof NavError ? new NavError({ code: e.code, operation: op, httpStatus: status, navMessage: e.navMessage }) : e;
    }
    const isErrorRoot = info?.root === 'GeneralErrorResponse' || info?.root === 'GeneralExceptionResponse';
    if (info && (info.funcCode === 'ERROR' || isErrorRoot || status !== 200) && info.errorCode) {
      throw new NavError({
        code: info.errorCode,
        funcCode: info.funcCode ?? 'ERROR',
        httpStatus: status,
        operation: op,
        ...(info.message !== undefined ? { navMessage: info.message } : {}),
        validationMessages: info.validationMessages,
      });
    }
    if (status !== 200 || !info) {
      throw new NavError({ code: codeForHttpStatus(status), httpStatus: status, operation: op });
    }
    if (isErrorRoot || info.funcCode !== 'OK') {
      throw new NavError({ code: 'BAD_RESPONSE', httpStatus: status, operation: op, navMessage: `funcCode ${info.funcCode ?? '-'}` });
    }
    return info;
  }

  async function call(op: NavReadOperation, build: (ctx: RequestContext) => string): Promise<ResultInfo> {
    for (let attempt = 0; ; attempt++) {
      const ctx: RequestContext = { requestId: idFactory(), timestamp: navTimestamp(now()), credentials, software };
      const body = build(ctx);
      const started = Date.now();
      try {
        const res = await limiter.schedule(() => transport({ operation: op, url: `${baseUrl}/${op}`, body, timeoutMs }));
        const info = interpret(op, res.status, res.body);
        emit({ operation: op, attempt, ok: true, durationMs: Date.now() - started, httpStatus: res.status });
        return info;
      } catch (e) {
        const err =
          e instanceof NavError
            ? e
            : new NavError({ code: 'NETWORK', operation: op, cause: e });
        const willRetry = err.retryable && attempt < maxRetries;
        emit({
          operation: op,
          attempt,
          ok: false,
          durationMs: Date.now() - started,
          code: err.code,
          willRetry,
          ...(err.httpStatus !== undefined ? { httpStatus: err.httpStatus } : {}),
        });
        if (!willRetry) throw err;
        // REQUEST_ID_NOT_UNIQUE: retry at once (a new requestId is generated for every attempt).
        const delay = err.code === 'REQUEST_ID_NOT_UNIQUE' ? 0 : retryBaseDelayMs * 2 ** attempt;
        if (delay > 0) await sleep(delay);
      }
    }
  }

  function markDemo<T extends { source?: string }>(x: T): T {
    if (isDemo) x.source = 'DEMO';
    return x;
  }

  const client: NavClient = {
    environment,

    async queryInvoiceDigest(p) {
      if (!Number.isInteger(p.page) || p.page < 1) throw new NavError({ code: 'INVALID_INPUT', navMessage: 'page must be ≥ 1' });
      if (p.direction !== 'OUTBOUND' && p.direction !== 'INBOUND') throw new NavError({ code: 'INVALID_INPUT', navMessage: 'bad direction' });
      if ((p.issueDate ? 1 : 0) + (p.insDate ? 1 : 0) !== 1) {
        throw new NavError({ code: 'INVALID_INPUT', navMessage: 'exactly one of issueDate / insDate is required' });
      }
      if (p.issueDate) assertQueryWindow('date', p.issueDate.from, p.issueDate.to);
      if (p.insDate) assertQueryWindow('time', p.insDate.from, p.insDate.to);
      const info = await call('queryInvoiceDigest', (ctx) =>
        buildQueryInvoiceDigestRequest(ctx, {
          direction: p.direction,
          page: p.page,
          ...(p.issueDate ? { issueDate: p.issueDate } : {}),
          ...(p.insDate ? { insDate: p.insDate } : {}),
        }),
      );
      const result = child(info.node, 'invoiceDigestResult');
      if (!result) throw new NavError({ code: 'BAD_RESPONSE', operation: 'queryInvoiceDigest', navMessage: 'no invoiceDigestResult' });
      return {
        currentPage: int(childText(result, 'currentPage')) ?? p.page,
        availablePage: int(childText(result, 'availablePage')) ?? 0,
        digests: list(child(result, 'invoiceDigest')).map((d) => markDemo(mapDigest(d))),
      };
    },

    async queryInvoiceData(p) {
      assertInvoiceNumber(p.invoiceNumber);
      if (p.direction !== 'OUTBOUND' && p.direction !== 'INBOUND') throw new NavError({ code: 'INVALID_INPUT', navMessage: 'bad direction' });
      if (p.batchIndex !== undefined && (!Number.isInteger(p.batchIndex) || p.batchIndex < 1)) {
        throw new NavError({ code: 'INVALID_INPUT', navMessage: 'batchIndex must be ≥ 1' });
      }
      // NAV: an OUTBOUND query must NOT filter by supplier (BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED).
      const supplierTaxNumber =
        p.direction === 'INBOUND' && p.supplierTaxNumber ? taxNumber8(p.supplierTaxNumber, 'supplierTaxNumber') : undefined;
      const info = await call('queryInvoiceData', (ctx) =>
        buildQueryInvoiceDataRequest(ctx, {
          invoiceNumber: p.invoiceNumber,
          direction: p.direction,
          ...(p.batchIndex !== undefined ? { batchIndex: p.batchIndex } : {}),
          ...(supplierTaxNumber ? { supplierTaxNumber } : {}),
        }),
      );
      const result = child(info.node, 'invoiceDataResult');
      if (!result) throw new NavError({ code: 'INVOICE_NOT_FOUND', operation: 'queryInvoiceData' });
      const audit = child(result, 'auditData');
      const compressed = bool(childText(result, 'compressedContentIndicator')) ?? false;
      const rawXml = decodeInvoiceData(childText(result, 'invoiceData') ?? '', compressed);
      const insDate = childText(audit, 'insdate');
      const batchIndex = p.batchIndex ?? int(childText(audit, 'batchIndex'));
      const transactionId = childText(audit, 'transactionId');
      const index = int(childText(audit, 'index'));
      const source = childText(audit, 'source');
      const invoice = parseInvoiceDataXml(rawXml, {
        insDate: insDate ?? '',
        ...(batchIndex !== undefined ? { batchIndex } : {}),
        ...(transactionId ? { transactionId } : {}),
        ...(index !== undefined ? { index } : {}),
        ...(source ? { source } : {}),
      });
      markDemo(invoice);
      return insDate ? { invoice, rawXml, insDate } : { invoice, rawXml };
    },

    async queryTaxpayer(taxNumber) {
      const t = taxNumber8(taxNumber);
      const info = await call('queryTaxpayer', (ctx) => buildQueryTaxpayerRequest(ctx, t));
      const node = info.node;
      const valid = bool(childText(node, 'taxpayerValidity')) ?? false;
      const out: TaxpayerInfo = { valid };
      const data = child(node, 'taxpayerData');
      const infoDate = childText(node, 'infoDate');
      if (infoDate) out.infoDate = infoDate;
      if (data) {
        const set = <K extends keyof TaxpayerInfo>(k: K, v: TaxpayerInfo[K] | undefined) => {
          if (v !== undefined) out[k] = v;
        };
        set('name', childText(data, 'taxpayerName'));
        set('shortName', childText(data, 'taxpayerShortName'));
        set('incorporation', childText(data, 'incorporation'));
        const tn = child(data, 'taxNumberDetail');
        set('vatCode', childText(tn, 'vatCode'));
        set('countyCode', childText(tn, 'countyCode'));
        const items = list(child(child(data, 'taxpayerAddressList'), 'taxpayerAddressItem'));
        const hq = items.find((i) => childText(i, 'taxpayerAddressType') === 'HQ') ?? items[0];
        const a = child(hq, 'taxpayerAddress');
        if (a) {
          const street = [childText(a, 'streetName'), childText(a, 'publicPlaceCategory'), childText(a, 'number')]
            .filter(Boolean)
            .join(' ');
          set('address', [childText(a, 'postalCode'), childText(a, 'city')].filter(Boolean).join(' ') + (street ? `, ${street}` : ''));
        }
      }
      return out;
    },

    async queryInvoiceChainDigest(p) {
      assertInvoiceNumber(p.invoiceNumber);
      const page = p.page ?? 1;
      if (!Number.isInteger(page) || page < 1) throw new NavError({ code: 'INVALID_INPUT', navMessage: 'page must be ≥ 1' });
      const taxNumber = p.taxNumber ? taxNumber8(p.taxNumber) : undefined;
      const info = await call('queryInvoiceChainDigest', (ctx) =>
        buildQueryInvoiceChainDigestRequest(ctx, {
          invoiceNumber: p.invoiceNumber,
          direction: p.direction,
          page,
          ...(taxNumber ? { taxNumber } : {}),
        }),
      );
      const result = child(info.node, 'invoiceChainDigestResult');
      if (!result) throw new NavError({ code: 'BAD_RESPONSE', operation: 'queryInvoiceChainDigest', navMessage: 'no invoiceChainDigestResult' });
      const elements: InvoiceChainElement[] = list(child(result, 'invoiceChainElement')).map((e) => {
        const d = child(e, 'invoiceChainDigest');
        const ref = child(e, 'invoiceReferenceData');
        const el: InvoiceChainElement = {
          invoiceNumber: childText(d, 'invoiceNumber') ?? '',
          operation: toOperation(childText(d, 'invoiceOperation')),
          supplierTaxNumber: childText(d, 'supplierTaxNumber') ?? '',
          insDate: childText(d, 'insDate') ?? '',
        };
        const bi = int(childText(d, 'batchIndex'));
        if (bi !== undefined) el.batchIndex = bi;
        const ct = childText(d, 'customerTaxNumber');
        if (ct) el.customerTaxNumber = ct;
        const v = childText(d, 'originalRequestVersion');
        if (v) el.originalRequestVersion = v;
        const orig = childText(ref, 'originalInvoiceNumber');
        if (orig) el.originalInvoiceNumber = orig;
        const mi = int(childText(ref, 'modificationIndex'));
        if (mi !== undefined) el.modificationIndex = mi;
        return el;
      });
      return {
        currentPage: int(childText(result, 'currentPage')) ?? page,
        availablePage: int(childText(result, 'availablePage')) ?? 0,
        elements,
      };
    },

    syncOutbound(p) {
      return client.syncInvoices({ direction: 'OUTBOUND', since: p.since, asOf: p.asOf });
    },

    syncInvoices(p) {
      return syncImpl(p.direction, p.since, p.asOf);
    },

    async checkConnection() {
      try {
        const t = await client.queryTaxpayer(credentials.taxNumber);
        if (!t.valid) return { ok: false, code: 'TAXPAYER_INVALID', messageHu: 'A NAV szerint ez az adószám nem érvényes.' };
        return {
          ok: true,
          messageHu: isDemo ? 'A kapcsolat működik (DEMO: minta adatok, nem a NAV).' : 'A NAV-kapcsolat működik.',
          ...(t.name ? { taxpayerName: t.name } : {}),
        };
      } catch (e) {
        if (e instanceof NavError) return { ok: false, code: e.code, messageHu: e.messageHu };
        throw e;
      }
    },
  };

  async function* syncImpl(direction: InvoiceDirection, since: string | null, asOf: string): AsyncGenerator<SyncItem> {
    assertIsoDate(asOf, 'asOf');
    let windows: { kind: 'date' | 'time'; from: string; to: string }[];
    if (since === null) {
      const year = Number(asOf.slice(0, 4));
      const startYear = asOf.slice(5, 7) === '01' ? year - 1 : year;
      windows = splitDateWindows(`${startYear}-01-01`, asOf).map((w) => ({ kind: 'date' as const, ...w }));
    } else {
      assertIsoTimestamp(since, 'since');
      const nowIso = now().toISOString();
      let from = new Date(Date.parse(since) - 86_400_000).toISOString();
      if (Date.parse(from) > Date.parse(nowIso)) from = new Date(Date.parse(nowIso) - 86_400_000).toISOString();
      windows = splitTimeWindows(from, nowIso).map((w) => ({ kind: 'time' as const, ...w }));
    }
    const seen = new Set<string>();
    for (const w of windows) {
      let page = 1;
      let available = 1;
      while (page <= available) {
        const r = await client.queryInvoiceDigest({
          direction,
          page,
          ...(w.kind === 'date' ? { issueDate: { from: w.from, to: w.to } } : { insDate: { from: w.from, to: w.to } }),
        });
        available = r.availablePage;
        for (const digest of r.digests) {
          const key = digestKey(digest);
          if (seen.has(key)) continue;
          seen.add(key);
          yield { digest, data: () => fetchFull(direction, digest) };
        }
        page++;
      }
    }
  }

  async function fetchFull(direction: InvoiceDirection, d: InvoiceDigest): Promise<{ invoice: NormalizedInvoice; rawXml: string }> {
    const r = await client.queryInvoiceData({
      invoiceNumber: d.invoiceNumber,
      direction,
      ...(d.batchIndex !== undefined ? { batchIndex: d.batchIndex } : {}),
      ...(direction === 'INBOUND' ? { supplierTaxNumber: d.supplierTaxNumber } : {}),
    });
    // The digest knows what the data XML cannot tell: STORNO vs MODIFY, and the exact NAV metadata.
    const invoice: NormalizedInvoice = { ...r.invoice, operation: d.operation, insDate: d.insDate || r.invoice.insDate };
    if (d.transactionId) invoice.transactionId = d.transactionId;
    if (d.index !== undefined) invoice.index = d.index;
    if (d.source) invoice.source = d.source;
    if (d.batchIndex !== undefined) invoice.batchIndex = d.batchIndex;
    markDemo(invoice);
    return { invoice, rawXml: r.rawXml };
  }

  return client;
}

/** Re-export for consumers that build their own runtime clock. */
export type { Clock };
