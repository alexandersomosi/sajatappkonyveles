// Worker process (SPEC §15): same image as the API, `node dist/worker.js`. Ticks every 30 s,
// runs due jobs under advisory locks, writes a heartbeat. Waits for the API's migrations.
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError, loadConfig } from './config.js';
import { MIGRATIONS_DIR, openPg } from './db/client.js';
import { buildDeps } from './deps.js';
import { heartbeat, jobDefs, runIfDue } from './jobs.js';
import { createLogger, log, setLogger, safeErr } from './log.js';
import { runDataFixKor1, runDataStepTulaj1118, runDataStepTulaj1119, runFaqSafetyFix } from './services/datastep.js';
import { runDataStepK28, runDataStepOt1119 } from './services/datastep-k28.js';
import { runDataStepK6c } from './services/datastep-k6c.js';
import { runDataStepK7b } from './services/datastep-k7b.js';
import { runDataStepK29 } from './services/dijak.js';
import { runDataStepKataF1 } from './services/datastep-kata.js';

async function migrationsReady(db: ReturnType<typeof buildDeps>['db']): Promise<boolean> {
  try {
    const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
    const res = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    const n = (res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
    return n >= journal.entries.length;
  } catch {
    return false;
  }
}

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
  const deps = buildDeps(cfg, handle.db, { dispatchInline: false });
  for (let i = 0; !(await migrationsReady(handle.db)); i++) {
    if (i === 0) log().info('waiting for migrations (the API applies them)');
    if (i > 150) throw new Error('migrations not applied after 5 minutes');
    await new Promise((r) => setTimeout(r, 2000));
  }
  await deps.legal.load(null);
  await deps.content.reload();
  // SPEC §26.9.3: one-time, idempotent data step (business_status, legacy appointments → callbacks, new FAQ items).
  try {
    await runDataStepTulaj1118(deps);
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step tulaj1118 failed');
  }
  // One-time FAQ answer fix (only if the row still has the old default text; an admin edit is never touched).
  try {
    await runFaqSafetyFix(deps);
  } catch (err) {
    log().error({ err: safeErr(err) }, 'faq text fix failed');
  }
  // Round 1 (2026-11-19): one-time data fixes (notification links, missing attribution rows, three demo texts, one FAQ answer).
  try {
    await runDataFixKor1(deps);
  } catch (err) {
    log().error({ err: safeErr(err) }, 'round-1 data fixes failed');
  }
  // SPEC §27.7.3: one-time data step of the owner orders of 11-19 (legacy assisted meghatalmazás, FAQ, old content texts).
  try {
    await runDataStepTulaj1119(deps);
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step tulaj1119 failed');
  }
  // SPEC §28.7.2 / §28.K.16: one-time data steps of the five features and the evening orders (idempotent).
  try {
    await runDataStepOt1119(deps);
    await runDataStepK28(deps);
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step ot1119/k28 failed');
  }
  // Round 2 of 11-19 (k6c): pauses → tax-profile breaks (once); demo invoice notifications re-rendered from the reserves.
  try {
    const r = await runDataStepK6c(deps);
    log().info(r, 'data step k6c');
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step k6c failed');
  }
  // SPEC §29.4.1 / §29.12 (B1): data.k29 – fee settings of the new kinds, the owner's real prices confirmed, provider backfill.
  try {
    const r = await runDataStepK29(deps);
    log().info(r, 'data step k29');
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step k29 failed');
  }
  // k7b (11-20): changed default texts in unedited overrides; the message_new e-mail default on (once).
  try {
    const r = await runDataStepK7b(deps);
    log().info(r, 'data step k7b');
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step k7b failed');
  }
  // SPEC §32 (éves ciklus és KATA, F0 + F1a): KATA variant, hidden KATA-year quarters, KATA month rows, item adónem (once).
  try {
    const r = await runDataStepKataF1(deps);
    log().info(r, 'data step kata_f1');
  } catch (err) {
    log().error({ err: safeErr(err) }, 'data step kata_f1 failed');
  }
  const jobs = jobDefs(deps);
  log().info({ jobs: jobs.map((j) => j.name) }, 'kezjegy worker started');
  let stopping = false;
  let busy = false;
  const tick = async () => {
    if (busy || stopping) return;
    busy = true;
    try {
      await heartbeat(deps);
      for (const j of jobs) {
        if (stopping) break;
        await runIfDue(deps, j);
      }
    } catch (err) {
      log().error({ err: safeErr(err) }, 'worker tick failed');
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 30_000);
  void tick();
  const stop = async () => {
    stopping = true;
    clearInterval(timer);
    for (let i = 0; busy && i < 120; i++) await new Promise((r) => setTimeout(r, 500));
    await handle.close().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
}

main().catch((err) => {
  log().fatal({ err: safeErr(err) }, 'worker failed');
  process.exit(1);
});
