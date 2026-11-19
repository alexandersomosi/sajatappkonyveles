// Google and Apple ID tokens verified locally against the providers' JWKS (SPEC §4.1):
//   Google: https://www.googleapis.com/oauth2/v3/certs, iss accounts.google.com, aud ∈ GOOGLE_CLIENT_IDS, email_verified
//   Apple:  https://appleid.apple.com/auth/keys,      iss https://appleid.apple.com, aud = APPLE_BUNDLE_ID
// Adapted from the proven Gardoko implementation (kerti_doktor/backend/src/auth/oidc.ts).
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { normalizeEmail } from '../lib/validators.js';

export type Provider = 'google' | 'apple';

const JWKS_URL: Record<Provider, string> = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  apple: 'https://appleid.apple.com/auth/keys',
};
const ISSUERS: Record<Provider, string[]> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
};

export interface VerifiedIdentity {
  sub: string;
  /** Normalised address, only when the provider says it is verified. */
  email: string | null;
  givenName?: string;
  familyName?: string;
}

export class TokenRejected extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'TokenRejected';
  }
}
export class ProviderUnavailable extends Error {
  constructor() {
    super('identity provider unavailable');
    this.name = 'ProviderUnavailable';
  }
}

export type IdTokenVerifier = (p: Provider, token: string) => Promise<VerifiedIdentity>;

export function createIdTokenVerifier(audiences: { google: string[]; apple: string }, keySets: Partial<Record<Provider, JWTVerifyGetKey>> = {}): IdTokenVerifier {
  const sets = { ...keySets };
  const keysFor = (p: Provider): JWTVerifyGetKey => {
    let k = sets[p];
    if (!k) {
      k = createRemoteJWKSet(new URL(JWKS_URL[p]), { timeoutDuration: 5_000, cooldownDuration: 30_000, cacheMaxAge: 6 * 3_600_000 });
      sets[p] = k;
    }
    return k;
  };
  return async (p, token) => {
    const audience = p === 'google' ? audiences.google : audiences.apple;
    if (!audience || (Array.isArray(audience) && audience.length === 0)) throw new TokenRejected('not_configured');
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, keysFor(p), {
        issuer: ISSUERS[p],
        audience,
        algorithms: ['RS256'],
        clockTolerance: 60,
        requiredClaims: ['sub', 'exp', 'iat'],
      }));
    } catch (err) {
      if (err instanceof joseErrors.JWKSTimeout) throw new ProviderUnavailable();
      if (err instanceof joseErrors.JOSEError) throw new TokenRejected((err as { code?: string }).code ?? 'invalid');
      throw new ProviderUnavailable();
    }
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) throw new TokenRejected('sub');
    const email = payload.email;
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    const ok = typeof email === 'string' && verified && email.length <= 254 && email.includes('@');
    const name = (k: string) => (typeof payload[k] === 'string' ? String(payload[k]).slice(0, 80) : undefined);
    return { sub: payload.sub, email: ok ? normalizeEmail(email as string) : null, givenName: name('given_name'), familyName: name('family_name') };
  };
}
