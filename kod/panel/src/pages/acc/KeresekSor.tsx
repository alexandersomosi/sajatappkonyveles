// FUNKCIOK 17, 24: request queue across clients, certificate requests included.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { AccRequestRow } from '../../api/types';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { Hatarido } from '../../ui/domain';
import { REQUEST_STATUS_LABEL } from '../../lib/labels';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { KeresKezeloFiok, keresCim } from './keresKozos';

type Szuro = 'tole' | 'igazolas' | 'tolem' | 'lezart';
const SZUROK: { k: Szuro; f: string }[] = [
  { k: 'tole', f: 'Tőlük, nyitott' },
  { k: 'igazolas', f: 'Igazolások' },
  { k: 'tolem', f: 'Tőled, nyitott' },
  { k: 'lezart', f: 'Lezárt' },
];
const nyitva = (r: AccRequestRow) => r.status === 'nyitott' || r.status === 'folyamatban';
function illik(r: AccRequestRow, k: Szuro): boolean {
  if (k === 'tole') return r.direction === 'ugyfeltol' && nyitva(r);
  if (k === 'igazolas') return !!r.certificate && nyitva(r);
  if (k === 'tolem') return r.direction === 'konyvelotol' && nyitva(r);
  return !nyitva(r);
}

export default function KeresekSor() {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const szuro = (sp.get('szuro') as Szuro) || 'tole';
  const q = useQuery({ queryKey: ['acc', 'requests', 'all'], queryFn: () => ep.accRequests({}) });
  const [nyitott, setNyitott] = useState<AccRequestRow | null>(null);
  const all = q.data?.items ?? [];
  const szurt = all.filter((r) => illik(r, szuro));
  const db = (k: Szuro) => all.filter((r) => illik(r, k)).length;
  return (
    <>
      <Fejlec
        cim="Kérések"
        mellek={
          q.data ? (
            <>
              <b>{db('tole')}</b> ügyfélkérés vár rád, ebből <b>{db('igazolas')}</b> igazolás · <b>{db('tolem')}</b> kérésedre még nem jött válasz
            </>
          ) : (
            ' '
          )
        }
      />
      <div className="tartalom">
        <div className="szegmens" style={{ marginBottom: 16 }}>
          {SZUROK.map((s) => (
            <button key={s.k} className={szuro === s.k ? 'on' : ''} onClick={() => setSp({ szuro: s.k }, { replace: true })}>
              {s.f}
              {q.data && <span className="db">{db(s.k)}</span>}
            </button>
          ))}
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : szurt.length === 0 ? (
            <Ures n="befizetve_jel" cim="Itt most nincs teendő" />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Kérés</th>
                  <th>Ügyfél</th>
                  <th>Mikor</th>
                  <th>Határidő</th>
                  <th className="utolso">Állapot</th>
                </tr>
              </thead>
              <tbody>
                {szurt.map((r) => (
                  <tr key={r.id} className="kattinthato" onClick={() => setNyitott(r)}>
                    <td className="elso">
                      <div className="sor-flex">
                        <I3 n={r.direction === 'konyvelotol' ? 'feltoltes' : 'kerdoiv'} s={36} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{keresCim(r)}</div>
                          <div className="al">{r.certificate?.purpose ? `Cél: ${r.certificate.purpose}` : r.body.slice(0, 80)}</div>
                        </div>
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link to={`/ugyfelek/${r.client.id}/keresek`}>{r.client.name}</Link>
                    </td>
                    <td className="nt">{idopont(r.createdAt, t)}</td>
                    <td>{r.dueDate ? <Hatarido due={r.dueDate} today={t} /> : <span className="halvany">–</span>}</td>
                    <td className="utolso">
                      <span className="szo felkover">{REQUEST_STATUS_LABEL[r.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <KeresKezeloFiok r={nyitott} ugyfel={nyitott?.client.name.split(' ').slice(-1)[0] ?? ''} clientId={nyitott?.client.id ?? ''} bezar={() => setNyitott(null)} />
    </>
  );
}
