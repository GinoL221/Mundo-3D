import type { SessionUser } from '../config';
import { Role } from '../domains/auth/adapters/auth.adapter';
import type { CustomCommissionRequestDTO } from '../domains/commissions/services/customCommissionRequest.admin.service';

export interface AdminRoleBadge {
  label: 'ADMIN' | 'STAFF';
  modifierClass: 'ui-badge--admin' | 'ui-badge--staff';
}

export type CommissionPieceReference =
  | {
      kind: 'link';
      idProduct: number;
      href: string;
      label: string;
    }
  | {
      kind: 'none';
      label: 'Sin pieza asociada';
    };

export interface CommissionRequestItemViewModel {
  id: number;
  requesterName: string;
  emailLabel: string;
  mailtoHref: string | null;
  datesLabel: string;
  idea: string;
  piece: CommissionPieceReference;
}

export interface DateFormatOptions {
  timeZone?: string;
}

export function resolveAdminRoleBadge(user: SessionUser | null): AdminRoleBadge | null {
  if (user?.idRole === Role.ADMIN) {
    return { label: 'ADMIN', modifierClass: 'ui-badge--admin' };
  }
  if (user?.idRole === Role.STAFF) {
    return { label: 'STAFF', modifierClass: 'ui-badge--staff' };
  }
  return null;
}

export function formatCommissionDate(
  isoString: string,
  options?: DateFormatOptions,
): string | null {
  if (!isoString) return null;
  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) return null;

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(new Date(timestamp));
}

export function formatCommissionDatesLabel(
  createdAt: string,
  expiresAt: string,
  options?: DateFormatOptions,
): string {
  const received = formatCommissionDate(createdAt, options);
  const expires = formatCommissionDate(expiresAt, options);

  if (received && expires) {
    return `Recibida el ${received} · Vence el ${expires}`;
  }
  if (received) {
    return `Recibida el ${received}`;
  }
  if (expires) {
    return `Vence el ${expires}`;
  }
  return 'Fecha no disponible';
}

export function buildCommissionPieceReference(
  idProduct: number | null,
  productName?: string | null,
): CommissionPieceReference {
  if (idProduct === null || !Number.isInteger(idProduct) || idProduct <= 0) {
    return { kind: 'none', label: 'Sin pieza asociada' };
  }

  const trimmedName = productName?.trim();
  return {
    kind: 'link',
    idProduct,
    href: `/product?id=${idProduct}`,
    label: trimmedName ? `Pieza: ${trimmedName}` : `Pieza #${idProduct}`,
  };
}

export function buildSafeMailtoHref(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return null;
  }
  return `mailto:${trimmed}`;
}

export function buildCommissionRequestItemViewModel(
  request: CustomCommissionRequestDTO,
  catalogById?: ReadonlyMap<number, string>,
  dateOptions?: DateFormatOptions,
): CommissionRequestItemViewModel {
  const emailLabel = request.email.trim();
  const productName =
    request.idProduct !== null ? (catalogById?.get(request.idProduct) ?? null) : null;

  return {
    id: request.idCustomCommissionRequest,
    requesterName: request.name.trim() || 'Sin nombre',
    emailLabel,
    mailtoHref: buildSafeMailtoHref(emailLabel),
    datesLabel: formatCommissionDatesLabel(request.createdAt, request.expiresAt, dateOptions),
    idea: request.idea.trim() || 'Sin detalle',
    piece: buildCommissionPieceReference(request.idProduct, productName),
  };
}
