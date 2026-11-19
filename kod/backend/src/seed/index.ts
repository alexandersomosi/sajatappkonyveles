// `npm run seed` (node dist/seed/index.js [--force-demo]) – SPEC §19. Refuses APP_ENV=production
// unless --force-demo. Passwords go only to SEED_CREDENTIALS_FILE (mode 600); nothing is printed.
import { ConfigError, loadConfig } from '../config.js';
import { openPg, runMigrations } from '../db/client.js';
import { buildDeps } from '../deps.js';
import { createLogger, log, setLogger, safeErr } from '../log.js';
import { makeClock, rotateDemoPasswords, seedDemo } from './demo.js';

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
  // On the server the migrations ran already (kezjegy-migrate); the app role has no DDL rights.
  if (process.env.SKIP_MIGRATIONS !== '1') await runMigrations(handle);
  const clock = makeClock();
  const deps = buildDeps(cfg, handle.db, { now: clock.now, dispatchInline: false });
  if (process.argv.includes('--uj-jelszavak')) {
    const n = await rotateDemoPasswords(deps, { credentialsFile: cfg.seedCredentialsFile });
    console.log(`Új jelszó ${n} demó fióknak. Belépések: ${cfg.seedCredentialsFile}`);
    await handle.close();
    return;
  }
  const res = await seedDemo(deps, clock, { credentialsFile: cfg.seedCredentialsFile, force: process.argv.includes('--force-demo') });
  console.log(res === 'seeded' ? `Demó adatok betöltve. Belépések: ${cfg.seedCredentialsFile}` : 'A demó adatok már be vannak töltve, nem csináltam semmit.');
  await handle.close();
}

main().catch((err) => {
  log().fatal({ err: safeErr(err) }, 'seed failed');
  console.error(`Seed hiba: ${(err as Error).message}`);
  process.exit(1);
});
