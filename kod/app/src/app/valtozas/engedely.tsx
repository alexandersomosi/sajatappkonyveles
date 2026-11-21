// SPEC §28.5.5 – „Nézd át, mit jelentünk be”: az adatok blokkokban („Módosítom” → az űrlap), két nyilatkozat, és
// „Engedélyezem a bejelentést”. A hash a szerveré: ha közben módosult valami, újra kell engedélyezni.
import { Fragment, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CHANGE_CONSENT_TEXTS as C, fillPlaceholders, huLongDate } from '@/_shared/bekotes';
import { ApiHiba } from '@/api/http';
import { useEngedelyKuld, useEngedelyOsszegzes, useMe, useValtozasok } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { szin } from '@/theme/tokens';
import { GombE, GombM, HibaSzoveg, Lap, Pipa, Szakasz } from '@/ui/alap';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

export default function ValtozasEngedely() {
  const p = useLocalSearchParams<{ assist?: string }>();
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const konyvelo = me.data?.accountant?.displayName ?? fn;
  const q = useEngedelyOsszegzes(p.assist);
  const v = useValtozasok();
  const kuld = useEngedelyKuld();
  const jelez = useJelzes();
  const [nyil, setNyil] = useState(false);
  const [utas, setUtas] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const assist = v.data?.items.find((i) => i.openAssist?.id === p.assist)?.openAssist ?? null;
  const ch = assist?.change;
  const nap = ch && 'effectiveOn' in ch ? ch.effectiveOn : ch && 'from' in ch ? ch.from : null;
  const o = q.data;
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<UrlapFej vissza={() => vissza('/valtozas')} szakasz="Változás bejelentése" />}
      dokk={
        o ? (
          <GombE
            cim={C.button}
            tolt={kuld.isPending}
            onPress={async () => {
              if (!nyil || !utas) return setHiba('Jelöld be mindkét nyilatkozatot.');
              try {
                await kuld.mutateAsync({ id: p.assist!, hash: o.hash, declaration: true, instruction: true });
                jelez({ szoveg: `Engedélyezted. ${fn} beküldi, és szól.`, kesz: true });
                router.replace('/valtozas');
              } catch (e) {
                setHiba(e instanceof ApiHiba && e.code === 'assist_consent_stale' ? C.stale : hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
              }
            }}
          />
        ) : undefined
      }
    >
      <UrlapKerdes cim={C.title} miert={fillPlaceholders(C.sub, { firstName: fn })} />
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !o ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          {o.blocks.map((b) => (
            <Fragment key={b.key}>
              <Szakasz ikon="irat" cim={b.title} jobbra={b.editRoute ? <GombM cim={C.edit} onPress={() => router.push(b.editRoute as never)} /> : undefined} />
              <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                {b.lines.map((l, i) => (
                  <T key={i} m={16} lh={1.5} style={{ paddingLeft: 54 }}>
                    {l}
                  </T>
                ))}
              </Lap>
            </Fragment>
          ))}
          <View style={{ marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 10, borderTopColor: szin.sav }}>
            <Pipa be={nyil} valt={setNyil}>
              {fillPlaceholders(C.declaration, { valtozasNapja: huLongDate(nap) || 'a megadott nap' })}
            </Pipa>
            <Pipa be={utas} valt={setUtas}>
              {fillPlaceholders(C.instruction, { konyveloNev: konyvelo })}
            </Pipa>
          </View>
        </>
      )}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}
