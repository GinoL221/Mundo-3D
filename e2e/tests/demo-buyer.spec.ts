import { expect, test, type Page, type Route } from '@playwright/test';
import { homeProducts } from '../fixtures/homeProducts.js';

const DEMO_CSRF = 'demo-e2e-csrf.sig';
const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

const BUYER_SESSION = {
  active: true,
  role: 'USER',
  user: {
    idUser: 1,
    firstName: 'Demo',
    lastName: 'Buyer',
    email: 'demo.buyer+slot1@sandbox.mundo3d.invalid',
  },
  lease: {
    idleExpiresAt: '2026-11-24T05:00:00.000Z',
    absoluteExpiresAt: '2026-11-24T05:30:00.000Z',
  },
};

function json(route: Route, status: number, body: unknown, extra: Record<string, string> = {}) {
  return route.fulfill({
    status,
    headers: { ...JSON_HEADERS, ...extra },
    body: JSON.stringify(body),
  });
}

async function setDemoCookie(page: Page): Promise<void> {
  const origin = new URL(page.url()).origin;
  await page.context().addCookies([{ name: 'm3d_demo_csrf', value: DEMO_CSRF, url: origin }]);
}

test('hides demo entries silently when DEMO_SANDBOX_ENABLED=false (404)', async ({ page }) => {
  await page.route('**/api/demo/status', (route) => json(route, 404, { message: 'Not found' }));
  await page.route('**/api/products', (route) => json(route, 200, { products: homeProducts }));
  await page.route('**/api/products/latest', (route) => json(route, 200, homeProducts[0]));

  await page.goto('/');
  await expect(page.locator('.home-product-card').first()).toBeVisible();
  await expect(page.locator('[data-demo-entry]')).toBeHidden();
  await expect(page.locator('#demo-session-bar')).toBeHidden();
  await expect(page.locator('#demo-session-notice-wrap')).toBeHidden();

  await page.goto('/login');
  await expect(page.locator('[data-demo-entry]')).toBeHidden();
});

test('completes full Buyer demo flow over /api/demo/* with m3d_demo_csrf and clean exit', async ({
  page,
}) => {
  let demoActive = false;
  let cartState: Array<{ productId: number; quantity: number }> = [];
  let createdOrder: Record<string, unknown> | null = null;
  let commissionSubmitted = false;
  let sessionDeleted = false;
  const csrfObserved: string[] = [];

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());
    const method = req.method();

    if (pathname === '/api/demo/status') return json(route, 200, { enabled: true });
    if (pathname === '/api/products' || pathname === '/api/demo/products') {
      return json(route, 200, { products: homeProducts });
    }
    if (pathname === '/api/products/latest' || pathname === '/api/demo/products/latest') {
      return json(route, 200, homeProducts[0]);
    }
    if (pathname === '/api/demo/product/1') return json(route, 200, homeProducts[0]);

    if (pathname === '/api/demo/session' && method === 'POST') {
      demoActive = true;
      await setDemoCookie(page);
      return json(route, 201, BUYER_SESSION);
    }
    if (pathname === '/api/demo/session' && method === 'GET') {
      return demoActive
        ? json(route, 200, BUYER_SESSION)
        : json(route, 401, { error: 'Demo sandbox session invalid or expired' });
    }
    if (pathname === '/api/demo/session' && method === 'DELETE') {
      const hdr = req.headers()['x-csrf-token'] ?? '';
      if (hdr !== DEMO_CSRF) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfObserved.push(`DELETE:${hdr}`);
      demoActive = false;
      sessionDeleted = true;
      return route.fulfill({ status: 204 });
    }
    if (pathname === '/api/demo/cart' && method === 'GET') {
      const items = cartState.map((c) => ({
        idProduct: c.productId,
        quantity: c.quantity,
        unitPrice: homeProducts[0].price,
        product: {
          idProduct: homeProducts[0].idProduct,
          nameProduct: homeProducts[0].nameProduct,
          price: homeProducts[0].price,
          image: homeProducts[0].image,
        },
      }));
      const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      return json(route, 200, { items, total });
    }
    if (pathname === '/api/demo/cart' && method === 'PUT') {
      const hdr = req.headers()['x-csrf-token'] ?? '';
      if (hdr !== DEMO_CSRF) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfObserved.push(`PUT_CART:${hdr}`);
      const body = req.postDataJSON() as { items?: Array<{ productId: number; quantity: number }> };
      cartState = body.items ?? [];
      return json(route, 200, { ok: true });
    }
    if (pathname === '/api/demo/orders' && method === 'POST') {
      const hdr = req.headers()['x-csrf-token'] ?? '';
      if (hdr !== DEMO_CSRF) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfObserved.push(`POST_ORDER:${hdr}`);
      createdOrder = {
        idOrder: 101,
        status: 'AWAITING_PAYMENT',
        totalAmount: homeProducts[0].price,
        createdAt: '2026-11-24T01:00:00.000Z',
        items: [
          {
            idProduct: homeProducts[0].idProduct,
            productName: homeProducts[0].nameProduct,
            quantity: 1,
            unitPrice: homeProducts[0].price,
            subtotal: homeProducts[0].price,
          },
        ],
      };
      cartState = [];
      return json(route, 201, createdOrder);
    }
    if (pathname === '/api/demo/orders/101' && method === 'GET') {
      return createdOrder ? json(route, 200, createdOrder) : json(route, 404, { error: 'Missing' });
    }
    if (pathname === '/api/demo/orders/mine' && method === 'GET') {
      const orders = createdOrder ? [createdOrder] : [];
      return json(route, 200, { orders, total: orders.length, page: 1, pageSize: 10 });
    }
    if (pathname === '/api/demo/custom-commission-requests' && method === 'POST') {
      const hdr = req.headers()['x-csrf-token'] ?? '';
      if (hdr !== DEMO_CSRF) return json(route, 403, { error: 'Invalid demo CSRF' });
      csrfObserved.push(`POST_COMM:${hdr}`);
      commissionSubmitted = true;
      return json(route, 201, { idCustomCommissionRequest: 501 });
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

  await expect(page.locator('#demo-session-bar')).toBeVisible();
  await expect(page.locator('#demo-role-buyer')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#navbar-greeting')).toHaveText('Cuenta demo');

  await page.goto('/product?id=1');
  const addBtn = page.getByRole('button', { name: /Agregar al carrito/i });
  await expect(addBtn).toBeVisible();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/demo/cart') && r.request().method() === 'PUT'),
    addBtn.click(),
  ]);
  await page.goto('/cart');
  await expect(page.locator('.cart__summary-note')).toContainText('Pedido simulado');
  const checkoutBtn = page.locator('.cart__btn-checkout');
  await expect(checkoutBtn).toBeVisible();
  await checkoutBtn.click();
  await expect(page).toHaveURL(/\/order\?id=101$/);

  await page.goto('/orders');
  await expect(page.locator('main')).toContainText('#101');

  await page.goto('/help');
  await page.locator('#commission-name').fill('Demo Evaluator');
  await page.locator('#commission-email').fill('eval@sandbox.invalid');
  await page.locator('#commission-idea').fill('Una pieza de prueba dentro del slot demo.');
  await page.getByRole('button', { name: 'Enviar idea' }).click();
  await expect(page.locator('#commission-feedback')).toContainText('tu solicitud quedó guardada');

  await page.locator('#demo-bar-exit').click();
  await expect(page.locator('#demo-session-bar')).toBeHidden();
  expect(commissionSubmitted).toBe(true);
  expect(sessionDeleted).toBe(true);
  expect(csrfObserved).toEqual([
    `PUT_CART:${DEMO_CSRF}`,
    `POST_ORDER:${DEMO_CSRF}`,
    `POST_COMM:${DEMO_CSRF}`,
    `DELETE:${DEMO_CSRF}`,
  ]);
});

test('handles 503 DEMO_SANDBOX_BUSY and 401 lease expiry honestly on mobile without /login bounce', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let startAttempts = 0;
  let expired = false;

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const { pathname } = new URL(req.url());

    if (pathname === '/api/demo/status') return json(route, 200, { enabled: true });
    if (pathname === '/api/products' || pathname === '/api/demo/products') {
      return json(route, 200, { products: homeProducts });
    }
    if (pathname === '/api/products/latest' || pathname === '/api/demo/products/latest') {
      return json(route, 200, homeProducts[0]);
    }
    if (pathname === '/api/demo/session' && req.method() === 'POST') {
      startAttempts += 1;
      if (startAttempts === 1) {
        return json(
          route,
          503,
          { code: 'DEMO_SANDBOX_BUSY', message: 'All demo sessions are currently in use.' },
          { 'Retry-After': '30' },
        );
      }
      await setDemoCookie(page);
      return json(route, 201, BUYER_SESSION);
    }
    if (pathname === '/api/demo/session' && req.method() === 'GET') {
      return expired ? json(route, 401, { error: 'Expired' }) : json(route, 200, BUYER_SESSION);
    }
    if (pathname === '/api/demo/session/refresh') {
      return json(route, 401, { error: 'Lease expired' });
    }
    if (pathname === '/api/demo/cart') return json(route, 200, { items: [], total: 0 });
    if (pathname === '/api/demo/orders/mine') {
      return json(route, 401, { error: 'Demo sandbox lease invalid or expired' });
    }
    return route.continue();
  });

  await page.goto('/');
  await page.locator('[data-demo-entry]').first().click();
  await expect(page.locator('#demo-session-notice-wrap')).toBeVisible();
  await expect(page.locator('#demo-notice-title')).toContainText('ocupadas');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.locator('#demo-notice-retry').click();
  await expect(page.locator('#demo-session-bar')).toBeVisible();

  expired = true;
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('#demo-session-bar')).toBeHidden();
  await expect(page.locator('#demo-session-notice-wrap')).toBeVisible();
  await expect(page.locator('#demo-notice-title')).toContainText('venció');
  await expect(page.locator('#demo-notice-retry')).toContainText('Iniciar nueva sesión demo');
});
