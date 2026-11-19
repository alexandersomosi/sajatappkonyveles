// Bevételek: revenue records (NAV + manual), monthly sums, add manual item, exclude/restore, CSV (FUNKCIOK 9, 22, 27).
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { RevenueItem } from '../../../api/types';
import { Fiok, Ft, HibaSav, Oszlopok, Toltes, Ures, EvValaszto } from '../../../ui/kozos';
import { usePirito } from '../../../ui/Pirito';
import { datumRovid, HONAPOK_ROVID, parseFt } from '../../../lib/format';
import { today } from '../../../lib/today';
import { MegjegyzesFiok } from './Bekotes';

export default function Bevetelek({ c }: FulProps) {
  const t = today();
  const [ev, setEv] = useState(Number(t.slice(0, 4)));
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['acc', 'revenue', c.id, ev], queryFn: () => ep.accRevenue(c.id, ev) });
  const [uj, setUj] = useState(false);
  const [kizar, setKizar] = useState<RevenueItem | null>(null);
  const [szuro, setSzuro] = useState<'mind' | 'nav_szamla' | 'kezi'>('mind');
  const inv = () => {
    void qc.invalidateQueries({ queryKey: ['acc', 'revenue', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
  };
  const patch = useMutation({
    mutationFn: (x: { id: string; body: Parameters<typeof ep.accPatchRevenue>[1] }) => ep.accPatchRevenue(x.id, x.body),
    onSuccess: () => {
      pir.ok('Elmentve, a becslést újraszámoltuk.');
      setKizar(null);
      inv();
    },
    onError: pir.hiba,
  });
  const del = useMutation({ mutationFn: (id: string) => ep.accDeleteRevenue(id), onSuccess: () => { pir.ok('Törölve.'); inv(); }, onError: pir.hiba });
  const d = q.data;
  const items = (d?.items ?? []).filter((i) => szuro === 'mind' || i.source === szuro).slice().sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));
  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14 }}>
        <div className="sor-flex">
          <EvValaszto ev={ev} evek={[Number(t.slice(0, 4)), Number(t.slice(0, 4)) - 1]} valt={setEv} />
          <div className="szegmens">
            {(['mind', 'nav_szamla', 'kezi'] as const).map((s) => (
              <button key={s} className={szuro === s ? 'on' : ''} onClick={() => setSzuro(s)}>
                {s === 'mind' ? 'Mind' : s === 'nav_szamla' ? 'Kiállított számlák' : 'Kézi tételek'}
              </button>
            ))}
          </div>
        </div>
        <div className="gombsor">
          <button className="gomb-m csak-szoveg" onClick={() => void ep.accExportCsv(ev, [c.id]).catch(pir.hiba)}>
            CSV letöltése
          </button>
          <button className="gomb-e" onClick={() => setUj(true)}>
            Kézi tétel hozzáadása
          </button>
        </div>
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {q.isPending ? (
        <Toltes />
      ) : (
        d && (
          <>
            <div className="lap">
              <div className="lap-fej">
                <h2>Bevétel havonta, {ev}</h2>
                <span className="megj">a befizetés (pénzforgalom) hónapja szerint</span>
                <div className="jobbra felkover">
                  Összesen <Ft n={d.totalHuf} />
                </div>
              </div>
              <Oszlopok
                adatok={d.byMonth.map((m) => ({
                  kulcs: String(m.month),
                  felirat: HONAPOK_ROVID[m.month - 1]!,
                  ertek: m.amountHuf,
                  becsult: m.estimated,
                }))}
              />
              {d.byMonth.some((m) => m.estimated) && <p className="halvany kicsi" style={{ padding: '0 22px 14px' }}>Csíkozott: van benne becsült befizetési dátumú tétel.</p>}
            </div>
            <div className="lap" style={{ marginTop: 16 }}>
              {items.length === 0 ? (
                <Ures n="ures_mappa" cim="Nincs bevételi tétel" />
              ) : (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="elso">Megnevezés</th>
                      <th>Forrás</th>
                      <th>Bevétel napja</th>
                      <th>Teljesítés</th>
                      <th className="jobb">Összeg</th>
                      <th>Beszámít</th>
                      <th className="utolso" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id} style={!r.countsForAtalany ? { opacity: 0.6 } : undefined}>
                        <td className="elso">
                          <div style={{ fontWeight: 550 }}>{r.description}</div>
                          {r.excludedReason && <div className="al">Kizárva: {r.excludedReason}</div>}
                        </td>
                        <td className="nt">{r.source === 'nav_szamla' ? 'Kiállított számla' : 'Kézi'}</td>
                        <td className="nt">
                          {datumRovid(r.receivedOn)}
                          {r.receivedOnEstimated && <span className="cimke figyel" style={{ marginLeft: 6 }}>becsült</span>}
                          {r.receivedOn > t && <span className="cimke info" style={{ marginLeft: 6 }}>várható</span>}
                        </td>
                        <td className="nt">{datumRovid(r.deliveryDate)}</td>
                        <td className="jobb">
                          <Ft n={r.amountHuf} />
                        </td>
                        <td className="kicsi nt">
                          {r.countsForAtalany ? 'átalány' : <s>átalány</s>} · {r.countsForAfaLimit ? 'ÁFA-keret' : <s>ÁFA-keret</s>}
                        </td>
                        <td className="utolso jobb nt">
                          {r.countsForAtalany ? (
                            <button className="gomb-sz" onClick={() => setKizar(r)}>
                              Kizárom
                            </button>
                          ) : (
                            <button className="gomb-sz" onClick={() => patch.mutate({ id: r.id, body: { countsForAtalany: true, countsForAfaLimit: true, excludedReason: null } })}>
                              Visszaveszem
                            </button>
                          )}
                          {r.source === 'kezi' && (
                            <>
                              {' '}
                              <button className="gomb-v" style={{ marginLeft: 10 }} onClick={() => del.mutate(r.id)}>
                                Törlöm
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )
      )}
      <UjTetel nyitva={uj} bezar={() => setUj(false)} clientId={c.id} kesz={inv} />
      <MegjegyzesFiok
        nyitva={!!kizar}
        cim="Miért nem számít bevételnek?"
        bev={kizar ? `${kizar.description} – ez a tétel nem számít bele sem az átalányadózás bevételébe, sem az ÁFA-keretbe.` : ''}
        gomb="Kizárom"
        bezar={() => setKizar(null)}
        kuld={(note) => kizar && patch.mutate({ id: kizar.id, body: { countsForAtalany: false, countsForAfaLimit: false, excludedReason: note } })}
        folyamatban={patch.isPending}
      />
    </>
  );
}

function UjTetel({ nyitva, bezar, clientId, kesz }: { nyitva: boolean; bezar: () => void; clientId: string; kesz: () => void }) {
  const pir = usePirito();
  const t = today();
  const [f, setF] = useState({ description: 'Pénztárgép havi összesítő', receivedOn: t, deliveryDate: t, amount: '' });
  const amount = parseFt(f.amount);
  const add = useMutation({
    mutationFn: () => ep.accAddRevenue(clientId, { description: f.description.trim(), receivedOn: f.receivedOn, deliveryDate: f.deliveryDate, amountHuf: amount! }),
    onSuccess: () => {
      pir.ok('Hozzáadva, a becslést újraszámoltuk.');
      setF({ ...f, amount: '' });
      kesz();
      bezar();
    },
    onError: pir.hiba,
  });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      ikon="nyugta"
      cim="Kézi bevételi tétel"
      bev="Pl. pénztárgép havi összesítő vagy kézi nyugtatömb. A kiállított számlákat nem kell felvenned: azokat a NAV Online Számlából töltjük le."
      lab={
        <button className="gomb-e" disabled={!f.description.trim() || amount === null || amount === 0 || add.isPending} onClick={() => add.mutate()}>
          Hozzáadom
        </button>
      }
    >
      <label className="mezo">
        <span className="felirat">Megnevezés</span>
        <input className="doboz" maxLength={200} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <div className="mezosor k3" style={{ marginTop: 14 }}>
        <label className="mezo">
          <span className="felirat">Összeg (Ft)</span>
          <input className="doboz szam" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="1 480 000" />
          {f.amount && amount === null && <span className="hiba-szoveg">Egész forintot írj.</span>}
        </label>
        <label className="mezo">
          <span className="felirat">Bevétel napja</span>
          <input className="doboz" type="date" value={f.receivedOn} onChange={(e) => setF({ ...f, receivedOn: e.target.value })} />
        </label>
        <label className="mezo">
          <span className="felirat">Teljesítés napja</span>
          <input className="doboz" type="date" value={f.deliveryDate} onChange={(e) => setF({ ...f, deliveryDate: e.target.value })} />
        </label>
      </div>
      <p className="halvany kicsi" style={{ marginTop: 12 }}>Negatív összeg is lehet (pl. visszatérítés).</p>
    </Fiok>
  );
}
