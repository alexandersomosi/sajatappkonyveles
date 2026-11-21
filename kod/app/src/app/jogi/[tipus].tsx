// Jogi iratok (SPEC §21): a szerverről (kod/jogi) jövő Markdown – #, ##, -, **félkövér** – olvasható lapon.
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useJogi } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { szin } from '@/theme/tokens';
import { Lap } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

function Sor({ szoveg, m, s = 400 }: { szoveg: string; m: number; s?: 400 | 600 | 650 | 700 }) {
  const reszek = szoveg.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <T m={m} s={s} lh={1.55}>
      {reszek.map((r, i) =>
        r.startsWith('**') && r.endsWith('**') ? (
          <T key={i} m={m} s={650} lh={1.55}>
            {r.slice(2, -2)}
          </T>
        ) : (
          r
        ),
      )}
    </T>
  );
}

export function Markdown({ md }: { md: string }) {
  const blokkok = md.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <View style={{ gap: 10 }}>
      {blokkok.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t.startsWith('# ')) return <T key={i} m={22} s={700} lh={1.25} ls={-0.02}>{t.slice(2)}</T>;
        if (t.startsWith('## ')) return <T key={i} m={18} s={650} lh={1.3} style={{ marginTop: 6 }}>{t.slice(3)}</T>;
        if (t.split('\n').every((l) => /^\s*-\s/.test(l)))
          return (
            <View key={i} style={{ gap: 6 }}>
              {t.split('\n').map((l, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                  <T m={15.5} c={szin.halvany}>•</T>
                  <View style={{ flex: 1 }}>
                    <Sor szoveg={l.replace(/^\s*-\s/, '')} m={15.5} />
                  </View>
                </View>
              ))}
            </View>
          );
        return <Sor key={i} szoveg={t.replace(/\n/g, ' ')} m={15.5} />;
      })}
    </View>
  );
}

export default function Jogi() {
  // A szerződés lépésből nyitva a Főoldal-fül aktív, és oda lépünk vissza; máskor a Fiók (SPEC §26.5.1).
  const { tipus, honnan } = useLocalSearchParams<{ tipus: string; honnan?: string }>();
  const szerzodesbol = honnan === 'szerzodes';
  const q = useJogi(tipus);
  const { user } = useAuth();
  // Kijelentkezve: az appon belülről jött (pl. a regisztrációról) → vissza oda; közvetlenül nyitva (a weboldal láblécéből,
  // a weboldal nem ad át hivatkozót) → a weboldalra az app.adozz.hu-ról, máshol a regisztrációhoz – nem a belépéshez.
  const kintrolVissza = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === 'app.adozz.hu') {
      window.location.href = 'https://adozz.hu/';
      return;
    }
    router.replace('/regisztracio' as never);
  };
  return (
    <Kepernyo ful={szerzodesbol ? 'fooldal' : 'fiok'} fejlec={<CimSor visszaCim="Vissza" vissza={() => (user ? vissza(szerzodesbol ? '/bekotes/szerzodes' : '/fiok') : kintrolVissza())} cim={q.data?.title ?? 'Jogi irat'} al={q.data ? `Változat: ${q.data.version}` : undefined} />}>
      {q.isLoading ? <Betolt /> : q.error || !q.data ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : (
        <Lap style={{ padding: 18 }}>
          <Markdown md={q.data.markdown.replace(/^# .*\n+/, '')} />
        </Lap>
      )}
    </Kepernyo>
  );
}
