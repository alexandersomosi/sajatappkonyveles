// 01 Belépés: tintakék sáv szóvédjeggyel; e-mail + jelszó; Google (és iOS-en Apple), ha be van kapcsolva; regisztráció.
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useConfig } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { AppleGomb, GoogleGomb } from '@/auth/kulso';
import { brand } from '@/config';
import { emailHiba } from '@/lib/validators';
import { jelszoEmailBeallit, mfaBeallit, regEmailBeallit } from '@/lib/atadas';
import { datumEvvel, datumEvvelAn, nemTor } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, jelzoDoboz, Lap } from '@/ui/alap';
import { AuthVaz, Szlogen } from '@/kepernyok/AuthKeret';
import { useAsztali } from '@/lib/elrendezes';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { forrasAdat, forrasTovabb, webKereses } from '@/lib/forras';

export default function Belepes() {
  const { belep, alkalmaz } = useAuth();
  const cfg = useConfig();
  const [email, setEmail] = useState('');
  const [jelszo, setJelszo] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [mezoHiba, setMezoHiba] = useState<{ email?: string | null; jelszo?: string | null }>({});
  const [tolt, setTolt] = useState(false);
  const [torlesAlatt, setTorlesAlatt] = useState<string | null>(null);
  // k7b (S16): egy befejezetlen regisztráció a jó jelszóval is „hibás” választ kap, és új kódot küldünk neki – a tipp
  // minden sikertelen belépés után ugyanúgy megjelenik, így semmit nem árul el
  const [kodTipp, setKodTipp] = useState(false);
  const jelszoRef = useRef<TextInputInstance>(null);
  const asztali = useAsztali();

  const [elso, ...tobbi] = brand.tagline.split(',');
  const google = !!cfg.data?.features.googleSignIn;
  const apple = Platform.OS === 'ios' && !!cfg.data?.features.appleSignIn;

  async function kuld(torlesVisszavon = false) {
    const eh = emailHiba(email);
    const jh = jelszo ? null : 'Írd be a jelszavadat.';
    setMezoHiba({ email: eh, jelszo: jh });
    if (eh || jh) return;
    setHiba(null);
    setTolt(true);
    try {
      const r = await belep(email, jelszo, { torlesVisszavon });
      setTorlesAlatt(null);
      if (r.mfaToken) {
        mfaBeallit(r.mfaToken);
        router.push('/ketlepcsos');
      }
    } catch (e) {
      if (e instanceof ApiHiba && e.code === 'deletion_pending') {
        setTorlesAlatt(typeof e.data?.deletionDueAt === 'string' ? e.data.deletionDueAt : '');
        setHiba(null);
      } else {
        setHiba(hibaUzenet(e, 'Nem sikerült belépni. Próbáld újra.'));
        if (e instanceof ApiHiba && e.status === 401) setKodTipp(true);
      }
    } finally {
      setTolt(false);
    }
  }

  return (
    <AuthVaz
      gepCim={undefined}
      fej={
        <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
          <Szlogen m={30} />
        </View>
      }
    >

          <Lap style={{ padding: 18 }}>
            {asztali ? (
              <T m={26} s={800} lh={1.2} ls={-0.02} accessibilityRole="header" style={{ marginBottom: 14 }}>
                Belépés
              </T>
            ) : null}
            <Mezo
              felirat="E-mail-cím"
              ikon="level"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => jelszoRef.current?.focus()}
              hiba={mezoHiba.email}
            />
            <Mezo
              ref={jelszoRef}
              felirat="Jelszó"
              ikon="lakat"
              jelszo
              value={jelszo}
              onChangeText={setJelszo}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void kuld(torlesAlatt !== null)}
              hiba={mezoHiba.jelszo}
              style={{ marginTop: 14 }}
            />
            <GombSz cim="Elfelejtettem a jelszavam" m={15} onPress={() => {
              jelszoEmailBeallit(email);
              router.push('/jelszo-elfelejtve');
            }} style={{ marginTop: 2, marginBottom: 8, alignSelf: 'flex-end' }} />
            <HibaSzoveg szoveg={hiba} style={{ marginTop: 0, marginBottom: 10 }} />
            {kodTipp && hiba ? (
              <GombSz
                cim="Most regisztráltál? Írd be a kódot a levélből"
                m={15}
                onPress={() => {
                  regEmailBeallit(email, 'belepes');
                  router.push('/postafiok');
                }}
                style={{ marginTop: -4, marginBottom: 8 }}
              />
            ) : null}
            {torlesAlatt !== null ? (
              <View style={[{ borderRadius: 12, padding: 14, marginBottom: 12 }, jelzoDoboz('figyelem')]}>
                <T m={15} s={650} c={szin.borostyanSzoveg} lh={1.45}>
                  A fiókod törlését kérted{torlesAlatt ? `, ${datumEvvelAn(torlesAlatt)} töröljük végleg` : ''}. Ha belépsz, visszavonod a törlést.
                </T>
              </View>
            ) : null}
            <GombE cim={torlesAlatt !== null ? 'Visszavonom a törlést és belépek' : 'Belépés'} onPress={() => void kuld(torlesAlatt !== null)} tolt={tolt} />
          </Lap>

          {google || apple ? (
            <>
              <T m={14.5} c={szin.halvany} kozep style={{ paddingTop: 4, paddingBottom: 12 }}>
                vagy
              </T>
              <View style={{ gap: 10 }}>
                {/* SPEC §31.3: a belépés lapján is új fiók keletkezhet (Google/Apple) – a forrás vele megy */}
                {google ? <GoogleGomb siker={alkalmaz} hiba={setHiba} webClientId={cfg.data?.googleClientIds.web} forras={Platform.OS === 'web' ? forrasAdat(webKereses()) : undefined} /> : null}
                {apple ? <AppleGomb siker={alkalmaz} hiba={setHiba} forras={Platform.OS === 'web' ? forrasAdat(webKereses()) : undefined} /> : null}
              </View>
            </>
          ) : null}

          {/* A regisztráció lapja közvetlenül a belépés (vagy a Google/Apple gombok) alatt áll, 12 pt-ra: a két lap
              között nem maradhat üres sáv (TERV 01; dizájn-ellenőrzés 11-19). */}
          <Lap style={{ marginTop: 12, paddingVertical: 16, paddingLeft: 18, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <T m={16} s={650} lh={1.3}>
                Még nem vagy ügyfél?
              </T>
              <T m={14} lh={1.4} c={szin.halvany} style={{ marginTop: 1 }}>
                Regisztrálj, és a könyvelőd átveszi a könyvelésed.
              </T>
            </View>
            <GombM cim="Regisztrálok" magas={44} onPress={() => router.push(`/regisztracio${Platform.OS === 'web' ? forrasTovabb(webKereses()) : ''}` as '/regisztracio')} />
          </Lap>
    </AuthVaz>
  );
}
