// FUNKCIOK 29, 30: clients (business fields only) and accountant reassignment. SPEC §27.6.4 (round-2 security finding 9):
// "Fiók letiltása" / "Engedélyezése" – reason required, confirm dialog; the server revokes every session and audits it.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { AdminClientRow } from '../../api/types';
import { Fejlec, Fiok, HibaSav, Toltes, Ures, Lenyilo } from '../../ui/kozos';
import { ElofizetesAllapot } from '../../ui/domain';
import { usePirito } from '../../ui/Pirito';
import { LIFECYCLE_LABEL } from '../../lib/labels';
import { datumRovid } from '../../lib/format';
import { CLIENT_LIFECYCLES } from '../../_shared/enums';

export default function Ugyfelek() {
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') ?? '';
  const [kereses, setKereses] = useState('');
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useInfiniteQuery({
    queryKey: ['admin', 'clients', status, kereses.trim()],
    queryFn: ({ pageParam }) => ep.adminClients({ status: status || undefined, q: kereses.trim() || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
    placeholderData: (p) => p,
  });
  const konyvelok = useQuery({ queryKey: ['admin', 'accountants'], queryFn: ep.adminAccountants });
  const [atad, setAtad] = useState<{ c: AdminClientRow; to: string } | null>(null);
  const ment = useMutation({
    mutationFn: () => ep.adminPatchClient(atad!.c.id, { accountantId: atad!.to }),
    onSuccess: () => {
      pir.ok('Átadva. Az ügyfél és mindkét könyvelő értesítést kap.');
      setAtad(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'clients'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'accountants'] });
    },
    onError: pir.hiba,
  });
  const [tiltas, setTiltas] = useState<{ c: AdminClientRow; mit: 'tilt' | 'enged' } | null>(null);
  const [ok, setOk] = useState('');
  const tilt = useMutation({
    mutationFn: () => (tiltas!.mit === 'tilt' ? ep.adminDisableClient(tiltas!.c.id, ok.trim()) : ep.adminEnableClient(tiltas!.c.id, ok.trim())),
    onSuccess: () => {
      pir.ok(tiltas!.mit === 'tilt' ? 'Letiltottad. Minden eszközről kiléptettük, és nem tud belépni.' : 'Újra engedélyezted. Mostantól be tud lépni.');
      setTiltas(null);
      setOk('');
      void qc.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
    onError: pir.hiba,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const celNev = konyvelok.data?.items.find((k) => k.id === atad?.to)?.displayName;
  return (
    <>
      <Fejlec felcim="Tulajdonos" cim="Ügyfelek" mellek="Név, állapot, könyvelő, előfizetés és forrás. Iratokat és üzeneteket innen nem látsz." />
      <div className="tartalom">
        <div className="sor-flex ter" style={{ marginBottom: 16 }}>
          <div className="szegmens">
            <button className={!status ? 'on' : ''} onClick={() => setSp({}, { replace: true })}>
              Mind
            </button>
            {CLIENT_LIFECYCLES.map((l) => (
              <button key={l} className={status === l ? 'on' : ''} onClick={() => setSp({ status: l }, { replace: true })}>
                {LIFECYCLE_LABEL[l]}
              </button>
            ))}
          </div>
          <label className="kereso">
            <span className="rejtett">Keresés</span>
            <input placeholder="Név vagy e-mail…" value={kereses} onChange={(e) => setKereses(e.target.value)} />
          </label>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim="Nincs ilyen ügyfél" />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">Ügyfél</th>
                  <th>Állapot</th>
                  <th>Könyvelő</th>
                  <th>Előfizetés</th>
                  <th>Honnan jött</th>
                  <th>Regisztrált</th>
                  <th className="utolso">Belépés</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="elso">
                      <div className="felkover">{r.name}</div>
                      <div className="al">{r.email}</div>
                    </td>
                    <td>{LIFECYCLE_LABEL[r.lifecycle]}</td>
                    <td>
                      <Lenyilo
                        className="doboz"
                        style={{ height: 36, fontSize: 14, width: 190 }}
                        value={r.accountant?.id ?? ''}
                        onChange={(e) => e.target.value && setAtad({ c: r, to: e.target.value })}
                        aria-label={`${r.name} könyvelője`}
                      >
                        {!r.accountant && <option value="">– nincs –</option>}
                        {konyvelok.data?.items.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.displayName}
                          </option>
                        ))}
                      </Lenyilo>
                    </td>
                    <td>
                      <ElofizetesAllapot s={r.subscriptionStatus} />
                    </td>
                    <td>
                      {r.source ?? <span className="halvany">közvetlen</span>}
                      {r.referralCode && <div className="al">kód: {r.referralCode}</div>}
                    </td>
                    <td className="nt">{datumRovid(r.createdAt.slice(0, 10))}</td>
                    <td className="utolso">
                      {r.disabled ? (
                        <>
                          <span className="cimke hiba">Letiltva</span>
                          <div>
                            <button className="gomb-sz" onClick={() => setTiltas({ c: r, mit: 'enged' })}>
                              Engedélyezem
                            </button>
                          </div>
                        </>
                      ) : (
                        <button className="gomb-sz" onClick={() => setTiltas({ c: r, mit: 'tilt' })}>
                          Fiók letiltása
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {q.hasNextPage && (
            <div className="lapozo">
              <button className="gomb-m csak-szoveg" onClick={() => void q.fetchNextPage()}>
                Továbbiak
              </button>
            </div>
          )}
        </div>
      </div>
      <Fiok
        nyitva={!!atad}
        bezar={() => setAtad(null)}
        ikon="fiok"
        cim="Másik könyvelőhöz adod?"
        bev={atad ? `${atad.c.name} ezentúl ${celNev ?? 'az új könyvelő'} ügyfele lesz. A korábbi iratok, üzenetek vele mennek. Naplózzuk.` : ''}
        lab={
          <button className="gomb-e" disabled={ment.isPending} onClick={() => ment.mutate()}>
            Igen, átadom
          </button>
        }
      >
        <p className="halvany">Az új könyvelő az ügyféllistájában azonnal látja. A meghatalmazást a NAV-nál az új könyvelőre is ki kell terjeszteni.</p>
      </Fiok>
      <Fiok
        nyitva={!!tiltas}
        bezar={() => setTiltas(null)}
        ikon="lakat"
        cim={tiltas?.mit === 'tilt' ? 'Letiltod a fiókját?' : 'Újra engedélyezed a fiókját?'}
        bev={tiltas ? `${tiltas.c.name} · ${tiltas.c.email}` : undefined}
        lab={
          <>
            <button className={tiltas?.mit === 'tilt' ? 'gomb-e veszelyes' : 'gomb-e'} disabled={ok.trim().length < 3 || tilt.isPending} onClick={() => tilt.mutate()}>
              {tiltas?.mit === 'tilt' ? 'Igen, letiltom' : 'Igen, engedélyezem'}
            </button>
            <button className="gomb-sz" onClick={() => setTiltas(null)}>
              Mégse
            </button>
          </>
        }
      >
        <div className="oszlop" style={{ gap: 12 }}>
          {tiltas?.mit === 'tilt' ? (
            <p>
              Nem tud belépni, minden eszközről kiléptetjük. Az adatai megmaradnak, és a könyvelője továbbra is látja őket. Bármikor visszaengedheted.
            </p>
          ) : (
            <p>Újra be tud lépni a saját jelszavával. A korábbi munkamenetei nem jönnek vissza.</p>
          )}
          {tiltas?.c.disabledReason && <p className="halvany kicsi">Letiltás oka: „{tiltas.c.disabledReason}”</p>}
          <label className="mezo">
            <span className="felirat">Miért? (kötelező, a naplóba kerül)</span>
            <textarea className="doboz" rows={3} maxLength={500} value={ok} onChange={(e) => setOk(e.target.value)} placeholder={tiltas?.mit === 'tilt' ? 'Például: tömeges, értelmetlen feltöltések.' : 'Például: tisztáztuk vele telefonon.'} />
          </label>
        </div>
      </Fiok>
    </>
  );
}
