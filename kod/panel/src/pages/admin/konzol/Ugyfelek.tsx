// SPEC §29.9.3 – /admin/konzol/ugyfelek: every client, searchable by name, e-mail, adószám, phone (last digits), with
// filters (status, regime, accountant, unpaid, locked, cancelled, terminated). A row opens the client card.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as k from '../../../api/k29f';
import { Fejlec, HibaSav, Toltes, Ures } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { datum, szam } from '../../../lib/format';

const ALLAPOT: Record<string, string> = { bekotes_alatt: 'Bekötés alatt', aktiv: 'Aktív', felfuggesztve: 'Felfüggesztve', megszunt: 'Megszűnt' };
const ELOFIZ: Record<string, string> = { incomplete: 'Nincs fizetve', active: 'Él', past_due: 'Elmaradt', suspended: 'Felfüggesztve', canceled: 'Lezárva' };
const SZUROK: { k: string; f: string }[] = [
  { k: '', f: 'Mind' },
  { k: 'status=aktiv', f: 'Aktív' },
  { k: 'status=bekotes_alatt', f: 'Bekötés alatt' },
  { k: 'unpaid=1', f: 'Tartozik' },
  { k: 'locked=1', f: 'Zárolt' },
  { k: 'cancelled=1', f: 'Lemondott' },
  { k: 'terminated=1', f: 'Felmondott' },
  { k: 'regime=kata', f: 'Kata' },
];

export default function KonzolUgyfelek() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [kereso, setKereso] = useState(sp.get('q') ?? '');
  const p = {
    q: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    regime: sp.get('regime') ?? undefined,
    accountant: sp.get('accountant') ?? undefined,
    unpaid: sp.get('unpaid') === '1',
    locked: sp.get('locked') === '1',
    cancelled: sp.get('cancelled') === '1',
    terminated: sp.get('terminated') === '1',
    cursor: sp.get('cursor') ?? undefined,
  };
  const q = useQuery({ queryKey: ['admin', 'console', 'clients', sp.toString()], queryFn: () => k.consoleClients(p) });
  const aktivSzuro = SZUROK.find((s) => s.k && sp.toString().includes(s.k))?.k ?? '';
  const szur = (s: string) => {
    const n = new URLSearchParams(s);
    if (sp.get('q')) n.set('q', sp.get('q')!);
    setSp(n, { replace: true });
  };
  return (
    <>
      <Fejlec
        felcim={
          <Link to="/admin/konzol" style={{ color: 'inherit' }}>
            Konzol
          </Link>
        }
        cim="Ügyfelek"
        mellek={q.data ? <><b>{q.data.total}</b> találat</> : ' '}
      />
      <div className="tartalom">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <form
            className="kereso"
            onSubmit={(e) => {
              e.preventDefault();
              const n = new URLSearchParams(sp);
              if (kereso.trim()) n.set('q', kereso.trim());
              else n.delete('q');
              n.delete('cursor');
              setSp(n, { replace: true });
            }}
          >
            <I3 n="kerdezek" s={20} />
            <input value={kereso} onChange={(e) => setKereso(e.target.value)} placeholder="Név, e-mail, adószám vagy telefon vége" aria-label="Keresés" />
            {/* k7c2: a visible button too (Enter still works) */}
            <button type="submit" className="gomb-m">
              Keresés
            </button>
          </form>
          <div className="szegmens">
            {SZUROK.map((s) => (
              <button key={s.f} className={aktivSzuro === s.k ? 'on' : ''} onClick={() => szur(s.k)}>
                {s.f}
              </button>
            ))}
          </div>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : !q.data?.items.length ? (
            <Ures n="ures_mappa" cim="Nincs találat" />
          ) : (
            <div className="tabla-gorgo">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="elso">Ügyfél</th>
                    <th>Adózás</th>
                    <th>Könyvelő</th>
                    <th>Állapot</th>
                    <th>Előfizetés</th>
                    <th>Következő levonás</th>
                    <th className="jobb">Tartozás</th>
                    <th className="utolso">Regisztrált</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.items.map((r) => (
                    <tr key={r.id} className="kattinthato" onClick={() => nav(`/admin/konzol/ugyfelek/${r.id}`)}>
                      <td className="elso">
                        <span className="nev">{r.name}</span>
                        <div className="al">{r.email}</div>
                      </td>
                      <td>{r.regime === 'kata' ? <span className="cimke info">Kata</span> : r.regime === 'atalany' ? <span className="cimke">Átalány</span> : <span className="halvany">–</span>}</td>
                      <td>{r.accountantName ?? <span className="halvany">nincs</span>}</td>
                      <td>
                        {ALLAPOT[r.lifecycle] ?? r.lifecycle}
                        <div className="cimkek" style={{ marginTop: 3 }}>
                          {r.locked ? <span className="cimke hiba">Zárolt</span> : null}
                          {r.terminated ? <span className="cimke figyel">Felmondva</span> : null}
                          {r.anonymized ? <span className="cimke">Anonimizált</span> : null}
                          {r.isTest ? <span className="cimke demo">Teszt</span> : null}
                        </div>
                      </td>
                      <td>{r.subscriptionStatus ? ELOFIZ[r.subscriptionStatus] ?? r.subscriptionStatus : <span className="halvany">–</span>}</td>
                      <td className="nt">{r.nextChargeOn ? datum(r.nextChargeOn, { ev: true }) : <span className="halvany">–</span>}</td>
                      <td className="jobb nt">{r.unpaidHuf ? <b style={{ color: 'var(--veszely)' }}>{szam(r.unpaidHuf)} Ft</b> : <span className="halvany">0</span>}</td>
                      <td className="utolso nt">{datum(r.createdAt.slice(0, 10), { ev: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {q.data?.nextCursor ? (
          <button
            type="button"
            className="gomb-m csak-szoveg"
            style={{ marginTop: 12 }}
            onClick={() => {
              const n = new URLSearchParams(sp);
              n.set('cursor', q.data!.nextCursor!);
              setSp(n);
            }}
          >
            Következő 50
          </button>
        ) : null}
      </div>
    </>
  );
}
