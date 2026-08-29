import { test, expect } from '@playwright/test';

// Real click-through for product-catalog-search (design.md "Testing
// Strategy" / tasks.md 5.1-5.2), mirroring order-history.spec.ts's
// precedent of a genuine click-through rather than a code-inspection
// smoke test. Uses the real seeded catalog (17 products, backend/src/
// database/data/products.json) for search/filter assertions. The seed has
// too few products to ever produce a second page against the fixed
// pageSize=20 default (design.md decision — no pageSize control exists in
// the UI), so the pagination test below mocks only the network response,
// while every click/type/URL assertion still exercises the real rendered
// component and its real client script.
test.describe('Product Search & Filter E2E', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('typing a search term and submitting filters the grid to matching products only', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('#product-grid-container .product-card')).toHaveCount(17);

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
    // The real seed only has 17 products against a fixed pageSize=20, so it
    // can never produce a second page. Mock the search response to force a
    // 2-page result while still driving a real rendered `<a>` click.
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
