// Environment → typed, frozen config (SPEC §13). Read once at start. Missing keys stop the
// process with a clear message; integrations without keys run their DEMO adapter only when
// APP_ENV=demo, and are "disabled" (503 not_configured) when APP_ENV=production (SPEC §13.1).
import brand from './_shared/brand.json' with { type: 'json' };

export type AppEnv = 'demo' | 'production';
export type MailMode = 'smtp' | 'demo' | 'disabled';
export type SimplePayMode = 'demo' | 'sandbox' | 'live' | 'disabled';
export type InvoiceMode = 'demo' | 'szamlazzhu' | 'billingo' | 'disabled';
export type NavMode = 'demo' | 'test' | 'prod' | 'disabled';
export type PushMode = 'demo' | 'expo' | 'disabled';

export interface Config {
  version: string;
  appEnv: AppEnv;
  nodeEnv: string;
  isTest: boolean;
  port: number;
  databaseUrl: string;
  appPublicUrl: string;
  panelPublicUrl: string;
  apiPublicUrl: string;
  jwtSecret: Buffer;
  codeHmacSecret: Buffer;
  fileLinkSecret: Buffer;
  auditIpSalt: Buffer;
  fileEncKey: Buffer;
  fileEncKeyId: number;
  appDataKey: Buffer;
  navCredKey: Buffer;
  filesDir: string;
  legalDir: string;
  fontDir: string;
  staffTotpRequired: boolean;
  mail: { mode: MailMode; host: string; port: number; user: string; pass: string; from: string; replyTo: string };
  google: { clientIds: string[]; web?: string; android?: string; ios?: string };
  appleBundleId: string;
  simplepay: {
    mode: SimplePayMode;
    merchant: string;
    secret: string;
    recurringTimes: number;
    tokenValidMonths: number;
    demoSecret: string;
    baseUrl: string;
  };
  planPriceHuf: number;
  invoice: { mode: InvoiceMode; szamlazzhuKey: string; billingoKey: string };
  nav: {
    mode: NavMode;
    softwareId: string;
    softwareVersion: string;
    devName: string;
    devContact: string;
    devTaxNumber: string;
    syncHour: number;
  };
  push: { mode: PushMode; expoAccessToken: string };
  logLevel: string;
  seedCredentialsFile: string;
  trustProxyHops: number;
  /** SPEC §26.1.7 [OWNER]: when a new-business client is charged first. */
  newBusinessChargePolicy: 'adoszam_utan' | 'azonnal';
  /** SPEC §26.2.3: callback deadline in calendar hours (default 48). */
  callbackDueHours: number;
  /** SPEC §26.2.2 [OWNER]: the number we call from; empty = the line is hidden. */
  callbackCallerId: string;
  /** SPEC §26.7.1: absolute media base for native apps. */
  mediaBaseUrl: string;
  /** SPEC §27.3: "Intézzük helyetted" – kill switch and last day of the EV part, default jogcím of our accountant. */
  assist: { evEnabled: boolean; evValidUntil: string; ujegykeJogcim: '9' | '60' };
  /** SPEC §27.11 S6: per-client storage quota (bytes) before / after activation; refuse uploads when the file disk has less free space than minFreeDiskBytes (or, when set, less than minFreeDiskPct %). */
  quota: { beforeActivationBytes: number; afterActivationBytes: number; minFreeDiskPct: number; minFreeDiskBytes: number };
}

export class ConfigError extends Error {}

function str(env: NodeJS.ProcessEnv, k: string, d = ''): string {
  const v = env[k];
  return v === undefined || v === null ? d : String(v).trim();
}

function int(env: NodeJS.ProcessEnv, k: string, d: number, min: number, max: number): number {
  const raw = str(env, k);
  if (raw === '') return d;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${k}: egész szám kell ${min} és ${max} között.`);
  return n;
}

function bool(env: NodeJS.ProcessEnv, k: string, d: boolean): boolean {
  const raw = str(env, k).toLowerCase();
  if (raw === '') return d;
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

/** 32 random bytes as base64 (or 64 hex chars). Never logged. */
function key32(env: NodeJS.ProcessEnv, k: string): Buffer {
  const raw = str(env, k);
  if (!raw) throw new ConfigError(`${k} hiányzik (32 bájtos kulcs base64-ben). Lásd kod/deploy/env.example.`);
  let b: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) b = Buffer.from(raw, 'hex');
  else b = Buffer.from(raw, 'base64');
  if (b.length !== 32) throw new ConfigError(`${k}: pontosan 32 bájt kell (most ${b.length}).`);
  return b;
}

/** Secrets used as HMAC keys: at least 16 bytes of entropy, any encoding. */
function secret(env: NodeJS.ProcessEnv, k: string): Buffer {
  const raw = str(env, k);
  if (raw.length < 16) throw new ConfigError(`${k} hiányzik vagy túl rövid (legalább 16 karakter, javasolt 32 bájt base64).`);
  return Buffer.from(raw, 'utf8');
}

function url(env: NodeJS.ProcessEnv, k: string, d: string): string {
  const v = str(env, k, d).replace(/\/+$/, '');
  try {
    new URL(v);
  } catch {
    throw new ConfigError(`${k}: érvénytelen URL.`);
  }
  return v;
}

function chargePolicy(env: NodeJS.ProcessEnv): 'adoszam_utan' | 'azonnal' {
  const v = str(env, 'NEW_BUSINESS_CHARGE_POLICY', 'adoszam_utan');
  if (v !== 'adoszam_utan' && v !== 'azonnal') throw new ConfigError('NEW_BUSINESS_CHARGE_POLICY: adoszam_utan vagy azonnal.');
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const appEnvRaw = str(env, 'APP_ENV', 'demo');
  if (appEnvRaw !== 'demo' && appEnvRaw !== 'production') throw new ConfigError('APP_ENV: demo vagy production.');
  const appEnv = appEnvRaw as AppEnv;
  const isDemo = appEnv === 'demo';
  const nodeEnv = str(env, 'NODE_ENV', 'production');
  // Staff see every client's ID cards, tax ids and bank data: 2FA is on by default and cannot be
  // switched off in production (a DEMO deployment with fake data may turn it off for trying out).
  const staffTotpRequired = bool(env, 'STAFF_TOTP_REQUIRED', true);
  if (appEnv === 'production' && !staffTotpRequired) throw new ConfigError('STAFF_TOTP_REQUIRED: éles módban (APP_ENV=production) kötelező a true – a könyvelők és adminok csak kétlépcsős belépéssel dolgozhatnak.');

  // --- mail ---
  const smtpHost = str(env, 'SMTP_HOST');
  const mailFrom = str(env, 'MAIL_FROM');
  let mailMode: MailMode = smtpHost && mailFrom ? 'smtp' : isDemo ? 'demo' : 'disabled';
  const forcedMail = str(env, 'MAIL_MODE');
  if (forcedMail === 'demo' && isDemo) mailMode = 'demo';

  // --- google / apple ---
  const googleIds = str(env, 'GOOGLE_CLIENT_IDS')
    .split(',')
    .map((s) => s.trim());
  const google = {
    clientIds: googleIds.filter(Boolean),
    web: googleIds[0] || undefined,
    android: googleIds[1] || undefined,
    ios: googleIds[2] || undefined,
  };

  // --- SimplePay ---
  const spMerchant = str(env, 'SIMPLEPAY_MERCHANT_HUF');
  const spSecret = str(env, 'SIMPLEPAY_SECRET_HUF');
  const spModeRaw = str(env, 'SIMPLEPAY_MODE');
  let spMode: SimplePayMode;
  if (spModeRaw === 'sandbox' || spModeRaw === 'live') {
    spMode = spMerchant && spSecret ? spModeRaw : isDemo ? 'demo' : 'disabled';
  } else if (spModeRaw === '' || spModeRaw === 'demo') {
    spMode = isDemo ? 'demo' : 'disabled';
  } else throw new ConfigError('SIMPLEPAY_MODE: demo, sandbox vagy live.');
  const demoSecret = str(env, 'SIMPLEPAY_DEMO_SECRET');
  if (spMode === 'demo' && demoSecret.length < 16)
    throw new ConfigError('SIMPLEPAY_DEMO_SECRET hiányzik (DEMO fizetéshez; a telepítő generálja).');

  // --- invoices ---
  const invRaw = str(env, 'INVOICE_MODE', 'demo');
  if (!['demo', 'szamlazzhu', 'billingo'].includes(invRaw)) throw new ConfigError('INVOICE_MODE: demo, szamlazzhu vagy billingo.');
  let invMode: InvoiceMode = invRaw as InvoiceMode;
  if (invMode === 'demo' && !isDemo) invMode = 'disabled';
  if (invMode === 'szamlazzhu' && !str(env, 'SZAMLAZZHU_AGENT_KEY')) invMode = isDemo ? 'demo' : 'disabled';
  if (invMode === 'billingo' && !str(env, 'BILLINGO_API_KEY')) invMode = isDemo ? 'demo' : 'disabled';

  // --- NAV ---
  const navRaw = str(env, 'NAV_MODE', 'demo');
  if (!['demo', 'test', 'prod'].includes(navRaw)) throw new ConfigError('NAV_MODE: demo, test vagy prod.');
  let navMode: NavMode = navRaw as NavMode;
  if (navMode === 'demo' && !isDemo) navMode = 'disabled';
  const softwareId = str(env, 'NAV_SOFTWARE_ID', 'HU00000000KEZJEGY1');
  if (!/^[0-9A-Z-]{18}$/.test(softwareId)) throw new ConfigError('NAV_SOFTWARE_ID: 18 karakter, [0-9A-Z-].');

  // --- push ---
  const pushRaw = str(env, 'PUSH_MODE', isDemo ? 'demo' : '');
  let pushMode: PushMode = pushRaw === 'expo' ? 'expo' : isDemo ? 'demo' : 'disabled';
  if (pushRaw && !['demo', 'expo'].includes(pushRaw)) throw new ConfigError('PUSH_MODE: demo vagy expo.');
  if (pushMode === 'demo' && !isDemo) pushMode = 'disabled';

  const cfg: Config = {
    version: str(env, 'APP_VERSION', '0.1.0'),
    appEnv,
    nodeEnv,
    isTest: nodeEnv === 'test',
    port: int(env, 'PORT', 8080, 1, 65535),
    databaseUrl: str(env, 'DATABASE_URL'),
    appPublicUrl: url(env, 'APP_PUBLIC_URL', 'https://app.45-94-65-74.sslip.io'),
    panelPublicUrl: url(env, 'PANEL_PUBLIC_URL', 'https://konyvelo.45-94-65-74.sslip.io'),
    apiPublicUrl: url(env, 'API_PUBLIC_URL', 'https://api.45-94-65-74.sslip.io'),
    jwtSecret: secret(env, 'JWT_SECRET'),
    codeHmacSecret: secret(env, 'CODE_HMAC_SECRET'),
    fileLinkSecret: secret(env, 'FILE_LINK_SECRET'),
    auditIpSalt: secret(env, 'AUDIT_IP_SALT'),
    fileEncKey: key32(env, 'FILE_ENC_KEY'),
    fileEncKeyId: int(env, 'FILE_ENC_KEY_ID', 1, 1, 255),
    appDataKey: key32(env, 'APP_DATA_KEY'),
    navCredKey: key32(env, 'NAV_CRED_KEY'),
    filesDir: str(env, 'FILES_DIR', '/data/files'),
    legalDir: str(env, 'LEGAL_DIR', '/app/legal'),
    fontDir: str(env, 'FONT_DIR', '/app/fonts'),
    staffTotpRequired,
    mail: {
      mode: mailMode,
      host: smtpHost,
      port: int(env, 'SMTP_PORT', 587, 1, 65535),
      user: str(env, 'SMTP_USER'),
      pass: str(env, 'SMTP_PASS'),
      from: mailFrom,
      replyTo: str(env, 'MAIL_REPLY_TO'),
    },
    google,
    appleBundleId: str(env, 'APPLE_BUNDLE_ID'),
    simplepay: {
      mode: spMode,
      merchant: spMerchant,
      secret: spSecret,
      recurringTimes: int(env, 'SIMPLEPAY_RECURRING_TIMES', 12, 1, 24),
      tokenValidMonths: int(env, 'SIMPLEPAY_TOKEN_VALID_MONTHS', 12, 1, 24),
      demoSecret,
      baseUrl:
        spMode === 'live' ? 'https://secure.simplepay.hu/payment/v2' : 'https://sandbox.simplepay.hu/payment/v2',
    },
    planPriceHuf: int(env, 'PLAN_PRICE_HUF', brand.priceHufMonthlyGross, 100, 10_000_000),
    invoice: { mode: invMode, szamlazzhuKey: str(env, 'SZAMLAZZHU_AGENT_KEY'), billingoKey: str(env, 'BILLINGO_API_KEY') },
    nav: {
      mode: navMode,
      softwareId,
      softwareVersion: str(env, 'NAV_SOFTWARE_VERSION', '0.1'),
      devName: str(env, 'NAV_DEV_NAME', brand.provider.legalName),
      devContact: str(env, 'NAV_DEV_CONTACT', 'fejlesztes@demo.kezjegy.test'),
      devTaxNumber: str(env, 'NAV_DEV_TAX_NUMBER'),
      syncHour: int(env, 'NAV_SYNC_HOUR', 5, 0, 23),
    },
    push: { mode: pushMode, expoAccessToken: str(env, 'EXPO_ACCESS_TOKEN') },
    logLevel: str(env, 'LOG_LEVEL', 'info'),
    seedCredentialsFile: str(env, 'SEED_CREDENTIALS_FILE', '/run/seed/demo_belepesek.txt'),
    trustProxyHops: int(env, 'TRUST_PROXY_HOPS', 1, 0, 5),
    newBusinessChargePolicy: chargePolicy(env),
    callbackDueHours: int(env, 'CALLBACK_DUE_HOURS', 48, 4, 24 * 14),
    callbackCallerId: str(env, 'CALLBACK_CALLER_ID'),
    mediaBaseUrl: `${url(env, 'APP_PUBLIC_URL', 'https://app.45-94-65-74.sslip.io')}/media/`,
    assist: assistCfg(env),
    quota: {
      beforeActivationBytes: int(env, 'QUOTA_BEFORE_ACTIVATION_MB', 300, 10, 100_000) * 1024 * 1024,
      afterActivationBytes: int(env, 'QUOTA_AFTER_ACTIVATION_MB', 4096, 50, 1_000_000) * 1024 * 1024,
      minFreeDiskPct: int(env, 'MIN_FREE_DISK_PCT', 0, 0, 90),
      minFreeDiskBytes: int(env, 'MIN_FREE_DISK_MB', 5120, 0, 10_000_000) * 1024 * 1024,
    },
  };
  const keys = [cfg.fileEncKey, cfg.appDataKey, cfg.navCredKey].map((b) => b.toString('hex'));
  if (new Set(keys).size !== 3) throw new ConfigError('FILE_ENC_KEY, APP_DATA_KEY és NAV_CRED_KEY legyen három különböző kulcs.');
  return Object.freeze(cfg);
}

/** SPEC §27.3.1 / §27.13 #22–24: ASSIST_EV_ENABLED (default true), ASSIST_EV_VALID_UNTIL (default 2026-12-31), ASSIST_UJEGYKE_JOGCIM (9 | 60). */
function assistCfg(env: NodeJS.ProcessEnv): Config['assist'] {
  const en = str(env, 'ASSIST_EV_ENABLED', 'true').toLowerCase();
  if (!['true', 'false', '1', '0', 'igen', 'nem'].includes(en)) throw new ConfigError('ASSIST_EV_ENABLED: true vagy false.');
  const until = str(env, 'ASSIST_EV_VALID_UNTIL', '2026-12-31');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new ConfigError('ASSIST_EV_VALID_UNTIL: ÉÉÉÉ-HH-NN.');
  const jc = str(env, 'ASSIST_UJEGYKE_JOGCIM', '9');
  if (jc !== '9' && jc !== '60') throw new ConfigError('ASSIST_UJEGYKE_JOGCIM: 9 vagy 60.');
  return { evEnabled: ['true', '1', 'igen'].includes(en), evValidUntil: until, ujegykeJogcim: jc };
}

/** Modes for /health and /admin/system (never secrets). */
export function integrationModes(c: Config) {
  return {
    nav: c.nav.mode,
    simplepay: c.simplepay.mode,
    mail: c.mail.mode,
    push: c.push.mode,
    invoice: c.invoice.mode,
  };
}
