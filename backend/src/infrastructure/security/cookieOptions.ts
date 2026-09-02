import type { CookieOptions } from 'express';

// Single shared source of cookie names, lifetimes, and flags. Login,
// register, logout, and csrfGuard all consume this module so no
// maxAge/flag literal is duplicated across call sites (see design.md
// "Decision: Cookie flags" and "Decision: Recuérdame = 30 days").
export const AUTH_COOKIE = 'm3d_auth';
export const CSRF_COOKIE = 'm3d_csrf';
export const USER_COOKIE = 'm3d_user';
// Refresh Token Rotation (HIGH-1, design.md D4). Path-scoped so the browser
// never sends it to any route but the refresh endpoint itself.
export const REFRESH_COOKIE = 'm3d_refresh';
export const REFRESH_COOKIE_PATH = '/api/users/refresh'; // app.js mounts apiRouter at '/api'

export const SESSION_MAX_AGE = 2 * 60 * 60 * 1000; // 2h, default refresh-token session
export const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30d, "Recuérdame"

// Access-token TTL, fixed regardless of "remember me" (api-jwt-auth spec:
// "Access token TTL is fixed regardless of remember"). Env-tunable — this is
// the no-deploy rollback lever (design.md D4).
export const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 30 * 60;

/**
 * Cookie `maxAge` (milliseconds) for the requested session kind. Now governs
 * the refresh token and the CSRF/display cookies — NOT the access token,
 * whose TTL is fixed (`ACCESS_TOKEN_TTL_SECONDS`, see `accessCookieOptions`).
 */
export function authMaxAge(remember?: boolean): number {
  return remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
}

interface CookieOptionsInput {
  httpOnly: boolean;
  maxAge?: number;
  // Defaults to '/' — every pre-existing call is unchanged. Only the refresh
  // cookie overrides it (design.md D4).
  path?: string;
}

/**
 * Builds the shared `res.cookie` / `res.clearCookie` options. `httpOnly`,
 * `maxAge`, and `path` vary per cookie/call; every other flag is identical
 * across `m3d_auth`, `m3d_csrf`, `m3d_user`, and `m3d_refresh` so clears
 * never mismatch sets.
 */
export function cookieOptions({ httpOnly, maxAge, path = '/' }: CookieOptionsInput): CookieOptions {
  const options: CookieOptions = {
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  if (maxAge !== undefined) {
    options.maxAge = maxAge;
  }

  return options;
}

/**
 * `m3d_auth` (access token) options: httpOnly, default path, fixed TTL.
 * One named builder used for both the set and the (implicit, via
 * `cookieOptions`) clear, so the flags can never drift apart (design.md D4).
 */
export const accessCookieOptions = (): CookieOptions =>
  cookieOptions({ httpOnly: true, maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000 });

/**
 * `m3d_refresh` options: httpOnly, path-scoped to the refresh route. Called
 * with no `maxAge` for a clear — `logout`/`clearSessionCookies` do exactly
 * that, so a clear can never miss because it used a different path/flag set
 * than the original set (design.md D4).
 */
export const refreshCookieOptions = (maxAge?: number): CookieOptions =>
  cookieOptions({ httpOnly: true, maxAge, path: REFRESH_COOKIE_PATH });
