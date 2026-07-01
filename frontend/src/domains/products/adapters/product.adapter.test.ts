import { describe, expect, it } from 'vitest';
import { adaptAPIProduct, type APIProduct } from './product.adapter';

function buildAPIProduct(overrides: Partial<APIProduct> = {}): APIProduct {
  return {
    idProduct: 1,
    nameProduct: 'Figura Mario',
    price: 1500,
    descriptionProduct: 'Figura de colección',
    image: 'figura_mario.jpg',
    category: 'Figura',
    ...overrides,
  };
}

describe('adaptAPIProduct — dimension fallback logic', () => {
  it('shows "A consultar" for all dimensions when all are undefined', () => {
    const product = adaptAPIProduct(buildAPIProduct());

    expect(product.height).toBe('A consultar');
    expect(product.width).toBe('A consultar');
    expect(product.depth).toBe('A consultar');
  });

  it('shows "A consultar" only when all dimensions are null or undefined', () => {
    const product = adaptAPIProduct(
      buildAPIProduct({ height: null, width: null, depth: undefined }),
    );

    expect(product.height).toBe('A consultar');
    expect(product.width).toBe('A consultar');
    expect(product.depth).toBe('A consultar');
    expect(product.hasDimensions).toBe(false);
  });

  it('treats a defined 0 among null/undefined siblings as present, not "A consultar"', () => {
    const product = adaptAPIProduct(
      buildAPIProduct({ height: null, width: 0, depth: undefined }),
    );

    expect(product.height).toBe('no definida');
    expect(product.width).toBe('0 cm');
    expect(product.depth).toBe('no definida');
    expect(product.hasDimensions).toBe(true);
  });

  it('formats defined dimensions as "X cm" and undefined ones as "no definida" when at least one is defined', () => {
    const product = adaptAPIProduct(
      buildAPIProduct({ height: 12, width: null, depth: undefined }),
    );

    expect(product.height).toBe('12 cm');
    expect(product.width).toBe('no definida');
    expect(product.depth).toBe('no definida');
  });

  it('formats all dimensions as "X cm" when all are fully defined', () => {
    const product = adaptAPIProduct(
      buildAPIProduct({ height: 10.5, width: 8, depth: 5.5 }),
    );

    expect(product.height).toBe('10.5 cm');
    expect(product.width).toBe('8 cm');
    expect(product.depth).toBe('5.5 cm');
  });

  it('treats a defined 0 dimension as a valid value, not "no definida"', () => {
    const product = adaptAPIProduct(
      buildAPIProduct({ height: 12, width: 8, depth: 0 }),
    );

    expect(product.height).toBe('12 cm');
    expect(product.width).toBe('8 cm');
    expect(product.depth).toBe('0 cm');
  });

  it('renders "0 cm" for all dimensions when all three are legitimately 0, not "A consultar"', () => {
    const product = adaptAPIProduct(
      buildAPIProduct({ height: 0, width: 0, depth: 0 }),
    );

    expect(product.height).toBe('0 cm');
    expect(product.width).toBe('0 cm');
    expect(product.depth).toBe('0 cm');
    expect(product.hasDimensions).toBe(true);
  });
});

describe('adaptAPIProduct — material formatting', () => {
  it('defaults material to "A consultar" when not provided', () => {
    const product = adaptAPIProduct(buildAPIProduct());
    expect(product.material).toBe('A consultar');
  });

  it('passes through a standard allowed material', () => {
    const product = adaptAPIProduct(buildAPIProduct({ material: 'PLA' }));
    expect(product.material).toBe('PLA');
  });

  it('passes through a custom material with the "Otros: " prefix', () => {
    const product = adaptAPIProduct(buildAPIProduct({ material: 'Otros: ABS' }));
    expect(product.material).toBe('Otros: ABS');
  });
});

describe('adaptAPIProduct — productionTime formatting', () => {
  it('formats a defined productionTime as "X días"', () => {
    const product = adaptAPIProduct(buildAPIProduct({ productionTime: 3 }));
    expect(product.productionTime).toBe('3 días');
  });

  it('defaults productionTime to "A consultar" when not provided', () => {
    const product = adaptAPIProduct(buildAPIProduct());
    expect(product.productionTime).toBe('A consultar');
  });
});
