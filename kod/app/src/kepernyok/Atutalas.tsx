// k8 ALAP-B – bank transfer pieces in the CURRENT style (FELÜLET-A brings them to v2 later):
//  - UtalasiAdatok: the transfer details of an open díjbekérő with "Másolom" buttons (copy verified, lib/vagolap);
//  - AtutalasValaszto: "Hogyan fizetnél?" card / transfer on the Bekötés → Előfizetés step;
//  - AtutalasFiok: Fiók → Előfizetés: the payment method, the open díjbekérők, the switch card ↔ transfer.
// Texts: shared/k8 TRANSFER_TEXTS (content k8.ui.*). No time promise; the amounts come from the server.
import { useState } from 'react';
import { View } from 'react-native';
import { BILLING_METHOD_LABELS, TRANSFER_TEXTS as X, type ClientBillingView, type TransferRequestView } from '@/_shared/k8';
import { useAtutalasValasztas, useSzamlazas } from '@/api/hooks-k8';
import { fajlMegnyit } from '@/lib/fajlok';
import { datumEvvel, szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { MASOLAS_HIBA, vagolapra } from '@/lib/vagolap';
import { szin } from '@/theme/tokens';
import { Cimke, GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz, Valaszto } from '@/ui/alap';
import { useJelzes, Kartyak } from '@/ui/keret';
import { T } from '@/ui/T';

export type FizetesMod = 'kartya' | 'atutalas';

function Masolhato({ cim, ertek, masolhato, elso }: { cim: string; ertek: string; masolhato?: boolean; elso?: boolean }) {
  const jelez = useJelzes();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <View style={{ flex: 1 }}>
        <T m={14.5} c={szin.halvany}>
          {cim}
        </T>
        <T m={16.5} s={650} szam selectable>
          {ertek}
        </T>
      </View>
      {masolhato ? (
        <GombM
          cim={X.copy}
          accessibilityLabel={`${cim} másolása`}
          onPress={() => void vagolapra(ertek.replace(/\s/g, cim === X.accountNo ? '' : ' ')).then((ok) => jelez(ok ? X.copied : MASOLAS_HIBA))}
        />
      ) : null}
    </View>
  );
}

/** The transfer details of one open díjbekérő. */
export function UtalasiAdatok({ d, mod }: { d: TransferRequestView; mod: ClientBillingView['kozlemenyMode'] }) {
  const jelez = useJelzes();
  if (!d.payTo) return null;
  const k = d.payTo;
  return (
    <View>
      <Masolhato elso cim={X.beneficiary} ertek={k.beneficiary} />
      <Masolhato cim={X.accountNo} ertek={k.accountNo} masolhato />
      <Masolhato cim={X.kozlemeny} ertek={k.kozlemeny} masolhato />
      <Masolhato cim={X.amount} ertek={`${szam(k.amountHuf)} Ft`} />
      <Masolhato cim={X.dueOn} ertek={datumEvvel(k.dueOn)} />
      <T m={14.5} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
        {X.kozlemenyHint} {mod === 'allando' ? X.standingHint : X.monthlyMemoHint}
      </T>
      {d.pdfFileId ? (
        <GombSz
          cim={X.downloadProforma}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
          onPress={() => fajlMegnyit(d.pdfFileId!, `dijbekero-${d.proformaNumber ?? d.orderNo}.pdf`).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült megnyitni. Próbáld újra.')))}
        />
      ) : null}
    </View>
  );
}

/** Bekötés: "Hogyan fizetnél?" – only when the server offers the transfer (switch ON). */
export function AtutalasValaszto({ mod, valt }: { mod: FizetesMod; valt: (m: FizetesMod) => void }) {
  return (
    <Kartyak>
      <Szakasz ikon="szamlaszam" cim={X.choiceTitle} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Valaszto<FizetesMod>
          elemek={[
            { kulcs: 'kartya', cim: X.cardTitle, al: X.cardText },
            { kulcs: 'atutalas', cim: X.transferTitle, al: X.transferText },
          ]}
          ertek={mod}
          valt={valt}
        />
      </Lap>
    </Kartyak>
  );
}

/** Bekötés, transfer chosen: how it works, then "Átutalással fizetek" → the first díjbekérő and its details. */
export function AtutalasBekotes({ v, kesz }: { v: ClientBillingView | undefined; kesz?: () => void }) {
  const valaszt = useAtutalasValasztas();
  const [hiba, setHiba] = useState<string | null>(null);
  const nyitott = v?.open.find((x) => x.kind === 'elso_havi') ?? null;
  if (nyitott) {
    return (
      <Kartyak>
        <Szakasz ikon="szamlaszam" cim={nyitott.status === 'kesik' ? X.lateTitle : X.waitingTitle} />
        <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <T m={15.5} lh={1.45} style={{ marginBottom: 6 }}>
            {nyitott.status === 'kesik' ? X.lateText : X.waitingText}
          </T>
          <UtalasiAdatok d={nyitott} mod={v!.kozlemenyMode} />
          {kesz ? <GombM cim="Tovább" onPress={kesz} style={{ marginTop: 12, alignSelf: 'flex-start' }} /> : null}
        </Lap>
      </Kartyak>
    );
  }
  return (
    <Kartyak>
      <Szakasz ikon="szamlaszam" cim={X.howTitle} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {[X.how1, X.how2, X.how3, X.firstStarts].map((s) => (
          <T key={s} m={15.5} lh={1.45} style={{ marginTop: 6 }}>
            {s}
          </T>
        ))}
        <GombE
          cim={X.chooseButton}
          tolt={valaszt.isPending}
          style={{ marginTop: 14 }}
          onPress={() =>
            valaszt.mutate(
              { purpose: 'subscribe' },
              { onSuccess: () => setHiba(null), onError: (e) => setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')) },
            )
          }
        />
        <T m={14.5} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
          {X.chooseNote}
        </T>
        <HibaSzoveg szoveg={hiba} />
      </Lap>
    </Kartyak>
  );
}

/** Fiók → Előfizetés: the method, the open díjbekérők, the switch. `kartyara` opens the existing card sheet. */
export function AtutalasFiok({ kartyara }: { kartyara: () => void }) {
  const q = useSzamlazas();
  const valaszt = useAtutalasValasztas();
  const jelez = useJelzes();
  const [hiba, setHiba] = useState<string | null>(null);
  const v = q.data;
  if (!v || (v.method === 'kartya' && !v.canSwitchToTransfer)) return null;
  return (
    <Kartyak>
      <Szakasz ikon="szamlaszam" cim={X.methodLabel} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <T m={16} s={600}>
          {BILLING_METHOD_LABELS[v.method].charAt(0).toUpperCase() + BILLING_METHOD_LABELS[v.method].slice(1)}
        </T>
        {v.method === 'atutalas' ? (
          <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 4 }}>
            {X.how1} {X.how2} {X.how3}
          </T>
        ) : null}
        {v.nextIssueOn ? (
          <T m={15} lh={1.45} style={{ marginTop: 6 }}>
            {X.nextIssue}: {datumEvvel(v.nextIssueOn)}, {szam(v.monthlyHuf)} Ft
          </T>
        ) : null}
        {v.open.map((d) => (
          <View key={d.id} style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <T m={16} s={650}>
                {d.period ? `${datumEvvel(d.period.start)} –` : 'Első havidíj'}
              </T>
              <Cimke szoveg={d.statusLabel} veszely={d.status === 'kesik'} />
            </View>
            <UtalasiAdatok d={d} mod={v.kozlemenyMode} />
          </View>
        ))}
        {v.method === 'atutalas' ? (
          v.canSwitchToCard ? (
            <GombM cim={X.switchToCard} onPress={kartyara} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
          ) : (
            <T m={14.5} c={szin.halvany} lh={1.45} style={{ marginTop: 12 }}>
              {X.switchToCardBlocked}
            </T>
          )
        ) : (
          <>
            <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 4 }}>
              {X.switchToTransferNote}
            </T>
            <GombM
              cim={X.switchToTransfer}
              tolt={valaszt.isPending}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
              onPress={() =>
                valaszt.mutate(
                  { purpose: 'switch' },
                  { onSuccess: () => (setHiba(null), jelez(X.switchedToTransfer)), onError: (e) => setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')) },
                )
              }
            />
          </>
        )}
        <HibaSzoveg szoveg={hiba} />
      </Lap>
    </Kartyak>
  );
}
