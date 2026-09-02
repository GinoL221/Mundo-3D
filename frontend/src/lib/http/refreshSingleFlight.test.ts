import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureRefreshed } from './refreshSingleFlight';

// Task 3.4 (design.md D6): N concurrent callers collapse into exactly one
// POST to /api/users/refresh, and `inFlight` is cleared in `finally` so a
// later, independent refresh (after the first one settles) issues its own
// fresh request instead of being poisoned by a stale in-flight promise.
describe('ensureRefreshed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('collapses concurrent callers into a single POST to /api/users/refresh', async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = ensureRefreshed();
    const second = ensureRefreshed();
    const third = ensureRefreshed();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/refresh'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );

    resolveFetch(new Response(null, { status: 200 }));

    const [firstResult, secondResult, thirdResult] = await Promise.all([first, second, third]);
    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(thirdResult).toBe(true);
  });

  it('resolves false when the refresh response is not ok, without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureRefreshed()).resolves.toBe(false);
  });

  it('resolves false when fetch itself rejects (network failure)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureRefreshed()).resolves.toBe(false);
  });

  it('clears inFlight in finally: a later call issues a brand new request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await ensureRefreshed();
    await ensureRefreshed();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never attaches a CSRF header — the refresh call authenticates solely via the httpOnly cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await ensureRefreshed();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string> | undefined)?.['X-CSRF-Token']).toBeUndefined();
  });
});
