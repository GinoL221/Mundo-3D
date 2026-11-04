import { UniqueConstraintError, type ModelCtor, type Sequelize, type Transaction } from 'sequelize';
import type { DemoSandboxReleaseOperationRecord } from '../../database/models/DemoSandboxReleaseOperation';
import type { SandboxReleaseIdentity } from '../../domain/ports/AuthoritativeReleaseStateReaderPort';
import type { SandboxReleaseOperationRecorderPort } from '../../domain/ports/SandboxReleaseOperationRecorderPort';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { ReleaseOperationAlreadyCommittedException } from '../../domain/exceptions/ReleaseOperationAlreadyCommittedException';
import { resolveScopedTransaction } from './scopedTransactionContext';

type ReleaseOperationModel = ModelCtor<DemoSandboxReleaseOperationRecord>;

/**
 * Unwired adapter for the durable release record. It requires an active
 * same-connection transaction and relies on `uq_release_attempt` existing in
 * the real table; neither is established here.
 */
export class SequelizeSandboxReleaseOperationWriter implements SandboxReleaseOperationRecorderPort {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly model: ReleaseOperationModel,
  ) {}

  private transaction(identity: SandboxReleaseIdentity, context: TransactionContext): Transaction {
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) throw new Error('Transaction context is required');
    if (identity.slotId !== this.slotId) throw new Error('Sandbox release slot mismatch');
    return transaction;
  }

  async record(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<void> {
    const transaction = this.transaction(identity, context);
    try {
      await this.model.create(
        {
          releaseId: identity.releaseId,
          slotId: identity.slotId,
          generation: identity.generation,
          attemptId: identity.attemptId,
          seedVersion: identity.seedVersion,
          leaseId: identity.leaseId,
        },
        { transaction },
      );
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ReleaseOperationAlreadyCommittedException(identity.slotId, identity.attemptId);
      }
      throw error;
    }
  }

  async exists(identity: SandboxReleaseIdentity, context: TransactionContext): Promise<boolean> {
    const transaction = this.transaction(identity, context);
    const recorded = await this.model.findOne({
      where: { releaseId: identity.releaseId },
      transaction,
    });
    return recorded !== null;
  }
}
