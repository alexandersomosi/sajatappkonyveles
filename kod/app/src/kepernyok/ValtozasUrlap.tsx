// SPEC §28.5.6 – a változás adatai az appban, egy mezőcsoport egy képernyőn (C űrlap). A „Bejelentjük helyetted” kérés és
// a havi ellenőrzés („Változott valami?”) ugyanezt használja. Az adatokat Bence a NAV mezői szerint, mezőnként másolja.
import { View } from 'react-native';
import type { ChangeData, NavAddress } from '@/_shared/api';
import { CHANGE_FORM_TEXTS as F } from '@/_shared/bekotes';
import { CHANGE_RULES, SEAT_RIGHT_LABELS, SEAT_RIGHTS, STREET_TYPES, WORK_KIND_LABELS, WORK_KINDS, type ChangeKind, type ChangeTaxItem, type SeatRight, type WorkKind } from '@/_shared/enums';
import { datumBe, napHozzaad } from '@/lib/format';
import { Kapszulak } from '@/kepernyok/Urlap';
import { Mezo } from '@/ui/Mezo';

export interface VAdat {
  zip: string; city: string; district: string; streetName: string; streetType: string; houseNumber: string; building: string; floor: string; door: string;
  effectiveOn: string; right: SeatRight | null; providerName: string; providerAdoszam: string;
  mode: 'uj_fo' | 'uj_mellek' | 'torles' | null; ownWords: string;
  from: string; to: string;
  items: ChangeTaxItem[]; workKind: WorkKind | null; note: string;
}
export const URES_VADAT: VAdat = {
  zip: '', city: '', district: '', streetName: '', streetType: '', houseNumber: '', building: '', floor: '', door: '',
  effectiveOn: '', right: null, providerName: '', providerAdoszam: '', mode: null, ownWords: '', from: '', to: '', items: [], workKind: null, note: '',
};

export type VLap = 'cim' | 'datum' | 'jogcim' | 'mod' | 'tevekenyseg' | 'szunet' | 'folytatas' | 'tetelek' | 'munka';

export function valtozasLapok(kind: ChangeKind, a: VAdat): VLap[] {
  switch (kind) {
    case 'valtozas_szekhely':
    case 'valtozas_telephely':
      return ['cim', 'datum', 'jogcim'];
    case 'valtozas_tevekenyseg':
      return ['mod', 'tevekenyseg', 'datum'];
    case 'valtozas_szuneteltetes':
      return ['szunet'];
    case 'valtozas_folytatas':
      return ['folytatas'];
    case 'valtozas_adoadat':
      return a.items.includes('munkavegzes') ? ['tetelek', 'munka', 'datum'] : ['tetelek', 'datum'];
  }
}

export function lapCim(kind: ChangeKind, lap: VLap): string {
  switch (lap) {
    case 'cim':
      return kind === 'valtozas_telephely' ? F.addressTelephely : F.addressSzekhely;
    case 'datum':
      return F.dateTitle;
    case 'jogcim':
      return F.rightTitle;
    case 'mod':
      return F.activityTitle;
    case 'tevekenyseg':
      return 'Mi lesz az új munkád?';
    case 'szunet':
      return F.szunetelFrom;
    case 'folytatas':
      return F.folytatasFrom;
    case 'tetelek':
      return F.adoadatTitle;
    case 'munka':
      return F.workKindTitle;
  }
}

const datumRe = /^\d{4}-\d{2}-\d{2}$/;
/** Mezőszintű ellenőrzés (SPEC §28.5.6 üzenetei). */
export function valtozasEllenoriz(kind: ChangeKind, lap: VLap, a: VAdat, ma: string): string | null {
  const v = F.validation;
  if (lap === 'cim') {
    if (!/^\d{4}$/.test(a.zip)) return v.zip;
    if (!a.city.trim()) return v.city;
    if (!a.streetName.trim()) return v.streetName;
    if (!a.streetType) return v.streetType;
    if (!a.houseNumber.trim()) return v.houseNumber;
  }
  if (lap === 'datum' && !datumRe.test(a.effectiveOn)) return 'Írd be a dátumot így: 2026.12.01.';
  if (lap === 'jogcim' && !a.right) return 'Válaszd ki, milyen jogon használod.';
  if (lap === 'mod' && !a.mode) return v.items;
  if (lap === 'tevekenyseg' && !a.ownWords.trim()) return v.activity;
  if (lap === 'szunet') {
    if (!datumRe.test(a.from)) return 'Írd be a dátumot így: 2026.12.01.';
    if (a.from < ma) return v.szunetelPast;
    if (a.from > napHozzaad(ma, CHANGE_RULES.szunetelStartMaxAheadDays)) return `Legfeljebb ${CHANGE_RULES.szunetelStartMaxAheadDays} nappal előre jelentheted be.`;
    if (a.to && (!datumRe.test(a.to) || a.to > napHozzaad(a.from, 365 * CHANGE_RULES.szunetelMaxYears))) return v.szunetelMax;
  }
  if (lap === 'folytatas') {
    if (!datumRe.test(a.from)) return 'Írd be a dátumot így: 2026.12.01.';
    if (a.from < ma) return v.folytatasPast;
  }
  if (lap === 'tetelek' && !a.items.length) return v.items;
  if (lap === 'munka' && !a.workKind) return 'Válaszd ki, mellette hogyan dolgozol.';
  void kind;
  return null;
}

function cim(a: VAdat): NavAddress {
  return {
    zip: a.zip.trim(), city: a.city.trim(), district: a.district.trim() || null, streetName: a.streetName.trim(), streetType: a.streetType, houseNumber: a.houseNumber.trim(),
    building: a.building.trim() || null, floor: a.floor.trim() || null, door: a.door.trim() || null,
  };
}

/** Az űrlap állapotából a szerver ChangeData-ja. */
export function valtozasAdat(kind: ChangeKind, a: VAdat): ChangeData {
  switch (kind) {
    case 'valtozas_szekhely':
      return { kind, address: cim(a), effectiveOn: a.effectiveOn, right: a.right ?? 'tulajdon', provider: a.right === 'szekhelyszolgaltatasi_szerzodes' ? { name: a.providerName, adoszam: a.providerAdoszam } : null, alsoHomeAddress: false };
    case 'valtozas_telephely':
      return { kind, address: cim(a), effectiveOn: a.effectiveOn, right: a.right ?? 'tulajdon', label: null };
    case 'valtozas_tevekenyseg':
      return { kind, mode: a.mode ?? 'uj_mellek', activities: [{ key: null, label: a.ownWords.trim(), main: a.mode === 'uj_fo', ovtjKod: null, navKereso: null }], ownWords: a.ownWords.trim(), keepOldMain: a.mode !== 'uj_fo', effectiveOn: a.effectiveOn };
    case 'valtozas_szuneteltetes':
      return { kind, from: a.from, to: a.to || null };
    case 'valtozas_folytatas':
      return { kind, from: a.from };
    case 'valtozas_adoadat':
      return { kind, items: a.items, workKind: a.items.includes('munkavegzes') ? a.workKind : null, effectiveOn: a.effectiveOn, note: a.note.trim() || null };
  }
}

/** Visszafelé: egy meglévő kérés adataiból az űrlap („Módosítom”). */
export function vadatBol(c: ChangeData | null | undefined): VAdat {
  if (!c) return URES_VADAT;
  const x: VAdat = { ...URES_VADAT };
  if ('address' in c) Object.assign(x, { zip: c.address.zip, city: c.address.city, district: c.address.district ?? '', streetName: c.address.streetName, streetType: c.address.streetType, houseNumber: c.address.houseNumber, building: c.address.building ?? '', floor: c.address.floor ?? '', door: c.address.door ?? '' });
  if ('effectiveOn' in c) x.effectiveOn = c.effectiveOn;
  if ('right' in c) x.right = c.right;
  if (c.kind === 'valtozas_tevekenyseg') Object.assign(x, { mode: c.mode, ownWords: c.ownWords ?? c.activities[0]?.label ?? '' });
  if (c.kind === 'valtozas_szuneteltetes') Object.assign(x, { from: c.from, to: c.to ?? '' });
  if (c.kind === 'valtozas_folytatas') x.from = c.from;
  if (c.kind === 'valtozas_adoadat') Object.assign(x, { items: c.items, workKind: c.workKind ?? null, note: c.note ?? '' });
  return x;
}

/** Összegző sorok („Ezt jelentjük be”). */
export function valtozasSorok(kind: ChangeKind, a: VAdat): string[] {
  const c = cim(a);
  const tobbi = [c.building, c.floor, c.door].filter(Boolean).join(', ');
  switch (kind) {
    case 'valtozas_szekhely':
    case 'valtozas_telephely':
      return [`${c.zip} ${c.city}${c.district ? `, ${c.district} kerület` : ''}`, `${c.streetName} ${c.streetType} ${c.houseNumber}.${tobbi ? ` ${tobbi}` : ''}`, `Mikortól: ${a.effectiveOn}`, `Jogcím: ${a.right ? SEAT_RIGHT_LABELS[a.right] : '–'}`];
    case 'valtozas_tevekenyseg':
      return [a.mode === 'uj_fo' ? F.activityUjFo : a.mode === 'torles' ? F.activityTorles : F.activityUjMellek, a.ownWords, `Mikortól: ${a.effectiveOn}`];
    case 'valtozas_szuneteltetes':
      return [`Szünetelés kezdete: ${a.from}`, a.to ? `Vége: ${a.to}` : 'Vége: még nem tudom'];
    case 'valtozas_folytatas':
      return [`Újrakezdés: ${a.from}`];
    case 'valtozas_adoadat':
      return [...a.items.map((i) => F.adoadatItems[i]), ...(a.workKind ? [WORK_KIND_LABELS[a.workKind]] : []), `Mikortól: ${a.effectiveOn}`];
  }
}

/** Egy lap mezői. */
export function ValtozasLap({ kind, lap, a, set }: { kind: ChangeKind; lap: VLap; a: VAdat; set: (x: Partial<VAdat>) => void }) {
  if (lap === 'cim') {
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Mezo felirat={F.zip} keyboardType="number-pad" maxLength={4} value={a.zip} onChangeText={(t) => set({ zip: t.replace(/\D/g, '') })} style={{ width: 120 }} />
          <Mezo felirat={F.city} value={a.city} onChangeText={(t) => set({ city: t })} style={{ flex: 1 }} />
        </View>
        <Mezo felirat={F.streetName} value={a.streetName} onChangeText={(t) => set({ streetName: t })} />
        <Kapszulak elemek={STREET_TYPES.slice(0, 8).map((k) => ({ kulcs: k, cim: k }))} ertek={a.streetType || null} valt={(k) => set({ streetType: k })} />
        <Mezo felirat={F.houseNumber} value={a.houseNumber} onChangeText={(t) => set({ houseNumber: t })} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Mezo felirat={F.building} value={a.building} onChangeText={(t) => set({ building: t })} style={{ flex: 1 }} />
          <Mezo felirat={F.floor} value={a.floor} onChangeText={(t) => set({ floor: t })} style={{ flex: 1 }} />
          <Mezo felirat={F.door} value={a.door} onChangeText={(t) => set({ door: t })} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }
  if (lap === 'datum') {
    return <Mezo felirat={kind === 'valtozas_telephely' ? F.dateHintTelephely : kind === 'valtozas_szekhely' ? F.dateHintSzekhely : 'A változás napja'} placeholder="2026.12.01." keyboardType="numbers-and-punctuation" value={a.effectiveOn} onChangeText={(t) => set({ effectiveOn: datumBe(t) })} />;
  }
  if (lap === 'jogcim') {
    return (
      <View style={{ gap: 12 }}>
        <Kapszulak oszlop elemek={SEAT_RIGHTS.map((k) => ({ kulcs: k, cim: SEAT_RIGHT_LABELS[k] }))} ertek={a.right} valt={(k) => set({ right: k })} />
        {a.right === 'szekhelyszolgaltatasi_szerzodes' ? (
          <>
            <Mezo felirat={F.providerName} value={a.providerName} onChangeText={(t) => set({ providerName: t })} />
            <Mezo felirat={F.providerAdoszam} value={a.providerAdoszam} onChangeText={(t) => set({ providerAdoszam: t })} />
          </>
        ) : null}
      </View>
    );
  }
  if (lap === 'mod') {
    return (
      <Kapszulak
        oszlop
        elemek={[
          { kulcs: 'uj_fo', cim: F.activityUjFo },
          { kulcs: 'uj_mellek', cim: F.activityUjMellek },
          { kulcs: 'torles', cim: F.activityTorles },
        ]}
        ertek={a.mode}
        valt={(k) => set({ mode: k as VAdat['mode'] })}
      />
    );
  }
  if (lap === 'tevekenyseg') {
    return <Mezo felirat={F.activityOwnWords} multiline value={a.ownWords} onChangeText={(t) => set({ ownWords: t.slice(0, 300) })} sugo="A hivatalos ÖVTJ-sort mi írjuk meg hozzá, általában 1 munkanapon belül." />;
  }
  if (lap === 'szunet') {
    return (
      <View style={{ gap: 12 }}>
        <Mezo felirat="Kezdőnap" placeholder="2026.12.01." keyboardType="numbers-and-punctuation" value={a.from} onChangeText={(t) => set({ from: datumBe(t) })} />
        <Mezo felirat={F.szunetelTo} placeholder="2027.06.30." keyboardType="numbers-and-punctuation" value={a.to} onChangeText={(t) => set({ to: datumBe(t) })} />
      </View>
    );
  }
  if (lap === 'folytatas') return <Mezo felirat="Az újrakezdés napja" placeholder="2026.12.01." keyboardType="numbers-and-punctuation" value={a.from} onChangeText={(t) => set({ from: datumBe(t) })} />;
  if (lap === 'tetelek') {
    return (
      <Kapszulak
        oszlop
        tobb
        elemek={(['munkavegzes', 'nyugdijba_vonulas', 'kozossegi_adoszam', 'atalany_kilepes', 'afa_kilepes', 'egyeb'] as ChangeTaxItem[]).map((k) => ({ kulcs: k, cim: F.adoadatItems[k] }))}
        ertek={a.items}
        valt={(k) => set({ items: a.items.includes(k) ? a.items.filter((x) => x !== k) : [...a.items, k] })}
      />
    );
  }
  return <Kapszulak oszlop elemek={WORK_KINDS.map((k) => ({ kulcs: k, cim: WORK_KIND_LABELS[k] }))} ertek={a.workKind} valt={(k) => set({ workKind: k })} />;
}
