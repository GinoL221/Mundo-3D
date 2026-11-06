import { DemoSandboxResetPort } from '../../domain/ports/DemoSandboxResetPort';
import { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import {
  DemoSandboxClockPort,
  DemoSandboxResetAttemptIdGeneratorPort,
} from '../../domain/ports/DemoSandboxRuntimePorts';
import { DemoSandboxSlotSnapshot } from '../../domain/entities/DemoSandboxSlot';

export type DemoSandboxResetResult =
  | 'available'
  | 'quarantined'
  | 'not_resettable'
  | 'recovery_failed'
  | 'operator_confirmation_required';

export class ResetDemoSandboxSlotUseCase {
  constructor(
    private readonly repository: DemoSandboxSlotRepositoryPort,
    private readonly resetter: DemoSandboxResetPort,
    private readonly clock: DemoSandboxClockPort,
    private readonly resetAttemptIds: DemoSandboxResetAttemptIdGeneratorPort,
  ) {}

  async execute(slotId: string, leaseId: string): Promise<DemoSandboxResetResult> {
    const resetAttemptId = this.resetAttemptIds.next();
    const slot = await this.repository.beginReset(slotId, leaseId, resetAttemptId);
    if (!slot) {
      return 'not_resettable';
    }

    return this.resetAndVerify(slot, leaseId);
  }

  async recoverInterrupted(
    slotId: string,
    leaseId: string,
    expectedResetAttemptId: string,
    operatorConfirmedWorkerStopped: boolean,
  ): Promise<DemoSandboxResetResult> {
    if (operatorConfirmedWorkerStopped !== true) {
      return 'operator_confirmation_required';
    }

    const nextResetAttemptId = this.resetAttemptIds.next();
    const slot = await this.repository.beginResetRecovery(
      slotId,
      leaseId,
      expectedResetAttemptId,
      nextResetAttemptId,
    );
    if (!slot) {
      return 'not_resettable';
    }

    return this.resetAndVerify(slot, leaseId);
  }

  private async resetAndVerify(
    slot: DemoSandboxSlotSnapshot,
    leaseId: string,
  ): Promise<DemoSandboxResetResult> {
    const resetAttemptId = slot.resetAttemptId;
    if (!resetAttemptId) {
      return 'recovery_failed';
    }

    try {
      await this.resetter.reset(slot.id, slot.generation, resetAttemptId);
      const verified = await this.resetter.verify(slot.id, slot.generation, resetAttemptId);
      const completion = await this.repository.completeReset(
        slot.id,
        leaseId,
        resetAttemptId,
        this.clock.now(),
        verified,
      );
      if (completion === 'available') {
        return 'available';
      }
      if (completion === 'quarantined') {
        return 'quarantined';
      }
      return 'not_resettable';
    } catch {
      const quarantined = await this.repository.quarantine(
        slot.id,
        leaseId,
        resetAttemptId,
        'reset_failed',
      );
      return quarantined ? 'quarantined' : 'recovery_failed';
    }
  }
}
