// Dosszié: documents by month, drag-and-drop upload, status changes (single + bulk), comment for the client,
// NAV invoice group, revenue items of the month (FUNKCIOK 12–15, 23; SPEC §6.2).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { AccDocument, DocumentUploadMeta } from '../../../api/types';
import { Fiok, Ft, HibaSav, Toltes, Ures, EvValaszto, Lenyilo } from '../../../ui/kozos';
import { I3, IkonJelvennyel } from '../../../ui/Icon3d';
import { DokAllapot } from '../../../ui/domain';
import { usePirito } from '../../../ui/Pirito';
import { useKonyveloNev } from '../../../auth/Auth';
import { CATEGORY_ICON, CATEGORY_LABEL, DOC_STATUS_ORDER, docStatusLabel } from '../../../lib/labels';
import { datum, datumRovid, fajlMeret, HONAPOK, honapNev, idopont, nagybetu, parseFt, szam } from '../../../lib/format';
import { today } from '../../../lib/today';
import { fajlHiba } from '../../../lib/validate';
import { DOCUMENT_CATEGORIES, type DocumentCategory, type DocumentStatus, type DocumentVisibility } from '../../../_shared/enums';
import { INVOICE_WORDING } from '../../../_shared/bekotes';

export default function Dosszie({ c }: FulProps) {
  const t = today();
  const [sp, setSp] = useSearchParams();
  const ev = Number(sp.get('ev') ?? t.slice(0, 4));
  const honap = sp.get('honap') ?? (ev === Number(t.slice(0, 4)) ? t.slice(0, 7) : `${ev}-12`);
  const nev = useKonyveloNev();
  const qc = useQueryClient();
  const pir = usePirito();
  const honapok = useQuery({ queryKey: ['acc', 'dossiers', c.id, ev], queryFn: () => ep.accDossierMonths(c.id, ev) });
  const q = useQuery({ queryKey: ['acc', 'dossier', c.id, honap], queryFn: () => ep.accDossier(c.id, honap) });
  const [kijelolt, setKijelolt] = useState<Set<string>>(new Set());
  const [nyitott, setNyitott] = useState<string | null>(null);
  const [feltolt, setFeltolt] = useState<File[] | null>(null);
  useEffect(() => setKijelolt(new Set()), [honap]);
  const inv = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['acc', 'dossier', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'dossiers', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
  }, [qc, c.id]);
  const allapot = useMutation({
    mutationFn: (x: { ids: string[]; status: DocumentStatus }) =>
      x.ids.length === 1 ? ep.accPatchDocument(x.ids[0]!, { status: x.status }) : ep.accBulkDocumentStatus(x.ids, x.status),
    onSuccess: (_d, x) => {
      pir.ok(x.ids.length > 1 ? `${x.ids.length} irat: ${docStatusLabel(x.status, nev)}` : `Új állapot: ${docStatusLabel(x.status, nev)}`);
      setKijelolt(new Set());
      inv();
    },
    onError: pir.hiba,
  });
  const navAllapot = useMutation({
    mutationFn: (status: DocumentStatus) => ep.accNavInvoicesBulk(c.id, honap, status),
    onSuccess: () => {
      pir.ok('A hónap kiállított számlái feldolgozva.');
      inv();
    },
    onError: pir.hiba,
  });

  const valasz = (m: string) => {
    const n = new URLSearchParams(sp);
    n.set('honap', m);
    n.set('ev', m.slice(0, 4));
    setSp(n, { replace: true });
  };
  const honapLista = useMemo(() => {
    const max = ev === Number(t.slice(0, 4)) ? Number(t.slice(5, 7)) : 12;
    return Array.from({ length: max }, (_, i) => `${ev}-${String(i + 1).padStart(2, '0')}`);
  }, [ev, t]);
  const stat = new Map(honapok.data?.months.map((m) => [m.month, m]) ?? []);
  const d = q.data;
  const navTipus = (x: AccDocument) => x.category === 'nav_level' || x.source === 'nav';
  const ugyfeltol = d?.documents.filter((x) => x.source === 'ugyfel' && !navTipus(x)) ?? [];
  const tolem = d?.documents.filter((x) => (x.source === 'konyvelo' || x.source === 'rendszer') && !navTipus(x)) ?? [];
  const navLevelek = d?.documents.filter(navTipus) ?? [];
  const varakozik = ugyfeltol.filter((x) => x.status === 'feltoltve' || x.status === 'konyvelo_latta').length;
  const osszes = (d?.documents.length ?? 0) + (d?.navInvoices.items.length ? 1 : 0);

  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14, alignItems: 'flex-start', gap: 16 }}>
        <div className="szegmens" role="tablist" aria-label="Hónap">
          {honapLista.map((m) => {
            const s = stat.get(m);
            return (
              <button key={m} role="tab" aria-selected={m === honap} className={m === honap ? 'on' : ''} onClick={() => valasz(m)} title={s ? `${s.documentCount} irat, ${s.waitingCount} vár rád` : undefined}>
                {HONAPOK[Number(m.slice(5)) - 1]!.slice(0, 3)}
                {s && s.waitingCount > 0 && <span className="db">{s.waitingCount}</span>}
              </button>
            );
          })}
        </div>
        <EvValaszto
          ev={Number(ev)}
          evek={[Number(t.slice(0, 4)), Number(t.slice(0, 4)) - 1]}
          valt={(y) => setSp({ ev: String(y), honap: String(y) === t.slice(0, 4) ? t.slice(0, 7) : `${y}-12` }, { replace: true })}
        />
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {q.isPending ? (
        <Toltes />
      ) : (
        d && (
          <div className="racs fo-mellek">
            <div>
              <div className="szakasz" style={{ paddingTop: 2 }}>
                {nagybetu(HONAPOK[Number(honap.slice(5)) - 1]!)}i dosszié
                <span className="megj">
                  {osszes} tétel{varakozik ? `, ebből ${varakozik} rád vár` : ', mindegyiket láttad'}
                </span>
              </div>
              <EjtoZona onFiles={(f) => setFeltolt(f)} />
              {kijelolt.size > 0 && (
                <div className="uzenet-sav info" style={{ marginTop: 12, alignItems: 'center' }}>
                  <b>{kijelolt.size} kijelölve.</b>
                  <span className="ures-hely" />
                  {(['konyvelo_latta', 'feldolgozva', 'beadva'] as DocumentStatus[]).map((s) => (
                    <button key={s} className="gomb-m kicsi csak-szoveg" disabled={allapot.isPending} onClick={() => allapot.mutate({ ids: [...kijelolt], status: s })}>
                      {docStatusLabel(s, nev)}
                    </button>
                  ))}
                  <button className="gomb-sz" onClick={() => setKijelolt(new Set())}>
                    Mégse
                  </button>
                </div>
              )}
              <div className="szakasz">Amit {c.firstName} küldött</div>
              <div className="lap">
                {ugyfeltol.length === 0 ? (
                  <Ures n="ures_mappa" cim="Ebben a hónapban még nem töltött fel semmit">
                    Ha hiányzik valami, küldj neki kérést a Kérések fülön.
                  </Ures>
                ) : (
                  <DokTabla docs={ugyfeltol} nev={nev} kijelolt={kijelolt} setKijelolt={setKijelolt} nyit={setNyitott} allapot={(id, s) => allapot.mutate({ ids: [id], status: s })} />
                )}
              </div>
              {/* SPEC §27.5.2: the client's issued invoices (downloaded from NAV Online Számla) and NAV letters are two things. */}
              <div className="szakasz tores">
                {INVOICE_WORDING.staffSection} <span className="megj">{INVOICE_WORDING.staffNoUpload}</span>
              </div>
              <div className="lap">
                {d.navInvoices.items.length > 0 ? (
                  <div className="ikonsor">
                    <IkonJelvennyel n="szamlak" kesz={d.navInvoices.status === 'feldolgozva' || d.navInvoices.status === 'beadva'} />
                    <div className="l">
                      <div className="cim">
                        {d.navInvoices.items.length} kiállított számla · <Ft n={d.navInvoices.totalHuf} />
                        {d.navInvoices.items.some((i) => i.demo) && <span className="cimke demo" style={{ marginLeft: 8 }}>DEMO</span>}
                      </div>
                      <div className="al">{d.navInvoices.status && <DokAllapot s={d.navInvoices.status} firstName={nev} nav />}</div>
                    </div>
                    {d.navInvoices.status !== 'feldolgozva' && d.navInvoices.status !== 'beadva' && (
                      <button className="gomb-m kicsi csak-szoveg" disabled={navAllapot.isPending} onClick={() => navAllapot.mutate('feldolgozva')}>
                        Mind feldolgozva
                      </button>
                    )}
                    <Link className="gomb-sz" to={`/ugyfelek/${c.id}/nav?honap=${honap}`}>
                      Részletek
                    </Link>
                  </div>
                ) : (
                  <div className="ikonsor">
                    <span className="halvany">Ebben a hónapban nincs letöltött kiállított számla.</span>
                  </div>
                )}
              </div>
              {navLevelek.length > 0 && (
                <>
                  <div className="szakasz">Levél a NAV-tól</div>
                  <div className="lap">
                    {navLevelek.map((x) => (
                      <DokSor key={x.id} x={x} nev={nev} nyit={setNyitott} />
                    ))}
                  </div>
                </>
              )}
              <div className="szakasz">Amit te tettél fel</div>
              <div className="lap">
                {tolem.length === 0 ? (
                  <div className="ikonsor">
                    <span className="halvany">Még semmi. Bevallást a „Beadva” gombbal az Adó fülön töltesz fel.</span>
                  </div>
                ) : (
                  tolem.map((x) => <DokSor key={x.id} x={x} nev={nev} nyit={setNyitott} />)
                )}
              </div>
            </div>
            <div>
              <div className="lap">
                <div className="lap-fej">
                  <h2>Bevételek ebben a hónapban</h2>
                </div>
                {d.revenueItems.length === 0 ? (
                  <div className="belso halvany" style={{ paddingTop: 0 }}>Nincs bevétel ebben a hónapban.</div>
                ) : (
                  <table className="tabla">
                    <tbody>
                      {d.revenueItems.slice(0, 12).map((r) => (
                        <tr key={r.id}>
                          <td className="elso">
                            <div style={{ fontWeight: 550 }}>{r.description}</div>
                            <div className="al">
                              {datum(r.receivedOn)}
                              {r.receivedOn > t ? ' (várható, még nem jött meg)' : r.receivedOnEstimated && ' (becsült dátum)'}
                            </div>
                          </td>
                          <td className="jobb utolso">
                            <Ft n={r.amountHuf} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {/* Ugyanaz a szabály, mint a Bevételek fülön: a még meg nem érkezett (várható) tétel külön sor. */}
                      <tr>
                        <td className="elso">Összesen</td>
                        <td className="jobb utolso">
                          <Ft n={d.revenueItems.filter((r) => r.countsForAtalany && r.receivedOn <= t).reduce((a, r) => a + r.amountHuf, 0)} />
                        </td>
                      </tr>
                      {d.revenueItems.some((r) => r.countsForAtalany && r.receivedOn > t) && (
                        <tr>
                          <td className="elso halvany">Várható (még nem jött meg)</td>
                          <td className="jobb utolso halvany">
                            <Ft n={d.revenueItems.filter((r) => r.countsForAtalany && r.receivedOn > t).reduce((a, r) => a + r.amountHuf, 0)} />
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                )}
              </div>
              {d.openRequests.length > 0 && (
                <div className="lap" style={{ marginTop: 16 }}>
                  <div className="lap-fej">
                    <h2>Nyitott kérések</h2>
                  </div>
                  {d.openRequests.map((r) => (
                    <div className="ikonsor" key={r.id}>
                      <I3 n={r.direction === 'konyvelotol' ? 'feltoltes' : 'kerdoiv'} s={36} />
                      <div className="l">
                        <div className="cim">{r.title}</div>
                        <div className="al">
                          {r.direction === 'konyvelotol' ? 'Te kérted' : 'Ő kérte'}
                          {r.dueDate && `, határidő ${datum(r.dueDate)}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {d.review && (
                <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
                  Utoljára átnézted: {idopont(d.review.at, t)} ({d.review.okCount} irat rendben).
                </p>
              )}
            </div>
          </div>
        )
      )}
      <DokFiok id={nyitott} bezar={() => setNyitott(null)} nev={nev} ugyfel={c.firstName} onChange={inv} />
      <FeltoltesFiok files={feltolt} bezar={() => setFeltolt(null)} clientId={c.id} honap={honap} kesz={inv} />
    </>
  );
}

function DokTabla({
  docs,
  nev,
  kijelolt,
  setKijelolt,
  nyit,
  allapot,
}: {
  docs: AccDocument[];
  nev: string;
  kijelolt: Set<string>;
  setKijelolt: (s: Set<string>) => void;
  nyit: (id: string) => void;
  allapot: (id: string, s: DocumentStatus) => void;
}) {
  const t = today();
  const mind = docs.every((d) => kijelolt.has(d.id));
  return (
    <table className="tabla">
      <thead>
        <tr>
          <th className="elso" style={{ width: 40 }}>
            <input type="checkbox" aria-label="Mind kijelölése" checked={mind} onChange={() => setKijelolt(mind ? new Set() : new Set(docs.map((d) => d.id)))} />
          </th>
          <th>Irat</th>
          <th className="utolso">Állapot</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((x) => (
          <tr key={x.id} className={`kattinthato${kijelolt.has(x.id) ? ' kijelolt' : ''}`} onClick={() => nyit(x.id)}>
            <td className="elso" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                aria-label={`${x.title} kijelölése`}
                checked={kijelolt.has(x.id)}
                onChange={() => {
                  const n = new Set(kijelolt);
                  if (n.has(x.id)) n.delete(x.id);
                  else n.add(x.id);
                  setKijelolt(n);
                }}
              />
            </td>
            <td>
              <div className="sor-flex" style={{ gap: 12 }}>
                <IkonJelvennyel n={CATEGORY_ICON[x.category]} kesz={x.status === 'feldolgozva' || x.status === 'beadva'} />
                <div>
                  {/* Billentyűzettel is megnyitható: a cím egy gomb (a sor kattintása egérrel marad). */}
                  <button
                    type="button"
                    className="link-gomb"
                    style={{ fontWeight: 600, background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      nyit(x.id);
                    }}
                  >
                    {x.title}
                  </button>
                  <div className="al">
                    {CATEGORY_LABEL[x.category]}
                    {x.pageCount > 1 && ` · ${x.pageCount} oldal`}
                    {x.amountHuf != null && <> · {szam(x.amountHuf)} Ft</>}
                    {x.visibility === 'csak_konyvelo' && ' · csak te látod'} · feltöltve {idopont(x.createdAt, t)}
                  </div>
                  {x.clientNote && <div className="al">„{x.clientNote}”</div>}
                </div>
              </div>
            </td>
            <td className="utolso" onClick={(e) => e.stopPropagation()} style={{ width: 186 }}>
              <Lenyilo className="doboz" style={{ height: 36, width: 196, fontSize: 14 }} value={x.status} onChange={(e) => allapot(x.id, e.target.value as DocumentStatus)} aria-label="Állapot">
                {DOC_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {docStatusLabel(s, nev)}
                  </option>
                ))}
              </Lenyilo>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DokSor({ x, nev, nyit }: { x: AccDocument; nev: string; nyit: (id: string) => void }) {
  return (
    <button className="ikonsor" style={{ width: '100%', textAlign: 'left' }} onClick={() => nyit(x.id)}>
      <IkonJelvennyel n={CATEGORY_ICON[x.category]} kesz={x.status === 'feldolgozva' || x.status === 'beadva'} />
      <div className="l">
        <div className="cim">
          {x.title}
          {x.visibility === 'csak_konyvelo' && <span className="cimke" style={{ marginLeft: 8 }}>csak te látod</span>}
        </div>
        <div className="al">
          <DokAllapot s={x.status} firstName={nev} mikor={datum(x.statusAt.slice(0, 10))} />
        </div>
      </div>
      <span className="gomb-sz">Megnyitom</span>
    </button>
  );
}

function EjtoZona({ onFiles }: { onFiles: (f: File[]) => void }) {
  const [aktiv, setAktiv] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`ejtozona${aktiv ? ' aktiv' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setAktiv(true);
      }}
      onDragLeave={() => setAktiv(false)}
      onDrop={(e) => {
        e.preventDefault();
        setAktiv(false);
        const f = Array.from(e.dataTransfer.files);
        if (f.length) onFiles(f);
      }}
    >
      <I3 n="feltoltes" s={44} />
      <span>
        Húzd ide a fájlokat, vagy kattints a feltöltéshez
        <span className="al">PDF, JPG vagy PNG, legfeljebb 25 MB. Több kép egy iratba is mehet.</span>
      </span>
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png"
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (f.length) onFiles(f);
        }}
      />
    </div>
  );
}

function FeltoltesFiok({ files, bezar, clientId, honap, kesz }: { files: File[] | null; bezar: () => void; clientId: string; honap: string; kesz: () => void }) {
  const pir = usePirito();
  const [meta, setMeta] = useState<DocumentUploadMeta>({ category: 'egyeb', dossierMonth: honap, title: '', visibility: 'kozos', status: 'feldolgozva' });
  const [egyben, setEgyben] = useState(false);
  const [halad, setHalad] = useState<number | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  useEffect(() => {
    if (!files) return;
    const first = files[0]?.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 120) ?? '';
    setMeta({ category: /kivonat/i.test(first) ? 'bankszamlakivonat' : /nyugta/i.test(first) ? 'nyugta' : 'egyeb', dossierMonth: honap, title: nagybetu(first), visibility: 'kozos', status: 'feldolgozva' });
    setEgyben(files.length > 1 && files.every((f) => f.type.startsWith('image/')));
    setHalad(null);
    setHiba(null);
  }, [files, honap]);
  if (!files) return null;
  const hibak = files.map(fajlHiba).filter(Boolean) as string[];
  async function kuld() {
    if (!files) return;
    setHiba(null);
    try {
      const csoportok = egyben ? [files] : files.map((f) => [f]);
      for (let i = 0; i < csoportok.length; i++) {
        const g = csoportok[i]!;
        const title = csoportok.length > 1 ? nagybetu(g[0]!.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ')).slice(0, 120) : meta.title;
        await ep.accUploadDocument(clientId, g, { ...meta, title }, (p) => setHalad((i + p) / csoportok.length));
      }
      pir.ok(csoportok.length > 1 ? `${csoportok.length} irat feltöltve.` : 'Feltöltve.');
      kesz();
      bezar();
    } catch (e) {
      setHalad(null);
      setHiba(e instanceof Error ? e.message : 'Nem sikerült.');
    }
  }
  return (
    <Fiok
      nyitva
      bezar={bezar}
      ikon="feltoltes"
      cim={files.length > 1 ? `${files.length} fájl feltöltése` : 'Fájl feltöltése'}
      bev={`${honapNev(honap)}i dosszié. Az ügyfél is látja, hacsak nem jelölöd „csak én látom”-nak.`}
      lab={
        <>
          <button className="gomb-e" disabled={hibak.length > 0 || halad !== null || (!egyben && files.length === 1 && !meta.title.trim())} onClick={() => void kuld()}>
            {halad !== null ? `Feltöltöm… ${Math.round(halad * 100)}%` : 'Feltöltöm'}
          </button>
          {halad !== null && (
            <div className="sav" style={{ flex: 1, margin: 0 }}>
              <i style={{ width: `${halad * 100}%` }} />
            </div>
          )}
        </>
      }
    >
      <ul style={{ listStyle: 'none', display: 'grid', gap: 6, marginBottom: 16 }}>
        {files.map((f) => (
          <li key={f.name + f.size} className="sor-flex">
            <I3 n={f.type === 'application/pdf' ? 'irat_arnyektalan' : 'nyugta_arnyektalan'} s={28} />
            <span style={{ flex: 1 }}>{f.name}</span>
            <span className="halvany kicsi">{fajlMeret(f.size)}</span>
          </li>
        ))}
      </ul>
      {hibak.map((h) => (
        <div key={h} className="uzenet-sav hiba" style={{ marginBottom: 8 }}>{h}</div>
      ))}
      {files.length > 1 && files.every((f) => f.type.startsWith('image/')) && (
        <label className="jelolo" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={egyben} onChange={(e) => setEgyben(e.target.checked)} />
          <span>Egy irat több oldallal (a képekből egy PDF lesz)</span>
        </label>
      )}
      <div className="mezosor k2">
        {(egyben || files.length === 1) && (
          <label className="mezo" style={{ gridColumn: '1 / -1' }}>
            <span className="felirat">Megnevezés</span>
            <input className="doboz" maxLength={120} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          </label>
        )}
        <label className="mezo">
          <span className="felirat">Fajta</span>
          <Lenyilo className="doboz" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value as DocumentCategory })}>
            {DOCUMENT_CATEGORIES.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABEL[k]}
              </option>
            ))}
          </Lenyilo>
        </label>
        <label className="mezo">
          <span className="felirat">Hónap</span>
          <input className="doboz" type="month" value={meta.dossierMonth} onChange={(e) => setMeta({ ...meta, dossierMonth: e.target.value })} />
        </label>
        <label className="mezo">
          <span className="felirat">Ki látja</span>
          <Lenyilo className="doboz" value={meta.visibility} onChange={(e) => setMeta({ ...meta, visibility: e.target.value as DocumentVisibility })}>
            <option value="kozos">Az ügyfél is</option>
            <option value="csak_konyvelo">Csak én</option>
          </Lenyilo>
        </label>
        <label className="mezo">
          <span className="felirat">Állapot</span>
          <Lenyilo className="doboz" value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value as DocumentStatus })}>
            <option value="feldolgozva">Feldolgozva</option>
            <option value="beadva">Beadva</option>
          </Lenyilo>
        </label>
      </div>
      {hiba && <div className="uzenet-sav hiba" style={{ marginTop: 14 }}>{hiba}</div>}
    </Fiok>
  );
}

function DokFiok({ id, bezar, nev, ugyfel, onChange }: { id: string | null; bezar: () => void; nev: string; ugyfel: string; onChange: () => void }) {
  const pir = usePirito();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['acc', 'document', id], queryFn: () => ep.accDocument(id!), enabled: !!id });
  const [kep, setKep] = useState<string | null>(null);
  const [f, setF] = useState({ title: '', amount: '', date: '', comment: '' });
  useEffect(() => {
    if (!q.data) return;
    // opening it in the panel sets "Bence látta" on the server; refresh the lists once
    onChange();
    setF({ title: q.data.title, amount: q.data.amountHuf != null ? szam(q.data.amountHuf) : '', date: q.data.documentDate ?? '', comment: q.data.accountantComment ?? '' });
    setKep(null);
    if (q.data.fileId && q.data.mime?.startsWith('image/')) {
      ep.fileLink(q.data.fileId)
        .then((r) => setKep(r.url))
        .catch(() => setKep(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.id]);
  const ment = useMutation({
    mutationFn: () =>
      ep.accPatchDocument(id!, {
        title: f.title.trim(),
        amountHuf: f.amount.trim() ? parseFt(f.amount) : null,
        documentDate: f.date || null,
        accountantComment: f.comment.trim(),
      }),
    onSuccess: () => {
      pir.ok(f.comment.trim() ? `Elmentve. ${ugyfel} látja a megjegyzésed.` : 'Elmentve.');
      void qc.invalidateQueries({ queryKey: ['acc', 'document', id] });
      onChange();
    },
    onError: pir.hiba,
  });
  const allapot = useMutation({
    mutationFn: (s: DocumentStatus) => ep.accPatchDocument(id!, { status: s }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['acc', 'document', id] });
      onChange();
    },
    onError: pir.hiba,
  });
  const d = q.data;
  const t = today();
  return (
    <Fiok
      nyitva={!!id}
      bezar={bezar}
      szeles
      ikon={d ? CATEGORY_ICON[d.category] : 'irat'}
      cim={d?.title ?? 'Irat'}
      bev={d ? `${CATEGORY_LABEL[d.category]} · ${honapNev(d.dossierMonth)}i dosszié` : undefined}
      lab={
        d && (
          <>
            <button className="gomb-e" disabled={ment.isPending || !f.title.trim()} onClick={() => ment.mutate()}>
              Mentés
            </button>
            {d.fileId && (
              <button className="gomb-m csak-szoveg" onClick={() => void ep.downloadFile(d.fileId!, d.title).catch(pir.hiba)}>
                Letöltés
              </button>
            )}
          </>
        )
      }
    >
      {q.isPending && <Toltes />}
      {q.isError && <HibaSav hiba={q.error} />}
      {d && (
        <div className="racs k2" style={{ alignItems: 'start' }}>
          <div>
            <div className="okmany" style={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
              {kep ? (
                <img src={kep} alt={d.title} style={{ aspectRatio: 'auto', maxHeight: 520, objectFit: 'contain' }} />
              ) : (
                <div className="ures" style={{ padding: 20 }}>
                  <I3 n={d.mime === 'application/pdf' ? 'irat' : CATEGORY_ICON[d.category]} s={72} style={{ margin: '0 auto' }} />
                  <p>{d.pageCount > 1 ? `${d.pageCount} oldalas PDF` : d.mime === 'application/pdf' ? 'PDF' : 'Előnézet nincs'}</p>
                  {d.fileId && (
                    <div className="gombsor">
                      <button className="gomb-m kicsi csak-szoveg" onClick={() => void ep.fileLink(d.fileId!).then((r) => window.open(r.url, '_blank', 'noopener')).catch(pir.hiba)}>
                        Megnyitás új lapon
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <h3 style={{ fontSize: 15.5, margin: '18px 0 6px' }}>Hol tart</h3>
            <ol style={{ listStyle: 'none', display: 'grid', gap: 6 }}>
              {d.history.map((h, i) => (
                <li key={i} className="sor-flex" style={{ fontSize: 14.5 }}>
                  <span className="szo felkover" style={{ minWidth: 120 }}>{h.label}</span>
                  <span className="halvany">
                    {idopont(h.at, t)}
                    {h.by && `, ${h.by}`}
                  </span>
                </li>
              ))}
            </ol>
            {d.versions.length > 1 && <p className="halvany kicsi" style={{ marginTop: 8 }}>{d.versions.length} változat; a legutóbbit látod.</p>}
          </div>
          <div>
            <div className="mezo">
              <span className="felirat">Állapot</span>
              <div className="valaszto">
                {DOC_STATUS_ORDER.map((s) => (
                  <label key={s}>
                    <input type="radio" name="dst" checked={d.status === s} onChange={() => allapot.mutate(s)} disabled={allapot.isPending} />
                    {docStatusLabel(s, nev)}
                  </label>
                ))}
              </div>
              <span className="sugo">Egyet vissza is léphetsz. „Beadva” magától lesz, amikor a negyedév bevallását beadottnak jelölöd.</span>
            </div>
            {d.clientNote && (
              <div className="uzenet-sav info" style={{ marginTop: 14 }}>
                <div>
                  <b>{ugyfel} megjegyzése:</b> „{d.clientNote}”
                </div>
              </div>
            )}
            <label className="mezo" style={{ marginTop: 14 }}>
              <span className="felirat">Megnevezés</span>
              <input className="doboz" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </label>
            <div className="mezosor k2" style={{ marginTop: 14 }}>
              <label className="mezo">
                <span className="felirat">Összeg (Ft)</span>
                <input className="doboz szam" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
              </label>
              <label className="mezo">
                <span className="felirat">Kelte</span>
                <input className="doboz" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
              </label>
            </div>
            <label className="mezo" style={{ marginTop: 14 }}>
              <span className="felirat">Megjegyzés az ügyfélnek</span>
              <textarea className="doboz" rows={4} maxLength={1000} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="Pl. tipp a következő hónapra. Az irat részleteinél látja." />
            </label>
            <p className="halvany kicsi" style={{ marginTop: 10 }}>
              Feltöltve: {datumRovid(d.statusAt.slice(0, 10))} · {d.createdByRole === 'client' ? ugyfel : d.createdByRole === 'accountant' ? 'te' : 'rendszer'}
            </p>
          </div>
        </div>
      )}
    </Fiok>
  );
}
