import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import type { SandboxFenceCheck, SandboxFenceLease } from '../../application/use-cases/RunFencedSandboxTransaction';
import { resolveScopedTransaction } from './scopedTransactionContext';

interface FenceRow {
  readonly slotId: string;
  readonly leaseId: string | null;
  readonly generation: number;
  readonly state: string;
}

interface FenceModel {
  findOne(options: { where: { slotId: string }; transaction: Transaction; lock: Transaction['LOCK']['SHARE'] }): Promise<FenceRow | null>;
}

/** Isolated adapter; its model and storage schema are not yet wired or verified. */
export class SequelizeSandboxFence implements SandboxFenceCheck {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly model: FenceModel,
  ) {}

  async check(lease: SandboxFenceLease, context: TransactionContext): Promise<boolean> {
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) throw new Error('Transaction context is required');
    if (lease.slotId !== this.slotId) return false;
    const row = await this.model.findOne({
      where: { slotId: this.slotId },
      transaction,
      lock: transaction.LOCK.SHARE,
    });
    return row !== null && row.slotId === this.slotId && row.leaseId === lease.leaseId && row.generation === lease.generation && row.state === 'open';
  }
}
