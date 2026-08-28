import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as cartHydrationModule from './cartHydration';
import {
  detectPriceDrift,
  hydrateFromServer,
  mapServerCart,
  mergeCartItems,
  type HydrationResult,
  type ServerCartItemDTO,
} from './cartHydration';
import { cartItems, type CartItem } from './cartState';
import { discardPendingSync, hasPendingSync, scheduleSync } from './cartSync';
import { CartService } from './CartService';

// Mirrors CartService.test.ts's stubs — hydrateFromServer gates on the same
// getSessionUser()/withCredentials() cookie-based auth as CartService.
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

function buildItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 1,
    name: 'Figura Mario',
    image: 'a.jpg',
    unitPrice: 1500,
    quantity: 1,
    ...overrides,
  };
}

function buildDto(overrides: Partial<ServerCartItemDTO> = {}): ServerCartItemDTO {
  return {
    idProduct: 1,
    quantity: 2,
    unitPrice: 999, // row-level price — must be ignored in favor of product.price
    product: { idProduct: 1, nameProduct: 'Figura Mario', price: 1500, image: 'a.jpg' },
    ...overrides,
  };
}

describe('mapServerCart', () => {
  it('maps a null product.image to an empty string', () => {
    const dto = buildDto({ product: { idProduct: 1, nameProduct: 'Figura Mario', price: 1500, image: null } });

    const [item] = mapServerCart([dto]);

    expect(item.image).toBe('');
  });

  it('takes unitPrice from product.price, not the row-level unitPrice', () => {
    const dto = buildDto({ unitPrice: 999, product: { idProduct: 1, nameProduct: 'Figura Mario', price: 1500, image: 'a.jpg' } });

    const [item] = mapServerCart([dto]);

    expect(item.unitPrice).toBe(1500);
  });

  it('maps productId, name, and quantity straight through', () => {
    const dto = buildDto({ idProduct: 42, quantity: 3, product: { idProduct: 42, nameProduct: 'Figura Sonic', price: 800, image: 'b.jpg' } });

    const [item] = mapServerCart([dto]);

    expect(item.productId).toBe(42);
    expect(item.name).toBe('Figura Sonic');
    expect(item.quantity).toBe(3);
  });
});

describe('mergeCartItems', () => {
  it('sums quantities for an overlapping productId', () => {
    const local = [buildItem({ productId: 1, quantity: 3 })];
    const server = [buildItem({ productId: 1, quantity: 4 })];

    const merged = mergeCartItems(local, server);

    expect(merged).toEqual([expect.objectContaining({ productId: 1, quantity: 7 })]);
  });

  it('server wins on name/image/unitPrice for an overlapping item', () => {
    const local = [buildItem({ productId: 1, name: 'Local Name', image: 'local.jpg', unitPrice: 100, quantity: 1 })];
    const server = [buildItem({ productId: 1, name: 'Server Name', image: 'server.jpg', unitPrice: 200, quantity: 1 })];

    const [merged] = mergeCartItems(local, server);

    expect(merged.name).toBe('Server Name');
    expect(merged.image).toBe('server.jpg');
    expect(merged.unitPrice).toBe(200);
  });

  it('clamps a summed overlap exceeding 99 down to 99', () => {
    const local = [buildItem({ productId: 1, quantity: 60 })];
    const server = [buildItem({ productId: 1, quantity: 60 })];

    const [merged] = mergeCartItems(local, server);

    expect(merged.quantity).toBe(99);
  });

  it('clamps a local-only item already over 99 down to 99', () => {
    const local = [buildItem({ productId: 5, quantity: 150 })];
    const server: CartItem[] = [];

    const [merged] = mergeCartItems(local, server);

    expect(merged.quantity).toBe(99);
  });

  it('drops an item with a non-finite quantity', () => {
    const local = [buildItem({ productId: 5, quantity: Number.NaN })];
    const server: CartItem[] = [];

    expect(mergeCartItems(local, server)).toEqual([]);
  });

  it('drops an item with a quantity below 1', () => {
    const local = [buildItem({ productId: 5, quantity: 0 })];
    const server: CartItem[] = [];

    expect(mergeCartItems(local, server)).toEqual([]);
  });

  it('passes server-only items through unchanged', () => {
    const local: CartItem[] = [];
    const server = [buildItem({ productId: 9, quantity: 2 })];

    expect(mergeCartItems(local, server)).toEqual([buildItem({ productId: 9, quantity: 2 })]);
  });

  it('passes local-only items through unchanged', () => {
    const local = [buildItem({ productId: 9, quantity: 2 })];
    const server: CartItem[] = [];

    expect(mergeCartItems(local, server)).toEqual([buildItem({ productId: 9, quantity: 2 })]);
  });

  it('orders output as server items in server order, then local-only items appended', () => {
    const local = [
      buildItem({ productId: 3, name: 'Local-only A' }),
      buildItem({ productId: 1, name: 'Overlap' }),
      buildItem({ productId: 4, name: 'Local-only B' }),
    ];
    const server = [
      buildItem({ productId: 2, name: 'Server B' }),
      buildItem({ productId: 1, name: 'Overlap (server name)' }),
    ];

    const merged = mergeCartItems(local, server);

    expect(merged.map((i) => i.productId)).toEqual([2, 1, 3, 4]);
  });
});

describe('detectPriceDrift', () => {
  it('produces one entry for a product present in both sets with differing prices', () => {
    const local = [buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1500 })];
    const server = [buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1800 })];

    expect(detectPriceDrift(local, server)).toEqual([
      { name: 'Figura Mario', oldPrice: 1500, newPrice: 1800 },
    ]);
  });

  it('produces no entry when local and server prices match', () => {
    const local = [buildItem({ productId: 1, unitPrice: 1500 })];
    const server = [buildItem({ productId: 1, unitPrice: 1500 })];

    expect(detectPriceDrift(local, server)).toEqual([]);
  });

  it('produces no entry for a server-only product (no local record)', () => {
    const local: CartItem[] = [];
    const server = [buildItem({ productId: 1, unitPrice: 1800 })];

    expect(detectPriceDrift(local, server)).toEqual([]);
  });

  it('produces no entry for a local-only product (no server record)', () => {
    const local = [buildItem({ productId: 1, unitPrice: 1500 })];
    const server: CartItem[] = [];

    expect(detectPriceDrift(local, server)).toEqual([]);
  });

  it('produces one entry per drifted product when multiple products drift', () => {
    const local = [
      buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1500 }),
      buildItem({ productId: 2, name: 'Figura Sonic', unitPrice: 800 }),
    ];
    const server = [
      buildItem({ productId: 1, name: 'Figura Mario', unitPrice: 1800 }),
      buildItem({ productId: 2, name: 'Figura Sonic', unitPrice: 900 }),
    ];

    expect(detectPriceDrift(local, server)).toEqual([
      { name: 'Figura Mario', oldPrice: 1500, newPrice: 1800 },
      { name: 'Figura Sonic', oldPrice: 800, newPrice: 900 },
    ]);
  });
});

describe('hydrateFromServer', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let fetchMock: ReturnType<typeof vi.fn>;

  // One fetch mock serves both verbs, discriminated on init.method — never
  // chained mockResolvedValueOnce for two different verbs (design's gotcha #1).
  function stubFetch(handlers: {
    get?: () => Promise<unknown>;
    put?: () => Promise<unknown>;
  }) {
    fetchMock.mockImplementation((_url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') {
        return (handlers.put ?? (() => Promise.resolve({ ok: true })))();
      }
      return (handlers.get ?? (() => Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [], total: 0 }) })))();
    });
  }

  function okGetResponse(items: ServerCartItemDTO[]) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ items, total: 0 }) });
  }

  beforeEach(() => {
    vi.useFakeTimers();
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
    stubCookie(''); // default: guest
  });

  afterEach(() => {
    discardPendingSync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function drain<T>(promise: Promise<T>): Promise<T> {
    await vi.advanceTimersByTimeAsync(0);
    return promise;
  }

  describe('guest and failure paths', () => {
    it('resolves {ok:false, reason:"guest"} and never calls fetch when there is no session', async () => {
      stubCookie('');
      cartItems.set([{ productId: 1, name: 'A', image: '', unitPrice: 100, quantity: 1 }]);

      const result = await drain(hydrateFromServer());

      expect(result).toEqual({
        ok: false,
        items: [{ productId: 1, name: 'A', image: '', unitPrice: 100, quantity: 1 }],
        priceDrifts: [],
        syncScheduled: false,
        reason: 'guest',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resolves {ok:false, reason:"network"} and leaves state untouched when fetch throws', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'A', image: '', unitPrice: 100, quantity: 1 }];
      cartItems.set(local);
      stubFetch({ get: () => Promise.reject(new Error('network down')) });

      const result = await drain(hydrateFromServer());

      expect(result).toEqual({ ok: false, items: local, priceDrifts: [], syncScheduled: false, reason: 'network' });
      expect(cartItems.get()).toEqual(local);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('resolves {ok:false, reason:"http"} and leaves state untouched when the response is not ok', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'A', image: '', unitPrice: 100, quantity: 1 }];
      cartItems.set(local);
      stubFetch({ get: () => Promise.resolve({ ok: false, status: 401 }) });

      const result = await drain(hydrateFromServer());

      expect(result).toEqual({ ok: false, items: local, priceDrifts: [], syncScheduled: false, reason: 'http' });
      expect(cartItems.get()).toEqual(local);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('resolves {ok:false, reason:"http"} and leaves state untouched when res.json() throws', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'A', image: '', unitPrice: 100, quantity: 1 }];
      cartItems.set(local);
      stubFetch({
        get: () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }),
      });

      const result = await drain(hydrateFromServer());

      expect(result).toEqual({ ok: false, items: local, priceDrifts: [], syncScheduled: false, reason: 'http' });
      expect(cartItems.get()).toEqual(local);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('resolves {ok:false, reason:"http"} and leaves state untouched when items is not an array', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'A', image: '', unitPrice: 100, quantity: 1 }];
      cartItems.set(local);
      stubFetch({
        get: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ items: 'not-an-array', total: 0 }) }),
      });

      const result = await drain(hydrateFromServer());

      expect(result).toEqual({ ok: false, items: local, priceDrifts: [], syncScheduled: false, reason: 'http' });
      expect(cartItems.get()).toEqual(local);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('superseded guard (replace mode, burst opens during the GET)', () => {
    it('aborts with reason "superseded" and leaves local state untouched when a burst opens mid-flight', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 9, name: 'Local', image: '', unitPrice: 50, quantity: 1 }];
      cartItems.set(local);

      let resolveGet: (value: unknown) => void = () => {};
      const getPromise = new Promise((resolve) => {
        resolveGet = resolve;
      });
      stubFetch({ get: () => getPromise as Promise<unknown> });

      const resultPromise = hydrateFromServer();
      await vi.advanceTimersByTimeAsync(0); // flushCartSync() no-op resolves; GET now in flight

      // Simulate a mutation opening a new burst while the GET is pending.
      scheduleSync([{ ...local[0], quantity: 2 }], local);
      expect(fetchMock).toHaveBeenCalledTimes(1); // only the GET so far — no PUT from scheduleSync alone

      resolveGet(await okGetResponse([buildDto({ idProduct: 1, quantity: 5 })]));
      const result = await drain(resultPromise);

      expect(result).toEqual({ ok: false, items: local, priceDrifts: [], syncScheduled: false, reason: 'superseded' });
      expect(cartItems.get()).toEqual(local);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('replace-mode success path', () => {
    it('flushes a pending burst before issuing the GET (PUT-before-GET ordering)', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'Local', image: '', unitPrice: 100, quantity: 1 }];
      cartItems.set(local);
      // Arm a pending burst (as addToCart would) before calling hydrateFromServer.
      scheduleSync([{ ...local[0], quantity: 2 }], local);
      stubFetch({
        put: () => Promise.resolve({ ok: true }),
        get: () => okGetResponse([]),
      });

      await drain(hydrateFromServer());

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
      expect(fetchMock.mock.calls[1][1].method).toBe('GET');
    });

    it('proceeds without waiting on any flush when there is no pending burst', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      cartItems.set([]);
      stubFetch({ get: () => okGetResponse([]) });

      await drain(hydrateFromServer());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    });

    it('writes the store and localStorage with the server cart and issues zero PUTs', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'Local Mario', image: 'local.jpg', unitPrice: 1500, quantity: 1 }];
      cartItems.set(local);
      const serverDto = buildDto({
        idProduct: 1,
        quantity: 3,
        product: { idProduct: 1, nameProduct: 'Server Mario', price: 1800, image: 'server.jpg' },
      });
      stubFetch({ get: () => okGetResponse([serverDto]) });

      const result = await drain(hydrateFromServer());

      const expectedServerItems = [
        { productId: 1, name: 'Server Mario', image: 'server.jpg', unitPrice: 1800, quantity: 3 },
      ];
      expect(result.ok).toBe(true);
      expect(result.items).toEqual(expectedServerItems);
      expect(result.priceDrifts).toEqual([{ name: 'Server Mario', oldPrice: 1500, newPrice: 1800 }]);
      expect(result.syncScheduled).toBe(false);
      expect(cartItems.get()).toEqual(expectedServerItems);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cart', JSON.stringify(expectedServerItems));
      expect(fetchMock).toHaveBeenCalledTimes(1); // GET only, zero PUT
    });

    it('arms no debounce or max-wait timer as a side effect of the replace write (nano-stores-cart: hydration bypasses the scheduler)', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      cartItems.set([{ productId: 1, name: 'Local Mario', image: 'local.jpg', unitPrice: 1500, quantity: 1 }]);
      stubFetch({ get: () => okGetResponse([buildDto({ idProduct: 1, quantity: 2 })]) });

      await drain(hydrateFromServer());

      // A test that only checks the fetch count right after the GET resolves
      // cannot tell "no burst was armed" from "a burst was armed but hasn't
      // flushed yet" — SYNC_DEBOUNCE_MS/SYNC_MAX_WAIT_MS haven't elapsed.
      // Advancing well past both proves the difference.
      expect(hasPendingSync()).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchMock).toHaveBeenCalledTimes(1); // still just the GET — no PUT ever fired
    });
  });

  describe('merge-mode success path', () => {
    it('takes the replace path and issues zero PUT when the local cart is empty', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      cartItems.set([]);
      const serverDto = buildDto({ idProduct: 1, quantity: 2 });
      stubFetch({ get: () => okGetResponse([serverDto]) });

      const result = await drain(hydrateFromServer({ mergeLocal: true }));

      expect(result.ok).toBe(true);
      expect(result.syncScheduled).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    });

    it('merges local and server carts and issues exactly one PUT carrying the merged set', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'Local', image: 'l.jpg', unitPrice: 100, quantity: 2 }];
      cartItems.set(local);
      const serverDto = buildDto({
        idProduct: 1,
        quantity: 3,
        product: { idProduct: 1, nameProduct: 'Server Item', price: 200, image: 's.jpg' },
      });
      let putBody: unknown;
      fetchMock.mockImplementation((_url: string, init: RequestInit & { body?: string } = {}) => {
        if (init.method === 'PUT') {
          putBody = init.body ? JSON.parse(init.body) : undefined;
          return Promise.resolve({ ok: true });
        }
        return okGetResponse([serverDto]);
      });

      const result = await drain(hydrateFromServer({ mergeLocal: true }));

      expect(result.ok).toBe(true);
      expect(result.syncScheduled).toBe(true);
      expect(result.items).toEqual([
        { productId: 1, name: 'Server Item', image: 's.jpg', unitPrice: 200, quantity: 5 },
      ]);
      expect(cartItems.get()).toEqual([
        { productId: 1, name: 'Server Item', image: 's.jpg', unitPrice: 200, quantity: 5 },
      ]);
      const putCalls = fetchMock.mock.calls.filter((call) => call[1].method === 'PUT');
      expect(putCalls).toHaveLength(1);
      expect(putBody).toEqual({ items: [{ productId: 1, quantity: 5 }] });
    });

    it('does not strand an already-open burst\'s rollback baseline when the merge PUT is issued', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      const local = [{ productId: 1, name: 'Local', image: 'l.jpg', unitPrice: 100, quantity: 2 }];
      cartItems.set(local);

      let resolveGet: (value: unknown) => void = () => {};
      const getPromise = new Promise((resolve) => {
        resolveGet = resolve;
      });
      // The merge PUT itself fails, so a successful rollback reveals which
      // baseline was actually used.
      fetchMock.mockImplementation((_url: string, init: RequestInit = {}) => {
        if (init.method === 'PUT') return Promise.resolve({ ok: false, status: 500 });
        return getPromise as Promise<unknown>;
      });

      const resultPromise = hydrateFromServer({ mergeLocal: true });
      await vi.advanceTimersByTimeAsync(0); // initial flushCartSync() no-op resolves; GET now in flight

      // A burst opens mid-flight, BEFORE the merge's own scheduleSync/flush
      // step runs — its rollback baseline must survive the merge's own
      // scheduleSync() call (which must not clobber an already-open burst's
      // baseline).
      const midFlightBaseline = [{ productId: 2, name: 'Mid', image: '', unitPrice: 10, quantity: 1 }];
      scheduleSync([{ productId: 1, name: 'Local', image: 'l.jpg', unitPrice: 100, quantity: 9 }], midFlightBaseline);

      const serverDto = buildDto({
        idProduct: 1,
        quantity: 1,
        product: { idProduct: 1, nameProduct: 'Server Item', price: 100, image: 's.jpg' },
      });
      resolveGet(await okGetResponse([serverDto]));
      await drain(resultPromise);

      const putCalls = fetchMock.mock.calls.filter((call) => call[1].method === 'PUT');
      expect(putCalls).toHaveLength(1); // coalesced into a single PUT

      // Let the (failed) merge PUT's rollback settle.
      await vi.advanceTimersByTimeAsync(0);

      expect(cartItems.get()).toEqual(midFlightBaseline);
    });
  });

  describe('CartService.hydrateFromServer delegation', () => {
    it('delegates its argument to cartHydration.hydrateFromServer and returns its result unchanged', async () => {
      const fakeResult: HydrationResult = {
        ok: true,
        items: [],
        priceDrifts: [],
        syncScheduled: true,
      };
      const spy = vi.spyOn(cartHydrationModule, 'hydrateFromServer').mockResolvedValue(fakeResult);

      const result = await CartService.hydrateFromServer({ mergeLocal: true });

      expect(spy).toHaveBeenCalledWith({ mergeLocal: true });
      expect(result).toBe(fakeResult);
    });
  });
});
