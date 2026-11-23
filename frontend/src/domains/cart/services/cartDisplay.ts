import type { CartItem } from './cartState';
import type { HydrationResult } from './cartHydration';

const DEFAULT_SYNC_ERROR = 'No se pudo sincronizar el carrito con el servidor.';
const SYNC_ERROR_RECOVERY = 'Revisá tu conexión y volvé a intentar el cambio.';
const HYDRATION_ERROR_MESSAGE =
  'No pudimos traer tu carrito guardado. Te mostramos el de este dispositivo.';

export function countCartPieces(items: readonly Pick<CartItem, 'quantity'>[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function formatCartPieceCount(count: number): string {
  return count === 1 ? '1 pieza' : `${count} piezas`;
}

export function getCheckoutButtonLabel(authenticated: boolean, busy = false): string {
  if (busy) return 'Procesando…';
  return authenticated ? 'Finalizar compra' : 'Iniciá sesión para finalizar';
}

export function getHydrationErrorMessage(
  result: Pick<HydrationResult, 'ok' | 'reason'>,
): string | null {
  if (result.ok) return null;
  if (result.reason === 'network' || result.reason === 'http') {
    return HYDRATION_ERROR_MESSAGE;
  }
  return null;
}

export function formatSyncErrorMessage(detailMessage?: string): string {
  const base = detailMessage?.trim() ? detailMessage.trim() : DEFAULT_SYNC_ERROR;
  return `${base} ${SYNC_ERROR_RECOVERY}`;
}
