// Shared request pieces: new request to a client, and handling a request (status, note, result PDF).
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { RequestSummary } from '../../api/types';
import { Fiok } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { CERT_LABEL, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from '../../lib/labels';
import { datum, HONAPOK } from '../../lib/format';
import { today } from '../../lib/today';
import { fajlHiba } from '../../lib/validate';
import type { RequestStatus } from '../../_shared/enums';

const MINTAK = [
  { title: 'Töltsd fel {honapNevelos} bankszámlakivonatodat.', body: 'Csak ellenőrzéshez kell, a befizetendő összeg nem változik. Elég a bankod appjából letöltött PDF.', type: 'dokumentum' as const },
  { title: 'Fotózd le a nyugtatömb lapjait.', body: 'Elég a hónap végén egyszerre, a Fotózás gombbal.', type: 'dokumentum' as const },
  { title: 'Írd meg az új címedet.', body: 'A NAV-nál is át kell vezetnünk. Ha van új lakcímkártyád, azt is fotózd le.', type: 'adat' as const },
];

/** "2026-10" → "az októberi", "2026-09" → "a szeptemberi" */
export function honapNevelos(month: string): string {
  const n = HONAPOK[Number(month.slice(5, 7)) - 1]!;
  return `${/^[aáeéiíoóöőuúüű]/i.test(n) ? 'az' : 'a'} ${n}i`;
}

export function keresCim(r: RequestSummary): string {
  if (r.certificate) return `${CERT_LABEL[r.certificate.certificateType]}${r.certificate.year ? `, ${r.certificate.year}` : ''}`;
  return r.title || REQUEST_TYPE_LABEL[r.type];
}

export function UjKeresFiok({ nyitva, bezar, clientId, ugyfel }: { nyitva: boolean; bezar: () => void; clientId: string; ugyfel: string }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const t = today();
  const elozoHonap = (() => {
    const [y, m] = t.split('-').map(Number);
    const d = new Date(Date.UTC(y!, m! - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  })();
  const honapNev = honapNevelos(elozoHonap);
  const [f, setF] = useState({ type: 'dokumentum' as 'dokumentum' | 'adat' | 'egyeb', title: '', body: '', dueDate: '', dossierMonth: elozoHonap });
  useEffect(() => {
    if (nyitva) setF({ type: 'dokumentum', title: '', body: '', dueDate: '', dossierMonth: elozoHonap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nyitva]);
  const kuld = useMutation({
    mutationFn: () =>
      ep.accCreateRequest(clientId, { type: f.type, title: f.title.trim(), body: f.body.trim(), dueDate: f.dueDate || undefined, dossierMonth: f.type === 'dokumentum' ? f.dossierMonth : undefined }),
    onSuccess: () => {
      pir.ok(`Elküldve. ${ugyfel} értesítést kapott.`);
      void qc.invalidateQueries({ queryKey: ['acc', 'requests'] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', clientId] });
      void qc.invalidateQueries({ queryKey: ['acc', 'messages', clientId] });
      bezar();
    },
    onError: pir.hiba,
  });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      ikon="feltoltes"
      cim={`Kérés ${ugyfel} részére`}
      bev="A főoldalán „kéri” kártyaként látja, és üzenetben is megkapja. Ha iratot kérsz, egy gombbal feltöltheti."
      lab={
        <button className="gomb-e" disabled={!f.title.trim() || kuld.isPending} onClick={() => kuld.mutate()}>
          Elküldöm
        </button>
      }
    >
      <div className="mezo">
        <span className="felirat">Mit kérsz?</span>
        <div className="valaszto">
          {(['dokumentum', 'adat', 'egyeb'] as const).map((k) => (
            <label key={k}>
              <input type="radio" name="kt" checked={f.type === k} onChange={() => setF({ ...f, type: k })} />
              {k === 'dokumentum' ? 'Iratot' : k === 'adat' ? 'Adatot' : 'Mást'}
            </label>
          ))}
        </div>
      </div>
      <div className="mezo" style={{ marginTop: 14 }}>
        <span className="felirat">Gyors minták</span>
        <div className="cimkek">
          {MINTAK.filter((m) => m.type === f.type || f.type === 'egyeb').map((m) => (
            <button key={m.title} type="button" className="gomb-m kicsi csak-szoveg" onClick={() => setF({ ...f, title: m.title.replace('{honapNevelos}', honapNev), body: m.body })}>
              {m.title.replace('{honapNevelos}', honapNev).slice(0, 44)}
              {m.title.length > 44 ? '…' : ''}
            </button>
          ))}
        </div>
      </div>
      <label className="mezo" style={{ marginTop: 14 }}>
        <span className="felirat">Egy mondatban</span>
        <input className="doboz" maxLength={140} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Töltsd fel az októberi bankszámlakivonatodat." />
      </label>
      <label className="mezo" style={{ marginTop: 14 }}>
        <span className="felirat">Miért kell, mit csináljon (nem kötelező)</span>
        <textarea className="doboz" rows={3} maxLength={1000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </label>
      <div className="mezosor k2" style={{ marginTop: 14 }}>
        <label className="mezo">
          <span className="felirat">Határidő</span>
          <input className="doboz" type="date" min={t} max={`${Number(t.slice(0, 4)) + 1}-12-31`} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </label>
        {f.type === 'dokumentum' && (
          <label className="mezo">
            <span className="felirat">Melyik hónap dossziéjába</span>
            <input className="doboz" type="month" value={f.dossierMonth} onChange={(e) => setF({ ...f, dossierMonth: e.target.value })} />
          </label>
        )}
      </div>
    </Fiok>
  );
}

export function KeresKezeloFiok({ r, ugyfel, clientId, bezar }: { r: RequestSummary | null; ugyfel: string; clientId: string; bezar: () => void }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const [note, setNote] = useState('');
  const [fajl, setFajl] = useState<File | null>(null);
  const [navNap, setNavNap] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setNote('');
    setFajl(null);
    setNavNap(r?.certificate?.submittedToNavAt ?? '');
  }, [r?.id, r?.status, r?.certificate?.submittedToNavAt]);
  const mentes = useMutation({
    mutationFn: async (status: RequestStatus) => {
      let resultDocumentId: string | undefined;
      if (fajl && status === 'teljesitve') {
        const d = await ep.accUploadDocument(clientId, [fajl], {
          category: 'igazolas',
          dossierMonth: today().slice(0, 7),
          title: r ? keresCim(r) : 'Igazolás',
          visibility: 'kozos',
          status: 'feldolgozva',
        });
        resultDocumentId = d.id;
      }
      return ep.accPatchRequest(r!.id, { status, statusNote: note.trim() || undefined, resultDocumentId, submittedToNavAt: navNap || undefined });
    },
    onSuccess: (_d, status) => {
      pir.ok(status === 'teljesitve' ? `Kész. ${ugyfel} értesítést kapott.` : `Új állapot: ${REQUEST_STATUS_LABEL[status]}.`);
      void qc.invalidateQueries({ queryKey: ['acc', 'requests'] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', clientId] });
      void qc.invalidateQueries({ queryKey: ['acc', 'messages', clientId] });
      bezar();
    },
    onError: pir.hiba,
  });
  if (!r) return null;
  const tole = r.direction === 'ugyfeltol';
  const lezart = r.status === 'teljesitve' || r.status === 'elutasitva' || r.status === 'visszavonva';
  // A certificate cannot be closed as done with nothing for the client: attach it, or say where it went.
  const igazolasHianyzik = tole && !!r.certificate && !fajl && !note.trim();
  return (
    <Fiok
      nyitva
      bezar={bezar}
      ikon={tole ? 'igazolas' : 'feltoltes'}
      cim={keresCim(r)}
      bev={`${tole ? `${ugyfel} kérte` : 'Te kérted'} ${datum(r.createdAt.slice(0, 10))} · ${REQUEST_STATUS_LABEL[r.status]}`}
      lab={
        lezart ? undefined : (
          <>
            {tole && r.status === 'nyitott' && (
              <button className="gomb-m csak-szoveg" disabled={mentes.isPending} onClick={() => mentes.mutate('folyamatban')}>
                Elkezdtem
              </button>
            )}
            <button
              className="gomb-e"
              disabled={mentes.isPending || igazolasHianyzik}
              onClick={() => mentes.mutate('teljesitve')}
              title={igazolasHianyzik ? 'Csatold az igazolást, vagy írd meg, hol találja (pl. a NAV a tárhelyére küldte).' : undefined}
            >
              {tole ? 'Kész, elküldöm' : 'Lezárom, megvan'}
            </button>
            {tole && (
              <button className="gomb-v" disabled={mentes.isPending || !note.trim()} onClick={() => mentes.mutate('elutasitva')} title={!note.trim() ? 'Írd meg, miért nem lehet' : undefined}>
                Nem lehet
              </button>
            )}
            {!tole && r.status === 'nyitott' && (
              <button className="gomb-v" disabled={mentes.isPending} onClick={() => mentes.mutate('visszavonva')} title="Amíg az ügyfél nem kezdett bele, visszavonhatod.">
                Visszavonom
              </button>
            )}
          </>
        )
      }
    >
      {r.body && <p style={{ whiteSpace: 'pre-wrap', fontSize: 15.5 }}>{r.body}</p>}
      {r.certificate && (
        <dl className="adatok" style={{ marginTop: 12 }}>
          <dt>Igazolás</dt>
          <dd>{CERT_LABEL[r.certificate.certificateType]}</dd>
          {r.certificate.year && (
            <>
              <dt>Év</dt>
              <dd>{r.certificate.year}</dd>
            </>
          )}
          <dt>Mire kell</dt>
          <dd>{r.certificate.purpose}</dd>
          <dt>Nyelv</dt>
          <dd>{r.certificate.language === 'en' ? 'angol' : 'magyar'}</dd>
        </dl>
      )}
      {r.dueDate && <p className="halvany" style={{ marginTop: 10 }}>Határidő: {datum(r.dueDate)}</p>}
      {r.certificate?.submittedToNavAt && <p className="halvany" style={{ marginTop: 6 }}>NAV-nál kérve: {datum(r.certificate.submittedToNavAt)}</p>}
      {!lezart && (
        <>
          {tole && r.certificate && (
            <div style={{ marginTop: 18 }}>
              <div className="uzenet-sav info">Az igazolást az ONYA-ban kéred le a NAV-tól, az ügyfél nevében. Ha megjött, töltsd fel ide – az ügyfél a dossziéban és üzenetben is megkapja.</div>
              <div className="mezosor k2" style={{ marginTop: 12 }}>
                <label className="mezo">
                  <span className="felirat">NAV-nál kérve</span>
                  <input className="doboz" type="date" min="2020-01-01" max={today()} value={navNap} onChange={(e) => setNavNap(e.target.value)} />
                </label>
              </div>
            </div>
          )}
          {tole && (
            <div
              className="ejtozona"
              style={{ marginTop: 14, justifyContent: 'flex-start' }}
              role="button"
              tabIndex={0}
              onClick={() => ref.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFajl(e.dataTransfer.files[0] ?? null);
              }}
            >
              <I3 n={fajl ? 'irat' : 'feltoltes'} s={44} />
              <span style={{ color: fajl ? 'var(--tinta)' : undefined }}>
                {fajl ? fajl.name : r.certificate ? 'Az igazolás csatolása (PDF)' : 'Eredmény csatolása (PDF)'}
                <span className="al">
                  {fajl
                    ? (fajlHiba(fajl) ?? 'Kattints, ha másikat választanál.')
                    : r.certificate
                      ? 'Húzd ide, vagy kattints. Ha nem csatolod, a megjegyzésben írd meg, hol találja.'
                      : 'Nem kötelező. Húzd ide, vagy kattints.'}
                </span>
              </span>
              <input ref={ref} type="file" hidden accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <label className="mezo" style={{ marginTop: 14 }}>
            <span className="felirat">
              Megjegyzés {tole ? 'neki' : 'a lezáráshoz'} {tole && r.certificate ? (fajl ? '(nem kötelező)' : '(csatolás nélkül kötelező)') : '(nem kötelező)'}
            </span>
            <textarea
              className="doboz"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tole ? (r.certificate ? 'Pl. „A NAV a tárhelyedre küldte, az Ügyfélkapu+-ban megtalálod.”' : 'Pl. „Elkészítem, és szólok, ha kész.”') : ''}
            />
            {igazolasHianyzik && <span className="sugo">A „Kész, elküldöm” akkor él, ha csatolod az igazolást, vagy megírod, hol találja.</span>}
          </label>
        </>
      )}
    </Fiok>
  );
}
