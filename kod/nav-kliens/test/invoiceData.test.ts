import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodeInvoiceData, parseInvoiceDataXml } from '../src/invoiceData.js';
import { NavError } from '../src/errors.js';

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const INS = '2026-05-15T10:00:00.000Z';

describe('decodeInvoiceData', () => {
  const xml = fx('normal-private-person.xml');
  it('plain base64', () => {
    expect(decodeInvoiceData(Buffer.from(xml).toString('base64'), false)).toBe(xml);
  });
  it('gzip + base64', () => {
    expect(decodeInvoiceData(gzipSync(Buffer.from(xml)).toString('base64'), true)).toBe(xml);
  });
  it('gzip magic is detected even if the indicator is false', () => {
    expect(decodeInvoiceData(gzipSync(Buffer.from(xml)).toString('base64'), false)).toBe(xml);
  });
  it('strips a UTF-8 BOM', () => {
    expect(decodeInvoiceData(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<a/>')]).toString('base64'), false)).toBe('<a/>');
  });
  it('bad input → DATA_DECODE_ERROR', () => {
    expect(() => decodeInvoiceData('not base64 !!', false)).toThrow(NavError);
    expect(() => decodeInvoiceData(Buffer.from('nope').toString('base64'), true)).toThrowError(/DATA_DECODE_ERROR/);
  });
});

describe('parseInvoiceDataXml', () => {
  it('normal invoice, private person, two VAT rates, discount line', () => {
    const inv = parseInvoiceDataXml(fx('normal-private-person.xml'), { insDate: INS });
    expect(inv).toMatchObject({
      invoiceNumber: 'TESZT/2026/000123',
      operation: 'CREATE',
      category: 'NORMAL',
      issueDate: '2026-05-15',
      deliveryDate: '2026-05-10',
      paymentDate: '2026-05-15',
      paymentMethod: 'CASH',
      currency: 'HUF',
      exchangeRate: 1,
      netAmountHuf: 4920,
      vatAmountHuf: 1196,
      grossAmountHuf: 6116,
      supplierTaxNumber: '99999999',
      supplierName: 'Képzelt Hentes Kft.',
      insDate: INS,
      completeness: false,
      invoiceAppearance: 'PAPER',
      customer: { vatStatus: 'PRIVATE_PERSON' },
    });
    expect(inv.customer.name).toBeUndefined();
    expect(inv.vatExemption).toBeUndefined();
    expect(inv.lines).toEqual([
      { lineNo: 1, description: 'Hűtött áru (fél)', quantity: 1.5, unitCode: 'KILOGRAM', unit: 'kg', unitPriceHuf: 400, netAmountHuf: 600, vatPercentage: 0.05, vatAmountHuf: 30, grossAmountHuf: 630 },
      { lineNo: 2, description: 'Érlelt kolbász', quantity: 1.6, unitCode: 'OWN', unit: 'rúd', unitPriceHuf: 3000, netAmountHuf: 4800, vatPercentage: 0.27, vatAmountHuf: 1296, grossAmountHuf: 6096 },
      { lineNo: 3, description: 'Árengedmény', netAmountHuf: -480, vatPercentage: 0.27, vatAmountHuf: -130, grossAmountHuf: -610 },
    ]);
  });

  it('simplified invoice: VAT from vatContent, net = gross − VAT content', () => {
    const inv = parseInvoiceDataXml(fx('simplified.xml'), { insDate: INS });
    expect(inv.category).toBe('SIMPLIFIED');
    expect(inv.grossAmountHuf).toBe(15000);
    expect(inv.vatAmountHuf).toBe(2126);
    expect(inv.netAmountHuf).toBe(12874);
    expect(inv.customer).toEqual({ vatStatus: 'DOMESTIC', name: 'Szabó Kata e.v.', taxNumber: '68801234' });
    expect(inv.lines[0]).toMatchObject({ lineNo: 1, unit: 'db', vatContent: 0.2126, grossAmountHuf: 10000, vatAmountHuf: 2126, netAmountHuf: 7874 });
    expect(inv.lines[1]).toMatchObject({ lineNo: 2, unit: 'óra', vatExemption: { case: 'TAM' }, netAmountHuf: 5000 });
  });

  it('batch modification document: picks the requested batchIndex', () => {
    const second = parseInvoiceDataXml(fx('modification-batch.xml'), { insDate: INS, batchIndex: 2, operation: 'MODIFY' });
    expect(second).toMatchObject({
      invoiceNumber: 'MOD-2026-0007',
      batchIndex: 2,
      operation: 'MODIFY',
      originalInvoiceNumber: 'KSZ-2026-011',
      modificationIndex: 1,
      modifyWithoutMaster: false,
      netAmountHuf: -5000,
      vatAmountHuf: 0,
      grossAmountHuf: -5000,
      vatExemption: { case: 'AAM', reason: 'Alanyi adómentes' },
      customerName: 'Bodza Kiadó Kft.',
      customerTaxNumber: '99102036',
    });
    expect(second.lines[0]?.modifiesLine).toEqual({ lineNo: 2, operation: 'CREATE' });
    const first = parseInvoiceDataXml(fx('modification-batch.xml'), { insDate: INS });
    expect(first.batchIndex).toBe(1);
    expect(first.operation).toBe('MODIFY'); // inferred from invoiceReference
    expect(first.originalInvoiceNumber).toBe('KSZ-2026-010');
    expect(() => parseInvoiceDataXml(fx('modification-batch.xml'), { insDate: INS, batchIndex: 3 })).toThrow(NavError);
  });

  it('foreign currency: HUF amounts rounded half away from zero, EU customer', () => {
    const inv = parseInvoiceDataXml(fx('foreign-currency.xml'), { insDate: INS });
    expect(inv).toMatchObject({
      currency: 'EUR',
      exchangeRate: 391.83,
      netAmountHuf: 196405,
      vatAmountHuf: 0,
      grossAmountHuf: 196405,
      customer: { vatStatus: 'OTHER', name: 'Erfunden GmbH', communityVatNumber: 'ATU99999999' },
    });
    expect(inv.lines[0]).toMatchObject({ unitPriceHuf: 15712, netAmountHuf: 196405, quantity: 12.5, unit: 'óra' });
  });

  it('rejects other documents and DOCTYPE', () => {
    expect(() => parseInvoiceDataXml('<Foo/>', { insDate: INS })).toThrow(NavError);
    expect(() => parseInvoiceDataXml('<!DOCTYPE x [<!ENTITY a "b">]><InvoiceData/>', { insDate: INS })).toThrow(NavError);
  });
});
