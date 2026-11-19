// FUNKCIOK 25: weekly deadline board – who has what due this week, who is behind.
import { useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { datum, elvalaszt, HONAPOK } from '../../lib/format';
import { today, isoWeek } from '../../lib/today';
import type { BoardItem } from '../../api/types';

const NAP = ['hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat', 'vasárnap'];
const KIND: Record<string, string> = { befizetes: 'Befizetés', bevallas: 'Bevallás', keres: 'Kérés', idopont: 'Időpont', egyeb: 'Egyéb' };

function Feladat({ i }: { i: BoardItem }) {
  return (
    <div className={`feladat${i.status === 'kesz' ? ' kesz' : ''}${i.overdue ? ' lejart' : ''}`} title={i.title}>
      <b style={i.status === 'kesz' ? { display: 'flex', alignItems: 'center', gap: 5 } : undefined}>
        {i.status === 'kesz' && <I3 n="befizetve_jel" s={16} alt="Kész" />}
        {KIND[i.kind] ?? i.kind}
      </b>
      {elvalaszt(i.title)}
      {i.amountHuf ? (
        <div>
          <Ft n={i.amountHuf} />
        </div>
      ) : null}
    </div>
  );
}

function hetfo(het: string): number {
  const [y, w] = het.split('-W').map(Number);
  const jan4 = Date.UTC(y!, 0, 4);
  const nap = new Date(jan4).getUTCDay() || 7;
  return jan4 - (nap - 1) * 86_400_000 + (w! - 1) * 7 * 86_400_000;
}
/** "2026-W48" → "Jövő hét" / "Múlt hét" / "48. hét" (never the raw ISO key). */
export function hetFelirat(het: string, t: string): string {
  const most = isoWeek(t);
  if (het === most) return 'Ez a hét';
  const kul = Math.round((hetfo(het) - hetfo(most)) / (7 * 86_400_000));
  if (kul === 1) return 'Jövő hét';
  if (kul === -1) return 'Múlt hét';
  const [y, w] = het.split('-W').map(Number);
  return y === Number(most.slice(0, 4)) ? `${w}. hét` : `${y}, ${w}. hét`;
}

export default function HataridoFigyelo() {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const het = sp.get('het') ?? isoWeek(t);
  const q = useQuery({ queryKey: ['acc', 'board', het], queryFn: () => ep.accBoard(het), placeholderData: (p) => p });
  const d = q.data;
  const munkanapok = d?.days.slice(0, 5) ?? [];
  const hetvege = d?.days.slice(5) ?? [];
  const elsoNap = d?.days[0];
  const utolsoNap = d?.days[6];
  const db = d?.rows.reduce((a, r) => a + r.items.filter((i) => i.status !== 'kesz').length, 0) ?? 0;
  return (
    <>
      <Fejlec
        felcim={hetFelirat(het, t)}
        cim="Határidő-figyelő"
        mellek={
          d && elsoNap && utolsoNap ? (
            <>
              {datum(elsoNap)} – {datum(utolsoNap)} · <b>{db}</b> nyitott tétel · <b>{d.overdue.length}</b> lemaradás
            </>
          ) : (
            ' '
          )
        }
        jobb={
          d && (
            <>
              <button className="gomb-sav szoveg" onClick={() => setSp({ het: d.prevWeek }, { replace: true })}>
                Előző hét
              </button>
              {het !== isoWeek(t) && (
                <button className="gomb-sav szoveg" onClick={() => setSp({}, { replace: true })}>
                  Ez a hét
                </button>
              )}
              <button className="gomb-sav szoveg" onClick={() => setSp({ het: d.nextWeek }, { replace: true })}>
                Következő hét
              </button>
            </>
          )
        }
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending ? (
          <Toltes />
        ) : (
          d && (
            <>
              {d.overdue.length > 0 && (
                <div className="lap" style={{ marginBottom: 16 }}>
                  <div className="lap-fej" style={{ paddingBottom: 6 }}>
                    <I3 n="hataridok" s={36} />
                    <h2>Lemaradás</h2>
                    <span className="megj">Lejárt, de még nincs kész. Ezekre érdemes rászólni.</span>
                  </div>
                  <div className="belso" style={{ paddingTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {d.overdue.map((o) => (
                      <Link key={o.id} to={`/ugyfelek/${o.client.id}/keresek`} className="feladat lejart" style={{ textDecoration: 'none', color: 'var(--tinta)', padding: '10px 12px', fontSize: 14 }}>
                        <b>{o.client.name}</b>
                        {o.title} · <span className="felkover" style={{ color: '#8A1C12' }}>{o.daysOverdue} napja lejárt</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="lap" style={{ overflow: 'hidden' }}>
                {d.rows.length === 0 ? (
                  <Ures n="hatarido_naptar" cim="Ezen a héten nincs határidő">
                    Nyugis hét. A következő hétre a gombbal lapozhatsz.
                  </Ures>
                ) : (
                  <div className="het" role="table" aria-label="Heti határidők">
                    <div className="fej" style={{ paddingLeft: 22 }} role="columnheader">
                      Ügyfél
                    </div>
                    {munkanapok.map((n, i) => (
                      <div key={n} className={`fej${n === t ? ' ma' : ''}`} role="columnheader">
                        {NAP[i]}
                        <b>
                          {HONAPOK[Number(n.slice(5, 7)) - 1]!.slice(0, 3)}. {Number(n.slice(8))}.
                        </b>
                      </div>
                    ))}
                    <div className="fej" role="columnheader">
                      Hétvége
                    </div>
                    {d.rows.map((r) => (
                      <div key={r.client.id} style={{ display: 'contents' }} role="row">
                        <div className="ugyfel" role="cell">
                          <Link to={`/ugyfelek/${r.client.id}`}>{r.client.name}</Link>
                        </div>
                        {munkanapok.map((n) => (
                          <div key={n} className={`cella${n === t ? ' ma' : ''}`} role="cell">
                            {r.items
                              .filter((i) => i.dueDate === n)
                              .map((i) => (
                                <Feladat key={i.id} i={i} />
                              ))}
                          </div>
                        ))}
                        <div className="cella" role="cell">
                          {r.items
                            .filter((i) => hetvege.includes(i.dueDate))
                            .map((i) => (
                              <Feladat key={i.id} i={i} />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
                {d.overdue.length === 0 ? 'Senki nincs lemaradva. ' : ''}A kész tételek áthúzás helyett pipával, halványan látszanak. A hétvégére eső NAV-határidő a következő munkanapra tolódik.
              </p>
            </>
          )
        )}
      </div>
    </>
  );
}
