// /vallalkozas-inditas/:id – one client's new business (SPEC §26.3.3, §27.6.4): 1. the answers (editable by the team,
// ÖVTJ codes), 2. guide progress + the uploaded NAV értesítés with the check list, 3. adószám, the client card with the
// branch history. The team itself never files anything at the NAV: the client files with our guide, or – "Intézzük
// helyette" – his accountant as his registered meghatalmazott; whoever filed it never does the check (four eyes).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { BusinessRegistrationAnswers, TeamRegistrationDetail, TeamRegistrationPatch } from '../../api/types';
import { useAuth } from '../../auth/Auth';
import { Fejlec, Fiok, HibaSav, Lenyilo, Toltes } from '../../ui/kozos';
import { I3 } from '../../ui/Icon3d';
import { usePirito } from '../../ui/Pirito';
import {
  FILING_CHANNEL_LABELS,
  REGISTRATION_CHECK_ITEMS,
  REGISTRATION_CHECK_LABELS,
  REGISTRATION_STATUS_LABELS,
  REVENUE_BAND_LABELS,
  REVENUE_BANDS,
  SEAT_KIND_LABELS,
  SEAT_KINDS,
  SEAT_RIGHT_LABELS,
  SEAT_RIGHTS,
  WORK_KIND_LABELS,
  WORK_KINDS,
  type EuPartnerAnswer,
  type RegistrationCheckItem,
  type RegistrationStatus,
  type RevenueBand,
  type SeatKind,
  type SeatRight,
  type StartPlan,
  type WorkKind,
} from '../../_shared/enums';
import { BUSINESS_ACTIVITIES, isValidHuZip, isValidOvtjKod } from '../../_shared/bekotes';
import { adoszamEllenor, hanyNapja, hianyzoEllenorzes, indulasSzoveg, nyilvantartasiSzamOk } from '../../lib/csapat';
import { datum, idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { UjVisszahivasFiok } from './UjVisszahivas';
import { KovetkezoLepes, UgyfelKartya } from './UgyfelKartya';
import { elalltSzoveg } from '../../lib/helyettunk';
import { ASSIST_STATUS_LABELS } from '../../_shared/enums';

/** Panel wording of the filing channel ('meghatalmazott': the shared label speaks to the client). */
function csatorna(ch: keyof typeof FILING_CHANNEL_LABELS): string {
  return ch === 'meghatalmazott' ? 'A könyvelője küldte be, meghatalmazottként' : FILING_CHANNEL_LABELS[ch];
}
/** Who recorded the filing as meghatalmazott (four eyes: that person never checks it, SPEC §27.3.4). */
export function bekuldo(d: { history: { action: string; by: { userId: string } | null }[] }): string | null {
  return d.history.find((h) => h.action === 'assist.ev_filed')?.by?.userId ?? null;
}

/** Numbers from the server ("101 682 Ft") never break across lines. */
const nbsp = (s: string) => s.replace(/(\d) (\d)/g, '$1\u00a0$2').replace(/(\d) (Ft|%)/g, '$1\u00a0$2');

const EU_LABEL: Record<EuPartnerAnswer, string> = { nem: 'Nem', igen: 'Igen', nem_tudom: 'Még nem tudja' };
const SZAMLA_LABEL = (v: boolean | null) => (v === null ? 'Nem válaszolt' : v ? 'Igen, lesz külön számlája' : 'Nem');
const NYITOTT: RegistrationStatus[] = ['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve'];
const ADOSZAM_ALLAPOT: RegistrationStatus[] = ['beadva', 'javitas', 'ellenorizve'];

function cim(a: { zip: string; city: string; line: string } | null | undefined): string {
  return a ? `${a.zip} ${a.city}, ${a.line}` : '–';
}

export default function Regisztracio() {
  const { id = '' } = useParams();
  const { isCsapat } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const pir = usePirito();
  const t = today();
  const q = useQuery({ queryKey: ['team', 'registration', id], queryFn: () => ep.teamRegistration(id) });
  const [szerkeszt, setSzerkeszt] = useState(false);
  const [javitas, setJavitas] = useState(false);
  const [ujHivas, setUjHivas] = useState(false);
  const frissit = (d: TeamRegistrationDetail) => {
    qc.setQueryData(['team', 'registration', id], d);
    void qc.invalidateQueries({ queryKey: ['team', 'registrations'] });
    void qc.invalidateQueries({ queryKey: ['team', 'summary'] });
  };
  const gazda = useMutation({
    mutationFn: (userId: string | null) => ep.teamAssignRegistration(id, { userId }),
    onSuccess: (d, u) => {
      frissit(d);
      pir.ok(u ? 'Magadra vetted.' : 'Leadtad, most nincs gazdája.');
    },
    onError: pir.hiba,
  });
  const { user } = useAuth();

  if (q.isPending) return <Toltes />;
  if (q.isError)
    return (
      <div className="tartalom">
        <HibaSav hiba={q.error} ujra={() => q.refetch()} />
        <p style={{ marginTop: 12 }}>
          <Link to="/vallalkozas-inditas">Vissza a vállalkozás-indításhoz</Link>
        </p>
      </div>
    );
  const d = q.data;
  const cc = d.clientCard;
  const enyem = d.assignee?.userId === user?.id;
  return (
    <>
      <Fejlec
        rozR={380}
        felcim={<Link to="/vallalkozas-inditas">Vissza a vállalkozás-indításhoz</Link>}
        cim={
          <>
            {d.client.name}{' '}
            <span className={`cimke ${d.status === 'beadva' ? 'figyel' : d.status === 'javitas' ? 'hiba' : 'info'}`} style={{ marginLeft: 6 }}>
              {elalltSzoveg(d) ?? REGISTRATION_STATUS_LABELS[d.status]}
            </span>
            {d.mode === 'segitett' && (
              <span className="cimke helyettunk" style={{ marginLeft: 6 }}>
                Intézzük helyette
              </span>
            )}
          </>
        }
        mellek={
          <>
            {d.client.email}
            {cc.accountant && <> · könyvelője {cc.accountant.name}</>}
            {cc.lifecycle === 'bekotes_alatt' ? <KovetkezoLepes c={cc} halvany={false} /> : null}
            <br />
            Ebben az állapotban: {hanyNapja(d.daysInStatus)} ·{' '}
            {/* SPEC §26.1.4: the business starts on the filing day, whatever date was planned. */}
            {d.filedOn ? `a beküldés napján indult: ${datum(d.filedOn, { ev: true })}` : indulasSzoveg(d.startPlan, d.startDate)}
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
            {d.openCallbackId ? (
              <button className="gomb-sav" onClick={() => nav(`/visszahivasok?szuro=mind&nyit=${d.openCallbackId}`)}>
                <I3 n="ora" s={24} />
                Visszahívást kért
              </button>
            ) : (
              <button className="gomb-sav" onClick={() => setUjHivas(true)}>
                <I3 n="ora" s={24} />
                Visszahívás felvétele
              </button>
            )}
          </>
        }
      />
      <div className="tartalom szeles-tartalom">
        {d.mode === 'segitett' && (
          <div className="helyettunk-banner" style={{ marginBottom: 16 }}>
            <I3 n="igazolas" s={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Intézzük helyette.</b> A bejelentést {cc.accountant?.name ?? 'a könyvelője'} küldi be meghatalmazottként, pontosan az ügyfél által engedélyezett adatokkal. Ha itt javítod a kérdőívet, az ügyfélnek újra engedélyeznie kell.
              {cc.assist && (
                <div className="kicsi" style={{ marginTop: 3 }}>
                  Állapot: {ASSIST_STATUS_LABELS[cc.assist.status]} · <Link to={`/helyettunk/${cc.assist.id}`}>Megnyitom a lépéseit</Link>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="racs k3 regisztracio-racs">
          <AdatokOszlop d={d} szerkeszt={() => setSzerkeszt(true)} frissit={frissit} />
          <BejelentesOszlop d={d} frissit={frissit} javitastKer={() => setJavitas(true)} />
          <div className="oszlop" style={{ gap: 16 }}>
            <AdoszamLap d={d} frissit={frissit} />
            <div className="lap">
              <div className="lap-fej">
                <h2>Ügyfél</h2>
              </div>
              <div className="belso" style={{ paddingTop: 0 }}>
                <UgyfelKartya c={cc} onFrissult={() => void q.refetch()} />
              </div>
            </div>
            <div className="lap">
              <div className="lap-fej">
                <h2>Ki foglalkozik vele</h2>
              </div>
              <div className="belso" style={{ paddingTop: 0 }}>
                <p>{d.assignee ? <b>{d.assignee.name}</b> : <span className="halvany">Még senki.</span>}</p>
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
              </div>
            </div>
            <div className="lap">
              <div className="lap-fej">
                <h2>Előzmények</h2>
              </div>
              <div className="belso" style={{ paddingTop: 0 }}>
                <ol className="idovonal halk">
                  {d.history
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
              </div>
            </div>
          </div>
        </div>
      </div>
      <SzerkesztoFiok d={d} nyitva={szerkeszt} bezar={() => setSzerkeszt(false)} frissit={frissit} />
      <JavitasFiok d={d} nyitva={javitas} bezar={() => setJavitas(false)} frissit={frissit} />
      <UjVisszahivasFiok nyitva={ujHivas} bezar={() => setUjHivas(false)} clientId={cc.id} nev={d.client.name} alapTema="vallalkozas_inditas" kesz={() => void q.refetch()} />
    </>
  );
}

// ---------- 1. answers ----------
function Sor({ cim, children }: { cim: string; children: ReactNode }) {
  return (
    <>
      <dt>{cim}</dt>
      <dd>{children}</dd>
    </>
  );
}

function AdatokOszlop({ d, szerkeszt, frissit }: { d: TeamRegistrationDetail; szerkeszt: () => void; frissit: (d: TeamRegistrationDetail) => void }) {
  const a = d.answers;
  const h = d.hints;
  const pir = usePirito();
  const [jegyzet, setJegyzet] = useState(d.staffNote ?? '');
  useEffect(() => setJegyzet(d.staffNote ?? ''), [d.staffNote]);
  const ment = useMutation({
    mutationFn: (v: string) => ep.teamPatchRegistration(d.id, { staffNote: v.trim() ? v.trim() : null }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok('Jegyzet elmentve.');
    },
    onError: pir.hiba,
  });
  const nyitott = NYITOTT.includes(d.status);
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="lap">
        <div className="lap-fej">
          <I3 n="irat" s={36} />
          <h2>Adatok</h2>
          {nyitott && (
            <button className="gomb-sz jobbra" onClick={szerkeszt}>
              Javítom
            </button>
          )}
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          {d.activityPending && nyitott && (
            <div className="uzenet-sav figyel" style={{ marginBottom: 12 }}>
              {d.status === 'kitoltes' || d.status === 'utmutato' ? (
                <div>
                  <b>ÖVTJ-kód kell.</b> Az ügyfél útmutatója addig vár a tevékenység és a beküldés lépésnél. Írd be a kódot (és ha tudod, a KSH-sor nevét) a Javítom gombbal: az ügyfél értesítést kap.
                </div>
              ) : (
                <div>
                  <b>ÖVTJ-kód: nincs megadva.</b> Írd be a feltöltött NAV-igazolásról a Javítom gombbal: ebből lesz az ügyfél tevékenységkódja a könyvelőnél.
                </div>
              )}
            </div>
          )}
          <dl className="adatok keskeny-adatok">
            <Sor cim="Tevékenység">
              {a.activities.length === 0 ? (
                <span className="halvany">Még nem választott.</span>
              ) : (
                <ul className="tevekenysegek">
                  {a.activities.map((x, i) => (
                    <li key={i}>
                      <span className="felkover">{x.label}</span> {x.main && <span className="cimke info">fő</span>}
                      <div className="halvany kicsi">
                        ÖVTJ: {x.ovtjKod ? <span className="szam">{x.ovtjKod}</span> : <span className="cimke figyel">nincs megadva</span>}
                        {x.ovtjKod && x.ovtjNev ? ` – ${x.ovtjNev}` : ''}
                      </div>
                      {x.navKereso && <div className="halvany kicsi">A NAV-keresőbe: „{x.navKereso}”</div>}
                    </li>
                  ))}
                </ul>
              )}
              {a.activityFreeText && (
                <div className="idezet kicsi" style={{ marginTop: 8 }}>
                  Saját szavaival: „{a.activityFreeText}”
                  {nyitott && (
                    <div className="halvany" style={{ marginTop: 4 }}>
                      <span className="cimke figyel">sor kell</span> Vedd fel tevékenységként a kóddal (Javítom), és töröld innen: addig az útmutatója vár.
                    </div>
                  )}
                </div>
              )}
            </Sor>
            <Sor cim="Várható bevétel">{a.revenueBand ? REVENUE_BAND_LABELS[a.revenueBand] : '–'}</Sor>
            <Sor cim="Székhely">
              {a.seat ? (
                <>
                  {SEAT_KIND_LABELS[a.seat.kind]}
                  {a.seat.address && <div>{cim(a.seat.address)}</div>}
                  {a.seat.right && <div className="halvany kicsi">{SEAT_RIGHT_LABELS[a.seat.right]}</div>}
                  {a.seat.provider && (
                    <div className="halvany kicsi">
                      {a.seat.provider.name}, adószám <span className="szam">{a.seat.provider.adoszam}</span>
                    </div>
                  )}
                </>
              ) : (
                '–'
              )}
            </Sor>
            <Sor cim="Más telephely">
              {a.otherSites.length === 0
                ? 'Nincs'
                : a.otherSites.map((s, i) => (
                    <div key={i}>
                      {cim(s.address)} <span className="halvany kicsi">({s.kind})</span>
                    </div>
                  ))}
            </Sor>
            <Sor cim="Munkavégzés">{a.workKind ? WORK_KIND_LABELS[a.workKind] : '–'}</Sor>
            <Sor cim="EU-s partner">{a.euPartner ? EU_LABEL[a.euPartner] : '–'}</Sor>
            <Sor cim="Indulás">
              {d.filedOn ? (
                <>
                  {datum(d.filedOn, { ev: true })} <span className="halvany kicsi">(a beküldés napja{a.startPlan === 'datum' && a.startDate ? `; tervezte: ${datum(a.startDate)}` : ''})</span>
                </>
              ) : a.startPlan === 'datum' && a.startDate ? (
                datum(a.startDate, { ev: true })
              ) : a.startPlan === 'mielobb' ? (
                'Mielőbb'
              ) : (
                '–'
              )}
            </Sor>
            <Sor cim="Külön számla">{SZAMLA_LABEL(a.hasSeparateBusinessAccount)}</Sor>
            <Sor cim="Nyilatkozat">
              {a.declarations ? (
                <>
                  Kizáró ok nincs, más élő vállalkozása nincs <span className="halvany kicsi">({datum(a.declarations.acceptedAt.slice(0, 10))})</span>
                </>
              ) : (
                <span className="halvany">Még nem nyilatkozott.</span>
              )}
            </Sor>
          </dl>
        </div>
      </div>
      <div className="lap">
        <div className="lap-fej">
          <I3 n="szamolo" s={36} />
          <h2>Amit az app mutatott neki</h2>
        </div>
        <div className="belso oszlop" style={{ paddingTop: 0, gap: 8, fontSize: 14.5 }}>
          {h.stop && <div className="uzenet-sav hiba">{h.stop.text}</div>}
          {h.costRatioText && <p>{nbsp(h.costRatioText)}</p>}
          {h.contributionText && <p>{nbsp(h.contributionText)}</p>}
          {h.qualificationNote && <p className="halvany">{nbsp(h.qualificationNote)}</p>}
          <p className="halvany kicsi">Ezek csak javaslatok. A költséghányadot és a járulékot a könyvelő erősíti meg.</p>
        </div>
      </div>
      <div className="lap">
        <div className="lap-fej">
          <h2>Belső jegyzet</h2>
          <span className="megj">az ügyfél nem látja</span>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          <textarea className="doboz" rows={3} maxLength={2000} value={jegyzet} onChange={(e) => setJegyzet(e.target.value)} placeholder="Például: a tevékenységet telefonon egyeztettük." />
          <div className="gombsor" style={{ marginTop: 8 }}>
            <button className="gomb-m kicsi csak-szoveg" disabled={ment.isPending || jegyzet.trim() === (d.staffNote ?? '').trim()} onClick={() => ment.mutate(jegyzet)}>
              Mentés
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 2. guide + the uploaded NAV confirmation ----------
function BejelentesOszlop({ d, frissit, javitastKer }: { d: TeamRegistrationDetail; frissit: (d: TeamRegistrationDetail) => void; javitastKer: () => void }) {
  const pir = usePirito();
  const t = today();
  // The ticks survive a refetch (coming back from the PDF tab refetches on focus): reset only when the state changes.
  const pipaKulcs = `${d.id}|${d.status}|${d.checkItems.join(',')}`;
  const [pipak, setPipak] = useState<RegistrationCheckItem[]>(d.status === 'beadva' ? [] : d.checkItems);
  useEffect(() => {
    setPipak(d.status === 'beadva' ? [] : d.checkItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipaKulcs]);
  const [kep, setKep] = useState<string | null>(null);
  const [nagy, setNagy] = useState(false);
  const f = d.filed;
  const kepE = !!f && f.mime.startsWith('image/');
  const kepFajl = kepE ? f.fileId : null;
  useEffect(() => {
    setKep(null);
    if (!kepFajl) return;
    let elo = true;
    ep.fileLink(kepFajl)
      .then((r) => elo && setKep(r.url))
      .catch(() => {});
    return () => {
      elo = false;
    };
  }, [kepFajl]);
  const ellenoriz = useMutation({
    mutationFn: () => ep.teamCheckRegistration(d.id, { items: pipak }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok(r.status === 'kesz' ? 'Rendben. Az adószám már megvan, így kész: megnyíltak a következő lépések.' : 'Rendben. Az ügyfél értesítést kapott, és most az adószámot várjuk.');
    },
    onError: pir.hiba,
  });
  const hiany = hianyzoEllenorzes(pipak);
  const { user } = useAuth();
  // Four eyes (SPEC §27.3.4): who filed it as meghatalmazott never checks it (the API answers 403 too).
  const sajatBekuldes = !!user && bekuldo(d) === user.id;
  const ellenorizheto = d.status === 'beadva';
  const javithato = d.status === 'beadva' || d.status === 'ellenorizve';
  const haladas = d.guideProgress;
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="lap">
        <div className="lap-fej">
          <I3 n="kerdezek" s={36} />
          <h2>Útmutató</h2>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          {d.guideOpenedAt ? (
            <>
              <div className="sor-flex ter" style={{ fontSize: 14.5 }}>
                <span>Megnyitotta: {idopont(d.guideOpenedAt, t)}</span>
                <span className="szam felkover">
                  {haladas.done}/{haladas.total} lépés
                </span>
              </div>
              <div className="sav" style={{ margin: '8px 0 0' }}>
                <i style={{ width: `${(haladas.done / Math.max(1, haladas.total)) * 100}%` }} />
              </div>
            </>
          ) : (
            <p className="halvany">
              {d.mode === 'segitett'
                ? 'Neki nem kell útmutató: a könyvelője küldi be helyette, miután az ügyfél az appban átnézte és engedélyezte az adatait.'
                : d.status === 'kitoltes'
                  ? 'Még a kérdőívet tölti. Ha elküldi, elkészül a személyre szabott útmutatója.'
                  : 'Még nem nyitotta meg az útmutatót.'}
            </p>
          )}
        </div>
      </div>
      <div className="lap">
        <div className="lap-fej">
          <I3 n="bevallas" s={36} />
          <h2>NAV-os igazolás</h2>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          {!f ? (
            <p className="halvany">Még nem küldte be a bejelentést. Ha beküldte, itt látod a feltöltött igazolást, és itt nézed át.</p>
          ) : (
            <>
              <dl className="adatok keskeny-adatok" style={{ marginBottom: 12 }}>
                <Sor cim="Beküldte">{datum(f.filedOn, { ev: true })}</Sor>
                <Sor cim="Hogyan">{csatorna(f.channel)}</Sor>
                <Sor cim="Feltöltötte">{idopont(f.uploadedAt, t)}</Sor>
              </dl>
              {kepE ? (
                <figure className={`igazolas-kep${nagy ? ' nagy' : ''}`}>
                  {kep ? (
                    <button type="button" onClick={() => setNagy((x) => !x)} title={nagy ? 'Kisebbre' : 'Nagyítás'}>
                      <img src={kep} alt="A feltöltött NAV-os igazolás" />
                    </button>
                  ) : (
                    <div className="betoltes">Töltöm…</div>
                  )}
                  <figcaption className="halvany kicsi">Kattints a képre a nagyításhoz.</figcaption>
                </figure>
              ) : (
                <div className="pdf-kartya">
                  <I3 n="irat" s={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="felkover">NAV-értesítés, PDF</div>
                    <div className="halvany kicsi">Új lapon nyílik, így mellette ki tudod pipálni a listát.</div>
                    <button className="gomb-m kicsi csak-szoveg" style={{ marginTop: 10 }} onClick={() => void ep.fileLink(f.fileId).then((r) => window.open(r.url, '_blank', 'noopener')).catch(pir.hiba)}>
                      Megnyitom
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {d.status === 'javitas' && d.fixNote && (
            <div className="uzenet-sav figyel" style={{ marginTop: 12 }}>
              <div>
                <b>Ezt kértük tőle:</b> „{d.fixNote}”
                <div className="kicsi">Ha javította és újra feltöltötte, itt újra ellenőrizheted.</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {f && (
        <div className="lap">
          <div className="lap-fej">
            <h2>Ellenőrzés</h2>
            <span className="megj">a PDF alapján</span>
          </div>
          <div className="belso oszlop" style={{ paddingTop: 0, gap: 9 }}>
            {d.clientProfile && (
              <div className="osszevet kicsi" style={{ background: 'var(--lap)', boxShadow: 'inset 0 0 0 1px var(--keret)', borderRadius: 12, padding: '10px 12px', marginBottom: 4 }}>
                <div className="halvany" style={{ marginBottom: 4 }}>Vesd össze a PDF-fel (az ügyfél profiljából):</div>
                <dl className="adatok keskeny-adatok" style={{ margin: 0 }}>
                  <Sor cim="Név">{d.clientProfile.name || '–'}</Sor>
                  <Sor cim="Lakcím">{cim(d.clientProfile.address)}</Sor>
                  <Sor cim="Székhely">{d.answers.seat ? (d.answers.seat.kind === 'lakcim' ? 'a lakcíme' : cim(d.answers.seat.address)) : '–'}</Sor>
                  <Sor cim="Főtevékenység">
                    {(() => {
                      const fo = d.answers.activities.find((x) => x.main);
                      return fo ? `${fo.ovtjKod ? `${fo.ovtjKod} ` : ''}${fo.ovtjNev ?? fo.label}` : (d.answers.activityFreeText ?? '–');
                    })()}
                  </Sor>
                </dl>
              </div>
            )}
            {REGISTRATION_CHECK_ITEMS.map((k) => (
              <label key={k} className="jelolo">
                <input type="checkbox" disabled={!ellenorizheto} checked={pipak.includes(k)} onChange={(e) => setPipak((p) => (e.target.checked ? [...p, k] : p.filter((x) => x !== k)))} />
                <span>{REGISTRATION_CHECK_LABELS[k]}</span>
              </label>
            ))}
            {d.checkedAt && d.status !== 'beadva' && (
              <p className="halvany kicsi">
                Ellenőrizte: {d.checkedBy?.name ?? '–'}, {idopont(d.checkedAt, t)}
              </p>
            )}
            {ellenorizheto && hiany.length > 0 && hiany.length < REGISTRATION_CHECK_ITEMS.length && <p className="sugo" style={{ margin: 0 }}>Még {hiany.length} pont van hátra.</p>}
            {ellenorizheto && sajatBekuldes && <p className="sugo" style={{ margin: 0 }}>Négy szem elve: más nézze át, mint aki beküldte.</p>}
            <div className="gombsor" style={{ marginTop: 6 }}>
              {ellenorizheto && (
                <button className="gomb-e" disabled={hiany.length > 0 || !!d.activityPending || sajatBekuldes || ellenoriz.isPending} onClick={() => ellenoriz.mutate()}>
                  Rendben, ellenőriztem
                </button>
              )}
              {javithato && (
                <button className="gomb-m csak-szoveg" onClick={javitastKer}>
                  Javítást kérek
                </button>
              )}
            </div>
            {ellenorizheto && hiany.length > 0 && <span className="sugo" style={{ marginTop: 0 }}>Akkor tudod jóváhagyni, ha minden pontot kipipáltál.</span>}
            {ellenorizheto && d.activityPending && (
              <span className="sugo" style={{ marginTop: 0 }}>
                Előbb írd be minden tevékenység ÖVTJ-kódját a PDF-ről (Adatok → Javítom). Ha a saját szavaival is leírt valamit, vedd fel tevékenységként, és töröld a szabad szöveget.
              </span>
            )}
          </div>
        </div>
      )}
      <p className="halvany kicsi" style={{ padding: '0 4px' }}>
        {d.mode === 'segitett'
          ? 'A bejelentést a könyvelője küldi be meghatalmazottként, a saját belépésével. Az értesítést más nézi át, mint aki beküldte.'
          : 'A bejelentést az ügyfél küldi be a saját nevében, az útmutatónk alapján. Ha kéri, a könyvelője intézi helyette („Intézzük helyette”).'}
      </p>
    </div>
  );
}

/** Fix-request templates by channel (NAV Ügysegéd-útmutató 2026.03.19, pp. 4–5, 12, 18; review k3c2). */
const JAVITAS_MINTAK: { cim: string; szoveg: (fn: string) => string }[] = [
  {
    cim: 'cím vagy tevékenység',
    szoveg: () =>
      'A bejelentésedben … nem stimmel (helyesen: …). Lépj be újra a Vállalkozói Ügysegédbe (ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged), indíts változásbejelentést, és javítsd. Utána töltsd fel itt az új igazolást.',
  },
  {
    cim: 'adózási adat (ONYA)',
    szoveg: () =>
      'A bejelentésedben a(z) … rész nem jó (helyesen: …). Ezt nem az Ügysegédben, hanem az ONYA-ban javíthatod: onya.nav.gov.hu → Egyéni vállalkozó bejelentése (T101E nyomtatvány), 15 napon belül. Utána töltsd fel itt a visszaigazolást. Ha elakadsz, kérj visszahívást.',
  },
  {
    cim: 'kimaradt választás',
    szoveg: (fn) =>
      `A bejelentésedből kimaradt: … Ezt utólag nem lehet egyszerűen pótolni, ezért most ne küldj be új bejelentést. ${fn}, a könyvelőd megnézi, mi a legjobb megoldás, és üzenetben ír neked.`,
  },
];

function JavitasFiok({ d, nyitva, bezar, frissit }: { d: TeamRegistrationDetail; nyitva: boolean; bezar: () => void; frissit: (d: TeamRegistrationDetail) => void }) {
  const pir = usePirito();
  const [note, setNote] = useState('');
  useEffect(() => {
    if (nyitva) setNote('');
  }, [nyitva]);
  // "Kovács Bence" → "Bence" (Hungarian order); used without suffixes on purpose
  const fn = d.clientCard.accountant?.name.trim().split(/\s+/).slice(-1)[0] || 'a könyvelő';
  const kuld = useMutation({
    mutationFn: () => ep.teamRequestFix(d.id, note.trim()),
    onSuccess: (r) => {
      frissit(r);
      bezar();
      pir.ok('Elküldtük neki. Az appban látja, mit és hogyan javítson.');
    },
    onError: pir.hiba,
  });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      ikon="bevallas"
      cim="Mit javítson?"
      bev="Ezt a szöveget látja az ügyfél, ahogy leírod. Tegezve, röviden, lépésenként."
      lab={
        <button className="gomb-e" disabled={!note.trim() || kuld.isPending} onClick={() => kuld.mutate()}>
          Elküldöm neki
        </button>
      }
    >
      <div className="uzenet-sav info" style={{ marginBottom: 12 }}>
        <div>
          Írd le pontosan, mit javítson, és hol. A beküldött bejelentést nem lehet átírni, csak egy új bejelentéssel módosítani:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li><b>Cím, tevékenység:</b> a Vállalkozói Ügysegédben, változásbejelentéssel.</li>
            <li><b>Adózási adat</b> (munkavégzés jellege, átalányadó, alanyi ÁFA, kata, pénzforgalmi, közösségi adószám): <b>nem</b> az Ügysegédben, hanem az ONYA-ban, „Egyéni vállalkozó bejelentése” (T101E), 15 napon belül.</li>
            <li><b>Kimaradt az alanyi ÁFA-mentesség vagy az átalányadózás választása:</b> ezt idén valószínűleg már nem lehet pótolni. Küldd el az ügyfélnek a „kimaradt választás” mintát (ebből tudja, hogy várjon), és szólj a könyvelőnek ({fn}): ő dönt a folytatásról.</li>
          </ul>
        </div>
      </div>
      <div className="sor-flex" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {JAVITAS_MINTAK.map((m) => (
          <button key={m.cim} type="button" className="gomb-sz kicsi" onClick={() => setNote(m.szoveg(fn))}>
            Minta: {m.cim}
          </button>
        ))}
      </div>
      <textarea
        className="doboz"
        rows={7}
        maxLength={1000}
        value={note}
        autoFocus
        placeholder="Például: A munkavégzés jellegénél főfoglalkozást jelöltél, de heti 40 órás munkaviszonyod van. Ezt az ONYA-ban javíthatod (onya.nav.gov.hu → Egyéni vállalkozó bejelentése, T101E): válaszd a „mellékfoglalkozású: heti legalább 36 órás munkaviszony mellett” sort, 15 napon belül. Utána töltsd fel a visszaigazolást."
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="sugo">{note.length}/1000</p>
    </Fiok>
  );
}

// ---------- 3. adószám ----------
function AdoszamLap({ d, frissit }: { d: TeamRegistrationDetail; frissit: (d: TeamRegistrationDetail) => void }) {
  const pir = usePirito();
  const t = today();
  const [f, setF] = useState({ adoszam: d.adoszam ?? '', ev: d.evNyilvantartasiSzam ?? '', nap: d.registeredOn ?? '' });
  useEffect(() => setF({ adoszam: d.adoszam ?? '', ev: d.evNyilvantartasiSzam ?? '', nap: d.registeredOn ?? '' }), [d.adoszam, d.evNyilvantartasiSzam, d.registeredOn]);
  const ell = adoszamEllenor(f.adoszam);
  const evHiba = f.ev.trim() && !nyilvantartasiSzamOk(f.ev) ? 'A nyilvántartási szám 8 számjegy.' : null;
  const napHiba = f.nap && f.nap > t ? 'Jövőbeli nap nem lehet.' : null;
  const ment = useMutation({
    mutationFn: () => ep.teamSetAdoszam(d.id, { adoszam: ell.ertek!, evNyilvantartasiSzam: f.ev.trim() || undefined, registeredOn: f.nap }),
    onSuccess: (r) => {
      frissit(r);
      pir.ok(r.status === 'kesz' ? 'Rögzítve. Elindult a vállalkozása: megnyíltak a következő lépések.' : 'Rögzítve. Ha az igazolást is rendben találod, kész.');
    },
    onError: pir.hiba,
  });
  const rogzitheto = ADOSZAM_ALLAPOT.includes(d.status);
  return (
    <div className="lap">
      <div className="lap-fej">
        <I3 n="szamlaszam" s={36} />
        <h2>Adószám</h2>
        {d.status === 'kesz' && (
          <span className="allapot jobbra">
            <I3 n="befizetve_jel" s={18} />
            <span className="szo">Kész</span>
          </span>
        )}
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {d.status === 'kesz' || (!rogzitheto && d.adoszam) ? (
          <dl className="adatok keskeny-adatok">
            <Sor cim="Adószám">
              <span className="szam felkover">{d.adoszam}</span>
            </Sor>
            <Sor cim="Nyilvántartási szám">{d.evNyilvantartasiSzam ? <span className="szam">{d.evNyilvantartasiSzam}</span> : '–'}</Sor>
            <Sor cim="Nyilvántartásba vette">{d.registeredOn ? datum(d.registeredOn, { ev: true }) : '–'}</Sor>
          </dl>
        ) : !rogzitheto ? (
          <p className="halvany">Ha beküldte a bejelentést, és megjött az adószáma, itt rögzítheted. Ő is beírhatja az appban.</p>
        ) : (
          <form
            className="oszlop"
            style={{ gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (ell.ertek && f.nap && !evHiba && !napHiba) ment.mutate();
            }}
          >
            {d.adoszam && <div className="uzenet-sav info">Az ügyfél már beírta: {d.adoszam}. Nézd meg a NAV-os igazoláson, és rögzítsd.</div>}
            <label className="mezo">
              <span className="felirat">Adószám</span>
              <input className={`doboz szam${ell.hiba ? ' hibas' : ''}`} placeholder="12345678-1-23" value={f.adoszam} onChange={(e) => setF({ ...f, adoszam: e.target.value })} />
              {ell.hiba && <span className="hiba-szoveg">{ell.hiba}</span>}
            </label>
            {ell.figyelmeztetes && <div className="uzenet-sav figyel">{ell.figyelmeztetes}</div>}
            <label className="mezo">
              <span className="felirat">Nyilvántartási szám (ha megvan)</span>
              <input className={`doboz szam${evHiba ? ' hibas' : ''}`} inputMode="numeric" placeholder="8 számjegy" value={f.ev} onChange={(e) => setF({ ...f, ev: e.target.value })} />
              {evHiba && <span className="hiba-szoveg">{evHiba}</span>}
            </label>
            <label className="mezo">
              <span className="felirat">Nyilvántartásba vétel napja</span>
              <input className={`doboz${napHiba ? ' hibas' : ''}`} type="date" max={t} value={f.nap} onChange={(e) => setF({ ...f, nap: e.target.value })} />
              {napHiba ? <span className="hiba-szoveg">{napHiba}</span> : <span className="sugo">Ez lesz a vállalkozás kezdete. Az igazoláson látod.</span>}
            </label>
            <div className="gombsor">
              <button className="gomb-e" type="submit" disabled={!ell.ertek || !f.nap || !!evHiba || !!napHiba || ment.isPending}>
                Rögzítem
              </button>
            </div>
            <span className="sugo" style={{ marginTop: 0 }}>
              {d.status === 'ellenorizve' ? 'Rögzítés után kész: megnyílnak a következő lépései (meghatalmazás, előfizetés).' : 'Elmentjük. Ha az igazolást is rendben találod, kész.'}
            </span>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- edit drawer (the team corrects the answers; the client sees the new values) ----------
type Szerk = {
  revenueBand: RevenueBand | null;
  activities: { key: string | null; label: string; main: boolean; ovtjKod: string; ovtjNev: string }[];
  activityFreeText: string;
  seatKind: SeatKind | null;
  seatAddress: { zip: string; city: string; line: string };
  seatRight: SeatRight | null;
  providerName: string;
  providerAdoszam: string;
  otherSites: { zip: string; city: string; line: string }[];
  workKind: WorkKind | null;
  euPartner: EuPartnerAnswer | null;
  startPlan: StartPlan | null;
  startDate: string;
  szamla: 'igen' | 'nem' | '';
};
function kezdo(a: BusinessRegistrationAnswers): Szerk {
  return {
    revenueBand: a.revenueBand,
    activities: a.activities.map((x) => ({ key: x.key, label: x.label, main: x.main, ovtjKod: x.ovtjKod ?? '', ovtjNev: x.ovtjNev ?? '' })),
    activityFreeText: a.activityFreeText ?? '',
    seatKind: a.seat?.kind ?? null,
    seatAddress: a.seat?.address ?? { zip: '', city: '', line: '' },
    seatRight: a.seat?.right ?? null,
    providerName: a.seat?.provider?.name ?? '',
    providerAdoszam: a.seat?.provider?.adoszam ?? '',
    otherSites: a.otherSites.map((s) => ({ ...s.address })),
    workKind: a.workKind,
    euPartner: a.euPartner,
    startPlan: a.startPlan,
    startDate: a.startDate ?? '',
    szamla: a.hasSeparateBusinessAccount === null ? '' : a.hasSeparateBusinessAccount ? 'igen' : 'nem',
  };
}

type Cim = { zip: string; city: string; line: string };
/** Address inputs (module level, so typing never re-mounts them). */
function CimMezok({ c, valt }: { c: Cim; valt: (c: Cim) => void }) {
  return (
    <div className="mezosor" style={{ gridTemplateColumns: '110px 1fr 1.6fr' }}>
      <input className="doboz" placeholder="Irsz." inputMode="numeric" maxLength={4} value={c.zip} onChange={(e) => valt({ ...c, zip: e.target.value })} aria-label="Irányítószám" />
      <input className="doboz" placeholder="Település" value={c.city} onChange={(e) => valt({ ...c, city: e.target.value })} aria-label="Település" />
      <input className="doboz" placeholder="Utca, házszám" value={c.line} onChange={(e) => valt({ ...c, line: e.target.value })} aria-label="Utca, házszám" />
    </div>
  );
}

function SzerkesztoFiok({ d, nyitva, bezar, frissit }: { d: TeamRegistrationDetail; nyitva: boolean; bezar: () => void; frissit: (d: TeamRegistrationDetail) => void }) {
  const pir = usePirito();
  const [f, setF] = useState<Szerk>(() => kezdo(d.answers));
  // Fill the form when the drawer opens – a background refetch must not wipe what is being typed.
  useEffect(() => {
    if (nyitva) setF(kezdo(d.answers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nyitva]);
  const hibak = useMemo(() => {
    const h: string[] = [];
    f.activities.forEach((x, i) => {
      if (x.ovtjKod.trim() && !isValidOvtjKod(x.ovtjKod.trim())) h.push(`${i + 1}. tevékenység: az ÖVTJ-kód 6 számjegy.`);
      if (!x.label.trim()) h.push(`${i + 1}. tevékenység: válassz sort, vagy írd le.`);
    });
    if (f.activities.length && f.activities.filter((x) => x.main).length !== 1) h.push('Pontosan egy főtevékenység legyen.');
    const cimOk = (c: { zip: string; city: string; line: string }) => isValidHuZip(c.zip.trim()) && c.city.trim().length >= 1 && c.line.trim().length >= 3;
    if (f.seatKind && f.seatKind !== 'lakcim' && !cimOk(f.seatAddress)) h.push('A székhely címe hiányos (irányítószám, település, utca).');
    f.otherSites.forEach((s, i) => !cimOk(s) && h.push(`${i + 1}. telephely címe hiányos.`));
    if (f.startPlan === 'datum' && !f.startDate) h.push('Add meg az indulás napját.');
    return h;
  }, [f]);
  const ment = useMutation({
    mutationFn: () => {
      const body: TeamRegistrationPatch = {
        answers: {
          revenueBand: f.revenueBand ?? undefined,
          activities: f.activities.map((x) => ({ key: x.key, label: x.label.trim(), main: x.main })),
          activityFreeText: f.activityFreeText.trim() || null,
          seat: f.seatKind
            ? {
                kind: f.seatKind,
                address: f.seatKind === 'lakcim' ? null : { zip: f.seatAddress.zip.trim(), city: f.seatAddress.city.trim(), line: f.seatAddress.line.trim() },
                right: f.seatKind === 'mas_cim' ? f.seatRight : f.seatKind === 'szekhelyszolgaltato' ? 'szekhelyszolgaltatasi_szerzodes' : null,
                provider: f.seatKind === 'szekhelyszolgaltato' ? { name: f.providerName.trim(), adoszam: f.providerAdoszam.trim() } : null,
              }
            : undefined,
          otherSites: f.otherSites.map((s) => ({ address: { zip: s.zip.trim(), city: s.city.trim(), line: s.line.trim() } })),
          workKind: f.workKind ?? undefined,
          euPartner: f.euPartner ?? undefined,
          startPlan: f.startPlan ?? undefined,
          startDate: f.startPlan === 'datum' ? f.startDate : null,
          hasSeparateBusinessAccount: f.szamla === '' ? null : f.szamla === 'igen',
        },
        ovtjKodok: f.activities.map((x, index) => ({ index, ovtjKod: x.ovtjKod.trim() || null, ovtjNev: x.ovtjKod.trim() ? x.ovtjNev.trim() || null : null })),
      };
      return ep.teamPatchRegistration(d.id, body);
    },
    onSuccess: (r) => {
      frissit(r);
      bezar();
      pir.ok('Elmentve. Az ügyfél az appban már az új adatokat látja.');
    },
    onError: pir.hiba,
  });
  const akt = (i: number, p: Partial<Szerk['activities'][number]>) => setF({ ...f, activities: f.activities.map((x, j) => (j === i ? { ...x, ...p } : p.main ? { ...x, main: false } : x)) });
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      szeles
      ikon="irat"
      cim={`Adatok javítása – ${d.client.name}`}
      bev="Amit itt átírsz, azt az ügyfél is látja, és az útmutatója is ehhez igazodik. Minden módosítást naplózunk."
      lab={
        <>
          <button className="gomb-e" disabled={hibak.length > 0 || ment.isPending} onClick={() => ment.mutate()}>
            Mentés
          </button>
          {hibak.length > 0 && <span className="sugo" style={{ margin: 0 }}>{hibak[0]}</span>}
        </>
      }
    >
      <div className="oszlop" style={{ gap: 20 }}>
        <div className="mezo">
          <span className="felirat">Tevékenységek (1 fő + legfeljebb 4 másik)</span>
          <div className="oszlop" style={{ gap: 8 }}>
            {f.activities.map((x, i) => (
              <div key={i} className="tevekenyseg-sor">
                <Lenyilo
                  value={x.key ?? ''}
                  aria-label={`${i + 1}. tevékenység`}
                  onChange={(e) => {
                    const v = BUSINESS_ACTIVITIES.find((b) => b.key === e.target.value);
                    akt(i, { key: v?.key ?? null, label: v?.label ?? x.label, ovtjKod: x.ovtjKod || (v?.ovtjKod ?? ''), ovtjNev: x.ovtjNev || (v?.ovtjNev ?? '') });
                  }}
                >
                  <option value="">Saját szavaival</option>
                  {BUSINESS_ACTIVITIES.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </Lenyilo>
                {x.key === null ? (
                  <input className="doboz" value={x.label} placeholder="Mit csinál?" onChange={(e) => akt(i, { label: e.target.value })} aria-label="Tevékenység saját szavaival" />
                ) : (
                  <span className="halvany kicsi">A NAV-keresőbe: „{BUSINESS_ACTIVITIES.find((b) => b.key === x.key)?.navKereso ?? '–'}”</span>
                )}
                <input
                  className={`doboz szam${x.ovtjKod.trim() && !isValidOvtjKod(x.ovtjKod.trim()) ? ' hibas' : ''}`}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="ÖVTJ"
                  value={x.ovtjKod}
                  onChange={(e) => akt(i, { ovtjKod: e.target.value })}
                  aria-label="ÖVTJ-kód"
                />
                <input
                  className="doboz"
                  maxLength={200}
                  placeholder="A KSH-sor neve"
                  value={x.ovtjNev}
                  onChange={(e) => akt(i, { ovtjNev: e.target.value })}
                  aria-label="Az ÖVTJ-sor pontos neve"
                />
                <label className="jelolo" style={{ alignItems: 'center' }}>
                  <input type="radio" name="fo" checked={x.main} onChange={() => akt(i, { main: true })} />
                  fő
                </label>
                <button className="gomb-v" type="button" onClick={() => setF({ ...f, activities: f.activities.filter((_, j) => j !== i) })}>
                  Kiveszem
                </button>
              </div>
            ))}
          </div>
          {f.activities.length < 5 && (
            <button className="gomb-sz" type="button" style={{ marginTop: 8 }} onClick={() => setF({ ...f, activities: [...f.activities, { key: null, label: '', main: f.activities.length === 0, ovtjKod: '', ovtjNev: '' }] })}>
              Új tevékenység
            </button>
          )}
          <span className="sugo">Az ÖVTJ-kódot és a sor pontos nevét a KSH ÖVTJ'25 listájából írd be. Az ügyfél útmutatója ezt mutatja („kód – név”), a másolás gomb csak a kódot másolja. Ha csak a saját szavaival írta le, adj hozzá egy tevékenységet a kóddal.</span>
        </div>
        <div className="mezo">
          <span className="felirat">A saját szavaival</span>
          <textarea className="doboz" rows={2} maxLength={200} value={f.activityFreeText} onChange={(e) => setF({ ...f, activityFreeText: e.target.value })} aria-label="A saját szavaival" />
          {f.activityFreeText.trim() && (
            <>
              <span className="sugo">Amíg itt szöveg van, az ügyfél útmutatója vár. Vedd fel tevékenységként (és írd be a kódját), utána ez a mező kiürül.</span>
              {f.activities.length < 5 && (
                <button
                  className="gomb-sz"
                  type="button"
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                  onClick={() =>
                    setF({
                      ...f,
                      activities: [...f.activities, { key: null, label: f.activityFreeText.trim().slice(0, 200), main: f.activities.length === 0, ovtjKod: '', ovtjNev: '' }],
                      activityFreeText: '',
                    })
                  }
                >
                  Felveszem tevékenységként
                </button>
              )}
            </>
          )}
        </div>
        <div className="mezo">
          <span className="felirat">Várható éves bevétel</span>
          <div className="valaszto">
            {REVENUE_BANDS.map((r) => (
              <label key={r}>
                <input type="radio" name="bevetel" checked={f.revenueBand === r} onChange={() => setF({ ...f, revenueBand: r })} />
                {REVENUE_BAND_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
        <div className="mezo">
          <span className="felirat">Székhely</span>
          <div className="valaszto">
            {SEAT_KINDS.map((k) => (
              <label key={k}>
                <input type="radio" name="szekhely" checked={f.seatKind === k} onChange={() => setF({ ...f, seatKind: k })} />
                {SEAT_KIND_LABELS[k]}
              </label>
            ))}
          </div>
          {f.seatKind && f.seatKind !== 'lakcim' && (
            <div style={{ marginTop: 10 }}>
              <CimMezok c={f.seatAddress} valt={(c) => setF({ ...f, seatAddress: c })} />
            </div>
          )}
          {f.seatKind === 'mas_cim' && (
            <div style={{ marginTop: 10, maxWidth: 420 }}>
              <Lenyilo value={f.seatRight ?? ''} aria-label="Milyen jogon használja" onChange={(e) => setF({ ...f, seatRight: (e.target.value || null) as SeatRight | null })}>
                <option value="">Milyen jogon használja?</option>
                {SEAT_RIGHTS.filter((r) => r !== 'szekhelyszolgaltatasi_szerzodes').map((r) => (
                  <option key={r} value={r}>
                    {SEAT_RIGHT_LABELS[r]}
                  </option>
                ))}
              </Lenyilo>
            </div>
          )}
          {f.seatKind === 'szekhelyszolgaltato' && (
            <div className="mezosor k2" style={{ marginTop: 10 }}>
              <input className="doboz" placeholder="Székhelyszolgáltató neve" value={f.providerName} onChange={(e) => setF({ ...f, providerName: e.target.value })} aria-label="Székhelyszolgáltató neve" />
              <input className="doboz szam" placeholder="Adószáma" value={f.providerAdoszam} onChange={(e) => setF({ ...f, providerAdoszam: e.target.value })} aria-label="Székhelyszolgáltató adószáma" />
            </div>
          )}
        </div>
        <div className="mezo">
          <span className="felirat">Más telephely, üzlet, iroda (legfeljebb 3)</span>
          <div className="oszlop" style={{ gap: 8 }}>
            {f.otherSites.map((s, i) => (
              <div key={i} className="sor-flex" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <CimMezok c={s} valt={(c) => setF({ ...f, otherSites: f.otherSites.map((x, j) => (j === i ? c : x)) })} />
                </div>
                <button className="gomb-v" type="button" onClick={() => setF({ ...f, otherSites: f.otherSites.filter((_, j) => j !== i) })}>
                  Kiveszem
                </button>
              </div>
            ))}
          </div>
          {f.otherSites.length < 3 && (
            <button className="gomb-sz" type="button" style={{ marginTop: 8 }} onClick={() => setF({ ...f, otherSites: [...f.otherSites, { zip: '', city: '', line: '' }] })}>
              Új telephely
            </button>
          )}
        </div>
        <div className="mezo">
          <span className="felirat">Munkavégzés jellege</span>
          <div className="valaszto">
            {WORK_KINDS.map((w) => (
              <label key={w}>
                <input type="radio" name="munka" checked={f.workKind === w} onChange={() => setF({ ...f, workKind: w })} />
                {WORK_KIND_LABELS[w]}
              </label>
            ))}
          </div>
        </div>
        <div className="mezosor k2">
          <div className="mezo">
            <span className="felirat">Dolgozik EU-s cégnek, vagy vesz tőlük szolgáltatást?</span>
            <div className="valaszto">
              {(['nem', 'igen', 'nem_tudom'] as EuPartnerAnswer[]).map((v) => (
                <label key={v}>
                  <input type="radio" name="eu" checked={f.euPartner === v} onChange={() => setF({ ...f, euPartner: v })} />
                  {EU_LABEL[v]}
                </label>
              ))}
            </div>
          </div>
          <div className="mezo">
            <span className="felirat">Külön bankszámla a vállalkozásnak</span>
            <div className="valaszto">
              {(
                [
                  ['igen', 'Igen'],
                  ['nem', 'Nem'],
                  ['', 'Nem tudja'],
                ] as const
              ).map(([v, l]) => (
                <label key={l}>
                  <input type="radio" name="szamla" checked={f.szamla === v} onChange={() => setF({ ...f, szamla: v })} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mezo">
          <span className="felirat">Mikor indul?</span>
          <div className="valaszto">
            <label>
              <input type="radio" name="indul" checked={f.startPlan === 'mielobb'} onChange={() => setF({ ...f, startPlan: 'mielobb' })} />
              Mielőbb
            </label>
            <label>
              <input type="radio" name="indul" checked={f.startPlan === 'datum'} onChange={() => setF({ ...f, startPlan: 'datum' })} />
              Egy adott napon
            </label>
            {f.startPlan === 'datum' && <input className="doboz" type="date" style={{ width: 200 }} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} aria-label="Indulás napja" />}
          </div>
          <span className="sugo">A vállalkozás azon a napon indul, amikor beküldi a bejelentést. A dátum csak emlékeztető.</span>
        </div>
      </div>
    </Fiok>
  );
}
