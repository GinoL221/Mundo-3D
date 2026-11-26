import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';

// Refresh Tokens with Rotation (HIGH-1), task 3.11. Two real invariants
// from design.md, proven end to end against the real backend/DB, not a
// mocked use case:
//
//   1. D1 (conditional-UPDATE rotation claim) + D2 (30s non-rotating grace
//      window) together mean two tabs racing a refresh on the SAME expired
//      access token both come back with a fresh access cookie — one as the
//      rotation winner, the other as a grace hit. Client-side single-flight
//      (refreshSingleFlight.ts) is per-tab only (module state is per JS
//      realm), so this is a genuine cross-tab race the SERVER must resolve.
//   2. D3 (`typ` claim): a validly-signed pre-deploy JWT with no `typ`
//      claim is rejected by `apiAuthMiddleware`, and since it was never
//      paired with a real `m3d_refresh` cookie, `authFetch`'s transparent
//      refresh attempt also fails — landing the tab cleanly on /login
//      instead of an infinite retry loop (design.md D6 requirement:
//      authFetch never retries twice).
//
// Must match playwright.config.ts's webServer env for the backend — an
// e2e-only secret, never used in production.
const E2E_JWT_SECRET = 'e2e-only-jwt-secret-not-for-production';
const FRONTEND_URL = `http://localhost:${process.env.M3D_E2E_FRONTEND_PORT}`;

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * Hand-signs an HS256 JWT without adding `jsonwebtoken` as an e2e
 * dependency (design.md's file list adds no new package here) — a
 * TEST-ONLY forgery of the exact shape `issueAccessCookie`
 * (backend/src/infrastructure/controllers/sessionCookies.ts) produces,
 * used to simulate access-token states (expired, or missing `typ`) without
 * waiting out the real `ACCESS_TOKEN_TTL_SECONDS` window.
 */
function signAccessJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', E2E_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

test.describe('Refresh token rotation — cross-tab race and legacy-JWT cutover', () => {
  test('two tabs refreshing concurrently on simultaneous access-token expiry both stay logged in', async ({
    page,
    context,
  }) => {
    // Real login — issues a genuine m3d_refresh cookie/family server-side
    // (the seeded ADMIN fixture, same as cross-tab-session.spec.ts).
    await page.goto('/login');
    await page.fill('#email', 'admin@email.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');
    await expect(page.locator('#navbar-greeting')).toContainText('Hola');

    // Overwrite ONLY the access cookie with an already-expired one, in the
    // SAME context both tabs below will share. The real m3d_refresh cookie
    // login just issued is left completely untouched — this is exactly the
    // "expired access token, valid refresh token" state D1/D2 exist for.
    const expiredAccessToken = signAccessJwt({
      typ: 'access',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await context.addCookies([
      { name: 'm3d_auth', value: expiredAccessToken, url: FRONTEND_URL, httpOnly: true },
    ]);

    const page2 = await context.newPage();

    // Both waiters are armed BEFORE navigation so neither can miss its
    // response. Matching on status 200 specifically (not just the URL)
    // skips over each tab's own initial 401 and only resolves once the
    // authFetch-driven retry (profile.service.ts) actually landed.
    const tab1Refreshed = page.waitForResponse(
      (res) => res.url().includes('/api/users/me') && res.status() === 200
    );
    const tab2Refreshed = page2.waitForResponse(
      (res) => res.url().includes('/api/users/me') && res.status() === 200
    );

    // /profile calls fetchCurrentProfile() (authFetch-wrapped) on load for
    // every authenticated role including ADMIN. Firing both navigations
    // together makes this a genuine simultaneous cross-tab refresh race.
    await Promise.all([page.goto('/profile'), page2.goto('/profile')]);
    await Promise.all([tab1Refreshed, tab2Refreshed]);

    // Neither tab was bounced to /login, and both finished loading the
    // read-only profile view — proving each independently ended up with a
    // fresh, valid access cookie (rotation winner or grace hit).
    await expect(page).toHaveURL('/profile');
    await expect(page2).toHaveURL('/profile');
    await expect(page.locator('#profile-content')).toBeVisible();
    await expect(page2.locator('#profile-content')).toBeVisible();
    await expect(page.locator('#profile-error')).toBeHidden();
    await expect(page2.locator('#profile-error')).toBeHidden();
  });

  test('a legacy typ-less JWT is rejected, the transparent refresh fails (no session), and the tab lands cleanly on /login', async ({
    page,
    context,
  }) => {
    // No login at all — an unexpired but `typ`-less JWT, simulating a
    // session that predates this change's cookie split (design.md D3:
    // "Pre-deploy JWTs carry no typ -> deterministic forced logout"). No
    // m3d_refresh cookie was ever issued for it, so the refresh MUST fail
    // too — this is what distinguishes this test from the one above.
    const legacyToken = signAccessJwt({
      userId: 1,
      exp: Math.floor(Date.now() / 1000) + 3600, // unexpired — typ is what fails it, not exp
    });
    // A real pre-deploy session carried all three cookies — the old
    // `setSessionCookies` always issued `m3d_auth`, `m3d_csrf` and `m3d_user`
    // together. Seeding only `m3d_auth` would describe a session that never
    // existed, and would read as a guest to `authFetch`, which deliberately
    // does not evict visitors who were never logged in.
    await context.addCookies([
      { name: 'm3d_auth', value: legacyToken, url: FRONTEND_URL, httpOnly: true },
      { name: 'm3d_csrf', value: 'legacy.csrf', url: FRONTEND_URL },
      {
        name: 'm3d_user',
        value: encodeURIComponent(JSON.stringify({ firstName: 'Legacy', image: null, idRole: 2 })),
        url: FRONTEND_URL,
      },
    ]);

    await page.goto('/orders');

    // apiAuthMiddleware 401s (missing typ) -> authFetch's transparent
    // refresh attempt also fails (no m3d_refresh cookie exists) ->
    // authFetch's endSessionAndRedirect() sends the tab to /login exactly
    // once, never looping (design.md D6: authFetch never retries twice,
    // and never wraps the refresh call itself).
    await expect(page).toHaveURL('/login');
  });
});
