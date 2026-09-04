import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  broadcastSessionChanged,
  clearSession,
  getSessionUser,
  hasAdminAccess,
  isAdminOnly,
} from './session.service';

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

// Records every `document.cookie = ...` assignment. A plain object stub
// cannot be used for the expiry assertions: each write would overwrite the
// last, and cookie expiry is expressed as a SEQUENCE of writes.
function stubCookieJar(initial: string): string[] {
  const writes: string[] = [];
  vi.stubGlobal('document', {
    get cookie() { return initial; },
    set cookie(value: string) { writes.push(value); },
  });
  return writes;
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

describe('session.service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getSessionUser', () => {
    it('returns null when there is no m3d_user cookie', () => {
      stubCookie('');

      expect(getSessionUser()).toBeNull();
    });

    it('returns the parsed user when m3d_user is present (URL-encoded JSON)', () => {
      const encoded = encodeURIComponent(JSON.stringify({ idRole: 2 }));
      stubCookie(`m3d_user=${encoded}`);

      expect(getSessionUser()).toEqual({ idRole: 2 });
    });

    it('returns null (does not throw) on malformed/corrupt cookie JSON', () => {
      stubCookie('m3d_user=%7Bnot-valid-json');

      expect(() => getSessionUser()).not.toThrow();
      expect(getSessionUser()).toBeNull();
    });

    it('finds m3d_user among several cookies', () => {
      const encoded = encodeURIComponent(JSON.stringify({ idRole: 3 }));
      stubCookie(`m3d_csrf=random.hmac; m3d_user=${encoded}`);

      expect(getSessionUser()).toEqual({ idRole: 3 });
    });
  });

  describe('hasAdminAccess', () => {
    it('is false for no user (logged out)', () => {
      expect(hasAdminAccess(null)).toBe(false);
    });

    it('is false for USER role', () => {
      expect(hasAdminAccess({ idRole: 2 })).toBe(false);
    });

    it('is true for STAFF role', () => {
      expect(hasAdminAccess({ idRole: 3 })).toBe(true);
    });

    it('is true for ADMIN role', () => {
      expect(hasAdminAccess({ idRole: 1 })).toBe(true);
    });
  });

  describe('isAdminOnly', () => {
    it('is false for no user (logged out)', () => {
      expect(isAdminOnly(null)).toBe(false);
    });

    it('is false for USER role', () => {
      expect(isAdminOnly({ idRole: 2 })).toBe(false);
    });

    it('is false for STAFF role', () => {
      expect(isAdminOnly({ idRole: 3 })).toBe(false);
    });

    it('is true for ADMIN role', () => {
      expect(isAdminOnly({ idRole: 1 })).toBe(true);
    });
  });

  // The message carries the direction because the receiving tab cannot
  // reliably re-derive it: under site isolation the sender's cookie deletion
  // reaches the other renderer after the message can, so a receiver reading
  // its own `document.cookie` may still see the dead session (sessionUI.ts).
  describe('broadcastSessionChanged', () => {
    beforeEach(() => {
      FakeBroadcastChannel.instances = [];
      vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    });

    it('posts the login direction used by LoginForm/RegisterForm', () => {
      broadcastSessionChanged('logged-in');

      expect(FakeBroadcastChannel.instances[0].name).toBe('m3d-session');
      expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'session-changed',
        state: 'logged-in',
      });
    });

    it('posts the logout direction', () => {
      broadcastSessionChanged('logged-out');

      expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'session-changed',
        state: 'logged-out',
      });
    });

    // Older browsers without BroadcastChannel fall back to the
    // focus/visibilitychange layer in sessionUI.ts — never to a throw that
    // would abort the caller mid-logout.
    it('does not throw when BroadcastChannel is unavailable', () => {
      vi.stubGlobal('BroadcastChannel', undefined);

      expect(() => broadcastSessionChanged('logged-out')).not.toThrow();
    });
  });

  describe('clearSession', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      FakeBroadcastChannel.instances = [];
      fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
      vi.stubGlobal('fetch', fetchMock);
      vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
      // Pinned so cookie-scope assertions never depend on whatever hostname
      // the test environment happens to expose.
      vi.stubGlobal('location', { hostname: 'localhost' });
      stubCookie('');
    });

    it('calls POST /users/logout with credentials included', async () => {
      await clearSession();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/users/logout');
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('include');
    });

    it('broadcasts a session-changed message on the m3d-session channel', async () => {
      await clearSession();

      expect(FakeBroadcastChannel.instances).toHaveLength(1);
      expect(FakeBroadcastChannel.instances[0].name).toBe('m3d-session');
      expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'session-changed',
        state: 'logged-out',
      });
    });

    it('still broadcasts even when the logout request fails (best-effort)', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(clearSession()).resolves.toBeUndefined();

      expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'session-changed',
        state: 'logged-out',
      });
    });

    // sessionUI.ts's logout handler fires clearSession() without awaiting it
    // and then immediately assigns window.location.href. A plain fetch is
    // cancelled by that navigation, so the 204's Set-Cookie headers never
    // reach the browser and every cookie survives a logout that DID revoke
    // the family server-side — other tabs keep rendering a session that no
    // longer exists. `keepalive` is what lets the request and its response
    // outlive the page.
    it('sends the logout request with keepalive so it survives the navigation that follows', async () => {
      await clearSession();

      const [, options] = fetchMock.mock.calls[0];
      expect(options.keepalive).toBe(true);
    });

    // The three assertions below all run while the logout request is still
    // in flight: the UI-gating state must not depend on the response, because
    // the tab that triggered logout is usually gone before it arrives.
    it('expires the client-readable session cookies before the logout response settles', async () => {
      let settle: () => void = () => {};
      fetchMock.mockImplementation(
        () => new Promise((resolve) => { settle = () => resolve({ ok: true, status: 204 }); }),
      );
      const writes = stubCookieJar('m3d_user=%7B%7D; m3d_csrf=abc.hmac');

      const pending = clearSession();

      expect(writes.some((w) => w.startsWith('m3d_user=') && /max-age=0/i.test(w))).toBe(true);
      expect(writes.some((w) => w.startsWith('m3d_csrf=') && /max-age=0/i.test(w))).toBe(true);

      settle();
      await pending;
    });

    it('expires them on the same path the backend set them on, or the clear silently misses', async () => {
      const writes = stubCookieJar('m3d_user=%7B%7D');

      await clearSession();

      // `every` alone would pass vacuously on zero writes — assert the
      // clear actually happened before asserting how it happened.
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every((w) => /;\s*path=\//i.test(w))).toBe(true);
    });

    // COOKIE_DOMAIN is empty in dev/CI but set to the root domain in
    // production (render.yaml, README "Variables de entorno"), so the cookies
    // this clears carry a Domain attribute there and none here. A write
    // without a matching `domain` does not expire the existing cookie — it
    // creates a second one — which would make this clear a no-op in
    // production while passing every tier we can run. Sweeping the host and
    // its parent domains covers both topologies without the frontend having
    // to be told which one it is deployed in.
    it('expires the cookies on the host and on each parent domain, covering a Domain-scoped set', async () => {
      vi.stubGlobal('location', { hostname: 'www.mundo3d.com' });
      const writes = stubCookieJar('m3d_user=%7B%7D');

      await clearSession();

      const userWrites = writes.filter((w) => w.startsWith('m3d_user='));
      expect(userWrites.some((w) => /domain=www\.mundo3d\.com/i.test(w))).toBe(true);
      expect(userWrites.some((w) => /domain=mundo3d\.com/i.test(w))).toBe(true);
      expect(userWrites.some((w) => !/domain=/i.test(w))).toBe(true);
    });

    // A single-label host has no parent to sweep, and `domain=com` style
    // writes must never be attempted.
    it('writes only the host-only clear on a single-label host such as localhost', async () => {
      vi.stubGlobal('location', { hostname: 'localhost' });
      const writes = stubCookieJar('m3d_user=%7B%7D');

      await clearSession();

      expect(writes.filter((w) => w.startsWith('m3d_user='))).toHaveLength(1);
      expect(writes.every((w) => !/domain=/i.test(w))).toBe(true);
    });

    it('still performs the host-only clear when no hostname is readable', async () => {
      vi.stubGlobal('location', undefined);
      const writes = stubCookieJar('m3d_user=%7B%7D');

      await clearSession();

      expect(writes.filter((w) => w.startsWith('m3d_user='))).toHaveLength(1);
      expect(writes.every((w) => !/domain=/i.test(w))).toBe(true);
    });

    // The cookie/broadcast half is UI cleanup; the request is the half that
    // actually ends the session. Cleanup failing must never cost us the
    // request — a logout that silently stops reaching the server would leave
    // the refresh family alive for its full 30 days.
    it('still sends the logout request when cookie access is unavailable', async () => {
      vi.stubGlobal('document', undefined);

      await expect(clearSession()).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toContain('/api/users/logout');
    });

    it('broadcasts before the logout response settles, so other tabs never wait on the network', async () => {
      let settle: () => void = () => {};
      fetchMock.mockImplementation(
        () => new Promise((resolve) => { settle = () => resolve({ ok: true, status: 204 }); }),
      );

      const pending = clearSession();

      expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'session-changed',
        state: 'logged-out',
      });

      settle();
      await pending;
    });
  });
});
