import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { getJwtSecret } from '../security/JwtSecret';
import { issueCsrfToken } from '../security/csrfToken';
import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  USER_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  cookieOptions,
  accessCookieOptions,
  refreshCookieOptions,
  authMaxAge,
} from '../security/cookieOptions';

// Extracted from UserApiController.ts (task 2.2) — the controller was at
// 204/250 lines and PR2 adds a refresh handler on top (design.md D4).
export interface UserDisplayData {
  firstName: string;
  image: string | null;
  idRole?: number | null;
  category?: string | null;
}

export interface JwtPayload {
  userId: number;
  email: string;
  category?: string | null;
  idRole?: number | null;
  // Lets logout revoke the exact refresh-token family this access token
  // came from, without needing the refresh cookie itself — it is
  // path-scoped away from /users/logout (design.md D4/D5). This claim is
  // only ever trusted after `jwt.verify` succeeds, so it cannot be forged
  // (found during apply — not spelled out by design.md; see apply-progress).
  familyId?: string;
}

/**
 * Opaque, high-entropy refresh-token plaintext (design.md D3: not a JWT, so
 * it structurally cannot be confused with an access token).
 */
export const generateRefreshToken = (): string => crypto.randomBytes(32).toString('hex');

/**
 * `typ: 'access'` is added in exactly this one place (design.md D3) — the
 * one `jwt.sign` call used by login, register, and refresh. `apiAuthMiddleware`
 * requires it. The cookie itself is fixed at `ACCESS_TOKEN_TTL_SECONDS`
 * regardless of "remember me" (api-jwt-auth spec).
 */
export const issueAccessCookie = (res: Response, jwtPayload: JwtPayload, remember?: boolean): void => {
  const token = jwt.sign({ ...jwtPayload, typ: 'access' }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
  // The token's own `expiresIn` stays fixed; only the cookie's `maxAge`
  // follows the session, so the expired token survives in the jar as the
  // carrier logout reads `familyId` from.
  res.cookie(AUTH_COOKIE, token, accessCookieOptions(remember));
};

export const issueRefreshCookie = (res: Response, plainToken: string, maxAge?: number): void => {
  res.cookie(REFRESH_COOKIE, plainToken, refreshCookieOptions(maxAge));
};

/**
 * Issues all 4 session cookies at login/register. `remember` governs the
 * refresh token and the CSRF/display cookies — the access cookie's TTL is
 * fixed, see `issueAccessCookie`.
 */
export const setSessionCookies = (
  res: Response,
  userId: number,
  jwtPayload: JwtPayload,
  display: UserDisplayData,
  refreshPlainToken: string,
  remember?: boolean
): void => {
  issueAccessCookie(res, jwtPayload, remember);

  const maxAge = authMaxAge(remember);
  const csrfToken = issueCsrfToken(userId);

  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions({ httpOnly: false, maxAge }));
  res.cookie(USER_COOKIE, JSON.stringify(display), cookieOptions({ httpOnly: false, maxAge }));
  issueRefreshCookie(res, refreshPlainToken, maxAge);
};

export const clearSessionCookies = (res: Response): void => {
  const clearOptions = cookieOptions({ httpOnly: true });
  res.clearCookie(AUTH_COOKIE, clearOptions);
  res.clearCookie(CSRF_COOKIE, { ...clearOptions, httpOnly: false });
  res.clearCookie(USER_COOKIE, { ...clearOptions, httpOnly: false });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
};

/**
 * Reads `familyId` out of an access token for `logout`, which runs precisely
 * when that token is most likely already expired — a user who stepped away
 * and came back. `ignoreExpiration` relaxes only `exp`; the SIGNATURE is
 * still verified, so an unsigned or tampered token yields nothing.
 *
 * Without this, `jwt.verify` throws on an expired token, `familyId` comes
 * back undefined, and the refresh family silently survives logout for up to
 * 30 days — which would defeat the whole point of revocation.
 */
export const readFamilyIdFromAccessToken = (token: string): string | undefined => {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true });
    return (decoded as { familyId?: string }).familyId;
  } catch {
    return undefined;
  }
};
