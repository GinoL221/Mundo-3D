import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from '../../persistence/scopedTransactionContext';
import { ScopedSequelizeEmailConfirmationTokenRepository } from '../ScopedSequelizeEmailConfirmationTokenRepository';

jest.mock('dotenv', () => {
  throw new Error('dotenv forbidden');
});
jest.mock('../../../database/models/db', () => {
  throw new Error('default database forbidden');
});

test('validates required transaction ownership before reading or writing and locks user first', async () => {
  const sequelize = {} as Sequelize;
  const user = { findByPk: jest.fn().mockResolvedValue(null) };
  const token = { findOne: jest.fn(), update: jest.fn(), create: jest.fn() };
  const repository = new ScopedSequelizeEmailConfirmationTokenRepository({
    sequelize,
    User: user,
    EmailConfirmationToken: token,
  } as unknown as ConstructorParameters<typeof ScopedSequelizeEmailConfirmationTokenRepository>[0]);
  const input = {
    userId: 1,
    tokenHash: 'hash',
    now: new Date(),
    tx: undefined as unknown as TransactionContext,
  };
  await expect(repository.verifyAndConsume(input)).rejects.toThrow(
    'Transaction context is not active for this connection',
  );
  await expect(repository.replaceForUnverifiedUser(input)).rejects.toThrow(
    'Transaction context is not active for this connection',
  );
  expect(user.findByPk).not.toHaveBeenCalled();
  expect(token.findOne).not.toHaveBeenCalled();
  expect(token.update).not.toHaveBeenCalled();
  expect(token.create).not.toHaveBeenCalled();
  const transaction = { sequelize } as unknown as Transaction;
  await withScopedTransaction(sequelize, transaction, async (tx) => {
    await expect(repository.verifyAndConsume({ ...input, tx })).resolves.toEqual({
      outcome: 'invalid',
    });
    await expect(repository.replaceForUnverifiedUser({ ...input, tx })).resolves.toBeNull();
  });
  expect(user.findByPk).toHaveBeenCalledTimes(2);
  expect(user.findByPk).toHaveBeenCalledWith(1, expect.objectContaining({ transaction }));
});

test('confirms and replaces tokens on the same connection and rejects foreign or expired contexts', async () => {
  const sequelize = {} as Sequelize;
  const transaction = { sequelize } as unknown as Transaction;
  const now = new Date('2026-10-01T00:00:00Z');
  const tokenUpdate = jest.fn();
  const userUpdate = jest.fn();
  const user = {
    findByPk: jest
      .fn()
      .mockResolvedValue({ email: 'a@example.com', emailVerifiedAt: null, update: userUpdate }),
  };
  const row = {
    idEmailConfirmationToken: 3,
    idUser: 1,
    tokenHash: 'hash',
    expiresAt: new Date(now.getTime() + 86400000),
    consumedAt: null,
    invalidatedAt: null,
    activeSlot: 1,
    createdAt: now,
    update: tokenUpdate,
  };
  const token = {
    findOne: jest.fn().mockResolvedValue(row),
    update: jest.fn(),
    create: jest.fn().mockResolvedValue(row),
  };
  const repository = new ScopedSequelizeEmailConfirmationTokenRepository({
    sequelize,
    User: user,
    EmailConfirmationToken: token,
  } as unknown as ConstructorParameters<typeof ScopedSequelizeEmailConfirmationTokenRepository>[0]);
  await withScopedTransaction(sequelize, transaction, async (tx) => {
    await expect(
      repository.verifyAndConsume({ userId: 1, tokenHash: 'hash', now, tx }),
    ).resolves.toEqual({ outcome: 'confirmed' });
    expect(user.findByPk.mock.invocationCallOrder[0]).toBeLessThan(
      token.findOne.mock.invocationCallOrder[0],
    );
    expect(userUpdate).toHaveBeenCalledWith({ emailVerifiedAt: now }, { transaction });
    expect(tokenUpdate).toHaveBeenCalledWith(
      { consumedAt: now, activeSlot: null },
      { transaction },
    );
    const result = await repository.replaceForUnverifiedUser({
      userId: 1,
      tokenHash: 'hash',
      now,
      tx,
    });
    expect(result?.recipient).toBe('a@example.com');
    expect(result?.token.idUser).toBe(1);
    expect(token.update).toHaveBeenCalledWith(
      { invalidatedAt: now, activeSlot: null },
      { where: { idUser: 1, activeSlot: 1 }, transaction },
    );
    expect(token.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idUser: 1,
        tokenHash: 'hash',
        expiresAt: row.expiresAt,
        createdAt: now,
      }),
      { transaction },
    );
  });
  const expired = await withScopedTransaction(sequelize, transaction, async (tx) => tx);
  user.findByPk.mockClear();
  await expect(
    repository.verifyAndConsume({ userId: 1, tokenHash: 'hash', now, tx: expired }),
  ).rejects.toThrow('Transaction context is not active for this connection');
  const foreign = {} as Sequelize;
  await withScopedTransaction(
    foreign,
    { sequelize: foreign } as unknown as Transaction,
    async (tx) => {
      await expect(
        repository.replaceForUnverifiedUser({ userId: 1, tokenHash: 'hash', now, tx }),
      ).rejects.toThrow('Transaction context is not active for this connection');
    },
  );
  expect(user.findByPk).not.toHaveBeenCalled();
});
