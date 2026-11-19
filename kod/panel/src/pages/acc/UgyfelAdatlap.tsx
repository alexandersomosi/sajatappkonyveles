// FUNKCIOK 21: client detail – band with name, flags and quick actions; tabs for every area.
import { lazy, Suspense } from 'react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, HibaSav, Toltes, DemoCimke } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { FLAG_LABEL, LIFECYCLE_LABEL } from '../../lib/labels';
import { datum, hatridoSzoveg } from '../../lib/format';
import { today } from '../../lib/today';
import type { AccClientDetail } from '../../api/types';

const Attekintes = lazy(() => import('./ugyfel/Attekintes'));
const Bekotes = lazy(() => import('./ugyfel/Bekotes'));
const Dosszie = lazy(() => import('./ugyfel/Dosszie'));
const NavSzamlak = lazy(() => import('./ugyfel/NavSzamlak'));
const Bevetelek = lazy(() => import('./ugyfel/Bevetelek'));
const Ado = lazy(() => import('./ugyfel/Ado'));
const Uzenetek = lazy(() => import('./ugyfel/Uzenetek'));
const Keresek = lazy(() => import('./ugyfel/Keresek'));
const Visszahivasok = lazy(() => import('./ugyfel/Visszahivasok'));
const Naplo = lazy(() => import('./ugyfel/Naplo'));

export type FulProps = { c: AccClientDetail };
const FULEK: { kulcs: string; felirat: string; db?: (c: AccClientDetail) => number }[] = [
  { kulcs: 'attekintes', felirat: 'Áttekintés' },
  // The new-business step waits for the service team, not for the accountant (SPEC §26.1.6).
  { kulcs: 'bekotes', felirat: 'Bekötés', db: (c) => c.onboarding.steps.filter((s) => s.status === 'konyvelore_var' && s.step !== 'vallalkozas_inditas').length },
  { kulcs: 'dosszie', felirat: 'Dosszié' },
  { kulcs: 'nav', felirat: 'Kiállított számlák' }, // SPEC §27.5.2 (slug unchanged)
  { kulcs: 'bevetelek', felirat: 'Bevételek' },
  { kulcs: 'ado', felirat: 'Adó' },
  { kulcs: 'uzenetek', felirat: 'Üzenetek', db: (c) => c.unreadMessages },
  { kulcs: 'keresek', felirat: 'Kérések', db: (c) => c.openRequestsFromClient },
  { kulcs: 'visszahivasok', felirat: 'Visszahívások' },
  { kulcs: 'naplo', felirat: 'Napló' },
];

export default function UgyfelAdatlap() {
  const { id = '', ful = 'attekintes' } = useParams();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['acc', 'client', id], queryFn: () => ep.accClient(id) });
  const t = today();
  // SPEC §26.2.9: the old Időpontok tab became Visszahívások.
  if (ful === 'idopontok') return <Navigate to={`/ugyfelek/${id}/visszahivasok`} replace />;
  // An unknown tab slug (old link, typo) goes to the overview instead of silently showing it with no tab lit.
  if (!FULEK.some((f) => f.kulcs === ful)) return <Navigate to={`/ugyfelek/${id}/attekintes`} replace />;
  if (q.isPending) return <Toltes />;
  if (q.isError)
    return (
      <div className="tartalom">
        <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        <p style={{ marginTop: 12 }}>
          <Link to="/ugyfelek">Vissza az ügyfelekhez</Link>
        </p>
      </div>
    );
  const c = q.data;
  const nd = c.nextDeadline;
  const tab = (() => {
    switch (ful) {
      case 'bekotes':
        return <Bekotes c={c} />;
      case 'dosszie':
        return <Dosszie c={c} />;
      case 'nav':
        return <NavSzamlak c={c} />;
      case 'bevetelek':
        return <Bevetelek c={c} />;
      case 'ado':
        return <Ado c={c} />;
      case 'uzenetek':
        return <Uzenetek c={c} />;
      case 'keresek':
        return <Keresek c={c} />;
      case 'visszahivasok':
        return <Visszahivasok c={c} />;
      case 'naplo':
        return <Naplo c={c} />;
      default:
        return <Attekintes c={c} />;
    }
  })();
  return (
    <>
      <Fejlec
        rozR={380}
        felcim={<Link to="/ugyfelek">Vissza az ügyfelekhez</Link>}
        cim={
          <>
            {c.name}{' '}
            {c.flags
              .filter((f) => f !== 'rendben')
              .map((f) => (
                <span key={f} className={`cimke ${f === 'dij_elmaradt' ? 'hiba' : f === 'bekotes_alatt' ? 'info' : 'figyel'}`} style={{ marginLeft: 6 }}>
                  {FLAG_LABEL[f]}
                </span>
              ))}
            {c.demo && (
              <span style={{ marginLeft: 8 }}>
                <DemoCimke>DEMO</DemoCimke>
              </span>
            )}
          </>
        }
        mellek={
          <>
            {[c.activityText, c.adoszam && `adószám ${c.adoszam}`, c.lifecycle === 'bekotes_alatt' ? `bekötés alatt, regisztrált: ${datum(c.clientSince, { ev: true })}` : `${LIFECYCLE_LABEL[c.lifecycle].toLowerCase()} ügyfél ${datum(c.clientSince, { ev: true })} óta`]
              .filter(Boolean)
              .map((x, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <span className={String(x).length < 44 ? "egyben" : undefined}>{x}</span>
                </span>
              ))}
            {nd && (
              <>
                <br />
                Következő: <b className="egyben">{datum(nd.dueDate)}</b> – {nd.title} <span className="egyben">({hatridoSzoveg(nd.dueDate, t)})</span>
              </>
            )}
          </>
        }
        jobb={
          <>
            <button className="gomb-sav" onClick={() => nav(`/ugyfelek/${id}/uzenetek`)}>
              <I3 n="uzenetek" s={24} />
              Üzenet
            </button>
            <button className="gomb-sav" onClick={() => nav(`/ugyfelek/${id}/keresek?uj=1`)}>
              <I3 n="igazolas" s={24} />
              Kérés
            </button>
            <button className="gomb-sav" onClick={() => nav(`/ugyfelek/${id}/ado`)}>
              <I3 n="szamolo" s={24} />
              Számolás
            </button>
          </>
        }
        fulek={FULEK.map((f) => {
          const n = f.db?.(c) ?? 0;
          return (
            <NavLink key={f.kulcs} to={`/ugyfelek/${id}/${f.kulcs}`} className={() => `ful${ful === f.kulcs ? ' on' : ''}`} replace>
              {f.felirat}
              {n > 0 && <span className="db">{n}</span>}
            </NavLink>
          );
        })}
      />
      <div className="tartalom">
        <Suspense fallback={<Toltes />}>{tab}</Suspense>
      </div>
    </>
  );
}
