// S11 – a NAV-os értesítés feltöltése (SPEC §27.4.4): a bejelentés után letöltött értesítés (PDF) vagy egy olvasható
// fotó. „Mikor küldted be?” (alapból ma), „Hogyan?” (csak az ügyfél csatornái), „Adószám (az értesítésen találod)”.
// → „Megkaptuk. Átnézzük, általában 1 munkanapon belül.” → vissza a Főoldalra (ott a várakozó kártya).
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { FilingChannel } from '@/_shared/enums';
import { CLIENT_FILING_CHANNELS, FILING_CHANNEL_LABELS } from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useMe, useVallalkozas, useVallalkozasBeadva } from '@/api/hooks';
import { elokeszit, hozzaad, MAX_MERET, type HelyiFajl } from '@/lib/fajlok';
import { datumIg, maiNap, napHozzaad } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { adoszamAfaMentesHiba, adoszamFormaz, datumHiba, datumNormal } from '@/lib/validators';
import { SavCim } from '@/kepernyok/Utmutato';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Valaszto } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { alapMagyarazat, HolTalalom } from '@/ui/Magyarazat';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { Elakadtal } from '@/ui/Visszahivas';

export default function IgazolasFeltoltes() {
  const me = useMe();
  const reg = useVallalkozas();
  const kuld = useVallalkozasBeadva();
  const jelez = useJelzes();
  const ma = maiNap();
  const [fajl, setFajl] = useState<HelyiFajl | null>(null);
  const [nap, setNap] = useState(ma);
  const [csatorna, setCsatorna] = useState<FilingChannel | null>(null);
  const [adoszam, setAdoszam] = useState('');
  const [evSzam, setEvSzam] = useState('');
  const [h, setH] = useState<Record<string, string | null>>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [folyamat, setFolyamat] = useState<number | null>(null);
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const m = alapMagyarazat('nav_igazolas_pdf', fn);
  const javitas = reg.data?.registration?.status === 'javitas';

  async function pdf() {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > MAX_MERET) return jelez('A fájl legfeljebb 25 MB lehet.');
    setFajl({ uri: a.uri, nev: a.name, mime: a.mimeType ?? 'application/pdf', webFajl: a.file });
    setH((x) => ({ ...x, fajl: null }));
  }
  async function foto() {
    try {
      if (Platform.OS !== 'web') {
        const e = await ImagePicker.requestCameraPermissionsAsync();
        if (!e.granted) return jelez('A fotózáshoz engedélyezd a kamerát a beállításokban.');
      }
      const r = Platform.OS === 'web' ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }) : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      setFajl({ uri: a.uri, nev: a.fileName ?? 'nav_igazolas.jpg', mime: a.mimeType ?? 'image/jpeg', webFajl: a.file });
      setH((x) => ({ ...x, fajl: null }));
    } catch {
      jelez('Nem sikerült megnyitni a kamerát.');
    }
  }

  async function feltolt() {
    const e: Record<string, string | null> = {};
    e.fajl = fajl ? null : 'Válaszd ki a letöltött PDF-et, vagy fotózd le az értesítést.';
    const d = datumNormal(nap);
    e.filedOn = datumHiba(nap) ?? (d > ma ? 'Nem lehet későbbi, mint a mai nap.' : d < napHozzaad(ma, -60) ? 'Az elmúlt 60 nap valamelyik napja legyen.' : null);
    e.channel = csatorna ? null : 'Válassz egyet.';
    e.adoszam = adoszam.trim() ? adoszamAfaMentesHiba(adoszam) : null;
    setH(e);
    if (Object.values(e).some(Boolean) || !fajl || !csatorna) return;
    setHiba(null);
    try {
      const form = new FormData();
      await hozzaad(form, 'file', await elokeszit(fajl));
      form.append('filedOn', d);
      form.append('channel', csatorna);
      if (adoszam.trim()) form.append('adoszam', adoszamFormaz(adoszam));
      if (evSzam.trim()) form.append('evNyilvantartasiSzam', evSzam.trim());
      setFolyamat(0);
      await kuld.mutateAsync({ form, folyamat: setFolyamat });
      jelez({ szoveg: 'Megkaptuk. Átnézzük, általában 1 munkanapon belül.', kesz: true });
      router.replace('/bekotes');
    } catch (err) {
      if (err instanceof ApiHiba && err.fields) setH(err.fields);
      setHiba(hibaUzenet(err, 'Nem sikerült feltölteni. Próbáld újra.', { jelolt: ['file', 'filedOn', 'channel', 'adoszam'] }));
    } finally {
      setFolyamat(null);
    }
  }

  const fej = <SavCim vissza={() => vissza('/bekotes/vallalkozas')} cim={javitas ? 'Töltsd fel az új értesítést' : 'Töltsd fel a NAV-os értesítést'} al="A bejelentés végén, a Bejelentéseim, kérelmeim között, a „Megtekintés” gombbal tudod letölteni." />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Kepernyo ful="fooldal" fejlec={fej}>
        {m ? (
          <Lap style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ikon3d nev="irat" pt={44} />
              <T m={18} s={700} lh={1.3} style={{ flex: 1 }}>
                {m.title}
              </T>
            </View>
            <T m={16.5} lh={1.5} style={{ marginTop: 10 }}>
              {m.what} {m.why}
            </T>
            <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
              {m.where}
            </T>
          </Lap>
        ) : null}
        <Lap style={{ padding: 18, marginTop: 12, gap: 16 }}>
          <View>
            <T m={16} s={650} style={{ marginBottom: 8 }}>
              Az értesítés
            </T>
            {fajl ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: forma.mezo, backgroundColor: szin.nyomott }}>
                <Ikon3d nev={fajl.mime === 'application/pdf' ? 'irat' : 'nyugta'} pt={36} />
                <T m={16} s={600} style={{ flex: 1 }} numberOfLines={2}>
                  {fajl.nev}
                </T>
                <GombSz cim="Másikat" m={14.5} onPress={() => setFajl(null)} />
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <GombM cim="PDF kiválasztása" ikon="feltoltes" onPress={() => void pdf()} magas={50} />
                <GombM cim="Inkább lefotózom" ikon="fotozas" onPress={() => void foto()} magas={50} />
              </View>
            )}
            <HibaSzoveg szoveg={h.fajl ?? h.file} />
          </View>
          <Mezo felirat="Mikor küldted be?" value={nap} onChangeText={(t) => { setNap(t); setH((x) => ({ ...x, filedOn: null })); }} placeholder="ÉÉÉÉ-HH-NN" keyboardType="numbers-and-punctuation" hiba={h.filedOn} sugo={`Alapból a mai nap. Az elmúlt 60 napból bármelyik, ${datumIg(ma)}.`} />
          <View>
            <T m={16} s={650} style={{ marginBottom: 8 }}>
              Hogyan küldted be?
            </T>
            <Valaszto elemek={CLIENT_FILING_CHANNELS.map((c) => ({ kulcs: c, cim: FILING_CHANNEL_LABELS[c] }))} ertek={csatorna} valt={(c) => { setCsatorna(c); setH((x) => ({ ...x, channel: null })); }} />
            <HibaSzoveg szoveg={h.channel} />
          </View>
          <View>
            <T m={16} s={650}>
              Az adószámod
            </T>
            <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
              Írd be, ha rajta van az értesítésen: így hamarabb indulhatunk. Ha még nincs, hagyd üresen.
            </T>
            <View style={{ marginTop: 8 }}>
              <Mezo felirat="Adószám (az értesítésen találod)" value={adoszam} onChangeText={(t) => { setAdoszam(adoszamFormaz(t)); setH((x) => ({ ...x, adoszam: null })); }} keyboardType="number-pad" placeholder="12345678-1-23" hiba={h.adoszam} />
              <HolTalalom kulcs="adoszam" forras="vallalkozas_utmutato" tema="vallalkozas_inditas" />
            </View>
            <Mezo felirat="Nyilvántartási szám (ha rajta van)" value={evSzam} onChangeText={(t) => setEvSzam(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" />
          </View>
          <HibaSzoveg szoveg={hiba} />
          <GombE cim={folyamat != null ? `Feltöltés… ${Math.round(folyamat * 100)}%` : 'Feltöltöm'} onPress={() => void feltolt()} tolt={kuld.isPending} />
        </Lap>
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginTop: 8, marginLeft: 4 }} />
      </Kepernyo>
    </KeyboardAvoidingView>
  );
}
