// Kétlépcsős belépés (FUNKCIOK 1, 19): a hitelesítő app 6 jegyű kódja vagy egy tartalék kód.
import { useState } from 'react';
import { router } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { AuthKeret } from '@/kepernyok/AuthKeret';
import { GombE, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { Mezo } from '@/ui/Mezo';
import { mfaOlvas, mfaTorol } from '@/lib/atadas';
import { hibaUzenet } from '@/lib/hiba';

export default function Ketlepcsos() {
  const t = mfaOlvas();
  const { belepKoddal } = useAuth();
  const [tartalek, setTartalek] = useState(false);
  const [kod, setKod] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [mezoHiba, setMezoHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  async function kuld() {
    if (!t) {
      router.replace('/belepes');
      return;
    }
    if (!tartalek && !/^\d{6}$/.test(kod)) return setMezoHiba('A kód 6 számjegy.');
    if (tartalek && kod.replace(/[^0-9A-Za-z]/g, '').length < 12) return setMezoHiba('A tartalék kód 12 betű és szám (például k7q2-m9xd-4hpt). Nézd meg, ahova elmentetted.');
    setTolt(true);
    setHiba(null);
    setMezoHiba(null);
    try {
      await belepKoddal(t, kod);
      mfaTorol();
    } catch (e) {
      if (e instanceof ApiHiba && e.fields?.code) setMezoHiba(e.fields.code === 'Ez a kód nem jó.' ? (tartalek ? 'Ez a tartalék kód nem jó, vagy már felhasználtad.' : 'Ez a kód nem jó. Várd meg a következőt az appban, és azt írd be.') : e.fields.code);
      else if (e instanceof ApiHiba && e.code === 'unauthenticated') {
        mfaTorol();
        setHiba('Lejárt az idő. Lépj be újra.');
      } else setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }
  return (
    <AuthKeret cim="Még egy kód kell." al={tartalek ? 'Írd be az egyik tartalék kódodat. Mindegyik csak egyszer használható.' : 'Nyisd meg a hitelesítő appodat, és írd be a 6 jegyű kódot.'}>
      <Lap style={{ padding: 18 }}>
        <Mezo
          felirat={tartalek ? 'Tartalék kód' : 'A kód az appból'}
          value={kod}
          onChangeText={(x) => {
            setKod(tartalek ? x.toLowerCase().slice(0, 20) : x.replace(/\D/g, '').slice(0, 6));
            setMezoHiba(null);
          }}
          hiba={mezoHiba}
          keyboardType={tartalek ? 'default' : 'number-pad'}
          autoCapitalize="none"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          onSubmitEditing={kuld}
        />
        <HibaSzoveg szoveg={hiba} />
        <GombE cim="Belépés" onPress={kuld} tolt={tolt} style={{ marginTop: 18 }} />
        <GombSz
          cim={tartalek ? 'Inkább az appból írom be' : 'Nincs nálam a telefonom: tartalék kód'}
          onPress={() => {
            setTartalek((x) => !x);
            setKod('');
            setHiba(null);
            setMezoHiba(null);
          }}
          style={{ marginTop: 6 }}
        />
      </Lap>
    </AuthKeret>
  );
}
