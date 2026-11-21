// k8 ALAP-B (owner 11-20: "a kártyát csak a NEM kötelező visszahívás UTÁN kérjük", 35_bekotes_idopont) – the callback
// offer before the payment, in the CURRENT style (FELÜLET-A brings it to v2). "Visszahívást kérek" opens the existing
// callback screen (topic: Előfizetés); "Nem kell, mehetünk tovább" records the answer (guided action
// callback_offer_skip) and goes on. While a callback is open the payment waits (the server answers 409 step_locked).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CALLBACK_OFFER_TEXTS as X } from '@/_shared/k8';
import { useAjanlatKihagyas } from '@/api/hooks-k8';
import { hibaUzenet } from '@/lib/hiba';
import { szin } from '@/theme/tokens';
import { GombE, GombM, HibaSzoveg, Lap } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { T } from '@/ui/T';

/** The offer card. `nyitott` = a callback is already open (the client only waits). `tovabb` runs after "Nem kell". */
export function VisszahivasAjanlat({ nyitott, tovabb }: { nyitott: boolean; tovabb: () => void }) {
  const kihagy = useAjanlatKihagyas();
  const [hiba, setHiba] = useState<string | null>(null);
  return (
    <Lap style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Ikon3d nev="kerdezek" pt={40} />
        <T m={19} s={700} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
          {X.title}
        </T>
      </View>
      {nyitott ? (
        <T m={16} lh={1.5} style={{ marginTop: 10 }}>
          {X.waiting} {X.promise}
        </T>
      ) : (
        <>
          <T m={16} lh={1.5} style={{ marginTop: 10 }}>
            {X.text}
          </T>
          <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 6 }}>
            {X.promise}
          </T>
          <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 6 }}>
            {X.lockNote}
          </T>
          <GombM cim={X.request} style={{ marginTop: 14, alignSelf: 'flex-start' }} onPress={() => router.push({ pathname: '/visszahivas', params: { forras: 'bekotes', tema: 'elofizetes' } })} />
          <GombE
            cim={X.skip}
            tolt={kihagy.isPending}
            style={{ marginTop: 12 }}
            onPress={() => kihagy.mutate(undefined, { onSuccess: () => tovabb(), onError: (e) => setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')) })}
          />
          <HibaSzoveg szoveg={hiba} />
        </>
      )}
    </Lap>
  );
}
