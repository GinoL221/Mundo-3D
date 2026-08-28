import { ManualPaymentGateway } from '../ManualPaymentGateway';

describe('ManualPaymentGateway', () => {
  let gateway: ManualPaymentGateway;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    gateway = new ManualPaymentGateway();
    // No real payment processor exists yet — `initiate`/`confirm`/`cancel`
    // must never perform network I/O (design.md: "no real network call").
    fetchSpy = jest.spyOn(global, 'fetch' as never).mockImplementation(() => {
      throw new Error('fetch must never be called by ManualPaymentGateway');
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('initiate', () => {
    it('resolves synchronously with a generated PENDING reference and makes zero network calls', async () => {
      const intent = await gateway.initiate({ orderId: 41, amount: 3000, currency: 'ARS' });

      expect(intent.status).toBe('PENDING');
      expect(intent.reference).toEqual(expect.stringContaining('41'));
      expect(intent.redirectUrl ?? null).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('generates a distinct reference per call', async () => {
      const a = await gateway.initiate({ orderId: 1, amount: 10, currency: 'ARS' });
      const b = await gateway.initiate({ orderId: 1, amount: 10, currency: 'ARS' });

      expect(a.reference).not.toBe(b.reference);
    });
  });

  describe('confirm / cancel', () => {
    it('confirm round-trips the same reference with CONFIRMED status', async () => {
      const { reference } = await gateway.initiate({ orderId: 7, amount: 500, currency: 'ARS' });
      const confirmed = await gateway.confirm(reference);

      expect(confirmed.reference).toBe(reference);
      expect(confirmed.status).toBe('CONFIRMED');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('cancel round-trips the same reference with CANCELLED status', async () => {
      const { reference } = await gateway.initiate({ orderId: 7, amount: 500, currency: 'ARS' });
      const cancelled = await gateway.cancel(reference);

      expect(cancelled.reference).toBe(reference);
      expect(cancelled.status).toBe('CANCELLED');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
