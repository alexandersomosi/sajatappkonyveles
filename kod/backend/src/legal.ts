// Legal documents (SPEC §5.1 legal_documents, §21): loaded from LEGAL_DIR/index.json at start
// (upsert by docType+version); Markdown with {{placeholders}}. If kod/jogi is not ready, every
// doc type gets a clearly marked placeholder ("TERVEZET – jogász ellenőrzi").
import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { and, eq } from 'drizzle-orm';
import brand from './_shared/brand.json' with { type: 'json' };
import { LEGAL_DOC_TYPES, type LegalDocType } from './_shared/enums.js';
import type { Db } from './db/client.js';
import { legalDocuments } from './db/schema.js';
import { sha256Hex } from './lib/crypto.js';
import { log, safeErr } from './log.js';
import type { Config } from './config.js';
import { huFullDate, huFullDateIg, todayBudapest } from './lib/dates.js';

export interface LegalDoc {
  docType: LegalDocType;
  version: string;
  title: string;
  markdown: string;
  requiresReconsent: boolean;
  effectiveFrom: string | null;
}

const TITLES: Record<LegalDocType, string> = {
  aszf: 'Általános Szerződési Feltételek',
  adatkezeles: 'Adatkezelési tájékoztató',
  megbizasi_szerzodes: 'Megbízási szerződés',
  nav_meghatalmazas: 'NAV-meghatalmazás',
  adatfeldolgozoi: 'Adatfeldolgozói szerződés',
  pmt_nyilatkozatok: 'Pénzmosás elleni nyilatkozatok',
  simplepay_adattovabbitas: 'Adattovábbítási nyilatkozat (SimplePay)',
  simplepay_ismetlodo: 'Ismétlődő bankkártyás fizetés nyilatkozat',
  app_szovegek: 'Szövegek az appban',
  // SPEC §29.1.3 (jogi/kartyas_fizetes.md, B3)
  kartyas_fizetes: 'Kártyás fizetés – engedély',
  // SPEC §31.7 (jogi/suti.md): sütik és hasonló technológiák
  suti: 'Süti-tájékoztató',
};

/** The documents a client must accept in the `szerzodes` onboarding step. */
export const CONTRACT_DOCS: LegalDocType[] = ['aszf', 'adatkezeles', 'megbizasi_szerzodes'];
export const SIMPLEPAY_DOCS: LegalDocType[] = ['simplepay_adattovabbitas', 'simplepay_ismetlodo'];

/** Hungarian definite article for a word: "az" before a vowel sound (and 1 = egy, 5 = öt), else "a". */
export { huArticle } from './lib/nevelo.js';
import { huArticle } from './lib/nevelo.js';

/**
 * SPEC §27.10 / round-2 owner finding 12: the drafts carry notes for the owner, the lawyer and the accountant
 * ("[JOGI: …]", "[TULAJ/JOGI: …]", "[KÖNYVELŐ: …]", "[OWNER]"). They stay in the sources, but nothing a client sees or
 * receives (the accepted texts, the legal pages, the PDFs) shows them. [CÉGADAT …] and [HIÁNYZÓ …] markers stay.
 */
export const INTERNAL_NOTE_PATTERN = /[ \t]*(?:\*\*)?\[(?:JOGI|TULAJ|KÖNYVELŐ|ELLENŐRIZNI|OWNER)(?:\/(?:JOGI|TULAJ|KÖNYVELŐ|ELLENŐRIZNI|OWNER))*(?::[^\]\n]*)?\](?:\*\*)?/gu;

/**
 * SPEC §27.10 / round-2 owner finding 12 = jogi belsoJegyzetekNelkul(): the notes for the owner, the lawyer and the
 * accountant ("[JOGI: …]", "[TULAJ/JOGI: …]", "**[KÖNYVELŐ]**", "[ELLENŐRIZNI: …]") stay in the sources but never
 * reach a client; a line that becomes empty (or an empty list item) goes; 3+ newlines collapse. [CÉGADAT …],
 * [SIMPLEPAY …] and [HIÁNYZÓ …] mark missing values and stay.
 */
export function stripInternalNotes(md: string): string {
  const out: string[] = [];
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    INTERNAL_NOTE_PATTERN.lastIndex = 0;
    if (!INTERNAL_NOTE_PATTERN.test(line)) {
      out.push(line);
      continue;
    }
    INTERNAL_NOTE_PATTERN.lastIndex = 0;
    const clean = line.replace(INTERNAL_NOTE_PATTERN, '').replace(/[ \t]+$/, '');
    if (/^\s*(?:[-*]|\d{1,3}\.)?\s*$/.test(clean)) continue;
    out.push(clean);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function fillLegal(md: string, values: Record<string, string | undefined | null>): string {
  // "a(z) {{brand.name}}" → "a Kézjegy" / "az info@…": the article follows the filled value.
  md = md.replace(/\b([Aa])\(z\)\s+\{\{\s*([a-z_.]+)\s*\}\}/g, (all, a: string, k: string) => {
    const v = values[k];
    if (v === undefined || v === null || v === '') return all;
    const art = huArticle(v);
    return `${a === 'A' ? art.charAt(0).toUpperCase() + art.slice(1) : art} ${v}`;
  });
  // A value that already ends in a period ("Kft.", "12.", "november 18.") swallows the template's own period after it.
  // A lower-case value ("a könyvelőd") at the start of a sentence, line or list item gets a capital letter.
  const filled = md.replace(/\{\{\s*([a-z_.]+)\s*\}\}(\.?)/g, (all, k: string, dot: string, offset: number, whole: string) => {
    let v = values[k];
    if (v === undefined || v === null || v === '') return all;
    const before = whole.slice(Math.max(0, offset - 12), offset);
    if ((offset === 0 || /(^|[.!?]\s+|\n[ \t]*(?:[-*][ \t]+|#+[ \t]+|\d+\.[ \t]+)?)$/.test(before)) && /^\p{Ll}/u.test(v))
      v = v.charAt(0).toUpperCase() + v.slice(1);
    return dot && /\.\s*$/.test(v) ? v : v + dot;
  });
  // Any "a(z) X" left (already-filled texts, placeholders like "[CÉGADAT: …]"): decide by the next word.
  return filled.replace(/(^|[^\p{L}])([Aa])\(z\)(\s+)([[(„"']*)([\p{L}\p{N}])/gu, (_all, pre: string, a: string, sp: string, open: string, first: string) => {
    const art = huArticle(first);
    return `${pre}${a === 'A' ? art.charAt(0).toUpperCase() + art.slice(1) : art}${sp}${open}${first}`;
  });
}

export interface LegalValueOpts {
  appPublicUrl: string;
  priceHuf: number;
  /** Display date for {{datum.ma}}, e.g. "2026. november 18." */
  today: string;
  /** SimplePay recurring parameters (SPEC §9.2): the declaration must name them. */
  recurringTimes?: number;
  tokenValidMonths?: number;
  now?: Date;
}

export function baseLegalValues(o: LegalValueOpts): Record<string, string> {
  const fmt = new Intl.NumberFormat('hu-HU').format(o.priceHuf);
  const v: Record<string, string> = {
    'brand.name': brand.name,
    'ceg.nev': brand.provider.legalName,
    'ceg.szekhely': brand.provider.seat,
    'ceg.adoszam': brand.provider.taxNumber,
    'ceg.cegjegyzekszam': brand.provider.registryNumber,
    'ceg.email': brand.provider.supportEmail,
    'ceg.kepviselo': (brand.provider as { representative?: string }).representative ?? '[CÉGADAT: ügyvezető neve]',
    'dij.havi_brutto': `${fmt} Ft`,
    'datum.ma': o.today,
    'szolgaltatas.url': o.appPublicUrl,
    // The SimplePay recurring declaration ("alkalmanként legfeljebb …, legfeljebb … alkalommal, meddig")
    // must show the same values the card registration uses (services/subscription.ts startSubscription).
    'elofizetes.max_osszeg': `${fmt} Ft`,
  };
  if (o.recurringTimes) v['elofizetes.alkalom'] = String(o.recurringTimes);
  if (o.tokenValidMonths) {
    v['elofizetes.honapok'] = String(o.tokenValidMonths);
    const until = new Date((o.now ?? new Date()).getTime());
    until.setUTCMonth(until.getUTCMonth() + o.tokenValidMonths);
    v['elofizetes.lejarat_ig'] = huFullDateIg(todayBudapest(until));
  }
  return v;
}

/**
 * k7c2: the legal values with the monthly fee the server really charges (fee_settings 'havidij' via planAmountHuf; the
 * env PLAN_PRICE_HUF is only the fallback) – the ÁSZF, the contract and the card consent never name another price.
 */
export async function legalValues(deps: { cfg: Config; db: Db; now: () => Date }): Promise<Record<string, string>> {
  const { planAmountHuf } = await import('./services/dijak.js');
  const price = await planAmountHuf(deps as never, deps.db, 'havi');
  return legalValuesFromConfig({ ...deps.cfg, planPriceHuf: price }, deps.now());
}

/** The values every filled legal text uses, from the running config. */
export function legalValuesFromConfig(cfg: Pick<Config, 'appPublicUrl' | 'planPriceHuf' | 'simplepay'>, now: Date): Record<string, string> {
  return baseLegalValues({
    appPublicUrl: cfg.appPublicUrl,
    priceHuf: cfg.planPriceHuf,
    today: huFullDate(todayBudapest(now)),
    recurringTimes: cfg.simplepay.recurringTimes,
    tokenValidMonths: cfg.simplepay.tokenValidMonths,
    now,
  });
}

/**
 * Generic wording for the public (not logged-in) view of a document: the client's and the
 * accountant's own data are only known in their filled PDF / consent text. A public text never
 * shows a raw "{{…}}" marker.
 */
export const PUBLIC_PLACEHOLDERS: Record<string, string> = {
  'ugyfel.nev': '(a neved)',
  'ugyfel.szuletesi_nev': '(a születési neved)',
  'ugyfel.lakcim': '(a lakcímed)',
  'ugyfel.adoazonosito_jel': '(az adóazonosító jeled)',
  'ugyfel.adoszam': '(az adószámod)',
  'ugyfel.ev_nyilvantartasi_szam': '(az egyéni vállalkozói nyilvántartási számod)',
  'ugyfel.email': '(az e-mail-címed)',
  'szerzodes.kezdete': 'az elfogadás napja',
  'konyvelo.nev': 'a könyvelőd',
  'konyvelo.keresztnev': 'a könyvelőd',
  'konyvelo.nyilvantartasi_szam': '(a könyvelőd nyilvántartási száma, a szerződésedben szerepel)',
  'konyvelo.adoazonosito_jel': '(a könyvelőd adóazonosító jele, az appban megkapod)',
  'konyvelo.adoszam': '(a könyvelő adószáma)',
  'konyvelo.cim': '(a könyvelő címe)',
  'dok.cim': 'dokumentum',
};

export function fillLegalPublic(md: string, values: Record<string, string>): string {
  // "{{konyvelo.nev}}, könyvelő" would read "a könyvelőd, könyvelő" – name the role instead.
  const md2 = md.replace(/\{\{\s*konyvelo\.nev\s*\}\},\s*könyvelő/g, 'a kijelölt könyvelőd (a neve az appban látszik)');
  return fillLegal(md2, { ...PUBLIC_PLACEHOLDERS, ...values }).replace(/\{\{\s*[a-z_.*]*\s*\}\}/g, '…');
}

export class LegalStore {
  private docs = new Map<LegalDocType, LegalDoc>();
  constructor(private readonly dir: string) {}

  async load(db: Db | null): Promise<void> {
    const loaded = new Map<LegalDocType, LegalDoc>();
    try {
      const root = resolve(this.dir);
      const index = JSON.parse(await readFile(join(root, 'index.json'), 'utf8')) as {
        docType: string;
        version: string;
        title: string;
        file: string;
        requiresReconsent?: boolean;
        effectiveFrom?: string;
      }[];
      for (const e of index) {
        if (!(LEGAL_DOC_TYPES as readonly string[]).includes(e.docType)) continue;
        const p = resolve(root, e.file);
        if (!p.startsWith(root + sep)) continue;
        let markdown: string;
        try {
          markdown = await readFile(p, 'utf8');
        } catch {
          log().warn({ docType: e.docType }, 'legal file missing');
          continue;
        }
        const doc: LegalDoc = {
          docType: e.docType as LegalDocType,
          version: String(e.version),
          title: e.title || TITLES[e.docType as LegalDocType],
          // the source hash below stays the hash of the file; what a CLIENT is served and accepts has no internal notes
          // (the internal adatfeldolgozói szerződés between the Kft. and the accountant keeps them, as in kod/jogi)
          markdown: e.docType === 'adatfeldolgozoi' ? markdown : stripInternalNotes(markdown),
          requiresReconsent: Boolean(e.requiresReconsent),
          effectiveFrom: e.effectiveFrom ?? null,
        };
        const prev = loaded.get(doc.docType);
        if (!prev || prev.version < doc.version) loaded.set(doc.docType, doc);
        if (db) {
          await db
            .insert(legalDocuments)
            .values({
              docType: doc.docType,
              version: doc.version,
              title: doc.title,
              sourcePath: e.file,
              sha256: sha256Hex(markdown),
              effectiveFrom: doc.effectiveFrom,
              requiresReconsent: doc.requiresReconsent,
            })
            .onConflictDoUpdate({
              target: [legalDocuments.docType, legalDocuments.version],
              set: { title: doc.title, sha256: sha256Hex(markdown), sourcePath: e.file, requiresReconsent: doc.requiresReconsent },
            });
        }
      }
    } catch (err) {
      log().warn({ err: safeErr(err) }, 'legal index not found – using placeholders');
    }
    for (const t of LEGAL_DOC_TYPES) {
      if (loaded.has(t)) continue;
      const doc: LegalDoc = {
        docType: t,
        version: '0000-00-00-tervezet',
        title: TITLES[t],
        markdown: `TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács.\n\n# ${TITLES[t]}\n\nEz a szöveg még készül. A végleges változatot a jogász jóváhagyása után tesszük közzé.\n`,
        requiresReconsent: false,
        effectiveFrom: null,
      };
      loaded.set(t, doc);
      if (db) {
        const [exists] = await db
          .select({ id: legalDocuments.id })
          .from(legalDocuments)
          .where(and(eq(legalDocuments.docType, t), eq(legalDocuments.version, doc.version)))
          .limit(1);
        if (!exists)
          await db.insert(legalDocuments).values({ docType: t, version: doc.version, title: doc.title, sourcePath: 'fallback', sha256: sha256Hex(doc.markdown), requiresReconsent: false });
      }
    }
    this.docs = loaded;
  }

  current(t: LegalDocType): LegalDoc {
    const d = this.docs.get(t);
    if (!d) throw new Error(`legal doc ${t} not loaded`);
    return d;
  }

  versions(): Partial<Record<LegalDocType, string>> {
    const out: Partial<Record<LegalDocType, string>> = {};
    for (const [k, v] of this.docs) out[k] = v.version;
    return out;
  }

  /** A template file in the jogi package root (e.g. `ev_bejelentes_utasitas.md`, SPEC §27.10); null when missing. */
  async rootFile(name: string): Promise<string | null> {
    const root = resolve(this.dir);
    const p = resolve(root, name);
    if (!p.startsWith(root + sep) || !/^[a-z0-9_]+\.md$/.test(name)) return null;
    try {
      return stripInternalNotes(await readFile(p, 'utf8'));
    } catch {
      return null;
    }
  }

  async template(name: string): Promise<string | null> {
    const root = resolve(this.dir);
    const p = resolve(root, 'sablonok', name);
    if (!p.startsWith(root + sep)) return null;
    try {
      return stripInternalNotes(await readFile(p, 'utf8'));
    } catch {
      return null;
    }
  }
}
