// Beviteli mező: 12 pt-os sarok, halvány alap; fókuszban 2 pt-os tintakék keret fehér alapon (01 Jelszó mező).
import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';
import { betu, forma, szin } from '../theme/tokens';
import { HolTalalom } from './Magyarazat';
import { T } from './T';

export interface MezoProps extends TextInputProps {
  felirat: string;
  sugo?: string;
  hiba?: string | null;
  jelszo?: boolean;
  jobbGomb?: { cim: string; onPress: () => void };
  doboz?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** „Hol találom?” a mezőcím alatt (SPEC §26.8.3): a magyarázat kulcsa. */
  hol?: string;
  holForras?: string;
  holTema?: string;
}

export const Mezo = forwardRef<TextInputInstance, MezoProps>(function Mezo({ felirat, sugo, hiba, jelszo, jobbGomb, style, doboz, multiline, hol, holForras, holTema, ...p }, ref) {
  const [fokusz, setFokusz] = useState(false);
  const [mutat, setMutat] = useState(false);
  const jobb = jelszo ? { cim: mutat ? 'Elrejt' : 'Mutasd', onPress: () => setMutat((m) => !m) } : jobbGomb;
  return (
    <View style={style}>
      <T m={15} s={600} style={{ marginBottom: hol ? 2 : 7 }} nativeID={`felirat-${felirat}`}>
        {felirat}
      </T>
      {hol ? <HolTalalom kulcs={hol} forras={holForras} tema={holTema} /> : null}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            gap: 10,
            minHeight: 54,
            paddingHorizontal: fokusz ? 15 : 16,
            borderRadius: forma.mezo,
            borderWidth: fokusz ? 2 : 1,
            borderColor: hiba ? szin.veszely : fokusz ? szin.tintakek : szin.mezoKeret,
            backgroundColor: fokusz ? '#fff' : szin.mezoAlap,
          },
          doboz,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={felirat}
          accessibilityHint={sugo}
          placeholderTextColor="#8A93A6"
          secureTextEntry={jelszo && !mutat}
          multiline={multiline}
          maxFontSizeMultiplier={1.3}
          {...p}
          onFocus={(e) => {
            setFokusz(true);
            p.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFokusz(false);
            p.onBlur?.(e);
          }}
          style={[
            { flex: 1, minWidth: 0, fontSize: 17, color: szin.tinta, paddingVertical: multiline ? 14 : 0, minHeight: multiline ? 96 : 50, textAlignVertical: multiline ? 'top' : 'center' },
            betu(400),
            // weben a fókuszkeretet a doboz adja
            { outlineStyle: 'none' } as object,
          ]}
        />
        {jobb ? (
          <Pressable onPress={jobb.onPress} hitSlop={8} accessibilityRole="button">
            <T m={15} s={500} c={szin.tintakekSzoveg} alahuz>
              {jobb.cim}
            </T>
          </Pressable>
        ) : null}
      </View>
      {hiba ? (
        <T m={14} s={500} c={szin.veszely} lh={1.4} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
          {hiba}
        </T>
      ) : sugo ? (
        <T m={14} c={szin.halvany} lh={1.4} style={{ marginTop: 6 }}>
          {sugo}
        </T>
      ) : null}
    </View>
  );
});
