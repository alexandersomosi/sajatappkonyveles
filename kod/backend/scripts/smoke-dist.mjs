// Smoke test of the COMPILED output (ESM resolution, JSON imports) against PGlite.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const k = (b) => Buffer.alloc(32, b).toString('base64');
Object.assign(process.env, {
  APP_ENV: 'demo', NODE_ENV: 'production', LOG_LEVEL: 'warn',
  JWT_SECRET: k(1), CODE_HMAC_SECRET: k(2), FILE_LINK_SECRET: k(3), AUDIT_IP_SALT: k(4),
  FILE_ENC_KEY: k(5), APP_DATA_KEY: k(6), NAV_CRED_KEY: k(7), SIMPLEPAY_DEMO_SECRET: 'smoke-demo-secret-0123456789',
  FILES_DIR: mkdtempSync(join(tmpdir(), 'kj-smoke-')), LEGAL_DIR: '../jogi', FONT_DIR: './fonts',
});
const { loadConfig } = await import('../dist/config.js');
const { openPglite } = await import('../dist/db/client.js');
const { buildDeps } = await import('../dist/deps.js');
const { createApp } = await import('../dist/app.js');
const { makeClock, seedDemo } = await import('../dist/seed/demo.js');
const { jobDefs, runIfDue } = await import('../dist/jobs.js');
const cfg = loadConfig();
const h = await openPglite();
await h.migrate();
const clock = makeClock();
const deps = buildDeps(cfg, h.db, { now: clock.now, dispatchInline: false });
await deps.legal.load(h.db);
const app = createApp(deps);
const health = await app.request('/api/v1/health');
console.log('health', health.status, JSON.stringify(await health.json()));
const conf = await app.request('/api/v1/config');
console.log('config', conf.status, (await conf.json()).brand.name);
const t0 = Date.now();
console.log('seed', await seedDemo(deps, clock, { credentialsFile: join(cfg.filesDir, 'cred.txt') }), `${Date.now() - t0} ms`);
for (const j of jobDefs(deps)) if (['every5', 'hourly'].includes(j.name)) console.log('job', j.name, await runIfDue(deps, j));
const legal = await app.request('/api/v1/legal/aszf');
const lj = await legal.json();
console.log('legal', legal.status, lj.version, lj.markdown.slice(0, 60).replace(/\n/g, ' '));
// SPEC §26: data step + idempotent demo addition through the compiled code (second run must say 'exists').
const { runDataStepTulaj1118 } = await import('../dist/services/datastep.js');
const { seedTulaj1118 } = await import('../dist/seed/tulaj1118.js');
console.log('data step', JSON.stringify(await runDataStepTulaj1118(deps)));
const cred = join(cfg.filesDir, 'cred.txt');
console.log('tulaj1118', (await seedTulaj1118(deps, { credentialsFile: cred })).status, (await seedTulaj1118(deps, { credentialsFile: cred })).status);
for (const j of jobDefs(deps)) if (['registration_reminders', 'staff_digest'].includes(j.name)) console.log('job', j.name, await runIfDue(deps, j));
// SPEC §27: data step + the 11-19 demo addition + the two new jobs through the compiled code.
const { runDataStepTulaj1119 } = await import('../dist/services/datastep.js');
const { seedTulaj1119 } = await import('../dist/seed/tulaj1119.js');
console.log('data step 1119', JSON.stringify(await runDataStepTulaj1119(deps)));
console.log('tulaj1119', (await seedTulaj1119(deps, { credentialsFile: cred })).status, (await seedTulaj1119(deps, { credentialsFile: cred })).status);
for (const j of jobDefs(deps)) if (['assist_approvals', 'kamara_reminders'].includes(j.name)) console.log('job', j.name, await runIfDue(deps, j));
await h.close();
