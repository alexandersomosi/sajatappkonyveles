// SPEC §28.1.9, §28.4.4 and §28.K on the client page's Áttekintés tab: "Ezt látja az ügyfél" (reserve + earnings,
// with the read-only month tables), the service lock, the pause, the KATA meter, the EFO decision, the missing
// adószám, the monthly check-in items and the forwarding address. C look (§28.K.10): 3D icon 28 + dark title 18,
// sections inside a sheet separated by the 10 px #D3DAFC band (C_VEGLEGES), no shadows.
import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { DemoCimke, Fiok, Ft, HibaSav, Lenyilo, Masol, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { ApiError } from '../../../api/client';
import {
  CHECKIN_PANEL_TEXTS,
  EARNINGS_TEXTS,
  EMPLOYER_ANSWER_LABELS,
  EMPLOYER_DECISION_CLIENT_TEXTS,
  EMPLOYER_DECISION_LABELS,
  KATA_TEXTS,
  LOCK_TEXTS,
  MAILBOX_TEXTS,
  PAUSE_TEXTS,
  RESERVE_PANEL_TEXTS,
} from '../../../_shared/bekotes';
import { EMPLOYER_DECISIONS, EMPLOYER_RULES, KATA_RULES_2026, type EmployerDecision } from '../../../_shared/enums';
import { datum, datumRovid, ft, idopont, szam } from '../../../lib/format';
import { felreteszErtek, felreteszTipp, zarolasCimke } from '../../../lib/k28';
import { adoszamEllenor } from '../../../lib/csapat';
import { today } from '../../../lib/today';

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? `{${k}}`);

/** Red band on top of every tab while the client's service is locked (SPEC §28.K.5). */
export function ZarolasSav({ c }: FulProps) {
  const l = c.serviceLock;
  if (!l) return null;
  return (
    <div className="uzenet-sav hiba" style={{ marginBottom: 16 }} role="status">
      <I3 n="lakat" s={28} />
      <div>
        <b>{zarolasCimke(l)}.</b> Amíg nincs kifizetve, nem hagyhatsz jóvá adót, nem írhatsz levelet, nem küldhetsz be semmit, és nem kérhetsz tőle újat. Olvasni és üzenni lehet; az ügyfél fizethet, letöltheti az adatait, és írhat az ügyfélszolgálatnak.
      </div>
    </div>
  );
}

/** Áttekintés: the extra cards of §28 / §28.K in the right column. */
export function K28Kartyak({ c }: FulProps) {
  return (
    <>
      {c.adoszamPending && <AdoszamHianyzik c={c} />}
      {c.employer && <Alkalmazottak c={c} />}
      {c.taxRegime === 'kata' && c.kata && <KataKartya c={c} />}
      {c.lifecycle !== 'bekotes_alatt' && <AdozasiMod c={c} />}
      {c.pause && <SzunetelKartya c={c} />}
      {(c.reserve || c.earnings) && <EztLatja c={c} />}
      {(c.checkinOpenItems ?? 0) > 0 && (
        <div className="lap k28" style={{ marginTop: 16 }}>
          <div className="szak">
            <div className="szak-fej">
              <I3 n="kerdezek" s={28} />
              <h2>Havi ellenőrzés</h2>
              <Link className="gomb-m kicsi csak-szoveg" to={`/havi-valtozasok?ugyfel=${c.id}`}>
                Megnyitom
              </Link>
            </div>
            <p>{c.checkinOpenItems} változás vár a „{CHECKIN_PANEL_TEXTS.title}” sorban.</p>
          </div>
        </div>
      )}
      {c.mailboxAddress && (
        <div className="lap k28" style={{ marginTop: 16 }}>
          <div className="szak">
            <div className="szak-fej">
              <I3 n="boritek" s={28} />
              <h2>{MAILBOX_TEXTS.fiokRow}</h2>
              {c.demo && <DemoCimke />}
            </div>
            <p className="szam" style={{ wordBreak: 'break-all' }}>
              {c.mailboxAddress} <Masol ertek={c.mailboxAddress} />
            </p>
            <p className="halvany kicsi">A saját címéről ide továbbított számlák és kivonatok a megfelelő hónap dossziéjába kerülnek.</p>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- "Ezt látja az ügyfél" (SPEC §28.1.9 + §28.4.4) ----------
function EztLatja({ c }: FulProps) {
  const [nyit, setNyit] = useState<null | 'felre' | 'kereset'>(null);
  const r = c.reserve;
  const e = c.earnings;
  return (
    <div className="lap k28" style={{ marginTop: 16 }}>
      {r && (
        <div className="szak">
          <div className="szak-fej">
            <I3 n="szamolo" s={28} />
            <h2>{RESERVE_PANEL_TEXTS.title}</h2>
          </div>
          <div className="nagy-osszeg">{fill(RESERVE_PANEL_TEXTS.keepNow, { keepNow: szam(r.keepNowHuf) })}</div>
          <p className="halvany">
            Eddig kb. {ft(r.accruedHuf)} adóval számol (számlák {ft(r.invoicesHuf)}
            {r.fixedHuf > 0 ? `, havi fix járulék ${ft(r.fixedHuf)}` : ''}
            {r.hipaHuf > 0 ? `, iparűzési adó ${ft(r.hipaHuf)}` : ''}); ebből {ft(r.dueOrPaidHuf)} a lezárt negyedévekre esik.
          </p>
          {r.markedHuf ? <p className="halvany kicsi">Az ügyfél szerint félretett: {ft(r.markedHuf)} (saját bevallás).</p> : null}
          {r.estimateReasons.length > 0 && (
            <ul className="k28-okok">
              {r.estimateReasons.map((x) => (
                <li key={x.code}>{x.text.replace('{firstName}', 'Bence')}</li>
              ))}
            </ul>
          )}
          <button className="gomb-sz" onClick={() => setNyit('felre')}>
            Számlánként
          </button>
        </div>
      )}
      {e && (
        <div className="szak">
          <div className="szak-fej">
            <I3 n="szamlak" s={28} />
            <h2>{EARNINGS_TEXTS.cardTitle}</h2>
          </div>
          {/* k6c3: a "kb." amount is rounded to 1 000 Ft, as on the client's card; a negative year uses the client's own sentence */}
          <div className="nagy-osszeg">{e.ytdNetHuf < 0 ? e.sentence : fill(RESERVE_PANEL_TEXTS.ytdNet, { ytdNet: szam(Math.round(e.ytdNetHuf / 1000) * 1000) })}</div>
          <p className="halvany">{e.sub}</p>
          {e.projectionText && <p className="halvany kicsi">{e.projectionText}</p>}
          <button className="gomb-sz" onClick={() => setNyit('kereset')}>
            {RESERVE_PANEL_TEXTS.link}
          </button>
        </div>
      )}
      <FelreteszFiok c={c} nyitva={nyit === 'felre'} bezar={() => setNyit(null)} />
      <KeresetFiok c={c} nyitva={nyit === 'kereset'} bezar={() => setNyit(null)} />
    </div>
  );
}

function FelreteszFiok({ c, nyitva, bezar }: FulProps & { nyitva: boolean; bezar: () => void }) {
  const ev = c.reserve?.year ?? Number(today().slice(0, 4));
  const q = useQuery({ queryKey: ['acc', 'reserve', c.id, ev], queryFn: () => ep.accReserve(c.id, ev), enabled: nyitva });
  return (
    <Fiok nyitva={nyitva} bezar={bezar} cim={`Félretenni, ${ev}`} bev="Pontosan ezt látja az ügyfél, számlánként. Csak olvasni lehet: ha egy szám rossz, az adóprofil vagy a bevétel a hibás." ikon="szamolo" szeles>
      {q.isPending ? (
        <Toltes />
      ) : q.isError ? (
        <HibaSav hiba={q.error} ujra={() => q.refetch()} />
      ) : (
        <>
          <p style={{ marginBottom: 6 }}>
            <b>{q.data.card.sentence}</b>
          </p>
          <p className="halvany kicsi" style={{ marginBottom: 14 }}>
            {q.data.card.detail}
          </p>
          {q.data.months.length === 0 && <p className="halvany">Idén még nincs kiállított számlája.</p>}
          {q.data.months.map((m) => (
            <div key={m.month} className="k28-honap">
              <h3 className="kis-cim">{m.label}</h3>
              <table className="tabla tomor" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 250 }} />
                </colgroup>
                <tbody>
                  {m.items.map((i) => (
                    <tr key={i.revenueItemId}>
                      <td className="elso">
                        {i.title}
                        <div className="al">
                          {i.sub} · {datumRovid(i.receivedOn)}
                          {i.reserve.estimated ? ' · becslés' : ''}
                        </div>
                      </td>
                      <td className="jobb">
                        <Ft n={i.amountHuf} />
                      </td>
                      <td className="jobb utolso" title={felreteszTipp(i.reserve)}>
                        <span className="szam felkover">{felreteszErtek(i.reserve)}</span>
                        <div className="al">{i.reserve.listLine ?? ''}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </Fiok>
  );
}

function KeresetFiok({ c, nyitva, bezar }: FulProps & { nyitva: boolean; bezar: () => void }) {
  const ev = Number(today().slice(0, 4));
  const q = useQuery({ queryKey: ['acc', 'earnings', c.id, ev], queryFn: () => ep.accEarnings(c.id, ev), enabled: nyitva });
  return (
    <Fiok nyitva={nyitva} bezar={bezar} cim={`${EARNINGS_TEXTS.screenTitle} ${ev}`} bev={EARNINGS_TEXTS.line} ikon="szamlak" szeles>
      {q.isPending ? (
        <Toltes />
      ) : q.isError ? (
        <HibaSav hiba={q.error} ujra={() => q.refetch()} />
      ) : (
        <>
          <table className="tabla tomor">
            <thead>
              <tr>
                <th className="elso">Hónap</th>
                <th className="jobb">Bevétel</th>
                <th className="jobb">SZJA</th>
                <th className="jobb">TB</th>
                <th className="jobb">Szocho</th>
                <th className="jobb">HIPA</th>
                <th className="jobb">Maradt</th>
                <th className="utolso">Alap</th>
              </tr>
            </thead>
            <tbody>
              {q.data.months
                .slice()
                .reverse()
                .map((m) => (
                  <tr key={m.month}>
                    <td className="elso">
                      {m.label}
                      {m.note && <div className="al">{m.note}</div>}
                    </td>
                    <td className="jobb"><Ft n={m.revenueHuf} /></td>
                    <td className="jobb"><Ft n={m.parts.szjaHuf} /></td>
                    <td className="jobb"><Ft n={m.parts.tbHuf} /></td>
                    <td className="jobb"><Ft n={m.parts.szochoHuf} /></td>
                    <td className="jobb"><Ft n={m.parts.hipaHuf} /></td>
                    <td className="jobb felkover" style={{ color: m.netHuf < 0 ? 'var(--veszely)' : undefined }}>
                      <Ft n={m.netHuf} />
                    </td>
                    <td className="utolso halvany">{EARNINGS_TEXTS.basis[m.basis]}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="elso">Idén eddig</td>
                <td className="jobb"><Ft n={q.data.ytd.revenueHuf} /></td>
                <td className="jobb" colSpan={4}>
                  adó és járulék: <Ft n={q.data.ytd.taxesHuf} />
                </td>
                <td className="jobb"><Ft n={q.data.ytd.netHuf} /></td>
                <td className="utolso" />
              </tr>
            </tfoot>
          </table>
          <p className="halvany kicsi" style={{ marginTop: 12 }}>
            {q.data.projection.reliable && q.data.projection.netHuf !== null
              ? `${EARNINGS_TEXTS.projectionTitle}: kb. ${ft(q.data.projection.netHuf)} (kb. ${ft(q.data.projection.revenueHuf)} bevételből, kb. ${ft(q.data.projection.taxesHuf)} adóval). ${EARNINGS_TEXTS.projectionNote}`
              : EARNINGS_TEXTS.projectionNotYet}
          </p>
          <p className="halvany kicsi">{q.data.disclaimer}</p>
        </>
      )}
    </Fiok>
  );
}

// ---------- KATA (SPEC §28.K.11) ----------
function KataKartya({ c }: FulProps) {
  const k = c.kata!;
  const szin = k.level === 'tullepve' ? 'var(--veszely)' : k.level === 'figyelem' ? 'var(--borostyan)' : 'var(--tintakek)';
  return (
    <div className="lap k28" style={{ marginTop: 16 }}>
      <div className="szak">
        <div className="szak-fej">
          <I3 n="bevallas" s={28} />
          <h2>Kata – {KATA_TEXTS.revenueTitle.toLowerCase()}</h2>
          <span className="cimke info">{KATA_TEXTS.panelChip}</span>
        </div>
        <div className="nagy-osszeg">{fill(KATA_TEXTS.meter, { bevetel: szam(k.revenueHuf), keret: szam(k.limitHuf) })}</div>
        <div className="sav k28-sav" aria-hidden="true">
          <i style={{ width: `${Math.min(100, k.usedPct)}%`, background: szin }} />
        </div>
        <p className="halvany">
          Az idei keret {k.usedPct}%-a ({szam(KATA_RULES_2026.monthlyLimitHuf)} Ft a kata minden hónapjára). Adóköteles hónap eddig: {k.liableMonths.length}. 40% különadó csak a keret fölött
          {k.kulonadoEstimateHuf > 0 ? `: becslés ${ft(k.kulonadoEstimateHuf)}` : ''}.
        </p>
        {k.nextPayment && (
          <p className="halvany kicsi">
            Következő: {ft(k.nextPayment.amountHuf)}, {datum(k.nextPayment.dueDate)} – {k.nextPayment.accountNumber}
          </p>
        )}
      </div>
      {k.businessInvoices.length > 0 && (
        <div className="szak">
          <div className="szak-fej">
            <I3 n="szamlak" s={28} />
            <h2>{KATA_TEXTS.businessInvoice}</h2>
          </div>
          {k.businessInvoices.map((b) => (
            <div key={b.navInvoiceId} className="uzenet-sav hiba" style={{ marginTop: 8 }}>
              <div>
                <b>
                  {b.customerName ?? 'Ismeretlen vevő'}, {ft(b.amountHuf)}
                </b>
                <div className="kicsi">
                  {b.endsOn
                    ? `Kifizette: a kata ${datum(b.endsOn, { ev: true })}-jén megszűnt. Bejelentés a NAV-nak ${datum(b.reportBy, { ev: true })}-ig.`
                    : 'Még nem fizette ki. Ha kifizeti, a kata a fizetés előtti nappal megszűnik – beszéljetek előtte.'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- pause (SPEC §28.K.6) ----------
function SzunetelKartya({ c }: FulProps) {
  const p = c.pause!;
  return (
    <div className="lap k28" style={{ marginTop: 16 }}>
      <div className="szak">
        <div className="szak-fej">
          <I3 n="tepnaptar" s={28} />
          <h2>{PAUSE_TEXTS.cardTitle}</h2>
        </div>
        <p>
          {datum(p.from, { ev: true })} óta{p.to ? `, ${datum(p.to, { ev: true })}-ig` : ''}. {fill(PAUSE_TEXTS.feeLine, { dij: szam(p.amountHuf) })} a havidíj helyett.
        </p>
        <p className="halvany kicsi">Forrás: {p.source === 'valtozas' ? 'változásbejelentés' : 'a könyvelő rögzítette'}. A szünetelés a járulékot is megállítja – az adóprofilban „szünetel” szakaszként szerepel.</p>
      </div>
    </div>
  );
}

// ---------- adószám later (SPEC §28.K.9) ----------
function AdoszamHianyzik({ c }: FulProps) {
  const pir = usePirito();
  const qc = useQueryClient();
  const [v, setV] = useState('');
  const ell = v.trim() ? adoszamEllenor(v) : null;
  const ment = useMutation({
    mutationFn: () => ep.accSetAdoszam(c.id, ell?.ertek ?? v.trim()),
    onSuccess: () => {
      pir.ok('Rögzítetted az adószámot.');
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    },
    onError: pir.hiba,
  });
  return (
    <div className="lap k28 figyel-lap">
      <div className="szak">
        <div className="szak-fej">
          <I3 n="igazolas" s={28} />
          <h2>Adószám hiányzik – töltsd ki az ONYA-ból</h2>
        </div>
        <p className="halvany">Az ügyfél nem tudta az adószámát, kézzel adta meg az adatait. Amint él a meghatalmazás, nézd meg az ONYA-ban, és írd be ide. Addig a NAV-os számlák letöltése vár.</p>
        <div className="sor-flex" style={{ marginTop: 10, alignItems: 'flex-start' }}>
          <label className="mezo" style={{ flex: 1 }}>
            <span className="rejtett">Adószám</span>
            <input className={`doboz szam${ell?.hiba ? ' hibas' : ''}`} value={v} placeholder="12345678-1-23" onChange={(e) => setV(e.target.value)} />
            {ell?.hiba && <span className="hiba-szoveg">{ell.hiba}</span>}
            {ell?.figyelmeztetes && <span className="sugo" style={{ color: '#5E3B00' }}>{ell.figyelmeztetes}</span>}
          </label>
          <button className="gomb-e kicsi" disabled={!ell || !!ell.hiba || ment.isPending || !!c.serviceLock} title={c.serviceLock ? LOCK_TEXTS.panelDisabled : undefined} onClick={() => ment.mutate()}>
            Rögzítem
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- employees / EFO (SPEC §28.K.7) ----------
function Alkalmazottak({ c }: FulProps) {
  const e = c.employer!;
  const pir = usePirito();
  const qc = useQueryClient();
  const [dontes, setDontes] = useState<EmployerDecision>(e.decision ?? 'berszamfejtes_mashol');
  const [szoveg, setSzoveg] = useState<string>(e.clientText ?? EMPLOYER_DECISION_CLIENT_TEXTS[e.decision ?? 'berszamfejtes_mashol']);
  const [osszeg, setOsszeg] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const kell = dontes !== 'nincs_teendo';
  const ment = useMutation({
    mutationFn: () =>
      ep.accEmployerDecision(c.id, { decision: dontes, clientText: szoveg.trim() || undefined, offerAmountText: dontes === 'egyedi_ajanlat' && osszeg.trim() ? osszeg.trim() : undefined }),
    onSuccess: () => {
      pir.ok('Elmentve. Az ügyfél értesítést kapott.');
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    },
    onError: (x) => (x instanceof ApiError && x.fields?.clientText ? setHiba(x.fields.clientText) : pir.hiba(x)),
  });
  return (
    <div className={`lap k28${e.blocksActivation ? ' figyel-lap' : ''}`} style={{ marginTop: 16 }}>
      <div className="szak">
        <div className="szak-fej">
          <I3 n="fiok" s={28} />
          <h2>Alkalmazottak</h2>
          {e.decision ? <span className="cimke">{EMPLOYER_DECISION_LABELS[e.decision]}</span> : <span className="cimke figyel">Döntésre vár</span>}
        </div>
        <p>
          Az ügyfél válasza: <b>{EMPLOYER_ANSWER_LABELS[e.answer]}</b> <span className="halvany kicsi">({idopont(e.answeredAt, today())}, {e.source === 'onboarding' ? 'bekötéskor' : e.source === 'havi_ellenorzes' ? 'havi ellenőrzésben' : 'könyvelő'})</span>
        </p>
        <p className="halvany kicsi">Bérszámfejtést most nem vállalunk. {e.blocksActivation ? 'Amíg nem döntesz, az ügyfél előfizetése zárva marad – kártyát nem terhelünk.' : 'Döntöttél, az aktiválást nem tartja vissza.'}</p>
      </div>
      <div className="szak">
        <label className="mezo">
          <span className="felirat">Döntés</span>
          <Lenyilo
            value={dontes}
            onChange={(x) => {
              const d = x.target.value as EmployerDecision;
              setDontes(d);
              setSzoveg(EMPLOYER_DECISION_CLIENT_TEXTS[d]);
              setHiba(null);
            }}
          >
            {EMPLOYER_DECISIONS.map((d) => (
              <option key={d} value={d}>
                {EMPLOYER_DECISION_LABELS[d]}
              </option>
            ))}
          </Lenyilo>
        </label>
        {dontes === 'egyedi_ajanlat' && (
          <label className="mezo">
            <span className="felirat">Az ajánlat összege (szövegként, nem terheljük)</span>
            <input className="doboz" value={osszeg} placeholder="pl. havi 9 000 Ft alkalmazottanként" onChange={(x) => setOsszeg(x.target.value)} />
          </label>
        )}
        <label className="mezo">
          <span className="felirat">Szöveg az ügyfélnek{kell ? '' : ' (nem kötelező)'}</span>
          <textarea className={`doboz${hiba ? ' hibas' : ''}`} rows={3} maxLength={EMPLOYER_RULES.clientTextMaxChars} value={szoveg} onChange={(x) => setSzoveg(x.target.value)} />
          {hiba ? <span className="hiba-szoveg">{hiba}</span> : <span className="sugo">Tegezve, röviden. Ő ezt olvassa az appban.</span>}
        </label>
        {dontes === 'nem_vallaljuk' && <p className="sugo">A bekötés ezzel a szöveggel leáll. Díjat nem terheltünk; a fiókját az ügyfél törölheti.</p>}
        <div className="gombsor" style={{ marginTop: 12 }}>
          <button
            className="gomb-e kicsi"
            disabled={ment.isPending || (kell && !szoveg.trim())}
            onClick={() => {
              if (kell && !szoveg.trim()) return setHiba('Írd meg az ügyfélnek is.');
              ment.mutate();
            }}
          >
            Elküldöm a döntést
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- tax regime (SPEC §28.K.11 / §28.K.18 POST /acc/clients/:id/tax-regime) ----------
function AdozasiMod({ c }: FulProps) {
  const pir = usePirito();
  const qc = useQueryClient();
  const most = c.taxRegime ?? 'atalany';
  const [nyit, setNyit] = useState(false);
  const [uj, setUj] = useState<'atalany' | 'kata'>(most === 'kata' ? 'atalany' : 'kata');
  const [tol, setTol] = useState('');
  const m = useMutation({
    mutationFn: () => ep.accSetTaxRegime(c.id, uj === 'kata' ? { regime: 'kata', kataFrom: tol || null } : { regime: 'atalany', kataTo: tol || null }),
    onSuccess: () => {
      pir.ok('Átállítottad. Az adóbecslés és az ügyfél Főoldala frissül.');
      setNyit(false);
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    },
    onError: pir.hiba,
  });
  return (
    <div className="lap k28" style={{ marginTop: 16 }}>
      <div className="szak">
        <div className="szak-fej">
          <I3 n="szamolo" s={28} />
          <h2>Adózási mód: {most === 'kata' ? 'kata' : 'átalányadó'}</h2>
          {!nyit && (
            <button className="gomb-m kicsi csak-szoveg" disabled={!!c.serviceLock} title={c.serviceLock ? LOCK_TEXTS.panelDisabled : undefined} onClick={() => setNyit(true)}>
              Átállítom
            </button>
          )}
        </div>
        <p className="halvany kicsi">
          Csak akkor állítsd át, ha a NAV-nál is megtörtént (a változás bejelentése után). {KATA_TEXTS.switchRule}
        </p>
        {nyit && (
          <div className="sor-flex" style={{ marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="szegmens egysor" role="group" aria-label="Új adózási mód">
              {(['atalany', 'kata'] as const).map((r) => (
                <button key={r} type="button" className={uj === r ? 'on' : ''} aria-pressed={uj === r} onClick={() => setUj(r)}>
                  {r === 'kata' ? 'Kata' : 'Átalányadó'}
                </button>
              ))}
            </div>
            <label className="mezo" style={{ width: 180 }}>
              <span className="felirat">{uj === 'kata' ? 'Kata ettől a naptól' : 'A kata utolsó napja'}</span>
              <input className="doboz" type="date" value={tol} onChange={(e) => setTol(e.target.value)} />
            </label>
            <button className="gomb-e kicsi" disabled={m.isPending || !tol || uj === most} onClick={() => m.mutate()}>
              Átállítom
            </button>
            <button className="gomb-sz" onClick={() => setNyit(false)}>
              Mégsem
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
