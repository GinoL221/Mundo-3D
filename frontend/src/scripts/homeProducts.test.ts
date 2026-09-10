import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFeaturedProduct, fetchProducts } from '../domains/products/services/product.service';

const PORTAL_CUBE = {
  idProduct: 47,
  nameProduct: 'Cubo de Compañía de Portal',
  price: 24500,
  descriptionProduct: 'Producto editorial real.',
  image: 'portal-cube.webp',
  category: 'Figura',
};

const LATEST_PRODUCT = {
  idProduct: 81,
  nameProduct: 'Latest Product',
  price: 12000,
  descriptionProduct: 'Fallback product.',
  image: 'latest.webp',
  category: 'Figura',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('fetchFeaturedProduct', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('selects the Portal companion cube by exact editorial identity from shared catalog data', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        products: [LATEST_PRODUCT, PORTAL_CUBE],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const catalogRequest = fetchProducts();

    const result = await fetchFeaturedProduct(catalogRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({
        id: 47,
        name: 'Cubo de Compañía de Portal',
        price: 24500,
        image: 'portal-cube.webp',
      }),
    });
  });

  it.each([
    ['the editorial product is absent', jsonResponse(200, { products: [LATEST_PRODUCT] })],
    ['the product list fails', jsonResponse(500, {})],
  ])('falls back to latest when %s', async (_scenario, catalogResponse) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(catalogResponse)
      .mockResolvedValueOnce(jsonResponse(200, LATEST_PRODUCT));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFeaturedProduct();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/products/latest');
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({ id: 81, name: 'Latest Product' }),
    });
  });

  it('preserves the latest endpoint failure when fallback cannot load', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('catalog unavailable'))
      .mockResolvedValueOnce(jsonResponse(404, {}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFeaturedProduct()).resolves.toEqual({ ok: false, reason: 'not-found' });
  });
});
