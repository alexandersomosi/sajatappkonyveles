// /helyettunk/:id – one assisted request (SPEC §27.3, §27.6.3). Three columns: 1. the client and the data to file
// (+ what the client approved), 2. the steps: one check list per phase and the phase button (who may press it and why
// a button is disabled), the 4-day approval window, the handbook and the never-credentials rule, 3. owner, staff
// note, timeline, "Lezárom". The team never files anything at the NAV: the UJEGYKE and the EV bejelentés are filed
// only by the client's own accountant, from his own ONYA / Ügyfélportál profile, with his own KAÜ login.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { TeamAssistDetailP, TeamClientCard } from '../../api/types';
import type { BusinessRegistrationAnswers } from '../../_shared/api';
import { useAuth } from '../../auth/Auth';
import { Fejlec, Fiok, HibaSav, Lenyilo, Masol, Toltes } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import { useMost } from '../../ui/useMost';
import {
  ASSIST_CHECK_LABELS,
  ASSIST_CLOSE_REASON_LABELS,
  ASSIST_CLOSE_REASONS,
  ASSIST_JOGCIM_LABELS,
  ASSIST_JOGCIMEK,
  ASSIST_KIND_LABELS,
  ASSIST_STATUS_LABELS,
  ASSIST_UJEGYKE_JOGCIM_DEFAULT,
  SEAT_KIND_LABELS,
  WORK_KIND_LABELS,
  REVENUE_BAND_LABELS,
  type AssistCheckItem,
  type AssistCheckPhase,
  type AssistCloseReason,
  type AssistJogcim,
  type AssistKind,
} from '../../_shared/enums';
import {
  FAZIS_CIM,
  FAZIS_KI,
  aktivFazis,
  fazisElemek,
  lejartJovahagyas,
  fazisKesz,
  fazisok,
  hianyzoPipak,
  jovahagyasIdozito,
  kisbetu,
  labdaSzoveg,
  muveletAllapot,
  nyitottAssist,
  ugyfelTeendo,
  utonev,
  valtozasFajta,
  allapotFelirat,
  type MuveletKornyezet,
  type PanelMuvelet,
} from '../../lib/helyettunk';
import { ValtozasAdatok, ValtozasDij, ValtozasKezikonyv, ValtozasUtomunka, valtozasRovid } from './Valtozas';
import { CHANGE_HANDBOOK, LOCK_TEXTS } from '../../_shared/bekotes';
import { adoszamEllenor, hanyNapja, nyilvantartasiSzamOk } from '../../lib/csapat';
import { datum, ft, idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { HataridoCimke, useSzerep } from './Helyettunk';
import { UgyfelKartya } from './UgyfelKartya';

/** SPEC §27.3.7 – the team's rule, same words everywhere in the panel. */
export const SOHA_BELEPES =
  'Soha ne kérd el és ne használd az ügyfél Ügyfélkapu+ / DÁP belépését, jelszavát, kódját; ne lépj be helyette, és ne irányítsd távolról a telefonját vagy gépét NAV-os ügyintézés közben.';

function Sor({ cim, children }: { cim: string; children: ReactNode }) {
  return (
    <>
      <dt>{cim}</dt>
      <dd>{children}</dd>
    </>
  );
}

export default function HelyettunkReszlet() {
  const { id = '' } = useParams();
  const { user, isCsapat, isAdmin } = useAuth();
  const szerep = useSzerep();
  const nav = useNavigate();
  const qc = useQueryClient();
  const pir = usePirito();
  const t = today();
  const most = useMost();
  const q = useQuery({ queryKey: ['team', 'assist', id], queryFn: () => ep.teamAssist(id) });
  const [lezar, setLezar] = useState(false);
  const frissit = (d: TeamAssistDetailP) => {
    qc.setQueryData(['team', 'assist', id], d);
    void qc.invalidateQueries({ queryKey: ['team', 'assists'] });
    void qc.invalidateQueries({ queryKey: ['team', 'summary'] });
    void qc.invalidateQueries({ queryKey: ['team', 'registrations'] });
  };
  const gazda = useMutation({
    mutationFn: (userId: string | null) => ep.teamAssistAssign(id, { userId }),
    onSuccess: (d, u) => {
      frissit(d);
      pir.ok(u ? 'Magadra vetted.' : 'Leadtad, most nincs gazdája.');
    },
    onError: pir.hiba,
  });

  if (q.isPending) return <Toltes />;
  if (q.isError)
    return (
      <div className="tartalom">
        <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        <p style={{ marginTop: 12 }}>
          <Link to="/helyettunk">Vissza az „Intézzük helyette” listához</Link>
        </p>
      </div>
    );
  const d = q.data;
  const cc = d.clientCard;
  const nyitott = nyitottAssist(d.status);
  const konyveloUtonev = utonev(d.accountant?.name);
  const sajatKonyvelo = !!d.accountant && d.accountant.userId === user?.id;
  const enyem = d.assignee?.userId === user?.id;
  const teendo = ugyfelTeendo(d.status);
  const ki = labdaSzoveg(d.ball, d.accountant?.name);
  return (
    <>
      <Fejlec
        rozR={380}
        felcim={<Link to="/helyettunk">Vissza az „Intézzük helyette” listához</Link>}
        cim={
          <>
            {d.client.name}{' '}
            <span className={`cimke ${nyitott ? (d.status === 'meghatalmazas_lejart' ? 'hiba' : 'info') : ''}`} style={{ marginLeft: 6 }}>
              {allapotFelirat(d.status, d.kind, ASSIST_STATUS_LABELS)}
            </span>
          </>
        }
        mellek={
          <>
            Kérte: <b>{kisbetu(ASSIST_KIND_LABELS[d.kind])}</b> · {idopont(d.createdAt, t)}
            {d.accountant && <> · könyvelője {d.accountant.name}</>}
            <br />
            {nyitott ? (
              <>
                Kinél a labda: <b>{d.ball === 'konyvelo' && sajatKonyvelo ? 'nálad' : ki}</b>
                {teendo && <> – az ügyfél {teendo}</>}
                {d.nextDue && (
                  <>
                    {' '}
                    · {d.nextDue.what}:{' '}
                    <span className="egyben">{d.status === 'meghatalmazas_bekuldve' && d.approvalDueOn ? datum(d.approvalDueOn) : idopont(d.nextDue.at, t)}</span>
                  </>
                )}
              </>
            ) : (
              <>Ebben az állapotban: {hanyNapja(d.daysInStatus)}</>
            )}
          </>
        }
        jobb={
          <>
            {isCsapat && cc.canMessage && (
              <button className="gomb-sav" onClick={() => nav(`/uzenetek/${cc.id}`)}>
                <I3 n="uzenetek" s={24} />
                Üzenet
              </button>
            )}
            {!isCsapat && !isAdmin && (
              <button className="gomb-sav" onClick={() => nav(`/ugyfelek/${cc.id}/${valtozasFajta(d.kind) ? 'attekintes' : 'bekotes'}`)}>
                <I3 n="dosszie" s={24} />
                Ügyfél adatlapja
              </button>
            )}
            {d.callbackId && (
              <button className="gomb-sav" onClick={() => nav(`/visszahivasok?szuro=mind&nyit=${d.callbackId}`)}>
                <I3 n="ora" s={24} />
                Visszahívás megnyitása
              </button>
            )}
          </>
        }
      />
      <div className="tartalom szeles-tartalom">
        <MostSav d={d} sajatKonyvelo={sajatKonyvelo} konyveloUtonev={konyveloUtonev} most={most} />
        <div className="racs k3 regisztracio-racs" style={{ marginTop: 16 }}>
          <AdatokOszlop d={d} szerep={szerep} onKartya={(c) => qc.setQueryData(['team', 'assist', id], { ...d, clientCard: c })} />
          <LepesekOszlop d={d} szerep={szerep} sajatKonyvelo={sajatKonyvelo} konyveloUtonev={konyveloUtonev} frissit={frissit} most={most} />
          <div className="oszlop" style={{ gap: 16 }}>
            {(isCsapat || isAdmin) && (
              <div className="lap">
                <div className="lap-fej">
                  <h2>Ki foglalkozik vele</h2>
                </div>
                <div className="belso" style={{ paddingTop: 0 }}>
                  <p>{d.assignee ? <b>{d.assignee.name}</b> : <span className="halvany">Még senki.</span>}</p>
                  {nyitott && (
                    <div className="gombsor" style={{ marginTop: 8 }}>
                      {!enyem && (
                        <button className="gomb-m kicsi csak-szoveg" disabled={gazda.isPending} onClick={() => gazda.mutate(user?.id ?? null)}>
                          Magamra veszem
                        </button>
                      )}
                      {d.assignee && (
                        <button className="gomb-sz" disabled={gazda.isPending} onClick={() => gazda.mutate(null)}>
                          {enyem ? 'Leadom' : 'Gazda nélkül hagyom'}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="halvany kicsi" style={{ marginTop: 8 }}>A gazda hívja az ügyfelet és figyeli a határidőket. A beküldés mindig {konyveloUtonev} dolga.</p>
                </div>
              </div>
            )}
            <Jegyzet d={d} frissit={frissit} />
            <div className="lap">
              <div className="lap-fej">
                <h2>Idővonal</h2>
              </div>
              <div className="belso" style={{ paddingTop: 0 }}>
                <ol className="idovonal halk">
                  {d.timeline
                    .slice()
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((h, i) => (
                      <li key={i}>
                        {h.text}{' '}
                        <span className="halvany">
                          · {idopont(h.at, t)}
                          {h.by ? ` · ${h.by.firstName}` : ''}
                        </span>
                      </li>
                    ))}
                </ol>
                {nyitott && (
                  <div className="masik-teendo" style={{ marginTop: 14 }}>
                    <span className="halvany kicsi">Ha nem kell tovább:</span>
                    <button className="gomb-sz" onClick={() => setLezar(true)}>
                      Lezárom
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <LezarFiok d={d} nyitva={lezar} bezar={() => setLezar(false)} frissit={frissit} />
    </>
  );
}

// ---------- the one-line "now" band ----------
function MostSav({ d, sajatKonyvelo, konyveloUtonev, most }: { d: TeamAssistDetailP; sajatKonyvelo: boolean; konyveloUtonev: string; most: number }) {
  const szoveg: Record<string, string> = {
    visszahivas_kerve: 'Hívd fel az ügyfelet, beszéld meg a lépéseket, és pipáld ki a hívás listáját.',
    egyeztetve:
      d.readyForUjegyke === false
        ? `Az ügyfélre várunk: ${(d.notReadyReasons ?? []).join(', ')}. Utána ${sajatKonyvelo ? 'küldd be' : `${konyveloUtonev} beküldi`} az UJEGYKE-t meghatalmazottként.`
        : sajatKonyvelo
          ? 'Küldd be az UJEGYKE-t meghatalmazottként, a saját ONYA-profilodból.'
          : `${konyveloUtonev} küldi be az UJEGYKE-t meghatalmazottként.`,
    meghatalmazas_bekuldve: 'Az ügyfél jóváhagyására várunk az ONYA-ban. Ha a határidő napján délig nincs meg, hívd fel.',
    meghatalmazas_lejart: sajatKonyvelo ? 'A NAV törölte a jóvá nem hagyott meghatalmazást: küldd be újra.' : `A NAV törölte a jóvá nem hagyott meghatalmazást: ${konyveloUtonev} újra beküldi.`,
    meghatalmazas_jovahagyva: sajatKonyvelo
      ? 'Az ügyfél jelezte, hogy jóváhagyta. Nézd meg az ONYA-ban: ha él, „Él a meghatalmazás”; ha nem él (a NAV törölte), „Nem él – a NAV törölte”.'
      : `Az ügyfél jelezte, hogy jóváhagyta. ${konyveloUtonev} ellenőrzi az ONYA-ban.`,
    meghatalmazas_el: 'Él a meghatalmazás. Az ügyfél az appban átnézi az adatait, és engedélyezi a bejelentést.',
    ugyfel_engedelyezte: sajatKonyvelo ? 'Az ügyfél engedélyezte: küldd be a bejelentést a Vállalkozói Ügysegédben, pontosan az engedélyezett adatokkal.' : `Az ügyfél engedélyezte. ${konyveloUtonev} beküldi a bejelentést.`,
    bejelentes_bekuldve: 'Beküldtük. A csapat átnézi az értesítést (négy szem elve: nem az, aki beküldte), és rögzíti az adószámot.',
    kesz: d.kind === 'meghatalmazas' ? `Kész: él a meghatalmazás, ${konyveloUtonev} intézheti az ügyfél adóügyeit.` : 'Kész: elindult a vállalkozása. A kamarai regisztrációt az ügyfél maga intézi.',
    visszavonva: 'Az ügyfél lemondta: magától intézi. A saját útmutatója újra ott van neki.',
    lezarva: 'Lezártuk.',
  };
  if (valtozasFajta(d.kind)) {
    const rovid = valtozasRovid(d.change);
    Object.assign(szoveg, {
      visszahivas_kerve: 'Hívd fel az ügyfelet: előbb beszélni szeretne. Pipáld ki a hívás listáját.',
      dijra_var: `Díjra vár: az ügyfél még nem fizette ki a díjat${d.feeCharge ? ` (${ft(d.feeCharge.amountHuf)})` : ''}. Előre fizetendő – addig ne kezdj bele.`,
      egyeztetve: sajatKonyvelo
        ? `Nézd át az új adatokat (${rovid ?? 'még nincsenek meg'}), pipáld ki a listát, és kérj engedélyt az ügyféltől.`
        : `${konyveloUtonev} átnézi az új adatokat, és engedélyt kér az ügyféltől.`,
      meghatalmazas_el: 'Az ügyfél az appban átnézi, mit jelentünk be, és engedélyezi.',
      ugyfel_engedelyezte: sajatKonyvelo
        ? 'Az ügyfél engedélyezte: küldd be meghatalmazottként, pontosan ezekkel az adatokkal, és töltsd fel a NAV-értesítést.'
        : `Az ügyfél engedélyezte. ${konyveloUtonev} beküldi meghatalmazottként.`,
      bejelentes_bekuldve: 'Beküldve. Négy szem elve: a csapat (vagy a tulajdonos) nézi át a NAV-értesítést, és zárja le – nem az, aki beküldte.',
      kesz: 'Kész: a NAV elfogadta. Az utómunkát lent pipálja a könyvelő.',
    });
  }
  const nyitott = nyitottAssist(d.status);
  return (
    <div className={`lap most-sav${nyitott ? '' : ' lezart'}`}>
      <span className="kicsi felkover most-felirat">{nyitott ? 'Most' : 'Vége'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{szoveg[d.status]}</div>
      {nyitott && d.nextDue && (
        <div className="sor-flex" style={{ gap: 8, flex: 'none' }}>
          <span className="halvany kicsi">{d.nextDue.what}</span>
          <HataridoCimke at={d.nextDue.at} overdue={d.nextDue.overdue} most={most} />
        </div>
      )}
    </div>
  );
}

// ---------- 1. client + filing data + what the client approved ----------
function AdatokOszlop({ d, szerep, onKartya }: { d: TeamAssistDetailP; szerep: string; onKartya: (c: TeamClientCard) => void }) {
  const [mutat, setMutat] = useState(false);
  const f = d.filingData;
  const t = today();
  const latja = szerep !== 'csapat' && !!f?.adoazonositoJel;
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="lap">
        <div className="lap-fej">
          <I3 n="fiok" s={36} />
          <h2>Ügyfél</h2>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          <UgyfelKartya c={d.clientCard} rejtsAssist onFrissult={onKartya} />
        </div>
      </div>
      {valtozasFajta(d.kind) && (
        <>
          <ValtozasDij d={d} />
          <ValtozasAdatok d={d} />
        </>
      )}
      {!valtozasFajta(d.kind) && (
      <div className="lap">
        <div className="lap-fej">
          <I3 n="igazolas" s={36} />
          <h2>Adatok a beküldéshez</h2>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          {!f ? (
            <p className="halvany">Még nincs meg az ügyfél neve és adóazonosító jele. Az appban a „Rólad” lapon adja meg.</p>
          ) : (
            <>
              <p className="halvany kicsi" style={{ marginBottom: 10 }}>Pontosan így, ahogy a NAV nyilvántartja: az eltérő adatot a NAV nem tudja feldolgozni.</p>
              <dl className="adatok keskeny-adatok bekuldes-adatok">
                <Sor cim="Képviselt neve">
                  <span>{f.name}</span> <Masol ertek={f.name} />
                </Sor>
                <Sor cim="Adóazonosító jel">
                  {latja && !f.adoazonositoJel ? (
                    <>
                      <span className="szam">–</span>
                      <div className="sugo">Még nem adta meg (az appban, az „Adataid” lapon). Addig az UJEGYKE nem küldhető be.</div>
                    </>
                  ) : latja ? (
                    <>
                      <span className="szam">{mutat ? f.adoazonositoJel : f.adoazonositoJelMasked}</span>{' '}
                      {mutat ? (
                        <Masol ertek={f.adoazonositoJel!} />
                      ) : (
                        <button type="button" className="gomb-m kicsi csak-szoveg" onClick={() => setMutat(true)}>
                          Mutasd
                        </button>
                      )}
                      <div className="sugo">A megnyitást naplózzuk.</div>
                    </>
                  ) : (
                    <>
                      <span className="szam">{f.adoazonositoJelMasked || '–'}</span>
                      <div className="sugo">{f.adoazonositoJelMasked ? 'Teljes egészében csak a könyvelője látja.' : 'Még nem adta meg (az appban, az „Adataid” lapon).'}</div>
                    </>
                  )}
                </Sor>
                <Sor cim="Jogcím">{ASSIST_JOGCIM_LABELS[f.jogcim]}</Sor>
                <Sor cim="Ügycsoportok">
                  <ul className="ugycsoportok">
                    {f.ugycsoportok.map((u) => (
                      <li key={u}>
                        <span>{u}</span> <Masol ertek={u} />
                      </li>
                    ))}
                  </ul>
                </Sor>
                <Sor cim="Időbeli hatály">Kezdete: a beküldés napja · Vége: üres</Sor>
              </dl>
            </>
          )}
        </div>
      </div>
      )}
      {d.kind === 'vallalkozas_bejelentes' && (
        <div className="lap">
          <div className="lap-fej">
            <I3 n="befizetve_jel" s={28} />
            <h2>Amit az ügyfél engedélyezett</h2>
          </div>
          <div className="belso" style={{ paddingTop: 0 }}>
            {!d.consentSnapshot ? (
              <p className="halvany">
                Még nem engedélyezte a bejelentést. Az appban akkor teheti meg, ha a kérdőív kész, és minden tevékenységnek van ÖVTJ-sora. Addig nem lehet beküldeni.
              </p>
            ) : (
              <>
                {d.answersMatchConsent === false && (
                  <div className="uzenet-sav hiba" style={{ marginBottom: 12 }}>
                    <b>A kérdőív változott az engedély óta – új engedély kell.</b>
                  </div>
                )}
                <p className="halvany kicsi" style={{ marginBottom: 10 }}>
                  Engedélyezte: {idopont(d.consentSnapshot.at, t)} · szövegváltozat {d.consentSnapshot.version}. Pontosan ezekkel az adatokkal küldd be.
                </p>
                <dl className="adatok keskeny-adatok">
                  {d.consentSnapshot.blocks.map((b) => (
                    <Sor key={b.title} cim={b.title}>
                      {b.lines.map((l, i) => (
                        <div key={i}>{l}</div>
                      ))}
                    </Sor>
                  ))}
                </dl>
              </>
            )}
          </div>
        </div>
      )}
      {d.kind === 'vallalkozas_bejelentes' && d.registrationId && <Kerdoiv d={d} szerep={szerep} />}
    </div>
  );
}

/** The client's questionnaire answers, read-only (csapat/admin: the team pipeline; the accountant: his read-only view). */
function Kerdoiv({ d, szerep }: { d: TeamAssistDetailP; szerep: string }) {
  const q = useQuery({
    queryKey: ['team', 'assist-registration', d.registrationId, szerep],
    queryFn: async () => (szerep === 'konyvelo' ? (await ep.accClientRegistration(d.client.id)).registration : await ep.teamRegistration(d.registrationId!)),
  });
  const a: BusinessRegistrationAnswers | undefined = q.data?.answers;
  return (
    <div className="lap">
      <div className="lap-fej">
        <I3 n="irat" s={36} />
        <h2>Kérdőív</h2>
        {szerep !== 'konyvelo' && (
          <Link className="gomb-sz jobbra" to={`/vallalkozas-inditas/${d.registrationId}`} title="Szerkesztés a Vállalkozás-indításban">
            Javítom
          </Link>
        )}
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {q.isPending ? (
          <p className="halvany">Töltöm…</p>
        ) : !a ? (
          <p className="halvany">A kérdőív most nem tölthető be.</p>
        ) : (
          <dl className="adatok keskeny-adatok">
            <Sor cim="Tevékenység">
              {a.activities.length === 0 ? (
                <span className="halvany">Még nem választott.</span>
              ) : (
                a.activities.map((x, i) => (
                  <div key={i}>
                    {x.ovtjKod ? <span className="szam">{x.ovtjKod} – </span> : <span className="cimke figyel">ÖVTJ-sor kell</span>} {x.ovtjNev ?? x.label}
                    {x.main && <span className="halvany kicsi"> (fő)</span>}
                  </div>
                ))
              )}
              {a.activityFreeText && <div className="halvany kicsi">Saját szavaival: „{a.activityFreeText}”</div>}
            </Sor>
            <Sor cim="Székhely">
              {a.seat ? (
                <>
                  {SEAT_KIND_LABELS[a.seat.kind]}
                  {a.seat.address && (
                    <div>
                      {a.seat.address.zip} {a.seat.address.city}, {a.seat.address.line}
                    </div>
                  )}
                </>
              ) : (
                '–'
              )}
            </Sor>
            <Sor cim="Telephely">{a.otherSites.length === 0 ? 'Nincs' : a.otherSites.map((s, i) => <div key={i}>{`${s.address.zip} ${s.address.city}, ${s.address.line}`}</div>)}</Sor>
            <Sor cim="Munkavégzés">{a.workKind ? WORK_KIND_LABELS[a.workKind] : '–'}</Sor>
            <Sor cim="Bevétel">{a.revenueBand ? REVENUE_BAND_LABELS[a.revenueBand] : '–'}</Sor>
            <Sor cim="Nyilatkozat">{a.declarations ? `Kizáró ok nincs, más élő vállalkozása nincs (${datum(a.declarations.acceptedAt.slice(0, 10))}, az ügyfél tette)` : <span className="halvany">Még nem nyilatkozott.</span>}</Sor>
          </dl>
        )}
      </div>
    </div>
  );
}

// ---------- 2. steps ----------
function LepesekOszlop({
  d,
  szerep,
  sajatKonyvelo,
  konyveloUtonev,
  frissit,
  most,
}: {
  d: TeamAssistDetailP;
  szerep: 'csapat' | 'konyvelo' | 'admin';
  sajatKonyvelo: boolean;
  konyveloUtonev: string;
  frissit: (d: TeamAssistDetailP) => void;
  most: number;
}) {
  const pir = usePirito();
  // Ticked items as the server has them + the ticks not saved yet (optimistic). Quick ticks are collected and saved
  // in one PATCH 400 ms after the last one, so ticking a whole list never waits for the network.
  const szerverPipak = useMemo(() => d.checklist.flatMap((p) => p.items.filter((i) => i.done).map((i) => i.item)), [d.checklist]);
  const [pipak, setPipak] = useState<AssistCheckItem[]>(szerverPipak);
  const fuggo = useRef(new Map<AssistCheckItem, boolean>());
  const idozito = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pipa = useMutation({
    mutationFn: (check: { item: AssistCheckItem; done: boolean }[]) => ep.teamPatchAssist(d.id, { check }),
    onSuccess: (r) => {
      if (fuggo.current.size === 0) frissit(r);
    },
    onError: (e) => {
      fuggo.current.clear();
      setPipak(szerverPipak);
      pir.hiba(e);
    },
  });
  useEffect(() => {
    if (fuggo.current.size === 0 && !pipa.isPending) setPipak(szerverPipak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [szerverPipak]);
  useEffect(() => () => {
    if (idozito.current) clearTimeout(idozito.current);
  }, []);
  const pipal = (item: AssistCheckItem, done: boolean) => {
    setPipak((p) => (done ? [...p.filter((x) => x !== item), item] : p.filter((x) => x !== item)));
    fuggo.current.set(item, done);
    if (idozito.current) clearTimeout(idozito.current);
    idozito.current = setTimeout(() => {
      const check = [...fuggo.current].map(([i, v]) => ({ item: i, done: v }));
      fuggo.current.clear();
      if (check.length) pipa.mutate(check);
    }, 400);
  };
  const kornyezet = (phase: AssistCheckPhase): MuveletKornyezet => ({
    status: d.status,
    kind: d.kind,
    szerep,
    sajatKonyvelo,
    allowed: d.allowedActions,
    hianyzo: hianyzoPipak(d.kind, phase, pipak).length,
    konyveloUtonev,
    answersMatchConsent: d.answersMatchConsent,
    notReady: d.readyForUjegyke === false ? (d.notReadyReasons ?? []) : [],
    zarolva: d.serviceLocked ? LOCK_TEXTS.panelDisabled : null,
  });
  const valt = valtozasFajta(d.kind);
  const akt = aktivFazis(d.status, d.kind);
  // The phase whose list stays open: the current one, or the UJEGYKE phase while we wait for / check the approval.
  const nyitvaFazis = akt ?? (d.status === 'meghatalmazas_bekuldve' || d.status === 'meghatalmazas_jovahagyva' ? 'ujegyke' : null);
  const ujegykeIdo = d.approval?.filedAt ?? d.timeline.filter((h) => h.action === 'assist.ujegyke_filed').sort((a, b) => b.at.localeCompare(a.at))[0]?.at ?? null;
  const jovahagyasAlatt = d.status === 'meghatalmazas_bekuldve' || d.status === 'meghatalmazas_lejart' || d.status === 'meghatalmazas_jovahagyva';
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="lap">
        <div className="belso">
          <div className="uzenet-sav figyel szabaly">
            <I3 n="lakat" s={28} />
            <div>
              <b>Belépési adat soha.</b> {SOHA_BELEPES}
            </div>
          </div>
          <details className="osszevont kezikonyv" style={{ marginTop: 12 }}>
            <summary>{valt ? CHANGE_HANDBOOK.title : 'Így küldd be meghatalmazottként'}</summary>
            {valt ? <ValtozasKezikonyv kind={d.kind} /> : <Kezikonyv kind={d.kind} />}
          </details>
        </div>
      </div>
      {d.serviceLocked && (
        <div className="uzenet-sav hiba">
          <I3 n="lakat" s={28} />
          <div>
            <b>Zárolva:</b> {LOCK_TEXTS.panelDisabled} Olvasni és üzenni lehet, beküldeni nem.
          </div>
        </div>
      )}
      {jovahagyasAlatt && ujegykeIdo && <JovahagyasIdozito d={d} filedAt={ujegykeIdo} most={most} />}
      {fazisok(d.kind, { status: d.status, checklistPhases: d.checklist.map((c) => c.phase) }).map((phase, i) => {
        const kesz = fazisKesz(phase, d.status);
        const aktiv = akt === phase;
        const pipalhat =
          nyitottAssist(d.status) && !kesz && (phase === 'hivas' ? szerep !== 'konyvelo' || sajatKonyvelo : szerep === 'admin' || sajatKonyvelo) && (aktiv || phase !== 'hivas');
        return (
          <div key={phase} className={`lap fazis${aktiv ? ' aktiv' : ''}${kesz ? ' kesz' : ''}`}>
            <div className="lap-fej">
              <span className={`szam-korong${kesz ? ' kesz' : aktiv ? '' : ' var'}`}>{kesz ? <I3 n="befizetve_jel" s={28} /> : i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <h2>{FAZIS_CIM[phase]}</h2>
                <div className="halvany kicsi">{FAZIS_KI[phase]}</div>
              </div>
              <span className={`cimke jobbra-cimke${aktiv ? ' info' : ''}`}>{kesz ? 'Kész' : aktiv ? 'Most ez jön' : 'Később'}</span>
            </div>
            <div className="belso oszlop" style={{ paddingTop: 0, gap: 8 }}>
              {phase !== nyitvaFazis ? (
                <details className="osszevont fazis-pontok">
                  <summary>
                    {fazisElemek(d.kind, phase).filter((i) => pipak.includes(i)).length}/{fazisElemek(d.kind, phase).length} pont
                  </summary>
                  <div className="oszlop" style={{ gap: 8, marginTop: 10 }}>
                    <Pontok d={d} phase={phase} pipak={pipak} />
                  </div>
                </details>
              ) : null}
              {phase === 'ujegyke' && d.readyForUjegyke === false && (d.status === 'egyeztetve' || d.status === 'meghatalmazas_lejart') ? (
                <div className="uzenet-sav figyel">
                  <div>
                    <b>Előbb az ügyfélnek:</b> {(d.notReadyReasons ?? []).join(', ')}. Amíg ez nincs meg, ne küldd be az UJEGYKE-t a NAV-nál: itt nem tudnánk rögzíteni (nem
                    menne emlékeztető, és nem indulna a 4 napos óra).
                  </div>
                </div>
              ) : null}
              {phase === nyitvaFazis && fazisElemek(d.kind, phase).map((item) => {
                const sz = d.checklist.find((p) => p.phase === phase)?.items.find((x) => x.item === item);
                const be = pipak.includes(item);
                return (
                  <label key={item} className="jelolo">
                    <input type="checkbox" checked={be} disabled={!pipalhat} onChange={(e) => pipal(item, e.target.checked)} />
                    <span>
                      {ASSIST_CHECK_LABELS[item]}
                      {sz?.done && sz.by && (
                        <span className="halvany kicsi">
                          {' '}
                          · {sz.by.firstName}
                          {sz.doneAt ? `, ${idopont(sz.doneAt, today())}` : ''}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
              {phase === nyitvaFazis && !pipalhat && nyitottAssist(d.status) && !kesz && phase !== 'hivas' && !(szerep === 'admin' || sajatKonyvelo) && (
                <p className="sugo" style={{ margin: 0 }}>Ezt a listát {konyveloUtonev} pipálja, a saját belépésével végzett munka közben.</p>
              )}
              <FazisGombok d={d} phase={phase} k={kornyezet(phase)} pipak={pipak} frissit={frissit} />
            </div>
          </div>
        );
      })}
      {valt && <ValtozasUtomunka d={d} szerep={szerep} frissit={frissit} />}
      {(d.status === 'bejelentes_bekuldve' || (d.status === 'kesz' && d.kind === 'vallalkozas_bejelentes')) && d.registrationId && (
        <div className="uzenet-sav info">
          <div>
            <b>Átnézés és adószám:</b> a Vállalkozás-indításban. Négy szem elve: a NAV-os értesítést más nézi át, mint aki beküldte.{' '}
            {szerep !== 'konyvelo' && <Link to={`/vallalkozas-inditas/${d.registrationId}`}>Megnyitom</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

/** The read-only list of a collapsed phase (who ticked what, when). */
function Pontok({ d, phase, pipak }: { d: TeamAssistDetailP; phase: AssistCheckPhase; pipak: AssistCheckItem[] }) {
  return (
    <>
      {fazisElemek(d.kind, phase).map((item) => {
        const sz = d.checklist.find((p) => p.phase === phase)?.items.find((x) => x.item === item);
        return (
          <label key={item} className="jelolo">
            <input type="checkbox" checked={pipak.includes(item)} disabled readOnly />
            <span>
              {ASSIST_CHECK_LABELS[item]}
              {sz?.done && sz.by && (
                <span className="halvany kicsi">
                  {' '}
                  · {sz.by.firstName}
                  {sz.doneAt ? `, ${idopont(sz.doneAt, today())}` : ''}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </>
  );
}

function JovahagyasIdozito({ d, filedAt, most }: { d: TeamAssistDetailP; filedAt: string; most: number }) {
  const t = today();
  const iz = jovahagyasIdozito(filedAt, most);
  const jovahagyta = d.approval?.clientApprovedAt ?? d.timeline.find((h) => h.action === 'assist.client_approved')?.at ?? null;
  return (
    <div className={`lap idozito${d.status === 'meghatalmazas_lejart' ? ' lejart' : ''}`}>
      <div className="lap-fej">
        <I3 n="hataridok" s={36} />
        <h2>Jóváhagyás – 4 nap</h2>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {d.status === 'meghatalmazas_jovahagyva' ? (
          <p>
            <b>Az ügyfél jóváhagyta</b>
            {jovahagyta ? ` (${idopont(jovahagyta, t)})` : ''}. Most nézd meg az ONYA-ban, hogy él-e (kb. 20 perc után látszik).
          </p>
        ) : d.status === 'meghatalmazas_lejart' ? (
          <p>
            <b>Lejárt.</b> A NAV a 4. nap végén törölte a jóvá nem hagyott meghatalmazást. Újra be kell küldeni: új 4 nap indul. Szankció nincs.
          </p>
        ) : (
          <p>{iz.szoveg}</p>
        )}
        {d.status !== 'meghatalmazas_jovahagyva' && (
          <div className="sav" aria-hidden="true">
            <i className={iz.arany > 0.74 ? 'veszes' : ''} style={{ width: `${iz.arany * 100}%` }} />
          </div>
        )}
        <dl className="adatok keskeny-adatok" style={{ marginTop: 6 }}>
          <Sor cim="Beküldve">{idopont(filedAt, t)}</Sor>
          {d.approvalDueOn && <Sor cim="Ügyfélnek">{datum(d.approvalDueOn)} – ezt mondtuk neki (egy nap tartalék)</Sor>}
          <Sor cim="A NAV törli">{idopont(d.approval?.expiresAt ?? iz.navTorli, t)}</Sor>
          {d.approval && <Sor cim="Emlékeztető">{d.approval.remindersSent} elküldve (legfeljebb 3)</Sor>}
          {!!d.approval?.expiredCount && <Sor cim="Korábban">{d.approval.expiredCount}× lejárt, újraküldtük</Sor>}
        </dl>
        <p className="halvany kicsi" style={{ marginTop: 8 }}>
          Az ügyfél értesítést kap a beküldéskor, másnap és a határidő napján reggel. Ha a határidő napján délig nem hagyja jóvá, a gazdájának és a könyvelőnek is szólunk: ilyenkor hívd fel.
        </p>
      </div>
    </div>
  );
}

function FazisGombok({ d, phase, k, pipak, frissit }: { d: TeamAssistDetailP; phase: AssistCheckPhase; k: MuveletKornyezet; pipak: AssistCheckItem[]; frissit: (d: TeamAssistDetailP) => void }) {
  const pir = usePirito();
  const [jogcim, setJogcim] = useState<AssistJogcim>((d.filingData?.jogcim ?? ASSIST_UJEGYKE_JOGCIM_DEFAULT) as AssistJogcim);
  const [fajl, setFajl] = useState<File | null>(null);
  const [napja, setNapja] = useState(today());
  const [adoszam, setAdoszam] = useState('');
  const [nyilv, setNyilv] = useState('');
  const fajlRef = useRef<HTMLInputElement>(null);
  const elemek = (ph: AssistCheckPhase) => fazisElemek(d.kind, ph).filter((i) => pipak.includes(i));
  const fut = useMutation({
    mutationFn: async (m: PanelMuvelet) => {
      if (m === 'egyeztetve') return ep.teamAssistAgreed(d.id, { items: elemek('hivas') });
      if (m === 'ujegyke_bekuldve') return ep.teamAssistUjegyke(d.id, { items: elemek('ujegyke'), jogcim });
      if (m === 'lejart') return ep.teamAssistExpired(d.id);
      if (m === 'meghatalmazas_el') return ep.teamAssistMhLive(d.id);
      if (m === 'adatok_rendben') return ep.teamAssistChangeReady(d.id);
      if (m === 'valtozas_kesz') return ep.teamAssistChangeDone(d.id, {});
      if (m === 'valtozas_bekuldve') return ep.teamAssistEvFiled(d.id, fajl!, { items: elemek('valtozas_bejelentes'), filedOn: napja });
      return ep.teamAssistEvFiled(d.id, fajl!, {
        items: elemek('bejelentes'),
        filedOn: napja,
        adoszam: adoszamEllenor(adoszam).ertek ?? undefined,
        evNyilvantartasiSzam: nyilv.trim() || undefined,
      });
    },
    onSuccess: (r, m) => {
      frissit(r);
      pir.ok(
        m === 'egyeztetve'
          ? `Elindítottad. ${utonev(d.accountant?.name)} értesítést kapott, az ügyfél is.`
          : m === 'ujegyke_bekuldve'
            ? 'Rögzítetted. Az ügyfél értesítést kapott: 4 napja van jóváhagyni.'
            : m === 'lejart'
              ? 'Lejártnak jelölted. Az ügyfél és a könyvelő értesítést kapott.'
              : m === 'meghatalmazas_el'
                ? d.kind === 'meghatalmazas'
                  ? 'Kész: él a meghatalmazás.'
                  : 'Él a meghatalmazás. Az ügyfél értesítést kapott: most engedélyezheti a bejelentést.'
                : m === 'adatok_rendben'
                  ? 'Engedélyt kértél. Az ügyfél értesítést kapott: „Nézd át, mit jelentünk be”.'
                  : m === 'valtozas_bekuldve'
                    ? 'Rögzítetted a beküldést. A csapat átnézi a NAV-értesítést, és lezárja.'
                    : m === 'valtozas_kesz'
                      ? 'Lezártad. Az ügyfél értesítést kapott; az utómunka a könyvelőnél van.'
                      : 'Rögzítetted a bejelentést. A csapat átnézi, és rögzíti az adószámot.',
      );
    },
    onError: pir.hiba,
  });
  const gomb = (m: PanelMuvelet, felirat: string, fo = true, extra = true) => {
    const a = muveletAllapot(m, k);
    if (!a) return null;
    return (
      <div className="oszlop" style={{ gap: 4 }} key={m}>
        <div className="gombsor">
          <button className={fo ? 'gomb-e' : 'gomb-m csak-szoveg'} disabled={!a.mehet || !extra || fut.isPending} onClick={() => fut.mutate(m)}>
            {felirat}
          </button>
        </div>
        {a.miert && <span className="sugo" style={{ marginTop: 0 }}>{a.miert}</span>}
      </div>
    );
  };
  if (phase === 'hivas') return gomb('egyeztetve', 'Egyeztettünk – elindítom');
  if (phase === 'valtozas_adatok') return gomb('adatok_rendben', CHANGE_HANDBOOK.changeReady);
  if (phase === 'valtozas_bejelentes') {
    const vb = muveletAllapot('valtozas_bekuldve', k);
    const tiltV = !!vb && !vb.mehet && !(vb.miert ?? '').startsWith('Még ');
    return (
      <div className="oszlop" style={{ gap: 12, marginTop: 6 }}>
        {vb && (
          <div className="mezosor k2">
            <label className="mezo">
              <span className="felirat">A NAV-értesítés (PDF vagy kép)</span>
              <input ref={fajlRef} type="file" accept="application/pdf,image/*" className="rejtett" disabled={tiltV} onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
              <button type="button" className="gomb-m kicsi" disabled={tiltV} onClick={() => fajlRef.current?.click()}>
                <I3 n="feltoltes" s={22} />
                {fajl ? 'Másik fájl' : 'Kiválasztom'}
              </button>
              {fajl && <span className="sugo">{fajl.name}</span>}
            </label>
            <label className="mezo">
              <span className="felirat">Beküldés napja</span>
              <input className="doboz" type="date" value={napja} max={today()} disabled={tiltV} onChange={(e) => setNapja(e.target.value)} />
            </label>
          </div>
        )}
        {gomb('valtozas_bekuldve', CHANGE_HANDBOOK.evFiled, true, !!fajl && !!napja)}
        {vb?.mehet && !fajl && <span className="sugo" style={{ marginTop: -6 }}>Előbb válaszd ki a letöltött értesítést.</span>}
        {gomb('valtozas_kesz', CHANGE_HANDBOOK.changeDone)}
      </div>
    );
  }
  if (phase === 'ujegyke') {
    const be = muveletAllapot('ujegyke_bekuldve', k);
    return (
      <div className="oszlop" style={{ gap: 12, marginTop: 6 }}>
        {be && (
          <label className="mezo" style={{ maxWidth: 360 }}>
            <span className="felirat">A képviselet jogcíme</span>
            <Lenyilo value={jogcim} onChange={(e) => setJogcim(e.target.value as AssistJogcim)} disabled={!be.mehet && !!be.miert && be.miert.startsWith('Ezt csak')}>
              {ASSIST_JOGCIMEK.map((j) => (
                <option key={j} value={j}>
                  {ASSIST_JOGCIM_LABELS[j]}
                </option>
              ))}
            </Lenyilo>
          </label>
        )}
        {gomb('ujegyke_bekuldve', d.status === 'meghatalmazas_lejart' ? 'Újra beküldtem az UJEGYKE-t' : 'Beküldtem az UJEGYKE-t')}
        {gomb('meghatalmazas_el', d.kind === 'meghatalmazas' ? 'Él a meghatalmazás – kész' : 'Él a meghatalmazás', d.status === 'meghatalmazas_jovahagyva')}
        {lejartJovahagyas(d, today()) && gomb('lejart', 'Lejárt – újra kell küldeni', false)}
        {d.status === 'meghatalmazas_jovahagyva' && gomb('lejart', 'Nem él – a NAV törölte', false)}
      </div>
    );
  }
  const be = muveletAllapot('bejelentes_bekuldve', k);
  if (!be) return null;
  const ell = adoszam.trim() ? adoszamEllenor(adoszam) : null;
  const nyilvHiba = nyilv.trim() && !nyilvantartasiSzamOk(nyilv) ? 'Nyolc számjegy.' : null;
  const tilt = !be.mehet && !(be.miert ?? '').startsWith('Még ');
  return (
    <div className="oszlop" style={{ gap: 12, marginTop: 6 }}>
      <div className="mezosor">
        <label className="mezo">
          <span className="felirat">A NAV-os értesítés (PDF vagy kép)</span>
          <input ref={fajlRef} type="file" accept="application/pdf,image/*" className="rejtett" disabled={tilt} onChange={(e) => setFajl(e.target.files?.[0] ?? null)} />
          <button type="button" className="gomb-m kicsi" disabled={tilt} onClick={() => fajlRef.current?.click()}>
            <I3 n="feltoltes" s={22} />
            {fajl ? 'Másik fájl' : 'Kiválasztom'}
          </button>
          {fajl && <span className="sugo">{fajl.name}</span>}
        </label>
        <label className="mezo">
          <span className="felirat">Beküldés napja</span>
          <input className="doboz" type="date" value={napja} max={today()} disabled={tilt} onChange={(e) => setNapja(e.target.value)} />
          <span className="sugo">Ez a vállalkozás kezdete.</span>
        </label>
      </div>
      <div className="mezosor">
        <label className="mezo">
          <span className="felirat">Adószám (ha már látod)</span>
          <input className={`doboz${ell?.hiba ? ' hibas' : ''}`} value={adoszam} placeholder="12345678-1-23" disabled={tilt} onChange={(e) => setAdoszam(e.target.value)} />
          {ell?.hiba && <span className="hiba-szoveg">{ell.hiba}</span>}
          {ell?.figyelmeztetes && <span className="sugo" style={{ color: '#5E3B00' }}>{ell.figyelmeztetes}</span>}
        </label>
        <label className="mezo">
          <span className="felirat">Nyilvántartási szám (ha megvan)</span>
          <input className={`doboz${nyilvHiba ? ' hibas' : ''}`} value={nyilv} placeholder="8 számjegy" disabled={tilt} onChange={(e) => setNyilv(e.target.value)} />
          {nyilvHiba && <span className="hiba-szoveg">{nyilvHiba}</span>}
        </label>
      </div>
      {gomb('bejelentes_bekuldve', 'Beküldtem a bejelentést', true, !!fajl && !!napja && !ell?.hiba && !nyilvHiba)}
      {be.mehet && !fajl && <span className="sugo" style={{ marginTop: -6 }}>Előbb válaszd ki a letöltött értesítést.</span>}
    </div>
  );
}

function Kezikonyv({ kind }: { kind: AssistKind }) {
  return (
    <div className="kezikonyv-test">
      <h3 className="kis-cim">Meghatalmazás (UJEGYKE) – ONYA</h3>
      <ol>
        <li>onya.nav.gov.hu – a saját belépéseddel (Ügyfélkapu+ vagy DÁP), a saját profilodat választod.</li>
        <li>Új nyomtatvány → Meghatalmazások → UJEGYKE → Kiválaszt → szerep: „Meghatalmazott”.</li>
        <li>„Új bejelentés” – a te adataid képviselőként előre kitöltve.</li>
        <li>Képviselt: név és adóazonosító jel pontosan úgy, ahogy a NAV nyilvántartja (másold innen).</li>
        <li>Jogcím; Kezdete: ma; Vége: üres; ügycsoportok: ADÓÜGYEK (kivéve egyes jövedéki ügyek){kind === 'vallalkozas_bejelentes' ? ' + UJEGYKE-5 „Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)”' : ''}.</li>
        <li>„Ellenőrzés és benyújtás” – a „J08 – A meghatalmazó jóváhagyása szükséges” figyelmeztetés csak tájékoztat → „Tovább”.</li>
        <li>„Sikeres benyújtás!”</li>
        <li>A Meghatalmazások listádban a csempe: „VÉGLEGESÍTVE / Jóváhagyásra vár”. Az ügyfélnek 4 naptári napja van jóváhagyni.</li>
      </ol>
      {kind === 'vallalkozas_bejelentes' && (
        <>
          <h3 className="kis-cim" style={{ marginTop: 12 }}>Vállalkozás bejelentése – Vállalkozói Ügysegéd</h3>
          <ol>
            <li>Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó: „Más ügyében járok el” → az ügyfél.</li>
            <li>„Egyéni vállalkozói tevékenység elkezdése” – a 6 lapot pontosan az ügyfél engedélyezett adataival töltöd ki.</li>
            <li>„Bejelentés megtétele” → „Figyelem!” → „Sikeres bejelentés”.</li>
            <li>Bejelentéseim, kérelmeim → Megtekintés → Letöltés → itt feltöltöd.</li>
          </ol>
          <p className="halvany kicsi">A nyilatkozatokat (kizáró okok) az ügyfél tette meg az appban. Ha bármi eltér az engedélyezett adatoktól, ne küldd be: kérj tőle új engedélyt.</p>
        </>
      )}
    </div>
  );
}

// ---------- 3. note + close ----------
function Jegyzet({ d, frissit }: { d: TeamAssistDetailP; frissit: (d: TeamAssistDetailP) => void }) {
  const pir = usePirito();
  const [jegyzet, setJegyzet] = useState<string | null>(null);
  const [allapot, setAllapot] = useState<'' | 'mentem' | 'mentve'>('');
  const ment = useMutation({
    mutationFn: (v: string) => ep.teamPatchAssist(d.id, { staffNote: v.trim() ? v : null }),
    onMutate: () => setAllapot('mentem'),
    onSuccess: (r) => {
      frissit(r);
      setAllapot('mentve');
    },
    onError: (e) => {
      setAllapot('');
      pir.hiba(e);
    },
  });
  useEffect(() => {
    if (jegyzet === null) return;
    const tm = setTimeout(() => ment.mutate(jegyzet), 900);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jegyzet]);
  return (
    <div className="lap">
      <div className="lap-fej">
        <h2>Belső jegyzet</h2>
        <span className="megj">{allapot === 'mentem' ? 'mentem…' : allapot === 'mentve' ? 'mentve' : 'az ügyfél nem látja'}</span>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        <textarea
          className="doboz"
          rows={3}
          maxLength={2000}
          value={jegyzet ?? d.staffNote ?? ''}
          placeholder="Például: délután ér rá, a jóváhagyáshoz DÁP-ot használ."
          onChange={(e) => setJegyzet(e.target.value)}
        />
        <span className="sugo">Jelszót, kódot, adóazonosítót ne írj ide.</span>
      </div>
    </div>
  );
}

function LezarFiok({ d, nyitva, bezar, frissit }: { d: TeamAssistDetailP; nyitva: boolean; bezar: () => void; frissit: (d: TeamAssistDetailP) => void }) {
  const pir = usePirito();
  const [ok, setOk] = useState<AssistCloseReason | null>(null);
  const [megj, setMegj] = useState('');
  const ment = useMutation({
    mutationFn: () => ep.teamAssistClose(d.id, { reason: ok!, note: megj.trim() || undefined }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Lezártad. Az ügyfél rövid értesítést kapott, és újra a saját útmutatóját látja.');
      setOk(null);
      setMegj('');
      bezar();
    },
    onError: pir.hiba,
  });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      ikon="igazolas"
      cim="Lezárod a kérést?"
      bev={`${d.client.name} · ${kisbetu(ASSIST_KIND_LABELS[d.kind])}`}
      lab={
        <>
          <button className="gomb-e" disabled={!ok || ment.isPending} onClick={() => ment.mutate()}>
            Lezárom
          </button>
          <button className="gomb-sz" onClick={bezar}>
            Mégse
          </button>
        </>
      }
    >
      <div className="oszlop" style={{ gap: 12 }}>
        <div className="valaszto fuggoleges" role="radiogroup" aria-label="Lezárás oka">
          {ASSIST_CLOSE_REASONS.map((r) => (
            <label key={r}>
              <input type="radio" name="assist-lezar" checked={ok === r} onChange={() => setOk(r)} />
              {ASSIST_CLOSE_REASON_LABELS[r]}
            </label>
          ))}
        </div>
        {ok === 'nincs_belepese' && (
          <div className="uzenet-sav info">
            <div>
              A jóváhagyáshoz az ügyfél saját belépése kell. Mondd el neki: DÁP otthon is beállítható, vagy segítenek egy kormányablakban. A vállalkozás bejelentéséhez egy NAV-ügyfélszolgálaton a nyomtatható útmutatóval is elmehet: az app webes változatában az útmutató alján „Mutasd egyben” → „Kinyomtatom az útmutatót”.
            </div>
          </div>
        )}
        <label className="mezo">
          <span className="felirat">Megjegyzés (csak mi látjuk)</span>
          <textarea className="doboz" rows={3} maxLength={1000} value={megj} onChange={(e) => setMegj(e.target.value)} />
        </label>
        {d.status !== 'visszahivas_kerve' && d.status !== 'egyeztetve' && (
          <p className="sugo" style={{ margin: 0 }}>Ha a meghatalmazást már beküldtük, a NAV-nál attól még él vagy jóváhagyásra vár: ha kell, vonja vissza az ügyfél vagy a könyvelő az ONYA-ban.</p>
        )}
      </div>
    </Fiok>
  );
}
