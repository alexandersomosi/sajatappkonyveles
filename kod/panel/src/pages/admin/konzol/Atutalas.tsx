// k8 ALAP-B – the bank transfer in the owner console; k8 FELÜLET-P: v2 look (three filter tiles with Fluent icons, the
// late tile with a solid red bar, switches drawn as toggles, "Felfüggesztem" as the red-outlined danger button):
//  - AtutalasSzakasz: tiles fizetett (this month) / vár / késik and the díjbekérő table (all clients or one client);
//  - row actions: "Beérkezett, rögzítem" (day, amount = the díjbekérő's, reason, confirmation; step-up), "Újraküldöm",
//    "Felfüggesztem" (the existing manual lock, reason filled in);
//  - FizetesKapcsolokLap: the switches "Átutalásos fizetés", "Késésnél álljon le a könyvelés", memo format (Rendszer).
// Every write goes through useLepcsos() (403 step_up_required → the code dialog → the same action again).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as k8 from '../../../api/k8';
import { TRANSFER_SOURCE_LABELS, type AdminTransferRow } from '../../../_shared/k8';
import { Fiok, HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { datum, datumRovid, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { LepcsoProvider, useLepcsos } from './lepcso';

export const KEZI_OK = 'Beérkezett az utalás, kézzel rögzítem.';
export const FELFUGGESZTES_OK = 'Átutalás késik';
export const KAPCSOLO_FIGYELMEZTETES = 'Élesben csak az ÁSZF frissítése után kapcsold be.';

/** The status label of a row: red "Késik (n napja)" for a late one. */
export function allapotCimke(r: Pick<AdminTransferRow, 'status' | 'statusLabel' | 'daysLate'>): { szoveg: string; osztaly: string } {
  if (r.status === 'kesik') return { szoveg: `${r.statusLabel}${r.daysLate ? ` (${r.daysLate} napja)` : ''}`, osztaly: 'cimke hiba' };
  if (r.status === 'fizetve') return { szoveg: r.statusLabel, osztaly: 'cimke ok' };
  if (r.status === 'hiba') return { szoveg: r.statusLabel, osztaly: 'cimke figyel' };
  if (r.status === 'visszavonva') return { szoveg: r.statusLabel, osztaly: 'cimke' };
  return { szoveg: r.statusLabel, osztaly: 'cimke info' };
}

/** "Beérkezett, rögzítem": the reason is required (≥ 5 characters), then a confirmation sentence. */
export function KeziJelolesFiok({ r, bezar, kesz }: { r: AdminTransferRow | null; bezar: () => void; kesz: () => void }) {
  const futtat = useLepcsos();
  const pir = usePirito();
  const [nap, setNap] = useState(today());
  const [ok, setOk] = useState(KEZI_OK);
  const [megerosit, setMegerosit] = useState(false);
  const [fut, setFut] = useState(false);
  if (!r) return null;
  const jo = ok.trim().length >= 5 && /^\d{4}-\d{2}-\d{2}$/.test(nap);
  const kuld = async () => {
    setFut(true);
    try {
      await futtat(() => k8.consoleTransferPaid(r.id, { paidOn: nap, amountHuf: r.amountHuf, reason: ok.trim() }));
      pir.ok('Rögzítettük az utalást. Az ügyfél előfizetése él.');
      setMegerosit(false);
      kesz();
    } catch (e) {
      pir.hiba(e);
    } finally {
      setFut(false);
    }
  };
  return (
    <Fiok nyitva={!!r} keskeny ikon="befizetve" cim="Beérkezett, rögzítem" bev={`${r.clientName} · ${r.orderNo} · ${szam(r.amountHuf)} Ft`} bezar={bezar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (jo) setMegerosit(true);
        }}
      >
        <label className="mezo">
          <span className="felirat">A beérkezés napja</span>
          <input className="doboz" type="date" value={nap} max={today()} onChange={(e) => setNap(e.target.value)} />
        </label>
        <label className="mezo">
          <span className="felirat">Miért rögzíted kézzel? (a naplóba kerül)</span>
          <textarea className={`doboz${ok.trim().length < 5 ? ' hibas' : ''}`} rows={3} value={ok} onChange={(e) => setOk(e.target.value)} />
          {ok.trim().length < 5 ? <span className="hiba-szoveg">Írd le röviden az okát.</span> : null}
        </label>
        {megerosit ? (
          <div role="alert" style={{ marginTop: 12 }}>
            <p>
              Rögzíted: beérkezett {szam(r.amountHuf)} Ft (közlemény: {r.kozlemeny}), a beérkezés napja {datum(nap, { ev: true })} Ezzel elindul a díjszámla és az ügyfél előfizetése.
            </p>
            <button type="button" className="gomb-e" disabled={fut} onClick={() => void kuld()}>
              Megerősítem
            </button>
          </div>
        ) : (
          <button type="submit" className="gomb-e" style={{ marginTop: 14 }} disabled={!jo}>
            Tovább
          </button>
        )}
      </form>
    </Fiok>
  );
}

/** The inclusive last day of a [start, end) period (the mail and the PDF show this day too). */
function utolsoNap(endExclusive: string): string {
  const d = new Date(`${endExclusive}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function Tabla({ sorok, egyUgyfel, frissit }: { sorok: AdminTransferRow[]; egyUgyfel: boolean; frissit: () => void }) {
  const futtat = useLepcsos();
  const pir = usePirito();
  const [jelol, setJelol] = useState<AdminTransferRow | null>(null);
  // k8 integrator (payment-path review 3): suspending stops the accounting and mails the client – never on one click
  const [felfugg, setFelfugg] = useState<AdminTransferRow | null>(null);
  const [felfuggDolgozik, setFelfuggDolgozik] = useState(false);
  if (!sorok.length) return <p className="halvany" style={{ padding: '6px 24px 18px' }}>Nincs ilyen díjbekérő.</p>;
  return (
    <>
      <div className="tabla-gorgo">
        <table className="tabla tomor">
          <thead>
            <tr>
              {!egyUgyfel ? <th className="elso">Ügyfél</th> : null}
              <th className={egyUgyfel ? 'elso' : undefined}>Időszak</th>
              <th>Rendelésszám</th>
              <th className="jobb">Összeg</th>
              <th>Határidő</th>
              <th>Állapot</th>
              <th>Utolsó lekérdezés</th>
              <th className="utolso">Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {sorok.map((r) => {
              const c = allapotCimke(r);
              const nyitott = r.status === 'kiallitva' || r.status === 'kesik';
              return (
                <tr key={r.id}>
                  {!egyUgyfel ? (
                    <td className="elso">
                      <span className="felkover nt">{r.clientName}</span>
                      {r.customerNo ? <div className="al">ügyfélszám {r.customerNo}</div> : null}
                    </td>
                  ) : null}
                  <td className={`nt${egyUgyfel ? ' elso' : ''}`}>{r.period ? `${datumRovid(r.period.start)} – ${datumRovid(utolsoNap(r.period.end))}` : 'első hónap'}</td>
                  <td className="szam">
                    {r.orderNo}
                    {r.proformaNumber ? <div className="al">{r.proformaNumber}</div> : null}
                  </td>
                  <td className="jobb nt">{szam(r.amountHuf)} Ft</td>
                  <td className="nt">{datumRovid(r.dueOn)}</td>
                  <td>
                    <span className={c.osztaly}>{c.szoveg}</span>
                    {r.paidOn ? <div className="al nt">{datumRovid(r.paidOn)} · {r.paidSource ? TRANSFER_SOURCE_LABELS[r.paidSource] : ''}</div> : null}
                  </td>
                  <td className="nt">{r.lastCheckedAt ? datumRovid(r.lastCheckedAt.slice(0, 10)) : <span className="halvany">–</span>}</td>
                  <td className="utolso">
                    {nyitott ? (
                      <div className="sor-muveletek">
                        <button type="button" className="gomb-m kicsi" onClick={() => setJelol(r)}>
                          Beérkezett, rögzítem
                        </button>
                        <span className="sor-flex" style={{ gap: 14 }}>
                          <button type="button" className="gomb-sz" onClick={() => void futtat(() => k8.consoleTransferResend(r.id)).then(() => pir.ok('Újraküldtük a díjbekérőt.'), pir.hiba)}>
                            Újraküldöm
                          </button>
                          {r.status === 'kesik' && r.clientLocked ? (
                            <span className="cimke hiba">Felfüggesztve</span>
                          ) : r.status === 'kesik' ? (
                            <button type="button" className="gomb-v" onClick={() => setFelfugg(r)}>
                              Felfüggesztem
                            </button>
                          ) : null}
                        </span>
                      </div>
                    ) : (
                      <span className="halvany">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Fiok
        nyitva={Boolean(felfugg)}
        keskeny
        bezar={() => setFelfugg(null)}
        ikon="lakat"
        cim="Felfüggeszted a könyvelést?"
        bev={felfugg ? `${felfugg.clientName} könyvelése szünetel, és „Szünetel a könyvelésed” levelet kap. Feloldani az ügyfélkártyán tudod.` : ''}
        children={null}
        lab={
          <>
            <button
              type="button"
              className="gomb-e veszelyes"
              disabled={felfuggDolgozik}
              onClick={() => {
                const r = felfugg;
                if (!r) return;
                setFelfuggDolgozik(true);
                void futtat(() => k8.consoleLock(r.clientId, FELFUGGESZTES_OK))
                  .then(() => (pir.ok('Felfüggesztettük a könyvelést.'), setFelfugg(null), frissit()), pir.hiba)
                  .finally(() => setFelfuggDolgozik(false));
              }}
            >
              Felfüggesztem
            </button>
            <button type="button" className="gomb-sz" onClick={() => setFelfugg(null)}>
              Mégse
            </button>
          </>
        }
      />
      <KeziJelolesFiok
        r={jelol}
        bezar={() => setJelol(null)}
        kesz={() => {
          setJelol(null);
          frissit();
        }}
      />
    </>
  );
}

/** Tiles + the table. With `clientId`: only that client's díjbekérők (client card). Needs a LepcsoProvider above. */
export function AtutalasSzakasz({ clientId }: { clientId?: string }) {
  const qc = useQueryClient();
  const [szuro, setSzuro] = useState<k8.TransferSzuro | undefined>(clientId ? undefined : 'kesik');
  const osszeg = useQuery({ queryKey: ['konzol', 'atutalas', 'osszeg'], queryFn: k8.consoleTransferSummary, enabled: !clientId, retry: false });
  const lista = useQuery({ queryKey: ['konzol', 'atutalas', clientId ?? 'mind', szuro ?? ''], queryFn: () => k8.consoleTransfers({ status: szuro, clientId }), retry: false });
  const frissit = () => void qc.invalidateQueries({ queryKey: ['konzol'] });
  if (lista.isError && (lista.error as { status?: number })?.status === 404) return null; // a server without k8
  const o = osszeg.data;
  return (
    <div className="szak" style={{ padding: 0 }}>
      <div className="szak-fej" style={{ padding: '18px 24px 0' }}>
        <I3 n="bank" />
        <h2>Átutalás – díjbekérők</h2>
        {o ? <span className="megj">{o.ugyfelek} ügyfél fizet átutalással</span> : null}
      </div>
      {!clientId && o ? (
        <div className="atutalas-csempek" role="group" aria-label="Szűrés állapot szerint">
          {(
            [
              ['fizetett', 'Fizetett (e hónap)', o.fizetett, o.fizetettHuf, 'pipa-kor'],
              ['var', 'Vár', o.var, o.varHuf, 'ora'],
              ['kesik', 'Késik', o.kesik, o.kesikHuf, 'figyelem'],
            ] as const
          ).map(([kulcs, felirat, db, huf, ikon]) => (
            <button
              key={kulcs}
              type="button"
              className={`atutalas-csempe${szuro === kulcs ? ' on' : ''}${kulcs === 'kesik' && db ? ' kesik' : ''}`}
              aria-pressed={szuro === kulcs}
              onClick={() => setSzuro(kulcs)}
            >
              <I3 n={ikon} s={34} className="csempe-ikon" />
              <span className="l">
                <span className="ertek">{db}</span>
                <span className="mi">
                  {felirat} · {szam(huf)} Ft
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {lista.isPending ? <Toltes /> : lista.isError ? <HibaSav hiba={lista.error} ujra={() => lista.refetch()} /> : <Tabla sorok={lista.data.items} egyUgyfel={!!clientId} frissit={frissit} />}
    </div>
  );
}

function KapcsolokBelso() {
  const futtat = useLepcsos();
  const pir = usePirito();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['konzol', 'kapcsolok', 'fizetes'], queryFn: k8.consoleFizetesKapcsolok, retry: false });
  const [fut, setFut] = useState(false);
  if (q.isError) return null; // no TOTP / a server without k8: the console shows the reason elsewhere
  const d = q.data;
  const ment = async (patch: Parameters<typeof k8.consoleFizetesKapcsolokMent>[0]) => {
    setFut(true);
    try {
      const v = await futtat(() => k8.consoleFizetesKapcsolokMent(patch));
      qc.setQueryData(['konzol', 'kapcsolok', 'fizetes'], v);
      pir.ok('Elmentettük.');
    } catch (e) {
      pir.hiba(e);
    } finally {
      setFut(false);
    }
  };
  return (
    <div className="lap" style={{ marginBottom: 16 }}>
      <div className="lap-fej">
        <h2>Átutalásos fizetés</h2>
        <span className="megj">{KAPCSOLO_FIGYELMEZTETES}</span>
      </div>
      {!d ? (
        <Toltes />
      ) : (
        <table className="tabla">
          <tbody>
            <tr>
              <td className="elso">
                <div className="felkover">Átutalásos fizetés</div>
                <div className="al">Új ügyfél választhatja a díjbekérős átutalást. Kikapcsolva is megy tovább azoknak, akik már átutalással fizetnek.</div>
              </td>
              <td className="utolso">
                <label className="kapcsolo-cimke">
                  <input type="checkbox" role="switch" aria-label="Átutalásos fizetés" className="kapcsolo" checked={d.atutalas} disabled={fut} onChange={(e) => void ment({ atutalas: e.target.checked, reason: e.target.checked ? 'Átutalás bekapcsolva' : 'Átutalás kikapcsolva' })} /> {d.atutalas ? 'Be' : 'Ki'}
                </label>
              </td>
            </tr>
            <tr>
              <td className="elso">
                <div className="felkover">Késésnél álljon le a könyvelés</div>
                <div className="al">Bekapcsolva a határidő után 8 nappal szünetel a könyvelés. Kikapcsolva csak emlékeztetőt küldünk (1., 4. és 8. nap).</div>
              </td>
              <td className="utolso">
                <label className="kapcsolo-cimke">
                  <input type="checkbox" role="switch" aria-label="Késésnél álljon le a könyvelés" className="kapcsolo" checked={d.kesesLeallit} disabled={fut} onChange={(e) => void ment({ kesesLeallit: e.target.checked, reason: e.target.checked ? 'Késésnél leállítás be' : 'Késésnél leállítás ki' })} /> {d.kesesLeallit ? 'Be' : 'Ki'}
                </label>
              </td>
            </tr>
            <tr>
              <td className="elso">
                <div className="felkover">Közlemény</div>
                <div className="al">Havi: a díjbekérő rendelésszáma (a Számlázz.hu leírása szerint az Autokassza ezt keresi; élőben még nem próbáltuk). Állandó: ADZ-ügyfélszám (állandó átutaláshoz, a párosítás nem biztos).</div>
              </td>
              <td className="utolso">
                <select className="doboz" aria-label="Közlemény" value={d.kozlemeny} disabled={fut} onChange={(e) => void ment({ kozlemeny: e.target.value as 'havi' | 'allando', reason: 'Közlemény-formátum' })}>
                  <option value="havi">Havi (rendelésszám)</option>
                  <option value="allando">Állandó (ügyfélszám)</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Rendszer page: the payment switches with their own step-up dialog. */
export function FizetesKapcsolokLap() {
  return (
    <LepcsoProvider>
      <KapcsolokBelso />
    </LepcsoProvider>
  );
}
