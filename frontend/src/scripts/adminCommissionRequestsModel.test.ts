import { describe, expect, it } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';
import type { CustomCommissionRequestDTO } from '../domains/commissions/services/customCommissionRequest.admin.service';
import {
  buildCommissionPieceReference,
  buildCommissionRequestItemViewModel,
  buildSafeMailtoHref,
  formatCommissionDate,
  formatCommissionDatesLabel,
  resolveAdminRoleBadge,
} from './adminCommissionRequestsModel';

describe('adminCommissionRequestsModel', () => {
  describe('resolveAdminRoleBadge', () => {
    it('maps ADMIN and STAFF roles to their Spanish 4px monospace badge modifiers', () => {
      expect(resolveAdminRoleBadge({ idRole: Role.ADMIN })).toEqual({
        label: 'Admin',
        modifierClass: 'ui-badge--admin',
      });
      expect(resolveAdminRoleBadge({ idRole: Role.STAFF })).toEqual({
        label: 'Taller',
        modifierClass: 'ui-badge--staff',
      });
    });

    it('returns null for USER, anonymous, or unknown roles', () => {
      expect(resolveAdminRoleBadge(null)).toBeNull();
      expect(resolveAdminRoleBadge({ idRole: Role.USER })).toBeNull();
      expect(resolveAdminRoleBadge({ idRole: 99 })).toBeNull();
    });
  });

  describe('date formatting', () => {
    it('formats valid ISO timestamps in es-AR dd/mm/yyyy format', () => {
      expect(formatCommissionDate('2026-04-12T15:30:00.000Z', { timeZone: 'UTC' })).toBe(
        '12/04/2026',
      );
      expect(formatCommissionDate('2026-05-12T15:30:00.000Z', { timeZone: 'UTC' })).toBe(
        '12/05/2026',
      );
    });

    it('returns null for invalid or empty timestamps', () => {
      expect(formatCommissionDate('')).toBeNull();
      expect(formatCommissionDate('not-a-date')).toBeNull();
    });

    it('builds the received and expiration label with fallback handling', () => {
      expect(
        formatCommissionDatesLabel(
          '2026-04-12T12:00:00.000Z',
          '2026-05-12T12:00:00.000Z',
          { timeZone: 'UTC' },
        ),
      ).toBe('Recibida el 12/04/2026 · Vence el 12/05/2026');

      expect(
        formatCommissionDatesLabel('2026-04-12T12:00:00.000Z', '', { timeZone: 'UTC' }),
      ).toBe('Recibida el 12/04/2026');

      expect(
        formatCommissionDatesLabel('', '2026-05-12T12:00:00.000Z', { timeZone: 'UTC' }),
      ).toBe('Vence el 12/05/2026');

      expect(formatCommissionDatesLabel('invalid', 'invalid')).toBe('Fecha no disponible');
    });
  });

  describe('buildCommissionPieceReference', () => {
    it('returns "Sin pieza asociada" when idProduct is null, non-integer, or invalid', () => {
      expect(buildCommissionPieceReference(null)).toEqual({
        kind: 'none',
        label: 'Sin pieza asociada',
      });
      expect(buildCommissionPieceReference(0)).toEqual({
        kind: 'none',
        label: 'Sin pieza asociada',
      });
      expect(buildCommissionPieceReference(-4)).toEqual({
        kind: 'none',
        label: 'Sin pieza asociada',
      });
      expect(buildCommissionPieceReference(1.5)).toEqual({
        kind: 'none',
        label: 'Sin pieza asociada',
      });
      expect(buildCommissionPieceReference(Number.NaN)).toEqual({
        kind: 'none',
        label: 'Sin pieza asociada',
      });
    });

    it('builds a product detail link with fallback ID label and catalog name override', () => {
      expect(buildCommissionPieceReference(7)).toEqual({
        kind: 'link',
        idProduct: 7,
        href: '/product?id=7',
        label: 'Pieza #7',
      });

      expect(buildCommissionPieceReference(1, '  Mario Bros Coleccionable  ')).toEqual({
        kind: 'link',
        idProduct: 1,
        href: '/product?id=1',
        label: 'Pieza: Mario Bros Coleccionable',
      });
    });
  });

  describe('buildSafeMailtoHref', () => {
    it('returns a mailto href for clean email addresses including plus addressing', () => {
      expect(buildSafeMailtoHref('  lucia@ejemplo.com  ')).toBe('mailto:lucia@ejemplo.com');
      expect(buildSafeMailtoHref('ana.perez+taller@ejemplo.com')).toBe(
        'mailto:ana.perez+taller@ejemplo.com',
      );
    });

    it('rejects empty strings, whitespace, control characters, and mailto header/URI injection payloads', () => {
      expect(buildSafeMailtoHref('')).toBeNull();
      expect(buildSafeMailtoHref('bad email@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('bad\n@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('bad\u0000@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a?cc=evil%40x.com&body=hi@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a?subject=Hola&body=x@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a#frag@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a%0Abcc=evil@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a/b@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a\\b@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a:b@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a<b>@ejemplo.com')).toBeNull();
      expect(buildSafeMailtoHref('a"b@ejemplo.com')).toBeNull();
    });
  });

  describe('buildCommissionRequestItemViewModel', () => {
    const baseRequest: CustomCommissionRequestDTO = {
      idCustomCommissionRequest: 42,
      name: '  Lucía Fernández  ',
      email: 'lucia.fernandez@ejemplo.com',
      phone: '  +54 9 11 0000-0101  ',
      idea: 'Necesito dos unidades en escala de 18 cm con base lisa.',
      idProduct: 1,
      createdAt: '2026-04-12T12:00:00.000Z',
      expiresAt: '2026-05-12T12:00:00.000Z',
    };

    it('combines requester, mailto, plain-text phone, dates, idea, and resolved catalog piece', () => {
      const catalog = new Map<number, string>([[1, 'Mario Bros Coleccionable']]);
      expect(
        buildCommissionRequestItemViewModel(baseRequest, catalog, { timeZone: 'UTC' }),
      ).toEqual({
        id: 42,
        requesterName: 'Lucía Fernández',
        emailLabel: 'lucia.fernandez@ejemplo.com',
        mailtoHref: 'mailto:lucia.fernandez@ejemplo.com',
        phoneLabel: '+54 9 11 0000-0101',
        datesLabel: 'Recibida el 12/04/2026 · Vence el 12/05/2026',
        idea: 'Necesito dos unidades en escala de 18 cm con base lisa.',
        piece: {
          kind: 'link',
          idProduct: 1,
          href: '/product?id=1',
          label: 'Pieza: Mario Bros Coleccionable',
        },
      });
    });

    it('handles requests without a linked product', () => {
      const unlinked: CustomCommissionRequestDTO = {
        ...baseRequest,
        idCustomCommissionRequest: 43,
        idProduct: null,
      };
      expect(
        buildCommissionRequestItemViewModel(unlinked, undefined, { timeZone: 'UTC' }).piece,
      ).toEqual({
        kind: 'none',
        label: 'Sin pieza asociada',
      });
    });

    it('trims surrounding whitespace on idea while preserving line breaks and falling back when blank', () => {
      const multiline: CustomCommissionRequestDTO = {
        ...baseRequest,
        idea: '  Primera línea\nSegunda línea  ',
      };
      expect(
        buildCommissionRequestItemViewModel(multiline, undefined, { timeZone: 'UTC' }).idea,
      ).toBe('Primera línea\nSegunda línea');

      const blank: CustomCommissionRequestDTO = {
        ...baseRequest,
        idea: '   \n  ',
      };
      expect(
        buildCommissionRequestItemViewModel(blank, undefined, { timeZone: 'UTC' }).idea,
      ).toBe('Sin detalle');
    });
  });
});
