import type { CartItem } from './cartState';

// The frontend cannot import from backend/; this mirrors backend
// ShoppingCartDTO / GetCartResult and is kept in sync by hand.
export interface ServerCartItemDTO {
  idProduct: number;
  quantity: number;
  unitPrice: number;
  product: { idProduct: number; nameProduct: string; price: number; image: string | null };
}

export interface ServerCartResponse {
  items: ServerCartItemDTO[];
  total: number;
}

export const MAX_ITEM_QUANTITY = 99;

export interface PriceDrift {
  name: string;
  oldPrice: number;
  newPrice: number;
}

// Maps a GET /api/cart DTO entry to the local CartItem shape. unitPrice comes
// from the current product price (product.price), never the cart row's own
// stored unitPrice — that row-level value only reflects what the price was
// when the item was added server-side, not what the item is worth now.
export function mapServerCart(dtos: ServerCartItemDTO[]): CartItem[] {
  return dtos.map((dto) => ({
    productId: dto.idProduct,
    name: dto.product.nameProduct,
    image: dto.product.image ?? '',
    unitPrice: dto.product.price,
    quantity: dto.quantity,
  }));
}

// Unions a local (guest) cart with the server's cart by productId. Overlap
// sums quantities; server wins on name/image/unitPrice for overlapping items
// (the server is authority and re-prices at sync anyway — drift is reported,
// not resisted). Every merged item is clamped to MAX_ITEM_QUANTITY, not only
// summed ones, because addToCart has no client-side cap today and a
// local-only item can already exceed it. Items left non-finite or below 1
// after clamping are dropped, since the backend validator 400s the WHOLE
// PUT on an out-of-bounds quantity — one corrupt entry must not veto the
// rest of the merge. Output order is deterministic: server items in server
// order, then local-only items appended in their original local order.
export function mergeCartItems(local: CartItem[], server: CartItem[]): CartItem[] {
  const remainingLocalByProduct = new Map(local.map((item) => [item.productId, item]));
  const merged: CartItem[] = [];

  for (const serverItem of server) {
    const localItem = remainingLocalByProduct.get(serverItem.productId);
    if (localItem) {
      merged.push({ ...serverItem, quantity: localItem.quantity + serverItem.quantity });
      remainingLocalByProduct.delete(serverItem.productId);
    } else {
      merged.push({ ...serverItem });
    }
  }

  for (const localOnlyItem of remainingLocalByProduct.values()) {
    merged.push({ ...localOnlyItem });
  }

  return merged
    .map((item) => ({ ...item, quantity: Math.min(MAX_ITEM_QUANTITY, item.quantity) }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity >= 1);
}

// Compares the price the user last saw locally against the server's current
// price, for products present in both sets only — a server-only item has no
// locally-known price to have drifted from. Deliberately ignores the DTO's
// own `hasPriceDrift` field: that field compares the cart row's stored price
// against the current product price (a different, server-internal
// comparand), not what the user actually saw client-side.
export function detectPriceDrift(local: CartItem[], server: CartItem[]): PriceDrift[] {
  const localByProduct = new Map(local.map((item) => [item.productId, item]));
  const drifts: PriceDrift[] = [];

  for (const serverItem of server) {
    const localItem = localByProduct.get(serverItem.productId);
    if (localItem && localItem.unitPrice !== serverItem.unitPrice) {
      drifts.push({
        name: serverItem.name,
        oldPrice: localItem.unitPrice,
        newPrice: serverItem.unitPrice,
      });
    }
  }

  return drifts;
}
