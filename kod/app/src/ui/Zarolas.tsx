// SPEC §28.K.5 – díj-zárolás: ha a havidíj vagy az éves zárás díja nincs kifizetve, minden fő képernyőn a fejléc alatt
// egy sor + „Fizetek” gomb + „Írok az ügyfélszolgálatnak”. Fizetni, letölteni, írni ilyenkor is lehet.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import type { Me } from '../_shared/api';
import { fillPlaceholders, LOCK_TEXTS } from '../_shared/bekotes';
import { get } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { szin } from '../theme/tokens';
import { T } from './T';
import { GombM, GombSz } from './alap';

export function useServiceLock() {
  const bent = useAuth().allapot === 'bent';
  const me = useQuery<Me>({ queryKey: ['me'], queryFn: () => get<Me>('/me'), enabled: bent, staleTime: 60_000 });
  return { lock: me.data?.client?.serviceLock ?? null, fn: me.data?.accountant?.firstName ?? 'a könyvelőd' };
}

export function ZarolasSav() {
  const { lock, fn } = useServiceLock();
  if (!lock) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: szin.borostyanAlap, paddingVertical: 12, paddingHorizontal: 16 }}>
      <T m={15.5} s={600} lh={1.4} c={szin.borostyanSzoveg}>
        {lock.text || fillPlaceholders(LOCK_TEXTS.banner, { firstName: fn, mit: LOCK_TEXTS.mit.havidij, osszeg: String(lock.amountHuf) })}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {/* §29.9.4: a manual lock ('kezi') has nothing to pay – only the message link */}
        {lock.reasons.every((r) => (r as string) === 'kezi') ? null : <GombM cim={LOCK_TEXTS.bannerButton} onPress={() => router.push(lock.payRoute as never)} />}
        <GombSz cim={LOCK_TEXTS.bannerLink} c={szin.borostyanSzoveg} m={15.5} onPress={() => router.push('/uzenetek')} style={{ paddingVertical: 6 }} />
      </View>
    </View>
  );
}
