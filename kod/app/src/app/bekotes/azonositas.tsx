// Azonosítás (FUNKCIOK 5, SPEC §10.3; Pmt. 7. §): az igazolvány oldalai és a lakcímkártyának CSAK a lakcímes oldala
// (kártya alakú keretben; a hátoldalát soha nem kérjük, SPEC §26.1.9), a törvény kérte adatok és nyilatkozatok. Titkosítva tároljuk, csak a könyvelő látja.
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { ApiHiba, feltolt } from '@/api/http';
import { K, useKyc, useOnboarding, useProfil } from '@/api/hooks';
import { elokeszit, hozzaad, type HelyiFajl } from '@/lib/fajlok';
import { datumHiba, datumNormal } from '@/lib/validators';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Pipa, Szakasz, Valaszto } from '@/ui/alap';
import { Ikon3d, Targykep } from '@/ui/kepek';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { Elakadtal } from '@/ui/Visszahivas';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { szoveg } from '@/lib/szovegek';
import { hibaUzenet } from '@/lib/hiba';

// A lakcímkártyának CSAK a lakcímes oldala kell: a másik oldalon a személyi azonosító van, azt a Pmt. 7. § (8) szerint
// nem másolhatjuk (jogi megjegyzés, SPEC §24). Útlevélnél csak az adatoldal kell.
type Hely = 'idFront' | 'idBack' | 'addressFront';
type Okmany = 'szemelyi' | 'utlevel' | 'jogositvany';
function helyek(o: Okmany): { k: Hely; cim: string; al: string }[] {
  const nev = o === 'szemelyi' ? 'Személyi igazolvány' : o === 'utlevel' ? 'Útlevél' : 'Jogosítvány';
  const l: { k: Hely; cim: string; al: string }[] =
    o === 'utlevel'
      ? [{ k: 'idFront', cim: 'Útlevél, adatoldal', al: 'A fényképes oldal' }]
      : [
          { k: 'idFront', cim: `${nev}, eleje`, al: 'A fényképes oldal' },
          { k: 'idBack', cim: `${nev}, hátoldala`, al: o === 'szemelyi' ? 'Az aláírásos oldal' : 'A kategóriák oldala' },
        ];
  l.push({ k: 'addressFront', cim: 'Lakcímkártya, a lakcímes oldal', al: szoveg('azonositas.lakcimkartya', {}, 'Csak a lakcímes oldalát fotózd le; a másik oldalát nem kérjük.') });
  return l;
}

function KartyaHely({ cim, al, fajl, valaszt }: { cim: string; al: string; fajl?: HelyiFajl; valaszt: (f: HelyiFajl) => void }) {
  const jelez = useJelzes();
  async function kamera() {
    try {
      if (Platform.OS !== 'web') {
        const e = await ImagePicker.requestCameraPermissionsAsync();
        if (!e.granted) return jelez('A fotózáshoz engedélyezd a kamerát a beállításokban.');
      }
      const r = Platform.OS === 'web' ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }) : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      valaszt({ uri: a.uri, nev: a.fileName ?? 'igazolvany.jpg', mime: a.mimeType ?? 'image/jpeg', webFajl: a.file });
    } catch {
      jelez('Nem sikerült megnyitni a kamerát.');
    }
  }
  async function fajlbol() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > 25 * 1024 * 1024) return jelez('A fájl legfeljebb 25 MB lehet.');
    valaszt({ uri: a.uri, nev: a.name, mime: a.mimeType ?? 'image/jpeg', webFajl: a.file });
  }
  return (
    <View style={{ marginTop: 14 }}>
      <T m={15.5} s={600} lh={1.35}>
        {cim}
      </T>
      <T m={13.5} c={szin.halvany}>
        {al}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cim}: lefotózom`}
        onPress={kamera}
        style={{ marginTop: 8, aspectRatio: 85.6 / 54, borderRadius: 14, borderWidth: fajl ? 0 : 1.5, borderStyle: 'dashed', borderColor: '#A8B2DB', backgroundColor: fajl ? szin.kamera : szin.mezoAlap, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
      >
        {fajl ? (
          fajl.mime.startsWith('image/') ? (
            <Image source={{ uri: fajl.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Ikon3d nev="irat" pt={44} />
              <T m={14} c="#fff">
                {fajl.nev}
              </T>
            </View>
          )
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Ikon3d nev="fotozas" pt={36} />
            <T m={15} s={650} c={szin.tintakekSzoveg}>
              Lefotózom
            </T>
            <T m={13} c={szin.halvany}>
              Tedd sötét asztalra, a kártya töltse ki a keretet.
            </T>
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', columnGap: 16 }}>
        {fajl ? <GombSz cim="Újra lefotózom" m={14.5} onPress={kamera} /> : null}
        <GombSz cim="Fájlból választom" m={14.5} onPress={fajlbol} />
      </View>
    </View>
  );
}

export default function Azonositas() {
  const o = useOnboarding();
  const kyc = useKyc();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const fn = o.data?.accountant.firstName ?? 'A könyvelőd';
  const [kepek, setKepek] = useState<Partial<Record<Hely, HelyiFajl>>>({});
  const [a, setA] = useState({ nev: '', szuletesiNev: '', anyjaNeve: '', szuletesiHely: '', szuletesiIdo: '', allampolgarsag: 'magyar', lakcim: '', okmanyTipus: 'szemelyi' as Okmany, okmanySzam: '', lejarat: '' });
  const HELYEK = helyek(a.okmanyTipus);
  const [ny, setNy] = useState({ sajat: false, valos: false, valtozas: false, pep: null as 'nem' | 'igen' | null, pepReszlet: '' });
  const [h, setH] = useState<Record<string, string | null>>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [folyamat, setFolyamat] = useState<number | null>(null);
  const al = (k: keyof typeof a) => (v: string) => {
    setA((x) => ({ ...x, [k]: v }));
    setH((x) => (x[k] ? { ...x, [k]: null } : x));
  };
  // Név és lakcím: amit két lépéssel korábban már megadott, azt nem kérjük újra gépelni (csak üres mezőbe írjuk).
  const profil = useProfil();
  useEffect(() => {
    const d = profil.data;
    if (!d) return;
    const nev = `${d.lastName ?? ''} ${d.firstName ?? ''}`.trim();
    const lakcim = d.address?.zip ? `${d.address.zip} ${d.address.city}, ${d.address.line}`.trim() : '';
    setA((x) => ({ ...x, nev: x.nev || nev, lakcim: x.lakcim || lakcim }));
  }, [profil.data]);

  const statusz = kyc.data?.status;
  if (statusz === 'bekuldve' || statusz === 'elfogadva') {
    return (
      <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim="Igazolványok" al={statusz === 'elfogadva' ? 'Kész.' : 'Elküldted.'} />}>
        <Lap style={{ padding: 18, alignItems: 'center' }}>
          <Targykep nev="meghatalmazas_alairva" style={{ marginBottom: 10 }} />
          <T m={17} s={650} kozep lh={1.4}>
            {statusz === 'elfogadva' ? `${fn} átnézte, minden rendben.` : `${fn} átnézi az igazolványaidat.`}
          </T>
          {statusz !== 'elfogadva' ? (
            <T m={15.5} s={600} kozep lh={1.5} style={{ marginTop: 4 }}>
              Általában 1 munkanapon belül. Ha valamit pótolni kell, szólunk.
            </T>
          ) : null}
          <T m={15.5} c={szin.halvany} kozep lh={1.5} style={{ marginTop: 4 }}>
            {szoveg('azonositas.titkositas', { 'konyvelo.keresztnev': fn }, `Titkosítva tároljuk, csak ${fn} látja.`)} {szoveg('azonositas.megorzes', {}, 'A törvény szerint 8 évig meg kell őriznünk.')}
          </T>
        </Lap>
        <Elakadtal forras="azonositas" tema="azonositas" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  // SPEC §26.1.6: új vállalkozásnál a bejelentés beküldéséig zárva (a szerver 409 'step_locked'-del is véd).
  // A lépéslista nem nyitja meg, de mélylinkkel ide lehet jutni: ilyenkor ugyanaz a lakatos lap, mint az előfizetésnél.
  const lepes = o.data?.steps.find((x) => x.step === 'azonositas');
  if (lepes?.locked) {
    return (
      <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim="Igazolványok" />}>
        <Lap style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ikon3d nev="lakat" pt={44} label="Zárolva" />
            <T m={17} s={600} lh={1.45} style={{ flex: 1 }}>
              {lepes.lockedReason ?? 'Ha beküldted a bejelentést, ez is megnyílik.'}
            </T>
          </View>
          <MiEz kulcs="szemelyi_foto" forras="azonositas" tema="azonositas" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
          <GombM cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 14 }} />
        </Lap>
        <Elakadtal forras="azonositas" tema="azonositas" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  async function kuld() {
    const e: Record<string, string | null> = {
      nev: a.nev.trim() ? null : 'Írd be a neved, ahogy az igazolványban áll.',
      anyjaNeve: a.anyjaNeve.trim() ? null : 'Írd be anyukád születési nevét.',
      szuletesiHely: a.szuletesiHely.trim() ? null : 'Írd be a születési helyed.',
      szuletesiIdo: datumHiba(a.szuletesiIdo),
      allampolgarsag: a.allampolgarsag.trim() ? null : 'Írd be.',
      lakcim: a.lakcim.trim() ? null : 'Írd be a lakcímed.',
      okmanySzam: a.okmanySzam.trim() ? null : 'Írd be az igazolvány számát.',
      lejarat: datumHiba(a.lejarat),
      pep: ny.pep ? null : 'Válassz egyet.',
    };
    setH(e);
    const hianyzoKep = HELYEK.find((x) => !kepek[x.k]);
    if (hianyzoKep) return setHiba(`Hiányzik a kép: ${hianyzoKep.cim.toLowerCase()}.`);
    if (Object.values(e).some(Boolean)) return setHiba('Nézd át a pirossal jelölt mezőket.');
    if (!ny.sajat || !ny.valos || !ny.valtozas) return setHiba('A nyilatkozatokat be kell jelölnöd.');
    setHiba(null);
    setFolyamat(0);
    try {
      const form = new FormData();
      for (const x of HELYEK) await hozzaad(form, x.k, await elokeszit(kepek[x.k] as HelyiFajl));
      form.append('documentType', a.okmanyTipus);
      form.append(
        'data',
        JSON.stringify({
          name: a.nev.trim(), birthName: a.szuletesiNev.trim() || a.nev.trim(), mothersBirthName: a.anyjaNeve.trim(), birthPlace: a.szuletesiHely.trim(), birthDate: datumNormal(a.szuletesiIdo),
          citizenship: a.allampolgarsag.trim(), address: a.lakcim.trim(), documentType: a.okmanyTipus, documentNumber: a.okmanySzam.trim(), documentExpiry: datumNormal(a.lejarat),
        }),
      );
      form.append('declarations', JSON.stringify({ ownBehalf: ny.sajat, pep: ny.pep === 'igen', pepDetails: ny.pep === 'igen' ? ny.pepReszlet.trim() : undefined, truthful: ny.valos, notifyChanges: ny.valtozas, signedAt: new Date().toISOString() }));
      await feltolt('/client/kyc', form, setFolyamat);
      await qc.invalidateQueries({ queryKey: K.kyc });
      await qc.invalidateQueries({ queryKey: K.onboarding });
      jelez({ szoveg: `Elküldted. ${fn} átnézi.`, kesz: true });
      router.replace('/bekotes');
    } catch (err) {
      setHiba(hibaUzenet(err, 'Nem sikerült elküldeni. Próbáld újra.'));
    } finally {
      setFolyamat(null);
    }
  }

  return (
    <Kepernyo
      ful="fooldal"
      fejlec={
        <CimSor
          visszaCim="Vissza a Főoldalra"
          vissza={() => vissza('/bekotes')}
          cim="Igazolványok"
          al={`${szoveg('azonositas.miert', { 'konyvelo.keresztnev': fn }, 'A pénzmosás elleni törvény miatt kérjük az okmányaid fotóját és néhány adatot.')} ${szoveg('azonositas.titkositas', { 'konyvelo.keresztnev': fn }, `Titkosítva tároljuk, csak ${fn} látja.`)}`}
        />
      }
    >
      {statusz === 'hianyos' && kyc.data?.reviewNote ? (
        <View style={{ borderRadius: 12, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }}>
          <T m={15} s={650} c={szin.borostyanSzoveg} lh={1.45}>
            {fn} kéri: {kyc.data.reviewNote}
          </T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, marginBottom: 6, paddingHorizontal: 4 }}>
        <MiEz kulcs="szemelyi_foto" cim="Mi ez? Az igazolvány" forras="azonositas" tema="azonositas" />
        <MiEz kulcs="lakcimkartya_foto" cim="A lakcímkártya" forras="azonositas" tema="azonositas" />
      </View>
      <Lap style={{ padding: 18 }}>
        <T m={15} s={600} style={{ marginBottom: 7 }}>
          Melyik igazolvánnyal azonosítasz?
        </T>
        <Valaszto
          elemek={[
            { kulcs: 'szemelyi' as const, cim: 'Személyi igazolvány', al: 'Két oldal' },
            { kulcs: 'utlevel' as const, cim: 'Útlevél', al: 'Az adatoldal' },
            { kulcs: 'jogositvany' as const, cim: 'Kártya formátumú jogosítvány', al: 'Két oldal' },
          ]}
          ertek={a.okmanyTipus}
          valt={(k) => setA((x) => ({ ...x, okmanyTipus: k }))}
        />
        <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 10 }}>
          {szoveg('azonositas.foto_tipp', {}, 'Éles legyen, minden sarok látsszon, ne tükröződjön.')}
        </T>
      </Lap>
      <Lap style={{ paddingHorizontal: 18, paddingBottom: 12, paddingTop: 4, marginTop: 12 }}>
        {HELYEK.map((x) => (
          <KartyaHely key={x.k} cim={x.cim} al={x.al} fajl={kepek[x.k]} valaszt={(f) => setKepek((k) => ({ ...k, [x.k]: f }))} />
        ))}
      </Lap>

      <Szakasz cim="Az adataid" megj="Ahogy az igazolványodban szerepel." />
      <Lap style={{ padding: 18, gap: 14 }}>
        <Mezo felirat="Családi és utónév" value={a.nev} onChangeText={al('nev')} hiba={h.nev} autoComplete="name" />
        <Mezo felirat="Születési neved (ha más)" hol="szuletesi_nev" holForras="azonositas" holTema="azonositas" value={a.szuletesiNev} onChangeText={al('szuletesiNev')} />
        <Mezo felirat="Anyukád születési neve" hol="anyja_szuletesi_neve" holForras="azonositas" holTema="azonositas" value={a.anyjaNeve} onChangeText={al('anyjaNeve')} hiba={h.anyjaNeve} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Mezo felirat="Születési hely" value={a.szuletesiHely} onChangeText={al('szuletesiHely')} hiba={h.szuletesiHely} style={{ flex: 1 }} />
          <Mezo felirat="Születési idő" value={a.szuletesiIdo} onChangeText={al('szuletesiIdo')} placeholder="ÉÉÉÉ-HH-NN" hiba={h.szuletesiIdo} style={{ flex: 1 }} keyboardType="numbers-and-punctuation" />
        </View>
        <Mezo felirat="Állampolgárság" value={a.allampolgarsag} onChangeText={al('allampolgarsag')} hiba={h.allampolgarsag} />
        <Mezo felirat="Lakcím" value={a.lakcim} onChangeText={al('lakcim')} hiba={h.lakcim} placeholder="Irányítószám, település, utca, házszám" />
        <Mezo felirat="Az igazolvány száma" hol="okmany_szama" holForras="azonositas" holTema="azonositas" value={a.okmanySzam} onChangeText={(t) => al('okmanySzam')(t.toUpperCase())} hiba={h.okmanySzam} autoCapitalize="characters" />
        <Mezo felirat="Érvényes eddig" hol="okmany_ervenyesseg" holForras="azonositas" holTema="azonositas" value={a.lejarat} onChangeText={al('lejarat')} placeholder="ÉÉÉÉ-HH-NN" hiba={h.lejarat} keyboardType="numbers-and-punctuation" />
      </Lap>

      <Szakasz cim="Nyilatkozatok" />
      <MiEz kulcs="pmt_nyilatkozatok" forras="azonositas" tema="azonositas" style={{ alignSelf: 'flex-start', marginLeft: 4, marginTop: -6, marginBottom: 6 }} />
      <Lap style={{ padding: 18 }}>
        <Pipa be={ny.sajat} valt={(b) => setNy((x) => ({ ...x, sajat: b }))}>
          A saját nevemben járok el, a vállalkozás tényleges tulajdonosa én vagyok.
        </Pipa>
        <T m={15} s={600} style={{ marginTop: 12, marginBottom: 7 }}>
          Kiemelt közszereplő vagy (vagy annak közeli hozzátartozója)?
        </T>
        <T m={13.5} c={szin.halvany} lh={1.45} style={{ marginBottom: 8 }}>
          Például miniszter, parlamenti képviselő, bíró, nagykövet, állami cég vezetője – az elmúlt egy évben.
        </T>
        <Valaszto
          elemek={[
            { kulcs: 'nem' as const, cim: 'Nem' },
            { kulcs: 'igen' as const, cim: 'Igen' },
          ]}
          ertek={ny.pep}
          valt={(k) => setNy((x) => ({ ...x, pep: k }))}
        />
        {h.pep ? (
          <T m={14} s={500} c={szin.veszely} style={{ marginTop: 6 }}>
            {h.pep}
          </T>
        ) : null}
        {ny.pep === 'igen' ? <Mezo felirat="Milyen tisztség?" value={ny.pepReszlet} onChangeText={(t) => setNy((x) => ({ ...x, pepReszlet: t }))} style={{ marginTop: 12 }} /> : null}
        <Pipa be={ny.valos} valt={(b) => setNy((x) => ({ ...x, valos: b }))} style={{ marginTop: 10 }}>
          Az adataim valósak.
        </Pipa>
        <Pipa be={ny.valtozas} valt={(b) => setNy((x) => ({ ...x, valtozas: b }))}>
          Ha bármelyik adatom megváltozik, 5 munkanapon belül szólok.
        </Pipa>
      </Lap>

      <HibaSzoveg szoveg={hiba} />
      {folyamat !== null ? (
        <View style={{ marginTop: 12, height: 6, borderRadius: 3, backgroundColor: szin.keret, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(folyamat * 100) }}>
          <View style={{ width: `${Math.round(folyamat * 100)}%`, height: 6, backgroundColor: szin.tintakek }} />
        </View>
      ) : null}
      <GombE cim="Elküldöm" onPress={kuld} tolt={folyamat !== null} style={{ marginTop: 16 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 12, borderRadius: forma.mezo }}>
        <T m={14} c={szin.halvanyAlapon} lh={1.4}>
          Titkosítva tároljuk, csak {fn} látja.
        </T>
      </View>
      <Elakadtal forras="azonositas" tema="azonositas" style={{ marginTop: 6, marginLeft: 4 }} />
    </Kepernyo>
  );
}
