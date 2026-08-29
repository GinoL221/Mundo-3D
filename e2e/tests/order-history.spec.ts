import { test, expect } from '@playwright/test';

// Real click-through for order-history (sdd-verify flagged this as the one
// gap in that change: task 8.5 was checked done but the manual/E2E smoke
// never actually ran). This places a real order via the real checkout flow,
// then verifies /orders actually renders it and links through to the
// existing order-detail page — not a mock, not an assertion against a
// mocked use case.
test.describe('Order History E2E', () => {
  test.use({ storageState: '.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cart'));
  });

  test('the nav exposes a "Mis pedidos" link to /orders for an authenticated user', async ({ page }) => {
    // toHaveCount(1) alone would only prove the <li> exists in the SSR
    // markup — it ships to anonymous visitors too, inside `.user-only`,
    // hidden by sessionUI.ts until a session cookie reveals it, and inside
    // the dropdown which only opens on hover (same pattern header.spec.ts
    // already proves for the sibling /profile link). Hover first, then
    // assert visibility, not just presence, so this genuinely discriminates
    // on auth rather than passing for an anonymous visitor too.
    const userMenu = page.locator('.user-only');
    await userMenu.locator('.nav-item__trigger').hover();
    const link = userMenu.locator('a[href="/orders"]', { hasText: 'Mis pedidos' });
    await expect(link).toBeVisible();
  });

  test('placing a real order makes it appear in /orders, linking through to its real detail page', async ({
    page,
  }) => {
    // Place a real order via the real checkout flow (mirrors
    // cart.spec.ts's "Checkout Navigation Authenticated Success").
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    const addToCartPut = page.waitForResponse(
      (res) => res.url().includes('/api/cart') && res.request().method() === 'PUT'
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

    // Now the actual gap sdd-verify found: does /orders really render this
    // order, with real data from a real GET /api/orders/mine response?
    await page.goto('/orders');
    await expect(page.locator('#my-orders-content')).toBeVisible();
    await expect(page.locator('#my-orders-empty')).toBeHidden();

    const firstRow = page.locator('#my-orders-body tr').first();
    await expect(firstRow.locator('.order-row-id')).toContainText(placedOrderId!);
    await expect(firstRow.locator('.order-row-status')).not.toBeEmpty();
    await expect(firstRow.locator('.order-row-total')).not.toBeEmpty();

    // Click through to the real detail page and confirm it's the same order.
    await firstRow.locator('.order-row-link').click();
    await expect(page).toHaveURL(`/order?id=${placedOrderId}`);
    // #order-error stays present-but-hidden in the DOM even on success
    // (OrderDetail.astro's convention), so assert visibility, not text
    // absence in the whole body.
    await expect(page.locator('#order-error')).toBeHidden();
    await expect(page.locator('#order-id')).toHaveText(placedOrderId!);
  });
});
