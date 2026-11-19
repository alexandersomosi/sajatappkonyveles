// Feltöltés-választó (FUNKCIOK 13): Fotózás · Fájl (PDF/kép) · Kivonat. Ide érkezik a más appból megosztott fájl is
// (expo-share-intent), és ide visz a könyvelő kérése („Kivonat feltöltése”) és az „Új változat”.
import { INVOICE_WORDING } from '@/_shared/bekotes';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useHome, useKeresek, useKeresKesz } from '@/api/hooks';
import { ENGEDETT, iratFeltolt, MAX_MERET, type HelyiFajl } from '@/lib/fajlok';
import { meret } from '@/lib/format';
import { megosztottFajlok } from '@/lib/megosztas';
import { szin } from '@/theme/tokens';
import { HibaSzoveg, Lap, Sor } from '@/ui/alap';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';
import { FeltoltesLap } from '@/kepernyok/FeltoltesLap';
import { hibaUzenet } from '@/lib/hiba';

function FeltoltesTartalom() {
  const p = useLocalSearchParams<{ keres?: string; kategoria?: string; honap?: string; megosztas?: string; ujVerzio?: string }>();
  const home = useHome();
  const keresek = useKeresek();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const keres = keresek.data?.items.find((k) => k.id === p.keres);
  const keresKesz = useKeresKesz();
  const [fajlok, setFajlok] = useState<HelyiFajl[]>([]);
  const [kategoria, setKategoria] = useState(p.kategoria ?? 'egyeb');
  const [lap, setLap] = useState(false);
  const [folyamat, setFolyamat] = useState<number | null>(null);
  const [hiba, setHiba] = useState<string | null>(p.megosztas === 'rossz' ? 'Ezt a fájltípust nem tudjuk fogadni. PDF-et vagy fényképet küldj.' : null);

  useEffect(() => {
    if (p.megosztas === '1') {
      const m = megosztottFajlok();
      if (m.length) {
        setFajlok(m.map((f) => ({ uri: f.uri, nev: f.nev, mime: f.mime, meret: f.meret })));
        setKategoria(m[0].mime === 'application/pdf' ? 'egyeb' : 'nyugta');
        setLap(true);
      }
    }
  }, [p.megosztas]);

  async function valaszt(kat: string, csakPdf: boolean) {
    setHiba(null);
    const r = await DocumentPicker.getDocumentAsync({ type: csakPdf ? 'application/pdf' : ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], multiple: !csakPdf, copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.length) return;
    const lista: HelyiFajl[] = [];
    for (const a of r.assets) {
      const mime = a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      if (!ENGEDETT.test(mime)) return setHiba(`${a.name}: csak PDF-et vagy fényképet tudunk fogadni.`);
      if ((a.size ?? 0) > MAX_MERET) return setHiba(`${a.name}: legfeljebb 25 MB lehet (ez ${meret(a.size ?? 0)}).`);
      lista.push({ uri: a.uri, nev: a.name, mime, meret: a.size, webFajl: a.file });
    }
    if (lista.some((f) => f.mime === 'application/pdf') && lista.length > 1) return setHiba('Egyszerre egy PDF-et tölts fel, vagy több fényképet.');
    setFajlok(lista);
    setKategoria(kat);
    setLap(true);
  }

  async function kuld(kat: string, honap: string, megjegyzes?: string) {
    setFolyamat(0);
    setHiba(null);
    try {
      const pdf = fajlok.length === 1 && fajlok[0].mime === 'application/pdf';
      const irat = await iratFeltolt({ lapok: pdf ? undefined : fajlok, fajl: pdf ? fajlok[0] : undefined, kategoria: kat, honap, megjegyzes, keresId: p.keres, ujVerzioId: p.ujVerzio, folyamat: setFolyamat });
      // A könyvelő kérésére feltöltött irat a kérést is lezárja (SPEC §6.4: csatolod, és „Kész”), különben a kérés
      // nyitva maradna, és újra meg újra kérnénk tőled, amit már elküldtél.
      const lezar = await keresLezar(irat?.id);
      await Promise.all([qc.invalidateQueries({ queryKey: ['dosszie'] }), qc.invalidateQueries({ queryKey: ['home'] }), qc.invalidateQueries({ queryKey: ['keresek'] }), qc.invalidateQueries({ queryKey: ['irat'] }), qc.invalidateQueries({ queryKey: ['hataridok'] }), qc.invalidateQueries({ queryKey: ['uzenetek'] })]);
      setLap(false);
      jelez({ szoveg: lezar ? `Feltöltötted, ${fn} megkapta. A kérését lezártuk.` : `Feltöltve. ${fn} megkapta.`, kesz: true });
      if (p.ujVerzio) router.replace(`/tetel/${p.ujVerzio}`);
      else router.replace({ pathname: '/dosszie', params: { honap } });
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült feltölteni. Próbáld újra.'));
    } finally {
      setFolyamat(null);
    }
  }

  /** Lezárja a könyvelő nyitott kérését a most feltöltött irattal. Hiba esetén a feltöltés attól még megvan. */
  async function keresLezar(iratId: string | undefined): Promise<boolean> {
    if (!p.keres || !iratId || p.ujVerzio) return false;
    const k = keres ?? (await keresek.refetch()).data?.items.find((x) => x.id === p.keres);
    if (!k || k.direction !== 'konyvelotol' || (k.status !== 'nyitott' && k.status !== 'folyamatban')) return false;
    try {
      await keresKesz.mutateAsync({ id: k.id, documentIds: [iratId] });
      return true;
    } catch {
      return false;
    }
  }

  return (
    <Kepernyo
      ful="fooldal"
      fejlec={
        <CimSor
          visszaCim="Vissza"
          vissza={() => vissza('/')}
          cim={p.ujVerzio ? 'Új változat' : 'Mit töltesz fel?'}
          al={keres ? `${fn} kéri: ${keres.title}` : p.megosztas === '1' ? 'Egy másik appból küldted ide.' : `${fn} megkapja, és ő teszi a helyére.`}
        />
      }
    >
      {fajlok.length && p.megosztas === '1' ? (
        <Lap style={{ marginBottom: 12 }}>
          {fajlok.map((f, i) => (
            <Sor key={f.uri} elso={i === 0} ikon={f.mime === 'application/pdf' ? 'irat' : 'nyugta'} cim={f.nev} al={f.meret ? meret(f.meret) : undefined} />
          ))}
        </Lap>
      ) : null}
      <Lap>
        <Sor
          elso
          ikon="fotozas"
          cim="Fotózás"
          al="Papíron van: nyugta, levél, vagy kézzel írt számla, amit nem jelentettél a NAV-nak. Több oldalt is lefotózhatsz."
          onPress={() => router.push({ pathname: '/fotozas', params: { keres: p.keres ?? '', kategoria: p.kategoria ?? 'nyugta', honap: p.honap ?? '' } })}
        />
        <Sor ikon="feltoltes" cim="Fájl a telefonról" al="PDF vagy fénykép, például egy e-mail mellékletéből." onPress={() => void valaszt(p.kategoria ?? 'egyeb', false)} />
        <Sor ikon="irat" cim="Bankszámlakivonat" al="A bankod appjából letöltött PDF a legjobb." onPress={() => void valaszt('bankszamlakivonat', true)} />
      </Lap>
      <HibaSzoveg szoveg={hiba} />
      <T m={14} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 14, paddingHorizontal: 4 }}>
        Más appból is küldhetsz ide: a megosztás gombbal válaszd az appot. Legfeljebb 25 MB, PDF vagy fénykép. {INVOICE_WORDING.uploadHint}
      </T>
      <View style={{ height: 8 }} />
      <FeltoltesLap
        lathato={lap}
        bezar={() => setLap(false)}
        kezdoKategoria={kategoria}
        kezdoHonap={p.honap || keres?.dossierMonth}
        oldalak={fajlok.length}
        fajlNev={fajlok[0]?.nev}
        folyamat={folyamat}
        kuld={kuld}
        hiba={lap ? hiba : null}
      />
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Feltoltes() {
  const p = useLocalSearchParams<{ keres?: string }>();
  const vanKeres = !!p.keres;
  return (
    <ZaroltKapu feature="feltoltes" ful="fooldal" cim="Feltöltés" vanKeres={vanKeres}>
      <FeltoltesTartalom />
    </ZaroltKapu>
  );
}
