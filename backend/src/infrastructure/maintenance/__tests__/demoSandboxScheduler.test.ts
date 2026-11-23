import type { DemoSandboxSlotSnapshot } from '../../../domain/entities/DemoSandboxSlot';
import { startDemoSandboxScheduler } from '../demoSandboxScheduler';

function slotSnapshot(
  overrides: Partial<DemoSandboxSlotSnapshot> & Pick<DemoSandboxSlotSnapshot, 'id' | 'status'>,
): DemoSandboxSlotSnapshot {
  return {
    generation: 1,
    leaseId: 'lease-1',
    allocatedAt: new Date('2026-11-23T00:00:00.000Z'),
    lastActivityAt: new Date('2026-11-23T00:00:00.000Z'),
    idleExpiresAt: new Date('2026-11-23T00:30:00.000Z'),
    absoluteExpiresAt: new Date('2026-11-23T01:00:00.000Z'),
    lastResetVerifiedAt: null,
    resetAttemptId: null,
    quarantineReason: null,
    ...overrides,
  };
}

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('demoSandboxScheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('expires due leases, resets draining slots, and leaves resetting slots untouched by default on boot', async () => {
    const logger = makeLogger();
    const expireDueLeases = jest.fn().mockResolvedValue([]);
    const listPendingSlots = jest
      .fn()
      .mockResolvedValue([
        slotSnapshot({ id: 'slot-1', status: 'draining', leaseId: 'lease-1' }),
        slotSnapshot({
          id: 'slot-2',
          status: 'resetting',
          leaseId: 'lease-2',
          resetAttemptId: 'attempt-2',
        }),
      ]);
    const resetSlot = jest.fn().mockResolvedValue('available');
    const recoverInterruptedSlot = jest.fn().mockResolvedValue('available');

    const scheduler = startDemoSandboxScheduler({
      expireDueLeases,
      listPendingSlots,
      resetSlot,
      recoverInterruptedSlot,
      recoverInterruptedOnBoot: false,
      logger,
      intervalMs: 60_000,
    });
    await scheduler.ready;
    scheduler.stop();

    expect(expireDueLeases).toHaveBeenCalledTimes(1);
    expect(resetSlot).toHaveBeenCalledWith('slot-1', 'lease-1');
    expect(recoverInterruptedSlot).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: 'slot-2', resetAttemptId: 'attempt-2' }),
      expect.stringContaining('DEMO_SANDBOX_RECOVER_ON_BOOT'),
    );
  });

  it('recovers interrupted resetting slots only on boot when recoverInterruptedOnBoot=true', async () => {
    const logger = makeLogger();
    const resettingSlot = slotSnapshot({
      id: 'slot-2',
      status: 'resetting',
      leaseId: 'lease-2',
      resetAttemptId: 'attempt-2',
    });
    const listPendingSlots = jest.fn().mockResolvedValue([resettingSlot]);
    const recoverInterruptedSlot = jest.fn().mockResolvedValue('available');

    const scheduler = startDemoSandboxScheduler({
      expireDueLeases: jest.fn().mockResolvedValue([]),
      listPendingSlots,
      resetSlot: jest.fn().mockResolvedValue('available'),
      recoverInterruptedSlot,
      recoverInterruptedOnBoot: true,
      logger,
      intervalMs: 1_000,
    });
    await scheduler.ready;
    expect(recoverInterruptedSlot).toHaveBeenCalledTimes(1);
    expect(recoverInterruptedSlot).toHaveBeenCalledWith('slot-2', 'lease-2', 'attempt-2', true);

    await jest.advanceTimersByTimeAsync(1_000);
    scheduler.stop();
    expect(recoverInterruptedSlot).toHaveBeenCalledTimes(1);
  });

  it('prevents overlapping sweeps and isolates per-slot reset failures', async () => {
    const logger = makeLogger();
    let releaseFirstReset!: () => void;
    const firstResetPromise = new Promise<'available'>((resolve) => {
      releaseFirstReset = () => resolve('available');
    });
    const expireDueLeases = jest.fn().mockResolvedValue([]);
    const listPendingSlots = jest
      .fn()
      .mockResolvedValue([
        slotSnapshot({ id: 'slot-1', status: 'draining', leaseId: 'lease-1' }),
        slotSnapshot({ id: 'slot-2', status: 'draining', leaseId: 'lease-2' }),
      ]);
    const resetSlot = jest
      .fn()
      .mockReturnValueOnce(firstResetPromise)
      .mockRejectedValueOnce(new Error('slot-2-boom'));

    const scheduler = startDemoSandboxScheduler({
      expireDueLeases,
      listPendingSlots,
      resetSlot,
      recoverInterruptedSlot: jest.fn(),
      recoverInterruptedOnBoot: false,
      logger,
      intervalMs: 500,
    });

    await jest.advanceTimersByTimeAsync(1_000);
    expect(expireDueLeases).toHaveBeenCalledTimes(1);

    releaseFirstReset();
    await scheduler.ready;
    scheduler.stop();

    expect(resetSlot).toHaveBeenNthCalledWith(1, 'slot-1', 'lease-1');
    expect(resetSlot).toHaveBeenNthCalledWith(2, 'slot-2', 'lease-2');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: 'slot-2' }),
      expect.stringContaining('reset'),
    );
  });
});
