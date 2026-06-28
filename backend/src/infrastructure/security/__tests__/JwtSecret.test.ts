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
