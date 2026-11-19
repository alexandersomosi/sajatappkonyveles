// Error model + mapping of NAV error codes to plain Hungarian (SPEC §8.4; interface spec 3.0 ch. 3.2).
// NavError.message is technical English without secrets or request values; messageHu is for the panel.

export type NavErrorKind =
  | 'auth' // wrong login/password/signing key
  | 'permission' // technical user has no right / not for this tax number
  | 'unavailable' // NAV down, maintenance, network, timeout (retry later)
  | 'bug' // our request is wrong (schema, version, parameters) – alert developers
  | 'clock' // server clock out of NAV's ±1 day tolerance
  | 'not_found' // queried invoice does not exist for this taxpayer/direction
  | 'data' // NAV data exists but cannot be used as is
  | 'config' // missing/invalid configuration or input on our side
  | 'unknown';

export interface NavErrorInit {
  code: string;
  kind?: NavErrorKind;
  messageHu?: string;
  retryable?: boolean;
  funcCode?: string;
  httpStatus?: number;
  operation?: string;
  /** NAV's own text message. May echo request values – do not log it at info level. */
  navMessage?: string;
  validationMessages?: string[];
  cause?: unknown;
}

interface Mapping {
  kind: NavErrorKind;
  retryable: boolean;
  messageHu: string;
}

const MSG_AUTH = 'Hibás technikai felhasználónév vagy jelszó.';
const MSG_SIGNATURE = 'Hibás XML aláírókulcs.';
const MSG_PERMISSION =
  'Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik.';
const MSG_UNAVAILABLE = 'A NAV rendszere most nem érhető el, később újrapróbáljuk.';
const MSG_BUG = 'Hiba van a NAV-nak küldött lekérdezésünkben. Szóltunk a fejlesztőknek.';

/** errorCode → meaning. Codes are from the interface spec 3.0 "Technical error codes" table. */
export const NAV_ERROR_MAP: Readonly<Record<string, Mapping>> = {
  INVALID_SECURITY_USER: { kind: 'auth', retryable: false, messageHu: MSG_AUTH },
  INVALID_REQUEST_SIGNATURE: { kind: 'auth', retryable: false, messageHu: MSG_SIGNATURE },
  FORBIDDEN: { kind: 'permission', retryable: false, messageHu: MSG_PERMISSION },
  NOT_REGISTERED_CUSTOMER: { kind: 'permission', retryable: false, messageHu: MSG_PERMISSION },
  INVALID_CUSTOMER: { kind: 'permission', retryable: false, messageHu: MSG_PERMISSION },
  INVALID_USER_RELATION: { kind: 'permission', retryable: false, messageHu: MSG_PERMISSION },
  // Retried at once with a NEW requestId (every attempt gets a fresh one anyway).
  REQUEST_ID_NOT_UNIQUE: {
    kind: 'unavailable',
    retryable: true,
    messageHu: 'A NAV egy kérésazonosítót már ismert, ezért újrapróbáljuk.',
  },
  INVALID_TIMESTAMP: {
    kind: 'clock',
    retryable: false,
    messageHu: 'A szerverünk órája eltér a NAV-étól, ezért a NAV elutasította a kérést. Szóltunk a fejlesztőknek.',
  },
  INVALID_REQUEST: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  SCHEMA_VIOLATION: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  INVALID_REQUEST_VERSION: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  INVALID_HEADER_VERSION: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  REQUEST_VERSION_NOT_ALLOWED: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  INVALID_PASSWORD_HASH_CRYPTO: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  INVALID_REQUEST_SIGNATURE_HASH_CRYPTO: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  BAD_QUERY_PARAM_OVERLAP: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  BAD_QUERY_PARAM_RANGE_EXCEEDED: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  BAD_QUERY_PARAM_EQ_NOT_STANDALONE: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  BAD_QUERY_PARAM_OPERATOR_COLLISION: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  BAD_QUERY_PARAM_SUPPLIER_NOT_EXPECTED: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  BAD_QUERY_PARAM_SUPPLIER_EXPECTED: {
    kind: 'data',
    retryable: false,
    messageHu: 'Ezt a számlaszámot több eladó is használta. A lekérdezéshez az eladó adószáma is kell.',
  },
  MULTIPLE_QUERY_RESULT_FOUND: {
    kind: 'data',
    retryable: false,
    messageHu:
      'Ez a számlaszám többször is szerepel a NAV-nál. A számlázó programban kell rendezni (technikai érvénytelenítés).',
  },
  MAINTENANCE_MODE: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  OPERATION_FAILED: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  NOT_ALLOWED_EXCEPTION: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
  // ---- local codes (not sent by NAV) ----
  NETWORK: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  TIMEOUT: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  SERVICE_UNAVAILABLE: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  HTTP_5XX: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  BAD_RESPONSE: { kind: 'unavailable', retryable: true, messageHu: MSG_UNAVAILABLE },
  HTTP_404: {
    kind: 'config',
    retryable: false,
    messageHu: 'Rossz a NAV-szolgáltatás címe a beállításokban. Szóltunk a fejlesztőknek.',
  },
  HTTP_OTHER: { kind: 'unknown', retryable: false, messageHu: 'A NAV váratlan választ adott. Szóltunk a fejlesztőknek.' },
  INVOICE_NOT_FOUND: { kind: 'not_found', retryable: false, messageHu: 'Ezt a számlát nem találjuk a NAV-nál.' },
  DATA_DECODE_ERROR: {
    kind: 'data',
    retryable: false,
    messageHu: 'A számla adatait nem tudtuk kiolvasni. A könyvelő kézzel nézi meg.',
  },
  INVALID_INPUT: { kind: 'config', retryable: false, messageHu: 'Hibás adat a NAV-lekérdezéshez.' },
  NOT_CONFIGURED: {
    kind: 'config',
    retryable: false,
    messageHu: 'A NAV-kapcsolat még nincs bekapcsolva.',
  },
  OPERATION_NOT_ALLOWED: { kind: 'bug', retryable: false, messageHu: MSG_BUG },
};

export class NavError extends Error {
  readonly code: string;
  readonly kind: NavErrorKind;
  readonly funcCode?: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly messageHu: string;
  readonly operation?: string;
  readonly navMessage?: string;
  readonly validationMessages?: string[];

  constructor(init: NavErrorInit) {
    const mapping = NAV_ERROR_MAP[init.code];
    const technical = [
      'NAV',
      init.operation,
      init.code,
      init.httpStatus !== undefined ? `(HTTP ${init.httpStatus})` : undefined,
    ]
      .filter(Boolean)
      .join(' ');
    super(technical, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = 'NavError';
    this.code = init.code;
    this.kind = init.kind ?? mapping?.kind ?? 'unknown';
    this.retryable = init.retryable ?? mapping?.retryable ?? false;
    this.messageHu =
      init.messageHu ?? mapping?.messageHu ?? `A NAV hibát jelzett (${init.code}). A könyvelő megnézi.`;
    if (init.funcCode !== undefined) this.funcCode = init.funcCode;
    if (init.httpStatus !== undefined) this.httpStatus = init.httpStatus;
    if (init.operation !== undefined) this.operation = init.operation;
    if (init.navMessage !== undefined) this.navMessage = init.navMessage.slice(0, 500);
    if (init.validationMessages !== undefined) this.validationMessages = init.validationMessages.slice(0, 20);
  }

  /** Safe to log: no NAV free text, no request values. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      kind: this.kind,
      retryable: this.retryable,
      httpStatus: this.httpStatus,
      operation: this.operation,
      funcCode: this.funcCode,
    };
  }
}

export function isNavError(e: unknown): e is NavError {
  return e instanceof NavError;
}

/** Hungarian text for an error code (unknown codes keep the raw code, SPEC §8.4). */
export function navErrorMessageHu(code: string): string {
  return NAV_ERROR_MAP[code]?.messageHu ?? `A NAV hibát jelzett (${code}). A könyvelő megnézi.`;
}

/** Code for a non-200 HTTP answer that carried no parsable NAV error body. */
export function codeForHttpStatus(status: number): string {
  if (status === 404) return 'HTTP_404';
  if (status === 503 || status === 527) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'HTTP_5XX';
  return 'HTTP_OTHER';
}
