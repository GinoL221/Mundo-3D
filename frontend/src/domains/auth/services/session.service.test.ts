import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getSessionUser, hasAdminAccess, isAdminOnly } from './session.service';

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe('session.service', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('getSessionUser', () => {
    it('returns null when there is no token', () => {
      localStorageMock.setItem('user', JSON.stringify({ idRole: 1 }));

      expect(getSessionUser()).toBeNull();
    });

    it('returns null when there is no stored user', () => {
      localStorageMock.setItem('token', 'abc123');

      expect(getSessionUser()).toBeNull();
    });

    it('returns the parsed user when token and user are present', () => {
      localStorageMock.setItem('token', 'abc123');
      localStorageMock.setItem('user', JSON.stringify({ idRole: 2 }));

      expect(getSessionUser()).toEqual({ idRole: 2 });
    });

    it('returns null (does not throw) on malformed/corrupt user JSON', () => {
      localStorageMock.setItem('token', 'abc123');
      localStorageMock.setItem('user', '{not-valid-json');

      expect(() => getSessionUser()).not.toThrow();
      expect(getSessionUser()).toBeNull();
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
    it('removes the token and user from localStorage', () => {
      localStorageMock.setItem('token', 'abc123');
      localStorageMock.setItem('user', JSON.stringify({ idRole: 1 }));

      clearSession();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    });
  });
});
