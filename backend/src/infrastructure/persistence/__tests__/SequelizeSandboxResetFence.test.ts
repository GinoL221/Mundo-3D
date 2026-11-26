import type { ModelStatic, Sequelize, Transaction } from 'sequelize';
import type { DemoSandboxFenceRecord } from '../../../database/models/DemoSandboxFence';
import type { DemoSandboxResetReceiptRecord } from '../../../database/models/DemoSandboxResetReceipt';
import { withScopedTransaction } from '../scopedTransactionContext';
import { SequelizeSandboxResetFence } from '../SequelizeSandboxResetFence';

function makeConnectionAndTx() {
  const tx = {
    LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' },
  } as unknown as Transaction;
  const connection = {
    transaction: jest.fn(async (callback: (t: Transaction) => Promise<unknown>) => callback(tx)),
  } as unknown as Sequelize;
  (tx as unknown as { sequelize: Sequelize }).sequelize = connection;
  return { connection, tx };
}

describe('SequelizeSandboxResetFence', () => {
  const identity = {
    slotId: 'slot-1',
    generation: 2,
    attemptId: '11111111-1111-4111-8111-111111111111',
    seedVersion: 'v1',
  };

  it('locks with FOR UPDATE and accepts only matching fenced row with null leaseId', async () => {
    const { connection, tx } = makeConnectionAndTx();
    const findOne = jest.fn().mockResolvedValue({
      slotId: 'slot-1',
      leaseId: null,
      generation: 2,
      state: 'fenced',
      resetAttemptId: identity.attemptId,
    });
    const model = { findOne } as unknown as ModelStatic<DemoSandboxFenceRecord>;
    const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model);

    const ok = await withScopedTransaction(connection, tx, (ctx) =>
      fence.lockAndCheck(identity, ctx),
    );

    expect(ok).toBe(true);
    expect(findOne).toHaveBeenCalledWith({
      where: { slotId: 'slot-1' },
      transaction: tx,
      lock: 'UPDATE',
    });
  });

  it('rejects open rows, leased rows, stale generations, mismatched attempts, or foreign slots', async () => {
    const { connection, tx } = makeConnectionAndTx();
    const cases = [
      null,
      { slotId: 'slot-1', leaseId: null, generation: 2, state: 'open', resetAttemptId: identity.attemptId },
      { slotId: 'slot-1', leaseId: 'lease-1', generation: 2, state: 'fenced', resetAttemptId: identity.attemptId },
      { slotId: 'slot-1', leaseId: null, generation: 1, state: 'fenced', resetAttemptId: identity.attemptId },
      { slotId: 'slot-1', leaseId: null, generation: 2, state: 'fenced', resetAttemptId: 'other-attempt' },
    ];
    for (const row of cases) {
      const model = { findOne: jest.fn().mockResolvedValue(row) } as unknown as ModelStatic<DemoSandboxFenceRecord>;
      const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model);
      const ok = await withScopedTransaction(connection, tx, (ctx) =>
        fence.lockAndCheck(identity, ctx),
      );
      expect(ok).toBe(false);
    }

    const model = { findOne: jest.fn() } as unknown as ModelStatic<DemoSandboxFenceRecord>;
    const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model);
    const wrongSlot = await withScopedTransaction(connection, tx, (ctx) =>
      fence.lockAndCheck({ ...identity, slotId: 'slot-2' }, ctx),
    );
    expect(wrongSlot).toBe(false);
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('fences an open slot row for the matching generation and rejects stale generations', async () => {
    const { connection, tx } = makeConnectionAndTx();
    const update = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue(undefined);
    const model = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ slotId: 'slot-1', generation: 2, state: 'open', update })
        .mockResolvedValueOnce({ slotId: 'slot-1', generation: 3, state: 'open', update })
        .mockResolvedValueOnce(null),
      create,
    } as unknown as ModelStatic<DemoSandboxFenceRecord>;
    const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model);

    await expect(fence.fenceForReset(identity)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(
      { state: 'fenced', leaseId: null, resetAttemptId: identity.attemptId },
      { transaction: tx },
    );

    await expect(fence.fenceForReset(identity)).resolves.toBe(false);

    await expect(fence.fenceForReset({ ...identity, generation: 0 })).resolves.toBe(true);
    expect(create).toHaveBeenCalledWith(
      {
        slotId: 'slot-1',
        leaseId: null,
        generation: 0,
        state: 'fenced',
        resetAttemptId: identity.attemptId,
      },
      { transaction: tx },
    );
  });

  it('rejects missing transaction context, missing row with generation > 0, and invalid inputs', async () => {
    const { connection } = makeConnectionAndTx();
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    } as unknown as ModelStatic<DemoSandboxFenceRecord>;
    const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model);

    await expect(
      fence.lockAndCheck(identity, undefined as unknown as Parameters<typeof fence.lockAndCheck>[1]),
    ).rejects.toThrow('Transaction context is required');

    await expect(fence.fenceForReset({ ...identity, generation: 1 })).resolves.toBe(false);
    await expect(fence.fenceForReset({ ...identity, attemptId: '   ' })).resolves.toBe(false);
    await expect(fence.fenceForReset({ ...identity, generation: -1 })).resolves.toBe(false);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('releases a fenced slot by advancing generation + 1 and reopening the fence', async () => {
    const { connection, tx } = makeConnectionAndTx();
    const update = jest.fn().mockResolvedValue(undefined);
    const model = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          slotId: 'slot-1',
          leaseId: null,
          generation: 2,
          state: 'fenced',
          resetAttemptId: identity.attemptId,
          update,
        })
        .mockResolvedValueOnce({
          slotId: 'slot-1',
          leaseId: null,
          generation: 2,
          state: 'open',
          resetAttemptId: null,
          update,
        }),
    } as unknown as ModelStatic<DemoSandboxFenceRecord>;
    const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model);

    await expect(fence.releaseFence(identity)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(
      { state: 'open', leaseId: null, generation: 3, resetAttemptId: null },
      { transaction: tx },
    );

    await expect(fence.releaseFence(identity)).resolves.toBe(false);
  });

  it('heals an exact 1-generation lag only when a committed reset receipt proves the prior generation finished', async () => {
    const { connection, tx } = makeConnectionAndTx();
    const update = jest.fn().mockResolvedValue(undefined);
    const model = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ slotId: 'slot-1', generation: 1, state: 'fenced', update })
        .mockResolvedValueOnce({ slotId: 'slot-1', generation: 1, state: 'fenced', update })
        .mockResolvedValueOnce({ slotId: 'slot-1', generation: 0, state: 'fenced', update }),
    } as unknown as ModelStatic<DemoSandboxFenceRecord>;
    const receiptModel = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ slotId: 'slot-1', generation: 1 })
        .mockResolvedValueOnce(null),
    } as unknown as ModelStatic<DemoSandboxResetReceiptRecord>;
    const fence = new SequelizeSandboxResetFence(connection, 'slot-1', model, receiptModel);

    // 1-generation lag with committed receipt -> heals cleanly
    await expect(fence.fenceForReset(identity)).resolves.toBe(true);
    expect(receiptModel.findOne).toHaveBeenCalledWith({
      where: { slotId: 'slot-1', generation: 1 },
      transaction: tx,
    });
    expect(update).toHaveBeenCalledWith(
      { generation: 2, state: 'fenced', leaseId: null, resetAttemptId: identity.attemptId },
      { transaction: tx },
    );

    // 1-generation lag WITHOUT committed receipt -> fails closed
    await expect(fence.fenceForReset(identity)).resolves.toBe(false);

    // 2-generation jump -> fails closed without consulting receipts
    await expect(fence.fenceForReset(identity)).resolves.toBe(false);
    expect(receiptModel.findOne).toHaveBeenCalledTimes(2);
  });
});
