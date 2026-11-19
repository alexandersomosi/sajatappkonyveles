// Napló of one client: who did what, when (FUNKCIOK 28) – and, since SPEC §28, which notifications he got.
import { useSearchParams } from 'react-router';
import type { FulProps } from '../UgyfelAdatlap';
import { NaploTabla } from '../../kozos/NaploTabla';
import * as ep from '../../../api/endpoints';
import Ertesitesnaplo from './Ertesitesnaplo';

export default function Naplo({ c }: FulProps) {
  const [sp, setSp] = useSearchParams();
  const mit = sp.get('mit') === 'ertesitesek' ? 'ertesitesek' : 'muveletek';
  return (
    <>
      <div className="szegmens" role="tablist" aria-label="Napló" style={{ marginBottom: 16 }}>
        {(
          [
            ['muveletek', 'Műveletek'],
            ['ertesitesek', 'Értesítések, amiket kapott'],
          ] as const
        ).map(([k, f]) => (
          <button
            key={k}
            role="tab"
            aria-selected={mit === k}
            className={mit === k ? 'on' : ''}
            onClick={() => {
              const n = new URLSearchParams(sp);
              if (k === 'muveletek') n.delete('mit');
              else n.set('mit', k);
              setSp(n, { replace: true });
            }}
          >
            {f}
          </button>
        ))}
      </div>
      {mit === 'ertesitesek' ? <Ertesitesnaplo c={c} /> : <NaploTabla kulcs={['acc', 'audit', c.id]} lekero={(cursor) => ep.accAudit({ clientId: c.id, cursor })} ugyfelOszlop={false} />}
    </>
  );
}
