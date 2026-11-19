// FUNKCIOK 20: client list with filters (bekötés alatt / rendben / hiányzik valami / határ közelében / díj elmaradt).
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import { useAuth, useKonyveloNev } from '../../auth/Auth';
import { Fejlec, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { ElofizetesAllapot, Hatarido, Jelzok } from '../../ui/domain';
import { FILTER_ORDER, FLAG_LABEL, MILESTONE_KOVETKEZO } from '../../lib/labels';
import { MILESTONE_ORDER, type ClientFilter } from '../../_shared/enums';
import { today } from '../../lib/today';
import { idopont } from '../../lib/format';

// „következik: Azonosítás” – főnévvel, hogy ne tűnjön késznek a lépés.
const MILESTONE_NOUN = MILESTONE_KOVETKEZO;

function koszones(): string {
  const h = Number(new Intl.DateTimeFormat('hu-HU', { hour: 'numeric', hour12: false, timeZone: 'Europe/Budapest' }).format(new Date()));
  if (h < 9) return 'Jó reggelt';
  if (h < 18) return 'Szia';
  return 'Jó estét';
}

export default function UgyfelLista() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const nev = useKonyveloNev();
  const { konyvelo } = useAuth();
  const filter = (sp.get('szuro') as ClientFilter) || 'mind';
  const [kereses, setKereses] = useState(sp.get('q') ?? '');
  const q = useQuery({ queryKey: ['acc', 'clients', filter, kereses.trim()], queryFn: () => ep.accClients(filter, kereses.trim()), placeholderData: (p) => p });
  const t = today();
  const counts = q.data?.counts;
  const teendo = (counts?.hianyzik_valami ?? 0) + (counts?.bekotes_alatt ?? 0);

  const rows = useMemo(() => q.data?.items ?? [], [q.data]);
  return (
    <>
      <Fejlec
        felcim={`${koszones()}, ${konyvelo?.firstName ?? nev}!`}
        cim="Ügyfeleid"
        mellek={
          counts ? (
            <>
              <b>{counts.mind}</b> ügyfél · <b>{counts.hianyzik_valami}</b> ügyfélnél hiányzik valami · <b>{counts.bekotes_alatt}</b> bekötés alatt
              {counts.hatar_kozel ? (
                <>
                  {' '}
                  · <b>{counts.hatar_kozel}</b> a határ közelében
                </>
              ) : null}
            </>
          ) : (
            ' '
          )
        }
        jobb={
          teendo > 0 ? (
            <Link className="gomb-sav szoveg" to="/hatarido-figyelo">
              Heti határidők
            </Link>
          ) : undefined
        }
      />
      <div className="tartalom">
        <div className="sor-flex ter" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="szegmens" role="tablist" aria-label="Szűrés">
            {FILTER_ORDER.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? 'on' : ''}
                onClick={() => {
                  const n = new URLSearchParams(sp);
                  if (f === 'mind') n.delete('szuro');
                  else n.set('szuro', f);
                  setSp(n, { replace: true });
                }}
              >
                {FLAG_LABEL[f]}
                {counts && <span className="db">{counts[f] ?? 0}</span>}
              </button>
            ))}
          </div>
          <label className="kereso">
            <span className="rejtett">Keresés</span>
            <input placeholder="Keresés névre, adószámra…" value={kereses} onChange={(e) => setKereses(e.target.value)} />
          </label>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : rows.length === 0 ? (
            <Ures n="ures_mappa" cim={kereses ? 'Nincs ilyen nevű ügyfél' : filter === 'mind' ? 'Még nincs ügyfeled' : `Nincs „${FLAG_LABEL[filter]}” ügyfél`}>
              {filter === 'mind' && !kereses ? 'Ha a tulajdonos hozzád rendel egy ügyfelet, itt jelenik meg.' : 'Ez jó hír. Válts másik szűrőre, ha mindenkit látni akarsz.'}
            </Ures>
          ) : (
            <table className="tabla ugyfel-tabla">
              <thead>
                <tr>
                  <th className="elso" style={{ minWidth: 190 }}>Ügyfél</th>
                  <th>Állapot</th>
                  <th>Következő határidő</th>
                  <th className="kozep">Kérés tőle / tőled</th>
                  <th className="kozep">Új irat</th>
                  <th>ÁFA-keret</th>
                  <th className="utolso">Előfizetés</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="kattinthato" onClick={() => nav(`/ugyfelek/${r.id}`)}>
                    <td className="elso">
                      <Link className="nev" to={`/ugyfelek/${r.id}`} onClick={(e) => e.stopPropagation()}>
                        {r.name}
                      </Link>
                      <div className="al">
                        {r.lifecycle === 'bekotes_alatt' && r.onboardingJourney
                          ? `Bekötés: ${r.onboardingJourney.done}/${r.onboardingJourney.total} kész, ${r.onboardingJourney.next ? `következik: ${r.onboardingJourney.next}${r.onboardingJourney.nextActor === 'Te' ? ' (az ügyfél)' : ''}` : r.onboardingJourney.waiting ? `most: ${r.onboardingJourney.waiting}` : 'nincs teendője'}`
                          : r.lifecycle === 'bekotes_alatt' && r.onboardingMilestone
                          ? r.onboardingMilestone === 'vallalkozas_elinditva'
                            ? 'Bekötés: most indítja a vállalkozását (új vállalkozás)'
                            : `Bekötés: ${Math.max(0, MILESTONE_ORDER.van.indexOf(r.onboardingMilestone))}/${MILESTONE_ORDER.van.length} kész, következik: ${MILESTONE_NOUN[r.onboardingMilestone]}`
                          : r.lastUploadAt
                            ? `Utolsó feltöltés: ${idopont(r.lastUploadAt, t)}`
                            : 'Még nem töltött fel semmit'}
                      </div>
                    </td>
                    <td>
                      <Jelzok flags={r.flags} />
                    </td>
                    <td>{r.nextDeadline ? <Hatarido due={r.nextDeadline.dueDate} today={t} cim={r.nextDeadline.title} /> : <span className="halvany">–</span>}</td>
                    <td className="kozep szam">
                      <b style={{ fontWeight: r.openRequestsFromClient ? 750 : 400 }}>{r.openRequestsFromClient}</b>
                      <span className="halvany"> / {r.openRequestsToClient}</span>
                    </td>
                    <td className="kozep szam" style={{ fontWeight: r.waitingDocuments ? 750 : 400 }}>
                      {r.waitingDocuments || <span className="halvany">0</span>}
                    </td>
                    <td className="nt">
                      <span className="mini-sav" aria-hidden="true">
                        <i className={r.afaRatio >= 0.8 ? 'figyel' : ''} style={{ width: `${Math.min(100, r.afaRatio * 100)}%` }} />
                      </span>{' '}
                      <span className="szam" style={{ fontWeight: r.afaRatio >= 0.8 ? 700 : 400 }}>
                        {Math.round(r.afaRatio * 100)}%
                      </span>
                    </td>
                    <td className="utolso">
                      <ElofizetesAllapot s={r.subscriptionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
          Az ÁFA-keret az alanyi adómentesség 20 000 000 Ft-os 2026-os határa, teljesítési dátum szerint. 80% fölött figyelmeztetünk.
        </p>
      </div>
    </>
  );
}
