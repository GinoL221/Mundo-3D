import type { ModelStatic, Sequelize } from 'sequelize';
import type {
  SandboxResetFence,
  SandboxResetIdentity,
} from '../../application/use-cases/RunFencedSandboxReset';
import type { DemoSandboxFenceRecord } from '../../database/models/DemoSandboxFence';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { resolveScopedTransaction } from './scopedTransactionContext';

/** Exclusive reset fence adapter backed by `DemoSandboxFence` on the slot connection. */
export class SequelizeSandboxResetFence implements SandboxResetFence {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly model: ModelStatic<DemoSandboxFenceRecord>,
  ) {}

  async fenceForReset(
    identity: Pick<SandboxResetIdentity, 'slotId' | 'generation' | 'attemptId'>,
  ): Promise<boolean> {
    if (
      identity.slotId !== this.slotId ||
      !identity.attemptId.trim() ||
      !Number.isSafeInteger(identity.generation) ||
      identity.generation < 0
    ) {
      return false;
    }
    return this.connection.transaction(async (transaction) => {
      const row = await this.model.findOne({
        where: { slotId: this.slotId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!row) {
        if (identity.generation !== 0) {
          return false;
        }
        await this.model.create(
          {
            slotId: this.slotId,
            leaseId: null,
            generation: 0,
            state: 'fenced',
            resetAttemptId: identity.attemptId,
          },
          { transaction },
        );
        return true;
      }
      if (row.generation !== identity.generation) {
        return false;
      }
      await row.update(
        { state: 'fenced', leaseId: null, resetAttemptId: identity.attemptId },
        { transaction },
      );
      return true;
    });
  }

  async lockAndCheck(identity: SandboxResetIdentity, context: TransactionContext): Promise<boolean> {
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) {
      throw new Error('Transaction context is required');
    }
    if (
      identity.slotId !== this.slotId ||
      !identity.attemptId.trim() ||
      !Number.isSafeInteger(identity.generation) ||
      identity.generation < 0
    ) {
      return false;
    }
    const row = await this.model.findOne({
      where: { slotId: this.slotId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    return (
      row !== null &&
      row.slotId === this.slotId &&
      row.state === 'fenced' &&
      row.leaseId === null &&
      row.generation === identity.generation &&
      row.resetAttemptId === identity.attemptId
    );
  }
}
