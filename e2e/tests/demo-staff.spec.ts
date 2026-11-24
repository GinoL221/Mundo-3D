import { expect, test, type Route } from '@playwright/test';

const BUYER_CSRF = 'demo-csrf-buyer-001';
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
  user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'buyer@demo.invalid' },
  lease: { idleExpiresAt: '2026-11-24T01:30:00.000Z' },
};

const STAFF_SESSION = {
  active: true,
  role: 'STAFF',
  user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 'staff@demo.invalid' },
  lease: { idleExpiresAt: '2026-11-24T01:30:00.000Z' },
};

test('switches Buyer <-> STAFF in demo sandbox, manages inbox & catalog without uploads, and enforces 403 on delete/ADMIN', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = baseURL ?? 'http://localhost:4321';
  let activeRole: 'USER' | 'STAFF' | null = null;
  let activeCsrf = BUYER_CSRF;
  let nextProductId = 2;

  const products = [
    {
      idProduct: 1,
      nameProduct: 'Soporte Groot',
      price: 18500,
      descriptionProduct: 'Maceta impresa en PLA',
      image: 'soporte_maceta_groot.jpg',
      idCategory: 1,
      idFranchise: 1,
      category: 'Figura',
      material: 'PLA',
      height: 15,
      width: 10,
      depth: 10,
      finish: 'Mate',
      productionTime: 3,
      stock: 5,
    },
  ];
  const commissions: Array<{
    idCustomCommissionRequest: number;
    name: string;
    email: string;
    idea: string;
    idProduct: number | null;
    createdAt: string;
    expiresAt: string;
  }> = [];
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
      return json(route, 200, activeRole === 'STAFF' ? STAFF_SESSION : BUYER_SESSION);
    }
    if (pathname === '/api/demo/session/role' && method === 'POST') {
      if (csrfHdr !== activeCsrf) return json(route, 403, { error: 'Invalid demo CSRF' });
      const body = req.postDataJSON() as { role?: string };
      if (body.role === 'ADMIN') return json(route, 403, { error: 'ADMIN forbidden' });
      if (body.role !== 'USER' && body.role !== 'STAFF') {
        return json(route, 400, { error: 'Invalid role' });
      }
      csrfEvents.push(`ROLE_${body.role}:${csrfHdr}`);
      activeRole = body.role;
      activeCsrf = activeRole === 'STAFF' ? STAFF_CSRF : BUYER_CSRF;
      await context.addCookies([{ name: 'm3d_demo_csrf', value: activeCsrf, url: origin }]);
      return json(route, 200, activeRole === 'STAFF' ? STAFF_SESSION : BUYER_SESSION);
    }
    if (pathname === '/api/demo/session' && method === 'DELETE') {
      if (csrfHdr !== activeCsrf) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfEvents.push(`DELETE_SESSION:${csrfHdr}`);
      activeRole = null;
      return route.fulfill({ status: 204, body: '' });
    }
    if (pathname === '/api/demo/categories' && method === 'GET') {
      return json(route, 200, [{ idCategory: 1, nameCategory: 'Figura' }]);
    }
    if (pathname === '/api/demo/franchises' && method === 'GET') {
      return json(route, 200, [{ idFranchise: 1, nameFranchise: 'Marvel' }]);
    }
    if (pathname === '/api/demo/products/latest' && method === 'GET') {
      return json(route, 200, products[products.length - 1]);
    }
    if (pathname === '/api/demo/products' && method === 'GET') {
      return json(route, 200, { products });
    }
    if (pathname === '/api/demo/products' && method === 'POST') {
      if (activeRole !== 'STAFF' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      csrfEvents.push(`CREATE_PRODUCT:${csrfHdr}`);
      const created = {
        idProduct: nextProductId++,
        nameProduct: 'Busto Demo PLA',
        price: 12400,
        descriptionProduct: 'Pieza demo sin upload externo',
        image: null as unknown as string,
        idCategory: 1,
        idFranchise: 1,
        category: 'Figura',
        material: 'PLA',
        height: null as unknown as number,
        width: null as unknown as number,
        depth: null as unknown as number,
        finish: null as unknown as string,
        productionTime: null as unknown as number,
        stock: 4,
      };
      products.push(created);
      return json(route, 201, created);
    }
    const singleMatch = pathname.match(/^\/api\/demo\/products?\/(\d+)$/);
    if (singleMatch && method === 'GET') {
      const found = products.find((p) => p.idProduct === Number(singleMatch[1]));
      return found ? json(route, 200, found) : json(route, 404, { error: 'Not found' });
    }
    if (singleMatch && method === 'PUT') {
      if (activeRole !== 'STAFF' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      csrfEvents.push(`UPDATE_PRODUCT:${csrfHdr}`);
      const found = products.find((p) => p.idProduct === Number(singleMatch[1]));
      if (!found) return json(route, 404, { error: 'Not found' });
      found.nameProduct = 'Busto Editado';
      found.price = 15900;
      return json(route, 200, found);
    }
    if (singleMatch && method === 'DELETE') {
      return json(route, 403, { error: 'ADMIN operations are forbidden in demo sandbox' });
    }
    const stockMatch = pathname.match(/^\/api\/demo\/products\/(\d+)\/stock$/);
    if (stockMatch && method === 'PATCH') {
      if (activeRole !== 'STAFF' || csrfHdr !== activeCsrf) {
        return json(route, 403, { error: 'Forbidden' });
      }
      csrfEvents.push(`ADJUST_STOCK:${csrfHdr}`);
      const found = products.find((p) => p.idProduct === Number(stockMatch[1]));
      if (!found) return json(route, 404, { error: 'Not found' });
      const { delta } = req.postDataJSON() as { delta: number };
      found.stock += delta;
      return json(route, 200, found);
    }
    if (pathname === '/api/demo/custom-commission-requests' && method === 'POST') {
      if (csrfHdr !== activeCsrf) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfEvents.push(`CREATE_COMM:${csrfHdr}`);
      const body = req.postDataJSON() as { name: string; email: string; idea: string };
      const created = {
        idCustomCommissionRequest: 701,
        name: body.name,
        email: body.email,
        idea: body.idea,
        idProduct: null,
        createdAt: '2026-11-24T01:05:00.000Z',
        expiresAt: '2026-12-24T01:05:00.000Z',
      };
      commissions.push(created);
      return json(route, 201, created);
    }
    if (pathname === '/api/demo/custom-commission-requests' && method === 'GET') {
      if (activeRole !== 'STAFF') return json(route, 403, { error: 'Forbidden' });
      return json(route, 200, commissions);
    }
    if (pathname === '/api/demo/users') {
      return json(route, 403, { error: 'ADMIN operations are forbidden in demo sandbox' });
    }
    if (pathname === '/api/demo/cart') {
      return json(route, 200, { items: [], total: 0 });
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

  await expect(page.locator('#demo-bar-role-controls')).toBeVisible();
  await expect(page.locator('#demo-bar-role-controls button')).toHaveCount(2);
  await expect(page.locator('#demo-bar-role-controls')).not.toContainText('ADMIN');

  await page.goto('/help');
  await page.locator('#commission-name').fill('Lucia Maker');
  await page.locator('#commission-email').fill('lucia@sandbox.invalid');
  await page.locator('#commission-idea').fill('Llavero personalizado en PLA');
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/custom-commission-requests') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Enviar idea' }).click(),
  ]);
  await expect(page.locator('#commission-feedback')).toContainText('tu solicitud quedó guardada');

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/session/role') && r.request().method() === 'POST',
    ),
    page.locator('#demo-role-staff').click(),
  ]);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#demo-bar-role-badge')).toHaveText('STAFF');
  await expect(page.locator('#demo-role-staff')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#navbar-greeting')).toHaveText('Demo STAFF');

  await page.goto('/admin/commission-requests');
  await expect(page.locator('#admin-requests-list')).toContainText('Lucia Maker');
  await expect(page.locator('#admin-requests-list')).toContainText('Llavero personalizado en PLA');

  await page.goto('/admin/products');
  await expect(page.locator('#admin-products-list')).toContainText('Soporte Groot');
  await expect(page.locator('.admin-product-delete')).toHaveCount(0);

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/products/1/stock') && r.request().method() === 'PATCH',
    ),
    page.locator('.admin-product-stock-plus').first().click(),
  ]);
  await expect(page.locator('.admin-product-stock').first()).toHaveText('6');

  await page.goto('/admin/products/create');
  await expect(page.locator('#image-demo-note')).toBeVisible();
  await expect(page.locator('#image')).not.toHaveAttribute('required', '');
  await page.locator('#nameProduct').fill('Busto Demo PLA');
  await page.locator('#price').fill('12400');
  await page.locator('#descriptionProduct').fill('Pieza demo sin upload externo');
  await page.locator('#idCategory').selectOption('1');
  await page.locator('#idFranchise').selectOption('1');
  await page.locator('#stock').fill('4');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/products') && r.request().method() === 'POST'),
    page.locator('#create-btn').click(),
  ]);
  await expect(page).toHaveURL(/\/admin\/products\/?$/);
  await expect(page.locator('#admin-products-list')).toContainText('Busto Demo PLA');
  await expect(page.locator('.admin-product-delete')).toHaveCount(0);

  await page.goto('/admin/products/edit?id=2');
  await expect(page.locator('#image-demo-note')).toBeVisible();
  await page.locator('#nameProduct').fill('Busto Editado');
  await page.locator('#price').fill('15900');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/products/2') && r.request().method() === 'PUT'),
    page.locator('#edit-btn').click(),
  ]);
  await expect(page).toHaveURL(/\/admin\/products\/?$/);
  await expect(page.locator('#admin-products-list')).toContainText('Busto Editado');

  const boundaryStatuses = await page.evaluate(async (csrf) => {
    const delRes = await fetch('/api/demo/products/1', {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': csrf },
    });
    const usersRes = await fetch('/api/demo/users');
    return [delRes.status, usersRes.status];
  }, STAFF_CSRF);
  expect(boundaryStatuses).toEqual([403, 403]);

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/demo/session/role') && r.request().method() === 'POST',
    ),
    page.locator('#demo-role-buyer').click(),
  ]);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#demo-bar-role-badge')).toHaveText('BUYER');

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/session') && r.request().method() === 'DELETE'),
    page.locator('#demo-bar-exit').click(),
  ]);
  await expect(page.locator('#demo-session-bar')).toBeHidden();

  expect(csrfEvents).toEqual([
    `CREATE_COMM:${BUYER_CSRF}`,
    `ROLE_STAFF:${BUYER_CSRF}`,
    `ADJUST_STOCK:${STAFF_CSRF}`,
    `CREATE_PRODUCT:${STAFF_CSRF}`,
    `UPDATE_PRODUCT:${STAFF_CSRF}`,
    `ROLE_USER:${STAFF_CSRF}`,
    `DELETE_SESSION:${BUYER_CSRF}`,
  ]);
});
