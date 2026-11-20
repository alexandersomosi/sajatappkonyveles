// SPEC §28.5.5 – the change kinds on /helyettunk/:id: the new data with a copy button per NAV field, the prepaid fee
// (§28.K.1), the handbook (CHANGE_HANDBOOK), and the follow-up checklist after the NAV accepted the change.
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { ChangeData, NavAddress, TeamAssistDetailP } from '../../api/types';
import { Masol } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { CHANGE_FORM_TEXTS, CHANGE_HANDBOOK, FEE_KIND_LABELS } from '../../_shared/bekotes';
import { SEAT_RIGHT_LABELS, WORK_KIND_LABELS, CHANGE_UGYSEGED_KINDS, type AssistKind } from '../../_shared/enums';
import { datum, ft, idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { kezikonyvSzoveg, valtozasMezok } from '../../lib/k28';

/** "Az új adatok" – exactly as they go into the NAV form, one copy button per field. */
export function ValtozasAdatok({ d }: { d: TeamAssistDetailP }) {
  const c = d.change ?? null;
  return (
    <div className="lap">
      <div className="lap-fej">
        <I3 n="irat" s={28} />
        <h2>Az új adatok</h2>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {!c ? (
          <p className="halvany">Az ügyfél még nem adta meg az új adatokat (hívás után az appban teszi meg).</p>
        ) : (
          <>
            <p className="halvany kicsi" style={{ marginBottom: 10 }}>Mezőnként így írd be a NAV-os űrlapba. Ha valami nem stimmel, ne küldd be: kérd meg, hogy javítsa az appban.</p>
            <dl className="adatok keskeny-adatok bekuldes-adatok">
              {valtozasMezok(c).map((m) => (
                <div key={m.cim} style={{ display: 'contents' }}>
                  <dt>{m.cim}</dt>
                  <dd>
                    <span className={m.szam ? 'szam' : undefined}>{m.ertek}</span> {m.masol && <Masol ertek={m.ertek} />}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

/** The prepaid fee of an assisted change (SPEC §28.K.1). */
export function ValtozasDij({ d }: { d: TeamAssistDetailP }) {
  const f = d.feeCharge;
  if (!f) return null;
  const fizetve = f.status === 'fizetve';
  return (
    <div className={`uzenet-sav ${fizetve ? 'info' : 'figyel'}`}>
      <I3 n={fizetve ? 'befizetve_jel' : 'szamlaszam'} s={28} />
      <div style={{ flex: 1 }}>
        <b>
          {FEE_KIND_LABELS[f.kind]}: {ft(f.amountHuf)}
        </b>{' '}
        <div className="kicsi">
          {fizetve
            ? `Kifizette${f.paidAt ? `: ${idopont(f.paidAt, today())}` : ''}. Nekiláthatunk.`
            : 'Még nem fizette ki. Előre fizetendő: amíg nincs kifizetve, nem kezdünk bele. Az ügyfél az appban fizet.'}
        </div>
      </div>
    </div>
  );
}

/** CHANGE_HANDBOOK: which way the accountant files it (Ügysegéd or ONYA / T101E). */
export function ValtozasKezikonyv({ kind }: { kind: AssistKind }) {
  return (
    <div className="kezikonyv-test">
      <h3 className="kis-cim">{(CHANGE_UGYSEGED_KINDS as readonly string[]).includes(kind) ? 'Vállalkozói Ügysegéd – meghatalmazottként' : 'ONYA – T101E, meghatalmazottként'}</h3>
      <ol>
        {kezikonyvSzoveg(kind)
          .split(' → ')
          .map((l, i) => (
            <li key={i}>{l}</li>
          ))}
      </ol>
      <p className="halvany kicsi">{CHANGE_HANDBOOK.neverCredentials}</p>
    </div>
  );
}

/**
 * After change-done (SPEC §28.5.5): the follow-ups as a checklist. The server never changes the tax profile by
 * itself – each line links to the editor, and the accountant ticks it when done.
 */
export function ValtozasUtomunka({ d, szerep, frissit }: { d: TeamAssistDetailP; szerep: string; frissit: (d: TeamAssistDetailP) => void }) {
  const pir = usePirito();
  const fu = d.followups ?? [];
  const pipa = useMutation({
    mutationFn: (v: { key: string; done: boolean }) => ep.teamAssistFollowup(d.id, v),
    onSuccess: frissit,
    onError: pir.hiba,
  });
  if (!fu.length) return null;
  const c: ChangeData | null = d.change ?? null;
  const link = (key: string): string | null => {
    const base = `/ugyfelek/${d.client.id}/attekintes`;
    if (key === 'szunetel_szakasz' && c && c.kind === 'valtozas_szuneteltetes') return `${base}?szunetel=${c.from}${c.to ? `&ig=${c.to}` : ''}#adoprofil`;
    if (['adoprofil_statusz', 'adozasi_mod', 'koltseghanyad_megerosites', 'hipa_atnezes', 'hipa_masik_telepules', 'szunetel_lezaras'].includes(key)) return `${base}#adoprofil`;
    if (key === 'hq_municipality' || key === 'tevekenyseg_frissites') return `${base}#adoprofil`;
    return null;
  };
  const pipalhat = szerep !== 'csapat';
  return (
    <div className="lap">
      <div className="lap-fej" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <I3 n="befizetve_jel" s={28} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2>Utómunka nálunk</h2>
          <div className="halvany kicsi">A NAV elfogadta. Ezeket a könyvelő vezeti át – magától semmi nem változik.</div>
        </div>
      </div>
      <div className="belso oszlop" style={{ paddingTop: 0, gap: 8 }}>
        {fu.map((f) => {
          const l = link(f.key);
          return (
            <div key={f.key} className="sor-flex" style={{ alignItems: 'flex-start' }}>
              <label className="jelolo" style={{ flex: 1 }}>
                <input type="checkbox" checked={f.done} disabled={!pipalhat || pipa.isPending} onChange={(e) => pipa.mutate({ key: f.key, done: e.target.checked })} />
                <span>
                  {f.label}
                  {f.done && f.by && (
                    <span className="halvany kicsi">
                      {' '}
                      · {f.by.firstName}
                      {f.doneAt ? `, ${idopont(f.doneAt, today())}` : ''}
                    </span>
                  )}
                </span>
              </label>
              {l && pipalhat && !f.done && (
                <Link className="gomb-m kicsi csak-szoveg" to={l}>
                  Megnyitom
                </Link>
              )}
            </div>
          );
        })}
        {!pipalhat && <p className="sugo" style={{ margin: 0 }}>Ezeket {d.accountant?.name ?? 'a könyvelő'} pipálja.</p>}
      </div>
    </div>
  );
}

/** One-line summary for the "Most" band and the timeline: "1117 Budapest, Próba utca 3., december 1-től". */
export function valtozasRovid(c: ChangeData | null | undefined): string | null {
  if (!c) return null;
  if (c.kind === 'valtozas_szekhely' || c.kind === 'valtozas_telephely') return `${cimSor(c.address)}, ${datum(c.effectiveOn)}-től`;
  if (c.kind === 'valtozas_szuneteltetes') return `${datum(c.from)}-től${c.to ? ` ${datum(c.to)}-ig` : ''}`;
  if (c.kind === 'valtozas_folytatas') return `${datum(c.from)}-től újra dolgozik`;
  if (c.kind === 'valtozas_tevekenyseg') return `${c.activities.map((a) => a.ovtjKod ?? a.label).join(', ')}, ${datum(c.effectiveOn)}-től`;
  return `${c.items.map((i) => CHANGE_FORM_TEXTS.adoadatItems[i]).join(', ')}${c.workKind ? ` (${WORK_KIND_LABELS[c.workKind].toLowerCase()})` : ''}, ${datum(c.effectiveOn)}-től`;
}
export function cimSor(a: NavAddress): string {
  const tobbi = [a.building && `${a.building}. ép.`, a.staircase && `${a.staircase}. lph.`, a.floor && `${a.floor}. em.`, a.door && `${a.door}. ajtó`].filter(Boolean).join(' ');
  return `${a.zip} ${a.city}${a.district ? ` ${a.district} ker.` : ''}, ${a.streetName} ${a.streetType} ${a.houseNumber}.${tobbi ? ` ${tobbi}` : ''}`;
}
export { SEAT_RIGHT_LABELS };
