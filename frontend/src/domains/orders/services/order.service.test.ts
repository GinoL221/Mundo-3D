import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrder } from './order.service';

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
