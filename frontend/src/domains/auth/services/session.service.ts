import { API_URL, getSessionUser } from '../../../config';
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
 * Ends the server-side session: calls `POST /users/logout` (clears the
 * httpOnly auth cookie plus the CSRF/display cookies — CSRF-exempt, see
 * design.md), then broadcasts the change so other open tabs update their
 * gating without a reload. Best-effort: broadcasts even if the network call
 * fails, so the UI never gets stuck showing a stale logged-in state (same
 * "never block on cleanup" spirit as
 * backend/src/infrastructure/utils/cleanupUploadedFile.ts). Used both by
 * explicit logout (Header.astro) and by admin pages reacting to a 401 from
 * the API (stale/invalid session) before redirecting to /login.
 */
export async function clearSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Best-effort — still broadcast below so open tabs don't stay stuck
    // showing a logged-in UI.
  } finally {
    broadcastSessionChanged();
  }
}
