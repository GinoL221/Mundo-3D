import { expect, test, type Page } from '@playwright/test';

const themes = ['light', 'dark'] as const;

type Theme = (typeof themes)[number];

async function openHomeWithFoundationFixture(page: Page, theme: Theme): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    const fixture = document.createElement('div');
    fixture.className = 'system-frame';
    fixture.dataset.testFoundation = '';
    const section = document.createElement('section');
    section.className = 'system-section system-prose';
    section.setAttribute('aria-labelledby', 'foundation-title');
    const elements = [
      ['h1', 'Foundation contract', ''],
      ['p', 'Visible state meaning is not conveyed by color alone.', ''],
      ['button', 'Continue', 'system-action system-action--primary'],
      ['a', 'Learn more', 'system-action system-action--text'],
      ['button', 'Unavailable', 'system-action'],
      ['button', 'Unavailable custom', 'system-action'],
      ['p', 'Loading', 'system-state system-state--loading'],
      ['p', 'Nothing available', 'system-state system-state--empty'],
      ['p', 'Try again', 'system-state system-state--error'],
      ['p', 'Saved', 'system-state system-state--status'],
    ] as const;
    for (const [tag, text, className] of elements) {
      const element = document.createElement(tag);
      element.textContent = text;
      element.className = className;
      section.append(element);
    }
    const [heading, , action, link, disabled, customDisabled, loading, , error, status] =
      section.children;
    heading.id = 'foundation-title';
    link.setAttribute('href', '#foundation-title');
    disabled.setAttribute('disabled', '');
    customDisabled.setAttribute('aria-disabled', 'true');
    customDisabled.setAttribute('tabindex', '-1');
    loading.setAttribute('aria-busy', 'true');
    loading.setAttribute('role', 'status');
    error.setAttribute('role', 'alert');
    status.setAttribute('role', 'status');
    status.id = 'foundation-status';
    action.setAttribute('aria-controls', 'foundation-status');
    action.addEventListener('click', () => {
      status.textContent = 'Continued';
    });
    fixture.append(section);
    document.body.append(fixture);
  }, theme);
}

for (const theme of themes) {
  test(`exposes the opt-in foundation contract in ${theme} theme`, async ({ page }) => {
    await openHomeWithFoundationFixture(page, theme);

    const metrics = await page.locator('[data-test-foundation]').evaluate((fixture) => {
      const root = getComputedStyle(document.documentElement);
      const action = fixture.querySelector<HTMLElement>('.system-action--primary');
      const textAction = fixture.querySelector<HTMLElement>('.system-action--text');
      const disabled = fixture.querySelector<HTMLButtonElement>('button[disabled]');
      const customDisabled = fixture.querySelector<HTMLElement>('[aria-disabled="true"]');
      const prose = fixture.querySelector<HTMLElement>('.system-prose');
      const heading = fixture.querySelector<HTMLElement>('#foundation-title');
      const error = fixture.querySelector<HTMLElement>('.system-state--error');
      const status = fixture.querySelector<HTMLElement>('.system-state--status');
      if (
        !action ||
        !textAction ||
        !disabled ||
        !customDisabled ||
        !prose ||
        !heading ||
        !error ||
        !status
      ) {
        throw new Error('Foundation fixture is incomplete.');
      }

      const parseRgb = (value: string): [number, number, number] => {
        const match = value.match(/^rgba?\(([^)]+)\)$/);
        if (!match) throw new Error(`Unsupported computed color: ${value}`);
        const [red, green, blue] = match[1]
          .split(',')
          .slice(0, 3)
          .map((channel) => Number.parseFloat(channel));
        if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
          throw new Error(`Invalid computed color: ${value}`);
        }
        return [red, green, blue];
      };
      const relativeLuminance = ([red, green, blue]: [number, number, number]): number => {
        const toLinear = (channel: number): number => {
          const normalized = channel / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
      };
      const contrastRatio = (foreground: string, background: string): number => {
        const foregroundLuminance = relativeLuminance(parseRgb(foreground));
        const backgroundLuminance = relativeLuminance(parseRgb(background));
        const lighter = Math.max(foregroundLuminance, backgroundLuminance);
        const darker = Math.min(foregroundLuminance, backgroundLuminance);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const actionStyle = getComputedStyle(action);
      textAction.focus();
      const focusStyle = getComputedStyle(textAction);
      const pageBackground = getComputedStyle(document.body).backgroundColor;
      const errorStyle = getComputedStyle(error);
      const statusStyle = getComputedStyle(status);
      return {
        tokens: {
          page: root.getPropertyValue('--sys-page-bg').trim(),
          text: root.getPropertyValue('--sys-text').trim(),
          frame: root.getPropertyValue('--sys-frame-max').trim(),
          target: root.getPropertyValue('--sys-target-min').trim(),
        },
        frame: fixture.getBoundingClientRect().width,
        proseMax: Number.parseFloat(getComputedStyle(prose).maxWidth),
        action: {
          width: action.getBoundingClientRect().width,
          height: action.getBoundingClientRect().height,
          background: actionStyle.backgroundColor,
          color: actionStyle.color,
        },
        focus: {
          outline: focusStyle.outlineStyle,
          outlineWidth: focusStyle.outlineWidth,
          outlineColor: focusStyle.outlineColor,
        },
        textAction: {
          width: textAction.getBoundingClientRect().width,
          height: textAction.getBoundingClientRect().height,
          background: getComputedStyle(textAction).backgroundColor,
        },
        disabled: {
          disabled: disabled.disabled,
          opacity: getComputedStyle(disabled).opacity,
          cursor: getComputedStyle(disabled).cursor,
        },
        customDisabled: {
          ariaDisabled: customDisabled.getAttribute('aria-disabled'),
          tabIndex: customDisabled.tabIndex,
          opacity: getComputedStyle(customDisabled).opacity,
          cursor: getComputedStyle(customDisabled).cursor,
        },
        states: [...fixture.querySelectorAll<HTMLElement>('.system-state')].map((state) => ({
          text: state.textContent,
          role: state.getAttribute('role'),
          busy: state.getAttribute('aria-busy'),
          borderColor: getComputedStyle(state).borderColor,
        })),
        contrast: {
          text: contrastRatio(getComputedStyle(heading).color, pageBackground),
          mutedText: contrastRatio(getComputedStyle(prose).color, pageBackground),
          link: contrastRatio(getComputedStyle(textAction).color, pageBackground),
          primaryActionText: contrastRatio(actionStyle.color, actionStyle.backgroundColor),
          focusAgainstPage: contrastRatio(focusStyle.outlineColor, pageBackground),
          focusAgainstAction: contrastRatio(focusStyle.outlineColor, actionStyle.backgroundColor),
          errorBoundary: contrastRatio(errorStyle.borderColor, pageBackground),
          statusBoundary: contrastRatio(statusStyle.borderColor, pageBackground),
        },
      };
    });

    expect(metrics.tokens).toEqual({
      page: theme === 'light' ? '#f6f2ea' : '#1e1b18',
      text: theme === 'light' ? '#1e1b18' : '#f6f2ea',
      frame: '1104px',
      target: '44px',
    });
    expect(metrics.frame).toBeLessThanOrEqual(1104);
    expect(metrics.proseMax).toBe(750);
    expect(metrics.focus).toMatchObject({ outline: 'solid', outlineWidth: '3px' });
    expect(metrics.action.width).toBeGreaterThanOrEqual(44);
    expect(metrics.action.height).toBeGreaterThanOrEqual(44);
    expect(metrics.textAction.width).toBeGreaterThanOrEqual(44);
    expect(metrics.textAction.height).toBeGreaterThanOrEqual(44);
    expect(metrics.textAction.background).toBe('rgba(0, 0, 0, 0)');
    expect(metrics.disabled).toEqual({ disabled: true, opacity: '0.5', cursor: 'not-allowed' });
    expect(metrics.customDisabled).toEqual({
      ariaDisabled: 'true',
      tabIndex: -1,
      opacity: '0.5',
      cursor: 'not-allowed',
    });
    expect(metrics.states).toHaveLength(4);
    expect(metrics.states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Loading', role: 'status', busy: 'true' }),
        expect.objectContaining({ text: 'Nothing available', role: null, busy: null }),
        expect.objectContaining({ text: 'Try again', role: 'alert', busy: null }),
        expect.objectContaining({ text: 'Saved', role: 'status', busy: null }),
      ]),
    );
    expect(metrics.states.every((state) => state.borderColor !== 'rgba(0, 0, 0, 0)')).toBe(true);
    expect(metrics.contrast.text).toBeGreaterThanOrEqual(4.5);
    expect(metrics.contrast.mutedText).toBeGreaterThanOrEqual(4.5);
    expect(metrics.contrast.link).toBeGreaterThanOrEqual(4.5);
    expect(metrics.contrast.primaryActionText).toBeGreaterThanOrEqual(4.5);
    expect(metrics.contrast.focusAgainstPage).toBeGreaterThanOrEqual(3);
    expect(metrics.contrast.focusAgainstAction).toBeGreaterThanOrEqual(3);
    expect(metrics.contrast.errorBoundary).toBeGreaterThanOrEqual(3);
    expect(metrics.contrast.statusBoundary).toBeGreaterThanOrEqual(3);

    const primaryAction = page.locator('[data-test-foundation] .system-action--primary');
    await page.keyboard.press('Shift+Tab');
    await expect(primaryAction).toBeFocused();
    const keyboardFocus = await primaryAction.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(keyboardFocus).toEqual({ outline: 'solid', outlineWidth: '3px' });
    await page.keyboard.press('Enter');
    await expect(primaryAction).toHaveAttribute('aria-controls', 'foundation-status');
    await expect(page.locator('#foundation-status')).toHaveText('Continued');
    await expect(page.locator('#foundation-status')).toHaveAttribute('role', 'status');
  });
}

test('keeps real product and approved brand imagery normal while isolating Home placeholders', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const imageRendering = await page.evaluate(() => {
    const fixture = document.createElement('div');
    const createImage = (id: string, className = '', pixelArt = false): HTMLImageElement => {
      const image = document.createElement('img');
      image.id = id;
      image.className = className;
      image.src = '/img/brand/Mundo3D_Isotipo.png';
      if (pixelArt) image.dataset.imageRendering = 'pixel-art';
      fixture.append(image);
      return image;
    };

    const product = createImage('wave0-real-product');
    const brand = createImage('wave0-approved-brand');
    const canonicalPlaceholder = createImage('wave0-canonical-placeholder', '', true);
    const featuredPlaceholder = createImage(
      'wave0-featured-placeholder',
      'home-featured-card__image--placeholder',
    );
    const productPlaceholder = createImage(
      'wave0-product-placeholder',
      'home-product-card__image--placeholder',
    );
    document.body.append(fixture);

    const rendering = (image: HTMLImageElement): string => getComputedStyle(image).imageRendering;
    const result = {
      product: rendering(product),
      brand: rendering(brand),
      canonicalPlaceholder: rendering(canonicalPlaceholder),
      featuredPlaceholder: rendering(featuredPlaceholder),
      productPlaceholder: rendering(productPlaceholder),
    };
    canonicalPlaceholder.removeAttribute('data-image-rendering');

    return { ...result, markerRemoved: rendering(canonicalPlaceholder) };
  });

  expect(imageRendering).toEqual({
    product: 'auto',
    brand: 'auto',
    canonicalPlaceholder: 'pixelated',
    featuredPlaceholder: 'pixelated',
    productPlaceholder: 'pixelated',
    markerRemoved: 'auto',
  });
});
