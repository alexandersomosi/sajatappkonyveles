// One-shot migration runner (deploy: compose service kezjegy-migrate, profile "migrate", started by up.sh
// before the API). It is the ONLY process that gets the owner database URL: the API and the worker run as the
// least-privilege role with SKIP_MIGRATIONS=1 and never see MIGRATION_DATABASE_URL or POSTGRES_PASSWORD.
// Needs no app secrets. Prints no connection string.
import { openPg } from './client.js';

async function main(): Promise<void> {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Beállítási hiba: MIGRATION_DATABASE_URL (vagy DATABASE_URL) hiányzik.');
    process.exit(2);
  }
  const handle = await openPg(url);
  try {
    await handle.migrate();
    console.log('migrations applied');
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error(`Migráció hiba: ${(err as Error).message}`);
  process.exit(1);
});
