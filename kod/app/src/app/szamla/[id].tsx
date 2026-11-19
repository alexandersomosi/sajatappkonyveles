// Egy kiállított számla a NAV Online Számlából (FUNKCIOK 12): vevő, dátumok, tételek, összeg; demóban MINTA.
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { K, useMe, useNavSzamla } from '@/api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import type { ClientHome } from '@/_shared/api';
import { TartalekBlokk } from '@/kepernyok/k28';
import { datum, datumEvvel, szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { GombM, Lap, Osszeg, Szakasz } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

const MOD: Record<string, string> = { TRANSFER: 'átutalás', CASH: 'készpénz', CARD: 'bankkártya', VOUCHER: 'utalvány', OTHER: 'egyéb' };

function Sor2({ cim, ertek, elso }: { cim: string; ertek: React.ReactNode; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 12, marginHorizontal: 16, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      {/* A leírás tördelődik, az összeg soha nem csonkolódik (egy levágott összeg félrevezető). */}
      <T m={15} c={szin.halvany} lh={1.4} style={{ flex: 1, minWidth: 0 }}>
        {cim}
      </T>
      {typeof ertek === 'string' ? (
        <T m={15.5} jobb lh={1.4} style={{ flexShrink: 1, maxWidth: '62%' }}>
          {ertek}
        </T>
      ) : (
        <View style={{ flexShrink: 0 }}>{ertek}</View>
      )}
    </View>
  );
}

function SzamlaTartalom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useNavSzamla(id);
  const home = useQueryClient().getQueryData<ClientHome>(K.home);
  const me = useMe();
  // opened from a notification the home may not be cached: the accountant's name comes from /me (never "a könyvelőd")
  const fn = home?.accountant.firstName ?? me.data?.accountant?.firstName ?? 'a könyvelőd';
  // a backend a lista-mezők mellé `invoice`-ban adja a normalizált számlát (SPEC §24); a MINTA laposan
  const nyers = q.data as (typeof q.data & { invoice?: Record<string, unknown> }) | undefined;
  const s = nyers ? ({ ...nyers, ...(nyers.invoice ?? {}), id: nyers.id, demo: nyers.demo ?? (nyers.invoice as { source?: string } | undefined)?.source === 'DEMO' } as NonNullable<typeof q.data>) : undefined;
  // The same buyer label as the list, /felretesz and the notification: the parsed invoice's name, else the stored
  // customerName (demo rows have no parsed XML); "Magánszemély" only for a private buyer or no name (k6c review).
  const lapos = nyers as { customerName?: string | null; customerVatStatus?: string | null; payerKind?: string | null } | undefined;
  const magan = lapos?.customerVatStatus === 'PRIVATE_PERSON' || lapos?.payerKind === 'maganszemely';
  const vevo = s?.customer?.name?.trim() || (!magan ? lapos?.customerName?.trim() : '') || 'Magánszemély';
  return (
    <Kepernyo ful="dosszie" fejlec={<CimSor visszaCim="Vissza a számlákhoz" vissza={() => vissza('/dosszie')} cim={s?.invoiceNumber ?? 'Számla'} al={s ? [vevo, s.demo ? 'DEMO, nem valódi számla' : ''].filter(Boolean).join(' · ') : undefined} />}>
      {q.isLoading ? <Betolt /> : q.error || !s ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : (
        <>
          {/* SPEC §28.1.5: az első blokk: mennyit tegyél félre ebből a számlából */}
          {s.reserve ? <TartalekBlokk r={s.reserve} haviFix={home?.reserve?.fixedMonthlyHuf ?? null} fn={fn} /> : null}
          <Szakasz ikon="szamlak" cim="A számla" />
          <Lap>
            <Sor2 elso cim="Összeg" ertek={<Osszeg szoveg={szam(s.grossAmountHuf)} m={18} />} />
            <Sor2 cim="Kelt" ertek={datumEvvel(s.issueDate)} />
            {s.deliveryDate ? <Sor2 cim="Teljesítés" ertek={datumEvvel(s.deliveryDate)} /> : null}
            {s.paymentDate ? <Sor2 cim="Fizetési határidő" ertek={datumEvvel(s.paymentDate)} /> : null}
            {s.paymentMethod ? <Sor2 cim="Fizetés módja" ertek={MOD[s.paymentMethod] ?? s.paymentMethod} /> : null}
            {s.vatExemption ? <Sor2 cim="ÁFA" ertek={`mentes (${s.vatExemption.reason.toLowerCase()})`} /> : null}
            {s.customer?.taxNumber ? <Sor2 cim="Vevő adószáma" ertek={s.customer?.taxNumber ?? ''} /> : null}
            {s.receivedOn ? <Sor2 cim="Bevételként számít" ertek={`${datum(s.receivedOn)}${s.receivedOnEstimated ? ' (becsült)' : ''}`} /> : null}
          </Lap>
          <Szakasz ikon="irat" cim="Tételek" />
          <Lap>
            {(s.lines ?? []).map((l, i) => (
              <Sor2 key={l.lineNo} elso={i === 0} cim={`${l.description ?? 'Tétel'}${l.quantity ? `, ${l.quantity} ${l.unit ?? ''}` : ''}`} ertek={<Osszeg szoveg={szam(l.netAmountHuf)} m={16} />} />
            ))}
          </Lap>
          <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 12 }}>
            Az átalányadózásban a bevétel akkor számít, amikor a pénz megérkezett. Ezt a könyvelőd a bankszámlakivonatod alapján nézi meg.
          </T>
          <GombM cim="Kérdezek róla" ikon="kerdezek" onPress={() => router.push({ pathname: '/uzenetek', params: { kerdes: `${s.invoiceNumber} számla: ` } })} style={{ marginTop: 14 }} />
        </>
      )}
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Szamla() {
  return (
    <ZaroltKapu feature="nav_szamlak" ful="dosszie" cim="Számla">
      <SzamlaTartalom />
    </ZaroltKapu>
  );
}
