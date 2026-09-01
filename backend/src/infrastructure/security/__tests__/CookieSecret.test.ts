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

  it('returns the env value when COOKIE_SECRET is set', () => {
    process.env.COOKIE_SECRET = 'my-super-cookie-secret';
    process.env.NODE_ENV = 'production';

    const { getCookieSecret } = require('../CookieSecret');
    expect(getCookieSecret()).toBe('my-super-cookie-secret');
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
