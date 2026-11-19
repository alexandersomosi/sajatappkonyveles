// NAV Online Számla v3.0 MOCK (DEMO mode). Speaks the same XML contract as NAV for the four read
// operations, validates the request header like NAV does, and answers with FICTIONAL data only.
// Every invoice it returns carries source "DEMO" (outside NAV's own SourceType list on purpose).
import { createHash } from 'node:crypto';
import { loadDefaultDemoFixtures } from '../assets.js';
import { passwordHash, requestSignature, REQUEST_ID_RE } from '../crypto.js';
import { NS_API, NS_BASE, NS_COMMON, NS_DATA } from '../xml/build.js';
import { el } from '../xml/escape.js';
import { child, childText, int, parseXml, rootOf, text, type XmlNode } from '../xml/parse.js';
import { LOGIN_RE, SOFTWARE_ID_RE, isValidTaxNumber } from '../validate.js';
import { budapestDate, daysBetween } from '../windows.js';
import { READ_OPERATIONS, type DemoFixtures, type NavReadOperation } from '../types.js';
import { MockDataset, demoCredentialsFor, type MockInvoice } from './dataset.js';
import { buildInvoiceDataXml, encodeInvoiceData } from './invoiceXml.js';

export interface MockTechnicalUser {
  login: string;
  password: string;
  signatureKey: string;
  taxNumber: string;
}

export interface MockOptions {
  /** Default: kod/shared/demo/fixtures.json. */
  fixtures?: DemoFixtures;
  /** Mock server clock (timestamp tolerance, "today" for which invoices exist). Default: real time. */
  now?: () => Date;
  /** Business date for which invoices exist (YYYY-MM-DD). Default: today in Europe/Budapest by `now`. */
  today?: string;
  /** NAV returns at most 100 digests per page. Smaller values help paging tests. */
  pageSize?: number;
  /**
   * Logins checked strictly (password hash + signature recomputed). Default: one fictional user per
   * fixture taxpayer (demoCredentialsFor). Any OTHER well-formed login is accepted (DEMO), except the
   * trigger prefixes: hibas… → INVALID_SECURITY_USER, rosszkulcs… → INVALID_REQUEST_SIGNATURE,
   * nincsjog… → FORBIDDEN, karbantart… → HTTP 503 (maintenance), nemvalid… → NOT_REGISTERED_CUSTOMER.
   */
  users?: MockTechnicalUser[];
  /** queryInvoiceData compression: mixed (default, alternating), always, never. */
  compression?: 'mixed' | 'always' | 'never';
}

export interface MockResponse {
  status: number;
  body: string;
  contentType: string;
}

export type MockHandler = (operation: string, body: string) => MockResponse;

const XML_CT = 'application/xml;charset=UTF-8';

/** HTTP status NAV uses for each error code (interface spec 3.0, ch. 3.2). */
const STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  INVALID_SECURITY_USER: 401,
  NOT_REGISTERED_CUSTOMER: 500,
  INVALID_CUSTOMER: 500,
  INVALID_USER_RELATION: 500,
  FORBIDDEN: 500,
  REQUEST_ID_NOT_UNIQUE: 400,
  INVALID_REQUEST_SIGNATURE: 400,
  INVALID_TIMESTAMP: 400,
  INVALID_PASSWORD_HASH_CRYPTO: 400,
  INVALID_REQUEST_SIGNATURE_HASH_CRYPTO: 400,
  INVALID_REQUEST_VERSION: 400,
  INVALID_HEADER_VERSION: 400,
  MULTIPLE_QUERY_RESULT_FOUND: 400,
  BAD_QUERY_PARAM_OVERLAP: 400,
  BAD_QUERY_PARAM_RANGE_EXCEEDED: 400,
  BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED: 400,
  BAD_QUERY_PARAM_SUPPLIER_EXPECTED: 400,
  OPERATION_FAILED: 500,
};

const MESSAGES: Record<string, string> = {
  INVALID_REQUEST: 'Sémavalidációs hiba (DEMO mock).',
  INVALID_SECURITY_USER: 'Helytelen authentikációs adatok! (DEMO mock)',
  NOT_REGISTERED_CUSTOMER: 'Nem regisztrált adózó. (DEMO mock)',
  INVALID_USER_RELATION: 'A technikai felhasználó nem ehhez az adószámhoz tartozik. (DEMO mock)',
  FORBIDDEN: 'Nincs jogosultság a művelethez. (DEMO mock)',
  REQUEST_ID_NOT_UNIQUE: 'A kérésazonosító nem egyedi. (DEMO mock)',
  INVALID_REQUEST_SIGNATURE: 'Helytelen kérés aláírás! (DEMO mock)',
  INVALID_TIMESTAMP: 'A kérés időbélyege a megengedett tartományon kívül esik. (DEMO mock)',
  INVALID_PASSWORD_HASH_CRYPTO: 'A jelszó hash algoritmusa nem SHA-512. (DEMO mock)',
  INVALID_REQUEST_SIGNATURE_HASH_CRYPTO: 'Az aláírás algoritmusa nem SHA3-512. (DEMO mock)',
  INVALID_REQUEST_VERSION: 'Érvénytelen requestVersion. (DEMO mock)',
  INVALID_HEADER_VERSION: 'Érvénytelen headerVersion. (DEMO mock)',
  BAD_QUERY_PARAM_OVERLAP: 'A dátumok átfedik egymást. (DEMO mock)',
  BAD_QUERY_PARAM_RANGE_EXCEEDED: 'A lekérdezett időszak hosszabb 35 napnál. (DEMO mock)',
  BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED: 'Eladói oldali lekérdezésnél nem adható meg az eladó adószáma. (DEMO mock)',
  BAD_QUERY_PARAM_SUPPLIER_EXPECTED: 'Az eladó adószáma szükséges. (DEMO mock)',
};

/** Allowed child order of each request root (invoiceApi.xsd sequences). */
const SEQUENCES: Record<NavReadOperation, { root: string; children: string[]; required: string[] }> = {
  queryInvoiceDigest: {
    root: 'QueryInvoiceDigestRequest',
    children: ['header', 'user', 'software', 'page', 'invoiceDirection', 'invoiceQueryParams'],
    required: ['header', 'user', 'software', 'page', 'invoiceDirection', 'invoiceQueryParams'],
  },
  queryInvoiceData: {
    root: 'QueryInvoiceDataRequest',
    children: ['header', 'user', 'software', 'invoiceNumberQuery'],
    required: ['header', 'user', 'software', 'invoiceNumberQuery'],
  },
  queryTaxpayer: {
    root: 'QueryTaxpayerRequest',
    children: ['header', 'user', 'software', 'taxNumber'],
    required: ['header', 'user', 'software', 'taxNumber'],
  },
  queryInvoiceChainDigest: {
    root: 'QueryInvoiceChainDigestRequest',
    children: ['header', 'user', 'software', 'page', 'invoiceChainQuery'],
    required: ['header', 'user', 'software', 'page', 'invoiceChainQuery'],
  },
};

const HEADER_SEQ = ['requestId', 'timestamp', 'requestVersion', 'headerVersion'];
const USER_SEQ = ['login', 'passwordHash', 'taxNumber', 'requestSignature'];
const SOFTWARE_SEQ = [
  'softwareId',
  'softwareName',
  'softwareOperation',
  'softwareMainVersion',
  'softwareDevName',
  'softwareDevContact',
  'softwareDevCountryCode',
  'softwareDevTaxNumber',
];

class MockFault extends Error {
  constructor(
    readonly code: string,
    readonly detail?: string,
  ) {
    super(code);
  }
}

/** Element names (document order) of an object parsed by fast-xml-parser. */
function elementKeys(node: XmlNode): string[] {
  if (!node || typeof node !== 'object') return [];
  return Object.keys(node).filter((k) => !k.startsWith('@_') && k !== '#text');
}

function checkSequence(node: XmlNode, order: string[], required: string[], where: string): void {
  const keys = elementKeys(node);
  let pos = -1;
  for (const k of keys) {
    const i = order.indexOf(k);
    if (i < 0) throw new MockFault('INVALID_REQUEST', `${where}: unexpected element ${k}`);
    if (i <= pos) throw new MockFault('INVALID_REQUEST', `${where}: element ${k} out of order`);
    if (Array.isArray(node[k])) throw new MockFault('INVALID_REQUEST', `${where}: element ${k} repeated`);
    pos = i;
  }
  for (const r of required) if (!keys.includes(r)) throw new MockFault('INVALID_REQUEST', `${where}: missing ${r}`);
}

interface ParsedRequest {
  op: NavReadOperation;
  node: XmlNode;
  requestId: string;
  taxNumber: string;
  login: string;
  softwareXml: string;
  headerXml: string;
}

export function createMockHandler(opts: MockOptions = {}): MockHandler {
  const fixtures = opts.fixtures ?? loadDefaultDemoFixtures();
  const dataset = new MockDataset(fixtures);
  const now = opts.now ?? (() => new Date());
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? 100));
  const compression = opts.compression ?? 'mixed';
  const users = new Map<string, MockTechnicalUser>();
  for (const u of opts.users ?? Object.keys(fixtures.navInvoices ?? {}).map((t) => demoCredentialsFor(t))) users.set(u.login, u);
  const usedRequestIds = new Map<string, Set<string>>();

  function rememberRequestId(taxNumber: string, requestId: string): void {
    let s = usedRequestIds.get(taxNumber);
    if (!s) {
      s = new Set();
      usedRequestIds.set(taxNumber, s);
    }
    if (s.size > 50_000) s.clear(); // bounded memory; NAV's own window is the ±1 day tolerance
    s.add(requestId);
  }

  function responseHeader(requestId: string): string {
    return (
      '<ns2:header>' +
      el('ns2:requestId', requestId) +
      el('ns2:timestamp', now().toISOString()) +
      el('ns2:requestVersion', '3.0') +
      el('ns2:headerVersion', '1.0') +
      '</ns2:header>'
    );
  }

  function wrap(root: string, inner: string): string {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      `<${root} xmlns="${NS_API}" xmlns:ns2="${NS_COMMON}" xmlns:ns3="${NS_BASE}" xmlns:ns4="${NS_DATA}">` +
      inner +
      `</${root}>\n`
    );
  }

  function ok(req: ParsedRequest, root: string, inner: string): MockResponse {
    return {
      status: 200,
      contentType: XML_CT,
      body: wrap(root, req.headerXml + '<ns2:result><ns2:funcCode>OK</ns2:funcCode></ns2:result>' + req.softwareXml + inner),
    };
  }

  function fault(code: string, req: Partial<ParsedRequest>, detail?: string): MockResponse {
    if (code === 'MAINTENANCE_MODE') {
      // NAV's network device turns HTTP 527 MAINTENANCE_MODE into a bare HTTP 503.
      return { status: 503, contentType: 'text/html;charset=UTF-8', body: '<html><body>503 Service Unavailable (DEMO mock)</body></html>' };
    }
    const status = STATUS[code] ?? 500;
    const message = MESSAGES[code] ?? code;
    if (!req.headerXml || !req.softwareXml) {
      // GeneralExceptionResponse lives in the NTCA common namespace (common.xsd, BasicResultType).
      return {
        status,
        contentType: XML_CT,
        body:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
          `<GeneralExceptionResponse xmlns="${NS_COMMON}">` +
          el('funcCode', 'ERROR') +
          el('errorCode', code) +
          el('message', message) +
          '</GeneralExceptionResponse>\n',
      };
    }
    const validation = detail
      ? `<technicalValidationMessages>${el('validationResultCode', 'ERROR')}${el('validationErrorCode', 'SCHEMA_VIOLATION')}${el('message', detail.slice(0, 1000))}</technicalValidationMessages>`
      : '';
    return {
      status,
      contentType: XML_CT,
      body: wrap(
        'GeneralErrorResponse',
        req.headerXml +
          `<ns2:result>${el('ns2:funcCode', 'ERROR')}${el('ns2:errorCode', code)}${el('ns2:message', message)}</ns2:result>` +
          req.softwareXml +
          validation,
      ),
    };
  }

  function parseRequest(op: NavReadOperation, body: string, partial: Partial<ParsedRequest>): ParsedRequest {
    let doc: Record<string, XmlNode>;
    try {
      doc = parseXml(body);
    } catch {
      throw new MockFault('INVALID_REQUEST', 'request is not well-formed XML');
    }
    const { name, node } = rootOf(doc);
    const seq = SEQUENCES[op];
    if (name !== seq.root) throw new MockFault('INVALID_REQUEST', `root must be ${seq.root}`);
    const rootTag = /<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b[^>]*>/.exec(body.replace(/<\?xml[^>]*\?>/, ''))?.[0] ?? '';
    if (!rootTag.includes(`"${NS_API}"`) || !body.includes(`"${NS_COMMON}"`)) {
      throw new MockFault('INVALID_REQUEST', 'wrong or missing namespaces');
    }
    checkSequence(node, seq.children, seq.required, seq.root);
    const header = child(node, 'header');
    const user = child(node, 'user');
    const software = child(node, 'software');
    checkSequence(header, HEADER_SEQ, ['requestId', 'timestamp', 'requestVersion'], 'header');
    checkSequence(user, USER_SEQ, USER_SEQ, 'user');
    checkSequence(software, SOFTWARE_SEQ, SOFTWARE_SEQ.slice(0, 6), 'software');

    const requestId = childText(header, 'requestId') ?? '';
    if (!REQUEST_ID_RE.test(requestId)) throw new MockFault('INVALID_REQUEST', 'requestId pattern');
    partial.headerXml = responseHeader(requestId);
    const softwareId = childText(software, 'softwareId') ?? '';
    const swOp = childText(software, 'softwareOperation');
    if (!SOFTWARE_ID_RE.test(softwareId) || (swOp !== 'LOCAL_SOFTWARE' && swOp !== 'ONLINE_SERVICE')) {
      throw new MockFault('INVALID_REQUEST', 'software block invalid');
    }
    partial.softwareXml =
      '<software>' + SOFTWARE_SEQ.map((k) => el(k, childText(software, k))).join('') + '</software>';

    const timestamp = childText(header, 'timestamp') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(timestamp)) throw new MockFault('INVALID_REQUEST', 'timestamp pattern');
    if (Math.abs(Date.parse(timestamp) - now().getTime()) > 86_400_000) throw new MockFault('INVALID_TIMESTAMP');
    if (childText(header, 'requestVersion') !== '3.0') throw new MockFault('INVALID_REQUEST_VERSION');
    const hv = childText(header, 'headerVersion');
    if (hv !== undefined && hv !== '1.0') throw new MockFault('INVALID_HEADER_VERSION');

    const login = childText(user, 'login') ?? '';
    if (!LOGIN_RE.test(login)) throw new MockFault('INVALID_REQUEST', 'login pattern');
    const taxNumber = childText(user, 'taxNumber') ?? '';
    if (!/^\d{8}$/.test(taxNumber)) throw new MockFault('INVALID_REQUEST', 'taxNumber pattern');
    const pwNode = child(user, 'passwordHash');
    const sigNode = child(user, 'requestSignature');
    if (pwNode?.['@_cryptoType'] !== 'SHA-512') throw new MockFault('INVALID_PASSWORD_HASH_CRYPTO');
    if (sigNode?.['@_cryptoType'] !== 'SHA3-512') throw new MockFault('INVALID_REQUEST_SIGNATURE_HASH_CRYPTO');
    const pw = text(pwNode) ?? '';
    const sig = text(sigNode) ?? '';
    if (!/^[0-9A-F]{128}$/.test(pw)) throw new MockFault('INVALID_SECURITY_USER');
    if (!/^[0-9A-F]{128}$/.test(sig)) throw new MockFault('INVALID_REQUEST_SIGNATURE');

    const lower = login.toLowerCase();
    const registered = users.get(login);
    if (registered) {
      if (pw !== passwordHash(registered.password)) throw new MockFault('INVALID_SECURITY_USER');
      if (registered.taxNumber !== taxNumber) throw new MockFault('INVALID_USER_RELATION');
      if (sig !== requestSignature(requestId, timestamp, registered.signatureKey)) {
        rememberRequestId(taxNumber, requestId);
        throw new MockFault('INVALID_REQUEST_SIGNATURE');
      }
    } else if (lower.startsWith('hibas')) {
      throw new MockFault('INVALID_SECURITY_USER');
    } else if (lower.startsWith('rosszkulcs')) {
      rememberRequestId(taxNumber, requestId);
      throw new MockFault('INVALID_REQUEST_SIGNATURE');
    } else if (lower.startsWith('nincsjog')) {
      rememberRequestId(taxNumber, requestId);
      throw new MockFault('FORBIDDEN');
    } else if (lower.startsWith('karbantart')) {
      throw new MockFault('MAINTENANCE_MODE');
    } else if (lower.startsWith('nemvalid') || !isValidTaxNumber(taxNumber)) {
      throw new MockFault('NOT_REGISTERED_CUSTOMER');
    }
    if (usedRequestIds.get(taxNumber)?.has(requestId)) throw new MockFault('REQUEST_ID_NOT_UNIQUE');
    rememberRequestId(taxNumber, requestId);
    return { op, node, requestId, taxNumber, login, softwareXml: partial.softwareXml, headerXml: partial.headerXml };
  }

  function digestXml(inv: MockInvoice): string {
    const c = inv.customer;
    return (
      '<invoiceDigest>' +
      el('invoiceNumber', inv.invoiceNumber) +
      el('invoiceOperation', inv.operation) +
      el('invoiceCategory', inv.category || 'NORMAL') +
      el('invoiceIssueDate', inv.issueDate) +
      el('supplierTaxNumber', inv.supplierTaxNumber) +
      el('supplierName', inv.supplierName ?? inv.supplier.name) +
      (c.vatStatus !== 'PRIVATE_PERSON' ? el('customerTaxNumber', c.taxNumber) + el('customerName', c.name) : '') +
      el('paymentMethod', inv.paymentMethod) +
      el('paymentDate', inv.paymentDate) +
      el('invoiceAppearance', 'ELECTRONIC') +
      el('source', 'DEMO') +
      el('invoiceDeliveryDate', inv.deliveryDate ?? inv.issueDate) +
      el('currency', inv.currency || 'HUF') +
      el('invoiceNetAmount', inv.netAmountHuf) +
      el('invoiceNetAmountHUF', inv.netAmountHuf) +
      el('invoiceVatAmount', inv.vatAmountHuf) +
      el('invoiceVatAmountHUF', inv.vatAmountHuf) +
      el('transactionId', inv.transactionId) +
      el('index', inv.index) +
      el('originalInvoiceNumber', inv.originalInvoiceNumber) +
      el('modificationIndex', inv.modificationIndex) +
      el('insDate', inv.insDate) +
      el('completenessIndicator', 'false') +
      '</invoiceDigest>'
    );
  }

  function invoicesFor(taxNumber: string, direction: string): MockInvoice[] {
    const asOf = opts.today ?? budapestDate(now());
    return direction === 'INBOUND' ? dataset.inbound(taxNumber, asOf) : dataset.outbound(taxNumber, asOf);
  }

  function sortByInsDate(a: MockInvoice[]): MockInvoice[] {
    return [...a].sort((x, y) => (x.insDate === y.insDate ? x.invoiceNumber.localeCompare(y.invoiceNumber) : x.insDate < y.insDate ? -1 : 1));
  }

  function queryInvoiceDigest(req: ParsedRequest): MockResponse {
    const page = int(childText(req.node, 'page'));
    const direction = childText(req.node, 'invoiceDirection');
    if (page === undefined || page < 1) throw new MockFault('INVALID_REQUEST', 'page must be ≥ 1');
    if (direction !== 'OUTBOUND' && direction !== 'INBOUND') throw new MockFault('INVALID_REQUEST', 'invoiceDirection');
    const params = child(req.node, 'invoiceQueryParams');
    checkSequence(params, ['mandatoryQueryParams', 'additionalQueryParams', 'relationalQueryParams', 'transactionQueryParams'], ['mandatoryQueryParams'], 'invoiceQueryParams');
    const mandatory = child(params, 'mandatoryQueryParams');
    const keys = elementKeys(mandatory);
    if (keys.length !== 1) throw new MockFault('INVALID_REQUEST', 'mandatoryQueryParams needs exactly one choice');
    let all = invoicesFor(req.taxNumber, direction);
    const issue = child(mandatory, 'invoiceIssueDate');
    const ins = child(mandatory, 'insDate');
    const orig = childText(mandatory, 'originalInvoiceNumber');
    if (issue) {
      checkSequence(issue, ['dateFrom', 'dateTo'], ['dateFrom', 'dateTo'], 'invoiceIssueDate');
      const from = childText(issue, 'dateFrom') ?? '';
      const to = childText(issue, 'dateTo') ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new MockFault('INVALID_REQUEST', 'date pattern');
      if (from > to) throw new MockFault('BAD_QUERY_PARAM_OVERLAP');
      if (daysBetween(from, to) > 35) throw new MockFault('BAD_QUERY_PARAM_RANGE_EXCEEDED');
      all = all.filter((i) => i.issueDate >= from && i.issueDate <= to);
    } else if (ins) {
      checkSequence(ins, ['dateTimeFrom', 'dateTimeTo'], ['dateTimeFrom', 'dateTimeTo'], 'insDate');
      const from = Date.parse(childText(ins, 'dateTimeFrom') ?? '');
      const to = Date.parse(childText(ins, 'dateTimeTo') ?? '');
      if (Number.isNaN(from) || Number.isNaN(to)) throw new MockFault('INVALID_REQUEST', 'dateTime pattern');
      if (from > to) throw new MockFault('BAD_QUERY_PARAM_OVERLAP');
      if (to - from > 35 * 86_400_000) throw new MockFault('BAD_QUERY_PARAM_RANGE_EXCEEDED');
      all = all.filter((i) => {
        const t = Date.parse(i.insDate);
        return t >= from && t <= to && (opts.today !== undefined || t <= now().getTime());
      });
    } else if (orig !== undefined) {
      all = all.filter((i) => i.invoiceNumber === orig || i.originalInvoiceNumber === orig);
    } else {
      throw new MockFault('INVALID_REQUEST', 'unknown mandatory query parameter');
    }
    const sorted = sortByInsDate(all);
    const availablePage = Math.ceil(sorted.length / pageSize);
    const items = sorted.slice((page - 1) * pageSize, page * pageSize);
    return ok(
      req,
      'QueryInvoiceDigestResponse',
      '<invoiceDigestResult>' + el('currentPage', page) + el('availablePage', availablePage) + items.map(digestXml).join('') + '</invoiceDigestResult>',
    );
  }

  function queryInvoiceData(req: ParsedRequest): MockResponse {
    const q = child(req.node, 'invoiceNumberQuery');
    checkSequence(q, ['invoiceNumber', 'invoiceDirection', 'batchIndex', 'supplierTaxNumber'], ['invoiceNumber', 'invoiceDirection'], 'invoiceNumberQuery');
    const number = childText(q, 'invoiceNumber') ?? '';
    const direction = childText(q, 'invoiceDirection');
    const supplierTax = childText(q, 'supplierTaxNumber');
    if (direction !== 'OUTBOUND' && direction !== 'INBOUND') throw new MockFault('INVALID_REQUEST', 'invoiceDirection');
    if (direction === 'OUTBOUND' && supplierTax !== undefined) throw new MockFault('BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED');
    let hits = invoicesFor(req.taxNumber, direction).filter((i) => i.invoiceNumber === number);
    if (direction === 'INBOUND') {
      if (supplierTax !== undefined) hits = hits.filter((i) => i.supplierTaxNumber === supplierTax);
      else if (new Set(hits.map((i) => i.supplierTaxNumber)).size > 1) throw new MockFault('BAD_QUERY_PARAM_SUPPLIER_EXPECTED');
    }
    if (hits.length > 1) throw new MockFault('MULTIPLE_QUERY_RESULT_FOUND');
    const inv = hits[0];
    if (!inv) return ok(req, 'QueryInvoiceDataResponse', '');
    const xml = buildInvoiceDataXml(inv);
    const compressed =
      compression === 'always' ? true : compression === 'never' ? false : (createHash('sha256').update(inv.invoiceNumber).digest()[0] ?? 0) % 2 === 0;
    return ok(
      req,
      'QueryInvoiceDataResponse',
      '<invoiceDataResult>' +
        el('invoiceData', encodeInvoiceData(xml, compressed)) +
        '<auditData>' +
        el('insdate', inv.insDate) +
        el('insCusUser', 'demoszamlazo') +
        el('source', 'DEMO') +
        el('transactionId', inv.transactionId) +
        el('index', inv.index) +
        el('originalRequestVersion', '3.0') +
        '</auditData>' +
        el('compressedContentIndicator', compressed ? 'true' : 'false') +
        '</invoiceDataResult>',
    );
  }

  function queryTaxpayer(req: ParsedRequest): MockResponse {
    const t = childText(req.node, 'taxNumber') ?? '';
    if (!/^\d{8}$/.test(t)) throw new MockFault('INVALID_REQUEST', 'taxNumber pattern');
    const p = dataset.party(t);
    if (!p) return ok(req, 'QueryTaxpayerResponse', el('taxpayerValidity', 'false'));
    const a = p.address;
    return ok(
      req,
      'QueryTaxpayerResponse',
      el('infoDate', '2026-01-08T00:00:00.000Z') +
        el('taxpayerValidity', 'true') +
        '<taxpayerData>' +
        el('taxpayerName', p.name) +
        `<taxNumberDetail>${el('ns3:taxpayerId', p.taxNumber)}${el('ns3:vatCode', p.vatCode)}${el('ns3:countyCode', p.countyCode)}</taxNumberDetail>` +
        el('incorporation', p.incorporation) +
        '<taxpayerAddressList><taxpayerAddressItem>' +
        el('taxpayerAddressType', 'HQ') +
        '<taxpayerAddress>' +
        el('ns3:countryCode', 'HU') +
        el('ns3:postalCode', a.postalCode) +
        el('ns3:city', a.city) +
        el('ns3:streetName', a.streetName) +
        el('ns3:publicPlaceCategory', a.publicPlaceCategory) +
        el('ns3:number', a.number) +
        '</taxpayerAddress></taxpayerAddressItem></taxpayerAddressList>' +
        '</taxpayerData>',
    );
  }

  function queryInvoiceChainDigest(req: ParsedRequest): MockResponse {
    const page = int(childText(req.node, 'page'));
    if (page === undefined || page < 1) throw new MockFault('INVALID_REQUEST', 'page must be ≥ 1');
    const q = child(req.node, 'invoiceChainQuery');
    checkSequence(q, ['invoiceNumber', 'invoiceDirection', 'taxNumber'], ['invoiceNumber', 'invoiceDirection'], 'invoiceChainQuery');
    const number = childText(q, 'invoiceNumber') ?? '';
    const direction = childText(q, 'invoiceDirection') ?? '';
    if (direction !== 'OUTBOUND' && direction !== 'INBOUND') throw new MockFault('INVALID_REQUEST', 'invoiceDirection');
    const chain = sortByInsDate(invoicesFor(req.taxNumber, direction).filter((i) => i.invoiceNumber === number || i.originalInvoiceNumber === number));
    const availablePage = Math.ceil(chain.length / pageSize);
    const items = chain.slice((page - 1) * pageSize, page * pageSize);
    const elements = items
      .map(
        (i) =>
          '<invoiceChainElement><invoiceChainDigest>' +
          el('invoiceNumber', i.invoiceNumber) +
          el('invoiceOperation', i.operation) +
          el('supplierTaxNumber', i.supplierTaxNumber) +
          (i.customer.vatStatus !== 'PRIVATE_PERSON' ? el('customerTaxNumber', i.customer.taxNumber) : '') +
          el('insDate', i.insDate) +
          el('originalRequestVersion', '3.0') +
          '</invoiceChainDigest>' +
          (i.originalInvoiceNumber
            ? `<invoiceReferenceData>${el('originalInvoiceNumber', i.originalInvoiceNumber)}${el('modifyWithoutMaster', 'false')}${el('modificationIndex', i.modificationIndex ?? 1)}</invoiceReferenceData>`
            : '') +
          '</invoiceChainElement>',
      )
      .join('');
    return ok(
      req,
      'QueryInvoiceChainDigestResponse',
      '<invoiceChainDigestResult>' + el('currentPage', page) + el('availablePage', availablePage) + elements + '</invoiceChainDigestResult>',
    );
  }

  return (operation: string, body: string): MockResponse => {
    if (!(READ_OPERATIONS as readonly string[]).includes(operation)) {
      return { status: 404, contentType: 'text/plain;charset=UTF-8', body: 'Not Found' };
    }
    const op = operation as NavReadOperation;
    const partial: Partial<ParsedRequest> = {};
    try {
      const req = parseRequest(op, body, partial);
      switch (op) {
        case 'queryInvoiceDigest':
          return queryInvoiceDigest(req);
        case 'queryInvoiceData':
          return queryInvoiceData(req);
        case 'queryTaxpayer':
          return queryTaxpayer(req);
        case 'queryInvoiceChainDigest':
          return queryInvoiceChainDigest(req);
      }
    } catch (e) {
      if (e instanceof MockFault) return fault(e.code, partial, e.detail);
      return fault('OPERATION_FAILED', partial);
    }
  };
}
