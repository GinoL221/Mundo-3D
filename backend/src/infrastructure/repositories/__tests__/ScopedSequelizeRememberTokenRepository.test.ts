import { Op, literal } from 'sequelize';
import type { Sequelize, Transaction } from 'sequelize';
import { RememberToken } from '../../../domain/entities/RememberToken';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from '../../persistence/scopedTransactionContext';
import { ScopedSequelizeRememberTokenRepository } from '../ScopedSequelizeRememberTokenRepository';

jest.mock('dotenv', () => {
  throw new Error('dotenv forbidden');
});
jest.mock('../../../database/models/db', () => {
  throw new Error('default database forbidden');
});

test('requires a live same-connection transaction before rotation persistence', async () => {
  const sequelize = { query: jest.fn().mockResolvedValue([null, 1]) } as unknown as Sequelize;
  const model = { create: jest.fn(), destroy: jest.fn() };
  const repo = new ScopedSequelizeRememberTokenRepository({
    sequelize,
    RememberToken: model,
  } as unknown as ConstructorParameters<typeof ScopedSequelizeRememberTokenRepository>[0]);
  const input = {
    presentedHash: 'old',
    successorHash: 'new',
    tx: undefined as unknown as TransactionContext,
  };
  await expect(repo.claimRotation(input)).rejects.toThrow(
    'Transaction context is not active for this connection',
  );
  await expect(repo.reapFamily('family', 10, input.tx)).rejects.toThrow(
    'Transaction context is not active for this connection',
  );
  expect(sequelize.query).not.toHaveBeenCalled();
  expect(model.destroy).not.toHaveBeenCalled();
  await expect(repo.insertSuccessor({} as never, input.tx)).rejects.toThrow(
    'Transaction context is not active for this connection',
  );
  expect(model.create).not.toHaveBeenCalled();
  await withScopedTransaction({} as Sequelize, {} as Transaction, async (tx) => {
    await expect(repo.claimRotation({ ...input, tx })).rejects.toThrow(
      'Transaction context is not active for this connection',
    );
  });
  expect(sequelize.query).not.toHaveBeenCalled();
  const transaction = {} as Transaction;
  await withScopedTransaction(sequelize, transaction, async (tx) => {
    await expect(repo.claimRotation({ ...input, tx })).resolves.toBe(true);
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ transaction }),
    );
  });
  const expired = await withScopedTransaction(sequelize, transaction, async (tx) => tx);
  await expect(repo.claimRotation({ ...input, tx: expired })).rejects.toThrow(
    'Transaction context is not active for this connection',
  );
});

test('inserts and reaps only with an active transaction on the injected connection', async () => {
  const sequelize = {} as Sequelize;
  const transaction = {} as Transaction;
  const expiry = new Date('2030-01-01T00:00:00Z');
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const row = new RememberToken(0, 'successor', 7, expiry, createdAt, 'family');
  const model = {
    create: jest.fn().mockResolvedValue({ ...row, idRememberToken: 42, createdAt }),
    destroy: jest.fn().mockResolvedValue(2),
  };
  const repo = new ScopedSequelizeRememberTokenRepository({
    sequelize,
    RememberToken: model,
  } as unknown as ConstructorParameters<typeof ScopedSequelizeRememberTokenRepository>[0]);
  const rejectContext = async (tx: TransactionContext) => {
    await expect(repo.insertSuccessor(row, tx)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );
    await expect(repo.reapFamily('family', 60, tx)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );
    expect(model.create).not.toHaveBeenCalled();
    expect(model.destroy).not.toHaveBeenCalled();
  };
  await rejectContext(undefined as unknown as TransactionContext);
  await withScopedTransaction({} as Sequelize, {} as Transaction, rejectContext);
  const expired = await withScopedTransaction(sequelize, transaction, async (tx) => tx);
  await rejectContext(expired);
  await withScopedTransaction(sequelize, transaction, async (tx) => {
    const inserted = await repo.insertSuccessor(row, tx);
    expect(inserted).toEqual(
      new RememberToken(42, 'successor', 7, expiry, createdAt, 'family', null, null, null),
    );
    expect(model.create).toHaveBeenCalledWith(
      {
        idUser: 7,
        tokenHash: 'successor',
        expiryDate: expiry,
        familyId: 'family',
        createdAt: expect.any(Date),
      },
      { transaction },
    );
    await expect(repo.reapFamily('family', 60.9, tx)).resolves.toBe(2);
    expect(model.destroy).toHaveBeenCalledWith({
      where: {
        familyId: 'family',
        supersededAt: { [Op.lte]: literal('NOW() - INTERVAL 60 SECOND') },
      },
      transaction,
    });
  });
});
