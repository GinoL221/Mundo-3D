import { expect, test, type Page } from '@playwright/test';

const profileUser = {
  idUser: 42,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  image: '/img/users/missing-profile-image.png',
  idRole: 2,
  category: null,
};

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
  for (const theme of ['light', 'dark'] as const) {
    test(`${viewport.name} ${theme}: renders the authenticated read-only profile without overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(
        (selectedTheme) => localStorage.setItem('theme', selectedTheme),
        theme,
      );
      await page.route('**/api/users/me', (route) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ user: profileUser }),
        }),
      );

      await page.goto('/profile');

      await expect(page.getByRole('heading', { level: 1, name: 'Tu perfil' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeVisible();
      await expect(page.locator('#profile-email')).toHaveText('ada@example.test');
      await expect(page.locator('#profile-image')).toHaveAttribute(
        'src',
        '/img/users/default-avatar.png',
      );
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('#profile-content')).toBeVisible();
      await expect(
        page.locator('#profile-content input, #profile-content textarea, #profile-content select'),
      ).toHaveCount(0);
      await expect(page.locator('#profile-content button')).toHaveCount(0);
      await expect(page.getByText(/editar|cambiar contraseña|subir imagen/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('guest sees an honest sign-in state with a usable target and no profile data', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Token de autenticación no proporcionado' }),
    }),
  );
  await page.route('**/api/users/refresh', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );

  await page.goto('/profile');

  await expect(
    page.getByRole('heading', { name: 'Iniciá sesión para ver tu perfil' }),
  ).toBeVisible();
  await expect(page.locator('#profile-content')).toBeHidden();
  await expect(page.locator('#profile-email')).toHaveText('');
  const login = page.getByRole('link', { name: 'Ir a iniciar sesión' });
  await expect(login).toHaveAttribute('href', '/login');
  await expect(login).toHaveCSS('min-height', '44px');
  await login.focus();
  await expect(login).toBeFocused();
  await expect(login).toHaveCSS('outline-style', 'solid');
  await expectNoHorizontalOverflow(page);
});
