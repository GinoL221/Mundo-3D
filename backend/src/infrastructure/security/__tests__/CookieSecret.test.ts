describe('getCookieSecret', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when COOKIE_SECRET is undefined and NODE_ENV is not test', () => {
    delete process.env.COOKIE_SECRET;
    process.env.NODE_ENV = 'production';

    const { getCookieSecret } = require('../CookieSecret');
    expect(() => getCookieSecret()).toThrow('COOKIE_SECRET');
  });

  it('throws when COOKIE_SECRET is an empty string and NODE_ENV is not test', () => {
    process.env.COOKIE_SECRET = '';
    process.env.NODE_ENV = 'production';

    const { getCookieSecret } = require('../CookieSecret');
    expect(() => getCookieSecret()).toThrow('COOKIE_SECRET');
  });

  // Lengthened from 'my-super-cookie-secret' (22 chars) when the
  // 32-character minimum landed — same reason as JwtSecret.test.ts.
  it('returns the env value when COOKIE_SECRET is set', () => {
    const secret = 'my-super-cookie-secret-that-is-long-enough';
    process.env.COOKIE_SECRET = secret;
    process.env.NODE_ENV = 'production';

    const { getCookieSecret } = require('../CookieSecret');
    expect(getCookieSecret()).toBe(secret);
  });

  // Finding 8, mirroring JwtSecret.test.ts. This secret signs CSRF tokens,
  // so a short one is forgeable for exactly the same reason.
  it('throws when COOKIE_SECRET is shorter than the 32-character minimum', () => {
    process.env.COOKIE_SECRET = 'x'.repeat(31);
    process.env.NODE_ENV = 'production';

    const { getCookieSecret } = require('../CookieSecret');
    expect(() => getCookieSecret()).toThrow('COOKIE_SECRET');
    expect(() => getCookieSecret()).toThrow('32');
  });

  it('returns a COOKIE_SECRET of exactly 32 characters', () => {
    const exactlyMinimum = 'x'.repeat(32);
    process.env.COOKIE_SECRET = exactlyMinimum;
    process.env.NODE_ENV = 'production';

    const { getCookieSecret } = require('../CookieSecret');
    expect(getCookieSecret()).toBe(exactlyMinimum);
  });

  it('returns a deterministic test secret under Jest when NODE_ENV is test', () => {
    delete process.env.COOKIE_SECRET;
    process.env.NODE_ENV = 'test';

    const { getCookieSecret } = require('../CookieSecret');
    expect(getCookieSecret()).toBe('test-only-cookie-secret-not-for-production');
  });

  // Mirrors JwtSecret.test.ts: NODE_ENV alone must not unlock a fallback that
  // is public in this repository, because it also signs CSRF tokens.
  it('throws when NODE_ENV is test but the process is not running under Jest', () => {
    delete process.env.COOKIE_SECRET;
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;

    const { getCookieSecret } = require('../CookieSecret');
    expect(() => getCookieSecret()).toThrow('COOKIE_SECRET');
  });
});
