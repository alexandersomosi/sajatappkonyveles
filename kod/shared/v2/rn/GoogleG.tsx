// Adózz.hu v2 – a színes Google „G” (a „Belépés Google-lel” gombhoz). Díszítés: a gomb felirata mondja ki.
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GOOGLE_G } from '../ikon/material';
import { a11yKep } from './a11y';
import { SvgRajz } from './Ikon';

function GoogleGAlap({ pt = 20, label, style }: { pt?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: pt, height: pt }, style]} {...a11yKep(label)}>
      <SvgRajz adat={GOOGLE_G} pt={pt} />
    </View>
  );
}

export const GoogleG = memo(GoogleGAlap);
