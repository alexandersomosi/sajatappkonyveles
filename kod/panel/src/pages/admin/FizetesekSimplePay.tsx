// SPEC §29.1.12: the SimplePay transaction list, kept for PAYMENT_PROVIDER=simplepay and the history (moved here from
// Fizetesek.tsx in k7; the page now shows the provider-neutral payments of §29.1.2).
// FUNKCIOK 29: SimplePay transactions, failed ones first.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { MODE_LABEL, fizetesiHiba } from '../../lib/labels';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';

const ALLAPOT: Record<string, string> = {
  FINISHED: 'Sikeres',
  AUTHORIZED: 'Engedélyezve',
  INIT: 'Elindult',
  INPAYMENT: 'Fizetés alatt',
  FRAUD: 'Gyanús, elutasítva',
  NOTAUTHORIZED: 'Elutasítva',
  CANCELLED: 'Megszakítva',
  TIMEOUT: 'Lejárt',
  REVERSED: 'Visszavonva',
  REFUND: 'Visszatérítve',
};
const SIKERTELEN = ['FRAUD', 'NOTAUTHORIZED', 'CANCELLED', 'TIMEOUT'];
const FAJTA: Record<string, string> = { regisztracio: 'Kártyaregisztráció + 1. hónap', ismetlodo: 'Havidíj', visszaterites: 'Visszatérítés' };

export function SimplePayFizetesek() {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? 'failed';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({ queryKey: ['admin', 'payments', status, from, to], queryFn: () => ep.adminPayments({ status: status === 'mind' ? undefined : status, from: from || undefined, to: to || undefined }) });
  const rows = q.data?.items ?? [];
  return (
    <>
      <Fejlec felcim="Tulajdonos" cim="Fizetések" mellek="SimplePay-tranzakciók. A sikertelen terheléseket a rendszer +1, +3 és +7 nap múlva újrapróbálja." />
      <div className="tartalom">
        <div className="sor-flex ter" style={{ marginBottom: 16 }}>
          <div className="szegmens">
            {[
              ['failed', 'Sikertelen'],
              ['finished', 'Sikeres'],
              ['mind', 'Mind'],
            ].map(([k, f]) => (
              <button key={k} className={status === k ? 'on' : ''} onClick={() => setSp({ status: k! }, { replace: true })}>
                {f}
              </button>
            ))}
          </div>
          <div className="sor-flex">
            <label className="halvany kicsi">Ettől</label>
            <input className="doboz" type="date" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <label className="halvany kicsi">eddig</label>
            <input className="doboz" type="date" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim={status === 'failed' ? 'Nincs sikertelen fizetés' : 'Nincs fizetés ebben az időszakban'} />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Mikor</th>
                  <th>Ügyfél</th>
                  <th>Mi</th>
                  <th className="jobb">Összeg</th>
                  <th>Eredmény</th>
                  <th className="utolso">Azonosító</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="elso nt">{idopont(r.createdAt, t)}</td>
                    <td className="felkover">{r.client.name}</td>
                    <td>
                      {FAJTA[r.kind] ?? r.kind}
                      {r.mode !== 'live' && <span className="cimke demo" style={{ marginLeft: 6 }}>{MODE_LABEL[r.mode]}</span>}
                    </td>
                    <td className="jobb">
                      <Ft n={r.amountHuf} />
                    </td>
                    <td>
                      {SIKERTELEN.includes(r.status) ? <span className="cimke hiba">{ALLAPOT[r.status] ?? r.status}</span> : <span className="szo felkover">{ALLAPOT[r.status] ?? r.status}</span>}
                      {r.errorCodes.map((k) => {
                        const h = fizetesiHiba(k, r.kind);
                        return (
                          <div className="al" key={k} title={h.teendo || undefined}>
                            {h.mi} {!h.mi.includes(h.kod) && <span className="halvany szam">({h.kod})</span>}
                            {h.teendo && <div className="halvany kicsi">{h.teendo}</div>}
                          </div>
                        );
                      })}
                    </td>
                    <td className="utolso halvany kicsi szam">{r.orderRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
