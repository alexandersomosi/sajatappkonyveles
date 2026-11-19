// "Visszahívás felvétele": a colleague records a callback for a client (source 'csapat', SPEC §26.10
// POST /team/clients/:clientId/callbacks). Used on the pipeline detail and on the accountant's client tab.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamCallbackDetail } from '../../api/types';
import { Fiok, Lenyilo } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { CALLBACK_RULES, CALLBACK_TOPIC_LABELS, CALLBACK_TOPICS, CALLBACK_WINDOW_LABELS, CALLBACK_WINDOWS, type CallbackTopic, type CallbackWindow } from '../../_shared/enums';
import { normalizeHuPhone } from '../../_shared/bekotes';

export function UjVisszahivasFiok({
  nyitva,
  bezar,
  clientId,
  nev,
  alapTema = 'egyeb',
  kesz,
}: {
  nyitva: boolean;
  bezar: () => void;
  clientId: string;
  nev: string;
  alapTema?: CallbackTopic;
  kesz?: (d: TeamCallbackDetail) => void;
}) {
  const qc = useQueryClient();
  const pir = usePirito();
  const [f, setF] = useState<{ topic: CallbackTopic; window: CallbackWindow; note: string; phone: string }>({ topic: alapTema, window: 'barmikor', note: '', phone: '' });
  useEffect(() => {
    if (nyitva) setF({ topic: alapTema, window: 'barmikor', note: '', phone: '' });
  }, [nyitva, alapTema]);
  const telefon = f.phone.trim() ? normalizeHuPhone(f.phone) : null;
  const telefonHiba = f.phone.trim() && !telefon ? 'Magyar telefonszámot adj meg, például +36 30 123 4567.' : null;
  const felvesz = useMutation({
    mutationFn: () => ep.teamCreateCallback(clientId, { topic: f.topic, window: f.window, note: f.note.trim() || undefined, phone: telefon ?? undefined }),
    onSuccess: (d) => {
      pir.ok('Felvetted. Bekerült a visszahívások közé.');
      void qc.invalidateQueries({ queryKey: ['team'] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client-callbacks', clientId] });
      bezar();
      kesz?.(d);
    },
    onError: pir.hiba,
  });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      ikon="ora"
      cim={`Visszahívás felvétele – ${nev}`}
      bev="Ha telefonon vagy üzenetben kért hívást, itt veszed fel. A 48 órás határidő most indul."
      lab={
        <button className="gomb-e" disabled={!!telefonHiba || felvesz.isPending} onClick={() => felvesz.mutate()}>
          Felveszem
        </button>
      }
    >
      <div className="mezosor k2">
        <label className="mezo">
          <span className="felirat">Miben segítsünk?</span>
          <Lenyilo value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value as CallbackTopic })}>
            {CALLBACK_TOPICS.map((k) => (
              <option key={k} value={k}>
                {CALLBACK_TOPIC_LABELS[k]}
              </option>
            ))}
          </Lenyilo>
        </label>
        <label className="mezo">
          <span className="felirat">Telefonszám (ha nem a profilja szerinti)</span>
          <input className={`doboz${telefonHiba ? ' hibas' : ''}`} inputMode="tel" placeholder="+36 30 123 4567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          {telefonHiba ? <span className="hiba-szoveg">{telefonHiba}</span> : <span className="sugo">Üresen hagyva a profiljában megadott számot hívjuk.</span>}
        </label>
      </div>
      <div className="mezo" style={{ marginTop: 14 }}>
        <span className="felirat">Mikor hívhatjuk?</span>
        <div className="valaszto">
          {CALLBACK_WINDOWS.map((w) => (
            <label key={w}>
              <input type="radio" name="ablak" checked={f.window === w} onChange={() => setF({ ...f, window: w })} />
              {CALLBACK_WINDOW_LABELS[w]}
            </label>
          ))}
        </div>
      </div>
      <label className="mezo" style={{ marginTop: 14 }}>
        <span className="felirat">Megjegyzés</span>
        <textarea className="doboz" rows={3} maxLength={CALLBACK_RULES.noteMaxChars} value={f.note} placeholder="Röviden: miben kér segítséget?" onChange={(e) => setF({ ...f, note: e.target.value })} />
      </label>
    </Fiok>
  );
}
