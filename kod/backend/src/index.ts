// API process: config → DB → migrations → legal texts → HTTP server on PORT (SPEC §3.1, §20.2).
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { openPg, runMigrations } from './db/client.js';
import { buildDeps } from './deps.js';
import { createLogger, log, setLogger, safeErr } from './log.js';
import { ensurePlan } from './services/subscription.js';
import { encryptLegacyPep } from './services/kyc.js';

async function main(): Promise<void> {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`Beállítási hiba: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
  setLogger(createLogger(cfg.logLevel));
  const handle = await openPg(cfg.databaseUrl);
  if (process.env.SKIP_MIGRATIONS !== '1') {
    await runMigrations(handle);
    log().info('migrations applied');
  }
  const deps = buildDeps(cfg, handle.db);
  await deps.legal.load(handle.db);
  await deps.content.reload();
  await ensurePlan(deps, handle.db);
  await encryptLegacyPep(deps, handle.db);
  const app = createApp(deps);
  const server = serve({ fetch: app.fetch, port: cfg.port, hostname: '0.0.0.0' }, (info) => {
    log().info({ port: info.port, appEnv: cfg.appEnv, modes: { nav: cfg.nav.mode, simplepay: cfg.simplepay.mode, mail: cfg.mail.mode, push: cfg.push.mode, invoice: cfg.invoice.mode } }, 'kezjegy api listening');
  });
  const stop = async (sig: string) => {
    log().info({ sig }, 'shutting down');
    server.close();
    await deps.dispatcher.flush().catch(() => undefined);
    await handle.close().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}

main().catch((err) => {
  log().fatal({ err: safeErr(err) }, 'api failed to start');
  process.exit(1);
});
