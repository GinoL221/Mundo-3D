import { test, expect } from '@playwright/test';

// Real click-through for product-catalog-search (design.md "Testing
// Strategy" / tasks.md 5.1-5.2), mirroring order-history.spec.ts's
// precedent of a genuine click-through rather than a code-inspection
// smoke test. Uses the real seeded catalog (26 products, backend/src/
// database/data/products.json) for search/filter assertions. The storefront
// requests pageSize=18 (divisible by both 3 desktop and 2 mobile/tablet
// columns), rendering 18 cards on page 1 and 8 on page 2. The pagination
// test below keeps its targeted mock to exercise a deterministic 2-page
// filtered search flow with a real rendered `<a>` click.
test.describe('Product Search & Filter E2E', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('typing a search term and submitting filters the grid to matching products only', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('#product-grid-container .product-card')).toHaveCount(18);

    await page.fill('#product-search-input', 'Llavero');
    await page.click('#product-search-form button[type="submit"]');

    await expect(page).toHaveURL(/\/products\?search=Llavero/);
    await expect(page.locator('#product-grid-container .product-card')).toHaveCount(3);

    const names = await page.locator('.product-card-name').allTextContents();
    for (const name of names) {
      expect(name.toLowerCase()).toContain('llavero');
    }
  });

  test('picking a category narrows the grid to that category only', async ({ page }) => {
    await page.goto('/products');

    await page.selectOption('#product-search-category', { label: 'Llavero' });
    await page.click('#product-search-form button[type="submit"]');

    await expect(page).toHaveURL(/\/products\?idCategory=\d+/);
    await expect(page.locator('#product-grid-container .product-card')).toHaveCount(3);

    const names = await page.locator('.product-card-name').allTextContents();
    for (const name of names) {
      expect(name.toLowerCase()).toContain('llavero');
    }
  });

  test('a direct navigation with query params pre-applies the search/filter state without interaction', async ({
    page,
  }) => {
    await page.goto('/products?search=Llavero');

    await expect(page.locator('#product-search-input')).toHaveValue('Llavero');
    await expect(page.locator('#product-grid-container .product-card')).toHaveCount(3);
  });

  test('clicking "Siguiente" navigates to the next page, preserving the active search term in the URL', async ({
    page,
  }) => {
    // Only one seeded product matches "goku", so mock a 2-page filtered search
    // response to exercise a deterministic next-page `<a>` click with search
    // query preservation.
    await page.route('**/api/products/search*', async (route) => {
      const url = new URL(route.request().url());
      const requestedPage = Number(url.searchParams.get('page') || '1');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            {
              idProduct: requestedPage,
              nameProduct: `Producto Goku ${requestedPage}`,
              price: 100,
              descriptionProduct: null,
              image: null,
              category: 'Otras',
            },
          ],
          page: requestedPage,
          pageSize: 1,
          total: 2,
          totalPages: 2,
        }),
      });
    });

    await page.goto('/products?search=goku');
    await expect(page.locator('#product-search-next')).toBeVisible();

    await page.click('#product-search-next');

    await expect(page).toHaveURL(/\/products\?.*page=2/);
    const url = new URL(page.url());
    expect(url.searchParams.get('search')).toBe('goku');
    expect(url.searchParams.get('page')).toBe('2');
    await expect(page.locator('.product-card-name')).toHaveText('Producto Goku 2');
  });
});
