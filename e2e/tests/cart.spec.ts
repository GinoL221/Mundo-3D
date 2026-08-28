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
    const addToCartPut = page.waitForResponse(
      (res) => res.url().includes('/api/cart') && res.request().method() === 'PUT'
    );
    await page.click('#add-to-cart-btn');
    await expect(async () => {
      const cart = await page.evaluate(() => localStorage.getItem('cart'));
      expect(cart).toContain('"productId":1');
    }).toPass();
    // Cart-page hydration now reads server state (cart-authority), so the
    // add must actually land server-side before navigating away — Astro has
    // no ClientRouter, so navigation is a full page load that resets
    // cartSync.ts's module state, and the pagehide-triggered flush racing
    // the cart page's GET is a real, accepted, client-unsolvable race
    // (design.md) if this PUT hasn't landed yet.
    await addToCartPut;

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

test.describe('Cart E2E Tests - Guest-to-Account Merge on Login', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('Guest cart merges with an existing account cart item on login', async ({ page }) => {
    const email = `merge_${Date.now()}@example.com`;
    const password = 'Password123!';

    // Register a fresh account (auto-logs in) so this test doesn't depend
    // on any other test's account state.
    await page.goto('/register');
    await page.fill('#firstName', 'Merge');
    await page.fill('#lastName', 'Test');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#confirmPassword', password);
    await page.setInputFiles('#image', {
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content'),
    });
    await page.click('#register-btn');
    await expect(page).toHaveURL('/');

    // While still logged in, add product 2 — a real, server-synced item —
    // to the account's cart. This is the merge target already living on the
    // server before the guest ever logs in.
    await page.goto('/product?id=2');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    const accountCartPut = page.waitForResponse(
      (res) => res.url().includes('/api/cart') && res.request().method() === 'PUT'
    );
    await page.click('#add-to-cart-btn');
    await accountCartPut;

    // Log out and clear the local cart, so product 2 now lives only
    // server-side, tied to the account.
    await page.locator('.nav-item__trigger').hover();
    await page.locator('#navbar-logout').click();
    await expect(page).toHaveURL('/login');
    await page.evaluate(() => localStorage.removeItem('cart'));

    // Add a DIFFERENT product to the cart as a guest (no session).
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    await page.click('#add-to-cart-btn');
    await expect(async () => {
      const cart = await page.evaluate(() => localStorage.getItem('cart'));
      expect(cart).toContain('"productId":1');
    }).toPass();

    // Log back in with the same account. This is the guest-to-account merge
    // trigger (cart-hydration spec: "Guest-to-Account Cart Merge on Login").
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');

    // The union of the guest's local item (product 1) and the account's
    // pre-existing server item (product 2) must both render on the cart
    // page — the core regression this change fixes. Without the merge, the
    // guest-to-server GET would silently drop one side of the union.
    await page.goto('/cart');
    await expect(page.locator('.cart__item')).toHaveCount(2);
  });
});

test.describe('Cart E2E Tests - Login Redirect Bounded Race', () => {
  test('redirect still fires when GET /api/cart never resolves (design.md: HYDRATION_REDIRECT_TIMEOUT_MS = 1500)', async ({ page }) => {
    const email = `stall_${Date.now()}@example.com`;
    const password = 'Password123!';

    // Register (auto-logs in), then log out so the next login goes through
    // LoginForm.astro's real submit handler.
    await page.goto('/register');
    await page.fill('#firstName', 'Stall');
    await page.fill('#lastName', 'Test');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#confirmPassword', password);
    await page.setInputFiles('#image', {
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake image content'),
    });
    await page.click('#register-btn');
    await expect(page).toHaveURL('/');
    await page.locator('.nav-item__trigger').hover();
    await page.locator('#navbar-logout').click();
    await expect(page).toHaveURL('/login');

    // A GET /api/cart that never resolves is the worst case the bounded
    // race exists for. Only GET is intercepted — the login POST itself, and
    // any incidental PUT, are unaffected.
    await page.route('**/api/cart', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise(() => {}); // never resolves
      } else {
        await route.continue();
      }
    });

    const start = Date.now();
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/', { timeout: 4000 });
    const elapsedMs = Date.now() - start;

    // Bounded between the 1500ms cap and a generous ceiling for CI jitter —
    // proves the redirect actually waited for hydration (not near-zero) AND
    // that the wait was capped (nowhere near "forever", the failure mode a
    // stalled GET would otherwise cause).
    expect(elapsedMs).toBeGreaterThanOrEqual(1400);
    expect(elapsedMs).toBeLessThan(3500);
  });
});
