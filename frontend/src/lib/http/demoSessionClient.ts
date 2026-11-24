import { API_URL } from './apiBase';
import {
  clearDemoSession,
  isValidDemoSession,
  persistDemoSession,
  readDemoCsrfToken,
  saveDemoSession,
  type DemoSessionState,
} from './demoSessionState';

export type StartDemoSessionResult =
  | { ok: true; session: DemoSessionState }
  | {
      ok: false;
      reason: 'disabled' | 'busy' | 'rate-limit' | 'error';
      retryAfterSeconds?: number;
    };

export type HydrateDemoSessionResult =
  | { status: 'inactive' }
  | { status: 'active'; session: DemoSessionState }
  | { status: 'expired' }
  | { status: 'disabled' };

let demoRefreshInFlight: Promise<boolean> | null = null;

export function ensureDemoRefreshed(): Promise<boolean> {
  if (demoRefreshInFlight) return demoRefreshInFlight;
  demoRefreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/demo/session/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      try {
        const body: unknown = await res.json();
        if (isValidDemoSession(body)) persistDemoSession(body);
      } catch {
        // Refresh succeeded even if body is empty in a test stub.
      }
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    demoRefreshInFlight = null;
  });
  return demoRefreshInFlight;
}

export async function checkDemoAvailability(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/demo/status`, { method: 'GET' });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: unknown };
    return body?.enabled === true;
  } catch {
    return false;
  }
}

export async function startDemoSession(): Promise<StartDemoSessionResult> {
  try {
    const res = await fetch(`${API_URL}/api/demo/session`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.status === 404) return { ok: false, reason: 'disabled' };
    if (res.status === 503) {
      const retryRaw = Number.parseInt(res.headers.get('Retry-After') ?? '', 10);
      const retryAfterSeconds = Number.isFinite(retryRaw) && retryRaw > 0 ? retryRaw : 30;
      return { ok: false, reason: 'busy', retryAfterSeconds };
    }
    if (res.status === 429) return { ok: false, reason: 'rate-limit' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const body: unknown = await res.json();
    if (!isValidDemoSession(body)) return { ok: false, reason: 'error' };
    saveDemoSession(body, 'started');
    return { ok: true, session: body };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function hydrateDemoSession(): Promise<HydrateDemoSessionResult> {
  if (!readDemoCsrfToken()) {
    persistDemoSession(null);
    return { status: 'inactive' };
  }
  try {
    let res = await fetch(`${API_URL}/api/demo/session`, {
      method: 'GET',
      credentials: 'include',
    });
    if (res.status === 401) {
      const refreshed = await ensureDemoRefreshed();
      if (!refreshed) {
        clearDemoSession('expired');
        return { status: 'expired' };
      }
      res = await fetch(`${API_URL}/api/demo/session`, {
        method: 'GET',
        credentials: 'include',
      });
    }
    if (res.status === 404) {
      clearDemoSession('disabled');
      return { status: 'disabled' };
    }
    if (res.status === 401) {
      clearDemoSession('expired');
      return { status: 'expired' };
    }
    if (!res.ok) return { status: 'inactive' };
    const body: unknown = await res.json();
    if (!isValidDemoSession(body)) return { status: 'inactive' };
    saveDemoSession(body, 'updated');
    return { status: 'active', session: body };
  } catch {
    return { status: 'inactive' };
  }
}

export async function endDemoSession(): Promise<void> {
  const token = readDemoCsrfToken();
  clearDemoSession('ended');
  try {
    const headers: Record<string, string> = {};
    if (token) headers['X-CSRF-Token'] = token;
    await fetch(`${API_URL}/api/demo/session`, {
      method: 'DELETE',
      credentials: 'include',
      keepalive: true,
      headers,
    });
  } catch {
    // Best-effort: local demo state is already cleared.
  }
}
