import { test, expect } from '@playwright/test';

// Exercises the full cookie-based session lifecycle end to end, across the
// real cross-origin frontend (4322) <-> backend (3032) pair (design.md
// "SameSite=Lax over None" — same-site, cross-origin, no HTTPS needed):
// login sets the httpOnly/CSRF/display cookies, an authenticated cart write
// proves withCredentials()+CSRF actually round-trips, the admin page proves
// the m3d_user cookie gates admin UI, and logout in one tab is reflected in
// a second open tab without a reload (astro-frontend spec "Cross-Tab
// Session Synchronization" — BroadcastChannel, since httpOnly cookie
// changes fire no `storage` event). This does not duplicate auth.spec.ts's
// single-tab login/logout coverage or cart.spec.ts's guest/authenticated
// cart coverage — it is the only spec exercising two tabs sharing one
// session.
test.describe('Cross-tab session synchronization', () => {
  test('logout in one tab updates a second open tab without a reload', async ({ page, context }) => {
    page.on('console', (msg) => console.log(`[tab1] ${msg.type()}: ${msg.text()}`));

    // Tab 1: log in as the seeded ADMIN fixture (backend/src/database/data/users.json).
    await page.goto('/login');
    await page.fill('#email', 'admin@email.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');
    await expect(page.locator('#navbar-greeting')).toContainText('Hola');

    // Authenticated cart write: exercises CartService.syncToBackend's
    // withCredentials() + X-CSRF-Token round trip against the real backend
    // (Phase 8 of this change) — a wrong/missing CSRF token would 403 and
    // the badge would never reach "1".
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    await page.click('#add-to-cart-btn');
    await expect(page.locator('#navbar-cart-badge')).toHaveText('1');

    // Admin page: gated by the m3d_user cookie's idRole (visual-admin-hiding
    // spec's client-side gate), reachable only because login actually set it.
    await page.goto('/admin/products');
    await expect(page.locator('#admin-products-content')).toBeVisible();
    await expect(page.locator('#admin-gate-denied')).toBeHidden();

    // Tab 2: opened in the SAME browser context, so it shares tab 1's
    // cookies — proving the session (not just the UI state) is genuinely
    // shared, exactly like two real tabs of one browser profile.
    const page2 = await context.newPage();
    page2.on('console', (msg) => console.log(`[tab2] ${msg.type()}: ${msg.text()}`));
    await page2.goto('/');
    await expect(page2.locator('#navbar-greeting')).toContainText('Hola');
    await expect(page2.locator('.admin-only').first()).toBeVisible();

    // Tab 1: log out via the navbar dropdown (same interaction as
    // auth.spec.ts's single-tab "User Logout" test).
    await page.locator('.nav-item__trigger').hover();
    await page.locator('#navbar-logout').click();
    await expect(page).toHaveURL('/login');

    // Tab 2: never navigated or reloaded. Its BroadcastChannel listener
    // (sessionUI.ts) must flip it to guest UI on its own. `expect.poll`
    // tolerates the fire-and-forget clearSession()/navigation race in tab 1
    // (clearSession() has no `keepalive`, unlike CartService's sync call) —
    // the visibilitychange/focus fallback layer covers the same outcome if
    // BroadcastChannel alone were ever slower than the poll interval.
    await expect(async () => {
      await page2.bringToFront();
      const greetingVisible = await page2.locator('#navbar-greeting').isVisible();
      expect(greetingVisible).toBe(false);
    }).toPass({ timeout: 10_000 });

    await expect(page2.locator('a.navbar__link[href="/login"]')).toBeVisible();
    await expect(page2.locator('.admin-only').first()).toBeHidden();
  });
});
