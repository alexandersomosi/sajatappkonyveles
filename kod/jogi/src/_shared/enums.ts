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
  // SPEC §32.B (DB: 0024_ev_ciklus_enumok.sql): the NAV folyószámla (adószámla) extract of a reconciliation; default
  // visibility csak_konyvelo.
  'adoszamla_kivonat',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_VISIBILITIES = ['kozos', 'csak_konyvelo'] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

// SPEC §32: + 'kata' (one row per KATA month, key 'YYYY-MM-KATA'; tax_periods.kind is text, no DB enum).
// SPEC §32.B (éves ciklus, F2/F3): + the payments that follow a filed yearly return or an önellenőrzés – 'eves_szja'
// ('YYYY-SZJA', the szja difference), 'kata_eves' ('YYYY-KATA', the 40 % különadó), 'hipa_eves' ('YYYY-HIPA', the HIPA
// difference), 'onellenorzes' ('ONELL-<id>'). They are made only by the accountant's "Beadtam" and are always approved.
export const TAX_PERIOD_KINDS = ['negyedev', 'hipa', 'kata', 'eves_szja', 'kata_eves', 'hipa_eves', 'onellenorzes'] as const;
export type TaxPeriodKind = (typeof TAX_PERIOD_KINDS)[number];

export const CALC_STATUSES = ['nincs', 'becsles', 'jovahagyva'] as const;
export type CalcStatus = (typeof CALC_STATUSES)[number];

export const PAYMENT_STATUSES = ['nincs_fizetendo', 'fizetendo', 'befizetve_jelezve', 'ellenorizve', 'elteres'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FILING_STATUSES = ['nincs', 'beadva'] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

// SPEC §28.K.11: + the KATA monthly tax (adónem 288) and the 40 % különadó above the keret.
// SPEC §32.B (DB: ADD VALUE in 0024_ev_ciklus_enumok.sql, this order): the yearly szja difference, the önellenőrzési pótlék
// (NAV 215) and any other tax line of an önellenőrzés.
export const PAYMENT_ITEM_KINDS = ['tb_jarulek', 'szocho', 'szja_eloleg', 'hipa_eloleg', 'hipa_kulonbozet', 'kata_teteles', 'kata_kulonado', 'szja_kulonbozet', 'onellenorzesi_potlek', 'egyeb_ado'] as const;
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

// SPEC §28.K: 'zarolva' = service lock (§28.K.5), 'kata_figyelem' = a KATA client invoiced a business (§28.K.11).
// SPEC §32.B: + the last NAV folyószámla check shows a backlog / difference not settled yet, and an open önellenőrzés
// (jsonb clients.next_flags – no migration).
export const CLIENT_FLAGS = ['bekotes_alatt', 'rendben', 'hianyzik_valami', 'hatar_kozel', 'dij_elmaradt', 'zarolva', 'kata_figyelem', 'folyoszamla_elteres', 'onellenorzes_nyitott'] as const;
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
  // SPEC §29.1.3 (DB: ADD VALUE in 0017_k29_enumok.sql): the card consent of the Stripe flow.
  'kartyas_fizetes',
  // SPEC §31.7 (DB: ADD VALUE in 0020_marketing_enumok.sql): the cookie notice (jogi/suti.md); information only, nobody accepts it.
  'suti',
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
  // SPEC §28.8 (DB: ADD VALUE in 0014_ot1119_enumok.sql, this order)
  'invoice_new',
  'allowance_submitted',
  'allowance_decided',
  'allowance_check',
  'assist_change_done',
  // SPEC §28.K.17 – client (same migration file, this order)
  'checkin_due',
  'fee_due',
  'annual_due',
  'annual_status',
  'service_locked',
  'service_unlocked',
  'nudge',
  'upload_reminder',
  'kata_business_invoice',
  'mailbox_received',
  'mailbox_rejected',
  'employer_decided',
  'subscription_paused',
  // SPEC §28.K.17 – staff
  'checkin_change',
  'annual_submitted',
  'client_locked',
  'employer_reported',
  'onboarding_task',
  // SPEC §29.13 (DB: ADD VALUE in 0017_k29_enumok.sql, this order)
  'charge_upcoming',
  'payment_action_needed',
  'payment_refunded',
  'payment_disputed',
  'invoice_failed',
  'certificate_requested',
  'certificate_status',
  'income_statement_checked',
  'income_statement_review',
  'contract_terminated',
  'contract_reactivated',
  'price_changed',
  'profile_changed_by_admin',
  'announcement',
  'guided_continue',
  // SPEC §32 (DB: ADD VALUE in 0022_kata_enumok.sql): the accountant's tax tasks (KATA year end, free-month notice, backfill, 2027 amount)
  'tax_task',
  // SPEC §32.B (DB: ADD VALUE in 0024_ev_ciklus_enumok.sql): the client's önellenőrzés steps (approve, filed, settled)
  'correction_status',
  // k8 ALAP-B (DB: ADD VALUE in 0027_k8_enumok.sql, this order): bank transfer – the díjbekérő is out, a late reminder
  'transfer_request',
  'transfer_reminder',
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
  adoszamla_kivonat: 'irat',
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
  beadva: 'Megkaptuk a NAV-os értesítést. Átnézzük, és szólunk.',
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
// SPEC §28.K.13: + 'rovid_munkaviszony_mellett' = NAV [3] "Heti 36 órát el nem érő munkaviszony mellett" (tax: főfoglalkozású).
export const WORK_KINDS = ['fofoglalkozas', 'munkaviszony_mellett', 'rovid_munkaviszony_mellett', 'tanulmany_mellett', 'nyugdij_mellett'] as const;
export type WorkKind = (typeof WORK_KINDS)[number];
export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  fofoglalkozas: 'Ez lesz a fő munkám',
  munkaviszony_mellett: 'Mellette legalább heti 36 órás munkaviszonyom van',
  rovid_munkaviszony_mellett: 'Mellette heti 36 óránál rövidebb munkaviszonyom van',
  tanulmany_mellett: 'Mellette nappali tagozaton tanulok',
  nyugdij_mellett: 'Saját jogú nyugdíjas vagyok',
};
export const WORK_KIND_TAX_STATUS: Record<WorkKind, TaxStatus> = {
  fofoglalkozas: 'fofoglalkozasu',
  munkaviszony_mellett: 'mellekallasu',
  rovid_munkaviszony_mellett: 'fofoglalkozasu',
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
/** SPEC §29.4.2 (owner 11-20 "paid from day one"): no free period – the card step opens right after the contract. */
export const NEW_BUSINESS_CHARGE_POLICY_DEFAULT: NewBusinessChargePolicy = 'azonnal';
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
// SPEC §28.5 + §28.K.6: the six change guides ("Változás-útmutatók") are guide kinds too (no video).
export const GUIDE_KINDS = [
  'vallalkozas_bejelentes',
  'meghatalmazas',
  'meghatalmazas_jovahagyas',
  'valtozas_szekhely',
  'valtozas_tevekenyseg',
  'valtozas_telephely',
  'valtozas_szuneteltetes',
  'valtozas_adoadat',
  'valtozas_folytatas',
] as const;
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
  // SPEC §28.5.3 (step lists) + §28.K.6 (valtozas_folytatas)
  valtozas_szekhely: [
    'belepes',
    'ugyseged_fooldal',
    'valtozas_inditas',
    'valtozas_szemelyi',
    'valtozas_cimadatok',
    'valtozas_uj_szekhely',
    'valtozas_szekhely_mentes',
    'valtozas_tevekenysegek',
    'valtozas_ellenorzes',
    'valtozas_megtekintes',
    'app_feltoltes',
  ],
  valtozas_tevekenyseg: [
    'belepes',
    'ugyseged_fooldal',
    'valtozas_inditas',
    'valtozas_szemelyi',
    'valtozas_cimadatok',
    'valtozas_tevekenysegek',
    'valtozas_ovtj_kereso',
    'valtozas_ellenorzes',
    'valtozas_megtekintes',
    'app_feltoltes',
  ],
  valtozas_telephely: [
    'belepes',
    'ugyseged_fooldal',
    'valtozas_inditas',
    'valtozas_szemelyi',
    'valtozas_cimadatok',
    'valtozas_uj_telephely',
    'valtozas_tevekenysegek',
    'valtozas_ellenorzes',
    'valtozas_megtekintes',
    'app_feltoltes',
  ],
  valtozas_szuneteltetes: ['belepes', 'ugyseged_fooldal', 'szunetel_inditas', 'szunetel_datum', 'szunetel_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
  valtozas_adoadat: ['onya_belepes', 'onya_profil', 't101e_kereses', 't101e_blokk', 't101e_bekuldes', 'app_feltoltes'],
  valtozas_folytatas: ['belepes', 'ugyseged_fooldal', 'folytatas_inditas', 'folytatas_datum', 'folytatas_ellenorzes', 'valtozas_megtekintes', 'app_feltoltes'],
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
  valtozas_szekhely: null,
  valtozas_tevekenyseg: null,
  valtozas_telephely: null,
  valtozas_szuneteltetes: null,
  valtozas_adoadat: null,
  valtozas_folytatas: null,
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
  // SPEC §28.5.5 (change guides / assisted changes) and §28.K (annual closing, tax regime incl. KATA)
  'valtozas',
  'valtozas_helyettem',
  'eves_zaras',
  'adozasi_mod',
  // SPEC §29.7 F3: "Előbb beszéljük meg" on the closing choice (DB: callback_requests_topic_chk widened in 0018_k29.sql)
  'megszuntetes',
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
  valtozas: 'Változás a vállalkozásomban',
  valtozas_helyettem: 'Intézzétek helyettem: változás bejelentése',
  eves_zaras: 'Éves zárás, bevallás',
  adozasi_mod: 'Adózási mód (átalány vagy kata)',
  megszuntetes: 'A vállalkozás megszüntetése',
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
  // SPEC §28
  'valtozas_utmutato',
  'helyettunk_valtozas',
  'kedvezmenyek',
  'felretesz',
  'kereset',
  // SPEC §28.K
  'havi_ellenorzes',
  'eves_zaras',
  'kalkulator',
  'zarolas',
  'alkalmazott',
  'adoszam_kereso',
  'kata',
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
  // SPEC §28.6.3
  'felretesz',
  'kereset',
  'kedvezmenyek',
  'valtozas',
  // SPEC §28.K
  'havi_ellenorzes',
  'eves_zaras',
  'dijak',
  'tovabbito_email',
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
  // SPEC §28.6.3
  felretesz: {
    beforeActivation: 'zarva',
    label: 'Ennyit tegyél félre',
    reason: 'A bekötés után nyílik meg. Akkor minden számládnál látod, mennyit tegyél félre.',
  },
  kereset: {
    beforeActivation: 'zarva',
    label: 'Mennyit kerestem?',
    reason: 'A bekötés után nyílik meg. Akkor látod, mennyi marad a bevételedből az adók után.',
  },
  kedvezmenyek: { beforeActivation: 'nyitva', label: 'Adókedvezményeid', reason: null },
  valtozas: { beforeActivation: 'nyitva', label: 'Változás a vállalkozásodban', reason: null },
  // SPEC §28.K
  havi_ellenorzes: {
    beforeActivation: 'zarva',
    label: 'Havi ellenőrzés („Változott valami?”)',
    reason: 'A bekötés után nyílik meg. Akkor havonta egyszer rákérdezünk, változott-e valami.',
  },
  eves_zaras: {
    beforeActivation: 'zarva',
    label: 'Éves zárás',
    reason: 'A bekötés után nyílik meg. Az év végén itt készítjük elő az éves bevallásodat.',
  },
  dijak: { beforeActivation: 'nyitva', label: 'Díjak és fizetés', reason: null },
  tovabbito_email: {
    beforeActivation: 'zarva',
    label: 'Továbbító e-mail-cím',
    reason: 'A bekötés után kapsz egy saját címet, ahová a nyugtáidat és a kivonataidat továbbíthatod.',
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
// SPEC §28.5.5 + §28.K.6: the six change kinds (CHANGE_KINDS) are assist kinds too.
export const ASSIST_KINDS = [
  'vallalkozas_bejelentes',
  'meghatalmazas',
  'valtozas_szekhely',
  'valtozas_tevekenyseg',
  'valtozas_telephely',
  'valtozas_szuneteltetes',
  'valtozas_adoadat',
  'valtozas_folytatas',
  // SPEC §29.7 F3 (DB: assist_requests_kind_chk widened in 0018_k29.sql)
  'valtozas_megszuntetes',
] as const;
export type AssistKind = (typeof ASSIST_KINDS)[number];
export const ASSIST_KIND_LABELS: Record<AssistKind, string> = {
  vallalkozas_bejelentes: 'Vállalkozás bejelentése',
  meghatalmazas: 'NAV-meghatalmazás',
  valtozas_szekhely: 'Székhelyváltozás',
  valtozas_tevekenyseg: 'Tevékenységváltozás',
  valtozas_telephely: 'Új telephely',
  valtozas_szuneteltetes: 'Szüneteltetés',
  valtozas_adoadat: 'Adózási adat változása',
  valtozas_folytatas: 'Szüneteltetés befejezése',
  valtozas_megszuntetes: 'A vállalkozás megszüntetése',
};
/** The callback topic each kind uses (CALLBACK_TOPICS). */
export const ASSIST_CALLBACK_TOPIC: Record<AssistKind, CallbackTopic> = {
  vallalkozas_bejelentes: 'vallalkozas_bejelentes_helyettem',
  meghatalmazas: 'meghatalmazas_helyettem',
  valtozas_szekhely: 'valtozas_helyettem',
  valtozas_tevekenyseg: 'valtozas_helyettem',
  valtozas_telephely: 'valtozas_helyettem',
  valtozas_szuneteltetes: 'valtozas_helyettem',
  valtozas_adoadat: 'valtozas_helyettem',
  valtozas_folytatas: 'valtozas_helyettem',
  valtozas_megszuntetes: 'valtozas_helyettem',
};
/**
 * assist_requests.status (SPEC §27.3.4). Kind 'meghatalmazas' skips 'meghatalmazas_el', 'ugyfel_engedelyezte' and
 * 'bejelentes_bekuldve' (verified → 'kesz').
 */
// SPEC §28.K.1: 'dijra_var' = a fee-bearing change waits for the client's prepayment (ball: ugyfel) → 'egyeztetve'.
export const ASSIST_STATUSES = [
  'visszahivas_kerve',
  'dijra_var',
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
  'dijra_var',
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
  'dijra_var',
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
  dijra_var: 'Díjra vár – az ügyfél még nem fizetett',
  egyeztetve: 'Egyeztetve – UJEGYKE beküldésére vár (változásnál: adatok átnézése)',
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
  dijra_var: 'ugyfel',
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
  // SPEC §28.5.5 (change-ready, change-done) and §28.K.1 (prepayment arrived)
  'adatok_rendben',
  'valtozas_kesz',
  'dij_fizetve',
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
  // SPEC §28.5.5: 'valtozas_kesz' by the accountant only when env CHANGE_DONE_BY_FILER_ALLOWED=true (default: four eyes)
  adatok_rendben: ['konyvelo', 'admin'],
  valtozas_kesz: ['csapat', 'admin'],
  dij_fizetve: ['rendszer'],
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
  // SPEC §28.5.5 – change kinds
  valtozas_adatok: ['adatok_teljesek', 'jogcim_rendben', 'ovtj_rendben', 'meghatalmazas_lefedi', 'datum_rendben'],
  valtozas_bejelentes: ['kepviseletvalaszto', 'adatok_egyeznek', 'valtozas_bekuldve', 'ertesites_letoltve'],
} as const;
export type AssistCheckPhase = keyof typeof ASSIST_CHECK_ITEMS;
export type AssistCheckItem = (typeof ASSIST_CHECK_ITEMS)[AssistCheckPhase][number];
/** Phases per kind (kind 'meghatalmazas' has no 'bejelentes' phase). */
export const ASSIST_PHASES: Record<AssistKind, readonly AssistCheckPhase[]> = {
  vallalkozas_bejelentes: ['hivas', 'ujegyke', 'bejelentes'],
  meghatalmazas: ['hivas', 'ujegyke'],
  // SPEC §28.5.5: 'hivas' only when a callback was requested
  valtozas_szekhely: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
  valtozas_tevekenyseg: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
  valtozas_telephely: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
  valtozas_szuneteltetes: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
  valtozas_adoadat: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
  valtozas_folytatas: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
  valtozas_megszuntetes: ['hivas', 'valtozas_adatok', 'valtozas_bejelentes'],
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
  // SPEC §28.5.5
  adatok_teljesek: 'Az új adatok teljesek, mezőnként a NAV szerint',
  jogcim_rendben: 'A jogcím rendben (székhely, telephely)',
  ovtj_rendben: 'Az ÖVTJ-sor kiválasztva (tevékenység)',
  meghatalmazas_lefedi: 'A meghatalmazás kiterjed az „Egyéni vállalkozói nyilvántartással kapcsolatos ügyek” csoportra (adóadatnál: ADÓÜGYEK)',
  datum_rendben: 'A változás napja rendben (szüneteltetésnél: nem múltbeli)',
  valtozas_bekuldve: 'Beküldve, a NAV visszaigazolta',
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
  // SPEC §28.3.4 (optional, never counted) and §28.K.7 (listed only when the employer answer is not 'nincs')
  'kedvezmenyek',
  'alkalmazottak',
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
  // SPEC §28.3.4 / §28.K.7: 'kedvezmenyek' and 'alkalmazottak' right after 'adatok' ('alkalmazottak' only when needed).
  van: ['ut', 'adatok', 'kedvezmenyek', 'alkalmazottak', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'],
  inditas_onallo: ['ut', 'adatok', 'kedvezmenyek', 'alkalmazottak', 'kerdoiv', 'bejelentes', 'ertesites', 'atnezes', 'kamara', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'],
  inditas_segitett: ['ut', 'visszahivas', 'adatok', 'kedvezmenyek', 'alkalmazottak', 'kerdoiv', 'szerzodes', 'meghatalmazas', 'vegso_jovahagyas', 'bejelentes', 'kamara', 'azonositas', 'elofizetes', 'nav_bekotes'],
};
/** Greyed preview under the unanswered branch question ("Utána ezek jönnek"). */
export const JOURNEY_PREVIEW: readonly JourneyStepKey[] = ['adatok', 'szerzodes', 'meghatalmazas', 'azonositas', 'elofizetes', 'nav_bekotes'];
/** Rows that never block activation even when open (the client still sees and counts them). */
export const JOURNEY_NOT_REQUIRED_FOR_ACTIVATION: readonly JourneyStepKey[] = ['kamara', 'kedvezmenyek'];
/** SPEC §28.3.4: rows never counted in todoCount / the badge (and never 'most'). */
export const JOURNEY_NOT_COUNTED: readonly JourneyStepKey[] = ['kedvezmenyek'];
/** Content key of the new step lock: Előfizetés waits for the Szerződés on both paths (k3_kor2 finding, SPEC §27.4). */
export const LOCK_ELOFIZETES_SZERZODES_UTAN = 'bekotes.zarolt.elofizetes_szerzodes_utan';

// =====================================================================================================================
// SPEC §28 – "Öt új funkció" (owner order 2026-11-19 12:25): félretenni, new-invoice notification, 2026 allowances,
// "Mennyit kerestem?", change guides. Keys, rules and numbers only; the client texts are in bekotes.ts.
// =====================================================================================================================

// ---------- §28.1 "Ennyit tegyél félre" ----------
/** Zone of one invoice's reserve (SPEC §28.1.2 rule 7) = CHECK of revenue_reserves.zone. */
export const RESERVE_ZONES = ['adomentes', 'nem_novel', 'csak_szja', 'teljes', 'kedvezmeny', 'sztorno', 'nincs_adat'] as const;
export type ReserveZone = (typeof RESERVE_ZONES)[number];
/** Why a reserve is only an estimate (SPEC §28.1.7). Client texts: RESERVE_TEXTS.becsles. */
export const RESERVE_ESTIMATE_REASONS = ['fizetesi_hatarido', 'profil_nincs_megerositve', 'kedvezmeny_jovahagyasra_var', 'szabalyok_tervezet', 'elozo_konyvelo'] as const;
export type ReserveEstimateReason = (typeof RESERVE_ESTIMATE_REASONS)[number];
/** SPEC §28.1.2 rule 5: positive reserves round UP to this, storno reserves towards zero. */
export const RESERVE_ROUND_HUF = 1_000;

// ---------- §28.2 new-invoice notification ----------
export const INVOICE_NOTIFY_RULES = {
  /** env INVOICE_NOTIFY_MAX_AGE_DAYS: older issue dates are never notified ('kihagyva_regi'). */
  maxAgeDays: 10,
  /** env INVOICE_NOTIFY_MAX_PUSH_PER_DAY: pushes per client per Budapest day; later rows are in-app only. */
  maxPushPerDay: 2,
  /** An unread invoice_new row of the last N hours whose push has not gone out yet absorbs the new invoices. */
  foldInHours: 20,
  /** {vevo} is trimmed to this many characters. */
  customerNameMaxChars: 40,
} as const;
/** nav_invoices.notify_state (SPEC §28.7.1); null = not decided yet. */
export const INVOICE_NOTIFY_STATES = ['kuldve', 'osszevonva', 'kihagyva_elso_szinkron', 'kihagyva_regi', 'kihagyva_modositas', 'kihagyva_zarolt'] as const;
export type InvoiceNotifyState = (typeof INVOICE_NOTIFY_STATES)[number];
/** Variants of notif.invoice_new (SPEC §28.2.4). 'alap' = the content keys without a variant segment. */
export const INVOICE_NOTIFY_VARIANTS = ['alap', 'kuszob', 'adomentes', 'tobb', 'tobb_adomentes', 'rejtett'] as const;
export type InvoiceNotifyVariant = (typeof INVOICE_NOTIFY_VARIANTS)[number];
/** SPEC §28.2.3: per-user push quiet hours (Budapest time, [from, to) wrapping midnight). */
export const QUIET_HOURS_DEFAULT = { enabled: true, from: 20, to: 8 } as const;
/** The only client push kinds that ignore the quiet hours (SPEC §28.2.3). Staff never get push. */
export const QUIET_HOURS_EXEMPT_KINDS: readonly NotificationKind[] = ['callback_calling'];
/** Kinds whose push may show amounts and the customer (SPEC §28.2.5, §28.K.17); never a private person's name. */
export const PUSH_AMOUNT_KINDS: readonly NotificationKind[] = ['invoice_new', 'kata_business_invoice'];
/** PATCH /me: max length of notificationPrefs (was 40, SPEC §28.2.3). */
export const NOTIFICATION_PREFS_MAX = 80;

// ---------- §28.3 personal allowances 2026 ----------
export const ALLOWANCE_KINDS = ['anya30', 'anyak', 'fiatal25', 'szemelyi', 'elso_hazasok', 'csaladi', 'csed_gyed'] as const;
export type AllowanceKind = (typeof ALLOWANCE_KINDS)[number];
/** Engine order (Szja tv. 29/H; SPEC §28.3.1). 'csed_gyed' is an info item: the accountant records a 'kieso' break. */
export const ALLOWANCE_ENGINE_ORDER: readonly AllowanceKind[] = ['anya30', 'anyak', 'fiatal25', 'szemelyi', 'elso_hazasok', 'csaladi'];
export const ALLOWANCE_STATUSES = ['javasolt', 'kerdes', 'jovahagyva', 'elutasitva', 'visszavonva'] as const;
export type AllowanceStatus = (typeof ALLOWANCE_STATUSES)[number];
/** Waiting for the accountant (badge `allowancesPending`, filter "Kedvezmény vár"). */
export const ALLOWANCE_PENDING_STATUSES: readonly AllowanceStatus[] = ['javasolt', 'kerdes'];
export const ALLOWANCE_GATES = ['lehet', 'nem_jar', 'kesobb'] as const;
export type AllowanceGate = (typeof ALLOWANCE_GATES)[number];
export const ANYAK_JOGCIMEK = ['ket', 'harom', 'negyplusz'] as const;
export type AnyakJogcim = (typeof ANYAK_JOGCIMEK)[number];
export const ALLOWANCE_REJECT_REASONS = ['kor', 'nem_jogosult', 'mas_veszi_igenybe', 'nincs_jovedelem', 'igazolas_hianyzik', 'egyeb'] as const;
export type AllowanceRejectReason = (typeof ALLOWANCE_REJECT_REASONS)[number];
/** Input limits of the questionnaire and the panel (SPEC §28.3.2–§28.3.6). Tax values themselves live in the engine rules. */
export const ALLOWANCE_LIMITS = {
  birthYearMin: 1940,
  birthYearMax: 2010,
  childrenMax: 12,
  otherDependantsMax: 9,
  sharePctMin: 10,
  sharePctMax: 90,
  sharePctStep: 10,
  /** Első házasok: Ft/month for the couple (Szja tv. 29/C.). */
  elsoHazasokMonthlyMaxHuf: 33_335,
  elsoHazasokMaxMonths: 24,
  noteMaxChars: 500,
  clientTextMaxChars: 500,
  staffNoteMaxChars: 1_000,
  /** Panel preview debounce. */
  previewDebounceMs: 400,
} as const;
/** Variants of allowance_decided and allowance_check (SPEC §28.3.9). */
export const ALLOWANCE_DECIDED_VARIANTS = ['jovahagyva', 'reszben', 'kerdes', 'elutasitva'] as const;
export type AllowanceDecidedVariant = (typeof ALLOWANCE_DECIDED_VARIANTS)[number];
export const ALLOWANCE_CHECK_VARIANTS = ['ev_eleje', 'lejar'] as const;
export type AllowanceCheckVariant = (typeof ALLOWANCE_CHECK_VARIANTS)[number];

// ---------- §28.4 "Mennyit kerestem?" ----------
/** The weakest part of a month decides its basis (SPEC §28.4.1): becsles < jovahagyva < befizetve. */
export const EARNINGS_BASES = ['becsles', 'jovahagyva', 'befizetve'] as const;
export type EarningsBasis = (typeof EARNINGS_BASES)[number];
export const EARNINGS_RULES = {
  /** The year-end projection needs this many elapsed active days (same rule as the meters). */
  projectionMinDays: 60,
  /** Projected numbers are shown rounded to this, with "kb.". */
  projectionRoundHuf: 10_000,
} as const;

// ---------- §28.5 change guides ("Változás-útmutatók") + §28.K.6 resumption ----------
/** = the change assist kinds and the change guide kinds (SPEC §28.5.1 + §28.K.6 'valtozas_folytatas'). */
export const CHANGE_KINDS = [
  'valtozas_szekhely',
  'valtozas_tevekenyseg',
  'valtozas_telephely',
  'valtozas_szuneteltetes',
  'valtozas_adoadat',
  'valtozas_folytatas',
  // SPEC §29.7 F3 – "A vállalkozás megszüntetése" (guide + "Megszüntetjük helyetted", fee kind 'megszuntetes').
  'valtozas_megszuntetes',
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
/** Filed in the Vállalkozói Ügysegéd (valid until env CHANGE_UGYSEGED_VALID_UNTIL); 'valtozas_adoadat' goes to ONYA (T101E). */
export const CHANGE_UGYSEGED_KINDS: readonly ChangeKind[] = ['valtozas_szekhely', 'valtozas_tevekenyseg', 'valtozas_telephely', 'valtozas_szuneteltetes', 'valtozas_folytatas', 'valtozas_megszuntetes'];
export const CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT = '2026-12-31';
export const CHANGE_ADOADAT_VALID_UNTIL = '2027-12-31';
/** env CHANGE_DONE_BY_FILER_ALLOWED default: four eyes on change-done. */
export const CHANGE_DONE_BY_FILER_ALLOWED_DEFAULT = false;
/** 3D icon per change kind (hub rows, SPEC §28.5.2). */
export const CHANGE_KIND_ICON: Record<ChangeKind, Icon3dAny> = {
  valtozas_szekhely: 'fooldal',
  valtozas_tevekenyseg: 'irat',
  valtozas_telephely: 'boritek',
  valtozas_szuneteltetes: 'tepnaptar',
  valtozas_adoadat: 'bevallas',
  valtozas_folytatas: 'tepnaptar',
  valtozas_megszuntetes: 'irat',
};
/** Items of a tax-data change (T101E). SPEC §28.5.6 + §28.K.1 / §28.K.11 (pension, KATA in / out). */
export const CHANGE_TAX_ITEMS = ['munkavegzes', 'nyugdijba_vonulas', 'kozossegi_adoszam', 'kata_belepes', 'kata_kilepes', 'atalany_kilepes', 'afa_kilepes', 'egyeb'] as const;
export type ChangeTaxItem = (typeof CHANGE_TAX_ITEMS)[number];
/** Out of our service: the callback is forced, no fee and no filing until the call agrees (SPEC §28.5.5). */
export const CHANGE_TAX_ITEMS_CALL_FIRST: readonly ChangeTaxItem[] = ['atalany_kilepes', 'afa_kilepes'];
/** A change of legal status (fee 'valtozas_jogallas', SPEC §28.K.1). */
export const CHANGE_TAX_ITEMS_JOGALLAS: readonly ChangeTaxItem[] = ['munkavegzes', 'nyugdijba_vonulas', 'kata_belepes', 'kata_kilepes'];
export const CHANGE_ACTIVITY_MODES = ['uj_fo', 'uj_mellek', 'torles'] as const;
export type ChangeActivityMode = (typeof CHANGE_ACTIVITY_MODES)[number];
/** "Közterület jellege" select of the address screens (the most common NAV values). */
export const STREET_TYPES = ['utca', 'út', 'útja', 'tér', 'köz', 'sor', 'körút', 'sétány', 'fasor', 'park', 'lakótelep', 'liget', 'dűlő', 'tanya', 'major'] as const;
export const CHANGE_RULES = {
  /** Szüneteltetés start: ≥ today, ≤ today + 60 days; the end ≤ start + 2 years. */
  szunetelStartMaxAheadDays: 60,
  szunetelMaxYears: 2,
  /** Folytatás (resumption): ≥ today, ≤ today + 60 days. */
  folytatasMaxAheadDays: 60,
  noteMaxChars: 500,
} as const;
/** Follow-ups the panel offers on change-done (SPEC §28.5.5 + §28.K.6); labels: CHANGE_FOLLOWUP_LABELS (bekotes.ts). */
export const CHANGE_FOLLOWUP_KEYS: Record<ChangeKind, readonly string[]> = {
  valtozas_szekhely: ['hq_municipality', 'hipa_atnezes', 'szamlazo_emlekezteto'],
  valtozas_tevekenyseg: ['tevekenyseg_frissites', 'koltseghanyad_megerosites'],
  valtozas_telephely: ['hipa_masik_telepules'],
  valtozas_szuneteltetes: ['szunetel_szakasz', 'szunetel_dij', 'folytatas_emlekezteto'],
  valtozas_adoadat: ['adoprofil_statusz', 'adozasi_mod'],
  valtozas_folytatas: ['szunetel_lezaras', 'szunetel_dij_lezaras', 'hipa_atnezes'],
  // SPEC §29.7: CHANGE_FOLLOWUPS.valtozas_megszuntetes (labels in k29f.ts; 'elofizetes_lezaras' ends the subscription).
  valtozas_megszuntetes: ['zaro_jarulek_bevallas', 'szja_eves', 'kata_zaro', 'hipa_soron_kivuli', 'afa_ellenorzes', 'meghatalmazas_megszuntetes', 'elofizetes_lezaras'],
};

// =====================================================================================================================
// SPEC §28.K – owner orders 11-19 afternoon–evening (A–N, prices, fees). Texts in bekotes.ts, DTOs in api.ts.
// =====================================================================================================================

// ---------- §28.K.1 prices and fees ----------
// SPEC §29.4.1 / §29.12: + the certificate fees (F1, default 0 Ft) and the closing fee (F3, priced as the legal-status change).
export const FEE_KINDS = [
  'havidij',
  'havidij_kata',
  'eves_zaras',
  'valtozas_egyszeru',
  'valtozas_jogallas',
  'szuneteltetesi_dij',
  'igazolas_jovedelem',
  'igazolas_ado',
  'igazolas_koma',
  'igazolas_ev_kivonat',
  'igazolas_egyeb',
  'megszuntetes',
] as const;
export type FeeKind = (typeof FEE_KINDS)[number];
export const FEE_UNITS = ['ho', 'ev', 'alkalom'] as const;
export type FeeUnit = (typeof FEE_UNITS)[number];
/**
 * Defaults seeded into fee_settings (admin-editable, history kept). SPEC §29.4.1 (owner 11-20): every price is REAL – no
 * DEMO mark any more; an admin edit is itself the confirmation. The "unconfirmed → not chargeable in production" rule stays
 * in code (it never triggers now).
 */
export const FEE_DEFAULTS: Record<FeeKind, { amountHuf: number; unit: FeeUnit; confirmed: boolean; note: string }> = {
  havidij: { amountHuf: 19_999, unit: 'ho', confirmed: true, note: 'Tulaj 2026-11-19 19:30: 19 999 Ft' },
  havidij_kata: { amountHuf: 19_999, unit: 'ho', confirmed: true, note: 'Tulaj 2026-11-19 17:25: „Ugyanannyi lesz”' },
  eves_zaras: { amountHuf: 14_999, unit: 'ev', confirmed: true, note: 'Tulaj 11-20: végleges ár' },
  valtozas_egyszeru: { amountHuf: 4_999, unit: 'alkalom', confirmed: true, note: 'Tulaj 11-20: végleges ár' },
  valtozas_jogallas: { amountHuf: 7_999, unit: 'alkalom', confirmed: true, note: 'Tulaj 11-20: végleges ár' },
  szuneteltetesi_dij: { amountHuf: 2_999, unit: 'ho', confirmed: true, note: 'Tulaj 11-20: végleges ár' },
  igazolas_jovedelem: { amountHuf: 0, unit: 'alkalom', confirmed: true, note: 'SPEC §29.5: benne van a havidíjban' },
  igazolas_ado: { amountHuf: 0, unit: 'alkalom', confirmed: true, note: 'SPEC §29.5: benne van a havidíjban' },
  igazolas_koma: { amountHuf: 0, unit: 'alkalom', confirmed: true, note: 'SPEC §29.5: benne van a havidíjban' },
  igazolas_ev_kivonat: { amountHuf: 0, unit: 'alkalom', confirmed: true, note: 'SPEC §29.5: benne van a havidíjban' },
  igazolas_egyeb: { amountHuf: 0, unit: 'alkalom', confirmed: true, note: 'SPEC §29.5: benne van a havidíjban' },
  megszuntetes: { amountHuf: 7_999, unit: 'alkalom', confirmed: true, note: 'Tulaj 11-20: a jogállás-változással azonos ár' },
};
/** SPEC §29.4.1 data step: the owner's real prices of 11-20 (a fee_settings row with exactly this amount gets confirmed). */
export const FEE_OWNER_PRICES_1120: Partial<Record<FeeKind, number>> = { eves_zaras: 14_999, valtozas_egyszeru: 4_999, valtozas_jogallas: 7_999, szuneteltetesi_dij: 2_999 };
/** Monthly plan codes (plans.code) and their fee setting. */
export const PLAN_CODES = ['havi', 'havi_kata'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export const PLAN_FEE_KIND: Record<PlanCode, FeeKind> = { havi: 'havidij', havi_kata: 'havidij_kata' };
/**
 * One-off fees. SPEC §29.1.7: paid in the app with the saved card after the client's tap (Stripe), or on a hosted page;
 * under PAYMENT_PROVIDER=simplepay still a one-time SimplePay payment (never the recurring token).
 */
export const ONE_OFF_FEE_KINDS: readonly FeeKind[] = ['eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'igazolas_jovedelem', 'igazolas_ado', 'igazolas_koma', 'igazolas_ev_kivonat', 'igazolas_egyeb', 'megszuntetes'];
/** A change the client files himself with our guide costs nothing (a rule, not a setting). */
export const CHANGE_FEE_RULES = { selfService: 0 } as const;
/** Which fee an ASSISTED change pays (SPEC §28.K.1); null = no fee (for CHANGE_TAX_ITEMS_CALL_FIRST: no filing until agreed). */
export function changeFeeKind(kind: ChangeKind, items: readonly ChangeTaxItem[] = []): FeeKind | null {
  // SPEC §29.7: "Megszüntetjük helyetted" has its own fee (default = the legal-status change price).
  if (kind === 'valtozas_megszuntetes') return 'megszuntetes';
  if (kind !== 'valtozas_adoadat') return 'valtozas_egyszeru';
  if (items.some((i) => CHANGE_TAX_ITEMS_CALL_FIRST.includes(i))) return null;
  if (items.some((i) => CHANGE_TAX_ITEMS_JOGALLAS.includes(i))) return 'valtozas_jogallas';
  return items.length ? 'valtozas_egyszeru' : null;
}
/** fee_charges.status. 'visszavonva' = cancelled before payment (its purpose was cancelled or closed). */
export const FEE_CHARGE_STATUSES = ['nyitott', 'fizetve', 'visszavonva', 'visszaterites_kell', 'visszaterites_megtortent', 'elengedve'] as const;
export type FeeChargeStatus = (typeof FEE_CHARGE_STATUSES)[number];
// SPEC §29.1.2: + certificates (F1), the closing (F3), a fee the admin added (§29.9.4).
export const FEE_PURPOSE_TYPES = ['valtozas', 'eves_zaras', 'igazolas', 'megszuntetes', 'admin'] as const;
export type FeePurposeType = (typeof FEE_PURPOSE_TYPES)[number];
export const FEE_RULES = {
  /** A rise of havidij / havidij_kata applies to running subscriptions only from ≥ today + 30 days [JOGI]. */
  priceRiseNoticeDays: 30,
} as const;
export const FEE_ERROR_CODES = ['fee_unpaid', 'fee_not_payable'] as const;
export type FeeErrorCode = (typeof FEE_ERROR_CODES)[number];

// ---------- §28.K.2 A – monthly check-in "Változott valami?" ----------
export const CHECKIN_STATUSES = ['nyitott', 'nem_valtozott', 'valtozott', 'lejart'] as const;
export type CheckinStatus = (typeof CHECKIN_STATUSES)[number];
export const CHECKIN_ITEMS = ['munkaviszony', 'nyugdij', 'koltozes', 'tevekenyseg', 'csalad', 'alkalmazott', 'szuneteltetes', 'folytatas', 'kata_ceges', 'egyeb'] as const;
export type CheckinItem = (typeof CHECKIN_ITEMS)[number];
export const CHECKIN_ITEM_STATUSES = ['uj', 'dijra_var', 'csapatnal', 'ugyfel_intezi', 'kesz', 'nem_kell'] as const;
export type CheckinItemStatus = (typeof CHECKIN_ITEM_STATUSES)[number];
/** "hogyan" column of the panel queue: we file it / the client files it with the guide / only a question. */
export const CHECKIN_HOW = ['helyettunk', 'magatol', 'kerdes'] as const;
export type CheckinHow = (typeof CHECKIN_HOW)[number];
/** Answer of "Heti hány órában?"; the threshold is 36 hours (Tbj.; KATA: Kata tv. 2. § 2.). */
export const CHECKIN_WEEKLY_HOURS = ['legalabb_36', 'kevesebb_36'] as const;
export type CheckinWeeklyHours = (typeof CHECKIN_WEEKLY_HOURS)[number];
export const EMPLOYMENT_THRESHOLD_HOURS = 36;
export const CHECKIN_RULES = {
  /** Only clients active for at least this many days get a check-in. */
  minActiveDays: 20,
  /** Opened on the first working day of the month at this hour (Budapest); the period is the previous month. */
  openHour: 9,
  /** Due on this day of the month; unanswered at month end → 'lejart'. */
  dueDay: 10,
  /** Nudges after the opening (§28.K.4). */
  nudgeDays: [3, 7],
  egyebMaxChars: 500,
} as const;
/** The rows a client sees (SPEC §28.K.2: only the relevant ones), in screen order. */
export function checkinItemsFor(c: { regime: TaxRegime; taxStatus: TaxStatus | null; suspended: boolean }): CheckinItem[] {
  const out: CheckinItem[] = ['munkaviszony'];
  if (c.taxStatus !== 'nyugdijas') out.push('nyugdij');
  out.push('koltozes', 'tevekenyseg');
  if (c.regime === 'atalany') out.push('csalad');
  out.push('alkalmazott', c.suspended ? 'folytatas' : 'szuneteltetes');
  if (c.regime === 'kata') out.push('kata_ceges');
  out.push('egyeb');
  return out;
}

// ---------- §28.K.3 B – annual closing + questionnaire ----------
export const ANNUAL_STATUSES = ['nem_indult', 'kerdoiv', 'dijra_var', 'konyvelonel', 'jovahagyasra_var', 'beadva', 'kesz'] as const;
export type AnnualStatus = (typeof ANNUAL_STATUSES)[number];
/** Who acts now. */
export const ANNUAL_BALL: Record<AnnualStatus, 'ugyfel' | 'konyvelo' | null> = {
  nem_indult: null,
  kerdoiv: 'ugyfel',
  dijra_var: 'ugyfel',
  konyvelonel: 'konyvelo',
  jovahagyasra_var: 'ugyfel',
  beadva: 'konyvelo',
  kesz: null,
};
export const ANNUAL_RULES = {
  /** Opens on 5 January 09:00 (Budapest) for the previous tax year. */
  openMonthDay: '01-05',
  openHour: 9,
  /** Questionnaire due (MM-DD of the following year) [KÖNYVELŐ]. */
  questionnaireDue: { atalany: '03-15', kata: '02-05' },
  /** Legal deadlines (MM-DD of the following year): SZJA return, HIPA return, '26KATA declaration. */
  legalDue: { szja: '05-20', hipa: '05-31', kata: '02-25' },
  reminderDaysBefore: [14, 3, 1],
  nudgeDays: [3, 7],
  /** An unpaid annual-closing charge locks the service this many days after the questionnaire was sent (§28.K.5). */
  lockAfterDays: 14,
  messageMaxChars: 1_000,
} as const;
export const ANNUAL_CHECK_ITEMS = [
  'kerdoiv_atnezve',
  'jovedelmek_rendben',
  'kedvezmenyek_rendben',
  'hipa_adatok_rendben',
  'tervezet_feltoltve',
  'ugyfel_jovahagyta',
  'szja_beadva',
  'kata_beadva',
  'hipa_beadva',
  'visszaigazolas_feltoltve',
] as const;
export type AnnualCheckItem = (typeof ANNUAL_CHECK_ITEMS)[number];
export const OTHER_INCOME_KINDS = ['munkaber', 'nyugdij', 'ingatlan_berbeadas', 'ingatlan_auto_eladas', 'ertekpapir', 'kulfold', 'mas', 'nem_volt'] as const;
export type OtherIncomeKind = (typeof OTHER_INCOME_KINDS)[number];
/** The NAV already knows these (no follow-up line). */
export const OTHER_INCOME_KNOWN_TO_NAV: readonly OtherIncomeKind[] = ['munkaber', 'nyugdij'];
export const ANNUAL_HIPA_PLACES = ['csak_szekhely', 'mas_telepulesen_is'] as const;
export type AnnualHipaPlace = (typeof ANNUAL_HIPA_PLACES)[number];
export const ANNUAL_ERROR_CODES = ['annual_wrong_status', 'checkin_closed'] as const;
export type AnnualErrorCode = (typeof ANNUAL_ERROR_CODES)[number];

// ---------- §28.K.4 C – reminders and nudges ----------
export const REMINDER_RULES = {
  /** Approved, unpaid quarter: days before, on the due day 08:00, and one day after. */
  taxDueDaysBefore: [7, 3, 1],
  taxDueDayHour: 8,
  taxOverdueDaysAfter: 1,
  /** KATA: on these days of the month (or the next working day) for the previous month's tax. */
  kataDays: [8, 12],
  /** HIPA advance (16 March, 15 September): days before. */
  hipaAdvanceDaysBefore: [7, 1],
  /** Bank statement reminder day; receipts reminder day and look-back (months). */
  statementDay: 5,
  receiptsDay: 3,
  receiptsLookbackMonths: 3,
  /** Open accountant request: days after it was sent (plus the existing due-1 / due+1 / due+4). */
  requestNudgeDays: [3, 7],
  /** Anything waiting on the client. */
  waitingNudgeDays: [3, 7],
  /** At most one nudge push per client per day (several items → one push). */
  maxNudgePushPerDay: 1,
  /** Staff digest: "Ügyfélre vár 7 napja". */
  staffOverdueDays: 7,
} as const;
/** Fiók → Értesítések → "EMLÉKEZTETŐK" rows (labels REMINDER_TEXTS.groups) and the kinds each row switches. */
export const REMINDER_GROUPS = ['befizetes', 'feltoltes', 'ra_var'] as const;
export type ReminderGroup = (typeof REMINDER_GROUPS)[number];
export const REMINDER_GROUP_KINDS: Record<ReminderGroup, readonly NotificationKind[]> = {
  // SPEC §32.B: the annual return's steps and the önellenőrzés follow the same group setting (the client may switch them off)
  befizetes: ['tax_due_soon', 'annual_due', 'annual_status', 'correction_status'],
  feltoltes: ['upload_reminder'],
  ra_var: ['nudge', 'checkin_due', 'request_reminder'],
};
/** Cannot be switched off (payment and lock texts). */
export const ALWAYS_ON_KINDS: readonly NotificationKind[] = ['fee_due', 'service_locked', 'charge_upcoming', 'payment_action_needed', 'payment_refunded', 'contract_terminated', 'transfer_request', 'transfer_reminder'];
/** Variants used by §28.K.4 (content notif.<kind>.<variant>.*). */
export const REMINDER_VARIANTS = {
  tax_due_soon: ['ma', 'lejart', 'kata', 'kata_ma', 'kata_lejart', 'kata_ev_vege', 'hipa'],
  upload_reminder: ['kivonat', 'nyugta'],
  request_reminder: ['nap3', 'nap7'],
  nudge: ['egy', 'tobb', 'szunetel_ket_ev'],
} as const;
/** What one 'nudge' row is about (one row per item, one push per day). */
export const NUDGE_SUBJECTS = ['havi_ellenorzes', 'kedvezmeny_kerdes', 'eves_kerdoiv', 'dij', 'valtozas_engedely', 'eves_jovahagyas'] as const;
export type NudgeSubject = (typeof NUDGE_SUBJECTS)[number];

// ---------- §28.K.5 D – unpaid fee lock ----------
// SPEC §29.9.4: 'kezi' = locked by the admin (clients.service_lock_manual mode 'zarolva').
// k8: 'atutalas_kesik' = a díjbekérő 8 days late while the switch kapcsolok.fizetes.kesesLeallit is ON (default OFF).
export const SERVICE_LOCK_REASONS = ['havidij', 'eves_zaras', 'kezi', 'atutalas_kesik'] as const;
export type ServiceLockReason = (typeof SERVICE_LOCK_REASONS)[number];
export const SERVICE_LOCK_ERROR_CODE = 'service_locked';
/** What stays open, what is read-only and what is locked while clients.service_lock is set (SPEC §28.K.5). */
export const SERVICE_LOCK_RULES = {
  open: ['fizetes', 'elofizetes', 'kartya', 'dijak', 'dijszamlak', 'fiok', 'ertesitesek', 'gyik_jogi', 'adatletoltes', 'fiok_torles', 'ugyfelszolgalat', 'visszahivas_elofizetes', 'feltoltes'],
  readOnly: ['fooldal', 'dosszie', 'kiallitott_szamlak', 'hataridok', 'felretesz', 'kereset'],
  lockedClient: ['uj_keres', 'igazolas_keres', 'valtozas', 'helyettunk', 'havi_ellenorzes_folytatas', 'kedvezmeny_bekuldes', 'eves_kerdoiv_bekuldes', 'jovahagyas'],
  lockedStaff: ['negyedev_jovahagyas', 'level', 'ev_filed', 'change_done', 'eves_beadva', 'uj_keres_ugyfelnek', 'kedvezmeny_dontes', 'igazolas_keres'],
  /** One extra notice when a tax deadline is this close while locked. */
  deadlineNoticeDays: 14,
} as const;

// ---------- §28.K.6 E – suspension availability fee ----------
// SPEC §29.9.4: 'admin' = opened / closed in the owner console.
export const PAUSE_SOURCES = ['valtozas', 'konyvelo', 'admin'] as const;
export type PauseSource = (typeof PAUSE_SOURCES)[number];
export const PAUSE_RULES = {
  feeKind: 'szuneteltetesi_dij',
  /** SPEC §29.0 / [NAV-SZ]: szüneteltetés max. 3 years (notices since 2021-07-01); reminders before that mark. */
  maxYears: 3,
  reminderDaysBefore: [60, 30],
} as const;

// ---------- §28.K.7 F – employees / EFO ----------
export const EMPLOYER_ANSWERS = ['nincs', 'alkalmazott', 'efo', 'mindketto', 'hamarosan'] as const;
export type EmployerAnswer = (typeof EMPLOYER_ANSWERS)[number];
export const EMPLOYER_DECISIONS = ['nincs_teendo', 'berszamfejtes_mashol', 'egyedi_ajanlat', 'egyedi_elfogadva', 'nem_vallaljuk'] as const;
export type EmployerDecision = (typeof EMPLOYER_DECISIONS)[number];
/** Activation needs one of these when the answer is not 'nincs'. */
export const EMPLOYER_DECISIONS_ALLOW_ACTIVATION: readonly EmployerDecision[] = ['nincs_teendo', 'berszamfejtes_mashol', 'egyedi_elfogadva'];
export const EMPLOYER_SOURCES = ['onboarding', 'havi_ellenorzes', 'konyvelo'] as const;
export type EmployerSource = (typeof EMPLOYER_SOURCES)[number];
export const EMPLOYER_RULES = { clientTextMaxChars: 500 } as const;

// ---------- §28.K.8 G – public tax calculator /kalkulator ----------
export const CALCULATOR_SIDE_OPTIONS = ['csak_ez', 'munkaviszony_36', 'nyugdijas', 'rovid_munkaviszony'] as const;
export type CalculatorSide = (typeof CALCULATOR_SIDE_OPTIONS)[number];
export const CALCULATOR_SIDE_TAX_STATUS: Record<CalculatorSide, TaxStatus> = {
  csak_ez: 'fofoglalkozasu',
  munkaviszony_36: 'mellekallasu',
  nyugdijas: 'nyugdijas',
  rovid_munkaviszony: 'fofoglalkozasu',
};
export const CALCULATOR_RULES = {
  defaultRevenueHuf: 6_000_000,
  maxRevenueHuf: 100_000_000,
  sliderStepHuf: 100_000,
  debounceMs: 300,
  /** HIPA estimate rate (municipal rates are 0–2 %). */
  hipaRatePct: 2,
  /** "Nem találom" → the general cost ratio. */
  fallbackCostRatio: 45,
  maxChildren: 5,
  /** "Ennyit tegyél félre havonta" rounds up to this. */
  monthlyReserveRoundHuf: 1_000,
  /** Only if the server path is used: POST /public/calculator per IP per minute. */
  serverRateLimitPerMinute: 30,
  routeBundleTargetKbGzip: 150,
  lighthouseMobileMin: 85,
  /** postMessage type of the embedded mode (`?beagyazva=1`). */
  heightMessageType: 'kalkulator:magassag',
} as const;

// ---------- §28.K.9 H – auto-fill by adószám ----------
export const TAXPAYER_LOOKUP_RULES = {
  /** The lookup fires when the 8th digit (törzsszám) is typed. */
  triggerDigits: 8,
  debounceMs: 250,
  /** The shared nav-kliens queue keeps at least this gap between NAV calls (§8.1). */
  navMinIntervalMs: 1_000,
  perClientPerHour: 10,
  perClientPerDay: 30,
} as const;
export const TAXPAYER_LOOKUP_STATUSES = ['talalt', 'nincs', 'nem_ev'] as const;
export type TaxpayerLookupStatus = (typeof TAXPAYER_LOOKUP_STATUSES)[number];
export const TAXPAYER_LOOKUP_ERROR_CODES = ['lookup_not_configured', 'lookup_unavailable', 'lookup_rate_limited'] as const;
export type TaxpayerLookupErrorCode = (typeof TAXPAYER_LOOKUP_ERROR_CODES)[number];
export const BUSINESS_IDENTITY_SOURCES = ['nav', 'kezi'] as const;
export type BusinessIdentitySource = (typeof BUSINESS_IDENTITY_SOURCES)[number];
export const YES_NO_DONTKNOW = ['igen', 'nem', 'nem_tudom'] as const;
export type YesNoDontKnow = (typeof YES_NO_DONTKNOW)[number];
/** The ÁFA code (9th digit of the adószám) of an alanyi ÁFA-mentes EV (SPEC §27 rule). */
export const ALANYI_MENTES_VAT_CODE = '1';

// ---------- §28.K.11 J – KATA ----------
export const TAX_REGIMES = ['atalany', 'kata'] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];
/** clients.tax_regime_answer (onboarding "Hogyan adózol most?"). */
export const TAX_REGIME_ANSWERS = ['atalany', 'kata', 'nem_tudom'] as const;
export type TaxRegimeAnswer = (typeof TAX_REGIME_ANSWERS)[number];
/** 2026 KATA facts for the UI (the engine rules block `kata` is the source for numbers; [KATA] research 11-19). */
export const KATA_RULES_2026 = {
  monthlyHuf: 50_000,
  /** Due by the 12th of the following month (next working day). */
  dueDayOfNextMonth: 12,
  // SPEC §32: the name in the NAV list in force from 2026-11-01 (checked 2026-11-21); the engine's NAV_ACCOUNTS.kata is the source
  accountName: 'NAV Kisadózó vállalkozások adója bevételi számla',
  accountNumber: '10032000-01076349',
  iban: 'HU27100320000107634900000000',
  adonem: '288',
  yearlyLimitHuf: 18_000_000,
  /** The limit is prorated: liable months × this. */
  monthlyLimitHuf: 1_500_000,
  kulonadoPct: 40,
  /** '26KATA declaration and the különadó payment (MM-DD of the next year). */
  declarationDue: '02-25',
  /** Notice deadline after a kifizető payment or a lost főfoglalkozás (days). */
  reportDays: 15,
  /** No re-entry for the rest of the year + this many months after leaving. */
  reentryBanMonths: 12,
  ellatasiAlapHuf: 108_000,
  serviceDaysPerYear: 122,
  /** The keret meter turns amber at this share, red above 100 %. */
  warnPct: 80,
} as const;
/** revenue_items.payer_kind (SPEC §28.K.11). */
export const PAYER_KINDS = ['maganszemely', 'kifizeto', 'kulfoldi_kifizeto', 'ismeretlen'] as const;
export type PayerKind = (typeof PAYER_KINDS)[number];
/** From NAV customerVatStatus; a missing status → 'ismeretlen'. OTHER = a foreign customer: the accountant checks it. */
export const PAYER_KIND_BY_VAT_STATUS: Record<'PRIVATE_PERSON' | 'DOMESTIC' | 'OTHER', PayerKind> = {
  PRIVATE_PERSON: 'maganszemely',
  DOMESTIC: 'kifizeto',
  OTHER: 'kulfoldi_kifizeto',
};
/** Invoices that trigger the KATA business-customer warning ('ismeretlen' → "ellenőrizd"). */
export const KATA_WARNING_PAYER_KINDS: readonly PayerKind[] = ['kifizeto', 'kulfoldi_kifizeto', 'ismeretlen'];

// ---------- §28.K.12 K – patterns from Accountable ----------
/** Status tabs with counts in document lists ("Feltöltve 3 · Bence látta 2 · Kész 12"). */
export const DOCUMENT_STATUS_TABS = ['feltoltve', 'latta', 'kesz'] as const;
export type DocumentStatusTab = (typeof DOCUMENT_STATUS_TABS)[number];
export const DOCUMENT_STATUS_TAB_OF: Record<DocumentStatus, DocumentStatusTab> = {
  feltoltve: 'feltoltve',
  konyvelo_latta: 'latta',
  feldolgozva: 'kesz',
  beadva: 'kesz',
};
/** Personal forwarding e-mail address (SPEC §28.K.12 item 6). */
export const MAILBOX_RULES = {
  /** <kod>@<MAILBOX_DOMAIN>, kod = 8 random base32 characters (lower case). */
  codeLength: 8,
  codeAlphabet: 'abcdefghijklmnopqrstuvwxyz234567',
  /** Extra senders besides the login e-mail. */
  maxExtraSenders: 3,
  maxAttachments: 10,
  maxAttachmentBytes: 15 * 1024 * 1024,
  maxMailBytes: 25 * 1024 * 1024,
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'application/xml', 'text/xml'],
  /** A bank statement received on day 1–10 goes to the previous month's dossier. */
  statementPrevMonthUntilDay: 10,
} as const;
export const MAILBOX_STATUSES = ['elfogadva', 'elutasitva'] as const;
export type MailboxStatus = (typeof MAILBOX_STATUSES)[number];
export const MAILBOX_REJECT_REASONS = ['idegen_felado', 'hitelesites_hibas', 'tul_nagy', 'rossz_tipus', 'tul_sok_csatolmany', 'nincs_csatolmany', 'ismeretlen_cim'] as const;
export type MailboxRejectReason = (typeof MAILBOX_REJECT_REASONS)[number];

// ---------- §28.K.15 N – no response-time promise ----------
/**
 * Case-insensitive RegExp sources. The QA grep over kod/app/src, kod/panel/src, kod/backend/src (content + seed),
 * kod/jogi (without _regi/), kod/media/*.vtt and kod/shared/src must find 0 hits. They never match the callback promise
 * "24–48 órán belül hív" (owner decision) or process lines such as "általában 1 munkanapon belül beküldi".
 */
export const RESPONSE_TIME_FORBIDDEN_PATTERNS: readonly string[] = [
  'nincs\\s+buta\\s+kérdés',
  '(órán|percen|munkanapon|napon)\\s+belül\\s+válaszol',
  'munkanapokon\\s+\\d+\\s*órán\\s+belül',
  'munkanapon\\s+belül\\s+átnézi',
];
/** accountants.response_time_text default (migration SET DEFAULT, SPEC §28.K.15). */
export const ACCOUNTANT_RESPONSE_TIME_DEFAULT = 'A lehető leggyorsabban válaszol';

// ---------- §28.K.10 I – the approved look: variant C + the 8 px separator band ----------
/**
 * Binding UI scale (pt = CSS px at 390 width). Source: dizajn/C4_atlathato/valasztott/ (owner 11-19 20:10 "a C sokkal
 * jobb") + dizajn/C4_atlathato/C_elvalaszto/ (20:20 "csak valami elválasztó köztük"): between two white sections an
 * 10 px #D3DAFC band (owner's final choice 11-19 20:40, dizajn/C4_atlathato/C_VEGLEGES; before: 8 px #EEF1F8 of C_elvalaszto).
 * C_retegek (stacked sheets, shadows, darkening layers) is rejected.
 */
export const UI_SCALE = {
  screenTitle: { size: 26, weight: 700, lineHeight: 1.15, letterSpacingEm: -0.022 },
  /** Dark ink, not blue: blue is only the band, the main button, the text link and the active tab. */
  sectionTitle: { size: 18, weight: 650, lineHeight: 1.3, letterSpacingEm: -0.012, color: 'tinta' },
  body: { size: 16, weight: 400, lineHeight: 1.45, minSize: 15 },
  secondary: { size: 15, lineHeight: 1.4, color: 'halvany', minContrast: 4.5 },
  row: { titleSize: 16, titleWeight: 600, titleLineHeight: 1.35, subSize: 15, subLineHeight: 1.4, minHeight: 52 },
  bigNumber: { size: 22, weight: 700, tabularNums: true },
  band: {
    avatar: 30,
    nameSize: 15,
    progressNumberSize: 18,
    progressNumberWeight: 750,
    progressBarHeight: 6,
    messageIcon: 30,
    messageTitleSize: 26,
    messageTextSize: 16,
    messageIndent: 38,
    paddingBottom: 20,
  },
  icon: { section: 28, row: 28, band: 30, tab: 26, info: 26 },
  mainButton: { height: 52, fontSize: 17, weight: 650, sideMargin: 16 },
  capsule: { height: 40, tapHeight: 44, fontSize: 15.5, weight: 650 },
  textLink: { size: 16, weight: 550, minHeight: 44, maxPerScreen: 1 },
  input: { height: 56, radius: 12, focusBorder: 2, valueSize: 22, valueWeight: 600 },
  formHeader: { backHeight: 36, titleSize: 16, titleWeight: 650 },
  tabBar: { height: 52, tabs: ['Főoldal', 'Dosszié', 'Fotózás', 'Üzenetek', 'Fiók'], labelSize: 12.5, labelWeight: 550, activeWeight: 750 },
  section: { padding: 16, contentIndent: 38, separator: { heightPx: 10, color: '#D3DAFC' }, rowDivider: { heightPx: 1, color: '#E2E6F1' } },
  spacing: [4, 8, 12, 16, 24],
  minTapTarget: 44,
  colors: {
    brand: '#1428DB',
    tinta: '#10152B',
    halvany: '#505873',
    hajszal: '#E2E6F1',
    fejlecHalvany: '#C9D2FF',
    gombMAlap: '#DFE4FD',
    tintakekSzoveg: '#1226B8',
    sectionSeparator: '#D3DAFC',
    page: '#FFFFFF',
  },
  /** Never: rejected by the owner or outside the approved set. */
  forbidden: ['card_shadow', 'stacked_sheets', 'darkening_layer', 'box_in_box', 'line_icons', 'pastel_circles', 'hamburger_menu', 'fab_plus'],
  panel: { pageTitle: 24, sectionTitle: 18, tableText: 14.5, rowMinHeight: 40, buttonHeightMin: 36, buttonHeightMax: 40 },
} as const;
