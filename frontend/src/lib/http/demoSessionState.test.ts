import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from './apiBase';
import {
  clearDemoSession,
  DEMO_BROADCAST_CHANNEL,
  DEMO_CSRF_COOKIE_NAME,
  DEMO_SESSION_EVENT,
  DEMO_STORAGE_KEY,
  DEMO_TAB_ID,
  demoRoleToId,
  getDemoSession,
  isDemoApiUrl,
  isDemoSessionActive,
  isValidDemoSession,
  readDemoCsrfToken,
  rewriteDemoApiUrl,
  saveDemoSession,
  withDemoCredentials,
  type DemoSessionState,
} from './demoSessionState';

function stubStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn((k: string) => void store.delete(k)),
  };
  vi.stubGlobal('sessionStorage', storage);
  return { store, storage };
}

function stubCookieJar(initial = '') {
  const cookies = new Map<string, string>();
  for (const part of initial.split('; ').filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies.set(part.slice(0, idx), part.slice(idx + 1));
  }
  vi.stubGlobal('document', {
    get cookie() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(';').map((s) => s.trim());
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      const name = pair.slice(0, idx);
      if (attrs.some((a) => /^max-age=0$/i.test(a))) cookies.delete(name);
      else cookies.set(name, pair.slice(idx + 1));
    },
  });
  return cookies;
}

const sampleBuyer: DemoSessionState = {
  active: true,
  role: 'USER',
  user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'demo.buyer@sandbox.invalid' },
  lease: { idleExpiresAt: '2026-11-24T01:00:00.000Z' },
};

describe('demoSessionState', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('rewrites demo-supported API routes and leaves auth, demo, and foreign URLs untouched', () => {
    expect(rewriteDemoApiUrl(`${API_URL}/api/products`)).toBe(`${API_URL}/api/demo/products`);
    expect(rewriteDemoApiUrl(`${API_URL}/api/products/search?page=2`)).toBe(
      `${API_URL}/api/demo/products/search?page=2`,
    );
    expect(rewriteDemoApiUrl(`${API_URL}/api/product/7`)).toBe(`${API_URL}/api/demo/product/7`);
    expect(rewriteDemoApiUrl(`${API_URL}/api/categories`)).toBe(`${API_URL}/api/demo/categories`);
    expect(rewriteDemoApiUrl(`${API_URL}/api/franchises`)).toBe(`${API_URL}/api/demo/franchises`);
    expect(rewriteDemoApiUrl(`${API_URL}/api/cart`)).toBe(`${API_URL}/api/demo/cart`);
    expect(rewriteDemoApiUrl(`${API_URL}/api/orders/mine?page=1`)).toBe(
      `${API_URL}/api/demo/orders/mine?page=1`,
    );
    expect(rewriteDemoApiUrl(`${API_URL}/api/custom-commission-requests`)).toBe(
      `${API_URL}/api/demo/custom-commission-requests`,
    );
    expect(rewriteDemoApiUrl('/api/orders')).toBe('/api/demo/orders');
    expect(rewriteDemoApiUrl(`${API_URL}/api/demo/cart`)).toBe(`${API_URL}/api/demo/cart`);
    expect(rewriteDemoApiUrl(`${API_URL}/api/users/login`)).toBe(`${API_URL}/api/users/login`);
    expect(rewriteDemoApiUrl('https://other.example/api/products')).toBe(
      'https://other.example/api/products',
    );
    expect(isDemoApiUrl(`${API_URL}/api/demo/cart`)).toBe(true);
    expect(isDemoApiUrl(`${API_URL}/api/cart`)).toBe(false);
  });

  it('attaches m3d_demo_csrf and never leaks standard m3d_csrf in withDemoCredentials', () => {
    stubCookieJar(`m3d_csrf=prod.token; ${DEMO_CSRF_COOKIE_NAME}=demo.sig`);
    expect(readDemoCsrfToken()).toBe('demo.sig');
    expect(isDemoSessionActive()).toBe(true);

    const init = withDemoCredentials({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'stale.prod' },
    });
    expect(init.credentials).toBe('include');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'demo.sig',
    });
  });

  it('reads stored demo session when cookie exists, falls back across tabs, and clears on absent cookie', () => {
    const { store } = stubStorage();
    stubCookieJar('');
    store.set(DEMO_STORAGE_KEY, JSON.stringify(sampleBuyer));
    expect(getDemoSession()).toBeNull();
    expect(store.has(DEMO_STORAGE_KEY)).toBe(false);

    stubCookieJar(`${DEMO_CSRF_COOKIE_NAME}=demo.sig`);
    expect(getDemoSession()?.role).toBe('USER');

    const staffSession: DemoSessionState = { ...sampleBuyer, role: 'STAFF' };
    saveDemoSession(staffSession, 'role-changed');
    expect(getDemoSession()).toEqual(staffSession);
    expect(demoRoleToId('USER')).toBe(2);
    expect(demoRoleToId('STAFF')).toBe(3);
    expect(isValidDemoSession({ ...sampleBuyer, role: 'ADMIN' })).toBe(false);
  });

  it('clears demo cookie and storage and notifies window + BroadcastChannel without touching m3d_user', () => {
    const { store } = stubStorage();
    const cookies = stubCookieJar(`m3d_user=kept; ${DEMO_CSRF_COOKIE_NAME}=demo.sig`);
    store.set(DEMO_STORAGE_KEY, JSON.stringify(sampleBuyer));

    const events: Event[] = [];
    vi.stubGlobal('window', { dispatchEvent: (e: Event) => events.push(e) });
    const posted: Array<{ channel: string; msg: unknown }> = [];
    class FakeChannel {
      constructor(private readonly name: string) {}
      postMessage(msg: unknown) {
        posted.push({ channel: this.name, msg });
      }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel);

    clearDemoSession('expired');

    expect(cookies.has(DEMO_CSRF_COOKIE_NAME)).toBe(false);
    expect(cookies.get('m3d_user')).toBe('kept');
    expect(store.has(DEMO_STORAGE_KEY)).toBe(false);
    expect(events).toHaveLength(1);
    expect((events[0] as CustomEvent<{ reason: string }>).type).toBe(DEMO_SESSION_EVENT);
    expect((events[0] as CustomEvent<{ reason: string }>).detail).toEqual({ reason: 'expired' });
    expect(posted).toEqual([
      {
        channel: DEMO_BROADCAST_CHANNEL,
        msg: { type: 'demo-session-changed', reason: 'expired', senderId: DEMO_TAB_ID },
      },
    ]);
  });
});
