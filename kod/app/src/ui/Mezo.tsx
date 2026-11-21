// Beviteli mező – v2 (.mezo): 52 pt, r 14, fehér, 1,5 pt keret (a WCAG 1.4.11 miatt a #8A93A8 – lásd tokens.ts);
// fókuszban kék keret + 3 pt halvány kék gyűrű; hibánál piros keret. Opcionális szürke Fluent ikon a mező elején
// (e-mail: boríték, jelszó: lakat), a jelszónál szem-gomb (Mutasd / Elrejt).
import { forwardRef, useState } from 'react';
import { Pressable, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';
import { arnyek, betu, forma, szin } from '../theme/tokens';
import { Ikon, VezerloIkon, type EmojiNev } from '../_shared/v2/rn';
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
  /** Szürke Fluent ikon a mező elején (díszítés). */
  ikon?: EmojiNev;
}

export const Mezo = forwardRef<TextInputInstance, MezoProps>(function Mezo({ felirat, sugo, hiba, jelszo, jobbGomb, style, doboz, multiline, hol, holForras, holTema, ikon, ...p }, ref) {
  const [fokusz, setFokusz] = useState(false);
  const [mutat, setMutat] = useState(false);
  const jobb = jelszo ? { cim: mutat ? 'Elrejt' : 'Mutasd', onPress: () => setMutat((m) => !m) } : jobbGomb;
  return (
    <View style={style}>
      <T m={15} s={650} style={{ marginBottom: hol ? 2 : 6 }} nativeID={`felirat-${felirat}`}>
        {felirat}
      </T>
      {hol ? <HolTalalom kulcs={hol} forras={holForras} tema={holTema} /> : null}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            gap: 10,
            minHeight: 52,
            paddingHorizontal: 14,
            borderRadius: forma.mezo,
            borderWidth: 1.5,
            borderColor: hiba ? szin.veszely : fokusz ? szin.tintakek : szin.mezoKeret,
            backgroundColor: '#fff',
          },
          fokusz ? arnyek.mezoFokusz : null,
          doboz,
        ]}
      >
        {ikon ? <Ikon nev={ikon} pt={20} valtozat="szurke" style={{ opacity: 0.75, marginTop: multiline ? 15 : 0 }} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={felirat}
          accessibilityHint={sugo}
          placeholderTextColor={szin.halvany}
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
            { flex: 1, minWidth: 0, fontSize: 16.5, color: szin.tinta, paddingVertical: multiline ? 14 : 0, minHeight: multiline ? 96 : 48, textAlignVertical: multiline ? 'top' : 'center' },
            betu(400),
            // weben a fókuszkeretet a doboz adja
            { outlineStyle: 'none' } as object,
          ]}
        />
        {jelszo ? (
          <Pressable onPress={jobb!.onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={jobb!.cim} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -6 }}>
            <VezerloIkon nev="szem" pt={22} szin={mutat ? szin.tintakek : szin.halvany} />
          </Pressable>
        ) : jobb ? (
          <Pressable onPress={jobb.onPress} hitSlop={8} accessibilityRole="button">
            <T m={15} s={650} c={szin.tintakekSzoveg} alahuz>
              {jobb.cim}
            </T>
          </Pressable>
        ) : null}
      </View>
      {hiba ? (
        <T m={13.5} s={600} c={szin.veszely} lh={1.4} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
          {hiba}
        </T>
      ) : sugo ? (
        <T m={13.5} c={szin.halvany} lh={1.4} style={{ marginTop: 6 }}>
          {sugo}
        </T>
      ) : null}
    </View>
  );
});
