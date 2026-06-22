describe('app startup requirements', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does NOT throw error if SESSION_SECRET is missing', () => {
    delete process.env.SESSION_SECRET;
    process.env.JWT_SECRET = 'some-jwt-secret';
    process.env.NODE_ENV = 'development';
    expect(() => {
      jest.isolateModules(() => {
        require('../app');
      });
    }).not.toThrow();
  });

  it('does NOT throw error if COOKIE_SECRET is missing', () => {
    delete process.env.COOKIE_SECRET;
    process.env.JWT_SECRET = 'some-jwt-secret';
    process.env.NODE_ENV = 'development';
    expect(() => {
      jest.isolateModules(() => {
        require('../app');
      });
    }).not.toThrow();
  });

  it('throws error if JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'development';
    expect(() => {
      jest.isolateModules(() => {
        require('../app');
      });
    }).toThrow(/JWT_SECRET is required/);
  });
});
