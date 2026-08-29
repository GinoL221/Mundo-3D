import { test, expect } from '@playwright/test';

test.describe('Product Listing - Error & Empty States', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('Renders error state when the products API fails', async ({ page }) => {
    // /products now drives ProductSearch.astro, which fetches
    // GET /api/products/search (product-catalog-search), not the old
    // unpaginated GET /api/products the admin pages still use.
    await page.route('**/api/products/search*', async route => {
      await route.fulfill({ status: 500 });
    });

    await page.goto('/products');

    const emptyState = page.locator('#product-grid-container .empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator('h2')).toHaveText('No se pudo cargar');
  });

  test('Renders empty state when the products API returns zero products', async ({ page }) => {
    await page.route('**/api/products/search*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ products: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }),
      });
    });

    await page.goto('/products');

    const emptyState = page.locator('#product-grid-container .empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator('h2')).toHaveText('Próximamente');
  });
});

test.describe('Product Detail - Error State', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('Renders error state for a nonexistent product id (real 404)', async ({ page }) => {
    // id=999999 is never allocated: test-prepare.js runs sync({ force: true })
    // and reseeds only a handful of products each run, resetting auto-increment.
    await page.goto('/product?id=999999');

    await expect(page.locator('#product-error')).toBeVisible();
    // The normal product view (name, price, specs, etc.) never renders.
    await expect(page.locator('#product-content')).toBeHidden();
  });

  test('Renders error state when the product API request fails', async ({ page }) => {
    await page.route('**/api/product/1', async route => {
      await route.fulfill({ status: 500 });
    });

    await page.goto('/product?id=1');

    await expect(page.locator('#product-error')).toBeVisible();
    await expect(page.locator('#product-content')).toBeHidden();
  });
});
