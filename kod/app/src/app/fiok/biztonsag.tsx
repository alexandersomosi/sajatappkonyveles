// Biztonság (FUNKCIOK 1, 19): jelszócsere, kétlépcsős belépés, biometrikus zár (csak telefonon), munkamenetek.
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { brand } from '@/config';
import { ApiHiba, del, post } from '@/api/http';
import { K, useMunkamenetek } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { mikorIdovel } from '@/lib/format';
import { jelszoHiba } from '@/lib/validators';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Kapcsolo, Lap, Sor, Szakasz } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

/** Olvasható név a nyers user-agent helyett: „Chrome, Windows”, „Kézjegy app, Android”. */
function eszkozNev(ua: string, kind: string): string {
  const rendszer = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
  if (kind === 'native') return `${brand.name} app${rendszer ? `, ${rendszer}` : ''}`;
  if (kind === 'panel') return `Könyvelői felület${rendszer ? `, ${rendszer}` : ''}`;
  const bongeszo = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS|HeadlessChrome/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Böngésző';
  return rendszer ? `${bongeszo}, ${rendszer}` : bongeszo;
}

export default function Biztonsag() {
  const { user, bio, bioBeallit, kilep } = useAuth();
  const ses = useMunkamenetek();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const [regi, setRegi] = useState('');
  const [uj, setUj] = useState('');
  const [hibak, setHibak] = useState<{ regi?: string | null; uj?: string | null }>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  // A sikeres csere üzenete a kártyán marad (a felugró jelzés 3 mp után eltűnik).
  const [kesz, setKesz] = useState(false);

  async function jelszoCsere() {
    const h = { regi: regi ? null : 'Írd be a mostani jelszavad.', uj: jelszoHiba(uj, user?.email) };
    setHibak(h);
    if (h.regi || h.uj) return;
    setTolt(true);
    setHiba(null);
    setKesz(false);
    try {
      await post('/auth/password/change', { currentPassword: regi, newPassword: uj });
      setRegi('');
      setUj('');
      setKesz(true);
      jelez({ szoveg: 'Megváltoztattad a jelszavad.', kesz: true });
    } catch (e) {
      // A szerver mezőhibái a mezők alá kerülnek (pirossal), nem csak egy általános mondat.
      if (e instanceof ApiHiba && e.fields && (e.fields.currentPassword || e.fields.newPassword)) {
        setHibak({ regi: e.fields.currentPassword ? 'Ez nem a mostani jelszavad.' : null, uj: e.fields.newPassword ?? null });
        setHiba(null);
      } else setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }

  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Biztonság" />}>
      <Lap>
        <Sor
          elso
          ikon="fiok"
          cim="Kétlépcsős belépés"
          al={user?.totpEnabled ? 'Be van kapcsolva' : 'Nincs bekapcsolva. Ajánljuk: így a jelszavad egymagában nem elég.'}
          onPress={() => router.push('/fiok/ketlepcsos')}
        />
      </Lap>

      {Platform.OS !== 'web' ? (
        <Lap style={{ marginTop: 12 }}>
          <Kapcsolo
            be={bio.be}
            tilt={!bio.elerheto}
            cim="Megnyitás ujjlenyomattal vagy arccal"
            al={bio.elerheto ? '5 perc háttérben töltött idő után újra kéri.' : 'Ezen a telefonon nincs beállítva ujjlenyomat vagy arc.'}
            valt={async (b) => {
              const ok = await bioBeallit(b);
              if (ok) jelez(b ? 'Bekapcsoltad.' : 'Kikapcsoltad.');
            }}
          />
        </Lap>
      ) : null}

      <Szakasz cim="Jelszócsere" />
      <Lap style={{ padding: 18, gap: 14 }}>
        <Mezo
          felirat="Mostani jelszó"
          jelszo
          value={regi}
          onChangeText={(v) => {
            setRegi(v);
            setKesz(false);
            if (hibak.regi) setHibak((h) => ({ ...h, regi: null }));
          }}
          autoComplete="current-password"
          hiba={hibak.regi}
        />
        <Mezo
          felirat="Új jelszó"
          jelszo
          value={uj}
          onChangeText={(v) => {
            setUj(v);
            setKesz(false);
            if (hibak.uj) setHibak((h) => ({ ...h, uj: null }));
          }}
          autoComplete="new-password"
          hiba={hibak.uj}
          sugo={hibak.uj ? undefined : 'Legalább 10 karakter.'}
        />
        <HibaSzoveg szoveg={hiba} />
        {kesz ? (
          <T m={15} s={600} c={szin.tinta} style={{ marginTop: 10 }}>
            Kész: megváltoztattad a jelszavad. A többi eszközödön újra be kell lépned.
          </T>
        ) : null}
        <GombE cim="Megváltoztatom" onPress={jelszoCsere} tolt={tolt} />
      </Lap>

      <Szakasz cim="Hol vagy belépve" />
      <Lap>
        {(ses.data?.items ?? []).map((s, i) => (
          <View key={s.id}>
            <Sor
              elso={i === 0}
              ikon="fiok"
              cim={`${eszkozNev(s.userAgent, s.clientKind)}${s.current ? ' (ez)' : ''}`}
              al={`Utoljára: ${mikorIdovel(s.lastUsedAt, ma())}`}
            />
            {!s.current ? (
              <GombSz
                cim="Kiléptetem"
                m={14.5}
                style={{ marginLeft: 73, marginTop: -8, marginBottom: 4 }}
                onPress={async () => {
                  try {
                    await del(`/auth/sessions/${s.id}`);
                    await qc.invalidateQueries({ queryKey: K.munkamenetek });
                    jelez('Kiléptetted.');
                  } catch (e) {
                    jelez(hibaUzenet(e, 'Nem sikerült.'));
                  }
                }}
              />
            ) : null}
          </View>
        ))}
      </Lap>
      <GombM cim="Kilépés mindenhol" onPress={() => void kilep(true).then(() => router.replace('/belepes')).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} style={{ marginTop: 14 }} />
      <T m={14} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 10, paddingHorizontal: 4 }}>
        Ha elveszett a telefonod, innen (vagy egy másik eszközről) mindenhonnan kiléptetheted magad.
      </T>
    </Kepernyo>
  );
}
