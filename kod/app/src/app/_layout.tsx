// Gyökér: betűk, adatréteg, belépés-kapu, biometrikus zár, megosztás más appból, értesítés-koppintás.
// Weben 1024 pt alatt a telefonos elrendezés középre kerül (max. 480 pt széles); k8: ≥ 1024 pt-tól gépes elrendezés –
// bal menüsáv (ui/asztali/Oldalsav) + a képernyők a jobb oldalon. A fa szerkezete mindig ugyanaz (a menü csak egy
// feltételes testvér), így ablak-átméretezéskor a Stack nem mountolódik újra, nem vész el állapot.
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Stack, router, useGlobalSearchParams, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiHiba } from '@/api/http';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { MegosztasFigyelo } from '@/lib/megosztas';
import { keretStilus } from '@/lib/webkeret';
import { mediaAlapBeallit } from '@/lib/media';
import { MagyarazatProvider } from '@/ui/Magyarazat';
import { UtvaltasProvider } from '@/ui/Ut';
import { ZaroltProvider, zaroltHibabol } from '@/ui/Zarolt';
import { ErtesitesKezelo } from '@/lib/push';
import { BETUK, szin } from '@/theme/tokens';
import { demoBeallit, JelzesProvider } from '@/ui/keret';
import { useConfig } from '@/api/hooks';
import { ZarKepernyo } from '@/ui/ZarKepernyo';
import { Oldalsav } from '@/ui/asztali/Oldalsav';
import { OldalsavCtx, useAsztali } from '@/lib/elrendezes';
import { oldalsavLathatoE } from '@/lib/elrendezesLogika';
import { webStilusBetolt } from '@/lib/webStilus';
import { GombE, GombSz } from '@/ui/alap';
import { T } from '@/ui/T';
import { Betolt } from '@/ui/keret';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const qc = new QueryClient({
  // SPEC §26.5.3: a 403 'locked_until_active' bárhonnan jön, a zárolt lapot mutatjuk (a lap 10 mp-en belül egyszer nyílik).
  queryCache: new QueryCache({ onError: zaroltHibabol }),
  mutationCache: new MutationCache({ onError: zaroltHibabol }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 3600_000,
      retry: (n, e) => !(e instanceof ApiHiba && [400, 401, 403, 404, 409, 503].includes(e.status)) && n < 2,
      refetchOnWindowFocus: Platform.OS === 'web',
    },
    mutations: { retry: 0 },
  },
});

/** The server's DEMO mode (/config, no login needed) labels every screen from the first one: login, registration,
 *  password reset, onboarding, direct loads and reloads too. The home screen still sets it as a fallback. */
function DemoFigyelo() {
  const cfg = useConfig();
  useEffect(() => {
    if (cfg.data) demoBeallit(!!cfg.data.demo);
    if (cfg.data) mediaAlapBeallit(cfg.data.mediaBaseUrl);
  }, [cfg.data]);
  return null;
}

function Kapu() {
  const { allapot, user, zarva } = useAuth();
  const szegmensek = useSegments();
  const elso = szegmensek[0] as string | undefined;
  const authCsoport = elso === '(auth)';
  const nyilvanos = elso === 'jogi' || elso === 'gyik' || elso === '+not-found';

  useEffect(() => {
    if (allapot === 'betolt') return;
    if (allapot === 'kint' && !authCsoport && !nyilvanos) router.replace('/belepes');
    else if (allapot === 'bent' && user && !user.emailVerified && elso !== 'email-megerosites' && !nyilvanos) router.replace('/email-megerosites');
    else if (allapot === 'bent' && authCsoport) router.replace('/');
  }, [allapot, authCsoport, nyilvanos, elso, user]);

  if (allapot === 'betolt' && !zarva) return <Betolt szoveg="Egy pillanat…" kerek />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: szin.alap }, animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}>
        <Stack.Screen name="fotozas" options={{ animation: 'slide_from_bottom', contentStyle: { backgroundColor: szin.kamera } }} />
        <Stack.Screen name="visszahivas" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="helyettunk" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      {allapot === 'bent' ? <MegosztasFigyelo /> : null}
      {allapot === 'bent' ? <ErtesitesKezelo /> : null}
      {zarva ? <ZarKepernyo /> : null}
    </>
  );
}

/** „Ugrás a tartalomra” (web, gépes menünél): csak fókuszra látszik; a tartalomoszlopra viszi a fókuszt. */
function Ugrolink({ cel }: { cel: { current: unknown } }) {
  const [fokusz, setFokusz] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      onFocus={() => setFokusz(true)}
      onBlur={() => setFokusz(false)}
      onPress={() => (cel.current as { focus?: () => void } | null)?.focus?.()}
      style={[{ position: 'absolute', zIndex: 50, top: 8, left: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: szin.sarga }, fokusz ? null : { left: -9999 }]}
    >
      <T m={15.5} s={750} c={szin.sotet}>
        Ugrás a tartalomra
      </T>
    </Pressable>
  );
}

/** Gépen (≥ 1024 pt, web, belépve, nem teljes képernyős út) a bal menü + a tartalom; egyébként csak a tartalom. */
function Elrendezes() {
  const asztali = useAsztali();
  const { allapot } = useAuth();
  const szegmensek = useSegments();
  const p = useGlobalSearchParams<{ vezetett?: string }>();
  const lathato = oldalsavLathatoE({ asztali, bent: allapot === 'bent', elsoSzegmens: szegmensek[0] as string | undefined, vezetett: !!p.vezetett });
  const tartalom = useRef<unknown>(null);
  useEffect(() => {
    // a tartalomoszlop programból fókuszálható (ugrólink), de a Tab-sorrendben nincs benne
    if (Platform.OS === 'web') (tartalom.current as { setAttribute?: (k: string, v: string) => void } | null)?.setAttribute?.('tabindex', '-1');
  }, []);
  return (
    <OldalsavCtx.Provider value={lathato}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {lathato ? <Ugrolink cel={tartalom} /> : null}
        {lathato ? <Oldalsav /> : null}
        <View ref={tartalom as never} role="main" style={{ flex: 1, minWidth: 0 }}>
          <Kapu />
        </View>
      </View>
    </OldalsavCtx.Provider>
  );
}

function Keret({ children }: { children: React.ReactNode }) {
  const asztali = useAsztali();
  return (
    <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' && !asztali ? '#DCE1EE' : szin.alap, alignItems: 'center' }}>
      <View style={[{ flex: 1, backgroundColor: szin.alap, overflow: 'hidden' }, asztali ? { width: '100%' } : keretStilus]}>{children}</View>
    </View>
  );
}

export default function Gyoker() {
  useEffect(() => webStilusBetolt(), []);
  const [betuk, betuHiba] = useFonts(BETUK);
  const [kesz, setKesz] = useState(false);
  useEffect(() => {
    if (betuk || betuHiba) {
      setKesz(true);
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [betuk, betuHiba]);
  if (!kesz) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={qc}>
        <Keret>
            <AuthProvider>
              <JelzesProvider>
                <ZaroltProvider>
                  <MagyarazatProvider>
                    <UtvaltasProvider>
                      <StatusBar style="light" />
                      <DemoFigyelo />
                      <Elrendezes />
                    </UtvaltasProvider>
                  </MagyarazatProvider>
                </ZaroltProvider>
              </JelzesProvider>
            </AuthProvider>
        </Keret>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Váratlan hiba: üres képernyő helyett érthető üzenet és újrapróbálás (expo-router hibahatár). */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: szin.alap, padding: 24, justifyContent: 'center', gap: 12 }}>
      <T m={22} s={700} lh={1.25}>
        Valami elromlott ezen a képernyőn.
      </T>
      <T m={15.5} c={szin.halvany} lh={1.5}>
        Az adataid biztonságban vannak. Próbáld újra; ha ismét előjön, írj a könyvelődnek.
      </T>
      {__DEV__ ? (
        <T m={13} c={szin.veszely}>
          {error.message}
        </T>
      ) : null}
      <GombE cim="Újra" onPress={() => void retry()} />
      <GombSz cim="Vissza a főoldalra" onPress={() => router.replace('/')} />
    </View>
  );
}
