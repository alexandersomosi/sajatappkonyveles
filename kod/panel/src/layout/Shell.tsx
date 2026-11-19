// App shell: white left navigation with 3D icons, content on the tinted ground. The menu depends on the role
// (SPEC §26.3.1): the service team (csapat) sees only its queues, the accountant no longer has Időpontok.
import { NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import brand from '../_shared/brand.json';
import { useAuth } from '../auth/Auth';
import { I3 } from '../ui/Icon3d';
import { Avatar, Logo } from '../ui/kozos';
import * as ep from '../api/endpoints';
import { menuCsoportok, nyitottVisszahivas, type MenuCsoport, type MenuKulcs } from '../lib/csapat';
import { labdaNalam } from '../lib/helyettunk';
import { Ertesitesek } from './Ertesitesek';

type Szamlalo = Partial<Record<MenuKulcs, { n: number; hiba?: boolean; cim?: string }>>;

function Csoport({ cs, db }: { cs: MenuCsoport; db: Szamlalo }) {
  return (
    <div className="nav-csoport">
      <div className="nav-cim">{cs.cim}</div>
      {cs.elemek.map((e) => {
        const d = db[e.kulcs];
        return (
          <NavLink key={e.to} to={e.to} end={e.end} className={({ isActive }) => `nav-elem${isActive ? ' on' : ''}`} title={d?.cim ?? e.felirat}>
            {e.karakter ? <img className="i3" src="/a/avatar/karakter_1_lapos@2x.png" srcSet="/a/avatar/karakter_1_lapos@2x.png 2x, /a/avatar/karakter_1_lapos@3x.png 3x" width={28} height={28} style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover', background: '#E6ECF4' }} alt="" /> : <I3 n={e.ikon} s={28} />}
            {e.felirat}
            {!!d?.n && <span className={`db${d.hiba ? ' hiba' : ''}`}>{d.n}</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

export function Shell() {
  const { user, me, isAccountant, isAdmin, isCsapat, konyvelo, kilep, demo } = useAuth();
  // Same query and the same count as the Kérések page header ("ügyfélkérés vár rád": open or in progress).
  const keresek = useQuery({
    queryKey: ['acc', 'requests', 'all'],
    queryFn: () => ep.accRequests({}),
    enabled: isAccountant,
    staleTime: 60_000,
  });
  const nyitott = keresek.data?.items.filter((r) => r.direction === 'ugyfeltol' && (r.status === 'nyitott' || r.status === 'folyamatban')).length ?? 0;
  // Team queues (csapat, admin): one small summary call, refreshed every minute.
  const osszeg = useQuery({ queryKey: ['team', 'summary'], queryFn: ep.teamSummary, enabled: isCsapat || isAdmin, staleTime: 30_000, refetchInterval: 60_000 });
  // Accountant: the menu item appears only when a callback was ever handed to him (SPEC §26.3.1).
  const sajat = useQuery({
    queryKey: ['team', 'callbacks', 'konyvelo-menu'],
    queryFn: () => ep.teamCallbacks({ filter: 'mind' }),
    enabled: isAccountant && !isCsapat,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const sajatSorok = sajat.data?.items ?? [];
  // SPEC §27.6.1: the accountant sees "Intézzük helyette" only when one of his clients has (had) an assisted request;
  // his badge = items whose ball is on him ("Neked"). Same query key as the queue page.
  const sajatAssist = useQuery({
    queryKey: ['team', 'assists', 'mind'],
    queryFn: () => ep.teamAssistsAll({ filter: 'mind' }),
    enabled: isAccountant && !isCsapat && !isAdmin,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const assistSorok = sajatAssist.data ?? [];
  const neked = assistSorok.filter((r) => labdaNalam(r, 'konyvelo')).length;

  const cb = osszeg.data?.callbacks;
  const db: Szamlalo = {
    keresek: { n: nyitott },
    visszahivasok: cb
      ? { n: cb.open, hiba: cb.overdue > 0, cim: cb.overdue > 0 ? `Visszahívások: ${cb.open} nyitott, ebből ${cb.overdue} lejárt` : `Visszahívások: ${cb.open} nyitott` }
      : { n: sajatSorok.filter((r) => nyitottVisszahivas(r.status)).length, hiba: sajatSorok.some((r) => r.overdue) },
    vallalkozas: { n: osszeg.data?.registrations.beadva ?? 0, cim: 'Vállalkozás-indítás: ellenőrzésre vár' },
    helyettunk: osszeg.data?.assists
      ? {
          n: osszeg.data.assists.waitingOnMe + osszeg.data.assists.approvalOverdue,
          hiba: osszeg.data.assists.approvalOverdue > 0,
          cim: `Intézzük helyette: ${osszeg.data.assists.waitingOnMe} vár ránk${osszeg.data.assists.approvalOverdue ? `, ${osszeg.data.assists.approvalOverdue} lejárt jóváhagyás` : ''}`,
        }
      : { n: neked, cim: `Intézzük helyette: ${neked} vár rád` },
    uzenetek: { n: osszeg.data?.unreadThreads ?? 0, cim: 'Üzenetek: olvasatlan beszélgetés' },
  };
  const csoportok = menuCsoportok({
    csapat: isCsapat,
    konyvelo: isAccountant && !isCsapat,
    admin: isAdmin,
    demo,
    konyvelonekVoltVisszahivasa: sajatSorok.length > 0,
    konyvelonekVoltHelyettunk: assistSorok.length > 0,
  });
  const nev = isCsapat ? (me?.teamMember?.displayName ?? user?.displayName) : (konyvelo?.displayName ?? user?.displayName);
  const al = isCsapat ? 'Ügyfélszolgálati felület' : isAdmin && !isAccountant ? 'Tulajdonosi felület' : 'Könyvelői felület';
  const beallitas = isAccountant || isCsapat ? '/beallitasok' : '/admin/beallitasok';

  return (
    <div className="keret">
      <aside className="oldalsav" aria-label="Menü">
        <div className="logo">
          <Logo />
          <div>
            <div className="nev">{brand.name}</div>
            <div className="al">{al}</div>
          </div>
        </div>
        {import.meta.env.VITE_MOCK_API === '1' ? (
          <div className="demo-sav">HELYI MINTA – nincs szerver, minden adat kitalált</div>
        ) : (
          demo && (
            <div className="demo-sav" title="APP_ENV=demo: minden adat kitalált, a fizetés, az e-mail és a NAV demó módban fut.">
              DEMO – kitalált adatok, éles kapcsolat nincs
            </div>
          )
        )}
        {csoportok.map((cs) => (
          <Csoport key={cs.cim} cs={cs} db={db} />
        ))}
        <div className="nav-csoport">
          <Ertesitesek />
        </div>
        <div className="oldalsav-alj">
          {isAccountant && !isCsapat ? <Avatar avatarKey={konyvelo?.avatarKey} /> : <I3 n="fiok" s={36} />}
          <div className="ki">
            <b>{nev}</b>
            <span style={{ display: 'flex', gap: 12 }}>
              <NavLink className="gomb-sz" style={{ fontSize: 13 }} to={beallitas}>
                Beállítások
              </NavLink>
              <button className="gomb-sz" style={{ fontSize: 13 }} onClick={() => void kilep()}>
                Kilépés
              </button>
            </span>
          </div>
        </div>
      </aside>
      <main className="fo">
        <Outlet />
      </main>
    </div>
  );
}
