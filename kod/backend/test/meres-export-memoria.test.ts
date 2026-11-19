// Measurement (round 1, 2026-11-19): the GDPR export of ~120 MB of files must not hold the files in memory.
// Before the fix the build took ≈ 5× the data in RSS (+1.44 GB for 288 MB); now the ZIP is written entry by entry.
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gdprExports, messageAttachments, messages } from '../src/db/schema.js';
import { runGdprExports } from '../src/services/gdpr.js';
import { newClient, setup, type Harness } from './helpers.js';

let h: Harness;
beforeAll(async () => {
  h = await setup();
});
afterAll(async () => {
  await h.close();
});

describe('GDPR export memory', () => {
  it('120 MB of attachments: the build adds far less memory than the data, and the download streams', async () => {
    const c = await newClient(h, 'nagy-export@demo.kezjegy.test', { active: true });
    const FILES = 24;
    const SIZE = 5 * 1024 * 1024;
    const [m] = await h.deps.db.insert(messages).values({ clientId: c.clientId, senderUserId: c.userId, senderRole: 'client', kind: 'szoveg', body: 'nagy csatolmányok' }).returning();
    for (let i = 0; i < FILES; i++) {
      const data = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(SIZE)]);
      const f = await h.deps.storage.put(h.deps.db, { ownerClientId: c.clientId, kind: 'uzenet_csatolmany', mime: 'image/jpeg', displayName: `foto_${i}.jpg`, data, now: h.clock.now() });
      await h.deps.db.insert(messageAttachments).values({ messageId: m!.id, fileId: f.id, displayName: f.displayName });
    }
    const req = await h.json('POST', '/me/export', { token: c.token });
    expect(req.status).toBe(202);
    (globalThis as { gc?: () => void }).gc?.();
    const before = process.memoryUsage();
    let peak = 0;
    const timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 5);
    await runGdprExports(h.deps);
    clearInterval(timer);
    const [x] = await h.deps.db.select().from(gdprExports).where(eq(gdprExports.id, req.body.exportId));
    expect(x!.status).toBe('kesz');
    const grewMb = Math.round((Math.max(peak, process.memoryUsage().rss) - before.rss) / 1048576);
    // eslint-disable-next-line no-console
    console.log(`export of ${(FILES * SIZE) / 1048576} MB: RSS grew by ${grewMb} MB (before the fix ≈ 5× the data)`);
    expect(grewMb).toBeLessThan(110);
    const dl = await h.req('GET', `/me/exports/${req.body.exportId}/download`, { token: c.token });
    expect(dl.status).toBe(200);
    let bytes = 0;
    const reader = dl.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
    }
    expect(bytes).toBeGreaterThan(FILES * SIZE);
    expect(bytes).toBe(Number(dl.headers.get('content-length')));
  }, 120_000);
});
