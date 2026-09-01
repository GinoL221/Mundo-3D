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

  it('returns the env value when JWT_SECRET is set', () => {
    process.env.JWT_SECRET = 'my-super-secret';
    process.env.NODE_ENV = 'production';

    const { getJwtSecret } = require('../JwtSecret');
    expect(getJwtSecret()).toBe('my-super-secret');
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
