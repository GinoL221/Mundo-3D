import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSessionUser,
  parseApiResponse,
  readApiErrorMessage,
  readCsrfToken,
  withCredentials,
} from './credentials';

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

// Characterization tests for the move (design.md D6, task 3.3): every
// export below is moved verbatim from `config.ts`. These tests mirror
// `config.test.ts`'s existing `readCsrfToken`/`withCredentials` coverage
// plus new direct coverage for `getSessionUser`/`readApiErrorMessage`
// (finding #2 in tasks.md — both were live exports config.ts's original
// move table omitted).
describe('readCsrfToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when there is no cookie header at all', () => {
    stubCookie('');

    expect(readCsrfToken()).toBeNull();
  });

  it('returns null when the m3d_csrf cookie is absent', () => {
    stubCookie('m3d_user=%7B%22idRole%22%3A2%7D');

    expect(readCsrfToken()).toBeNull();
  });

  it('parses the m3d_csrf cookie value verbatim', () => {
    stubCookie('m3d_csrf=abc123.signature456');

    expect(readCsrfToken()).toBe('abc123.signature456');
  });

  it('finds m3d_csrf among several cookies', () => {
    stubCookie('m3d_user=%7B%7D; m3d_csrf=random.hmac; other=value');

    expect(readCsrfToken()).toBe('random.hmac');
  });
});

describe('withCredentials', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds credentials:"include" even without a CSRF cookie', () => {
    stubCookie('');

    const result = withCredentials({ method: 'GET' });

    expect(result.method).toBe('GET');
    expect(result.credentials).toBe('include');
    expect((result.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  it('merges the X-CSRF-Token header with existing headers when a token exists', () => {
    stubCookie('m3d_csrf=random.hmac');

    const result = withCredentials({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(result.credentials).toBe('include');
    expect(result.headers).toEqual({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'random.hmac',
    });
  });

  it('defaults to an empty init when none is provided', () => {
    stubCookie('m3d_csrf=random.hmac');

    const result = withCredentials();

    expect(result.credentials).toBe('include');
    expect(result.headers).toEqual({ 'X-CSRF-Token': 'random.hmac' });
  });
});

describe('getSessionUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when there is no m3d_user cookie', () => {
    stubCookie('');

    expect(getSessionUser()).toBeNull();
  });

  it('returns the parsed user when m3d_user is present (URL-encoded JSON)', () => {
    const encoded = encodeURIComponent(JSON.stringify({ idRole: 2 }));
    stubCookie(`m3d_user=${encoded}`);

    expect(getSessionUser()).toEqual({ idRole: 2 });
  });

  it('returns null when the cookie value is malformed JSON', () => {
    stubCookie('m3d_user=not-json');

    expect(getSessionUser()).toBeNull();
  });
});

describe('readApiErrorMessage', () => {
  it('returns the fallback for a non-object body', () => {
    expect(readApiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(readApiErrorMessage('oops', 'fallback')).toBe('fallback');
  });

  it('extracts the first field error from an express-validator array', () => {
    const body = { errors: [{ msg: 'La contraseña es muy corta' }] };

    expect(readApiErrorMessage(body, 'fallback')).toBe('La contraseña es muy corta');
  });

  it('extracts the first field error from a field-keyed object', () => {
    const body = { errors: { email: { msg: 'El email ya está en uso' } } };

    expect(readApiErrorMessage(body, 'fallback')).toBe('El email ya está en uso');
  });

  it('falls back to the root error/message when errors is absent', () => {
    expect(readApiErrorMessage({ error: 'Root error' }, 'fallback')).toBe('Root error');
    expect(readApiErrorMessage({ message: 'Root message' }, 'fallback')).toBe('Root message');
  });

  it('falls back to the caller default when nothing is usable', () => {
    expect(readApiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

describe('parseApiResponse', () => {
  it('returns parsed JSON payload for ok 200/201 JSON responses', async () => {
    const ok200 = new Response(JSON.stringify({ user: { id: 1 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const ok201 = new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    await expect(parseApiResponse<{ user: { id: number } }>(ok200, 'fallback')).resolves.toEqual({
      user: { id: 1 },
    });
    await expect(parseApiResponse<{ created: boolean }>(ok201, 'fallback')).resolves.toEqual({
      created: true,
    });
  });

  it('throws fallbackMessage when an ok 200 response has non-JSON or empty body', async () => {
    const html200 = new Response('<html><body>SPA fallback</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    const empty200 = new Response('', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiResponse(html200, 'Error al iniciar sesión.')).rejects.toThrow(
      'Error al iniciar sesión.'
    );
    await expect(parseApiResponse(empty200, 'Error al iniciar sesión.')).rejects.toThrow(
      'Error al iniciar sesión.'
    );
  });

  it('throws extracted API error message for JSON 400/401/500 error responses', async () => {
    const res400 = new Response(JSON.stringify({ errors: [{ msg: 'Email inválido' }] }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const res401 = new Response(JSON.stringify({ error: 'Credenciales inválidas' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
    const res500 = new Response(JSON.stringify({ message: 'Fallo interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiResponse(res400, 'fallback')).rejects.toThrow('Email inválido');
    await expect(parseApiResponse(res401, 'fallback')).rejects.toThrow('Credenciales inválidas');
    await expect(parseApiResponse(res500, 'fallback')).rejects.toThrow('Fallo interno');
  });

  it('throws the cold-start message for non-JSON 502/503/504 responses instead of SyntaxError', async () => {
    const res502 = new Response('<html><body>Bad Gateway</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });
    const res503 = new Response('Service Unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
    const res504 = new Response('', {
      status: 504,
    });

    const expectedMsg = 'El servidor se está iniciando. Esperá unos segundos y volvé a intentarlo.';
    await expect(parseApiResponse(res502, 'fallback')).rejects.toThrow(expectedMsg);
    await expect(parseApiResponse(res503, 'fallback')).rejects.toThrow(expectedMsg);
    await expect(parseApiResponse(res504, 'fallback')).rejects.toThrow(expectedMsg);
  });

  it('uses JSON error body even on 503 when the response is valid JSON', async () => {
    const json503 = new Response(JSON.stringify({ error: 'Image uploads disabled' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiResponse(json503, 'fallback')).rejects.toThrow('Image uploads disabled');
  });

  it('throws fallbackMessage for non-JSON 500 or empty 400 responses', async () => {
    const html500 = new Response('<html>Internal Error</html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
    const empty400 = new Response('', { status: 400 });

    await expect(parseApiResponse(html500, 'Error al iniciar sesión.')).rejects.toThrow(
      'Error al iniciar sesión.'
    );
    await expect(parseApiResponse(empty400, 'Error al registrarse.')).rejects.toThrow(
      'Error al registrarse.'
    );
  });
});
