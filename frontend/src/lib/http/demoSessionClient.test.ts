import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './apiBase';
import {
  checkDemoAvailability,
  endDemoSession,
  ensureDemoRefreshed,
  hydrateDemoSession,
  startDemoSession,
  switchDemoRole,
} from './demoSessionClient';
import { DEMO_CSRF_COOKIE_NAME, DEMO_STORAGE_KEY, type DemoSessionState } from './demoSessionState';

function stubEnv(initialCookie = '') {
  const cookies = new Map<string, string>();
  for (const part of initialCookie.split('; ').filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const store = new Map<string, string>();
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
    dispatchEvent: (e: Event) => events.push(e as CustomEvent),
  });
  return { cookies, store, events };
}

const buyerSession: DemoSessionState = {
  active: true,
  role: 'USER',
  user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'demo.buyer@sandbox.invalid' },
  lease: { idleExpiresAt: '2026-11-24T01:00:00.000Z' },
};

describe('demoSessionClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('checks availability via GET /api/demo/status and handles 404/network honestly', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true }), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockRejectedValueOnce(new Error('offline')),
    );
    await expect(checkDemoAvailability()).resolves.toBe(true);
    await expect(checkDemoAvailability()).resolves.toBe(false);
    await expect(checkDemoAvailability()).resolves.toBe(false);
  });

  it('starts demo session and distinguishes 404 disabled, 503 busy (Retry-After), and 429', async () => {
    const { store } = stubEnv();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(buyerSession), { status: 201 }))
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'DEMO_SANDBOX_BUSY' }), {
            status: 503,
            headers: { 'Retry-After': '45' },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 429 })),
    );

    await expect(startDemoSession()).resolves.toEqual({ ok: true, session: buyerSession });
    expect(store.has(DEMO_STORAGE_KEY)).toBe(true);
    await expect(startDemoSession()).resolves.toEqual({ ok: false, reason: 'disabled' });
    await expect(startDemoSession()).resolves.toEqual({
      ok: false,
      reason: 'busy',
      retryAfterSeconds: 45,
    });
    await expect(startDemoSession()).resolves.toEqual({ ok: false, reason: 'rate-limit' });
  });

  it('hydrates active demo session, refreshes on 401, and clears on unrecoverable expiry or 404', async () => {
    const { cookies } = stubEnv(`${DEMO_CSRF_COOKIE_NAME}=demo.tok`);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(buyerSession), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(buyerSession), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(hydrateDemoSession()).resolves.toEqual({
      status: 'active',
      session: buyerSession,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })));
    await expect(hydrateDemoSession()).resolves.toEqual({ status: 'disabled' });
    expect(cookies.has(DEMO_CSRF_COOKIE_NAME)).toBe(false);
  });

  it('deduplicates concurrent demo refreshes via single-flight POST /api/demo/session/refresh', async () => {
    stubEnv(`${DEMO_CSRF_COOKIE_NAME}=demo.tok`);
    let resolveFetch!: (res: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p1 = ensureDemoRefreshed();
    const p2 = ensureDemoRefreshed();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/demo/session/refresh`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    resolveFetch(new Response(JSON.stringify(buyerSession), { status: 200 }));
    await expect(Promise.all([p1, p2])).resolves.toEqual([true, true]);
  });

  it('switches demo role via POST /api/demo/session/role with CSRF, emits role-changed, retries once on 401, and handles 403/401', async () => {
    const { cookies, events } = stubEnv(`${DEMO_CSRF_COOKIE_NAME}=demo.r1`);
    const staffSession: DemoSessionState = {
      ...buyerSession,
      role: 'STAFF',
      user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 'demo.staff@sandbox.invalid' },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockImplementationOnce(async () => {
        document.cookie = `${DEMO_CSRF_COOKIE_NAME}=demo.r2; path=/`;
        return new Response(JSON.stringify(buyerSession), { status: 200 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify(staffSession), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(switchDemoRole('STAFF')).resolves.toEqual({ ok: true, session: staffSession });
    expect(events.at(-1)?.detail).toEqual({ reason: 'role-changed' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${API_URL}/api/demo/session/role`,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'demo.r2' },
        body: JSON.stringify({ role: 'STAFF' }),
      }),
    );
    await expect(switchDemoRole('USER')).resolves.toEqual({ ok: false, reason: 'forbidden' });
    await expect(switchDemoRole('USER')).resolves.toEqual({ ok: false, reason: 'expired' });
    expect(cookies.has(DEMO_CSRF_COOKIE_NAME)).toBe(false);
  });

  it('does not broadcast to BroadcastChannel during hydrateDemoSession (prevents cross-tab loops)', async () => {
    stubEnv(`${DEMO_CSRF_COOKIE_NAME}=demo.tok`);
    const postMessage = vi.fn();
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        postMessage = postMessage;
        close = vi.fn();
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(buyerSession), { status: 200 })),
    );

    await expect(hydrateDemoSession()).resolves.toEqual({ status: 'active', session: buyerSession });
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('distinguishes transient 5xx/network errors from definitive inactive and skips persisting if ended in flight', async () => {
    const { cookies, store } = stubEnv(`${DEMO_CSRF_COOKIE_NAME}=demo.tok`);
    store.set(DEMO_STORAGE_KEY, JSON.stringify(buyerSession));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })));
    await expect(hydrateDemoSession()).resolves.toEqual({ status: 'error' });
    expect(store.has(DEMO_STORAGE_KEY)).toBe(true);
    expect(cookies.has(DEMO_CSRF_COOKIE_NAME)).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network down')));
    await expect(hydrateDemoSession()).resolves.toEqual({ status: 'error' });
    expect(store.has(DEMO_STORAGE_KEY)).toBe(true);

    let resolveFetch!: (res: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const pending = hydrateDemoSession();
    cookies.delete(DEMO_CSRF_COOKIE_NAME);
    store.delete(DEMO_STORAGE_KEY);
    resolveFetch(new Response(JSON.stringify(buyerSession), { status: 200 }));
    await expect(pending).resolves.toEqual({ status: 'inactive' });
    expect(store.has(DEMO_STORAGE_KEY)).toBe(false);
  });

  it('ends demo session cleanly with DELETE /api/demo/session and m3d_demo_csrf', async () => {
    const { cookies } = stubEnv(`${DEMO_CSRF_COOKIE_NAME}=demo.exit`);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await endDemoSession();

    expect(cookies.has(DEMO_CSRF_COOKIE_NAME)).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/api/demo/session`,
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        keepalive: true,
        headers: { 'X-CSRF-Token': 'demo.exit' },
      }),
    );
  });
});
