// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
// Domain enums shared by backend, app and panel. Source of truth: kod/SPEC.md §5–§6 and §26 (owner orders 11-18).
// Values are Hungarian ASCII snake_case where they are domain states (SPEC §3.5).
// GENERATED COPIES in other packages must not be edited – edit kod/shared/src and re-sync.

// 'csapat' (SPEC §26.4) = service team member (ügyfélszolgálat): callbacks, new-business registrations, messages of
// clients still in onboarding. Never tax data, dossier, KYC or NAV credentials. DB: ALTER TYPE user_role ADD VALUE.
export const USER_ROLES = ['client', 'accountant', 'admin', 'csapat'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const STAFF_ROLES = ['accountant', 'admin', 'csapat'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  client: 'Ügyfél',
  accountant: 'Könyvelő',
  admin: 'Tulajdonos',
  csapat: 'Ügyfélszolgálat',
};

export const USER_STATUSES = ['active', 'disabled', 'pending_deletion', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CLIENT_KINDS = ['native', 'web', 'panel'] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export const CLIENT_LIFECYCLES = ['bekotes_alatt', 'aktiv', 'felfuggesztve', 'megszunt'] as const;
export type ClientLifecycle = (typeof CLIENT_LIFECYCLES)[number];

// 'vallalkozas_inditas' is APPENDED (SPEC §26.1; DB: ALTER TYPE onboarding_step ADD VALUE). 'idopont' is LEGACY
// (SPEC §26.2.9): the value stays so old rows remain readable, but it is never shown, opened, counted or required.
export const ONBOARDING_STEPS = [
  'fiok',
  'adatok',
  'szerzodes',
  'elofizetes',
  'meghatalmazas',
  'azonositas',
  'idopont',
  'nav_bekotes',
  'vallalkozas_inditas',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const LEGACY_ONBOARDING_STEPS: readonly OnboardingStep[] = ['idopont'];

export const STEP_STATUSES = ['nincs_kezdve', 'ugyfelre_var', 'konyvelore_var', 'hianyos', 'kesz', 'kihagyva'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

// SPEC §26.1.1 – "Van már egyéni vállalkozásod?" ('van' = existing business, 'inditas' = starting a new one).
// Stored in clients.business_status (null = not answered yet). The onboarding path is the same value.
export const BUSINESS_STATUSES = ['van', 'inditas'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];
export type OnboardingPath = BusinessStatus;

/**
 * Display order of the step rows per path (SPEC §26.1.6, changed by §27.4: both paths end with the same tail
 * NAV-meghatalmazás → Igazolványok → Előfizetés → Kiállított számlák bekötése). 'idopont' never appears.
 */
export const ONBOARDING_STEP_ORDER: Record<OnboardingPath, readonly OnboardingStep[]> = {
  van: ['fiok', 'adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'],
  inditas: ['fiok', 'adatok', 'vallalkozas_inditas', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'],
};
/** SPEC §27.3: new business with "Intézzük helyetted" (registration mode 'segitett'): contract and meghatalmazás first. */
export const ONBOARDING_STEP_ORDER_SEGITETT: readonly OnboardingStep[] = [
  'fiok',
  'adatok',
  'szerzodes',
  'meghatalmazas',
  'vallalkozas_inditas',
  'azonositas',
  'elofizetes',
  'nav_bekotes',
];
/**
 * Steps that must be 'kesz' or 'kihagyva' before lifecycle → 'aktiv' (SPEC §26.1.6). Replaces the old
 * REQUIRED_STEPS (all but 'idopont'): a missing 'vallalkozas_inditas' row must never block a 'van' client.
 * A client whose business_status is null uses the 'van' list.
 */
export const ONBOARDING_REQUIRED_STEPS: Record<OnboardingPath, readonly OnboardingStep[]> = {
  van: ['fiok', 'adatok', 'szerzodes', 'elofizetes', 'meghatalmazas', 'azonositas', 'nav_bekotes'],
  inditas: ['fiok', 'adatok', 'vallalkozas_inditas', 'szerzodes', 'elofizetes', 'meghatalmazas', 'azonositas', 'nav_bekotes'],
};
/** Short step names (step cards' caption, panel columns). */
export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  fiok: 'Fiók',
  adatok: 'Adataid',
  szerzodes: 'Szerződés',
  elofizetes: 'Előfizetés',
  meghatalmazas: 'NAV-meghatalmazás',
  azonositas: 'Igazolványok',
  idopont: 'Időpont (régi)',
  nav_bekotes: 'Kiállított számlák bekötése', // SPEC §27.5 (was "Számlák bekötése")
  vallalkozas_inditas: 'Vállalkozás bejelentése',
};

export const MILESTONES = ['alairva', 'azonositva', 'nav_bejelentve', 'szamlak_bekotve', 'kesz', 'vallalkozas_elinditva'] as const;
export type Milestone = (typeof MILESTONES)[number];
export const MILESTONE_LABELS: Record<Milestone, string> = {
  alairva: 'Aláírva',
  azonositva: 'Azonosítva',
  nav_bejelentve: 'NAV-nál bejelentve',
  szamlak_bekotve: 'Kiállított számlák bekötve', // SPEC §27.5
  kesz: 'Kész',
  vallalkozas_elinditva: 'Vállalkozás elindítva',
};
/** Milestone line per path (SPEC §26.1.6). 'vallalkozas_elinditva' exists only on the new-business path, first. */
export const MILESTONE_ORDER: Record<OnboardingPath, readonly Milestone[]> = {
  van: ['alairva', 'azonositva', 'nav_bejelentve', 'szamlak_bekotve', 'kesz'],
  inditas: ['vallalkozas_elinditva', 'alairva', 'azonositva', 'nav_bejelentve', 'szamlak_bekotve', 'kesz'],
};

export const MEGHATALMAZAS_METHODS = ['onya_ugyfel', 'onya_konyvelo', 'alairt_pdf'] as const;
export type MeghatalmazasMethod = (typeof MEGHATALMAZAS_METHODS)[number];
/** SPEC §27.3: client wording of the methods. 'onya_konyvelo' = the assisted meghatalmazás (ASSIST kind 'meghatalmazas'). */
export const MEGHATALMAZAS_METHOD_LABELS: Record<MeghatalmazasMethod, string> = {
  onya_ugyfel: 'Magam adom meg az ONYA-ban',
  onya_konyvelo: 'Intézzétek ti, én csak jóváhagyom',
  alairt_pdf: 'Aláírt PDF-fel',
};

export const KYC_STATUSES = ['bekuldve', 'elfogadva', 'hianyos'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const TAX_STATUSES = ['fofoglalkozasu', 'mellekallasu', 'nyugdijas'] as const;
export type TaxStatus = (typeof TAX_STATUSES)[number];

export const COST_RATIOS = [45, 80, 90] as const;
export type CostRatio = (typeof COST_RATIOS)[number];

export const ACTIVITY_ANSWERS = ['kiskereskedelem', 'lista80', 'egyeb'] as const;
export type ActivityAnswer = (typeof ACTIVITY_ANSWERS)[number];

export const HIPA_METHODS = ['savos', 'altalanos', 'nincs'] as const;
export type HipaMethod = (typeof HIPA_METHODS)[number];

// The four words never change (design + FUNKCIOK 14).
export const DOCUMENT_STATUSES = ['feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_SOURCES = ['ugyfel', 'konyvelo', 'nav', 'rendszer'] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

export const DOCUMENT_CATEGORIES = [
  'nyugta',
  'penztargep_osszesito',
  'bankszamlakivonat',
  'szerzodes',
  'koltseg_bizonylat',
  'kiallitott_szamla_kezi',
  'nav_level',
  'bevallas',
  'nav_visszaigazolas',
  'igazolas',
  'meghatalmazas',
  'szerzodes_alairt',
  'egyeb',
  // SPEC §26.1.5: the NAV PDF of the client's own EV bejelentés (értesítés / nyilvántartásba vétel).
  // DB: ALTER TYPE document_category ADD VALUE 'ev_bejelentes'. Shown in DossierView.contracts (no workflow status).
  'ev_bejelentes',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_VISIBILITIES = ['kozos', 'csak_konyvelo'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export const TAX_PERIOD_KINDS = ['negyedev', 'hipa'] as const;
export type TaxPeriodKind = (typeof TAX_PERIOD_KINDS)[number];

export const CALC_STATUSES = ['nincs', 'becsles', 'jovahagyva'] as const;
export type CalcStatus = (typeof CALC_STATUSES)[number];

export const PAYMENT_STATUSES = ['nincs_fizetendo', 'fizetendo', 'befizetve_jelezve', 'ellenorizve', 'elteres'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FILING_STATUSES = ['nincs', 'beadva'] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

export const PAYMENT_ITEM_KINDS = ['tb_jarulek', 'szocho', 'szja_eloleg', 'hipa_eloleg', 'hipa_kulonbozet'] as const;
export type PaymentItemKind = (typeof PAYMENT_ITEM_KINDS)[number];

export const HERO_STATES = ['bekotes_alatt', 'becsles', 'jovahagyva', 'befizetve', 'nincs_fizetendo'] as const;
export type HeroState = (typeof HERO_STATES)[number];

export const REQUEST_DIRECTIONS = ['konyvelotol', 'ugyfeltol'] as const;
export type RequestDirection = (typeof REQUEST_DIRECTIONS)[number];

export const REQUEST_TYPES_FROM_ACCOUNTANT = ['dokumentum', 'adat', 'egyeb'] as const;
export const REQUEST_TYPES_FROM_CLIENT = [
  'jovedelemigazolas',
  'nullas_igazolas',
  'koztartozasmentes_igazolas',
  'adatvaltozas',
  'tevekenysegvaltozas',
  'kerdes',
] as const;
export type RequestType = (typeof REQUEST_TYPES_FROM_ACCOUNTANT)[number] | (typeof REQUEST_TYPES_FROM_CLIENT)[number];

export const REQUEST_STATUSES = ['nyitott', 'folyamatban', 'teljesitve', 'elutasitva', 'visszavonva'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const CERTIFICATE_TYPES = ['jovedelemigazolas', 'nullas_igazolas', 'koztartozasmentes_igazolas'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

/** @deprecated SPEC §26.2: appointment booking is retired; kept only so old rows stay readable. */
export const APPOINTMENT_CHANNELS = ['telefon', 'video'] as const;
export type AppointmentChannel = (typeof APPOINTMENT_CHANNELS)[number];

/** @deprecated SPEC §26.2: appointment booking is retired; kept only so old rows stay readable. */
export const APPOINTMENT_STATUSES = ['foglalt', 'lemondva', 'megtortent', 'elmaradt'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['incomplete', 'active', 'past_due', 'suspended', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INTEGRATION_MODES = ['demo', 'sandbox', 'live'] as const;
export type PaymentMode = (typeof INTEGRATION_MODES)[number];

export const NAV_MODES = ['demo', 'test', 'prod'] as const;
export type NavMode = (typeof NAV_MODES)[number];

export const CLIENT_FLAGS = ['bekotes_alatt', 'rendben', 'hianyzik_valami', 'hatar_kozel', 'dij_elmaradt'] as const;
export type ClientFlag = (typeof CLIENT_FLAGS)[number];
export type ClientFilter = ClientFlag | 'mind';

export const LEGAL_DOC_TYPES = [
  'aszf',
  'adatkezeles',
  'megbizasi_szerzodes',
  'nav_meghatalmazas',
  'adatfeldolgozoi',
  'pmt_nyilatkozatok',
  'simplepay_adattovabbitas',
  'simplepay_ismetlodo',
  'app_szovegek',
] as const;
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

export const NOTIFICATION_KINDS = [
  'tax_approved',
  'tax_due_soon',
  'tax_reopened',
  'tax_payment_verified',
  'tax_payment_mismatch',
  'tax_filed',
  'document_processed',
  'document_filed',
  'request_new',
  'request_reminder',
  'request_done',
  'message_new',
  'client_message_new',
  'client_request_new',
  'client_document_uploaded',
  'client_marked_paid',
  'onboarding_needs_review',
  'onboarding_needs_fix',
  'onboarding_done',
  'limit_warning',
  // LEGACY (SPEC §26.2.9): never sent again; old rows stay readable; hidden from the notification settings.
  'appointment_booked',
  'appointment_reminder',
  'appointment_cancelled',
  'subscription_payment_failed',
  'subscription_renewal_needed',
  'subscription_canceled',
  'fee_invoice_issued',
  'auth_email_code',
  'auth_password_reset_code',
  'auth_staff_invite',
  'gdpr_export_ready',
  // SPEC §26.11 – client (DB: ALTER TYPE notification_kind ADD VALUE …, own migration file)
  'callback_received',
  'callback_calling',
  'callback_missed',
  'callback_wrong_number',
  'callback_done',
  'callback_unreached',
  'callback_closed',
  'registration_reminder',
  'registration_needs_fix',
  'registration_checked',
  'registration_done',
  // SPEC §26.11 – staff (csapat / admin / the assigned accountant)
  'callback_new',
  'callback_assigned',
  'callback_overdue',
  'registration_submitted',
  // SPEC §27.8 – client (DB: ALTER TYPE notification_kind ADD VALUE …, own migration file 0010)
  'assist_started',
  'assist_mh_filed',
  'assist_mh_reminder',
  'assist_mh_expired',
  'assist_consent_needed',
  'assist_ev_filed',
  'kamara_reminder',
  // SPEC §27.8 – staff
  'assist_task',
  'assist_approval_overdue',
  'client_path_changed',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
/** Kinds never sent any more and hidden from the client's notification settings (SPEC §26.2.9). */
export const LEGACY_NOTIFICATION_KINDS: readonly NotificationKind[] = ['appointment_booked', 'appointment_reminder', 'appointment_cancelled'];

// The 16 approved realistic 3D icons (dizajn/C2_modern/assets/ikon3d). No other pictorial icons exist.
export const ICON3D = [
  'befizetve',
  'dosszie',
  'ertesites',
  'feltoltes',
  'fiok',
  'fooldal',
  'fotozas',
  'hataridok',
  'igazolas',
  'irat',
  'kerdezek',
  'masolas',
  'nyugta',
  'szamlaszam',
  'szamolo',
  'uzenetek',
] as const;
export type Icon3d = (typeof ICON3D)[number];
export const ICON3D_SIZES_PT = [24, 28, 36, 44, 56, 72] as const;
// Same approved realistic 3D family, sheet C (assets/ikon3d/_elonezet_kiegeszito.png); already in the app's and the
// panel's image registries. SPEC §26: 'lakat' = locked before activation, 'ora' = callback (24–48 h),
// 'tepnaptar' = start date, 'boritek' = seat / address, 'bevallas' = tax choices, 'szamlak' = NAV invoices.
export const ICON3D_EXTRA = ['bevallas', 'boritek', 'kivonat', 'lakat', 'nyugta_uj', 'ora', 'szamlak', 'tepnaptar'] as const;
export type Icon3dExtra = (typeof ICON3D_EXTRA)[number];
export type Icon3dAny = Icon3d | Icon3dExtra;

export const ILLUSTRATIONS = [
  'befizetve_pecset',
  'dosszie_mappa',
  'hatarido_naptar',
  'level_boritek',
  'meghatalmazas_alairva',
  'videohivas_laptop', // retired by SPEC §26.2 (no video call any more); file stays, never shown
] as const;
export type Illustration = (typeof ILLUSTRATIONS)[number];
/** Also approved front-view objects in assets/illusztraciok (used by design 02). */
export const ILLUSTRATIONS_EXTRA = ['tepnaptar_3d'] as const;
export type IllustrationAny = Illustration | (typeof ILLUSTRATIONS_EXTRA)[number];

// UI labels. `konyvelo_latta` is rendered with the accountant's first name: "{firstName} látta".
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  feltoltve: 'Feltöltve',
  konyvelo_latta: '{firstName} látta',
  feldolgozva: 'Feldolgozva',
  beadva: 'Beadva',
};
/** Status words of the client's ISSUED invoices (SPEC §27.5: never "jött a NAV-tól"; we download them). */
export const NAV_ITEM_STATUS_LABELS: Record<DocumentStatus, string> = {
  feltoltve: 'Letöltöttük',
  konyvelo_latta: '{firstName} látta',
  feldolgozva: 'Feldolgozva',
  beadva: 'Beadva',
};
export const DOCUMENT_CATEGORY_ICON: Record<DocumentCategory, Icon3d> = {
  nyugta: 'nyugta',
  penztargep_osszesito: 'nyugta',
  bankszamlakivonat: 'irat',
  szerzodes: 'irat',
  koltseg_bizonylat: 'nyugta',
  kiallitott_szamla_kezi: 'irat',
  nav_level: 'ertesites',
  bevallas: 'irat',
  nav_visszaigazolas: 'irat',
  igazolas: 'igazolas',
  meghatalmazas: 'irat',
  szerzodes_alairt: 'irat',
  egyeb: 'irat',
  ev_bejelentes: 'irat',
};

// =====================================================================================================================
// SPEC §26 – owner orders of 2026-11-18: new business (SELF-SERVICE), callback instead of booking, bottom bar during
// onboarding, restricted mode before activation, explainers, videos, annotated NAV screenshots.
// New domain states are text columns + CHECK (no new Postgres enum types); only user_role, onboarding_step,
// notification_kind and document_category get ADD VALUE, in their own migration file (SPEC §26.9).
// =====================================================================================================================

// ---------- §26.1 new business (the CLIENT files the EV bejelentés himself; the team never files) ----------
/**
 * business_registrations.status (SPEC §26.1.5).
 * kitoltes = filling the data form (draft) · utmutato = data sent, personalised guide open, not filed yet ·
 * beadva = client says filed + uploaded the NAV PDF, team to check · javitas = team asked for a fix ·
 * ellenorizve = team checked the PDF, waiting for the adószám · kesz = adószám recorded, normal path continues ·
 * elallt = withdrawn.
 */
export const REGISTRATION_STATUSES = ['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve', 'kesz', 'elallt'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];
export const REGISTRATION_OPEN_STATUSES: readonly RegistrationStatus[] = ['kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve'];
/** Panel wording (pipeline columns). */
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  kitoltes: 'Adatokat tölt',
  utmutato: 'Útmutatónál tart',
  beadva: 'Ellenőrzésre vár',
  javitas: 'Javításra vár',
  ellenorizve: 'Adószámra vár',
  kesz: 'Kész',
  elallt: 'Elállt',
};
/**
 * Default client wording (tegező); editable as content texts `vallalkozas.allapot.<status>`; served in
 * BusinessRegistrationView.statusText. SPEC §27.4: one noun per object – "kérdőív" (our questions), "bejelentés"
 * (the NAV filing), "NAV-os értesítés" (NAV's PDF). Mode 'segitett' uses ASSIST_STATUS_CLIENT_TEXT instead.
 */
export const REGISTRATION_STATUS_CLIENT_TEXT: Record<RegistrationStatus, string> = {
  kitoltes: 'Még nem töltötted ki a kérdőívet. Ott folytathatod, ahol abbahagytad.',
  utmutato: 'Kész a személyre szabott útmutatód. Lépésről lépésre megmutatja, mit jelölj be a NAV oldalán.',
  beadva: 'Megkaptuk a NAV-os értesítést. Átnézzük, általában 1 munkanapon belül.',
  javitas: 'Egy dolgot javítanod kell. Megírtuk, mit és hogyan.',
  ellenorizve: 'Rendben van a bejelentésed. Az adószámodat az értesítésről mi rögzítjük. Ha még nincs rajta, a NAV pár napon belül küldi.',
  kesz: 'Elindult a vállalkozásod. Jöhet a következő lépés.',
  elallt: 'Leállítottad a vállalkozás bejelentését.',
};
/** onboarding_steps('vallalkozas_inditas').status is DERIVED from the registration (never set by hand). */
export const REGISTRATION_STEP_STATUS: Record<RegistrationStatus, StepStatus> = {
  kitoltes: 'ugyfelre_var',
  utmutato: 'ugyfelre_var',
  beadva: 'konyvelore_var',
  javitas: 'hianyos',
  ellenorizve: 'konyvelore_var',
  kesz: 'kesz',
  elallt: 'kihagyva',
};
export const REGISTRATION_WITHDRAW_REASONS = ['mar_van_vallalkozasa', 'kesobb_inditom', 'meggondolta', 'egyeb'] as const;
export type RegistrationWithdrawReason = (typeof REGISTRATION_WITHDRAW_REASONS)[number];
export const REGISTRATION_WITHDRAW_REASON_LABELS: Record<RegistrationWithdrawReason, string> = {
  mar_van_vallalkozasa: 'Mégis van már vállalkozásom',
  kesobb_inditom: 'Később indítom',
  meggondolta: 'Meggondoltam magam',
  egyeb: 'Egyéb',
};
/** Where the seat (székhely) is. */
export const SEAT_KINDS = ['lakcim', 'mas_cim', 'szekhelyszolgaltato'] as const;
export type SeatKind = (typeof SEAT_KINDS)[number];
export const SEAT_KIND_LABELS: Record<SeatKind, string> = {
  lakcim: 'A lakcímem',
  mas_cim: 'Másik cím',
  szekhelyszolgaltato: 'Székhelyszolgáltató',
};
/** On what right the client uses a non-home seat (Evectv. 16. § (6)); nothing is uploaded. */
export const SEAT_RIGHTS = ['tulajdon', 'berlet', 'tulajdonos_hozzajarulasa', 'szekhelyszolgaltatasi_szerzodes'] as const;
export type SeatRight = (typeof SEAT_RIGHTS)[number];
export const SEAT_RIGHT_LABELS: Record<SeatRight, string> = {
  tulajdon: 'Az enyém (vagy résztulajdonos vagyok)',
  berlet: 'Bérlem',
  tulajdonos_hozzajarulasa: 'A tulajdonos megengedte',
  szekhelyszolgaltatasi_szerzodes: 'Székhelyszolgáltatási szerződésem van',
};
/** "Munkavégzés jellege" on the NAV form. Maps to TaxStatus (WORK_KIND_TAX_STATUS). */
export const WORK_KINDS = ['fofoglalkozas', 'munkaviszony_mellett', 'tanulmany_mellett', 'nyugdij_mellett'] as const;
export type WorkKind = (typeof WORK_KINDS)[number];
export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  fofoglalkozas: 'Ez lesz a fő munkám',
  munkaviszony_mellett: 'Mellette legalább heti 36 órás munkaviszonyom van',
  tanulmany_mellett: 'Mellette nappali tagozaton tanulok',
  nyugdij_mellett: 'Saját jogú nyugdíjas vagyok',
};
export const WORK_KIND_TAX_STATUS: Record<WorkKind, TaxStatus> = {
  fofoglalkozas: 'fofoglalkozasu',
  munkaviszony_mellett: 'mellekallasu',
  tanulmany_mellett: 'mellekallasu',
  nyugdij_mellett: 'nyugdijas',
};
/** Will the client work for / buy services from businesses in other EU countries (→ közösségi adószám)? */
export const EU_PARTNER_ANSWERS = ['nem', 'igen', 'nem_tudom'] as const;
export type EuPartnerAnswer = (typeof EU_PARTNER_ANSWERS)[number];
/** Expected yearly revenue. 'tobb_20m' stops the new-business path (no alanyi ÁFA-mentesség, SPEC §26.1.3). */
export const REVENUE_BANDS = ['max_12m', '12_20m', 'tobb_20m'] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];
export const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  max_12m: 'Évi 12 millió forint alatt',
  '12_20m': 'Évi 12 és 20 millió forint között',
  tobb_20m: 'Évi 20 millió forintnál több',
};
/** When the client wants to start. The NAV form has no future start date: filing day = start day (SPEC §26.1.4). */
export const START_PLANS = ['mielobb', 'datum'] as const;
export type StartPlan = (typeof START_PLANS)[number];
/**
 * How the bejelentés was filed. 'meghatalmazott' = our accountant filed it with his OWN login as the client's registered
 * meghatalmazott (SPEC §27.3, assisted path; DB: widen the CHECK of business_registrations.filed_channel).
 */
export const FILING_CHANNELS = ['ugyfelkapu_plus', 'dap', 'szemelyesen', 'meghatalmazott'] as const;
export type FilingChannel = (typeof FILING_CHANNELS)[number];
export const FILING_CHANNEL_LABELS: Record<FilingChannel, string> = {
  ugyfelkapu_plus: 'Interneten, Ügyfélkapu+-szal',
  dap: 'Interneten, a DÁP alkalmazással',
  szemelyesen: 'Személyesen, NAV-ügyfélszolgálaton',
  meghatalmazott: 'A könyvelőd küldte be, meghatalmazással',
};
/** The channels a CLIENT may choose on the upload screen ('meghatalmazott' is set only by the assisted flow). */
export const CLIENT_FILING_CHANNELS: readonly FilingChannel[] = ['ugyfelkapu_plus', 'dap', 'szemelyesen'];
/** What the team ticks on the uploaded NAV PDF (SPEC §26.1.5). All must be ticked for "Ellenőriztem". */
export const REGISTRATION_CHECK_ITEMS = [
  'szemelyes_adatok',
  'szekhely',
  'tevekenysegek',
  'munkavegzes_jellege',
  'atalanyadozas',
  'alanyi_afa_mentesseg',
  'kata_nem',
  'penzforgalmi_nem',
  'kozossegi_adoszam',
] as const;
export type RegistrationCheckItem = (typeof REGISTRATION_CHECK_ITEMS)[number];
export const REGISTRATION_CHECK_LABELS: Record<RegistrationCheckItem, string> = {
  szemelyes_adatok: 'Név, lakcím rendben',
  szekhely: 'Székhely (és telephely) rendben',
  tevekenysegek: 'Tevékenységek, főtevékenység rendben',
  munkavegzes_jellege: 'Munkavégzés jellege a válasza szerint',
  atalanyadozas: 'Átalányadózást választott',
  alanyi_afa_mentesseg: 'Alanyi ÁFA-mentességet választott',
  kata_nem: 'Katát nem választott',
  penzforgalmi_nem: 'Pénzforgalmi elszámolást nem választott',
  kozossegi_adoszam: 'Közösségi adószám a válasza szerint',
};
/** When a new-business client is charged first (env NEW_BUSINESS_CHARGE_POLICY; [OWNER] decision, SPEC §26.1.7). */
export const NEW_BUSINESS_CHARGE_POLICIES = ['adoszam_utan', 'azonnal'] as const;
export type NewBusinessChargePolicy = (typeof NEW_BUSINESS_CHARGE_POLICIES)[number];
export const NEW_BUSINESS_CHARGE_POLICY_DEFAULT: NewBusinessChargePolicy = 'adoszam_utan';
/** Suggested cost-ratio class of an activity (SPEC §26.1.3). 'ellenorizendo' = the accountant tells; no number shown. */
export const COST_CLASSES = ['altalanos', 'lista80', 'kiskereskedelem', 'ellenorizendo'] as const;
export type CostClass = (typeof COST_CLASSES)[number];
export const COST_CLASS_ANSWER: Record<CostClass, ActivityAnswer | null> = {
  altalanos: 'egyeb',
  lista80: 'lista80',
  kiskereskedelem: 'kiskereskedelem',
  ellenorizendo: null,
};

// ---------- §26.6 self-service guides (annotated REAL NAV screenshots, order 9) ----------
// SPEC §27.3.6: 'meghatalmazas_jovahagyas' = how the client APPROVES the UJEGYKE our accountant filed (assisted path).
export const GUIDE_KINDS = ['vallalkozas_bejelentes', 'meghatalmazas', 'meghatalmazas_jovahagyas'] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];
/**
 * Canonical step keys = image keys. The guide images live under <media>/utmutato/<kind>/ and are resolved through
 * <media>/utmutato/<kind>/kepek.json (GuideImageManifest, SPEC §26.6.4). Order = order of the steps.
 */
export const GUIDE_STEP_KEYS = {
  vallalkozas_bejelentes: [
    'belepes',
    'ugyseged_inditas',
    'szemelyi_adatok',
    'cimadatok',
    'tevekenysegek',
    'adozas_munkavegzes',
    'adozas_kata_atalany',
    'adozas_afa',
    'nyilatkozatok',
    'ellenorzes',
    'bekuldes',
    'megtekintes_pdf',
    'feltoltes_appban',
    'kamarai_regisztracio',
  ],
  meghatalmazas: [
    'onya_belepes',
    'onya_profil',
    'onya_uj_nyomtatvany',
    'onya_szerep',
    'onya_meghatalmazott',
    'onya_ugykorok',
    'onya_bekuldes',
    'app_bekuldtem',
  ],
  meghatalmazas_jovahagyas: [
    'onya_belepes',
    'onya_profil',
    'onya_ertesites',
    'onya_jovahagyasra_var',
    'onya_jovahagyas',
    'app_jovahagytam',
  ],
} as const satisfies Record<GuideKind, readonly string[]>;
export type GuideStepKey<K extends GuideKind = GuideKind> = (typeof GUIDE_STEP_KEYS)[K][number];
/** What the client does with a field on the NAV screen; rendered as a short verb (✓ / × as Geist text glyphs). */
export const GUIDE_ACTIONS = ['jelold', 'ne_jelold', 'ird_be', 'valaszd', 'ellenorizd', 'hagyd', 'kattints'] as const;
export type GuideAction = (typeof GUIDE_ACTIONS)[number];
export const GUIDE_ACTION_LABELS: Record<GuideAction, string> = {
  jelold: 'Jelöld be',
  ne_jelold: 'Ne jelöld be',
  ird_be: 'Írd be',
  valaszd: 'Válaszd ki',
  ellenorizd: 'Nézd át',
  hagyd: 'Hagyd, ahogy van',
  kattints: 'Kattints rá',
};
/** 'kepernyokep' = real NAV screenshot (annotated, personal data blurred); 'illusztracio' = drawn reconstruction. */
export const GUIDE_IMAGE_KINDS = ['kepernyokep', 'illusztracio'] as const;
export type GuideImageKind = (typeof GUIDE_IMAGE_KINDS)[number];
/**
 * SPEC §27.1: the honest small label under every guide picture (12 pt, secondary text, never hidden). A 'kepernyokep'
 * is followed by its source line ("Forrás: NAV, {title}, {date}" or "Forrás: saját képernyőkép, {date}").
 */
export const GUIDE_IMAGE_LABELS: Record<GuideImageKind, string> = {
  kepernyokep: 'NAV-képernyő',
  illusztracio: 'Rajzolt vázlat – a valódi képernyő kicsit eltérhet',
};

// ---------- §26.7 videos (served from the client web origin under /media/) ----------
export const VIDEO_NAMES = ['bekotes', 'vallalkozas_bejelentes', 'meghatalmazas'] as const;
export type VideoName = (typeof VIDEO_NAMES)[number];
export const VIDEO_FILES: Record<VideoName, { mp4: string; poster: string; vtt: string }> = {
  bekotes: { mp4: 'bekotes.mp4', poster: 'bekotes_poszter.jpg', vtt: 'bekotes.vtt' },
  vallalkozas_bejelentes: {
    mp4: 'vallalkozas_bejelentes.mp4',
    poster: 'vallalkozas_bejelentes_poszter.jpg',
    vtt: 'vallalkozas_bejelentes.vtt',
  },
  meghatalmazas: { mp4: 'meghatalmazas.mp4', poster: 'meghatalmazas_poszter.jpg', vtt: 'meghatalmazas.vtt' },
};
/** SPEC §27.3.6: the approval guide has no video (null → Guide.video is null and no video card is shown). */
export const GUIDE_VIDEO: Record<GuideKind, VideoName | null> = {
  vallalkozas_bejelentes: 'vallalkozas_bejelentes',
  meghatalmazas: 'meghatalmazas',
  meghatalmazas_jovahagyas: null,
};
/** Web: relative. Native: /config.mediaBaseUrl, else this fallback (the live client web origin). */
export const MEDIA_WEB_BASE = '/media/';
export const MEDIA_FALLBACK_BASE_URL = 'https://app.45-94-65-74.sslip.io/media/';
/** Optional manifest written at deploy (SPEC §26.7.2): <media>/videok.json → VideoManifest. */
export const VIDEO_MANIFEST_FILE = 'videok.json';

// ---------- §26.2 callback request (replaces appointment booking everywhere) ----------
export const CALLBACK_STATUSES = ['uj', 'folyamatban', 'teljesitve', 'sikertelen', 'visszavonva', 'lezarva'] as const;
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];
export const CALLBACK_OPEN_STATUSES: readonly CallbackStatus[] = ['uj', 'folyamatban'];
/** Panel wording. Client wording is built by the server (CallbackView.statusText, SPEC §26.2.6). */
export const CALLBACK_STATUS_LABELS: Record<CallbackStatus, string> = {
  uj: 'Új',
  folyamatban: 'Folyamatban',
  teljesitve: 'Beszéltünk',
  sikertelen: 'Nem értük el',
  visszavonva: 'Az ügyfél lemondta',
  lezarva: 'Lezárva hívás nélkül',
};
/** SPEC §27.3: the two '…_helyettem' topics are "Intézzük helyetted" requests (each opens or links an assist). */
export const CALLBACK_TOPICS = [
  'bekotes',
  'vallalkozas_inditas',
  'meghatalmazas',
  'azonositas',
  'elofizetes',
  'ado_befizetes',
  'szamlak_iratok',
  'egyeb',
  'vallalkozas_bejelentes_helyettem',
  'meghatalmazas_helyettem',
] as const;
export type CallbackTopic = (typeof CALLBACK_TOPICS)[number];
export const CALLBACK_TOPIC_LABELS: Record<CallbackTopic, string> = {
  bekotes: 'A bekötés általában',
  vallalkozas_inditas: 'Vállalkozás bejelentése',
  meghatalmazas: 'NAV-meghatalmazás',
  azonositas: 'Igazolványok',
  elofizetes: 'Előfizetés, fizetés',
  ado_befizetes: 'Adó, befizetés',
  szamlak_iratok: 'Számlák, iratok',
  egyeb: 'Valami más',
  vallalkozas_bejelentes_helyettem: 'Intézzétek helyettem: vállalkozás bejelentése',
  meghatalmazas_helyettem: 'Intézzétek helyettem: NAV-meghatalmazás',
};
/** Topics that are assisted-path requests → the assist kind they open (SPEC §27.3.2). */
export const CALLBACK_ASSIST_TOPIC: Partial<Record<CallbackTopic, 'vallalkozas_bejelentes' | 'meghatalmazas'>> = {
  vallalkozas_bejelentes_helyettem: 'vallalkozas_bejelentes',
  meghatalmazas_helyettem: 'meghatalmazas',
};
/** Preferred window. The hours are the defaults of content text `visszahivas.savok`; [OWNER] may change them. */
export const CALLBACK_WINDOWS = ['barmikor', 'delelott', 'delutan'] as const;
export type CallbackWindow = (typeof CALLBACK_WINDOWS)[number];
export const CALLBACK_WINDOW_LABELS: Record<CallbackWindow, string> = {
  barmikor: 'Bármikor (munkanapokon 9–17)',
  delelott: 'Délelőtt (9–12)',
  delutan: 'Délután (12–17)',
};
/** Where the request was made. 'regi_idopont' = converted legacy booking (SPEC §26.2.9). */
export const CALLBACK_SOURCES = [
  'bekotes',
  'adatok',
  'vallalkozas_adatlap',
  'vallalkozas_utmutato',
  'meghatalmazas_utmutato',
  'azonositas',
  'elofizetes',
  'uzenetek',
  'fiok',
  'gyik',
  'konyvelo_kartya',
  'zarolt_funkcio',
  'csapat',
  'regi_idopont',
  // SPEC §27: the "Intézzük helyetted" cards, and a path change that needs a call
  'helyettunk_vallalkozas',
  'helyettunk_meghatalmazas',
  'utvaltas',
] as const;
export type CallbackSource = (typeof CALLBACK_SOURCES)[number];
export const CALLBACK_ATTEMPT_OUTCOMES = ['beszeltunk', 'nem_vette_fel', 'foglalt', 'hibas_szam', 'kesobb_kerte'] as const;
export type CallbackAttemptOutcome = (typeof CALLBACK_ATTEMPT_OUTCOMES)[number];
export const CALLBACK_ATTEMPT_OUTCOME_LABELS: Record<CallbackAttemptOutcome, string> = {
  beszeltunk: 'Beszéltünk',
  nem_vette_fel: 'Nem vette fel',
  foglalt: 'Foglalt volt',
  hibas_szam: 'Hibás a szám',
  kesobb_kerte: 'Később kérte',
};
/** Outcomes that count toward CALLBACK_RULES.maxFailedAttempts. */
export const CALLBACK_FAILED_OUTCOMES: readonly CallbackAttemptOutcome[] = ['nem_vette_fel', 'foglalt'];
export const CALLBACK_CLOSE_REASONS = ['megoldva_uzenetben', 'duplikalt', 'ugyfel_kerte', 'egyeb'] as const;
export type CallbackCloseReason = (typeof CALLBACK_CLOSE_REASONS)[number];
export const CALLBACK_CLOSE_REASON_LABELS: Record<CallbackCloseReason, string> = {
  megoldva_uzenetben: 'Üzenetben megoldottuk',
  duplikalt: 'Dupla kérés',
  ugyfel_kerte: 'Az ügyfél kérte',
  egyeb: 'Egyéb',
};
/** SLA and limits (SPEC §26.2.3). Calendar hours; dueHours = env CALLBACK_DUE_HOURS (default 48). */
export const CALLBACK_RULES = {
  dueHours: 48,
  targetHours: 24,
  maxFailedAttempts: 3,
  minMinutesBetweenAttempts: 120,
  callingNowMinutes: 15,
  noteMaxChars: 500,
  attemptNoteMaxChars: 500,
  internalNoteMaxChars: 2000,
  summaryMaxChars: 1000,
  createPerClientPerDay: 3,
  csapatClientCardDays: 90,
} as const;

// ---------- §26.5 restricted mode before activation (lifecycle 'bekotes_alatt') ----------
export const ACCESS_MODES = ['korlatozott', 'teljes'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];
/** 'nyitva' usable · 'zarva' locked until lifecycle 'aktiv' · 'keresre' only inside an open accountant request. */
export const FEATURE_STATES = ['nyitva', 'zarva', 'keresre'] as const;
export type FeatureState = (typeof FEATURE_STATES)[number];
export const CLIENT_FEATURES = [
  'bekotes',
  'vallalkozas_inditas',
  'helyettunk',
  'uzenetek',
  'visszahivas',
  'fiok',
  'elofizetes',
  'dijszamlak',
  'ertesitesek',
  'gyik_jogi',
  'adataim',
  'ajanlas',
  'keres_valasz',
  'kerdes',
  'fooldal_ado',
  'dosszie',
  'feltoltes',
  'nav_szamlak',
  'bevetel',
  'hataridok',
  'igazolas_keres',
] as const;
export type ClientFeature = (typeof CLIENT_FEATURES)[number];
/**
 * SPEC §26.5.2 – what a client may use before activation. `reason` is the default of content text
 * `korlatozott.<feature>` ({firstName} = accountant's first name); the server sends the filled text in ClientAccess
 * and as the message of the 403 'locked_until_active' error. After activation every feature is 'nyitva'.
 */
export const CLIENT_FEATURE_RULES: Record<ClientFeature, { beforeActivation: FeatureState; label: string; reason: string | null }> = {
  bekotes: { beforeActivation: 'nyitva', label: 'Bekötés', reason: null },
  vallalkozas_inditas: { beforeActivation: 'nyitva', label: 'Vállalkozás bejelentése', reason: null },
  helyettunk: { beforeActivation: 'nyitva', label: 'Intézzük helyetted', reason: null },
  uzenetek: { beforeActivation: 'nyitva', label: 'Üzenetek', reason: null },
  visszahivas: { beforeActivation: 'nyitva', label: 'Visszahívás kérése', reason: null },
  fiok: { beforeActivation: 'nyitva', label: 'Fiók, jelszó, kétlépcsős belépés, kijelentkezés', reason: null },
  elofizetes: { beforeActivation: 'nyitva', label: 'Előfizetés, kártya törlése, lemondás', reason: null },
  dijszamlak: { beforeActivation: 'nyitva', label: 'Díjszámlák', reason: null },
  ertesitesek: { beforeActivation: 'nyitva', label: 'Értesítések', reason: null },
  gyik_jogi: { beforeActivation: 'nyitva', label: 'GYIK, jogi dokumentumok', reason: null },
  adataim: { beforeActivation: 'nyitva', label: 'Adataim letöltése, fiók törlése', reason: null },
  ajanlas: { beforeActivation: 'nyitva', label: 'Ajánld ismerősnek', reason: null },
  keres_valasz: { beforeActivation: 'nyitva', label: 'Válasz a könyvelőd kéréseire', reason: null },
  kerdes: { beforeActivation: 'nyitva', label: 'Kérdés küldése', reason: null },
  fooldal_ado: {
    beforeActivation: 'zarva',
    label: 'Befizetendő adó, „Hogyan jött ki?”, „Már befizettem”',
    reason: 'A bekötés után nyílik meg. Akkor számolja ki {firstName}, mennyit és mikorra kell befizetned.',
  },
  dosszie: {
    beforeActivation: 'zarva',
    label: 'Dosszié',
    reason: 'A bekötés után nyílik meg. Akkor itt látod a kiállított számláidat és az irataidat.',
  },
  feltoltes: {
    beforeActivation: 'keresre',
    label: 'Fotózás, feltöltés',
    reason: 'A bekötés után nyílik meg. Ha {firstName} kér tőled valamit, azt már most is feltöltheted a kérésnél.',
  },
  nav_szamlak: {
    beforeActivation: 'zarva',
    label: 'Kiállított számlák',
    reason: 'A bekötés után nyílik meg. A meghatalmazás után {firstName} beköti, és a kiállított számláid maguktól megjelennek itt.',
  },
  bevetel: {
    beforeActivation: 'zarva',
    label: 'Idei bevétel, keretek',
    reason: 'A bekötés után nyílik meg. Akkor mutatjuk, mennyi a bevételed, és hol tartasz a keretekben.',
  },
  hataridok: {
    beforeActivation: 'zarva',
    label: 'Határidők',
    reason: 'A bekötés után nyílik meg. Akkor ide kerülnek a befizetési és bevallási határidőid.',
  },
  igazolas_keres: {
    beforeActivation: 'zarva',
    label: 'Igazolás kérése, adat- vagy tevékenységváltozás',
    reason: 'A bekötés után nyílik meg. Igazolást {firstName} a NAV-meghatalmazás után kérhet neked.',
  },
};
/** Request types a client may create before activation (others → 403 'locked_until_active', feature 'igazolas_keres'). */
export const REQUEST_TYPES_BEFORE_ACTIVATION: readonly RequestType[] = ['kerdes'];
/** Error code of every refused call in restricted mode (HTTP 403; ApiError.error.feature is set). */
export const LOCKED_ERROR_CODE = 'locked_until_active';
/** Error code when an onboarding step is not open yet on the client's path (HTTP 409; SPEC §26.1.6). */
export const STEP_LOCKED_ERROR_CODE = 'step_locked';
/** Error code of the retired appointment endpoints (HTTP 410; SPEC §26.2.9). */
export const RETIRED_ERROR_CODE = 'megszunt_funkcio';

// =====================================================================================================================
// SPEC §27 – owner orders of 2026-11-19: real NAV screenshots, a changeable branch, "Intézzük helyetted" (assisted
// path: callback first, then our accountant acts as the client's registered meghatalmazott; we NEVER ask for or use the
// client's Ügyfélkapu+/DÁP login), one transparent journey ("Így halad a bekötésed"), "anyukád", one wording for the
// client's issued invoices. New states are text columns + CHECK; enum ADD VALUE only in their own migration (0010).
// =====================================================================================================================

// ---------- §27.2 changeable branch ("Van már egyéni vállalkozásod?") ----------
/** HTTP 409: the path cannot be changed in the app any more; the app offers a callback (source 'utvaltas'). */
export const PATH_CHANGE_ERROR_CODE = 'path_change_needs_callback';
/** HTTP 409: a write that only fits one path arrived while the branch question is unanswered (never set a path silently). */
export const PATH_REQUIRED_ERROR_CODE = 'path_required';
/** Why a change is not possible in the app (PathChangeInfo.blocker). Order = order of the checks. */
export const PATH_CHANGE_BLOCKERS = ['nem_bekotes_alatt', 'bejelentes_bekuldve', 'bejelentes_engedelyezve', 'adoszam_megadva'] as const;
export type PathChangeBlocker = (typeof PATH_CHANGE_BLOCKERS)[number];
/** Client wording of the blocker (content `bekotes.ut.zarolt.<blocker>`); shown in the change sheet with "Kérj visszahívást". */
export const PATH_CHANGE_BLOCKER_TEXT: Record<PathChangeBlocker, string> = {
  nem_bekotes_alatt: 'A bekötésed már kész, ezért itt nem tudod módosítani.',
  bejelentes_bekuldve: 'A vállalkozásod bejelentése már elment a NAV-hoz.',
  bejelentes_engedelyezve: 'Már engedélyezted, hogy bejelentsük a vállalkozásodat.',
  adoszam_megadva: 'Már megadtad az adószámodat.',
};

// ---------- §27.3 "Intézzük helyetted" (assisted path) ----------
/** business_registrations.mode: who files the EV bejelentés. Default 'onallo' (self-service stays the default). */
export const REGISTRATION_MODES = ['onallo', 'segitett'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];
export const REGISTRATION_MODE_LABELS: Record<RegistrationMode, string> = {
  onallo: 'Magam jelentem be',
  segitett: 'Intézzétek helyettem',
};
/** What we do for the client. 'vallalkozas_bejelentes' includes the meghatalmazás (one UJEGYKE with both groups). */
export const ASSIST_KINDS = ['vallalkozas_bejelentes', 'meghatalmazas'] as const;
export type AssistKind = (typeof ASSIST_KINDS)[number];
export const ASSIST_KIND_LABELS: Record<AssistKind, string> = {
  vallalkozas_bejelentes: 'Vállalkozás bejelentése',
  meghatalmazas: 'NAV-meghatalmazás',
};
/** The callback topic each kind uses (CALLBACK_TOPICS). */
export const ASSIST_CALLBACK_TOPIC: Record<AssistKind, CallbackTopic> = {
  vallalkozas_bejelentes: 'vallalkozas_bejelentes_helyettem',
  meghatalmazas: 'meghatalmazas_helyettem',
};
/**
 * assist_requests.status (SPEC §27.3.4). Kind 'meghatalmazas' skips 'meghatalmazas_el', 'ugyfel_engedelyezte' and
 * 'bejelentes_bekuldve' (verified → 'kesz').
 */
export const ASSIST_STATUSES = [
  'visszahivas_kerve',
  'egyeztetve',
  'meghatalmazas_bekuldve',
  'meghatalmazas_lejart',
  'meghatalmazas_jovahagyva',
  'meghatalmazas_el',
  'ugyfel_engedelyezte',
  'bejelentes_bekuldve',
  'kesz',
  'visszavonva',
  'lezarva',
] as const;
export type AssistStatus = (typeof ASSIST_STATUSES)[number];
export const ASSIST_OPEN_STATUSES: readonly AssistStatus[] = [
  'visszahivas_kerve',
  'egyeztetve',
  'meghatalmazas_bekuldve',
  'meghatalmazas_lejart',
  'meghatalmazas_jovahagyva',
  'meghatalmazas_el',
  'ugyfel_engedelyezte',
  'bejelentes_bekuldve',
];
/** The client may cancel ("Mégis magam csinálom") only before anything is filed for the EV. */
export const ASSIST_CANCELLABLE_STATUSES: readonly AssistStatus[] = [
  'visszahivas_kerve',
  'egyeztetve',
  'meghatalmazas_bekuldve',
  'meghatalmazas_lejart',
  'meghatalmazas_jovahagyva',
  'meghatalmazas_el',
  'ugyfel_engedelyezte',
];
/** Panel wording (queue column "Állapot"). */
export const ASSIST_STATUS_LABELS: Record<AssistStatus, string> = {
  visszahivas_kerve: 'Hívásra vár',
  egyeztetve: 'Egyeztetve – UJEGYKE beküldésére vár',
  meghatalmazas_bekuldve: 'Ügyfél jóváhagyására vár',
  meghatalmazas_lejart: 'Lejárt a 4 nap – újra kell küldeni',
  meghatalmazas_jovahagyva: 'Jóváhagyta – ellenőrizni kell a NAV-nál',
  meghatalmazas_el: 'Meghatalmazás él – ügyfél engedélyére vár',
  ugyfel_engedelyezte: 'Engedélyezte – beküldhető',
  bejelentes_bekuldve: 'Beküldve – ellenőrzés, adószám',
  kesz: 'Kész',
  visszavonva: 'Az ügyfél visszavonta',
  lezarva: 'Lezárva',
};
/** Who has the ball (panel "Kinél a labda", client actor chip). null = finished. */
export const ASSIST_BALL: Record<AssistStatus, 'csapat' | 'konyvelo' | 'ugyfel' | null> = {
  visszahivas_kerve: 'csapat',
  egyeztetve: 'konyvelo',
  meghatalmazas_bekuldve: 'ugyfel',
  meghatalmazas_lejart: 'konyvelo',
  meghatalmazas_jovahagyva: 'konyvelo',
  meghatalmazas_el: 'ugyfel',
  ugyfel_engedelyezte: 'konyvelo',
  bejelentes_bekuldve: 'csapat',
  kesz: null,
  visszavonva: null,
  lezarva: null,
};
/** Actions of the assist state machine (SPEC §27.3.4); the API endpoint names follow these keys. */
export const ASSIST_ACTIONS = [
  'letrehozas',
  'egyeztetve',
  'ujegyke_bekuldve',
  'ugyfel_jovahagyta',
  'lejart',
  'meghatalmazas_el',
  'engedely',
  'engedely_torolve',
  'bejelentes_bekuldve',
  'kesz',
  'visszavonas',
  'lezaras',
] as const;
export type AssistAction = (typeof ASSIST_ACTIONS)[number];
/** Who may trigger an action. 'konyvelo' = only the client's own accountant; 'rendszer' = worker/backend. */
export const ASSIST_ACTION_ROLES: Record<AssistAction, readonly ('ugyfel' | 'csapat' | 'konyvelo' | 'admin' | 'rendszer')[]> = {
  letrehozas: ['ugyfel', 'csapat', 'konyvelo', 'admin'],
  egyeztetve: ['csapat', 'konyvelo', 'admin'],
  // 11-19 javító kör 2: the NAV filings only by the client's OWN accountant (the registered meghatalmazott); an admin
  // counts as 'konyvelo' only when he is that accountant (services/assist.ts assistForStaff).
  ujegyke_bekuldve: ['konyvelo'],
  ugyfel_jovahagyta: ['ugyfel'],
  lejart: ['rendszer', 'csapat', 'konyvelo', 'admin'],
  meghatalmazas_el: ['konyvelo'],
  engedely: ['ugyfel'],
  engedely_torolve: ['rendszer'],
  bejelentes_bekuldve: ['konyvelo'],
  kesz: ['rendszer'],
  visszavonas: ['ugyfel'],
  lezaras: ['csapat', 'konyvelo', 'admin'],
};
export const ASSIST_CLOSE_REASONS = ['nincs_belepese', 'magam_intezem', 'nem_ertuk_el', 'utvaltas', 'duplikalt', 'egyeb'] as const;
export type AssistCloseReason = (typeof ASSIST_CLOSE_REASONS)[number];
export const ASSIST_CLOSE_REASON_LABELS: Record<AssistCloseReason, string> = {
  nincs_belepese: 'Nincs Ügyfélkapu+-a vagy DÁP-ja (más utat javasoltunk)',
  magam_intezem: 'Mégis maga intézi',
  nem_ertuk_el: 'Nem értük el',
  utvaltas: 'Útvonalat váltott (már van vállalkozása)',
  duplikalt: 'Dupla kérés',
  egyeb: 'Egyéb',
};
/** Panel check lists per phase. Every item of a phase must be ticked before the phase's action (400 otherwise). */
export const ASSIST_CHECK_ITEMS = {
  hivas: ['nincs_elo_ev', 'afa_mentes_kor', 'belepes_van', 'telefon_jo', 'lepesek_elmondva', 'jelszo_figyelmeztetes'],
  ujegyke: ['sajat_profil', 'kepviselt_adatai', 'jogcim', 'ugycsoport_ado', 'ugycsoport_ev', 'kezdete_ma', 'sikeres_benyujtas'],
  bejelentes: ['kepviseletvalaszto', 'adatok_egyeznek', 'ellenorzes_lap', 'nyilatkozatok_ugyfeltol', 'sikeres_bejelentes', 'ertesites_letoltve'],
} as const;
export type AssistCheckPhase = keyof typeof ASSIST_CHECK_ITEMS;
export type AssistCheckItem = (typeof ASSIST_CHECK_ITEMS)[AssistCheckPhase][number];
/** Phases per kind (kind 'meghatalmazas' has no 'bejelentes' phase). */
export const ASSIST_PHASES: Record<AssistKind, readonly AssistCheckPhase[]> = {
  vallalkozas_bejelentes: ['hivas', 'ujegyke', 'bejelentes'],
  meghatalmazas: ['hivas', 'ujegyke'],
};
/** Items that are NOT required (and not shown) for kind 'meghatalmazas' (the client already has / does not start an EV). */
export const ASSIST_CHECK_NOT_FOR_MH: readonly AssistCheckItem[] = ['nincs_elo_ev', 'afa_mentes_kor', 'ugycsoport_ev'];
export const ASSIST_CHECK_LABELS: Record<AssistCheckItem, string> = {
  nincs_elo_ev: 'Nincs élő egyéni vállalkozása',
  afa_mentes_kor: 'Évi 20 millió forint alatt marad (ÁFA-mentes)',
  belepes_van: 'Van Ügyfélkapu+-a vagy DÁP-ja (a jóváhagyáshoz kell)',
  telefon_jo: 'A telefonszám jó',
  lepesek_elmondva: 'Elmondtuk a lépéseket és a 4 napos jóváhagyást',
  jelszo_figyelmeztetes: 'Elmondtuk: jelszót, kódot soha nem kérünk, és nem lépünk be helyette',
  sajat_profil: 'A saját ONYA-profilodból, a saját belépéseddel',
  kepviselt_adatai: 'Képviselt: név és adóazonosító jel pontosan a NAV szerint',
  jogcim: 'A képviselet jogcíme a beállított kód',
  ugycsoport_ado: 'ADÓÜGYEK (kivéve egyes jövedéki ügyek) bejelölve',
  ugycsoport_ev: 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek bejelölve (csak vállalkozás bejelentésénél)',
  kezdete_ma: 'Kezdete: a mai nap, vége: üres',
  sikeres_benyujtas: '„Sikeres benyújtás” – a csempe: „Jóváhagyásra vár”',
  kepviseletvalaszto: 'Képviseletválasztó: „Más ügyében járok el”, az ügyfél kiválasztva',
  adatok_egyeznek: 'Minden adat egyezik az ügyfél engedélyezett adataival',
  ellenorzes_lap: 'Az Ellenőrzés lapot végignézted',
  nyilatkozatok_ugyfeltol: 'A nyilatkozatokat (kizáró okok) az ügyfél tette meg az appban',
  sikeres_bejelentes: '„Bejelentés megtétele” → „Figyelem!” → „Sikeres bejelentés”',
  ertesites_letoltve: 'Az értesítés PDF-je letöltve, itt feltöltöd',
};
/** UJEGYKE jogcím codes our accountant may use for a natural-person client (env ASSIST_UJEGYKE_JOGCIM) [KÖNYVELŐ/JOGI]. */
export const ASSIST_JOGCIMEK = ['9', '60'] as const;
export type AssistJogcim = (typeof ASSIST_JOGCIMEK)[number];
export const ASSIST_JOGCIM_LABELS: Record<AssistJogcim, string> = {
  '9': '9 – könyvelő',
  '60': '60 – természetes személy állandó meghatalmazottja',
};
/** Rules of the assisted path (SPEC §27.3.5). NAV: approve within 4 CALENDAR days; we show one day earlier. */
export const ASSIST_RULES = {
  /** NAV deletes an unapproved UJEGYKE after this many calendar days (UJEGYKE GYIK q.4). */
  navApprovalDays: 4,
  /** The client sees "{hatarido}" (e.g. "november 22-ig") = Budapest date of filing + this many days (one day of margin). */
  shownApprovalDays: 3,
  /** First reminder this many hours after filing if not approved. */
  reminderAfterHours: 24,
  /** Last-day reminder at this Budapest hour on the shown due date. */
  lastDayReminderHour: 9,
  /** Staff alert at this Budapest hour on the shown due date if the client has not approved. */
  staffAlertHour: 12,
  /** Auto-expire this many hours after the NAV deadline (filed + 4 days) when nobody confirmed approval. */
  expireGraceHours: 2,
  /** Target for our accountant to file the UJEGYKE / the EV bejelentés after the previous step, in working days. */
  staffActionWorkdays: 1,
  /** Push only between these Budapest hours (in-app + e-mail any time). */
  pushFromHour: 8,
  pushToHour: 20,
} as const;
/** Server kill switch for the EV part (env ASSIST_EV_ENABLED, default true) – [JOGI] Üttv./Btk. 286. § question. */
export const ASSIST_EV_ENABLED_DEFAULT = true;
/** Last day the EV part is offered (env ASSIST_EV_VALID_UNTIL): from 2027-01-01 the chamber keeps the EV register. */
export const ASSIST_EV_VALID_UNTIL_DEFAULT = '2026-12-31';
/** Default UJEGYKE jogcím of our accountant (env ASSIST_UJEGYKE_JOGCIM) [KÖNYVELŐ/JOGI]. */
export const ASSIST_UJEGYKE_JOGCIM_DEFAULT = '9';
/** HTTP 409 codes of the assist endpoints. */
export const ASSIST_ERROR_CODES = ['assist_already_open', 'assist_wrong_status', 'assist_checklist_incomplete', 'assist_consent_stale', 'assist_disabled'] as const;
export type AssistErrorCode = (typeof ASSIST_ERROR_CODES)[number];

// ---------- §27.4 one transparent journey ("Így halad a bekötésed") ----------
/** One canonical row per thing the client meets during onboarding. Titles: JOURNEY_STEP_TEXTS (bekotes.ts). */
export const JOURNEY_STEP_KEYS = [
  'ut',
  'visszahivas',
  'adatok',
  'kerdoiv',
  'bejelentes',
  'ertesites',
  'atnezes',
  'vegso_jovahagyas',
  'kamara',
  'szerzodes',
  'meghatalmazas',
  'azonositas',
  'elofizetes',
  'nav_bekotes',
] as const;
export type JourneyStepKey = (typeof JOURNEY_STEP_KEYS)[number];
/** Who acts on a row right now: the client, his accountant, our team, or the NAV. */
export const JOURNEY_ACTORS = ['te', 'konyvelo', 'csapat', 'nav'] as const;
export type JourneyActor = (typeof JOURNEY_ACTORS)[number];
/** Actor chip text; '{firstName}' = the accountant's first name. */
export const JOURNEY_ACTOR_LABELS: Record<JourneyActor, string> = {
  te: 'Te',
  konyvelo: '{firstName}',
  csapat: 'Csapatunk',
  nav: 'NAV',
};
/**
 * kesz = done · most = THE one current client action (exactly one row, or none while others work) · nyitva = the client
 * may already do it · var = someone else works on it (actor ≠ te) · kesobb = not yet (lockedReason says why) ·
 * kihagyva = not needed on this path.
 */
export const JOURNEY_ROW_STATES = ['kesz', 'most', 'nyitva', 'var', 'kesobb', 'kihagyva'] as const;
export type JourneyRowState = (typeof JOURNEY_ROW_STATES)[number];
/** 'nincs' = branch question unanswered. */
export const JOURNEY_VARIANTS = ['nincs', 'van', 'inditas_onallo', 'inditas_segitett'] as const;
export type JourneyVariant = (typeof JOURNEY_VARIANTS)[number];
/** Row order per variant. The numbers the client sees are 1…n in this order. */
export const JOURNEY_ORDER: Record<JourneyVariant, readonly JourneyStepKey[]> = {
  nincs: ['ut'],
  van: ['ut', 'adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'],
  inditas_onallo: ['ut', 'adatok', 'kerdoiv', 'bejelentes', 'ertesites', 'atnezes', 'kamara', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'],
  inditas_segitett: ['ut', 'visszahivas', 'adatok', 'kerdoiv', 'szerzodes', 'meghatalmazas', 'vegso_jovahagyas', 'bejelentes', 'kamara', 'azonositas', 'elofizetes', 'nav_bekotes'],
};
/** Greyed preview under the unanswered branch question ("Utána ezek jönnek"). */
export const JOURNEY_PREVIEW: readonly JourneyStepKey[] = ['adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'];
/** Rows that never block activation even when open (the client still sees and counts them). */
export const JOURNEY_NOT_REQUIRED_FOR_ACTIVATION: readonly JourneyStepKey[] = ['kamara'];
/** Content key of the new step lock: Előfizetés waits for the Szerződés on both paths (k3_kor2 finding, SPEC §27.4). */
export const LOCK_ELOFIZETES_SZERZODES_UTAN = 'bekotes.zarolt.elofizetes_szerzodes_utan';
