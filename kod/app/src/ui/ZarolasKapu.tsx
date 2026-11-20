// SPEC §28.K.5 (k6c2): ha a díj-zárolás miatt egy művelet nem indítható (403 service_locked), a lapot el sem kezdjük –
// a zárolás szövege és a „Fizetek” gomb áll a helyén, nem egy végigkitöltött űrlap, ami csak a végén hibázik.
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { fillPlaceholders, LOCK_TEXTS } from '../_shared/bekotes';
import { szin } from '../theme/tokens';
import { GombE, Lap } from './alap';
import { CimSor, Kepernyo, vissza } from './keret';
import { T } from './T';
import { useServiceLock } from './Zarolas';

/** A zárolt művelet szövege („Ez most szünetel, mert nincs kifizetve a havidíj…”). */
export function zaroltSzoveg(reasons: readonly string[]): string {
  const mit = reasons.map((r) => (LOCK_TEXTS.mit as Record<string, string>)[r] ?? r).join(' és ') || LOCK_TEXTS.mit.havidij;
  return fillPlaceholders(LOCK_TEXTS.lockedAction, { mit });
}

/** Egy zárolt indítógomb helyén álló sor (borostyán szöveg). Null, ha nincs zárolás. */
export function ZaroltSor({ style }: { style?: object }) {
  const { lock } = useServiceLock();
  if (!lock) return null;
  return (
    <View style={style}>
      <T m={15.5} s={600} lh={1.45} c={szin.borostyanSzoveg}>
        {zaroltSzoveg(lock.reasons)}
      </T>
    </View>
  );
}

export function ZarolasKapu({ cim, ful = 'fooldal', children }: { cim: string; ful?: 'fooldal' | 'fiok'; children: ReactNode }) {
  const { lock } = useServiceLock();
  if (!lock) return <>{children}</>;
  return (
    <Kepernyo ful={ful} fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/')} cim={cim} />}>
      <Lap style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <T m={16} lh={1.45}>
          {zaroltSzoveg(lock.reasons)}
        </T>
        <GombE cim={LOCK_TEXTS.bannerButton} onPress={() => router.push(lock.payRoute as never)} style={{ marginTop: 14 }} />
      </Lap>
    </Kepernyo>
  );
}
