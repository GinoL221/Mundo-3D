import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSessionUser, hasAdminAccess, isAdminOnly } from './session.service';

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
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

  describe('clearSession', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      FakeBroadcastChannel.instances = [];
      fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
      vi.stubGlobal('fetch', fetchMock);
      vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
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
      });
    });

    it('still broadcasts even when the logout request fails (best-effort)', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(clearSession()).resolves.toBeUndefined();

      expect(FakeBroadcastChannel.instances[0].postMessage).toHaveBeenCalledWith({
        type: 'session-changed',
      });
    });
  });
});
