// /uzenetek – the service team answers clients who are still in onboarding (SPEC §26.4). Once a client is active,
// only his accountant writes to him (the API answers 404). Messages show to the client as "Anna · ügyfélszolgálat".
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { useAuth } from '../../auth/Auth';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { Buborek } from '../kozos/Buborek';
import { REGISTRATION_STATUS_LABELS } from '../../_shared/enums';
import { MILESTONE_KOVETKEZO } from '../../lib/labels';
import { KovetkezoLepes } from './UgyfelKartya';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { fajlHiba } from '../../lib/validate';
import { useCsevegoMagassag } from '../../ui/useCsevegoMagassag';

export default function CsapatUzenetek() {
  const { clientId } = useParams();
  const nav = useNavigate();
  const t = today();
  const szalak = useInfiniteQuery({
    queryKey: ['team', 'threads'],
    queryFn: ({ pageParam }) => ep.teamThreads(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  const lista = useMemo(() => szalak.data?.pages.flatMap((p) => p.items) ?? [], [szalak.data]);
  const olvasatlan = lista.filter((x) => x.unread > 0).length;
  // Open the first unread thread when none is chosen.
  useEffect(() => {
    if (!clientId && lista.length) nav(`/uzenetek/${(lista.find((x) => x.unread > 0) ?? lista[0])!.client.id}`, { replace: true });
  }, [clientId, lista, nav]);
  const valasztott = lista.find((x) => x.client.id === clientId);
  return (
    <>
      <Fejlec
        felcim="Ügyfélszolgálat"
        cim="Üzenetek"
        rozR={260}
        mellek={
          <>
            <b>{lista.length}</b> ügyfél bekötés alatt · <b>{olvasatlan}</b> olvasatlan beszélgetés
            <br />
            Csak a bekötés alatt álló ügyfeleknek írhatsz. Ha valaki aktív lett, a könyvelője válaszol neki.
          </>
        }
      />
      <div className="tartalom">
        {szalak.isError && <HibaSav hiba={szalak.error} ujra={() => szalak.refetch()} />}
        <div className="uzenet-racs">
          <div className="lap szal-lista" aria-label="Beszélgetések">
            {szalak.isPending ? (
              <Toltes />
            ) : lista.length === 0 ? (
              <Ures n="level_boritek" cim="Nincs bekötés alatt álló ügyfél" />
            ) : (
              lista.map((x) => (
                <Link key={x.client.id} to={`/uzenetek/${x.client.id}`} className={`szal${x.client.id === clientId ? ' on' : ''}`} replace>
                  <div className="sor-flex ter" style={{ gap: 8 }}>
                    <span className={`nev${x.unread ? ' felkover' : ''}`}>{x.client.name}</span>
                    {x.lastMessageAt && <span className="halvany kicsi nt">{idopont(x.lastMessageAt, t)}</span>}
                  </div>
                  <div className="al">{x.lastMessagePreview ?? 'Még nem írtatok egymásnak.'}</div>
                  <div className="sor-flex" style={{ gap: 6, marginTop: 4 }}>
                    {/* k5 #5 (§27.16): a path change never shows as "elállt"; the next step reads "most ez jön nála" everywhere.
                        journeyNext / pathChanged are optional panel-contract additions (README §28 builder notes). */}
                    {(x as typeof x & { pathChanged?: boolean }).pathChanged ? (
                      <span className="cimke info">Útvonalat váltott – már van vállalkozása</span>
                    ) : x.registrationStatus && x.registrationStatus !== 'elallt' ? (
                      <span className="cimke info">Vállalkozás: {REGISTRATION_STATUS_LABELS[x.registrationStatus].toLowerCase()}</span>
                    ) : (x as typeof x & { journeyNext?: string | null }).journeyNext ? (
                      <span className="cimke">Most ez jön nála: {(x as typeof x & { journeyNext?: string | null }).journeyNext}</span>
                    ) : x.milestone ? (
                      <span className="cimke">Most ez jön nála: {MILESTONE_KOVETKEZO[x.milestone]}</span>
                    ) : null}
                    {x.unread > 0 && <span className="cimke figyel">{x.unread} új</span>}
                  </div>
                </Link>
              ))
            )}
            {szalak.hasNextPage && (
              <div className="lapozo">
                <button className="gomb-sz" onClick={() => void szalak.fetchNextPage()}>
                  Továbbiak
                </button>
              </div>
            )}
          </div>
          {clientId ? <Szal key={clientId} clientId={clientId} nev={valasztott?.client.name ?? ''} /> : <div className="lap"><Ures n="level_boritek" cim="Válassz egy beszélgetést" /></div>}
        </div>
      </div>
    </>
  );
}

function Szal({ clientId, nev }: { clientId: string; nev: string }) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const { me } = useAuth();
  const kartya = useQuery({ queryKey: ['team', 'client', clientId], queryFn: () => ep.teamClient(clientId) });
  const q = useInfiniteQuery({
    queryKey: ['team', 'messages', clientId],
    queryFn: ({ pageParam }) => ep.teamMessages(clientId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  const [szoveg, setSzoveg] = useState('');
  const [csatolt, setCsatolt] = useState<{ fileId: string; name: string }[]>([]);
  const [tolt, setTolt] = useState(false);
  const doboz = useRef<HTMLDivElement>(null);
  const fajl = useRef<HTMLInputElement>(null);
  const uzenetek = useMemo(() => (q.data?.pages.flatMap((p) => p.items) ?? []).slice().reverse(), [q.data]);
  const utolsoId = q.data?.pages[0]?.items[0]?.id;
  useCsevegoMagassag(doboz, [clientId, q.isPending]);
  useEffect(() => {
    doboz.current?.scrollTo({ top: doboz.current.scrollHeight });
  }, [uzenetek.length]);
  // Mark read up to the newest message (team read marker, SPEC §26.9 messages.read_by_team_at).
  useEffect(() => {
    if (!utolsoId) return;
    ep.teamReadMessages(clientId, utolsoId)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ['team', 'threads'] });
        void qc.invalidateQueries({ queryKey: ['team', 'summary'] });
      })
      .catch(() => {});
  }, [utolsoId, clientId, qc]);
  const kuld = useMutation({
    mutationFn: () => ep.teamSendMessage(clientId, { body: szoveg.trim(), fileIds: csatolt.map((x) => x.fileId) }),
    onSuccess: () => {
      setSzoveg('');
      setCsatolt([]);
      void qc.invalidateQueries({ queryKey: ['team', 'messages', clientId] });
      void qc.invalidateQueries({ queryKey: ['team', 'threads'] });
    },
    onError: pir.hiba,
  });
  async function csatol(files: FileList | null) {
    if (!files?.length) return;
    setTolt(true);
    try {
      for (const f of Array.from(files)) {
        const h = fajlHiba(f);
        if (h) {
          pir.hiba(new Error(h));
          continue;
        }
        const r = await ep.teamAttachment(f, clientId);
        setCsatolt((x) => [...x, { fileId: r.fileId, name: f.name }]);
      }
    } catch (e) {
      pir.hiba(e);
    } finally {
      setTolt(false);
    }
  }
  const k = kartya.data;
  const nevem = me?.teamMember?.firstName;
  const irhat = k ? k.canMessage : true;
  return (
    <div className="lap">
      <div className="lap-fej">
        <div style={{ minWidth: 0 }}>
          <h2>{k?.name ?? nev}</h2>
          <div className="megj">
            {k ? (
              <>
                {k.email}
                {k.accountant && <> · könyvelője {k.accountant.name}</>}
                {k.lifecycle === 'bekotes_alatt' ? <KovetkezoLepes c={k} halvany={false} /> : null}
              </>
            ) : (
              ' '
            )}
          </div>
        </div>
        <div className="jobbra">
          {k?.registration && (
            <Link className="gomb-sz" to={`/vallalkozas-inditas/${k.registration.id}`}>
              Vállalkozás-indítás
            </Link>
          )}
          {k?.openCallbackId && (
            <Link className="gomb-sz" to={`/visszahivasok?szuro=mind&nyit=${k.openCallbackId}`}>
              Visszahívást kért
            </Link>
          )}
        </div>
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      <div className="csevego" ref={doboz}>
        {q.hasNextPage && (
          <button className="gomb-sz" style={{ alignSelf: 'center' }} onClick={() => void q.fetchNextPage()}>
            Korábbi üzenetek
          </button>
        )}
        {q.isPending ? (
          <Toltes />
        ) : uzenetek.length === 0 ? (
          <Ures n="level_boritek" cim="Még nem írt nekünk">
            Ha kérdése van a bekötéssel kapcsolatban, itt válaszolhatsz.
          </Ures>
        ) : (
          uzenetek.map((m) => <Buborek key={m.id} m={m} t={t} />)
        )}
      </div>
      {irhat ? (
        <div className="iro-sor">
          <button className="csatol" title="Fájl csatolása" aria-label="Fájl csatolása" disabled={tolt} onClick={() => fajl.current?.click()}>
            <I3 n="feltoltes" s={32} />
          </button>
          <input
            ref={fajl}
            type="file"
            hidden
            multiple
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              void csatol(e.target.files);
              e.target.value = '';
            }}
          />
          <div style={{ flex: 1 }}>
            {csatolt.length > 0 && (
              <div className="cimkek" style={{ marginBottom: 6 }}>
                {csatolt.map((x) => (
                  <span key={x.fileId} className="cimke">
                    {x.name}{' '}
                    <button className="gomb-sz" style={{ fontSize: 12.5 }} aria-label={`${x.name} eltávolítása`} onClick={() => setCsatolt((l) => l.filter((y) => y.fileId !== x.fileId))}>
                      Eltávolítom
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              className="doboz"
              rows={2}
              maxLength={4000}
              placeholder={`Írj neki… Így látja: „${nevem ?? 'Anna'} · ügyfélszolgálat”`}
              value={szoveg}
              onChange={(e) => setSzoveg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && szoveg.trim()) kuld.mutate();
              }}
            />
          </div>
          <button className="gomb-e" disabled={!szoveg.trim() || kuld.isPending || tolt} onClick={() => kuld.mutate()}>
            Küldés
          </button>
        </div>
      ) : (
        <div className="uzenet-sav info" style={{ margin: 16 }}>
          Ez az ügyfél már aktív, a könyvelője válaszol neki. Ha hívást kér, a visszahívásoknál látod.
        </div>
      )}
    </div>
  );
}
