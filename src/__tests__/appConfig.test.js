describe('app startup requirements', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws error if SESSION_SECRET is missing', () => {
    delete process.env.SESSION_SECRET;
    process.env.COOKIE_SECRET = 'some-cookie-secret';
    process.env.NODE_ENV = 'development';
    expect(() => {
      require('../app');
    }).toThrow(/SESSION_SECRET is required/);
  });

  it('throws error if COOKIE_SECRET is missing', () => {
    process.env.SESSION_SECRET = 'some-session-secret';
    delete process.env.COOKIE_SECRET;
    process.env.JWT_SECRET = 'some-jwt-secret';
    process.env.NODE_ENV = 'development';
    expect(() => {
      require('../app');
    }).toThrow(/COOKIE_SECRET is required/);
  });

  it('throws error if JWT_SECRET is missing', () => {
    process.env.SESSION_SECRET = 'some-session-secret';
    process.env.COOKIE_SECRET = 'some-cookie-secret';
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    expect(() => {
      require('../app');
    }).toThrow(/JWT_SECRET is required/);
  });
});
