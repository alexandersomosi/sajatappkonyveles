// Üzenetek: chat with the client, attachments, reply templates (FUNKCIOK 16, 24).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { HibaSav, Toltes, Ures } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { useAuth } from '../../../auth/Auth';
import { today } from '../../../lib/today';
import { fajlHiba } from '../../../lib/validate';
import { Buborek } from '../../kozos/Buborek';
import { useCsevegoMagassag } from '../../../ui/useCsevegoMagassag';
import { VezerloIkon } from '../../../_shared/v2/web';

export default function Uzenetek({ c }: FulProps) {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const { konyvelo } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ['acc', 'messages', c.id],
    queryFn: ({ pageParam }) => ep.accMessages(c.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  const sablonok = useQuery({ queryKey: ['acc', 'templates'], queryFn: ep.accTemplates });
  const [szoveg, setSzoveg] = useState('');
  const [csatolt, setCsatolt] = useState<{ fileId: string; name: string }[]>([]);
  const [tolt, setTolt] = useState(false);
  const lista = useRef<HTMLDivElement>(null);
  const fajl = useRef<HTMLInputElement>(null);
  const uzenetek = useMemo(() => (q.data?.pages.flatMap((p) => p.items) ?? []).slice().reverse(), [q.data]);
  useCsevegoMagassag(lista, [c.id, q.isPending]);
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [uzenetek.length]);
  // Opening the thread marks the client's messages read on the server: refresh the tab badge and the list.
  const olvasott = q.dataUpdatedAt;
  useEffect(() => {
    if (!olvasott) return;
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'clients'] });
  }, [olvasott, c.id, qc]);
  const kuld = useMutation({
    mutationFn: () => ep.accSendMessage(c.id, { body: szoveg.trim(), fileIds: csatolt.map((x) => x.fileId) }),
    onSuccess: () => {
      setSzoveg('');
      setCsatolt([]);
      void qc.invalidateQueries({ queryKey: ['acc', 'messages', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
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
        const r = await ep.accAttachment(f);
        setCsatolt((x) => [...x, { fileId: r.fileId, name: f.name }]);
      }
    } catch (e) {
      pir.hiba(e);
    } finally {
      setTolt(false);
    }
  }
  const tolteniKell = (s: string) => s.replaceAll('{firstName}', c.firstName).replaceAll('{ugyfelNev}', c.firstName);
  return (
    <div className="racs fo-mellek">
      <div className="lap">
        <div className="lap-fej">
          <h2>Üzenetek {c.firstName} és közted</h2>
          <span className="megj">{konyvelo?.responseTimeText ?? ''}</span>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="csevego" ref={lista}>
          {q.hasNextPage && (
            <button className="gomb-sz" style={{ alignSelf: 'center' }} onClick={() => void q.fetchNextPage()}>
              Korábbi üzenetek
            </button>
          )}
          {q.isPending ? (
            <Toltes />
          ) : uzenetek.length === 0 ? (
            <Ures n="level_boritek" cim="Még nem írtatok egymásnak">
              Írj neki pár szót, például hogy mire számíthat az első hónapban.
            </Ures>
          ) : (
            uzenetek.map((m) => <Buborek key={m.id} m={m} t={t} />)
          )}
        </div>
        <div className="iro-sor">
          <button className="csatol" title="Fájl csatolása" aria-label="Fájl csatolása" disabled={tolt} onClick={() => fajl.current?.click()}>
            <VezerloIkon nev="gemkapocs" pt={24} />
          </button>
          <input ref={fajl} type="file" hidden multiple accept="application/pdf,image/jpeg,image/png" onChange={(e) => { void csatol(e.target.files); e.target.value = ''; }} />
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
              placeholder={`Írj ${c.firstName} részére…`}
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
      </div>
      <div className="lap">
        <div className="lap-fej">
          <I3 n="uzenetek" s={36} />
          <h2>Válaszsablonok</h2>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          <p className="halvany kicsi" style={{ marginBottom: 10 }}>
            Kattints, és beírjuk a szövegdobozba. Küldés előtt átírhatod.
          </p>
          {sablonok.isPending && <Toltes />}
          <div className="oszlop" style={{ gap: 8 }}>
            {(sablonok.data?.items ?? []).map((s) => (
              <button key={s.id} className="negyedev-kartya" style={{ padding: '12px 14px', boxShadow: 'inset 0 0 0 1px var(--keret)' }} onClick={() => setSzoveg((x) => (x ? `${x}\n${tolteniKell(s.body)}` : tolteniKell(s.body)))}>
                <div className="cim">{s.title}</div>
                <div className="halvany kicsi" style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>
                  {tolteniKell(s.body).slice(0, 140)}
                  {s.body.length > 140 ? '…' : ''}
                </div>
              </button>
            ))}
          </div>
          <Link className="gomb-sz" to="/sablonok" style={{ display: 'inline-block', marginTop: 12 }}>
            Sablonok szerkesztése
          </Link>
        </div>
      </div>
    </div>
  );
}

