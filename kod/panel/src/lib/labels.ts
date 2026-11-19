// Hungarian UI labels for domain enums (tegező, plain words). Enum values come from src/_shared/enums.ts.
import type {
  AppointmentStatus,
  CallbackSource,
  CalcStatus,
  ClientFlag,
  ClientLifecycle,
  DocumentCategory,
  DocumentStatus,
  KycStatus,
  Milestone,
  OnboardingStep,
  PaymentItemKind,
  PaymentStatus,
  RequestStatus,
  RequestType,
  StepStatus,
  SubscriptionStatus,
  TaxStatus,
  CertificateType,
} from '../_shared/enums';
import type { Icon3dName } from '../ui/Icon3d';
import { datum, honapEv, negyedevNev } from './format';
import { CALLBACK_ATTEMPT_OUTCOME_LABELS, CALLBACK_CLOSE_REASON_LABELS, CALLBACK_TOPIC_LABELS, CALLBACK_WINDOW_LABELS } from '../_shared/enums';

export const FLAG_LABEL: Record<ClientFlag | 'mind', string> = {
  bekotes_alatt: 'Bekötés alatt',
  rendben: 'Rendben',
  hianyzik_valami: 'Hiányzik valami',
  hatar_kozel: 'Határ közelében',
  dij_elmaradt: 'Díj elmaradt',
  mind: 'Mind',
};
export const FILTER_ORDER: (ClientFlag | 'mind')[] = ['bekotes_alatt', 'rendben', 'hianyzik_valami', 'hatar_kozel', 'dij_elmaradt', 'mind'];

export const LIFECYCLE_LABEL: Record<ClientLifecycle, string> = {
  bekotes_alatt: 'Bekötés alatt',
  aktiv: 'Aktív',
  felfuggesztve: 'Felfüggesztve',
  megszunt: 'Megszűnt',
};

export const STEP_LABEL: Record<OnboardingStep, { cim: string; leiras: string }> = {
  fiok: { cim: 'Fiók', leiras: 'Regisztrált, megerősítette az e-mail-címét.' },
  adatok: { cim: 'Adatok', leiras: 'Kitöltötte a kérdőívet. Te erősíted meg a költséghányadot és a jogállást.' },
  szerzodes: { cim: 'Szerződés', leiras: 'Elfogadta az ÁSZF-et, az adatkezelést és a megbízási szerződést.' },
  elofizetes: { cim: 'Előfizetés', leiras: 'Kártyás előfizetés és az első havidíj.' },
  meghatalmazas: { cim: 'Meghatalmazás', leiras: 'Állandó meghatalmazás a NAV-nál (ONYA / UJEGYKE). Ellenőrizd a NAV-nál, aztán jelöld késznek.' },
  azonositas: { cim: 'Azonosítás', leiras: 'Személyi + lakcímkártya, Pmt. adatok és nyilatkozatok.' },
  vallalkozas_inditas: {
    cim: 'Vállalkozás bejelentése',
    leiras: 'Új vállalkozás: az ügyfél maga jelenti be az útmutatónk alapján, vagy – ha kéri („Intézzük helyette”) – a könyvelője meghatalmazottként. A csapat átnézi a NAV-os értesítést.',
  },
  // Legacy (SPEC §26.2.9): never listed; the label stays for old audit rows.
  idopont: { cim: 'Időpont (megszűnt)', leiras: 'Időpontfoglalás helyett visszahívást kérhet.' },
  // SPEC §27.5: one name for the client's issued invoices; for the accountant this step is the NAV technical user.
  nav_bekotes: { cim: 'Kiállított számlák bekötése', leiras: 'NAV-kapcsolat: technikai felhasználó mentése, ellenőrzés, első letöltés a NAV Online Számlából.' },
};
/** "következik: Azonosítás" – the current onboarding milestone as a noun, so it never reads as done. */
export const MILESTONE_KOVETKEZO: Record<Milestone, string> = {
  vallalkozas_elinditva: 'Vállalkozás bejelentése',
  alairva: 'Meghatalmazás',
  azonositva: 'Azonosítás',
  nav_bejelentve: 'NAV-bejelentés',
  szamlak_bekotve: 'Kiállított számlák bekötése',
  kesz: 'Befejezés',
};
export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  nincs_kezdve: 'Még nem kezdte',
  ugyfelre_var: 'Az ügyfélre vár',
  konyvelore_var: 'Rád vár',
  hianyos: 'Visszaküldted pótlásra',
  kesz: 'Kész',
  kihagyva: 'Kihagyva',
};
export const MEGHATALMAZAS_LABEL: Record<string, string> = {
  onya_ugyfel: 'Az ügyfél adta be ONYA-ban (UJEGYKE)',
  onya_konyvelo: 'Te adtad be, az ügyfél jóváhagyja',
  alairt_pdf: 'Aláírt PDF meghatalmazás',
};

export const KYC_LABEL: Record<KycStatus, string> = { bekuldve: 'Beküldve, rád vár', elfogadva: 'Elfogadva', hianyos: 'Hiányos, pótlásra vár' };
export const KYC_FIELD_LABELS: Record<string, string> = {
  familyName: 'Családi név',
  givenName: 'Utónév',
  birthName: 'Születési név',
  motherBirthName: 'Anyja születési neve',
  mothersBirthName: 'Anyja születési neve',
  birthPlace: 'Születési hely',
  birthDate: 'Születési idő',
  citizenship: 'Állampolgárság',
  address: 'Lakcím',
  documentType: 'Okmány típusa',
  documentNumber: 'Okmány száma',
  documentExpiry: 'Okmány érvényessége',
};

export const KYC_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  szemelyi_igazolvany: 'Személyi igazolvány',
  szemelyi: 'Személyi igazolvány',
  utlevel: 'Útlevél',
  jogositvany: 'Jogosítvány',
};
/** KYC field order on screen (Pmt. 7. §). */
export const KYC_FIELD_ORDER = ['familyName', 'givenName', 'birthName', 'motherBirthName', 'birthPlace', 'birthDate', 'citizenship', 'address', 'documentType', 'documentNumber', 'documentExpiry'];

export const DOC_STATUS_ORDER: DocumentStatus[] = ['feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva'];
export function docStatusLabel(s: DocumentStatus, firstName: string, nav = false): string {
  // SPEC §27.5.2: an issued invoice is downloaded by us ("Letöltöttük"), it never "arrives from the NAV".
  if (s === 'feltoltve') return nav ? 'Letöltöttük' : 'Feltöltve';
  if (s === 'konyvelo_latta') return `${firstName} látta`;
  if (s === 'feldolgozva') return 'Feldolgozva';
  return 'Beadva';
}
export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  nyugta: 'Nyugta',
  penztargep_osszesito: 'Pénztárgép-összesítő',
  bankszamlakivonat: 'Bankszámlakivonat',
  szerzodes: 'Szerződés',
  koltseg_bizonylat: 'Költségbizonylat',
  kiallitott_szamla_kezi: 'Kézi számla',
  nav_level: 'Levél a NAV-tól',
  bevallas: 'Bevallás',
  nav_visszaigazolas: 'NAV-visszaigazolás',
  igazolas: 'Igazolás',
  meghatalmazas: 'Meghatalmazás',
  szerzodes_alairt: 'Aláírt szerződés',
  ev_bejelentes: 'NAV-os igazolás a vállalkozás bejelentéséről',
  egyeb: 'Egyéb',
};
export const CATEGORY_ICON: Record<DocumentCategory, Icon3dName> = {
  nyugta: 'nyugta',
  penztargep_osszesito: 'nyugta',
  bankszamlakivonat: 'irat',
  szerzodes: 'irat',
  koltseg_bizonylat: 'nyugta',
  kiallitott_szamla_kezi: 'irat',
  nav_level: 'boritek',
  bevallas: 'bevallas',
  nav_visszaigazolas: 'irat',
  igazolas: 'igazolas',
  meghatalmazas: 'irat',
  szerzodes_alairt: 'irat',
  ev_bejelentes: 'bevallas',
  egyeb: 'irat',
};

export const TAX_STATUS_LABEL: Record<TaxStatus, string> = {
  fofoglalkozasu: 'Főfoglalkozású',
  mellekallasu: 'Mellékállású (heti 36 órás munka vagy nappali tanulmány mellett)',
  nyugdijas: 'Nyugdíjas (kiegészítő tevékenység)',
};
export const TAX_STATUS_ROVID: Record<TaxStatus, string> = { fofoglalkozasu: 'Főfoglalkozású', mellekallasu: 'Mellékállású', nyugdijas: 'Nyugdíjas' };

export const CALC_LABEL: Record<CalcStatus, string> = { nincs: 'Még nincs számolva', becsles: 'Becslés', jovahagyva: 'Jóváhagyva' };
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  nincs_fizetendo: 'Nincs fizetendő',
  fizetendo: 'Fizetendő',
  befizetve_jelezve: 'Az ügyfél befizette',
  ellenorizve: 'Ellenőrizve',
  elteres: 'Eltérés',
};
export const PAYMENT_KIND_LABEL: Record<PaymentItemKind, string> = {
  tb_jarulek: 'TB-járulék',
  szocho: 'Szocho',
  szja_eloleg: 'SZJA-előleg',
  hipa_eloleg: 'Iparűzési adóelőleg',
  hipa_kulonbozet: 'Iparűzési adó különbözet',
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  dokumentum: 'Irat',
  adat: 'Adat',
  egyeb: 'Egyéb',
  jovedelemigazolas: 'Jövedelemigazolás',
  nullas_igazolas: 'Nullás igazolás',
  koztartozasmentes_igazolas: 'Köztartozásmentességi igazolás',
  adatvaltozas: 'Adatváltozás',
  tevekenysegvaltozas: 'Tevékenységváltozás',
  kerdes: 'Kérdés',
};
export const CERT_LABEL: Record<CertificateType, string> = {
  jovedelemigazolas: 'Jövedelemigazolás',
  nullas_igazolas: 'Nullás igazolás',
  koztartozasmentes_igazolas: 'Köztartozásmentességi igazolás',
};
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  nyitott: 'Nyitott',
  folyamatban: 'Folyamatban',
  teljesitve: 'Teljesítve',
  elutasitva: 'Elutasítva',
  visszavonva: 'Visszavonva',
};

export const SUB_LABEL: Record<SubscriptionStatus, string> = {
  incomplete: 'Még nem fizetett',
  active: 'Aktív',
  past_due: 'Elmaradt díj',
  suspended: 'Felfüggesztve',
  canceled: 'Lemondva',
};
/** Where a callback was requested (SPEC §26.2.1), for the team. */
export const CALLBACK_SOURCE_LABEL: Record<CallbackSource, string> = {
  bekotes: 'a bekötés oldaláról',
  adatok: 'az adatai kitöltése közben',
  vallalkozas_adatlap: 'a vállalkozás adatlapjáról',
  vallalkozas_utmutato: 'a bejelentési útmutatóból',
  meghatalmazas_utmutato: 'a meghatalmazási útmutatóból',
  azonositas: 'az azonosításnál',
  elofizetes: 'az előfizetésnél',
  uzenetek: 'az Üzenetekből',
  fiok: 'a Fiókból',
  gyik: 'a GYIK-ből',
  konyvelo_kartya: 'a könyvelő kártyájáról',
  zarolt_funkcio: 'egy zárolt funkciónál',
  csapat: 'kolléga vette fel',
  regi_idopont: 'régi időpontfoglalásból',
  // SPEC §27: the "Intézzük helyetted" cards and a branch change that needs a call
  helyettunk_vallalkozas: 'az app „Intézzük helyetted” kártyájáról',
  helyettunk_meghatalmazas: 'a meghatalmazás lépés kártyájáról',
  utvaltas: 'a válasza módosításánál („van már vállalkozásod?”)',
};
export const APPT_LABEL: Record<AppointmentStatus, string> = { foglalt: 'Foglalt', lemondva: 'Lemondva', megtortent: 'Megtörtént', elmaradt: 'Elmaradt' };

export const AUDIT_LABEL: Record<string, string> = {
  'auth.login': 'Belépett',
  'auth.login_failed': 'Sikertelen belépés',
  'auth.logout': 'Kilépett',
  'auth.password_reset': 'Új jelszót állított be',
  'auth.totp_enabled': 'Bekapcsolta a kétlépcsős belépést',
  'auth.totp_disabled': 'Kikapcsolta a kétlépcsős belépést',
  'user.created': 'Fiók létrejött',
  'client.profile_updated': 'Adatok módosultak',
  'consent.accepted': 'Elfogadott egy dokumentumot',
  'kyc.submitted': 'Azonosítást küldött be',
  'kyc.viewed': 'Megnézte az azonosítást',
  'kyc.reviewed': 'Elbírálta az azonosítást',
  'document.uploaded': 'Iratot töltött fel',
  'document.viewed': 'Megnézett egy iratot',
  'document.status_changed': 'Irat állapota változott',
  'file.download': 'Fájlt töltött le',
  'nav_credentials.saved': 'NAV-kapcsolatot mentett',
  'nav_credentials.deleted': 'NAV-kapcsolatot törölt',
  'nav_credentials.tested': 'NAV-kapcsolatot ellenőrzött',
  'nav.sync': 'NAV-lehívás',
  'tax.calculated': 'Adót számolt',
  'tax.approved': 'Jóváhagyta a fizetendőt',
  'tax.reopened': 'Újranyitotta a fizetendőt',
  'tax.payment_marked': 'Befizetettnek jelölte',
  'tax.payment_unmarked': 'Visszavonta a befizetést',
  'tax.payment_verified': 'Ellenőrizte a befizetést',
  'tax.filed': 'Beadottnak jelölte a bevallást',
  'request.created': 'Kérést küldött',
  'request.updated': 'Kérés állapota változott (régi bejegyzés)',
  'message.sent': 'Üzenetet küldött',
  'subscription.started': 'Előfizetés indult (régi bejegyzés)',
  'subscription.canceled': 'Előfizetés megszűnt az időszak végén',
  'payment.ipn': 'SimplePay-értesítés',
  'admin.client_reassigned': 'Ügyfél másik könyvelőhöz került',
  'content.updated': 'Szöveget módosított',
  'gdpr.export_requested': 'Adatmásolatot kért',
  'gdpr.downloaded': 'Letöltötte az adatmásolatot (régi bejegyzés)',
  'gdpr.delete_requested': 'Fióktörlést kért',
  'gdpr.delete_executed': 'Fiók törölve',
  'appointment.booked': 'Időpontot foglalt',
  'appointment.updated': 'Időpont módosult',
  'appointment.cancelled': 'Lemondta az időpontot',
  'accountant.settings_updated': 'Módosította a beállításait',
  'accountant.taxid_shown_to_client': 'Az ügyfél látta a könyvelő adóazonosítóját (ONYA)',
  'admin.accountant_updated': 'Könyvelő adatai módosultak',
  'admin.audit_viewed': 'Megnézte a naplót',
  'admin.client_lifecycle': 'Ügyfél állapota módosult',
  'admin.referral_created': 'Ajánlókódot hozott létre',
  'admin.user_disabled': 'Fiók letiltva',
  'admin.user_enabled': 'Fiók visszaengedve',
  'auth.email_verified': 'Megerősítette az e-mail-címét',
  'auth.login_mfa_challenge': 'Kétlépcsős kódot kértünk',
  'auth.password_changed': 'Jelszót cserélt',
  'auth.provider_linked': 'Google/Apple belépést kapcsolt',
  'auth.refresh_reuse_detected': 'Gyanús munkamenet-újrahasználat (kiléptettük)',
  'client.activated': 'Bekötés kész, aktív ügyfél',
  'client.adoazonosito_viewed': 'Megnézte az adóazonosító jelet',
  'client.tax_profile_updated': 'Adóprofil módosult',
  'document.deleted': 'Iratot törölt',
  'document.updated': 'Irat adatai módosultak',
  'dossier.reviewed': 'Átnézte a havi dossziét',
  'export.revenue_csv': 'Bevételeket exportált (CSV)',
  'fee_invoice.failed': 'Díjszámla nem készült el',
  'gdpr.delete_cancelled': 'Visszavonta a fióktörlést',
  'gdpr.export_downloaded': 'Letöltötte az adatmásolatot',
  'nav_invoice.status_changed': 'Kiállított számlák állapota módosult',
  'note.created': 'Belső jegyzetet írt',
  'onboarding.meghatalmazas_submitted': 'Beküldte a meghatalmazást',
  'onboarding.step_reviewed': 'Bekötési lépést ellenőrzött',
  'request.cancelled': 'Kérést visszavont',
  'request.completed': 'Kérést teljesített',
  'request.status_changed': 'Kérés állapota módosult',
  'revenue.created': 'Bevételt rögzített',
  'revenue.deleted': 'Bevételt törölt',
  'revenue.updated': 'Bevételt módosított',
  'subscription.activated': 'Előfizetés elindult',
  'subscription.renewed': 'Havidíj levonva',
  'subscription.admin_cancel': 'Előfizetést lemondta (admin)',
  'subscription.cancel_requested': 'Lemondta az előfizetést',
  'subscription.card_deleted': 'Kártyát törölt',
  'subscription.manual_retry': 'Kézi újrapróbálás',
  'subscription.payment_failed': 'Sikertelen levonás',
  'subscription.registration_failed': 'Sikertelen kártyamegadás',
  'subscription.resumed': 'Visszavonta a lemondást',
  'subscription.start': 'Elindította a kártyamegadást',
  'subscription.suspended': 'Előfizetés szünetel',
  'tax.letter_updated': 'Javította a negyedéves levelet',
  'tax.hipa_approved': 'Jóváhagyta az iparűzési adót',
  // SPEC §26.9.4
  'callback.created': 'Visszahívást kért',
  'callback.updated': 'Módosította a visszahívási kérést',
  'callback.cancelled': 'Lemondta a visszahívást',
  'callback.claimed': 'Magára vette a visszahívást',
  'callback.assigned': 'Átadta a visszahívást',
  'callback.calling': 'Hívja az ügyfelet',
  'callback.attempt': 'Hívást rögzített',
  'callback.closed': 'Lezárta a visszahívást',
  'callback.phone_viewed': 'Megnézte a telefonszámot',
  'registration.saved': 'Mentette a vállalkozás adatlapját',
  'registration.submitted': 'Kérte az útmutatót',
  'registration.guide_opened': 'Megnyitotta az útmutatót',
  'registration.filed': 'Feltöltötte a NAV-os igazolást',
  'registration.checked': 'Ellenőrizte a NAV-os igazolást',
  'registration.fix_requested': 'Javítást kért a bejelentésen',
  'registration.adoszam_set': 'Rögzítette az adószámot',
  'registration.withdrawn': 'Leállította a vállalkozás bejelentését',
  'registration.edited_by_staff': 'Javította a vállalkozás adatait',
  'registration.assigned': 'Gazdát adott a vállalkozás-indításnak',
  'team.member_invited': 'Munkatársat hívott meg',
  'team.member_updated': 'Munkatárs adatai módosultak',
  'team.member_disabled': 'Munkatárs felfüggesztve',
  'team.member_enabled': 'Munkatárs visszakapcsolva',
  'business_status.set': 'Megadta, van-e már vállalkozása',
  // SPEC §27.9.1
  'business_status.changed': 'Módosította a válaszát (van-e már vállalkozása)',
  'team.path_changed': 'A csapat módosította az ügyfél útvonalát',
  'registration.chamber_done': 'Kipipálta a kamarai regisztrációt',
  'registration.chamber_undone': 'Visszavonta a kamarai regisztráció pipáját',
  'client.disabled': 'Ügyfélfiók letiltva',
  'client.enabled': 'Ügyfélfiók újra engedélyezve',
  'assist.created': 'Intézzük helyette: kérés indult',
  'assist.linked': 'Intézzük helyette: meglévő visszahíváshoz kötve',
  'assist.upgraded': 'Intézzük helyette: bővült vállalkozás-bejelentésre',
  'assist.converted': 'Intézzük helyette: meghatalmazásra szűkült',
  'assist.agreed': 'Intézzük helyette: egyeztettünk',
  'assist.ujegyke_filed': 'Intézzük helyette: UJEGYKE beküldve',
  'assist.client_approved': 'Intézzük helyette: az ügyfél jóváhagyta',
  'assist.expired': 'Intézzük helyette: lejárt a 4 nap',
  'assist.mh_live': 'Intézzük helyette: él a meghatalmazás',
  'assist.consent_given': 'Intézzük helyette: az ügyfél engedélyezte a bejelentést',
  'assist.consent_invalidated': 'Intézzük helyette: az engedély érvényét vesztette',
  'assist.ev_filed': 'Intézzük helyette: bejelentés beküldve',
  'assist.done': 'Intézzük helyette: kész',
  'assist.cancelled': 'Intézzük helyette: az ügyfél lemondta',
  'assist.closed': 'Intézzük helyette: lezárva',
  'assist.assigned': 'Intézzük helyette: gazdát kapott',
  'assist.check_ticked': 'Intézzük helyette: pontot pipált',
  'assist.data_viewed': 'Megnézte a beküldéshez szükséges adatokat',
};
/** Old action names that the backend no longer writes: kept for old rows, left out of the filter. */
const AUDIT_REGI = new Set(['subscription.started', 'request.updated', 'gdpr.downloaded']);
/** The admin filter: one entry per label, in Hungarian alphabetical order. */
export function auditSzuroLista(): [string, string][] {
  return Object.entries(AUDIT_LABEL)
    .filter(([k]) => !AUDIT_REGI.has(k))
    .sort((a, b) => a[1].localeCompare(b[1], 'hu'));
}

/** Detail keys and enum values of audit rows, for people (no "to: teljesitve"). */
const AUDIT_DETAIL_KEY: Record<string, string> = {
  to: 'új állapot',
  from: 'előtte',
  status: 'állapot',
  type: 'típus',
  step: 'lépés',
  method: 'mód',
  channel: 'csatorna',
  category: 'kategória',
  month: 'hónap',
  n: 'darab',
  version: 'változat',
  pages: 'oldal',
  periodKey: 'időszak',
  totalHuf: 'összeg (Ft)',
  amountHuf: 'összeg (Ft)',
  clientKind: 'felület',
  first: 'első kitöltés',
  ok: 'sikeres',
  locked: 'zárolva',
  recovery: 'tartalék kóddal',
  all: 'minden eszközön',
  environment: 'környezet',
  kind: 'fajta',
  by: 'ki',
  valid: 'érvényes',
  mode: 'mód',
  platform: 'felület',
  purpose: 'cél',
  file: 'fájlból',
  reasonGiven: 'indokolta',
  fields: 'mezők',
  withFile: 'fájllal',
  approved: 'jóváhagyva',
  pep: 'kiemelt közszereplő',
  documentType: 'okmány',
  attachments: 'csatolmány',
  seen: 'látott',
  added: 'új',
  overridden: 'kézzel módosítva',
  form: 'nyomtatvány',
  filedOn: 'beadás napja',
  documentsMoved: 'Beadva állapotba tett irat',
  reasonLength: 'indoklás hossza',
  paidOn: 'befizetés napja',
  kinds: 'tételek',
  reason: 'ok',
  code: 'kód',
  attempts: 'próbálkozás',
  cards: 'kártya',
  known: 'ismert',
  txMode: 'tranzakció módja',
  clients: 'ügyfél',
  deleted: 'törölve',
  docType: 'dokumentum',
  docs: 'irat',
  filtered: 'szűrve',
  orderRef: 'rendelésazonosító',
  provider: 'szolgáltató',
  referral: 'ajánlókóddal',
  role: 'szerep',
  year: 'év',
  asOf: 'adatok napja',
  invoicesNew: 'új számla',
  digestsSeen: 'átnézett számla',
  dossierMonth: 'dosszié hónapja',
  finalStatus: 'végső állapot',
  allowed: 'engedélyezve',
  passwordOk: 'jó jelszó',
  replay: 'ismételt kérés',
  whileLocked: 'zárolás alatt',
  errorCode: 'hibakód',
  periodStart: 'kezdete',
  periodEnd: 'vége',
  dueDate: 'határidő',
  verification: 'ellenőrzés',
  certificateType: 'igazolás',
  language: 'nyelv',
  direction: 'irány',
  cutoff: 'eddig a napig',
  withExpected: 'várható bevétellel',
  afaMentes: 'ÁFA-mentes',
  afaKod: 'ÁFA-kód',
  answerFields: 'válaszmezők',
  attempt: 'kísérlet',
  codes: 'kódok',
  gaveUp: 'feladva',
  hoursAgo: 'ennyi órája',
  knownAddress: 'ismert cím',
  outcome: 'eredmény',
  path: 'út',
  reupload: 'újra feltöltve',
  sameInstall: 'ugyanaz a telepítés',
  savedToProfile: 'adatlapra mentve',
  seed: 'mintaadat',
  skipped: 'kihagyva',
  source: 'honnan',
  summary: 'összefoglaló',
  topic: 'téma',
  updated: 'frissítve',
  window: 'mikor hívható',
  withAdoszam: 'adószámmal',
  // SPEC §27
  undo: 'visszavonás',
  blocker: 'akadály',
  jogcim: 'jogcím',
  item: 'pont',
  clearAdoszam: 'adószám törölve a profilból',
  expiredCount: 'lejárt jóváhagyás',
};
/** Detail keys that hold internal ids: never printed. */
const AUDIT_REJTETT = new Set(['toUserId', 'userId', 'fromUserId', 'holderUserId', 'assignedTo']);
/** Enum values that mean different things under different keys. */
const AUDIT_VALUE_KULCS: Record<string, Record<string, string>> = {
  by: { staff: 'munkatárs', csapat: 'ügyfélszolgálat', admin: 'tulajdonos', accountant: 'könyvelő', client: 'ügyfél', system: 'rendszer' },
  role: { staff: 'munkatárs', csapat: 'ügyfélszolgálat', admin: 'tulajdonos', accountant: 'könyvelő', client: 'ügyfél' },
  path: { van: 'már van vállalkozása', inditas: 'most indítja' },
  // SPEC §27.2.4: business_status.changed { from, to }
  from: { van: 'már van vállalkozása', inditas: 'most indítja' },
  to: { van: 'már van vállalkozása', inditas: 'most indítja' },
  undo: { true: 'visszavonta 30 mp-en belül', false: 'nem' },
  topic: CALLBACK_TOPIC_LABELS as Record<string, string>,
  window: CALLBACK_WINDOW_LABELS as Record<string, string>,
  outcome: CALLBACK_ATTEMPT_OUTCOME_LABELS as Record<string, string>,
  reason: CALLBACK_CLOSE_REASON_LABELS as Record<string, string>,
};
const AUDIT_VALUE: Record<string, string> = {
  nyitott: 'Nyitott',
  folyamatban: 'Folyamatban',
  teljesitve: 'Teljesítve',
  elutasitva: 'Elutasítva',
  visszavonva: 'Visszavonva',
  feltoltve: 'Feltöltve',
  konyvelo_latta: 'Látta',
  feldolgozva: 'Feldolgozva',
  beadva: 'Beadva',
  dokumentum: 'Irat',
  adat: 'Adat',
  egyeb: 'Egyéb',
  kesz: 'Kész',
  hianyos: 'Hiányos',
  kihagyva: 'Kihagyva',
  ugyfelre_var: 'Ügyfélre vár',
  konyvelore_var: 'Rád vár',
  elfogadva: 'Elfogadva',
  telefon: 'Telefon',
  video: 'Videó',
  megtortent: 'Megtörtént',
  elmaradt: 'Elmaradt',
  lemondva: 'Lemondva',
  foglalt: 'Foglalt',
  password: 'jelszó',
  totp: 'kétlépcsős kód',
  register: 'regisztráció',
  google: 'Google',
  apple: 'Apple',
  web: 'web',
  native: 'app',
  panel: 'panel',
  demo: 'DEMO',
  accountant: 'könyvelő',
  client: 'ügyfél',
  card_update: 'kártyacsere',
  subscribe: 'előfizetés',
  true: 'igen',
  false: 'nem',
  kyc: 'azonosító okmány',
  uzenet_csatolmany: 'üzenet-csatolmány',
  dijszamla: 'díjszámla',
  szemelyi_igazolvany: 'személyi igazolvány',
  utlevel: 'útlevél',
  jogositvany: 'jogosítvány',
  onya_ugyfel: 'ONYA, ügyfél',
  onya_konyvelo: 'ONYA, könyvelő',
  alairt_pdf: 'aláírt PDF',
  szamlazzhu: 'Számlázz.hu',
  billingo: 'Billingo',
  sandbox: 'SimplePay teszt',
  live: 'SimplePay éles',
  disabled: 'kikapcsolva',
  mode_mismatch: 'más módban indult',
  merchant: 'más kereskedő',
  ellenorizve: 'ellenőrizve',
  rendben: 'rendben',
  elteres: 'eltérés',
  tb: 'TB-járulék',
  szocho: 'szocho',
  szja: 'SZJA-előleg',
  ugyfeltol: 'ügyféltől',
  konyvelotol: 'könyvelőtől',
  hu: 'magyar',
  en: 'angol',
  regisztracio: 'kártyaregisztráció',
  havidij: 'havidíj',
  csapat: 'ügyfélszolgálat',
  nem_vette_fel: 'nem vette fel',
  hibas_szam: 'hibás szám',
  kesobb_kerte: 'később kérte',
  beszeltunk: 'beszéltünk',
  // SPEC §27
  vallalkozas_bejelentes: 'vállalkozás bejelentése',
  meghatalmazas: 'NAV-meghatalmazás',
  ugyfel: 'ügyfél',
  rendszer: 'rendszer',
  onallo: 'maga jelenti be',
  segitett: 'intézzük helyette',
  meghatalmazott: 'meghatalmazottként',
  utvaltas: 'útvonalat váltott',
  nincs_belepese: 'nincs Ügyfélkapu+-a vagy DÁP-ja',
  magam_intezem: 'mégis maga intézi',
  nem_ertuk_el: 'nem értük el',
  duplikalt: 'dupla kérés',
};

export function auditDetail(d: Record<string, unknown> | null): string {
  if (!d) return '';
  return Object.entries(d)
    .filter(([k, v]) => v !== null && v !== undefined && typeof v !== 'object' && !AUDIT_REJTETT.has(k) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(v)))
    .slice(0, 4)
    .map(([k, v]) => {
      const key = AUDIT_DETAIL_KEY[k] ?? k;
      const raw = String(v);
      // Dates, quarters and months the Hungarian way; enums (step, category, request type) by their names.
      const val = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? datum(raw, { ev: true })
        : /^\d{4}-(Q[1-4]|HIPA(-[12])?)$/.test(raw)
          ? negyedevNev(raw)
          : /^\d{4}-\d{2}$/.test(raw) && (k === 'month' || k === 'dossierMonth')
            ? honapEv(raw)
            : (AUDIT_VALUE_KULCS[k]?.[raw] ??
              (STEP_LABEL as Record<string, { cim: string } | undefined>)[raw]?.cim ??
              AUDIT_VALUE[raw] ??
              (REQUEST_TYPE_LABEL as Record<string, string>)[raw] ??
              (CATEGORY_LABEL as Record<string, string>)[raw] ??
              raw);
      return `${key}: ${val}`;
    })
    .join(' · ');
}
export function auditLabel(action: string): string {
  return AUDIT_LABEL[action] ?? action;
}
export const ROLE_LABEL: Record<string, string> = { client: 'ügyfél', accountant: 'könyvelő', admin: 'tulajdonos', csapat: 'ügyfélszolgálat', system: 'rendszer' };
export const MODE_LABEL: Record<string, string> = {
  demo: 'DEMO',
  sandbox: 'teszt (sandbox)',
  test: 'NAV tesztrendszer',
  live: 'éles',
  prod: 'éles',
  smtp: 'éles (SMTP)',
  expo: 'éles (Expo)',
  szamlazzhu: 'Számlázz.hu',
  billingo: 'Billingo',
  off: 'kikapcsolva',
  not_configured: 'nincs beállítva',
};

// SimplePay v2 transaction states (and our own internal codes) in Hungarian, with the next step.
// Numeric SimplePay error codes are shown as they are: their meaning is in the SimplePay developer documentation.
const FIZETESI_KOD: Record<string, { mi: string; teendo: string }> = {
  NOTAUTHORIZED: { mi: 'A bank elutasította a terhelést', teendo: 'Gyakran fedezethiány vagy kártyalimit. Az újrapróbálás pár nap múlva magától jön; ha ismét elutasítják, kérj új kártyát az ügyféltől.' },
  CANCELLED: { mi: 'A fizetést megszakították', teendo: 'Az ügyfél bezárta a fizetőoldalt. Újra elindíthatja az appból.' },
  TIMEOUT: { mi: 'Lejárt a fizetésre szánt idő', teendo: 'Nem fejezte be a kártyaadatok megadását. Újra elindíthatja az appból.' },
  FRAUD: { mi: 'Csalásgyanú miatt elutasítva', teendo: 'A SimplePay csalásszűrője állította meg. Nézd meg a SimplePay kereskedői adminban.' },
  REVERSED: { mi: 'A terhelést visszavonták', teendo: 'A lefoglalt összeg visszament a kártyára.' },
  REFUND: { mi: 'Visszatérítve', teendo: 'Az összeget visszautaltuk a kártyára.' },
  NO_TOKEN: { mi: 'Nincs érvényes kártyaengedély', teendo: 'Az ügyfélnek új kártyaregisztráció kell (Fiók → Előfizetés).' },
  UNKNOWN: { mi: 'Ismeretlen hiba', teendo: 'Nézd meg a SimplePay kereskedői adminban a tranzakció azonosítójával.' },
};
/** `fajta`: the transaction kind ('regisztracio' = the first card registration, which is NEVER retried automatically). */
export function fizetesiHiba(kod: string | null | undefined, fajta?: string): { kod: string; mi: string; teendo: string; demo: boolean } {
  const k = (kod ?? 'UNKNOWN').trim();
  const demo = k.startsWith('DEMO_');
  const tiszta = demo ? k.slice(5) : k;
  if (fajta === 'regisztracio' && tiszta === 'NOTAUTHORIZED')
    return {
      kod: k,
      demo,
      mi: demo ? 'DEMO: a bank elutasította a kártyaregisztrációt' : 'A bank elutasította a kártyaregisztrációt',
      teendo: 'Gyakran fedezethiány vagy kártyalimit. Ezt nem próbáljuk újra magától: az ügyfél indíthatja el újra az appból (Bekötés → Előfizetés), ugyanazzal vagy másik kártyával.',
    };
  if (demo && tiszta === 'TOKEN') return { kod: k, demo, mi: 'DEMO: a próbaterhelés szándékosan sikertelen', teendo: 'Csak a demó működését mutatja, valódi kártyát nem érint.' };
  const ismert = FIZETESI_KOD[tiszta];
  if (ismert) return { kod: k, demo, mi: demo ? `DEMO: ${ismert.mi.charAt(0).toLowerCase()}${ismert.mi.slice(1)}` : ismert.mi, teendo: ismert.teendo };
  if (/^\d+$/.test(tiszta)) return { kod: k, demo, mi: `SimplePay-hibakód ${tiszta}`, teendo: 'A jelentését a SimplePay fejlesztői dokumentációjának hibakód-listája adja meg; a kereskedői admin is mutatja.' };
  return { kod: k, demo, mi: tiszta, teendo: '' };
}
