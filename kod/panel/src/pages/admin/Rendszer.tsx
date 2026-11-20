// FUNKCIOK 33, 35: integration modes (DEMO / test / live), worker heartbeat, last NAV sync, backup age.
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import * as ep from '../../api/endpoints';
import { k29Rendszer } from '../../api/k29';
import { Fejlec, HibaSav, Toltes } from '../../ui/kozos';
import { MODE_LABEL } from '../../lib/labels';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';

const INTEGRACIOK: { k: 'nav' | 'simplepay' | 'mail' | 'push' | 'invoice'; nev: string; mit: string }[] = [
  { k: 'mail', nev: 'E-mail (SMTP)', mit: 'Kódok, értesítések e-mailben (ZeptoMail)' },
  { k: 'nav', nev: 'NAV Online Számla', mit: 'Kiállított számlák napi letöltése' },
  { k: 'push', nev: 'Telefonos értesítés', mit: 'Push az appba (Expo)' },
  { k: 'simplepay', nev: 'SimplePay (tartalék)', mit: 'Kikapcsolva, csak ha visszaváltanánk' },
];

const SZOLG: Record<string, string> = { stripe: 'Stripe', demo: 'DEMO fizetés (nem mozdul pénz)', simplepay: 'SimplePay', disabled: 'nincs bekapcsolva' };
const SZAMLA: Record<string, string> = { szamlazzhu: 'Számlázz.hu', demo: 'DEMO díjbekérő (nem számla)', billingo: 'Billingo', disabled: 'nincs bekapcsolva' };

/** SPEC §29.1.14: the payment and invoicing block – modes and counts only, never a key value. */
function FizetesBlokk() {
  const t = today();
  const q = useQuery({ queryKey: ['admin', 'k29', 'system'], queryFn: k29Rendszer, refetchInterval: 60_000, retry: false });
  const d = q.data;
  if (q.isError) return null; // a server without §29: the old rows above tell the modes
  return (
    <div className="lap" style={{ marginBottom: 16 }}>
      <div className="lap-fej">
        <h2>Fizetés és számlázás</h2>
        <span className="megj">A kulcsokat a stripe_szerverre.ps1 és a kezjegy_kulcsok.ps1 szkripttel adod meg.</span>
      </div>
      {!d ? (
        <Toltes />
      ) : (
        <table className="tabla">
          <tbody>
            <tr>
              <td className="elso">
                <div className="felkover">Kártyás fizetés</div>
                <div className="al">Havidíj, külön díjak, „Fizesd ki”</div>
              </td>
              <td className="utolso">
                <Pont mode={d.paymentProvider === 'stripe' && d.stripe === 'live' ? 'live' : d.paymentProvider === 'disabled' ? 'off' : 'demo'} /> {SZOLG[d.paymentProvider] ?? d.paymentProvider}
                {d.paymentProvider === 'stripe' ? ` – ${d.stripe === 'live' ? 'éles' : d.stripe === 'test' ? 'TESZT mód' : 'ki'}` : ''}
              </td>
            </tr>
            <tr>
              <td className="elso">
                <div className="felkover">Stripe webhook</div>
                <div className="al">Titok: {d.webhookSecret === 'megvan' ? 'megvan' : 'hiányzik'} · utolsó esemény: {d.lastWebhookAt ? idopont(d.lastWebhookAt, t) : 'még nem jött'}</div>
              </td>
              <td className="utolso">
                {d.stuckEvents > 0 ? <span className="cimke hiba">Fennakadt Stripe-esemény: {d.stuckEvents}</span> : d.unprocessedEvents > 0 ? <span className="cimke figyel">Feldolgozásra vár: {d.unprocessedEvents}</span> : <span className="halvany">rendben</span>}
              </td>
            </tr>
            <tr>
              <td className="elso">
                <div className="felkover">Egyeztetés a Stripe-pal</div>
                <div className="al">15 percenként: ha egy webhook elveszne, innen pótoljuk</div>
              </td>
              <td className="utolso">{d.lastReconcileAt ? idopont(d.lastReconcileAt, t) : <span className="halvany">még nem futott</span>}</td>
            </tr>
            <tr>
              <td className="elso">
                <div className="felkover">Díjszámla</div>
                <div className="al">E-számla minden sikeres fizetés után</div>
              </td>
              <td className="utolso">
                <Pont mode={d.invoiceMode === 'szamlazzhu' && d.szamlazzhuAccount === 'eles' ? 'live' : d.invoiceMode === 'disabled' ? 'off' : 'demo'} /> {SZAMLA[d.invoiceMode] ?? d.invoiceMode}
                {d.invoiceMode === 'szamlazzhu' ? ` – ${d.szamlazzhuAccount === 'eles' ? 'éles fiók' : 'teszt fiók (Tesztüzem)'}` : ''}
              </td>
            </tr>
            <tr>
              <td className="elso">
                <div className="felkover">Teendő</div>
                <div className="al">Számlahiba, fizetési gond, vitatott terhelés</div>
              </td>
              <td className="utolso">
                {d.openInvoiceErrors > 0 ? (
                  <Link className="cimke hiba" to="/admin/dijszamlak?status=hiba">
                    {d.openInvoiceErrors} számlahiba
                  </Link>
                ) : null}{' '}
                {d.invoicesInProgress > 0 ? <span className="cimke figyel">{d.invoicesInProgress} számla készül</span> : null}{' '}
                {d.openPaymentProblems > 0 ? (
                  <Link className="cimke hiba" to="/admin/fizetesek?szuro=problema">
                    {d.openPaymentProblems} fizetési gond
                  </Link>
                ) : null}{' '}
                {d.disputes > 0 ? <span className="cimke hiba">{d.disputes} vitatott terhelés</span> : null}
                {!d.openInvoiceErrors && !d.invoicesInProgress && !d.openPaymentProblems && !d.disputes ? <span className="halvany">nincs</span> : null}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Pont({ mode }: { mode: string }) {
  const ok = mode === 'live' || mode === 'prod' || mode === 'smtp' || mode === 'expo' || mode === 'szamlazzhu' || mode === 'billingo';
  return <span className={`pont${ok ? ' ok' : mode === 'off' || mode === 'not_configured' ? ' ki' : ''}`} />;
}

export default function Rendszer() {
  const q = useQuery({ queryKey: ['admin', 'system'], queryFn: ep.adminSystem, refetchInterval: 60_000 });
  const d = q.data;
  const t = today();
  const hb = d?.workerHeartbeatAt ? (Date.now() - Date.parse(d.workerHeartbeatAt)) / 60_000 : null;
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="Rendszer"
        mellek={d ? <>Környezet: <b>{d.appEnv === 'demo' ? 'DEMO' : 'éles'}</b> · verzió {d.version} · adatbázis: <b>{d.db === 'ok' ? 'rendben' : 'HIBA'}</b></> : ' '}
      />
      <div className="tartalom">
        {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
        <FizetesBlokk />
        {q.isPending ? (
          <Toltes />
        ) : (
          d && (
            <div className="racs fo-mellek">
              <div className="lap">
                <div className="lap-fej">
                  <h2>Kapcsolatok</h2>
                  <span className="megj">A kulcsokat a kezjegy_kulcsok.ps1 szkripttel adod meg.</span>
                </div>
                <table className="tabla">
                  <tbody>
                    {INTEGRACIOK.map((i) => (
                      <tr key={i.k}>
                        <td className="elso">
                          <div className="felkover">{i.nev}</div>
                          <div className="al">{i.mit}</div>
                        </td>
                        <td className="utolso">
                          <Pont mode={d.modes[i.k]} /> {MODE_LABEL[d.modes[i.k]] ?? d.modes[i.k]}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="elso">
                        <div className="felkover">Google-belépés</div>
                        <div className="al">Ügyfeleknek, az appban</div>
                      </td>
                      <td className="utolso">
                        <Pont mode={d.googleSignIn ? 'live' : 'off'} /> {d.googleSignIn ? 'bekapcsolva' : 'nincs beállítva'}
                      </td>
                    </tr>
                    <tr>
                      <td className="elso">
                        <div className="felkover">Apple-belépés</div>
                        <div className="al">Csak iPhone-on</div>
                      </td>
                      <td className="utolso">
                        <Pont mode={d.appleSignIn ? 'live' : 'off'} /> {d.appleSignIn ? 'bekapcsolva' : 'nincs beállítva'}
                      </td>
                    </tr>
                    <tr>
                      <td className="elso">
                        <div className="felkover">Kötelező kétlépcsős belépés</div>
                        <div className="al">Könyvelőknek és neked</div>
                      </td>
                      <td className="utolso">
                        <Pont mode={d.staffTotpRequired ? 'live' : 'demo'} /> {d.staffTotpRequired ? 'bekapcsolva' : 'ki – élesben kapcsold be'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="lap">
                <div className="lap-fej">
                  <h2>Háttérmunkák</h2>
                </div>
                <div className="belso" style={{ paddingTop: 0 }}>
                  <dl className="adatok" style={{ gridTemplateColumns: '170px 1fr' }}>
                    <dt>Háttérfolyamat</dt>
                    <dd>
                      {hb === null ? 'még nem jelentkezett' : hb < 10 ? <>él ({idopont(d.workerHeartbeatAt, t)})</> : <span style={{ color: 'var(--veszely)' }}>{Math.round(hb)} perce nem jelentkezett</span>}
                    </dd>
                    <dt>Napi letöltés (NAV)</dt>
                    <dd>{d.lastNavSync?.at ? `${idopont(d.lastNavSync.at, t)} · ${d.lastNavSync.ok} rendben, ${d.lastNavSync.failed} hibás` : 'még nem futott'}</dd>
                    <dt>Utolsó mentés</dt>
                    <dd>{d.backupAgeHours === null ? 'nincs adat' : d.backupAgeHours <= 26 ? `${Math.round(d.backupAgeHours)} órája` : <span style={{ color: 'var(--veszely)' }}>{Math.round(d.backupAgeHours)} órája – nézd meg!</span>}</dd>
                  </dl>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </>
  );
}
