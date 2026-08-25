import type { CookieOptions } from 'express';

// Single shared source of cookie names, lifetimes, and flags. Login,
// register, logout, and csrfGuard all consume this module so no
// maxAge/flag literal is duplicated across call sites (see design.md
// "Decision: Cookie flags" and "Decision: Recuérdame = 30 days").
export const AUTH_COOKIE = 'm3d_auth';
export const CSRF_COOKIE = 'm3d_csrf';
export const USER_COOKIE = 'm3d_user';

export const SESSION_MAX_AGE = 2 * 60 * 60 * 1000; // 2h, default session
export const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30d, "Recuérdame"

/**
 * Cookie `maxAge` (milliseconds) for the requested session kind.
 */
export function authMaxAge(remember?: boolean): number {
  return remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
}

/**
 * JWT `expiresIn` (seconds) for the requested session kind, derived from
 * the same constants as `authMaxAge` so the cookie lifetime and the token
 * lifetime never drift apart (design.md decision #6).
 */
export function authExpiresInSeconds(remember?: boolean): number {
  return authMaxAge(remember) / 1000;
}

interface CookieOptionsInput {
  httpOnly: boolean;
  maxAge?: number;
}

/**
 * Builds the shared `res.cookie` / `res.clearCookie` options. `httpOnly`
 * and `maxAge` vary per cookie/call; every other flag is identical across
 * `m3d_auth`, `m3d_csrf`, and `m3d_user` so clears never mismatch sets.
 */
export function cookieOptions({ httpOnly, maxAge }: CookieOptionsInput): CookieOptions {
  const options: CookieOptions = {
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  if (maxAge !== undefined) {
    options.maxAge = maxAge;
  }

  return options;
}
