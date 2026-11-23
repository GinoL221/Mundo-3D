import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3032';

async function loginThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('#login-btn');
  await expect(page).toHaveURL('/');
}

test.describe('Custom Commission Requests - Real Backend E2E', () => {
  test('visitor submits with and without a catalog piece; STAFF and ADMIN review persisted requests while USER and guest receive 403/401', async ({
    page,
    browser,
  }) => {
    const runTag = randomUUID().slice(0, 8);
    const withPieceRequest = {
      name: `Encargo Pieza ${runTag}`,
      email: `pieza-${runTag}@example.test`,
      idea: `Quiero una variante pintada a mano basada en la pieza del catálogo (${runTag}).`,
    };
    const withoutPieceRequest = {
      name: `Encargo Libre ${runTag}`,
      email: `libre-${runTag}@example.test`,
      idea: `Quiero un soporte personalizado desde cero sin pieza asociada (${runTag}).`,
    };

    // 1. Visitor enters via Home CTA and waits for real catalog options from GET /api/products.
    await page.goto('/');
    const commissionCta = page
      .locator('#encargos')
      .getByRole('link', { name: /Enviar solicitud de encargo/ });
    await expect(commissionCta).toBeVisible();
    await commissionCta.click();
    await expect(page).toHaveURL('/help');
    await expect(page.getByRole('heading', { name: 'Contanos tu idea' })).toBeVisible();

    const productSelect = page.locator('#commission-product');
    await expect(productSelect).toBeEnabled();
    await expect(productSelect.locator('option[value="1"]')).toHaveCount(1);
    const selectedProductName =
      (await productSelect.locator('option[value="1"]').textContent())?.trim() ?? '';
    expect(selectedProductName).not.toBe('');

    // 2. Submit Request A associated with catalog product #1 against the real backend.
    await page.fill('#commission-name', withPieceRequest.name);
    await page.fill('#commission-email', withPieceRequest.email);
    await page.fill('#commission-idea', withPieceRequest.idea);
    await productSelect.selectOption('1');

    const firstPost = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/custom-commission-requests') &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Enviar idea' }).click();
    const firstResponse = await firstPost;
    expect(firstResponse.status()).toBe(201);
    const firstReceipt = (await firstResponse.json()) as { idCustomCommissionRequest: number };
    expect(Number.isInteger(firstReceipt.idCustomCommissionRequest)).toBe(true);
    await expect(page.locator('#commission-feedback')).toContainText('tu solicitud quedó guardada');

    // 3. Submit Request B without an associated catalog product.
    await page.fill('#commission-name', withoutPieceRequest.name);
    await page.fill('#commission-email', withoutPieceRequest.email);
    await page.fill('#commission-idea', withoutPieceRequest.idea);

    const secondPost = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/custom-commission-requests') &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Enviar idea' }).click();
    const secondResponse = await secondPost;
    expect(secondResponse.status()).toBe(201);
    await expect(page.locator('#commission-feedback')).toContainText('tu solicitud quedó guardada');

    // 4. Real STAFF session inspects both persisted requests in /admin/commission-requests.
    const staffContext = await browser.newContext();
    try {
      const staffPage = await staffContext.newPage();
      await loginThroughUi(staffPage, 'staff@email.com', 'staff123');
      await staffPage.goto('/admin/commission-requests');

      await expect(staffPage.locator('#admin-requests-content')).toBeVisible();
      await expect(staffPage.locator('#admin-gate-denied')).toBeHidden();
      await expect(staffPage.locator('#admin-role-badge')).toHaveText('STAFF');

      const withPieceItem = staffPage
        .locator('#admin-requests-list .ui-inbox__item')
        .filter({ hasText: withPieceRequest.name });
      await expect(withPieceItem).toBeVisible();
      await expect(withPieceItem).toContainText(withPieceRequest.idea);
      await expect(withPieceItem.locator(`a[href="mailto:${withPieceRequest.email}"]`)).toBeVisible();
      await expect(withPieceItem.locator('a[href="/product?id=1"]')).toHaveText(
        `Pieza: ${selectedProductName}`,
      );

      const withoutPieceItem = staffPage
        .locator('#admin-requests-list .ui-inbox__item')
        .filter({ hasText: withoutPieceRequest.name });
      await expect(withoutPieceItem).toBeVisible();
      await expect(withoutPieceItem).toContainText(withoutPieceRequest.idea);
      await expect(withoutPieceItem).toContainText('Sin pieza asociada');
    } finally {
      await staffContext.close();
    }

    // 5. Real ADMIN session also reads the persisted requests.
    const adminContext = await browser.newContext();
    try {
      const adminPage = await adminContext.newPage();
      await loginThroughUi(adminPage, 'admin@email.com', 'admin123');
      await adminPage.goto('/admin/commission-requests');

      await expect(adminPage.locator('#admin-requests-content')).toBeVisible();
      await expect(adminPage.locator('#admin-role-badge')).toHaveText('ADMIN');
      await expect(adminPage.locator('#admin-requests-list')).toContainText(withPieceRequest.name);
      await expect(adminPage.locator('#admin-requests-list')).toContainText(
        withoutPieceRequest.name,
      );
    } finally {
      await adminContext.close();
    }

    // 6. Regular USER is blocked in UI AND denied 403 by the backend API.
    const userContext = await browser.newContext();
    try {
      const userPage = await userContext.newPage();
      await userPage.goto('/register');
      await userPage.fill('#firstName', 'ComUser');
      await userPage.fill('#lastName', 'Buyer');
      await userPage.fill('#email', `comm-user-${runTag}@example.com`);
      await userPage.fill('#password', 'Password123!');
      await userPage.fill('#confirmPassword', 'Password123!');
      await userPage.click('#register-btn');
      await expect(userPage).toHaveURL('/');

      await userPage.goto('/admin/commission-requests');
      await expect(userPage.locator('#admin-gate-denied')).toBeVisible();
      await expect(userPage.locator('#admin-requests-content')).toBeHidden();

      const userApiRes = await userContext.request.get(`${API_URL}/api/custom-commission-requests`);
      expect(userApiRes.status()).toBe(403);
    } finally {
      await userContext.close();
    }

    // 7. Unauthenticated guest is blocked in UI AND denied 401 by the backend API.
    const guestContext = await browser.newContext();
    try {
      const guestPage = await guestContext.newPage();
      await guestPage.goto('/admin/commission-requests');
      await expect(guestPage.locator('#admin-gate-denied')).toBeVisible();
      await expect(guestPage.locator('#admin-requests-content')).toBeHidden();

      const guestApiRes = await guestContext.request.get(
        `${API_URL}/api/custom-commission-requests`,
      );
      expect(guestApiRes.status()).toBe(401);
    } finally {
      await guestContext.close();
    }
  });
});
