// SPEC §27.4.2 – „Így halad a bekötésed”: az EGY lista, az egy szám (todoCount) és az egy „Most ez jön”. A szerver építi
// (OnboardingState.journey); ez ugyanaz a számítás a MINTA-szervernek, és tartalék, amíg §27 nélküli backend fut (régebbi
// szerver, helyi próba). Tiszta függvények, React nélkül (node:test is futtatja).
import type {
  AssistView, BusinessRegistrationView, JourneyStepView, JourneyView, OnboardingState, OnboardingStepState, PathChangeInfo, WaitingCardView,
} from '../_shared/api';
import {
  ASSIST_STATUS_CLIENT_TEXT, ASSIST_STATUS_CLIENT_TEXT_MH, EMPLOYER_TEXTS, fillPlaceholders, JOURNEY_STEP_TEXTS, JOURNEY_TEXTS, PATH_CHANGE_TEXTS,
  STEP_LOCK_DEFAULT_TEXTS, WAITING_ESCALATE_TEXT, WAITING_TEXTS,
} from '../_shared/bekotes';
import {
  ASSIST_CLOSE_REASON_LABELS, ASSIST_OPEN_STATUSES, EMPLOYER_DECISIONS_ALLOW_ACTIVATION, JOURNEY_ACTOR_LABELS, JOURNEY_NOT_COUNTED, JOURNEY_ORDER, JOURNEY_PREVIEW, LOCK_ELOFIZETES_SZERZODES_UTAN,
  PATH_CHANGE_BLOCKER_TEXT, type AssistKind, type AssistStatus, type JourneyActor, type JourneyRowState, type JourneyStepKey, type JourneyVariant,
  type PathChangeBlocker,
} from '../_shared/enums';

const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const napResz = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  // Budapest: +1 h (télen) / +2 h (nyáron) – a dátumhoz elég a +1 h és a déli horgony.
  const b = new Date(d.getTime() + 60 * 60_000);
  return { ev: b.getUTCFullYear(), ho: b.getUTCMonth(), nap: b.getUTCDate() };
};
/** 'YYYY-MM-DD' (Budapest) egy ISO időpontból vagy napból. */
export const napKulcs = (iso: string) => {
  const r = napResz(iso);
  return `${r.ev}-${String(r.ho + 1).padStart(2, '0')}-${String(r.nap).padStart(2, '0')}`;
};
/** „november 22.” */
export const datumPont = (iso: string) => {
  const r = napResz(iso);
  return `${HONAP[r.ho]} ${r.nap}.`;
};
/** „november 22-ig” – a szám közvetlenül kapja a „-ig”-et, a pont elmarad (bekotes.ts §27 fejléc). */
export const hataridoIg = (iso: string) => {
  const r = napResz(iso);
  return `${HONAP[r.ho]} ${r.nap}-ig`;
};
/** n munkanap hozzáadása (szombat, vasárnap kimarad; ünnepnapot a szerver számol). */
export function munkanapotHozzaad(iso: string, n: number): string {
  const d = new Date(`${napKulcs(iso)}T12:00:00Z`);
  let maradt = n;
  while (maradt > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const h = d.getUTCDay();
    if (h !== 0 && h !== 6) maradt--;
  }
  return d.toISOString().slice(0, 10);
}
const napokKozott = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

const NYITOTT = new Set<AssistStatus>(ASSIST_OPEN_STATUSES);
/** A kérés él (nyitott vagy kész) – a lemondott / lezárt kérésnél az önkiszolgáló sorok jönnek vissza. */
export const elo = (a: AssistView | null | undefined): a is AssistView => !!a && (NYITOTT.has(a.status) || a.status === 'kesz');
export const nyitott = (a: AssistView | null | undefined): a is AssistView => !!a && NYITOTT.has(a.status);
export function segitsegFajta(assists: AssistView[] | undefined, kind: AssistKind): AssistView | null {
  const l = (assists ?? []).filter((a) => a.kind === kind);
  return l.find(nyitott) ?? l.find((a) => a.status === 'kesz') ?? null;
}
/** A kérés utolsó állapota (lemondott / lezárt is) – az állapotsorhoz. */
export const utolsoSegitseg = (assists: AssistView[] | undefined, kind: AssistKind) => (assists ?? []).filter((a) => a.kind === kind)[0] ?? null;

/** Az ügyfél állapotmondata egy kéréshez (ha a szerver nem adta). */
export function segitsegSzoveg(a: AssistView, fn: string): string {
  if (a.statusText) return a.statusText;
  const t = (a.kind === 'meghatalmazas' ? ASSIST_STATUS_CLIENT_TEXT_MH[a.status] : undefined) ?? ASSIST_STATUS_CLIENT_TEXT[a.status];
  return fillPlaceholders(t, { firstName: fn, hatarido: a.approval?.dueText ?? '4 napon belül', reasonText: a.closedReason ? ASSIST_CLOSE_REASON_LABELS[a.closedReason].toLocaleLowerCase('hu-HU') : '' });
}

export interface UtBemenet {
  o: OnboardingState;
  /** A bejelentés teljes nézete (activityPending, kamara, időpontok) – csak az indítás-úton. */
  reg?: BusinessRegistrationView | null;
  /** A könyvelő nyitott kérései (ezek is a tieid). */
  keresekDb?: number;
  /** 'YYYY-MM-DD' (Budapest). */
  ma: string;
}

type Sor = {
  key: JourneyStepKey;
  allapot: 'kesz' | 'kliens' | 'var' | 'kesobb' | 'kihagyva';
  actor: JourneyActor;
  statusText?: string;
  timeText?: string | null;
  dueOn?: string | null;
  dueText?: string | null;
  lockedReason?: string | null;
  action?: { label: string; route: string } | null;
  clientPart: boolean;
  completedAt?: string | null;
  /** WAITING_TEXTS kulcs, ha mások dolgoznak rajta. */
  var?: keyof typeof WAITING_TEXTS;
  /** A sürgetés napja (ha addig nem történik semmi, kérj visszahívást). */
  eszkalacio?: string | null;
};

const BEADVA_UTAN = new Set(['beadva', 'javitas', 'ellenorizve', 'kesz']);

/** SPEC §27.4.2 – a lista felépítése. */
export function utEpit({ o, reg = null, keresekDb = 0, ma }: UtBemenet): JourneyView {
  const fn = o.accountant.firstName;
  const fill = (s: string, e: Record<string, string | number> = {}) => fillPlaceholders(s, { firstName: fn, ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, String(v)])) });
  const st = (k: string): OnboardingStepState | undefined => o.steps.find((s) => s.step === k);
  const assists = o.assists ?? [];
  const ev = segitsegFajta(assists, 'vallalkozas_bejelentes');
  const mh = segitsegFajta(assists, 'meghatalmazas');
  const mode = o.registrationMode ?? reg?.mode ?? (o.path === 'inditas' && nyitott(ev) ? 'segitett' : o.path === 'inditas' ? 'onallo' : null);
  const variant: JourneyVariant = o.path == null ? 'nincs' : o.path === 'van' ? 'van' : mode === 'segitett' ? 'inditas_segitett' : 'inditas_onallo';
  const segitett = variant === 'inditas_segitett';
  const regStatus = reg?.status ?? o.registration?.status ?? null;
  const mhAssist = segitett ? ev : mh;
  const t = (k: JourneyStepKey) => JOURNEY_STEP_TEXTS[k];
  const akcio = (k: JourneyStepKey, route?: string, label?: string) => {
    const x = t(k);
    const l = label ?? (segitett && x.actionLabelSegitett !== undefined ? x.actionLabelSegitett : x.actionLabel);
    return l ? { label: l, route: route ?? x.route } : null;
  };
  const ido = (k: JourneyStepKey, seg = segitett) => {
    const x = t(k);
    return seg && x.timeSegitett !== undefined ? x.timeSegitett : x.time;
  };
  const lepesSor = (k: 'szerzodes' | 'azonositas' | 'elofizetes' | 'adatok', s: OnboardingStepState | undefined, route?: string): Sor => {
    if (!s) return { key: k, allapot: 'kesobb', actor: 'te', clientPart: true };
    if (s.status === 'kesz') return { key: k, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: s.completedAt ?? null };
    if (s.status === 'kihagyva') return { key: k, allapot: 'kihagyva', actor: 'te', clientPart: false };
    if (s.locked) return { key: k, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: s.lockedReason ?? null };
    // beküldte, a könyvelő nézi: ebből már nincs teendője (nem számít a „Még N dolog”-ba)
    if (s.status === 'konyvelore_var')
      return { key: k, allapot: 'var', actor: 'konyvelo', clientPart: false, var: k === 'azonositas' ? 'azonositas_ellenorzes' : undefined, eszkalacio: k === 'azonositas' && s.completedAt ? munkanapotHozzaad(s.completedAt, 2) : null };
    return { key: k, allapot: 'kliens', actor: 'te', clientPart: true, statusText: s.status === 'hianyos' && s.note ? `${fn} kéri: ${s.note}` : undefined, action: akcio(k, route) };
  };

  const sorok: Sor[] = [];
  for (const key of JOURNEY_ORDER[variant]) {
    switch (key) {
      case 'ut':
        sorok.push(
          o.path
            ? { key, allapot: 'kesz', actor: 'te', clientPart: true, statusText: o.path === 'van' ? JOURNEY_TEXTS.pathVan : segitett ? JOURNEY_TEXTS.pathInditasSegitett : JOURNEY_TEXTS.pathInditas }
            : { key, allapot: 'kliens', actor: 'te', clientPart: true, action: akcio('ut') },
        );
        break;
      case 'visszahivas':
        sorok.push(
          ev?.status === 'visszahivas_kerve'
            ? { key, allapot: 'var', actor: 'csapat', clientPart: false, var: 'helyettunk_hivas', statusText: 'Kollégánk 24–48 órán belül hív.', eszkalacio: o.callback?.dueAt ? napKulcs(o.callback.dueAt) : null }
            : ev
              ? { key, allapot: 'kesz', actor: 'csapat', clientPart: false, statusText: 'Beszéltünk' }
              : { key, allapot: 'kesobb', actor: 'csapat', clientPart: false },
        );
        break;
      case 'adatok':
        sorok.push(lepesSor('adatok', st('adatok'), o.path === 'inditas' ? '/bekotes/adatok?utana=vallalkozas' : undefined));
        break;
      case 'kerdoiv':
        sorok.push(
          !regStatus || regStatus === 'kitoltes' || regStatus === 'elallt'
            ? { key, allapot: 'kliens', actor: 'te', clientPart: true, action: akcio('kerdoiv') }
            : { key, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: reg?.submittedAt ?? null },
        );
        break;
      case 'bejelentes':
        if (!segitett) {
          if (regStatus && BEADVA_UTAN.has(regStatus)) sorok.push({ key, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: reg?.filed?.uploadedAt ?? null });
          else if (regStatus === 'utmutato' && reg?.activityPending)
            sorok.push({ key, allapot: 'var', actor: 'csapat', clientPart: true, var: 'tevekenyseg_sor', statusText: 'Megírjuk, melyik tevékenység-sort válaszd.', eszkalacio: reg.submittedAt ? munkanapotHozzaad(reg.submittedAt, 2) : null });
          else if (regStatus === 'utmutato') sorok.push({ key, allapot: 'kliens', actor: 'te', clientPart: true, action: akcio('bejelentes') });
          else sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: 'Előbb töltsd ki a kérdőívet. Ebből készül a személyre szabott útmutatód.' });
        } else if (ev?.status === 'ugyfel_engedelyezte')
          sorok.push({ key, allapot: 'var', actor: 'konyvelo', clientPart: false, var: 'helyettunk_bekuldes', eszkalacio: ev.consent?.at ? munkanapotHozzaad(ev.consent.at, 2) : null });
        else if (ev?.status === 'bejelentes_bekuldve')
          sorok.push({ key, allapot: 'var', actor: 'csapat', clientPart: false, var: 'helyettunk_adoszam', statusText: 'Bejelentettük. Rögzítjük az adószámodat.', eszkalacio: ev.evFiledAt ? munkanapotHozzaad(ev.evFiledAt, 2) : null });
        else if (ev?.status === 'kesz' || regStatus === 'kesz') sorok.push({ key, allapot: 'kesz', actor: 'konyvelo', clientPart: false, completedAt: ev?.evFiledAt ?? null });
        else sorok.push({ key, allapot: 'kesobb', actor: 'konyvelo', clientPart: false, lockedReason: `Ha engedélyezted, ${fn} beküldi.` });
        break;
      case 'ertesites':
        if (regStatus === 'javitas')
          sorok.push({ key, allapot: 'kliens', actor: 'te', clientPart: true, statusText: 'Egy dolgot javítanod kell. Megírtuk, mit és hogyan.', action: { label: 'Megnézem, mit javítsak', route: '/bekotes/vallalkozas' } });
        else if (regStatus && BEADVA_UTAN.has(regStatus)) sorok.push({ key, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: reg?.filed?.uploadedAt ?? null });
        else sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: 'Ha beküldted a bejelentést, itt töltöd fel a NAV-os értesítést.' });
        break;
      case 'atnezes':
        if (regStatus === 'beadva')
          sorok.push({ key, allapot: 'var', actor: 'csapat', clientPart: false, var: 'atnezes', eszkalacio: reg?.filed?.uploadedAt ? munkanapotHozzaad(reg.filed.uploadedAt, 2) : null });
        else if (regStatus === 'ellenorizve' && !reg?.adoszam)
          sorok.push({ key, allapot: 'var', actor: 'nav', clientPart: false, var: 'adoszam', statusText: 'Rendben van. Várjuk az adószámodat.', eszkalacio: reg?.checkedAt ? munkanapotHozzaad(reg.checkedAt, 5) : null });
        else if (regStatus === 'kesz' || regStatus === 'ellenorizve') sorok.push({ key, allapot: 'kesz', actor: 'csapat', clientPart: false, completedAt: reg?.checkedAt ?? null });
        else sorok.push({ key, allapot: 'kesobb', actor: 'csapat', clientPart: false });
        break;
      case 'vegso_jovahagyas':
        if (ev && (ev.consent?.valid || ['ugyfel_engedelyezte', 'bejelentes_bekuldve', 'kesz'].includes(ev.status)))
          sorok.push({ key, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: ev.consent?.at ?? null });
        else if (ev && reg?.activityPending && regStatus && regStatus !== 'kitoltes')
          sorok.push({ key, allapot: 'var', actor: 'csapat', clientPart: true, var: 'tevekenyseg_sor', statusText: 'Megírjuk, melyik tevékenység-sort válasszuk.', eszkalacio: reg.submittedAt ? munkanapotHozzaad(reg.submittedAt, 2) : null });
        else if (ev?.canConsent)
          sorok.push({ key, allapot: 'kliens', actor: 'te', clientPart: true, statusText: ev.consent && !ev.consent.valid ? 'Módosítottad a kérdőívet, ezért engedélyezd újra.' : undefined, action: akcio('vegso_jovahagyas') });
        else sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: 'Ha kitöltötted a kérdőívet, itt nézed át, mit jelentünk be, és itt engedélyezed.' });
        break;
      case 'kamara':
        if (regStatus === 'kesz' && reg?.chamber?.doneAt) sorok.push({ key, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: reg.chamber.doneAt });
        else if (regStatus === 'kesz') {
          const due = reg?.chamber?.dueOn ?? null;
          const ut = due ? napokKozott(ma, due) : null;
          sorok.push({
            key, allapot: 'kliens', actor: 'te', clientPart: true, dueOn: due,
            dueText: due ? (ut != null && ut < 0 ? `A határidő ${datumPont(due)} volt.` : ut === 0 ? 'Ma van az utolsó nap' : `${hataridoIg(due)}${ut != null ? ` (még ${ut} nap)` : ''}`) : null,
            action: akcio('kamara'),
          });
        } else sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: 'Ha megvan az adószámod, ez jön. Megmutatjuk, hogyan.' });
        break;
      case 'szerzodes':
        sorok.push(lepesSor('szerzodes', st('szerzodes')));
        break;
      case 'meghatalmazas': {
        const s = st('meghatalmazas');
        const a = elo(mhAssist) ? mhAssist : null;
        if (a) {
          const ap = a.approval;
          if (a.status === 'visszahivas_kerve')
            sorok.push(
              a.kind === 'meghatalmazas'
                ? { key, allapot: 'var', actor: 'csapat', clientPart: true, var: 'helyettunk_hivas', statusText: 'Kollégánk 24–48 órán belül hív.', eszkalacio: o.callback?.dueAt ? napKulcs(o.callback.dueAt) : null, timeText: ido(key, true) }
                : { key, allapot: 'kesobb', actor: 'konyvelo', clientPart: true, lockedReason: `A hívás után ${fn} beküldi, te csak jóváhagyod.`, timeText: ido(key, true) },
            );
          else if (a.status === 'egyeztetve' || a.status === 'meghatalmazas_lejart')
            sorok.push({ key, allapot: 'var', actor: 'konyvelo', clientPart: true, var: 'helyettunk_ujegyke', statusText: a.status === 'meghatalmazas_lejart' ? segitsegSzoveg(a, fn) : `${fn} beküldi a meghatalmazást.`, timeText: ido(key, true) });
          else if (a.status === 'meghatalmazas_bekuldve')
            sorok.push({
              key, allapot: 'kliens', actor: 'te', clientPart: true, timeText: ido(key, true), statusText: 'Hagyd jóvá az ONYA-ban.',
              dueOn: ap?.dueOn ?? null,
              dueText: ap ? (ap.lastDay ? 'Ma van az utolsó nap' : `${ap.dueText} (még ${ap.daysLeft} nap)`) : null,
              action: { label: JOURNEY_STEP_TEXTS.meghatalmazas.actionLabelSegitett ?? 'Megnyitom a jóváhagyás útmutatóját', route: '/bekotes/meghatalmazas/jovahagyas' },
            });
          else if (a.status === 'meghatalmazas_jovahagyva')
            sorok.push({ key, allapot: 'var', actor: 'konyvelo', clientPart: false, var: 'helyettunk_ellenorzes', statusText: `Jóváhagytad. ${fn} ellenőrzi.`, eszkalacio: a.clientApprovedAt ? munkanapotHozzaad(a.clientApprovedAt, 1) : null, timeText: ido(key, true) });
          else sorok.push({ key, allapot: 'kesz', actor: 'konyvelo', clientPart: true, completedAt: a.meghatalmazasLiveAt });
        } else if (!s) sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true });
        else if (s.status === 'kesz') sorok.push({ key, allapot: 'kesz', actor: 'te', clientPart: true, completedAt: s.completedAt ?? null });
        else if (s.locked) sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: s.lockedReason ?? null, timeText: ido(key, false) });
        else if (s.status === 'konyvelore_var')
          sorok.push({ key, allapot: 'var', actor: 'konyvelo', clientPart: false, var: 'meghatalmazas_ellenorzes', statusText: `Beküldted. ${fn} ellenőrzi a NAV-nál.`, eszkalacio: s.data?.submittedAt ? munkanapotHozzaad(s.data.submittedAt, 3) : null });
        else sorok.push({ key, allapot: 'kliens', actor: 'te', clientPart: true, timeText: ido(key, false), statusText: s.status === 'hianyos' && s.note ? `${fn} kéri: ${s.note}` : undefined, action: akcio(key, undefined, JOURNEY_STEP_TEXTS.meghatalmazas.actionLabel) });
        break;
      }
      case 'azonositas':
        sorok.push(lepesSor('azonositas', st('azonositas')));
        break;
      // SPEC §28.3.4: nem kötelező sor, soha nem „most”, nem számít a teendők közé (JOURNEY_NOT_COUNTED)
      case 'kedvezmenyek':
        sorok.push({ key, allapot: 'kliens', actor: 'te', clientPart: false, action: akcio('kedvezmenyek') });
        break;
      // SPEC §28.K.7: csak ha van alkalmazott vagy EFO; a könyvelő dönt
      case 'alkalmazottak': {
        const e = o.employer;
        if (!e || e.answer === 'nincs') break;
        if (e.decision && EMPLOYER_DECISIONS_ALLOW_ACTIVATION.includes(e.decision)) sorok.push({ key, allapot: 'kesz', actor: 'konyvelo', clientPart: false, statusText: e.clientText ?? undefined });
        else sorok.push({ key, allapot: 'var', actor: 'konyvelo', clientPart: false, statusText: e.clientText ?? fill(EMPLOYER_TEXTS.journeyWaiting) });
        break;
      }
      case 'elofizetes': {
        const s = st('elofizetes');
        const szerz = st('szerzodes');
        if (s && s.status !== 'kesz' && !s.locked && szerz && szerz.status !== 'kesz')
          sorok.push({ key, allapot: 'kesobb', actor: 'te', clientPart: true, lockedReason: STEP_LOCK_DEFAULT_TEXTS[LOCK_ELOFIZETES_SZERZODES_UTAN] });
        else sorok.push(lepesSor('elofizetes', s));
        break;
      }
      case 'nav_bekotes': {
        const s = st('nav_bekotes');
        const mhKesz = sorok.find((x) => x.key === 'meghatalmazas')?.allapot === 'kesz';
        if (s?.status === 'kesz') sorok.push({ key, allapot: 'kesz', actor: 'konyvelo', clientPart: false, completedAt: s.completedAt ?? null });
        else if (mhKesz) sorok.push({ key, allapot: 'var', actor: 'konyvelo', clientPart: false, var: 'nav_bekotes', eszkalacio: null });
        else sorok.push({ key, allapot: 'kesobb', actor: 'konyvelo', clientPart: false, lockedReason: `A meghatalmazás után ${fn} köti be. Utána a kiállított számláid maguktól megjelennek itt.` });
        break;
      }
    }
  }

  // „Most ez jön”: az első, ügyfél-határidős sor (jóváhagyás, kamara), különben az első a sorrendben.
  const kliens = sorok.filter((s) => s.allapot === 'kliens' && !(JOURNEY_NOT_COUNTED as readonly string[]).includes(s.key));
  const most = kliens.find((s) => s.dueOn) ?? kliens[0] ?? null;
  const actorLabel = (a: JourneyActor) => fill(JOURNEY_ACTOR_LABELS[a]);
  const steps: JourneyStepView[] = sorok.map((s, i) => {
    const state: JourneyRowState = s.allapot === 'kliens' ? (s === most ? 'most' : 'nyitva') : s.allapot;
    const alap =
      state === 'kesz'
        ? s.completedAt
          ? fill(JOURNEY_TEXTS.rowKeszWhen, { date: datumPont(s.completedAt) })
          : JOURNEY_TEXTS.rowKesz
        : state === 'most'
          ? JOURNEY_TEXTS.rowMost
          : state === 'nyitva'
            ? JOURNEY_TEXTS.rowNyitva
            : state === 'var'
              ? s.actor === 'nav'
                ? 'A NAV dolgozik rajta'
                : fill(JOURNEY_TEXTS.rowVar, { actor: actorLabel(s.actor) })
              : (s.lockedReason ?? JOURNEY_TEXTS.rowKesobb);
    return {
      key: s.key,
      n: i + 1,
      title: t(s.key).title,
      actor: s.actor,
      actorLabel: actorLabel(s.actor),
      state,
      // mint a szerveren: a „később” sor állapota „Később”, az ok a lockedReason (koppintásra a lapon)
      statusText: state === 'kesobb' ? JOURNEY_TEXTS.rowKesobb : (s.statusText ?? alap),
      timeText: state === 'kesz' || state === 'kihagyva' ? null : s.timeText !== undefined ? s.timeText : ido(s.key),
      dueOn: s.dueOn ?? null,
      dueText: s.dueText ?? null,
      lockedReason: state === 'kesobb' ? (s.lockedReason ?? null) : null,
      action: state === 'most' || state === 'nyitva' ? (s.action ?? null) : null,
      explainerKey: t(s.key).explainer,
      clientPart: s.clientPart,
      optional: s.key === 'kamara',
      completedAt: s.completedAt ?? null,
    };
  });
  const varSor = (() => {
    const idx = most ? sorok.indexOf(most) : sorok.length;
    return sorok.slice(0, idx).find((s) => s.allapot === 'var' && s.var) ?? (most ? null : sorok.find((s) => s.allapot === 'var' && s.var)) ?? null;
  })();
  const elsoNyitott = steps.find((s) => s.state === 'nyitva' && s.action);
  let waiting: WaitingCardView | null = null;
  if (varSor?.var) {
    const w = WAITING_TEXTS[varSor.var];
    const telefon = o.callback?.phoneMasked ?? 'megadott';
    waiting = {
      key: varSor.var,
      actor: varSor.actor,
      kicker: fill(w.kicker),
      title: fill(w.title),
      body: fill(w.body, { phoneMasked: telefon }),
      escalateText: varSor.eszkalacio ? fill(WAITING_ESCALATE_TEXT, { hatarido: hataridoIg(varSor.eszkalacio) }) : null,
      meanwhile: elsoNyitott?.action ? { title: elsoNyitott.title, label: elsoNyitott.action.label, route: elsoNyitott.action.route } : null,
    };
  }
  const todoCount = steps.filter((s) => s.clientPart && s.state !== 'kesz' && s.state !== 'kihagyva').length + keresekDb;
  const remaining = steps.filter((s) => s.state !== 'kesz' && s.state !== 'kihagyva').length + (o.path == null ? JOURNEY_PREVIEW.length : 0);
  const varo = waiting ? (waiting.actor === 'nav' ? 'A NAV' : waiting.actor === 'csapat' ? 'Csapatunk' : fn) : fn;
  const bandTitle =
    o.path == null ? JOURNEY_TEXTS.bandStart : todoCount === 1 ? fill(JOURNEY_TEXTS.bandTodoOne) : todoCount >= 2 ? fill(JOURNEY_TEXTS.bandTodo, { n: todoCount }) : fill(JOURNEY_TEXTS.bandNone, { actor: varo });
  return {
    variant,
    path: o.path,
    mode: o.path === 'inditas' ? (mode ?? 'onallo') : null,
    steps,
    currentKey: most?.key ?? null,
    waiting,
    todoCount,
    remaining,
    bandTitle,
    lockedSheetText: fill(JOURNEY_TEXTS.lockedSheet, { remaining: Math.max(remaining, todoCount), n: todoCount }),
    preview: o.path == null ? JOURNEY_PREVIEW.map((k) => JOURNEY_STEP_TEXTS[k].title) : [],
  };
}

/** SPEC §27.2 – módosítható-e a válasz (tartalék; a szerver a pathChange-et küldi). */
export function utvaltasInfo(o: OnboardingState, reg?: BusinessRegistrationView | null, lifecycle?: string | null): PathChangeInfo {
  const ev = segitsegFajta(o.assists, 'vallalkozas_bejelentes');
  const regStatus = reg?.status ?? o.registration?.status ?? null;
  let blocker: PathChangeBlocker | null = null;
  if (lifecycle && lifecycle !== 'bekotes_alatt') blocker = 'nem_bekotes_alatt';
  else if (regStatus && BEADVA_UTAN.has(regStatus)) blocker = 'bejelentes_bekuldve';
  else if (ev && ['ugyfel_engedelyezte', 'bejelentes_bekuldve'].includes(ev.status)) blocker = 'bejelentes_engedelyezve';
  const mode = o.registrationMode ?? reg?.mode ?? null;
  return {
    current: o.path,
    mode: o.path === 'inditas' ? (mode ?? 'onallo') : null,
    canChange: !blocker && o.path != null,
    blocker,
    blockerText: blocker ? PATH_CHANGE_BLOCKER_TEXT[blocker] : null,
    confirmText: o.path === 'van' ? PATH_CHANGE_TEXTS.toInditas : o.path === 'inditas' ? (nyitott(ev) ? `${PATH_CHANGE_TEXTS.toVan} ${PATH_CHANGE_TEXTS.toVanAssist}` : PATH_CHANGE_TEXTS.toVan) : null,
    changedAt: null,
  };
}

/** A sor egy kéréshez: melyik „Intézzük helyetted” kérés tartozik hozzá (route az /helyettunk-hoz). */
export const helyettunkUt = (fajta: AssistKind, forras: string) => ({ pathname: '/helyettunk' as const, params: { fajta, forras } });

/** A visszahívás témája a „Most ez jön” sorból (S21). */
export function temaSorbol(k: JourneyStepKey | null | undefined): 'bekotes' | 'vallalkozas_inditas' | 'meghatalmazas' | 'azonositas' | 'elofizetes' {
  if (!k) return 'bekotes';
  if (['kerdoiv', 'bejelentes', 'ertesites', 'atnezes', 'vegso_jovahagyas', 'kamara'].includes(k)) return 'vallalkozas_inditas';
  if (k === 'meghatalmazas') return 'meghatalmazas';
  if (k === 'azonositas') return 'azonositas';
  if (k === 'elofizetes') return 'elofizetes';
  return 'bekotes';
}
