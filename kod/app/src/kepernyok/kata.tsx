// SPEC §32 – a katás Főoldal kártyája: „Idei kereted” sáv (zöld, borostyán ≥ 80 %, piros a keret fölött), alatta a
// keret sora, a maradék, a figyelmeztetés, és ha van nyitott kata-hónap, a gomb a fizetési lapra.
import { View } from 'react-native';
import { router } from 'expo-router';
import type { KataHomeView } from '../_shared/api';
import { fillPlaceholders } from '../_shared/bekotes';
import { KATA_F1_TEXTS as K } from '../_shared/kata';
import { keretSzin, savKitoltes } from '../lib/kata';
import { datumIg, szam } from '../lib/format';
import { szin } from '../theme/tokens';
import { GombM, Lap, Szakasz } from '../ui/alap';
import { Kartyak } from '../ui/keret';
import { T } from '../ui/T';

const SZIN = { zold: szin.tintakek, borostyan: szin.borostyan, piros: szin.veszely } as const;

export function KataKeret({ k }: { k: KataHomeView }) {
  const m = k.meter;
  if (!m) return null;
  const sz = keretSzin(m.level);
  const kitoltes = savKitoltes(m.pct);
  return (
    <Kartyak>
      <Szakasz ikon="szamolo" cim={K.keretCim} />
      <Lap style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
        <T m={22} s={750} lh={1.2} szam>
          {fillPlaceholders(K.keretSav, { bevetel: szam(m.usedHuf), keret: szam(m.limitHuf) })}
        </T>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: szin.nyomott, marginTop: 12, marginBottom: 9, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: kitoltes }}>
          <View style={{ width: `${kitoltes}%`, height: 10, borderRadius: 5, backgroundColor: SZIN[sz] }} />
        </View>
        <T m={15.5} lh={1.45}>
          {fillPlaceholders(K.keretSor, { pct: String(m.pct) })}
        </T>
        <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
          {m.limitLine}
          {m.remainingLine ? ` ${m.remainingLine}` : ''}
        </T>
        {m.warningLine ? (
          <T m={15} s={600} lh={1.45} c={sz === 'piros' ? szin.veszely : sz === 'borostyan' ? szin.borostyanSzoveg : szin.tinta} style={{ marginTop: 8 }}>
            {m.warningLine}
          </T>
        ) : null}
        {k.draftNote ? (
          <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 8 }}>
            {k.draftNote}
          </T>
        ) : null}
        {k.nextPayable ? (
          <GombM cim={K.fizetesGomb} ikon="szamlaszam" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => router.push(`/fizetes/${k.nextPayable!.periodId}`)} />
        ) : k.nothingToPayLine ? (
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 8 }}>
            {k.nothingToPayLine}
          </T>
        ) : null}
      </Lap>
    </Kartyak>
  );
}

/** "Utalj 50 000 Ft-ot december 14-ig" – a kata fizetési kártya címe (a Főoldal sávja a meglévő hős). */
export function kataFizetesCim(osszeg: number, hatarido: string, lejart: boolean): string {
  return lejart ? fillPlaceholders(K.fizetesCimLejart, { osszeg: szam(osszeg) }) : fillPlaceholders(K.fizetesCim, { osszeg: szam(osszeg), hatarido: datumIg(hatarido) });
}
