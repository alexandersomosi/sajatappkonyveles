// SPEC §29.9.2 – /admin/konzol: the owner's overview. Clients (active átalány / KATA, onboarding, suspended,
// terminated, new and cancelled per month), money (MRR, collected per month, failed / overdue, locked clients,
// upcoming charges, fees by kind) and the accountants' load. Every tile links to the filtered client list.
// The "Közlemény" action (announcement) lives here too.
import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as k from '../../../api/k29f';
import { CONSOLE_RULES, CONSOLE_TEXTS } from '../../../_shared/k29f';
import { Fejlec, Fiok, HibaSav, Toltes } from '../../../ui/kozos';
import { usePirito } from '../../../ui/Pirito';
import { I3 } from '../../../ui/Icon3d';
import { honapEv, szam } from '../../../lib/format';
import { LepcsoProvider, useLepcsos } from './lepcso';
import { AtutalasSzakasz } from './Atutalas';
import { kellKetlepcsos } from '../../../api/k29';

function Csempe({ ertek, mi, to, ft, ikon }: { ertek: number; mi: string; to: string; ft?: boolean; ikon: Parameters<typeof I3>[0]['n'] }) {
  return (
    <Link to={to} className="lap kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
      <I3 n={ikon} s={34} />
      <div>
        <div className="ertek">
          {szam(ertek)}
          {ft ? <span className="ft">Ft</span> : null}
        </div>
        <div className="mi">{mi}</div>
      </div>
    </Link>
  );
}

function Oszlop({ sorok, ertek, cimke }: { sorok: { month: string }[]; ertek: (i: number) => number; cimke?: (i: number) => string }) {
  const max = Math.max(1, ...sorok.map((_, i) => ertek(i)));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sorok.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 150, padding: '6px 0' }}>
      {sorok.map((s, i) => (
        <div key={s.month} title={`${honapEv(s.month)}: ${cimke ? cimke(i) : szam(ertek(i))}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11.5, color: 'var(--halvany)', fontVariantNumeric: 'tabular-nums' }}>{ertek(i) ? (cimke ? cimke(i) : szam(ertek(i))) : ''}</span>
          <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(2, (ertek(i) / max) * 100)}%`, background: 'var(--tintakek)', borderRadius: '4px 4px 0 0', opacity: ertek(i) ? 1 : 0.25 }} />
          <span style={{ fontSize: 11.5, color: 'var(--halvany)' }}>{s.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

/** "Közlemény": first a dry run counts the recipients, the send must echo that count (step-up first). */
function KozlemenyFiok({ nyitva, bezar }: { nyitva: boolean; bezar: () => void }) {
  const futtat = useLepcsos();
  const pir = usePirito();
  const [cim, setCim] = useState('');
  const [szoveg, setSzoveg] = useState('');
  const [kor, setKor] = useState<'aktiv' | 'bekotes_alatt' | 'mind'>('aktiv');
  const [push, setPush] = useState(false);
  const [email, setEmail] = useState(false);
  const [darab, setDarab] = useState<number | null>(null);
  const [fut, setFut] = useState(false);
  const body = () => ({ title: cim.trim(), body: szoveg.trim(), channels: { inApp: true as const, push, email }, filter: kor === 'mind' ? {} : { lifecycle: [kor] } });
  const valt = <T,>(f: (v: T) => void) => (v: T) => {
    f(v);
    setDarab(null);
  };
  const szamol = async () => {
    setFut(true);
    try {
      setDarab((await k.consoleAnnounce(body())).count);
    } catch (e) {
      pir.hiba(e);
    } finally {
      setFut(false);
    }
  };
  const kuld = async () => {
    if (darab === null) return;
    setFut(true);
    try {
      const r = await futtat(() => k.consoleAnnounce({ ...body(), expectedCount: darab }));
      pir.ok(`Elküldtük ${r.count} ügyfélnek.`);
      bezar();
    } catch (e) {
      pir.hiba(e);
      setDarab(null);
    } finally {
      setFut(false);
    }
  };
  return (
    <Fiok nyitva={nyitva} bezar={bezar} ikon="csengo" cim="Közlemény az ügyfeleknek" bev={`Legfeljebb ${CONSOLE_RULES.announcementsPerDay} naponta. Előbb megszámoljuk a címzetteket, azt erősíted meg.`}>
      <div style={{ display: 'grid', gap: 14 }}>
        <label className="mezo">
          <span className="felirat">Cím (legfeljebb {CONSOLE_RULES.announcementTitleMax} karakter)</span>
          <input className="doboz" maxLength={CONSOLE_RULES.announcementTitleMax} value={cim} onChange={(e) => valt(setCim)(e.target.value)} />
        </label>
        <label className="mezo">
          <span className="felirat">Szöveg (legfeljebb {CONSOLE_RULES.announcementBodyMax} karakter)</span>
          <textarea className="doboz" maxLength={CONSOLE_RULES.announcementBodyMax} value={szoveg} onChange={(e) => valt(setSzoveg)(e.target.value)} />
        </label>
        <div className="mezo">
          <span className="felirat">Kinek?</span>
          <div className="valaszto">
            {([['aktiv', 'Aktív ügyfelek'], ['bekotes_alatt', 'Bekötés alatt'], ['mind', 'Mindenki']] as const).map(([kk, f]) => (
              <label key={kk}>
                <input type="radio" name="kor" checked={kor === kk} onChange={() => valt(setKor)(kk)} /> {f}
              </label>
            ))}
          </div>
        </div>
        <label className="jelolo">
          <input type="checkbox" checked={push} onChange={(e) => valt(setPush)(e.target.checked)} /> Push-értesítés is
        </label>
        <label className="jelolo">
          <input type="checkbox" checked={email} onChange={(e) => valt(setEmail)(e.target.checked)} /> E-mail is
        </label>
        {darab !== null ? (
          <div className="uzenet-sav info" style={{ display: 'block' }}>
            <b>{darab} ügyfél kapja meg</b> az appban{push ? ', push-ban' : ''}{email ? ' és e-mailben' : ''}: „{cim.trim()}”.
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10 }}>
          {darab === null ? (
            <button type="button" className="gomb-e" disabled={fut || cim.trim().length < 3 || szoveg.trim().length < 3} onClick={() => void szamol()}>
              Megszámolom a címzetteket
            </button>
          ) : (
            <button type="button" className="gomb-e" disabled={fut || darab === 0} onClick={() => void kuld()}>
              Elküldöm {darab} ügyfélnek
            </button>
          )}
        </div>
      </div>
    </Fiok>
  );
}

function Tartalom() {
  const q = useQuery({ queryKey: ['admin', 'console', 'overview'], queryFn: k.consoleOverview });
  const [kozl, setKozl] = useState(false);
  const o = q.data;
  return (
    <>
      <Fejlec
        cim={CONSOLE_TEXTS.title}
        mellek={
          <>
            {CONSOLE_TEXTS.sub} {o?.demo ? <span className="cimke demo">DEMO adatok</span> : null}
          </>
        }
        jobb={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="gomb-m" to="/admin/konzol/ugyfelek">
              <I3 n="emberek" s={22} /> Ügyfelek
            </Link>
            <button type="button" className="gomb-m" onClick={() => setKozl(true)}>
              <I3 n="csengo" s={22} /> Közlemény
            </button>
          </div>
        }
      />
      <div className="tartalom">
        {/* k7c2: without the admin's own 2FA – a way to switch it on, and no endless "Töltöm…" */}
        {q.isError && kellKetlepcsos(q.error) ? (
          <div className="uzenet-sav figyel" style={{ display: 'block' }}>
            <b>A konzolhoz kapcsold be a kétlépcsős belépést.</b>{' '}
            <Link to="/ketlepcsos-beallitas">Bekapcsolom</Link>
          </div>
        ) : q.isError ? (
          <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        ) : null}
        {q.isError ? null : q.isPending || !o ? (
          <Toltes />
        ) : (
          <>
            <h2 className="szakasz">Ügyfelek</h2>
            <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <Csempe ertek={o.clients.active} mi={`${CONSOLE_TEXTS.tiles.active} · átalány ${o.clients.activeAtalany}, kata ${o.clients.activeKata}`} to="/admin/konzol/ugyfelek?status=aktiv" ikon="emberek" />
              <Csempe ertek={o.clients.onboarding} mi={CONSOLE_TEXTS.tiles.onboarding} to="/admin/konzol/ugyfelek?status=bekotes_alatt" ikon="irat-toll" />
              <Csempe ertek={o.clients.suspended} mi={CONSOLE_TEXTS.tiles.suspended} to="/admin/konzol/ugyfelek?status=felfuggesztve" ikon="lakat" />
              <Csempe ertek={o.clients.terminated} mi={CONSOLE_TEXTS.tiles.terminated} to="/admin/konzol/ugyfelek?terminated=1" ikon="kilep" />
            </div>
            <div className="lap k28" style={{ marginTop: 16 }}>
              <div className="szak">
                <div className="szak-fej">
                  <I3 n="oszlop" />
                  <h2>Új és lemondott ügyfelek havonta (12 hónap)</h2>
                </div>
                <div className="racs k2">
                  <div>
                    <p className="halvany">Új</p>
                    <Oszlop sorok={o.clients.perMonth} ertek={(i) => o.clients.perMonth[i]!.uj} />
                  </div>
                  <div>
                    <p className="halvany">Lemondott / felmondott</p>
                    <Oszlop sorok={o.clients.perMonth} ertek={(i) => o.clients.perMonth[i]!.lemondott} />
                  </div>
                </div>
              </div>
            </div>
            <h2 className="szakasz">Pénz {o.money.demoPayments ? <span className="megj">· a DEMO fizetések is benne vannak ({o.money.demoPayments})</span> : null}</h2>
            <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <Csempe ertek={o.money.mrrHuf} ft mi={CONSOLE_TEXTS.tiles.mrr} to="/admin/konzol/ugyfelek?status=aktiv" ikon="emelkedes" />
              <Csempe ertek={o.money.overdue.sumHuf} ft mi={`${CONSOLE_TEXTS.tiles.overdue} · ${o.money.overdue.count} ügyfél${o.money.actionNeeded ? `, ${o.money.actionNeeded} megerősítésre vár` : ''}`} to="/admin/konzol/ugyfelek?unpaid=1" ikon="figyelem" />
              <Csempe ertek={o.money.locked.count} mi={`${CONSOLE_TEXTS.tiles.locked}${Object.keys(o.money.locked.reasons).length ? ` · ${Object.entries(o.money.locked.reasons).map(([r, n]) => `${r}: ${n}`).join(', ')}` : ''}`} to="/admin/konzol/ugyfelek?locked=1" ikon="lakat" />
              <Csempe ertek={o.money.upcoming7.sumHuf} ft mi={`${CONSOLE_TEXTS.tiles.upcoming7} · ${o.money.upcoming7.count} db (30 nap: ${szam(o.money.upcoming30.sumHuf)} Ft)`} to="/admin/konzol/ugyfelek?status=aktiv" ikon="naptar" />
            </div>
            <div className="lap k28" style={{ marginTop: 16 }}>
              <div className="szak">
                <div className="szak-fej">
                  <I3 n="bank" />
                  <h2>Befolyt bevétel havonta (visszautalások után)</h2>
                </div>
                <Oszlop sorok={o.money.collectedPerMonth} ertek={(i) => o.money.collectedPerMonth[i]!.nettoHuf} cimke={(i) => `${Math.round(o.money.collectedPerMonth[i]!.nettoHuf / 1000)}e`} />
              </div>
              <div className="szak" style={{ padding: 0 }}>
                <div className="tabla-gorgo">
                  <table className="tabla tomor">
                    <thead>
                      <tr>
                        <th className="elso">Hónap</th>
                        <th className="jobb">Havidíj</th>
                        <th className="jobb">Egyszeri díjak</th>
                        <th className="jobb">Visszautalva</th>
                        <th className="jobb utolso">Nettó</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...o.money.collectedPerMonth].reverse().slice(0, 6).map((m) => (
                        <tr key={m.month}>
                          <td className="elso">{honapEv(m.month)}</td>
                          <td className="jobb nt">{szam(m.havidijHuf)}</td>
                          <td className="jobb nt">{szam(m.egyszeriHuf)}</td>
                          <td className="jobb nt">{m.visszaHuf ? `−${szam(m.visszaHuf)}` : '0'}</td>
                          <td className="jobb utolso nt">
                            <b>{szam(m.nettoHuf)} Ft</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="szak" style={{ padding: 0 }}>
                <div className="szak-fej" style={{ padding: '16px 22px 0' }}>
                  <I3 n="tarca" />
                  <h2>Díjak fajtánként (6 hónap)</h2>
                </div>
                {o.money.feesByKind.length ? (
                  <div className="tabla-gorgo">
                    <table className="tabla tomor">
                      <thead>
                        <tr>
                          <th className="elso">Hónap</th>
                          <th>Díj</th>
                          <th className="jobb">Fizetve</th>
                          <th className="jobb">Nyitott</th>
                          <th className="jobb utolso">Elengedve</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...o.money.feesByKind].reverse().map((f) => (
                          <tr key={`${f.month}-${f.kind}`}>
                            <td className="elso">{honapEv(f.month)}</td>
                            <td>{f.label}</td>
                            <td className="jobb nt">
                              {f.paid} db · {szam(f.paidHuf)} Ft
                            </td>
                            <td className="jobb nt">{f.open}</td>
                            <td className="jobb utolso nt">{f.waived}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="halvany" style={{ padding: '6px 22px 16px' }}>
                    Az elmúlt fél évben nem volt külön díj.
                  </p>
                )}
              </div>
            </div>
            {/* k8 ALAP-B: díjbekérők – fizetett (e hónap) / vár / késik, kézi rögzítés */}
            <h2 className="szakasz" id="atutalas">Átutalás</h2>
            <div className="lap" style={{ marginBottom: 16 }}>
              <AtutalasSzakasz />
            </div>
            <h2 className="szakasz">Könyvelők</h2>
            <div className="lap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="elso">Könyvelő</th>
                    <th className="jobb">Ügyfél</th>
                    <th className="jobb">Nyitott teendő</th>
                    <th className="utolso">Legrégebbi</th>
                  </tr>
                </thead>
                <tbody>
                  {o.accountants.map((a) => (
                    <tr key={a.id}>
                      <td className="elso">
                        <Link className="nev" to={`/admin/konzol/ugyfelek?accountant=${a.id}`}>
                          {a.name}
                        </Link>
                      </td>
                      <td className="jobb nt">{a.clients}</td>
                      <td className="jobb nt">{a.openTasks}</td>
                      <td className="utolso">{a.oldest ? `${a.oldest.kind} · ${a.oldest.ageDays} napja` : <span className="halvany">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <KozlemenyFiok nyitva={kozl} bezar={() => setKozl(false)} />
    </>
  );
}

export default function KonzolAttekintes() {
  return (
    <LepcsoProvider>
      <Tartalom />
    </LepcsoProvider>
  );
}
