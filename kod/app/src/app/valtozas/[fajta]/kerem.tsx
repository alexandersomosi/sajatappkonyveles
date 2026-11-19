// SPEC §28.5.5 + §28.K.1/§28.K.2 – „Bejelentjük helyetted”: 0. lap = így megy (a díj-sorral) + „soha nem kérjük el a
// belépésedet”; aztán az új adatok egy mezőcsoport egy képernyőn; a végén összegzés, „Hívjatok fel előtte”, és
// „Fizetek (4 999 Ft)”. A díjat ELŐRE fizeted; a csapat csak a sikeres fizetés után lát neki. ?assist=<id> = módosítás.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CHANGE_FORM_TEXTS, CHANGE_TEXTS, FEE_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { changeFeeKind, CHANGE_TAX_ITEMS_CALL_FIRST, FEE_DEFAULTS, type ChangeKind } from '@/_shared/enums';
import { useMe, useValtozasKer, useValtozasModosit, useValtozasok } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { maiNap, szam } from '@/lib/format';
import { dijFizetes } from '@/lib/simplepay';
import { valtozasFajta } from '@/lib/utmutato';
import { DemoDij } from '@/kepernyok/k28';
import { UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { lapCim, URES_VADAT, vadatBol, valtozasAdat, valtozasEllenoriz, valtozasLapok, ValtozasLap, valtozasSorok, type VAdat } from '@/kepernyok/ValtozasUrlap';
import { szin } from '@/theme/tokens';
import { GombE, HibaSzoveg, Kapcsolo, Lap, Szakasz } from '@/ui/alap';
import { IgyMegy, SohaBelepes } from '@/ui/Helyettunk';
import { Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

export default function ValtozasKerem() {
  const p = useLocalSearchParams<{ fajta: string; lap?: string; assist?: string }>();
  const kind = (valtozasFajta(p.fajta) ? p.fajta : 'valtozas_szekhely') as ChangeKind;
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const v = useValtozasok();
  const ker = useValtozasKer();
  const modosit = useValtozasModosit();
  const jelez = useJelzes();
  const [a, setA] = useState<VAdat>(URES_VADAT);
  const [hivjatok, setHivjatok] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const [toltve, setToltve] = useState(!p.assist);
  const regi = p.assist ? v.data?.items.find((i) => i.openAssist?.id === p.assist)?.openAssist : null;
  useEffect(() => {
    if (toltve || !regi) return;
    setA(vadatBol(regi.change));
    setToltve(true);
  }, [regi, toltve]);

  const urlap = valtozasLapok(kind, a);
  const lapok = [...(p.assist ? [] : ['igy' as const]), ...urlap, 'osszegzes' as const];
  const i = Math.max(0, Math.min(lapok.length - 1, Number(p.lap ?? 0) || 0));
  const lap = lapok[i];
  const ugrik = (n: number) => {
    setHiba(null);
    router.setParams({ lap: String(n) });
  };
  const set = (x: Partial<VAdat>) => setA((r) => ({ ...r, ...x }));
  const fk = changeFeeKind(kind, kind === 'valtozas_adoadat' ? (a.items.length ? a.items : ['munkavegzes']) : []);
  const dij = fk ? FEE_DEFAULTS[fk] : null;
  const hivasKell = kind === 'valtozas_adoadat' && a.items.some((x) => CHANGE_TAX_ITEMS_CALL_FIRST.includes(x));
  const kuldes = async () => {
    try {
      if (p.assist) {
        await modosit.mutateAsync({ id: p.assist, change: valtozasAdat(kind, a) });
        jelez({ szoveg: 'Elmentettük. Nézd át újra, és engedélyezd.', kesz: true });
        return router.replace({ pathname: '/valtozas/engedely', params: { assist: p.assist } });
      }
      const r = await ker.mutateAsync({ kind, source: 'helyettunk_valtozas', change: valtozasAdat(kind, a), callback: hivjatok || hivasKell });
      if (r.feeCharge && r.feeCharge.canPay) {
        // előre fizetve (SPEC §28.K.1): a fizetés után a csapat nekilát
        await dijFizetes(r.feeCharge.id);
        return;
      }
      jelez({ szoveg: fillPlaceholders(CHANGE_TEXTS.toast, { firstName: fn }), kesz: true });
      router.replace(`/valtozas/${kind}`);
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült elküldeni. Próbáld újra.'));
    }
  };
  const tovabb = () => {
    if (lap !== 'igy' && lap !== 'osszegzes') {
      const h = valtozasEllenoriz(kind, lap, a, maiNap());
      if (h) return setHiba(h);
    }
    if (lap === 'osszegzes') return void kuldes();
    ugrik(i + 1);
  };
  const fizetendo = lap === 'osszegzes' && dij && dij.amountHuf > 0 && !hivjatok && !hivasKell && !p.assist;
  const gomb = lap === 'igy' ? 'Kezdjük' : lap === 'osszegzes' ? (p.assist ? 'Mentem' : fizetendo ? fillPlaceholders(FEE_TEXTS.payButtonAmount, { dij: szam(dij!.amountHuf) }) : CHANGE_TEXTS.send) : 'Tovább';
  const cimke = fillPlaceholders(CHANGE_TEXTS.sheetTitle, { kindLabel: CHANGE_TEXTS.sorok[kind].title });

  return (
    <Kepernyo
      ful="fiok"
      fejlec={<UrlapFej vissza={() => (i > 0 ? ugrik(i - 1) : vissza(`/valtozas/${kind}`))} szakasz={CHANGE_TEXTS.helyettunk.title} />}
      dokk={<GombE cim={gomb} tolt={ker.isPending || modosit.isPending} onPress={tovabb} />}
    >
      {lap === 'igy' ? (
        <>
          <UrlapKerdes cim={cimke} miert={fillPlaceholders(CHANGE_TEXTS.helyettunk.body, { firstName: fn })} />
          {dij ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <T m={16} s={650} szam>{`Díja: ${szam(dij.amountHuf)} Ft, előre fizetve.`}</T>
              {!dij.confirmed ? <DemoDij /> : null}
            </View>
          ) : null}
          <IgyMegy fajta={kind} fn={fn} dij={dij?.amountHuf ?? 0} />
          <SohaBelepes fn={fn} style={{ marginTop: 12 }} />
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 12 }}>
            {FEE_TEXTS.selfFree}
          </T>
        </>
      ) : lap === 'osszegzes' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={CHANGE_FORM_TEXTS.summaryTitle} miert={`${cimke}. Ha valami nem stimmel, lépj vissza.`} />
          <Szakasz ikon="irat" cim={CHANGE_TEXTS.sorok[kind].title} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            {valtozasSorok(kind, a).map((s, n) => (
              <T key={n} m={16} lh={1.5} style={{ paddingLeft: 38 }}>
                {s}
              </T>
            ))}
          </Lap>
          {!p.assist ? (
            <View style={{ marginHorizontal: -16, borderTopWidth: 8, borderTopColor: szin.sav, marginTop: 4 }}>
              <Kapcsolo be={hivjatok || hivasKell} tilt={hivasKell} valt={setHivjatok} cim={CHANGE_TEXTS.callbackToggle} al={hivasKell ? CHANGE_TEXTS.callbackForced : 'Kollégánk 24–48 órán belül hív, és együtt átnézitek.'} />
            </View>
          ) : null}
          {fizetendo ? (
            <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 8 }}>
              {`A fizetés után ${fn} nekilát. Ha a fizetés nem sikerül, nem indul el semmi.`}
            </T>
          ) : null}
        </>
      ) : (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={lapCim(kind, lap)} />
          <ValtozasLap kind={kind} lap={lap} a={a} set={set} />
        </>
      )}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}
