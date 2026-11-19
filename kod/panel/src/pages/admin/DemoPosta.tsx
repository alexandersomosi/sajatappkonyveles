// DEMO only: the last e-mails the system would have sent (codes for testers). 404 when MAIL_MODE is not demo.
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';

export default function DemoPosta() {
  const q = useQuery({ queryKey: ['admin', 'outbox'], queryFn: ep.adminDemoOutbox, refetchInterval: 15_000 });
  const [nyitott, setNyitott] = useState<string | null>(null);
  const t = today();
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
