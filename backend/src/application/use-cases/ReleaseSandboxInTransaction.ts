import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';
import type { SandboxReleaseOperationRecorderPort } from '../../domain/ports/SandboxReleaseOperationRecorderPort';
import type { SandboxReleaseIdentity } from '../../domain/ports/AuthoritativeReleaseStateReaderPort';

export interface SandboxReleaseControl {
  /** Lock control first and check slot, resetting phase, generation, lease and attempt. */
  lockAndCheck(identity: SandboxReleaseIdentity, tx: TransactionContext): Promise<boolean>;
  /** Under both locks, update control and fence together using this transaction. */
  release(identity: SandboxReleaseIdentity, tx: TransactionContext): Promise<boolean>;
}

export interface SandboxReleaseFence {
  /** Lock fence after control, checking slot, fenced phase, generation and attempt. */
  lockAndCheck(identity: SandboxReleaseIdentity, tx: TransactionContext): Promise<boolean>;
}

export interface SandboxReleaseReceipt {
  /** Consume an exact successful unconsumed receipt in this transaction. */
  consume(identity: SandboxReleaseIdentity, tx: TransactionContext): Promise<boolean>;
}

/** Unwired orchestration only. Ports must use the same real transaction and retain their locks. */
export class ReleaseSandboxInTransaction {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly control: SandboxReleaseControl,
    private readonly fence: SandboxReleaseFence,
    private readonly receipts: SandboxReleaseReceipt,
    private readonly recorder: SandboxReleaseOperationRecorderPort,
  ) {}

  async execute(identity: SandboxReleaseIdentity): Promise<'released' | 'rejected' | 'uncertain'> {
    const current = Object.freeze({ ...identity });
    try {
      return await this.uow.runInTransaction(async (tx) => {
        if (!(await this.control.lockAndCheck(current, tx))) return 'rejected';
        if (!(await this.fence.lockAndCheck(current, tx))) return 'rejected';
        if (!(await this.receipts.consume(current, tx))) return 'rejected';
        if (!(await this.control.release(current, tx))) {
          throw new Error('Sandbox release transition rejected after receipt consumption');
        }
        await this.recorder.record(current, tx);
        return 'released';
      });
    } catch {
      return 'uncertain';
    }
  }
}
