// SPEC §28.K.2 – havi ellenőrzés „Változott valami {honap} óta?”: soronként egy igen–nem kérdés („Igen” kapszula jobbra);
// a dokkban „Nem változott semmi” (egy koppintás), vagy ha valamire igent mondtál, „Tovább”. Minden „igen” után egy-egy
// kérdés egy képernyőn, közérthető magyarázattal, és ahol a NAV-nál be kell jelenteni: „Hogyan intézzük?” – Bejelentjük
// helyetted (díja előre fizetve, DEMO amíg nincs véglegesítve) / Magam jelentem be (ingyenes) / Előbb beszéljük meg.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { CheckinItemAnswer, ChangeData, CheckinView } from '@/_shared/api';
import {
  CHECKIN_ADMIN_TEXTS, CHECKIN_FOLLOWUP_TEXTS as FU, CHECKIN_ITEM_TEXTS, CHECKIN_RESULT_TEXTS, CHECKIN_TEXTS, EMPLOYER_ANSWER_LABELS, EMPLOYER_TEXTS, FEE_TEXTS,
  fillPlaceholders,
} from '@/_shared/bekotes';
import { changeFeeKind, EMPLOYER_ANSWERS, FEE_DEFAULTS, type ChangeKind, type CheckinHow, type CheckinItem, type CheckinWeeklyHours, type EmployerAnswer } from '@/_shared/enums';
import { useHaviEllenorzes, useHaviValasz, useMe } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { datumBe, datumPontos, maiNap, szam } from '@/lib/format';
import { dijFizetes } from '@/lib/simplepay';
import { DemoDij } from '@/kepernyok/k28';
import { Kapszulak, UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { URES_VADAT, valtozasAdat, valtozasEllenoriz, valtozasLapok, ValtozasLap, valtozasSorok, lapCim, type VAdat, type VLap } from '@/kepernyok/ValtozasUrlap';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';

interface Valasz { since: string; hours: CheckinWeeklyHours | null; choice: 'szekhely' | 'telephely' | null; how: CheckinHow | null; employer: EmployerAnswer | null; text: string; v: VAdat }
const URES: Valasz = { since: '', hours: null, choice: null, how: null, employer: null, text: '', v: URES_VADAT };

/** Melyik változás-fajtához tartozik a tétel (null = nem NAV-os bejelentés). Exportálva a tesztekhez. */
export function tetelFajta(item: CheckinItem, v: Pick<Valasz, 'choice'>): ChangeKind | null {
  switch (item) {
    case 'munkaviszony':
    case 'nyugdij':
      return 'valtozas_adoadat';
    case 'koltozes':
      return v.choice === 'telephely' ? 'valtozas_telephely' : 'valtozas_szekhely';
    case 'tevekenyseg':
      return 'valtozas_tevekenyseg';
    case 'szuneteltetes':
      return 'valtozas_szuneteltetes';
    case 'folytatas':
      return 'valtozas_folytatas';
    default:
      return null;
  }
}

/** A munkaviszony-válasz közérthető eredménye (SPEC §28.K.2). */
export function munkaEredmeny(mellek: boolean, hours: CheckinWeeklyHours | null): string | null {
  if (mellek) return CHECKIN_RESULT_TEXTS.mellek_fo;
  if (hours === 'legalabb_36') return CHECKIN_RESULT_TEXTS.fo_mellek_36;
  if (hours === 'kevesebb_36') return CHECKIN_RESULT_TEXTS.fo_rovid;
  return null;
}

type Lepes = { t: 'lista' } | { t: 'tetel'; item: CheckinItem } | { t: 'urlap'; item: CheckinItem; lap: VLap } | { t: 'osszegzes' };

export default function HaviEllenorzes() {
  const q = useHaviEllenorzes();
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const kuld = useHaviValasz();
  const jelez = useJelzes();
  const [igen, setIgen] = useState<CheckinItem[]>([]);
  const [val, setVal] = useState<Partial<Record<CheckinItem, Valasz>>>({});
  const [i, setI] = useState(0);
  const [hiba, setHiba] = useState<string | null>(null);
  const [eredmeny, setEredmeny] = useState<CheckinView | null>(null);
  const c = q.data;
  const mellek = false; // a minta-ügyfél főállású; a szerveren a profil dönti el (questionAlt)
  const v = (it: CheckinItem): Valasz => val[it] ?? URES;
  const setV = (it: CheckinItem, x: Partial<Valasz>) => setVal((r) => ({ ...r, [it]: { ...(r[it] ?? URES), ...x } }));

  const lepesek: Lepes[] = useMemo(() => {
    const l: Lepes[] = [{ t: 'lista' }];
    for (const it of igen) {
      l.push({ t: 'tetel', item: it });
      const fajta = tetelFajta(it, v(it));
      if (v(it).how === 'helyettunk' && fajta && fajta !== 'valtozas_adoadat') for (const lap of valtozasLapok(fajta, v(it).v)) l.push({ t: 'urlap', item: it, lap });
    }
    if (igen.length) l.push({ t: 'osszegzes' });
    return l;
  }, [igen, val]); // eslint-disable-line react-hooks/exhaustive-deps
  const lp = lepesek[Math.min(i, lepesek.length - 1)];

  if (q.isLoading) return <Kepernyo ful="fooldal"><Betolt /></Kepernyo>;
  if (q.error) return <Kepernyo ful="fooldal"><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;
  const kesz = eredmeny ?? (c && c.status !== 'nyitott' ? c : null);
  if (!c || kesz) return <Eredmeny c={kesz} fn={fn} />;

  const valaszok = (): CheckinItemAnswer[] =>
    igen.map((it) => {
      const x = v(it);
      const fajta = tetelFajta(it, x);
      let change: ChangeData | undefined;
      if (x.how === 'helyettunk' && fajta) {
        change =
          fajta === 'valtozas_adoadat'
            ? { kind: 'valtozas_adoadat', items: [it === 'nyugdij' ? 'nyugdijba_vonulas' : 'munkavegzes'], workKind: it === 'munkaviszony' ? (x.hours === 'legalabb_36' ? 'munkaviszony_mellett' : 'rovid_munkaviszony_mellett') : 'nyugdij_mellett', effectiveOn: datumBe(x.since) || maiNap(), note: null }
            : valtozasAdat(fajta, x.v);
      }
      return {
        item: it,
        ...(x.since ? { since: datumBe(x.since) } : {}),
        ...(x.hours ? { weeklyHours: x.hours } : {}),
        ...(x.choice ? { choice: x.choice } : {}),
        ...(x.how ? { how: x.how } : {}),
        ...(x.employer ? { employer: x.employer } : {}),
        ...(change ? { change } : {}),
        ...(x.text.trim() ? { text: x.text.trim().slice(0, 500) } : {}),
      };
    });

  const ellenoriz = (): string | null => {
    if (lp.t === 'tetel') {
      const x = v(lp.item);
      if ((lp.item === 'munkaviszony' || lp.item === 'nyugdij') && !/^\d{4}-\d{2}-\d{2}$/.test(datumBe(x.since))) return 'Írd be a dátumot így: 2026.11.03.';
      if (lp.item === 'munkaviszony' && !mellek && !x.hours) return 'Válaszd ki, heti hány órában.';
      if (lp.item === 'koltozes' && !x.choice) return 'Válaszd ki, mi változik.';
      if (lp.item === 'alkalmazott' && !x.employer) return 'Válassz egyet.';
      if (tetelFajta(lp.item, x) && !x.how) return 'Válaszd ki, hogyan intézzük.';
    }
    if (lp.t === 'urlap') {
      const fajta = tetelFajta(lp.item, v(lp.item))!;
      return valtozasEllenoriz(fajta, lp.lap, v(lp.item).v, maiNap());
    }
    return null;
  };
  const tovabb = async () => {
    setHiba(null);
    if (lp.t === 'lista' && !igen.length) {
      try {
        await kuld.mutateAsync({ id: c.id, input: { result: 'nem_valtozott' } });
        jelez({ szoveg: CHECKIN_TEXTS.noneToast, kesz: true });
        router.replace('/');
      } catch (e) {
        setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
      }
      return;
    }
    const h = ellenoriz();
    if (h) return setHiba(h);
    if (lp.t === 'osszegzes') {
      try {
        const r = await kuld.mutateAsync({ id: c.id, input: { result: 'valtozott', answers: valaszok() } });
        setEredmeny(r);
      } catch (e) {
        setHiba(hibaUzenet(e, 'Nem sikerült elküldeni. Próbáld újra.'));
      }
      return;
    }
    setI((n) => n + 1);
  };
  const gomb = lp.t === 'lista' ? (igen.length ? CHECKIN_TEXTS.nextButton : CHECKIN_TEXTS.noneButton) : lp.t === 'osszegzes' ? 'Elküldöm' : CHECKIN_TEXTS.nextButton;
  const fej = <UrlapFej vissza={() => (i > 0 ? (setHiba(null), setI(i - 1)) : vissza('/'))} szakasz="Havi kérdések" />;

  return (
    <Kepernyo ful="fooldal" fejlec={fej} dokk={<GombE cim={gomb} tolt={kuld.isPending} onPress={() => void tovabb()} />}>
      {lp.t === 'lista' ? (
        <>
          <UrlapKerdes cim={fillPlaceholders(CHECKIN_TEXTS.title, { honap: c.periodLabel })} miert={CHECKIN_TEXTS.sub} ikon="kerdezek" />
          <Lap kotott>
            {c.items.map((x, n) => {
              const be = igen.includes(x.item);
              const kerdes = x.item === 'munkaviszony' && mellek ? (CHECKIN_ITEM_TEXTS.munkaviszony.questionAlt ?? x.question) : x.question;
              return (
                <View key={x.item} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, marginHorizontal: 16, borderTopWidth: n ? 1 : 0, borderTopColor: szin.hajszal }}>
                  <T m={16} lh={1.35} style={{ flex: 1 }}>
                    {kerdes}
                  </T>
                  <Kapszulak tobb elemek={[{ kulcs: 'igen', cim: CHECKIN_TEXTS.yes }]} ertek={be ? ['igen'] : []} valt={() => setIgen((l) => (be ? l.filter((y) => y !== x.item) : [...l, x.item]))} />
                </View>
              );
            })}
          </Lap>
        </>
      ) : lp.t === 'tetel' ? (
        <TetelLap item={lp.item} x={v(lp.item)} set={(p) => setV(lp.item, p)} fn={fn} i={i} n={lepesek.length - 1} mellek={mellek} />
      ) : lp.t === 'urlap' ? (
        <>
          <UrlapKerdes valtozo i={i} n={lepesek.length - 1} cim={lapCim(tetelFajta(lp.item, v(lp.item))!, lp.lap)} />
          <ValtozasLap kind={tetelFajta(lp.item, v(lp.item))!} lap={lp.lap} a={v(lp.item).v} set={(p) => setV(lp.item, { v: { ...v(lp.item).v, ...p } })} />
        </>
      ) : (
        <>
          <UrlapKerdes valtozo i={i} n={lepesek.length - 1} cim="Ezt küldöd el" miert={`${fn} megkapja, és ha teendő van, szól.`} />
          <Lap kotott>
            {igen.map((it, n) => {
              const x = v(it);
              const fajta = tetelFajta(it, x);
              const fk = fajta && x.how === 'helyettunk' ? changeFeeKind(fajta, fajta === 'valtozas_adoadat' ? [it === 'nyugdij' ? 'nyugdijba_vonulas' : 'munkavegzes'] : []) : null;
              return (
                <View key={it} style={{ paddingVertical: 10, marginHorizontal: 16, borderTopWidth: n ? 1 : 0, borderTopColor: szin.hajszal }}>
                  <T m={16} s={600} lh={1.35}>
                    {CHECKIN_ITEM_TEXTS[it].question}
                  </T>
                  {/* k6c2: what changes (the new address, the date), not only how */}
                  {(it === 'munkaviszony' || it === 'nyugdij') && x.since ? (
                    <T m={15} lh={1.4} szam>
                      {`Mióta: ${datumPontos(datumBe(x.since))}`}
                    </T>
                  ) : null}
                  {x.how === 'helyettunk' && fajta && fajta !== 'valtozas_adoadat'
                    ? valtozasSorok(fajta, x.v).map((s) => (
                        <T key={s} m={15} lh={1.4} szam>
                          {s}
                        </T>
                      ))
                    : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                    <T m={15} lh={1.4} c={szin.halvany} szam>
                      {x.how === 'helyettunk' ? 'Bejelentjük helyetted' : x.how === 'magatol' ? 'Magad jelented be (ingyenes)' : x.how === 'kerdes' ? 'Előbb beszéljük meg' : it === 'alkalmazott' && x.employer ? EMPLOYER_ANSWER_LABELS[x.employer] : 'Szólunk, ha teendő van'}
                      {fk ? ` · díja ${szam(FEE_DEFAULTS[fk].amountHuf)} Ft, előre fizetve` : ''}
                    </T>
                    {fk && !FEE_DEFAULTS[fk].confirmed ? <DemoDij /> : null}
                  </View>
                </View>
              );
            })}
          </Lap>
        </>
      )}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}

function TetelLap({ item, x, set, fn, i, n, mellek }: { item: CheckinItem; x: Valasz; set: (p: Partial<Valasz>) => void; fn: string; i: number; n: number; mellek: boolean }) {
  const fajta = tetelFajta(item, x);
  const sz = (s: string) => fillPlaceholders(s, { firstName: fn });
  const eredmeny = item === 'munkaviszony' ? munkaEredmeny(mellek, x.hours) : item === 'nyugdij' ? CHECKIN_RESULT_TEXTS.nyugdij : null;
  return (
    <>
      <UrlapKerdes valtozo i={i} n={n} cim={CHECKIN_ITEM_TEXTS[item].question} />
      {item === 'munkaviszony' || item === 'nyugdij' ? (
        <Mezo felirat={item === 'nyugdij' ? FU.pensionSince : FU.since} placeholder="2026.11.03." keyboardType="numbers-and-punctuation" value={x.since} onChangeText={(t) => set({ since: t })} style={{ marginBottom: 14 }} />
      ) : null}
      {item === 'munkaviszony' && !mellek ? (
        <View style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <T m={15} s={600}>
              {FU.hours}
            </T>
            <MiEzKor kulcs="heti_36_ora" />
          </View>
          <Kapszulak elemek={[{ kulcs: 'legalabb_36', cim: FU.hours36 }, { kulcs: 'kevesebb_36', cim: FU.hoursLess }]} ertek={x.hours} valt={(k) => set({ hours: k as CheckinWeeklyHours })} />
        </View>
      ) : null}
      {item === 'koltozes' ? <Kapszulak oszlop elemek={[{ kulcs: 'szekhely', cim: FU.koltozesSzekhely }, { kulcs: 'telephely', cim: FU.koltozesTelephely }]} ertek={x.choice} valt={(k) => set({ choice: k as 'szekhely' | 'telephely' })} /> : null}
      {item === 'csalad' ? (
        <>
          <T m={16} lh={1.45}>
            {FU.csalad}
          </T>
          <GombM cim={FU.csaladButton} onPress={() => router.push('/kedvezmenyek/kerdoiv')} style={{ marginTop: 10 }} />
        </>
      ) : null}
      {item === 'alkalmazott' ? (
        <>
          <Kapszulak oszlop elemek={EMPLOYER_ANSWERS.filter((e) => e !== 'nincs').map((e) => ({ kulcs: e, cim: EMPLOYER_ANSWER_LABELS[e] }))} ertek={x.employer} valt={(k) => set({ employer: k as EmployerAnswer })} />
          {x.employer ? (
            <T m={16} lh={1.45} style={{ marginTop: 12 }}>
              {sz(EMPLOYER_TEXTS.yes)}
            </T>
          ) : null}
        </>
      ) : null}
      {item === 'kata_ceges' ? (
        <T m={16} lh={1.45}>
          {sz(FU.kataCeges)}
        </T>
      ) : null}
      {item === 'egyeb' ? <Mezo felirat={CHECKIN_TEXTS.egyebPlaceholder} multiline value={x.text} onChangeText={(t) => set({ text: t.slice(0, 500) })} /> : null}
      {eredmeny ? (
        <View style={{ marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 10, borderTopColor: szin.sav }}>
          <T m={16} s={600} lh={1.45}>
            {eredmeny}
          </T>
        </View>
      ) : null}
      {fajta ? <HogyanIntezzuk item={item} fajta={fajta} x={x} set={set} fn={fn} /> : null}
    </>
  );
}

/** „Hogyan intézzük?” – a §27.3.1 kiemelt kártya mintája (2 pt kék keret, 3D ikon), alatta az ingyenes út és a beszélgetés. */
function HogyanIntezzuk({ item, fajta, x, set, fn }: { item: CheckinItem; fajta: ChangeKind; x: Valasz; set: (p: Partial<Valasz>) => void; fn: string }) {
  const fk = changeFeeKind(fajta, fajta === 'valtozas_adoadat' ? [item === 'nyugdij' ? 'nyugdijba_vonulas' : 'munkavegzes'] : []);
  const dij = fk ? FEE_DEFAULTS[fk] : null;
  const val = (how: CheckinHow) => set({ how });
  return (
    <View style={{ marginTop: 16 }}>
      <T m={18} s={650} lh={1.3} style={{ marginBottom: 10 }}>
        {FEE_TEXTS.choiceTitle}
      </T>
      <View style={{ borderRadius: forma.lap, borderWidth: 2, borderColor: x.how === 'helyettunk' ? szin.tintakek : szin.keret, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ikon3d nev="bevallas" pt={28} />
          <T m={17} s={650} lh={1.3} style={{ flex: 1 }}>
            {FEE_TEXTS.choiceAssisted.title}
          </T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          <T m={15.5} lh={1.45} szam>
            {fillPlaceholders(FEE_TEXTS.choiceAssisted.body, { firstName: fn, dij: szam(dij?.amountHuf ?? 0) })}
          </T>
          {dij && !dij.confirmed ? <DemoDij /> : null}
        </View>
        <Kapszulak elemek={[{ kulcs: 'helyettunk', cim: FEE_TEXTS.choiceAssisted.button }]} ertek={x.how === 'helyettunk' ? 'helyettunk' : null} valt={() => val('helyettunk')} />
      </View>
      <View style={{ marginTop: 10, gap: 4 }}>
        <Kapszulak elemek={[{ kulcs: 'magatol', cim: FEE_TEXTS.choiceSelf }]} ertek={x.how === 'magatol' ? 'magatol' : null} valt={() => val('magatol')} />
        <GombSz cim={FEE_TEXTS.choiceTalk} m={16} onPress={() => val('kerdes')} c={x.how === 'kerdes' ? szin.tinta : undefined} />
      </View>
      <T m={15} lh={1.45} c={szin.halvany}>
        {fillPlaceholders(FEE_TEXTS.adminLine, { admin: fillPlaceholders(CHECKIN_ADMIN_TEXTS[item], { firstName: fn }) })}
      </T>
    </View>
  );
}

/** A beküldés után: tételenként az állapot; díjas tételnél „Fizetek (X Ft)”, önkiszolgálónál az útmutató. */
function Eredmeny({ c, fn }: { c: CheckinView | null; fn: string }) {
  const jelez = useJelzes();
  return (
    <Kepernyo ful="fooldal" fejlec={<UrlapFej vissza={() => vissza('/')} szakasz="Havi kérdések" />}>
      {!c ? (
        <UrlapKerdes cim="Most nincs havi kérdés" miert="Havonta egyszer rákérdezünk, változott-e valami. Ha közben változik, írj nekünk." ikon="kerdezek" />
      ) : c.status === 'nem_valtozott' ? (
        <UrlapKerdes cim="Köszönjük!" miert={CHECKIN_TEXTS.noneBody} ikon="kerdezek" />
      ) : c.status === 'lejart' ? (
        <UrlapKerdes cim="Ezt a hónapot lezártuk" miert={CHECKIN_TEXTS.expired} ikon="kerdezek" />
      ) : (
        <>
          {/* k6c2: while a fee is unpaid, the team has not started: say what the client has to do */}
          <UrlapKerdes
            cim="Köszönjük!"
            miert={fillPlaceholders(c.items.some((x) => x.feeCharge && x.feeCharge.status === 'nyitott') ? CHECKIN_TEXTS.doneBodyFee : CHECKIN_TEXTS.doneBody, { firstName: fn })}
            ikon="kerdezek"
          />
          <Szakasz ikon="irat" cim="Ezekkel foglalkozunk" />
          <Lap>
            {/* only the items answered "igen" (they have a status); the "nem" answers are not listed (k6c) */}
            {c.items.filter((x) => x.status).map((x, n) => (
              <View key={x.item} style={{ paddingVertical: 10, marginHorizontal: 16, paddingLeft: 38, borderTopWidth: n ? 1 : 0, borderTopColor: szin.hajszal }}>
                <T m={16} s={600} lh={1.35}>
                  {x.question}
                </T>
                <T m={15} lh={1.4} c={szin.halvany}>
                  {x.statusText ?? ''}
                </T>
                {x.feeCharge && x.feeCharge.status === 'nyitott' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <GombM
                      cim={fillPlaceholders(FEE_TEXTS.payButtonAmount, { dij: szam(x.feeCharge.amountHuf) })}
                      onPress={async () => {
                        try {
                          await dijFizetes(x.feeCharge!.id);
                        } catch (e) {
                          jelez(hibaUzenet(e, FEE_TEXTS.payFailed));
                        }
                      }}
                    />
                    {x.feeCharge.demo ? <DemoDij /> : null}
                  </View>
                ) : null}
                {x.status === 'ugyfel_intezi' ? <GombSz cim="Megnézem az útmutatót" m={16} onPress={() => router.push('/valtozas')} /> : null}
              </View>
            ))}
          </Lap>
        </>
      )}
    </Kepernyo>
  );
}
