import { DemoSandboxSlot } from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import { DemoSandboxResetPort } from '../../domain/ports/DemoSandboxResetPort';
import { AllocateDemoSandboxLeaseUseCase } from '../use-cases/AllocateDemoSandboxLeaseUseCase';
import { ExpireDemoSandboxLeasesUseCase } from '../use-cases/ExpireDemoSandboxLeasesUseCase';
import { ResetDemoSandboxSlotUseCase } from '../use-cases/ResetDemoSandboxSlotUseCase';

const minute = 60_000;
const policy = { idleTimeoutMs: 20 * minute, maxLifetimeMs: 60 * minute };
const now = new Date('2026-10-26T12:00:00.000Z');
const resetAttemptId = 'reset-attempt-a';

function leasedSlot() {
  const slot = DemoSandboxSlot.create('slot-a');
  slot.allocate('lease-a', now, policy);
  return slot.snapshot();
}

function resettableSlot() {
  const slot = DemoSandboxSlot.restore(leasedSlot());
  slot.expireIfDue(new Date(now.getTime() + 20 * minute));
  slot.beginReset(resetAttemptId);
  return slot.snapshot();
}

describe('demo sandbox lease use cases', () => {
  it('claims an available slot with a fresh lease id and configured policy', async () => {
    const snapshot = leasedSlot();
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn().mockResolvedValue(snapshot),
      expireDueLeases: jest.fn(),
      beginReset: jest.fn(),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn(),
      quarantine: jest.fn(),
    };
    const clock = { now: jest.fn(() => now) };
    const leaseIds = { next: jest.fn(() => 'lease-a') };
    const useCase = new AllocateDemoSandboxLeaseUseCase(repository, policy, clock, leaseIds);

    await expect(useCase.execute()).resolves.toEqual(snapshot);
    expect(clock.now).toHaveBeenCalledTimes(1);
    expect(leaseIds.next).toHaveBeenCalledTimes(1);
    expect(repository.claimAvailableSlot).toHaveBeenCalledWith('lease-a', now, policy);
  });

  it('moves due leases to draining through the repository at the injected current time', async () => {
    const slot = DemoSandboxSlot.restore(leasedSlot());
    slot.expireIfDue(new Date(now.getTime() + 20 * minute));
    const drainingSnapshot = slot.snapshot();
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn(),
      expireDueLeases: jest.fn().mockResolvedValue([drainingSnapshot]),
      beginReset: jest.fn(),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn(),
      quarantine: jest.fn(),
    };
    const clock = { now: jest.fn(() => now) };
    const useCase = new ExpireDemoSandboxLeasesUseCase(repository, clock);

    await expect(useCase.execute()).resolves.toEqual([drainingSnapshot]);
    expect(repository.expireDueLeases).toHaveBeenCalledWith(now);
  });

  it('returns no lease when the configured pool has no available slot', async () => {
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn().mockResolvedValue(null),
      expireDueLeases: jest.fn(),
      beginReset: jest.fn(),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn(),
      quarantine: jest.fn(),
    };
    const useCase = new AllocateDemoSandboxLeaseUseCase(
      repository,
      policy,
      { now: () => now },
      { next: () => 'lease-a' },
    );

    await expect(useCase.execute()).resolves.toBeNull();
    expect(repository.claimAvailableSlot).toHaveBeenCalledTimes(1);
  });

  it('returns a resetting slot to the pool only after reset verification succeeds', async () => {
    const snapshot = resettableSlot();
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn(),
      expireDueLeases: jest.fn(),
      beginReset: jest.fn().mockResolvedValue(snapshot),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn().mockResolvedValue('available'),
      quarantine: jest.fn(),
    };
    const resetter: DemoSandboxResetPort = {
      reset: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
    };
    const clock = { now: jest.fn(() => new Date(now.getTime() + 21 * minute)) };
    const resetAttemptIds = { next: jest.fn(() => resetAttemptId) };
    const useCase = new ResetDemoSandboxSlotUseCase(repository, resetter, clock, resetAttemptIds);

    await expect(useCase.execute('slot-a', 'lease-a')).resolves.toBe('available');
    expect(repository.beginReset).toHaveBeenCalledWith('slot-a', 'lease-a', resetAttemptId);
    expect(resetter.reset).toHaveBeenCalledWith('slot-a', 0, resetAttemptId);
    expect(resetter.verify).toHaveBeenCalledWith('slot-a', 0, resetAttemptId);
    expect(repository.completeReset).toHaveBeenCalledWith(
      'slot-a',
      'lease-a',
      resetAttemptId,
      new Date(now.getTime() + 21 * minute),
      true,
    );
    expect(repository.quarantine).not.toHaveBeenCalled();
  });

  it('quarantines a slot when reset verification fails', async () => {
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn(),
      expireDueLeases: jest.fn(),
      beginReset: jest.fn().mockResolvedValue(resettableSlot()),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn().mockResolvedValue('quarantined'),
      quarantine: jest.fn(),
    };
    const resetter: DemoSandboxResetPort = {
      reset: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(false),
    };
    const resetAttemptIds = { next: jest.fn(() => resetAttemptId) };
    const useCase = new ResetDemoSandboxSlotUseCase(
      repository,
      resetter,
      { now: () => now },
      resetAttemptIds,
    );

    await expect(useCase.execute('slot-a', 'lease-a')).resolves.toBe('quarantined');
    expect(repository.completeReset).toHaveBeenCalledWith(
      'slot-a',
      'lease-a',
      resetAttemptId,
      now,
      false,
    );
    expect(repository.quarantine).not.toHaveBeenCalled();
  });

  it('quarantines instead of releasing a slot when reset fails', async () => {
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn(),
      expireDueLeases: jest.fn(),
      beginReset: jest.fn().mockResolvedValue(resettableSlot()),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn(),
      quarantine: jest.fn().mockResolvedValue(true),
    };
    const resetter: DemoSandboxResetPort = {
      reset: jest.fn().mockRejectedValue(new Error('reset failed')),
      verify: jest.fn(),
    };
    const resetAttemptIds = { next: jest.fn(() => resetAttemptId) };
    const useCase = new ResetDemoSandboxSlotUseCase(
      repository,
      resetter,
      { now: () => now },
      resetAttemptIds,
    );

    await expect(useCase.execute('slot-a', 'lease-a')).resolves.toBe('quarantined');
    expect(repository.quarantine).toHaveBeenCalledWith(
      'slot-a',
      'lease-a',
      resetAttemptId,
      'reset_failed',
    );
    expect(repository.completeReset).not.toHaveBeenCalled();
    expect(resetter.verify).not.toHaveBeenCalled();
  });

  it('does not reset a slot whose lease is no longer eligible', async () => {
    const repository: DemoSandboxSlotRepositoryPort = {
      registerConfiguredSlots: jest.fn(),
      recordLeaseActivity: jest.fn(),
      claimAvailableSlot: jest.fn(),
      expireDueLeases: jest.fn(),
      beginReset: jest.fn().mockResolvedValue(null),
      beginResetRecovery: jest.fn(),
      completeReset: jest.fn(),
      quarantine: jest.fn(),
    };
    const resetter: DemoSandboxResetPort = {
      reset: jest.fn(),
      verify: jest.fn(),
    };
    const resetAttemptIds = { next: jest.fn(() => resetAttemptId) };
    const useCase = new ResetDemoSandboxSlotUseCase(
      repository,
      resetter,
      { now: () => now },
      resetAttemptIds,
    );

    await expect(useCase.execute('slot-a', 'stale-lease')).resolves.toBe('not_resettable');
    expect(resetter.reset).not.toHaveBeenCalled();
    expect(repository.completeReset).not.toHaveBeenCalled();
  });
});
