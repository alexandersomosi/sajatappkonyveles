// Útmutatók (SPEC §26.6): a képek kiválasztása lépésenként (a válaszfüggő változatokkal), és a személyre szabott
// útmutató felépítése a sablonból. Az útmutatót a szerver építi (GET /client/guides/:kind); ez a függvény ugyanazt
// csinálja a MINTA-szervernek és tartaléknak, ha egy régebbi szerver még nem ismeri a végpontot.
import type { BusinessRegistrationAnswers, Guide, GuideImage, GuideImageManifest, GuideStep } from '../_shared/api';
import { CHANGE_TEXTS } from '../_shared/bekotes';
import { CLOSING_KIND, CLOSING_TEXTS, personaliseClosingGuide } from '../_shared/k29f';
import { personaliseChangeGuide, personaliseGuide, PREPARE_ITEMS, type ChangeGuideData } from '../_shared/bekotes';
import { CHANGE_KINDS, CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT, GUIDE_ACTION_LABELS, GUIDE_IMAGE_LABELS, GUIDE_VIDEO, VIDEO_FILES, type ChangeKind, type GuideKind } from '../_shared/enums';

/** A normalizáló (scripts/utmutato-kepek.mjs) kiegészítései a GuideImage-en (SPEC §24 11-18 app). */
export type UtmutatoKep = GuideImage & {
  part?: number;
  variant?: { field: 'workKind' | 'euPartner' | string; value: string };
  sourceShort?: string | null;
  markers?: { n: number; style: string; label: string; box: number[] }[];
};

export function kepekLepeshez(m: GuideImageManifest | undefined | null, stepKey: string, v: { workKind?: string | null; euPartner?: string | null } = {}): UtmutatoKep[] {
  if (!m) return [];
  const eu = v.euPartner === 'igen' ? 'igen' : 'nem'; // 'nem_tudom' → a 'nem' változat
  return (m.items as UtmutatoKep[])
    .filter((k) => k.stepKey === stepKey)
    .filter((k) => {
      if (!k.variant) return true;
      if (k.variant.field === 'workKind') return v.workKind ? k.variant.value === v.workKind : k.variant.value === 'fofoglalkozas';
      if (k.variant.field === 'euPartner') return k.variant.value === eu;
      return true;
    })
    .sort((a, b) => (a.part ?? 1) - (b.part ?? 1));
}

/** „Forrás: NAV, {cím}, {dátum}” – a valódi képernyőképek forrása (régi megjelenítéshez). */
export function forrasSor(k: UtmutatoKep): string | null {
  if (k.sourceShort) return k.sourceShort;
  if (!k.source) return null;
  const d = k.source.date ? `, ${k.source.date.replace(/-/g, '.')}.` : '';
  return `Forrás: ${k.source.title}${d}`;
}

/**
 * SPEC §27.1.2 – az őszinte kis sor minden kép alatt (GUIDE_IMAGE_LABELS): valódi → „NAV-képernyő · Forrás: NAV, {cím},
 * {dátum}”; a tulaj saját képe → „NAV-képernyő · Forrás: saját képernyőkép, {dátum}”; rajzolt → „Rajzolt vázlat – a valódi
 * képernyő kicsit eltérhet”.
 */
export function kepCimke(k: Pick<UtmutatoKep, 'kind' | 'source'>): string {
  if (k.kind !== 'kepernyokep') return GUIDE_IMAGE_LABELS.illusztracio;
  const s = k.source;
  const d = s?.date ? `, ${s.date.replace(/-/g, '.')}.` : '';
  if (!s) return GUIDE_IMAGE_LABELS.kepernyokep;
  // own screenshots: never the internal wording ("A tulaj saját …") in client text (k6c review)
  if (/^saját/i.test(s.title.trim()) || /tulaj/i.test(s.title)) return `${GUIDE_IMAGE_LABELS.kepernyokep} · Forrás: saját képernyőkép${d}`;
  // a zárójeles részletek (fájlnév, csatorna) nélkül: egy-két rövid sor maradjon a kép alatt
  const cim = s.title.replace(/^NAV\s*[:,–-]\s*/i, '').replace(/\s*\([^)]*\)/g, '').trim();
  return `${GUIDE_IMAGE_LABELS.kepernyokep} · Forrás: NAV, ${cim}${d}`;
}
/** Van-e rajzolt kép az útmutatóban (akkor egy sor a bevezető alatt: GUIDE_DRAWN_NOTE). */
export const vanRajzolt = (m: GuideImageManifest | null | undefined) => !!m?.items.some((i) => i.kind === 'illusztracio');

export interface UtmutatoKornyezet {
  answers: BusinessRegistrationAnswers | null;
  nev: string;
  lakcim: { zip: string; city: string; line: string } | null;
  konyvelo: { nev: string; firstName: string; adoazonosito: string | null; nyilvantartasiSzam: string | null };
  ugykorok: string[];
  kesz: string[];
  ma: string; // YYYY-MM-DD
  /** Csak a jóváhagyás-útmutatóhoz (SPEC §27.3.6): a megmutatott határidő. */
  jovahagyas?: { dueOn: string; dueText: string; daysLeft: number; lastDay: boolean } | null;
}

export const valtozasFajta = (k: string): k is ChangeKind => (CHANGE_KINDS as readonly string[]).includes(k);

/** A hub-sor címe és mondata: a §28.5 fajtáké a CHANGE_TEXTS-ből, a megszüntetésé (SPEC §29.7) a k29f.ts-ből. */
export function valtozasSor(kind: ChangeKind): { title: string; line: string } {
  if (kind === CLOSING_KIND) return CLOSING_TEXTS.hubRow;
  return (CHANGE_TEXTS.sorok as Record<string, { title: string; line: string }>)[kind] ?? CLOSING_TEXTS.hubRow;
}

/** SPEC §28.5.3: a változás-útmutató ugyanabból a megosztott sablonból (personaliseChangeGuide), mint a szerveren. */
export function valtozasUtmutatoEpit(kind: ChangeKind, k: { change: ChangeGuideData | null; firstName: string; kesz: string[]; ma: string }): Guide {
  const p =
    kind === CLOSING_KIND
      ? personaliseClosingGuide({ change: null, firstName: k.firstName, progress: k.kesz, regime: null, ugysegedValidUntil: CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT })
      : personaliseChangeGuide(kind, { change: k.change, firstName: k.firstName, progress: k.kesz, ugysegedValidUntil: CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT });
  const steps: GuideStep[] = p.steps.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f, actionLabel: GUIDE_ACTION_LABELS[f.action] })) }));
  const elavult = k.ma > p.validUntil;
  return {
    kind: kind as Guide['kind'],
    version: p.version,
    title: p.title,
    intro: p.intro,
    outro: p.outro,
    video: null,
    prepare: [],
    steps,
    imagesManifest: `utmutato/${kind}/kepek.json`,
    outdated: elavult,
    outdatedText: elavult ? '2027-től a vállalkozói nyilvántartást a kamara vezeti. Ezt az útmutatót frissítjük; addig kérj visszahívást, és segítünk.' : null,
    activityPending: p.activityPending,
  };
}

/** Ugyanaz a megosztott személyre szabó, amit a szerver használ (kod/shared/src/bekotes.ts personaliseGuide). */
export function utmutatoEpit(kind: GuideKind, k: UtmutatoKornyezet): Guide {
  if (valtozasFajta(kind)) return valtozasUtmutatoEpit(kind, { change: null, firstName: k.konyvelo.firstName, kesz: k.kesz, ma: k.ma });
  const p = personaliseGuide(kind, {
    answers: k.answers,
    nev: k.nev,
    lakcim: k.lakcim,
    konyvelo: { firstName: k.konyvelo.firstName, nev: k.konyvelo.nev, adoazonosito: k.konyvelo.adoazonosito, nyilvantartasiSzam: k.konyvelo.nyilvantartasiSzam },
    ugykorok: k.ugykorok,
    progress: k.kesz,
    jovahagyasHatarido: k.jovahagyas ? (k.jovahagyas.lastDay ? 'még ma' : k.jovahagyas.dueText) : null,
  });
  const steps: GuideStep[] = p.steps.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f, actionLabel: GUIDE_ACTION_LABELS[f.action] })) }));
  const v = GUIDE_VIDEO[kind];
  const elavult = k.ma > p.validUntil;
  return {
    kind,
    version: '2026-11-19.1',
    title: p.title,
    intro: p.intro,
    outro: p.outro,
    video: v ? { name: v, title: kind === 'meghatalmazas' ? 'Így add meg a meghatalmazást – videó' : 'Így jelentsd be – videó', ...VIDEO_FILES[v] } : null,
    ...(kind === 'meghatalmazas_jovahagyas' ? { approvalDue: k.jovahagyas ?? null } : {}),
    prepare: kind === 'vallalkozas_bejelentes' ? PREPARE_ITEMS.map((x) => ({ key: x.key, label: x.label, note: x.note, explainerKey: x.explainer, storedByUs: x.storedByUs, privacyNote: x.privacyNote })) : [],
    steps,
    imagesManifest: `utmutato/${kind}/kepek.json`,
    outdated: elavult,
    outdatedText: elavult ? '2027-től a vállalkozások nyilvántartását a kamara vezeti. Ezt az útmutatót frissítjük. Addig kérj visszahívást, és segítünk.' : null,
    ...(kind === 'vallalkozas_bejelentes' ? { activityPending: p.activityPending } : {}),
  };
}

/** Maradt-e kitöltetlen {helyőrző} (QA: SPEC §26.14 O1.3). */
export function kitoltetlen(g: Guide): string[] {
  const ki: string[] = [];
  const nez = (s?: string) => {
    for (const m of (s ?? '').matchAll(/\{([A-Za-z0-9_]+)\}/g)) ki.push(m[1]);
  };
  nez(g.title);
  nez(g.intro);
  nez(g.outro);
  for (const s of g.steps) {
    nez(s.screenTitle);
    nez(s.text);
    nez(s.warning);
    for (const f of s.fields) {
      nez(f.label);
      nez(f.value);
      nez(f.why);
    }
  }
  return ki;
}
