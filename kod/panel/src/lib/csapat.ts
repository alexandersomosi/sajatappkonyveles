// Pure helpers of the service-team pages (SPEC §26.2–§26.4): callback SLA, attempts, adószám check, pipeline markers,
// chat bubble sides, the left menu per role. No React here, so every rule has a unit test (csapat.test.ts).
import {
  CALLBACK_FAILED_OUTCOMES,
  CALLBACK_OPEN_STATUSES,
  CALLBACK_RULES,
  REGISTRATION_CHECK_ITEMS,
  type CallbackAttemptOutcome,
  type CallbackStatus,
  type RegistrationCheckItem,
  type RegistrationStatus,
  type StartPlan,
} from '../_shared/enums';
import type { Message } from '../_shared/api';
import { ACTIVITY_PENDING_DEADLINE_WORKDAYS } from '../_shared/bekotes';
import type { Icon3dName } from '../ui/Icon3d';
import { datum } from './format';
import { torzsszamOk } from './validate';

// ---------- callbacks ----------
export type SlaSzin = 'semleges' | 'figyel' | 'hiba' | 'lezart';

export function nyitottVisszahivas(s: CallbackStatus): boolean {
  return CALLBACK_OPEN_STATUSES.includes(s);
}

/**
 * Countdown of the 48-hour promise. `minutesToDue` comes from the server (negative = overdue); `elteltPerc` is the
 * time since the list was fetched, so the timer ticks without trusting the browser clock.
 * Colours (SPEC §26.3.2): neutral until targetAt (+24 h), amber until dueAt (+48 h), red after.
 */
export function slaAllapot(
  row: { status: CallbackStatus; minutesToDue: number; targetAt: string; dueAt: string },
  elteltPerc = 0,
): { szoveg: string; szin: SlaSzin; perc: number } {
  if (!nyitottVisszahivas(row.status)) return { szoveg: 'lezárva', szin: 'lezart', perc: 0 };
  const perc = Math.round(row.minutesToDue - elteltPerc);
  const savPerc = Math.max(0, (Date.parse(row.dueAt) - Date.parse(row.targetAt)) / 60_000);
  if (perc < 0) {
    const o = -perc;
    const szoveg = o < 60 ? `lejárt ${o} perce` : o < 48 * 60 ? `lejárt ${Math.floor(o / 60)} órája` : `lejárt ${Math.floor(o / 1440)} napja`;
    return { szoveg, szin: 'hiba', perc };
  }
  const szoveg = perc < 60 ? `még ${perc} perc` : `még ${Math.floor(perc / 60)} óra`;
  return { szoveg, szin: perc <= savPerc ? 'figyel' : 'semleges', perc };
}

/** "1/3": failed attempts of the maximum (nem vette fel, foglalt). */
export function kiserletSzoveg(failedAttempts: number): string {
  return `${failedAttempts}/${CALLBACK_RULES.maxFailedAttempts}`;
}

/**
 * Soft block after a failed attempt (SPEC §26.2.3): minutes still to wait before the next call (0 = call now).
 * The API allows an earlier call; the panel only warns.
 */
export function varakozasPerc(utolso: { at: string; outcome: CallbackAttemptOutcome } | null | undefined, mostMs: number): number {
  if (!utolso || !CALLBACK_FAILED_OUTCOMES.includes(utolso.outcome)) return 0;
  // 'most' refreshes only every 15 s, so it can be a little OLDER than the attempt just saved: clamp (review k3c2).
  const eltelt = Math.max(0, (mostMs - Date.parse(utolso.at)) / 60_000);
  return Math.min(CALLBACK_RULES.minMinutesBetweenAttempts, Math.max(0, Math.ceil(CALLBACK_RULES.minMinutesBetweenAttempts - eltelt)));
}

/** Whole minutes since the last failed attempt, for "Legutóbb N perce …" (never negative, never above the wait). */
export function elteltPerc(varni: number): number {
  return Math.max(0, CALLBACK_RULES.minMinutesBetweenAttempts - varni);
}

/** The callback a link opens: ?nyit=<id>, or ?id=<id> from staff notifications and e-mails (review k3c2). */
export function visszahivasLinkId(sp: URLSearchParams): string | null {
  return sp.get('nyit') || sp.get('id') || null;
}

/** "Most hívom" is active for 15 minutes: minutes left, 0 when over. */
export function hivasFolyik(callingNowUntil: string | null | undefined, mostMs: number): number {
  if (!callingNowUntil) return 0;
  return Math.min(CALLBACK_RULES.callingNowMinutes, Math.max(0, Math.ceil((Date.parse(callingNowUntil) - mostMs) / 60_000)));
}

/** tel: link without spaces. */
export function telLink(e164: string): string {
  return `tel:${e164.replace(/[^\d+]/g, '')}`;
}

// ---------- new-business pipeline ----------
/** Board columns in order (SPEC §26.3.3). 'elallt' is shown collapsed under the board. */
export const PIPELINE_OSZLOPOK: { status: RegistrationStatus; cim: string }[] = [
  { status: 'kitoltes', cim: 'Adatokat tölt' },
  { status: 'utmutato', cim: 'Útmutatónál' },
  { status: 'beadva', cim: 'Ellenőrzésre vár' },
  { status: 'javitas', cim: 'Javításra vár' },
  { status: 'ellenorizve', cim: 'Adószámra vár' },
  { status: 'kesz', cim: 'Kész' },
];

/** Amber marker: more than 3 days at the guide without filing, or more than 1 day waiting for our check. */
export function pipelineFigyel(row: { status: RegistrationStatus; daysInStatus: number }): string | null {
  if (row.status === 'utmutato' && row.daysInStatus > 3) return `${row.daysInStatus} napja az útmutatónál`;
  if (row.status === 'beadva' && row.daysInStatus > 1) return `${row.daysInStatus} napja vár ránk`;
  return null;
}

/**
 * The team's deadline for writing the ÖVTJ line of a waiting client (review k3c2): 1 working day (Mon–Fri) after the
 * guide was requested (statusSince of 'utmutato'). Only for open rows that still wait for a code.
 */
export function ovtjHatarido(row: { status: RegistrationStatus; statusSince: string; activityPending?: boolean }, mostMs: number): { hatarido: Date; lejart: boolean } | null {
  if (!row.activityPending || row.status === 'kitoltes' || row.status === 'kesz' || row.status === 'elallt') return null;
  const d = new Date(row.statusSince);
  let napok = ACTIVITY_PENDING_DEADLINE_WORKDAYS;
  while (napok > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const nap = d.getUTCDay();
    if (nap !== 0 && nap !== 6) napok--;
  }
  return { hatarido: d, lejart: mostMs > d.getTime() };
}

/** The Kész column shows the last 30 days only. */
export function keszFriss(row: { status: RegistrationStatus; statusSince: string }, maIso: string): boolean {
  if (row.status !== 'kesz') return true;
  return Date.parse(`${maIso}T12:00:00Z`) - Date.parse(row.statusSince) <= 30 * 86_400_000;
}

export function hanyNapja(n: number): string {
  if (n <= 0) return 'ma';
  if (n === 1) return 'tegnap óta';
  return `${n} napja`;
}

export function indulasSzoveg(plan: StartPlan | null, date: string | null): string {
  if (plan === 'mielobb') return 'mielőbb indulna';
  if (plan === 'datum' && date) return `${datum(date)} körül indulna`;
  return 'még nem mondta, mikor indul';
}

/** Every check item ticked? ("Rendben, ellenőriztem" stays disabled until then.) */
export function hianyzoEllenorzes(items: readonly RegistrationCheckItem[]): RegistrationCheckItem[] {
  return REGISTRATION_CHECK_ITEMS.filter((k) => !items.includes(k));
}

/**
 * Adószám as typed by the team: "12345678-1-23" or "12345678123". Check digit (SPEC §19.1); the middle digit
 * (ÁFA-kód) must be 1 for an alanyi ÁFA-mentes business – otherwise an amber warning, saving is still allowed.
 */
export function adoszamEllenor(bevitel: string): { ertek: string | null; hiba: string | null; figyelmeztetes: string | null } {
  const tiszta = bevitel.replace(/\s/g, '');
  const m = tiszta.match(/^(\d{8})-?(\d)-?(\d{2})$/);
  if (!tiszta) return { ertek: null, hiba: null, figyelmeztetes: null };
  if (!m) return { ertek: null, hiba: 'Így írd: 12345678-1-23.', figyelmeztetes: null };
  if (!torzsszamOk(m[1]!)) return { ertek: null, hiba: 'Ez nem jó adószám: az első 8 számjegy ellenőrző jegye nem stimmel.', figyelmeztetes: null };
  if (!/^[1-5]$/.test(m[2]!)) return { ertek: null, hiba: 'A középső számjegy (ÁFA-kód) 1 és 5 között lehet.', figyelmeztetes: null };
  const ertek = `${m[1]}-${m[2]}-${m[3]}`;
  const figyelmeztetes = m[2] === '1' ? null : `Az ÁFA-kód ${m[2]}, nem 1: ez az adószám nem alanyi ÁFA-mentes vállalkozásé. Kérdezz rá, mielőtt rögzíted.`;
  return { ertek, hiba: null, figyelmeztetes };
}

/** EV nyilvántartási szám: 8 digits (optional field). */
export function nyilvantartasiSzamOk(v: string): boolean {
  return /^\d{8}$/.test(v.trim());
}

// ---------- chat ----------
/** Which side a bubble goes and whose name is written above it ('en' = the viewer). */
export function buborekOldal(m: Pick<Message, 'sender' | 'senderName'>): { sajat: boolean; nev: string | null } {
  if (m.sender === 'en') return { sajat: true, nev: null };
  if (m.sender === 'csapat') return { sajat: true, nev: m.senderName ?? 'Ügyfélszolgálat' };
  if (m.sender === 'konyvelo') return { sajat: true, nev: m.senderName ?? 'Könyvelő' };
  return { sajat: false, nev: null };
}

// ---------- the left menu per role (SPEC §26.3.1) ----------
export type MenuKulcs =
  | 'ugyfelek'
  | 'hatarido'
  | 'keresek'
  | 'visszahivasok'
  | 'helyettunk'
  | 'vallalkozas'
  | 'uzenetek'
  | 'sablonok'
  | 'export'
  | 'naplo'
  | 'beallitasok'
  | 'admin'
  | 'admin_ugyfelek'
  | 'admin_elofizetesek'
  | 'admin_fizetesek'
  | 'admin_konyvelok'
  | 'admin_csapat'
  | 'admin_forrasok'
  | 'admin_szovegek'
  | 'admin_naplo'
  | 'admin_demo'
  | 'admin_rendszer';
export interface MenuElem {
  kulcs: MenuKulcs;
  to: string;
  felirat: string;
  ikon: Icon3dName;
  end?: boolean;
  karakter?: boolean;
}
export interface MenuCsoport {
  cim: string;
  elemek: MenuElem[];
}
const E: Record<MenuKulcs, Omit<MenuElem, 'kulcs'>> = {
  ugyfelek: { to: '/ugyfelek', felirat: 'Ügyfelek', ikon: 'dosszie' },
  hatarido: { to: '/hatarido-figyelo', felirat: 'Határidő-figyelő', ikon: 'hataridok' },
  keresek: { to: '/keresek', felirat: 'Kérések', ikon: 'igazolas' },
  visszahivasok: { to: '/visszahivasok', felirat: 'Visszahívások', ikon: 'ora' },
  // SPEC §27.6.1: the assisted path ("Intézzük helyette"), between Visszahívások and Vállalkozás-indítás.
  helyettunk: { to: '/helyettunk', felirat: 'Intézzük helyette', ikon: 'igazolas' },
  vallalkozas: { to: '/vallalkozas-inditas', felirat: 'Vállalkozás-indítás', ikon: 'bevallas' },
  uzenetek: { to: '/uzenetek', felirat: 'Üzenetek', ikon: 'uzenetek' },
  sablonok: { to: '/sablonok', felirat: 'Válaszsablonok', ikon: 'uzenetek' },
  export: { to: '/export', felirat: 'Export', ikon: 'irat' },
  naplo: { to: '/naplo', felirat: 'Napló', ikon: 'nyugta' },
  beallitasok: { to: '/beallitasok', felirat: 'Beállítások', ikon: 'fiok' },
  admin: { to: '/admin', felirat: 'Áttekintés', ikon: 'fooldal', end: true },
  admin_ugyfelek: { to: '/admin/ugyfelek', felirat: 'Ügyfelek', ikon: 'dosszie' },
  admin_elofizetesek: { to: '/admin/elofizetesek', felirat: 'Előfizetések', ikon: 'szamlak' },
  admin_fizetesek: { to: '/admin/fizetesek', felirat: 'Fizetések', ikon: 'szamlaszam' },
  admin_konyvelok: { to: '/admin/konyvelok', felirat: 'Könyvelők', ikon: 'fiok', karakter: true },
  admin_csapat: { to: '/admin/csapat', felirat: 'Csapat', ikon: 'fiok' },
  admin_forrasok: { to: '/admin/forrasok', felirat: 'Honnan jöttek', ikon: 'fiok' },
  admin_szovegek: { to: '/admin/szovegek', felirat: 'GYIK és szövegek', ikon: 'uzenetek' },
  admin_naplo: { to: '/admin/naplo', felirat: 'Napló', ikon: 'nyugta' },
  admin_demo: { to: '/admin/demo-postafiok', felirat: 'Demo-postafiók', ikon: 'boritek' },
  admin_rendszer: { to: '/admin/rendszer', felirat: 'Rendszer', ikon: 'feltoltes' },
};
const el = (k: MenuKulcs): MenuElem => ({ kulcs: k, ...E[k] });

/**
 * csapat: only Visszahívások, Intézzük helyette, Vállalkozás-indítás, Üzenetek (onboarding clients) and Beállítások.
 * accountant: no Időpontok any more; Visszahívások only when something was ever assigned to him; Intézzük helyette
 * only when one of his clients has (had) an assisted request (SPEC §27.6.1).
 * admin: the owner pages + the three service queues + Csapat.
 */
export function menuCsoportok(o: {
  csapat: boolean;
  konyvelo: boolean;
  admin: boolean;
  demo: boolean;
  konyvelonekVoltVisszahivasa: boolean;
  konyvelonekVoltHelyettunk?: boolean;
}): MenuCsoport[] {
  const out: MenuCsoport[] = [];
  if (o.csapat) {
    out.push({ cim: 'Ügyfélszolgálat', elemek: [el('visszahivasok'), el('helyettunk'), el('vallalkozas'), el('uzenetek')] });
    out.push({ cim: 'Fiók', elemek: [el('beallitasok')] });
    return out;
  }
  if (o.konyvelo) {
    const munka = [el('ugyfelek'), el('hatarido'), el('keresek')];
    if (o.konyvelonekVoltVisszahivasa) munka.push(el('visszahivasok'));
    if (o.konyvelonekVoltHelyettunk) munka.push(el('helyettunk'));
    out.push({ cim: 'Munka', elemek: munka });
    out.push({ cim: 'Eszközök', elemek: [el('sablonok'), el('export'), el('naplo'), el('beallitasok')] });
  }
  if (o.admin) {
    // An admin who is also an accountant already has Visszahívások / Intézzük helyette under Munka.
    const szolg = [el('vallalkozas')];
    if (!(o.konyvelo && o.konyvelonekVoltHelyettunk)) szolg.unshift(el('helyettunk'));
    if (!(o.konyvelo && o.konyvelonekVoltVisszahivasa)) szolg.unshift(el('visszahivasok'));
    out.push({ cim: 'Ügyfélszolgálat', elemek: szolg });
    const admin = [
      el('admin'),
      el('admin_ugyfelek'),
      el('admin_elofizetesek'),
      el('admin_fizetesek'),
      el('admin_konyvelok'),
      el('admin_csapat'),
      el('admin_forrasok'),
      el('admin_szovegek'),
      el('admin_naplo'),
    ];
    if (o.demo) admin.push(el('admin_demo'));
    admin.push(el('admin_rendszer'));
    out.push({ cim: 'Tulajdonos', elemek: admin });
  }
  return out;
}

/** Where a staff member lands after login. */
export function kezdolap(role: string | undefined, konyvelo: boolean): string {
  if (role === 'csapat') return '/visszahivasok';
  if (konyvelo) return '/ugyfelek';
  if (role === 'admin') return '/admin';
  return '/belepes';
}
