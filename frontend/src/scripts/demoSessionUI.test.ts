import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_CSRF_COOKIE_NAME,
  DEMO_SESSION_EVENT,
  DEMO_STORAGE_KEY,
  type DemoSessionState,
} from '../lib/http/demoSessionState';
import { initializeDemoSessionUI } from './demoSessionUI';

class FakeEl {
  hidden = true;
  disabled = false;
  textContent = '';
  className = '';
  attrs = new Map<string, string>();
  listeners = new Map<string, Set<EventListener>>();
  constructor(initialHidden = true) {
    this.hidden = initialHidden;
  }
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v);
  }
  hasAttribute(k: string) {
    return this.attrs.has(k);
  }
  addEventListener(type: string, fn: EventListener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, fn: EventListener) {
    this.listeners.get(type)?.delete(fn);
  }
  click() {
    const ev = { preventDefault: vi.fn() } as unknown as Event;
    this.listeners.get('click')?.forEach((fn) => fn(ev));
  }
}

function setupDom(initialCookie = '') {
  const cookies = new Map<string, string>();
  for (const part of initialCookie.split('; ').filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const bar = new FakeEl(true);
  const roleBadge = new FakeEl(false);
  const summary = new FakeEl(false);
  const exitBtn = new FakeEl(false);
  const noticeWrap = new FakeEl(true);
  const noticeEl = new FakeEl(false);
  const noticeTitle = new FakeEl(false);
  const noticeText = new FakeEl(false);
  const retryBtn = new FakeEl(true);
  const dismissBtn = new FakeEl(false);
  const entryBtn = new FakeEl(true);

  const byId = new Map<string, FakeEl>([
    ['demo-session-bar', bar],
    ['demo-bar-role-badge', roleBadge],
    ['demo-bar-summary', summary],
    ['demo-bar-exit', exitBtn],
    ['demo-session-notice-wrap', noticeWrap],
    ['demo-session-notice', noticeEl],
    ['demo-notice-title', noticeTitle],
    ['demo-notice-text', noticeText],
    ['demo-notice-retry', retryBtn],
    ['demo-notice-dismiss', dismissBtn],
  ]);
  const doc = {
    get cookie() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(';').map((s) => s.trim());
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      if (attrs.some((a) => /^max-age=0$/i.test(a))) cookies.delete(pair.slice(0, idx));
      else cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    },
    getElementById: (id: string) => byId.get(id) ?? null,
    querySelectorAll: (sel: string) => (sel === '[data-demo-entry]' ? [entryBtn] : []),
  } as unknown as Document;

  const winListeners = new Map<string, Set<EventListener>>();
  const win = {
    location: { pathname: '/', assign: vi.fn(), reload: vi.fn() },
    addEventListener: (t: string, fn: EventListener) => {
      const set = winListeners.get(t) ?? new Set();
      set.add(fn);
      winListeners.set(t, set);
    },
    removeEventListener: (t: string, fn: EventListener) => {
      winListeners.get(t)?.delete(fn);
    },
    dispatchEvent: (ev: Event) => {
      winListeners.get(ev.type)?.forEach((fn) => fn(ev));
      return true;
    },
  } as unknown as Window;

  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('localStorage', storage);

  return { doc, win, bar, roleBadge, exitBtn, noticeWrap, noticeTitle, retryBtn, entryBtn, store };
}

const buyerSession: DemoSessionState = {
  active: true,
  role: 'USER',
  user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'buyer@demo.invalid' },
  lease: {},
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('initializeDemoSessionUI', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps entry hidden silently on 404 disabled and reveals entry when status is enabled', async () => {
    const dom1 = setupDom();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const c1 = initializeDemoSessionUI(dom1.doc, dom1.win, { reloadOnTransition: false });
    await flush();
    expect(dom1.entryBtn.hidden).toBe(true);
    expect(dom1.noticeWrap.hidden).toBe(true);
    c1();

    const dom2 = setupDom();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ enabled: true }), { status: 200 })),
    );
    const c2 = initializeDemoSessionUI(dom2.doc, dom2.win, { reloadOnTransition: false });
    await flush();
    expect(dom2.entryBtn.hidden).toBe(false);
    c2();
  });

  it('surfaces honest 503 DEMO_SANDBOX_BUSY notice with retry and activates bar on 201 start', async () => {
    const dom = setupDom();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'DEMO_SANDBOX_BUSY' }), {
            status: 503,
            headers: { 'Retry-After': '30' },
          }),
        )
        .mockImplementationOnce(async () => {
          dom.doc.cookie = `${DEMO_CSRF_COOKIE_NAME}=demo.sig; path=/`;
          return new Response(JSON.stringify(buyerSession), { status: 201 });
        }),
    );

    const cleanup = initializeDemoSessionUI(dom.doc, dom.win, { reloadOnTransition: false });
    await flush();
    dom.entryBtn.click();
    await flush();
    expect(dom.noticeWrap.hidden).toBe(false);
    expect(dom.noticeTitle.textContent).toContain('ocupadas');
    expect(dom.retryBtn.hidden).toBe(false);

    dom.retryBtn.click();
    await flush();
    expect(dom.bar.hidden).toBe(false);
    expect(dom.roleBadge.textContent).toBe('BUYER');
    expect(dom.entryBtn.hidden).toBe(true);
    cleanup();
  });

  it('handles lease expiry event and exit button cleanly without redirecting to /login', async () => {
    const dom = setupDom(`${DEMO_CSRF_COOKIE_NAME}=demo.sig`);
    dom.store.set(DEMO_STORAGE_KEY, JSON.stringify(buyerSession));
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(buyerSession), { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 204 })),
    );

    const cleanup = initializeDemoSessionUI(dom.doc, dom.win, { reloadOnTransition: false });
    await flush();
    expect(dom.bar.hidden).toBe(false);

    dom.win.dispatchEvent(new CustomEvent(DEMO_SESSION_EVENT, { detail: { reason: 'expired' } }));
    expect(dom.bar.hidden).toBe(true);
    expect(dom.noticeWrap.hidden).toBe(false);
    expect(dom.noticeTitle.textContent).toContain('venció');
    expect(dom.retryBtn.hidden).toBe(false);
    cleanup();
  });
});
