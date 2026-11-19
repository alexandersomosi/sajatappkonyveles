// Bekötés: onboarding steps with review actions, KYC viewer, NAV technical-user connection (FUNKCIOK 2–7, 33; SPEC §6.1, §8.6, §10).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import { Fiok, HibaSav, Targy, Toltes } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { usePirito } from '../../../ui/Pirito';
import { KYC_DOCUMENT_TYPE_LABELS, KYC_FIELD_ORDER, KYC_FIELD_LABELS, KYC_LABEL, MEGHATALMAZAS_LABEL, STEP_LABEL, STEP_STATUS_LABEL, TAX_STATUS_ROVID } from '../../../lib/labels';
import { datum, idopont } from '../../../lib/format';
import { today } from '../../../lib/today';
import { torzsszamOk } from '../../../lib/validate';
import type { OnboardingStep, StepStatus } from '../../../_shared/enums';
import { useAuth, useKonyveloNev } from '../../../auth/Auth';
import { FILING_CHANNEL_LABELS, REGISTRATION_STATUS_LABELS, WORK_KIND_LABELS } from '../../../_shared/enums';
import { Link } from 'react-router';
import { ASSIST_BALL, ASSIST_KIND_LABELS, ASSIST_STATUS_LABELS } from '../../../_shared/enums';
import type { TeamClientCard } from '../../../api/types';
import { labdaNalam, nyitottAssist } from '../../../lib/helyettunk';
import { Utvonal } from '../../csapat/UgyfelKartya';

function kycSorrend(k: string): number {
  const i = KYC_FIELD_ORDER.indexOf(k);
  return i < 0 ? 99 : i;
}

/** KYC values for people: Hungarian dates and document names instead of ISO dates and enum keys. */
function kycErtek(k: string, v: unknown): string {
  const s = String(v ?? '');
  if (k === 'documentType') return KYC_DOCUMENT_TYPE_LABELS[s] ?? s;
  if ((k === 'birthDate' || k === 'documentExpiry') && /^\d{4}-\d{2}-\d{2}$/.test(s)) return datum(s, { ev: true });
  return s;
}

export default function Bekotes({ c }: FulProps) {
  const qc = useQueryClient();
  const pir = usePirito();
  const [kyc, setKyc] = useState(false);
  const [hianyos, setHianyos] = useState<OnboardingStep | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
  const lepes = useMutation({
    mutationFn: (x: { step: OnboardingStep; status: 'kesz' | 'hianyos' | 'kihagyva'; note?: string }) => ep.accOnboardingStep(c.id, x.step, x.status, x.note),
    onSuccess: (_d, x) => {
      pir.ok(x.status === 'kesz' ? 'Kész. Az ügyfél is látja.' : x.status === 'hianyos' ? 'Visszaküldted. Az ügyfél értesítést kapott.' : 'Kihagyva.');
      setHianyos(null);
      void inv();
    },
    onError: pir.hiba,
  });
  // SPEC §26.2.9: the legacy 'idopont' step is never listed.
  const steps = c.onboarding.steps.filter((s) => s.step !== 'idopont');
  // SPEC §27.6.4: the branch history and the assisted request come from the client card (own clients only).
  const kartya = useQuery({ queryKey: ['team', 'client-card', c.id], queryFn: () => ep.teamClient(c.id), enabled: c.lifecycle === 'bekotes_alatt' || c.onboarding.steps.some((s) => s.data?.method === 'onya_konyvelo') });
  const assist = kartya.data?.assist ?? null;
  const assistNyitott = !!assist && nyitottAssist(assist.status);
  const ms = c.onboarding.milestones;
  return (
    <div className="racs fo-mellek">
      <div>
        <div className="lap">
          <div className="lap-fej">
            <h2>Hol tart a bekötés</h2>
            {c.lifecycle === 'aktiv' && <span className="allapot"><I3 n="befizetve_jel" s={18} /><span className="szo">Kész, aktív ügyfél</span></span>}
          </div>
          <div className="merfoldkovek">
            {ms.map((m) => (
              <div key={m.key} className={`merfoldko${m.done ? ' kesz' : ''}${m.current ? ' most' : ''}`}>
                {m.label}
                {m.sub && <div className="halvany kicsi" style={{ fontWeight: 400 }}>{m.sub}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="lap" style={{ marginTop: 16 }}>
          <div className="lap-fej">
            <h2>Lépések</h2>
            <span className="megj">Amit „Rád vár” jelöl, az a te dolgod.</span>
          </div>
          {steps.map((s, i) => (
            <div className="lepes" key={s.step}>
              <span className={`szam-korong${s.status === 'kesz' ? ' kesz' : s.status === 'kihagyva' ? ' var' : ''}`}>
                {s.status === 'kesz' ? <I3 n="befizetve_jel" s={28} /> : i + 1}
              </span>
              <div className="l">
                <div className="cim">
                  {STEP_LABEL[s.step].cim}{' '}
                  {s.step === 'vallalkozas_inditas' ? <UjVallalkozasCimke s={s.status} /> : <StepCimke s={s.status} sajat={s.step === 'nav_bekotes'} />}
                </div>
                <div className="al">{STEP_LABEL[s.step].leiras}</div>
                {s.step === 'meghatalmazas' && s.data?.method && (
                  <div className="al" style={{ color: 'var(--tinta)' }}>
                    Mód: <b>{MEGHATALMAZAS_LABEL[s.data.method]}</b>
                    {s.data.submittedAt && <> · beküldte {datum(s.data.submittedAt.slice(0, 10))}</>}
                    {s.data.fileId && (
                      <>
                        {' '}
                        ·{' '}
                        <button className="gomb-sz" onClick={() => void ep.downloadFile(s.data!.fileId!, 'meghatalmazas.pdf').catch(pir.hiba)}>
                          Visszaigazolás megnyitása
                        </button>
                      </>
                    )}
                  </div>
                )}
                {s.step === 'vallalkozas_inditas' && <UjVallalkozas clientId={c.id} assistId={assist?.kind === 'vallalkozas_bejelentes' ? assist.id : null} />}
                {s.note && s.status === 'hianyos' && s.step !== 'vallalkozas_inditas' && <div className="al">Amit kértél: „{s.note}”</div>}
                {s.completedAt && s.status === 'kesz' && <div className="al">Kész: {idopont(s.completedAt, today())}</div>}
                <div className="gombsor" style={{ marginTop: 8 }}>
                  {s.step === 'adatok' &&
                    (c.taxProfile?.costRatioSource === 'konyvelo_megerositette' ? (
                      <span className="al">
                        Megerősítetted: {c.taxProfile.costRatio}%, {TAX_STATUS_ROVID[c.taxProfile.status]?.toLowerCase() ?? c.taxProfile.status}.{' '}
                        <Link to={`/ugyfelek/${c.id}/attekintes`}>Módosítom</Link>
                      </span>
                    ) : (
                      <Link className="gomb-sz" to={`/ugyfelek/${c.id}/attekintes`}>
                        Költséghányad és jogállás megerősítése
                      </Link>
                    ))}
                  {s.step === 'meghatalmazas' && s.status !== 'kesz' && assistNyitott && (
                    <Link className="gomb-m kicsi csak-szoveg" to={`/helyettunk/${assist!.id}`}>
                      Intézzük helyette: megnyitom a lépéseit
                    </Link>
                  )}
                  {s.step === 'meghatalmazas' && s.status !== 'kesz' && !assistNyitott && (
                    <>
                      <button className="gomb-m kicsi csak-szoveg" disabled={lepes.isPending || s.status === 'nincs_kezdve'} onClick={() => lepes.mutate({ step: 'meghatalmazas', status: 'kesz' })}>
                        Ellenőriztem a NAV-nál, kész
                      </button>
                      <button className="gomb-sz" onClick={() => setHianyos('meghatalmazas')}>
                        Visszaküldöm pótlásra
                      </button>
                    </>
                  )}
                  {s.step === 'azonositas' && c.kycStatus && (
                    <button className="gomb-m kicsi" onClick={() => setKyc(true)}>
                      <I3 n="fiok" s={22} />
                      {c.kycStatus === 'bekuldve' ? 'Megnézem és elbírálom' : 'Megnézem'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        {kartya.data && <UtvonalEsHelyettunk k={kartya.data} />}
        <NavKapcsolat c={c} />
      </div>
      <KycFiok c={c} nyitva={kyc} bezar={() => setKyc(false)} />
      <MegjegyzesFiok
        nyitva={!!hianyos}
        cim="Mit kell pótolnia?"
        bev="Ezt a mondatot látja az ügyfél a bekötés lépésénél. Írd le egyszerűen, mit csináljon."
        gomb="Visszaküldöm"
        bezar={() => setHianyos(null)}
        kuld={(note) => hianyos && lepes.mutate({ step: hianyos, status: 'hianyos', note })}
        folyamatban={lepes.isPending}
      />
    </div>
  );
}

/** New-business path (SPEC §26.1, §26.3.5): read-only summary for the accountant. The client files the bejelentés himself;
 * the service team checks the uploaded NAV confirmation and records the adószám. */
function UjVallalkozas({ clientId, assistId }: { clientId: string; assistId: string | null }) {
  const { isAdmin } = useAuth();
  const t = today();
  const q = useQuery({ queryKey: ['acc', 'client-registration', clientId], queryFn: () => ep.accClientRegistration(clientId) });
  if (q.isPending) return <div className="al">Töltöm…</div>;
  if (q.isError) return <div className="al">A vállalkozás-indítás adatai most nem tölthetők be.</div>;
  const r = q.data.registration;
  if (!r) return <div className="al">Még nem kezdte el az adatlapot.</div>;
  const fo = r.answers.activities.find((a) => a.main) ?? r.answers.activities[0];
  return (
    <div className="uj-vallalkozas">
      <div className="sor-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className={`cimke ${r.status === 'kesz' ? '' : r.status === 'javitas' ? 'hiba' : 'info'}`}>{REGISTRATION_STATUS_LABELS[r.status]}</span>
        {r.filed && (
          <span className="halvany kicsi">
            beküldte {datum(r.filed.filedOn)} ({FILING_CHANNEL_LABELS[r.filed.channel]})
          </span>
        )}
      </div>
      <dl className="adatok keskeny-adatok" style={{ marginTop: 8, fontSize: 14 }}>
        <dt>Tevékenység</dt>
        <dd>{fo ? fo.label : '–'}{r.answers.activities.length > 1 && <span className="halvany"> + {r.answers.activities.length - 1} másik</span>}</dd>
        <dt>Munkavégzés</dt>
        <dd>{r.answers.workKind ? WORK_KIND_LABELS[r.answers.workKind] : '–'}</dd>
        {r.hints.costRatioText && (
          <>
            <dt>Költséghányad</dt>
            <dd>{r.hints.costRatio !== null ? `${r.hints.costRatio}% (javaslat, te erősíted meg)` : 'Te mondod meg.'}</dd>
          </>
        )}
        {r.adoszam && (
          <>
            <dt>Adószám</dt>
            <dd className="szam">{r.adoszam}</dd>
          </>
        )}
        {r.checkedAt && (
          <>
            <dt>Ellenőrizte</dt>
            <dd>{r.checkedBy?.name ?? 'a csapat'}, {idopont(r.checkedAt, t)}</dd>
          </>
        )}
      </dl>
      <p className="al">
        {r.status === 'kesz'
          ? 'Kész. Most a költséghányadot és a jogállást erősítsd meg az Adatoknál.'
          : r.mode === 'segitett'
            ? 'Intézzük helyette: te küldöd be meghatalmazottként, a saját belépéseddel, miután az ügyfél az appban engedélyezte. Ha kész, a költséghányadot és a jogállást is te erősíted meg.'
            : 'Ezzel neked most nincs dolgod: az ügyfél maga jelenti be az útmutatónk alapján. Ha kész, a költséghányadot és a jogállást te erősíted meg.'}
      </p>
      {r.mode === 'segitett' && assistId && (
        <Link className="gomb-m kicsi csak-szoveg" to={`/helyettunk/${assistId}`} style={{ marginRight: 12 }}>
          Megnyitom a lépéseit
        </Link>
      )}
      {isAdmin && (
        <Link className="gomb-sz" to={`/vallalkozas-inditas/${r.id}`}>
          Megnyitom a vállalkozás-indításnál
        </Link>
      )}
    </div>
  );
}

/** SPEC §27.2.5 + §27.6.4: the client's branch (with history) and his assisted request, on the accountant's Bekötés tab. */
function UtvonalEsHelyettunk({ k }: { k: TeamClientCard }) {
  const a = k.assist ?? null;
  const nalad = !!a && labdaNalam({ status: a.status, ball: ASSIST_BALL[a.status] }, 'konyvelo');
  return (
    <div className={`lap${nalad ? ' fazis aktiv' : ''}`} style={{ marginBottom: 16 }}>
      <div className="lap-fej">
        <I3 n="igazolas" s={36} />
        <h2>Útvonal{a ? ' és „Intézzük helyette”' : ''}</h2>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        <dl className="adatok tomor">
          <dt>Útvonal</dt>
          <dd>
            <Utvonal c={k} />
          </dd>
          {a && (
            <>
              <dt>Kérte</dt>
              <dd>
                {ASSIST_KIND_LABELS[a.kind]}
                <div className="halvany kicsi">{ASSIST_STATUS_LABELS[a.status]}</div>
              </dd>
            </>
          )}
        </dl>
        {a && (
          <div className="gombsor" style={{ marginTop: 10 }}>
            {nalad && <span className="cimke info">Rád vár</span>}
            <Link className={nalad ? 'gomb-e kicsi' : 'gomb-m kicsi csak-szoveg'} to={`/helyettunk/${a.id}`}>
              Megnyitom a lépéseit
            </Link>
          </div>
        )}
        {!a && <p className="halvany kicsi" style={{ marginTop: 8 }}>Ha az ügyfél nem boldogul a meghatalmazással, kérheti, hogy te küldd be („Intézzük helyette”): ilyenkor a csapat felhívja, és itt jelenik meg.</p>}
      </div>
    </div>
  );
}

/** The new-business step is the team's job, never "Rád vár" for the accountant. */
function UjVallalkozasCimke({ s }: { s: StepStatus }) {
  if (s === 'kesz') return null;
  const szoveg = s === 'konyvelore_var' ? 'A csapat nézi' : s === 'hianyos' ? 'Javítania kell' : s === 'kihagyva' ? 'Leállította' : 'Az ügyfél tölti';
  return <span className={`cimke ${s === 'hianyos' ? 'hiba' : 'info'}`}>{szoveg}</span>;
}

/** `sajat`: the step is the accountant's own job (NAV-kapcsolat) – it is addressed to him, not told about the client. */
function StepCimke({ s, sajat }: { s: StepStatus; sajat?: boolean }) {
  if (s === 'kesz') return null;
  const cls = s === 'konyvelore_var' ? 'figyel' : s === 'hianyos' ? 'hiba' : s === 'kihagyva' ? '' : 'info';
  const felirat = sajat && s === 'nincs_kezdve' ? 'Még nem kezdted' : sajat && s === 'ugyfelre_var' ? 'Rád vár' : STEP_STATUS_LABEL[s];
  return <span className={`cimke ${sajat && s === 'ugyfelre_var' ? 'figyel' : cls}`}>{felirat}</span>;
}

export function MegjegyzesFiok({
  nyitva,
  cim,
  bev,
  gomb,
  bezar,
  kuld,
  folyamatban,
  kotelezo = true,
  kezdo = '',
  hossz = 1000,
}: {
  nyitva: boolean;
  cim: string;
  bev: string;
  gomb: string;
  bezar: () => void;
  kuld: (note: string) => void;
  folyamatban?: boolean;
  kotelezo?: boolean;
  /** Prefilled text (e.g. the published letter when it is corrected). */
  kezdo?: string;
  hossz?: number;
}) {
  const [note, setNote] = useState(kezdo);
  useEffect(() => {
    if (nyitva) setNote(kezdo);
  }, [nyitva, kezdo]);
  return (
    <Fiok
      nyitva={nyitva}
      bezar={bezar}
      cim={cim}
      bev={bev}
      lab={
        <button className="gomb-e" disabled={(kotelezo && !note.trim()) || folyamatban} onClick={() => kuld(note.trim())}>
          {gomb}
        </button>
      }
    >
      <textarea className="doboz" rows={kezdo ? 9 : 5} maxLength={hossz} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
    </Fiok>
  );
}

function KycFiok({ c, nyitva, bezar }: FulProps & { nyitva: boolean; bezar: () => void }) {
  const qc = useQueryClient();
  const pir = usePirito();
  const nev = useKonyveloNev();
  const q = useQuery({ queryKey: ['acc', 'kyc', c.id], queryFn: () => ep.accKyc(c.id), enabled: nyitva });
  const [kepek, setKepek] = useState<Record<string, string>>({});
  const [hianyos, setHianyos] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    let elo = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const [k, id] of Object.entries(q.data.files)) {
        if (!id) continue;
        try {
          out[k] = (await ep.fileLink(id)).url;
        } catch {
          /* shown as missing */
        }
      }
      if (elo) setKepek(out);
    })();
    return () => {
      elo = false;
    };
  }, [q.data]);
  const dont = useMutation({
    mutationFn: (x: { status: 'elfogadva' | 'hianyos'; note?: string }) => ep.accKycReview(c.id, x.status, x.note),
    onSuccess: (_d, x) => {
      pir.ok(x.status === 'elfogadva' ? 'Elfogadtad az azonosítást.' : 'Visszaküldted pótlásra.');
      setHianyos(false);
      bezar();
      void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
      void qc.invalidateQueries({ queryKey: ['acc', 'kyc', c.id] });
    },
    onError: pir.hiba,
  });
  const d = q.data;
  // Pmt. 7. § (8) a): only the address side of the lakcímkártya exists here (SPEC §26.1.9) – never a back-side box,
  // even if an old row still had a file id. idBack is optional (passport).
  const FELIRAT: Record<string, string> = { idFront: 'Okmány, eleje', idBack: 'Okmány, hátulja', addressFront: 'Lakcímkártya, címoldal' };
  return (
    <>
      <Fiok
        nyitva={nyitva && !hianyos}
        bezar={bezar}
        szeles
        ikon="fiok"
        cim={`Azonosítás – ${c.name}`}
        bev={`Pénzmosás elleni azonosítás (Pmt.). Titkosítva tároljuk, csak ${nev} látja. Minden megnyitást naplózunk.`}
        lab={
          d && d.status === 'bekuldve' ? (
            <>
              <button className="gomb-e" disabled={dont.isPending} onClick={() => dont.mutate({ status: 'elfogadva' })}>
                Elfogadom
              </button>
              <button className="gomb-m csak-szoveg" onClick={() => setHianyos(true)}>
                Hiányos, visszaküldöm
              </button>
            </>
          ) : d ? (
            <span className="allapot">
              {d.status === 'elfogadva' && <I3 n="befizetve_jel" s={18} />}
              <span className="szo">{KYC_LABEL[d.status]}</span>
              {d.reviewNote ? ` – „${d.reviewNote}”` : ''}
            </span>
          ) : null
        }
      >
        {q.isPending && <Toltes />}
        {q.isError && <HibaSav hiba={q.error} />}
        {d && (
          <div className="kyc-racs">
            <div>
              <div className="okmanyok">
                {(['idFront', 'idBack', 'addressFront'] as const).filter((k) => d.files[k] || k === 'idFront' || k === 'addressFront').map((k) => (
                  <figure className="okmany" key={k}>
                    {kepek[k] && d.fileMimes?.[k] === 'application/pdf' ? (
                      <a href={kepek[k]} target="_blank" rel="noopener noreferrer" className="betoltes" style={{ aspectRatio: '1.586', display: 'grid', placeItems: 'center', textDecoration: 'none' }}>
                        <span style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                          <I3 n="irat" s={44} />
                          <span className="gomb-sz">PDF – megnyitom</span>
                        </span>
                      </a>
                    ) : kepek[k] ? (
                      <a href={kepek[k]} target="_blank" rel="noopener noreferrer" title="Megnyitás nagyban">
                        <img src={kepek[k]} alt={FELIRAT[k]} />
                      </a>
                    ) : (
                      <div className="betoltes" style={{ aspectRatio: '1.586' }}>{d.files[k] ? 'Töltöm…' : 'Nincs feltöltve'}</div>
                    )}
                    <figcaption className="felirat">{FELIRAT[k]}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="halvany kicsi" style={{ marginTop: 8 }}>Kattints egy képre, ha nagyban néznéd meg.</p>
            </div>
            <div className="oszlop" style={{ gap: 18 }}>
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Adatok (Pmt. 7. §)</h3>
                <dl className="adatok" style={{ gridTemplateColumns: '160px 1fr', fontSize: 14.5 }}>
                  {Object.entries(d.data)
                    .sort(([a], [b]) => kycSorrend(a) - kycSorrend(b))
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'contents' }}>
                        <dt>{KYC_FIELD_LABELS[k] ?? k}</dt>
                        <dd className={k === 'documentNumber' ? 'szam' : undefined}>{kycErtek(k, v)}</dd>
                      </div>
                    ))}
                </dl>
              </div>
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Nyilatkozatok</h3>
                <ul style={{ paddingLeft: 18, display: 'grid', gap: 6, fontSize: 14.5 }}>
                  <li>{d.declarations.ownBehalf ? 'Saját nevében jár el (tényleges tulajdonos önmaga).' : 'NEM saját nevében jár el – kérdezz rá!'}</li>
                  <li>{d.declarations.pep ? `Kiemelt közszereplő: ${d.declarations.pepDetails ?? 'igen'}` : 'Nem kiemelt közszereplő.'}</li>
                  <li>Aláírva: {idopont(d.declarations.signedAt, today())}</li>
                </ul>
                <p className="halvany kicsi" style={{ marginTop: 12 }}>
                  Megőrzés: az üzleti kapcsolat megszűnése után 8 évig (Pmt. 56–57. §), utána töröljük.
                </p>
              </div>
            </div>
          </div>
        )}
      </Fiok>
      <MegjegyzesFiok
        nyitva={nyitva && hianyos}
        cim="Mit kell pótolnia?"
        bev="Pl. „A lakcímkártya címoldala homályos, fotózd le újra világosban.”"
        gomb="Visszaküldöm"
        bezar={() => setHianyos(false)}
        kuld={(note) => dont.mutate({ status: 'hianyos', note })}
        folyamatban={dont.isPending}
      />
    </>
  );
}

function NavKapcsolat({ c }: FulProps) {
  const qc = useQueryClient();
  const pir = usePirito();
  const n = c.nav;
  const [nyitva, setNyitva] = useState(n.status === 'nincs');
  const lapRef = useRef<HTMLDivElement>(null);
  const [f, setF] = useState({ login: '', password: '', signatureKey: '', exchangeKey: '', taxNumber: (c.adoszam ?? '').slice(0, 8) });
  const runs = useQuery({ queryKey: ['acc', 'navruns', c.id], queryFn: () => ep.accNavSyncRuns(c.id), enabled: n.status !== 'nincs' });
  const inv = () => {
    void qc.invalidateQueries({ queryKey: ['acc', 'client', c.id] });
    void qc.invalidateQueries({ queryKey: ['acc', 'navruns', c.id] });
  };
  const ment = useMutation({
    mutationFn: () => ep.accNavSave(c.id, { login: f.login.trim(), password: f.password, signatureKey: f.signatureKey.trim(), exchangeKey: f.exchangeKey.trim() || undefined, taxNumber: f.taxNumber.trim() }),
    onSuccess: () => {
      pir.ok('Elmentve, titkosítva. Most ellenőrizd a kapcsolatot.');
      setF({ ...f, login: '', password: '', signatureKey: '', exchangeKey: '' });
      setNyitva(false);
      inv();
      // The form collapses: keep the NAV card (status + "Ellenőrzöm") in view instead of jumping below it.
      requestAnimationFrame(() => lapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior }));
    },
    onError: pir.hiba,
  });
  const teszt = useMutation({
    mutationFn: () => ep.accNavTest(c.id),
    onSuccess: (r) => {
      if (r.ok) pir.ok(r.messageHu || 'A kapcsolat rendben.');
      else pir.hibaSzoveg(r.messageHu || 'A kapcsolat nem jó. Nézd meg az adatokat.');
      inv();
    },
    onError: pir.hiba,
  });
  const sync = useMutation({ mutationFn: () => ep.accNavSync(c.id), onSuccess: () => { pir.ok('Elindult a letöltés a NAV rendszeréből. Pár perc.'); inv(); }, onError: pir.hiba });
  const torol = useMutation({ mutationFn: () => ep.accNavDelete(c.id), onSuccess: () => { pir.ok('A NAV-kapcsolatot töröltük.'); setNyitva(true); inv(); }, onError: pir.hiba });

  const hibak: string[] = [];
  if (f.taxNumber && !torzsszamOk(f.taxNumber)) hibak.push('Az adószám első 8 jegye nem jó (ellenőrző számjegy).');
  // A NAV technikai felhasználó neve 6–15 betű vagy szám (ugyanaz a szabály, mint a szerveren).
  if (f.login.trim() && !/^[A-Za-z0-9]{6,15}$/.test(f.login.trim())) hibak.push('A technikai felhasználó neve 6–15 betű vagy szám lehet, szóköz, ékezet és aláhúzás nélkül.');
  const kesz = f.login.trim() && f.password && f.signatureKey.trim() && f.taxNumber && hibak.length === 0;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (kesz) ment.mutate();
  }
  return (
    <div className="lap" ref={lapRef} style={{ scrollMarginTop: 16 }}>
      <div className="lap-fej">
        <I3 n="szamlak" s={36} />
        <div>
          <h2>NAV-kapcsolat</h2>
          <div className="megj">Online Számla, csak lekérdezés. A NAV-nak sosem küldünk semmit.</div>
        </div>
      </div>
      <div className="belso" style={{ paddingTop: 0 }}>
        {n.status === 'nincs' ? (
          <div className="uzenet-sav info">Még nincs technikai felhasználó. Amíg nincs, nem tudjuk letölteni a kiállított számláit a NAV Online Számlából.</div>
        ) : (
          <dl className="adatok" style={{ gridTemplateColumns: '150px 1fr', fontSize: 14.5 }}>
            <dt>Állapot</dt>
            <dd>
              {n.status === 'rendben' ? (
                <span className="allapot"><I3 n="befizetve_jel" s={18} /><span className="szo">Rendben</span></span>
              ) : n.status === 'hibas' ? (
                <span className="cimke hiba">Hibás</span>
              ) : (
                <span className="cimke figyel">Még nincs ellenőrizve</span>
              )}
              {n.environment && n.environment !== 'prod' && <span className="cimke demo" style={{ marginLeft: 6 }}>{n.environment === 'demo' ? 'DEMO' : 'NAV teszt'}</span>}
            </dd>
            <dt>Felhasználó</dt>
            <dd className="szam">{n.loginHint ?? '–'}</dd>
            <dt>Adószám</dt>
            <dd className="szam">{n.taxNumber ?? '–'}</dd>
            <dt>Utolsó letöltés</dt>
            <dd>{n.lastSyncAt ? `${idopont(n.lastSyncAt, today())}${n.lastSyncStatus === 'hiba' ? ' – hiba' : ''}` : '–'}</dd>
            {(n.lastTestError || n.lastSyncError) && (
              <>
                <dt>Hiba</dt>
                <dd style={{ color: 'var(--veszely)' }}>{n.lastSyncError ?? n.lastTestError}</dd>
              </>
            )}
          </dl>
        )}
        {n.status !== 'nincs' && (
          <div className="gombsor" style={{ marginTop: 14 }}>
            <button className="gomb-m kicsi csak-szoveg" disabled={teszt.isPending} onClick={() => teszt.mutate()}>
              {teszt.isPending ? 'Ellenőrzöm…' : 'Kapcsolat ellenőrzése'}
            </button>
            <button className="gomb-m kicsi csak-szoveg" disabled={sync.isPending || n.status !== 'rendben'} onClick={() => sync.mutate()}>
              Letöltöm most
            </button>
            <button className="gomb-sz" onClick={() => setNyitva(!nyitva)}>
              {nyitva ? 'Mégse' : 'Új adatok megadása'}
            </button>
          </div>
        )}
        {nyitva && (
          <form onSubmit={submit} style={{ marginTop: 16 }} autoComplete="off">
            <div className="mezosor k2">
              <label className="mezo">
                <span className="felirat">Technikai felhasználónév</span>
                <input className="doboz" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} autoComplete="off" spellCheck={false} maxLength={15} aria-describedby="nav-login-sugo" />
                <span id="nav-login-sugo" className="halvany kicsi">6–15 betű vagy szám</span>
              </label>
              <label className="mezo">
                <span className="felirat">Jelszó</span>
                <input className="doboz" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
              </label>
              <label className="mezo">
                <span className="felirat">XML aláírókulcs</span>
                <input className="doboz" type="password" value={f.signatureKey} onChange={(e) => setF({ ...f, signatureKey: e.target.value })} autoComplete="off" spellCheck={false} />
              </label>
              <label className="mezo">
                <span className="felirat">XML cserekulcs</span>
                <input className="doboz" type="password" value={f.exchangeKey} onChange={(e) => setF({ ...f, exchangeKey: e.target.value })} autoComplete="off" spellCheck={false} />
              </label>
              <label className="mezo">
                <span className="felirat">Az ügyfél adószáma (első 8 jegy)</span>
                <input className="doboz szam" inputMode="numeric" maxLength={8} value={f.taxNumber} onChange={(e) => setF({ ...f, taxNumber: e.target.value.replace(/\D/g, '') })} />
              </label>
            </div>
            {hibak.map((h) => (
              <div key={h} className="uzenet-sav hiba" style={{ marginTop: 10 }}>{h}</div>
            ))}
            <p className="halvany kicsi" style={{ marginTop: 10 }}>
              Titkosítva mentjük, külön kulccsal. Mentés után senki nem látja vissza, te sem – ha változik, add meg újra.
            </p>
            <div className="gombsor" style={{ marginTop: 12 }}>
              <button className="gomb-e" type="submit" disabled={!kesz || ment.isPending}>
                Mentés titkosítva
              </button>
              {n.status !== 'nincs' && (
                <button type="button" className="gomb-v" onClick={() => torol.mutate()}>
                  Kapcsolat törlése
                </button>
              )}
            </div>
          </form>
        )}
        <details className="osszevont" style={{ marginTop: 18 }}>
          <summary>Honnan lesz technikai felhasználó?</summary>
          <ol style={{ paddingLeft: 20, marginTop: 8, display: 'grid', gap: 6, fontSize: 14.5 }}>
            <li>Állandó meghatalmazottként lépj be az onlineszamla.nav.gov.hu oldalra az ügyfél nevében (elsődleges felhasználóként).</li>
            <li>A Felhasználók menüben hozz létre technikai felhasználót, csak „Számlák lekérdezése” joggal.</li>
            <li>Generálj XML aláírókulcsot és XML cserekulcsot, és másold be ide a jelszóval együtt.</li>
            <li>A NAV tesztrendszerének (onlineszamla-test.nav.gov.hu) felhasználója élesben nem működik, és fordítva.</li>
          </ol>
        </details>
        {n.status !== 'nincs' && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 650, marginBottom: 6 }}>Letöltések a NAV rendszeréből</h3>
            {runs.isPending ? (
              <Toltes />
            ) : (runs.data?.items.length ?? 0) === 0 ? (
              <div className="ures" style={{ padding: 10 }}>
                <Targy n="hatarido_naptar" />
                <p>Még nem volt letöltés. Reggel fél hatkor magától lefut, vagy indítsd most.</p>
              </div>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Mikor</th>
                    <th>Eredmény</th>
                    <th className="jobb">Új számla</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data!.items.slice(0, 8).map((r) => (
                    <tr key={r.id}>
                      <td>{idopont(r.startedAt, today())}</td>
                      <td>
                        {r.status === 'ok' ? 'Rendben' : r.status === 'fut' ? 'Fut…' : <span style={{ color: 'var(--veszely)' }}>{r.messageHu ?? r.errorCode ?? 'Hiba'}</span>}
                      </td>
                      <td className="jobb szam">{r.invoicesNew}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
