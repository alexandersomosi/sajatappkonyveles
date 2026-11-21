// Drizzle schema = SPEC §5 data model. Column names are snake_case in Postgres (drizzle casing
// 'snake_case'), camelCase in TypeScript. Money = bigint forint (mode number). Business dates =
// `date` as 'YYYY-MM-DD' strings. Deviations from §5 are listed in SPEC §24 (backend notes).
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  APPOINTMENT_STATUSES,
  BUSINESS_STATUSES,
  CALC_STATUSES,
  CALLBACK_ATTEMPT_OUTCOMES,
  CALLBACK_CLOSE_REASONS,
  CALLBACK_SOURCES,
  CALLBACK_STATUSES,
  CALLBACK_TOPICS,
  CALLBACK_WINDOWS,
  FILING_CHANNELS,
  REGISTRATION_MODES,
  ASSIST_KINDS,
  ASSIST_STATUSES,
  ASSIST_CLOSE_REASONS,
  ASSIST_JOGCIMEK,
  REGISTRATION_STATUSES,
  REGISTRATION_WITHDRAW_REASONS,
  CLIENT_LIFECYCLES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_SOURCES,
  DOCUMENT_STATUSES,
  LEGAL_DOC_TYPES,
  NOTIFICATION_KINDS,
  ONBOARDING_STEPS,
  PAYMENT_ITEM_KINDS,
  PAYMENT_STATUSES,
  REQUEST_STATUSES,
  STEP_STATUSES,
  SUBSCRIPTION_STATUSES,
  TAX_STATUSES,
  USER_ROLES,
  USER_STATUSES,
  // SPEC §28 / §28.K
  ACCOUNTANT_RESPONSE_TIME_DEFAULT,
  ALLOWANCE_GATES,
  ALLOWANCE_KINDS,
  ALLOWANCE_REJECT_REASONS,
  ALLOWANCE_STATUSES,
  ANNUAL_STATUSES,
  CHECKIN_ITEM_STATUSES,
  CHECKIN_ITEMS,
  CHECKIN_STATUSES,
  EMPLOYER_ANSWERS,
  EMPLOYER_DECISIONS,
  EMPLOYER_SOURCES,
  FEE_CHARGE_STATUSES,
  FEE_KINDS,
  FEE_UNITS,
  INVOICE_NOTIFY_STATES,
  MAILBOX_STATUSES,
  PAUSE_SOURCES,
  PAYER_KINDS,
  RESERVE_ZONES,
  TAX_REGIME_ANSWERS,
  TAX_REGIMES,
  WORK_KINDS,
} from '../_shared/enums.js';
import type { AllowanceAnswers, AllowanceParams, AnnualAnswers, ChangeData, CheckinItemAnswer } from '../_shared/api.js';
import type { BusinessRegistrationAnswers } from '../_shared/api.js';
import type { KataExemptKind } from '../_shared/kata.js';
import type { AnnualAmounts, AnnualSummary, CorrectionCause, CorrectionDiff, CorrectionForm, CorrectionPotlekFlags, CorrectionStatus, ReconBalanceView, ReconFollowUp, ReconSeenRow, ReconStatus } from '../_shared/eves.js';

const ts = (name?: string) => (name ? timestamp(name, { withTimezone: true }) : timestamp({ withTimezone: true }));
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const day = () => date({ mode: 'string' });
const huf = () => bigint({ mode: 'number' });
const id = () => uuid().primaryKey().defaultRandom();
/** "('a', 'b')" for CHECK constraints of text state columns (SPEC §26.9: text + CHECK, no new enum types). */
const inList = (values: readonly string[]) => sql.raw(`(${values.map((v) => `'${v}'`).join(', ')})`);

// ---------- enums ----------
export const userRole = pgEnum('user_role', USER_ROLES);
export const userStatus = pgEnum('user_status', USER_STATUSES);
export const clientLifecycle = pgEnum('client_lifecycle', CLIENT_LIFECYCLES);
export const onboardingStep = pgEnum('onboarding_step', ONBOARDING_STEPS);
export const stepStatus = pgEnum('step_status', STEP_STATUSES);
export const documentStatus = pgEnum('document_status', DOCUMENT_STATUSES);
export const documentSource = pgEnum('document_source', DOCUMENT_SOURCES);
export const documentCategory = pgEnum('document_category', DOCUMENT_CATEGORIES);
export const calcStatus = pgEnum('calc_status', CALC_STATUSES);
export const paymentStatus = pgEnum('payment_status', PAYMENT_STATUSES);
export const paymentItemKind = pgEnum('payment_item_kind', PAYMENT_ITEM_KINDS);
export const requestStatus = pgEnum('request_status', REQUEST_STATUSES);
export const subscriptionStatus = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const notificationKind = pgEnum('notification_kind', NOTIFICATION_KINDS);
export const legalDocType = pgEnum('legal_doc_type', LEGAL_DOC_TYPES);
export const taxStatus = pgEnum('tax_status', TAX_STATUSES);
export const appointmentStatus = pgEnum('appointment_status', APPOINTMENT_STATUSES);

// ---------- 5.1 identity ----------
export const users = pgTable('users', {
  id: id(),
  /** Stored normalised (trim + lower-case); unique. (SPEC says citext – same effect, see §24.) */
  email: text().notNull().unique(),
  emailVerifiedAt: ts(),
  passwordHash: text(),
  role: userRole().notNull(),
  status: userStatus().notNull().default('active'),
  displayName: text(),
  googleSub: text().unique(),
  appleSub: text().unique(),
  totpSecretEnc: text(),
  totpPendingEnc: text(),
  totpEnabledAt: ts(),
  recoveryCodes: jsonb().$type<{ hash: string; usedAt: string | null }[]>(),
  failedLogins: integer().notNull().default(0),
  /** Last failed password: the failure counter starts over after an hour without failures. */
  lastFailedLoginAt: ts(),
  lockedUntil: ts(),
  /** Last accepted TOTP time step (replay protection, SPEC §4.1). */
  totpLastStep: bigint({ mode: 'number' }),
  /** Consecutive wrong TOTP / recovery codes (independent of IP); 5 → 15 min lock. */
  totpFailures: integer().notNull().default(0),
  /** SPEC §27.11 S1: lock set ONLY by wrong TOTP / recovery codes (the password lock never blocks the second factor). */
  totpLockedUntil: ts(),
  lastLoginAt: ts(),
  deletionRequestedAt: ts(),
  deletionDueAt: ts(),
  deletedAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    familyId: uuid().notNull(),
    refreshHash: text().notNull().unique(),
    rotatedAt: ts(),
    revokedAt: ts(),
    expiresAt: ts().notNull(),
    idleExpiresAt: ts().notNull(),
    lastUsedAt: ts().notNull().defaultNow(),
    clientKind: text().$type<'native' | 'web' | 'panel'>().notNull(),
    userAgent: text(),
    ipHmac: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId), index().on(t.familyId)],
);

export const emailCodes = pgTable(
  'email_codes',
  {
    id: id(),
    userId: uuid().references(() => users.id),
    email: text().notNull(),
    purpose: text().$type<'verify_email' | 'password_reset' | 'staff_invite'>().notNull(),
    codeHmac: text().notNull(),
    expiresAt: ts().notNull(),
    attempts: integer().notNull().default(0),
    /** HMAC of the IP that asked for the code: only that address can use up the code's attempts (round 1, 2026-11-19). */
    ipHmac: text(),
    /** Comparisons made from OTHER addresses (own small budget, never touches `attempts`). */
    foreignAttempts: integer().notNull().default(0),
    usedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.email, t.purpose)],
);

/** Single-use MFA challenges: one row per mfaToken (jti), consumed on success, dead after 5 failures. */
export const mfaChallenges = pgTable('mfa_challenges', {
  jti: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  failures: integer().notNull().default(0),
  consumedAt: ts(),
  expiresAt: ts().notNull(),
  createdAt: createdAt(),
});

export const pushTokens = pgTable('push_tokens', {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  token: text().notNull().unique(),
  platform: text().$type<'android' | 'ios' | 'web'>().notNull(),
  /** HMAC of the app installation id: a token moves to another account only from the same installation. */
  installationHash: text(),
  lastSeenAt: ts().notNull().defaultNow(),
  disabledAt: ts(),
  createdAt: createdAt(),
});

export const notificationPrefs = pgTable(
  'notification_prefs',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    kind: notificationKind().notNull(),
    push: boolean().notNull(),
    email: boolean().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

export const legalDocuments = pgTable(
  'legal_documents',
  {
    id: id(),
    docType: legalDocType().notNull(),
    version: text().notNull(),
    title: text().notNull(),
    sourcePath: text().notNull(),
    sha256: text().notNull(),
    effectiveFrom: day(),
    requiresReconsent: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.docType, t.version)],
);

export const consents = pgTable(
  'consents',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    docType: legalDocType().notNull(),
    version: text().notNull(),
    acceptedAt: ts().notNull().defaultNow(),
    /** SHA-256 of the exact text the user accepted (filled with their data where applicable). */
    textSha256: text(),
    ipHmac: text(),
    userAgent: text(),
    withdrawnAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

// ---------- 5.2 accountants ----------
export const accountants = pgTable('accountants', {
  id: id(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => users.id),
  displayName: text().notNull(),
  firstName: text().notNull(),
  title: text().notNull().default('Mérlegképes könyvelő'),
  registrationNumber: text(),
  adoazonositoJelEnc: text(),
  avatarKey: text().notNull().default('karakter_1_lapos'),
  signatureSvgPath: text(),
  nameWith: text(),
  nameFrom: text(),
  nameOnto: text(),
  nameAcc: text(),
  /** SPEC §28.K.15: no answer-time promise (old defaults that promised an answer time are replaced by the data step). */
  responseTimeText: text().notNull().default(ACCOUNTANT_RESPONSE_TIME_DEFAULT),
  appointmentsEnabled: boolean().notNull().default(false),
  monthlyStatementRequest: boolean().notNull().default(true),
  capacity: integer().notNull().default(150),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- 5.11 referral (before clients: FK) ----------
export const referralCodes = pgTable('referral_codes', {
  id: id(),
  code: text().notNull().unique(),
  ownerClientId: uuid(),
  campaign: text(),
  note: text(),
  active: boolean().notNull().default(true),
  createdBy: uuid(),
  createdAt: createdAt(),
});

// ---------- 5.3 clients ----------
export const clients = pgTable(
  'clients',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .unique()
      .references(() => users.id),
    accountantId: uuid().references(() => accountants.id),
    lifecycle: clientLifecycle().notNull().default('bekotes_alatt'),
    /** Created by our own test scripts (utm source *proba*): excluded from the admin KPIs. */
    isTest: boolean().notNull().default(false),
    firstName: text().notNull(),
    lastName: text().notNull(),
    birthName: text(),
    phoneEnc: text(),
    adoazonositoJelEnc: text(),
    adoazonositoHmac: text(),
    adoazonositoLast3: text(),
    adoszam: text(),
    evNyilvantartasiSzam: text(),
    addressZip: text(),
    addressCity: text(),
    addressLine: text(),
    hqMunicipality: text(),
    activityText: text(),
    activityAnswer: text().$type<'kiskereskedelem' | 'lista80' | 'egyeb'>(),
    activityCode: text(),
    evSince: day(),
    previousAccountant: text(),
    hasSeparateBusinessAccount: boolean(),
    referralCodeId: uuid().references(() => referralCodes.id),
    attribution: jsonb().$type<Record<string, string>>(),
    nextFlags: jsonb().$type<string[]>(),
    personalReferralCode: text().unique(),
    alairtPdfAllowed: boolean().notNull().default(false),
    /** SPEC §26.1.1 "Van már egyéni vállalkozásod?" – null = not answered yet ('van' path rules apply). */
    businessStatus: text().$type<(typeof BUSINESS_STATUSES)[number]>(),
    /** SPEC §27.2: last change of the branch answer (the 30-second "Visszavonom" window). */
    businessStatusChangedAt: ts(),
    /** SPEC §27.11 S9: an admin blocked the account (users.status 'disabled'); when and why (staff text, never shown to the client). */
    disabledAt: ts(),
    disabledReason: text(),
    /** SPEC §28.K.5: the accounting service is locked for an unpaid fee (null = open). */
    serviceLock: jsonb().$type<{ reasons: ('havidij' | 'eves_zaras' | 'kezi')[]; since: string; amountHuf: number } | null>(),
    /** SPEC §28.K.9: "Most nem tudom" – the accountant fills the adószám later from ONYA. */
    adoszamPending: boolean().notNull().default(false),
    /** SPEC §28.K.11: "Hogyan adózol most?" */
    taxRegimeAnswer: text().$type<(typeof TAX_REGIME_ANSWERS)[number]>(),
    /** SPEC §28.K.12 (6): personal forwarding address <code>@<MAILBOX_DOMAIN> and the ≤ 3 extra senders. */
    mailboxCode: text().unique(),
    mailboxSenders: text().array().notNull().default(sql`'{}'::text[]`),
    // ---- SPEC §29.12 (0018_k29.sql) ----
    /** §29.10 guided first run (null = never started). */
    guided: jsonb().$type<{ welcomeSeenAt?: string | null; pausedAt?: string | null; finishedAt?: string | null; lastKey?: string | null; doneSeenAt?: string | null } | null>(),
    /** §29.4.4: where the business identity came from ('nav' lookup or 'kezi'). */
    businessIdentitySource: text().$type<'nav' | 'kezi'>(),
    /** §29.4.4: the confirmed business identity (EV name, seat, ÁFA answer) – the fee invoice buyer name. */
    businessIdentity: jsonb().$type<{
      name: string;
      seat: { zip: string; city: string; line: string } | null;
      alanyiMentes: 'igen' | 'nem' | 'nem_tudom';
      afaWarning: boolean;
      demo: boolean;
      savedAt: string;
      taxStatus?: string;
    } | null>(),
    /** §29.9.4: the admin's manual lock ('zarolva') or grace ('feloldva' until a day). */
    serviceLockManual: jsonb().$type<{ mode: 'zarolva' | 'feloldva'; until: string | null; reason: string; by: string; at: string } | null>(),
    /** §29.9.5: termination (felmondás). */
    terminated: jsonb().$type<{ kind: string; subReason?: string | null; reason: string; noticeAt: string; effectiveOn: string; by: string; appliedAt?: string | null } | null>(),
    /** §29.9.6: anonymised (never a hard delete). */
    anonymizedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.accountantId),
    index().on(t.adoazonositoHmac),
    check('clients_business_status_chk', sql`${t.businessStatus} in ${inList(BUSINESS_STATUSES)}`),
    check('clients_tax_regime_answer_chk', sql`${t.taxRegimeAnswer} in ${inList(TAX_REGIME_ANSWERS)}`),
  ],
);

export const clientTaxProfiles = pgTable(
  'client_tax_profiles',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    year: integer().notNull(),
    costRatio: smallint().notNull(),
    costRatioSource: text().$type<'ugyfel_javaslat' | 'konyvelo_megerositette'>().notNull().default('ugyfel_javaslat'),
    status: taxStatus().notNull().default('fofoglalkozasu'),
    guaranteedMinimum: boolean().notNull().default(false),
    retail: boolean().notNull().default(false),
    atalanyFrom: day(),
    /** SPEC §32: a KATA profile also stores its free months here (KATA_EXEMPT_KINDS, + reportedOn); the átalány engine reads them as 'kieso'. */
    insuranceBreaks: jsonb().$type<{ from: string; to: string; kind: 'szunetel' | 'kieso' | KataExemptKind; reportedOn?: string | null }[]>().notNull().default([]),
    hipaMethod: text().$type<'savos' | 'altalanos' | 'nincs'>().notNull().default('savos'),
    hipaRatePct: numeric({ precision: 4, scale: 2 }).notNull().default('2.00'),
    hipaAccountNumber: text(),
    priorOverrides: jsonb().$type<{ throughQuarter: 1 | 2 | 3; priorActualBaseSum: number; priorSzjaAdvanceSum: number }>(),
    /** SZJA allowances the engine does not model (családi, 25 év alatti, anyák, első házasok…): they raise a warning. */
    allowances: jsonb().$type<{ kind: 'csaladi' | 'fiatal_25' | 'anyak' | 'egyeb'; note?: string }[]>(),
    /** SPEC §28.K.11: átalányadó (default) or KATA; the cost ratio stays stored for a later switch. */
    regime: text().$type<(typeof TAX_REGIMES)[number]>().notNull().default('atalany'),
    kataFrom: day(),
    kataTo: day(),
    /** SPEC §32: 'regi' = Kata tv. KATA, 'uj' = the T/928 new KATA (2027-, if enacted); null = not KATA / not set. */
    kataVariant: text().$type<'regi' | 'uj'>(),
    /** SPEC §32: főfoglalkozású (the old KATA requires it; the new one has two amounts). */
    kataFofoglalkozasu: boolean(),
    /** SPEC §32.B: the previous year's HIPA (the sávos advance = last year's tax, Htv. 39/A. § (9)) and where it came from. */
    hipaPriorYearHuf: integer(),
    hipaPriorYearSource: text().$type<'eves_zaras' | 'atvetel' | 'kezi'>(),
    /** Javító kör 11-21 (kritika 2.1): the accountant's decision of the next year's mode, recorded in December (when, who filed it). */
    regimeDecision: jsonb().$type<{ decidedAt: string; decidedBy: string; filedOn: string | null; filedBy: 'konyvelo' | 'ugyfel' | 'nem_kell' | null; note: string | null }>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.clientId, t.year),
    check('client_tax_profiles_cost_ratio_chk', sql`${t.costRatio} in (45, 50, 80, 90)`),
    check('client_tax_profiles_regime_chk', sql`${t.regime} in ${inList(TAX_REGIMES)}`),
    check('client_tax_profiles_kata_variant_chk', sql`${t.kataVariant} in ('regi', 'uj')`),
  ],
);

export const internalNotes = pgTable('internal_notes', {
  id: id(),
  clientId: uuid()
    .notNull()
    .references(() => clients.id),
  authorUserId: uuid()
    .notNull()
    .references(() => users.id),
  body: text().notNull(),
  pinned: boolean().notNull().default(false),
  deletedAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- 5.4 onboarding, KYC, NAV credentials ----------
export const onboardingSteps = pgTable(
  'onboarding_steps',
  {
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    step: onboardingStep().notNull(),
    status: stepStatus().notNull().default('nincs_kezdve'),
    data: jsonb().$type<Record<string, unknown>>(),
    note: text(),
    updatedAt: updatedAt(),
    completedAt: ts(),
    reviewedBy: uuid(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.step] })],
);

export const kycRecords = pgTable(
  'kyc_records',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    status: text().$type<'bekuldve' | 'elfogadva' | 'hianyos'>().notNull().default('bekuldve'),
    dataEnc: text().notNull(),
    // Plaintext: only the non-sensitive flags. pep/pepDetails live encrypted in declarationsEnc (older rows are
    // fixed at start-up by services/kyc.ts encryptLegacyPep).
    declarations: jsonb().$type<{ ownBehalf: boolean; pep?: boolean; pepDetails?: string; truthful: boolean; changeDuty: boolean; signedAt: string }>().notNull(),
    declarationsEnc: text(),
    // Missing sides (passport back, address card back) are omitted – older rows may still hold '' for them.
    files: jsonb().$type<{ idFront: string; idBack?: string; addressFront: string; addressBack?: string }>().notNull(),
    submittedAt: ts().notNull().defaultNow(),
    reviewedBy: uuid(),
    reviewedAt: ts(),
    reviewNote: text(),
    relationshipEndedAt: ts(),
    retentionUntil: day(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId)],
);

export const navCredentials = pgTable('nav_credentials', {
  id: id(),
  clientId: uuid()
    .notNull()
    .unique()
    .references(() => clients.id),
  taxNumber: char({ length: 8 }).notNull(),
  secretEnc: text().notNull(),
  loginHint: text().notNull(),
  environment: text().$type<'demo' | 'test' | 'prod'>().notNull(),
  status: text().$type<'nincs_ellenorizve' | 'rendben' | 'hibas'>().notNull().default('nincs_ellenorizve'),
  lastTestAt: ts(),
  lastTestError: text(),
  lastSyncAt: ts(),
  lastSyncStatus: text(),
  lastSyncError: text(),
  syncCursorInsDate: ts(),
  savedBy: uuid(),
  savedAt: ts().notNull().defaultNow(),
  createdAt: createdAt(),
});

export const navSyncRuns = pgTable(
  'nav_sync_runs',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    startedAt: ts().notNull().defaultNow(),
    finishedAt: ts(),
    status: text().$type<'fut' | 'ok' | 'hiba'>().notNull().default('fut'),
    digestsSeen: integer().notNull().default(0),
    invoicesNew: integer().notNull().default(0),
    errorCode: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId, t.startedAt)],
);

// ---------- 5.13 files (before documents: FK) ----------
export const files = pgTable(
  'files',
  {
    id: id(),
    ownerClientId: uuid().references(() => clients.id),
    kind: text()
      .$type<'dokumentum' | 'kyc' | 'uzenet_csatolmany' | 'nav_xml' | 'generalt_pdf' | 'dijszamla' | 'gdpr_export' | 'alairas' | 'thumb'>()
      .notNull(),
    mime: text().notNull(),
    sizeBytes: integer().notNull(),
    sha256: text().notNull(),
    keyId: smallint().notNull(),
    storagePath: text().notNull(),
    displayName: text().notNull(),
    createdBy: uuid(),
    retentionUntil: day(),
    legalHold: boolean().notNull().default(false),
    deletedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.ownerClientId)],
);

// ---------- 5.5 dossier, documents, NAV invoices, revenue ----------
export const dossiers = pgTable(
  'dossiers',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    month: char({ length: 7 }).notNull(),
    reviewedAt: ts(),
    reviewedBy: uuid(),
    summaryNote: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.clientId, t.month)],
);

export const documents = pgTable(
  'documents',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    dossierMonth: char({ length: 7 }).notNull(),
    source: documentSource().notNull(),
    category: documentCategory().notNull(),
    title: text().notNull(),
    status: documentStatus().notNull().default('feltoltve'),
    statusChangedAt: ts().notNull().defaultNow(),
    visibility: text().$type<'kozos' | 'csak_konyvelo'>().notNull().default('kozos'),
    documentDate: day(),
    amountHuf: huf(),
    currentVersionId: uuid(),
    clientNote: text(),
    accountantComment: text(),
    relatedPeriodId: uuid(),
    relatedRequestId: uuid(),
    createdBy: uuid(),
    deletedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId, t.dossierMonth)],
);

export const documentVersions = pgTable(
  'document_versions',
  {
    id: id(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id),
    versionNo: integer().notNull(),
    fileId: uuid()
      .notNull()
      .references(() => files.id),
    pageCount: integer().notNull().default(1),
    thumbFileId: uuid(),
    uploadedBy: uuid(),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.documentId, t.versionNo)],
);

export const documentStatusHistory = pgTable(
  'document_status_history',
  {
    id: id(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id),
    fromStatus: documentStatus(),
    toStatus: documentStatus().notNull(),
    changedBy: uuid(),
    changedAt: ts().notNull().defaultNow(),
    note: text(),
  },
  (t) => [index().on(t.documentId)],
);

export const navInvoices = pgTable(
  'nav_invoices',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    invoiceNumber: text().notNull(),
    batchIndex: integer(),
    operation: text().$type<'CREATE' | 'MODIFY' | 'STORNO'>().notNull(),
    category: text().notNull(),
    issueDate: day().notNull(),
    deliveryDate: day(),
    paymentDate: day(),
    paymentMethod: text(),
    currency: text().notNull().default('HUF'),
    netHuf: huf().notNull(),
    vatHuf: huf().notNull(),
    grossHuf: huf().notNull(),
    customerName: text(),
    customerTaxNumber: text(),
    originalInvoiceNumber: text(),
    modificationIndex: integer(),
    modKey: integer().notNull().default(0),
    insDate: ts(),
    transactionId: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    rawXmlFileId: uuid(),
    dossierMonth: char({ length: 7 }).notNull(),
    status: documentStatus().notNull().default('feltoltve'),
    statusChangedAt: ts().notNull().defaultNow(),
    demo: boolean().notNull().default(false),
    /** SPEC §28.2.1: null = not decided yet; else sent / folded in / the skip reason. */
    notifyState: text().$type<(typeof INVOICE_NOTIFY_STATES)[number]>(),
    notifiedAt: ts(),
    notificationId: uuid(),
    /** SPEC §28.K.11: NAV customerVatStatus (DOMESTIC / PRIVATE_PERSON / OTHER). */
    customerVatStatus: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex().on(t.clientId, t.invoiceNumber, t.modKey, t.operation),
    index().on(t.clientId, t.dossierMonth),
    index('nav_invoices_notify_pending_idx').on(t.clientId).where(sql`notify_state is null`),
    check('nav_invoices_notify_state_chk', sql`${t.notifyState} in ${inList(INVOICE_NOTIFY_STATES)}`),
  ],
);

export const revenueItems = pgTable(
  'revenue_items',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    source: text().$type<'nav_szamla' | 'kezi'>().notNull(),
    navInvoiceId: uuid(),
    documentId: uuid(),
    receivedOn: day().notNull(),
    receivedOnEstimated: boolean().notNull().default(false),
    deliveryDate: day().notNull(),
    amountHuf: huf().notNull(),
    description: text().notNull(),
    countsForAtalany: boolean().notNull().default(true),
    countsForAfaLimit: boolean().notNull().default(true),
    excludedReason: text(),
    createdBy: uuid(),
    deletedAt: ts(),
    /** SPEC §28.K.11: who paid (from the NAV customerVatStatus); KATA clients get the business-customer warning. */
    payerKind: text().$type<(typeof PAYER_KINDS)[number]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.clientId, t.receivedOn),
    uniqueIndex('revenue_items_nav_invoice_uq').on(t.navInvoiceId),
    check('revenue_items_payer_kind_chk', sql`${t.payerKind} in ${inList(PAYER_KINDS)}`),
  ],
);

// ---------- 5.6 tax periods and payments ----------
export const taxPeriods = pgTable(
  'tax_periods',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    /** SPEC §32.B: + 'eves_szja' | 'kata_eves' | 'hipa_eves' | 'onellenorzes' (text, no DB enum; TAX_PERIOD_KINDS). */
    kind: text().$type<'negyedev' | 'hipa' | 'kata' | 'eves_szja' | 'kata_eves' | 'hipa_eves' | 'onellenorzes'>().notNull(),
    periodKey: text().notNull(),
    year: integer().notNull(),
    quarter: integer(),
    dueDate: day().notNull(),
    calcStatus: calcStatus().notNull().default('nincs'),
    paymentStatus: paymentStatus().notNull().default('nincs_fizetendo'),
    filingStatus: text().$type<'nincs' | 'beadva'>().notNull().default('nincs'),
    approvedCalculationId: uuid(),
    latestCalculationId: uuid(),
    filedAt: ts(),
    filedOn: day(),
    filedBy: uuid(),
    filingForm: text(),
    returnDocumentId: uuid(),
    receiptDocumentId: uuid(),
    /** SPEC §32: hidden instead of deleted (a KATA year's átalány quarters: 'kata_ev'; a month no longer KATA: 'nem_kata'). */
    hiddenAt: ts(),
    hiddenReason: text(),
    /** SPEC §32: a free KATA month (Kata tv. 7. § (8)–(9)) – the reason kind. */
    exemptReason: text(),
    /** SPEC §32: made after its due date (before the app): no reminder, the client sees it only once the accountant verified it. */
    backfilled: boolean().notNull().default(false),
    /** SPEC §32.B: the NAV iktatószám of the filing. */
    filingRef: text(),
    /** SPEC §32.B: the tax_corrections row of an 'onellenorzes' payment period. */
    correctionId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.clientId, t.periodKey), index('tax_periods_kind_due_idx').on(t.kind, t.dueDate)],
);

export const taxCalculations = pgTable(
  'tax_calculations',
  {
    id: id(),
    taxPeriodId: uuid()
      .notNull()
      .references(() => taxPeriods.id),
    version: integer().notNull(),
    engineVersion: text().notNull(),
    rulesVersion: text().notNull(),
    asOf: day().notNull(),
    input: jsonb().notNull(),
    result: jsonb().notNull(),
    overrides: jsonb().$type<{ tbHuf?: number; szochoHuf?: number; szjaAdvanceHuf?: number; reason: string } | null>(),
    letterText: text(),
    calculatedBy: uuid(),
    approvedBy: uuid(),
    approvedAt: ts(),
    publishedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.taxPeriodId, t.version)],
);

export const taxPaymentItems = pgTable(
  'tax_payment_items',
  {
    id: id(),
    taxPeriodId: uuid()
      .notNull()
      .references(() => taxPeriods.id),
    calculationId: uuid(),
    kind: paymentItemKind().notNull(),
    label: text().notNull(),
    sublabel: text(),
    amountHuf: huf().notNull(),
    dueDate: day().notNull(),
    accountName: text().notNull(),
    accountNumber: text().notNull(),
    iban: text().notNull(),
    reference: text().notNull(),
    markedPaidAt: ts(),
    markedPaidOn: day(),
    verifiedAt: ts(),
    verifiedBy: uuid(),
    verification: text().$type<'rendben' | 'elteres'>(),
    verificationNote: text(),
    voidedAt: ts(),
    /** SPEC §32: NAV adónem (288 kata, 103 szja, 406 TB, 258 szocho; HIPA: null). */
    adonem: text(),
    /** SPEC §32.B: the folyószámla reconciliation that verified the item. */
    reconciliationId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.taxPeriodId)],
);

export const deadlines = pgTable(
  'deadlines',
  {
    id: id(),
    clientId: uuid().references(() => clients.id),
    kind: text().$type<'befizetes' | 'bevallas' | 'keres' | 'idopont' | 'egyeb'>().notNull(),
    title: text().notNull(),
    dueDate: day().notNull(),
    periodKey: text(),
    relatedPeriodId: uuid(),
    relatedRequestId: uuid(),
    relatedAppointmentId: uuid(),
    createdBy: uuid(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId, t.dueDate)],
);

// ---------- 5.7 messages, requests, certificates ----------
export const requests = pgTable(
  'requests',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    direction: text().$type<'konyvelotol' | 'ugyfeltol'>().notNull(),
    type: text().notNull(),
    title: text().notNull(),
    body: text().notNull().default(''),
    dossierMonth: char({ length: 7 }),
    dueDate: day(),
    status: requestStatus().notNull().default('nyitott'),
    resultDocumentId: uuid(),
    createdBy: uuid(),
    completedAt: ts(),
    completedBy: uuid(),
    statusNote: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId, t.status)],
);

export const certificateRequests = pgTable('certificate_requests', {
  requestId: uuid()
    .primaryKey()
    .references(() => requests.id),
  certificateType: text().$type<'jovedelemigazolas' | 'nullas_igazolas' | 'koztartozasmentes_igazolas'>().notNull(),
  year: integer(),
  purpose: text().notNull(),
  language: text().$type<'hu' | 'en'>().notNull().default('hu'),
  submittedToNavAt: ts(),
  documentId: uuid(),
  createdAt: createdAt(),
  // ---- SPEC §29.5 F1 (0018_k29.sql; legacy certificate_type values kept, mapped in code) ----
  status: text().notNull().default('beerkezett'),
  userName: text(),
  purposeKind: text(),
  purposeText: text(),
  neededBy: day(),
  paperCopy: boolean().notNull().default(false),
  paperTo: text(),
  paperAddress: text(),
  extended: text(),
  official: text(),
  englishRequested: boolean().notNull().default(false),
  otherText: text(),
  feeChargeId: uuid(),
  rejectedReason: text(),
  iktatoszam: text(),
  komaOutcome: text(),
  komaDate: day(),
  copies: integer().notNull().default(1),
  doneAt: ts(),
  updatedAt: ts(),
});

export const messages = pgTable(
  'messages',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    senderUserId: uuid(),
    /** 'csapat' = service team member (SPEC §26.4). */
    senderRole: text().$type<'client' | 'accountant' | 'system' | 'csapat'>().notNull(),
    kind: text().$type<'szoveg' | 'keres_kartya' | 'rendszer'>().notNull().default('szoveg'),
    body: text().notNull(),
    requestId: uuid(),
    documentId: uuid(),
    readByClientAt: ts(),
    readByAccountantAt: ts(),
    /** SPEC §26.4: a team member read the thread (onboarding clients only). */
    readByTeamAt: ts(),
    deletedAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId, t.createdAt)],
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    messageId: uuid()
      .notNull()
      .references(() => messages.id),
    fileId: uuid()
      .notNull()
      .references(() => files.id),
    displayName: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.fileId] })],
);

export const messageTemplates = pgTable('message_templates', {
  id: id(),
  accountantId: uuid(),
  title: text().notNull(),
  body: text().notNull(),
  sort: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- 5.8 appointments ----------
export const availabilitySlots = pgTable(
  'availability_slots',
  {
    id: id(),
    accountantId: uuid()
      .notNull()
      .references(() => accountants.id),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    channels: text().array().notNull(),
    status: text().$type<'szabad' | 'foglalt' | 'torolve'>().notNull().default('szabad'),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.accountantId, t.startsAt)],
);

export const appointments = pgTable('appointments', {
  id: id(),
  clientId: uuid()
    .notNull()
    .references(() => clients.id),
  accountantId: uuid()
    .notNull()
    .references(() => accountants.id),
  slotId: uuid().references(() => availabilitySlots.id),
  startsAt: ts().notNull(),
  endsAt: ts().notNull(),
  channel: text().$type<'telefon' | 'video'>().notNull(),
  phoneEnc: text(),
  videoLink: text(),
  topic: text(),
  status: appointmentStatus().notNull().default('foglalt'),
  cancelledBy: uuid(),
  note: text(),
  reminder24hAt: ts(),
  reminder1hAt: ts(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- 5.9 subscriptions and SimplePay ----------
export const plans = pgTable('plans', {
  code: text().primaryKey(),
  name: text().notNull(),
  priceHuf: integer().notNull(),
  interval: text().notNull().default('month'),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const cardRegistrations = pgTable('card_registrations', {
  id: id(),
  clientId: uuid()
    .notNull()
    .references(() => clients.id),
  simplepayCardId: bigint({ mode: 'number' }),
  orderRef: text(),
  cardMask: text(),
  cardExpiry: day(),
  tokensUntil: ts(),
  maxAmountHuf: integer().notNull(),
  status: text().$type<'fuggo' | 'aktiv' | 'torolve' | 'lejart'>().notNull().default('fuggo'),
  mode: text().$type<'demo' | 'sandbox' | 'live'>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  clientId: uuid()
    .notNull()
    .unique()
    .references(() => clients.id),
  planCode: text()
    .notNull()
    .references(() => plans.code),
  status: subscriptionStatus().notNull().default('incomplete'),
  currentPeriodStart: day(),
  currentPeriodEnd: day(),
  nextChargeAt: ts(),
  nextRetryAt: ts(),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  canceledAt: ts(),
  failedAttempts: integer().notNull().default(0),
  firstFailedAt: ts(),
  lastFailureCode: text(),
  graceUntil: day(),
  cardRegistrationId: uuid().references(() => cardRegistrations.id),
  renewalNotifiedAt: ts(),
  /** SPEC §29.1.2: a Stripe test-mode subscription is stored as 'sandbox' (payments.mode says 'test'). */
  mode: text().$type<'demo' | 'sandbox' | 'live'>().notNull(),
  // ---- SPEC §29.1.2 (0018_k29.sql) ----
  /** The provider that saved the card charges it (backfill: mode 'demo' → 'demo', else 'simplepay'). */
  provider: text().$type<'stripe' | 'simplepay' | 'demo'>().notNull().default('simplepay'),
  /** The active card of the Stripe / new demo flow (payment_methods). Null = the legacy SimplePay card_registrations. */
  paymentMethodId: uuid(),
  predebitNotifiedFor: day(),
  /** k7c2 (0019): the period (start day) the last pre-debit notice was for – an off-session charge needs it (≥ 3 days before). */
  predebitPeriod: day(),
  suspensionWarnedFor: day(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const paymentTokens = pgTable(
  'payment_tokens',
  {
    id: id(),
    cardRegistrationId: uuid()
      .notNull()
      .references(() => cardRegistrations.id),
    tokenEnc: text().notNull(),
    seq: integer().notNull().default(0),
    status: text().$type<'fuggo' | 'aktiv' | 'felhasznalt' | 'visszavont'>().notNull().default('fuggo'),
    usedAt: ts(),
    usedOrderRef: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.cardRegistrationId)],
);

export const simplepayTransactions = pgTable(
  'simplepay_transactions',
  {
    id: id(),
    orderRef: text().notNull().unique(),
    simplepayTransactionId: bigint({ mode: 'number' }),
    /** 'egyszeri' = a one-off fee charge (SPEC §28.K.1), never the recurring token. */
    kind: text().$type<'regisztracio' | 'ismetlodo' | 'visszaterites' | 'egyszeri'>().notNull(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    subscriptionId: uuid(),
    cardRegistrationId: uuid(),
    tokenId: uuid(),
    amountHuf: integer().notNull(),
    currency: text().notNull().default('HUF'),
    status: text().notNull().default('INIT'),
    periodStart: day(),
    periodEnd: day(),
    errorCodes: text().array(),
    ipnCount: integer().notNull().default(0),
    lastIpnAt: ts(),
    finishedAt: ts(),
    appliedAt: ts(),
    /** An IPN that arrived after the final status was applied (REFUND, REVERSED, a replay …): kept apart, admin alert. */
    afterFinalStatus: text(),
    afterFinalAt: ts(),
    platform: text(),
    mode: text().$type<'demo' | 'sandbox' | 'live'>().notNull(),
    /** The SimplePay payment page of an unfinished registration (KJD1), so a client who stepped back can return to it. */
    paymentUrlEnc: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId), index().on(t.status)],
);

export const feeInvoices = pgTable(
  'fee_invoices',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    simplepayTransactionId: uuid().references(() => simplepayTransactions.id),
    provider: text().$type<'demo' | 'szamlazzhu' | 'billingo'>().notNull(),
    number: text(),
    issuedOn: day(),
    /** Gross amount (negative for a correction invoice of a partial refund). */
    amountHuf: integer().notNull(),
    pdfFileId: uuid(),
    externalId: text(),
    /** SPEC §29.2.3: 'folyamatban' = queued / retrying (query-first). */
    status: text().$type<'folyamatban' | 'kiallitva' | 'hiba' | 'sztorno'>().notNull(),
    error: text(),
    demo: boolean().notNull().default(false),
    createdAt: createdAt(),
    // ---- SPEC §29.2 (0018_k29.sql) ----
    paymentId: uuid(),
    kind: text().$type<'szamla' | 'sztorno' | 'helyesbito'>().notNull().default('szamla'),
    /** rendelesSzam = szamlaKulsoAzon (ADZ-…; +S storno, +H{n} correction). */
    externalKey: text().unique(),
    /** 'teszt' | 'eles' (Számlázz.hu) | 'demo'. */
    providerAccount: text(),
    stornoOf: uuid(),
    attempts: integer().notNull().default(0),
    nextRetryAt: ts(),
    lastErrorCode: text(),
    /** Buyer snapshot at payment time (name, address, adószám, e-mail, first name). */
    buyer: jsonb().$type<FeeInvoiceBuyer | null>(),
    /** The line of the invoice (megnevezes, unit) and the gross amount it was built from. */
    line: jsonb().$type<{ megnevezes: string; unit: 'hó' | 'alkalom'; grossHuf: number } | null>(),
    alertedAt: ts(),
  },
  (t) => [index('fee_invoices_status_next_retry_idx').on(t.status, t.nextRetryAt)],
);
export interface FeeInvoiceBuyer {
  name: string;
  firstName: string;
  zip: string | null;
  city: string | null;
  address: string | null;
  adoszam: string | null;
  email: string;
}

// ---------- 5.10 notifications ----------
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    kind: notificationKind().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    link: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    wantPush: boolean().notNull().default(false),
    wantEmail: boolean().notNull().default(false),
    readAt: ts(),
    pushSentAt: ts(),
    emailSentAt: ts(),
    error: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

// ---------- 5.11 attribution ----------
export const signupAttribution = pgTable('signup_attribution', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id),
  referralCodeId: uuid(),
  utmSource: text(),
  utmMedium: text(),
  utmCampaign: text(),
  utmContent: text(),
  landing: text().$type<'web' | 'android' | 'ios'>(),
  firstSeenAt: ts().notNull().defaultNow(),
});

// ---------- 5.12 content ----------
export const contentTexts = pgTable('content_texts', {
  key: text().primaryKey(),
  body: text().notNull(),
  placeholders: text().array().notNull().default(sql`'{}'::text[]`),
  updatedBy: uuid(),
  updatedAt: updatedAt(),
  version: integer().notNull().default(1),
});

export const faqItems = pgTable('faq_items', {
  id: id(),
  question: text().notNull(),
  answer: text().notNull(),
  sort: integer().notNull().default(0),
  published: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- 5.13 audit, exports, demo outbox, system ----------
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    at: ts().notNull().defaultNow(),
    actorUserId: uuid(),
    actorRole: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    clientId: uuid(),
    ipHmac: text(),
    userAgent: text(),
    requestId: text(),
    details: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [index().on(t.clientId, t.at), index().on(t.actorUserId, t.at), index().on(t.action, t.at)],
);

export const gdprExports = pgTable('gdpr_exports', {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  /** 'folyamatban' = a build is running (claimed); a build that dies is retried at most once, then 'hiba'. */
  status: text().$type<'keszul' | 'folyamatban' | 'kesz' | 'lejart' | 'hiba'>().notNull().default('keszul'),
  fileId: uuid(),
  expiresAt: ts(),
  attempts: integer().notNull().default(0),
  startedAt: ts(),
  error: text(),
  createdAt: createdAt(),
});

export const demoOutbox = pgTable('demo_outbox', {
  id: id(),
  toHash: text().notNull(),
  toDisplay: text().notNull(),
  subject: text().notNull(),
  bodyText: text().notNull(),
  /** Template of the mail (auth_password_reset_code …): the admin outbox masks by template, not by subject. */
  template: text(),
  createdAt: createdAt(),
});

/** Key-value state: worker heartbeat, last run of each job, backup age (not in SPEC §5; §24). */
export const systemState = pgTable('system_state', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: updatedAt(),
});

// ---------- SPEC §26 (owner orders 11-18): team, new business, callbacks ----------
/** A service team member (role 'csapat'): callbacks, new-business registrations, onboarding messages. */
export const teamMembers = pgTable('team_members', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id),
  displayName: text().notNull(),
  firstName: text().notNull(),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** The client's own EV bejelentés, guided by us (SPEC §26.1.5). Never TAJ, anyja neve or birth data. */
export const businessRegistrations = pgTable(
  'business_registrations',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    status: text().$type<(typeof REGISTRATION_STATUSES)[number]>().notNull().default('kitoltes'),
    statusChangedAt: ts().notNull().defaultNow(),
    answers: jsonb().$type<Partial<BusinessRegistrationAnswers>>().notNull().default({}),
    submittedAt: ts(),
    guideOpenedAt: ts(),
    guideProgress: jsonb().$type<string[]>().notNull().default([]),
    filedOn: day(),
    filedChannel: text().$type<(typeof FILING_CHANNELS)[number]>(),
    filedDocumentId: uuid().references(() => documents.id),
    filedAt: ts(),
    checkItems: jsonb().$type<string[]>().notNull().default([]),
    checkedBy: uuid().references(() => users.id),
    checkedAt: ts(),
    fixNote: text(),
    fixRequestedAt: ts(),
    adoszam: text(),
    evNyilvantartasiSzam: text(),
    registeredOn: day(),
    adoszamSetBy: uuid().references(() => users.id),
    doneAt: ts(),
    withdrawnAt: ts(),
    withdrawReason: text().$type<(typeof REGISTRATION_WITHDRAW_REASONS)[number]>(),
    withdrawNote: text(),
    assignedUserId: uuid().references(() => users.id),
    staffNote: text(),
    reminderCount: smallint().notNull().default(0),
    lastReminderAt: ts(),
    /** SPEC §27.3: 'onallo' = the client files with the guide, 'segitett' = our accountant files as meghatalmazott. */
    mode: text().$type<(typeof REGISTRATION_MODES)[number]>().notNull().default('onallo'),
    /** SPEC §27.4.4 S12: kamarai regisztráció (registered/filed day + 5 working days), the client's tick, reminders sent. */
    chamberDueOn: day(),
    chamberDoneAt: ts(),
    chamberReminders: smallint().notNull().default(0),
    /** SPEC §28.K.11 / §28.K.13: "Hogyan szeretnél adózni?" of the new-business kérdőív. */
    taxRegime: text().$type<(typeof TAX_REGIMES)[number]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('business_registrations_open_client_uq').on(t.clientId).where(sql`status in ('kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve')`),
    index().on(t.status, t.statusChangedAt),
    check('business_registrations_status_chk', sql`${t.status} in ${inList(REGISTRATION_STATUSES)}`),
    check('business_registrations_channel_chk', sql`${t.filedChannel} in ${inList(FILING_CHANNELS)}`),
    check('business_registrations_withdraw_reason_chk', sql`${t.withdrawReason} in ${inList(REGISTRATION_WITHDRAW_REASONS)}`),
    check('business_registrations_mode_chk', sql`${t.mode} in ${inList(REGISTRATION_MODES)}`),
  ],
);

/** "Kérj visszahívást" (SPEC §26.2): replaces appointment booking. */
export const callbackRequests = pgTable(
  'callback_requests',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    createdByUserId: uuid(),
    createdByRole: text().$type<'client' | 'csapat' | 'admin' | 'accountant' | 'system'>().notNull(),
    status: text().$type<(typeof CALLBACK_STATUSES)[number]>().notNull().default('uj'),
    topic: text().$type<(typeof CALLBACK_TOPICS)[number]>().notNull(),
    source: text().$type<(typeof CALLBACK_SOURCES)[number]>().notNull(),
    callWindow: text().$type<(typeof CALLBACK_WINDOWS)[number]>().notNull().default('barmikor'),
    note: text(),
    /** APP_DATA_KEY (AAD 'callback_requests.phone'); null only for a legacy row without any number. */
    phoneEnc: text(),
    phoneMasked: text(),
    needsNewPhone: boolean().notNull().default(false),
    targetAt: ts().notNull(),
    dueAt: ts().notNull(),
    assignedUserId: uuid().references(() => users.id),
    assignedAt: ts(),
    callingNowUntil: ts(),
    attempts: integer().notNull().default(0),
    failedAttempts: integer().notNull().default(0),
    lastAttemptAt: ts(),
    lastOutcome: text().$type<(typeof CALLBACK_ATTEMPT_OUTCOMES)[number]>(),
    nextAttemptAfter: ts(),
    internalNote: text(),
    summaryForClient: text(),
    summaryMessageId: uuid(),
    closedAt: ts(),
    closedBy: uuid(),
    closedReason: text().$type<(typeof CALLBACK_CLOSE_REASONS)[number]>(),
    overdueNotifiedAt: ts(),
    legacyAppointmentId: uuid()
      .unique()
      .references(() => appointments.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('callback_requests_open_client_uq').on(t.clientId).where(sql`status in ('uj', 'folyamatban')`),
    index().on(t.status, t.dueAt),
    index().on(t.assignedUserId, t.status),
    index().on(t.clientId, t.createdAt),
    check('callback_requests_status_chk', sql`${t.status} in ${inList(CALLBACK_STATUSES)}`),
    check('callback_requests_topic_chk', sql`${t.topic} in ${inList(CALLBACK_TOPICS)}`),
    check('callback_requests_source_chk', sql`${t.source} in ${inList(CALLBACK_SOURCES)}`),
    check('callback_requests_window_chk', sql`${t.callWindow} in ${inList(CALLBACK_WINDOWS)}`),
    check('callback_requests_created_by_role_chk', sql`${t.createdByRole} in ('client', 'csapat', 'admin', 'accountant', 'system')`),
    check('callback_requests_last_outcome_chk', sql`${t.lastOutcome} in ${inList(CALLBACK_ATTEMPT_OUTCOMES)}`),
    check('callback_requests_closed_reason_chk', sql`${t.closedReason} in ${inList(CALLBACK_CLOSE_REASONS)}`),
    check('callback_requests_note_len_chk', sql`char_length(${t.note}) <= 500`),
  ],
);

export const callbackAttempts = pgTable(
  'callback_attempts',
  {
    id: id(),
    callbackId: uuid()
      .notNull()
      .references(() => callbackRequests.id),
    byUserId: uuid()
      .notNull()
      .references(() => users.id),
    at: ts().notNull().defaultNow(),
    outcome: text().$type<(typeof CALLBACK_ATTEMPT_OUTCOMES)[number]>().notNull(),
    note: text(),
  },
  (t) => [index().on(t.callbackId, t.at), check('callback_attempts_outcome_chk', sql`${t.outcome} in ${inList(CALLBACK_ATTEMPT_OUTCOMES)}`)],
);

/**
 * SPEC §27.3 "Intézzük helyetted": the client asked us to file the UJEGYKE meghatalmazás (and, kind
 * 'vallalkozas_bejelentes', the EV bejelentés) for him. Our accountant acts ONLY as the client's registered
 * meghatalmazott with his own KAÜ login; no column ever holds a client's Ügyfélkapu+/DÁP login data.
 */
const ASSIST_OPEN_SQL = sql.raw(`status in ('dijra_var', 'visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve')`);
export const assistRequests = pgTable(
  'assist_requests',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    kind: text().$type<(typeof ASSIST_KINDS)[number]>().notNull(),
    status: text().$type<(typeof ASSIST_STATUSES)[number]>().notNull().default('visszahivas_kerve'),
    statusChangedAt: ts().notNull().defaultNow(),
    callbackId: uuid().references(() => callbackRequests.id),
    registrationId: uuid().references(() => businessRegistrations.id),
    assignedUserId: uuid().references(() => users.id),
    createdByRole: text().$type<'client' | 'csapat' | 'admin' | 'accountant' | 'system'>().notNull(),
    createdByUserId: uuid(),
    agreedAt: ts(),
    agreedBy: uuid().references(() => users.id),
    ujegykeFiledAt: ts(),
    ujegykeFiledBy: uuid().references(() => users.id),
    ujegykeJogcim: text().$type<(typeof ASSIST_JOGCIMEK)[number]>(),
    approvalDueOn: day(),
    approvalExpiresAt: ts(),
    approvalReminders: smallint().notNull().default(0),
    lastReminderAt: ts(),
    staffAlertedAt: ts(),
    expiredCount: smallint().notNull().default(0),
    clientApprovedAt: ts(),
    mhLiveAt: ts(),
    mhVerifiedBy: uuid().references(() => users.id),
    consentAt: ts(),
    consentHash: text(),
    consentVersion: text(),
    consentSnapshot: jsonb().$type<{ key: string; title: string; lines: string[] }[]>(),
    consentIp: text(),
    consentUserAgent: text(),
    consentValid: boolean().notNull().default(false),
    consentDocumentId: uuid().references(() => documents.id),
    evFiledAt: ts(),
    evFiledBy: uuid().references(() => users.id),
    /** { "<item>": { "at": ISO, "by": userId } } */
    checklist: jsonb().$type<Record<string, { at: string; by: string }>>().notNull().default({}),
    staffNote: text(),
    closedAt: ts(),
    closedBy: uuid().references(() => users.id),
    closedReason: text().$type<(typeof ASSIST_CLOSE_REASONS)[number]>(),
    closeNote: text(),
    /** SPEC §28.5.5: the change kinds' data (NAV fields), its date, the accountant's "Adatok rendben", the final check. */
    changeData: jsonb().$type<ChangeData>(),
    changeEffectiveOn: day(),
    changeReadyAt: ts(),
    changeReadyBy: uuid().references(() => users.id),
    changeDoneAt: ts(),
    changeDoneBy: uuid().references(() => users.id),
    /** { "<key>": { done, at, by } } – the follow-ups offered on change-done. */
    followups: jsonb().$type<Record<string, { done: boolean; at: string | null; by: string | null }>>().notNull().default({}),
    /** SPEC §28.K.1: the prepaid fee of an assisted change. */
    feeChargeId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('assist_requests_open_client_kind_uq').on(t.clientId, t.kind).where(ASSIST_OPEN_SQL),
    index().on(t.status, t.statusChangedAt),
    index().on(t.assignedUserId, t.status),
    index('assist_requests_approval_expires_idx').on(t.approvalExpiresAt).where(sql`status = 'meghatalmazas_bekuldve'`),
    check('assist_requests_kind_chk', sql`${t.kind} in ${inList(ASSIST_KINDS)}`),
    check('assist_requests_status_chk', sql`${t.status} in ${inList(ASSIST_STATUSES)}`),
    check('assist_requests_created_by_role_chk', sql`${t.createdByRole} in ('client', 'csapat', 'admin', 'accountant', 'system')`),
    check('assist_requests_jogcim_chk', sql`${t.ujegykeJogcim} in ${inList(ASSIST_JOGCIMEK)}`),
    check('assist_requests_closed_reason_chk', sql`${t.closedReason} in ${inList(ASSIST_CLOSE_REASONS)}`),
  ],
);


// =====================================================================================================================
// SPEC §28 (migration 0015_ot1119.sql)
// =====================================================================================================================

/** SPEC §28.2.3: per-user push quiet hours and "amounts in push"; a missing row = the defaults. */
export const userNotificationSettings = pgTable(
  'user_notification_settings',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id),
    quietEnabled: boolean().notNull().default(true),
    quietFrom: smallint().notNull().default(20),
    quietTo: smallint().notNull().default(8),
    pushShowAmounts: boolean().notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [check('uns_quiet_from_chk', sql`${t.quietFrom} between 0 and 23`), check('uns_quiet_to_chk', sql`${t.quietTo} between 0 and 23`)],
);

/** SPEC §28.1.4: reserve cache per client and year (recomputed when inputs_hash changes). */
export const reserveYears = pgTable(
  'reserve_years',
  {
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    year: integer().notNull(),
    inputsHash: text().notNull(),
    baseHuf: huf().notNull(),
    totalHuf: huf().notNull(),
    fixedByMonth: jsonb().$type<number[]>().notNull(),
    engineVersion: text().notNull(),
    computedAt: ts().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.year] })],
);

export const revenueReserves = pgTable(
  'revenue_reserves',
  {
    revenueItemId: uuid()
      .primaryKey()
      .references(() => revenueItems.id),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    year: integer().notNull(),
    seq: integer().notNull(),
    rawHuf: huf().notNull(),
    reserveHuf: huf().notNull(),
    szjaHuf: huf().notNull(),
    tbHuf: huf().notNull(),
    szochoHuf: huf().notNull(),
    zone: text().$type<(typeof RESERVE_ZONES)[number]>().notNull(),
    crossesTaxFree: boolean().notNull().default(false),
    estimated: boolean().notNull().default(false),
    computedAt: ts().notNull().defaultNow(),
  },
  (t) => [index().on(t.clientId, t.year, t.seq), check('revenue_reserves_zone_chk', sql`${t.zone} in ${inList(RESERVE_ZONES)}`)],
);

/** SPEC §28.3.2: the client's answers (one row per client and tax year). No names, child birth dates, TAJ or tax ids. */
export const allowanceAnswers = pgTable(
  'allowance_answers',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    year: integer().notNull(),
    gate: text().$type<(typeof ALLOWANCE_GATES)[number]>(),
    answers: jsonb().$type<AllowanceAnswers>(),
    version: integer().notNull().default(0),
    submittedAt: ts(),
    healthConsentAt: ts(),
    healthConsentVersion: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.clientId, t.year), check('allowance_answers_gate_chk', sql`${t.gate} in ${inList(ALLOWANCE_GATES)}`)],
);

/** SPEC §28.3.2: the server's proposal + the accountant's decision per kind. Only 'jovahagyva' + in_year reach the engine. */
export const clientAllowances = pgTable(
  'client_allowances',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    year: integer().notNull(),
    kind: text().$type<(typeof ALLOWANCE_KINDS)[number]>().notNull(),
    status: text().$type<(typeof ALLOWANCE_STATUSES)[number]>().notNull().default('javasolt'),
    months: smallint().array().notNull().default(sql`'{}'::smallint[]`),
    params: jsonb().$type<AllowanceParams>().notNull().default({}),
    paramsPrev: jsonb().$type<{ status: string; months: number[]; params: AllowanceParams; inYear: boolean } | null>(),
    inYear: boolean().notNull().default(true),
    proposal: jsonb().$type<{ months: number[]; params: AllowanceParams; reasons: string[]; warnings?: string[] } | null>(),
    answersVersion: integer().notNull().default(0),
    decidedBy: uuid().references(() => users.id),
    decidedAt: ts(),
    rejectReason: text().$type<(typeof ALLOWANCE_REJECT_REASONS)[number]>(),
    clientText: text(),
    staffNote: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.clientId, t.year, t.kind),
    index('client_allowances_pending_idx').on(t.status).where(sql`status in ('javasolt', 'kerdes')`),
    check('client_allowances_kind_chk', sql`${t.kind} in ${inList(ALLOWANCE_KINDS)}`),
    check('client_allowances_status_chk', sql`${t.status} in ${inList(ALLOWANCE_STATUSES)}`),
    check('client_allowances_reject_reason_chk', sql`${t.rejectReason} in ${inList(ALLOWANCE_REJECT_REASONS)}`),
  ],
);

// =====================================================================================================================
// SPEC §28.K (migration 0016_ot1119_k.sql)
// =====================================================================================================================

/** Admin-editable fee amounts (history in fee_setting_history); confirmed_at null = DEMO (not chargeable in production). */
export const feeSettings = pgTable(
  'fee_settings',
  {
    kind: text().$type<(typeof FEE_KINDS)[number]>().primaryKey(),
    amountHuf: integer().notNull(),
    unit: text().$type<(typeof FEE_UNITS)[number]>().notNull(),
    confirmedAt: ts(),
    confirmedBy: uuid().references(() => users.id),
    effectiveFrom: day(),
    updatedBy: uuid(),
    updatedAt: updatedAt(),
  },
  (t) => [check('fee_settings_kind_chk', sql`${t.kind} in ${inList(FEE_KINDS)}`), check('fee_settings_amount_chk', sql`${t.amountHuf} >= 0`), check('fee_settings_unit_chk', sql`${t.unit} in ${inList(FEE_UNITS)}`)],
);

export const feeSettingHistory = pgTable(
  'fee_setting_history',
  {
    id: id(),
    kind: text().$type<(typeof FEE_KINDS)[number]>().notNull(),
    amountHuf: integer().notNull(),
    confirmed: boolean().notNull().default(false),
    changedBy: uuid(),
    changedAt: ts().notNull().defaultNow(),
    note: text(),
  },
  (t) => [index().on(t.kind, t.changedAt)],
);

/** One-off fees (annual closing, assisted change): paid in advance with a one-time SimplePay payment. */
export const feeCharges = pgTable(
  'fee_charges',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    kind: text().$type<(typeof FEE_KINDS)[number]>().notNull(),
    amountHuf: integer().notNull(),
    /** SPEC §29.1.2: widened (no DB constraint). */
    purpose: jsonb()
      .$type<
        | { type: 'valtozas'; assistId: string }
        | { type: 'eves_zaras'; annualId: string }
        | { type: 'igazolas'; requestId: string }
        | { type: 'megszuntetes'; assistId: string }
        | { type: 'admin'; note: string }
      >()
      .notNull(),
    status: text().$type<(typeof FEE_CHARGE_STATUSES)[number]>().notNull().default('nyitott'),
    dueOn: day(),
    simplepayTransactionId: uuid(),
    feeInvoiceId: uuid(),
    demo: boolean().notNull().default(false),
    waivedBy: uuid(),
    waivedAt: ts(),
    waivedReason: text(),
    refundNote: text(),
    createdBy: uuid(),
    createdAt: createdAt(),
    paidAt: ts(),
    /** SPEC §29.1.2: the successful payments row (Stripe / new demo flow). */
    paymentId: uuid(),
  },
  (t) => [index().on(t.clientId, t.status), check('fee_charges_kind_chk', sql`${t.kind} in ${inList(FEE_KINDS)}`), check('fee_charges_status_chk', sql`${t.status} in ${inList(FEE_CHARGE_STATUSES)}`)],
);

/** SPEC §28.K.2: the monthly check-in "Változott valami?" (period = the month asked about). */
export const monthlyCheckins = pgTable(
  'monthly_checkins',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    period: text().notNull(),
    status: text().$type<(typeof CHECKIN_STATUSES)[number]>().notNull().default('nyitott'),
    answers: jsonb().$type<CheckinItemAnswer[] | null>(),
    openedAt: ts().notNull().defaultNow(),
    answeredAt: ts(),
    reminded: jsonb().$type<Record<string, string>>().notNull().default({}),
  },
  (t) => [uniqueIndex().on(t.clientId, t.period), check('monthly_checkins_status_chk', sql`${t.status} in ${inList(CHECKIN_STATUSES)}`)],
);

export const checkinItems = pgTable(
  'checkin_items',
  {
    id: id(),
    checkinId: uuid()
      .notNull()
      .references(() => monthlyCheckins.id),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    item: text().$type<(typeof CHECKIN_ITEMS)[number]>().notNull(),
    status: text().$type<(typeof CHECKIN_ITEM_STATUSES)[number]>().notNull().default('uj'),
    details: jsonb().$type<CheckinItemAnswer>().notNull(),
    assistId: uuid(),
    feeChargeId: uuid(),
    staffNote: text(),
    clientText: text(),
    decidedBy: uuid(),
    decidedAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId, t.status), check('checkin_items_item_chk', sql`${t.item} in ${inList(CHECKIN_ITEMS)}`), check('checkin_items_status_chk', sql`${t.status} in ${inList(CHECKIN_ITEM_STATUSES)}`)],
);

/** SPEC §28.K.3: the annual closing of one tax year (questionnaire, fee, draft approval, filings). */
export const annualClosings = pgTable(
  'annual_closings',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    taxYear: integer().notNull(),
    regime: text().$type<(typeof TAX_REGIMES)[number]>().notNull().default('atalany'),
    status: text().$type<(typeof ANNUAL_STATUSES)[number]>().notNull().default('nem_indult'),
    answers: jsonb().$type<Partial<AnnualAnswers> | null>(),
    /** APP_DATA_KEY, AAD 'annual_closings.refund_account'. */
    refundAccountEnc: text(),
    feeChargeId: uuid(),
    questionnaireDue: day().notNull(),
    submittedAt: ts(),
    approvedAt: ts(),
    approvalHash: text(),
    filedSzjaAt: ts(),
    filedHipaAt: ts(),
    checklist: jsonb().$type<Record<string, { at: string; by: string }>>().notNull().default({}),
    // ---- SPEC §32.B (0025_ev_ciklus.sql) ----
    amounts: jsonb().$type<AnnualAmounts | null>(),
    amountsSetBy: uuid(),
    amountsSetAt: ts(),
    engineEstimate: jsonb().$type<Record<string, unknown> | null>(),
    letterText: text(),
    approvedSummary: jsonb().$type<AnnualSummary | null>(),
    /** + to pay / − refund (szja), KATA: the különadó. */
    diffHuf: integer(),
    filedSzjaOn: day(),
    szjaFilingRef: text(),
    szjaReturnDocumentId: uuid(),
    szjaReceiptDocumentId: uuid(),
    filedWithoutApprovalNote: text(),
    settlementPeriodId: uuid(),
    refundMode: text().$type<'kiutalas' | 'atvezetes'>(),
    refundExpectedBy: day(),
    refundStatus: text().$type<'var' | 'megerkezett' | 'beszamitva' | 'atvezetve'>(),
    refundReceivedOn: day(),
    refundReceivedHuf: integer(),
    refundMarkedBy: text().$type<'ugyfel' | 'konyvelo'>(),
    refundNote: text(),
    hipaNeeded: boolean().notNull().default(true),
    hipaAmounts: jsonb().$type<{ taxHuf: number | null; advancesHuf: number | null; returnNeeded: boolean | null } | null>(),
    filedHipaOn: day(),
    hipaFilingRef: text(),
    hipaReturnDocumentId: uuid(),
    hipaReceiptDocumentId: uuid(),
    hipaPeriodId: uuid(),
    closedManuallyReason: text(),
    openedManuallyBy: uuid(),
    openedManuallyAt: ts(),
    /** Javító kör 11-21: the draft document sent to the client for approval (the approval hash covers this one). */
    draftDocumentId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.clientId, t.taxYear),
    check('annual_closings_status_chk', sql`${t.status} in ${inList(ANNUAL_STATUSES)}`),
    check('annual_closings_regime_chk', sql`${t.regime} in ${inList(TAX_REGIMES)}`),
    check('annual_closings_refund_mode_chk', sql`${t.refundMode} in ('kiutalas', 'atvezetes')`),
    check('annual_closings_refund_status_chk', sql`${t.refundStatus} in ('var', 'megerkezett', 'beszamitva', 'atvezetve')`),
  ],
);

/** SPEC §32.B: önellenőrzés – the original period stays untouched; the correction is its own row (0025_ev_ciklus.sql). */
export const taxCorrections = pgTable(
  'tax_corrections',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    form: text().$type<CorrectionForm>().notNull(),
    formLabel: text().notNull(),
    subjectKey: text().notNull(),
    subjectLabel: text().notNull(),
    originalPeriodId: uuid(),
    annualClosingId: uuid(),
    seq: integer().notNull().default(1),
    status: text().$type<CorrectionStatus>().notNull().default('tervezet'),
    cause: text().$type<CorrectionCause>().notNull(),
    initiatedBy: text().$type<'konyvelo' | 'ugyfel' | 'nav'>().notNull().default('konyvelo'),
    reason: text().notNull(),
    internalNote: text(),
    diffs: jsonb().$type<CorrectionDiff[]>().notNull().default([]),
    potlekFlags: jsonb().$type<CorrectionPotlekFlags>().notNull().default({}),
    potlekSuggestedHuf: integer(),
    potlekBasis: jsonb().$type<Record<string, unknown> | null>(),
    potlekHuf: integer().notNull().default(0),
    potlekOverrideReason: text(),
    potlekApprovedBy: uuid(),
    potlekApprovedAt: ts(),
    potlekPayer: text().$type<'ugyfel' | 'iroda'>().notNull().default('ugyfel'),
    plannedFiledOn: day(),
    onellbOn: day(),
    needsClientApproval: boolean().notNull().default(true),
    noApprovalNote: text(),
    approvalHash: text(),
    approvedAt: ts(),
    approvedBy: uuid(),
    approvedSummary: jsonb().$type<Record<string, unknown> | null>(),
    filedOn: day(),
    filingRef: text(),
    returnDocumentId: uuid(),
    receiptDocumentId: uuid(),
    filedBy: uuid(),
    paymentPeriodId: uuid(),
    cancelledReason: text(),
    createdBy: uuid().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('tax_corrections_client_idx').on(t.clientId, t.createdAt),
    check('tax_corrections_form_chk', sql`${t.form} in ('2658', 'SZJA', 'KATA', 'HIPA', 'egyeb')`),
    check('tax_corrections_status_chk', sql`${t.status} in ('tervezet', 'ugyfelre_var', 'jovahagyva', 'beadva', 'rendezve', 'visszavonva')`),
    check('tax_corrections_cause_chk', sql`${t.cause} in ('kesoi_irat', 'ugyfel_adat', 'konyvelo_hiba', 'nav_felhivas', 'egyeb')`),
    check('tax_corrections_initiated_by_chk', sql`${t.initiatedBy} in ('konyvelo', 'ugyfel', 'nav')`),
    check('tax_corrections_potlek_payer_chk', sql`${t.potlekPayer} in ('ugyfel', 'iroda')`),
  ],
);

/** SPEC §32.B: the NAV folyószámla (adószámla) check, recorded by hand (M2M later). */
export const accountReconciliations = pgTable(
  'account_reconciliations',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    kind: text().$type<'rendes' | 'nyito'>().notNull().default('rendes'),
    source: text().$type<'kezi' | 'm2m'>().notNull().default('kezi'),
    asOf: day().notNull(),
    periodEnd: day(),
    balances: jsonb().$type<ReconBalanceView[]>().notNull(),
    totalDebtHuf: integer().notNull().default(0),
    totalOverpaymentHuf: integer().notNull().default(0),
    status: text().$type<ReconStatus>().notNull(),
    followUp: text().$type<ReconFollowUp>().notNull().default('nincs'),
    followUpNote: text(),
    resolvedAt: ts(),
    resolvedBy: uuid(),
    verifiedItemIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    seenRows: jsonb().$type<ReconSeenRow[]>().notNull().default([]),
    documentId: uuid(),
    correctionId: uuid(),
    requestId: uuid(),
    note: text(),
    nextCheckOn: day(),
    checkedBy: uuid().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('account_reconciliations_client_idx').on(t.clientId, t.asOf),
    index('account_reconciliations_next_idx').on(t.nextCheckOn),
    check('account_reconciliations_kind_chk', sql`${t.kind} in ('rendes', 'nyito')`),
    check('account_reconciliations_source_chk', sql`${t.source} in ('kezi', 'm2m')`),
    check('account_reconciliations_status_chk', sql`${t.status} in ('rendben', 'hatralek', 'tulfizetes', 'elteres')`),
    check('account_reconciliations_follow_up_chk', sql`${t.followUp} in ('nincs', 'befizetes_kerve', 'atvezetes_kerve', 'kiutalas_kerve', 'eszrevetel', 'onellenorzes')`),
  ],
);

/** SPEC §28.K.7: employees / EFO answer and the accountant's decision. */
export const clientEmployerStatus = pgTable(
  'client_employer_status',
  {
    clientId: uuid()
      .primaryKey()
      .references(() => clients.id),
    answer: text().$type<(typeof EMPLOYER_ANSWERS)[number]>().notNull(),
    answeredAt: ts().notNull().defaultNow(),
    source: text().$type<(typeof EMPLOYER_SOURCES)[number]>().notNull(),
    decision: text().$type<(typeof EMPLOYER_DECISIONS)[number]>(),
    clientText: text(),
    staffNote: text(),
    decidedBy: uuid(),
    decidedAt: ts(),
  },
  (t) => [
    check('client_employer_status_answer_chk', sql`${t.answer} in ${inList(EMPLOYER_ANSWERS)}`),
    check('client_employer_status_source_chk', sql`${t.source} in ${inList(EMPLOYER_SOURCES)}`),
    check('client_employer_status_decision_chk', sql`${t.decision} in ${inList(EMPLOYER_DECISIONS)}`),
  ],
);

/** SPEC §28.K.6: szüneteltetés → the availability fee instead of the plan fee. */
export const subscriptionPauses = pgTable(
  'subscription_pauses',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    from: day().notNull(),
    to: day(),
    feeKind: text().notNull().default('szuneteltetesi_dij'),
    source: text().$type<(typeof PAUSE_SOURCES)[number]>().notNull(),
    createdBy: uuid(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.clientId, t.from), check('subscription_pauses_source_chk', sql`${t.source} in ${inList(PAUSE_SOURCES)}`)],
);

/** SPEC §28.K.12 (3): what the client says he already put aside (self-reported). */
export const reserveMarks = pgTable(
  'reserve_marks',
  {
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    year: integer().notNull(),
    markedHuf: huf().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.year] })],
);

/** SPEC §28.K.12 (6): forwarding mailbox log – no bodies, no full addresses. */
export const mailboxLog = pgTable(
  'mailbox_log',
  {
    id: id(),
    clientId: uuid(),
    receivedAt: ts().notNull().defaultNow(),
    senderMasked: text().notNull(),
    status: text().$type<(typeof MAILBOX_STATUSES)[number]>().notNull(),
    reason: text(),
    attachments: integer().notNull().default(0),
    documentIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
  },
  (t) => [index().on(t.clientId, t.receivedAt), check('mailbox_log_status_chk', sql`${t.status} in ${inList(MAILBOX_STATUSES)}`)],
);

void WORK_KINDS;

// =====================================================================================================================
// SPEC §29 (k7) – migrations 0017_k29_enumok.sql + 0018_k29.sql. Additive only. Written by B1 for A, B, D, F, G.
// =====================================================================================================================

/** k7c2: what a saved-card charge sent to the provider (no secret, no card data – our ids and texts only). */
export interface SavedChargeParams {
  customerRef: string | null;
  paymentMethodRef: string;
  amountHuf: number;
  offSession: boolean;
  returnUrl?: string;
  description: string;
  statementSuffix: string;
  metadata: Record<string, string>;
}

/** §29.1.2: one row per attempt to move money (provider-neutral: stripe | demo; SimplePay keeps its own tables). */
export const payments = pgTable(
  'payments',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    subscriptionId: uuid(),
    feeChargeId: uuid(),
    kind: text().$type<'elso_havi' | 'havi' | 'egyszeri' | 'fizesd_ki' | 'kartya'>().notNull(),
    provider: text().$type<'stripe' | 'demo' | 'simplepay'>().notNull(),
    mode: text().$type<'test' | 'live' | 'demo' | 'sandbox'>().notNull(),
    amountHuf: integer().notNull(),
    periodStart: day(),
    periodEnd: day(),
    status: text()
      .$type<'letrehozva' | 'feldolgozas' | 'hitelesites_kell' | 'sikeres' | 'sikertelen' | 'megszakitva' | 'bizonytalan' | 'duplikalt'>()
      .notNull()
      .default('letrehozva'),
    initiated: text().$type<'ugyfel' | 'utemezo' | 'admin'>().notNull(),
    offSession: boolean().notNull().default(false),
    attemptDay: day(),
    idempotencyKey: text().notNull().unique(),
    stripePaymentIntentId: text().unique(),
    stripeCheckoutSessionId: text().unique(),
    stripeChargeId: text(),
    stripeSetupIntentId: text(),
    /** The hosted page (Checkout URL / DEMO pay page), KJD1-encrypted; handed back while the session is open. */
    hostedUrlEnc: text(),
    hostedExpiresAt: ts(),
    /** 'payment' | 'setup' (card change without money: amount 0, never 'sikeres' for a period). */
    hostedMode: text().$type<'payment' | 'setup'>(),
    /** The hosted payment saves the card (setup_future_usage): first month, Fizesd ki, a first one-off without a card. */
    saveCard: boolean().notNull().default(false),
    platform: text().$type<'app' | 'web'>(),
    /** Short key of the allowed app origin the web client returns to (a = adozz, s = sslip …). */
    returnOrigin: text(),
    /** 'elofizetes' | 'dij' | 'fizesd-ki' – where the result screen goes. */
    cel: text(),
    consentId: uuid(),
    paymentMethodId: uuid(),
    failureCode: text(),
    declineCode: text(),
    cardBrand: text(),
    cardLast4: text(),
    refundedHuf: integer().notNull().default(0),
    refunds: jsonb().$type<{ n: number; amountHuf: number; refundRef: string | null; status: string; reason: string; by: string | null; at: string }[]>().notNull().default([]),
    disputeStatus: text(),
    feeInvoiceId: uuid(),
    /** The admin was told about this row (duplicate, dispute, outside refund) – once. */
    alertedAt: ts(),
    appliedAt: ts(),
    succeededAt: ts(),
    /** k7c2 (0019): the exact parameters of a saved-card charge, re-sent byte-identically with the same idempotency key. */
    chargeParams: jsonb().$type<SavedChargeParams>(),
    /** k7c2 (0019): the automatic refund of a duplicate failed – the reconcile job retries it. */
    refundPendingAt: ts(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('payments_client_created_idx').on(t.clientId, t.createdAt),
    index('payments_open_status_idx').on(t.status).where(sql`status in ('letrehozva', 'feldolgozas', 'bizonytalan', 'hitelesites_kell')`),
    uniqueIndex('payments_one_success_per_period')
      .on(t.subscriptionId, t.periodStart)
      .where(sql`kind in ('elso_havi', 'havi', 'fizesd_ki') and status = 'sikeres'`),
    // k7c2 (0019): at most ONE successful payment per one-off fee (created only when the live data has no duplicate)
    uniqueIndex('payments_one_success_per_fee')
      .on(t.feeChargeId)
      .where(sql`kind = 'egyszeri' and status = 'sikeres' and fee_charge_id is not null`),
    check('payments_kind_chk', sql`${t.kind} in ('elso_havi', 'havi', 'egyszeri', 'fizesd_ki', 'kartya')`),
    check('payments_status_chk', sql`${t.status} in ('letrehozva', 'feldolgozas', 'hitelesites_kell', 'sikeres', 'sikertelen', 'megszakitva', 'bizonytalan', 'duplikalt')`),
    check('payments_amount_chk', sql`${t.amountHuf} >= 0`),
  ],
);

/** §29.1.2: the saved card (brand, last 4, expiry, Stripe ids – never more). */
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    provider: text().$type<'stripe' | 'demo'>().notNull(),
    mode: text().$type<'test' | 'live' | 'demo'>().notNull(),
    stripeCustomerId: text(),
    stripePaymentMethodId: text().unique(),
    brand: text(),
    last4: text(),
    expMonth: smallint(),
    expYear: smallint(),
    status: text().$type<'aktiv' | 'torolve' | 'lejart' | 'lecserelve'>().notNull().default('aktiv'),
    consentId: uuid(),
    createdAt: createdAt(),
    detachedAt: ts(),
  },
  (t) => [index('payment_methods_client_idx').on(t.clientId, t.status), check('payment_methods_status_chk', sql`${t.status} in ('aktiv', 'torolve', 'lejart', 'lecserelve')`)],
);

/** §29.1.2: one Stripe customer per client and mode (test and live are different objects). */
export const stripeCustomers = pgTable(
  'stripe_customers',
  {
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    mode: text().$type<'test' | 'live'>().notNull(),
    customerId: text().notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.mode] })],
);

/** §29.1.8: received webhook events (no payloads stored). */
export const stripeEvents = pgTable('stripe_events', {
  id: text().primaryKey(),
  type: text().notNull(),
  mode: text().$type<'test' | 'live'>().notNull(),
  stripeCreatedAt: ts(),
  receivedAt: ts().notNull().defaultNow(),
  processedAt: ts(),
  /** k7c2 (0019): one delivery works on the event at a time (claimed atomically; a stale claim expires). */
  claimedAt: ts(),
  attempts: integer().notNull().default(0),
  lastError: text(),
});

/** §29.9.4: an own price / discount / free months of one client (revocable, history kept). */
export const clientPriceOverrides = pgTable(
  'client_price_overrides',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    kind: text().$type<'egyedi_ar' | 'kedvezmeny_szazalek' | 'ingyenes_honap'>().notNull(),
    amountHuf: integer(),
    percent: smallint(),
    months: smallint(),
    fromPeriod: day().notNull(),
    untilPeriod: day(),
    reason: text().notNull(),
    createdBy: uuid(),
    createdAt: createdAt(),
    revokedAt: ts(),
    revokedBy: uuid(),
    revokeReason: text(),
  },
  (t) => [index('client_price_overrides_client_idx').on(t.clientId), check('client_price_overrides_kind_chk', sql`${t.kind} in ('egyedi_ar', 'kedvezmeny_szazalek', 'ingyenes_honap')`)],
);

/** §29.9.1: the admin's step-up (TOTP) per session; writes need verified_at ≥ now − 10 min. */
export const adminStepUps = pgTable('admin_step_ups', {
  sessionId: uuid().primaryKey(),
  userId: uuid().notNull(),
  verifiedAt: ts().notNull(),
});

/** §29.9.4: announcements to many clients. */
export const announcements = pgTable('announcements', {
  id: id(),
  title: text().notNull(),
  body: text().notNull(),
  channels: jsonb().$type<{ inApp: boolean; push: boolean; email: boolean }>().notNull(),
  filter: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  recipientCount: integer().notNull().default(0),
  createdBy: uuid(),
  createdAt: createdAt(),
});

/** §29.5: status timeline of a certificate request. */
export const certificateEvents = pgTable(
  'certificate_events',
  {
    id: id(),
    requestId: uuid()
      .notNull()
      .references(() => requests.id),
    status: text().notNull(),
    at: ts().notNull().defaultNow(),
    by: uuid(),
    note: text(),
  },
  (t) => [index('certificate_events_request_idx').on(t.requestId, t.at)],
);

/** §29.6: the accountant checked exactly this data (hash) of an income statement. */
export const incomeStatementApprovals = pgTable(
  'income_statement_approvals',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    fromMonth: char({ length: 7 }).notNull(),
    toMonth: char({ length: 7 }).notNull(),
    dataSha256: text().notNull(),
    approvedBy: uuid().notNull(),
    approvedAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('income_statement_approvals_uq').on(t.clientId, t.fromMonth, t.toMonth, t.dataSha256)],
);

/** §29.8: the client's secret iCal feed (lookup by sha256(token); token_enc so the link can be copied again). */
export const calendarFeeds = pgTable('calendar_feeds', {
  clientId: uuid()
    .primaryKey()
    .references(() => clients.id),
  tokenHash: text().notNull().unique(),
  tokenEnc: text().notNull(),
  createdAt: createdAt(),
  rotatedAt: ts(),
  revokedAt: ts(),
  lastFetchedAt: ts(),
  fetchCount: integer().notNull().default(0),
});

// ---------- §31 marketing (0021_marketing.sql) ----------
/**
 * SPEC §31.3: where a registration or a callback request came from – one row per event, written once. The click ids and
 * the consent link are filled ONLY with ADS_TRACKING_ENABLED and a granted ad consent (§31.6); otherwise null.
 */
export const marketingTouches = pgTable(
  'marketing_touches',
  {
    id: id(),
    kind: text().$type<'regisztracio' | 'visszahivas'>().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    clientId: uuid().references(() => clients.id),
    callbackRequestId: uuid(),
    /** SPEC §31.2 channelOf(): youtube | google | facebook | instagram | tiktok | kozvetlen | egyeb */
    channel: text().notNull(),
    utmSource: text(),
    utmMedium: text(),
    utmCampaign: text(),
    utmContent: text(),
    utmTerm: text(),
    referrerDomain: text(),
    landingPath: text(),
    platform: text().$type<'web' | 'android' | 'ios'>(),
    /** SPEC §28.K.8 entry: ?forras=… (e.g. kalkulator) and ?cel=visszahivas */
    entrySource: text(),
    entryGoal: text(),
    /** A callback row whose source was copied from the registration (the request itself came without one). */
    inherited: boolean().notNull().default(false),
    /** Filled by the 0021 backfill from signup_attribution: the registration was before the source was recorded. */
    beforeTracking: boolean().notNull().default(false),
    clickIds: jsonb().$type<Partial<Record<'gclid' | 'gbraid' | 'wbraid' | 'fbclid', string>>>(),
    consentId: uuid(),
    createdAt: createdAt(),
  },
  (t) => [
    index('marketing_touches_user_kind_idx').on(t.userId, t.kind),
    index('marketing_touches_created_idx').on(t.createdAt),
    check('marketing_touches_kind_chk', sql`${t.kind} in ('regisztracio', 'visszahivas')`),
    check('marketing_touches_channel_chk', sql`${t.channel} in ('youtube', 'google', 'facebook', 'instagram', 'tiktok', 'kozvetlen', 'egyeb')`),
  ],
);

/**
 * SPEC §31.6: the ad-measurement consents given on the landing banner ("Elfogadom" or the per-partner settings). The id is
 * the decision id the banner keeps; it is linked to the account at sign-up. Only granted decisions are stored; a
 * withdrawal sets withdrawn_at (the row stays as the record of consent). Unused while ADS_TRACKING_ENABLED=false.
 */
export const marketingConsents = pgTable(
  'marketing_consents',
  {
    id: id(),
    userId: uuid().references(() => users.id),
    meta: boolean().notNull().default(false),
    google: boolean().notNull().default(false),
    /** Google ad_personalization (separate choice, default off). */
    personalization: boolean().notNull().default(false),
    noticeVersion: text().notNull(),
    source: text().$type<'landing' | 'app'>().notNull(),
    ipHmac: text(),
    userAgent: text(),
    createdAt: createdAt(),
    linkedAt: ts(),
    withdrawnAt: ts(),
  },
  (t) => [index('marketing_consents_user_idx').on(t.userId), check('marketing_consents_source_chk', sql`${t.source} in ('landing', 'app')`)],
);

/** What the server-side conversion adapters send (whitelist, SPEC §31.6): never tax data, never a name or an address. */
export interface AdConversionPayload {
  /** SHA-256 hex of the normalised e-mail (Meta: trim + lower case; Google: + the gmail dot / plus rule). */
  emailSha256: string;
  /** Google's own e-mail normalisation differs for gmail.com addresses. */
  emailSha256Google: string;
  /** SHA-256 hex of the phone (Meta: digits with country code; Google: E.164 with +), only when the owner allows it. */
  phoneSha256?: string | null;
  phoneSha256Google?: string | null;
  valueHuf?: number | null;
  clickIds?: Partial<Record<'gclid' | 'gbraid' | 'wbraid' | 'fbclid', string>> | null;
  /** fbc made from the fbclid at its first sight (fb.1.<ms>.<fbclid>). */
  fbc?: string | null;
  /** Meta website events require these two [TULAJ/JOGI]: the sign-up page address and the browser's User-Agent. */
  eventSourceUrl?: string | null;
  clientUserAgent?: string | null;
  /** Google ad_personalization of the consent. */
  personalization?: boolean;
}

/** SPEC §31.6: the outbox of server-side conversion events (rows only with ads on + a granted consent). */
export const adConversionEvents = pgTable(
  'ad_conversion_events',
  {
    id: id(),
    provider: text().$type<'meta' | 'google'>().notNull(),
    event: text().$type<'regisztracio' | 'fizetes'>().notNull(),
    /** Stable per provider: reg_<userId> / fiz_<paymentId> (dedup with the browser event and retries). */
    eventId: text().notNull(),
    userId: uuid().notNull(),
    consentId: uuid().notNull(),
    eventTime: ts().notNull(),
    payload: jsonb().$type<AdConversionPayload>().notNull(),
    status: text().$type<'var' | 'elkuldve' | 'hiba' | 'elvetve'>().notNull().default('var'),
    attempts: integer().notNull().default(0),
    lastError: text(),
    sentAt: ts(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('ad_conversion_events_provider_event_uq').on(t.provider, t.eventId),
    index('ad_conversion_events_status_idx').on(t.status),
    check('ad_conversion_events_provider_chk', sql`${t.provider} in ('meta', 'google')`),
    check('ad_conversion_events_event_chk', sql`${t.event} in ('regisztracio', 'fizetes')`),
    check('ad_conversion_events_status_chk', sql`${t.status} in ('var', 'elkuldve', 'hiba', 'elvetve')`),
  ],
);

/** SPEC §31.5: ad spend typed in by the owner on the Marketing tab (no ad-account key needed). Revoked rows stay. */
export const adSpend = pgTable(
  'ad_spend',
  {
    id: id(),
    day: day().notNull(),
    platform: text().$type<'meta' | 'google' | 'egyeb'>().notNull(),
    campaign: text(),
    amountHuf: integer().notNull(),
    note: text(),
    createdBy: uuid(),
    createdAt: createdAt(),
    revokedAt: ts(),
    revokedBy: uuid(),
  },
  (t) => [
    index('ad_spend_day_idx').on(t.day),
    check('ad_spend_platform_chk', sql`${t.platform} in ('meta', 'google', 'egyeb')`),
    check('ad_spend_amount_chk', sql`${t.amountHuf} > 0 and ${t.amountHuf} <= 100000000`),
  ],
);
