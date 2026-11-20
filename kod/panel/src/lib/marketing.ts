// SPEC §31.4: pure helpers of the Marketing tab (link builder, ratios, range query). The channel rule and the slug live
// in kod/shared (marketing.ts) – one definition for the landing, the app, the backend and here.
import { CAMPAIGN_SOURCES, campaignLink, campaignSlug } from '../_shared/marketing';

export type Idoszak = '1' | '7' | '30' | '90' | 'egyeni';
export const IDOSZAKOK: { kulcs: Exclude<Idoszak, 'egyeni'>; felirat: string }[] = [
  { kulcs: '1', felirat: 'Ma' },
  { kulcs: '7', felirat: '7 nap' },
  { kulcs: '30', felirat: '30 nap' },
  { kulcs: '90', felirat: '90 nap' },
];

/** The query of GET /admin/marketing for the chosen range (a custom range only with both days filled). */
export function marketingQuery(idoszak: Idoszak, tol: string, ig: string): { nap?: string; tol?: string; ig?: string } {
  if (idoszak === 'egyeni') return tol && ig ? { tol, ig } : { nap: '30' };
  return { nap: idoszak };
}

/** "12%" of b relative to a; "–" when there is nothing to divide by. */
export function arany(resz: number, egesz: number | null | undefined): string {
  if (!egesz || egesz <= 0) return '–';
  return `${Math.round((resz / egesz) * 100)}%`;
}

export interface LinkUrlap {
  forras: string;
  kampany: string;
  tartalom: string;
  /** Empty = the suggested medium of the source. */
  medium: string;
}

/** The ready link of the builder, or null while the campaign name is missing. */
export function kampanyLink(alap: string, u: LinkUrlap): string | null {
  const kampany = campaignSlug(u.kampany);
  const forras = campaignSlug(u.forras);
  if (!kampany || !forras || !alap) return null;
  const javasolt = CAMPAIGN_SOURCES.find((s) => s.source === u.forras)?.medium ?? '';
  return campaignLink({ base: alap, source: forras, medium: u.medium.trim() || javasolt, campaign: kampany, content: u.tartalom });
}
