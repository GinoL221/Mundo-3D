import { API_URL } from './apiBase';
import { getSessionUser, withCredentials } from './credentials';
import { ensureRefreshed } from './refreshSingleFlight';

/**
 * Ends the session locally on a failed refresh and redirects to `/login`.
 * Best-effort POST to `/api/users/logout` — safe even though the refresh
 * already failed, since logout is idempotent and always 204 with no active
 * session (see `UserApiController.logout`'s own doc comment). The redirect
 * never waits on that network call, mirroring `sessionUI.ts`'s own logout
 * handler ("redirect never blocks on the network call").
 *
 * Deliberately does NOT import `session.service.ts`'s `clearSession()`:
 * `config.ts` re-exports `authFetch` (design.md D6), and `session.service.ts`
 * imports `config.ts` itself, so routing through it here would recreate
 * exactly the import cycle D6 designed `lib/http` to avoid. This means an
 * open tab does not get the cross-tab `session-changed` broadcast that
 * `clearSession()` sends — an accepted trade-off, documented in
 * apply-progress, since that tab is about to hard-navigate away anyway.
 */
function endSessionAndRedirect(): void {
  // Wrapped in `Promise.resolve` (rather than relying on `fetch` always
  // returning a thenable) purely so a misconfigured test double can never
  // make this throw synchronously and skip the redirect below.
  Promise.resolve(fetch(`${API_URL}/api/users/logout`, { method: 'POST', credentials: 'include' })).catch(() => {
    // Best-effort — the redirect below happens regardless.
  });

  // Guarded for the SSR/test environment, where `window` (or a minimal
  // stand-in without `location`) is what's globally available (same
  // convention as cartSync.ts's self-register guard).
  if (typeof window !== 'undefined' && window.location) {
    window.location.href = '/login';
  }
}

/**
 * Credentialed fetch with transparent access-token refresh (design.md D6,
 * refresh-token-rotation spec). On a 401, attempts exactly one refresh via
 * the shared single-flight `ensureRefreshed()` and retries the ORIGINAL
 * request exactly once, re-running `withCredentials` so the CSRF header is
 * re-read. Never retries a second time — a 401 on the retried request is
 * returned to the caller as-is, exactly like today's plain-`fetch` call
 * sites already handle it. Never wraps the refresh call itself:
 * `ensureRefreshed` posts through the bare `fetch`, so a failed refresh can
 * never recurse back into `authFetch`.
 *
 * On a failed refresh (no valid refresh cookie — the session is genuinely
 * over) it ends the session and redirects to `/login`, then still returns
 * the original 401 so a caller's own 401 handling (several admin pages
 * already redirect on `ProductAdminApiError.status === 401`) degrades
 * gracefully rather than seeing an unexpected shape.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const first = await fetch(url, withCredentials(init));

  if (first.status !== 401) return first;

  const refreshed = await ensureRefreshed();

  // Only end a session that actually existed. `CartList.astro` hydrates the
  // cart on load for EVERY visitor, so a guest issues a credentialed GET,
  // gets 401, and fails a refresh it never had a token for — bouncing them to
  // /login would evict a visitor who was never logged in. With no session the
  // 401 is simply returned and the caller decides what it means.
  if (!refreshed && !getSessionUser()) {
    return first;
  }

  if (!refreshed) {
    try {
      endSessionAndRedirect();
    } catch {
      // Never let a redirect/logout-call failure turn into an authFetch
      // rejection — callers must see the original 401 either way, exactly
      // like today's plain-fetch call sites already handle it.
    }
    return first;
  }

  return fetch(url, withCredentials(init));
}
