// SPEC §32.B – "Folyószámla" tab: the NAV folyószámla checks recorded by hand (NAV M2M later). The balance per adónem
// (+ tartozás / − túlfizetés; 224 bírság and 226 mulasztási bírság too), what the app expects, the difference, the status
// (suggested, changeable), and the payments seen on the extract – NEVER ticked by default: each with the day and amount of
// the statement row; "rendben" only with the item's exact amount (critique 2.4). "Szólok az ügyfélnek" makes a request.
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { FOLYOSZAMLA_TEXTS as F, NAV_ADONEMEK, RECON_FOLLOW_UPS, RECON_STATUSES, type ReconExpectedView, type ReconFollowUp, type ReconSeenRow, type ReconStatus } from '../../../_shared/eves';
import { folyoszamlaElteres, folyoszamlaJavaslat, lattamRendbenLehet } from '../../../lib/eves';
import { datum, ft } from '../../../lib/format';
import { today } from '../../../lib/today';
import { HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';

const szamE = (s: string): number | null => {
  const t = s.replace(/[\s.]/g, '').replace('−', '-');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
};

export default function Folyoszamla({ c }: FulProps) {
  const qc = useQueryClient();
  const pir = usePirito();
  const list = useQuery({ queryKey: ['acc', 'recon', c.id], queryFn: () => ep.accReconciliations(c.id) });
  const [uj, setUj] = useState(false);
  const resolve = useMutation({
    mutationFn: (id: string) => ep.accReconResolve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['acc', 'recon', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
      pir.ok('Rendezettnek jelölted.');
    },
    onError: pir.hiba,
  });
  if (list.isPending) return <Toltes />;
  if (list.isError) return <HibaSav hiba={list.error} ujra={() => list.refetch()} />;
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="sor-flex ter">
        <h2 style={{ margin: 0 }}>{F.cim}</h2>
        {!uj && (
          <button className="gomb-e kicsi" onClick={() => setUj(true)}>
            {F.uj}
          </button>
        )}
      </div>
      {uj && <Urlap c={c} bezar={() => setUj(false)} />}
      <div className="lap">
        <table className="tabla">
          <thead>
            <tr>
              <th>{F.asOf}</th>
              <th>Állapot</th>
              <th className="jobb">Tartozás</th>
              <th className="jobb">Túlfizetés</th>
              <th>{F.kovetkezo}</th>
              <th>Rögzítette</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="halvany">
                  Még nincs egyeztetés.
                </td>
              </tr>
            )}
            {list.data.items.map((r) => (
              <tr key={r.id}>
                <td>
                  {datum(r.asOf, { ev: true })}
                  {r.kind === 'nyito' ? <div className="halvany kicsi">nyitó egyenleg</div> : null}
                </td>
                <td>
                  <span className={`cimke ${r.status === 'rendben' ? '' : r.status === 'tulfizetes' ? 'info' : 'figyel'}`}>{F.allapot[r.status]}</span>
                  {r.followUp !== 'nincs' && <div className="halvany kicsi">{F.teendo[r.followUp]}</div>}
                  {r.verifiedItems > 0 && <div className="halvany kicsi">{r.verifiedItems} tétel rendben a kivonat alapján</div>}
                </td>
                <td className="jobb szam">{ft(r.totalDebtHuf)}</td>
                <td className="jobb szam">{ft(r.totalOverpaymentHuf)}</td>
                <td>{r.nextCheckOn ? datum(r.nextCheckOn, { ev: true }) : '–'}</td>
                <td className="halvany kicsi">{r.checkedBy?.firstName ?? ''}</td>
                <td>
                  {(r.status === 'hatralek' || r.status === 'elteres') && !r.resolvedAt ? (
                    <button className="gomb-sz" disabled={resolve.isPending} onClick={() => resolve.mutate(r.id)}>
                      {F.rendezve}
                    </button>
                  ) : r.resolvedAt ? (
                    <span className="halvany kicsi">rendezve</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Sor = { adonem: string; label: string; balance: string; pending: string };

function Urlap({ c, bezar }: FulProps & { bezar: () => void }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const [asOf, setAsOf] = useState(today());
  const exp = useQuery({ queryKey: ['acc', 'recon-exp', c.id, asOf], queryFn: () => ep.accReconExpected(c.id, asOf) });
  return exp.isPending ? <Toltes /> : exp.isError ? <HibaSav hiba={exp.error} ujra={() => exp.refetch()} /> : <UrlapTartalom key={asOf} c={c} asOf={asOf} setAsOf={setAsOf} exp={exp.data} bezar={bezar} qcFrissit={() => void qc.invalidateQueries({ queryKey: ['acc', 'recon', c.id] })} pir={pir} />;
}

function UrlapTartalom({ c, asOf, setAsOf, exp, bezar, qcFrissit, pir }: FulProps & { asOf: string; setAsOf: (s: string) => void; exp: ReconExpectedView; bezar: () => void; qcFrissit: () => void; pir: ReturnType<typeof usePirito> }) {
  const qc = useQueryClient();
  const [sorok, setSorok] = useState<Sor[]>(exp.adonemek.map((a) => ({ adonem: a.adonem, label: a.label, balance: '', pending: '' })));
  const [lattam, setLattam] = useState<Record<string, { paidOn: string; amount: string; elteres: boolean; note: string }>>({});
  const [allapot, setAllapot] = useState<ReconStatus | null>(null);
  const [teendo, setTeendo] = useState<ReconFollowUp>('nincs');
  const [megj, setMegj] = useState('');
  const [kov, setKov] = useState(exp.suggestedNextCheckOn);
  const [szolok, setSzolok] = useState(false);
  const [uzenet, setUzenet] = useState('');
  const [nyito, setNyito] = useState(false);
  const [fajl, setFajl] = useState<File | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const expBy = new Map(exp.adonemek.map((a) => [a.adonem, a]));
  const kitoltott = sorok.filter((s) => s.balance.trim() !== '');
  const nezet = kitoltott.map((s) => {
    const e = expBy.get(s.adonem);
    const b = szamE(s.balance) ?? 0;
    const p = szamE(s.pending) ?? 0;
    return { ...s, balanceHuf: b, pendingHuf: p, unmarked: e?.expectedUnmarkedHuf ?? 0, marked: e?.expectedMarkedHuf ?? 0, diffHuf: folyoszamlaElteres(b, p, e?.expectedUnmarkedHuf ?? 0) };
  });
  const javaslat = folyoszamlaJavaslat(nezet);
  const seen: ReconSeenRow[] = Object.entries(lattam).map(([itemId, l]) => ({ itemId, paidOn: l.paidOn, amountHuf: szamE(l.amount) ?? 0, verification: l.elteres ? 'elteres' : 'rendben', note: l.note.trim() || null }));
  const hibasSor = seen.find((s) => s.verification === 'rendben' && !lattamRendbenLehet(exp.openItems.find((i) => i.itemId === s.itemId)?.amountHuf ?? -1, s.amountHuf));
  const m = useMutation({
    mutationFn: () =>
      ep.accReconSave(
        c.id,
        {
          kind: nyito ? 'nyito' : 'rendes',
          asOf,
          balances: kitoltott.map((s) => ({ adonem: s.adonem, label: s.label, balanceHuf: szamE(s.balance) ?? 0, pendingHuf: szamE(s.pending) })),
          status: allapot ?? javaslat,
          seen,
          followUp: teendo,
          note: megj.trim() || null,
          nextCheckOn: kov || null,
          notifyClient: szolok && uzenet.trim() ? { message: uzenet.trim() } : null,
        },
        fajl,
      ),
    onSuccess: () => {
      qcFrissit();
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'kata', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
      pir.ok('Elmentetted az egyeztetést.');
      bezar();
    },
    onError: pir.hiba,
  });
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="szamlaszam" s={28} />
          <h2>{F.uj}</h2>
        </div>
        <div className="sor-flex" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">{F.asOf}</span>
            <input className="doboz" type="date" style={{ width: 170 }} value={asOf} max={today()} onChange={(e) => setAsOf(e.target.value)} />
          </label>
          <label className="jelolo" style={{ alignSelf: 'flex-end' }}>
            <input type="checkbox" checked={nyito} onChange={(e) => setNyito(e.target.checked)} />
            <span>{F.nyito}</span>
          </label>
        </div>
        <table className="tabla" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Adónem</th>
              <th>{F.egyenleg}</th>
              <th>{F.fuggo}</th>
              <th className="jobb">{F.varhatoJeloletlen}</th>
              <th className="jobb">{F.varhatoJelolt}</th>
              <th className="jobb">{F.elteres}</th>
            </tr>
          </thead>
          <tbody>
            {sorok.map((s, i) => {
              const e = expBy.get(s.adonem);
              const v = nezet.find((x) => x.adonem === s.adonem && x.label === s.label);
              return (
                <tr key={`${s.adonem}-${i}`}>
                  <td>
                    {s.adonem === 'egyeb' ? (
                      <input className="doboz" style={{ width: 160 }} placeholder="kód és név" value={s.label} onChange={(ev) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, label: ev.target.value } : y)))} />
                    ) : (
                      `${s.adonem} ${(NAV_ADONEMEK as Record<string, string>)[s.adonem] ?? s.label}`
                    )}
                  </td>
                  <td>
                    <input className="doboz szam" style={{ width: 140 }} inputMode="numeric" value={s.balance} onChange={(ev) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, balance: ev.target.value } : y)))} />
                  </td>
                  <td>
                    <input className="doboz szam" style={{ width: 120 }} inputMode="numeric" value={s.pending} onChange={(ev) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, pending: ev.target.value } : y)))} />
                  </td>
                  <td className="jobb szam">{ft(e?.expectedUnmarkedHuf ?? 0)}</td>
                  <td className="jobb szam">{ft(e?.expectedMarkedHuf ?? 0)}</td>
                  <td className="jobb szam">{v ? ft(v.diffHuf) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="gomb-sz" style={{ marginTop: 6 }} onClick={() => setSorok((x) => [...x, { adonem: 'egyeb', label: '', balance: '', pending: '' }])}>
          + {F.egyebAdonem}
        </button>

        <div className="eves-lepes" style={{ marginTop: 14 }}>
          <span className="felirat">{F.lattam}</span>
          <div className="halvany kicsi" style={{ marginBottom: 6 }}>{F.lattamSugo}</div>
          {exp.openItems.length === 0 && <span className="halvany kicsi">Nincs nyitott tétel a lekérdezés napjáig.</span>}
          {exp.openItems.map((it) => {
            const l = lattam[it.itemId];
            return (
              <div key={it.itemId} className="oszlop" style={{ gap: 4, marginBottom: 8 }}>
                <label className="jelolo">
                  <input
                    type="checkbox"
                    checked={Boolean(l)}
                    onChange={(e) =>
                      setLattam((x) => {
                        const n = { ...x };
                        if (e.target.checked) n[it.itemId] = { paidOn: '', amount: '', elteres: false, note: '' };
                        else delete n[it.itemId];
                        return n;
                      })
                    }
                  />
                  <span>
                    {it.periodLabel.startsWith(it.label) ? it.periodLabel : `${it.periodLabel} · ${it.label}`} · {ft(it.amountHuf)} · határidő {datum(it.dueDate)}
                    {it.markedPaidOn ? ` · az ügyfél jelölte: ${datum(it.markedPaidOn)}` : ''}
                  </span>
                </label>
                {l && (
                  <div className="sor-flex" style={{ gap: 8, paddingLeft: 28, flexWrap: 'wrap' }}>
                    <input className="doboz" type="date" style={{ width: 170 }} aria-label="A befizetés napja a kivonaton" value={l.paidOn} max={asOf} onChange={(e) => setLattam((x) => ({ ...x, [it.itemId]: { ...l, paidOn: e.target.value } }))} />
                    <input className="doboz szam" style={{ width: 140 }} placeholder="Összeg a kivonaton" value={l.amount} onChange={(e) => setLattam((x) => ({ ...x, [it.itemId]: { ...l, amount: e.target.value } }))} />
                    <label className="jelolo">
                      <input type="checkbox" checked={l.elteres} onChange={(e) => setLattam((x) => ({ ...x, [it.itemId]: { ...l, elteres: e.target.checked } }))} />
                      <span>Eltérés</span>
                    </label>
                    {l.elteres && <input className="doboz" style={{ flex: 1, minWidth: 180 }} placeholder="Mit látsz a kivonaton?" value={l.note} onChange={(e) => setLattam((x) => ({ ...x, [it.itemId]: { ...l, note: e.target.value } }))} />}
                    {!l.elteres && l.amount && !lattamRendbenLehet(it.amountHuf, szamE(l.amount)) && <span className="kicsi" style={{ color: 'var(--veszely)' }}>{F.osszegElter.replace('{tetel}', ft(it.amountHuf).replace(/\s?Ft$/, ''))}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">Állapot (javaslat: {F.allapot[javaslat]})</span>
            <select className="doboz" value={allapot ?? javaslat} onChange={(e) => setAllapot(e.target.value as ReconStatus)}>
              {RECON_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {F.allapot[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">Teendő</span>
            <select className="doboz" value={teendo} onChange={(e) => setTeendo(e.target.value as ReconFollowUp)}>
              {RECON_FOLLOW_UPS.map((s) => (
                <option key={s} value={s}>
                  {F.teendo[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">{F.kovetkezo}</span>
            <input className="doboz" type="date" value={kov} onChange={(e) => setKov(e.target.value)} />
          </label>
        </div>
        <label className="oszlop" style={{ gap: 4, marginTop: 10 }}>
          <span className="felirat">Megjegyzés</span>
          <input className="doboz" value={megj} onChange={(e) => setMegj(e.target.value)} />
        </label>
        <div className="sor-flex" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input ref={ref} type="file" accept="application/pdf,image/*" className="rejtett" onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
          <button className="gomb-m kicsi" onClick={() => ref.current?.click()}>
            <I3 n="feltoltes" s={22} />
            {fajl ? fajl.name.slice(0, 24) : F.kivonat}
          </button>
          <label className="jelolo">
            <input type="checkbox" checked={szolok} onChange={(e) => setSzolok(e.target.checked)} />
            <span>{F.szolok}</span>
          </label>
        </div>
        {szolok && <textarea className="doboz" style={{ marginTop: 8 }} placeholder="Az ügyfél kérésként kapja meg az appban." value={uzenet} onChange={(e) => setUzenet(e.target.value)} maxLength={1000} />}
        <div className="sor-flex" style={{ gap: 8, marginTop: 12 }}>
          <button className="gomb-e kicsi" disabled={!kitoltott.length || Boolean(hibasSor) || seen.some((s) => !s.paidOn) || m.isPending} onClick={() => m.mutate()}>
            Mentés
          </button>
          <button className="gomb-sz" onClick={bezar}>
            Mégsem
          </button>
        </div>
      </div>
    </div>
  );
}
