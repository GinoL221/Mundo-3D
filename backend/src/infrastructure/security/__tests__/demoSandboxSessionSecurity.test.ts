import {
  DEMO_AUTH_COOKIE,
  DEMO_AUTH_COOKIE_PATH,
  DEMO_CSRF_COOKIE,
  DEMO_CSRF_COOKIE_PATH,
  DEMO_REFRESH_COOKIE,
  DEMO_REFRESH_COOKIE_PATH,
  DEMO_SANDBOX_IDLE_TIMEOUT_MS,
  DEMO_SANDBOX_MAX_LIFETIME_MS,
  demoAccessCookieOptions,
  demoCsrfCookieOptions,
  demoRefreshCookieOptions,
} from '../demoSandboxCookies';
import { issueDemoSandboxCsrfToken, verifyDemoSandboxCsrfToken } from '../demoSandboxCsrfToken';
import { AUTH_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../cookieOptions';

const SANDBOX_SECRET = 'sandbox-secret-at-least-32-chars-long-001';
const OTHER_SECRET = 'other-sandbox-secret-at-least-32-chars-002';

describe('demo sandbox cookie options', () => {
  it('uses cookie names and paths isolated from production auth cookies', () => {
    expect(DEMO_AUTH_COOKIE).not.toBe(AUTH_COOKIE);
    expect(DEMO_REFRESH_COOKIE).not.toBe(REFRESH_COOKIE);
    expect(DEMO_CSRF_COOKIE).not.toBe(CSRF_COOKIE);
    expect(DEMO_AUTH_COOKIE_PATH).toBe('/api/demo');
    expect(DEMO_REFRESH_COOKIE_PATH).toBe('/api/demo/session/refresh');
    expect(DEMO_CSRF_COOKIE_PATH).toBe('/');
    expect(DEMO_SANDBOX_IDLE_TIMEOUT_MS).toBe(15 * 60 * 1000);
    expect(DEMO_SANDBOX_MAX_LIFETIME_MS).toBe(45 * 60 * 1000);
  });

  it('builds consistent set and clear options with HttpOnly on auth/refresh and readable CSRF', () => {
    expect(demoAccessCookieOptions(900_000)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/demo',
      maxAge: 900_000,
    });
    expect(demoAccessCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/demo',
    });
    expect(demoAccessCookieOptions().maxAge).toBeUndefined();

    expect(demoRefreshCookieOptions(2_700_000)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/demo/session/refresh',
      maxAge: 2_700_000,
    });
    expect(demoCsrfCookieOptions(2_700_000)).toMatchObject({
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 2_700_000,
    });
  });
});

describe('demo sandbox scoped CSRF token', () => {
  const scopeA = { slotId: 'slot-1', leaseId: 'lease-a', userId: 1 };

  it('issues and verifies a token bound to slotId, leaseId, userId, and sandbox secret', () => {
    const token = issueDemoSandboxCsrfToken(scopeA, SANDBOX_SECRET);
    expect(verifyDemoSandboxCsrfToken(token, scopeA, SANDBOX_SECRET)).toBe(true);
  });

  it('rejects cross-slot, cross-lease, cross-user, cross-secret, and malformed tokens', () => {
    const token = issueDemoSandboxCsrfToken(scopeA, SANDBOX_SECRET);

    expect(verifyDemoSandboxCsrfToken(token, { ...scopeA, slotId: 'slot-2' }, SANDBOX_SECRET)).toBe(
      false,
    );
    expect(
      verifyDemoSandboxCsrfToken(token, { ...scopeA, leaseId: 'lease-b' }, SANDBOX_SECRET),
    ).toBe(false);
    expect(verifyDemoSandboxCsrfToken(token, { ...scopeA, userId: 2 }, SANDBOX_SECRET)).toBe(false);
    expect(verifyDemoSandboxCsrfToken(token, scopeA, OTHER_SECRET)).toBe(false);
    expect(verifyDemoSandboxCsrfToken(undefined, scopeA, SANDBOX_SECRET)).toBe(false);
    expect(verifyDemoSandboxCsrfToken('not-a-token', scopeA, SANDBOX_SECRET)).toBe(false);
    expect(verifyDemoSandboxCsrfToken(`${token}x`, scopeA, SANDBOX_SECRET)).toBe(false);
    expect(
      verifyDemoSandboxCsrfToken(
        token,
        { slotId: '', leaseId: 'lease-a', userId: 1 },
        SANDBOX_SECRET,
      ),
    ).toBe(false);
    for (const malformed of [
      { slotId: 123, leaseId: 'lease-a', userId: 1 },
      { slotId: 'slot-1', leaseId: null, userId: 1 },
      { slotId: 'slot-1', leaseId: 'lease-a', userId: {} },
    ]) {
      expect(
        verifyDemoSandboxCsrfToken(
          token,
          malformed as unknown as Parameters<typeof verifyDemoSandboxCsrfToken>[1],
          SANDBOX_SECRET,
        ),
      ).toBe(false);
    }
  });

  it('rejects short secrets when issuing and fails closed when verifying', () => {
    expect(() => issueDemoSandboxCsrfToken(scopeA, 'too-short')).toThrow(
      'Demo sandbox CSRF secret must be at least 32 characters long',
    );
    expect(verifyDemoSandboxCsrfToken('abc.def', scopeA, 'too-short')).toBe(false);
  });
});
