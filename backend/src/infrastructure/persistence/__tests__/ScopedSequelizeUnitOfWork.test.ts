import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { ScopedSequelizeUnitOfWork } from '../ScopedSequelizeUnitOfWork';
import { resolveScopedTransaction } from '../scopedTransactionContext';

jest.mock('../../../database/models/db', () => {
  throw new Error('Explicit UoW must not import the default database');
});

function connection() {
  const transaction = { commit: jest.fn(), rollback: jest.fn() } as unknown as Transaction;
  const database = {
    transaction: jest.fn(async (work: (tx: Transaction) => Promise<unknown>) => work(transaction)),
  };
  return { transaction, database, sequelize: database as unknown as Sequelize };
}

test('delegates managed work to the injected connection and revokes the context after success', async () => {
  const a = connection();
  const b = connection();
  const uow = new ScopedSequelizeUnitOfWork(a.sequelize);
  let saved: TransactionContext | undefined;
  expect(
    await uow.runInTransaction(async (tx) => {
      saved = tx;
      expect(tx).toBe(a.transaction);
      expect(resolveScopedTransaction(tx, a.sequelize)).toBe(a.transaction);
      expect(() => resolveScopedTransaction(tx, b.sequelize)).toThrow(
        'Transaction context is not active for this connection',
      );
      return 'done';
    }),
  ).toBe('done');
  expect(a.database.transaction).toHaveBeenCalledTimes(1);
  expect(b.database.transaction).not.toHaveBeenCalled();
  expect(() => resolveScopedTransaction(saved!, a.sequelize)).toThrow(
    'Transaction context is not active for this connection',
  );
  expect(a.transaction.commit).not.toHaveBeenCalled();
  expect(a.transaction.rollback).not.toHaveBeenCalled();
});

test('propagates callback failure unchanged for managed rollback and revokes its context', async () => {
  const a = connection();
  let saved: TransactionContext | undefined;
  const failure = new Error('work failed');
  await expect(
    new ScopedSequelizeUnitOfWork(a.sequelize).runInTransaction(async (tx) => {
      saved = tx;
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(() => resolveScopedTransaction(saved!, a.sequelize)).toThrow(
    'Transaction context is not active for this connection',
  );
  expect(a.transaction.commit).not.toHaveBeenCalled();
  expect(a.transaction.rollback).not.toHaveBeenCalled();
});
