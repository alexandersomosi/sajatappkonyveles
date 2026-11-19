import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';
import { navConfigFromEnv, DEMO_SOFTWARE_ID } from '../src/config.js';
import { createHttpTransport } from '../src/transport.js';

const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === '_shared') return [];
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('no write operations exist (owner decision: the app never files to NAV)', () => {
  const forbidden = ['manage' + 'Invoice', 'manage' + 'Annulment', 'token' + 'Exchange', 'Invoice' + 'Operations'];
  it('the source never mentions a data-reporting / annulment / token operation', () => {
    for (const f of files(srcDir)) {
      const text = readFileSync(f, 'utf8');
      for (const w of forbidden) expect(text.includes(w), `${w} in ${f}`).toBe(false);
    }
  });
  it('nothing exported looks like a write operation', () => {
    for (const k of Object.keys(api)) expect(k).not.toMatch(/manage|annul|tokenexchange|submit|send/i);
    expect([...api.READ_OPERATIONS]).toEqual(['queryInvoiceDigest', 'queryInvoiceData', 'queryTaxpayer', 'queryInvoiceChainDigest']);
  });
  it('the HTTP transport refuses any non-read operation', async () => {
    const t = createHttpTransport({ fetch: (() => Promise.reject(new Error('must not be called'))) as typeof fetch });
    await expect(t({ operation: ('manage' + 'Invoice') as never, url: 'https://x/manageInvoice', body: '', timeoutMs: 1 })).rejects.toMatchObject({ code: 'OPERATION_NOT_ALLOWED' });
    await expect(t({ operation: 'queryTaxpayer', url: 'https://x/other', body: '', timeoutMs: 1 })).rejects.toMatchObject({ code: 'OPERATION_NOT_ALLOWED' });
  });
});

describe('navConfigFromEnv', () => {
  it('demo by default, brand name from kod/shared/brand.json, demo software id', () => {
    const c = navConfigFromEnv({});
    expect(c).toMatchObject({ environment: 'demo', baseUrl: null, configured: true, syncHour: 5 });
    expect(c.software.softwareId).toBe(DEMO_SOFTWARE_ID);
    expect(c.software.softwareName).toBe(api.loadBrand().name);
    expect(c.label).toContain('DEMO');
  });
  it('prod needs a real software id, dev name and contact; ignores NAV_BASE_URL', () => {
    const bad = navConfigFromEnv({ NAV_MODE: 'prod', NAV_BASE_URL: 'http://127.0.0.1:8099/invoiceService/v3' });
    expect(bad.configured).toBe(false);
    expect(bad.problems.join(' ')).toMatch(/NAV_SOFTWARE_ID/);
    expect(bad.baseUrl).toBe('https://api.onlineszamla.nav.gov.hu/invoiceService/v3');
    const demoId = navConfigFromEnv({ NAV_MODE: 'prod', NAV_SOFTWARE_ID: DEMO_SOFTWARE_ID, NAV_DEV_NAME: 'Somosi Kft.', NAV_DEV_CONTACT: 'a@b.hu' });
    expect(demoId.configured).toBe(false);
    const good = navConfigFromEnv({ NAV_MODE: 'prod', NAV_SOFTWARE_ID: 'HU12345676KEZJEGY1', NAV_DEV_NAME: 'Somosi Kft.', NAV_DEV_CONTACT: 'a@b.hu', NAV_DEV_TAX_NUMBER: '12345676-2-41', NAV_SOFTWARE_VERSION: '1.2' });
    expect(good).toMatchObject({ configured: true, environment: 'prod', label: 'NAV éles' });
    expect(good.software).toMatchObject({ softwareId: 'HU12345676KEZJEGY1', softwareDevTaxNumber: '12345676-2-41', softwareMainVersion: '1.2' });
  });
  it('test mode may point at a local mock; demo only at localhost', () => {
    const t = navConfigFromEnv({ NAV_MODE: 'test', NAV_SOFTWARE_ID: 'HU12345676KEZJEGY1', NAV_DEV_NAME: 'x', NAV_DEV_CONTACT: 'y', NAV_BASE_URL: 'http://127.0.0.1:8099/invoiceService/v3/' });
    expect(t).toMatchObject({ configured: true, baseUrl: 'http://127.0.0.1:8099/invoiceService/v3' });
    const d = navConfigFromEnv({ NAV_MODE: 'demo', NAV_BASE_URL: 'https://example.org/x' });
    expect(d.configured).toBe(false);
  });
  it('unknown mode or bad software id is reported, not guessed', () => {
    expect(navConfigFromEnv({ NAV_MODE: 'live' }).configured).toBe(false);
    expect(navConfigFromEnv({ NAV_SOFTWARE_ID: 'abc' }).configured).toBe(false);
  });
});
