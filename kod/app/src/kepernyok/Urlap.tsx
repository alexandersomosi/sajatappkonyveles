// C űrlap (SPEC §28.K.10, `valasztott/urlap.html`): a keskeny kék sáv „Vissza” + a szakasz neve, alatta „1. kérdés a 3-ból”,
// a kérdés címként (26), egy „miért” sor, a válasz-kapszulák; a fő gomb lent a dokkban. Egy kérdés egy képernyőn.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { forma, szin } from '@/theme/tokens';
import { Fejlec } from '@/ui/alap';
import { Ikon3d, type Ikon3dNev } from '@/ui/kepek';
import { T } from '@/ui/T';

export function UrlapFej({ vissza, szakasz }: { vissza: () => void; szakasz: string }) {
  return (
    <Fejlec rozX={318} rozY={70} alsoTer={12}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Vissza"
          onPress={vissza}
          hitSlop={4}
          style={({ pressed }) => [{ height: 36, paddingHorizontal: 14, borderRadius: forma.gomb, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', zIndex: 1 }, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
        >
          <T m={15.5} s={650} c="#fff">
            Vissza
          </T>
        </Pressable>
        <T m={16} s={650} c="#fff" kozep numberOfLines={1} style={{ position: 'absolute', left: 104, right: 104 }}>
          {szakasz}
        </T>
      </View>
    </Fejlec>
  );
}

/** „a 9-ből”, „a 3-ból”: a szám kiejtése szerinti rag. */
export function bolBol(n: number): 'ból' | 'ből' {
  const e = n % 10;
  if (e) return [3, 6, 8].includes(e) ? 'ból' : 'ből';
  const t = (n / 10) % 10;
  if (!t) return 'ból'; // száz, ezer
  return [2, 3, 6, 8].includes(t) ? 'ból' : 'ből';
}

/** „2. kérdés a 9-ből” + a kérdés + a „miért” sor (+ opcionális 3D ikon a kérdés előtt). */
export function UrlapKerdes({ i, n, cim, miert, ikon }: { i?: number; n?: number; cim: string; miert?: string | null; ikon?: Ikon3dNev }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {i != null && n != null ? (
        <T m={15} c={szin.halvany} lh={1.4}>
          {`${i}. kérdés a ${n}-${bolBol(n)}`}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
        {ikon ? <Ikon3d nev={ikon} pt={30} style={{ marginTop: 1 }} /> : null}
        <T m={26} s={700} lh={1.15} ls={-0.022} style={{ flex: 1 }} accessibilityRole="header">
          {cim}
        </T>
      </View>
      {miert ? (
        <T m={16} lh={1.45} c={szin.halvany} style={{ marginTop: 8 }}>
          {miert}
        </T>
      ) : null}
    </View>
  );
}

/** Válasz-kapszulák (egy vagy több választás). A kiválasztott tele kék, a többi világoskék; legalább 44 pt magas. */
export function Kapszulak<K extends string>({ elemek, ertek, valt, tobb, oszlop }: { elemek: { kulcs: K; cim: string }[]; ertek: K | K[] | null; valt: (k: K) => void; tobb?: boolean; oszlop?: boolean }) {
  const on = (k: K) => (Array.isArray(ertek) ? ertek.includes(k) : ertek === k);
  return (
    <View style={{ flexDirection: oszlop ? 'column' : 'row', flexWrap: oszlop ? 'nowrap' : 'wrap', gap: 8 }} accessibilityRole={tobb ? undefined : 'radiogroup'}>
      {elemek.map((e) => {
        const be = on(e.kulcs);
        return (
          <Pressable
            key={e.kulcs}
            accessibilityRole={tobb ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: be, selected: be }}
            aria-checked={be}
            onPress={() => valt(e.kulcs)}
            style={({ pressed }) => [
              { minHeight: 44, paddingHorizontal: 16, paddingVertical: 9, borderRadius: oszlop ? 12 : forma.gomb, backgroundColor: be ? szin.tintakek : szin.gombMAlap, justifyContent: 'center', alignSelf: oszlop ? 'stretch' : 'flex-start' },
              pressed && !be && { backgroundColor: szin.gombMNyomott },
            ]}
          >
            <T m={16} s={650} lh={1.3} c={be ? '#fff' : szin.tintakekSzoveg}>
              {e.cim}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IgenNem({ ertek, valt }: { ertek: boolean | null; valt: (b: boolean) => void }) {
  return <Kapszulak elemek={[{ kulcs: 'igen', cim: 'Igen' }, { kulcs: 'nem', cim: 'Nem' }]} ertek={ertek == null ? null : ertek ? 'igen' : 'nem'} valt={(k) => valt(k === 'igen')} />;
}

const HO = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
/** Év (számmező helyett léptető) + hónap rácsa – 'YYYY-MM'. */
export function HonapValaszto({ ertek, valt, tol, ig, cim }: { ertek: string | null; valt: (v: string) => void; tol: number; ig: number; cim?: string }) {
  const ev = ertek ? Number(ertek.slice(0, 4)) : null;
  const ho = ertek ? Number(ertek.slice(5, 7)) : null;
  const allit = (e: number, h: number) => valt(`${e}-${String(h).padStart(2, '0')}`);
  const kezdo = ev ?? Math.min(ig, Math.max(tol, ig - 30));
  return (
    <View style={{ gap: 10 }}>
      {cim ? (
        <T m={15} s={600}>
          {cim}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Korábbi év" onPress={() => allit(Math.max(tol, kezdo - 1), ho ?? 1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }}>
          <T m={22} s={700} c={szin.tintakekSzoveg} lh={1}>
            −
          </T>
        </Pressable>
        <View style={{ minWidth: 92, height: 56, borderRadius: 12, borderWidth: ev ? 2 : 1, borderColor: ev ? szin.tintakek : szin.keret, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`Év: ${ev ?? 'nincs kiválasztva'}`}>
          <T m={22} s={600} szam c={ev ? szin.tinta : szin.halvany}>
            {ev ?? 'Év'}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Későbbi év" onPress={() => allit(Math.min(ig, kezdo + (ev ? 1 : 0)), ho ?? 1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }}>
          <T m={22} s={700} c={szin.tintakekSzoveg} lh={1}>
            +
          </T>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {HO.map((h, i) => {
          const be = ho === i + 1;
          return (
            <Pressable
              key={h}
              accessibilityRole="radio"
              accessibilityState={{ checked: be }}
              aria-checked={be}
              onPress={() => allit(kezdo, i + 1)}
              style={{ width: '22.5%', minHeight: 44, borderRadius: 12, backgroundColor: be ? szin.tintakek : szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }}
            >
              <T m={15.5} s={650} c={be ? '#fff' : szin.tintakekSzoveg}>
                {h}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Léptető (0–N): „Hány gyermekről van szó?” */
export function Lepteto({ ertek, valt, min, max, cim }: { ertek: number; valt: (n: number) => void; min: number; max: number; cim: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
      <T m={16} s={600} style={{ flex: 1 }}>
        {cim}
      </T>
      <Pressable accessibilityRole="button" accessibilityLabel="Kevesebb" onPress={() => valt(Math.max(min, ertek - 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }}>
        <T m={22} s={700} c={szin.tintakekSzoveg} lh={1}>
          −
        </T>
      </Pressable>
      <T m={22} s={700} szam style={{ minWidth: 28 }} kozep accessibilityLiveRegion="polite">
        {ertek}
      </T>
      <Pressable accessibilityRole="button" accessibilityLabel="Több" onPress={() => valt(Math.min(max, ertek + 1))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }}>
        <T m={22} s={700} c={szin.tintakekSzoveg} lh={1}>
          +
        </T>
      </Pressable>
    </View>
  );
}

/** Egy sor szöveggel és egy igen/nem kapcsolóval (a gyermek-kártyán). */
export function IgenNemSor({ cim, ertek, valt, elso }: { cim: string; ertek: boolean; valt: (b: boolean) => void; elso?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: ertek }}
      aria-checked={ertek}
      onPress={() => valt(!ertek)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}
    >
      <T m={16} lh={1.35} style={{ flex: 1 }}>
        {cim}
      </T>
      <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: ertek ? szin.tintakek : szin.keret, padding: 3, alignItems: ertek ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' }} />
      </View>
    </Pressable>
  );
}

export const kerdesSzoveg = (n: ReactNode) => n;
