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
      url: `http://localhost:${process.env.M3D_E2E_FRONTEND_PORT}`,
    },
  ]);

  await page.goto('/aboutUs');

  await page.locator('.home-header__link[href="/products"]').click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto('/aboutUs');
  const header = page.locator('.home-header');
  const headerHeightBefore = (await header.boundingBox())!.height;
  await page.locator('#navbar-user-menu-trigger').click();
  const userMenu = page.locator('#navbar-user-menu');
  await expect(userMenu).toBeVisible();
  const headerHeightAfter = (await header.boundingBox())!.height;
  expect(Math.abs(headerHeightAfter - headerHeightBefore)).toBeLessThanOrEqual(1);
  await expect(userMenu.locator('a[href="/profile"]')).toHaveCount(0);
  const ordersLink = userMenu.locator('a[href="/orders"]');
  await ordersLink.focus();
  await expect(ordersLink).toBeFocused();
  await ordersLink.click();
  await expect(page).toHaveURL(/\/orders$/);
});
