// SPEC §28.3.5 – „Adókedvezményeid”: a kék sávban az idei hatás (vagy hogy Bence átnézi), alatta egy sor kedvezményenként:
// név, egy mondat, és az állapot (átnézi / kérdezett / jár / nem jár). „Valami változott – módosítom” → a kérdőív.
import { router } from 'expo-router';
import { View } from 'react-native';
import { ALLOWANCE_TEXTS as A, fillPlaceholders } from '@/_shared/bekotes';
import { useKedvezmenyek, useMe } from '@/api/hooks';
import { maiNap, szam } from '@/lib/format';
import { SavFej } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { GombE, GombM, Lap, Szakasz } from '@/ui/alap';
import { Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { T } from '@/ui/T';

export default function Kedvezmenyek() {
  const ev = Number(maiNap().slice(0, 4));
  const q = useKedvezmenyek(ev);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const v = q.data;
  const jovahagyott = v?.items.some((i) => i.status === 'jovahagyva');
  const mondat = !v
    ? null
    : v.notForRegime
      ? A.kata
      : jovahagyott && v.savedYtdHuf != null
        ? fillPlaceholders(A.allapot.subSaved, { savedYtd: szam(v.savedYtdHuf) })
        : v.pendingCount
          ? fillPlaceholders(A.allapot.subPending, { firstName: fn })
          : A.allapot.subNone;
  const ures = !!v && !v.items.length && !v.notForRegime;
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<SavFej vissza={() => vissza('/fiok')} ikon="igazolas" cim={A.allapot.title} mondat={mondat} />}
      dokk={v && !v.notForRegime && v.canEdit ? <GombE2 ures={ures} /> : undefined}
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !v ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          {v.items.length ? (
            <>
              <Szakasz ikon="igazolas" cim={`Idei kedvezmények (${v.year})`} jobbra={<MiEzKor kulcs="kedvezmenyek" />} />
              <Lap>
                {v.items.map((it, i) => (
                  <View key={it.kind} style={{ paddingVertical: 10, marginHorizontal: 16, paddingLeft: 54, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
                    <T m={16} s={600} lh={1.35}>
                      {it.label}
                    </T>
                    <T m={15} lh={1.4} c={szin.halvany}>
                      {it.line}
                    </T>
                    <T m={15} s={650} lh={1.4} c={it.status === 'elutasitva' ? szin.veszely : it.status === 'jovahagyva' ? szin.tinta : szin.borostyanSzoveg} style={{ marginTop: 2 }} szam>
                      {it.status === 'jovahagyva' && !it.inYear ? A.allapot.jovahagyvaEvVegen : it.statusText}
                    </T>
                    {it.status === 'kerdes' ? <GombM cim={A.allapot.kerdesButton} onPress={() => router.push('/uzenetek')} style={{ marginTop: 6 }} /> : null}
                  </View>
                ))}
              </Lap>
            </>
          ) : null}
          {v.documentsToKeep.length ? (
            <>
              <Szakasz ikon="irat" cim="Ezeket tartsd meg" megj={fillPlaceholders('{firstName} elkérheti, feltölteni nem kell.', { firstName: fn })} />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                {v.documentsToKeep.map((d) => (
                  <T key={d} m={16} lh={1.5} style={{ paddingLeft: 54 }}>
                    {`• ${d}`}
                  </T>
                ))}
              </Lap>
            </>
          ) : null}
          {!v.notForRegime ? (
            <T m={13.5} lh={1.45} c={szin.halvany} style={{ marginTop: 12 }}>
              {A.allapot.footer}
            </T>
          ) : null}
        </>
      )}
    </Kepernyo>
  );
}

function GombE2({ ures }: { ures: boolean }) {
  // a képernyő egyetlen fő gombja: kitöltés vagy módosítás
  return <GombE cim={ures ? A.allapot.noneButton : A.allapot.edit} onPress={() => router.push('/kedvezmenyek/kerdoiv')} />;
}
