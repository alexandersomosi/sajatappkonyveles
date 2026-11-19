// S12 – Kamarai regisztráció (SPEC §27.4.4): a bejelentés után 5 munkanap. Határidő, mi ez, „Megnyitom a kamara
// oldalát” (külső), „Megcsináltam” (pipa; „Mégsem csináltam meg” visszavonja). Nem kell az aktiváláshoz, de a teendők
// között számol, amíg nyitva van; emlékeztetőt a szerver küld.
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { KAMARA_TEXTS, KAMARA_URL, fillPlaceholders } from '@/_shared/bekotes';
import { useKamara } from '@/api/hooks';
import { datumIg, maiNap } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { munkanapotHozzaad } from '@/lib/ut';
import { SavCim } from '@/kepernyok/Utmutato';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap } from '@/ui/alap';
import { Ikon3d, KeszJel } from '@/ui/kepek';
import { Betolt, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { T } from '@/ui/T';
import { useUt } from '@/ui/Ut';
import { Elakadtal } from '@/ui/Visszahivas';

export default function Kamara() {
  const { reg } = useUt();
  const kamara = useKamara();
  const jelez = useJelzes();
  const r = reg.data?.registration ?? null;
  const ma = maiNap();
  // Régebbi szerver (nincs `chamber`): a bejelentés napja + 5 munkanap.
  const alapNap = r?.registeredOn ?? r?.filed?.filedOn ?? null;
  const due = r?.chamber?.dueOn ?? (alapNap ? munkanapotHozzaad(alapNap, 5) : null);
  const kesz = !!r?.chamber?.doneAt;
  const lejart = !!due && due < ma && !kesz;
  const fej = <SavCim vissza={() => vissza('/bekotes')} visszaCim="Vissza a Főoldalra" cim={KAMARA_TEXTS.title} al={due ? fillPlaceholders(KAMARA_TEXTS.sub, { hatarido: datumIg(due).replace(/^./, (c) => c.toLocaleUpperCase('hu-HU')) }) : 'Kb. 10 perc a kamara oldalán.'} />;
  if (reg.isLoading) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;
  const allit = async (done: boolean) => {
    try {
      await kamara.mutateAsync({ done });
      if (done)
        jelez({ szoveg: KAMARA_TEXTS.doneToast, kesz: true, gomb: { cim: KAMARA_TEXTS.undo, onPress: () => void kamara.mutateAsync({ done: false }).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'))) } });
      else jelez('Rendben, visszaállítottuk.');
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };
  return (
    <Kepernyo ful="fooldal" fejlec={fej}>
      <Lap style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {kesz ? <KeszJel pt={44} /> : <Ikon3d nev="tepnaptar" pt={44} />}
          <T m={18} s={700} lh={1.3} style={{ flex: 1 }}>
            {kesz ? 'Kipipáltad: regisztráltál a kamaránál.' : 'Egyszer kell, a bejelentés után'}
          </T>
          <MiEz kulcs="kamarai_regisztracio" />
        </View>
        {lejart ? (
          <View style={{ marginTop: 12, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 12 }}>
            <T m={15.5} s={650} lh={1.45} c={szin.borostyanSzoveg}>
              {fillPlaceholders(KAMARA_TEXTS.overdue, { date: datumIg(due!).replace(/-ig$/, '.') })}
            </T>
          </View>
        ) : null}
        <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 10 }}>
          {KAMARA_TEXTS.body}
        </T>
        {kesz ? (
          <GombSz cim={KAMARA_TEXTS.undo} onPress={() => void allit(false)} style={{ marginTop: 8 }} />
        ) : (
          <>
            <GombE cim={KAMARA_TEXTS.openButton} onPress={() => void Linking.openURL(KAMARA_URL)} style={{ marginTop: 16 }} />
            <GombM cim={KAMARA_TEXTS.doneButton} tolt={kamara.isPending} onPress={() => void allit(true)} style={{ marginTop: 10 }} />
          </>
        )}
      </Lap>
      <GombSz cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 6, marginLeft: 4 }} />
      <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginLeft: 4 }} />
    </Kepernyo>
  );
}
