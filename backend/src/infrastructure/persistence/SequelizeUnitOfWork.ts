import { UnitOfWorkPort, TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import db from '../../database/models/db';

// Thin wrapper around Sequelize's managed transaction. The domain/application
// layers only ever see the opaque `TransactionContext`; only this adapter
// (and other infrastructure repositories) knows it is really a Sequelize
// `Transaction`. `db.sequelize.transaction(callback)` commits automatically
// when the callback resolves and rolls back automatically when it rejects —
// this class does not call `.commit()`/`.rollback()` itself.
export class SequelizeUnitOfWork implements UnitOfWorkPort {
  async runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return db.sequelize.transaction((transaction) => work(transaction as unknown as TransactionContext));
  }
}
