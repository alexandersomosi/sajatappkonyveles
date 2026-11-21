// DEMO fizetés jelzése (SPEC §9.7, §29.1.12): jól látható, hogy nem valódi kártyás fizetés – amíg a szerver
// PAYMENT_PROVIDER=demo módban fut. Az árak valódiak (§29.4.1), csak a fizetés nem az.
import { jelzoDoboz } from './alap';
import { View } from 'react-native';
import { PAYMENT_SCREEN_TEXTS } from '../_shared/k29';
import { szin } from '../theme/tokens';
import { T } from './T';

/** k8 (payment-path review 2): the transfer path never says "kártya". */
const DEMO_ATUTALAS = 'Bemutató díjbekérő: ne utalj rá pénzt. Az utalást a DEMO-ban mi rögzítjük.';

export function DemoFizetesJel({ style, atutalas }: { style?: object; atutalas?: boolean }) {
  return (
    <View style={[{ borderRadius: 12, ...jelzoDoboz('figyelem'), padding: 14, marginBottom: 12 }, style]} accessibilityRole="alert">
      <T m={15.5} s={700} c={szin.borostyanSzoveg} lh={1.4}>
        DEMO FIZETÉS
      </T>
      <T m={14.5} c={szin.borostyanSzoveg} lh={1.45}>
        {atutalas ? DEMO_ATUTALAS : PAYMENT_SCREEN_TEXTS.demoBanner.replace(/^DEMO FIZETÉS – /, '').replace(/^./, (c) => c.toUpperCase())}
      </T>
    </View>
  );
}
