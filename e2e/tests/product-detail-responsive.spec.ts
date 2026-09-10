import { test, expect } from '@playwright/test';

const product = {
  idProduct: 1,
  nameProduct: 'Figura de prueba',
  price: 12500,
  descriptionProduct: 'Una figura lista para compartir.',
  image: null,
  category: 'Figura',
  material: 'PLA',
  height: 15,
  width: 10,
  depth: 10,
  finish: 'Mate',
  productionTime: 3,
};

test('keeps share in the responsive top utility row and cart actions focused', async ({ page }) => {
  await page.route('**/api/product/1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(product),
    });
  });

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
