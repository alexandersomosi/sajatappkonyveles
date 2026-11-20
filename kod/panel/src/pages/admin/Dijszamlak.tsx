// SPEC §29.1.14 / §29.2.3 – Díjszámlák: every fee invoice (Számlázz.hu e-számla, or the DEMO díjbekérő), its status
// (kiállítva / készül / hiba / sztornózva), number, account (teszt / éles / DEMO), the error code + message, the attempts,
// "Újrapróbálom" (the server always queries Számlázz.hu first – a retry never makes a second invoice) and the PDF.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INVOICE_STATUS_LABELS_K29, type AdminFeeInvoiceRow } from '../../_shared/k29';
import { k29Dijszamlak, szamlaUjra } from '../../api/k29';
import { downloadVia } from '../../api/client';
import { Fejlec, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { useMegerosites } from '../../ui/Megerosites';
import { usePirito } from '../../ui/Pirito';
import { datumRovid, idopont } from '../../lib/format';
import { today } from '../../lib/today';

const SZURO: [string, string][] = [
  ['hiba', 'Hibás'],
  ['folyamatban', 'Készül'],
  ['kiallitva', 'Kiállítva'],
  ['sztorno', 'Sztornózva'],
  ['mind', 'Mind'],
];
const FAJTA: Record<AdminFeeInvoiceRow['kind'], string> = { szamla: 'Számla', sztorno: 'Sztornó', helyesbito: 'Helyesbítő' };
const FIOK: Record<string, string> = { teszt: 'Számlázz.hu teszt', eles: 'Számlázz.hu éles', demo: 'DEMO díjbekérő' };

function Allapot({ r }: { r: AdminFeeInvoiceRow }) {
  const cimke = INVOICE_STATUS_LABELS_K29[r.status] ?? r.status;
  if (r.status === 'hiba') return <span className="cimke hiba">{cimke}</span>;
  if (r.status === 'folyamatban') return <span className="cimke figyel">{cimke}</span>;
  if (r.status === 'sztorno') return <span className="cimke info">{cimke}</span>;
  return <span className="szo felkover">{cimke}</span>;
}

export default function Dijszamlak() {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? 'mind';
  const qc = useQueryClient();
  const pir = usePirito();
  const meg = useMegerosites();
  const [dolgozo, setDolgozo] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin', 'k29', 'fee-invoices', status], queryFn: () => k29Dijszamlak({ status: status === 'mind' ? undefined : status }) });
  const hibasDb = useQuery({ queryKey: ['admin', 'k29', 'fee-invoices', 'hiba'], queryFn: () => k29Dijszamlak({ status: 'hiba' }) });
  const ujra = useMutation({
    mutationFn: (id: string) => meg.futtat(() => szamlaUjra(id)),
    onMutate: (id) => setDolgozo(id),
    onSettled: () => setDolgozo(null),
    onSuccess: () => {
      pir.ok('Újrapróbáltuk. Előbb a Számlázz.hu-ban kerestük: ha már elkészült, azt mentettük el.');
      void qc.invalidateQueries({ queryKey: ['admin', 'k29', 'fee-invoices'] });
    },
    onError: pir.hiba,
  });
  const rows = q.data ?? [];
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Díjszámlák"
        mellek={<>Minden sikeres fizetés után egy e-számla a Számlázz.hu-ban, a fizetés azonosítójával: egy fizetéshez soha nem készül két számla.{hibasDb.data?.length ? <> · <b>{hibasDb.data.length} hibás</b></> : null}</>}
      />
      <div className="tartalom">
        <div className="szegmens" style={{ marginBottom: 16 }}>
          {SZURO.map(([k, f]) => (
            <button key={k} className={status === k ? 'on' : ''} onClick={() => setSp({ status: k }, { replace: true })}>
              {f}
              {k === 'hiba' && hibasDb.data?.length ? <span className="db">{hibasDb.data.length}</span> : null}
            </button>
          ))}
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim={status === 'hiba' ? 'Nincs hibás díjszámla' : 'Nincs ilyen díjszámla'} />
          ) : (
            <div className="tabla-gorgo">
              <table className="tabla tomor">
                <thead>
                  <tr>
                    <th className="elso">Ügyfél</th>
                    <th>Számla</th>
                    <th className="jobb">Összeg</th>
                    <th>Állapot</th>
                    <th className="tor">Hiba, próbálkozás</th>
                    <th className="utolso" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === 'hiba' ? 'lejart' : undefined}>
                      <td className="elso">
                        <div className="felkover">{r.client.name}</div>
                        <div className="al">{FIOK[r.account] ?? r.account}</div>
                      </td>
                      <td>
                        <div className="szam">{r.number ?? '–'}</div>
                        <div className="al">
                          {FAJTA[r.kind]}
                          {r.issuedOn ? ` · ${datumRovid(r.issuedOn)}` : ''}
                          {r.externalKey ? <span className="halvany szam"> · {r.externalKey}</span> : null}
                        </div>
                      </td>
                      <td className="jobb">
                        <Ft n={r.amountHuf} />
                      </td>
                      <td>
                        <Allapot r={r} />
                        {r.status === 'folyamatban' && r.nextRetryAt ? <div className="al">újra: {idopont(r.nextRetryAt, t)}</div> : null}
                      </td>
                      <td>
                        {r.error || r.errorCode ? (
                          <>
                            <div>{r.error ?? '–'}</div>
                            <div className="al szam">
                              {r.errorCode ? `kód ${r.errorCode} · ` : ''}
                              {r.attempts} próbálkozás
                            </div>
                          </>
                        ) : (
                          <span className="halvany">{r.attempts ? `${r.attempts} próbálkozás` : '–'}</span>
                        )}
                      </td>
                      <td className="utolso jobb nt">
                        {r.status === 'hiba' || r.status === 'folyamatban' ? (
                          <button className="gomb-m kicsi" disabled={dolgozo === r.id} onClick={() => ujra.mutate(r.id)}>
                            Újrapróbálom
                          </button>
                        ) : null}
                        {r.fileId ? (
                          <button className="gomb-m kicsi csak-szoveg" style={{ marginLeft: 8 }} onClick={() => void downloadVia(`/files/${encodeURIComponent(r.fileId!)}`, `${r.number ?? 'dijszamla'}.pdf`).catch(pir.hiba)}>
                            PDF
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
      {meg.lap}
    </>
  );
}
