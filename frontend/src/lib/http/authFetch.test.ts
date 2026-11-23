import { afterEach, describe, expect, it, vi } from 'vitest';

const ensureRefreshedMock = vi.fn();
vi.mock('./refreshSingleFlight', () => ({
  ensureRefreshed: ensureRefreshedMock,
}));

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

function stubCookieJar(initialCookie: string) {
  const cookies = new Map<string, string>();
  for (const part of initialCookie.split('; ').filter(Boolean)) {
    const eqIndex = part.indexOf('=');
    if (eqIndex > 0) {
      cookies.set(part.slice(0, eqIndex), part.slice(eqIndex + 1));
    }
  }
  const writes: string[] = [];
  const doc = {
    get cookie(): string {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(value: string) {
      writes.push(value);
      const [pair, ...attrs] = value.split(';').map((s) => s.trim());
      const eqIndex = pair.indexOf('=');
      if (eqIndex <= 0) return;
      const name = pair.slice(0, eqIndex);
      const val = pair.slice(eqIndex + 1);
      if (attrs.some((attr) => /^max-age=0$/i.test(attr))) {
        cookies.delete(name);
      } else {
        cookies.set(name, val);
      }
    },
  };
  vi.stubGlobal('document', doc);
  return { writes, doc };
}

function stubWindowLocation(initialHref = '') {
  const assign = vi.fn((url: string) => {
    win.location.href = url;
  });
  const win = {
    location: {
      href: initialHref,
      assign,
    },
  };
  vi.stubGlobal('window', win);
  return { win, assign };
}

function stubBroadcastChannel() {
  const instances: Array<{
    name: string;
    messages: unknown[];
    closed: boolean;
  }> = [];

  class FakeBroadcastChannel {
    readonly name: string;
    private readonly record: { name: string; messages: unknown[]; closed: boolean };

    constructor(name: string) {
      this.name = name;
      this.record = { name, messages: [], closed: false };
      instances.push(this.record);
    }

    postMessage(message: unknown) {
      this.record.messages.push(message);
    }

    close() {
      this.record.closed = true;
    }
  }

  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  return instances;
}

// Task 3.6 (design.md D6): retries exactly once on 401 after a successful
// refresh, re-running `withCredentials`; on a failed refresh ends the
// session (best-effort logout call) and redirects to /login without
// retrying; never retries a second time; never wraps the refresh call
// itself (guaranteed here by mocking `ensureRefreshed` out of
// `refreshSingleFlight.ts` entirely, so a failure to isolate it would
// surface as an extra unexpected fetch call below).
//
// Deliberately does NOT import `session.service.ts`'s `clearSession()` —
// `config.ts` re-exports `authFetch`, and `session.service.ts` imports
// `config.ts` itself, so routing through it here would recreate exactly
// the import cycle D6 designs `lib/http` to avoid (see apply-progress).
describe('authFetch', () => {
  afterEach(async () => {
    const { resetAuthFetchStateForTests } = await import('./authFetch');
    resetAuthFetchStateForTests();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('passes through untouched on a non-401 response', async () => {
    stubCookie('');
    const ok = new Response(null, { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/products', { method: 'GET' });

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ensureRefreshedMock).not.toHaveBeenCalled();
  });

  it('retries exactly once on 401 after a successful refresh, re-running withCredentials', async () => {
    stubCookie('m3d_csrf=random.hmac');
    const unauthorized = new Response(null, { status: 401 });
    const retried = new Response(null, { status: 200 });
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(retried);
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(true);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/orders/mine', { method: 'GET' });

    expect(result).toBe(retried);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ensureRefreshedMock).toHaveBeenCalledTimes(1);
    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(secondCallInit.credentials).toBe('include');
    expect((secondCallInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('random.hmac');
  });

  it('never retries twice: a 401 on the retried request is returned as-is', async () => {
    stubCookie('');
    const unauthorized = new Response(null, { status: 401 });
    const stillUnauthorized = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(stillUnauthorized);
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(true);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/orders/mine', { method: 'GET' });

    expect(result).toBe(stillUnauthorized);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ensureRefreshedMock).toHaveBeenCalledTimes(1);
  });

  it('on a failed refresh for a real session, redirects to /login immediately without waiting on the logout call', async () => {
    // A session existed (m3d_user present) and could not be renewed — that is
    // a genuine expiry, so bouncing to /login is right.
    stubCookie('m3d_user=%7B%22idRole%22%3A2%7D');
    const { win } = stubWindowLocation('');
    const unauthorized = new Response(null, { status: 401 });
    const settles: Array<() => void> = [];
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(unauthorized)).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          settles.push(() => resolve(new Response(null, { status: 204 })));
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(false);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/orders/mine', { method: 'GET' });

    // The redirect must not block on the fire-and-forget logout call, which
    // is still in flight at this point (same "never block" spirit as
    // sessionUI.ts's own logout handler).
    expect(win.location.href).toBe('/login');
    expect(result).toBe(unauthorized);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const teardownUrls = fetchMock.mock.calls.slice(1).map(([url]) => String(url));
    expect(teardownUrls.some((u) => u.includes('/api/users/logout'))).toBe(true);
    expect(teardownUrls.some((u) => u.includes('/api/users/refresh/revoke'))).toBe(true);
    for (const [, options] of fetchMock.mock.calls.slice(1)) {
      const init = options as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.keepalive).toBe(true);
      expect(init.headers).toBeUndefined();
      expect(init.body).toBeUndefined();
    }
    settles.forEach((s) => s());
  });

  // Regression found by the cart e2e, not by any unit test: CartList.astro
  // hydrates the cart on load for EVERY visitor, so a guest browsing /cart
  // issues a credentialed GET, gets 401, fails a refresh it never had a token
  // for — and was then forcibly navigated to /login. A visitor who never
  // logged in must not be bounced anywhere; the caller handles the 401.
  it('does NOT redirect when there was no session to begin with', async () => {
    stubCookie('');
    const { win, assign } = stubWindowLocation('');
    const unauthorized = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(false);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/cart', { method: 'GET' });

    expect(assign).not.toHaveBeenCalled();
    expect(win.location.href).toBe('');
    expect(result).toBe(unauthorized);
    // No logout call either — there is no session to end.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never calls fetch against the refresh endpoint itself', async () => {
    stubCookie('');
    const unauthorized = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal('fetch', fetchMock);
    stubWindowLocation('');
    ensureRefreshedMock.mockResolvedValue(false);

    const { authFetch } = await import('./authFetch');
    await authFetch('/api/orders/mine', { method: 'GET' });

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('/api/users/refresh');
    }
  });

  it('calls both /api/users/logout and /api/users/refresh/revoke on failed refresh when session exists', async () => {
    stubCookie('m3d_user=%7B%22idRole%22%3A2%7D');
    stubWindowLocation('');
    const unauthorized = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(false);

    const { authFetch } = await import('./authFetch');
    await authFetch('/api/orders/mine', { method: 'GET' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((u) => u.includes('/api/users/logout'))).toBe(true);
    expect(urls.some((u) => u.includes('/api/users/refresh/revoke'))).toBe(true);
    for (const [, options] of fetchMock.mock.calls.slice(1)) {
      const init = options as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(init.keepalive).toBe(true);
      expect(init.headers).toBeUndefined();
      expect(init.body).toBeUndefined();
    }
  });

  it('expires m3d_user and m3d_csrf cookies synchronously and broadcasts logged-out on BroadcastChannel("m3d-session")', async () => {
    const { writes, doc } = stubCookieJar('m3d_user=%7B%22idRole%22%3A1%7D; m3d_csrf=tok.sig');
    const channels = stubBroadcastChannel();
    const { win, assign } = stubWindowLocation('/admin/products');
    const unauthorized = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(false);

    const { authFetch } = await import('./authFetch');
    await authFetch('/api/products/1/stock', { method: 'PATCH' });

    expect(doc.cookie).toBe('');
    expect(writes.some((w) => w.startsWith('m3d_user=; Max-Age=0; path=/'))).toBe(true);
    expect(writes.some((w) => w.startsWith('m3d_csrf=; Max-Age=0; path=/'))).toBe(true);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.name).toBe('m3d-session');
    expect(channels[0]?.messages).toEqual([{ type: 'session-changed', state: 'logged-out' }]);
    expect(channels[0]?.closed).toBe(true);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/login');
    expect(win.location.href).toBe('/login');
  });

  it('terminates session and redirects to /login once when the retried request still returns 401 for an authenticated session', async () => {
    const { doc } = stubCookieJar('m3d_user=%7B%22idRole%22%3A1%7D; m3d_csrf=tok.sig');
    const channels = stubBroadcastChannel();
    const { win, assign } = stubWindowLocation('/admin/products');
    const first401 = new Response(null, { status: 401 });
    const retried401 = new Response(null, { status: 401 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(first401)
      .mockResolvedValueOnce(retried401)
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(true);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/products/1/stock', { method: 'PATCH' });

    expect(result).toBe(retried401);
    expect(doc.cookie).toBe('');
    expect(channels).toHaveLength(1);
    expect(channels[0]?.messages).toEqual([{ type: 'session-changed', state: 'logged-out' }]);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/login');
    expect(win.location.href).toBe('/login');
    // 1 initial + 1 retry + 1 logout + 1 refresh/revoke = 4
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const teardownUrls = fetchMock.mock.calls.slice(2).map(([url]) => String(url));
    expect(teardownUrls.some((u) => u.includes('/api/users/logout'))).toBe(true);
    expect(teardownUrls.some((u) => u.includes('/api/users/refresh/revoke'))).toBe(true);
  });

  it('performs teardown and redirect at most once across concurrent 401 calls', async () => {
    stubCookieJar('m3d_user=%7B%22idRole%22%3A1%7D; m3d_csrf=tok.sig');
    const channels = stubBroadcastChannel();
    const { win, assign } = stubWindowLocation('/admin/products');

    let resolveSecondRefresh!: (value: boolean) => void;
    const secondRefreshPromise = new Promise<boolean>((resolve) => {
      resolveSecondRefresh = resolve;
    });
    ensureRefreshedMock
      .mockResolvedValueOnce(false)
      .mockReturnValueOnce(secondRefreshPromise);

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/users/')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { authFetch } = await import('./authFetch');
    const req1 = authFetch('/api/products/1/stock', { method: 'PATCH' });
    const req2 = authFetch('/api/products/2/stock', { method: 'PATCH' });

    await req1;
    // First request already expired m3d_user and triggered teardown/redirect.
    // Now second request's refresh finishes (also false).
    resolveSecondRefresh(false);
    await req2;

    expect(assign).toHaveBeenCalledTimes(1);
    expect(win.location.href).toBe('/login');
    expect(channels).toHaveLength(1);
    const logoutCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/users/logout'),
    );
    const revokeCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/users/refresh/revoke'),
    );
    expect(logoutCalls).toHaveLength(1);
    expect(revokeCalls).toHaveLength(1);
  });

  it('does NOT expire, broadcast, logout, or redirect for a guest receiving a retried 401', async () => {
    const { writes } = stubCookieJar('');
    const channels = stubBroadcastChannel();
    const { win, assign } = stubWindowLocation('/cart');
    const first401 = new Response(null, { status: 401 });
    const retried401 = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValueOnce(first401).mockResolvedValueOnce(retried401);
    vi.stubGlobal('fetch', fetchMock);
    ensureRefreshedMock.mockResolvedValue(true);

    const { authFetch } = await import('./authFetch');
    const result = await authFetch('/api/cart', { method: 'GET' });

    expect(result).toBe(retried401);
    expect(writes).toHaveLength(0);
    expect(channels).toHaveLength(0);
    expect(assign).not.toHaveBeenCalled();
    expect(win.location.href).toBe('/cart');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
