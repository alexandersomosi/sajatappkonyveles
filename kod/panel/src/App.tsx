import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './auth/Auth';
import { BelepesOldal, JelszoOldal, KotelezoKetlepcsosOldal } from './auth/pages';
import { Shell } from './layout/Shell';
import { PiritoProvider } from './ui/Pirito';
import { Toltes } from './ui/kozos';
import { ApiError } from './api/client';
import { kezdolap } from './lib/csapat';

const UgyfelLista = lazy(() => import('./pages/acc/UgyfelLista'));
const UgyfelAdatlap = lazy(() => import('./pages/acc/UgyfelAdatlap'));
const HataridoFigyelo = lazy(() => import('./pages/acc/HataridoFigyelo'));
const KeresekSor = lazy(() => import('./pages/acc/KeresekSor'));
const Sablonok = lazy(() => import('./pages/acc/Sablonok'));
const Export = lazy(() => import('./pages/acc/Export'));
const AccNaplo = lazy(() => import('./pages/acc/Naplo'));
const Beallitasok = lazy(() => import('./pages/acc/Beallitasok'));
const Visszahivasok = lazy(() => import('./pages/csapat/Visszahivasok'));
const VallalkozasInditas = lazy(() => import('./pages/csapat/VallalkozasInditas'));
const Regisztracio = lazy(() => import('./pages/csapat/Regisztracio'));
const Helyettunk = lazy(() => import('./pages/csapat/Helyettunk'));
const HelyettunkReszlet = lazy(() => import('./pages/csapat/HelyettunkReszlet'));
const CsapatUzenetek = lazy(() => import('./pages/csapat/Uzenetek'));
const AdminAttekintes = lazy(() => import('./pages/admin/Attekintes'));
const AdminUgyfelek = lazy(() => import('./pages/admin/Ugyfelek'));
const AdminElofizetesek = lazy(() => import('./pages/admin/Elofizetesek'));
const AdminFizetesek = lazy(() => import('./pages/admin/Fizetesek'));
const AdminKonyvelok = lazy(() => import('./pages/admin/Konyvelok'));
const AdminCsapat = lazy(() => import('./pages/admin/Csapat'));
const AdminForrasok = lazy(() => import('./pages/admin/Forrasok'));
const AdminSzovegek = lazy(() => import('./pages/admin/Szovegek'));
const AdminNaplo = lazy(() => import('./pages/admin/Naplo'));
const AdminDemoPosta = lazy(() => import('./pages/admin/DemoPosta'));
const AdminRendszer = lazy(() => import('./pages/admin/Rendszer'));
const HaviValtozasok = lazy(() => import('./pages/acc/HaviValtozasok'));
const AdminDijak = lazy(() => import('./pages/admin/Dijak'));
// SPEC §29 F1 / F9 (B2)
const Igazolasok = lazy(() => import('./pages/acc/Igazolasok'));
const KonzolAttekintes = lazy(() => import('./pages/admin/konzol/Attekintes'));
const KonzolUgyfelek = lazy(() => import('./pages/admin/konzol/Ugyfelek'));
const KonzolUgyfelKartya = lazy(() => import('./pages/admin/konzol/UgyfelKartya'));

let goTotpSetup: (() => void) | null = null;
const onApiError = (e: unknown) => {
  if (e instanceof ApiError && e.code === 'totp_setup_required') goTotpSetup?.();
};
const qc = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  },
});

function TotpBridge() {
  const nav = useNavigate();
  useEffect(() => {
    goTotpSetup = () => nav('/ketlepcsos-beallitas');
    return () => {
      goTotpSetup = null;
    };
  }, [nav]);
  return null;
}

/** Logged-in staff only (client accounts are refused at login), mandatory 2FA set up. */
function Vedett({ children }: { children: ReactNode }) {
  const { betoltve, user, totpBeallitasKell } = useAuth();
  if (!betoltve) return <Toltes />;
  if (!user || user.role === 'client') return <Navigate to="/belepes" replace />;
  // Mandatory 2FA not set up yet: do not mount the shell (its queries would all be 403).
  if (totpBeallitasKell) return <Navigate to="/ketlepcsos-beallitas" replace />;
  return <>{children}</>;
}

type Szerep = 'konyvelo' | 'admin' | 'csapat';
/** Page-level role gate (SPEC §26.3.1, §26.4). The API enforces the same; this only keeps the menu honest. */
function Csak({ szerep, children }: { szerep: Szerep[]; children: ReactNode }) {
  const { user, isAccountant, isAdmin, isCsapat } = useAuth();
  const van = (isAccountant && szerep.includes('konyvelo')) || (isAdmin && szerep.includes('admin')) || (isCsapat && szerep.includes('csapat'));
  if (!van) return <Navigate to={kezdolap(user?.role, isAccountant)} replace />;
  return <Suspense fallback={<Toltes />}>{children}</Suspense>;
}
function Kezdo() {
  const { betoltve, user, isAccountant } = useAuth();
  if (!betoltve) return <Toltes />;
  if (!user) return <Navigate to="/belepes" replace />;
  return <Navigate to={kezdolap(user.role, isAccountant)} replace />;
}
function Nyilvanos({ children }: { children: ReactNode }) {
  const { betoltve, user } = useAuth();
  if (!betoltve) return <Toltes />;
  if (user && user.role !== 'client') return <Navigate to="/" replace />;
  return <>{children}</>;
}

const K: Szerep[] = ['konyvelo'];
const AD: Szerep[] = ['admin'];
const CS: Szerep[] = ['csapat'];

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <PiritoProvider>
          <BrowserRouter>
            <TotpBridge />
            <Routes>
              <Route path="/belepes" element={<Nyilvanos><BelepesOldal /></Nyilvanos>} />
              <Route path="/jelszo" element={<JelszoOldal />} />
              <Route path="/ketlepcsos-beallitas" element={<KotelezoKetlepcsosOldal />} />
              <Route path="/" element={<Kezdo />} />
              <Route element={<Vedett><Shell /></Vedett>}>
                <Route path="/ugyfelek" element={<Csak szerep={K}><UgyfelLista /></Csak>} />
                <Route path="/ugyfelek/:id" element={<Csak szerep={K}><UgyfelAdatlap /></Csak>} />
                <Route path="/ugyfelek/:id/:ful" element={<Csak szerep={K}><UgyfelAdatlap /></Csak>} />
                <Route path="/hatarido-figyelo" element={<Csak szerep={K}><HataridoFigyelo /></Csak>} />
                <Route path="/keresek" element={<Csak szerep={K}><KeresekSor /></Csak>} />
                <Route path="/sablonok" element={<Csak szerep={K}><Sablonok /></Csak>} />
                {/* SPEC §26.2.9: booking is retired; old links land on the callback queue. */}
                <Route path="/idopontok" element={<Navigate to="/visszahivasok" replace />} />
                <Route path="/export" element={<Csak szerep={K}><Export /></Csak>} />
                <Route path="/naplo" element={<Csak szerep={K}><AccNaplo /></Csak>} />
                <Route path="/beallitasok" element={<Csak szerep={['konyvelo', 'csapat']}><Beallitasok /></Csak>} />
                {/* SPEC §26.3: service team (csapat), the owner, and the accountant for callbacks handed to him. */}
                <Route path="/visszahivasok" element={<Csak szerep={['konyvelo', 'admin', 'csapat']}><Visszahivasok /></Csak>} />
                {/* SPEC §27.6: "Intézzük helyette" – csapat, admin, and the accountant for his own clients (the API returns 404 otherwise). */}
                <Route path="/helyettunk" element={<Csak szerep={['konyvelo', 'admin', 'csapat']}><Helyettunk /></Csak>} />
                <Route path="/helyettunk/:id" element={<Csak szerep={['konyvelo', 'admin', 'csapat']}><HelyettunkReszlet /></Csak>} />
                <Route path="/vallalkozas-inditas" element={<Csak szerep={['admin', 'csapat']}><VallalkozasInditas /></Csak>} />
                <Route path="/vallalkozas-inditas/:id" element={<Csak szerep={['admin', 'csapat']}><Regisztracio /></Csak>} />
                <Route path="/uzenetek" element={<Csak szerep={CS}><CsapatUzenetek /></Csak>} />
                <Route path="/uzenetek/:clientId" element={<Csak szerep={CS}><CsapatUzenetek /></Csak>} />
                <Route path="/admin" element={<Csak szerep={AD}><AdminAttekintes /></Csak>} />
                <Route path="/admin/ugyfelek" element={<Csak szerep={AD}><AdminUgyfelek /></Csak>} />
                <Route path="/admin/elofizetesek" element={<Csak szerep={AD}><AdminElofizetesek /></Csak>} />
                <Route path="/admin/fizetesek" element={<Csak szerep={AD}><AdminFizetesek /></Csak>} />
                <Route path="/admin/konyvelok" element={<Csak szerep={AD}><AdminKonyvelok /></Csak>} />
                <Route path="/admin/csapat" element={<Csak szerep={AD}><AdminCsapat /></Csak>} />
                <Route path="/admin/forrasok" element={<Csak szerep={AD}><AdminForrasok /></Csak>} />
                <Route path="/admin/szovegek" element={<Csak szerep={AD}><AdminSzovegek /></Csak>} />
                <Route path="/admin/naplo" element={<Csak szerep={AD}><AdminNaplo /></Csak>} />
                <Route path="/admin/demo-postafiok" element={<Csak szerep={AD}><AdminDemoPosta /></Csak>} />
                <Route path="/admin/rendszer" element={<Csak szerep={AD}><AdminRendszer /></Csak>} />
                {/* SPEC §28.K.2 / §28.K.1 */}
                <Route path="/havi-valtozasok" element={<Csak szerep={['konyvelo', 'admin', 'csapat']}><HaviValtozasok /></Csak>} />
                <Route path="/admin/dijak" element={<Csak szerep={AD}><AdminDijak /></Csak>} />
                {/* SPEC §29.5 F1: the certificate queue (accountant: own clients; admin: all) */}
                <Route path="/igazolasok" element={<Csak szerep={['konyvelo', 'admin']}><Igazolasok /></Csak>} />
                <Route path="/igazolasok/:id" element={<Csak szerep={['konyvelo', 'admin']}><Igazolasok /></Csak>} />
                {/* SPEC §29.9 F9: the owner console (admin + TOTP; writes need a step-up) */}
                <Route path="/admin/konzol" element={<Csak szerep={AD}><KonzolAttekintes /></Csak>} />
                <Route path="/admin/konzol/ugyfelek" element={<Csak szerep={AD}><KonzolUgyfelek /></Csak>} />
                <Route path="/admin/konzol/ugyfelek/:id" element={<Csak szerep={AD}><KonzolUgyfelKartya /></Csak>} />
                <Route path="/admin/beallitasok" element={<Csak szerep={AD}><Beallitasok /></Csak>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </PiritoProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
