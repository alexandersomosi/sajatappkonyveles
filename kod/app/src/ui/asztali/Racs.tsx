// k8 gépes nézet: 2 oszlopos kártyarács (minta: dizajn/C5_v2/asztali/A01, A80). Telefonon egy oszlop (változatlan: a
// gyerekek egymás alatt). Gépen a gyerekek páronként egy sorba kerülnek (flexbox – az RN-stílusban nincs CSS grid), a pár
// két kártyája egyforma magas; a `Szeles` mindkét oszlopot foglalja. Köz: 22 pt.
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { elrendezes } from '../../_shared/v2/tokenek';
import { useAsztali } from '../../lib/elrendezes';
import { RacsCellaCtx } from '../alap';
import { kartyasit } from '../keret';

const KOZ = elrendezes.asztali.racsKoz;

/** A rács egy teljes szélességű eleme. */
export function Szeles({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function kibont(children: ReactNode): ReactNode[] {
  const ki: ReactNode[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Fragment) ki.push(...kibont((c.props as { children?: ReactNode }).children));
    else if (c !== null && c !== undefined && c !== false && c !== '') ki.push(c);
  });
  return ki;
}

export function Racs({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const asztali = useAsztali();
  // a régi szakaszos tartalom (ikonos Szakasz + Lap) előbb egy-egy kártyává áll össze, utána kerül a rácsba
  const kartyak = kartyasit(children);
  if (!asztali) return <>{kartyak}</>;
  const elemek = kibont(kartyak);
  const sorok: ReactNode[][] = [];
  let par: ReactNode[] = [];
  for (const e of elemek) {
    if (isValidElement(e) && (e as ReactElement).type === Szeles) {
      if (par.length) sorok.push(par);
      sorok.push([e]);
      par = [];
      continue;
    }
    par.push(e);
    if (par.length === 2) {
      sorok.push(par);
      par = [];
    }
  }
  if (par.length) sorok.push(par);
  return (
    <View style={[{ gap: KOZ, marginBottom: KOZ }, style]}>
      {sorok.map((sor, i) =>
        sor.length === 1 && isValidElement(sor[0]) && (sor[0] as ReactElement).type === Szeles ? (
          <RacsCellaCtx.Provider key={i} value>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, minWidth: 0 }}>{sor[0]}</View>
            </View>
          </RacsCellaCtx.Provider>
        ) : (
          <View key={i} style={{ flexDirection: 'row', gap: KOZ, alignItems: 'stretch' }}>
            {sor.map((c, j) => (
              <RacsCellaCtx.Provider key={j} value>
                <View style={{ flex: 1, minWidth: 0 }}>{c}</View>
              </RacsCellaCtx.Provider>
            ))}
            {sor.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ),
      )}
    </View>
  );
}

Racs.Szeles = Szeles;

/** Két független oszlop (minta: A80 Fiók): gépen egymás mellett, telefonon egymás alatt (előbb a bal, aztán a jobb). */
export function KetOszlop({ bal, jobb, aranyBal = 1, aranyJobb = 1 }: { bal: ReactNode; jobb: ReactNode; aranyBal?: number; aranyJobb?: number }) {
  const asztali = useAsztali();
  if (!asztali) return <>{kartyasit(<>{bal}{jobb}</>)}</>;
  return (
    <View style={{ flexDirection: 'row', gap: KOZ, alignItems: 'flex-start' }}>
      <View style={{ flex: aranyBal, minWidth: 0 }}>{kartyasit(bal)}</View>
      <View style={{ flex: aranyJobb, minWidth: 0 }}>{kartyasit(jobb)}</View>
    </View>
  );
}
