import { NoopMailAdapter } from '../NoopMailAdapter';

describe('NoopMailAdapter', () => {
  it('resolves email confirmation intents without performing outbound I/O', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const adapter = new NoopMailAdapter();

    await expect(
      adapter.sendEmailConfirmation({
        to: 'demo.buyer+slot-1@sandbox.mundo3d.invalid',
        confirmationUrl: 'https://demo.example.invalid/confirm-email?token=abc',
        expiresAt: new Date('2026-11-24T00:00:00.000Z'),
        idempotencyKey: 'key-1',
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
