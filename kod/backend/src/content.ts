// Content texts (SPEC §5.12): defaults shipped in content/defaults.hu.json, DB rows override.
// Placeholders are {curly}; unknown placeholders are left visible so mistakes are noticed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import defaults from './content/defaults.hu.json' with { type: 'json' };
import type { Db } from './db/client.js';
import { contentTexts } from './db/schema.js';
import { withArticle } from './lib/nevelo.js';
import { generatedDefaults } from './content/tulaj1118.js';
import { tulaj1119Defaults } from './content/tulaj1119.js';
import { TULAJ1119_REGI } from './content/tulaj1119_regi.js';
import { k28Defaults } from './content/k28.js';
import { k29fDefaults } from './content/k29f.js';
import { k29Defaults } from './content/k29.js';
import { k7bDefaults } from './content/k7b.js';
import { K7B_REGI } from './content/k7b_regi.js';

/**
 * jogi-reviewed §26 content texts (kod/jogi/app_szovegek.json → `tartalom`, same content keys). Read once at start from
 * LEGAL_DIR (the same directory the LegalStore uses); missing file or block → nothing (our own defaults stay).
 */
function jogiTartalom(): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(join(process.env.LEGAL_DIR || '/app/legal', 'app_szovegek.json'), 'utf8')) as { tartalom?: Record<string, unknown> };
    return Object.fromEntries(Object.entries(raw.tartalom ?? {}).filter(([k, v]) => !k.startsWith('_') && typeof v === 'string' && /^[a-z0-9_.]{3,80}$/.test(k))) as Record<string, string>;
  } catch {
    return {};
  }
}

const normText = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * SPEC §27.9.2: a jogi text that still equals the default §27 replaced word for word (tulaj1119_regi.ts) is superseded
 * by the new default; every other jogi text wins as before (B4 may reword it, and then the jogi wording counts).
 * k7b: the same for the texts the 11-20 wording review changed (k7b_regi.ts).
 */
function supersededJogi(jogi: Record<string, string>): Record<string, string> {
  const old = (regi: Record<string, string>, k: string, v: string) => k in regi && normText(regi[k]!) === normText(v);
  return Object.fromEntries(Object.entries(jogi).filter(([k, v]) => !old(TULAJ1119_REGI, k, v) && !old(K7B_REGI, k, v)));
}

/** Shipped defaults + the SPEC §26 and §27 texts generated from kod/shared, then the jogi-reviewed texts on top. */
export const DEFAULT_TEXTS: Record<string, string> = { ...generatedDefaults(), ...defaults, ...tulaj1119Defaults(), ...k28Defaults(), ...k29Defaults(), ...k29fDefaults(), ...k7bDefaults(), ...supersededJogi(jogiTartalom()) };

export function placeholdersOf(s: string): string[] {
  return [...new Set([...s.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]!))];
}

export function fill(template: string, params: Record<string, string | number | null | undefined>): string {
  // "a {periodAdj} összeg" → "az I. negyedévi összeg": an article right before a placeholder follows the value.
  const t = template.replace(/(^|[^\p{L}])([Aa]z?) \{([a-zA-Z][a-zA-Z0-9]*)\}/gu, (all, pre: string, art: string, k: string) => {
    const v = params[k];
    return v === undefined || v === null || v === '' ? all : `${pre}${withArticle(art, String(v))} {${k}}`;
  });
  return dateSuffixFix(
    t.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (all, k: string, at: number) => {
      const v = params[k];
      if (v === undefined || v === null) return all;
      const sv = String(v);
      // "A könyvelőd" (no accountant assigned yet) is lower case inside a sentence (11-19 javítás).
      if (/^A könyvelőd/.test(sv) && at > 0 && !/[.!?:]\s*$/.test(t.slice(0, at))) return `a${sv.slice(1)}`;
      return sv;
    }),
  );
}

/** k7c2: a date value with its trailing dot before a suffix ("december 20.-ig") → "december 20-ig". */
export function dateSuffixFix(s: string): string {
  return s.replace(/(\d)\.-(ig|tól|től|án|én|jén|ján)(?![\p{L}])/gu, '$1-$2');
}

export class ContentStore {
  private cache = new Map<string, string>();
  private loadedAt = 0;
  private loading: Promise<void> | null = null;
  constructor(
    private readonly db: Db,
    private readonly now: () => Date,
  ) {}

  /** After an admin edit: reload right away (awaited by the admin route, outside any transaction). */
  async reload(): Promise<void> {
    this.loadedAt = 0;
    await this.load();
  }

  /** Kept for callers that only want the next read to refresh. */
  invalidate(): void {
    this.loadedAt = 1;
  }

  private load(): Promise<void> {
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const rows = await this.db.select({ key: contentTexts.key, body: contentTexts.body }).from(contentTexts);
          this.cache = new Map(rows.map((r) => [r.key, r.body]));
          this.loadedAt = this.now().getTime();
        } finally {
          this.loading = null;
        }
      })();
    }
    return this.loading;
  }

  /**
   * Stale-while-revalidate: only the very first load is awaited. Later refreshes run in the
   * background, because callers are often inside a request transaction (notify() in approve /
   * mark-paid) and with a single-connection database (PGlite) an awaited reload through the
   * pool would wait for that same open transaction forever.
   */
  private async ensure(): Promise<void> {
    if (this.loadedAt === 0) {
      await this.load();
      return;
    }
    if (this.now().getTime() - this.loadedAt >= 30_000) void this.load().catch(() => undefined);
  }

  async get(key: string): Promise<string> {
    await this.ensure();
    return this.cache.get(key) ?? DEFAULT_TEXTS[key] ?? '';
  }

  async render(key: string, params: Record<string, string | number | null | undefined>): Promise<string> {
    return fill(await this.get(key), params);
  }

  async all(): Promise<{ key: string; body: string; default: string; placeholders: string[]; overridden: boolean }[]> {
    await this.ensure();
    const keys = new Set([...Object.keys(DEFAULT_TEXTS), ...this.cache.keys()]);
    return [...keys].sort().map((key) => {
      const def = DEFAULT_TEXTS[key] ?? '';
      const body = this.cache.get(key) ?? def;
      return { key, body, default: def, placeholders: placeholdersOf(def || body), overridden: this.cache.has(key) };
    });
  }

  /** From the cache (never a query: callers may be inside a transaction). */
  async exists(key: string): Promise<boolean> {
    if (key in DEFAULT_TEXTS) return true;
    await this.ensure();
    return this.cache.has(key);
  }
}
