// Elfelejtett jelszó (FUNKCIOK 1): e-mail-cím → 6 jegyű kód e-mailben (a szerver mindig 202-t ad, nem árulja el, van-e fiók).
import { useState } from 'react';
import { router } from 'expo-router';
import { ApiHiba, post } from '@/api/http';
import { AuthKeret } from '@/kepernyok/AuthKeret';
import { emailHiba } from '@/lib/validators';
import { jelszoEmailBeallit, jelszoEmailOlvas } from '@/lib/atadas';
import { GombE, HibaSzoveg, Lap } from '@/ui/alap';
import { Mezo } from '@/ui/Mezo';
import { hibaUzenet } from '@/lib/hiba';

export default function JelszoElfelejtve() {
  const [email, setEmail] = useState(jelszoEmailOlvas());
  const [mezoHiba, setMezoHiba] = useState<string | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  async function kuld() {
    const h = emailHiba(email);
    setMezoHiba(h);
    if (h) return;
    setTolt(true);
    setHiba(null);
    try {
      await post('/auth/password/forgot', { email: email.trim() }, { auth: false });
      jelszoEmailBeallit(email);
      router.push('/jelszo-uj');
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }
  return (
    <AuthKeret cim="Új jelszót kérsz?" al="Írd be az e-mail-címedet. Küldünk rá egy 6 jegyű kódot, azzal megadhatod az új jelszavad.">
      <Lap style={{ padding: 18 }}>
        <Mezo felirat="E-mail-cím" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" hiba={mezoHiba} onSubmitEditing={kuld} returnKeyType="send" />
        <HibaSzoveg szoveg={hiba} />
        <GombE cim="Kérem a kódot" onPress={kuld} tolt={tolt} style={{ marginTop: 18 }} />
      </Lap>
    </AuthKeret>
  );
}
