import { test, expect } from '@playwright/test';

test.describe('Product 3D Specs Panel', () => {
  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  });

  test('Renders full specs for a seeded product with all 3D attributes defined', async ({ page }) => {
    // Product id 1 (Mario Bros Coleccionable) is seeded with Material: PLA, Height: 15, Width: 10, Depth: 10, Finish, ProductionTime: 3
    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();

    await expect(page.locator('#product-material')).toHaveText('PLA');
    await expect(page.locator('#product-dimensions')).toHaveText('H: 15 cm | W: 10 cm | D: 10 cm');
    await expect(page.locator('#product-finish')).not.toHaveText('-');
    await expect(page.locator('#product-production')).toHaveText('3 días');
  });

  test('Renders partial dimensions with per-dimension fallback (not "A consultar" for all)', async ({ page }) => {
    await page.route('**/api/product/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          idProduct: 1,
          nameProduct: 'Producto Parcial',
          price: 100,
          descriptionProduct: 'Solo alto definido',
          image: null,
          category: 'Otras',
          material: 'Resina',
          height: 20,
          width: null,
          depth: null,
          finish: 'Mate',
          productionTime: 5,
        }),
      });
    });

    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).toHaveText('Producto Parcial');

    await expect(page.locator('#product-material')).toHaveText('Resina');
    await expect(page.locator('#product-dimensions')).toHaveText('H: 20 cm | W: no definida | D: no definida');
    await expect(page.locator('#product-finish')).toHaveText('Mate');
    await expect(page.locator('#product-production')).toHaveText('5 días');
  });

  test('Renders "A consultar" for material, dimensions, finish and production when none are defined', async ({ page }) => {
    await page.route('**/api/product/1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          idProduct: 1,
          nameProduct: 'Producto Sin Specs',
          price: 100,
          descriptionProduct: 'Sin atributos 3D',
          image: null,
          category: 'Otras',
          material: null,
          height: null,
          width: null,
          depth: null,
          finish: null,
          productionTime: null,
        }),
      });
    });

    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).toHaveText('Producto Sin Specs');

    await expect(page.locator('#product-material')).toHaveText('A consultar');
    await expect(page.locator('#product-dimensions')).toHaveText('A consultar');
    await expect(page.locator('#product-finish')).toHaveText('A consultar');
    await expect(page.locator('#product-production')).toHaveText('A consultar');
  });
});
