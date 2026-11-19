// API errors (SPEC §3.5): HTTP status + { error: { code, message (plain Hungarian), fields? } }.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly extra?: Record<string, unknown>,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** Extra keys INSIDE `error` (e.g. `feature` of 403 locked_until_active, SPEC §26.5). */
  errorExtra?: Record<string, unknown>;
  toJSON() {
    return {
      error: { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}), ...(this.errorExtra ?? {}) },
      ...(this.extra ?? {}),
    };
  }
}

export const E = {
  validation: (fields?: Record<string, string>, message = 'Néhány adat nem stimmel. Nézd át a pirossal jelölt mezőket.') =>
    new ApiError(400, 'validation_failed', message, fields),
  unauthenticated: (message = 'Jelentkezz be újra.') => new ApiError(401, 'unauthenticated', message),
  mfaRequired: (mfaToken: string) =>
    new ApiError(401, 'mfa_required', 'Add meg a hitelesítő alkalmazásod kódját.', undefined, { mfaToken }),
  forbidden: (message = 'Ehhez nincs jogosultságod.') => new ApiError(403, 'forbidden', message),
  mfaSetupRequired: () =>
    new ApiError(403, 'totp_setup_required', 'Előbb kapcsold be a kétlépcsős belépést a Beállítások oldalon.'),
  notFound: (message = 'Nem találjuk.') => new ApiError(404, 'not_found', message),
  conflict: (message: string) => new ApiError(409, 'conflict', message),
  tooLarge: (message = 'Túl nagy a fájl.') => new ApiError(413, 'too_large', message),
  unsupported: (message: string) => new ApiError(415, 'unsupported_type', message),
  rateLimited: (retryAfterSec: number, message = 'Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.') =>
    new ApiError(429, 'rate_limited', message, undefined, { retryAfter: Math.max(1, Math.ceil(retryAfterSec)) }, {
      'Retry-After': String(Math.max(1, Math.ceil(retryAfterSec))),
    }),
  notConfigured: (message: string) => new ApiError(503, 'not_configured', message),
  demoOnly: () => new ApiError(403, 'demo_only', 'Ez csak a bemutató változatban érhető el.'),
  upstream: (message: string) => new ApiError(502, 'upstream_error', message),
  /** SPEC §26.5: the feature opens after activation (lifecycle 'aktiv'). */
  locked: (feature: string, message: string) => {
    const e = new ApiError(403, 'locked_until_active', message);
    e.errorExtra = { feature };
    return e;
  },
  /** SPEC §26.1.6: the onboarding step is not open yet on the client's path. */
  stepLocked: (message: string) => new ApiError(409, 'step_locked', message),
  /** SPEC §26.2.9: retired endpoint (appointment booking). */
  retired: (message = 'Időpontot már nem lehet foglalni. Kérj visszahívást.') => new ApiError(410, 'megszunt_funkcio', message),
  internal: () => new ApiError(500, 'internal', 'Valami elromlott nálunk. Próbáld újra pár perc múlva.'),
};
