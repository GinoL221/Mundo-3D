import { describe, expect, it } from 'vitest';
import { Role, type User } from '../domains/auth/adapters/auth.adapter';
import { buildProfilePresentation, DEFAULT_AVATAR_URL } from './profileModel';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    firstName: 'Gino',
    lastName: 'Lencina',
    email: 'gino@email.com',
    image: '',
    idRole: Role.USER,
    ...overrides,
  };
}

describe('buildProfilePresentation', () => {
  it('builds buyer presentation with default avatar fallback and shopper shortcuts', () => {
    const view = buildProfilePresentation(makeUser({ idRole: Role.USER, image: '' }), false);

    expect(view.fullName).toBe('Gino Lencina');
    expect(view.email).toBe('gino@email.com');
    expect(view.avatarSrc).toBe(DEFAULT_AVATAR_URL);
    expect(view.roleLabel).toBe('Comprador');
    expect(view.roleBadgeClass).toBe('ui-badge ui-badge--user');
    expect(view.accountKindLabel).toBe('Cuenta de compra');
    expect(view.scopeSummary).toMatch(/carrito|pedidos/i);
    expect(view.demoNote).toBeNull();
    expect(view.shortcuts.map((s) => s.href)).toEqual(['/orders', '/', '/help#encargos']);
  });

  it('builds STAFF presentation with workshop shortcuts, custom image resolution, and demo note', () => {
    const view = buildProfilePresentation(
      makeUser({
        id: 2,
        firstName: 'Lucía',
        lastName: 'Taller',
        email: 'staff@email.com',
        image: 'staff-avatar.png',
        idRole: Role.STAFF,
      }),
      true,
    );

    expect(view.fullName).toBe('Lucía Taller');
    expect(view.avatarSrc).toBe('/img/users/staff-avatar.png');
    expect(view.roleLabel).toBe('STAFF · Taller');
    expect(view.roleBadgeClass).toBe('ui-badge ui-badge--staff');
    expect(view.accountKindLabel).toBe('Cuenta operativa del taller');
    expect(view.scopeSummary).toMatch(/no podés comprar/i);
    expect(view.demoNote).toMatch(/demo/i);
    expect(view.shortcuts.map((s) => s.href)).toEqual([
      '/admin/orders',
      '/admin/products',
      '/admin/commission-requests',
    ]);
  });

  it('builds ADMIN presentation with admin badge and operational shortcuts', () => {
    const view = buildProfilePresentation(
      makeUser({
        firstName: 'Admin',
        lastName: 'Owner',
        email: 'admin@email.com',
        image: 'https://cdn.example.com/admin.webp',
        idRole: Role.ADMIN,
      }),
      false,
    );

    expect(view.avatarSrc).toBe('https://cdn.example.com/admin.webp');
    expect(view.roleLabel).toBe('ADMIN · Administración');
    expect(view.roleBadgeClass).toBe('ui-badge ui-badge--admin');
    expect(view.accountKindLabel).toBe('Cuenta de administración');
    expect(view.demoNote).toBeNull();
    expect(view.shortcuts.map((s) => s.href)).toEqual([
      '/admin/orders',
      '/admin/products',
      '/admin/commission-requests',
    ]);
  });
});
