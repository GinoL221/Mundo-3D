import { API_URL } from './apiBase';

// Module-scoped single-flight guard (design.md D6, task 3.5). Several
// `fetch` calls on one page can hit 401 together; without de-duplication
// each would POST /api/users/refresh independently, and since every
// refresh rotates the token, all but one would present an
// already-superseded token. Collapsing them into one in-flight promise
// means only the first caller issues the request — every other concurrent
// caller awaits the SAME promise and gets the SAME outcome.
let inFlight: Promise<boolean> | null = null;

/**
 * Ensures the session has a fresh access token, POSTing to
 * `/api/users/refresh` (the httpOnly, path-scoped `m3d_refresh` cookie
 * authenticates the request — no CSRF header, no body) at most once per
 * in-flight window. Resolves `true` only on a genuine 2xx; any non-ok
 * response or a thrown `fetch` (network failure) resolves `false`, never
 * rejects — `authFetch` treats both identically (clear session, redirect).
 * `inFlight` is cleared in `finally` so a failed refresh does not poison
 * every later call: the very next caller gets a brand new attempt.
 */
export function ensureRefreshed(): Promise<boolean> {
  if (inFlight) return inFlight;

  // The async body runs synchronously up to its first `await`, so `fetch` is
  // issued in this same tick and `inFlight` is assigned before control can
  // return to any other caller — that ordering is the single-flight property
  // this module exists for. `try`/`catch` around the await also absorbs a
  // synchronous throw from a misconfigured test double, which real browsers
  // never do but which must not escape as a rejection either way: callers
  // are promised a boolean, never a rejected promise.
  inFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
