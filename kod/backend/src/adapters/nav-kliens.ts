// Thin fallback of @kezjegy/nav-kliens (SPEC §8.5 contract). Only the DEMO path is implemented
// here: it serves kod/shared/demo/fixtures.json in-process (no XML) and generates deterministic
// fake invoices for unknown tax numbers. The real XML client (test/prod) comes from the package;
// src/nav/client.ts picks the implementation.
import fixtures from '../_shared/demo/fixtures.json' with { type: 'json' };

export interface NavCredentials {
  login: string;
  password: string;
  signatureKey: string;
  exchangeKey?: string;
  taxNumber: string;
}
export interface NavSoftware {
  softwareId: string;
  softwareName: string;
  softwareMainVersion: string;
  softwareDevName: string;
  softwareDevContact: string;
  softwareDevCountryCode?: string;
  softwareDevTaxNumber?: string;
}
export type NavEnvironment = 'demo' | 'test' | 'prod';
export interface InvoiceDigest {
  invoiceNumber: string;
  batchIndex?: number;
  operation: 'CREATE' | 'MODIFY' | 'STORNO';
  category: string;
  issueDate: string;
  deliveryDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  currency: string;
  netAmountHuf: number;
  vatAmountHuf: number;
  supplierTaxNumber: string;
  customerName?: string;
  customerTaxNumber?: string;
  originalInvoiceNumber?: string;
  modificationIndex?: number;
  insDate: string;
  transactionId?: string;
  source?: string;
  completeness?: boolean;
}
export interface NormalizedInvoice extends InvoiceDigest {
  grossAmountHuf: number;
  exchangeRate?: number;
  customer: { name?: string; taxNumber?: string; vatStatus?: 'DOMESTIC' | 'PRIVATE_PERSON' | 'OTHER' };
  lines: {
    lineNo: number;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPriceHuf?: number;
    netAmountHuf: number;
    vatExemption?: { case: string; reason: string };
  }[];
}
export class NavError extends Error {
  constructor(
    public code: string,
    public messageHu: string,
    public retryable = false,
    public funcCode?: string,
    public httpStatus?: number,
  ) {
    super(code);
    this.name = 'NavError';
  }
}
export interface NavClient {
  queryInvoiceDigest(p: {
    direction: 'OUTBOUND' | 'INBOUND';
    page: number;
    issueDate?: { from: string; to: string };
    insDate?: { from: string; to: string };
  }): Promise<{ currentPage: number; availablePage: number; digests: InvoiceDigest[] }>;
  queryInvoiceData(p: {
    invoiceNumber: string;
    direction: 'OUTBOUND' | 'INBOUND';
    batchIndex?: number;
    supplierTaxNumber?: string;
  }): Promise<{ invoice: NormalizedInvoice; rawXml: string; insDate?: string }>;
  queryTaxpayer(taxNumber: string): Promise<{ valid: boolean; name?: string }>;
  syncOutbound(p: {
    since: string | null;
    asOf: string;
  }): AsyncIterable<{ digest: InvoiceDigest; data: () => Promise<{ invoice: NormalizedInvoice; rawXml: string }> }>;
}

export const NAV_ERROR_HU: Record<string, string> = {
  INVALID_SECURITY_USER: 'Hibás technikai felhasználónév vagy jelszó.',
  INVALID_REQUEST_SIGNATURE: 'Hibás XML aláírókulcs.',
  FORBIDDEN: 'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.',
  NOT_REGISTERED_CUSTOMER: 'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.',
  INVALID_CUSTOMER: 'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.',
  OPERATION_FAILED: 'A NAV rendszere most nem érhető el, később újrapróbáljuk.',
  MAINTENANCE: 'A NAV rendszere most nem érhető el, később újrapróbáljuk.',
  NETWORK: 'A NAV rendszere most nem érhető el, később újrapróbáljuk.',
};

type FixtureInvoice = (typeof fixtures.navInvoices)[keyof typeof fixtures.navInvoices][number];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FAKE_CUSTOMERS = [
  { name: 'Kékmadár Szoftver Kft.', taxNumber: '99709003' },
  { name: 'Bodza Kiadó Kft.', taxNumber: '99102033' },
  { name: 'Mókusvár Játékbolt Kft.', taxNumber: '99406072' },
  { name: 'Zöldág Alapítvány', taxNumber: '99507080' },
];

function plusDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Deterministic fake invoices (SPEC §8.5 mock): 2–4 per month Jan → asOf, 80 000–450 000 Ft. */
export function generatedDemoInvoices(taxNumber: string, asOf: string): NormalizedInvoice[] {
  const year = Number(asOf.slice(0, 4));
  const rnd = mulberry32(Number(taxNumber) || 1);
  const out: NormalizedInvoice[] = [];
  let no = 1;
  for (let m = 1; m <= 12; m++) {
    const k = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) {
      const day = 2 + Math.floor(rnd() * 25);
      const issue = `${year}-${String(m).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`;
      const amount = Math.round((80_000 + rnd() * 370_000) / 1000) * 1000;
      const c = FAKE_CUSTOMERS[Math.floor(rnd() * FAKE_CUSTOMERS.length)]!;
      if (issue > asOf) continue;
      out.push({
        invoiceNumber: `DEMO-${year}-${String(no++).padStart(3, '0')}`,
        operation: 'CREATE',
        category: 'NORMAL',
        issueDate: issue,
        deliveryDate: issue,
        paymentDate: plusDays(issue, 8),
        paymentMethod: 'TRANSFER',
        currency: 'HUF',
        netAmountHuf: amount,
        vatAmountHuf: 0,
        grossAmountHuf: amount,
        supplierTaxNumber: taxNumber,
        customerName: c.name,
        customerTaxNumber: c.taxNumber,
        customer: { name: c.name, taxNumber: c.taxNumber, vatStatus: 'DOMESTIC' },
        insDate: `${issue}T10:00:00Z`,
        source: 'DEMO',
        completeness: false,
        lines: [{ lineNo: 1, description: 'Szolgáltatás (MINTA)', quantity: 1, unit: 'db', unitPriceHuf: amount, netAmountHuf: amount, vatExemption: { case: 'AAM', reason: 'Alanyi adómentes' } }],
      });
    }
  }
  return out;
}

function fromFixture(f: FixtureInvoice): NormalizedInvoice {
  return {
    invoiceNumber: f.invoiceNumber,
    operation: f.operation as 'CREATE',
    category: f.category,
    issueDate: f.issueDate,
    deliveryDate: f.deliveryDate,
    paymentDate: f.paymentDate,
    paymentMethod: f.paymentMethod,
    currency: f.currency,
    netAmountHuf: f.netAmountHuf,
    vatAmountHuf: f.vatAmountHuf,
    grossAmountHuf: f.grossAmountHuf,
    supplierTaxNumber: f.supplierTaxNumber,
    customerName: f.customer.name,
    customerTaxNumber: f.customer.taxNumber,
    customer: { name: f.customer.name, taxNumber: f.customer.taxNumber, vatStatus: f.customer.vatStatus as 'DOMESTIC' },
    insDate: `${f.issueDate}T10:00:00Z`,
    source: 'DEMO',
    completeness: false,
    lines: f.lines.map((l) => ({ ...l, vatExemption: f.vatExemption })),
  };
}

function demoInvoices(taxNumber: string, asOf: string): NormalizedInvoice[] {
  const fx = (fixtures.navInvoices as Record<string, FixtureInvoice[]>)[taxNumber];
  const list = fx ? fx.map(fromFixture) : generatedDemoInvoices(taxNumber, asOf);
  return list.filter((i) => i.issueDate <= asOf).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
}

function demoXml(inv: NormalizedInvoice): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- DEMO: kitalált számla, nem a NAV-tól -->\n<InvoiceData xmlns="http://schemas.nav.gov.hu/OSA/3.0/data"><invoiceNumber>${esc(inv.invoiceNumber)}</invoiceNumber><invoiceIssueDate>${inv.issueDate}</invoiceIssueDate><invoiceGrossAmountHUF>${inv.grossAmountHuf}</invoiceGrossAmountHUF></InvoiceData>\n`;
}

/** In-process DEMO client. Credentials must be well-formed; login starting with "hibas" simulates a NAV auth error. */
export function createDemoNavClient(credentials: NavCredentials, now: () => Date = () => new Date()): NavClient {
  function check(): void {
    if (!/^\d{8}$/.test(credentials.taxNumber)) throw new NavError('INVALID_REQUEST', 'Hibás adószám.', false);
    if (!credentials.login || credentials.login.length < 6) throw new NavError('INVALID_SECURITY_USER', NAV_ERROR_HU.INVALID_SECURITY_USER!);
    if (credentials.login.toLowerCase().startsWith('hibas')) throw new NavError('INVALID_SECURITY_USER', NAV_ERROR_HU.INVALID_SECURITY_USER!);
    if (!credentials.password) throw new NavError('INVALID_SECURITY_USER', NAV_ERROR_HU.INVALID_SECURITY_USER!);
    if (!credentials.signatureKey || credentials.signatureKey.length < 8) throw new NavError('INVALID_REQUEST_SIGNATURE', NAV_ERROR_HU.INVALID_REQUEST_SIGNATURE!);
  }
  const today = () => now().toISOString().slice(0, 10);
  return {
    async queryInvoiceDigest(p) {
      check();
      let list = demoInvoices(credentials.taxNumber, today());
      if (p.issueDate) list = list.filter((i) => i.issueDate >= p.issueDate!.from && i.issueDate <= p.issueDate!.to);
      if (p.insDate) list = list.filter((i) => i.insDate >= p.insDate!.from && i.insDate <= p.insDate!.to);
      const pages = Math.max(1, Math.ceil(list.length / 100));
      const slice = list.slice((p.page - 1) * 100, p.page * 100);
      return { currentPage: p.page, availablePage: pages, digests: slice.map(({ lines: _l, customer: _c, grossAmountHuf: _g, ...d }) => d) };
    },
    async queryInvoiceData(p) {
      check();
      const inv = demoInvoices(credentials.taxNumber, today()).find((i) => i.invoiceNumber === p.invoiceNumber);
      if (!inv) throw new NavError('INVOICE_NOT_FOUND', 'Ez a számla nem található a NAV-nál.');
      return { invoice: inv, rawXml: demoXml(inv), insDate: inv.insDate };
    },
    async queryTaxpayer(taxNumber) {
      check();
      return { valid: /^\d{8}$/.test(taxNumber), name: 'DEMO adózó (MINTA)' };
    },
    async *syncOutbound(p) {
      check();
      const sinceFloor = p.since ? new Date(new Date(p.since).getTime() - 86_400_000).toISOString() : null;
      for (const inv of demoInvoices(credentials.taxNumber, p.asOf)) {
        if (sinceFloor && inv.insDate < sinceFloor) continue;
        const { lines: _l, customer: _c, grossAmountHuf: _g, ...digest } = inv;
        yield { digest, data: async () => ({ invoice: inv, rawXml: demoXml(inv) }) };
      }
    },
  };
}
