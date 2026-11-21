// SPEC §28.K.3 + §32.B – „Éves zárás {év}”: az állapot egy mondatban, a „Mikor mi jön” idővonal, a beadás után a különbözet
// (fizetendő → a közös fizetési lap; visszajár → a NAV utalja, Art. 64. § (1)), a nyitott önellenőrzés, és az ügyfél
// következő lépésének egyetlen gombja (Kitöltöm / Fizetek / Átnézem és jóváhagyom). A bevallást az app nem adja be:
// a könyvelő, meghatalmazottként.
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ANNUAL_TEXTS as E, fillPlaceholders } from '@/_shared/bekotes';
import { EVES_TEXTS as V } from '@/_shared/eves';
import { useEvesZaras, useMe, useVisszajaroMegjott } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { datumEvvel, datumRovid, maiNap, napHozzaad, szam } from '@/lib/format';
import { idovonalCimke, jovahagyasUt, kulonbozetUt } from '@/lib/eves';
import { datumHiba, datumNormal } from '@/lib/validators';
import { dijFizetes } from '@/lib/simplepay';
import { BELJEBB, OsszegSor, SavFej } from '@/kepernyok/k28';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { KeszJel } from '@/ui/kepek';
import { AlsoLap, Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';

export default function EvesZaras() {
  const ev = Number(maiNap().slice(0, 4));
  // SPEC §32.B: the closing in progress (the server picks the year), not this calendar year's empty one
  const q = useEvesZaras();
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const jelez = useJelzes();
  const megjott = useVisszajaroMegjott();
  const [lap, setLap] = useState(false);
  const [mikor, setMikor] = useState<'ma' | 'tegnap' | 'mas'>('ma');
  const [masNap, setMasNap] = useState('');
  const [osszeg, setOsszeg] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const z = q.data;
  const jovaUt = z ? jovahagyasUt(z) : null;
  const fizUt = z ? kulonbozetUt(z) : null;
  const gomb =
    z?.nextAction === 'kitoltes' ? (
      <GombE cim={E.buttons.kerdoiv} onPress={() => router.push('/eves-zaras/kerdoiv')} />
    ) : z?.nextAction === 'fizetes' && z.feeCharge ? (
      <GombE
        cim={E.buttons.dijra_var}
        onPress={async () => {
          try {
            await dijFizetes(z.feeCharge!.id);
          } catch (e) {
            jelez(hibaUzenet(e, 'Nem sikerült a fizetés. Próbáld újra.'));
          }
        }}
      />
    ) : z?.nextAction === 'jovahagyas' && jovaUt ? (
      <GombE cim={E.buttons.jovahagyasra_var} onPress={() => router.push(jovaUt as never)} />
    ) : fizUt ? (
      <GombE cim={V.beadva.fizetesGomb} onPress={() => router.push(fizUt as never)} />
    ) : undefined;
  const refund = z?.settlement?.refund ?? null;

  async function jelolMegjott() {
    if (!z) return;
    const nap = mikor === 'ma' ? maiNap() : mikor === 'tegnap' ? napHozzaad(maiNap(), -1) : datumNormal(masNap);
    if (mikor === 'mas') {
      const h = datumHiba(nap);
      if (h) return setHiba(h);
      if (nap > maiNap()) return setHiba('Jövőbeli napot nem jelölhetsz.');
    }
    const n = osszeg.trim() ? Number(osszeg.replace(/\s/g, '')) : null;
    if (n !== null && (!Number.isInteger(n) || n < 0)) return setHiba('Egész forintot írj.');
    setHiba(null);
    try {
      await megjott.mutateAsync({ id: z.id, receivedOn: nap, amountHuf: n });
      setLap(false);
      void q.refetch();
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült megjelölni. Próbáld újra.'));
    }
  }

  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<SavFej vissza={() => vissza('/')} ikon="bevallas" cim={fillPlaceholders(E.card.title, { ev: String(z?.year ?? ev - 1) })} mondat={z?.settlement?.text ?? z?.statusText ?? 'Január 5-én nyílik. Szólunk, ha kitöltheted.'} />}
      dokk={gomb}
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          {refund ? (
            <>
              <Szakasz ikon="befizetve" cim={refund.title} />
              <Lap style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ paddingLeft: BELJEBB, gap: 10 }}>
                  <T m={16} lh={1.45}>
                    {refund.text}
                  </T>
                  {refund.canMark ? (
                    <>
                      <GombM cim={V.visszajaro.jeloles} onPress={() => setLap(true)} style={{ alignSelf: 'flex-start' }} />
                      <T m={14} c={szin.halvany}>
                        {V.visszajaro.jelolesAl}
                      </T>
                    </>
                  ) : null}
                </View>
              </Lap>
            </>
          ) : null}
          {z?.corrections?.length ? (
            <>
              <Szakasz ikon="irat" cim={V.onell.listaCim} />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  {z.corrections.map((k, i) => (
                    <Pressable key={k.id} accessibilityRole="link" onPress={() => router.push(`/onellenorzes/${k.id}` as never)}>
                      <OsszegSor elso={i === 0} cim={k.title} al={k.statusText} huf={null} />
                    </Pressable>
                  ))}
                </View>
              </Lap>
            </>
          ) : null}
          <Szakasz ikon="hataridok" cim={z?.timeline?.length ? V.idovonalCim : 'Határidők'} jobbra={<MiEzKor kulcs="eves_zaras" />} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ paddingLeft: BELJEBB }}>
              {z?.timeline?.length ? (
                z.timeline.map((t, i) => (
                  <Pressable key={t.key} disabled={!t.link} accessibilityRole={t.link ? 'link' : undefined} onPress={() => t.link && router.push(t.link as never)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: szin.hajszal }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T m={14} c={szin.halvany} lh={1.3}>
                          {t.dateLabel}
                        </T>
                        <T m={16} s={600} lh={1.35}>
                          {t.title}
                        </T>
                        {t.sub ? (
                          <T m={14.5} lh={1.4} c={szin.halvany}>
                            {t.sub}
                          </T>
                        ) : null}
                      </View>
                      {t.status === 'kesz' ? (
                        <KeszJel pt={22} />
                      ) : idovonalCimke(t.status) ? (
                        <View style={{ paddingHorizontal: 10, height: 26, borderRadius: forma.gomb, justifyContent: 'center', backgroundColor: t.status === 'lejart' ? '#FBE3E1' : szin.gombMAlap }}>
                          <T m={13} s={650} c={t.status === 'lejart' ? '#8A1C12' : szin.tintakekSzoveg}>
                            {idovonalCimke(t.status)}
                          </T>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))
              ) : z ? (
                <>
                  <OsszegSor elso cim="A kérdőív kitöltése" al={datumEvvel(z.questionnaireDue)} huf={null} />
                  {z.legalDue.szja ? <OsszegSor cim={`Szja-bevallás (${fn} adja be)`} al={datumEvvel(z.legalDue.szja)} huf={null} /> : null}
                  {z.legalDue.kata ? <OsszegSor cim={`Kata-nyilatkozat (${fn} adja be)`} al={datumEvvel(z.legalDue.kata)} huf={null} /> : null}
                  <OsszegSor cim="Iparűzési adó bevallása" al={datumEvvel(z.legalDue.hipa)} huf={null} />
                </>
              ) : (
                <T m={16} lh={1.45} style={{ paddingVertical: 8 }}>
                  Az éves zárás január 5-én nyílik. Akkor kérünk tőled pár választ, és {fn} elkészíti a bevallásaidat.
                </T>
              )}
            </View>
          </Lap>
          {z?.feeCharge ? (
            <>
              <Szakasz ikon="szamlaszam" cim="Díj" />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  <OsszegSor elso cim={z.feeCharge.label} al={z.feeCharge.statusText} huf={z.feeCharge.amountHuf} />
                </View>
              </Lap>
            </>
          ) : null}
          <T m={13.5} lh={1.45} c={szin.halvany} style={{ marginTop: 12 }}>
            {`A bevallásokat ${fn} adja be meghatalmazottként, a te jóváhagyásod után.`}
          </T>
        </>
      )}
      <AlsoLap lathato={lap} bezar={() => setLap(false)}>
        <T m={22} s={700} lh={1.25} style={{ paddingRight: 84 }} accessibilityRole="header">
          {V.visszajaro.mikor}
        </T>
        <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
          {V.visszajaro.jelolesAl}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 }} accessibilityRole="radiogroup" aria-label={V.visszajaro.mikor}>
          {(
            [
              ['ma', `Ma, ${datumRovid(maiNap())}`],
              ['tegnap', 'Tegnap'],
              ['mas', 'Másik nap'],
            ] as const
          ).map(([k, c]) => (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: mikor === k, checked: mikor === k }}
              onPress={() => {
                setMikor(k);
                setHiba(null);
              }}
              style={{ height: 40, paddingHorizontal: 14, borderRadius: forma.mezo, borderWidth: mikor === k ? 2 : 1, borderColor: mikor === k ? szin.tintakek : szin.keret, justifyContent: 'center', backgroundColor: mikor === k ? '#fff' : szin.mezoAlap }}
            >
              <T m={15} s={mikor === k ? 650 : 500}>
                {c}
              </T>
            </Pressable>
          ))}
        </View>
        {mikor === 'mas' ? <Mezo felirat="A nap" placeholder="ÉÉÉÉ-HH-NN" value={masNap} onChangeText={(v) => setMasNap(v)} keyboardType="numbers-and-punctuation" style={{ marginTop: 12 }} /> : null}
        <Mezo felirat={V.visszajaro.mennyi} placeholder={z?.settlement?.diffHuf ? szam(Math.abs(z.settlement.diffHuf)) : ''} value={osszeg} onChangeText={setOsszeg} keyboardType="number-pad" style={{ marginTop: 12 }} />
        <HibaSzoveg szoveg={hiba} />
        <GombE cim={V.visszajaro.jeloles} onPress={() => void jelolMegjott()} tolt={megjott.isPending} style={{ marginTop: 18 }} />
        <GombSz cim="Mégse" style={{ marginTop: 8, alignSelf: 'center' }} onPress={() => setLap(false)} />
      </AlsoLap>
    </Kepernyo>
  );
}
