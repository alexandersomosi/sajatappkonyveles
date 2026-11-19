// Request XML for the four read-only operations, element order exactly as in invoiceApi.xsd
// (BasicRequestType: header, user; BasicOnlineInvoiceRequestType: software; then the operation body).
import { passwordHash, requestSignature } from '../crypto.js';
import type { InvoiceDirection, NavCredentials, NavSoftware } from '../types.js';
import { el, escapeXml } from './escape.js';

export const NS_API = 'http://schemas.nav.gov.hu/OSA/3.0/api';
export const NS_COMMON = 'http://schemas.nav.gov.hu/NTCA/1.0/common';
export const NS_BASE = 'http://schemas.nav.gov.hu/OSA/3.0/base';
export const NS_DATA = 'http://schemas.nav.gov.hu/OSA/3.0/data';

export const REQUEST_VERSION = '3.0';
export const HEADER_VERSION = '1.0';

export interface RequestContext {
  requestId: string;
  /** UTC ISO-8601 with milliseconds, e.g. 2026-11-17T05:30:00.000Z */
  timestamp: string;
  credentials: NavCredentials;
  software: NavSoftware;
}

function commonHeaderAndUser(ctx: RequestContext): string {
  const { requestId, timestamp, credentials } = ctx;
  return (
    '\n  <common:header>' +
    el('common:requestId', requestId) +
    el('common:timestamp', timestamp) +
    el('common:requestVersion', REQUEST_VERSION) +
    el('common:headerVersion', HEADER_VERSION) +
    '</common:header>' +
    '\n  <common:user>' +
    el('common:login', credentials.login) +
    `<common:passwordHash cryptoType="SHA-512">${passwordHash(credentials.password)}</common:passwordHash>` +
    el('common:taxNumber', credentials.taxNumber) +
    `<common:requestSignature cryptoType="SHA3-512">${requestSignature(requestId, timestamp, credentials.signatureKey)}</common:requestSignature>` +
    '</common:user>'
  );
}

export function softwareXml(s: NavSoftware): string {
  return (
    '<software>' +
    el('softwareId', s.softwareId) +
    el('softwareName', s.softwareName) +
    el('softwareOperation', 'ONLINE_SERVICE') +
    el('softwareMainVersion', s.softwareMainVersion) +
    el('softwareDevName', s.softwareDevName) +
    el('softwareDevContact', s.softwareDevContact) +
    el('softwareDevCountryCode', s.softwareDevCountryCode) +
    el('softwareDevTaxNumber', s.softwareDevTaxNumber) +
    '</software>'
  );
}

function envelope(root: string, ctx: RequestContext, body: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<${root} xmlns="${NS_API}" xmlns:common="${NS_COMMON}">` +
    commonHeaderAndUser(ctx) +
    '\n  ' +
    softwareXml(ctx.software) +
    body +
    `\n</${root}>\n`
  );
}

export interface DigestQuery {
  direction: InvoiceDirection;
  page: number;
  issueDate?: { from: string; to: string };
  insDate?: { from: string; to: string };
  originalInvoiceNumber?: string;
}

export function buildQueryInvoiceDigestRequest(ctx: RequestContext, q: DigestQuery): string {
  let mandatory: string;
  if (q.issueDate) {
    mandatory = `<invoiceIssueDate>${el('dateFrom', q.issueDate.from)}${el('dateTo', q.issueDate.to)}</invoiceIssueDate>`;
  } else if (q.insDate) {
    mandatory = `<insDate>${el('dateTimeFrom', q.insDate.from)}${el('dateTimeTo', q.insDate.to)}</insDate>`;
  } else if (q.originalInvoiceNumber !== undefined) {
    mandatory = el('originalInvoiceNumber', q.originalInvoiceNumber);
  } else {
    throw new TypeError('one of issueDate, insDate, originalInvoiceNumber is required');
  }
  const body =
    '\n  ' +
    el('page', q.page) +
    '\n  ' +
    el('invoiceDirection', q.direction) +
    `\n  <invoiceQueryParams><mandatoryQueryParams>${mandatory}</mandatoryQueryParams></invoiceQueryParams>`;
  return envelope('QueryInvoiceDigestRequest', ctx, body);
}

export interface DataQuery {
  invoiceNumber: string;
  direction: InvoiceDirection;
  batchIndex?: number;
  supplierTaxNumber?: string;
}

export function buildQueryInvoiceDataRequest(ctx: RequestContext, q: DataQuery): string {
  const body =
    '\n  <invoiceNumberQuery>' +
    el('invoiceNumber', q.invoiceNumber) +
    el('invoiceDirection', q.direction) +
    el('batchIndex', q.batchIndex) +
    el('supplierTaxNumber', q.supplierTaxNumber) +
    '</invoiceNumberQuery>';
  return envelope('QueryInvoiceDataRequest', ctx, body);
}

export function buildQueryTaxpayerRequest(ctx: RequestContext, taxNumber: string): string {
  return envelope('QueryTaxpayerRequest', ctx, `\n  ${el('taxNumber', taxNumber)}`);
}

export interface ChainQuery {
  invoiceNumber: string;
  direction: InvoiceDirection;
  taxNumber?: string;
  page: number;
}

export function buildQueryInvoiceChainDigestRequest(ctx: RequestContext, q: ChainQuery): string {
  const body =
    '\n  ' +
    el('page', q.page) +
    '\n  <invoiceChainQuery>' +
    el('invoiceNumber', q.invoiceNumber) +
    el('invoiceDirection', q.direction) +
    el('taxNumber', q.taxNumber) +
    '</invoiceChainQuery>';
  return envelope('QueryInvoiceChainDigestRequest', ctx, body);
}

export { escapeXml };
