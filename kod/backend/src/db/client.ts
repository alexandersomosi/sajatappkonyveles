// Database handles: node-postgres in production, PGlite (in-process Postgres) in tests.
// Both are Drizzle PgDatabase instances with the same schema and snake_case casing.
import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';

export type Schema = typeof schema;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<PgQueryResultHKT, Schema> & { $client?: any };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

export interface DbHandle {
  db: Db;
  close(): Promise<void>;
  migrate(): Promise<void>;
  kind: 'pg' | 'pglite';
}

export async function openPg(url: string): Promise<DbHandle> {
  if (!url) throw new Error('DATABASE_URL hiányzik.');
  // Sessions use UTC (set as a startup parameter, not with a racing query on 'connect');
  // business dates are computed in Europe/Budapest in code.
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, application_name: 'kezjegy', options: '-c TimeZone=UTC' });
  const db = drizzlePg(pool, { schema, casing: 'snake_case' }) as unknown as Db;
  return {
    db,
    kind: 'pg',
    close: () => pool.end(),
    migrate: () => migratePg(drizzlePg(pool, { casing: 'snake_case' }), { migrationsFolder: MIGRATIONS_DIR }),
  };
}

/**
 * Applies the migrations. In production the API/worker connect as the least-privilege role (DATABASE_URL);
 * DDL needs the owner role, given as MIGRATION_DATABASE_URL (deploy/db-roles.sh). Without it, the handle's
 * own connection is used (tests, first deploy before the role switch).
 */
export async function runMigrations(handle: DbHandle, migrationUrl = process.env.MIGRATION_DATABASE_URL): Promise<void> {
  if (!migrationUrl) return handle.migrate();
  const owner = await openPg(migrationUrl);
  try {
    await owner.migrate();
  } finally {
    await owner.close();
  }
}

/** PGlite for tests (and local experiments). Imported lazily: it is a devDependency. */
export async function openPglite(dataDir?: string): Promise<DbHandle> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(dataDir);
  await client.exec("SET TIME ZONE 'UTC'");
  const db = drizzle(client, { schema, casing: 'snake_case' }) as unknown as Db;
  return {
    db,
    kind: 'pglite',
    close: () => client.close(),
    migrate: () => migrate(drizzle(client, { casing: 'snake_case' }), { migrationsFolder: MIGRATIONS_DIR }),
  };
}
