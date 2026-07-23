import { test, expect } from '@playwright/test';

test('applies persisted visual preferences before Header hydration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('retro-theme-preference', 'disabled');
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveClass(/crt-theme-active/);
  await expect(page.locator('#theme-toggle')).toBeVisible();
});

test('preserves real Header navigation, keyboard dropdown access, and visual-only search', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'header-test-token');
    localStorage.setItem(
      'user',
      JSON.stringify({ firstName: 'Header', idRole: 2, image: 'usuarioSinImagen.jpg' }),
    );
  });

  await page.goto('/');

  const searchUrl = page.url();
  await page.locator('.navbar__search-btn').click();
  await expect(page).toHaveURL(searchUrl);
  await expect(page.locator('.navbar__search-input')).toHaveValue('');

  await page.locator('.navbar__link[href="/products"]').click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto('/');
  const userMenu = page.locator('.user-only');
  await userMenu.locator('.nav-item__trigger').hover();
  const profileLink = userMenu.locator('a[href="/profile"]');
  await profileLink.focus();
  await expect(profileLink).toBeVisible();
  await expect(page.locator('.nav-item__trigger:focus-within')).toHaveCount(1);
  await profileLink.click();
  await expect(page).toHaveURL(/\/profile$/);
});
