// Korlátozott mód a bekötés alatt (SPEC §26.5.3): soha nem csendben szürkített gomb. A zárolt képernyő és alsó lap:
// 3D lakat + a funkció tárgyképe, „… – hamarosan”, az ok, „Mi kell még?” (→ Főoldal) és „Kérdésed van? Kérj
// visszahívást.” Bármelyik hívás 403 'locked_until_active' válasza ugyanezt a lapot nyitja (védelem mélységben).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { ClientAccess, Me, OnboardingState, RequestSummary } from '../_shared/api';
import { CLIENT_FEATURES, LOCKED_ERROR_CODE, type ClientFeature } from '../_shared/enums';
import { ApiHiba, get } from '../api/http';
import { useAuth } from '../auth/AuthProvider';
import { K, useMe } from '../api/hooks';
import { funkcio, hozzaferesBol, zarva } from '../lib/hozzaferes';
import { maiNap } from '../lib/format';
import { utEpit } from '../lib/ut';
import { useQueryClient } from '@tanstack/react-query';
import { szin } from '../theme/tokens';
import { Fejlec, GombE, Lap } from './alap';
import { Ikon3d, Targykep, type TargykepNev } from './kepek';
import { AlsoLap, Betolt, Kepernyo } from './keret';
import { T } from './T';

/** Rövid cím a „… – hamarosan” fejlécbe (a szabálylista címkéje hosszú leírás). */
const ROVID: Partial<Record<ClientFeature, string>> = {
  fooldal_ado: 'Befizetendő adó',
  dosszie: 'Dosszié',
  feltoltes: 'Fotózás, feltöltés',
  nav_szamlak: 'Kiállított számlák',
  bevetel: 'Idei bevétel',
  hataridok: 'Határidők',
  igazolas_keres: 'Igazolás kérése',
};
const TARGY: Partial<Record<ClientFeature, TargykepNev>> = { dosszie: 'dosszie_mappa', hataridok: 'hatarido_naptar', nav_szamlak: 'dosszie_mappa', feltoltes: 'dosszie_mappa' };

export function useHozzaferes() {
  const me = useMe();
  const a: ClientAccess = hozzaferesBol(me.data);
  return {
    betolt: me.isLoading,
    a,
    korlatozott: a.mode === 'korlatozott',
    zarva: (f: ClientFeature, vanNyitottKeres = false) => zarva(a, f, vanNyitottKeres),
    ok: (f: ClientFeature) => funkcio(a, f).reason,
  };
}

type Zar = { feature: ClientFeature; reason?: string | null };
const Ctx = createContext<(z: Zar) => void>(() => undefined);
export const useZarolt = () => useContext(Ctx);

// A QueryClient a Reacton kívül jön létre: a 403-at egy kis eseménycsatornán adja át a lapnak.
const figyelok = new Set<(z: Zar) => void>();
let utolso = { kulcs: '', ido: 0 };
/** QueryCache / MutationCache onError-ból hívva: 403 'locked_until_active' → zárolt lap (10 mp-en belül egyszer). */
export function zaroltHibabol(e: unknown) {
  if (!(e instanceof ApiHiba) || e.status !== 403 || e.code !== LOCKED_ERROR_CODE) return;
  const f = (e.data?.feature as ClientFeature | undefined) ?? (e as unknown as { feature?: ClientFeature }).feature;
  const feature = f && (CLIENT_FEATURES as readonly string[]).includes(f) ? f : 'dosszie';
  if (utolso.kulcs === feature && Date.now() - utolso.ido < 10_000) return;
  utolso = { kulcs: feature, ido: Date.now() };
  figyelok.forEach((x) => x({ feature, reason: e.message }));
}

/** S24: „Még {remaining} lépés, és minden megnyílik. Ebből {n} a tiéd.” – ugyanabból a listából, mint a sáv és a jelvény. */
function useZartLapSzoveg(a: ClientAccess): string | null {
  const qc = useQueryClient();
  const ob = qc.getQueryData<OnboardingState>(K.onboarding);
  if (a.mode !== 'korlatozott') return null;
  if (!ob) return a.activationHint;
  if (ob.journey) return ob.journey.lockedSheetText;
  const ker = qc.getQueryData<{ items: RequestSummary[] }>(K.keresek)?.items ?? [];
  const keresekDb = ker.filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')).length;
  return utEpit({ o: ob, keresekDb, ma: maiNap() }).lockedSheetText;
}

function Tartalom({ z, a, bezar, keretben }: { z: Zar; a: ClientAccess; bezar?: () => void; keretben?: boolean }) {
  const f = funkcio(a, z.feature);
  const hint = useZartLapSzoveg(a);
  const ok = z.reason || f.reason || 'A bekötés után nyílik meg.';
  const targy = TARGY[z.feature];
  return (
    <View style={{ alignItems: keretben ? 'center' : 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, alignSelf: keretben ? 'center' : 'flex-start' }}>
        {targy && keretben ? <Targykep nev={targy} style={{ width: 160 }} /> : null}
        <Ikon3d nev="lakat" pt={56} style={targy && keretben ? { marginLeft: -40, marginBottom: 6 } : undefined} label="Zárolva" />
      </View>
      <T m={22} s={700} lh={1.25} ls={-0.015} kozep={keretben} style={{ marginTop: 12 }} accessibilityRole="header">
        {ROVID[z.feature] ?? f.label} – hamarosan
      </T>
      <T m={17} lh={1.5} c={szin.halvany} kozep={keretben} style={{ marginTop: 6 }}>
        {ok}
      </T>
      {hint ? (
        <T m={15.5} s={600} lh={1.45} kozep={keretben} style={{ marginTop: 8 }}>
          {hint}
        </T>
      ) : null}
      <GombE
        cim="Mi kell még?"
        style={{ marginTop: 18, alignSelf: 'stretch' }}
        onPress={() => {
          bezar?.();
          router.navigate({ pathname: '/bekotes', params: { kovetkezo: '1' } });
        }}
      />
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          bezar?.();
          router.push({ pathname: '/visszahivas', params: { forras: 'zarolt_funkcio', tema: 'bekotes' } });
        }}
        style={{ paddingVertical: 12, alignSelf: keretben ? 'center' : 'flex-start', marginTop: 4 }}
      >
        <T m={16} s={550} c={szin.tintakekSzoveg} alahuz>
          Kérdésed van? Kérj visszahívást.
        </T>
      </Pressable>
    </View>
  );
}

/** Zárolt képernyő-tartalom (fehér lap az alapon), pl. a Dosszié fülön a bekötés alatt. */
export function ZaroltKepernyo({ feature }: { feature: ClientFeature }) {
  const h = useHozzaferes();
  return (
    <Lap style={{ paddingTop: 24, paddingHorizontal: 20, paddingBottom: 12 }}>
      <Tartalom z={{ feature }} a={h.a} keretben />
    </Lap>
  );
}

export function ZaroltProvider({ children }: { children: ReactNode }) {
  const [z, setZ] = useState<Zar | null>(null);
  // Belépés után maga is lekéri (hidegindításnál is legyen „Még N lépés…” a lapon); belépés előtt nem kérdez.
  const bent = useAuth().allapot === 'bent';
  const me = useQuery<Me>({ queryKey: K.me, queryFn: () => get<Me>('/me'), enabled: bent, staleTime: 60_000 });
  const a = hozzaferesBol(me.data);
  const mutat = useCallback((x: Zar) => setZ(x), []);
  useEffect(() => {
    figyelok.add(mutat);
    return () => {
      figyelok.delete(mutat);
    };
  }, [mutat]);
  const ertek = useMemo(() => mutat, [mutat]);
  return (
    <Ctx.Provider value={ertek}>
      {children}
      <AlsoLap lathato={!!z} bezar={() => setZ(null)}>
        {z ? (
          <Tartalom z={z} a={a} bezar={() => setZ(null)} />
        ) : null}
      </AlsoLap>
    </Ctx.Provider>
  );
}

/** Kapu egy képernyő elé: bekötés alatt, ha a funkció zárva, a zárolt képernyőt mutatja (és a képernyő kérései
 *  el sem indulnak); különben a képernyőt. A fülsor ilyenkor is látszik. */
export function ZaroltKapu({ feature, ful, cim, vanKeres = false, children }: { feature: ClientFeature; ful: string; cim: string; vanKeres?: boolean; children: ReactNode }) {
  const h = useHozzaferes();
  if (h.betolt) return <Kepernyo ful={ful}><Betolt /></Kepernyo>;
  if (!h.zarva(feature, vanKeres)) return <>{children}</>;
  return (
    <Kepernyo
      ful={ful}
      fejlec={
        <Fejlec alsoTer={24}>
          <T m={27} s={800} lh={1.14} ls={-0.025} c="#fff" style={{ paddingTop: 12, paddingHorizontal: 18 }} accessibilityRole="header">
            {cim}
          </T>
          <T m={15.5} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 6, paddingHorizontal: 18 }}>
            A bekötés után nyílik meg.
          </T>
        </Fejlec>
      }
    >
      <ZaroltKepernyo feature={feature} />
    </Kepernyo>
  );
}
