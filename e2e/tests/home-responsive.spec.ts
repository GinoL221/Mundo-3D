import { expect, test, type Page } from '@playwright/test';
import { installHomeProductFixtures } from '../fixtures/homeProducts.js';

type MatrixCase = {
  name: string;
  width: number;
  height: number;
  columns: number;
  compactNavigation: boolean;
};

const themes = ['light', 'dark'] as const;
const representativeVisualViewports = new Set(['320', '640', '768x1024', '1024x768', '1440']);

type Theme = (typeof themes)[number];

const matrix: MatrixCase[] = [
  { name: '320', width: 320, height: 800, columns: 2, compactNavigation: true },
  { name: '360', width: 360, height: 800, columns: 2, compactNavigation: true },
  { name: '375', width: 375, height: 800, columns: 2, compactNavigation: true },
  { name: '639', width: 639, height: 800, columns: 2, compactNavigation: true },
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

async function openHome(page: Page, viewport: MatrixCase, theme: Theme): Promise<void> {
  await installHomeProductFixtures(page);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript((selectedTheme) => localStorage.setItem('theme', selectedTheme), theme);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.home-product-card')).toHaveCount(6);
  await expect(page.locator('.home-product-card').first()).toBeVisible();
  await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';

    await Promise.all([document.fonts.ready, ...images.map((image) => image.decode())]);
    for (const image of images) {
      if (!image.complete || image.naturalWidth === 0) {
        throw new Error(`Home image failed to load: ${image.currentSrc || image.src}`);
      }
    }
  });
}

test.describe('Home responsive contract (fixed Chromium rendering)', () => {
  for (const viewport of matrix.flatMap((item) => themes.map((theme) => ({ ...item, theme })))) {
    const testName =
      viewport.theme === 'light'
        ? `Home responsive contract at ${viewport.name}`
        : `Home responsive contract in dark theme at ${viewport.name}`;
    test(testName, async ({ page }, testInfo) => {
      expect(testInfo.project.name).toBe('chromium');
      await openHome(page, viewport, viewport.theme);

      const metrics = await page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>('.home-products__grid');
        const card = document.querySelector<HTMLElement>('.home-product-card');
        const productTarget = document.querySelector<HTMLElement>('.home-product-card__link');
        const header = document.querySelector<HTMLElement>('.home-header__inner');
        const main = document.querySelector<HTMLElement>('.home-hero__inner');
        const footer = document.querySelector<HTMLElement>('.home-footer__inner');
        const footerTop = document.querySelector<HTMLElement>('.home-footer__top');
        const footerBrand = document.querySelector<HTMLElement>('.home-footer__brand');
        const footerColumns = [...document.querySelectorAll<HTMLElement>('.home-footer__column')];
        const footerBottom = document.querySelector<HTMLElement>('.home-footer__bottom');
        const footerCopyright = document.querySelector<HTMLElement>('.home-footer__copyright');
        const heroCopy = document.querySelector<HTMLElement>('.home-hero__copy');
        const featured = document.querySelector<HTMLElement>('.hero-specimen');
        const body = document.querySelector<HTMLElement>('.home-hero__description');
        const heading = document.querySelector<HTMLElement>('.home-hero__title');
        const logo = [
          ...document.querySelectorAll<HTMLImageElement>('.home-header__logo img'),
        ].find((image) => image.getBoundingClientRect().width > 0);
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
          !footerTop ||
          !footerBrand ||
          footerColumns.length !== 3 ||
          !footerBottom ||
          !footerCopyright ||
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

        const footerTopStyle = getComputedStyle(footerTop);
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
          footerTopDisplay: footerTopStyle.display,
          footerTopColumns: footerTopStyle.gridTemplateColumns.trim().split(/\s+/).length,
          footerColumnCount: footerColumns.length,
          footerLinkTargets: [...footer.querySelectorAll('.home-footer__links a')].map((link) =>
            link.getBoundingClientRect(),
          ),
          footerSocialTargets: [...footer.querySelectorAll('.home-footer__social-link')].map(
            (link) => link.getBoundingClientRect(),
          ),
          footerCopyrightRect: footerCopyright.getBoundingClientRect(),
          footerCopyrightLineHeight: Number.parseFloat(getComputedStyle(footerCopyright).lineHeight),
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
      if (viewport.width >= 640) {
        expect(metrics.cardWidth).toBeGreaterThanOrEqual(280);
      } else {
        expect(metrics.cardWidth).toBeGreaterThanOrEqual(130);
      }
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

      expect(metrics.footerTopDisplay).toBe('grid');
      expect(metrics.footerColumnCount).toBe(3);

      if (viewport.width < 640) {
        expect(metrics.footerTopColumns).toBe(1);
      } else if (viewport.width < 1024) {
        expect(metrics.footerTopColumns).toBe(2);
      } else {
        expect(metrics.footerTopColumns).toBe(4);
      }

      expect(metrics.footerLinkTargets).toHaveLength(9);
      for (const target of metrics.footerLinkTargets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      expect(metrics.footerSocialTargets).toHaveLength(1);
      for (const target of metrics.footerSocialTargets) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      if (viewport.width >= 640) {
        expect(metrics.footerCopyrightRect.height).toBeLessThanOrEqual(
          metrics.footerCopyrightLineHeight + 2,
        );
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
      await expect(page.locator('#navbar-cart-trigger')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#navbar-cart-menu')).toBeHidden();
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

      // Structural checks cover every boundary; photographic baselines sample each layout mode with a runner-antialiasing-only pixel cap.
      if (representativeVisualViewports.has(viewport.name)) {
        const screenshot =
          viewport.theme === 'light'
            ? `home-responsive-${viewport.name}.png`
            : `home-responsive-${viewport.name}-dark.png`;
        await expect(page).toHaveScreenshot(screenshot, {
          fullPage: true,
          threshold: 0.4,
          maxDiffPixels: 2000,
        });
      }
    });
  }
});
