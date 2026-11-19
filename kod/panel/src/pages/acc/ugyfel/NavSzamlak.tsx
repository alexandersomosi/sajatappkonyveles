// Kiállított számlák (SPEC §27.5): the client's issued invoices downloaded from NAV Online Számla (read-only), received-date edits via revenue items (FUNKCIOK 12, 33).
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { Fiok, Ft, HibaSav, Toltes, Ures, DemoCimke } from '../../../ui/kozos';
import { DokAllapot } from '../../../ui/domain';
import { usePirito } from '../../../ui/Pirito';
import { useKonyveloNev } from '../../../auth/Auth';
import { datum, datumRovid, HONAPOK, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { felreteszErtek, felreteszTipp } from '../../../lib/k28';
import { RESERVE_PANEL_TEXTS } from '../../../_shared/bekotes';
import type { InvoiceReserveView } from '../../../api/types';

const FIZ: Record<string, string> = { TRANSFER: 'átutalás', CASH: 'készpénz', CARD: 'bankkártya', VOUCHER: 'utalvány', OTHER: 'egyéb' };

export default function NavSzamlak({ c }: FulProps) {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const ev = Number(sp.get('ev') ?? t.slice(0, 4));
  const honap = sp.get('honap') ?? '';
  const nev = useKonyveloNev();
  const q = useQuery({ queryKey: ['acc', 'navinv', c.id, ev], queryFn: () => ep.accNavInvoices(c.id, ev), enabled: c.nav.status !== 'nincs' });
  const [nyitott, setNyitott] = useState<string | null>(null);
  const items = useMemo(() => (q.data?.items ?? []).filter((i) => !honap || i.issueDate.startsWith(honap)), [q.data, honap]);
  // SPEC §28.1.9: the "Félretenni" column – from the row (NavInvoiceListItem.reserve) or the client's reserve view.
  const kata = c.taxRegime === 'kata';
  const rv = useQuery({ queryKey: ['acc', 'reserve', c.id, ev], queryFn: () => ep.accReserve(c.id, ev), enabled: c.nav.status !== 'nincs' && !kata && c.lifecycle !== 'bekotes_alatt' });
  const felre = useMemo(() => {
    const m = new Map<string, InvoiceReserveView>();
    for (const h of rv.data?.months ?? []) for (const i of h.items) if (i.navInvoiceId) m.set(i.navInvoiceId, i.reserve);
    return m;
  }, [rv.data]);
  if (c.nav.status === 'nincs')
    return (
      <div className="lap">
        <Ures n="ures_mappa" cim="Még nincs NAV-kapcsolat" gombok={<Link className="gomb-m csak-szoveg" to={`/ugyfelek/${c.id}/bekotes`}>NAV-kapcsolat beállítása</Link>}>
          Ha megadod a technikai felhasználót, a kiállított számlái naponta, maguktól töltődnek le a NAV Online Számlából.
        </Ures>
      </div>
    );
  const ossz = items.reduce((a, i) => a + i.grossAmountHuf, 0);
  const becsult = items.filter((i) => i.receivedOnEstimated).length;
  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14 }}>
        <div className="szegmens">
          <button className={!honap ? 'on' : ''} onClick={() => setSp({ ev: String(ev) }, { replace: true })}>
            Egész év
          </button>
          {Array.from({ length: ev === Number(t.slice(0, 4)) ? Number(t.slice(5, 7)) : 12 }, (_, i) => `${ev}-${String(i + 1).padStart(2, '0')}`).map((m) => (
            <button key={m} className={honap === m ? 'on' : ''} onClick={() => setSp({ ev: String(ev), honap: m }, { replace: true })}>
              {HONAPOK[Number(m.slice(5)) - 1]!.slice(0, 3)}
            </button>
          ))}
        </div>
        <span className="halvany">
          {items.some((i) => i.demo) && (
            <>
              <DemoCimke /> a demó NAV-ból ·{' '}
            </>
          )}
          {items.length} számla · <Ft n={ossz} />
          {becsult > 0 && ` · ${becsult} becsült befizetési dátummal`}
        </span>
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      <div className="lap">
        {q.isPending ? (
          <Toltes />
        ) : items.length === 0 ? (
          <Ures n="ures_mappa" cim="Ebben az időszakban nincs kiállított számla" />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso">Számlaszám</th>
                <th>Kelte</th>
                <th>Teljesítés</th>
                <th>Vevő</th>
                <th>Fizetés</th>
                <th>Bevétel napja</th>
                <th className="jobb">Összeg</th>
                {kata ? <th>Vevő (kata)</th> : <th className="jobb">{RESERVE_PANEL_TEXTS.column}</th>}
                <th className="utolso">Állapot</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="kattinthato" onClick={() => setNyitott(i.id)}>
                  <td className="elso">
                    <span className="felkover">{i.invoiceNumber}</span>
                    {i.operation !== 'CREATE' && <span className="cimke" style={{ marginLeft: 6 }}>{i.operation === 'STORNO' ? 'sztornó' : 'módosító'}</span>}
                  </td>
                  <td className="nt">{datumRovid(i.issueDate)}</td>
                  <td className="nt">{datumRovid(i.deliveryDate)}</td>
                  <td>{i.customerName ?? '–'}</td>
                  <td>{i.paymentMethod ? FIZ[i.paymentMethod] ?? i.paymentMethod : '–'}</td>
                  <td className="nt">
                    {datumRovid(i.receivedOn)}
                    {i.receivedOnEstimated && <span className="cimke figyel" style={{ marginLeft: 6 }}>becsült</span>}
                  </td>
                  <td className="jobb">
                    <Ft n={i.grossAmountHuf} />
                  </td>
                  {kata ? (
                    <td className="kicsi">
                      {i.payerKind === 'kifizeto' || i.payerKind === 'kulfoldi_kifizeto' ? (
                        <span className="cimke hiba">cég – a katát megszünteti</span>
                      ) : i.payerKind === 'ismeretlen' ? (
                        <span className="cimke figyel">ellenőrizd</span>
                      ) : (
                        <span className="halvany">magánszemély</span>
                      )}
                    </td>
                  ) : (
                    (() => {
                      const r = i.reserve ?? felre.get(i.id);
                      return (
                        <td className="jobb nt" title={r ? felreteszTipp(r) : undefined}>
                          <span className="szam">{felreteszErtek(r)}</span>
                        </td>
                      );
                    })()
                  )}
                  <td className="utolso">
                    <DokAllapot s={i.status} firstName={nev} nav />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
        Átutalásos számlánál a bevétel napja a fizetési határidő (becsült), amíg a kivonat alapján át nem írod. Az átalányadózásban a befizetés napja számít, az ÁFA-keretben a teljesítésé.
      </p>
      <SzamlaFiok id={nyitott} bezar={() => setNyitott(null)} clientId={c.id} />
    </>
  );
}

function SzamlaFiok({ id, bezar, clientId }: { id: string | null; bezar: () => void; clientId: string }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['acc', 'navinvoice', id], queryFn: () => ep.accNavInvoice(id!), enabled: !!id });
  const [nap, setNap] = useState('');
  useEffect(() => setNap(q.data?.receivedOn ?? ''), [q.data]);
  const ment = useMutation({
    mutationFn: () => ep.accPatchRevenue(q.data!.revenueItemId!, { receivedOn: nap, receivedOnEstimated: false }),
    onSuccess: () => {
      pir.ok('A bevétel napját átírtuk. A becslést újraszámoltuk.');
      void qc.invalidateQueries({ queryKey: ['acc', 'navinv', clientId] });
      void qc.invalidateQueries({ queryKey: ['acc', 'navinvoice', id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'revenue', clientId] });
    },
    onError: pir.hiba,
  });
  const d = q.data;
  return (
    <Fiok
      nyitva={!!id}
      bezar={bezar}
      ikon="szamlak"
      cim={d ? `Számla ${d.invoiceNumber}` : 'Számla'}
      bev={d ? `${d.customerName ?? 'Vevő nélkül'} · ${datum(d.issueDate, { ev: true })}` : undefined}
      lab={
        d?.revenueItemId ? (
          <button className="gomb-e" disabled={!nap || nap === d.receivedOn || ment.isPending} onClick={() => ment.mutate()}>
            Bevétel napjának mentése
          </button>
        ) : undefined
      }
    >
      {q.isPending && <Toltes />}
      {q.isError && <HibaSav hiba={q.error} />}
      {d && (
        <>
          {d.demo && <div className="uzenet-sav figyel" style={{ marginBottom: 14 }}>DEMO számla a demó NAV-ból. Valódi számla nem tartozik hozzá.</div>}
          <dl className="adatok">
            <dt>Számlaszám</dt>
            <dd>{d.invoiceNumber}</dd>
            <dt>Vevő</dt>
            <dd>
              {d.customerName ?? '–'} {d.customerTaxNumber && <span className="halvany">({d.customerTaxNumber})</span>}
            </dd>
            <dt>Kelte / teljesítés</dt>
            <dd>
              {datumRovid(d.issueDate)} / {datumRovid(d.deliveryDate)}
            </dd>
            <dt>Fizetés</dt>
            <dd>
              {d.paymentMethod ? FIZ[d.paymentMethod] ?? d.paymentMethod : '–'}
              {d.paymentDate && `, határidő ${datumRovid(d.paymentDate)}`}
            </dd>
            <dt>ÁFA</dt>
            <dd>{d.vatExemption ? `${d.vatExemption.reason} (${d.vatExemption.case})` : <Ft n={d.vatHuf} />}</dd>
            <dt>Összesen</dt>
            <dd className="felkover">
              <Ft n={d.grossAmountHuf} />
            </dd>
          </dl>
          <table className="tabla" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Tétel</th>
                <th className="jobb">Menny.</th>
                <th className="jobb">Egységár</th>
                <th className="jobb">Nettó</th>
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.lineNo}>
                  <td>{l.description}</td>
                  <td className="jobb szam">
                    {szam(l.quantity)} {l.unit}
                  </td>
                  <td className="jobb">
                    <Ft n={l.unitPriceHuf} />
                  </td>
                  <td className="jobb">
                    <Ft n={l.netAmountHuf} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.revenueItemId && (
            <label className="mezo" style={{ marginTop: 18, maxWidth: 260 }}>
              <span className="felirat">Bevétel napja (pénzforgalmi)</span>
              <input className="doboz" type="date" value={nap} onChange={(e) => setNap(e.target.value)} />
              <span className="sugo">{d.receivedOnEstimated ? 'Most becsült. Írd át a kivonat szerinti napra.' : 'A kivonat alapján megerősítve.'}</span>
            </label>
          )}
        </>
      )}
    </Fiok>
  );
}
