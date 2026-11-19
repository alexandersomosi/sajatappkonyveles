// FUNKCIOK 29, 30: owner dashboard – KPI tiles, fee revenue by month, onboarding funnel, accountant workload.
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, HibaSav, NagyFt, Oszlopok, Toltes } from '../../ui/kozos';
import { I3, type Icon3dName } from '../../ui/Icon3d';
import { HONAPOK_ROVID, ft, szam } from '../../lib/format';

function Kpi({ ikon, ertek, mi, to }: { ikon: Icon3dName; ertek: React.ReactNode; mi: string; to?: string }) {
  const tartalom = (
    <>
      <I3 n={ikon} s={44} />
      <div>
        <div className="ertek">{ertek}</div>
        <div className="mi">{mi}</div>
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="lap kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
      {tartalom}
    </Link>
  ) : (
    <div className="lap kpi">{tartalom}</div>
  );
}

export default function Attekintes() {
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ep.adminDashboard });
  const d = q.data;
  const f = d?.funnel;
  const lepcsok = f
    ? [
        { k: 'Regisztrált', n: f.registered },
        { k: 'Elkezdte a bekötést', n: f.onboardingStarted },
        { k: 'Előfizetett', n: f.subscribed },
        { k: 'Aktív (minden kész)', n: f.active },
      ]
    : [];
  const max = Math.max(1, ...lepcsok.map((l) => l.n));
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Áttekintés"
        nagyszam={d ? <NagyFt n={d.mrrHuf} /> : undefined}
        mellek={d ? <>havi ismétlődő díjbevétel (MRR){d.endingSubscriptions ? <> · <b>{d.endingSubscriptions}</b> lemondta, időszak végén megszűnik (nincs benne)</> : null} · <b>{d.clients.total}</b> ügyfél, ebből <b>{d.clients.newThisMonth}</b> új ebben a hónapban</> : ' '}
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending ? (
          <Toltes />
        ) : (
          d && (
            <>
              <div className="racs k4">
                <Kpi ikon="fiok" ertek={szam(d.clients.byLifecycle.aktiv ?? 0)} mi="aktív ügyfél" to="/admin/ugyfelek" />
                <Kpi ikon="dosszie" ertek={szam(d.clients.byLifecycle.bekotes_alatt ?? 0)} mi="bekötés alatt" to="/admin/ugyfelek?status=bekotes_alatt" />
                <Kpi ikon="szamlaszam" ertek={szam(d.failedPayments)} mi="sikertelen fizetés" to="/admin/fizetesek?status=failed" />
                <Kpi ikon="boritek" ertek={szam(d.cancellationsThisMonth)} mi="lemondás ebben a hónapban" to="/admin/elofizetesek?status=canceled" />
              </div>
              {d.service && (
                <div className="racs k2" style={{ marginTop: 16 }}>
                  <Link to="/visszahivasok" className="lap kpi szolg" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <I3 n="ora" s={44} />
                    <div style={{ flex: 1 }}>
                      <div className="sor-flex" style={{ gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span className="ertek">{szam(d.service.callbacks.open)}</span>
                        <span className="mi" style={{ marginTop: 0 }}>nyitott visszahívás</span>
                        {d.service.callbacks.overdue > 0 && <span className="cimke hiba">{d.service.callbacks.overdue} lejárt (48 óra)</span>}
                      </div>
                      <div className="mi">
                        {d.service.callbacks.medianFirstAttemptHours30d !== null
                          ? <>Az első hívásig átlagosan (medián) <b className="szam">{d.service.callbacks.medianFirstAttemptHours30d.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} óra</b> telt el az elmúlt 30 napban.</>
                          : 'Az elmúlt 30 napban még nem volt hívás.'}{' '}
                        Ebben a hónapban {szam(d.service.callbacks.doneThisMonth)} ügyféllel beszéltünk.
                      </div>
                    </div>
                  </Link>
                  <Link to="/vallalkozas-inditas" className="lap kpi szolg" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <I3 n="bevallas" s={44} />
                    <div style={{ flex: 1 }}>
                      <div className="sor-flex" style={{ gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span className="ertek">{szam(d.service.registrations.inPipeline)}</span>
                        <span className="mi" style={{ marginTop: 0 }}>ügyfél indítja most a vállalkozását</span>
                      </div>
                      <div className="mi">
                        Ebben a hónapban {szam(d.service.registrations.doneThisMonth)} vállalkozás indult el
                        {d.service.registrations.withdrawnThisMonth > 0 ? `, ${szam(d.service.registrations.withdrawnThisMonth)} ügyfél elállt` : ''}. Alapból az ügyfél maga küldi be; ha kéri, a könyvelője meghatalmazottként. Mi ellenőrizzük.
                      </div>
                    </div>
                  </Link>
                </div>
              )}
              {d.service?.assists && (
                <div className="racs k2" style={{ marginTop: 16 }}>
                  {/* SPEC §27.6.4: the assisted path ("Intézzük helyette") */}
                  <Link to="/helyettunk" className="lap kpi szolg kiemelt-csempe" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <I3 n="igazolas" s={44} />
                    <div style={{ flex: 1 }}>
                      <div className="sor-flex" style={{ gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span className="ertek">{szam(d.service.assists.open)}</span>
                        <span className="mi" style={{ marginTop: 0 }}>nyitott „Intézzük helyette” kérés</span>
                        {d.service.assists.expiredApprovals30d > 0 && <span className="cimke figyel">{d.service.assists.expiredApprovals30d} lejárt jóváhagyás (30 nap)</span>}
                      </div>
                      <div className="mi">
                        Ebben a hónapban {szam(d.service.assists.doneThisMonth)} kész.{' '}
                        {d.service.assists.medianDaysToDone30d !== null ? (
                          <>
                            A kéréstől a készig átlagosan (medián){' '}
                            <b className="szam">{d.service.assists.medianDaysToDone30d.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} nap</b> telt el az elmúlt 30 napban.
                          </>
                        ) : (
                          'Az elmúlt 30 napban még nem lett kész ilyen kérés.'
                        )}{' '}
                        A beküldés a könyvelő dolga, a saját belépésével; az ügyfél a NAV-nál hagyja jóvá.
                      </div>
                    </div>
                  </Link>
                </div>
              )}
              <div className="racs fo-mellek" style={{ marginTop: 16 }}>
                <div className="lap">
                  <div className="lap-fej">
                    <h2>Díjbevétel havonta</h2>
                    <span className="megj">sikeres SimplePay-terhelések, bruttó</span>
                  </div>
                  <Oszlopok
                    adatok={d.revenueByMonth.map((m) => ({
                      kulcs: m.month,
                      felirat: HONAPOK_ROVID[Number(m.month.slice(5)) - 1]!,
                      ertek: m.amountHuf,
                      tipp: `${m.month}: ${ft(m.amountHuf)}`,
                    }))}
                  />
                </div>
                <div className="lap">
                  <div className="lap-fej">
                    <h2>Bekötési tölcsér</h2>
                  </div>
                  <div className="belso" style={{ paddingTop: 0 }}>
                    {lepcsok.map((l, i) => (
                      <div key={l.k} style={{ marginBottom: 12 }}>
                        <div className="sor-flex ter" style={{ fontSize: 14.5 }}>
                          <span>{l.k}</span>
                          <span className="szam felkover">
                            {l.n}
                            {i > 0 && lepcsok[0]!.n > 0 && <span className="halvany" style={{ fontWeight: 400 }}> · {Math.round((l.n / lepcsok[0]!.n) * 100)}%</span>}
                          </span>
                        </div>
                        <div className="sav" style={{ margin: '6px 0 0' }}>
                          <i style={{ width: `${(l.n / max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lap" style={{ marginTop: 16 }}>
                <div className="lap-fej">
                  <h2>Könyvelők terhelése</h2>
                  <Link className="gomb-sz jobbra" to="/admin/konyvelok">
                    Részletek
                  </Link>
                </div>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="elso">Könyvelő</th>
                      <th className="jobb">Ügyfél</th>
                      <th className="jobb">Nyitott kérés</th>
                      <th className="jobb utolso">Lejárt tétel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.accountants.map((a) => (
                      <tr key={a.id}>
                        <td className="elso felkover">{a.name}</td>
                        <td className="jobb szam">{a.clients}</td>
                        <td className="jobb szam">{a.openRequests}</td>
                        <td className="jobb szam utolso">{a.overdueItems ? <span className="cimke hiba">{a.overdueItems}</span> : 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
                Tulajdonosként üzleti adatokat látsz. Az ügyfelek iratait, üzeneteit, azonosítását és NAV-adatait csak a könyvelőjük látja.
              </p>
            </>
          )
        )}
      </div>
    </>
  );
}
