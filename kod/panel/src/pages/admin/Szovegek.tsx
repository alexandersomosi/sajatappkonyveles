// FUNKCIOK 32: FAQ editor and notification / e-mail texts with placeholder check and preview.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ep from '../../api/endpoints';
import type { ContentText, FaqItem } from '../../api/types';
import { Fejlec, Fiok, HibaSav, Toltes, Ures } from '../../ui/kozos';
import { usePirito } from '../../ui/Pirito';
import { useAuth } from '../../auth/Auth';
import { idopont } from '../../lib/format';
import { today } from '../../lib/today';
import { ismeretlenHelyorzok } from '../../lib/validate';
import brand from '../../_shared/brand.json';

// Sample values for the preview: every placeholder the backend texts use (backend/src/content/defaults.hu.json).
const MINTA: Record<string, string> = {
  firstName: 'Bence',
  firstNameWith: 'Bencével',
  firstNameFrom: 'Bencétől',
  firstNameOnto: 'Bencére',
  firstNameAcc: 'Bencét',
  clientFirstName: 'Kata',
  clientName: 'Szabó Kata',
  amount: '510 471 Ft',
  maxAmount: '20 000 Ft',
  dueDateText: 'október 12',
  dueDate: 'október 12',
  paidOn: 'október 10.',
  periodAdj: 'III. negyedévi',
  period: 'III. negyedév',
  periodLabel: 'III. negyedév',
  periodEndText: 'December 18-ig',
  untilText: '2027. november 18-ig',
  days: '3',
  times: '12',
  percent: '80',
  code: '123456',
  month: 'szeptemberi',
  monthAdjA: 'a szeptemberi',
  count: '3',
  countText: '3 irat',
  waitingText: '1',
  title: 'Töltsd fel a szeptemberi kivonatot',
  body: 'Kérlek, töltsd fel a bankod appjából letöltött PDF-et.',
  step: 'Azonosítás (igazolványfotók)',
  note: 'A lakcímkártya címoldala homályos, kérlek, fotózd le újra.',
  when: 'november 20., csütörtök 10:00',
  channelText: 'Bence hív telefonon a megadott számodon.',
  brand: brand.name,
  panelUrl: typeof location !== 'undefined' ? location.origin : 'https://konyvelo.example',
  transfersText: '3 külön utalással',
  accountantName: 'Kovács Bence',
  link: 'https://app.example/dosszie',
  // SPEC §26.11 (callback, new business, team)
  phoneMasked: '+36 30 *** **67',
  staffFirstName: 'Anna',
  reasonText: 'üzenetben válaszoltunk',
  topicLabel: 'Vállalkozás bejelentése',
  dueText: 'november 19., 9:20',
  createdText: 'november 15-én 14:20-kor',
  senderName: 'Anna · ügyfélszolgálat',
  lines: '• 3 nyitott visszahívás, ebből 1 lejárt\n• 1 NAV-os igazolás vár ellenőrzésre\n• 2 olvasatlan üzenet',
  // SPEC §27 (changeable branch, "Intézzük helyetted", journey, kamara, issued invoices)
  hatarido: 'november 22-ig',
  date: 'november 22.',
  ugycsoportok: 'ADÓÜGYEK (kivéve egyes jövedéki ügyek) + Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)',
  fromLabel: 'Most indítom',
  toLabel: 'Már van vállalkozásom',
  reason: 'Már megadtad az adószámodat.',
  kozossegi: 'nem',
  n: '4',
  sum: '1 240 000',
  remaining: '5',
  startText: 'december 1-jén',
  afaLimit: '1 643 836',
  atalanyCap: '3 183 781',
  jovahagyasHatarido: 'november 22-ig',
  konyveloNev: 'Kovács Bence',
};
export function minta(s: string): string {
  return s.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, k: string) => MINTA[k] ?? `[${k}]`);
}

// Group = the key prefix (notif. / email. / ui.); the API's own group label is not used for filtering.
const CSOPORT: Record<string, string> = {
  notif: 'Értesítések (telefon)',
  email: 'E-mailek',
  ui: 'Appszövegek',
  // SPEC §26.8 + §27.9.2 content keys of the app (editable defaults)
  bekotes_ut: 'Bekötés – út',
  varakozas: 'Várakozás',
  helyettunk: 'Intézzük helyetted',
  szamlak: 'Kiállított számlák',
  vallalkozas: 'Vállalkozás bejelentése',
  magyarazat: 'Magyarázatok',
  visszahivas: 'Visszahívás',
  zarolt: 'Korlátozott mód',
  bekotes: 'Bekötés',
  egyeb: 'Egyéb',
  megszunt: 'Megszűnt',
};
const CSOPORT_SORREND = ['notif', 'email', 'ui', 'bekotes_ut', 'varakozas', 'helyettunk', 'szamlak', 'vallalkozas', 'magyarazat', 'visszahivas', 'zarolt', 'bekotes', 'egyeb', 'megszunt'];
/** Longest prefix first. */
const ELOTAG: [string, string][] = [
  ['bekotes.ut.', 'bekotes_ut'],
  ['bekotes.varakozas.', 'varakozas'],
  ['bekotes.magyarazat.', 'magyarazat'],
  ['bekotes.zarolt.', 'zarolt'],
  ['korlatozott.', 'zarolt'],
  ['helyettunk.', 'helyettunk'],
  ['szamlak.', 'szamlak'],
  ['vallalkozas.', 'vallalkozas'],
  ['visszahivas.', 'visszahivas'],
  ['bekotes.', 'bekotes'],
];
/** SPEC §26.2.9: the retired booking texts (never sent; kept so old notifications still render). */
const MEGSZUNT_KULCS = /^(notif|email)\.appointment_(booked|reminder|cancelled)(\.|$)/;
function csoportKulcs(key: string, legacy?: boolean): string {
  if (legacy || MEGSZUNT_KULCS.test(key)) return 'megszunt';
  const p = key.split('.')[0] ?? '';
  if (p === 'notif' || p === 'email' || p === 'ui') return p;
  return ELOTAG.find(([e]) => key.startsWith(e))?.[1] ?? 'egyeb';
}

// Human-readable "what is this for" per event (the middle of the key), plus the part (title / body / subject).
const ESEMENY: Record<string, string> = {
  tax_approved: 'Kész a negyedéves fizetendő (jóváhagyás után)',
  tax_due_soon: 'Közeleg a befizetési határidő',
  tax_reopened: 'A könyvelő módosítja a fizetendőt',
  'tax_reopened.neutral': 'A könyvelő csak a kísérőlevelet pontosította',
  tax_payment_verified: 'A befizetés rendben megérkezett',
  tax_payment_mismatch: 'Eltérés a befizetésnél',
  tax_filed: 'Beadta a bevallást',
  document_processed: 'Feldolgozta a feltöltött iratokat',
  document_filed: 'Iratok bekerültek a beadott bevallásba',
  request_new: 'Új kérés a könyvelőtől',
  request_reminder: 'Emlékeztető egy nyitott kérésre',
  request_done: 'Lezárta az ügyfél kérését',
  'request_done.withdrawn': 'Visszavonta a kérését',
  message_new: 'Új üzenet a könyvelőtől',
  client_message_new: 'Könyvelőnek: új üzenet az ügyféltől',
  client_request_new: 'Könyvelőnek: új ügyfélkérés',
  client_document_uploaded: 'Könyvelőnek: új irat az ügyféltől',
  client_marked_paid: 'Könyvelőnek: az ügyfél befizetést jelzett',
  onboarding_needs_review: 'Könyvelőnek: bekötési lépés ellenőrzésre vár',
  onboarding_needs_fix: 'Bekötés: valamit pótolni kell',
  onboarding_done: 'Bekötés kész',
  limit_warning: 'Közel az alanyi ÁFA-keret',
  appointment_booked: 'Időpont lefoglalva',
  'appointment_booked.accountant': 'Könyvelőnek: időpontot foglaltak',
  'appointment_booked.video': 'Videóhívás lefoglalva',
  appointment_reminder: 'Emlékeztető a hívás előtt',
  'appointment_reminder.accountant': 'Könyvelőnek: emlékeztető a hívás előtt',
  appointment_cancelled: 'Időpont lemondva',
  'appointment_cancelled.accountant': 'Könyvelőnek: lemondták az időpontot',
  subscription_payment_failed: 'Nem sikerült levonni a havidíjat',
  subscription_renewal_needed: 'Hamarosan új kártyaengedély kell',
  subscription_canceled: 'Lemondta az előfizetést',
  fee_invoice_issued: 'Elkészült a havidíj bizonylata',
  auth_email_code: 'E-mail-megerősítő kód',
  auth_password_reset_code: 'Jelszó-visszaállító kód',
  auth_staff_invite: 'Meghívó a könyvelői felületre',
  auth_staff_invite_csapat: 'Meghívó az ügyfélszolgálati felületre',
  contract_accepted: 'Elfogadta a megbízási szerződést (PDF-melléklettel)',
  account_deletion_requested: 'Fióktörlést kért',
  export_requested: 'Adatmásolatot kértek a fiókból',
  auth_password_changed: 'Megváltozott a jelszó',
  gdpr_export_ready: 'Elkészült az adatmásolat',
  auth_totp_changed: 'Változott a kétlépcsős belépés',
  staff_client_assigned: 'Könyvelőnek: új ügyfelet kapott',
  staff_client_removed: 'Könyvelőnek: elvették egy ügyfelét',
  // SPEC §26.11 – callback (client side)
  callback_received: 'Visszahívás: megkaptuk a kérést',
  callback_calling: 'Visszahívás: most hív a kolléga',
  callback_missed: 'Visszahívás: kerestük, de nem értük el',
  callback_wrong_number: 'Visszahívás: hibás a telefonszám',
  callback_done: 'Visszahívás: beszéltünk',
  callback_unreached: 'Visszahívás: háromszor sem értük el',
  callback_closed: 'Visszahívás: lezártuk hívás nélkül',
  // new business (client side)
  registration_reminder: 'Vállalkozás bejelentése: emlékeztető',
  registration_needs_fix: 'Vállalkozás bejelentése: javítani kell',
  registration_checked: 'Vállalkozás bejelentése: rendben, várjuk az adószámot',
  registration_done: 'Vállalkozás bejelentése: elindult a vállalkozás',
  // staff side
  callback_new: 'Csapatnak: új visszahívási kérés',
  callback_assigned: 'Csapatnak: rád bízták a visszahívást',
  callback_overdue: 'Csapatnak: lejárt a 48 óra',
  registration_submitted: 'Csapatnak: feltöltötték a NAV-os igazolást',
  staff_digest: 'Csapatnak: napi összefoglaló e-mail',
  // SPEC §27.8 – client
  assist_started: 'Intézzük helyetted: beszéltünk, így haladunk',
  assist_mh_filed: 'Intézzük helyetted: beküldtük a meghatalmazást, hagyd jóvá',
  assist_mh_reminder: 'Intézzük helyetted: emlékeztető a jóváhagyásra',
  assist_mh_expired: 'Intézzük helyetted: lejárt a 4 nap',
  assist_consent_needed: 'Intézzük helyetted: nézd át, és engedélyezd a bejelentést',
  assist_ev_filed: 'Intézzük helyetted: bejelentettük a vállalkozást',
  kamara_reminder: 'Kamarai regisztráció: emlékeztető',
  // SPEC §27.8 – staff
  assist_task: 'Könyvelőnek: „Intézzük helyette” teendő',
  assist_approval_overdue: 'Csapatnak és könyvelőnek: ma jár le a jóváhagyás',
  client_path_changed: 'Csapatnak: az ügyfél módosította a válaszát',
  generic: 'Minden e-mail',
};
// Variants of an event (the second part of the middle key), e.g. notif.tax_approved.zero.title.
const VALTOZAT: Record<string, string> = {
  zero: 'nincs fizetendő',
  hipa: 'iparűzési adó',
  rejected: 'nem teljesíthető',
  with_note: 'megjegyzéssel',
  accountant_changed: 'új könyvelő',
  jovahagyas: 'jóváhagyás az ONYA-ban',
  neutral: 'csak a levél változott',
  withdrawn: 'visszavonva',
  accountant: 'könyvelőnek',
  video: 'videóhívás',
  regi_idopont: 'régi időpontfoglalásból',
  adatlap: 'az adatlapnál tart',
  uj_szam: 'új telefonszámot adott meg',
  csapat: 'az ügyfélszolgálattól',
  uj_vallalkozas: 'új vállalkozás indult',
  // SPEC §27.8
  elso: 'első emlékeztető',
  utolso_nap: 'az utolsó napon',
  ujra: 'újra',
  ujegyke: 'küldd be az UJEGYKE-t',
  ellenorzes: 'nézd meg az ONYA-ban',
  bejelentes: 'küldd be a bejelentést',
  atnezes: 'csapat: nézd át az értesítést',
};
const RESZ: Record<string, string> = { title: 'cím', body: 'szöveg', subject: 'tárgy', footer: 'lábléc' };
const APPSZOVEG: Record<string, string> = {
  'ui.home.letter_default': 'Főoldal: a könyvelő levele (végleges összeg)',
  'ui.home.letter_becsles': 'Főoldal: a könyvelő levele (becslés)',
  'ui.home.letter_signed_role': 'Főoldal: a szerep az aláírás alatt',
  'ui.hero.becsles_note': 'Főoldal: megjegyzés a becsült összeg alatt',
  'ui.hero.veglegesites_note': 'Főoldal: megjegyzés, amíg a lezárult negyedév véglegesítésre vár',
  'ui.home.letter_veglegesites': 'Főoldal: a könyvelő levele (lezárult negyedév, véglegesítés előtt)',
  'ui.request.monthly_statement.title': 'Havi kivonatkérés – cím',
  'ui.request.monthly_statement.body': 'Havi kivonatkérés – szöveg',
  'ui.dossier.headline_empty': 'Dosszié: üres hónap',
  'ui.dossier.headline_all_seen': 'Dosszié: mindet látta a könyvelő',
  'ui.dossier.headline_waiting': 'Dosszié: van még, amit nem látott',
  'ui.subscription.token_info': 'Előfizetés: a kártyaengedély magyarázata',
};
export function szovegLeiras(key: string): string | null {
  if (APPSZOVEG[key]) return APPSZOVEG[key]!;
  const darabok = key.split('.');
  const elo = darabok[0];
  if (elo !== 'notif' && elo !== 'email') return null;
  const resz = darabok[darabok.length - 1]!;
  const kozep = darabok.slice(1, -1).join('.');
  let esemeny = ESEMENY[kozep];
  if (!esemeny) {
    // A variant the list does not name yet: "<base event> (<variant>)".
    const [alap, ...tobbi] = kozep.split('.');
    const valtozat = tobbi.join('.');
    if (!alap || !ESEMENY[alap] || !valtozat) return null;
    esemeny = `${ESEMENY[alap]} (${VALTOZAT[valtozat] ?? valtozat.replace(/_/g, ' ')})`;
  }
  return RESZ[resz] ? `${esemeny} – ${RESZ[resz]}` : esemeny;
}

/** Who changed a text: a name if the API sends one, "te" for the signed-in admin – never the raw user id. */
export function kiModositotta(updatedBy: string | null | undefined, sajatId?: string): string {
  if (!updatedBy) return '';
  if (sajatId && updatedBy === sajatId) return 'te';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(updatedBy) ? 'másik tulajdonos' : updatedBy;
}

export default function Szovegek() {
  const [sp, setSp] = useSearchParams();
  const ful = sp.get('ful') ?? 'gyik';
  return (
    <>
      <Fejlec
        felcim="Tulajdonos"
        cim="GYIK és szövegek"
        mellek="Amit az ügyfelek olvasnak: gyakori kérdések, értesítések, e-mailek. A {kapcsos} részeket a rendszer tölti ki."
        fulek={
          <>
            {[
              ['gyik', 'GYIK'],
              ['szovegek', 'Értesítések és e-mailek'],
            ].map(([k, f]) => (
              <button key={k} className={`ful${ful === k ? ' on' : ''}`} onClick={() => setSp({ ful: k! }, { replace: true })}>
                {f}
              </button>
            ))}
          </>
        }
      />
      <div className="tartalom">{ful === 'gyik' ? <Gyik /> : <Tartalmak />}</div>
    </>
  );
}

function Gyik() {
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['admin', 'faq'], queryFn: ep.adminFaq });
  const [szerk, setSzerk] = useState<Partial<FaqItem> | null>(null);
  const inv = () => qc.invalidateQueries({ queryKey: ['admin', 'faq'] });
  const items = [...(q.data?.items ?? [])].sort((a, b) => a.sort - b.sort);
  const ment = useMutation({
    mutationFn: () =>
      szerk!.id
        ? ep.adminPatchFaq(szerk!.id, { question: szerk!.question!.trim(), answer: szerk!.answer!.trim(), published: !!szerk!.published })
        : ep.adminCreateFaq({ question: szerk!.question!.trim(), answer: szerk!.answer!.trim(), published: !!szerk!.published, sort: (items[items.length - 1]?.sort ?? 0) + 10 }),
    onSuccess: () => {
      pir.ok('Elmentve. Az appban azonnal látszik.');
      setSzerk(null);
      void inv();
    },
    onError: pir.hiba,
  });
  const patch = useMutation({ mutationFn: (x: { id: string; body: Partial<FaqItem> }) => ep.adminPatchFaq(x.id, x.body), onSuccess: () => void inv(), onError: pir.hiba });
  const del = useMutation({
    mutationFn: (id: string) => ep.adminDeleteFaq(id),
    onSuccess: () => {
      pir.ok('Törölve.');
      setSzerk(null);
      void inv();
    },
    onError: pir.hiba,
  });
  const csere = (i: number, j: number) => {
    const a = items[i]!;
    const b = items[j]!;
    patch.mutate({ id: a.id, body: { sort: b.sort } });
    patch.mutate({ id: b.id, body: { sort: a.sort } });
  };
  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14 }}>
        <span className="halvany">{items.filter((i) => i.published).length} kérdés látszik az appban.</span>
        <button className="gomb-e" onClick={() => setSzerk({ question: '', answer: '', published: true })}>
          Új kérdés
        </button>
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      <div className="lap">
        {q.isPending ? (
          <Toltes />
        ) : items.length === 0 ? (
          <Ures n="level_boritek" cim="Még nincs kérdés" />
        ) : (
          items.map((f, i) => (
            <div key={f.id} className="ikonsor" style={{ alignItems: 'flex-start', opacity: f.published ? 1 : 0.6 }}>
              <div className="oszlop" style={{ gap: 0, marginTop: 2, minWidth: 72 }}>
                <button className="gomb-sz kicsi" disabled={i === 0} onClick={() => csere(i, i - 1)} aria-label={`${f.question}: feljebb`}>
                  Feljebb
                </button>
                <button className="gomb-sz kicsi" disabled={i === items.length - 1} onClick={() => csere(i, i + 1)} aria-label={`${f.question}: lejjebb`}>
                  Lejjebb
                </button>
              </div>
              <div className="l">
                <div className="cim felkover">{f.question}</div>
                <div className="al" style={{ whiteSpace: 'pre-wrap' }}>
                  {f.answer.length > 220 ? `${f.answer.slice(0, 220)}…` : f.answer}
                </div>
              </div>
              {!f.published && <span className="cimke">rejtve</span>}
              <button className="gomb-sz" onClick={() => setSzerk(f)}>
                Szerkesztem
              </button>
            </div>
          ))
        )}
      </div>
      <Fiok
        nyitva={!!szerk}
        bezar={() => setSzerk(null)}
        ikon="kerdezek"
        cim={szerk?.id ? 'Kérdés szerkesztése' : 'Új kérdés'}
        lab={
          <>
            <button className="gomb-e" disabled={!szerk?.question?.trim() || !szerk?.answer?.trim() || ment.isPending} onClick={() => ment.mutate()}>
              Mentés
            </button>
            {szerk?.id && (
              <button className="gomb-v" onClick={() => del.mutate(szerk.id!)}>
                Törlöm
              </button>
            )}
          </>
        }
      >
        {szerk && (
          <>
            <label className="mezo">
              <span className="felirat">Kérdés</span>
              <input className="doboz" maxLength={200} value={szerk.question ?? ''} onChange={(e) => setSzerk({ ...szerk, question: e.target.value })} />
            </label>
            <label className="mezo" style={{ marginTop: 14 }}>
              <span className="felirat">Válasz (sima szöveg, sortöréssel)</span>
              <textarea className="doboz" rows={8} maxLength={3000} value={szerk.answer ?? ''} onChange={(e) => setSzerk({ ...szerk, answer: e.target.value })} />
            </label>
            <label className="jelolo" style={{ marginTop: 14 }}>
              <input type="checkbox" checked={!!szerk.published} onChange={(e) => setSzerk({ ...szerk, published: e.target.checked })} />
              Látszik az appban
            </label>
          </>
        )}
      </Fiok>
    </>
  );
}

function Tartalmak() {
  const qc = useQueryClient();
  const pir = usePirito();
  const q = useQuery({ queryKey: ['admin', 'content'], queryFn: ep.adminContentTexts });
  const { user } = useAuth();
  const [csoport, setCsoport] = useState<string | null>(null);
  const [kereses, setKereses] = useState('');
  const [szerk, setSzerk] = useState<ContentText | null>(null);
  const [body, setBody] = useState('');
  useEffect(() => setBody(szerk?.body ?? ''), [szerk]);
  const ment = useMutation({
    mutationFn: () => ep.adminPutContentText(szerk!.key, body),
    onSuccess: () => {
      pir.ok('Elmentve. A következő értesítés már így megy ki.');
      setSzerk(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'content'] });
    },
    onError: pir.hiba,
  });
  // Every text gets a human description (the API's own one, or one built from its key) and a group by key prefix.
  const elemek = useMemo(() => (q.data?.items ?? []).map((i) => ({ ...i, description: i.description ?? szovegLeiras(i.key) ?? undefined, csop: csoportKulcs(i.key, i.legacy) })), [q.data]);
  const csoportok = useMemo(() => CSOPORT_SORREND.filter((c) => elemek.some((i) => i.csop === c)), [elemek]);
  const aktiv = csoport && csoportok.includes(csoport) ? csoport : (csoportok[0] ?? 'notif');
  const k = kereses.trim().toLowerCase();
  // A search looks through every group at once; without one, the chosen group is listed.
  const items = elemek.filter((i) => (k ? `${i.key} ${i.body} ${i.description ?? ''}`.toLowerCase().includes(k) : i.csop === aktiv));
  const rossz = szerk ? ismeretlenHelyorzok(body, szerk.placeholders) : [];
  return (
    <>
      <div className="sor-flex ter" style={{ marginBottom: 14 }}>
        <div className="szegmens">
          {csoportok.map((c) => (
            <button
              key={c}
              className={!k && aktiv === c ? 'on' : ''}
              onClick={() => {
                setCsoport(c);
                setKereses('');
              }}
            >
              {CSOPORT[c] ?? c} <span className="halvany">{elemek.filter((i) => i.csop === c).length}</span>
            </button>
          ))}
        </div>
        <label className="kereso">
          <input placeholder="Keresés a szövegekben…" value={kereses} onChange={(e) => setKereses(e.target.value)} />
        </label>
      </div>
      {q.isError && <HibaSav hiba={q.error} ujra={() => q.refetch()} />}
      {!k && aktiv === 'megszunt' && (
        <div className="uzenet-sav figyel" style={{ marginBottom: 12 }}>
          Megszűnt (időpontfoglalás) – nem küldjük ki. Időpontot már nem lehet foglalni, helyette visszahívást kérnek. Ezek a szövegek csak azért maradtak meg, hogy a régi értesítések olvashatók legyenek.
        </div>
      )}
      <div className="lap">
        {q.isPending ? (
          <Toltes />
        ) : items.length === 0 ? (
          <Ures n="level_boritek" cim="Nincs ilyen szöveg" />
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th className="elso">Mire való</th>
                <th>Szöveg</th>
                <th className="utolso">Módosítva</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.key} className="kattinthato" onClick={() => setSzerk(i)}>
                  <td className="elso" style={{ width: '32%' }}>
                    <div className="felkover">
                      {i.description ?? i.key}
                      {i.csop === 'megszunt' && (
                        <span className="cimke" style={{ marginLeft: 6 }}>
                          megszűnt
                        </span>
                      )}
                    </div>
                    <div className="al halvany kicsi">
                      {k ? `${CSOPORT[i.csop] ?? i.csop} · ` : ''}
                      {i.description ? <span className="szam">{i.key}</span> : 'belső kulcs'}
                    </div>
                  </td>
                  <td>
                    {i.body.length > 140 ? `${i.body.slice(0, 140)}…` : i.body}
                    {i.body !== i.defaultBody && (
                      <span className="cimke info" style={{ marginLeft: 6 }}>
                        átírva
                      </span>
                    )}
                  </td>
                  <td className="utolso nt halvany kicsi">{i.updatedAt ? `${idopont(i.updatedAt, today())}${kiModositotta(i.updatedBy, user?.id) ? `, ${kiModositotta(i.updatedBy, user?.id)}` : ''}` : 'alapszöveg'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Fiok
        nyitva={!!szerk}
        bezar={() => setSzerk(null)}
        ikon="ertesites"
        szeles
        cim={szerk ? (szerk.description ?? szovegLeiras(szerk.key) ?? szerk.key) : ''}
        bev={szerk ? `${csoportKulcs(szerk.key, szerk.legacy) === 'megszunt' ? 'Megszűnt (időpontfoglalás) – nem küldjük ki' : (CSOPORT[csoportKulcs(szerk.key)] ?? '')} · belső kulcs: ${szerk.key}` : undefined}
        lab={
          <>
            <button className="gomb-e" disabled={!body.trim() || rossz.length > 0 || ment.isPending || body === szerk?.body} onClick={() => ment.mutate()}>
              Mentés
            </button>
            {szerk && body !== szerk.defaultBody && (
              <button className="gomb-sz" onClick={() => setBody(szerk.defaultBody)}>
                Vissza az alapszövegre
              </button>
            )}
          </>
        }
      >
        {szerk && (
          <div className="racs k2" style={{ alignItems: 'start' }}>
            <div>
              <label className="mezo">
                <span className="felirat">Szöveg</span>
                <textarea className={`doboz${rossz.length ? ' hibas' : ''}`} rows={10} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
              </label>
              {rossz.length > 0 && (
                <div className="uzenet-sav hiba" style={{ marginTop: 10 }}>
                  Ilyen kitöltendő rész nincs: {rossz.map((r) => `{${r}}`).join(', ')}. Javítsd, különben üresen menne ki.
                </div>
              )}
              <div className="mezo" style={{ marginTop: 12 }}>
                <span className="felirat">Használható kitöltendő részek</span>
                <div className="cimkek">
                  {szerk.placeholders.length === 0 && <span className="halvany kicsi">nincs</span>}
                  {szerk.placeholders.map((p) => (
                    <button key={p} type="button" className="cimke" onClick={() => setBody((b) => `${b}{${p}}`)}>
                      {`{${p}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <span className="felirat felkover" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
                Előnézet mintaadatokkal
              </span>
              <div className="lap" style={{ background: 'var(--alap)', padding: 16 }}>
                <div className="lap" style={{ padding: '14px 16px', whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>
                  {minta(body)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Fiok>
    </>
  );
}
