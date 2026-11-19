// DEMO data for the NAV mock. Everything here is FICTIONAL (SPEC §2.10, §8.5, §19):
// - the three demo clients' invoices come from kod/shared/demo/fixtures.json (navInvoices),
// - any other tax number gets deterministic generated invoices (seeded by the tax number),
// - every taxpayer gets a few generated incoming (INBOUND) invoices from fictional suppliers.
import { taxNumberCheckDigit, isValidTaxNumber } from '../validate.js';
import { addDays } from '../windows.js';
import type { DemoFixtures, FixtureInvoice, VatReason } from '../types.js';

export interface MockAddress {
  postalCode: string;
  city: string;
  streetName: string;
  publicPlaceCategory: string;
  number: string;
}

export interface MockParty {
  taxNumber: string;
  vatCode: string;
  countyCode: string;
  name: string;
  incorporation: 'SELF_EMPLOYED' | 'ORGANIZATION';
  address: MockAddress;
}

export interface MockInvoice extends FixtureInvoice {
  insDate: string;
  supplier: MockParty;
  transactionId: string;
  index: number;
}

const AAM: VatReason = { case: 'AAM', reason: 'Alanyi adómentes' };

/** Demo personas of SPEC §19 (fictional), keyed by the fixtures.json `taxIds` key. */
const DEMO_PERSONAS: Record<string, { name: string; address: MockAddress }> = {
  kata: { name: 'Szabó Kata e.v.', address: { postalCode: '1136', city: 'Budapest', streetName: 'Példa', publicPlaceCategory: 'utca', number: '7.' } },
  reka: { name: 'Varga Réka e.v.', address: { postalCode: '3300', city: 'Eger', streetName: 'Minta', publicPlaceCategory: 'tér', number: '3.' } },
  peter: { name: 'Németh Péter e.v.', address: { postalCode: '6720', city: 'Szeged', streetName: 'Kitalált', publicPlaceCategory: 'köz', number: '12.' } },
};

const CITIES: MockAddress[] = [
  { postalCode: '1051', city: 'Budapest', streetName: 'Képzelt', publicPlaceCategory: 'utca', number: '4.' },
  { postalCode: '4025', city: 'Debrecen', streetName: 'Mintakert', publicPlaceCategory: 'utca', number: '18.' },
  { postalCode: '7621', city: 'Pécs', streetName: 'Álom', publicPlaceCategory: 'köz', number: '2.' },
  { postalCode: '9021', city: 'Győr', streetName: 'Példa', publicPlaceCategory: 'tér', number: '9.' },
  { postalCode: '8000', city: 'Székesfehérvár', streetName: 'Kitalált', publicPlaceCategory: 'út', number: '31.' },
];

function withCheckDigit(first7: string): string {
  return first7 + String(taxNumberCheckDigit(first7));
}

/** Fictional customers for generated invoices; tax numbers start with 99 and have a valid check digit. */
const GEN_CUSTOMERS = [
  'Pitypang Könyvesbolt Kft.',
  'Kökörcsin Kávézó Bt.',
  'Szélmalom Építő Kft.',
  'Tücsök Óvoda Alapítvány',
  'Holdfény Panzió Kft.',
  'Galagonya Rendezvény Kft.',
  'Vadkörte Webáruház Kft.',
  'Csillagpor Stúdió Bt.',
].map((name, i) => ({ name, taxNumber: withCheckDigit(`993${String(10 + i * 7).padStart(2, '0')}11`) }));

const GEN_DESCRIPTIONS = ['Megbízási díj', 'Tanácsadás', 'Tervezési munka', 'Szolgáltatás díja', 'Oktatás, workshop', 'Javítás és karbantartás'];

/** Fictional VAT-registered suppliers of the generated INBOUND invoices. */
const GEN_SUPPLIERS = [
  { name: 'Papírsárkány Irodaszer Kft.', taxNumber: withCheckDigit('9942017'), prefix: 'PS', what: 'Irodaszer' },
  { name: 'Hálószem Távközlési Zrt.', taxNumber: withCheckDigit('9945023'), prefix: 'HSZ', what: 'Internet és telefon havidíj' },
  { name: 'Tollhegy Szoftver Kft.', taxNumber: withCheckDigit('9947031'), prefix: 'TSZ', what: 'Szoftver-előfizetés' },
];

/** FNV-1a 32 bit. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG – deterministic per seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0');
}

function transactionIdFor(taxNumber: string, invoiceNumber: string): string {
  return `DEMOTX${hash(`${taxNumber}|${invoiceNumber}`).toString(36).toUpperCase()}${hash(invoiceNumber).toString(36).toUpperCase()}`.slice(0, 30);
}

function countyFor(taxNumber: string): string {
  return pick(rng(hash(`county|${taxNumber}`)), ['41', '42', '43', '02', '05', '07', '08', '09', '10', '13']);
}

export class MockDataset {
  private readonly parties = new Map<string, MockParty>();
  private readonly fixtureByTax = new Map<string, FixtureInvoice[]>();
  private readonly cache = new Map<string, MockInvoice[]>();

  constructor(fixtures: DemoFixtures) {
    for (const [tax, invoices] of Object.entries(fixtures.navInvoices ?? {})) this.fixtureByTax.set(tax, invoices);
    for (const [key, ids] of Object.entries(fixtures.taxIds ?? {})) {
      const m = /^(\d{8})-(\d)-(\d{2})$/.exec(ids.adoszam ?? '');
      if (!m || !m[1] || !m[2] || !m[3]) continue;
      const persona = DEMO_PERSONAS[key];
      this.parties.set(m[1], {
        taxNumber: m[1],
        vatCode: m[2],
        countyCode: m[3],
        name: persona?.name ?? `MINTA egyéni vállalkozó ${m[1]}`,
        incorporation: 'SELF_EMPLOYED',
        address: persona?.address ?? pick(rng(hash(m[1])), CITIES),
      });
    }
    // Customers named in the fixtures + generated customers + suppliers (all fictional organisations).
    for (const invoices of this.fixtureByTax.values()) {
      for (const inv of invoices) {
        const t = inv.customer.taxNumber;
        if (t && inv.customer.name && !this.parties.has(t)) this.parties.set(t, this.org(t, inv.customer.name));
      }
    }
    for (const c of GEN_CUSTOMERS) if (!this.parties.has(c.taxNumber)) this.parties.set(c.taxNumber, this.org(c.taxNumber, c.name));
    for (const s of GEN_SUPPLIERS) if (!this.parties.has(s.taxNumber)) this.parties.set(s.taxNumber, this.org(s.taxNumber, s.name));
  }

  private org(taxNumber: string, name: string): MockParty {
    return { taxNumber, vatCode: '2', countyCode: countyFor(taxNumber), name, incorporation: 'ORGANIZATION', address: pick(rng(hash(`addr|${taxNumber}`)), CITIES) };
  }

  /** Taxpayer data for queryTaxpayer; undefined when the tax number is not formally valid. */
  party(taxNumber: string): MockParty | undefined {
    const known = this.parties.get(taxNumber);
    if (known) return known;
    if (!isValidTaxNumber(taxNumber)) return undefined;
    return {
      taxNumber,
      vatCode: '1',
      countyCode: countyFor(taxNumber),
      name: `MINTA egyéni vállalkozó ${taxNumber}`,
      incorporation: 'SELF_EMPLOYED',
      address: pick(rng(hash(`addr|${taxNumber}`)), CITIES),
    };
  }

  /** Invoices issued BY the taxpayer, issueDate ≤ asOf. */
  outbound(taxNumber: string, asOf: string): MockInvoice[] {
    return this.yearsUpTo(asOf)
      .flatMap((year) => this.cached(`out|${taxNumber}|${year}`, () => this.buildOutbound(taxNumber, year)))
      .filter((i) => i.issueDate <= asOf);
  }

  /** Invoices issued TO the taxpayer, issueDate ≤ asOf. */
  inbound(taxNumber: string, asOf: string): MockInvoice[] {
    const fromFixtures: MockInvoice[] = [];
    for (const [supplierTax, invoices] of this.fixtureByTax) {
      for (const inv of invoices) {
        if (inv.customer.taxNumber === taxNumber && inv.issueDate <= asOf) fromFixtures.push(this.fromFixture(supplierTax, inv));
      }
    }
    const generated = this.yearsUpTo(asOf)
      .flatMap((year) => this.cached(`in|${taxNumber}|${year}`, () => this.buildInbound(taxNumber, year)))
      .filter((i) => i.issueDate <= asOf);
    return [...fromFixtures, ...generated];
  }

  private yearsUpTo(asOf: string): number[] {
    const y = Number(asOf.slice(0, 4));
    return [y - 1, y];
  }

  private cached(key: string, build: () => MockInvoice[]): MockInvoice[] {
    let v = this.cache.get(key);
    if (!v) {
      v = build();
      this.cache.set(key, v);
    }
    return v;
  }

  private fromFixture(supplierTax: string, inv: FixtureInvoice): MockInvoice {
    const supplier = this.party(supplierTax) ?? this.org(supplierTax, `MINTA eladó ${supplierTax}`);
    return {
      ...inv,
      supplierTaxNumber: supplierTax,
      supplierName: inv.supplierName ?? supplier.name,
      insDate: inv.insDate ?? `${inv.issueDate}T10:00:00Z`,
      supplier,
      transactionId: transactionIdFor(supplierTax, inv.invoiceNumber),
      index: 1,
    };
  }

  private buildOutbound(taxNumber: string, year: number): MockInvoice[] {
    const fixture = this.fixtureByTax.get(taxNumber);
    if (fixture) return fixture.filter((i) => i.issueDate.startsWith(`${year}-`)).map((i) => this.fromFixture(taxNumber, i));
    if (!isValidTaxNumber(taxNumber)) return [];
    const supplier = this.party(taxNumber) as MockParty;
    const out: MockInvoice[] = [];
    let seq = 0;
    for (let month = 1; month <= 12; month++) {
      const r = rng(hash(`${taxNumber}|${year}|${month}|out`));
      const count = 2 + Math.floor(r() * 3);
      const days = new Set<number>();
      while (days.size < count) days.add(1 + Math.floor(r() * 28));
      for (const day of [...days].sort((a, b) => a - b)) {
        seq++;
        const issueDate = `${year}-${pad(month, 2)}-${pad(day, 2)}`;
        const customer = pick(r, GEN_CUSTOMERS);
        const privatePerson = r() < 0.15;
        const amount = Math.round((80_000 + r() * 370_000) / 1000) * 1000;
        const description = pick(r, GEN_DESCRIPTIONS);
        const x = r();
        const paymentMethod = x < 0.8 ? 'TRANSFER' : x < 0.9 ? 'CASH' : 'CARD';
        const invoiceNumber = `MINTA-${year}-${pad(seq, 3)}`;
        out.push({
          invoiceNumber,
          operation: 'CREATE',
          category: 'NORMAL',
          issueDate,
          deliveryDate: issueDate,
          paymentDate: paymentMethod === 'TRANSFER' ? addDays(issueDate, 8) : issueDate,
          paymentMethod,
          currency: 'HUF',
          netAmountHuf: amount,
          vatAmountHuf: 0,
          grossAmountHuf: amount,
          vatExemption: AAM,
          supplierTaxNumber: taxNumber,
          supplierName: supplier.name,
          customer: privatePerson ? { vatStatus: 'PRIVATE_PERSON' } : { name: customer.name, taxNumber: customer.taxNumber, vatStatus: 'DOMESTIC' },
          lines: [{ lineNo: 1, description, quantity: 1, unit: 'db', unitPriceHuf: amount, netAmountHuf: amount, vatExemption: AAM }],
          insDate: `${issueDate}T10:00:00Z`,
          supplier,
          transactionId: transactionIdFor(taxNumber, invoiceNumber),
          index: 1,
        });
      }
    }
    // One STORNO per year (of the 4th invoice), so consumers see a real correction chain.
    const base = out[3];
    if (base) {
      const issueDate = addDays(base.issueDate, 6);
      if (issueDate.startsWith(`${year}-`)) {
        const invoiceNumber = `MINTA-${year}-S01`;
        out.push({
          ...base,
          invoiceNumber,
          operation: 'STORNO',
          issueDate,
          deliveryDate: base.deliveryDate ?? base.issueDate,
          paymentDate: issueDate,
          netAmountHuf: -base.netAmountHuf,
          grossAmountHuf: -base.grossAmountHuf,
          vatAmountHuf: 0,
          originalInvoiceNumber: base.invoiceNumber,
          modificationIndex: 1,
          lines: base.lines.map((l) => ({
            ...l,
            lineNo: l.lineNo,
            description: `Sztornó: ${l.description ?? ''}`.trim(),
            quantity: l.quantity !== undefined ? -l.quantity : undefined,
            netAmountHuf: -l.netAmountHuf,
          })) as FixtureInvoice['lines'],
          insDate: `${issueDate}T10:00:00Z`,
          transactionId: transactionIdFor(taxNumber, invoiceNumber),
        });
      }
    }
    return out.sort((a, b) => (a.issueDate === b.issueDate ? a.invoiceNumber.localeCompare(b.invoiceNumber) : a.issueDate < b.issueDate ? -1 : 1));
  }

  private buildInbound(taxNumber: string, year: number): MockInvoice[] {
    if (!isValidTaxNumber(taxNumber)) return [];
    const customer = this.party(taxNumber) as MockParty;
    const out: MockInvoice[] = [];
    for (let month = 1; month <= 12; month++) {
      const r = rng(hash(`${taxNumber}|${year}|${month}|in`));
      const s = GEN_SUPPLIERS[month % GEN_SUPPLIERS.length] ?? GEN_SUPPLIERS[0]!;
      const supplier = this.parties.get(s.taxNumber) as MockParty;
      const issueDate = `${year}-${pad(month, 2)}-06`;
      const net = Math.round((6_000 + r() * 24_000) / 100) * 100;
      const vat = Math.round(net * 0.27);
      const invoiceNumber = `${s.prefix}-${year}${pad(month, 2)}-${pad(hash(`${taxNumber}|${year}|${month}`) % 10_000, 4)}`;
      out.push({
        invoiceNumber,
        operation: 'CREATE',
        category: 'NORMAL',
        issueDate,
        deliveryDate: issueDate,
        paymentDate: addDays(issueDate, 8),
        paymentMethod: r() < 0.5 ? 'CARD' : 'TRANSFER',
        currency: 'HUF',
        netAmountHuf: net,
        vatAmountHuf: vat,
        grossAmountHuf: net + vat,
        supplierTaxNumber: s.taxNumber,
        supplierName: s.name,
        customer: { name: customer.name, taxNumber, vatStatus: 'DOMESTIC' },
        lines: [{ lineNo: 1, description: s.what, quantity: 1, unit: 'db', unitPriceHuf: net, netAmountHuf: net, vatPercentage: 0.27 }],
        insDate: `${issueDate}T10:00:00Z`,
        supplier,
        transactionId: transactionIdFor(s.taxNumber, invoiceNumber),
        index: 1,
      });
    }
    return out;
  }
}

/** Fictional technical-user credentials the mock verifies strictly (for seeding the demo clients). */
export function demoCredentialsFor(taxNumber: string): { login: string; password: string; signatureKey: string; exchangeKey: string; taxNumber: string } {
  return {
    login: `demo${taxNumber}`,
    password: `demo-jelszo-${taxNumber}`,
    signatureKey: `demo-alairokulcs-${taxNumber}`,
    exchangeKey: `demo-cserekulcs-${taxNumber}`,
    taxNumber,
  };
}

