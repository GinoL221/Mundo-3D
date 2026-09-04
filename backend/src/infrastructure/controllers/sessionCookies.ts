import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { getJwtSecret } from '../security/JwtSecret';
import { issueCsrfToken } from '../security/csrfToken';
import { CreateRememberTokenUseCase } from '../../application/use-cases/CreateRememberTokenUseCase';
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

// Moved verbatim from UserApiController.ts (refresh-token-reuse-detection
// design.md D4) — the controller was at 247/250 lines and the reuse-detection
// branch adds 4 more. UserAuthDto shape is whatever
// AuthenticateUserUseCase/RegisterUserUseCase return.
export interface UserAuthDto {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
  image: string | null;
  idRole?: number | null;
  category?: string | null;
}

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
 * requires it. The TOKEN's `exp` is fixed at `ACCESS_TOKEN_TTL_SECONDS`
 * regardless of "remember me"; the COOKIE carrying it follows the session
 * lifetime instead, so `logout` can still read `familyId` from an expired
 * token (api-jwt-auth and session-cookie-security specs).
 */
// `maxAgeMs` is REQUIRED, not optional. It was optional, and the refresh path
// dropped it — silently selecting the 2h default and downgrading every
// remembered session on its first refresh. A security-relevant lifetime that
// can be omitted will eventually be omitted; making the compiler ask for it
// is what stops that recurring.
export const issueAccessCookie = (res: Response, jwtPayload: JwtPayload, maxAgeMs: number): void => {
  const token = jwt.sign({ ...jwtPayload, typ: 'access' }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
  // The token's own `expiresIn` stays fixed; only the cookie's `maxAge`
  // follows the session, so the expired token survives in the jar as the
  // carrier logout reads `familyId` from.
  res.cookie(AUTH_COOKIE, token, accessCookieOptions(maxAgeMs));
};

export const issueRefreshCookie = (res: Response, plainToken: string, maxAge?: number): void => {
  res.cookie(REFRESH_COOKIE, plainToken, refreshCookieOptions(maxAge));
};

/**
 * Issues all 4 session cookies at login/register. `remember` governs the
 * refresh token and the CSRF/display cookies — the access cookie's TTL is
 * fixed while its cookie follows the session — see `issueAccessCookie`.
 */
export const setSessionCookies = (
  res: Response,
  userId: number,
  jwtPayload: JwtPayload,
  display: UserDisplayData,
  refreshPlainToken: string,
  remember?: boolean
): void => {
  issueAccessCookie(res, jwtPayload, authMaxAge(remember));

  const maxAge = authMaxAge(remember);
  const csrfToken = issueCsrfToken(userId);

  res.cookie(CSRF_COOKIE, csrfToken, cookieOptions({ httpOnly: false, maxAge }));
  res.cookie(USER_COOKIE, JSON.stringify(display), cookieOptions({ httpOnly: false, maxAge }));
  issueRefreshCookie(res, refreshPlainToken, maxAge);
};

/**
 * Shared by login/register: creates the RememberToken row and issues all 4
 * session cookies, embedding familyId in the access JWT so logout can revoke
 * it later without needing the path-scoped refresh cookie (see JwtPayload's
 * comment above). Takes the use case as an explicit argument rather than
 * closing over `this` — this is a free function, not a controller method.
 */
export const establishSession = async (
  res: Response,
  createRememberTokenUseCase: CreateRememberTokenUseCase | undefined,
  userDto: UserAuthDto,
  remember?: boolean
): Promise<void> => {
  if (!createRememberTokenUseCase) {
    throw new Error('CreateRememberTokenUseCase not injected');
  }

  const refreshPlainToken = generateRefreshToken();
  const rememberToken = await createRememberTokenUseCase.execute({
    idUser: userDto.idUser,
    plainToken: refreshPlainToken,
    durationSeconds: authMaxAge(remember) / 1000,
  });

  const payload = {
    userId: userDto.idUser,
    email: userDto.email,
    category: userDto.category,
    idRole: userDto.idRole,
    familyId: rememberToken.familyId ?? undefined,
  };

  setSessionCookies(
    res,
    userDto.idUser,
    payload,
    { firstName: userDto.firstName, image: userDto.image, idRole: userDto.idRole, category: userDto.category },
    refreshPlainToken,
    remember
  );
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
