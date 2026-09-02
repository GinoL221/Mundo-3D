import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductAdminApiError, ProductAdminService } from './product.admin.service';

// Mirrors the cookie-stubbing pattern from csrf.test.ts — the admin service
// now attaches CSRF via withCredentials() (m3d_csrf cookie) instead of a
// manual Bearer header (CSRF protection is what guards these routes now).
function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCookie('m3d_csrf=random.hmac');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('POSTs the FormData with credentials + CSRF token and returns the parsed ProductDTO', async () => {
      const dto = { idProduct: 1, nameProduct: 'Figura Mario', stock: 0 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const formData = new FormData();
      formData.append('nameProduct', 'Figura Mario');

      const result = await ProductAdminService.create(formData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products');
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBe('random.hmac');
      expect(options.headers.Authorization).toBeUndefined();
      expect(options.body).toBe(formData);
      expect(result).toEqual(dto);
    });

    it('throws a ProductAdminApiError carrying status 400 when the response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Debe ingresar un nombre' }) });

      await expectApiError(() => ProductAdminService.create(new FormData()), 400, 'Debe ingresar un nombre');
    });

    it('retries transparently after a 401 triggers a successful refresh (authFetch, task 3.9)', async () => {
      const dto = { idProduct: 1, nameProduct: 'Figura Mario', stock: 0 };
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => dto });

      const result = await ProductAdminService.create(new FormData());

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/users/refresh');
      expect(result).toEqual(dto);
    });
  });

  describe('update', () => {
    it('PUTs to /api/products/:id with credentials + CSRF token', async () => {
      const dto = { idProduct: 7, nameProduct: 'Figura Sonic', stock: 5 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const formData = new FormData();
      const result = await ProductAdminService.update(7, formData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products/7');
      expect(options.method).toBe('PUT');
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBe('random.hmac');
      expect(options.body).toBe(formData);
      expect(result).toEqual(dto);
    });

    it('throws a ProductAdminApiError carrying status 404 when the product does not exist', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Producto no encontrado' }) });

      await expectApiError(() => ProductAdminService.update(999, new FormData()), 404, 'Producto no encontrado');
    });

    it('retries transparently after a 401 triggers a successful refresh (authFetch, task 3.9)', async () => {
      const dto = { idProduct: 7, nameProduct: 'Figura Sonic', stock: 5 };
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => dto });

      const result = await ProductAdminService.update(7, new FormData());

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/users/refresh');
      expect(result).toEqual(dto);
    });
  });

  describe('remove', () => {
    it('DELETEs /api/products/:id with credentials + CSRF token and no body', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 204 });

      await ProductAdminService.remove(3);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products/3');
      expect(options.method).toBe('DELETE');
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBe('random.hmac');
    });

    it('throws a ProductAdminApiError carrying status 403 when the caller lacks permission (e.g. STAFF)', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) });

      await expectApiError(() => ProductAdminService.remove(3), 403, 'Forbidden');
    });

    it('retries transparently after a 401 triggers a successful refresh (authFetch, task 3.9)', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 204 });

      await ProductAdminService.remove(3);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/users/refresh');
    });
  });

  describe('adjustStock', () => {
    it('PATCHes /api/products/:id/stock with a JSON delta body, credentials, and CSRF token', async () => {
      const dto = { idProduct: 3, stock: 8 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const result = await ProductAdminService.adjustStock(3, 3);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products/3/stock');
      expect(options.method).toBe('PATCH');
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBe('random.hmac');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({ delta: 3 });
      expect(result).toEqual(dto);
    });

    it('throws a ProductAdminApiError carrying status 409 when the delta would make stock negative', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Stock insuficiente' }) });

      await expectApiError(() => ProductAdminService.adjustStock(3, -50), 409, 'Stock insuficiente');
    });

    it('retries transparently after a 401 triggers a successful refresh (authFetch, task 3.9)', async () => {
      const dto = { idProduct: 3, stock: 8 };
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => dto });

      const result = await ProductAdminService.adjustStock(3, 3);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/users/refresh');
      expect(result).toEqual(dto);
    });
  });

  describe('list', () => {
    it('GETs the public product list and unwraps the products array', async () => {
      const products = [
        { idProduct: 1, nameProduct: 'Figura Mario', stock: 4 },
        { idProduct: 2, nameProduct: 'Busto Luigi', stock: 0 },
      ];
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ products }) });

      const result = await ProductAdminService.list();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/products');
      expect(result).toEqual(products);
      // GET /products is public (no apiAuthMiddleware, no csrfGuard on the
      // backend route), so the read path must not send credentials or a
      // CSRF header the way the mutation methods do.
      expect(options).toBeUndefined();
    });

    it('returns an empty array when the response carries no products key', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

      expect(await ProductAdminService.list()).toEqual([]);
    });

    it('throws a ProductAdminApiError carrying the status when the response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Error del servidor' }) });

      await expectApiError(() => ProductAdminService.list(), 500, 'Error del servidor');
    });
  });

  describe('getById', () => {
    it('GETs the single-product endpoint and returns the parsed ProductDTO', async () => {
      const dto = { idProduct: 7, nameProduct: 'Llavero Yoshi', idCategory: 2, stock: 1 };
      fetchMock.mockResolvedValue({ ok: true, json: async () => dto });

      const result = await ProductAdminService.getById(7);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/product/7');
      expect(result).toEqual(dto);
      expect(options).toBeUndefined();
    });

    it('throws a ProductAdminApiError carrying status 404 for an unknown id', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'Producto no encontrado' }) });

      await expectApiError(() => ProductAdminService.getById(999), 404, 'Producto no encontrado');
    });
  });

  describe('when there is no CSRF cookie (no active session)', () => {
    it('still sends credentials:"include" without an X-CSRF-Token header', async () => {
      stubCookie('');
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ idProduct: 1, stock: 0 }) });

      await ProductAdminService.create(new FormData());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBeUndefined();
    });

    it('surfaces a 401 response as a ProductAdminApiError with status 401', async () => {
      stubCookie('');
      fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'No autorizado' }) });

      await expectApiError(() => ProductAdminService.create(new FormData()), 401, 'No autorizado');
    });
  });
});
