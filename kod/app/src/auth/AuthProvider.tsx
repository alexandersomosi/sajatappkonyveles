// Belépés, munkamenet, biometrikus zár (SPEC §4.1). A hozzáférési token csak memóriában van; a frissítő token
// natívan a secure-store-ban, weben HttpOnly sütiben. A biometrikus zár csak az appon belül véd (nincs szerveroldala).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResult, AuthUser, RegisterInput } from '../_shared/api';
import { ApiHiba, frissit, hozzaferesBeallit, post, tokenKezelo } from '../api/http';
import { brand, ZAR_UTAN_MS } from '../config';
import { beallitasIr, beallitasOlvas, titokIr, titokOlvas } from '../lib/tarolo';

const RT = 'kj_rt';
const BIO = 'kj_bio';

type Allapot = 'betolt' | 'kint' | 'bent';
interface AuthCtx {
  allapot: Allapot;
  user: AuthUser | null;
  zarva: boolean;
  bio: { elerheto: boolean; be: boolean };
  belep(email: string, jelszo: string, opt?: { torlesVisszavon?: boolean }): Promise<{ mfaToken?: string }>;
  belepKoddal(mfaToken: string, kod: string): Promise<void>;
  regisztral(adat: Omit<RegisterInput, 'platform'>): Promise<AuthResult>;
  alkalmaz(r: AuthResult): Promise<void>;
  kilep(mindenhol?: boolean): Promise<void>;
  feloldas(): Promise<boolean>;
  bioBeallit(be: boolean): Promise<boolean>;
  frissitUser(u: Partial<AuthUser>): void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider hiányzik');
  return c;
}

const clientKind = Platform.OS === 'web' ? 'web' : 'native';

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [allapot, setAllapot] = useState<Allapot>('betolt');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [zarva, setZarva] = useState(false);
  const [bio, setBio] = useState({ elerheto: false, be: false });
  const hatterbe = useRef<number | null>(null);

  const alkalmaz = useCallback(async (r: AuthResult) => {
    hozzaferesBeallit(r.accessToken, r.accessTokenExpiresAt);
    if (r.refreshToken) await titokIr(RT, r.refreshToken);
    setUser(r.user);
    setAllapot('bent');
  }, []);

  const torol = useCallback(async () => {
    hozzaferesBeallit(null);
    await titokIr(RT, null);
    setUser(null);
    setAllapot('kint');
    qc.clear();
  }, [qc]);

  useEffect(() => {
    tokenKezelo({
      frissitoToken: () => titokOlvas(RT),
      ujMunkamenet: async (r) => {
        const a = r as AuthResult;
        if (a.refreshToken) await titokIr(RT, a.refreshToken);
        setUser(a.user);
        setAllapot('bent');
      },
      kijelentkezett: () => {
        void torol();
      },
    });
  }, [torol]);

  // indulás: biometrikus zár (ha be van kapcsolva), aztán csendes frissítés
  useEffect(() => {
    (async () => {
      let elerheto = false;
      if (Platform.OS !== 'web') {
        try {
          elerheto = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
        } catch {
          elerheto = false;
        }
      }
      const be = elerheto && (await beallitasOlvas(BIO)) === '1';
      setBio({ elerheto, be });
      const vanRT = Platform.OS === 'web' || !!(await titokOlvas(RT));
      if (be && vanRT) {
        setZarva(true);
        const r = await LocalAuthentication.authenticateAsync({ promptMessage: `${brand.name} megnyitása`, cancelLabel: 'Mégse' }).catch(() => ({ success: false }));
        if (!r.success) {
          setAllapot('kint'); // a zár képernyő ad újrapróbálást
          return;
        }
        setZarva(false);
      }
      const sikerult = vanRT ? await frissit() : false;
      if (!sikerult) setAllapot('kint');
    })();
  }, []);

  // háttérből vissza: 5 perc után újra zár
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') {
        if (hatterbe.current === null) hatterbe.current = Date.now();
      } else if (s === 'active') {
        const mikor = hatterbe.current;
        hatterbe.current = null;
        if (bio.be && allapot === 'bent' && mikor && Date.now() - mikor >= ZAR_UTAN_MS) setZarva(true);
      }
    });
    return () => sub.remove();
  }, [bio.be, allapot]);

  const feloldas = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: `${brand.name} megnyitása`, cancelLabel: 'Mégse' }).catch(() => ({ success: false }));
    if (!r.success) return false;
    setZarva(false);
    if (allapot !== 'bent') {
      setAllapot('betolt');
      if (!(await frissit())) setAllapot('kint');
    }
    return true;
  }, [allapot]);

  const ertek = useMemo<AuthCtx>(
    () => ({
      allapot,
      user,
      zarva,
      bio,
      async belep(email, jelszo, opt) {
        try {
          const r = await post<AuthResult>('/auth/login', { email: email.trim(), password: jelszo, clientKind, ...(opt?.torlesVisszavon ? { cancelDeletion: true } : {}) }, { auth: false });
          await alkalmaz(r);
          return {};
        } catch (e) {
          if (e instanceof ApiHiba && e.code === 'mfa_required' && typeof e.data?.mfaToken === 'string') return { mfaToken: e.data.mfaToken };
          throw e;
        }
      },
      async belepKoddal(mfaToken, kod) {
        const r = await post<AuthResult>('/auth/login/totp', { mfaToken, code: kod.trim() }, { auth: false });
        await alkalmaz(r);
      },
      async regisztral(adat) {
        const platform = Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android';
        const r = await post<AuthResult>('/auth/register', { ...adat, platform }, { auth: false });
        await alkalmaz(r);
        return r;
      },
      alkalmaz,
      async kilep(mindenhol) {
        try {
          await post(mindenhol ? '/auth/logout-all' : '/auth/logout');
        } catch (e) {
          // Already logged out on the server (401): the local exit is enough. Anything else (network,
          // 403, 5xx) means the refresh cookie may still be valid on a shared computer: tell the user
          // instead of pretending, and keep the session so they can try again.
          if (!(e instanceof ApiHiba && e.status === 401)) {
            throw new ApiHiba(e instanceof ApiHiba ? e.status : 0, 'kilepes_sikertelen', 'Nem sikerült kijelentkezni a szerveren. Nézd meg az internetet, és próbáld újra.');
          }
        }
        await torol();
      },
      feloldas,
      async bioBeallit(be) {
        if (be) {
          const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Biometrikus zár bekapcsolása', cancelLabel: 'Mégse' }).catch(() => ({ success: false }));
          if (!r.success) return false;
        }
        await beallitasIr(BIO, be ? '1' : null);
        setBio((b) => ({ ...b, be }));
        return true;
      },
      frissitUser(u) {
        setUser((x) => (x ? { ...x, ...u } : x));
      },
    }),
    [allapot, user, zarva, bio, alkalmaz, torol, feloldas],
  );

  return <Ctx.Provider value={ertek}>{children}</Ctx.Provider>;
}
