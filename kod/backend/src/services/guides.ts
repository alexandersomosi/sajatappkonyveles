// Personalised self-service guides "Mit hova jelölj" (SPEC §26.6.2): GUIDE_TEMPLATES filled from the client's answers.
// The pictures (annotated NAV screenshots) are resolved by the app through <media>/utmutato/<kind>/kepek.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Guide, GuideField, GuideStep } from '../_shared/api.js';
import { personaliseGuide, PREPARE_ITEMS } from '../_shared/bekotes.js';
import { GUIDE_ACTION_LABELS, GUIDE_STEP_KEYS, GUIDE_VIDEO, VIDEO_FILES, type GuideKind } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { BusinessRegistrationAnswers } from '../_shared/api.js';
import { todayBudapest } from '../lib/dates.js';
import type { ClientRow } from './people.js';

export const GUIDE_VERSION = '2026-11-18.2';

/** NAV ONYA ügykörök to tick for an egyéni vállalkozó (fallback copy of jogi/app_szovegek.json meghatalmazas.ugykorok). */
export const ONYA_UGYKOROK = ['ADÓÜGYEK (kivéve egyes jövedéki ügyek)', 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)'];
export const GUIDE_TITLES: Record<GuideKind, string> = {
  vallalkozas_bejelentes: 'Így jelentsd be – videó',
  meghatalmazas: 'Így add meg a meghatalmazást – videó',
  // SPEC §27.3.6: no video for the approval guide (Guide.video null); the title is kept for completeness.
  meghatalmazas_jovahagyas: 'Így hagyd jóvá a meghatalmazást',
};

let ugykorokCache: { dir: string; list: string[] } | null = null;
/** jogi `meghatalmazas.ugykorok` is the single switch of the ügycsoport list (SPEC §26.6.3); fallback: our copy. */
export function ugykorok(deps: Deps): string[] {
  if (ugykorokCache?.dir === deps.cfg.legalDir) return ugykorokCache.list;
  let list = ONYA_UGYKOROK;
  try {
    const raw = JSON.parse(readFileSync(join(deps.cfg.legalDir, 'app_szovegek.json'), 'utf8')) as { szovegek?: Record<string, unknown> };
    const v = raw.szovegek?.['meghatalmazas.ugykorok'];
    if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) list = v as string[];
  } catch {
    /* keep the fallback */
  }
  ugykorokCache = { dir: deps.cfg.legalDir, list };
  return list;
}

export interface GuideContext {
  cl: ClientRow;
  answers: BusinessRegistrationAnswers | null;
  accountant: { firstName: string; name: string | null; taxId: string | null; registrationNumber: string | null };
  progress: string[];
  /** SPEC §27.3.6: approval guide only – "november 22-ig" (fills {jovahagyasHatarido}). */
  jovahagyasHatarido?: string | null;
}

/** SPEC §26.6.2: the shared personaliser (kod/shared/src/bekotes.ts personaliseGuide) fills the template. */
export function buildGuide(deps: Deps, kind: GuideKind, ctx: GuideContext): Guide {
  const cl = ctx.cl;
  const p = personaliseGuide(kind, {
    answers: ctx.answers,
    nev: `${cl.lastName} ${cl.firstName}`.trim(),
    lakcim: cl.addressZip ? { zip: cl.addressZip, city: cl.addressCity ?? '', line: cl.addressLine ?? '' } : null,
    konyvelo: { firstName: ctx.accountant.firstName, nev: ctx.accountant.name, adoazonosito: ctx.accountant.taxId, nyilvantartasiSzam: ctx.accountant.registrationNumber },
    ugykorok: ugykorok(deps),
    progress: ctx.progress,
    stepKeys: GUIDE_STEP_KEYS[kind] as readonly string[],
    ...(ctx.jovahagyasHatarido ? { jovahagyasHatarido: ctx.jovahagyasHatarido } : {}),
  });
  const steps: GuideStep[] = p.steps.map((st) => ({
    ...st,
    fields: st.fields.map((f): GuideField => ({ ...f, actionLabel: GUIDE_ACTION_LABELS[f.action] })),
  }));
  const outdated = todayBudapest(deps.now()) > p.validUntil;
  const video = GUIDE_VIDEO[kind];
  return {
    kind,
    version: GUIDE_VERSION,
    title: p.title,
    intro: p.intro,
    outro: p.outro,
    video: video ? { name: video, title: GUIDE_TITLES[kind], ...VIDEO_FILES[video] } : null,
    prepare:
      kind === 'vallalkozas_bejelentes'
        ? PREPARE_ITEMS.map((x) => ({ key: x.key, label: x.label, note: x.note, explainerKey: x.explainer, storedByUs: x.storedByUs, privacyNote: x.privacyNote }))
        : [],
    steps,
    imagesManifest: `utmutato/${kind}/kepek.json`,
    outdated,
    outdatedText: null,
    ...(kind === 'vallalkozas_bejelentes' ? { activityPending: p.activityPending } : {}),
  };
}

/** Unfilled placeholders left in a guide (QA: must be none). */
export function unfilledPlaceholders(g: Guide): string[] {
  const all = JSON.stringify({ t: g.title, i: g.intro, o: g.outro, s: g.steps });
  return [...all.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]!);
}
