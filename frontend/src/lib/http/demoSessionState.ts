import { API_URL } from './apiBase';

export const DEMO_CSRF_COOKIE_NAME = 'm3d_demo_csrf';
export const DEMO_STORAGE_KEY = 'm3d_demo_session';
export const DEMO_BROADCAST_CHANNEL = 'm3d-demo-session';
export const DEMO_SESSION_EVENT = 'demo-session-changed';
export const DEMO_TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type DemoRole = 'USER' | 'STAFF' | 'ADMIN';
export type DemoChangeReason =
  | 'started'
  | 'updated'
  | 'ended'
  | 'expired'
  | 'disabled'
  | 'role-changed';

export interface DemoSessionUser {
  idUser: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface DemoSessionLease {
  allocatedAt?: string;
  idleExpiresAt?: string;
  absoluteExpiresAt?: string;
}

export interface DemoSessionState {
  active: true;
  role: DemoRole;
  user: DemoSessionUser;
  lease: DemoSessionLease;
}

export interface DemoSessionChangedMessage {
  type: 'demo-session-changed';
  reason: DemoChangeReason;
  senderId?: string;
}

const DEMO_ROUTE_RE =
  /^(\/api)(\/(?:products|product|categories|franchises|cart|orders|custom-commission-requests)(?:$|[/?])|\/users(?:\/(?:me|\d+))?(?:$|[?]))/;

function readRawCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find((piece) => piece.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) || null : null;
}

function demoExpiryScopes(): string[] {
  const scopes = [''];
  const hostname = typeof location === 'undefined' ? '' : (location?.hostname ?? '');
  const labels = hostname.split('.').filter(Boolean);
  for (let i = 0; i < labels.length - 1; i += 1) {
    scopes.push(`; domain=${labels.slice(i).join('.')}`);
  }
  return scopes;
}

function normalizeHeaders(input: HeadersInit | undefined): Record<string, string> {
  if (!input) return {};
  if (input instanceof Headers) {
    const out: Record<string, string> = {};
    input.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return { ...input };
}

export function readDemoCsrfToken(): string | null {
  return readRawCookie(DEMO_CSRF_COOKIE_NAME);
}

export function isDemoSessionActive(): boolean {
  return readDemoCsrfToken() !== null;
}

export function demoRoleToId(role: DemoRole): number {
  if (role === 'ADMIN') return 1;
  if (role === 'STAFF') return 3;
  return 2;
}

export function isValidDemoSession(value: unknown): value is DemoSessionState {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (
    record.active !== true ||
    (record.role !== 'USER' && record.role !== 'STAFF' && record.role !== 'ADMIN')
  ) {
    return false;
  }
  if (typeof record.user !== 'object' || record.user === null) return false;
  const user = record.user as Record<string, unknown>;
  return typeof user.idUser === 'number' && typeof user.firstName === 'string';
}

export function persistDemoSession(session: DemoSessionState | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (session) sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Storage unavailable (sandboxed/private mode) — cookie still anchors active state.
  }
}

export function isDemoSessionPendingHydration(): boolean {
  if (!readDemoCsrfToken()) return false;
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return true;
    return !isValidDemoSession(JSON.parse(raw));
  } catch {
    return true;
  }
}

export function notifyDemoSessionChanged(
  reason: DemoChangeReason,
  options: { broadcast?: boolean } = {},
): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(DEMO_SESSION_EVENT, { detail: { reason } }));
    }
  } catch {
    // Non-browser environment.
  }
  if (options.broadcast === false) return;
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(DEMO_BROADCAST_CHANNEL);
    try {
      const msg: DemoSessionChangedMessage = {
        type: 'demo-session-changed',
        reason,
        senderId: DEMO_TAB_ID,
      };
      channel.postMessage(msg);
    } finally {
      channel.close();
    }
  } catch {
    // BroadcastChannel unavailable.
  }
}

export function saveDemoSession(
  session: DemoSessionState,
  reason: DemoChangeReason = 'updated',
  options?: { broadcast?: boolean },
): void {
  persistDemoSession(session);
  notifyDemoSessionChanged(reason, options);
}

export function getDemoSession(): DemoSessionState | null {
  if (!readDemoCsrfToken()) {
    persistDemoSession(null);
    return null;
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isValidDemoSession(parsed)) return parsed;
      }
    }
  } catch {
    // Fall back to cookie-derived minimal Buyer state until hydration runs.
  }
  return {
    active: true,
    role: 'USER',
    user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: '' },
    lease: {},
  };
}

export function expireDemoCsrfCookie(): void {
  try {
    if (typeof document === 'undefined') return;
    for (const scope of demoExpiryScopes()) {
      document.cookie = `${DEMO_CSRF_COOKIE_NAME}=; Max-Age=0; path=/${scope}`;
    }
  } catch {
    // Best-effort local cleanup.
  }
}

export function clearDemoSession(reason: DemoChangeReason = 'ended'): void {
  expireDemoCsrfCookie();
  persistDemoSession(null);
  notifyDemoSessionChanged(reason);
}

export function isDemoApiUrl(url: string): boolean {
  return url.startsWith(`${API_URL}/api/demo/`) || url.startsWith('/api/demo/');
}

export function rewriteDemoApiUrl(url: string): string {
  if (isDemoApiUrl(url)) return url;
  if (url.startsWith(`${API_URL}/api/`)) {
    const suffix = url.slice(API_URL.length);
    const rewritten = suffix.replace(DEMO_ROUTE_RE, '$1/demo$2');
    return rewritten === suffix ? url : `${API_URL}${rewritten}`;
  }
  if (url.startsWith('/api/')) {
    return url.replace(DEMO_ROUTE_RE, '$1/demo$2');
  }
  return url;
}

export function withDemoCredentials(init: RequestInit = {}): RequestInit {
  const token = readDemoCsrfToken();
  const headers = normalizeHeaders(init.headers);
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'x-csrf-token') delete headers[key];
  }
  if (token) headers['X-CSRF-Token'] = token;
  return { ...init, credentials: 'include', headers };
}
