// Environment → NAV settings (SPEC §13). NAV_MODE=demo|test|prod.
// Rule (§13.1): never pretend. In test/prod a missing software identity makes the integration
// "not configured" (configured=false + problems) instead of silently using demo values.
import { isPlaceholder, loadBrand } from './assets.js';
import { SOFTWARE_ID_RE } from './validate.js';
import type { NavEnvironment, NavSoftware } from './types.js';

export const NAV_BASE_URLS: Readonly<Record<'test' | 'prod', string>> = {
  test: 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3',
  prod: 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3',
};

/** Syntactically valid placeholder; [OWNER] replace with "HU" + Somosi Kft. törzsszám + 8 own chars. */
export const DEMO_SOFTWARE_ID = 'HU00000000KEZJEGY1';
export const DEFAULT_SOFTWARE_VERSION = '1.0';

export interface NavRuntimeConfig {
  environment: NavEnvironment;
  /** null in demo mode (in-process mock) unless NAV_BASE_URL points to a local mock server. */
  baseUrl: string | null;
  software: NavSoftware;
  /** false → the backend must answer 503 not_configured and show "még nincs bekapcsolva". */
  configured: boolean;
  /** Plain list of what is missing (no secret values). */
  problems: string[];
  /** For /health and the UI: "DEMO (minta adatok)", "NAV teszt", "NAV éles". */
  label: string;
  syncHour: number;
}

type Env = Record<string, string | undefined>;

function isLocalUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function navConfigFromEnv(env: Env = process.env): NavRuntimeConfig {
  const problems: string[] = [];
  const rawMode = (env.NAV_MODE ?? 'demo').trim().toLowerCase();
  let environment: NavEnvironment;
  if (rawMode === 'demo' || rawMode === 'test' || rawMode === 'prod') {
    environment = rawMode;
  } else {
    environment = 'demo';
    problems.push(`NAV_MODE="${rawMode}" is not demo|test|prod`);
  }

  const brand = loadBrand();
  const devName = env.NAV_DEV_NAME?.trim() || (isPlaceholder(brand.provider?.legalName) ? undefined : brand.provider?.legalName);
  const devContact =
    env.NAV_DEV_CONTACT?.trim() || (isPlaceholder(brand.provider?.supportEmail) ? undefined : brand.provider?.supportEmail);
  const devTax = env.NAV_DEV_TAX_NUMBER?.trim() || (isPlaceholder(brand.provider?.taxNumber) ? undefined : brand.provider?.taxNumber);
  const softwareId = env.NAV_SOFTWARE_ID?.trim() || undefined;

  const software: NavSoftware = {
    softwareId: softwareId ?? DEMO_SOFTWARE_ID,
    softwareName: [...(brand.name || 'Kezjegy')].slice(0, 50).join(''),
    softwareMainVersion: (env.NAV_SOFTWARE_VERSION?.trim() || DEFAULT_SOFTWARE_VERSION).slice(0, 15),
    softwareDevName: devName ?? 'Somosi Kft.',
    softwareDevContact: devContact ?? 'demo@demo.kezjegy.test',
    softwareDevCountryCode: 'HU',
  };
  if (devTax) software.softwareDevTaxNumber = devTax.slice(0, 50);

  if (softwareId && !SOFTWARE_ID_RE.test(softwareId)) problems.push('NAV_SOFTWARE_ID must match [0-9A-Z-]{18}');
  if (environment !== 'demo') {
    if (!softwareId) problems.push('NAV_SOFTWARE_ID is not set');
    else if (softwareId === DEMO_SOFTWARE_ID && environment === 'prod') problems.push('NAV_SOFTWARE_ID is still the demo value');
    if (!devName) problems.push('NAV_DEV_NAME is not set');
    if (!devContact) problems.push('NAV_DEV_CONTACT is not set');
  }

  let baseUrl: string | null = environment === 'demo' ? null : NAV_BASE_URLS[environment];
  const override = env.NAV_BASE_URL?.trim();
  if (override) {
    if (environment === 'prod') {
      problems.push('NAV_BASE_URL is ignored in prod mode');
    } else if (environment === 'demo' && !isLocalUrl(override)) {
      problems.push('NAV_BASE_URL in demo mode must be a local http URL (mock server)');
    } else {
      baseUrl = override.replace(/\/+$/, '');
    }
  }

  const hour = Number(env.NAV_SYNC_HOUR ?? '5');
  const syncHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 5;

  const label = environment === 'demo' ? 'DEMO (minta adatok, nem a NAV)' : environment === 'test' ? 'NAV teszt' : 'NAV éles';
  return { environment, baseUrl, software, configured: problems.length === 0, problems, label, syncHour };
}
