// SPEC §29.5 F1 – egy igazolás-kérés: állapot, „Hol tart?” idővonal, amit kértél, és a kész igazolás letöltése
// (az eredeti fájl – az elektronikus irat csak így hiteles). Visszavonni a beadás előtt lehet.
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CERT_FORM_TEXTS, CERT_PURPOSE_LABELS } from '@/_shared/k29f';
import { fillPlaceholders } from '@/_shared/bekotes';
import { get } from '@/api/http';
import { useHome } from '@/api/hooks';
import { useIgazolas, useIgazolasVisszavon } from '@/api/k29f';
import type { DocumentDetail } from '@/_shared/api';
import { fajlMegnyit } from '@/lib/fajlok';
import { datumEvvel, szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { Idovonal, IgazolasAllapot } from '@/kepernyok/k29f';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap, Szakasz } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

export default function IgazolasReszlet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useIgazolas(String(id ?? ''));
  const home = useHome();
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const visszavon = useIgazolasVisszavon();
  const jelez = useJelzes();
  const [biztos, setBiztos] = useState(false);
  const [tolt, setTolt] = useState(false);
  const v = q.data;
  const letolt = async () => {
    if (!v?.resultDocumentId) return;
    setTolt(true);
    try {
      const d = await get<DocumentDetail>(`/client/documents/${v.resultDocumentId}`);
      const ver = d.versions[d.versions.length - 1];
      if (ver) await fajlMegnyit(ver.fileId, `${v.title}.pdf`);
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült letölteni. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  };
  const sor = (cim: string, ertek: string | null | undefined) =>
    ertek ? (
      <View key={cim} style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
        <T m={15} c={szin.halvany} style={{ width: 120 }}>
          {cim}
        </T>
        <T m={15.5} s={550} lh={1.4} style={{ flex: 1 }}>
          {ertek}
        </T>
      </View>
    ) : null;
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/igazolas')} cim={v?.title ?? 'Igazolás'} al={v ? undefined : undefined} />}
      dokk={
        v?.status === 'kesz' && v.resultDocumentId ? (
          <GombE cim={CERT_FORM_TEXTS.download} tolt={tolt} onPress={() => void letolt()} />
        ) : v?.canPay ? (
          <GombE cim={`Fizetek (${szam(v.feeHuf)} Ft)`} onPress={() => router.push('/fiok/dijak')} />
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !v ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          <Lap style={{ padding: 16 }}>
            <IgazolasAllapot v={v} />
            {v.neededByWarn ? (
              <T m={14.5} lh={1.45} c={szin.borostyanSzoveg} style={{ marginTop: 8 }}>
                {CERT_FORM_TEXTS.neededByWarn}
              </T>
            ) : null}
            {v.status === 'kesz' && v.resultDocumentId ? (
              <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 8 }}>
                {CERT_FORM_TEXTS.validOnlyElectronic}
              </T>
            ) : null}
          </Lap>
          <Szakasz ikon="ora" cim={CERT_FORM_TEXTS.timelineTitle} />
          <Idovonal v={v} />
          <Szakasz ikon="irat" cim="Amit kértél" />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            {[
              sor(CERT_FORM_TEXTS.summaryRows.type, v.typeLabel),
              sor(CERT_FORM_TEXTS.summaryRows.year, v.year ? String(v.year) : null),
              sor(CERT_FORM_TEXTS.summaryRows.purpose, v.purposeKind && v.purposeKind !== 'mas' ? CERT_PURPOSE_LABELS[v.purposeKind] : v.purposeLabel),
              sor(CERT_FORM_TEXTS.summaryRows.user, v.userName),
              sor(CERT_FORM_TEXTS.summaryRows.neededBy, v.neededBy ? datumEvvel(v.neededBy) : null),
              sor(CERT_FORM_TEXTS.summaryRows.paper, v.paperCopy ? 'Igen, postán is' : null),
              sor(CERT_FORM_TEXTS.summaryRows.english, v.englishRequested ? 'Kérted (a NAV csak magyarul adja ki)' : null),
              sor('Díja', v.feeHuf > 0 ? `${szam(v.feeHuf)} Ft` : 'Benne van a havidíjban'),
            ]}
          </Lap>
          {v.canCancel ? (
            <Lap style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              {biztos ? (
                <View style={{ gap: 10 }}>
                  <T m={15.5} s={600} lh={1.45}>
                    {fillPlaceholders(CERT_FORM_TEXTS.cancelAsk, { firstName: fn })}
                  </T>
                  <GombM
                    cim={CERT_FORM_TEXTS.cancel}
                    tolt={visszavon.isPending}
                    onPress={async () => {
                      try {
                        await visszavon.mutateAsync(v.id);
                        jelez({ szoveg: 'Visszavontad.', kesz: true });
                        setBiztos(false);
                      } catch (e) {
                        jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
                      }
                    }}
                  />
                  <GombSz cim="Mégsem" onPress={() => setBiztos(false)} />
                </View>
              ) : (
                <GombSz cim={CERT_FORM_TEXTS.cancel} veszely onPress={() => setBiztos(true)} />
              )}
            </Lap>
          ) : null}
        </>
      )}
    </Kepernyo>
  );
}
