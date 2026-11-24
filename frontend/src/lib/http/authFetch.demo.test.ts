import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './apiBase';
import { apiFetch, authFetch, resetAuthFetchStateForTests } from './authFetch';
import { getSessionUser } from './credentials';
import { DEMO_CSRF_COOKIE_NAME, DEMO_STORAGE_KEY, type DemoSessionState } from './demoSessionState';

function stubEnv(initialCookie = '') {
  const cookies = new Map<string, string>();
  for (const part of initialCookie.split('; ').filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const store = new Map<string, string>();
  const assign = vi.fn();
  const events: CustomEvent[] = [];

  vi.stubGlobal('document', {
    get cookie() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(';').map((s) => s.trim());
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      const name = pair.slice(0, idx);
      if (attrs.some((a) => /^max-age=0$/i.test(a))) cookies.delete(name);
      else cookies.set(name, pair.slice(idx + 1));
    },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', {
    location: { assign },
    dispatchEvent: (e: Event) => events.push(e as CustomEvent),
  });
  return { cookies, store, assign, events };
}

describe('authFetch/apiFetch/getSessionUser in Demo Sandbox mode', () => {
  afterEach(() => {
    resetAuthFetchStateForTests();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('keeps apiFetch uncredentialed on normal mode and routes to /api/demo/* with m3d_demo_csrf in demo mode', async () => {
    stubEnv('');
    const plainFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', plainFetch);

    await apiFetch(`${API_URL}/api/products`);
    expect(plainFetch).toHaveBeenCalledWith(`${API_URL}/api/products`);

    const { store } = stubEnv(`m3d_csrf=prod.sig; ${DEMO_CSRF_COOKIE_NAME}=demo.sig`);
    const staffSession: DemoSessionState = {
      active: true,
      role: 'STAFF',
      user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 'staff@sandbox.invalid' },
      lease: {},
    };
    store.set(DEMO_STORAGE_KEY, JSON.stringify(staffSession));
    expect(getSessionUser()).toEqual({ idRole: 3, isDemo: true });

    const demoFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', demoFetch);
    await apiFetch(`${API_URL}/api/products`);

    expect(demoFetch).toHaveBeenCalledWith(
      `${API_URL}/api/demo/products`,
      expect.objectContaining({
        credentials: 'include',
        headers: { 'X-CSRF-Token': 'demo.sig' },
      }),
    );
  });

  it('retries once after demo refresh on 401 and expires demo cleanly without /login redirect or touching m3d_user', async () => {
    const { cookies, assign, events } = stubEnv(
      `m3d_user=${encodeURIComponent(JSON.stringify({ idRole: 2 }))}; ${DEMO_CSRF_COOKIE_NAME}=demo.sig`,
    );
    const refreshOk = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', refreshOk);

    const recovered = await authFetch(`${API_URL}/api/cart`, { method: 'PUT' });
    expect(recovered.status).toBe(200);
    expect(refreshOk.mock.calls[1]?.[0]).toBe(`${API_URL}/api/demo/session/refresh`);
    expect(refreshOk.mock.calls[2]?.[0]).toBe(`${API_URL}/api/demo/cart`);

    const refreshFail = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', refreshFail);

    const expired = await authFetch(`${API_URL}/api/orders`, { method: 'POST' });
    expect(expired.status).toBe(401);
    expect(assign).not.toHaveBeenCalled();
    expect(cookies.has(DEMO_CSRF_COOKIE_NAME)).toBe(false);
    expect(cookies.has('m3d_user')).toBe(true);
    expect(events.some((e) => e.detail?.reason === 'expired')).toBe(true);
  });
});
