import { Op, Sequelize, type Transaction } from 'sequelize';
import type { SandboxResetIdentity } from '../../../domain/ports/SandboxResetReceiptConsumerPort';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from '../scopedTransactionContext';
import { SequelizeSandboxReceiptConsumer } from '../SequelizeSandboxReceiptConsumer';

const connection = {} as Sequelize;
const tx = { sequelize: connection } as unknown as Transaction;
const identity: SandboxResetIdentity = {
  slotId: 'slot-a',
  generation: 3,
  attemptId: 'attempt-xyz',
  seedVersion: 'seed-v1',
};

describe('SequelizeSandboxReceiptConsumer', () => {
  it('consumes an exact matching unconsumed receipt in the scoped transaction', async () => {
    const update = jest.fn().mockResolvedValue([1]);
    const model = { update } as never;
    const consumer = new SequelizeSandboxReceiptConsumer(connection, 'slot-a', model);

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(consumer.consume(identity, context)).resolves.toBe(true);
    });

    expect(update).toHaveBeenCalledWith(
      { consumed: true },
      {
        where: {
          attemptId: 'attempt-xyz',
          slotId: 'slot-a',
          generation: 3,
          seedVersion: 'seed-v1',
          consumed: false,
          [Op.and]: [Sequelize.where(
            Sequelize.cast(Sequelize.col('seed_version'), 'BINARY'),
            identity.seedVersion,
          )],
        },
        transaction: tx,
      },
    );
  });

  it('rejects consumption when the receipt is already consumed or does not match', async () => {
    const update = jest.fn().mockResolvedValue([0]);
    const model = { update } as never;
    const consumer = new SequelizeSandboxReceiptConsumer(connection, 'slot-a', model);

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(consumer.consume(identity, context)).resolves.toBe(false);
    });
  });

  it('rejects foreign slot mismatch or invalid transaction before querying', async () => {
    const update = jest.fn();
    const model = { update } as never;
    const consumer = new SequelizeSandboxReceiptConsumer(connection, 'slot-a', model);

    await expect(consumer.consume(identity, {} as TransactionContext)).rejects.toThrow(
      'Transaction context is not active for this connection',
    );

    await withScopedTransaction(connection, tx, async (context) => {
      await expect(consumer.consume({ ...identity, slotId: 'slot-b' }, context)).rejects.toThrow(
        'Sandbox receipt slot mismatch',
      );
    });

    expect(update).not.toHaveBeenCalled();
  });
});
