// Pure rules of the SPEC §28 / §28.K panel parts (no React, every function has a unit test in k28.test.ts):
// the change data rows, the handbook line, month lists, the reserve tooltip, the allowance preview line, the lock
// chip and the disabled-button text, the fee-setting validation, the check-in queue filters, the annual buttons.
import {
  CHANGE_FORM_TEXTS,
  CHANGE_HANDBOOK,
  FEE_KIND_LABELS,
  LOCK_TEXTS,
  RESERVE_ZONE_STAFF_LABELS,
  ALLOWANCE_PANEL_TEXTS,
} from '../_shared/bekotes';
import {
  CHANGE_UGYSEGED_KINDS,
  FEE_RULES,
  RESPONSE_TIME_FORBIDDEN_PATTERNS,
  SEAT_RIGHT_LABELS,
  WORK_KIND_LABELS,
  type AnnualStatus,
  type AssistKind,
  type CheckinItemStatus,
  type FeeKind,
  type TaxRegime,
} from '../_shared/enums';
import type { AllowancePreview, ChangeData, FeeSettingView, InvoiceReserveView, ServiceLockView, TeamCheckinItem } from '../api/types';
import { datum, szam } from './format';

export const HONAP_ROVID = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);

// ---------- §28.5.5 change data ----------
export interface ValtozasMezo {
  cim: string;
  ertek: string;
  masol: boolean;
  szam?: boolean;
}
/** The NAV form fields of a change, in the form's order (copy button for each typed value). */
export function valtozasMezok(c: ChangeData): ValtozasMezo[] {
  const t = CHANGE_FORM_TEXTS;
  const out: ValtozasMezo[] = [];
  const m = (cim: string, ertek: string | null | undefined, masol = true, szam = false) => {
    if (ertek !== null && ertek !== undefined && ertek !== '') out.push({ cim, ertek, masol, szam });
  };
  if (c.kind === 'valtozas_szekhely' || c.kind === 'valtozas_telephely') {
    m('Ország', 'Magyarország', false);
    m(t.zip, c.address.zip, true, true);
    m(t.city, c.address.city);
    m(t.district, c.address.district ?? null);
    m(t.streetName, c.address.streetName);
    m(t.streetType, c.address.streetType);
    m('Házszám / helyrajzi szám', c.address.houseNumber, true, true);
    m(t.building, c.address.building ?? null);
    m(t.staircase, c.address.staircase ?? null);
    m('Szint', c.address.floor ?? null);
    m(t.door, c.address.door ?? null);
    m('Változás napja', datum(c.effectiveOn, { ev: true }));
    m('Jogcím', SEAT_RIGHT_LABELS[c.right], false);
    if (c.kind === 'valtozas_szekhely') {
      if (c.provider) {
        m(t.providerName, c.provider.name);
        m(t.providerAdoszam, c.provider.adoszam, true, true);
      }
      if (c.alsoHomeAddress) m('Lakcím is', 'Igen, ez a lakcíme is', false);
    } else m('Mi van ott', c.label ?? null, false);
  } else if (c.kind === 'valtozas_tevekenyseg') {
    m('Mi változik', c.mode === 'uj_fo' ? t.activityUjFo : c.mode === 'uj_mellek' ? t.activityUjMellek : t.activityTorles, false);
    for (const a of c.activities) {
      if (a.ovtjKod) m(`ÖVTJ${a.main ? ' (fő)' : ''}`, a.ovtjKod, true, true);
      m(a.ovtjKod ? 'A NAV-os sor' : 'Tevékenység (ÖVTJ-sor kell)', a.ovtjNev ?? a.label, true);
    }
    m('Saját szavaival', c.ownWords ?? null, false);
    if (c.mode === 'uj_fo') m('A régi fő munkája', c.keepOldMain ? 'megtartja egyéb tevékenységként' : 'befejezi', false);
    m('Adatváltozás ideje', datum(c.effectiveOn, { ev: true }));
  } else if (c.kind === 'valtozas_szuneteltetes') {
    m('A szüneteltetés kezdő napja', datum(c.from, { ev: true }));
    m('Vége', c.to ? datum(c.to, { ev: true }) : 'nincs megadva', !!c.to);
  } else if (c.kind === 'valtozas_folytatas') {
    m('Az újrakezdés napja', datum(c.from, { ev: true }));
  } else {
    m('Mi változik', c.items.map((i) => t.adoadatItems[i]).join(', '), false);
    m('Munkavégzés jellege', c.workKind ? WORK_KIND_LABELS[c.workKind] : null, false);
    m('Mikortól', datum(c.effectiveOn, { ev: true }));
    m('Megjegyzés', c.note ?? null, false);
  }
  return out;
}
/** CHANGE_HANDBOOK line per kind. */
export function kezikonyvSzoveg(kind: AssistKind): string {
  if (kind === 'valtozas_szuneteltetes') return CHANGE_HANDBOOK.szunetel;
  if (kind === 'valtozas_folytatas') return CHANGE_HANDBOOK.folytatas;
  if ((CHANGE_UGYSEGED_KINDS as readonly string[]).includes(kind)) return CHANGE_HANDBOOK.ugyseged;
  return CHANGE_HANDBOOK.t101e;
}

// ---------- months ----------
/** "január–december", "június–december", "márc., jún., szept." */
export function honapokSzoveg(ms: readonly number[]): string {
  const s = [...new Set(ms)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!s.length) return 'egy hónap sincs';
  if (s.length === 1) return HONAP[s[0]! - 1]!;
  const folytonos = s.every((m, i) => i === 0 || m === s[i - 1]! + 1);
  if (folytonos) return `${HONAP[s[0]! - 1]}–${HONAP[s[s.length - 1]! - 1]}`;
  return s.map((m) => HONAP_ROVID[m - 1]).join(', ');
}
/** Toggle one month in a sorted list. */
export function honapValt(ms: readonly number[], m: number): number[] {
  return ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m].sort((a, b) => a - b);
}
/** Which quarters the months touch ("Q1–Q4" style for the effect line). */
export function negyedevek(ms: readonly number[]): number[] {
  return [...new Set(ms.map((m) => Math.floor((m - 1) / 3) + 1))].sort();
}

// ---------- §28.1.9 reserve column ----------
/** Tooltip of the "Félretenni" column: parts + zone in staff words. */
export function felreteszTipp(r: InvoiceReserveView): string {
  const reszek = [`SZJA ${szam(r.parts.szjaHuf)} Ft`, `TB ${szam(r.parts.tbHuf)} Ft`, `szocho ${szam(r.parts.szochoHuf)} Ft`].join(' · ');
  const extra = [r.crossesTaxFree ? 'ezzel fogyott el az adómentes rész' : null, r.estimated ? 'fizetési határidővel számolva' : null].filter(Boolean).join(', ');
  return `${RESERVE_ZONE_STAFF_LABELS[r.zone]}: ${reszek} (nyers ${szam(r.rawHuf)} Ft)${extra ? ` – ${extra}` : ''}`;
}
/** The column value: "—" for nincs_adat, signed for storno. */
export function felreteszErtek(r: InvoiceReserveView | null | undefined): string {
  if (!r || r.zone === 'nincs_adat') return '—';
  if (r.reserveHuf === 0) return '0 Ft';
  return `${r.reserveHuf < 0 ? '−' : ''}${szam(Math.abs(r.reserveHuf))} Ft`;
}

// ---------- §28.3.6 allowance preview ----------
/** "Idei hatás (becslés): SZJA −x Ft · TB −y Ft (családi járulékkedvezmény) · Szocho változatlan." (+ the unused line) */
export function elonezetSorok(p: AllowancePreview): { fo: string; fel: string | null } {
  const x = Math.max(0, p.without.szjaHuf - p.with.szjaHuf);
  const y = Math.max(0, p.without.tbHuf - p.with.tbHuf);
  return {
    fo: fill(ALLOWANCE_PANEL_TEXTS.preview, { x: szam(x), y: szam(y) }),
    fel: p.csaladiUnusedHuf > 0 ? fill(ALLOWANCE_PANEL_TEXTS.previewUnused, { u: szam(p.csaladiUnusedHuf), c: szam(p.annualCsjkPotentialHuf) }) : null,
  };
}
/** The effect on one quarter: the share of the year's saving that falls into the quarter's months (estimate). */
export function negyedevHatas(p: AllowancePreview, months: readonly number[], q: number): number {
  const ossz = Math.max(0, p.without.szjaHuf - p.with.szjaHuf) + Math.max(0, p.without.tbHuf - p.with.tbHuf);
  if (!months.length) return 0;
  const benne = months.filter((m) => Math.floor((m - 1) / 3) + 1 === q).length;
  return Math.round((ossz * benne) / months.length);
}

// ---------- §28.K.5 service lock ----------
/** The red chip of the list and the client page: "Zárolva: díj elmaradt (nov. 2. óta, 19 999 Ft)". */
export function zarolasCimke(l: ServiceLockView): string {
  return fill(LOCK_TEXTS.panelChip, { since: datum(l.since), osszeg: szam(l.amountHuf) });
}
/** The hover / under-button text of every locked staff action (null = not locked). */
export function zaroltMiert(l: ServiceLockView | null | undefined): string | null {
  return l ? LOCK_TEXTS.panelDisabled : null;
}

// ---------- §28.K.1 fee settings ----------
/**
 * Client-side check of a fee edit (the server checks again): whole forints 0…1 000 000; a rise of a monthly plan fee
 * needs an effective date ≥ today + FEE_RULES.priceRiseNoticeDays. Returns field errors (empty = OK).
 */
export function dijHibak(f: Pick<FeeSettingView, 'kind' | 'amountHuf'>, ujOsszeg: string, hatalyos: string, ma: string): { amountHuf?: string; effectiveFrom?: string } {
  const h: { amountHuf?: string; effectiveFrom?: string } = {};
  const n = Number(ujOsszeg.replace(/\s/g, ''));
  if (!ujOsszeg.trim() || !Number.isInteger(n) || n < 0 || n > 1_000_000) {
    h.amountHuf = 'Egész forintösszeg kell, 0 és 1 000 000 között.';
    return h;
  }
  const havi = f.kind === 'havidij' || f.kind === 'havidij_kata';
  if (havi && n > f.amountHuf) {
    const minNap = napPlusz(ma, FEE_RULES.priceRiseNoticeDays);
    if (!hatalyos) h.effectiveFrom = `Áremelésnél kötelező: legkorábban ${datum(minNap, { ev: true })}.`;
    else if (hatalyos < minNap) h.effectiveFrom = `Legalább ${FEE_RULES.priceRiseNoticeDays} nappal későbbi nap kell (legkorábban ${datum(minNap, { ev: true })}).`;
  }
  return h;
}
export function napPlusz(d: string, n: number): string {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** "4 999 Ft / alkalom" */
export function dijSzoveg(amountHuf: number, unit: 'ho' | 'ev' | 'alkalom'): string {
  return `${szam(amountHuf)} Ft ${unit === 'ho' ? '/ hó' : unit === 'ev' ? '/ év' : '/ alkalom'}`;
}
export function dijNev(kind: FeeKind): string {
  return FEE_KIND_LABELS[kind];
}

// ---------- §28.K.2 check-in queue ----------
export type HaviSzuro = 'nalam' | 'nyitott' | 'dijra_var' | 'ugyfelnel' | 'kesz' | 'mind';
export const HAVI_SZUROK: { k: HaviSzuro; felirat: string }[] = [
  { k: 'nalam', felirat: 'Rád vár' },
  { k: 'nyitott', felirat: 'Nyitott' },
  { k: 'dijra_var', felirat: 'Díjra vár' },
  { k: 'ugyfelnel', felirat: 'Ügyfélnél' },
  { k: 'kesz', felirat: 'Lezárt' },
  { k: 'mind', felirat: 'Mind' },
];
const LEZART: readonly CheckinItemStatus[] = ['kesz', 'nem_kell'];
export function haviIlleszkedik(i: Pick<TeamCheckinItem, 'status' | 'ball'>, f: HaviSzuro, szerep: 'konyvelo' | 'admin' | 'csapat'): boolean {
  const nyitott = !LEZART.includes(i.status);
  switch (f) {
    case 'nalam':
      return nyitott && (szerep === 'csapat' ? i.ball === 'csapat' : i.ball === 'konyvelo' || (szerep === 'admin' && i.ball === 'csapat'));
    case 'nyitott':
      return nyitott;
    case 'dijra_var':
      return i.status === 'dijra_var';
    case 'ugyfelnel':
      return nyitott && i.ball === 'ugyfel';
    case 'kesz':
      return !nyitott;
    default:
      return true;
  }
}

// ---------- §28.K.3 annual closing ----------
/** Which filing buttons the panel shows for a status (the server checks again). */
export function evesGombok(s: AnnualStatus, regime: TaxRegime): { tervezet: boolean; szja: boolean; hipa: boolean; szjaFelirat: string } {
  return {
    tervezet: s === 'konyvelonel' || s === 'jovahagyasra_var',
    szja: s === 'jovahagyasra_var' || s === 'konyvelonel',
    hipa: s === 'beadva',
    szjaFelirat: regime === 'kata' ? 'Beadtam a kata-nyilatkozatot' : 'Beadtam az SZJA-bevallást',
  };
}

// ---------- §28.K.15 response time ----------
/** True when a text promises an answer time ("4 órán belül", "nincs buta kérdés" …) – the settings field refuses it. */
export function valaszidoTilos(szoveg: string): boolean {
  return RESPONSE_TIME_FORBIDDEN_PATTERNS.some((p) => new RegExp(p, 'iu').test(szoveg));
}
