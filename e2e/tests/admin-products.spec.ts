import { test, expect, request } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { mkdirSync } from 'fs';

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3032';

const FIXTURE_IMAGE = {
  name: 'fixture.png',
  mimeType: 'image/png',
  buffer: Buffer.from('fake image content'),
};

let adminApi: APIRequestContext;
let adminCsrfToken: string;

let fixtureSeq = 0;

/**
 * "E2E-<seq>-<ts>" — always <= 20 chars (satisfies the 5-20 char
 * `nameProduct` validator) and always starts with the "E2E-" prefix that
 * `sweepFixtureProducts` matches on, so every fixture (UI- or API-created)
 * is guaranteed to be cleaned up.
 */
function fixtureName(): string {
  fixtureSeq += 1;
  return `E2E-${fixtureSeq}-${Date.now() % 1e8}`;
}

async function loginAs(
  ctx: APIRequestContext,
  email: string,
  password: string,
  storagePath: string
): Promise<void> {
  const res = await ctx.post('/api/users/login', { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  await ctx.storageState({ path: storagePath });
}

/**
 * Registers a fresh regular USER (idRole: 2 by default — RegisterUserUseCase
 * never accepts a caller-supplied role) rather than logging in as the seeded
 * `gino@email.com`: that fixture's seed password (`123456`, 6 chars) fails
 * `loginValidation`'s 8-char minimum, so it can never authenticate through
 * the real login endpoint. Registering avoids depending on that mismatch.
 */
async function registerRegularUser(ctx: APIRequestContext, storagePath: string): Promise<void> {
  const res = await ctx.post('/api/users/register', {
    multipart: {
      firstName: 'E2E',
      lastName: 'Regular',
      email: `e2e-regular-${Date.now()}@example.com`,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      image: FIXTURE_IMAGE,
    },
  });
  expect(res.ok()).toBeTruthy();
  await ctx.storageState({ path: storagePath });
}

async function readCsrfToken(ctx: APIRequestContext): Promise<string> {
  const state = await ctx.storageState();
  const cookie = state.cookies.find((c) => c.name === 'm3d_csrf');
  if (!cookie) throw new Error('Missing m3d_csrf cookie after login');
  return cookie.value;
}

/**
 * Multipart POST via the module-scoped ADMIN `adminApi` context — mirrors
 * `withCredentials()`'s CSRF handling (raw cookie value, no decoding), see
 * design.md "Decision: Fixture products are created and swept by an ADMIN
 * APIRequestContext".
 */
async function createFixtureProduct(
  overrides: { stock?: number; price?: number } = {}
): Promise<{ idProduct: number; nameProduct: string }> {
  const nameProduct = fixtureName();
  const res = await adminApi.post('/api/products', {
    headers: { 'X-CSRF-Token': adminCsrfToken },
    multipart: {
      nameProduct,
      price: String(overrides.price ?? 1000),
      descriptionProduct: 'E2E fixture',
      idCategory: '1',
      idFranchise: '1',
      stock: String(overrides.stock ?? 5),
      image: FIXTURE_IMAGE,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { idProduct: body.idProduct, nameProduct: body.nameProduct };
}

/** Sweeps every `E2E-`-prefixed product; never touches seeded rows. */
async function sweepFixtureProducts(): Promise<void> {
  const res = await adminApi.get('/api/products');
  if (!res.ok()) return;

  const body = await res.json();
  const products: Array<{ idProduct: number; nameProduct: string }> = body?.products ?? [];

  for (const product of products) {
    if (typeof product.nameProduct === 'string' && product.nameProduct.startsWith('E2E-')) {
      const delRes = await adminApi.delete(`/api/products/${product.idProduct}`, {
        headers: { 'X-CSRF-Token': adminCsrfToken },
      });
      if (!delRes.ok() && delRes.status() !== 404) {
        console.error(`Failed to sweep fixture product ${product.idProduct}: HTTP ${delRes.status()}`);
      }
    }
  }
}

const row = (page: Page, name: string) => page.locator('.users-list__card').filter({ hasText: name });

test.beforeAll(async () => {
  // Two Playwright quirks, both required for a clean checkout (CI) where
  // `.auth/` has never been written to:
  // 1. `APIRequestContext.storageState({ path })`, unlike
  //    `BrowserContext.storageState({ path })`, does not create the parent
  //    directory — it only ever worked locally because an earlier UI-driven
  //    spec (auth.spec.ts) happened to create `.auth/` first.
  // 2. `request.newContext()` inherits a default `storageState` from the
  //    nearest `test.use({ storageState: ... })` in this file (the several
  //    describe-scoped ones below), even when called from this file-scope
  //    `beforeAll` before any test has run — so without an explicit
  //    `storageState: undefined` override, Playwright tries to *read* that
  //    file before this hook has had a chance to create it, and throws
  //    ENOENT on the very first login.
  mkdirSync('.auth', { recursive: true });

  adminApi = await request.newContext({ baseURL: API_URL, storageState: undefined });
  await loginAs(adminApi, 'admin@email.com', 'admin123', '.auth/admin.json');
  adminCsrfToken = await readCsrfToken(adminApi);

  const staffApi = await request.newContext({ baseURL: API_URL, storageState: undefined });
  await loginAs(staffApi, 'staff@email.com', 'staff123', '.auth/staff.json');
  await staffApi.dispose();

  const regularApi = await request.newContext({ baseURL: API_URL, storageState: undefined });
  await registerRegularUser(regularApi, '.auth/regular-user.json');
  await regularApi.dispose();
});

test.afterAll(async () => {
  await adminApi.dispose();
});

// Sweep after every test, regardless of describe block — idempotent and
// role-independent, so a test that fails mid-flow cannot leak a fixture row
// into the next test under `workers: 1` (design.md).
test.afterEach(async () => {
  await sweepFixtureProducts();
});

// Cold-start note: this describe runs first (alphabetically first spec
// file), so its first `page.goto('/admin/products')` is very likely the
// dev server's first-ever request for this route AND for the page's
// client-side `<script>` module. Astro/Vite transform that module
// on-demand on first request, which can occasionally exceed the default
// 5s expect timeout even though `page.goto()` itself already returned —
// the gating logic runs from that separately-fetched module, not the
// initial HTML. A generous per-assertion timeout absorbs that one-time
// cost without slowing already-warm runs (expect resolves as soon as the
// condition holds).
const VISIBILITY_TIMEOUT = { timeout: 15000 };

test.describe('Admin Products - Role-Based Visibility', () => {
  test.describe('ADMIN', () => {
    test.use({ storageState: '.auth/admin.json' });

    test('sees the admin products area', async ({ page }) => {
      await page.goto('/admin/products');
      await expect(page.locator('#admin-products-content')).toBeVisible(VISIBILITY_TIMEOUT);
      await expect(page.locator('#admin-gate-denied')).toBeHidden(VISIBILITY_TIMEOUT);
    });
  });

  test.describe('STAFF', () => {
    test.use({ storageState: '.auth/staff.json' });

    test('sees the admin products area', async ({ page }) => {
      await page.goto('/admin/products');
      await expect(page.locator('#admin-products-content')).toBeVisible(VISIBILITY_TIMEOUT);
      await expect(page.locator('#admin-gate-denied')).toBeHidden(VISIBILITY_TIMEOUT);
    });
  });

  test.describe('Regular USER', () => {
    test.use({ storageState: '.auth/regular-user.json' });

    test('does not see the admin products area', async ({ page }) => {
      await page.goto('/admin/products');
      await expect(page.locator('#admin-gate-denied')).toBeVisible(VISIBILITY_TIMEOUT);
      await expect(page.locator('#admin-products-content')).toBeHidden(VISIBILITY_TIMEOUT);
    });
  });

  test('Guest does not see the admin products area', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page.locator('#admin-gate-denied')).toBeVisible(VISIBILITY_TIMEOUT);
    await expect(page.locator('#admin-products-content')).toBeHidden(VISIBILITY_TIMEOUT);
  });
});

test.describe('Admin Products - Delete Restricted to Admin', () => {
  let product: { idProduct: number; nameProduct: string };

  test.beforeEach(async () => {
    product = await createFixtureProduct();
  });

  test('STAFF row has no delete action; ADMIN row does', async ({ browser }) => {
    const staffContext = await browser.newContext({ storageState: '.auth/staff.json' });
    const staffPage = await staffContext.newPage();
    await staffPage.goto('/admin/products');
    await expect(row(staffPage, product.nameProduct)).toBeVisible();
    await expect(row(staffPage, product.nameProduct).locator('.admin-product-delete')).toHaveCount(0);
    await staffContext.close();

    const adminContext = await browser.newContext({ storageState: '.auth/admin.json' });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/admin/products');
    await expect(row(adminPage, product.nameProduct).locator('.admin-product-delete')).toBeVisible();
    await adminContext.close();
  });
});

test.describe('Admin Products - CRUD Lifecycle', () => {
  test.use({ storageState: '.auth/admin.json' });

  test('Create a product persists and appears in the list', async ({ page }) => {
    const nameProduct = fixtureName();
    await page.goto('/admin/products/create');
    await expect(page.locator('#admin-create-content')).toBeVisible();

    await page.fill('#nameProduct', nameProduct);
    await page.fill('#price', '1500');
    await page.fill('#descriptionProduct', 'E2E create test');
    await page.fill('#idCategory', '1');
    await page.fill('#idFranchise', '1');
    // A valid material must be supplied: CreateProductUseCase forwards an
    // empty string verbatim (`material ?? null` only replaces null/
    // undefined, not ''), and the domain Product entity then rejects any
    // non-null material that isn't in ALLOWED_MATERIALS — pre-existing
    // behavior, unrelated to this test-only change.
    await page.fill('#material', 'PLA');
    await page.fill('#stock', '3');
    await page.setInputFiles('#image', FIXTURE_IMAGE);

    await page.click('#create-btn');

    await expect(page).toHaveURL('/admin/products');
    await expect(row(page, nameProduct)).toBeVisible();
  });

  test('Edit a product persists and reflects the updated field', async ({ page }) => {
    const product = await createFixtureProduct();
    const updatedName = fixtureName();

    await page.goto(`/admin/products/edit?id=${product.idProduct}`);
    await expect(page.locator('#admin-edit-content')).toBeVisible();

    await page.fill('#nameProduct', updatedName);
    // Same pre-existing empty-material bug as the create test above — the
    // edit form always submits a `material` field, so it must be non-empty.
    await page.fill('#material', 'PLA');
    await page.click('#edit-btn');

    await expect(page).toHaveURL('/admin/products');
    await expect(row(page, updatedName)).toBeVisible();
  });

  test('Delete with confirm accepted removes the row', async ({ page }) => {
    const product = await createFixtureProduct();

    await page.goto('/admin/products');
    const productRow = row(page, product.nameProduct);
    await expect(productRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await productRow.locator('.admin-product-delete').click();

    await expect(row(page, product.nameProduct)).toHaveCount(0);
  });

  test('Delete with confirm dismissed leaves the row intact and fires no DELETE', async ({ page }) => {
    const product = await createFixtureProduct();

    let deleteRequested = false;
    await page.route(`**/api/products/${product.idProduct}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequested = true;
      }
      await route.continue();
    });

    await page.goto('/admin/products');
    const productRow = row(page, product.nameProduct);
    await expect(productRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.dismiss());
    await productRow.locator('.admin-product-delete').click();

    await expect(productRow).toBeVisible();
    expect(deleteRequested).toBe(false);
  });
});

test.describe('Admin Products - Stock Adjust Client-Side Double-Click Guard', () => {
  test.use({ storageState: '.auth/admin.json' });

  test('a double-click while a stock request is in flight has no additional effect', async ({ page }) => {
    const product = await createFixtureProduct({ stock: 5 });

    let patchCount = 0;
    let releaseHold: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });

    await page.route('**/api/products/*/stock', async (route) => {
      patchCount += 1;
      await held;
      await route.continue();
    });

    await page.goto('/admin/products');
    const productRow = row(page, product.nameProduct);
    await expect(productRow).toBeVisible();

    const plusBtn = productRow.locator('.admin-product-stock-plus');

    // A real double-click: applyDelta() disables the button synchronously
    // inside the first click's listener, so the browser drops the second
    // click on a disabled control — reproducing exactly what a user's
    // double-click does (design.md rejects dispatchEvent/waitForTimeout for
    // this reason).
    await plusBtn.dblclick();

    await expect(plusBtn).toBeDisabled();
    await expect.poll(() => patchCount).toBe(1);

    releaseHold();

    await expect(productRow.locator('.admin-product-stock')).toHaveText('6');
    expect(patchCount).toBe(1);
  });
});

test.describe('Admin Products - 401 Mid-Session Redirect', () => {
  test.use({ storageState: '.auth/admin.json' });

  test('a 401 on a mutating action clears the session and redirects to /login silently', async ({ page }) => {
    const product = await createFixtureProduct();

    await page.route('**/api/products/*/stock', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/admin/products');
    const productRow = row(page, product.nameProduct);
    await expect(productRow).toBeVisible();

    let dialogShown = false;
    page.on('dialog', async (dialog) => {
      dialogShown = true;
      await dialog.dismiss();
    });

    await productRow.locator('.admin-product-stock-plus').click();

    await expect(page).toHaveURL('/login');
    expect(dialogShown).toBe(false);
  });
});
