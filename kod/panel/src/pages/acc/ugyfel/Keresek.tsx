// Kérések: requests both ways for one client; create and handle (FUNKCIOK 17, 24).
import { useState } from 'react';
import { LOCK_TEXTS } from '../../../_shared/bekotes';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { RequestSummary } from '../../../api/types';
import { HibaSav, Toltes, Ures } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { Hatarido } from '../../../ui/domain';
import { REQUEST_STATUS_LABEL } from '../../../lib/labels';
import { datum } from '../../../lib/format';
import { today } from '../../../lib/today';
import { KeresKezeloFiok, UjKeresFiok, keresCim } from '../keresKozos';

export default function Keresek({ c }: FulProps) {
  const [sp, setSp] = useSearchParams();
  const t = today();
  const q = useQuery({ queryKey: ['acc', 'requests', 'client', c.id], queryFn: () => ep.accRequests({ clientId: c.id }) });
  const [nyitott, setNyitott] = useState<RequestSummary | null>(null);
  const uj = sp.get('uj') === '1';
  const items = q.data?.items ?? [];
  const nyitottak = items.filter((r) => r.status === 'nyitott' || r.status === 'folyamatban');
  const lezartak = items.filter((r) => !(r.status === 'nyitott' || r.status === 'folyamatban'));
  const Sor = ({ r }: { r: RequestSummary }) => (
    <button className="ikonsor" style={{ width: '100%', textAlign: 'left' }} onClick={() => setNyitott(r)}>
      <I3 n={r.direction === 'konyvelotol' ? 'feltoltes' : 'igazolas'} s={44} />
      <div className="l">
        <div className="cim">{keresCim(r)}</div>
        <div className="al">
          {r.direction === 'konyvelotol' ? 'Te kérted' : `${c.firstName} kérte`} {datum(r.createdAt.slice(0, 10))} · <b style={{ color: 'var(--tinta)' }}>{REQUEST_STATUS_LABEL[r.status]}</b>
          {r.certificate?.purpose && ` · cél: ${r.certificate.purpose}`}
        </div>
        {r.dueDate && (r.status === 'nyitott' || r.status === 'folyamatban') && (
          <div className="al">
            Határidő: <Hatarido due={r.dueDate} today={t} />
          </div>
        )}
      </div>
      <span className="gomb-sz">Megnyitom</span>
    </button>
  );
  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14 }}>
        <span className="halvany">Iratot, adatot kérhetsz tőle; ő igazolást és adatváltozást kérhet tőled.</span>
        <button className="gomb-e" disabled={!!c.serviceLock} title={c.serviceLock ? LOCK_TEXTS.panelDisabled : undefined} onClick={() => setSp({ uj: '1' }, { replace: true })}>
          Új kérés {c.firstName} részére
        </button>
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {q.isPending ? (
        <Toltes />
      ) : (
        <div className="racs k2" style={{ alignItems: 'start' }}>
          <div className="lap">
            <div className="lap-fej">
              <h2>Nyitott</h2>
              <span className="megj">{nyitottak.length} db</span>
            </div>
            {nyitottak.length === 0 ? <Ures n="befizetve_jel" cim="Nincs nyitott kérés" /> : nyitottak.map((r) => <Sor key={r.id} r={r} />)}
          </div>
          <div className="lap">
            <div className="lap-fej">
              <h2>Lezárt</h2>
              <span className="megj">{lezartak.length} db</span>
            </div>
            {lezartak.length === 0 ? <div className="belso halvany" style={{ paddingTop: 0 }}>Még nincs lezárt kérés.</div> : lezartak.map((r) => <Sor key={r.id} r={r} />)}
          </div>
        </div>
      )}
      <UjKeresFiok nyitva={uj} bezar={() => setSp({}, { replace: true })} clientId={c.id} ugyfel={c.firstName} />
      <KeresKezeloFiok r={nyitott} ugyfel={c.firstName} clientId={c.id} bezar={() => setNyitott(null)} />
    </>
  );
}
