// Új jelszó a kóddal (FUNKCIOK 1). Sikeres csere után minden munkamenet kilép (SPEC §12.2), ezért újra be kell lépni.
import { useState } from 'react';
import { router } from 'expo-router';
import { ApiHiba, post } from '@/api/http';
import { useConfig } from '@/api/hooks';
import { AuthKeret } from '@/kepernyok/AuthKeret';
import { emailHiba, jelszoHiba, kodHiba } from '@/lib/validators';
import { jelszoEmailBeallit, jelszoEmailOlvas } from '@/lib/atadas';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { useJelzes } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

export default function JelszoUj() {
  const jelez = useJelzes();
  const cfg = useConfig();
  const tudott = jelszoEmailOlvas();
  const [email, setEmail] = useState(tudott);
  const [kod, setKod] = useState('');
  const [jelszo, setJelszo] = useState('');
  const [hibak, setHibak] = useState<{ email?: string | null; kod?: string | null; jelszo?: string | null }>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  async function kuld() {
    const h = { email: tudott ? null : emailHiba(email), kod: kodHiba(kod), jelszo: jelszoHiba(jelszo, email) };
    setHibak(h);
    if (h.email || h.kod || h.jelszo) return;
    setTolt(true);
    setHiba(null);
    try {
      await post('/auth/password/reset', { email: email.trim(), code: kod.trim(), newPassword: jelszo }, { auth: false });
      jelszoEmailBeallit(null);
      jelez({ szoveg: 'Kész: megvan az új jelszavad. Lépj be vele.', kesz: true });
      router.replace('/belepes');
    } catch (e) {
      if (e instanceof ApiHiba && e.fields && (e.fields.code || e.fields.newPassword || e.fields.email)) {
        setHibak({ kod: e.fields.code ?? null, jelszo: e.fields.newPassword ?? null, email: e.fields.email ?? null });
        setHiba(null);
      } else setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }
  return (
    <AuthKeret
      cim="Nézd meg a leveleidet."
      al={email ? `Küldtünk egy 6 jegyű kódot ide: ${email}. 15 percig érvényes.` : 'Küldtünk egy 6 jegyű kódot. 15 percig érvényes.'}
      visszaCim="Vissza"
      visszaHova="/jelszo-elfelejtve"
    >
      <Lap style={{ padding: 18 }}>
        {tudott ? null : (
          <Mezo felirat="E-mail-cím" value={email} onChangeText={(t) => setEmail(t)} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hiba={hibak.email} style={{ marginBottom: 14 }} />
        )}
        <Mezo felirat="A kód a levélből" value={kod} onChangeText={(t) => {
            setKod(t.replace(/\D/g, '').slice(0, 6));
            setHibak((x) => ({ ...x, kod: null }));
          }} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" hiba={hibak.kod} />
        <Mezo felirat="Új jelszó" jelszo value={jelszo} onChangeText={setJelszo} autoComplete="new-password" textContentType="newPassword" hiba={hibak.jelszo} sugo="Legalább 10 karakter." style={{ marginTop: 14 }} />
        <HibaSzoveg szoveg={hiba} />
        <GombE cim="Beállítom az új jelszót" onPress={kuld} tolt={tolt} style={{ marginTop: 18 }} />
        {cfg.data?.demo ? (
          <T m={14} c={szin.borostyanSzoveg} lh={1.45} style={{ marginTop: 14 }}>
            DEMO: most nem küldünk ki valódi levelet. A kódot a könyvelői felületen látod: Tulajdonos menü, Demo-postafiók.
          </T>
        ) : null}
        <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 14 }}>
          Nem jött meg? Nézd meg a levélszemét mappát is.
        </T>
        <GombSz cim="Új kódot kérek" onPress={() => {
          jelszoEmailBeallit(email);
          router.replace('/jelszo-elfelejtve');
        }} />
      </Lap>
    </AuthKeret>
  );
}
