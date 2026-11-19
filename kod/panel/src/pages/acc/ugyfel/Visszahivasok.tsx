// Visszahívások of one client (SPEC §26.3.5): the accountant sees the client's callback history read-only; the ones
// handed to him open in the queue. Old booked appointments stay readable below (SPEC §26.2.9).
import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { HibaSav, Toltes, Ures } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { useAuth } from '../../../auth/Auth';
import { useMost } from '../../../ui/useMost';
import { APPT_LABEL, CALLBACK_SOURCE_LABEL } from '../../../lib/labels';
import { CALLBACK_TOPIC_LABELS } from '../../../_shared/enums';
import { idopont } from '../../../lib/format';
import { today } from '../../../lib/today';
import { nyitottVisszahivas } from '../../../lib/csapat';
import { AllapotSzo, SlaCimke } from '../../csapat/Visszahivasok';
import { UjVisszahivasFiok } from '../../csapat/UjVisszahivas';

export default function Visszahivasok({ c }: FulProps) {
  const { user } = useAuth();
  const t = today();
  const most = useMost();
  const [uj, setUj] = useState(false);
  const q = useQuery({ queryKey: ['acc', 'client-callbacks', c.id], queryFn: () => ep.accClientCallbacks(c.id) });
  const regi = useQuery({ queryKey: ['acc', 'appointments'], queryFn: ep.accAppointments, staleTime: 300_000 });
  const regiSorok = (regi.data?.appointments ?? []).filter((a) => a.client.id === c.id);
  const sorok = q.data?.items ?? [];
  const nyitott = sorok.find((r) => nyitottVisszahivas(r.status));
  const eltelt = q.dataUpdatedAt ? (Date.now() - q.dataUpdatedAt) / 60_000 : 0;
  return (
    <div className="racs fo-mellek">
      <div>
        <div className="lap">
          <div className="lap-fej">
            <I3 n="ora" s={36} />
            <h2>Visszahívások</h2>
            <span className="megj">Kollégáink 24–48 órán belül hívják vissza.</span>
            <div className="jobbra">
              <button className="gomb-m kicsi csak-szoveg" disabled={!!nyitott} title={nyitott ? 'Már van nyitott kérése.' : undefined} onClick={() => setUj(true)}>
                Visszahívás felvétele
              </button>
            </div>
          </div>
          {nyitott && (
            <p className="sugo" style={{ margin: '-6px 22px 6px', textAlign: 'right' }}>
              Már van nyitott kérése, újat akkor vehetsz fel, ha az lezárult.
            </p>
          )}
          {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
          {q.isPending ? (
            <Toltes />
          ) : sorok.length === 0 ? (
            <Ures n="hatarido_naptar" cim={`${c.firstName} még nem kért visszahívást`}>
              Ha kér, a csapat hívja vissza. Ha neked adják át, a Visszahívások oldalon látod.
            </Ures>
          ) : (
            sorok.map((r) => {
              const enyem = r.assignee?.userId === user?.id;
              return (
                <div className="ikonsor" key={r.id}>
                  <I3 n="ora" s={44} />
                  <div className="l">
                    <div className="cim">
                      {CALLBACK_TOPIC_LABELS[r.topic]} · <span className="halvany">{CALLBACK_SOURCE_LABEL[r.source]}</span>
                    </div>
                    <div className="al">
                      Kérte: {idopont(r.createdAt, t)}
                      {r.assignee && <> · intézi: {enyem ? 'te' : r.assignee.firstName}</>}
                      {r.notePreview && <> · „{r.notePreview}”</>}
                    </div>
                  </div>
                  <div className="oszlop" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <AllapotSzo row={r} most={most} />
                    {nyitottVisszahivas(r.status) && <SlaCimke row={r} eltelt={eltelt} />}
                  </div>
                  {enyem && (
                    <Link className="gomb-sz" to={`/visszahivasok?szuro=mind&nyit=${r.id}`}>
                      Megnyitom
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
        {regiSorok.length > 0 && (
          <div className="lap" style={{ marginTop: 16 }}>
            <div className="lap-fej">
              <h2>Korábban foglalt időpontok</h2>
              <span className="megj">Időpontot már nem lehet foglalni. A még élő foglalásokból visszahívás lett.</span>
            </div>
            {regiSorok.map((a) => (
              <div className="ikonsor" key={a.id}>
                <I3 n="tepnaptar" s={44} />
                <div className="l">
                  <div className="cim">
                    {idopont(a.startsAt, t)} · {a.channel === 'telefon' ? 'telefonhívás' : 'videóhívás'}
                  </div>
                  <div className="al">
                    {APPT_LABEL[a.status]}
                    {a.topic && ` · „${a.topic}”`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="lap">
        <div className="lap-fej">
          <h2>Hogyan működik?</h2>
        </div>
        <div className="belso oszlop" style={{ paddingTop: 0, gap: 10, fontSize: 14.5 }}>
          <p>Az ügyfél az appban kér visszahívást. Kollégáink 24–48 órán belül hívják, munkanapokon 9 és 17 óra között.</p>
          <p>Ha adó- vagy könyvelési kérdés, neked adják át. Ilyenkor értesítést kapsz, és a menüben megjelenik a Visszahívások oldal.</p>
          <p className="halvany">A teljes telefonszámot csak az látja, akinél a kérés van. A hívást nem rögzítjük.</p>
        </div>
      </div>
      <UjVisszahivasFiok nyitva={uj} bezar={() => setUj(false)} clientId={c.id} nev={c.name} />
    </div>
  );
}
