// /vallalkozas-inditas – new businesses (SPEC §26.1, §26.3.3, §27.6.4). By default the CLIENT files the EV bejelentés
// himself with our guide; on request ("Intézzük helyette", mode 'segitett') his accountant files it as his registered
// meghatalmazott. The team checks the NAV értesítés (four eyes: never the one who filed it) and records the adószám.
// Board on wide screens, chips + table below 1280 px.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamAssistRow, TeamRegistrationRow } from '../../api/types';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { ASSIST_STATUS_LABELS, REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '../../_shared/enums';
import { elalltSzoveg } from '../../lib/helyettunk';
import { PIPELINE_OSZLOPOK, hanyNapja, indulasSzoveg, keszFriss, ovtjHatarido, pipelineFigyel } from '../../lib/csapat';
import { datum, idopont } from '../../lib/format';
import { today } from '../../lib/today';

function useSzeles(min = 1280): boolean {
  const lekerdezes = `(min-width: ${min}px)`;
  const [ok, setOk] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(lekerdezes).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(lekerdezes);
    const f = () => setOk(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [lekerdezes]);
  return ok;
}

/** "Intézzük helyette" chip with the assist status (SPEC §27.6.4). */
function HelyettunkCimke({ r, assist }: { r: TeamRegistrationRow; assist: TeamAssistRow | undefined }) {
  if (r.mode !== 'segitett') return null;
  return (
    <span className="cimke helyettunk" title={assist ? ASSIST_STATUS_LABELS[assist.status] : undefined}>
      Intézzük helyette
    </span>
  );
}

/** The amber marker is for self-service only: an assisted card is followed in the "Intézzük helyette" queue. */
const jelzes = (r: TeamRegistrationRow) => (r.mode === 'segitett' ? null : pipelineFigyel(r));

function Kartya({ r, assist }: { r: TeamRegistrationRow; assist: TeamAssistRow | undefined }) {
  const figyel = jelzes(r);
  return (
    <Link to={`/vallalkozas-inditas/${r.id}`} className={`folyam-kartya${figyel ? ' figyel' : ''}`}>
      <div className="sor-flex ter" style={{ alignItems: 'flex-start', gap: 6 }}>
        <span className="nev">{r.client.name}</span>
        {r.openCallbackId && (
          <span title="Visszahívást kért" aria-label="Visszahívást kért">
            <I3 n="ora" s={24} />
          </span>
        )}
      </div>
      {r.mode === 'segitett' && (
        <div className="al">
          <HelyettunkCimke r={r} assist={assist} />
          {assist && <div className="kicsi" style={{ marginTop: 3 }}>{ASSIST_STATUS_LABELS[assist.status]}</div>}
        </div>
      )}
      <div className="al">{r.mainActivity ?? 'Még nem választott tevékenységet'}</div>
      {(() => {
        const h = ovtjHatarido(r, Date.now());
        return h ? (
          <div className="al">
            <span className={`cimke ${h.lejart ? 'hiba' : 'figyel'}`}>{h.lejart ? 'ÖVTJ-kód kell – lejárt' : `ÖVTJ-kód kell ${idopont(h.hatarido.toISOString(), today())}-ig`}</span>
          </div>
        ) : null;
      })()}
      <div className="al">{r.filedOn ? `Elindult: ${datum(r.filedOn)}` : indulasSzoveg(r.startPlan, r.startDate)}</div>
      {r.guideOpenedAt && r.status !== 'kesz' && (
        <div className="haladas">
          <span className="mini-sav" style={{ width: 64 }}>
            <i style={{ width: `${(r.guideProgress.done / Math.max(1, r.guideProgress.total)) * 100}%` }} />
          </span>
          <span className="kicsi szam">
            {r.guideProgress.done}/{r.guideProgress.total} lépés
          </span>
        </div>
      )}
      <div className="lab">
        {figyel ? <span className="cimke figyel">{figyel}</span> : <span className="halvany kicsi">{hanyNapja(r.daysInStatus)}</span>}
        {r.assignee && <span className="halvany kicsi">{r.assignee.firstName}</span>}
      </div>
    </Link>
  );
}

export default function VallalkozasInditas() {
  const szeles = useSzeles();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const allapot = (sp.get('allapot') as RegistrationStatus | null) ?? 'beadva';
  const mod = (sp.get('mod') as 'segitett' | 'onallo' | null) ?? null;
  const [kereses, setKereses] = useState('');
  const t = today();
  const q = useQuery({ queryKey: ['team', 'registrations', 'mind'], queryFn: () => ep.teamRegistrationsAll({ status: 'mind' }), refetchInterval: 60_000 });
  // The assist status of 'segitett' cards (same cache as the "Intézzük helyette" queue).
  const aq = useQuery({ queryKey: ['team', 'assists', 'mind'], queryFn: () => ep.teamAssistsAll({ filter: 'mind' }), refetchInterval: 60_000 });
  const assistOf = useMemo(() => {
    const m = new Map<string, TeamAssistRow>();
    for (const a of aq.data ?? []) m.set(a.id, a);
    return (r: TeamRegistrationRow) => (r.assistId ? m.get(r.assistId) : undefined);
  }, [aq.data]);
  const segitettDb = (q.data ?? []).filter((r) => r.mode === 'segitett' && r.status !== 'elallt' && keszFriss(r, t)).length;
  const sorok = useMemo(() => {
    const s = kereses.trim().toLowerCase();
    return (q.data ?? []).filter(
      (r) =>
        keszFriss(r, t) &&
        (!mod || (mod === 'segitett' ? r.mode === 'segitett' : r.mode !== 'segitett')) &&
        (!s || r.client.name.toLowerCase().includes(s) || r.client.email.toLowerCase().includes(s)),
    );
  }, [q.data, kereses, t, mod]);
  const oszlop = (st: RegistrationStatus) => sorok.filter((r) => r.status === st).sort((a, b) => b.daysInStatus - a.daysInStatus);
  const elallt = oszlop('elallt');
  const darab = (st: RegistrationStatus) => oszlop(st).length;
  const nyitott = sorok.filter((r) => r.status !== 'kesz' && r.status !== 'elallt').length;
  const varRank = darab('beadva');

  return (
    <>
      <Fejlec
        felcim="Ügyfélszolgálat"
        cim="Vállalkozás-indítás"
        rozR={260}
        mellek={
          q.data ? (
            <>
              <b>{nyitott}</b> ügyfél indítja most a vállalkozását · <b>{varRank}</b> NAV-os értesítés vár ellenőrzésre
              {segitettDb > 0 && (
                <>
                  {' '}
                  · <b>{segitettDb}</b> esetben mi intézzük
                </>
              )}
              <br />
              Alapból az ügyfél maga küldi be az útmutatónk alapján; ha kéri, a könyvelője meghatalmazottként. Mi átnézzük az értesítést, és rögzítjük az adószámot.
            </>
          ) : (
            ' '
          )
        }
      />
      <div className="tartalom szeles-tartalom">
        <div className="sor-flex" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {!szeles && (
            <div className="szegmens" role="group" aria-label="Állapot">
              {[...PIPELINE_OSZLOPOK, { status: 'elallt' as const, cim: 'Elállt' }].map((o) => (
                <button
                  key={o.status}
                  type="button"
                  className={allapot === o.status ? 'on' : ''}
                  aria-pressed={allapot === o.status}
                  onClick={() => {
                    const n = new URLSearchParams(sp);
                    n.set('allapot', o.status);
                    setSp(n, { replace: true });
                  }}
                >
                  {o.cim}
                  <span className="db">{darab(o.status)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="szegmens" role="group" aria-label="Ki jelenti be">
            {(
              [
                [null, 'Mind'],
                ['segitett', 'Intézzük helyette'],
                ['onallo', 'Maga jelenti be'],
              ] as const
            ).map(([k, f]) => (
              <button
                key={f}
                type="button"
                className={mod === k ? 'on' : ''}
                aria-pressed={mod === k}
                onClick={() => {
                  const n = new URLSearchParams(sp);
                  if (k) n.set('mod', k);
                  else n.delete('mod');
                  setSp(n, { replace: true });
                }}
              >
                {f}
                {k === 'segitett' && <span className="db">{segitettDb}</span>}
              </button>
            ))}
          </div>
          <div className="ures-hely" />
          <label className="kereso">
            <span className="rejtett">Keresés</span>
            <input value={kereses} placeholder="Név vagy e-mail" onChange={(e) => setKereses(e.target.value)} />
          </label>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending ? (
          <Toltes />
        ) : sorok.length === 0 ? (
          <div className="lap">
            <Ures n="ures_mappa" cim="Most senki nem indít vállalkozást">
              Ha egy ügyfél a bekötésnél azt választja, hogy „Még nincs, most indítanám”, itt jelenik meg.
            </Ures>
          </div>
        ) : szeles ? (
          <>
            <div className="folyam">
              {PIPELINE_OSZLOPOK.map((o) => {
                const lista = oszlop(o.status);
                return (
                  <section key={o.status} className={`folyam-oszlop${o.status === 'beadva' ? ' kiemelt' : ''}`} aria-label={o.cim}>
                    <h2>
                      {o.cim} <span className="db">{lista.length}</span>
                    </h2>
                    {o.status === 'kesz' && <div className="halvany kicsi" style={{ margin: '-4px 4px 8px' }}>az utolsó 30 nap</div>}
                    <div className="oszlop" style={{ gap: 8 }}>
                      {lista.length === 0 ? <div className="folyam-ures">nincs</div> : lista.map((r) => <Kartya key={r.id} r={r} assist={assistOf(r)} />)}
                    </div>
                  </section>
                );
              })}
            </div>
            {elallt.length > 0 && (
              <details className="osszevont" style={{ marginTop: 18, padding: '0 4px' }}>
                <summary>Elállt vagy útvonalat váltott ({elallt.length})</summary>
                <div className="lap" style={{ marginTop: 10 }}>
                  <Tabla sorok={elallt} megnyit={(id) => nav(`/vallalkozas-inditas/${id}`)} assistOf={assistOf} />
                </div>
              </details>
            )}
          </>
        ) : (
          <div className="lap">
            {oszlop(allapot).length === 0 ? (
              <Ures n="ures_mappa" cim={`Nincs ilyen: ${REGISTRATION_STATUS_LABELS[allapot].toLowerCase()}`} />
            ) : (
              <Tabla sorok={oszlop(allapot)} megnyit={(id) => nav(`/vallalkozas-inditas/${id}`)} assistOf={assistOf} />
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Tabla({ sorok, megnyit, assistOf }: { sorok: TeamRegistrationRow[]; megnyit: (id: string) => void; assistOf: (r: TeamRegistrationRow) => TeamAssistRow | undefined }) {
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th className="elso">Ügyfél</th>
          <th>Tevékenység</th>
          <th>Indulás</th>
          <th>Útmutató</th>
          <th>Állapot</th>
          <th className="utolso">Mióta</th>
        </tr>
      </thead>
      <tbody>
        {sorok.map((r) => {
          const figyel = jelzes(r);
          return (
            <tr key={r.id} className="kattinthato" onClick={() => megnyit(r.id)}>
              <td className="elso">
                <Link className="nev" to={`/vallalkozas-inditas/${r.id}`} onClick={(e) => e.stopPropagation()}>
                  {r.client.name}
                </Link>
                <div className="al">{r.client.email}</div>
              </td>
              <td>
                {r.mainActivity ?? <span className="halvany">–</span>}
                {(() => {
                  const h = ovtjHatarido(r, Date.now());
                  return h ? <div className="al">{h.lejart ? <span className="cimke hiba">ÖVTJ-kód kell – lejárt</span> : `ÖVTJ-kód kell ${idopont(h.hatarido.toISOString(), today())}-ig`}</div> : null;
                })()}
              </td>
              <td>{r.filedOn ? `Elindult: ${datum(r.filedOn)}` : indulasSzoveg(r.startPlan, r.startDate)}</td>
              <td className="szam">{r.guideOpenedAt ? `${r.guideProgress.done}/${r.guideProgress.total} lépés` : <span className="halvany">még nem nyitotta meg</span>}</td>
              <td>
                {elalltSzoveg(r) ?? REGISTRATION_STATUS_LABELS[r.status]}
                {r.mode === 'segitett' && (
                  <div className="al">
                    <HelyettunkCimke r={r} assist={assistOf(r)} />
                    {assistOf(r) && ` ${ASSIST_STATUS_LABELS[assistOf(r)!.status].toLowerCase()}`}
                  </div>
                )}
                {r.openCallbackId && <div className="al">visszahívást kért</div>}
              </td>
              <td className="utolso">{figyel ? <span className="cimke figyel">{figyel}</span> : hanyNapja(r.daysInStatus)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
