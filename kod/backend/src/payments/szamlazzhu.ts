// SPEC §29.2.2 – Számlázz.hu Számla Agent (fee invoices). One XML file per call, multipart/form-data to
// https://www.szamlazz.hu/szamla/ (field action-xmlagentxmlfile = issue, action-szamla_agent_xml = query,
// action-szamla_agent_st = storno). Element order follows the XSDs (backend/test/fixtures/szamlazz/*.xsd); every value
// goes through the escaping writer. Our key is both rendelesSzam and szamlaKulsoAzon, so a retry can always query first.
// The agent key never leaves this module and is never logged.
import { INVOICE_RULES } from '../_shared/k29.js';
import { grossToLine } from './huf.js';

export interface SzBuyer {
  name: string;
  zip: string | null;
  city: string | null;
  address: string | null;
  adoszam: string | null;
  email: string;
}

export interface SzInvoiceInput {
  /** rendelesSzam = szamlaKulsoAzon (ADZ-…). */
  key: string;
  issueDate: string;
  /** teljesitesDatum = fizetesiHataridoDatum = the payment day [KÖNYVELŐ]. */
  paymentDate: string;
  buyer: SzBuyer;
  line: { megnevezes: string; unit: string; grossHuf: number };
  replyTo: string | null;
  emailTargy: string;
  emailSzoveg: string;
  megjegyzes: string;
  /** Corrective invoice of a partial refund: the original number (line amount is negative). */
  correctionOf?: string | null;
  /** Fallback rounding when the Agent refuses the cents (§29.2.2). */
  wholeNet?: boolean;
  /** Számlázz.hu sends the invoice e-mail (true in production flows). */
  sendEmail?: boolean;
}

export interface SzStornoInput {
  key: string;
  originalNumber: string;
  date: string;
  megjegyzes: string;
  email: string | null;
  replyTo: string | null;
  emailTargy: string;
  emailSzoveg: string;
}

export interface SzResult {
  number: string;
  pdf: Buffer;
  grossHuf: number | null;
}

export class SzamlazzError extends Error {
  constructor(
    message: string,
    /** szlahu_error_code / hibakod ('timeout', 'network', 'bad_response' for our own). */
    readonly code: string,
    /** The call may or may not have created the document (timeout / network / 5xx): query before any retry. */
    readonly uncertain: boolean,
  ) {
    super(message);
  }
}

const NS_SZAMLA = 'http://www.szamlazz.hu/xmlszamla';
const NS_ST = 'http://www.szamlazz.hu/xmlszamlast';
const NS_XML = 'http://www.szamlazz.hu/xmlszamlaxml';

/** XML text escaping (no CDATA, no raw user input anywhere). Control characters are dropped. */
export function xmlEsc(v: string | number | boolean): string {
  return String(v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

type Node = [string, string | number | boolean | null | undefined | Node[]];

function render(nodes: Node[], indent = '  '): string {
  let out = '';
  for (const [name, v] of nodes) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) out += `${indent}<${name}>\n${render(v, `${indent}  `)}${indent}</${name}>\n`;
    else out += `${indent}<${name}>${xmlEsc(v)}</${name}>\n`;
  }
  return out;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

function doc(root: string, ns: string, xsd: string, body: Node[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="${ns}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${ns} https://www.szamlazz.hu/szamla/docs/xsds/${xsd}">\n${render(body)}</${root}>\n`;
}

/** xmlszamla (issue) – element order of xmlszamla.xsd. */
export function buildInvoiceXml(agentKey: string, i: SzInvoiceInput): string {
  const sign = i.line.grossHuf < 0 ? -1 : 1;
  const l = grossToLine(Math.abs(i.line.grossHuf), { whole: Boolean(i.wholeNet) });
  const qty = sign;
  return doc('xmlszamla', NS_SZAMLA, 'agent/xmlszamla.xsd', [
    [
      'beallitasok',
      [
        ['szamlaagentkulcs', agentKey],
        ['eszamla', true],
        ['szamlaLetoltes', true],
        ['valaszVerzio', 1],
        ['szamlaKulsoAzon', i.key],
      ],
    ],
    [
      'fejlec',
      [
        ['keltDatum', i.issueDate],
        ['teljesitesDatum', i.paymentDate],
        ['fizetesiHataridoDatum', i.paymentDate],
        ['fizmod', 'Bankkártya'],
        ['penznem', 'HUF'],
        ['szamlaNyelve', 'hu'],
        ['megjegyzes', i.megjegyzes],
        ['rendelesSzam', i.key],
        ['elolegszamla', false],
        ['vegszamla', false],
        ['helyesbitoszamla', Boolean(i.correctionOf)],
        ['helyesbitettSzamlaszam', i.correctionOf ?? null],
        ['dijbekero', false],
        ['fizetve', true],
      ],
    ],
    [
      'elado',
      [
        ['emailReplyto', i.replyTo],
        ['emailTargy', i.emailTargy],
        ['emailSzoveg', i.emailSzoveg],
      ],
    ],
    [
      'vevo',
      [
        ['nev', i.buyer.name],
        ['irsz', i.buyer.zip ?? ''],
        ['telepules', i.buyer.city ?? ''],
        ['cim', i.buyer.address ?? ''],
        ['email', i.buyer.email],
        ['sendEmail', i.sendEmail !== false],
        ['adoszam', i.buyer.adoszam],
      ],
    ],
    [
      'tetelek',
      [
        [
          'tetel',
          [
            ['megnevezes', i.line.megnevezes],
            ['mennyiseg', qty],
            ['mennyisegiEgyseg', i.line.unit],
            ['nettoEgysegar', num(l.netto)],
            ['afakulcs', String(INVOICE_RULES.vatPct)],
            ['nettoErtek', num(sign * l.netto)],
            ['afaErtek', num(sign * l.afa)],
            ['bruttoErtek', num(sign * l.brutto)],
          ],
        ],
      ],
    ],
  ]);
}

/** xmlszamlaxml (query by szamlaKulsoAzon, with the PDF). */
export function buildQueryXml(agentKey: string, key: string): string {
  return doc('xmlszamlaxml', NS_XML, 'agentxml/xmlszamlaxml.xsd', [
    ['szamlaagentkulcs', agentKey],
    ['pdf', true],
    ['szamlaKulsoAzon', key],
  ]);
}

/** xmlszamlast (storno) – NB: in this schema valaszVerzio comes after szamlaLetoltes (no Pld/aggregator used). */
export function buildStornoXml(agentKey: string, i: SzStornoInput): string {
  return doc('xmlszamlast', NS_ST, 'agentst/xmlszamlast.xsd', [
    [
      'beallitasok',
      [
        ['szamlaagentkulcs', agentKey],
        ['eszamla', true],
        ['szamlaLetoltes', true],
        ['valaszVerzio', 1],
        ['szamlaKulsoAzon', i.key],
      ],
    ],
    [
      'fejlec',
      [
        ['szamlaszam', i.originalNumber],
        ['keltDatum', i.date],
        ['teljesitesDatum', i.date],
        ['megjegyzes', i.megjegyzes],
      ],
    ],
    [
      'elado',
      [
        ['emailReplyto', i.replyTo],
        ['emailTargy', i.emailTargy],
        ['emailSzoveg', i.emailSzoveg],
      ],
    ],
    ['vevo', [['email', i.email]]],
  ]);
}

const decodeHeader = (v: string | null) => {
  if (!v) return null;
  try {
    return decodeURIComponent(v.replace(/\+/g, ' '));
  } catch {
    return v;
  }
};

export interface SzamlazzClient {
  issue(xml: string): Promise<SzResult>;
  storno(xml: string): Promise<SzResult>;
  /** null = no document with this key (error code 7). */
  query(xml: string): Promise<SzResult | null>;
}

export function createSzamlazzClient(o: { url: string; fetch?: typeof fetch; timeoutMs?: number }): SzamlazzClient {
  const f = o.fetch ?? fetch;
  const endpoint = o.url.endsWith('/') ? o.url : `${o.url}/`;
  async function post(field: string, xml: string): Promise<Response> {
    const form = new FormData();
    form.append(field, new Blob([xml], { type: 'text/xml' }), 'adozz.xml');
    try {
      return await f(endpoint, { method: 'POST', body: form, signal: AbortSignal.timeout(o.timeoutMs ?? INVOICE_RULES.timeoutMs) });
    } catch (e) {
      const timeout = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
      throw new SzamlazzError(timeout ? 'Számlázz.hu: időtúllépés' : 'Számlázz.hu: hálózati hiba', timeout ? 'timeout' : 'network', true);
    }
  }
  async function pdfResult(res: Response): Promise<SzResult> {
    const code = res.headers.get('szlahu_error_code');
    const buf = Buffer.from(await res.arrayBuffer());
    if (code || buf.subarray(0, 5).toString('latin1') === '[ERR]') {
      const msg = decodeHeader(res.headers.get('szlahu_error')) ?? buf.subarray(0, 200).toString('utf8').split('\n')[0] ?? 'hiba';
      throw new SzamlazzError(`Számlázz.hu: ${msg.slice(0, 160)}`, code ?? 'err', false);
    }
    if (res.status >= 500) throw new SzamlazzError(`Számlázz.hu: HTTP ${res.status}`, `http_${res.status}`, true);
    const number = decodeHeader(res.headers.get('szlahu_szamlaszam'));
    if (!number || buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new SzamlazzError('Számlázz.hu: váratlan válasz (nincs számlaszám vagy PDF)', 'bad_response', true);
    const gross = Number(res.headers.get('szlahu_bruttovegosszeg'));
    return { number, pdf: buf, grossHuf: Number.isFinite(gross) ? gross : null };
  }
  return {
    async issue(xml) {
      return pdfResult(await post('action-xmlagentxmlfile', xml));
    },
    async storno(xml) {
      return pdfResult(await post('action-szamla_agent_st', xml));
    },
    async query(xml) {
      const res = await post('action-szamla_agent_xml', xml);
      const text = await res.text();
      const headerCode = res.headers.get('szlahu_error_code');
      const hibakod = /<hibakod>\s*([^<\s]+)\s*<\/hibakod>/.exec(text)?.[1] ?? headerCode;
      if (hibakod) {
        if (hibakod === '7') return null;
        const msg = /<hibauzenet>([\s\S]*?)<\/hibauzenet>/.exec(text)?.[1] ?? decodeHeader(res.headers.get('szlahu_error')) ?? 'hiba';
        throw new SzamlazzError(`Számlázz.hu lekérdezés: ${msg.trim().slice(0, 160)}`, hibakod, false);
      }
      if (res.status >= 500) throw new SzamlazzError(`Számlázz.hu: HTTP ${res.status}`, `http_${res.status}`, true);
      const number = /<alap>[\s\S]*?<szamlaszam>([^<]+)<\/szamlaszam>/.exec(text)?.[1]?.trim();
      const pdfB64 = /<pdf>([\s\S]*?)<\/pdf>/.exec(text)?.[1]?.replace(/\s+/g, '');
      if (!number) throw new SzamlazzError('Számlázz.hu lekérdezés: váratlan válasz', 'bad_response', true);
      const pdf = pdfB64 ? Buffer.from(pdfB64, 'base64') : Buffer.alloc(0);
      const gross = Number(/<totalossz>[\s\S]*?<brutto>([^<]+)<\/brutto>/.exec(text)?.[1]);
      return { number, pdf, grossHuf: Number.isFinite(gross) ? gross : null };
    },
  };
}

/** The Agent's "this order number already exists" codes → query, store, done. */
export function isDuplicateOrderError(e: unknown): boolean {
  return e instanceof SzamlazzError && (INVOICE_RULES.duplicateOrderCodes as readonly number[]).includes(Number(e.code));
}
