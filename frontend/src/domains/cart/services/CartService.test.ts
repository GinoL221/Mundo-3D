import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartService, cartItems, cartTotal, type CartItem } from './CartService';
import {
  discardPendingSync,
  registerCartFlushListeners,
  SYNC_DEBOUNCE_MS,
  SYNC_MAX_WAIT_MS,
} from './cartSync';

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

// Mirrors the cookie-stubbing pattern from session.service.test.ts and
// csrf.test.ts — CartService now gates auth via getSessionUser() (m3d_user
// cookie) and attaches CSRF via withCredentials() (m3d_csrf cookie), not
// localStorage.
function stubCookie(cookie: string) {
  vi.stubGlobal('document', { cookie });
}

const LOGGED_IN_COOKIE = `m3d_user=${encodeURIComponent(JSON.stringify({ idRole: 2 }))}; m3d_csrf=random.hmac`;

function buildProduct(overrides: Partial<{ id: number; name: string; image: string; price: number }> = {}) {
  return {
    id: 1,
    name: 'Figura Mario',
    image: 'figura_mario.jpg',
    price: 1500,
    ...overrides,
  };
}

// Fires the trailing-edge debounce window under fake timers, draining the
// resulting scheduleSync -> flushCartSync -> syncToBackend promise chain.
async function flushSync(): Promise<void> {
  await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
}

// Builds window/document stubs rich enough for registerCartFlushListeners:
// captures registered handlers by event type so a test can invoke them
// directly. `dispatchEvent` is forwarded to the given spy — the SAME stub
// is also installed as the global `window` (via vi.stubGlobal) so it is
// also what persistCart's `window.dispatchEvent(...)` call reaches; the
// default `{ dispatchEvent }`-only global stub has no addEventListener.
function createFlushListenerStubs(dispatchEventSpy: ReturnType<typeof vi.fn>) {
  const handlers: Record<string, () => void> = {};
  const winStub = {
    dispatchEvent: dispatchEventSpy,
    addEventListener: (type: string, handler: () => void) => {
      handlers[type] = handler;
    },
    removeEventListener: (type: string) => {
      delete handlers[type];
    },
  };
  const docStub = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (type: string, handler: () => void) => {
      handlers[type] = handler;
    },
    removeEventListener: (type: string) => {
      delete handlers[type];
    },
  };
  return {
    winStub: winStub as unknown as Window,
    docStub: docStub as unknown as Document,
    handlers,
    setVisibility: (state: DocumentVisibilityState) => {
      docStub.visibilityState = state;
    },
  };
}

describe('CartService', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let dispatchEventSpy: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    discardPendingSync();

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
    stubCookie(''); // default: logged out
  });

  afterEach(() => {
    discardPendingSync();
    vi.useRealTimers();
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
    it('does not call fetch when there is no active session', async () => {
      stubCookie('');

      CartService.addToCart(buildProduct());
      await flushSync();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the cart sync request with credentials + CSRF token and serialized items when a session is active', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 7 }), 2);
      await flushSync();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/cart');
      expect(options.method).toBe('PUT');
      expect(options.credentials).toBe('include');
      expect(options.headers['X-CSRF-Token']).toBe('random.hmac');
      expect(options.headers.Authorization).toBeUndefined();
      expect(JSON.parse(options.body)).toEqual({ items: [{ productId: 7, quantity: 2 }] });
      // Regression guard: keepalive lets this request survive a navigation
      // that happens right after addToCart/removeFromCart/checkout redirect.
      // Without it, the browser cancels the in-flight request on navigation,
      // which used to make the failure handler wrongly roll back a cart
      // update that actually had nothing wrong with it.
      expect(options.keepalive).toBe(true);
    });

    it('rolls back local cart state and re-persists when the backend responds with a non-ok status', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      // Cart starts empty (previousItems === []), then we add a product which
      // should be optimistically applied and then rolled back on sync failure.
      CartService.addToCart(buildProduct({ id: 7 }));

      await flushSync();
      expect(cartItems.get()).toEqual([]);
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith('cart', JSON.stringify([]));
    });

    // Spec scenario 6: a failed flush must roll back to the state before the
    // BURST'S FIRST mutation (S0), not to the state before only the burst's
    // last mutation (S1). Every other rollback test in this file uses a
    // single-mutation burst, where S0 and "before the last mutation" are
    // identical and therefore cannot distinguish the two baselines. This
    // test uses a genuine 2-mutation burst (S0=[] -> S1=[7] -> S2=[7,8]) so a
    // sync failure must expose S0, catching a regression that re-captures
    // the rollback baseline on every mutation instead of only the first.
    it('rolls back to the state before the burst\'s first mutation, not the state before only the last mutation, when a multi-mutation burst fails to sync', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      // S0 = [] (cart starts empty).
      CartService.addToCart(buildProduct({ id: 7 })); // -> S1 = [7]
      await vi.advanceTimersByTimeAsync(100); // still inside the 300ms debounce window
      CartService.addToCart(buildProduct({ id: 8 })); // -> S2 = [7, 8], same coalesced burst

      await flushSync();

      expect(cartItems.get()).toEqual([]);
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith('cart', JSON.stringify([]));
    });

    it('does NOT roll back local cart state when fetch itself throws (ambiguous: real network failure vs. a request cancelled by navigation)', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockRejectedValue(new Error('network down'));

      CartService.addToCart(buildProduct({ id: 7 }));

      // The optimistic local update stays applied — see syncToBackend's
      // catch block for why a thrown fetch() is treated differently from a
      // confirmed non-ok response.
      expect(cartItems.get()).toEqual([expect.objectContaining({ productId: 7 })]);
      await flushSync();
      expect(cartItems.get()).toEqual([expect.objectContaining({ productId: 7 })]);
    });

    it('still dispatches a cart-sync-error event when fetch() throws, even without rolling back', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockRejectedValue(new Error('network down'));

      CartService.addToCart(buildProduct({ id: 7 }));

      await flushSync();
      const errorEventCall = dispatchEventSpy.mock.calls.find(
        (call) => call[0].type === 'cart-sync-error'
      );
      expect(errorEventCall).toBeDefined();
    });

    it('dispatches a cart-sync-error event when the sync fails', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      CartService.addToCart(buildProduct({ id: 7 }));

      await flushSync();
      const errorEventCall = dispatchEventSpy.mock.calls.find(
        (call) => call[0].type === 'cart-sync-error'
      );
      expect(errorEventCall).toBeDefined();
      expect(errorEventCall?.[0].detail.message).toBe(
        'No se pudo sincronizar el carrito con el servidor.'
      );
    });

    it('does not roll back state when the backend sync succeeds', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 7 }));
      await flushSync();

      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 7 }),
      ]);
    });

    // Regression test for a real concurrency bug: coalesced flushes are
    // fire-and-forget with no sequencing between them. If an OLDER flush's
    // PUT resolves LATE (after a NEWER flush's PUT already resolved and
    // succeeded), the older flush's failure handler used to roll back to
    // ITS OWN captured previousItems — stomping the newer, already-confirmed
    // state with stale data. The sequence guard in syncToBackend must skip
    // that stale rollback. Each mutation here is separated by a full
    // flushSync() so it becomes its own distinct coalesced burst, matching
    // the two distinct syncToBackend calls this test asserted before batching.
    it('does not let a late-arriving failed sync roll back state that a newer sync already confirmed', async () => {
      stubCookie(LOGGED_IN_COOKIE);

      // First burst (older): addToCart(id: 7). Its PUT will resolve LATE and
      // fail. Second burst (newer): removeFromCart(7). Its PUT resolves
      // FIRST and succeeds, leaving the store at [] (correct, confirmed
      // state).
      let resolveFirstFetch: (value: { ok: boolean; status?: number }) => void;
      const firstFetchPromise = new Promise<{ ok: boolean; status?: number }>((resolve) => {
        resolveFirstFetch = resolve;
      });

      fetchMock.mockImplementationOnce(() => firstFetchPromise);
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true }));

      // Older burst flushes: cart goes from [] -> [{productId: 7}],
      // previousItems = [].
      CartService.addToCart(buildProduct({ id: 7 }));
      await flushSync();
      // Newer burst flushes before the older one resolves: cart goes from
      // [{productId: 7}] -> [], previousItems = [{productId: 7}].
      CartService.removeFromCart(7);
      await flushSync();

      expect(cartItems.get()).toEqual([]);

      // Older flush's fetch now resolves LATE with a failure. Its captured
      // previousItems happens to also be [], so the cartItems value alone
      // wouldn't distinguish a fired-but-coincidentally-harmless rollback
      // from a correctly-skipped one. The localStorage write is the
      // distinguishing signal: without the sequence guard, the stale
      // rollback still calls persistCart(previousItems), which re-invokes
      // setItem even though the value happens to match.
      localStorageMock.setItem.mockClear();
      resolveFirstFetch!({ ok: false, status: 500 });
      await vi.advanceTimersByTimeAsync(0);

      expect(cartItems.get()).toEqual([]);
      // The stale rollback must not fire at all: no extra persist call from
      // the older, now-superseded sync.
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('does not let a late-arriving failed sync roll back a DIFFERENT newer mutation', async () => {
      stubCookie(LOGGED_IN_COOKIE);

      let resolveFirstFetch: (value: { ok: boolean; status?: number }) => void;
      const firstFetchPromise = new Promise<{ ok: boolean; status?: number }>((resolve) => {
        resolveFirstFetch = resolve;
      });

      fetchMock.mockImplementationOnce(() => firstFetchPromise);
      fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true }));

      // Older burst: addToCart(id: 7). previousItems = [].
      CartService.addToCart(buildProduct({ id: 7 }));
      await flushSync();
      // Newer burst: addToCart(id: 8). previousItems = [{productId: 7}].
      // Its PUT resolves first and succeeds, confirming [7, 8].
      CartService.addToCart(buildProduct({ id: 8 }));
      await flushSync();

      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 7 }),
        expect.objectContaining({ productId: 8 }),
      ]);

      // Older flush's fetch resolves LATE with a failure. If the stale
      // rollback fired, it would reset state to [] (its own previousItems),
      // discarding both confirmed items.
      resolveFirstFetch!({ ok: false, status: 500 });
      await vi.advanceTimersByTimeAsync(0);

      expect(cartItems.get()).toEqual([
        expect.objectContaining({ productId: 7 }),
        expect.objectContaining({ productId: 8 }),
      ]);
    });

    it('coalesces rapid mutations into a single PUT carrying the last state of the burst', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 1 }));
      await vi.advanceTimersByTimeAsync(100);
      CartService.addToCart(buildProduct({ id: 2 }));
      await vi.advanceTimersByTimeAsync(100);
      CartService.addToCart(buildProduct({ id: 3 }));

      expect(fetchMock).not.toHaveBeenCalled();

      await flushSync();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({
        items: [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
          { productId: 3, quantity: 1 },
        ],
      });
      expect(options.keepalive).toBe(true);
    });

    it('dispatches cart-updated once per mutation, independent of the coalesced network flush', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 1 }));
      await vi.advanceTimersByTimeAsync(100);
      CartService.addToCart(buildProduct({ id: 2 }));
      await vi.advanceTimersByTimeAsync(100);
      CartService.addToCart(buildProduct({ id: 3 }));

      const cartUpdatedCalls = dispatchEventSpy.mock.calls.filter(
        (call) => call[0].type === 'cart-updated'
      );
      expect(cartUpdatedCalls).toHaveLength(3);

      await flushSync();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('flushes via the max-wait cap when mutations never leave a quiet window', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });

      CartService.addToCart(buildProduct({ id: 1 })); // t=0
      await vi.advanceTimersByTimeAsync(200); // t=200
      CartService.addToCart(buildProduct({ id: 2 }));
      await vi.advanceTimersByTimeAsync(200); // t=400
      CartService.addToCart(buildProduct({ id: 3 }));
      await vi.advanceTimersByTimeAsync(200); // t=600
      CartService.addToCart(buildProduct({ id: 4 }));
      await vi.advanceTimersByTimeAsync(200); // t=800
      CartService.addToCart(buildProduct({ id: 5 }));

      expect(fetchMock).not.toHaveBeenCalled();

      // t=800 -> t=1000, the max-wait cap fires without a quiet period ever
      // having elapsed (each mutation lands 200ms apart, well inside the
      // 300ms debounce window).
      await vi.advanceTimersByTimeAsync(SYNC_MAX_WAIT_MS - 800);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({
        items: [1, 2, 3, 4, 5].map((productId) => ({ productId, quantity: 1 })),
      });
    });

    it('flushes immediately when pagehide fires, bypassing the remaining debounce window', () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });
      const { winStub, docStub, handlers } = createFlushListenerStubs(dispatchEventSpy);
      vi.stubGlobal('window', winStub);
      const cleanup = registerCartFlushListeners(winStub, docStub);

      CartService.addToCart(buildProduct({ id: 7 }));
      expect(fetchMock).not.toHaveBeenCalled();

      handlers.pagehide();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      cleanup();
    });

    it('flushes when the tab becomes hidden, but not while it stays visible', () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });

      const hidden = createFlushListenerStubs(dispatchEventSpy);
      vi.stubGlobal('window', hidden.winStub);
      const hiddenCleanup = registerCartFlushListeners(hidden.winStub, hidden.docStub);
      hidden.setVisibility('hidden');
      CartService.addToCart(buildProduct({ id: 7 }));

      hidden.handlers.visibilitychange();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      hiddenCleanup();

      const visible = createFlushListenerStubs(dispatchEventSpy);
      vi.stubGlobal('window', visible.winStub);
      const visibleCleanup = registerCartFlushListeners(visible.winStub, visible.docStub);
      visible.setVisibility('visible');
      CartService.addToCart(buildProduct({ id: 8 }));

      visible.handlers.visibilitychange();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      visibleCleanup();
    });
  });

  describe('hasToken', () => {
    it('returns true when a session cookie is present', () => {
      stubCookie(LOGGED_IN_COOKIE);
      expect(CartService.hasToken()).toBe(true);
    });

    it('returns false when there is no session', () => {
      stubCookie('');
      expect(CartService.hasToken()).toBe(false);
    });

    it('returns false when the session cookie is malformed', () => {
      stubCookie('m3d_user=%7Bnot-valid-json');
      expect(CartService.hasToken()).toBe(false);
    });
  });

  describe('checkout', () => {
    it('returns false and leaves the cart untouched when there is no session', () => {
      stubCookie('');
      CartService.addToCart(buildProduct());

      const result = CartService.checkout();

      expect(result).toBe(false);
      expect(cartItems.get()).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('clears the cart and returns true when a session is active', () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });
      CartService.addToCart(buildProduct());

      const result = CartService.checkout();

      expect(result).toBe(true);
      expect(cartItems.get()).toEqual([]);
    });

    it('dispatches the sync flush synchronously, before checkout() returns', () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValue({ ok: true });
      CartService.addToCart(buildProduct());

      // No debounce window has elapsed at all — checkout() must still have
      // issued the fetch by the time it returns.
      CartService.checkout();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Regression test for a real bug: PUT /api/cart used to reject an empty
    // `items` array (400 "Items must be a non-empty array"), which made
    // syncToBackend's failure handler roll the local cart back to its
    // pre-checkout contents right after checkout() had already reported
    // success. The backend validator now accepts an empty array (full-replace
    // semantics), but CartService's rollback-on-failure behavior itself is
    // still correct and should be preserved for genuine sync failures.
    //
    // The add-to-cart burst must be flushed and confirmed BEFORE checkout()
    // runs. Otherwise the add and the checkout would coalesce into a single
    // burst whose baseline is [], and cartBeforeCheckout would no longer be
    // the last-confirmed state the rollback assertion depends on.
    it('rolls back to the pre-checkout cart if the backend rejects the empty-items sync', async () => {
      stubCookie(LOGGED_IN_COOKIE);
      fetchMock.mockResolvedValueOnce({ ok: true });
      CartService.addToCart(buildProduct());
      await flushSync();
      const cartBeforeCheckout = cartItems.get();

      fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
      const result = CartService.checkout();

      expect(result).toBe(true);
      expect(cartItems.get()).toEqual([]);

      await vi.advanceTimersByTimeAsync(0);
      expect(cartItems.get()).toEqual(cartBeforeCheckout);
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        'cart',
        JSON.stringify(cartBeforeCheckout)
      );
    });
  });
});
