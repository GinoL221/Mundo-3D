import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';

// Infrastructure-owned identity, not an inspectable field on the opaque context.
// Contexts retain raw Sequelize identity for existing repository adapters.
const activeTransactions = new WeakMap<
  object,
  { connection: Sequelize; transaction: Transaction }
>();

export async function withScopedTransaction<T>(
  connection: Sequelize,
  transaction: Transaction,
  work: (tx: TransactionContext) => Promise<T>,
): Promise<T> {
  activeTransactions.set(transaction, { connection, transaction });
  try {
    // SAFETY: The infrastructure-issued raw handle is registered by identity above;
    // domain/application code only passes it through. The brand has no runtime data.
    return await work(transaction as unknown as TransactionContext);
  } finally {
    activeTransactions.delete(transaction);
  }
}

export function resolveScopedTransaction(
  context: TransactionContext | undefined,
  connection: Sequelize,
): Transaction | undefined {
  if (context === undefined) return undefined;
  const active = activeTransactions.get(context);
  if (!active || active.connection !== connection) {
    throw new Error('Transaction context is not active for this connection');
  }
  return active.transaction;
}
