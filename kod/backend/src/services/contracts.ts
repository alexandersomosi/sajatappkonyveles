// Client-specific legal PDFs (SPEC §10.2, §21): megbízási szerződés and NAV meghatalmazás,
// filled with the client's and the accountant's data and typeset with Geist.
import { eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { accountants, clients, consents, users } from '../db/schema.js';
import { fillLegal, legalValuesFromConfig } from '../legal.js';
import { sha256Hex } from '../lib/crypto.js';
import type { LegalDocType } from '../_shared/enums.js';
import { markdownToPdf } from '../lib/pdf.js';
import { huFullDate, todayBudapest } from '../lib/dates.js';
import { createDocumentFromBuffer } from './system-docs.js';
import brand from '../_shared/brand.json' with { type: 'json' };
import { log, safeErr } from '../log.js';

export async function legalValuesForClient(deps: Deps, clientId: string): Promise<Record<string, string>> {
  const [cl] = await deps.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return {};
  const [acc] = cl.accountantId ? await deps.db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const [u] = await deps.db.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1);
  const today = todayBudapest(deps.now());
  // A client PDF must never show a raw "{{…}}" marker: a missing value reads as "– (a könyvelő pótolja)".
  const HIANY = '– (a könyvelő pótolja)';
  const vagy = (x: string | null | undefined) => (x && x.trim() ? x.trim() : HIANY);
  const cityLine = [cl.addressZip, cl.addressCity].filter(Boolean).join(' ');
  const v: Record<string, string> = {
    ...legalValuesFromConfig(deps.cfg, deps.now()),
    'ugyfel.nev': `${cl.lastName} ${cl.firstName}`.trim(),
    'ugyfel.szuletesi_nev': cl.birthName ?? `${cl.lastName} ${cl.firstName}`.trim(),
    'ugyfel.lakcim': vagy([cityLine, cl.addressLine].filter(Boolean).join(', ')),
    'ugyfel.adoszam': vagy(cl.adoszam),
    'ugyfel.ev_nyilvantartasi_szam': vagy(cl.evNyilvantartasiSzam),
    'ugyfel.adoazonosito_jel': cl.adoazonositoJelEnc ? deps.data.dec(cl.adoazonositoJelEnc, 'clients.adoazonosito_jel') : HIANY,
    'ugyfel.email': vagy(u?.email),
    'szerzodes.kezdete': huFullDate(todayBudapest(cl.createdAt)),
    'konyvelo.nev': acc?.displayName ?? 'a kijelölt könyvelő (a neve az appban látszik)',
    'konyvelo.nyilvantartasi_szam': vagy(acc?.registrationNumber),
    'konyvelo.adoazonosito_jel': HIANY,
  };
  if (acc?.adoazonositoJelEnc) v['konyvelo.adoazonosito_jel'] = deps.data.dec(acc.adoazonositoJelEnc, 'accountants.adoazonosito_jel');
  return v;
}

export async function clientLegalPdf(deps: Deps, clientId: string, docType: 'megbizasi_szerzodes' | 'nav_meghatalmazas'): Promise<Buffer> {
  const d = deps.legal.current(docType);
  let md = d.markdown;
  if (docType === 'nav_meghatalmazas') {
    const tpl = await deps.legal.template('nav_meghatalmazas_okirat.md');
    if (tpl) md = tpl;
  }
  const values = { ...(await legalValuesForClient(deps, clientId)), 'dok.verzio': d.version, 'dok.hatalyos': d.effectiveFrom ?? d.version };
  return markdownToPdf(deps.cfg.fontDir, d.title, fillLegal(md, values));
}

/**
 * After the 3 consents: store the accepted contract PDF in the dossier (`szerzodes_alairt`) and e-mail it to the
 * client (the contract step promises both; round 1, 2026-11-19). A mail problem never undoes the acceptance.
 */
export async function storeSignedContract(deps: Deps, clientId: string, userId: string): Promise<void> {
  const d = deps.legal.current('megbizasi_szerzodes');
  const [con] = await deps.db.select().from(consents).where(eq(consents.userId, userId)).limit(1);
  const pdf = await clientLegalPdf(deps, clientId, 'megbizasi_szerzodes');
  const month = todayBudapest(con?.acceptedAt ?? deps.now()).slice(0, 7);
  await createDocumentFromBuffer(deps, deps.db, {
    clientId,
    category: 'szerzodes_alairt',
    title: `Megbízási szerződés (${huFullDate(todayBudapest(con?.acceptedAt ?? deps.now()))})`,
    month,
    data: pdf,
    mime: 'application/pdf',
    fileName: 'megbizasi_szerzodes.pdf',
    source: 'rendszer',
    status: 'feldolgozva',
    by: null,
  });
  void d;
  try {
    const [row] = await deps.db.select({ email: users.email, firstName: clients.firstName }).from(clients).innerJoin(users, eq(users.id, clients.userId)).where(eq(clients.id, clientId)).limit(1);
    if (row && deps.mailer.mode !== 'disabled') {
      const params = { brand: brand.name, firstName: row.firstName, link: `${deps.cfg.appPublicUrl}/dosszie?honap=${month}` };
      await deps.mailer.send({
        to: row.email,
        subject: await deps.content.render('email.contract_accepted.subject', params),
        text: await deps.content.render('email.contract_accepted.body', params),
        template: 'contract_accepted',
        attachments: [{ filename: 'megbizasi_szerzodes.pdf', content: pdf, contentType: 'application/pdf' }],
      });
    }
  } catch (err) {
    log().warn({ err: safeErr(err) }, 'contract mail failed');
  }
}

/** The exact text a user accepts: the current version, filled with brand/company data and – for a client – their own data. */
export async function filledLegalText(deps: Deps, docType: LegalDocType, clientId: string | null): Promise<{ version: string; text: string; sha256: string }> {
  const d = deps.legal.current(docType);
  const values = clientId
    ? await legalValuesForClient(deps, clientId)
    : legalValuesFromConfig(deps.cfg, deps.now());
  const text = fillLegal(d.markdown, { ...values, 'dok.verzio': d.version, 'dok.hatalyos': d.effectiveFrom ?? d.version });
  return { version: d.version, text, sha256: sha256Hex(text) };
}
