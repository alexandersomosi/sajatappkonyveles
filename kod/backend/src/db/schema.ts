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
} from '../_shared/enums.js';
import type { BusinessRegistrationAnswers } from '../_shared/api.js';

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
  responseTimeText: text().notNull().default('Munkanapokon 4 órán belül válaszol'),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.accountantId), index().on(t.adoazonositoHmac), check('clients_business_status_chk', sql`${t.businessStatus} in ${inList(BUSINESS_STATUSES)}`)],
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
    insuranceBreaks: jsonb().$type<{ from: string; to: string; kind: 'szunetel' | 'kieso' }[]>().notNull().default([]),
    hipaMethod: text().$type<'savos' | 'altalanos' | 'nincs'>().notNull().default('savos'),
    hipaRatePct: numeric({ precision: 4, scale: 2 }).notNull().default('2.00'),
    hipaAccountNumber: text(),
    priorOverrides: jsonb().$type<{ throughQuarter: 1 | 2 | 3; priorActualBaseSum: number; priorSzjaAdvanceSum: number }>(),
    /** SZJA allowances the engine does not model (családi, 25 év alatti, anyák, első házasok…): they raise a warning. */
    allowances: jsonb().$type<{ kind: 'csaladi' | 'fiatal_25' | 'anyak' | 'egyeb'; note?: string }[]>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.clientId, t.year), check('client_tax_profiles_cost_ratio_chk', sql`${t.costRatio} in (45, 50, 80, 90)`)],
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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.clientId, t.invoiceNumber, t.modKey, t.operation), index().on(t.clientId, t.dossierMonth)],
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.clientId, t.receivedOn), uniqueIndex('revenue_items_nav_invoice_uq').on(t.navInvoiceId)],
);

// ---------- 5.6 tax periods and payments ----------
export const taxPeriods = pgTable(
  'tax_periods',
  {
    id: id(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    kind: text().$type<'negyedev' | 'hipa'>().notNull(),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.clientId, t.periodKey)],
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
  mode: text().$type<'demo' | 'sandbox' | 'live'>().notNull(),
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
    kind: text().$type<'regisztracio' | 'ismetlodo' | 'visszaterites'>().notNull(),
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

export const feeInvoices = pgTable('fee_invoices', {
  id: id(),
  clientId: uuid()
    .notNull()
    .references(() => clients.id),
  simplepayTransactionId: uuid().references(() => simplepayTransactions.id),
  provider: text().$type<'demo' | 'szamlazzhu' | 'billingo'>().notNull(),
  number: text(),
  issuedOn: day(),
  amountHuf: integer().notNull(),
  pdfFileId: uuid(),
  externalId: text(),
  status: text().$type<'kiallitva' | 'hiba' | 'sztorno'>().notNull(),
  error: text(),
  demo: boolean().notNull().default(false),
  createdAt: createdAt(),
});

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
const ASSIST_OPEN_SQL = sql.raw(`status in ('visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve')`);
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
