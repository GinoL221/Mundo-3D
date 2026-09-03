import { API_URL, expireClientReadableSessionCookies, getSessionUser } from '../../../config';
import type { SessionUser } from '../../../config';
import { Role } from '../adapters/auth.adapter';

// `getSessionUser`/`SessionUser` live in `config.ts` (cross-domain shared
// utility — see its own comment for why) and are re-exported here so
// existing auth-domain imports and the `domains/auth` barrel keep working
// unchanged.
export { getSessionUser };
export type { SessionUser };

const SESSION_BROADCAST_CHANNEL = 'm3d-session';

/**
 * True when the user has admin-area access — ADMIN or STAFF. Used to gate
 * the admin product pages and the admin nav link (presentation-layer only;
 * the API's `requireRoles` guard is the real security boundary).
 */
export function hasAdminAccess(user: SessionUser | null): boolean {
  return user?.idRole === Role.ADMIN || user?.idRole === Role.STAFF;
}

/**
 * True only for ADMIN. Used to gate ADMIN-only controls (e.g. delete)
 * that STAFF must not see.
 */
export function isAdminOnly(user: SessionUser | null): boolean {
  return user?.idRole === Role.ADMIN;
}

/**
 * Broadcasts a session change on `BroadcastChannel('m3d-session')` so other
 * open tabs re-read their cookies and update their gating without a reload
 * (design.md "Decision: Cross-tab sync"). Used symmetrically by both
 * directions of a session change — login/register (LoginForm.astro,
 * RegisterForm.astro) and logout (clearSession() below) — so cross-tab sync
 * doesn't depend on the focus/visibilitychange fallback layer in
 * sessionUI.ts, which real browsers only fire on an actual tab switch.
 */
export function broadcastSessionChanged(): void {
  try {
    new BroadcastChannel(SESSION_BROADCAST_CHANNEL).postMessage({ type: 'session-changed' });
  } catch {
    // BroadcastChannel unsupported — visibilitychange/focus fallback in
    // sessionUI.ts covers this case.
  }
}

/**
 * Ends the session, in two halves that deliberately do not depend on each
 * other. First, synchronously: expire the readable cookies and broadcast, so
 * this tab and every other open one show guest UI immediately. Then
 * `POST /users/logout` (CSRF-exempt, see design.md), which revokes the
 * refresh family and clears the httpOnly cookies — the half only the server
 * can do, sent with `keepalive` so it completes even though the caller
 * navigates away without awaiting it.
 *
 * The ordering is the point: broadcasting after the response, as this once
 * did, means a tab that navigates away never broadcasts at all. Best-effort
 * throughout (same "never block on cleanup" spirit as
 * backend/src/infrastructure/utils/cleanupUploadedFile.ts). Used both by
 * explicit logout (Header.astro) and by admin pages reacting to a 401 from
 * the API (stale/invalid session) before redirecting to /login.
 */
export async function clearSession(): Promise<void> {
  // Both of these run BEFORE the request, not after it. sessionUI.ts's
  // handler calls clearSession() without awaiting and then assigns
  // window.location.href, so this tab is typically destroyed long before the
  // response lands — anything sequenced after the await may never run at
  // all. Ending the session in the UI must therefore not depend on the
  // network: expire the readable cookies, then tell the other tabs to
  // re-read them.
  expireClientReadableSessionCookies();
  broadcastSessionChanged();

  try {
    // Deliberately plain `fetch`, not `authFetch` (design.md D6, task
    // 3.10): this IS one of the 3 excluded auth endpoints — logout always
    // returns 204 "with no active session" (see the doc comment above), so
    // a 401 here would mean something is already broken, and retrying it
    // via a refresh attempt would loop.
    //
    // `keepalive` is load-bearing: the handler revokes the refresh family in
    // the database before it clears cookies and replies, so the response is
    // a database round trip away. Without keepalive the pending navigation
    // cancels it, the httpOnly cookies are never cleared, and the browser
    // keeps presenting credentials for a session the server already killed.
    //
    // Unlike cartSync.ts's PUT, this carries no custom headers and no body,
    // so it stays a CORS "simple request" and keepalive is not defeated by
    // an unsent preflight.
    await fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    });
  } catch {
    // Best-effort: the session is already gone from this browser's point of
    // view, and every open tab has been told. Nothing left to undo.
  }
}
