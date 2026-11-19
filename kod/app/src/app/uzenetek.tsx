// 06 Üzenetek (FUNKCIOK 16–17): saját képernyő fülsor nélkül; fejléc a könyvelővel és a válaszidő-vállalással;
// kérés-csempék; beszélgetés (saját buborék tintakék), kérés-kártyák, csatolmány; lebegő író sor „Küldés” kapszulával.
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '@/_shared/api';
import { ApiHiba, post } from '@/api/http';
import { useHome, useMe, useUzenetek, useUzenetKuld, useVisszahivasok } from '@/api/hooks';
import { useHozzaferes, useZarolt } from '@/ui/Zarolt';
import { VisszahivasAllapot, visszahivasUt } from '@/ui/Visszahivas';
import { csatolmanyFeltolt, fajlMegnyit, MAX_MERET } from '@/lib/fajlok';
import { dativ, mikorIdovel } from '@/lib/format';
import { arnyek, betu, forma, szin } from '@/theme/tokens';
import { Allapot, Fejlec } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { Arckep, Ikon3d, type Ikon3dNev } from '@/ui/kepek';
import { Betolt, Fulsor, FULSOR_MAGASSAG, Hiba, MintaJel, useJelzes } from '@/ui/keret';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

// Teljes, szótöréstől mentes feliratok (lágy kötőjel nincs): a hosszabbak két sorba törhetnek a szóköznél / kötőjelnél.
// Két sor két csempével; a csempék szélessége a feliratukhoz igazodik (a „Jövedelemigazolás” így egy sorban marad).
const CSEMPEK: { cim: string; ikon: Ikon3dNev; tipus: string }[] = [
  { cim: 'Jövedelemigazolás', ikon: 'igazolas', tipus: 'jovedelemigazolas' },
  { cim: 'Nullás igazolás', ikon: 'igazolas', tipus: 'nullas_igazolas' },
  { cim: 'Köztartozásmentességi igazolás', ikon: 'igazolas', tipus: 'koztartozasmentes_igazolas' },
  { cim: 'Megváltozott egy adatom', ikon: 'fiok', tipus: 'adatvaltozas' },
];
const CSEMPE_SOROK = [CSEMPEK.slice(0, 2), CSEMPEK.slice(2)];
// SPEC §26.2.1: időpontfoglalás helyett visszahívás – külön csempe, mert nem a könyvelő hív elsőként, hanem a csapatunk.

function Buborek({ m, fn }: { m: Message; fn: string }) {
  const jelez = useJelzes();
  const en = m.sender === 'en';
  const nap = ma();
  if (m.kind === 'keres_kartya' && m.request) {
    const r = m.request;
    return (
      <View style={{ alignSelf: en ? 'flex-end' : 'flex-start', marginTop: 5 }}>
        <View style={{ width: 292, maxWidth: '100%', backgroundColor: szin.lap, borderRadius: 20, borderBottomRightRadius: en ? 6 : 20, borderBottomLeftRadius: en ? 20 : 6, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Ikon3d nev={r.type === 'dokumentum' ? 'feltoltes' : r.type === 'adatvaltozas' || r.type === 'tevekenysegvaltozas' ? 'fiok' : 'igazolas'} pt={40} arnyektalan={false} />
          <View style={{ flex: 1 }}>
            <T m={14} c={szin.halvany}>
              {en ? 'Kérésed' : `${fn} kéri`}
            </T>
            <T m={16} s={650} lh={1.35} style={{ marginTop: 1 }}>
              {r.title}
            </T>
            <Allapot szo={r.statusLabel.split(',')[0]} utana={r.statusLabel.includes(',') ? r.statusLabel.split(',').slice(1).join(',').trim() : undefined} kesz={r.status === 'teljesitve'} style={{ marginTop: 5 }} />
          </View>
        </View>
        <T m={13} c={szin.halvanyAlapon} style={{ alignSelf: en ? 'flex-end' : 'flex-start', marginTop: 3, marginHorizontal: 8, marginBottom: 8 }}>
          {mikorIdovel(m.createdAt, nap)}
        </T>
      </View>
    );
  }
  if (m.sender === 'rendszer') {
    return (
      <T m={13.5} c={szin.halvanyAlapon} kozep lh={1.4} style={{ marginVertical: 8, paddingHorizontal: 24 }}>
        {m.body}
      </T>
    );
  }
  return (
    <View style={{ alignSelf: en ? 'flex-end' : 'flex-start', maxWidth: 290 }}>
      {m.sender === 'csapat' && m.senderName ? (
        <T m={13} s={600} c={szin.halvanyAlapon} style={{ marginLeft: 8, marginBottom: 3 }}>
          {m.senderName}
        </T>
      ) : null}
      <View style={{ paddingTop: 11, paddingHorizontal: 14, paddingBottom: 10, borderRadius: 20, borderBottomRightRadius: en ? 6 : 20, borderBottomLeftRadius: en ? 20 : 6, backgroundColor: en ? szin.tintakek : szin.lap }}>
        {m.body ? (
          <T m={16} lh={1.45} c={en ? '#fff' : szin.tinta} selectable>
            {m.body}
          </T>
        ) : null}
        {m.attachments.map((a) => (
          <Pressable key={a.fileId} accessibilityRole="button" onPress={() => fajlMegnyit(a.fileId, a.displayName).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: m.body ? 8 : 0 }}>
            <Ikon3d nev={a.mime === 'application/pdf' ? 'irat' : 'nyugta'} pt={28} />
            <T m={15} s={500} c={en ? '#fff' : szin.tintakekSzoveg} alahuz numberOfLines={1} style={{ flexShrink: 1 }}>
              {a.displayName}
            </T>
          </Pressable>
        ))}
        {m.document ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/tetel/${m.document?.id}`)} style={{ marginTop: 6 }}>
            <T m={14.5} s={500} c={en ? szin.gombMAlap : szin.tintakekSzoveg} alahuz>
              {m.document.title}
            </T>
          </Pressable>
        ) : null}
      </View>
      <T m={13} c={szin.halvanyAlapon} style={{ alignSelf: en ? 'flex-end' : 'flex-start', marginTop: 3, marginHorizontal: 8, marginBottom: 8 }}>
        {mikorIdovel(m.createdAt, nap)}
        {en && m.readByAccountantAt ? ' · látta' : ''}
      </T>
    </View>
  );
}

export default function Uzenetek() {
  const p = useLocalSearchParams<{ kerdes?: string; irat?: string }>();
  const ins = useSafeAreaInsets();
  const home = useHome();
  const me = useMe();
  const q = useUzenetek();
  const kuld = useUzenetKuld();
  const jelez = useJelzes();
  const hf = useHozzaferes();
  const zarolt = useZarolt();
  const vh = useVisszahivasok();
  const nyitottVh = vh.data?.open ?? null;
  const acc = home.data?.accountant ?? me.data?.accountant;
  const fn = acc?.firstName ?? 'A könyvelőd';
  const [szoveg, setSzoveg] = useState(p.kerdes ?? '');
  const [csatolt, setCsatolt] = useState<{ fileId: string; nev: string }[]>([]);
  const [feltolt, setFeltolt] = useState(false);
  const gorgeto = useRef<ScrollViewInstance>(null);
  // Az író mező egy soros (46 pt), a szöveggel együtt nő 120 pt-ig; küldés után visszaáll.
  const [iroMagas, setIroMagas] = useState(46);
  // 320–359 pt: a kérés-csempék egy oszlopba kerülnek, hogy egy szó se törjön ketté kötőjel nélkül.
  const { width } = useWindowDimensions();
  const egyOszlop = Math.min(width, 480) < 360;
  const uzenetek = [...(q.data?.items ?? [])].reverse();
  const legujabb = q.data?.items[0]?.id;

  useEffect(() => {
    if (legujabb) post('/client/messages/read', { upToId: legujabb }).catch(() => undefined);
  }, [legujabb]);

  async function csatol() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > MAX_MERET) return jelez('A fájl legfeljebb 25 MB lehet.');
    setFeltolt(true);
    try {
      const { fileId } = await csatolmanyFeltolt({ uri: a.uri, nev: a.name, mime: a.mimeType ?? 'application/pdf', webFajl: a.file });
      setCsatolt((c) => [...c, { fileId, nev: a.name }]);
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült csatolni.'));
    } finally {
      setFeltolt(false);
    }
  }

  async function kuldes() {
    const body = szoveg.trim();
    if (!body && !csatolt.length) return;
    try {
      await kuld.mutateAsync({ body: body.slice(0, 4000), fileIds: csatolt.map((c) => c.fileId), documentId: p.irat || undefined });
      setSzoveg('');
      setIroMagas(46);
      setCsatolt([]);
      setTimeout(() => gorgeto.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem ment el. Próbáld újra.'));
    }
  }

  const aktivKuld = !!szoveg.trim() || csatolt.length > 0;
  // S23: a bekötés alatt a fülsor itt is látszik (SPEC §27.4.4): az író sor fölé kerül.
  const fulsorral = hf.korlatozott;
  const alul = (Platform.OS === 'web' ? 30 : Math.max(ins.bottom, 12) + 14) + (fulsorral ? FULSOR_MAGASSAG + 14 : 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: szin.alap }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* A fejléc a görgetőn kívül áll: a beszélgetés a végére görget, Bence mégis mindig látszik (06 első képernyő). */}
      <Fejlec rozX={96} rozY={84} alsoTer={14}>
        <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ height: 32, justifyContent: 'center', paddingHorizontal: 20, alignSelf: 'flex-start' }}>
          <T m={15.5} s={500} c="#fff" alahuz>
            Vissza a főoldalra
          </T>
        </Pressable>
        {/* Jóváhagyott 06: 60 pt-os arckép, 26 pt-os név, 15 pt-os szerep, alatta a válaszidő. A fejlécben nincs külön
            gomb: a „Kérj tőle egy gombnyomással” lap közvetlenül alatta áll, és ugyanazt tudja. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingHorizontal: 20 }}>
          <Arckep pt={egyOszlop ? 48 : 60} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T m={egyOszlop ? 21 : 26} s={700} lh={1.15} ls={-0.022} c="#fff" accessibilityRole="header" numberOfLines={2}>
              {acc?.displayName ?? 'A könyvelőd'}
            </T>
            {acc?.title ? (
              <T m={15} lh={1.35} c={szin.fejlecHalvany} style={{ marginTop: 1 }} numberOfLines={2}>
                {acc.title}
              </T>
            ) : null}
            {acc?.responseTimeText ? (
              <T m={14} lh={1.35} c="#fff" numberOfLines={2}>
                {acc.responseTimeText}
              </T>
            ) : null}
            {hf.korlatozott && !egyOszlop ? (
              <T m={14} lh={1.35} c={szin.fejlecHalvany} numberOfLines={2}>
                A bekötés alatt csapatunk is válaszol.
              </T>
            ) : null}
          </View>
        </View>
        {hf.korlatozott && egyOszlop ? (
          // Keskeny kijelzőn (320–359 pt) a sor a fejléc alá kerül, teljes szélességben, hogy ne vágódjon le.
          <T m={14} lh={1.35} c={szin.fejlecHalvany} numberOfLines={3} style={{ paddingTop: 6, paddingHorizontal: 20 }}>
            A bekötés alatt csapatunk is válaszol.
          </T>
        ) : null}
      </Fejlec>
      <ScrollView ref={gorgeto} onContentSizeChange={() => gorgeto.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: alul + 72 + (nyitottVh ? 70 : 0) }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <View style={{ backgroundColor: szin.lap, borderRadius: forma.lap, paddingTop: 14, paddingHorizontal: 10, paddingBottom: 12 }}>
            <T m={15.5} s={650} style={{ marginHorizontal: 4, marginBottom: 10 }}>
              {hf.korlatozott ? 'Kérdezz bátran:' : 'Kérj tőle egy gombnyomással:'}
            </T>
            {hf.korlatozott ? (
              // S23: a bekötés alatt a négy kérés helyett egy: kérdés a bekötésről (SPEC §27.4.4).
              <Pressable
                accessibilityRole="button"
                onPress={() => setSzoveg((x) => x || 'Kérdésem van a bekötésről: ')}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 4, paddingLeft: 8, paddingRight: 12, borderRadius: forma.mezo, backgroundColor: pressed ? szin.gombMAlap : szin.nyomott, borderWidth: 1, borderColor: szin.hajszal, alignSelf: 'flex-start' })}
              >
                <Ikon3d nev="kerdezek" pt={24} arnyektalan={false} />
                <T m={15} s={600} lh={1.25}>
                  Kérdésed van a bekötésről?
                </T>
              </Pressable>
            ) : null}
            <View style={{ gap: 8, display: hf.korlatozott ? 'none' : 'flex' }}>
              {CSEMPE_SOROK.map((sor, si) => (
                <View key={si} style={{ flexDirection: egyOszlop ? 'column' : 'row', gap: 8 }}>
                  {sor.map((c) => {
                    // Bekötés alatt az igazolás- és adatváltozás-kérés zárva (SPEC §26.5.2 'igazolas_keres'): lakat + ok.
                    const zar = hf.zarva('igazolas_keres');
                    return (
                      <Pressable
                        key={c.tipus}
                        accessibilityRole="button"
                        accessibilityLabel={c.cim}
                        accessibilityState={zar ? { disabled: true } : undefined}
                        accessibilityHint={zar ? hf.ok('igazolas_keres') ?? undefined : undefined}
                        onPress={() => (zar ? zarolt({ feature: 'igazolas_keres' }) : router.push({ pathname: '/keresek/uj', params: { tipus: c.tipus } }))}
                        // a sorban a csempe a felirata szélességéből indul (auto), és arányosan nő / zsugorodik: a rövid
                        // feliratok egy sorban maradnak, a hosszúak szóköznél vagy kötőjelnél törnek két sorba
                        style={({ pressed }) => ({ flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 48, paddingVertical: 4, paddingLeft: 6, paddingRight: 10, borderRadius: forma.mezo, backgroundColor: pressed ? szin.gombMAlap : szin.nyomott, borderWidth: 1, borderColor: szin.hajszal })}
                      >
                        <Ikon3d nev={zar ? 'lakat' : c.ikon} pt={24} arnyektalan={false} />
                        <T m={14.5} s={600} ls={-0.01} lh={1.25} numberOfLines={2} style={{ flexShrink: 1 }} c={zar ? szin.halvany : szin.tinta}>
                          {c.cim}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Visszahívást kérek. Csapatunk 24–48 órán belül hív."
            onPress={() => router.push(visszahivasUt('uzenetek', 'egyeb'))}
            style={({ pressed }) => ({ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 12, borderRadius: forma.lap, backgroundColor: pressed ? szin.gombMAlap : szin.lap })}
          >
            <Ikon3d nev="ora" pt={32} />
            <View style={{ flex: 1 }}>
              <T m={15.5} s={650} lh={1.3}>
                Visszahívást kérek
              </T>
              <T m={14} lh={1.35} c={szin.halvany}>
                Csapatunk 24–48 órán belül hív.
              </T>
            </View>
          </Pressable>
          <View style={{ marginTop: 14, gap: 3 }}>
            {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : uzenetek.length ? (
              uzenetek.map((m) => <Buborek key={m.id} m={m} fn={fn} />)
            ) : (
              <T m={15.5} c={szin.halvanyAlapon} kozep lh={1.5} style={{ marginTop: 18, paddingHorizontal: 20 }}>
                Még nem írtatok egymásnak. Kérdezz bátran: {acc?.responseTimeText?.toLowerCase() ?? 'hamar válaszol'}.
              </T>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 14, right: 14, bottom: alul }}>
        {nyitottVh ? <VisszahivasAllapot cb={nyitottVh} kompakt forras="uzenetek" style={{ marginBottom: 8 }} /> : null}
        {csatolt.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {csatolt.map((c) => (
              <Pressable key={c.fileId} onPress={() => setCsatolt((x) => x.filter((y) => y !== c))} accessibilityRole="button" accessibilityLabel={`${c.nev} eltávolítása`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 8, backgroundColor: szin.lap }}>
                <T m={13.5} s={500} numberOfLines={1} style={{ maxWidth: 200 }}>
                  {c.nev}
                </T>
                <T m={13} s={600} c={szin.tintakekSzoveg} alahuz>
                  Eltávolítom
                </T>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 14, backgroundColor: szin.lap, borderWidth: 1, borderColor: szin.mezoKeret, paddingLeft: 4, paddingRight: 6, ...arnyek.lebego, shadowOpacity: 0.12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fájl csatolása" onPress={() => void csatol()} disabled={feltolt} style={{ width: 44, height: 46, alignItems: 'center', justifyContent: 'center', opacity: feltolt ? 0.5 : 1 }}>
            <Ikon3d nev="feltoltes" pt={30} arnyektalan={false} />
          </Pressable>
          <TextInput
            value={szoveg}
            onChangeText={setSzoveg}
            placeholder={`Írj ${acc ? dativ(acc.nameForms.onto) : 'a könyvelődnek'}…`}
            placeholderTextColor={szin.halvany}
            multiline
            // weben a <textarea> alapból két soros (rows=2): ettől csúszott a helykitöltő a sor közepe fölé
            {...(Platform.OS === 'web' ? ({ rows: 1 } as object) : null)}
            onContentSizeChange={(e) => setIroMagas(Math.max(46, Math.min(120, Math.ceil(e.nativeEvent.contentSize.height))))}
            maxLength={4000}
            accessibilityLabel="Üzenet"
            style={[
              { flex: 1, fontSize: 16, lineHeight: 22, color: szin.tinta, paddingTop: 12, paddingBottom: 12, maxHeight: 120, minHeight: 46, textAlignVertical: 'center' },
              Platform.OS === 'web' ? { height: szoveg ? iroMagas : 46 } : null,
              betu(400),
              { outlineStyle: 'none' } as object,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!aktivKuld || kuld.isPending}
            onPress={() => void kuldes()}
            style={{ height: 34, paddingHorizontal: 12, borderRadius: forma.gomb, backgroundColor: aktivKuld ? szin.tintakek : szin.nyomott, justifyContent: 'center' }}
          >
            <T m={14.5} s={600} c={aktivKuld ? '#fff' : '#7A8396'}>
              Küldés
            </T>
          </Pressable>
        </View>
      </View>
      {fulsorral ? <Fulsor aktiv="uzenetek" /> : null}
      <MintaJel />
    </KeyboardAvoidingView>
  );
}
