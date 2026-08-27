import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  const testEmail = `user_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('Successful User Registration', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    
    // Set mock profile image (required by backend validator)
    await page.setInputFiles('#image', {
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content'),
    });

    await page.click('#register-btn');

    await expect(page).toHaveURL('/');
    await expect(page.locator('#navbar-greeting')).toContainText('Hola Test');
  });

  test('Successful User Login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#login-btn');

    await expect(page).toHaveURL('/');
    await expect(page.locator('#navbar-greeting')).toContainText('Hola Test');
    
    // Save storage state to reuse in cart tests
    await page.context().storageState({ path: '.auth/user.json' });
  });

  test('Invalid Credentials Handling', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('#login-btn');

    const errorBox = page.locator('#login-error');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).not.toBeEmpty();
  });

  test('Recuérdame checkbox issues a 30-day auth cookie instead of the 2h default', async ({ page }) => {
    const rememberEmail = `remember_${Date.now()}@example.com`;

    // Register a dedicated user so this test doesn't depend on run order
    // relative to the "Successful User Login" test above.
    await page.goto('/register');
    await page.fill('#firstName', 'Remember');
    await page.fill('#lastName', 'Me');
    await page.fill('#email', rememberEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    await page.setInputFiles('#image', {
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content'),
    });
    await page.click('#register-btn');
    await expect(page).toHaveURL('/');

    // Log back out so the next login actually exercises the checkbox instead
    // of reusing the session register() already created.
    await page.locator('.nav-item__trigger').hover();
    await page.locator('#navbar-logout').click();
    await expect(page).toHaveURL('/login');

    await page.fill('#email', rememberEmail);
    await page.fill('#password', testPassword);
    await page.check('#remember');
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'm3d_auth');
    expect(authCookie).toBeDefined();

    const nowSeconds = Date.now() / 1000;
    const remainingSeconds = (authCookie!.expires as number) - nowSeconds;
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;

    // Generous tolerance for test/CI clock skew and request latency — the
    // point is distinguishing "~30 days" from the 2h default, not asserting
    // an exact second.
    expect(remainingSeconds).toBeGreaterThan(thirtyDaysSeconds - 3600);
    expect(remainingSeconds).toBeLessThan(thirtyDaysSeconds + 3600);
  });

  test('Leaving Recuérdame unchecked keeps the 2h default auth cookie lifetime', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'm3d_auth');
    expect(authCookie).toBeDefined();

    const nowSeconds = Date.now() / 1000;
    const remainingSeconds = (authCookie!.expires as number) - nowSeconds;
    const twoHoursSeconds = 2 * 60 * 60;

    expect(remainingSeconds).toBeGreaterThan(twoHoursSeconds - 300);
    expect(remainingSeconds).toBeLessThan(twoHoursSeconds + 300);
  });

  test('m3d_auth is httpOnly (invisible to document.cookie) while m3d_user/m3d_csrf are readable', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    // Proves httpOnly is actually enforced by the real browser, not just
    // declared server-side (cookieOptions.ts) — session.service.ts and
    // sessionUI.ts both depend on document.cookie exposing m3d_user/m3d_csrf
    // but never m3d_auth.
    const clientVisibleCookies = await page.evaluate(() => document.cookie);
    expect(clientVisibleCookies).not.toMatch(/(?:^|; )m3d_auth=/);
    expect(clientVisibleCookies).toMatch(/(?:^|; )m3d_user=/);
    expect(clientVisibleCookies).toMatch(/(?:^|; )m3d_csrf=/);

    // The httpOnly cookie still exists server-side (Playwright's cookie jar
    // reads it via CDP, bypassing the httpOnly JS restriction) — it's just
    // absent from the page's own document.cookie above.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'm3d_auth')).toBeDefined();
  });

  test('User Logout', async ({ page }) => {
    // First, login
    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    // Hover user dropdown to reveal logout button and click
    await page.locator('.nav-item__trigger').hover();
    await page.locator('#navbar-logout').click();

    await expect(page).toHaveURL('/login');
    await expect(page.locator('a.navbar__link[href="/login"]')).toBeVisible();
    await expect(page.locator('#navbar-greeting')).not.toBeVisible();
  });

  test('Duplicate Email Registration Rejected', async ({ page }) => {
    // Reuses the seeded gino@email.com instead of testEmail, so this test
    // has no ordering dependency on the earlier registration test in this file.
    await page.goto('/register');
    await page.fill('#firstName', 'Dup');
    await page.fill('#lastName', 'Licate');
    await page.fill('#email', 'gino@email.com');
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    await page.setInputFiles('#image', {
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content'),
    });

    await page.click('#register-btn');

    const errorBox = page.locator('#register-error');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toHaveText('Este email ya está registrado');
    await expect(page).toHaveURL('/register');
  });

  test('Missing Image Registration Rejected', async ({ page }) => {
    const noImageEmail = `no_image_${Date.now()}@example.com`;

    await page.goto('/register');
    await page.fill('#firstName', 'No');
    await page.fill('#lastName', 'Image');
    await page.fill('#email', noImageEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    // #image intentionally left empty.

    await page.click('#register-btn');

    const errorBox = page.locator('#register-error');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toHaveText('Tienes que subir una imagen');
    await expect(page).toHaveURL('/register');
  });
});
