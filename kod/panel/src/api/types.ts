// Panel-side DTOs for the endpoints SPEC §12.5/§12.6 only names (no full shape there).
// Shapes shared with the client app come from src/_shared (kod/shared/src/api.ts).
// Every shape below is also written down in SPEC §24 (panel note) so the backend can match it.
import type {
  AccClientRow,
  AdminServiceStats,
  Appointment,
  AuthUser,
  Deadline,
  DocumentDetail,
  DocumentListItem,
  Explanation,
  Letter,
  Message,
  Meter,
  NavInvoiceListItem,
  PaymentItem,
  RequestSummary,
  RevenueItem,
  TaxCalculation,
  TaxPeriodSummary,
  TaxProfile,
} from '../_shared/api';
import type {
  AppointmentChannel,
  ClientFlag,
  ClientLifecycle,
  DocumentCategory,
  DocumentStatus,
  DocumentVisibility,
  KycStatus,
  MeghatalmazasMethod,
  Milestone,
  OnboardingStep,
  PaymentItemKind,
  StepStatus,
  SubscriptionStatus,
  PaymentMode,
} from '../_shared/enums';

export type { AccClientRow, AuthUser, Deadline, DocumentDetail, DocumentListItem, Letter, Message, Meter, NavInvoiceListItem, PaymentItem, RequestSummary, RevenueItem, TaxCalculation, TaxProfile, Appointment, Explanation };
// SPEC §26 team shapes (callbacks, new-business pipeline, team threads, staff) – owned by kod/shared/src/api.ts.
export type {
  AdminServiceStats,
  BusinessRegistrationAnswers,
  BusinessRegistrationHints,
  BusinessRegistrationInput,
  CallbackAssignInput,
  CallbackAttemptInput,
  CallbackCloseInput,
  CallbackStaffPatch,
  RegistrationAdoszamStaffInput,
  RegistrationCheckInput,
  RegistrationFixInput,
  StaffRef,
  TeamCallbackCreateInput,
  TeamCallbackDetail,
  TeamCallbackRow,
  TeamClientCard,
  TeamMemberInvite,
  TeamMemberPatch,
  TeamMemberRow,
  TeamRegistrationDetail,
  TeamRegistrationPatch,
  TeamRegistrationRow,
  TeamSummary,
  TeamThreadRow,
  // SPEC §27 (changeable branch, "Intézzük helyette")
  AssistAgreedInput,
  AssistCloseInput,
  AssistEvFiledInput,
  AssistStaffPatch,
  AssistUjegykeFiledInput,
  PathHistoryItem,
  TeamAssistChecklistItem,
  TeamAssistDetail,
  TeamAssistRow,
} from '../_shared/api';
import type { TeamAssistDetail as _TeamAssistDetail, TeamClientCard as _TeamClientCard } from '../_shared/api';
import type { AccClientDetailK28, FeeChargeView as _FeeChargeView, NotificationSettings as _NotificationSettings } from '../_shared/api';
import type { InvoiceNotifyState, NotificationKind } from '../_shared/enums';
// SPEC §28 / §28.K shapes – owned by kod/shared/src/api.ts.
export type {
  AccAllowanceItem,
  AccAllowanceView,
  AccAnnualView,
  AccClientDetailK28,
  AllowanceAnswers,
  AllowanceChildAnswer,
  AllowanceDecisionInput,
  AllowanceParams,
  AllowancePreview,
  AllowancePreviewInput,
  AnnualAnswers,
  AnnualCheckInput,
  ChangeData,
  ChangeDoneInput,
  ChangeFollowupPatch,
  ChangeFollowupView,
  CheckinItemAnswer,
  CheckinItemDecisionInput,
  CsaladiMonthParam,
  EarningsCard,
  EarningsMonthView,
  EarningsView,
  EmployerDecisionInput,
  EmployerStatusView,
  FeeChargeView,
  FeeSettingUpdateInput,
  FeeSettingView,
  FeeWaiveInput,
  InvoiceReserveView,
  KataHomeView,
  NavAddress,
  NotificationSettings,
  PauseView,
  ReserveCard,
  ReserveListItem,
  ReserveView,
  ServiceLockView,
  TaxRegimeInput,
  AdoszamStaffInput,
  TeamCheckinItem,
} from '../_shared/api';

/**
 * PANEL CONTRACT ADDITION (B3, 11-19; written down in kod/panel/README.md "§28 builder notes"): the notification log
 * of one client – what the app sent him and why a push waited or did not go out.
 * GET /acc/clients/:id/notifications?cursor= (A own clients, AD; csapat 404). Never holds push tokens or e-mail
 * addresses; `body` is the rendered in-app text the client saw.
 */
export interface AccNotificationLogRow {
  id: string;
  kind: NotificationKind;
  /** content variant ('tobb', 'kuszob', 'kerdes' …) or null */
  variant: string | null;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
  push: {
    wanted: boolean;
    sentAt: string | null;
    /** quiet hours: the push waits until this time (Budapest) */
    notBefore: string | null;
    /** why no push went out: the client's quiet hours (still waiting), the daily cap, the client switched it off, no device */
    skipped: 'csendes_ido' | 'napi_limit' | 'kikapcsolva' | 'nincs_eszkoz' | null;
    /** the push showed amounts (invoice_new / kata_business_invoice with pushShowAmounts on) */
    amountsShown: boolean;
  };
  email: { sentAt: string | null } | null;
}
export interface AccNotificationLog {
  items: AccNotificationLogRow[];
  nextCursor: string | null;
  /** the client's own settings (SPEC §28.2.3) – null = defaults */
  settings: _NotificationSettings | null;
  /** issued invoices of the last 30 days that were NOT notified, with the reason (nav_invoices.notify_state) */
  skippedInvoices: { navInvoiceId: string; invoiceNumber: string; issueDate: string; grossAmountHuf: number; state: InvoiceNotifyState }[];
}
/**
 * PANEL CONTRACT ADDITION (B3): GET /admin/fee-charges?status= (AD) – the one-off fee charges for the admin's
 * refund / waive work on /admin/dijak (SPEC §28.K.1 names only the POST actions).
 */
export type AdminFeeChargeRow = _FeeChargeView & { client: { id: string; name: string } };

/**
 * SPEC §27.6.3 panel extension (optional fields, see the B3 note in SPEC §24): the 4-day approval window as stored on
 * the assist row (`ujegyke_filed_at`, `approval_due_on`, `approval_expires_at`, `approval_reminders`). Without it the
 * panel derives the filing time from the 'assist.ujegyke_filed' timeline entry.
 */
export type TeamAssistDetailP = _TeamAssistDetail & {
  approval?: { filedAt: string; dueOn: string; expiresAt: string; remindersSent: number; clientApprovedAt: string | null; expiredCount: number } | null;
};
/** POST /team/clients/:clientId/path (SPEC §27.2.3; csapat, admin). */
export interface TeamPathChangeInput {
  businessStatus: 'van' | 'inditas';
  note: string;
  clearAdoszam?: boolean;
}
export type { _TeamClientCard as TeamClientCardT };

export interface Ref {
  id: string;
  name: string;
}

// GET /acc/clients
export interface AccClientList {
  items: AccClientRow[];
  counts: Record<ClientFlag | 'mind', number>;
}

// GET /acc/clients/:id – the SPEC §28 / §28.K extra fields (reserve, earnings, allowancesPending, taxRegime, kata,
// serviceLock, pause, employer, annual, adoszamPending, checkinOpenItems, mailboxAddress) come from AccClientDetailK28.
export interface AccClientDetail extends AccClientDetailK28 {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  lifecycle: ClientLifecycle;
  flags: ClientFlag[];
  clientSince: string; // YYYY-MM-DD
  adoazonositoJel: string | null; // always null since kör 1: the full value comes from POST …/adoazonosito/reveal
  adoazonositoJelMasked: string | null; // "•••••••569"
  adoszam: string | null;
  evNyilvantartasiSzam: string | null;
  birthName: string | null;
  address: { zip: string; city: string; line: string } | null;
  hqMunicipality: string | null;
  activityText: string | null;
  activityCode: string | null;
  evSince: string | null;
  previousAccountant: string | null;
  hasSeparateBusinessAccount: boolean | null;
  taxProfile: TaxProfile | null;
  onboarding: {
    steps: { step: OnboardingStep; status: StepStatus; note?: string; completedAt?: string; data?: { method?: MeghatalmazasMethod; submittedAt?: string; fileId?: string } }[];
    milestones: { key: Milestone; label: string; done: boolean; current: boolean; sub?: string }[];
  };
  kycStatus: KycStatus | null;
  subscription: { status: SubscriptionStatus; mode: PaymentMode; priceHuf: number; nextChargeAt?: string; cardMask?: string; failedAttempts: number } | null;
  nav: NavConnection;
  meters: { afa: Meter; atalanyCap: Meter; adomentes: { limitHuf: number; usedIncomeHuf: number; reached: boolean; reachedMonth: number | null; sentence: string } } | null;
  nextDeadline: Deadline | null;
  openRequestsFromClient: number;
  openRequestsToClient: number;
  unreadMessages: number;
  demo: boolean;
}

export interface NavConnection {
  status: 'nincs' | 'nincs_ellenorizve' | 'rendben' | 'hibas';
  environment: 'demo' | 'test' | 'prod' | null;
  loginHint: string | null;
  taxNumber: string | null;
  savedAt: string | null;
  lastTestAt: string | null;
  lastTestError: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: 'ok' | 'hiba' | null;
  lastSyncError: string | null;
}

export interface NavSyncRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'ok' | 'hiba' | 'fut';
  digestsSeen: number;
  invoicesNew: number;
  errorCode: string | null;
  messageHu?: string | null;
}

// GET /acc/clients/:id/kyc
export interface KycView {
  /** mime per file key (PDF uploads are shown as a link, not an <img>). */
  fileMimes?: Record<string, string>;
  status: KycStatus;
  submittedAt: string;
  reviewNote: string | null;
  data: Record<string, string>; // Pmt. 7. § fields, Hungarian labels as keys are NOT used: keys are camelCase (see KYC_FIELD_LABELS)
  declarations: { ownBehalf: boolean; pep: boolean; pepDetails?: string; signedAt: string };
  files: { idFront?: string; idBack?: string; addressFront?: string; addressBack?: string }; // file ids; addressBack is no longer collected (Pmt. 7. § (8), SPEC §24 jogi)
}

// GET /acc/clients/:id/dossiers?year=
export interface AccDossierMonths {
  months: { month: string; label: string; documentCount: number; waitingCount: number; navInvoiceCount: number }[];
}

// GET /acc/clients/:id/dossiers/:month
export interface AccDossierView {
  month: string;
  label: string;
  documents: AccDocument[];
  navInvoices: { items: NavInvoiceListItem[]; totalHuf: number; status: DocumentStatus | null };
  revenueItems: RevenueItem[];
  review: { at: string; okCount: number; note?: string } | null;
  openRequests: RequestSummary[];
}

export interface AccDocument extends DocumentListItem {
  visibility: DocumentVisibility;
  createdAt: string;
  createdByRole: 'client' | 'accountant' | 'system';
  clientNote?: string;
  accountantComment?: string;
  fileId?: string;
  mime?: string;
}

export interface AccDocumentDetail extends DocumentDetail {
  visibility: DocumentVisibility;
  fileId?: string;
  mime?: string;
  createdByRole: 'client' | 'accountant' | 'system';
}

export interface DocumentUploadMeta {
  category: DocumentCategory;
  dossierMonth: string;
  title: string;
  visibility: DocumentVisibility;
  status?: DocumentStatus;
}

// GET /acc/clients/:id/nav-invoices?year=
export interface AccNavInvoiceRow extends NavInvoiceListItem {
  operation: 'CREATE' | 'MODIFY' | 'STORNO';
  deliveryDate: string;
  paymentDate: string | null;
  paymentMethod: string | null;
  customerTaxNumber: string | null;
  revenueItemId: string | null;
  receivedOn: string | null;
  receivedOnEstimated: boolean;
}
export interface NavInvoiceDetail extends AccNavInvoiceRow {
  currency: string;
  netHuf: number;
  vatHuf: number;
  vatExemption?: { case: string; reason: string } | null;
  lines: { lineNo: number; description: string; quantity: number; unit: string; unitPriceHuf: number; netAmountHuf: number }[];
}

// GET /acc/clients/:id/revenue?year=
export interface AccRevenue {
  year: number;
  items: RevenueItem[];
  byMonth: { month: number; amountHuf: number; estimated: boolean }[];
  totalHuf: number;
  meters: AccClientDetail['meters'];
}

// GET /acc/clients/:id/tax-periods?year=
export interface AccTaxPeriod extends TaxPeriodSummary {
  year: number;
  quarter: number | null;
  items: PaymentItem[];
  letter: Letter | null;
  latestCalculation: TaxCalculation | null;
  approvedCalculationId: string | null;
  filed: { filedOn: string; form: string; documents: DocumentListItem[] } | null;
  /** Whether "Beadottnak jelölöm" is allowed now (the server enforces the same rules). null once filed. */
  filing?: { canFile: boolean; reason: string | null; periodEnd: string; openDocuments: number } | null;
}
export interface AccTaxPeriods {
  year: number;
  items: AccTaxPeriod[];
  defaultLetterText: string; // from content_texts ui.tax.letter_default (placeholders already filled)
}

// ado-motor explanation line (SPEC §7.3 + ado-motor note in §24: optional kind/side)
export interface EngineExplanationLine {
  label: string;
  amountHuf?: number;
  op?: '+' | '−' | '=';
  note?: string;
  kind?: 'cim' | 'sor' | 'ado' | 'megjegyzes';
  side?: string;
}
// ado-motor QuarterResult (SPEC §7.5) – the part the panel renders.
export interface QuarterResult {
  quarter: 1 | 2 | 3 | 4;
  periodKey: string;
  dueDate: string;
  complete: boolean;
  revenueHuf: number;
  incomeHuf: number;
  incomeYtdHuf: number;
  taxableYtdHuf: number;
  cumulativeBasePerMonthHuf: number;
  months: { month: number; revenueHuf: number; incomeHuf: number; insured: boolean; minimumHuf: number | null; baseHuf: number; tbHuf: number; szochoHuf: number }[];
  tbHuf: number;
  szochoHuf: number;
  szjaAdvanceHuf: number;
  totalHuf: number;
  payments: { kind: PaymentItemKind; label: string; sublabel?: string; amountHuf: number; accountName: string; accountNumber: string; iban: string }[];
  explanation: { intro: string; lines: EngineExplanationLine[]; result: string };
  warnings: { code: string; text: string; audience?: 'ugyfel' | 'konyvelo' }[];
}

// GET /acc/requests
export interface AccRequestRow extends RequestSummary {
  client: Ref;
  updatedAt?: string;
}

// GET /acc/clients/:id/notes
export interface InternalNote {
  id: string;
  body: string;
  pinned: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  body: string;
  global: boolean;
}

// GET /acc/deadline-board?week=
export interface DeadlineBoard {
  week: string; // 2026-W47
  prevWeek: string;
  nextWeek: string;
  days: string[]; // Mon..Sun YYYY-MM-DD
  rows: { client: Ref; items: BoardItem[] }[];
  overdue: (BoardItem & { client: Ref; daysOverdue: number })[];
}
export interface BoardItem {
  id: string;
  kind: Deadline['kind'];
  title: string;
  dueDate: string;
  status: 'kesz' | 'nyitott' | 'lejart';
  overdue: boolean;
  amountHuf?: number;
}

// GET /acc/appointments
export interface AccAppointments {
  enabled: boolean;
  slots: { id: string; startsAt: string; endsAt: string; channels: AppointmentChannel[]; status: 'szabad' | 'foglalt' | 'torolve' }[];
  appointments: (Appointment & { client: Ref; phone?: string | null })[];
}

// GET /acc/settings
export interface AccSettings {
  displayName: string;
  firstName: string;
  title: string;
  registrationNumber: string;
  responseTimeText: string;
  appointmentsEnabled: boolean;
  monthlyStatementRequest: boolean;
  signatureSvgPath: string | null;
  avatarKey: string;
}

// GET /acc/audit, GET /admin/audit
export interface AuditRow {
  id: string;
  at: string;
  actor: { id: string | null; name: string; role: string };
  action: string;
  targetType: string | null;
  targetId: string | null;
  client: Ref | null;
  details: Record<string, unknown> | null;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------- admin ----------
export interface AdminDashboard {
  clients: { total: number; byLifecycle: Record<ClientLifecycle, number>; newThisMonth: number };
  funnel: { registered: number; onboardingStarted: number; subscribed: number; active: number };
  mrrHuf: number;
  /** Active but cancelled at period end: not in the MRR. */
  endingSubscriptions?: number;
  revenueByMonth: { month: string; amountHuf: number }[];
  failedPayments: number;
  cancellationsThisMonth: number;
  accountants: { id: string; name: string; clients: number; openRequests: number; overdueItems: number }[];
  demo?: boolean;
  /** SPEC §26.3.4: callbacks + new-business pipeline (optional until the backend sends it). */
  service?: AdminServiceStats;
}
export interface AdminClientRow {
  id: string;
  name: string;
  email: string;
  lifecycle: ClientLifecycle;
  accountant: Ref | null;
  subscriptionStatus: SubscriptionStatus | null;
  source: string | null;
  referralCode: string | null;
  createdAt: string;
  /** SPEC §27.6.4 (round-2 security finding 9): the client's login is disabled (users.status = 'disabled'). */
  disabled?: boolean;
  disabledAt?: string | null;
  disabledReason?: string | null;
}
export interface AdminSubscriptionRow {
  id: string;
  client: Ref;
  status: SubscriptionStatus;
  mode: PaymentMode;
  priceHuf: number;
  currentPeriodEnd: string | null;
  nextChargeAt: string | null;
  failedAttempts: number;
  lastFailureCode: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  card: { mask: string; status: 'fuggo' | 'aktiv' | 'torolve' | 'lejart'; tokensLeft: number; expiry: string } | null;
}
export interface AdminPaymentRow {
  id: string;
  orderRef: string;
  client: Ref;
  kind: 'regisztracio' | 'ismetlodo' | 'visszaterites';
  amountHuf: number;
  status: string; // SimplePay status string
  createdAt: string;
  finishedAt: string | null;
  errorCodes: string[];
  mode: PaymentMode;
}
export interface AdminAccountantRow {
  id: string;
  displayName: string;
  firstName: string;
  title: string;
  email: string;
  registrationNumber: string;
  clients: number;
  capacity: number;
  openRequests: number;
  overdueItems: number;
  waitingDocuments: number;
  active: boolean;
  appointmentsEnabled: boolean;
  nameForms: { with: string; from: string; onto: string; acc: string };
}
export interface ReferralCodeRow {
  id: string;
  code: string;
  ownerClient: Ref | null;
  campaign: string | null;
  note: string | null;
  active: boolean;
  signups: number;
  paying: number;
  createdAt: string;
}
export interface AttributionRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  code: string | null;
  signups: number;
  paying: number;
}
export interface ContentText {
  key: string;
  group: 'notif' | 'email' | 'ui' | string;
  description?: string;
  body: string;
  defaultBody: string;
  placeholders: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
  /** Retired booking texts (never sent; kept so old notifications render). */
  legacy?: boolean;
}
export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort: number;
  published: boolean;
}
export interface DemoMail {
  id: string;
  toDisplay: string;
  subject: string;
  bodyText: string;
  createdAt: string;
}
export interface SystemStatus {
  appEnv: 'demo' | 'production';
  version: string;
  modes: { nav: string; simplepay: string; mail: string; push: string; invoice: string };
  googleSignIn: boolean;
  appleSignIn: boolean;
  staffTotpRequired: boolean;
  workerHeartbeatAt: string | null;
  lastNavSync: { at: string | null; ok: number; failed: number } | null;
  backupAgeHours: number | null;
  db: 'ok' | 'hiba';
}

export interface MeResponse {
  user: AuthUser;
  staffAccountantId?: string;
  accountant?: { id: string; displayName: string; firstName: string; nameForms: { with: string; from: string; onto: string; acc: string }; signatureSvgPath: string | null; title: string };
}
