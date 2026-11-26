import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequest, type PagesFunctionContext } from './[[path]]';

function createContext(
  request: Request,
  env: PagesFunctionContext['env'] = {},
): PagesFunctionContext {
  return {
    request,
    env,
    params: {},
  };
}

describe('Cloudflare Pages /api/* reverse proxy', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('forwards exact path suffix and query string, stripping trailing slash from BACKEND_API_URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    const req = new Request('https://mundo3d.pages.dev/api/products/featured?page=2&category=anime', {
      method: 'GET',
    });

    const res = await onRequest(
      createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com/' }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [targetUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(targetUrl).toBe('https://mundo3d-api.onrender.com/api/products/featured?page=2&category=anime');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.redirect).toBe('manual');
  });

  it('forwards POST method, body, and auth/CSRF/origin headers with redirect: manual', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    const payload = JSON.stringify({ email: 'user@example.com' });
    const req = new Request('https://mundo3d.pages.dev/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'm3d_csrf=abc',
        'X-CSRF-Token': 'abc',
        Origin: 'https://mundo3d.pages.dev',
      },
      body: payload,
    });

    const res = await onRequest(
      createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
    );

    expect(res.status).toBe(201);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.body).toBeDefined();

    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get('content-type')).toBe('application/json');
    expect(forwardedHeaders.get('cookie')).toBe('m3d_csrf=abc');
    expect(forwardedHeaders.get('x-csrf-token')).toBe('abc');
    expect(forwardedHeaders.get('origin')).toBe('https://mundo3d.pages.dev');
  });

  it('strips untrusted client-supplied X-Proxy-Secret, X-Forwarded-Client-IP, and Host headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchMock;

    const req = new Request('https://mundo3d.pages.dev/api/health', {
      method: 'GET',
      headers: {
        Host: 'evil.example.com',
        'X-Proxy-Secret': 'spoofed-secret',
        'X-Forwarded-Client-IP': '1.2.3.4',
      },
    });

    await onRequest(createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get('host')).toBeNull();
    expect(forwardedHeaders.get('x-proxy-secret')).toBeNull();
    expect(forwardedHeaders.get('x-forwarded-client-ip')).toBeNull();
  });

  it('injects X-Forwarded-Client-IP and X-Proxy-Secret from CF-Connecting-IP when PROXY_SHARED_SECRET is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchMock;

    const req = new Request('https://mundo3d.pages.dev/api/users/login', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '203.0.113.42',
        'X-Proxy-Secret': 'spoofed-secret',
        'X-Forwarded-Client-IP': '198.51.100.1',
      },
      body: '{}',
    });

    await onRequest(
      createContext(req, {
        BACKEND_API_URL: 'https://mundo3d-api.onrender.com',
        PROXY_SHARED_SECRET: 'real-shared-secret',
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get('x-forwarded-client-ip')).toBe('203.0.113.42');
    expect(forwardedHeaders.get('x-proxy-secret')).toBe('real-shared-secret');
  });

  it('does not emit X-Forwarded-Client-IP or X-Proxy-Secret when CF-Connecting-IP is missing or empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchMock;

    const req = new Request('https://mundo3d.pages.dev/api/users/login', {
      method: 'GET',
      headers: {
        'CF-Connecting-IP': '   ',
      },
    });

    await onRequest(
      createContext(req, {
        BACKEND_API_URL: 'https://mundo3d-api.onrender.com',
        PROXY_SHARED_SECRET: 'real-shared-secret',
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get('x-forwarded-client-ip')).toBeNull();
    expect(forwardedHeaders.get('x-proxy-secret')).toBeNull();
  });

  it('preserves all Set-Cookie headers individually via getSetCookie()', async () => {
    const upstreamHeaders = new Headers({
      'Content-Type': 'application/json',
    });
    const cookies = [
      'm3d_auth=jwt1; Path=/; HttpOnly; SameSite=Lax',
      'm3d_refresh=ref1; Path=/api/users; HttpOnly; SameSite=Lax',
      'm3d_csrf=csrf1; Path=/; SameSite=Lax',
      'm3d_user=usr1; Path=/; SameSite=Lax',
    ];
    for (const cookie of cookies) {
      upstreamHeaders.append('Set-Cookie', cookie);
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: 'gino' }), {
        status: 200,
        headers: upstreamHeaders,
      }),
    );
    globalThis.fetch = fetchMock;

    const req = new Request('https://mundo3d.pages.dev/api/users/login', { method: 'POST', body: '{}' });
    const res = await onRequest(
      createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
    );

    expect(res.headers.getSetCookie()).toEqual(cookies);
  });

  it('falls back cleanly when upstream response headers lack getSetCookie()', async () => {
    const stubHeaders = {
      forEach(cb: (value: string, key: string) => void) {
        cb('application/json', 'content-type');
        cb('m3d_auth=jwt1; Path=/; HttpOnly', 'set-cookie');
      },
      get(name: string) {
        return name.toLowerCase() === 'set-cookie' ? 'm3d_auth=jwt1; Path=/; HttpOnly' : null;
      },
    };
    const stubResponse = {
      status: 200,
      statusText: 'OK',
      body: null,
      headers: stubHeaders,
    } as unknown as Response;

    globalThis.fetch = vi.fn().mockResolvedValue(stubResponse);

    const req = new Request('https://mundo3d.pages.dev/api/users/me', { method: 'GET' });
    const res = await onRequest(
      createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
    );

    expect(res.headers.getSetCookie()).toEqual(['m3d_auth=jwt1; Path=/; HttpOnly']);
  });

  it('fails closed with 500 JSON when BACKEND_API_URL is missing or invalid', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const reqMissing = new Request('https://mundo3d.pages.dev/api/products');
    const resMissing = await onRequest(createContext(reqMissing, {}));
    expect(resMissing.status).toBe(500);
    expect(resMissing.headers.get('content-type')).toContain('application/json');
    expect(await resMissing.json()).toEqual({
      error: expect.any(String),
    });

    const reqInvalid = new Request('https://mundo3d.pages.dev/api/products');
    const resInvalid = await onRequest(createContext(reqInvalid, { BACKEND_API_URL: 'not-a-valid-url' }));
    expect(resInvalid.status).toBe(500);
    expect(resInvalid.headers.get('content-type')).toContain('application/json');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed with 502 JSON when upstream fetch rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network failure'));

    const req = new Request('https://mundo3d.pages.dev/api/products');
    const res = await onRequest(
      createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
    );

    expect(res.status).toBe(502);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      error: expect.any(String),
    });
  });

  describe('cold-start non-JSON 502/503/504 normalization', () => {
    it('normalizes an upstream 502 text/html response (e.g. Render cold-start) into a 503 JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<html><body>Application starting up</body></html>', {
          status: 502,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'x-render-routing': 'no-deploy',
          },
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/users/login', {
        method: 'POST',
        body: '{}',
      });
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(503);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('retry-after')).toBe('10');
      expect(await res.json()).toEqual({
        error: 'El servidor se está iniciando. Esperá unos segundos y volvé a intentarlo.',
      });
    });

    it('normalizes an upstream 503 text/html response into a 503 JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<html><body>503 Service Temporarily Unavailable</body></html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/products');
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(503);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('retry-after')).toBe('10');
      expect(await res.json()).toEqual({
        error: 'El servidor se está iniciando. Esperá unos segundos y volvé a intentarlo.',
      });
    });

    it('normalizes an upstream 504 non-JSON response without content-type into a 503 JSON response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(null, {
          status: 504,
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/products');
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(503);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('retry-after')).toBe('10');
      expect(await res.json()).toEqual({
        error: 'El servidor se está iniciando. Esperá unos segundos y volvé a intentarlo.',
      });
    });

    it('preserves upstream 502 application/json responses untouched including Set-Cookie', async () => {
      const upstreamHeaders = new Headers({
        'Content-Type': 'application/json',
        'X-Custom-Error': 'upstream-gateway',
      });
      upstreamHeaders.append('Set-Cookie', 'm3d_diag=1; Path=/; HttpOnly');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Upstream JSON gateway error' }), {
          status: 502,
          headers: upstreamHeaders,
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/orders', { method: 'POST', body: '{}' });
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(502);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('x-custom-error')).toBe('upstream-gateway');
      expect(res.headers.get('retry-after')).toBeNull();
      expect(res.headers.getSetCookie()).toEqual(['m3d_diag=1; Path=/; HttpOnly']);
      expect(await res.json()).toEqual({ error: 'Upstream JSON gateway error' });
    });

    it('preserves upstream 503 APPLICATION/JSON (case-insensitive) responses untouched', async () => {
      const upstreamHeaders = new Headers({
        'Content-Type': 'APPLICATION/JSON; charset=utf-8',
      });
      upstreamHeaders.append('Set-Cookie', 'm3d_csrf=keep; Path=/; SameSite=Lax');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Image uploads are disabled in this environment' }), {
          status: 503,
          headers: upstreamHeaders,
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/users/register', {
        method: 'POST',
        body: '{}',
      });
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(503);
      expect(res.headers.get('content-type')).toBe('APPLICATION/JSON; charset=utf-8');
      expect(res.headers.get('retry-after')).toBeNull();
      expect(res.headers.getSetCookie()).toEqual(['m3d_csrf=keep; Path=/; SameSite=Lax']);
      expect(await res.json()).toEqual({ error: 'Image uploads are disabled in this environment' });
    });

    it('preserves upstream 500 application/json responses untouched', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/products');
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal server error' });
    });

    it('normalizes an upstream 429 Cloudflare HTML challenge into a 503 BACKEND_SLEEPING JSON with wakeUrl', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<!DOCTYPE html><title>Just a moment...</title>', {
          status: 429,
          headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'cf-mitigated': 'challenge',
          },
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/products');
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com/' }),
      );

      expect(res.status).toBe(503);
      expect(res.headers.get('content-type')).toBe('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('retry-after')).toBe('10');
      expect(await res.json()).toEqual({
        error:
          'El servidor gratuito está dormido por inactividad. Abrilo para reactivarlo y volvé a intentarlo en unos segundos.',
        code: 'BACKEND_SLEEPING',
        wakeUrl: 'https://mundo3d-api.onrender.com/health/ready',
      });
    });

    it('normalizes an upstream 429 plain-text edge block and preserves base path in wakeUrl', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Too Many Requests', {
          status: 429,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/products');
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://api.example.com/backend/' }),
      );

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({
        error:
          'El servidor gratuito está dormido por inactividad. Abrilo para reactivarlo y volvé a intentarlo en unos segundos.',
        code: 'BACKEND_SLEEPING',
        wakeUrl: 'https://api.example.com/backend/health/ready',
      });
    });

    it('preserves upstream 429 application/json rate-limit responses untouched', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'RateLimit-Remaining': '0',
          },
        }),
      );

      const req = new Request('https://mundo3d.pages.dev/api/users/login', {
        method: 'POST',
        body: '{}',
      });
      const res = await onRequest(
        createContext(req, { BACKEND_API_URL: 'https://mundo3d-api.onrender.com' }),
      );

      expect(res.status).toBe(429);
      expect(res.headers.get('ratelimit-remaining')).toBe('0');
      expect(await res.json()).toEqual({
        error: 'Too many requests. Please try again later.',
      });
    });
  });
});
