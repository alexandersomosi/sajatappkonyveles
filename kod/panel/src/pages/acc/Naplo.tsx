// FUNKCIOK 28: audit of the accountant's own clients.
import { Fejlec } from '../../ui/kozos';
import { NaploTabla } from '../kozos/NaploTabla';
import * as ep from '../../api/endpoints';

export default function Naplo() {
  return (
    <>
      <Fejlec cim="Napló" mellek="Ki mit csinált, mikor – a te ügyfeleidnél. Üzenetek szövegét, kódokat és teljes azonosítókat nem írunk bele." />
      <div className="tartalom">
        <NaploTabla kulcs={['acc', 'audit', 'mind']} lekero={(cursor) => ep.accAudit({ cursor })} />
      </div>
    </>
  );
}
