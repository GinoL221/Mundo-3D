export interface ProxyEnv {
  BACKEND_API_URL?: string;
  PROXY_SHARED_SECRET?: string;
}

export interface PagesFunctionContext {
  request: Request;
  env: ProxyEnv;
  params?: {
    path?: string | string[];
  };
}

function extractSetCookieHeaders(headers: Headers): string[] {
  const candidate: { getSetCookie?: () => string[]; get: (name: string) => string | null } = headers;
  if (typeof candidate.getSetCookie === 'function') {
    return candidate.getSetCookie();
  }
  const singleCookie = candidate.get('set-cookie');
  return singleCookie ? [singleCookie] : [];
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function resolveUpstreamUrl(rawBaseUrl: string | undefined, requestUrl: string): string | null {
  const trimmed = rawBaseUrl?.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedBase = trimmed.replace(/\/+$/, '');
  try {
    const parsedBase = new URL(normalizedBase);
    if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
      return null;
    }
    const incomingUrl = new URL(requestUrl);
    const basePath = parsedBase.pathname === '/' ? '' : parsedBase.pathname.replace(/\/+$/, '');
    const upstreamUrl = new URL(
      `${basePath}${incomingUrl.pathname}${incomingUrl.search}`,
      parsedBase.origin,
    );
    if (upstreamUrl.origin !== parsedBase.origin) {
      return null;
    }
    return upstreamUrl.href;
  } catch {
    return null;
  }
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  const { request, env } = context;

  const targetUrl = resolveUpstreamUrl(env.BACKEND_API_URL, request.url);
  if (!targetUrl) {
    return jsonError(500, 'Proxy misconfigured: BACKEND_API_URL is missing or invalid.');
  }

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete('x-proxy-secret');
  upstreamHeaders.delete('x-forwarded-client-ip');
  upstreamHeaders.delete('host');

  const cfConnectingIp = request.headers.get('cf-connecting-ip')?.trim();
  const proxySecret = env.PROXY_SHARED_SECRET?.trim();
  if (cfConnectingIp && proxySecret) {
    upstreamHeaders.set('X-Forwarded-Client-IP', cfConnectingIp);
    upstreamHeaders.set('X-Proxy-Secret', proxySecret);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: upstreamHeaders,
    redirect: 'manual',
  };

  if (method !== 'GET' && method !== 'HEAD' && request.body !== null) {
    init.body = request.body;
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, init);
  } catch {
    return jsonError(502, 'Upstream service unavailable.');
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      responseHeaders.append(key, value);
    }
  });

  for (const cookie of extractSetCookieHeaders(upstreamResponse.headers)) {
    responseHeaders.append('Set-Cookie', cookie);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
