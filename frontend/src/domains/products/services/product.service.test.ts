import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProductById, fetchProducts } from './product.service';

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
