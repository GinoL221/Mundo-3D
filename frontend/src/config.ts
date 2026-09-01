export const API_URL = import.meta.env.PUBLIC_API_URL || (typeof window !== 'undefined' && window.location.port === '4322' ? 'http://localhost:3032' : 'http://localhost:3031');

// The functions below are genuinely cross-domain (consumed by `cart`,
// `products`, and `auth`), so they live here rather than under
// `domains/auth/` — the architecture boundary check
// (`backend/tools/architecture/check.js`, `frontend.domain.locality` rule)
// only allows a `frontend/src/domains/<X>/` file to import from its own
// domain or from this file. `session.service.ts`/`csrf.ts` re-export these
// so existing auth-domain imports keep working unchanged.

const CSRF_COOKIE_NAME = 'm3d_csrf';
const USER_COOKIE_NAME = 'm3d_user';

function readCookie(name: string): string | null {
  const entry = document.cookie.split('; ').find((piece) => piece.startsWith(`${name}=`));
  if (!entry) return null;
  return entry.slice(name.length + 1) || null;
}

/**
 * Reads the non-httpOnly `m3d_csrf` cookie set by the backend on
 * login/register. The value is an opaque signed string
 * (`<random>.<hmac>` — see backend's csrfToken.ts) and must be read
 * verbatim, no parsing needed. Returns null when absent (guest, or before
 * the first login).
 */
export function readCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE_NAME);
}

/**
 * Merges credentialed-request settings into a fetch `RequestInit`: always
 * sends the browser's cookies (`credentials: 'include'`) and, when a CSRF
 * cookie is present, attaches it as `X-CSRF-Token` so the backend's
 * `csrfGuard` accepts the request (design.md "Decision: CSRF = signed
 * double-submit cookie"). Generic/reusable — every state-changing request
 * against the API needs this (consumed by CartService/product.admin.service).
 */
export function withCredentials(init: RequestInit = {}): RequestInit {
  const token = readCsrfToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };

  if (token) {
    headers['X-CSRF-Token'] = token;
  }

  return {
    ...init,
    credentials: 'include',
    headers,
  };
}

/**
 * The error envelope the API returns on any non-2xx response. `errors`
 * carries express-validator's two shapes: a field-keyed map, or an array of
 * field errors. Lives here rather than in a domain because both `auth` and
 * `products` read it, and the architecture boundary check
 * (`frontend.domain.locality`) only lets a domain import from its own
 * folder or from this file.
 */
export interface APIFieldError {
  msg?: string;
}

export interface APIErrorBody {
  error?: string;
  message?: string;
  errors?: Record<string, APIFieldError> | APIFieldError[];
}

/**
 * Extracts a human-readable message from an API error body, preferring the
 * most specific source available: the first express-validator field error,
 * then a root `error`/`message`, then the caller's fallback. Never throws —
 * a malformed or absent body yields the fallback.
 */
export function readApiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback;

  const { errors, error, message } = body as APIErrorBody;

  if (Array.isArray(errors)) {
    const msg = errors[0]?.msg;
    if (msg) return msg;
  } else if (typeof errors === 'object' && errors !== null) {
    const msg = Object.values(errors)[0]?.msg;
    if (msg) return msg;
  }

  return error || message || fallback;
}

/**
 * Minimal shape read from the non-httpOnly `m3d_user` display cookie.
 * Centralized here so admin pages/components share one source of truth
 * for session reads and role checks instead of each redefining it.
 */
export interface SessionUser {
  idRole: number;
}

/**
 * Reads the current session user from the `m3d_user` cookie (design.md
 * "Decision: Display data in a non-httpOnly m3d_user cookie"). Returns null
 * when logged out (no cookie) or when the stored value is malformed —
 * never throws. Express's `res.cookie` URL-encodes the value by default, so
 * it must be decoded before parsing.
 */
export function getSessionUser(): SessionUser | null {
  try {
    const raw = readCookie(USER_COOKIE_NAME);
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}
