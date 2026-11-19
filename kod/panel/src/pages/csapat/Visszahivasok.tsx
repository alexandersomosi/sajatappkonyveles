// /visszahivasok – the callback queue (SPEC §26.2, §26.3.2). The client asks for a call ("Kérj visszahívást"), a colleague
// calls back within 24–48 hours. Csapat and admin see every request; the accountant only the ones handed to him.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { CallbackFilter } from '../../api/endpoints';
import type { TeamCallbackDetail, TeamCallbackRow, TeamSummary } from '../../api/types';
import { useAuth } from '../../auth/Auth';
import { Fejlec, Fiok, HibaSav, Lenyilo, Masol, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { useMost } from '../../ui/useMost';
import {
  ASSIST_CHECK_LABELS,
  ASSIST_KIND_LABELS,
  ASSIST_STATUS_LABELS,
  CALLBACK_ASSIST_TOPIC,
  CALLBACK_ATTEMPT_OUTCOME_LABELS,
  CALLBACK_ATTEMPT_OUTCOMES,
  CALLBACK_CLOSE_REASON_LABELS,
  CALLBACK_CLOSE_REASONS,
  CALLBACK_RULES,
  CALLBACK_STATUS_LABELS,
  CALLBACK_TOPIC_LABELS,
  CALLBACK_TOPICS,
  CALLBACK_WINDOW_LABELS,
  REGISTRATION_STATUS_LABELS,
  type AssistCheckItem,
  type AssistKind,
  type CallbackAttemptOutcome,
  type CallbackCloseReason,
  type CallbackTopic,
} from '../../_shared/enums';
import type { TeamClientCard } from '../../api/types';
import { fazisElemek, kisbetu, nyitottAssist, utonev } from '../../lib/helyettunk';
import { KovetkezoLepes, Utvonal, UtvonalGomb, UtvonalTorzs, useUtvonalValtas, type UtvonalValtas } from './UgyfelKartya';
import { CALLBACK_SOURCE_LABEL, LIFECYCLE_LABEL } from '../../lib/labels';
import { elteltPerc, hivasFolyik, kiserletSzoveg, nyitottVisszahivas, slaAllapot, telLink, varakozasPerc, visszahivasLinkId } from '../../lib/csapat';
import { idopont, telefonFormaz } from '../../lib/format';
import { today } from '../../lib/today';

const SZUROK: { k: CallbackFilter; felirat: string; db?: (s: TeamSummary) => number; konyvelo?: boolean }[] = [
  { k: 'nyitott', felirat: 'Nyitott', db: (s) => s.callbacks.open, konyvelo: true },
  { k: 'lejart', felirat: 'Lejárt', db: (s) => s.callbacks.overdue, konyvelo: true },
  { k: 'enyem', felirat: 'Enyém', db: (s) => s.callbacks.mine },
  { k: 'gazdatlan', felirat: 'Nincs gazdája', db: (s) => s.callbacks.unassigned },
  { k: 'lezart', felirat: 'Lezárt', konyvelo: true },
  { k: 'mind', felirat: 'Mind', konyvelo: true },
];
const NYITOTT_SZUROK: CallbackFilter[] = ['nyitott', 'lejart', 'enyem', 'gazdatlan'];

export function SlaCimke({ row, eltelt }: { row: TeamCallbackRow; eltelt: number }) {
  const s = slaAllapot(row, eltelt);
  if (s.szin === 'lezart') return <span className="halvany">–</span>;
  return <span className={`cimke${s.szin === 'hiba' ? ' hiba' : s.szin === 'figyel' ? ' ido' : ''}`}>{s.szoveg}</span>;
}

export function AllapotSzo({ row, most }: { row: TeamCallbackRow; most: number }) {
  const hiv = hivasFolyik(row.callingNowUntil, most);
  if (hiv > 0 && nyitottVisszahivas(row.status))
    return (
      <span className="allapot">
        <span className="szo" style={{ color: 'var(--tintakek)' }}>Most hívja {row.assignee?.firstName ?? 'valaki'}</span>
      </span>
    );
  const kesz = row.status === 'teljesitve';
  return (
    <span className={`allapot${row.status === 'sikertelen' ? ' hiba' : ''}`}>
      {kesz && <I3 n="befizetve_jel" s={18} />}
      <span className="szo" style={row.status === 'visszavonva' || row.status === 'lezarva' ? { color: 'var(--halvany)', fontWeight: 550 } : undefined}>
        {CALLBACK_STATUS_LABELS[row.status]}
      </span>
    </span>
  );
}

export default function Visszahivasok() {
  const { isAccountant, isAdmin, isCsapat } = useAuth();
  const csakSajat = isAccountant && !isAdmin && !isCsapat;
  const [sp, setSp] = useSearchParams();
  const szuro = (sp.get('szuro') as CallbackFilter) || 'nyitott';
  const tema = (sp.get('tema') as CallbackTopic | null) ?? '';
  const nyit = visszahivasLinkId(sp);
  const [kereses, setKereses] = useState(sp.get('q') ?? '');
  const [kesleltetett, setKesleltetett] = useState(kereses);
  useEffect(() => {
    const t = setTimeout(() => setKesleltetett(kereses.trim()), 300);
    return () => clearTimeout(t);
  }, [kereses]);
  const most = useMost();
  const t = today();
  const osszeg = useQuery({ queryKey: ['team', 'summary'], queryFn: ep.teamSummary, refetchInterval: 60_000 });
  const q = useInfiniteQuery({
    queryKey: ['team', 'callbacks', szuro, tema, kesleltetett],
    queryFn: ({ pageParam }) => ep.teamCallbacks({ filter: szuro, topic: tema, q: kesleltetett, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: (p) => p,
    refetchInterval: 60_000,
  });
  const eltelt = q.dataUpdatedAt ? (Date.now() - q.dataUpdatedAt) / 60_000 : 0;
  const sorok = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.items) ?? [];
    if (!NYITOTT_SZUROK.includes(szuro)) return all;
    // Overdue first, then the nearest deadline (the server sorts the same way; this keeps it after local updates).
    return all.slice().sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueAt.localeCompare(b.dueAt));
  }, [q.data, szuro]);
  const s = osszeg.data;
  const allit = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    // the e-mail / notification link form (?id=) becomes ?nyit= on the first change, so closing really closes
    if (k === 'nyit') n.delete('id');
    setSp(n, { replace: true });
  };
  const szurok = SZUROK.filter((f) => !csakSajat || f.konyvelo);

  return (
    <>
      <Fejlec
        felcim={csakSajat ? 'Munka' : 'Ügyfélszolgálat'}
        cim="Visszahívások"
        rozR={260}
        mellek={
          s ? (
            <>
              <b>{s.callbacks.open}</b> nyitott kérés · <b>{s.callbacks.overdue}</b> lejárt
              {!csakSajat && (
                <>
                  {' '}
                  · <b>{s.callbacks.unassigned}</b> vár gazdára
                </>
              )}
              <br />
              {csakSajat
                ? 'Ezeket a hívásokat a csapat neked adta át. Az ügyfélnek 24–48 órán belüli hívást ígértünk.'
                : 'Az ügyfeleknek 24–48 órán belüli hívást ígérünk, munkanapokon 9 és 17 óra között. Nem feltétlenül a könyvelőjük hív.'}
            </>
          ) : (
            ' '
          )
        }
      />
      <div className="tartalom">
        <div className="sor-flex" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div className="szegmens" role="group" aria-label="Szűrés">
            {szurok.map((f) => (
              <button key={f.k} type="button" className={szuro === f.k ? 'on' : ''} aria-pressed={szuro === f.k} onClick={() => allit('szuro', f.k === 'nyitott' ? null : f.k)}>
                {f.felirat}
                {s && f.db && <span className="db">{f.db(s)}</span>}
              </button>
            ))}
          </div>
          <div className="ures-hely" />
          <Lenyilo style={{ width: 240 }} value={tema} aria-label="Téma" onChange={(e) => allit('tema', e.target.value || null)}>
            <option value="">Minden téma</option>
            {CALLBACK_TOPICS.map((k) => (
              <option key={k} value={k}>
                {CALLBACK_TOPIC_LABELS[k]}
              </option>
            ))}
          </Lenyilo>
          <label className="kereso">
            <span className="rejtett">Keresés</span>
            <input value={kereses} placeholder="Név vagy e-mail" onChange={(e) => setKereses(e.target.value)} />
          </label>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : sorok.length === 0 ? (
            <Ures n="hatarido_naptar" cim={szuro === 'nyitott' ? 'Nincs nyitott visszahívás' : 'Nincs ilyen visszahívás'}>
              {szuro === 'nyitott' ? 'Minden ügyfelet visszahívtunk. Ha valaki kér, itt jelenik meg.' : 'Válassz másik szűrőt.'}
            </Ures>
          ) : (
            <table className="tabla tomor visszahivas-tabla">
              <thead>
                <tr>
                  <th className="elso">Ügyfél</th>
                  <th>Téma</th>
                  <th>Megjegyzés</th>
                  <th>Mikor hívható</th>
                  <th>Beérkezett</th>
                  <th>Határidő</th>
                  <th className="kozep">Kísérlet</th>
                  <th>Kié</th>
                  <th className="utolso">Állapot</th>
                </tr>
              </thead>
              <tbody>
                {sorok.map((r) => (
                  <tr
                    key={r.id}
                    className={`kattinthato${r.overdue && nyitottVisszahivas(r.status) ? ' lejart' : ''}${nyit === r.id ? ' kijelolt' : ''}`}
                    onClick={() => allit('nyit', r.id)}
                  >
                    <td className="elso">
                      <button type="button" className="nev" style={{ textAlign: 'left' }} onClick={(e) => (e.stopPropagation(), allit('nyit', r.id))}>
                        {r.client.name}
                      </button>
                      <div className="al">{LIFECYCLE_LABEL[r.client.lifecycle]}</div>
                    </td>
                    <td>
                      {CALLBACK_TOPIC_LABELS[r.topic]}
                      {r.source === 'regi_idopont' && <div className="al">régi időpontfoglalásból</div>}
                    </td>
                    <td className="megjegyzes-cella">{r.notePreview ? <span title={r.notePreview}>„{r.notePreview}”</span> : <span className="halvany">–</span>}</td>
                    <td className="kicsi">{CALLBACK_WINDOW_LABELS[r.window].replace(' (munkanapokon 9–17)', '')}</td>
                    <td className="nt">{idopont(r.createdAt, t)}</td>
                    <td className="nt">
                      <SlaCimke row={r} eltelt={eltelt} />
                    </td>
                    <td className="kozep szam" title={`${r.attempts} hívás, ebből ${r.failedAttempts} sikertelen`}>
                      {kiserletSzoveg(r.failedAttempts)}
                    </td>
                    <td>{r.assignee ? r.assignee.firstName : <span className="halvany">—</span>}</td>
                    <td className="utolso">
                      <AllapotSzo row={r} most={most} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {q.hasNextPage && (
            <div className="lapozo">
              <button className="gomb-m csak-szoveg" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                Továbbiak
              </button>
            </div>
          )}
        </div>
        <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
          Telefonon soha nem kérünk jelszót, belépési kódot vagy kártyaadatot. A hívást nem rögzítjük, csak rövid jegyzetet írunk.
        </p>
      </div>
      {nyit && <VisszahivasFiok id={nyit} bezar={() => allit('nyit', null)} />}
    </>
  );
}

type Mod = 'reszlet' | 'eredmeny' | 'atad' | 'lezar' | 'egyeztet' | 'helyettunk' | 'utvonal';

export function VisszahivasFiok({ id, bezar }: { id: string; bezar: () => void }) {
  const { user, isAdmin, isCsapat, isAccountant } = useAuth();
  const csakSajat = isAccountant && !isAdmin && !isCsapat;
  const qc = useQueryClient();
  const pir = usePirito();
  const most = useMost(15_000);
  const t = today();
  const q = useQuery({ queryKey: ['team', 'callback', id], queryFn: () => ep.teamCallback(id) });
  const [mod, setMod] = useState<Mod>('reszlet');
  const [eredmeny, setEredmeny] = useState<{ outcome: CallbackAttemptOutcome | null; note: string; summary: string; mikor: string }>({ outcome: null, note: '', summary: '', mikor: '' });
  const [atad, setAtad] = useState<string>('');
  const [lezar, setLezar] = useState<{ reason: CallbackCloseReason | null; note: string }>({ reason: null, note: '' });
  const [jegyzet, setJegyzet] = useState<string | null>(null);
  const [jegyzetAllapot, setJegyzetAllapot] = useState<'' | 'mentem' | 'mentve'>('');
  // SPEC §27.6.4: the 'hivas' check list after "Beszéltünk" on an "Intézzük helyette" callback, and a new request.
  const [hivasPipak, setHivasPipak] = useState<AssistCheckItem[]>([]);
  const [ujFajta, setUjFajta] = useState<AssistKind | null>(null);
  const [ujMegj, setUjMegj] = useState('');
  // The branch form lives in the drawer body; its save button in the footer (state handed up by UtvonalMod).
  const [utvonalV, setUtvonalV] = useState<UtvonalValtas | null>(null);
  useEffect(() => {
    setMod('reszlet');
    setHivasPipak([]);
    setJegyzet(null);
    setJegyzetAllapot('');
  }, [id]);

  const frissit = (d: TeamCallbackDetail) => {
    qc.setQueryData(['team', 'callback', id], d);
    void qc.invalidateQueries({ queryKey: ['team', 'callbacks'] });
    void qc.invalidateQueries({ queryKey: ['team', 'summary'] });
  };
  const muvelet = <V,>(fn: (v: V) => Promise<TeamCallbackDetail>, uzenet: (d: TeamCallbackDetail, v: V) => string) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({
      mutationFn: fn,
      onSuccess: (d, v) => {
        frissit(d);
        setMod('reszlet');
        pir.ok(uzenet(d, v));
      },
      onError: pir.hiba,
    });
  const magamra = muvelet((force: boolean) => ep.teamClaim(id, force), () => 'Magadra vetted. Most már látod a teljes számot.');
  const hivom = muvelet<void>(() => ep.teamCalling(id), () => 'Jó hívást! Az ügyfél az appban látja, hogy most hívod.');
  const kiserlet = useMutation({
    mutationFn: () =>
      ep.teamAttempt(id, {
        outcome: eredmeny.outcome!,
        note: eredmeny.note.trim() || undefined,
        summaryForClient: eredmeny.outcome === 'beszeltunk' && eredmeny.summary.trim() ? eredmeny.summary.trim() : undefined,
        nextAttemptAfter: eredmeny.outcome === 'kesobb_kerte' && eredmeny.mikor ? new Date(eredmeny.mikor).toISOString() : undefined,
      }),
    onSuccess: (d) => {
      frissit(d);
      const a = d.clientCard.assist;
      // "Beszéltünk" on an assisted request that still waits for the call: the 'hivas' list comes next (SPEC §27.6.4).
      if (d.status === 'teljesitve' && a && a.status === 'visszahivas_kerve') {
        setHivasPipak([]);
        setMod('egyeztet');
        pir.ok('Rögzítetted: beszéltetek. Most pipáld ki, amit megbeszéltetek, és indítsd el.');
        return;
      }
      setMod('reszlet');
      pir.ok(
        d.status === 'teljesitve'
          ? 'Rögzítetted: beszéltetek. Az ügyfél értesítést kapott.'
          : d.status === 'sikertelen'
            ? 'Harmadszor sem értük el. Az ügyfél értesítést kapott, hogy írjon nekünk.'
            : `Rögzítetted: ${CALLBACK_ATTEMPT_OUTCOME_LABELS[eredmeny.outcome!].toLowerCase()}.`,
      );
    },
    onError: pir.hiba,
  });
  const assistFrissit = () => {
    void qc.invalidateQueries({ queryKey: ['team', 'callback', id] });
    void qc.invalidateQueries({ queryKey: ['team', 'assists'] });
    void qc.invalidateQueries({ queryKey: ['team', 'summary'] });
  };
  const egyeztet = useMutation({
    mutationFn: (assistId: string) => ep.teamAssistAgreed(assistId, { items: hivasPipak }),
    onSuccess: (a) => {
      assistFrissit();
      setMod('reszlet');
      pir.ok(`Elindítottad. ${utonev(a.accountant?.name)} értesítést kapott, és az ügyfél is látja az appban.`);
    },
    onError: pir.hiba,
  });
  const ujAssist = useMutation({
    mutationFn: (clientId: string) => ep.teamCreateAssist(clientId, { kind: ujFajta!, note: ujMegj.trim() || undefined }),
    onSuccess: () => {
      assistFrissit();
      setMod('reszlet');
      setUjFajta(null);
      setUjMegj('');
      pir.ok('Felvetted: „Intézzük helyette”. Az ügyfél az appban is látja, mi jön.');
    },
    onError: pir.hiba,
  });
  // An accountant who hands a callback back no longer sees it: the API answers { ok, id } and the drawer closes.
  const atadas = useMutation({
    mutationFn: (userId: string | null) => ep.teamAssign(id, { userId }),
    onSuccess: (d, userId) => {
      void qc.invalidateQueries({ queryKey: ['team', 'callbacks'] });
      void qc.invalidateQueries({ queryKey: ['team', 'summary'] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client-callbacks'] });
      if (!('clientCard' in d)) {
        pir.ok('Visszaadtad a sorba. A csapat intézi tovább.');
        bezar();
        return;
      }
      qc.setQueryData(['team', 'callback', id], d);
      setMod('reszlet');
      pir.ok(userId ? `Átadtad: most ${d.assignee?.firstName ?? 'ő'} intézi.` : 'Visszaadtad a sorba.');
    },
    onError: pir.hiba,
  });
  const lezaras = muvelet<void>(() => ep.teamClose(id, { reason: lezar.reason!, note: lezar.note.trim() || undefined }), () => 'Lezártad. Az ügyfél értesítést kapott.');
  const jegyzetMentes = useMutation({
    mutationFn: (v: string) => ep.teamPatchCallback(id, { internalNote: v.trim() ? v : null }),
    onMutate: () => setJegyzetAllapot('mentem'),
    onSuccess: (d) => {
      qc.setQueryData(['team', 'callback', id], d);
      setJegyzetAllapot('mentve');
    },
    onError: (e) => {
      setJegyzetAllapot('');
      pir.hiba(e);
    },
  });
  // Internal note autosave (debounced).
  useEffect(() => {
    if (jegyzet === null) return;
    const tm = setTimeout(() => jegyzetMentes.mutate(jegyzet), 900);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jegyzet]);

  const d = q.data;
  const enyem = !!d && d.assignee?.userId === user?.id;
  const nyitott = !!d && nyitottVisszahivas(d.status);
  const masE = !!d?.assignee && !enyem;
  const hiv = d ? hivasFolyik(d.callingNowUntil, most) : 0;
  const utolso = d?.attemptList.length ? d.attemptList[d.attemptList.length - 1] : null;
  const varni = varakozasPerc(utolso ? { at: utolso.at, outcome: utolso.outcome } : null, most);
  const hibasSzam = utolso?.outcome === 'hibas_szam' && nyitott;
  const szerkesztheti = enyem || isAdmin;
  const foglalt = magamra.isPending || hivom.isPending || kiserlet.isPending || atadas.isPending || lezaras.isPending || egyeztet.isPending || ujAssist.isPending;
  const assist = d?.clientCard.assist ?? null;
  const assistNyitott = !!assist && nyitottAssist(assist.status);
  const assistTema = d ? (CALLBACK_ASSIST_TOPIC[d.topic] ?? null) : null;
  const hivasElemek = assist ? fazisElemek(assist.kind, 'hivas') : [];
  const hivasHiany = hivasElemek.filter((i) => !hivasPipak.includes(i)).length;
  const eredmenyKesz = !!eredmeny.outcome && (eredmeny.outcome !== 'kesobb_kerte' || !!eredmeny.mikor);
  const cimzettek = (d?.assignable ?? []).filter((a) => a.userId !== d?.assignee?.userId);

  const lab = !d ? null : mod === 'utvonal' ? (
    <>
      {utvonalV && <UtvonalGomb v={utvonalV} />}
      <button className="gomb-sz" onClick={() => setMod('reszlet')}>
        Mégse
      </button>
    </>
  ) : mod === 'egyeztet' && assist ? (
    <>
      <button className="gomb-e" disabled={hivasHiany > 0 || foglalt} onClick={() => egyeztet.mutate(assist.id)}>
        Egyeztettünk – elindítom
      </button>
      <button className="gomb-sz" onClick={() => setMod('reszlet')}>
        Később
      </button>
    </>
  ) : mod === 'helyettunk' ? (
    <>
      <button className="gomb-e" disabled={!ujFajta || foglalt} onClick={() => ujAssist.mutate(d.clientCard.id)}>
        Felveszem
      </button>
      <button className="gomb-sz" onClick={() => setMod('reszlet')}>
        Mégse
      </button>
    </>
  ) : mod === 'eredmeny' ? (
    <>
      <button className="gomb-e" disabled={!eredmenyKesz || foglalt} onClick={() => kiserlet.mutate()}>
        Rögzítem a hívást
      </button>
      <button className="gomb-sz" onClick={() => setMod('reszlet')}>
        Mégse
      </button>
    </>
  ) : mod === 'atad' ? (
    <>
      <button className="gomb-e" disabled={!atad || foglalt} onClick={() => atadas.mutate(atad === 'sor' ? null : atad)}>
        {atad === 'sor' ? 'Visszaadom a sorba' : 'Átadom'}
      </button>
      <button className="gomb-sz" onClick={() => setMod('reszlet')}>
        Mégse
      </button>
    </>
  ) : mod === 'lezar' ? (
    <>
      <button className="gomb-e" disabled={!lezar.reason || foglalt} onClick={() => lezaras.mutate()}>
        Lezárom hívás nélkül
      </button>
      <button className="gomb-sz" onClick={() => setMod('reszlet')}>
        Mégse
      </button>
    </>
  ) : !nyitott ? (
    <span className="halvany kicsi">Ez a kérés le van zárva{d.closedAt ? `: ${idopont(d.closedAt, t)}` : ''}.</span>
  ) : !enyem ? (
    <div className="oszlop" style={{ gap: 6 }}>
      <div className="gombsor">
        {csakSajat ? null : masE && !isAdmin ? (
          <button className="gomb-e" disabled>
            Magamra veszem
          </button>
        ) : (
          <button className="gomb-e" disabled={foglalt} onClick={() => magamra.mutate(masE)}>
            {masE ? `Átveszem ${d.assignee!.firstName} kollégától` : 'Magamra veszem'}
          </button>
        )}
        <button className="gomb-m csak-szoveg" disabled>
          Most hívom
        </button>
      </div>
      <span className="sugo" style={{ marginTop: 0 }}>
        {masE && !isAdmin ? `Már ${d.assignee!.firstName} intézi. Ha át kell venned, kérd meg, hogy adja át.` : 'Előbb vedd magadra: akkor látod a teljes számot, és hívhatod.'}
      </span>
    </div>
  ) : (
    <>
      <button className="gomb-e" disabled={foglalt || hiv > 0} onClick={() => hivom.mutate()}>
        <I3 n="ora" s={24} />
        {hiv > 0 ? `Hívod (még ${hiv} perc)` : 'Most hívom'}
      </button>
      <button
        className="gomb-m csak-szoveg"
        disabled={foglalt}
        onClick={() => {
          setEredmeny({ outcome: null, note: '', summary: '', mikor: '' });
          setMod('eredmeny');
        }}
      >
        Hívás eredménye
      </button>
    </>
  );

  return (
    <Fiok
      nyitva
      keskeny
      bezar={bezar}
      ikon="ora"
      cim={d ? d.clientCard.name : 'Visszahívás'}
      bev={d ? `${CALLBACK_TOPIC_LABELS[d.topic]} · ${CALLBACK_SOURCE_LABEL[d.source]}` : undefined}
      lab={lab}
    >
      {q.isPending && <Toltes />}
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {d && (
        <div className="oszlop visszahivas-reszlet" style={{ gap: 18 }}>
          <div className="sor-flex" style={{ flexWrap: 'wrap', gap: 8 }}>
            <AllapotSzo row={d} most={most} />
            {nyitott && <SlaCimke row={d} eltelt={q.dataUpdatedAt ? (Date.now() - q.dataUpdatedAt) / 60_000 : 0} />}
            <span className="halvany kicsi">beérkezett {idopont(d.createdAt, t)}</span>
          </div>

          {mod === 'reszlet' && (assistTema || assistNyitott) && (
            <div className="helyettunk-banner">
              <I3 n="igazolas" s={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>Intézzük helyette: {kisbetu(ASSIST_KIND_LABELS[assist?.kind ?? assistTema!])}</b>
                <div className="kicsi">
                  {assist ? (
                    <>
                      {ASSIST_STATUS_LABELS[assist.status]} · <Link to={`/helyettunk/${assist.id}`}>Megnyitom a lépéseit</Link>
                    </>
                  ) : (
                    'A kérés lépései az „Intézzük helyette” oldalon lesznek.'
                  )}
                </div>
                {assist?.status === 'visszahivas_kerve' && (
                  <div className="kicsi" style={{ marginTop: 4 }}>
                    Hívás után: „Beszéltünk”, majd pipáld ki, amit megbeszéltetek.{' '}
                    {!nyitott && (
                      <button
                        type="button"
                        className="gomb-sz"
                        onClick={() => {
                          setHivasPipak([]);
                          setMod('egyeztet');
                        }}
                      >
                        Egyeztettünk – elindítom
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {mod === 'reszlet' && (
            <>
              <div className="lap-kartya">
                <div className="telefon">
                  {d.phone ? (
                    <>
                      <a className="szam nagy-telefon" href={telLink(d.phone)}>
                        {telefonFormaz(d.phone)}
                      </a>
                      <div className="gombsor" style={{ marginTop: 8 }}>
                        <Masol ertek={d.phone} />
                        <a className="gomb-m kicsi csak-szoveg" href={telLink(d.phone)}>
                          Hívás erről a gépről
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="szam nagy-telefon halvany-szam">{d.phoneMasked}</span>
                      <span className="sugo">{nyitott ? 'A teljes számot akkor látod, ha magadra veszed.' : 'A kérés lezárult, a szám nem látható.'}</span>
                    </>
                  )}
                  {hibasSzam && <div className="uzenet-sav figyel" style={{ marginTop: 10 }}>Legutóbb hibás volt a szám. Várjuk, hogy az ügyfél megadja a jót – értesítést kapsz róla.</div>}
                </div>
                <dl className="adatok tomor">
                  <dt>Hívható</dt>
                  <dd>{CALLBACK_WINDOW_LABELS[d.window]}</dd>
                  <dt>E-mail</dt>
                  <dd>{d.clientCard.email}</dd>
                  <dt>Állapot</dt>
                  <dd>
                    {LIFECYCLE_LABEL[d.clientCard.lifecycle]}
                    {d.clientCard.lifecycle === 'bekotes_alatt' && <KovetkezoLepes c={d.clientCard} />}
                  </dd>
                  {d.clientCard.accountant && (
                    <>
                      <dt>Könyvelője</dt>
                      <dd>{d.clientCard.accountant.name}</dd>
                    </>
                  )}
                  {d.clientCard.registration && (
                    <>
                      <dt>Vállalkozás</dt>
                      <dd>
                        {(isCsapat || isAdmin) ? (
                          <Link to={`/vallalkozas-inditas/${d.clientCard.registration.id}`}>{REGISTRATION_STATUS_LABELS[d.clientCard.registration.status]}</Link>
                        ) : (
                          REGISTRATION_STATUS_LABELS[d.clientCard.registration.status]
                        )}
                      </dd>
                    </>
                  )}
                </dl>
                <UtvonalSor c={d.clientCard} valtas={() => setMod('utvonal')} />
                <div className="gombsor" style={{ marginTop: 10 }}>
                  {!assistTema && !assistNyitott && d.clientCard.lifecycle === 'bekotes_alatt' && (
                    <button
                      type="button"
                      className="gomb-sz"
                      onClick={() => {
                        setUjFajta(d.clientCard.businessStatus === 'van' ? 'meghatalmazas' : null);
                        setUjMegj('');
                        setMod('helyettunk');
                      }}
                    >
                      Kéri, hogy intézzük helyette?
                    </button>
                  )}
                  {csakSajat && (
                    <Link className="gomb-sz" to={`/ugyfelek/${d.clientCard.id}`}>
                      Ügyfél adatlapja
                    </Link>
                  )}
                  {isCsapat && d.clientCard.canMessage && (
                    <Link className="gomb-sz" to={`/uzenetek/${d.clientCard.id}`}>
                      Üzenet az ügyfélnek
                    </Link>
                  )}
                </div>
              </div>

              <div>
                <h3 className="kis-cim">Amit az ügyfél írt</h3>
                <p className="idezet">{d.note ? `„${d.note}”` : <span className="halvany">Nem írt megjegyzést.</span>}</p>
                {d.legacyAppointment && (
                  <p className="halvany kicsi" style={{ marginTop: 6 }}>
                    Korábban egyeztetett {d.legacyAppointment.channel === 'telefon' ? 'telefonhívás' : 'videóhívás'}: {idopont(d.legacyAppointment.startsAt, t)}.
                  </p>
                )}
                {/* Only a 'kesobb_kerte' attempt is the client's own wish; after a failed one nextAttemptAfter is just our 120-minute pause. */}
                {d.nextAttemptAfter && nyitott && utolso?.outcome === 'kesobb_kerte' && <p className="kicsi" style={{ marginTop: 6 }}>Kérte, hogy {idopont(d.nextAttemptAfter, t)} körül hívjuk újra.</p>}
                {nyitott && varni > 0 && (
                  <p className="halvany kicsi" style={{ marginTop: 6 }}>
                    Legutóbb {elteltPerc(varni)} perce nem értük el. Ha teheted, várj még {varni} percet a következő hívással.
                  </p>
                )}
              </div>

              {nyitott && (
                <div className="masik-teendo">
                  <span className="halvany kicsi">Más teendő:</span>
                  {csakSajat ? (
                    <button className="gomb-sz" disabled={foglalt} onClick={() => atadas.mutate(null)}>
                      Visszaadom a sorba
                    </button>
                  ) : (
                    <button
                      className="gomb-sz"
                      onClick={() => {
                        setAtad('');
                        setMod('atad');
                      }}
                    >
                      Átadom
                    </button>
                  )}
                  {(enyem || isAdmin) && !csakSajat && (
                    <button
                      className="gomb-sz"
                      onClick={() => {
                        setLezar({ reason: null, note: '' });
                        setMod('lezar');
                      }}
                    >
                      Lezárom hívás nélkül
                    </button>
                  )}
                  {!(enyem || isAdmin) && !csakSajat && <span className="sugo" style={{ margin: 0 }}>Lezárni a gazdája tudja.</span>}
                </div>
              )}

              <div>
                <h3 className="kis-cim">
                  Belső jegyzet <span className="halvany kicsi" style={{ fontWeight: 400 }}>{jegyzetAllapot === 'mentem' ? 'mentem…' : jegyzetAllapot === 'mentve' ? 'mentve' : 'csak mi látjuk'}</span>
                </h3>
                <textarea
                  className="doboz"
                  rows={3}
                  maxLength={CALLBACK_RULES.internalNoteMaxChars}
                  disabled={!szerkesztheti}
                  value={jegyzet ?? d.internalNote ?? ''}
                  placeholder={szerkesztheti ? 'Például: délután 3 után ér rá, a bejelentés tevékenységeinél akadt el.' : 'A gazdája írhat ide.'}
                  onChange={(e) => setJegyzet(e.target.value)}
                />
              </div>

              <div>
                <h3 className="kis-cim">Hívások</h3>
                {d.attemptList.length === 0 ? (
                  <p className="halvany kicsi">Még nem hívtuk.</p>
                ) : (
                  <ol className="idovonal">
                    {d.attemptList.map((a) => (
                      <li key={a.id}>
                        <b>{CALLBACK_ATTEMPT_OUTCOME_LABELS[a.outcome]}</b> · {idopont(a.at, t)} · {a.by.firstName}
                        {a.note && <div className="halvany kicsi">„{a.note}”</div>}
                      </li>
                    ))}
                  </ol>
                )}
                {d.summaryForClient && (
                  <p className="kicsi" style={{ marginTop: 8 }}>
                    Összefoglaló az ügyfélnek (üzenetben elküldve): „{d.summaryForClient}”
                  </p>
                )}
              </div>

              <div>
                <h3 className="kis-cim">Előzmények</h3>
                <ol className="idovonal halk">
                  {d.history
                    .slice()
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((h, i) => (
                    <li key={i}>
                      {h.text} <span className="halvany">· {idopont(h.at, t)}{h.by ? ` · ${h.by.firstName}` : ''}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {mod === 'utvonal' && <UtvonalMod c={d.clientCard} vissza={() => setMod('reszlet')} adja={setUtvonalV} />}

          {mod === 'egyeztet' && assist && (
            <div className="oszlop" style={{ gap: 12 }}>
              <h3 className="kis-cim">Mit beszéltetek meg? ({kisbetu(ASSIST_KIND_LABELS[assist.kind])})</h3>
              <p className="sugo" style={{ margin: 0 }}>
                Minden pont kell az indításhoz. Ha valami nem stimmel (például nincs Ügyfélkapu+-a vagy DÁP-ja), zárd le a kérést az „Intézzük helyette” oldalon, és mondd el neki a másik utat.
              </p>
              {hivasElemek.map((i) => (
                <label key={i} className="jelolo">
                  <input type="checkbox" checked={hivasPipak.includes(i)} onChange={(e) => setHivasPipak((p) => (e.target.checked ? [...p, i] : p.filter((x) => x !== i)))} />
                  <span>{ASSIST_CHECK_LABELS[i]}</span>
                </label>
              ))}
              <div className="uzenet-sav info">
                <div>
                  Indítás után {utonev(d.clientCard.accountant?.name)} értesítést kap: ő küldi be a meghatalmazást a saját belépésével. Az ügyfél az appban látja, hogy utána neki kell jóváhagynia, 4 napon belül.
                </div>
              </div>
            </div>
          )}

          {mod === 'helyettunk' && (
            <div className="oszlop" style={{ gap: 12 }}>
              <h3 className="kis-cim">Mit intézzünk helyette?</h3>
              <div className="valaszto fuggoleges" role="radiogroup" aria-label="Mit intézzünk helyette">
                {(d.clientCard.businessStatus === 'van' ? (['meghatalmazas'] as AssistKind[]) : (['vallalkozas_bejelentes', 'meghatalmazas'] as AssistKind[])).map((k) => (
                  <label key={k}>
                    <input type="radio" name="uj-assist" checked={ujFajta === k} onChange={() => setUjFajta(k)} />
                    {ASSIST_KIND_LABELS[k]}
                    {k === 'vallalkozas_bejelentes' && <span className="halvany kicsi">a meghatalmazással együtt</span>}
                  </label>
                ))}
              </div>
              <label className="mezo">
                <span className="felirat">Megjegyzés (csak mi látjuk)</span>
                <textarea className="doboz" rows={3} maxLength={1000} value={ujMegj} onChange={(e) => setUjMegj(e.target.value)} placeholder="Például: telefonon kérte, nem boldogul a NAV oldalával." />
              </label>
              <p className="sugo" style={{ margin: 0 }}>A kérés ehhez a visszahíváshoz kapcsolódik. Az ügyfél az appban látja a lépéseket; belépési adatot soha nem kérünk tőle.</p>
            </div>
          )}

          {mod === 'eredmeny' && (
            <div className="oszlop" style={{ gap: 14 }}>
              <h3 className="kis-cim">Mi lett a hívással?</h3>
              {varni > 0 && (
                <div className="uzenet-sav figyel">
                  Legutóbb {elteltPerc(varni)} perce próbáltad. Ha teheted, várj még {varni} percet a következő hívással.
                </div>
              )}
              <div className="valaszto fuggoleges" role="radiogroup" aria-label="A hívás eredménye">
                {CALLBACK_ATTEMPT_OUTCOMES.map((o) => (
                  <label key={o}>
                    <input type="radio" name="eredmeny" checked={eredmeny.outcome === o} onChange={() => setEredmeny({ ...eredmeny, outcome: o })} />
                    {CALLBACK_ATTEMPT_OUTCOME_LABELS[o]}
                  </label>
                ))}
              </div>
              {eredmeny.outcome === 'kesobb_kerte' && (
                <label className="mezo">
                  <span className="felirat">Mikor hívjuk újra?</span>
                  <input className="doboz" type="datetime-local" value={eredmeny.mikor} onChange={(e) => setEredmeny({ ...eredmeny, mikor: e.target.value })} />
                </label>
              )}
              {(eredmeny.outcome === 'nem_vette_fel' || eredmeny.outcome === 'foglalt') && (
                <p className="sugo" style={{ margin: 0 }}>
                  Ez a {d.failedAttempts + 1}. sikertelen próba a {CALLBACK_RULES.maxFailedAttempts}-ból.
                  {d.failedAttempts + 1 >= CALLBACK_RULES.maxFailedAttempts ? ' Utána lezárjuk, és megírjuk az ügyfélnek, hogy keressen üzenetben.' : ' Az ügyfél értesítést kap, hogy újra próbáljuk.'}
                </p>
              )}
              {eredmeny.outcome === 'hibas_szam' && <p className="sugo" style={{ margin: 0 }}>Megkérjük az ügyfelet, hogy adja meg a jó számot. Ha megadta, nálad marad, és értesítünk.</p>}
              <label className="mezo">
                <span className="felirat">Rövid jegyzet (csak mi látjuk)</span>
                <textarea className="doboz" rows={3} maxLength={CALLBACK_RULES.attemptNoteMaxChars} value={eredmeny.note} onChange={(e) => setEredmeny({ ...eredmeny, note: e.target.value })} />
              </label>
              {eredmeny.outcome === 'beszeltunk' && (
                <label className="mezo">
                  <span className="felirat">Összefoglaló az ügyfélnek (nem kötelező)</span>
                  <textarea
                    className="doboz"
                    rows={4}
                    maxLength={CALLBACK_RULES.summaryMaxChars}
                    value={eredmeny.summary}
                    placeholder="Például: megbeszéltük, hogy a tevékenységeknél a „Fotózás” sort választod."
                    onChange={(e) => setEredmeny({ ...eredmeny, summary: e.target.value })}
                  />
                  <span className="sugo">Üzenetként megkapja, így „A hívásunk összefoglalója:” kezdettel. Ne írj bele jelszót, kódot vagy kártyaadatot.</span>
                </label>
              )}
            </div>
          )}

          {mod === 'atad' && (
            <div className="oszlop" style={{ gap: 12 }}>
              <h3 className="kis-cim">Kinek adod át?</h3>
              <div className="valaszto fuggoleges" role="radiogroup" aria-label="Kinek adod át">
                {cimzettek.map((a) => (
                  <label key={a.userId}>
                    <input type="radio" name="atad" checked={atad === a.userId} onChange={() => setAtad(a.userId)} />
                    {a.name}
                    <span className="halvany kicsi">{a.role === 'accountant' ? 'az ügyfél könyvelője' : a.role === 'admin' ? 'tulajdonos' : 'ügyfélszolgálat'}</span>
                  </label>
                ))}
                {d.assignee && (
                  <label>
                    <input type="radio" name="atad" checked={atad === 'sor'} onChange={() => setAtad('sor')} />
                    Vissza a sorba, gazda nélkül
                  </label>
                )}
              </div>
              <p className="sugo" style={{ margin: 0 }}>Aki megkapja, értesítést kap, és ő látja a teljes számot.</p>
            </div>
          )}

          {mod === 'lezar' && (
            <div className="oszlop" style={{ gap: 12 }}>
              <h3 className="kis-cim">Miért zárod le hívás nélkül?</h3>
              <div className="valaszto fuggoleges" role="radiogroup" aria-label="Lezárás oka">
                {CALLBACK_CLOSE_REASONS.map((r) => (
                  <label key={r}>
                    <input type="radio" name="lezar" checked={lezar.reason === r} onChange={() => setLezar({ ...lezar, reason: r })} />
                    {CALLBACK_CLOSE_REASON_LABELS[r]}
                  </label>
                ))}
              </div>
              <label className="mezo">
                <span className="felirat">Megjegyzés (csak mi látjuk)</span>
                <textarea className="doboz" rows={3} maxLength={CALLBACK_RULES.attemptNoteMaxChars} value={lezar.note} onChange={(e) => setLezar({ ...lezar, note: e.target.value })} />
              </label>
              <p className="sugo" style={{ margin: 0 }}>Az ügyfél rövid értesítést kap a lezárásról.</p>
            </div>
          )}
        </div>
      )}
    </Fiok>
  );
}

/** The branch line of the callback drawer (SPEC §27.2.5): current answer, history and – for csapat/admin – the change form. */
function UtvonalSor({ c, valtas }: { c: TeamClientCard; valtas: () => void }) {
  if (c.lifecycle !== 'bekotes_alatt' && !(c.pathHistory ?? []).length) return null;
  return (
    <dl className="adatok tomor" style={{ marginTop: 6 }}>
      <dt>Útvonal</dt>
      <dd>
        <Utvonal c={c} valtas={valtas} />
      </dd>
    </dl>
  );
}
function UtvonalMod({ c, vissza, adja }: { c: TeamClientCard; vissza: () => void; adja: (v: UtvonalValtas | null) => void }) {
  const v = useUtvonalValtas(c, () => vissza());
  // hand the state to the footer button whenever something it shows changes (mutate is stable)
  useEffect(() => {
    adja(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.megj, v.adoszamTorol, v.mehet, v.ment.isPending, v.cel, adja]);
  useEffect(() => () => adja(null), [adja]);
  return (
    <div className="oszlop" style={{ gap: 10 }}>
      <h3 className="kis-cim">Útvonal módosítása</h3>
      <UtvonalTorzs v={v} />
    </div>
  );
}
