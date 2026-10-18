import { test, expect, request, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3032';
const VISIBILITY_TIMEOUT = { timeout: 15000 };

async function login(email: string, password: string): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL: API_URL, storageState: undefined });
  const response = await context.post('/api/users/login', { data: { email, password } });
  expect(response.ok()).toBeTruthy();
  return context;
}

test('public intake is submitted from home and only STAFF/ADMIN can read it', async ({ page, browser }) => {
  const unique = `${Date.now()}`;
  const name = `Commission ${unique}`;
  const email = `commission-${unique}@example.com`;
  const idea = `Custom commission idea ${unique}`;

  await page.goto('/');
  await page.locator('.home-button--commission[href="/help"]').click();
  await expect(page).toHaveURL(/\/help$/);
  await page.locator('#commission-name').fill(name);
  await page.locator('#commission-email').fill(email);
  await page.locator('#commission-idea').fill(idea);
  await page.locator('#commission-form button[type="submit"]').click();
  await expect(page.locator('#commission-feedback')).toContainText(/enviad|recibid|guardad/i, { timeout: 15000 });

  const anonymous = await request.newContext({ baseURL: API_URL, storageState: undefined });
  const anonymousResponse = await anonymous.get('/api/custom-commission-requests');
  expect(anonymousResponse.status()).toBe(401);
  await anonymous.dispose();

  const user = await request.newContext({ baseURL: API_URL, storageState: undefined });
  const registration = await user.post('/api/users/register', {
    multipart: {
      firstName: 'E2E', lastName: 'Commission', email: `commission-user-${unique}@example.com`,
      password: 'Password123!', confirmPassword: 'Password123!',
      image: { name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('fixture') },
    },
  });
  expect(registration.ok()).toBeTruthy();
  const userStorage = await user.storageState();
  const userResponse = await user.get('/api/custom-commission-requests');
  expect(userResponse.status()).toBe(403);
  await user.dispose();

  for (const [role, credentials] of [
    ['ADMIN', ['admin@email.com', 'admin123']],
    ['STAFF', ['staff@email.com', 'staff123']],
  ] as const) {
    const api = await login(credentials[0], credentials[1]);
    const response = await api.get('/api/custom-commission-requests');
    expect(response.ok(), `${role} API read`).toBeTruthy();
    expect(JSON.stringify(await response.json())).toContain(idea);
    const storageState = await api.storageState();
    await api.dispose();

    const context = await browser.newContext({ storageState });
    const staffPage = await context.newPage();
    await staffPage.goto('/admin/commission-requests');
    await expect(staffPage.locator('#admin-requests-content')).toBeVisible(VISIBILITY_TIMEOUT);
    await expect(staffPage.locator('#admin-requests-list')).toContainText(idea, VISIBILITY_TIMEOUT);
    await context.close();
  }

  const regularContext = await browser.newContext({ storageState: userStorage });
  const regularPage = await regularContext.newPage();
  const userReads: number[] = [];
  regularPage.on('request', (request) => {
    if (request.url().includes('/api/custom-commission-requests')) userReads.push(1);
  });
  await regularPage.goto('/admin/commission-requests');
  await expect(regularPage.locator('#admin-gate-denied')).toBeVisible(VISIBILITY_TIMEOUT);
  await expect(regularPage.locator('#admin-requests-content')).toBeHidden(VISIBILITY_TIMEOUT);
  expect(userReads).toHaveLength(0);
  await regularContext.close();

  await page.goto('/admin/commission-requests');
  await expect(page.locator('#admin-gate-denied')).toBeVisible(VISIBILITY_TIMEOUT);
  await expect(page.locator('#admin-requests-content')).toBeHidden(VISIBILITY_TIMEOUT);
  const guestRead = await request.newContext({ baseURL: API_URL, storageState: undefined });
  expect((await guestRead.get('/api/custom-commission-requests')).status()).toBe(401);
  await guestRead.dispose();
});
