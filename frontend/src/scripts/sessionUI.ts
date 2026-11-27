import {
  DEMO_SESSION_EVENT,
  demoRoleToId,
  endDemoSession,
  getDemoSession,
  isDemoSessionActive,
  isOperationalRole,
} from '../config';
import { hasAdminAccess, isAdminOnly, clearSession } from '../domains/auth/services/session.service';
import type { SessionChangedMessage } from '../domains/auth/services/session.service';
import { CartService } from '../domains/cart/services/CartService';
import { resolveImageUrl } from '../lib/imageUrl';

type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();
const USER_COOKIE_NAME = 'm3d_user';
const SESSION_BROADCAST_CHANNEL = 'm3d-session';
const DEFAULT_AVATAR_URL = '/img/users/default-avatar.png';

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

  const userMenuTrigger = document.getElementById(
    'navbar-user-menu-trigger',
  ) as HTMLButtonElement | null;
  const userMenu = document.getElementById('navbar-user-menu');
  const workshopMenuTrigger = document.getElementById(
    'navbar-workshop-trigger',
  ) as HTMLButtonElement | null;
  const workshopMenu = document.getElementById('navbar-workshop-menu');
  let userMenuOpen = false;
  let workshopMenuOpen = false;

  const setWorkshopMenuOpen = (open: boolean, restoreFocus = false) => {
    if (!workshopMenuTrigger || !workshopMenu) return;
    workshopMenuOpen = open;
    workshopMenuTrigger.setAttribute('aria-expanded', String(open));
    workshopMenu.hidden = !open;
    if (open) {
      if (userMenuOpen) setUserMenuOpen(false);
      workshopMenu.querySelector('a')?.focus();
    } else if (restoreFocus) {
      workshopMenuTrigger.focus();
    }
  };

  const setUserMenuOpen = (open: boolean, restoreFocus = false) => {
    if (!userMenuTrigger || !userMenu) return;
    userMenuOpen = open;
    userMenuTrigger.setAttribute('aria-expanded', String(open));
    userMenu.hidden = !open;
    if (open) {
      if (workshopMenuOpen) setWorkshopMenuOpen(false);
      userMenu.querySelector('a')?.focus();
    } else if (restoreFocus) {
      userMenuTrigger.focus();
    }
  };

  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);
  const toggleWorkshopMenu = () => setWorkshopMenuOpen(!workshopMenuOpen);
  const handleMenuKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (userMenuOpen) {
      event.preventDefault();
      setUserMenuOpen(false, true);
    } else if (workshopMenuOpen) {
      event.preventDefault();
      setWorkshopMenuOpen(false, true);
    }
  };
  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (userMenuOpen && userMenu && target && !userMenu.parentElement?.contains(target)) {
      setUserMenuOpen(false);
    }
    if (
      workshopMenuOpen &&
      workshopMenu &&
      target &&
      !workshopMenu.parentElement?.contains(target)
    ) {
      setWorkshopMenuOpen(false);
    }
  };

  const closeMiniCart = () => {
    const cartMenu = document.getElementById('navbar-cart-menu');
    const cartTrigger = document.getElementById('navbar-cart-trigger');
    if (cartMenu) cartMenu.hidden = true;
    cartTrigger?.setAttribute('aria-expanded', 'false');
  };

  const resetToGuest = () => {
    setUserMenuOpen(false);
    setWorkshopMenuOpen(false);
    setVisibility(document.querySelectorAll('.guest-only'), 'block');
    setVisibility(document.querySelectorAll('.user-only'), 'none');
    setVisibility(document.querySelectorAll('.admin-only'), 'none');
    setVisibility(document.querySelectorAll('.admin-strict-only'), 'none');
    setVisibility(document.querySelectorAll('.buyer-only'), '');
  };

  const update = () => {
    const greeting = document.getElementById('navbar-greeting');
    const avatar = document.getElementById('navbar-avatar') as HTMLImageElement | null;

    const demoSession = getDemoSession();
    if (demoSession) {
      const idRole = demoRoleToId(demoSession.role);
      const showWorkshop = hasAdminAccess({ idRole });
      const showAdminOnly = isAdminOnly({ idRole });
      const operational = isOperationalRole({ idRole });
      if (!showWorkshop) setWorkshopMenuOpen(false);
      if (operational) closeMiniCart();
      setVisibility(document.querySelectorAll('.guest-only'), 'none');
      setVisibility(document.querySelectorAll('.user-only'), 'block');
      setVisibility(document.querySelectorAll('.admin-only'), showWorkshop ? 'block' : 'none');
      setVisibility(
        document.querySelectorAll('.admin-strict-only'),
        showAdminOnly ? 'block' : 'none',
      );
      setVisibility(document.querySelectorAll('.buyer-only'), operational ? 'none' : '');
      if (greeting) {
        greeting.textContent = 'Cuenta demo';
      }
      if (avatar) avatar.src = DEFAULT_AVATAR_URL;
      return;
    }

    const raw = readCookie(document, USER_COOKIE_NAME);

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
      const showWorkshop = hasAdminAccess(user);
      const showAdminOnly = isAdminOnly(user);
      const operational = isOperationalRole(user);
      if (!showWorkshop) setWorkshopMenuOpen(false);
      if (operational) closeMiniCart();
      setVisibility(document.querySelectorAll('.guest-only'), 'none');
      setVisibility(document.querySelectorAll('.user-only'), 'block');
      setVisibility(document.querySelectorAll('.admin-only'), showWorkshop ? 'block' : 'none');
      setVisibility(
        document.querySelectorAll('.admin-strict-only'),
        showAdminOnly ? 'block' : 'none',
      );
      setVisibility(document.querySelectorAll('.buyer-only'), operational ? 'none' : '');
      if (greeting) greeting.textContent = `Hola ${user.firstName || user.FirstName || 'Usuario'}`;
      if (avatar) {
        const resolvedAvatar = resolveImageUrl(user.image || user.Image, 'users');
        if (resolvedAvatar) {
          avatar.src = resolvedAvatar;
        } else if (avatar.src && !avatar.src.endsWith(DEFAULT_AVATAR_URL)) {
          avatar.src = DEFAULT_AVATAR_URL;
        }
      }
    } catch {
      resetToGuest();
    }
  };

  const logout = (event: Event) => {
    event.preventDefault();
    if (isDemoSessionActive()) {
      void (async () => {
        await endDemoSession();
        try {
          localStorage.removeItem('m3d_demo_cart');
        } catch {
          // Ignore storage errors.
        }
        CartService.loadCartFromStorage();
        window.location.href = '/';
      })();
      return;
    }
    // Fire-and-forget: the redirect never waits on the network call (same
    // "best-effort, never block" spirit as session.service.ts's
    // clearSession()).
    void clearSession();
    CartService.clearCart();
    window.location.href = '/login';
  };
  const logoutButton = document.getElementById('navbar-logout');
  const logoutListener = logoutButton ? logout : null;
  const avatarElement = document.getElementById('navbar-avatar') as HTMLImageElement | null;
  const handleAvatarError = () => {
    if (avatarElement && avatarElement.src && !avatarElement.src.endsWith(DEFAULT_AVATAR_URL)) {
      avatarElement.src = DEFAULT_AVATAR_URL;
    }
  };
  avatarElement?.addEventListener?.('error', handleAvatarError);
  logoutButton?.addEventListener('click', logout);
  userMenuTrigger?.addEventListener('click', toggleUserMenu);
  workshopMenuTrigger?.addEventListener('click', toggleWorkshopMenu);
  const hasAnyMenu = Boolean((userMenuTrigger && userMenu) || (workshopMenuTrigger && workshopMenu));
  if (hasAnyMenu) {
    document.addEventListener('keydown', handleMenuKeydown);
    document.addEventListener('click', handleDocumentClick);
  }

  // Cookies fire no `storage` event, so cross-tab sync is composed instead
  // of the three layers below (design.md "Decision: Cross-tab sync").
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const state = (event?.data as Partial<SessionChangedMessage> | undefined)?.state;
      // A logout is acted on, not re-derived. The sending tab expired the
      // cookies in ITS document; under site isolation that deletion still has
      // to reach this renderer, so `update()` here can read a session that is
      // already dead and — since nothing retries — leave this navbar showing
      // a logged-in user forever. The sender is authoritative about the
      // session having ended, so believe the message and skip the cookie.
      if (state === 'logged-out') {
        resetToGuest();
        return;
      }
      // Everything else, INCLUDING a message with no `state`, re-reads the
      // cookie. That fallback is deliberate: a tab loaded before `state`
      // shipped still posts the old intentless `{ type: 'session-changed' }`,
      // and its logout must keep reaching tabs loaded after.
      update();
    };
  } catch {
    channel = null;
  }

  window.addEventListener('session-changed', update);
  window.addEventListener(DEMO_SESSION_EVENT, update);
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', update);
  update();

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    if (logoutListener) logoutButton?.removeEventListener('click', logoutListener);
    avatarElement?.removeEventListener?.('error', handleAvatarError);
    userMenuTrigger?.removeEventListener('click', toggleUserMenu);
    workshopMenuTrigger?.removeEventListener('click', toggleWorkshopMenu);
    if (hasAnyMenu) {
      document.removeEventListener('keydown', handleMenuKeydown);
      document.removeEventListener('click', handleDocumentClick);
    }
    window.removeEventListener('session-changed', update);
    window.removeEventListener(DEMO_SESSION_EVENT, update);
    window.removeEventListener('focus', update);
    document.removeEventListener('visibilitychange', update);
    channel?.close();
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
