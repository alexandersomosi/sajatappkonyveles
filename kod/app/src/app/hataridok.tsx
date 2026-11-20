// Határidő-naptár (FUNKCIOK 18): hónapok szerint (befizetés, bevallás, kérés, időpont), borostyán „még N nap”
// címkével; mindegyik naptárba tehető (Google / Apple / Outlook), és az egész naptár feliratkozható (SPEC §29.8). Üresen: tépőnaptár.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useHataridok, useHome } from '@/api/hooks';
import { CALENDAR_TEXTS } from '@/_shared/k29f';
import { NaptarSzakasz, SorNaptarLap } from '@/kepernyok/k29f';
import { hatraVan, honapCim, reszek, szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Cimke, GombM, Lap, Szakasz } from '@/ui/alap';
import { Ikon3d, KeszJel, Targykep, type Ikon3dNev } from '@/ui/kepek';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

const IKON: Record<string, Ikon3dNev> = { befizetes: 'szamlaszam', bevallas: 'bevallas', keres: 'feltoltes', idopont: 'hataridok', egyeb: 'ertesites' };

function HataridokTartalom() {
  const q = useHataridok();
  const home = useHome();
  const fn = home.data?.accountant.firstName ?? 'a könyvelőd';
  // SPEC §29.8 F4: a sor „Naptárba” lapja (Google / Apple / Outlook)
  const [naptarId, setNaptarId] = useState<string | null>(null);
  // SPEC §26.2.9: az időpont-határidők (régi foglalások) már nem látszanak.
  const lista = [...(q.data?.items ?? [])].filter((d) => d.kind !== 'idopont').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const csoport = new Map<string, typeof lista>();
  for (const d of lista) {
    const k = d.dueDate.slice(0, 7);
    csoport.set(k, [...(csoport.get(k) ?? []), d]);
  }
  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/')} cim="Határidők" al="Előtte mindig szólunk: értesítésben és e-mailben is." />}>
      <NaptarSzakasz />
      {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : !lista.length ? (
        <Lap style={{ padding: 18, alignItems: 'center' }}>
          <Targykep nev="hatarido_naptar" style={{ marginBottom: 8 }} />
          <T m={17} s={650} kozep>
            Most nincs közeli határidőd.
          </T>
        </Lap>
      ) : (
        [...csoport.entries()].map(([ho, elemek], gi) => (
          <View key={ho}>
            <Szakasz cim={honapCim(ho, lista[0].dueDate.slice(0, 4))} style={gi === 0 ? { paddingTop: 6 } : undefined} />
            <Lap kotott>
              {elemek.map((d, i) => {
                const r = reszek(d.dueDate);
                // A befizetést a kliens jelezte, de a könyvelő még nem ellenőrizte: nem „Kész”, csak semleges állapot.
                const ellenorzesre = d.status === 'kesz' && d.kind === 'befizetes' && d.verified === false;
                const kesz = d.status === 'kesz' && !ellenorzesre;
                return (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    onPress={() => (d.link && d.link !== '/hataridok' ? router.push(d.link as never) : undefined)}
                    style={({ pressed }) => [{ flexDirection: 'row', gap: 13, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, alignItems: 'flex-start' }, pressed && { backgroundColor: '#F6F8FB' }]}
                  >
                    {i > 0 ? <View style={{ position: 'absolute', top: 0, left: 73, right: 0, height: 1, backgroundColor: szin.hajszal }} /> : null}
                    <View style={{ width: 44, alignItems: 'center' }}>
                      <T m={22} s={800} lh={1.1} ls={-0.03} szam c={kesz ? szin.halvany : szin.tinta}>
                        {r.nap}
                      </T>
                      <T m={12} s={600} c={szin.halvany}>
                        {['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'][r.hetnap]}
                      </T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ikon3d nev={IKON[d.kind] ?? 'hataridok'} pt={24} />
                        <T m={16} s={500} lh={1.35} c={kesz ? szin.halvany : szin.tinta} style={{ flex: 1 }}>
                          {d.title}
                        </T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                        {kesz ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <KeszJel pt={19} />
                            <T m={14.5} s={650}>
                              Kész
                            </T>
                          </View>
                        ) : ellenorzesre ? (
                          <T m={14.5} s={650}>
                            Befizetted, {fn} ellenőrzi
                          </T>
                        ) : d.status === 'lejart' ? (
                          <T m={14.5} s={650} c={szin.veszely}>
                            Lejárt
                          </T>
                        ) : d.daysLeft <= 7 ? (
                          <Cimke szoveg={hatraVan(d.daysLeft)} style={{ alignSelf: 'auto' }} />
                        ) : (
                          <T m={14.5} s={600} c={szin.halvany}>
                            {hatraVan(d.daysLeft)}
                          </T>
                        )}
                        {d.amountHuf ? (
                          <T m={14.5} c={szin.halvany} szam>
                            {/* k3_kor2 nyelv 11.5: „kb.” mellett nem forintra pontos összeg, hanem ezresre kerekítve */}
                            {d.kind === 'befizetes' && !kesz && !ellenorzesre && d.estimate !== false ? `kb. ${szam(Math.round(d.amountHuf / 1000) * 1000)}` : szam(d.amountHuf)} Ft
                          </T>
                        ) : null}
                      </View>
                      {!kesz && !ellenorzesre ? (
                        <GombM cim={CALENDAR_TEXTS.rowButton} ikon="hataridok" magas={36} style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => setNaptarId(d.id)} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </Lap>
          </View>
        ))
      )}
      <SorNaptarLap id={naptarId} lathato={Boolean(naptarId)} bezar={() => setNaptarId(null)} />
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Hataridok() {
  return (
    <ZaroltKapu feature="hataridok" ful="fooldal" cim="Határidők">
      <HataridokTartalom />
    </ZaroltKapu>
  );
}
