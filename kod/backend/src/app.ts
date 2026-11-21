// The Hono application: /api/v1 routes, request context, errors (SPEC §3.5, §12).
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Deps } from './deps.js';
import { errorHandler, requestContext, type Env } from './http/core.js';
import { E } from './lib/errors.js';
import { createHash } from 'node:crypto';
import { MAX_REQUEST_BYTES, MAX_SINGLE_FILE_REQUEST_BYTES, UPLOAD_DEADLINE_MS, withUploadSlot } from './files/upload.js';
import { verifyAccess } from './auth/tokens.js';
import { accRoutes } from './routes/acc.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/client.js';
import { fileRoutes } from './routes/files.js';
import { meRoutes } from './routes/me.js';
import { publicRoutes } from './routes/public.js';
import { paymentsPublicK29Routes } from './routes/payments-k29.js';
import { teamRoutes } from './routes/team.js';
import { naptarRoutes } from './routes/public-naptar.js';
import { publicMarketingRoutes } from './routes/public-marketing.js';

// Multipart upload routes – the only ones that may send up to 60 MB (Caddy mirrors this, kezjegy.caddy).
// Javító kör 11-21: + the annual filings (draft, filed-szja, filed-hipa), the önellenőrzés filing (two PDFs) and the
// folyószámla extract – they carry documents too.
export const UPLOAD_PATH = /^\/api\/v1\/(client\/(kyc|attachments|documents(\/[^/]+\/versions)?|business-registration\/filed)|acc\/(attachments|clients\/[^/]+\/documents|documents\/[^/]+\/versions|clients\/[^/]+\/annual\/[^/]+\/(draft|filed-szja|filed-hipa)|corrections\/[^/]+\/filed|clients\/[^/]+\/reconciliations)|team\/attachments)\/?$/;
/** One-file upload routes: 26 MB instead of 60 (Caddy mirrors this). */
export const SINGLE_FILE_PATH = /^\/api\/v1\/(client|acc|team)\/attachments\/?$/;
const KB = 1024;

/** Body size limit by route, checked while streaming (also for chunked bodies) before any handler reads. */
export function bodyLimitFor(path: string): number {
  if (SINGLE_FILE_PATH.test(path)) return MAX_SINGLE_FILE_REQUEST_BYTES;
  if (UPLOAD_PATH.test(path)) return MAX_REQUEST_BYTES;
  if (path === '/api/v1/webhooks/simplepay/ipn') return 64 * KB;
  // SPEC §29.1.8: Stripe events are small; 256 KB is plenty
  if (path === '/api/v1/webhooks/stripe') return 256 * KB;
  if (path === '/api/v1/auth/refresh') return 8 * KB;
  // SPEC §31.6: the banner decision is a few booleans
  if (path === '/api/v1/public/hozzajarulas') return 4 * KB;
  return 1024 * KB;
}

export function createApp(deps: Deps) {
  const app = new Hono<Env>();
  app.use('*', requestContext(deps));
  const limiters = new Map<number, MiddlewareHandler<Env>>();
  app.use('/api/*', (c, next) => {
    const max = bodyLimitFor(c.req.path);
    let m = limiters.get(max);
    if (!m) {
      m = bodyLimit({
        maxSize: max,
        onError: (cc) => cc.json(E.tooLarge(max === MAX_REQUEST_BYTES ? 'Túl nagy a kérés (legfeljebb 60 MB).' : max === MAX_SINGLE_FILE_REQUEST_BYTES ? 'Túl nagy a fájl (legfeljebb 25 MB).' : 'Túl nagy a kérés.').toJSON(), 413),
      });
      limiters.set(max, m);
    }
    return m(c, next);
  });
  // Upload routes: a few at a time, one per caller. The slot is taken BEFORE any handler reads the body, so a waiting
  // request holds no memory. SPEC §27.11 S5: the caller is the USER (a valid access token's subject), not the token –
  // one account with two sessions is one caller – and an upload that is not done within UPLOAD_DEADLINE_MS gets 408
  // and frees its slot (a sender that stalls after a few bytes no longer blocks everybody).
  app.use('/api/*', async (c, next) => {
    if (c.req.method !== 'POST' || !UPLOAD_PATH.test(c.req.path)) return next();
    const m = /^Bearer\s+(.+)$/i.exec(c.req.header('authorization') ?? '');
    const claims = m ? await verifyAccess(deps, m[1]!).catch(() => null) : null;
    const caller = claims ? `u:${claims.userId}` : `ip:${c.get('ipHmac')}`;
    await withUploadSlot(caller, () => next(), { deadlineMs: UPLOAD_DEADLINE_MS });
  });
  app.onError(errorHandler(deps));
  app.notFound((c) => c.json(E.notFound().toJSON(), 404));

  const api = new Hono<Env>();
  api.route('/', publicRoutes(deps));
  // SPEC §29.1 (B1): Stripe back URL, DEMO pay page, Stripe webhook
  api.route('/', paymentsPublicK29Routes(deps));
  // SPEC §31.6: /public/marketing-config, /public/hozzajarulas (ads switched off: { ads: false } / 404)
  api.route('/', publicMarketingRoutes(deps));
  api.route('/auth', authRoutes(deps));
  api.route('/me', meRoutes(deps));
  api.route('/client', clientRoutes(deps));
  api.route('/acc', accRoutes(deps));
  api.route('/admin', adminRoutes(deps));
  api.route('/team', teamRoutes(deps));
  api.route('/files', fileRoutes(deps));
  // SPEC §29.8 F4: the client's secret iCal feed (public, token in the path)
  api.route('/naptar', naptarRoutes(deps));
  app.route('/api/v1', api);
  return app;
}
