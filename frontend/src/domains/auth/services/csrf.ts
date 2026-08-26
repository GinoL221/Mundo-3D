// Mirrors backend/src/infrastructure/security/cookieOptions.ts CSRF_COOKIE.
// Frontend and backend are separate packages (no cross-package import), so
// the name is duplicated here intentionally.
const CSRF_COOKIE_NAME = 'm3d_csrf';

/**
 * Reads the non-httpOnly `m3d_csrf` cookie set by the backend on
 * login/register. The value is an opaque signed string
 * (`<random>.<hmac>` — see backend's csrfToken.ts) and must be read
 * verbatim, no parsing needed. Returns null when absent (guest, or before
 * the first login).
 */
export function readCsrfToken(): string | null {
  const entry = document.cookie
    .split('; ')
    .find((piece) => piece.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!entry) return null;

  return entry.slice(CSRF_COOKIE_NAME.length + 1) || null;
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
