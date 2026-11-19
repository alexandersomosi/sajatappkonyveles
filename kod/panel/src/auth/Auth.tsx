// Session bootstrap for the panel: refresh with the cookie, load /me, /config and (for accountants) /acc/settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthChange, refreshSession, setSession, currentUser } from '../api/client';
import * as ep from '../api/endpoints';
import type { AuthUser, Me, PublicConfig } from '../_shared/api';
import type { AccSettings } from '../api/types';

interface AuthState {
  betoltve: boolean;
  user: AuthUser | null;
  me: Me | null;
  config: PublicConfig | null;
  konyvelo: AccSettings | null; // the logged-in accountant's own profile (firstName for "Bence látta", signature)
  frissit: () => Promise<void>;
  kilep: () => Promise<void>;
  isAccountant: boolean;
  isAdmin: boolean;
  /** SPEC §26.4: service team member (ügyfélszolgálat): callbacks, new-business pipeline, onboarding messages. */
  isCsapat: boolean;
  demo: boolean;
  /** STAFF_TOTP_REQUIRED on the server (from /me): staff cannot work or switch 2FA off without it. */
  totpKotelezo: boolean;
  /** Logged-in staff who still has to set up 2FA: nothing but the setup page may load. */
  totpBeallitasKell: boolean;
}

const Ctx = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}
/** First name of the logged-in accountant (falls back to "A könyvelő"). */
export function useKonyveloNev(): string {
  const { konyvelo, user } = useAuth();
  return konyvelo?.firstName ?? user?.displayName?.split(' ').slice(-1)[0] ?? 'A könyvelő';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [betoltve, setBetoltve] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(currentUser());
  const [me, setMe] = useState<Me | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [konyvelo, setKonyvelo] = useState<AccSettings | null>(null);

  const loadProfile = useCallback(async (u: AuthUser | null) => {
    if (!u) {
      setMe(null);
      setKonyvelo(null);
      return;
    }
    try {
      const m = await ep.getMe();
      setMe(m);
      // Without the mandatory 2FA every /acc call is a 403: do not even ask.
      const beallitasKell = (m as Me & { staffTotpRequired?: boolean }).staffTotpRequired && !m.user.totpEnabled;
      if (!beallitasKell && (u.role === 'accountant' || m.staffAccountantId)) {
        try {
          setKonyvelo(await ep.accSettings());
        } catch {
          setKonyvelo(null);
        }
      }
    } catch {
      /* handled by pages */
    }
  }, []);

  useEffect(() => {
    const off = onAuthChange((u) => {
      setUser(u);
    });
    (async () => {
      try {
        setConfig(await ep.getConfig());
      } catch {
        setConfig(null);
      }
      const ok = await refreshSession();
      if (ok) await loadProfile(currentUser());
      setBetoltve(true);
    })();
    return off;
  }, [loadProfile]);

  useEffect(() => {
    if (betoltve) void loadProfile(user);
    // only when the user id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const kilep = useCallback(async () => {
    try {
      await ep.logout();
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      betoltve,
      user,
      me,
      config,
      konyvelo,
      frissit: () => loadProfile(currentUser()),
      kilep,
      isAccountant: user?.role === 'accountant' || !!me?.staffAccountantId,
      isAdmin: user?.role === 'admin',
      isCsapat: user?.role === 'csapat',
      demo: config?.demo ?? false,
      totpKotelezo: !!(me as (Me & { staffTotpRequired?: boolean }) | null)?.staffTotpRequired,
      totpBeallitasKell: !!user && user.role !== 'client' && !user.totpEnabled && !!(me as (Me & { staffTotpRequired?: boolean }) | null)?.staffTotpRequired,
    }),
    [betoltve, user, me, config, konyvelo, kilep, loadProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
