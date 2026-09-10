import { expect, test, type Page } from '@playwright/test';
import { installHomeProductFixtures } from '../fixtures/homeProducts.js';

type MatrixCase = {
  name: string;
  width: number;
  height: number;
  columns: number;
  compactNavigation: boolean;
};

const representativeVisualViewports = new Set(['320', '640', '768x1024', '1024x768', '1440']);

const matrix: MatrixCase[] = [
  { name: '320', width: 320, height: 800, columns: 1, compactNavigation: true },
  { name: '360', width: 360, height: 800, columns: 1, compactNavigation: true },
  { name: '375', width: 375, height: 800, columns: 1, compactNavigation: true },
  { name: '639', width: 639, height: 800, columns: 1, compactNavigation: true },
  { name: '640', width: 640, height: 800, columns: 2, compactNavigation: true },
  { name: '768x1024', width: 768, height: 1024, columns: 2, compactNavigation: true },
  { name: '820', width: 820, height: 800, columns: 2, compactNavigation: true },
  { name: '960', width: 960, height: 800, columns: 2, compactNavigation: true },
  { name: '1023', width: 1023, height: 800, columns: 2, compactNavigation: true },
  { name: '1024x768', width: 1024, height: 768, columns: 3, compactNavigation: false },
  { name: '1279', width: 1279, height: 800, columns: 3, compactNavigation: false },
  { name: '1280', width: 1280, height: 800, columns: 3, compactNavigation: false },
  { name: '1440', width: 1440, height: 900, columns: 3, compactNavigation: false },
];

test.use({
  colorScheme: 'light',
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
  locale: 'es-AR',
  timezoneId: 'UTC',
});

async function openHome(page: Page, viewport: MatrixCase): Promise<void> {
  await installHomeProductFixtures(page);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const settleWithin = async (promise: Promise<unknown>): Promise<void> => {
      await Promise.race([promise, new Promise((resolve) => window.setTimeout(resolve, 5_000))]);
    };

    await settleWithin(document.fonts.ready);
    await Promise.all(
      [...document.images]
        .filter((image) =>
          image.currentSrc.startsWith(`${window.location.origin}/images/illustrations/`),
        )
        .map((image) => settleWithin(image.decode().catch(() => undefined))),
    );
  });
  await expect(page.locator('.home-product-card').first()).toBeVisible();
}

test.describe('Home responsive contract (fixed Chromium rendering)', () => {
  for (const viewport of matrix) {
    test(`Home responsive contract at ${viewport.name}`, async ({ page }, testInfo) => {
      expect(testInfo.project.name).toBe('chromium');
      await openHome(page, viewport);

      const metrics = await page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>('.home-products__grid');
        const card = document.querySelector<HTMLElement>('.home-product-card');
        const productTarget = document.querySelector<HTMLElement>('.home-product-card__link');
        const header = document.querySelector<HTMLElement>('.home-header__inner');
        const main = document.querySelector<HTMLElement>('.home-hero__inner');
        const footer = document.querySelector<HTMLElement>('.home-footer__inner');
        const footerBrand = document.querySelector<HTMLElement>('.home-footer__brand');
        const footerLinks = document.querySelector<HTMLElement>('.home-footer__links');
        const footerEnd = document.querySelector<HTMLElement>('.home-footer__end');
        const heroCopy = document.querySelector<HTMLElement>('.home-hero__copy');
        const featured = document.querySelector<HTMLElement>('.home-featured-card');
        const body = document.querySelector<HTMLElement>('.home-hero__description');
        const heading = document.querySelector<HTMLElement>('.home-hero__title');
        const logo = document.querySelector<HTMLImageElement>('.home-header__logo img');
        const menuToggle = document.querySelector<HTMLElement>('#home-menu-toggle');
        const menuIcon = document.querySelector<HTMLElement>('.home-header__menu-icon');
        const cart = document.querySelector<HTMLElement>('.home-header__cart');
        const cartIcon = document.querySelector<SVGElement>('.home-header__icon');
        if (
          !grid ||
          !card ||
          !productTarget ||
          !header ||
          !main ||
          !footer ||
          !footerBrand ||
          !footerLinks ||
          !footerEnd ||
          !heroCopy ||
          !featured ||
          !body ||
          !heading ||
          !logo ||
          !menuToggle ||
          !menuIcon ||
          !cart ||
          !cartIcon
        ) {
          throw new Error('Home responsive contract elements are missing.');
        }

        const footerStyle = getComputedStyle(footer);
        return {
          columns: getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
          cardWidth: card.getBoundingClientRect().width,
          target: productTarget.getBoundingClientRect(),
          frames: [header, main, footer].map((element) => element.getBoundingClientRect()),
          heroDirection: getComputedStyle(main).flexDirection,
          heroCopy: heroCopy.getBoundingClientRect(),
          featured: featured.getBoundingClientRect(),
          bodySize: Number.parseFloat(getComputedStyle(body).fontSize),
          proseMaxWidth: Number.parseFloat(getComputedStyle(body).maxWidth),
          headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
          logo: logo.getBoundingClientRect(),
          logoFit: getComputedStyle(logo).objectFit,
          footerDisplay: footerStyle.display,
          footerGridTemplateAreas: footerStyle.gridTemplateAreas,
          footerGridAreas: {
            brand: getComputedStyle(footerBrand).gridArea,
            links: getComputedStyle(footerLinks).gridArea,
            end: getComputedStyle(footerEnd).gridArea,
          },
          footerFlex: {
            brand: getComputedStyle(footerBrand).flex,
            links: getComputedStyle(footerLinks).flex,
            end: getComputedStyle(footerEnd).flex,
          },
          footerEndDirection: getComputedStyle(footerEnd).flexDirection,
          footerEndAlignItems: getComputedStyle(footerEnd).alignItems,
          footerLinksTop: [...footerLinks.querySelectorAll('a')].map(
            (link) => link.getBoundingClientRect().top,
          ),
          footerSocialTargets: [...footer.querySelectorAll('.home-footer__social-link')].map(
            (link) => link.getBoundingClientRect(),
          ),
          footerSocialTop: [...footer.querySelectorAll('.home-footer__social-link')].map(
            (link) => link.getBoundingClientRect().top,
          ),
          menuButton: menuToggle.getBoundingClientRect(),
          menuIcon: menuIcon.getBoundingClientRect(),
          cart: cart.getBoundingClientRect(),
          cartIcon: cartIcon.getBoundingClientRect(),
          menuAlignItems: getComputedStyle(menuToggle).alignItems,
          menuJustifyContent: getComputedStyle(menuToggle).justifyContent,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });

      expect(metrics.columns).toBe(viewport.columns);
      expect(metrics.cardWidth).toBeGreaterThanOrEqual(280);
      expect(metrics.target.width).toBeGreaterThanOrEqual(44);
      expect(metrics.target.height).toBeGreaterThanOrEqual(44);
      expect(metrics.bodySize).toBeGreaterThanOrEqual(16);
      expect(metrics.proseMaxWidth).toBeLessThanOrEqual(metrics.bodySize * 75);
      expect(metrics.headingSize).toBeGreaterThanOrEqual(32);
      expect(metrics.headingSize).toBeLessThanOrEqual(40);
      expect(metrics.logo.width).toBeGreaterThan(0);
      expect(metrics.logo.height).toBeGreaterThan(0);
      expect(metrics.logoFit).toBe('contain');
      expect(metrics.overflow).toBe(false);

      if (viewport.width < 768) {
        expect(metrics.heroDirection).toBe('column');
      } else {
        expect(metrics.heroDirection).toBe('row');
        expect(metrics.heroCopy.right).toBeLessThanOrEqual(metrics.featured.left + 1);
        expect(metrics.heroCopy.bottom).toBeGreaterThan(metrics.featured.top);
        expect(metrics.heroCopy.top).toBeLessThan(metrics.featured.bottom);
      }

      if (viewport.width < 640) {
        expect(metrics.footerFlex).toEqual({
          brand: '0 1 auto',
          links: '0 1 auto',
          end: '0 1 auto',
        });
      }

      if (viewport.width >= 640 && viewport.width < 768) {
        expect(metrics.footerDisplay).toBe('grid');
        expect(metrics.footerGridTemplateAreas).toBe('"brand end" "links links"');
        expect(metrics.footerGridAreas).toEqual({ brand: 'brand', links: 'links', end: 'end' });
      }

      if (viewport.width >= 768 && viewport.width < 1024) {
        expect(metrics.footerDisplay).toBe('grid');
        expect(metrics.footerGridTemplateAreas).toBe('"brand links end"');
        expect(metrics.footerGridAreas).toEqual({ brand: 'brand', links: 'links', end: 'end' });
        expect(metrics.footerEndDirection).toBe('row');
        expect(metrics.footerEndAlignItems).toBe('center');
      }

      if (viewport.width >= 640 && viewport.width < 1024) {
        expect(new Set(metrics.footerLinksTop.map((top) => Math.round(top))).size).toBe(1);
        expect(new Set(metrics.footerSocialTop.map((top) => Math.round(top))).size).toBe(1);
        for (const target of metrics.footerSocialTargets) {
          expect(target.width).toBeGreaterThanOrEqual(44);
          expect(target.height).toBeGreaterThanOrEqual(44);
        }
      }

      if (viewport.compactNavigation) {
        expect(metrics.menuButton.width).toBeGreaterThanOrEqual(44);
        expect(metrics.menuButton.height).toBeGreaterThanOrEqual(44);
        expect(metrics.menuAlignItems).toBe('center');
        expect(metrics.menuJustifyContent).toBe('center');
        expect(
          Math.abs(
            metrics.cart.left +
              metrics.cart.width / 2 -
              (metrics.cartIcon.left + metrics.cartIcon.width / 2),
          ),
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(
            metrics.menuButton.left +
              metrics.menuButton.width / 2 -
              (metrics.menuIcon.left + metrics.menuIcon.width / 2),
          ),
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(
            metrics.menuButton.top +
              metrics.menuButton.height / 2 -
              (metrics.menuIcon.top + metrics.menuIcon.height / 2),
          ),
        ).toBeLessThanOrEqual(0.5);
      }

      for (const frame of metrics.frames) {
        expect(frame.width).toBeLessThanOrEqual(1104);
        expect(frame.left).toBeGreaterThanOrEqual(0);
        expect(frame.right).toBeLessThanOrEqual(viewport.width);
      }

      const toggle = page.locator('#home-menu-toggle');
      const navigation = page.locator('#home-primary-navigation');
      await expect(toggle).toHaveAttribute('aria-controls', 'home-primary-navigation');
      await expect(navigation).not.toHaveAttribute('role', 'menu');
      await expect(navigation.locator('a').first()).not.toHaveAttribute('role', 'menuitem');
      if (viewport.compactNavigation) {
        await expect(toggle).toBeVisible();
        await expect(navigation).toBeHidden();
        await toggle.focus();
        const focusStyles = await toggle.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            outlineOffset: style.outlineOffset,
          };
        });
        expect(focusStyles).toEqual({
          outlineStyle: 'solid',
          outlineWidth: '3px',
          outlineOffset: '2px',
        });
        await toggle.evaluate((element) => element.blur());
      } else {
        await expect(toggle).toBeHidden();
        await expect(navigation).toBeVisible();
      }

      // Structural checks cover every boundary; photographic full-page baselines sample each layout mode.
      if (representativeVisualViewports.has(viewport.name)) {
        await expect(page).toHaveScreenshot(`home-responsive-${viewport.name}.png`, {
          fullPage: true,
          threshold: 0.4,
        });
      }
    });
  }
});
