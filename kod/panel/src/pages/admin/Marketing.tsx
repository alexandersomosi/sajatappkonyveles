// SPEC §31.4: the owner's Marketing tab – visitors (own Umami server, no cookie), where they came from, which video or
// campaign brings them, the funnel to paying, money by source, which parts of the page work, callbacks by source, and the
// (switched-off) ad measurement with the typed-in spend. Aggregates only. The MRR and the subscriptions stay on
// Áttekintés / Előfizetések (linked), the referral codes on Honnan jöttek.
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { MarketingCount, MarketingSummary } from '../../_shared/marketing';
import { CAMPAIGN_SOURCES, MARKETING_CHANNEL_LABELS } from '../../_shared/marketing';
import { DemoCimke, Fejlec, Fiok, HibaSav, Lenyilo, Masol, Toltes, Ures } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { datumRovid, ft, szam } from '../../lib/format';
import { IDOSZAKOK, arany, kampanyLink, marketingQuery, type Idoszak } from '../../lib/marketing';
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
          <div className="szegmens" role="group" aria-label="Időszak">
            {IDOSZAKOK.map((i) => (
              <button key={i.kulcs} type="button" className={idoszak === i.kulcs ? 'on' : ''} aria-pressed={idoszak === i.kulcs} onClick={() => setIdoszak(i.kulcs)}>
                {i.felirat}
              </button>
            ))}
            <button type="button" className={idoszak === 'egyeni' ? 'on' : ''} aria-pressed={idoszak === 'egyeni'} onClick={() => setIdoszak('egyeni')}>
              Egyéni
            </button>
          </div>
          {idoszak === 'egyeni' && (
            <>
              <input className="doboz" type="date" aria-label="Ettől" style={{ width: 160 }} max={maIso()} value={tol} onChange={(e) => setTol(e.target.value)} />
              <span className="halvany kicsi">–</span>
              <input className="doboz" type="date" aria-label="Eddig" style={{ width: 160 }} max={maIso()} value={ig} onChange={(e) => setIg(e.target.value)} />
            </>
          )}
          {d && (
            <span className="halvany kicsi">
              {datumRovid(d.range.from)} – {datumRovid(d.range.to)}
            </span>
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
              {!d.stats.available && d.stats.reason && (
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

function Attekintes({ d }: { d: MarketingSummary }) {
  const t = d.funnel.total;
  const lepcsok = [
    { k: 'Látogató', n: t.visitors },
    { k: 'Regisztrált', n: t.registered },
    { k: 'Adatok kész', n: t.dataDone },
    { k: 'Szerződés elfogadva', n: t.contractAccepted },
    { k: 'Fizető', n: t.paying },
  ];
  const max = Math.max(1, ...lepcsok.map((l) => l.n ?? 0));
  const semmi = !t.registered && !(d.visitors?.visitors ?? 0);
  return (
    <>
      <div className="racs k4">
        <div className="lap kpi">
          <div>
            <div className="ertek">
              <Szam n={d.visitors ? d.visitors.visitors : null} />
            </div>
            <div className="mi">látogató{d.visitors ? `, ${szam(d.visitors.pageviews)} oldalmegtekintés` : ''}</div>
          </div>
        </div>
        <div className="lap kpi">
          <div>
            <div className="ertek szam">{szam(t.registered)}</div>
            <div className="mi">regisztrált (megerősített e-mail-címmel)</div>
          </div>
        </div>
        <div className="lap kpi">
          <div>
            <div className="ertek szam">{szam(t.paying)}</div>
            <div className="mi">lett fizető ügyfél ezek közül</div>
          </div>
        </div>
        <Link to="/admin/elofizetesek" className="lap kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div>
            <div className="ertek szam">{ft(d.money.mrrHuf)}</div>
            <div className="mi">havi bevétel most ({szam(d.money.payingNow)} fizető ügyfél)</div>
          </div>
        </Link>
      </div>
      {semmi ? (
        <div className="lap" style={{ marginTop: 16 }}>
          <Ures n="ures_mappa" cim="Ebben az időszakban még nem jött senki">
            Ha egy videó leírásába vagy egy bejegyzésbe kampánylinket teszel, itt látod majd, hányan jöttek rajta, és kikből lett ügyfél. A linket a „Kampányok és linkek” fülön készítheted el.
          </Ures>
        </div>
      ) : null}
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <h2>Honnan jöttek</h2>
          <span className="megj">A regisztrációk a regisztráció napja szerint, a látogatók a látogatás napja szerint számítanak.</span>
        </div>
        <table className="tabla">
          <thead>
            <tr>
              <th className="elso">Forrás</th>
              <th className="jobb">Látogató</th>
              <th className="jobb">Regisztrált</th>
              <th className="jobb">Adatok kész</th>
              <th className="jobb">Szerződés</th>
              <th className="jobb">Fizető</th>
              <th className="jobb utolso">Látogatóból regisztrált</th>
            </tr>
          </thead>
          <tbody>
            {d.funnel.byChannel.map((r) => (
              <tr key={r.channel} style={!r.registered && !r.visitors ? { opacity: 0.55 } : undefined}>
                <td className="elso felkover">{r.label}</td>
                <td className="jobb">
                  <Szam n={r.visitors} />
                </td>
                <td className="jobb szam">{r.registered}</td>
                <td className="jobb szam">{r.dataDone}</td>
                <td className="jobb szam">{r.contractAccepted}</td>
                <td className="jobb szam">{r.paying}</td>
                <td className="jobb szam utolso">{arany(r.registered, r.visitors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="halvany kicsi" style={{ padding: '10px 22px 16px' }}>
          Az Instagram és a TikTok beépített böngészője gyakran nem árulja el, honnan jött a látogató: ilyenkor „Közvetlen” lesz. Ezért érdemes kampánylinket használni. A hirdetésblokkolók miatt a látogatók száma kevesebb lehet a valóságosnál.
        </p>
      </div>
      <div className="racs k2" style={{ marginTop: 16 }}>
        <Kartya cim="Tölcsér" megj="ebben az időszakban">
          <div className="belso" style={{ paddingTop: 0 }}>
            {lepcsok.map((l, i) => (
              <div key={l.k} style={{ marginBottom: 12 }}>
                <div className="sor-flex ter" style={{ fontSize: 14.5 }}>
                  <span>{l.k}</span>
                  <span className="szam felkover">
                    {l.n === null ? '–' : szam(l.n)}
                    {i > 1 && l.n !== null && lepcsok[1]!.n ? <span className="halvany" style={{ fontWeight: 400 }}> · {arany(l.n, lepcsok[1]!.n)}</span> : null}
                  </span>
                </div>
                <div className="sav" style={{ margin: '6px 0 0' }}>
                  <i style={{ width: `${((l.n ?? 0) / max) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="halvany kicsi">
              A százalék a regisztráltakhoz képest értendő. A bekötés részletei az <Link to="/admin">Áttekintésen</Link> vannak.
            </p>
          </div>
        </Kartya>
        <Kartya cim="Az oldal részei" megj="kattintások és görgetés az adozz.hu-n">
          <Lista sorok={d.events} ures="Ebben az időszakban még nem kattintott senki." />
        </Kartya>
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
          <div className="mezosor k3">
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
            <label className="mezo">
              <span className="felirat">Részlet (ha kell)</span>
              <input className="doboz" value={u.tartalom} maxLength={60} onChange={(e) => setU({ ...u, tartalom: e.target.value })} placeholder="leiras vagy komment" />
            </label>
          </div>
          <label className="mezo" style={{ marginTop: 14, maxWidth: 320 }}>
            <span className="felirat">Csatorna típusa</span>
            <input className="doboz" value={u.medium} maxLength={30} onChange={(e) => setU({ ...u, medium: e.target.value })} placeholder={javasolt} />
          </label>
          <div className="uzenet-sav info" style={{ marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {link ? (
              <>
                <code style={{ flex: 1, wordBreak: 'break-all', fontSize: 14 }}>{link}</code>
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
                <th>Típus</th>
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
                  <td>{c.source ?? '–'}</td>
                  <td>{c.medium ?? '–'}</td>
                  <td className="jobb">
                    <Szam n={c.visitors} />
                  </td>
                  <td className="jobb szam">{c.registered}</td>
                  <td className="jobb szam">{c.paying}</td>
                  <td className="jobb szam utolso">{c.mrrHuf ? ft(c.mrrHuf) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        {m.note} Az Áttekintés havi bevétele: {ft(m.dashboardMrrHuf)}. A pénz nem függ a fenti időszaktól: ez a mostani állapot. A forrás a regisztrációé; aki a mérés bevezetése előtt regisztrált, annál csak a hirdetési link adatai (ha voltak) ismertek.
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
      pir.ok('Rögzítettem a költést.');
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
              Csak annál a látogatónál mérünk, aki a süti-ablakban elfogadta. A szerver a regisztrációt és az első fizetést küldi el, álnevesített (hash-elt) e-mail-címmel; adóadatot soha. Elküldve: {szam(a.sent)}, várakozik: {szam(a.queued)}
              {a.failed ? `, hibás: ${szam(a.failed)}` : ''}.
            </p>
          ) : (
            <>
              <p>
                Elő van készítve, de ki van kapcsolva. Most az oldal nem tölt be hirdetési kódot, nem jelenik meg süti-ablak, és semmilyen adat nem megy a Metának vagy a Google-nek.
              </p>
              <ol style={{ margin: '10px 0 0 20px', lineHeight: 1.6 }}>
                <li>A Meta Business-fiókodban létrehozod a pixelt, és kérsz hozzá Conversions API-kulcsot; a Google Ads-fiókodban létrehozod a konverziós műveleteket.</li>
                <li>A gépeden lefuttatod a hirdetes_kulcsok.ps1 szkriptet: titkosan felviszi a kulcsokat a szerverre.</li>
                <li>Az ügyvéd jóváhagyja az adatkezelési és a süti-tájékoztató hirdetési részét, és élesítjük őket.</li>
                <li>Újraépítjük a nyitóoldalt a hirdetési kapcsolóval: ekkor jelenik meg a süti-ablak („Elfogadom” és „Elutasítom”).</li>
              </ol>
              <p className="halvany kicsi" style={{ marginTop: 8 }}>
                A lépések részletesen: kod/MARKETING.md.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="lap" style={{ marginTop: 16 }}>
        <div className="lap-fej">
          <h2>Költés és megtérülés</h2>
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
              <th className="jobb">Regisztrált</th>
              <th className="jobb">Költség / regisztráció</th>
              <th className="jobb">Fizető</th>
              <th className="jobb utolso">Költség / fizető</th>
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
          A regisztráltak a csatorna összes regisztrációja (Meta: {MARKETING_CHANNEL_LABELS.facebook} és {MARKETING_CHANNEL_LABELS.instagram}; Google: {MARKETING_CHANNEL_LABELS.google}), a hirdetésből és a nem fizetett megjelenésből együtt. Pontosabb képet a kampánylinkek adnak.
        </p>
        {a.spend.length > 0 && (
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
                <tr key={s.id} style={s.revokedAt ? { opacity: 0.55, textDecoration: 'line-through' } : undefined}>
                  <td className="elso nt">{datumRovid(s.day)}</td>
                  <td>{s.platform === 'meta' ? 'Meta' : s.platform === 'google' ? 'Google' : 'Egyéb'}</td>
                  <td>{s.campaign ?? '–'}</td>
                  <td className="halvany">{s.note ?? ''}</td>
                  <td className="jobb szam">{ft(s.amountHuf)}</td>
                  <td className="utolso jobb">
                    {!s.revokedAt && (
                      <button className="gomb-v" disabled={vissza.isPending} onClick={() => vissza.mutate(s.id)}>
                        Visszavonom
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
