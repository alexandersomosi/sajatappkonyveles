// FUNKCIOK 31: where clients came from (UTM + referral codes) and referral code management.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { Fejlec, Fiok, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { datumRovid } from '../../lib/format';
import { ajanloKodOk } from '../../lib/validate';

export default function Forrasok() {
  const qc = useQueryClient();
  const pir = usePirito();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const attr = useQuery({ queryKey: ['admin', 'attribution', from, to], queryFn: () => ep.adminAttribution({ from: from || undefined, to: to || undefined }) });
  const kodok = useQuery({ queryKey: ['admin', 'referral'], queryFn: ep.adminReferralCodes });
  const [uj, setUj] = useState(false);
  const [f, setF] = useState({ code: '', campaign: '', note: '' });
  const add = useMutation({
    mutationFn: () => ep.adminCreateReferralCode({ code: f.code, campaign: f.campaign.trim() || undefined, note: f.note.trim() || undefined }),
    onSuccess: () => {
      pir.ok('Kód létrehozva.');
      setUj(false);
      setF({ code: '', campaign: '', note: '' });
      void qc.invalidateQueries({ queryKey: ['admin', 'referral'] });
    },
    onError: pir.hiba,
  });
  const ki = useMutation({
    mutationFn: (x: { id: string; active: boolean }) => ep.adminPatchReferralCode(x.id, { active: x.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'referral'] }),
    onError: pir.hiba,
  });
  const rows = attr.data?.rows ?? [];
  const osszReg = rows.reduce((a, r) => a + r.signups, 0);
  const osszFiz = rows.reduce((a, r) => a + r.paying, 0);
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Honnan jöttek az ügyfelek"
        mellek="A hirdetések UTM-paraméterei és az ajánlókódok szerint. Jutalom az ajánlásért még nincs – erről te döntesz."
        jobb={
          <button className="gomb-sav szoveg" onClick={() => setUj(true)}>
            Új ajánlókód
          </button>
        }
      />
      <div className="tartalom">
        <div className="sor-flex" style={{ marginBottom: 14 }}>
          <span className="halvany kicsi">Regisztráció ettől</span>
          <input className="doboz" type="date" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="halvany kicsi">eddig</span>
          <input className="doboz" type="date" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {attr.isError && <HibaSav hiba={attr.error} ujra={() => attr.refetch()} />}
        <div className="lap">
          <div className="lap-fej">
            <h2>Források</h2>
            <span className="megj">
              {osszReg} regisztráció, ebből {osszFiz} fizet
            </span>
          </div>
          {attr.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim="Ebben az időszakban nem regisztrált senki" />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Forrás</th>
                  <th>Csatorna</th>
                  <th>Kampány</th>
                  <th>Ajánlókód</th>
                  <th className="jobb">Regisztrált</th>
                  <th className="jobb">Fizet</th>
                  <th className="jobb utolso">Arány</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="elso felkover">{r.source ?? 'közvetlen'}</td>
                    <td>{r.medium ?? '–'}</td>
                    <td>{r.campaign ?? '–'}</td>
                    <td className="szam">{r.code ?? '–'}</td>
                    <td className="jobb szam">{r.signups}</td>
                    <td className="jobb szam">{r.paying}</td>
                    <td className="jobb szam utolso">{r.signups ? `${Math.round((r.paying / r.signups) * 100)}%` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="lap" style={{ marginTop: 16 }}>
          <div className="lap-fej">
            <h2>Ajánlókódok</h2>
            <span className="megj">Minden ügyfélnek van saját kódja; kampánykódot itt hozhatsz létre.</span>
          </div>
          {kodok.isPending ? (
            <Toltes />
          ) : kodok.isError ? (
            <HibaSav hiba={kodok.error} />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Kód</th>
                  <th>Kié / kampány</th>
                  <th>Megjegyzés</th>
                  <th className="jobb">Regisztrált</th>
                  <th className="jobb">Fizet</th>
                  <th>Létrehozva</th>
                  <th className="utolso" />
                </tr>
              </thead>
              <tbody>
                {kodok.data.items.map((k) => (
                  <tr key={k.id} style={!k.active ? { opacity: 0.55 } : undefined}>
                    <td className="elso szam felkover">{k.code}</td>
                    <td>{k.ownerClient ? k.ownerClient.name : k.campaign ?? '–'}</td>
                    <td className="halvany">{k.note ?? ''}</td>
                    <td className="jobb szam">{k.signups}</td>
                    <td className="jobb szam">{k.paying}</td>
                    <td className="nt">{datumRovid(k.createdAt.slice(0, 10))}</td>
                    <td className="utolso jobb">
                      <button className={k.active ? 'gomb-v' : 'gomb-sz'} onClick={() => ki.mutate({ id: k.id, active: !k.active })}>
                        {k.active ? 'Kikapcsolom' : 'Bekapcsolom'}
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
        nyitva={uj}
        bezar={() => setUj(false)}
        ikon="kerdezek"
        cim="Új ajánlókód"
        bev="Pl. egy hirdetéshez vagy partnerhez. A regisztrációnál írják be, vagy a link ?ref= paraméterében jön."
        lab={
          <button className="gomb-e" disabled={!ajanloKodOk(f.code) || add.isPending} onClick={() => add.mutate()}>
            Létrehozom
          </button>
        }
      >
        <label className="mezo">
          <span className="felirat">Kód (6–12 nagybetű vagy szám)</span>
          <input className="doboz szam" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) })} placeholder="TAVASZ2027" />
        </label>
        <label className="mezo" style={{ marginTop: 14 }}>
          <span className="felirat">Kampány</span>
          <input className="doboz" value={f.campaign} onChange={(e) => setF({ ...f, campaign: e.target.value })} placeholder="tavaszi hirdetés" />
        </label>
        <label className="mezo" style={{ marginTop: 14 }}>
          <span className="felirat">Megjegyzés</span>
          <input className="doboz" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
      </Fiok>
    </>
  );
}
