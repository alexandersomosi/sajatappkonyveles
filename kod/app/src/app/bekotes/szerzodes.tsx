// Szerződés (FUNKCIOK 3–4): ÁSZF, Adatkezelési tájékoztató, Megbízási szerződés – olvasható, PDF-ben letölthető,
// mindegyik külön elfogadással. Az elfogadás verzióval és időponttal kerül a szerverre (consents).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { LegalDocType } from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useConfig, useHozzajarul, useOnboarding } from '@/api/hooks';
import { letoltMegnyit } from '@/lib/fajlok';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Pipa } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { Elakadtal } from '@/ui/Visszahivas';
import { T } from '@/ui/T';
import { szoveg, szovegLista } from '@/lib/szovegek';
import { hibaUzenet } from '@/lib/hiba';
import { bekotesre } from '@/lib/vezetett';

// Az adatkezelési tájékoztatót tudomásul veszed (nem hozzájárulás), a másik kettőt elfogadod (jogi megjegyzés, SPEC §24).
const IRATOK: { tipus: LegalDocType; cim: string; mirol: string; pdf?: boolean; pipa: string }[] = [
  { tipus: 'aszf', cim: 'Általános szerződési feltételek', mirol: 'Mit vállalunk, mennyibe kerül, hogyan mondhatod le.', pdf: true, pipa: szoveg('szerzodes.elfogad_aszf', {}, 'Elolvastam és elfogadom az Általános Szerződési Feltételeket.') },
  { tipus: 'adatkezeles', cim: 'Adatkezelési tájékoztató', mirol: 'Milyen adatodat, miért és meddig tároljuk, és mit kérhetsz.', pdf: true, pipa: szoveg('szerzodes.tudomasul_adatkezeles', {}, 'Elolvastam az Adatkezelési tájékoztatót.') },
  { tipus: 'megbizasi_szerzodes', cim: 'Megbízási szerződés', mirol: 'A könyvelésről szól, a te adataiddal kitöltve.', pdf: true, pipa: szoveg('szerzodes.elfogad_megbizas', {}, 'Elfogadom a Megbízási szerződést.') },
];

export default function Szerzodes() {
  const cfg = useConfig();
  const o = useOnboarding();
  const elfogad = useHozzajarul();
  const jelez = useJelzes();
  const [pipak, setPipak] = useState<Record<string, boolean>>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const mind = IRATOK.every((i) => pipak[i.tipus]);
  const kesz = o.data?.steps.find((s) => s.step === 'szerzodes')?.status === 'kesz';

  async function kuld() {
    if (!mind) return setHiba('Mindhárom jelölőnégyzetet be kell jelölnöd a továbblépéshez.');
    const verziok = cfg.data?.legal ?? {};
    setHiba(null);
    try {
      await elfogad.mutateAsync({ items: IRATOK.map((i) => ({ docType: i.tipus, version: verziok[i.tipus] ?? '' })) });
      jelez({ szoveg: 'Elfogadtad. A szerződést e-mailben is elküldjük.', kesz: true });
      bekotesre();
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  }

  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim="A szerződés" al={szoveg('szerzodes.bevezeto', {}, 'Három rövid irat. Olvasd el őket nyugodtan; ha kérdésed van, írj a könyvelődnek.')} />}>
      <MiEz kulcs="szerzodes" style={{ alignSelf: 'flex-start', marginLeft: 4, marginBottom: 6 }} />
      {IRATOK.map((d, i) => (
        <Lap key={d.tipus} style={{ padding: 18, marginTop: i ? 12 : 0 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Ikon3d nev="irat" pt={40} />
            <View style={{ flex: 1 }}>
              <T m={17} s={650} lh={1.35}>
                {d.cim}
              </T>
              <T m={14.5} c={szin.halvany} lh={1.45} style={{ marginTop: 2 }}>
                {d.mirol}
                {cfg.data?.legal[d.tipus] ? ` Változat: ${cfg.data.legal[d.tipus]}.` : ''}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, marginTop: 8 }}>
            <GombSz cim="Elolvasom" onPress={() => router.push({ pathname: '/jogi/[tipus]', params: { tipus: d.tipus, honnan: 'szerzodes' } })} />
            {d.pdf ? (
              <GombSz
                cim={szoveg('szerzodes.pdf', {}, 'PDF letöltése')}
                onPress={() => letoltMegnyit(`/client/legal-pdf/${d.tipus}`, `${d.tipus}.pdf`, 'application/pdf').catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))}
              />
            ) : null}
          </View>
          {d.tipus === 'aszf' ? (
            <View style={{ marginTop: 6, borderRadius: 12, backgroundColor: szin.nyomott, padding: 12 }}>
              <T m={15} s={650} lh={1.4}>
                {szoveg('szerzodes.kiemelt_cim', {}, 'Erre külön figyelj')}
              </T>
              {szovegLista('szerzodes.kiemelt').map((k, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <T m={14.5} c={szin.halvany}>•</T>
                  <T m={14.5} lh={1.45} style={{ flex: 1 }}>
                    {k}
                  </T>
                </View>
              ))}
            </View>
          ) : null}
          <Pipa be={!!pipak[d.tipus] || kesz} valt={(b) => setPipak((p) => ({ ...p, [d.tipus]: b }))} style={{ marginTop: 4 }}>
            {d.pipa}
          </Pipa>
        </Lap>
      ))}
      <HibaSzoveg szoveg={hiba} />
      {kesz ? (
        <GombM cim="Már elfogadtad – vissza" onPress={() => vissza('/bekotes')} style={{ marginTop: 16 }} />
      ) : (
        <GombE cim="Rendben, tovább" onPress={kuld} tolt={elfogad.isPending} disabled={!mind} style={{ marginTop: 16 }} />
      )}
      <T m={14} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 12, paddingHorizontal: 4 }}>
        Az elfogadás időpontját elmentjük. A megbízási szerződés PDF-jét e-mailben is megkapod, és a dossziédban is megtalálod.
      </T>
      <Elakadtal forras="bekotes" tema="bekotes" style={{ marginTop: 6, marginLeft: 4 }} />
    </Kepernyo>
  );
}
