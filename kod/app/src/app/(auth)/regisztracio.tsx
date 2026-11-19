// Regisztráció (FUNKCIOK 1, 31): név, e-mail, jelszó (erősséggel), ajánlókód (?ref=), UTM a webes címből; ÁSZF-link.
import { useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useConfig } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { AppleGomb, GoogleGomb } from '@/auth/kulso';
import { AuthKeret } from '@/kepernyok/AuthKeret';
import { brand } from '@/config';
import { emailHiba, jelszoEro, jelszoHiba } from '@/lib/validators';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { nemTor, szam } from '@/lib/format';
import { JOURNEY_TEXTS } from '@/_shared/bekotes';

function utm(): { source?: string; medium?: string; campaign?: string; content?: string } | undefined {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return undefined;
  try {
    const q = new URLSearchParams(location.search);
    const u = { source: q.get('utm_source') ?? undefined, medium: q.get('utm_medium') ?? undefined, campaign: q.get('utm_campaign') ?? undefined, content: q.get('utm_content') ?? undefined };
    return Object.values(u).some(Boolean) ? u : undefined;
  } catch {
    return undefined;
  }
}

export default function Regisztracio() {
  const { regisztral, alkalmaz } = useAuth();
  const cfg = useConfig();
  const p = useLocalSearchParams<{ ref?: string }>();
  const [vez, setVez] = useState('');
  const [ker, setKer] = useState('');
  const [email, setEmail] = useState('');
  const [jelszo, setJelszo] = useState('');
  const [kod, setKod] = useState((p.ref ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
  const [hibak, setHibak] = useState<Record<string, string | null>>({});
  // Javításkor a mező hibája azonnal eltűnik.
  const valt = (k: string, set: (v: string) => void) => (v: string) => {
    set(v);
    setHibak((h) => (h[k] ? { ...h, [k]: null } : h));
  };
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  const ero = useMemo(() => jelszoEro(jelszo), [jelszo]);
  const utmAdat = useMemo(utm, []);

  async function kuld() {
    const h = {
      vez: vez.trim() ? null : 'Írd be a vezetékneved.',
      ker: ker.trim() ? null : 'Írd be a keresztneved.',
      email: emailHiba(email),
      jelszo: jelszoHiba(jelszo, email),
    };
    setHibak(h);
    if (Object.values(h).some(Boolean)) return;
    setTolt(true);
    setHiba(null);
    try {
      await regisztral({ email: email.trim(), password: jelszo, firstName: ker.trim(), lastName: vez.trim(), referralCode: kod || undefined, utm: utmAdat });
      router.replace('/email-megerosites');
    } catch (e) {
      if (e instanceof ApiHiba && e.fields) setHibak({ email: e.fields.email ?? null, jelszo: e.fields.password ?? null });
      setHiba(hibaUzenet(e, 'Nem sikerült a regisztráció. Próbáld újra.', { jelolt: ['email', 'password'] }));
    } finally {
      setTolt(false);
    }
  }

  const google = !!cfg.data?.features.googleSignIn;
  const apple = Platform.OS === 'ios' && !!cfg.data?.features.appleSignIn;

  return (
    // S1 (SPEC §27.4.4): az ár a brand.json-ból (k3_kor2 nyelv 11.6), alatta egy sor az induló vállalkozóknak.
    <AuthKeret cim="Kezdjük az ismerkedéssel." al={`${nemTor(`Egyéni vállalkozóknak, havi ${szam(cfg.data?.brand.priceHufMonthlyGross || brand.priceHufMonthlyGross)} Ft.`)} Bármikor lemondhatod.
${JOURNEY_TEXTS.signupNewBusiness}`}>
      <Lap style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Mezo felirat="Vezetéknév" value={vez} onChangeText={valt('vez', setVez)} autoComplete="family-name" textContentType="familyName" hiba={hibak.vez} style={{ flex: 1 }} />
          <Mezo felirat="Keresztnév" value={ker} onChangeText={valt('ker', setKer)} autoComplete="given-name" textContentType="givenName" hiba={hibak.ker} style={{ flex: 1 }} />
        </View>
        <Mezo felirat="E-mail-cím" value={email} onChangeText={valt('email', setEmail)} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" hiba={hibak.email} style={{ marginTop: 14 }} sugo="Ide küldjük a megerősítő kódot." />
        <Mezo felirat="Jelszó" jelszo value={jelszo} onChangeText={valt('jelszo', setJelszo)} autoComplete="new-password" textContentType="newPassword" hiba={hibak.jelszo} style={{ marginTop: 14 }} />
        {jelszo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }} accessibilityLabel={`Jelszó erőssége: ${ero.szo}`}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ width: 28, height: 5, borderRadius: 3, backgroundColor: ero.pont >= i ? szin.tintakek : szin.keret }} />
              ))}
            </View>
            <T m={13.5} c={szin.halvany}>
              {ero.szo}
            </T>
          </View>
        ) : hibak.jelszo ? null : (
          <T m={14} c={szin.halvany} lh={1.4} style={{ marginTop: 6 }}>
            Legalább 10 karakter. Egy hosszú mondat is jó.
          </T>
        )}
        <Mezo felirat="Ajánlókód (ha kaptál)" value={kod} onChangeText={(t) => setKod(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))} autoCapitalize="characters" style={{ marginTop: 14 }} />
        <T m={14} c={szin.halvany} lh={1.45} style={{ marginTop: 14 }}>
          A regisztrációval elfogadod, hogy a fiókodat kezeljük. A szerződést és az adatkezelési tájékoztatót a következő lépésekben olvashatod el és fogadhatod el.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 }}>
          <GombSz cim="Szerződési feltételek" m={14.5} onPress={() => router.push('/jogi/aszf')} />
          <GombSz cim="Adatkezelés" m={14.5} onPress={() => router.push('/jogi/adatkezeles')} />
        </View>
        <HibaSzoveg szoveg={hiba} style={{ marginBottom: 6 }} />
        <GombE cim="Regisztrálok" onPress={kuld} tolt={tolt} style={{ marginTop: 8 }} />
      </Lap>
      {google || apple ? (
        <View style={{ gap: 10, marginTop: 14 }}>
          {google ? <GoogleGomb siker={async (r) => { await alkalmaz(r); router.replace('/'); }} hiba={setHiba} referralCode={kod || undefined} webClientId={cfg.data?.googleClientIds.web} /> : null}
          {apple ? <AppleGomb siker={async (r) => { await alkalmaz(r); router.replace('/'); }} hiba={setHiba} referralCode={kod || undefined} /> : null}
        </View>
      ) : null}
    </AuthKeret>
  );
}
