import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  clearMailpit,
  confirmationLinkAcceptedByLocalMailpit,
  readConfirmationState,
  readRegistrationConfirmationState,
  withMailpitUnavailable,
} from '../fixtures/emailConfirmation.js';

async function submitResend(page: Page, email: string) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/users/email-confirmation/resend') &&
      response.request().method() === 'POST',
  );
  await page.fill('#resend-email', email);
  await page.getByRole('button', { name: 'Solicitar otro enlace' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(202);
  await expect(page.locator('#email-confirmation-feedback')).toHaveText(
    'Si la cuenta es elegible, podrá recibir un nuevo enlace de confirmación.',
  );
  return response.json();
}

async function registerUnverifiedUser(page: Page) {
  const email = `email-confirmation-${randomUUID()}@example.com`;
  const password = 'Password123!';

  await page.goto('/register');
  await page.fill('#firstName', 'Email');
  await page.fill('#lastName', 'Confirm');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.setInputFiles('#image', {
    name: 'required-avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from('required test image'),
  });
  await page.click('#register-btn');
  await expect(page).toHaveURL('/');

  return { email, password };
}

async function waitForLoginHandler(page: Page): Promise<void> {
  await page.locator('#login-form').evaluate(async (form: HTMLFormElement) => {
    const emailError = form.querySelector<HTMLElement>('#email-error');
    const passwordError = form.querySelector<HTMLElement>('#password-error');
    const preventNativeNavigation = (event: Event): void => event.preventDefault();
    form.addEventListener('submit', preventNativeNavigation, { capture: true });
    try {
      while (
        emailError?.textContent?.trim() !== 'Ingresá tu correo electrónico.' ||
        passwordError?.textContent?.trim() !== 'Ingresá tu contraseña.'
      ) {
        form.requestSubmit();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      form.removeEventListener('submit', preventNativeNavigation, { capture: true });
    }
  });
}

test.describe('email confirmation', () => {
  test.beforeEach(async () => {
    await clearMailpit();
  });

  test('keeps registration authenticated until explicit confirmation submission consumes its token', async ({
    page,
  }) => {
    const { email } = await registerUnverifiedUser(page);
    const cookies = await page.context().cookies();
    expect(cookies.some((cookie) => cookie.name === 'm3d_auth')).toBe(true);
    await expect(page.locator('#navbar-greeting')).toContainText('Hola Email');

    // Mailpit proves only local SMTP transport acceptance; it is neither an inbox
    // delivery assertion nor a production-provider claim.
    const confirmationLink = await confirmationLinkAcceptedByLocalMailpit(email);
    expect(confirmationLink).toContain('/confirm-email?token=');

    await page.goto(confirmationLink);
    await expect(
      page.getByRole('heading', { name: 'Confirmá tu correo electrónico' }),
    ).toBeVisible();
    await expect(readConfirmationState(email)).resolves.toEqual({
      emailVerifiedAt: null,
      consumedAt: null,
    });

    const confirmationResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/users/email-confirmation/confirm') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirmar correo' }).click();
    expect((await confirmationResponse).status()).toBe(204);
    await expect(page.locator('#email-confirmation-feedback')).toHaveText(
      'Tu correo fue confirmado.',
    );
    await expect(readConfirmationState(email)).resolves.toEqual({
      emailVerifiedAt: expect.any(Date),
      consumedAt: expect.any(Date),
    });
  });

  test('shows generic invalid-link feedback without rendering the token', async ({ page }) => {
    const invalidToken = 'invalid-confirmation-token';
    await page.goto(`/confirm-email?token=${invalidToken}`);
    await expect(
      page.getByRole('heading', { name: 'Confirmá tu correo electrónico' }),
    ).toBeVisible();

    const confirmationResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/users/email-confirmation/confirm') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirmar correo' }).click();
    expect((await confirmationResponse).status()).toBe(400);
    await expect(page.locator('#email-confirmation-feedback')).toHaveText(
      'El enlace no es válido o ya venció. Podés solicitar otro.',
    );
    await expect(page.locator('#email-confirmation-feedback')).not.toContainText(invalidToken);
  });

  test('keeps repeated successful confirmation idempotent and generic', async ({ page }) => {
    const { email } = await registerUnverifiedUser(page);
    await page.goto(await confirmationLinkAcceptedByLocalMailpit(email));

    for (const expectedState of [
      { emailVerifiedAt: expect.any(Date), consumedAt: expect.any(Date) },
      { emailVerifiedAt: expect.any(Date), consumedAt: expect.any(Date) },
    ]) {
      const confirmationResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/users/email-confirmation/confirm') &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Confirmar correo' }).click();
      expect((await confirmationResponse).status()).toBe(204);
      await expect(page.locator('#email-confirmation-feedback')).toHaveText(
        'Tu correo fue confirmado.',
      );
      await expect(readConfirmationState(email)).resolves.toEqual(expectedState);
    }
  });

  test('keeps absent, verified, and IP-limited resend requests indistinguishable', async ({
    page,
  }) => {
    const { email } = await registerUnverifiedUser(page);
    await page.goto(await confirmationLinkAcceptedByLocalMailpit(email));
    await page.getByRole('button', { name: 'Confirmar correo' }).click();
    await expect(readConfirmationState(email)).resolves.toEqual({
      emailVerifiedAt: expect.any(Date),
      consumedAt: expect.any(Date),
    });

    const responses = [];
    await page.goto('/confirm-email');
    responses.push(await submitResend(page, `absent-${randomUUID()}@example.com`));
    responses.push(await submitResend(page, email));
    responses.push(await submitResend(page, `absent-${randomUUID()}@example.com`));
    responses.push(await submitResend(page, `absent-${randomUUID()}@example.com`));

    expect(responses).toEqual([
      { message: 'If the account is eligible, a confirmation email will be sent.' },
      { message: 'If the account is eligible, a confirmation email will be sent.' },
      { message: 'If the account is eligible, a confirmation email will be sent.' },
      { message: 'If the account is eligible, a confirmation email will be sent.' },
    ]);
  });

  test('retains registration, session, and active token when local SMTP is unavailable', async ({
    page,
  }) => {
    await withMailpitUnavailable(async () => {
      const { email } = await registerUnverifiedUser(page);
      const cookies = await page.context().cookies();
      expect(cookies.some((cookie) => cookie.name === 'm3d_auth')).toBe(true);
      await expect(readRegistrationConfirmationState(email)).resolves.toEqual({
        emailVerifiedAt: null,
        consumedAt: null,
        activeSlot: 1,
      });
    });

    await clearMailpit();
  });

  test('keeps an unverified user able to log in, open the account menu, use cart, and checkout', async ({
    page,
  }) => {
    const { email, password } = await registerUnverifiedUser(page);
    await expect(readConfirmationState(email)).resolves.toEqual({
      emailVerifiedAt: null,
      consumedAt: null,
    });

    await page.locator('#navbar-user-menu-trigger').click();
    await expect(page.locator('#navbar-user-menu')).toBeVisible();
    await page.locator('#navbar-logout').click();
    await expect(page).toHaveURL('/login');
    await waitForLoginHandler(page);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('#login-btn');
    await expect(page).toHaveURL('/');
    await page.locator('#navbar-user-menu-trigger').click();
    await expect(page.locator('#navbar-user-menu')).toBeVisible();

    await page.goto('/product?id=1');
    await expect(page.locator('#product-name')).not.toBeEmpty();
    const cartPut = page.waitForResponse(
      (response) => response.url().includes('/api/cart') && response.request().method() === 'PUT',
    );
    await page.click('#add-to-cart-btn');
    await cartPut;
    await page.goto('/cart');
    await expect(page.locator('.cart__item')).toHaveCount(1);
    await page.click('.cart__btn-checkout');
    await expect(page).toHaveURL(/\/order\?id=\d+/);
  });
});
