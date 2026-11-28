import type { ModelStatic, Sequelize } from 'sequelize';
import type {
  SandboxResetFence,
  SandboxResetIdentity,
} from '../../application/use-cases/RunFencedSandboxReset';
import type { DemoSandboxFenceRecord } from '../../database/models/DemoSandboxFence';
import type { DemoSandboxResetReceiptRecord } from '../../database/models/DemoSandboxResetReceipt';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { resolveScopedTransaction } from './scopedTransactionContext';

/** Exclusive reset fence adapter backed by `DemoSandboxFence` on the slot connection. */
export class SequelizeSandboxResetFence implements SandboxResetFence {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly model: ModelStatic<DemoSandboxFenceRecord>,
    private readonly receiptModel?: ModelStatic<DemoSandboxResetReceiptRecord>,
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
      if (row.generation === identity.generation) {
        await row.update(
          { state: 'fenced', leaseId: null, resetAttemptId: identity.attemptId },
          { transaction },
        );
        return true;
      }
      // Heal an exact 1-generation lag only when a committed reset receipt proves the
      // prior generation completed cleanly (e.g., crash between control-plane
      // completeReset and slot-side releaseFence). Never accept stale or unverified jumps.
      if (row.generation === identity.generation - 1 && this.receiptModel) {
        const priorReceipt = await this.receiptModel.findOne({
          where: { slotId: this.slotId, generation: row.generation },
          transaction,
        });
        if (priorReceipt) {
          await row.update(
            {
              generation: identity.generation,
              state: 'fenced',
              leaseId: null,
              resetAttemptId: identity.attemptId,
            },
            { transaction },
          );
          return true;
        }
      }
      return false;
    });
  }

  async releaseFence(
    identity: Pick<SandboxResetIdentity, 'slotId' | 'generation' | 'attemptId'>,
  ): Promise<boolean> {
    if (
      identity.slotId !== this.slotId ||
      !identity.attemptId.trim() ||
      !Number.isSafeInteger(identity.generation) ||
      identity.generation < 0 ||
      identity.generation >= 0xffff_ffff
    ) {
      return false;
    }
    return this.connection.transaction(async (transaction) => {
      const row = await this.model.findOne({
        where: { slotId: this.slotId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        !row ||
        row.state !== 'fenced' ||
        row.leaseId !== null ||
        row.generation !== identity.generation ||
        row.resetAttemptId !== identity.attemptId
      ) {
        return false;
      }
      await row.update(
        {
          state: 'open',
          leaseId: null,
          generation: identity.generation + 1,
          resetAttemptId: null,
        },
        { transaction },
      );
      return true;
    });
  }

  async lockAndCheck(
    identity: SandboxResetIdentity,
    context: TransactionContext,
  ): Promise<boolean> {
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
