// S17 – „Nézd át, mit jelentünk be” (SPEC §27.3.3/3): mielőtt a könyvelőnk meghatalmazottként beküldi a bejelentést,
// az ügyfél blokkonként átnézi az adatokat (mindegyiknél „Módosítom” → a kérdőív lapja), MAGA teszi meg a nyilatkozatot
// (kizáró okok), és írásban utasít (két pipa). Egy gomb: „Engedélyezem a bejelentést”. A kérdőív bármilyen későbbi
// változása az engedélyt érvényteleníti (a szerver dönt; itt „Módosítottad a kérdőívet, ezért engedélyezd újra”).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ASSIST_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { ApiHiba } from '@/api/http';
import { useEngedelyKuld, useEngedelyOsszegzes } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { segitsegFajta } from '@/lib/ut';
import { SavCim } from '@/kepernyok/Utmutato';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Pipa } from '@/ui/alap';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { T } from '@/ui/T';
import { useUt } from '@/ui/Ut';
import { Elakadtal } from '@/ui/Visszahivas';

export default function Engedely() {
  const { o } = useUt();
  const ev = segitsegFajta(o.data?.assists, 'vallalkozas_bejelentes');
  const q = useEngedelyOsszegzes(ev?.id);
  const kuld = useEngedelyKuld();
  const jelez = useJelzes();
  const [nyilatkozat, setNyilatkozat] = useState(false);
  const [utasitas, setUtasitas] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const fn = o.data?.accountant.firstName ?? 'a könyvelőd';
  const fej = <SavCim vissza={() => vissza('/bekotes')} visszaCim="Vissza a Főoldalra" cim={ASSIST_TEXTS.consentTitle} al={fillPlaceholders(ASSIST_TEXTS.consentSub, { firstName: fn })} />;
  if (o.isLoading || q.isLoading) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;
  if (!ev) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <Lap style={{ padding: 18 }}>
          <T m={17} lh={1.5}>
            Ez akkor kell, ha azt kérted, hogy mi jelentsük be a vállalkozásodat.
          </T>
          <GombM cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 14 }} />
        </Lap>
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  if (!q.data) return <Kepernyo ful="fooldal" fejlec={fej}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;
  const s = q.data;
  const kesz = !!ev.consent?.valid;
  return (
    <Kepernyo ful="fooldal" fejlec={fej}>
      {ev.consent && !ev.consent.valid ? (
        <View style={{ marginBottom: 12, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 14 }}>
          <T m={16} s={650} lh={1.45} c={szin.borostyanSzoveg}>
            {ASSIST_TEXTS.consentStale}
          </T>
        </View>
      ) : null}
      {s.blocks.map((b) => (
        <Lap key={b.key} style={{ padding: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T m={13} s={750} ls={0.06} c={szin.halvany} style={{ flex: 1 }}>
              {b.title.toLocaleUpperCase('hu-HU')}
            </T>
            {b.editRoute && !kesz ? <GombSz cim={ASSIST_TEXTS.consentEdit} m={15} onPress={() => router.push(b.editRoute as never)} style={{ paddingVertical: 4 }} /> : null}
          </View>
          {/* 11-19 javítás: a „nyilvános lesz” mondat egyszer, a borostyán sávban (a PDF-ből is kiszűrjük) */}
          {b.lines
            .filter((l) => !(b.key === 'szekhely' && l === s.publicNote))
            .map((l, i) => (
              <T key={i} m={16.5} lh={1.45} style={{ marginTop: i ? 2 : 4 }}>
                {l}
              </T>
            ))}
          {b.key === 'szekhely' && s.publicNote ? (
            <View style={{ marginTop: 8, borderRadius: forma.cimke, backgroundColor: szin.borostyanAlap, paddingVertical: 6, paddingHorizontal: 10 }}>
              <T m={14.5} s={600} lh={1.4} c={szin.borostyanSzoveg}>
                {s.publicNote}
              </T>
            </View>
          ) : null}
        </Lap>
      ))}
      {kesz ? (
        <Lap style={{ padding: 18 }}>
          <T m={17} s={650} lh={1.45}>
            {fillPlaceholders(ASSIST_TEXTS.consentToast, { firstName: fn })}
          </T>
          <GombM cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 12 }} />
        </Lap>
      ) : !s.canConsent ? (
        <Lap style={{ padding: 18 }}>
          <T m={16.5} lh={1.5}>
            {s.missing.length ? 'Még hiányzik pár válasz a kérdőívből. Ha kitöltöd, itt engedélyezheted a bejelentést.' : 'Előbb megírjuk a tevékenységed sorát. Ha kész, értesítünk, és itt engedélyezheted.'}
          </T>
          {s.missing.length ? <GombM cim="Kitöltöm a kérdőívet" onPress={() => router.push('/bekotes/vallalkozas/adatlap')} style={{ marginTop: 12 }} /> : null}
        </Lap>
      ) : (
        <Lap style={{ padding: 18 }}>
          <Pipa be={nyilatkozat} valt={setNyilatkozat}>
            <T m={16} s={600} lh={1.5}>
              {s.declarationText || ASSIST_TEXTS.consentDeclaration}
            </T>
          </Pipa>
          {/* 11-19 javítás: mi a kizáró ok? – ezt csak ő nyilatkozhatja, ezért elmagyarázzuk */}
          <MiEz kulcs="kizaro_okok" cim="Mik a kizáró okok?" forras="vallalkozas_utmutato" tema="vallalkozas_bejelentes_helyettem" style={{ alignSelf: 'flex-start', marginLeft: 36, marginTop: -4 }} />
          <Pipa be={utasitas} valt={setUtasitas} style={{ marginTop: 6 }}>
            <T m={16} lh={1.5}>
              {s.instructionText}
            </T>
          </Pipa>
          <HibaSzoveg szoveg={hiba} />
          <GombE
            cim={ASSIST_TEXTS.consentButton}
            disabled={!nyilatkozat || !utasitas}
            tolt={kuld.isPending}
            style={{ marginTop: 16 }}
            onPress={async () => {
              setHiba(null);
              try {
                await kuld.mutateAsync({ id: ev.id, hash: s.hash, declaration: true, instruction: true });
                jelez({ szoveg: fillPlaceholders(ASSIST_TEXTS.consentToast, { firstName: fn }), kesz: true });
                router.replace('/bekotes');
              } catch (e) {
                if (e instanceof ApiHiba && e.code === 'assist_consent_stale') {
                  void q.refetch();
                  setNyilatkozat(false);
                  setUtasitas(false);
                  setHiba(ASSIST_TEXTS.consentStale);
                  return;
                }
                setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
              }
            }}
          />
          {!nyilatkozat || !utasitas ? (
            <T m={14} lh={1.4} c={szin.halvany} style={{ marginTop: 8 }}>
              A gomb a két pipa után működik.
            </T>
          ) : null}
        </Lap>
      )}
      <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_bejelentes_helyettem" style={{ marginTop: 6, marginLeft: 4 }} />
    </Kepernyo>
  );
}
