// FUNKCIOK 24: reply templates (own + global).
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { MessageTemplate } from '../../api/types';
import { Fejlec, Fiok, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';

export default function Sablonok() {
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['acc', 'templates'], queryFn: ep.accTemplates });
  const [szerk, setSzerk] = useState<Partial<MessageTemplate> | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: ['acc', 'templates'] });
  const ment = useMutation({
    mutationFn: () => (szerk?.id ? ep.accPatchTemplate(szerk.id, { title: szerk.title!.trim(), body: szerk.body!.trim() }) : ep.accCreateTemplate({ title: szerk!.title!.trim(), body: szerk!.body!.trim() })),
    onSuccess: () => {
      pir.ok('Elmentve.');
      setSzerk(null);
      void inv();
    },
    onError: pir.hiba,
  });
  const del = useMutation({ mutationFn: (id: string) => ep.accDeleteTemplate(id), onSuccess: () => { pir.ok('Törölve.'); void inv(); }, onError: pir.hiba });
  const items = q.data?.items ?? [];
  return (
    <>
      <Fejlec
        cim="Válaszsablonok"
        mellek="Gyakori válaszok egy kattintással. A {firstName} helyére az ügyfél keresztneve kerül."
        jobb={
          <button className="gomb-sav szoveg" onClick={() => setSzerk({ title: '', body: '' })}>
            Új sablon
          </button>
        }
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending ? (
          <Toltes />
        ) : items.length === 0 ? (
          <div className="lap">
            <Ures n="level_boritek" cim="Még nincs sablonod" gombok={<button className="gomb-e" onClick={() => setSzerk({ title: '', body: '' })}>Első sablon</button>} />
          </div>
        ) : (
          <div className="racs k2">
            {items.map((s) => (
              <div className="lap belso" key={s.id}>
                <div className="sor-flex ter">
                  <h2 style={{ fontSize: 17 }}>{s.title}</h2>
                  {s.global && <span className="cimke">közös</span>}
                </div>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: 'var(--halvany)' }}>{s.body}</p>
                {!s.global && (
                  <div className="gombsor" style={{ marginTop: 12 }}>
                    <button className="gomb-sz" onClick={() => setSzerk(s)}>
                      Szerkesztem
                    </button>
                    <button className="gomb-v" onClick={() => del.mutate(s.id)}>
                      Törlöm
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Fiok
        nyitva={!!szerk}
        bezar={() => setSzerk(null)}
        ikon="uzenetek"
        cim={szerk?.id ? 'Sablon szerkesztése' : 'Új sablon'}
        lab={
          <button className="gomb-e" disabled={!szerk?.title?.trim() || !szerk?.body?.trim() || ment.isPending} onClick={() => ment.mutate()}>
            Mentés
          </button>
        }
      >
        {szerk && (
          <>
            <label className="mezo">
              <span className="felirat">Rövid név</span>
              <input className="doboz" maxLength={80} value={szerk.title ?? ''} onChange={(e) => setSzerk({ ...szerk, title: e.target.value })} placeholder="NAV-levél: nincs teendő" />
            </label>
            <label className="mezo" style={{ marginTop: 14 }}>
              <span className="felirat">Szöveg</span>
              <textarea className="doboz" rows={6} maxLength={2000} value={szerk.body ?? ''} onChange={(e) => setSzerk({ ...szerk, body: e.target.value })} placeholder="Megnéztem: csak értesítés, nincs vele teendőd. Elteheted." />
            </label>
          </>
        )}
      </Fiok>
    </>
  );
}
