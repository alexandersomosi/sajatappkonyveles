#!/usr/bin/env node
// Local NAV Online Számla DEMO mock server.
//   node dist/mock/cli.js [--port 8099] [--host 127.0.0.1] [--page-size 100] [--today 2026-11-17]
// Then: NAV_MODE=test NAV_BASE_URL=http://127.0.0.1:8099/invoiceService/v3 (or demo + NAV_BASE_URL).
import { startMockServer } from './server.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const port = Number(arg('port') ?? process.env.NAV_MOCK_PORT ?? 8099);
const host = arg('host') ?? '127.0.0.1';
const pageSize = arg('page-size') ? Number(arg('page-size')) : undefined;
const today = arg('today');
if (today !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error('--today must be YYYY-MM-DD');
  process.exit(2);
}
// --today fixes the business date (which invoices exist); request timestamps are still checked
// against the real clock (±1 day), exactly like NAV does.

const server = await startMockServer({
  port,
  host,
  ...(pageSize ? { pageSize } : {}),
  ...(today ? { today } : {}),
});
console.log(`NAV DEMO mock fut: ${server.url}  (kitalált MINTA adatok – ez NEM a NAV)`);

const stop = () => {
  void server.close().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
