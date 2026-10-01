import { expect, test, type Page, type Route } from '@playwright/test';

const product = { idProduct: 42, nameProduct: 'Pieza de prueba' };
const draft = {
  name: 'Visitante de prueba',
  email: 'visitante@example.test',
  idea: 'Una pieza personalizada para regalar.',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function routeCatalog(page: Page, response: (route: Route) => Promise<void>) {
  await page.route('**/api/products', response);
}

async function fillDraft(page: Page) {
  await page.locator('#commission-name').fill(draft.name);
  await page.locator('#commission-email').fill(draft.email);
  await page.locator('#commission-idea').fill(draft.idea);
}

async function openForm(page: Page) {
  await page.goto('/help', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Solicitud de encargo' })).toBeVisible();
}

test.describe('custom commission form submission', () => {
  test('locks the complete draft while submitting and resets only after success', async ({ page }) => {
    const postStarted = deferred<void>();
    const finishPost = deferred<void>();
    const payloads: unknown[] = [];
    await routeCatalog(page, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ products: [product] }),
    }));
    await page.route('**/api/custom-commission-requests', async (route) => {
      payloads.push(route.request().postDataJSON());
      postStarted.resolve();
      await finishPost.promise;
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 1 }) });
    });
    await openForm(page);
    const select = page.locator('#commission-product');
    await expect(select).toBeEnabled();
    await fillDraft(page);
    await select.selectOption(String(product.idProduct));

    await page.getByRole('button', { name: 'Enviar idea' }).click();
    await postStarted.promise;
    const fieldset = page.locator('#commission-fields');
    try {
      await expect(fieldset).toHaveJSProperty('disabled', true);
      const controls = fieldset.locator('input, textarea, select, button');
      await expect(controls).toHaveCount(5);
      for (let index = 0; index < 5; index += 1) {
        await expect(controls.nth(index)).toBeDisabled();
      }
      await expect(page.locator('#commission-feedback')).toContainText('Enviando');
      await expect(fieldset.locator('#commission-feedback')).toHaveCount(0);
      await page.keyboard.press('x');
      await expect(page.locator('#commission-name')).toHaveValue(draft.name);
      await expect(page.locator('#commission-email')).toHaveValue(draft.email);
      await expect(page.locator('#commission-idea')).toHaveValue(draft.idea);
      await expect(select).toHaveValue(String(product.idProduct));
      await page.locator('#commission-form').evaluate((form) => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await expect.poll(() => payloads).toEqual([{
        ...draft,
        idProduct: product.idProduct,
      }]);
    } finally {
      finishPost.resolve();
    }

    await expect(page.locator('#commission-feedback')).toContainText('Listo:');
    await expect(fieldset).toHaveJSProperty('disabled', false);
    await expect(page.locator('#commission-name')).toHaveValue('');
    await expect(page.locator('#commission-email')).toHaveValue('');
    await expect(page.locator('#commission-idea')).toHaveValue('');
    await expect(select).toHaveValue('');
    await expect(select).toBeEnabled();
  });

  test('preserves the draft after a failed response and retries the same request', async ({ page }) => {
    let attempts = 0;
    const firstPost = deferred<void>();
    const releaseFirstPost = deferred<void>();
    const payloads: unknown[] = [];
    await routeCatalog(page, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ products: [product] }),
    }));
    await page.route('**/api/custom-commission-requests', async (route) => {
      payloads.push(route.request().postDataJSON());
      attempts += 1;
      if (attempts === 1) {
        firstPost.resolve();
        await releaseFirstPost.promise;
        await route.fulfill({ status: 500, body: '{}' });
      } else {
        await route.fulfill({ status: 201, body: JSON.stringify({ id: 2 }) });
      }
    });
    await openForm(page);
    await fillDraft(page);
    await page.locator('#commission-product').selectOption(String(product.idProduct));
    await page.getByRole('button', { name: 'Enviar idea' }).click();
    await firstPost.promise;
    releaseFirstPost.resolve();

    await expect(page.locator('#commission-feedback')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#commission-name')).toHaveValue(draft.name);
    await expect(page.locator('#commission-email')).toHaveValue(draft.email);
    await expect(page.locator('#commission-idea')).toHaveValue(draft.idea);
    await expect(page.locator('#commission-product')).toHaveValue(String(product.idProduct));
    await expect(page.locator('#commission-fields')).toHaveJSProperty('disabled', false);
    await page.getByRole('button', { name: 'Enviar idea' }).click();
    await expect(page.locator('#commission-feedback')).toContainText('Listo:');
    expect(attempts).toBe(2);
    expect(payloads).toEqual([{
      ...draft,
      idProduct: product.idProduct,
    }, {
      ...draft,
      idProduct: product.idProduct,
    }]);
  });

  test('keeps an unavailable product selector disabled after unlocking a failed submission', async ({ page }) => {
    const payloads: unknown[] = [];
    await routeCatalog(page, (route) => route.fulfill({ status: 500 }));
    await page.route('**/api/custom-commission-requests', (route) => {
      payloads.push(route.request().postDataJSON());
      return route.fulfill({ status: 500, body: '{}' });
    });
    await openForm(page);
    await expect(page.locator('#product-unavailable')).toBeVisible();
    await fillDraft(page);
    await page.getByRole('button', { name: 'Enviar idea' }).click();

    await expect(page.locator('#commission-feedback')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#commission-name')).toHaveValue(draft.name);
    await expect(page.locator('#commission-fields')).toHaveJSProperty('disabled', false);
    await expect(page.locator('#commission-product')).toBeDisabled();
    expect(payloads).toEqual([draft]);
  });

  test('does not expose catalog choices resolved during submission until the request completes', async ({ page }) => {
    const catalogStarted = deferred<void>();
    const finishCatalog = deferred<void>();
    const postStarted = deferred<void>();
    const finishPost = deferred<void>();
    const payloads: unknown[] = [];
    await routeCatalog(page, async (route) => {
      catalogStarted.resolve();
      await finishCatalog.promise;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ products: [product] }),
      });
    });
    await page.route('**/api/custom-commission-requests', async (route) => {
      payloads.push(route.request().postDataJSON());
      postStarted.resolve();
      await finishPost.promise;
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 3 }) });
    });
    await openForm(page);
    try {
      await catalogStarted.promise;
      await fillDraft(page);
      await page.getByRole('button', { name: 'Enviar idea' }).click();
      await postStarted.promise;
      finishCatalog.resolve();
      await expect(page.locator('#commission-product')).toHaveJSProperty('disabled', false);
      await expect(page.locator('#commission-product')).toBeDisabled();
    } finally {
      finishCatalog.resolve();
      finishPost.resolve();
    }

    await expect(page.locator('#commission-feedback')).toContainText('Listo:');
    await expect.poll(() => payloads).toEqual([draft]);
    await expect(page.locator('#commission-product')).toBeEnabled();
    await expect(page.locator('#commission-product option')).toHaveText(['Sin asociar', product.nameProduct]);
  });
});
