// /files – decrypted downloads with ownership checks (SPEC §4.2 "File download", §12.4).
// Bearer auth, or a 5-minute HMAC-signed link (?sig=&exp=) for <img> and downloads on the web.
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Deps } from '../deps.js';
import { clients, documents, documentVersions, files, gdprExports, kycRecords, messageAttachments, messages, sessions, teamMembers, users } from '../db/schema.js';
import { documentAlwaysOpen, lockReason } from '../services/access.js';
import { auditC } from '../audit.js';
import { requireAuth } from '../auth/middleware.js';
import { auth, param, type C, type Env } from '../http/core.js';
import { hmacHex, safeEqual } from '../lib/crypto.js';
import { E } from '../lib/errors.js';
import { accountantOfUser } from '../services/people.js';

type FileRow = typeof files.$inferSelect;

/** The link is bound to the session that asked for it: after logout (or any revocation) it stops working at once. */
function linkSig(deps: Deps, fileId: string, userId: string, exp: number, sessionId: string): string {
  return hmacHex(deps.cfg.fileLinkSecret, `${fileId}.${userId}.${exp}.${sessionId}`);
}

/**
 * Who may read a file:
 *  - the client who owns it, if the file is not accountant-only (KYC: client never gets it back);
 *  - the accountant assigned to the owner client;
 *  - admins: only system files they need (none of the client files), plus the client's own EV bejelentés PDF;
 *  - the service team (csapat, SPEC §26.4): the EV bejelentés PDF and attachments of onboarding threads.
 * Before activation a client cannot open dossier documents other than his own uploads and the contract-like
 * papers (SPEC §26.5.2: 403 locked_until_active).
 */
async function evBejelentesFile(deps: Deps, f: FileRow): Promise<boolean> {
  if (f.kind !== 'dokumentum') return false;
  const [v] = await deps.db
    .select({ id: documents.id })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(and(eq(documentVersions.fileId, f.id), eq(documents.category, 'ev_bejelentes'), isNull(documents.deletedAt)))
    .limit(1);
  return Boolean(v);
}

async function canRead(deps: Deps, userId: string, role: string, f: FileRow): Promise<boolean> {
  if (f.deletedAt) return false;
  if (!f.ownerClientId) return false;
  if (role === 'client') {
    const [cl] = await deps.db.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId)).limit(1);
    if (!cl || cl.id !== f.ownerClientId) return false;
    if (f.kind === 'kyc' || f.kind === 'nav_xml') return false;
    if (f.kind === 'dokumentum' || f.kind === 'thumb') {
      const [v] = await deps.db
        .select({ vis: documents.visibility, source: documents.source, category: documents.category })
        .from(documentVersions)
        .innerJoin(documents, eq(documents.id, documentVersions.documentId))
        .where(and(or(eq(documentVersions.fileId, f.id), eq(documentVersions.thumbFileId, f.id)), isNull(documents.deletedAt)))
        .limit(1);
      if (!v) return f.createdBy === userId; // e.g. uploaded meghatalmazás confirmation not yet attached
      if (v.vis !== 'kozos') return false;
      const [me] = await deps.db.select().from(clients).where(eq(clients.id, cl.id)).limit(1);
      if (me?.lifecycle === 'bekotes_alatt' && !documentAlwaysOpen(v)) throw E.locked('dosszie', await lockReason(deps, deps.db, me, 'dosszie'));
      return true;
    }
    if (f.kind === 'gdpr_export') {
      const [x] = await deps.db.select({ id: gdprExports.id }).from(gdprExports).where(and(eq(gdprExports.fileId, f.id), eq(gdprExports.userId, userId))).limit(1);
      return Boolean(x);
    }
    return true;
  }
  if (role === 'csapat') {
    const [tm] = await deps.db.select({ active: teamMembers.active }).from(teamMembers).where(eq(teamMembers.userId, userId)).limit(1);
    if (!tm?.active) return false;
    if (await evBejelentesFile(deps, f)) return true;
    if (f.kind === 'uzenet_csatolmany') {
      const [m] = await deps.db
        .select({ id: messageAttachments.messageId })
        .from(messageAttachments)
        .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
        .innerJoin(clients, eq(clients.id, messages.clientId))
        .where(and(eq(messageAttachments.fileId, f.id), eq(clients.lifecycle, 'bekotes_alatt')))
        .limit(1);
      return Boolean(m);
    }
    return false;
  }
  if (role === 'admin' && (await evBejelentesFile(deps, f))) return true;
  if (role === 'accountant' || role === 'admin') {
    const acc = await accountantOfUser(deps.db, userId).catch(() => null);
    if (!acc) return false;
    const [cl] = await deps.db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, f.ownerClientId), eq(clients.accountantId, acc.id))).limit(1);
    if (!cl) return false;
    return f.kind !== 'gdpr_export';
  }
  return false;
}

async function serve(deps: Deps, c: C, f: FileRow, userId: string, role: string) {
  const data = await deps.storage.read(f);
  if (f.kind === 'dokumentum' || f.kind === 'kyc' || f.kind === 'uzenet_csatolmany') {
    await auditC(c, deps.db, 'file.download', { actorUserId: userId, actorRole: role, targetType: 'file', targetId: f.id, clientId: f.ownerClientId, details: { kind: f.kind } });
  }
  if (f.kind === 'kyc') {
    const [k] = await deps.db.select({ id: kycRecords.id }).from(kycRecords).where(eq(kycRecords.clientId, f.ownerClientId!)).limit(1);
    if (k) await auditC(c, deps.db, 'kyc.viewed', { actorUserId: userId, actorRole: role, targetType: 'kyc_record', targetId: k.id, clientId: f.ownerClientId, details: { file: true } });
  }
  const inline = f.mime.startsWith('image/') || f.mime === 'application/pdf';
  const ascii = f.displayName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  c.header('Content-Type', f.mime);
  c.header('Content-Length', String(data.length));
  c.header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.displayName)}`);
  c.header('Cache-Control', 'private, no-store');
  c.header('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
  c.header('Cross-Origin-Resource-Policy', 'same-site');
  return c.body(new Uint8Array(data));
}

export function fileRoutes(deps: Deps) {
  const r = new Hono<Env>();
  const authed = requireAuth(deps, { roles: ['client', 'accountant', 'admin', 'csapat'] });

  r.post('/:id/link', authed, async (c) => {
    const a = auth(c);
    const [f] = await deps.db.select().from(files).where(eq(files.id, param(c, 'id'))).limit(1);
    if (!f || !(await canRead(deps, a.userId, a.role, f))) throw E.notFound();
    const exp = Math.floor(deps.now().getTime() / 1000) + 300;
    const sig = linkSig(deps, f.id, a.userId, exp, a.sessionId);
    return c.json({ url: `/api/v1/files/${f.id}?u=${a.userId}&s=${a.sessionId}&exp=${exp}&sig=${sig}`, expiresAt: new Date(exp * 1000).toISOString() });
  });

  r.get('/:id', async (c) => {
    const id = param(c, 'id');
    const sig = c.req.query('sig');
    let userId: string;
    let role: string;
    if (sig) {
      const exp = Number(c.req.query('exp'));
      const u = c.req.query('u') ?? '';
      if (!Number.isFinite(exp) || exp * 1000 < deps.now().getTime() || !/^[0-9a-f-]{36}$/.test(u)) throw E.notFound();
      const sid = c.req.query('s') ?? '';
      if (!/^[0-9a-f-]{36}$/.test(sid) || !safeEqual(sig, linkSig(deps, id, u, exp, sid))) throw E.notFound();
      const [usr] = await deps.db.select({ role: users.role, status: users.status, totpEnabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, u)).limit(1);
      if (!usr || usr.status !== 'active') throw E.notFound();
      // the session behind the link must still be alive (logout, password change, "kiléptetés" end it)
      const [ses] = await deps.db.select({ userId: sessions.userId, familyId: sessions.familyId, revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.id, sid)).limit(1);
      if (!ses || ses.userId !== u || ses.revokedAt) throw E.notFound();
      // refresh rotates the session row: the link lives while the sign-in (session family) has a live member
      const [live] = await deps.db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.familyId, ses.familyId), isNull(sessions.revokedAt), isNull(sessions.rotatedAt), gt(sessions.expiresAt, deps.now())))
        .limit(1);
      if (!live) throw E.notFound();
      if (deps.cfg.staffTotpRequired && usr.role !== 'client' && !usr.totpEnabledAt) throw E.notFound();
      userId = u;
      role = usr.role;
    } else {
      await authed(c, async () => undefined);
      const a = auth(c);
      userId = a.userId;
      role = a.role;
    }
    const [f] = await deps.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!f || !(await canRead(deps, userId, role, f))) throw E.notFound();
    return serve(deps, c, f, userId, role);
  });

  return r;
}
