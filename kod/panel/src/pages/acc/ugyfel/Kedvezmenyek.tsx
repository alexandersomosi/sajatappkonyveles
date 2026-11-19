// SPEC §28.3.6 – Kedvezmények tab: the client's answers (left) and one card per proposed allowance (right) with the
// months, the parameters, the live effect preview on the year and on each quarter, and Jóváhagyom / Kérdezek / Nem jár.
// Only approved + "év közben" items reach the engine. csapat never sees this tab (API 404); KATA clients have none.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { AccAllowanceItem, AccAllowanceView, AllowanceAnswers, AllowanceParams, AllowancePreview, CsaladiMonthParam } from '../../../api/types';
import { Fiok, HibaSav, Lenyilo, Toltes, Ures } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { ApiError } from '../../../api/client';
import {
  ALLOWANCE_LABELS,
  ALLOWANCE_PANEL_TEXTS,
  ALLOWANCE_REJECT_REASON_LABELS,
  ANYAK_LABELS,
  LOCK_TEXTS,
} from '../../../_shared/bekotes';
import { ALLOWANCE_LIMITS, ALLOWANCE_REJECT_REASONS, ANYAK_JOGCIMEK, type AllowanceRejectReason } from '../../../_shared/enums';
import { HONAP_ROVID, elonezetSorok, honapValt, honapokSzoveg, negyedevHatas } from '../../../lib/k28';
import { datum, ft, idopont } from '../../../lib/format';
import { today } from '../../../lib/today';

const STATUSZ: Record<AccAllowanceItem['status'], { szo: string; cls: string }> = {
  javasolt: { szo: 'Döntésre vár', cls: 'figyel' },
  kerdes: { szo: 'Kérdeztél – válaszra vár', cls: 'info' },
  jovahagyva: { szo: 'Jóváhagyva', cls: '' },
  elutasitva: { szo: 'Nem jár', cls: 'hiba' },
  visszavonva: { szo: 'Az ügyfél visszavonta', cls: '' },
};
const POTLEK: Record<AllowanceAnswers['children'][number]['potlek'], string> = {
  most: 'most is kap rá családi pótlékot',
  tizenket_ev: 'már nem, de legalább 12 évig kapott',
  elhunyt: 'a gyermek halála miatt szűnt meg',
  nem: 'nem kap rá családi pótlékot',
};

export default function Kedvezmenyek({ c }: FulProps) {
  const ev = Number(today().slice(0, 4));
  const q = useQuery({ queryKey: ['acc', 'allowances', c.id, ev], queryFn: () => ep.accAllowances(c.id, ev), enabled: c.taxRegime !== 'kata' });
  if (c.taxRegime === 'kata')
    return (
      <div className="lap belso">
        <h2>Katás ügyfél</h2>
        <p className="halvany" style={{ marginTop: 6 }}>
          A kata az adókedvezményektől nem változik, ezért itt nincs teendőd. Ha munkabére is van, azt a munkáltatója vagy az éves bevallás rendezi.
        </p>
      </div>
    );
  if (q.isPending) return <Toltes />;
  if (q.isError) return <HibaSav hiba={q.error} ujra={() => q.refetch()} />;
  const v = q.data;
  if (!v.answers && v.items.length === 0)
    return (
      <div className="lap">
        <Ures n="ures_mappa" cim="Még nem töltötte ki a kedvezmény-kérdőívet">
          Ha kitölti (a bekötéskor vagy a Fiókban), itt látod a válaszait, és itt döntesz arról, mi jár neki.
        </Ures>
      </div>
    );
  const aktiv = v.items.filter((i) => i.status !== 'visszavonva');
  const regi = v.items.filter((i) => i.status === 'visszavonva');
  return (
    <div className="racs kedvezmeny-racs">
      <Valaszok c={c} v={v} />
      <div className="oszlop" style={{ gap: 16 }}>
        {aktiv.length === 0 && (
          <div className="lap belso">
            <p className="halvany">A válaszai alapján most nem jár neki kedvezmény.</p>
          </div>
        )}
        {aktiv.map((i) => (
          <Tetel key={i.kind} c={c} v={v} it={i} />
        ))}
        {regi.length > 0 && (
          <details className="osszevont">
            <summary>{regi.length} visszavont tétel (a válaszai megváltoztak)</summary>
            <ul className="k28-okok">
              {regi.map((i) => (
                <li key={i.kind}>{i.label}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

// ---------- left: the answers in staff words ----------
function Valaszok({ c, v }: FulProps & { v: AccAllowanceView }) {
  const a = v.answers;
  const pir = usePirito();
  const kerES = useMutation({
    mutationFn: () =>
      ep.accCreateRequest(c.id, { type: 'dokumentum', title: 'A gyermekeid adóazonosító jele', body: ALLOWANCE_PANEL_TEXTS.taxIdsRequest }),
    onSuccess: () => pir.ok('Elküldtük a kérést. A Kérések fülön követheted.'),
    onError: pir.hiba,
  });
  const vanGyerek = (a?.children.length ?? 0) > 0 || !!a?.pregnancy;
  return (
    <div className="lap k28">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="igazolas" s={28} />
          <h2>{ALLOWANCE_PANEL_TEXTS.answersTitle}</h2>
        </div>
        <p className="halvany kicsi">
          {v.submittedAt ? `${v.version}. változat, elküldte: ${idopont(v.submittedAt, today())}` : 'Még nem küldte el (piszkozat).'} ·{' '}
          {v.healthConsentAt ? ALLOWANCE_PANEL_TEXTS.healthConsent.replace('{at}', idopont(v.healthConsentAt, today())) : ALLOWANCE_PANEL_TEXTS.healthConsentNone}
        </p>
      </div>
      {a && (
        <div className="szak">
          <dl className="adatok keskeny-adatok">
            <dt>Született</dt>
            <dd>{a.birthMonth ? `${a.birthMonth.slice(0, 4)}. ${HONAP_ROVID[Number(a.birthMonth.slice(5, 7)) - 1]}` : '–'}</dd>
            <dt>Gyermekek</dt>
            <dd>
              {a.children.length === 0 ? (
                'nincs'
              ) : (
                <ol className="k28-gyerekek">
                  {a.children.map((g, i) => (
                    <li key={i}>
                      {POTLEK[g.potlek]}
                      {g.sajat ? ', saját vagy örökbe fogadott' : ', nem saját'}
                      {g.tartosBeteg ? ', tartósan beteg' : ''}
                      {g.felvaltva ? ', felváltva gondozzák' : ''}
                      {g.potlekKezdeteHo ? `, ${g.potlekKezdeteHo}-től` : ''}
                      {g.potlekVegeHo ? `, ${g.potlekVegeHo}-ig` : ''}
                    </li>
                  ))}
                </ol>
              )}
            </dd>
            {a.otherDependants > 0 && (
              <>
                <dt>Más eltartott</dt>
                <dd>{a.otherDependants}</dd>
              </>
            )}
            <dt>Babát várnak</dt>
            <dd>{a.pregnancy ? `igen, várhatóan ${a.pregnancy.dueMonth}` : 'nem'}</dd>
            {a.mother !== null && (
              <>
                <dt>Ő az anyuka</dt>
                <dd>{a.mother ? 'igen' : 'nem'}</dd>
              </>
            )}
            {a.csaladiWho && (
              <>
                <dt>Családi kedvezmény</dt>
                <dd>
                  {a.csaladiWho === 'en' ? 'ő veszi igénybe' : a.csaladiWho === 'par' ? ALLOWANCE_PANEL_TEXTS.partnerTakes.replace('párod', 'párja') : `megosztják, ő kb. ${a.csaladiSharePct ?? 50}%`}
                  {a.csjkWish && <div className="halvany kicsi">Járulékkedvezmény év közben: {a.csjkWish === 'igen' ? 'kéri' : 'döntsd el te'}</div>}
                </dd>
              </>
            )}
            <dt>Házasság</dt>
            <dd>{a.marriage ? `${a.marriage.month}, ${a.marriage.first ? 'első házasság' : 'nem első'}, ${a.marriage.who === 'en' ? 'ő veszi igénybe' : a.marriage.who === 'par' ? 'a párja' : 'megosztják'}` : 'nem házasodott az elmúlt két évben'}</dd>
            <dt>Fogyatékosság</dt>
            <dd>{a.disability ? `igen${a.disability.fromMonth ? `, ${a.disability.fromMonth}-tól` : ', régebb óta'} (${a.disability.basis === 'orvosi_igazolas' ? 'orvosi igazolás' : a.disability.basis === 'rokkantsagi_jaradek' ? 'rokkantsági járadék' : 'fogyatékossági támogatás'})` : 'nem'}</dd>
            <dt>Táppénz, CSED, GYED</dt>
            <dd>{a.benefit ? `${a.benefit.fromMonth} – ${a.benefit.toMonth ?? 'még kapja'}` : 'nem'}</dd>
          </dl>
          {a.note && (
            <div className="uzenet-sav info" style={{ marginTop: 12 }}>
              <div>
                <b>Megjegyzése:</b> „{a.note}”
              </div>
            </div>
          )}
        </div>
      )}
      {v.legacy.length > 0 && (
        <div className="szak">
          <p className="halvany kicsi">
            {ALLOWANCE_PANEL_TEXTS.legacy}: {v.legacy.map((l) => `${ALLOWANCE_LABELS[l.kind as keyof typeof ALLOWANCE_LABELS] ?? l.kind}${l.note ? ` (${l.note})` : ''}`).join(', ')}
          </p>
        </div>
      )}
      {vanGyerek && (
        <div className="szak">
          <p>{ALLOWANCE_PANEL_TEXTS.taxIdsLine}.</p>
          <p className="halvany kicsi">Nevet, adóazonosítót a kérdőív nem kér. A bevalláshoz egy sima irat-kéréssel kérd el.</p>
          <button className="gomb-m kicsi csak-szoveg" style={{ marginTop: 8 }} disabled={kerES.isPending || !!c.serviceLock} title={c.serviceLock ? LOCK_TEXTS.panelDisabled : undefined} onClick={() => kerES.mutate()}>
            {ALLOWANCE_PANEL_TEXTS.taxIdsButton}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- right: one card per item ----------
function Tetel({ c, v, it }: FulProps & { v: AccAllowanceView; it: AccAllowanceItem }) {
  const pir = usePirito();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [honapok, setHonapok] = useState<number[]>(it.months);
  const [params, setParams] = useState<AllowanceParams>(it.params);
  const [inYear, setInYear] = useState(it.inYear);
  const [dial, setDial] = useState<null | 'kerdes' | 'elutasit'>(null);
  const zarolt = c.serviceLock ? LOCK_TEXTS.panelDisabled : null;
  const valtozott = JSON.stringify([honapok, params, inYear]) !== JSON.stringify([it.months, it.params, it.inYear]);
  useEffect(() => {
    setHonapok(it.months);
    setParams(it.params);
    setInYear(it.inYear);
  }, [it.months, it.params, it.inYear]);

  // live effect preview (debounced): this card as if approved + the other approved items
  const [pv, setPv] = useState<AllowancePreview | null>(null);
  const [pvHiba, setPvHiba] = useState(false);
  const idozito = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dontesek = useMemo(
    () => [
      ...v.items.filter((x) => x.kind !== it.kind && x.status === 'jovahagyva').map((x) => ({ kind: x.kind, months: x.months, params: x.params, inYear: x.inYear })),
      { kind: it.kind, months: honapok, params, inYear },
    ],
    [v.items, it.kind, honapok, params, inYear],
  );
  useEffect(() => {
    if (it.kind === 'csed_gyed') return;
    if (idozito.current) clearTimeout(idozito.current);
    idozito.current = setTimeout(() => {
      ep.accAllowancePreview(c.id, { year: v.year, decisions: dontesek.filter((d) => d.kind !== 'csed_gyed') })
        .then((r) => {
          setPv(r);
          setPvHiba(false);
        })
        .catch(() => setPvHiba(true));
    }, ALLOWANCE_LIMITS.previewDebounceMs);
    return () => {
      if (idozito.current) clearTimeout(idozito.current);
    };
  }, [c.id, v.year, dontesek, it.kind]);

  const frissit = (r: AccAllowanceView) => {
    qc.setQueryData(['acc', 'allowances', c.id, v.year], r);
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'tax', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'clients'] });
  };
  const jova = useMutation({
    mutationFn: () => ep.accAllowanceDecision(c.id, it.kind, { status: 'jovahagyva', months: honapok, params, inYear }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok(`Jóváhagytad: ${it.label}. Az ügyfél értesítést kapott, az adóbecslés frissült.`);
    },
    onError: pir.hiba,
  });
  const nyitott = it.status === 'javasolt' || it.status === 'kerdes';
  const st = STATUSZ[it.status];
  const kieso = it.kind === 'csed_gyed';
  const csaladi = it.kind === 'csaladi';
  const sorok = pv ? elonezetSorok(pv) : null;
  const sajat = pv?.byKind.find((b) => b.kind === it.kind);
  const qMost = Math.floor((Number(today().slice(5, 7)) - 1) / 3) + 1;

  return (
    <div className={`lap k28 kedvezmeny-tetel${nyitott ? ' nyitott-tetel' : ''}`}>
      <div className="szak">
        <div className="szak-fej">
          <I3 n={kieso ? 'ora' : csaladi ? 'fiok' : 'igazolas'} s={28} />
          <h2>{it.kind === 'anyak' && params.anyakJogcim ? ANYAK_LABELS[params.anyakJogcim] : it.label}</h2>
          <span className={`cimke ${st.cls}`}>{st.szo}</span>
        </div>
        <ul className="k28-okok halvany">
          {it.proposal.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        {it.warnings.map((w, i) => (
          <div key={i} className="uzenet-sav figyel" style={{ marginTop: 8 }}>
            <div>{w}</div>
          </div>
        ))}
        {it.paramsPrev && (
          <p className="halvany kicsi" style={{ marginTop: 6 }}>
            Korábban jóváhagytad más adatokkal – a válaszai megváltoztak, ezért újra döntened kell. Addig a régi jóváhagyás számít.
          </p>
        )}
        {it.question && <p className="kicsi" style={{ marginTop: 6 }}>Kérdésed: „{it.question}”</p>}
        {it.rejectText && <p className="kicsi" style={{ marginTop: 6 }}>Neki írtad: „{it.rejectText}”</p>}
        {it.decidedAt && (
          <p className="halvany kicsi" style={{ marginTop: 6 }}>
            Döntött: {it.decidedBy ?? '–'}, {idopont(it.decidedAt, today())}
            {it.status === 'jovahagyva' && it.effectYearHuf ? ` · idén kb. ${ft(it.effectYearHuf)}-tal kevesebb adó` : ''}
          </p>
        )}
      </div>

      <div className="szak">
        <span className="felirat">Hónapok ({honapokSzoveg(honapok)})</span>
        <div className="honap-kapcsolok" role="group" aria-label="Hónapok">
          {HONAP_ROVID.map((h, i) => (
            <button key={h} type="button" className={honapok.includes(i + 1) ? 'on' : ''} aria-pressed={honapok.includes(i + 1)} disabled={!!zarolt} onClick={() => setHonapok(honapValt(honapok, i + 1))}>
              {h}
            </button>
          ))}
        </div>
        {it.kind === 'anyak' && (
          <label className="mezo" style={{ marginTop: 12, maxWidth: 420 }}>
            <span className="felirat">Jogcím</span>
            <Lenyilo value={params.anyakJogcim ?? 'ket'} onChange={(e) => setParams({ ...params, anyakJogcim: e.target.value as AllowanceParams['anyakJogcim'] })}>
              {ANYAK_JOGCIMEK.map((j) => (
                <option key={j} value={j}>
                  {ANYAK_LABELS[j]}
                </option>
              ))}
            </Lenyilo>
          </label>
        )}
        {it.kind === 'elso_hazasok' && (
          <label className="mezo" style={{ marginTop: 12, maxWidth: 260 }}>
            <span className="felirat">Ft / hó (a párnak együtt legfeljebb {ALLOWANCE_LIMITS.elsoHazasokMonthlyMaxHuf.toLocaleString('hu-HU')})</span>
            <input
              className="doboz szam"
              inputMode="numeric"
              value={params.elsoHazasokMonthlyHuf ?? 0}
              onChange={(e) => {
                const n = Math.max(0, Math.min(ALLOWANCE_LIMITS.elsoHazasokMonthlyMaxHuf, Number(e.target.value.replace(/\D/g, '')) || 0));
                setParams({ ...params, elsoHazasokMonthlyHuf: n });
              }}
            />
          </label>
        )}
        {csaladi && <CsaladiTabla p={params.csaladi ?? []} honapok={honapok} set={(cs) => setParams({ ...params, csaladi: cs })} />}
        {!kieso && (
          <div className="oszlop" style={{ gap: 8, marginTop: 14 }}>
            <label className="jelolo">
              <input type="checkbox" checked={inYear} onChange={(e) => setInYear(e.target.checked)} />
              <span>
                {ALLOWANCE_PANEL_TEXTS.inYear}
                <span className="sugo" style={{ marginTop: 2 }}>Kikapcsolva csak az éves bevallásban számoljuk el.</span>
              </span>
            </label>
            {csaladi && (
              <label className="jelolo">
                <input type="checkbox" checked={!!params.csjkInYear} disabled={c.taxProfile?.status === 'nyugdijas'} onChange={(e) => setParams({ ...params, csjkInYear: e.target.checked })} />
                <span>
                  {ALLOWANCE_PANEL_TEXTS.csjkInYear}
                  <span className="sugo" style={{ marginTop: 2 }}>
                    {c.taxProfile?.status === 'nyugdijas' ? 'Nyugdíjasnak nem jár.' : ALLOWANCE_PANEL_TEXTS.csjkHint}
                  </span>
                </span>
              </label>
            )}
          </div>
        )}
        {it.documents.length > 0 && (
          <p className="halvany kicsi" style={{ marginTop: 12 }}>
            Tartsa meg (elkérheted): {it.documents.map((d) => d.label).join(', ')}.
          </p>
        )}
      </div>

      {!kieso && (
        <div className="szak hatas-szak">
          <span className="felirat">Hatás (becslés)</span>
          {pvHiba ? (
            <p className="halvany">A becslés most nem tölthető be.</p>
          ) : !sorok || !pv ? (
            <p className="halvany">Számolom…</p>
          ) : pv.savedHuf === 0 && !sorok.fel ? (
            <p className="halvany">
              Idén nem csökkenti az adót: a jövedelme eddig az adómentes részen belül van, vagy egy másik kedvezmény már fedi. Jóváhagyhatod – ha később lesz mire, a
              motor beszámítja; az éves bevallásban úgyis újranézzük.
            </p>
          ) : (
            <>
              <p>{sorok.fo}</p>
              {sajat && (
                <p className="halvany kicsi">
                  Ebből ez a tétel: SZJA −{ft(sajat.szjaSavedHuf)}
                  {sajat.csjkHuf ? `, TB −${ft(sajat.csjkHuf)}` : ''}.
                </p>
              )}
              {sorok.fel && <p className="halvany kicsi">{sorok.fel}</p>}
              <div className="negyedev-hatas" role="list" aria-label="Hatás negyedévenként">
                {[1, 2, 3, 4].map((q) => (
                  <div key={q} role="listitem" className={q === qMost ? 'most' : ''}>
                    <span className="halvany kicsi">{['I.', 'II.', 'III.', 'IV.'][q - 1]} negyedév{q === qMost ? ' (most)' : ''}</span>
                    <b className="szam">−{ft(negyedevHatas(pv, honapok, q))}</b>
                  </div>
                ))}
              </div>
              <p className="halvany kicsi">
                A már jóváhagyott negyedévek nem változnak: ami azokra esik, az éves bevallásban térül meg. Jóváhagyás után a {['I.', 'II.', 'III.', 'IV.'][qMost - 1]} negyedév becslése
                frissül.
              </p>
              {pv.warnings.map((w, i) => (
                <div key={i} className="uzenet-sav figyel" style={{ marginTop: 6 }}>
                  <div>{w}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="szak">
        {zarolt && <p className="sugo" style={{ marginTop: 0, marginBottom: 8 }}>{zarolt}</p>}
        <div className="gombsor">
          {kieso ? (
            <button
              className="gomb-e kicsi"
              disabled={!!zarolt || it.status === 'jovahagyva' || honapok.length === 0}
              onClick={() => {
                const s = [...honapok].sort((a, b) => a - b);
                const tol = `${v.year}-${String(s[0]).padStart(2, '0')}-01`;
                const utolso = s[s.length - 1]!;
                const ig = new Date(Date.UTC(v.year, utolso, 0)).toISOString().slice(0, 10);
                nav(`/ugyfelek/${c.id}/attekintes?kieso=${tol}&ig=${ig}&kedvezmeny=csed_gyed&honapok=${s.join(',')}#adoprofil`);
              }}
            >
              {ALLOWANCE_PANEL_TEXTS.kiesoButton}
            </button>
          ) : (
            <button className="gomb-e kicsi" disabled={!!zarolt || jova.isPending || honapok.length === 0 || (it.status === 'jovahagyva' && !valtozott)} onClick={() => jova.mutate()}>
              {it.status === 'jovahagyva' && valtozott ? 'Módosítva jóváhagyom' : ALLOWANCE_PANEL_TEXTS.approve}
            </button>
          )}
          <button className="gomb-m kicsi csak-szoveg" disabled={!!zarolt} onClick={() => setDial('kerdes')}>
            {ALLOWANCE_PANEL_TEXTS.ask}
          </button>
          <button className="gomb-sz" disabled={!!zarolt || it.status === 'elutasitva'} onClick={() => setDial('elutasit')}>
            {ALLOWANCE_PANEL_TEXTS.reject}
          </button>
        </div>
      </div>
      <DontesFiok c={c} v={v} it={it} mod={dial} bezar={() => setDial(null)} frissit={frissit} />
    </div>
  );
}

function CsaladiTabla({ p, honapok, set }: { p: CsaladiMonthParam[]; honapok: number[]; set: (x: CsaladiMonthParam[]) => void }) {
  const sor = (m: number): CsaladiMonthParam => p.find((x) => x.month === m) ?? { month: m, eltartott: 0, children: [], sharePct: 100 };
  const allit = (m: number, patch: Partial<{ eltartott: number; kedv: number; beteg: number; felvaltva: number; share: number }>) => {
    const r = sor(m);
    const kedv = patch.kedv ?? r.children.length;
    const beteg = Math.min(kedv, patch.beteg ?? r.children.filter((x) => x.tartosBeteg).length);
    const felv = Math.min(kedv, patch.felvaltva ?? r.children.filter((x) => x.felvaltva).length);
    const uj: CsaladiMonthParam = {
      month: m,
      eltartott: Math.max(kedv, patch.eltartott ?? r.eltartott),
      children: Array.from({ length: kedv }, (_, i) => ({ tartosBeteg: i < beteg, felvaltva: i < felv })),
      sharePct: patch.share ?? r.sharePct,
    };
    set([...p.filter((x) => x.month !== m), uj].sort((a, b) => a.month - b.month));
  };
  const elso = sor(honapok[0] ?? 1);
  const mind = () => set(Array.from({ length: 12 }, (_, i) => ({ ...elso, month: i + 1, children: elso.children.map((x) => ({ ...x })) })));
  // "only now + next visible": the 12-row table stays collapsed while every chosen month is the same
  const kulcs = (r: CsaladiMonthParam) => [r.eltartott, r.children.length, r.children.filter((x) => x.tartosBeteg).length, r.children.filter((x) => x.felvaltva).length, r.sharePct].join('/');
  const egyforma = honapok.every((m) => kulcs(sor(m)) === kulcs(elso));
  const osszegzes = `${elso.eltartott} eltartott, ${elso.children.length} kedvezményezett${elso.children.some((x) => x.tartosBeteg) ? `, ${elso.children.filter((x) => x.tartosBeteg).length} tartósan beteg` : ''}${elso.children.some((x) => x.felvaltva) ? `, ${elso.children.filter((x) => x.felvaltva).length} felváltva` : ''}, megosztás ${elso.sharePct}%`;
  const szam = (m: number, mezo: 'eltartott' | 'kedv' | 'beteg' | 'felvaltva' | 'share', ertek: number, max: number) => (
    <input
      className="doboz szam mini-mezo"
      inputMode="numeric"
      aria-label={`${HONAP_ROVID[m - 1]} ${mezo}`}
      value={ertek}
      onChange={(e) => allit(m, { [mezo]: Math.max(0, Math.min(max, Number(e.target.value.replace(/\D/g, '')) || 0)) })}
    />
  );
  return (
    <details className="csaladi-reszlet" open={!egyforma}>
      <summary>{egyforma ? `Minden kijelölt hónapban: ${osszegzes} – havonta módosítom` : 'Havonta eltér – a táblázat'}</summary>
    <div style={{ marginTop: 10 }}>
      <div className="sor-flex ter">
        <span className="felirat" style={{ margin: 0 }}>Havonta</span>
        <button type="button" className="gomb-sz" onClick={mind}>
          {ALLOWANCE_PANEL_TEXTS.allMonths} (az első kijelölt hónap szerint)
        </button>
      </div>
      <div className="tabla-gorgo">
        <table className="tabla tomor csaladi-tabla">
          <thead>
            <tr>
              <th className="elso">Hónap</th>
              <th className="jobb">Eltartott</th>
              <th className="jobb">Kedvezményezett</th>
              <th className="jobb">Tartósan beteg</th>
              <th className="jobb">Felváltva</th>
              <th className="jobb utolso">Megosztás %</th>
            </tr>
          </thead>
          <tbody>
            {honapok.map((m) => {
              const r = sor(m);
              return (
                <tr key={m}>
                  <td className="elso">{HONAP_ROVID[m - 1]}</td>
                  <td className="jobb">{szam(m, 'eltartott', r.eltartott, 20)}</td>
                  <td className="jobb">{szam(m, 'kedv', r.children.length, 12)}</td>
                  <td className="jobb">{szam(m, 'beteg', r.children.filter((x) => x.tartosBeteg).length, 12)}</td>
                  <td className="jobb">{szam(m, 'felvaltva', r.children.filter((x) => x.felvaltva).length, 12)}</td>
                  <td className="jobb utolso">{szam(m, 'share', r.sharePct, 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </details>
  );
}

function DontesFiok({
  c,
  v,
  it,
  mod,
  bezar,
  frissit,
}: FulProps & { v: AccAllowanceView; it: AccAllowanceItem; mod: null | 'kerdes' | 'elutasit'; bezar: () => void; frissit: (r: AccAllowanceView) => void }) {
  const pir = usePirito();
  const [szoveg, setSzoveg] = useState('');
  const [ok, setOk] = useState<AllowanceRejectReason>('nem_jogosult');
  const [jegyzet, setJegyzet] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  useEffect(() => {
    if (mod) {
      setSzoveg('');
      setJegyzet('');
      setHiba(null);
    }
  }, [mod]);
  const kuld = useMutation({
    mutationFn: () =>
      ep.accAllowanceDecision(c.id, it.kind, mod === 'kerdes' ? { status: 'kerdes', clientText: szoveg.trim() } : { status: 'elutasitva', reason: ok, clientText: szoveg.trim(), staffNote: jegyzet.trim() || undefined }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok(mod === 'kerdes' ? 'Elküldtük a kérdést az Üzenetekbe. Az ügyfél értesítést kapott.' : 'Rögzítetted: nem jár. Az ügyfél értesítést kapott.');
      bezar();
    },
    onError: (e) => (e instanceof ApiError && e.fields?.clientText ? setHiba(e.fields.clientText) : pir.hiba(e)),
  });
  return (
    <Fiok
      nyitva={!!mod}
      bezar={bezar}
      cim={mod === 'kerdes' ? `Kérdés: ${it.label}` : `Nem jár: ${it.label}`}
      bev={mod === 'kerdes' ? 'Az Üzenetekbe megy, tőled. A tétel „kérdés” állapotba kerül, amíg nem válaszol.' : 'Az ügyfél látja az okot és a szövegedet.'}
      ikon="kerdezek"
      lab={
        <div className="gombsor">
          <button
            className="gomb-e"
            disabled={kuld.isPending}
            onClick={() => {
              if (!szoveg.trim()) return setHiba('Írd meg az ügyfélnek is.');
              kuld.mutate();
            }}
          >
            {mod === 'kerdes' ? 'Elküldöm a kérdést' : 'Rögzítem'}
          </button>
          <button className="gomb-sz" onClick={bezar}>
            Mégsem
          </button>
        </div>
      }
    >
      {mod === 'elutasit' && (
        <label className="mezo">
          <span className="felirat">Ok</span>
          <Lenyilo value={ok} onChange={(e) => setOk(e.target.value as AllowanceRejectReason)}>
            {ALLOWANCE_REJECT_REASONS.map((r) => (
              <option key={r} value={r}>
                {ALLOWANCE_REJECT_REASON_LABELS[r]}
              </option>
            ))}
          </Lenyilo>
        </label>
      )}
      <label className="mezo">
        <span className="felirat">{mod === 'kerdes' ? 'A kérdésed' : 'Szöveg az ügyfélnek'}</span>
        <textarea className={`doboz${hiba ? ' hibas' : ''}`} rows={4} maxLength={ALLOWANCE_LIMITS.clientTextMaxChars} value={szoveg} onChange={(e) => setSzoveg(e.target.value)} placeholder={mod === 'kerdes' ? 'Például: A párod is egyéni vállalkozó? Akkor nálad éri meg jobban.' : 'Tegezve, röviden.'} />
        {hiba ? <span className="hiba-szoveg">{hiba}</span> : <span className="sugo">Legfeljebb {ALLOWANCE_LIMITS.clientTextMaxChars} karakter.</span>}
      </label>
      {mod === 'elutasit' && (
        <label className="mezo">
          <span className="felirat">Belső jegyzet (az ügyfél nem látja)</span>
          <textarea className="doboz" rows={3} maxLength={ALLOWANCE_LIMITS.staffNoteMaxChars} value={jegyzet} onChange={(e) => setJegyzet(e.target.value)} />
        </label>
      )}
      <p className="halvany kicsi" style={{ marginTop: 10 }}>
        {v.submittedAt ? `A válaszai: ${datum(v.submittedAt.slice(0, 10), { ev: true })}` : ''}
      </p>
    </Fiok>
  );
}
