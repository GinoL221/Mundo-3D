import type { Sequelize, Transaction } from 'sequelize';
import type { TransactionContext } from '../../../domain/ports/UnitOfWorkPort';
import { withScopedTransaction } from '../scopedTransactionContext';
import { SequelizeSandboxFence } from '../SequelizeSandboxFence';

describe('SequelizeSandboxFence', () => {
  const connection = {} as Sequelize;
  const transaction = { sequelize: connection, LOCK: { SHARE: 'SHARE' } } as unknown as Transaction;
  const lease = { slotId: 'slot-1', leaseId: 'lease-1', generation: 4 };

  it('uses the active same-connection transaction and shared lock before accepting', async () => {
    const findOne = jest.fn().mockResolvedValue({ slotId: 'slot-1', leaseId: 'lease-1', generation: 4, state: 'open' });
    const fence = new SequelizeSandboxFence(connection, 'slot-1', { findOne });
    await withScopedTransaction(connection, transaction, async (context) => {
      await expect(fence.check(lease, context)).resolves.toBe(true);
    });
    expect(findOne).toHaveBeenCalledWith({ where: { slotId: 'slot-1' }, transaction, lock: 'SHARE' });
  });

  it.each([
    null,
    { slotId: 'slot-2', leaseId: 'lease-1', generation: 4, state: 'open' },
    { slotId: 'slot-1', leaseId: 'lease-2', generation: 4, state: 'open' },
    { slotId: 'slot-1', leaseId: 'lease-1', generation: 5, state: 'open' },
    { slotId: 'slot-1', leaseId: 'lease-1', generation: 4, state: 'fenced' },
  ])('rejects a missing or mismatched row', async (row) => {
    const fence = new SequelizeSandboxFence(connection, 'slot-1', { findOne: jest.fn().mockResolvedValue(row) });
    await withScopedTransaction(connection, transaction, async (context) => {
      await expect(fence.check(lease, context)).resolves.toBe(false);
    });
  });

  it('rejects foreign slot and invalid transaction before any read', async () => {
    const findOne = jest.fn();
    const fence = new SequelizeSandboxFence(connection, 'slot-1', { findOne });
    await expect(fence.check(lease, {} as TransactionContext)).rejects.toThrow('Transaction context is not active for this connection');
    await withScopedTransaction(connection, transaction, async (context) => {
      await expect(fence.check({ ...lease, slotId: 'slot-2' }, context)).resolves.toBe(false);
    });
    expect(findOne).not.toHaveBeenCalled();
  });
});
