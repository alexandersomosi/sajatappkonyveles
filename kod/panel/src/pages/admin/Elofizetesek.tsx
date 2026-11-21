// SPEC §29.1.14 – Előfizetések: provider + mode chip (Stripe teszt / Stripe éles / DEMO / SimplePay), status, the next
// charge (date + the effective amount), card, failures, "Fizesd ki" sent; filters incl. "Megerősítésre vár".
// A server without §29 → the kept SimplePay view. Előtte: kod/panel/_regi/elotte_k7_b3/pages/admin/Elofizetesek.tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SUBSCRIPTION_STATUSES } from '../../_shared/enums';
import type { AdminSubscriptionRowK29 } from '../../_shared/k29';
import * as ep from '../../api/endpoints';
import { k29Elofizetesek, k29Rendszer, nincsK29, stripeHiba, szolgaltatoCimke } from '../../api/k29';
import { Fejlec, Fiok, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { ElofizetesAllapot } from '../../ui/domain';
import { usePirito } from '../../ui/Pirito';
import { fizetesiHiba, SUB_LABEL } from '../../lib/labels';
import { datumRovid } from '../../lib/format';
import { SimplePayElofizetesek } from './ElofizetesekSimplePay';

export { rovidKartya } from './ElofizetesekSimplePay';

const SZOLGALTATO: Record<string, string> = { stripe: 'Stripe', demo: 'DEMO fizetés', simplepay: 'SimplePay', disabled: 'nincs bekapcsolva' };

export default function Elofizetesek() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const problem = sp.get('problem') ?? '';
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['admin', 'k29', 'subs', status, problem], queryFn: () => k29Elofizetesek({ status: status || undefined, problem: problem || undefined }) });
  const mind = useQuery({ queryKey: ['admin', 'k29', 'subs', '', ''], queryFn: () => k29Elofizetesek({}) });
  const rendszer = useQuery({ queryKey: ['admin', 'k29', 'system'], queryFn: k29Rendszer, retry: false });
  const attek = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: ep.adminDashboard });
  const [lemond, setLemond] = useState<AdminSubscriptionRowK29 | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: ['admin', 'k29', 'subs'] });
  const ujra = useMutation({ mutationFn: (id: string) => ep.adminRetrySubscription(id), onSuccess: () => { pir.ok('Újrapróbáltuk a levonást.'); void inv(); }, onError: pir.hiba });
  const cancel = useMutation({ mutationFn: (id: string) => ep.adminCancelSubscription(id), onSuccess: () => { pir.ok('Lemondva a kifizetett időszak végével.'); setLemond(null); void inv(); }, onError: pir.hiba });
  if (q.isError && nincsK29(q.error)) return <SimplePayElofizetesek />;
  const rows = q.data ?? [];
  // ONE MRR definition (admin/dashboard.mrrHuf): charged again = active or past_due, not cancelled at period end, no test clients
  const mrrLista = (mind.data ?? []).filter((r) => (r.status === 'active' || r.status === 'past_due') && !r.cancelAtPeriodEnd && !r.isTest).reduce((a, r) => a + r.nextChargeHuf, 0);
  const mrr = attek.data?.mrrHuf ?? mrrLista;
  const hitelesites = (mind.data ?? []).filter((r) => r.openAuthPayment).length;
  const szolg = rendszer.data ? `${SZOLGALTATO[rendszer.data.paymentProvider] ?? rendszer.data.paymentProvider}${rendszer.data.paymentProvider === 'stripe' ? ` (${rendszer.data.stripe === 'live' ? 'éles' : 'teszt'})` : ''}` : 'Kártyás fizetés';
  const valt = (o: Record<string, string>) => setSp(o, { replace: true });
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Előfizetések"
        mellek={mind.data ? <>{szolg} · havi ismétlődő díjbevétel (MRR): <b><Ft n={mrr} /></b> <span className="egyben">(élő és újrapróbálás alatt álló előfizetések, a lemondottak nélkül)</span></> : ' '}
      />
      <div className="tartalom">
        <div className="szegmens" style={{ marginBottom: 16 }}>
          <button className={!status && !problem ? 'on' : ''} onClick={() => valt({})}>
            Mind
          </button>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => valt({ status: s })}>
              {SUB_LABEL[s]}
            </button>
          ))}
          <button className={problem === 'hitelesites_kell' ? 'on' : ''} onClick={() => valt({ problem: 'hitelesites_kell' })}>
            Megerősítésre vár{hitelesites ? <span className="db">{hitelesites}</span> : null}
          </button>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim="Nincs ilyen előfizetés" />
          ) : (
            <div className="tabla-gorgo">
              <table className="tabla tomor">
                <thead>
                  <tr>
                    <th className="elso">Ügyfél</th>
                    <th>Állapot</th>
                    <th className="tor">Következő levonás</th>
                    <th>Kártya / átutalás</th>
                    <th>Hiba</th>
                    <th className="utolso" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === 'past_due' || r.status === 'suspended' ? 'lejart' : undefined}>
                      <td className="elso">
                        <div className="felkover">{r.client.name}</div>
                        <div className="al">
                          <span className={`cimke ${r.mode === 'live' ? 'info' : 'demo'}`}>{r.providerLabel || szolgaltatoCimke(r.provider, r.mode)}</span>
                          {r.isTest ? ' · teszt-ügyfél' : ''}
                        </div>
                      </td>
                      <td>
                        {r.cancelAtPeriodEnd && r.status === 'active' ? <span className="cimke figyel">Lemondva{r.currentPeriodEnd ? `, ${datumRovid(r.currentPeriodEnd)} megszűnik` : ''}</span> : <ElofizetesAllapot s={r.status} />}
                        {r.graceUntil ? <div className="al">türelmi idő: {datumRovid(r.graceUntil)}</div> : null}
                        {r.openAuthPayment ? <div className="al">„Fizesd ki” elküldve – a bankja megerősítést kér</div> : null}
                      </td>
                      <td className="nt">
                        {r.nextChargeAt && r.status !== 'canceled' && !r.cancelAtPeriodEnd ? (
                          <>
                            {datumRovid(r.nextChargeAt.slice(0, 10))}
                            <div className="al">
                              <Ft n={r.nextChargeHuf} />
                            </div>
                          </>
                        ) : (
                          <span className="halvany">–</span>
                        )}
                      </td>
                      <td>
                        {/* k8: a transfer subscription pays by díjbekérő – no card needed */}
                        {r.billingMethod === 'atutalas' ? <span className="cimke info">átutalás</span> : r.cardLabel ? <span className="szam">{r.cardLabel}</span> : <span className="halvany">nincs kártya</span>}
                      </td>
                      <td>
                        {r.failedAttempts > 0 ? (
                          <>
                            <span className="cimke hiba">{r.failedAttempts} sikertelen</span>
                            {r.lastFailureCode ? (
                              <div className="al" title={fizetesiHiba(r.lastFailureCode).teendo || undefined}>
                                {stripeHiba(r.lastFailureCode) ?? fizetesiHiba(r.lastFailureCode).mi}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="halvany">–</span>
                        )}
                      </td>
                      <td className="utolso jobb nt">
                        {(r.status === 'past_due' || r.status === 'suspended') && !r.openAuthPayment ? (
                          <button className="gomb-m kicsi csak-szoveg" disabled={ujra.isPending} onClick={() => ujra.mutate(r.id)}>
                            Újrapróbálom
                          </button>
                        ) : null}{' '}
                        {r.status !== 'canceled' && !r.cancelAtPeriodEnd ? (
                          <button className="gomb-v" style={{ marginLeft: 10 }} onClick={() => setLemond(r)}>
                            Lemondom
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Fiok
        nyitva={!!lemond}
        bezar={() => setLemond(null)}
        ikon="szamlaszam"
        cim="Lemondod az előfizetést?"
        bev={lemond ? `${lemond.client.name} előfizetése a kifizetett időszak végén (${lemond.currentPeriodEnd ? datumRovid(lemond.currentPeriodEnd) : '–'}) megszűnik. Több levonás nem lesz.` : ''}
        lab={
          <button className="gomb-e" disabled={cancel.isPending} onClick={() => lemond && cancel.mutate(lemond.id)}>
            Igen, lemondom
          </button>
        }
      >
        <p className="halvany">Az ügyfél értesítést kap. A könyvelő a lemondásig rendesen dolgozik. Felmondáshoz (ÁSZF 8.5.) a Konzolt használd.</p>
      </Fiok>
    </>
  );
}
