// /helyettunk – "Intézzük helyette" queue (SPEC §27.3, §27.6.2). On the client's request and after a call, his own
// accountant files the UJEGYKE meghatalmazás (and, for a new business, the EV bejelentés) as his registered
// meghatalmazott, with his OWN login; the client approves at the NAV himself. Csapat and admin see every request, the
// accountant only his own clients' (the API returns 404 for others).
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamAssistRow } from '../../api/types';
import { useAuth } from '../../auth/Auth';
import { Fejlec, HibaSav, Lenyilo, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { useMost } from '../../ui/useMost';
import { ASSIST_KIND_LABELS, ASSIST_KINDS, ASSIST_STATUS_LABELS, type AssistKind } from '../../_shared/enums';
import { CHANGE_HANDBOOK } from '../../_shared/bekotes';
import { LIFECYCLE_LABEL } from '../../lib/labels';
import { hanyNapja } from '../../lib/csapat';
import {
  ASSIST_SZUROK,
  assistSorrend,
  hataridoVisszaszamol,
  jovahagyasSzoveg,
  labdaNalam,
  labdaSzoveg,
  nyitottAssist,
  szuroIlleszkedik,
  valtozasFajta,
  allapotFelirat,
  type AssistSzuro,
  type PanelSzerep,
} from '../../lib/helyettunk';
import { today } from '../../lib/today';

export function useSzerep(): PanelSzerep {
  const { isAdmin, isCsapat } = useAuth();
  return isAdmin ? 'admin' : isCsapat ? 'csapat' : 'konyvelo';
}

export function HataridoCimke({ at, overdue, most }: { at: string; overdue: boolean; most: number }) {
  const h = hataridoVisszaszamol(at, most);
  const szin = overdue ? 'hiba' : h.szin;
  return <span className={`cimke${szin === 'hiba' ? ' hiba' : szin === 'figyel' ? ' ido' : ''}`}>{overdue && h.szin !== 'hiba' ? 'lejárt' : h.szoveg}</span>;
}

export default function Helyettunk() {
  const szerep = useSzerep();
  const { user } = useAuth();
  const enId = user?.id;
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const szuro = (sp.get('szuro') as AssistSzuro) || 'nyitott';
  const fajta = (sp.get('fajta') as AssistKind | 'valtozas' | null) ?? '';
  const [kereses, setKereses] = useState('');
  const most = useMost();
  const t = today();
  const q = useQuery({ queryKey: ['team', 'assists', 'mind'], queryFn: () => ep.teamAssistsAll({ filter: 'mind' }), refetchInterval: 60_000 });
  const mind = q.data ?? [];
  const alap = useMemo(() => {
    const s = kereses.trim().toLowerCase();
    return mind.filter((r) => (!fajta || (fajta === 'valtozas' ? valtozasFajta(r.kind) : r.kind === fajta)) && (!s || r.client.name.toLowerCase().includes(s)));
  }, [mind, fajta, kereses]);
  const darab = (f: AssistSzuro) => alap.filter((r) => szuroIlleszkedik(r, f, szerep, t, enId)).length;
  const sorok = useMemo(() => alap.filter((r) => szuroIlleszkedik(r, szuro, szerep, t, enId)).sort(assistSorrend), [alap, szuro, szerep, t, enId]);
  const allit = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  const nyitott = mind.filter((r) => nyitottAssist(r.status)).length;
  const nalam = mind.filter((r) => labdaNalam(r, szerep, enId)).length;
  const lejart = mind.filter((r) => szuroIlleszkedik(r, 'lejart', szerep, t)).length;

  return (
    <>
      <Fejlec
        felcim={szerep === 'konyvelo' ? 'Munka' : 'Ügyfélszolgálat'}
        cim="Intézzük helyette"
        rozR={260}
        mellek={
          q.data ? (
            <>
              <b>{nyitott}</b> nyitott kérés · <b>{nalam}</b> {szerep === 'konyvelo' ? 'vár rád' : 'vár ránk'}
              {lejart > 0 && (
                <>
                  {' '}
                  · <b>{lejart}</b> lejárt jóváhagyás
                </>
              )}
              <br />
              {szerep === 'konyvelo'
                ? 'A te ügyfeleid kérései. Ahol nálad a labda, ott te küldöd be a meghatalmazást vagy a bejelentést, a saját belépéseddel.'
                : 'Az ügyfél kérésére, hívás után: a könyvelője a saját belépésével, meghatalmazottként küldi be. Az ügyfél a NAV oldalán hagyja jóvá.'}
            </>
          ) : (
            ' '
          )
        }
      />
      <div className="tartalom szeles-tartalom">
        <div className="sor-flex" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div className="szegmens" role="group" aria-label="Szűrés">
            {ASSIST_SZUROK.map((f) => (
              <button key={f.k} type="button" className={szuro === f.k ? 'on' : ''} aria-pressed={szuro === f.k} onClick={() => allit('szuro', f.k === 'nyitott' ? null : f.k)}>
                {f.felirat}
                {q.data && <span className="db">{darab(f.k)}</span>}
              </button>
            ))}
          </div>
          <div className="ures-hely" />
          <Lenyilo style={{ width: 210 }} value={fajta} aria-label="Mit kért" onChange={(e) => allit('fajta', e.target.value || null)}>
            <option value="">Minden kérés</option>
            {/* SPEC §28.5.5: one chip for the six change kinds */}
            <option value="valtozas">{CHANGE_HANDBOOK.filterChip}</option>
            {ASSIST_KINDS.map((k) => (
              <option key={k} value={k}>
                {ASSIST_KIND_LABELS[k]}
              </option>
            ))}
          </Lenyilo>
          <label className="kereso" style={{ width: 200, minWidth: 200 }}>
            <span className="rejtett">Keresés</span>
            <input value={kereses} placeholder="Ügyfél neve" onChange={(e) => setKereses(e.target.value)} />
          </label>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : sorok.length === 0 ? (
            <Ures n="meghatalmazas_alairva" cim={szuro === 'nyitott' ? 'Most nincs nyitott kérés' : 'Nincs ilyen kérés'}>
              {szuro === 'nyitott' ? 'Ha egy ügyfél azt kéri, hogy intézzük helyette a vállalkozása bejelentését vagy a meghatalmazást, itt jelenik meg.' : 'Válassz másik szűrőt.'}
            </Ures>
          ) : (
            <table className="tabla tomor helyettunk-tabla">
              <thead>
                <tr>
                  <th className="elso">Ügyfél</th>
                  <th>Mit kért</th>
                  <th>Állapot</th>
                  <th>Kinél a labda</th>
                  <th>Következő határidő</th>
                  <th>Napja</th>
                  <th className="utolso">Kié</th>
                </tr>
              </thead>
              <tbody>
                {sorok.map((r) => (
                  <Sor key={r.id} r={r} szerep={szerep} enId={enId} most={most} megnyit={() => nav(`/helyettunk/${r.id}`)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="halvany kicsi szabaly-sor">
          <I3 n="lakat" s={20} /> Soha ne kérd el és ne használd az ügyfél Ügyfélkapu+- vagy DÁP-belépését, jelszavát, kódját; ne lépj be helyette, és ne irányítsd távolról a telefonját vagy gépét NAV-os ügyintézés közben.
        </p>
      </div>
    </>
  );
}

function Sor({ r, szerep, enId, most, megnyit }: { r: TeamAssistRow; szerep: PanelSzerep; enId?: string; most: number; megnyit: () => void }) {
  const nalam = labdaNalam(r, szerep, enId);
  const lejart = !!r.nextDue?.overdue && nyitottAssist(r.status);
  // 11-19 javító kör 2: ha a következő határidő maga a jóváhagyás, nem írjuk ki még egyszer alá.
  const jovahagyas =
    (r.status === 'meghatalmazas_bekuldve' || r.status === 'meghatalmazas_lejart') && !(r.nextDue && /^Jóváhagyás/.test(r.nextDue.what)) ? jovahagyasSzoveg(r.approvalDueOn) : null;
  return (
    <tr className={`kattinthato${lejart ? ' lejart' : ''}`} onClick={megnyit}>
      <td className="elso">
        <Link className="nev" to={`/helyettunk/${r.id}`} onClick={(e) => e.stopPropagation()}>
          {r.client.name}
        </Link>
        <div className="al">{LIFECYCLE_LABEL[r.client.lifecycle]}</div>
      </td>
      <td>{ASSIST_KIND_LABELS[r.kind]}</td>
      <td>
        <span style={{ color: nyitottAssist(r.status) ? undefined : 'var(--halvany)' }}>{allapotFelirat(r.status, r.kind, ASSIST_STATUS_LABELS)}</span>
      </td>
      <td>
        {nalam ? (
          <span className="cimke info">{szerep === 'konyvelo' ? 'Neked' : labdaSzoveg(r.ball, r.accountant?.name)}</span>
        ) : (
          <span className={r.ball ? undefined : 'halvany'}>{labdaSzoveg(r.ball, r.accountant?.name)}</span>
        )}
      </td>
      <td>
        {r.nextDue && nyitottAssist(r.status) ? (
          <>
            <div>{r.nextDue.what}</div>
            <div className="al" style={{ marginTop: 3 }}>
              <HataridoCimke at={r.nextDue.at} overdue={r.nextDue.overdue} most={most} />
            </div>
          </>
        ) : (
          <span className="halvany">–</span>
        )}
        {jovahagyas && <div className="al">{jovahagyas}</div>}
      </td>
      <td className="nt">{hanyNapja(r.daysInStatus)}</td>
      <td className="utolso">{r.assignee ? r.assignee.firstName : <span className="halvany">—</span>}</td>
    </tr>
  );
}
