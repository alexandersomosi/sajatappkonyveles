// SPEC §28.K.1 – /admin/dijak: the fee settings (monthly fee, KATA plan, annual closing, assisted changes, suspension
// fee). Fees are settings, not code: every change is kept in the history; an unconfirmed amount carries the amber DEMO
// mark everywhere and cannot be charged in production. Below: the one-off charges to waive or mark refunded.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { AdminFeeChargeRow, FeeSettingView } from '../../api/types';
import { DemoCimke, Fejlec, Fiok, Ft, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { ApiError } from '../../api/client';
import { FEE_TEXTS } from '../../_shared/bekotes';
import { FEE_RULES } from '../../_shared/enums';
import { datum, idopont } from '../../lib/format';
import { dijHibak, dijSzoveg, napPlusz } from '../../lib/k28';
import { today } from '../../lib/today';

const MIKOR: Record<string, string> = {
  havidij: 'havonta, kártyáról (ismétlődő fizetés)',
  havidij_kata: 'havonta, kártyáról (kata-csomag)',
  eves_zaras: 'amikor elküldi az éves kérdőívet – előre',
  valtozas_egyszeru: 'mielőtt a csapat bejelenti helyette – előre',
  valtozas_jogallas: 'mielőtt a csapat bejelenti helyette – előre',
  szuneteltetesi_dij: 'havonta a havidíj helyett, amíg szünetel',
};

export default function Dijak() {
  const t = today();
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['admin', 'fees'], queryFn: ep.adminFees });
  const [modosit, setModosit] = useState<FeeSettingView | null>(null);
  const [tortenet, setTortenet] = useState<FeeSettingView | null>(null);
  const megerosit = useMutation({
    mutationFn: (kind: string) => ep.adminConfirmFee(kind),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
      pir.ok('Megerősítetted. A DEMO jelzés eltűnt, élesben is terhelhető.');
    },
    onError: pir.hiba,
  });
  const demoDb = (q.data ?? []).filter((f) => !f.confirmed).length;
  return (
    <>
      <Fejlec
        cim="Díjak"
        mellek={
          <>
            Minden benne van a havidíjban; külön díjas csak az éves zárás, a helyettünk bejelentett változás és a szüneteltetés alatti kisebb díj.{' '}
            {demoDb > 0 && (
              <>
                <b>{demoDb}</b> díj még DEMO: élesben addig nem terhelhető, amíg meg nem erősíted.
              </>
            )}
          </>
        }
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso" style={{ minWidth: 230 }}>Díj</th>
                  <th className="jobb">Összeg</th>
                  <th style={{ minWidth: 240 }}>Mikor terheljük</th>
                  <th>Állapot</th>
                  <th className="utolso" />
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((f) => (
                  <tr key={f.kind}>
                    <td className="elso">
                      <span className="nev">{f.label}</span>
                      {f.effectiveFrom && <div className="al">Új összeg {datum(f.effectiveFrom, { ev: true })}-től a futó előfizetésekre</div>}
                      {!!f.cardLimitAffected && <div className="al" style={{ color: 'var(--veszely)' }}>{f.cardLimitAffected} futó előfizetésnél új kártyaregisztráció kellene</div>}
                    </td>
                    <td className="jobb nt">
                      <span className="szam felkover">{dijSzoveg(f.amountHuf, f.unit)}</span>
                    </td>
                    <td className="kicsi">{MIKOR[f.kind] ?? ''}</td>
                    <td>
                      {f.confirmed ? (
                        <span className="allapot">
                          <I3 n="befizetve_jel" s={18} />
                          <span>
                            <span className="szo">Megerősítve</span> · {f.confirmedAt ? datum(f.confirmedAt.slice(0, 10)) : ''} · {f.confirmedBy?.firstName ?? ''}
                          </span>
                        </span>
                      ) : (
                        <DemoCimke>{FEE_TEXTS.demoChip}</DemoCimke>
                      )}
                    </td>
                    {/* integrator k6: the three actions may wrap (at 1440 px the nowrap cell pushed „Előzmények” out of the card) */}
                    <td className="utolso jobb" style={{ minWidth: 220 }}>
                      <button className="gomb-m kicsi csak-szoveg" onClick={() => setModosit(f)}>
                        Módosítom
                      </button>{' '}
                      {!f.confirmed && (
                        <button className="gomb-e kicsi" disabled={megerosit.isPending} onClick={() => megerosit.mutate(f.kind)}>
                          Megerősítem
                        </button>
                      )}{' '}
                      <button className="gomb-sz" onClick={() => setTortenet(f)}>
                        Előzmények
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
          {FEE_TEXTS.selfFree} A havidíj emelése a futó előfizetésekre legalább {FEE_RULES.priceRiseNoticeDays} nap múlva érvényes (ÁSZF szerinti értesítés); csökkentés a következő terheléstől.
        </p>
        <Terhelesek />
      </div>
      <ModositFiok f={modosit} bezar={() => setModosit(null)} ma={t} />
      <Fiok nyitva={!!tortenet} bezar={() => setTortenet(null)} cim={`Előzmények: ${tortenet?.label ?? ''}`} ikon="nyugta">
        {tortenet && (
          <table className="tabla tomor">
            <tbody>
              {tortenet.history.map((h, i) => (
                <tr key={i}>
                  <td className="elso nt">{idopont(h.changedAt, t)}</td>
                  <td className="jobb szam">{dijSzoveg(h.amountHuf, tortenet.unit)}</td>
                  <td>{h.confirmed ? 'megerősítve' : 'DEMO'}</td>
                  <td className="utolso halvany kicsi">
                    {h.changedBy?.firstName ?? ''}
                    {h.note ? ` – ${h.note}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Fiok>
    </>
  );
}

function ModositFiok({ f, bezar, ma }: { f: FeeSettingView | null; bezar: () => void; ma: string }) {
  const pir = usePirito();
  const qc = useQueryClient();
  const [osszeg, setOsszeg] = useState('');
  const [hatalyos, setHatalyos] = useState('');
  const [megj, setMegj] = useState('');
  const [hibak, setHibak] = useState<{ amountHuf?: string; effectiveFrom?: string }>({});
  const [elozo, setElozo] = useState<string | null>(null);
  if (f && elozo !== f.kind) {
    setElozo(f.kind);
    setOsszeg(String(f.amountHuf));
    setHatalyos('');
    setMegj('');
    setHibak({});
  }
  const m = useMutation({
    mutationFn: () => ep.adminPutFee({ kind: f!.kind, amountHuf: Number(osszeg.replace(/\s/g, '')), effectiveFrom: hatalyos || undefined, note: megj.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
      pir.ok('Elmentve. Az új összeg DEMO, amíg meg nem erősíted.');
      bezar();
    },
    onError: (e) => (e instanceof ApiError && e.fields ? setHibak(e.fields) : pir.hiba(e)),
  });
  const havi = f?.kind === 'havidij' || f?.kind === 'havidij_kata';
  const emeles = !!f && Number(osszeg.replace(/\s/g, '')) > f.amountHuf;
  return (
    <Fiok
      nyitva={!!f}
      bezar={() => {
        setElozo(null);
        bezar();
      }}
      cim={`Módosítom: ${f?.label ?? ''}`}
      bev="A módosított összeg DEMO lesz, amíg meg nem erősíted. Az előzményekben minden változás megmarad."
      ikon="szamolo"
      lab={
        <div className="gombsor">
          <button
            className="gomb-e"
            disabled={m.isPending}
            onClick={() => {
              const h = f ? dijHibak(f, osszeg, hatalyos, ma) : {};
              setHibak(h);
              if (!Object.keys(h).length) m.mutate();
            }}
          >
            Elmentem
          </button>
          <button className="gomb-sz" onClick={bezar}>
            Mégsem
          </button>
        </div>
      }
    >
      <label className="mezo">
        <span className="felirat">Összeg (Ft, bruttó)</span>
        <input className={`doboz szam${hibak.amountHuf ? ' hibas' : ''}`} inputMode="numeric" value={osszeg} onChange={(e) => setOsszeg(e.target.value)} />
        {hibak.amountHuf ? <span className="hiba-szoveg">{hibak.amountHuf}</span> : <span className="sugo">Egész forint. 0 Ft = ingyenes (például a változás díja).</span>}
      </label>
      {havi && (
        <label className="mezo">
          <span className="felirat">Futó előfizetésekre ettől a naptól{emeles ? ' (kötelező)' : ''}</span>
          <input className={`doboz${hibak.effectiveFrom ? ' hibas' : ''}`} type="date" min={emeles ? napPlusz(ma, FEE_RULES.priceRiseNoticeDays) : undefined} value={hatalyos} onChange={(e) => setHatalyos(e.target.value)} />
          {hibak.effectiveFrom ? (
            <span className="hiba-szoveg">{hibak.effectiveFrom}</span>
          ) : (
            <span className="sugo">Az új előfizetőkre azonnal érvényes. Emelésnél legalább {FEE_RULES.priceRiseNoticeDays} nap múlva, és a kártyaregisztráció felső határa sem léphető túl.</span>
          )}
        </label>
      )}
      <label className="mezo">
        <span className="felirat">Megjegyzés (nem kötelező)</span>
        <input className="doboz" value={megj} onChange={(e) => setMegj(e.target.value)} placeholder="Például: a tulaj döntése, 11-20" />
      </label>
    </Fiok>
  );
}

function Terhelesek() {
  const pir = usePirito();
  const qc = useQueryClient();
  const [szuro, setSzuro] = useState<'visszaterites_kell' | 'nyitott' | ''>('');
  const [elenged, setElenged] = useState<AdminFeeChargeRow | null>(null);
  const [ok, setOk] = useState('');
  const q = useQuery({ queryKey: ['admin', 'fee-charges'], queryFn: () => ep.adminFeeCharges() });
  const vissza = useMutation({
    mutationFn: (id: string) => ep.adminChargeRefunded(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'fee-charges'] });
      pir.ok('Visszatérítettnek jelölted.');
    },
    onError: pir.hiba,
  });
  const el = useMutation({
    mutationFn: () => ep.adminWaiveCharge(elenged!.id, ok.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'fee-charges'] });
      pir.ok('Elengedted a díjat.');
      setElenged(null);
      setOk('');
    },
    onError: pir.hiba,
  });
  const sorok = (q.data?.items ?? []).filter((x) => !szuro || x.status === szuro);
  return (
    <>
      <div className="szakasz">
        Egyszeri díjak <span className="megj">Visszatérítés a SimplePay kereskedői felületén – itt csak megjelölöd.</span>
      </div>
      <div className="szegmens" role="tablist" aria-label="Szűrés" style={{ marginBottom: 12 }}>
        {(
          [
            ['', 'Mind'],
            ['visszaterites_kell', 'Visszatérítésre vár'],
            ['nyitott', 'Fizetésre vár'],
          ] as const
        ).map(([k, f]) => (
          <button key={k} role="tab" aria-selected={szuro === k} className={szuro === k ? 'on' : ''} onClick={() => setSzuro(k)}>
            {f}
            <span className="db">{(q.data?.items ?? []).filter((x) => !k || x.status === k).length}</span>
          </button>
        ))}
      </div>
      <div className="lap">
        {q.isPending ? (
          <Toltes />
        ) : q.isError ? (
          <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        ) : sorok.length === 0 ? (
          <Ures n="ures_mappa" cim="Nincs ilyen díj" />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso" style={{ minWidth: 170 }}>Ügyfél</th>
                <th>Mire</th>
                <th className="jobb">Összeg</th>
                <th>Állapot</th>
                <th>Létrejött</th>
                <th className="utolso" />
              </tr>
            </thead>
            <tbody>
              {sorok.map((x) => (
                <tr key={x.id}>
                  <td className="elso">{x.client.name}</td>
                  <td>{x.label}</td>
                  <td className="jobb nt">
                    <Ft n={x.amountHuf} /> {x.demo && <DemoCimke />}
                  </td>
                  <td>
                    <span className={`cimke ${x.status === 'visszaterites_kell' ? 'hiba' : x.status === 'nyitott' ? 'figyel' : ''}`}>{x.statusText}</span>
                  </td>
                  <td className="nt">{idopont(x.createdAt, today())}</td>
                  <td className="utolso jobb nt">
                    {x.status === 'visszaterites_kell' && (
                      <button className="gomb-m kicsi csak-szoveg" disabled={vissza.isPending} onClick={() => vissza.mutate(x.id)}>
                        Visszatérítettem
                      </button>
                    )}{' '}
                    {(x.status === 'nyitott' || x.status === 'visszaterites_kell') && (
                      <button className="gomb-sz" onClick={() => setElenged(x)}>
                        Elengedem
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Fiok
        nyitva={!!elenged}
        bezar={() => setElenged(null)}
        cim={`Elengedem: ${elenged?.label ?? ''}`}
        bev={elenged ? `${elenged.client.name} · ${elenged.amountHuf.toLocaleString('hu-HU')} Ft` : undefined}
        ikon="szamolo"
        lab={
          <div className="gombsor">
            <button className="gomb-e" disabled={!ok.trim() || el.isPending} onClick={() => el.mutate()}>
              Elengedem
            </button>
            <button className="gomb-sz" onClick={() => setElenged(null)}>
              Mégsem
            </button>
          </div>
        }
      >
        <label className="mezo">
          <span className="felirat">Miért? (kötelező, a naplóba kerül)</span>
          <textarea className="doboz" rows={3} value={ok} onChange={(e) => setOk(e.target.value)} />
        </label>
      </Fiok>
    </>
  );
}
