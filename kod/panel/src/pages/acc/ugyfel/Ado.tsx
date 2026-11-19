// Adó: quarter calculation from ado-motor, overrides with reason, the letter, "Jóváhagyom és elküldöm",
// payment verification, "Beadva" with the 2658 PDF + NAV receipt (FUNKCIOK 8, 22, 23; SPEC §6.3, §7).
import { useEffect, useMemo, useRef, useState } from 'react';
import { LOCK_TEXTS } from '../../../_shared/bekotes';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { AccTaxPeriod, QuarterResult } from '../../../api/types';
import { Fiok, Ft, HibaSav, NagyFt, Toltes, Ures, EvValaszto } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { Level } from '../../../ui/Level';
import { usePirito } from '../../../ui/Pirito';
import { useAuth } from '../../../auth/Auth';
import { CALC_LABEL, PAYMENT_STATUS_LABEL } from '../../../lib/labels';
import { datum, datumIg, ft, jarulekNyomtatvany, hataridoMondat, hatridoSzoveg, HONAPOK, nagybetu, napKulonbseg, negyedevNev, nevelo, parseFt, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { fajlHiba } from '../../../lib/validate';
import { MegjegyzesFiok } from './Bekotes';

function rovidNev(p: AccTaxPeriod, osszes?: AccTaxPeriod[]): string {
  const nev = negyedevNev(p.periodKey).replace(/^\d{4}\.\s/, '');
  // Egyetlen HIPA-befizetés (pl. sávos módszer): nincs „1. részlet”.
  if (osszes && p.kind === 'hipa' && osszes.filter((x) => x.kind === 'hipa').length === 1) return nev.replace(/\s*\(\d\. részlet\)/, '');
  return nev;
}

/** The three payment kinds of a quarter and the engine's explanation line that belongs to each. */
type Fajta = 'tb_jarulek' | 'szocho' | 'szja_eloleg';
function adoFajta(cimke: string): Fajta | null {
  if (/^TB-járulék/i.test(cimke)) return 'tb_jarulek';
  if (/^Szocho/i.test(cimke)) return 'szocho';
  if (/^SZJA-előleg/i.test(cimke)) return 'szja_eloleg';
  return null;
}
/** An approved quarter whose amounts the accountant changed by hand: the final amounts per kind, the total, the reason. */
export interface KeziModositas {
  reason: string;
  veg: Record<Fajta, number>;
  total: number;
}
export function keziModositas(p: AccTaxPeriod, r: QuarterResult): KeziModositas | null {
  const o = p.latestCalculation?.overrides;
  if (p.calcStatus !== 'jovahagyva' || !o) return null;
  const veg = { tb_jarulek: o.tbHuf ?? r.tbHuf, szocho: o.szochoHuf ?? r.szochoHuf, szja_eloleg: o.szjaAdvanceHuf ?? r.szjaAdvanceHuf };
  // The payment items are what the client really sees; fall back to the override values if an item is missing (0 Ft).
  const total = p.items.length ? p.items.reduce((a, i) => a + i.amountHuf, 0) : veg.tb_jarulek + veg.szocho + veg.szja_eloleg;
  return { reason: o.reason, veg, total };
}
/** "104 280 Ft" struck through, then the amount that was approved. */
function Modositott({ eredeti, uj }: { eredeti: number; uj: number }) {
  if (eredeti === uj) return <Ft n={uj} />;
  return (
    <>
      <span className="athuzott" title="A motor számítása">
        <Ft n={eredeti} />
      </span>
      <Ft n={uj} />
    </>
  );
}

/** A quarter due before the client joined belongs to the previous accountant (unless we approved/filed it). */
export function elozoKonyveloje(p: AccTaxPeriod, kezd: string): boolean {
  return p.dueDate < kezd && p.calcStatus !== 'jovahagyva' && p.filingStatus !== 'beadva';
}

function alapIdoszak(items: AccTaxPeriod[], t: string, kezd: string): string | undefined {
  const osszes = items.filter((p) => p.kind === 'negyedev');
  const q = osszes.filter((p) => !elozoKonyveloje(p, kezd));
  if (!q.length) return osszes.find((p) => p.dueDate >= t)?.periodKey ?? osszes[osszes.length - 1]?.periodKey;
  // 1) approved, client marked paid, not verified  2) estimate of an ended quarter  3) approved not filed  4) current estimate
  return (
    q.find((p) => p.paymentStatus === 'befizetve_jelezve')?.periodKey ??
    q.find((p) => p.calcStatus === 'becsles' && (p.latestCalculation?.result as QuarterResult | undefined)?.complete)?.periodKey ??
    q.find((p) => p.calcStatus === 'jovahagyva' && p.filingStatus === 'nincs' && napKulonbseg(p.dueDate, t) > -60)?.periodKey ??
    q.find((p) => p.calcStatus === 'becsles' && p.dueDate >= t)?.periodKey ??
    q.find((p) => p.calcStatus === 'becsles')?.periodKey ??
    q[q.length - 1]?.periodKey
  );
}

export default function Ado({ c }: FulProps) {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const ev = Number(sp.get('ev') ?? t.slice(0, 4));
  const q = useQuery({ queryKey: ['acc', 'tax', c.id, ev], queryFn: () => ep.accTaxPeriods(c.id, ev) });
  const items = q.data?.items ?? [];
  const kezd = c.clientSince.slice(0, 10);
  // The default period is worked out once per year view and then stays: after "Beadottnak jelölöm" (or a payment
  // check) the rule would pick the NEXT quarter and the page would jump away from what was just done.
  const alap = alapIdoszak(items, t, kezd);
  const [rogzitett, setRogzitett] = useState<{ ev: number; kulcs: string } | null>(null);
  useEffect(() => {
    if (alap && rogzitett?.ev !== ev) setRogzitett({ ev, kulcs: alap });
  }, [alap, ev, rogzitett]);
  const kulcs = sp.get('idoszak') ?? (rogzitett?.ev === ev ? rogzitett.kulcs : alap);
  const p = items.find((x) => x.periodKey === kulcs);
  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14 }}>
        <EvValaszto ev={Number(ev)} evek={[Number(t.slice(0, 4)), Number(t.slice(0, 4)) - 1]} valt={(y) => setSp({ ev: String(y) }, { replace: true })} />
        <span className="halvany kicsi">2026-tól a TB-járulékot, a szochót és az SZJA-előleget is negyedévente fizeti, a negyedév utáni hónap 12-éig ({szamRag(jarulekNyomtatvany(Number(ev)))} bevallás).</span>
      </div>
      {c.lifecycle === 'bekotes_alatt' && (
        // SPEC §26.5.2 (order 4): the client cannot see tax data before activation, so approving waits (review k3c2).
        <div className="uzenet-sav figyel" style={{ marginBottom: 14 }}>
          <div>
            <b>{c.firstName} még bekötés alatt van.</b> Számolni már tudsz, de jóváhagyni csak a bekötés után lehet: addig nem látná az összeget és a számlaszámokat, és nem tudná befizetettnek jelölni.
          </div>
        </div>
      )}
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {q.isPending ? (
        <Toltes />
      ) : !c.taxProfile ? (
        <div className="lap">
          <Ures n="ures_mappa" cim="Még nincs adóprofil">
            Amint kitölti a kérdőívet és megerősíted a költséghányadot, itt számolunk.
          </Ures>
        </div>
      ) : (
        <>
          <div className="racs k4" style={{ gridTemplateColumns: `repeat(${Math.max(4, items.length)}, minmax(0, 1fr))` }}>
            {items.map((x) => (
              <button key={x.id} className={`negyedev-kartya${x.periodKey === kulcs ? ' on' : ''}`} onClick={() => setSp({ ev: String(ev), idoszak: x.periodKey }, { replace: true })}>
                <div className="cim">{nagybetu(rovidNev(x, items))}</div>
                <div className="ossz">{x.totalHuf === null ? <span className="halvany">–</span> : <NagyFt n={x.totalHuf} />}</div>
                <div style={{ marginTop: 6 }}>
                  {elozoKonyveloje(x, kezd) ? <span className="halvany kicsi">Csatlakozás előtt – nem mi adtuk be</span> : <IdoszakAllapot p={x} />}
                </div>
                <div className="halvany kicsi" style={{ marginTop: 4 }}>
                  Határidő: {datum(x.dueDate, { ev: x.dueDate.slice(0, 4) !== String(ev) })}
                </div>
              </button>
            ))}
          </div>
          {p ? <Idoszak key={p.id} p={p} c={c} alapLevel={q.data!.defaultLetterText} /> : null}
        </>
      )}
    </>
  );
}

export function IdoszakAllapot({ p }: { p: AccTaxPeriod }) {
  if (p.calcStatus === 'jovahagyva' && p.paymentStatus === 'befizetve_jelezve') return <span className="cimke figyel">Befizette – ellenőrizd</span>;
  if (p.calcStatus === 'jovahagyva' && p.paymentStatus === 'elteres') return <span className="cimke hiba">Eltérés a befizetésben</span>;
  if (p.filingStatus === 'beadva') {
    // Filing and payment are separate: after filing the payment still has to be visible.
    const t = today();
    const fizetes =
      p.paymentStatus === 'ellenorizve' ? (
        <span className="halvany kicsi">befizetve, ellenőrizve</span>
      ) : p.paymentStatus === 'nincs_fizetendo' ? null : p.dueDate < t ? (
        <span className="cimke hiba">Fizetendő, lejárt</span>
      ) : (
        <span className="cimke info">Fizetendő</span>
      );
    return (
      <span className="sor-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="allapot">
          <I3 n="befizetve_jel" s={18} />
          <span className="szo">Beadva</span>
        </span>
        {fizetes}
      </span>
    );
  }
  if (p.calcStatus === 'jovahagyva') {
    if (p.paymentStatus === 'ellenorizve') return <span className="allapot"><I3 n="befizetve_jel" s={18} /><span className="szo">Befizetve, ellenőrizve</span></span>;
    if (p.paymentStatus === 'befizetve_jelezve') return <span className="cimke figyel">Befizette – ellenőrizd</span>;
    if (p.paymentStatus === 'elteres') return <span className="cimke hiba">Eltérés</span>;
    return <span className="cimke info">Jóváhagyva, fizetendő</span>;
  }
  if (p.calcStatus === 'becsles') return <span className="cimke">Becslés</span>;
  return <span className="halvany kicsi">{CALC_LABEL[p.calcStatus]}</span>;
}

function Idoszak({ p, c, alapLevel }: { p: AccTaxPeriod; c: FulProps['c']; alapLevel: string }) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const { konyvelo } = useAuth();
  const calc = p.latestCalculation;
  const r = (calc?.result ?? null) as QuarterResult | null;
  const jovahagyva = p.calcStatus === 'jovahagyva';
  const km = r ? keziModositas(p, r) : null;
  const [ujranyit, setUjranyit] = useState(false);
  const [levelJavit, setLevelJavit] = useState(false);
  const inv = () => {
    void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
  };
  const szamol = useMutation({ mutationFn: () => ep.accCalculate(c.id, p.periodKey, t), onSuccess: () => { pir.ok('Újraszámoltam a mai napig beérkezett bevételekből.'); inv(); }, onError: pir.hiba });
  const nyit = useMutation({ mutationFn: (reason: string) => ep.accReopen(p.id, reason), onSuccess: () => { pir.ok(`Újranyitottad. ${c.firstName} értesítést kapott.`); setUjranyit(false); inv(); }, onError: pir.hiba });
  const levelMent = useMutation({ mutationFn: (text: string) => ep.accUpdateLetter(p.id, text), onSuccess: () => { pir.ok(`Javítottad a levelet. ${c.firstName} értesítést kapott, az összeg nem változott.`); setLevelJavit(false); inv(); }, onError: pir.hiba });

  if (!calc || !r)
    return (
      <div className="lap" style={{ marginTop: 16 }}>
        <Ures
          n="ures_mappa"
          cim={`${nagybetu(negyedevNev(p.periodKey))}: még nincs számolás`}
          gombok={
            <button className="gomb-e" disabled={szamol.isPending} onClick={() => szamol.mutate()}>
              Számolás most
            </button>
          }
        >
          A motor a kiállított számlákból és a kézi tételekből számol, a 2026-os átalányadó-szabályokkal.
        </Ures>
      </div>
    );
  return (
    <>
      <div className="racs fo-mellek ado-racs" style={{ marginTop: 16 }}>
        <div>
          <Szamolas p={p} r={r} km={km} />
          <div className="lap" style={{ marginTop: 16 }}>
            <div className="lap-fej">
              <I3 n="szamolo" s={36} />
              <div>
                <h2>„Hogyan jött ki?”</h2>
                <div className="megj">Szóról szóra ezt látja {c.firstName}, ha rákattint.</div>
              </div>
            </div>
            <div className="belso magyarazat" style={{ paddingTop: 0 }}>
              <p className="bev">{r.explanation.intro}</p>
              {r.explanation.lines.map((l, i) =>
                l.kind === 'cim' ? (
                  <div className="sor cim" key={i}>
                    <span>{l.label}</span>
                    {l.side && <span className="halvany">{l.side}</span>}
                  </div>
                ) : l.kind === 'megjegyzes' ? (
                  <div className="sor megjegyzes" key={i}>
                    <span>{l.label}</span>
                  </div>
                ) : (
                  <div className={`sor${l.kind === 'ado' ? ' ado' : ''}`} key={i}>
                    <span>
                      {l.op && <span className="op">{l.op}</span>}
                      {l.label}
                      {l.note && <span className="halvany kicsi"> · {l.note}</span>}
                      {km && l.kind === 'ado' && adoFajta(l.label) && l.amountHuf !== km.veg[adoFajta(l.label)!] && <span className="modositas-jel">A könyvelőd módosította.</span>}
                    </span>
                    {l.amountHuf !== undefined &&
                      (km && l.kind === 'ado' && adoFajta(l.label) ? (
                        <span className="nt">
                          <Modositott eredeti={l.amountHuf} uj={km.veg[adoFajta(l.label)!]} />
                        </span>
                      ) : (
                        <Ft n={l.amountHuf} />
                      ))}
                  </div>
                ),
              )}
              {km && (
                // the same closing the client's "Hogyan jött ki?" sheet shows after a manual change
                <div className="uzenet-sav figyel" style={{ marginTop: 10 }}>
                  <div>
                    <b>A könyvelőd kézzel módosította az összeget: „{km.reason}”.</b> Az áthúzott szám a számítás, mellette az, amit fizetned kell.
                  </div>
                </div>
              )}
              <div className="sor eredmeny">
                <span>{km ? `Összesen: ${ft(km.total)}` : r.explanation.result}</span>
              </div>
              {!jovahagyva && <p className="halvany kicsi" style={{ marginTop: 8 }}>Becslés. A végleges összeget a könyvelőd hagyja jóvá.</p>}
            </div>
          </div>
        </div>
        <div>
          {jovahagyva ? <Jovahagyott p={p} c={c} /> : <Jovahagyas p={p} r={r} c={c} alapLevel={alapLevel} alairas={konyvelo?.signatureSvgPath ?? null} alairo={konyvelo?.displayName ?? ''} />}
          <div className="gombsor" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            {!jovahagyva && (
              <button className="gomb-sz" disabled={szamol.isPending} onClick={() => szamol.mutate()}>
                {szamol.isPending ? 'Számolok…' : 'Újraszámolom a mai napig'}
              </button>
            )}
            {jovahagyva && p.letter && (
              <button className="gomb-sz" onClick={() => setLevelJavit(true)}>
                Levél javítása
              </button>
            )}
            {jovahagyva && p.filingStatus === 'nincs' && (
              <button className="gomb-v" onClick={() => setUjranyit(true)}>
                Újranyitom (rossz lett az összeg)
              </button>
            )}
          </div>
        </div>
      </div>
      {jovahagyva && <Beadas p={p} c={c} />}
      <MegjegyzesFiok
        nyitva={levelJavit}
        cim="A levél javítása"
        bev={`Csak a szöveg változik, az összeg és az utalási adatok maradnak. ${c.firstName} egy rövid értesítést kap: „pontosította a levelét”.`}
        gomb="Elmentem a javított levelet"
        kezdo={p.letter?.body ?? ''}
        hossz={2000}
        bezar={() => setLevelJavit(false)}
        kuld={(text) => levelMent.mutate(text)}
        folyamatban={levelMent.isPending}
      />
      <MegjegyzesFiok
        nyitva={ujranyit}
        cim="Miért nyitod újra?"
        bev={`A fizetendő visszaáll becslésre, ${c.firstName} értesítést kap: „Módosítottam a fizetendőt”. Az okot a naplóba írjuk.`}
        gomb="Újranyitom"
        bezar={() => setUjranyit(false)}
        kuld={(reason) => nyit.mutate(reason)}
        folyamatban={nyit.isPending}
      />
    </>
  );
}

function Szamolas({ p, r, km }: { p: AccTaxPeriod; r: QuarterResult; km: KeziModositas | null }) {
  const calc = p.latestCalculation!;
  return (
    <div className="lap">
      <div className="lap-fej" style={{ display: 'block' }}>
        <h2>{nagybetu(negyedevNev(p.periodKey))}</h2>
        <div className="megj" style={{ marginTop: 2 }}>
          {r.complete ? 'Lezárult negyedév' : `A ${datumIg(calc.asOf)} beérkezett bevételekből`} · motor {calc.engineVersion}, szabályok {calc.rulesVersion}
        </div>
      </div>
      {r.months?.length ? (
        <table className="tabla tomor">
          <thead>
            <tr>
              <th className="elso">Hónap</th>
              <th className="jobb">Bevétel</th>
              <th className="jobb">Jövedelem</th>
              <th className="jobb">Járulékalap</th>
              <th className="jobb">TB 18,5%</th>
              <th className="jobb utolso">Szocho 13%</th>
            </tr>
          </thead>
          <tbody>
            {r.months.map((m) => (
              <tr key={m.month}>
                <td className="elso">{nagybetu(HONAPOK[m.month - 1]!)}</td>
                <td className="jobb">
                  <Ft n={m.revenueHuf} />
                </td>
                <td className="jobb">
                  <Ft n={m.incomeHuf} />
                </td>
                <td className="jobb">
                  {m.insured ? <Ft n={m.baseHuf} /> : <span className="halvany">nem biztosított</span>}
                  {m.minimumHuf !== null && m.insured && m.baseHuf === m.minimumHuf && <div className="al">minimum</div>}
                </td>
                <td className="jobb">
                  <Ft n={m.tbHuf} />
                </td>
                <td className="jobb utolso">
                  <Ft n={m.szochoHuf} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="elso">Negyedév</td>
              <td className="jobb">
                <Ft n={r.revenueHuf} />
              </td>
              <td className="jobb">
                <Ft n={r.incomeHuf} />
              </td>
              <td />
              <td className="jobb">
                <Ft n={r.tbHuf} />
              </td>
              <td className="jobb utolso">
                <Ft n={r.szochoHuf} />
              </td>
            </tr>
            {km && (km.veg.tb_jarulek !== r.tbHuf || km.veg.szocho !== r.szochoHuf) && (
              <tr>
                <td className="elso" colSpan={4}>
                  Kézzel módosítva, ennyit fizet
                </td>
                <td className="jobb">
                  <Ft n={km.veg.tb_jarulek} />
                </td>
                <td className="jobb utolso">
                  <Ft n={km.veg.szocho} />
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      ) : null}
      <div className="belso" style={{ borderTop: '1px solid var(--hajszal)' }}>
        <dl className="adatok" style={{ gridTemplateColumns: '1fr auto' }}>
          <dt>Jövedelem év eleje óta</dt>
          <dd className="jobb">
            <Ft n={r.incomeYtdHuf} />
          </dd>
          <dt>Adóköteles rész év eleje óta (1 936 800 Ft fölött)</dt>
          <dd>
            <Ft n={r.taxableYtdHuf} />
          </dd>
          <dt>SZJA-előleg most (15%, a korábbiak nélkül)</dt>
          <dd>
            {km ? <Modositott eredeti={r.szjaAdvanceHuf} uj={km.veg.szja_eloleg} /> : <Ft n={r.szjaAdvanceHuf} />}
          </dd>
          <dt className="felkover" style={{ color: 'var(--tinta)' }}>
            Fizetendő összesen
          </dt>
          <dd className="felkover" style={{ fontSize: 17 }}>
            {km ? <Modositott eredeti={r.totalHuf} uj={km.total} /> : <Ft n={r.totalHuf} />}
          </dd>
          {km && (
            <>
              <dt>Kézi módosítás oka</dt>
              <dd>
                „{km.reason}” <span className="cimke" style={{ marginLeft: 4 }}>az ügyfél is látja</span>
              </dd>
            </>
          )}
        </dl>
        {r.warnings.length > 0 && (
          <div className="oszlop" style={{ gap: 8, marginTop: 14 }}>
            {r.warnings.map((w) => (
              <div key={w.code} className="uzenet-sav figyel">
                <div style={{ flex: 1 }}>{w.text}</div>
                {w.audience === 'ugyfel' && <span className="cimke" style={{ flex: 'none' }}>az ügyfél is látja</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LEJART_MONDAT = 'A határidő már lejárt, ezért kérlek, utald el mielőbb.';

/** 1 → "Egy utalás a NAV-nak", 2 → "Két külön utalás …, két számlaszámra", 3 → "Három …". */
export function utalasMondat(n: number): string {
  if (n <= 1) return 'Egy utalás a NAV-nak, egy számlaszámra';
  const szo = ['', 'egy', 'két', 'három', 'négy'][n] ?? String(n);
  return `${nagybetu(szo)} külön utalás a NAV-nak, ${szo} számlaszámra`;
}

function Jovahagyas({ p, r, c, alapLevel, alairas, alairo }: { p: AccTaxPeriod; r: QuarterResult; c: FulProps['c']; alapLevel: string; alairas: string | null; alairo: string }) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  // Futó negyedévnél nem írhatjuk, hogy „ez már a végleges összeg”.
  const [level, setLevel] = useState(
    p.latestCalculation?.letterText ??
      (r.complete ? alapLevel : 'Az eddigi bevételeid alapján kiszámoltam, mennyit kell most befizetned. Ha a negyedév végéig lesz még bevételed, újraszámolom, és szólok.'),
  );
  const [mod, setMod] = useState(false);
  const [ov, setOv] = useState({ tb: '', szocho: '', szja: '', reason: '' });
  const [megerosit, setMegerosit] = useState(false);
  const tb = mod && ov.tb.trim() ? parseFt(ov.tb) : r.tbHuf;
  const szocho = mod && ov.szocho.trim() ? parseFt(ov.szocho) : r.szochoHuf;
  const szja = mod && ov.szja.trim() ? parseFt(ov.szja) : r.szjaAdvanceHuf;
  const ervenyes = tb !== null && szocho !== null && szja !== null && (tb ?? 0) >= 0 && (szocho ?? 0) >= 0 && (szja ?? 0) >= 0;
  const valtozott = mod && (tb !== r.tbHuf || szocho !== r.szochoHuf || szja !== r.szjaAdvanceHuf);
  const total = (tb ?? 0) + (szocho ?? 0) + (szja ?? 0);
  const kesz = ervenyes && level.trim().length > 0 && (!valtozott || ov.reason.trim().length >= 5);
  const jova = useMutation({
    mutationFn: () =>
      ep.accApprove(p.latestCalculation!.id, {
        letterText: level.trim(),
        overrides: valtozott ? { tbHuf: tb!, szochoHuf: szocho!, szjaAdvanceHuf: szja!, reason: ov.reason.trim() } : undefined,
      }),
    onSuccess: () => {
      pir.ok(`Elküldve. ${c.firstName} most látja: ${ft(total)}.`);
      setMegerosit(false);
      void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    },
    onError: pir.hiba,
  });
  const d = napKulonbseg(p.dueDate, t);
  const tetelek = [
    { kind: 'tb', label: 'TB-járulék', sub: undefined as string | undefined, n: tb ?? 0 },
    { kind: 'szocho', label: 'Szocho', sub: 'szociális hozzájárulási adó', n: szocho ?? 0 },
    { kind: 'szja', label: 'SZJA-előleg', sub: rovidNev(p), n: szja ?? 0 },
  ].filter((x) => x.n > 0);
  return (
    <div className="lap" style={{ overflow: 'hidden' }}>
      <div className="fejlec" style={{ padding: '20px 22px 18px', ['--roz-r' as string]: '-120px' } as React.CSSProperties}>
        <div className="felcim">Így látja {c.firstName} a főoldalon, ha jóváhagyod</div>
        <div className="nagyszam" style={{ marginTop: 8 }}>
          <NagyFt n={total} />
        </div>
        <div className="mellek" style={{ color: '#fff' }}>
          {hataridoMondat(p.dueDate)}{' '}
          {d >= 0 && d <= 14 && <span className="cimke ido">{hatridoSzoveg(p.dueDate, t)}</span>}
        </div>
      </div>
      <div className="belso" style={{ background: 'var(--alap)' }}>
        <Level megszolitas={`Kedves ${c.firstName}!`} szoveg={level || ' '} alairo={alairo} datumIso={t} alairas={alairas} />
        <div className="lap fizetendo" style={{ marginTop: 12, padding: '14px 18px' }}>
          <div className="halvany" style={{ fontSize: 14.5, marginBottom: 2 }}>
            {utalasMondat(tetelek.length)}
          </div>
          {tetelek.map((x) => (
            <div className="tetel" key={x.kind}>
              <span>
                {x.label}
                {x.sub && <div className="al">{x.sub}</div>}
              </span>
              <span className="osszeg">
                {szam(x.n)}
                <span className="ft">Ft</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="belso">
        <label className="mezo">
          <span className="felirat">A leveled</span>
          <textarea className="doboz" rows={4} maxLength={1200} value={level} onChange={(e) => setLevel(e.target.value)} />
          <span className="sugo">Rövid, egyszerű mondatok. A megszólítást és az aláírásodat mi tesszük hozzá.</span>
        </label>
        <label className="jelolo" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={mod} onChange={(e) => setMod(e.target.checked)} />
          <span>Kézzel módosítom az összeget</span>
        </label>
        {mod && (
          <div style={{ marginTop: 10 }}>
            <div className="mezosor k3">
              <label className="mezo">
                <span className="felirat">TB-járulék</span>
                <input className="doboz szam" value={ov.tb} placeholder={szam(r.tbHuf)} onChange={(e) => setOv({ ...ov, tb: e.target.value })} />
              </label>
              <label className="mezo">
                <span className="felirat">Szocho</span>
                <input className="doboz szam" value={ov.szocho} placeholder={szam(r.szochoHuf)} onChange={(e) => setOv({ ...ov, szocho: e.target.value })} />
              </label>
              <label className="mezo">
                <span className="felirat">SZJA-előleg</span>
                <input className="doboz szam" value={ov.szja} placeholder={szam(r.szjaAdvanceHuf)} onChange={(e) => setOv({ ...ov, szja: e.target.value })} />
              </label>
            </div>
            {!ervenyes && <div className="hiba-szoveg" style={{ color: 'var(--veszely)', marginTop: 6 }}>Egész forintot írj (nem lehet negatív).</div>}
            <label className="mezo" style={{ marginTop: 12 }}>
              <span className="felirat">Miért módosítod? (kötelező – {c.firstName} is látja)</span>
              <input className="doboz" value={ov.reason} maxLength={200} onChange={(e) => setOv({ ...ov, reason: e.target.value })} placeholder="Pl. decemberi táppénz, kieső napok" />
              <span className="sugo">Egy rövid, érthető mondat: a „Hogyan jött ki?” lapon a módosított összeg mellett olvassa. A naplóba is bekerül.</span>
            </label>
          </div>
        )}
        {!r.complete && (
          <div className="uzenet-sav figyel" style={{ marginTop: 14 }}>
            A negyedév még nem zárult le. Ha most jóváhagyod, a későbbi bevételek nem kerülnek bele – ilyenkor újra kell nyitnod.
          </div>
        )}
        <div className="gombsor" style={{ marginTop: 16 }}>
          <button
            className="gomb-e"
            disabled={!kesz || c.lifecycle === 'bekotes_alatt' || !!c.serviceLock}
            title={c.serviceLock ? LOCK_TEXTS.panelDisabled : c.lifecycle === 'bekotes_alatt' ? 'A bekötés után hagyhatod jóvá.' : undefined}
            onClick={() => setMegerosit(true)}
          >
            Jóváhagyom és elküldöm
          </button>
          {c.lifecycle === 'bekotes_alatt' && <span className="sugo" style={{ margin: 0 }}>A bekötés után hagyhatod jóvá.</span>}
        </div>
      </div>
      <Fiok
        nyitva={megerosit}
        bezar={() => setMegerosit(false)}
        ikon="boritek"
        cim={`Elküldöd ${c.firstName} részére?`}
        bev="A jóváhagyás után azonnal megjelenik nála a főoldalon, és értesítést kap telefonra és e-mailben."
        lab={
          <>
            <button className="gomb-e" disabled={jova.isPending} onClick={() => jova.mutate()}>
              {jova.isPending ? 'Küldöm…' : 'Igen, jóváhagyom és elküldöm'}
            </button>
            <button className="gomb-sz" onClick={() => setMegerosit(false)}>
              Még nem
            </button>
          </>
        }
      >
        {d < 0 && (
          <div className="uzenet-sav hiba" style={{ marginBottom: 14, alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
            <div>
              <b>A befizetési határidő {-d} napja lejárt</b> ({datum(p.dueDate)}). {c.firstName} késedelmi pótlékot fizethet, ezért a levélben ne a
              lejárt dátumot kérd, hanem hogy mielőbb utalja el.
            </div>
            {!level.includes(LEJART_MONDAT) && (
              <button type="button" className="gomb-sz" onClick={() => setLevel((l) => `${l.trim()}

${LEJART_MONDAT}`)}>
                Beleírom a levélbe: „{LEJART_MONDAT}”
              </button>
            )}
          </div>
        )}
        <dl className="adatok">
          <dt>Időszak</dt>
          <dd>{nagybetu(negyedevNev(p.periodKey))}</dd>
          <dt>Fizetendő</dt>
          <dd className="felkover">{ft(total)}</dd>
          <dt>Határidő</dt>
          <dd>
            {datum(p.dueDate, { ev: true, nap: true })}
            {d < 0 && <span className="cimke hiba" style={{ marginLeft: 8 }}>lejárt</span>}
          </dd>
          {valtozott && (
            <>
              <dt>Kézi módosítás</dt>
              <dd>
                {ft(r.totalHuf)} helyett, mert: „{ov.reason.trim()}” <span className="halvany">(ezt {c.firstName} is látja)</span>
              </dd>
            </>
          )}
        </dl>
      </Fiok>
    </div>
  );
}

function Jovahagyott({ p, c }: { p: AccTaxPeriod; c: FulProps['c'] }) {
  const t = today();
  const alairas = useAuth().konyvelo?.signatureSvgPath ?? null;
  const qc = useQueryClient();
  const pir = usePirito();
  const [elteres, setElteres] = useState<string | null>(null);
  const [elteroTetelek, setElteroTetelek] = useState<Set<string>>(new Set());
  const [elteresMegj, setElteresMegj] = useState('');
  const ell = useMutation({
    mutationFn: (x: { kinds: string[]; verification: 'rendben' | 'elteres'; note?: string }) =>
      ep.accVerifyPayment(p.id, x.kinds.map((k) => ({ kind: k as never, verification: x.verification, note: x.note }))),
    onSuccess: (_d, x) => {
      // What is still open after this click decides the message (never "látja, hogy ellenőrizted" while a mismatch stands).
      const maradElteres = p.items.some((i) => i.verification === 'elteres' && !x.kinds.includes(i.kind));
      const maradJelolt = p.items.some((i) => i.markedPaidAt && !i.verifiedAt && !x.kinds.includes(i.kind));
      pir.ok(
        x.verification === 'elteres'
          ? `Jeleztük ${c.firstName} felé az eltérést.`
          : maradElteres
            ? 'Rendben, feljegyeztem. A másik tételnél az eltérés még nyitva van.'
            : maradJelolt
              ? 'Rendben, feljegyeztem. Még van ellenőrizni való tétel.'
              : `Rendben. ${c.firstName} látja, hogy ellenőrizted.`,
      );
      setElteres(null);
      void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    },
    onError: pir.hiba,
  });
  const total = p.items.reduce((a, i) => a + i.amountHuf, 0);
  const jelolt = p.items.filter((i) => i.markedPaidAt && !i.verifiedAt);
  // Items marked "Eltérés": once the client has paid the difference they must be closable (no dead end).
  const elterok = p.items.filter((i) => i.verification === 'elteres');
  return (
    <div className="lap">
      <div className="lap-fej">
        <I3 n="befizetve" s={36} />
        <div>
          <h2>
            Jóváhagyva: <Ft n={total} />
          </h2>
          <div className="megj">
            {PAYMENT_STATUS_LABEL[p.paymentStatus]} · határidő {datum(p.dueDate)}
          </div>
        </div>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {p.letter && (
          <div style={{ background: 'var(--alap)', padding: 14, borderRadius: 14, marginBottom: 14 }}>
            <Level megszolitas={p.letter.greeting} szoveg={p.letter.body} alairo={p.letter.signedBy} szerep={p.letter.signedRole} datumIso={p.letter.date} alairas={alairas} />
          </div>
        )}
        <table className="tabla">
          <thead>
            <tr>
              <th>Tétel</th>
              <th className="jobb">Összeg</th>
              <th>Befizetés</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.label}
                  <div className="al">{i.accountNumber}</div>
                </td>
                <td className="jobb">
                  <Ft n={i.amountHuf} />
                </td>
                <td>
                  {i.verifiedAt ? (
                    i.verification === 'elteres' ? (
                      <span className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <span className="cimke hiba">Eltérés</span>
                        <button className="gomb-sz" disabled={ell.isPending} onClick={() => ell.mutate({ kinds: [i.kind], verification: 'rendben' })}>
                          Rendben, pótolta
                        </button>
                      </span>
                    ) : (
                      <span className="allapot"><I3 n="befizetve_jel" s={18} /><span className="szo">Ellenőrizve</span></span>
                    )
                  ) : i.markedPaidAt ? (
                    <span>
                      <span className="szo felkover">Befizette</span>
                      <span className="halvany">, {datum(i.markedPaidOn ?? i.markedPaidAt.slice(0, 10))}</span>
                    </span>
                  ) : (
                    <span className="halvany">{napKulonbseg(i.dueDate, t) < 0 ? 'Lejárt, nem jelezte' : 'Még nem jelezte'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {elterok.length > 0 && (
          <div className="uzenet-sav hiba gombos" style={{ marginTop: 14 }}>
            <div>
              <b>Eltérést jeleztél{elterok.length === 1 ? `: ${elterok[0]!.label}` : ` ${elterok.length} tételnél`}.</b> Ha {c.firstName} pótolta, és látod a kivonatán vagy az adószámláján, zárd le – addig a negyedév „Eltérés” marad nála és a határidő-figyelőben is.
            </div>
            <button className="gomb-m kicsi csak-szoveg" disabled={ell.isPending} onClick={() => ell.mutate({ kinds: elterok.map((i) => i.kind), verification: 'rendben' })}>
              Rendben, pótolta
            </button>
          </div>
        )}
        {jelolt.length > 0 && (
          <div className="uzenet-sav figyel gombos" style={{ marginTop: 14 }}>
            <div>{c.firstName} jelezte, hogy befizette. Nézd meg a kivonatán vagy az adószámláján.</div>
            <button className="gomb-m kicsi csak-szoveg" disabled={ell.isPending} onClick={() => ell.mutate({ kinds: jelolt.map((i) => i.kind), verification: 'rendben' })}>
              Rendben, láttam
            </button>
            <button
              className="gomb-sz"
              onClick={() => {
                setElteroTetelek(new Set(jelolt.length === 1 ? [jelolt[0]!.kind] : []));
                setElteresMegj('');
                setElteres('x');
              }}
            >
              Eltérés van
            </button>
          </div>
        )}
      </div>
      <Fiok
        nyitva={!!elteres}
        cim="Mi az eltérés?"
        bev={`Jelöld be, melyik utalással van gond: csak azok lesznek „Eltérés” állapotúak, a többit külön jelölheted rendben lévőnek. ${c.firstName} egy kérést kap a szöveggel.`}
        bezar={() => setElteres(null)}
        lab={
          <button
            className="gomb-e"
            disabled={elteroTetelek.size === 0 || !elteresMegj.trim() || ell.isPending}
            onClick={() => ell.mutate({ kinds: [...elteroTetelek], verification: 'elteres', note: elteresMegj.trim() })}
          >
            {ell.isPending ? 'Küldöm…' : 'Elküldöm'}
          </button>
        }
      >
        <div className="mezo">
          <span className="felirat">Melyik utalással van eltérés?</span>
          <div className="oszlop" style={{ gap: 10 }}>
            {jelolt.map((i) => (
              <label key={i.kind} className="jelolo">
                <input
                  type="checkbox"
                  checked={elteroTetelek.has(i.kind)}
                  onChange={(e) => {
                    const uj = new Set(elteroTetelek);
                    if (e.target.checked) uj.add(i.kind);
                    else uj.delete(i.kind);
                    setElteroTetelek(uj);
                  }}
                />
                <span>
                  {i.label}: <Ft n={i.amountHuf} />
                  <span className="sugo" style={{ marginTop: 0 }}>
                    befizette {datum(i.markedPaidOn ?? i.markedPaidAt!.slice(0, 10))}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className="mezo" style={{ marginTop: 16 }}>
          <span className="felirat">Mit írjunk {c.firstName} részére?</span>
          <textarea
            className="doboz"
            rows={5}
            maxLength={1000}
            value={elteresMegj}
            placeholder="Pl. „A szochót 79 560 Ft helyett 75 960 Ft-tal utaltad, a különbséget pótold.”"
            onChange={(e) => setElteresMegj(e.target.value)}
          />
        </label>
      </Fiok>
    </div>
  );
}

function FajlHely({ cim, al, fajl, setFajl }: { cim: string; al: string; fajl: File | null; setFajl: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [aktiv, setAktiv] = useState(false);
  const hiba = fajl ? fajlHiba(fajl) : null;
  return (
    <div
      className={`ejtozona${aktiv ? ' aktiv' : ''}`}
      style={{ justifyContent: 'flex-start', textAlign: 'left' }}
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setAktiv(true);
      }}
      onDragLeave={() => setAktiv(false)}
      onDrop={(e) => {
        e.preventDefault();
        setAktiv(false);
        setFajl(e.dataTransfer.files[0] ?? null);
      }}
    >
      <I3 n={fajl ? 'irat' : 'feltoltes'} s={44} />
      <span style={{ color: fajl ? 'var(--tinta)' : undefined }}>
        {fajl ? fajl.name : cim}
        <span className="al" style={hiba ? { color: 'var(--veszely)' } : undefined}>
          {hiba ?? (fajl ? 'Kattints, ha másikat választanál.' : al)}
        </span>
      </span>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
    </div>
  );
}

function Beadas({ p, c }: { p: AccTaxPeriod; c: FulProps['c'] }) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const [bevallas, setBevallas] = useState<File | null>(null);
  const [nyugta, setNyugta] = useState<File | null>(null);
  const [nap, setNap] = useState(t);
  const [halad, setHalad] = useState<string | null>(null);
  const [megerosit, setMegerosit] = useState(false);
  useEffect(() => {
    setBevallas(null);
    setNyugta(null);
    setMegerosit(false);
  }, [p.id]);
  const nev = useMemo(() => nagybetu(negyedevNev(p.periodKey).replace(/^\d{4}\.\s/, '')), [p.periodKey]);
  const beadva = useMutation({
    mutationFn: async () => {
      const honap = nap.slice(0, 7);
      setHalad('A bevallást töltöm fel…');
      const d1 = await ep.accUploadDocument(c.id, [bevallas!], { category: 'bevallas', dossierMonth: honap, title: `Bevallás ${nevelo(nev)} ${nev.replace('negyedév', 'negyedévről')}`, visibility: 'kozos', status: 'beadva' });
      setHalad('A NAV-visszaigazolást töltöm fel…');
      const d2 = await ep.accUploadDocument(c.id, [nyugta!], { category: 'nav_visszaigazolas', dossierMonth: honap, title: `NAV-visszaigazolás, ${nev}`, visibility: 'kozos', status: 'beadva' });
      setHalad('Beadottnak jelölöm…');
      return ep.accMarkFiled(p.id, {
        filedOn: nap,
        form: jarulekNyomtatvany(Number(p.periodKey.slice(0, 4))),
        returnDocumentId: d1.id,
        receiptDocumentId: d2.id,
        returnFileId: d1.versions?.[0]?.fileId,
        receiptFileId: d2.versions?.[0]?.fileId,
      });
    },
    onSuccess: () => {
      setHalad(null);
      setMegerosit(false);
      pir.ok(`Beadva. ${c.firstName} azonnal látja a bevallást és a visszaigazolást.`);
      void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'dossier', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    },
    onError: (e) => {
      setHalad(null);
      setMegerosit(false);
      pir.hiba(e);
    },
  });
  if (p.filingStatus === 'beadva' && p.filed)
    return (
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <I3 n="bevallas" s={36} />
          <div>
            <h2>Beadva {datum(p.filed.filedOn)}</h2>
            <div className="megj">{szamRag(p.filed.form)} bevallás. {c.firstName} látja a dossziéban.</div>
          </div>
        </div>
        {p.filed.documents.map((d) => (
          <div className="ikonsor" key={d.id}>
            <I3 n={d.category === 'bevallas' ? 'bevallas' : 'irat'} s={44} />
            <div className="l">
              <div className="cim">{d.title}</div>
            </div>
            {(d as { fileId?: string }).fileId && (
              <button className="gomb-m kicsi csak-szoveg" onClick={() => void ep.fileLink((d as { fileId?: string }).fileId!).then((r) => window.open(r.url, '_blank', 'noopener')).catch(pir.hiba)}>
                Megnyitom
              </button>
            )}
          </div>
        ))}
      </div>
    );
  const f = p.filing ?? null;
  const elsoNap = f ? kovNap(f.periodEnd) : undefined;
  const napHiba = !nap ? 'Add meg a beadás napját.' : nap > t ? 'Jövőbeli napot nem adhatsz meg.' : elsoNap && nap < elsoNap ? 'A beadás napja az időszak vége utáni nap lehet.' : null;
  const kesz = bevallas && nyugta && !fajlHiba(bevallas) && !fajlHiba(nyugta) && !napHiba && (f ? f.canFile : true);
  if (f && !f.canFile)
    return (
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <I3 n="bevallas" s={36} />
          <div>
            <h2>Beadás később</h2>
            <div className="megj">{f.reason}</div>
          </div>
        </div>
      </div>
    );
  return (
    <div className="lap" style={{ marginTop: 16 }}>
      <div className="lap-fej">
        <I3 n="bevallas" s={36} />
        <div>
          <h2>Beadtad a NAV-nak?</h2>
          <div className="megj">Töltsd fel a {szamRag(jarulekNyomtatvany(Number(p.periodKey.slice(0, 4))))} bevallást és a NAV visszaigazolását. {c.firstName} azonnal látja, és a negyedév iratai „Beadva” állapotba kerülnek.</div>
        </div>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        <div className="racs k2">
          <FajlHely cim={`Bevallás (${jarulekNyomtatvany(Number(p.periodKey.slice(0, 4)))}) PDF`} al="Az ÁNYK / ONYA-ból mentett PDF" fajl={bevallas} setFajl={setBevallas} />
          <FajlHely cim="NAV-visszaigazolás" al="Az érkeztetési visszaigazolás (PDF vagy kép)" fajl={nyugta} setFajl={setNyugta} />
        </div>
        <div className="sor-flex" style={{ marginTop: 14, alignItems: 'flex-end' }}>
          <label className="mezo" style={{ width: 200 }}>
            <span className="felirat">Beadás napja</span>
            <input className={napHiba && nap ? 'doboz hibas' : 'doboz'} type="date" value={nap} min={elsoNap} max={t} onChange={(e) => setNap(e.target.value)} />
            {napHiba && nap && <span className="hiba-szoveg">{napHiba}</span>}
          </label>
          <button className="gomb-e" disabled={!kesz || beadva.isPending || !!c.serviceLock} title={c.serviceLock ? LOCK_TEXTS.panelDisabled : undefined} onClick={() => setMegerosit(true)}>
            {halad ?? 'Beadottnak jelölöm'}
          </button>
        </div>
        {f && f.openDocuments > 0 && (
          <div className="uzenet-sav figyel" style={{ marginTop: 12 }}>
            A negyedévben még {f.openDocuments} irat nincs feldolgozva (Feltöltve vagy {c.firstName} látta). Nézd át őket a dossziéban, mielőtt beadottnak jelölöd.
          </div>
        )}
      </div>
      <Fiok
        nyitva={megerosit}
        bezar={() => !beadva.isPending && setMegerosit(false)}
        ikon="bevallas"
        cim={`Beadottnak jelölöd ${c.lastName} ${c.firstName} bevallását?`}
        bev="Ezt utólag nem lehet visszavonni: a bevallás javítása a NAV-nál önellenőrzéssel megy. Az ügyfél azonnal értesítést kap."
        lab={
          <>
            <button className="gomb-e" disabled={beadva.isPending} onClick={() => beadva.mutate()}>
              {halad ?? 'Igen, beadottnak jelölöm'}
            </button>
            <button className="gomb-sz" disabled={beadva.isPending} onClick={() => setMegerosit(false)}>
              Még nem
            </button>
          </>
        }
      >
        <dl className="adatok">
          <dt>Ügyfél</dt>
          <dd>
            {c.lastName} {c.firstName}
          </dd>
          <dt>Időszak</dt>
          <dd>{nagybetu(negyedevNev(p.periodKey))}</dd>
          <dt>Beadás napja</dt>
          <dd>{datum(nap, { ev: true, nap: true })}</dd>
          <dt>Fájlok</dt>
          <dd>
            {bevallas?.name}
            <br />
            {nyugta?.name}
          </dd>
          {f && f.openDocuments > 0 && (
            <>
              <dt>Figyelem</dt>
              <dd>{f.openDocuments} irat még nincs feldolgozva ebben a negyedévben.</dd>
            </>
          )}
        </dl>
      </Fiok>
    </div>
  );
}

/** "2658-as", "2501-es", "2565-ös", "2556-os": the -s suffix follows how the last number word is said. */
export function szamRag(szam: string): string {
  const s = szam.trim();
  const utolso = s.slice(-1);
  if (!/\d/.test(utolso)) return `${s}-es`;
  const tizes = /\d/.test(s.slice(-2, -1)) ? s.slice(-2, -1) : '0';
  const EGYES: Record<string, string> = { '1': 'es', '2': 'es', '3': 'as', '4': 'es', '5': 'ös', '6': 'os', '7': 'es', '8': 'as', '9': 'es' };
  const TIZES: Record<string, string> = { '1': 'es', '2': 'as', '3': 'as', '4': 'es', '5': 'es', '6': 'as', '7': 'es', '8': 'as', '9': 'es', '0': 'as' };
  return `${s}-${utolso === '0' ? TIZES[tizes] : EGYES[utolso]}`;
}

/** ÉÉÉÉ-HH-NN + 1 nap. */
function kovNap(d: string): string {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
