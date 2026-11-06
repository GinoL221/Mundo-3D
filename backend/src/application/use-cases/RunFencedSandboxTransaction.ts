import type { TransactionContext, UnitOfWorkPort } from '../../domain/ports/UnitOfWorkPort';

export interface SandboxFenceLease {
  readonly slotId: string;
  readonly leaseId: string;
  readonly generation: number;
}

export interface SandboxFenceCheck {
  check(lease: SandboxFenceLease, transaction: TransactionContext): Promise<boolean>;
}

/** Orchestration only: safety depends on a fresh UoW and a transaction-held storage fence. */
export class RunFencedSandboxTransaction {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly fence: SandboxFenceCheck,
  ) {}

  execute<T>(lease: SandboxFenceLease, work: (transaction: TransactionContext) => Promise<T>): Promise<T> {
    return this.uow.runInTransaction(async (transaction) => {
      if (!(await this.fence.check(lease, transaction))) throw new Error('Sandbox fence rejected');
      return work(transaction);
    });
  }
}
