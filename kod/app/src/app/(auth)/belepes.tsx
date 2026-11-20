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
import { Fejlec, GombE, GombM, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { MintaJel } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { Szojegy } from '@/ui/Szojegy';
import { T } from '@/ui/T';
import { TeljesCtx } from '@/ui/teljes';
import { hibaUzenet } from '@/lib/hiba';

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: szin.lap }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
        <Fejlec rozX={120} rozY={112} alsoTer={22}>
          <View style={{ paddingTop: 18, paddingHorizontal: 20 }}>
            <Szojegy />
          </View>
          <T m={16.5} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 16, paddingHorizontal: 20, maxWidth: 360 }}>
            <T m={16.5} s={600} c="#fff" lh={1.45}>
              {elso}
              {tobbi.length ? ',' : ''}
            </T>
            {tobbi.join(',')} {nemTor(brand.subline)}
          </T>
        </Fejlec>
        {/* SPEC §29.4.3 (C_VEGLEGES): teljes szélességű szakaszok, köztük a 10 pt-os sáv */}
        <TeljesCtx.Provider value>
        <View style={{ paddingHorizontal: 16, flex: 1 }}>
          <Lap elso style={{ padding: 18 }}>
            <Mezo
              felirat="E-mail-cím"
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
            }} style={{ marginTop: 2, marginBottom: 8 }} />
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
              <View style={{ borderRadius: 12, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }}>
                <T m={15} s={650} c={szin.borostyanSzoveg} lh={1.45}>
                  A fiókod törlését kérted{torlesAlatt ? `, ${datumEvvelAn(torlesAlatt)} töröljük végleg` : ''}. Ha belépsz, visszavonod a törlést.
                </T>
              </View>
            ) : null}
            <GombE cim={torlesAlatt !== null ? 'Visszavonom a törlést és belépek' : 'Belépés'} onPress={() => void kuld(torlesAlatt !== null)} tolt={tolt} />
          </Lap>

          {google || apple ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 13, paddingBottom: 10, paddingHorizontal: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#C2CBD9' }} />
                <T m={14.5} c={szin.halvanyAlapon}>
                  vagy
                </T>
                <View style={{ flex: 1, height: 1, backgroundColor: '#C2CBD9' }} />
              </View>
              <View style={{ gap: 10 }}>
                {google ? <GoogleGomb siker={alkalmaz} hiba={setHiba} webClientId={cfg.data?.googleClientIds.web} /> : null}
                {apple ? <AppleGomb siker={alkalmaz} hiba={setHiba} /> : null}
              </View>
            </>
          ) : null}

          {/* A regisztráció lapja közvetlenül a belépés (vagy a Google/Apple gombok) alatt áll, 12 pt-ra: a két lap
              között nem maradhat üres sáv (TERV 01; dizájn-ellenőrzés 11-19). */}
          <Lap style={{ marginTop: 12, paddingVertical: 14, paddingLeft: 18, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <T m={16} s={650} lh={1.3}>
                Még nem vagy ügyfél?
              </T>
              <T m={14} lh={1.4} c={szin.halvany} style={{ marginTop: 1 }}>
                Pár perc, és bekötünk.
              </T>
            </View>
            <GombM cim="Regisztrálok" magas={46} onPress={() => router.push('/regisztracio')} />
          </Lap>
        </View>
        </TeljesCtx.Provider>
      </ScrollView>
      <MintaJel />
    </KeyboardAvoidingView>
  );
}
