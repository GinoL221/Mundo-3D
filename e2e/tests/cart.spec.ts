import { test, expect } from '@playwright/test';

test.describe('Cart E2E Tests - Guest Flow', () => {
  // Clear localStorage cart before each guest test
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cart'));
  });

  test('Add Product to Cart as Guest', async ({ page }) => {
    // Navigate to product 1 details page
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();

    // Click Add to Cart
    await page.click('#add-to-cart-btn');

    // Verify localStorage has the item
    const cart = await page.evaluate(() => {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    });
    expect(cart).toHaveLength(1);
    expect(cart[0].productId).toBe(1);
  });

  test('Header Badge Updates', async ({ page }) => {
    // Add product 1 to cart
    await page.goto('/product?id=1');
    await page.click('#add-to-cart-btn');
    
    const badge = page.locator('#navbar-cart-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    // Add product 2 to cart
    await page.goto('/product?id=2');
    await page.click('#add-to-cart-btn');
    await expect(badge).toHaveText('2');
  });

  test('Persisting Items inside Cart View', async ({ page }) => {
    // Add product 1
    await page.goto('/product?id=1');
    await page.click('#add-to-cart-btn');

    // Add product 2
    await page.goto('/product?id=2');
    await page.click('#add-to-cart-btn');

    // Go to cart page
    await page.goto('/cart');

    // Verify cart items container renders both products
    const items = page.locator('.cart__item');
    await expect(items).toHaveCount(2);

    const totalEl = page.locator('#cart-total');
    await expect(totalEl).toBeVisible();
    const totalText = await totalEl.textContent();
    expect(parseFloat(totalText || '0')).toBeGreaterThan(0);
  });

  test('Update Item Quantity in Cart', async ({ page }) => {
    // Add product 1 twice from the product page (the UI has no dedicated
    // quantity control — re-adding the same product is how quantity is
    // increased, per CartService.addToCart's increment-on-existing logic)
    await page.goto('/product?id=1');
    await page.click('#add-to-cart-btn');
    await page.click('#add-to-cart-btn');

    const badge = page.locator('#navbar-cart-badge');
    await expect(badge).toHaveText('1');

    const cart = await page.evaluate(() => {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    });
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);

    // Go to cart page and verify the rendered quantity and subtotal
    await page.goto('/cart');
    const items = page.locator('.cart__item');
    await expect(items).toHaveCount(1);

    const qtyEl = items.first().locator('.cart__item-qty');
    await expect(qtyEl).toHaveText('Cantidad: 2');

    const priceText = await items.first().locator('.cart__item-price').textContent();
    const unitPrice = parseFloat((priceText || '').replace(/[^0-9.]/g, ''));
    const subtotalText = await items.first().locator('.cart__item-subtotal').textContent();
    const subtotal = parseFloat((subtotalText || '').replace(/[^0-9.]/g, ''));
    expect(subtotal).toBeCloseTo(unitPrice * 2, 2);
  });

  test('Remove Item from Cart', async ({ page }) => {
    // Add product 1 and product 2
    await page.goto('/product?id=1');
    await page.click('#add-to-cart-btn');

    await page.goto('/product?id=2');
    await page.click('#add-to-cart-btn');

    await page.goto('/cart');
    await expect(page.locator('.cart__item')).toHaveCount(2);

    // Remove the first rendered item
    await page.locator('.cart__item').first().locator('.cart__item-remove').click();

    // One item remains, both in the DOM and in localStorage
    await expect(page.locator('.cart__item')).toHaveCount(1);

    const cart = await page.evaluate(() => {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    });
    expect(cart).toHaveLength(1);
    expect(cart[0].productId).toBe(2);

    const badge = page.locator('#navbar-cart-badge');
    await expect(badge).toHaveText('1');
  });

  test('Checkout Navigation Guest Redirect', async ({ page }) => {
    // Add product 1
    await page.goto('/product?id=1');
    await page.click('#add-to-cart-btn');

    // Go to cart page and proceed to checkout
    await page.goto('/cart');
    await page.click('.cart__btn-checkout');

    // Verify redirect to login
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Cart E2E Tests - Authenticated Flow', () => {
  // Use saved storage state for authenticated user
  test.use({ storageState: '.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cart'));
  });

  test('Checkout Navigation Authenticated Success', async ({ page }) => {
    // Add product 1. Wait for the product fetch to resolve (which is what
    // attaches the click listener to #add-to-cart-btn) before clicking —
    // the button exists in the static markup immediately, but clicking it
    // before hydration finishes is a no-op and silently leaves the cart
    // empty, which was causing this test to flake.
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    await page.click('#add-to-cart-btn');
    await expect(async () => {
      const cart = await page.evaluate(() => localStorage.getItem('cart'));
      expect(cart).toContain('"productId":1');
    }).toPass();

    // Go to cart page and click checkout
    await page.goto('/cart');
    await expect(page.locator('.cart__item')).toHaveCount(1);

    // Setup dialog handler for the checkout alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Compra finalizada con éxito');
      await dialog.accept();
    });

    await page.click('.cart__btn-checkout');

    // Verify redirect back to homepage after checkout
    await expect(page).toHaveURL('/');

    // Verify cart was cleared
    const cart = await page.evaluate(() => {
      const raw = localStorage.getItem('cart');
      return raw ? JSON.parse(raw) : [];
    });
    expect(cart).toHaveLength(0);
  });
});
