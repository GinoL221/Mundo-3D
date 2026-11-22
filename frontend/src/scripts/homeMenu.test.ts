import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeHomeMenu } from './homeMenu';

class FakeElement {
  hidden = false;
  attributes = new Map<string, string>();
  classNames = new Set<string>();
  containedElements = new Set<FakeElement>();
  focusCount = 0;
  listeners = new Map<string, (event: Event) => void>();
  querySelectorResult: FakeElement | null = null;

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  classList = {
    toggle: (name: string, force: boolean) => {
      if (force) this.classNames.add(name);
      else this.classNames.delete(name);
    },
    contains: (name: string) => this.classNames.has(name),
  };

  contains(element: FakeElement) {
    return this.containedElements.has(element);
  }

  querySelector(selector: string) {
    return selector === 'a' ? this.querySelectorResult : null;
  }

  focus() {
    this.focusCount += 1;
  }

  click() {
    this.listeners.get('click')?.({ target: this } as unknown as Event);
  }

  activateWithKeyboard(key: string) {
    this.listeners.get('click')?.({ key, target: this } as unknown as Event);
  }
}

class FakeMediaQueryList {
  listeners = new Set<(event: Event) => void>();

  constructor(public matches: boolean) {}

  addEventListener(type: string, listener: (event: Event) => void) {
    if (type === 'change') this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (type === 'change') this.listeners.delete(listener);
  }

  setMatches(matches: boolean) {
    this.matches = matches;
    for (const listener of this.listeners) listener({} as Event);
  }
}

class FakeDocument {
  elements = new Map<string, FakeElement>();
  listeners = new Map<string, (event: Event) => void>();
  defaultView: Window | null = null;

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  getElementById(id: string) {
    return this.elements.get(id) ?? null;
  }
}

function createFixture(compact = true) {
  const document = new FakeDocument();
  const toggle = new FakeElement();
  const menu = new FakeElement();
  const firstLink = new FakeElement();
  const outside = new FakeElement();
  menu.querySelectorResult = firstLink;
  menu.containedElements.add(firstLink);
  toggle.setAttribute('aria-controls', 'home-primary-navigation');
  document.elements.set('home-menu-toggle', toggle);
  document.elements.set('home-primary-navigation', menu);
  const mediaQuery = new FakeMediaQueryList(compact);
  const matchMedia = vi.fn(() => mediaQuery);
  document.defaultView = {
    matchMedia,
  } as unknown as Window;
  return { document, toggle, menu, firstLink, outside, mediaQuery, matchMedia };
}

afterEach(() => vi.restoreAllMocks());

describe('initializeHomeMenu', () => {
  it('opens and closes the primary navigation with the button state', () => {
    const fixture = createFixture();
    initializeHomeMenu(fixture.document as unknown as Document);

    expect(fixture.toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.toggle.getAttribute('aria-label')).toBe('Abrir menú principal');
    expect(fixture.menu.hidden).toBe(true);

    fixture.toggle.click();

    expect(fixture.toggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.toggle.getAttribute('aria-label')).toBe('Cerrar menú principal');
    expect(fixture.menu.classList.contains('is-open')).toBe(true);
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.firstLink.focusCount).toBe(1);

    fixture.toggle.click();
    expect(fixture.toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.menu.classList.contains('is-open')).toBe(false);
    expect(fixture.menu.hidden).toBe(true);
  });

  it('closes on Escape, restores focus, and ignores clicks inside the menu', () => {
    const fixture = createFixture();
    initializeHomeMenu(fixture.document as unknown as Document);
    fixture.toggle.click();

    fixture.document.listeners.get('click')?.({ target: fixture.firstLink } as unknown as Event);
    expect(fixture.menu.classList.contains('is-open')).toBe(true);

    const preventDefault = vi.fn();
    fixture.document.listeners.get('keydown')?.({ key: 'Escape', preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(fixture.menu.classList.contains('is-open')).toBe(false);
    expect(fixture.toggle.focusCount).toBe(1);
  });

  it('closes on outside click and removes listeners during cleanup', () => {
    const fixture = createFixture();
    const cleanup = initializeHomeMenu(fixture.document as unknown as Document);
    fixture.toggle.click();

    fixture.document.listeners.get('click')?.({ target: fixture.outside } as unknown as Event);
    expect(fixture.menu.classList.contains('is-open')).toBe(false);

    cleanup();
    expect(fixture.toggle.listeners.has('click')).toBe(false);
    expect(fixture.document.listeners.has('keydown')).toBe(false);
    expect(fixture.document.listeners.has('click')).toBe(false);
  });

  it('closes when focus leaves the non-modal disclosure', () => {
    const fixture = createFixture();
    initializeHomeMenu(fixture.document as unknown as Document);
    fixture.toggle.click();

    fixture.document.listeners.get('focusin')?.({ target: fixture.outside } as unknown as Event);

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.toggle.focusCount).toBe(0);
  });

  it('keeps the navigation exposed on desktop', () => {
    const fixture = createFixture(false);

    initializeHomeMenu(fixture.document as unknown as Document);

    expect(fixture.menu.hidden).toBe(false);
  });

  it('uses compact navigation through tablet widths', () => {
    const fixture = createFixture();
    initializeHomeMenu(fixture.document as unknown as Document);

    expect(fixture.matchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
    expect(fixture.menu.hidden).toBe(true);
  });

  it.each(['Enter', ' '])('opens through native %s button activation', (key) => {
    const fixture = createFixture();
    initializeHomeMenu(fixture.document as unknown as Document);

    // Native buttons emit click for Enter and Space; the disclosure owns click state.
    fixture.toggle.activateWithKeyboard(key);

    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the control relation stable and resets disclosure state at the 1023/1024 boundary', () => {
    const fixture = createFixture();
    const cleanup = initializeHomeMenu(fixture.document as unknown as Document);
    const controls = fixture.toggle.getAttribute('aria-controls');
    fixture.toggle.click();

    fixture.mediaQuery.setMatches(false);
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.toggle.getAttribute('aria-controls')).toBe(controls);

    fixture.mediaQuery.setMatches(true);
    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.toggle.getAttribute('aria-controls')).toBe('home-primary-navigation');

    cleanup();
    expect(fixture.mediaQuery.listeners).toHaveLength(0);
  });

  it('places guest account links inside the mobile drawer on compact viewports and restores them to utility on desktop', () => {
    const fixture = createFixture(true);
    const utilityChildren: FakeElement[] = [];
    const menuChildren: FakeElement[] = [];
    const cartWrap = new FakeElement();
    const accountSection = new FakeElement();
    const themeButton = new FakeElement();

    const utility = new FakeElement();
    const makeParent = (owner: FakeElement, list: FakeElement[], otherList?: FakeElement[]) => ({
      appendChild(child: FakeElement & { parentElement?: unknown }) {
        child.parentElement = owner;
        if (otherList) {
          const oldIdx = otherList.indexOf(child);
          if (oldIdx !== -1) otherList.splice(oldIdx, 1);
        }
        if (!list.includes(child)) list.push(child);
        return child;
      },
      insertBefore(child: FakeElement & { parentElement?: unknown }, ref: FakeElement | null) {
        child.parentElement = owner;
        if (otherList) {
          const oldIdx = otherList.indexOf(child);
          if (oldIdx !== -1) otherList.splice(oldIdx, 1);
        }
        const existingIdx = list.indexOf(child);
        if (existingIdx !== -1) list.splice(existingIdx, 1);
        const refIdx = ref ? list.indexOf(ref) : -1;
        if (refIdx === -1) list.push(child);
        else list.splice(refIdx, 0, child);
        return child;
      },
      prepend(child: FakeElement & { parentElement?: unknown }) {
        child.parentElement = owner;
        if (otherList) {
          const oldIdx = otherList.indexOf(child);
          if (oldIdx !== -1) otherList.splice(oldIdx, 1);
        }
        const existingIdx = list.indexOf(child);
        if (existingIdx !== -1) list.splice(existingIdx, 1);
        list.unshift(child);
      },
    });

    Object.assign(utility, makeParent(utility, utilityChildren, menuChildren));
    Object.assign(fixture.menu, makeParent(fixture.menu, menuChildren, utilityChildren));

    const cartWithSibling = cartWrap as FakeElement & {
      parentElement: FakeElement;
      nextSibling: FakeElement | null;
    };
    cartWithSibling.parentElement = utility;
    Object.defineProperty(cartWithSibling, 'nextSibling', {
      get() {
        const idx = utilityChildren.indexOf(cartWrap);
        return idx >= 0 ? (utilityChildren[idx + 1] ?? null) : null;
      },
    });
    const acctWithParent = Object.assign(accountSection, { parentElement: utility });
    utilityChildren.push(cartWithSibling, acctWithParent, themeButton);

    Object.assign(fixture.document, {
      querySelector: (selector: string) => {
        if (selector === '.home-header__account-section') return acctWithParent;
        if (selector === '.home-header__utility') return utility;
        if (selector === '.home-header__cart-wrap') return cartWithSibling;
        return null;
      },
    });

    const cleanup = initializeHomeMenu(fixture.document as unknown as Document);
    expect(acctWithParent.parentElement).toBe(fixture.menu);
    expect(menuChildren).toContain(acctWithParent);

    fixture.mediaQuery.setMatches(false);
    expect(acctWithParent.parentElement).toBe(utility);
    expect(utilityChildren).toEqual([cartWithSibling, acctWithParent, themeButton]);

    fixture.mediaQuery.setMatches(true);
    expect(acctWithParent.parentElement).toBe(fixture.menu);

    cleanup();
  });
});
