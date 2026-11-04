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

  it('recognises the index-name payload the mysql dialect actually produces', async () => {
    const duplicate = new UniqueConstraintError({
      message: "Duplicate entry 'slot-a-2-attempt-a' for key 'uq_release_attempt'",
      fields: { uq_release_attempt: 'slot-a-2-attempt-a' },
      errors: [],
    });
    const model = { create: jest.fn().mockRejectedValue(duplicate), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).record(identity, context)).rejects.toBeInstanceOf(
        ReleaseOperationAlreadyCommittedException,
      );
    });
  });

  it('does not treat a primary-key payload as the attempt rule', async () => {
    const collision = new UniqueConstraintError({
      message: "Duplicate entry 'release-a' for key 'PRIMARY'",
      fields: { PRIMARY: 'release-a' },
      errors: [],
    });
    const model = { create: jest.fn().mockRejectedValue(collision), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).record(identity, context)).rejects.toBe(collision);
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

  it('does not report another constraint as an already committed release', async () => {
    const collision = new UniqueConstraintError({
      message: 'PRIMARY',
      fields: { release_id: 'release-a' },
      errors: [],
    });
    const model = { create: jest.fn().mockRejectedValue(collision), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).record(identity, context)).rejects.toBe(collision);
    });
  });

  it('does not guess when the failing constraint cannot be identified', async () => {
    const unidentifiable = new UniqueConstraintError({ message: 'duplicate', errors: [] });
    const model = { create: jest.fn().mockRejectedValue(unidentifiable), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writerFor(model).record(identity, context)).rejects.toBe(unidentifiable);
    });
  });

  it('names the slot and attempt when the release is already committed', async () => {
    const duplicate = new UniqueConstraintError({
      message: 'uq_release_attempt',
      fields: { slot_id: 'slot-a', generation: 2, attempt_id: 'attempt-a' },
      errors: [],
    });
    const model = { create: jest.fn().mockRejectedValue(duplicate), findOne: jest.fn() };

    await withScopedTransaction(connection, tx, async (context) => {
      const error = await writerFor(model)
        .record(identity, context)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ReleaseOperationAlreadyCommittedException);
      const committed = error as ReleaseOperationAlreadyCommittedException;
      expect(committed.slotId).toBe('slot-a');
      expect(committed.attemptId).toBe('attempt-a');
      expect(committed.message).toContain('slot-a');
      expect(committed.message).toContain('attempt-a');
    });
  });

  it('applies the transaction and slot guards to exists as well', async () => {
    const model = { create: jest.fn(), findOne: jest.fn() };
    const writer = writerFor(model);

    await expect(writer.exists(identity, {} as TransactionContext)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    const foreign = {} as Sequelize;
    const foreignTx = { sequelize: foreign } as unknown as Transaction;
    await withScopedTransaction(foreign, foreignTx, async (context) => {
      await expect(writer.exists(identity, context)).rejects.toThrow(
        'Transaction context is not active for this connection',
      );
    });

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(writer.exists({ ...identity, slotId: 'slot-b' }, context)).rejects.toThrow(
        'Sandbox release slot mismatch',
      );
    });

    expect(model.findOne).not.toHaveBeenCalled();
  });
});
