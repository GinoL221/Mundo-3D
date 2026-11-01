import type { Transaction } from 'sequelize';
import type { TransactionContext } from '../../domain/ports/UnitOfWorkPort';
import db from '../../database/models/db';
import { ScopedSequelizeEmailConfirmationTokenRepository } from './ScopedSequelizeEmailConfirmationTokenRepository';

export class SequelizeEmailConfirmationTokenRepository extends ScopedSequelizeEmailConfirmationTokenRepository {
  constructor() {
    super(db);
  }

  protected transactionFor(context: TransactionContext): Transaction {
    // Legacy callers supply Sequelize transactions directly.
    return context as unknown as Transaction;
  }
}
