// Google- és Apple-belépés (SPEC §4.1, §11.3–11.4). A gombok csak akkor látszanak, ha a szerver /config szerint be van
// kapcsolva (kulcsok nélkül rejtve). A cégek logója a saját előírásuk szerint marad (TERV 0. pont).
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthResult } from '../_shared/api';
import { ApiHiba, post } from '../api/http';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config';
import { T } from '../ui/T';
import { hibaUzenet } from '@/lib/hiba';
import type { ForrasAdat } from '@/lib/forras';

const clientKind = Platform.OS === 'web' ? 'web' : 'native';

function GLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/** Fehér kapszula 1 pt-os sötét kerettel (01 .gomb-k). */
function CegGomb({ cim, logo, onPress, tilt }: { cim: string; logo: React.ReactNode; onPress: () => void; tilt?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={tilt}
      onPress={onPress}
      style={({ pressed }) => ({ height: 50, borderRadius: 999, backgroundColor: pressed ? '#F4F5F7' : '#fff', borderWidth: 1, borderColor: '#3C4043', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: tilt ? 0.6 : 1 })}
    >
      {logo}
      <T m={16} s={600} c="#1F1F1F">
        {cim}
      </T>
    </Pressable>
  );
}

type Siker = (r: AuthResult) => Promise<void> | void;
type Hiba = (uzenet: string) => void;

/** Weben a Google Identity Services saját gombja (a Google előírása); natívan a natív Google-belépés. */
/** SPEC §31.3: an új fiók forrása (utm, hivatkozó, belépő oldal, cél; a hirdetési rész csak bekapcsolt mérésnél számít). */
export function GoogleGomb({ siker, hiba, webClientId, referralCode, forras }: { siker: Siker; hiba: Hiba; webClientId?: string; referralCode?: string; forras?: ForrasAdat }) {
  const id = webClientId || GOOGLE_WEB_CLIENT_ID;
  const doboz = useRef<React.ComponentRef<typeof View>>(null);
  const [tolt, setTolt] = useState(false);

  const kuld = async (idToken: string) => {
    try {
      const r = await post<AuthResult>('/auth/google', { idToken, clientKind, referralCode, ...(forras ?? {}) }, { auth: false });
      await siker(r);
    } catch (e) {
      hiba(hibaUzenet(e, 'Nem sikerült a Google-belépés.'));
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !id || typeof document === 'undefined') return;
    const indit = () => {
      const g = (window as unknown as { google?: { accounts: { id: { initialize: (o: object) => void; renderButton: (el: Element, o: object) => void } } } }).google;
      const el = doboz.current as unknown as Element | null;
      if (!g || !el) return;
      g.accounts.id.initialize({ client_id: id, callback: (v: { credential: string }) => void kuld(v.credential), ux_mode: 'popup' });
      g.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'hu', width: 340 });
    };
    if (document.getElementById('gsi-script')) {
      indit();
      return;
    }
    const s = document.createElement('script');
    s.id = 'gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = indit;
    document.head.appendChild(s);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS === 'web') return <View ref={doboz} style={{ alignItems: 'center', minHeight: 50 }} />;

  return (
    <CegGomb
      cim="Belépés Google-fiókkal"
      logo={<GLogo />}
      tilt={tolt}
      onPress={async () => {
        setTolt(true);
        try {
          const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
          GoogleSignin.configure({ webClientId: id, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined });
          if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const v = await GoogleSignin.signIn();
          if (isSuccessResponse(v) && v.data.idToken) await kuld(v.data.idToken);
        } catch {
          hiba('Nem sikerült a Google-belépés. Próbáld újra, vagy lépj be e-maillel.');
        } finally {
          setTolt(false);
        }
      }}
    />
  );
}

/** Apple-belépés csak iOS-en, az Apple saját gombjával. */
export function AppleGomb({ siker, hiba, referralCode, forras }: { siker: Siker; hiba: Hiba; referralCode?: string; forras?: ForrasAdat }) {
  const [van, setVan] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setVan).catch(() => setVan(false));
  }, []);
  if (Platform.OS !== 'ios' || !van) return null;
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
      cornerRadius={25}
      style={{ height: 50, width: '100%' }}
      onPress={async () => {
        try {
          const c = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
          if (!c.identityToken) throw new Error('nincs token');
          const r = await post<AuthResult>(
            '/auth/apple',
            { identityToken: c.identityToken, fullName: c.fullName ? { givenName: c.fullName.givenName ?? '', familyName: c.fullName.familyName ?? '' } : undefined, clientKind, referralCode, ...(forras ?? {}) },
            { auth: false },
          );
          await siker(r);
        } catch (e) {
          if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
          hiba(hibaUzenet(e, 'Nem sikerült az Apple-belépés.'));
        }
      }}
    />
  );
}
