// Response parsing. Namespace prefixes are dropped (NAV uses ns2/ns3… prefixes that vary), values stay
// strings (tax numbers, invoice numbers and amounts must not be coerced to numbers).
import { XMLParser } from 'fast-xml-parser';
import { NavError } from '../errors.js';

/** Elements that can repeat anywhere we read; always parsed as arrays. */
const ARRAY_TAGS = new Set([
  'invoiceDigest',
  'invoiceChainElement',
  'line',
  'summaryByVatRate',
  'summarySimplified',
  'batchInvoice',
  'notification',
  'technicalValidationMessages',
  'taxpayerAddressItem',
  'productCode',
  'additionalInvoiceData',
  'additionalLineData',
  'newCreatedLines',
]);

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (name, _jpath, _isLeaf, isAttribute) => !isAttribute && ARRAY_TAGS.has(name),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type XmlNode = any;

/** Parses XML into plain objects. Rejects DOCTYPE/ENTITY declarations (NAV never sends them). */
export function parseXml(xml: string): Record<string, XmlNode> {
  const src = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) {
    throw new NavError({ code: 'BAD_RESPONSE', navMessage: 'DOCTYPE/ENTITY not accepted' });
  }
  let out: unknown;
  try {
    out = parser.parse(src, true);
  } catch (cause) {
    throw new NavError({ code: 'BAD_RESPONSE', navMessage: 'XML not well-formed', cause });
  }
  if (!out || typeof out !== 'object') throw new NavError({ code: 'BAD_RESPONSE', navMessage: 'empty XML' });
  return out as Record<string, XmlNode>;
}

/** Name and content of the document element. */
export function rootOf(doc: Record<string, XmlNode>): { name: string; node: XmlNode } {
  const name = Object.keys(doc).find((k) => !k.startsWith('?') && !k.startsWith('#') && !k.startsWith('@_'));
  if (!name) throw new NavError({ code: 'BAD_RESPONSE', navMessage: 'no root element' });
  return { name, node: doc[name] ?? {} };
}

/** Text content of a node (string, or `#text` of an element that has attributes). */
export function text(node: XmlNode): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (typeof node === 'object' && '#text' in node) return String(node['#text']);
  if (typeof node === 'object' && Object.keys(node).length === 0) return '';
  return undefined;
}

export function child(node: XmlNode, name: string): XmlNode {
  if (!node || typeof node !== 'object') return undefined;
  return node[name];
}

export function childText(node: XmlNode, name: string): string | undefined {
  const t = text(child(node, name));
  return t === '' ? undefined : t;
}

export function list(node: XmlNode): XmlNode[] {
  if (node === undefined || node === null || node === '') return [];
  return Array.isArray(node) ? node : [node];
}

export function bool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

export function int(v: string | undefined): number | undefined {
  if (v === undefined || !/^-?\d+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : undefined;
}

export interface ResultInfo {
  root: string;
  node: XmlNode;
  funcCode?: string;
  errorCode?: string;
  message?: string;
  validationMessages: string[];
}

/** Reads funcCode/errorCode/message from BasicResponseType (`result`) or GeneralExceptionResponse (direct). */
export function readResult(xml: string): ResultInfo {
  const { name, node } = rootOf(parseXml(xml));
  const result = child(node, 'result') ?? node;
  const info: ResultInfo = { root: name, node, validationMessages: [] };
  const funcCode = childText(result, 'funcCode');
  const errorCode = childText(result, 'errorCode');
  const message = childText(result, 'message');
  if (funcCode !== undefined) info.funcCode = funcCode;
  if (errorCode !== undefined) info.errorCode = errorCode;
  if (message !== undefined) info.message = message;
  for (const v of list(child(node, 'technicalValidationMessages'))) {
    const parts = [childText(v, 'validationResultCode'), childText(v, 'validationErrorCode'), childText(v, 'message')];
    info.validationMessages.push(parts.filter(Boolean).join(' '));
  }
  return info;
}
