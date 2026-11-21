// SPEC §32 – "Kata {év}" on the Adó tab of a KATA client: one row per started month (status, due date, amount, what the
// client marked, the check), the group "Rendben (folyószámla alapján)", the per-row "Eltérés", the free months
// (Kata tv. 7. § (8)–(10)) and the keret bar (with the projection – only the accountant sees it). The app never pays.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { KATA_EXEMPT_KINDS, KATA_EXEMPT_PANEL_LABELS, KATA_PANEL_TEXTS as K, type KataBreak, type KataExemptKind } from '../../../_shared/kata';
import { bejelentesKell, honapban, kataHonapCimke, kataSavSzin, kataSzunetHiba, kijelolheto } from '../../../lib/kata';
import { datum, datumIg, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { LOCK_TEXTS } from '../../../_shared/bekotes';

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => (v[k] !== undefined ? String(v[k]) : `{${k}}`));

export default function KataEv({ c, ev }: FulProps & { ev: number }) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['acc', 'kata', c.id, ev], queryFn: () => ep.accKata(c.id, ev) });
  const [jelolt, setJelolt] = useState<Set<string>>(new Set());
  const [megj, setMegj] = useState('');
  const [szerk, setSzerk] = useState<KataBreak[] | null>(null);
  const [szerkHiba, setSzerkHiba] = useState<string | null>(null);
  const [elteresHo, setElteresHo] = useState<{ periodId: string; label: string } | null>(null);
  const [elteresMegj, setElteresMegj] = useState('Nem látom a befizetést a folyószámlán.');
  const frissit = () => {
    void qc.invalidateQueries({ queryKey: ['acc', 'kata', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
  };
  const rendben = useMutation({
    // javító kör 11-21 [DÁVID K11]: "Rendben" only from the statement row – its day and amount are the required note
    mutationFn: () => ep.accKataVerify(c.id, { periodIds: [...jelolt], note: megj.trim() }),
    onSuccess: () => {
      pir.ok(`Rendben. ${c.firstName} látja, hogy ellenőrizted.`);
      setJelolt(new Set());
      setMegj('');
      frissit();
    },
    onError: pir.hiba,
  });
  const elteres = useMutation({
    mutationFn: (x: { periodId: string; note: string }) => ep.accVerifyPayment(x.periodId, [{ kind: 'kata_teteles', verification: 'elteres', note: x.note }]),
    onSuccess: () => {
      pir.ok(`Jeleztük ${c.firstName} felé az eltérést.`);
      setElteresHo(null);
      frissit();
    },
    onError: pir.hiba,
  });
  const ment = useMutation({
    mutationFn: (breaks: KataBreak[]) => ep.accKataBreaks(c.id, { year: ev, breaks }),
    onSuccess: () => {
      pir.ok('Elmentettem. A hónapok és a keret frissültek.');
      setSzerk(null);
      frissit();
    },
    onError: pir.hiba,
  });
  if (q.isPending) return <Toltes />;
  if (q.isError) return <HibaSav hiba={q.error} ujra={() => q.refetch()} />;
  const v = q.data;
  const m = v.meter;
  const zarolt = Boolean(c.serviceLock);
  return (
    <div className="lap" style={{ marginBottom: 16 }}>
      <div className="lap-fej">
        <I3 n="bevallas" s={36} />
        <div>
          <h2>{fill(K.cim, { ev })}</h2>
          <div className="megj">
            {K.valtozat[v.variant]}
            {v.fofoglalkozasu === false ? ` · ${K.nemFofoglalkozasu}` : v.fofoglalkozasu ? ` · ${K.fofoglalkozasu}` : ''}
            {v.monthlyHuf !== null ? ` · ${szam(v.monthlyHuf)} Ft/hó` : ''}
            {v.kataFrom && v.kataFrom > `${ev}-01-01` ? ` · kezdete: ${datum(v.kataFrom)}` : ''}
            {v.kataTo ? ` · utolsó napja: ${datum(v.kataTo)}` : ''}
          </div>
        </div>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {v.draftNote && (
          <div className="uzenet-sav figyel" style={{ marginBottom: 12 }}>
            <div>{v.draftNote}</div>
          </div>
        )}
        {/* javító kör 11-21: a KATA that ended during the year – the declaration and the különadó are due 30 days after */}
        {v.kataTo && v.kataTo < `${ev}-12-31` && (
          <div className="uzenet-sav figyel" style={{ marginBottom: 12 }}>
            <div>{fill(K.megszunt, { datum: datum(v.kataTo, { ev: true }), hatarido: m.kulonadoDue ? datum(m.kulonadoDue, { ev: true }) : 'a megszűnéstől 30 nap' })}</div>
          </div>
        )}
        {/* the months before the app: one line, not one per row */}
        {v.months.some((x) => x.status === 'ellenorizetlen') && (
          <div className="uzenet-sav figyel" style={{ marginBottom: 12 }}>
            <div>{K.ellenorizetlen}</div>
          </div>
        )}
        {/* the keret bar (Kata tv. 7. § (4)–(5)) */}
        <div style={{ marginBottom: 14 }}>
          <b className="szam">{fill(K.keretSor, { bevetel: szam(m.usedHuf), keret: szam(m.limitHuf), pct: m.pct })}</b>
          <div className="sav k28-sav" aria-hidden="true" style={{ marginTop: 6 }}>
            <i style={{ width: `${Math.min(100, Math.max(0, m.pct))}%`, background: kataSavSzin(m.level) }} />
          </div>
          <div className="halvany kicsi" style={{ marginTop: 4 }}>
            {m.limitLine} {m.remainingLine ?? ''} {m.kulonadoEstimateHuf > 0 ? `Különadó-becslés: ${szam(m.kulonadoEstimateHuf)} Ft${m.kulonadoDue ? `, ${datum(m.kulonadoDue, { ev: true })}` : ''}.` : ''}
          </div>
          {m.projectedOverHuf > 0 && <div className="kicsi" style={{ marginTop: 4 }}>{fill(K.elorejelzes, { varhato: szam(m.projectedHuf) })}</div>}
          {m.warningLine && <div className="kicsi" style={{ marginTop: 4, fontWeight: 600 }}>{m.warningLine}</div>}
          <div className="halvany kicsi" style={{ marginTop: 6 }}>{K.evVege}</div>
        </div>
        <table className="tabla">
          <thead>
            <tr>
              <th aria-label="Kijelölés" />
              <th>{K.oszlopHonap}</th>
              <th>{K.oszlopAllapot}</th>
              <th>{K.oszlopHatarido}</th>
              <th className="jobb">{K.oszlopOsszeg}</th>
              <th>{K.oszlopJelolte}</th>
              <th>{K.oszlopEllenorzes}</th>
            </tr>
          </thead>
          <tbody>
            {v.months.map((x) => {
              const ch = kataHonapCimke(x);
              const lehet = kijelolheto(x);
              return (
                <tr key={x.monthKey}>
                  <td>
                    {lehet && (
                      <input
                        type="checkbox"
                        aria-label={`${x.label}: rendben`}
                        checked={jelolt.has(x.periodId!)}
                        onChange={(e) =>
                          setJelolt((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.add(x.periodId!);
                            else n.delete(x.periodId!);
                            return n;
                          })
                        }
                      />
                    )}
                  </td>
                  <td>
                    {x.label}
                    {x.exemptLostByRevenue && <div className="kicsi" style={{ color: 'var(--borostyan)' }}>{fill(K.bevetelMentesben, { honapban: honapban(x.label) })}</div>}
                    {x.paidButExempt && <div className="kicsi" style={{ color: 'var(--veszely)' }}>{K.befizetettMentes}</div>}
                    {x.reportDue && <div className="kicsi" style={{ color: 'var(--borostyan)' }}>Mentesség bejelentése: {datumIg(x.reportDue)} (7. § (10))</div>}
                  </td>
                  <td>
                    <span className={`cimke ${ch.tipus === 'semleges' ? '' : ch.tipus}`}>{ch.szoveg}</span>
                  </td>
                  <td>{datum(x.dueDate, { ev: x.dueDate.slice(0, 4) !== String(ev) })}</td>
                  <td className="jobb szam">{x.amountHuf === null ? '–' : `${szam(x.amountHuf)} Ft`}</td>
                  <td>{x.markedPaidOn ? datum(x.markedPaidOn) : '–'}</td>
                  <td>
                    {x.periodId && (x.status === 'befizetve_jelezve' || x.status === 'fizetendo') && (
                      <button
                        className="gomb-sz kicsi"
                        disabled={zarolt || elteres.isPending}
                        title={zarolt ? LOCK_TEXTS.panelDisabled : undefined}
                        onClick={() => setElteresHo({ periodId: x.periodId!, label: x.label })}
                      >
                        {K.elteres}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {elteresHo && (
          <div className="uzenet-sav figyel" style={{ marginTop: 10, display: 'block' }}>
            <label className="mezo">
              <span className="felirat">Mi az eltérés ({elteresHo.label})? Ezt {c.firstName} is látja.</span>
              <textarea className="doboz" rows={2} maxLength={500} value={elteresMegj} onChange={(e) => setElteresMegj(e.target.value)} />
            </label>
            <div className="sor-flex" style={{ marginTop: 8 }}>
              <button className="gomb-e kicsi" disabled={!elteresMegj.trim() || elteres.isPending} onClick={() => elteres.mutate({ periodId: elteresHo.periodId, note: elteresMegj.trim() })}>
                Elküldöm
              </button>
              <button className="gomb-sz" onClick={() => setElteresHo(null)}>
                Mégsem
              </button>
            </div>
          </div>
        )}
        <div className="sor-flex" style={{ marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="mezo" style={{ minWidth: 260, flex: 1 }}>
            <span className="felirat">{K.csoportosMegjegyzes}</span>
            <input className="doboz" value={megj} maxLength={500} onChange={(e) => setMegj(e.target.value)} />
          </label>
          <button
            className="gomb-e kicsi"
            disabled={!jelolt.size || megj.trim().length < 5 || rendben.isPending || zarolt}
            title={zarolt ? LOCK_TEXTS.panelDisabled : megj.trim().length < 5 ? K.csoportosMegjegyzesKell : undefined}
            onClick={() => rendben.mutate()}
          >
            {K.csoportosRendben} ({jelolt.size})
          </button>
        </div>
        {jelolt.size > 0 && megj.trim().length < 5 && <div className="sugo" style={{ marginTop: 4 }}>{K.csoportosMegjegyzesKell}</div>}

        {/* free months (Kata tv. 7. § (8)–(10)); only the accountant records them [D21] */}
        <div style={{ marginTop: 18 }}>
          <div className="sor-flex" style={{ justifyContent: 'space-between' }}>
            <b>Mentes időszakok</b>
            {!szerk && (
              <button className="gomb-m kicsi" disabled={zarolt} onClick={() => setSzerk([...(v.breaks ?? [])])}>
                {K.mentesHozzaad}
              </button>
            )}
          </div>
          <p className="halvany kicsi">{K.mentesSzabaly}</p>
          {!szerk ? (
            (v.breaks ?? []).length ? (
              <ul className="kicsi">
                {(v.breaks ?? []).map((b, i) => (
                  <li key={i}>
                    {datum(b.from, { ev: true })} – {datum(b.to, { ev: true })}: {KATA_EXEMPT_PANEL_LABELS[b.kind]}
                    {bejelentesKell(b.kind) ? (b.reportedOn ? ` · bejelentve ${datum(b.reportedOn)}` : ' · még nincs bejelentve') : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="halvany kicsi">Nincs rögzített mentes időszak.</p>
            )
          ) : (
            <div>
              {szerk.map((b, i) => {
                const set = (p: Partial<KataBreak>) => setSzerk((s) => s!.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={i} className="sor-flex" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
                    <label className="mezo" style={{ width: 160 }}>
                      <span className="felirat">{K.mentesKezdet}</span>
                      <input className="doboz" type="date" value={b.from} onChange={(e) => set({ from: e.target.value })} />
                    </label>
                    <label className="mezo" style={{ width: 160 }}>
                      <span className="felirat">{K.mentesVeg}</span>
                      <input className="doboz" type="date" value={b.to} onChange={(e) => set({ to: e.target.value })} />
                    </label>
                    <label className="mezo" style={{ minWidth: 260 }}>
                      <span className="felirat">{K.mentesOk}</span>
                      <select className="doboz" value={b.kind} onChange={(e) => set({ kind: e.target.value as KataExemptKind })}>
                        {KATA_EXEMPT_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {KATA_EXEMPT_PANEL_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {bejelentesKell(b.kind) && (
                      <label className="mezo" style={{ width: 170 }}>
                        <span className="felirat">{K.mentesBejelentve}</span>
                        <input className="doboz" type="date" value={b.reportedOn ?? ''} onChange={(e) => set({ reportedOn: e.target.value || null })} />
                      </label>
                    )}
                    <button className="gomb-sz kicsi" onClick={() => setSzerk((s) => s!.filter((_, j) => j !== i))}>
                      {K.mentesTorles}
                    </button>
                  </div>
                );
              })}
              <div className="sor-flex" style={{ marginTop: 6 }}>
                <button className="gomb-m kicsi" onClick={() => setSzerk((s) => [...s!, { from: `${ev}-${t.slice(5, 7)}-01`, to: `${ev}-${t.slice(5, 7)}-01`, kind: 'tappenz', reportedOn: null }])}>
                  + Új időszak
                </button>
                <button
                  className="gomb-e kicsi"
                  disabled={ment.isPending}
                  onClick={() => {
                    const h = kataSzunetHiba(szerk, ev, t);
                    setSzerkHiba(h);
                    if (!h) ment.mutate(szerk.map((b) => ({ ...b, reportedOn: bejelentesKell(b.kind) ? (b.reportedOn ?? null) : null })));
                  }}
                >
                  {K.mentesMentes}
                </button>
                <button className="gomb-sz" onClick={() => { setSzerk(null); setSzerkHiba(null); }}>
                  Mégsem
                </button>
              </div>
              {szerkHiba && <div className="uzenet-sav hiba" style={{ marginTop: 8 }}><div>{szerkHiba}</div></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
