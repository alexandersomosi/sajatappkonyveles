// SPEC §29.1.3 – the card consent, shown IN FULL before the Stripe page opens (no "teljes szöveg" fold), with one
// checkbox. The server fills it with the client's own numbers and checks version + sha256 on start (409 → shown again).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { CardConsentView } from '@/_shared/k29';
import { CARD_CONSENT_UI } from '@/_shared/k29';
import { szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Pipa } from '@/ui/alap';
import { T } from '@/ui/T';

/** "**bold first line**", "– list line", plain lines. */
export function EngedelySzoveg({ szoveg }: { szoveg: string }) {
  const sorok = szoveg.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <View style={{ gap: 6 }}>
      {sorok.map((s, i) => {
        const felkover = /^\*\*(.*)\*\*$/.exec(s);
        if (felkover) {
          return (
            <T key={i} m={16} s={650} lh={1.45}>
              {felkover[1]}
            </T>
          );
        }
        if (s.startsWith('– ') || s.startsWith('- ')) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 2 }}>
              <T m={16} lh={1.45} c={szin.halvany}>
                –
              </T>
              <T m={16} lh={1.45} style={{ flex: 1 }}>
                {s.slice(2)}
              </T>
            </View>
          );
        }
        return (
          <T key={i} m={16} lh={1.45}>
            {s}
          </T>
        );
      })}
    </View>
  );
}

/** The main button label with the amount filled in ("Tovább a kártyához (19 999 Ft)"). */
export function engedelyGomb(c: CardConsentView | undefined | null): string {
  if (!c) return CARD_CONSENT_UI.buttonNoAmount;
  const b = c.button || (c.amountNowHuf ? CARD_CONSENT_UI.button : CARD_CONSENT_UI.buttonNoAmount);
  return b.replace('{osszeg}', szam(c.amountNowHuf));
}

/** The consent block: the text + the one checkbox (+ an optional line under it). */
export function KartyaEngedely({ c, be, valt, alatta }: { c: CardConsentView; be: boolean; valt: (b: boolean) => void; alatta?: ReactNode }) {
  return (
    <View>
      <EngedelySzoveg szoveg={c.text} />
      <Pipa be={be} valt={valt} style={{ marginTop: 10 }}>
        <T m={16} s={600} lh={1.45}>
          {c.checkbox || CARD_CONSENT_UI.checkbox}
        </T>
      </Pipa>
      {alatta}
    </View>
  );
}
