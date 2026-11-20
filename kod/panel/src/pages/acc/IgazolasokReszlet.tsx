// SPEC §29.5 F1 – the certificate drawer: everything IGAZOL needs (adóazonosító jel masked + "Mutasd", audited), the
// timeline and the actions: "Beadtam a NAV-nak" → navnal, "Feltöltöm az igazolást" (the ORIGINAL PDF, ≤ 15 MB – an
// electronic certificate is valid only as that file) → kesz, KOMA outcomes, "Nem adható ki" (reason) → elutasitva.
// We never log in anywhere: the accountant uses his own meghatalmazott access outside the app.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as k from '../../api/k29f';
import { CERT_PANEL_TEXTS, CERT_REJECT_QUICK, CERT_RULES, KOMA_OUTCOMES, type AccCertificateDetail, type KomaOutcome } from '../../_shared/k29f';
import { Fiok, HibaSav, Toltes } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { datum, idopont } from '../../lib/format';
import { today } from '../../lib/today';

const F = CERT_PANEL_TEXTS.fields;

function Sor({ cim, children }: { cim: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: 12, padding: '5px 0', fontSize: 14.5 }}>
      <span className="halvany">{cim}</span>
      <span style={{ fontWeight: 550, overflowWrap: 'anywhere' }}>{children}</span>
    </div>
  );
}

export function IgazolasFiok({ id, bezar }: { id: string | null; bezar: () => void }) {
  const q = useQuery({ queryKey: ['acc', 'certificate', id], queryFn: () => k.accCertificate(id!), enabled: Boolean(id) });
  const d = q.data;
  return (
    <Fiok nyitva={Boolean(id)} bezar={bezar} ikon="igazolas" szeles cim={d ? `${d.typeLabel}${d.year ? ` ${d.year}` : ''}` : 'Igazolás'} bev={d ? `${d.client.name} · ${d.statusLabel}` : undefined}>
      {q.isPending ? <Toltes /> : q.isError ? <HibaSav hiba={q.error} ujra={() => q.refetch()} /> : d ? <Reszlet d={d} /> : null}
    </Fiok>
  );
}

function Reszlet({ d }: { d: AccCertificateDetail }) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const [taxId, setTaxId] = useState<string | null>(null);
  const [beadva, setBeadva] = useState(t);
  const [iktato, setIktato] = useState('');
  const [fajl, setFajl] = useState<File | null>(null);
  const [koma, setKoma] = useState<KomaOutcome | null>(null);
  const [komaNap, setKomaNap] = useState('');
  const [komaHo, setKomaHo] = useState('');
  const [okGyors, setOkGyors] = useState<string | null>(null);
  const [ok, setOk] = useState('');
  const [mutatElutasit, setMutatElutasit] = useState(false);
  useEffect(() => setTaxId(null), [d.id]);
  const frissit = (u: AccCertificateDetail) => {
    qc.setQueryData(['acc', 'certificate', d.id], u);
    void qc.invalidateQueries({ queryKey: ['acc', 'certificates'] });
  };
  const mutat = useMutation({ mutationFn: () => k.accCertificateReveal(d.id), onSuccess: (r) => setTaxId(r.adoazonositoJel), onError: pir.hiba });
  const bead = useMutation({
    mutationFn: () => k.accCertificateSubmitted(d.id, { date: beadva, ...(iktato.trim() ? { iktatoszam: iktato.trim() } : {}) }),
    onSuccess: (u) => {
      frissit(u);
      pir.ok('Rögzítetted: beadva a NAV-nak. Az ügyfél értesítést kapott.');
    },
    onError: pir.hiba,
  });
  const kesz = useMutation({
    mutationFn: async () => {
      let documentId: string | null = null;
      if (fajl) {
        if (fajl.type && fajl.type !== 'application/pdf') throw new Error('Csak PDF tölthető fel (az eredeti, NAV-tól kapott fájl).');
        if (fajl.size > CERT_RULES.resultPdfMaxBytes) throw new Error('Legfeljebb 15 MB lehet.');
        const doc = await k.accUploadCertificatePdf(d.clientId, fajl, `${d.typeLabel}${d.year ? ` ${d.year}` : ''}`, t.slice(0, 7));
        documentId = doc.id;
      }
      return k.accCertificateResult(d.id, { documentId, ...(d.type === 'koma' && koma ? { komaOutcome: koma, ...(koma === 'benne_van' ? { komaDate: komaNap } : koma === 'felvetel_kerve' ? { komaMonth: komaHo } : {}) } : {}) });
    },
    onSuccess: (u) => {
      frissit(u);
      pir.ok('Kész. Az ügyfél letöltheti az appban.');
    },
    onError: pir.hiba,
  });
  const elutasit = useMutation({
    mutationFn: () => k.accCertificateReject(d.id, okGyors && okGyors !== 'Más' ? `${okGyors}${ok.trim() ? `. ${ok.trim()}` : ''}` : ok.trim()),
    onSuccess: (u) => {
      frissit(u);
      pir.ok('Rögzítetted: nem adható ki. Az ügyfél látja az okát.');
    },
    onError: pir.hiba,
  });
  const nyitott = d.status === 'beerkezett' || d.status === 'navnal';
  const komaKell = d.type === 'koma';
  const keszMehet = komaKell ? Boolean(koma) && (koma !== 'igazolas' || fajl) && (koma !== 'benne_van' || komaNap) && (koma !== 'felvetel_kerve' || komaHo) : Boolean(fajl);
  return (
    <div className="lap k28" style={{ margin: '-4px -4px 0' }}>
      {d.overdue ? (
        <div className="szak">
          <span className="cimke hiba">{CERT_PANEL_TEXTS.overdue}</span>
        </div>
      ) : null}
      <div className="szak">
        <div className="szak-fej">
          <I3 n="fiok" />
          <h2>Az IGAZOL nyomtatványhoz</h2>
        </div>
        <Sor cim={F.name}>{d.client.name}</Sor>
        <Sor cim={F.adoazonosito}>
          {taxId ?? d.client.adoazonositoMasked ?? '–'}{' '}
          {d.client.adoazonositoMasked && !taxId ? (
            <button type="button" className="gomb-sz" onClick={() => mutat.mutate()} disabled={mutat.isPending}>
              {CERT_PANEL_TEXTS.reveal}
            </button>
          ) : null}
        </Sor>
        <Sor cim={F.adoszam}>{d.client.adoszam}</Sor>
        <Sor cim={F.address}>{d.client.address}</Sor>
        <Sor cim={F.birth}>{d.client.birth}</Sor>
        <Sor cim="Anyja neve">{d.client.motherName}</Sor>
        <Sor cim={F.type}>{d.typeLabel}</Sor>
        <Sor cim={F.year}>{d.year}</Sor>
        <Sor cim={F.purpose}>{d.purposeText ?? d.purposeLabel}</Sor>
        <Sor cim={F.user}>{d.userName}</Sor>
        <Sor cim={F.extended}>{d.extended ? { igen: 'Igen, bevallási adatokkal', nem: 'Nem', nem_tudom: 'Nem tudja – kérdezd meg' }[d.extended] : null}</Sor>
        <Sor cim={F.official}>{d.official ? (d.official === 'hivatalos' ? 'Hatósági bizonyítvány (8 nap)' : 'Kinyomtatott kivonat elég') : null}</Sor>
        <Sor cim={F.other}>{d.otherText}</Sor>
        <Sor cim={F.copies}>{d.copies}</Sor>
        <Sor cim={F.delivery}>{d.delivery}</Sor>
        <Sor cim={F.english}>{d.englishRequested ? CERT_PANEL_TEXTS.englishNote : null}</Sor>
        <Sor cim={F.neededBy}>{d.neededBy ? datum(d.neededBy, { ev: true }) : null}</Sor>
        <Sor cim={F.fee}>{d.feeHuf > 0 ? `${d.feeHuf.toLocaleString('hu-HU')} Ft (${d.feeStatus ?? ''})` : 'benne van a havidíjban'}</Sor>
        <p className="halvany" style={{ fontSize: 13.5, marginTop: 8 }}>
          {CERT_PANEL_TEXTS.never}
        </p>
      </div>
      <div className="szak">
        <div className="szak-fej">
          <I3 n="hataridok" />
          <h2>Hol tart?</h2>
        </div>
        {[...d.timeline].reverse().map((e, i) => (
          <div key={`${e.status}-${e.at}`} style={{ padding: '5px 0', fontSize: 14.5, lineHeight: 1.45 }}>
            <span style={{ fontWeight: i === 0 ? 650 : 450 }}>{e.text}</span>
            <span className="halvany">
              {' '}
              · {idopont(e.at, t)}
              {e.by ? ` · ${e.by}` : ''}
              {e.note && e.status === 'navnal' ? ` · iktatószám: ${e.note}` : ''}
            </span>
          </div>
        ))}
        {d.resultDocumentId ? (
          <p style={{ marginTop: 6 }}>
            <Link to={`/ugyfelek/${d.clientId}/dosszie`}>Az igazolás az ügyfél dossziéjában</Link>
          </p>
        ) : null}
      </div>
      {nyitott || d.status === 'dijra_var' ? (
        <>
          {d.status === 'beerkezett' ? (
            <div className="szak">
              <div className="szak-fej">
                <I3 n="feltoltes" />
                <h2>{CERT_PANEL_TEXTS.submitted}</h2>
              </div>
              <div className="mezosor k2">
                <label className="mezo">
                  <span className="felirat">{CERT_PANEL_TEXTS.submittedDate}</span>
                  <input className="doboz" type="date" value={beadva} max={t} onChange={(e) => setBeadva(e.target.value)} />
                </label>
                <label className="mezo">
                  <span className="felirat">{CERT_PANEL_TEXTS.iktatoszam}</span>
                  <input className="doboz" value={iktato} maxLength={60} onChange={(e) => setIktato(e.target.value)} />
                </label>
              </div>
              <button type="button" className="gomb-e" style={{ marginTop: 12 }} disabled={bead.isPending || !beadva} onClick={() => bead.mutate()}>
                {CERT_PANEL_TEXTS.submitted}
              </button>
            </div>
          ) : null}
          {nyitott ? (
            <div className="szak">
              <div className="szak-fej">
                <I3 n="igazolas" />
                <h2>{komaKell ? CERT_PANEL_TEXTS.komaTitle : CERT_PANEL_TEXTS.upload}</h2>
              </div>
              {komaKell ? (
                <div className="valaszto" role="radiogroup" style={{ marginBottom: 10 }}>
                  {KOMA_OUTCOMES.map((o) => (
                    <label key={o}>
                      <input type="radio" name="koma" checked={koma === o} onChange={() => setKoma(o)} /> {CERT_PANEL_TEXTS.koma[o]}
                    </label>
                  ))}
                </div>
              ) : null}
              {komaKell && koma === 'benne_van' ? (
                <label className="mezo">
                  <span className="felirat">{CERT_PANEL_TEXTS.komaSince}</span>
                  <input className="doboz" type="date" max={t} value={komaNap} onChange={(e) => setKomaNap(e.target.value)} />
                </label>
              ) : null}
              {komaKell && koma === 'felvetel_kerve' ? (
                <label className="mezo">
                  <span className="felirat">{CERT_PANEL_TEXTS.komaMonth}</span>
                  <input className="doboz" type="month" value={komaHo} onChange={(e) => setKomaHo(e.target.value)} />
                </label>
              ) : null}
              {!komaKell || koma === 'igazolas' ? (
                <label className="mezo">
                  <span className="felirat">Az igazolás PDF-je</span>
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
                  <span className="sugo">{CERT_PANEL_TEXTS.uploadHint}</span>
                </label>
              ) : null}
              <button type="button" className="gomb-e" style={{ marginTop: 12 }} disabled={kesz.isPending || !keszMehet} onClick={() => kesz.mutate()}>
                {komaKell && koma !== 'igazolas' ? 'Kész – rögzítem az eredményt' : CERT_PANEL_TEXTS.upload}
              </button>
            </div>
          ) : null}
          <div className="szak">
            {mutatElutasit ? (
              <>
                <div className="szak-fej">
                  <I3 n="irat" />
                  <h2>{CERT_PANEL_TEXTS.reject}</h2>
                </div>
                <div className="valaszto" style={{ marginBottom: 10 }}>
                  {CERT_REJECT_QUICK.map((o) => (
                    <label key={o}>
                      <input type="radio" name="ok" checked={okGyors === o} onChange={() => setOkGyors(o)} /> {o}
                    </label>
                  ))}
                </div>
                <label className="mezo">
                  <span className="felirat">{CERT_PANEL_TEXTS.rejectReason}</span>
                  <textarea className="doboz" maxLength={CERT_RULES.rejectReasonMax} value={ok} onChange={(e) => setOk(e.target.value)} />
                  <span className="sugo">Az ügyfél ezt látja. Legfeljebb 300 karakter.</span>
                </label>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button type="button" className="gomb-v" disabled={elutasit.isPending || (!ok.trim() && (!okGyors || okGyors === 'Más'))} onClick={() => elutasit.mutate()}>
                    {CERT_PANEL_TEXTS.reject}
                  </button>
                  <button type="button" className="gomb-m csak-szoveg" onClick={() => setMutatElutasit(false)}>
                    Mégsem
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="gomb-m" to={`/ugyfelek/${d.clientId}/uzenetek`}>
                  <I3 n="uzenetek" s={22} /> {CERT_PANEL_TEXTS.message}
                </Link>
                <button type="button" className="gomb-m csak-szoveg" onClick={() => setMutatElutasit(true)}>
                  {CERT_PANEL_TEXTS.reject}
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
