// S16 – „Így hagyd jóvá a meghatalmazást” (SPEC §27.3.6): a könyvelőnk beküldte az UJEGYKE-t meghatalmazottként, az
// ügyfél a SAJÁT belépésével jóváhagyja az ONYA-ban. 6 lépés, lépésenként; felül a határidő („november 22-ig, még 3
// nap” / „Ma van az utolsó nap”), videó nincs; az utolsó lépés gombja „Jóváhagytam” (POST /client/assist/:id/approved).
import { router } from 'expo-router';
import { View } from 'react-native';
import type { Guide } from '@/_shared/api';
import { ASSIST_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { ApiHiba } from '@/api/http';
import { useSegitsegJovahagytam, useUtmutato, useUtmutatoHaladas, useUtmutatoKepek } from '@/api/hooks';
import { maiNap } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { segitsegFajta } from '@/lib/ut';
import { utmutatoEpit } from '@/lib/utmutato';
import { SavCim, useHaladas, useLepesParam, UtmutatoLepesenkent, UtmutatoTorzs } from '@/kepernyok/Utmutato';
import { useLocalSearchParams } from 'expo-router';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap } from '@/ui/alap';
import { SohaBelepes } from '@/ui/Helyettunk';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { useUt } from '@/ui/Ut';
import { Elakadtal } from '@/ui/Visszahivas';
import { bekotesre } from '@/lib/vezetett';

export default function JovahagyasUtmutato() {
  const { o } = useUt();
  const p = useLocalSearchParams<{ egyben?: string }>();
  const d = o.data;
  const a = d ? (segitsegFajta(d.assists, 'vallalkozas_bejelentes') ?? segitsegFajta(d.assists, 'meghatalmazas')) : null;
  const var_ = !!a && ['meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva'].includes(a.status);
  const q = useUtmutato('meghatalmazas_jovahagyas', !!d);
  const kepek = useUtmutatoKepek('meghatalmazas_jovahagyas');
  const haladasMent = useUtmutatoHaladas('meghatalmazas_jovahagyas');
  const jovahagy = useSegitsegJovahagytam();
  const jelez = useJelzes();
  const fn = d?.accountant.firstName ?? 'a könyvelőd';
  // §27 nélküli szerver: ugyanabból a sablonból itt építjük fel, a kérés határidejével.
  const nincsVegpont = q.error instanceof ApiHiba && (q.error.status === 404 || q.error.code === 'validation_failed');
  const g: Guide | undefined =
    q.data ??
    (nincsVegpont && d && var_
      ? utmutatoEpit('meghatalmazas_jovahagyas', {
          answers: null,
          nev: '',
          lakcim: null,
          konyvelo: { nev: d.accountant.displayName, firstName: fn, adoazonosito: null, nyilvantartasiSzam: d.accountant.registrationNumber },
          ugykorok: [],
          kesz: [],
          ma: maiNap(),
          jovahagyas: a?.approval ? { dueOn: a.approval.dueOn, dueText: a.approval.dueText, daysLeft: a.approval.daysLeft, lastDay: a.approval.lastDay } : null,
        })
      : undefined);
  const h = useHaladas('meghatalmazas_jovahagyas', g, (k) => haladasMent.mutateAsync(k));
  const lp = useLepesParam(g?.steps.length ?? 0);
  const fej = (
    <SavCim
      vissza={() => (lp.lepes > 0 && p.egyben !== '1' ? lp.ugrik(lp.lepes - 1) : vissza('/bekotes'))}
      visszaCim={lp.lepes > 0 && p.egyben !== '1' ? 'Vissza' : 'Vissza a Főoldalra'}
      cim={g?.title ?? 'Így hagyd jóvá a meghatalmazást'}
      al="Az ONYA-ban, a saját belépéseddel."
    />
  );
  const jovahagytam = async () => {
    if (!a) return;
    try {
      await jovahagy.mutateAsync(a.id);
      jelez({ szoveg: fillPlaceholders(ASSIST_TEXTS.approvedToast, { firstName: fn }), kesz: true });
      bekotesre();
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };

  if (!d || (q.isLoading && !g)) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;
  if ((q.error instanceof ApiHiba && q.error.code === 'step_locked') || (!q.data && !var_)) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <Lap style={{ padding: 18 }}>
          <T m={17} lh={1.5}>
            {`Most nincs mit jóváhagynod. Ha ${fn} beküldte a meghatalmazást, értesítünk, és itt megmutatjuk, hogyan hagyd jóvá.`}
          </T>
          <GombM cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 14 }} />
        </Lap>
        <Elakadtal forras="meghatalmazas_utmutato" tema="meghatalmazas" style={{ marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  if (!g) return <Kepernyo ful="fooldal" fejlec={fej}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;

  const due = g.approvalDue ?? (a?.approval ? { dueOn: a.approval.dueOn, dueText: a.approval.dueText, daysLeft: a.approval.daysLeft, lastDay: a.approval.lastDay, afterDue: a.approval.afterDue } : null);
  const hataridoSav = due ? (
    <View style={{ marginBottom: 12, borderRadius: forma.lap, backgroundColor: szin.lap, padding: 14, borderWidth: due.lastDay ? 0 : 2, borderColor: szin.tintakek, borderLeftWidth: 4, borderLeftColor: due.lastDay ? szin.narancs : szin.tintakek }}>
      <T m={16.5} s={700} lh={1.4} c={due.lastDay ? szin.borostyanSzoveg : szin.tinta}>
        {due.lastDay ? ('afterDue' in due && due.afterDue ? ASSIST_TEXTS.approveAfterDue : ASSIST_TEXTS.approveLastDay) : fillPlaceholders(ASSIST_TEXTS.approveSub, { hatarido: due.dueText, days: String(due.daysLeft) })}
      </T>
    </View>
  ) : null;

  if (p.egyben === '1') {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        {hataridoSav}
        <UtmutatoTorzs g={g} kepek={kepek.data} valaszok={{}} kesz={h.kesz} valt={h.valt} fn={fn} />
        <GombE cim={ASSIST_TEXTS.approvedButton} tolt={jovahagy.isPending} onPress={() => void jovahagytam()} style={{ marginTop: 16 }} />
        <GombSz cim="Lépésenként mutasd" onPress={() => router.setParams({ egyben: undefined, lepes: '0' })} style={{ marginLeft: 4 }} />
        <Elakadtal forras="meghatalmazas_utmutato" tema="meghatalmazas" style={{ marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  return (
    <Kepernyo ful="fooldal" gorgetoRef={lp.gorgeto} fejlec={fej}>
      <UtmutatoLepesenkent
        g={g}
        kepek={kepek.data}
        valaszok={{}}
        kesz={h.kesz}
        valt={h.valt}
        fn={fn}
        lepes={lp.lepes}
        ugrik={lp.ugrik}
        vege={{ cim: ASSIST_TEXTS.approvedButton, onPress: () => void jovahagytam(), tolt: jovahagy.isPending }}
        egyben={() => router.setParams({ egyben: '1' })}
        elotte={hataridoSav}
        utana={<SohaBelepes fn={fn} style={{ marginTop: 12 }} />}
      />
    </Kepernyo>
  );
}
