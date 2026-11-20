// SPEC §29.5 F1 – /igazolasok: the certificate queue (accountant: own clients, admin: all). Overdue first (NAV has 6
// days). A row opens the drawer with everything IGAZOL needs and the three actions (IgazolasokReszlet.tsx).
import { useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as k from '../../api/k29f';
import { CERT_PANEL_TEXTS, CERT_STATUS_LABELS, type AccCertificateRow, type CertStatus } from '../../_shared/k29f';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { datum, idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { IgazolasFiok } from './IgazolasokReszlet';

type Szuro = 'open' | 'kesz' | 'all';
const SZUROK: { k: Szuro; f: string }[] = [
  { k: 'open', f: 'Nyitott' },
  { k: 'kesz', f: 'Kész' },
  { k: 'all', f: 'Mind' },
];

function AllapotCimke({ r }: { r: AccCertificateRow }) {
  if (r.overdue) return <span className="cimke hiba">{CERT_PANEL_TEXTS.overdue}</span>;
  const cls: Partial<Record<CertStatus, string>> = { dijra_var: 'figyel', elutasitva: 'hiba', navnal: 'info' };
  return <span className={`cimke ${cls[r.status] ?? ''}`}>{CERT_STATUS_LABELS[r.status]}</span>;
}

export default function Igazolasok() {
  const t = today();
  const nav = useNavigate();
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const szuro = (sp.get('szuro') as Szuro) || 'open';
  const q = useQuery({ queryKey: ['acc', 'certificates', szuro], queryFn: () => k.accCertificates(szuro) });
  const lista = q.data?.items ?? [];
  const lejart = lista.filter((r) => r.overdue).length;
  return (
    <>
      <Fejlec
        cim={CERT_PANEL_TEXTS.queueTitle}
        mellek={
          <>
            {CERT_PANEL_TEXTS.queueSub}
            {q.data && szuro === 'open' ? (
              <>
                {' '}
                <b>{lista.length}</b> nyitott kérés{lejart ? (
                  <>
                    , ebből <b>{lejart}</b> túl a 6 napon
                  </>
                ) : null}
                .
              </>
            ) : null}
          </>
        }
      />
      <div className="tartalom">
        <div className="szegmens" style={{ marginBottom: 16 }}>
          {SZUROK.map((s) => (
            <button key={s.k} className={szuro === s.k ? 'on' : ''} onClick={() => setSp({ szuro: s.k }, { replace: true })}>
              {s.f}
            </button>
          ))}
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : lista.length === 0 ? (
            <Ures n="befizetve_jel" cim="Most nincs igazolás-kérés" />
          ) : (
            <div className="tabla-gorgo">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="elso">Igazolás</th>
                    <th>Ügyfél</th>
                    <th>Mire / kinek</th>
                    <th>Meddig kell</th>
                    <th>Kérte</th>
                    <th className="utolso">Állapot</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id} className={`kattinthato${r.id === id ? ' kijelolt' : ''}`} onClick={() => nav(`/igazolasok/${r.id}?szuro=${szuro}`)}>
                      <td className="elso">
                        <div className="sor-flex">
                          <I3 n="igazolas" s={32} />
                          <div>
                            <div style={{ fontWeight: 600 }}>{r.typeLabel}{r.year ? ` ${r.year}` : ''}</div>
                            <div className="al">{r.ageDays === 0 ? 'ma' : `${r.ageDays} napja`}</div>
                          </div>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Link to={`/ugyfelek/${r.clientId}/keresek`}>{r.clientName}</Link>
                        {r.accountantName ? <div className="al">{r.accountantName}</div> : null}
                      </td>
                      <td>
                        {r.purposeLabel}
                        {r.userName ? <div className="al">{r.userName}</div> : null}
                      </td>
                      <td className="nt">{r.neededBy ? datum(r.neededBy, { ev: true }) : <span className="halvany">–</span>}</td>
                      <td className="nt">{idopont(r.createdAt, t)}</td>
                      <td className="utolso">
                        <AllapotCimke r={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <IgazolasFiok id={id ?? null} bezar={() => nav(`/igazolasok?szuro=${szuro}`, { replace: true })} />
    </>
  );
}
