// SPEC §29.6 F2 – the client's "Bevételi kimutatás" tab: the same monthly table the client's PDF prints (by the day the
// money arrived), for a chosen period, and "Ellenőriztem, rendben": the approval of exactly this data (hash) – the
// client's PDF then carries the stamp; any later data change removes it.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as k from '../../../api/k29f';
import { INCOME_STATEMENT_TEXTS } from '../../../_shared/k29f';
import { fillPlaceholders } from '../../../_shared/bekotes';
import { HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { datum, honapEv, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import type { FulProps } from '../UgyfelAdatlap';

export default function Kimutatas({ c }: FulProps) {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const ev = t.slice(0, 4);
  const [tol, setTol] = useState(sp.get('from') ?? `${ev}-01`);
  const [ig, setIg] = useState(sp.get('to') ?? t.slice(0, 7));
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['acc', 'kimutatas', c.id, tol, ig], queryFn: () => k.accIncomeStatement(c.id, tol, ig) });
  const jovahagy = useMutation({
    mutationFn: () => k.accIncomeStatementApprove(c.id, { from: q.data!.from, to: q.data!.to, dataSha256: q.data!.dataSha256 }),
    onSuccess: (v) => {
      qc.setQueryData(['acc', 'kimutatas', c.id, tol, ig], v);
      pir.ok('Rögzítettük. Az ügyfél PDF-jén rajta lesz az ellenőrzés.');
    },
    onError: pir.hiba,
  });
  const m = q.data;
  const valt = (f: string, to: string) => {
    setTol(f);
    setIg(to);
    setSp({ from: f, to }, { replace: true });
  };
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="szamolo" />
          <h2>{INCOME_STATEMENT_TEXTS.panelTitle}</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="mezo" style={{ margin: 0 }}>
            <span className="felirat">Ettől</span>
            <input className="doboz" type="month" value={tol} max={ig} onChange={(e) => e.target.value && valt(e.target.value, ig)} />
          </label>
          <label className="mezo" style={{ margin: 0 }}>
            <span className="felirat">Eddig</span>
            <input className="doboz" type="month" value={ig} min={tol} max={t.slice(0, 7)} onChange={(e) => e.target.value && valt(tol, e.target.value)} />
          </label>
          <div className="szegmens">
            <button className={tol === `${ev}-01` && ig === t.slice(0, 7) ? 'on' : ''} onClick={() => valt(`${ev}-01`, t.slice(0, 7))}>
              Idei
            </button>
            <button className={tol === `${Number(ev) - 1}-01` && ig === `${Number(ev) - 1}-12` ? 'on' : ''} onClick={() => valt(`${Number(ev) - 1}-01`, `${Number(ev) - 1}-12`)}>
              {Number(ev) - 1}
            </button>
          </div>
        </div>
        {m ? <p className="halvany" style={{ marginTop: 8 }}>{m.regimeLines.join(' · ')}</p> : null}
      </div>
      {q.isError ? (
        <div className="szak">
          <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        </div>
      ) : q.isPending || !m ? (
        <div className="szak">
          <Toltes />
        </div>
      ) : (
        <>
          <div className="szak" style={{ padding: 0 }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">{INCOME_STATEMENT_TEXTS.colMonth}</th>
                  <th className="jobb">{INCOME_STATEMENT_TEXTS.colInvoices}</th>
                  <th className="jobb">{INCOME_STATEMENT_TEXTS.colOther}</th>
                  <th className="jobb utolso">{INCOME_STATEMENT_TEXTS.colRevenue}</th>
                </tr>
              </thead>
              <tbody>
                {m.months.map((x) => (
                  <tr key={x.month}>
                    <td className="elso">
                      {honapEv(x.month)}
                      {x.estimated ? '*' : ''}
                    </td>
                    <td className="jobb nt">{x.invoices}</td>
                    <td className="jobb nt">{x.other}</td>
                    <td className="jobb utolso nt">{szam(x.revenueHuf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="elso">{INCOME_STATEMENT_TEXTS.total}</td>
                  <td className="jobb nt">{m.months.reduce((s, x) => s + x.invoices, 0)}</td>
                  <td className="jobb nt">{m.months.reduce((s, x) => s + x.other, 0)}</td>
                  <td className="jobb utolso nt">{szam(m.totalHuf)} Ft</td>
                </tr>
              </tfoot>
            </table>
            <p className="halvany" style={{ padding: '8px 22px 14px', fontSize: 13.5 }}>
              {fillPlaceholders(INCOME_STATEMENT_TEXTS.manualPart, { osszeg: szam(m.manualHuf) })}
              {m.months.some((x) => x.estimated) ? ` · ${INCOME_STATEMENT_TEXTS.estimatedMark}` : ''}
            </p>
          </div>
          <div className="szak">
            <div className="szak-fej">
              <I3 n="igazolas" />
              <h2>Ellenőrzés</h2>
              {m.reviewRequested ? <span className="cimke figyel">{INCOME_STATEMENT_TEXTS.panelReview}</span> : null}
            </div>
            {m.approved ? (
              <p>{fillPlaceholders(INCOME_STATEMENT_TEXTS.panelApproved, { datum: datum(m.approved.at.slice(0, 10), { ev: true }) })}</p>
            ) : (
              <>
                <p>{m.changedSinceApproval ? INCOME_STATEMENT_TEXTS.panelChanged : 'Nézd át a hónapokat. Ha rendben van, jelöld: az ügyfél PDF-jén megjelenik, hogy ellenőrizted.'}</p>
                <button type="button" className="gomb-e" style={{ marginTop: 10 }} disabled={jovahagy.isPending || m.totalHuf === 0} onClick={() => jovahagy.mutate()}>
                  {INCOME_STATEMENT_TEXTS.panelApprove}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
