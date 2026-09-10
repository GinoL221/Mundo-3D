import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { homeProducts, installHomeProductFixtures } from '../fixtures/homeProducts.js';

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

async function openHome(page: Page, width: number, height: number): Promise<void> {
  await installHomeProductFixtures(page);
  await page.setViewportSize({ width, height });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.home-product-card').first()).toBeVisible();
}

async function openNonHome(page: Page, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/aboutUs', { waitUntil: 'domcontentloaded' });
}

function expectSharedShell(page: Page): Promise<void[]> {
  return Promise.all([
    expect(page.locator('body')).toHaveClass(/home-shell/),
    expect(page.locator('.home-header')).toBeVisible(),
    expect(page.locator('.home-footer')).toBeVisible(),
    expect(page.locator('.home-header__search')).toHaveCount(0),
    expect(page.getByPlaceholder('Búsqueda próximamente')).toHaveCount(0),
    expect(page.locator('.navbar')).toHaveCount(0),
    expect(page.locator('.footer')).toHaveCount(0),
  ]);
}

test.describe('Home responsive remediation evidence', () => {
  test('falls back to fewer columns when a 1024px Home grid has constrained available width', async ({
    page,
  }) => {
    await openHome(page, 1024, 800);

    const metrics = await page.locator('.home-products__grid').evaluate((grid) => {
      (grid as HTMLElement).style.width = '600px';
      const card = grid.querySelector<HTMLElement>('.home-product-card');
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
        cardWidth: card?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(metrics.columns).toBeLessThan(3);
    expect(metrics.cardWidth).toBeGreaterThanOrEqual(280);
  });

  test('uses the shared visual shell on a non-Home route at 1920px', async ({ page }) => {
    await openNonHome(page, 1920);
    await expectSharedShell(page);

    const widths = await page
      .locator('.home-header__inner, .about-content, .home-footer__inner')
      .evaluateAll((containers) =>
        containers.map((container) => container.getBoundingClientRect().width),
      );
    expect(widths).toHaveLength(3);
    expect(widths.every((width) => width <= 1440)).toBe(true);
  });

  test('uses the responsive shared shell on a non-Home route below 1024px', async ({ page }) => {
    await openNonHome(page, 800);
    await expectSharedShell(page);
    const hasNoOverflow = await page
      .locator('html')
      .evaluate((element) => element.scrollWidth <= window.innerWidth);
    expect(hasNoOverflow).toBe(true);
  });

  test('keeps the 1023/1024 navigation boundary in portrait orientation', async ({ page }) => {
    await openHome(page, 1023, 1024);
    await expect(page.locator('#home-menu-toggle')).toBeVisible();
    await expect(page.locator('#home-primary-navigation')).toBeHidden();

    await openHome(page, 1024, 1024);
    await expect(page.locator('#home-menu-toggle')).toBeHidden();
    await expect(page.locator('#home-primary-navigation')).toBeVisible();
  });

  test('observes the existing Home loading state before its product request settles', async ({
    page,
  }) => {
    let releaseProducts: (() => void) | undefined;
    const productsPending = new Promise<void>((resolve) => {
      releaseProducts = resolve;
    });

    await page.route('**/api/products/latest', (route) =>
      route.fulfill({ headers: jsonHeaders, body: JSON.stringify(homeProducts[0]) }),
    );
    await page.route('**/api/products', async (route) => {
      await productsPending;
      await route.fulfill({
        headers: jsonHeaders,
        body: JSON.stringify({ products: homeProducts }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#home-loading-msg')).toBeVisible();

    releaseProducts?.();
    await expect(page.locator('.home-product-card')).toHaveCount(homeProducts.length);
  });

  test('documents 44px as a local product policy distinct from the WCAG AA minimum', async () => {
    const policy = await readFile(
      new URL(
        '../../openspec/changes/archive/2026-09-07-home-responsive-system/research.md',
        import.meta.url,
      ),
      'utf8',
    );

    expect(policy).toContain('24x24` CSS pixels is the SC 2.5.8 Level AA minimum');
    expect(policy).toContain('44x44` is the SC 2.5.5 Level AAA target');
    expect(policy).toContain('A local `44x44` policy is stricter guidance');
  });
});
