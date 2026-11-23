import { API_URL } from './apiBase';
import {
  expireClientReadableSessionCookies,
  getSessionUser,
  withCredentials,
} from './credentials';
import { ensureRefreshed } from './refreshSingleFlight';

const SESSION_BROADCAST_CHANNEL = 'm3d-session';

let sessionTerminationInFlight = false;

/**
 * Resets module-level single-flight teardown state between unit tests.
 */
export function resetAuthFetchStateForTests(): void {
  sessionTerminationInFlight = false;
}

function broadcastSessionLoggedOut(): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
    try {
      channel.postMessage({ type: 'session-changed', state: 'logged-out' });
    } finally {
      channel.close();
    }
  } catch {
    // BroadcastChannel unsupported — visibilitychange/focus fallback in
    // sessionUI.ts covers this case.
  }
}

/**
 * Single-source-of-truth, single-flight session teardown and redirect on an
 * unrecoverable authenticated 401 (either failed refresh or 401 on the retried
 * request).
 *
 * Deliberately does NOT import `session.service.ts`'s `clearSession()`:
 * `config.ts` re-exports `authFetch` (design.md D6), and `session.service.ts`
 * imports `config.ts` itself, so routing through it here would recreate the
 * import cycle D6 designed `lib/http` to avoid. Instead, it performs the exact
 * same synchronous local cleanup (`expireClientReadableSessionCookies()` +
 * `BroadcastChannel('m3d-session')` `logged-out` broadcast), fires keepalive
 * `/api/users/logout` + `/api/users/refresh/revoke` once, and redirects to
 * `/login` once.
 */
function endSessionAndRedirect(): void {
  if (sessionTerminationInFlight) return;
  sessionTerminationInFlight = true;

  expireClientReadableSessionCookies();
  broadcastSessionLoggedOut();

  // Wrapped in `Promise.allSettled` (rather than relying on `fetch` always
  // returning a thenable) purely so a misconfigured test double can never
  // make this throw synchronously and skip the redirect below.
  // Calls both /api/users/logout (general teardown) and the scoped
  // /api/users/refresh/revoke endpoint (odd/tasks/logout-refresh-revocation.md
  // S2) so the refresh family is revoked even when no access token cookie
  // is present. keepalive ensures the requests outlive the navigation.
  Promise.allSettled([
    fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }),
    fetch(`${API_URL}/api/users/refresh/revoke`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    }),
  ]).catch(() => {
    // Best-effort — the redirect below happens regardless.
  });

  // Guarded for the SSR/test environment, where `window` (or a minimal
  // stand-in without `location`) is what's globally available (same
  // convention as cartSync.ts's self-register guard).
  if (typeof window !== 'undefined' && typeof window.location?.assign === 'function') {
    window.location.assign('/login');
  }
}

/**
 * Credentialed fetch with transparent access-token refresh (design.md D6,
 * refresh-token-rotation spec). On a 401, attempts exactly one refresh via
 * the shared single-flight `ensureRefreshed()` and retries the ORIGINAL
 * request exactly once, re-running `withCredentials` so the CSRF header is
 * re-read. Never retries a second time and never wraps the refresh call
 * itself (`ensureRefreshed` posts through bare `fetch`).
 *
 * When a session existed (`hadSession`) and either the refresh fails OR the
 * retried request still returns 401, this function is the single owner of
 * session teardown and `/login` redirect (via single-flight
 * `endSessionAndRedirect()`), then still returns the 401 response so callers
 * can exit silently without showing error banners or firing duplicate
 * redirects. Guests (`!hadSession`) are never logged out or redirected.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const first = await fetch(url, withCredentials(init));

  if (first.status !== 401) return first;

  // Capture session presence BEFORE refresh/teardown. `CartList.astro`
  // hydrates the cart on load for EVERY visitor, so a guest issues a
  // credentialed GET, gets 401, and fails a refresh it never had a token for
  // — bouncing them to /login would evict a visitor who was never logged in.
  const hadSession = Boolean(getSessionUser());
  const refreshed = await ensureRefreshed();

  if (!refreshed) {
    if (hadSession) {
      try {
        endSessionAndRedirect();
      } catch {
        // Never let a redirect/logout-call failure turn into an authFetch
        // rejection — callers must see the original 401 either way.
      }
    }
    return first;
  }

  const retried = await fetch(url, withCredentials(init));

  if (retried.status === 401 && hadSession) {
    try {
      endSessionAndRedirect();
    } catch {
      // Never let a redirect/logout-call failure turn into an authFetch
      // rejection — callers still receive the retried 401.
    }
  }

  return retried;
}
