import { hasAdminAccess, clearSession } from '../domains/auth/services/session.service';
import { CartService } from '../domains/cart/services/CartService';

type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();

function setVisibility(elements: NodeListOf<Element> | Element[], display: string) {
  elements.forEach((element) => {
    (element as HTMLElement).style.display = display;
  });
}

export function initializeSessionUI(document: Document, window: Window, storage: Storage): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const resetToGuest = () => {
    setVisibility(document.querySelectorAll('.guest-only'), 'block');
    setVisibility(document.querySelectorAll('.user-only'), 'none');
    setVisibility(document.querySelectorAll('.admin-only'), 'none');
  };

  const update = () => {
    const token = storage.getItem('token');
    const userJson = storage.getItem('user');
    const greeting = document.getElementById('navbar-greeting');
    const avatar = document.getElementById('navbar-avatar') as HTMLImageElement | null;

    if (!token || !userJson) {
      resetToGuest();
      return;
    }

    try {
      const user = JSON.parse(userJson) as {
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
      storage.removeItem('token');
      storage.removeItem('user');
      resetToGuest();
    }
  };

  const logout = (event: Event) => {
    event.preventDefault();
    clearSession();
    CartService.clearCart();
    window.location.href = '/login';
  };
  const logoutButton = document.getElementById('navbar-logout');
  const logoutListener = logoutButton ? logout : null;
  logoutButton?.addEventListener('click', logout);
  window.addEventListener('storage', update);
  window.addEventListener('session-changed', update);
  update();

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    if (logoutListener) logoutButton?.removeEventListener('click', logoutListener);
    window.removeEventListener('storage', update);
    window.removeEventListener('session-changed', update);
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
