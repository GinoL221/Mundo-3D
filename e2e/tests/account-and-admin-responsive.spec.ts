import { expect, test, type Page, type Route } from '@playwright/test';

const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
] as const;

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

async function setSessionCookie(page: Page, idRole: number): Promise<void> {
  const origin = new URL(page.url()).origin;
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'm3d_user',
      value: encodeURIComponent(
        JSON.stringify({
          idUser: idRole === 1 ? 3 : 1,
          firstName: 'Responsive',
          lastName: idRole === 1 ? 'Admin' : 'Comprador',
          idRole,
        }),
      ),
      url: origin,
    },
  ]);
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${label} overflowed horizontally (${metrics.scrollWidth} > ${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

test('buyer account and commission pages render without horizontal overflow on mobile and tablet', async ({
  page,
}) => {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();

    if (pathname === '/api/demo/status') return json(route, 404, { message: 'Not found' });
    if (pathname === '/api/cart') return json(route, 200, { items: [], total: 0 });
    if (pathname === '/api/products' && method === 'GET') {
      return json(route, 200, {
        products: [
          {
            idProduct: 1,
            nameProduct: 'Soporte Maceta Groot Edicion Coleccionable',
            price: 18500,
            descriptionProduct: 'Maceta impresa en PLA',
            image: 'soporte_maceta_groot.jpg',
            stock: 5,
          },
        ],
      });
    }
    if (pathname === '/api/users/me' && method === 'GET') {
      return json(route, 200, {
        idUser: 1,
        firstName: 'Lucia',
        lastName: 'Compradora',
        email: 'lucia.compradora.larga@ejemplo-mundo3d.test',
        image: '',
        idRole: 2,
      });
    }
    if (pathname === '/api/custom-commission-requests/mine' && method === 'GET') {
      return json(route, 200, [
        {
          idCustomCommissionRequest: 12,
          name: 'Lucia Compradora',
          email: 'lucia.compradora.larga@ejemplo-mundo3d.test',
          phone: '+54 9 11 0000-0101',
          idea: 'Quiero una variante de 22 cm con acabado mate y base reforzada para escritorio.',
          idProduct: 1,
          createdAt: '2026-11-27T12:00:00.000Z',
          expiresAt: '2026-12-27T12:00:00.000Z',
        },
      ]);
    }
    return route.continue();
  });

  await page.goto('/');
  await setSessionCookie(page, 2);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto('/profile');
    await expect(page.locator('#profile-content')).toBeVisible();
    await expect(page.locator('#profile-role-badge')).toHaveText('Comprador');
    await assertNoHorizontalOverflow(page, `/profile (${vp.name})`);

    await page.goto('/my-commissions');
    await expect(page.locator('#my-commissions-list')).toBeVisible();
    await expect(page.locator('#my-commissions-list')).toContainText('Tel: +54 9 11 0000-0101');
    await assertNoHorizontalOverflow(page, `/my-commissions (${vp.name})`);

    await page.goto('/help');
    await expect(page.locator('#commission-form')).toBeVisible();
    await expect(page.locator('#commission-phone')).toBeVisible();
    await assertNoHorizontalOverflow(page, `/help (${vp.name})`);
  }
});

test('admin workshop pages render without horizontal overflow on mobile and tablet', async ({
  page,
}) => {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();

    if (pathname === '/api/demo/status') return json(route, 404, { message: 'Not found' });
    if (pathname === '/api/products' && method === 'GET') {
      return json(route, 200, {
        products: [
          {
            idProduct: 1,
            nameProduct: 'Soporte Groot',
            price: 18500,
            descriptionProduct: 'Maceta PLA',
            image: 'soporte_maceta_groot.jpg',
            stock: 5,
          },
        ],
      });
    }
    if (pathname === '/api/orders' && method === 'GET') {
      return json(route, 200, [
        {
          idOrder: 401,
          idUser: 1,
          status: 'AWAITING_PAYMENT',
          totalAmount: 18500,
          createdAt: '2026-11-26T18:00:00.000Z',
          paymentReference: null,
          customer: { idUser: 1, displayName: 'Lucia C.' },
          items: [
            {
              idOrderItem: 1,
              idProduct: 1,
              productName: 'Soporte Groot',
              unitPrice: 18500,
              quantity: 1,
              subtotal: 18500,
            },
          ],
        },
      ]);
    }
    if (pathname === '/api/custom-commission-requests' && method === 'GET') {
      return json(route, 200, [
        {
          idCustomCommissionRequest: 21,
          name: 'Lucia Compradora',
          email: 'lucia.compradora.larga@ejemplo-mundo3d.test',
          phone: '+54 9 11 0000-0101',
          idea: 'Quiero dos unidades pintadas a mano en escala de 18 cm.',
          idProduct: 1,
          createdAt: '2026-11-27T12:00:00.000Z',
          expiresAt: '2026-12-27T12:00:00.000Z',
        },
      ]);
    }
    if (pathname === '/api/categories' && method === 'GET') {
      return json(route, 200, [{ idCategory: 1, nameCategory: 'Figuras Coleccionables' }]);
    }
    if (pathname === '/api/franchises' && method === 'GET') {
      return json(route, 200, [{ idFranchise: 1, nameFranchise: 'Marvel Studios' }]);
    }
    if (pathname === '/api/users' && method === 'GET') {
      return json(route, 200, {
        count: 3,
        users: [
          {
            idUser: 1,
            firstName: 'Demo',
            lastName: 'Buyer',
            email: 'demo.buyer+slot01@sandbox.mundo3d.invalid',
            image: null,
            idRole: 2,
          },
          {
            idUser: 2,
            firstName: 'Demo',
            lastName: 'Staff',
            email: 'demo.staff+slot01@sandbox.mundo3d.invalid',
            image: null,
            idRole: 3,
          },
          {
            idUser: 3,
            firstName: 'Demo',
            lastName: 'Admin',
            email: 'demo.admin+slot01@sandbox.mundo3d.invalid',
            image: null,
            idRole: 1,
          },
        ],
      });
    }
    return route.continue();
  });

  await page.goto('/');
  await setSessionCookie(page, 1);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto('/admin/orders');
    await expect(page.locator('#admin-orders-table-wrap')).toBeVisible();
    await assertNoHorizontalOverflow(page, `/admin/orders (${vp.name})`);

    await page.goto('/admin/commission-requests');
    await expect(page.locator('#admin-requests-list')).toBeVisible();
    await assertNoHorizontalOverflow(page, `/admin/commission-requests (${vp.name})`);

    await page.goto('/admin/taxonomy');
    await expect(page.locator('#admin-taxonomy-panels')).toBeVisible();
    await assertNoHorizontalOverflow(page, `/admin/taxonomy (${vp.name})`);

    await page.goto('/admin/users');
    await expect(page.locator('#admin-users-table-wrap')).toBeVisible();
    await assertNoHorizontalOverflow(page, `/admin/users (${vp.name})`);
  }
});
