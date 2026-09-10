import { expect, test, type Page } from '@playwright/test';
import { homeProducts, installHomeProductFixtures } from '../fixtures/homeProducts.js';

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

async function openHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
}

test.describe('Home product loading', () => {
  test('renders routed product success in existing content regions', async ({ page }) => {
    let catalogRequestCount = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/products') catalogRequestCount += 1;
    });
    await installHomeProductFixtures(page);
    await openHome(page);

    await expect(page.locator('#home-products-content')).toBeVisible();
    await expect(page.locator('.home-product-card')).toHaveCount(homeProducts.length);
    await expect(page.locator('.home-featured-card__name')).toHaveText(
      'Cubo de Compañía de Portal',
    );
    await expect.poll(() => catalogRequestCount).toBe(1);
  });

  test('renders existing empty states for an empty catalog', async ({ page }) => {
    await page.route('**/api/products/latest', (route) => route.fulfill({ status: 404 }));
    await page.route('**/api/products', (route) =>
      route.fulfill({ headers: jsonHeaders, body: JSON.stringify({ products: [] }) }),
    );
    await openHome(page);

    await expect(page.locator('#home-products-container').getByRole('status')).toHaveText(
      'Todavía no hay piezas en el catálogo',
    );
    await expect(page.locator('#home-featured-content').getByRole('status')).toContainText(
      'No hay una pieza destacada disponible.',
    );
  });

  test('renders existing error states for unsuccessful product requests', async ({ page }) => {
    await page.route('**/api/products/latest', (route) => route.fulfill({ status: 500 }));
    await page.route('**/api/products', (route) => route.fulfill({ status: 500 }));
    await openHome(page);

    await expect(page.locator('#home-products-container').getByRole('alert')).toContainText(
      'No se pudo cargar',
    );
    await expect(page.locator('#home-featured-content').getByRole('alert')).toContainText(
      'No se pudo cargar la pieza destacada.',
    );
  });
});
