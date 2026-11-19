// /admin/csapat – service team members (role csapat, SPEC §26.3.4): invite, see their load, suspend / re-enable.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamMemberRow } from '../../api/types';
import { Fejlec, Fiok, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { emailOk } from '../../lib/validate';
import { idopont, datum } from '../../lib/format';
import { today } from '../../lib/today';

const URES = { email: '', displayName: '', firstName: '' };

export default function Csapat() {
  const qc = useQueryClient();
  const pir = usePirito();
  const t = today();
  const q = useQuery({ queryKey: ['admin', 'team'], queryFn: ep.adminTeam });
  const [uj, setUj] = useState(false);
  const [f, setF] = useState(URES);
  const [felfugg, setFelfugg] = useState<TeamMemberRow | null>(null);
  const meghiv = useMutation({
    mutationFn: () => ep.adminInviteTeamMember({ email: f.email.trim(), displayName: f.displayName.trim(), firstName: f.firstName.trim() }),
    onSuccess: () => {
      pir.ok('Meghívó elküldve. Az e-mailben kapott kóddal állít be jelszót, utána kétlépcsős belépést.');
      setUj(false);
      setF(URES);
      void qc.invalidateQueries({ queryKey: ['admin', 'team'] });
    },
    onError: pir.hiba,
  });
  const aktiv = useMutation({
    mutationFn: (x: { userId: string; active: boolean }) => ep.adminPatchTeamMember(x.userId, { active: x.active }),
    onSuccess: (_r, x) => {
      setFelfugg(null);
      pir.ok(x.active ? 'Visszakapcsoltad. Újra be tud lépni.' : 'Felfüggesztetted. Kiléptettük, a nyitott visszahívásai visszakerültek a sorba.');
      void qc.invalidateQueries({ queryKey: ['admin', 'team'] });
      void qc.invalidateQueries({ queryKey: ['team'] });
    },
    onError: pir.hiba,
  });
  const kesz = emailOk(f.email) && f.displayName.trim().length >= 3 && f.firstName.trim().length >= 2;
  const rows = q.data?.items ?? [];
  const aktivak = rows.filter((r) => r.active).length;
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Csapat"
        mellek={
          <>
            <b>{aktivak}</b> aktív ügyfélszolgálatos. Visszahívják az ügyfeleket, átnézik az új vállalkozások NAV-os igazolását, és válaszolnak a bekötés alatt álló ügyfeleknek.
            <br />
            Adót, iratot, azonosítást és NAV-adatot nem látnak.
          </>
        }
        jobb={
          <button className="gomb-sav szoveg" onClick={() => setUj(true)}>
            Új munkatárs
          </button>
        }
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="level_boritek" cim="Még nincs munkatárs" gombok={<button className="gomb-e" onClick={() => setUj(true)}>Új munkatárs</button>}>
              Addig a visszahívásokat és az ellenőrzést te vagy a könyvelők viszik.
            </Ures>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Munkatárs</th>
                  <th>Állapot</th>
                  <th className="jobb tor">Nyitott visszahívás</th>
                  <th className="jobb tor">Beszéltünk<br />(30 nap)</th>
                  <th className="jobb tor">Ellenőrzött bejelentés<br />(30 nap)</th>
                  <th>Utolsó belépés</th>
                  <th className="utolso" />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.userId} style={!m.active ? { opacity: 0.6 } : undefined}>
                    <td className="elso">
                      <div className="sor-flex">
                        <I3 n="fiok" s={36} />
                        <div>
                          <div className="felkover">{m.displayName}</div>
                          {/* a long address may break after the @ (never in the middle of a word) */}
                          <div className="al">
                            {m.email.split('@')[0]}@<wbr />
                            {m.email.split('@').slice(1).join('@')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {m.active ? (
                        <span className="allapot">
                          <span className="szo">Aktív</span>
                        </span>
                      ) : (
                        <span className="cimke">Felfüggesztve</span>
                      )}
                      <div className="al" title="Kétlépcsős belépés">{m.totpEnabled ? 'kétlépcsős: bekapcsolva' : <span className="cimke figyel">kétlépcsős: még nincs</span>}</div>
                    </td>
                    <td className="jobb szam">{m.openCallbacks}</td>
                    <td className="jobb szam">{m.callbacksDone30d}</td>
                    <td className="jobb szam">{m.registrationsChecked30d}</td>
                    <td>{m.lastLoginAt ? idopont(m.lastLoginAt, t) : <span className="halvany">még nem lépett be<br />(meghívva {datum(m.createdAt.slice(0, 10))})</span>}</td>
                    <td className="utolso jobb nt">
                      <button className={m.active ? 'gomb-v' : 'gomb-sz'} disabled={aktiv.isPending} onClick={() => (m.active ? setFelfugg(m) : aktiv.mutate({ userId: m.userId, active: true }))}>
                        {m.active ? 'Felfüggesztem' : 'Visszakapcsolom'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
          A munkatársak ugyanúgy lépnek be, mint a könyvelők: e-mail, jelszó és kétlépcsős kód. A telefonszámot csak akkor látják, ha a visszahívást magukra vették, és ezt naplózzuk.
        </p>
      </div>
      <Fiok
        nyitva={felfugg !== null}
        bezar={() => !aktiv.isPending && setFelfugg(null)}
        ikon="fiok"
        cim={felfugg ? `Felfüggeszted ${felfugg.displayName} fiókját?` : ''}
        bev="Azonnal kilép mindenhonnan, és nem tud belépni, amíg vissza nem kapcsolod. A nyitott visszahívásai visszakerülnek a sorba, gazda nélkül."
        lab={
          <>
            <button className="gomb-v" disabled={aktiv.isPending} onClick={() => felfugg && aktiv.mutate({ userId: felfugg.userId, active: false })}>
              {aktiv.isPending ? 'Felfüggesztem…' : 'Igen, felfüggesztem'}
            </button>
            <button className="gomb-sz" disabled={aktiv.isPending} onClick={() => setFelfugg(null)}>
              Mégse
            </button>
          </>
        }
      >
        <dl className="adatok">
          <dt>Munkatárs</dt>
          <dd>{felfugg?.displayName}</dd>
          <dt>Nyitott visszahívása</dt>
          <dd>{felfugg?.openCallbacks ?? 0}</dd>
          {aktivak <= 1 && (
            <>
              <dt>Figyelem</dt>
              <dd>Ő az egyetlen aktív ügyfélszolgálatos. Utána a visszahívásokat neked kell vinned.</dd>
            </>
          )}
        </dl>
      </Fiok>
      <Fiok
        nyitva={uj}
        bezar={() => setUj(false)}
        ikon="fiok"
        cim="Új munkatárs"
        bev="E-mailben kap egy kódot, azzal állít be jelszót, utána kétlépcsős belépést. Az ügyfelek csak a keresztnevét látják: „Anna · ügyfélszolgálat”."
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
            <input className="doboz" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Nagy Anna" />
          </label>
          <label className="mezo">
            <span className="felirat">Keresztnév (így látják az ügyfelek)</span>
            <input className="doboz" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="Anna" />
          </label>
        </div>
        <div className="uzenet-sav info" style={{ marginTop: 16 }}>
          <div>
            <b>Mit lát?</b> A visszahívási kéréseket, az új vállalkozások adatlapját és NAV-os igazolását, és a bekötés alatt álló ügyfelek üzeneteit.
            <br />
            <b>Mit nem lát?</b> Adót, bevételt, dossziét, azonosító okmányt, NAV-hozzáférést és a tulajdonosi oldalakat.
          </div>
        </div>
      </Fiok>
    </>
  );
}
