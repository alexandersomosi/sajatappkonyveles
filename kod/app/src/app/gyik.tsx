// Gyakori kérdések (FUNKCIOK 32: a szöveget az admin szerkeszti). Lenyitható kérdések; belépés nélkül is olvasható.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useGyik } from '@/api/hooks';
import { szin } from '@/theme/tokens';
import { GombM, Lap } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { visszahivasUt } from '@/ui/Visszahivas';

export default function Gyik() {
  const q = useGyik();
  const [nyitva, setNyitva] = useState<string | null>(null);
  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/fiok')} cim="Gyakori kérdések" />}>
      {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : (
        <Lap>
          {(q.data?.items ?? []).map((f, i) => {
            const on = nyitva === f.id;
            return (
              <Pressable key={f.id} accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setNyitva(on ? null : f.id)} style={{ paddingVertical: 14, paddingHorizontal: 18, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <T m={16} s={600} lh={1.4} style={{ flex: 1 }}>
                    {f.question}
                  </T>
                  <T m={14} s={600} lh={1.6} c={szin.tintakekSzoveg} alahuz>
                    {on ? 'Becsukom' : 'Kinyitom'}
                  </T>
                </View>
                {on ? (
                  <T m={15.5} lh={1.55} c={szin.tinta} style={{ marginTop: 8 }}>
                    {f.answer}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </Lap>
      )}
      <Lap style={{ marginTop: 16, padding: 18 }}>
        <T m={17} s={650} lh={1.4}>
          Nem találtad a választ? Kérj visszahívást.
        </T>
        <T m={15.5} c={szin.halvany} lh={1.5} style={{ marginTop: 4, marginBottom: 12 }}>
          A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. Írni is tudsz nekünk az Üzenetekben.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <GombM cim="Kérj visszahívást" ikon="ora" onPress={() => router.push(visszahivasUt('gyik', 'egyeb'))} />
          <GombM cim="Kérdezek" ikon="uzenetek" onPress={() => router.push('/uzenetek')} />
        </View>
      </Lap>
    </Kepernyo>
  );
}
