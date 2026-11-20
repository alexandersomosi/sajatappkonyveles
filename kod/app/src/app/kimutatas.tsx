// SPEC §29.6 F2 – Bevételi kimutatás: egy koppintásra PDF (idei, előző évek, más időszak ≤ 24 hónap). Előtte látod,
// mi lesz benne; ha a könyvelőd pontosan ezt az adatot ellenőrizte, a PDF-en rajta a pecsét. Nem hivatalos NAV-igazolás.
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { INCOME_STATEMENT_RULES, INCOME_STATEMENT_TEXTS } from '@/_shared/k29f';
import { fillPlaceholders } from '@/_shared/bekotes';
import { kimutatasUt, useKimutatas, useKimutatasEllenoriz, useKimutatasMent } from '@/api/k29f';
import { letoltMegnyit } from '@/lib/fajlok';
import { datumEvvel, honapCim, maiNap, szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { HonapValaszto } from '@/kepernyok/Urlap';
import { Chip } from '@/kepernyok/FeltoltesLap';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { KeszJel } from '@/ui/kepek';
import { Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

function honapokSzama(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
}

function KimutatasTartalom() {
  const p = useLocalSearchParams<{ from?: string; to?: string }>();
  const ma = maiNap();
  const ev = ma.slice(0, 4);
  const ideiTol = `${ev}-01`;
  const ideiIg = ma.slice(0, 7);
  const [tol, setTol] = useState(p.from ?? ideiTol);
  const [ig, setIg] = useState(p.to ?? ideiIg);
  const [mas, setMas] = useState(Boolean(p.from && p.from !== ideiTol));
  const [masTol, setMasTol] = useState<string | null>(null);
  const [masIg, setMasIg] = useState<string | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  const q = useKimutatas(tol, ig);
  const ellenoriz = useKimutatasEllenoriz();
  const ment = useKimutatasMent();
  const jelez = useJelzes();
  const m = q.data;
  const fn = m?.firstName ?? 'A könyvelőd';
  const idei = tol === ideiTol && ig === ideiIg;

  const valaszt = (f: string, t: string) => {
    setHiba(null);
    setTol(f);
    setIg(t);
  };
  const masAlkalmaz = () => {
    if (!masTol || !masIg) return setHiba('Válaszd ki mindkét hónapot.');
    if (masTol > masIg) return setHiba(INCOME_STATEMENT_TEXTS.periodOrder);
    if (honapokSzama(masTol, masIg) > INCOME_STATEMENT_RULES.maxMonths) return setHiba(INCOME_STATEMENT_TEXTS.periodTooLong);
    if (masIg > ideiIg) return setHiba('A jövőre még nincs adat.');
    valaszt(masTol, masIg);
  };
  const letolt = async () => {
    setTolt(true);
    try {
      await letoltMegnyit(kimutatasUt(tol, ig), `bevetelek_${tol}_${ig}.pdf`, 'application/pdf');
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült letölteni. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  };
  const vanAdat = Boolean(m && m.months.some((x) => x.revenueHuf > 0));
  const ideiEv = Number(ev);

  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/')} cim={INCOME_STATEMENT_TEXTS.screenTitle} al={INCOME_STATEMENT_TEXTS.screenSub} />}
      dokk={<GombE cim={idei ? INCOME_STATEMENT_TEXTS.mainButton : INCOME_STATEMENT_TEXTS.download} tolt={tolt} disabled={!m} onPress={() => void letolt()} />}
    >
      <Szakasz ikon="hataridok" cim="Melyik időszak?" />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip cim={`Idei (${ev})`} on={idei && !mas} onPress={() => { setMas(false); valaszt(ideiTol, ideiIg); }} />
          {(m?.years ?? []).map((y) => (
            <Chip key={y} cim={fillPlaceholders(INCOME_STATEMENT_TEXTS.fullYear, { ev: String(y) })} on={!mas && tol === `${y}-01` && ig === `${y}-12`} onPress={() => { setMas(false); valaszt(`${y}-01`, `${y}-12`); }} />
          ))}
          <Chip cim={INCOME_STATEMENT_TEXTS.otherPeriod} on={mas} onPress={() => setMas(true)} />
        </View>
        {mas ? (
          <View style={{ marginTop: 14, gap: 16 }}>
            <HonapValaszto cim={INCOME_STATEMENT_TEXTS.from} ertek={masTol} valt={setMasTol} tol={ideiEv - 3} ig={ideiEv} />
            <HonapValaszto cim={INCOME_STATEMENT_TEXTS.to} ertek={masIg} valt={setMasIg} tol={ideiEv - 3} ig={ideiEv} />
            <GombM cim="Ezt az időszakot kérem" onPress={masAlkalmaz} />
          </View>
        ) : null}
        <HibaSzoveg szoveg={hiba} />
      </Lap>
      {q.isLoading ? (
        <Betolt />
      ) : q.error ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : m ? (
        <>
          <Szakasz ikon="kivonat" cim={INCOME_STATEMENT_TEXTS.previewTitle} megj={m.regimeLines.join(' · ')} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <T m={13.5} s={600} c={szin.halvany} style={{ flex: 1 }}>
                Hónap
              </T>
              <T m={13.5} s={600} c={szin.halvany} style={{ width: 56, textAlign: 'right' }}>
                Számla
              </T>
              <T m={13.5} s={600} c={szin.halvany} style={{ width: 110, textAlign: 'right' }}>
                Bevétel
              </T>
            </View>
            {m.months.map((x) => (
              <View key={x.month} style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: szin.hajszal }}>
                <T m={15} style={{ flex: 1 }}>
                  {honapCim(x.month, ev)}
                  {x.estimated ? '*' : ''}
                </T>
                <T m={15} szam c={szin.halvany} style={{ width: 56, textAlign: 'right' }}>
                  {x.invoices + x.other}
                </T>
                <T m={15} s={600} szam style={{ width: 110, textAlign: 'right' }}>
                  {`${szam(x.revenueHuf)} Ft`}
                </T>
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingTop: 10, borderTopWidth: 1.5, borderTopColor: szin.keret }}>
              <T m={16} s={700} style={{ flex: 1 }}>
                {INCOME_STATEMENT_TEXTS.total}
              </T>
              <T m={16} s={700} szam>{`${szam(m.totalHuf)} Ft`}</T>
            </View>
            {m.months.some((x) => x.estimated) ? (
              <T m={13.5} c={szin.halvany} lh={1.4} style={{ marginTop: 6 }}>
                {INCOME_STATEMENT_TEXTS.estimatedMark}
              </T>
            ) : null}
            {!vanAdat ? (
              <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
                Erre az időszakra még nincs bevétel az appban.
              </T>
            ) : null}
          </Lap>
          <Szakasz ikon="igazolas" cim="Ellenőrzés" />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
            {m.approved ? (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <KeszJel pt={20} />
                <T m={15.5} s={600} lh={1.45} style={{ flex: 1 }}>
                  {fillPlaceholders(INCOME_STATEMENT_TEXTS.checked, { firstName: m.approved.byName, datum: datumEvvel(m.approved.at.slice(0, 10)) })}
                </T>
              </View>
            ) : (
              <>
                <T m={15.5} lh={1.45}>
                  {m.reviewRequested ? fillPlaceholders(INCOME_STATEMENT_TEXTS.askPending, { firstName: fn }) : INCOME_STATEMENT_TEXTS.notChecked}
                </T>
                {!m.reviewRequested && vanAdat ? (
                  <GombM
                    cim={fillPlaceholders(INCOME_STATEMENT_TEXTS.askCheck, { firstName: fn })}
                    tolt={ellenoriz.isPending}
                    onPress={async () => {
                      try {
                        await ellenoriz.mutateAsync({ from: m.from, to: m.to });
                        jelez({ szoveg: fillPlaceholders(INCOME_STATEMENT_TEXTS.askSent, { firstName: fn }), kesz: true });
                      } catch (e) {
                        jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
                      }
                    }}
                  />
                ) : null}
              </>
            )}
            <GombM
              cim={INCOME_STATEMENT_TEXTS.saveToDossier}
              ikon="dosszie"
              tolt={ment.isPending}
              onPress={async () => {
                try {
                  await ment.mutateAsync({ from: m.from, to: m.to });
                  jelez({ szoveg: INCOME_STATEMENT_TEXTS.saved, kesz: true });
                } catch (e) {
                  jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
                }
              }}
            />
          </Lap>
          <Lap style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <T m={14.5} lh={1.45} c={szin.halvany}>
              Nem hivatalos NAV-igazolás. A számláid és az általad megadott egyéb bevételek alapján készül.
            </T>
            <GombSz cim="Hivatalos jövedelemigazolást kérek" onPress={() => router.push('/igazolas/uj?tipus=jovedelemigazolas')} style={{ marginTop: 4 }} />
          </Lap>
        </>
      ) : null}
    </Kepernyo>
  );
}

export default function Kimutatas() {
  return (
    <ZaroltKapu feature="bevetel" ful="fooldal" cim={INCOME_STATEMENT_TEXTS.screenTitle}>
      <KimutatasTartalom />
    </ZaroltKapu>
  );
}

