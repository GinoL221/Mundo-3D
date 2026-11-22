import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCanonicalProductUrl,
  buildShareLinks,
  setupProductShare,
  type ShareDocumentLike,
  type ShareElements,
} from './productShare';

class FakeNode {
  hidden = false;
  textContent: string | null = '';
  value = '';
  href = '';
  focusCount = 0;
  selectCount = 0;
  attributes = new Map<string, string>();
  children: FakeNode[] = [];
  listeners = new Map<string, Array<(event: Event) => void>>();

  append(...nodes: FakeNode[]): void {
    this.children.push(...nodes);
  }

  contains(target: unknown): boolean {
    if (target === this) return true;
    return this.children.some((child) => child.contains(target));
  }

  focus(): void {
    this.focusCount += 1;
  }

  select(): void {
    this.selectCount += 1;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((entry) => entry !== listener),
    );
  }

  dispatch(type: string, event: Partial<Event & KeyboardEvent> = {}): void {
    const fullEvent = {
      type,
      target: this,
      preventDefault: vi.fn(),
      ...event,
    } as unknown as Event;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(fullEvent);
    }
  }
}

class FakeDocument implements ShareDocumentLike {
  listeners = new Map<string, Array<(event: Event) => void>>();
  execCommand?: (commandId: string) => boolean;

  addEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((entry) => entry !== listener),
    );
  }

  dispatch(type: string, event: Partial<Event & KeyboardEvent> = {}): void {
    const fullEvent = {
      type,
      preventDefault: vi.fn(),
      ...event,
    } as unknown as Event;
    for (const listener of this.listeners.get(type) ?? []) {
      listener(fullEvent);
    }
  }
}

function createFixture() {
  const anchor = new FakeNode();
  const triggerButton = new FakeNode();
  const panel = new FakeNode();
  const closeButton = new FakeNode();
  const summaryEl = new FakeNode();
  const urlInput = new FakeNode();
  const copyButton = new FakeNode();
  const whatsappLink = new FakeNode();
  const emailLink = new FakeNode();
  const nativeButton = new FakeNode();
  const statusEl = new FakeNode();
  const outsideTarget = new FakeNode();
  const doc = new FakeDocument();

  panel.append(closeButton, summaryEl, urlInput, copyButton, whatsappLink, emailLink, nativeButton, statusEl);
  anchor.append(triggerButton, panel);

  const elements: ShareElements = {
    anchor,
    triggerButton,
    panel,
    closeButton,
    summaryEl,
    urlInput,
    copyButton,
    whatsappLink,
    emailLink,
    nativeButton,
    statusEl,
  };

  return {
    anchor,
    triggerButton,
    panel,
    closeButton,
    summaryEl,
    urlInput,
    copyButton,
    whatsappLink,
    emailLink,
    nativeButton,
    statusEl,
    outsideTarget,
    doc,
    elements,
  };
}

describe('productShare', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('builds canonical product URLs and encoded WhatsApp/email share links', () => {
    const url = buildCanonicalProductUrl(42, 'https://mundo3d.com.ar/');
    expect(url).toBe('https://mundo3d.com.ar/product?id=42');

    const encodedIdUrl = buildCanonicalProductUrl('a b&1', 'http://localhost:4321');
    expect(encodedIdUrl).toBe('http://localhost:4321/product?id=a%20b%261');

    const links = buildShareLinks({
      name: 'Cubo de Compañía',
      priceLabel: '$ 12.500',
      url,
    });

    expect(links.text).toBe('Mirá "Cubo de Compañía" ($ 12.500) en Mundo 3D:');
    expect(links.whatsappUrl).toBe(
      `https://wa.me/?text=${encodeURIComponent(
        'Mirá "Cubo de Compañía" ($ 12.500) en Mundo 3D: https://mundo3d.com.ar/product?id=42',
      )}`,
    );
    expect(links.emailUrl).toBe(
      `mailto:?subject=${encodeURIComponent('Cubo de Compañía — Mundo 3D')}&body=${encodeURIComponent(
        'Mirá "Cubo de Compañía" ($ 12.500) en Mundo 3D:\nhttps://mundo3d.com.ar/product?id=42',
      )}`,
    );
  });

  it('toggles panel, updates aria-expanded, focuses copy button on open, and restores focus on close/Escape', () => {
    const fx = createFixture();
    const cleanup = setupProductShare(
      fx.elements,
      { productId: 1, name: 'Mario Bros', priceLabel: '$ 15.000' },
      { origin: 'http://localhost:4321', navigator: {}, document: fx.doc },
    );

    expect(fx.panel.hidden).toBe(true);
    expect(fx.triggerButton.getAttribute('aria-expanded')).toBe('false');
    expect(fx.urlInput.value).toBe('http://localhost:4321/product?id=1');
    expect(fx.summaryEl.textContent).toBe('Mario Bros · $ 15.000');

    // Open via trigger button
    fx.statusEl.textContent = 'Estado previo';
    fx.triggerButton.dispatch('click');
    expect(fx.panel.hidden).toBe(false);
    expect(fx.triggerButton.getAttribute('aria-expanded')).toBe('true');
    expect(fx.statusEl.textContent).toBe('');
    expect(fx.copyButton.focusCount).toBe(1);

    // Close via Escape restores focus to trigger
    const preventDefault = vi.fn();
    fx.doc.dispatch('keydown', { key: 'Escape', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(fx.panel.hidden).toBe(true);
    expect(fx.triggerButton.getAttribute('aria-expanded')).toBe('false');
    expect(fx.triggerButton.focusCount).toBe(1);

    // Re-open and close via close button restores focus to trigger
    fx.triggerButton.dispatch('click');
    expect(fx.panel.hidden).toBe(false);
    fx.closeButton.dispatch('click');
    expect(fx.panel.hidden).toBe(true);
    expect(fx.triggerButton.getAttribute('aria-expanded')).toBe('false');
    expect(fx.triggerButton.focusCount).toBe(2);

    // Re-open and close via trigger toggle
    fx.triggerButton.dispatch('click');
    expect(fx.panel.hidden).toBe(false);
    fx.triggerButton.dispatch('click');
    expect(fx.panel.hidden).toBe(true);
    expect(fx.triggerButton.getAttribute('aria-expanded')).toBe('false');

    // Re-open and dismiss by clicking outside the utility anchor (without stealing focus)
    fx.triggerButton.dispatch('click');
    expect(fx.panel.hidden).toBe(false);
    fx.doc.dispatch('click', { target: fx.copyButton as unknown as EventTarget });
    expect(fx.panel.hidden).toBe(false);
    fx.doc.dispatch('click', { target: fx.outsideTarget as unknown as EventTarget });
    expect(fx.panel.hidden).toBe(true);
    expect(fx.triggerButton.getAttribute('aria-expanded')).toBe('false');
    expect(fx.triggerButton.focusCount).toBe(2);

    cleanup();
  });

  it('copies URL via clipboard API, shows confirmation for 2s, and resets cleanly on close', async () => {
    vi.useFakeTimers();
    const fx = createFixture();
    const writeText = vi.fn().mockResolvedValue(undefined);

    const cleanup = setupProductShare(
      fx.elements,
      { productId: 7, name: 'Dragón', priceLabel: '$ 22.000' },
      {
        origin: 'https://mundo3d.ar',
        navigator: { clipboard: { writeText } },
        document: fx.doc,
      },
    );

    fx.triggerButton.dispatch('click');
    fx.copyButton.dispatch('click');
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://mundo3d.ar/product?id=7');
    });

    expect(fx.copyButton.textContent).toBe('Copiado');
    expect(fx.statusEl.textContent).toBe('Enlace copiado al portapapeles.');

    vi.advanceTimersByTime(2000);
    expect(fx.copyButton.textContent).toBe('Copiar');

    // Closing while confirmation is active resets button text immediately
    fx.copyButton.dispatch('click');
    await vi.waitFor(() => {
      expect(fx.copyButton.textContent).toBe('Copiado');
    });
    fx.closeButton.dispatch('click');
    expect(fx.copyButton.textContent).toBe('Copiar');

    cleanup();
  });

  it('falls back to selecting the URL input and execCommand when clipboard fails or is unavailable', async () => {
    const fx = createFixture();
    const writeText = vi.fn().mockRejectedValue(new Error('Denied'));
    fx.doc.execCommand = vi.fn().mockReturnValue(false);

    const cleanup = setupProductShare(
      fx.elements,
      { productId: 9, name: 'Llavero', priceLabel: '$ 3.500' },
      {
        origin: 'http://localhost:4321',
        navigator: { clipboard: { writeText } },
        document: fx.doc,
      },
    );

    fx.triggerButton.dispatch('click');
    fx.copyButton.dispatch('click');
    await vi.waitFor(() => {
      expect(fx.statusEl.textContent).toBe(
        'No pudimos copiar automáticamente. Copiá el enlace seleccionado arriba.',
      );
    });

    expect(fx.urlInput.focusCount).toBe(1);
    expect(fx.urlInput.selectCount).toBe(1);
    expect(fx.doc.execCommand).toHaveBeenCalledWith('copy');
    expect(fx.copyButton.textContent).toBe('Copiar');

    // When execCommand succeeds after clipboard failure, show confirmation
    fx.doc.execCommand = vi.fn().mockReturnValue(true);
    fx.copyButton.dispatch('click');
    await vi.waitFor(() => {
      expect(fx.copyButton.textContent).toBe('Copiado');
    });
    expect(fx.statusEl.textContent).toBe('Enlace copiado al portapapeles.');

    cleanup();
  });

  it('shows native share button only when navigator.share is a function and handles success, AbortError, and failure', async () => {
    const fxWithoutNative = createFixture();
    const cleanup1 = setupProductShare(
      fxWithoutNative.elements,
      { productId: 1, name: 'Pieza', priceLabel: '$ 1.000' },
      { origin: 'http://localhost:4321', navigator: {}, document: fxWithoutNative.doc },
    );
    expect(fxWithoutNative.nativeButton.hidden).toBe(true);
    cleanup1();

    const fx = createFixture();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const cleanup2 = setupProductShare(
      fx.elements,
      { productId: 5, name: 'Casco', priceLabel: '$ 30.000' },
      { origin: 'http://localhost:4321', navigator: { share: shareMock }, document: fx.doc },
    );

    expect(fx.nativeButton.hidden).toBe(false);
    fx.triggerButton.dispatch('click');
    fx.nativeButton.dispatch('click');

    await vi.waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: 'Casco',
        text: 'Mirá "Casco" ($ 30.000) en Mundo 3D:',
        url: 'http://localhost:4321/product?id=5',
      });
      expect(fx.statusEl.textContent).toBe('Enlace compartido.');
    });

    // AbortError is ignored silently
    fx.statusEl.textContent = '';
    const abortError = new Error('User cancelled');
    abortError.name = 'AbortError';
    shareMock.mockRejectedValueOnce(abortError);
    fx.nativeButton.dispatch('click');
    await vi.waitFor(() => expect(shareMock).toHaveBeenCalledTimes(2));
    expect(fx.statusEl.textContent).toBe('');

    // Other errors display fallback guidance
    shareMock.mockRejectedValueOnce(new Error('Share failed'));
    fx.nativeButton.dispatch('click');
    await vi.waitFor(() => {
      expect(fx.statusEl.textContent).toBe(
        'No pudimos abrir el menú del sistema. Podés copiar el enlace arriba.',
      );
    });

    cleanup2();
  });
});
