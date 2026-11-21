// SPEC §32.B – "Éves áttekintő": one row per client for a tax year – quarters / KATA months, the last folyószámla check,
// the annual closing (whose turn), the difference, the HIPA, the open önellenőrzések and "mi hiányzik". Read only; the
// accountant sees his own clients, the admin everybody. Filters and a CSV download.
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { EV_ATTEKINTO_TEXTS as T, type YearOverviewFilter, type YearOverviewRow } from '../../_shared/eves';
import { attekintoCsv } from '../../lib/eves';
import { datum, ft } from '../../lib/format';
import { today } from '../../lib/today';
import { Fejlec, HibaSav, Toltes } from '../../ui/kozos';

const SZUROK: YearOverviewFilter[] = ['mind', 'hianyzik', 'ram_var', 'ugyfelre_var', 'lejart', 'kata', 'atalany'];
const ALLAPOT: Record<string, string> = { nem_indult: 'nem nyílt meg', kerdoiv: 'kérdőív', dijra_var: 'díjra vár', konyvelonel: 'nálad', jovahagyasra_var: 'jóváhagyásra vár', beadva: 'beadva', kesz: 'kész' };
const Q: Record<string, string> = { nincs: '·', becsles: 'b', jovahagyva: 'J', jelolve: 'j', ellenorizve: '✓', elteres: '!', nincs_fizetendo: '0' };

function letolt(rows: YearOverviewRow[], ev: number) {
  const blob = new Blob(['﻿' + attekintoCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eves_attekinto_${ev}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function EvesAttekinto() {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const ho = Number(t.slice(5, 7));
  const ev = Number(sp.get('ev') ?? (ho <= 6 ? Number(t.slice(0, 4)) - 1 : Number(t.slice(0, 4))));
  const szuro = (sp.get('szuro') ?? 'mind') as YearOverviewFilter;
  const q = useQuery({ queryKey: ['acc', 'overview', ev, szuro], queryFn: () => ep.accYearOverview(ev, szuro) });
  return (
    <>
      <Fejlec cim={T.cim} mellek={<>Ki hol tart az éves ciklusban – kinél mi hiányzik.</>} />
      <div className="tartalom">
        <div className="sor-flex ter" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div className="szegmens" role="tablist" aria-label="Év">
            {[Number(t.slice(0, 4)) - 1, Number(t.slice(0, 4))].map((e) => (
              <button key={e} role="tab" aria-selected={ev === e} className={ev === e ? 'on' : ''} onClick={() => setSp({ ev: String(e), szuro }, { replace: true })}>
                {e}
              </button>
            ))}
          </div>
          <div className="szegmens" role="tablist" aria-label="Szűrő">
            {SZUROK.map((f) => (
              <button key={f} role="tab" aria-selected={szuro === f} className={szuro === f ? 'on' : ''} onClick={() => setSp({ ev: String(ev), szuro: f }, { replace: true })}>
                {T.szurok[f]}
                {q.data ? ` (${q.data.counts[f]})` : ''}
              </button>
            ))}
          </div>
          {q.data && (
            <button className="gomb-m kicsi" onClick={() => letolt(q.data.rows, ev)}>
              {T.csv}
            </button>
          )}
        </div>
        {q.isPending ? (
          <Toltes />
        ) : q.isError ? (
          <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        ) : (
          <div className="lap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>{T.oszlopok.ugyfel}</th>
                  <th>{T.oszlopok.negyedevek}</th>
                  <th>{T.oszlopok.folyoszamla}</th>
                  <th>{T.oszlopok.eves}</th>
                  <th className="jobb">{T.oszlopok.kulonbozet}</th>
                  <th>{T.oszlopok.hipa}</th>
                  <th>{T.oszlopok.onell}</th>
                  <th>{T.oszlopok.hianyzik}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="halvany">
                      Nincs ilyen ügyfél.
                    </td>
                  </tr>
                )}
                {q.data.rows.map((r) => (
                  <tr key={r.clientId}>
                    <td>
                      <Link to={`/ugyfelek/${r.clientId}/eves`}>{r.name}</Link>
                      <div className="halvany kicsi">
                        {r.regime === 'kata' ? 'Kata' : 'Átalány'}
                        {r.lifecycle === 'megszunt' ? ' · megszűnt' : ''}
                      </div>
                    </td>
                    <td className="szam">
                      {r.kata ? (
                        <>
                          {r.kata.ok} rendben{r.kata.open ? `, ${r.kata.open} hiányzik` : ''}
                          {r.kata.unverified ? `, ${r.kata.unverified} ellenőrizetlen` : ''}
                        </>
                      ) : (
                        r.quarters.map((x) => (
                          <span key={x.key} title={`${x.key}: ${x.state}${x.filed ? ', beadva' : ''}`} style={{ marginRight: 6, color: x.overdue ? 'var(--veszely)' : undefined }}>
                            {x.key.slice(5)} {Q[x.state] ?? x.state}
                            {x.filed ? 'B' : ''}
                          </span>
                        ))
                      )}
                    </td>
                    <td>
                      {r.reconciliation ? (
                        <>
                          {datum(r.reconciliation.asOf)} · {r.reconciliation.status}
                          {r.reconciliation.nextCheckOn && (
                            <div className="kicsi" style={{ color: r.reconciliation.overdue ? 'var(--veszely)' : undefined }}>
                              következő: {datum(r.reconciliation.nextCheckOn)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="halvany">nincs</span>
                      )}
                    </td>
                    <td>
                      {r.annual ? ALLAPOT[r.annual.status] ?? r.annual.status : '–'}
                      {r.annual?.ball && <div className="halvany kicsi">{r.annual.ball === 'konyvelo' ? 'rád vár' : 'ügyfélre vár'}</div>}
                    </td>
                    <td className="jobb szam">
                      {r.difference ? (
                        <>
                          {ft(r.difference.diffHuf)}
                          <div className="halvany kicsi">{r.difference.label}</div>
                        </>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className="kicsi">
                      előleg: {r.hipa.advance}
                      <br />
                      éves: {r.hipa.annual}
                    </td>
                    <td className="szam">{r.openCorrections || ''}</td>
                    <td className="kicsi">
                      {r.missing.map((m) => (
                        <div key={m}>{m}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
