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
export const issueAccessCookie = (res: Response, jwtPayload: JwtPayload): void => {
  const token = jwt.sign({ ...jwtPayload, typ: 'access' }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
  res.cookie(AUTH_COOKIE, token, accessCookieOptions());
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
  issueAccessCookie(res, jwtPayload);

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
