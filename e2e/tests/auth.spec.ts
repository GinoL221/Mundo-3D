import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

async function registerFreshAccount(page: Page) {
  const accountId = randomUUID();
  const credentials = {
    email: `user_${accountId}@example.com`,
    password: `Password123!${accountId.replace(/-/g, '').slice(0, 20)}`,
  };

  await page.goto('/register');
  await page.fill('#firstName', 'Test');
  await page.fill('#lastName', 'User');
  await page.fill('#email', credentials.email);
  await page.fill('#password', credentials.password);
  await page.fill('#confirmPassword', credentials.password);
  await page.setInputFiles('#image', {
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake image content'),
  });
  await page.click('#register-btn');
  await expect(page).toHaveURL('/');

  await page.locator('#navbar-user-menu-trigger').click();
  await page.locator('#navbar-logout').click();
  await expect(page).toHaveURL('/login');
  await page.goto('/login');

  return credentials;
}

test.describe('Authentication E2E Tests', () => {
  const testPassword = 'Password123!';

  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('Successful User Registration', async ({ page }) => {
    const registrationEmail = `user_${Date.now()}@example.com`;

    await page.goto('/register');
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#email', registrationEmail);
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
    const { email, password } = await registerFreshAccount(page);

    await page.fill('#email', email);
    await page.fill('#password', password);
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

  test('Recuérdame puts 30 days on both the refresh and access cookies, while the access TOKEN stays short', async ({ page }) => {
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
    await page.locator('#navbar-user-menu-trigger').click();
    await page.locator('#navbar-logout').click();
    await expect(page).toHaveURL('/login');

    await page.fill('#email', rememberEmail);
    await page.fill('#password', testPassword);
    await page.check('#remember');
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    // The access/refresh split moved the remember-me distinction OFF the
    // access cookie. `m3d_auth` is now always short-lived; the session's real
    // length lives on `m3d_refresh`, which is what logout revokes.
    const cookies = await page.context().cookies();
    const nowSeconds = Date.now() / 1000;

    const refreshCookie = cookies.find((c) => c.name === 'm3d_refresh');
    expect(refreshCookie).toBeDefined();
    const refreshRemaining = (refreshCookie!.expires as number) - nowSeconds;
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;

    // Generous tolerance for CI clock skew and request latency — the point is
    // distinguishing "~30 days" from the 2h default, not an exact second.
    expect(refreshRemaining).toBeGreaterThan(thirtyDaysSeconds - 3600);
    expect(refreshRemaining).toBeLessThan(thirtyDaysSeconds + 3600);

    // Scoped to the refresh route, so it is never sent on any other request.
    expect(refreshCookie!.path).toBe('/api/users/refresh');

    // The access COOKIE now follows the session too, so logout can read
    // `familyId` from it even after the token inside has expired. What stays
    // short is the TOKEN's own `exp`, which `apiAuthMiddleware` enforces —
    // not observable from the cookie jar, so it is asserted in the backend
    // unit suite instead of here.
    const authCookie = cookies.find((c) => c.name === 'm3d_auth');
    expect(authCookie).toBeDefined();
    const authRemaining = (authCookie!.expires as number) - nowSeconds;
    expect(authRemaining).toBeGreaterThan(thirtyDaysSeconds - 3600);
  });

  test('Leaving Recuérdame unchecked keeps the 2h default on the refresh cookie', async ({ page }) => {
    const { email, password } = await registerFreshAccount(page);

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    const cookies = await page.context().cookies();
    const nowSeconds = Date.now() / 1000;

    const refreshCookie = cookies.find((c) => c.name === 'm3d_refresh');
    expect(refreshCookie).toBeDefined();
    const refreshRemaining = (refreshCookie!.expires as number) - nowSeconds;
    const twoHoursSeconds = 2 * 60 * 60;

    expect(refreshRemaining).toBeGreaterThan(twoHoursSeconds - 300);
    expect(refreshRemaining).toBeLessThan(twoHoursSeconds + 300);

    // The access cookie tracks the same session length (see the remembered
    // case above for why the cookie outlives its token).
    const authCookie = cookies.find((c) => c.name === 'm3d_auth');
    expect(authCookie).toBeDefined();
    const authRemaining = (authCookie!.expires as number) - nowSeconds;
    expect(authRemaining).toBeGreaterThan(twoHoursSeconds - 300);
    expect(authRemaining).toBeLessThan(twoHoursSeconds + 300);
  });

  test('m3d_auth is httpOnly (invisible to document.cookie) while m3d_user/m3d_csrf are readable', async ({ page }) => {
    const { email, password } = await registerFreshAccount(page);

    await page.fill('#email', email);
    await page.fill('#password', password);
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
    const { email, password } = await registerFreshAccount(page);

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    // Click the HomeHeader user menu to reveal the logout button.
    await page.locator('#navbar-user-menu-trigger').click();
    await expect(page.locator('#navbar-user-menu')).toBeVisible();
    await page.locator('#navbar-logout').click();

    await expect(page).toHaveURL('/login');
    await expect(page.locator('.home-header__link[href="/login"]')).toBeVisible();
    await expect(page.locator('#navbar-greeting')).not.toBeVisible();
  });

  test('Duplicate Email Registration Rejected', async ({ page }) => {
    // Uses the seeded gino@email.com, so this test has no ordering dependency
    // on the earlier registration test in this file.
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

  test('Registration Succeeds Without Profile Image', async ({ page }) => {
    const noImageEmail = `no_image_${Date.now()}@example.com`;

    await page.goto('/register');
    await page.fill('#firstName', 'No');
    await page.fill('#lastName', 'Image');
    await page.fill('#email', noImageEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    // #image intentionally left empty (optional profile image).

    await page.click('#register-btn');

    await expect(page).toHaveURL('/');
    await expect(page.locator('#navbar-greeting')).toContainText('Hola No');
  });

  test('Oversized profile image is rejected on the image field before sending', async ({ page }) => {
    let registerRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/users/register')) registerRequests += 1;
    });

    await page.goto('/register');
    await page.setInputFiles('#image', {
      name: 'avatar.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });

    await expect(page.locator('#image-error')).toHaveText('La imagen pesa más de 5 MB. Elegí una más liviana.');
    await expect(page.locator('#image')).toHaveAttribute('aria-invalid', 'true');

    await page.fill('#firstName', 'Big');
    await page.fill('#lastName', 'Image');
    await page.fill('#email', `big_image_${Date.now()}@example.com`);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    await page.click('#register-btn');

    await expect(page.locator('#image-error')).toHaveText('La imagen pesa más de 5 MB. Elegí una más liviana.');
    await expect(page).toHaveURL('/register');
    expect(registerRequests).toBe(0);
  });

  test('Upload-filter rejection from the server shows on the image field in Spanish', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#firstName', 'Bad');
    await page.fill('#lastName', 'Mime');
    await page.fill('#email', `bad_mime_${Date.now()}@example.com`);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    // Passes the client name/size rules, but the backend multer filter rejects the MIME type.
    await page.setInputFiles('#image', {
      name: 'avatar.jpg',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await page.click('#register-btn');

    await expect(page.locator('#image-error')).toHaveText(
      'No pudimos aceptar la imagen: tiene que ser JPG o PNG y pesar hasta 5 MB.'
    );
    await expect(page.locator('#image')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL('/register');
  });

  test('Password reveal toggle and per-field validation on /register', async ({ page }) => {
    await page.goto('/register');

    const passwordInput = page.locator('#password');
    const toggleBtn = page.locator('button[aria-controls="password"]');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Mostrar contraseña');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(toggleBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleBtn).toHaveAttribute('aria-label', 'Ocultar contraseña');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit empty form to verify client-side per-field errors and summary focus
    await page.click('#register-btn');
    await expect(page.locator('#register-error')).toBeVisible();
    await expect(page.locator('#register-error')).toBeFocused();
    await expect(page.locator('#firstName')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#firstName-error')).toHaveText('Ingresá tu nombre');
    await expect(page.locator('#email-error')).toHaveText('Ingresá tu correo');
  });
});
