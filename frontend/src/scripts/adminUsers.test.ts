import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';

const mockGetSessionUser = vi.fn();
const mockHydrateDemoSession = vi.fn();
const mockIsDemoSessionActive = vi.fn();
const mockIsDemoSessionPendingHydration = vi.fn();
const mockFetchAdminUsers = vi.fn();

vi.mock('../domains/auth', () => ({
  Role: { ADMIN: 1, USER: 2, STAFF: 3 },
  getSessionUser: () => mockGetSessionUser(),
  isAdminOnly: (user: { idRole: number } | null) => user?.idRole === Role.ADMIN,
}));

vi.mock('../config', () => ({
  hydrateDemoSession: () => mockHydrateDemoSession(),
  isDemoSessionActive: () => mockIsDemoSessionActive(),
}));

vi.mock('../lib/http/demoSessionState', () => ({
  isDemoSessionPendingHydration: () => mockIsDemoSessionPendingHydration(),
}));

vi.mock('../domains/auth/services/user.admin.service', () => ({
  fetchAdminUsers: () => mockFetchAdminUsers(),
}));

import { initializeAdminUsers } from './adminUsers';

class FakeEl {
  tagName: string;
  hidden = false;
  disabled = false;
  className = '';
  textContent = '';
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  listeners = new Map<string, Set<EventListener>>();

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
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
  collectText(): string {
    return [this.textContent, ...this.children.map((c) => c.collectText())]
      .filter(Boolean)
      .join(' ');
  }
  collectTags(): string[] {
    return [this.tagName, ...this.children.flatMap((c) => c.collectTags())];
  }
}

function createFakeDocument() {
  const byId = new Map<string, FakeEl>([
    ['admin-gate-denied', new FakeEl('div')],
    ['admin-users-content', new FakeEl('section')],
    ['admin-users-count', new FakeEl('span')],
    ['admin-users-demo-note', new FakeEl('div')],
    ['admin-users-loading', new FakeEl('div')],
    ['admin-users-error', new FakeEl('div')],
    ['admin-users-error-text', new FakeEl('p')],
    ['admin-users-retry', new FakeEl('button')],
    ['admin-users-empty', new FakeEl('div')],
    ['admin-users-table-wrap', new FakeEl('div')],
    ['admin-users-list', new FakeEl('tbody')],
  ]);
  byId.get('admin-gate-denied')!.hidden = true;
  byId.get('admin-users-content')!.hidden = true;
  byId.get('admin-users-demo-note')!.hidden = true;
  byId.get('admin-users-error')!.hidden = true;
  byId.get('admin-users-empty')!.hidden = true;
  byId.get('admin-users-table-wrap')!.hidden = true;

  const doc = {
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string) => new FakeEl(tag),
  } as unknown as Document;

  return { doc, byId };
}

describe('initializeAdminUsers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('denies STAFF and USER without calling GET /api/users', async () => {
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    for (const idRole of [Role.STAFF, Role.USER]) {
      mockGetSessionUser.mockReturnValue({ idRole });
      const { doc, byId } = createFakeDocument();

      await initializeAdminUsers(doc);

      expect(byId.get('admin-gate-denied')!.hidden).toBe(false);
      expect(byId.get('admin-users-content')!.hidden).toBe(true);
    }
    expect(mockFetchAdminUsers).not.toHaveBeenCalled();
  });

  it('renders read-only user rows for ADMIN with demo notice when in demo mode and zero mutation buttons', async () => {
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockIsDemoSessionActive.mockReturnValue(true);
    mockGetSessionUser.mockReturnValue({ idRole: Role.ADMIN });
    mockFetchAdminUsers.mockResolvedValue({
      ok: true,
      count: 3,
      users: [
        {
          id: 1,
          firstName: 'Demo',
          lastName: 'Buyer',
          email: 'demo.buyer+s1@sandbox.mundo3d.invalid',
          image: '',
          idRole: Role.USER,
        },
        {
          id: 2,
          firstName: 'Demo',
          lastName: 'Staff',
          email: 'demo.staff+s1@sandbox.mundo3d.invalid',
          image: '',
          idRole: Role.STAFF,
        },
        {
          id: 3,
          firstName: 'Demo',
          lastName: 'Admin',
          email: 'demo.admin+s1@sandbox.mundo3d.invalid',
          image: '',
          idRole: Role.ADMIN,
        },
      ],
    });

    const { doc, byId } = createFakeDocument();
    await initializeAdminUsers(doc);

    expect(byId.get('admin-users-demo-note')!.hidden).toBe(false);
    expect(byId.get('admin-users-count')!.textContent).toBe('3 cuentas');
    expect(byId.get('admin-users-table-wrap')!.hidden).toBe(false);
    const tbody = byId.get('admin-users-list')!;
    expect(tbody.children).toHaveLength(3);
    const text = tbody.collectText();
    expect(text).toContain('Demo Admin');
    expect(text).toContain('demo.buyer+s1@sandbox.mundo3d.invalid');
    expect(text).toContain('Taller');
    expect(text).toContain('Comprador');
    expect(tbody.collectTags()).not.toContain('BUTTON');
  });
});
