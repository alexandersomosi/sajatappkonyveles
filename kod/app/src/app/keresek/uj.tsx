// Új kérés (FUNKCIOK 17): igazolások (jövedelemigazolás: év + mire kell; nullás; köztartozásmentes), adatváltozás,
// tevékenységváltozás, kérdés. Típus nélkül választó. Elküldés után kérés-kártya jelenik meg az Üzenetekben is.
import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useHome, useKeresek, useKeresKuld } from '@/api/hooks';
import { szin } from '@/theme/tokens';
import { GombE, HibaSzoveg, Lap, Sor, Valaszto } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { ZarolasKapu } from '@/ui/ZarolasKapu';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';
import { Chip } from '@/kepernyok/FeltoltesLap';
import { hibaUzenet } from '@/lib/hiba';

type Tipus = 'jovedelemigazolas' | 'nullas_igazolas' | 'koztartozasmentes_igazolas' | 'adatvaltozas' | 'tevekenysegvaltozas' | 'kerdes';
const LEIRAS: Record<Tipus, { cim: string; mi: string }> = {
  jovedelemigazolas: { cim: 'Jövedelemigazolás', mi: 'A NAV igazolja, mennyi volt a jövedelmed egy évben. Bank, hitel, albérlet, ösztöndíj szokta kérni.' },
  nullas_igazolas: { cim: 'Nullás igazolás', mi: 'A NAV igazolja, hogy nincs adótartozásod. Pályázathoz, hitelhez kérik.' },
  koztartozasmentes_igazolas: { cim: 'Köztartozásmentességi igazolás', mi: 'Hasonló a nulláshoz, de minden köztartozásra kiterjed. Állami támogatáshoz, közbeszerzéshez kérik.' },
  adatvaltozas: { cim: 'Megváltozott egy adatom', mi: 'Új lakcím, telefonszám, bankszámla, név. A könyvelőd a NAV-nál is átvezeti.' },
  tevekenysegvaltozas: { cim: 'Változik, mivel foglalkozom', mi: 'Új tevékenység vagy befejezel egyet. Ettől változhat a költséghányadod is.' },
  kerdes: { cim: 'Kérdésem van', mi: 'Bármi, ami nem fér egy üzenetbe.' },
};

function UjKeresTartalom() {
  const p = useLocalSearchParams<{ tipus?: string }>();
  const home = useHome();
  const kuld = useKeresKuld();
  const jelez = useJelzes();
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const [tipus, setTipus] = useState<Tipus | null>(p.tipus && p.tipus in LEIRAS ? (p.tipus as Tipus) : null);
  const ev = Number(ma().slice(0, 4));
  const [evSzam, setEvSzam] = useState(ev - 1);
  const [cel, setCel] = useState('');
  const [nyelv, setNyelv] = useState<'hu' | 'en'>('hu');
  const [szoveg, setSzoveg] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  // Mezőhibák a mező alatt, pirossal (nem a gomb fölött).
  const [celHiba, setCelHiba] = useState<string | null>(null);
  const [szovegHiba, setSzovegHiba] = useState<string | null>(null);
  // Ugyanerre az igazolásra (típus + év) már van nyitott kérés: előbb rákérdezünk.
  const keresek = useKeresek();
  const [duplaOk, setDuplaOk] = useState(false);

  if (!tipus) {
    return (
      <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/')} cim="Mit kérsz?" al={`${fn} intézi a NAV-nál, és szól, ha kész.`} />}>
        <Lap>
          {(['jovedelemigazolas', 'nullas_igazolas', 'koztartozasmentes_igazolas'] as Tipus[]).map((t, i) => (
            // SPEC §29.5: az igazolás-kártyák az új „Igazolást kérek” űrlapra visznek
            <Sor key={t} elso={i === 0} ikon="igazolas" cim={LEIRAS[t].cim} al={LEIRAS[t].mi} onPress={() => router.push(`/igazolas/uj?tipus=${t}`)} />
          ))}
        </Lap>
        <Lap style={{ marginTop: 12 }}>
          {(['adatvaltozas', 'tevekenysegvaltozas', 'kerdes'] as Tipus[]).map((t, i) => (
            <Sor key={t} elso={i === 0} ikon={t === 'kerdes' ? 'kerdezek' : 'fiok'} cim={LEIRAS[t].cim} al={LEIRAS[t].mi} onPress={() => setTipus(t)} />
          ))}
        </Lap>
      </Kepernyo>
    );
  }

  const igazolas = tipus === 'jovedelemigazolas' || tipus === 'nullas_igazolas' || tipus === 'koztartozasmentes_igazolas';
  const dupla = igazolas
    ? keresek.data?.items.find(
        (k) =>
          k.direction === 'ugyfeltol' &&
          (k.status === 'nyitott' || k.status === 'folyamatban') &&
          k.certificate?.certificateType === tipus &&
          (tipus !== 'jovedelemigazolas' || k.certificate?.year === evSzam),
      )
    : undefined;

  async function elkuld() {
    if (!tipus) return;
    const ch = igazolas && !cel.trim() ? 'Írd be, mire kell (például: bank, lakáshitel).' : null;
    const sh = !igazolas && szoveg.trim().length < 3 ? 'Írd le pár szóban, mi változott vagy mit kérdezel.' : null;
    setCelHiba(ch);
    setSzovegHiba(sh);
    if (ch || sh) return;
    if (dupla && !duplaOk) {
      setHiba(`Ezt már kérted: „${dupla.title}” – ${dupla.statusLabel.toLowerCase()}. Ha mégis kell még egy (például más célra), nyomd meg újra az Elküldöm gombot.`);
      setDuplaOk(true);
      return;
    }
    setHiba(null);
    try {
      await kuld.mutateAsync({
        type: tipus,
        body: igazolas ? (szoveg.trim() || `Mire kell: ${cel.trim()}`) : szoveg.trim(),
        certificate: igazolas ? { certificateType: tipus, year: tipus === 'jovedelemigazolas' ? evSzam : undefined, purpose: cel.trim(), language: nyelv } : undefined,
      });
      jelez({ szoveg: `Elküldted. ${fn} szól, ha kész.`, kesz: true });
      router.replace('/keresek');
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem ment el. Próbáld újra.'));
    }
  }

  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza" vissza={() => (p.tipus ? vissza('/') : setTipus(null))} cim={LEIRAS[tipus].cim} al={LEIRAS[tipus].mi} />}>
      <Lap style={{ padding: 18, gap: 14 }}>
        {tipus === 'jovedelemigazolas' ? (
          <View>
            <T m={15} s={600} style={{ marginBottom: 8 }}>
              Melyik évről?
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[ev - 1, ev - 2, ev - 3].map((e) => (
                <Chip
                  key={e}
                  cim={String(e)}
                  on={evSzam === e}
                  onPress={() => {
                    setEvSzam(e);
                    setDuplaOk(false);
                  }}
                />
              ))}
            </View>
            <T m={13.5} c={szin.halvany} lh={1.45} style={{ marginTop: 6 }}>
              Az idei évről csak a jövő tavaszi bevallás után adhat a NAV igazolást.
            </T>
          </View>
        ) : null}
        {igazolas ? (
          <>
            <Mezo
              felirat="Mire kell?"
              value={cel}
              onChangeText={(t) => {
                setCel(t);
                if (celHiba) setCelHiba(null);
              }}
              placeholder="Például: bank, lakáshitel"
              hiba={celHiba}
            />
            <View>
              <T m={15} s={600} style={{ marginBottom: 8 }}>
                Milyen nyelven?
              </T>
              <Valaszto
                elemek={[
                  { kulcs: 'hu' as const, cim: 'Magyarul' },
                  { kulcs: 'en' as const, cim: 'Angolul is', al: 'Külföldi bankhoz, munkahelyhez.' },
                ]}
                ertek={nyelv}
                valt={setNyelv}
              />
            </View>
            <Mezo felirat="Megjegyzés (nem kötelező)" value={szoveg} onChangeText={setSzoveg} multiline />
          </>
        ) : (
          <Mezo
            felirat={tipus === 'adatvaltozas' ? 'Mi változott, és mikortól?' : tipus === 'tevekenysegvaltozas' ? 'Mivel kezdesz vagy mit hagysz abba, és mikortól?' : 'A kérdésed'}
            value={szoveg}
            onChangeText={(t) => {
              setSzoveg(t);
              if (szovegHiba) setSzovegHiba(null);
            }}
            multiline
            placeholder={tipus === 'adatvaltozas' ? 'Például: december 1-jétől új a lakcímem: …' : undefined}
            hiba={szovegHiba}
          />
        )}
        <HibaSzoveg szoveg={hiba} />
        <GombE cim={dupla && duplaOk ? 'Mégis elküldöm' : 'Elküldöm'} onPress={elkuld} tolt={kuld.isPending} />
      </Lap>
      <T m={14} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 12, paddingHorizontal: 4 }}>
        {igazolas ? `Az igazolást a NAV adja ki. ${fn} feltölti a dossziédba, és értesítést kapsz.` : `${fn} megnézi, és ha kell, a NAV-nál is átvezeti.`}
      </T>
    </Kepernyo>
  );
}

/** SPEC §26.5.2: bekötés alatt csak kérdés küldhető; az igazolás és az adatváltozás-kérés a bekötés után nyílik meg. */
export default function UjKeres() {
  const p = useLocalSearchParams<{ tipus?: string }>();
  const csakKerdes = p.tipus === 'kerdes';
  // SPEC §29.5: a régi igazolás-linkek (Főoldal, értesítések) az új űrlapra mennek
  if (p.tipus === 'jovedelemigazolas' || p.tipus === 'nullas_igazolas' || p.tipus === 'koztartozasmentes_igazolas') return <Redirect href={`/igazolas/uj?tipus=${p.tipus}`} />;
  // k6c2 (§28.K.5): while the fee lock is on, POST /client/requests is refused – the form is not even started
  if (csakKerdes)
    return (
      <ZarolasKapu cim="Kérésed van?">
        <UjKeresTartalom />
      </ZarolasKapu>
    );
  return (
    <ZaroltKapu feature="igazolas_keres" ful="fooldal" cim="Igazolás kérése">
      <ZarolasKapu cim="Igazolás kérése">
        <UjKeresTartalom />
      </ZarolasKapu>
    </ZaroltKapu>
  );
}
