// HTTP transport (fetch, Node ≥ 22). POST application/xml, UTF-8, 60 s timeout, no redirects.
import { NavError } from './errors.js';
import { READ_OPERATIONS, type NavReadOperation, type Transport, type TransportRequest } from './types.js';

/** Largest response we accept (queryInvoiceData of a big invoice is a few MB at most). */
export const MAX_RESPONSE_BYTES = 48 * 1024 * 1024;

export function assertReadOperation(op: string): asserts op is NavReadOperation {
  if (!(READ_OPERATIONS as readonly string[]).includes(op)) {
    throw new NavError({ code: 'OPERATION_NOT_ALLOWED', navMessage: 'only read operations are allowed' });
  }
}

export function createHttpTransport(opts: { fetch?: typeof fetch } = {}): Transport {
  const doFetch = opts.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('global fetch is not available (Node ≥ 22 required)');
  return async (req: TransportRequest) => {
    assertReadOperation(req.operation);
    if (!req.url.endsWith(`/${req.operation}`)) {
      throw new NavError({ code: 'OPERATION_NOT_ALLOWED', navMessage: 'url does not match operation' });
    }
    let res: Response;
    try {
      res = await doFetch(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
        body: req.body,
        redirect: 'error',
        signal: AbortSignal.timeout(req.timeoutMs),
      });
    } catch (cause) {
      const name = (cause as { name?: string } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new NavError({ code: 'TIMEOUT', operation: req.operation, cause });
      }
      throw new NavError({ code: 'NETWORK', operation: req.operation, cause });
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > MAX_RESPONSE_BYTES) {
      throw new NavError({ code: 'BAD_RESPONSE', operation: req.operation, httpStatus: res.status, navMessage: 'response too large' });
    }
    let buf: ArrayBuffer;
    try {
      buf = await res.arrayBuffer();
    } catch (cause) {
      const name = (cause as { name?: string } | null)?.name;
      throw new NavError({ code: name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK', operation: req.operation, cause });
    }
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      throw new NavError({ code: 'BAD_RESPONSE', operation: req.operation, httpStatus: res.status, navMessage: 'response too large' });
    }
    const out: { status: number; body: string; contentType?: string } = {
      status: res.status,
      body: new TextDecoder('utf-8').decode(buf),
    };
    const ct = res.headers.get('content-type');
    if (ct) out.contentType = ct;
    return out;
  };
}
