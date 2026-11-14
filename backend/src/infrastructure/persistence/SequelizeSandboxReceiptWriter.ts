import type { ModelStatic, Sequelize, Transaction } from 'sequelize';
import type { DemoSandboxResetReceiptRecord } from '../../database/models/DemoSandboxResetReceipt';
import type {
  SandboxResetIdentity,
  SandboxResetReceiptWriter,
} from '../../application/use-cases/RunFencedSandboxReset';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { resolveScopedTransaction } from './scopedTransactionContext';

type ReceiptModel = ModelStatic<DemoSandboxResetReceiptRecord>;

/** Requires a transaction-held reset fence and a real uniqueness constraint; neither is established here. */
export class SequelizeSandboxReceiptWriter implements SandboxResetReceiptWriter {
  constructor(
    private readonly connection: Sequelize,
    private readonly slotId: string,
    private readonly model: ReceiptModel,
  ) {}

  private transaction(identity: SandboxResetIdentity, context: TransactionContext): Transaction {
    const transaction = resolveScopedTransaction(context, this.connection);
    if (!transaction) throw new Error('Transaction context is required');
    if (identity.slotId !== this.slotId) throw new Error('Sandbox receipt slot mismatch');
    return transaction;
  }

  async exists(identity: SandboxResetIdentity, context: TransactionContext): Promise<boolean> {
    const transaction = this.transaction(identity, context);
    const receipt = await this.model.findOne({
      where: { attemptId: identity.attemptId },
      transaction,
    });
    return receipt !== null;
  }

  async insert(identity: SandboxResetIdentity, context: TransactionContext): Promise<void> {
    const transaction = this.transaction(identity, context);
    await this.model.create({ ...identity, consumed: false }, { transaction });
  }
}
