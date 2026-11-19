// Builds an invoiceData.xsd-valid <InvoiceData> document for a mock invoice (what NAV returns,
// base64/gzip-wrapped, from queryInvoiceData).
import { gzipSync } from 'node:zlib';
import { el, escapeXml } from '../xml/escape.js';
import { NS_BASE, NS_COMMON, NS_DATA } from '../xml/build.js';
import { forintToDecimal } from '../money.js';
import type { MockInvoice, MockParty } from './dataset.js';
import type { VatReason } from '../types.js';

/** Hungarian unit text → NAV unitOfMeasure. Unknown units go to OWN + unitOfMeasureOwn. */
const UNIT_CODES: Record<string, string> = {
  db: 'PIECE',
  kg: 'KILOGRAM',
  t: 'TON',
  kWh: 'KWH',
  nap: 'DAY',
  óra: 'HOUR',
  perc: 'MINUTE',
  hónap: 'MONTH',
  l: 'LITER',
  km: 'KILOMETER',
  'm³': 'CUBIC_METER',
  m: 'METER',
  fm: 'LINEAR_METER',
  karton: 'CARTON',
  csomag: 'PACK',
};

function taxNumberXml(name: string, p: { taxNumber: string; vatCode?: string; countyCode?: string }): string {
  return (
    `<${name}>` +
    el('base:taxpayerId', p.taxNumber) +
    el('base:vatCode', p.vatCode) +
    el('base:countyCode', p.countyCode) +
    `</${name}>`
  );
}

function addressXml(name: string, p: MockParty): string {
  const a = p.address;
  return (
    `<${name}><base:detailedAddress>` +
    el('base:countryCode', 'HU') +
    el('base:postalCode', a.postalCode) +
    el('base:city', a.city) +
    el('base:streetName', a.streetName) +
    el('base:publicPlaceCategory', a.publicPlaceCategory) +
    el('base:number', a.number) +
    `</base:detailedAddress></${name}>`
  );
}

interface VatKey {
  key: string;
  xml: string;
  percentage?: number;
}

function vatRateXml(v: { vatPercentage?: number; vatExemption?: VatReason }, fallback?: VatReason): VatKey {
  if (v.vatPercentage !== undefined) {
    return { key: `P${v.vatPercentage}`, xml: el('vatPercentage', v.vatPercentage), percentage: v.vatPercentage };
  }
  const ex = v.vatExemption ?? fallback ?? { case: 'AAM', reason: 'Alanyi adómentes' };
  return { key: `E${ex.case}`, xml: `<vatExemption>${el('case', ex.case)}${el('reason', ex.reason)}</vatExemption>` };
}

/** Line VAT for a percentage rate: the invoice's own split when it has one line, else rounded per line. */
function lineVat(net: number, percentage: number | undefined): number {
  if (percentage === undefined) return 0;
  const v = Math.round(Math.abs(net) * percentage);
  return net < 0 ? -v : v;
}

export function buildInvoiceDataXml(inv: MockInvoice): string {
  const s = inv.supplier;
  const isModification = inv.originalInvoiceNumber !== undefined;
  const reference = isModification
    ? '<invoiceReference>' +
      el('originalInvoiceNumber', inv.originalInvoiceNumber) +
      el('modifyWithoutMaster', 'false') +
      el('modificationIndex', inv.modificationIndex ?? 1) +
      '</invoiceReference>'
    : '';

  const c = inv.customer;
  let customer = '<customerInfo>' + el('customerVatStatus', c.vatStatus ?? 'DOMESTIC');
  if (c.vatStatus !== 'PRIVATE_PERSON') {
    // v3.0: no name/address for PRIVATE_PERSON customers.
    if (c.taxNumber) customer += `<customerVatData>${taxNumberXml('customerTaxNumber', { taxNumber: c.taxNumber })}</customerVatData>`;
    if (c.name) customer += el('customerName', c.name);
  }
  customer += '</customerInfo>';

  const detail =
    '<invoiceDetail>' +
    el('invoiceCategory', inv.category || 'NORMAL') +
    el('invoiceDeliveryDate', inv.deliveryDate ?? inv.issueDate) +
    el('currencyCode', inv.currency || 'HUF') +
    el('exchangeRate', inv.exchangeRate ?? 1) +
    el('paymentMethod', inv.paymentMethod) +
    el('paymentDate', inv.paymentDate) +
    el('invoiceAppearance', 'ELECTRONIC') +
    '</invoiceDetail>';

  const summaries = new Map<string, { xml: string; net: number; vat: number }>();
  const linesXml = inv.lines
    .map((l, i) => {
      const vat = vatRateXml(l, inv.vatExemption);
      const net = l.netAmountHuf;
      const v = inv.lines.length === 1 && vat.percentage !== undefined ? inv.vatAmountHuf : lineVat(net, vat.percentage);
      const sum = summaries.get(vat.key) ?? { xml: vat.xml, net: 0, vat: 0 };
      sum.net += net;
      sum.vat += v;
      summaries.set(vat.key, sum);
      const unitCode = l.unit !== undefined ? (UNIT_CODES[l.unit] ?? 'OWN') : undefined;
      const hasQty = l.quantity !== undefined && unitCode !== undefined && l.unitPriceHuf !== undefined;
      return (
        '<line>' +
        el('lineNumber', l.lineNo) +
        (isModification
          ? `<lineModificationReference>${el('lineNumberReference', inv.lines.length + i + 1)}${el('lineOperation', 'CREATE')}</lineModificationReference>`
          : '') +
        el('lineExpressionIndicator', hasQty ? 'true' : 'false') +
        el('lineNatureIndicator', 'SERVICE') +
        el('lineDescription', l.description) +
        (hasQty
          ? el('quantity', l.quantity) +
            el('unitOfMeasure', unitCode) +
            (unitCode === 'OWN' ? el('unitOfMeasureOwn', l.unit) : '') +
            el('unitPrice', l.unitPriceHuf) +
            el('unitPriceHUF', l.unitPriceHuf)
          : '') +
        '<lineAmountsNormal>' +
        `<lineNetAmountData>${el('lineNetAmount', forintToDecimal(net))}${el('lineNetAmountHUF', forintToDecimal(net))}</lineNetAmountData>` +
        `<lineVatRate>${vat.xml}</lineVatRate>` +
        `<lineVatData>${el('lineVatAmount', forintToDecimal(v))}${el('lineVatAmountHUF', forintToDecimal(v))}</lineVatData>` +
        `<lineGrossAmountData>${el('lineGrossAmountNormal', forintToDecimal(net + v))}${el('lineGrossAmountNormalHUF', forintToDecimal(net + v))}</lineGrossAmountData>` +
        '</lineAmountsNormal>' +
        '</line>'
      );
    })
    .join('');

  const byRate = [...summaries.values()]
    .map(
      (sm) =>
        '<summaryByVatRate>' +
        `<vatRate>${sm.xml}</vatRate>` +
        `<vatRateNetData>${el('vatRateNetAmount', forintToDecimal(sm.net))}${el('vatRateNetAmountHUF', forintToDecimal(sm.net))}</vatRateNetData>` +
        `<vatRateVatData>${el('vatRateVatAmount', forintToDecimal(sm.vat))}${el('vatRateVatAmountHUF', forintToDecimal(sm.vat))}</vatRateVatData>` +
        '</summaryByVatRate>',
    )
    .join('');

  const summary =
    '<invoiceSummary><summaryNormal>' +
    byRate +
    el('invoiceNetAmount', forintToDecimal(inv.netAmountHuf)) +
    el('invoiceNetAmountHUF', forintToDecimal(inv.netAmountHuf)) +
    el('invoiceVatAmount', forintToDecimal(inv.vatAmountHuf)) +
    el('invoiceVatAmountHUF', forintToDecimal(inv.vatAmountHuf)) +
    '</summaryNormal><summaryGrossData>' +
    el('invoiceGrossAmount', forintToDecimal(inv.grossAmountHuf)) +
    el('invoiceGrossAmountHUF', forintToDecimal(inv.grossAmountHuf)) +
    '</summaryGrossData></invoiceSummary>';

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<InvoiceData xmlns="${NS_DATA}" xmlns:common="${NS_COMMON}" xmlns:base="${NS_BASE}">` +
    el('invoiceNumber', inv.invoiceNumber) +
    el('invoiceIssueDate', inv.issueDate) +
    el('completenessIndicator', 'false') +
    '<invoiceMain><invoice>' +
    reference +
    '<invoiceHead><supplierInfo>' +
    taxNumberXml('supplierTaxNumber', s) +
    el('supplierName', inv.supplierName ?? s.name) +
    addressXml('supplierAddress', s) +
    '</supplierInfo>' +
    customer +
    detail +
    '</invoiceHead>' +
    `<invoiceLines>${el('mergedItemIndicator', 'false')}${linesXml}</invoiceLines>` +
    summary +
    '</invoice></invoiceMain></InvoiceData>\n'
  );
}

/** base64 of the XML, gzip-compressed when `compressed` (compressedContentIndicator). */
export function encodeInvoiceData(xml: string, compressed: boolean): string {
  const bytes = Buffer.from(xml, 'utf8');
  return (compressed ? gzipSync(bytes) : bytes).toString('base64');
}

export { escapeXml };
