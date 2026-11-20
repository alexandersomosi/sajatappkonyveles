// DEMO fizetés jelzése (SPEC §9.7, §29.1.12): jól látható, hogy nem valódi kártyás fizetés – amíg a szerver
// PAYMENT_PROVIDER=demo módban fut. Az árak valódiak (§29.4.1), csak a fizetés nem az.
import { View } from 'react-native';
import { PAYMENT_SCREEN_TEXTS } from '../_shared/k29';
import { szin } from '../theme/tokens';
import { T } from './T';

export function DemoFizetesJel({ style }: { style?: object }) {
  return (
    <View style={[{ borderRadius: 12, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }, style]} accessibilityRole="alert">
      <T m={15.5} s={700} c={szin.borostyanSzoveg} lh={1.4}>
        DEMO FIZETÉS
      </T>
      <T m={14.5} c={szin.borostyanSzoveg} lh={1.45}>
        {PAYMENT_SCREEN_TEXTS.demoBanner.replace(/^DEMO FIZETÉS – /, '').replace(/^./, (c) => c.toUpperCase())}
      </T>
    </View>
  );
}
