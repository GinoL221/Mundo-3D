export interface RetentionLogger {
  error(fields: { err: unknown }, message: string): void;
}

export interface CommissionRequestRetention {
  ready: Promise<void>;
  stop(): void;
}

export function startCommissionRequestRetention(
  purgeExpired: () => Promise<number>,
  logger: RetentionLogger,
  intervalMs = 60 * 60 * 1000,
): CommissionRequestRetention {
  const runSafely = async (): Promise<void> => {
    try {
      await purgeExpired();
    } catch (err) {
      logger.error({ err }, 'Failed to purge expired commission requests');
    }
  };

  const ready = runSafely();
  const interval = setInterval(() => {
    void runSafely();
  }, intervalMs);
  if (typeof interval.unref === 'function') interval.unref();

  return { ready, stop: () => clearInterval(interval) };
}
