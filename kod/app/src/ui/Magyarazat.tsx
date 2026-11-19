// „Mi ez? / Miért kell? / Hol találod?” – magyarázó alsó lap minden bekötési tételhez (SPEC §26.8). A szöveg a
// szerverről jön (GET /client/explainers, az admin szerkesztheti); ha nem érhető el, a közös alapszöveg látszik.
// Nagy betű (17 pt, 1,5 sorköz), három kis kapitális címsor, a linkek a külső böngészőben nyílnak.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Explainer, Me } from '../_shared/api';
import { EXPLAINERS_28, fillPlaceholders, ONBOARDING_EXPLAINERS, WHERE_TO_FIND_EXPLAINERS, type ExplainerKey } from '../_shared/bekotes';
import { get } from '../api/http';
import { K } from '../api/hooks';
import { brand } from '../config';
import { szam } from '../lib/format';
import { szin } from '../theme/tokens';
import { Ikon3d, Targykep, type Ikon3dNev, type TargykepNev } from './kepek';
import { AlsoLap } from './keret';
import { T } from './T';

type Nyit = (kulcs: ExplainerKey | string, opt?: { forras?: string; tema?: string }) => void;
const Ctx = createContext<Nyit>(() => undefined);
export const useMagyarazat = () => useContext(Ctx);

/** Az alapszöveg kitöltve (offline / régebbi szerver). */
export function alapMagyarazat(kulcs: string, firstName: string): Explainer | null {
  const e = ONBOARDING_EXPLAINERS.find((x) => x.key === kulcs) ?? EXPLAINERS_28.find((x) => x.key === kulcs);
  if (!e) return null;
  const ert = { firstName, havidij: `${szam(brand.priceHufMonthlyGross)} Ft` };
  return { ...e, title: fillPlaceholders(e.title, ert), what: fillPlaceholders(e.what, ert), why: fillPlaceholders(e.why, ert), where: fillPlaceholders(e.where, ert), fields: [...e.fields] };
}

const URL_RE = /(https?:\/\/[^\s,;)]+[^\s,;.)])/g;
/** Szöveg, benne a https:// címek koppintható linkként (külső böngésző). */
function LinkesSzoveg({ s }: { s: string }) {
  const darabok = s.split(URL_RE);
  return (
    <T m={17} lh={1.5}>
      {darabok.map((d, i) =>
        /^https?:\/\//.test(d) ? (
          <T key={i} m={17} lh={1.5} s={550} c={szin.tintakekSzoveg} alahuz nyers accessibilityRole="link" onPress={() => void Linking.openURL(d)}>
            {d.replace(/^https:\/\//, '')}
          </T>
        ) : (
          d
        ),
      )}
    </T>
  );
}

/** Számozott sorok („1. …\n2. …”) listaként, a többi bekezdésként. */
function Blokk({ cim, szoveg }: { cim: string; szoveg: string }) {
  const sorok = szoveg.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <View style={{ marginTop: 18 }} accessible accessibilityLabel={`${cim} ${szoveg}`}>
      <T m={13} s={750} ls={0.08} c={szin.halvany} accessibilityRole="header" style={{ marginBottom: 4 }}>
        {cim.toLocaleUpperCase('hu-HU')}
      </T>
      {sorok.map((s, i) => {
        const m = /^(\d+)\.\s+(.*)$/.exec(s);
        if (!m) return <LinkesSzoveg key={i} s={s} />;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: i ? 6 : 2 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: szin.alap, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <T m={13} s={750} lh={1}>
                {m[1]}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <LinkesSzoveg s={m[2]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Lap({ kulcs, opt, bezar }: { kulcs: string | null; opt: { forras?: string; tema?: string }; bezar: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: K.magyarazatok, queryFn: () => get<{ items: Explainer[] }>('/client/explainers'), enabled: !!kulcs, staleTime: 5 * 60_000, retry: 0 });
  const fn = qc.getQueryData<Me>(K.me)?.accountant?.firstName ?? 'a könyvelőd';
  const e = kulcs ? (q.data?.items.find((x) => x.key === kulcs) ?? alapMagyarazat(kulcs, fn)) : null;
  return (
    <AlsoLap lathato={!!kulcs} bezar={bezar}>
      {e ? (
        <View style={{ paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 84, minHeight: 44 }}>
            <Ikon3d nev={e.icon as Ikon3dNev} pt={44} />
            <T m={22} s={700} lh={1.25} ls={-0.015} style={{ flex: 1 }} accessibilityRole="header">
              {e.title}
            </T>
          </View>
          {e.illustration ? <Targykep nev={e.illustration as TargykepNev} style={{ marginTop: 14 }} /> : null}
          <Blokk cim="Mi ez?" szoveg={e.what} />
          <Blokk cim="Miért kell?" szoveg={e.why} />
          <Blokk cim="Hol találod?" szoveg={e.where} />
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              bezar();
              router.push({ pathname: '/visszahivas', params: { forras: opt.forras ?? 'bekotes', tema: opt.tema ?? 'bekotes' } });
            }}
            style={{ marginTop: 22, paddingVertical: 8, alignSelf: 'flex-start' }}
          >
            <T m={16} s={550} c={szin.tintakekSzoveg} alahuz>
              Elakadtál? Kérj visszahívást
            </T>
          </Pressable>
        </View>
      ) : (
        <T m={16} lh={1.5} style={{ paddingRight: 80 }}>
          Ehhez most nincs leírásunk. Kérdezz bátran az Üzenetekben.
        </T>
      )}
    </AlsoLap>
  );
}

export function MagyarazatProvider({ children }: { children: ReactNode }) {
  const [kulcs, setKulcs] = useState<string | null>(null);
  const [opt, setOpt] = useState<{ forras?: string; tema?: string }>({});
  const nyit = useCallback<Nyit>((k, o) => {
    setOpt(o ?? {});
    setKulcs(k);
  }, []);
  const ertek = useMemo(() => nyit, [nyit]);
  return (
    <Ctx.Provider value={ertek}>
      {children}
      <Lap kulcs={kulcs} opt={opt} bezar={() => setKulcs(null)} />
    </Ctx.Provider>
  );
}

/** „Mi ez?” szöveges link (lépéskártya címe mellett). Legalább 44 pt-os koppintási felület. */
export function MiEz({ kulcs, cim = 'Mi ez?', forras, tema, style, sotet }: { kulcs: ExplainerKey | string; cim?: string; forras?: string; tema?: string; style?: StyleProp<ViewStyle>; sotet?: boolean }) {
  const nyit = useMagyarazat();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cim} Magyarázat megnyitása`}
      hitSlop={10}
      onPress={() => nyit(kulcs, { forras, tema })}
      style={({ pressed }) => [{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 2 }, pressed && { opacity: 0.6 }, style]}
    >
      <T m={15} s={600} c={sotet ? '#fff' : szin.tintakekSzoveg} alahuz numberOfLines={1}>
        {cim}
      </T>
    </Pressable>
  );
}

/** „Hol találom?” a mezőcím alatt – csak ha a válasz egy iraton áll (WHERE_TO_FIND_EXPLAINERS); minden más kérdésnél
 *  „Mi ez?” (SPEC §27.4.1/5, k3_kor2 walkthrough 16). */
export function HolTalalom({ kulcs, forras, tema }: { kulcs: ExplainerKey | string; forras?: string; tema?: string }) {
  const hol = (WHERE_TO_FIND_EXPLAINERS as readonly string[]).includes(kulcs);
  return <MiEz kulcs={kulcs} cim={hol ? 'Hol találom?' : 'Mi ez?'} forras={forras} tema={tema} style={{ alignSelf: 'flex-start', marginTop: -4, marginBottom: 4 }} />;
}

/** C (SPEC §28.K.10): a „Mi ez?” kis kerek „i”-ként – 26 pt látszik, 44 pt a koppintási felület. */
export function MiEzKor({ kulcs, cim = 'Mi ez?', forras, tema, style }: { kulcs: ExplainerKey | string; cim?: string; forras?: string; tema?: string; style?: StyleProp<ViewStyle> }) {
  const nyit = useMagyarazat();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cim} Magyarázat megnyitása`}
      hitSlop={9}
      onPress={() => nyit(kulcs, { forras, tema })}
      style={({ pressed }) => [{ width: 26, height: 26, borderRadius: 13, backgroundColor: szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }, pressed && { backgroundColor: szin.gombMNyomott }, style]}
    >
      <T m={15} s={750} lh={1} c={szin.tintakekSzoveg}>
        i
      </T>
    </Pressable>
  );
}
