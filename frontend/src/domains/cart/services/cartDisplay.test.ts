import { describe, expect, it } from 'vitest';
import {
  countCartPieces,
  formatCartPieceCount,
  formatSyncErrorMessage,
  getCheckoutButtonLabel,
  getHydrationErrorMessage,
} from './cartDisplay';

describe('cartDisplay helpers', () => {
  describe('countCartPieces', () => {
    it('returns 0 for an empty list', () => {
      expect(countCartPieces([])).toBe(0);
    });

    it('sums quantities across all cart items', () => {
      expect(countCartPieces([{ quantity: 2 }, { quantity: 1 }])).toBe(3);
      expect(countCartPieces([{ quantity: 1 }])).toBe(1);
    });
  });

  describe('formatCartPieceCount', () => {
    it('uses singular for 1 pieza and plural for 0 or multiple piezas', () => {
      expect(formatCartPieceCount(1)).toBe('1 pieza');
      expect(formatCartPieceCount(3)).toBe('3 piezas');
      expect(formatCartPieceCount(0)).toBe('0 piezas');
    });
  });

  describe('getCheckoutButtonLabel', () => {
    it('returns busy label when checkout is in flight', () => {
      expect(getCheckoutButtonLabel(true, true)).toBe('Procesando…');
      expect(getCheckoutButtonLabel(false, true)).toBe('Procesando…');
    });

    it('returns checkout CTA for authenticated users and login CTA for guests', () => {
      expect(getCheckoutButtonLabel(true)).toBe('Finalizar compra');
      expect(getCheckoutButtonLabel(false)).toBe('Iniciá sesión para finalizar');
    });
  });

  describe('getHydrationErrorMessage', () => {
    it('returns a visible fallback message on network or http failures', () => {
      expect(getHydrationErrorMessage({ ok: false, reason: 'network' })).toBe(
        'No pudimos traer tu carrito guardado. Te mostramos el de este dispositivo.',
      );
      expect(getHydrationErrorMessage({ ok: false, reason: 'http' })).toBe(
        'No pudimos traer tu carrito guardado. Te mostramos el de este dispositivo.',
      );
    });

    it('returns null for ok, guest, or superseded hydration results', () => {
      expect(getHydrationErrorMessage({ ok: true })).toBeNull();
      expect(getHydrationErrorMessage({ ok: false, reason: 'guest' })).toBeNull();
      expect(getHydrationErrorMessage({ ok: false, reason: 'superseded' })).toBeNull();
    });
  });

  describe('formatSyncErrorMessage', () => {
    it('appends recovery guidance to the provided error message', () => {
      expect(formatSyncErrorMessage('Error de red.')).toBe(
        'Error de red. Revisá tu conexión y volvé a intentar el cambio.',
      );
    });

    it('falls back to the default message when detail is missing or blank', () => {
      expect(formatSyncErrorMessage()).toBe(
        'No se pudo sincronizar el carrito con el servidor. Revisá tu conexión y volvé a intentar el cambio.',
      );
      expect(formatSyncErrorMessage('   ')).toBe(
        'No se pudo sincronizar el carrito con el servidor. Revisá tu conexión y volvé a intentar el cambio.',
      );
    });
  });
});
