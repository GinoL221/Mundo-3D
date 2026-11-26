import { expect, test, type Route } from '@playwright/test';

const BUYER_CSRF = 'demo-csrf-buyer-001';
const ADMIN_CSRF = 'demo-csrf-admin-003';
const STAFF_CSRF = 'demo-csrf-staff-002';

function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  });
}

const BUYER_SESSION = {
  active: true,
  role: 'USER',
  user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'demo.buyer@sandbox.invalid' },
  lease: { idleExpiresAt: '2026-11-26T22:30:00.000Z' },
};

const STAFF_SESSION = {
  active: true,
  role: 'STAFF',
  user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 'demo.staff@sandbox.invalid' },
  lease: { idleExpiresAt: '2026-11-26T22:30:00.000Z' },
};

const ADMIN_SESSION = {
  active: true,
  role: 'ADMIN',
  user: { idUser: 3, firstName: 'Demo', lastName: 'Admin', email: 'demo.admin@sandbox.invalid' },
  lease: { idleExpiresAt: '2026-11-26T22:30:00.000Z' },
};

test('switches to ADMIN in demo sandbox, manages orders/taxonomy/users, and redirects off ADMIN-only routes on step-down', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:4321';
  let activeRole: 'USER' | 'STAFF' | 'ADMIN' | null = null;
  let activeCsrf = BUYER_CSRF;
  let nextCategoryId = 2;

  const categories = [{ idCategory: 1, nameCategory: 'Figura' }];
  const franchises = [{ idFranchise: 1, nameFranchise: 'Marvel' }];
  const orders = [
    {
      idOrder: 401,
      idUser: 1,
      status: 'pending_payment',
      total: 18500,
      createdAt: '2026-11-26T18:00:00.000Z',
      paymentReference: null,
      customer: { idUser: 1, displayName: 'Demo B.' },
      items: [
        {
          idProduct: 1,
          productName: 'Soporte Groot',
          unitPrice: 18500,
          quantity: 1,
          subtotal: 18500,
        },
      ],
    },
    {
      idOrder: 402,
      idUser: 1,
      status: 'pending_payment',
      total: 12000,
      createdAt: '2026-11-26T18:10:00.000Z',
      paymentReference: null,
      customer: { idUser: 1, displayName: 'Demo B.' },
      items: [
        {
          idProduct: 2,
          productName: 'Busto Batman',
          unitPrice: 12000,
          quantity: 1,
          subtotal: 12000,
        },
      ],
    },
  ];
  const slotUsers = [
    {
      idUser: 1,
      firstName: 'Demo',
      lastName: 'Buyer',
      email: 'demo.buyer+slot01@sandbox.mundo3d.invalid',
      idRole: 2,
    },
    {
      idUser: 2,
      firstName: 'Demo',
      lastName: 'Staff',
      email: 'demo.staff+slot01@sandbox.mundo3d.invalid',
      idRole: 3,
    },
    {
      idUser: 3,
      firstName: 'Demo',
      lastName: 'Admin',
      email: 'demo.admin+slot01@sandbox.mundo3d.invalid',
      idRole: 1,
    },
  ];

  const csrfEvents: string[] = [];

  await page.route('**/api/demo/**', async (route) => {
    const req = route.request();
    const method = req.method();
    const { pathname } = new URL(req.url());
    const csrfHdr = req.headers()['x-csrf-token'] ?? '';

    if (pathname === '/api/demo/status' && method === 'GET') {
      return json(route, 200, { enabled: true });
    }
    if (pathname === '/api/demo/session' && method === 'POST') {
      activeRole = 'USER';
      activeCsrf = BUYER_CSRF;
      await context.addCookies([{ name: 'm3d_demo_csrf', value: activeCsrf, url: origin }]);
      return json(route, 201, BUYER_SESSION);
    }
    if (pathname === '/api/demo/session' && method === 'GET') {
      if (!activeRole) return json(route, 401, { error: 'Expired' });
      const payload =
        activeRole === 'ADMIN'
          ? ADMIN_SESSION
          : activeRole === 'STAFF'
            ? STAFF_SESSION
            : BUYER_SESSION;
      return json(route, 200, payload);
    }
    if (pathname === '/api/demo/session/role' && method === 'POST') {
      if (csrfHdr !== activeCsrf) return json(route, 403, { error: 'Invalid demo CSRF' });
      const body = req.postDataJSON() as { role?: 'USER' | 'STAFF' | 'ADMIN' };
      if (body.role !== 'USER' && body.role !== 'STAFF' && body.role !== 'ADMIN') {
        return json(route, 400, { error: 'Invalid role' });
      }
      csrfEvents.push(`ROLE_${body.role}:${csrfHdr}`);
      activeRole = body.role;
      activeCsrf =
        activeRole === 'ADMIN' ? ADMIN_CSRF : activeRole === 'STAFF' ? STAFF_CSRF : BUYER_CSRF;
      await context.addCookies([{ name: 'm3d_demo_csrf', value: activeCsrf, url: origin }]);
      const payload =
        activeRole === 'ADMIN'
          ? ADMIN_SESSION
          : activeRole === 'STAFF'
            ? STAFF_SESSION
            : BUYER_SESSION;
      return json(route, 200, payload);
    }
    if (pathname === '/api/demo/session' && method === 'DELETE') {
      if (csrfHdr !== activeCsrf) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfEvents.push(`DELETE_SESSION:${csrfHdr}`);
      activeRole = null;
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/demo/products/latest' && method === 'GET') {
      return json(route, 200, {
        idProduct: 1,
        nameProduct: 'Soporte Groot',
        price: 18500,
        descriptionProduct: 'Maceta PLA',
        image: 'soporte_maceta_groot.jpg',
        stock: 5,
      });
    }
    if (pathname === '/api/demo/products' && method === 'GET') {
      return json(route, 200, { products: [] });
    }
    if (pathname === '/api/demo/cart') {
      if (activeRole !== 'USER') return json(route, 403, { error: 'Buyer only' });
      return json(route, 200, { items: [], total: 0 });
    }
    if (pathname === '/api/demo/orders' && method === 'GET') {
      if (activeRole !== 'ADMIN' && activeRole !== 'STAFF') {
        return json(route, 403, { error: 'Forbidden' });
      }
      return json(route, 200, orders);
    }
    const orderActionMatch = pathname.match(/^\/api\/demo\/orders\/(\d+)\/(confirm-payment|cancel)$/);
    if (orderActionMatch && method === 'POST') {
      if (activeRole !== 'ADMIN' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      const id = Number(orderActionMatch[1]);
      const action = orderActionMatch[2];
      const target = orders.find((o) => o.idOrder === id);
      if (!target) return json(route, 404, { error: 'Not found' });
      csrfEvents.push(`ORDER_${action.toUpperCase()}_${id}:${csrfHdr}`);
      target.status = action === 'confirm-payment' ? 'paid' : 'cancelled';
      return json(route, 200, target);
    }
    if (pathname === '/api/demo/categories' && method === 'GET') {
      return json(route, 200, categories);
    }
    if (pathname === '/api/demo/categories' && method === 'POST') {
      if (activeRole !== 'ADMIN' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      const body = req.postDataJSON() as { nameCategory: string };
      csrfEvents.push(`CREATE_CAT:${csrfHdr}`);
      const created = { idCategory: nextCategoryId++, nameCategory: body.nameCategory };
      categories.push(created);
      return json(route, 201, created);
    }
    const catMatch = pathname.match(/^\/api\/demo\/categories\/(\d+)$/);
    if (catMatch && method === 'PUT') {
      if (activeRole !== 'ADMIN' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      const id = Number(catMatch[1]);
      const body = req.postDataJSON() as { nameCategory: string };
      const target = categories.find((c) => c.idCategory === id);
      if (!target) return json(route, 404, { error: 'Not found' });
      csrfEvents.push(`UPDATE_CAT_${id}:${csrfHdr}`);
      target.nameCategory = body.nameCategory;
      return json(route, 200, target);
    }
    if (catMatch && method === 'DELETE') {
      if (activeRole !== 'ADMIN' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      const id = Number(catMatch[1]);
      if (id === 1) {
        return json(route, 409, {
          error: 'No se puede eliminar la categoría porque tiene piezas asociadas.',
        });
      }
      const idx = categories.findIndex((c) => c.idCategory === id);
      if (idx === -1) return json(route, 404, { error: 'Not found' });
      csrfEvents.push(`DELETE_CAT_${id}:${csrfHdr}`);
      categories.splice(idx, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/demo/franchises' && method === 'GET') {
      return json(route, 200, franchises);
    }
    if (pathname === '/api/demo/users' && method === 'GET') {
      if (activeRole !== 'ADMIN') return json(route, 403, { error: 'Forbidden' });
      return json(route, 200, { count: slotUsers.length, users: slotUsers });
    }

    return route.continue();
  });

  await page.goto('/');
  const entryBtn = page.locator('[data-demo-entry]').first();
  await expect(entryBtn).toBeVisible();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/session') && r.request().method() === 'POST'),
    entryBtn.click(),
  ]);
  await page.waitForLoadState('networkidle');

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/session/role') && r.request().method() === 'POST',
    ),
    page.locator('#demo-role-admin').click(),
  ]);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#demo-role-admin')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#demo-bar-role-badge')).toHaveText('ADMIN');
  await expect(page.locator('#navbar-cart-trigger')).toBeHidden();

  await page.locator('#navbar-workshop-trigger').click();
  await expect(page.locator('#navbar-workshop-menu a[href="/admin/taxonomy"]')).toBeVisible();
  await expect(page.locator('#navbar-workshop-menu a[href="/admin/users"]')).toBeVisible();

  await page.goto('/admin/orders');
  await expect(page.locator('#admin-orders-actions-col')).toBeVisible();
  await expect(page.locator('.admin-order-confirm-btn')).toHaveCount(2);

  await page.locator('.admin-order-confirm-btn').first().click();
  await expect(page.locator('#admin-order-action-dialog')).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/orders/401/confirm-payment') && r.request().method() === 'POST',
    ),
    page.locator('#admin-order-dialog-confirm').click(),
  ]);
  await expect(page.locator('#admin-orders-feedback-text')).toContainText('#401');

  await page.locator('.admin-order-cancel-btn').first().click();
  await expect(page.locator('#admin-order-action-dialog')).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/orders/402/cancel') && r.request().method() === 'POST',
    ),
    page.locator('#admin-order-dialog-confirm').click(),
  ]);
  await expect(page.locator('.admin-order-confirm-btn')).toHaveCount(0);

  await page.goto('/admin/taxonomy');
  await page.locator('#category-create-input').fill('Dioramas');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/categories') && r.request().method() === 'POST'),
    page.locator('#category-create-btn').click(),
  ]);
  await expect(page.locator('#categories-count')).toHaveText('2');

  const secondRow = page.locator('#categories-list .admin-taxonomy__row').nth(1);
  await secondRow.locator('input').fill('Dioramas LED');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/categories/2') && r.request().method() === 'PUT'),
    secondRow.getByRole('button', { name: 'Guardar' }).click(),
  ]);
  await expect(page.locator('#admin-taxonomy-feedback-text')).toContainText('Dioramas LED');

  await secondRow.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.locator('#admin-taxonomy-delete-dialog')).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/categories/2') && r.request().method() === 'DELETE',
    ),
    page.locator('#admin-taxonomy-delete-dialog button[value="confirm"]').click(),
  ]);
  await expect(page.locator('#categories-count')).toHaveText('1');

  const linkedRow = page.locator('#categories-list .admin-taxonomy__row').first();
  await linkedRow.getByRole('button', { name: 'Eliminar' }).click();
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/categories/1') && r.request().method() === 'DELETE',
    ),
    page.locator('#admin-taxonomy-delete-dialog button[value="confirm"]').click(),
  ]);
  await expect(page.locator('#admin-taxonomy-feedback-text')).toContainText('piezas asociadas');

  await page.goto('/admin/users');
  await expect(page.locator('#admin-users-demo-note')).toBeVisible();
  await expect(page.locator('#admin-users-list tr')).toHaveCount(3);
  await expect(page.locator('#admin-users-list')).toContainText('Demo Admin');

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/session/role') && r.request().method() === 'POST',
    ),
    page.locator('#demo-role-staff').click(),
  ]);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#demo-role-staff')).toHaveAttribute('aria-pressed', 'true');

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/session') && r.request().method() === 'DELETE'),
    page.locator('#demo-bar-exit').click(),
  ]);
  await expect(page.locator('#demo-session-bar')).toBeHidden();

  expect(csrfEvents).toEqual([
    `ROLE_ADMIN:${BUYER_CSRF}`,
    `ORDER_CONFIRM-PAYMENT_401:${ADMIN_CSRF}`,
    `ORDER_CANCEL_402:${ADMIN_CSRF}`,
    `CREATE_CAT:${ADMIN_CSRF}`,
    `UPDATE_CAT_2:${ADMIN_CSRF}`,
    `DELETE_CAT_2:${ADMIN_CSRF}`,
    `ROLE_STAFF:${ADMIN_CSRF}`,
    `DELETE_SESSION:${STAFF_CSRF}`,
  ]);
});
