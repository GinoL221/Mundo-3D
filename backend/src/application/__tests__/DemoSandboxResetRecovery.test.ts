import { DemoSandboxSlot } from '../../domain/entities/DemoSandboxSlot';
import { DemoSandboxResetPort } from '../../domain/ports/DemoSandboxResetPort';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import { ResetDemoSandboxSlotUseCase } from '../use-cases/ResetDemoSandboxSlotUseCase';

const minute = 60_000;
const policy = { idleTimeoutMs: 20 * minute, maxLifetimeMs: 60 * minute };
const now = new Date('2026-10-26T12:00:00.000Z');

function resettingSlot(resetAttemptId: string) {
  const slot = DemoSandboxSlot.create('slot-a');
  slot.allocate('lease-a', now, policy);
  slot.expireIfDue(new Date(now.getTime() + 20 * minute));
  slot.beginReset(resetAttemptId);
  return slot.snapshot();
}

function makeRecoveryUseCase() {
  const repository: DemoSandboxSlotRepositoryPort = {
    registerConfiguredSlots: jest.fn(),
    recordLeaseActivity: jest.fn(),
    claimAvailableSlot: jest.fn(),
    expireDueLeases: jest.fn(),
    beginReset: jest.fn(),
    beginResetRecovery: jest.fn().mockResolvedValue(resettingSlot('attempt-new')),
    completeReset: jest.fn().mockResolvedValue('available'),
    quarantine: jest.fn(),
  };
  const resetter: DemoSandboxResetPort = {
    reset: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn().mockResolvedValue(true),
  };
  const resetAttemptIds = { next: jest.fn(() => 'attempt-new') };
  const useCase = new ResetDemoSandboxSlotUseCase(
    repository,
    resetter,
    { now: jest.fn(() => now) },
    resetAttemptIds,
  );
  return { useCase, repository, resetter, resetAttemptIds };
}

describe('operator-mediated recovery of interrupted demo sandbox resets', () => {
  it('requires confirmation that the previous worker stopped before claiming recovery', async () => {
    const { useCase, repository, resetter, resetAttemptIds } = makeRecoveryUseCase();

    await expect(
      useCase.recoverInterrupted('slot-a', 'lease-a', 'attempt-old', false),
    ).resolves.toBe('operator_confirmation_required');
    expect(repository.beginResetRecovery).not.toHaveBeenCalled();
    expect(resetAttemptIds.next).not.toHaveBeenCalled();
    expect(resetter.reset).not.toHaveBeenCalled();
    expect(resetter.verify).not.toHaveBeenCalled();
  });

  it('rotates the fencing token and releases only after the recovered reset verifies', async () => {
    const { useCase, repository, resetter } = makeRecoveryUseCase();

    await expect(
      useCase.recoverInterrupted('slot-a', 'lease-a', 'attempt-old', true),
    ).resolves.toBe('available');

    expect(repository.beginResetRecovery).toHaveBeenCalledWith(
      'slot-a',
      'lease-a',
      'attempt-old',
      'attempt-new',
    );
    expect(resetter.reset).toHaveBeenCalledWith('slot-a', 0, 'attempt-new');
    expect(resetter.verify).toHaveBeenCalledWith('slot-a', 0, 'attempt-new');
    expect(repository.completeReset).toHaveBeenCalledWith(
      'slot-a',
      'lease-a',
      'attempt-new',
      now,
      true,
    );
    expect(repository.quarantine).not.toHaveBeenCalled();
  });
});
