// Pure rules of the "Intézzük helyette" pages (SPEC §27.3, §27.6): queue filters and order, who has the ball, the
// countdowns, the per-phase check lists and why an action button is disabled, the branch history line (§27.2.5).
// No React here, so every rule has a unit test (helyettunk.test.ts).
import {
  ASSIST_CHECK_ITEMS,
  ASSIST_CHECK_NOT_FOR_MH,
  ASSIST_OPEN_STATUSES,
  ASSIST_PHASES,
  ASSIST_RULES,
  type AssistAction,
  type AssistCheckItem,
  type AssistCheckPhase,
  type AssistKind,
  type AssistStatus,
  type OnboardingPath,
} from '../_shared/enums';
import type { PathHistoryItem } from '../_shared/api';
import { bpDate, datumRovid, idopont, napKulonbseg } from './format';

export type PanelSzerep = 'csapat' | 'konyvelo' | 'admin';
export type AssistSzuro = 'nyitott' | 'nalam' | 'ugyfelre_var' | 'lejart' | 'kesz' | 'mind';
type Labda = 'csapat' | 'konyvelo' | 'ugyfel' | null;

/** Queue chips in order (SPEC §27.6.2). "Nálam" says whose turn it is for the viewer's role. */
export const ASSIST_SZUROK: { k: AssistSzuro; felirat: string }[] = [
  { k: 'nyitott', felirat: 'Nyitott' },
  { k: 'nalam', felirat: 'Nálam' },
  { k: 'ugyfelre_var', felirat: 'Ügyfélre vár' },
  { k: 'lejart', felirat: 'Lejárt jóváhagyás' },
  { k: 'kesz', felirat: 'Kész' },
  { k: 'mind', felirat: 'Mind' },
];

export function nyitottAssist(s: AssistStatus): boolean {
  return ASSIST_OPEN_STATUSES.includes(s);
}

/**
 * Is it the viewer's turn? csapat: ball 'csapat'; accountant: ball 'konyvelo' (the API lists only his own clients);
 * admin: ball 'csapat', or 'konyvelo' when he is that client's accountant (`enId`). Same rule as the backend's
 * `TeamSummary.assists.waitingOnMe`.
 */
export function labdaNalam(row: { status: AssistStatus; ball: Labda; accountant?: { userId: string } | null }, szerep: PanelSzerep, enId?: string): boolean {
  if (!nyitottAssist(row.status) || !row.ball) return false;
  if (szerep === 'csapat') return row.ball === 'csapat';
  if (szerep === 'konyvelo') return row.ball === 'konyvelo';
  return row.ball === 'csapat' || (row.ball === 'konyvelo' && !!enId && row.accountant?.userId === enId);
}

/** "Lejárt jóváhagyás": NAV deleted the unapproved UJEGYKE, or the date shown to the client has passed. */
export function lejartJovahagyas(row: { status: AssistStatus; approvalDueOn: string | null }, ma: string): boolean {
  if (row.status === 'meghatalmazas_lejart') return true;
  return row.status === 'meghatalmazas_bekuldve' && !!row.approvalDueOn && row.approvalDueOn < ma;
}

export function szuroIlleszkedik(
  row: { status: AssistStatus; ball: Labda; approvalDueOn: string | null; accountant?: { userId: string } | null },
  f: AssistSzuro,
  szerep: PanelSzerep,
  ma: string,
  enId?: string,
): boolean {
  switch (f) {
    case 'nyitott':
      return nyitottAssist(row.status);
    case 'nalam':
      return labdaNalam(row, szerep, enId);
    case 'ugyfelre_var':
      return nyitottAssist(row.status) && row.ball === 'ugyfel';
    case 'lejart':
      return lejartJovahagyas(row, ma);
    case 'kesz':
      return row.status === 'kesz';
    default:
      return true;
  }
}

/** Overdue deadlines first, then the nearest one; rows without a deadline last (oldest request first). */
export function assistSorrend(
  a: { nextDue: { at: string; overdue: boolean } | null; createdAt: string },
  b: { nextDue: { at: string; overdue: boolean } | null; createdAt: string },
): number {
  const ao = a.nextDue?.overdue ? 1 : 0;
  const bo = b.nextDue?.overdue ? 1 : 0;
  if (ao !== bo) return bo - ao;
  if (a.nextDue && b.nextDue) return a.nextDue.at.localeCompare(b.nextDue.at) || a.createdAt.localeCompare(b.createdAt);
  if (a.nextDue) return -1;
  if (b.nextDue) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/** Lower-case the first letter inside a sentence, but keep abbreviations ("NAV-meghatalmazás" stays). */
export function kisbetu(s: string): string {
  return /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** "Kovács Bence" → "Bence" (Hungarian order: the given name is last). */
export function utonev(teljes: string | null | undefined): string {
  const t = (teljes ?? '').trim().split(/\s+/);
  return t[t.length - 1] || 'a könyvelő';
}

/** Column "Kinél a labda": Csapat / {accountant first name} / Ügyfél. */
export function labdaSzoveg(ball: Labda, konyveloNev: string | null | undefined): string {
  if (ball === 'csapat') return 'Csapat';
  if (ball === 'konyvelo') return utonev(konyveloNev);
  if (ball === 'ugyfel') return 'Ügyfél';
  return '–';
}

/**
 * Countdown of the next deadline: "még 2 nap" / "holnap" / "ma, még 3 óra" / red "lejárt 3 órája".
 * `mostMs` = now; the colour is 'figyel' on the due day, 'hiba' once passed.
 */
export function hataridoVisszaszamol(at: string, mostMs: number): { szoveg: string; szin: 'semleges' | 'figyel' | 'hiba' } {
  const perc = Math.round((Date.parse(at) - mostMs) / 60_000);
  if (perc < 0) {
    const o = -perc;
    const szoveg = o < 60 ? `lejárt ${o} perce` : o < 48 * 60 ? `lejárt ${Math.floor(o / 60)} órája` : `lejárt ${Math.floor(o / 1440)} napja`;
    return { szoveg, szin: 'hiba' };
  }
  const nap = napKulonbseg(bpDate(at), bpDate(new Date(mostMs).toISOString()));
  if (nap <= 0) return { szoveg: perc < 60 ? `ma, még ${perc} perc` : `ma, még ${Math.floor(perc / 60)} óra`, szin: 'figyel' };
  if (nap === 1) return { szoveg: 'holnap', szin: 'semleges' };
  return { szoveg: `még ${nap} nap`, szin: 'semleges' };
}

/** "Jóváhagyás: nov. 22." – the date the client was told (filing day + 3). */
export function jovahagyasSzoveg(approvalDueOn: string | null): string | null {
  return approvalDueOn ? `Jóváhagyás: ${datumRovid(approvalDueOn)}` : null;
}

/**
 * The 4-day approval window (SPEC §27.3.5): NAV deletes the unapproved UJEGYKE 4 × 24 h after filing; we show the
 * client filing day + 3. Returns the NAV deadline, how much of the window is used (0…1) and a plain line.
 */
export function jovahagyasIdozito(filedAt: string, mostMs: number): { navTorli: string; arany: number; maradtOra: number; szoveg: string } {
  const kezd = Date.parse(filedAt);
  const veg = kezd + ASSIST_RULES.navApprovalDays * 24 * 3_600_000;
  const arany = Math.min(1, Math.max(0, (mostMs - kezd) / (veg - kezd)));
  const maradtOra = Math.floor((veg - mostMs) / 3_600_000);
  const szoveg =
    maradtOra < 0
      ? 'A NAV már törölhette: újra be kell küldeni.'
      : maradtOra < 24
        ? `Még ${maradtOra} óra, utána a NAV törli.`
        : `Még ${Math.floor(maradtOra / 24)} nap ${maradtOra % 24} óra, utána a NAV törli.`;
  return { navTorli: new Date(veg).toISOString(), arany, maradtOra, szoveg };
}

// ---------- check lists per phase ----------
export const FAZIS_CIM: Record<AssistCheckPhase, string> = {
  hivas: 'Hívás és egyeztetés',
  ujegyke: 'Meghatalmazás beküldése (UJEGYKE)',
  bejelentes: 'Vállalkozás bejelentése',
};
/** Who does the phase (shown next to its title). */
export const FAZIS_KI: Record<AssistCheckPhase, string> = {
  hivas: 'csapat vagy könyvelő',
  ujegyke: 'csak a könyvelő, a saját belépésével',
  bejelentes: 'csak a könyvelő, a saját belépésével',
};

export function fazisok(kind: AssistKind): readonly AssistCheckPhase[] {
  return ASSIST_PHASES[kind];
}
/** Items of a phase for this kind (kind 'meghatalmazas' hides the EV-only items). */
export function fazisElemek(kind: AssistKind, phase: AssistCheckPhase): AssistCheckItem[] {
  const all = ASSIST_CHECK_ITEMS[phase] as readonly AssistCheckItem[];
  return kind === 'meghatalmazas' ? all.filter((i) => !ASSIST_CHECK_NOT_FOR_MH.includes(i)) : [...all];
}
export function hianyzoPipak(kind: AssistKind, phase: AssistCheckPhase, kesz: readonly AssistCheckItem[]): AssistCheckItem[] {
  return fazisElemek(kind, phase).filter((i) => !kesz.includes(i));
}

const SORREND: Record<AssistStatus, number> = {
  visszahivas_kerve: 0,
  egyeztetve: 1,
  meghatalmazas_lejart: 1.5,
  meghatalmazas_bekuldve: 2,
  meghatalmazas_jovahagyva: 3,
  meghatalmazas_el: 4,
  ugyfel_engedelyezte: 5,
  bejelentes_bekuldve: 6,
  kesz: 7,
  visszavonva: -1,
  lezarva: -1,
};
/** The phase whose button is the next step now (null = waiting for the client / the NAV, or finished). */
export function aktivFazis(status: AssistStatus): AssistCheckPhase | null {
  if (status === 'visszahivas_kerve') return 'hivas';
  if (status === 'egyeztetve' || status === 'meghatalmazas_lejart') return 'ujegyke';
  if (status === 'ugyfel_engedelyezte') return 'bejelentes';
  return null;
}
/** Is the phase behind us? (closed requests: never – their ticks stay as they were.) */
export function fazisKesz(phase: AssistCheckPhase, status: AssistStatus): boolean {
  const i = SORREND[status];
  if (i < 0) return false;
  if (phase === 'hivas') return i >= 1;
  if (phase === 'ujegyke') return i >= 2;
  return i >= 6;
}

/** What the client has to do now, in one line for the staff ("Az ügyfél: …"). */
export function ugyfelTeendo(status: AssistStatus): string | null {
  if (status === 'meghatalmazas_bekuldve') return 'jóváhagyja a meghatalmazást az ONYA-ban (a saját belépésével).';
  if (status === 'meghatalmazas_el') return 'átnézi az adatait az appban, és engedélyezi a bejelentést.';
  return null;
}

// ---------- action buttons ----------
export interface MuveletKornyezet {
  status: AssistStatus;
  kind: AssistKind;
  szerep: PanelSzerep;
  /** The viewer is the client's own accountant. */
  sajatKonyvelo: boolean;
  /** `TeamAssistDetail.allowedActions` (role + status, from the server). */
  allowed: readonly AssistAction[];
  /** Unticked items of the action's phase. */
  hianyzo: number;
  konyveloUtonev: string;
  answersMatchConsent: boolean | null;
  /** 11-19 javítás: what the client still owes before the UJEGYKE (TeamAssistDetail.notReadyReasons). */
  notReady?: readonly string[];
}
export type PanelMuvelet = 'egyeztetve' | 'ujegyke_bekuldve' | 'lejart' | 'meghatalmazas_el' | 'bejelentes_bekuldve';
/** Statuses in which a button is shown at all. */
const LATSZIK: Record<PanelMuvelet, readonly AssistStatus[]> = {
  egyeztetve: ['visszahivas_kerve'],
  ujegyke_bekuldve: ['egyeztetve', 'meghatalmazas_lejart'],
  // 11-19 javítás: also after a mistaken "Jóváhagytam" (the client did not approve in ONYA, NAV deleted it)
  lejart: ['meghatalmazas_bekuldve', 'meghatalmazas_jovahagyva'],
  // late approvals happen: after 'lejart' the accountant may still find it live in ONYA
  meghatalmazas_el: ['meghatalmazas_bekuldve', 'meghatalmazas_jovahagyva', 'meghatalmazas_lejart'],
  bejelentes_bekuldve: ['meghatalmazas_el', 'ugyfel_engedelyezte'],
};
const CSAK_KONYVELO: readonly PanelMuvelet[] = ['ujegyke_bekuldve', 'meghatalmazas_el', 'bejelentes_bekuldve'];

/**
 * Button state: hidden (null), or enabled / disabled with the reason the panel prints under it (SPEC §27.6.3).
 * The server decides in the end (409/403); this only explains.
 */
export function muveletAllapot(m: PanelMuvelet, k: MuveletKornyezet): { mehet: boolean; miert: string | null } | null {
  if (!LATSZIK[m].includes(k.status)) return null;
  if (m === 'bejelentes_bekuldve' && k.kind !== 'vallalkozas_bejelentes') return null;
  if (m === 'meghatalmazas_el' && k.status === 'meghatalmazas_bekuldve' && k.szerep === 'csapat') return null;
  if (CSAK_KONYVELO.includes(m) && !(k.szerep === 'admin' || k.sajatKonyvelo)) return { mehet: false, miert: `Ezt csak ${k.konyveloUtonev} küldheti be, a saját belépésével.` };
  if (m === 'bejelentes_bekuldve') {
    if (k.status === 'meghatalmazas_el') return { mehet: false, miert: 'Az ügyfél még nem engedélyezte a bejelentést.' };
    if (k.answersMatchConsent === false) return { mehet: false, miert: 'A kérdőív változott az engedély óta.' };
  }
  // 11-19 javítás: the client is the blocker – say it BEFORE the checklist count (the UJEGYKE must not be filed at NAV
  // while the app would refuse to record it: no record, no reminders, no 4-day timer).
  if (m === 'ujegyke_bekuldve' && k.notReady?.length) return { mehet: false, miert: `Előbb az ügyfélnek: ${k.notReady.join(', ')}. Addig ne küldd be.` };
  if (k.hianyzo > 0) return { mehet: false, miert: `Még ${k.hianyzo} pont van hátra a listából.` };
  if (!k.allowed.includes(m)) {
    if (m === 'ujegyke_bekuldve') return { mehet: false, miert: 'Előbb az ügyfélnek el kell fogadnia a szerződést.' };
    return { mehet: false, miert: 'Ezt most nem teheted meg.' };
  }
  return { mehet: true, miert: null };
}

// ---------- branch history (SPEC §27.2.5) ----------
export const UTVONAL_CIMKE: Record<OnboardingPath, string> = { van: 'Már van vállalkozása', inditas: 'Most indítja' };
const KI_VALTOTT: Record<PathHistoryItem['by'], string> = {
  ugyfel: 'az ügyfél váltott',
  csapat: 'a csapat módosította',
  admin: 'a tulajdonos módosította',
  rendszer: 'a rendszer állította',
};
/** "Most indítja → Már van vállalkozása · ma 10:20 · az ügyfél váltott" */
export function utvonalSor(h: PathHistoryItem, ma: string): string {
  const honnan = h.from ? UTVONAL_CIMKE[h.from] : 'Nem válaszolt';
  const hova = h.to ? UTVONAL_CIMKE[h.to] : 'Nem válaszolt';
  return `${honnan} → ${hova} · ${idopont(h.at, ma)} · ${KI_VALTOTT[h.by]}`;
}

/** "Útvonalat váltott – már van vállalkozása" instead of "Elállt" on a pipeline card left by a branch change. */
export function elalltSzoveg(row: { status: string; pathChangedAt?: string | null }): string | null {
  return row.status === 'elallt' && row.pathChangedAt ? 'Útvonalat váltott – már van vállalkozása' : null;
}
