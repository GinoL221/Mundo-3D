import { hydrateDemoSession, isDemoSessionActive } from '../config';
import { getSessionUser, isAdminOnly, Role, type User } from '../domains/auth';
import { fetchAdminUsers } from '../domains/auth/services/user.admin.service';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';

export interface AdminUsersController {
  reload: () => Promise<void>;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

function resolveRolePresentation(idRole: number): { label: string; badgeClass: string } {
  if (idRole === Role.ADMIN) return { label: 'ADMIN', badgeClass: 'ui-badge ui-badge--admin' };
  if (idRole === Role.STAFF) return { label: 'STAFF', badgeClass: 'ui-badge ui-badge--staff' };
  return { label: 'Comprador', badgeClass: 'ui-badge ui-badge--user' };
}

function renderUserRow(document: Document, user: User): HTMLTableRowElement {
  const tr = document.createElement('tr');

  const idCell = document.createElement('th');
  idCell.setAttribute('scope', 'row');
  idCell.setAttribute('data-label', 'ID');
  idCell.className = 'admin-users__id';
  idCell.textContent = `#${user.id}`;

  const nameCell = document.createElement('td');
  nameCell.setAttribute('data-label', 'Nombre');
  nameCell.className = 'admin-users__name';
  nameCell.textContent = `${user.firstName} ${user.lastName}`.trim() || '—';

  const emailCell = document.createElement('td');
  emailCell.setAttribute('data-label', 'Correo electrónico');
  emailCell.className = 'admin-users__email';
  emailCell.textContent = user.email;

  const roleCell = document.createElement('td');
  roleCell.setAttribute('data-label', 'Rol');
  const roleInfo = resolveRolePresentation(user.idRole);
  const badge = document.createElement('span');
  badge.className = roleInfo.badgeClass;
  badge.textContent = roleInfo.label;
  roleCell.append(badge);

  tr.append(idCell, nameCell, emailCell, roleCell);
  return tr;
}

export async function initializeAdminUsers(document: Document): Promise<AdminUsersController> {
  const deniedEl = document.getElementById('admin-gate-denied');
  const contentEl = document.getElementById('admin-users-content');
  const countEl = document.getElementById('admin-users-count');
  const demoNoteEl = document.getElementById('admin-users-demo-note');
  const loadingEl = document.getElementById('admin-users-loading');
  const errorEl = document.getElementById('admin-users-error');
  const errorTextEl = document.getElementById('admin-users-error-text');
  const retryBtn = document.getElementById('admin-users-retry') as HTMLButtonElement | null;
  const emptyEl = document.getElementById('admin-users-empty');
  const tableWrapEl = document.getElementById('admin-users-table-wrap');
  const listEl = document.getElementById('admin-users-list');

  let activeAttempt = 0;

  const loadUsers = async (): Promise<void> => {
    if (!loadingEl || !errorEl || !emptyEl || !tableWrapEl || !listEl) return;

    activeAttempt += 1;
    const attempt = activeAttempt;

    if (retryBtn) retryBtn.disabled = true;
    loadingEl.setAttribute('aria-busy', 'true');
    setHidden(loadingEl, false);
    setHidden(errorEl, true);
    setHidden(emptyEl, true);
    setHidden(tableWrapEl, true);
    listEl.replaceChildren();

    try {
      const result = await fetchAdminUsers();
      if (attempt !== activeAttempt) return;

      loadingEl.removeAttribute('aria-busy');
      setHidden(loadingEl, true);

      if (!result.ok) {
        if (errorTextEl) errorTextEl.textContent = result.message;
        setHidden(errorEl, false);
        return;
      }

      if (countEl) {
        countEl.textContent = result.count === 1 ? '1 cuenta' : `${result.count} cuentas`;
      }

      if (result.users.length === 0) {
        setHidden(emptyEl, false);
        return;
      }

      listEl.replaceChildren(...result.users.map((u) => renderUserRow(document, u)));
      setHidden(tableWrapEl, false);
    } finally {
      if (retryBtn && attempt === activeAttempt) {
        retryBtn.disabled = false;
      }
    }
  };

  let sessionUser = getSessionUser();
  if (!isAdminOnly(sessionUser) && isDemoSessionPendingHydration()) {
    await hydrateDemoSession();
    sessionUser = getSessionUser();
  }
  if (!isAdminOnly(sessionUser)) {
    setHidden(contentEl, true);
    setHidden(deniedEl, false);
    return { reload: loadUsers };
  }

  setHidden(demoNoteEl, !isDemoSessionActive());
  setHidden(deniedEl, true);
  setHidden(contentEl, false);

  retryBtn?.addEventListener('click', () => {
    void loadUsers();
  });

  await loadUsers();
  return { reload: loadUsers };
}
