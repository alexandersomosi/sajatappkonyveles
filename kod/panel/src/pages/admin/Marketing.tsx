// SPEC §31.4: the owner's Marketing tab – visitors (own Umami server, no cookie), where they came from, which video or
// campaign brings them, the funnel to paying, money by source, which parts of the page work, callbacks by source, and the
// (switched-off) ad measurement with the typed-in spend. Aggregates only. The MRR and the subscriptions stay on
// Áttekintés / Előfizetések (linked), the referral codes on Honnan jöttek.
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { MarketingCount, MarketingSummary } from '../../_shared/marketing';
import { CAMPAIGN_SOURCES, MARKETING_CHANNEL_LABELS, MARKETING_UNKNOWN } from '../../_shared/marketing';
import { DemoCimke, Fejlec, Fiok, HibaSav, Lenyilo, Masol, Toltes, Ures } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { I3 } from '../../ui/Icon3d';
import { datumRovid, ft, szam } from '../../lib/format';
import { IDOSZAKOK, arany, kampanyLink, latogatoArany, marketingQuery, type Idoszak } from '../../lib/marketing';
import { today as maIso } from '../../lib/today';

type Ful = 'attekintes' | 'kampanyok' | 'penz' | 'hirdetesek';
const FULEK: [Ful, string][] = [
  ['attekintes', 'Látogatók és tölcsér'],
  ['kampanyok', 'Kampányok és linkek'],
  ['penz', 'Pénz forrásonként'],
  ['hirdetesek', 'Hirdetések'],
];

/** A short list with a bar per row (one hue, labelled values). */
function Lista({ sorok, ures }: { sorok: MarketingCount[] | null; ures: string }) {
  if (!sorok) return <p className="halvany kicsi" style={{ padding: '0 22px 18px' }}>A látogatottsági adat most nem érhető el.</p>;
  const lathato = sorok.filter((s) => s.n > 0);
  if (!lathato.length) return <p className="halvany kicsi" style={{ padding: '0 22px 18px' }}>{ures}</p>;
  const max = Math.max(1, ...lathato.map((s) => s.n));
  return (
    <div className="belso" style={{ paddingTop: 0 }}>
      {lathato.map((s) => (
        <div key={s.key} style={{ marginBottom: 10 }}>
          <div className="sor-flex ter" style={{ fontSize: 14.5 }}>
            <span>{s.label}</span>
            <span className="szam felkover">{szam(s.n)}</span>
          </div>
          <div className="sav" style={{ margin: '5px 0 0' }}>
            <i style={{ width: `${(s.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Kartya({ cim, megj, children, jobb }: { cim: string; megj?: ReactNode; children: ReactNode; jobb?: ReactNode }) {
  return (
    <div className="lap">
      <div className="lap-fej">
        <h2>{cim}</h2>
        {megj && <span className="megj">{megj}</span>}
        {jobb && <span className="jobbra">{jobb}</span>}
      </div>
      {children}
    </div>
  );
}

function Szam({ n }: { n: number | null }) {
  return <span className="szam">{n === null ? '–' : szam(n)}</span>;
}

export default function Marketing() {
  const [sp, setSp] = useSearchParams();
  const ful = (FULEK.some(([k]) => k === sp.get('ful')) ? sp.get('ful') : 'attekintes') as Ful;
  const [idoszak, setIdoszak] = useState<Idoszak>('30');
  const [tol, setTol] = useState('');
  const [ig, setIg] = useState('');
  const query = marketingQuery(idoszak, tol, ig);
  const q = useQuery({ queryKey: ['admin', 'marketing', query], queryFn: () => ep.adminMarketing(query) });
  const d = q.data;
  // the money is the state of today: the range does not change it, so the selector is not shown there
  const idoszakKell = ful !== 'penz';
  const egyeni = () => {
    // the fields start with the range on the screen (never empty)
    if (!tol || !ig) {
      setTol(d?.range.from ?? maIso());
      setIg(d?.range.to ?? maIso());
    }
    setIdoszak('egyeni');
  };
  const tolValt = (v: string) => {
    setTol(v);
    if (v && ig && v > ig) setIg(v);
  };
  const igValt = (v: string) => {
    setIg(v);
    if (v && tol && v < tol) setTol(v);
  };
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Marketing"
        mellek="Honnan jönnek a látogatók, és kikből lesz fizető ügyfél. A látogatókat a saját szerverünk méri, süti nélkül; minden más a saját adatbázisunkból jön."
        fulek={
          <>
            {FULEK.map(([k, f]) => (
              <button key={k} className={`ful${ful === k ? ' on' : ''}`} onClick={() => setSp({ ful: k }, { replace: true })}>
                {f}
              </button>
            ))}
          </>
        }
      />
      <div className="tartalom">
        <div className="sor-flex" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          {idoszakKell ? (
          <>
          <div className="szegmens" role="group" aria-label="Időszak">
            {IDOSZAKOK.map((i) => (
              <button key={i.kulcs} type="button" className={idoszak === i.kulcs ? 'on' : ''} aria-pressed={idoszak === i.kulcs} onClick={() => setIdoszak(i.kulcs)}>
                {i.felirat}
              </button>
            ))}
            <button type="button" className={idoszak === 'egyeni' ? 'on' : ''} aria-pressed={idoszak === 'egyeni'} onClick={egyeni}>
              Egyéni
            </button>
          </div>
          {idoszak === 'egyeni' && (
            <>
              <input className="doboz" type="date" aria-label="Ettől" style={{ width: 160 }} max={ig || maIso()} value={tol} onChange={(e) => tolValt(e.target.value)} />
              <span className="halvany kicsi">–</span>
              <input className="doboz" type="date" aria-label="Eddig" style={{ width: 160 }} min={tol || undefined} max={maIso()} value={ig} onChange={(e) => igValt(e.target.value)} />
            </>
          )}
          {d && (
            <span className="halvany kicsi">
              {datumRovid(d.range.from)} – {datumRovid(d.range.to)}
            </span>
          )}
          </>
          ) : (
            <span className="halvany kicsi">Mostani állapot (nem függ az időszaktól)</span>
          )}
          {d?.demo && <DemoCimke>DEMO</DemoCimke>}
        </div>
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        {q.isPending ? (
          <Toltes />
        ) : (
          d && (
            <>
              {d.demo && (
                <div className="uzenet-sav figyel" style={{ marginBottom: 16 }}>
                  DEMO szerver: a regisztrációk és a fizetések kitalált adatok, a látogatók között valódiak is lehetnek. Az arányokból most ne vonj le következtetést.
                </div>
              )}
              {!d.stats.available && d.stats.reason && (ful === 'attekintes' || ful === 'kampanyok') && (
                <div className="uzenet-sav info" style={{ marginBottom: 16 }}>
                  {d.stats.reason}
                </div>
              )}
              {ful === 'attekintes' && <Attekintes d={d} />}
              {ful === 'kampanyok' && <Kampanyok d={d} />}
              {ful === 'penz' && <Penz d={d} />}
              {ful === 'hirdetesek' && <Hirdetesek d={d} />}
            </>
          )
        )}
      </div>
    </>
  );
}

const LEPES = { reg: 'Regisztrált', adatok: 'Kitöltötte az adatait', szerzodes: 'Elfogadta a szerződést', fizeto: 'Fizető lett' };

function Attekintes({ d }: { d: MarketingSummary }) {
  const t = d.funnel.total;
  // the steps after the registration are measured against the registered (a visitor count of hundreds would make them dots)
  const lepcsok = [
    { k: LEPES.reg, n: t.registered },
    { k: LEPES.adatok, n: t.dataDone },
    { k: LEPES.szerzodes, n: t.contractAccepted },
    { k: LEPES.fizeto, n: t.paying },
  ];
  const max = Math.max(1, t.registered);
  const semmi = !t.registered && !(d.visitors?.visitors ?? 0);
  // the registrations from before the source was recorded have no visit behind them: left out of the visitor rate
  const ismeretlen = d.funnel.byChannel.find((x) => x.channel === MARKETING_UNKNOWN)?.registered ?? 0;
  const merve = t.registered - ismeretlen;
  const latogatoSor =
    t.visitors === null
      ? 'A látogatók száma most nem ismert.'
      : merve <= t.visitors
        ? `${szam(t.visitors)} látogatóból ${szam(merve)} regisztrált (${arany(merve, t.visitors)}).${ismeretlen ? ` A mérés előtt regisztrált ${szam(ismeretlen)} ügyfél ebben nincs benne.` : ''}`
        : `${szam(t.visitors)} látogató, ${szam(merve)} regisztrált. Arányt itt nem számolunk: a látogatók mérése később indult, mint ezek a regisztrációk.`;
  return (
    <>
      <div className="racs k4">
        <div className="lap kpi">
          <I3 n="emberek" s={34} />
          <div>
            <div className="ertek">
              <Szam n={d.visitors ? d.visitors.visitors : null} />
            </div>
            <div className="mi">látogató{d.visitors ? `, ${szam(d.visitors.pageviews)} oldalmegtekintés` : ''}</div>
          </div>
        </div>
        <div className="lap kpi">
          <I3 n="irat-toll" s={34} />
          <div>
            <div className="ertek szam">{szam(t.registered)}</div>
            <div className="mi">regisztrált (megerősített e-mail-címmel)</div>
          </div>
        </div>
        <div className="lap kpi">
          <I3 n="pipa-kor" s={34} />
          <div>
            <div className="ertek szam">{szam(t.paying)}</div>
            <div className="mi">lett fizető ügyfél ezek közül</div>
          </div>
        </div>
        <Link to="/admin/elofizetesek" className="lap kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <I3 n="tarca" s={34} />
          <div>
            <div className="ertek szam">{ft(d.money.mrrHuf)}</div>
            <div className="mi">havi bevétel most ({szam(d.money.payingNow)} fizető ügyfél)</div>
          </div>
        </Link>
      </div>
      {semmi ? (
        <div className="uzenet-sav info" style={{ marginTop: 16 }}>
          {d.stats.available
            ? 'Ebben az időszakban még nem jött senki. Ha egy videó leírásába vagy egy bejegyzésbe kampánylinket teszel, itt látod majd, hányan jöttek rajta, és kikből lett ügyfél (a link a „Kampányok és linkek” fülön készül).'
            : 'Ebben az időszakban nem volt regisztráció. A látogatók száma a statisztika beállítása után jelenik meg itt.'}
        </div>
      ) : null}
      <div className="racs k2" style={{ marginTop: 16 }}>
        <Kartya cim="Tölcsér" megj="az ebben az időszakban regisztráltak">
          <div className="belso" style={{ paddingTop: 0 }}>
            <p className="kicsi" style={{ marginBottom: 12 }}>
              {latogatoSor}
            </p>
            {lepcsok.map((l, i) => (
              <div key={l.k} style={{ marginBottom: 12 }}>
                <div className="sor-flex ter" style={{ fontSize: 14.5 }}>
                  <span>{l.k}</span>
                  <span className="szam felkover">
                    {szam(l.n)}
                    {i > 0 && t.registered ? <span className="halvany" style={{ fontWeight: 400 }}> · {arany(l.n, t.registered)}</span> : null}
                  </span>
                </div>
                <div className="sav" style={{ margin: '6px 0 0' }}>
                  <i style={{ width: `${(l.n / max) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="halvany kicsi">
              A százalék a regisztráltakhoz képest értendő. Itt csak az ebben az időszakban regisztráltak számítanak; az <Link to="/admin">Áttekintés</Link> bekötési tölcsére minden ügyfelet mutat.
            </p>
          </div>
        </Kartya>
        <Kartya cim="Az oldal részei" megj="hányszor kattintottak az adozz.hu gombjaira, és hányszor görgettek az árakig">
          <Lista sorok={d.events} ures="Ebben az időszakban még nem kattintott senki." />
        </Kartya>
      </div>
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <h2>Források</h2>
          <span className="megj">A regisztrációk a regisztráció napja szerint, a látogatók a látogatás napja szerint számítanak.</span>
        </div>
        <table className="tabla">
          <thead>
            <tr>
              <th className="elso">Forrás</th>
              <th className="jobb">Látogató</th>
              <th className="jobb">{LEPES.reg}</th>
              <th className="jobb">{LEPES.adatok}</th>
              <th className="jobb">{LEPES.szerzodes}</th>
              <th className="jobb">{LEPES.fizeto}</th>
              <th className="jobb utolso">Látogatóból regisztrált</th>
            </tr>
          </thead>
          <tbody>
            {d.funnel.byChannel.map((r) => (
              <tr key={r.channel} style={!r.registered && !r.visitors ? { opacity: 0.55 } : undefined}>
                <td className={`elso felkover${r.channel === MARKETING_UNKNOWN ? ' halvany' : ''}`}>{r.label}</td>
                <td className="jobb">
                  <Szam n={r.visitors} />
                </td>
                <td className="jobb szam">{r.registered}</td>
                <td className="jobb szam">{r.dataDone}</td>
                <td className="jobb szam">{r.contractAccepted}</td>
                <td className="jobb szam">{r.paying}</td>
                <td className="jobb szam utolso">{latogatoArany(r.registered, r.visitors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="halvany kicsi" style={{ padding: '10px 22px 16px' }}>
          Az Instagram és a TikTok beépített böngészője gyakran nem árulja el, honnan jött a látogató: ilyenkor „Közvetlen” lesz. Ezért érdemes kampánylinket használni. A hirdetésblokkolók miatt a látogatók száma kevesebb lehet a valóságosnál.
          {d.unknownClients ? ' Az „Ismeretlen (a mérés előtt)” azok az ügyfelek, akik még a forrás mentése előtt regisztráltak.' : ''}
        </p>
      </div>
      <div className="racs k3" style={{ marginTop: 16 }}>
        <Kartya cim="Telefon vagy gép">
          <Lista sorok={d.devices} ures="Még nincs adat." />
        </Kartya>
        <Kartya cim="Ország">
          <Lista sorok={d.countries} ures="Még nincs adat." />
        </Kartya>
        <Kartya cim="Város">
          <Lista sorok={d.cities} ures="Még nincs adat." />
        </Kartya>
      </div>
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <h2>Visszahívás-kérések forrásonként</h2>
          <span className="megj">{szam(d.callbacks.total)} kérés ebben az időszakban</span>
          <Link className="gomb-sz jobbra" to="/visszahivasok">
            Visszahívások
          </Link>
        </div>
        {d.callbacks.rows.length ? (
          <Lista sorok={d.callbacks.rows} ures="" />
        ) : (
          <p className="halvany kicsi" style={{ padding: '0 22px 18px' }}>
            Ebben az időszakban nem kért visszahívást senki.
          </p>
        )}
      </div>
    </>
  );
}

function Kampanyok({ d }: { d: MarketingSummary }) {
  const [u, setU] = useState({ forras: 'youtube', kampany: '', tartalom: '', medium: '' });
  const link = kampanyLink(d.landingUrl, u);
  const javasolt = CAMPAIGN_SOURCES.find((s) => s.source === u.forras)?.medium ?? '';
  return (
    <>
      <div className="lap">
        <div className="lap-fej">
          <h2>Kampánylink-készítő</h2>
          <span className="megj">Például egy YouTube-videó leírásába: így látod, melyik videó hozza az ügyfeleket.</span>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          <div className="mezosor k2">
            <label className="mezo">
              <span className="felirat">Hova teszed?</span>
              <Lenyilo value={u.forras} onChange={(e) => setU({ ...u, forras: e.target.value, medium: '' })}>
                {CAMPAIGN_SOURCES.map((s) => (
                  <option key={s.source} value={s.source}>
                    {s.label}
                  </option>
                ))}
              </Lenyilo>
            </label>
            <label className="mezo">
              <span className="felirat">Kampány (például a videó címe)</span>
              <input className="doboz" value={u.kampany} maxLength={120} onChange={(e) => setU({ ...u, kampany: e.target.value })} placeholder="Átalányadó 2027 – röviden" />
            </label>
          </div>
          <details style={{ marginTop: 14 }}>
            <summary className="kicsi" style={{ cursor: 'pointer' }}>
              Haladó (nem kötelező, nyugodtan hagyd üresen)
            </summary>
            <div className="mezosor k2" style={{ marginTop: 10 }}>
              <label className="mezo">
                <span className="felirat">Részlet</span>
                <input className="doboz" value={u.tartalom} maxLength={60} onChange={(e) => setU({ ...u, tartalom: e.target.value })} placeholder="leiras" />
                <span className="halvany kicsi">Ha egy videóban több link is van, így választod szét őket: például „leiras” és „komment”.</span>
              </label>
              <label className="mezo">
                <span className="felirat">Fajta</span>
                <input className="doboz" value={u.medium} maxLength={30} onChange={(e) => setU({ ...u, medium: e.target.value })} placeholder={javasolt} />
                <span className="halvany kicsi">Magától kitöltjük ({javasolt || 'nincs'}). A fizetett hirdetésnél maradjon így: ebből tudjuk, mi jött hirdetésből.</span>
              </label>
            </div>
          </details>
          <div className="uzenet-sav info" style={{ marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {link ? (
              <>
                <code style={{ flex: 1, overflowWrap: 'anywhere', fontSize: 14 }}>{link}</code>
                <Masol ertek={link} felirat="Link másolása" />
              </>
            ) : (
              <span>Írd be a kampány nevét, és itt lesz a kész link.</span>
            )}
          </div>
          <p className="halvany kicsi" style={{ marginTop: 10 }}>
            A nevekből kisbetűs, ékezet nélküli változat lesz, hogy ugyanaz a kampány mindenhol egy sorban jelenjen meg. A link a nyitóoldalra visz; onnan a Regisztrálok gomb viszi tovább a forrást.
          </p>
        </div>
      </div>
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <h2>Kampányok</h2>
          <span className="megj">a kampánylinkkel érkezők ebben az időszakban</span>
          <Link className="gomb-sz jobbra" to="/admin/forrasok">
            Ajánlókódok
          </Link>
        </div>
        {d.campaigns.length === 0 ? (
          <Ures n="ures_mappa" cim="Még nincs kampánylinkkel érkezett látogató">
            Készíts egy linket fent, és tedd be egy videó leírásába.
          </Ures>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso">Kampány</th>
                <th>Forrás</th>
                <th className="jobb">Látogató</th>
                <th className="jobb">Regisztrált</th>
                <th className="jobb">Fizető</th>
                <th className="jobb utolso">Havi bevétel most</th>
              </tr>
            </thead>
            <tbody>
              {d.campaigns.map((c, i) => (
                <tr key={i}>
                  <td className="elso felkover">{c.campaign ?? '–'}</td>
                  <td>{c.source ? MARKETING_CHANNEL_LABELS[c.channel] : '–'}</td>
                  <td className="jobb" title={c.sharedName ? 'Ezt a kampánynevet több forrás is használja, a látogatókat a statisztika csak név szerint számolja.' : undefined}>
                    {c.sharedName ? <span className="halvany">közös név</span> : <Szam n={c.visitors} />}
                  </td>
                  <td className="jobb szam">{c.registered}</td>
                  <td className="jobb szam">{c.paying}</td>
                  <td className="jobb szam utolso">{c.mrrHuf ? ft(c.mrrHuf) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d.campaigns.some((c) => c.sharedName) && (
          <p className="halvany kicsi" style={{ padding: '10px 22px 16px' }}>
            „közös név”: ugyanazt a kampánynevet több helyen is használtad. A statisztika a látogatókat csak név szerint számolja, ezért ott nem írunk számot. Adj minden helynek saját kampánynevet.
          </p>
        )}
      </div>
    </>
  );
}

function Penz({ d }: { d: MarketingSummary }) {
  const m = d.money;
  return (
    <div className="lap">
      <div className="lap-fej">
        <h2>Pénz forrásonként</h2>
        <span className="megj">most fizető ügyfelek és a havi bevételük, aszerint, honnan jöttek</span>
        <Link className="gomb-sz jobbra" to="/admin/elofizetesek">
          Előfizetések
        </Link>
      </div>
      <table className="tabla">
        <thead>
          <tr>
            <th className="elso">Forrás</th>
            <th className="jobb">Most fizet</th>
            <th className="jobb">Havi bevétel</th>
            <th className="jobb utolso">Valaha fizetett</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r) => (
            <tr key={r.channel} style={!r.everPaid ? { opacity: 0.55 } : undefined}>
              <td className="elso felkover">{r.label}</td>
              <td className="jobb szam">{r.payingNow}</td>
              <td className="jobb szam">{r.mrrHuf ? ft(r.mrrHuf) : '–'}</td>
              <td className="jobb szam utolso">{r.everPaid}</td>
            </tr>
          ))}
          <tr>
            <td className="elso felkover">Összesen</td>
            <td className="jobb szam felkover">{m.payingNow}</td>
            <td className="jobb szam felkover">{ft(m.mrrHuf)}</td>
            <td className="jobb szam utolso felkover">{m.rows.reduce((a, r) => a + r.everPaid, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p className="halvany kicsi" style={{ padding: '10px 22px 16px' }}>
        {m.note} Az Áttekintés havi bevétele: {ft(m.dashboardMrrHuf)}. A pénz nem függ az időszaktól: ez a mostani állapot. A forrás a regisztrációé; aki a forrás mentése előtt regisztrált, az „Ismeretlen (a mérés előtt)” sorban van (ha kampánylinkkel jött, annak a forrásánál).
      </p>
    </div>
  );
}

function Hirdetesek({ d }: { d: MarketingSummary }) {
  const a = d.ads;
  const qc = useQueryClient();
  const pir = usePirito();
  const [uj, setUj] = useState(false);
  const [f, setF] = useState({ day: maIso(), platform: 'meta' as 'meta' | 'google' | 'egyeb', campaign: '', amount: '', note: '' });
  const osszeg = Number(f.amount.replace(/\s/g, ''));
  const add = useMutation({
    mutationFn: () => ep.adminMarketingSpendAdd({ day: f.day, platform: f.platform, campaign: f.campaign.trim() || undefined, amountHuf: osszeg, note: f.note.trim() || undefined }),
    onSuccess: () => {
      pir.ok(f.day < d.range.from || f.day > d.range.to ? 'Rögzítettem. Ez a nap kívül esik a kiválasztott időszakon, ezért a listában akkor látod, ha arra az időszakra váltasz.' : 'Rögzítettem a költést.');
      setUj(false);
      setF({ ...f, campaign: '', amount: '', note: '' });
      void qc.invalidateQueries({ queryKey: ['admin', 'marketing'] });
    },
    onError: pir.hiba,
  });
  const vissza = useMutation({
    mutationFn: (id: string) => ep.adminMarketingSpendRevoke(id),
    onSuccess: () => {
      pir.ok('Visszavontam. A sor áthúzva megmarad.');
      void qc.invalidateQueries({ queryKey: ['admin', 'marketing'] });
    },
    onError: pir.hiba,
  });
  return (
    <>
      <div className="lap">
        <div className="lap-fej">
          <h2>Hirdetési mérés (Facebook, Instagram, Google)</h2>
          <span className="jobbra">{a.enabled ? <span className="cimke info">Bekapcsolva: {[a.meta ? 'Meta' : '', a.google ? 'Google' : ''].filter(Boolean).join(', ')}</span> : <span className="cimke">Kikapcsolva</span>}</span>
        </div>
        <div className="belso" style={{ paddingTop: 0 }}>
          {a.enabled ? (
            <p>
              Csak annál a látogatónál mérünk, aki a süti-ablakban elfogadta. A szerver a regisztrációt és az első fizetést jelzi, az e-mail-címet kódolva; adóadatot soha. Elküldve: {szam(a.sent)}, várakozik: {szam(a.queued)}
              {a.failed ? `, hibás: ${szam(a.failed)}` : ''}.
            </p>
          ) : (
            <>
              <p>
                Elő van készítve, de ki van kapcsolva. Most az oldal nem tölt be hirdetési kódot, nem jelenik meg süti-ablak, és semmilyen adat nem megy a Metának vagy a Google-nek.
              </p>
              <ol style={{ margin: '10px 0 0 20px', lineHeight: 1.6 }}>
                <li>A Meta (Facebook) hirdetési fiókodban létrehozod a mérőkódot, és kérsz hozzá egy kulcsot; a Google Ads-fiókodban beállítod, mit számoljon (regisztráció, első fizetés).</li>
                <li>A gépeden lefuttatod a hirdetes_kulcsok.ps1 szkriptet: titkosan felviszi a kulcsokat a szerverre.</li>
                <li>Az ügyvéd jóváhagyja az adatkezelési és a süti-tájékoztató hirdetési részét, és élesítjük őket.</li>
                <li>Bekapcsoljuk a nyitóoldalon a süti-ablakot („Elfogadom” és „Elutasítom”); csak ezután mérünk, és csak annál, aki elfogadta.</li>
              </ol>
              <p className="halvany kicsi" style={{ marginTop: 8 }}>
                A lépések részletesen a gépeden: konyvelo_app/kod/MARKETING.md.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <h2>Költés és megtérülés</h2>
          <span className="cimke">becslés</span>
          <span className="megj">a kézzel rögzített hirdetési költés ebben az időszakban: {ft(a.spendHuf)}</span>
          <span className="jobbra">
            <button className="gomb-m kicsi csak-szoveg" onClick={() => setUj(true)}>
              Költést rögzítek
            </button>
          </span>
        </div>
        <table className="tabla">
          <thead>
            <tr>
              <th className="elso">Hirdetési felület</th>
              <th className="jobb">Költés</th>
              <th className="jobb">Hirdetésből regisztrált</th>
              <th className="jobb">Költés / hirdetésből regisztrált</th>
              <th className="jobb">Ebből fizető</th>
              <th className="jobb utolso">Költés / fizető</th>
            </tr>
          </thead>
          <tbody>
            {a.rows
              .filter((r) => r.platform !== 'egyeb' || r.spendHuf > 0)
              .map((r) => (
                <tr key={r.platform}>
                  <td className="elso felkover">{r.label}</td>
                  <td className="jobb szam">{r.spendHuf ? ft(r.spendHuf) : '–'}</td>
                  <td className="jobb szam">{r.platform === 'egyeb' ? '–' : r.registered}</td>
                  <td className="jobb szam">{r.costPerRegistrationHuf !== null ? ft(r.costPerRegistrationHuf) : '–'}</td>
                  <td className="jobb szam">{r.platform === 'egyeb' ? '–' : r.paying}</td>
                  <td className="jobb szam utolso">{r.costPerPayingHuf !== null ? ft(r.costPerPayingHuf) : '–'}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="halvany kicsi" style={{ padding: '10px 22px 16px' }}>
          Csak a fizetett hirdetésből jött regisztrációk számítanak: amelyik a kampánylink-készítő „hirdetés (fizetett)” linkjével jött, vagy a hirdetés saját azonosítójával (ez csak bekapcsolt mérésnél van). A Google-keresésből és a nem fizetett {MARKETING_CHANNEL_LABELS.facebook}-, {MARKETING_CHANNEL_LABELS.instagram}-bejegyzésből jöttek nem számítanak bele. Becslés: a hirdetési felület saját számai eltérhetnek.
        </p>
        {a.spend.length > 0 && (
          <>
          <div className="lap-fej" style={{ borderTop: '1px solid var(--hajszal)' }}>
            <h2>Rögzített költések</h2>
            <span className="megj">ebben az időszakban; a visszavont sor áthúzva megmarad</span>
          </div>
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso">Nap</th>
                <th>Felület</th>
                <th>Kampány</th>
                <th>Megjegyzés</th>
                <th className="jobb">Összeg</th>
                <th className="utolso" />
              </tr>
            </thead>
            <tbody>
              {a.spend.map((s) => (
                <tr key={s.id} style={s.revokedAt ? { opacity: 0.55 } : undefined}>
                  <td className="elso nt" style={s.revokedAt ? { textDecoration: 'line-through' } : undefined}>{datumRovid(s.day)}</td>
                  <td style={s.revokedAt ? { textDecoration: 'line-through' } : undefined}>{s.platform === 'meta' ? 'Meta' : s.platform === 'google' ? 'Google' : 'Egyéb'}</td>
                  <td style={s.revokedAt ? { textDecoration: 'line-through' } : undefined}>{s.campaign ?? '–'}</td>
                  <td className="halvany">{s.note ?? ''}</td>
                  <td className="jobb szam" style={s.revokedAt ? { textDecoration: 'line-through' } : undefined}>{ft(s.amountHuf)}</td>
                  <td className="utolso jobb">
                    {s.revokedAt ? (
                      <span className="cimke">visszavonva</span>
                    ) : (
                      <button
                        className="gomb-v"
                        disabled={vissza.isPending}
                        onClick={() => {
                          if (window.confirm(`Visszavonod ezt a költést (${datumRovid(s.day)}, ${ft(s.amountHuf)})? A sor áthúzva megmarad.`)) vissza.mutate(s.id);
                        }}
                      >
                        Visszavonom
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
      <Fiok
        nyitva={uj}
        bezar={() => setUj(false)}
        ikon="szamolo"
        cim="Hirdetési költés rögzítése"
        bev="Amit a Meta vagy a Google felületén látsz. Elírásnál a sort visszavonhatod; nem törlődik, áthúzva megmarad."
        lab={
          <button className="gomb-e" disabled={!f.day || !(osszeg >= 1) || !Number.isInteger(osszeg) || add.isPending} onClick={() => add.mutate()}>
            Rögzítem
          </button>
        }
      >
        <div className="mezosor k2">
          <label className="mezo">
            <span className="felirat">Nap</span>
            <input className="doboz" type="date" max={maIso()} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} />
          </label>
          <label className="mezo">
            <span className="felirat">Felület</span>
            <Lenyilo value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as 'meta' | 'google' | 'egyeb' })}>
              <option value="meta">Meta (Facebook, Instagram)</option>
              <option value="google">Google</option>
              <option value="egyeb">Egyéb</option>
            </Lenyilo>
          </label>
        </div>
        <label className="mezo" style={{ marginTop: 14 }}>
          <span className="felirat">Összeg (Ft)</span>
          <input className="doboz szam" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d\s]/g, '') })} placeholder="10 000" />
        </label>
        <label className="mezo" style={{ marginTop: 14 }}>
          <span className="felirat">Kampány (ha van)</span>
          <input className="doboz" value={f.campaign} maxLength={100} onChange={(e) => setF({ ...f, campaign: e.target.value })} />
        </label>
        <label className="mezo" style={{ marginTop: 14 }}>
          <span className="felirat">Megjegyzés</span>
          <input className="doboz" value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </label>
      </Fiok>
    </>
  );
}
