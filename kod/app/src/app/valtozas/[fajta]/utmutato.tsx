// SPEC §28.5.3 – „Így jelented be…”: a változás-útmutató lépésenként (?lepes=N), a valódi, elmosott NAV-képernyőképekkel
// (nagyítható nézővel) vagy az őszinte „Rajzolt vázlat” jelöléssel; ugyanaz az útmutató-test, mint a bejelentésé.
// Minden lépésen ott a kiemelt „Nem boldogulsz vele? Intézzük helyetted” (díjas, előre fizetve) és a visszahívás.
import { router, useLocalSearchParams } from 'expo-router';
import type { Guide } from '@/_shared/api';
import { CHANGE_TEXTS } from '@/_shared/bekotes';
import type { ChangeKind } from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useMe, useUtmutato, useUtmutatoHaladas, useUtmutatoKepek } from '@/api/hooks';
import { maiNap } from '@/lib/format';
import { valtozasFajta, valtozasUtmutatoEpit } from '@/lib/utmutato';
import { SavCim, useHaladas, useLepesParam, UtmutatoLepesenkent, UtmutatoTorzs } from '@/kepernyok/Utmutato';
import { Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { Elakadtal } from '@/ui/Visszahivas';

export default function ValtozasUtmutato() {
  const p = useLocalSearchParams<{ fajta: string; egyben?: string }>();
  const kind = (valtozasFajta(p.fajta) ? p.fajta : 'valtozas_szekhely') as ChangeKind;
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const q = useUtmutato(kind);
  const kepek = useUtmutatoKepek(kind);
  const haladasMent = useUtmutatoHaladas(kind);
  // régebbi szerver (még nincs változás-útmutató): ugyanabból a megosztott sablonból itt épül fel
  const nincsVegpont = q.error instanceof ApiHiba && (q.error.status === 404 || q.error.code === 'not_found');
  const g: Guide | undefined = q.data ?? (nincsVegpont ? valtozasUtmutatoEpit(kind, { change: null, firstName: fn, kesz: [], ma: maiNap() }) : undefined);
  const h = useHaladas(kind, g, (k) => haladasMent.mutateAsync(k));
  const lp = useLepesParam(g?.steps.length ?? 0);
  const fej = (
    <SavCim
      vissza={() => (p.egyben !== '1' && lp.lepes > 0 ? lp.ugrik(lp.lepes - 1) : vissza(`/valtozas/${kind}`))}
      visszaCim="Vissza"
      cim={g?.title ?? CHANGE_TEXTS.sorok[kind].title}
      al={`Kb. ${kind === 'valtozas_adoadat' ? 15 : 10} perc, ingyenes. Te küldöd be a saját belépéseddel.`}
    />
  );
  if (!g) {
    return (
      <Kepernyo ful="fiok" fejlec={fej}>
        {q.isLoading ? <Betolt /> : <Hiba hiba={q.error} ujra={() => void q.refetch()} />}
        <Elakadtal forras="valtozas_utmutato" tema="valtozas" />
      </Kepernyo>
    );
  }
  if (g.outdated) {
    return (
      <Kepernyo ful="fiok" fejlec={fej}>
        <T m={16} lh={1.5}>
          {g.outdatedText ?? CHANGE_TEXTS.outdated}
        </T>
        <Elakadtal forras="valtozas_utmutato" tema="valtozas" />
      </Kepernyo>
    );
  }
  const segitseg = () => router.push(`/valtozas/${kind}/kerem`);
  if (p.egyben === '1') {
    return (
      <Kepernyo ful="fiok" fejlec={fej}>
        <UtmutatoTorzs g={g} kepek={kepek.data} valaszok={{}} kesz={h.kesz} valt={h.valt} fn={fn} />
        <Elakadtal forras="valtozas_utmutato" tema="valtozas" />
      </Kepernyo>
    );
  }
  return (
    <Kepernyo ful="fiok" gorgetoRef={lp.gorgeto} fejlec={fej}>
      <UtmutatoLepesenkent
        g={g}
        kepek={kepek.data}
        valaszok={{}}
        kesz={h.kesz}
        valt={h.valt}
        fn={fn}
        lepes={lp.lepes}
        ugrik={lp.ugrik}
        vege={{ cim: 'Feltöltöm az értesítést', onPress: () => router.push({ pathname: '/feltoltes', params: { kategoria: 'nav_visszaigazolas' } }) }}
        segitseg={segitseg}
        segitsegFajta="valtozas"
        egyben={() => router.setParams({ egyben: '1' })}
      />
    </Kepernyo>
  );
}
