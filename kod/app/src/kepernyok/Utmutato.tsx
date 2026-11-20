// A két önkiszolgáló útmutató közös teste (SPEC §26.6.1): videókártya, bevezető, „Készítsd elő” (csak a bejelentésnél),
// lépésenként egy fehér lap: nagy sorszám + a NAV képernyő neve, mit csinálj, mezősorok („Jelöld be” / „Ne jelöld be”
// szóval, jel nélkül – TERV 0.: X, pipa, plusz helyett szöveg; érték másolás gombbal, miért), borostyán figyelmeztetés,
// külső link, a JELÖLT NAV-KÉPERNYŐKÉP (koppintásra nagyítható, alatta aláírás + forrás; a rajzoltakon „Illusztráció”),
// „Megvan” pipa és „Elakadtál? Kérj visszahívást”. A kész lépés jele az ibolya pecsét (KeszJel), mint mindenhol.
// Idősebbeknek: 17 pt-os törzsszöveg 1,5 sorközzel, 44 pt-os koppintási felületek.
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, PixelRatio, Platform, Pressable, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import type { Guide, GuideField, GuideImageManifest, GuidePrepareItem, GuideStep } from '../_shared/api';
import type { CallbackSource, CallbackTopic, GuideKind } from '../_shared/enums';
import { CHANGE_TEXTS, ACTIVITY_PENDING_BANNER, ASSIST_TEXTS, fillPlaceholders, GUIDE_DRAWN_NOTE, HUB_TEXTS } from '../_shared/bekotes';
import { kepCimke, kepekLepeshez, vanRajzolt, type UtmutatoKep, valtozasFajta } from '../lib/utmutato';
import { mediaUrl } from '../lib/media';
import { MASOLAS_HIBA, vagolapra } from '../lib/vagolap';
import { forma, szin } from '../theme/tokens';
import { beallitasIr, beallitasOlvas } from '../lib/tarolo';
import { Fejlec, GombE, GombSz, Lap, Pipa, Szakasz } from '../ui/alap';
import { Ikon3d, KeszJel, type Ikon3dNev } from '../ui/kepek';
import { KepNezo } from '../ui/KepNezo';
import { useJelzes } from '../ui/keret';
import { alapMagyarazat, MiEz } from '../ui/Magyarazat';
import { T } from '../ui/T';
import { VideoKartya } from '../ui/Video';
import { Elakadtal } from '../ui/Visszahivas';
import { useVezetettParam, VezetettFelsoSor, VezetettHaladas } from '../ui/Vezetett';
import { router, useLocalSearchParams } from 'expo-router';

/** A lépés egyes soraihoz tartozó magyarázat (SPEC §26.8.2: „Mi ez?” a megfelelő sorokon). */
const SOR_MAGYARAZAT: { minta: RegExp; kulcs: string }[] = [
  { minta: /átalányadó/i, kulcs: 'atalanyadozas' },
  { minta: /alanyi adómentesség/i, kulcs: 'alanyi_afa_mentesseg' },
  { minta: /katá|pénzforgalmi/i, kulcs: 'kata_penzforgalmi' },
  { minta: /közösségi adószám/i, kulcs: 'kozossegi_adoszam' },
  { minta: /Letöltés \(PDF\)/i, kulcs: 'nav_igazolas_pdf' },
  { minta: /^Belépés$/i, kulcs: 'ugyfelkapu_dap' },
  { minta: /TAJ/i, kulcs: 'taj_szam' },
];

/** „Hagyd, ahogy van” + „hagyd üresen” → egyszer: „Hagyd üresen” (csak megjelenítés). */
const hagydErtek = (f: GuideField) => f.action === 'hagyd' && !!f.value && /^hagyd\b/i.test(f.value);

function ActionCimke({ f }: { f: GuideField }) {
  // Jel (✓ / ×) nincs előtte: az × bezárás-gombnak látszott, a szó maga hordozza a jelentést (TERV 0.).
  const c = f.action === 'ne_jelold' ? szin.veszely : f.action === 'jelold' ? szin.tintakek : szin.tinta;
  const cimke = hagydErtek(f) && f.value ? f.value.charAt(0).toLocaleUpperCase('hu-HU') + f.value.slice(1) : f.actionLabel;
  return (
    <T m={15} s={750} c={c} lh={1.3}>
      {cimke}
    </T>
  );
}

function MezoSor({ f, elso, kind, tomor = false }: { f: GuideField; elso: boolean; kind: GuideKind; tomor?: boolean }) {
  const jelez = useJelzes();
  // keskeny kijelzőn (320 pt) a „Másolás” az érték alá kerül, hogy a szöveg ne törjön szavanként
  const keskeny = useWindowDimensions().width < 360;
  const m = SOR_MAGYARAZAT.find((x) => x.minta.test(f.label));
  // 11-19 javító kör 2 (§27.4.5: egy lépés ≤ ~1,5 képernyő): lépésenkénti nézetben a „Hagyd üresen” / „Ne jelöld be”
  // sorok tömörek – kisebb betű és köz, az indoklás egy „Miért?” koppintásra. A fő teendő sorai változatlanok.
  const masodlagos = tomor && (f.action === 'hagyd' || f.action === 'ne_jelold');
  const [miert, setMiert] = useState(false);
  return (
    <View style={{ paddingVertical: masodlagos ? 8 : 12, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <ActionCimke f={f} />
      <T m={masodlagos ? 16 : 17} lh={1.4} style={{ marginTop: 2 }}>
        {f.label}
      </T>
      {f.value && !hagydErtek(f) ? (
        <View style={{ flexDirection: keskeny && f.copyValue ? 'column' : 'row', alignItems: keskeny && f.copyValue ? 'flex-start' : 'center', gap: 10, marginTop: 6, padding: f.copyValue ? 10 : 0, borderRadius: forma.mezo, backgroundColor: f.copyValue ? szin.nyomott : 'transparent' }}>
          <T m={17} s={650} lh={1.45} style={keskeny && f.copyValue ? { alignSelf: 'stretch' } : { flex: 1 }} selectable nyers={!!f.copyValue}>
            {f.value}
          </T>
          {f.copyValue ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${f.label} másolása`}
              onPress={async () => {
                if (!(await vagolapra(f.copyValue ?? ''))) return jelez(MASOLAS_HIBA);
                jelez({ szoveg: 'Kimásoltad. Most illeszd be a NAV-os űrlapba.', kesz: true });
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingLeft: 8, paddingRight: 13, borderRadius: forma.gomb, backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap })}
            >
              <Ikon3d nev="masolas" pt={26} />
              <T m={15} s={650} c={szin.tintakekSzoveg}>
                Másolás
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {f.why && (!masodlagos || miert) ? (
        <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 4 }}>
          {f.why}
        </T>
      ) : null}
      {masodlagos && ((f.why && !miert) || m) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, alignItems: 'center' }}>
          {f.why && !miert ? <GombSz cim="Miért?" m={15} onPress={() => setMiert(true)} style={{ paddingTop: 2, paddingBottom: 0 }} /> : null}
          {m ? <MiEz kulcs={m.kulcs} forras={kind === 'meghatalmazas' ? 'meghatalmazas_utmutato' : 'vallalkozas_utmutato'} tema={kind === 'meghatalmazas' ? 'meghatalmazas' : 'vallalkozas_inditas'} style={{ alignSelf: 'flex-start', marginTop: 2 }} /> : null}
        </View>
      ) : m ? (
        <MiEz kulcs={m.kulcs} forras={kind === 'meghatalmazas' ? 'meghatalmazas_utmutato' : 'vallalkozas_utmutato'} tema={kind === 'meghatalmazas' ? 'meghatalmazas' : 'vallalkozas_inditas'} style={{ alignSelf: 'flex-start', marginTop: 2 }} />
      ) : null}
    </View>
  );
}

function UtmutatoKepElem({ k, kind }: { k: UtmutatoKep; kind: GuideKind }) {
  const [hiba, setHiba] = useState(false);
  const [nagy, setNagy] = useState(false);
  const ablakMag = useWindowDimensions().height;
  const fajl = PixelRatio.get() >= 2 && k.file2x ? k.file2x : k.file;
  const uri = mediaUrl(`utmutato/${kind}/${fajl}`);
  const nagyUri = mediaUrl(`utmutato/${kind}/${k.file2x ?? k.file}`);
  const cimke = kepCimke(k);
  const jelolesek = (k.markers ?? []).map((x) => `${x.n}. ${x.label}`).join('. ');
  return (
    <View style={{ marginTop: 14 }}>
      {hiba ? (
        <View style={{ borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: szin.keret, padding: 16 }}>
          <T m={15} lh={1.45} c={szin.halvany}>
            {k.caption || 'A kép most nem tölthető be.'}
          </T>
        </View>
      ) : (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={`${k.alt}${jelolesek ? `. Jelölések: ${jelolesek}` : ''}. ${cimke}`} accessibilityHint="Koppints rá, és nagyíthatod" onPress={() => setNagy(true)}>
          {/* S10: lépésenként egy képernyő – a kép legfeljebb a képernyő fele; a részletet a „Nagyítom” mutatja */}
          <Image source={{ uri }} onError={() => setHiba(true)} style={{ width: '100%', aspectRatio: k.width / k.height, maxHeight: Math.round(ablakMag * 0.5), borderRadius: 12, backgroundColor: szin.alap }} resizeMode="contain" />
        </Pressable>
      )}
      {/* SPEC §27.1.2: előbb az aláírás, alatta a kis, őszinte sor (valódi NAV-képernyő forrással / rajzolt vázlat). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          {k.caption ? (
            <T m={14} s={550} lh={1.4}>
              {k.caption}
            </T>
          ) : null}
          {/* k6c2: a normalised picture carries its source line on the image (sourceShort): not repeated under it */}
          {k.sourceShort ? null : (
            <T m={12} lh={1.4} c={szin.halvany} style={{ marginTop: k.caption ? 2 : 0 }}>
              {cimke}
            </T>
          )}
        </View>
        {!hiba ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Kép nagyítása" hitSlop={8} onPress={() => setNagy(true)} style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 12, borderRadius: forma.gomb, backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap, justifyContent: 'center' })}>
            <T m={14} s={650} c={szin.tintakekSzoveg}>
              Nagyítom
            </T>
          </Pressable>
        ) : null}
      </View>
      {nagy ? <KepNezo uri={nagyUri} szel={k.width} mag={k.height} felirat={k.caption} cimke={cimke} alt={k.alt} bezar={() => setNagy(false)} /> : null}
    </View>
  );
}

/** A lépés külső linkje másodlagos kapszulaként; a hosszú felirat („Megnyitom a Vállalkozói Ügysegédet”) keskeny
 *  kijelzőn két sorba törik, nem vágódik le. */
function LinkGomb({ cim, url }: { cim: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => ({ alignSelf: 'flex-start', maxWidth: '100%', minHeight: 48, paddingVertical: 10, paddingHorizontal: 18, marginTop: 14, borderRadius: forma.gomb, backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap, justifyContent: 'center' })}
    >
      <T m={16} s={650} lh={1.3} c={szin.tintakekSzoveg} ls={-0.005}>
        {cim}
      </T>
    </Pressable>
  );
}

/** A lap fejléce: kinek a képernyője, és rajzolt vázlat-e a képe (SPEC §26.6.1, §24 11-18 javító). */
export function lepesFejcim(s: GuideStep, kind: GuideKind, kepek: UtmutatoKep[]): string {
  const fajta = s.screenKind ?? (s.ownApp ? 'app' : 'nav');
  if (fajta === 'app') return 'ITT, AZ ALKALMAZÁSBAN';
  if (fajta === 'kamara') return 'KAMARAI OLDAL';
  // A rajzolt képet a kép alatti kis sor jelzi (SPEC §27.1.2), a fejléc csak azt mondja, kinek a képernyője.
  void kepek;
  // SPEC §28.5.1: a változások a Vállalkozói Ügysegédben (NAV) mennek, csak az adózási adat az ONYA-ban (T101E)
  if (valtozasFajta(kind)) return kind === 'valtozas_adoadat' || /^(onya|t101e)_/.test(s.key) ? 'ONYA KÉPERNYŐ' : 'NAV KÉPERNYŐ';
  return kind === 'vallalkozas_bejelentes' ? 'NAV KÉPERNYŐ' : 'ONYA KÉPERNYŐ';
}

export function LepesLap({
  s,
  kind,
  kepek,
  kesz,
  valt,
  forras,
  tema,
  lab,
  linkHelyett,
}: {
  s: GuideStep;
  kind: GuideKind;
  kepek: UtmutatoKep[];
  kesz: boolean;
  valt: (b: boolean) => void;
  forras: CallbackSource;
  tema: CallbackTopic;
  /** Lépésenkénti nézet (S10): a „Megvan” pipa helyett ez a lábléc („Megvan, tovább”, „Vissza”, „Elakadtál?”). */
  lab?: React.ReactNode;
  /** Amíg a tevékenység sora készül: a NAV-gomb helyett ez a sor (HUB_TEXTS.guideHoldNavButton). */
  linkHelyett?: string | null;
}) {
  // 11-19 javító kör 2 (§27.4.5: egy lépés legfeljebb ~1,5 telefon-képernyő): lépésenkénti nézetben csak az első kép
  // látszik, a többi egy koppintásra („Mutasd a másik képet”). Az „egyben” / nyomtatott nézet mindent mutat.
  const [tobbiKep, setTobbiKep] = useState(false);
  const lathatoKepek = lab && !tobbiKep ? kepek.slice(0, 1) : kepek;
  const rejtettKep = kepek.length - lathatoKepek.length;
  return (
    <Lap style={{ marginTop: 12, paddingTop: 16, paddingHorizontal: 18, paddingBottom: lab ? 14 : 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {kesz ? (
          // kész lépés: az ibolya pecsét (befizetve_jel), ugyanabban a 40 pt-os helyben – rajzolt pipa nincs
          <KeszJel pt={40} label={`${s.n}. lépés, megvan`} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: szin.tintakek, alignItems: 'center', justifyContent: 'center' }}>
            <T m={19} s={800} c="#fff" lh={1} accessibilityLabel={`${s.n}. lépés`}>
              {s.n}
            </T>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <T m={13} s={700} ls={0.06} c={szin.halvany}>
            {lepesFejcim(s, kind, kepek)}
          </T>
          <T m={20} s={700} lh={1.3} ls={-0.015} accessibilityRole="header">
            {s.screenTitle}
          </T>
        </View>
      </View>
      <T m={17} lh={1.5} style={{ marginTop: 10 }}>
        {s.text}
      </T>
      {s.hold ? (
        <View accessibilityRole="alert" style={{ marginTop: 12, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ikon3d nev="ora" pt={32} />
          <T m={16} s={650} lh={1.5} c={szin.borostyanSzoveg} style={{ flex: 1 }}>
            {s.hold}
          </T>
        </View>
      ) : null}
      {s.fields.length ? (
        <View style={{ marginTop: 6 }}>
          {s.fields.map((f, i) => (
            <MezoSor key={`${f.label}-${i}`} f={f} elso={i === 0} kind={kind} tomor={!!lab} />
          ))}
        </View>
      ) : null}
      {s.warning ? (
        <View style={{ marginTop: 10, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 14 }}>
          <T m={16} s={600} lh={1.5} c={szin.borostyanSzoveg}>
            {s.warning}
          </T>
        </View>
      ) : null}
      {s.link ? (
        linkHelyett ? (
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: forma.mezo, backgroundColor: szin.nyomott, padding: 12 }}>
            <Ikon3d nev="ora" pt={28} />
            <T m={15.5} s={600} lh={1.45} style={{ flex: 1 }}>
              {linkHelyett}
            </T>
          </View>
        ) : (
          <LinkGomb cim={s.link.label} url={s.link.url} />
        )
      ) : null}
      {lathatoKepek.map((k) => (
        <UtmutatoKepElem key={k.file} k={k} kind={kind} />
      ))}
      {rejtettKep > 0 ? (
        <GombSz cim={rejtettKep === 1 ? 'Mutasd a másik képet' : `Mutasd a többi képet (${rejtettKep})`} onPress={() => setTobbiKep(true)} style={{ marginTop: 4 }} />
      ) : null}
      {lab ?? (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: szin.hajszal, paddingTop: 4 }}>
          <Pipa be={kesz} valt={valt} style={{ paddingVertical: 10 }}>
            <T m={17} s={650} lh={1.4}>
              Megvan
            </T>
          </Pipa>
          <Elakadtal forras={forras} tema={tema} style={{ paddingTop: 2 }} />
        </View>
      )}
    </Lap>
  );
}

/** „Készítsd elő” – pipálható lista (csak helyben jegyzi meg), mindegyik soron „Mi ez?”. */
export function ElokeszitLista({ elemek, pipak, valt, fn }: { elemek: GuidePrepareItem[]; pipak: string[]; valt: (k: string, b: boolean) => void; fn: string }) {
  return (
    <Lap>
      {elemek.map((p, i) => {
        const e = alapMagyarazat(p.explainerKey, fn);
        const be = pipak.includes(p.key);
        return (
          <View key={p.key} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal, alignItems: 'flex-start' }}>
            <Ikon3d nev={(e?.icon ?? 'irat') as Ikon3dNev} pt={44} />
            <View style={{ flex: 1 }}>
              <Pipa be={be} valt={(b) => valt(p.key, b)} style={{ paddingVertical: 2 }}>
                <T m={16.5} s={650} lh={1.4}>
                  {p.label}
                </T>
              </Pipa>
              <T m={15} lh={1.45} c={szin.halvany} style={{ marginLeft: 36 }}>
                {p.note}
              </T>
              {p.privacyNote || !p.storedByUs ? (
                <T m={14} s={600} lh={1.4} c={szin.halvany} style={{ marginLeft: 36, marginTop: 3 }}>
                  {p.privacyNote ?? (p.key === 'belepes' ? 'Ezt nem kérjük el: ezzel te lépsz be.' : 'A bejelentéshez nem kérjük el, a NAV-os űrlapba te írod be.')}
                </T>
              ) : null}
              <MiEz kulcs={p.explainerKey} forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginLeft: 36, alignSelf: 'flex-start' }} />
            </View>
          </View>
        );
      })}
    </Lap>
  );
}

export function UtmutatoTorzs({
  g,
  kepek,
  valaszok,
  kesz,
  valt,
  fn,
  pipak,
  pipal,
}: {
  g: Guide;
  kepek: GuideImageManifest | undefined;
  valaszok: { workKind?: string | null; euPartner?: string | null };
  kesz: string[];
  valt: (kulcs: string, b: boolean) => void;
  fn: string;
  pipak?: string[];
  pipal?: (k: string, b: boolean) => void;
}) {
  const [elokeszitNyitva, setElokeszitNyitva] = useState(false);
  const forras: CallbackSource = g.kind === 'meghatalmazas' ? 'meghatalmazas_utmutato' : valtozasFajta(g.kind) ? 'valtozas_utmutato' : 'vallalkozas_utmutato';
  const tema: CallbackTopic = g.kind === 'meghatalmazas' ? 'meghatalmazas' : valtozasFajta(g.kind) ? 'valtozas' : 'vallalkozas_inditas';
  const db = g.steps.filter((s) => kesz.includes(s.key)).length;
  return (
    <>
      {g.activityPending ? (
        // review k3c2: the hold must be seen BEFORE the client opens the NAV form, not only at step 5
        <View accessibilityRole="alert" style={{ marginBottom: 12, borderRadius: forma.lap, backgroundColor: szin.borostyanAlap, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Ikon3d nev="ora" pt={36} />
          <T m={16} s={650} lh={1.5} c={szin.borostyanSzoveg} style={{ flex: 1 }}>
            {ACTIVITY_PENDING_BANNER}
          </T>
        </View>
      ) : null}
      {g.video ? <VideoKartya nev={g.video.name} cim={g.video.title} magas={180} /> : null}
      <T m={17} lh={1.5} style={{ marginTop: g.video ? 16 : 0, paddingHorizontal: 4 }}>
        {g.intro}
      </T>
      {vanRajzolt(kepek) ? (
        <T m={14} lh={1.45} c={szin.halvanyAlapon} style={{ marginTop: 8, paddingHorizontal: 4 }}>
          {GUIDE_DRAWN_NOTE}
        </T>
      ) : null}
      {g.prepare.length && pipak && pipal ? (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: elokeszitNyitva }} onPress={() => setElokeszitNyitva((x) => !x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, minHeight: 52, paddingHorizontal: 16, borderRadius: forma.lap, backgroundColor: szin.lap }}>
            <Ikon3d nev="irat" pt={28} />
            <T m={16.5} s={650} style={{ flex: 1 }}>
              Készítsd elő ({pipak.length}/{g.prepare.length})
            </T>
            <T m={15} s={600} c={szin.tintakekSzoveg} alahuz>
              {elokeszitNyitva ? 'Becsukom' : 'Kinyitom'}
            </T>
          </Pressable>
          {elokeszitNyitva ? <View style={{ marginTop: 8 }}><ElokeszitLista elemek={g.prepare} pipak={pipak} valt={pipal} fn={fn} /></View> : null}
        </>
      ) : null}
      {g.outdated && g.outdatedText ? (
        <View style={{ marginTop: 14, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 14 }}>
          <T m={16} s={650} lh={1.5} c={szin.borostyanSzoveg}>
            {g.outdatedText}
          </T>
        </View>
      ) : null}
      <Szakasz cim="Lépésről lépésre" megj={`${db} / ${g.steps.length} lépés megvan. Pipáld ki, amivel kész vagy.`} />
      {g.steps.map((s) => (
        <LepesLap key={s.key} s={s} kind={g.kind} kepek={kepekLepeshez(kepek, s.imageKey, valaszok)} kesz={kesz.includes(s.key)} valt={(b) => valt(s.key, b)} forras={forras} tema={tema} />
      ))}
      <T m={17} lh={1.5} style={{ marginTop: 16, paddingHorizontal: 4 }}>
        {g.outro}
      </T>
    </>
  );
}

/** Tintakék sáv a vissza-linkkel, címmel és alcímmel (útmutató, adatlap, bejelentés). */
export function SavCim({ vissza, visszaCim = 'Vissza', cim, al, jobb, children }: { vissza: () => void; visszaCim?: string; cim: string; al?: string; jobb?: string; children?: React.ReactNode }) {
  // Long single words ("NAV-meghatalmazást") must fit a 320 px screen at large text too (review k3c2).
  const keskeny = useWindowDimensions().width < 360;
  // SPEC §29.10.3: in the guided run the band gets "Vissza" + "Később folytatom" and the progress bar
  const vezetett = useVezetettParam();
  return (
    <Fejlec rozX={300} rozY={70} alsoTer={18}>
      {vezetett ? (
        <>
          <VezetettFelsoSor vissza={vissza} kulcs={vezetett} />
          <VezetettHaladas style={{ marginTop: 8, marginBottom: 6, paddingHorizontal: 20 }} />
        </>
      ) : (
        <Pressable accessibilityRole="link" onPress={vissza} hitSlop={6} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 20, alignSelf: 'flex-start' }}>
          <T m={16} s={500} c="#fff" alahuz>
            {visszaCim}
          </T>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 4, paddingHorizontal: 20 }}>
        <T m={keskeny ? 24 : 27} maxFontSizeMultiplier={1.15} s={700} lh={1.17} ls={-0.024} c="#fff" style={{ flex: 1 }} accessibilityRole="header">
          {cim}
        </T>
        {jobb ? (
          <T m={16} s={700} c={szin.fejlecHalvany} szam style={{ paddingBottom: 3 }}>
            {jobb}
          </T>
        ) : null}
      </View>
      {al ? (
        <T m={16} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 6, paddingHorizontal: 20 }}>
          {al}
        </T>
      ) : null}
      {children}
    </Fejlec>
  );
}

/** A „Készítsd elő” pipái – csak ezen a telefonon (nem adat, csak emlékeztető). */
export function useElokeszit(userId?: string) {
  const kulcs = `kj_elokeszit_${userId ?? 'x'}`;
  const [pipak, setPipak] = useState<string[]>([]);
  useEffect(() => {
    void beallitasOlvas(kulcs).then((v) => {
      try {
        setPipak(v ? (JSON.parse(v) as string[]) : []);
      } catch {
        setPipak([]);
      }
    });
  }, [kulcs]);
  const valt = (k: string, b: boolean) =>
    setPipak((x) => {
      const uj = b ? [...new Set([...x, k])] : x.filter((y) => y !== k);
      void beallitasIr(kulcs, JSON.stringify(uj));
      return uj;
    });
  return { pipak, valt };
}

/** Az útmutató „Megvan” pipái: azonnal látszik, a szerverre késleltetve megy (SPEC §26.6.1). */
export function useHaladas(kind: GuideKind, g: Guide | undefined, ment: (kulcsok: string[]) => Promise<unknown>) {
  const [kesz, setKesz] = useState<string[] | null>(null);
  const idozito = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (g && kesz === null) setKesz(g.steps.filter((s) => s.done).map((s) => s.key));
  }, [g, kesz]);
  useEffect(() => () => {
    if (idozito.current) clearTimeout(idozito.current);
  }, []);
  const valt = (k: string, b: boolean) =>
    setKesz((x) => {
      const uj = b ? [...new Set([...(x ?? []), k])] : (x ?? []).filter((y) => y !== k);
      if (idozito.current) clearTimeout(idozito.current);
      idozito.current = setTimeout(() => void ment(uj).catch(() => undefined), 600);
      return uj;
    });
  return { kesz: kesz ?? [], valt, kind };
}

/** S10: az útmutató lépés-paramétere (?lepes=N, 0 = bevezető) és a görgető, ami lépésváltáskor a tetejére ugrik. */
export function useLepesParam(n: number) {
  const { lepes } = useLocalSearchParams<{ lepes?: string }>();
  const gorgeto = useRef<ScrollViewInstance>(null);
  const i = Math.max(0, Math.min(n, Number.parseInt(lepes ?? '0', 10) || 0));
  // 11-19 javítás: a görgetést az ÚJ lépés kirajzolása UTÁN állítjuk a tetejére (előtte a böngésző „scroll anchoring”-ja
  // és a régi magasság miatt a következő lépés a képeknél / a gombnál nyílt meg, a cím és a teendő kilógott felül).
  useEffect(() => {
    const fel = () => {
      gorgeto.current?.scrollTo({ y: 0, animated: false });
      // Weben a lépés tetején ülő jelölőtől felfelé keressük a görgető elemet, és azt állítjuk a tetejére (a ref-en át
      // nem mindig ért célba: a böngésző a „scroll anchoring” miatt a régi helyen tartotta a lapot).
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        let el: HTMLElement | null = document.getElementById(LEPES_TETEJE)?.parentElement ?? null;
        while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
        if (el) {
          el.style.setProperty('overflow-anchor', 'none');
          el.scrollTop = 0;
        }
      }
    };
    const raf = requestAnimationFrame(fel);
    const t = setTimeout(fel, 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [i]);
  const ugrik = (k: number) => {
    router.setParams({ lepes: String(Math.max(0, Math.min(n, k))) });
    gorgeto.current?.scrollTo({ y: 0, animated: false });
  };
  return { lepes: i, ugrik, gorgeto };
}

/**
 * A kiemelt „Nem boldogulsz vele? Intézzük helyetted” csík az útmutatókban (SPEC §27.3.1 kiemelés: 2 pt márkakék keret,
 * 3D ikon, kapszula-gomb) – a bevezető tetején és minden lépés kártyáján, közvetlenül a fő gomb alatt (11-19 javítás:
 * eddig vékony szöveges link volt a képernyő alján, a meghatalmazás-útmutatóban pedig hiányzott).
 */
export function SegitsegCsik({ fajta, fn, onPress, kompakt, style }: { fajta: 'ev' | 'mh' | 'valtozas'; fn: string; onPress: () => void; kompakt?: boolean; style?: object }) {
  // SPEC §28.5.2: a változásoknál „Bejelentjük helyetted” (díjas, előre fizetve – a díjat a kérés képernyője mutatja)
  const cim = fajta === 'valtozas' ? `Nem boldogulsz vele? ${CHANGE_TEXTS.helyettunk.title}` : fajta === 'mh' ? ASSIST_TEXTS.mhGuideLink : ASSIST_TEXTS.guideLink;
  const szoveg = fillPlaceholders(fajta === 'valtozas' ? CHANGE_TEXTS.helyettunk.body : fajta === 'mh' ? ASSIST_TEXTS.guideStripBodyMh : ASSIST_TEXTS.guideStripBodyEv, { firstName: fn });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cim}. ${szoveg}`}
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: forma.mezo, borderWidth: 2, borderColor: szin.tintakek, backgroundColor: pressed ? '#F3F5FE' : szin.lap, paddingVertical: kompakt ? 10 : 12, paddingHorizontal: 12 },
        style,
      ]}
    >
      <Ikon3d nev="kerdezek" pt={kompakt ? 32 : 40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T m={kompakt ? 15.5 : 16.5} s={700} lh={1.3} c={szin.tinta}>
          {cim}
        </T>
        {kompakt ? null : (
          <T m={14.5} lh={1.4} c={szin.halvany} style={{ marginTop: 2 }}>
            {szoveg}
          </T>
        )}
      </View>
      <View style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: forma.gomb, backgroundColor: szin.gombMAlap, justifyContent: 'center' }}>
        <T m={14.5} s={700} c={szin.tintakekSzoveg} numberOfLines={1}>
          {ASSIST_TEXTS.guideStripButton}
        </T>
      </View>
    </Pressable>
  );
}

/** A lépésenkénti nézet tetején ülő jelölő (weben ettől felfelé keressük a görgetőt, useLepesParam). */
const LEPES_TETEJE = 'kj-utmutato-teteje';

/** Haladás-sáv a lépések fölött: „3/14. lépés” + vékony csík. */
export function LepesHaladas({ i, n }: { i: number; n: number }) {
  return (
    <View nativeID={LEPES_TETEJE} style={{ marginBottom: 4 }} accessibilityLabel={`${i}. lépés a ${n}-ből`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T m={14.5} s={650} c={szin.halvanyAlapon} szam>
          {fillPlaceholders(HUB_TEXTS.guideOneStep, { i: String(i), n: String(n) })}
        </T>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: szin.keret, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round((i / Math.max(1, n)) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: szin.tintakek }} />
        </View>
      </View>
    </View>
  );
}

/**
 * S10 – egy lépés egy képernyőn (SPEC §27.0.3: térkép a Főoldalon, lépésenként a hosszú feladatokban). A 0. „lépés” a
 * bevezető (videó, „Készítsd elő”, rajzolt-kép megjegyzés); minden lépés alján „Megvan, tovább”, „Vissza”, „Elakadtál?”,
 * a bejelentésnél „Nem boldogulsz vele? Intézzük helyetted”. „Mutasd egyben” = a régi hosszú oldal.
 */
export function UtmutatoLepesenkent({
  g, kepek, valaszok, kesz, valt, fn, pipak, pipal, lepes, ugrik, vege, segitseg, segitsegFajta = 'ev', egyben, elotte, utana,
}: {
  g: Guide;
  kepek: GuideImageManifest | undefined;
  valaszok: { workKind?: string | null; euPartner?: string | null };
  kesz: string[];
  valt: (kulcs: string, b: boolean) => void;
  fn: string;
  pipak?: string[];
  pipal?: (k: string, b: boolean) => void;
  lepes: number;
  ugrik: (n: number) => void;
  /** Az utolsó lépés gombja („Feltöltöm az értesítést”, „Beküldtem”, „Jóváhagytam”). */
  vege: { cim: string; onPress: () => void; tolt?: boolean } | null;
  /** „Nem boldogulsz vele? Intézzük helyetted” – kiemelt csík a bevezetőn és minden lépésen. */
  segitseg?: (() => void) | null;
  /** Melyik segítséget kínálja a csík: a bejelentést ('ev', alap) vagy a meghatalmazást ('mh'). */
  segitsegFajta?: 'ev' | 'mh' | 'valtozas';
  egyben: () => void;
  elotte?: React.ReactNode;
  /** A bevezető lap UTÁN (pl. a „soha nem kérjük el a belépésedet” doboz), hogy a „Kezdjük” a hajtás fölött maradjon. */
  utana?: React.ReactNode;
}) {
  const [elokeszitNyitva, setElokeszitNyitva] = useState(false);
  const forras: CallbackSource = g.kind === 'vallalkozas_bejelentes' ? 'vallalkozas_utmutato' : valtozasFajta(g.kind) ? 'valtozas_utmutato' : 'meghatalmazas_utmutato';
  const tema: CallbackTopic = g.kind === 'vallalkozas_bejelentes' ? 'vallalkozas_inditas' : valtozasFajta(g.kind) ? 'valtozas' : 'meghatalmazas';
  const n = g.steps.length;
  const csik = (kompakt: boolean, style?: object) => (segitseg ? <SegitsegCsik fajta={segitsegFajta} fn={fn} onPress={segitseg} kompakt={kompakt} style={style} /> : null);
  if (lepes === 0) {
    const elsoNyitott = g.steps.findIndex((s) => !kesz.includes(s.key));
    return (
      <>
        {g.activityPending ? (
          <View accessibilityRole="alert" style={{ marginBottom: 12, borderRadius: forma.lap, backgroundColor: szin.borostyanAlap, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Ikon3d nev="ora" pt={36} />
            <T m={16} s={650} lh={1.5} c={szin.borostyanSzoveg} style={{ flex: 1 }}>
              {ACTIVITY_PENDING_BANNER}
            </T>
          </View>
        ) : null}
        {elotte}
        {csik(false, { marginTop: elotte ? 12 : 0 })}
        {g.video ? <VideoKartya nev={g.video.name} cim={g.video.title} magas={180} /> : null}
        <Lap style={{ marginTop: g.video || elotte || segitseg ? 12 : 0, padding: 18 }}>
          <T m={17} lh={1.5}>
            {g.intro}
          </T>
          {vanRajzolt(kepek) ? (
            <T m={14} lh={1.45} c={szin.halvany} style={{ marginTop: 10 }}>
              {GUIDE_DRAWN_NOTE}
            </T>
          ) : null}
          <T m={15.5} s={600} lh={1.45} style={{ marginTop: 12 }}>
            {`${n} lépés. Egy képernyőn mindig csak egy, képpel.`}
          </T>
          <GombE cim={kesz.length ? 'Folytatom' : 'Kezdjük'} onPress={() => ugrik(kesz.length ? (elsoNyitott < 0 ? n : elsoNyitott + 1) : 1)} style={{ marginTop: 14 }} />
        </Lap>
        {utana}
        {g.prepare.length && pipak && pipal ? (
          <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: elokeszitNyitva }} onPress={() => setElokeszitNyitva((x) => !x)} style={{ marginTop: 12, minHeight: 52, paddingVertical: 12, paddingHorizontal: 16, borderRadius: forma.lap, backgroundColor: szin.lap }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ikon3d nev="irat" pt={28} />
                <T m={16.5} s={650} style={{ flex: 1 }}>
                  {`Készítsd elő (${pipak.length}/${g.prepare.length})`}
                </T>
                <T m={15} s={600} c={szin.tintakekSzoveg} alahuz>
                  {elokeszitNyitva ? 'Becsukom' : HUB_TEXTS.prepareShowAll}
                </T>
              </View>
              {!elokeszitNyitva ? (
                <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 6 }}>
                  {fillPlaceholders(HUB_TEXTS.prepareSummary, { n: String(g.prepare.length) })}
                </T>
              ) : null}
            </Pressable>
            {elokeszitNyitva ? (
              <View style={{ marginTop: 8 }}>
                <ElokeszitLista elemek={g.prepare} pipak={pipak} valt={pipal} fn={fn} />
              </View>
            ) : null}
          </>
        ) : null}
        {g.outdated && g.outdatedText ? (
          <View style={{ marginTop: 14, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 14 }}>
            <T m={16} s={650} lh={1.5} c={szin.borostyanSzoveg}>
              {g.outdatedText}
            </T>
          </View>
        ) : null}
        <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
          <GombSz cim={HUB_TEXTS.guideAll} onPress={egyben} />
          <Elakadtal forras={forras} tema={tema} style={{ paddingTop: 0 }} />
        </View>
      </>
    );
  }
  const s = g.steps[lepes - 1];
  if (!s) return null;
  const utolso = lepes === n;
  const tovabb = () => {
    valt(s.key, true);
    if (utolso) vege?.onPress();
    else ugrik(lepes + 1);
  };
  const lab = (
    <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: szin.hajszal, paddingTop: 14 }}>
      {s.hold || (utolso && !vege) ? null : <GombE cim={utolso && vege ? vege.cim : HUB_TEXTS.guideNext} tolt={utolso ? vege?.tolt : false} onPress={tovabb} />}
      {csik(true, { marginTop: s.hold ? 0 : 12 })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 22, marginTop: 4 }}>
        <GombSz cim={HUB_TEXTS.guideBack} onPress={() => ugrik(lepes - 1)} />
        <GombSz cim={HUB_TEXTS.guideAll} onPress={egyben} />
      </View>
      <Elakadtal forras={forras} tema={tema} style={{ paddingTop: 0 }} />
    </View>
  );
  return (
    <>
      <LepesHaladas i={lepes} n={n} />
      <LepesLap
        key={s.key}
        s={s}
        kind={g.kind}
        kepek={kepekLepeshez(kepek, s.imageKey, valaszok)}
        kesz={kesz.includes(s.key)}
        valt={(b) => valt(s.key, b)}
        forras={forras}
        tema={tema}
        lab={lab}
        linkHelyett={g.activityPending && lepes <= 2 ? HUB_TEXTS.guideHoldNavButton : null}
      />
      {utolso && g.outro ? (
        <T m={16} lh={1.5} c={szin.halvanyAlapon} style={{ marginTop: 12, paddingHorizontal: 4 }}>
          {g.outro}
        </T>
      ) : null}
    </>
  );
}
