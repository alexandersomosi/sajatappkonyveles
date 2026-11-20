// SPEC §29.9.2 – /admin/konzol: the owner's overview. Clients (active átalány / KATA, onboarding, suspended,
// terminated, new and cancelled per month), money (MRR, collected per month, failed / overdue, locked clients,
// upcoming charges, fees by kind) and the accountants' load. Every tile links to the filtered client list.
// The "Közlemény" action (announcement) lives here too.
import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as k from '../../../api/k29f';
import { CONSOLE_RULES, CONSOLE_TEXTS, type ConsoleOverview } from '../../../_shared/k29f';
import { Fejlec, HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { honapEv, szam } from '../../../lib/format';
import { LepcsoProvider, MuveletFiok, type MuveletDef } from './lepcso';

function Csempe({ ertek, mi, to, ft, ikon }: { ertek: number; mi: string; to: string; ft?: boolean; ikon: Parameters<typeof I3>[0]['n'] }) {
  return (
    <Link to={to} className="lap kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
      <I3 n={ikon} />
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

function kozlemeny(o: ConsoleOverview | undefined): MuveletDef {
  let darab: number | null = null;
  return {
    cim: 'Közlemény az ügyfeleknek',
    bev: `Legfeljebb ${CONSOLE_RULES.announcementsPerDay} naponta. Előbb megszámoljuk a címzetteket, azt erősíted meg.`,
    indok: false,
    mezok: [
      { kulcs: 'title', felirat: 'Cím (≤ 80)' },
      { kulcs: 'body', felirat: 'Szöveg (≤ 600)', tipus: 'hosszu' },
      { kulcs: 'kor', felirat: 'Kinek?', tipus: 'valaszto', alap: 'aktiv', opciok: [{ kulcs: 'aktiv', felirat: 'Aktív ügyfelek' }, { kulcs: 'bekotes_alatt', felirat: 'Bekötés alatt' }, { kulcs: 'mind', felirat: 'Mindenki' }] },
      { kulcs: 'push', felirat: 'Push is', tipus: 'jelolo' },
      { kulcs: 'email', felirat: 'E-mail is', tipus: 'jelolo' },
    ],
    osszegzes: (v) => (darab === null ? `Előbb megszámoljuk, hány ügyfél kapja (${o?.clients.active ?? '…'} aktív).` : `${darab} ügyfél kapja meg: „${v.title ?? ''}”.`),
    kuld: async (v) => {
      const filter = v.kor === 'mind' || !v.kor ? {} : { lifecycle: [v.kor] };
      const body = { title: v.title ?? '', body: v.body ?? '', channels: { inApp: true as const, push: v.push === '1', email: v.email === '1' }, filter };
      if (darab === null) {
        const r = await k.consoleAnnounce(body);
        darab = r.count;
        throw new Error(`${r.count} ügyfél kapná. Nyomd meg újra a Megerősítem gombot a küldéshez.`);
      }
      return k.consoleAnnounce({ ...body, expectedCount: darab });
    },
    siker: (r) => `Elküldtük ${(r as { count: number }).count} ügyfélnek.`,
  };
}

function Tartalom() {
  const q = useQuery({ queryKey: ['admin', 'console', 'overview'], queryFn: k.consoleOverview });
  const [kozl, setKozl] = useState<MuveletDef | null>(null);
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
              <I3 n="dosszie" s={22} /> Ügyfelek
            </Link>
            <button type="button" className="gomb-m" onClick={() => setKozl(kozlemeny(o))}>
              <I3 n="ertesites" s={22} /> Közlemény
            </button>
          </div>
        }
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending || !o ? (
          <Toltes />
        ) : (
          <>
            <h2 className="szakasz">Ügyfelek</h2>
            <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <Csempe ertek={o.clients.active} mi={`${CONSOLE_TEXTS.tiles.active} · átalány ${o.clients.activeAtalany}, kata ${o.clients.activeKata}`} to="/admin/konzol/ugyfelek?status=aktiv" ikon="fooldal" />
              <Csempe ertek={o.clients.onboarding} mi={CONSOLE_TEXTS.tiles.onboarding} to="/admin/konzol/ugyfelek?status=bekotes_alatt" ikon="bevallas" />
              <Csempe ertek={o.clients.suspended} mi={CONSOLE_TEXTS.tiles.suspended} to="/admin/konzol/ugyfelek?status=felfuggesztve" ikon="lakat" />
              <Csempe ertek={o.clients.terminated} mi={CONSOLE_TEXTS.tiles.terminated} to="/admin/konzol/ugyfelek?terminated=1" ikon="irat" />
            </div>
            <div className="lap k28" style={{ marginTop: 16 }}>
              <div className="szak">
                <div className="szak-fej">
                  <I3 n="hataridok" />
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
              <Csempe ertek={o.money.mrrHuf} ft mi={CONSOLE_TEXTS.tiles.mrr} to="/admin/konzol/ugyfelek?status=aktiv" ikon="szamolo" />
              <Csempe ertek={o.money.overdue.sumHuf} ft mi={`${CONSOLE_TEXTS.tiles.overdue} · ${o.money.overdue.count} ügyfél${o.money.actionNeeded ? `, ${o.money.actionNeeded} megerősítésre vár` : ''}`} to="/admin/konzol/ugyfelek?unpaid=1" ikon="szamlaszam" />
              <Csempe ertek={o.money.locked.count} mi={`${CONSOLE_TEXTS.tiles.locked}${Object.keys(o.money.locked.reasons).length ? ` · ${Object.entries(o.money.locked.reasons).map(([r, n]) => `${r}: ${n}`).join(', ')}` : ''}`} to="/admin/konzol/ugyfelek?locked=1" ikon="lakat" />
              <Csempe ertek={o.money.upcoming7.sumHuf} ft mi={`${CONSOLE_TEXTS.tiles.upcoming7} · ${o.money.upcoming7.count} db (30 nap: ${szam(o.money.upcoming30.sumHuf)} Ft)`} to="/admin/konzol/ugyfelek?status=aktiv" ikon="befizetve" />
            </div>
            <div className="lap k28" style={{ marginTop: 16 }}>
              <div className="szak">
                <div className="szak-fej">
                  <I3 n="szamlaszam" />
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
                  <I3 n="szamolo" />
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
      <MuveletFiok def={kozl} bezar={() => setKozl(null)} />
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
