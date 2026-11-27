import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isDemoSessionActive: vi.fn(),
  hydrateDemoSession: vi.fn(),
  isDemoSessionPendingHydration: vi.fn(),
  listMyCustomCommissionRequests: vi.fn(),
  fetchProducts: vi.fn(),
}));

vi.mock('../config', () => ({
  DEMO_SESSION_EVENT: 'demo-session-changed',
  getSessionUser: mocks.getSessionUser,
  isDemoSessionActive: mocks.isDemoSessionActive,
  hydrateDemoSession: mocks.hydrateDemoSession,
  isOperationalRole: (user: { idRole: number } | null) =>
    user?.idRole === Role.ADMIN || user?.idRole === Role.STAFF,
}));

vi.mock('../lib/http/demoSessionState', () => ({
  isDemoSessionPendingHydration: mocks.isDemoSessionPendingHydration,
}));

vi.mock('../domains/commissions/services/customCommissionRequest.service', () => ({
  listMyCustomCommissionRequests: mocks.listMyCustomCommissionRequests,
}));

vi.mock('../domains/products/services/product.service', () => ({
  fetchProducts: mocks.fetchProducts,
}));

import { buildMyCommissionItemViewModel, initializeMyCommissions } from './myCommissions';

class FakeClassList {
  private tokens = new Set<string>();

  constructor(initial = '') {
    this.setFromString(initial);
  }

  setFromString(value: string) {
    this.tokens.clear();
    for (const part of value.split(/\s+/).filter(Boolean)) {
      this.tokens.add(part);
    }
  }

  contains(item: string): boolean {
    return this.tokens.has(item);
  }
}

class FakeElement {
  id = '';
  tagName: string;
  private _className = '';
  classList = new FakeClassList();
  textContent = '';
  hidden = false;
  disabled = false;
  href = '';
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(tagName: string, id = '', className = '') {
    this.tagName = tagName.toLowerCase();
    this.id = id;
    this.className = className;
  }

  get className(): string {
    return this._className;
  }

  set className(value: string) {
    this._className = value;
    this.classList.setFromString(value);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    if (name === 'href') return this.href || null;
    return this.attributes.get(name) ?? null;
  }

  append(...nodes: FakeElement[]) {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]) {
    this.children = [...nodes];
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  click() {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({ target: this } as unknown as Event);
    }
  }

  findAll(predicate: (el: FakeElement) => boolean): FakeElement[] {
    const matches: FakeElement[] = [];
    for (const child of this.children) {
      if (predicate(child)) matches.push(child);
      matches.push(...child.findAll(predicate));
    }
    return matches;
  }
}

class FakeDocument {
  private byId = new Map<string, FakeElement>();

  constructor() {
    const ids = [
      ['section', 'my-commissions-region'],
      ['div', 'my-commissions-loading'],
      ['div', 'my-commissions-guest'],
      ['div', 'my-commissions-operational'],
      ['div', 'my-commissions-error'],
      ['p', 'my-commissions-error-text'],
      ['button', 'my-commissions-retry'],
      ['div', 'my-commissions-empty'],
      ['ul', 'my-commissions-list'],
    ] as const;

    for (const [tag, id] of ids) {
      const el = new FakeElement(tag, id);
      if (id !== 'my-commissions-region' && id !== 'my-commissions-loading') {
        el.hidden = true;
      }
      this.byId.set(id, el);
    }
  }

  getElementById(id: string): FakeElement | null {
    return this.byId.get(id) ?? null;
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

describe('myCommissions', () => {
  beforeEach(() => {
    mocks.getSessionUser.mockReset();
    mocks.isDemoSessionActive.mockReset().mockReturnValue(false);
    mocks.hydrateDemoSession.mockReset().mockResolvedValue({ status: 'inactive' });
    mocks.isDemoSessionPendingHydration.mockReset().mockReturnValue(false);
    mocks.listMyCustomCommissionRequests.mockReset();
    mocks.fetchProducts.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds item view models with trimmed optional phone and "Enviada" date phrasing', () => {
    const vm = buildMyCommissionItemViewModel(
      {
        idCustomCommissionRequest: 9,
        name: 'Demo Buyer',
        email: 'buyer@example.test',
        phone: '  +54 9 11 0000-0101  ',
        idea: 'Figura escala 18 cm',
        idProduct: 1,
        createdAt: '2026-11-27T12:00:00.000Z',
        expiresAt: '2026-12-27T12:00:00.000Z',
      },
      new Map([[1, 'Soporte Groot']]),
      { timeZone: 'UTC' },
    );

    expect(vm).toEqual({
      id: 9,
      requesterName: 'Demo Buyer',
      emailLabel: 'buyer@example.test',
      phoneLabel: '+54 9 11 0000-0101',
      datesLabel: 'Enviada el 27/11/2026 · Vence el 27/12/2026',
      idea: 'Figura escala 18 cm',
      piece: {
        kind: 'link',
        idProduct: 1,
        href: '/product?id=1',
        label: 'Pieza: Soporte Groot',
      },
    });
  });

  it('shows guest CTA without calling the API when unauthenticated', async () => {
    mocks.getSessionUser.mockReturnValue(null);
    const doc = new FakeDocument();

    await initializeMyCommissions(doc as unknown as Document);

    expect(doc.getElementById('my-commissions-guest')?.hidden).toBe(false);
    expect(doc.getElementById('my-commissions-loading')?.hidden).toBe(true);
    expect(mocks.listMyCustomCommissionRequests).not.toHaveBeenCalled();
  });

  it('shows operational notice for STAFF and ADMIN with zero API requests (no 403)', async () => {
    for (const idRole of [Role.STAFF, Role.ADMIN]) {
      mocks.getSessionUser.mockReturnValue({ idRole });
      const doc = new FakeDocument();

      await initializeMyCommissions(doc as unknown as Document);

      expect(doc.getElementById('my-commissions-operational')?.hidden).toBe(false);
      expect(doc.getElementById('my-commissions-list')?.hidden).toBe(true);
      expect(mocks.listMyCustomCommissionRequests).not.toHaveBeenCalled();
    }
  });

  it('renders populated buyer requests with plain-text phone (no tel: link) and hydrated product name', async () => {
    mocks.getSessionUser.mockReturnValue({ idRole: Role.USER });
    mocks.listMyCustomCommissionRequests.mockResolvedValue({
      ok: true,
      requests: [
        {
          idCustomCommissionRequest: 15,
          name: 'Demo Buyer',
          email: 'buyer@sandbox.invalid',
          phone: '+54 9 11 0000-0101',
          idea: 'Quiero una variante mate de 20 cm.',
          idProduct: 1,
          createdAt: '2026-11-27T12:00:00.000Z',
          expiresAt: '2026-12-27T12:00:00.000Z',
        },
        {
          idCustomCommissionRequest: 16,
          name: 'Demo Buyer',
          email: 'buyer@sandbox.invalid',
          phone: null,
          idea: 'Soporte personalizado para auriculares.',
          idProduct: null,
          createdAt: '2026-11-26T12:00:00.000Z',
          expiresAt: '2026-12-26T12:00:00.000Z',
        },
      ],
    });
    mocks.fetchProducts.mockResolvedValue({
      ok: true,
      products: [{ id: 1, name: 'Soporte Groot' }],
    });

    const doc = new FakeDocument();
    await initializeMyCommissions(doc as unknown as Document);
    await Promise.resolve();

    const list = doc.getElementById('my-commissions-list')!;
    expect(list.hidden).toBe(false);
    expect(list.children).toHaveLength(2);

    const phones = list.findAll((el) => el.classList.contains('ui-inbox__phone'));
    expect(phones).toHaveLength(1);
    expect(phones[0]?.tagName).toBe('span');
    expect(phones[0]?.textContent).toBe('Tel: +54 9 11 0000-0101');

    const links = list.findAll((el) => el.tagName === 'a');
    expect(links.map((el) => el.href)).toEqual(['/product?id=1']);
    expect(links[0]?.textContent).toBe('Pieza: Soporte Groot');
  });

  it('renders empty state when buyer has no requests', async () => {
    mocks.getSessionUser.mockReturnValue({ idRole: Role.USER });
    mocks.listMyCustomCommissionRequests.mockResolvedValue({ ok: true, requests: [] });

    const doc = new FakeDocument();
    await initializeMyCommissions(doc as unknown as Document);

    expect(doc.getElementById('my-commissions-empty')?.hidden).toBe(false);
    expect(doc.getElementById('my-commissions-list')?.hidden).toBe(true);
  });

  it('shows error state and retries when clicking Reintentar', async () => {
    mocks.getSessionUser.mockReturnValue({ idRole: Role.USER });
    mocks.listMyCustomCommissionRequests
      .mockResolvedValueOnce({ ok: false, code: 'ERROR', message: 'Servicio caído' })
      .mockResolvedValueOnce({ ok: true, requests: [] });

    const doc = new FakeDocument();
    await initializeMyCommissions(doc as unknown as Document);

    expect(doc.getElementById('my-commissions-error')?.hidden).toBe(false);
    expect(doc.getElementById('my-commissions-error-text')?.textContent).toBe('Servicio caído');

    doc.getElementById('my-commissions-retry')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.listMyCustomCommissionRequests).toHaveBeenCalledTimes(2);
    expect(doc.getElementById('my-commissions-empty')?.hidden).toBe(false);
  });

  it('shows demo-expired error copy on 401 while demo session was active', async () => {
    mocks.getSessionUser.mockReturnValue({ idRole: Role.USER, isDemo: true });
    mocks.isDemoSessionActive.mockReturnValue(true);
    mocks.listMyCustomCommissionRequests.mockResolvedValue({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Expired',
    });

    const doc = new FakeDocument();
    await initializeMyCommissions(doc as unknown as Document);

    expect(doc.getElementById('my-commissions-error')?.hidden).toBe(false);
    expect(doc.getElementById('my-commissions-error-text')?.textContent).toMatch(/sesión demo expiró/i);
  });
});
