import { test, expect } from '@playwright/test';

const product = {
  idProduct: 1,
  nameProduct: 'Figura de prueba',
  price: 12500,
  descriptionProduct: 'Una figura lista para compartir.',
  image: null as string | null,
  category: 'Figura',
  material: 'PLA',
  height: 15,
  width: 10,
  depth: 10,
  finish: 'Mate',
  productionTime: 3,
};

async function mockProduct(
  page: import('@playwright/test').Page,
  overrides: Partial<typeof product> = {},
) {
  await page.route('**/api/product/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...product, ...overrides }),
    });
  });
}

test('keeps share in the responsive top utility row and cart actions focused', async ({ page }) => {
  await mockProduct(page);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/product?id=1');
    await expect(page.locator('#product-content')).toBeVisible();

    const utilityRow = page.locator('.product-detail__utility-row');
    const back = utilityRow.locator('.product-detail__back-link');
    const share = utilityRow.locator('#share-product-btn');
    await expect(utilityRow).toBeVisible();
    await expect(utilityRow.locator(':scope > *')).toHaveCount(2);
    await expect(back).toHaveText(/Volver a productos/);
    await expect(share).toContainText('Compartir');

    const layout = await utilityRow.evaluate((row) => {
      const back = row.querySelector('.product-detail__back-link') as HTMLElement;
      const share = row.querySelector('#share-product-btn') as HTMLElement;
      const rowRect = row.getBoundingClientRect();
      const backRect = back.getBoundingClientRect();
      const shareRect = share.getBoundingClientRect();
      const style = getComputedStyle(share);
      return {
        domOrder: Boolean(back.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING),
        sameRow: Math.abs(backRect.top - shareRect.top) < 2,
        shareRightAligned: Math.abs(rowRect.right - shareRect.right) < 2,
        shareHeight: shareRect.height,
        shareWidth: shareRect.width,
        rowWidth: rowRect.width,
        paddingLeft: Number.parseFloat(style.paddingLeft),
        paddingRight: Number.parseFloat(style.paddingRight),
        textContained: share.scrollWidth <= share.clientWidth,
        noPageOverflow:
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      };
    });

    expect(layout.domOrder).toBe(true);
    expect(layout.sameRow).toBe(true);
    expect(layout.shareRightAligned).toBe(true);
    expect(layout.shareHeight).toBeGreaterThanOrEqual(44);
    expect(layout.shareWidth).toBeLessThan(Math.min(220, layout.rowWidth * 0.5));
    expect(layout.paddingLeft).toBeGreaterThanOrEqual(16);
    expect(layout.paddingRight).toBeGreaterThanOrEqual(16);
    expect(layout.textContained).toBe(true);
    expect(layout.noPageOverflow).toBe(true);

    const actions = page.locator('.product-detail__actions');
    await expect(actions.locator(':scope > *')).toHaveCount(2);
    await expect(actions.locator(':scope > #add-to-cart-btn')).toHaveCount(1);
    await expect(actions.locator(':scope > a[href="/cart"]')).toHaveCount(1);
    await expect(actions.locator('#share-product-btn')).toHaveCount(0);
  }
});

test('replaces optimistic success when an authenticated cart sync is rejected', async ({
  page,
}) => {
  await mockProduct(page);
  await page.route('**/api/cart', async (route) => {
    await route.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/');
  await page.evaluate(() => {
    document.cookie = `m3d_user=${encodeURIComponent(JSON.stringify({ idRole: 2 }))}; path=/`;
    localStorage.removeItem('cart');
  });

  await page.goto('/product?id=1');
  const button = page.locator('#add-to-cart-btn');
  const status = page.locator('#cart-status');
  await expect(page.locator('#product-content')).toBeVisible();
  await button.click();
  await expect(status).toHaveText('Figura de prueba se agregó al carrito.');
  await expect(button).toBeDisabled();

  await expect(status).toHaveAttribute('role', 'alert');
  await expect(status).toHaveText('No se pudo sincronizar el carrito con el servidor.');
  await expect(button).toBeEnabled();
  await expect(button).toHaveText('Agregar al carrito');
  await page.waitForTimeout(2100);
  await expect(status).toHaveText('No se pudo sincronizar el carrito con el servidor.');
});

test('stores the rendered fallback image for placeholder and failed product images', async ({
  page,
}) => {
  await mockProduct(page);
  await page.goto('/product?id=1');
  await page.locator('#add-to-cart-btn').click();
  let image = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') ?? '[]')[0]?.image);
  expect(image).toBe('/images/illustrations/Figura.svg');

  await page.unroute('**/api/product/1');
  await mockProduct(page, { image: 'broken.png' });
  await page.route('**/img/products/broken.png', async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.evaluate(() => localStorage.removeItem('cart'));
  await page.goto('/product?id=1');
  const detailImage = page.locator('#product-img');
  await expect(detailImage).toHaveAttribute('src', '/images/illustrations/Otras.svg');
  await expect(detailImage).toHaveAttribute('alt', 'Ilustración genérica para Figura de prueba');
  await page.locator('#add-to-cart-btn').click();

  image = await page.evaluate(() => JSON.parse(localStorage.getItem('cart') ?? '[]')[0]?.image);
  expect(image).toBe('/images/illustrations/Otras.svg');
});
