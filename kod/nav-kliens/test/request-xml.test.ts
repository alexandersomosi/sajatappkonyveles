import { describe, expect, it } from 'vitest';
import {
  buildQueryInvoiceChainDigestRequest,
  buildQueryInvoiceDataRequest,
  buildQueryInvoiceDigestRequest,
  buildQueryTaxpayerRequest,
  type RequestContext,
} from '../src/xml/build.js';
import { parseXml, rootOf } from '../src/xml/parse.js';
import { KATA, SOFTWARE } from './helpers.js';

const ctx: RequestContext = {
  requestId: 'KJ00000000000000000000000001',
  timestamp: '2026-11-17T05:30:00.000Z',
  credentials: KATA,
  software: SOFTWARE,
};

describe('request XML (snapshots + structure)', () => {
  it('queryInvoiceDigest with issue-date window', () => {
    const xml = buildQueryInvoiceDigestRequest(ctx, { direction: 'OUTBOUND', page: 1, issueDate: { from: '2026-01-01', to: '2026-02-04' } });
    expect(xml).toMatchSnapshot();
    const { name, node } = rootOf(parseXml(xml));
    expect(name).toBe('QueryInvoiceDigestRequest');
    expect(Object.keys(node).filter((k) => !k.startsWith('@_'))).toEqual(['header', 'user', 'software', 'page', 'invoiceDirection', 'invoiceQueryParams']);
    expect(Object.keys(node.header)).toEqual(['requestId', 'timestamp', 'requestVersion', 'headerVersion']);
    expect(Object.keys(node.user)).toEqual(['login', 'passwordHash', 'taxNumber', 'requestSignature']);
    expect(node.user.passwordHash['@_cryptoType']).toBe('SHA-512');
    expect(node.user.requestSignature['@_cryptoType']).toBe('SHA3-512');
    expect(node.user.requestSignature['#text']).toMatch(/^[0-9A-F]{128}$/);
    expect(node.software.softwareOperation).toBe('ONLINE_SERVICE');
    // The password and the signing key never appear in the request.
    expect(xml).not.toContain(KATA.password);
    expect(xml).not.toContain(KATA.signatureKey);
    expect(xml).toContain('xmlns="http://schemas.nav.gov.hu/OSA/3.0/api"');
    expect(xml).toContain('xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common"');
  });

  it('queryInvoiceDigest with insDate window', () => {
    const xml = buildQueryInvoiceDigestRequest(ctx, {
      direction: 'INBOUND',
      page: 2,
      insDate: { from: '2026-11-16T05:30:00.000Z', to: '2026-11-17T05:30:00.000Z' },
    });
    expect(xml).toMatchSnapshot();
  });

  it('queryInvoiceData', () => {
    const xml = buildQueryInvoiceDataRequest(ctx, { invoiceNumber: 'KSZ-2026-001', direction: 'OUTBOUND' });
    expect(xml).toMatchSnapshot();
    const xml2 = buildQueryInvoiceDataRequest(ctx, { invoiceNumber: 'A&B <1>', direction: 'INBOUND', batchIndex: 2, supplierTaxNumber: '99204059' });
    expect(xml2).toContain('<invoiceNumber>A&amp;B &lt;1&gt;</invoiceNumber>');
    const { node } = rootOf(parseXml(xml2));
    expect(Object.keys(node.invoiceNumberQuery)).toEqual(['invoiceNumber', 'invoiceDirection', 'batchIndex', 'supplierTaxNumber']);
    expect(node.invoiceNumberQuery.invoiceNumber).toBe('A&B <1>');
  });

  it('queryTaxpayer', () => {
    expect(buildQueryTaxpayerRequest(ctx, '68801234')).toMatchSnapshot();
  });

  it('queryInvoiceChainDigest', () => {
    expect(buildQueryInvoiceChainDigestRequest(ctx, { invoiceNumber: 'MINTA-2026-004', direction: 'OUTBOUND', page: 1 })).toMatchSnapshot();
  });

  it('rejects characters XML cannot carry', () => {
    expect(() => buildQueryInvoiceDataRequest(ctx, { invoiceNumber: 'bad\u0001', direction: 'OUTBOUND' })).toThrow();
  });
});
