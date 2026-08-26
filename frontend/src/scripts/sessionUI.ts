import { hasAdminAccess, clearSession } from '../domains/auth/services/session.service';
import { CartService } from '../domains/cart/services/CartService';

type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();
const USER_COOKIE_NAME = 'm3d_user';
const SESSION_BROADCAST_CHANNEL = 'm3d-session';

function setVisibility(elements: NodeListOf<Element> | Element[], display: string) {
  elements.forEach((element) => {
    (element as HTMLElement).style.display = display;
  });
}

function readCookie(document: Document, name: string): string | null {
  const entry = document.cookie.split('; ').find((piece) => piece.startsWith(`${name}=`));
  if (!entry) return null;
  return entry.slice(name.length + 1) || null;
}

/**
 * Wires the navbar's guest/user/admin visibility, greeting, and avatar to
 * the current session, and keeps it in sync across same-tab events,
 * cross-tab logout (BroadcastChannel), and cookie-expiry/visibility
 * fallbacks (design.md "Decision: Cross-tab sync"). No longer takes a
 * `storage` param — cookies replace localStorage as of the JWT cookie
 * migration, and `update()` reads `document.cookie` directly.
 */
export function initializeSessionUI(document: Document, window: Window): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const resetToGuest = () => {
    setVisibility(document.querySelectorAll('.guest-only'), 'block');
    setVisibility(document.querySelectorAll('.user-only'), 'none');
    setVisibility(document.querySelectorAll('.admin-only'), 'none');
  };

  const update = () => {
    const raw = readCookie(document, USER_COOKIE_NAME);
    const greeting = document.getElementById('navbar-greeting');
    const avatar = document.getElementById('navbar-avatar') as HTMLImageElement | null;

    if (!raw) {
      resetToGuest();
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(raw)) as {
        firstName?: string;
        FirstName?: string;
        image?: string;
        Image?: string;
        idRole: number;
      };
      setVisibility(document.querySelectorAll('.guest-only'), 'none');
      setVisibility(document.querySelectorAll('.user-only'), 'block');
      setVisibility(
        document.querySelectorAll('.admin-only'),
        hasAdminAccess(user) ? 'block' : 'none',
      );
      if (greeting) greeting.textContent = `Hola ${user.firstName || user.FirstName || 'Usuario'}`;
      if (avatar && (user.image || user.Image))
        avatar.src = `/img/users/${user.image || user.Image}`;
    } catch {
      resetToGuest();
    }
  };

  const logout = (event: Event) => {
    event.preventDefault();
    // Fire-and-forget: the redirect never waits on the network call (same
    // "best-effort, never block" spirit as session.service.ts's
    // clearSession()).
    void clearSession();
    CartService.clearCart();
    window.location.href = '/login';
  };
  const logoutButton = document.getElementById('navbar-logout');
  const logoutListener = logoutButton ? logout : null;
  logoutButton?.addEventListener('click', logout);

  // Cookies fire no `storage` event, so cross-tab sync is composed instead
  // of the three layers below (design.md "Decision: Cross-tab sync").
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
    channel.onmessage = () => update();
  } catch {
    channel = null;
  }

  window.addEventListener('session-changed', update);
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', update);
  update();

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    if (logoutListener) logoutButton?.removeEventListener('click', logoutListener);
    window.removeEventListener('session-changed', update);
    window.removeEventListener('focus', update);
    document.removeEventListener('visibilitychange', update);
    channel?.close();
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
