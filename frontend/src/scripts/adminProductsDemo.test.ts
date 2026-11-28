import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';
import { ProductAdminApiError } from '../domains/products/services/product.admin.service';
import { DEMO_CSRF_COOKIE_NAME, DEMO_STORAGE_KEY } from '../lib/http/demoSessionState';

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  list: vi.fn(),
  adjustStock: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../domains/auth', () => ({
  getSessionUser: mocks.getSessionUser,
  hasAdminAccess: (u: { idRole: number } | null) =>
    u?.idRole === Role.ADMIN || u?.idRole === Role.STAFF,
  isAdminOnly: (u: { idRole: number } | null) => u?.idRole === Role.ADMIN,
}));
vi.mock('../domains/products', async () => {
  const { ProductAdminApiError: ApiErr } =
    await import('../domains/products/services/product.admin.service');
  return {
    ProductAdminApiError: ApiErr,
    ProductAdminService: {
      list: mocks.list,
      adjustStock: mocks.adjustStock,
      create: mocks.create,
      getById: mocks.getById,
      update: mocks.update,
      remove: mocks.remove,
    },
  };
});
vi.mock('../domains/products/admin/productAdminHelpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../domains/products/admin/productAdminHelpers')>()),
  validateProductForm: () => ({}),
  buildProductFormData: () => new FormData(),
}));
vi.mock('./adminProductsForm', () => ({
  applyAdminRoleHeader: vi.fn(),
  applyFormFieldErrors: vi.fn(),
  clearFormFieldErrors: vi.fn(),
  hideFormErrorBanner: (el: HTMLElement | null) => {
    if (el) el.hidden = true;
  },
  loadClassificationOptions: vi.fn().mockResolvedValue(undefined),
  navigateToInternalRoute: vi.fn(),
  readProductFormValues: () => ({}),
  showFormErrorBanner: (el: HTMLElement | null, msg: string) => {
    if (el) {
      el.hidden = false;
      el.textContent = msg;
    }
  },
  wireImagePickerPreview: () => () => undefined,
  wireMaterialToggle: () => () => undefined,
}));

import { initializeAdminProductsCreate } from './adminProductsCreate';
import { initializeAdminProductsEdit } from './adminProductsEdit';
import { initializeAdminProductsList } from './adminProductsList';

class FakeNode {
  hidden = true;
  disabled = false;
  textContent = '';
  attrs = new Map<string, string>();
  listeners = new Map<string, Array<(ev: Event) => void>>();
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  removeAttribute(k: string) {
    this.attrs.delete(k);
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null;
  }
  addEventListener(type: string, fn: (ev: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  replaceChildren() {}
  dispatch(type: string) {
    const ev = { preventDefault: vi.fn() } as unknown as Event;
    for (const fn of this.listeners.get(type) ?? []) fn(ev);
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const DEMO_STAFF = {
  idUser: 2,
  firstName: 'Demo',
  lastName: 'Staff',
  idRole: Role.STAFF,
  isDemo: true,
};
const STAFF_SESSION = {
  active: true,
  role: 'STAFF',
  user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 's@d.invalid' },
  lease: {},
};

function stubBrowser(ids: string[], cookie = '', search = '') {
  const byId = new Map(ids.map((id) => [id, new FakeNode()]));
  const store = new Map<string, string>();
  vi.stubGlobal('document', { cookie, getElementById: (id: string) => byId.get(id) ?? null });
  vi.stubGlobal('window', { location: { search }, dispatchEvent: vi.fn() });
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return { byId, store };
}

describe('admin products demo hydration (S3) and 401 expiry recovery (S4)', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('hydrates pending demo STAFF on new-tab /admin/products and keeps non-demo USER denied', async () => {
    const env = stubBrowser(
      [
        'admin-gate-denied',
        'admin-products-content',
        'admin-products-list',
        'admin-loading-state',
        'admin-empty-state',
      ],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(STAFF_SESSION), { status: 200 })),
    );
    mocks.getSessionUser
      .mockReturnValueOnce({
        idUser: 1,
        firstName: 'Demo',
        lastName: 'Buyer',
        idRole: Role.USER,
        isDemo: true,
      })
      .mockReturnValueOnce(DEMO_STAFF);
    mocks.list.mockResolvedValueOnce([]);

    initializeAdminProductsList();
    await flush();
    expect(env.byId.get('admin-gate-denied')?.hidden).toBe(true);
    expect(env.byId.get('admin-products-content')?.hidden).toBe(false);

    const env2 = stubBrowser(['admin-gate-denied', 'admin-products-content'], '');
    mocks.getSessionUser.mockReturnValueOnce({
      idUser: 5,
      firstName: 'Ana',
      lastName: 'U',
      idRole: Role.USER,
    });
    initializeAdminProductsList();
    expect(env2.byId.get('admin-gate-denied')?.hidden).toBe(false);
    expect(env2.byId.get('admin-products-content')?.hidden).toBe(true);
  });

  it('denies confirmed Demo Buyer immediately without fetching /api/demo/session and denies pending hydration resolving to USER or inactive', async () => {
    const buyerSession = {
      active: true,
      role: 'USER',
      user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'b@d.invalid' },
      lease: {},
    };
    const demoBuyer = {
      idUser: 1,
      firstName: 'Demo',
      lastName: 'Buyer',
      idRole: Role.USER,
      isDemo: true,
    };
    const confirmedEnv = stubBrowser(
      ['admin-gate-denied', 'admin-products-content'],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
    );
    confirmedEnv.store.set(DEMO_STORAGE_KEY, JSON.stringify(buyerSession));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mocks.getSessionUser.mockReturnValueOnce(demoBuyer);

    initializeAdminProductsList();
    expect(confirmedEnv.byId.get('admin-gate-denied')?.hidden).toBe(false);
    expect(confirmedEnv.byId.get('admin-products-content')?.hidden).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const pendingUserEnv = stubBrowser(
      ['admin-gate-denied', 'admin-products-content'],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(buyerSession), { status: 200 })),
    );
    mocks.getSessionUser.mockReturnValue(demoBuyer);
    initializeAdminProductsList();
    await flush();
    expect(pendingUserEnv.byId.get('admin-gate-denied')?.hidden).toBe(false);
    expect(pendingUserEnv.byId.get('admin-products-content')?.hidden).toBe(true);

    const pendingInactiveEnv = stubBrowser(
      ['admin-gate-denied', 'admin-products-content'],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })));
    mocks.getSessionUser.mockReturnValueOnce(demoBuyer).mockReturnValueOnce(null);
    initializeAdminProductsList();
    await flush();
    expect(pendingInactiveEnv.byId.get('admin-gate-denied')?.hidden).toBe(false);
    expect(pendingInactiveEnv.byId.get('admin-products-content')?.hidden).toBe(true);
  });

  it('unfreezes list, create, and edit UIs with Spanish error on demo 401', async () => {
    mocks.getSessionUser.mockReturnValue(DEMO_STAFF);
    const listEnv = stubBrowser(
      [
        'admin-gate-denied',
        'admin-products-content',
        'admin-products-list',
        'admin-loading-state',
        'admin-error',
        'admin-error-text',
      ],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
    );
    listEnv.store.set(DEMO_STORAGE_KEY, JSON.stringify(STAFF_SESSION));
    mocks.list.mockRejectedValueOnce(new ProductAdminApiError(401, 'Unauthorized'));
    initializeAdminProductsList();
    await flush();
    expect(listEnv.byId.get('admin-loading-state')?.hidden).toBe(true);
    expect(listEnv.byId.get('admin-error-text')?.textContent).toMatch(/sesión demo expiró/i);

    const createEnv = stubBrowser(
      [
        'admin-gate-denied',
        'admin-create-content',
        'create-product-form',
        'create-error',
        'create-btn',
      ],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
    );
    createEnv.byId.get('create-btn')!.textContent = 'Crear pieza';
    mocks.create.mockRejectedValueOnce(new ProductAdminApiError(401, 'Unauthorized'));
    initializeAdminProductsCreate();
    createEnv.byId.get('create-product-form')!.dispatch('submit');
    await flush();
    expect(createEnv.byId.get('create-product-form')?.getAttribute('aria-busy')).toBeNull();
    expect(createEnv.byId.get('create-btn')?.disabled).toBe(false);
    expect(createEnv.byId.get('create-error')?.textContent).toMatch(/sesión demo expiró/i);

    const editEnv = stubBrowser(
      [
        'admin-gate-denied',
        'admin-edit-shell',
        'admin-edit-loading',
        'admin-edit-load-error',
        'admin-edit-load-error-text',
        'admin-edit-content',
        'edit-product-form',
        'edit-error',
        'edit-btn',
      ],
      `${DEMO_CSRF_COOKIE_NAME}=demo.tok`,
      '?id=7',
    );
    editEnv.byId.get('edit-btn')!.textContent = 'Guardar cambios';
    mocks.getById.mockRejectedValueOnce(new ProductAdminApiError(401, 'Unauthorized'));
    mocks.update.mockRejectedValueOnce(new ProductAdminApiError(401, 'Unauthorized'));
    initializeAdminProductsEdit();
    await flush();
    expect(editEnv.byId.get('admin-edit-loading')?.hidden).toBe(true);
    expect(editEnv.byId.get('admin-edit-load-error-text')?.textContent).toMatch(
      /sesión demo expiró/i,
    );
    editEnv.byId.get('edit-product-form')!.dispatch('submit');
    await flush();
    expect(editEnv.byId.get('edit-product-form')?.getAttribute('aria-busy')).toBeNull();
    expect(editEnv.byId.get('edit-btn')?.disabled).toBe(false);
    expect(editEnv.byId.get('edit-error')?.textContent).toMatch(/sesión demo expiró/i);
  });
});
