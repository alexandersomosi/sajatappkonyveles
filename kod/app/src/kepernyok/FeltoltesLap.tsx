// Feltöltés előtti alsó lap: mi ez (Nyugta, Számla, Kivonat, Szerződés, Egyéb), melyik hónaphoz, megjegyzés.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { honapEltol, honapNev } from '../lib/format';
import { forma, szin } from '../theme/tokens';
import { GombE, HibaSzoveg } from '../ui/alap';
import { ma } from '../ui/ido';
import { AlsoLap } from '../ui/keret';
import { Mezo } from '../ui/Mezo';
import { T } from '../ui/T';

export const KATEGORIAK: { k: string; cim: string }[] = [
  { k: 'nyugta', cim: 'Nyugta' },
  { k: 'koltseg_bizonylat', cim: 'Számla' },
  { k: 'bankszamlakivonat', cim: 'Kivonat' },
  { k: 'szerzodes', cim: 'Szerződés' },
  { k: 'penztargep_osszesito', cim: 'Pénztárgép-összesítő' },
  { k: 'nav_level', cim: 'Levél a NAV-tól' },
  { k: 'egyeb', cim: 'Egyéb' },
];

export function Chip({ cim, on, onPress }: { cim: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ height: 40, paddingHorizontal: 14, borderRadius: forma.mezo, borderWidth: on ? 2 : 1, borderColor: on ? szin.tintakek : szin.keret, backgroundColor: on ? '#fff' : szin.mezoAlap, justifyContent: 'center' }}
    >
      <T m={15} s={on ? 650 : 500}>
        {cim}
      </T>
    </Pressable>
  );
}

export function FeltoltesLap({
  lathato,
  bezar,
  kezdoKategoria = 'nyugta',
  kezdoHonap,
  oldalak,
  fajlNev,
  folyamat,
  kuld,
  hiba,
}: {
  lathato: boolean;
  bezar: () => void;
  kezdoKategoria?: string;
  kezdoHonap?: string;
  oldalak: number;
  /** A kiválasztott fájl neve (a „Fájl a telefonról” útján), hogy látszódjon, mit küldünk. */
  fajlNev?: string;
  folyamat: number | null;
  kuld: (kategoria: string, honap: string, megjegyzes?: string) => void;
  /** A feltöltés hibája: a lapon belül látszik (a lap mögötti képernyőt a függöny takarja). */
  hiba?: string | null;
}) {
  const most = ma().slice(0, 7);
  const elozo = honapEltol(most, -1);
  const preset = kezdoHonap && /^\d{4}-\d{2}$/.test(kezdoHonap) ? kezdoHonap : null;
  // A bankszámlakivonat jellemzően az előző hónapé: kérés nélkül is az előző hónap az alap.
  const alapHonap = (k: string) => preset ?? (k === 'bankszamlakivonat' ? elozo : most);
  const [kat, setKat] = useState(kezdoKategoria);
  const [honap, setHonap] = useState(alapHonap(kezdoKategoria));
  const [honapValasztva, setHonapValasztva] = useState(false);
  const [megj, setMegj] = useState('');
  useEffect(() => {
    if (lathato) {
      setKat(kezdoKategoria);
      setHonap(alapHonap(kezdoKategoria));
      setHonapValasztva(false);
    }
  }, [lathato, kezdoKategoria]); // eslint-disable-line react-hooks/exhaustive-deps
  const honapok = [most, honapEltol(most, -1), honapEltol(most, -2)];
  if (kezdoHonap && !honapok.includes(kezdoHonap) && /^\d{4}-\d{2}$/.test(kezdoHonap)) honapok.push(kezdoHonap);
  return (
    <AlsoLap lathato={lathato} bezar={bezar}>
      <T m={24} s={700} lh={1.2} ls={-0.02} style={{ paddingRight: 84 }} accessibilityRole="header">
        Mi ez?
      </T>
      <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
        {oldalak > 1 ? `${oldalak} oldal, egy iratként küldjük.` : 'Így a könyvelőd rögtön tudja, hova tegye.'}
      </T>
      {fajlNev ? (
        <T m={15} s={600} lh={1.4} numberOfLines={2} style={{ marginTop: 8 }}>
          {oldalak > 1 ? `${fajlNev} és még ${oldalak - 1}` : fajlNev}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }} accessibilityRole="radiogroup">
        {KATEGORIAK.map((x) => (
          <Chip
            key={x.k}
            cim={x.cim}
            on={kat === x.k}
            onPress={() => {
              setKat(x.k);
              if (!honapValasztva) setHonap(alapHonap(x.k));
            }}
          />
        ))}
      </View>
      <T m={15} s={600} style={{ marginTop: 18, marginBottom: 8 }}>
        Melyik hónaphoz tartozik?
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {honapok.map((h) => (
          <Chip
            key={h}
            cim={honapNev(h)}
            on={honap === h}
            onPress={() => {
              setHonap(h);
              setHonapValasztva(true);
            }}
          />
        ))}
      </View>
      <Mezo felirat="Megjegyzés (nem kötelező)" value={megj} onChangeText={setMegj} placeholder="Például: készpénzes eladás a vásáron" style={{ marginTop: 16 }} />
      {folyamat !== null ? (
        <View style={{ marginTop: 14, height: 6, borderRadius: 3, backgroundColor: szin.keret, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(folyamat * 100) }}>
          <View style={{ width: `${Math.round(folyamat * 100)}%`, height: 6, backgroundColor: szin.tintakek }} />
        </View>
      ) : null}
      <HibaSzoveg szoveg={hiba ?? null} />
      <GombE cim={folyamat !== null ? `Feltöltés… ${Math.round(folyamat * 100)}%` : hiba ? 'Újra megpróbálom' : 'Feltöltöm'} onPress={() => kuld(kat, honap, megj.trim() || undefined)} tolt={folyamat !== null} style={{ marginTop: 18 }} />
    </AlsoLap>
  );
}
