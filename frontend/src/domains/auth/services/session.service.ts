import { Role } from '../adapters/auth.adapter';

/**
 * Minimal shape read from the persisted `user` localStorage entry.
 * Centralized here so admin pages/components share one source of truth
 * for session reads and role checks instead of each redefining it.
 */
export interface SessionUser {
  idRole: number;
}

/**
 * Reads the current session user from localStorage. Returns null when
 * logged out (no token/user) or when the stored user JSON is malformed —
 * never throws.
 */
export function getSessionUser(): SessionUser | null {
  try {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (!token || !userJson) return null;
    return JSON.parse(userJson) as SessionUser;
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
 * Clears the persisted session (token + user). Used both by explicit
 * logout (Header.astro) and by admin pages reacting to a 401 from the API
 * (stale/invalid token) before redirecting to /login.
 */
export function clearSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
