// SPEC §28.1.6 – „Ennyit tegyél félre”: fent a kék sávban a nagy mondat és a magyarázat, alatta hónaponként (a legújabb
// elöl) a kiállított számláid: vevő · számlaszám, jobbra az összeg, alatta mennyit tegyél félre. A számla a részletre visz.
import { Fragment } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { fillPlaceholders, RESERVE_TEXTS } from '@/_shared/bekotes';
import { useFelretesz, useMe } from '@/api/hooks';
import { maiNap, nagybetu, szam } from '@/lib/format';
import { SavFej, TartalekAlsor } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { Lap, Osszeg, Sor, Szakasz } from '@/ui/alap';
import { Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { Elakadtal } from '@/ui/Visszahivas';
import { ZaroltKapu } from '@/ui/Zarolt';

function FelreteszTartalom() {
  const ev = Number(maiNap().slice(0, 4));
  const q = useFelretesz(ev);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const v = q.data;
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<SavFej vissza={() => vissza('/')} ikon="szamlaszam" cim={RESERVE_TEXTS.kepernyo.title} nagy={v?.card.sentence ?? null} mondat={v ? (v.card.keepNowHuf > 0 ? v.card.detail : RESERVE_TEXTS.kartya.detailZero) : null} />}
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !v ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          {!v.months.length ? (
            <Lap style={{ padding: 16 }}>
              <T m={16} lh={1.45}>
                {RESERVE_TEXTS.kepernyo.empty}
              </T>
            </Lap>
          ) : null}
          {v.totalText ? (
            // k6c2: the same number as the Főoldal row "Az idei számláid után" (= the month sums below)
            <Lap style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <T m={16} s={600} lh={1.4} szam>
                {v.totalText}
              </T>
              {v.card.invoicesSub ? (
                <T m={14} lh={1.4} c={szin.halvany}>
                  {v.card.invoicesSub}
                </T>
              ) : null}
            </Lap>
          ) : null}
          {v.months.map((m) => (
            <Fragment key={m.month}>
              <Szakasz ikon="szamlak" cim={nagybetu(m.label)} megj={m.sub ?? `${m.items.length} tétel · félretenni kb. ${szam(m.items.reduce((a, b) => a + (b.upcoming ? 0 : Math.max(0, b.reserve.reserveHuf)), 0))} Ft`} />
              <Lap kotott>
                {m.items.map((x, i) => (
                  <Sor
                    key={x.revenueItemId}
                    elso={i === 0}
                    cim={x.title}
                    al={
                      <>
                        <T m={15} lh={1.4} c={szin.halvany}>
                          {x.sub}
                        </T>
                        <TartalekAlsor r={x.reserve} />
                        {x.upcoming && x.upcomingText ? (
                          <T m={14} lh={1.4} c={szin.borostyanSzoveg}>
                            {x.upcomingText}
                          </T>
                        ) : null}
                      </>
                    }
                    jobbra={<Osszeg szoveg={szam(x.amountHuf)} m={16} />}
                    onPress={x.navInvoiceId ? () => router.push(`/szamla/${x.navInvoiceId}`) : undefined}
                  />
                ))}
              </Lap>
            </Fragment>
          ))}
          <View style={{ paddingTop: 12 }}>
            <T m={13.5} lh={1.4} c={szin.halvany}>
              {fillPlaceholders(RESERVE_TEXTS.kartya.footnote, { firstName: fn })}
            </T>
            <Elakadtal forras="felretesz" tema="ado_befizetes" cim={RESERVE_TEXTS.kepernyo.help} />
          </View>
        </>
      )}
    </Kepernyo>
  );
}

/** SPEC §28.6.3: bekötés alatt zárva (adóadat). */
export default function Felretesz() {
  return (
    <ZaroltKapu feature="felretesz" ful="fooldal" cim={RESERVE_TEXTS.kepernyo.title}>
      <FelreteszTartalom />
    </ZaroltKapu>
  );
}
