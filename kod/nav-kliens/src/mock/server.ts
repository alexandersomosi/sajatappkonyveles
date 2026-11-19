// DEMO transports: in-process (no network) and a local HTTP server that looks like
// https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3/<operation>.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { NavError } from '../errors.js';
import type { DemoFixtures, Transport } from '../types.js';
import { createMockHandler, type MockOptions } from './handler.js';

/**
 * In-process mock transport for NAV_MODE=demo. Same XML in, same XML out as the real API,
 * fictional data only. `fixtures` default: kod/shared/demo/fixtures.json.
 */
export function createDemoTransport(fixtures?: DemoFixtures, opts: Omit<MockOptions, 'fixtures'> = {}): Transport {
  const handler = createMockHandler({ ...opts, ...(fixtures ? { fixtures } : {}) });
  return async (req) => {
    const op = req.url.slice(req.url.lastIndexOf('/') + 1);
    if (op !== req.operation) throw new NavError({ code: 'OPERATION_NOT_ALLOWED', navMessage: 'url does not match operation' });
    const res = handler(req.operation, req.body);
    return { status: res.status, body: res.body, contentType: res.contentType };
  };
}

export interface MockServerOptions extends MockOptions {
  /** 0 = pick a free port. */
  port: number;
  /** Default 127.0.0.1 (never listens on public interfaces unless told to). */
  host?: string;
}

export interface MockServer {
  /** Base URL to use as `baseUrl` / NAV_BASE_URL, e.g. http://127.0.0.1:8099/invoiceService/v3 */
  url: string;
  port: number;
  close(): Promise<void>;
}

const MAX_BODY = 2 * 1024 * 1024;
const PREFIX = '/invoiceService/v3/';

export async function startMockServer(o: MockServerOptions): Promise<MockServer> {
  const handler = createMockHandler(o);
  const host = o.host ?? '127.0.0.1';
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    if (req.method !== 'POST' || !url.startsWith(PREFIX)) {
      res.writeHead(404, { 'Content-Type': 'text/plain;charset=UTF-8' }).end('Not Found');
      return;
    }
    const op = url.slice(PREFIX.length).split('?')[0] ?? '';
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        tooLarge = true;
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) return;
      const out = handler(op, Buffer.concat(chunks).toString('utf8'));
      res.writeHead(out.status, { 'Content-Type': out.contentType, 'X-Demo-Mock': 'nav-online-szamla' }).end(out.body);
    });
    req.on('error', () => {
      if (!res.headersSent) res.writeHead(400).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port, host, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  const shownHost = host.includes(':') ? `[${host}]` : host;
  return {
    url: `http://${shownHost}:${port}/invoiceService/v3`,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections?.();
      }),
  };
}
