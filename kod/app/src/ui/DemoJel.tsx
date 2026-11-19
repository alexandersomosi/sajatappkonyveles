// DEMO fizetés jelzése (SPEC §9.7): jól látható, hogy nem valódi kártyás fizetés.
import { View } from 'react-native';
import { szin } from '../theme/tokens';
import { T } from './T';

export function DemoFizetesJel() {
  return (
    <View style={{ borderRadius: 12, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }}>
      <T m={15.5} s={700} c={szin.borostyanSzoveg} lh={1.4}>
        DEMO FIZETÉS
      </T>
      <T m={14.5} c={szin.borostyanSzoveg} lh={1.45}>
        Ez nem valódi kártyás fizetés, nem vonunk le pénzt. A SimplePay-szerződés megkötése után kapcsoljuk be az éles fizetést.
      </T>
    </View>
  );
}

