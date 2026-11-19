// SPEC §28.K.2 – "Havi változások": the items of the clients' monthly "Változott valami?" answers. Accountant: his own
// clients; admin: all; csapat: only items that became an assisted change (read-only). Every effect on the tax profile
// is one click by the accountant – nothing changes by itself.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamCheckinItem } from '../../api/types';
import { useAuth } from '../../auth/Auth';
import { DemoCimke, Fejlec, Fiok, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { ApiError } from '../../api/client';
import { CHECKIN_ADMIN_TEXTS, CHECKIN_PANEL_TEXTS, CHANGE_FORM_TEXTS, EMPLOYER_ANSWER_LABELS, FEE_CHARGE_STATUS_LABELS, FEE_KIND_LABELS } from '../../_shared/bekotes';
import type { CheckinItemDecisionInput } from '../../_shared/api';
import { HAVI_SZUROK, haviIlleszkedik, type HaviSzuro } from '../../lib/k28';
import { datum, ft, honapNev, idopont } from '../../lib/format';
import { today } from '../../lib/today';

type Alkalmaz = NonNullable<CheckinItemDecisionInput['apply']>[number];
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);

/** One-click effects that make sense for an item (SPEC §28.K.2 "Effects the accountant applies"). */
function hatasok(i: TeamCheckinItem): { k: Alkalmaz; felirat: string }[] {
  const d = i.details;
  const out: { k: Alkalmaz; felirat: string }[] = [];
  if (i.item === 'munkaviszony' || i.item === 'nyugdij') {
    const st = i.item === 'nyugdij' ? 'nyugdíjas' : d.weeklyHours === 'legalabb_36' ? 'mellékállású' : 'főfoglalkozású';
    out.push({ k: 'adoprofil_statusz', felirat: fill(CHECKIN_PANEL_TEXTS.applyStatus, { status: st, date: d.since ? datum(d.since) : 'a megadott naptól' }) });
  }
  if (i.item === 'szuneteltetes' || i.item === 'folytatas') out.push({ k: 'szunetel', felirat: CHECKIN_PANEL_TEXTS.applyPause });
  if (i.item === 'csalad') out.push({ k: 'kedvezmeny_ujranezes', felirat: CHECKIN_PANEL_TEXTS.applyAllowances });
  if (i.item === 'alkalmazott') out.push({ k: 'alkalmazott_dontes', felirat: CHECKIN_PANEL_TEXTS.applyEmployer });
  return out;
}
/** The client's answer in staff words. */
function valaszSzoveg(i: TeamCheckinItem): string {
  const d = i.details;
  const r: string[] = [];
  if (d.since) r.push(`${datum(d.since, { ev: true })} óta`);
  if (d.weeklyHours) r.push(d.weeklyHours === 'legalabb_36' ? 'heti 36 óra vagy több' : 'heti 36 óránál kevesebb');
  if (d.choice) r.push(d.choice === 'szekhely' ? 'a székhelye költözik' : 'új telephely');
  if (d.employer) r.push(EMPLOYER_ANSWER_LABELS[d.employer].toLowerCase());
  if (d.change && d.change.kind === 'valtozas_adoadat') r.push(d.change.items.map((x) => CHANGE_FORM_TEXTS.adoadatItems[x].toLowerCase()).join(', '));
  if (d.text) r.push(`„${d.text}”`);
  return r.join(' · ');
}
function labda(i: TeamCheckinItem): string {
  return i.ball === 'konyvelo' ? 'Könyvelő' : i.ball === 'csapat' ? 'Csapat' : i.ball === 'ugyfel' ? 'Ügyfél' : '–';
}

export default function HaviValtozasok() {
  const { isCsapat, isAccountant } = useAuth();
  const szerep = isCsapat ? 'csapat' : isAccountant ? 'konyvelo' : 'admin';
  const [sp, setSp] = useSearchParams();
  const szuro = (sp.get('szuro') as HaviSzuro) || (isCsapat ? 'nyitott' : 'nalam');
  const ugyfel = sp.get('ugyfel');
  const [kereses, setKereses] = useState('');
  const [nyit, setNyit] = useState<string | null>(null);
  const t = today();
  const q = useQuery({ queryKey: ['acc', 'checkin-items', 'mind'], queryFn: () => ep.accCheckinItems('mind'), refetchInterval: 120_000 });
  const alap = useMemo(() => {
    const s = kereses.trim().toLowerCase();
    return (q.data ?? []).filter((i) => (!ugyfel || i.client.id === ugyfel) && (!s || i.client.name.toLowerCase().includes(s)));
  }, [q.data, kereses, ugyfel]);
  const sorok = alap.filter((i) => haviIlleszkedik(i, szuro, szerep)).sort((a, b) => a.since.localeCompare(b.since));
  const nyitott = (q.data ?? []).find((i) => i.id === nyit) ?? null;
  const allit = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  return (
    <>
      <Fejlec
        cim={CHECKIN_PANEL_TEXTS.title}
        mellek={
          isCsapat
            ? 'Azok a havi változások, amelyekből „Intézzük helyette” kérés lett. Döntés és utómunka a könyvelőnél.'
            : 'Az ügyfelek havi „Változott valami?” válaszai. Az adóprofilt te állítod át, egy kattintással – magától semmi nem változik.'
        }
      />
      <div className="tartalom">
        <div className="sor-flex ter" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="szegmens" role="tablist" aria-label="Szűrés">
            {HAVI_SZUROK.map((f) => (
              <button key={f.k} role="tab" aria-selected={szuro === f.k} className={szuro === f.k ? 'on' : ''} onClick={() => allit('szuro', f.k)}>
                {f.felirat}
                <span className="db">{alap.filter((i) => haviIlleszkedik(i, f.k, szerep)).length}</span>
              </button>
            ))}
          </div>
          {ugyfel && (
            <button className="gomb-m kicsi csak-szoveg" onClick={() => allit('ugyfel', null)}>
              Minden ügyfél
            </button>
          )}
          <label className="kereso">
            <span className="rejtett">Keresés</span>
            <input placeholder="Ügyfél neve" value={kereses} onChange={(e) => setKereses(e.target.value)} />
          </label>
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <div className="lap">
          {q.isPending ? (
            <Toltes />
          ) : sorok.length === 0 ? (
            <Ures n="ures_mappa" cim={szuro === 'nalam' ? 'Most nincs rád váró változás' : 'Nincs ilyen tétel'}>
              Ha egy ügyfél a havi kérdésnél „Igen”-t nyom, itt jelenik meg.
            </Ures>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="elso">{CHECKIN_PANEL_TEXTS.colClient}</th>
                  <th>{CHECKIN_PANEL_TEXTS.colWhat}</th>
                  <th>{CHECKIN_PANEL_TEXTS.colHow}</th>
                  <th>{CHECKIN_PANEL_TEXTS.colFee}</th>
                  <th>{CHECKIN_PANEL_TEXTS.colBall}</th>
                  <th className="utolso">{CHECKIN_PANEL_TEXTS.colSince}</th>
                </tr>
              </thead>
              <tbody>
                {sorok.map((i) => (
                  <tr key={i.id} className="kattinthato" onClick={() => setNyit(i.id)}>
                    <td className="elso">
                      <span className="nev">{i.client.name}</span>
                      <div className="al">{honapNev(i.period)} óta</div>
                    </td>
                    <td>
                      {i.itemLabel}
                      {valaszSzoveg(i) && <div className="al">{valaszSzoveg(i)}</div>}
                    </td>
                    <td>
                      {i.how ? CHECKIN_PANEL_TEXTS.how[i.how] : <span className="halvany">–</span>}
                      <div className="al">{CHECKIN_PANEL_TEXTS.status[i.status]}</div>
                    </td>
                    <td className="nt">
                      {i.fee ? (
                        <>
                          {ft(i.fee.amountHuf)}{' '}
                          <span className={`cimke ${i.fee.status === 'fizetve' ? '' : 'figyel'}`}>{i.fee.status === 'fizetve' ? CHECKIN_PANEL_TEXTS.feePaid : CHECKIN_PANEL_TEXTS.feeWaiting}</span>
                        </>
                      ) : (
                        <span className="halvany">–</span>
                      )}
                    </td>
                    <td>{labda(i)}</td>
                    <td className="utolso nt">{idopont(i.since, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="halvany kicsi" style={{ padding: '12px 4px' }}>
          A havi kérdés minden hónap első munkanapján nyílik. Ha az ügyfél a hónap végéig nem válaszol, lejár – büntetés nincs, a következő hónapban újra kérdezünk.
        </p>
      </div>
      <TetelFiok i={nyitott} szerep={szerep} bezar={() => setNyit(null)} />
    </>
  );
}

function TetelFiok({ i, szerep, bezar }: { i: TeamCheckinItem | null; szerep: 'konyvelo' | 'admin' | 'csapat'; bezar: () => void }) {
  const pir = usePirito();
  const qc = useQueryClient();
  const [st, setSt] = useState<'kesz' | 'csapatnal' | 'nem_kell'>('kesz');
  const [ok, setOk] = useState('');
  const [jegyzet, setJegyzet] = useState('');
  const [alk, setAlk] = useState<Alkalmaz[]>([]);
  const [hiba, setHiba] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => ep.accCheckinDecision(i!.id, { status: st, clientText: st === 'nem_kell' ? ok.trim() : undefined, staffNote: jegyzet.trim() || undefined, apply: alk.length ? alk : undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['acc', 'checkin-items'] });
      void qc.invalidateQueries({ queryKey: ['acc', 'client', i!.client.id] });
      pir.ok(st === 'nem_kell' ? 'Lezártad. Az ügyfél látja az indokot.' : 'Elmentve.');
      bezar();
    },
    onError: (e) => (e instanceof ApiError && e.fields?.clientText ? setHiba(e.fields.clientText) : pir.hiba(e)),
  });
  if (!i) return null;
  const dont = szerep !== 'csapat' && i.status !== 'kesz' && i.status !== 'nem_kell';
  const h = hatasok(i);
  return (
    <Fiok
      nyitva={!!i}
      bezar={bezar}
      cim={`${i.client.name}: ${i.itemLabel}`}
      bev={`${honapNev(i.period)} óta · ${CHECKIN_PANEL_TEXTS.status[i.status]}`}
      ikon="kerdezek"
      lab={
        dont ? (
          <div className="gombsor">
            <button
              className="gomb-e"
              disabled={m.isPending}
              onClick={() => {
                if (st === 'nem_kell' && !ok.trim()) return setHiba('Írd meg az ügyfélnek, miért nem kell teendő.');
                m.mutate();
              }}
            >
              Elmentem
            </button>
            <button className="gomb-sz" onClick={bezar}>
              Mégsem
            </button>
          </div>
        ) : undefined
      }
    >
      <dl className="adatok keskeny-adatok">
        <dt>A válasza</dt>
        <dd>{valaszSzoveg(i) || 'csak „Igen”-t nyomott, részlet nélkül'}</dd>
        <dt>Hogyan intézzük</dt>
        <dd>{i.how ? CHECKIN_PANEL_TEXTS.how[i.how] : 'csak jelezte'}</dd>
        <dt>Mit mondtunk neki</dt>
        <dd className="halvany">Mi változik nálad: {CHECKIN_ADMIN_TEXTS[i.item].replace('{firstName}', 'a könyvelőd')}</dd>
        {i.fee && (
          <>
            <dt>Díj</dt>
            <dd>
              {FEE_KIND_LABELS[i.fee.kind]}: {ft(i.fee.amountHuf)} – {FEE_CHARGE_STATUS_LABELS[i.fee.status].toLowerCase()} <DemoCimke />
            </dd>
          </>
        )}
        {i.staffNote && (
          <>
            <dt>Belső jegyzet</dt>
            <dd>{i.staffNote}</dd>
          </>
        )}
      </dl>
      <div className="gombsor" style={{ marginTop: 12 }}>
        {i.assistId && (
          <Link className="gomb-m kicsi csak-szoveg" to={`/helyettunk/${i.assistId}`}>
            <I3 n="igazolas" s={22} />
            „Intézzük helyette” kérés
          </Link>
        )}
        {szerep !== 'csapat' && (
          <Link className="gomb-m kicsi csak-szoveg" to={`/ugyfelek/${i.client.id}/${i.item === 'csalad' ? 'kedvezmenyek' : 'attekintes'}`}>
            Ügyfél adatlapja
          </Link>
        )}
      </div>
      {dont && (
        <div style={{ marginTop: 18 }}>
          <span className="felirat">Mi legyen vele?</span>
          <div className="valaszto" role="radiogroup" style={{ marginTop: 6 }}>
            {(
              [
                ['kesz', 'Elintéztem (kész)'],
                ['csapatnal', 'A csapat intézi'],
                ['nem_kell', 'Nem kell teendő'],
              ] as const
            ).map(([k, f]) => (
              <label key={k}>
                <input type="radio" name="havi-st" checked={st === k} onChange={() => setSt(k)} />
                {f}
              </label>
            ))}
          </div>
          {st === 'nem_kell' && (
            <label className="mezo" style={{ marginTop: 12 }}>
              <span className="felirat">{CHECKIN_PANEL_TEXTS.noActionReason}</span>
              <textarea className={`doboz${hiba ? ' hibas' : ''}`} rows={3} maxLength={300} value={ok} onChange={(e) => setOk(e.target.value)} placeholder="Például: Heti 20 óra mellett főállású maradsz, nálunk nem kell semmit átállítani." />
              {hiba && <span className="hiba-szoveg">{hiba}</span>}
            </label>
          )}
          {h.length > 0 && st !== 'nem_kell' && (
            <div className="oszlop" style={{ gap: 8, marginTop: 14 }}>
              <span className="felirat" style={{ margin: 0 }}>Egy kattintással (te döntöd el)</span>
              {h.map((x) => (
                <label key={x.k} className="jelolo">
                  <input type="checkbox" checked={alk.includes(x.k)} onChange={(e) => setAlk(e.target.checked ? [...alk, x.k] : alk.filter((y) => y !== x.k))} />
                  <span>{x.felirat}</span>
                </label>
              ))}
            </div>
          )}
          <label className="mezo" style={{ marginTop: 14 }}>
            <span className="felirat">Belső jegyzet (nem kötelező)</span>
            <textarea className="doboz" rows={2} value={jegyzet} onChange={(e) => setJegyzet(e.target.value)} />
          </label>
        </div>
      )}
      {!dont && szerep === 'csapat' && <p className="sugo">Erről a könyvelő dönt. A kérés lépéseit az „Intézzük helyette” oldalon követed.</p>}
    </Fiok>
  );
}
