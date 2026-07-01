import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartService, cartItems, cartTotal, type CartItem } from './CartService';

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

function buildProduct(overrides: Partial<{ id: number; name: string; image: string; price: number }> = {}) {
  return {
    id: 1,
    name: 'Figura Mario',
    image: 'figura_mario.jpg',
    price: 1500,
    ...overrides,
  };
}

// Waits for pending microtasks/macrotasks (e.g. the fire-and-forget
// syncToBackend promise chain triggered by addToCart/removeFromCart/clearCart).
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('CartService', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let dispatchEventSpy: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cartItems.set([]);
    localStorageMock = createLocalStorageMock();
    dispatchEventSpy = vi.fn();
    fetchMock = vi.fn();

    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', { dispatchEvent: dispatchEventSpy });
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('loadCartFromStorage', () => {
    it('loads a valid array of items from localStorage', () => {
      const stored: CartItem[] = [
        { productId: 1, name: 'Figura Mario', image: 'a.jpg', unitPrice: 1500, quantity: 2 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(stored));

      CartService.loadCartFromStorage();

      expect(cartItems.get()).toEqual(stored);
    });

    it('resets to an empty cart when there is nothing stored', () => {
      localStorageMock.getItem.mockReturnValue(null);

      CartService.loadCartFromStorage();

      expect(cartItems.get()).toEqual([]);
    });

    it('resets to an empty cart when the stored JSON is malformed', () => {
      localStorageMock.getItem.mockReturnValue('{not valid json');

      CartService.loadCartFromStorage();

      expect(cartItems.get()).toEqual([]);
    });

    it('resets to an empty cart when the stored data is valid JSON but not an array', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ foo: 'bar' }));

      CartService.loadCartFromStorage();

      expect(cartItems.get()).toEqual([]);
    });

    it('resets to an empty cart when localStorage.getItem throws', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('storage disabled');
      });

      CartService.loadCartFromStorage();

      expect(cartItems.get()).toEqual([]);
    });
  });

  describe('addToCart', () => {
    it('adds a new item with quantity 1 by default', () => {
      CartService.addToCart(buildProduct());

      expect(cartItems.get()).toEqual([
        { productId: 1, name: 'Figura Mario', image: 'figura_mario.jpg', unitPrice: 1500, quantity: 1 },
      ]);
    });

    it('adds a new item with a custom quantity', () => {
      CartService.addToCart(buildProduct(), 3);

      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 1, quantity: 3 }),
      ]);
    });

    it('merges quantity when the product is already present in the cart', () => {
      CartService.addToCart(buildProduct(), 2);
      CartService.addToCart(buildProduct(), 3);

      const items = cartItems.get();
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(5);
    });

    it('keeps distinct entries for different products', () => {
      CartService.addToCart(buildProduct({ id: 1 }));
      CartService.addToCart(buildProduct({ id: 2, name: 'Figura Sonic' }));

      expect(cartItems.get()).toHaveLength(2);
    });

    it('persists the updated cart to localStorage and dispatches cart-updated', () => {
      CartService.addToCart(buildProduct());

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cart',
        JSON.stringify(cartItems.get())
      );
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      expect(dispatchEventSpy.mock.calls[0][0]).toMatchObject({
        type: 'cart-updated',
        detail: { count: 1 },
      });
    });

    it('recomputes cartTotal from unitPrice * quantity', () => {
      CartService.addToCart(buildProduct({ price: 1500 }), 2);
      CartService.addToCart(buildProduct({ id: 2, price: 500 }), 1);

      expect(cartTotal.get()).toBe(1500 * 2 + 500 * 1);
    });
  });

  describe('removeFromCart', () => {
    it('removes only the targeted product', () => {
      CartService.addToCart(buildProduct({ id: 1 }));
      CartService.addToCart(buildProduct({ id: 2 }));

      CartService.removeFromCart(1);

      const items = cartItems.get();
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(2);
    });

    it('is a no-op when the product is not in the cart', () => {
      CartService.addToCart(buildProduct({ id: 1 }));

      CartService.removeFromCart(999);

      expect(cartItems.get()).toHaveLength(1);
    });

    it('persists the updated cart after removal', () => {
      CartService.addToCart(buildProduct({ id: 1 }));
      localStorageMock.setItem.mockClear();

      CartService.removeFromCart(1);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('cart', JSON.stringify([]));
    });
  });

  describe('clearCart', () => {
    it('empties the cart and persists an empty array', () => {
      CartService.addToCart(buildProduct());

      CartService.clearCart();

      expect(cartItems.get()).toEqual([]);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cart', JSON.stringify([]));
    });
  });

  describe('backend sync (syncToBackend, triggered via addToCart/removeFromCart/clearCart)', () => {
    it('does not call fetch when there is no auth token', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      CartService.addToCart(buildProduct());
      await flushPromises();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('calls the cart sync endpoint with the bearer token and serialized items when authenticated', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 7 }), 2);
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/cart');
      expect(options.method).toBe('PUT');
      expect(options.headers.Authorization).toBe('Bearer abc123');
      expect(JSON.parse(options.body)).toEqual({ items: [{ productId: 7, quantity: 2 }] });
      // Regression guard: keepalive lets this request survive a navigation
      // that happens right after addToCart/removeFromCart/checkout redirect.
      // Without it, the browser cancels the in-flight request on navigation,
      // which used to make the failure handler wrongly roll back a cart
      // update that actually had nothing wrong with it.
      expect(options.keepalive).toBe(true);
    });

    it('rolls back local cart state and re-persists when the backend responds with a non-ok status', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      // Cart starts empty (previousItems === []), then we add a product which
      // should be optimistically applied and then rolled back on sync failure.
      CartService.addToCart(buildProduct({ id: 7 }));

      await vi.waitFor(() => expect(cartItems.get()).toEqual([]));
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith('cart', JSON.stringify([]));
    });

    it('does NOT roll back local cart state when fetch itself throws (ambiguous: real network failure vs. a request cancelled by navigation)', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockRejectedValue(new Error('network down'));

      CartService.addToCart(buildProduct({ id: 7 }));

      // The optimistic local update stays applied — see syncToBackend's
      // catch block for why a thrown fetch() is treated differently from a
      // confirmed non-ok response.
      expect(cartItems.get()).toEqual([expect.objectContaining({ productId: 7 })]);
      await flushPromises();
      expect(cartItems.get()).toEqual([expect.objectContaining({ productId: 7 })]);
    });

    it('still dispatches a cart-sync-error event when fetch() throws, even without rolling back', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockRejectedValue(new Error('network down'));

      CartService.addToCart(buildProduct({ id: 7 }));

      await vi.waitFor(() => {
        const errorEventCall = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === 'cart-sync-error'
        );
        expect(errorEventCall).toBeDefined();
      });
    });

    it('dispatches a cart-sync-error event when the sync fails', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      CartService.addToCart(buildProduct({ id: 7 }));

      await vi.waitFor(() => {
        const errorEventCall = dispatchEventSpy.mock.calls.find(
          (call) => call[0].type === 'cart-sync-error'
        );
        expect(errorEventCall).toBeDefined();
      });

      const errorEventCall = dispatchEventSpy.mock.calls.find(
        (call) => call[0].type === 'cart-sync-error'
      );
      expect(errorEventCall?.[0].detail.message).toBe(
        'No se pudo sincronizar el carrito con el servidor.'
      );
    });

    it('does not roll back state when the backend sync succeeds', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 7 }));
      await flushPromises();

      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 7 }),
      ]);
    });

    // Regression test for a real concurrency bug: syncToBackend calls are
    // fire-and-forget with no sequencing between them. If an OLDER call's
    // PUT resolves LATE (after a NEWER call's PUT already resolved and
    // succeeded), the older call's failure handler used to roll back to
    // ITS OWN captured previousItems — stomping the newer, already-confirmed
    // state with stale data. The sequence guard in syncToBackend must skip
    // that stale rollback.
    it('does not let a late-arriving failed sync roll back state that a newer sync already confirmed', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );

      // First call (older): addToCart(id: 7). Its PUT will resolve LATE and
      // fail. Second call (newer): removeFromCart(7). Its PUT resolves
      // FIRST and succeeds, leaving the store at [] (correct, confirmed
      // state).
      let resolveFirstFetch: (value: { ok: boolean; status?: number }) => void;
      const firstFetchPromise = new Promise<{ ok: boolean; status?: number }>((resolve) => {
        resolveFirstFetch = resolve;
      });

      fetchMock.mockImplementationOnce(() => firstFetchPromise);
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true }));

      // Older call starts: cart goes from [] -> [{productId: 7}], previousItems = [].
      CartService.addToCart(buildProduct({ id: 7 }));
      // Newer call starts before the older one resolves: cart goes from
      // [{productId: 7}] -> [], previousItems = [{productId: 7}].
      CartService.removeFromCart(7);

      // Newer call's fetch resolves first and succeeds.
      await flushPromises();
      expect(cartItems.get()).toEqual([]);

      // Older call's fetch now resolves LATE with a failure. Its captured
      // previousItems happens to also be [], so the cartItems value alone
      // wouldn't distinguish a fired-but-coincidentally-harmless rollback
      // from a correctly-skipped one. The localStorage write is the
      // distinguishing signal: without the sequence guard, the stale
      // rollback still calls persistCart(previousItems), which re-invokes
      // setItem even though the value happens to match.
      localStorageMock.setItem.mockClear();
      resolveFirstFetch!({ ok: false, status: 500 });
      await flushPromises();

      expect(cartItems.get()).toEqual([]);
      // The stale rollback must not fire at all: no extra persist call from
      // the older, now-superseded sync.
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('does not let a late-arriving failed sync roll back a DIFFERENT newer mutation', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );

      let resolveFirstFetch: (value: { ok: boolean; status?: number }) => void;
      const firstFetchPromise = new Promise<{ ok: boolean; status?: number }>((resolve) => {
        resolveFirstFetch = resolve;
      });

      fetchMock.mockImplementationOnce(() => firstFetchPromise);
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true }));

      // Older call: addToCart(id: 7). previousItems = [].
      CartService.addToCart(buildProduct({ id: 7 }));
      // Newer call: addToCart(id: 8). previousItems = [{productId: 7}].
      // Its PUT resolves first and succeeds, confirming [7, 8].
      CartService.addToCart(buildProduct({ id: 8 }));

      await flushPromises();
      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 7 }),
        expect.objectContaining({ productId: 8 }),
      ]);

      // Older call's fetch resolves LATE with a failure. If the stale
      // rollback fired, it would reset state to [] (its own previousItems),
      // discarding both confirmed items.
      resolveFirstFetch!({ ok: false, status: 500 });
      await flushPromises();

      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 7 }),
        expect.objectContaining({ productId: 8 }),
      ]);
    });
  });

  describe('hasToken', () => {
    it('returns true when a token is stored', () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      expect(CartService.hasToken()).toBe(true);
    });

    it('returns false when there is no token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      expect(CartService.hasToken()).toBe(false);
    });

    it('returns false when localStorage access throws', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('storage disabled');
      });
      expect(CartService.hasToken()).toBe(false);
    });
  });

  describe('checkout', () => {
    it('returns false and leaves the cart untouched when there is no token', () => {
      localStorageMock.getItem.mockReturnValue(null);
      CartService.addToCart(buildProduct());

      const result = CartService.checkout();

      expect(result).toBe(false);
      expect(cartItems.get()).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('clears the cart and returns true when a token is present', () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockResolvedValue({ ok: true });
      CartService.addToCart(buildProduct());

      const result = CartService.checkout();

      expect(result).toBe(true);
      expect(cartItems.get()).toEqual([]);
    });

    it('returns false when localStorage access throws', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('storage disabled');
      });

      expect(CartService.checkout()).toBe(false);
    });

    // Regression test for a real bug: PUT /api/cart used to reject an empty
    // `items` array (400 "Items must be a non-empty array"), which made
    // syncToBackend's failure handler roll the local cart back to its
    // pre-checkout contents right after checkout() had already reported
    // success. The backend validator now accepts an empty array (full-replace
    // semantics), but CartService's rollback-on-failure behavior itself is
    // still correct and should be preserved for genuine sync failures.
    it('rolls back to the pre-checkout cart if the backend rejects the empty-items sync', async () => {
      localStorageMock.getItem.mockImplementation((key: string) =>
        key === 'token' ? 'abc123' : null
      );
      fetchMock.mockResolvedValue({ ok: false, status: 400 });
      CartService.addToCart(buildProduct());
      const cartBeforeCheckout = cartItems.get();

      const result = CartService.checkout();

      expect(result).toBe(true);
      expect(cartItems.get()).toEqual([]);

      await vi.waitFor(() => expect(cartItems.get()).toEqual(cartBeforeCheckout));
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'cart',
        JSON.stringify(cartBeforeCheckout)
      );
    });
  });
});
