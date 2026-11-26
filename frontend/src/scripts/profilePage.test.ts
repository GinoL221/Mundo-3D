import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';

const mockGetSessionUser = vi.fn();
const mockHydrateDemoSession = vi.fn();
const mockIsDemoSessionActive = vi.fn();
const mockIsDemoSessionPendingHydration = vi.fn();
const mockFetchCurrentProfile = vi.fn();

vi.mock('../config', () => ({
  DEMO_SESSION_EVENT: 'demo-session-changed',
  getSessionUser: () => mockGetSessionUser(),
  hydrateDemoSession: () => mockHydrateDemoSession(),
  isDemoSessionActive: () => mockIsDemoSessionActive(),
}));

vi.mock('../lib/http/demoSessionState', () => ({
  isDemoSessionPendingHydration: () => mockIsDemoSessionPendingHydration(),
}));

vi.mock('../domains/auth/services/profile.service', () => ({
  fetchCurrentProfile: () => mockFetchCurrentProfile(),
}));

import { initializeProfilePage } from './profilePage';

class FakeEl {
  tagName: string;
  hidden = false;
  className = '';
  textContent = '';
  href = '';
  src = '';
  alt = '';
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  listeners = new Map<string, Set<EventListener>>();

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
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
  click() {
    this.listeners.get('click')?.forEach((fn) => fn({} as Event));
  }
  collectHrefs(): string[] {
    return [this.href, ...this.children.flatMap((c) => c.collectHrefs())].filter(Boolean);
  }
}

function createFakeDocument() {
  const byId = new Map<string, FakeEl>([
    ['profile-loading', new FakeEl('div')],
    ['profile-guest', new FakeEl('div')],
    ['profile-error', new FakeEl('div')],
    ['profile-error-text', new FakeEl('p')],
    ['profile-retry', new FakeEl('button')],
    ['profile-content', new FakeEl('div')],
    ['profile-avatar', new FakeEl('img')],
    ['profile-full-name', new FakeEl('h2')],
    ['profile-role-badge', new FakeEl('span')],
    ['profile-detail-name', new FakeEl('dd')],
    ['profile-detail-email', new FakeEl('dd')],
    ['profile-detail-role', new FakeEl('dd')],
    ['profile-detail-kind', new FakeEl('dd')],
    ['profile-scope-summary', new FakeEl('p')],
    ['profile-demo-note', new FakeEl('div')],
    ['profile-demo-note-text', new FakeEl('p')],
    ['profile-shortcuts', new FakeEl('ul')],
  ]);

  byId.get('profile-guest')!.hidden = true;
  byId.get('profile-error')!.hidden = true;
  byId.get('profile-content')!.hidden = true;
  byId.get('profile-demo-note')!.hidden = true;

  const doc = {
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string) => new FakeEl(tag),
  } as unknown as Document;

  return { doc, byId };
}

describe('initializeProfilePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows unauthenticated state without calling GET /api/users/me when no session exists', async () => {
    mockGetSessionUser.mockReturnValue(null);
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockIsDemoSessionActive.mockReturnValue(false);
    const { doc, byId } = createFakeDocument();

    await initializeProfilePage(doc);

    expect(byId.get('profile-loading')!.hidden).toBe(true);
    expect(byId.get('profile-guest')!.hidden).toBe(false);
    expect(byId.get('profile-content')!.hidden).toBe(true);
    expect(mockFetchCurrentProfile).not.toHaveBeenCalled();
  });

  it('hydrates demo session when pending, renders STAFF profile with demo note and Taller shortcuts', async () => {
    mockIsDemoSessionPendingHydration.mockReturnValue(true);
    mockHydrateDemoSession.mockResolvedValue(true);
    mockGetSessionUser.mockReturnValue({ idRole: Role.STAFF });
    mockIsDemoSessionActive.mockReturnValue(true);
    mockFetchCurrentProfile.mockResolvedValue({
      ok: true,
      user: {
        id: 2,
        firstName: 'Demo',
        lastName: 'Staff',
        email: 'staff@demo.local',
        image: '',
        idRole: Role.STAFF,
      },
    });
    const { doc, byId } = createFakeDocument();

    await initializeProfilePage(doc);

    expect(mockHydrateDemoSession).toHaveBeenCalledTimes(1);
    expect(byId.get('profile-content')!.hidden).toBe(false);
    expect(byId.get('profile-full-name')!.textContent).toBe('Demo Staff');
    expect(byId.get('profile-detail-email')!.textContent).toBe('staff@demo.local');
    expect(byId.get('profile-role-badge')!.className).toBe('ui-badge ui-badge--staff');
    expect(byId.get('profile-demo-note')!.hidden).toBe(false);
    expect(byId.get('profile-shortcuts')!.collectHrefs()).toEqual([
      '/admin/orders',
      '/admin/products',
      '/admin/commission-requests',
    ]);
  });

  it('renders error callout and reloads on retry click when fetch fails', async () => {
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockGetSessionUser.mockReturnValue({ idRole: Role.USER });
    mockIsDemoSessionActive.mockReturnValue(false);
    mockFetchCurrentProfile
      .mockResolvedValueOnce({ ok: false, code: 'NETWORK', message: 'Sin conexión' })
      .mockResolvedValueOnce({
        ok: true,
        user: {
          id: 1,
          firstName: 'Gino',
          lastName: 'Lencina',
          email: 'gino@email.com',
          image: '',
          idRole: Role.USER,
        },
      });
    const { doc, byId } = createFakeDocument();

    await initializeProfilePage(doc);

    expect(byId.get('profile-error')!.hidden).toBe(false);
    expect(byId.get('profile-error-text')!.textContent).toBe('Sin conexión');
    expect(byId.get('profile-content')!.hidden).toBe(true);

    byId.get('profile-retry')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(byId.get('profile-error')!.hidden).toBe(true);
    expect(byId.get('profile-content')!.hidden).toBe(false);
    expect(byId.get('profile-shortcuts')!.collectHrefs()).toEqual([
      '/orders',
      '/',
      '/help#encargos',
    ]);
  });
});
