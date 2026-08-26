import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCsrfToken, withCredentials } from './csrf';

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

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
