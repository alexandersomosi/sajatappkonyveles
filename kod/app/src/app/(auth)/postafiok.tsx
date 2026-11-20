// k7b (SPEC §27.11 S16): regisztráció után „Nézd meg a postafiókodat”. A szerver ugyanazt válaszolja, ha a címhez
// még nincs fiók (ilyenkor 6 jegyű kódot küld), és ha már van (ilyenkor egy „Már van fiókod” levelet: lépj be, vagy kérj
// új jelszót) – így senki nem tudja meg a képernyőből, kinek van nálunk fiókja. A kód nyitja meg a munkamenetet.
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiHiba, post } from '@/api/http';
import { useConfig } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { AuthKeret } from '@/kepernyok/AuthKeret';
import { kodHiba } from '@/lib/validators';
import { mfaBeallit, regEmailBeallit, regEmailOlvas, regHonnanOlvas } from '@/lib/atadas';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { Targykep } from '@/ui/kepek';
import { useJelzes } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

export default function Postafiok() {
  const cfg = useConfig();
  const { regisztracioMegerosit } = useAuth();
  // SPEC §31.3: „Visszahívást kérek” a nyitóoldalon → a kód után a visszahívás lapja nyílik
  const { cel } = useLocalSearchParams<{ cel?: string }>();
  const jelez = useJelzes();
  const email = regEmailOlvas();
  // belépésből jött: egy befejezetlen regisztráció a jó jelszóval új kódot kapott (a szerver ezt sem árulja el)
  const belepesbol = regHonnanOlvas() === 'belepes';
  const [kod, setKod] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [mezoHiba, setMezoHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  const [hatra, setHatra] = useState(60);
  useEffect(() => {
    // újratöltés után nincs meg a cím (nem tesszük az URL-be): vissza a regisztrációhoz
    if (!email) router.replace(belepesbol ? '/belepes' : '/regisztracio');
  }, [email]);
  useEffect(() => {
    if (hatra <= 0) return;
    const t = setTimeout(() => setHatra((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [hatra]);
  async function kuld() {
    const h = kodHiba(kod);
    if (h) return setMezoHiba(h);
    setTolt(true);
    setHiba(null);
    setMezoHiba(null);
    try {
      const r = await regisztracioMegerosit(email, kod);
      if (r.mfaToken) {
        mfaBeallit(r.mfaToken);
        router.replace('/ketlepcsos');
        return;
      }
      regEmailBeallit(null);
      // a Főoldal dönt: egy új ügyfél a vezetett első indulásba kerül (SPEC §29.10.1); a visszahívás lapjáról is oda tér vissza
      router.replace(cel === 'visszahivas' ? '/visszahivas' : '/');
    } catch (e) {
      if (e instanceof ApiHiba && e.fields?.code) setMezoHiba(e.fields.code);
      else setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }
  return (
    <AuthKeret
      cim="Nézd meg a postafiókodat."
      al={
        belepesbol
          ? `Ha még nem fejezted be a regisztrációt, és a jelszavad jó volt, most küldtünk egy 6 jegyű kódot ide: ${email}. Írd be, és kész a regisztráció.`
          : `Levelet küldtünk ide: ${email}. Ha ezzel a címmel még nincs fiókod, egy 6 jegyű kódot találsz benne. Ha már van fiókod, a levélben leírtuk, hogyan lépj be.`
      }
      visszaCim="Vissza"
      visszaHova={belepesbol ? '/belepes' : '/regisztracio'}
    >
      <Lap style={{ padding: 18 }}>
        <Targykep nev="level_boritek" style={{ marginBottom: 10 }} />
        <Mezo
          felirat="A kód a levélből"
          value={kod}
          onChangeText={(t) => {
            setKod(t.replace(/\D/g, '').slice(0, 6));
            setMezoHiba(null);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onSubmitEditing={kuld}
          hiba={mezoHiba}
        />
        <HibaSzoveg szoveg={hiba} />
        <GombE cim="Megerősítem" onPress={kuld} tolt={tolt} style={{ marginTop: 18 }} />
        {cfg.data?.demo ? (
          <T m={14} c={szin.borostyanSzoveg} lh={1.45} style={{ marginTop: 14 }}>
            DEMO: most nem küldünk ki valódi levelet. A kódot a könyvelői felületen látod: Tulajdonos menü, Demo-postafiók.
          </T>
        ) : null}
        <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 14 }}>
          Nem jött meg? Nézd meg a levélszemét mappát is. {hatra > 0 ? `${hatra} másodperc múlva újat kérhetsz.` : ''}
        </T>
        <GombSz
          cim="Új kódot kérek"
          disabled={hatra > 0}
          style={{ opacity: hatra > 0 ? 0.5 : 1 }}
          onPress={async () => {
            try {
              await post('/auth/register/resend', { email }, { auth: false });
              setHatra(60);
              jelez('Ha ehhez a címhez kód tartozik, elküldtük az újat.');
            } catch (e) {
              setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
            }
          }}
        />
        <GombSz cim="Már van fiókom, belépek" onPress={() => router.replace('/belepes')} />
        <GombSz
          cim="Másik e-mail-címmel regisztrálok"
          onPress={() => {
            regEmailBeallit(null);
            router.replace('/regisztracio');
          }}
        />
      </Lap>
    </AuthKeret>
  );
}
