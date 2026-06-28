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
});
