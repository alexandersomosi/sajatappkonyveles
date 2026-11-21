// k8 gépes nézet: a bal menüsáv (minta: dizajn/C5_v2/asztali/A01–A80, v2_asztali.css .oldalsav). Felül a kék felirat-logó,
// alatta az öt menüpont ugyanazokkal a színes Fluent ikonokkal, mint a telefonos alsó sáv (a „Fotózás” felirat marad);
// aktív = kék-világos alap + 4 pt-es kék bal sáv + kék 750-es felirat, `aria-current="page"`; piros pötty az olvasatlannál.
// Alul a könyvelő kis kártyája („Visszahívást kérek”). A „Fő menü” navigáció Tab-bal bejárható.
import { usePathname, router } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import { Ikon, Logo, NAV_IKONOK } from '../../_shared/v2/rn';
import { useAsztaliMeretek } from '../../lib/elrendezes';
import { aktivFulUtbol, menuCel } from '../../lib/elrendezesLogika';
import { szin } from '../../theme/tokens';
import { Arckep } from '../kepek';
import { PattanoPont } from '../mozgas';
import { T } from '../T';
import { visszahivasUt } from '../Visszahivas';
import { fotoCimke, useFotozasNyit, useFulAllapot } from '../fulAllapot';

const ATMENET = Platform.OS === 'web' ? ({ transitionProperty: 'background-color', transitionDuration: '200ms' } as object) : null;

export function Oldalsav() {
  const { menu } = useAsztaliMeretek();
  const aktiv = aktivFulUtbol(usePathname());
  const allapot = useFulAllapot();
  const fotozas = useFotozasNyit();
  const acc = allapot.accountant;
  return (
    <View style={{ width: menu, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: szin.hajszal, paddingTop: 26, paddingBottom: 16, paddingHorizontal: 14 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Adózz.hu – Főoldal" onPress={() => router.navigate((allapot.korlatozott ? '/bekotes' : '/') as never)} style={{ paddingHorizontal: 8, marginBottom: 26, alignSelf: 'flex-start' }}>
        <Logo meret={30} label="" />
      </Pressable>
      <View role="navigation" aria-label="Fő menü" style={{ gap: 4 }}>
        {NAV_IKONOK.map((f) => {
          const on = f.kulcs === aktiv;
          const foto = f.kulcs === 'fotozas';
          const db = f.kulcs === 'uzenetek' ? allapot.uzenetek : f.kulcs === 'fooldal' ? allapot.fooldal : 0;
          return (
            <Pressable
              key={f.kulcs}
              accessibilityRole="link"
              aria-current={on ? 'page' : undefined}
              accessibilityState={{ selected: on }}
              accessibilityLabel={foto ? fotoCimke(allapot) : db ? (f.kulcs === 'fooldal' ? `${f.felirat}, még ${db} teendő` : `${f.felirat}, ${db} új`) : f.felirat}
              onPress={() => (foto ? void fotozas(allapot.korlatozott) : router.navigate(menuCel(f.kulcs, allapot.korlatozott) as never))}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 50, paddingHorizontal: 14, borderRadius: 12, backgroundColor: on ? szin.kekVil : pressed ? '#EEF1F8' : hovered ? szin.hoverAlap : 'transparent' },
                ATMENET,
              ]}
            >
              {on ? <View style={{ position: 'absolute', left: -14, top: 8, bottom: 8, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: szin.tintakek }} /> : null}
              <Ikon nev={f.ikon} pt={28} />
              <T m={16} s={on ? 750 : 600} c={on ? szin.tintakek : szin.tinta} style={{ flex: 1 }} numberOfLines={1}>
                {f.felirat}
              </T>
              {f.kulcs === 'uzenetek' ? (
                <PattanoPont lathato={db > 0} style={{ borderWidth: 0, width: 9, height: 9 }} />
              ) : db ? (
                <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: szin.sarga, alignItems: 'center', justifyContent: 'center' }}>
                  <T m={12} s={800} c={szin.sotet} szam>
                    {db > 9 ? '9+' : db}
                  </T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      {acc ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: szin.hajszal, backgroundColor: '#fff', padding: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Arckep pt={38} gyuru />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T m={15} s={700} lh={1.3} numberOfLines={1}>
                {acc.displayName}
              </T>
              <T m={13.5} c={szin.halvany} lh={1.3}>
                a könyvelőd
              </T>
            </View>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(visszahivasUt('konyvelo_kartya', 'egyeb'))}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ minHeight: 40, borderRadius: 999, backgroundColor: pressed ? szin.gombMNyomott : hovered ? '#DCE3FF' : szin.gombMAlap, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 }, ATMENET]}
          >
            <Ikon nev="telefon" pt={18} />
            <T m={14.5} s={750} c={szin.tintakek} numberOfLines={1} style={{ flexShrink: 1 }}>
              Visszahívást kérek
            </T>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
