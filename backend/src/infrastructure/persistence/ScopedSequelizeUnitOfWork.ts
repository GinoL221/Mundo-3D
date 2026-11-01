import type { Sequelize } from 'sequelize';
import type { UnitOfWorkPort, TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from './scopedTransactionContext';

/** Managed commit/rollback belong to Sequelize; contexts live only during work. */
export class ScopedSequelizeUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly connection: Sequelize) {}

  async runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.connection.transaction((transaction) =>
      withScopedTransaction(this.connection, transaction, work),
    );
  }
}
