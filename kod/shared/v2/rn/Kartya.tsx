// Adózz.hu v2 – „Kártya”: minden szakasz külön, tiszta fehér kártya a szürke háttéren (r 20, finom árnyék).
// Nem pasztell doboz: a kiemelést telt színes bal sáv (`jelzo`) vagy színes ikon adja, nem halvány színes alap.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { arnyek, elrendezes, sugar, szin } from '../tokenek';

export interface KartyaOpciok {
  /** Gépes nézet: r 22, belső tér 22/24, csempe–szöveg köz 16. */
  asztali?: boolean;
  /** Vízszintes elrendezés (csempe + szöveg egy sorban, a minta `.k`-ja). Alap: függőleges (`.k.blokk`). */
  sor?: boolean;
  /** Listakártya (`.k.tomor`): kisebb függőleges belső tér, a sorok adják a magasságot. */
  tomor?: boolean;
  /** Alsó térköz a következő kártyáig (alap: igen, 12). Rácsban hamis. */
  margo?: boolean;
  /** 4 pt-es telt színes bal sáv (pl. `szin.narancs` figyelmeztetésnél) – a halvány pasztell doboz helyett. */
  jelzo?: string;
}

export function kartyaStilus({ asztali = false, sor = false, tomor = false, margo = true, jelzo }: KartyaOpciok = {}): ViewStyle {
  const k = elrendezes.kartya;
  return {
    backgroundColor: szin.kartya,
    borderRadius: asztali ? sugar.kartyaAsztali : sugar.kartya,
    paddingVertical: tomor ? k.tomorFugg : asztali ? k.asztaliFugg : k.fugg,
    paddingHorizontal: asztali ? k.asztaliVizsz : k.vizsz,
    marginBottom: margo ? k.koz : 0,
    boxShadow: arnyek.kartya.css,
    ...(sor ? { flexDirection: 'row', alignItems: 'flex-start', gap: asztali ? k.asztaliBelsoKoz : k.belsoKoz } : null),
    ...(jelzo ? { borderLeftWidth: 4, borderLeftColor: jelzo } : null),
  };
}

export interface KartyaProps extends KartyaOpciok, Omit<ViewProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Kartya({ asztali, sor, tomor, margo, jelzo, style, children, ...tobbi }: KartyaProps) {
  return (
    <View style={[kartyaStilus({ asztali, sor, tomor, margo, jelzo }), style]} {...tobbi}>
      {children}
    </View>
  );
}
