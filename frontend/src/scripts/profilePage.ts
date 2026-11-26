import {
  DEMO_SESSION_EVENT,
  getSessionUser,
  hydrateDemoSession,
  isDemoSessionActive,
} from '../config';
import { fetchCurrentProfile } from '../domains/auth/services/profile.service';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';
import { buildProfilePresentation, DEFAULT_AVATAR_URL } from './profileModel';

export interface ProfilePageController {
  reload: () => Promise<void>;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

export async function initializeProfilePage(document: Document): Promise<ProfilePageController> {
  const loadingEl = document.getElementById('profile-loading');
  const guestEl = document.getElementById('profile-guest');
  const errorEl = document.getElementById('profile-error');
  const errorTextEl = document.getElementById('profile-error-text');
  const retryBtn = document.getElementById('profile-retry') as HTMLButtonElement | null;
  const contentEl = document.getElementById('profile-content');
  const avatarEl = document.getElementById('profile-avatar') as HTMLImageElement | null;
  const fullNameEl = document.getElementById('profile-full-name');
  const roleBadgeEl = document.getElementById('profile-role-badge');
  const detailNameEl = document.getElementById('profile-detail-name');
  const detailEmailEl = document.getElementById('profile-detail-email');
  const detailRoleEl = document.getElementById('profile-detail-role');
  const detailKindEl = document.getElementById('profile-detail-kind');
  const scopeSummaryEl = document.getElementById('profile-scope-summary');
  const demoNoteEl = document.getElementById('profile-demo-note');
  const demoNoteTextEl = document.getElementById('profile-demo-note-text');
  const shortcutsEl = document.getElementById('profile-shortcuts');

  let activeAttempt = 0;

  if (avatarEl) {
    avatarEl.addEventListener('error', () => {
      if (avatarEl.src && !avatarEl.src.endsWith(DEFAULT_AVATAR_URL)) {
        avatarEl.src = DEFAULT_AVATAR_URL;
      }
    });
  }

  const showOnly = (target: 'loading' | 'guest' | 'error' | 'content'): void => {
    setHidden(loadingEl, target !== 'loading');
    setHidden(guestEl, target !== 'guest');
    setHidden(errorEl, target !== 'error');
    setHidden(contentEl, target !== 'content');
  };

  const loadProfile = async (): Promise<void> => {
    activeAttempt += 1;
    const attempt = activeAttempt;

    showOnly('loading');

    if (isDemoSessionPendingHydration()) {
      await hydrateDemoSession();
    }
    if (attempt !== activeAttempt) return;

    if (!getSessionUser()) {
      showOnly('guest');
      return;
    }

    const result = await fetchCurrentProfile();
    if (attempt !== activeAttempt) return;

    if (!result.ok) {
      if (result.code === 'UNAUTHENTICATED') {
        showOnly('guest');
        return;
      }
      if (errorTextEl) errorTextEl.textContent = result.message;
      showOnly('error');
      return;
    }

    const view = buildProfilePresentation(result.user, isDemoSessionActive());

    if (avatarEl) {
      avatarEl.src = view.avatarSrc;
      avatarEl.alt = '';
    }
    if (fullNameEl) fullNameEl.textContent = view.fullName;
    if (roleBadgeEl) {
      roleBadgeEl.textContent = view.roleLabel;
      roleBadgeEl.className = view.roleBadgeClass;
    }
    if (detailNameEl) detailNameEl.textContent = view.fullName;
    if (detailEmailEl) detailEmailEl.textContent = view.email;
    if (detailRoleEl) detailRoleEl.textContent = view.roleLabel;
    if (detailKindEl) detailKindEl.textContent = view.accountKindLabel;
    if (scopeSummaryEl) scopeSummaryEl.textContent = view.scopeSummary;

    if (view.demoNote) {
      if (demoNoteTextEl) demoNoteTextEl.textContent = view.demoNote;
      setHidden(demoNoteEl, false);
    } else {
      setHidden(demoNoteEl, true);
    }

    if (shortcutsEl) {
      const items = view.shortcuts.map((shortcut) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = shortcut.href;
        link.className =
          shortcut.variant === 'primary' ? 'ui-btn ui-btn--primary' : 'ui-btn ui-btn--secondary';
        link.textContent = shortcut.label;
        li.append(link);
        return li;
      });
      shortcutsEl.replaceChildren(...items);
    }

    showOnly('content');
  };

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      void loadProfile();
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onSessionChange = () => {
      void loadProfile();
    };
    window.addEventListener('session-changed', onSessionChange);
    window.addEventListener(DEMO_SESSION_EVENT, onSessionChange);
  }

  await loadProfile();

  return { reload: loadProfile };
}
