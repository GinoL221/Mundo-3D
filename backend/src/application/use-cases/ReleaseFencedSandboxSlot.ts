import type { UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import type { DemoSandboxSlotRepositoryPort } from '../../domain/ports/DemoSandboxSlotRepositoryPort';
import type { DemoSandboxClockPort } from '../../domain/ports/DemoSandboxRuntimePorts';
import type {
  SandboxResetIdentity,
  SandboxResetReceiptConsumerPort,
} from '../../domain/ports/SandboxResetReceiptConsumerPort';

export type GuardedReleaseResult = 'available' | 'quarantined' | 'stale' | 'uncertain';

/**
 * Isolated release coordinator seam.
 * Releases slot in control plane only if an exact matching receipt is atomically consumed
 * in the slot database. Errors have uncertain outcomes and require reconciliation.
 * This two-transaction seam does not enforce cross-plane fencing and must not be wired to visitors.
 */
export class ReleaseFencedSandboxSlot {
  constructor(
    private readonly slotUow: UnitOfWorkPort,
    private readonly receiptConsumer: SandboxResetReceiptConsumerPort,
    private readonly slotRepository: DemoSandboxSlotRepositoryPort,
    private readonly clock: DemoSandboxClockPort,
  ) {}

  async execute(identity: SandboxResetIdentity, leaseId: string): Promise<GuardedReleaseResult> {
    let consumed: boolean;
    try {
      consumed = await this.slotUow.runInTransaction((tx) =>
        this.receiptConsumer.consume(identity, tx),
      );
    } catch {
      return 'uncertain';
    }

    if (!consumed) {
      try {
        const quarantined = await this.slotRepository.quarantine(
          identity.slotId,
          leaseId,
          identity.attemptId,
          'unverified_receipt',
        );
        return quarantined ? 'quarantined' : 'stale';
      } catch {
        return 'uncertain';
      }
    }

    try {
      return await this.slotRepository.completeReset(
        identity.slotId,
        leaseId,
        identity.attemptId,
        this.clock.now(),
        true,
      );
    } catch {
      return 'uncertain';
    }
  }
}
