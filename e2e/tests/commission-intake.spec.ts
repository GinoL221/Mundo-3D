import { test, expect, type Page, type Route } from '@playwright/test';
import { homeProducts } from '../fixtures/homeProducts.js';

const COMMISSION_REQUEST_PATH = '/api/custom-commission-requests';
const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

type ActiveRole = 'VISITOR' | 'STAFF' | 'ADMIN' | 'USER' | 'ANONYMOUS';

const requestFixture = {
  idCustomCommissionRequest: 401,
  name: 'E2E Commission Visitor',
  email: 'commission-visitor@example.test',
  idea: 'Quiero una figura personalizada para este escenario de navegador.',
  idProduct: null,
  createdAt: '2026-10-24T12:00:00.000Z',
  expiresAt: '2026-11-23T12:00:00.000Z',
};

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

async function setSessionRole(page: Page, idRole: number | null): Promise<void> {
  await page.context().clearCookies();
  if (idRole === null) return;

  await page.context().addCookies([
    {
      name: 'm3d_user',
      value: encodeURIComponent(
        JSON.stringify({
          idUser: idRole,
          firstName: 'E2E',
          lastName: 'Reviewer',
          idRole,
        }),
      ),
      url: new URL(page.url()).origin,
    },
  ]);
}

test('visitor submits from the home CTA; STAFF/ADMIN can read while USER/guest are denied', async ({
  page,
}) => {
  const protectedReadRoles: ActiveRole[] = [];
  const unexpectedApiRequests: string[] = [];
  const blockedExternalRequests: string[] = [];
  let appOrigin: string | null = null;
  let activeRole: ActiveRole = 'VISITOR';
  let submissionCount = 0;
  let submissionPayload: unknown;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      !appOrigin &&
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      url.pathname === '/' &&
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      appOrigin = url.origin;
    }

    if (url.pathname.startsWith('/api/')) {
      if (request.method() === 'GET' && url.pathname === '/api/products') {
        await fulfillJson(route, 200, { products: homeProducts });
        return;
      }

      if (request.method() === 'GET' && url.pathname === '/api/products/latest') {
        await fulfillJson(route, 200, homeProducts[0]);
        return;
      }

      if (url.pathname === COMMISSION_REQUEST_PATH && request.method() === 'POST') {
        submissionCount += 1;
        submissionPayload = request.postDataJSON();
        await fulfillJson(route, 201, {
          idCustomCommissionRequest: requestFixture.idCustomCommissionRequest,
        });
        return;
      }

      if (url.pathname === COMMISSION_REQUEST_PATH && request.method() === 'GET') {
        protectedReadRoles.push(activeRole);
        await fulfillJson(route, 200, [requestFixture]);
        return;
      }

      unexpectedApiRequests.push(`${request.method()} ${url.pathname}`);
      await fulfillJson(route, 404, { error: 'Unexpected API request in isolated commission E2E' });
      return;
    }

    if (url.origin === appOrigin) {
      await route.continue();
      return;
    }

    blockedExternalRequests.push(url.href);
    await route.abort();
  });

  await page.goto('/');
  const commissionCta = page.getByRole('link', { name: /Contanos tu idea/ });
  await expect(commissionCta).toBeVisible();
  await commissionCta.click();
  await expect(page).toHaveURL('/help');
  await expect(page.getByRole('heading', { name: 'Contanos tu idea' })).toBeVisible();
  await expect(page.locator('#commission-product')).toBeEnabled();

  await page.locator('#commission-name').fill(requestFixture.name);
  await page.locator('#commission-email').fill(requestFixture.email);
  await page.locator('#commission-idea').fill(requestFixture.idea);
  await page.getByRole('button', { name: 'Enviar idea' }).click();
  await expect(page.locator('#commission-feedback')).toContainText('tu solicitud quedó guardada');

  expect(submissionCount).toBe(1);
  expect(submissionPayload).toMatchObject({
    name: requestFixture.name,
    email: requestFixture.email,
    idea: requestFixture.idea,
  });
  expect(submissionPayload).not.toHaveProperty('idProduct');

  for (const role of [
    { name: 'STAFF' as const, idRole: 3 },
    { name: 'ADMIN' as const, idRole: 1 },
  ]) {
    activeRole = role.name;
    await setSessionRole(page, role.idRole);
    await page.goto('/admin/commission-requests');
    await expect(page.locator('#admin-requests-content')).toBeVisible();
    await expect(page.locator('#admin-requests-list')).toContainText(requestFixture.name);
    await expect(page.locator('.admin-only a[href="/admin/commission-requests"]')).toBeVisible();
    expect(protectedReadRoles).toContain(role.name);
  }

  for (const role of [
    { name: 'ANONYMOUS' as const, idRole: null },
    { name: 'USER' as const, idRole: 2 },
  ]) {
    const readsBeforeNavigation = protectedReadRoles.length;
    activeRole = role.name;
    await setSessionRole(page, role.idRole);
    await page.goto('/admin/commission-requests');
    await expect(page.locator('#admin-gate-denied')).toBeVisible();
    await expect(page.locator('#admin-requests-content')).toBeHidden();
    await expect(page.locator('.admin-only a[href="/admin/commission-requests"]')).toBeHidden();
    expect(protectedReadRoles).toHaveLength(readsBeforeNavigation);
  }

  expect(unexpectedApiRequests).toEqual([]);
  expect(blockedExternalRequests).toEqual([]);
});
