import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProductSearch, fetchFilterOptions } from './product.search.service';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const SAMPLE_PAGE = {
  products: [
    { idProduct: 1, nameProduct: 'Goku', price: 1500, descriptionProduct: null, image: null },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
};

describe('fetchProductSearch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds the URL with only the defined/non-empty criteria and returns the parsed page on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PAGE));

    const result = await fetchProductSearch({ search: 'goku', idCategory: 3, page: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/products/search');
    expect(url).toContain('search=goku');
    expect(url).toContain('idCategory=3');
    expect(url).toContain('page=2');
    expect(url).not.toContain('idFranchise=');
    expect(result).toEqual({ ok: true, page: SAMPLE_PAGE });
  });

  it('trims the search term before building the query string', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PAGE));

    await fetchProductSearch({ search: '  goku  ' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('search=goku');
  });

  it('omits a blank/whitespace-only search term entirely', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PAGE));

    await fetchProductSearch({ search: '   ' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain('search=');
  });

  it('omits every criteria member when none are provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_PAGE));

    await fetchProductSearch({});

    const [url] = fetchMock.mock.calls[0];
    expect(url.endsWith('/api/products/search')).toBe(true);
  });

  it('maps a thrown fetch (network failure) to a network reason', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchProductSearch({});

    expect(result).toEqual({ ok: false, reason: 'network' });
  });

  it('maps any non-ok status to a server reason', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, {}));

    const result = await fetchProductSearch({});

    expect(result).toEqual({ ok: false, reason: 'server' });
  });
});

describe('fetchFilterOptions', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches categories and franchises in parallel and maps them to FilterOption[]', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/categories')) {
        return Promise.resolve(jsonResponse(200, [{ idCategory: 1, nameCategory: 'Figura' }]));
      }
      return Promise.resolve(jsonResponse(200, [{ idFranchise: 5, nameFranchise: 'DBZ' }]));
    });

    const result = await fetchFilterOptions();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      categories: [{ id: 1, name: 'Figura' }],
      franchises: [{ id: 5, name: 'DBZ' }],
    });
  });

  it('falls back to empty arrays when either request fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {})).mockResolvedValueOnce(jsonResponse(200, []));

    const result = await fetchFilterOptions();

    expect(result).toEqual({ categories: [], franchises: [] });
  });

  it('falls back to empty arrays when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const result = await fetchFilterOptions();

    expect(result).toEqual({ categories: [], franchises: [] });
  });
});
