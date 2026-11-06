import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';

export interface SandboxResetIdentity {
  readonly slotId: string;
  readonly generation: number;
  readonly attemptId: string;
  readonly seedVersion: string;
}

export interface SandboxResetFence {
  /** Acquire and retain an exclusive lock, validating the current reset identity. */
  lockAndCheck(identity: SandboxResetIdentity, transaction: TransactionContext): Promise<boolean>;
}

export interface SandboxResetReceiptWriter {
  /** Match slot, generation and attempt regardless of seed version or consumption. */
  exists(identity: SandboxResetIdentity, transaction: TransactionContext): Promise<boolean>;
  insert(identity: SandboxResetIdentity, transaction: TransactionContext): Promise<void>;
}

export interface SandboxTransactionalReset {
  run(identity: SandboxResetIdentity, transaction: TransactionContext): Promise<void>;
  verify(identity: SandboxResetIdentity, transaction: TransactionContext): Promise<boolean>;
}

/** Isolated orchestration only. All effects and locks must belong to the supplied transaction. */
export class RunFencedSandboxReset {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly fence: SandboxResetFence,
    private readonly receipts: SandboxResetReceiptWriter,
    private readonly reset: SandboxTransactionalReset,
  ) {}

  execute(identity: SandboxResetIdentity): Promise<void> {
    const current = { ...identity };
    return this.uow.runInTransaction(async (transaction) => {
      if (!(await this.fence.lockAndCheck(current, transaction))) {
        throw new Error('Sandbox reset fence rejected');
      }
      if (await this.receipts.exists(current, transaction)) {
        throw new Error('Sandbox reset receipt already exists');
      }
      await this.reset.run(current, transaction);
      if (!(await this.reset.verify(current, transaction))) {
        throw new Error('Sandbox reset verification failed');
      }
      await this.receipts.insert(current, transaction);
    });
  }
}
