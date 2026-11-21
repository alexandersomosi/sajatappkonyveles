// Adataim (FUNKCIOK 19, GDPR – SPEC §4.8): amit rólad tárolunk (az adóazonosító csak maszkolva), változás bejelentése,
// teljes adatmásolat kérése (ZIP, 24 óráig tölthető le, értesítünk, ha kész).
import { View } from 'react-native';
import { router } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useExportKer, useExportok, useHirdetesiHozzajarulas, useHirdetesVisszavon, useProfil } from '@/api/hooks';
import { letoltMegnyit } from '@/lib/fajlok';
import { datumEvvel, mikorIdovel } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap, Szakasz } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { Betolt, CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { szoveg } from '@/lib/szovegek';

const STATUSZ: Record<string, string> = { tb: 'Főállású', fofoglalkozasu: 'Főállású', mellekallasu: 'Mellékállású', nyugdijas: 'Nyugdíjas' };

function Sor2({ cim, ertek, elso }: { cim: string; ertek?: string; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <T m={15} c={szin.halvany}>
        {cim}
      </T>
      <T m={15.5} jobb style={{ flexShrink: 1 }}>
        {ertek || '–'}
      </T>
    </View>
  );
}

export default function Adataim() {
  const p = useProfil();
  const ex = useExportok();
  const ker = useExportKer();
  const jelez = useJelzes();
  const d = p.data;
  const exportok = ex.data?.items ?? [];
  const folyamatban = exportok.some((x) => x.status === 'keszul');
  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Adataim" al="Ezeket tároljuk rólad. Az iratokat és az igazolványokat titkosítva." />}>
      {p.isLoading ? <Betolt /> : d ? (
        <Lap>
          <Sor2 elso cim="Név" ertek={`${d.lastName} ${d.firstName}`} />
          <Sor2 cim="Telefon" ertek={d.phone} />
          <Sor2 cim="Adóazonosító jel" ertek={d.adoazonositoJelMasked} />
          <Sor2 cim="Adószám" ertek={d.adoszam} />
          <Sor2 cim="Lakcím" ertek={d.address ? `${d.address.zip} ${d.address.city}, ${d.address.line}` : undefined} />
          <Sor2 cim="Székhely települése" ertek={d.hqMunicipality} />
          <Sor2 cim="Tevékenység" ertek={d.activityText} />
          <Sor2 cim="Költséghányad" ertek={d.confirmedCostRatio ? `${d.confirmedCostRatio}% (könyvelőd megerősítette)` : `${d.suggestedCostRatio}% (javaslat)`} />
          <Sor2 cim="Helyzeted" ertek={d.taxStatus ? (STATUSZ[d.taxStatus] ?? d.taxStatus) : "még nem adtad meg"} />
          <Sor2 cim="Vállalkozó" ertek={d.evSince ? `${datumEvvel(d.evSince)} óta` : undefined} />
        </Lap>
      ) : (
        <Lap style={{ padding: 18 }}>
          <T m={15.5} c={szin.halvany}>
            Még nem adtad meg az adataidat.
          </T>
        </Lap>
      )}
      <GombM cim="Megváltozott egy adatom" ikon="fiok" onPress={() => router.push({ pathname: '/keresek/uj', params: { tipus: 'adatvaltozas' } })} style={{ marginTop: 14 }} />

      <Szakasz cim="Másolat az adataidról" megj="Minden adatod és iratod egy ZIP-fájlban. Elkészítjük, értesítünk, és 24 óráig letöltheted." />
      <Lap style={{ padding: 18 }}>
        {exportok.length ? (
          exportok.map((x) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
              <T m={15} c={szin.halvany}>
                {x.status === 'keszul' ? 'Készül…' : x.status === 'kesz' ? `Kész${x.expiresAt ? `, ${mikorIdovel(x.expiresAt, ma())}-ig tölthető le` : ''}` : x.status === 'lejart' ? 'Lejárt' : 'Hiba történt'}
              </T>
              {x.status === 'kesz' ? <GombSz cim="Letöltöm" onPress={() => letoltMegnyit(`/me/exports/${x.id}/download`, 'adataim.zip', 'application/zip').catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} /> : null}
            </View>
          ))
        ) : null}
        <GombE
          cim={folyamatban ? 'Készül a másolat' : 'Kérem a másolatot'}
          disabled={folyamatban}
          tolt={ker.isPending}
          onPress={async () => {
            try {
              await ker.mutateAsync();
              jelez({ szoveg: 'Elkezdtük. Értesítünk, ha kész.', kesz: true });
            } catch (e) {
              jelez(hibaUzenet(e, 'Nem sikerült.'));
            }
          }}
          style={{ marginTop: exportok.length ? 10 : 0 }}
        />
      </Lap>
      <HirdetesiMeres />
      <GombSz cim="Adatkezelési tájékoztató" onPress={() => router.push('/jogi/adatkezeles')} style={{ marginTop: 10, marginLeft: 4 }} />
      <GombSz cim="Süti-tájékoztató" onPress={() => router.push('/jogi/suti')} style={{ marginTop: 4, marginLeft: 4 }} />
    </Kepernyo>
  );
}

/** SPEC §31.6: only when ad measurement is switched on AND this account agreed on the landing page – then it can be withdrawn here. */
function HirdetesiMeres() {
  const q = useHirdetesiHozzajarulas();
  const vissza = useHirdetesVisszavon();
  const jelez = useJelzes();
  const h = q.data;
  if (!h?.enabled || !h.given) return null;
  // the texts are the lawyer's (kod/jogi/app_szovegek.json fiok.hirdetes_*)
  const kinek = [h.meta ? 'a Meta (Facebook, Instagram)' : '', h.google ? 'a Google' : ''].filter(Boolean).join(' és ');
  return (
    <Lap style={{ padding: 18, marginTop: 14 }}>
      <T m={16} s={650}>
        {szoveg('fiok.hirdetes_cim', {}, 'Hirdetések mérése (Meta, Google)')}
      </T>
      <T m={14.5} c={szin.halvany} lh={1.45} style={{ marginTop: 6 }}>
        {szoveg('fiok.hirdetes_leiras', { kinek })}
      </T>
      <GombM
        cim={szoveg('fiok.hirdetes_visszavonom', {}, 'Visszavonom')}
        onPress={async () => {
          try {
            await vissza.mutateAsync(undefined);
            jelez({ szoveg: szoveg('fiok.hirdetes_kikapcsolva'), kesz: true });
          } catch (e) {
            jelez(hibaUzenet(e, 'Nem sikerült.'));
          }
        }}
        style={{ marginTop: 12 }}
      />
    </Lap>
  );
}
