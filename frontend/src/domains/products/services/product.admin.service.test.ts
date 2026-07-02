import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductAdminService } from './product.admin.service';

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

    it('throws the backend error message when the response is not ok', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Debe ingresar un nombre' }) });

      await expect(ProductAdminService.create(new FormData())).rejects.toThrow('Debe ingresar un nombre');
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

    it('throws a 404-derived error when the product does not exist', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Producto no encontrado' }) });

      await expect(ProductAdminService.update(999, new FormData())).rejects.toThrow('Producto no encontrado');
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

    it('throws a 403-derived error when the caller lacks permission (e.g. STAFF)', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'staff-token' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });

      await expect(ProductAdminService.remove(3)).rejects.toThrow('Forbidden');
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

    it('throws a 409-derived error when the delta would make stock negative', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => (key === 'token' ? 'abc123' : null));
      fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Stock insuficiente' }) });

      await expect(ProductAdminService.adjustStock(3, -50)).rejects.toThrow('Stock insuficiente');
    });
  });
});
