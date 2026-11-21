// 06 Üzenetek (FUNKCIOK 16–17) – v2 (k8, minta: dizajn/C5_v2/70_uzenetek, asztali/A70): fejléc a könyvelővel és a
// válaszidővel; „Kérj tőle egy gombnyomással” lista; visszahívás; beszélgetés (saját buborék kék, a könyvelőé fehér kártya),
// kérés-kártyák, csatolmány; író sáv gemkapoccsal és sárga kerek küldés-gombbal, alatta az alsó sáv. Gépen két panel:
// balra a könyvelő, a visszahívás, a kérések és a javasolt kérdések, jobbra a beszélgetés.
import { useEffect, useRef, useState } from 'react';
import { LOCK_TEXTS, SUGGESTED_QUESTIONS } from '@/_shared/bekotes';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '@/_shared/api';
import { ApiHiba, post } from '@/api/http';
import { useHome, useMe, useUzenetek, useUzenetKuld, useVisszahivasok } from '@/api/hooks';
import { useHozzaferes, useZarolt } from '@/ui/Zarolt';
import { HIVAS_MONDAT, VisszahivasAllapot, visszahivasUt } from '@/ui/Visszahivas';
import { csatolmanyFeltolt, fajlMegnyit, MAX_MERET } from '@/lib/fajlok';
import { dativ, mikorIdovel } from '@/lib/format';
import { arnyek, betu, forma, szin } from '@/theme/tokens';
import { Allapot, Fejlec, IkonCsempe, Lap, Sor, Szakasz } from '@/ui/alap';
import { VezerloIkon } from '@/_shared/v2/rn';
import { useAsztali, useAsztaliMeretek } from '@/lib/elrendezes';
import { TeljesCtx } from '@/ui/teljes';
import { useServiceLock } from '@/ui/Zarolas';
import { ma } from '@/ui/ido';
import { Arckep, Ikon3d, type IkonNev } from '@/ui/kepek';
import { Betolt, Fulsor, FULSOR_MAGASSAG, Hiba, useJelzes } from '@/ui/keret';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

// Teljes, szótöréstől mentes feliratok (lágy kötőjel nincs): a hosszabbak két sorba törhetnek a szóköznél / kötőjelnél.
// Két sor két csempével; a csempék szélessége a feliratukhoz igazodik (a „Jövedelemigazolás” így egy sorban marad).
const CSEMPEK: { cim: string; ikon: IkonNev; tipus: string }[] = [
  { cim: 'Jövedelemigazolás', ikon: 'irat', tipus: 'jovedelemigazolas' },
  { cim: 'Nullás igazolás', ikon: 'pipa-kor', tipus: 'nullas_igazolas' },
  { cim: 'Köztartozásmentességi igazolás', ikon: 'pajzs', tipus: 'koztartozasmentes_igazolas' },
  { cim: 'Megváltozott egy adatom', ikon: 'valtozas', tipus: 'adatvaltozas' },
];
// SPEC §26.2.1: időpontfoglalás helyett visszahívás – külön csempe, mert nem a könyvelő hív elsőként, hanem a csapatunk.

function Buborek({ m, fn }: { m: Message; fn: string }) {
  const jelez = useJelzes();
  const en = m.sender === 'en';
  const nap = ma();
  if (m.kind === 'keres_kartya' && m.request) {
    const r = m.request;
    return (
      <View style={{ alignSelf: en ? 'flex-end' : 'flex-start', marginTop: 5 }}>
        <View style={{ width: 300, maxWidth: '100%', backgroundColor: szin.lap, borderRadius: 18, borderBottomRightRadius: en ? 6 : 18, borderBottomLeftRadius: en ? 18 : 6, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', ...arnyek.kartya }}>
          <IkonCsempe nev={r.type === 'dokumentum' ? 'feltoltes' : r.type === 'adatvaltozas' || r.type === 'tevekenysegvaltozas' ? 'valtozas' : 'irat'} />
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
    <View style={{ alignSelf: en ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
      {m.sender === 'csapat' && m.senderName ? (
        <T m={13} s={600} c={szin.halvanyAlapon} style={{ marginLeft: 8, marginBottom: 3 }}>
          {m.senderName}
        </T>
      ) : null}
      <View style={[{ paddingTop: 10, paddingHorizontal: 14, paddingBottom: 10, borderRadius: 18, borderBottomRightRadius: en ? 6 : 18, borderBottomLeftRadius: en ? 18 : 6, backgroundColor: en ? szin.tintakek : szin.lap }, en ? null : arnyek.kartya]}>
        {m.body ? (
          <T m={16} lh={1.45} c={en ? '#fff' : szin.tinta} selectable>
            {m.body}
          </T>
        ) : null}
        {m.attachments.map((a) => (
          <Pressable key={a.fileId} accessibilityRole="button" onPress={() => fajlMegnyit(a.fileId, a.displayName).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: m.body ? 8 : 0 }}>
            <VezerloIkon nev="gemkapocs" pt={18} szin={en ? '#fff' : szin.tintakek} />
            <T m={15} s={500} c={en ? '#fff' : szin.tintakekSzoveg} alahuz numberOfLines={1} style={{ flexShrink: 1 }}>
              {a.displayName}
            </T>
          </Pressable>
        ))}
        {m.document ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(`/tetel/${m.document?.id}`)} style={{ marginTop: 6 }}>
            <T m={14.5} s={600} c={en ? '#fff' : szin.tintakekSzoveg} alahuz>
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
  // k6c2 (§28.K.5): the lock banner's "Írok az ügyfélszolgálatnak" opens this thread – say who answers
  const { lock } = useServiceLock();
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
  const [iroMagas, setIroMagas] = useState(42);
  // 320–359 pt: a kérés-csempék egy oszlopba kerülnek, hogy egy szó se törjön ketté kötőjel nélkül.
  const { height: magassag } = useWindowDimensions();
  const asztali = useAsztali();
  const meret = useAsztaliMeretek();
  const [fokusz, setFokusz] = useState(false);
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
      setIroMagas(42);
      setCsatolt([]);
      setTimeout(() => gorgeto.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem ment el. Próbáld újra.'));
    }
  }

  const aktivKuld = !!szoveg.trim() || csatolt.length > 0;
  const NAV = FULSOR_MAGASSAG + (Platform.OS === 'web' ? 6 : ins.bottom);
  const zarKeres = hf.zarva('igazolas_keres');

  // ---------- részek ----------
  const fej = (
    <Fejlec alsoTer={22}>
      <View style={{ paddingHorizontal: asztali ? 16 : 18 }}>
        {asztali ? null : (
          <T m={27} s={800} lh={1.14} ls={-0.025} c="#fff" accessibilityRole="header" style={{ marginTop: 10 }}>
            Üzenetek
          </T>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: asztali ? 0 : 10 }}>
          <View style={{ borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }}>
            <Arckep pt={32} />
          </View>
          <T m={15} lh={1.3} c={szin.fejlecHalvany} style={{ flex: 1 }} numberOfLines={2}>
            <T m={15} s={650} c="#fff">
              {acc?.displayName ?? 'A könyvelőd'}
            </T>
            {acc?.title ? ` · ${acc.title}` : ' · a könyvelőd'}
          </T>
        </View>
        {asztali ? (
          <T m={30} s={800} lh={1.14} ls={-0.025} c="#fff" accessibilityRole="header" style={{ marginTop: 10 }}>
            Üzenetek
          </T>
        ) : null}
        {acc?.responseTimeText || lock || hf.korlatozott ? (
          <T m={14.5} lh={1.4} c={szin.fejlecHalvany} style={{ marginTop: 6 }} numberOfLines={3}>
            {[acc?.responseTimeText, lock ? LOCK_TEXTS.supportLine : null, hf.korlatozott ? 'A bekötés alatt csapatunk is válaszol.' : null].filter(Boolean).join(' ')}
          </T>
        ) : null}
      </View>
    </Fejlec>
  );

  const keresSorok = hf.korlatozott ? (
    // S23: a bekötés alatt a négy kérés helyett egy: kérdés a bekötésről (SPEC §27.4.4).
    <Sor elso ikon="kerdes" cim="Kérdésed van a bekötésről?" onPress={() => setSzoveg((x) => x || 'Kérdésem van a bekötésről: ')} />
  ) : (
    CSEMPEK.map((c, i) => (
      // Bekötés alatt az igazolás- és adatváltozás-kérés zárva (SPEC §26.5.2 'igazolas_keres'): lakat + ok.
      <Sor
        key={c.tipus}
        elso={i === 0}
        ikon={zarKeres ? 'lakat' : c.ikon}
        cim={c.cim}
        minH={56}
        label={c.cim}
        zaroltOk={zarKeres ? (hf.ok('igazolas_keres') ?? undefined) : undefined}
        cimSzin={zarKeres ? szin.halvany : undefined}
        onPress={() => (zarKeres ? zarolt({ feature: 'igazolas_keres' }) : router.push({ pathname: '/keresek/uj', params: { tipus: c.tipus } }))}
      />
    ))
  );

  const visszahivasSor = (
    <Sor
      elso
      ikon="telefon"
      cim="Visszahívást kérek"
      al={HIVAS_MONDAT}
      label={`Visszahívást kérek. ${HIVAS_MONDAT}`}
      onPress={() => router.push(visszahivasUt('uzenetek', 'egyeb'))}
    />
  );

  const beszelgetes = q.isLoading ? (
    <Betolt />
  ) : q.error ? (
    <Hiba hiba={q.error} ujra={() => void q.refetch()} />
  ) : uzenetek.length ? (
    uzenetek.map((m) => <Buborek key={m.id} m={m} fn={fn} />)
  ) : (
    <T m={15.5} c={szin.halvany} kozep lh={1.5} style={{ marginTop: 18, paddingHorizontal: 20 }}>
      Még nem írtatok egymásnak. Kérdezz bátran: {acc?.responseTimeText?.toLowerCase() ?? 'hamar válaszol'}.
    </T>
  );

  const javasolt = !szoveg.trim() && !csatolt.length;

  const csatoltSor = csatolt.length ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {csatolt.map((c) => (
        <Pressable key={c.fileId} onPress={() => setCsatolt((x) => x.filter((y) => y !== c))} accessibilityRole="button" accessibilityLabel={`${c.nev} eltávolítása`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: szin.kekVil }}>
          <VezerloIkon nev="gemkapocs" pt={16} szin={szin.tintakek} />
          <T m={13.5} s={600} numberOfLines={1} style={{ maxWidth: 200 }}>
            {c.nev}
          </T>
          <VezerloIkon nev="bezar" pt={16} szin={szin.tintakek} />
        </Pressable>
      ))}
    </View>
  ) : null;

  // v2 .uzenet-sav: gemkapocs · pirula mező · sárga kerek küldés
  const iro = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fájl csatolása" onPress={() => void csatol()} disabled={feltolt} style={({ pressed }) => ({ width: 44, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, opacity: feltolt ? 0.5 : pressed ? 0.6 : 1 })}>
        <VezerloIkon nev="gemkapocs" pt={24} szin={szin.halvany} />
      </Pressable>
      <View style={{ flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1.5, borderColor: fokusz ? szin.tintakek : szin.keret, backgroundColor: '#fff', paddingHorizontal: 16, justifyContent: 'center', ...(fokusz ? arnyek.mezoFokusz : null) }}>
        <TextInput
          value={szoveg}
          onChangeText={setSzoveg}
          onFocus={() => setFokusz(true)}
          onBlur={() => setFokusz(false)}
          placeholder={`Írj ${acc ? dativ(acc.nameForms.onto) : 'a könyvelődnek'}…`}
          placeholderTextColor={szin.halvany}
          multiline
          // weben a <textarea> alapból két soros (rows=2): ettől csúszott a helykitöltő a sor közepe fölé
          {...(Platform.OS === 'web' ? ({ rows: 1 } as object) : null)}
          onContentSizeChange={(e) => setIroMagas(Math.max(42, Math.min(120, Math.ceil(e.nativeEvent.contentSize.height))))}
          maxLength={4000}
          accessibilityLabel="Üzenet"
          style={[
            { fontSize: 16, lineHeight: 22, color: szin.tinta, paddingTop: 10, paddingBottom: 10, maxHeight: 120, minHeight: 42, textAlignVertical: 'center' },
            Platform.OS === 'web' ? { height: szoveg ? iroMagas : 42 } : null,
            betu(400),
            { outlineStyle: 'none' } as object,
          ]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Küldés"
        disabled={!aktivKuld || kuld.isPending}
        onPress={() => void kuldes()}
        style={({ pressed }) => [{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: aktivKuld ? (pressed ? '#F7BD22' : szin.sarga) : szin.letiltvaAlap }, aktivKuld ? arnyek.gombKis : null]}
      >
        <VezerloIkon nev="kuld" pt={21} szin={aktivKuld ? szin.sotet : szin.letiltvaSzoveg} />
      </Pressable>
    </View>
  );

  // ---------- gépen: két panel (A70) ----------
  if (asztali) {
    const chatMagas = Math.max(480, magassag - 300);
    return (
      <View style={{ flex: 1, backgroundColor: szin.alap }}>
        <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 1120 + 2 * meret.margo.oldal, alignSelf: 'center', paddingHorizontal: meret.margo.oldal, paddingTop: meret.margo.fent, paddingBottom: meret.margo.lent }}>
          {fej}
          <View style={{ flexDirection: 'row', gap: 22, alignItems: 'flex-start' }}>
            <View style={{ width: meret.szeles ? 340 : 300 }}>
              <TeljesCtx.Provider value>
                <Lap>
                  <Szakasz cim="Ha inkább beszélnél vele" style={{ paddingHorizontal: 14, paddingTop: 14 }} />
                  {visszahivasSor}
                </Lap>
                {nyitottVh ? <VisszahivasAllapot cb={nyitottVh} kompakt forras="uzenetek" style={{ marginBottom: 12 }} /> : null}
                <Lap>
                  <Szakasz cim={hf.korlatozott ? 'Kérdezz bátran' : 'Kérj tőle egy gombnyomással'} style={{ paddingHorizontal: 14, paddingTop: 14 }} />
                  {keresSorok}
                </Lap>
                <Lap>
                  <Szakasz cim="Javasolt kérdések" style={{ paddingHorizontal: 14, paddingTop: 14 }} />
                  {SUGGESTED_QUESTIONS.map((k, i) => (
                    <Sor key={k} elso={i === 0} cim={k} cimSzin={szin.tintakek} minH={48} label={`Javasolt kérdés: ${k}`} onPress={() => setSzoveg(k)} />
                  ))}
                </Lap>
              </TeljesCtx.Provider>
            </View>
            <View style={{ flex: 1, minWidth: 0, height: chatMagas, backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', ...arnyek.kartya }}>
              <View style={{ paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: szin.hajszal }}>
                <T m={18} s={750} accessibilityRole="header">
                  Beszélgetés {acc ? acc.nameForms.with : 'a könyvelőddel'}
                </T>
              </View>
              <ScrollView ref={gorgeto} onContentSizeChange={() => gorgeto.current?.scrollToEnd({ animated: false })} style={{ flex: 1, backgroundColor: szin.alap }} contentContainerStyle={{ padding: 22, gap: 3 }}>
                {beszelgetes}
              </ScrollView>
              <View style={{ borderTopWidth: 1, borderTopColor: szin.hajszal, paddingVertical: 12, paddingHorizontal: 18 }}>
                {csatoltSor}
                {iro}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---------- telefon ----------
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: szin.alap }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* A fejléc a görgetőn kívül áll: a beszélgetés a végére görget, a könyvelő mégis mindig látszik (06). */}
      {fej}
      <ScrollView ref={gorgeto} onContentSizeChange={() => gorgeto.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: NAV + 96 + (javasolt ? 48 : 0) + (nyitottVh ? 70 : 0) }}>
        <TeljesCtx.Provider value>
          <View style={{ paddingHorizontal: 12, paddingTop: 14 }}>
            <Szakasz cim={hf.korlatozott ? 'Kérdezz bátran' : 'Kérj tőle egy gombnyomással'} style={{ paddingTop: 2 }} />
            <Lap>{keresSorok}</Lap>
            <Lap>{visszahivasSor}</Lap>
            <View style={{ marginTop: 6, gap: 3 }}>{beszelgetes}</View>
          </View>
        </TeljesCtx.Provider>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: NAV, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 12, ...arnyek.sav }}>
        {nyitottVh ? <VisszahivasAllapot cb={nyitottVh} kompakt forras="uzenetek" style={{ marginBottom: 8 }} /> : null}
        {/* SPEC §28.K.12 #7: 3–4 javasolt kérdés az író sor fölött; koppintásra csak kitölti, az ügyfél küldi el */}
        {javasolt ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
            {SUGGESTED_QUESTIONS.map((k) => (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={`Javasolt kérdés: ${k}`} onPress={() => setSzoveg(k)} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap, justifyContent: 'center' })}>
                <T m={15} s={650} c={szin.tintakek} numberOfLines={1}>
                  {k}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {csatoltSor}
        {iro}
      </View>
      <Fulsor aktiv="uzenetek" dokkFelette />
    </KeyboardAvoidingView>
  );
}
