import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';
import { CustomCommissionRequestAdminApiError } from '../domains/commissions/services/customCommissionRequest.admin.service';

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  clearSession: vi.fn(),
  listCustomCommissionRequests: vi.fn(),
  fetchProducts: vi.fn(),
}));

vi.mock('../domains/auth', () => ({
  getSessionUser: mocks.getSessionUser,
  clearSession: mocks.clearSession,
  hasAdminAccess: (user: { idRole: number } | null) =>
    user?.idRole === Role.ADMIN || user?.idRole === Role.STAFF,
}));

vi.mock('../domains/commissions/services/customCommissionRequest.admin.service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../domains/commissions/services/customCommissionRequest.admin.service')
    >();
  return {
    CustomCommissionRequestAdminApiError: actual.CustomCommissionRequestAdminApiError,
    listCustomCommissionRequests: mocks.listCustomCommissionRequests,
  };
});

vi.mock('../domains/products/services/product.service', () => ({
  fetchProducts: mocks.fetchProducts,
}));

import { initializeAdminCommissionRequests } from './adminCommissionRequests';

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

  add(...items: string[]) {
    for (const item of items) this.tokens.add(item);
  }

  remove(...items: string[]) {
    for (const item of items) this.tokens.delete(item);
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
  style: Record<string, string> = {};
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

  append(...nodes: Array<FakeElement | string>) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const span = new FakeElement('span');
        span.textContent = node;
        this.children.push(span);
      } else {
        this.children.push(node);
      }
    }
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
    const badge = new FakeElement('span', 'admin-role-badge', 'ui-badge');
    badge.hidden = true;
    const scope = new FakeElement('p', 'admin-requests-scope', 'ui-page-head__scope');
    scope.hidden = true;
    const denied = new FakeElement('div', 'admin-gate-denied', 'ui-callout');
    denied.hidden = true;
    const content = new FakeElement('section', 'admin-requests-content');
    content.hidden = true;
    const loading = new FakeElement('div', 'admin-requests-loading', 'ui-state');
    const error = new FakeElement('div', 'admin-requests-error', 'ui-callout ui-callout--danger');
    error.hidden = true;
    const errorText = new FakeElement('p', 'admin-requests-error-text', 'ui-callout__text');
    const retry = new FakeElement('button', 'admin-requests-retry', 'ui-btn');
    const empty = new FakeElement('div', 'admin-requests-empty', 'ui-state ui-state--empty');
    empty.hidden = true;
    const list = new FakeElement('ul', 'admin-requests-list', 'ui-inbox');
    list.hidden = true;

    for (const el of [badge, scope, denied, content, loading, error, errorText, retry, empty, list]) {
      this.byId.set(el.id, el);
    }
  }

  getElementById(id: string): FakeElement | null {
    return this.byId.get(id) ?? null;
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

function createWindowMock() {
  const location = {
    href: '/admin/commission-requests',
    assign(url: string) {
      location.href = url;
    },
  };
  return { location };
}

describe('initializeAdminCommissionRequests', () => {
  beforeEach(() => {
    mocks.getSessionUser.mockReset();
    mocks.clearSession.mockReset().mockResolvedValue(undefined);
    mocks.listCustomCommissionRequests.mockReset();
    mocks.fetchProducts.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('denies anonymous and USER sessions without firing any protected or catalog request', async () => {
    for (const user of [null, { idUser: 2, firstName: 'U', lastName: 'U', idRole: Role.USER }]) {
      mocks.getSessionUser.mockReturnValue(user);
      const doc = new FakeDocument();
      const win = createWindowMock();

      await initializeAdminCommissionRequests(
        doc as unknown as Document,
        win as unknown as Window,
      );

      expect(doc.getElementById('admin-gate-denied')?.hidden).toBe(false);
      expect(doc.getElementById('admin-requests-content')?.hidden).toBe(true);
      expect(doc.getElementById('admin-role-badge')?.hidden).toBe(true);
      expect(doc.getElementById('admin-requests-scope')?.hidden).toBe(true);
      expect(mocks.listCustomCommissionRequests).not.toHaveBeenCalled();
      expect(mocks.fetchProducts).not.toHaveBeenCalled();
    }
  });

  it('renders STAFF badge, inbox items with mailto, dates, piece link, and "Sin pieza asociada"', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 3,
      firstName: 'Sol',
      lastName: 'Staff',
      idRole: Role.STAFF,
    });
    mocks.listCustomCommissionRequests.mockResolvedValue([
      {
        idCustomCommissionRequest: 10,
        name: 'Lucía Fernández',
        email: 'lucia@ejemplo.com',
        idea: 'Quiero dos figuras de 18 cm.',
        idProduct: 1,
        createdAt: '2026-04-12T12:00:00.000Z',
        expiresAt: '2026-05-12T12:00:00.000Z',
      },
      {
        idCustomCommissionRequest: 11,
        name: 'Tomás Roldán',
        email: 'tomas@ejemplo.com',
        idea: 'Soporte para dos joysticks.',
        idProduct: null,
        createdAt: '2026-04-08T12:00:00.000Z',
        expiresAt: '2026-05-08T12:00:00.000Z',
      },
    ]);
    mocks.fetchProducts.mockResolvedValue({
      ok: true,
      products: [{ id: 1, name: 'Mario Bros Coleccionable' }],
    });

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );
    await Promise.resolve();

    const badge = doc.getElementById('admin-role-badge')!;
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('STAFF');
    expect(badge.classList.contains('ui-badge--staff')).toBe(true);

    expect(doc.getElementById('admin-requests-scope')?.hidden).toBe(false);
    expect(doc.getElementById('admin-requests-content')?.hidden).toBe(false);
    expect(doc.getElementById('admin-requests-loading')?.hidden).toBe(true);

    const list = doc.getElementById('admin-requests-list')!;
    expect(list.hidden).toBe(false);
    expect(list.children).toHaveLength(2);

    const links = list.findAll((el) => el.tagName === 'a');
    expect(links.map((el) => el.href)).toEqual([
      'mailto:lucia@ejemplo.com',
      '/product?id=1',
      'mailto:tomas@ejemplo.com',
    ]);
    expect(links[1]?.textContent).toBe('Pieza: Mario Bros Coleccionable');

    const muted = list.findAll((el) => el.classList.contains('ui-inbox__muted'));
    expect(muted.map((el) => el.textContent)).toEqual(['Sin pieza asociada']);
  });

  it('renders empty state when the API returns an empty array', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 1,
      firstName: 'Ana',
      lastName: 'Admin',
      idRole: Role.ADMIN,
    });
    mocks.listCustomCommissionRequests.mockResolvedValue([]);

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );

    const badge = doc.getElementById('admin-role-badge')!;
    expect(badge.textContent).toBe('ADMIN');
    expect(badge.classList.contains('ui-badge--admin')).toBe(true);
    expect(doc.getElementById('admin-requests-empty')?.hidden).toBe(false);
    expect(doc.getElementById('admin-requests-list')?.hidden).toBe(true);
  });

  it('shows error state and reloads when clicking Reintentar', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 1,
      firstName: 'Ana',
      lastName: 'Admin',
      idRole: Role.ADMIN,
    });
    mocks.listCustomCommissionRequests
      .mockRejectedValueOnce(new CustomCommissionRequestAdminApiError(500, 'Server error'))
      .mockResolvedValueOnce([]);

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );

    expect(doc.getElementById('admin-requests-error')?.hidden).toBe(false);
    expect(doc.getElementById('admin-requests-loading')?.hidden).toBe(true);

    doc.getElementById('admin-requests-retry')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.listCustomCommissionRequests).toHaveBeenCalledTimes(2);
    expect(doc.getElementById('admin-requests-error')?.hidden).toBe(true);
    expect(doc.getElementById('admin-requests-empty')?.hidden).toBe(false);
  });

  it('remains silent without calling clearSession, showing an error callout, or re-enabling retry on 401', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 3,
      firstName: 'Sol',
      lastName: 'Staff',
      idRole: Role.STAFF,
    });
    mocks.listCustomCommissionRequests.mockRejectedValue(
      new CustomCommissionRequestAdminApiError(401, 'Unauthorized'),
    );

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );

    expect(mocks.clearSession).not.toHaveBeenCalled();
    expect(win.location.href).toBe('/admin/commission-requests');
    expect(doc.getElementById('admin-requests-error')?.hidden).toBe(true);
    expect(doc.getElementById('admin-requests-retry')?.disabled).toBe(true);
  });

  it('skips the catalog lookup when no request references a product', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 3,
      firstName: 'Sol',
      lastName: 'Staff',
      idRole: Role.STAFF,
    });
    mocks.listCustomCommissionRequests.mockResolvedValue([
      {
        idCustomCommissionRequest: 21,
        name: 'Tomás Roldán',
        email: 'tomas@ejemplo.com',
        idea: 'Soporte para dos joysticks.',
        idProduct: null,
        createdAt: '2026-04-08T12:00:00.000Z',
        expiresAt: '2026-05-08T12:00:00.000Z',
      },
    ]);

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );

    expect(doc.getElementById('admin-requests-list')?.hidden).toBe(false);
    expect(mocks.fetchProducts).not.toHaveBeenCalled();
  });

  it('shows the error callout with recovery text on unexpected errors', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 1,
      firstName: 'Ana',
      lastName: 'Admin',
      idRole: Role.ADMIN,
    });
    mocks.listCustomCommissionRequests.mockRejectedValue(new Error('Unexpected response format'));

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );

    expect(doc.getElementById('admin-requests-error')?.hidden).toBe(false);
    expect(doc.getElementById('admin-requests-error-text')?.textContent).toBe(
      'El servicio no respondió a tiempo. Volvé a intentar en unos segundos.',
    );
    expect(doc.getElementById('admin-requests-empty')?.hidden).toBe(true);
  });

  it('renders unsafe emails as plain text instead of mailto links while keeping normal emails linked', async () => {
    mocks.getSessionUser.mockReturnValue({
      idUser: 1,
      firstName: 'Ana',
      lastName: 'Admin',
      idRole: Role.ADMIN,
    });
    mocks.listCustomCommissionRequests.mockResolvedValue([
      {
        idCustomCommissionRequest: 30,
        name: 'Payload Test',
        email: 'a?cc=evil%40x.com&body=hi@ejemplo.com',
        idea: 'Prueba de seguridad.',
        idProduct: null,
        createdAt: '2026-04-12T12:00:00.000Z',
        expiresAt: '2026-05-12T12:00:00.000Z',
      },
      {
        idCustomCommissionRequest: 31,
        name: 'Ana Pérez',
        email: 'ana.perez+taller@ejemplo.com',
        idea: 'Figura normal.',
        idProduct: null,
        createdAt: '2026-04-12T12:00:00.000Z',
        expiresAt: '2026-05-12T12:00:00.000Z',
      },
    ]);

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(
      doc as unknown as Document,
      win as unknown as Window,
    );

    const list = doc.getElementById('admin-requests-list')!;
    const links = list.findAll((el) => el.tagName === 'a');
    expect(links.map((el) => el.href)).toEqual(['mailto:ana.perez+taller@ejemplo.com']);

    const muted = list.findAll((el) => el.classList.contains('ui-inbox__muted'));
    expect(muted.map((el) => el.textContent)).toContain(
      'a?cc=evil%40x.com&body=hi@ejemplo.com',
    );
  });

  it('hydrates pending demo STAFF session in a new tab instead of locking on denied', async () => {
    vi.stubGlobal('document', { cookie: 'm3d_demo_csrf=demo.tok' });
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            active: true,
            role: 'STAFF',
            user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 'staff@demo.invalid' },
            lease: {},
          }),
          { status: 200 },
        ),
      ),
    );
    mocks.getSessionUser
      .mockReturnValueOnce({ idUser: 1, firstName: 'Demo', lastName: 'Buyer', idRole: Role.USER, isDemo: true })
      .mockReturnValueOnce({ idUser: 2, firstName: 'Demo', lastName: 'Staff', idRole: Role.STAFF, isDemo: true });
    mocks.listCustomCommissionRequests.mockResolvedValue([]);

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(doc as unknown as Document, win as unknown as Window);

    expect(doc.getElementById('admin-gate-denied')?.hidden).toBe(true);
    expect(doc.getElementById('admin-requests-content')?.hidden).toBe(false);
    expect(doc.getElementById('admin-requests-empty')?.hidden).toBe(false);
  });

  it('unfreezes loading state and shows Spanish error when demo session expires with 401', async () => {
    vi.stubGlobal('document', { cookie: 'm3d_demo_csrf=demo.tok' });
    mocks.getSessionUser.mockReturnValue({
      idUser: 2,
      firstName: 'Demo',
      lastName: 'Staff',
      idRole: Role.STAFF,
      isDemo: true,
    });
    mocks.listCustomCommissionRequests.mockRejectedValue(
      new CustomCommissionRequestAdminApiError(401, 'Unauthorized'),
    );

    const doc = new FakeDocument();
    const win = createWindowMock();

    await initializeAdminCommissionRequests(doc as unknown as Document, win as unknown as Window);

    const loading = doc.getElementById('admin-requests-loading')!;
    const retry = doc.getElementById('admin-requests-retry')!;
    const error = doc.getElementById('admin-requests-error')!;
    const errorText = doc.getElementById('admin-requests-error-text')!;

    expect(loading.hidden).toBe(true);
    expect(loading.getAttribute('aria-busy')).toBeNull();
    expect(retry.disabled).toBe(false);
    expect(error.hidden).toBe(false);
    expect(errorText.textContent).toMatch(/sesión demo expiró/i);
  });
});
