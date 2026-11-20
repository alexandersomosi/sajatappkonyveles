// SPEC §29.1.12: the SimplePay subscription view, kept for a server without §29 (moved here from Elofizetesek.tsx in k7).
// FUNKCIOK 29: subscriptions – status, card, failures, retry / cancel.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { AdminSubscriptionRow } from '../../api/types';
import { Fejlec, Fiok, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { ElofizetesAllapot } from '../../ui/domain';
import { usePirito } from '../../ui/Pirito';
import { fizetesiHiba, MODE_LABEL, SUB_LABEL } from '../../lib/labels';
import { datumRovid } from '../../lib/format';
import { SUBSCRIPTION_STATUSES } from '../../_shared/enums';

/** "xxxx-xxxx-xxxx-4193" → "•••• 4193": the last four digits are what identifies a card. */
export function rovidKartya(mask: string): string {
  const veg = mask.replace(/[^0-9]/g, '').slice(-4);
  return veg.length === 4 ? `•••• ${veg}` : mask;
}

export function SimplePayElofizetesek() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['admin', 'subs', status], queryFn: () => ep.adminSubscriptions(status || undefined) });
  // The header total never follows the filter: always every active subscription.
  const mind = useQuery({ queryKey: ['admin', 'subs', ''], queryFn: () => ep.adminSubscriptions(undefined) });
  const [lemond, setLemond] = useState<AdminSubscriptionRow | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: ['admin', 'subs'] });
  const ujra = useMutation({ mutationFn: (id: string) => ep.adminRetrySubscription(id), onSuccess: () => { pir.ok('Újrapróbáltuk a terhelést.'); void inv(); }, onError: pir.hiba });
  const cancel = useMutation({ mutationFn: (id: string) => ep.adminCancelSubscription(id), onSuccess: () => { pir.ok('Lemondva a fizetési időszak végével.'); setLemond(null); void inv(); }, onError: pir.hiba });
  const rows = q.data?.items ?? [];
  // ONE definition of the MRR, the dashboard's (admin/dashboard.mrrHuf): subscriptions that will be charged again =
  // active or past_due (the retry is running) and not cancelled at period end, test clients left out. Until the
  // dashboard answers, the same rule is applied to the list.
  const attek = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ep.adminDashboard });
  const mrrLista = (mind.data?.items ?? []).filter((r) => (r.status === 'active' || r.status === 'past_due') && !r.cancelAtPeriodEnd).reduce((a, r) => a + r.priceHuf, 0);
  const mrr = attek.data?.mrrHuf ?? mrrLista;
  return (
    <>
      <Fejlec felcim="Tulajdonos" cim="Előfizetések" mellek={mind.data ? <>SimplePay ismétlődő kártyás fizetés · havi ismétlődő díjbevétel (MRR): <b><Ft n={mrr} /></b> <span className="egyben">(élő és újrapróbálás alatt álló előfizetések, a lemondottak nélkül)</span></> : ' '} />
      <div className="tartalom">
        <div className="szegmens" style={{ marginBottom: 16 }}>
          <button className={!status ? 'on' : ''} onClick={() => setSp({}, { replace: true })}>
            Mind
          </button>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setSp({ status: s }, { replace: true })}>
              {SUB_LABEL[s]}
            </button>
          ))}
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim="Nincs ilyen előfizetés" />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Ügyfél</th>
                  <th>Állapot</th>
                  <th className="jobb">Díj</th>
                  <th className="tor">Következő terhelés</th>
                  <th>Kártya</th>
                  <th>Hiba</th>
                  <th className="utolso" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="elso">
                      <div className="felkover">{r.client.name}</div>
                      <div className="al">
                        {MODE_LABEL[r.mode] ?? r.mode}
                        {r.cancelAtPeriodEnd && ' · lemondta, időszak végén megszűnik'}
                      </div>
                    </td>
                    <td>
                      {r.cancelAtPeriodEnd && r.status === 'active' ? (
                        <span className="cimke figyel">Lemondva{r.currentPeriodEnd ? `, ${datumRovid(r.currentPeriodEnd)} megszűnik` : ''}</span>
                      ) : (
                        <ElofizetesAllapot s={r.status} />
                      )}
                      {r.graceUntil && <div className="al">türelmi idő: {datumRovid(r.graceUntil)}</div>}
                    </td>
                    <td className="jobb">
                      <Ft n={r.priceHuf} />
                    </td>
                    <td className="nt">{r.nextChargeAt ? datumRovid(r.nextChargeAt.slice(0, 10)) : '–'}</td>
                    <td>
                      {r.card ? (
                        <>
                          <span className="szam" title={r.card.mask}>{rovidKartya(r.card.mask)}</span>
                          <div className="al">
                            {r.card.status !== 'aktiv' ? (r.card.status === 'lejart' ? 'lejárt' : r.card.status === 'torolve' ? 'törölve' : 'függőben') : r.cancelAtPeriodEnd || r.status === 'canceled' ? 'nem terheljük többet' : `${r.card.tokensLeft} terhelés maradt`}
                            {r.card.tokensLeft <= 1 && r.card.status === 'aktiv' && !r.cancelAtPeriodEnd && r.status !== 'canceled' && ' – új kártyaregisztráció kell'}
                          </div>
                        </>
                      ) : (
                        <span className="halvany">–</span>
                      )}
                    </td>
                    <td>
                      {r.failedAttempts > 0 ? (
                        <>
                          <span className="cimke hiba">{r.failedAttempts} sikertelen</span>
                          <div className="al" title={fizetesiHiba(r.lastFailureCode, r.status === 'incomplete' ? 'regisztracio' : undefined).teendo || undefined}>
                            {fizetesiHiba(r.lastFailureCode, r.status === 'incomplete' ? 'regisztracio' : undefined).mi}
                          </div>
                        </>
                      ) : (
                        <span className="halvany">–</span>
                      )}
                    </td>
                    <td className="utolso jobb nt">
                      {(r.status === 'past_due' || r.status === 'suspended') && (
                        <button className="gomb-m kicsi csak-szoveg" disabled={ujra.isPending} onClick={() => ujra.mutate(r.id)}>
                          Újrapróbálom
                        </button>
                      )}{' '}
                      {r.status !== 'canceled' && !r.cancelAtPeriodEnd && (
                        <button className="gomb-v" style={{ marginLeft: 10 }} onClick={() => setLemond(r)}>
                          Lemondom
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <Fiok
        nyitva={!!lemond}
        bezar={() => setLemond(null)}
        ikon="szamlaszam"
        cim="Lemondod az előfizetést?"
        bev={lemond ? `${lemond.client.name} előfizetése a fizetett időszak végén (${lemond.currentPeriodEnd ? datumRovid(lemond.currentPeriodEnd) : '–'}) megszűnik. Több terhelés nem lesz.` : ''}
        lab={
          <button className="gomb-e" disabled={cancel.isPending} onClick={() => lemond && cancel.mutate(lemond.id)}>
            Igen, lemondom
          </button>
        }
      >
        <p className="halvany">Az ügyfél értesítést kap. A könyvelő a lemondásig rendesen dolgozik.</p>
      </Fiok>
    </>
  );
}
