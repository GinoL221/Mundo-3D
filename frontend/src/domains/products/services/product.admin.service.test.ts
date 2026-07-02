import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductAdminApiError, ProductAdminService } from './product.admin.service';

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

async function expectApiError(fn: () => Promise<unknown>, status: number, message: string) {
  let error: unknown;
  try {
    await fn();
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(ProductAdminApiError);
  expect((error as ProductAdminApiError).status).toBe(status);
  expect((error as Error).message).toBe(message);
}

describe('ProductAdminService', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    fetchMock = vi.fn();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('POSTs the FormData with a Bearer auth header and returns the parsed ProductDTO', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      const dto = { idProduct: 1, nameProduct: 'Figura Mario', stock: 0 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const formData = new FormData();
      formData.append('nameProduct', 'Figura Mario');

      const result = await ProductAdminService.create(formData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer abc123');
      expect(options.body).toBe(formData);
      expect(result).toEqual(dto);
    });

    it('throws a ProductAdminApiError carrying status 400 when the response is not ok', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Debe ingresar un nombre' }) });

      await expectApiError(() => ProductAdminService.create(new FormData()), 400, 'Debe ingresar un nombre');
    });
  });

  describe('update', () => {
    it('PUTs to /api/products/:id with a Bearer auth header', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      const dto = { idProduct: 7, nameProduct: 'Figura Sonic', stock: 5 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const formData = new FormData();
      const result = await ProductAdminService.update(7, formData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products/7');
      expect(options.method).toBe('PUT');
      expect(options.headers.Authorization).toBe('Bearer abc123');
      expect(options.body).toBe(formData);
      expect(result).toEqual(dto);
    });

    it('throws a ProductAdminApiError carrying status 404 when the product does not exist', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Producto no encontrado' }) });

      await expectApiError(() => ProductAdminService.update(999, new FormData()), 404, 'Producto no encontrado');
    });
  });

  describe('remove', () => {
    it('DELETEs /api/products/:id with a Bearer auth header and no body', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: true, status: 204 });

      await ProductAdminService.remove(3);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products/3');
      expect(options.method).toBe('DELETE');
      expect(options.headers.Authorization).toBe('Bearer abc123');
    });

    it('throws a ProductAdminApiError carrying status 403 when the caller lacks permission (e.g. STAFF)', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'staff-token' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });

      await expectApiError(() => ProductAdminService.remove(3), 403, 'Forbidden');
    });
  });

  describe('adjustStock', () => {
    it('PATCHes /api/products/:id/stock with a JSON delta body and Bearer auth header', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      const dto = { idProduct: 3, stock: 8 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const result = await ProductAdminService.adjustStock(3, 3);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products/3/stock');
      expect(options.method).toBe('PATCH');
      expect(options.headers.Authorization).toBe('Bearer abc123');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({ delta: 3 });
      expect(result).toEqual(dto);
    });

    it('throws a ProductAdminApiError carrying status 409 when the delta would make stock negative', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Stock insuficiente' }) });

      await expectApiError(() => ProductAdminService.adjustStock(3, -50), 409, 'Stock insuficiente');
    });
  });

  describe('when there is no token (logged out)', () => {
    it('sends the request without an Authorization header', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ idProduct: 1, stock: 0 }) });

      await ProductAdminService.create(new FormData());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('surfaces a 401 response as a ProductAdminApiError with status 401', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'No autorizado' }) });

      await expectApiError(() => ProductAdminService.create(new FormData()), 401, 'No autorizado');
    });
  });
});
