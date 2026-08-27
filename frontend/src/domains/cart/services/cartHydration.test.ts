import { describe, expect, it } from 'vitest';
import { detectPriceDrift, mapServerCart, mergeCartItems, type ServerCartItemDTO } from './cartHydration';
import type { CartItem } from './cartState';

function buildItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 1,
    name: 'Figura Mario',
    image: 'a.jpg',
    unitPrice: 1500,
    quantity: 1,
    ...overrides,
  };
}

function buildDto(overrides: Partial<ServerCartItemDTO> = {}): ServerCartItemDTO {
  return {
    idProduct: 1,
    quantity: 2,
    unitPrice: 999, // row-level price — must be ignored in favor of product.price
    product: { idProduct: 1, nameProduct: 'Figura Mario', price: 1500, image: 'a.jpg' },
    ...overrides,
  };
}

describe('mapServerCart', () => {
  it('maps a null product.image to an empty string', () => {
    const dto = buildDto({ product: { idProduct: 1, nameProduct: 'Figura Mario', price: 1500, image: null } });

    const [item] = mapServerCart([dto]);

    expect(item.image).toBe('');
  });

  it('takes unitPrice from product.price, not the row-level unitPrice', () => {
    const dto = buildDto({ unitPrice: 999, product: { idProduct: 1, nameProduct: 'Figura Mario', price: 1500, image: 'a.jpg' } });

    const [item] = mapServerCart([dto]);

    expect(item.unitPrice).toBe(1500);
  });

  it('maps productId, name, and quantity straight through', () => {
    const dto = buildDto({ idProduct: 42, quantity: 3, product: { idProduct: 42, nameProduct: 'Figura Sonic', price: 800, image: 'b.jpg' } });

    const [item] = mapServerCart([dto]);

    expect(item.productId).toBe(42);
    expect(item.name).toBe('Figura Sonic');
    expect(item.quantity).toBe(3);
  });
});

describe('mergeCartItems', () => {
  it('sums quantities for an overlapping productId', () => {
    const local = [buildItem({ productId: 1, quantity: 3 })];
    const server = [buildItem({ productId: 1, quantity: 4 })];

    const merged = mergeCartItems(local, server);

    expect(merged).toEqual([expect.objectContaining({ productId: 1, quantity: 7 })]);
  });

  it('server wins on name/image/unitPrice for an overlapping item', () => {
    const local = [buildItem({ productId: 1, name: 'Local Name', image: 'local.jpg', unitPrice: 100, quantity: 1 })];
    const server = [buildItem({ productId: 1, name: 'Server Name', image: 'server.jpg', unitPrice: 200, quantity: 1 })];

    const [merged] = mergeCartItems(local, server);

    expect(merged.name).toBe('Server Name');
    expect(merged.image).toBe('server.jpg');
    expect(merged.unitPrice).toBe(200);
  });

  it('clamps a summed overlap exceeding 99 down to 99', () => {
    const local = [buildItem({ productId: 1, quantity: 60 })];
    const server = [buildItem({ productId: 1, quantity: 60 })];

    const [merged] = mergeCartItems(local, server);

    expect(merged.quantity).toBe(99);
  });

  it('clamps a local-only item already over 99 down to 99', () => {
    const local = [buildItem({ productId: 5, quantity: 150 })];
    const server: CartItem[] = [];

    const [merged] = mergeCartItems(local, server);

    expect(merged.quantity).toBe(99);
  });

  it('drops an item with a non-finite quantity', () => {
    const local = [buildItem({ productId: 5, quantity: Number.NaN })];
    const server: CartItem[] = [];

    expect(mergeCartItems(local, server)).toEqual([]);
  });

  it('drops an item with a quantity below 1', () => {
    const local = [buildItem({ productId: 5, quantity: 0 })];
    const server: CartItem[] = [];

    expect(mergeCartItems(local, server)).toEqual([]);
  });

  it('passes server-only items through unchanged', () => {
    const local: CartItem[] = [];
    const server = [buildItem({ productId: 9, quantity: 2 })];

    expect(mergeCartItems(local, server)).toEqual([buildItem({ productId: 9, quantity: 2 })]);
  });

  it('passes local-only items through unchanged', () => {
    const local = [buildItem({ productId: 9, quantity: 2 })];
    const server: CartItem[] = [];

    expect(mergeCartItems(local, server)).toEqual([buildItem({ productId: 9, quantity: 2 })]);
  });

  it('orders output as server items in server order, then local-only items appended', () => {
    const local = [
      buildItem({ productId: 3, name: 'Local-only A' }),
      buildItem({ productId: 1, name: 'Overlap' }),
      buildItem({ productId: 4, name: 'Local-only B' }),
    ];
    const server = [
      buildItem({ productId: 2, name: 'Server B' }),
      buildItem({ productId: 1, name: 'Overlap (server name)' }),
    ];

    const merged = mergeCartItems(local, server);

    expect(merged.map((i) => i.productId)).toEqual([2, 1, 3, 4]);
  });
});

describe('detectPriceDrift', () => {
  it('produces one entry for a product present in both sets with differing prices', () => {
    const local = [buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1500 })];
    const server = [buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1800 })];

    expect(detectPriceDrift(local, server)).toEqual([
      { name: 'Figura Mario', oldPrice: 1500, newPrice: 1800 },
    ]);
  });

  it('produces no entry when local and server prices match', () => {
    const local = [buildItem({ productId: 1, unitPrice: 1500 })];
    const server = [buildItem({ productId: 1, unitPrice: 1500 })];

    expect(detectPriceDrift(local, server)).toEqual([]);
  });

  it('produces no entry for a server-only product (no local record)', () => {
    const local: CartItem[] = [];
    const server = [buildItem({ productId: 1, unitPrice: 1800 })];

    expect(detectPriceDrift(local, server)).toEqual([]);
  });

  it('produces no entry for a local-only product (no server record)', () => {
    const local = [buildItem({ productId: 1, unitPrice: 1500 })];
    const server: CartItem[] = [];

    expect(detectPriceDrift(local, server)).toEqual([]);
  });

  it('produces one entry per drifted product when multiple products drift', () => {
    const local = [
      buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1500 }),
      buildItem({ productId: 2, name: 'Figura Sonic', unitPrice: 800 }),
    ];
    const server = [
      buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1800 }),
      buildItem({ productId: 2, name: 'Figura Sonic', unitPrice: 900 }),
    ];

    expect(detectPriceDrift(local, server)).toEqual([
      { name: 'Figura Mario', oldPrice: 1500, newPrice: 1800 },
      { name: 'Figura Sonic', oldPrice: 800, newPrice: 900 },
    ]);
  });
});
