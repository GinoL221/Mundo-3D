import type { ModelStatic, Sequelize, Transaction } from 'sequelize';
import type { DemoSandboxResetReceiptRecord } from '../../../database/models/DemoSandboxResetReceipt';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from '../scopedTransactionContext';
import { SequelizeSandboxReceiptWriter } from '../SequelizeSandboxReceiptWriter';

const connection = {} as Sequelize;
const tx = { sequelize: connection } as unknown as Transaction;
const identity = { slotId: 'slot-a', generation: 2, attemptId: 'attempt-a', seedVersion: 'v1' };

describe('SequelizeSandboxReceiptWriter', () => {
  it('checks attempt history without filtering by seed version or consumption', async () => {
    const model = {
      findOne: jest.fn().mockResolvedValue({ attemptId: 'attempt-a' }),
      create: jest.fn(),
    };
    const writer = new SequelizeSandboxReceiptWriter(
      connection,
      'slot-a',
      model as unknown as ModelStatic<DemoSandboxResetReceiptRecord>,
    );
    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writer.exists(identity, context)).resolves.toBe(true);
    });
    expect(model.findOne).toHaveBeenCalledWith({
      where: { attemptId: 'attempt-a' },
      transaction: tx,
    });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('inserts the full receipt on the same scoped transaction', async () => {
    const model = { findOne: jest.fn(), create: jest.fn().mockResolvedValue({}) };
    const writer = new SequelizeSandboxReceiptWriter(
      connection,
      'slot-a',
      model as unknown as ModelStatic<DemoSandboxResetReceiptRecord>,
    );
    await withScopedTransaction(connection, tx, async (context) =>
      writer.insert(identity, context),
    );
    expect(model.create).toHaveBeenCalledWith(
      { ...identity, consumed: false },
      { transaction: tx },
    );
  });

  it('rejects foreign or expired contexts and other slots before any query', async () => {
    const model = { findOne: jest.fn(), create: jest.fn() };
    const writer = new SequelizeSandboxReceiptWriter(
      connection,
      'slot-a',
      model as unknown as ModelStatic<DemoSandboxResetReceiptRecord>,
    );
    await expect(writer.exists(identity, {} as TransactionContext)).rejects.toThrow();
    const foreign = {} as Sequelize;
    const foreignTx = { sequelize: foreign } as unknown as Transaction;
    await withScopedTransaction(foreign, foreignTx, async (context) => {
      await expect(writer.exists(identity, context)).rejects.toThrow(
        'Transaction context is not active for this connection',
      );
    });
    let expired = {} as TransactionContext;
    await withScopedTransaction(connection, tx, async (context) => {
      expired = context;
      await expect(writer.insert({ ...identity, slotId: 'slot-b' }, context)).rejects.toThrow();
    });
    await expect(writer.insert(identity, expired)).rejects.toThrow();
    expect(model.findOne).not.toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('propagates storage insertion errors', async () => {
    const failure = new Error('duplicate attempt');
    const model = { findOne: jest.fn(), create: jest.fn().mockRejectedValue(failure) };
    const writer = new SequelizeSandboxReceiptWriter(
      connection,
      'slot-a',
      model as unknown as ModelStatic<DemoSandboxResetReceiptRecord>,
    );
    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writer.insert(identity, context)).rejects.toBe(failure);
    });
  });
});
