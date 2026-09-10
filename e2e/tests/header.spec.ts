import { test, expect } from '@playwright/test';

test('applies persisted visual preferences before HomeHeader hydration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('retro-theme-preference', 'disabled');
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).not.toHaveClass(/crt-theme-active/);
  await expect(page.locator('#theme-toggle')).toBeVisible();
});

test('preserves HomeHeader navigation and keyboard dropdown access', async ({
  page,
  context,
}) => {
  // Session state is now a non-httpOnly cookie (m3d_user), not localStorage
  // (JWT cookie migration) — sessionUI.ts reads document.cookie only.
  await context.addCookies([
    {
      name: 'm3d_user',
      value: encodeURIComponent(
        JSON.stringify({ firstName: 'Header', idRole: 2, image: 'usuarioSinImagen.jpg' }),
      ),
      url: 'http://localhost:4322',
    },
  ]);

  await page.goto('/aboutUs');

  await page.locator('.home-header__link[href="/products"]').click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto('/aboutUs');
  await page.locator('#navbar-user-menu-trigger').click();
  const userMenu = page.locator('#navbar-user-menu');
  await expect(userMenu).toBeVisible();
  const profileLink = userMenu.locator('a[href="/profile"]');
  await profileLink.focus();
  await expect(profileLink).toBeFocused();
  await profileLink.click();
  await expect(page).toHaveURL(/\/profile$/);
});
