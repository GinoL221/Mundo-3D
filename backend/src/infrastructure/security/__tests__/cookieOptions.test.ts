import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  USER_COOKIE,
  REMEMBER_MAX_AGE,
  SESSION_MAX_AGE,
  cookieOptions,
  authMaxAge,
  authExpiresInSeconds,
} from '../cookieOptions';

describe('cookie name constants', () => {
  it('exposes the three cookie names used across login/logout/middleware', () => {
    expect(AUTH_COOKIE).toBe('m3d_auth');
    expect(CSRF_COOKIE).toBe('m3d_csrf');
    expect(USER_COOKIE).toBe('m3d_user');
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

describe('authExpiresInSeconds', () => {
  it('derives seconds from REMEMBER_MAX_AGE when remember is true', () => {
    expect(authExpiresInSeconds(true)).toBe(REMEMBER_MAX_AGE / 1000);
  });

  it('derives seconds from SESSION_MAX_AGE when remember is false', () => {
    expect(authExpiresInSeconds(false)).toBe(SESSION_MAX_AGE / 1000);
  });

  it('stays in sync with authMaxAge for both branches (single shared source)', () => {
    expect(authExpiresInSeconds(true) * 1000).toBe(authMaxAge(true));
    expect(authExpiresInSeconds(false) * 1000).toBe(authMaxAge(false));
  });
});

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
