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
  await expect(userMenu.locator('a[href="/profile"]')).toBeVisible();
  const ordersLink = userMenu.locator('a[href="/orders"]');
  await ordersLink.focus();
  await expect(ordersLink).toBeFocused();
  await ordersLink.click();
  await expect(page).toHaveURL(/\/orders$/);
});

test('supports skip link to main, visual left-to-right desktop Tab order, logo focus ring, and mini-cart focus-out', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/aboutUs');

  // 1. Skip link appears on first Tab and moves focus to <main>
  await page.keyboard.press('Tab');
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveText('Saltar al contenido');
  const skipBox = await skipLink.boundingBox();
  expect(skipBox).not.toBeNull();
  expect(skipBox!.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  // 2. Desktop header Tab sequence follows visual left-to-right order
  await page.goto('/aboutUs');
  await page.keyboard.press('Tab'); // skip-link
  const actualTabOrder: Array<{ label: string; left: number }> = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        label: el.getAttribute('aria-label') || el.textContent?.trim() || el.id || el.tagName,
        left: rect.left,
        outlineWidth: getComputedStyle(el).outlineWidth,
        outlineStyle: getComputedStyle(el).outlineStyle,
      };
    });
    expect(info).not.toBeNull();
    if (i === 0) {
      expect(info!.outlineStyle).toBe('solid');
      expect(info!.outlineWidth).toBe('3px');
    }
    actualTabOrder.push({ label: info!.label, left: info!.left });
  }

  expect(actualTabOrder.map((entry) => entry.label)).toEqual([
    'Mundo 3D — Inicio',
    'Catálogo',
    'Encargos',
    'Cómo funciona',
    'Carrito de compras',
    'Iniciar sesión',
    'Registrarse',
    'Tema: sistema (actualmente claro). Cambiar a tema claro',
  ]);
  for (let i = 1; i < actualTabOrder.length; i += 1) {
    expect(actualTabOrder[i].left).toBeGreaterThan(actualTabOrder[i - 1].left);
  }

  // 3. Mini-cart closes on Tab outside without stealing focus
  const cartTrigger = page.locator('#navbar-cart-trigger');
  const miniCart = page.locator('#navbar-cart-menu');
  await cartTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(miniCart).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('.mini-cart__secondary-link')).toBeFocused();
  await expect(miniCart).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('.home-header__link[href="/login"]')).toBeFocused();
  await expect(miniCart).toBeHidden();
});

test('marks header auth links with aria-current="page" on /login and /register', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.locator('.home-header__link[href="/login"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.home-header__link[href="/register"]')).not.toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.goto('/register');
  await expect(page.locator('.home-header__link[href="/register"]')).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.home-header__link[href="/login"]')).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});
