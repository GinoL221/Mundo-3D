import type { CookieOptions } from 'express';
import { cookieOptions } from './cookieOptions';

export const DEMO_AUTH_COOKIE = 'm3d_demo_auth';
export const DEMO_AUTH_COOKIE_PATH = '/api/demo';
export const DEMO_REFRESH_COOKIE = 'm3d_demo_refresh';
export const DEMO_REFRESH_COOKIE_PATH = '/api/demo/session/refresh';
export const DEMO_CSRF_COOKIE = 'm3d_demo_csrf';
export const DEMO_CSRF_COOKIE_PATH = '/';

export const DEMO_SANDBOX_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const DEMO_SANDBOX_MAX_LIFETIME_MS = 45 * 60 * 1000;
export const DEMO_SANDBOX_ACCESS_TTL_SECONDS = 15 * 60;

export const demoAccessCookieOptions = (maxAge?: number): CookieOptions =>
  cookieOptions({ httpOnly: true, maxAge, path: DEMO_AUTH_COOKIE_PATH });

export const demoRefreshCookieOptions = (maxAge?: number): CookieOptions =>
  cookieOptions({ httpOnly: true, maxAge, path: DEMO_REFRESH_COOKIE_PATH });

export const demoCsrfCookieOptions = (maxAge?: number): CookieOptions =>
  cookieOptions({ httpOnly: false, maxAge, path: DEMO_CSRF_COOKIE_PATH });
