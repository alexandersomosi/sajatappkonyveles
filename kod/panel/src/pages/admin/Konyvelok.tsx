// FUNKCIOK 30: accountant workload and invite (staff invite code by e-mail).
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { AdminAccountantRow } from '../../api/types';
import { Avatar, Fejlec, Fiok, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { emailOk } from '../../lib/validate';

const URES = { email: '', displayName: '', firstName: '', title: 'Mérlegképes könyvelő', registrationNumber: '', with: '', from: '', onto: '', acc: '' };

export default function Konyvelok() {
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['admin', 'accountants'], queryFn: ep.adminAccountants });
  const [uj, setUj] = useState(false);
  const [f, setF] = useState(URES);
  // Felfüggesztés előtt megerősítés (azonnal kilépteti mindenhonnan).
  const [felfugg, setFelfugg] = useState<AdminAccountantRow | null>(null);
  const meghiv = useMutation({
    mutationFn: () =>
      ep.adminInviteAccountant({
        email: f.email.trim(),
        displayName: f.displayName.trim(),
        firstName: f.firstName.trim(),
        title: f.title.trim(),
        registrationNumber: f.registrationNumber.trim(),
        nameForms: { with: f.with.trim(), from: f.from.trim(), onto: f.onto.trim(), acc: f.acc.trim() },
      }),
    onSuccess: () => {
      pir.ok('Meghívó elküldve. Az e-mailben kapott kóddal állít be jelszót.');
      setUj(false);
      setF(URES);
      void qc.invalidateQueries({ queryKey: ['admin', 'accountants'] });
    },
    onError: pir.hiba,
  });
  const aktiv = useMutation({
    mutationFn: (x: { id: string; active: boolean }) => ep.adminPatchAccountant(x.id, { active: x.active }),
    onSuccess: (_r, x) => {
      setFelfugg(null);
      pir.ok(x.active ? 'Visszakapcsoltad. Újra be tud lépni.' : 'Felfüggesztetted. Kiléptettük mindenhonnan.');
      void qc.invalidateQueries({ queryKey: ['admin', 'accountants'] });
    },
    onError: pir.hiba,
  });
  const kesz = emailOk(f.email) && f.displayName.trim() && f.firstName.trim() && f.registrationNumber.trim() && f.with.trim() && f.from.trim() && f.onto.trim() && f.acc.trim();
  const rows = q.data?.items ?? [];
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Könyvelők"
        mellek="Ki hány ügyfelet visz, hol torlódik a munka. Ha több könyvelő van, az Ügyfelek oldalon adhatsz át ügyfelet."
        jobb={
          <button className="gomb-sav szoveg" onClick={() => setUj(true)}>
            Könyvelő meghívása
          </button>
        }
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="level_boritek" cim="Még nincs könyvelő" />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Könyvelő</th>
                  <th>Ügyfelek / kapacitás</th>
                  <th className="jobb">Nyitott kérés</th>
                  <th className="jobb">Új irat</th>
                  <th className="jobb">Lejárt</th>
                  <th className="utolso" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} style={!a.active ? { opacity: 0.55 } : undefined}>
                    <td className="elso">
                      <div className="sor-flex">
                        <Avatar size="kicsi" />
                        <div>
                          <div className="felkover">{a.displayName}</div>
                          <div className="al">
                            {a.title} · {a.registrationNumber} · {a.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mini-sav" style={{ width: 120 }}>
                        <i className={a.clients / a.capacity >= 0.9 ? 'figyel' : ''} style={{ width: `${Math.min(100, (a.clients / Math.max(1, a.capacity)) * 100)}%` }} />
                      </span>{' '}
                      <span className="szam">
                        {a.clients} / {a.capacity}
                      </span>
                    </td>
                    <td className="jobb szam">{a.openRequests}</td>
                    <td className="jobb szam">{a.waitingDocuments}</td>
                    <td className="jobb szam">{a.overdueItems ? <span className="cimke hiba">{a.overdueItems}</span> : 0}</td>
                    <td className="utolso jobb">
                      <button className={a.active ? 'gomb-v' : 'gomb-sz'} onClick={() => (a.active ? setFelfugg(a) : aktiv.mutate({ id: a.id, active: true }))}>
                        {a.active ? 'Felfüggesztem' : 'Visszakapcsolom'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <Fiok
        nyitva={felfugg !== null}
        bezar={() => !aktiv.isPending && setFelfugg(null)}
        ikon="fiok"
        cim={felfugg ? `Felfüggeszted ${felfugg.displayName} fiókját?` : ''}
        bev="Azonnal kilép mindenhonnan, és nem tud belépni, amíg vissza nem kapcsolod. Az ügyfelei addig nem kapnak tőle választ: ha tartós, add át őket egy másik könyvelőnek az Ügyfelek oldalon."
        lab={
          <>
            <button className="gomb-v" disabled={aktiv.isPending} onClick={() => felfugg && aktiv.mutate({ id: felfugg.id, active: false })}>
              {aktiv.isPending ? 'Felfüggesztem…' : 'Igen, felfüggesztem'}
            </button>
            <button className="gomb-sz" disabled={aktiv.isPending} onClick={() => setFelfugg(null)}>
              Mégse
            </button>
          </>
        }
      >
        <dl className="adatok">
          <dt>Könyvelő</dt>
          <dd>{felfugg?.displayName}</dd>
          <dt>Ügyfelei</dt>
          <dd>{felfugg?.clients ?? 0}</dd>
          {rows.filter((r) => r.active).length <= 1 && (
            <>
              <dt>Figyelem</dt>
              <dd>Ő az egyetlen aktív könyvelő.</dd>
            </>
          )}
        </dl>
      </Fiok>
      <Fiok
        nyitva={uj}
        bezar={() => setUj(false)}
        ikon="fiok"
        cim="Könyvelő meghívása"
        bev="E-mailben kap egy kódot, azzal állít be jelszót. Az ügyfelek a nevét, címét és nyilvántartási számát látják."
        lab={
          <button className="gomb-e" disabled={!kesz || meghiv.isPending} onClick={() => meghiv.mutate()}>
            Meghívót küldök
          </button>
        }
      >
        <div className="mezosor k2">
          <label className="mezo" style={{ gridColumn: '1 / -1' }}>
            <span className="felirat">E-mail-cím</span>
            <input className="doboz" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
          <label className="mezo">
            <span className="felirat">Teljes név</span>
            <input className="doboz" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Kovács Bence" />
          </label>
          <label className="mezo">
            <span className="felirat">Keresztnév (így szólítják)</span>
            <input className="doboz" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="Bence" />
          </label>
          <label className="mezo">
            <span className="felirat">Cím</span>
            <input className="doboz" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="mezo">
            <span className="felirat">PM nyilvántartási szám</span>
            <input className="doboz" value={f.registrationNumber} onChange={(e) => setF({ ...f, registrationNumber: e.target.value })} />
          </label>
        </div>
        <div className="mezo" style={{ marginTop: 16 }}>
          <span className="felirat">A neve ragozva (az értesítőkhöz, hogy ne kelljen találgatni)</span>
          <div className="mezosor k2">
            {(
              [
                ['with', 'kivel? (Bencével)'],
                ['from', 'kitől? (Bencétől)'],
                ['onto', 'kire? (Bencére)'],
                ['acc', 'kit? (Bencét)'],
              ] as const
            ).map(([k, p]) => (
              <input key={k} className="doboz" placeholder={p} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={p} />
            ))}
          </div>
        </div>
      </Fiok>
    </>
  );
}
