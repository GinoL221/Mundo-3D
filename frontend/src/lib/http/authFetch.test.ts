import { afterEach, describe, expect, it, vi } from 'vitest';

const ensureRefreshedMock = vi.fn();
vi.mock('./refreshSingleFlight', () => ({
  ensureRefreshed: ensureRefreshedMock,
}));

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
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
  afterEach(() => {
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

  it('on a failed refresh, redirects to /login immediately without waiting on the logout call', async () => {
    stubCookie('');
    const win = { location: { href: '' } };
    vi.stubGlobal('window', win);
    const unauthorized = new Response(null, { status: 401 });
    let resolveLogout!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(unauthorized)).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveLogout = resolve;
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/users/logout');
    resolveLogout(new Response(null, { status: 204 }));
  });

  it('never calls fetch against the refresh endpoint itself', async () => {
    stubCookie('');
    const unauthorized = new Response(null, { status: 401 });
    const fetchMock = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { href: '' } });
    ensureRefreshedMock.mockResolvedValue(false);

    const { authFetch } = await import('./authFetch');
    await authFetch('/api/orders/mine', { method: 'GET' });

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('/api/users/refresh');
    }
  });
});
