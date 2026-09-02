import jwt, { SignOptions } from 'jsonwebtoken';
import { getJwtSecret } from '../../infrastructure/security/JwtSecret';
import { AUTH_COOKIE, CSRF_COOKIE } from '../../infrastructure/security/cookieOptions';
import { issueCsrfToken } from '../../infrastructure/security/csrfToken';

export interface AuthTokenPayload {
  userId: number;
  email?: string;
  category?: string;
  idRole: number;
}

/**
 * Signs a raw JWT the same shape `UserApiController.login`/`register` issue.
 * Tests build the `m3d_auth` cookie from this instead of an
 * `Authorization: Bearer` header, since `apiAuthMiddleware` (PR1) reads
 * cookies only — a bare Bearer header is now unauthenticated by design.
 *
 * `typ: 'access'` is required (PR2, api-jwt-auth spec: "Pre-deploy JWT
 * without typ claim is rejected") — omitted here, every caller of this
 * helper would get 401 from `apiAuthMiddleware` regardless of the scenario
 * it's actually testing.
 */
export function signAuthToken(
  payload: AuthTokenPayload,
  expiresIn: SignOptions['expiresIn'] = '1h'
): string {
  return jwt.sign({ ...payload, typ: 'access' }, getJwtSecret(), { expiresIn });
}

/** `Cookie` header value carrying only the auth cookie (reads / negative auth cases). */
export function authCookie(token: string): string {
  return `${AUTH_COOKIE}=${token}`;
}

/**
 * Builds everything a state-changing (`POST`/`PUT`/`PATCH`/`DELETE`) request
 * needs: the auth + CSRF cookies, and the matching `X-CSRF-Token` header
 * value. Safe to also use on `GET` requests — `csrfGuard` bypasses safe
 * methods, so the extra header/cookie is inert there.
 */
export function authAndCsrf(payload: AuthTokenPayload, expiresIn?: SignOptions['expiresIn']) {
  const token = signAuthToken(payload, expiresIn);
  const csrfToken = issueCsrfToken(payload.userId);
  return {
    token,
    csrfToken,
    cookie: `${AUTH_COOKIE}=${token}; ${CSRF_COOKIE}=${csrfToken}`,
  };
}
