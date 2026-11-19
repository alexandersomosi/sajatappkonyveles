// 05 Tétel (FUNKCIOK 14): állapot pipával, előnézet (kép / PDF megnyitása), adatok, „Hol tart” idővonal, a könyvelő
// megjegyzése, „Kérdezek róla”, új változat; törölni csak „Feltöltve” állapotban lehet (utána új változat).
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useHome, useIrat, useIratTorol } from '@/api/hooks';
import { fajlMegnyit } from '@/lib/fajlok';
import { honapMelleknev, mikor, mikorIdovel, szam, teljesIdo } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap, Osszeg, Szakasz } from '@/ui/alap';
import { FajlKep } from '@/ui/FajlKep';
import { ma } from '@/ui/ido';
import { Arckep, Ikon3d, KeszJel } from '@/ui/kepek';
import { AlsoLap, Betolt, Hiba, Kepernyo, Lepessor, useJelzes, vissza, type Lepes } from '@/ui/keret';
import { T } from '@/ui/T';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { hibaUzenet } from '@/lib/hiba';
import { LOCKED_ERROR_CODE } from '@/_shared/enums';
import { ZaroltKepernyo } from '@/ui/Zarolt';

const SORREND = ['feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva'] as const;

function Adat({ cim, children, elso }: { cim: string; children: React.ReactNode; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, paddingVertical: 13, paddingHorizontal: 18, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <T m={15} c={szin.halvany} numberOfLines={1} style={{ flexShrink: 0 }}>
        {cim}
      </T>
      <View style={{ flexShrink: 1 }}>{typeof children === 'string' ? <T m={16} jobb>{children}</T> : children}</View>
    </View>
  );
}

export default function Tetel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useIrat(id);
  const home = useHome();
  const torol = useIratTorol();
  const jelez = useJelzes();
  const ins = useSafeAreaInsets();
  // A törlés megerősítése az app saját alsó lapja (mint a lemondásnál, kártyatörlésnél) – weben sem a böngésző ablaka.
  const [torlesLap, setTorlesLap] = useState(false);
  const d = q.data;
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const visszaCim = d ? `Vissza ${/^[aáeéiíoóöőuúüű]/.test(honapMelleknev(d.dossierMonth)) ? 'az' : 'a'} ${honapMelleknev(d.dossierMonth)} dossziéhoz` : 'Vissza';
  const fej = (
    <View style={{ paddingTop: Platform.OS === 'web' ? 10 : ins.top + 2, paddingHorizontal: 10 }}>
      <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/dosszie', params: d ? { honap: d.dossierMonth } : {} }))} style={{ height: 48, justifyContent: 'center', paddingHorizontal: 10, alignSelf: 'flex-start' }}>
        <T m={16.5} s={500} c={szin.tintakekSzoveg} alahuz>
          {visszaCim}
        </T>
      </Pressable>
    </View>
  );
  if (q.isLoading) return <Kepernyo ful="dosszie" fejlec={fej}><Betolt /></Kepernyo>;
  // Before activation an accountant paper answers 403 locked_until_active: show the locked Dosszié sheet, not a
  // generic error with a pointless "Újra" (SPEC §26.5.3, review k3c2). The client's own uploads still open.
  if (q.error instanceof ApiHiba && q.error.code === LOCKED_ERROR_CODE)
    return (
      <Kepernyo ful="dosszie" fejlec={fej}>
        <ZaroltKepernyo feature="dosszie" />
      </Kepernyo>
    );
  if (q.error || !d) return <Kepernyo ful="dosszie" fejlec={fej}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;

  const nap = ma();
  const kesz = d.status === 'feldolgozva' || d.status === 'beadva';
  const utolsoVerzio = d.versions[d.versions.length - 1];
  // Előnézet: a szerver első oldali képe (thumbFileId). A fotókból készült irat maga PDF, azt <img> nem mutatja;
  // ha nincs előnézeti kép (feltöltött PDF), a „PDF, N oldal – Megnyitom” sor jelenik meg.
  const elonezet = d.thumbFileId ?? null;
  const kep = Boolean(elonezet);
  const elerve = SORREND.indexOf(d.status);
  // Csak a bevallásba kerülő bizonylatok jutnak „Beadva” állapotba (a szerződés, igazolás, NAV-levél nem).
  const bevallasba = ['nyugta', 'penztargep_osszesito', 'bankszamlakivonat', 'koltseg_bizonylat', 'kiallitott_szamla_kezi'].includes(d.category) || d.status === 'beadva';
  const idovonal: Lepes[] = SORREND.filter((s) => s !== 'beadva' || bevallasba).map((s, i) => {
    const h = [...d.history].reverse().find((x) => x.status === s);
    const cim = s === 'konyvelo_latta' ? `${fn} látta` : s === 'feltoltve' ? (d.source === 'nav' ? 'Letöltöttük' : 'Feltöltve') : s === 'feldolgozva' ? 'Feldolgozva' : 'Beadva';
    if (i <= elerve) return { cim, al: h ? teljesIdo(h.at) : undefined, allapot: 'kesz' as const };
    return { cim, al: s === 'beadva' ? 'A negyedéves bevallással, legkésőbb a negyedév utáni hónap 12-éig.' : s === 'feldolgozva' ? `Ha ${fn} beírta a nyilvántartásba.` : `Amikor ${fn} megnyitja.`, allapot: 'var' as const };
  });

  return (
    <Kepernyo ful="dosszie" fejlec={fej} tartalomStilus={{ paddingTop: 0 }}>
      <View style={{ paddingTop: 6, paddingHorizontal: 4, paddingBottom: 16 }}>
        <T m={28} s={700} lh={1.15} ls={-0.025} accessibilityRole="header">
          {d.title}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          {kesz ? <KeszJel pt={23} /> : null}
          <T m={16} c={szin.halvany}>
            <T m={16} s={650}>
              {d.statusLabel}
            </T>
            , {mikorIdovel(d.statusAt, nap)}
          </T>
        </View>
      </View>

      <Lap>
        {utolsoVerzio && elonezet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={utolsoVerzio.pageCount > 1 ? `Megnyitom mind a ${utolsoVerzio.pageCount} oldalt` : 'Megnyitom nagyban'}
            onPress={() => fajlMegnyit(utolsoVerzio.fileId, utolsoVerzio.pageCount > 1 ? `${d.title}.pdf` : `${d.title}.jpg`).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))}
          >
            <FajlKep fileId={elonezet} mod="contain" arany={4 / 3} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#F6F8FB' }}>
              <T m={14.5} c={szin.halvany}>{utolsoVerzio.pageCount > 1 ? `Fotó, ${utolsoVerzio.pageCount} oldal (PDF-be fűzve)` : 'Fotó'}</T>
              <T m={15} s={600} c={szin.tintakekSzoveg} alahuz>
                Megnyitom
              </T>
            </View>
          </Pressable>
        ) : utolsoVerzio ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => fajlMegnyit(utolsoVerzio.fileId, `${d.title}.pdf`).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: '#F6F8FB' }}
          >
            <Ikon3d nev={d.category === 'bevallas' ? 'bevallas' : d.icon} pt={56} />
            <View style={{ flex: 1 }}>
              <T m={16} s={600}>
                PDF, {utolsoVerzio.pageCount} oldal
              </T>
              <T m={15} c={szin.tintakekSzoveg} alahuz>
                Megnyitom
              </T>
            </View>
          </Pressable>
        ) : null}
        {d.amountHuf != null ? (
          <Adat cim="Összeg" elso={!utolsoVerzio}>
            <Osszeg szoveg={szam(d.amountHuf)} m={18} />
          </Adat>
        ) : null}
        {d.relatedRevenueMonth ? <Adat cim="Hová került">{`${/^[aáeéiíoóöőuúüű]/.test(honapMelleknev(d.relatedRevenueMonth)) ? 'az' : 'a'} ${honapMelleknev(d.relatedRevenueMonth)} bevételedhez`}</Adat> : null}
        <Adat cim={d.source === 'ugyfel' ? 'Feltöltötted' : 'Érkezett'}>{`${mikor(d.history[0]?.at ?? d.statusAt, nap)}${kep ? ', fotóként' : ''}, ${d.pageCount} oldal`}</Adat>
        {d.clientNote ? <Adat cim="A te megjegyzésed">{d.clientNote}</Adat> : null}
      </Lap>

      <Szakasz cim="Hol tart" />
      <Lap>
        <Lepessor lepesek={idovonal} meret={22} erosMost={false} />
      </Lap>

      {d.accountantComment ? (
        <>
          <Szakasz cim={`${fn} megjegyzése`} />
          <Lap style={{ padding: 18 }}>
            <T m={16} lh={1.5}>
              {d.accountantComment}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Arckep pt={34} gyuru />
                <View>
                  <T m={14.5} s={650} lh={1.3}>
                    {fn}
                  </T>
                  <T m={14} c={szin.halvany} lh={1.3}>
                    {mikorIdovel(d.statusAt, nap)}
                  </T>
                </View>
              </View>
              <GombM cim="Válaszolok" ikon="kerdezek" magas={52} onPress={() => router.push({ pathname: '/uzenetek', params: { irat: d.id, kerdes: `${d.title}: ` } })} />
            </View>
          </Lap>
        </>
      ) : (
        <GombM cim="Kérdezek róla" ikon="kerdezek" onPress={() => router.push({ pathname: '/uzenetek', params: { irat: d.id, kerdes: `${d.title}: ` } })} style={{ marginTop: 16 }} />
      )}

      {d.source === 'ugyfel' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 10, paddingHorizontal: 4 }}>
          <GombSz cim="Új változatot töltök fel" onPress={() => router.push({ pathname: '/feltoltes', params: { ujVerzio: d.id, kategoria: d.category, honap: d.dossierMonth } })} />
          {d.status === 'feltoltve' ? (
            <GombSz cim="Törlöm" veszely onPress={() => setTorlesLap(true)} />
          ) : null}
        </View>
      ) : null}

      <AlsoLap lathato={torlesLap} bezar={() => setTorlesLap(false)}>
        <View style={{ paddingTop: 8 }}>
          <T m={21} s={650} ls={-0.02} lh={1.25} style={{ paddingRight: 90 }} accessibilityRole="header">
            Törlöd az iratot?
          </T>
          <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 10 }}>
            {fn} még nem látta. A törlést nem lehet visszavonni.
          </T>
          <GombE
            cim="Törlöm"
            tolt={torol.isPending}
            style={{ marginTop: 22, backgroundColor: szin.veszely }}
            onPress={async () => {
              try {
                await torol.mutateAsync(d.id);
                setTorlesLap(false);
                jelez('Törölted az iratot.');
                vissza('/dosszie');
              } catch (e) {
                setTorlesLap(false);
                jelez(hibaUzenet(e, 'Nem sikerült törölni.'));
              }
            }}
          />
          <GombSz cim="Mégse" onPress={() => setTorlesLap(false)} style={{ alignSelf: 'center', marginTop: 8 }} />
        </View>
      </AlsoLap>
    </Kepernyo>
  );
}
