// Public types of @kezjegy/nav-kliens (SPEC §8.5). Field names are the contract the backend codes against.
// Additions beyond §8.5 are optional fields only (see SPEC §24 builder note of nav-kliens).

/** Where requests go. `demo` = in-process mock with fictional data (nothing leaves the machine). */
export type NavEnvironment = 'demo' | 'test' | 'prod';

export type InvoiceDirection = 'OUTBOUND' | 'INBOUND';
export type InvoiceOperation = 'CREATE' | 'MODIFY' | 'STORNO';

/**
 * The ONLY operations this package can call. All of them are read-only queries.
 * Data-reporting / annulment / token operations of the NAV API deliberately do not exist here
 * (owner decision: the app never files anything to NAV, SPEC §2.4).
 */
export const READ_OPERATIONS = [
  'queryInvoiceDigest',
  'queryInvoiceData',
  'queryTaxpayer',
  'queryInvoiceChainDigest',
] as const;
export type NavReadOperation = (typeof READ_OPERATIONS)[number];

export interface NavCredentials {
  /** Technical user login, [a-zA-Z0-9]{6,15}. */
  login: string;
  /** Technical user password (plain; only its SHA-512 hash is ever sent). */
  password: string;
  /** "XML aláírókulcs" – used only to compute requestSignature, never sent. */
  signatureKey: string;
  /** "XML cserekulcs" – not needed for queries; kept so the backend can store all four values together. */
  exchangeKey?: string;
  /** The taxpayer's törzsszám (8 digits). A full adószám "12345678-1-41" is accepted and cut to 8 digits. */
  taxNumber: string;
}

export interface NavSoftware {
  /** [0-9A-Z-]{18}; recommendation: "HU" + developer törzsszám (8) + 8 own characters. */
  softwareId: string;
  softwareName: string;
  softwareMainVersion: string;
  softwareDevName: string;
  softwareDevContact: string;
  softwareDevCountryCode?: string;
  softwareDevTaxNumber?: string;
}

export interface VatReason {
  /** e.g. "AAM" (alanyi adómentes), "TAM", "KBAET"… */
  case: string;
  reason: string;
}

export interface InvoiceDigest {
  invoiceNumber: string;
  batchIndex?: number;
  operation: InvoiceOperation;
  /** NORMAL | SIMPLIFIED | AGGREGATE */
  category: string;
  issueDate: string;
  deliveryDate?: string;
  paymentDate?: string;
  /** TRANSFER | CASH | CARD | VOUCHER | OTHER */
  paymentMethod?: string;
  currency: string;
  /** Integer forint (rounded half away from zero from NAV's 2-decimal HUF amounts). */
  netAmountHuf: number;
  vatAmountHuf: number;
  supplierTaxNumber: string;
  /** Extension: supplier name (mandatory in NAV's digest; useful for INBOUND). */
  supplierName?: string;
  customerName?: string;
  customerTaxNumber?: string;
  originalInvoiceNumber?: string;
  modificationIndex?: number;
  /** Server-side processing time at NAV, ISO-8601 UTC. */
  insDate: string;
  transactionId?: string;
  /** Extension: index of the invoice inside its NAV transaction (1–100). */
  index?: number;
  /** WEB | XML | MGM | OPG | OSZ at NAV; always "DEMO" for mock data (UI shows a "MINTA" label). */
  source?: string;
  completeness?: boolean;
  /** Extension: PAPER | ELECTRONIC | EDI | UNKNOWN */
  invoiceAppearance?: string;
}

export interface InvoiceLine {
  lineNo: number;
  description?: string;
  quantity?: number;
  /** Hungarian short unit ("db", "óra", "kg"…) or the issuer's own unit text. */
  unit?: string;
  /** Extension: NAV unitOfMeasure code (PIECE, HOUR, OWN…). */
  unitCode?: string;
  unitPriceHuf?: number;
  netAmountHuf: number;
  /** Extension. */
  vatAmountHuf?: number;
  /** Extension. */
  grossAmountHuf?: number;
  /** Extension: e.g. 0.27 for 27 %. */
  vatPercentage?: number;
  /** Extension: VAT content rate of a simplified invoice line (e.g. 0.2126). */
  vatContent?: number;
  vatExemption?: VatReason;
  /** Extension: "ÁFA tárgyi hatályán kívül" reason. */
  vatOutOfScope?: VatReason;
  /** Extension: for MODIFY/STORNO documents – which line of the original is affected. */
  modifiesLine?: { lineNo: number; operation: 'CREATE' | 'MODIFY' };
}

export interface NormalizedInvoice extends InvoiceDigest {
  grossAmountHuf: number;
  exchangeRate?: number;
  customer: {
    name?: string;
    taxNumber?: string;
    vatStatus?: 'DOMESTIC' | 'PRIVATE_PERSON' | 'OTHER';
    /** Extension: EU VAT number for OTHER customers. */
    communityVatNumber?: string;
    /** Extension: third-country tax id for OTHER customers. */
    thirdStateTaxId?: string;
  };
  /** Extension: set when every line has the same VAT exemption (e.g. AAM for alanyi adómentes). */
  vatExemption?: VatReason;
  /** Extension: true for a modification without a reported base invoice. */
  modifyWithoutMaster?: boolean;
  lines: InvoiceLine[];
}

export interface TaxpayerInfo {
  valid: boolean;
  name?: string;
  /** Extension fields below. */
  shortName?: string;
  incorporation?: 'ORGANIZATION' | 'SELF_EMPLOYED' | 'TAXABLE_PERSON' | string;
  vatCode?: string;
  countyCode?: string;
  infoDate?: string;
  /** First HQ (székhely) address, single line. */
  address?: string;
}

export interface InvoiceChainElement {
  invoiceNumber: string;
  batchIndex?: number;
  operation: InvoiceOperation;
  supplierTaxNumber: string;
  customerTaxNumber?: string;
  insDate: string;
  originalRequestVersion?: string;
  originalInvoiceNumber?: string;
  modificationIndex?: number;
}

export interface SyncItem {
  digest: InvoiceDigest;
  /** Fetches and decodes the full invoice (one rate-limited queryInvoiceData call). Call it only for new digests. */
  data: () => Promise<{ invoice: NormalizedInvoice; rawXml: string }>;
}

export interface NavClient {
  readonly environment: NavEnvironment;
  queryInvoiceDigest(p: {
    direction: InvoiceDirection;
    page: number;
    issueDate?: { from: string; to: string };
    insDate?: { from: string; to: string };
  }): Promise<{ currentPage: number; availablePage: number; digests: InvoiceDigest[] }>;
  queryInvoiceData(p: {
    invoiceNumber: string;
    direction: InvoiceDirection;
    batchIndex?: number;
    supplierTaxNumber?: string;
  }): Promise<{ invoice: NormalizedInvoice; rawXml: string; insDate?: string }>;
  queryTaxpayer(taxNumber: string): Promise<TaxpayerInfo>;
  /** Extension (read-only): the chain of an invoice and its modifications. */
  queryInvoiceChainDigest(p: {
    invoiceNumber: string;
    direction: InvoiceDirection;
    taxNumber?: string;
    page?: number;
  }): Promise<{ currentPage: number; availablePage: number; elements: InvoiceChainElement[] }>;
  /**
   * First run (`since` null): issue-date windows (≤ 35 days) from 1 Jan of `asOf`'s year to `asOf`
   * (from 1 Jan of the previous year when `asOf` is in January). Later runs: insDate windows from
   * `since` − 1 day to now. Digests are de-duplicated within one run.
   */
  syncOutbound(p: { since: string | null; asOf: string }): AsyncIterable<SyncItem>;
  /** Extension: same as syncOutbound for any direction (INBOUND = invoices issued to the taxpayer). */
  syncInvoices(p: { direction: InvoiceDirection; since: string | null; asOf: string }): AsyncIterable<SyncItem>;
  /** Extension: "Kapcsolat ellenőrzése" – queryTaxpayer with the credentials' own tax number. Never throws NavError. */
  checkConnection(): Promise<{ ok: boolean; code?: string; messageHu: string; taxpayerName?: string }>;
}

export interface TransportRequest {
  operation: NavReadOperation;
  url: string;
  body: string;
  timeoutMs: number;
}

export interface TransportResponse {
  status: number;
  body: string;
  contentType?: string;
}

/** Sends one XML request. The HTTP transport uses fetch; the demo transport answers in-process. */
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

/** Observability hook. Never receives credentials, request bodies or invoice data. */
export interface NavCallEvent {
  operation: NavReadOperation;
  attempt: number;
  ok: boolean;
  durationMs: number;
  httpStatus?: number;
  code?: string;
  willRetry?: boolean;
}

/** One invoice in kod/shared/demo/fixtures.json → navInvoices[taxNumber8]. */
export interface FixtureInvoice {
  invoiceNumber: string;
  operation: InvoiceOperation;
  category: string;
  issueDate: string;
  deliveryDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  currency: string;
  netAmountHuf: number;
  vatAmountHuf: number;
  grossAmountHuf: number;
  vatExemption?: VatReason;
  supplierTaxNumber: string;
  supplierName?: string;
  customer: {
    name?: string;
    taxNumber?: string;
    vatStatus?: 'DOMESTIC' | 'PRIVATE_PERSON' | 'OTHER';
  };
  lines: {
    lineNo: number;
    description?: string;
    quantity?: number;
    unit?: string;
    unitPriceHuf?: number;
    netAmountHuf: number;
    vatPercentage?: number;
    vatExemption?: VatReason;
  }[];
  /** Missing in the shared fixtures → issueDate + "T10:00:00Z". */
  insDate?: string;
  originalInvoiceNumber?: string;
  modificationIndex?: number;
  exchangeRate?: number;
}

export interface DemoFixtures {
  today?: string;
  navInvoices: Record<string, FixtureInvoice[]>;
  /** Optional: "taxIds" block of fixtures.json, used for the demo clients' vatCode/countyCode. */
  taxIds?: Record<string, { adoszam?: string; adoazonositoJel?: string }>;
}
