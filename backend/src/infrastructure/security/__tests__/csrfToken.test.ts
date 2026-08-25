import { issueCsrfToken, verifyCsrfToken } from '../csrfToken';

describe('issueCsrfToken', () => {
  it('issues a token with a random segment and an HMAC signature segment', () => {
    const token = issueCsrfToken(1);
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('issues a different random segment on every call', () => {
    const first = issueCsrfToken(1).split('.')[0];
    const second = issueCsrfToken(1).split('.')[0];
    expect(first).not.toBe(second);
  });
});

describe('verifyCsrfToken', () => {
  it('accepts a freshly issued token verified against the same userId', () => {
    const token = issueCsrfToken(42);
    expect(verifyCsrfToken(token, 42)).toBe(true);
  });

  it('rejects the token when verified against a different userId', () => {
    const token = issueCsrfToken(42);
    expect(verifyCsrfToken(token, 99)).toBe(false);
  });

  it('rejects a tampered HMAC segment', () => {
    const [random] = issueCsrfToken(42).split('.');
    const tampered = `${random}.${'a'.repeat(43)}`;
    expect(verifyCsrfToken(tampered, 42)).toBe(false);
  });

  it('rejects a tampered random segment', () => {
    const [, signature] = issueCsrfToken(42).split('.');
    const tampered = `different-random-value.${signature}`;
    expect(verifyCsrfToken(tampered, 42)).toBe(false);
  });

  it('rejects a missing token', () => {
    expect(verifyCsrfToken(undefined, 42)).toBe(false);
  });

  it('rejects an empty token', () => {
    expect(verifyCsrfToken('', 42)).toBe(false);
  });

  it('rejects a malformed token with no separator', () => {
    expect(verifyCsrfToken('not-a-valid-token', 42)).toBe(false);
  });

  it('rejects when userId is missing', () => {
    const token = issueCsrfToken(42);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
  });
});
