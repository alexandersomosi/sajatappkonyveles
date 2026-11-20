// SPEC §29.17 (B2 part of seed:k29): demo data of the new features – FAKE data only, idempotent, refuses
// APP_ENV=production, never touches alex@, tulaj@, bence.kovacs@ or david@ (only reads Bence as the accountant).
//   Szabó Kata: jövedelemigazolás 2025 'kesz' with a DEMO PDF ("DEMO – nem NAV-irat"), a KOMA request 'beerkezett',
//               an approved income statement (Jan → this month) and a calendar feed;
//   Varga Réka: adóigazolás 'navnal'; Németh Péter: 1 free month (price override);
//   Fodor Márk (new): terminated 'rendes', effective in 20 days, with the termination letter.
// Passwords only appended to the credentials file, never printed.
import { and, eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import type { Deps } from '../deps.js';
import { certificateEvents, certificateRequests, clientPriceOverrides, clients, requests, systemState, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, budapestLocalToUtc, todayBudapest } from '../lib/dates.js';
import { randomToken } from '../lib/crypto.js';
import { markdownToPdf } from '../lib/pdf.js';
import { createDocumentFromBuffer } from '../services/system-docs.js';
import { statementData } from '../services/kimutatas.js';
import { tokenHash } from '../services/naptar.js';
import { DOMAIN, demoClient, exists, runSeedMain, seedContext, writeCredentials, type SeedResult } from './ot1119.js';
import { calendarFeeds, incomeStatementApprovals } from '../db/schema.js';

export const SEED_KEY_K29F = 'seed.k29f';

async function clientByEmail(deps: Deps, local: string) {
  const [r] = await deps.db.select({ c: clients }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(users.email, `${local}@${DOMAIN}`)).limit(1);
  return r?.c ?? null;
}

async function cert(
  deps: Deps,
  clientId: string,
  o: { type: string; title: string; status: 'beerkezett' | 'navnal' | 'kesz'; year?: number; purposeKind: string; purpose: string; userName?: string | null; createdAt: Date; navAt?: Date; doneAt?: Date; documentId?: string | null; by: string; extended?: string | null },
) {
  const reqStatus = o.status === 'kesz' ? 'teljesitve' : o.status === 'navnal' ? 'folyamatban' : 'nyitott';
  const [rq] = await deps.db
    .insert(requests)
    .values({ clientId, direction: 'ugyfeltol', type: 'igazolas', title: o.title, body: `Mire kell: ${o.purpose}`, status: reqStatus, resultDocumentId: o.documentId ?? null, createdAt: o.createdAt, updatedAt: o.doneAt ?? o.navAt ?? o.createdAt, ...(o.doneAt ? { completedAt: o.doneAt, completedBy: o.by } : {}) })
    .returning();
  await deps.db.insert(certificateRequests).values({
    requestId: rq!.id,
    certificateType: o.type as never,
    year: o.year ?? null,
    purpose: o.purpose,
    language: 'hu',
    status: o.status,
    userName: o.userName ?? null,
    purposeKind: o.purposeKind,
    extended: o.extended ?? null,
    submittedToNavAt: o.navAt ?? null,
    iktatoszam: o.navAt ? 'DEMO-IK-2026-1188' : null,
    documentId: o.documentId ?? null,
    doneAt: o.doneAt ?? null,
    createdAt: o.createdAt,
  });
  await deps.db.insert(certificateEvents).values({ requestId: rq!.id, status: 'beerkezett', at: o.createdAt, by: null });
  if (o.navAt) await deps.db.insert(certificateEvents).values({ requestId: rq!.id, status: 'navnal', at: o.navAt, by: o.by, note: 'DEMO-IK-2026-1188' });
  if (o.doneAt) await deps.db.insert(certificateEvents).values({ requestId: rq!.id, status: 'kesz', at: o.doneAt, by: o.by });
  return rq!.id;
}

export async function seedK29f(deps: Deps, o: { credentialsFile: string }): Promise<SeedResult> {
  const [marker] = await deps.db.select().from(systemState).where(eq(systemState.key, SEED_KEY_K29F)).limit(1);
  if (marker) return { status: 'exists', created: [] };
  const ctx = await seedContext(deps);
  const created: string[] = [];
  const today = todayBudapest(ctx.now);
  const kata = await clientByEmail(deps, 'kata.szabo');
  const reka = await clientByEmail(deps, 'reka.varga');
  const peter = await clientByEmail(deps, 'peter.nemeth');
  if (kata) {
    const pdf = await markdownToPdf(deps.cfg.fontDir, 'Jövedelemigazolás 2025', '# Jövedelemigazolás – 2025\n\n**DEMO – nem NAV-irat.** Kitalált bemutató adat, a valódi igazolást a NAV adja ki.\n\nAdózó: Szabó Kata (kitalált)\n\nÁtalányadózó egyéni vállalkozó, 2025. adóév.', { banner: 'DEMO – NEM NAV-IRAT' });
    const docId = await createDocumentFromBuffer(deps, deps.db, { clientId: kata.id, category: 'igazolas', title: 'Jövedelemigazolás 2025 (DEMO)', month: today.slice(0, 7), data: pdf, mime: 'application/pdf', fileName: 'jovedelemigazolas_2025_DEMO.pdf', source: 'konyvelo', status: 'feldolgozva', by: ctx.bence.userId, visibility: 'kozos' } as Parameters<typeof createDocumentFromBuffer>[2]);
    await cert(deps, kata.id, { type: 'jovedelemigazolas', title: 'Jövedelemigazolás 2025', status: 'kesz', year: 2025, purposeKind: 'bank', purpose: 'Bank, hitel', userName: 'Minta Bank Zrt.', createdAt: ctx.at(24 * 6), navAt: ctx.at(24 * 5), doneAt: ctx.at(24 * 2), documentId: docId, by: ctx.bence.userId });
    await cert(deps, kata.id, { type: 'koma', title: 'Köztartozásmentes adatbázis (KOMA)', status: 'beerkezett', purposeKind: 'palyazat', purpose: 'Pályázat, támogatás', createdAt: ctx.at(5), by: ctx.bence.userId });
    // the approved income statement of this year (the stamp shows while the data stay the same)
    const from = `${today.slice(0, 4)}-01`;
    const to = today.slice(0, 7);
    const d = await statementData(deps.db, kata.id, from, to);
    await deps.db.insert(incomeStatementApprovals).values({ clientId: kata.id, fromMonth: from, toMonth: to, dataSha256: d.hash, approvedBy: ctx.bence.userId, approvedAt: ctx.at(20) }).onConflictDoNothing();
    // a calendar feed (the token itself is never printed or stored in plain text)
    const token = randomToken(32);
    await deps.db.insert(calendarFeeds).values({ clientId: kata.id, tokenHash: tokenHash(token), tokenEnc: deps.data.enc(token, 'calendar_feeds.token'), createdAt: ctx.at(48) }).onConflictDoNothing();
    created.push('kata: igazolások + kimutatás + naptár');
  }
  if (reka) {
    await cert(deps, reka.id, { type: 'adoigazolas', title: 'Adóigazolás (nincs tartozásod)', status: 'navnal', purposeKind: 'szechenyi', purpose: 'Széchenyi Kártya', userName: 'KAVOSZ Zrt.', extended: 'igen', createdAt: ctx.at(24 * 3), navAt: ctx.at(24 * 2), by: ctx.bence.userId });
    created.push('reka: adóigazolás NAV-nál');
  }
  if (peter) {
    const [has] = await deps.db.select({ id: clientPriceOverrides.id }).from(clientPriceOverrides).where(eq(clientPriceOverrides.clientId, peter.id)).limit(1);
    if (!has) await deps.db.insert(clientPriceOverrides).values({ clientId: peter.id, kind: 'ingyenes_honap', months: 1, fromPeriod: addDays(today, 1), reason: 'DEMO: bemutató kedvezmény', createdBy: ctx.bence.userId, createdAt: ctx.now });
    created.push('peter: 1 ingyenes hónap');
  }
  if (!(await exists(deps, `mark.fodor@${DOMAIN}`))) {
    const fm = await demoClient(ctx, { email: `mark.fodor@${DOMAIN}`, first: 'Márk', last: 'Fodor', idSeed: 93, login: true });
    const effectiveOn = addDays(today, 20);
    await deps.db.update(clients).set({ terminated: { kind: 'rendes', subReason: null, reason: 'DEMO: üzleti döntés', noticeAt: ctx.at(24 * 10).toISOString(), effectiveOn, by: ctx.bence.userId, appliedAt: null } }).where(eq(clients.id, fm.id));
    const md = `# Felmondás\n\n**DEMO – kitalált levél.**\n\nKedves Márk!\n\nAz Általános Szerződési Feltételek 8.5. pontja alapján a köztünk lévő szerződést **30 napos felmondási idővel felmondjuk**. A szerződés **${effectiveOn}** napján szűnik meg. Addig minden szolgáltatás változatlanul jár.`;
    const pdf = await markdownToPdf(deps.cfg.fontDir, 'Felmondás', md, { banner: 'DEMO' });
    await createDocumentFromBuffer(deps, deps.db, { clientId: fm.id, category: 'szerzodes', title: 'Felmondás (DEMO)', month: today.slice(0, 7), data: pdf, mime: 'application/pdf', fileName: 'felmondas.pdf', source: 'rendszer', status: 'feldolgozva', by: null, visibility: 'kozos' } as Parameters<typeof createDocumentFromBuffer>[2]);
    await audit(deps.db, { action: 'admin.client.terminated', actorRole: 'system', targetType: 'client', targetId: fm.id, clientId: fm.id, details: { reason: 'DEMO seed', kind: 'rendes', effectiveOn } });
    created.push('fodor: felmondva (rendes)');
  }
  await writeCredentials(o.credentialsFile, ctx.lines);
  await deps.db.insert(systemState).values({ key: SEED_KEY_K29F, value: { at: ctx.now.toISOString(), created } }).onConflictDoNothing();
  return { status: 'seeded', created };
}

void and;
void budapestLocalToUtc;

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await runSeedMain('k29f', seedK29f);
