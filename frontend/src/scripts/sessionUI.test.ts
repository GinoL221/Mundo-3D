import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeSessionUI } from './sessionUI';
import { Role } from '../domains/auth/adapters/auth.adapter';

// `sessionUI.ts` is the receiving half of cross-tab session sync. Its
// listeners are covered incidentally by header-modules.test.ts alongside the
// other navbar modules; this file owns the BroadcastChannel contract itself —
// what a message MEANS — because that is where the cross-tab logout race
// lived (see "flips to guest ... even while the m3d_user cookie is still
// readable" below).

class FakeElement {
  style: Record<string, string> = {};
  textContent = '';
  src = '';
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
}

class FakeDocument {
  elements = new Map<string, FakeElement>();
  cookie = '';
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  getElementById(id: string) {
    return this.elements.get(id) ?? null;
  }

  querySelectorAll(selector: string) {
    const ids: Record<string, string> = {
      '.guest-only': 'guest',
      '.user-only': 'user',
      '.admin-only': 'admin',
    };
    const element = this.elements.get(ids[selector]);
    return element ? [element] : [];
  }
}

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }
}

function createFixture() {
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);

  const document = new FakeDocument();
  for (const id of ['guest', 'user', 'admin', 'navbar-greeting', 'navbar-avatar', 'navbar-logout']) {
    document.elements.set(id, new FakeElement());
  }

  const window = {
    listeners: new Map<string, (event: Event) => void>(),
    location: { href: '' },
    addEventListener(type: string, listener: (event: Event) => void) {
      this.listeners.set(type, listener);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    },
  };

  return {
    document,
    window,
    start: () =>
      initializeSessionUI(document as unknown as Document, window as unknown as Window),
    channel: () => FakeBroadcastChannel.instances.at(-1)!,
    visibility: () => ({
      guest: document.elements.get('guest')!.style.display,
      user: document.elements.get('user')!.style.display,
      admin: document.elements.get('admin')!.style.display,
    }),
    greeting: () => document.elements.get('navbar-greeting')!.textContent,
    avatar: () => document.elements.get('navbar-avatar')!.src,
  };
}

function setUserCookie(document: FakeDocument, user: Record<string, unknown>) {
  document.cookie = `m3d_user=${encodeURIComponent(JSON.stringify(user))}`;
}

const GUEST = { guest: 'block', user: 'none', admin: 'none' };
const ADMIN_USER = { firstName: 'Ada', idRole: Role.ADMIN, image: 'ada.png' };

describe('initializeSessionUI', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('cross-tab BroadcastChannel messages', () => {
    // The regression this file exists for. Under site isolation the two tabs
    // can live in different renderer processes, so the logging-out tab's
    // cookie deletion has to travel through the browser process before this
    // tab's `document.cookie` reflects it. If the broadcast wins that race, a
    // receiver that re-derives its state from the cookie reads a session that
    // is already dead, keeps the user UI up, and never retries — the stale
    // navbar is permanent, not transient. The sending tab is authoritative
    // about the session having ended, so the message must be believed on its
    // own.
    it('flips to guest on a logged-out message even while the m3d_user cookie is still readable', () => {
      const fixture = createFixture();
      setUserCookie(fixture.document, ADMIN_USER);
      fixture.start();
      expect(fixture.visibility().user).toBe('block');

      // Deliberately NOT cleared: this is the race, expressed as a fixture.
      fixture.channel().onmessage?.({
        data: { type: 'session-changed', state: 'logged-out' },
      } as MessageEvent);

      expect(fixture.visibility()).toEqual(GUEST);
    });

    // Backward compatibility, and the reason the cookie path stays: a tab
    // loaded before the `state` field shipped still posts the old intentless
    // `{ type: 'session-changed' }`. A receiver that only understood the new
    // payload would ignore that tab's logout entirely.
    it('falls back to re-reading the cookie when the message carries no state', () => {
      const fixture = createFixture();
      fixture.start();
      expect(fixture.visibility()).toEqual(GUEST);

      setUserCookie(fixture.document, ADMIN_USER);
      fixture.channel().onmessage?.({ data: { type: 'session-changed' } } as MessageEvent);

      expect(fixture.visibility().user).toBe('block');
    });

    it('tolerates a message with no data at all', () => {
      const fixture = createFixture();
      fixture.start();
      setUserCookie(fixture.document, ADMIN_USER);

      expect(() => fixture.channel().onmessage?.({} as MessageEvent)).not.toThrow();
      expect(fixture.visibility().user).toBe('block');
    });

    it('re-reads the cookie on a logged-in message', () => {
      const fixture = createFixture();
      fixture.start();
      expect(fixture.visibility()).toEqual(GUEST);

      setUserCookie(fixture.document, ADMIN_USER);
      fixture.channel().onmessage?.({
        data: { type: 'session-changed', state: 'logged-in' },
      } as MessageEvent);

      expect(fixture.visibility()).toEqual({ guest: 'none', user: 'block', admin: 'block' });
      expect(fixture.greeting()).toBe('Hola Ada');
      expect(fixture.avatar()).toBe('/img/users/ada.png');
    });

    it('keeps working when BroadcastChannel is unavailable', () => {
      vi.stubGlobal('BroadcastChannel', undefined);
      const document = new FakeDocument();
      for (const id of ['guest', 'user', 'admin', 'navbar-greeting', 'navbar-avatar']) {
        document.elements.set(id, new FakeElement());
      }
      const window = {
        listeners: new Map<string, (event: Event) => void>(),
        addEventListener(type: string, listener: (event: Event) => void) {
          this.listeners.set(type, listener);
        },
        removeEventListener() {},
      };

      expect(() =>
        initializeSessionUI(document as unknown as Document, window as unknown as Window),
      ).not.toThrow();
      expect(document.elements.get('guest')!.style.display).toBe('block');
    });
  });

  // Characterization: the non-broadcast triggers still derive everything from
  // the cookie. Teaching the receiver to trust a logout message must not
  // quietly change the normal path.
  describe('cookie-driven update on the non-broadcast triggers', () => {
    it('renders the user state from the cookie on the initial call', () => {
      const fixture = createFixture();
      setUserCookie(fixture.document, ADMIN_USER);

      fixture.start();

      expect(fixture.visibility()).toEqual({ guest: 'none', user: 'block', admin: 'block' });
      expect(fixture.greeting()).toBe('Hola Ada');
    });

    it('renders the guest state when no cookie is present', () => {
      const fixture = createFixture();

      fixture.start();

      expect(fixture.visibility()).toEqual(GUEST);
    });

    it('re-reads the cookie on focus', () => {
      const fixture = createFixture();
      fixture.start();

      setUserCookie(fixture.document, ADMIN_USER);
      fixture.window.listeners.get('focus')?.({} as Event);
      expect(fixture.visibility().user).toBe('block');

      fixture.document.cookie = '';
      fixture.window.listeners.get('focus')?.({} as Event);
      expect(fixture.visibility()).toEqual(GUEST);
    });

    it('re-reads the cookie on visibilitychange', () => {
      const fixture = createFixture();
      fixture.start();

      setUserCookie(fixture.document, ADMIN_USER);
      fixture.document.listeners.get('visibilitychange')?.({} as Event);
      expect(fixture.visibility().user).toBe('block');

      fixture.document.cookie = '';
      fixture.document.listeners.get('visibilitychange')?.({} as Event);
      expect(fixture.visibility()).toEqual(GUEST);
    });

    it('re-reads the cookie on the same-tab session-changed event', () => {
      const fixture = createFixture();
      fixture.start();

      setUserCookie(fixture.document, ADMIN_USER);
      fixture.window.listeners.get('session-changed')?.({} as Event);

      expect(fixture.visibility().user).toBe('block');
    });

    it('falls back to the default greeting and leaves the avatar alone when the user carries neither', () => {
      const fixture = createFixture();
      setUserCookie(fixture.document, { idRole: Role.USER });

      fixture.start();

      expect(fixture.greeting()).toBe('Hola Usuario');
      expect(fixture.avatar()).toBe('');
    });

    it('resets to guest on a corrupt cookie instead of throwing', () => {
      const fixture = createFixture();
      fixture.document.cookie = 'm3d_user=%7Bnot-valid-json';

      expect(() => fixture.start()).not.toThrow();
      expect(fixture.visibility()).toEqual(GUEST);
    });
  });

  // The admin-only navbar entries are a presentation gate over the same
  // `hasAdminAccess` the admin pages use — the API's `requireRoles` is the
  // real boundary, but the two must not disagree about who sees the link.
  describe('admin gating follows hasAdminAccess', () => {
    it('shows admin-only elements to ADMIN', () => {
      const fixture = createFixture();
      setUserCookie(fixture.document, { firstName: 'Ada', idRole: Role.ADMIN });

      fixture.start();

      expect(fixture.visibility().admin).toBe('block');
    });

    it('shows admin-only elements to STAFF', () => {
      const fixture = createFixture();
      setUserCookie(fixture.document, { firstName: 'Sam', idRole: Role.STAFF });

      fixture.start();

      expect(fixture.visibility().admin).toBe('block');
    });

    it('hides admin-only elements from a regular USER, who still sees the user UI', () => {
      const fixture = createFixture();
      setUserCookie(fixture.document, { firstName: 'Uma', idRole: Role.USER });

      fixture.start();

      expect(fixture.visibility()).toEqual({ guest: 'none', user: 'block', admin: 'none' });
    });
  });

  describe('cleanup', () => {
    it('removes every listener and closes the channel', () => {
      const fixture = createFixture();
      const cleanup = fixture.start();
      const channel = fixture.channel();

      cleanup();

      expect(channel.close).toHaveBeenCalledTimes(1);
      expect(fixture.window.listeners.has('session-changed')).toBe(false);
      expect(fixture.window.listeners.has('focus')).toBe(false);
      expect(fixture.document.listeners.has('visibilitychange')).toBe(false);
      expect(fixture.document.elements.get('navbar-logout')!.listeners.has('click')).toBe(false);
    });

    it('is idempotent and returns the same cleanup for an already-wired document', () => {
      const fixture = createFixture();
      const cleanup = fixture.start();

      expect(fixture.start()).toBe(cleanup);

      cleanup();
      expect(() => cleanup()).not.toThrow();
      expect(fixture.channel().close).toHaveBeenCalledTimes(1);
    });
  });
});
