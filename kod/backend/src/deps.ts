// Dependency container shared by the API, the worker, the seed and the tests. Every external
// integration is created here from the config, so tests can replace any of them.
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { SessionCache } from './auth/tokens.js';
import { createIdTokenVerifier, type IdTokenVerifier } from './auth/oidc.js';
import { ContentStore } from './content.js';
import { FileStorage } from './files/storage.js';
import { LegalStore } from './legal.js';
import { FieldCipher, subKey } from './lib/crypto.js';
import { RateLimiter } from './lib/ratelimit.js';
import { createNavFactory, type NavClientFactory } from './nav/client.js';
import { createMailer, type Mailer } from './notify/mailer.js';
import { createDispatcher } from './notify/notify.js';
import { createPush, type PushSender } from './notify/push.js';
import { createSimplePayApi, type SimplePayApi } from './payments/simplepay.js';
import { createFeeInvoiceProvider, type FeeInvoiceProvider } from './payments/invoices.js';
import type { PaymentProvider } from './payments/provider.js';
import { createStripeProvider } from './payments/stripe.js';
import { createDemoProvider } from './payments/demo.js';
import { createSzamlazzClient, type SzamlazzClient } from './payments/szamlazzhu.js';
import { createUmamiClient, type UmamiClient } from './services/umami.js';

export interface Deps {
  cfg: Config;
  db: Db;
  now: () => Date;
  limiter: RateLimiter;
  data: FieldCipher;
  navKey: FieldCipher;
  lookupKey: Buffer;
  storage: FileStorage;
  mailer: Mailer;
  push: PushSender;
  content: ContentStore;
  legal: LegalStore;
  simplepay: SimplePayApi | null;
  invoices: FeeInvoiceProvider;
  /** SPEC §29.1: the providers of the payments table (stripe only when keys are configured; demo always, in-process). */
  payments: { stripe: PaymentProvider | null; demo: PaymentProvider };
  /** SPEC §29.2: the Számla Agent client (only with INVOICE_MODE=szamlazzhu). */
  szamlazz: SzamlazzClient | null;
  verifyIdToken: IdTokenVerifier;
  navClient: NavClientFactory;
  sessionCache: SessionCache;
  dispatcher: { kick(): void; flush(): Promise<void> };
  fetch: typeof fetch;
  /** SPEC §31.1: the own statistics server (internal address); null = not configured (the tab shows only DB numbers). */
  umami: UmamiClient | null;
}

export type DepsOverrides = Partial<Omit<Deps, 'cfg' | 'db'>> & { dispatchInline?: boolean };

export function buildDeps(cfg: Config, db: Db, o: DepsOverrides = {}): Deps {
  const now = o.now ?? (() => new Date());
  const f = o.fetch ?? fetch;
  // eslint-disable-next-line prefer-const
  let deps: Deps;
  const dispatcher = o.dispatcher ?? createDispatcher(() => deps, o.dispatchInline !== false && !cfg.isTest);
  deps = {
    cfg,
    db,
    now,
    limiter: o.limiter ?? new RateLimiter(() => now().getTime()),
    data: o.data ?? new FieldCipher(cfg.appDataKey),
    navKey: o.navKey ?? new FieldCipher(cfg.navCredKey),
    lookupKey: o.lookupKey ?? subKey(cfg.appDataKey, 'kezjegy/adoazonosito-lookup'),
    storage: o.storage ?? new FileStorage(cfg),
    mailer: o.mailer ?? createMailer(cfg, db),
    push: o.push ?? createPush(cfg, f),
    content: o.content ?? new ContentStore(db, now),
    legal: o.legal ?? new LegalStore(cfg.legalDir),
    simplepay:
      o.simplepay !== undefined
        ? o.simplepay
        : cfg.simplepay.mode === 'sandbox' || cfg.simplepay.mode === 'live'
          ? createSimplePayApi({ baseUrl: cfg.simplepay.baseUrl, merchant: cfg.simplepay.merchant, secret: cfg.simplepay.secret, fetch: f })
          : null,
    invoices: o.invoices ?? createFeeInvoiceProvider(cfg),
    payments: o.payments ?? { stripe: cfg.payment.stripe ? createStripeProvider({ cfg: cfg.payment.stripe }) : null, demo: createDemoProvider({ apiPublicUrl: cfg.apiPublicUrl, now }) },
    szamlazz: o.szamlazz !== undefined ? o.szamlazz : cfg.invoice.mode === 'szamlazzhu' ? createSzamlazzClient({ url: cfg.invoice.szamlazzhuUrl, fetch: f }) : null,
    verifyIdToken: o.verifyIdToken ?? createIdTokenVerifier({ google: cfg.google.clientIds, apple: cfg.appleBundleId }),
    navClient: o.navClient ?? createNavFactory(cfg, now),
    sessionCache: o.sessionCache ?? new SessionCache(now),
    dispatcher,
    fetch: f,
    umami: o.umami !== undefined ? o.umami : cfg.umami ? createUmamiClient(cfg.umami, f, now) : null,
  };
  return deps;
}
