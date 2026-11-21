// 04 Dosszié / 11 Üres dosszié (FUNKCIOK 12–15): hónapváltó a sávon (e hónap, előző, Korábbiak), összefoglaló cím,
// a könyvelő átnézése, „Amit te küldtél”, „Kiállított számlák” (SPEC §27.5), „Levelek a NAV-tól”, „{firstName} beadta”;
// üres hónapnál az üres mappa.
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { DossierView } from '@/_shared/api';
import { fillPlaceholders, INVOICE_WORDING } from '@/_shared/bekotes';
import { MiEz } from '@/ui/Magyarazat';
import { useDosszie, useDossziek, useHome } from '@/api/hooks';
import { honapCim, honapEltol, honapMelleknev, honapNev, mikor, mikorIdovel, szam } from '@/lib/format';
import { forma, szin } from '@/theme/tokens';
import { KetOszlop } from '@/ui/asztali/Racs';
import { Csempe } from '@/_shared/v2/rn';
import { Allapot, Fejlec, GombE, GombM, Lap, Sor, Szakasz, Szegmens } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { Arckep, Ikon3d, TalajArnyek } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';


function UresHonap({ v, fn }: { v: DossierView; fn: string }) {
  return (
    <>
      <Lap style={{ paddingTop: 18, paddingHorizontal: 22, paddingBottom: 20, alignItems: 'center' }}>
        {/* v2: üres állapot (.ures-allapot) – nagy semleges csempe a mappa-ikonnal */}
        <Csempe nev="dosszie" meret="nagy" style={{ marginBottom: 14 }} />
        <T m={22} s={700} lh={1.25} ls={-0.02} kozep>
          Fotózd le az első iratot
        </T>
        <T m={16} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6, marginBottom: 18, maxWidth: 300 }}>
          Számlát vagy nyugtát, amit kaptál vagy adtál. {fn} ebből könyvel.
        </T>
        <GombE cim="Fotózás" onPress={() => router.push('/fotozas')} style={{ alignSelf: 'stretch', marginBottom: 10 }} />
        <GombM cim="Fájl feltöltése" ikon="feltoltes" magas={52} onPress={() => router.push({ pathname: '/feltoltes', params: { honap: v.month } })} style={{ alignSelf: 'stretch' }} />
      </Lap>
      <Lap style={{ marginTop: 12 }}>
        <Sor elso ikon="szamlak" cim={INVOICE_WORDING.sectionTitle} al={INVOICE_WORDING.short} jobbra={<MiEz kulcs="kiallitott_szamlak" />} />
        <Sor ikon="nyugta" cim="Pénztárgéppel adsz nyugtát?" al="Elég a havi összesítőt lefotóznod a hónap végén." />
      </Lap>
    </>
  );
}

function HonapNezet({ honap }: { honap: string }) {
  const q = useDosszie(honap);
  const home = useHome();
  if (q.isLoading) return <Betolt />;
  if (q.error || !q.data) return <Hiba hiba={q.error} ujra={() => void q.refetch()} />;
  const v = q.data;
  const fn = v.review?.by.firstName ?? home.data?.accountant.firstName ?? 'A könyvelőd';
  const nap = ma();
  const szerzodesek = v.contracts ?? [];
  const ures = !v.sentByMe.length && !v.fromNav.invoices.count && !v.fromNav.letters.length && !v.filedByAccountant.length && !szerzodesek.length;
  if (ures) return <UresHonap v={v} fn={fn} />;
  const keres = v.openRequests[0];
  // gépen (A60): balra a könyvelő összegzése és kérése, jobbra a hónap iratai
  return (
    <KetOszlop
      aranyBal={5}
      aranyJobb={7}
      bal={
      v.review || keres ? (
        <Lap style={{ paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 }}>
          {v.review ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Arckep pt={44} gyuru />
                <View style={{ flex: 1 }}>
                  <T m={16} s={650} lh={1.3}>
                    {fn} átnézte az iratokat
                  </T>
                  <T m={14.5} c={szin.halvany} lh={1.35}>
                    {mikorIdovel(v.review.at, nap)}
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 12 }}>
                <T m={40} s={800} lh={1} ls={-0.035} szam>
                  {v.review.okCount}
                </T>
                <T m={17} s={600}>
                  irat rendben
                </T>
              </View>
              {v.review.note ? (
                <T m={15.5} lh={1.45} style={{ marginTop: 6 }}>
                  {v.review.note}
                </T>
              ) : null}
            </>
          ) : null}
          {keres ? (
            <View style={v.review ? { borderTopWidth: 1, borderTopColor: szin.hajszal, marginTop: 16, paddingTop: 14 } : undefined}>
              <T m={16.5} s={650} lh={1.4}>
                {keres.title.replace(/^Töltsd fel/, 'Kéri')}
              </T>
              <T m={15} c={szin.halvany} lh={1.5} style={{ marginTop: 2, marginBottom: 12 }}>
                {keres.body.replace(/, a befizetendő összeg nem változik/, '')}
              </T>
              <GombM
                cim={/kivonat/i.test(keres.title) ? 'Kivonat feltöltése' : 'Feltöltöm'}
                ikon="feltoltes"
                onPress={() => router.push({ pathname: '/feltoltes', params: { keres: keres.id, kategoria: /kivonat/i.test(keres.title) ? 'bankszamlakivonat' : 'egyeb', honap: keres.dossierMonth ?? honap } })}
              />
            </View>
          ) : null}
        </Lap>
      ) : null
      }
      jobb={
    <>
      <Szakasz cim="Amit te küldtél" />
      <Lap>
        {v.sentByMe.map((d, i) => (
          <Sor
            key={d.id}
            elso={i === 0}
            ikon={d.icon}
            kesz={d.status === 'feldolgozva' || d.status === 'beadva'}
            cim={d.title}
            al={<Allapot szo={d.statusLabel} utana={mikor(d.statusAt, nap)} />}
            onPress={() => router.push(`/tetel/${d.id}`)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/feltoltes', params: { honap } })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: v.sentByMe.length ? 4 : 12, marginHorizontal: 12, marginBottom: 12, height: 52, borderRadius: forma.mezo, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#A8B2DB', backgroundColor: pressed ? '#F4F7FC' : 'transparent' })}
        >
          <Ikon3d nev="feltoltes" pt={26} />
          <T m={16} s={600} c={szin.kek}>
            Fájl hozzáadása
          </T>
        </Pressable>
      </Lap>

      {/* SPEC §27.5: „Kiállított számlák” – a fejlécsor az egy rövid mondat + „Mi ez?” (kiallitott_szamlak). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 30, paddingBottom: 10, paddingHorizontal: 4 }}>
        <View style={{ flex: 1 }}>
          <T m={19.5} s={600} lh={1.25} ls={-0.016} accessibilityRole="header">
            {INVOICE_WORDING.sectionTitle}
          </T>
          <T m={14.5} lh={1.4} c={szin.halvanyAlapon} style={{ marginTop: 5 }}>
            {INVOICE_WORDING.short}
          </T>
        </View>
        <MiEz kulcs="kiallitott_szamlak" />
      </View>
      <Lap>
        {v.fromNav.invoices.count ? (
          <Sor
            elso
            ikon="szamlak"
            kesz={v.fromNav.invoices.status === 'feldolgozva' || v.fromNav.invoices.status === 'beadva'}
            cim={fillPlaceholders(INVOICE_WORDING.countPart, { n: String(v.fromNav.invoices.count) })}
            al={<Allapot szo={v.fromNav.invoices.statusLabel} utana={v.fromNav.invoices.statusAt ? mikor(v.fromNav.invoices.statusAt, nap) : `${szam(v.fromNav.invoices.totalHuf)} Ft`} />}
            onPress={() => router.push(`/dosszie/${honap}/szamlak`)}
          />
        ) : (
          <View style={{ padding: 16 }}>
            <T m={15} lh={1.45} c={szin.halvany}>
              {INVOICE_WORDING.monthEmpty}
            </T>
          </View>
        )}
      </Lap>

      {v.fromNav.letters.length ? (
        <>
          <Szakasz cim="Levelek a NAV-tól" megj="Amit a NAV küldött neked. Ezeket nem kell feltöltened." />
          <Lap>
            {v.fromNav.letters.map((d, i) => (
              <Sor
                key={d.id}
                elso={i === 0}
                ikon="boritek"
                kesz={d.status === 'feldolgozva' || d.status === 'beadva'}
                cim={d.title}
                al={<Allapot szo={d.statusLabel} utana={d.status === 'feldolgozva' ? 'nincs teendőd' : mikor(d.statusAt, nap)} />}
                onPress={() => router.push(`/tetel/${d.id}`)}
              />
            ))}
          </Lap>
        </>
      ) : null}

      {szerzodesek.length ? (
        <>
          <Szakasz cim="Szerződéseid" megj="Az elfogadott szerződés PDF-ben. A NAV-hoz nem kell beadni." />
          <Lap>
            {szerzodesek.map((d, i) => (
              <Sor key={d.id} elso={i === 0} ikon={d.icon} cim={d.title} al="PDF, megnyithatod és letöltheted" onPress={() => router.push(`/tetel/${d.id}`)} />
            ))}
          </Lap>
        </>
      ) : null}

      {v.filedByAccountant.length ? (
        <>
          <Szakasz cim={`${fn} beadta`} />
          <Lap>
            {v.filedByAccountant.map((d, i) => (
              <Sor key={d.id} elso={i === 0} ikon="bevallas" kesz cim={d.title} al={<Allapot szo={d.statusLabel} utana={mikor(d.statusAt, nap)} />} onPress={() => router.push(`/tetel/${d.id}`)} />
            ))}
          </Lap>
        </>
      ) : null}
    </>
      }
    />
  );
}

/** "2 irat és 4 kiállított számla, mind rendben" – a letöltött kiállított számlák is számítanak (nem „Üres”). */
function honapOsszegzes(m: { documentCount: number; waitingCount: number; navInvoiceCount: number }): string {
  const reszek: string[] = [];
  if (m.documentCount) reszek.push(`${m.documentCount} irat`);
  if (m.navInvoiceCount) reszek.push(fillPlaceholders(INVOICE_WORDING.countPart, { n: String(m.navInvoiceCount) }));
  if (!reszek.length) return 'Üres';
  return `${reszek.join(' és ')}${m.waitingCount ? `, ebből ${m.waitingCount} még vár` : m.documentCount ? ', mind rendben' : ''}`;
}

function Korabbiak({ valaszt }: { valaszt: (h: string) => void }) {
  const ev = Number(ma().slice(0, 4));
  const idei = useDossziek(ev);
  const tavalyi = useDossziek(ev - 1);
  const honapok = [...(idei.data?.months ?? []), ...(tavalyi.data?.months ?? [])].slice(2);
  if (idei.isLoading) return <Betolt />;
  return (
    <Lap>
      {honapok.length ? (
        honapok.map((m, i) => (
          <Sor
            key={m.month}
            elso={i === 0}
            ikon="dosszie"
            cim={honapCim(m.month, ev)}
            al={honapOsszegzes(m)}
            kesz={m.documentCount + m.navInvoiceCount > 0 && m.waitingCount === 0}
            onPress={() => valaszt(m.month)}
          />
        ))
      ) : (
        <T m={15.5} c={szin.halvany} style={{ padding: 18 }}>
          Korábbi hónap még nincs.
        </T>
      )}
    </Lap>
  );
}

function DosszieTartalom() {
  const p = useLocalSearchParams<{ honap?: string }>();
  const most = ma().slice(0, 7);
  const [honap, setHonap] = useState<string>(p.honap && /^\d{4}-\d{2}$|^korabbiak$/.test(p.honap) ? p.honap : most);
  useEffect(() => {
    if (p.honap && /^\d{4}-\d{2}$/.test(p.honap)) setHonap(p.honap);
  }, [p.honap]);
  const szegmensHonap = honap === 'korabbiak' || honap === most || honap === honapEltol(most, -1) ? most : honapEltol(honap, 1);
  const elemek = useMemo(
    () => [
      { kulcs: szegmensHonap, cim: honapNev(szegmensHonap) },
      { kulcs: honapEltol(szegmensHonap, -1), cim: honapNev(honapEltol(szegmensHonap, -1)) },
      { kulcs: 'korabbiak', cim: 'Korábbiak' },
    ],
    [szegmensHonap],
  );
  const v = useDosszie(honap !== 'korabbiak' ? honap : undefined);
  const cim =
    honap === 'korabbiak' ? 'Korábbi hónapok' : v.data?.headline ?? `${honapNev(honap)} dosszié`;

  return (
    <Kepernyo
      ful="dosszie"
      szeles
      fejlec={
        <Fejlec alsoTer={22}>
          <T m={27} s={800} lh={1.14} ls={-0.025} c="#fff" style={{ paddingTop: 10, paddingHorizontal: 18 }} accessibilityRole="header">
            {cim}
          </T>
          <Szegmens elemek={elemek} aktiv={honap} valt={setHonap} />
        </Fejlec>
      }
    >
      {honap === 'korabbiak' ? <Korabbiak valaszt={setHonap} /> : <HonapNezet honap={honap} />}
      {honap !== 'korabbiak' && honap !== most ? (
        <T m={14} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 14, paddingHorizontal: 4 }}>
          Ez a{honapMelleknev(honap).match(/^[aáeéiíoóöőuúüű]/) ? 'z' : ''} {honapMelleknev(honap)} dosszié. Új iratot bármelyik hónaphoz feltölthetsz.
        </T>
      ) : null}
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Dosszie() {
  return (
    <ZaroltKapu feature="dosszie" ful="dosszie" cim="Dosszié">
      <DosszieTartalom />
    </ZaroltKapu>
  );
}
