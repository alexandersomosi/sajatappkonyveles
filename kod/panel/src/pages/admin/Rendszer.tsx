// FUNKCIOK 33, 35: integration modes (DEMO / test / live), worker heartbeat, last NAV sync, backup age.
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, HibaSav, Toltes } from '../../ui/kozos';
import { MODE_LABEL } from '../../lib/labels';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';

const INTEGRACIOK: { k: 'nav' | 'simplepay' | 'mail' | 'push' | 'invoice'; nev: string; mit: string }[] = [
  { k: 'simplepay', nev: 'SimplePay', mit: 'Kártyás előfizetés, havi terhelés' },
  { k: 'mail', nev: 'E-mail (Brevo)', mit: 'Kódok, értesítések e-mailben' },
  { k: 'nav', nev: 'NAV Online Számla', mit: 'Kiállított számlák napi letöltése' },
  { k: 'invoice', nev: 'Díjszámla', mit: 'Számla a havidíjról (Számlázz.hu / Billingo)' },
  { k: 'push', nev: 'Telefonos értesítés', mit: 'Push az appba (Expo)' },
];

function Pont({ mode }: { mode: string }) {
  const ok = mode === 'live' || mode === 'prod' || mode === 'smtp' || mode === 'expo' || mode === 'szamlazzhu' || mode === 'billingo';
  return <span className={`pont${ok ? ' ok' : mode === 'off' || mode === 'not_configured' ? ' ki' : ''}`} />;
}

export default function Rendszer() {
  const q = useQuery({ queryKey: ['admin', 'system'], queryFn: ep.adminSystem, refetchInterval: 60_000 });
  const d = q.data;
  const t = today();
  const hb = d?.workerHeartbeatAt ? (Date.now() - Date.parse(d.workerHeartbeatAt)) / 60_000 : null;
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Rendszer"
        mellek={d ? <>Környezet: <b>{d.appEnv === 'demo' ? 'DEMO' : 'éles'}</b> · verzió {d.version} · adatbázis: <b>{d.db === 'ok' ? 'rendben' : 'HIBA'}</b></> : ' '}
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending ? (
          <Toltes />
        ) : (
          d && (
            <div className="racs fo-mellek">
              <div className="lap">
                <div className="lap-fej">
                  <h2>Kapcsolatok</h2>
                  <span className="megj">A kulcsokat a kezjegy_kulcsok.ps1 szkripttel adod meg.</span>
                </div>
                <table className="tabla">
                  <tbody>
                    {INTEGRACIOK.map((i) => (
                      <tr key={i.k}>
                        <td className="elso">
                          <div className="felkover">{i.nev}</div>
                          <div className="al">{i.mit}</div>
                        </td>
                        <td className="utolso">
                          <Pont mode={d.modes[i.k]} /> {MODE_LABEL[d.modes[i.k]] ?? d.modes[i.k]}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="elso">
                        <div className="felkover">Google-belépés</div>
                        <div className="al">Ügyfeleknek, az appban</div>
                      </td>
                      <td className="utolso">
                        <Pont mode={d.googleSignIn ? 'live' : 'off'} /> {d.googleSignIn ? 'bekapcsolva' : 'nincs beállítva'}
                      </td>
                    </tr>
                    <tr>
                      <td className="elso">
                        <div className="felkover">Apple-belépés</div>
                        <div className="al">Csak iPhone-on</div>
                      </td>
                      <td className="utolso">
                        <Pont mode={d.appleSignIn ? 'live' : 'off'} /> {d.appleSignIn ? 'bekapcsolva' : 'nincs beállítva'}
                      </td>
                    </tr>
                    <tr>
                      <td className="elso">
                        <div className="felkover">Kötelező kétlépcsős belépés</div>
                        <div className="al">Könyvelőknek és neked</div>
                      </td>
                      <td className="utolso">
                        <Pont mode={d.staffTotpRequired ? 'live' : 'demo'} /> {d.staffTotpRequired ? 'bekapcsolva' : 'ki – élesben kapcsold be'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="lap">
                <div className="lap-fej">
                  <h2>Háttérmunkák</h2>
                </div>
                <div className="belso" style={{ paddingTop: 0 }}>
                  <dl className="adatok" style={{ gridTemplateColumns: '170px 1fr' }}>
                    <dt>Háttérfolyamat</dt>
                    <dd>
                      {hb === null ? 'még nem jelentkezett' : hb < 10 ? <>él ({idopont(d.workerHeartbeatAt, t)})</> : <span style={{ color: 'var(--veszely)' }}>{Math.round(hb)} perce nem jelentkezett</span>}
                    </dd>
                    <dt>Napi letöltés (NAV)</dt>
                    <dd>{d.lastNavSync?.at ? `${idopont(d.lastNavSync.at, t)} · ${d.lastNavSync.ok} rendben, ${d.lastNavSync.failed} hibás` : 'még nem futott'}</dd>
                    <dt>Utolsó mentés</dt>
                    <dd>{d.backupAgeHours === null ? 'nincs adat' : d.backupAgeHours <= 26 ? `${Math.round(d.backupAgeHours)} órája` : <span style={{ color: 'var(--veszely)' }}>{Math.round(d.backupAgeHours)} órája – nézd meg!</span>}</dd>
                  </dl>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </>
  );
}
