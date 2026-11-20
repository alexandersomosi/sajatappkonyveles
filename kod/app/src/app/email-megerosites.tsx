// E-mail megerősítése 6 jegyű kóddal (FUNKCIOK 1); újraküldés 60 mp után. Tárgykép: levélboríték.
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiHiba, post } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { AuthKeret } from '@/kepernyok/AuthKeret';
import { kodHiba } from '@/lib/validators';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { Targykep } from '@/ui/kepek';
import { useJelzes } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { useConfig } from '@/api/hooks';

export default function EmailMegerosites() {
  const cfg = useConfig();
  const { user, frissitUser, kilep } = useAuth();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const [kod, setKod] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [mezoHiba, setMezoHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  const [hatra, setHatra] = useState(60);
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
      await post('/auth/email/verify', { code: kod.trim() });
      frissitUser({ emailVerified: true });
      await qc.invalidateQueries();
      // k7c (tulaj 11-20: „nem úgy volt, hogy így végigmegy először, ilyen bevezetősen?”): a Főoldal dönt – egy új
      // ügyfél a vezetett első indulásba (/bevezeto → W1) kerül, nem a bekötési listára (SPEC §29.10.1)
      router.replace('/');
    } catch (e) {
      // A szerver a mezőhöz köti a hibát (fields.code): azt mutatjuk a mező alatt, nem az általános szöveget.
      if (e instanceof ApiHiba && e.fields?.code) setMezoHiba(e.fields.code);
      else setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }
  return (
    <AuthKeret cim="Erősítsd meg az e-mail-címed." al={user?.email ? `Küldtünk egy 6 jegyű kódot ide: ${user.email}` : 'Küldtünk egy 6 jegyű kódot.'} visszaCim={null}>
      <Lap style={{ padding: 18 }}>
        <Targykep nev="level_boritek" style={{ marginBottom: 10 }} />
        <Mezo felirat="A kód a levélből" value={kod} onChangeText={(t) => {
            setKod(t.replace(/\D/g, '').slice(0, 6));
            setMezoHiba(null);
          }} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" onSubmitEditing={kuld} hiba={mezoHiba} />
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
              await post('/auth/email/resend', {});
              setHatra(60);
              jelez('Elküldtük az új kódot.');
            } catch (e) {
              setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
            }
          }}
        />
        <GombSz cim="Másik e-mail-címmel regisztrálok" onPress={() => void kilep().then(() => router.replace('/regisztracio')).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} />
      </Lap>
    </AuthKeret>
  );
}
