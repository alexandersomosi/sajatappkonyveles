// FUNKCIOK 28, 35: audit search for the owner.
import { useState } from 'react';
import { Fejlec, Lenyilo } from '../../ui/kozos';
import { NaploTabla } from '../kozos/NaploTabla';
import * as ep from '../../api/endpoints';
import { auditSzuroLista } from '../../lib/labels';

export default function Naplo() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <>
      <Fejlec felcim="Tulajdonos" cim="Napló" mellek="Minden belépés, irat-megnyitás, jóváhagyás és módosítás. A naplót senki nem írhatja át; 5 évig őrizzük." />
      <div className="tartalom">
        <div className="sor-flex" style={{ marginBottom: 14 }}>
          <Lenyilo className="doboz" style={{ width: 300 }} value={action} onChange={(e) => setAction(e.target.value)} aria-label="Esemény">
            <option value="">Minden esemény</option>
            {auditSzuroLista().map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Lenyilo>
          <span className="halvany kicsi">ettől</span>
          <input className="doboz" type="date" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="halvany kicsi">eddig</span>
          <input className="doboz" type="date" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <NaploTabla
          kulcs={['admin', 'audit', action, from, to]}
          lekero={(cursor) => ep.adminAudit({ action: action || undefined, from: from || undefined, to: to || undefined, cursor })}
          ugyfelLink={false}
        />
      </div>
    </>
  );
}
