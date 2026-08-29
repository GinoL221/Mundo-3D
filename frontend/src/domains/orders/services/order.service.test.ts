import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrder, fetchMyOrders } from './order.service';

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const SAMPLE_ORDER_DTO = {
  idOrder: 41,
  idUser: 7,
  status: 'AWAITING_PAYMENT',
  items: [
    { idOrderItem: 88, idProduct: 12, productName: 'Maceta Groot', quantity: 2, unitPrice: 1500, subtotal: 3000 },
  ],
  totalAmount: 3000,
  createdAt: '2026-08-28T14:03:11.000Z',
  paymentReference: 'MANUAL-41-9f2c1a',
};

describe('fetchOrder', () => {
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

  it('requests GET /api/orders/:id with credentials and returns the parsed order on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_ORDER_DTO));

    const result = await fetchOrder(41);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/orders/41');
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ ok: true, order: SAMPLE_ORDER_DTO });
  });

  it('maps a 404 to NOT_FOUND (covers both a missing order and a non-owner)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'Orden no encontrada', code: 'ORDER_NOT_FOUND' }));

    const result = await fetchOrder(999);

    expect(result).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Orden no encontrada.' });
  });

  it('maps a thrown fetch (network failure) to NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchOrder(41);

    expect(result).toEqual({ ok: false, code: 'NETWORK', message: expect.any(String) });
  });

  it('maps any other non-ok status to UNKNOWN', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

    const result = await fetchOrder(41);

    expect(result).toEqual({ ok: false, code: 'UNKNOWN', message: 'Error 500' });
  });
});

const SAMPLE_MY_ORDERS_PAGE = {
  orders: [
    {
      idOrder: 12,
      idUser: 3,
      status: 'PAID',
      totalAmount: 1499.5,
      createdAt: '2026-08-20T10:00:00.000Z',
      paymentReference: 'MP-123',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 37,
  totalPages: 2,
};

describe('fetchMyOrders', () => {
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

  it('requests GET /api/orders/mine with credentials and page/pageSize query params, returning the parsed page on 200', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_MY_ORDERS_PAGE));

    const result = await fetchMyOrders(2, 10);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/orders/mine');
    expect(url).toContain('page=2');
    expect(url).toContain('pageSize=10');
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ ok: true, page: SAMPLE_MY_ORDERS_PAGE });
  });

  it('omits page/pageSize query params when called with no arguments', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, SAMPLE_MY_ORDERS_PAGE));

    await fetchMyOrders();

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain('page=');
    expect(url).not.toContain('pageSize=');
  });

  it('maps a 401 to UNAUTHENTICATED', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    const result = await fetchMyOrders();

    expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED', message: expect.any(String) });
  });

  it('maps a 400 to INVALID_PAGINATION', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: 'Parámetros de paginación inválidos', code: 'INVALID_PAGINATION' }),
    );

    const result = await fetchMyOrders(0, 999);

    expect(result).toEqual({ ok: false, code: 'INVALID_PAGINATION', message: expect.any(String) });
  });

  it('maps a thrown fetch (network failure) to NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await fetchMyOrders();

    expect(result).toEqual({ ok: false, code: 'NETWORK', message: expect.any(String) });
  });

  it('maps any other non-ok status to UNKNOWN', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

    const result = await fetchMyOrders();

    expect(result).toEqual({ ok: false, code: 'UNKNOWN', message: 'Error 500' });
  });
});
