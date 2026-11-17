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
});
