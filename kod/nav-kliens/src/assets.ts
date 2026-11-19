// Reads the copies of kod/shared that `npm run sync-shared` puts into src/_shared (and the build copies
// to dist/_shared). Never edit those copies; edit kod/shared (SPEC §3.2).
import { readFileSync } from 'node:fs';
import type { DemoFixtures } from './types.js';

function readSharedJson<T>(rel: string): T {
  const url = new URL(`./_shared/${rel}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

export interface Brand {
  name: string;
  provider?: { legalName?: string; taxNumber?: string; supportEmail?: string };
}

let brandCache: Brand | undefined;

/** kod/shared/brand.json – the ONE place of the product name (SPEC §3.4). */
export function loadBrand(): Brand {
  brandCache ??= readSharedJson<Brand>('brand.json');
  return brandCache;
}

let fixturesCache: DemoFixtures | undefined;

/** kod/shared/demo/fixtures.json (fictional data only). */
export function loadDefaultDemoFixtures(): DemoFixtures {
  fixturesCache ??= readSharedJson<DemoFixtures>('demo/fixtures.json');
  return fixturesCache;
}

/** brand.json values like "[CÉGADAT: adószám]" are placeholders, not data. */
export function isPlaceholder(v: string | undefined): boolean {
  return v === undefined || v.trim() === '' || v.trim().startsWith('[');
}
