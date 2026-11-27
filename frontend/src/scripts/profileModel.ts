import { Role, type User } from '../domains/auth/adapters/auth.adapter';
import { resolveImageUrl } from '../lib/imageUrl';

export const DEFAULT_AVATAR_URL = '/img/users/default-avatar.png';

export interface ProfileShortcut {
  href: string;
  label: string;
  variant: 'primary' | 'secondary';
}

export interface ProfilePresentation {
  fullName: string;
  email: string;
  avatarSrc: string;
  roleLabel: string;
  roleBadgeClass: string;
  accountKindLabel: string;
  scopeSummary: string;
  demoNote: string | null;
  shortcuts: ProfileShortcut[];
}

const DEMO_NOTE_TEXT =
  'Sesión demo temporal y aislada. Los datos de esta cuenta son ficticios y se reinician al cerrar la demo.';

const SHOPPER_SHORTCUTS: ProfileShortcut[] = [
  { href: '/orders', label: 'Mis pedidos', variant: 'primary' },
  { href: '/my-commissions', label: 'Mis encargos', variant: 'secondary' },
  { href: '/', label: 'Explorar catálogo', variant: 'secondary' },
  { href: '/help#encargos', label: 'Pedir un encargo', variant: 'secondary' },
];

const WORKSHOP_SHORTCUTS: ProfileShortcut[] = [
  { href: '/admin/orders', label: 'Pedidos del taller', variant: 'primary' },
  { href: '/admin/products', label: 'Catálogo y stock', variant: 'secondary' },
  { href: '/admin/commission-requests', label: 'Solicitudes recibidas', variant: 'secondary' },
];

const ADMIN_SHORTCUTS: ProfileShortcut[] = [
  ...WORKSHOP_SHORTCUTS,
  { href: '/admin/taxonomy', label: 'Categorías y franquicias', variant: 'secondary' },
  { href: '/admin/users', label: 'Usuarios', variant: 'secondary' },
];

export function buildProfilePresentation(user: User, isDemo: boolean): ProfilePresentation {
  const combinedName = `${user.firstName} ${user.lastName}`.trim();
  const fullName = combinedName || user.email;
  const avatarSrc = resolveImageUrl(user.image, 'users') || DEFAULT_AVATAR_URL;
  const demoNote = isDemo ? DEMO_NOTE_TEXT : null;

  if (user.idRole === Role.ADMIN) {
    return {
      fullName,
      email: user.email,
      avatarSrc,
      roleLabel: 'Admin · Administración',
      roleBadgeClass: 'ui-badge ui-badge--admin',
      accountKindLabel: 'Cuenta de administración',
      scopeSummary:
        'Tenés acceso completo al taller y a la operación de la tienda. Como cuenta operativa, no usa carrito ni realiza compras personales.',
      demoNote,
      shortcuts: ADMIN_SHORTCUTS,
    };
  }

  if (user.idRole === Role.STAFF) {
    return {
      fullName,
      email: user.email,
      avatarSrc,
      roleLabel: 'Taller · Operador',
      roleBadgeClass: 'ui-badge ui-badge--staff',
      accountKindLabel: 'Cuenta operativa del taller',
      scopeSummary:
        'Podés crear y editar piezas del catálogo, ajustar stock, consultar pedidos en modo solo lectura y revisar solicitudes de encargo. No podés comprar, eliminar piezas, confirmar pagos ni ver cuentas de usuarios.',
      demoNote,
      shortcuts: WORKSHOP_SHORTCUTS,
    };
  }

  return {
    fullName,
    email: user.email,
    avatarSrc,
    roleLabel: 'Comprador',
    roleBadgeClass: 'ui-badge ui-badge--user',
    accountKindLabel: 'Cuenta de compra',
    scopeSummary:
      'Podés armar tu carrito, simular pedidos, seguir tu historial de compras y consultar tus encargos enviados. Esta cuenta no tiene acceso a las herramientas del taller ni a datos de otros usuarios.',
    demoNote,
    shortcuts: SHOPPER_SHORTCUTS,
  };
}
