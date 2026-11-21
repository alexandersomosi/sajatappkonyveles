// A feltöltő sáv natív párja: behúzás (drag & drop) csak weben van (BehuzoSav.web.tsx); itt csak a keret és a gyerekek.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { HelyiFajl } from '../../lib/fajlok';
import { szin } from '../../theme/tokens';

export function fajlbolHelyi(_: unknown): HelyiFajl {
  throw new Error('csak weben');
}

export function BehuzoSav({ children, style }: { onFajlok: (f: HelyiFajl[]) => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderWidth: 2, borderStyle: 'dashed', borderColor: szin.feltoltoKeret, borderRadius: 18, backgroundColor: '#fff' }, style]}>{children}</View>;
}
