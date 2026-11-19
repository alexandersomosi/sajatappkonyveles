// queryInvoiceData payload: base64 (optionally gzip) InvoiceData XML (invoiceData.xsd) → NormalizedInvoice.
import { gunzipSync } from 'node:zlib';
import { NavError } from './errors.js';
import { decimalToForint, decimalToNumber, optForint } from './money.js';
import { bool, child, childText, int, list, parseXml, rootOf, type XmlNode } from './xml/parse.js';
import type { InvoiceLine, InvoiceOperation, NormalizedInvoice, VatReason } from './types.js';

/** Hard cap for one decoded invoice (gzip bomb guard). NAV's own request limit is far below this. */
export const MAX_INVOICE_XML_BYTES = 32 * 1024 * 1024;

const BASE64_RE = /^[A-Za-z0-9+/\r\n]*={0,2}[\r\n]*$/;

/** base64 → (gunzip if compressed or gzip magic present) → UTF-8 XML text. */
export function decodeInvoiceData(base64: string, compressed: boolean): string {
  const clean = base64.trim();
  if (clean.length === 0 || !BASE64_RE.test(clean)) {
    throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'invoiceData is not base64' });
  }
  let bytes: Buffer = Buffer.from(clean, 'base64');
  const looksGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (compressed || looksGzip) {
    try {
      bytes = gunzipSync(bytes, { maxOutputLength: MAX_INVOICE_XML_BYTES });
    } catch (cause) {
      throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'invoiceData gunzip failed', cause });
    }
  }
  if (bytes.length > MAX_INVOICE_XML_BYTES) {
    throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'invoiceData too large' });
  }
  let xml = bytes.toString('utf8');
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);
  return xml;
}

/** NAV unitOfMeasure → short Hungarian unit shown in the UI. */
export const UNIT_LABELS_HU: Readonly<Record<string, string>> = {
  PIECE: 'db',
  KILOGRAM: 'kg',
  TON: 't',
  KWH: 'kWh',
  DAY: 'nap',
  HOUR: 'óra',
  MINUTE: 'perc',
  MONTH: 'hónap',
  LITER: 'l',
  KILOMETER: 'km',
  CUBIC_METER: 'm³',
  METER: 'm',
  LINEAR_METER: 'fm',
  CARTON: 'karton',
  PACK: 'csomag',
};

export interface InvoiceDataContext {
  /** From the digest or auditData.insdate. */
  insDate: string;
  /** From the digest. Without it: invoiceReference present → MODIFY, else CREATE (STORNO cannot be told apart). */
  operation?: InvoiceOperation;
  /** Which batchInvoice to take from a batch modification document (default: the first). */
  batchIndex?: number;
  transactionId?: string;
  index?: number;
  source?: string;
}

function reason(node: XmlNode): VatReason | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const c = childText(node, 'case');
  const r = childText(node, 'reason');
  if (c === undefined) return undefined;
  return { case: c, reason: r ?? '' };
}

interface VatInfo {
  vatPercentage?: number;
  vatContent?: number;
  vatExemption?: VatReason;
  vatOutOfScope?: VatReason;
}

function vatInfo(vatRate: XmlNode): VatInfo {
  const out: VatInfo = {};
  const p = decimalToNumber(childText(vatRate, 'vatPercentage'));
  if (p !== undefined) out.vatPercentage = p;
  const c = decimalToNumber(childText(vatRate, 'vatContent'));
  if (c !== undefined) out.vatContent = c;
  const ex = reason(child(vatRate, 'vatExemption'));
  if (ex) out.vatExemption = ex;
  const oos = reason(child(vatRate, 'vatOutOfScope'));
  if (oos) out.vatOutOfScope = oos;
  return out;
}

function parseLine(line: XmlNode): InvoiceLine {
  const lineNo = int(childText(line, 'lineNumber'));
  if (lineNo === undefined) throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'line without lineNumber' });
  const out: InvoiceLine = { lineNo, netAmountHuf: 0 };
  const description = childText(line, 'lineDescription');
  if (description !== undefined) out.description = description;
  const quantity = decimalToNumber(childText(line, 'quantity'));
  if (quantity !== undefined) out.quantity = quantity;
  const unitCode = childText(line, 'unitOfMeasure');
  if (unitCode !== undefined) {
    out.unitCode = unitCode;
    const own = childText(line, 'unitOfMeasureOwn');
    out.unit = unitCode === 'OWN' ? (own ?? 'egyéb') : (UNIT_LABELS_HU[unitCode] ?? unitCode);
  }
  const unitPrice = childText(line, 'unitPriceHUF');
  if (unitPrice !== undefined) out.unitPriceHuf = decimalToForint(unitPrice, 'unitPriceHUF');

  const mod = child(line, 'lineModificationReference');
  if (mod) {
    const ref = int(childText(mod, 'lineNumberReference'));
    const op = childText(mod, 'lineOperation');
    if (ref !== undefined && (op === 'CREATE' || op === 'MODIFY')) out.modifiesLine = { lineNo: ref, operation: op };
  }

  const normal = child(line, 'lineAmountsNormal');
  const simplified = child(line, 'lineAmountsSimplified');
  if (normal) {
    out.netAmountHuf = decimalToForint(childText(child(normal, 'lineNetAmountData'), 'lineNetAmountHUF') ?? '0', 'lineNetAmountHUF');
    Object.assign(out, vatInfo(child(normal, 'lineVatRate')));
    const vat = optForint(childText(child(normal, 'lineVatData'), 'lineVatAmountHUF'), 'lineVatAmountHUF');
    if (vat !== undefined) out.vatAmountHuf = vat;
    const gross = optForint(childText(child(normal, 'lineGrossAmountData'), 'lineGrossAmountNormalHUF'), 'lineGrossAmountNormalHUF');
    if (gross !== undefined) out.grossAmountHuf = gross;
    else if (out.vatAmountHuf !== undefined) out.grossAmountHuf = out.netAmountHuf + out.vatAmountHuf;
  } else if (simplified) {
    Object.assign(out, vatInfo(child(simplified, 'lineVatRate')));
    const gross = decimalToForint(childText(simplified, 'lineGrossAmountSimplifiedHUF') ?? '0', 'lineGrossAmountSimplifiedHUF');
    const vat = out.vatContent !== undefined ? roundHalfAway(gross * out.vatContent) : 0;
    out.grossAmountHuf = gross;
    out.vatAmountHuf = vat;
    out.netAmountHuf = gross - vat;
  }
  return out;
}

function roundHalfAway(x: number): number {
  const r = Math.sign(x) * Math.round(Math.abs(x));
  return r === 0 ? 0 : r;
}

function sameReason(reasons: (VatReason | undefined)[]): VatReason | undefined {
  const first = reasons[0];
  if (!first) return undefined;
  return reasons.every((r) => r && r.case === first.case) ? first : undefined;
}

/**
 * Parses one InvoiceData XML document into the normalized model.
 * Amount priority: invoiceSummary HUF values (authoritative) → line sums.
 */
export function parseInvoiceDataXml(xml: string, ctx: InvoiceDataContext): NormalizedInvoice {
  const { name, node: root } = rootOf(parseXml(xml));
  if (name !== 'InvoiceData') {
    throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: `unexpected root ${name}` });
  }
  const invoiceNumber = childText(root, 'invoiceNumber');
  const issueDate = childText(root, 'invoiceIssueDate');
  if (!invoiceNumber || !issueDate) {
    throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'missing invoiceNumber/invoiceIssueDate' });
  }
  const main = child(root, 'invoiceMain');
  let invoice: XmlNode = child(main, 'invoice');
  let batchIndex: number | undefined;
  const batches = list(child(main, 'batchInvoice'));
  if (!invoice && batches.length > 0) {
    const wanted = ctx.batchIndex;
    const picked = wanted !== undefined ? batches.find((b) => int(childText(b, 'batchIndex')) === wanted) : batches[0];
    if (!picked) throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: `batchIndex ${wanted} not in document` });
    batchIndex = int(childText(picked, 'batchIndex'));
    invoice = child(picked, 'invoice');
  }
  if (!invoice) throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'no invoice in invoiceMain' });

  const head = child(invoice, 'invoiceHead');
  const supplierInfo = child(head, 'supplierInfo');
  const customerInfo = child(head, 'customerInfo');
  const detail = child(head, 'invoiceDetail');
  const reference = child(invoice, 'invoiceReference');

  const supplierTaxNumber = childText(child(supplierInfo, 'supplierTaxNumber'), 'taxpayerId');
  if (!supplierTaxNumber) throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: 'missing supplier tax number' });

  const lines = list(child(child(invoice, 'invoiceLines'), 'line')).map(parseLine);

  // Summary
  const summary = child(invoice, 'invoiceSummary');
  const sNormal = child(summary, 'summaryNormal');
  const sSimplified = list(child(summary, 'summarySimplified'));
  const sGross = child(summary, 'summaryGrossData');
  let netAmountHuf: number;
  let vatAmountHuf: number;
  let grossAmountHuf: number;
  const summaryReasons: (VatReason | undefined)[] = [];
  if (sNormal) {
    netAmountHuf = decimalToForint(childText(sNormal, 'invoiceNetAmountHUF') ?? '0', 'invoiceNetAmountHUF');
    vatAmountHuf = decimalToForint(childText(sNormal, 'invoiceVatAmountHUF') ?? '0', 'invoiceVatAmountHUF');
    const g = optForint(childText(sGross, 'invoiceGrossAmountHUF'), 'invoiceGrossAmountHUF');
    grossAmountHuf = g ?? netAmountHuf + vatAmountHuf;
    for (const s of list(child(sNormal, 'summaryByVatRate'))) {
      summaryReasons.push(reason(child(child(s, 'vatRate'), 'vatExemption')));
    }
  } else if (sSimplified.length > 0) {
    let gross = 0;
    let vat = 0;
    for (const s of sSimplified) {
      const g = decimalToForint(childText(s, 'vatContentGrossAmountHUF') ?? '0', 'vatContentGrossAmountHUF');
      const vi = vatInfo(child(s, 'vatRate'));
      gross += g;
      if (vi.vatContent !== undefined) vat += roundHalfAway(g * vi.vatContent);
      summaryReasons.push(vi.vatExemption);
    }
    const g = optForint(childText(sGross, 'invoiceGrossAmountHUF'), 'invoiceGrossAmountHUF');
    grossAmountHuf = g ?? gross;
    vatAmountHuf = vat;
    netAmountHuf = grossAmountHuf - vat;
  } else {
    netAmountHuf = lines.reduce((a, l) => a + l.netAmountHuf, 0);
    vatAmountHuf = lines.reduce((a, l) => a + (l.vatAmountHuf ?? 0), 0);
    grossAmountHuf = netAmountHuf + vatAmountHuf;
  }

  const operation: InvoiceOperation = ctx.operation ?? (reference ? 'MODIFY' : 'CREATE');
  const out: NormalizedInvoice = {
    invoiceNumber,
    operation,
    category: childText(detail, 'invoiceCategory') ?? 'NORMAL',
    issueDate,
    currency: childText(detail, 'currencyCode') ?? 'HUF',
    netAmountHuf,
    vatAmountHuf,
    grossAmountHuf,
    supplierTaxNumber,
    insDate: ctx.insDate,
    customer: {},
    lines,
  };
  const bi = batchIndex ?? ctx.batchIndex;
  if (bi !== undefined) out.batchIndex = bi;
  const deliveryDate = childText(detail, 'invoiceDeliveryDate');
  if (deliveryDate) out.deliveryDate = deliveryDate;
  const paymentDate = childText(detail, 'paymentDate');
  if (paymentDate) out.paymentDate = paymentDate;
  const paymentMethod = childText(detail, 'paymentMethod');
  if (paymentMethod) out.paymentMethod = paymentMethod;
  const appearance = childText(detail, 'invoiceAppearance');
  if (appearance) out.invoiceAppearance = appearance;
  const exchangeRate = decimalToNumber(childText(detail, 'exchangeRate'));
  if (exchangeRate !== undefined) out.exchangeRate = exchangeRate;
  const supplierName = childText(supplierInfo, 'supplierName');
  if (supplierName) out.supplierName = supplierName;
  const completeness = bool(childText(root, 'completenessIndicator'));
  if (completeness !== undefined) out.completeness = completeness;

  if (customerInfo) {
    const vatStatus = childText(customerInfo, 'customerVatStatus');
    if (vatStatus === 'DOMESTIC' || vatStatus === 'PRIVATE_PERSON' || vatStatus === 'OTHER') out.customer.vatStatus = vatStatus;
    const name = childText(customerInfo, 'customerName');
    if (name) {
      out.customer.name = name;
      out.customerName = name;
    }
    const vatData = child(customerInfo, 'customerVatData');
    const tax = childText(child(vatData, 'customerTaxNumber'), 'taxpayerId');
    if (tax) {
      out.customer.taxNumber = tax;
      out.customerTaxNumber = tax;
    }
    const community = childText(vatData, 'communityVatNumber');
    if (community) out.customer.communityVatNumber = community;
    const third = childText(vatData, 'thirdStateTaxId');
    if (third) out.customer.thirdStateTaxId = third;
  }

  if (reference) {
    const orig = childText(reference, 'originalInvoiceNumber');
    if (orig) out.originalInvoiceNumber = orig;
    const mi = int(childText(reference, 'modificationIndex'));
    if (mi !== undefined) out.modificationIndex = mi;
    const mwm = bool(childText(reference, 'modifyWithoutMaster'));
    if (mwm !== undefined) out.modifyWithoutMaster = mwm;
  }

  const common = sameReason(lines.length > 0 ? lines.map((l) => l.vatExemption) : summaryReasons);
  if (common) out.vatExemption = common;

  if (ctx.transactionId) out.transactionId = ctx.transactionId;
  if (ctx.index !== undefined) out.index = ctx.index;
  if (ctx.source) out.source = ctx.source;
  return out;
}
