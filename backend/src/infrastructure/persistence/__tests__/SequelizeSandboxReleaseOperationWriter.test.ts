import { UniqueConstraintError, type ModelCtor, type Sequelize, type Transaction } from 'sequelize';
import type { DemoSandboxReleaseOperationRecord } from '../../../database/models/DemoSandboxReleaseOperation';
import type { SandboxReleaseIdentity } from '../../../domain/ports/AuthoritativeReleaseStateReaderPort';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { ReleaseOperationAlreadyCommittedException } from '../../../domain/exceptions/ReleaseOperationAlreadyCommittedException';
import { withScopedTransaction } from '../scopedTransactionContext';
import { SequelizeSandboxReleaseOperationWriter } from '../SequelizeSandboxReleaseOperationWriter';

const connection = {} as Sequelize;
const tx = { sequelize: connection } as unknown as Transaction;
const identity: SandboxReleaseIdentity = {
  releaseId: 'release-a',
  slotId: 'slot-a',
  leaseId: 'lease-a',
  generation: 2,
  attemptId: 'attempt-a',
  seedVersion: 'v1',
};

function writerFor(model: Record<string, unknown>) {
  return new SequelizeSandboxReleaseOperationWriter(
    connection,
    'slot-a',
    model as unknown as ModelCtor<DemoSandboxReleaseOperationRecord>,
  );
}

describe('SequelizeSandboxReleaseOperationWriter', () => {
  it('records the whole identity on the supplied transaction', async () => {
    const model = { create: jest.fn().mockResolvedValue({}), findOne: jest.fn() };
    await withScopedTransaction(connection, tx, async (context) => {
      await writerFor(model).record(identity, context);
    });

    expect(model.create).toHaveBeenCalledWith(
      {
        releaseId: 'release-a',
        slotId: 'slot-a',
        generation: 2,
        attemptId: 'attempt-a',
        seedVersion: 'v1',
        leaseId: 'lease-a',
      },
      { transaction: tx },
    );
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('reports whether this release identity is already recorded', async () => {
    const model = {
      create: jest.fn(),
      findOne: jest.fn().mockResolvedValue({ releaseId: 'release-a' }),
    };
    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).exists(identity, context)).resolves.toBe(true);
    });
    expect(model.findOne).toHaveBeenCalledWith({
      where: { releaseId: 'release-a' },
      transaction: tx,
    });

    const missing = { create: jest.fn(), findOne: jest.fn().mockResolvedValue(null) };
    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(missing).exists(identity, context)).resolves.toBe(false);
    });
  });

  it('maps the storage uniqueness rejection to a domain error', async () => {
    const duplicate = new UniqueConstraintError({ message: 'uq_release_attempt', errors: [] });
    const model = { create: jest.fn().mockRejectedValue(duplicate), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).record(identity, context)).rejects.toBeInstanceOf(
        ReleaseOperationAlreadyCommittedException,
      );
    });
  });

  it('propagates other storage failures unchanged', async () => {
    const failure = new Error('connection lost');
    const model = { create: jest.fn().mockRejectedValue(failure), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).record(identity, context)).rejects.toBe(failure);
    });
  });

  it('rejects missing, foreign and expired contexts before any query', async () => {
    const model = { create: jest.fn(), findOne: jest.fn() };
    const writer = writerFor(model);

    await expect(writer.record(identity, {} as TransactionContext)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    const foreign = {} as Sequelize;
    const foreignTx = { sequelize: foreign } as unknown as Transaction;
    await withScopedTransaction(foreign, foreignTx, async (context) => {
      await expect(writer.record(identity, context)).rejects.toThrow(
        'Transaction context is not active for this connection',
      );
    });

    let expired = {} as TransactionContext;
    await withScopedTransaction(connection, tx, async (context) => {
      expired = context;
    });
    await expect(writer.record(identity, expired)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    expect(model.create).not.toHaveBeenCalled();
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('rejects a release for another slot before writing', async () => {
    const model = { create: jest.fn(), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(
        writerFor(model).record({ ...identity, slotId: 'slot-b' }, context),
      ).rejects.toThrow('Sandbox release slot mismatch');
    });
    expect(model.create).not.toHaveBeenCalled();
  });
});
