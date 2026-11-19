// Notification log of one client (panel contract addition, README "§28 builder notes"): what the app sent him, when
// the push went out or why it waited (quiet hours, daily cap, switched off), his settings, and the issued invoices that
// were deliberately not notified (SPEC §28.2.1 notify_state).
import { useInfiniteQuery } from '@tanstack/react-query';
import * as ep from '../../../api/endpoints';
import type { FulProps } from '../UgyfelAdatlap';
import type { AccNotificationLogRow } from '../../../api/types';
import { Ft, HibaSav, Toltes, Ures } from '../../../ui/kozos';
import { I3 } from '../../../ui/Icon3d';
import { QUIET_HOURS_DEFAULT, type InvoiceNotifyState } from '../../../_shared/enums';
import { datumRovid, idopont } from '../../../lib/format';
import { today } from '../../../lib/today';
import { ertesitesFajta } from '../../../lib/labels';

const KIHAGYVA: Record<InvoiceNotifyState, string> = {
  kuldve: 'elküldve',
  osszevonva: 'egy korábbi értesítésbe összevonva',
  kihagyva_elso_szinkron: 'első letöltés (visszamenőleges) – nem értesítünk',
  kihagyva_regi: 'régebbi, mint 10 nap – nem értesítünk',
  kihagyva_modositas: 'módosító vagy sztornó számla – csendben frissül',
  kihagyva_zarolt: 'bekötés alatt – az adóadatok még zárva',
};
/** Content variants in staff words (SPEC §28.2.4, §28.3.9, §28.K.17). */
const VALTOZAT: Record<string, string> = {
  tobb: 'több számla egy értesítésben',
  tobb_adomentes: 'több számla, adómentes részben',
  kuszob: 'ezzel elfogyott az adómentes rész',
  adomentes: 'adómentes részben',
  rejtett: 'összeg nélkül (kikapcsolta)',
  jovahagyva: 'jóváhagyva',
  reszben: 'részben jóváhagyva',
  kerdes: 'kérdés',
  elutasitva: 'nem jár',
  ev_eleje: 'év eleji emlékeztető',
  lejar: 'lejáró kedvezmény',
  valtozas: 'változásbejelentés',
};
const PUSH_OK: Record<NonNullable<AccNotificationLogRow['push']['skipped']>, string> = {
  csendes_ido: 'csendes idő – reggel megy ki',
  napi_limit: 'napi 2 telefonos értesítés megvolt – csak az appban',
  kikapcsolva: 'ezt az értesítést kikapcsolta',
  nincs_eszkoz: 'nincs bejelentkezett telefonja',
};

export function pushSzoveg(p: AccNotificationLogRow['push'], ma: string): string {
  if (!p.wanted) return 'nem kért telefonos értesítést';
  if (p.sentAt) return `telefonra: ${idopont(p.sentAt, ma)}${p.notBefore && p.notBefore === p.sentAt ? ' (csendes idő után)' : ''}${p.amountsShown ? ' · összeggel' : ''}`;
  if (p.skipped) return PUSH_OK[p.skipped];
  if (p.notBefore) return `vár: ${idopont(p.notBefore, ma)}`;
  return 'még nem ment ki';
}

export default function Ertesitesnaplo({ c }: FulProps) {
  const t = today();
  const q = useInfiniteQuery({
    queryKey: ['acc', 'notifications', c.id],
    queryFn: ({ pageParam }) => ep.accNotifications(c.id, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (l) => l.nextCursor,
  });
  if (q.isPending) return <Toltes />;
  if (q.isError) return <HibaSav hiba={q.error} ujra={() => q.refetch()} />;
  const elso = q.data.pages[0]!;
  const sorok = q.data.pages.flatMap((p) => p.items);
  const s = elso.settings;
  const csend = s ? s.quietEnabled : QUIET_HOURS_DEFAULT.enabled;
  return (
    <div className="oszlop" style={{ gap: 16 }}>
      <div className="lap k28">
        <div className="szak">
          <div className="szak-fej">
            <I3 n="ertesites" s={28} />
            <h2>Értesítési beállításai</h2>
          </div>
          <p>
            Csendes idő: <b>{csend ? `${s?.quietFrom ?? QUIET_HOURS_DEFAULT.from}:00 – ${s?.quietTo ?? QUIET_HOURS_DEFAULT.to}:00` : 'kikapcsolva'}</b>
            {!s && <span className="halvany"> (alapbeállítás)</span>} · Összeg és vevő a telefonos értesítésben: <b>{s ? (s.pushShowAmounts ? 'igen' : 'nem') : 'igen'}</b>
          </p>
          <p className="halvany kicsi">Az appban minden értesítés azonnal megjelenik; csak a telefonos értesítés vár a csendes idő végéig. „Most hív kollégánk” sosem vár.</p>
        </div>
      </div>
      <div className="lap">
        {sorok.length === 0 ? (
          <Ures n="ures_mappa" cim="Még nem kapott értesítést" />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso">Mikor</th>
                <th>Miről</th>
                <th>Szöveg</th>
                <th>Telefon</th>
                <th className="utolso">Olvasta</th>
              </tr>
            </thead>
            <tbody>
              {sorok.map((r) => (
                <tr key={r.id}>
                  <td className="elso nt">{idopont(r.createdAt, t)}</td>
                  <td>
                    {ertesitesFajta(r.kind)}
                    {r.variant && <div className="al">{VALTOZAT[r.variant] ?? r.variant}</div>}
                  </td>
                  <td>
                    <b style={{ fontWeight: 600 }}>{r.title}</b>
                    <div className="al">{r.body}</div>
                  </td>
                  <td className="kicsi">
                    {pushSzoveg(r.push, t)}
                    {r.email?.sentAt && <div className="al">e-mail: {idopont(r.email.sentAt, t)}</div>}
                  </td>
                  <td className="utolso kicsi nt">{r.readAt ? idopont(r.readAt, t) : <span className="halvany">még nem</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.hasNextPage && (
          <div className="belso">
            <button className="gomb-m kicsi csak-szoveg" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              Régebbiek
            </button>
          </div>
        )}
      </div>
      {elso.skippedInvoices.length > 0 && (
        <div className="lap k28">
          <div className="szak">
            <div className="szak-fej">
              <I3 n="szamlak" s={28} />
              <h2>Kiállított számlák, amikről nem szóltunk</h2>
            </div>
            <table className="tabla tomor">
              <tbody>
                {elso.skippedInvoices.map((i) => (
                  <tr key={i.navInvoiceId}>
                    <td className="elso szam">{i.invoiceNumber}</td>
                    <td className="nt">{datumRovid(i.issueDate)}</td>
                    <td className="jobb">
                      <Ft n={i.grossAmountHuf} />
                    </td>
                    <td className="utolso halvany">{KIHAGYVA[i.state]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
