// Visszahívás (SPEC §26.2): időpontfoglalás helyett. „Elakadtál? Kérj visszahívást” link minden lépésnél, állapotkártya
// (Kollégánk 24–48 órán belül hív), és a Főoldal alsó kártyája a bekötés alatt. A könyvelőt nem ígérjük elsőnek.
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { CallbackPromise, CallbackView } from '../_shared/api';
import { CALLBACK_TOPIC_LABELS, CALLBACK_TOPICS, CALLBACK_WINDOW_LABELS, CALLBACK_WINDOWS, type CallbackSource, type CallbackTopic } from '../_shared/enums';
import { forma, szin } from '../theme/tokens';
import { GombM, Lap } from './alap';
import { Ikon3d } from './kepek';
import { T } from './T';

export function visszahivasUt(forras: CallbackSource, tema: CallbackTopic = 'egyeb') {
  return { pathname: '/visszahivas' as const, params: { forras, tema } };
}

/** Az ígéret alapszövege (a szerver a /client/callbacks promise.text-jében adja; ez a tartalék). */
export const igeretAlap = (fn: string) =>
  `Kollégánk 24–48 órán belül felhív. Munkanapokon 9 és 17 óra között telefonálunk. Nem feltétlenül ${kisNev(fn)} hív elsőként, hanem valaki a csapatunkból.`;
export const KONYVELO_SOR = (fn: string) => `Csapatunk 24–48 órán belül hív. Nem feltétlenül ${kisNev(fn)} hív elsőként.`;
/** Mondat közepén: „A könyvelőd” (még nincs kijelölt könyvelő) → „a könyvelőd”; a valódi név marad. */
function kisNev(fn: string): string {
  return /^A könyvelőd/.test(fn) ? `a${fn.slice(1)}` : fn;
}

/** Szöveges link minden lépés alján. */
export function Elakadtal({ forras, tema = 'bekotes', style, cim = 'Elakadtál? Kérj visszahívást' }: { forras: CallbackSource; tema?: CallbackTopic; style?: StyleProp<ViewStyle>; cim?: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push(visszahivasUt(forras, tema))} style={({ pressed }) => [{ paddingVertical: 12, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, pressed && { opacity: 0.6 }, style]}>
      <T m={16} s={550} c={szin.tintakekSzoveg} alahuz>
        {cim}
      </T>
    </Pressable>
  );
}

/** A nyitott (vagy utolsó) kérés állapota: óra-ikon, a szerver mondata, téma; kompakt változat az Üzenetekben. */
export function VisszahivasAllapot({ cb, kompakt, forras = 'bekotes', style, gomb = true }: { cb: CallbackView; kompakt?: boolean; forras?: CallbackSource; style?: StyleProp<ViewStyle>; gomb?: boolean }) {
  const nyitott = cb.status === 'uj' || cb.status === 'folyamatban';
  const tovabb = () => router.push({ pathname: '/visszahivas', params: { forras, tema: cb.topic } });
  if (kompakt) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Visszahívás: ${cb.statusText}`} onPress={tovabb} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: szin.lap, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: cb.needsNewPhone || cb.callingNow ? 2 : 1, borderColor: cb.needsNewPhone ? szin.borostyan : cb.callingNow ? szin.tintakek : szin.hajszal }, style]}>
        <Ikon3d nev="ora" pt={28} />
        <T m={14.5} lh={1.35} style={{ flex: 1 }} numberOfLines={2}>
          {cb.statusText}
        </T>
        <T m={14} s={600} c={szin.tintakekSzoveg} alahuz>
          {cb.needsNewPhone ? 'Javítom' : 'Részletek'}
        </T>
      </Pressable>
    );
  }
  return (
    <Lap style={[{ padding: 18 }, style]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Ikon3d nev="ora" pt={44} />
        <View style={{ flex: 1 }}>
          <T m={14} s={600} c={szin.halvany}>
            {nyitott ? 'Visszahívást kértél' : 'Visszahívás'} · {cb.topicLabel}
          </T>
          <T m={17} s={cb.callingNow ? 700 : 600} lh={1.45} style={{ marginTop: 2 }} accessibilityLiveRegion="polite">
            {cb.statusText}
          </T>
          {cb.note ? (
            <T m={14.5} c={szin.halvany} lh={1.4} style={{ marginTop: 4 }} numberOfLines={2}>
              „{cb.note}”
            </T>
          ) : null}
        </View>
      </View>
      {nyitott && gomb ? <GombM cim={cb.needsNewPhone ? 'Megadom a jó számot' : 'Megnézem, módosítom'} onPress={tovabb} style={{ marginTop: 14 }} /> : null}
    </Lap>
  );
}

/** A bekötési oldal alsó kártyája: ha van nyitott kérés, az állapota; különben a kérés lehetősége. */
export function VisszahivasKartya({ fn, cb }: { fn: string; cb: CallbackView | null }) {
  if (cb && (cb.status === 'uj' || cb.status === 'folyamatban')) return <VisszahivasAllapot cb={cb} style={{ marginTop: 12 }} />;
  return (
    <Lap style={{ marginTop: 12, padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Ikon3d nev="ora" pt={44} />
        <T m={18} s={700} lh={1.3} ls={-0.01} style={{ flex: 1 }}>
          Elakadtál? Kérj visszahívást.
        </T>
      </View>
      <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 8, marginBottom: 14 }}>
        {igeretAlap(fn)}
      </T>
      <GombM cim="Kérj visszahívást" onPress={() => router.push(visszahivasUt('bekotes', 'bekotes'))} />
    </Lap>
  );
}

export function alapIgeret(fn: string): CallbackPromise {
  return {
    text: igeretAlap(fn),
    callerIdText: null,
    fraudWarning: 'Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat. Nem lépünk be helyetted sehova. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban.',
    privacyText: 'A megadott számon ezzel a kéréssel kapcsolatban hívunk. A hívásról rövid jegyzetet írunk, a hívást nem rögzítjük. Részletek az Adatkezelési tájékoztatóban.',
    windows: CALLBACK_WINDOWS.map((w) => ({ window: w, label: CALLBACK_WINDOW_LABELS[w] })),
    topics: CALLBACK_TOPICS.map((t) => ({ topic: t, label: CALLBACK_TOPIC_LABELS[t] })),
  };
}


export function Igeret({ p }: { p: CallbackPromise }) {
  return (
    <View style={{ borderRadius: forma.mezo, backgroundColor: szin.nyomott, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Ikon3d nev="ora" pt={36} />
        <T m={16} s={550} lh={1.5} style={{ flex: 1 }}>
          {p.text}
        </T>
      </View>
      {p.callerIdText ? (
        <T m={15.5} s={650} lh={1.45}>
          {p.callerIdText}
        </T>
      ) : null}
      <View style={{ borderRadius: 10, backgroundColor: szin.borostyanAlap, padding: 12 }}>
        <T m={15} s={600} lh={1.45} c={szin.borostyanSzoveg}>
          {p.fraudWarning}
        </T>
      </View>
      <T m={13.5} lh={1.45} c={szin.halvany}>
        {p.privacyText}
      </T>
    </View>
  );
}

