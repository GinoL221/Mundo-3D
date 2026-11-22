import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFeaturedProduct,
  fetchLatestProduct,
  fetchProductById,
  fetchProducts,
  selectLatestPhotoProduct,
} from './product.service';
import type { Product } from '../adapters/product.adapter';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const SAMPLE_API_PRODUCT = {
  idProduct: 1,
  nameProduct: 'Goku',
  price: 1500,
  descriptionProduct: 'Figura de Goku',
  image: 'goku.png',
};

describe('fetchProductById', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests the product by id and returns the adapted product on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_API_PRODUCT));

    const result = await fetchProductById('1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/product/1');
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({ id: 1, name: 'Goku', price: 1500 }),
    });
  });

  it('maps a 404 status to a not-found reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));

    const result = await fetchProductById('999');

    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('maps any other non-ok status to a server reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

    const result = await fetchProductById('1');

    expect(result).toEqual({ ok: false, reason: 'server' });
  });

  it('maps a thrown fetch (network failure) to a network reason', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchProductById('1');

    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});

describe('fetchProducts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests the unpaginated product list and returns the adapted products on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { products: [SAMPLE_API_PRODUCT] }));

    const result = await fetchProducts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/products');
    expect(result).toEqual({
      ok: true,
      products: [expect.objectContaining({ id: 1, name: 'Goku' })],
    });
  });

  it('falls back to an empty list when the response has no products field', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    const result = await fetchProducts();

    expect(result).toEqual({ ok: true, products: [] });
  });

  it('maps any non-ok status to a server reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

    const result = await fetchProducts();

    expect(result).toEqual({ ok: false, reason: 'server' });
  });

  it('maps a thrown fetch (network failure) to a network reason', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchProducts();

    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});

describe('fetchLatestProduct', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests the latest product and returns the adapted product on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_API_PRODUCT));

    const result = await fetchLatestProduct();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/products/latest');
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({ id: 1, name: 'Goku', price: 1500 }),
    });
  });

  it('maps an empty catalog to a not-found reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));

    const result = await fetchLatestProduct();

    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('maps server and network failures to explicit reasons', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    expect(await fetchLatestProduct()).toEqual({ ok: false, reason: 'server' });

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await fetchLatestProduct()).toEqual({ ok: false, reason: 'network' });
  });
});

function makeAdaptedProduct(id: number, image: string): Product {
  return {
    id,
    name: `Pieza ${id}`,
    price: 1000 * id,
    description: `Descripción ${id}`,
    image,
    category: 'Figura',
    material: 'PLA',
    height: '10 cm',
    width: '10 cm',
    depth: '10 cm',
    hasDimensions: true,
    finish: 'Mate',
    productionTime: '3 días',
  };
}

describe('selectLatestPhotoProduct & fetchFeaturedProduct', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selects the newest product (highest id) with a real photo', () => {
    const products = [
      makeAdaptedProduct(3, 'goku.jpg'),
      makeAdaptedProduct(12, 'groot.jpg'),
      makeAdaptedProduct(7, 'vader.jpg'),
    ];

    expect(selectLatestPhotoProduct(products)?.id).toBe(12);
  });

  it('skips placeholder images when selecting the newest product', () => {
    const products = [
      makeAdaptedProduct(4, 'goku.jpg'),
      makeAdaptedProduct(9, 'groot.jpg'),
      makeAdaptedProduct(15, 'productoSinImagen.png'),
      makeAdaptedProduct(16, 'productoSinImagen.svg'),
      makeAdaptedProduct(17, ''),
    ];

    expect(selectLatestPhotoProduct(products)?.id).toBe(9);
  });

  it('returns undefined when all products use placeholder images or catalog is empty', () => {
    expect(selectLatestPhotoProduct([])).toBeUndefined();
    expect(
      selectLatestPhotoProduct([
        makeAdaptedProduct(1, 'productoSinImagen.png'),
        makeAdaptedProduct(2, ''),
      ]),
    ).toBeUndefined();
  });

  it('selects newest product with a real photo from catalog without calling latest endpoint', async () => {
    const result = await fetchFeaturedProduct(
      Promise.resolve({
        ok: true,
        products: [
          makeAdaptedProduct(2, 'goku.jpg'),
          makeAdaptedProduct(10, 'productoSinImagen.png'),
          makeAdaptedProduct(8, 'soporte_maceta_groot.jpg'),
        ],
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({ id: 8, image: 'soporte_maceta_groot.jpg' }),
    });
  });

  it('falls back to latest endpoint when catalog fails or has no real-photo product', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_API_PRODUCT));

    const fromFailedCatalog = await fetchFeaturedProduct(
      Promise.resolve({ ok: false, reason: 'server' }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/products/latest');
    expect(fromFailedCatalog).toEqual({
      ok: true,
      product: expect.objectContaining({ id: 1, name: 'Goku' }),
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_API_PRODUCT));
    const fromPlaceholderOnly = await fetchFeaturedProduct(
      Promise.resolve({
        ok: true,
        products: [makeAdaptedProduct(5, 'productoSinImagen.png')],
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fromPlaceholderOnly).toEqual({
      ok: true,
      product: expect.objectContaining({ id: 1, name: 'Goku' }),
    });
  });

  it('returns not-found for an empty catalog when latest endpoint also returns 404', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));

    const result = await fetchFeaturedProduct(Promise.resolve({ ok: true, products: [] }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });
});
