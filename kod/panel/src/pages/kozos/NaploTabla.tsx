// Audit log table (FUNKCIOK 28, 35): who did what, when. Details never hold message bodies or full identifiers (SPEC §4.6).
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { AuditRow, Page } from '../../api/types';
import { HibaSav, Toltes, Ures } from '../../ui/kozos';
import { ROLE_LABEL, auditDetail, auditLabel } from '../../lib/labels';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';

const reszlet = auditDetail;

export function NaploTabla({
  kulcs,
  lekero,
  ugyfelOszlop = true,
  ugyfelLink = true,
}: {
  kulcs: unknown[];
  lekero: (cursor?: string) => Promise<Page<AuditRow>>;
  ugyfelOszlop?: boolean;
  ugyfelLink?: boolean;
}) {
  const t = today();
  const q = useInfiniteQuery({
    queryKey: kulcs,
    queryFn: ({ pageParam }) => lekero(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="lap">
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {q.isPending ? (
        <Toltes />
      ) : rows.length === 0 ? (
        <Ures n="ures_mappa" cim="Nincs naplóbejegyzés" />
      ) : (
        <>
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso">Mikor</th>
                <th>Ki</th>
                <th>Mit csinált</th>
                {ugyfelOszlop && <th>Ügyfél</th>}
                <th className="utolso">Részlet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="elso nt">{idopont(r.at, t)}</td>
                  <td style={{ minWidth: 150 }}>
                    <span className="egyben">{r.actor.name}</span>
                    <div className="al">{ROLE_LABEL[r.actor.role] ?? r.actor.role}</div>
                  </td>
                  <td>{auditLabel(r.action)}</td>
                  {ugyfelOszlop && <td>{r.client ? ugyfelLink ? <Link to={`/ugyfelek/${r.client.id}`}>{r.client.name}</Link> : r.client.name : <span className="halvany">–</span>}</td>}
                  <td className="utolso halvany kicsi">{reszlet(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.hasNextPage && (
            <div className="lapozo">
              <button className="gomb-m csak-szoveg" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                Korábbiak
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
