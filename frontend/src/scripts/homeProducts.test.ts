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

const NEWER_PLACEHOLDER = {
  idProduct: 90,
  nameProduct: 'Sin foto',
  price: 9000,
  descriptionProduct: 'Producto sin foto real.',
  image: 'productoSinImagen.png',
  category: 'Otras',
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

  it('selects the newest product with a real photo from shared catalog data', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        products: [PORTAL_CUBE, NEWER_PLACEHOLDER, LATEST_PRODUCT],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const catalogRequest = fetchProducts();

    const result = await fetchFeaturedProduct(catalogRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      product: expect.objectContaining({
        id: 81,
        name: 'Latest Product',
        price: 12000,
        image: 'latest.webp',
      }),
    });
  });

  it.each([
    ['no catalog product has a real photo', jsonResponse(200, { products: [NEWER_PLACEHOLDER] })],
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
