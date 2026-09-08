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
    const [heading, , , link, disabled, customDisabled, loading, , error, status] =
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
      if (!action || !textAction || !disabled || !customDisabled || !prose) {
        throw new Error('Foundation fixture is incomplete.');
      }

      action.focus();
      const actionStyle = getComputedStyle(action);
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
          outline: actionStyle.outlineStyle,
          outlineWidth: actionStyle.outlineWidth,
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
    expect(metrics.action).toMatchObject({ outline: 'solid', outlineWidth: '3px' });
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
  });
}
