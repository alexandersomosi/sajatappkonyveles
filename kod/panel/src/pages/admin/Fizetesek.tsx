// SPEC §29.1.14 – Fizetések: every payment row (first month, monthly, one-off, "Fizesd ki"; Stripe or DEMO): client,
// kind, amount, status, card, the Stripe id as a Dashboard link (test/live path by mode), refunded amount, dispute;
// filters; "Visszatérítés" = the console action of §29.9 (amount + reason + step-up; the server makes the storno or the
// corrective invoice). The old SimplePay transactions stay one click away (?nezet=simplepay).
// Előtte: kod/panel/_regi/elotte_k7_b3/pages/admin/Fizetesek.tsx
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DISPUTE_TEXTS, PAYMENT_KIND_LABELS, PAYMENT_STATUS_LABELS_K29, type AdminPaymentRow } from '../../_shared/k29';
import { k29Fizetesek, konzolVisszaterites, nincsK29, stripeHiba, szolgaltatoCimke } from '../../api/k29';
import { Fejlec, Fiok, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { useMegerosites } from '../../ui/Megerosites';
import { usePirito } from '../../ui/Pirito';
import { fizetesiHiba } from '../../lib/labels';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { SimplePayFizetesek } from './FizetesekSimplePay';
import { AtutalasSzakasz } from './konzol/Atutalas';
import { LepcsoProvider } from './konzol/lepcso';

/** [key, label, server filter (one status), row filter on the page] */
const SZURO: [string, string, Record<string, string | undefined>, ((r: AdminPaymentRow) => boolean) | null][] = [
  ['problema', 'Gond van', {}, (r) => ['sikertelen', 'hitelesites_kell', 'bizonytalan', 'duplikalt'].includes(r.status) || !!r.disputeStatus],
  ['hitelesites', 'Megerősítésre vár', { status: 'hitelesites_kell' }, null],
  ['sikeres', 'Sikeres', { status: 'sikeres' }, null],
  ['visszautalt', 'Visszautalt', {}, (r) => r.refundedHuf > 0],
  ['mind', 'Mind', {}, null],
];
/** k8: the bank-transfer view (díjbekérők: fizetett / vár / késik) – the same section as on the console overview. */
const ATUTALAS = 'atutalas';
const HIBAS = ['sikertelen', 'hitelesites_kell', 'bizonytalan', 'duplikalt'];

function Visszaterites({ r, bezar }: { r: AdminPaymentRow | null; bezar: () => void }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const meg = useMegerosites();
  const [osszeg, setOsszeg] = useState('');
  const [ok, setOk] = useState('');
  const [hiba, setHiba] = useState<Record<string, string>>({});
  const max = r?.refundableHuf ?? 0;
  const n = osszeg.trim() === '' ? max : Math.round(Number(osszeg.replace(/\s/g, '')));
  const teljes = n === max && (r?.refundedHuf ?? 0) === 0;
  const m = useMutation({
    mutationFn: () => meg.futtat(() => konzolVisszaterites(r!.id, { amountHuf: n, reason: ok.trim() })),
    onSuccess: (v) => {
      pir.ok(`Visszautaltunk ${new Intl.NumberFormat('hu-HU').format(v?.refundedHuf ?? n)} Ft-ot. ${v?.invoiceAction === 'sztorno' ? 'A számlát sztornóztuk.' : v?.invoiceAction === 'helyesbito' ? 'Helyesbítő számla készül.' : ''}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'k29'] });
      bezar();
    },
    onError: pir.hiba,
  });
  const kuld = () => {
    const h: Record<string, string> = {};
    if (!Number.isInteger(n) || n < 1 || n > max) h.osszeg = `1 és ${max} Ft között, egész forintban.`;
    if (ok.trim().length < 5) h.ok = 'Írd le röviden az okát (legalább 5 karakter).';
    setHiba(h);
    if (!Object.keys(h).length) m.mutate();
  };
  return (
    <>
      <Fiok
        nyitva={!!r}
        bezar={bezar}
        ikon="szamlaszam"
        cim="Visszatérítés"
        bev={r ? `${r.client.name} · ${PAYMENT_KIND_LABELS[r.kind]} · ${new Intl.NumberFormat('hu-HU').format(r.amountHuf)} Ft` : ''}
        lab={
          <button className="gomb-e" disabled={m.isPending} onClick={kuld}>
            Megerősítem
          </button>
        }
      >
        <label className="mezo">
          <span className="felirat">Összeg (Ft)</span>
          <input className={`doboz${hiba.osszeg ? ' hibas' : ''}`} inputMode="numeric" placeholder={String(max)} value={osszeg} onChange={(e) => setOsszeg(e.target.value)} />
          {hiba.osszeg ? <span className="hiba-szoveg">{hiba.osszeg}</span> : <span className="sugo">Legfeljebb {new Intl.NumberFormat('hu-HU').format(max)} Ft (ami még nincs visszautalva).</span>}
        </label>
        <label className="mezo">
          <span className="felirat">Miért?</span>
          <input className={`doboz${hiba.ok ? ' hibas' : ''}`} value={ok} maxLength={300} onChange={(e) => setOk(e.target.value)} />
          {hiba.ok ? <span className="hiba-szoveg">{hiba.ok}</span> : <span className="sugo">A naplóba kerül; az ügyfél nem látja.</span>}
        </label>
        <p className="halvany" style={{ marginTop: 14 }}>
          {r ? `${new Intl.NumberFormat('hu-HU').format(Number.isFinite(n) ? n : 0)} Ft megy vissza ${r.cardLabel ? `a kártyájára (${r.cardLabel})` : 'a kártyájára'}, a bankjától függően pár munkanap alatt. ` : ''}
          {teljes ? 'A számlát a Számlázz.hu-ban automatikusan sztornózzuk.' : 'A visszautalt részről helyesbítő számla készül.'} Az ügyfél értesítést kap.
        </p>
      </Fiok>
      {meg.lap}
    </>
  );
}

export default function Fizetesek() {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const nezet = sp.get('nezet');
  const szuro = sp.get('szuro') ?? 'problema';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vissza, setVissza] = useState<AdminPaymentRow | null>(null);
  const sz = SZURO.find(([k]) => k === szuro) ?? SZURO[0]!;
  const feltetel = sz[2];
  const atutalas = szuro === ATUTALAS;
  const q = useQuery({ queryKey: ['admin', 'k29', 'payments', szuro, from, to], queryFn: () => k29Fizetesek({ ...feltetel, from: from || undefined, to: to || undefined }), enabled: nezet !== 'simplepay' && !atutalas });
  if (nezet === 'simplepay' || (q.isError && nincsK29(q.error))) return <SimplePayFizetesek />;
  const rows = (q.data ?? []).filter((r) => !sz[3] || sz[3](r));
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Fizetések"
        mellek={
          atutalas ? (
            <>Átutalással fizető ügyfelek díjbekérői: fizetett, vár, késik. A későknek a határidő után 1, 4 és 8 nappal emlékeztetőt küldünk.</>
          ) : (
            <>Minden kártyás fizetés: első hónap, havidíj, külön díj, „Fizesd ki”. A sikertelen havidíjat +1, +3 és +7 nap múlva újra megpróbáljuk; naponta legfeljebb egyszer. <Link to="?nezet=simplepay">Régi SimplePay-tranzakciók</Link></>
          )
        }
      />
      <div className="tartalom">
        <div className="sor-flex ter" style={{ marginBottom: 16 }}>
          <div className="szegmens">
            {SZURO.map(([k, f]) => (
              <button key={k} className={szuro === k ? 'on' : ''} aria-pressed={szuro === k} onClick={() => setSp({ szuro: k }, { replace: true })}>
                {f}
              </button>
            ))}
            <button className={atutalas ? 'on' : ''} aria-pressed={atutalas} onClick={() => setSp({ szuro: ATUTALAS }, { replace: true })}>
              Átutalás
            </button>
          </div>
          {!atutalas && (
          <div className="sor-flex">
            <label className="halvany kicsi">Ettől</label>
            <input className="doboz" type="date" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <label className="halvany kicsi">eddig</label>
            <input className="doboz" type="date" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          )}
        </div>
        {atutalas ? (
          <div className="lap">
            <LepcsoProvider>
              <AtutalasSzakasz />
            </LepcsoProvider>
          </div>
        ) : null}
        {!atutalas && q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {!atutalas && (
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim={szuro === 'problema' ? 'Nincs fizetési gond' : 'Nincs ilyen fizetés ebben az időszakban'} />
          ) : (
            <div className="tabla-gorgo">
              <table className="tabla tomor">
                <thead>
                  <tr>
                    <th className="elso">Mikor</th>
                    <th>Ügyfél</th>
                    <th>Mi</th>
                    <th className="jobb">Összeg</th>
                    <th>Eredmény</th>
                    <th>Kártya</th>
                    <th className="utolso" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={HIBAS.includes(r.status) ? 'lejart' : undefined}>
                      <td className="elso nt">{idopont(r.succeededAt ?? r.createdAt, t)}</td>
                      <td className="felkover">{r.client.name}</td>
                      <td>
                        {PAYMENT_KIND_LABELS[r.kind] ?? r.kind}
                        <span className={`cimke ${r.mode === 'live' ? 'info' : 'demo'}`} style={{ marginLeft: 6 }}>
                          {szolgaltatoCimke(r.provider, r.mode)}
                        </span>
                        <div className="al">{r.initiated === 'utemezo' ? 'havi levonás (mi indítottuk)' : r.initiated === 'admin' ? 'admin indította' : 'az ügyfél fizette'}</div>
                      </td>
                      <td className="jobb">
                        <Ft n={r.amountHuf} />
                        {r.refundedHuf ? (
                          <div className="al">
                            visszautalva: <Ft n={r.refundedHuf} />
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {HIBAS.includes(r.status) ? <span className="cimke hiba">{PAYMENT_STATUS_LABELS_K29[r.status]}</span> : <span className="szo felkover">{PAYMENT_STATUS_LABELS_K29[r.status] ?? r.status}</span>}
                        {r.disputeStatus ? (
                          <span className="cimke hiba" style={{ marginLeft: 6 }}>
                            {DISPUTE_TEXTS.chip}
                          </span>
                        ) : null}
                        {r.failureCode || r.declineCode ? (
                          <div className="al" title={fizetesiHiba(r.declineCode ?? r.failureCode).teendo || undefined}>
                            {stripeHiba(r.declineCode) ?? stripeHiba(r.failureCode) ?? fizetesiHiba(r.declineCode ?? r.failureCode).mi}
                          </div>
                        ) : null}
                        {r.invoice ? (
                          <div className="al">
                            számla: {r.invoice.number ?? 'készül'}
                            {r.invoice.status === 'hiba' ? <Link to="/admin/dijszamlak?status=hiba"> · hibás</Link> : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="nt">
                        {r.cardLabel ?? <span className="halvany">–</span>}
                        {r.stripeUrl ? (
                          <div className="al">
                            <a href={r.stripeUrl} target="_blank" rel="noreferrer noopener">
                              Stripe
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td className="utolso jobb nt">
                        {r.status === 'sikeres' && r.refundableHuf > 0 ? (
                          <button className="gomb-m kicsi" onClick={() => setVissza(r)}>
                            Visszatérítés
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
        )}
      </div>
      <Visszaterites r={vissza} bezar={() => setVissza(null)} />
    </>
  );
}
