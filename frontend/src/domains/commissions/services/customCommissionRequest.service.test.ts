import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitCustomCommissionRequest } from './customCommissionRequest.service';

afterEach(() => vi.restoreAllMocks());

const request = { name: 'A Visitor', email: 'visitor@example.test', idea: 'A small custom figure' };

describe('submitCustomCommissionRequest', () => {
  it('posts JSON without credentials and omits an unselected product', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    expect(await submitCustomCommissionRequest(request)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/custom-commission-requests$/), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  });

  it('includes the selected product ID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
    await submitCustomCommissionRequest({ ...request, idProduct: 42 });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ ...request, idProduct: 42 });
  });

  it.each([[400, 'validation'], [429, 'rate-limit'], [500, 'server']] as const)(
    'maps HTTP %i to a safe %s result without exposing response content', async (status, reason) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ email: request.email }), { status }));
      const result = await submitCustomCommissionRequest(request);
      expect(result).toEqual({ ok: false, reason });
      expect(JSON.stringify(result)).not.toContain(request.email);
    },
  );

  it('maps network failures to a safe result', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(request.email));
    expect(await submitCustomCommissionRequest(request)).toEqual({ ok: false, reason: 'network' });
  });
});
