// Fiók törlése (FUNKCIOK 19, SPEC §4.8): mi történik (azonnal kilépsz, előfizetés és kártya törlődik, 30 napig
// visszavonható, a törvény szerint megőrzendő adatok – pl. azonosítás 8 év – zárolva maradnak), jelszóval/kóddal.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ApiHiba, post } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { datumEvvelIg } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { GombM, GombSz, HibaSzoveg, Lap, Pipa, Felsorolas } from '@/ui/alap';
import { KeszJel } from '@/ui/kepek';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { szovegLista } from '@/lib/szovegek';
import { Pressable } from 'react-native';
import { hibaUzenet } from '@/lib/hiba';

const MI_TORTENIK = [
  'Azonnal kilépsz mindenhonnan, és nem tudsz belépni.',
  'Az előfizetésed megszűnik, a kártyádat a SimplePay-nél is töröljük. Többet nem vonunk le.',
  '30 napig meggondolhatod: ha addig belépsz, visszavonhatod.',
  '30 nap után mindent törlünk, amit a törvény nem kötelez megőrizni.',
  'Amit a törvény szerint meg kell őriznünk (például az azonosítást 8 évig, az adóiratokat az elévülésig), azt zárolva tároljuk, és utána töröljük.',
];

export default function Torles() {
  const { user, kilep } = useAuth();
  const jelez = useJelzes();
  const [ertem, setErtem] = useState(false);
  const [jelszo, setJelszo] = useState('');
  const [kod, setKod] = useState('');
  const [ok, setOk] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const [jelszoHiba, setJelszoHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);

  async function torol() {
    if (!ertem) return setHiba('Jelöld be, hogy érted, mi történik.');
    if (!jelszo && !kod) return setHiba(user?.totpEnabled ? 'Írd be a jelszavad vagy a kódot az appból.' : 'Írd be a jelszavad.');
    setHiba(null);
    setTolt(true);
    try {
      const r = await post<{ deletionDueAt: string }>('/me/delete', { password: jelszo || undefined, totpCode: kod || undefined, reason: ok.trim() || undefined });
      jelez(`Töröltük a fiókod. ${r?.deletionDueAt ? `${datumEvvelIg(r.deletionDueAt)} visszavonhatod.` : ''}`);
      await kilep().catch(() => undefined);
      router.replace('/belepes');
    } catch (e) {
      if (e instanceof ApiHiba && e.fields?.password) {
        setJelszoHiba(user?.totpEnabled ? 'Ez nem a jelszavad (vagy a kód nem jó).' : 'Ez nem a jelszavad.');
        setHiba(null);
      } else setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }

  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Fiók törlése" al="Sajnáljuk, hogy mész. Előtte érdemes letöltened az adataidat." />}>
      <Lap style={{ padding: 18 }}>
        <T m={17} s={650} lh={1.4}>
          Mi történik?
        </T>
        <Felsorolas elemek={szovegLista('fiok_torles.kovetkezmeny', {}, MI_TORTENIK)} />
        <GombM cim="Előbb letöltöm az adataimat" onPress={() => router.push('/fiok/adataim')} style={{ marginTop: 16 }} />
      </Lap>
      <Lap style={{ padding: 18, marginTop: 12, gap: 12 }}>
        <Pipa be={ertem} valt={setErtem}>
          Értem, és törölni szeretném a fiókom.
        </Pipa>
        <Mezo
          felirat="Jelszó"
          jelszo
          value={jelszo}
          onChangeText={(v) => {
            setJelszo(v);
            setJelszoHiba(null);
          }}
          autoComplete="current-password"
          hiba={jelszoHiba}
        />
        {user?.totpEnabled ? <Mezo felirat="Vagy kód a hitelesítő appból" value={kod} onChangeText={(t) => setKod(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" /> : null}
        <Mezo felirat="Miért mész? (nem kötelező)" value={ok} onChangeText={setOk} multiline />
        <HibaSzoveg szoveg={hiba} />
        <Pressable
          accessibilityRole="button"
          disabled={tolt}
          onPress={torol}
          style={({ pressed }) => ({ height: 56, borderRadius: 999, backgroundColor: pressed ? '#8E1C13' : szin.veszely, alignItems: 'center', justifyContent: 'center', opacity: tolt ? 0.6 : 1 })}
        >
          <T m={17} s={650} c="#fff">
            Törlöm a fiókom
          </T>
        </Pressable>
        <GombSz cim="Mégsem" onPress={() => vissza('/fiok')} style={{ alignSelf: 'center' }} />
      </Lap>
    </Kepernyo>
  );
}
