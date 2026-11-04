import type { ModelCtor, Sequelize } from 'sequelize';
import type { DemoSandboxResetReceiptRecord } from '../../database/models/DemoSandboxResetReceipt';
import type {
  SandboxResetIdentity,
  SandboxResetReceiptConsumerPort,
} from '../../domain/ports/SandboxResetReceiptConsumerPort';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { resolveScopedTransaction } from './scopedTransactionContext';

type ReceiptModel = ModelCtor<DemoSandboxResetReceiptRecord>;

/**
 * Isolated receipt consumption gate.
 * Atomically marks the exact matching unconsumed receipt as consumed within the active transaction.
 */
export class SequelizeSandboxReceiptConsumer implements SandboxResetReceiptConsumerPort {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly model: ReceiptModel,
  ) {}

  async consume(identity: SandboxResetIdentity, context: TransactionContext): Promise<boolean> {
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) throw new Error('Transaction context is required');
    if (identity.slotId !== this.slotId) throw new Error('Sandbox receipt slot mismatch');

    const [affectedRows] = await this.model.update(
      { consumed: true },
      {
        where: {
          attemptId: identity.attemptId,
          slotId: identity.slotId,
          generation: identity.generation,
          seedVersion: identity.seedVersion,
          consumed: false,
        },
        transaction,
      },
    );

    return affectedRows > 0;
  }
}
