import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionUser, readApiErrorMessage, readCsrfToken, withCredentials } from './credentials';

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
