import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkout } from './checkout';
import { cartItems, type CartItem } from './cartState';
import { discardPendingSync, hasPendingSync } from './cartSync';
import { CartService } from './CartService';

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

function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

const LOGGED_IN_COOKIE = `m3d_user=${encodeURIComponent(JSON.stringify({ idRole: 2 }))}; m3d_csrf=random.hmac`;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function seedCart(items: CartItem[]) {
  cartItems.set(items);
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

describe('checkout', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    discardPendingSync();
    cartItems.set([]);
    localStorageMock = createLocalStorageMock();
    fetchMock = vi.fn();

    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      'CustomEvent',
      class {
        type: string;
        detail: unknown;
        constructor(type: string, params?: { detail?: unknown }) {
          this.type = type;
          this.detail = params?.detail;
        }
      }
    );
    vi.stubGlobal('fetch', fetchMock);
    stubCookie('');
  });

  afterEach(() => {
    discardPendingSync();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns UNAUTHENTICATED without calling fetch when there is no session', async () => {
    stubCookie('');
    seedCart([{ productId: 1, name: 'X', image: 'a.jpg', unitPrice: 100, quantity: 1 }]);

    const result = await checkout();

    expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED', message: expect.any(String) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cartItems.get()).toHaveLength(1);
  });

  it('awaits flushCartSync() before issuing POST /api/orders (fixes the never-awaited flush bug)', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    // addToCart schedules a pending debounce burst that flushCartSync() must
    // resolve before checkout() is allowed to hit /api/orders.
    CartService.addToCart({ id: 7, name: 'Figura', image: 'a.jpg', price: 100 });

    let resolveCartPut!: (value: { ok: boolean }) => void;
    const cartPutPromise = new Promise<{ ok: boolean }>((resolve) => {
      resolveCartPut = resolve;
    });
    fetchMock.mockImplementationOnce(() => cartPutPromise);
    fetchMock.mockResolvedValueOnce(jsonResponse(201, SAMPLE_ORDER_DTO));

    const checkoutPromise = checkout();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    // The flushed PUT /api/cart has not resolved yet, so the orders POST
    // must not have fired.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/cart');

    resolveCartPut({ ok: true });
    const result = await checkoutPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/api/orders');
    expect(result.ok).toBe(true);
  });

  it('does not clear the local cart when the server rejects with INSUFFICIENT_STOCK', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    seedCart([{ productId: 12, name: 'Maceta Groot', image: 'a.jpg', unitPrice: 1500, quantity: 3 }]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: 'Stock insuficiente para uno o más productos',
        code: 'INSUFFICIENT_STOCK',
        shortages: [{ idProduct: 12, productName: 'Maceta Groot', requested: 3, available: 1 }],
      })
    );

    const result = await checkout();

    expect(result).toEqual({
      ok: false,
      code: 'INSUFFICIENT_STOCK',
      message: 'Stock insuficiente para uno o más productos',
      shortages: [{ idProduct: 12, productName: 'Maceta Groot', requested: 3, available: 1 }],
    });
    expect(cartItems.get()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not clear the local cart on EMPTY_CART either', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    seedCart([{ productId: 1, name: 'X', image: 'a.jpg', unitPrice: 100, quantity: 1 }]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: 'El carrito está vacío', code: 'EMPTY_CART' })
    );

    const result = await checkout();

    expect(result).toEqual({ ok: false, code: 'EMPTY_CART', message: 'El carrito está vacío', shortages: undefined });
    expect(cartItems.get()).toHaveLength(1);
  });

  it('clears the local cart WITHOUT scheduling a background sync on success', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    seedCart([{ productId: 12, name: 'Maceta Groot', image: 'a.jpg', unitPrice: 1500, quantity: 2 }]);
    fetchMock.mockResolvedValueOnce(jsonResponse(201, SAMPLE_ORDER_DTO));

    const result = await checkout();

    expect(result).toEqual({ ok: true, idOrder: 41, totalAmount: 3000 });
    expect(cartItems.get()).toEqual([]);
    expect(hasPendingSync()).toBe(false);
    // Only the orders POST fired — no redundant PUT /api/cart [] was scheduled.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the Idempotency-Key header and credentials on the POST /api/orders call', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    seedCart([{ productId: 1, name: 'X', image: 'a.jpg', unitPrice: 100, quantity: 1 }]);
    fetchMock.mockResolvedValueOnce(jsonResponse(201, SAMPLE_ORDER_DTO));

    await checkout();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/orders');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers['X-CSRF-Token']).toBe('random.hmac');
    expect(typeof options.headers['Idempotency-Key']).toBe('string');
    expect(options.headers['Idempotency-Key'].length).toBeGreaterThan(0);
  });

  it('reuses the SAME idempotency key on a NETWORK-failure retry of the same attempt', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    seedCart([{ productId: 1, name: 'X', image: 'a.jpg', unitPrice: 100, quantity: 1 }]);
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, SAMPLE_ORDER_DTO));

    const first = await checkout();
    expect(first).toEqual({ ok: false, code: 'NETWORK', message: expect.any(String) });
    expect(cartItems.get()).toHaveLength(1);

    await checkout();

    const firstKey = fetchMock.mock.calls[0][1].headers['Idempotency-Key'];
    const secondKey = fetchMock.mock.calls[1][1].headers['Idempotency-Key'];
    expect(firstKey).toBe(secondKey);
  });

  it('issues a FRESH idempotency key for a genuinely new attempt after a definitive 4xx rejection', async () => {
    stubCookie(LOGGED_IN_COOKIE);
    seedCart([{ productId: 1, name: 'X', image: 'a.jpg', unitPrice: 100, quantity: 1 }]);
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'vacío', code: 'EMPTY_CART' }));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, SAMPLE_ORDER_DTO));

    await checkout();
    await checkout();

    const firstKey = fetchMock.mock.calls[0][1].headers['Idempotency-Key'];
    const secondKey = fetchMock.mock.calls[1][1].headers['Idempotency-Key'];
    expect(firstKey).not.toBe(secondKey);
  });
});
