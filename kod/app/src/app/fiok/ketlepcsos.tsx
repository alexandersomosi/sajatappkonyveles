// Kétlépcsős belépés beállítása (FUNKCIOK 1, 19; SPEC §4.1 TOTP): QR-kód (vagy a kulcs kimásolása / megnyitás a
// hitelesítő appban), a 6 jegyű kód megerősítése, 10 tartalék kód egyszer megmutatva; kikapcsolás kóddal + jelszóval.
// A szerver a bekapcsolást csak friss belépés után (10 perc) engedi, később a mostani jelszót is kéri
// (403 reauth_required): ilyenkor megjelenik a „Mostani jelszó” mező, és a kérés azzal megy újra. Google-/Apple-
// fióknál (nincs jelszó) a szerver szövege marad: lépj ki, majd be újra.
import { useMemo, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { toQR } from 'toqr';
import { ApiHiba, post } from '@/api/http';
import { useAuth } from '@/auth/AuthProvider';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { MASOLAS_HIBA, vagolapra } from '@/lib/vagolap';

function QR({ szoveg, meret = 200 }: { szoveg: string; meret?: number }) {
  const { n, cellak } = useMemo(() => {
    const m = toQR(szoveg);
    const n = Math.round(Math.sqrt(m.length));
    const c: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y * n + x]) c.push([x, y]);
    return { n, cellak: c };
  }, [szoveg]);
  const k = 4; // csendes zóna
  return (
    <Svg width={meret} height={meret} viewBox={`0 0 ${n + 2 * k} ${n + 2 * k}`} accessibilityLabel="QR-kód a hitelesítő apphoz">
      <Rect x={0} y={0} width={n + 2 * k} height={n + 2 * k} fill="#fff" />
      {cellak.map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={x + k} y={y + k} width={1.02} height={1.02} fill={szin.tinta} />
      ))}
    </Svg>
  );
}

export default function KetlepcsosBeallitas() {
  const { user, frissitUser } = useAuth();
  const jelez = useJelzes();
  const [titok, setTitok] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [kod, setKod] = useState('');
  const [jelszo, setJelszo] = useState('');
  const [tartalek, setTartalek] = useState<string[] | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  // A szerver a mostani jelszót is kéri (régebbi belépés): ekkor jelenik meg a mező.
  const [jelszoKell, setJelszoKell] = useState(false);
  const [mostJelszo, setMostJelszo] = useState('');
  const [jelszoHiba, setJelszoHiba] = useState<string | null>(null);
  const be = !!user?.totpEnabled;

  /** true, ha a hibát kezeltük (jelszómező megjelent / a jelszó hibás). */
  function ujraHitelesites(e: unknown): boolean {
    if (!(e instanceof ApiHiba)) return false;
    if (e.fields?.currentPassword) {
      setJelszoKell(true);
      setJelszoHiba(e.fields.currentPassword);
      return true;
    }
    // Jelszavas fióknál a szerver a jelszót kéri; Google-/Apple-fióknál csak az újbóli belépés segít (az ő szövege).
    if (e.code === 'reauth_required' && /jelszavad/i.test(e.message)) {
      setJelszoKell(true);
      setJelszoHiba(null);
      return true;
    }
    return false;
  }
  const jelszoval = () => (jelszoKell && mostJelszo ? { currentPassword: mostJelszo } : {});

  async function indit() {
    setHiba(null);
    setJelszoHiba(null);
    if (jelszoKell && !mostJelszo) return setJelszoHiba('Írd be a mostani jelszavadat.');
    setTolt(true);
    try {
      setTitok(await post<{ secret: string; otpauthUrl: string }>('/auth/totp/setup', jelszoval()));
    } catch (e) {
      if (!ujraHitelesites(e)) setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }
  async function bekapcsol() {
    if (!/^\d{6}$/.test(kod)) return setHiba('A kód 6 számjegy.');
    setHiba(null);
    setJelszoHiba(null);
    if (jelszoKell && !mostJelszo) return setJelszoHiba('Írd be a mostani jelszavadat.');
    setTolt(true);
    try {
      const r = await post<{ recoveryCodes: string[] }>('/auth/totp/enable', { code: kod, ...jelszoval() });
      setTartalek(r.recoveryCodes);
      setMostJelszo('');
      frissitUser({ totpEnabled: true });
    } catch (e) {
      if (!ujraHitelesites(e)) setHiba(hibaUzenet(e, 'Nem sikerült.'));
    } finally {
      setTolt(false);
    }
  }
  const jelszoMezo = jelszoKell ? (
    <View style={{ marginTop: 14 }}>
      <T m={15} lh={1.5} c={szin.halvany} style={{ marginBottom: 10 }}>
        Biztonsági okból add meg a mostani jelszavadat is. Erre akkor van szükség, ha több mint 10 perce léptél be.
      </T>
      <Mezo
        felirat="Mostani jelszó"
        jelszo
        value={mostJelszo}
        onChangeText={(t) => {
          setMostJelszo(t);
          setJelszoHiba(null);
        }}
        autoComplete="current-password"
        textContentType="password"
        hiba={jelszoHiba}
      />
    </View>
  ) : null;
  async function kikapcsol() {
    if (!/^\d{6}$/.test(kod)) return setHiba('A kód 6 számjegy.');
    setHiba(null);
    setTolt(true);
    try {
      await post('/auth/totp/disable', { code: kod, password: jelszo || undefined });
      frissitUser({ totpEnabled: false });
      setKod('');
      setJelszo('');
      jelez('Kikapcsoltad a kétlépcsős belépést.');
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült.'));
    } finally {
      setTolt(false);
    }
  }

  const fej = <CimSor visszaCim="Vissza" vissza={() => vissza('/fiok/biztonsag')} cim="Kétlépcsős belépés" al="Belépéskor a jelszó mellé egy 6 jegyű kód is kell a telefonod hitelesítő appjából (például Google Authenticator, Microsoft Authenticator)." />;

  if (tartalek) {
    return (
      <Kepernyo ful="fiok" fejlec={fej}>
        <Lap style={{ padding: 18 }}>
          <T m={17} s={650} lh={1.4}>
            Bekapcsoltad. Mentsd el ezt a 10 tartalék kódot.
          </T>
          <T m={15} c={szin.halvany} lh={1.5} style={{ marginTop: 4 }}>
            Ha elveszik a telefonod, ezekkel tudsz belépni. Mindegyik egyszer használható. Többet nem mutatjuk meg őket.
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {tartalek.map((c) => (
              <View key={c} style={{ width: '47%', paddingVertical: 8, borderRadius: 8, backgroundColor: szin.nyomott, alignItems: 'center' }}>
                <T m={15.5} s={650} szam selectable nyers>
                  {c}
                </T>
              </View>
            ))}
          </View>
          <GombM
            cim="Mind kimásolom"
            ikon="masolas"
            onPress={async () => {
              if (!(await vagolapra(tartalek.join('\n')))) return jelez(MASOLAS_HIBA);
              jelez({ szoveg: 'Kimásoltad. Tedd biztos helyre.', kesz: true });
            }}
            style={{ marginTop: 14 }}
          />
          <GombE cim="Elmentettem" onPress={() => vissza('/fiok/biztonsag')} style={{ marginTop: 14 }} />
        </Lap>
      </Kepernyo>
    );
  }

  if (be) {
    return (
      <Kepernyo ful="fiok" fejlec={fej}>
        <Lap style={{ padding: 18, gap: 14 }}>
          <T m={16} s={650} lh={1.4}>
            Be van kapcsolva.
          </T>
          <T m={15} c={szin.halvany} lh={1.5}>
            Kikapcsolni a hitelesítő app kódjával (és a jelszavaddal) tudod.
          </T>
          <Mezo felirat="Kód az appból" value={kod} onChangeText={(t) => setKod(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" />
          <Mezo felirat="Jelszó" jelszo value={jelszo} onChangeText={setJelszo} autoComplete="current-password" />
          <HibaSzoveg szoveg={hiba} />
          <GombSz cim="Kikapcsolom" veszely onPress={kikapcsol} />
        </Lap>
      </Kepernyo>
    );
  }

  return (
    <Kepernyo ful="fiok" fejlec={fej}>
      {!titok ? (
        <Lap style={{ padding: 18 }}>
          <T m={15.5} lh={1.5}>
            Pénzügyi és személyes adataid vannak itt. A kétlépcsős belépéssel a jelszavad egymagában nem elég, ha valaki megszerezné.
          </T>
          {jelszoMezo}
          <HibaSzoveg szoveg={hiba} />
          <GombE cim="Bekapcsolom" onPress={indit} tolt={tolt} style={{ marginTop: 16 }} />
        </Lap>
      ) : (
        <Lap style={{ padding: 18 }}>
          <T m={16} s={650} lh={1.4}>
            1. Add hozzá a hitelesítő appodhoz
          </T>
          {Platform.OS === 'web' ? (
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <QR szoveg={titok.otpauthUrl} />
              <T m={14} c={szin.halvany} kozep style={{ marginTop: 6 }}>
                Olvasd be a QR-kódot az appal.
              </T>
            </View>
          ) : (
            <GombM cim="Megnyitom a hitelesítő appban" onPress={() => void Linking.openURL(titok.otpauthUrl).catch(() => jelez('Nincs hitelesítő app a telefonodon. Másold ki a kulcsot.'))} style={{ marginTop: 12 }} />
          )}
          <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 12 }}>
            Vagy írd be kézzel ezt a kulcsot:
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <T m={16} s={650} szam selectable nyers style={{ flex: 1 }}>
              {titok.secret.replace(/(.{4})/g, '$1 ').trim()}
            </T>
            <GombSz
              cim="Kimásolom"
              accessibilityLabel="A kulcs kimásolása"
              onPress={async () => {
                if (!(await vagolapra(titok.secret))) return jelez(MASOLAS_HIBA);
                jelez({ szoveg: 'Kimásoltad a kulcsot.', kesz: true });
              }}
            />
          </View>
          <T m={16} s={650} lh={1.4} style={{ marginTop: 18 }}>
            2. Írd be a kódot, amit az app mutat
          </T>
          <Mezo felirat="6 jegyű kód" value={kod} onChangeText={(t) => setKod(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" style={{ marginTop: 8 }} />
          {jelszoMezo}
          <HibaSzoveg szoveg={hiba} />
          <GombE cim="Bekapcsolom" onPress={bekapcsol} tolt={tolt} style={{ marginTop: 16 }} />
        </Lap>
      )}
    </Kepernyo>
  );
}
