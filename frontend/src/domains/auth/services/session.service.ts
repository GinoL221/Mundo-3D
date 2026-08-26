import { API_URL } from '../../../config';
import { Role } from '../adapters/auth.adapter';

// Mirrors backend/src/infrastructure/security/cookieOptions.ts USER_COOKIE.
const USER_COOKIE_NAME = 'm3d_user';
const SESSION_BROADCAST_CHANNEL = 'm3d-session';

/**
 * Minimal shape read from the non-httpOnly `m3d_user` display cookie.
 * Centralized here so admin pages/components share one source of truth
 * for session reads and role checks instead of each redefining it.
 */
export interface SessionUser {
  idRole: number;
}

function readCookie(name: string): string | null {
  const entry = document.cookie.split('; ').find((piece) => piece.startsWith(`${name}=`));
  if (!entry) return null;
  return entry.slice(name.length + 1) || null;
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
 * Ends the server-side session: calls `POST /users/logout` (clears the
 * httpOnly auth cookie plus the CSRF/display cookies — CSRF-exempt, see
 * design.md), then broadcasts the change on `BroadcastChannel('m3d-session')`
 * so other open tabs update their gating without a reload (design.md
 * "Decision: Cross-tab sync"). Best-effort: broadcasts even if the network
 * call fails, so the UI never gets stuck showing a stale logged-in state
 * (same "never block on cleanup" spirit as
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
    try {
      new BroadcastChannel(SESSION_BROADCAST_CHANNEL).postMessage({ type: 'session-changed' });
    } catch {
      // BroadcastChannel unsupported — visibilitychange/focus fallback in
      // sessionUI.ts covers this case.
    }
  }
}
