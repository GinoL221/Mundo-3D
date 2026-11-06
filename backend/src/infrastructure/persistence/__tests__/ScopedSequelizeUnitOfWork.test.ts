import { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { ScopedSequelizeUnitOfWork } from '../ScopedSequelizeUnitOfWork';
import { resolveScopedTransaction, withScopedTransaction } from '../scopedTransactionContext';

jest.mock('../../../database/models/db', () => {
  throw new Error('Explicit UoW must not import the default database');
});

function connection() {
  const database = {
    transaction: jest.fn(async (work: (tx: Transaction) => Promise<unknown>) => work(transaction)),
  };
  const transaction = {
    sequelize: database,
    commit: jest.fn(),
    rollback: jest.fn(),
  } as unknown as Transaction;
  return { transaction, database, sequelize: database as unknown as Sequelize };
}

test('rejects registration of a transaction belonging to another Sequelize instance', async () => {
  const owner = new Sequelize('sandbox_a', 'dummy', 'dummy', { dialect: 'mysql', logging: false });
  const foreign = new Sequelize('sandbox_b', 'dummy', 'dummy', {
    dialect: 'mysql',
    logging: false,
  });
  const transaction = new Transaction(foreign, {});
  const work = jest.fn();
  const ownerQuery = jest.spyOn(owner, 'query');
  const foreignQuery = jest.spyOn(foreign, 'query');
  await expect(withScopedTransaction(owner, transaction, work)).rejects.toThrow(
    'Transaction belongs to a different Sequelize instance',
  );
  expect(work).not.toHaveBeenCalled();
  expect(ownerQuery).not.toHaveBeenCalled();
  expect(foreignQuery).not.toHaveBeenCalled();
});

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
