import { test, expect, type Page } from '@playwright/test';

const orderSummary = {
  idOrder: 42,
  idUser: 2,
  status: 'PENDING',
  totalAmount: 12500,
  createdAt: '2026-09-14T15:30:00.000Z',
  paymentReference: null,
};

const orderDetail = {
  ...orderSummary,
  items: [
    {
      idOrderItem: 1,
      idProduct: 7,
      productName: 'Figura de prueba con un nombre descriptivo',
      quantity: 2,
      unitPrice: 6250,
      subtotal: 12500,
    },
  ],
};

async function mockOrders(page: Page): Promise<void> {
  await page.route('**/api/orders/mine**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        orders: [orderSummary],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/orders/42', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(orderDetail) });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test.describe(`Orders visual adaptation — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await mockOrders(page);
    });

    test('renders the order list with visible context and a responsive result layout', async ({
      page,
    }) => {
      await page.goto('/orders');

      await expect(page.getByRole('heading', { level: 1, name: 'Mis órdenes' })).toBeVisible();
      await expect(page.locator('#my-orders-content')).toBeVisible();
      await expect(page.locator('.order-row-id')).toHaveText('42');
      await expect(page.locator('.order-row-link')).toHaveAttribute('href', '/order?id=42');
      await expect(page.locator('.order-row-link')).toHaveCSS('min-height', '44px');
      await expect(page.locator('.order-list__table tr').last()).toHaveCSS(
        'display',
        viewport.name === 'mobile' ? 'block' : 'table-row',
      );
      await expectNoHorizontalOverflow(page);
    });

    test('renders order detail with visible context and readable item totals', async ({ page }) => {
      await page.goto('/order?id=42');

      await expect(
        page.getByRole('heading', { level: 1, name: 'Detalle de la orden' }),
      ).toBeVisible();
      await expect(page.locator('#order-content')).toBeVisible();
      await expect(page.locator('#order-id')).toHaveText('42');
      await expect(page.locator('.order-item-name')).toContainText('Figura de prueba');
      await expect(page.locator('.order-detail__total')).toContainText('12500.00');
      await expect(page.locator('.order-detail__items tr').last()).toHaveCSS(
        'display',
        viewport.name === 'mobile' ? 'block' : 'table-row',
      );
      await expectNoHorizontalOverflow(page);
    });
  });
}
