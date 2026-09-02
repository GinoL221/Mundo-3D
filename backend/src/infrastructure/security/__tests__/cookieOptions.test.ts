import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  USER_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  ACCESS_TOKEN_TTL_SECONDS,
  REMEMBER_MAX_AGE,
  SESSION_MAX_AGE,
  cookieOptions,
  accessCookieOptions,
  refreshCookieOptions,
  authMaxAge,
} from '../cookieOptions';

describe('cookie name constants', () => {
  it('exposes the four cookie names used across login/logout/middleware/refresh', () => {
    expect(AUTH_COOKIE).toBe('m3d_auth');
    expect(CSRF_COOKIE).toBe('m3d_csrf');
    expect(USER_COOKIE).toBe('m3d_user');
    expect(REFRESH_COOKIE).toBe('m3d_refresh');
  });

  it('scopes the refresh cookie to its own route (design.md D4)', () => {
    expect(REFRESH_COOKIE_PATH).toBe('/api/users/refresh');
  });
});

describe('ACCESS_TOKEN_TTL_SECONDS', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('defaults to 30 minutes (1800s) when unset', () => {
    delete process.env.ACCESS_TOKEN_TTL_SECONDS;
    let ttl: number;
    jest.isolateModules(() => {
      ttl = require('../cookieOptions').ACCESS_TOKEN_TTL_SECONDS;
    });
    expect(ttl!).toBe(30 * 60);
  });

  it('is env-tunable (the no-deploy rollback lever)', () => {
    process.env.ACCESS_TOKEN_TTL_SECONDS = '600';
    let ttl: number;
    jest.isolateModules(() => {
      ttl = require('../cookieOptions').ACCESS_TOKEN_TTL_SECONDS;
    });
    expect(ttl!).toBe(600);
  });
});

describe('accessCookieOptions', () => {
  it('is httpOnly, path "/", and maxAge = ACCESS_TOKEN_TTL_SECONDS * 1000', () => {
    const options = accessCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(ACCESS_TOKEN_TTL_SECONDS * 1000);
  });
});

describe('refreshCookieOptions', () => {
  it('is httpOnly and scoped to REFRESH_COOKIE_PATH, with the given maxAge', () => {
    const options = refreshCookieOptions(12345);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe(REFRESH_COOKIE_PATH);
    expect(options.maxAge).toBe(12345);
  });

  it('omits maxAge when called with none, so the clear can never mismatch a set', () => {
    const options = refreshCookieOptions();
    expect(options.maxAge).toBeUndefined();
    expect(options.path).toBe(REFRESH_COOKIE_PATH);
  });

  it('set/clear flag symmetry: refreshCookieOptions() (clear) shares every flag with a set except maxAge', () => {
    const setOptions = refreshCookieOptions(999);
    const clearOptions = refreshCookieOptions();
    expect(clearOptions.httpOnly).toBe(setOptions.httpOnly);
    expect(clearOptions.path).toBe(setOptions.path);
    expect(clearOptions.sameSite).toBe(setOptions.sameSite);
    expect(clearOptions.secure).toBe(setOptions.secure);
  });
});

describe('max-age constants', () => {
  it('SESSION_MAX_AGE is exactly 2 hours in milliseconds', () => {
    expect(SESSION_MAX_AGE).toBe(2 * 60 * 60 * 1000);
  });

  it('REMEMBER_MAX_AGE is exactly 30 days in milliseconds', () => {
    expect(REMEMBER_MAX_AGE).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('authMaxAge', () => {
  it('returns REMEMBER_MAX_AGE when remember is true', () => {
    expect(authMaxAge(true)).toBe(REMEMBER_MAX_AGE);
  });

  it('returns SESSION_MAX_AGE when remember is false', () => {
    expect(authMaxAge(false)).toBe(SESSION_MAX_AGE);
  });

  it('returns SESSION_MAX_AGE when remember is omitted', () => {
    expect(authMaxAge()).toBe(SESSION_MAX_AGE);
  });
});

// authExpiresInSeconds is retired (design.md D4): the access token's TTL no
// longer derives from authMaxAge/remember, it is fixed at
// ACCESS_TOKEN_TTL_SECONDS — see the describe block above.

describe('cookieOptions', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sets httpOnly exactly as passed in', () => {
    expect(cookieOptions({ httpOnly: true }).httpOnly).toBe(true);
    expect(cookieOptions({ httpOnly: false }).httpOnly).toBe(false);
  });

  it('always sets sameSite to lax', () => {
    expect(cookieOptions({ httpOnly: false }).sameSite).toBe('lax');
  });

  it('always sets path to /', () => {
    expect(cookieOptions({ httpOnly: true }).path).toBe('/');
  });

  it('sets secure to false when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    expect(cookieOptions({ httpOnly: false }).secure).toBe(false);
  });

  it('sets secure to false when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    expect(cookieOptions({ httpOnly: false }).secure).toBe(false);
  });

  it('sets secure to true when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    expect(cookieOptions({ httpOnly: false }).secure).toBe(true);
  });

  it('omits domain when COOKIE_DOMAIN is unset', () => {
    delete process.env.COOKIE_DOMAIN;
    expect(cookieOptions({ httpOnly: false }).domain).toBeUndefined();
  });

  it('sets domain from COOKIE_DOMAIN when present', () => {
    process.env.COOKIE_DOMAIN = 'mundo3d.com';
    expect(cookieOptions({ httpOnly: false }).domain).toBe('mundo3d.com');
  });

  it('passes maxAge through when provided', () => {
    expect(cookieOptions({ httpOnly: false, maxAge: 12345 }).maxAge).toBe(12345);
  });

  it('omits maxAge when not provided', () => {
    expect(cookieOptions({ httpOnly: false }).maxAge).toBeUndefined();
  });
});
