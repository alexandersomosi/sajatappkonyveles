// SPEC §32.B – "Önellenőrzés" tab: the client's önellenőrzések (the original period stays untouched) and the form: which
// filed return, why (the client reads it), the differences per tax, the pótlék SUGGESTION with its basis (Art. 209. § (2),
// 211. § (3), 212. §), the accountant's approval of the final pótlék, "Ügyfélnek jóváhagyásra", "Beadtam" (date, NAV
// iktatószám, the return and the receipt), "Visszavonom". The HIPA pótlék goes to the municipality: no item [Dávid K7].
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import {
  CORRECTION_ADONEM_LABELS,
  CORRECTION_ADONEMEK,
  CORRECTION_CAUSES,
  CORRECTION_FORMS,
  ONELL_PANEL_TEXTS as O,
  type AccTaxCorrection,
  type CorrectionAdonem,
  type CorrectionDiff,
  type CorrectionForm,
  type CorrectionInput,
} from '../../../_shared/eves';
import { datum, ft } from '../../../lib/format';
import { today } from '../../../lib/today';
import { HibaSav, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';

const FORMA_CIMKE: Record<CorrectionForm, string> = { '2658': '2658 (negyedév)', SZJA: 'Szja-bevallás (éves)', KATA: 'Kata-nyilatkozat', HIPA: 'Iparűzési adó', egyeb: 'Egyéb' };

export default function Onellenorzes({ c }: FulProps) {
  const [sp] = useSearchParams();
  const q = useQuery({ queryKey: ['acc', 'corrections', c.id], queryFn: () => ep.accCorrections(c.id) });
  const elotolt = sp.get('form') ? { form: sp.get('form') as CorrectionForm, subjectKey: sp.get('targy') ?? '', originalPeriodId: sp.get('idoszak') } : null;
  const [uj, setUj] = useState(Boolean(elotolt));
  if (q.isPending) return <Toltes />;
  if (q.isError) return <HibaSav hiba={q.error} ujra={() => q.refetch()} />;
  const items = q.data.items;
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="sor-flex ter">
        <h2 style={{ margin: 0 }}>{O.cim}</h2>
        {!uj && (
          <button className="gomb-e kicsi" disabled={Boolean(c.serviceLock)} onClick={() => setUj(true)}>
            {O.uj}
          </button>
        )}
      </div>
      {uj && <Urlap c={c} kezdo={elotolt} bezar={() => setUj(false)} />}
      {items.length === 0 && !uj && <p className="halvany">Még nincs önellenőrzés. Beadott bevallást itt javíthatsz; az eredeti időszak érintetlen marad.</p>}
      {items.map((k) => (
        <Kartya key={k.id} c={c} k={k} />
      ))}
    </div>
  );
}

/** NAV taxes with a pótlék (a HIPA pótlék is the municipality's: no pótlék in the app – kritika 2.3). */
const NAV_POTLEK = new Set(['103', '406', '258', '288']);
const vanNavPotlek = (diffs: CorrectionDiff[]) => diffs.some((d) => NAV_POTLEK.has(d.adonem) && d.amountHuf > 0);

const szamE = (s: string) => {
  const t = s.replace(/[\s.]/g, '').replace('−', '-');
  const n = Number(t);
  return t && Number.isFinite(n) ? Math.round(n) : 0;
};

function Urlap({ c, kezdo, k, bezar }: FulProps & { kezdo?: { form: CorrectionForm; subjectKey: string; originalPeriodId: string | null } | null; k?: AccTaxCorrection; bezar: () => void }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const [form, setForm] = useState<CorrectionForm>(k?.form ?? kezdo?.form ?? '2658');
  const [targy, setTargy] = useState(k?.subjectKey ?? kezdo?.subjectKey ?? '');
  const [idoszak, setIdoszak] = useState(k?.originalPeriodId ?? kezdo?.originalPeriodId ?? '');
  const [ok, setOk] = useState<(typeof CORRECTION_CAUSES)[number]>(k?.cause ?? 'kesoi_irat');
  const [miert, setMiert] = useState(k?.reason ?? '');
  const [belso, setBelso] = useState(k?.internalNote ?? '');
  const [sorok, setSorok] = useState<CorrectionDiff[]>(k?.diffs ?? [{ adonem: '103', label: 'Szja', amountHuf: 0, originalDueDate: '' }]);
  const [flag, setFlag] = useState({ certificateError: k?.flags.certificateError ?? false, paidInFull: k?.flags.paidInFull ?? false, laterReturn: k?.flags.laterReturn ?? false, chained: k?.flags.chained ?? false });
  const [payer, setPayer] = useState<'ugyfel' | 'iroda'>(k?.potlek.payer ?? 'ugyfel');
  const [ugyfel, setUgyfel] = useState(k?.needsClientApproval ?? true);
  const [telefon, setTelefon] = useState('');
  const [tervNap, setTervNap] = useState(today());
  const ev = new Date().getFullYear();
  // javító kör 11-21: the year field asks the server only for a full 4-digit year (no request per keystroke)
  const evSzoveg = targy.slice(0, 4);
  const lekertEv = /^\d{4}$/.test(evSzoveg) && Number(evSzoveg) >= 2024 && Number(evSzoveg) <= 2100 ? Number(evSzoveg) : ev - 1;
  const negyedevek = useQuery({ queryKey: ['acc', 'tax', c.id, lekertEv], queryFn: () => ep.accTaxPeriods(c.id, lekertEv), enabled: form === '2658' });
  const beadott = (negyedevek.data?.items ?? []).filter((p) => p.kind === 'negyedev' && p.filingStatus === 'beadva');
  // the original due date of the chosen quarter fills the empty rows
  const valaszt = (id: string) => {
    setIdoszak(id);
    const p = beadott.find((x) => x.id === id);
    if (p) setSorok((x) => x.map((y) => (y.originalDueDate ? y : { ...y, originalDueDate: p.dueDate })));
  };
  const navPotlek = vanNavPotlek(sorok);
  const input: CorrectionInput = {
    form,
    subjectKey: form === '2658' ? (beadott.find((p) => p.id === idoszak)?.periodKey ?? targy) : targy,
    originalPeriodId: form === '2658' ? idoszak || null : null,
    cause: ok,
    reason: miert.trim(),
    internalNote: belso.trim() || null,
    diffs: sorok,
    ...flag,
    potlekPayer: payer,
    needsClientApproval: ugyfel,
    noApprovalNote: ugyfel ? null : telefon.trim() || null,
    plannedFiledOn: tervNap || null,
  };
  const m = useMutation({
    mutationFn: () => (k ? ep.accCorrectionUpdate(k.id, input) : ep.accCorrectionCreate(c.id, input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['acc', 'corrections', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
      pir.ok('Elmentetted tervezetként. Nézd át a pótlékot, és hagyd jóvá.');
      bezar();
    },
    onError: pir.hiba,
  });
  // Art. 56. § (3): per tax – a row of at most 1 000 Ft cannot be corrected (javító kör 11-21)
  const kuszob = sorok.some((s) => s.amountHuf !== 0 && Math.abs(s.amountHuf) <= 1000) || sorok.every((s) => s.amountHuf === 0);
  const nincsDatum = sorok.some((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s.originalDueDate));
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="bevallas" s={28} />
          <h2>{k ? 'Önellenőrzés szerkesztése' : O.uj}</h2>
        </div>
        <div className="racs" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">Melyik bevallás</span>
            <select className="doboz" value={form} onChange={(e) => setForm(e.target.value as CorrectionForm)}>
              {CORRECTION_FORMS.map((f) => (
                <option key={f} value={f}>
                  {FORMA_CIMKE[f]}
                </option>
              ))}
            </select>
          </label>
          {form === '2658' ? (
            <>
              <label className="oszlop" style={{ gap: 4 }}>
                <span className="felirat">Év</span>
                <input className="doboz" value={targy.slice(0, 4)} placeholder={String(ev - 1)} onChange={(e) => setTargy(e.target.value)} />
              </label>
              <label className="oszlop" style={{ gap: 4 }}>
                <span className="felirat">Beadott negyedév</span>
                <select className="doboz" value={idoszak} onChange={(e) => valaszt(e.target.value)}>
                  <option value="">– válaszd ki –</option>
                  {beadott.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} (beadva: {datum(p.filed?.filedOn ?? null)})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="oszlop" style={{ gap: 4 }}>
              <span className="felirat">{form === 'egyeb' ? 'Mit javítasz (rövid név)' : 'Adóév'}</span>
              <input className="doboz" value={targy} onChange={(e) => setTargy(e.target.value)} />
            </label>
          )}
          <label className="oszlop" style={{ gap: 4 }}>
            <span className="felirat">Ok</span>
            <select className="doboz" value={ok} onChange={(e) => setOk(e.target.value as typeof ok)}>
              {CORRECTION_CAUSES.map((x) => (
                <option key={x} value={x}>
                  {O.okok[x]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="oszlop" style={{ gap: 4, marginTop: 10 }}>
          <span className="felirat">Miért? (az ügyfél ezt látja, legfeljebb 600 karakter)</span>
          <textarea className="doboz" maxLength={600} value={miert} onChange={(e) => setMiert(e.target.value)} />
        </label>
        <label className="oszlop" style={{ gap: 4, marginTop: 10 }}>
          <span className="felirat">Belső megjegyzés</span>
          <input className="doboz" value={belso} onChange={(e) => setBelso(e.target.value)} />
        </label>
        <span className="felirat" style={{ marginTop: 12, display: 'block' }}>Különbözetek (+ fizetendő, − a javára)</span>
        {sorok.map((s, i) => (
          <div key={i} className="sor-flex" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <select className="doboz" style={{ width: 170 }} value={s.adonem} onChange={(e) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, adonem: e.target.value as CorrectionAdonem, label: CORRECTION_ADONEM_LABELS[e.target.value as CorrectionAdonem] } : y)))}>
              {CORRECTION_ADONEMEK.map((a) => (
                <option key={a} value={a}>
                  {a === 'HIPA' || a === 'egyeb' ? CORRECTION_ADONEM_LABELS[a] : `${a} ${CORRECTION_ADONEM_LABELS[a]}`}
                </option>
              ))}
            </select>
            {s.adonem === 'egyeb' && <input className="doboz" style={{ width: 160 }} placeholder="Megnevezés" value={s.label} onChange={(e) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />}
            <input className="doboz szam" style={{ width: 150 }} inputMode="numeric" value={s.amountHuf ? String(s.amountHuf) : ''} placeholder="± Ft" onChange={(e) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, amountHuf: szamE(e.target.value) } : y)))} />
            <input className="doboz" type="date" style={{ width: 170 }} aria-label="Eredeti esedékesség" value={s.originalDueDate} onChange={(e) => setSorok((x) => x.map((y, j) => (j === i ? { ...y, originalDueDate: e.target.value } : y)))} />
            <button className="gomb-sz" onClick={() => setSorok((x) => x.filter((_, j) => j !== i))}>
              Eltávolítom
            </button>
          </div>
        ))}
        {sorok.length < 8 && (
          <button className="gomb-sz" style={{ marginTop: 6 }} onClick={() => setSorok((x) => [...x, { adonem: '406', label: 'TB-járulék', amountHuf: 0, originalDueDate: x[0]?.originalDueDate ?? '' }])}>
            + Adónem
          </button>
        )}
        {kuszob && <div className="uzenet-sav figyel" style={{ marginTop: 8 }}><div>{O.kuszob}</div></div>}
        {nincsDatum && <div className="sugo" style={{ marginTop: 6 }}>Add meg minden sorban az eredeti esedékességet.</div>}
        {sorok.some((s) => s.adonem === 'HIPA' && s.amountHuf > 0) && <div className="halvany kicsi" style={{ marginTop: 6 }}>{O.hipaPotlek}</div>}
        <div className="oszlop" style={{ gap: 6, marginTop: 12 }}>
          <label className="oszlop" style={{ gap: 4, maxWidth: 220 }}>
            <span className="felirat">Tervezett beadás napja</span>
            <input className="doboz" type="date" min={today()} value={tervNap} onChange={(e) => setTervNap(e.target.value)} />
          </label>
          {navPotlek && (
            <>
              <span className="felirat">Pótlék</span>
              <span className="sugo">A pótlék a beadás napjáig jár: ha később adod be, beadáskor újraszámoljuk.</span>
              <label className="jelolo"><input type="checkbox" checked={flag.certificateError} onChange={(e) => setFlag((f) => ({ ...f, certificateError: e.target.checked }))} /><span>{O.igazolasHiba}</span></label>
              <label className="jelolo"><input type="checkbox" checked={flag.paidInFull} onChange={(e) => setFlag((f) => ({ ...f, paidInFull: e.target.checked }))} /><span>{O.hianytalan}</span></label>
              <label className="jelolo"><input type="checkbox" checked={flag.laterReturn} onChange={(e) => setFlag((f) => ({ ...f, laterReturn: e.target.checked }))} /><span>{O.kesobbiBevallas}</span></label>
              <label className="jelolo"><input type="checkbox" checked={flag.chained} onChange={(e) => setFlag((f) => ({ ...f, chained: e.target.checked }))} /><span>{O.lancolt}</span></label>
              <div className="sor-flex" style={{ gap: 12 }}>
                <span>{O.kiFizeti}</span>
                <label className="jelolo"><input type="radio" checked={payer === 'ugyfel'} onChange={() => setPayer('ugyfel')} /> az ügyfél</label>
                <label className="jelolo"><input type="radio" checked={payer === 'iroda'} onChange={() => setPayer('iroda')} /> az iroda</label>
              </div>
            </>
          )}
          <label className="jelolo"><input type="checkbox" checked={ugyfel} onChange={(e) => setUgyfel(e.target.checked)} /><span>Ügyfél-jóváhagyást kérek</span></label>
          {!ugyfel && <input className="doboz" placeholder="A telefonos egyeztetés: mikor, mit beszéltetek?" value={telefon} onChange={(e) => setTelefon(e.target.value)} />}
        </div>
        <div className="sor-flex" style={{ gap: 8, marginTop: 12 }}>
          <button className="gomb-e kicsi" disabled={m.isPending || kuszob || nincsDatum || !miert.trim()} onClick={() => m.mutate()}>
            Mentés tervezetként
          </button>
          <button className="gomb-sz" onClick={bezar}>
            Mégsem
          </button>
        </div>
      </div>
    </div>
  );
}

function Kartya({ c, k }: FulProps & { k: AccTaxCorrection }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const [szerk, setSzerk] = useState(false);
  const [potlek, setPotlek] = useState(String(k.potlek.suggestedHuf ?? k.potlek.huf));
  const [indok, setIndok] = useState('');
  const [nap, setNap] = useState(today());
  const [ikt, setIkt] = useState('');
  const [fajl, setFajl] = useState<File | null>(null);
  const [nyugta, setNyugta] = useState<File | null>(null);
  const [vissza, setVissza] = useState('');
  const [visszaNyit, setVisszaNyit] = useState(false);
  const navPotlek = vanNavPotlek(k.diffs);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const frissit = () => {
    void qc.invalidateQueries({ queryKey: ['acc', 'corrections', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
  };
  const useMut = <T,>(fn: () => Promise<T>, ok: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        frissit();
        pir.ok(ok);
      },
      onError: pir.hiba,
    });
  const jovahagy = useMut(() => ep.accCorrectionPotlek(k.id, { huf: szamE(potlek), reason: indok.trim() || null }), 'Jóváhagytad a pótlékot.');
  const kuld = useMut(() => ep.accCorrectionSend(k.id), k.needsClientApproval ? 'Elküldted. Az ügyfél értesítést kapott: hagyja jóvá.' : 'Jóváhagyottnak jelölted (telefonos egyeztetés).');
  const bead = useMut(() => ep.accCorrectionFiled(k.id, { filedOn: nap, filingRef: ikt.trim() }, { file: fajl!, receipt: nyugta! }), 'Rögzítetted a beadást. Az ügyfél értesítést kapott.');
  const visszavon = useMut(() => ep.accCorrectionCancel(k.id, vissza.trim()), 'Visszavontad.');
  if (szerk) return <Urlap c={c} k={k} bezar={() => setSzerk(false)} />;
  const allapotCls = k.status === 'beadva' || k.status === 'ugyfelre_var' ? 'figyel' : k.status === 'rendezve' || k.status === 'visszavonva' ? '' : 'info';
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="irat" s={28} />
          <h2>
            {k.formLabel} – {k.subjectLabel}
            {k.seq > 1 ? ` (${k.seq}. önellenőrzés)` : ''}
          </h2>
          <span className={`cimke ${allapotCls}`}>{O.allapot[k.status]}</span>
        </div>
        <p>{k.reason}</p>
        {k.warnings.map((w) => (
          <div key={w} className="halvany kicsi">
            {w}
          </div>
        ))}
        <table className="tabla" style={{ marginTop: 8 }}>
          <tbody>
            {k.diffs.map((d, i) => (
              <tr key={i}>
                <td>{d.adonem === 'HIPA' || d.adonem === 'egyeb' ? d.label : `${d.adonem} ${d.label}`}</td>
                <td className="jobb szam">{ft(d.amountHuf)}</td>
                <td className="halvany kicsi">eredeti esedékesség: {datum(d.originalDueDate, { ev: true })}</td>
              </tr>
            ))}
            {navPotlek && (
              <tr>
                <td>Önellenőrzési pótlék {k.potlek.payer === 'iroda' ? '(az iroda állja)' : ''}</td>
                <td className="jobb szam">{ft(k.potlek.huf)}</td>
                <td className="halvany kicsi">{k.potlek.approvedAt ? `jóváhagyva${k.potlek.approvedBy ? `: ${k.potlek.approvedBy.firstName}` : ''}` : 'nincs jóváhagyva'}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="halvany kicsi" style={{ marginTop: 6 }}>
          Összesen fizetendő: <b>{ft(k.totalToPayHuf)}</b>
          {k.inFavourHuf > 0 ? ` · a javára: ${ft(k.inFavourHuf)} (a folyószámlán követed)` : ''}
        </div>
        {k.status === 'tervezet' && !navPotlek && (
          <div className="sor-flex" style={{ gap: 8, marginTop: 10 }}>
            <button className="gomb-e kicsi" disabled={kuld.isPending} onClick={() => kuld.mutate()}>
              {O.ugyfelreVar}
            </button>
            <button className="gomb-sz" onClick={() => setSzerk(true)}>
              Szerkesztem
            </button>
          </div>
        )}
        {k.status === 'tervezet' && navPotlek && (
          <div className="eves-lepes" style={{ marginTop: 10 }}>
            <span className="felirat">Pótlék-javaslat: {k.potlek.suggestedHuf === null ? 'nincs' : ft(k.potlek.suggestedHuf)}</span>
            {k.potlek.basis.map((b) => (
              <div key={b} className="kicsi">
                {b}
              </div>
            ))}
            <div className="halvany kicsi">{k.potlek.rateNote}</div>
            <div className="sor-flex" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <input className="doboz szam" style={{ width: 150 }} value={potlek} onChange={(e) => setPotlek(e.target.value)} aria-label="Végleges pótlék" />
              <input className="doboz" style={{ flex: 1, minWidth: 200 }} placeholder={O.potlekIndok} value={indok} onChange={(e) => setIndok(e.target.value)} />
              <button className="gomb-m kicsi" disabled={jovahagy.isPending} onClick={() => jovahagy.mutate()}>
                {O.potlekJovahagy}
              </button>
            </div>
            <div className="sor-flex" style={{ gap: 8, marginTop: 10 }}>
              <button className="gomb-e kicsi" disabled={kuld.isPending} onClick={() => kuld.mutate()}>
                {O.ugyfelreVar}
              </button>
              <button className="gomb-sz" onClick={() => setSzerk(true)}>
                Szerkesztem
              </button>
            </div>
          </div>
        )}
        {k.status === 'ugyfelre_var' && (
          <div className="sor-flex" style={{ gap: 8, marginTop: 10 }}>
            <span className="halvany kicsi">Az ügyfél jóváhagyására vár.</span>
            <button className="gomb-sz" onClick={() => setSzerk(true)}>
              Szerkesztem (újra el kell küldeni)
            </button>
          </div>
        )}
        {k.status === 'jovahagyva' && (
          <div className="eves-lepes" style={{ marginTop: 10 }}>
            <div className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input className="doboz" type="date" style={{ width: 170 }} value={nap} max={today()} aria-label="Beadás napja" onChange={(e) => setNap(e.target.value)} />
              <input className="doboz" style={{ width: 200 }} placeholder="NAV-iktatószám" maxLength={40} value={ikt} onChange={(e) => setIkt(e.target.value)} />
              <input ref={r1} type="file" accept="application/pdf,image/*" className="rejtett" onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
              <button className="gomb-m kicsi" onClick={() => r1.current?.click()}>
                {fajl ? fajl.name.slice(0, 20) : 'Önellenőrzés (PDF)'}
              </button>
              <input ref={r2} type="file" accept="application/pdf,image/*" className="rejtett" onChange={(e) => setNyugta(e.target.files?.[0] ?? null)} />
              <button className="gomb-m kicsi" onClick={() => r2.current?.click()}>
                {nyugta ? nyugta.name.slice(0, 20) : 'NAV-visszaigazolás'}
              </button>
            </div>
            <button className="gomb-e kicsi" style={{ marginTop: 8 }} disabled={!ikt.trim() || !fajl || !nyugta || bead.isPending} onClick={() => bead.mutate()}>
              {O.beadtam}
            </button>
          </div>
        )}
        {k.filedOn && <div className="halvany kicsi" style={{ marginTop: 6 }}>Beadva: {datum(k.filedOn, { ev: true })} · {k.filingRef}{k.paymentStatus ? ` · befizetés: ${k.paymentStatus}` : ''}</div>}
        {(k.status === 'tervezet' || k.status === 'ugyfelre_var' || k.status === 'jovahagyva') &&
          (visszaNyit ? (
            <div className="sor-flex" style={{ gap: 8, marginTop: 10 }}>
              <input className="doboz" style={{ flex: 1 }} placeholder="Miért vonod vissza?" value={vissza} onChange={(e) => setVissza(e.target.value)} />
              <button className="gomb-sz" disabled={vissza.trim().length < 3 || visszavon.isPending} onClick={() => visszavon.mutate()}>
                {O.visszavonom}
              </button>
              <button className="gomb-sz" onClick={() => setVisszaNyit(false)}>
                Mégsem
              </button>
            </div>
          ) : (
            <button className="gomb-sz" style={{ marginTop: 10 }} onClick={() => setVisszaNyit(true)}>
              Visszavonom…
            </button>
          ))}
        {k.cancelledReason && <div className="halvany kicsi">Visszavonva: {k.cancelledReason}</div>}
      </div>
    </div>
  );
}
