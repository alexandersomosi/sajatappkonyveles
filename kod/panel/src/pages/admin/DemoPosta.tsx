// DEMO only: the last e-mails the system would have sent (codes for testers). 404 when MAIL_MODE is not demo.
// k8 ALAP-B: "Levél képe" opens the HTML image of the new mail template in a new tab (signed 5-minute link; the panel's
// CSP forbids frames, so no iframe).
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { adminDemoMailHtml } from '../../api/k8';
import { usePirito } from '../../ui/Pirito';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';

export default function DemoPosta() {
  const q = useQuery({ queryKey: ['admin', 'outbox'], queryFn: ep.adminDemoOutbox, refetchInterval: 15_000 });
  const [nyitott, setNyitott] = useState<string | null>(null);
  const pir = usePirito();
  const t = today();
  const kep = (id: string) => {
    // the tab opens synchronously (no popup blocker), the address follows when the server answers
    const w = window.open('', '_blank');
    adminDemoMailHtml(id).then(
      (r) => {
        if (w) w.location.href = r.url;
        else window.location.assign(r.url);
      },
      (e: unknown) => {
        w?.close();
        pir.hiba(e);
      },
    );
  };
  return (
    <>
      <Fejlec felcim="DEMO" cim="Demo-postafiók" mellek="Amíg nincs bekötve a levélküldő (Brevo), az e-maileket nem küldjük el, hanem itt látod őket 7 napig. Élesben ez az oldal nincs." />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : (q.data?.items.length ?? 0) === 0 ? (
            <Ures n="level_boritek" cim="Üres a postafiók" />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Mikor</th>
                  <th>Kinek</th>
                  <th className="utolso">Tárgy</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.items.map((m) => (
                  <Fragment key={m.id}>
                    <tr className="kattinthato" onClick={() => setNyitott(nyitott === m.id ? null : m.id)}>
                      <td className="elso nt">{idopont(m.createdAt, t)}</td>
                      <td className="szam">{m.toDisplay}</td>
                      <td className="utolso felkover">{m.subject}</td>
                    </tr>
                    {nyitott === m.id && (
                      <tr>
                        <td colSpan={3} className="elso utolso">
                          <div className="kod-doboz">{m.bodyText}</div>
                          <button type="button" className="gomb-m kicsi" style={{ marginTop: 8 }} onClick={() => kep(m.id)}>
                            Levél képe
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
