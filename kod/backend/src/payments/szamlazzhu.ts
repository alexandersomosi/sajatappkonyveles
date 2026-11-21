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
  /** Számlázz.hu sends the invoice e-mail. k8 (K8_TERV:22): the pipeline always sends false – our own mail goes out. */
  sendEmail?: boolean;
  // ---- k8 ALAP-B (bank transfer). Absent = the card invoice exactly as before. ----
  /** fizmod text (default 'Bankkártya'); 'Átutalás' for a díjbekérő and its final invoice. */
  fizmod?: string;
  /** fizetesiHataridoDatum when it differs from the payment day (a díjbekérő: kelt + 8 nap). */
  dueDate?: string;
  /** A díjbekérő (dijbekero=true, fizetve=false). */
  proforma?: boolean;
  /** The final invoice of a paid díjbekérő refers to it (dijbekeroSzamlaszam). */
  dijbekeroSzamlaszam?: string | null;
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
        ['fizetesiHataridoDatum', i.dueDate ?? i.paymentDate],
        ['fizmod', i.fizmod ?? 'Bankkártya'],
        ['penznem', 'HUF'],
        ['szamlaNyelve', 'hu'],
        ['megjegyzes', i.megjegyzes],
        ['rendelesSzam', i.key],
        ['dijbekeroSzamlaszam', i.dijbekeroSzamlaszam ?? null],
        ['elolegszamla', false],
        ['vegszamla', false],
        ['helyesbitoszamla', Boolean(i.correctionOf)],
        ['helyesbitettSzamlaszam', i.correctionOf ?? null],
        ['dijbekero', Boolean(i.proforma)],
        ['fizetve', !i.proforma],
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

/**
 * k8: xmlszamlaxml by order number or by document number (xmlszamlaxml.xsd order: szamlaszam, rendelesSzam, pdf,
 * szamlaKulsoAzon). Used for the díjbekérő's payment state (the díjbekérő carries our order number as rendelesSzam AND
 * szamlaKulsoAzon) and to read an invoice Autokassza made from a paid díjbekérő.
 */
export function buildQueryXmlBy(agentKey: string, by: { szamlaszam?: string; rendelesSzam?: string; szamlaKulsoAzon?: string }, pdf = true): string {
  return doc('xmlszamlaxml', NS_XML, 'agentxml/xmlszamlaxml.xsd', [
    ['szamlaagentkulcs', agentKey],
    ['szamlaszam', by.szamlaszam ?? null],
    ['rendelesSzam', by.rendelesSzam ?? null],
    ['pdf', pdf],
    ['szamlaKulsoAzon', by.szamlaKulsoAzon ?? null],
  ]);
}

/**
 * k8: the parts of a queried document the transfer reconciliation needs (docs.szamlazz.hu "Számla XML lekérdezése –
 * válasz", root `szamla`): alap/tipus (D = díjbekérő, SZ = számla, VS = végszámla …), alap/szamlaszam, alap/fizh,
 * alap/hivdijbekszam (an invoice made from a díjbekérő names it), osszegek/totalossz/brutto and kifizetesek/kifizetes
 * (datum, jogcim, osszeg) – there is no "paid" flag: the payments list is the state.
 */
export interface SzDocDetails {
  number: string;
  tipus: string | null;
  dueOn: string | null;
  refProforma: string | null;
  grossHuf: number | null;
  payments: { datum: string | null; jogcim: string | null; osszeg: number }[];
  paidHuf: number;
  pdf: Buffer;
}

/** Parses the query answer (exported for the tests). */
export function parseDocDetails(text: string): SzDocDetails | null {
  const number = tagText(text, 'szamlaszam', 'alap');
  if (!number) return null;
  const payments: SzDocDetails['payments'] = [];
  const block = /<kifizetesek>([\s\S]*?)<\/kifizetesek>/.exec(text)?.[1] ?? '';
  for (const m of block.matchAll(/<kifizetes>([\s\S]*?)<\/kifizetes>/g)) {
    const one = m[1]!;
    const osszeg = Number(tagText(one, 'osszeg'));
    if (!Number.isFinite(osszeg)) continue;
    payments.push({ datum: tagText(one, 'datum'), jogcim: tagText(one, 'jogcim'), osszeg });
  }
  const grossText = tagText(text, 'brutto', 'totalossz');
  const gross = grossText ? Number(grossText) : Number.NaN;
  const pdfB64 = tagText(text, 'pdf')?.replace(/\s+/g, '');
  return {
    number,
    tipus: tagText(text, 'tipus', 'alap'),
    dueOn: tagText(text, 'fizh', 'alap'),
    refProforma: tagText(text, 'hivdijbekszam', 'alap') || null,
    grossHuf: Number.isFinite(gross) ? gross : null,
    payments,
    paidHuf: Math.round(payments.reduce((a, p) => a + p.osszeg, 0)),
    pdf: pdfB64 ? Buffer.from(pdfB64, 'base64') : Buffer.alloc(0),
  };
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

/** The text of an XML element, CDATA-unwrapped (the Agent wraps values in CDATA). */
function tagText(xml: string, name: string, within?: string): string | null {
  const scope = within ? (new RegExp(`<${within}>([\\s\\S]*?)</${within}>`).exec(xml)?.[1] ?? '') : xml;
  const m = new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`).exec(scope);
  return m ? m[1]!.trim() : null;
}

export interface SzamlazzClient {
  issue(xml: string): Promise<SzResult>;
  storno(xml: string): Promise<SzResult>;
  /** null = no document with this key (error code 7). */
  query(xml: string): Promise<SzResult | null>;
  /** k8: the same query, with the document type, the due day and the payments (díjbekérő reconciliation). */
  queryDetails?(xml: string): Promise<SzDocDetails | null>;
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
      const hibakod = tagText(text, 'hibakod') ?? headerCode;
      if (hibakod) {
        if (hibakod === '7') return null;
        const msg = tagText(text, 'hibauzenet') ?? decodeHeader(res.headers.get('szlahu_error')) ?? 'hiba';
        throw new SzamlazzError(`Számlázz.hu lekérdezés: ${msg.trim().slice(0, 160)}`, hibakod, false);
      }
      if (res.status >= 500) throw new SzamlazzError(`Számlázz.hu: HTTP ${res.status}`, `http_${res.status}`, true);
      const number = tagText(text, 'szamlaszam', 'alap');
      const pdfB64 = tagText(text, 'pdf')?.replace(/\s+/g, '');
      if (!number) throw new SzamlazzError('Számlázz.hu lekérdezés: váratlan válasz', 'bad_response', true);
      const pdf = pdfB64 ? Buffer.from(pdfB64, 'base64') : Buffer.alloc(0);
      const grossText = tagText(text, 'brutto', 'totalossz');
      const gross = grossText ? Number(grossText) : Number.NaN;
      return { number, pdf, grossHuf: Number.isFinite(gross) ? gross : null };
    },
    async queryDetails(xml) {
      const res = await post('action-szamla_agent_xml', xml);
      const text = await res.text();
      const hibakod = tagText(text, 'hibakod') ?? res.headers.get('szlahu_error_code');
      if (hibakod) {
        if (hibakod === '7') return null;
        const msg = tagText(text, 'hibauzenet') ?? decodeHeader(res.headers.get('szlahu_error')) ?? 'hiba';
        throw new SzamlazzError(`Számlázz.hu lekérdezés: ${msg.trim().slice(0, 160)}`, hibakod, false);
      }
      if (res.status >= 500) throw new SzamlazzError(`Számlázz.hu: HTTP ${res.status}`, `http_${res.status}`, true);
      const d = parseDocDetails(text);
      if (!d) throw new SzamlazzError('Számlázz.hu lekérdezés: váratlan válasz', 'bad_response', true);
      return d;
    },
  };
}

/** The Agent's "this order number already exists" codes → query, store, done. */
export function isDuplicateOrderError(e: unknown): boolean {
  return e instanceof SzamlazzError && (INVOICE_RULES.duplicateOrderCodes as readonly number[]).includes(Number(e.code));
}
