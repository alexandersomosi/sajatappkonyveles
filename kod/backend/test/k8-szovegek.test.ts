// k8 / k7b remnants: no time promise in any shipped text (content defaults incl. the shared texts they are generated from,
// and the jogi `tartalom` block that overrides them) – the one allowed sentence stays word for word; legal deadlines
// ("4 napon belül", "5 munkanapon belül") stay. Also: two parallel card deletions by the admin send ONE mail.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXTS } from '../src/content.js';
import { RESPONSE_TIME_FORBIDDEN_PATTERNS } from '../src/_shared/enums.js';
import { ASSIST_STEP_LIST, JOURNEY_STEP_TEXTS, WAITING_TEXTS } from '../src/_shared/bekotes.js';
import { GUIDED_TEXTS } from '../src/_shared/k29g.js';

const ALLOWED = 'A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.';
/** Our own time promises (k8 0. fejezet): durations of the client's steps, our turnaround, the NAV's "20 perc". */
const PROMISE = /[Kk]b\. \d+(?:[–-]\d+)? perc|Pár perc(?! múlva)|pár perc az|Kollégánk 24|általában \d+(?:[–-]\d+)? munkanap|általában pár (?:óra|nap)|perc múlva él|nálunk általában/;

function offenders(texts: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(texts)) {
    if (PROMISE.test(v)) out.push(`${k}: ${v.slice(0, 80)}`);
    // every "24–48" is the allowed sentence itself
    if (v.replaceAll(ALLOWED, '').includes('24–48')) out.push(`${k} (24–48): ${v.slice(0, 80)}`);
    for (const p of RESPONSE_TIME_FORBIDDEN_PATTERNS) if (new RegExp(p, 'i').test(v)) out.push(`${k} (${p})`);
  }
  return out;
}

describe('no time promise', () => {
  it('content defaults (backend + the shared texts they come from)', () => {
    expect(offenders(DEFAULT_TEXTS)).toEqual([]);
  });
  it('the shared step / wait / assist / guided texts the app shows directly', () => {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(JOURNEY_STEP_TEXTS)) for (const [f, x] of Object.entries(v)) if (typeof x === 'string') flat[`journey.${k}.${f}`] = x;
    for (const [k, v] of Object.entries(WAITING_TEXTS)) for (const [f, x] of Object.entries(v)) flat[`wait.${k}.${f}`] = x;
    for (const [k, list] of Object.entries(ASSIST_STEP_LIST)) list.forEach((x, i) => (flat[`assist.${k}.${i}`] = `${x.text} ${x.time}`));
    for (const [k, v] of Object.entries(GUIDED_TEXTS)) if (typeof v === 'string') flat[`guided.${k}`] = v;
    GUIDED_TEXTS.w3Rows.forEach((r, i) => (flat[`guided.w3.${i}`] = `${r.title} ${r.time}`));
    expect(offenders(flat)).toEqual([]);
    // the legal deadlines stay
    expect(JOURNEY_STEP_TEXTS.kamara.time).toBe('5 munkanapon belül');
  });
  it('the jogi tartalom block (it overrides the defaults on the server)', () => {
    const j = JSON.parse(readFileSync(join(__dirname, '..', '..', 'jogi', 'app_szovegek.json'), 'utf8')) as { tartalom: Record<string, string> };
    const t = Object.fromEntries(Object.entries(j.tartalom).filter(([k]) => !k.startsWith('_')));
    expect(offenders(t)).toEqual([]);
    expect(t['visszahivas.igeret']).toContain(ALLOWED);
  });
});
