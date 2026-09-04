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
    // (sessionUI.ts) must flip it to guest UI on its own. clearSession()
    // expires the readable cookies and broadcasts SYNCHRONOUSLY, before its
    // keepalive logout request, so tab 1's navigation cannot swallow either
    // — this used to race, and lost once logout started revoking the refresh
    // family in the database before replying. The message carries
    // `state: 'logged-out'` so tab 2 acts on it directly instead of
    // re-reading a cookie whose deletion may not have crossed the renderer
    // boundary yet. The retry window below is tolerance for scheduling, not
    // for the network; the visibilitychange/focus fallback layer covers the
    // same outcome if BroadcastChannel alone were ever slower than the poll
    // interval.
    //
    // Every iteration has to genuinely re-fire a listener, or the retry is
    // theatre. A bare `bringToFront()` retry proves nothing: once page 2 is
    // already frontmost, further calls fire no `visibilitychange`, so
    // `update()` never runs a second time and the loop just re-reads a DOM
    // nothing has touched since the first attempt — it would report the
    // first read's result ten seconds later, dressed as a retry. So switch
    // away and back for a real tab switch, and dispatch the two events
    // sessionUI.ts actually binds, because headless Chromium does not
    // reliably translate a programmatic tab switch into them.
    await expect(async () => {
      await page.bringToFront();
      await page2.bringToFront();
      await page2.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      });
      const greetingVisible = await page2.locator('#navbar-greeting').isVisible();
      expect(greetingVisible).toBe(false);
    }).toPass({ timeout: 10_000 });

    await expect(page2.locator('a.navbar__link[href="/login"]')).toBeVisible();
    await expect(page2.locator('.admin-only').first()).toBeHidden();
  });

  test('login in one tab updates a second open tab without a reload', async ({ page, context }) => {
    // Tab 2 opens first, as a guest, in the SAME browser context as tab 1
    // (shares cookies once tab 1 logs in below).
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('a.navbar__link[href="/login"]')).toBeVisible();

    // Tab 1: log in as the seeded ADMIN fixture.
    await page.goto('/login');
    await page.fill('#email', 'admin@email.com');
    await page.fill('#password', 'admin123');
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');
    await expect(page.locator('#navbar-greeting')).toContainText('Hola');

    // Tab 2: never navigated or reloaded. LoginForm.astro broadcasts on the
    // m3d-session BroadcastChannel symmetrically with clearSession()'s
    // logout broadcast (session.service.ts), so tab 2 updates immediately —
    // it doesn't need the focus/visibilitychange fallback layer in
    // sessionUI.ts, which real browsers only fire on an actual tab switch.
    await expect(async () => {
      const greetingVisible = await page2.locator('#navbar-greeting').isVisible();
      expect(greetingVisible).toBe(true);
    }).toPass({ timeout: 10_000 });

    await expect(page2.locator('#navbar-greeting')).toContainText('Hola');
    await expect(page2.locator('.admin-only').first()).toBeVisible();
  });
});
