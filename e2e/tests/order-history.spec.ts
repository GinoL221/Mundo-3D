import { test, expect, type Page } from '@playwright/test';

async function registerFreshUser(page: Page, label: string): Promise<void> {
  const email = `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`;
  const password = 'Password123!';

  await page.goto('/register');
  await page.fill('#firstName', label);
  await page.fill('#lastName', 'Buyer');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.click('#register-btn');
  await expect(page).toHaveURL('/');
}

test.describe('Order History E2E', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    await registerFreshUser(page, 'Orders');
    await page.evaluate(() => localStorage.removeItem('cart'));
  });

  test('the nav exposes a "Mis pedidos" link to /orders for an authenticated user', async ({
    page,
  }) => {
    const userMenu = page.locator('.user-only');
    await userMenu.locator('#navbar-user-menu-trigger').click();
    const link = userMenu.locator('a[href="/orders"]', { hasText: 'Mis pedidos' });
    await expect(link).toBeVisible();
  });

  test('placing a real order makes it appear in /orders, linking through to its real detail page', async ({
    page,
  }) => {
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    const addToCartPut = page.waitForResponse(
      (res) => res.url().includes('/api/cart') && res.request().method() === 'PUT',
    );
    await page.click('#add-to-cart-btn');
    await expect(async () => {
      const cart = await page.evaluate(() => localStorage.getItem('cart'));
      expect(cart).toContain('"productId":1');
    }).toPass();
    await addToCartPut;

    await page.goto('/cart');
    await expect(page.locator('.cart__item')).toHaveCount(1);
    await page.click('.cart__btn-checkout');
    await expect(page).toHaveURL(/\/order\?id=(\d+)/);
    const placedOrderId = new URL(page.url()).searchParams.get('id');

    await page.goto('/orders');
    await expect(page.locator('#my-orders-content')).toBeVisible();
    await expect(page.locator('#my-orders-empty')).toBeHidden();

    const firstRow = page.locator('#my-orders-body tr').first();
    await expect(firstRow.locator('.order-row-id')).toContainText(placedOrderId!);
    await expect(firstRow.locator('.order-row-status .ui-badge')).toHaveText('Pedido simulado');
    await expect(firstRow.locator('.order-row-total')).toContainText('$ ');
    await expect(firstRow.locator('.order-row-total')).not.toContainText('.00');

    // Click through to the real detail page and confirm it's the same order.
    await firstRow.locator('.order-row-link').click();
    await expect(page).toHaveURL(`/order?id=${placedOrderId}`);
    await expect(page.locator('#order-error')).toBeHidden();
    await expect(page.locator('#order-id')).toHaveText(placedOrderId!);
    await expect(page.locator('#order-status')).toHaveText('Pedido simulado');
    await expect(page.locator('#order-total')).toContainText('$ ');
    await expect(page.locator('#order-content')).not.toContainText('Referencia de pago');
    await expect(page.locator('#order-content')).not.toContainText('AWAITING_PAYMENT');
    await expect(page.locator('.order-item-link').first()).toHaveAttribute('href', '/product?id=1');
  });

  test('not-found /order shows a neutral state with a single "Volver a mis pedidos" action', async ({
    page,
  }) => {
    await page.goto('/order?id=999999');

    await expect(page.locator('#order-not-found')).toBeVisible();
    await expect(page.locator('#order-not-found')).toContainText('No encontramos este pedido');
    await expect(page.locator('#order-error')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Volver a mis pedidos' })).toHaveCount(1);
  });

  test('logged-out /orders and /order show an informational login prompt instead of a red error', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    try {
      await anonPage.goto('/orders');
      await expect(anonPage.locator('#my-orders-unauth')).toBeVisible();
      await expect(anonPage.locator('#my-orders-error')).toBeHidden();
      await expect(anonPage.locator('#my-orders-unauth a[href="/login"]')).toHaveText(
        'Iniciar sesión',
      );
      await expect(anonPage.locator('#my-orders-unauth a[href="/products"]')).toHaveText(
        'Ir al catálogo',
      );

      await anonPage.goto('/order?id=1');
      await expect(anonPage.locator('#order-unauth')).toBeVisible();
      await expect(anonPage.locator('#order-error')).toBeHidden();
      await expect(anonPage.locator('#order-unauth a[href="/login"]')).toHaveText(
        'Iniciar sesión',
      );
      await expect(anonPage.locator('#order-unauth a[href="/products"]')).toHaveText(
        'Ir al catálogo',
      );
    } finally {
      await anonContext.close();
    }
  });
});
