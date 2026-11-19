// @kezjegy/nav-kliens – READ-ONLY client for NAV Online Számla API v3.0 (SPEC §8).
// There is deliberately no data-reporting, annulment or token operation anywhere in this package.
import { createNavClient, type NavClientOptions } from './client.js';
import { navConfigFromEnv } from './config.js';
import { NavError } from './errors.js';
import type { NavClient, NavCredentials, Transport } from './types.js';

export type * from './types.js';
export { READ_OPERATIONS } from './types.js';
export { createNavClient, mapDigest, digestKey, type NavClientOptions } from './client.js';
export { passwordHash, requestSignature, signatureTimestamp, newRequestId, REQUEST_ID_RE } from './crypto.js';
export { NavError, isNavError, navErrorMessageHu, NAV_ERROR_MAP, type NavErrorKind } from './errors.js';
export { decodeInvoiceData, parseInvoiceDataXml, UNIT_LABELS_HU, type InvoiceDataContext } from './invoiceData.js';
export { navConfigFromEnv, NAV_BASE_URLS, DEMO_SOFTWARE_ID, type NavRuntimeConfig } from './config.js';
export { splitDateWindows, splitTimeWindows, budapestDate, MAX_WINDOW_DAYS } from './windows.js';
export { RateLimiter, sharedLimiter, type Clock } from './limiter.js';
export { createHttpTransport } from './transport.js';
export { isValidTaxNumber, normalizeTaxNumber, taxNumberCheckDigit } from './validate.js';
export { decimalToForint } from './money.js';
export { loadDefaultDemoFixtures, loadBrand } from './assets.js';
export { createDemoTransport, startMockServer, type MockServer, type MockServerOptions } from './mock/server.js';
export { createMockHandler, type MockOptions, type MockTechnicalUser } from './mock/handler.js';
export { demoCredentialsFor } from './mock/dataset.js';

/**
 * Convenience for the backend/worker: settings from env (NAV_MODE, NAV_SOFTWARE_ID, NAV_DEV_*, NAV_BASE_URL)
 * + one client's decrypted credentials. Throws NavError NOT_CONFIGURED when test/prod settings are incomplete
 * (SPEC §13.1: never pretend in production).
 */
export function createNavClientFromEnv(
  credentials: NavCredentials,
  env: Record<string, string | undefined> = process.env,
  extra: Partial<Omit<NavClientOptions, 'environment' | 'credentials' | 'software'>> & { transport?: Transport } = {},
): NavClient {
  const cfg = navConfigFromEnv(env);
  if (!cfg.configured) {
    throw new NavError({ code: 'NOT_CONFIGURED', navMessage: cfg.problems.join('; ') });
  }
  return createNavClient({
    environment: cfg.environment,
    credentials,
    software: cfg.software,
    ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
    ...extra,
  });
}
