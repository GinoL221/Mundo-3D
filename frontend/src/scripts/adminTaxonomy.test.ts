import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';

const mockGetSessionUser = vi.fn();
const mockHydrateDemoSession = vi.fn();
const mockIsDemoSessionPendingHydration = vi.fn();
const mockFetchCategories = vi.fn();
const mockFetchFranchises = vi.fn();
const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockCreateFranchise = vi.fn();
const mockUpdateFranchise = vi.fn();
const mockDeleteFranchise = vi.fn();

vi.mock('../domains/auth', () => ({
  getSessionUser: () => mockGetSessionUser(),
  isAdminOnly: (user: { idRole: number } | null) => user?.idRole === Role.ADMIN,
}));

vi.mock('../config', () => ({
  hydrateDemoSession: () => mockHydrateDemoSession(),
}));

vi.mock('../lib/http/demoSessionState', () => ({
  isDemoSessionPendingHydration: () => mockIsDemoSessionPendingHydration(),
}));

vi.mock('../domains/products/services/taxonomy.admin.service', () => ({
  fetchCategories: () => mockFetchCategories(),
  fetchFranchises: () => mockFetchFranchises(),
  createCategory: (name: string) => mockCreateCategory(name),
  updateCategory: (id: number, name: string) => mockUpdateCategory(id, name),
  deleteCategory: (id: number) => mockDeleteCategory(id),
  createFranchise: (name: string) => mockCreateFranchise(name),
  updateFranchise: (id: number, name: string) => mockUpdateFranchise(id, name),
  deleteFranchise: (id: number) => mockDeleteFranchise(id),
}));

import { initializeAdminTaxonomy } from './adminTaxonomy';

class FakeEl {
  tagName: string;
  hidden = false;
  disabled = false;
  className = '';
  textContent = '';
  value = '';
  type = '';
  returnValue = '';
  open = false;
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  listeners = new Map<string, Set<EventListener>>();

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  showModal() {
    this.open = true;
  }
  close(val = '') {
    this.open = false;
    this.returnValue = val;
    this.listeners.get('close')?.forEach((fn) => fn({} as Event));
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  append(...nodes: FakeEl[]) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: FakeEl[]) {
    this.children = [...nodes];
  }
  addEventListener(type: string, fn: EventListener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  dispatch(type: string) {
    this.listeners.get(type)?.forEach((fn) => fn({ preventDefault: vi.fn() } as unknown as Event));
  }
  findAll(predicate: (el: FakeEl) => boolean): FakeEl[] {
    const own = predicate(this) ? [this] : [];
    return [...own, ...this.children.flatMap((c) => c.findAll(predicate))];
  }
}

function createFakeDocument() {
  const byId = new Map<string, FakeEl>([
    ['admin-gate-denied', new FakeEl('div')],
    ['admin-taxonomy-content', new FakeEl('section')],
    ['admin-taxonomy-loading', new FakeEl('div')],
    ['admin-taxonomy-error', new FakeEl('div')],
    ['admin-taxonomy-error-text', new FakeEl('p')],
    ['admin-taxonomy-retry', new FakeEl('button')],
    ['admin-taxonomy-feedback', new FakeEl('div')],
    ['admin-taxonomy-feedback-text', new FakeEl('p')],
    ['admin-taxonomy-panels', new FakeEl('div')],
    ['category-create-form', new FakeEl('form')],
    ['category-create-input', new FakeEl('input')],
    ['category-create-btn', new FakeEl('button')],
    ['categories-list', new FakeEl('ul')],
    ['categories-count', new FakeEl('span')],
    ['franchise-create-form', new FakeEl('form')],
    ['franchise-create-input', new FakeEl('input')],
    ['franchise-create-btn', new FakeEl('button')],
    ['franchises-list', new FakeEl('ul')],
    ['franchises-count', new FakeEl('span')],
    ['admin-taxonomy-delete-dialog', new FakeEl('dialog')],
    ['admin-taxonomy-dialog-title', new FakeEl('h2')],
    ['admin-taxonomy-dialog-body', new FakeEl('p')],
  ]);
  byId.get('admin-gate-denied')!.hidden = true;
  byId.get('admin-taxonomy-content')!.hidden = true;
  byId.get('admin-taxonomy-error')!.hidden = true;
  byId.get('admin-taxonomy-feedback')!.hidden = true;
  byId.get('admin-taxonomy-panels')!.hidden = true;

  const doc = {
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string) => new FakeEl(tag),
  } as unknown as Document;

  return { doc, byId };
}

describe('initializeAdminTaxonomy', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('denies STAFF and USER without fetching taxonomy endpoints', async () => {
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    for (const idRole of [Role.STAFF, Role.USER]) {
      mockGetSessionUser.mockReturnValue({ idRole });
      const { doc, byId } = createFakeDocument();

      await initializeAdminTaxonomy(doc);

      expect(byId.get('admin-gate-denied')!.hidden).toBe(false);
      expect(byId.get('admin-taxonomy-content')!.hidden).toBe(true);
    }
    expect(mockFetchCategories).not.toHaveBeenCalled();
    expect(mockFetchFranchises).not.toHaveBeenCalled();
  });

  it('loads categories and franchises for ADMIN, supports create and dialog-confirmed delete', async () => {
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockGetSessionUser.mockReturnValue({ idRole: Role.ADMIN });
    mockFetchCategories.mockResolvedValue({
      ok: true,
      items: [{ idCategory: 1, nameCategory: 'Busto' }],
    });
    mockFetchFranchises.mockResolvedValue({
      ok: true,
      items: [{ idFranchise: 2, nameFranchise: 'Marvel' }],
    });
    mockCreateCategory.mockResolvedValue({
      ok: true,
      item: { idCategory: 3, nameCategory: 'Dioramas' },
    });
    mockDeleteCategory.mockResolvedValue({ ok: true });

    const { doc, byId } = createFakeDocument();
    await initializeAdminTaxonomy(doc);

    expect(byId.get('admin-taxonomy-panels')!.hidden).toBe(false);
    expect(byId.get('categories-count')!.textContent).toBe('1');
    expect(byId.get('franchises-count')!.textContent).toBe('1');

    // Create category
    byId.get('category-create-input')!.value = 'Dioramas';
    byId.get('category-create-form')!.dispatch('submit');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCreateCategory).toHaveBeenCalledWith('Dioramas');
    expect(byId.get('categories-count')!.textContent).toBe('2');

    // Delete via dialog
    const deleteButtons = byId
      .get('categories-list')!
      .findAll((el) => el.tagName === 'BUTTON' && el.textContent === 'Eliminar');
    expect(deleteButtons).toHaveLength(2);
    deleteButtons[0].dispatch('click');
    const dialog = byId.get('admin-taxonomy-delete-dialog')!;
    expect(dialog.open).toBe(true);
    dialog.close('confirm');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockDeleteCategory).toHaveBeenCalledWith(1);
    expect(byId.get('categories-count')!.textContent).toBe('1');
  });
});
