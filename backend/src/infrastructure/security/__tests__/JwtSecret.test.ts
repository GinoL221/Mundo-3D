describe('getJwtSecret', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when JWT_SECRET is undefined and NODE_ENV is not test', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    const { getJwtSecret } = require('../JwtSecret');
    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('throws when JWT_SECRET is empty string and NODE_ENV is not test', () => {
    process.env.JWT_SECRET = '';
    process.env.NODE_ENV = 'production';

    const { getJwtSecret } = require('../JwtSecret');
    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  // Lengthened from 'my-super-secret' (15 chars) when the 32-character
  // minimum landed: the old fixture encoded the pre-change contract, where
  // any non-empty string was a valid production secret.
  it('returns the env value when JWT_SECRET is set', () => {
    const secret = 'my-super-secret-that-is-long-enough-to-be-real';
    process.env.JWT_SECRET = secret;
    process.env.NODE_ENV = 'production';

    const { getJwtSecret } = require('../JwtSecret');
    expect(getJwtSecret()).toBe(secret);
  });

  // Finding 8. "Non-empty" was the whole bar, so a 4-character JWT_SECRET
  // was accepted and went on to sign every session token in the deploy. An
  // HS256 secret is the only thing standing between a token and an offline
  // brute force, so a short one has to fail at read time — loudly, and
  // naming the variable — rather than quietly protecting nothing.
  it('throws when JWT_SECRET is shorter than the 32-character minimum', () => {
    process.env.JWT_SECRET = 'x'.repeat(31);
    process.env.NODE_ENV = 'production';

    const { getJwtSecret } = require('../JwtSecret');
    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
    expect(() => getJwtSecret()).toThrow('32');
  });

  // Built by repetition rather than typed out, so a miscounted literal can
  // never silently turn this into a longer-than-minimum case.
  it('returns a JWT_SECRET of exactly 32 characters', () => {
    const exactlyMinimum = 'x'.repeat(32);
    process.env.JWT_SECRET = exactlyMinimum;
    process.env.NODE_ENV = 'production';

    const { getJwtSecret } = require('../JwtSecret');
    expect(getJwtSecret()).toBe(exactlyMinimum);
  });

  // NODE_ENV alone must not unlock the committed fallback: the e2e suite runs
  // a real server with NODE_ENV=test, and a production deploy misconfigured
  // the same way would otherwise sign tokens with a secret that is public in
  // this repository. JEST_WORKER_ID is set by Jest itself and cannot be
  // supplied by a deploy configuration.
  it('throws when NODE_ENV is test but the process is not running under Jest', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;

    const { getJwtSecret } = require('../JwtSecret');
    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });

  it('returns a deterministic test secret when NODE_ENV is test', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const { getJwtSecret } = require('../JwtSecret');
    const secret = getJwtSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('returns the same test secret on repeated calls in test env', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const { getJwtSecret } = require('../JwtSecret');
    expect(getJwtSecret()).toBe(getJwtSecret());
  });
});
