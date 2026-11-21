// Fiók (FUNKCIOK 19, 31, 32): a könyvelőd, előfizetés, díjszámlák, értesítések, biztonság, adataid, ajánlás,
// GYIK, jogi iratok, fiók törlése, kijelentkezés. (Nincs megrajzolva: ugyanazon a vizuális nyelven.)
import { Platform, Share, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useElofizetes, useErtesitesek, useKedvezmenyek, useMe, useVisszahivasok } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { brand } from '@/config';
import { datumAn, maiNap, nevelo } from '@/lib/format';
import { ALLOWANCE_TEXTS, CHANGE_TEXTS, EARNINGS_TEXTS, FEE_TEXTS, fillPlaceholders, JOURNEY_TEXTS, PATH_CHANGE_TEXTS } from '@/_shared/bekotes';
import { useOnboarding } from '@/api/hooks';
import { MiEz } from '@/ui/Magyarazat';
import { useUtvaltas } from '@/ui/Ut';
import { szin } from '@/theme/tokens';
import { Fejlec, GombM, GombV, Lap, Sor, Szakasz } from '@/ui/alap';
import { KetOszlop } from '@/ui/asztali/Racs';
import { useAsztali } from '@/lib/elrendezes';
import { Arckep, Ikon3d } from '@/ui/kepek';
import { useHozzaferes, useZarolt } from '@/ui/Zarolt';
import { HIVAS_MONDAT, KONYVELO_SOR, visszahivasUt } from '@/ui/Visszahivas';
import { MASOLAS_HIBA, vagolapra } from '@/lib/vagolap';
import { Betolt, Kepernyo, useJelzes } from '@/ui/keret';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

const ALLAPOT: Record<string, string> = { active: 'Él', past_due: 'Nem sikerült levonni', suspended: 'Szünetel', canceled: 'Lemondva', incomplete: 'Még nincs elindítva' };

export default function Fiok() {
  const me = useMe();
  const elo = useElofizetes();
  const ert = useErtesitesek();
  const { kilep, user } = useAuth();
  const jelez = useJelzes();
  const hf = useHozzaferes();
  const zarolt = useZarolt();
  const vh = useVisszahivasok();
  const utv = useUtvaltas();
  const bekotes = hf.korlatozott;
  const asztali = useAsztali();
  const ob = useOnboarding();
  const ut = ob.data?.path ?? null;
  const valasz = ut === 'van' ? JOURNEY_TEXTS.pathVan : ut === 'inditas' ? (ob.data?.registrationMode === 'segitett' ? JOURNEY_TEXTS.pathInditasSegitett : JOURNEY_TEXTS.pathInditas) : 'Még nem válaszoltál';
  const nyitottVh = vh.data?.open ?? null;
  const lakat = <Ikon3d nev="lakat" pt={24} label="Zárolva" />;
  const acc = me.data?.accountant;
  const kod = me.data?.client?.personalReferralCode;
  const e = elo.data;
  const ujErt = (ert.data?.items ?? []).filter((n) => !n.readAt).length;
  // SPEC §28.3.4 (2): az „Adókedvezményeid” sor alsora az állapot
  const kedv = useKedvezmenyek(Number(maiNap().slice(0, 4)));
  const kd = kedv.data;
  const fnK = acc?.firstName ?? 'a könyvelőd';
  const kedvAl = !kd
    ? ALLOWANCE_TEXTS.fiok.subNincs
    : kd.notForRegime
      ? ALLOWANCE_TEXTS.fiok.subNemJar
      : kd.pendingCount
        ? fillPlaceholders(ALLOWANCE_TEXTS.fiok.subAtnezi, { firstName: fnK })
        : kd.items.some((i) => i.status === 'jovahagyva')
          ? fillPlaceholders(ALLOWANCE_TEXTS.fiok.subJovahagyva, { n: String(kd.items.filter((i) => i.status === 'jovahagyva').length) })
          : kd.gate === 'nem_jar'
            ? ALLOWANCE_TEXTS.fiok.subNemJar
            : ALLOWANCE_TEXTS.fiok.subNincs;
  const eloAl = e
    ? `${ALLAPOT[e.status] ?? e.status}${e.cancelAtPeriodEnd && e.currentPeriodEnd ? `, ${datumAn(e.currentPeriodEnd)} lejár` : e.nextChargeAt ? `, következő levonás ${datumAn(e.nextChargeAt)}` : ''}${e.mode === 'demo' ? ' · DEMO' : ''}`
    : undefined;

  return (
    <Kepernyo
      ful="fiok"
      szeles
      fejlec={
        <Fejlec alsoTer={24}>
          <T m={asztali ? 30 : 27} s={800} lh={1.14} ls={-0.025} c="#fff" style={{ paddingTop: asztali ? 8 : 14, paddingHorizontal: asztali ? 16 : 18 }} accessibilityRole="header">
            {user?.displayName ?? 'Fiók'}
          </T>
          <T m={15.5} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 6, paddingHorizontal: asztali ? 16 : 18 }}>
            {user?.email}
          </T>
        </Fejlec>
      }
    >
      <KetOszlop
        bal={
          <>
      {me.isLoading ? <Betolt /> : null}
      {acc ? (
        <Lap style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Arckep pt={48} gyuru />
            <View style={{ flex: 1 }}>
              <T m={16.5} s={650} lh={1.3}>
                {acc.displayName}, a könyvelőd
              </T>
              <T m={14} c={szin.halvany} lh={1.4}>
                {acc.title}, nyilvántartási szám: {acc.registrationNumber}
              </T>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <GombM cim="Üzenet neki" ikon="uzenet" onPress={() => router.push('/uzenetek')} />
            <GombM cim="Kérj visszahívást" ikon="telefon" onPress={() => router.push(visszahivasUt('konyvelo_kartya', 'egyeb'))} />
          </View>
          <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
            {KONYVELO_SOR(acc.firstName)}
          </T>
        </Lap>
      ) : null}

      {bekotes ? (
        <>
          {/* S22: a bekötés alatt itt is módosítható a fő válasz (SPEC §27.2.5/5); a fiók „Mi ez?”-je (k3_kor2 tulaj 9). */}
          <Szakasz ikon="fooldal" cim="Bekötés" />
          <Lap>
            <Sor
              elso
              ikon="bevallas"
              cim={PATH_CHANGE_TEXTS.fiokRow}
              al={`${valasz} · ${JOURNEY_TEXTS.pathChange}`}
              onPress={() => (ut ? utv.modosit() : router.navigate('/bekotes'))}
            />
            <Sor ikon="fiok" cim="A fiókod" al="Mire jó, mit tárolunk benne" jobbra={<MiEz kulcs="fiok" />} />
          </Lap>
        </>
      ) : null}

      {/* SPEC §28.6.1: „Adózás” – kedvezmények, kereset, változások (a kereset a bekötés után nyílik) */}
      <Szakasz ikon="bevallas" cim={ALLOWANCE_TEXTS.fiok.section} />
      <Lap>
        <Sor elso ikon="cimke" cim={ALLOWANCE_TEXTS.fiok.row} al={kedvAl} onPress={() => router.push('/kedvezmenyek')} />
        {hf.zarva('kereset') ? (
          <Sor ikon="oszlop" cim={EARNINGS_TEXTS.cardTitle} al="A bekötés után nyílik meg." jobbra={lakat} label={EARNINGS_TEXTS.cardTitle} zaroltOk={hf.ok('kereset') ?? 'A bekötés után nyílik meg.'} onPress={() => zarolt({ feature: 'kereset' })} />
        ) : (
          <Sor ikon="oszlop" cim={EARNINGS_TEXTS.cardTitle} al="Mennyi marad a bevételedből az adók után" onPress={() => router.push('/kereset')} />
        )}
        <Sor ikon="valtozas" cim={CHANGE_TEXTS.hub.fiokRow} al="Költözés, új tevékenység, szüneteltetés" onPress={() => router.push('/valtozas')} />
      </Lap>

      <Szakasz ikon="szamlaszam" cim="Szolgáltatás" />
      <Lap>
        <Sor elso ikon="kartya" cim="Előfizetés" al={eloAl} onPress={() => router.push('/fiok/elofizetes')} />
        {/* k7c2: a díjak és számlák sora a bekötés alatt is látszik – aki már fizetett, itt találja a számláját
            (a fizetés eredménye ide küldi). A határidők a bekötés után jelennek meg (k3_kor2 walkthrough 20). */}
        <Sor ikon="nyugta" cim={FEE_TEXTS.fiokRow} al="Mi van a havidíjban, külön díjak, számláid" onPress={() => router.push('/fiok/dijak')} />
        <Sor ikon="irat" cim="Igazolások" al="Jövedelem- és adóigazolás, KOMA, kivonat" onPress={() => router.push('/igazolas')} />
        <Sor ikon="emelkedes" cim="Bevételi kimutatás" al="A bevételeid havonta, PDF-ben" onPress={() => router.push('/kimutatas')} />
        <Sor ikon="kerdoiv" cim="Kérések" al="Adatváltozás, kérdés" onPress={() => router.push('/keresek')} />
        {bekotes ? null : hf.zarva('hataridok') ? (
          <Sor ikon="hataridok" cim="Határidők" al="A bekötés után nyílik meg." jobbra={lakat} label="Határidők" zaroltOk={hf.ok('hataridok') ?? 'A bekötés után nyílik meg.'} onPress={() => zarolt({ feature: 'hataridok' })} />
        ) : (
          <Sor ikon="hataridok" cim="Határidők" onPress={() => router.push('/hataridok')} />
        )}
      </Lap>

          </>
        }
        jobb={
          <>
      <Szakasz ikon="ertesites" cim="Beállítások" />
      <Lap>
        <Sor elso ikon="ertesites" cim="Értesítések" al={ujErt ? `${ujErt} új` : 'Mikről és hogyan szóljunk'} onPress={() => router.push('/ertesitesek')} />
        <Sor ikon="pajzs" cim="Biztonság" al={`Jelszó, kétlépcsős belépés${Platform.OS !== 'web' ? ', ujjlenyomat vagy arc' : ''}`} onPress={() => router.push('/fiok/biztonsag')} />
        <Sor ikon="fiok" cim="Adataim" al="Amit rólad tárolunk, és a letöltésük" onPress={() => router.push('/fiok/adataim')} />
      </Lap>

      {kod && !bekotes ? (
        <>
          <Szakasz cim="Ajánld ismerősnek" megj="Ha ismersz egyéni vállalkozót, akinek jól jönne egy könyvelő." />
          <Lap style={{ padding: 18 }}>
            <T m={14} c={szin.halvany}>
              A te ajánlókódod
            </T>
            <T m={28} s={800} ls={0.04} szam selectable>
              {kod}
            </T>
            <GombM
              cim="Megosztom"
              magas={50}
              style={{ marginTop: 12 }}
              onPress={async () => {
                const szoveg = `Nekem ${nevelo(brand.name)} ${brand.name} intézi a könyvelést, havi ${brand.priceHufMonthlyGross.toLocaleString('hu-HU')} Ft-ért. Ha te is kipróbálnád, ezzel a kóddal regisztrálj: ${kod}`;
                try {
                  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !(navigator as Navigator & { share?: unknown }).share) {
                    if (await vagolapra(szoveg)) jelez({ szoveg: 'Kimásoltad, beillesztheted bárhova.', kesz: true });
                    else jelez(MASOLAS_HIBA);
                  } else await Share.share({ message: szoveg });
                } catch {
                  /* a felhasználó bezárta */
                }
              }}
            />
          </Lap>
        </>
      ) : null}

      <Szakasz ikon="kerdezek" cim="Segítség" />
      <Lap>
        <Sor elso ikon="telefon" cim="Visszahívást kérek" al={nyitottVh ? nyitottVh.statusText : HIVAS_MONDAT} onPress={() => router.push(visszahivasUt('fiok', 'egyeb'))} />
        <Sor ikon="kerdes" cim="Gyakori kérdések" onPress={() => router.push('/gyik')} />
        <Sor ikon="jogi" cim="Szerződés és adatkezelés" onPress={() => router.push('/jogi/aszf')} />
      </Lap>

      <View style={{ marginTop: 4, gap: 10 }}>
        <GombM cim="Kijelentkezés" ikon="kilep" magas={50} onPress={() => void kilep().then(() => router.replace('/belepes')).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} />
        <GombV cim="Fiók törlése" onPress={() => router.push('/fiok/torles')} />
        <T m={13} c={szin.halvanyAlapon} kozep style={{ marginTop: 4 }}>
          {brand.name} {Constants.expoConfig?.version ?? ''} · {brand.provider.legalName}
        </T>
      </View>
          </>
        }
      />
    </Kepernyo>
  );
}
