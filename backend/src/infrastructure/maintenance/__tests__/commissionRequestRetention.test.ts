import { startCommissionRequestRetention } from '../commissionRequestRetention';

describe('commission request retention', () => {
  afterEach(() => jest.useRealTimers());

  it('purges immediately, repeats hourly, catches cleanup errors, and stops its interval', async () => {
    jest.useFakeTimers();
    const purge = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(2);
    const logger = { warn: jest.fn(), error: jest.fn() };
    const retention = startCommissionRequestRetention(purge, logger, 60 * 60 * 1000);
    await retention.ready;
    expect(purge).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.any(String));
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(purge).toHaveBeenCalledTimes(2);
    retention.stop();
    await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(purge).toHaveBeenCalledTimes(2);
  });
});
