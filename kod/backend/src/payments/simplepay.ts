// SimplePay Online Payment API v2.1 – protocol client (SPEC §9). JSON over HTTPS, every request
// and response signed: header `Signature: base64(HMAC-SHA384(SECRET_KEY, rawBody))`. Responses
// are verified before use. Only IPN FINISHED (or /query FINISHED) changes money state.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import brand from '../_shared/brand.json' with { type: 'json' };

/** Technical id (brand.json ids, never the product name – a rename must not change what SimplePay sees). */
export const SDK_VERSION = `${brand.ids.appScheme.charAt(0).toUpperCase()}${brand.ids.appScheme.slice(1)}_Node_1.0`;
export const FINAL_OK = 'FINISHED';
export const FINAL_FAIL = new Set(['TIMEOUT', 'CANCELLED', 'NOTAUTHORIZED', 'FRAUD', 'REVERSED', 'REFUND']);

export function spSign(secret: string, body: string): string {
  return createHmac('sha384', Buffer.from(secret, 'utf8')).update(Buffer.from(body, 'utf8')).digest('base64');
}

export function spVerify(secret: string, body: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const want = Buffer.from(spSign(secret, body), 'utf8');
  const got = Buffer.from(signature.trim(), 'utf8');
  return want.length === got.length && timingSafeEqual(want, got);
}

export function salt(): string {
  return randomBytes(16).toString('hex');
}

/** "2026-11-17T09:20:00+00:00" (SimplePay wants an explicit offset). */
export function spTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

export interface SpInvoice {
  name: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  address: string;
}

export interface StartRequest {
  orderRef: string;
  customer: string;
  customerEmail: string;
  total: number;
  threeDSReqAuthMethod: '01' | '02' | '05';
  invoice: SpInvoice;
  timeout: Date;
  url: string;
  recurring: { times: number; until: Date; maxAmount: number };
}

export interface StartResponse {
  transactionId: number;
  paymentUrl: string;
  tokens: string[];
  timeout?: string;
}

export interface DoRecurringRequest {
  orderRef: string;
  token: string;
  total: number;
  customer: string;
  customerEmail: string;
  threeDSReqAuthMethod: '01' | '02' | '05';
  invoice: SpInvoice;
}

export class SimplePayError extends Error {
  constructor(
    public readonly errorCodes: string[],
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'SimplePayError';
  }
}

export interface SimplePayApi {
  start(r: StartRequest): Promise<StartResponse>;
  doRecurring(r: DoRecurringRequest): Promise<{ transactionId: number; total: number }>;
  cardCancel(cardId: number): Promise<{ status: string }>;
  cardQuery(cardId: number): Promise<{ status: string; expiry?: string; history?: unknown }>;
  tokenQuery(token: string): Promise<{ status: string; expiry?: string }>;
  tokenCancel(token: string): Promise<{ status: string }>;
  query(orderRefs: string[]): Promise<{ orderRef: string; transactionId?: number; status: string }[]>;
}

export function createSimplePayApi(o: { baseUrl: string; merchant: string; secret: string; fetch?: typeof fetch }): SimplePayApi {
  const f = o.fetch ?? fetch;
  async function call<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({ salt: salt(), merchant: o.merchant, sdkVersion: SDK_VERSION, ...payload });
    let res: Response;
    try {
      res = await f(`${o.baseUrl}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Signature: spSign(o.secret, body) },
        body,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new SimplePayError(['NETWORK'], 'A SimplePay most nem érhető el.');
    }
    const text = await res.text();
    if (!spVerify(o.secret, text, res.headers.get('signature'))) {
      throw new SimplePayError(['BAD_RESPONSE_SIGNATURE'], 'A SimplePay válaszának aláírása nem stimmel.', res.status);
    }
    const json = JSON.parse(text) as Record<string, unknown>;
    if (Array.isArray(json.errorCodes) && json.errorCodes.length) {
      throw new SimplePayError(json.errorCodes.map(String), 'A SimplePay hibát jelzett.', res.status);
    }
    return json as T;
  }
  return {
    async start(r) {
      const j = await call<{ transactionId: number; paymentUrl: string; tokens?: string[]; timeout?: string }>('start', {
        orderRef: r.orderRef,
        currency: 'HUF',
        customer: r.customer,
        customerEmail: r.customerEmail,
        language: 'HU',
        total: r.total,
        methods: ['CARD'],
        threeDSReqAuthMethod: r.threeDSReqAuthMethod,
        invoice: r.invoice,
        timeout: spTime(r.timeout),
        url: r.url,
        recurring: { times: r.recurring.times, until: spTime(r.recurring.until), maxAmount: r.recurring.maxAmount },
      });
      return { transactionId: Number(j.transactionId), paymentUrl: String(j.paymentUrl), tokens: (j.tokens ?? []).map(String), timeout: j.timeout };
    },
    async doRecurring(r) {
      const j = await call<{ transactionId: number; total: number }>('dorecurring', {
        orderRef: r.orderRef,
        currency: 'HUF',
        customer: r.customer,
        customerEmail: r.customerEmail,
        total: r.total,
        token: r.token,
        type: 'MIT',
        threeDSReqAuthMethod: r.threeDSReqAuthMethod,
        methods: ['CARD'],
        invoice: r.invoice,
      });
      return { transactionId: Number(j.transactionId), total: Number(j.total) };
    },
    async cardCancel(cardId) {
      return call<{ status: string }>('cardcancel', { cardId });
    },
    async cardQuery(cardId) {
      return call<{ status: string; expiry?: string }>('cardquery', { cardId, history: true });
    },
    async tokenQuery(token) {
      return call<{ status: string; expiry?: string }>('tokenquery', { token });
    },
    async tokenCancel(token) {
      return call<{ status: string }>('tokencancel', { token });
    },
    async query(orderRefs) {
      const j = await call<{ transactions?: { orderRef: string; transactionId?: number; status: string }[] }>('query', { orderRefs, detailed: false, refunds: false });
      return (j.transactions ?? []).map((t) => ({ orderRef: String(t.orderRef), transactionId: t.transactionId ? Number(t.transactionId) : undefined, status: String(t.status) }));
    },
  };
}

/** Back URL `r` parameter: base64 JSON { r, t, e, m, o }. */
export function decodeBack(r: string): { r: number; t: number; e: string; m: string; o: string; json: string } | null {
  try {
    const json = Buffer.from(r, 'base64').toString('utf8');
    const o = JSON.parse(json) as { r: number; t: number; e: string; m: string; o: string };
    if (typeof o.e !== 'string' || typeof o.o !== 'string') return null;
    return { ...o, json };
  } catch {
    return null;
  }
}
