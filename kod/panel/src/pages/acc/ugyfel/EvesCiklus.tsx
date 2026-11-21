// SPEC §32.B – the annual-cycle cards of the Éves zárás tab: "Összegek" (the numbers from the return; the app's estimate
// only for comparison), "Beadtam" (date, NAV iktatószám, the return and the NAV receipt; without the client's approval only
// with the recorded phone agreement), "Különbözet / Visszajáró" (the payment's check or the refund: megérkezett /
// beszámítva / átvezetve), "Iparűzési adó (éves)", the manual close and the manual open of a former client's last year.
// The app never files and never pays.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { AccAnnualView, AccClientDetail } from '../../../api/types';
import { EVES_PANEL_TEXTS as P, type AnnualAmountsInput, type AnnualOtherLine } from '../../../_shared/eves';
import { evesKulonbozet, motorElteres } from '../../../lib/eves';
import { datum, ft, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => (v[k] !== undefined ? String(v[k]) : `{${k}}`));
const szamE = (s: string): number | null => {
  const t = s.replace(/[\s.]/g, '').replace('−', '-');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const szovegE = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

type Props = { c: AccClientDetail; a: AccAnnualView; frissit: (r: AccAnnualView) => void; zarolt: string | null };

function Mezo({ cim, ertek, set, sugo, disabled }: { cim: string; ertek: string; set: (v: string) => void; sugo?: string; disabled?: boolean }) {
  return (
    <label className="oszlop" style={{ gap: 4 }}>
      <span className="felirat">{cim}</span>
      <input className="doboz szam" inputMode="numeric" value={ertek} disabled={disabled} onChange={(e) => set(e.target.value)} />
      {sugo && <span className="sugo">{sugo}</span>}
    </label>
  );
}

/** "Összegek" – the numbers of the return as the accountant enters them (konyvelonel / jovahagyasra_var). */
export function OsszegekKartya({ c, a, frissit, zarolt }: Props) {
  const pir = usePirito();
  const kata = a.regime === 'kata';
  const kiindulo: Partial<AnnualAmountsInput> = a.amounts ?? a.prefill ?? {};
  const [v, setV] = useState<Record<string, string>>(() => {
    const keys = kata ? ['kataRevenueHuf', 'kataLiableMonths', 'kataLimitHuf', 'kulonadoHuf'] : ['revenueHuf', 'incomeHuf', 'taxFreeHuf', 'allowancesHuf', 'taxableHuf', 'szjaHuf', 'advancesHuf', 'csjkHuf'];
    return Object.fromEntries(keys.map((k) => [k, szovegE(kiindulo[k as keyof AnnualAmountsInput] as number | null | undefined)]));
  });
  const [sorok, setSorok] = useState<AnnualOtherLine[]>(a.amounts?.otherLines ?? []);
  const [indok, setIndok] = useState(a.amounts?.overrideReason ?? '');
  const [level, setLevel] = useState(a.amounts?.letterText ?? '');
  const [egyezik, setEgyezik] = useState(Boolean(a.amounts?.matchesDraft));
  const [visszajaro, setVisszajaro] = useState<'kiutalas' | 'atvezetes'>(a.amounts?.refundMode ?? 'kiutalas');
  const szerk = a.status === 'konyvelonel' || a.status === 'jovahagyasra_var';
  const input: AnnualAmountsInput = {
    ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, szamE(x)])),
    ...(kata ? {} : { otherLines: sorok.filter((s) => s.label.trim()), refundMode: visszajaro }),
    overrideReason: indok.trim() || null,
    letterText: level.trim() || null,
    matchesDraft: egyezik,
  } as AnnualAmountsInput;
  const kul = evesKulonbozet(kata ? 'kata' : 'atalany', input);
  const becsles = a.engineEstimate?.diffHuf;
  const elt = motorElteres(kul, becsles);
  const m = useMutation({
    mutationFn: () => ep.accAnnualAmounts(c.id, a.id, input),
    onSuccess: (r) => {
      frissit(r);
      pir.ok(a.status === 'jovahagyasra_var' ? 'Elmentetted. Az ügyfél jóváhagyása érvénytelen lett, értesítést kapott.' : 'Elmentetted.');
    },
    onError: pir.hiba,
  });
  const set = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const pre = a.prefill ?? {};
  const elotolt = (k: keyof AnnualAmountsInput) => (typeof pre[k] === 'number' ? `Az app: ${ft(pre[k] as number)}` : undefined);
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="szamolo" s={28} />
          <h2>{P.osszegek}</h2>
          <span className={`cimke ${kul > 0 ? 'figyel' : 'info'}`}>{kul > 0 ? `Fizetendő: ${ft(kul)}` : kul < 0 ? `Visszajár: ${ft(-kul)}` : 'Nincs különbözet'}</span>
        </div>
        {(a.warnings ?? []).map((w) => (
          <div key={w} className="uzenet-sav figyel" style={{ marginBottom: 8 }}>
            <div>{w}</div>
          </div>
        ))}
        <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {kata ? (
            <>
              <Mezo cim="Bevétel" ertek={v.kataRevenueHuf!} set={set('kataRevenueHuf')} sugo={elotolt('kataRevenueHuf')} disabled={!szerk} />
              <Mezo cim="Tételes adóval érintett hónapok" ertek={v.kataLiableMonths!} set={set('kataLiableMonths')} sugo={elotolt('kataLiableMonths')} disabled={!szerk} />
              <Mezo cim="Keret" ertek={v.kataLimitHuf!} set={set('kataLimitHuf')} sugo={elotolt('kataLimitHuf')} disabled={!szerk} />
              <Mezo cim="Különadó (40%)" ertek={v.kulonadoHuf!} set={set('kulonadoHuf')} sugo={elotolt('kulonadoHuf')} disabled={!szerk} />
            </>
          ) : (
            <>
              <Mezo cim="Bevétel" ertek={v.revenueHuf!} set={set('revenueHuf')} sugo={elotolt('revenueHuf')} disabled={!szerk} />
              <Mezo cim="Jövedelem" ertek={v.incomeHuf!} set={set('incomeHuf')} sugo={elotolt('incomeHuf')} disabled={!szerk} />
              <Mezo cim="Adómentes rész" ertek={v.taxFreeHuf!} set={set('taxFreeHuf')} disabled={!szerk} />
              <Mezo cim="Kedvezmények" ertek={v.allowancesHuf!} set={set('allowancesHuf')} disabled={!szerk} />
              <Mezo cim="Adóköteles jövedelem" ertek={v.taxableHuf!} set={set('taxableHuf')} sugo={elotolt('taxableHuf')} disabled={!szerk} />
              <Mezo cim="Éves szja (A)" ertek={v.szjaHuf!} set={set('szjaHuf')} sugo={elotolt('szjaHuf')} disabled={!szerk} />
              <Mezo cim="Elszámolt szja-előleg (B)" ertek={v.advancesHuf!} set={set('advancesHuf')} sugo={elotolt('advancesHuf')} disabled={!szerk} />
              <Mezo cim="Csjk elszámolása (C, ±)" ertek={v.csjkHuf!} set={set('csjkHuf')} sugo="+ fizetendő / − visszajár [Dávid D4]" disabled={!szerk} />
            </>
          )}
        </div>
        {!kata && (
          <div style={{ marginTop: 12 }}>
            <span className="felirat">Egyéb sorok (± összeg, legfeljebb 5)</span>
            {sorok.map((s, i) => (
              <div key={i} className="sor-flex" style={{ gap: 8, marginTop: 6 }}>
                <input className="doboz" placeholder="pl. munkabérből levont adó" value={s.label} disabled={!szerk} onChange={(e) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                <input className="doboz szam" style={{ width: 160 }} inputMode="numeric" value={szovegE(s.amountHuf)} disabled={!szerk} onChange={(e) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, amountHuf: szamE(e.target.value) ?? 0 } : y)))} />
                <button className="gomb-sz" disabled={!szerk} onClick={() => setSorok((x) => x.filter((_, j) => j !== i))}>
                  Eltávolítom
                </button>
              </div>
            ))}
            {szerk && sorok.length < 5 && (
              <button className="gomb-sz" style={{ marginTop: 6 }} onClick={() => setSorok((x) => [...x, { label: '', amountHuf: 0 }])}>
                + Sor
              </button>
            )}
            {kul < 0 && (
              <div className="sor-flex" style={{ gap: 12, marginTop: 10 }}>
                <span className="felirat">Visszajáró módja [Dávid D5]</span>
                <label className="jelolo">
                  <input type="radio" checked={visszajaro === 'kiutalas'} disabled={!szerk} onChange={() => setVisszajaro('kiutalas')} /> kiutalás
                </label>
                <label className="jelolo">
                  <input type="radio" checked={visszajaro === 'atvezetes'} disabled={!szerk} onChange={() => setVisszajaro('atvezetes')} /> átvezetés
                </label>
              </div>
            )}
          </div>
        )}
        <div className="oszlop" style={{ gap: 8, marginTop: 12 }}>
          {becsles !== undefined && becsles !== null ? (
            <div className={elt !== null ? 'uzenet-sav figyel' : 'halvany kicsi'}>
              <div>{fill(P.motor, { becsles: szam(becsles), elteres: szam(elt ?? kul - becsles) })}</div>
            </div>
          ) : (
            <span className="halvany kicsi">{P.motorNincs}</span>
          )}
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">Ha eltérsz az app számától, miért?</span>
            <input className="doboz" value={indok} disabled={!szerk} onChange={(e) => setIndok(e.target.value)} placeholder="pl. a NAV-tervezet szerint" />
          </label>
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">Üzeneted az ügyfélnek (az összesítő tetején látja)</span>
            <textarea className="doboz" value={level} disabled={!szerk} onChange={(e) => setLevel(e.target.value)} maxLength={2000} />
          </label>
          <label className="jelolo">
            <input type="checkbox" checked={egyezik} disabled={!szerk} onChange={(e) => setEgyezik(e.target.checked)} />
            <span>{P.egyezik}</span>
          </label>
          {szerk && (
            <button className="gomb-e kicsi" style={{ alignSelf: 'flex-start' }} disabled={!!zarolt || m.isPending} title={zarolt ?? undefined} onClick={() => m.mutate()}>
              Mentés
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FajlGomb({ cim, fajl, set, disabled }: { cim: string; fajl: File | null; set: (f: File | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="sor-flex" style={{ gap: 6 }}>
      <input ref={ref} type="file" accept="application/pdf,image/*" className="rejtett" onChange={(e) => set(e.target.files?.[0] ?? null)} />
      <button type="button" className="gomb-m kicsi" disabled={disabled} onClick={() => ref.current?.click()}>
        <I3 n="feltoltes" s={22} />
        {fajl ? fajl.name.slice(0, 24) : cim}
      </button>
    </span>
  );
}

/** "Beadtam" – the 26SZJA / '26KATA: date, iktatószám, the return and the NAV receipt. */
export function BeadasKartya({ c, a, frissit, zarolt }: Props) {
  const pir = usePirito();
  const [nap, setNap] = useState(today());
  const [ikt, setIkt] = useState('');
  const [fajl, setFajl] = useState<File | null>(null);
  const [nyugta, setNyugta] = useState<File | null>(null);
  const [telefon, setTelefon] = useState(false);
  const [megj, setMegj] = useState('');
  const m = useMutation({
    mutationFn: () => ep.accAnnualFile(c.id, a.id, 'filed-szja', { filedOn: nap, filingRef: ikt.trim(), ...(telefon ? { noApprovalNote: megj.trim() } : {}) }, { file: fajl, receipt: nyugta }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Rögzítetted a beadást. Az ügyfél értesítést kapott.');
    },
    onError: pir.hiba,
  });
  const jovahagyta = Boolean(a.approval);
  const kesz = Boolean(nap && ikt.trim() && fajl && nyugta && (jovahagyta || (telefon && megj.trim().length >= 10)));
  return (
    <div className="eves-lepes">
      <span className="felirat">{a.regime === 'kata' ? 'Beadtam a kata-nyilatkozatot' : 'Beadtam az szja-bevallást'}</span>
      {!a.amounts && <span className="sugo">Előbb mentsd az összegeket.</span>}
      <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginTop: 6 }}>
        <label className="oszlop" style={{ gap: 4 }}>
          <span className="felirat">{P.beadasNapja}</span>
          <input className="doboz" type="date" value={nap} max={today()} onChange={(e) => setNap(e.target.value)} />
        </label>
        <label className="oszlop" style={{ gap: 4 }}>
          <span className="felirat">{P.iktatoszam}</span>
          <input className="doboz" value={ikt} maxLength={40} onChange={(e) => setIkt(e.target.value)} />
        </label>
      </div>
      <div className="sor-flex" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <FajlGomb cim={P.bevallasPdf} fajl={fajl} set={setFajl} disabled={!!zarolt} />
        <FajlGomb cim={P.nyugta} fajl={nyugta} set={setNyugta} disabled={!!zarolt} />
      </div>
      {!jovahagyta && (
        <div className="oszlop" style={{ gap: 6, marginTop: 8 }}>
          <label className="jelolo">
            <input type="checkbox" checked={telefon} onChange={(e) => setTelefon(e.target.checked)} />
            <span>{P.telefonos}</span>
          </label>
          {telefon && <input className="doboz" placeholder={P.telefonosMegjegyzes} value={megj} onChange={(e) => setMegj(e.target.value)} />}
        </div>
      )}
      <button className="gomb-e kicsi" style={{ marginTop: 10 }} disabled={!!zarolt || !a.amounts || !kesz || m.isPending} onClick={() => m.mutate()}>
        {P.beadtam}
      </button>
    </div>
  );
}

/** After the filing: the difference (the check of the payment) or the refund (megérkezett / beszámítva / átvezetve). */
export function KulonbozetKartya({ c, a, frissit, zarolt }: Props) {
  const pir = usePirito();
  const qc = useQueryClient();
  const s = a.settlement;
  const [nap, setNap] = useState(today());
  const [osszeg, setOsszeg] = useState('');
  const [megj, setMegj] = useState('');
  const refund = useMutation({
    mutationFn: (status: 'megerkezett' | 'beszamitva' | 'atvezetve') => ep.accAnnualRefund(c.id, a.id, { status, on: nap, amountHuf: szamE(osszeg), note: megj.trim() || null }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Rögzítetted.');
    },
    onError: pir.hiba,
  });
  const ver = useMutation({
    mutationFn: (verification: 'rendben' | 'elteres') => ep.accVerifyPayment(s!.periodId!, [{ kind: a.regime === 'kata' ? 'kata_kulonado' : 'szja_kulonbozet', verification, ...(verification === 'elteres' ? { note: megj.trim() || 'Nem látom a befizetést a folyószámlán.' } : {}) }]),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['acc', 'annual', c.id] });
      pir.ok('Rögzítetted.');
    },
    onError: pir.hiba,
  });
  if (!s) return null;
  const r = s.refund;
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="befizetve_jel" s={28} />
          <h2>{r ? P.visszajaroCim : P.kulonbozetCim}</h2>
          {s.filingRef && <span className="cimke">{`${P.iktatoszam}: ${s.filingRef}`}</span>}
        </div>
        <p className="halvany">{s.text}</p>
        {s.periodId && (
          <div className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="cimke">{s.paymentStatus === 'ellenorizve' ? 'Ellenőrizve' : s.paymentStatus === 'befizetve_jelezve' ? 'Az ügyfél jelölte – ellenőrizd' : s.paymentStatus === 'elteres' ? 'Eltérés' : 'Fizetendő'}</span>
            {s.paymentStatus !== 'ellenorizve' && (
              <>
                <button className="gomb-m kicsi" disabled={!!zarolt || ver.isPending} onClick={() => ver.mutate('rendben')}>
                  Rendben
                </button>
                <button className="gomb-sz" disabled={!!zarolt || ver.isPending} onClick={() => ver.mutate('elteres')}>
                  Eltérés
                </button>
              </>
            )}
          </div>
        )}
        {r && (
          <div className="oszlop" style={{ gap: 8 }}>
            <span className="halvany kicsi">{r.expectedBy ? fill(P.varhato, { datum: datum(r.expectedBy, { ev: true }) }) : ''}</span>
            <span>{r.text}</span>
            {(r.status === 'var' || r.markedBy === 'ugyfel') && (
              <>
                <div className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <input className="doboz" type="date" style={{ width: 170 }} value={nap} max={today()} onChange={(e) => setNap(e.target.value)} />
                  <input className="doboz szam" style={{ width: 160 }} placeholder={s.diffHuf ? String(-s.diffHuf) : ''} value={osszeg} onChange={(e) => setOsszeg(e.target.value)} />
                  <input className="doboz" style={{ flex: 1, minWidth: 180 }} placeholder="Megjegyzés" value={megj} onChange={(e) => setMegj(e.target.value)} />
                </div>
                <div className="sor-flex" style={{ gap: 8 }}>
                  <button className="gomb-m kicsi" disabled={!!zarolt || refund.isPending} onClick={() => refund.mutate('megerkezett')}>
                    {P.megerkezett}
                  </button>
                  <button className="gomb-sz" disabled={!!zarolt || refund.isPending} onClick={() => refund.mutate('beszamitva')}>
                    {P.beszamitva}
                  </button>
                  <button className="gomb-sz" disabled={!!zarolt || refund.isPending} onClick={() => refund.mutate('atvezetve')}>
                    {P.atvezetve}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The yearly HIPA: H, E, return needed / not needed / no HIPA at all; "Beadtam a HIPA-bevallást". */
export function HipaKartya({ c, a, frissit, zarolt }: Props) {
  const pir = usePirito();
  const h = a.hipa;
  const [ado, setAdo] = useState(szovegE(h?.taxHuf));
  const [eloleg, setEloleg] = useState(szovegE(h?.advancesHuf));
  const [kell, setKell] = useState(h?.returnNeeded ?? true);
  const [nap, setNap] = useState(today());
  const [ikt, setIkt] = useState('');
  const [fajl, setFajl] = useState<File | null>(null);
  const ment = useMutation({
    mutationFn: (notNeeded: boolean) => ep.accAnnualHipa(c.id, a.id, notNeeded ? { notNeeded: true } : { taxHuf: szamE(ado), advancesHuf: szamE(eloleg), returnNeeded: kell }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Elmentetted.');
    },
    onError: pir.hiba,
  });
  const bead = useMutation({
    mutationFn: () => ep.accAnnualFile(c.id, a.id, 'filed-hipa', { filedOn: nap, filingRef: ikt.trim() }, { file: fajl }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Rögzítetted a HIPA-bevallást.');
    },
    onError: pir.hiba,
  });
  if (!['konyvelonel', 'jovahagyasra_var', 'beadva', 'kesz'].includes(a.status)) return null;
  const kesz = Boolean(h?.filedOn) || a.status === 'kesz';
  const kul = (szamE(ado) ?? 0) - (szamE(eloleg) ?? 0);
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="szamlaszam" s={28} />
          <h2>{P.hipaCim}</h2>
          {h && !h.needed && <span className="cimke">{P.hipaNemKell}</span>}
          {h?.filedOn && <span className="cimke info">{`Beadva: ${datum(h.filedOn, { ev: true })}`}</span>}
        </div>
        {kesz ? (
          <p className="halvany">{h?.taxHuf != null ? `Éves adó: ${ft(h.taxHuf)}, előleg: ${ft(h.advancesHuf ?? 0)}, különbözet: ${ft(h.diffHuf ?? 0)}.` : 'Rögzítve.'}</p>
        ) : (
          <>
            <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              <Mezo cim="Éves iparűzési adó (H)" ertek={ado} set={setAdo} />
              <Mezo cim="Befizetett előleg (E)" ertek={eloleg} set={setEloleg} />
            </div>
            <div className="halvany kicsi" style={{ marginTop: 6 }}>{`Különbözet: ${ft(kul)}${kul > 0 ? ' – az önkormányzat számlájára, május 31-ig' : ''}`}</div>
            <label className="jelolo" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={kell} onChange={(e) => setKell(e.target.checked)} />
              <span>{P.hipaBevallasKell}</span>
            </label>
            <div className="sor-flex" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="gomb-m kicsi" disabled={!!zarolt || ment.isPending} onClick={() => ment.mutate(false)}>
                {kell ? 'Mentés' : P.hipaNemKellBevallas}
              </button>
              <button className="gomb-sz" disabled={!!zarolt || ment.isPending} onClick={() => ment.mutate(true)}>
                {P.hipaNemKell}
              </button>
            </div>
            {h?.needed && h.taxHuf !== null && kell && (
              <div className="eves-lepes" style={{ marginTop: 12 }}>
                <div className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <input className="doboz" type="date" style={{ width: 170 }} value={nap} max={today()} aria-label={P.beadasNapja} onChange={(e) => setNap(e.target.value)} />
                  <input className="doboz" style={{ width: 200 }} placeholder={P.iktatoszam} maxLength={40} value={ikt} onChange={(e) => setIkt(e.target.value)} />
                  <FajlGomb cim="Bevallás (nem kötelező)" fajl={fajl} set={setFajl} disabled={!!zarolt} />
                </div>
                <button className="gomb-e kicsi" style={{ marginTop: 8 }} disabled={!!zarolt || bead.isPending} onClick={() => bead.mutate()}>
                  {P.hipaBeadtam}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** "Lezárom az éves zárást" with a reason; "Önellenőrzést indítok" after the filing. */
export function LezarasSor({ c, a, frissit, zarolt }: Props) {
  const pir = usePirito();
  const nav = useNavigate();
  const [nyit, setNyit] = useState(false);
  const [indok, setIndok] = useState('');
  const m = useMutation({
    mutationFn: () => ep.accAnnualClose(c.id, a.id, indok.trim()),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Lezártad.');
    },
    onError: pir.hiba,
  });
  return (
    <div className="eves-lepes">
      <div className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        {['konyvelonel', 'jovahagyasra_var', 'beadva'].includes(a.status) && (
          <button className="gomb-sz" disabled={!!zarolt} onClick={() => setNyit((x) => !x)}>
            {P.lezaras}
          </button>
        )}
        {(a.status === 'beadva' || a.status === 'kesz') && (
          <button className="gomb-sz" onClick={() => nav(`/ugyfelek/${c.id}/onellenorzes?form=${a.regime === 'kata' ? 'KATA' : 'SZJA'}&targy=${a.year}`)}>
            {P.onellIndit}
          </button>
        )}
      </div>
      {nyit && (
        <div className="sor-flex" style={{ gap: 8, marginTop: 8 }}>
          <input className="doboz" placeholder={P.lezarasIndok} value={indok} onChange={(e) => setIndok(e.target.value)} />
          <button className="gomb-m kicsi" disabled={indok.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>
            Lezárom
          </button>
        </div>
      )}
      {a.closedManuallyReason && <span className="sugo">Kézzel lezárva: {a.closedManuallyReason}</span>}
    </div>
  );
}

/** A former client's last year (switch lemondottEvesZaras; default off – then only the reason shows). */
export function MegnyitasSor({ c, a, frissit }: Props) {
  const pir = usePirito();
  const m = useMutation({
    mutationFn: () => ep.accAnnualOpen(c.id, a.year),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Megnyitottad. Az ügyfél értesítést kapott.');
    },
    onError: pir.hiba,
  });
  const st = a.manualOpen;
  if (!st || a.status !== 'nem_indult') return null;
  return (
    <div className="uzenet-sav figyel" style={{ marginBottom: 12 }}>
      <div>
        {st.reason}{' '}
        {st.allowed && (
          <button className="gomb-m kicsi" style={{ marginLeft: 8 }} disabled={m.isPending} onClick={() => m.mutate()}>
            {P.megnyitas}
          </button>
        )}
      </div>
    </div>
  );
}
