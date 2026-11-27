import type { DemoRole } from '../config';

export interface DemoBarPresentation {
  roleLabel: 'Comprador' | 'Taller' | 'Admin';
  roleBadgeClass: string;
  summaryText: string;
}

export interface DemoNoticePresentation {
  tone: 'info' | 'warning';
  title: string;
  text: string;
  retryLabel?: string;
}

export type DemoNoticeKind = 'disabled' | 'busy' | 'rate-limit' | 'error' | 'expired';

export function buildDemoBarPresentation(role: DemoRole): DemoBarPresentation {
  if (role === 'ADMIN') {
    return {
      roleLabel: 'Admin',
      roleBadgeClass: 'ui-badge ui-badge--admin',
      summaryText:
        'Sesión aislada · acceso completo al taller: confirmar/cancelar pedidos, eliminar piezas, categorías/franquicias y usuarios del slot.',
    };
  }
  if (role === 'STAFF') {
    return {
      roleLabel: 'Taller',
      roleBadgeClass: 'ui-badge ui-badge--staff',
      summaryText:
        'Sesión aislada · podés ver pedidos, ajustar stock, editar el catálogo y revisar solicitudes. Sin eliminar piezas ni tocar pagos.',
    };
  }
  return {
    roleLabel: 'Comprador',
    roleBadgeClass: 'ui-badge ui-badge--user',
    summaryText: 'Sesión temporal aislada · los cambios se reinician al salir.',
  };
}

export function buildDemoNotice(
  kind: DemoNoticeKind,
  retryAfterSeconds = 30,
): DemoNoticePresentation {
  switch (kind) {
    case 'disabled':
      return {
        tone: 'info',
        title: 'El modo demo no está disponible en este momento',
        text: 'Podés seguir navegando la tienda normalmente.',
      };
    case 'busy':
      return {
        tone: 'warning',
        title: 'Todas las sesiones demo están ocupadas',
        text: `Hay otras pruebas activas ahora. Intentá de nuevo en unos ${retryAfterSeconds} segundos.`,
        retryLabel: 'Reintentar',
      };
    case 'rate-limit':
      return {
        tone: 'warning',
        title: 'Demasiados intentos en poco tiempo',
        text: 'Esperá unos minutos antes de abrir otra sesión demo.',
      };
    case 'expired':
      return {
        tone: 'info',
        title: 'Tu sesión demo venció',
        text: 'Los cambios temporales de esa sesión se descartaron. Podés abrir una nueva sesión para seguir probando.',
        retryLabel: 'Iniciar nueva sesión demo',
      };
    case 'error':
      return {
        tone: 'warning',
        title: 'No pudimos iniciar la sesión demo',
        text: 'Verificá la conexión e intentá de nuevo.',
        retryLabel: 'Reintentar',
      };
  }
}

export function isAdminOnlyPath(pathname: string): boolean {
  return pathname === '/admin/taxonomy' || pathname === '/admin/users';
}

export function isDemoProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname === '/orders' ||
    pathname === '/order' ||
    pathname === '/my-commissions' ||
    pathname === '/profile'
  );
}
