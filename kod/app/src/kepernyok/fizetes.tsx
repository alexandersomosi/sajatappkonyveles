// A befizetés körüli alsó lapok: „Hogyan jött ki?” (07), „Számlaszámok” (nincs megrajzolva, ugyanazon a nyelven),
// „Már befizettem” (08: tételek + dátum → pecsét leüt).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import { mozgasKi } from '../lib/mozgas';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { AccountantPublic, Explanation, PaymentItem, TaxPeriodDetail } from '../_shared/api';
import { ApiHiba } from '../api/http';
import { useBefizettem, useHataridok } from '../api/hooks';
import { datum, datumAn, datumE, datumIg, datumRovid, forint, ido, mindTargy, nagybetu, napHozzaad, negyedevNev, neveloSzam, reszek, szam } from '../lib/format';
import { MASOLAS_HIBA, vagolapra } from '../lib/vagolap';
import { datumHiba, datumNormal } from '../lib/validators';

/** ÉÉÉÉ-HH-NN + n hónap (a nap marad; a negyedéves határidők mind 12-e). */
function honapHozzaad(nap: string, n: number): string {
  const [e, h, d] = nap.split('-').map(Number) as [number, number, number];
  const x = new Date(Date.UTC(e, h - 1 + n, d));
  return x.toISOString().slice(0, 10);
}
import { forma, szin } from '../theme/tokens';
import { Cimke, GombE, GombM, GombSz, HibaSzoveg, Osszeg, Pipa } from '../ui/alap';
import { ma } from '../ui/ido';
import { Arckep, Ikon3d, KeszJel } from '../ui/kepek';
import { AlsoLap, useJelzes } from '../ui/keret';
import { Mezo } from '../ui/Mezo';
import { T } from '../ui/T';
import { hibaUzenet } from '../lib/hiba';

const HONAP_TOL_IG: Record<string, string> = { Q1: 'január–március', Q2: 'április–június', Q3: 'július–szeptember', Q4: 'október–december' };

// ---------- 07 Hogyan jött ki? ----------
type MSor = Explanation['lines'][number] & { kind?: 'cim' | 'sor' | 'ado' | 'megjegyzes'; side?: string };

/** A könyvelő kézi módosításának jelzősora a szerver bontásában (services/tax.ts periodDetail). */
const MODOSITAS_SOR = /módosította az összeget/i;
/** Melyik befizetési tételhez tartozik az adó-sor (az ado-motor címkéiből). */
function adoFajta(cimke: string): PaymentItem['kind'] | null {
  if (/^TB-járulék/i.test(cimke)) return 'tb_jarulek';
  if (/^Szocho/i.test(cimke)) return 'szocho';
  if (/^SZJA-előleg/i.test(cimke)) return 'szja_eloleg';
  return null;
}

/** `uj`: a könyvelő kézzel módosított összege – a számított összeg áthúzva marad előtte, hogy a sorok összeadódjanak. */
function AdoSor({ l, elso, uj }: { l: MSor; elso: boolean; uj?: number }) {
  const modositva = uj !== undefined && l.amountHuf !== undefined && uj !== l.amountHuf;
  return (
    <View style={{ backgroundColor: '#F2F4F8', borderRadius: 6, paddingVertical: 8, paddingRight: 10, paddingLeft: 24, marginTop: elso ? 4 : 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <T m={15.5} s={l.op === '=' ? 650 : 400} lh={1.35} style={{ flexShrink: 1 }}>
          {l.label}
        </T>
        {modositva ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }} accessibilityLabel={`A számítás szerint ${szam(l.amountHuf ?? 0)} forint, a könyvelőd módosította: ${szam(uj ?? 0)} forint`}>
            <T m={14} c={szin.halvany} szam style={{ textDecorationLine: 'line-through' }}>
              {szam(l.amountHuf ?? 0)}
            </T>
            <Osszeg szoveg={szam(uj ?? 0)} m={16.5} s={700} />
          </View>
        ) : l.amountHuf !== undefined ? (
          <Osszeg szoveg={szam(l.amountHuf)} m={16.5} s={700} />
        ) : null}
      </View>
      {modositva ? (
        <T m={13.5} s={600} c={szin.borostyanSzoveg} lh={1.4} style={{ marginTop: 1 }}>
          A könyvelőd módosította.
        </T>
      ) : null}
      {l.note ? (
        <T m={13.5} c={szin.halvany} lh={1.4} style={{ marginTop: 1 }}>
          {l.note}
        </T>
      ) : null}
    </View>
  );
}

function SzamSor({ l }: { l: MSor }) {
  return (
    <View style={[{ paddingVertical: 4 }, l.op === '=' && { borderTopWidth: 1.5, borderTopColor: szin.tinta, marginTop: 4, paddingTop: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T m={15.5} s={600} c={szin.halvany} style={{ width: 18, textAlign: 'center' }}>
          {l.op ?? ''}
        </T>
        <T m={15.5} s={l.op === '=' ? 700 : 400} lh={1.35} style={{ flex: 1 }}>
          {l.label}
        </T>
        {l.amountHuf !== undefined ? <Osszeg szoveg={szam(l.amountHuf)} m={15.5} s={l.op === '=' ? 700 : 600} /> : null}
      </View>
      {l.note ? (
        <T m={13.5} c={szin.halvany} lh={1.4} style={{ marginLeft: 24, marginTop: 1 }}>
          {l.note}
        </T>
      ) : null}
    </View>
  );
}

/** A „Hogyan jött ki?” sorai. Az ado-motor `kind` mezője szerint (cim / sor / ado / megjegyzes, SPEC §24);
 *  ha nincs `kind`, az op és a sorrend alapján. */
export function MagyarazatSor({ e, tetelek }: { e: Explanation; tetelek?: PaymentItem[] }) {
  const sorok = e.lines as MSor[];
  const vanKind = sorok.some((l) => l.kind);
  // Kézi módosítás (a könyvelő jóváhagyáskor átírta az összeget): az adó-sorok a végleges tétellel együtt látszanak.
  const modositott = !!tetelek?.length && sorok.some((l) => l.amountHuf === undefined && MODOSITAS_SOR.test(l.label));
  const vegleges = (cimke: string): number | undefined => {
    if (!modositott) return undefined;
    const k = adoFajta(cimke);
    return k ? (tetelek?.find((t) => t.kind === k)?.amountHuf ?? 0) : undefined;
  };
  let egyenlo = false;
  return (
    <View style={{ marginTop: vanKind ? 4 : 14 }}>
      {sorok.map((l, i) => {
        if (l.amountHuf === undefined && MODOSITAS_SOR.test(l.label))
          return (
            <View key={i} style={{ marginTop: 10, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, paddingVertical: 10, paddingHorizontal: 12 }}>
              <T m={14.5} s={600} c={szin.borostyanSzoveg} lh={1.45}>
                {`A könyvelőd kézzel módosította az összeget${l.note ? `: „${l.note.trim().replace(/[.]$/, '')}”.` : '.'}`}
              </T>
              {modositott ? (
                <T m={13.5} c={szin.borostyanSzoveg} lh={1.45} style={{ marginTop: 2 }}>
                  Az áthúzott szám a számítás, mellette az, amit fizetned kell.
                </T>
              ) : null}
            </View>
          );
        if (vanKind) {
          if (l.kind === 'cim')
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: i ? 16 : 10, marginBottom: 4 }}>
                <T m={15.5} s={650} style={{ flexShrink: 1 }}>
                  {l.label}
                </T>
                {l.side ? (
                  <T m={14} c={szin.halvany}>
                    {l.side}
                  </T>
                ) : null}
              </View>
            );
          if (l.kind === 'ado') return <AdoSor key={i} l={l} elso={sorok[i - 1]?.kind !== 'ado'} uj={vegleges(l.label)} />;
          if (l.kind === 'megjegyzes' || l.amountHuf === undefined)
            return (
              <T key={i} m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
                {l.label}
              </T>
            );
          return <SzamSor key={i} l={l} />;
        }
        if (l.op === '=') egyenlo = true;
        if (l.amountHuf === undefined)
          return (
            <T key={i} m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 8, marginBottom: 2 }}>
              {l.label}
            </T>
          );
        if (egyenlo && !l.op) return <AdoSor key={i} l={l} elso={i > 0} uj={vegleges(l.label)} />;
        return <SzamSor key={i} l={l} />;
      })}
    </View>
  );
}

export function HogyanJottKi({ lathato, bezar, idoszak, konyvelo }: { lathato: boolean; bezar: () => void; idoszak: TaxPeriodDetail | undefined; konyvelo: AccountantPublic }) {
  const e = idoszak?.explanation;
  const q = idoszak?.periodKey.slice(-2) ?? '';
  const becsles = idoszak?.calcStatus !== 'jovahagyva';
  // Az „Összesen” és a „Bence számolta · Kérdezek róla” sor rögzített lábléc: a hosszú (2026-os) bontásnál is
  // ezek zárják a lapot, mint a jóváhagyott 07-en.
  const lab = (
    <>
      {e ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10 }}>
              <T m={16} s={650}>
                {becsles ? 'Eddig összesen' : 'Összesen'}
              </T>
              <T m={30} s={800} ls={-0.03} szam>
                {szam(idoszak?.totalHuf ?? 0)}
                <T m={15} s={600} c={szin.halvany}>
                  {' Ft'}
                </T>
              </T>
            </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: e ? 8 : 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <Arckep pt={34} gyuru />
          <T m={14} c={szin.halvany} lh={1.35} style={{ flexShrink: 1 }}>
            {becsles ? `${konyvelo.firstName} a negyedév végén véglegesíti.` : `${konyvelo.firstName} számolta${idoszak?.letter ? `,\n${datum(idoszak.letter.date)}` : '.'}`}
          </T>
        </View>
        <GombM
          cim="Kérdezek róla"
          ikon="kerdezek"
          magas={52}
          onPress={() => {
            bezar();
            router.push({ pathname: '/uzenetek', params: { kerdes: `${idoszak ? negyedevNev(idoszak.periodKey) : 'A befizetendő'}: ` } });
          }}
        />
      </View>
    </>
  );
  return (
    <AlsoLap lathato={lathato} bezar={bezar} lab={lab}>
      <T m={24} s={700} lh={1.2} ls={-0.02} style={{ paddingRight: 84 }} accessibilityRole="header">
        Hogyan jött ki {idoszak?.totalHuf != null ? `${neveloSzam(idoszak.totalHuf)} ${forint(idoszak.totalHuf)}` : 'az összeg'}?
      </T>
      {e ? (
        <>
          <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
            {e.intro}
          </T>
          {(e.lines as { kind?: string }[]).some((l) => l.kind) ? null : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 14 }}>
              <T m={15.5} s={650}>
                {idoszak ? negyedevNev(idoszak.periodKey) : ''}
              </T>
              <T m={14} c={szin.halvany}>
                {HONAP_TOL_IG[q] ?? ''}
              </T>
            </View>
          )}
          <MagyarazatSor e={e} tetelek={idoszak?.items} />
          {idoszak?.disclaimer ? (
            <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 10, marginBottom: 6 }}>
              {idoszak.disclaimer}
            </T>
          ) : null}
        </>
      ) : (
        <T m={15.5} c={szin.halvany} lh={1.5} style={{ marginTop: 8 }}>
          A részletes számítás akkor látszik, amikor {konyvelo.firstName} kiszámolta a negyedévet.
        </T>
      )}
    </AlsoLap>
  );
}

// ---------- Számlaszámok ----------
function MasolGomb({ ertek, mit, tetel }: { ertek: string; mit: string; tetel?: string }) {
  const jelez = useJelzes();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tetel ? `${tetel}: ${mit} másolása` : `${mit} másolása`}
      onPress={async () => {
        // Csak akkor „Kimásoltad”, ha tényleg a vágólapon van: különben a banki appba a korábbi tartalom kerülne.
        if (!(await vagolapra(ertek))) return jelez(MASOLAS_HIBA);
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        jelez({ szoveg: `Kimásoltad: ${mit}`, kesz: true });
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 13, borderRadius: forma.gomb, backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap })}
    >
      <T m={14.5} s={650} c={szin.tintakekSzoveg}>
        Kimásolom
      </T>
    </Pressable>
  );
}
function Adat({ cim, ertek, masol, mit, kicsi, tetel }: { cim: string; ertek: string; masol?: boolean; mit?: string; kicsi?: string; tetel?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: szin.hajszal }}>
      <View style={{ flex: 1 }}>
        <T m={13.5} c={szin.halvany} lh={1.3}>
          {cim}
        </T>
        <T m={16.5} s={600} lh={1.35} szam selectable>
          {ertek}
        </T>
        {kicsi ? (
          <T m={12.5} c={szin.halvany} lh={1.35} szam selectable>
            {kicsi}
          </T>
        ) : null}
      </View>
      {masol ? <MasolGomb ertek={ertek.replace(/ Ft$/, '').replace(/ /g, '')} mit={mit ?? cim.toLowerCase()} tetel={tetel} /> : null}
    </View>
  );
}

export function Szamlaszamok({ lathato, bezar, tetelek, befizettem }: { lathato: boolean; bezar: () => void; tetelek: PaymentItem[]; befizettem?: () => void }) {
  const nap = ma();
  // Részben befizetett negyedév: csak a HÁTRALÉVŐ tételek kapnak másoló gombokat és lépéseket; amit már befizetettnek
  // jelöltél, az összecsukva, „Befizetted” jelzéssel áll alul, hogy senki ne utalja el kétszer.
  const nyitott = tetelek.filter((t) => !t.markedPaidAt);
  const befizetett = tetelek.filter((t) => t.markedPaidAt);
  const db = nyitott.length;
  const szo = ['', 'egy', 'két', 'három', 'négy'][db] ?? String(db);
  const bev =
    db === 0
      ? 'Mindent befizetettnek jelöltél, most nincs mit utalnod.'
      : befizetett.length
        ? db === 1
          ? `Már csak egy utalás van hátra: ${nyitott[0]?.label ?? ''}. A közleménybe az adószámodat írd.`
          : `Még ${szo} külön utalás van hátra, mert a NAV mindegyiket külön számlára várja. A közlemény mindegyiknél ugyanaz: az adószámod.`
        : db === 1
          ? 'Egy utalás kell a NAV-nak. A közleménybe az adószámodat írd.'
          : `${nagybetu(szo)} külön utalás kell, mert a NAV ${szo} különböző számlára várja. A közlemény mindegyiknél ugyanaz: az adószámod.`;
  const lepesek = db === 0 ? [] : ['Nyisd meg a bankod appját, és indíts új utalást.', 'Másold be a számlaszámot, az összeget és a közleményt.'];
  if (db === 2) lepesek.push('Ismételd meg a másik tételnél is.');
  else if (db > 2) lepesek.push(`Ismételd meg mind a ${szo} tételnél.`);
  return (
    <AlsoLap lathato={lathato} bezar={bezar}>
      <T m={24} s={700} lh={1.2} ls={-0.02} style={{ paddingRight: 84 }} accessibilityRole="header">
        Így utald el
      </T>
      <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
        {bev}
      </T>
      {lepesek.length ? (
        <View style={{ marginTop: 12, gap: 4 }}>
          {lepesek.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: szin.alap, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <T m={12.5} s={750} lh={1}>
                  {i + 1}
                </T>
              </View>
              <T m={15} lh={1.45} style={{ flex: 1 }}>
                {s}
              </T>
            </View>
          ))}
        </View>
      ) : null}
      {nyitott.map((t) => (
        <View key={t.id} style={{ marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: szin.hajszal, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 }}>
            <Ikon3d nev="szamlaszam" pt={28} />
            <View style={{ flex: 1 }}>
              <T m={16.5} s={650} lh={1.3}>
                {t.label}
              </T>
              {t.kind === 'szocho' && t.sublabel ? (
                <T m={13.5} c={szin.halvany}>
                  {t.sublabel}
                </T>
              ) : null}
            </View>
            <Osszeg szoveg={szam(t.amountHuf)} />
          </View>
          <Adat cim="Kedvezményezett" ertek={t.accountName} />
          <Adat cim="Számlaszám" ertek={t.accountNumber} masol mit="számlaszám" kicsi={`IBAN: ${t.iban.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ')}`} tetel={t.label} />
          <Adat cim="Közlemény" ertek={t.reference} masol mit="közlemény" tetel={t.label} />
          <Adat cim="Összeg" ertek={forint(t.amountHuf)} masol mit="összeg" tetel={t.label} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderTopWidth: 1, borderTopColor: szin.hajszal }}>
            {t.dueDate < nap ? (
              <>
                <T m={14} c={szin.halvany} style={{ flexShrink: 1 }}>
                  A határidő {datumE(t.dueDate)} volt: utald el mielőbb.
                </T>
                <Cimke szoveg="lejárt" veszely />
              </>
            ) : (
              <T m={14} c={szin.halvany}>
                Határidő: {datumIg(t.dueDate)}
              </T>
            )}
          </View>
        </View>
      ))}
      {befizetett.length ? (
        <View style={{ marginTop: 18 }}>
          {db > 0 ? (
            <T m={15} s={650} lh={1.3}>
              Ezt már befizetted, ne utald el újra
            </T>
          ) : null}
          {befizetett.map((t) => (
            <View
              key={t.id}
              accessibilityLabel={`${t.label}, ${szam(t.amountHuf)} forint: befizetted${t.markedPaidOn ? `, ${datumRovid(t.markedPaidOn)}` : ''}`}
              style={{ marginTop: 8, borderRadius: 14, backgroundColor: szin.nyomott, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <KeszJel pt={24} label="befizetve" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T m={16} s={600} lh={1.3}>
                  {t.label}
                </T>
                <T m={13.5} c={szin.halvany} lh={1.35}>
                  {`Befizetted${t.markedPaidOn ? `, ${datumRovid(t.markedPaidOn)}` : ''}`}
                </T>
              </View>
              <Osszeg szoveg={szam(t.amountHuf)} m={16} c={szin.halvany} />
            </View>
          ))}
        </View>
      ) : null}
      {befizettem && db > 0 ? <GombE cim="Már befizettem" onPress={befizettem} style={{ marginTop: 18 }} /> : null}
    </AlsoLap>
  );
}

// ---------- 08 Már befizettem ----------
function Pecset() {
  const s = useRef(new Animated.Value(1.15)).current;
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    mozgasKi().then((rm) => {
        if (rm) {
          s.setValue(1);
          o.setValue(1);
          return;
        }
        Animated.parallel([
          Animated.timing(s, { toValue: 1, duration: 180, easing: Easing.bezier(0.3, 1.5, 0.6, 1), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(o, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      });
  }, [o, s]);
  return (
    <View style={{ width: 160, height: 120, alignSelf: 'center', marginBottom: 8 }}>
      <Animated.View style={{ position: 'absolute', left: 38, top: 18, transform: [{ scale: s }], opacity: o }}>
        <KeszJel pt={84} label="Befizetve" />
      </Animated.View>
    </View>
  );
}

export function Befizettem({
  lathato,
  bezar,
  idoszak,
  tetelek,
  konyvelo,
  kesz: kezdoKesz = false,
}: {
  lathato: boolean;
  bezar: () => void;
  idoszak: { id: string; periodKey: string; dueDate: string } | undefined;
  tetelek: PaymentItem[];
  konyvelo: AccountantPublic;
  kesz?: boolean;
}) {
  const ment = useBefizettem();
  const hataridok = useHataridok();
  const [lepes, setLepes] = useState<1 | 2>(kezdoKesz ? 2 : 1);
  const [jelolt, setJelolt] = useState<Record<string, boolean>>({});
  const [mikor, setMikor] = useState<'ma' | 'tegnap' | 'mas'>('ma');
  const [masNap, setMasNap] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [fizetettNap, setFizetettNap] = useState<string>(ma());
  // Amit most jelölt be (a sikeres lap mondata ezt mondja, nem az összeset).
  const [most, setMost] = useState<string[]>([]);

  useEffect(() => {
    if (lathato) {
      setLepes(kezdoKesz ? 2 : 1);
      // Csak a még nyitott tételek vannak előre bejelölve; a már jelöltek „kész”-ként látszanak.
      setJelolt(Object.fromEntries(tetelek.filter((t) => !t.markedPaidAt).map((t) => [t.kind, true])));
      setMikor('ma');
      setMasNap('');
      setMost([]);
      setHiba(null);
      const elozo = tetelek.find((t) => t.markedPaidOn)?.markedPaidOn;
      if (elozo) setFizetettNap(elozo);
    }
  }, [lathato]); // eslint-disable-line react-hooks/exhaustive-deps

  // A következő befizetés: a határidőlistából, vagy ha az még nincs meg (új év), a negyedéves ritmusból (+3 hónap).
  const kovetkezoLista = hataridok.data?.items.find((d) => d.kind === 'befizetes' && idoszak && d.dueDate > idoszak.dueDate && d.status !== 'kesz');
  const kovetkezo = kovetkezoLista ?? (idoszak ? { dueDate: honapHozzaad(idoszak.dueDate, 3), amountHuf: undefined as number | undefined } : undefined);
  const nyitottak = tetelek.filter((t) => !t.markedPaidAt);
  const kinds = nyitottak.filter((t) => jelolt[t.kind]).map((t) => t.kind);
  const mind = kinds.length === nyitottak.length && nyitottak.length === tetelek.length;

  async function feljegyez() {
    if (!idoszak) return;
    const nap = mikor === 'ma' ? ma() : mikor === 'tegnap' ? napHozzaad(ma(), -1) : datumNormal(masNap);
    if (mikor === 'mas') {
      const h = datumHiba(nap);
      if (h) return setHiba(h);
      if (nap > ma()) return setHiba('Jövőbeli napot nem jelölhetsz.');
    }
    if (!kinds.length) return setHiba('Jelöld be, mit utaltál el.');
    setHiba(null);
    try {
      // Mindig csak az újonnan jelölteket küldjük: a korábban jelöltek dátuma nem íródik felül.
      await ment.mutateAsync({ id: idoszak.id, paidOn: nap, kinds: mind ? undefined : kinds });
      setMost(mind ? [] : nyitottak.filter((t) => jelolt[t.kind]).map((t) => t.label));
      setFizetettNap(nap);
      setLepes(2);
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült feljegyezni. Próbáld újra.'));
    }
  }

  if (lepes === 2) {
    return (
      <AlsoLap lathato={lathato} bezar={bezar} bezarGomb={false} fuggony="rgba(13,22,40,0.30)" stilus={{ paddingTop: 22 }}>
        <View style={{ alignItems: 'center' }}>
          <Pecset />
          <T m={24} s={700} lh={1.2} ls={-0.02} kozep accessibilityRole="header" style={{ paddingHorizontal: 8 }}>
            Feljegyeztük, hogy befizetted
          </T>
          <T m={15.5} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 8, maxWidth: 320 }}>
            {`${datumAn(fizetettNap).replace(/^./, (c) => c.toUpperCase())} elutaltad ${most.length ? `ezt: ${most.join(', ')}` : mindTargy(tetelek.length)}. ${konyvelo.firstName} a bankszámlakivonatodon nézi meg, hogy megérkezett-e.`}
          </T>
        </View>
        {kovetkezo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: szin.nyomott }}>
            <Ikon3d nev="hataridok" pt={42} />
            <View style={{ flex: 1 }}>
              <T m={15.5} s={650} lh={1.35}>
                Legközelebb {datumIg(kovetkezo.dueDate)}
              </T>
              <T m={14.5} c={szin.halvany} lh={1.4}>
                {kovetkezo.amountHuf ? `várhatóan kb. ${szam(Math.round(kovetkezo.amountHuf / 10000) * 10000)} Ft, ` : ''}
                {konyvelo.firstName} előtte megírja
              </T>
            </View>
          </View>
        ) : (
          <View style={{ height: 18 }} />
        )}
        <GombE cim="Rendben" onPress={bezar} />
      </AlsoLap>
    );
  }

  return (
    <AlsoLap lathato={lathato} bezar={bezar}>
      <T m={24} s={700} lh={1.2} ls={-0.02} style={{ paddingRight: 84 }} accessibilityRole="header">
        Mit utaltál el?
      </T>
      <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
        Csak feljegyezzük. {konyvelo.firstName} a bankszámlakivonatodon ellenőrzi, hogy megérkezett-e.
      </T>
      <View style={{ marginTop: 10 }}>
        {tetelek.filter((t) => t.markedPaidAt).map((t) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <KeszJel pt={24} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T m={16} s={500} lh={1.4} c={szin.halvany}>
                  {t.label}
                </T>
                <Osszeg szoveg={szam(t.amountHuf)} m={16} />
              </View>
              <T m={13.5} c={szin.halvany}>
                {`Már jelölted${t.markedPaidOn ? `: ${datumRovid(t.markedPaidOn)}` : ''}`}
              </T>
            </View>
          </View>
        ))}
        {nyitottak.map((t) => (
          <Pipa key={t.id} be={!!jelolt[t.kind]} valt={(b) => setJelolt((j) => ({ ...j, [t.kind]: b }))}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T m={16} s={500} lh={1.4}>
                {t.label}
              </T>
              <Osszeg szoveg={szam(t.amountHuf)} m={16} />
            </View>
          </Pipa>
        ))}
      </View>
      <T m={15} s={600} style={{ marginTop: 14, marginBottom: 8 }}>
        Mikor utaltad?
      </T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }} accessibilityRole="radiogroup" aria-label="Mikor utaltad?">
        {(
          [
            ['ma', `Ma, ${datumRovid(ma())}`],
            ['tegnap', 'Tegnap'],
            ['mas', 'Másik nap'],
          ] as const
        ).map(([k, c]) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: mikor === k, checked: mikor === k }}
            // react-native-web 0.21 nem írja ki az accessibilityState-et: a weben az aria-checked mondja meg, melyik él.
            aria-checked={mikor === k}
            aria-label={`Mikor utaltad? ${c}`}
            onPress={() => {
              setMikor(k);
              setHiba(null);
            }}
            style={{ height: 40, paddingHorizontal: 14, borderRadius: forma.mezo, borderWidth: mikor === k ? 2 : 1, borderColor: mikor === k ? szin.tintakek : szin.keret, justifyContent: 'center', backgroundColor: mikor === k ? '#fff' : szin.mezoAlap }}
          >
            <T m={15} s={mikor === k ? 650 : 500}>
              {c}
            </T>
          </Pressable>
        ))}
      </View>
      {mikor === 'mas' ? (
        <Mezo
          felirat="A nap"
          placeholder="ÉÉÉÉ-HH-NN"
          value={masNap}
          onChangeText={(v) => {
            setMasNap(v);
            setHiba(null);
          }}
          keyboardType="numbers-and-punctuation"
          style={{ marginTop: 12 }}
        />
      ) : null}
      <HibaSzoveg szoveg={hiba} />
      <GombE cim={mind ? 'Feljegyzem, hogy befizettem' : 'Feljegyzem a bejelölteket'} onPress={feljegyez} tolt={ment.isPending} style={{ marginTop: 18 }} />
    </AlsoLap>
  );
}

export function feljegyezveSzoveg(at?: string): string {
  if (!at) return '';
  const r = reszek(at);
  return `Feljegyezve ${datumRovid(at)}, ${ido(r)}`;
}
export { GombSz };
