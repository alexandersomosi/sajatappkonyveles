// „Intézzük helyetted” közös elemei (SPEC §27.3.2, §27.3.7): a számozott „így megy” lista és a „soha nem kérjük el a
// belépésedet” doboz – a kérés képernyőjén, a jóváhagyás-útmutatóban és a meghatalmazás lépésén ugyanaz.
import { View } from 'react-native';
import { router } from 'expo-router';
import type { AssistView } from '../_shared/api';
import { useSegitsegJovahagytam } from '../api/hooks';
import { hibaUzenet } from '../lib/hiba';
import { GombE, GombM, GombSz } from './alap';
import { useJelzes } from './keret';
import { ASSIST_STEP_LIST, ASSIST_TEXTS, CHANGE_STEP_LIST, fillPlaceholders } from '../_shared/bekotes';
import { JOURNEY_ACTOR_LABELS, type AssistKind } from '../_shared/enums';
import { forma, szin } from '../theme/tokens';
import { Lap } from './alap';
import { Ikon3d } from './kepek';
import { szam } from '../lib/format';
import { T } from './T';
import { SzereploCimke } from './Ut';

/** A számozott „így megy” lista: ki lép (Te / Bence / Csapatunk / NAV), mit, mennyi idő alatt. */
export function IgyMegy({ fajta, fn, dij }: { fajta: AssistKind; fn: string; /** Változásnál az előre fizetendő díj (Ft; 0 = nincs díj-sor). */ dij?: number }) {
  // SPEC §28.5.5 + §28.K.1: a változások listája a díj-sorral (csak ha van díj)
  const lista: readonly { actor: 'te' | 'konyvelo' | 'csapat' | 'nav'; text: string; time: string }[] =
    fajta === 'vallalkozas_bejelentes' || fajta === 'meghatalmazas' ? ASSIST_STEP_LIST[fajta] : CHANGE_STEP_LIST.filter((l) => !l.onlyWithFee || (dij ?? 0) > 0);
  return (
    <Lap style={{ paddingVertical: 6 }}>
      {lista.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: l.actor === 'te' ? szin.tintakek : szin.alap, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <T m={13.5} s={750} lh={1} c={l.actor === 'te' ? '#fff' : szin.tinta} szam>
              {i + 1}
            </T>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <SzereploCimke cim={fillPlaceholders(JOURNEY_ACTOR_LABELS[l.actor], { firstName: fn })} te={l.actor === 'te'} />
            <T m={16} lh={1.45}>
              {fillPlaceholders(l.text, { firstName: fn, dij: szam(dij ?? 0) })}
            </T>
            <T m={14} lh={1.4} c={szin.halvany}>
              {l.time}
            </T>
          </View>
        </View>
      ))}
    </Lap>
  );
}

/** „Soha nem kérjük el…” – 3D lakat + a szöveg (SPEC §27.3.7, ugyanazokkal a szavakkal mindenhol). */
export function SohaBelepes({ fn, style }: { fn: string; style?: object }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: forma.mezo, backgroundColor: szin.nyomott, padding: 14 }, style]}>
      <Ikon3d nev="lakat" pt={36} />
      <T m={15.5} s={550} lh={1.5} style={{ flex: 1 }}>
        {fillPlaceholders(ASSIST_TEXTS.neverCredentials, { firstName: fn })}
      </T>
    </View>
  );
}


/** A jóváhagyás kártyája (S16): határidő, „Megnyitom az útmutatót”, „Jóváhagytam”. */
export function JovahagyasKartya({ a, fn }: { a: AssistView; fn: string }) {
  const jovahagy = useSegitsegJovahagytam();
  const jelez = useJelzes();
  const lejart = a.status === 'meghatalmazas_lejart';
  const ap = a.approval;
  const jovahagytam = async () => {
    try {
      await jovahagy.mutateAsync(a.id);
      jelez({ szoveg: fillPlaceholders(ASSIST_TEXTS.approvedToast, { firstName: fn }), kesz: true });
      router.navigate('/bekotes');
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };
  if (lejart) {
    return (
      <Lap style={{ padding: 18, marginTop: 12 }}>
        <T m={19} s={700} lh={1.3} accessibilityRole="header">
          {ASSIST_TEXTS.expiredTitle}
        </T>
        <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
          {fillPlaceholders(ASSIST_TEXTS.expiredBody, { firstName: fn })}
        </T>
        <GombSz cim={`Már jóváhagytam (${ASSIST_TEXTS.approvedButton})`} onPress={() => void jovahagytam()} style={{ marginTop: 6 }} />
      </Lap>
    );
  }
  return (
    <Lap style={{ padding: 18, marginTop: 12 }}>
      <T m={19} s={700} lh={1.3} accessibilityRole="header">
        {ASSIST_TEXTS.approveTitle}
      </T>
      {ap ? (
        ap.lastDay ? (
          <View style={{ marginTop: 8, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 12 }}>
            <T m={16} s={650} lh={1.45} c={szin.borostyanSzoveg}>
              {ap.afterDue ? ASSIST_TEXTS.approveAfterDue : ASSIST_TEXTS.approveLastDay}
            </T>
          </View>
        ) : (
          <T m={16} s={600} lh={1.5} style={{ marginTop: 6 }}>
            {fillPlaceholders(ASSIST_TEXTS.approveSub, { hatarido: ap.dueText, days: String(ap.daysLeft) })}
          </T>
        )
      ) : null}
      <GombE cim={ASSIST_TEXTS.approveGuideButton} onPress={() => router.push('/bekotes/meghatalmazas/jovahagyas')} style={{ marginTop: 14 }} />
      <GombM cim={ASSIST_TEXTS.approvedButton} tolt={jovahagy.isPending} onPress={() => void jovahagytam()} style={{ marginTop: 10 }} />
    </Lap>
  );
}


/** „Jóváhagytam” világos kapszula (a Főoldal „Most ez jön” kártyáján, S16). */
export function JovahagytamGomb({ a, fn }: { a: AssistView; fn: string }) {
  const jovahagy = useSegitsegJovahagytam();
  const jelez = useJelzes();
  return (
    <GombM
      cim={ASSIST_TEXTS.approvedButton}
      tolt={jovahagy.isPending}
      style={{ marginTop: 10 }}
      onPress={async () => {
        try {
          await jovahagy.mutateAsync(a.id);
          jelez({ szoveg: fillPlaceholders(ASSIST_TEXTS.approvedToast, { firstName: fn }), kesz: true });
        } catch (e) {
          jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
        }
      }}
    />
  );
}
